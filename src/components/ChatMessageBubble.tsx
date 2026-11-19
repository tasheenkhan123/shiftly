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
import { RecipeView } from '@/components/recipe/RecipeView';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';
import { RichText } from '@/components/RichText';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  currency: string;
  onOpenPriceComparison: (product: ProductMatch) => void;
  onToggleSave?: (product: ProductMatch) => void;
  savedProductIds?: Set<string>;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  currency,
  onOpenPriceComparison,
  onToggleSave,
  savedProductIds = new Set()
}) => {
  const isUser = message.sender === 'user';

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
  const googleShoppingCheck = validateExternalUrl(message.googleShoppingUrl);
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

          {/* Google Shopping & Direct Web Source Actions */}
          {googleShoppingCheck.isValid && googleShoppingCheck.sanitizedUrl && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Real Google Shopping Index</h4>
                  <p className="text-[11px] text-slate-500">Live verified search for this product across all web stores</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={googleShoppingCheck.sanitizedUrl}
                  {...SAFE_EXTERNAL_LINK_PROPS}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                >
                  <span>Open Google Shopping</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* If Recipe Intent */}
          {message.analysisResult?.intent === 'RECIPE' && message.analysisResult.recipeData && (
            <RecipeView
              recipe={message.analysisResult.recipeData}
              currency={currency}
            />
          )}

          {/* If Shopping Intent: Render Matching Products */}
          {message.analysisResult && message.analysisResult.intent !== 'RECIPE' && Object.values(message.analysisResult.productMatches || {}).flat().length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Top Product Recommendations & Live Store Comparison
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {Object.values(message.analysisResult.productMatches).flat().length} item(s) found
                </span>
              </div>

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
                              isSaved={savedProductIds.has(product.id)}
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
                      isSaved={savedProductIds.has(product.id)}
                      onToggleSave={onToggleSave}
                      onOpenPriceComparison={onOpenPriceComparison}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
