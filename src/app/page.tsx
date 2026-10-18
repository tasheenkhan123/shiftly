'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  PanelLeft, 
  Plus, 
  LogIn, 
  User, 
  Bookmark, 
  Search, 
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { AuthModal } from '@/components/AuthModal';
import { PriceComparisonModal } from '@/components/shopping/PriceComparisonModal';
import { SavedLooksDrawer } from '@/components/SavedLooksDrawer';
import { ChatSession, ChatMessage, UserProfile, ProductMatch, SiftlyAnalysisResult } from '@/types';

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [savedProducts, setSavedProducts] = useState<ProductMatch[]>([]);
  const [activeModalProduct, setActiveModalProduct] = useState<ProductMatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user & sessions from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('siftly_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }

    const savedSessions = localStorage.getItem('siftly_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) {}
    }
  }, []);

  // Save sessions to localStorage
  const saveSessionsToStorage = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem('siftly_sessions', JSON.stringify(updated));
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const currentMessages = activeSession ? activeSession.messages : [];

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `chat_${Date.now()}`,
      title: 'New Search',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    const updated = [newSession, ...sessions];
    saveSessionsToStorage(updated);
    setActiveSessionId(newSession.id);
    setSidebarOpen(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    saveSessionsToStorage(updated);
    if (activeSessionId === id) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleSendMessage = async (
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'link' | 'file'
  ) => {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: text || (mediaUrl ? 'Find the product in this screenshot' : ''),
      mediaUrl,
      mediaType,
    };

    let targetSessionId = activeSessionId;
    let updatedSessions = [...sessions];

    if (!targetSessionId || !activeSession) {
      const newSession: ChatSession = {
        id: `chat_${Date.now()}`,
        title: text.slice(0, 28) || 'Visual Search',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: new Date().toISOString(),
        messages: [userMsg]
      };
      targetSessionId = newSession.id;
      updatedSessions = [newSession, ...sessions];
      setActiveSessionId(targetSessionId);
    } else {
      updatedSessions = sessions.map((s) => {
        if (s.id === targetSessionId) {
          const isFirst = s.messages.length === 0;
          return {
            ...s,
            title: isFirst ? (text.slice(0, 28) || 'Visual Search') : s.title,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, userMsg]
          };
        }
        return s;
      });
    }

    saveSessionsToStorage(updatedSessions);
    setIsLoading(true);

    try {
      // Extract recent conversation history to maintain context
      const existingMessages = activeSession?.messages || [];
      const conversationHistory = existingMessages.slice(-6).map((m) => {
        let prevProducts: Array<{ title: string; brand: string; price: number }> = [];
        if (m.analysisResult?.productMatches) {
          const allMatches = Object.values(m.analysisResult.productMatches).flat();
          prevProducts = allMatches.map(p => ({ title: p.title, brand: p.brand, price: p.lowestPrice }));
        }
        return {
          sender: m.sender,
          text: m.text || '',
          previousProducts: prevProducts
        };
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          imagePreviewUrl: mediaUrl && mediaType === 'image' ? mediaUrl : undefined,
          conversationHistory,
        }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();

      let assistantReplyText = '';
      if (data.customSummary) {
        assistantReplyText = data.customSummary;
      } else if (data.intent === 'RECIPE') {
        assistantReplyText = `I extracted the recipe for **${data.recipeData?.dishName}**! Here is the complete shopping checklist, cooking steps, and cheaper pantry substitutions.`;
      } else {
        const entityName = data.detectedEntities?.[0]?.name || 'your search';
        const budgetStr = data.userConstraints?.budgetMax ? ` within your budget of ₹${data.userConstraints.budgetMax.toLocaleString()}` : '';
        if (mediaUrl) {
          assistantReplyText = `I analyzed your screenshot for **${entityName}**${budgetStr}. Below are matching items and retailer links.`;
        } else {
          assistantReplyText = `I searched for **${entityName}**${budgetStr}. Below are matching recommendations and retailer links across top stores.`;
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg_assistant_${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: assistantReplyText,
        analysisResult: data,
        googleShoppingUrl: data.googleShoppingUrl,
        googleLensUrl: data.googleLensUrl,
        directWebResults: data.directWebResults,
        groundingSources: data.groundingSources,
        isGroundingActive: data.isGroundingActive,
        configurationNotice: data.configurationNotice
      };

      const finalSessions = updatedSessions.map((s) => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            messages: [...s.messages, assistantMsg]
          };
        }
        return s;
      });

      saveSessionsToStorage(finalSessions);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: 'Sorry, I encountered an issue searching for this item. Please try another screenshot or query.',
      };
      const finalSessions = updatedSessions.map((s) => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            messages: [...s.messages, errorMsg]
          };
        }
        return s;
      });
      saveSessionsToStorage(finalSessions);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSaveProduct = (product: ProductMatch) => {
    setSavedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const handleSignOut = () => {
    localStorage.removeItem('siftly_user');
    setUser(null);
  };

  const savedProductIds = new Set(savedProducts.map((p) => p.id));

  return (
    <div className="flex h-screen bg-white overflow-hidden text-slate-900">
      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Chat Content Column */}
      <div className="flex-1 flex flex-col h-full lg:pl-64 transition-all duration-200">
        {/* Top Navbar */}
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
              <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">• Visual Product & Recipe Search</span>
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

            {!user?.isLoggedIn && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Scrollable Area with generous bottom padding so cards are fully visible */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 pb-36 space-y-4">
          {currentMessages.length === 0 ? (
            /* Clean Minimalist Empty State */
            <div className="h-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-4 space-y-6 py-12">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Search className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  What can I help you find today?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Drop any screenshot, product photo, Instagram link, or describe what you are looking for to compare live prices.
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-2">
                <button
                  onClick={() => handleSendMessage('NIVEA Cherry Shine 24h Moisture Lip Balm with Strawberry & Berry Tints', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&auto=format&fit=crop&q=80', 'image')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">💄 NIVEA Cherry Lip Balm & Tints</span>
                  <span className="text-[11px] text-slate-500">Cherry & Strawberry shades with 3 store prices</span>
                </button>

                <button
                  onClick={() => handleSendMessage('Minimalist 10% Niacinamide + Zinc Face Serum')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">🧴 Minimalist Niacinamide Serum</span>
                  <span className="text-[11px] text-slate-500">Direct Amazon, Nykaa & Tira product pages</span>
                </button>

                <button
                  onClick={() => handleSendMessage('Medicube Red Clear Cica Body Wash (Exfoliating AHA BHA)', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80', 'image')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">🧼 Medicube Exfoliating Body Wash</span>
                  <span className="text-[11px] text-slate-500">Direct Amazon & Nykaa product links</span>
                </button>

                <button
                  onClick={() => handleSendMessage('Find this emerald green satin wrap dress under ₹2,000', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80', 'image')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">👗 Find dress under ₹2,000</span>
                  <span className="text-[11px] text-slate-500">Visual search & compare store prices</span>
                </button>

                <button
                  onClick={() => handleSendMessage('https://www.youtube.com/watch?v=7X89k_KoreanSpicyNoodles', undefined, 'link')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">🍜 Extract recipe ingredients</span>
                  <span className="text-[11px] text-slate-500">Checklist & cheaper substitutes</span>
                </button>

                <button
                  onClick={() => handleSendMessage('Find a structured crescent leather shoulder bag alternative under ₹3,500', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80', 'image')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all text-xs font-medium text-slate-700 hover:text-blue-900 shadow-xs"
                >
                  <span className="font-bold block text-slate-900">👜 Find bag alternatives</span>
                  <span className="text-[11px] text-slate-500">Budget fashion duplicates</span>
                </button>
              </div>
            </div>
          ) : (
            currentMessages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                currency="INR"
                onOpenPriceComparison={setActiveModalProduct}
                onToggleSave={handleToggleSaveProduct}
                savedProductIds={savedProductIds}
              />
            ))
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-sm animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">S</div>
              <span className="text-xs font-medium text-slate-700">Searching Google & verified sellers...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Chat Input Bar with backdrop protection */}
        <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-3 pb-1">
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      {/* Price Comparison Modal */}
      <PriceComparisonModal
        product={activeModalProduct}
        currency="INR"
        onClose={() => setActiveModalProduct(null)}
      />

      {/* Saved Looks Drawer */}
      <SavedLooksDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedProducts={savedProducts}
        onRemoveProduct={(id) => setSavedProducts((prev) => prev.filter((p) => p.id !== id))}
        currency="INR"
      />
    </div>
  );
}
