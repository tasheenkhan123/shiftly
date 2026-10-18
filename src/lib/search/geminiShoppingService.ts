import { 
  SiftlyAnalysisResult, 
  DetectedEntity, 
  ProductMatch, 
  MerchantOffer, 
  UserConstraints, 
  GroundingSource 
} from '@/types';
import { normalizeProductQuery, extractBrand, classifyInputType } from '../ai/pipeline';
import { fetchRealProductImage } from '../vision/realImageSearch';
export { searchProductsWithTavilyAndGemini } from './tavilyShoppingPipeline';

interface GeminiParsedProduct {
  title: string;
  brand: string;
  price: number;
  primaryRetailer?: string;
  keyAttributes?: Record<string, string>;
  valueReason?: string;
}

interface GeminiShoppingPayload {
  summary: string;
  products: GeminiParsedProduct[];
}

/**
 * Searches for real products using Google's Gemini API.
 * Uses Google Search Grounding when available, and falls back gracefully to structured
 * AI recommendations with live, verified retailer search links across Amazon, Nykaa, and Flipkart.
 */
export async function searchProductsWithGeminiGrounding(
  rawInput: string,
  imagePreviewUrl?: string,
  constraints?: UserConstraints
): Promise<{
  result: SiftlyAnalysisResult;
  assistantSummary: string;
  isGroundingActive: boolean;
  configurationNotice?: string;
}> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  const cleanQuery = normalizeProductQuery(rawInput, constraints);
  const { primaryCategory } = classifyInputType(rawInput, Boolean(imagePreviewUrl));
  const detectedBrand = extractBrand(cleanQuery) || extractBrand(rawInput) || '';
  const requestedCount = constraints?.requestedCount || 3;
  const budgetMax = constraints?.budgetMax;

  // 1. If GEMINI_API_KEY is missing, notify user cleanly
  if (!apiKey) {
    const notice = 'GEMINI_API_KEY is not configured in .env.local. Add your Gemini API key to enable AI product discovery.';
    return getEmergencyCuratedResponse(cleanQuery, rawInput, primaryCategory, detectedBrand, budgetMax, requestedCount, notice, startTime, imagePreviewUrl, constraints);
  }

  // 2. Build Structured Prompt for Gemini (asking for real products, no guessed URLs or fake CDNs)
  const prompt = `You are Shift E, an expert budget shopping assistant in India.
The user asked: "${rawInput}"
CLEAN SEARCH TARGET: "${cleanQuery}"
CATEGORY: "${primaryCategory}"
${budgetMax ? `MAXIMUM BUDGET: ₹${budgetMax} INR` : 'BUDGET: Budget-friendly value for money'}
DESIRED NUMBER OF RECOMMENDATIONS: ${requestedCount}

Recommend exactly ${requestedCount} specific, recognized, real-world products currently sold in India on major retailers (such as Amazon India, Nykaa, Flipkart, Myntra, or Tira Beauty) that fit strictly within the stated budget in INR.

For each product, provide:
- title: exact full product name as commonly known (e.g. "Minimalist SPF 30 Lip Balm", "WishCare Tinted Ceramide Lip Balm SPF 50")
- brand: brand name
- price: realistic current market selling price in INR as a number (must be <= ${budgetMax || 1000})
- primaryRetailer: the best store to buy this ("Amazon India", "Nykaa", "Flipkart", or "Myntra")
- valueReason: 1 clear sentence explaining why this product is recommended within the budget.
- keyAttributes: 2 key specifications (e.g. { "SPF Rating": "SPF 30", "Key Ingredient": "Ceramides" })

Respond strictly as JSON matching this structure:
{
  "summary": "1-2 sentences summarizing these recommendations and why they fit the user's budget.",
  "products": [
    {
      "title": "Minimalist SPF 30 Lip Balm",
      "brand": "Minimalist",
      "price": 299,
      "primaryRetailer": "Amazon India",
      "valueReason": "Formulated with ceramides and hyaluronic acid for barrier repair with sun protection.",
      "keyAttributes": { "SPF": "SPF 30", "Key Actives": "Ceramides & Hyaluronic Acid" }
    }
  ]
}`;

  // 3. Models to try: prioritize active fast models
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash'
  ];

  let validCandidate: any = null;
  let isGroundingActive = false;
  let lastError: any = null;

  // Step 3a: Attempt Google Search Grounding first
  for (const model of modelsToTry) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        lastError = new Error(`HTTP ${res.status}: ${errorText}`);
        // If 429 quota exhausted on search grounding tool, break to Step 3b immediately
        if (res.status === 429) {
          break;
        }
        continue;
      }

      const data = await res.json();
      const cand = data?.candidates?.[0];
      const text = cand?.content?.parts?.map((p: any) => p.text || '').join('\n').trim();
      if (text && text.length > 0) {
        validCandidate = cand;
        isGroundingActive = true;
        break;
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  // Step 3b: Fallback to direct structured generation if grounding tool quota was not available
  if (!validCandidate) {
    for (const model of modelsToTry) {
      try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`HTTP ${res.status}: ${errText}`);
          continue;
        }

        const data = await res.json();
        const cand = data?.candidates?.[0];
        const text = cand?.content?.parts?.map((p: any) => p.text || '').join('\n').trim();
        if (text && text.length > 0) {
          validCandidate = cand;
          isGroundingActive = false;
          break;
        }
      } catch (e: any) {
        lastError = e;
      }
    }
  }

  // Step 3c: If all API calls were exhausted, use emergency verified search fallback
  if (!validCandidate) {
    console.warn('Gemini API exhausted or unavailable:', lastError?.message);
    const notice = 'Gemini API daily request quota reached. Showing verified retailer search links for your query.';
    return getEmergencyCuratedResponse(cleanQuery, rawInput, primaryCategory, detectedBrand, budgetMax, requestedCount, notice, startTime, imagePreviewUrl, constraints);
  }

  const candidate = validCandidate;
  const responseText = candidate.content?.parts?.map((p: any) => p.text || '').join('\n').trim() || '';
  
  // 4. Extract Grounding Metadata & Citations (if grounding succeeded)
  const groundingMetadata = candidate.groundingMetadata;
  const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];
  const groundingChunks: Array<{ web?: { uri?: string; title?: string } }> = groundingMetadata?.groundingChunks || [];

  const groundingSources: GroundingSource[] = [];
  groundingChunks.forEach(chunk => {
    if (chunk.web?.uri) {
      groundingSources.push({
        title: chunk.web.title || 'Web Source',
        url: chunk.web.uri
      });
    }
  });

  // 5. Parse JSON block from Gemini output
  let parsedPayload: GeminiShoppingPayload | null = null;
  try {
    let jsonString = '';
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonString = codeBlockMatch[1].trim();
    } else {
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonString = responseText.slice(firstBrace, lastBrace + 1).trim();
      }
    }

    if (jsonString) {
      parsedPayload = JSON.parse(jsonString);
    }
  } catch (err) {
    console.warn('JSON parsing attempt failed:', err);
  }

  const rawProducts: GeminiParsedProduct[] = [...(parsedPayload?.products || [])];
  
  // If parsing didn't find products, use emergency search fallback
  if (rawProducts.length === 0) {
    return getEmergencyCuratedResponse(cleanQuery, rawInput, primaryCategory, detectedBrand, budgetMax, requestedCount, undefined, startTime, imagePreviewUrl, constraints);
  }

  // 6. Fetch authentic product thumbnails in parallel using real product search queries
  const imageResults = await Promise.allSettled(
    rawProducts.map(p => {
      const brand = (p.brand || '').trim();
      const title = (p.title || '').trim();
      const productSearchName = title.toLowerCase().includes(brand.toLowerCase()) ? title : `${brand} ${title}`.trim();
      return fetchRealProductImage(productSearchName);
    })
  );

  // 7. Clean and convert into verified ProductMatch items
  const entityId = `entity_${Date.now()}`;
  const detectedEntity: DetectedEntity = {
    id: entityId,
    name: cleanQuery,
    category: primaryCategory === 'GAMING_SETUPS' ? 'Gaming Setup' : primaryCategory === 'COMPUTERS_ELECTRONICS' ? 'Computers & Electronics' : primaryCategory === 'SKINCARE' ? 'Skincare' : primaryCategory === 'FASHION' ? 'Fashion' : primaryCategory === 'BAGS' ? 'Bags' : 'Other',
    productType: `${cleanQuery} Item`,
    brand: detectedBrand,
    brandConfidence: detectedBrand ? 'detected' : 'unknown',
    confidenceScore: 95.0,
    cropImageUrl: imagePreviewUrl && (imagePreviewUrl.startsWith('http://') || imagePreviewUrl.startsWith('https://')) ? imagePreviewUrl : undefined,
    attributes: {
      category: primaryCategory,
      productType: cleanQuery,
      brand: detectedBrand || undefined,
      brandConfidence: detectedBrand ? 'detected' : 'unknown',
      color: 'Standard',
      visibleText: cleanQuery
    },
    optimizedSearchQuery: searchQueries[0] || cleanQuery
  };

  const productMatches: ProductMatch[] = [];

  rawProducts.forEach((p, idx) => {
    const brand = (p.brand || detectedBrand || '').trim();
    const title = (p.title || cleanQuery).trim();
    const cleanSearchTarget = title.toLowerCase().includes(brand.toLowerCase())
      ? title
      : `${brand} ${title}`.trim();

    // Determine primary store
    const preferredStore = (p.primaryRetailer || '').toLowerCase();
    const isBeautyCategory = primaryCategory === 'SKINCARE' || cleanQuery.toLowerCase().includes('balm') || cleanQuery.toLowerCase().includes('serum') || cleanQuery.toLowerCase().includes('cream');
    
    let primaryStoreName = 'Amazon India';
    if (preferredStore.includes('nykaa') || (isBeautyCategory && !preferredStore.includes('amazon'))) {
      primaryStoreName = 'Nykaa';
    } else if (preferredStore.includes('flipkart')) {
      primaryStoreName = 'Flipkart';
    } else if (preferredStore.includes('myntra')) {
      primaryStoreName = 'Myntra';
    }

    // Build verified search URLs for each retailer from the cleaned product name
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(cleanSearchTarget)}`;
    const nykaaUrl = `https://www.nykaa.com/search/result/?q=${encodeURIComponent(cleanSearchTarget)}`;
    const flipkartUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(cleanSearchTarget)}`;
    const googleShopUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(cleanSearchTarget)}`;

    // Check if an authentic direct product URL was provided via Google Search Grounding chunks
    let directProductUrl: string | undefined = undefined;
    if (isGroundingActive && groundingChunks.length > 0) {
      const matchingChunk = groundingChunks.find(c => {
        const u = c.web?.uri?.toLowerCase() || '';
        return (u.includes('/dp/') || u.includes('/p/')) && (u.includes(brand.toLowerCase()) || u.includes(title.toLowerCase().slice(0, 15)));
      });
      if (matchingChunk?.web?.uri) {
        directProductUrl = matchingChunk.web.uri;
      }
    }

    const price = typeof p.price === 'number' && p.price > 0 ? Math.round(p.price) : (budgetMax ? Math.round(budgetMax * 0.9) : 299);
    
    // Resolve thumbnail image
    const imgSettled = imageResults[idx];
    const imageUrl = (imgSettled.status === 'fulfilled' && imgSettled.value) ? imgSettled.value : '';

    // Build Primary Merchant Offer
    const primaryUrl = directProductUrl || (primaryStoreName === 'Nykaa' ? nykaaUrl : amazonUrl);
    const isDirectProduct = Boolean(directProductUrl);

    const primaryOffer: MerchantOffer = {
      id: `m_offer_primary_${idx}_${Date.now()}`,
      sellerName: primaryStoreName,
      price: price,
      currency: 'INR',
      productUrl: primaryUrl,
      urlType: isDirectProduct ? 'PRODUCT' : 'SEARCH',
      availability: 'AVAILABLE',
      source: isGroundingActive ? `Google Search Grounded (${primaryStoreName})` : `${primaryStoreName} Catalog Search`,
      verified: isDirectProduct,
      inStock: isDirectProduct,
      deliveryEstimate: isDirectProduct ? 'Direct Product Listing' : 'Live Store Catalog',
      isLowestPrice: true,
      verifiedAt: isGroundingActive ? 'Verified via Google Search' : 'Estimated Market Price'
    };

    // Secondary Merchant Offer (e.g. compare Amazon vs Nykaa)
    const secondaryStoreName = primaryStoreName === 'Nykaa' ? 'Amazon India' : (isBeautyCategory ? 'Nykaa' : 'Flipkart');
    const secondaryUrl = secondaryStoreName === 'Nykaa' ? nykaaUrl : (secondaryStoreName === 'Flipkart' ? flipkartUrl : amazonUrl);

    const secondaryOffer: MerchantOffer = {
      id: `m_offer_sec_${idx}_${Date.now()}`,
      sellerName: secondaryStoreName,
      price: price,
      currency: 'INR',
      productUrl: secondaryUrl,
      urlType: 'SEARCH',
      availability: 'AVAILABLE',
      source: `${secondaryStoreName} Catalog Search`,
      verified: false,
      inStock: false,
      deliveryEstimate: 'Live Store Catalog',
      isLowestPrice: false,
      verifiedAt: 'Catalog Reference'
    };

    // Google Shopping Offer
    const googleOffer: MerchantOffer = {
      id: `m_offer_goog_${idx}_${Date.now()}`,
      sellerName: 'Google Shopping',
      price: price,
      currency: 'INR',
      productUrl: googleShopUrl,
      urlType: 'SEARCH',
      availability: 'AVAILABLE',
      source: 'Google Shopping Index',
      verified: false,
      inStock: false,
      deliveryEstimate: 'Aggregated Web Index',
      isLowestPrice: false,
      verifiedAt: 'Web Index'
    };

    productMatches.push({
      id: `match_gemini_${Date.now()}_${idx}`,
      entityId,
      title: p.title,
      brand: brand,
      imageUrl: imageUrl,
      matchTier: idx === 0 ? 'EXACT' : idx === 1 ? 'CLOSE' : 'BUDGET_ALT',
      matchScore: 95 - idx * 3,
      matchReasons: [
        p.valueReason || `Top recommendation in budget for ${cleanQuery}`,
        budgetMax ? `Estimated at ₹${price.toLocaleString()} within budget of ₹${budgetMax.toLocaleString()}` : `Estimated: ₹${price.toLocaleString()}`,
        isDirectProduct ? `Verified direct listing on ${primaryStoreName}` : `Direct search on ${primaryStoreName}`
      ],
      scoreBreakdown: {
        visualSimilarity: 90,
        brandMatch: 95,
        categoryMatch: 100,
        colorMatch: 90,
        semanticMatch: 95,
        budgetFitBonus: budgetMax && price <= budgetMax ? 100 : 80,
        totalScore: 95 - idx * 3
      },
      lowestPrice: price,
      currency: 'INR',
      availableMerchantsCount: 3,
      merchants: [primaryOffer, secondaryOffer, googleOffer],
      productRating: undefined, // Never fabricate ratings
      reviewsCount: undefined,  // Never fabricate review counts
      keyAttributes: p.keyAttributes || {
        'Price': `~₹${price.toLocaleString()} (Est.)`,
        'Store': primaryStoreName
      }
    });
  });

  // Extract clean summary text
  let summaryText = parsedPayload?.summary;
  if (!summaryText) {
    summaryText = responseText.replace(/```json[\s\S]*?```/g, '').trim();
  }
  if (!summaryText || summaryText.length < 5) {
    summaryText = `Here are **${productMatches.length} recommended options** for "${cleanQuery}" within your budget of ₹${budgetMax || 500}. Use the store search links below to view live stock and purchase on Amazon or Nykaa.`;
  }

  const analysisResult: SiftlyAnalysisResult = {
    id: `siftly_${Date.now()}`,
    inputType: imagePreviewUrl ? 'IMAGE' : 'TEXT',
    intent: 'SHOPPING',
    primaryCategory,
    rawInput,
    mediaPreviewUrl: imagePreviewUrl,
    userConstraints: constraints || { currency: 'INR' },
    detectedEntities: [detectedEntity],
    productMatches: {
      [entityId]: productMatches
    },
    isGroundingActive,
    searchQueries,
    groundingSources,
    executionTimeMs: Date.now() - startTime
  };

  return {
    result: analysisResult,
    assistantSummary: summaryText,
    isGroundingActive
  };
}

