import type { EquippedFlair, ShopItem } from '../services/api';

export interface FlairPreview {
  nameColor: string | null;
  nameIcon: string;
  border: string;
  // Null when nothing is equipped/hovered in this slot, so callers can pass it straight to
  // ProfileBackdrop (which itself renders nothing for a null/unknown value).
  backdrop: string | null;
  // The equipped/hovered title's value, but only when it matches a known title item — otherwise
  // null, so callers can gate rendering a title badge on this alone.
  titleValue: string | null;
}

// Composes what should render in a live flair preview: the currently equipped flair, with one
// slot optionally overridden by a hovered/selected item (e.g. hovering a shop card, or selecting
// an owned item on the profile panel). Shared by Shop.tsx and MyFlairSection.tsx so preview
// math lives in exactly one place.
export function composeFlairPreview(
  equippedFlair: EquippedFlair,
  hoveredItem: ShopItem | null,
  knownTitleItems: Pick<ShopItem, 'value'>[]
): FlairPreview {
  const previewFlair = hoveredItem
    ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
    : equippedFlair;

  const titleValue = previewFlair.title;
  const isKnownTitle = titleValue ? knownTitleItems.some(i => i.value === titleValue) : false;

  return {
    nameColor: previewFlair.nameColor ?? null,
    nameIcon: previewFlair.nameIcon ?? '',
    border: previewFlair.profileBorder ?? '',
    backdrop: previewFlair.profileBackdrop ?? null,
    titleValue: isKnownTitle ? titleValue : null,
  };
}
