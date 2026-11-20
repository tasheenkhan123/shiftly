/**
 * Google Shopping product search via SerpApi.
 *
 * Why: Tavily returns web articles and snippets, so products, prices and links had to be guessed.
 * Google Shopping returns real, structured listings (title, store, price, rating, image), and the
 * Immersive Product endpoint returns every store selling that exact product with its own price,
 * discount and offer text. That gives a real multi-store comparison.
 *
 * Needs SERPAPI_API_KEY in .env.local (https://serpapi.com).
 * Cost per single-product search: 1 shopping search + 1 store lookup per pick (default 3).
 */

import { MatchTier, MerchantOffer, ProductMatch } from '@/types';
import { callGeminiJson } from '@/lib/ai/gemini';
import { getCategory, isTrustedStore, type CategoryId } from '@/lib/categories';

// ---------------------------------------------------------------------------
// Small in-memory cache: repeat searches are instant and don't spend SerpApi credits.
// (Per server instance; on Vercel each warm instance keeps its own copy.)
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return value;
}

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

export interface ShoppingListing {
  position: number;
  title: string;
  source: string;
  price: number | null;
  priceText?: string;
  rating: number | null;
  reviews: number | null;
  thumbnail: string | null;
  productLink: string | null;
  pageToken: string | null;
  multipleSources: boolean;
  delivery?: string;
  extensions: string[];
  snippet?: string;
}

export interface StoreListing {
  name: string;
  logo?: string;
  link: string;
  title?: string;
  price: number | null;
  originalPrice: number | null;
  discount?: string;
  tag?: string;
  detailsAndOffers: string[];
  paymentMethods?: string;
  shipping?: string;
  rating: number | null;
  reviews: number | null;
}

export interface ProductStoresResult {
  title?: string;
  brand?: string;
  thumbnails: string[];
  stores: StoreListing[];
}

export function isGoogleShoppingConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

