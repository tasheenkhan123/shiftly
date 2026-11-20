import React from 'react';
import { Brush, Droplets, Flower2, Footprints, Settings2, Shirt, ShoppingBag, Smartphone, type LucideIcon } from 'lucide-react';

/** One consistent line-icon style for every category (instead of emoji) */
const ICONS: Record<string, LucideIcon> = {
  skincare: Droplets,
  makeup: Brush,
  footwear: Footprints,
  fashion: Shirt,
  electronics: Smartphone,
  perfumes: Flower2,
  global: Settings2,
  other: ShoppingBag,
};

export function CategoryIcon({ id, className = 'w-3.5 h-3.5' }: { id: string; className?: string }) {
  const Icon = ICONS[id] || ShoppingBag;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}
