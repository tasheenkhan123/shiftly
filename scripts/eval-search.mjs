#!/usr/bin/env node
/**
 * Search quality eval: runs real searches against a running Siftly server and checks the results.
 *
 *   npm run dev                      # in one terminal
 *   npm run eval                     # in another (uses http://localhost:3000)
 *   BASE_URL=https://your-app.vercel.app npm run eval
 *
 * Costs real SerpApi credits (~25-30 per full run). Repeat runs within 30 minutes hit the cache.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FOREIGN = /desertcart|ubuy|gosupps|etsy|\.ae\b|\.sa\b/i;
const K_BEAUTY = ['COSRX', 'Beauty of Joseon', 'Anua', 'Some By Mi', 'Innisfree', 'Round Lab', 'Isntree', 'SKIN1004', 'Torriden',
  'Laneige', 'Axis-Y', 'Klairs', 'Etude', 'Medicube', 'Mixsoon', 'Numbuzin', 'Purito', "I'm From", 'Dr. Jart', 'Neogen'];

const all = d => Object.values(d.productMatches || {}).flat();
const mains = d => (d.detectedEntities || []).map(e => d.productMatches?.[e.id]?.[0]).filter(Boolean);
const lower = s => (s || '').toLowerCase();

const CASES = [
  {
    name: 'Single product with budget',
    body: { input: 'face wash for oily skin under 500' },
    checks: {
      'at least 2 products': d => all(d).length >= 2,
      'every price within ₹500': d => all(d).every(m => m.priceKnown === false || m.lowestPrice <= 500),
      'category is skincare': d => d.categoryId === 'skincare',
    },
  },
  {
    name: 'Electronics',
    body: { input: 'wireless earbuds under 2000' },
    checks: {
      '3 products': d => all(d).length === 3,
      'every price within ₹2,000': d => all(d).every(m => m.priceKnown === false || m.lowestPrice <= 2000),
    },
  },
  {
    name: 'Gift ignores own profile',
    body: { input: 'perfume gift for my dad under 3000', profile: { global: { shopsFor: "Women's" }, perfumes: { scent: 'Fruity' } } },
    checks: {
      'shows "Shopping for"': d => (d.activePreferences || []).some(p => /shopping for/i.test(p)),
      'learns nothing': d => Object.keys(d.learnedPreferences || {}).length === 0,
      'every price within ₹3,000': d => all(d).every(m => m.priceKnown === false || m.lowestPrice <= 3000),
    },
  },
  {
    name: 'K-beauty brand group',
    body: { input: 'I have oily skin, K-beauty face wash under 1500' },
    checks: {
      'only K-beauty brands': d => all(d).length > 0 && all(d).every(m => K_BEAUTY.some(b => lower(`${m.brand} ${m.title}`).includes(lower(b)))),
      'remembers oily skin': d => d.learnedPreferences?.skinType === 'Oily',
    },
  },
  {
    name: 'Named brand catalog',
    body: { input: 'bath and body works fruity citrus mist' },
    checks: {
      'at least 2 products': d => all(d).length >= 2,
      'all Bath & Body Works': d =>
        all(d).every(m => /bath\s*(&|and)?\s*body/i.test(`${m.brand} ${m.title} ${m.merchants?.[0]?.sellerName}`)),
    },
  },
  {
    name: 'Gaming setup under ₹1 lakh',
    body: { input: 'gaming setup under 1 lakh' },
    checks: {
      'is a setup': d => (d.detectedEntities || []).length >= 3,
      'total within ₹1,00,000': d => mains(d).reduce((s, m) => s + m.lowestPrice, 0) <= 100000,
      'uses at least 85% of budget': d => mains(d).reduce((s, m) => s + m.lowestPrice, 0) >= 85000,
      'PC has a dedicated graphics card': d => {
        const pc = (d.detectedEntities || []).find(e => /pc|desktop|computer/i.test(e.name));
        const t = pc && d.productMatches[pc.id]?.[0]?.title;
        return Boolean(t && /\b(rtx|gtx)\s?\d{3,4}|\brx\s?\d{3,4}/i.test(t));
      },
    },
  },
];

// Rules every result must follow
const UNIVERSAL = {
  'no overseas importers': d => all(d).every(m => (m.merchants || []).every(o => !FOREIGN.test(o.sellerName))),
  'all store links are https': d => all(d).every(m => (m.merchants || []).every(o => !o.productUrl || o.productUrl.startsWith('https://'))),
  'no invented prices': d => all(d).every(m => m.priceKnown !== false || m.lowestPrice === 0),
};

async function runSearch(body) {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationHistory: [], ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const evt = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (evt.type === 'result') return evt.data;
      if (evt.type === 'error') throw new Error(evt.message);
    }
  }
  throw new Error('stream ended without a result');
}

const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

console.log(`Siftly search eval against ${BASE}\n`);
let passed = 0;
let total = 0;
const durations = [];
const credits = [];
for (const c of CASES) {
  process.stdout.write(`▶ ${c.name}: "${c.body.input}"\n`);
  try {
    const d = await runSearch(c.body);
    const checks = { ...c.checks, ...UNIVERSAL };
    for (const [label, fn] of Object.entries(checks)) {
      let ok = false;
      try {
        ok = Boolean(fn(d));
      } catch {}
      total++;
      if (ok) passed++;
      console.log(`   ${ok ? '✓' : '✗'} ${label}`);
    }
    if (d.metrics) {
      durations.push(d.metrics.durationMs);
      credits.push(d.metrics.serpApiCalls);
      console.log(`   ${(d.metrics.durationMs / 1000).toFixed(1)}s · ${d.metrics.serpApiCalls} SerpApi calls · ${d.metrics.cacheHits} cache hits · ${d.metrics.geminiCalls} Gemini calls`);
    }
  } catch (err) {
    total++;
    console.log(`   ✗ search failed: ${err.message}`);
  }
  console.log('');
}

console.log('────────────────────────────────────────');
console.log(`Checks passed: ${passed}/${total} (${Math.round((passed / Math.max(1, total)) * 100)}%)`);
if (durations.length) {
  console.log(`Median search time: ${(median(durations) / 1000).toFixed(1)}s · slowest ${(Math.max(...durations) / 1000).toFixed(1)}s`);
  console.log(`SerpApi calls: ${credits.reduce((a, b) => a + b, 0)} total, median ${median(credits)} per search`);
}
process.exit(passed === total ? 0 : 1);
