'use client';

import React from 'react';
import { Plus, MessageSquare, Trash2, PanelLeftClose, LogIn, Clock, Pin, PinOff, Cloud, HardDrive } from 'lucide-react';
import { ChatSession, UserProfile } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string) => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onTogglePin,
  user,
  onOpenAuth,
  onSignOut
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#f9fafb] border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & New Chat */}
        <div className="p-3 border-b border-slate-200/80">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                S
              </div>
              <span className="font-semibold text-slate-800 text-sm tracking-tight">Siftly</span>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg lg:hidden"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>New search</span>
            </div>
          </button>
        </div>

        {/* History List: pinned chats first, then recent */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-slate-400 text-xs">
              <p>No searches yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">Describe a product or attach a screenshot to start.</p>
            </div>
          ) : (
            [
              { label: 'Pinned', icon: <Pin className="w-3 h-3" />, items: sessions.filter(s => s.pinned) },
              { label: 'Recent', icon: <Clock className="w-3 h-3" />, items: sessions.filter(s => !s.pinned) },
            ]
              .filter(group => group.items.length > 0)
              .map(group => (
                <div key={group.label} className="space-y-1">
                  <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                  {group.items.map(session => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60'
                            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="truncate">{session.title || 'Product search'}</span>
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onTogglePin(session.id);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-md"
                            title={session.pinned ? 'Unpin' : 'Pin to top'}
                          >
                            {session.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={e => onDeleteSession(session.id, e)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-md"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
          )}
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-slate-200/80 bg-white">
          {user && user.isLoggedIn ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
                    {user.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate">{user.fullName}</span>
                  <span className="text-[10px] text-slate-400 truncate flex items-center gap-1"><Cloud className="w-3 h-3" /> Synced · {user.email}</span>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="text-[11px] text-slate-400 hover:text-red-600 p-1 font-medium transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-[10px] text-slate-400 flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Guest: history is saved in this browser only
              </p>
              <button
                onClick={onOpenAuth}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in / Create account</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
