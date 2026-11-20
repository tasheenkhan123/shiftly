import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const geminiAnswer = vi.fn();
vi.mock('@/lib/ai/gemini', () => ({ callGeminiJson: (...args: unknown[]) => geminiAnswer(...args) }));
const { findProductsOnGoogleShopping, SearchQuotaError } = await import('@/lib/search/googleShoppingProvider');

/** Fake SerpApi: Google Shopping results + per-product store lists */
function fakeSerpApi(shopping: object[], stores: Record<string, object[]>) {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const u = new URL(String(input));
    const body =
      u.searchParams.get('engine') === 'google_shopping'
        ? { shopping_results: shopping }
        : { product_results: { stores: stores[u.searchParams.get('page_token') || ''] || [] } };
    return new Response(JSON.stringify(body), { status: 200 });
  }));
}

const base = {
  userRequest: 'face wash under 500', target: 'face wash', budgetMax: 500, count: 3, preferences: [],
  excludeTitles: [], entityId: 'e1', storeLookups: 3, geminiKey: 'k', categoryId: 'skincare' as const,
};

beforeEach(() => {
  process.env.SERPAPI_API_KEY = 'test';
  geminiAnswer.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Google Shopping results', () => {
  it('never recommends overseas importers or over-budget items', async () => {
    fakeSerpApi(
      [
        { title: 'CeraVe Foaming Cleanser', source: 'desertcart.in', extracted_price: 400, immersive_product_page_token: 'a' },
        { title: 'Minimalist Salicylic Face Wash', source: 'Nykaa', extracted_price: 299, immersive_product_page_token: 'b' },
        { title: 'Luxury Face Wash', source: 'Amazon.in', extracted_price: 900, immersive_product_page_token: 'c' },
      ],
      { b: [{ name: 'Nykaa', link: 'https://nykaa.com/x', extracted_price: 299 }] }
    );
    geminiAnswer.mockImplementation(async (prompt: string) => {
      // the picker only ever sees the one valid listing
      expect(prompt).not.toContain('desertcart');
      expect(prompt).not.toContain('Luxury Face Wash');
      return { picks: [{ index: 0, brand: 'Minimalist', reason: 'Salicylic acid for oily skin' }] };
    });
    const { matches } = await findProductsOnGoogleShopping({ ...base, shoppingQuery: 'face wash test 1' });
    expect(matches.map(m => m.title)).toEqual(['Minimalist Salicylic Face Wash']);
  });

  it('shows 3-4 buyable stores: cheapest in-stock first, no out-of-stock or suspicious ones', async () => {
    fakeSerpApi(
      [{ title: 'Derma Co Face Wash', source: 'Amazon.in', extracted_price: 299, immersive_product_page_token: 't' }],
      { t: [
        { name: 'Smytten', link: 'https://smytten.com/x', extracted_price: 99, details_and_offers: ['Out of stock online'] },
        { name: 'Nykaa', link: 'http://www.nykaa.com/p', extracted_price: 319, details_and_offers: ['In stock online', '10% off with HDFC cards'] },
        { name: 'Amazon.in', link: 'https://amazon.in/dp/X', extracted_price: 299, details_and_offers: ['In stock online'] },
        { name: 'Cheapo', link: 'https://cheapo.in', extracted_price: 100, details_and_offers: ['In stock online'] },
        { name: 'Bulk Seller', link: 'https://bulk.in', extracted_price: 99999 },
        { name: 'Myntra', link: '/goto?url=m', extracted_price: 330, details_and_offers: ['In stock online'] },
        { name: 'Tira', link: 'https://tira.in/p', extracted_price: 340, details_and_offers: ['In stock online'] },
        { name: 'Purplle', link: 'https://purplle.com/p', extracted_price: 350, details_and_offers: ['In stock online'] },
      ] }
    );
    geminiAnswer.mockResolvedValue({ picks: [{ index: 0, brand: 'The Derma Co', reason: 'x' }] });
    const [m] = (await findProductsOnGoogleShopping({ ...base, shoppingQuery: 'face wash test 2' })).matches;
    const names = m.merchants.map(o => o.sellerName);

    expect(names[0]).toBe('Amazon.in'); // cheapest buyable, not the out-of-stock ₹99
    expect(m.lowestPrice).toBe(299);
    expect(names.length).toBeLessThanOrEqual(4);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names).not.toContain('Smytten'); // out of stock: hidden
    expect(names).not.toContain('Cheapo'); // suspiciously cheap: hidden
    expect(names).not.toContain('Bulk Seller'); // listing error: dropped
    expect(m.merchants.every(o => o.availability === 'AVAILABLE')).toBe(true);
    expect(m.merchants.find(o => o.sellerName === 'Nykaa')?.productUrl).toMatch(/^https:/); // http upgraded
    expect(m.merchants.find(o => o.sellerName === 'Nykaa')?.offers).toContain('10% off with HDFC cards');
    expect(m.merchants.find(o => o.sellerName === 'Myntra')?.productUrl).toMatch(/^https:\/\/www\.google\.co\.in\/goto/);
  });

  it('shows the products near the budget to the picker first', async () => {
    fakeSerpApi(
      [
        { title: 'Cheap Wash', source: 'Nykaa', extracted_price: 150 },
        { title: 'Premium Wash', source: 'Nykaa', extracted_price: 480 },
      ],
      {}
    );
    geminiAnswer.mockImplementation(async (prompt: string) => {
      expect(prompt.indexOf('Premium Wash')).toBeLessThan(prompt.indexOf('Cheap Wash'));
      expect(prompt).toMatch(/BEST product their budget can buy/);
      return { picks: [{ index: 0, brand: 'P', reason: 'x' }] };
    });
    const { matches } = await findProductsOnGoogleShopping({ ...base, storeLookups: 0, shoppingQuery: 'budget band test' });
    expect(matches[0].title).toBe('Premium Wash');
  });

  it("accepts a brand's official store even when titles omit the brand", async () => {
    fakeSerpApi(
      [
        { title: 'Gingham Gorgeous Fine Fragrance Mist', source: 'Bath & Body Works', extracted_price: 999, immersive_product_page_token: 'g' },
        { title: 'Some Other Mist', source: 'Myntra', extracted_price: 799, immersive_product_page_token: 'o' },
      ],
      {}
    );
    geminiAnswer.mockResolvedValue({ picks: [{ index: 0, brand: 'Bath & Body Works', reason: 'fruity' }] });
    const { matches } = await findProductsOnGoogleShopping({
      ...base, budgetMax: null, shoppingQuery: 'bbw mist test', brandFilter: ['Bath & Body Works'], categoryId: 'perfumes',
    });
    expect(matches[0]?.title).toBe('Gingham Gorgeous Fine Fragrance Mist');
  });

  it('marks close matches and ignores invented listing numbers', async () => {
    fakeSerpApi(
      [
        { title: 'Mist A', source: 'Nykaa', extracted_price: 499 },
        { title: 'Mist B', source: 'Nykaa', extracted_price: 450 },
      ],
      {}
    );
    geminiAnswer.mockResolvedValue({ picks: [
      { index: 0, brand: 'A', reason: 'exact' },
      { index: 1, brand: 'B', reason: 'more floral than citrus', closeMatch: true },
      { index: 42, brand: 'Ghost', reason: 'invented' },
    ] });
    const { matches } = await findProductsOnGoogleShopping({ ...base, shoppingQuery: 'mist test 4' });
    expect(matches.map(m => m.title)).toEqual(['Mist A', 'Mist B']);
    expect(matches[1].closeMatch).toBe(true);
    expect(matches[0].isTopPick).toBe(true);
  });

  it('reports a used-up SerpApi plan instead of returning partial results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Your account has run out of searches.' }), { status: 429 })
    ));
    await expect(findProductsOnGoogleShopping({ ...base, shoppingQuery: 'quota test' })).rejects.toBeInstanceOf(SearchQuotaError);
  });
});
