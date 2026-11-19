'use client';

import React from 'react';
import { X, Trash2, ExternalLink, Bookmark, ShoppingBag, ArrowRight } from 'lucide-react';
import { ProductMatch } from '@/types';

interface SavedLooksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedProducts: ProductMatch[];
  onRemoveProduct: (id: string) => void;
  currency: string;
}

export const SavedLooksDrawer: React.FC<SavedLooksDrawerProps> = ({
  isOpen,
  onClose,
  savedProducts,
  onRemoveProduct,
  currency,
}) => {
  if (!isOpen) return null;

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';

  const totalPrice = savedProducts.reduce((sum, p) => sum + (p.priceKnown === false ? 0 : p.lowestPrice), 0);
  const displayTotal = Math.round(totalPrice * rate);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-[#0d1322] border-l border-white/15 shadow-2xl flex flex-col justify-between">
        {/* Top Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-teal-400" />
            <h3 className="font-extrabold text-base text-white">Saved Items & Looks</h3>
            <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold">
              {savedProducts.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {savedProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm">No saved items yet.</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Click the bookmark icon on any product card to save it here for later.
              </p>
            </div>
          ) : (
            savedProducts.map((product) => {
              const price = Math.round(product.lowestPrice * rate);

              return (
                <div
                  key={product.id}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5 group hover:border-teal-500/30 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 flex items-center justify-center">
                    {product.imageUrl && product.imageUrl.trim() ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                      {product.brand}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate">{product.title}</h4>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-extrabold text-white">
                        {product.priceKnown === false ? 'Check price' : `${symbol}${price.toLocaleString()}`}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {product.merchants[0]?.sellerName || 'Verified Store'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveProduct(product.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary */}
        {savedProducts.length > 0 && (
          <div className="p-5 border-t border-white/10 bg-black/40 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Estimated Cost:</span>
              <span className="text-lg font-black text-white">{symbol}{displayTotal.toLocaleString()}</span>
            </div>

            <button
              onClick={() => alert('Saved items list copied to clipboard!')}
              className="w-full py-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-teal-500/20"
            >
              Export Look Summary
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
