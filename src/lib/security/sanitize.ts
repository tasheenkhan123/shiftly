/** Input sanitising for data that ends up in prompts */
import { CATEGORIES, type PreferenceProfile } from '@/lib/categories';

/** Accept only { scope: { key: shortString } } so the profile can't be used to stuff the prompt */
export function sanitizeProfile(raw: unknown): PreferenceProfile {
  const out: PreferenceProfile = {};
  if (!raw || typeof raw !== 'object') return out;
  const scopes = new Set<string>([...CATEGORIES.map(c => c.id), 'global']);
  for (const [scope, values] of Object.entries(raw as Record<string, unknown>)) {
    if (!scopes.has(scope) || !values || typeof values !== 'object') continue;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(values as Record<string, unknown>).slice(0, 12)) {
      if (/^[a-zA-Z]{1,24}$/.test(k) && typeof v === 'string' && v.trim() && v.length <= 80) clean[k] = v.trim();
    }
    if (Object.keys(clean).length) out[scope as keyof PreferenceProfile] = clean;
  }
  return out;
}
