/**
 * Entry point for every search: understand the request, then search Google Shopping
 * (or the Tavily fallback). Streams progress through onProgress.
 */
import type { UserConstraints } from '@/types';
import type { ConversationTurn, PersonalizationInput, ProgressFn, SearchResponse } from '@/lib/search/types';
import { understandShoppingQuery } from '@/lib/ai/intent';
import { isGoogleShoppingConfigured, QUOTA_MESSAGE, SearchQuotaError } from '@/lib/search/googleShoppingProvider';
import { runGoogleShoppingFlow } from '@/lib/search/googleShoppingFlow';
import { runTavilyFallback } from '@/lib/search/tavilyFallback';
import { createEmptyResponse } from '@/lib/search/responses';

/**
 * Step 5: Master Shopping Pipeline Orchestrator
 * - Understands complete setups/bundles (divides budget across components).
 * - Distinguishes setups from individual products.
 * - Handles follow-up messages ("make it cheaper", "oily skin", "give me two more options").
 * - Recommends first without questionnaire behavior.
 * - Discovers real products via Tavily live search with exact retailer links.
 */
export async function searchProducts(
  rawInput: string,
  imagePreviewUrl?: string,
  constraints?: UserConstraints,
  conversationHistory?: ConversationTurn[],
  onProgress: ProgressFn = () => {},
  personal: PersonalizationInput = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  // Validate API Keys
  if (!geminiApiKey) {
    return createEmptyResponse(
      rawInput,
      'GEMINI_API_KEY is not configured in .env.local. Please configure your Gemini API key to enable AI shopping search.',
      startTime,
      constraints
    );
  }


  try {
    // 1. Understand Query with Gemini (Dynamic target, setup detection, budget allocation, follow-up memory)
    onProgress(imagePreviewUrl ? 'reading_image' : 'understanding', imagePreviewUrl ? 'Looking at your image…' : 'Understanding what you need…');
    const parsedIntent = await understandShoppingQuery(rawInput, geminiApiKey, constraints, conversationHistory, imagePreviewUrl, personal);
    if (imagePreviewUrl && !parsedIntent.imageDescription) {
      console.warn('[intent] image attached but Gemini returned no image description');
    }

    // If clarification is genuinely essential (missing all context/category), ask at most ONE question immediately
    if (parsedIntent.needsClarification && parsedIntent.clarificationQuestion) {
      return createEmptyResponse(
        rawInput,
        parsedIntent.clarificationQuestion,
        startTime,
        constraints
      );
    }

    // ==========================================
    // PREFERRED: Google Shopping (real listings, real prices, real store comparison)
    // ==========================================
    if (isGoogleShoppingConfigured()) {
      try {
        const gs = await runGoogleShoppingFlow(rawInput, parsedIntent, geminiApiKey, startTime, imagePreviewUrl, constraints, onProgress);
        if (gs) return gs;
      } catch (err: any) {
        // Out of SerpApi searches: say so honestly instead of showing weaker fallback results
        if (err instanceof SearchQuotaError) {
          console.error('[google-shopping] quota exhausted:', err.message);
          return createEmptyResponse(rawInput, QUOTA_MESSAGE, startTime, constraints);
        }
        console.error('[google-shopping] failed, falling back to Tavily web search:', err?.message);
      }
    }

    // FALLBACK: Tavily web search (less reliable; used only without SerpApi or when it fails)
    const tavilyApiKey = process.env.TAVILY_API_KEY?.trim();
    if (!tavilyApiKey) {
      return createEmptyResponse(
        rawInput,
        isGoogleShoppingConfigured()
          ? 'Google Shopping search failed just now. Please try again in a moment.'
          : 'No product search is configured. Add SERPAPI_API_KEY (Google Shopping) to .env.local.',
        startTime,
        constraints
      );
    }
    return await runTavilyFallback({ rawInput, parsedIntent, tavilyApiKey, geminiApiKey, imagePreviewUrl, constraints, startTime, onProgress });
  } catch (error: any) {
    console.error('Tavily + Gemini Pipeline Error:', error);
    return createEmptyResponse(
      rawInput,
      `Web search error: ${error.message || 'Unable to retrieve live web results.'}`,
      startTime,
      constraints
    );
  }
}
