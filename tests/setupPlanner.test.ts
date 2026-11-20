import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingListing } from '@/lib/search/googleShoppingProvider';
import type { ParsedShoppingIntent } from '@/lib/search/types';

// The planner asks Gemini for a plan; each test decides what "Gemini" answers
const geminiAnswer = vi.fn();
vi.mock('@/lib/ai/gemini', () => ({ callGeminiJson: (...args: unknown[]) => geminiAnswer(...args) }));
const { planSetup } = await import('@/lib/search/setupPlanner');

const listing = (title: string, price: number): ShoppingListing => ({
  position: 1, title, source: 'Amazon.in', price, rating: 4.4, reviews: 500, thumbnail: null,
  productLink: null, pageToken: null, multipleSources: true, extensions: [],
});

const parts = [
  { comp: { componentName: 'Gaming PC', searchQuery: '', allocatedBudget: 60000 },
    listings: [listing('PC i3 RTX 3050', 74871), listing('PC i5 RTX 4060', 96823), listing('PC Ryzen 5 RTX 3050', 80177)] },
  { comp: { componentName: 'Gaming Monitor', searchQuery: '', allocatedBudget: 14000 },
    listings: [listing('ASUS 24in 180Hz', 11899), listing('Acer 27in 144Hz', 13490), listing('Basic 22in 75Hz', 6999)] },
  { comp: { componentName: 'Gaming Headset', searchQuery: '', allocatedBudget: 3000 },
    listings: [listing('HyperX Stinger', 1999), listing('Razer BlackShark', 7499), listing('Budget headset', 799)] },
];
const intent = { cleanTarget: 'gaming setup', activePreferences: [] } as unknown as ParsedShoppingIntent;
const total = (plan: Awaited<ReturnType<typeof planSetup>>) =>
  plan.parts.reduce((s, p) => s + (parts[p.partIndex].listings[p.picks[0].index].price || 0), 0);

beforeEach(() => geminiAnswer.mockReset());

describe('setup planner budget rules', () => {
  it('never goes over budget: swaps expensive picks for alternatives', async () => {
    // Gemini over-spends: ₹96,823 + ₹13,490 + ₹7,499 = ₹1,17,812
    geminiAnswer.mockResolvedValue({ parts: [
      { part: 0, primary: 1, alternatives: [0, 2] },
      { part: 1, primary: 1, alternatives: [0, 2] },
      { part: 2, primary: 1, alternatives: [0, 2] },
    ] });
    const plan = await planSetup('gaming setup under 1 lakh', intent, parts, 100000, 'key');
    expect(total(plan)).toBeLessThanOrEqual(100000);
    expect(plan.parts).toHaveLength(3); // nothing dropped
  });

  it('uses the budget: upgrades the most important part when under 85%', async () => {
    // Gemini under-spends: ₹74,871 + ₹6,999 + ₹799 = ₹82,669 (83%)
    geminiAnswer.mockResolvedValue({ parts: [
      { part: 0, primary: 0, alternatives: [2, 1] },
      { part: 1, primary: 2, alternatives: [0] },
      { part: 2, primary: 2, alternatives: [0] },
    ] });
    const plan = await planSetup('gaming setup under 1 lakh', intent, parts, 100000, 'key');
    expect(total(plan)).toBeGreaterThanOrEqual(85000);
    expect(total(plan)).toBeLessThanOrEqual(100000);
  });

  it('drops a note that no longer matches the picks the code changed', async () => {
    geminiAnswer.mockResolvedValue({
      note: 'Most of the budget goes to an RTX 4060 PC',
      parts: [{ part: 0, primary: 1, alternatives: [0] }, { part: 1, primary: 1, alternatives: [0] }, { part: 2, primary: 1, alternatives: [0] }],
    });
    const plan = await planSetup('gaming setup under 1 lakh', intent, parts, 100000, 'key');
    expect(plan.note).toBeNull();
  });

  it('still builds a setup within budget when Gemini is unavailable', async () => {
    geminiAnswer.mockResolvedValue(null);
    const plan = await planSetup('gaming setup under 1 lakh', intent, parts, 100000, 'key');
    expect(plan.parts.length).toBeGreaterThan(0);
    expect(total(plan)).toBeLessThanOrEqual(100000);
  });

  it('ignores invented listing numbers from the model', async () => {
    geminiAnswer.mockResolvedValue({ parts: [{ part: 0, primary: 99 }, { part: 7, primary: 0 }, { part: 1, primary: 0 }] });
    const plan = await planSetup('gaming setup under 1 lakh', intent, parts, 100000, 'key');
    expect(plan.parts.map(p => p.partIndex)).toEqual([1]);
  });
});
