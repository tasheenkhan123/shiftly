'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  FileText, 
  ArrowUp, 
  X, 
  Loader2, 
  Search,
  CheckCircle2,
  Paperclip
} from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'link' | 'file') => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedLink, setAttachedLink] = useState<string | null>(null);
  const [linkInputPrompt, setLinkInputPrompt] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  // Click outside to close plus menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
        setIsMenuOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachedImage(event.target?.result as string);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() && !attachedImage && !attachedLink) return;

    let mediaUrl = attachedImage || attachedLink || undefined;
    let mediaType: 'image' | 'video' | 'link' | 'file' | undefined = undefined;
    if (attachedImage) mediaType = 'image';
    else if (attachedLink) mediaType = 'link';

    onSend(text.trim(), mediaUrl, mediaType);
    setText('');
    setAttachedImage(null);
    setAttachedLink(null);
    setIsMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAddLink = () => {
    if (linkInputValue.trim()) {
      setAttachedLink(linkInputValue.trim());
      setLinkInputValue('');
      setLinkInputPrompt(false);
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-6 relative">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Attached Media Previews */}
      {(attachedImage || attachedLink) && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl max-w-fit shadow-sm">
          {attachedImage && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-300">
              <img src={attachedImage} alt="Uploaded screenshot" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              {attachedImage ? 'Screenshot / Photo Attached' : 'Link Attached'}
            </span>
            <span className="text-[11px] text-slate-500 max-w-[200px] truncate">
              {attachedImage ? 'Visual search active' : attachedLink}
            </span>
          </div>
          <button
            onClick={() => {
              setAttachedImage(null);
              setAttachedLink(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-all ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Chat Input Container */}
      <div 
        onPaste={handlePaste}
        className="relative flex items-end gap-2 bg-white border border-slate-300 hover:border-slate-400 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl p-2 sm:p-2.5 shadow-md shadow-slate-200/50 transition-all"
      >
        {/* Plus (+) Menu Trigger */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isMenuOpen ? 'bg-slate-900 text-white rotate-45' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Attach image or link"
          >
            <Plus className="w-5 h-5 transition-transform" />
          </button>

          {/* Plus Menu Popover */}
          {isMenuOpen && (
            <div className="absolute bottom-12 left-0 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-fade-in space-y-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left"
              >
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>Upload Screenshot / Image</span>
              </button>

              <button
                type="button"
                onClick={() => setLinkInputPrompt(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left"
              >
                <LinkIcon className="w-4 h-4 text-pink-600" />
                <span>Paste Instagram / Video Link</span>
              </button>

              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Upload Document / File</span>
              </button>

              {linkInputPrompt && (
                <div className="p-2 border-t border-slate-100 pt-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={linkInputValue}
                    onChange={(e) => setLinkInputValue(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 mb-1.5"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="w-full py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Attach Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Siftly, paste any screenshot or link..."
          className="w-full bg-transparent border-0 resize-none text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-0 leading-relaxed py-1.5 max-h-36"
        />

        {/* Find Action Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || (!text.trim() && !attachedImage && !attachedLink)}
          className="shrink-0 flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs shadow-sm transition-all active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span>Find</span>
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>

      <div className="text-center mt-1.5 text-[11px] text-slate-400">
        Drop any screenshot from Google or social media to find exact products and verified prices.
      </div>
    </div>
  );
};
