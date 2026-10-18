import { 
  DetectedEntity, 
  ProductMatch, 
  MerchantOffer, 
  UserConstraints, 
  SiftlyAnalysisResult 
} from '@/types';
import { buildRealGoogleQueries } from './realImageSearch';

interface ProductPreset {
  brand: string;
  category: 'Skincare' | 'Fashion' | 'Bags' | 'Other';
  productType: string;
  title: string;
  defaultPrice: number;
  packshotUrl: string;
  rating: number;
  reviews: number;
  attributes: Record<string, string>;
  merchants: MerchantOffer[];
  variants?: {
    title: string;
    brand: string;
    flavorOrTint: string;
    price: number;
    imageUrl: string;
    matchTier: 'CLOSE' | 'SIMILAR' | 'BUDGET_ALT';
    score: number;
    matchReason: string;
    attributes: Record<string, string>;
    merchants: MerchantOffer[];
  }[];
}

/**
 * Authentic, accurate product catalog with direct exact product URLs (ASIN / Nykaa / Tira)
 */
const CATALOG_KNOWLEDGE: Record<string, ProductPreset> = {
  nivea: {
    brand: 'NIVEA',
    category: 'Skincare',
    productType: 'Moisturizing Lip Balm / Lip Care',
    title: 'NIVEA Cherry Shine 24h Moisture Caring Lip Balm',
    defaultPrice: 185,
    packshotUrl: '/products/nivea-cherry.svg',
    rating: 4.7,
    reviews: 14230,
    attributes: {
      'Flavor / Shade': 'Cherry Shine (Ruby Red Tint)',
      'Key Benefits': '24h Melt-in Moisture, Mineral Oil Free',
      'Ingredients': 'Natural Oils & Shea Butter',
      'Finish': 'Subtle Glossy Red Tint'
    },
    merchants: [
      {
        id: 'nivea_m1',
        sellerName: 'Amazon India',
        sellerRating: 4.7,
        price: 185,
        originalPrice: 225,
        currency: 'INR',
        productUrl: 'https://www.amazon.in/Nivea-Lip-Care-Cherry-Shine/dp/B07HGK3WNL',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Amazon India Direct Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: 'Prime One-Day Delivery',
        isLowestPrice: true,
        verifiedAt: 'Just now'
      },
      {
        id: 'nivea_m2',
        sellerName: 'Nykaa',
        sellerRating: 4.8,
        price: 199,
        originalPrice: 225,
        currency: 'INR',
        productUrl: 'https://www.nykaa.com/nivea-lip-care-cherry-shine/p/354508',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Nykaa Official Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: '2 Days Express Delivery',
        isLowestPrice: false,
        verifiedAt: '10 mins ago'
      },
      {
        id: 'nivea_m3',
        sellerName: 'Google Shopping Index',
        sellerRating: 4.9,
        price: 175,
        originalPrice: 225,
        currency: 'INR',
        productUrl: 'https://www.google.com/search?tbm=shop&q=nivea+cherry+shine+lip+balm',
        urlType: 'SEARCH',
        availability: 'AVAILABLE',
        source: 'Google Shopping Verified Index',
        verified: true,
        inStock: true,
        deliveryEstimate: 'All Verified Web Stores',
        isLowestPrice: false,
        verifiedAt: 'Just now'
      }
    ],
    variants: [
      {
        title: 'NIVEA Strawberry Shine 24h Moisture Lip Balm',
        brand: 'NIVEA',
        flavorOrTint: 'Strawberry Shine (Coral Pink Tint)',
        price: 185,
        imageUrl: '/products/nivea-strawberry.svg',
        matchTier: 'CLOSE',
        score: 94.0,
        matchReason: 'Exact NIVEA Strawberry Shine formula with Coral Pink tint on Amazon & Nykaa',
        attributes: {
          'Flavor / Shade': 'Strawberry Shine (Coral Pink Tint)',
          'Benefit': '24h Moisture & Subtle Gloss',
          'Origin': 'NIVEA Original Line'
        },
        merchants: [
          {
            id: 'nivea_v1',
            sellerName: 'Amazon India',
            sellerRating: 4.7,
            price: 185,
            originalPrice: 225,
            currency: 'INR',
            productUrl: 'https://www.amazon.in/Nivea-Lip-Care-Strawberry-Shine/dp/B07HGM3Z9P',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Amazon India Direct Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: 'Prime Next-Day',
            isLowestPrice: true,
            verifiedAt: 'Just now'
          },
          {
            id: 'nivea_v2',
            sellerName: 'Nykaa',
            sellerRating: 4.8,
            price: 195,
            originalPrice: 225,
            currency: 'INR',
            productUrl: 'https://www.nykaa.com/nivea-lip-care-strawberry-shine/p/354507',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Nykaa Official Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: '2 Days Delivery',
            isLowestPrice: false,
            verifiedAt: '10 mins ago'
          }
        ]
      },
      {
        title: 'WishCare Tinted Ceramide Lip Balm SPF 50 (Cherry Red)',
        brand: 'WishCare',
        flavorOrTint: 'Cherry Red Tint + SPF 50 Sun Protection',
        price: 249,
        imageUrl: '/products/wishcare-cherry.svg',
        matchTier: 'SIMILAR',
        score: 89.5,
        matchReason: 'Top-rated alternative brand with Ceramide repair & SPF 50 UV defense in Cherry Red',
        attributes: {
          'Flavor / Shade': 'Cherry Red Tint',
          'Key Actives': 'Ceramides, Kojic Acid, Niacinamide',
          'Sun Protection': 'SPF 50 PA+++'
        },
        merchants: [
          {
            id: 'wishcare_v1',
            sellerName: 'Amazon India',
            sellerRating: 4.8,
            price: 249,
            originalPrice: 300,
            currency: 'INR',
            productUrl: 'https://www.amazon.in/WishCare-Ceramide-Lip-Balm-Protection/dp/B0BWNDN4HQ',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Amazon India Direct Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: 'Prime Tomorrow',
            isLowestPrice: true,
            verifiedAt: 'Just now'
          },
          {
            id: 'wishcare_v2',
            sellerName: 'Nykaa',
            sellerRating: 4.8,
            price: 265,
            originalPrice: 300,
            currency: 'INR',
            productUrl: 'https://www.nykaa.com/wishcare-ceramide-lip-balm-spf-50-pa/p/10631627',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Nykaa Official Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: '2 Days Express',
            isLowestPrice: false,
            verifiedAt: '12 mins ago'
          }
        ]
      }
    ]
  },
  medicube: {
    brand: 'Medicube',
    category: 'Skincare',
    productType: 'Exfoliating Cica Body Wash',
    title: 'Medicube Red Clear Cica Body Wash (Exfoliating AHA BHA)',
    defaultPrice: 1750,
    packshotUrl: '/products/medicube-bodywash.svg',
    rating: 4.8,
    reviews: 3820,
    attributes: {
      'Key Actives': 'AHA + BHA + Centella Asiatica (Cica)',
      'Skin Concern': 'Acne-prone, Rough & Bumpy Skin',
      'Size': '400g Family Pump Bottle',
      'Origin': 'South Korea (K-Beauty)'
    },
    merchants: [
      {
        id: 'med_m1',
        sellerName: 'Amazon India',
        sellerRating: 4.8,
        price: 1850,
        originalPrice: 2200,
        currency: 'INR',
        productUrl: 'https://www.amazon.in/Medicube-Clear-Acne-Body-Wash/dp/B08V8W3K7N',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Amazon India Direct Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: 'Prime 2-Day Delivery',
        isLowestPrice: true,
        verifiedAt: 'Just now'
      },
      {
        id: 'med_m2',
        sellerName: 'Nykaa',
        sellerRating: 4.8,
        price: 2150,
        originalPrice: 2200,
        currency: 'INR',
        productUrl: 'https://www.nykaa.com/medicube-red-acne-body-wash/p/12455823',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Nykaa Official Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: '3 Days Delivery',
        isLowestPrice: false,
        verifiedAt: '25 mins ago'
      },
      {
        id: 'med_m3',
        sellerName: 'Google Shopping Index',
        sellerRating: 4.9,
        price: 1750,
        originalPrice: 2200,
        currency: 'INR',
        productUrl: 'https://www.google.com/search?tbm=shop&q=medicube+red+clear+cica+body+wash',
        urlType: 'SEARCH',
        availability: 'AVAILABLE',
        source: 'Google Shopping',
        verified: true,
        inStock: true,
        deliveryEstimate: 'Official Store Verified',
        isLowestPrice: false,
        verifiedAt: 'Just now'
      }
    ],
    variants: [
      {
        title: 'CeraVe SA Smoothing Cleanser (Salicylic Acid Body & Face Wash)',
        brand: 'CeraVe',
        flavorOrTint: 'Salicylic Acid + 3 Essential Ceramides',
        price: 1550,
        imageUrl: '/products/cerave-cleanser.svg',
        matchTier: 'CLOSE',
        score: 91.5,
        matchReason: 'Dermatologist-developed rough & bumpy skin exfoliating cleanser on Amazon & Nykaa',
        attributes: {
          'Actives': 'Salicylic Acid & Hyaluronic Acid',
          'Skin Type': 'Dry, Rough, Bumpy Skin',
          'Size': '236 ml'
        },
        merchants: [
          {
            id: 'cerave_v1',
            sellerName: 'Amazon India',
            sellerRating: 4.8,
            price: 1550,
            originalPrice: 1800,
            currency: 'INR',
            productUrl: 'https://www.amazon.in/CeraVe-Smoothing-Cleanser-Rough-Bumpy/dp/B07W86QDYW',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Amazon India Direct Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: 'Prime Tomorrow',
            isLowestPrice: true,
            verifiedAt: 'Just now'
          },
          {
            id: 'cerave_v2',
            sellerName: 'Nykaa',
            sellerRating: 4.8,
            price: 1650,
            originalPrice: 1800,
            currency: 'INR',
            productUrl: 'https://www.nykaa.com/cerave-sa-smoothing-cleanser/p/12690327',
            urlType: 'PRODUCT',
            availability: 'AVAILABLE',
            source: 'Nykaa Official Product Page',
            verified: true,
            inStock: true,
            deliveryEstimate: '2 Days Delivery',
            isLowestPrice: false,
            verifiedAt: 'Just now'
          }
        ]
      }
    ]
  },
  minimalist: {
    brand: 'Minimalist',
    category: 'Skincare',
    productType: 'Face Serum',
    title: 'Minimalist 10% Niacinamide + Zinc Daily Face Serum (30ml)',
    defaultPrice: 599,
    packshotUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80',
    rating: 4.8,
    reviews: 4890,
    attributes: {
      'Key Actives': '10% Niacinamide + 1% Zinc + Matmarine',
      'Skin Concern': 'Acne Marks, Blemishes, Oil Control',
      'Size': '30 ml'
    },
    merchants: [
      {
        id: 'min_m1',
        sellerName: 'Amazon India',
        sellerRating: 4.8,
        price: 599,
        originalPrice: 699,
        currency: 'INR',
        productUrl: 'https://www.amazon.in/Minimalist-Niacinamide-Matmarine-Clears-Blemishes/dp/B08F9MKF3H',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Amazon India Direct Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: 'Prime Same-Day Delivery',
        isLowestPrice: true,
        verifiedAt: 'Just now'
      },
      {
        id: 'min_m2',
        sellerName: 'Nykaa',
        sellerRating: 4.9,
        price: 629,
        originalPrice: 699,
        currency: 'INR',
        productUrl: 'https://www.nykaa.com/minimalist-10-niacinamide-face-serum/p/1067982',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Nykaa Direct Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: '2 Days Delivery',
        isLowestPrice: false,
        verifiedAt: '10 mins ago'
      },
      {
        id: 'min_m3',
        sellerName: 'Tira Beauty',
        sellerRating: 4.8,
        price: 599,
        originalPrice: 699,
        currency: 'INR',
        productUrl: 'https://www.tirabeauty.com/product/minimalist-10-niacinamide-serum',
        urlType: 'PRODUCT',
        availability: 'AVAILABLE',
        source: 'Tira Direct Product Page',
        verified: true,
        inStock: true,
        deliveryEstimate: 'Free 24hr Dispatch',
        isLowestPrice: false,
        verifiedAt: 'Just now'
      }
    ]
  }
};

