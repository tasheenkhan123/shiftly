import { describe, expect, it } from 'vitest';
import { personalise } from '@/lib/ai/intent';

const profile = { global: { shopsFor: "Women's" }, skincare: { skinType: 'Oily' }, perfumes: { scent: 'Fruity' } };

describe('personalisation rules', () => {
  it('gift searches ignore the shopper’s own profile and learn nothing', () => {
    const p = personalise(
      { categoryId: 'perfumes', forSomeoneElse: true, forWho: 'Dad', preferences: { scent: 'Woody' } },
      'perfume gift for my dad', [], { profile }
    );
    expect(p.activePreferences).toEqual(['Shopping for: Dad']);
    expect(p.learnedPreferences).toEqual({});
    expect(p.askPreference).toBeNull();
  });

  it('remembers stable facts (skin type) but never who it is for or the occasion', () => {
    const p = personalise(
      { categoryId: 'perfumes', preferences: { gender: 'Men', occasion: 'Daily / office' } },
      'perfume for men for office', [], {}
    );
    expect(p.learnedPreferences).toEqual({});

    const s = personalise({ categoryId: 'skincare', preferences: { skinType: 'Oily', concerns: 'Acne' } }, 'I have oily skin', [], {});
    expect(s.learnedPreferences).toEqual({ skinType: 'Oily', concerns: 'Acne' });
  });

  it('applies saved preferences and shows them as "Picked for you" chips', () => {
    const p = personalise({ categoryId: 'skincare' }, 'sunscreen under 800', [], { profile });
    expect(p.activePreferences).toContain('Skin type: Oily');
  });

  it('expands "K-beauty" into real brands, without treating the phrase as a brand', () => {
    const p = personalise({ categoryId: 'skincare', preferredBrands: ['K-beauty'] }, 'K-beauty face wash', [], {});
    expect(p.brandFilter).toContain('COSRX');
    expect(p.brandFilter).not.toContain('K-beauty');
    expect(p.brandGroupLabel).toBe('K-beauty');
  });

  it('asks the key question once, only when the answer is unknown', () => {
    expect(personalise({ categoryId: 'skincare' }, 'face wash', [], {}).askPreference?.key).toBe('skinType');
    expect(personalise({ categoryId: 'skincare' }, 'face wash', [], { profile }).askPreference).toBeNull();
  });
});
