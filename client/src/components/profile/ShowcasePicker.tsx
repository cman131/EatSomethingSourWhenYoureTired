import React, { useEffect, useState } from 'react';
import { shopApi, ShopItem, ShowcaseEntry, User } from '../../services/api';
import {
  FLAIR_CATEGORY_LABELS,
  SHOWCASE_MAX_ENTRIES,
  SHOWCASE_STAT_KEYS,
  SHOWCASE_STAT_LABELS,
  showcaseEntryKey,
  toggleShowcaseEntry,
} from '../../utils/showcaseUtils';

interface ShowcasePickerProps {
  user: User;
  onSave: (entries: ShowcaseEntry[]) => Promise<void>;
  onCancel: () => void;
}

interface PickerOption {
  entry: ShowcaseEntry;
  label: string;
  hint?: string;
}

const flairOption = (item: ShopItem): PickerOption => ({
  entry: { type: 'flair', category: item.category, value: item.value },
  label: item.name,
  hint: FLAIR_CATEGORY_LABELS[item.category],
});

const favoriteOptions = (user: User): PickerOption[] => [
  ...(user.favoriteYaku ? [{ entry: { type: 'favoriteYaku' } as ShowcaseEntry, label: 'Favorite Yaku', hint: user.favoriteYaku }] : []),
  ...(user.favoriteTile ? [{ entry: { type: 'favoriteTile' } as ShowcaseEntry, label: 'Favorite Tile', hint: user.favoriteTile.name }] : []),
];

const statOptions = (): PickerOption[] =>
  SHOWCASE_STAT_KEYS.map(key => ({
    entry: { type: 'stat', key },
    label: SHOWCASE_STAT_LABELS[key],
  }));

const ShowcasePicker: React.FC<ShowcasePickerProps> = ({ user, onSave, onCancel }) => {
  const [draft, setDraft] = useState<ShowcaseEntry[]>(user.showcase ?? []);
  const [ownedItems, setOwnedItems] = useState<ShopItem[]>([]);
  const [inventoryError, setInventoryError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadOwnedFlair = async () => {
      try {
        const response = await shopApi.getInventory();
        if (!cancelled) {
          setOwnedItems(response.data.purchasedItems.flatMap(p => (p.item ? [p.item] : [])));
        }
      } catch {
        if (!cancelled) {
          setInventoryError(true);
        }
      }
    };
    loadOwnedFlair();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Failed to save showcase');
      setSaving(false);
    }
  };

  const draftKeys = new Set(draft.map(showcaseEntryKey));
  const isFull = draft.length >= SHOWCASE_MAX_ENTRIES;

  const renderGroup = (title: string, options: PickerOption[]) =>
    options.length > 0 && (
      <fieldset key={title} className="space-y-1">
        <legend className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</legend>
        {options.map(option => {
          const checked = draftKeys.has(showcaseEntryKey(option.entry));
          return (
            <label key={showcaseEntryKey(option.entry)} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && isFull}
                onChange={() => setDraft(toggleShowcaseEntry(draft, option.entry))}
              />
              <span>{option.label}</span>
              {option.hint && <span className="text-xs text-gray-500">{option.hint}</span>}
            </label>
          );
        })}
      </fieldset>
    );

  return (
    <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
      <div className="text-sm text-gray-700">
        {draft.length} of {SHOWCASE_MAX_ENTRIES} pinned
      </div>

      {inventoryError && (
        <p role="alert" className="text-sm text-red-600">
          Could not load your owned flair. Favorites and stats can still be pinned.
        </p>
      )}

      {renderGroup('Owned flair', ownedItems.map(flairOption))}
      {renderGroup('Favorites', favoriteOptions(user))}
      {renderGroup('Stats', statOptions())}

      {saveError && (
        <p role="alert" className="text-sm text-red-600">
          {saveError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 rounded-md"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ShowcasePicker;
