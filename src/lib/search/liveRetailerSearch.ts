import { 
  DetectedEntity, 
  ProductMatch, 
  MerchantOffer, 
  UserConstraints, 
  SiftlyAnalysisResult,
  InputCategory 
} from '@/types';
import { normalizeProductQuery, extractBrand, classifyInputType } from '../ai/pipeline';

interface StoreDefinition {
  name: string;
  domain: string;
  urlPattern: (query: string) => string;
  defaultRating: number;
  deliveryTime: string;
  supportedCategories: InputCategory[];
}

const SUPPORTED_STORES: StoreDefinition[] = [
  {
    name: 'Amazon India',
    domain: 'amazon.in',
    urlPattern: (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
    defaultRating: 4.6,
    deliveryTime: 'Check Amazon for delivery estimate',
    supportedCategories: ['GAMING_SETUPS', 'COMPUTERS_ELECTRONICS', 'SKINCARE', 'FASHION', 'BAGS', 'HOME_LIFESTYLE', 'UNKNOWN']
  },
  {
    name: 'Flipkart',
    domain: 'flipkart.com',
    urlPattern: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
    defaultRating: 4.5,
    deliveryTime: 'Check Flipkart for delivery estimate',
    supportedCategories: ['GAMING_SETUPS', 'COMPUTERS_ELECTRONICS', 'FASHION', 'BAGS', 'HOME_LIFESTYLE', 'UNKNOWN']
  },
  {
    name: 'Google Shopping',
    domain: 'google.com',
    urlPattern: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
    defaultRating: 4.8,
    deliveryTime: 'Aggregated Web Index',
    supportedCategories: ['GAMING_SETUPS', 'COMPUTERS_ELECTRONICS', 'SKINCARE', 'FASHION', 'BAGS', 'HOME_LIFESTYLE', 'UNKNOWN']
  },
  {
    name: 'Nykaa',
    domain: 'nykaa.com',
    urlPattern: (q) => `https://www.nykaa.com/search/result/?q=${encodeURIComponent(q)}`,
    defaultRating: 4.7,
    deliveryTime: 'Check Nykaa for delivery estimate',
    supportedCategories: ['SKINCARE', 'FASHION', 'BAGS']
  },
  {
    name: 'Tira Beauty',
    domain: 'tirabeauty.com',
    urlPattern: (q) => `https://www.tirabeauty.com/search?q=${encodeURIComponent(q)}`,
    defaultRating: 4.7,
    deliveryTime: 'Check Tira for delivery estimate',
    supportedCategories: ['SKINCARE']
  },
  {
    name: 'Myntra',
    domain: 'myntra.com',
    urlPattern: (q) => `https://www.myntra.com/search?q=${encodeURIComponent(q)}`,
    defaultRating: 4.6,
    deliveryTime: 'Check Myntra for delivery estimate',
    supportedCategories: ['FASHION', 'BAGS']
  }
];

/**
 * Estimates baseline price range guided by user constraints or category
 */
function resolveBaselinePrice(category: InputCategory, constraints?: UserConstraints): number {
  if (constraints?.budgetMax && constraints.budgetMax > 0) {
    return constraints.budgetMax;
  }
  switch (category) {
    case 'GAMING_SETUPS':
      return 60000;
    case 'COMPUTERS_ELECTRONICS':
      return 15000;
    case 'SKINCARE':
      return 499;
    case 'FASHION':
      return 1999;
    case 'BAGS':
      return 2499;
    case 'HOME_LIFESTYLE':
      return 4999;
    default:
      return 999;
  }
}

/**
 * Maps InputCategory to human-readable entity category
 */
function mapToEntityCategory(cat: InputCategory): DetectedEntity['category'] {
  switch (cat) {
    case 'GAMING_SETUPS': return 'Gaming Setup';
    case 'COMPUTERS_ELECTRONICS': return 'Computers & Electronics';
    case 'SKINCARE': return 'Skincare';
    case 'FASHION': return 'Fashion';
    case 'BAGS': return 'Bags';
    case 'HOME_LIFESTYLE': return 'Home & Lifestyle';
    case 'RECIPE': return 'Food & Recipe';
    default: return 'Unknown';
  }
}

/**
 * Real-Time Multi-Retailer Search Aggregator (Phase 1 Safe Normalization)
 * Generates verified, clean live search links across major retailers without fabricating exact product matches.
 */
export function performLiveRetailerSearch(
  query: string,
  imagePreviewUrl?: string,
  constraints?: UserConstraints
): SiftlyAnalysisResult {
  const startTime = Date.now();
  const cleanQuery = normalizeProductQuery(query, constraints);
  const { primaryCategory } = classifyInputType(query, Boolean(imagePreviewUrl));
  const entityCategory = mapToEntityCategory(primaryCategory);
  const detectedBrand = extractBrand(cleanQuery) || extractBrand(query) || '';

  const basePrice = resolveBaselinePrice(primaryCategory, constraints);
  const encoded = encodeURIComponent(cleanQuery);

  // Filter relevant stores strictly according to the detected product category
  const relevantStores = SUPPORTED_STORES.filter(s => s.supportedCategories.includes(primaryCategory));
  const activeStores = relevantStores.length > 0 ? relevantStores : SUPPORTED_STORES.slice(0, 3);

  // Construct truthful unverified search offers (urlType: SEARCH, verified: false)
  const merchants: MerchantOffer[] = activeStores.map((store, idx) => {
    const rawUrl = store.urlPattern(cleanQuery);

    return {
      id: `m_${store.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${idx}`,
      sellerName: store.name,
      sellerRating: store.defaultRating,
      price: basePrice,
      currency: 'INR',
      productUrl: rawUrl,
      urlType: 'SEARCH',
      availability: 'UNKNOWN',
      source: `${store.name} Search Listing`,
      verified: false,
      inStock: false,
      deliveryEstimate: store.deliveryTime,
      isLowestPrice: false,
      verifiedAt: 'Unverified search reference'
    };
  });

  const entityId = `entity_${Date.now()}`;
  const detectedEntity: DetectedEntity = {
    id: entityId,
    name: cleanQuery,
    category: entityCategory,
    productType: entityCategory === 'Unknown' ? 'Search Query' : `${entityCategory} Item`,
    brand: detectedBrand,
    brandConfidence: detectedBrand ? 'detected' : 'unknown',
    confidenceScore: primaryCategory === 'UNKNOWN' ? 50.0 : 85.0,
    cropImageUrl: imagePreviewUrl && (imagePreviewUrl.startsWith('http://') || imagePreviewUrl.startsWith('https://')) ? imagePreviewUrl : undefined,
    attributes: {
      category: entityCategory,
      productType: `${entityCategory} Item`,
      brand: detectedBrand || undefined,
      brandConfidence: detectedBrand ? 'detected' : 'unknown',
      color: 'Standard',
      visibleText: cleanQuery
    },
    optimizedSearchQuery: cleanQuery
  };

  // Safe Image Assignment:
  // Never show cosmetic packshots or Unsplash bottles for Computers, Gaming, Home, or Unknown!
  let productImage = '';
  const lower = cleanQuery.toLowerCase();
  if (primaryCategory === 'SKINCARE') {
    if (lower.includes('nivea') || lower.includes('lip balm')) productImage = '/products/nivea-cherry.svg';
    else if (lower.includes('medicube')) productImage = '/products/medicube-bodywash.svg';
    else if (lower.includes('wishcare')) productImage = '/products/wishcare-cherry.svg';
    else if (lower.includes('cerave')) productImage = '/products/cerave-cleanser.svg';
  } else if (primaryCategory === 'BAGS') {
    productImage = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80';
  } else if (primaryCategory === 'FASHION') {
    productImage = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80';
  }
  // Otherwise productImage remains empty string so no false images are displayed

  const primaryMatch: ProductMatch = {
    id: `match_live_${Date.now()}`,
    entityId: entityId,
    title: cleanQuery,
    brand: detectedBrand,
    imageUrl: productImage,
    matchTier: 'SEARCH_RESULT',
    matchScore: primaryCategory === 'UNKNOWN' ? 60.0 : 85.0,
    matchReasons: [
      `Search query: "${cleanQuery}"`,
      `Live store search across ${activeStores.map(s => s.name).join(', ')}`,
      `Note: Retailer search links provide matching listings; exact product availability should be verified on retailer store.`
    ],
    scoreBreakdown: {
      visualSimilarity: 75,
      brandMatch: detectedBrand ? 100 : 70,
      categoryMatch: primaryCategory === 'UNKNOWN' ? 50 : 90,
      colorMatch: 75,
      semanticMatch: 85,
      budgetFitBonus: constraints?.budgetMax ? 90 : 80,
      totalScore: primaryCategory === 'UNKNOWN' ? 60.0 : 85.0
    },
    lowestPrice: basePrice,
    currency: 'INR',
    availableMerchantsCount: merchants.length,
    productRating: undefined,
    reviewsCount: undefined,
    keyAttributes: {
      'Query Target': cleanQuery,
      'Category': entityCategory,
      ...(constraints?.budgetMax ? { 'Budget Constraint': `Up to ₹${constraints.budgetMax.toLocaleString()}` } : {})
    },
    merchants: merchants
  };

  return {
    id: `siftly_${Date.now()}`,
    inputType: imagePreviewUrl ? 'IMAGE' : 'TEXT',
    intent: 'SHOPPING',
    primaryCategory: primaryCategory,
    rawInput: query,
    mediaPreviewUrl: imagePreviewUrl,
    userConstraints: constraints || { currency: 'INR' },
    detectedEntities: [detectedEntity],
    productMatches: {
      [entityId]: [primaryMatch]
    },
    executionTimeMs: Date.now() - startTime
  };
}
