/**
 * Shopping categories: what Siftly should know about each kind of product.
 *
 * - preferenceFields: what we ask about / remember per user (skin type, shoe size, ...)
 * - guidance: expert rules given to Gemini when choosing products for this category
 * - brandGroups: phrases like "K-beauty" that mean a set of brands, not one brand
 * - trustedStores: well-known stores for this category (shown as "Trusted store", preferred when
 *   their price is close to the cheapest)
 *
 * This file has no server or browser dependencies, so both sides can import it.
 */

export type CategoryId = 'skincare' | 'makeup' | 'footwear' | 'fashion' | 'electronics' | 'perfumes' | 'other';

export interface PreferenceField {
  key: string;
  label: string;
  /** Suggested values shown as chips in the preferences panel; free text is also allowed */
  options?: string[];
  placeholder?: string;
  /**
   * true = remember automatically when the user says it in chat (stable facts like skin type or shoe size).
   * Per-search details (occasion, use, who it's for) are never auto-remembered: "perfume for men" is often a gift.
   */
  autoRemember?: boolean;
  /** Several answers allowed (chips toggle on/off). Default: choose one */
  multi?: boolean;
  /** Most answers allowed when multi (e.g. "up to 3") */
  max?: number;
  /** Shown as "(optional)" in the panel */
  optional?: boolean;
  /** Show "+ Add more" so users can type their own answer */
  allowCustom?: boolean;
  /** Only show this question when another answer includes a value (e.g. laptop questions when "Laptops" is picked) */
  showIf?: { key: string; includes: string };
  /** Small heading for a group of questions, e.g. "Laptops" */
  section?: string;
}

export interface BrandGroup {
  /** Lower-case phrases that trigger this group */
  phrases: string[];
  label: string;
  brands: string[];
}

export interface CategoryDef {
  id: CategoryId;
  label: string;
  emoji: string;
  example: string;
  preferenceFields: PreferenceField[];
  guidance: string;
  brandGroups: BrandGroup[];
  trustedStores: string[];
  /** Does "I usually shop for: Women's / Men's" matter here? (not for earbuds or air fryers) */
  genderRelevant?: boolean;
  /** The one preference worth asking about after a first search in this category */
  keyQuestion?: { key: string; question: string };
}

