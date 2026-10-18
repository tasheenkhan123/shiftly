'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Scan, Search, ShieldCheck, Check, Layers } from 'lucide-react';

interface AnalysisProgressIndicatorProps {
  isLoading: boolean;
}

const STEPS = [
  { id: 1, label: 'Detecting Input & Intent', subtext: 'Analyzing format, URL, or image metadata', icon: Scan },
  { id: 2, label: 'Multimodal AI Extraction', subtext: 'Extracting brand, silhouette, fabric & color attributes', icon: Sparkles },
  { id: 3, label: 'Querying Trusted Sellers', subtext: 'Searching Myntra, Nykaa, Amazon India, Tira...', icon: Search },
  { id: 4, label: 'Multi-Signal Ranking & Verification', subtext: 'Calculating transparent match confidence & price comparison', icon: ShieldCheck }
];

export const AnalysisProgressIndicator: React.FC<AnalysisProgressIndicatorProps> = ({ isLoading }) => {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(1);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 650);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="w-full max-w-3xl mx-auto my-8 p-6 rounded-2xl glass-panel border border-teal-500/20 shadow-2xl relative overflow-hidden animate-fade-in">
      {/* Animated glowing top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
          <Layers className="w-4 h-4 text-teal-300 animate-spin" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">Siftly AI Pipeline Active</h3>
          <p className="text-xs text-slate-400">Processing multimodal signals in parallel...</p>
        </div>
      </div>

      {/* Progress Steps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isDone = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3.5 p-3 rounded-xl border transition-all duration-300 ${
                isActive
                  ? 'bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/5'
                  : isDone
                  ? 'bg-white/5 border-white/10 opacity-80'
                  : 'bg-white/2 border-white/5 opacity-40'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-emerald-500 text-black'
                    : isActive
                    ? 'bg-teal-400 text-black animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${isActive ? 'text-teal-200' : 'text-slate-200'}`}>
                  {step.label}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                  {step.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
