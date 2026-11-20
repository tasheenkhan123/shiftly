'use client';

import React, { useState } from 'react';
import { ExternalLink, Bookmark, Store, CheckCircle2, ShoppingBag, Search, Sparkles, ShieldCheck } from 'lucide-react';
import { ProductMatch } from '@/types';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';

interface ProductCardProps {
  product: ProductMatch;
  currency: string;
  isSaved?: boolean;
  onToggleSave?: (product: ProductMatch) => void;
  onOpenPriceComparison: (product: ProductMatch) => void;
}

const OFFER_REGEX = /off|cashback|bank|card|upi|coupon|emi|save/i;

export const ProductCard: React.FC<ProductCardProps> = ({ product, currency, isSaved = false, onToggleSave, onOpenPriceComparison }) => {
  const [imgError, setImgError] = useState(false);

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';
  const fmt = (n: number) => `${symbol}${Math.round(n * rate).toLocaleString('en-IN')}`;

  const primary = product.merchants?.[0];
  const urlCheck = validateExternalUrl(primary?.productUrl);
  const isAvailable = urlCheck.isValid && primary?.urlType !== 'UNAVAILABLE';
  const priceKnown = product.priceKnown !== false && product.lowestPrice > 0;
  const fromGoogleShopping = product.dataSource === 'Google Shopping';
  const storeCount = product.merchants.length;

  // A google.* link is a Google Shopping page, except /goto?url=... which redirects straight to the store
  const linkIsGoogle = (() => {
    try {
      const u = new URL(primary?.productUrl || '');
      return /(^|\.)google\./i.test(u.hostname) && !u.pathname.startsWith('/goto');
    } catch {
      return false;
    }
  })();

  const bestOfferEntry = product.merchants
    .flatMap(m => (m.offers || []).map(o => ({ text: o, store: m.sellerName })))
    .find(o => OFFER_REGEX.test(o.text));
  const bestOffer = bestOfferEntry ? (storeCount > 1 ? `${bestOfferEntry.text} (${bestOfferEntry.store})` : bestOfferEntry.text) : undefined;

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-lg transition-all duration-200">
      {/* Image */}
      <div className="relative w-full aspect-[4/5] bg-slate-50 overflow-hidden">
        {product.imageUrl && product.imageUrl.trim() && !imgError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-2 group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">No image</span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {product.isTopPick ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs bg-blue-600 text-white border-blue-600 flex items-center gap-1">
              ★ Top pick
            </span>
          ) : product.fitsYou && product.fitsYou.length > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs bg-violet-50 text-violet-700 border-violet-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Picked for you
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onToggleSave?.(product);
            }}
            className={`pointer-events-auto p-1.5 rounded-full border shadow-sm transition-all ${
              isSaved ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/90 text-slate-600 border-slate-200 hover:bg-white hover:text-blue-600'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save item'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1 gap-2">
            {product.brand?.trim() ? (
              <span className="font-bold uppercase tracking-wider text-blue-600 text-[10px] truncate">{product.brand}</span>
            ) : (
              <span />
            )}
            {product.productRating ? (
              <span className="flex items-center gap-1 text-amber-500 font-medium text-[11px] shrink-0">
                ★ {product.productRating}
                {product.reviewsCount ? (
                  <span className="text-[10px] text-slate-400">({product.reviewsCount.toLocaleString('en-IN')} reviews)</span>
                ) : null}
              </span>
            ) : null}
          </div>
          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">{product.title}</h3>

          {product.highlights && product.highlights.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {product.highlights.map((h, i) => (
                <li key={i} className="text-[11px] text-slate-700 flex gap-1.5">
                  <span className="text-slate-400">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {product.fitsYou && product.fitsYou.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.fitsYou.map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-violet-50 text-[10px] text-violet-700 border border-violet-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {product.whyPicked && <p className="text-[11px] text-slate-600 leading-snug mt-2 line-clamp-3">{product.whyPicked}</p>}
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-semibold">
                {!priceKnown ? 'Price' : fromGoogleShopping ? (storeCount > 1 ? 'Lowest price' : 'Price') : 'Price (from web snippet)'}
              </span>
              {priceKnown ? (
                <span className="text-base sm:text-lg font-bold text-slate-900">{fmt(product.lowestPrice)}</span>
              ) : (
                <span className="text-sm font-semibold text-slate-500">Check price at store</span>
              )}
              {primary?.originalPrice && priceKnown ? (
                <span className="ml-1.5 text-xs text-slate-400 line-through">{fmt(primary.originalPrice)}</span>
              ) : null}
            </div>
            <div className="text-right min-w-0">
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end truncate">
                {primary?.trusted ? <ShieldCheck className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                <span className="truncate">{primary?.sellerName}</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {storeCount} {storeCount === 1 ? 'store' : 'stores'}
              </span>
            </div>
          </div>

          {product.trustedOffer && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              At a trusted store: <strong className="text-slate-700">{product.trustedOffer.store}</strong> {fmt(product.trustedOffer.price)}
            </p>
          )}

          {bestOffer && (
            <span className="w-fit max-w-full px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800 line-clamp-1">
              {bestOffer}
            </span>
          )}

          <div className="flex flex-col gap-1.5">
            {isAvailable && urlCheck.sanitizedUrl ? (
              <a
                href={urlCheck.sanitizedUrl}
                {...SAFE_EXTERNAL_LINK_PROPS}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs active:scale-[0.98]"
              >
                {linkIsGoogle ? <Search className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                <span className="truncate">{linkIsGoogle ? 'View on Google Shopping' : `Buy on ${primary?.sellerName}`}</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-80 shrink-0" />
              </a>
            ) : (
              <button disabled className="w-full py-2 px-3 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs border border-slate-200 cursor-not-allowed">
                Product link unavailable
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenPriceComparison(product)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-[0.98]"
            >
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>{storeCount > 1 ? `Compare ${storeCount} stores` : 'Store details'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
