/**
 * Setup planner: builds a complete setup (gaming, work-from-home...) from REAL listings,
 * using 85-100% of the budget. The code enforces the budget and validates PCs.
 */
import { callGeminiJson } from '@/lib/ai/gemini';
import type { BundleComponentPlan, ParsedShoppingIntent } from '@/lib/search/types';
import type { Pick as ListingPick, ShoppingListing } from '@/lib/search/googleShoppingProvider';

// "Ryzen 5 5600GT" / "8500G" = built-in graphics; RTX / GTX / RX 6600 = dedicated graphics card
export const DEDICATED_GPU = /\b(rtx|gtx)\s?\d{3,4}|\b(rx|radeon rx)\s?\d{3,4}|\barc\s?a\d{3}/i;

export const INTEGRATED = /\bryzen\s?[3579]\s?\d{4}g[et]?\b|\b\d{4}g[et]?\b|\bintel (uhd|iris)\b|integrated graphics|vega\s?\d/i;

export const CPU_SPEC = /\b(i[3579][- ]?\d{4,5}|core\s?(i[3579]|ultra\s?[579])|ryzen\s?[3579]|intel\s?core)/i;

export const NOT_A_PC = /\b(case|cabinet|chassis|motherboard|mother board|cooler|psu|power supply|fan kit|graphics card)\b/i;

/** Is this setup part a whole computer (vs. a monitor, mouse, chair...)? */
export function isComputerPart(name: string): boolean {
  return /\b(pc|desktop|computer|cpu|tower)\b/i.test(name) && !/mouse|pad|chair|desk(?!top)|keyboard|headset|monitor/i.test(name);
}

/** A complete PC: names a processor and isn't an empty case, cabinet or motherboard */
export function isCompletePc(title: string): boolean {
  return CPU_SPEC.test(title) && !NOT_A_PC.test(title.replace(/\b(cabinet|case)\s+(with|\+)/i, ''));
}

export interface PlannedPart {
  partIndex: number;
  picks: ListingPick[];
}

/**
 * Plans a complete setup from real listings: one main pick per part, plus up to 2 alternatives,
 * aiming to use 85–100% of the budget on the parts that matter most. The code then enforces the budget.
 */
