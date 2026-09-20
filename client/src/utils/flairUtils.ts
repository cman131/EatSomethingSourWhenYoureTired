export function isPremiumBorder(borderValue: string): boolean {
  return borderValue.startsWith('flair-border-');
}

export function getPremiumTitleClass(titleValue: string): string {
  if (titleValue === 'Chicken Farmer') return 'flair-title-chicken';
  if (titleValue === 'Chombo Chaser') return 'flair-title-chombo';
  return '';
}

export function getPremiumTitleEmoji(titleValue: string): string {
  if (titleValue === 'Chicken Farmer') return '🐔';
  if (titleValue === 'Chombo Chaser') return '⚡';
  return '';
}
