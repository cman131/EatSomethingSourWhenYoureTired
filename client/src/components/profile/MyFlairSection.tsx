import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { shopApi, ShopItem, ShopInventory, FlairCategory, FlairLoadout } from '../../services/api';
import { isPremiumBorder, isMidTierBorder, isFlairEquipped } from '../../utils/flairUtils';
import { composeFlairPreview } from '../../utils/flairPreview';
import { useFlairEquip } from '../../hooks/useFlairEquip';
import FlairName from '../user/FlairName';
import FlairIcon from '../user/FlairIcon';
import TitleBadge from '../user/TitleBadge';

const SLOTS: { key: FlairCategory; label: string }[] = [
  { key: 'nameColor', label: 'Name Color' },
  { key: 'nameIcon', label: 'Icon' },
  { key: 'profileBorder', label: 'Border' },
  { key: 'profileBackdrop', label: 'Backdrop' },
  { key: 'title', label: 'Title' },
];

// Matches server/src/utils/flairLoadoutService.js's MAX_FLAIR_LOADOUTS — the server is the
// source of truth (a create/apply past this is rejected there too); this only drives the UI
// hint so a player isn't shown a "Save" box that would just be rejected.
const MAX_LOADOUTS = 2;

const EMPTY_FLAIR = { nameColor: null, nameIcon: null, profileBorder: null, profileBackdrop: null, title: null };

interface MyFlairSectionProps {
  onRefetchProfile: () => Promise<void>;
}

