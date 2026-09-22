import { composeFlairPreview } from '../flairPreview';
import { EquippedFlair, ShopItem } from '../../services/api';

const noFlair: EquippedFlair = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

const titleItem: ShopItem = {
  _id: 't1',
  name: 'Chicken Farmer',
  description: '',
  category: 'title',
  cost: 500,
  value: 'Chicken Farmer',
  tier: 'premium',
  sortOrder: 1,
  isActive: true,
};

describe('composeFlairPreview', () => {
  test('with no hovered item and nothing equipped, previews an empty look', () => {
    const preview = composeFlairPreview(noFlair, null, []);

    expect(preview).toEqual({ nameColor: null, nameIcon: '', border: '', titleValue: null });
  });

  test('reflects the currently equipped flair when nothing is hovered', () => {
    const equipped: EquippedFlair = { nameColor: 'text-emerald-600', nameIcon: '🐉', profileBorder: 'flair-mid-jade', title: null };

    const preview = composeFlairPreview(equipped, null, []);

    expect(preview.nameColor).toBe('text-emerald-600');
    expect(preview.nameIcon).toBe('🐉');
    expect(preview.border).toBe('flair-mid-jade');
  });

  test('a hovered item overrides only its own slot', () => {
    const equipped: EquippedFlair = { nameColor: 'text-emerald-600', nameIcon: null, profileBorder: null, title: null };
    const hovered: ShopItem = {
      _id: 'b1',
      name: 'Jade Ring',
      description: '',
      category: 'profileBorder',
      cost: 250,
      value: 'flair-mid-jade',
      tier: 'mid',
      sortOrder: 1,
      isActive: true,
    };

    const preview = composeFlairPreview(equipped, hovered, []);

    expect(preview.nameColor).toBe('text-emerald-600');
    expect(preview.border).toBe('flair-mid-jade');
  });

  test('shows a title badge value only when the equipped title matches a known title item', () => {
    const equipped: EquippedFlair = { ...noFlair, title: 'Chicken Farmer' };

    const preview = composeFlairPreview(equipped, null, [titleItem]);

    expect(preview.titleValue).toBe('Chicken Farmer');
  });

  test('hides the title badge when the equipped title matches no known title item', () => {
    const equipped: EquippedFlair = { ...noFlair, title: 'Some Unknown Title' };

    const preview = composeFlairPreview(equipped, null, [titleItem]);

    expect(preview.titleValue).toBeNull();
  });

  test('a hovered title item is previewed even before it is equipped', () => {
    const preview = composeFlairPreview(noFlair, titleItem, [titleItem]);

    expect(preview.titleValue).toBe('Chicken Farmer');
  });
});
