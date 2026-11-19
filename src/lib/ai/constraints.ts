import { UserConstraints } from '@/types';

/** Store names we recognise when a user says e.g. "on Nykaa" or "from Amazon". */
const KNOWN_STORES = [
  { id: 'amazon', name: 'Amazon' },
  { id: 'flipkart', name: 'Flipkart' },
  { id: 'nykaa', name: 'Nykaa' },
  { id: 'myntra', name: 'Myntra' },
  { id: 'ajio', name: 'Ajio' },
  { id: 'tira', name: 'Tira' },
  { id: 'purplle', name: 'Purplle' },
  { id: 'meesho', name: 'Meesho' },
  { id: 'croma', name: 'Croma' },
  { id: 'reliance', name: 'Reliance Digital' },
  { id: 'tatacliq', name: 'Tata CLiQ' },
  { id: 'blinkit', name: 'Blinkit' },
  { id: 'zepto', name: 'Zepto' },
];

/**
 * Normalises an Indian number string with optional scale suffix (k, lakh, lac, crore) to a numeric INR value.
 */
export function parseIndianNumericValue(rawNum: string, scaleSuffix?: string): number | undefined {
  if (!rawNum) return undefined;
  const cleanNum = rawNum.replace(/,/g, '').trim();
  const base = parseFloat(cleanNum);
  if (isNaN(base)) return undefined;

  const scale = (scaleSuffix || '').toLowerCase().trim();
  if (scale.startsWith('lakh') || scale.startsWith('lac')) {
    return Math.round(base * 100000);
  }
  if (scale === 'k') {
    return Math.round(base * 1000);
  }
  if (scale.startsWith('crore') || scale === 'cr') {
    return Math.round(base * 10000000);
  }
  return Math.round(base);
}

/**
 * Extracts budget, currency, requested count, and clean intent from natural language instructions.
 * Accurately supports Indian number formatting, thousands shorthand (50k), lakhs, and avoids false positives.
 */
