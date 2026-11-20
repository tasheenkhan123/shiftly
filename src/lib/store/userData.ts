'use client';

/**
 * Where a user's chats and saved products live.
 * - Signed in: Supabase tables chat_sessions / saved_products (protected by Row Level Security).
 * - Guest:     this browser's localStorage.
 * When a guest signs in, their local data is moved into their account.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatSession, ProductMatch } from '@/types';
import type { PreferenceProfile } from '@/lib/categories';

export interface UserDataStore {
  kind: 'cloud' | 'local';
  listSessions(): Promise<ChatSession[]>;
  upsertSession(session: ChatSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  listSaved(): Promise<ProductMatch[]>;
  saveProduct(product: ProductMatch): Promise<void>;
  removeSaved(product: ProductMatch): Promise<void>;
  getProfile(): Promise<PreferenceProfile>;
  saveProfile(profile: PreferenceProfile): Promise<void>;
}

/** Merge newly learned preferences into a category of the profile (new values win; empty values are removed) */
export function mergeProfile(profile: PreferenceProfile, categoryId: string, learned: Record<string, string>): PreferenceProfile {
  const key = categoryId as keyof PreferenceProfile;
  const next: Record<string, string> = { ...(profile[key] || {}) };
  for (const [k, v] of Object.entries(learned)) {
    if (v && v.trim()) next[k] = v.trim();
    else delete next[k];
  }
  return { ...profile, [key]: next };
}

/** Same physical product = same key, even across different searches (product.id changes per search). */
export function productKey(p: Pick<ProductMatch, 'title' | 'brand'>): string {
  return `${p.brand || ''}|${p.title}`.toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim();
}

/** Sort: pinned first, then most recently updated. */
export function sortSessions(list: ChatSession[]): ChatSession[] {
  return [...list].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

// ---------------------------------------------------------------------------
// Local (guest)
// ---------------------------------------------------------------------------
const LS_SESSIONS = 'siftly_sessions';
const LS_SAVED = 'siftly_saved_products';
const LS_PROFILE = 'siftly_profile';
const MAX_LOCAL_SESSIONS = 30;

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Could not save to browser storage (it may be full):', err);
  }
}

/** Drop large inline images from older versions of the app (they filled localStorage). */
function slimSession(s: ChatSession): ChatSession {
  return {
    ...s,
    messages: (s.messages || []).map(m =>
      m.mediaUrl && m.mediaUrl.startsWith('data:') && m.mediaUrl.length > 120_000 ? { ...m, mediaUrl: undefined } : m
    ),
  };
}

export const localStore: UserDataStore = {
  kind: 'local',
  async listSessions() {
    return sortSessions(readLS<ChatSession[]>(LS_SESSIONS, []).map(slimSession));
  },
  async upsertSession(session) {
    const list = readLS<ChatSession[]>(LS_SESSIONS, []).filter(s => s.id !== session.id);
    writeLS(LS_SESSIONS, sortSessions([slimSession(session), ...list]).slice(0, MAX_LOCAL_SESSIONS));
  },
  async deleteSession(id) {
    writeLS(LS_SESSIONS, readLS<ChatSession[]>(LS_SESSIONS, []).filter(s => s.id !== id));
  },
  async listSaved() {
    return readLS<ProductMatch[]>(LS_SAVED, []);
  },
  async saveProduct(product) {
    const key = productKey(product);
    const list = readLS<ProductMatch[]>(LS_SAVED, []).filter(p => productKey(p) !== key);
    writeLS(LS_SAVED, [product, ...list]);
  },
  async removeSaved(product) {
    const key = productKey(product);
    writeLS(LS_SAVED, readLS<ProductMatch[]>(LS_SAVED, []).filter(p => productKey(p) !== key));
  },
  async getProfile() {
    return readLS<PreferenceProfile>(LS_PROFILE, {});
  },
  async saveProfile(profile) {
    writeLS(LS_PROFILE, profile);
  },
};