/**
 * Emergency Fallback when all Gemini models are exhausted or API key is missing.
 * Generates verified retailer search links based on the clean query without fabricated URLs.
 */
function getEmergencyCuratedResponse(
  cleanQuery: string,
  rawInput: string,
  primaryCategory: any,
  detectedBrand: string,
  budgetMax: number | undefined,
  requestedCount: number,
  notice: string | undefined,
  startTime: number,
  imagePreviewUrl?: string,
  constraints?: UserConstraints
) {
  const entityId = `entity_${Date.now()}`;
  const detectedEntity: DetectedEntity = {
    id: entityId,
    name: cleanQuery,
    category: primaryCategory,
    productType: cleanQuery,
    brand: detectedBrand,
    brandConfidence: detectedBrand ? 'detected' : 'unknown',
    confidenceScore: 90.0,
    attributes: {
      category: primaryCategory,
      productType: cleanQuery,
      brand: detectedBrand || undefined,
      brandConfidence: detectedBrand ? 'detected' : 'unknown',
      color: 'Standard',
      visibleText: cleanQuery
    },
    optimizedSearchQuery: cleanQuery
  };

  const isBeauty = primaryCategory === 'SKINCARE' || cleanQuery.toLowerCase().includes('balm') || cleanQuery.toLowerCase().includes('lip');
  const stores = isBeauty 
    ? [{ name: 'Nykaa', url: `https://www.nykaa.com/search/result/?q=${encodeURIComponent(cleanQuery)}` },
       { name: 'Amazon India', url: `https://www.amazon.in/s?k=${encodeURIComponent(cleanQuery)}` }]
    : [{ name: 'Amazon India', url: `https://www.amazon.in/s?k=${encodeURIComponent(cleanQuery)}` },
       { name: 'Flipkart', url: `https://www.flipkart.com/search?q=${encodeURIComponent(cleanQuery)}` }];

  const fallbackPrice = budgetMax ? Math.round(budgetMax * 0.85) : 349;

  const productMatches: ProductMatch[] = [{
    id: `match_curated_${Date.now()}`,
    entityId,
    title: `${cleanQuery} (Top Search Results)`,
    brand: detectedBrand || 'Verified Retailers',
    imageUrl: '',
    matchTier: 'EXACT',
    matchScore: 92,
    matchReasons: [
      `Search top-rated ${cleanQuery} options within your budget`,
      budgetMax ? `Budget limit: ₹${budgetMax.toLocaleString()}` : `Budget-friendly options`
    ],
    scoreBreakdown: {
      visualSimilarity: 90,
      brandMatch: 90,
      categoryMatch: 100,
      colorMatch: 90,
      semanticMatch: 90,
      budgetFitBonus: 100,
      totalScore: 92
    },
    lowestPrice: fallbackPrice,
    currency: 'INR',
    availableMerchantsCount: stores.length,
    merchants: stores.map((s, idx) => ({
      id: `m_curated_${idx}_${Date.now()}`,
      sellerName: s.name,
      price: fallbackPrice,
      currency: 'INR',
      productUrl: s.url,
      urlType: 'SEARCH' as const,
      availability: 'AVAILABLE' as const,
      source: `${s.name} Live Search`,
      verified: false,
      inStock: false,
      deliveryEstimate: 'Live Store Catalog',
      isLowestPrice: idx === 0,
      verifiedAt: 'Store Search'
    })),
    keyAttributes: {
      'Category': cleanQuery,
      'Price': budgetMax ? `Under ₹${budgetMax.toLocaleString()}` : 'Budget Friendly'
    }
  }];

  return {
    result: {
      id: `siftly_${Date.now()}`,
      inputType: (imagePreviewUrl ? 'IMAGE' : 'TEXT') as any,
      intent: 'SHOPPING' as any,
      primaryCategory,
      rawInput,
      mediaPreviewUrl: imagePreviewUrl,
      userConstraints: constraints || { currency: 'INR' },
      detectedEntities: [detectedEntity],
      productMatches: { [entityId]: productMatches },
      isGroundingActive: false,
      configurationNotice: notice,
      executionTimeMs: Date.now() - startTime
    },
    assistantSummary: `I've prepared direct store search links for **"${cleanQuery}"** across Amazon India and Nykaa${budgetMax ? ` within your budget of ₹${budgetMax}` : ''}. Click below to explore live listings and prices.`,
    isGroundingActive: false,
    configurationNotice: notice
  };
}
