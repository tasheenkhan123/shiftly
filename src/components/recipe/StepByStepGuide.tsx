'use client';

import React, { useState } from 'react';
import { ChefHat, Check } from 'lucide-react';

interface StepByStepGuideProps {
  instructions: string[];
}

export const StepByStepGuide: React.FC<StepByStepGuideProps> = ({ instructions }) => {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (idx: number) => {
    const next = new Set(completedSteps);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setCompletedSteps(next);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Step-by-Step Method</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {completedSteps.size}/{instructions.length} done
        </span>
      </div>

      <div className="space-y-3">
        {instructions.map((step, idx) => {
          const isDone = completedSteps.has(idx);

          return (
            <div
              key={idx}
              onClick={() => toggleStep(idx)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                isDone
                  ? 'bg-slate-50 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>

              <p className={`text-xs sm:text-sm leading-relaxed ${isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
