import type { EquippedFlair, ShopItem } from '../services/api';

export type FlairTier = 'entry' | 'mid' | 'premium';

export interface TitleStyle {
  tier: FlairTier;
  className: string;
  emoji?: string;
}

export interface IconStyle {
  tier: FlairTier;
  className: string;
}

export interface NameColorStyle {
  tier: FlairTier;
  sparkleClass?: string;
}

// The three tables below are the client-side source of truth for flair identity strings.
// Keys are the `value` strings the server stores in User.equippedFlair, so a key must
// never be renamed for an item that already exists.

const ENTRY_TITLE: TitleStyle = { tier: 'entry', className: '' };
const MID_TITLE: TitleStyle = { tier: 'mid', className: 'flair-title-mid' };

const TITLE_STYLES: Record<string, TitleStyle> = {
  'Regular': ENTRY_TITLE,
  'Tenpai': ENTRY_TITLE,
  'Nakama': ENTRY_TITLE,
  'Chi Chi': ENTRY_TITLE,
  'PonPonPon': ENTRY_TITLE,
  'Kan I Help You?': ENTRY_TITLE,
  'East Wind': MID_TITLE,
  'Dragon Slayer': MID_TITLE,
  'Dora Hunter': MID_TITLE,
  'Power of Friendship': MID_TITLE,
  'Over 9000 Han': MID_TITLE,
  'Chicken Farmer': { tier: 'premium', className: 'flair-title-chicken', emoji: '🐔' },
  'Chombo Chaser': { tier: 'premium', className: 'flair-title-chombo', emoji: '⚡' },
  'Tsumo-nami': { tier: 'premium', className: 'flair-title-tsumonami', emoji: '🌊' },
};

const ENTRY_ICON: IconStyle = { tier: 'entry', className: '' };
const MID_ICON: IconStyle = { tier: 'mid', className: 'flair-icon-glow' };

const ICON_STYLES: Record<string, IconStyle> = {
  '🏮': ENTRY_ICON,
  '🀄': ENTRY_ICON,
  '⭐': ENTRY_ICON,
  '🍙': ENTRY_ICON,
  '🍡': ENTRY_ICON,
  '🎴': ENTRY_ICON,
  '🎐': ENTRY_ICON,
  '🎋': MID_ICON,
  '👑': MID_ICON,
  '🐉': MID_ICON,
  // Torii gate is stored with its emoji variation selector (U+FE0F); the key must match exactly.
  '\u26E9\uFE0F': MID_ICON,
  '🦊': MID_ICON,
  '🔥': { tier: 'premium', className: 'flair-icon-flame' },
  '🌸': { tier: 'premium', className: 'flair-icon-blossom' },
  '🎆': { tier: 'premium', className: 'flair-icon-firework' },
  '🌊': { tier: 'premium', className: 'flair-icon-wave' },
  '🥷': { tier: 'premium', className: 'flair-icon-ninja' },
};

const ENTRY_COLOR: NameColorStyle = { tier: 'entry' };
const MID_COLOR: NameColorStyle = { tier: 'mid' };

const NAME_COLOR_STYLES: Record<string, NameColorStyle> = {
  'flair-color-pink': ENTRY_COLOR,
  'flair-color-teal': ENTRY_COLOR,
  'flair-color-amber': ENTRY_COLOR,
  'flair-color-matcha': ENTRY_COLOR,
  'flair-color-aizome': ENTRY_COLOR,
  'flair-color-umeboshi': ENTRY_COLOR,
  'flair-color-sumi': ENTRY_COLOR,
  'flair-color-emerald': MID_COLOR,
  'flair-color-blue': MID_COLOR,
  'flair-color-purple': MID_COLOR,
  'flair-color-fuji': MID_COLOR,
  'flair-color-moonlit': MID_COLOR,
  'flair-color-gold': { tier: 'premium', sparkleClass: 'flair-sparkles-gold' },
  'flair-color-red': { tier: 'premium', sparkleClass: 'flair-sparkles-crimson' },
  'flair-color-neon': { tier: 'premium', sparkleClass: 'flair-sparkles-neon' },
  'flair-color-tanabata': { tier: 'premium', sparkleClass: 'flair-sparkles-tanabata' },
};

// hasOwnProperty guard: values come from the server, and a plain object lookup
// would return inherited members for keys like 'constructor'.
function lookup<T>(table: Record<string, T>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

export function isPremiumBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-border-');
}

export function isMidTierBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-mid-');
}

export function getTitleStyle(titleValue: string): TitleStyle | null {
  return lookup(TITLE_STYLES, titleValue);
}

export function getPremiumTitleClass(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'premium' ? style.className : '';
}

export function getPremiumTitleEmoji(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'premium' ? style.emoji ?? '' : '';
}

export function getMidTierTitleClass(titleValue: string): string {
  const style = getTitleStyle(titleValue);
  return style?.tier === 'mid' ? style.className : '';
}

export function getIconStyle(iconValue: string): IconStyle | null {
  return lookup(ICON_STYLES, iconValue);
}

export function getIconClass(iconValue: string): string {
  return getIconStyle(iconValue)?.className ?? '';
}

export function getNameColorStyle(colorValue: string): NameColorStyle | null {
  return lookup(NAME_COLOR_STYLES, colorValue);
}

// The server stores the item's `value` (not its id) in User.equippedFlair.
export function isFlairEquipped(
  equippedFlair: EquippedFlair,
  item: Pick<ShopItem, 'category' | 'value'>
): boolean {
  return equippedFlair[item.category] === item.value;
}
