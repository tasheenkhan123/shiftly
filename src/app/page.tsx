'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, LogIn, Bookmark, Search, Check, Loader2, AlertCircle } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { AuthModal } from '@/components/AuthModal';
import { PriceComparisonModal } from '@/components/shopping/PriceComparisonModal';
import { SavedLooksDrawer } from '@/components/SavedLooksDrawer';
import { ChatSession, ChatMessage, ProductMatch, SearchProgressEvent } from '@/types';
import { useAuth } from '@/lib/supabase/useAuth';
import { getSupabase } from '@/lib/supabase/client';
import { cloudStore, localStore, migrateLocalToCloud, productKey, sortSessions, type UserDataStore } from '@/lib/store/userData';
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
  const [notice, setNotice] = useState<string | null>(null);

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
        const [list, saved] = await Promise.all([store.listSessions(), store.listSaved()]);
        if (cancelled) return;
        commitSessions(list);
        setSavedProducts(saved);
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
    const targetId = sessionId;

    let assistantMsg: ChatMessage;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, imagePreviewUrl: imageDataUrl, conversationHistory: history }),
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

      assistantMsg = {
        id: newId('msg_assistant'),
        sender: 'assistant',
        timestamp: nowTime(),
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
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">S</span>
              <span>Siftly</span>
              <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">· Smart shopping assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSavedDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved ({savedProducts.length})</span>
            </button>
            {ready && !user && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
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
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Search className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">What are you shopping for?</h1>
              <p className="text-sm text-slate-500 max-w-md">
                Describe what you need and your budget, or paste a screenshot of a product. Siftly finds the best options and compares
                prices and offers across Indian stores.
              </p>
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
              />
            ))
          )}

          {isLoading && <SearchProgress steps={progress} />}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-3 pb-1">
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        passwordRecovery={passwordRecovery}
        onPasswordRecoveryDone={clearPasswordRecovery}
      />

      <PriceComparisonModal product={activeModalProduct} currency="INR" onClose={() => setActiveModalProduct(null)} />

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
function SearchProgress({ steps }: { steps: ProgressStep[] }) {
  const shown = steps.length ? steps : [{ stage: 'understanding' as const, message: 'Starting search…' }];
  return (
    <div className="flex items-start gap-2.5 p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-md">
      <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">S</div>
      <ol className="space-y-1.5 text-xs">
        {shown.map((s, i) => {
          const current = i === shown.length - 1;
          return (
            <li key={i} className={`flex items-center gap-2 ${current ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              {current ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{s.message}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
