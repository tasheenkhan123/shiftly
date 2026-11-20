'use client';

import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { getCategory, SHOPS_FOR_OPTIONS, type PreferenceProfile } from '@/lib/categories';

interface OnboardingModalProps {
  isOpen: boolean;
  name?: string;
  initial: PreferenceProfile;
  onSave: (profile: PreferenceProfile) => void;
  onSkip: () => void;
}

/** Optional 20-second "get to know you" step shown once after the first sign-in. Every question is skippable. */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, name, initial, onSave, onSkip }) => {
  const [shopsFor, setShopsFor] = useState(initial.global?.shopsFor || '');
  const [skinType, setSkinType] = useState(initial.skincare?.skinType || '');
  const [size, setSize] = useState(initial.fashion?.size || '');
  const [shoeSize, setShoeSize] = useState(initial.footwear?.shoeSize || '');

  if (!isOpen) return null;

  const skinOptions = getCategory('skincare').preferenceFields.find(f => f.key === 'skinType')?.options || [];
  const sizeOptions = getCategory('fashion').preferenceFields.find(f => f.key === 'size')?.options || [];

  const save = () => {
    const set = (scope: keyof PreferenceProfile, key: string, value: string) => {
      if (!value.trim()) return;
      next[scope] = { ...(next[scope] || {}), [key]: value.trim() };
    };
    const next: PreferenceProfile = { ...initial };
    set('global', 'shopsFor', shopsFor);
    set('skincare', 'skinType', skinType);
    set('fashion', 'size', size);
    set('footwear', 'shoeSize', shoeSize);
    onSave(next);
  };

  const Chips = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? '' : o)}
          className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1 ${
            value === o ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {value === o && <Check className="w-3 h-3" />} {o}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" /> {name ? `Hi ${name.split(' ')[0]}!` : 'Welcome!'} Help Siftly get to know you
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Takes 20 seconds. Answer only what you like; you can change it anytime in Your preferences.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">I usually shop for</label>
          <Chips options={SHOPS_FOR_OPTIONS} value={shopsFor} onChange={setShopsFor} />
          <p className="text-[10px] text-slate-400">Used as a default for clothes, shoes and fragrances. Asking for “men’s” or “a gift for…” always overrides it.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Skin type</label>
          <Chips options={skinOptions} value={skinType} onChange={setSkinType} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Clothing size</label>
          <Chips options={sizeOptions} value={size} onChange={setSize} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Shoe size</label>
          <input
            value={shoeSize}
            onChange={e => setShoeSize(e.target.value)}
            placeholder="e.g. UK 6"
            maxLength={20}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onSkip} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Skip for now
          </button>
          <button onClick={save} className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
