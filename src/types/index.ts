export type IntentType = 'SHOPPING' | 'RECIPE' | 'UNKNOWN';

export type InputCategory = 
  | 'FASHION' 
  | 'BAGS' 
  | 'SKINCARE' 
  | 'RECIPE' 
  | 'MIXED'
  | 'COMPUTERS_ELECTRONICS'
  | 'GAMING_SETUPS'
  | 'HOME_LIFESTYLE'
  | 'UNKNOWN';

export type MatchTier = 'EXACT' | 'CLOSE' | 'SIMILAR' | 'BUDGET_ALT' | 'SEARCH_RESULT';

export type ConfidenceLevel = 'detected' | 'inferred' | 'unknown';

export interface VisualAttributes {
  category: string;
  productType: string;
  brand?: string;
  brandConfidence: ConfidenceLevel;
  color: string;
  material?: string;
  pattern?: string;
  style?: string;
  necklineOrCut?: string;
  hardwareOrDetails?: string[];
  visibleText?: string;
  logoDetected?: boolean;
}

export interface DetectedEntity {
  id: string;
  name: string;
  category: 'Fashion' | 'Bags' | 'Skincare' | 'Computers & Electronics' | 'Gaming Setup' | 'Home & Lifestyle' | 'Food & Recipe' | 'Other' | 'Unknown';
  productType: string;
  brand: string;
  brandConfidence: ConfidenceLevel;
  confidenceScore: number;
  attributes: VisualAttributes;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropImageUrl?: string;
  optimizedSearchQuery: string;
}

export type ProductUrlType = 'PRODUCT' | 'SEARCH' | 'UNAVAILABLE';
export type ProductAvailability = 'AVAILABLE' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface MerchantOffer {
  id: string;
  sellerName: string;
  sellerLogo?: string;
  sellerRating?: number;
  price: number;
  originalPrice?: number;
  currency: string;
  productUrl: string;
  urlType: ProductUrlType;
  availability: ProductAvailability;
  source: string;
  verified: boolean;
  inStock: boolean;
  deliveryEstimate?: string;
  isLowestPrice: boolean;
  verifiedAt: string;
  affiliateUrl?: string;
  /** false when the store's price could not be confirmed (price is then 0 and must not be shown as a number) */
  priceKnown?: boolean;
  /** Offer text from the store listing, e.g. "10% off with HDFC cards", "Free delivery" */
  offers?: string[];
  discountLabel?: string;
  tag?: string;
  paymentMethods?: string;
  shipping?: string;
}

export interface MatchScoreBreakdown {
  visualSimilarity: number;
  brandMatch: number;
  categoryMatch: number;
  colorMatch: number;
  semanticMatch: number;
  budgetFitBonus: number;
  totalScore: number;
}

export interface ProductMatch {
  id: string;
  entityId: string;
  title: string;
  brand: string;
  imageUrl: string;
  additionalImages?: string[];
  matchTier: MatchTier;
  matchScore: number;
  matchReasons: string[];
  scoreBreakdown: MatchScoreBreakdown;
  lowestPrice: number;
  currency: string;
  availableMerchantsCount: number;
  merchants: MerchantOffer[];
  keyAttributes: Record<string, string>;
  productRating?: number;
  reviewsCount?: number;
  /** false when no store price could be confirmed */
  priceKnown?: boolean;
  /** One-line reason why this product was picked */
  whyPicked?: string;
  /** Where the data came from, e.g. "Google Shopping" or "Web search" */
  dataSource?: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  isRequired: boolean;
  category: 'Produce' | 'Pantry' | 'Dairy & Refrigerated' | 'Meat & Seafood' | 'Spices & Seasoning' | 'Other';
  estimatedCostInr?: number;
  notes?: string;
}

export interface IngredientSubstitution {
  originalIngredientId?: string;
  originalName: string;
  substituteName: string;
  ratioNotes: string;
  flavorImpact: string;
  costImpact: 'Much Cheaper' | 'Slightly Cheaper' | 'Equal' | 'More Expensive';
  estimatedSavingsPercentage?: number;
  preparationTip?: string;
}

export interface RecipeData {
  id: string;
  dishName: string;
  origin?: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  summaryDescription: string;
  ingredients: RecipeIngredient[];
  substitutions: IngredientSubstitution[];
  instructions: string[];
  estimatedTotalCostInr: number;
  estimatedOptimizedCostInr: number;
  dietaryTags: string[];
  sourceMediaUrl?: string;
  thumbnailUrl?: string;
}

export interface UserConstraints {
  budgetMax?: number;
  budgetMin?: number;
  currency: string;
  preferredStores?: string[];
  dietaryPreferences?: string[];
  naturalLanguageQuery?: string;
  requestedCount?: number;
  normalizedProductQuery?: string;
}

export interface AnalysisProgressStep {
  step: 'IDENTIFY_INPUT' | 'AI_VISION' | 'EXTRACT_ENTITIES' | 'SEARCH_SELLERS' | 'RANK_AND_VERIFY' | 'COMPLETE';
  message: string;
  progressPercent: number;
  details?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface SiftlyAnalysisResult {
  id: string;
  inputType: 'IMAGE' | 'YOUTUBE_URL' | 'INSTAGRAM_URL' | 'TEXT' | 'HYBRID';
  intent: IntentType;
  primaryCategory: InputCategory;
  rawInput: string;
  mediaPreviewUrl?: string;
  userConstraints: UserConstraints;
  detectedEntities: DetectedEntity[];
  productMatches: Record<string, ProductMatch[]>; // entityId -> matches
  recipeData?: RecipeData;
  warnings?: string[];
  executionTimeMs: number;
  isGroundingActive?: boolean;
  searchQueries?: string[];
  groundingSources?: GroundingSource[];
  configurationNotice?: string;
}

export interface ExternalWebResult {
  title: string;
  source: string;
  price?: string;
  url: string;
  thumbnail?: string;
  matchSnippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'link' | 'file';
  analysisResult?: SiftlyAnalysisResult;
  googleShoppingUrl?: string;
  googleLensUrl?: string;
  directWebResults?: ExternalWebResult[];
  groundingSources?: GroundingSource[];
  isGroundingActive?: boolean;
  configurationNotice?: string;
  isLoading?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  country?: string;
  state?: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

