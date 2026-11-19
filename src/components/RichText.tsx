import React from 'react';

/**
 * Minimal, safe formatter for assistant replies: **bold**, line breaks, "• " / "1. " list lines.
 * Builds React elements only (no innerHTML), so text from the web can't inject markup.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
    )
  );
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        const bullet = trimmed.match(/^(?:[•\-*]|(\d+)\.)\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-slate-400 shrink-0 tabular-nums">{bullet[1] ? `${bullet[1]}.` : '•'}</span>
              <span>{renderInline(bullet[2], `l${i}`)}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(trimmed, `l${i}`)}</p>;
      })}
    </div>
  );
}
