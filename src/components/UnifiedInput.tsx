'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  ArrowRight, 
  X, 
  Upload, 
  DollarSign, 
  Loader2,
  Paperclip,
  CheckCircle2,
  Video,
  Camera
} from 'lucide-react';
import { DISCOVERY_PROMPTS } from '@/lib/constants';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
    <polygon points="10 15 15 12 10 9 10 15"/>
  </svg>
);

interface UnifiedInputProps {
  onSearch: (input: string, imagePreviewUrl?: string) => void;
  isLoading: boolean;
}

export const UnifiedInput: React.FC<UnifiedInputProps> = ({ onSearch, isLoading }) => {
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  // Detect link types & budget tags dynamically for visual badges
  const isYouTube = /youtube\.com|youtu\.be/i.test(inputText);
  const isInstagram = /instagram\.com/i.test(inputText);
  const budgetMatch = inputText.match(/(?:under|below|<|max)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?|\d+k)/i);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    } else {
      const text = e.dataTransfer.getData('text');
      if (text) {
        setInputText(prev => (prev ? `${prev} ${text}` : text));
      }
    }
  };

  // Paste handler to automatically catch clipboard images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !imagePreview) return;
    onSearch(inputText, imagePreview || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const applyPrompt = (prompt: typeof DISCOVERY_PROMPTS[0]) => {
    setInputText(prompt.text);
    if (prompt.id === 'instagram-look' || prompt.id === 'dress-budget') {
      setImagePreview('https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80');
    } else if (prompt.id === 'skincare-serum') {
      setImagePreview('https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80');
    } else if (prompt.id === 'bag-alternative') {
      setImagePreview('https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80');
    } else if (prompt.id === 'recipe-youtube') {
      setImagePreview(null);
    }
    setTimeout(() => {
      onSearch(prompt.text, prompt.id !== 'recipe-youtube' ? 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80' : undefined);
    }, 100);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Search Container */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`w-full relative rounded-2xl sm:rounded-3xl glass-input p-3 sm:p-4 transition-all duration-300 ${
          isDragging ? 'border-teal-400 bg-teal-500/10 scale-[1.01]' : 'border-white/15'
        }`}
      >
        {/* Attached image preview pill */}
        {imagePreview && (
          <div className="mb-3 flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl max-w-fit animate-fade-in">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-teal-500/30">
              <img src={imagePreview} alt="Attached input" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Image Attached
              </span>
              <span className="text-[11px] text-slate-400">Ready for visual AI extraction</span>
            </div>
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all ml-2"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Textarea & Icons */}
        <div className="flex items-start gap-3">
          <div className="pt-2 text-teal-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste Instagram/YouTube link, drop an image, or describe (e.g. 'Find this green dress under ₹2,000' or 'Korean noodle ingredients')..."
            className="w-full bg-transparent border-0 resize-none text-slate-100 placeholder:text-slate-500 text-sm sm:text-base focus:outline-none focus:ring-0 leading-relaxed min-h-[44px] py-1.5"
          />

          {/* Action buttons inside input box */}
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {/* Upload image button */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-teal-300 transition-all"
              title="Upload photo / screenshot"
            >
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isLoading || (!inputText.trim() && !imagePreview)}
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-teal-500/40 active:scale-95 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Sift</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Context Badges */}
        <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            {isInstagram && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30 text-[11px] font-medium">
                <InstagramIcon className="w-3 h-3 text-pink-400" /> Instagram Link Detected
              </span>
            )}
            {isYouTube && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 text-[11px] font-medium">
                <YoutubeIcon className="w-3 h-3 text-red-400" /> YouTube Video Detected
              </span>
            )}
            {budgetMatch && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                <DollarSign className="w-3 h-3 text-emerald-400" /> Budget Filter: {budgetMatch[0]}
              </span>
            )}
            {!isInstagram && !isYouTube && !budgetMatch && (
              <span className="text-[11px] text-slate-400 hidden sm:inline flex items-center gap-1.5">
                <Paperclip className="w-3 h-3 text-slate-500" /> Drop any image, paste URL or type natural instructions
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            No category selection required • Auto-routed
          </div>
        </div>
      </div>

      {/* Suggested Discovery Prompts */}
      <div className="w-full mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">Try these examples:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DISCOVERY_PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => applyPrompt(prompt)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/40 text-slate-300 hover:text-white text-xs transition-all text-left"
            >
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
