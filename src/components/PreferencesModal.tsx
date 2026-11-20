'use client';

import React, { useEffect, useState } from 'react';
import { X, Check, SlidersHorizontal, Trash2 } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import {
  GLOBAL_PREFERENCE_FIELDS,
  SELECTABLE_CATEGORIES,
  type CategoryId,
  type PreferenceField,
  type PreferenceProfile,
} from '@/lib/categories';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PreferenceProfile;
  onSave: (profile: PreferenceProfile) => void;
  signedIn: boolean;
  /** Open on this category's tab */
  initialCategory?: CategoryId;
}

type Scope = CategoryId | 'global';

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose, profile, onSave, signedIn, initialCategory }) => {
  const [draft, setDraft] = useState<PreferenceProfile>(profile);
  const [tab, setTab] = useState<Scope>(initialCategory && initialCategory !== 'other' ? initialCategory : 'skincare');

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
      if (initialCategory && initialCategory !== 'other') setTab(initialCategory);
    }
  }, [isOpen, profile, initialCategory]);

  if (!isOpen) return null;

  const tabs: { id: Scope; label: string }[] = [
    ...SELECTABLE_CATEGORIES.map(c => ({ id: c.id as Scope, label: c.label })),
    { id: 'global', label: 'Everything' },
  ];
  const fields: PreferenceField[] =
    tab === 'global' ? GLOBAL_PREFERENCE_FIELDS : SELECTABLE_CATEGORIES.find(c => c.id === tab)?.preferenceFields || [];
  const values = draft[tab] || {};
  const countFor = (s: Scope) => Object.values(draft[s] || {}).filter(Boolean).length;

  const setValue = (key: string, value: string) => {
    const next = { ...(draft[tab] || {}) };
    if (value.trim()) next[key] = value;
    else delete next[key];
    setDraft({ ...draft, [tab]: next });
  };

  /** Chip fields allow several values, stored as "Acne, Pigmentation" */
  const toggleOption = (field: PreferenceField, option: string) => {
    const multi = ['concerns', 'avoid', 'scent', 'priority'].includes(field.key);
    const current = (values[field.key] || '').split(',').map(v => v.trim()).filter(Boolean);
    let next: string[];
    if (current.includes(option)) next = current.filter(v => v !== option);
    else next = multi ? [...current, option] : [option];
    setValue(field.key, next.join(', '));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Your preferences
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Siftly uses these to personalise picks. It also remembers what you tell it in chat, like “I have oily skin”.
              {signedIn ? ' Saved to your account.' : ' Saved in this browser (sign in to keep them on every device).'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1.5 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CategoryIcon id={t.id} className="w-3.5 h-3.5" />
              {t.label}
              {countFor(t.id) > 0 && <span className="ml-1 text-[10px] opacity-70">({countFor(t.id)})</span>}
            </button>
          ))}
        </div>

        <div className="px-5 py-3 overflow-y-auto space-y-4 flex-1">
          {fields.map(field => {
            const selected = (values[field.key] || '').split(',').map(v => v.trim()).filter(Boolean);
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">{field.label}</label>
                {field.options ? (
                  <div className="flex flex-wrap gap-1.5">
                    {field.options.map(option => {
                      const on = selected.includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => toggleOption(field, option)}
                          className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1 transition-colors ${
                            on ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {on && <Check className="w-3 h-3" />} {option}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    value={values[field.key] || ''}
                    onChange={e => setValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={60}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setDraft({})}
            className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"
            title="Clear everything Siftly remembers about you"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
