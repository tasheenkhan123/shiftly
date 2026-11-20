/**
 * Step 1 of every search: understand what the customer wants (Gemini), including images,
 * follow-ups vs new searches, gifts, budget scope, and personalisation from the saved profile.
 */
import type { UserConstraints } from '@/types';
import { callGeminiJson, imagePartFromDataUrl } from '@/lib/ai/gemini';
import {
  CATEGORIES,
  findBrandGroups,
  getCategory,
  describePreferences,
  type CategoryId,
  type PreferenceProfile,
} from '@/lib/categories';
import type { PersonalizationInput, ConversationTurn, ParsedShoppingIntent } from '@/lib/search/types';

/**
 * Step 1: Gemini Conversational & Solution-Aware Intent Understanding
 * - Understands intent, context, purpose, constraints, preferences, and implied requirements.
 * - Distinguishes complete setups/bundles (total budget allocation) from individual products (budget per product).
 * - Maintains conversational memory across follow-ups ("make it cheaper", "oily skin", "give me 2 more options").
 * - Recommends first; asks at most ONE clarification question only when genuinely essential.
 */
export async function understandShoppingQuery(
  rawInput: string,
  geminiApiKey: string,
  constraints?: UserConstraints,
  conversationHistory?: ConversationTurn[],
  imageDataUrl?: string,
  personal: PersonalizationInput = {}
): Promise<ParsedShoppingIntent> {
  const image = imagePartFromDataUrl(imageDataUrl);
  const profileText = personal.forSomeoneElse
    ? 'NOT USED: the customer said they are shopping for someone else'
    : personal.profile && Object.keys(personal.profile).length
      ? JSON.stringify(personal.profile)
      : 'none saved';
  const categoryFieldsText = CATEGORIES.filter(c => c.preferenceFields.length)
    .map(c => `- ${c.id}: ${c.preferenceFields.map(f => f.key + (f.options ? ` (${f.options.join('/')})` : '')).join(', ')}`)
    .join('\n');
  // Format conversational context
  let historyText = '';
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    historyText = conversationHistory.map(h => {
      let line = `${h.sender === 'user' ? 'Customer' : 'Assistant'}: "${h.text}"`;
      if (Array.isArray(h.previousProducts) && h.previousProducts.length > 0) {
        line += `\n(Previously recommended products: ${h.previousProducts.map(p => `${p.brand} ${p.title} - ₹${p.price}`).join(', ')})`;
      }
      return line;
    }).join('\n');
  }

  // Regex check for requested count
  const countMatch = rawInput.match(/\b(?:find|give|recommend|show|top)\s+([1-9]|10)\b/i) ||
    rawInput.match(/\b([1-9]|10)\s+(?:products|items|recommendations|options|balms|keyboards|shoes|watches|laptops|phones|mics|mice)\b/i);
  const regexExtractedCount = countMatch ? parseInt(countMatch[1], 10) : 3;

  const prompt = `You are an intelligent e-commerce shopping reasoning assistant for India.
Your goal is to understand what the customer ACTUALLY wants to accomplish, taking into account their intent, context, purpose, constraints, preferences, and implied requirements.

User Query: "${rawInput}"
${personal.categoryHint ? `The customer selected the category: ${personal.categoryHint}.\n` : ''}
CUSTOMER PROFILE (preferences saved from earlier chats, JSON by category): ${profileText}
- Apply saved preferences that are relevant to this request (e.g. saved skinType for any skincare search, saved shoeSize for footwear).
- Anything the customer says now overrides the saved profile.
- "shopsFor" (Women's / Men's) is only a DEFAULT for gender-specific products (clothes, shoes, fragrances, watches). If this request says otherwise ("perfume for men", "for my brother"), follow the request. Never use it for gender-neutral products.
- GIFTS / SOMEONE ELSE: if the customer is shopping for another person ("gift for my dad", "for my sister", "for my boyfriend"), set "forSomeoneElse": true and DO NOT apply the saved profile (their skin type, sizes, shopsFor are about themselves, not the other person).
${image ? `
AN IMAGE IS ATTACHED (a screenshot or photo from the customer). Look at it carefully:
- Identify the main product shown: brand (read any logo or label text), exact product name/model, product type, colour, size/variant.
- Unless the customer asks for something else (e.g. "cheaper alternatives", "similar"), they want to buy THIS product: set cleanTarget and shoppingQuery to find this exact product (brand + product name + key variant).
- If it is a screenshot of a product page or social post, use the product name/price text visible in it.
- If no brand is visible, describe the product precisely (type, colour, material, style) so similar items can be found.
- Put a one-sentence description of what you see in "imageDescription".
- Set needsClarification to false unless the image shows no product at all.
` : ''}
Recent Conversation History:
${historyText || "None (New conversation)"}

CRITICAL REASONING RULES:
1. COMPLETE SETUP / BUNDLE vs INDIVIDUAL PRODUCT:
   - If the user asks for a complete setup, routine, or bundle (e.g. "complete gaming setup under 1 lakh", "streaming setup under 15k", "complete skincare routine under 1500", "home office setup under 50k"):
     - Set "isBundleOrSetup": true.
     - Treat the stated budget as the TOTAL BUDGET for the complete solution, NOT for each individual component!
     - Break down the solution into the practical, compatible components needed for a working setup.
     - Allocate a realistic portion of the total budget to each component so their combined sum stays within the total budget!
     - Generate a targeted search query for each component.
   - If the user asks for an INDIVIDUAL PRODUCT (e.g. "moisturizer under 500", "mechanical keyboard under 2500", "running shoes under 3000"):
     - Set "isBundleOrSetup": false.
     - Apply the budget to EACH recommended product. Do NOT confuse a single product (like a moisturizer under 500) with a complete routine.
     - Default requestedCount is 3.

2. CONVERSATIONAL UNDERSTANDING & FOLLOW-UPS:
   - FIRST decide: is this a FOLLOW-UP that modifies the previous search, or a NEW SEARCH?
     - NEW SEARCH = it names a different product, brand, scent, or category than before (e.g. after "men's office perfume", the message "fruity citrus mist from Bath & Body Works" is a NEW search).
     - For a NEW SEARCH, do NOT carry over the previous budget, gender, occasion, or other details. Use only what this message says (plus relevant saved profile facts like skin type).
   - If the user query is a follow-up (e.g. "make it cheaper", "I have oily skin", "give me two more options", "add a monitor", "fragrance-free", "in mists", "under 1000"):
     - Maintain the context of the previous conversation (category, target item, previous products, previous budget).
     - "make it cheaper": reduce the budget and search for more affordable/budget-friendly alternatives for the same product or setup.
     - "I have oily skin" / "fragrance-free": apply this preference to the existing product or setup.
     - "give me two more options": set requestedCount: 2, and list previous product titles in excludedProductTitles so they are not repeated.
     - "add a [component]": update the setup/bundle to include this new component and allocate budget.

3. RECOMMEND FIRST; DO NOT BEHAVE LIKE A QUESTIONNAIRE:
   - If there is enough information to make useful recommendations, set "needsClarification": false and recommend immediately.
   - NEVER ask for optional preferences (e.g. skin type, switch color, favorite brand, gaming genres) before providing recommendations. Make reasonable, balanced assumptions (e.g. top-rated all-rounder, most popular, best value) and proceed.
   - Set "needsClarification": true ONLY if a missing detail is GENUINELY ESSENTIAL to making any recommendation at all (e.g. user just says "help me buy something" or "recommend something" with zero product, category, or purpose mentioned).
   - If needsClarification is true, provide AT MOST ONE short, friendly clarification question.
   - Never repeatedly ask for information already provided.

4. REQUESTED COUNT:
   - For individual products: exactly 3 by default, or the exact number if user specified (e.g. "find 5...", "give me 2 more...").

Output strictly valid JSON matching this schema:
{
  "isBundleOrSetup": boolean,
  "bundleComponents": [
    {
      "componentName": "Component name (e.g. Gaming PC, Gaming Monitor, Mechanical Keyboard, Gaming Mouse)",
      "searchQuery": "Search query designed to find this component in India (e.g. 'best prebuilt gaming pc rtx 3060 under 65000 India Amazon Flipkart')",
      "shoppingQuery": "Short Google Shopping query for this component, 2-6 words, product type plus key specs, no store names, no budget (e.g. 'gaming pc rtx 3060')",
      "allocatedBudget": number in INR
    }
  ],
  "cleanTarget": "clean target item or setup name",
  "searchQuery": "main search query if not bundle",
  "shoppingQuery": "Short Google Shopping query, 2-6 words: product type plus ONLY the attributes/preferences the customer actually stated (e.g. 'salicylic acid face wash oily skin'). Never add features they did not ask for. No store names, no budget, no words like best/buy/under.",
  "category": "Skincare" | "Computers & Electronics" | "Fashion" | "Bags" | "Gaming Setup" | "Home & Lifestyle" | "Other",
  "budgetMax": number in INR or null,
  "totalBudget": number in INR or null,
  "requestedCount": number,
  "preferredBrands": [],
  "priorities": [],
  "needsClarification": boolean,
  "clarificationQuestion": string or null,
  "appliedPreferences": ["preference1", "preference2"],
  "excludedProductTitles": ["title1", "title2"],
  "imageDescription": "what the attached image shows, or null if no image",
  "categoryId": "one of: skincare | makeup | footwear | fashion | electronics | perfumes | other",
  "preferences": { "fieldKey": "value" },
  "assumptions": "one short sentence about any important assumption you made (e.g. 'I treated ₹3,000 as the budget for each product'), or null",
  "forSomeoneElse": boolean,
  "forWho": "who it's for if someone else, e.g. 'Dad', 'Sister', or null",
  "productType": "the plain product type only, 1-4 words, no brand, no scent/colour/feature words (e.g. 'fine fragrance mist', 'face wash', 'running shoes', 'wireless earbuds')",
  "suggestedProducts": ["up to 4 SPECIFIC product names you, as an expert, would recommend for this exact request, e.g. 'Bath & Body Works Gingham Fresh Fine Fragrance Mist'. Only real products you are confident exist and are sold in India. [] if the request is generic or you are unsure."],
  "followUpQuestion": "one short question that would help narrow the picks next time (e.g. 'Do you prefer juicy fruity like pear and citrus, or sweet fruity like strawberry and peach?'), or null"
}

PREFERENCES TO REMEMBER ("preferences"):
- Only include facts the customer stated about THEMSELVES in this conversation (not the saved profile, not guesses).
- Use these field keys for the chosen categoryId:
${categoryFieldsText}
- Example: "I have oily skin and hate fragrance" -> {"skinType":"Oily","avoid":"Fragrance"}. "size 9 running shoes" -> {"shoeSize":"UK 9","use":"Running"}.
- Use {} if nothing personal was stated.

BUDGET SCOPE:
- "under 3000" for one product type = per product. For a routine/setup/"products" plural without a clear per-item meaning, decide sensibly and explain the choice in "assumptions".`;

  const parsed = await callGeminiJson<any>(prompt, geminiApiKey, { label: 'intent', hedgeAfterMs: image ? 6000 : 4000, totalTimeoutMs: 16000, image });
  if (parsed && typeof parsed === 'object') {
    const cleanTarget = parsed.cleanTarget || rawInput.replace(/find|three|best|the|buy|under|\d+|₹/gi, '').trim() || 'product';

    let finalCount = 3;
    if (typeof parsed.requestedCount === 'number' && parsed.requestedCount > 0) {
      finalCount = Math.min(10, Math.max(1, parsed.requestedCount));
    } else if (regexExtractedCount > 0) {
      finalCount = Math.min(10, Math.max(1, regexExtractedCount));
    }

    return {
      isBundleOrSetup: Boolean(parsed.isBundleOrSetup),
      bundleComponents: Array.isArray(parsed.bundleComponents) ? parsed.bundleComponents : [],
      cleanTarget,
      searchQuery: parsed.searchQuery || `best ${cleanTarget} ${parsed.budgetMax ? 'under ' + parsed.budgetMax : ''} buy online India price Amazon Nykaa Flipkart`,
      shoppingQuery: (typeof parsed.shoppingQuery === 'string' && parsed.shoppingQuery.trim()) || cleanTarget,
      category: parsed.category || 'Other',
      budgetMax: typeof parsed.budgetMax === 'number' ? parsed.budgetMax : (constraints?.budgetMax || null),
      totalBudget: typeof parsed.totalBudget === 'number' ? parsed.totalBudget : (constraints?.budgetMax || null),
      requestedCount: finalCount,
      preferredBrands: Array.isArray(parsed.preferredBrands) ? parsed.preferredBrands : [],
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      needsClarification: Boolean(parsed.needsClarification),
      clarificationQuestion: parsed.clarificationQuestion || null,
      appliedPreferences: Array.isArray(parsed.appliedPreferences) ? parsed.appliedPreferences : [],
      excludedProductTitles: Array.isArray(parsed.excludedProductTitles) ? parsed.excludedProductTitles : [],
      imageDescription: typeof parsed.imageDescription === 'string' ? parsed.imageDescription : null,
      ...personalise(parsed, rawInput, conversationHistory, personal),
    };
  }

  // Safe Fallback Parsing
  const isSetupOrBundle = /complete.*(setup|routine|bundle)|gaming setup|pc setup|workstation/i.test(rawInput);
  const cleanFallbackTarget = rawInput.replace(/find|three|best|the|buy|under|\d+|₹/gi, '').trim() || 'product';
  return {
    isBundleOrSetup: isSetupOrBundle,
    bundleComponents: [],
    cleanTarget: cleanFallbackTarget,
    shoppingQuery: cleanFallbackTarget,
    searchQuery: `best ${cleanFallbackTarget} ${constraints?.budgetMax ? 'under ' + constraints.budgetMax : ''} buy online India price Amazon Flipkart Nykaa`,
    category: 'Other',
    budgetMax: constraints?.budgetMax || null,
    totalBudget: constraints?.budgetMax || null,
    requestedCount: regexExtractedCount || constraints?.requestedCount || 3,
    preferredBrands: [],
    priorities: [],
    needsClarification: false,
    clarificationQuestion: null,
    appliedPreferences: [],
    excludedProductTitles: [],
    ...personalise({}, rawInput, conversationHistory, personal),
  };
}