const COMMON_TRUSTED = ['Amazon', 'Flipkart'];

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'skincare',
    label: 'Skincare',
    emoji: '🧴',
    example: 'Face wash for oily, acne-prone skin under ₹500',
    preferenceFields: [
      { key: 'skinType', label: 'Skin type', options: ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'], autoRemember: true },
      { key: 'concerns', label: 'Skin concerns', options: ['Acne', 'Dark spots', 'Pigmentation', 'Dullness', 'Large pores', 'Ageing', 'Redness'], multi: true, max: 3, allowCustom: true, autoRemember: true },
      { key: 'texture', label: 'Product preferences', options: ['Lightweight', 'Non-greasy', 'Hydrating', 'Matte finish'], multi: true, allowCustom: true },
      { key: 'avoid', label: 'Ingredients to avoid', options: ['Fragrance', 'Alcohol', 'Essential oils', 'Parabens'], multi: true, optional: true, allowCustom: true, autoRemember: true },
      { key: 'brandStyle', label: 'Brand preferences', options: ['K-beauty', 'Indian brands', 'Dermatologist brands', 'Clean / natural'], multi: true, optional: true, allowCustom: true },
    ],
    guidance: `Skincare expertise:
- Oily / acne-prone: prefer niacinamide, salicylic acid (BHA), zinc, tea tree, centella, gel or water textures, "oil-free", "non-comedogenic", matte or gel sunscreens. Avoid heavy creams, rich oils, coconut oil.
- Dry: prefer ceramides, hyaluronic acid, glycerin, squalane, cream textures. Avoid strong foaming cleansers, high alcohol.
- Sensitive: prefer fragrance-free, minimal ingredients, centella, panthenol, oat. Avoid fragrance, essential oils, strong acids.
- Combination: lightweight, balancing products; gel-creams.
- Pigmentation: vitamin C, niacinamide, alpha arbutin, azelaic acid, tranexamic acid; always pair with sunscreen.
- Never pick a different product type (a serum is not a toner, a toner is not a cleanser).`,
    brandGroups: [
      {
        phrases: ['k-beauty', 'k beauty', 'kbeauty', 'korean'],
        label: 'K-beauty',
        brands: ['COSRX', 'Beauty of Joseon', 'Anua', 'Some By Mi', 'Innisfree', 'Round Lab', 'Isntree', 'SKIN1004', 'Torriden', 'Laneige', 'Axis-Y', 'Klairs', 'Etude', 'Medicube', 'Mixsoon', 'Numbuzin', 'Purito', "I'm From", 'Dr. Jart+', 'Neogen'],
      },
      {
        phrases: ['j-beauty', 'japanese'],
        label: 'J-beauty',
        brands: ['Hada Labo', 'Biore', 'Shiseido', 'Senka', 'Kose', 'Melano CC', 'Rohto', 'Skin Aqua', 'Canmake'],
      },
      {
        phrases: ['indian brand', 'indian brands', 'desi brand', 'made in india'],
        label: 'Indian brands',
        brands: ['Minimalist', 'The Derma Co', 'Dot & Key', 'Plum', 'Mamaearth', 'Foxtale', "Re'equil", 'Deconstruct', 'Pilgrim', 'Dr. Sheth', 'Aqualogica', 'Conscious Chemist', 'Chemist at Play', 'Bella Vita', 'Biotique', 'Himalaya', 'Lotus'],
      },
      {
        phrases: ['dermatologist brand', 'derm brand', 'pharmacy brand', 'french pharmacy'],
        label: 'Dermatologist brands',
        brands: ['CeraVe', 'Cetaphil', 'La Roche-Posay', 'Bioderma', 'Avene', 'Eucerin', 'Neutrogena', 'Sebamed', 'Vichy', 'The Ordinary'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Nykaa', 'Tira', 'Purplle', 'Myntra', 'Tata 1mg', 'Apollo', 'Official brand store'],
    genderRelevant: false,
    keyQuestion: { key: 'skinType', question: "What's your skin type?" },
  },
  {
    id: 'makeup',
    label: 'Makeup',
    emoji: '💄',
    example: 'Long-lasting matte lipstick for wheatish skin under ₹800',
    preferenceFields: [
      { key: 'skinTone', label: 'Skin tone', options: ['Fair', 'Light', 'Wheatish', 'Medium', 'Dusky', 'Deep'], autoRemember: true },
      { key: 'undertone', label: 'Undertone', options: ['Warm', 'Cool', 'Neutral', 'Not sure'], autoRemember: true },
      { key: 'finish', label: 'Finish you like', options: ['Matte', 'Dewy', 'Natural', 'Satin'] },
      { key: 'mustHaves', label: 'Must-haves', options: ['Long-lasting', 'Transfer-proof', 'Waterproof', 'Lightweight'], multi: true, allowCustom: true },
      { key: 'brandStyle', label: 'Brand preferences', options: ['Indian brands', 'K-beauty', 'Luxury'], multi: true, optional: true, allowCustom: true },
    ],
    guidance: `Makeup expertise:
- Match shades to skin tone and undertone when known; say which shade to pick if the listing shows shades.
- Oily skin: matte, long-wear, oil-control foundations and primers. Dry skin: hydrating, dewy, cream formulas.
- Prefer smudge-proof / transfer-proof for Indian heat and humidity when relevant.`,
    brandGroups: [
      {
        phrases: ['k-beauty', 'k beauty', 'korean'],
        label: 'K-beauty',
        brands: ['Rom&nd', 'Peripera', 'Etude', 'Clio', 'Laneige', 'Innisfree', 'Missha', 'Tirtir', 'Amuse'],
      },
      {
        phrases: ['indian brand', 'indian brands'],
        label: 'Indian brands',
        brands: ['Sugar', 'Lakme', 'Swiss Beauty', 'Kay Beauty', 'Renee', 'Myglamm', 'Insight', 'Blue Heaven', 'Faces Canada', 'Nykaa Cosmetics'],
      },
      {
        phrases: ['luxury', 'high end', 'premium'],
        label: 'Luxury',
        brands: ['MAC', 'Huda Beauty', 'Charlotte Tilbury', 'Fenty Beauty', 'Estee Lauder', 'Dior', 'NARS', 'Benefit'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Nykaa', 'Tira', 'Purplle', 'Myntra', 'Sephora', 'Official brand store'],
    genderRelevant: false,
    keyQuestion: { key: 'skinTone', question: "What's your skin tone?" },
  },
  {
    id: 'footwear',
    label: 'Footwear',
    emoji: '👟',
    example: 'Running shoes for flat feet, size UK 9, under ₹4,000',
    preferenceFields: [
      { key: 'shoeSize', label: 'Shoe size', options: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'], autoRemember: true },
      { key: 'gender', label: 'For', options: ['Men', 'Women', 'Unisex', 'Kids'] },
      { key: 'use', label: 'Mostly for', options: ['Running', 'Gym', 'Walking', 'Casual', 'Office', 'Sports'], multi: true, allowCustom: true },
      { key: 'footType', label: 'Foot type', options: ['Flat feet', 'High arch', 'Wide feet', 'Normal'], optional: true, autoRemember: true },
      { key: 'brandStyle', label: 'Brand preferences', options: ['Sports brands', 'Indian brands'], multi: true, optional: true, allowCustom: true },
    ],
    guidance: `Footwear expertise:
- Match the shoe to its use: running shoes need cushioning and breathable uppers; gym/training shoes need a flat, stable sole; walking shoes need comfort and grip.
- Flat feet: stability / supportive running shoes. Wide feet: brands or models known for wide fits.
- Only pick listings for the right gender. If a size is known, say to check that size is in stock at the store.`,
    brandGroups: [
      {
        phrases: ['sports brand', 'sports brands', 'international brand', 'big brand'],
        label: 'Sports brands',
        brands: ['Nike', 'Adidas', 'Puma', 'ASICS', 'New Balance', 'Skechers', 'Reebok', 'Under Armour', 'HOKA', 'Brooks', 'Decathlon', 'Kalenji'],
      },
      {
        phrases: ['indian brand', 'indian brands', 'budget brand'],
        label: 'Indian brands',
        brands: ['Campus', 'Bata', 'Red Tape', 'Liberty', 'Sparx', 'Woodland', 'Asian', 'Neeman’s', 'Action'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Myntra', 'Ajio', 'Decathlon', 'Nykaa Fashion', 'Tata CLiQ', 'Official brand store'],
    genderRelevant: true,
    keyQuestion: { key: 'footType', question: 'Do you have a particular foot type?' },
  },
  {
    id: 'fashion',
    label: 'Fashion',
    emoji: '👕',
    example: 'Linen shirt for men, size M, for office, under ₹1,500',
    preferenceFields: [
      { key: 'size', label: 'Clothing size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], autoRemember: true },
      { key: 'gender', label: 'For', options: ['Men', 'Women', 'Unisex', 'Kids'] },
      { key: 'fit', label: 'Fit you like', options: ['Slim', 'Regular', 'Relaxed', 'Oversized'], autoRemember: true },
      { key: 'style', label: 'Style', options: ['Casual', 'Office', 'Ethnic', 'Party', 'Streetwear', 'Minimal'], multi: true, allowCustom: true },
      { key: 'fabric', label: 'Fabric preferences', options: ['Cotton', 'Linen', 'Denim', 'Silk', 'Wool'], multi: true, optional: true, allowCustom: true },
    ],
    guidance: `Fashion expertise:
- Only pick items for the right gender and occasion. Respect fit and style preferences.
- For Indian weather prefer breathable fabrics (cotton, linen) unless the customer asks otherwise.
- Mention fabric and fit when the listing shows them.`,
    brandGroups: [
      {
        phrases: ['premium brand', 'premium brands'],
        label: 'Premium brands',
        brands: ['Tommy Hilfiger', 'Calvin Klein', 'Levi’s', 'U.S. Polo Assn.', 'Jack & Jones', 'Allen Solly', 'Van Heusen', 'Louis Philippe', 'Zara', 'H&M', 'Uniqlo', 'Marks & Spencer'],
      },
      {
        phrases: ['indian brand', 'indian brands', 'ethnic brand'],
        label: 'Indian brands',
        brands: ['Fabindia', 'Manyavar', 'Biba', 'W', 'Aurelia', 'Libas', 'Peter England', 'Raymond', 'Snitch', 'The Souled Store', 'Bewakoof', 'Roadster'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Myntra', 'Ajio', 'Nykaa Fashion', 'Tata CLiQ', 'Westside', 'Official brand store'],
    genderRelevant: true,
    keyQuestion: { key: 'fit', question: 'What fit do you usually prefer?' },
  },
  {
    id: 'electronics',
    label: 'Electronics',
    emoji: '📱',
    example: 'Wireless earbuds with good bass for the gym under ₹2,000',
    preferenceFields: [
      { key: 'devices', label: 'What do you usually buy', options: ['Phones', 'Laptops', 'Audio', 'Smartwatches', 'TVs', 'Tablets', 'Cameras', 'Gaming'], multi: true, allowCustom: true },
      { key: 'priority', label: 'Most important to you', options: ['Battery life', 'Performance', 'Display', 'Camera', 'Sound quality', 'Build quality', 'Value for money'], multi: true, max: 3 },
      { key: 'ecosystem', label: 'Your devices', options: ['Android', 'iPhone / Apple', 'Windows', 'Mac'], multi: true, optional: true, autoRemember: true },
      { key: 'brandStyle', label: 'Brand preferences', options: ['Indian brands', 'Global brands'], multi: true, optional: true, allowCustom: true },
      { key: 'phoneSize', label: 'Screen size', options: ['Compact', 'Regular', 'Large'], section: 'Phones', showIf: { key: 'devices', includes: 'Phones' } },
      { key: 'phoneStorage', label: 'Storage', options: ['128GB', '256GB', '512GB+'], section: 'Phones', showIf: { key: 'devices', includes: 'Phones' } },
      { key: 'laptopUse', label: 'Mostly for', options: ['Study', 'Office', 'Gaming', 'Coding', 'Design / editing'], multi: true, section: 'Laptops', showIf: { key: 'devices', includes: 'Laptops' } },
      { key: 'laptopOS', label: 'System', options: ['Windows', 'Mac', 'Chromebook'], section: 'Laptops', showIf: { key: 'devices', includes: 'Laptops' } },
      { key: 'laptopWeight', label: 'Weight', options: ['Light and portable', "Doesn't matter"], section: 'Laptops', showIf: { key: 'devices', includes: 'Laptops' } },
      { key: 'audioType', label: 'Type', options: ['Earbuds', 'Over-ear headphones', 'Speakers', 'Soundbar'], multi: true, section: 'Audio', showIf: { key: 'devices', includes: 'Audio' } },
      { key: 'audioMust', label: 'Must-haves', options: ['Noise cancellation', 'Deep bass', 'Low latency for gaming', 'Mic for calls'], multi: true, section: 'Audio', showIf: { key: 'devices', includes: 'Audio' } },
      { key: 'watchUse', label: 'Main use', options: ['Fitness', 'Calling and notifications', 'Style'], multi: true, section: 'Smartwatches', showIf: { key: 'devices', includes: 'Smartwatches' } },
      { key: 'watchWorksWith', label: 'Must work with', options: ['Android', 'iPhone'], section: 'Smartwatches', showIf: { key: 'devices', includes: 'Smartwatches' } },
      { key: 'tvSize', label: 'Screen size', options: ['32-43"', '50-55"', '65"+'], section: 'TVs', showIf: { key: 'devices', includes: 'TVs' } },
      { key: 'tvType', label: 'Screen type', options: ['LED', 'QLED', 'OLED'], section: 'TVs', showIf: { key: 'devices', includes: 'TVs' } },
      { key: 'tvSystem', label: 'Smart system', options: ['Google TV', 'Fire TV', 'Tizen', 'webOS', "Doesn't matter"], section: 'TVs', showIf: { key: 'devices', includes: 'TVs' } },
    ],
    guidance: `Electronics expertise:
- Compare on the specs that matter for the stated use (battery, ANC, latency for gaming, RAM/storage, refresh rate).
- Prefer products with official warranty in India and well-known service networks.
- Be careful with lookalike or refurbished listings; only pick new products unless asked.`,
    brandGroups: [
      {
        phrases: ['indian brand', 'indian brands', 'desi brand'],
        label: 'Indian brands',
        brands: ['boAt', 'Noise', 'Boult', 'Portronics', 'Zebronics', 'pTron', 'Fire-Boltt', 'Ambrane', 'Mivi', 'Lava', 'Micromax'],
      },
      {
        phrases: ['global brand', 'global brands', 'premium brand', 'premium brands', 'big brand'],
        label: 'Global brands',
        brands: ['Sony', 'JBL', 'Samsung', 'Apple', 'OnePlus', 'Bose', 'Sennheiser', 'Xiaomi', 'Realme', 'Logitech', 'HP', 'Dell', 'Lenovo', 'ASUS', 'Acer'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Croma', 'Reliance Digital', 'Vijay Sales', 'Tata CLiQ', 'Official brand store'],
    genderRelevant: false,
    keyQuestion: { key: 'devices', question: 'What electronics do you usually buy?' },
  },
  {
    id: 'perfumes',
    label: 'Perfumes',
    emoji: '🌸',
    example: 'Fruity, citrusy body mist from Bath & Body Works',
    preferenceFields: [
      { key: 'gender', label: 'For', options: ['Men', 'Women', 'Unisex'] },
      { key: 'scent', label: 'Scents you like', options: ['Fresh', 'Citrus', 'Fruity', 'Floral', 'Woody', 'Sweet', 'Spicy', 'Aquatic', 'Musky'], multi: true, max: 3, allowCustom: true },
      { key: 'occasion', label: 'Mostly for', options: ['Daily / office', 'Evening / party', 'Gym', 'Special occasions'], multi: true },
      { key: 'strength', label: 'Strength', options: ['Light and subtle', 'Moderate', 'Strong and long-lasting'] },
      { key: 'perfumeType', label: 'Type', options: ['Perfume (EDP)', 'Body mist', 'Deodorant', 'Attar'], multi: true, optional: true, allowCustom: true },
    ],
    guidance: `Perfume expertise:
- Match the scent family and occasion: fresh/citrus/aquatic for daytime and Indian heat; woody/spicy/sweet for evenings.
- Prefer Eau de Parfum (EDP) for longevity over Eau de Toilette (EDT) when the customer wants long-lasting.
- Avoid "tester" and unbranded "inspired by" listings unless the customer asks for them; prefer sealed originals from trusted stores.
- Body mists (e.g. Bath & Body Works Fine Fragrance Mist, Victoria's Secret mists) are a different product from perfumes/colognes: if a mist is asked for, pick mists. Name the scent and its key notes.
- Don't assume the customer's gender. Only pick men's or women's fragrances if they said so in THIS request or it is clear from the request.`,
    brandGroups: [
      {
        phrases: ['indian brand', 'indian brands', 'affordable'],
        label: 'Indian brands',
        brands: ['Bella Vita', 'Wild Stone', 'Fogg', 'Engage', 'Skinn by Titan', 'Ustraa', 'Park Avenue', 'The Man Company', 'Villain', 'Adil Qadri'],
      },
      {
        phrases: ['designer', 'luxury', 'premium'],
        label: 'Designer brands',
        brands: ['Dior', 'Chanel', 'Versace', 'Armani', 'Davidoff', 'Calvin Klein', 'Hugo Boss', 'Montblanc', 'Paco Rabanne', 'Carolina Herrera', 'Yves Saint Laurent', 'Burberry'],
      },
    ],
    trustedStores: [...COMMON_TRUSTED, 'Nykaa', 'Tira', 'Myntra', 'Perfume Booth', 'Bath & Body Works', 'Official brand store'],
    genderRelevant: true,
    keyQuestion: { key: 'scent', question: 'Which scents do you usually like?' },
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '🛍️',
    example: 'Air fryer for a family of 4 under ₹6,000',
    preferenceFields: [],
    guidance: 'General shopping: pick well-reviewed products from reputed brands that match exactly what was asked.',
    brandGroups: [],
    trustedStores: [...COMMON_TRUSTED, 'Croma', 'Reliance Digital', 'Official brand store'],
  },
];

/** Global preferences that apply to every category */
export const SHOPS_FOR_OPTIONS = ["Women's", "Men's", 'Both'];

export const GLOBAL_PREFERENCE_FIELDS: PreferenceField[] = [
  { key: 'shopsFor', label: 'I usually shop for', options: SHOPS_FOR_OPTIONS },
  { key: 'budgetStyle', label: 'Budget style', options: ['Best value', 'Mid-range', 'Premium'] },
  { key: 'stores', label: 'Stores I trust', options: ['Amazon', 'Flipkart', 'Nykaa', 'Myntra'], multi: true, optional: true, allowCustom: true },
];

export function getCategory(id?: string | null): CategoryDef {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export const SELECTABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'other');

/** Finds brand groups mentioned in text ("K-beauty", "Indian brands"...) for a category */
export function findBrandGroups(text: string, categoryId: CategoryId): BrandGroup[] {
  const lower = ` ${text.toLowerCase()} `;
  return getCategory(categoryId).brandGroups.filter(g => g.phrases.some(p => lower.includes(p)));
}

/** Is this store name one of the trusted stores for the category? */
export function isTrustedStore(storeName: string, categoryId: CategoryId): boolean {
  const s = storeName.toLowerCase().replace(/\.(com|in|co\.in)\b/g, '');
  return getCategory(categoryId).trustedStores.some(t => {
    const tl = t.toLowerCase();
    if (tl === 'official brand store') return false;
    return s.includes(tl) || (tl === 'tata 1mg' && s.includes('1mg')) || (tl === 'tira' && s.includes('tira beauty'));
  });
}

/**
 * User preference profile: { global: {...}, skincare: { skinType: 'Oily' }, footwear: { shoeSize: 'UK 9' }, ... }
 * Values are short strings; multi-value fields use comma-separated text.
 */
export type PreferenceProfile = Partial<Record<CategoryId | 'global', Record<string, string>>>;

/** Human-readable list of preferences for one category (plus global), for prompts and UI */
export function describePreferences(profile: PreferenceProfile | undefined, categoryId: CategoryId): string[] {
  if (!profile) return [];
  const cat = getCategory(categoryId);
  const out: string[] = [];
  const fields = [...cat.preferenceFields, ...GLOBAL_PREFERENCE_FIELDS];
  for (const [scope, values] of [[categoryId, profile[categoryId]], ['global', profile.global]] as const) {
    for (const [k, v] of Object.entries(values || {})) {
      if (!v || !String(v).trim()) continue;
      if (k === 'shopsFor' && (!cat.genderRelevant || v === 'Both')) continue; // irrelevant for earbuds etc.
      const label = fields.find(f => f.key === k)?.label || k;
      out.push(`${label}: ${v}${scope === 'global' ? '' : ''}`);
    }
  }
  return out;
}