export function parseUserConstraints(promptText: string): UserConstraints {
  const constraints: UserConstraints = {
    currency: 'INR',
    naturalLanguageQuery: promptText,
  };

  if (!promptText || typeof promptText !== 'string') {
    return constraints;
  }

  const cleanText = promptText.trim();

  // Pattern A: Suffix budget (e.g. "₹500 budget", "50k budget", "1 lakh budget", "1,00,000 max", "500 rs in hand")
  const suffixRegex = /(?:₹|rs\.?|inr|rupees)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|crores?|cr)?\s*(?:₹|rs\.?|inr|rupees)?\s*(?:budget|in\s+hand|to\s+spend|max|at\s+most)\b/i;
  
  // Pattern B: Prefix budget keywords (e.g. "budget: 50000", "my budget is ₹1,00,000", "i have ₹500", "under 50k", "within 1 lakh", "less than ₹2,000", "below 1500")
  const prefixRegex = /(?:(?:my\s+)?budget\s*(?:is|of|:|=|\s)?|i\s+have|have|under|below|less\s+than|within|up\s+to|at\s+most|max(?:imum)?)\s*(?:₹|rs\.?|inr|rupees)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|crores?|cr)?\s*(?:₹|rs\.?|inr|rupees)?(?!\s*(?:hz|fps|inch|"|gb|tb|mah|mp|dpi|w|v)\b)/i;

  // Pattern C: Explicit currency with amount (e.g. "₹500 for lip balm", "₹1,00,000 setup", "rs 500")
  const explicitCurrencyRegex = /(?:₹|rs\.?\s+|inr\s+|rupees\s+)(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|crores?|cr)?(?!\s*(?:hz|fps|inch|"|gb|tb|mah|mp|dpi|w|v)\b)/i;

  // Check Pattern A first (e.g. "₹500 budget for lip balm")
  const suffixMatch = cleanText.match(suffixRegex);
  if (suffixMatch && suffixMatch[1]) {
    const isTechResolution = suffixMatch[1] === '4' && suffixMatch[2]?.toLowerCase() === 'k' && /monitor|display|tv|screen|video|gaming|webcam/i.test(cleanText);
    if (!isTechResolution) {
      constraints.budgetMax = parseIndianNumericValue(suffixMatch[1], suffixMatch[2]);
    }
  }

  // Check Pattern B if not matched
  if (!constraints.budgetMax) {
    const prefixMatch = cleanText.match(prefixRegex);
    if (prefixMatch && prefixMatch[1]) {
      const isTechResolution = prefixMatch[1] === '4' && prefixMatch[2]?.toLowerCase() === 'k' && /monitor|display|tv|screen|video|gaming|webcam/i.test(cleanText);
      if (!isTechResolution) {
        constraints.budgetMax = parseIndianNumericValue(prefixMatch[1], prefixMatch[2]);
      }
    }
  }

  // Check Pattern C if not matched
  if (!constraints.budgetMax) {
    const currencyMatch = cleanText.match(explicitCurrencyRegex);
    if (currencyMatch && currencyMatch[1]) {
      constraints.budgetMax = parseIndianNumericValue(currencyMatch[1], currencyMatch[2]);
    }
  }

  // Extract requested item count (e.g. "three best lip balms", "top 5 gaming mice", "recommend 3 options")
  const countRegex = /(?:recommend(?: me)?|suggest(?: me)?|show(?: me)?|find(?: me)?|give me)?\s*(?:the\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:best|top|options|recommendations|items|products|lip balms|keyboards|monitors|laptops|phones|pieces|alternatives)\b/i;
  const countMatch = cleanText.match(countRegex);
  if (countMatch && countMatch[1]) {
    const wordMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    const rawCount = countMatch[1].toLowerCase();
    const parsedCount = wordMap[rawCount] || parseInt(rawCount, 10);
    if (!isNaN(parsedCount) && parsedCount > 0 && parsedCount <= 20) {
      constraints.requestedCount = parsedCount;
    }
  }

  // Detect preferred stores mentioned in prompt
  const detectedStores: string[] = [];
  KNOWN_STORES.forEach(s => {
    if (promptText.toLowerCase().includes(s.name.toLowerCase()) || promptText.toLowerCase().includes(s.id)) {
      detectedStores.push(s.name);
    }
  });
  if (detectedStores.length > 0) {
    constraints.preferredStores = detectedStores;
  }

  // Pre-normalize product query
  constraints.normalizedProductQuery = normalizeProductQuery(cleanText, constraints);

  return constraints;
}

/**
 * Separates the user's conversational prompt from the normalized product search query.
 * Preserves brand, model, color, specifications, ingredients, and component requirements.
 * Never returns the raw conversational sentence as a product title.
 */
export function normalizeProductQuery(rawInput: string, constraints?: UserConstraints): string {
  if (!rawInput || typeof rawInput !== 'string') return '';

  let cleaned = rawInput.trim();

  // Strip URLs if present
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, '').trim();

  // Remove budget phrases that were already parsed
  cleaned = cleaned.replace(/(?:(?:my\s+)?budget\s*(?:is|of|:|=|\s)?|i\s+have|have|under|below|less\s+than|within|up\s+to|at\s+most|max(?:imum)?)\s*(?:₹|rs\.?|inr|rupees)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|crores?|cr)?\s*(?:₹|rs\.?|inr|rupees)?/gi, '');
  cleaned = cleaned.replace(/(?:₹|rs\.?|inr|rupees)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|crores?|cr)?\s*(?:₹|rs\.?|inr|rupees)?\s*(?:budget|in\s+hand|to\s+spend|max|at\s+most)\b/gi, '');
  cleaned = cleaned.replace(/(?:₹|rs\.?\s+|inr\s+|rupees\s+)\d+(?:,\d+)*(?:\.\d+)?\s*(?:k|lakhs?|lacs?|crores?|cr)?/gi, '');

  // Strip conversational recommendation boilerplates
  cleaned = cleaned.replace(/\b(?:recommend|suggest|show|find|give)\s+(?:me\s+)?(?:the\s+)?(?:top\s+|best\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)?\s*(?:best\s+)?/gi, '');
  cleaned = cleaned.replace(/\b(?:can\s+you\s+(?:please\s+)?(?:recommend|find|suggest|show)|please\s+(?:recommend|find|suggest|show))\s*(?:me\s+)?/gi, '');
  cleaned = cleaned.replace(/\b(?:where\s+can\s+i\s+(?:buy|find|get)|i\s+want\s+to\s+(?:buy|find|get)|looking\s+for(?:\s+a|\s+an)?|what\s+are\s+the\s+(?:best|top))\b/gi, '');
  cleaned = cleaned.replace(/\b(?:from|by)\s+(?:recognised|recognized|reputed|popular|trusted|good|best)\s+brands?\b/gi, '');
  cleaned = cleaned.replace(/\b(?:with\s+(?:live\s+)?price\s+comparison|within\s+my\s+budget|in\s+my\s+budget|options|suggestions)\b/gi, '');
  cleaned = cleaned.replace(/\bfind\s+(?:the\s+)?product\s+in\s+this\s+screenshot\b/gi, '');
  cleaned = cleaned.replace(/\b(?:and\s+other\s+essential\s+accessories|and\s+accessories|and\s+essential\s+accessories)\b/gi, '');

  // Clean punctuation and double whitespace
  cleaned = cleaned.replace(/[.,;:!?]+/g, ' ').replace(/\s+/g, ' ').trim();

  // If query is empty or reduced to trivial filler, fall back to sensible defaults
  if (!cleaned || cleaned.length < 2) {
    if (constraints?.naturalLanguageQuery) {
      const lower = constraints.naturalLanguageQuery.toLowerCase();
      if (lower.includes('gaming')) return 'Gaming Setup';
      if (lower.includes('lip balm') || lower.includes('lipbalm')) return 'Lip Balm';
      if (lower.includes('serum')) return 'Serum';
      if (lower.includes('dress')) return 'Dress';
      if (lower.includes('bag')) return 'Bag';
    }
    return 'Search Products';
  }

  // Singularize standard plural query targets for cleaner retailer search results
  if (/^lip\s+balms$/i.test(cleaned)) cleaned = 'Lip Balm';
  else if (/^gaming\s+keyboards$/i.test(cleaned)) cleaned = 'Gaming Keyboard';
  else if (/^gaming\s+mice$/i.test(cleaned)) cleaned = 'Gaming Mouse';
  else if (/^monitors$/i.test(cleaned)) cleaned = 'Monitor';
  else if (/^headphones$/i.test(cleaned)) cleaned = 'Headphones';

  return cleaned;
}

