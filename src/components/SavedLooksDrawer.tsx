'use client';

import React, { useState } from 'react';
import { X, Trash2, Bookmark, ShoppingBag, Copy, Check } from 'lucide-react';
import { ProductMatch } from '@/types';

interface SavedLooksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedProducts: ProductMatch[];
  onRemoveProduct: (id: string) => void;
  currency: string;
}

/** Saved items side panel: light, soft-blue style matching the preferences panel */
export const SavedLooksDrawer: React.FC<SavedLooksDrawerProps> = ({ isOpen, onClose, savedProducts, onRemoveProduct, currency }) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';
  const fmt = (n: number) => `${symbol}${Math.round(n * rate).toLocaleString('en-IN')}`;
  const totalPrice = savedProducts.reduce((sum, p) => sum + (p.priceKnown === false ? 0 : p.lowestPrice), 0);

  /** Copy the saved list (name, price, store link) so it can be pasted into a chat or note */
  const copyList = async () => {
    const lines = savedProducts.map(p => {
      const price = p.priceKnown === false ? 'check price' : fmt(p.lowestPrice);
      const store = p.merchants[0];
      return `• ${p.title}: ${price}${store ? ` at ${store.sellerName}` : ''}${store?.productUrl ? `\n  ${store.productUrl}` : ''}`;
    });
    const text = `My Siftly saved items\n\n${lines.join('\n')}\n\nTotal: ${fmt(totalPrice)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 animate-fade-in" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-fade-in"
        aria-label="Saved items"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">Saved items</h3>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{savedProducts.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {savedProducts.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium text-slate-700">No saved items yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Tap the bookmark on any product card to save it here for later.</p>
            </div>
          ) : (
            savedProducts.map(product => (
              <div
                key={product.id}
                className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 flex items-center gap-3 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100 flex items-center justify-center">
                  {product.imageUrl?.trim() ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ShoppingBag className="w-6 h-6 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{product.brand}</span>
                  <h4 className="text-xs font-semibold text-slate-900 truncate">{product.title}</h4>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {product.priceKnown === false ? 'Check price' : fmt(product.lowestPrice)}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">{product.merchants[0]?.sellerName || ''}</span>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveProduct(product.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  title="Remove from saved"
                  aria-label={`Remove ${product.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {savedProducts.length > 0 && (
          <div className="p-5 border-t border-slate-100 bg-blue-50/40 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Total</span>
              <span className="text-lg font-bold text-slate-900">{fmt(totalPrice)}</span>
            </div>
            <button
              onClick={copyList}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to clipboard' : 'Copy list'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
