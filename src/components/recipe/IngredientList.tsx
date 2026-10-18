'use client';

import React, { useState } from 'react';
import { Check, ShoppingCart, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { RecipeIngredient } from '@/types';

interface IngredientListProps {
  ingredients: RecipeIngredient[];
  currency: string;
  onSelectIngredientToSwap?: (ingredient: RecipeIngredient) => void;
}

export const IngredientList: React.FC<IngredientListProps> = ({
  ingredients,
  currency,
  onSelectIngredientToSwap,
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const rate = currency === 'USD' ? 0.012 : 1;
  const symbol = currency === 'USD' ? '$' : '₹';

  const toggleCheck = (id: string) => {
    const next = new Set(checkedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCheckedIds(next);
  };

  const selectAll = () => {
    if (checkedIds.size === ingredients.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(ingredients.map((i) => i.id)));
    }
  };

  const categories = Array.from(new Set(ingredients.map((i) => i.category)));

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Grocery Checklist</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
              {ingredients.length} items
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Check off pantry ingredients you already own.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 transition-all flex items-center gap-1"
          >
            {checkedIds.size === ingredients.length ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Deselect</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Select All</span>
              </>
            )}
          </button>

          <a
            href="https://www.blinkit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 transition-all"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order on Blinkit / Zepto</span>
          </a>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {categories.map((cat) => {
          const itemsInCat = ingredients.filter((i) => i.category === cat);

          return (
            <div key={cat} className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                {cat}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {itemsInCat.map((item) => {
                  const isChecked = checkedIds.has(item.id);
                  const cost = item.estimatedCostInr ? Math.round(item.estimatedCostInr * rate) : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isChecked
                          ? 'bg-slate-50 border-slate-200 opacity-60 line-through'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.quantity} {item.unit}
                            {!item.isRequired && <span className="text-amber-600 ml-1">(Optional)</span>}
                          </span>
                        </div>
                      </div>

                      {cost && (
                        <span className="text-xs font-bold text-slate-700">
                          {symbol}{cost}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
