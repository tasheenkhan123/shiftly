// Phase 1 Verification Test Suite for Shift E
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== Starting Shift E Phase 1 Verification Test Suite ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Helper for API calls
  async function apiAnalyze(body) {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(`API returned HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  // --- Test 1: Budget Parsing Examples ---
  const budgetCases = [
    { input: 'I have ₹500', expected: 500 },
    { input: 'Budget: 50000', expected: 50000 },
    { input: 'My budget is ₹1,00,000', expected: 100000 },
    { input: 'Under 50k', expected: 50000 },
    { input: 'Within 1 lakh', expected: 100000 },
    { input: 'Less than ₹2,000', expected: 2000 },
    { input: '₹500 budget for lip balm', expected: 500 },
    { input: 'Recommend 3 lip balms', expected: undefined, expectedCount: 3 },
    { input: 'Gaming PC with RTX 4060 and 32GB RAM', expected: undefined },
    { input: '4k monitor under 30k', expected: 30000 }
  ];

  for (const c of budgetCases) {
    await test(`Budget: "${c.input}" -> ${c.expected}`, async () => {
      const data = await apiAnalyze({ input: c.input });
      assert.strictEqual(
        data.userConstraints?.budgetMax,
        c.expected,
        `Expected budgetMax ${c.expected}, got ${data.userConstraints?.budgetMax}`
      );
      if (c.expectedCount) {
        assert.strictEqual(
          data.userConstraints?.requestedCount,
          c.expectedCount,
          `Expected requestedCount ${c.expectedCount}, got ${data.userConstraints?.requestedCount}`
        );
      }
    });
  }

  // --- Test 2: Three Lip Balm Request ---
  await test('Three Lip Balm Request: normalisation, brand, and category', async () => {
    const prompt = 'I have ₹500. Recommend the three best lip balms from recognised brands.';
    const data = await apiAnalyze({ input: prompt });
    
    // Budget
    assert.strictEqual(data.userConstraints?.budgetMax, 500, 'Budget must be 500');
    assert.strictEqual(data.userConstraints?.requestedCount, 3, 'Requested count must be 3');
    
    // Category must be Skincare
    assert.strictEqual(data.primaryCategory, 'SKINCARE', 'Category must be SKINCARE');
    
    // Detected entity check
    const entity = data.detectedEntities[0];
    assert.ok(entity, 'Entity must exist');
    assert.notStrictEqual(entity.brand, 'I', 'Brand must NOT be "I"');
    
    // Check product matches
    const matches = Object.values(data.productMatches).flat();
    assert.ok(matches.length >= 1, 'Should return product matches');
    for (const match of matches) {
      assert.notStrictEqual(match.brand, 'I', 'Product brand must NOT be "I"');
      assert.notStrictEqual(match.title, prompt, 'Product title must NOT be conversational sentence');
      
      // Merchants check
      for (const m of match.merchants) {
        assert.ok(!m.productUrl.includes('I%20have'), 'Search URL must not contain conversational prompt "I have"');
        assert.ok(!m.productUrl.includes('Recommend%20the%20three'), 'Search URL must not contain boilerplate text');
      }
    }
  });

  // --- Test 3: Gaming Setup Request ---
  await test('Gaming Setup Request: category, budget, no cosmetics, clean URLs', async () => {
    const prompt = 'I have ₹1,00,000. Recommend a complete gaming setup, including a PC, monitor, keyboard, mouse and other essential accessories.';
    const data = await apiAnalyze({ input: prompt });
    
    // Budget
    assert.strictEqual(data.userConstraints?.budgetMax, 100000, 'Budget must be 100,000');
    
    // Category MUST be GAMING_SETUPS (NEVER Skincare!)
    assert.strictEqual(data.primaryCategory, 'GAMING_SETUPS', 'Category must be GAMING_SETUPS');
    assert.strictEqual(data.detectedEntities[0]?.category, 'Gaming Setup', 'Entity category must be Gaming Setup');
    
    // Entity brand must not be "I"
    assert.notStrictEqual(data.detectedEntities[0]?.brand, 'I', 'Brand must not be "I"');
    
    const matches = Object.values(data.productMatches).flat();
    assert.ok(matches.length >= 1, 'Must return match');
    const match = matches[0];
    
    // Image must NOT be cosmetic svg or unsplash serum bottle
    assert.ok(!match.imageUrl.includes('nivea'), 'Image must not be nivea');
    assert.ok(!match.imageUrl.includes('medicube'), 'Image must not be medicube');
    assert.ok(!match.imageUrl.includes('cerave'), 'Image must not be cerave');
    assert.ok(!match.imageUrl.includes('photo-1620916566398'), 'Image must not be cosmetics unsplash bottle');
    
    // Match tier must be SEARCH_RESULT, not false EXACT
    assert.strictEqual(match.matchTier, 'SEARCH_RESULT', 'Tier must be SEARCH_RESULT');
    
    // Store links must NOT include Nykaa or Tira for gaming! Must include Amazon / Flipkart
    const sellerNames = match.merchants.map(m => m.sellerName);
    assert.ok(sellerNames.includes('Amazon India'), 'Must include Amazon India');
    assert.ok(sellerNames.includes('Flipkart'), 'Must include Flipkart');
    assert.ok(!sellerNames.includes('Tira Beauty'), 'Must NOT include Tira Beauty for Gaming');
    assert.ok(!sellerNames.includes('Nykaa'), 'Must NOT include Nykaa for Gaming');
    
    // Store links must be clean
    for (const m of match.merchants) {
      assert.ok(!m.productUrl.includes('I%20have'), 'URL must not include "I have"');
      assert.strictEqual(m.verified, false, 'Search links must not claim verified: true');
    }
  });

  // --- Test 4: Skincare Brand Query ---
  await test('Skincare Query: Minimalist serum preserved without Nivea fallback', async () => {
    const prompt = 'Minimalist 10% niacinamide serum';
    const data = await apiAnalyze({ input: prompt });
    
    assert.strictEqual(data.primaryCategory, 'SKINCARE', 'Category must be SKINCARE');
    const entity = data.detectedEntities[0];
    assert.strictEqual(entity.brand, 'Minimalist', 'Brand must be Minimalist');
    assert.ok(!entity.name.toLowerCase().includes('nivea'), 'Must not substitute Nivea');
  });

  // --- Test 5: Fashion Query & Myntra Search URL ---
  await test('Fashion Query: valid Myntra search URL format', async () => {
    const prompt = 'Find this green satin wrap dress under ₹2,000';
    const data = await apiAnalyze({ input: prompt });
    
    assert.strictEqual(data.primaryCategory, 'FASHION', 'Category must be FASHION');
    assert.strictEqual(data.userConstraints?.budgetMax, 2000, 'Budget must be 2000');
    
    // Check directWebResults Myntra search URL
    const myntraResult = data.directWebResults?.find(r => r.source === 'Myntra');
    assert.ok(myntraResult, 'Must include Myntra in direct web results');
    assert.ok(myntraResult.url.includes('/search?q='), `Myntra URL must use /search?q=, got: ${myntraResult.url}`);
    assert.ok(!myntraResult.url.includes('under'), 'Myntra search URL should not include "under"');
  });

  // --- Test 6: Recipe Query ---
  await test('Recipe Query: maintains RECIPE intent and ingredients', async () => {
    const prompt = 'Fiery Korean Spicy Garlic Gochujang Noodles recipe';
    const data = await apiAnalyze({ input: prompt });
    
    assert.strictEqual(data.intent, 'RECIPE', 'Intent must be RECIPE');
    assert.ok(data.recipeData, 'Must return recipe data');
    assert.ok(data.recipeData.ingredients?.length > 0, 'Must have ingredients');
  });

  // --- Test 7: Base64 Data URL Safety in Google Lens ---
  await test('Base64 Data URL Safety: never appends base64 to Google Lens URL', async () => {
    const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const data = await apiAnalyze({
      input: 'gaming mouse',
      imagePreviewUrl: base64Data
    });
    
    assert.ok(data.googleLensUrl, 'Google Lens URL must exist');
    assert.ok(!data.googleLensUrl.includes('data:image'), 'Google Lens URL must NOT contain base64 data');
    assert.strictEqual(data.googleLensUrl, 'https://lens.google.com/', 'Must fallback to root https://lens.google.com/');
  });

  console.log(`\n=== Verification Test Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
