'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './client';
import type { UserProfile } from '@/types';

function toProfile(u: User | null | undefined): UserProfile | null {
  if (!u) return null;
  const meta = (u.user_metadata || {}) as Record<string, any>;
  const email = u.email || '';
  return {
    id: u.id,
    fullName: meta.full_name || meta.name || email.split('@')[0] || 'Siftly user',
    email,
    avatarUrl: meta.avatar_url || meta.picture,
    shopsFor: typeof meta.shops_for === 'string' ? meta.shops_for : undefined,
    isLoggedIn: true,
  };
}

/** Current signed-in user (null for guests), plus sign-out and password-recovery state. */
export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toProfile(data.session?.user));
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      setUser(toProfile(session?.user));
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
  }, []);

  return { user, ready, signOut, passwordRecovery, clearPasswordRecovery: () => setPasswordRecovery(false) };
}
