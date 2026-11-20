'use client';

import React from 'react';
import { X, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle, Truck, TrendingDown, ShoppingBag } from 'lucide-react';
import { MerchantOffer, ProductMatch } from '@/types';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';

interface PriceComparisonModalProps {
  product: ProductMatch | null;
  currency: string;
  onClose: () => void;
}

/** Offer text that just repeats the stock or delivery line shown elsewhere */
const REDUNDANT_OFFER = /^(in stock( online)?|out of stock( online)?|contact for online availability)$/i;

export const PriceComparisonModal: React.FC<PriceComparisonModalProps> = ({ product, currency, onClose }) => {
  const [imgError, setImgError] = React.useState(false);
  if (!product) return null;

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';
  const fmt = (n: number) => `${symbol}${Math.round(n * rate).toLocaleString('en-IN')}`;

  const known = (m: MerchantOffer) => m.priceKnown !== false && m.price > 0;
  // Savings only between stores you can actually buy from (not out of stock, not flagged as suspicious)
  const buyable = product.merchants.filter(m => known(m) && m.availability !== 'OUT_OF_STOCK' && !/unusually low/i.test(m.tag || ''));
  const flagged = product.merchants.find(m => m.isLowestPrice);
  const lowestPrice = flagged?.price ?? Math.min(...buyable.map(m => m.price));
  const highestPrice = Math.max(...buyable.map(m => m.price));
  const potentialSavings = buyable.length > 1 && highestPrice > lowestPrice ? highestPrice - lowestPrice : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-white flex items-center justify-center">
              {product.imageUrl?.trim() && !imgError ? (
                <img src={product.imageUrl} alt={product.title} onError={() => setImgError(true)} className="w-full h-full object-contain" />
              ) : (
                <ShoppingBag className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold tracking-wider text-blue-600 uppercase">{product.brand}</span>
              <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{product.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {product.merchants.length} {product.merchants.length === 1 ? 'store' : 'stores'} · cheapest buyable store first
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {potentialSavings > 0 && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
            <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Save up to <strong className="text-emerald-950">{fmt(potentialSavings)}</strong> by choosing the cheapest store
            </span>
          </div>
        )}

        {/* Stores */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5">
          {product.merchants.map(merchant => {
            const priceKnown = known(merchant);
            const isBest = merchant.isLowestPrice || (!flagged && priceKnown && merchant.price === lowestPrice);
            const urlCheck = validateExternalUrl(merchant.productUrl);
            const canOpen = urlCheck.isValid && merchant.urlType !== 'UNAVAILABLE' && urlCheck.sanitizedUrl;
            const offers = (merchant.offers || []).filter(o => !REDUNDANT_OFFER.test(o.trim()));

            return (
              <div
                key={merchant.id}
                className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
                  isBest ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-slate-200'
                }`}
              >
                {/* Store details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {merchant.sellerLogo ? (
                      <img src={merchant.sellerLogo} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <span className="font-bold text-[11px] text-slate-600 uppercase">{merchant.sellerName.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 truncate" title={merchant.sellerName}>
                      {merchant.sellerName}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[11px]">
                      {merchant.availability === 'AVAILABLE' ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> In stock
                        </span>
                      ) : merchant.availability === 'OUT_OF_STOCK' ? (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-3 h-3" /> Out of stock
                        </span>
                      ) : (
                        <span className="text-slate-500">Stock not confirmed</span>
                      )}
                      {merchant.shipping && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Truck className="w-3 h-3" /> {merchant.shipping.replace(/^\+\s*/, '+ ')}
                        </span>
                      )}
                    </div>

                    {(isBest || merchant.trusted || merchant.discountLabel || merchant.tag || offers.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {isBest && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">Best deal</span>}
                        {merchant.trusted && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> Trusted store
                          </span>
                        )}
                        {merchant.discountLabel && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                            {merchant.discountLabel}
                          </span>
                        )}
                        {merchant.tag && !/best price/i.test(merchant.tag) && (
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                              /unusually low/i.test(merchant.tag) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}
                          >
                            {merchant.tag}
                          </span>
                        )}
                        {offers.slice(0, 4).map((o, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price + button: never wider than its column, wraps under the details on phones */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 sm:w-56 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    {priceKnown ? (
                      <div className="flex items-baseline gap-1.5 sm:justify-end">
                        <span className="text-base font-extrabold text-slate-900">{fmt(merchant.price)}</span>
                        {merchant.originalPrice && <span className="text-xs text-slate-400 line-through">{fmt(merchant.originalPrice)}</span>}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">Check price</span>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      {merchant.source === 'Google Shopping' ? `Checked ${merchant.verifiedAt}` : merchant.verifiedAt}
                    </span>
                  </div>
                  {canOpen ? (
                    <a
                      href={urlCheck.sanitizedUrl!}
                      {...SAFE_EXTERNAL_LINK_PROPS}
                      title={`Open on ${merchant.sellerName}`}
                      className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 active:scale-[0.98] ${
                        isBest ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      Buy <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  ) : (
                    <span className="px-3 py-2 rounded-xl text-[11px] text-slate-400 bg-slate-50 border border-slate-200 shrink-0">No link</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="text-[11px]">Prices and offers can change. Confirm on the store before paying.</span>
          <button onClick={onClose} className="px-3.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
