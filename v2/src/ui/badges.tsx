import { Anchor, Compass, Mountain, Moon, Palmtree, Plane, Star, Sun, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

/** The fixed badge icon set of core.person_profile.badge_value (kind 'icon'). */
export const BADGE_ICONS: Record<string, ComponentType<LucideProps>> = {
  compass: Compass,
  star: Star,
  mountain: Mountain,
  plane: Plane,
  crescent: Moon,
  sun: Sun,
  palm: Palmtree,
  anchor: Anchor,
};

/** The 12 zodiac signs (kind 'zodiac'), shown as their glyph. */
export const ZODIAC: Record<string, string> = {
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
};