export async function planSetup(
  rawInput: string,
  parsedIntent: ParsedShoppingIntent,
  parts: { comp: BundleComponentPlan; listings: ShoppingListing[] }[],
  totalBudget: number | null,
  geminiApiKey: string
): Promise<{ parts: PlannedPart[]; note: string | null; missing: string | null }> {
  const low = totalBudget ? Math.round(totalBudget * 0.85) : null;
  const gpuTag = (componentName: string, title: string) => {
    if (!/pc|desktop|computer|cpu|tower/i.test(componentName)) return '';
    if (DEDICATED_GPU.test(title)) return ' [dedicated GPU]';
    if (INTEGRATED.test(title)) return ' [integrated graphics only]';
    return ' [graphics not stated]';
  };
  const partsText = parts
    .map(
      (p, pi) =>
        `PART ${pi}: ${p.comp.componentName}\n` +
        p.listings
          .map((l, i) => `  ${i}. ${l.title}${gpuTag(p.comp.componentName, l.title)} | ${l.source} | ₹${l.price} | ${l.rating ?? 'n/a'}★ (${l.reviews ?? 0})`)
          .join('\n')
    )
    .join('\n\n');

  const prompt = `You are an expert building a complete ${parsedIntent.cleanTarget} for a customer in India.
Customer request: "${rawInput}"
Total budget: ${totalBudget ? `₹${totalBudget}` : 'not stated (choose sensible good value)'}
What the customer told us about themselves: ${parsedIntent.activePreferences.join('; ') || 'nothing'}

Below are REAL Google Shopping listings for each part (index | title | store | price | rating).
Build the BEST possible setup:
- Choose exactly one "primary" listing per part.
${totalBudget ? `- The SUM of the primary prices must be between ₹${low} and ₹${totalBudget} (85–100% of the budget). NEVER above ₹${totalBudget}. The customer wants the best they can get for their money, so use the budget.` : ''}
- Spend most on what matters most for this setup. For GAMING: the PC's dedicated graphics card (NVIDIA RTX / GTX or AMD Radeon RX) matters more than anything else; a PC with only integrated graphics (e.g. Ryzen 8500G/8600G "G" chips, Intel UHD) is a poor gaming choice when a dedicated-GPU PC fits the budget, even if the monitor and peripherals must then be cheaper. Then the monitor (144Hz+); keyboard, mouse and headset modest; chair or desk last.
- Only pick listings that genuinely are that part (a "Gaming PC" must be a complete desktop PC, not a laptop, case, or single component).
- Avoid suspicious listings (prices that are far too low for the specs, refurbished, unknown "inspired" brands) and prefer well-known brands and stores.
- PC listings are tagged [dedicated GPU] / [integrated graphics only] / [graphics not stated]; trust these tags.
- For each part give up to 3 "alternatives" from the same list: at least one cheaper and one better.
- If no listing works for a part, set "primary": null for it.

${partsText}

Respond with JSON:
{"parts":[{"part":number,"primary":number|null,"alternatives":[number],"reason":"one short sentence on why this pick suits the customer, no prices","highlights":["up to 3 key specs of the primary pick"]}],
 "note":"one short sentence on how you split the budget (e.g. 'Most of the budget goes to an RTX 4060 PC; peripherals are good-value picks'), or null",
 "missing":"one short sentence if a part could not be filled, else null"}`;

  const parsed = await callGeminiJson<any>(prompt, geminiApiKey, { label: 'setup-plan', totalTimeoutMs: 20000, hedgeAfterMs: 6000 });

  // Turn the answer into validated picks
  const chosen = new Map<number, { primary: number; alternatives: number[]; reason: string; highlights: string[] }>();
  const rawParts: any[] = Array.isArray(parsed?.parts) ? parsed.parts : Array.isArray(parsed) ? parsed : [];
  for (const rp of rawParts) {
    const pi = Number(rp?.part);
    const prim = Number(rp?.primary);
    if (!Number.isInteger(pi) || !parts[pi] || chosen.has(pi)) continue;
    if (!Number.isInteger(prim) || !parts[pi].listings[prim]) continue;
    const alts = (Array.isArray(rp.alternatives) ? rp.alternatives : [])
      .map(Number)
      .filter((a: number) => Number.isInteger(a) && a !== prim && parts[pi].listings[a])
      .slice(0, 3);
    chosen.set(pi, {
      primary: prim,
      alternatives: Array.from(new Set(alts)),
      reason: typeof rp.reason === 'string' ? rp.reason.slice(0, 200) : '',
      highlights: Array.isArray(rp.highlights) ? rp.highlights.filter((h: unknown) => typeof h === 'string').slice(0, 3) : [],
    });
  }

  // Fallback (Gemini unavailable): best-rated listing within each part's proportional share of the budget
  if (chosen.size === 0) {
    console.warn('[setup-plan] no usable plan from Gemini; using budget-share fallback');
    const allocSum = parts.reduce((s2, p) => s2 + (p.comp.allocatedBudget || 0), 0) || 1;
    parts.forEach((p, pi) => {
      const share = totalBudget ? (totalBudget * (p.comp.allocatedBudget || allocSum / parts.length)) / allocSum : Infinity;
      const order = p.listings
        .map((l, i) => ({ i, price: l.price || 0, score: (l.rating || 3.5) * Math.log10((l.reviews || 1) + 10) }))
        .filter(x => x.price <= share)
        .sort((a, b) => b.price - a.price || b.score - a.score);
      if (order[0]) chosen.set(pi, { primary: order[0].i, alternatives: order.slice(1, 3).map(x => x.i), reason: '', highlights: [] });
    });
  }

  let changedByCode = false;
  // Enforce the budget: swap the most expensive main pick for its cheapest alternative until it fits
  const priceOf = (pi: number, li: number) => parts[pi].listings[li]?.price || 0;
  const sum = () => Array.from(chosen.entries()).reduce((t, [pi, c]) => t + priceOf(pi, c.primary), 0);
  if (totalBudget) {
    for (let guard = 0; guard < 12 && sum() > totalBudget; guard++) {
      let best: { pi: number; alt: number; saving: number } | null = null;
      for (const [pi, c] of chosen) {
        for (const alt of c.alternatives) {
          const saving = priceOf(pi, c.primary) - priceOf(pi, alt);
          if (saving > 0 && (!best || saving > best.saving)) best = { pi, alt, saving };
        }
      }
      if (!best) break;
      const c = chosen.get(best.pi)!;
      changedByCode = true;
      c.alternatives = [c.primary, ...c.alternatives.filter(a => a !== best!.alt)];
      c.primary = best.alt;
      c.reason = '';
      c.highlights = [];
    }
    // Under 85%: upgrade parts to their better alternatives, most important part first (planner order),
    // never going over the budget. Customers asking "under ₹1 lakh" want the best they can get.
    const floor = totalBudget * 0.85;
    for (let guard = 0; guard < 12 && sum() < floor; guard++) {
      let up: { pi: number; alt: number } | null = null;
      for (const [pi, c] of Array.from(chosen.entries()).sort((a, b) => a[0] - b[0])) {
        const current = priceOf(pi, c.primary);
        const headroom = totalBudget - sum();
        const options = c.alternatives.filter(a => priceOf(pi, a) > current && priceOf(pi, a) - current <= headroom);
        if (options.length) {
          // biggest upgrade that still fits
          const alt = options.sort((a, b) => priceOf(pi, b) - priceOf(pi, a))[0];
          up = { pi, alt };
          break;
        }
      }
      if (!up) break;
      const c = chosen.get(up.pi)!;
      changedByCode = true;
      c.alternatives = [c.primary, ...c.alternatives.filter(a => a !== up!.alt)];
      c.primary = up.alt;
      c.reason = '';
      c.highlights = [];
    }
    // Still over: drop the least important parts (planned last) until it fits
    const order = Array.from(chosen.keys()).sort((a, b) => b - a);
    for (const pi of order) {
      if (sum() <= totalBudget || chosen.size <= 1) break;
      console.warn(`[setup-plan] dropping ${parts[pi].comp.componentName} to stay within budget`);
      changedByCode = true;
      chosen.delete(pi);
    }
  }

  const planned: PlannedPart[] = Array.from(chosen.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pi, c]) => {
      const mainPrice = priceOf(pi, c.primary);
      const picks: ListingPick[] = [
        { index: c.primary, brand: '', reason: c.reason, fitsYou: [], highlights: c.highlights },
        ...c.alternatives.map(a => ({
          index: a,
          brand: '',
          reason: priceOf(pi, a) < mainPrice ? 'Cheaper option for this part' : 'Upgrade option if you can spend a little more',
          fitsYou: [],
          highlights: [],
        })),
      ];
      return { partIndex: pi, picks };
    });

  return {
    parts: planned,
    // Gemini's note describes its own picks; drop it if the code had to change them
    note: !changedByCode && typeof parsed?.note === 'string' && parsed.note.trim() ? parsed.note.trim().slice(0, 220) : null,
    missing: typeof parsed?.missing === 'string' && parsed.missing.trim() ? parsed.missing.trim().slice(0, 200) : null,
  };
}
