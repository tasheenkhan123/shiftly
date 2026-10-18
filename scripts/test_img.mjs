async function testDdgImage(query) {
  try {
    // 1. First get vqd token
    const tokenRes = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=([0-9-]+)/) || tokenHtml.match(/vqd=\"([0-9-]+)\"/);
    console.log('vqd token:', vqdMatch ? vqdMatch[1] : 'not found');
    
    if (vqdMatch) {
      const imgRes = await fetch(`https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://duckduckgo.com/'
        }
      });
      const data = await imgRes.json();
      console.log('Results count:', data.results?.length);
      if (data.results && data.results.length > 0) {
        console.log('First image:', data.results[0].image);
        console.log('Thumbnail:', data.results[0].thumbnail);
        console.log('Source:', data.results[0].url);
      }
    }
  } catch(e) {
    console.error('Error:', e);
  }
}

async function run() {
  await testDdgImage('WishCare Tinted Ceramide Lip Balm');
  await testDdgImage('Laneige Lip Glowy Balm Berry');
  await testDdgImage('Minimalist SPF 30 Lip Balm');
}

run();
