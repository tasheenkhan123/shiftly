/**
 * Per-user search limits, so a bot or a shared link can't burn through the SerpApi / Gemini credits.
 *
 * Free plan: SEARCH_LIMIT_PER_DAY searches per day (default 5), for guests (by IP) and signed-in users alike.
 * Optional overrides: SEARCH_LIMIT_GUEST_PER_DAY, SEARCH_LIMIT_USER_PER_DAY. Window: SEARCH_LIMIT_WINDOW_HOURS (default 24).
 *
 * Counts live in Supabase (consume_search_quota in supabase/schema.sql), so the limit holds across all of
 * Vercel's server instances. If that function isn't installed yet, an in-memory limiter is used instead
 * (per server instance: weaker, but still protective).
 *
 * Keys are HMAC-hashed: raw IP addresses and user ids are never stored, and keys can't be guessed.
 */
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const windowSeconds = () => intEnv('SEARCH_LIMIT_WINDOW_HOURS', 24) * 60 * 60;

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetInSeconds: number;
  signedIn: boolean;
}

export function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hashKey(raw: string): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SERPAPI_API_KEY || process.env.GEMINI_API_KEY || 'siftly';
  return createHmac('sha256', secret).update(raw).digest('hex').slice(0, 40);
}

/** Client IP from Vercel / proxy headers */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip') ||
    'local'
  );
}

function supabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** Returns the user id if the bearer token is a valid Supabase session */
async function verifiedUserId(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const sb = supabaseServerClient();
  if (!token || !sb) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    return error ? null : data.user?.id || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------
const memory = new Map<string, { windowStart: number; count: number }>();
function consumeInMemory(key: string, limit: number): { allowed: boolean; count: number; resetInSeconds: number } {
  const now = Date.now();
  let entry = memory.get(key);
  const WINDOW_SECONDS = windowSeconds();
  if (!entry || now - entry.windowStart >= WINDOW_SECONDS * 1000) {
    entry = { windowStart: now, count: 0 };
    memory.set(key, entry);
  }
  if (memory.size > 5000) memory.delete(memory.keys().next().value as string);
  const allowed = entry.count < limit;
  if (allowed) entry.count++;
  return { allowed, count: entry.count, resetInSeconds: Math.ceil((entry.windowStart + WINDOW_SECONDS * 1000 - now) / 1000) };
}

let warnedNoRpc = false;

export async function consumeSearchQuota(headers: Headers): Promise<QuotaResult> {
  const userId = await verifiedUserId(headers.get('authorization'));
  const signedIn = Boolean(userId);
  const free = intEnv('SEARCH_LIMIT_PER_DAY', 5);
  const limit = signedIn ? intEnv('SEARCH_LIMIT_USER_PER_DAY', free) : intEnv('SEARCH_LIMIT_GUEST_PER_DAY', free);
  const WINDOW_SECONDS = windowSeconds();
  const key = hashKey(signedIn ? `user:${userId}` : `ip:${clientIp(headers)}`);

  const sb = supabaseServerClient();
  if (sb) {
    try {
      const { data, error } = await sb.rpc('consume_search_quota', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: WINDOW_SECONDS,
      });
      if (!error && data && typeof data === 'object') {
        const d = data as { allowed: boolean; count: number; reset_in_seconds: number };
        return {
          allowed: Boolean(d.allowed),
          remaining: Math.max(0, limit - (d.count || 0)),
          limit,
          resetInSeconds: d.reset_in_seconds || WINDOW_SECONDS,
          signedIn,
        };
      }
      if (error && !warnedNoRpc) {
        warnedNoRpc = true;
        console.warn(`[rate-limit] Supabase function unavailable (${error.message}); using in-memory limits. Run supabase/schema.sql.`);
      }
    } catch (err: any) {
      if (!warnedNoRpc) {
        warnedNoRpc = true;
        console.warn(`[rate-limit] Supabase error (${err?.message}); using in-memory limits.`);
      }
    }
  }

  const m = consumeInMemory(key, limit);
  return { allowed: m.allowed, remaining: Math.max(0, limit - m.count), limit, resetInSeconds: m.resetInSeconds, signedIn };
}
