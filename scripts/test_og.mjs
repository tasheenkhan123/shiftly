async function testOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const ogMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i) ||
                    html.match(/<meta content=["']([^"']+)["'] property=["']og:image["']/i) ||
                    html.match(/<meta name=["']twitter:image["'] content=["']([^"']+)["']/i);
    
    const imageUrl = ogMatch ? ogMatch[1] : null;
    console.log('OG Image for', url, '=>', imageUrl);
    if (imageUrl) {
      const imgRes = await fetch(imageUrl, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log('Image status =>', imgRes.status);
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

async function run() {
  await testOgImage('https://www.nykaa.com/laneige-lip-glowy-balm/p/15227381');
  await testOgImage('https://www.nykaa.com/wishcare-ceramide-lip-balm-with-spf-50-pa-watermelon/p/13784199');
  await testOgImage('https://www.amazon.in/Minimalist-Ceramides-Hyaluronic-Protection-Nourishment/dp/B0BJ6XPC77');
}

run();
