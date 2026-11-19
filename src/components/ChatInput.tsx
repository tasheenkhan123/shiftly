'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ImagePlus, Loader2, X } from 'lucide-react';
import { downscaleImage } from '@/lib/image';

interface ChatInputProps {
  /** imageDataUrl is a downscaled JPEG data URL when the user attached a screenshot/photo */
  onSend: (text: string, imageDataUrl?: string) => void;
  isLoading: boolean;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const attach = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please attach an image (screenshot or photo).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is over 15 MB. Please use a smaller one.');
      return;
    }
    setProcessing(true);
    try {
      setImage(await downscaleImage(file));
      textareaRef.current?.focus();
    } catch (err: any) {
      setError(err?.message || 'Could not read that image.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      attach(item.getAsFile());
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    attach(e.dataTransfer.files?.[0]);
  };

  const canSend = !isLoading && !processing && (text.trim().length > 0 || Boolean(image));

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text.trim(), image || undefined);
    setText('');
    setImage(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          attach(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <form
        onSubmit={handleSubmit}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border bg-white shadow-sm transition-all ${
          dragging ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200 focus-within:border-slate-300 focus-within:shadow-md'
        }`}
      >
        {(image || processing) && (
          <div className="px-3 pt-3">
            <div className="relative inline-block">
              {image ? (
                <img src={image} alt="Attached" className="h-16 w-16 rounded-xl object-cover border border-slate-200" />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              )}
              {image && (
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-slate-900 text-white shadow"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Attach a screenshot or photo"
            aria-label="Attach image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={image ? 'Add details (optional), e.g. "under ₹2,000" or "cheaper alternatives"' : 'What are you shopping for? e.g. "face wash for oily skin under ₹500"'}
            className="flex-1 bg-transparent resize-none text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none leading-relaxed py-2 max-h-36"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            aria-label="Search"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
          </button>
        </div>
      </form>

      <p className="mt-2 text-center text-[11px] text-slate-400">
        {error ? <span className="text-red-600">{error}</span> : 'Paste or drop a screenshot to find that exact product. Prices come from Google Shopping and can change.'}
      </p>
    </div>
  );
};