const KNOWN_BRANDS_MAP: Record<string, string> = {
  'nivea': 'NIVEA',
  'minimalist': 'Minimalist',
  'medicube': 'Medicube',
  'wishcare': 'WishCare',
  'cerave': 'CeraVe',
  'derma co': 'The Derma Co',
  'the ordinary': 'The Ordinary',
  'cosrx': 'COSRX',
  'laneige': 'Laneige',
  'cetaphil': 'Cetaphil',
  'neutrogena': 'Neutrogena',
  'plum': 'Plum',
  'biotique': 'Biotique',
  'himalaya': 'Himalaya',
  'vaseline': 'Vaseline',
  'lakme': 'Lakmé',
  'maybelline': 'Maybelline',
  'loreal': "L'Oréal",
  'sugar': 'Sugar Cosmetics',
  'zara': 'Zara',
  'mango': 'MANGO',
  'h&m': 'H&M',
  'hm': 'H&M',
  'athena': 'Athena',
  'forever 21': 'Forever 21',
  'levis': "Levi's",
  'nike': 'Nike',
  'adidas': 'Adidas',
  'puma': 'Puma',
  'miraggio': 'Miraggio',
  'zouk': 'Zouk',
  'lavie': 'Lavie',
  'caprese': 'Caprese',
  'baggit': 'Baggit',
  'apple': 'Apple',
  'asus': 'ASUS',
  'acer': 'Acer',
  'dell': 'Dell',
  'hp': 'HP',
  'lenovo': 'Lenovo',
  'msi': 'MSI',
  'razer': 'Razer',
  'logitech': 'Logitech',
  'corsair': 'Corsair',
  'hyperx': 'HyperX',
  'steelseries': 'SteelSeries',
  'samsung': 'Samsung',
  'lg': 'LG',
  'sony': 'Sony',
  'boat': 'boAt',
  'noise': 'Noise',
  'redragon': 'Redragon',
  'intel': 'Intel',
  'amd': 'AMD',
  'nvidia': 'NVIDIA'
};

/**
 * Extracts a verified brand from text only if it matches an actual known brand.
 * Never guesses the brand from conversational pronouns or first words of a sentence.
 */
export function extractBrand(input: string): string | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase();

  for (const [key, canonical] of Object.entries(KNOWN_BRANDS_MAP)) {
    const regex = new RegExp(`\\b${key.replace('&', '\\&')}\\b`, 'i');
    if (regex.test(lower)) {
      return canonical;
    }
  }
  return undefined;
}
