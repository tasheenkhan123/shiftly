import { NextRequest, NextResponse } from 'next/server';
import { executeSiftlyAnalysis, parseUserConstraints, classifyInputType } from '@/lib/ai/pipeline';
import { searchProductsWithTavilyAndGemini } from '@/lib/search/tavilyShoppingPipeline';
import { buildRealGoogleQueries } from '@/lib/vision/realImageSearch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, imagePreviewUrl, conversationHistory } = body;

    if (!input && !imagePreviewUrl) {
      return NextResponse.json(
        { error: 'Please provide text, a link, or an image to analyze.' },
        { status: 400 }
      );
    }

    const effectiveQuery = input && input.trim().length > 0 ? input.trim() : 'Find the product in this screenshot';
    const constraints = parseUserConstraints(effectiveQuery);
    const { intent } = classifyInputType(effectiveQuery, Boolean(imagePreviewUrl));

    let result;
    let customSummary = '';

    if (intent === 'RECIPE') {
      result = await executeSiftlyAnalysis(effectiveQuery, imagePreviewUrl);
    } else {
      // Execute live web product search via Tavily + Gemini with conversational intelligence
      const shoppingSearch = await searchProductsWithTavilyAndGemini(
        effectiveQuery, 
        imagePreviewUrl, 
        constraints,
        conversationHistory
      );
      result = shoppingSearch.result;
      customSummary = shoppingSearch.assistantSummary;
    }

    const cleanSearchTarget = constraints.normalizedProductQuery || result.detectedEntities[0]?.name || effectiveQuery;
    const googleData = buildRealGoogleQueries(cleanSearchTarget, imagePreviewUrl);

    return NextResponse.json({
      ...result,
      customSummary,
      googleShoppingUrl: googleData.googleShoppingUrl,
      googleLensUrl: googleData.googleLensUrl,
      directWebResults: googleData.directWebResults,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Siftly API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred during discovery analysis.' },
      { status: 500 }
    );
  }
}