async function serpApiGet(params: Record<string, string>, timeoutMs = 20000): Promise<any> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error('SERPAPI_API_KEY is not configured');

  const url = new URL(SERPAPI_ENDPOINT);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('api_key', apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(`SerpApi ${params.engine} failed (HTTP ${res.status}): ${data?.error || 'unknown error'}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Google returns some store links as relative redirects ("/goto?url=..."); make them absolute. */
function absoluteLink(link: string): string {
  try {
    return new URL(link, 'https://www.google.co.in').toString();
  } catch {
    return link;
  }
}

/** Stores that ship from outside India show converted, inflated prices; keep them out of the comparison. */
const FOREIGN_STORE = /desertcart|ubuy|\.ae\b|\.sa\b|\.qa\b|\.kw\b|\.om\b|\.bh\b|\.co\.uk\b|\.com\.au\b/i;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** One Google Shopping search (India). Returns about 40 listings. */
export async function searchGoogleShopping(
  query: string,
  opts: { maxPrice?: number | null; minPrice?: number | null } = {}
): Promise<ShoppingListing[]> {
  const params: Record<string, string> = {
    engine: 'google_shopping',
    q: query,
    gl: 'in',
    hl: 'en',
    google_domain: 'google.co.in',
  };
  // Note: Google's own max_price filter on google.co.in collapses results to a handful of
  // obscure sellers (tested: 2 results vs 40). We filter by budget ourselves instead.
  void opts;

  const data = await cached(`shop:${query.toLowerCase().trim()}`, () => serpApiGet(params));
  const raw: any[] = Array.isArray(data?.shopping_results) ? data.shopping_results : [];

  return raw
    .filter(r => str(r?.title) && /[a-z]{3,}/i.test(r.title))
    .map((r, i) => ({
      position: typeof r.position === 'number' ? r.position : i + 1,
      title: r.title.trim(),
      source: str(r.source) || 'Store',
      price: num(r.extracted_price),
      priceText: str(r.price),
      rating: num(r.rating),
      reviews: num(r.reviews),
      thumbnail: str(r.serpapi_thumbnail) || str(r.thumbnail) || null,
      productLink: str(r.product_link) ? absoluteLink(r.product_link.trim()) : null,
      pageToken: str(r.immersive_product_page_token) || null,
      multipleSources: Boolean(r.multiple_sources),
      delivery: str(r.delivery),
      extensions: Array.isArray(r.extensions) ? r.extensions.filter((e: unknown) => typeof e === 'string') : [],
      snippet: str(r.snippet),
    }));
}

/** All stores selling one product, with each store's price and offer text. */
export async function getProductStores(pageToken: string): Promise<ProductStoresResult> {
  const data = await cached(`stores:${pageToken}`, () =>
    serpApiGet({ engine: 'google_immersive_product', page_token: pageToken, more_stores: 'true' })
  );
  const pr = data?.product_results || {};
  const stores: StoreListing[] = (Array.isArray(pr.stores) ? pr.stores : [])
    .filter((s: any) => str(s?.name) && str(s?.link))
    .map((s: any) => ({
      name: s.name.trim(),
      logo: str(s.logo),
      link: absoluteLink(s.link.trim()),
      title: str(s.title),
      price: num(s.extracted_price),
      originalPrice: num(s.extracted_original_price),
      discount: str(s.discount),
      tag: str(s.tag),
      detailsAndOffers: Array.isArray(s.details_and_offers)
        ? s.details_and_offers.filter((d: unknown) => typeof d === 'string' && d.trim())
        : [],
      paymentMethods: str(s.payment_methods),
      shipping: str(s.shipping),
      rating: num(s.rating),
      reviews: num(s.reviews),
    }));

  const thumbnails: string[] = (Array.isArray(pr.thumbnails) ? pr.thumbnails : []).filter(
    (t: unknown): t is string => typeof t === 'string' && t.startsWith('http')
  );

  return { title: str(pr.title), brand: str(pr.brand), thumbnails, stores };
}

// ---------------------------------------------------------------------------
// Selection: Gemini picks the best N real listings (it never invents products)
// ---------------------------------------------------------------------------

interface Pick {
  index: number;
  brand: string;
  reason: string;
  fitsYou?: string[];
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fallbackPicks(listings: ShoppingListing[], count: number): Pick[] {
  const scored = listings.map((l, index) => ({
    index,
    score: (l.rating || 3.5) * Math.log10((l.reviews || 1) + 10) - l.position * 0.02,
  }));
  scored.sort((a, b) => b.score - a.score);
  const seenBrand = new Set<string>();
  const picks: Pick[] = [];
  for (const s of scored) {
    const brand = listings[s.index].title.split(/\s+/)[0];
    if (seenBrand.has(brand.toLowerCase())) continue;
    seenBrand.add(brand.toLowerCase());
    const l = listings[s.index];
    const reason = l.rating && l.reviews
      ? `Rated ${l.rating}★ by ${l.reviews.toLocaleString('en-IN')} buyers on Google Shopping`
      : 'One of the top Google Shopping results for this search';
    picks.push({ index: s.index, brand, reason });
    if (picks.length === count) break;
  }
  return picks;
}

async function pickBestListings(
  listings: ShoppingListing[],
  ctx: {
    userRequest: string;
    target: string;
    budgetMax: number | null;
    count: number;
    preferences: string[];
    categoryId: CategoryId;
    userPreferences: string[];
    brandFilter: string[];
    brandGroupLabel?: string;
  },
  geminiKey: string
): Promise<Pick[]> {
  const cat = getCategory(ctx.categoryId);
  const lines = listings
    .map(
      (l, i) =>
        `${i}. ${l.title} | store: ${l.source} | price: ${l.price ? '₹' + l.price : 'unknown'} | rating: ${
          l.rating ?? 'n/a'
        } (${l.reviews ?? 0} reviews)${l.multipleSources ? ' | sold by multiple stores' : ''}`
    )
    .join('\n');

  const prompt = `You are a careful shopping expert for customers in India.
Customer request: "${ctx.userRequest}"
They want: ${ctx.target}
Budget per item: ${ctx.budgetMax ? `up to ₹${ctx.budgetMax}` : 'not specified'}
What this customer told us about themselves: ${ctx.userPreferences.length ? ctx.userPreferences.join('; ') : 'nothing yet'}
Other preferences for this search: ${ctx.preferences.length ? ctx.preferences.join(', ') : 'none'}
${ctx.brandFilter.length ? `Brands: the customer wants ${ctx.brandGroupLabel || 'specific'} brands only (${ctx.brandFilter.slice(0, 20).join(', ')}). Reject other brands.\n` : ''}
${cat.guidance}

Below are REAL Google Shopping listings. Pick the ${ctx.count} best ones for this customer.
Rules:
- Only pick listings that ARE the requested product type. Reject accessories, refills, parts, bundles of a different product, and different categories (a serum is not a toner, a mouse pad is not a mouse).
- Never pick a listing over budget.
- Prefer well-known brands with high ratings and many reviews.
- Prefer listings "sold by multiple stores" and from major Indian stores (Amazon.in, Flipkart, Nykaa, Purplle, Tira, Tata 1mg, Myntra) over small unknown sellers.
- Each pick must be a DIFFERENT product, ideally from a different brand.
- PERSONALISE: choose products that genuinely suit what the customer told us about themselves (skin type, size, use, scent, etc.), using the expertise above and well-known facts about these products. A popular product that does not suit them is a worse pick than a slightly less popular one that does.
- If fewer than ${ctx.count} listings qualify, return fewer. Do not pad.
- Never use a size (e.g. "UK 9", "M") as a fitsYou tag: we cannot confirm a size is in stock.
- In reasons, never claim the customer asked for something they did not say (no "the matte finish you requested" unless they asked for matte).

Listings:
${lines}

Respond with JSON: {"picks":[{"index":number,"brand":"brand name","reason":"one short sentence on why it suits THIS customer, tied to what they told us when relevant (e.g. 'Gel texture with salicylic acid that controls oil without drying'). Do NOT mention any price or store name, because prices are shown separately and differ per store.","fitsYou":["up to 3 very short tags linking the product to the customer, e.g. 'Oily skin: oil-free gel', 'K-beauty'. Use [] if the customer told us nothing."]}]}`;

  const parsed = await callGeminiJson<{ picks?: Pick[] }>(prompt, geminiKey, { label: 'shopping-pick', totalTimeoutMs: 14000 });
  // Gemini returns either {"picks":[...]} or a bare [...] array
  const rawPicks: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.picks) ? parsed!.picks : [];
  const unique: Pick[] = [];
  const seen = new Set<number>();
  for (const p of rawPicks) {
    const index = Number(p?.index); // Gemini sometimes returns "3" instead of 3
    if (!Number.isInteger(index) || index < 0 || index >= listings.length || seen.has(index)) continue;
    seen.add(index);
    const fitsYou = Array.isArray(p.fitsYou)
      ? p.fitsYou.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim().slice(0, 48)).slice(0, 3)
      : [];
    unique.push({ index, brand: str(p.brand) || '', reason: str(p.reason) || '', fitsYou });
    if (unique.length === ctx.count) break;
  }
  if (unique.length === 0) {
    console.warn(`[shopping-pick] Gemini gave no usable picks (raw: ${JSON.stringify(parsed)?.slice(0, 300)}); using rating-based fallback`);
    return fallbackPicks(listings, ctx.count);
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Building UI objects
// ---------------------------------------------------------------------------

function storeToOffer(s: StoreListing, idx: number, checkedAt: string): MerchantOffer {
  const details = s.detailsAndOffers;
  const lowerDetails = details.join(' ').toLowerCase();
  const availability = /out of stock|unavailable/.test(lowerDetails)
    ? 'OUT_OF_STOCK'
    : /in stock/.test(lowerDetails)
      ? 'AVAILABLE'
      : 'UNKNOWN';
  const offers = [...details];
  if (s.paymentMethods) offers.push(s.paymentMethods);

  return {
    id: `store_${idx}_${Math.random().toString(36).slice(2, 8)}`,
    sellerName: s.name,
    sellerLogo: s.logo,
    sellerRating: s.rating ?? undefined,
    price: s.price ?? 0,
    priceKnown: s.price !== null,
    originalPrice: s.originalPrice && s.price && s.originalPrice > s.price ? s.originalPrice : undefined,
    currency: 'INR',
    productUrl: s.link,
    urlType: 'PRODUCT',
    availability,
    source: 'Google Shopping',
    verified: s.price !== null,
    inStock: availability === 'AVAILABLE',
    deliveryEstimate: s.shipping,
    isLowestPrice: false,
    verifiedAt: checkedAt,
    offers,
    discountLabel: s.discount,
    tag: s.tag,
    paymentMethods: s.paymentMethods,
    shipping: s.shipping,
  };
}

function listingToOffer(l: ShoppingListing, checkedAt: string): MerchantOffer {
  return {
    id: `listing_${l.position}_${Math.random().toString(36).slice(2, 8)}`,
    sellerName: l.source,
    price: l.price ?? 0,
    priceKnown: l.price !== null,
    currency: 'INR',
    productUrl: l.productLink || '',
    urlType: l.productLink ? 'PRODUCT' : 'UNAVAILABLE',
    availability: 'UNKNOWN',
    source: 'Google Shopping',
    verified: l.price !== null,
    inStock: false,
    deliveryEstimate: l.delivery,
    isLowestPrice: false,
    verifiedAt: checkedAt,
    offers: l.extensions,
  };
}

function scoreListing(l: ShoppingListing, budgetMax: number | null) {
  const ratingPts = l.rating ? Math.round((l.rating / 5) * 25) : 12;
  const reviewPts = l.reviews ? Math.min(15, Math.round(Math.log10(l.reviews + 1) * 5)) : 0;
  const budgetPts = budgetMax && l.price ? (l.price <= budgetMax ? 15 : 0) : 10;
  const total = Math.min(99, 45 + ratingPts + reviewPts + budgetPts);
  return { total, ratingPts, reviewPts, budgetPts };
}

export interface GoogleShoppingSearchParams {
  shoppingQuery: string;
  userRequest: string;
  target: string;
  budgetMax: number | null;
  count: number;
  preferences: string[];
  excludeTitles: string[];
  entityId: string;
  componentName?: string;
  allocatedBudget?: number;
  /** How many of the picks get a full multi-store lookup (each costs one SerpApi search) */
  storeLookups: number;
  geminiKey: string;
  onProgress?: (stage: 'choosing' | 'comparing', message: string) => void;
  /** Personalisation */
  categoryId?: CategoryId;
  userPreferences?: string[];
  /** Only these brands (explicit, or expanded from a group like K-beauty) */
  brandFilter?: string[];
  brandGroupLabel?: string;
}

function normBrand(b: string): string {
  return b.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Does this listing belong to one of the brands? (title starts with / contains the brand name) */
function matchesBrand(title: string, brands: string[]): boolean {
  const t = ` ${normBrand(title)} `;
  return brands.some(b => {
    const nb = normBrand(b);
    return nb.length >= 2 && t.includes(` ${nb} `);
  });
}

export async function findProductsOnGoogleShopping(
  p: GoogleShoppingSearchParams
): Promise<{ matches: ProductMatch[]; listingsFound: number }> {
  const categoryId: CategoryId = p.categoryId || 'other';
  const brandFilter = p.brandFilter || [];
  let listings = await searchGoogleShopping(p.shoppingQuery, { maxPrice: p.budgetMax });

  const excluded = p.excludeTitles.map(normTitle).filter(Boolean);
  const usable = (list: ShoppingListing[]) =>
    list
      .filter(l => !p.budgetMax || (l.price !== null && l.price <= p.budgetMax))
      .filter(l => {
        const t = normTitle(l.title);
        return !excluded.some(ex => t.includes(ex) || ex.includes(t));
      })
      .filter(l => brandFilter.length === 0 || matchesBrand(l.title, brandFilter));

  let eligible = usable(listings);

  // Brand-restricted searches (e.g. "K-beauty") often return few matching listings from a generic query.
  // Search the top brands directly, at most 2 extra searches (cached, so repeats are free).
  if (brandFilter.length > 0 && eligible.length < p.count * 2) {
    const present = new Set(eligible.map(l => brandFilter.find(b => matchesBrand(l.title, [b]))).filter(Boolean));
    const productWords = p.target.replace(/k-?\s?beauty|korean|japanese|j-beauty|indian brands?|brands?/gi, '').trim() || p.target;
    const extraBrands = brandFilter.filter(b => !present.has(b)).slice(0, 2);
    if (extraBrands.length) {
      p.onProgress?.('choosing', `Checking ${extraBrands.join(' and ')} too…`);
      const extra = await Promise.allSettled(extraBrands.map(b => searchGoogleShopping(`${b} ${productWords}`, { maxPrice: p.budgetMax })));
      const seen = new Set(listings.map(l => normTitle(l.title)));
      for (const r of extra) {
        if (r.status !== 'fulfilled') continue;
        for (const l of r.value) {
          const key = normTitle(l.title);
          if (!seen.has(key)) {
            seen.add(key);
            listings = [...listings, l];
          }
        }
      }
      eligible = usable(listings);
    }
  }
  eligible = eligible.slice(0, 30);

  if (eligible.length === 0) return { matches: [], listingsFound: listings.length };

  p.onProgress?.('choosing', `Found ${eligible.length} listings. Choosing the best ${p.count}…`);
  const picks = await pickBestListings(
    eligible,
    {
      userRequest: p.userRequest,
      target: p.target,
      budgetMax: p.budgetMax,
      count: p.count,
      preferences: p.preferences,
      categoryId,
      userPreferences: p.userPreferences || [],
      brandFilter,
      brandGroupLabel: p.brandGroupLabel,
    },
    p.geminiKey
  );

  p.onProgress?.('comparing', 'Comparing prices and offers across stores…');
  const checkedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const matches = await Promise.all(
    picks.map(async (pick, idx): Promise<ProductMatch> => {
      const l = eligible[pick.index];
      let offers: MerchantOffer[] = [];
      let brand = pick.brand;
      let imageUrl = l.thumbnail || '';

      if (idx < p.storeLookups && l.pageToken) {
        try {
          const detail = await getProductStores(l.pageToken);
          offers = detail.stores
            .filter(s => !FOREIGN_STORE.test(s.name) && !FOREIGN_STORE.test(s.link))
            .map((s, i) => storeToOffer(s, i, checkedAt));
          if (detail.brand) brand = detail.brand;
          if (detail.thumbnails[0]) imageUrl = detail.thumbnails[0];
        } catch (err: any) {
          console.warn(`[google-shopping] store lookup failed for "${l.title}": ${err?.message}`);
        }
      }
      if (offers.length === 0) offers = [listingToOffer(l, checkedAt)];
      for (const o of offers) o.trusted = isTrustedStore(o.sellerName, categoryId);

      // Buyable first (in stock, then unconfirmed, then out of stock), cheapest first within each group
      const rank = (o: MerchantOffer) =>
        (o.priceKnown === false ? 10 : 0) + (o.availability === 'OUT_OF_STOCK' ? 5 : o.availability === 'UNKNOWN' ? 1 : 0);
      offers.sort((a, b) => rank(a) - rank(b) || a.price - b.price);
      let buyable = offers.filter(o => o.priceKnown !== false && o.availability !== 'OUT_OF_STOCK');
      // Prices far below the other stores are usually a different variant, refurbished, or an unreliable
      // seller. Flag them and don't let them become the headline "lowest price".
      if (buyable.length >= 3) {
        const sorted = buyable.map(o => o.price).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const outliers = buyable.filter(o => o.price < median * 0.55);
        for (const o of outliers) o.tag = 'Unusually low price, check the seller and variant';
        buyable = buyable.filter(o => !outliers.includes(o));
        // Prices far above the rest are listing errors or bulk/wholesale (e.g. ₹1,26,968 for earbuds): drop them
        const tooHigh = new Set(offers.filter(o => o.priceKnown !== false && o.price > median * 3));
        if (tooHigh.size) {
          offers = offers.filter(o => !tooHigh.has(o));
          buyable = buyable.filter(o => !tooHigh.has(o));
        }
      }
      const cheapest = buyable.reduce<MerchantOffer | null>((m, o) => (!m || o.price < m.price ? o : m), null);
      if (cheapest) {
        cheapest.isLowestPrice = true;
        // The card's main button and price use merchants[0], so make it the cheapest buyable store
        offers = [cheapest, ...offers.filter(o => o !== cheapest)];
      }
      const lowest = cheapest?.price ?? l.price ?? 0;
      const priceKnown = Boolean(cheapest) || l.price !== null;
      // If the cheapest store isn't a well-known one, also point out the best price at a trusted store
      let trustedOffer: ProductMatch['trustedOffer'];
      if (cheapest && !cheapest.trusted) {
        const bestTrusted = buyable.filter(o => o.trusted).sort((a, b) => a.price - b.price)[0];
        if (bestTrusted) trustedOffer = { store: bestTrusted.sellerName, price: bestTrusted.price };
      }

      const score = scoreListing(l, p.budgetMax);
      const tier: MatchTier = score.total >= 85 ? 'EXACT' : score.total >= 70 ? 'CLOSE' : 'BUDGET_ALT';

      const keyAttributes: Record<string, string> = {};
      if (p.componentName) keyAttributes['Component'] = p.componentName;
      keyAttributes['Stores'] = String(offers.length);
      if (l.delivery) keyAttributes['Delivery'] = l.delivery;

      return {
        id: `gs_${p.entityId}_${idx}_${Date.now()}`,
        entityId: p.entityId,
        title: l.title,
        brand,
        imageUrl,
        matchTier: tier,
        matchScore: score.total,
        matchReasons: [pick.reason || 'Listed on Google Shopping', `Price from Google Shopping, checked ${checkedAt}`],
        whyPicked: pick.reason || undefined,
        fitsYou: pick.fitsYou && pick.fitsYou.length ? pick.fitsYou : undefined,
        trustedOffer,
        scoreBreakdown: {
          visualSimilarity: 0,
          brandMatch: brand ? 100 : 50,
          categoryMatch: 100,
          colorMatch: 0,
          semanticMatch: Math.round((score.ratingPts / 25) * 100),
          budgetFitBonus: Math.round((score.budgetPts / 15) * 100),
          totalScore: score.total,
        },
        lowestPrice: lowest,
        priceKnown,
        currency: 'INR',
        availableMerchantsCount: offers.length,
        merchants: offers,
        keyAttributes,
        productRating: l.rating ?? undefined,
        reviewsCount: l.reviews ?? undefined,
        dataSource: 'Google Shopping',
      };
    })
  );

  return { matches, listingsFound: listings.length };
}
