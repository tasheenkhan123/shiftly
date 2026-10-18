import { ExternalWebResult } from '@/types';
import { normalizeProductQuery } from '../ai/pipeline';

/**
 * Extracts visual keywords and Google search queries from user text & images.
 * Prevents large base64 Data URLs from being appended to URLs and uses valid search endpoints.
 */
export function buildRealGoogleQueries(queryText: string, imagePreviewUrl?: string): {
  primarySearchQuery: string;
  googleShoppingUrl: string;
  googleLensUrl: string;
  directWebResults: ExternalWebResult[];
} {
  let cleaned = normalizeProductQuery(queryText);
  if (!cleaned) {
    cleaned = 'product search';
  }

  const encoded = encodeURIComponent(cleaned);
  const googleShoppingUrl = `https://www.google.com/search?tbm=shop&q=${encoded}`;
  
  // Only pass public HTTP/HTTPS URLs to Google Lens. Never append multi-megabyte base64 Data URLs!
  const isHttpUrl = Boolean(imagePreviewUrl && (imagePreviewUrl.startsWith('http://') || imagePreviewUrl.startsWith('https://')));
  const googleLensUrl = isHttpUrl 
    ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imagePreviewUrl!)}`
    : `https://lens.google.com/`;

  // Real-world search sources matching the clean query
  const directWebResults: ExternalWebResult[] = [
    {
      title: `${cleaned} — Official & Verified Sellers on Google Shopping`,
      source: 'Google Shopping',
      price: 'Search Index',
      url: googleShoppingUrl,
      matchSnippet: `Direct Google Shopping search results for "${cleaned}" across indexed web stores.`
    },
    {
      title: `Search "${cleaned}" on Amazon India`,
      source: 'Amazon.in',
      price: 'Search Index',
      url: `https://www.amazon.in/s?k=${encoded}`,
      matchSnippet: `Browse matching search listings and customer reviews on Amazon India.`
    },
    {
      title: `Search "${cleaned}" on Myntra`,
      source: 'Myntra',
      price: 'Search Index',
      url: `https://www.myntra.com/search?q=${encoded}`,
      matchSnippet: `Catalog search listings matched to "${cleaned}" on Myntra.`
    }
  ];

  return {
    primarySearchQuery: cleaned,
    googleShoppingUrl,
    googleLensUrl,
    directWebResults
  };
}

/**
 * Fetches authentic product thumbnail images for clean product names.
 * Uses a strict 2.5s timeout and gracefully returns null on network failures.
 */
export async function fetchRealProductImage(productTitle: string): Promise<string | null> {
  if (!productTitle || typeof productTitle !== 'string') return null;
  const cleanTitle = productTitle.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTitle) return null;

  try {
    const tokenRes = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(cleanTitle + ' product'), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(2500)
    });
    if (!tokenRes.ok) return null;
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([0-9-]+)/) || html.match(/vqd="([0-9-]+)"/);
    if (!vqdMatch) return null;
    const vqd = vqdMatch[1];

    const imgRes = await fetch('https://duckduckgo.com/i.js?l=wt-wt&o=json&q=' + encodeURIComponent(cleanTitle + ' product') + '&vqd=' + vqd, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://duckduckgo.com/'
      },
      signal: AbortSignal.timeout(2500)
    });
    if (!imgRes.ok) return null;
    const data = await imgRes.json();
    return data.results?.[0]?.thumbnail || data.results?.[0]?.image || null;
  } catch {
    return null;
  }
}
