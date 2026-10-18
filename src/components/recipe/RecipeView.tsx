'use client';

import React, { useState } from 'react';
import { 
  Utensils, 
  Clock, 
  Users, 
  ChefHat, 
  Sparkles, 
  TrendingDown, 
  Bookmark, 
  Share2, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { RecipeData } from '@/types';
import { IngredientList } from './IngredientList';
import { SubstitutionDrawer } from './SubstitutionDrawer';
import { StepByStepGuide } from './StepByStepGuide';

interface RecipeViewProps {
  recipe: RecipeData;
  currency: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export const RecipeView: React.FC<RecipeViewProps> = ({
  recipe,
  currency,
  isSaved = false,
  onToggleSave,
}) => {
  const [isBudgetMode, setIsBudgetMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';

  const baseCost = Math.round(recipe.estimatedTotalCostInr * rate);
  const optimizedCost = Math.round(recipe.estimatedOptimizedCostInr * rate);
  const currentDisplayCost = isBudgetMode ? optimizedCost : baseCost;
  const savings = Math.round((recipe.estimatedTotalCostInr - recipe.estimatedOptimizedCostInr) * rate);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Recipe Hero Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5 text-amber-600" /> {recipe.origin || 'Culinary Discovery'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                {recipe.difficulty}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {recipe.dishName}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {recipe.summaryDescription}
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Prep: <strong>{recipe.prepTimeMinutes} mins</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                <span>Cook: <strong>{recipe.cookTimeMinutes} mins</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span>Servings: <strong>{recipe.servings}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Cost & Actions Box */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Estimated Ingredients
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {symbol}{currentDisplayCost.toLocaleString()}
                </span>
                {isBudgetMode && (
                  <span className="text-xs text-slate-400 line-through">
                    {symbol}{baseCost.toLocaleString()}
                  </span>
                )}
              </div>
              {savings > 0 && (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <TrendingDown className="w-3 h-3" /> Save {symbol}{savings.toLocaleString()} with swaps
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Recipe Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Grocery & Substitutions */}
        <div className="lg:col-span-7 space-y-6">
          <IngredientList
            ingredients={recipe.ingredients}
            currency={currency}
          />

          <SubstitutionDrawer
            substitutions={recipe.substitutions}
            isBudgetMode={isBudgetMode}
            onToggleBudgetMode={() => setIsBudgetMode(!isBudgetMode)}
          />
        </div>

        {/* Right: Step-by-Step */}
        <div className="lg:col-span-5">
          <StepByStepGuide instructions={recipe.instructions} />
        </div>
      </div>
    </div>
  );
};
