'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client. Auth sessions are kept by supabase-js in the browser;
 * all data access is protected by Row Level Security (see supabase/schema.sql),
 * so the public anon key is safe to ship to the browser.
 *
 * Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set,
 * in which case the app runs in guest mode (data stays in this browser only).
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  client = url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    : null;
  return client;
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

export function isGoogleSignInEnabled(): boolean {
  // Shown by default; set NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED=false to hide it
  return process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED !== 'false';
}
