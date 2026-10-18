'use client';

import React from 'react';
import { Sparkles, ArrowRight, AlertTriangle, TrendingDown, DollarSign, CheckCircle2 } from 'lucide-react';
import { IngredientSubstitution } from '@/types';

interface SubstitutionDrawerProps {
  substitutions: IngredientSubstitution[];
  isBudgetMode: boolean;
  onToggleBudgetMode: () => void;
}

export const SubstitutionDrawer: React.FC<SubstitutionDrawerProps> = ({
  substitutions,
  isBudgetMode,
  onToggleBudgetMode,
}) => {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Smart Ingredient Substitutions</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pantry swaps for specialty or expensive gourmet ingredients.
          </p>
        </div>

        {/* Budget Mode Toggle */}
        <button
          onClick={onToggleBudgetMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isBudgetMode
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{isBudgetMode ? '✓ Budget Optimizer Active' : 'Make Recipe Cheaper'}</span>
        </button>
      </div>

      {/* Substitutions Cards Grid */}
      <div className="mt-4 space-y-3">
        {substitutions.map((sub, index) => (
          <div
            key={index}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2"
          >
            {/* Top Swapping Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-xs font-bold line-through">
                  {sub.originalName}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                  {sub.substituteName}
                </span>
              </div>

              {sub.estimatedSavingsPercentage && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-0.5 self-start sm:self-auto">
                  <DollarSign className="w-3 h-3" /> Save ~{sub.estimatedSavingsPercentage}%
                </span>
              )}
            </div>

            {/* Preparation & Ratio Notes */}
            <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/60 space-y-1">
              <div>
                <strong className="text-slate-900">Ratio & Prep: </strong>
                <span>{sub.ratioNotes}</span>
              </div>
              {sub.preparationTip && (
                <div className="text-[11px] text-slate-500 flex items-start gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                  <span>{sub.preparationTip}</span>
                </div>
              )}
            </div>

            {/* Flavor Impact Alert */}
            <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span><strong>Flavor Impact: </strong>{sub.flavorImpact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
