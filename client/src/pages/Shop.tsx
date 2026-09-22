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
} from '../services/api';
import { SparklesIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { isPremiumBorder, isMidTierBorder, isFlairEquipped } from '../utils/flairUtils';
import FlairName from '../components/user/FlairName';
import FlairIcon from '../components/user/FlairIcon';
import TitleBadge from '../components/user/TitleBadge';
import ProfileBackdrop from '../components/user/ProfileBackdrop';

type Tab = { key: FlairCategory; label: string };

const TABS: Tab[] = [
  { key: 'nameColor', label: 'Name Effects' },
  { key: 'nameIcon', label: 'Icons' },
  { key: 'profileBorder', label: 'Borders' },
  { key: 'profileBackdrop', label: 'Backdrops' },
  { key: 'title', label: 'Titles' },
];

interface FlairItemCardProps {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  canAfford: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  onHover: (item: ShopItem | null) => void;
}

const FlairItemCard: React.FC<FlairItemCardProps> = ({
  item,
  owned,
  equipped,
  canAfford,
  onBuy,
  onEquip,
  onHover,
}) => (
  <div
    data-testid={`flair-item-card-${item._id}`}
    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
    onMouseEnter={() => onHover(item)}
    onMouseLeave={() => onHover(null)}
  >
    {/* Item preview */}
    <div className="flex items-center gap-2 mb-3">
      {item.category === 'nameColor' && (
        <span className="font-semibold text-base">
          <FlairName name="Aa" colorValue={item.value} />
        </span>
      )}
      {item.category === 'nameIcon' && (
        <FlairIcon value={item.value} className="text-2xl" />
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
      {item.category === 'profileBackdrop' && (
        <ProfileBackdrop value={item.value} className="w-16 h-8" testId={`backdrop-swatch-${item._id}`} />
      )}
      {item.category === 'title' && (
        <TitleBadge value={item.value} />
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
            onClick={() => onBuy(item)}
            disabled={!canAfford}
            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Buy
          </button>
        </>
      )}
      {owned && equipped && (
        <button
          onClick={() => onEquip(item)}
          className="w-full px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
        >
          Equipped ✓
        </button>
      )}
      {owned && !equipped && (
        <button
          onClick={() => onEquip(item)}
          className="w-full px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-300 hover:bg-primary-50 rounded-md transition-colors"
        >
          Equip
        </button>
      )}
    </div>
  </div>
);

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

  // A purchase can reference a ShopItem that no longer exists; skip those.
  const ownedItems = (inventory?.purchasedItems ?? []).flatMap(p => (p.item ? [p.item] : []));
  const ownedIds = new Set(ownedItems.map(item => item._id));
  const catalogIds = new Set(TABS.flatMap(tab => catalog?.[tab.key] ?? []).map(item => item._id));
  const equippedFlair = inventory?.equippedFlair ?? {
    nameColor: null,
    nameIcon: null,
    profileBorder: null,
    profileBackdrop: null,
    title: null,
  };

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
    const isEquipped = isFlairEquipped(equippedFlair, item);
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
  const previewBackdrop = previewUser.equippedFlair.profileBackdrop ?? null;
  const previewNeedsGradientBorder = isPremiumBorder(previewBorder) || isMidTierBorder(previewBorder);

  const previewTitleValue = previewUser.equippedFlair.title;
  const knownTitleItems = [
    ...(catalog?.title ?? []),
    ...ownedItems.filter(i => i.category === 'title' && !catalogIds.has(i._id)),
  ];
  const previewTitleItem = previewTitleValue
    ? knownTitleItems.find(i => i.value === previewTitleValue) ?? null
    : null;

  const currentItems: ShopItem[] = catalog?.[activeTab] ?? [];
  const retiredItems = ownedItems.filter(i => i.category === activeTab && !catalogIds.has(i._id));

  const renderCard = (item: ShopItem) => (
    <FlairItemCard
      key={item._id}
      item={item}
      owned={ownedIds.has(item._id)}
      equipped={isFlairEquipped(equippedFlair, item)}
      canAfford={(inventory?.pointsBalance ?? 0) >= item.cost}
      onBuy={handlePurchase}
      onEquip={handleEquip}
      onHover={setHoveredItem}
    />
  );

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
        <ProfileBackdrop value={previewBackdrop} className="h-10 mb-3" testId="preview-backdrop" />
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
          <span className="font-medium">
            {previewIcon && <FlairIcon value={previewIcon} className="mr-1 text-sm" />}
            <FlairName name="Your Name" colorValue={previewNameColor} defaultColorClass="text-gray-900" />
          </span>
          {previewTitleItem && (
            <span data-testid="preview-title-badge">
              <TitleBadge value={previewTitleItem.value} />
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
      {currentItems.length === 0 && retiredItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">No items available in this category.</div>
      )}
      {currentItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map(renderCard)}
        </div>
      )}

      {/* Owned items that are no longer sold — still equippable, never buyable */}
      {retiredItems.length > 0 && (
        <section className={currentItems.length > 0 ? 'mt-8' : undefined}>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Owned (retired)</h2>
          <p className="text-xs text-gray-500 mb-4">
            These items are no longer sold, but you can still equip or unequip them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {retiredItems.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
};

export default Shop;
