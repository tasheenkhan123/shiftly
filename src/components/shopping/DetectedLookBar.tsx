'use client';

import React from 'react';
import { Sparkles, Eye, CheckCircle, Tag, ShoppingBag } from 'lucide-react';
import { DetectedEntity } from '@/types';

interface DetectedLookBarProps {
  entities: DetectedEntity[];
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
}

export const DetectedLookBar: React.FC<DetectedLookBarProps> = ({
  entities,
  selectedEntityId,
  onSelectEntity,
}) => {
  if (entities.length === 0) return null;

  return (
    <div className="w-full mb-8 p-4 sm:p-5 rounded-3xl glass-panel border border-white/15 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold">
              {entities.length}
            </span>
            <h3 className="text-base font-extrabold text-white">
              {entities.length > 1 ? 'Multiple Products Detected in Look' : 'Product Detected'}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Select an item below or view the entire curated collection.
          </p>
        </div>

        {/* Shop whole look / view all toggle */}
        {entities.length > 1 && (
          <button
            onClick={() => onSelectEntity(null)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              selectedEntityId === null
                ? 'bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Shop The Whole Look</span>
          </button>
        )}
      </div>

      {/* Entity Selector Pills / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {entities.map((entity) => {
          const isSelected = selectedEntityId === entity.id;

          return (
            <div
              key={entity.id}
              onClick={() => onSelectEntity(isSelected ? null : entity.id)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3.5 ${
                isSelected
                  ? 'bg-teal-500/15 border-teal-400 shadow-md shadow-teal-500/10'
                  : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/8'
              }`}
            >
              {/* Crop image thumbnail */}
              {entity.cropImageUrl && entity.cropImageUrl.trim() ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/15 bg-black/40">
                  <img
                    src={entity.cropImageUrl}
                    alt={entity.name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5 text-teal-400" />
                </div>
              )}

              {/* Entity Info */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                    {entity.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({entity.attributes.brandConfidence})
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white truncate">{entity.name}</h4>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                  <span>{entity.attributes.color}</span>
                  {entity.attributes.material && (
                    <>
                      <span>•</span>
                      <span className="truncate">{entity.attributes.material}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
