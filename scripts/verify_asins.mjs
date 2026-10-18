async function findLiveRetailerLinks(productName, brand) {
  try {
    const query = `${brand} ${productName} Amazon Nykaa`;
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await res.text();
    const linkMatches = [...html.matchAll(/<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>/g)];
    
    const links = [];
    for (const m of linkMatches) {
      const raw = m[1];
      const uddgMatch = raw.match(/uddg=([^&]+)/);
      const decoded = uddgMatch ? decodeURIComponent(uddgMatch[1]) : raw;
      links.push(decoded);
    }
    console.log(`\n--- Results for ${brand} ${productName} ---`);
    links.slice(0, 6).forEach(l => console.log(l));
    return links;
  } catch(e) {
    console.error(e);
  }
}

async function run() {
  await findLiveRetailerLinks('Tinted Ceramide Lip Balm', 'WishCare');
  await findLiveRetailerLinks('Lip Glowy Balm Berry', 'Laneige');
  await findLiveRetailerLinks('SPF 30 Lip Balm', 'Minimalist');
}

run();
