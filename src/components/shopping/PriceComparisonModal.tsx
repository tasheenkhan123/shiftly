'use client';

import React from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingDown,
  ShoppingBag,
  Search
} from 'lucide-react';
import { ProductMatch } from '@/types';
import { validateExternalUrl, SAFE_EXTERNAL_LINK_PROPS } from '@/lib/security/urlValidator';

interface PriceComparisonModalProps {
  product: ProductMatch | null;
  currency: string;
  onClose: () => void;
}

export const PriceComparisonModal: React.FC<PriceComparisonModalProps> = ({
  product,
  currency,
  onClose
}) => {
  const [imgError, setImgError] = React.useState(false);

  if (!product) return null;

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';

  const lowestPrice = product.merchants.reduce((min, m) => (m.price < min ? m.price : min), Infinity);
  const highestPrice = product.merchants.reduce((max, m) => (m.price > max ? m.price : max), -Infinity);
  const potentialSavings = highestPrice > lowestPrice ? Math.round((highestPrice - lowestPrice) * rate) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-start gap-3.5">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center">
              {product.imageUrl && product.imageUrl.trim() && !imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-blue-600 uppercase">{product.brand}</span>
              <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{product.title}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Price Comparison
                </span>
                <span>•</span>
                <span>{product.merchants.length} store offers</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Savings banner if multiple sellers */}
        {potentialSavings > 0 && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              Save up to <strong className="text-emerald-950 font-bold">{symbol}{potentialSavings.toLocaleString()}</strong> across verified sellers!
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">Lowest Price Found</span>
          </div>
        )}

        {/* Merchants List */}
        <div className="p-5 overflow-y-auto space-y-3">
          {product.merchants.map((merchant) => {
            const isLowest = merchant.price === lowestPrice;
            const convertedPrice = Math.round(merchant.price * rate);
            const convertedOriginal = merchant.originalPrice ? Math.round(merchant.originalPrice * rate) : null;
            const urlCheck = validateExternalUrl(merchant.productUrl);
            const isExactProduct = merchant.urlType === 'PRODUCT';
            const isSearch = merchant.urlType === 'SEARCH';
            const isAvailable = urlCheck.isValid && merchant.urlType !== 'UNAVAILABLE';

            return (
              <div
                key={merchant.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLowest
                    ? 'bg-blue-50/60 border-blue-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Left: Seller info */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 uppercase tracking-wider shrink-0">
                    {merchant.sellerName.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {isAvailable && urlCheck.sanitizedUrl ? (
                        <a
                          href={urlCheck.sanitizedUrl}
                          {...SAFE_EXTERNAL_LINK_PROPS}
                          className="font-bold text-xs text-slate-900 hover:text-blue-600 hover:underline transition-colors"
                          title={isExactProduct ? `Open exact product on ${merchant.sellerName}` : `Search ${merchant.sellerName}`}
                        >
                          {merchant.sellerName}
                        </a>
                      ) : (
                        <h4 className="font-bold text-xs text-slate-900">{merchant.sellerName}</h4>
                      )}
                      {isLowest && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">
                          Best Deal
                        </span>
                      )}
                      {/* URL Type Tag */}
                      {isExactProduct ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-semibold">
                          Exact Product
                        </span>
                      ) : isSearch ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-semibold">
                          Retailer Search
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      {merchant.verified && merchant.inStock ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> In Stock
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                          Check Store
                        </span>
                      )}
                      <span>•</span>
                      <span className="text-[10px] flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" /> {merchant.deliveryEstimate || 'Standard delivery'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Price and Action */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-slate-900">{symbol}{convertedPrice.toLocaleString()}</span>
                      {convertedOriginal && (
                        <span className="text-xs text-slate-400 line-through">
                          {symbol}{convertedOriginal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 block">Verified {merchant.verifiedAt}</span>
                  </div>

                  {isAvailable && urlCheck.sanitizedUrl ? (
                    <a
                      href={urlCheck.sanitizedUrl}
                      {...SAFE_EXTERNAL_LINK_PROPS}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] ${
                        isLowest
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {isExactProduct ? (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy on {merchant.sellerName}</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Search this store</span>
                        </>
                      )}
                      <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    >
                      Product link unavailable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[10px]">Direct external browser navigation • No iframes or proxies</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
