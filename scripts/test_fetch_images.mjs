async function fetchRealImage(query) {
  try {
    const tokenRes = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query + ' product'), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([0-9-]+)/) || html.match(/vqd="([0-9-]+)"/);
    if (!vqdMatch) return null;
    const vqd = vqdMatch[1];
    const imgRes = await fetch('https://duckduckgo.com/i.js?l=wt-wt&o=json&q=' + encodeURIComponent(query + ' product') + '&vqd=' + vqd, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://duckduckgo.com/'
      }
    });
    const data = await imgRes.json();
    return data.results?.[0]?.thumbnail || data.results?.[0]?.image || null;
  } catch(e) {
    return null;
  }
}

async function run() {
  const tests = [
    'nivea blackberry lip balm',
    'asus tuf gaming monitor',
    'zara floral dress',
    'WishCare Tinted Ceramide Lip Balm SPF 50',
    'Laneige Lip Glowy Balm Berry',
    'Minimalist SPF 30 Lip Balm'
  ];
  for (const t of tests) {
    const img = await fetchRealImage(t);
    console.log(t, '=>', img);
  }
}
run();
