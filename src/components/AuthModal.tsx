'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Mail, Lock, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSupabase, isAuthConfigured, isGoogleSignInEnabled } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens straight into "choose a new password" after the user clicks a reset link */
  passwordRecovery?: boolean;
  onPasswordRecoveryDone?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, passwordRecovery, onPasswordRecoveryDone }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (passwordRecovery) setMode('reset');
  }, [passwordRecovery]);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode, isOpen]);

  if (!isOpen && !passwordRecovery) return null;

  const sb = getSupabase();
  const configured = isAuthConfigured() && sb;
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  const close = () => {
    setPassword('');
    if (mode === 'reset') onPasswordRecoveryDone?.();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        close();
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (data.session) close();
        else setNotice('Check your email and click the confirmation link to finish creating your account.');
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setNotice('If an account exists for that email, a password reset link is on its way.');
      } else if (mode === 'reset') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setNotice('Password updated. You are signed in.');
        setTimeout(close, 1200);
      }
    } catch (err: any) {
      setError(friendlyError(err?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) {
      setError(friendlyError(error.message));
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    signin: 'Sign in to Siftly',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };
  const subtitles: Record<Mode, string> = {
    signin: 'Your searches, pinned chats and saved items sync to your account.',
    signup: 'Save products and keep your search history on every device.',
    forgot: "Enter your email and we'll send you a reset link.",
    reset: 'Enter a new password for your account.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6">
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm mb-3">S</div>
          <h2 className="text-lg font-bold text-slate-900">{titles[mode]}</h2>
          <p className="text-xs text-slate-500 mt-1">{subtitles[mode]}</p>
        </div>

        {!configured ? (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            Accounts aren&apos;t set up yet. Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>,
            then restart the app. Until then, your searches and saved items stay in this browser.
          </div>
        ) : (
          <>
            {isGoogleSignInEnabled() && (mode === 'signin' || mode === 'signup') && (
              <>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
                    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
                    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 my-4 text-[11px] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <Field icon={<UserIcon className="w-4 h-4" />} type="text" placeholder="Your name" value={name} onChange={setName} autoComplete="name" />
              )}
              {mode !== 'reset' && (
                <Field icon={<Mail className="w-4 h-4" />} type="email" placeholder="Email" value={email} onChange={setEmail} autoComplete="email" required />
              )}
              {mode !== 'forgot' && (
                <Field
                  icon={<Lock className="w-4 h-4" />}
                  type="password"
                  placeholder={mode === 'signin' ? 'Password' : 'New password (8+ characters)'}
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
              )}

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
                </p>
              )}
              {notice && (
                <p className="flex items-start gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}
              </button>
            </form>

            <div className="mt-4 text-xs text-slate-500 text-center space-y-1.5">
              {mode === 'signin' && (
                <>
                  <button className="text-blue-600 hover:underline" onClick={() => setMode('forgot')}>Forgot password?</button>
                  <p>
                    New to Siftly?{' '}
                    <button className="text-blue-600 font-semibold hover:underline" onClick={() => setMode('signup')}>Create an account</button>
                  </p>
                </>
              )}
              {(mode === 'signup' || mode === 'forgot') && (
                <p>
                  Already have an account?{' '}
                  <button className="text-blue-600 font-semibold hover:underline" onClick={() => setMode('signin')}>Sign in</button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function Field(props: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 bg-white">
      <span className="text-slate-400">{props.icon}</span>
      <input
        type={props.type}
        placeholder={props.placeholder}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required}
        className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
      />
    </label>
  );
}

function friendlyError(msg?: string): string {
  if (!msg) return 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (/provider is not enabled/i.test(msg)) return 'Google sign-in is not enabled for this project yet.';
  return msg;
}
