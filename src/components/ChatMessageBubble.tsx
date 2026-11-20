'use client';

import React from 'react';
import { 
  ExternalLink, 
  Search, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { ChatMessage, ProductMatch } from '@/types';
import { ProductCard } from '@/components/shopping/ProductCard';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';
import { RichText } from '@/components/RichText';
import { productKey } from '@/lib/store/userData';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  currency: string;
  onOpenPriceComparison: (product: ProductMatch) => void;
  onToggleSave?: (product: ProductMatch) => void;
  savedProductIds?: Set<string>;
  /** Opens the preferences panel on a category (from the "Picked for you" chips) */
  onEditPreferences?: (categoryId?: string) => void;
  /** Quick preference question under results */
  isQuestionHidden?: (categoryId: string, key: string) => boolean;
  isPreferenceKnown?: (categoryId: string, key: string) => boolean;
  onAnswerPreference?: (categoryId: string, key: string, value: string) => void;
  onDismissQuestion?: (categoryId: string, key: string) => void;
  onRedoSearch?: () => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  currency,
  onOpenPriceComparison,
  onToggleSave,
  savedProductIds = new Set(),
  onEditPreferences,
  isQuestionHidden,
  isPreferenceKnown,
  onAnswerPreference,
  onDismissQuestion,
  onRedoSearch
}) => {
  const isUser = message.sender === 'user';
  const [answered, setAnswered] = React.useState<string | null>(null);

  // 1. User Message (iOS / WhatsApp Blue Style)
  if (isUser) {
    return (
      <div className="flex justify-end w-full animate-fade-in my-3">
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          {message.mediaUrl && message.mediaType === 'image' && (
            <div className="mb-2 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-md max-w-xs bg-white">
              <img
                src={message.mediaUrl}
                alt="Uploaded search context"
                className="w-full h-auto max-h-60 object-cover"
              />
            </div>
          )}

          <div className="bubble-user">
            <p className="text-sm sm:text-base font-normal leading-relaxed whitespace-pre-wrap">
              {message.text}
            </p>
          </div>

          <span className="text-[10px] text-slate-400 mt-1 mr-1">
            {message.timestamp}
          </span>
        </div>
      </div>
    );
  }

  // 2. Assistant Response (Clean White Box with Verified Google Shopping & Product Cards)
  const configurationNotice = message.configurationNotice || message.analysisResult?.configurationNotice;
  const isGroundingActive = message.isGroundingActive || message.analysisResult?.isGroundingActive;
  const groundingSources = message.groundingSources || message.analysisResult?.groundingSources || [];

  return (
    <div className="flex justify-start w-full animate-fade-in my-4">
      <div className="flex flex-col items-start w-full max-w-full sm:max-w-4xl space-y-2">
        {/* Assistant Header Badge */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            S
          </div>
          <span className="text-xs font-bold text-slate-800">Siftly Search Assistant</span>
          <span className="text-[10px] text-slate-400">• {message.timestamp}</span>
        </div>

        {/* Assistant Message Content Container */}
        <div className="bubble-assistant p-4 sm:p-6 space-y-5">
          {/* Configuration Notice if Gemini API Key is missing */}
          {configurationNotice && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-amber-950">
                  {configurationNotice.toLowerCase().includes('not configured') ? 'Gemini API Key Required' : 'Service Notice'}
                </strong>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  {configurationNotice}
                </p>
                {configurationNotice.toLowerCase().includes('not configured') && (
                  <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-xl font-mono">
                    GEMINI_API_KEY=your_key_here
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grounding Active Badge */}
          {isGroundingActive && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {Object.values(message.analysisResult?.productMatches || {}).flat()[0]?.dataSource === 'Google Shopping'
                  ? 'Live prices from Google Shopping'
                  : 'Live web search'}
              </span>
            </div>
          )}

          {/* Main Text Response */}
          {message.text && (
            <RichText text={message.text} className="text-sm sm:text-base text-slate-800 leading-relaxed space-y-1" />
          )}

          {/* Why these picks: tap a chip to change that preference */}
          {(message.analysisResult?.activePreferences?.length || 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 -mt-2">
              <span className="text-[11px] font-semibold text-violet-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Picked for you:
              </span>
              {message.analysisResult!.activePreferences!.map((tag, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onEditPreferences?.(message.analysisResult?.categoryId)}
                  className="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-[11px] text-violet-800 hover:bg-violet-100"
                  title="Change this preference"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          {message.analysisResult?.assumptions && (
            <p className="text-[11px] text-slate-500 -mt-2">{message.analysisResult.assumptions}</p>
          )}

          {/* Grounding Web Sources / Citations */}
          {groundingSources.length > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Web Sources & Citations ({groundingSources.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {groundingSources.map((source, idx) => {
                  const check = validateExternalUrl(source.url);
                  if (!check.isValid || !check.sanitizedUrl) return null;
                  return (
                    <a
                      key={idx}
                      href={check.sanitizedUrl}
                      {...SAFE_EXTERNAL_LINK_PROPS}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-700 text-xs flex items-center gap-1 transition-all shadow-2xs"
                      title={source.url}
                    >
                      <span className="truncate max-w-[220px]">{source.title || 'Source'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}


          {/* If Shopping Intent: Render Matching Products */}
          {message.analysisResult && Object.values(message.analysisResult.productMatches || {}).flat().length > 0 && (
            <div className="space-y-4">

              {/* Product Grid: Group by component category for complete setups/bundles, or flat grid for single targets */}
              {message.analysisResult.detectedEntities && message.analysisResult.detectedEntities.length > 1 ? (
                <div className="space-y-6">
                  {message.analysisResult.detectedEntities.map((entity) => {
                    const matches = message.analysisResult?.productMatches?.[entity.id] || [];
                    if (matches.length === 0) return null;
                    return (
                      <div key={entity.id} className="space-y-3">
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                              {entity.name}
                            </h4>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {matches.length} alternative{matches.length > 1 ? 's' : ''} available
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {matches.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              currency={currency}
                              isSaved={savedProductIds.has(productKey(product))}
                              onToggleSave={onToggleSave}
                              onOpenPriceComparison={onOpenPriceComparison}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.values(message.analysisResult.productMatches).flat().map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currency={currency}
                      isSaved={savedProductIds.has(productKey(product))}
                      onToggleSave={onToggleSave}
                      onOpenPriceComparison={onOpenPriceComparison}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {message.analysisResult?.followUpQuestion && (
            <p className="text-sm text-slate-700 pt-1">{message.analysisResult.followUpQuestion}</p>
          )}

          {(() => {
            const ask = message.analysisResult?.askPreference;
            if (!ask || !onAnswerPreference) return null;
            if (!answered && (isQuestionHidden?.(ask.categoryId, ask.key) || isPreferenceKnown?.(ask.categoryId, ask.key))) return null;
            return (
              <div className="p-3 rounded-2xl bg-violet-50/60 border border-violet-200 space-y-2">
                {answered ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-violet-900">
                    <span>
                      Got it: <strong>{answered}</strong>. I&apos;ll use this for your next searches.
                    </span>
                    {onRedoSearch && (
                      <button
                        type="button"
                        onClick={onRedoSearch}
                        className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                      >
                        Redo this search with it
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-violet-900 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Quick question so I can personalise: {ask.question}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDismissQuestion?.(ask.categoryId, ask.key)}
                        className="text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        Skip
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ask.options.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setAnswered(opt);
                            onAnswerPreference(ask.categoryId, ask.key, opt);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 text-xs text-violet-900 hover:bg-violet-100"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
