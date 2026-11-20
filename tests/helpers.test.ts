import { describe, expect, it } from 'vitest';
import { parseInrPrice } from '@/lib/search/tavilyFallback';
import { stripBudgetWords } from '@/lib/search/googleShoppingFlow';
import { DEDICATED_GPU, INTEGRATED, isCompletePc, isComputerPart } from '@/lib/search/setupPlanner';
import { findBrandGroups, isTrustedStore, describePreferences } from '@/lib/categories';
import { sanitizeProfile } from '@/lib/security/sanitize';
import { imagePartFromDataUrl } from '@/lib/ai/gemini';
import { parseUserConstraints } from '@/lib/ai/constraints';

describe('prices and budgets', () => {
  it('reads Indian prices including commas', () => {
    expect(parseInrPrice('Now ₹1,299 only')).toBe(1299);
    expect(parseInrPrice('Rs. 499')).toBe(499);
    expect(parseInrPrice('INR 12,999.00')).toBe(12999);
    expect(parseInrPrice('no price here')).toBeNull();
  });

  it('parses budgets like "under 1 lakh" and "under ₹500"', () => {
    expect(parseUserConstraints('gaming setup under 1 lakh').budgetMax).toBe(100000);
    expect(parseUserConstraints('face wash under ₹500').budgetMax).toBe(500);
  });

  it('removes budget words from headings', () => {
    expect(stripBudgetWords('gaming setup under 1 lakh')).toBe('gaming setup');
    expect(stripBudgetWords('perfume for women under ₹2,000')).toBe('perfume for women');
    expect(stripBudgetWords('running shoes for men')).toBe('running shoes for men');
  });
});

describe('gaming PC checks (code decides, not the model)', () => {
  it('tells dedicated graphics from built-in graphics', () => {
    expect(DEDICATED_GPU.test('EternalX CG12 ( AMD Ryzen 5 5600F / NVIDIA RTX 3050 8GB')).toBe(true);
    expect(DEDICATED_GPU.test('Gaming PC i5-12400 RX 6600 8GB')).toBe(true);
    expect(DEDICATED_GPU.test('EternalX CG1 ( AMD Ryzen 5 5600GT / 16GB RAM')).toBe(false);
    expect(INTEGRATED.test('EternalX CG4 ( AMD Ryzen 5 8500G / 16GB')).toBe(true);
  });

  it('rejects PC cases and accepts complete PCs', () => {
    expect(isCompletePc('Dawg Y 990 Mid Tower Mesh Gaming Case 7 120mm ARGB Fan')).toBe(false);
    expect(isCompletePc('Ant Esports ICE-100 Mid Tower Cabinet')).toBe(false);
    expect(isCompletePc('EternalX CG6 ( Intel i3 12100F / NVIDIA RTX 3050 6GB / 16GB')).toBe(true);
  });

  it('knows which setup parts are whole computers', () => {
    expect(isComputerPart('Gaming PC')).toBe(true);
    expect(isComputerPart('Gaming PC (Pre-built or Components)')).toBe(true);
    expect(isComputerPart('Extended Mousepad')).toBe(false);
    expect(isComputerPart('Gaming Chair & Desk')).toBe(false);
  });
});

describe('categories and personalisation helpers', () => {
  it('expands brand groups like K-beauty', () => {
    const groups = findBrandGroups('I want a K-beauty face wash', 'skincare');
    expect(groups.map(g => g.label)).toContain('K-beauty');
    expect(groups[0].brands).toContain('COSRX');
  });

  it('recognises trusted stores per category', () => {
    expect(isTrustedStore('Nykaa', 'skincare')).toBe(true);
    expect(isTrustedStore('Purplle.com - Purplle Shop', 'skincare')).toBe(true);
    expect(isTrustedStore('Vardhman Ceramics', 'footwear')).toBe(false);
  });

  it('only applies "I usually shop for" where gender matters', () => {
    const profile = { global: { shopsFor: "Women's" } };
    expect(describePreferences(profile, 'perfumes')).toContain("I usually shop for: Women's");
    expect(describePreferences(profile, 'electronics')).toEqual([]);
  });
});

describe('input safety', () => {
  it('keeps only short, known preference values', () => {
    const clean = sanitizeProfile({
      skincare: { skinType: 'Oily', 'bad key!': 'x', avoid: 'a'.repeat(200) },
      notACategory: { x: 'y' },
      perfumes: { scent: 42 },
    });
    expect(clean).toEqual({ skincare: { skinType: 'Oily' } });
  });

  it('accepts only base64 image data URLs', () => {
    expect(imagePartFromDataUrl('data:image/jpeg;base64,AAAA')).toEqual({ mimeType: 'image/jpeg', base64Data: 'AAAA' });
    expect(imagePartFromDataUrl('https://example.com/a.jpg')).toBeUndefined();
    expect(imagePartFromDataUrl('data:text/html;base64,AAAA')).toBeUndefined();
  });
});
