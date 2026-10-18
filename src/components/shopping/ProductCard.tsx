'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Bookmark, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Store,
  CheckCircle2,
  Info,
  ShoppingBag,
  Search
} from 'lucide-react';
import { ProductMatch } from '@/types';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';

interface ProductCardProps {
  product: ProductMatch;
  currency: string;
  isSaved?: boolean;
  onToggleSave?: (product: ProductMatch) => void;
  onOpenPriceComparison: (product: ProductMatch) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  isSaved = false,
  onToggleSave,
  onOpenPriceComparison
}) => {
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [imgError, setImgError] = useState(false);

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';
  const displayPrice = Math.round(product.lowestPrice * rate);

  const primaryMerchant = product.merchants?.[0];
  const urlCheck = validateExternalUrl(primaryMerchant?.productUrl);
  const isExactProduct = primaryMerchant?.urlType === 'PRODUCT';
  const isSearch = primaryMerchant?.urlType === 'SEARCH';
  const isAvailable = urlCheck.isValid && primaryMerchant?.urlType !== 'UNAVAILABLE';

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'EXACT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CLOSE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BUDGET_ALT':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'SEARCH_RESULT':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'EXACT':
        return 'Exact Match';
      case 'CLOSE':
        return 'Closest Match';
      case 'BUDGET_ALT':
        return 'Budget Alternative';
      case 'SEARCH_RESULT':
        return 'Search Result';
      default:
        return 'Similar Style';
    }
  };

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-lg transition-all duration-200">
      {/* Top Media Container */}
      <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden">
        {product.imageUrl && product.imageUrl.trim() && !imgError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-2 p-4 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">Product Image Unavailable</span>
          </div>
        )}

        {/* Floating Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {/* Match Tier Badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-xs ${getTierColor(product.matchTier)}`}>
            {getTierLabel(product.matchTier)}
          </span>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave?.(product);
            }}
            className={`pointer-events-auto p-1.5 rounded-full border shadow-sm transition-all ${
              isSaved
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white/90 text-slate-600 border-slate-200 hover:bg-white hover:text-blue-600'
            }`}
            title="Save item"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
          </button>
        </div>

        {/* Floating Bottom Confidence Badge */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs border border-slate-200 text-[11px] text-slate-800 shadow-xs font-semibold">
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span className="text-blue-700">{product.matchScore}%</span>
            <span className="text-[10px] text-slate-500">Match</span>
          </div>

          <button
            type="button"
            onClick={() => setShowScoreDetails(!showScoreDetails)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs border border-slate-200 text-[10px] text-slate-600 hover:text-slate-900 font-medium shadow-xs"
          >
            <Info className="w-3 h-3 text-blue-600" />
            <span>Why?</span>
            {showScoreDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Score Breakdown */}
      {showScoreDetails && (
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs space-y-2 animate-fade-in">
          <div className="font-semibold text-blue-700 flex items-center gap-1 text-[11px] uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Transparent Match Signals:
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Query Match:</span>
              <strong className="text-slate-900">{product.scoreBreakdown.semanticMatch || product.scoreBreakdown.visualSimilarity}%</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Brand Fit:</span>
              <strong className="text-slate-900">{product.scoreBreakdown.brandMatch}%</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Budget Alignment:</span>
              <strong className="text-slate-900">{product.scoreBreakdown.budgetFitBonus}%</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Store Verification:</span>
              <strong className="text-slate-900">{isExactProduct ? '100%' : '70%'}</strong>
            </div>
          </div>
          {product.matchReasons && product.matchReasons.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold block">Retrieved Evidence:</span>
              {product.matchReasons.slice(0, 2).map((reason, idx) => (
                <p key={idx} className="text-[10px] text-slate-600 line-clamp-2 leading-tight">
                  • {reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div>
          {/* Brand & Title */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            {product.brand && product.brand.trim().length > 0 ? (
              <span className="font-bold uppercase tracking-wider text-blue-600 text-[10px]">{product.brand}</span>
            ) : <span />}
            {product.productRating ? (
              <span className="flex items-center gap-1 text-amber-500 font-medium text-[11px]">
                ★ {product.productRating} {product.reviewsCount ? <span className="text-[10px] text-slate-400">({product.reviewsCount})</span> : null}
              </span>
            ) : null}
          </div>
          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
            {product.title}
          </h3>

          {/* Key Attributes Tags */}
          <div className="flex flex-wrap gap-1 mt-2.5">
            {Object.entries(product.keyAttributes).slice(0, 2).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600">
                <span className="text-slate-400">{k}:</span> {v}
              </span>
            ))}
          </div>
        </div>

        {/* Pricing & Actions Section */}
        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-semibold">
                {isExactProduct ? 'Verified Price' : 'Est. Price'}
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900">
                {symbol}{displayPrice.toLocaleString()}
              </span>
            </div>

            <div className="text-right">
              {isExactProduct ? (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                  <CheckCircle2 className="w-3 h-3" /> Direct Product Page
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 justify-end">
                  Store Listing
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                {product.availableMerchantsCount} {product.availableMerchantsCount === 1 ? 'store link' : 'store links'}
              </span>
            </div>
          </div>

          {/* Action Buttons: Direct External Navigation & Compare Modal */}
          <div className="flex flex-col gap-1.5">
            {/* Primary Direct Navigation Button */}
            {isAvailable && urlCheck.sanitizedUrl ? (
              <a
                href={urlCheck.sanitizedUrl}
                {...SAFE_EXTERNAL_LINK_PROPS}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs active:scale-[0.98]"
              >
                {isExactProduct ? (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Buy on {primaryMerchant.sellerName}</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Search this store</span>
                  </>
                )}
                <ExternalLink className="w-3 h-3 ml-auto opacity-80" />
              </a>
            ) : (
              <button
                disabled
                className="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs border border-slate-200 cursor-not-allowed"
              >
                Product link unavailable
              </button>
            )}

            {/* Compare Prices Modal Trigger */}
            <button
              type="button"
              onClick={() => onOpenPriceComparison(product)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-[0.98]"
            >
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>Compare {product.merchants.length} Stores</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
