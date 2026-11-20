/**
 * Main search flow on Google Shopping (SerpApi): single products and setups.
 */
import type { SiftlyAnalysisResult, DetectedEntity, ProductMatch, UserConstraints } from '@/types';
import type { ProgressFn, ParsedShoppingIntent } from '@/lib/search/types';
import {
  findProductsOnGoogleShopping,
  searchGoogleShopping,
  SearchQuotaError,
  usableListings,
  type ShoppingListing,
} from '@/lib/search/googleShoppingProvider';
import { DEDICATED_GPU, isComputerPart, isCompletePc, planSetup } from '@/lib/search/setupPlanner';
import { createEmptyResponse } from '@/lib/search/responses';

/** "face wash under 500" -> "face wash", so headings don't repeat the budget */
export function stripBudgetWords(text: string): string {
  const out = text
    .replace(/\s*(under|below|within|less than|upto|up to|for)\s*(rs\.?|inr|₹)?\s*[\d,.]+\s*(k|lakh|lakhs|lac|rs|inr|rupees)?\b/gi, '')
    .trim();
  return out || text;
}

/** "Picked for you" chips: active preferences plus a brand group like K-beauty (without repeating it) */
export function personalTags(parsedIntent: ParsedShoppingIntent): string[] {
  const label = parsedIntent.brandGroupLabel;
  const tags = [...parsedIntent.activePreferences];
  if (label && !tags.some(t => t.toLowerCase().includes(label.toLowerCase()))) tags.push(`Brands: ${label}`);
  return tags;
}

/**
 * Google Shopping flow (SerpApi). Returns null if nothing usable was found, so the caller can fall back.
 */
