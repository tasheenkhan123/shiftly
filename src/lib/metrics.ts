/**
 * Per-search metrics: how long a search took and what it cost.
 * Each request runs inside its own context (AsyncLocalStorage), so parallel searches don't mix counts.
 * Logged as one JSON line per search ("[metrics] {...}") and returned with the result.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface SearchMetrics {
  /** SerpApi requests actually sent (each costs one credit) */
  serpApiCalls: number;
  /** SerpApi requests answered from the cache (free) */
  cacheHits: number;
  /** Gemini requests sent (including backup "hedge" requests) */
  geminiCalls: number;
  /** Which Gemini model answered each call */
  geminiModels: string[];
  startedAt: number;
}

const storage = new AsyncLocalStorage<SearchMetrics>();

export function withMetrics<T>(fn: () => Promise<T>): Promise<{ value: T; metrics: SearchMetrics }> {
  const metrics: SearchMetrics = { serpApiCalls: 0, cacheHits: 0, geminiCalls: 0, geminiModels: [], startedAt: Date.now() };
  return storage.run(metrics, async () => ({ value: await fn(), metrics }));
}

/** Current request's metrics, or undefined outside a search (e.g. in tests) */
export function currentMetrics(): SearchMetrics | undefined {
  return storage.getStore();
}