// ---------------------------------------------------------------------------
// Cloud (signed in)
// ---------------------------------------------------------------------------
export function cloudStore(sb: SupabaseClient): UserDataStore {
  const fail = (what: string, error: { message: string; code?: string } | null) => {
    if (!error) return;
    // 42501 = missing table permissions, 42P01 = table doesn't exist: the SQL setup hasn't been (fully) run
    // PGRST205 = table not found in the API schema cache (e.g. user_profiles before the new SQL is run)
    if (['42501', '42P01', 'PGRST205'].includes(error.code || '') || /permission denied|does not exist|schema cache/i.test(error.message)) {
      throw new Error(
        `${what} failed: the Supabase database isn't fully set up. Run supabase/schema.sql in the Supabase SQL Editor, then refresh.`
      );
    }
    throw new Error(`${what} failed: ${error.message}`);
  };
  return {
    kind: 'cloud',
    async listSessions() {
      const { data, error } = await sb
        .from('chat_sessions')
        .select('id,title,pinned,messages,created_at,updated_at')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(100);
      fail('Loading chats', error);
      return (data || []).map(r => ({
        id: r.id,
        title: r.title,
        pinned: r.pinned,
        messages: r.messages || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },
    async upsertSession(s) {
      const slim = slimSession(s);
      const { error } = await sb.from('chat_sessions').upsert({
        id: slim.id,
        title: slim.title,
        pinned: Boolean(slim.pinned),
        messages: slim.messages,
        updated_at: slim.updatedAt || new Date().toISOString(),
      });
      fail('Saving chat', error);
    },
    async deleteSession(id) {
      const { error } = await sb.from('chat_sessions').delete().eq('id', id);
      fail('Deleting chat', error);
    },
    async listSaved() {
      const { data, error } = await sb
        .from('saved_products')
        .select('product')
        .order('created_at', { ascending: false })
        .limit(200);
      fail('Loading saved items', error);
      return (data || []).map(r => r.product as ProductMatch);
    },
    async saveProduct(product) {
      const { error } = await sb
        .from('saved_products')
        .upsert({ product_key: productKey(product), product }, { onConflict: 'user_id,product_key' });
      fail('Saving item', error);
    },
    async removeSaved(product) {
      const { error } = await sb.from('saved_products').delete().eq('product_key', productKey(product));
      fail('Removing saved item', error);
    },
    async getProfile() {
      const { data, error } = await sb.from('user_profiles').select('preferences').maybeSingle();
      fail('Loading your preferences', error);
      return (data?.preferences as PreferenceProfile) || {};
    },
    async saveProfile(profile) {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;
      const { error } = await sb
        .from('user_profiles')
        .upsert({ user_id: auth.user.id, preferences: profile, updated_at: new Date().toISOString() });
      fail('Saving your preferences', error);
    },
  };
}

/** Move a guest's local chats and saved items into their account, then clear them locally. */
export async function migrateLocalToCloud(cloud: UserDataStore): Promise<number> {
  const sessions = (await localStore.listSessions()).filter(s => s.messages.length > 0);
  const saved = await localStore.listSaved();
  const localProfile = await localStore.getProfile();
  const hasProfile = Object.values(localProfile).some(v => v && Object.keys(v).length > 0);
  if (sessions.length === 0 && saved.length === 0 && !hasProfile) return 0;
  for (const s of sessions) await cloud.upsertSession(s);
  for (const p of saved) await cloud.saveProduct(p);
  if (hasProfile) {
    // Account values win over guest values if both exist
    const cloudProfile = await cloud.getProfile();
    const merged: PreferenceProfile = { ...localProfile };
    for (const [k, v] of Object.entries(cloudProfile)) merged[k as keyof PreferenceProfile] = { ...(localProfile[k as keyof PreferenceProfile] || {}), ...(v || {}) };
    await cloud.saveProfile(merged);
  }
  try {
    localStorage.removeItem(LS_SESSIONS);
    localStorage.removeItem(LS_SAVED);
    localStorage.removeItem(LS_PROFILE);
  } catch {}
  return sessions.length + saved.length;
}