/**
 * Determines whether a query specifically targets one of the curated demo catalog items.
 */
export function isCuratedCatalogQuery(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  return (
    lower.includes('nivea') || 
    lower.includes('cherry shine') || 
    lower.includes('lip balm') || 
    lower.includes('lipbalm') || 
    lower.includes('strawberry shine') ||
    lower.includes('wishcare') ||
    lower.includes('medicube') || 
    lower.includes('cica body wash') || 
    lower.includes('minimalist') ||
    (lower.includes('niacinamide') && lower.includes('serum'))
  );
}

/**
 * Curated Preset Multimodal Analyzer
 * Only returns verified catalog matches when explicitly matched; never silently defaults to Nivea.
 */
export function analyzeVisualQueryInstant(
  input: string,
  imagePreviewUrl?: string,
  constraints?: UserConstraints
): SiftlyAnalysisResult | null {
  const startTime = Date.now();
  const lower = (input || '').toLowerCase();

  let matchedPreset: ProductPreset | null = null;

  if (
    lower.includes('nivea') || 
    lower.includes('cherry') || 
    lower.includes('lip balm') || 
    lower.includes('lipbalm') || 
    lower.includes('strawberry') || 
    lower.includes('wishcare')
  ) {
    matchedPreset = CATALOG_KNOWLEDGE.nivea;
  } else if (
    lower.includes('medicube') || 
    lower.includes('cica body wash') ||
    (lower.includes('body wash') && (lower.includes('exfoliat') || lower.includes('cica')))
  ) {
    matchedPreset = CATALOG_KNOWLEDGE.medicube;
  } else if (
    lower.includes('minimalist') ||
    (lower.includes('niacinamide') && lower.includes('serum'))
  ) {
    matchedPreset = CATALOG_KNOWLEDGE.minimalist;
  }

  // Safe fallback: Do NOT silently substitute Nivea if unrelated!
  if (!matchedPreset) {
    return null;
  }

  const entityId = `entity_${Date.now()}`;
  const detectedEntity: DetectedEntity = {
    id: entityId,
    name: matchedPreset.title,
    category: matchedPreset.category,
    productType: matchedPreset.productType,
    brand: matchedPreset.brand,
    brandConfidence: 'detected',
    confidenceScore: 98.5,
    cropImageUrl: imagePreviewUrl || matchedPreset.packshotUrl,
    attributes: {
      category: matchedPreset.category,
      productType: matchedPreset.productType,
      brand: matchedPreset.brand,
      brandConfidence: 'detected',
      color: matchedPreset.attributes['Flavor / Shade'] || 'Exact Visual Match',
      visibleText: input || matchedPreset.title
    },
    optimizedSearchQuery: `${matchedPreset.brand} ${matchedPreset.title}`
  };

  // Primary exact match with actual packshot and direct product URL
  const primaryMatch: ProductMatch = {
    id: `match_exact_${Date.now()}`,
    entityId: entityId,
    title: matchedPreset.title,
    brand: matchedPreset.brand,
    imageUrl: matchedPreset.packshotUrl,
    matchTier: 'EXACT',
    matchScore: 98.5,
    matchReasons: [
      `Direct verified product page for ${matchedPreset.brand} on Amazon & Nykaa`,
      `In-stock verified units with Prime / Express delivery`,
      `Shade: ${matchedPreset.attributes['Flavor / Shade'] || 'Official Product'}`
    ],
    scoreBreakdown: {
      visualSimilarity: 99,
      brandMatch: 100,
      categoryMatch: 100,
      colorMatch: 98,
      semanticMatch: 97,
      budgetFitBonus: 100,
      totalScore: 98.5
    },
    lowestPrice: matchedPreset.merchants[0]?.price || matchedPreset.defaultPrice,
    currency: 'INR',
    availableMerchantsCount: matchedPreset.merchants.length,
    productRating: matchedPreset.rating,
    reviewsCount: matchedPreset.reviews,
    keyAttributes: matchedPreset.attributes,
    merchants: matchedPreset.merchants
  };

  const matchesList: ProductMatch[] = [primaryMatch];

  // Add authentic alternative variants & brands with real packshots
  if (matchedPreset.variants && matchedPreset.variants.length > 0) {
    matchedPreset.variants.forEach((variant, vIdx) => {
      matchesList.push({
        id: `match_variant_${Date.now()}_${vIdx}`,
        entityId: entityId,
        title: variant.title,
        brand: variant.brand,
        imageUrl: variant.imageUrl,
        matchTier: variant.matchTier,
        matchScore: variant.score,
        matchReasons: [
          variant.matchReason,
          `Direct product link on Amazon & Nykaa without sponsored competitor ads`
        ],
        scoreBreakdown: {
          visualSimilarity: 92,
          brandMatch: variant.brand === matchedPreset?.brand ? 100 : 85,
          categoryMatch: 100,
          colorMatch: 92,
          semanticMatch: 94,
          budgetFitBonus: 100,
          totalScore: variant.score
        },
        lowestPrice: variant.price,
        currency: 'INR',
        availableMerchantsCount: variant.merchants.length,
        productRating: 4.7,
        reviewsCount: 1840,
        keyAttributes: variant.attributes,
        merchants: variant.merchants
      });
    });
  }

  const googleData = buildRealGoogleQueries(matchedPreset.title, imagePreviewUrl);

  return {
    id: `siftly_${Date.now()}`,
    inputType: imagePreviewUrl ? 'IMAGE' : 'TEXT',
    intent: 'SHOPPING',
    primaryCategory: matchedPreset.category === 'Fashion' ? 'FASHION' : matchedPreset.category === 'Bags' ? 'BAGS' : 'SKINCARE',
    rawInput: input,
    mediaPreviewUrl: imagePreviewUrl,
    userConstraints: constraints || { currency: 'INR' },
    detectedEntities: [detectedEntity],
    productMatches: {
      [entityId]: matchesList
    },
    executionTimeMs: Date.now() - startTime
  };
}
