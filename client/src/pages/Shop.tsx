import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useApi } from '../hooks/useApi';
import {
  shopApi,
  ShopItem,
  ShopCatalog,
  ShopInventory,
  FlairCategory,
  EquippedFlair,
} from '../services/api';
import { SparklesIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { isPremiumBorder, isMidTierBorder, getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../utils/flairUtils';

type Tab = { key: FlairCategory; label: string };

const TABS: Tab[] = [
  { key: 'nameColor', label: 'Name Effects' },
  { key: 'nameIcon', label: 'Icons' },
  { key: 'profileBorder', label: 'Borders' },
  { key: 'title', label: 'Titles' },
];

// equippedFlair stores each slot's item `value` (e.g. 'text-emerald-600'), not its `_id`.
const isItemEquipped = (equippedFlair: EquippedFlair, item: ShopItem): boolean =>
  equippedFlair[item.category] === item.value;

const Shop: React.FC = () => {
  useRequireAuth();

  const [activeTab, setActiveTab] = useState<FlairCategory>('nameColor');
  const [hoveredItem, setHoveredItem] = useState<ShopItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: catalogRes, loading: catalogLoading } = useApi<{ data: ShopCatalog }>(
    shopApi.getCatalog,
    []
  );

  const [inventoryKey, setInventoryKey] = useState(0);
  const inventoryFetcher = useCallback(() => shopApi.getInventory(), [inventoryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: inventoryRes, loading: inventoryLoading } = useApi<{ data: ShopInventory }>(
    inventoryFetcher,
    [inventoryKey]
  );

  const catalog = catalogRes?.data;
  const inventory = inventoryRes?.data;

  const isLoading = catalogLoading || inventoryLoading;

  const ownedIds = new Set(
    (inventory?.purchasedItems ?? []).map(p => p.item._id)
  );
  const equippedFlair = inventory?.equippedFlair ?? { nameColor: null, nameIcon: null, profileBorder: null, title: null };

  const refreshInventory = () => setInventoryKey(k => k + 1);

  const handlePurchase = async (item: ShopItem) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await shopApi.purchase(item._id);
      setActionSuccess(`Purchased ${item.name}!`);
      refreshInventory();
    } catch {
      setActionError('Purchase failed. Please try again.');
    }
  };

  const handleEquip = async (item: ShopItem) => {
    setActionError(null);
    setActionSuccess(null);
    const slot = item.category;
    const isEquipped = isItemEquipped(equippedFlair, item);
    try {
      await shopApi.equip(isEquipped ? null : item._id, slot);
      setActionSuccess(isEquipped ? `Unequipped ${item.name}` : `Equipped ${item.name}!`);
      refreshInventory();
    } catch {
      setActionError('Failed to equip item. Please try again.');
    }
  };

  const previewUser = {
    _id: 'preview',
    displayName: 'Your Name',
    equippedFlair: hoveredItem
      ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
      : equippedFlair,
  };

  const previewNameColor = previewUser.equippedFlair.nameColor ?? null;
  const previewIcon = previewUser.equippedFlair.nameIcon ?? '';
  const previewBorder = previewUser.equippedFlair.profileBorder ?? '';
  const previewNeedsGradientBorder = isPremiumBorder(previewBorder) || isMidTierBorder(previewBorder);

  const previewTitleValue = previewUser.equippedFlair.title;
  const previewTitleItem = previewTitleValue
    ? (catalog?.title ?? []).find(i => i.value === previewTitleValue) ?? null
    : null;

  const currentItems: ShopItem[] = catalog?.[activeTab] ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading shop…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Flair Shop</h1>
        </div>
        <Link
          to="/points"
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
        >
          <CurrencyDollarIcon className="h-5 w-5 text-yellow-500" />
          <span>You have <span className="font-bold text-yellow-600">{inventory?.pointsBalance ?? 0}</span> points</span>
          <span className="text-primary-600">· Points history →</span>
        </Link>
      </div>

      {/* Feedback */}
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
      <div data-testid="preview-box" className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</div>
        <div className="flex items-center gap-3">
          {previewNeedsGradientBorder ? (
            <div className={previewBorder} data-testid="preview-avatar">
              <div className="flair-border-inner w-10 h-10 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs">?</span>
              </div>
            </div>
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${previewBorder}`} data-testid="preview-avatar">
              <span className="text-gray-400 text-xs">?</span>
            </div>
          )}
          <span className={`font-medium ${previewNameColor ?? 'text-gray-900'}`}>
            {previewIcon && <span className="mr-1 text-sm">{previewIcon}</span>}
            Your Name
          </span>
          {previewTitleItem && (
            <span data-testid="preview-title-badge">
              <TitleBadge value={previewTitleItem.value} tier={previewTitleItem.tier} />
            </span>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Item grid */}
      {currentItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No items available in this category.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map(item => {
            const owned = ownedIds.has(item._id);
            const equipped = isItemEquipped(equippedFlair, item);

            return (
              <div
                key={item._id}
                data-testid={`flair-item-card-${item._id}`}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Item preview */}
                <div className="flex items-center gap-2 mb-3">
                  {item.category === 'nameColor' && (
                    <span className={`font-semibold text-base ${item.value}`}>Aa</span>
                  )}
                  {item.category === 'nameIcon' && (
                    <span className="text-2xl">{item.value}</span>
                  )}
                  {item.category === 'profileBorder' && (
                    (isPremiumBorder(item.value) || isMidTierBorder(item.value)) ? (
                      <div className={item.value}>
                        <div className="flair-border-inner w-8 h-8 bg-gray-300" />
                      </div>
                    ) : (
                      <div className={`w-8 h-8 rounded-full bg-gray-300 ${item.value}`} />
                    )
                  )}
                  {item.category === 'title' && (
                    <TitleBadge value={item.value} tier={item.tier} />
                  )}
                  <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                </div>

                <p className="text-xs text-gray-500 mb-4">{item.description}</p>

                {/* Action button */}
                <div className="flex items-center justify-between">
                  {!owned && (
                    <>
                      <span className="flex items-center gap-1 text-sm text-gray-700">
                        <CurrencyDollarIcon className="h-4 w-4 text-yellow-500" />
                        {item.cost}
                      </span>
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={(inventory?.pointsBalance ?? 0) < item.cost}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
                      >
                        Buy
                      </button>
                    </>
                  )}
                  {owned && equipped && (
                    <button
                      onClick={() => handleEquip(item)}
                      className="w-full px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                    >
                      Equipped ✓
                    </button>
                  )}
                  {owned && !equipped && (
                    <button
                      onClick={() => handleEquip(item)}
                      className="w-full px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-300 hover:bg-primary-50 rounded-md transition-colors"
                    >
                      Equip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TitleBadge: React.FC<{ value: string; tier: ShopItem['tier'] }> = ({ value, tier }) => {
  if (tier === 'premium') {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-1">{emoji}</span>}
        {value}
      </span>
    );
  }
  if (tier === 'mid') {
    const midClass = getMidTierTitleClass(value);
    if (midClass) {
      return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${midClass}`}>
          {value}
        </span>
      );
    }
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};

export default Shop;
