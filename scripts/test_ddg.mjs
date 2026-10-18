async function searchImages(query) {
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query + ' product'), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log('Query:', query);
    
    // Find duckduckgo redirect URLs
    const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>/g)];
    for (const m of matches.slice(0, 5)) {
      const rawUrl = m[1];
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      const targetUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;
      console.log('URL:', targetUrl);
    }
  } catch(e) {
    console.error(e);
  }
}

async function run() {
  await searchImages('Laneige Lip Glowy Balm Berry Nykaa');
  console.log('\n--- WishCare ---');
  await searchImages('WishCare Tinted Ceramide Lip Balm Nykaa');
}

run();
