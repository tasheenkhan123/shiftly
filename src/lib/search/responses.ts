/** Honest empty responses (no products found, configuration missing, errors). Never invents products. */
import type { DetectedEntity, GroundingSource, UserConstraints } from '@/types';
import type { TavilySearchApiResponse } from '@/lib/search/types';

/**
 * Creates an honest empty response when no products are found or an error occurs.
 * Never invents mock or synthetic products.
 */
export function createEmptyResponse(
  rawInput: string,
  message: string,
  startTime: number,
  constraints?: UserConstraints,
  tavilyData?: TavilySearchApiResponse
) {
  const entityId = `entity_${Date.now()}`;
  const detectedEntity: DetectedEntity = {
    id: entityId,
    name: rawInput,
    category: 'Other',
    productType: 'Search Query',
    brand: '',
    brandConfidence: 'unknown',
    confidenceScore: 50.0,
    attributes: {
      category: 'UNKNOWN',
      productType: rawInput,
      brandConfidence: 'unknown',
      color: 'Standard',
      visibleText: rawInput
    },
    optimizedSearchQuery: rawInput
  };

  const groundingSources: GroundingSource[] = (tavilyData?.results || []).slice(0, 5).map(r => ({
    title: r.title,
    url: r.url
  }));

  return {
    result: {
      id: `siftly_${Date.now()}`,
      inputType: 'TEXT' as const,
      intent: 'SHOPPING' as const,
      primaryCategory: 'UNKNOWN' as const,
      rawInput,
      userConstraints: constraints || { currency: 'INR' },
      detectedEntities: [detectedEntity],
      productMatches: {}, // ZERO FABRICATED PRODUCTS
      isGroundingActive: Boolean(tavilyData?.results && tavilyData.results.length > 0),
      searchQueries: [rawInput],
      groundingSources,
      executionTimeMs: Date.now() - startTime
    },
    assistantSummary: message,
    isGroundingActive: Boolean(tavilyData?.results && tavilyData.results.length > 0)
  };
}