const MyFlairSection: React.FC<MyFlairSectionProps> = ({ onRefetchProfile }) => {
  const [inventoryKey, setInventoryKey] = useState(0);
  const inventoryFetcher = useCallback(() => shopApi.getInventory(), [inventoryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: inventoryRes, loading } = useApi<{ data: ShopInventory }>(inventoryFetcher, [inventoryKey]);
  const inventory = inventoryRes?.data;

  const [hoveredItem, setHoveredItem] = useState<ShopItem | null>(null);
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const [loadoutError, setLoadoutError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const equippedFlair = inventory?.equippedFlair ?? EMPTY_FLAIR;
  const ownedItems = (inventory?.purchasedItems ?? []).flatMap(p => (p.item ? [p.item] : []));
  const loadouts = inventory?.flairLoadouts ?? [];

  const refresh = useCallback(async () => {
    setInventoryKey(k => k + 1);
    await onRefetchProfile();
  }, [onRefetchProfile]);

  const { actionError, actionSuccess, equipItem } = useFlairEquip(equippedFlair, refresh);

  const knownTitleItems = ownedItems.filter(i => i.category === 'title');
  const preview = composeFlairPreview(equippedFlair, hoveredItem, knownTitleItems);
  const previewNeedsGradientBorder = isPremiumBorder(preview.border) || isMidTierBorder(preview.border);

  const handleSaveLoadout = async () => {
    setLoadoutError(null);
    const name = newLoadoutName.trim();
    if (!name) {
      setLoadoutError('Give this loadout a name.');
      return;
    }
    try {
      await shopApi.createLoadout({ name, ...equippedFlair });
      setNewLoadoutName('');
      await refresh();
    } catch {
      setLoadoutError('Failed to save loadout. Please try again.');
    }
  };

  const handleApplyLoadout = async (loadout: FlairLoadout) => {
    setLoadoutError(null);
    try {
      await shopApi.applyLoadout(loadout._id);
      await refresh();
    } catch {
      setLoadoutError('Failed to apply loadout. Please try again.');
    }
  };

  const handleDeleteLoadout = async (loadoutId: string) => {
    setLoadoutError(null);
    try {
      await shopApi.deleteLoadout(loadoutId);
      await refresh();
    } catch {
      setLoadoutError('Failed to delete loadout. Please try again.');
    }
  };

  const startRename = (loadout: FlairLoadout) => {
    setRenamingId(loadout._id);
    setRenameValue(loadout.name);
  };

  const handleRenameLoadout = async (loadoutId: string) => {
    setLoadoutError(null);
    const name = renameValue.trim();
    if (!name) {
      setLoadoutError('Give this loadout a name.');
      return;
    }
    try {
      await shopApi.renameLoadout(loadoutId, name);
      setRenamingId(null);
      await refresh();
    } catch {
      setLoadoutError('Failed to rename loadout. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-gray-500">Loading your flair…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">My Flair</h2>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {actionError}
        </div>
      )}

      {/* Live preview */}
      <div data-testid="my-flair-preview-box" className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</div>
        <div className="flex items-center gap-3">
          {previewNeedsGradientBorder ? (
            <div className={preview.border} data-testid="my-flair-preview-avatar">
              <div className="flair-border-inner w-10 h-10 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs">?</span>
              </div>
            </div>
          ) : (
            <div
              className={`w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${preview.border}`}
              data-testid="my-flair-preview-avatar"
            >
              <span className="text-gray-400 text-xs">?</span>
            </div>
          )}
          <span className="font-medium">
            {preview.nameIcon && <FlairIcon value={preview.nameIcon} className="mr-1 text-sm" />}
            <FlairName name="Your Name" colorValue={preview.nameColor} defaultColorClass="text-gray-900" />
          </span>
          {preview.titleValue && (
            <span data-testid="my-flair-preview-title-badge">
              <TitleBadge value={preview.titleValue} />
            </span>
          )}
        </div>
      </div>

      {/* Owned items by slot */}
      {SLOTS.map(slot => {
        const items = ownedItems.filter(i => i.category === slot.key);
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={slot.key} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{slot.label}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map(item => {
                const equipped = isFlairEquipped(equippedFlair, item);
                return (
                  <button
                    key={item._id}
                    type="button"
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => equipItem(item)}
                    aria-pressed={equipped}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                      equipped
                        ? 'bg-green-600 text-white border-green-600'
                        : 'text-primary-700 border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    {item.name}
                    {equipped ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {ownedItems.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">You don&apos;t own any flair yet — visit the Shop to get started.</p>
      )}

      {/* Saved loadouts */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Loadouts</h3>

        {loadoutError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
            {loadoutError}
          </div>
        )}

        {loadouts.length === 0 && <p className="text-sm text-gray-500 mb-3">No saved loadouts yet.</p>}

        <ul className="space-y-2 mb-4">
          {loadouts.map(loadout => (
            <li key={loadout._id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md">
              {renamingId === loadout._id ? (
                <>
                  <label htmlFor={`rename-loadout-${loadout._id}`} className="sr-only">
                    Loadout name
                  </label>
                  <input
                    id={`rename-loadout-${loadout._id}`}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                  <button type="button" onClick={() => handleRenameLoadout(loadout._id)} className="text-sm font-medium text-primary-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-sm text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-900">{loadout.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyLoadout(loadout)}
                      className="text-sm font-medium text-primary-700 hover:text-primary-800"
                    >
                      Apply
                    </button>
                    <button type="button" onClick={() => startRename(loadout)} className="text-sm text-gray-500 hover:text-gray-700">
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoadout(loadout._id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {loadouts.length < MAX_LOADOUTS ? (
          <div className="flex items-center gap-2">
            <label htmlFor="new-loadout-name" className="sr-only">
              Save current look as
            </label>
            <input
              id="new-loadout-name"
              type="text"
              placeholder="Save current look as…"
              value={newLoadoutName}
              onChange={e => setNewLoadoutName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
            />
            <button
              type="button"
              onClick={handleSaveLoadout}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
            >
              Save Loadout
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            You&apos;ve saved {MAX_LOADOUTS} loadouts, the maximum for now. Delete one to save a new look.
          </p>
        )}
      </div>
    </div>
  );
};

export default MyFlairSection;
