async function resolveProductUrl(title, merchant) {
  try {
    const storeQuery = `${title} ${merchant} buy online`;

    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(storeQuery), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>/g)];
    
    for (const m of matches) {
      const rawUrl = m[1];
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      const targetUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;
      console.log('Found candidate:', targetUrl);
      
      // If looking for Amazon
      if (merchant.toLowerCase().includes('amazon') && targetUrl.includes('amazon.in')) {
        const dpMatch = targetUrl.match(/\/dp\/([A-Z0-9]{10})/i);
        if (dpMatch) {
          return `https://www.amazon.in/dp/${dpMatch[1]}`;
        }
      }

      // If looking for Nykaa
      if (merchant.toLowerCase().includes('nykaa') && targetUrl.includes('nykaa.com')) {
        const pMatch = targetUrl.match(/nykaa\.com\/([^\/]+)\/p\/(\d+)/i);
        if (pMatch) {
          return `https://www.nykaa.com/${pMatch[1]}/p/${pMatch[2]}`;
        }
      }
    }
  } catch(e) {
    console.error('Resolve error:', e);
  }
  return null;
}

async function run() {
  console.log('Resolving Minimalist on Amazon:');
  const minUrl = await resolveProductUrl('Minimalist SPF 30 Lip Balm', 'Amazon India');
  console.log('Result:', minUrl);

  console.log('\nResolving Laneige on Nykaa:');
  const lanUrl = await resolveProductUrl('Laneige Lip Glowy Balm Berry', 'Nykaa');
  console.log('Result:', lanUrl);
}

run();