/** Category, remembered preferences, brand filter (incl. groups like K-beauty) and assumptions */
export function personalise(
  parsed: any,
  rawInput: string,
  history: ConversationTurn[] | undefined,
  personal: PersonalizationInput
): Pick<
  ParsedShoppingIntent,
  | 'categoryId'
  | 'learnedPreferences'
  | 'activePreferences'
  | 'brandFilter'
  | 'brandGroupLabel'
  | 'assumptions'
  | 'suggestedProducts'
  | 'followUpQuestion'
  | 'productType'
  | 'forSomeoneElse'
  | 'forWho'
  | 'askPreference'
> {
  const validIds = CATEGORIES.map(c => c.id) as string[];
  const categoryId = (validIds.includes(parsed?.categoryId) ? parsed.categoryId : personal.categoryHint || 'other') as CategoryId;
  const cat = getCategory(categoryId);

  const forSomeoneElse = Boolean(personal.forSomeoneElse || parsed?.forSomeoneElse === true);
  const forWho = typeof parsed?.forWho === 'string' && parsed.forWho.trim() ? parsed.forWho.trim().slice(0, 30) : null;

  // Keep only known fields with short string values (never learn from gift searches: it's about someone else)
  const learned: Record<string, string> = {};
  if (!forSomeoneElse && parsed?.preferences && typeof parsed.preferences === 'object') {
    for (const f of cat.preferenceFields) {
      if (!f.autoRemember) continue; // per-search details (occasion, who it's for) are not remembered
      const v = parsed.preferences[f.key];
      if (typeof v === 'string' && v.trim() && v.length <= 60) learned[f.key] = v.trim();
      else if (Array.isArray(v) && v.length) learned[f.key] = v.filter(x => typeof x === 'string').join(', ').slice(0, 60);
    }
  }

  const mergedProfile: PreferenceProfile = {
    ...(personal.profile || {}),
    [categoryId]: { ...(personal.profile?.[categoryId] || {}), ...learned },
  };

  // Brand groups named in this message or recent user messages ("K-beauty", "Indian brands")
  const recentUserText = [rawInput, ...(history || []).filter(h => h.sender === 'user').slice(-3).map(h => h.text)].join(' ');
  const groups = findBrandGroups(recentUserText, categoryId);
  const explicit: string[] = Array.isArray(parsed?.preferredBrands)
    ? parsed.preferredBrands.filter((b: unknown) => typeof b === 'string' && b.trim().length > 1)
    : [];
  const groupBrands = groups.flatMap(g => g.brands);
  // A group name Gemini echoed back as a "brand" (e.g. "K-beauty") is not a real brand
  const realExplicit = explicit.filter(b => !groups.some(g => g.phrases.includes(b.toLowerCase()) || g.label.toLowerCase() === b.toLowerCase()));
  const brandFilter = Array.from(new Set([...realExplicit, ...groupBrands]));

  return {
    categoryId,
    learnedPreferences: learned,
    activePreferences: forSomeoneElse
      ? [`Shopping for: ${forWho || 'someone else'}`]
      : describePreferences(mergedProfile, categoryId),
    forSomeoneElse,
    forWho,
    askPreference: (() => {
      // Ask about the category's key preference once, if we don't know it (and it's not a gift search)
      const kq = cat.keyQuestion;
      if (!kq || forSomeoneElse || mergedProfile[categoryId]?.[kq.key]) return null;
      const field = cat.preferenceFields.find(f => f.key === kq.key);
      if (!field?.options?.length) return null;
      return { categoryId, key: kq.key, question: kq.question, options: field.options };
    })(),
    brandFilter,
    brandGroupLabel: groups.map(g => g.label).join(' / ') || undefined,
    assumptions: typeof parsed?.assumptions === 'string' && parsed.assumptions.trim() ? parsed.assumptions.trim() : null,
    suggestedProducts: Array.isArray(parsed?.suggestedProducts)
      ? parsed.suggestedProducts.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 3).map((x: string) => x.trim().slice(0, 90)).slice(0, 4)
      : [],
    followUpQuestion: typeof parsed?.followUpQuestion === 'string' && parsed.followUpQuestion.trim() ? parsed.followUpQuestion.trim().slice(0, 200) : null,
    productType: typeof parsed?.productType === 'string' && parsed.productType.trim() ? parsed.productType.trim().slice(0, 40) : null,
  };
}
