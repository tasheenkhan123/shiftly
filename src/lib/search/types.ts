/** Shared types for the search pipeline */
import type { SiftlyAnalysisResult, SearchProgressEvent, MatchTier, MerchantOffer } from '@/types';
import type { CategoryId, PreferenceProfile } from '@/lib/categories';

export interface SearchResponse {
  result: SiftlyAnalysisResult;
  assistantSummary: string;
  isGroundingActive: boolean;
  configurationNotice?: string;
}

export interface PersonalizationInput {
  /** Category chip the user selected, if any */
  categoryHint?: CategoryId;
  /** The user's saved preference profile */
  profile?: PreferenceProfile;
  /** "For someone else" switch: don't use the user's own profile */
  forSomeoneElse?: boolean;
}

export type ProgressFn = (stage: SearchProgressEvent['stage'], message: string) => void;

export interface ConversationTurn {
  sender: 'user' | 'assistant';
  text: string;
  previousProducts?: Array<{ title: string; brand: string; price: number }>;
}

export interface BundleComponentPlan {
  componentName: string;
  searchQuery: string;
  shoppingQuery?: string;
  allocatedBudget: number;
}

export interface ParsedShoppingIntent {
  isBundleOrSetup: boolean;
  bundleComponents?: BundleComponentPlan[];
  searchQuery: string;
  shoppingQuery: string;
  cleanTarget: string;
  category: 'Fashion' | 'Bags' | 'Skincare' | 'Computers & Electronics' | 'Gaming Setup' | 'Home & Lifestyle' | 'Other';
  budgetMax: number | null;
  totalBudget: number | null;
  requestedCount: number;
  preferredBrands: string[];
  priorities: string[];
  needsClarification: boolean;
  clarificationQuestion?: string | null;
  appliedPreferences: string[];
  excludedProductTitles?: string[];
  /** What Gemini saw in the uploaded screenshot, if any */
  imageDescription?: string | null;
  /** Personalisation */
  categoryId: CategoryId;
  /** Preferences stated in this conversation, to remember in the user's profile */
  learnedPreferences: Record<string, string>;
  /** Saved + newly stated preferences that apply to this search, human readable */
  activePreferences: string[];
  /** Brands the results must come from (explicit brands or expanded groups like K-beauty) */
  brandFilter: string[];
  brandGroupLabel?: string;
  /** Assumptions Siftly made, e.g. "₹3,000 treated as the budget per product" */
  assumptions?: string | null;
  /** Specific products Gemini would recommend from its own knowledge; we search for each to get real prices */
  suggestedProducts: string[];
  followUpQuestion?: string | null;
  /** Plain product type without brand or attributes, e.g. "fine fragrance mist" */
  productType?: string | null;
  forSomeoneElse?: boolean;
  forWho?: string | null;
  /** A quick question worth asking after this search (key preference not known yet) */
  askPreference?: { categoryId: CategoryId; key: string; question: string; options: string[] } | null;
}

export interface ExtractedProductCandidate {
  title: string;
  brand: string;
  price: number | null;
  merchant: string;
  sourceUrl: string;
  imageUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  isDirectProductPage: boolean;
  evidenceSnippet: string;
  keyBenefitsOrIngredients?: string;
  qualityOrReviews?: string;
  keyAttributes?: Record<string, string>;
}

export interface TavilyImageItem {
  url: string;
  title?: string;
  description?: string;
}

export interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilySearchApiResponse {
  results?: TavilySearchResultItem[];
  images?: Array<string | TavilyImageItem>;
  error?: string;
}

/**
 * Step 4: Transparent Multi-Factor Product Scoring & Brand-Diverse Selection
 */
export interface ScoredCandidate {
  candidate: ExtractedProductCandidate;
  relevanceScore: number;
  qualityScore: number;
  budgetScore: number;
  evidenceScore: number;
  brandScore: number;
  totalScore: number;
  matchTier: MatchTier;
  otherOffers: MerchantOffer[];
}
