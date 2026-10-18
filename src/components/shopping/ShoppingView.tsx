'use client';

import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, ArrowUpDown, Filter, ShieldCheck } from 'lucide-react';
import { SiftlyAnalysisResult, ProductMatch } from '@/types';
import { ProductCard } from './ProductCard';
import { PriceComparisonModal } from './PriceComparisonModal';
import { DetectedLookBar } from './DetectedLookBar';

interface ShoppingViewProps {
  result: SiftlyAnalysisResult;
  currency: string;
  savedProductIds: Set<string>;
  onToggleSave: (product: ProductMatch) => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  result,
  currency,
  savedProductIds,
  onToggleSave,
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [activeModalProduct, setActiveModalProduct] = useState<ProductMatch | null>(null);

  // Aggregate all matches based on selected entity filter
  let displayedMatches: ProductMatch[] = [];
  if (selectedEntityId) {
    displayedMatches = result.productMatches[selectedEntityId] || [];
  } else {
    // Flatten all matches across entities
    Object.values(result.productMatches).forEach((matches) => {
      displayedMatches.push(...matches);
    });
  }

  // Filter by match tier if selected
  if (selectedTier !== 'ALL') {
    displayedMatches = displayedMatches.filter((m) => m.matchTier === selectedTier);
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Look Breakdown Bar */}
      <DetectedLookBar
        entities={result.detectedEntities}
        selectedEntityId={selectedEntityId}
        onSelectEntity={setSelectedEntityId}
      />

      {/* Filter & Sorting Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedTier('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedTier === 'ALL'
                ? 'bg-white text-black'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Results ({displayedMatches.length})
          </button>
          <button
            onClick={() => setSelectedTier('EXACT')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedTier === 'EXACT'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Exact Matches
          </button>
          <button
            onClick={() => setSelectedTier('CLOSE')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedTier === 'CLOSE'
                ? 'bg-teal-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Closest Alternatives
          </button>
          <button
            onClick={() => setSelectedTier('BUDGET_ALT')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              selectedTier === 'BUDGET_ALT'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Budget Picks
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-teal-400 font-semibold">
            <ShieldCheck className="w-4 h-4" /> Multi-Signal Verified
          </span>
        </div>
      </div>

      {/* Product Match Grid */}
      {displayedMatches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMatches.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currency={currency}
              isSaved={savedProductIds.has(product.id)}
              onToggleSave={onToggleSave}
              onOpenPriceComparison={setActiveModalProduct}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-3xl glass-panel border border-white/10">
          <p className="text-sm text-slate-400">No products found matching the selected filter tier.</p>
          <button
            onClick={() => setSelectedTier('ALL')}
            className="mt-3 px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Modal for side-by-side price comparison */}
      <PriceComparisonModal
        product={activeModalProduct}
        currency={currency}
        onClose={() => setActiveModalProduct(null)}
      />
    </div>
  );
};
