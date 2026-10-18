// Test script for Shift E Gemini Google Search Grounding
const testQuery = "I have ₹500. Recommend three lip balms.";

async function runTest() {
  console.log(`Sending query: "${testQuery}" to http://localhost:3000/api/analyze`);
  const startTime = Date.now();
  
  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: testQuery })
    });

    const elapsed = Date.now() - startTime;
    console.log(`Response status: ${res.status} (${elapsed}ms)`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      return;
    }

    const data = await res.json();
    console.log('\n--- SIFTLY ANALYSIS RESULT ---');
    console.log('Intent:', data.intent);
    console.log('Primary Category:', data.primaryCategory);
    console.log('Is Grounding Active:', data.isGroundingActive);
    console.log('Configuration Notice:', data.configurationNotice || 'None (Key configured!)');
    console.log('Search Queries from Grounding:', data.searchQueries);
    console.log('Grounding Sources Count:', data.groundingSources?.length || 0);
    if (data.groundingSources && data.groundingSources.length > 0) {
      console.log('First 3 Sources:');
      data.groundingSources.slice(0, 3).forEach((s, i) => console.log(`  [${i+1}] ${s.title}: ${s.url}`));
    }
    
    console.log('\n--- CUSTOM SUMMARY ---');
    console.log(data.customSummary);

    console.log('\n--- RECOMMENDED PRODUCTS ---');
    const entityMatches = Object.values(data.productMatches || {}).flat();
    console.log(`Total Products: ${entityMatches.length}`);
    entityMatches.forEach((p, i) => {
      console.log(`\nProduct #${i+1}:`);
      console.log(`  Title: ${p.title}`);
      console.log(`  Brand: ${p.brand}`);
      console.log(`  Price: ₹${p.lowestPrice} ${p.currency}`);
      console.log(`  Image URL: ${p.imageUrl || '(None)'}`);
      console.log(`  Rating: ${p.productRating || 'N/A'} (${p.reviewsCount || 'N/A'} reviews)`);
      console.log(`  Merchant: ${p.merchants?.[0]?.sellerName}`);
      console.log(`  URL Type: ${p.merchants?.[0]?.urlType}`);
      console.log(`  URL: ${p.merchants?.[0]?.productUrl}`);
      console.log(`  Match Tier: ${p.matchTier}`);
      console.log(`  Match Reasons:`, p.matchReasons);
    });

  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

runTest();
