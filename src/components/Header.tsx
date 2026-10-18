'use client';

import React from 'react';
import { Sparkles, ShoppingBag, Utensils, ShieldCheck, Bookmark } from 'lucide-react';

interface HeaderProps {
  savedCount: number;
  onOpenSaved: () => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  onCategoryFilter?: (cat: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  savedCount,
  onOpenSaved,
  currency,
  onCurrencyChange,
  onCategoryFilter
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-panel bg-[#070b14]/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 p-[1px] shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-all">
            <div className="w-full h-full bg-[#070b14] rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-teal-200 bg-clip-text text-transparent font-['Outfit']">
              Siftly<span className="text-teal-400">.ai</span>
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider font-medium uppercase -mt-1 flex items-center gap-1">
              Universal Discovery Assistant
            </span>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full text-xs font-medium text-slate-300">
          <button 
            onClick={() => onCategoryFilter?.('Fashion')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-pink-400" />
            <span>Fashion & Bags</span>
          </button>
          <button 
            onClick={() => onCategoryFilter?.('Skincare')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Skincare</span>
          </button>
          <button 
            onClick={() => onCategoryFilter?.('Recipe')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors"
          >
            <Utensils className="w-3.5 h-3.5 text-amber-400" />
            <span>Recipes</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => onCurrencyChange('INR')}
              className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                currency === 'INR' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => onCurrencyChange('USD')}
              className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                currency === 'USD' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
          </div>

          {/* Saved Items */}
          <button
            onClick={onOpenSaved}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition-all"
            title="View saved items"
          >
            <Bookmark className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">Saved</span>
            {savedCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-teal-500 text-black ml-1">
                {savedCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
