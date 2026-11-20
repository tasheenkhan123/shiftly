'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, SlidersHorizontal, Lightbulb, Trash2 } from 'lucide-react';
import { CategoryTile } from '@/components/CategoryIcon';
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

const split = (v?: string) => (v || '').split(',').map(x => x.trim()).filter(Boolean);

/** Is this question visible given the other answers? (e.g. laptop questions only when "Laptops" is picked) */
function isVisible(field: PreferenceField, values: Record<string, string>): boolean {
  return !field.showIf || split(values[field.showIf.key]).includes(field.showIf.includes);
}

/**
 * Preferences side panel: numbered questions per category, built from src/lib/categories.ts.
 * Adding a question or category there shows up here automatically.
 */
export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose, profile, onSave, signedIn, initialCategory }) => {
  const [draft, setDraft] = useState<PreferenceProfile>(profile);
  const [tab, setTab] = useState<Scope>(initialCategory && initialCategory !== 'other' ? initialCategory : 'skincare');
  const [adding, setAdding] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [limitNote, setLimitNote] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
      if (initialCategory && initialCategory !== 'other') setTab(initialCategory);
    }
  }, [isOpen, profile, initialCategory]);

  useEffect(() => {
    setAdding(null);
    setLimitNote(null);
  }, [tab]);

  if (!isOpen) return null;

  const tabs: { id: Scope; label: string }[] = [
    ...SELECTABLE_CATEGORIES.map(c => ({ id: c.id as Scope, label: c.label })),
    { id: 'global', label: 'Everything' },
  ];
  const allFields: PreferenceField[] =
    tab === 'global' ? GLOBAL_PREFERENCE_FIELDS : SELECTABLE_CATEGORIES.find(c => c.id === tab)?.preferenceFields || [];
  const values = draft[tab] || {};
  const fields = allFields.filter(f => isVisible(f, values));
  const countFor = (s: Scope) => Object.values(draft[s] || {}).filter(Boolean).length;

  const setValues = (key: string, list: string[]) => {
    const next = { ...(draft[tab] || {}) };
    if (list.length) next[key] = list.join(', ');
    else delete next[key];
    setDraft({ ...draft, [tab]: next });
  };

  const toggle = (field: PreferenceField, option: string) => {
    setLimitNote(null);
    const current = split(values[field.key]);
    if (current.includes(option)) return setValues(field.key, current.filter(v => v !== option));
    if (!field.multi) return setValues(field.key, [option]);
    if (field.max && current.length >= field.max) {
      setLimitNote(`${field.label}: choose up to ${field.max}. Remove one to add another.`);
      return;
    }
    setValues(field.key, [...current, option]);
  };

  const addCustom = (field: PreferenceField) => {
    const v = customText.trim().slice(0, 40);
    setCustomText('');
    setAdding(null);
    if (!v) return;
    const current = split(values[field.key]);
    if (current.some(c => c.toLowerCase() === v.toLowerCase())) return;
    if (field.multi && field.max && current.length >= field.max) {
      setLimitNote(`${field.label}: choose up to ${field.max}. Remove one to add another.`);
      return;
    }
    setValues(field.key, field.multi ? [...current, v] : [v]);
  };

  /** Drop answers to questions that are now hidden (e.g. laptop answers after unticking "Laptops") */
  const save = () => {
    const cleaned: PreferenceProfile = {};
    for (const [scope, vals] of Object.entries(draft) as [Scope, Record<string, string> | undefined][]) {
      if (!vals) continue;
      const defs = scope === 'global' ? GLOBAL_PREFERENCE_FIELDS : SELECTABLE_CATEGORIES.find(c => c.id === scope)?.preferenceFields || [];
      const kept: Record<string, string> = {};
      for (const [k, v] of Object.entries(vals)) {
        const def = defs.find(d => d.key === k);
        if (v && (!def || isVisible(def, vals))) kept[k] = v;
      }
      if (Object.keys(kept).length) cleaned[scope] = kept;
    }
    onSave(cleaned);
    onClose();
  };

  const hintFor = (f: PreferenceField) =>
    !f.options?.length ? '' : f.multi ? (f.max ? `Choose up to ${f.max}` : 'Choose any') : 'Choose one';

  let lastSection: string | undefined;

  return (
    <>
      {/* Dim the chat only on small screens, where the panel covers it */}
      <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-fade-in"
        aria-label="Your preferences"
      >
        <div className="p-5 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Your preferences
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Help Siftly find products that suit you.{' '}
              {signedIn ? 'Saved to your account.' : 'Saved in this browser (sign in to keep them on every device).'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 flex gap-1.5 overflow-x-auto pb-3 border-b border-slate-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 pl-1.5 pr-3 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CategoryTile id={t.id} size="sm" />
              {t.label}
              {countFor(t.id) > 0 && <span className="text-[10px] opacity-70">({countFor(t.id)})</span>}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5 flex-1">
          {fields.map((field, i) => {
            const selected = split(values[field.key]);
            const custom = selected.filter(v => !(field.options || []).includes(v));
            const sectionHeading = field.section && field.section !== lastSection ? field.section : null;
            lastSection = field.section;
            return (
              <div key={field.key}>
                {sectionHeading && (
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 pt-2 border-t border-slate-100">
                    {sectionHeading}
                  </div>
                )}
                <div className="mb-2">
                  <div className="text-sm font-semibold text-slate-800">
                    {i + 1}. {field.label}
                    {field.optional && <span className="ml-1 font-normal text-xs text-slate-400">(optional)</span>}
                  </div>
                  {hintFor(field) && <div className="text-[11px] text-slate-400">{hintFor(field)}</div>}
                </div>

                {field.options?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[...field.options, ...custom].map(option => {
                      const on = selected.includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => toggle(field, option)}
                          aria-pressed={on}
                          className={`px-3 py-1.5 rounded-full text-xs border flex items-center gap-1 transition-colors ${
                            on ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {option}
                          {on && field.multi && <X className="w-3 h-3" aria-label="Remove" />}
                        </button>
                      );
                    })}
                    {field.allowCustom &&
                      (adding === field.key ? (
                        <input
                          autoFocus
                          value={customText}
                          onChange={e => setCustomText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addCustom(field);
                            if (e.key === 'Escape') setAdding(null);
                          }}
                          onBlur={() => addCustom(field)}
                          placeholder="Type and press Enter"
                          maxLength={40}
                          className="px-3 py-1.5 rounded-full text-xs border border-blue-300 focus:outline-none w-40"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setCustomText('');
                            setAdding(field.key);
                          }}
                          className="px-3 py-1.5 rounded-full text-xs border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add more
                        </button>
                      ))}
                  </div>
                ) : (
                  <input
                    value={values[field.key] || ''}
                    onChange={e => setValues(field.key, e.target.value ? [e.target.value] : [])}
                    placeholder={field.placeholder}
                    maxLength={60}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            );
          })}
          {limitNote && <p className="text-xs text-amber-700">{limitNote}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" /> You can update these anytime
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft({})}
              className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
              title="Clear everything Siftly remembers about you"
              aria-label="Clear all preferences"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={save} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
              Save preferences
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
