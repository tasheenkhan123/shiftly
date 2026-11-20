'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, LogIn, Bookmark, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { AuthModal } from '@/components/AuthModal';
import { PriceComparisonModal } from '@/components/shopping/PriceComparisonModal';
import { SavedLooksDrawer } from '@/components/SavedLooksDrawer';
import { PreferencesModal } from '@/components/PreferencesModal';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CategoryTile } from '@/components/CategoryIcon';
import { SELECTABLE_CATEGORIES, MIXED_EXAMPLES, getCategory, type CategoryId, type PreferenceProfile } from '@/lib/categories';
import { ChatSession, ChatMessage, ProductMatch, SearchProgressEvent } from '@/types';
import { useAuth } from '@/lib/supabase/useAuth';
import { getSupabase } from '@/lib/supabase/client';
import { cloudStore, localStore, mergeProfile, migrateLocalToCloud, productKey, sortSessions, type UserDataStore } from '@/lib/store/userData';
import { downscaleImage } from '@/lib/image';

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

type ProgressStep = { stage: SearchProgressEvent['stage']; message: string };

export default function HomePage() {
  const { user, ready, signOut, passwordRecovery, clearPasswordRecovery } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [savedProducts, setSavedProducts] = useState<ProductMatch[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [activeModalProduct, setActiveModalProduct] = useState<ProductMatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [searchStartedAt, setSearchStartedAt] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<PreferenceProfile>({});
  const profileRef = useRef<PreferenceProfile>({});
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const finishOnboarding = () => {
    setShowOnboarding(false);
    try {
      if (user) localStorage.setItem(`siftly_onboarded_${user.id}`, '1');
    } catch {}
  };
  const [prefsCategory, setPrefsCategory] = useState<CategoryId | undefined>(undefined);
  // Quick questions the user skipped ("skincare.skinType"), remembered per browser
  const [dismissedQuestions, setDismissedQuestions] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDismissedQuestions(JSON.parse(localStorage.getItem('siftly_dismissed_questions') || '[]'));
    } catch {}
  }, []);
  const dismissQuestion = (id: string) => {
    const next = Array.from(new Set([...dismissedQuestions, id]));
    setDismissedQuestions(next);
    try {
      localStorage.setItem('siftly_dismissed_questions', JSON.stringify(next));
    } catch {}
  };
  const openPreferences = (categoryId?: string) => {
    setPrefsCategory((categoryId as CategoryId) || selectedCategory || undefined);
    setIsPrefsOpen(true);
  };

  const commitProfile = (next: PreferenceProfile) => {
    profileRef.current = next;
    setProfile(next);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<ChatSession[]>([]);

  /** Single place that changes the session list, so the ref used for saving is never stale */
  const commitSessions = useCallback((next: ChatSession[]) => {
    const sorted = sortSessions(next);
    sessionsRef.current = sorted;
    setSessions(sorted);
  }, []);


  // Signed in -> Supabase; guest -> this browser
  const store: UserDataStore = useMemo(() => {
    const sb = getSupabase();
    return user && sb ? cloudStore(sb) : localStore;
  }, [user]);

  const reportError = useCallback((err: unknown) => {
    // warn (not error): the message is already shown to the user in the notice bar
    console.warn(err);
    setNotice(err instanceof Error ? err.message : 'Something went wrong while saving.');
  }, []);

  // Load the right user's data whenever sign-in state changes
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        if (store.kind === 'cloud') {
          const moved = await migrateLocalToCloud(store);
          if (moved > 0 && !cancelled) setNotice(`Moved ${moved} chats and saved items from this browser into your account.`);
        }
        // Load each independently: one missing table must not hide the user's other data
        const [listR, savedR, prefsR] = await Promise.allSettled([store.listSessions(), store.listSaved(), store.getProfile()]);
        if (cancelled) return;
        const firstError = [listR, savedR, prefsR].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (firstError) reportError(firstError.reason);
        const list = listR.status === 'fulfilled' ? listR.value : [];
        const saved = savedR.status === 'fulfilled' ? savedR.value : [];
        const prefs = prefsR.status === 'fulfilled' ? prefsR.value : {};
        commitSessions(list);
        setSavedProducts(saved);
        let loadedProfile: PreferenceProfile = prefs;
        // "I usually shop for" chosen at sign-up lives in the account metadata until first load
        if (user?.shopsFor && !loadedProfile.global?.shopsFor) {
          loadedProfile = mergeProfile(loadedProfile, 'global', { shopsFor: user.shopsFor });
          store.saveProfile(loadedProfile).catch(reportError);
        }
        profileRef.current = loadedProfile;
        setProfile(loadedProfile);
        // Offer the optional "get to know you" step once per account
        if (user && prefsR.status === 'fulfilled') {
          let seen = false;
          try {
            seen = localStorage.getItem(`siftly_onboarded_${user.id}`) === '1';
          } catch {}
          const hasPersonalInfo = Object.entries(loadedProfile).some(([k, v]) => k !== 'global' && v && Object.keys(v).length > 0);
          if (!seen && !hasPersonalInfo) setShowOnboarding(true);
        }
        setActiveSessionId(list[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) reportError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, store, reportError, commitSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading, progress.length]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const currentMessages = activeSession?.messages || [];

  /** Update one session, show it, and persist it */
  const updateSession = useCallback(
    (id: string, change: (s: ChatSession) => ChatSession) => {
      const current = sessionsRef.current.find(s => s.id === id);
      if (!current) return;
      const updated = change(current);
      commitSessions(sessionsRef.current.map(s => (s.id === id ? updated : s)));
      store.upsertSession(updated).catch(reportError);
    },
    [store, reportError, commitSessions]
  );

  const handleNewChat = () => {
    setActiveSessionId(null);
    setSelectedCategory(null);
    setForSomeoneElse(false);
    setSidebarOpen(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = sessionsRef.current.filter(s => s.id !== id);
    commitSessions(next);
    if (activeSessionId === id) setActiveSessionId(next[0]?.id ?? null);
    store.deleteSession(id).catch(reportError);
  };

  const handleTogglePin = (id: string) => {
    updateSession(id, s => ({ ...s, pinned: !s.pinned }));
  };

  const handleSendMessage = async (text: string, imageDataUrl?: string) => {
    if (isLoading) return;
    const thumb = imageDataUrl ? await downscaleImage(imageDataUrl, 360, 0.7).catch(() => undefined) : undefined;

    const userMsg: ChatMessage = {
      id: newId('msg'),
      sender: 'user',
      timestamp: nowTime(),
      text: text || (imageDataUrl ? 'Find this product' : ''),
      mediaUrl: thumb,
      mediaType: thumb ? 'image' : undefined,
    };

    const existing = activeSession;
    const history = (existing?.messages || []).slice(-6).map(m => ({
      sender: m.sender,
      text: m.text || '',
      previousProducts: m.analysisResult?.productMatches
        ? Object.values(m.analysisResult.productMatches)
            .flat()
            .map(p => ({ title: p.title, brand: p.brand, price: p.lowestPrice }))
        : [],
    }));

    let sessionId = existing?.id;
    if (!sessionId) {
      const fresh: ChatSession = {
        id: newId('chat'),
        title: (text || 'Image search').slice(0, 40),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        messages: [userMsg],
      };
      sessionId = fresh.id;
      commitSessions([fresh, ...sessionsRef.current]);
      setActiveSessionId(fresh.id);
      store.upsertSession(fresh).catch(reportError);
    } else {
      updateSession(sessionId, s => ({
        ...s,
        title: s.messages.length === 0 ? (text || 'Image search').slice(0, 40) : s.title,
        updatedAt: new Date().toISOString(),
        messages: [...s.messages, userMsg],
      }));
    }

    setIsLoading(true);
    setProgress([]);
    const started = Date.now();
    setSearchStartedAt(started);
    const targetId = sessionId;

    let assistantMsg: ChatMessage;
    try {
      // Signed-in users send their session token so they get the higher search limit
      const token = user ? (await getSupabase()?.auth.getSession())?.data.session?.access_token : undefined;
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          input: text,
          imagePreviewUrl: imageDataUrl,
          conversationHistory: history,
          profile: profileRef.current,
          category: selectedCategory || undefined,
          forSomeoneElse,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Search failed. Please try again.');
      }

      // Read the newline-delimited JSON stream: progress events, then one result
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let data: any = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const evt = JSON.parse(line);
          if (evt.type === 'progress') setProgress(prev => [...prev, { stage: evt.stage, message: evt.message }]);
          else if (evt.type === 'result') data = evt.data;
          else if (evt.type === 'error') throw new Error(evt.message);
        }
      }
      if (!data) throw new Error('The search ended without a result. Please try again.');

      // Remember what the user told us about themselves ("I have oily skin", "size 9")
      const learned: Record<string, string> = data.learnedPreferences || {};
      if (data.categoryId && Object.keys(learned).length > 0) {
        const before = profileRef.current[data.categoryId as CategoryId] || {};
        const changed = Object.entries(learned).filter(([k, v]) => before[k] !== v);
        if (changed.length > 0) {
          const next = mergeProfile(profileRef.current, data.categoryId, learned);
          commitProfile(next);
          store.saveProfile(next).catch(reportError);
          const fields = getCategory(data.categoryId).preferenceFields;
          const desc = changed.map(([k, v]) => `${fields.find(f => f.key === k)?.label || k}: ${v}`).join(', ');
          setNotice(`Remembered for next time: ${desc}. You can change this in Your preferences.`);
        }
      }

      assistantMsg = {
        id: newId('msg_assistant'),
        sender: 'assistant',
        timestamp: nowTime(),
        searchSeconds: Math.round((Date.now() - started) / 1000),
        text: data.customSummary || 'Here is what I found.',
        analysisResult: data,
        isGroundingActive: data.isGroundingActive,
        groundingSources: data.groundingSources,
      };
    } catch (err: any) {
      assistantMsg = {
        id: newId('msg_err'),
        sender: 'assistant',
        timestamp: nowTime(),
        text: err?.message || 'Sorry, something went wrong. Please try again.',
      };
    }

    updateSession(targetId, s => ({ ...s, updatedAt: new Date().toISOString(), messages: [...s.messages, assistantMsg] }));
    setIsLoading(false);
    setProgress([]);
  };

  const savedKeys = useMemo(() => new Set(savedProducts.map(productKey)), [savedProducts]);

  const handleToggleSaveProduct = (product: ProductMatch) => {
    const key = productKey(product);
    if (savedKeys.has(key)) {
      setSavedProducts(prev => prev.filter(p => productKey(p) !== key));
      store.removeSaved(product).catch(reportError);
    } else {
      setSavedProducts(prev => [product, ...prev]);
      store.saveProduct(product).catch(reportError);
      if (!user) setNotice('Saved in this browser. Sign in to keep saved items in your account.');
    }
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden text-slate-900">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={id => {
          setActiveSessionId(id);
          setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onTogglePin={handleTogglePin}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPreferences={() => openPreferences()}
        onOpenSaved={() => {
          setIsSavedDrawerOpen(true);
          setSidebarOpen(false);
        }}
        onShowChat={() => {
          setIsPrefsOpen(false);
          setIsSavedDrawerOpen(false);
          setSidebarOpen(false);
        }}
        savedCount={savedProducts.length}
        onSignOut={signOut}
      />

      <div className="flex-1 flex flex-col h-full lg:pl-64 transition-all duration-200 min-w-0">
        <header className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
              title="Toggle sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            {/* Logo only on small screens, where the sidebar (with the logo) is hidden */}
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm lg:hidden">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">S</span>
              <span>Siftly</span>
            </div>
            {/* On desktop: the open chat's title */}
            {activeSession && activeSession.messages.length > 0 && (
              <span className="hidden lg:block text-sm font-semibold text-slate-700 truncate max-w-md">{activeSession.title}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSavedDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved ({savedProducts.length})</span>
            </button>
            <button
              onClick={() => openPreferences()}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
              title="Your preferences"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Preferences</span>
              {!Object.values(profile).some(v => v && Object.keys(v).length > 0) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600" aria-label="Not set yet" />
              )}
            </button>
            {ready && !user && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign up</span>
              </button>
            )}
          </div>
        </header>

        {notice && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs flex items-center gap-2 self-center max-w-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 pb-36 space-y-4">
          {currentMessages.length === 0 && !isLoading ? (
            <div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-4 space-y-4 py-12">
              {/* Pops in on open: heading, then description, then categories */}
              <h1 className="siftly-pop text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">What are you shopping for?</h1>
              <p className="siftly-pop text-sm text-slate-500 max-w-md" style={{ animationDelay: '120ms' }}>
                Describe what you need and your budget, or paste a screenshot of a product. Siftly finds the best options for you and
                compares prices and offers across Indian stores.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {SELECTABLE_CATEGORIES.map((c, i) => {
                  const on = selectedCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(on ? null : c.id)}
                      aria-pressed={on}
                      aria-label={c.label}
                      style={{ animationDelay: `${240 + i * 50}ms` }}
                      className={`siftly-pop group relative p-1.5 rounded-2xl border transition-colors ${
                        on ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <CategoryTile id={c.id} size="lg" />
                      {/* Name on hover / focus */}
                      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            currentMessages.map(msg => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                currency="INR"
                onOpenPriceComparison={setActiveModalProduct}
                onToggleSave={handleToggleSaveProduct}
                savedProductIds={savedKeys}
                onEditPreferences={openPreferences}
                isQuestionHidden={(categoryId, key) =>
                  dismissedQuestions.includes(`${categoryId}.${key}`)
                }
                isPreferenceKnown={(categoryId, key) => Boolean(profile[categoryId as CategoryId]?.[key])}
                onAnswerPreference={(categoryId, key, value) => {
                  const next = mergeProfile(profileRef.current, categoryId, { [key]: value });
                  commitProfile(next);
                  store.saveProfile(next).catch(reportError);
                }}
                onDismissQuestion={(categoryId, key) => dismissQuestion(`${categoryId}.${key}`)}
                onRedoSearch={() => {
                  // Re-run the user message that produced this answer, now with the new preference
                  const idx = currentMessages.findIndex(m => m.id === msg.id);
                  const prevUser = [...currentMessages.slice(0, idx)].reverse().find(m => m.sender === 'user');
                  if (prevUser?.text && !prevUser.mediaUrl) handleSendMessage(prevUser.text);
                }}
              />
            ))
          )}

          {isLoading && <SearchProgress steps={progress} startedAt={searchStartedAt} />}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-3 pb-1">
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            examples={selectedCategory ? getCategory(selectedCategory).examples : MIXED_EXAMPLES}
            forSomeoneElse={forSomeoneElse}
            onToggleForSomeoneElse={() => setForSomeoneElse(v => !v)}
          />
        </div>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        passwordRecovery={passwordRecovery}
        onPasswordRecoveryDone={clearPasswordRecovery}
      />

      <PriceComparisonModal product={activeModalProduct} currency="INR" onClose={() => setActiveModalProduct(null)} />

      <OnboardingModal
        isOpen={showOnboarding}
        name={user?.fullName}
        initial={profile}
        onSkip={finishOnboarding}
        onSave={next => {
          commitProfile(next);
          store.saveProfile(next).catch(reportError);
          finishOnboarding();
          setNotice('Thanks! Your picks will now be personalised.');
        }}
      />

      <PreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
        profile={profile}
        signedIn={Boolean(user)}
        initialCategory={prefsCategory}
        onSave={next => {
          commitProfile(next);
          store.saveProfile(next).catch(reportError);
          setNotice('Preferences saved.');
        }}
      />

      <SavedLooksDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedProducts={savedProducts}
        onRemoveProduct={id => {
          const p = savedProducts.find(x => x.id === id);
          if (p) handleToggleSaveProduct(p);
        }}
        currency="INR"
      />
    </div>
  );
}

/** Live search steps, streamed from the server */
/**
 * One live "thinking" line that updates in place (like ChatGPT), with a timer.
 * The text shimmers while the search runs; only the latest step is shown.
 */
function SearchProgress({ steps, startedAt }: { steps: ProgressStep[]; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const current = steps.length ? steps[steps.length - 1].message : 'Thinking…';
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="flex items-center gap-2.5 px-1 py-2" aria-live="polite">
      <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">S</div>
      <span key={current} className="text-sm font-medium siftly-shimmer animate-fade-in">
        {current}
      </span>
      {seconds >= 3 && <span className="text-[11px] text-slate-400 tabular-nums">{seconds}s</span>}
    </div>
  );
}