export async function runGoogleShoppingFlow(
  rawInput: string,
  parsedIntent: ParsedShoppingIntent,
  geminiApiKey: string,
  startTime: number,
  imagePreviewUrl?: string,
  constraints?: UserConstraints,
  onProgress: ProgressFn = () => {}
): Promise<{ result: SiftlyAnalysisResult; assistantSummary: string; isGroundingActive: boolean } | null> {
  const base = {
    onProgress,
    userRequest: rawInput,
    preferences: [...(parsedIntent.appliedPreferences || []), ...(parsedIntent.priorities || [])],
    categoryId: parsedIntent.categoryId,
    userPreferences: parsedIntent.activePreferences,
    brandFilter: parsedIntent.brandFilter,
    brandGroupLabel: parsedIntent.brandGroupLabel,
    suggestedProducts: parsedIntent.suggestedProducts,
    productType: parsedIntent.productType || undefined,
    excludeTitles: parsedIntent.excludedProductTitles || [],
    geminiKey: geminiApiKey,
  };
  const makeEntity = (id: string, name: string, query: string): DetectedEntity => ({
    id,
    name,
    category: parsedIntent.category as DetectedEntity['category'],
    productType: name,
    brand: '',
    brandConfidence: 'unknown',
    confidenceScore: 90,
    attributes: { category: parsedIntent.category, productType: name, brandConfidence: 'unknown', color: '' },
    optimizedSearchQuery: query,
  });
  const resultBase = (entities: DetectedEntity[], matches: Record<string, ProductMatch[]>, queries: string[]): SiftlyAnalysisResult => ({
    id: `siftly_${Date.now()}`,
    inputType: imagePreviewUrl ? 'IMAGE' : 'TEXT',
    intent: 'SHOPPING',
    primaryCategory: parsedIntent.category as any,
    rawInput,
    mediaPreviewUrl: imagePreviewUrl,
    userConstraints: constraints || { currency: 'INR' },
    detectedEntities: entities,
    productMatches: matches,
    isGroundingActive: true,
    searchQueries: queries,
    groundingSources: [],
    executionTimeMs: Date.now() - startTime,
    categoryId: parsedIntent.categoryId,
    learnedPreferences: parsedIntent.learnedPreferences,
    activePreferences: personalTags(parsedIntent),
    assumptions: parsedIntent.assumptions || undefined,
    followUpQuestion: parsedIntent.followUpQuestion || undefined,
    askPreference: parsedIntent.askPreference || undefined,
  });

  // ---- Setup / bundle ----
  // Search every part first, then plan the whole setup from REAL prices in one Gemini call.
  // (Planning from memory failed: Gemini allotted ₹60k for an RTX gaming PC, but real ones start near ₹80k,
  // so the PC was dropped and a ₹1 lakh setup came to ₹14,607.)
  if (parsedIntent.isBundleOrSetup && parsedIntent.bundleComponents && parsedIntent.bundleComponents.length > 0) {
    const comps = parsedIntent.bundleComponents.slice(0, 6);
    const totalBudget = parsedIntent.totalBudget || parsedIntent.budgetMax || null;
    onProgress('searching', `Searching Google Shopping for ${comps.length} parts: ${comps.map(c => c.componentName).join(', ')}…`);

    const isGaming = /gaming|gamer|game/i.test(`${rawInput} ${parsedIntent.cleanTarget}`);
    const searched = await Promise.allSettled(
      comps.map(async c => {
        const main = await searchGoogleShopping((c.shoppingQuery && c.shoppingQuery.trim()) || c.componentName);
        if (!isComputerPart(c.componentName)) return main;
        // Make sure real prebuilt PCs (with graphics cards, for gaming) are in the list, not just cases/parts
        const extra = await searchGoogleShopping(isGaming ? 'prebuilt gaming pc rtx desktop' : 'desktop pc').catch(() => []);
        const seen = new Set(main.map(l => l.title.toLowerCase()));
        return [...main, ...extra.filter(l => !seen.has(l.title.toLowerCase()))];
      })
    );
    const parts = comps.map((comp, i) => {
      const r = searched[i];
      let listings = r.status === 'fulfilled' ? usableListings(r.value) : [];
      if (r.status === 'rejected') console.warn(`[setup] search failed for ${comp.componentName}:`, r.reason?.message);
      // A setup with silently missing parts (e.g. no PC) is misleading: stop and report the limit instead
      if (r.status === 'rejected' && r.reason instanceof SearchQuotaError) throw r.reason;
      if (isComputerPart(comp.componentName)) {
        // Code decides, not the model: whole PCs only, and for gaming only dedicated graphics when affordable
        listings = listings.filter(l => isCompletePc(l.title));
        if (isGaming) {
          const affordable = (l: ShoppingListing) => !totalBudget || (l.price || 0) <= totalBudget * 0.9;
          const dedicated = listings.filter(l => DEDICATED_GPU.test(l.title) && affordable(l));
          if (dedicated.length) listings = [...dedicated, ...listings.filter(l => DEDICATED_GPU.test(l.title) && !affordable(l))];
        }
        listings = listings.sort((a, b) => (a.price || 0) - (b.price || 0));
        console.info(`[setup] ${comp.componentName}: ${listings.length} complete PCs${isGaming ? ' (dedicated GPU preferred)' : ''}`);
      }
      return { comp, listings: listings.slice(0, 18) };
    });
    const searchable = parts.filter(p => p.listings.length > 0);
    if (searchable.length === 0) return null;

    onProgress('choosing', `Planning the best setup${totalBudget ? ` within ₹${totalBudget.toLocaleString('en-IN')}` : ''}…`);
    const plan = await planSetup(rawInput, parsedIntent, searchable, totalBudget, geminiApiKey);

    onProgress('comparing', 'Comparing prices and offers across stores…');
    const built = await Promise.allSettled(
      plan.parts.map(async (pp, i) => {
        const id = `entity_comp_${i}_${Date.now()}`;
        const { comp, listings } = searchable[pp.partIndex];
        const { matches } = await findProductsOnGoogleShopping({
          ...base,
          onProgress: undefined,
          shoppingQuery: comp.shoppingQuery || comp.componentName,
          target: comp.componentName,
          budgetMax: null,
          count: pp.picks.length,
          entityId: id,
          componentName: comp.componentName,
          storeLookups: 1, // full store comparison for this part's main pick only, to save API calls
          preset: { listings, picks: pp.picks },
        });
        return { entity: makeEntity(id, comp.componentName, comp.shoppingQuery || comp.componentName), matches };
      })
    );
    const entities: DetectedEntity[] = [];
    const matches: Record<string, ProductMatch[]> = {};
    for (const r of built) {
      if (r.status === 'fulfilled' && r.value.matches.length > 0) {
        entities.push(r.value.entity);
        matches[r.value.entity.id] = r.value.matches;
      } else if (r.status === 'rejected') {
        console.warn('[setup] building part failed:', r.reason?.message);
      }
    }
    if (entities.length === 0) return null;

    // Real total of the main picks (after store comparison may have found cheaper stores)
    const total = Math.round(entities.reduce((sum, e) => sum + (matches[e.id]?.[0]?.lowestPrice || 0), 0));
    const budgetStr = totalBudget ? ` for ₹${totalBudget.toLocaleString('en-IN')}` : '';
    const leftStr = totalBudget && total <= totalBudget ? ` (₹${(totalBudget - total).toLocaleString('en-IN')} left)` : '';
    const missing = parts.filter(p => p.listings.length === 0).map(p => p.comp.componentName);
    const notes = [plan.note, plan.missing, missing.length ? `Couldn't find listings for: ${missing.join(', ')}.` : null]
      .filter(Boolean)
      .join(' ');

    const result = resultBase(entities, matches, comps.map(c => c.shoppingQuery || c.componentName));
    result.assumptions = notes || result.assumptions;
    return {
      result,
      assistantSummary: `Best **${stripBudgetWords(parsedIntent.cleanTarget)}**${budgetStr}: total **₹${total.toLocaleString('en-IN')}**${leftStr}`,
      isGroundingActive: true,
    };
  }

  // ---- Single product ----
  const entityId = `entity_${Date.now()}`;
  const count = parsedIntent.requestedCount || 3;
  onProgress('searching', `Searching Google Shopping for ${parsedIntent.shoppingQuery || parsedIntent.cleanTarget}…`);
  const { matches, listingsFound } = await findProductsOnGoogleShopping({
    ...base,
    shoppingQuery: parsedIntent.shoppingQuery || parsedIntent.cleanTarget,
    target: parsedIntent.cleanTarget,
    budgetMax: parsedIntent.budgetMax,
    count,
    entityId,
    storeLookups: Math.min(count, 3),
  });

  const budgetStr = parsedIntent.budgetMax ? ` under ₹${parsedIntent.budgetMax.toLocaleString('en-IN')}` : '';
  if (matches.length === 0) {
    return createEmptyResponse(
      rawInput,
      listingsFound > 0
        ? `I found ${listingsFound} listings for **${parsedIntent.cleanTarget}**, but none matched${budgetStr}. Try raising the budget a little or describing the product differently.`
        : `I could not find **${parsedIntent.cleanTarget}** on Google Shopping. Try describing it differently.`,
      startTime,
      constraints
    );
  }

  // Short heading only: the cards show the details, and the bubble renders the "Picked for you" chips,
  // the assumption note and the follow-up question from the result fields.
  const seen = parsedIntent.imageDescription ? `In your image I can see: ${parsedIntent.imageDescription}\n\n` : '';
  // Drop budget words from the target so the heading doesn't say "under 3000 under ₹3,000"
  const target = stripBudgetWords(parsedIntent.cleanTarget);
  const summary = `${seen}Top ${matches.length} **${target}**${budgetStr}`;

  return {
    result: resultBase([makeEntity(entityId, parsedIntent.cleanTarget, parsedIntent.shoppingQuery)], { [entityId]: matches }, [parsedIntent.shoppingQuery]),
    assistantSummary: summary,
    isGroundingActive: true,
  };
}
