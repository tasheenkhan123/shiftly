import React from 'react';
import { Brush, Droplets, Footprints, Settings2, Shirt, ShoppingBag, Smartphone, type LucideIcon, type LucideProps } from 'lucide-react';

/** Perfume bottle in the same line style as the other icons (the icon set has no perfume bottle) */
function PerfumeBottle(props: LucideProps) {
  const { className, strokeWidth = 1.75, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(rest as React.SVGProps<SVGSVGElement>)}
    >
      <rect x="10" y="2.5" width="4" height="3" rx="0.75" />
      <path d="M10 4H7.5" />
      <path d="M5.5 3v2" />
      <path d="M10.5 5.5v2.5h3V5.5" />
      <rect x="5" y="8" width="14" height="13.5" rx="3.5" />
      <path d="M9 13.5h6" />
    </svg>
  );
}

/** One consistent line-icon style for every category (instead of emoji) */
const ICONS: Record<string, LucideIcon | ((p: LucideProps) => React.ReactElement)> = {
  skincare: Droplets,
  makeup: Brush,
  footwear: Footprints,
  fashion: Shirt,
  electronics: Smartphone,
  perfumes: PerfumeBottle,
  global: Settings2,
  other: ShoppingBag,
};

/** Soft colour per category: light tile + coloured icon (full class names so Tailwind keeps them) */
const COLORS: Record<string, string> = {
  skincare: 'bg-emerald-50 text-emerald-600',
  makeup: 'bg-pink-50 text-pink-600',
  footwear: 'bg-orange-50 text-orange-600',
  fashion: 'bg-violet-50 text-violet-600',
  electronics: 'bg-blue-50 text-blue-600',
  perfumes: 'bg-amber-50 text-amber-600',
  global: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
};

export function CategoryIcon({ id, className = 'w-3.5 h-3.5' }: { id: string; className?: string }) {
  const Icon = ICONS[id] || ShoppingBag;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}

/** Coloured rounded tile with the category icon, for category buttons and tabs */
export function CategoryTile({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-5 h-5 rounded-md' : 'w-6 h-6 rounded-lg';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span className={`${box} ${COLORS[id] || COLORS.other} inline-flex items-center justify-center shrink-0`}>
      <CategoryIcon id={id} className={icon} />
    </span>
  );
}
