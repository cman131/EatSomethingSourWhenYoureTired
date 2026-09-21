import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Shop from '../Shop';
import { ShopItem, PurchasedItem, EquippedFlair } from '../../services/api';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../hooks/useApi', () => ({
  useApi: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  shopApi: {
    getCatalog: jest.fn(),
    getInventory: jest.fn(),
    purchase: jest.fn(),
    equip: jest.fn(),
  },
}));

const { useApi } = require('../../hooks/useApi');
const { shopApi } = require('../../services/api');

const mockCatalog = {
  nameColor: [
    { _id: 'item1', name: 'Jade Green', description: 'A jade green', category: 'nameColor', cost: 250, value: 'text-emerald-600', tier: 'mid', sortOrder: 4, isActive: true } as ShopItem,
    { _id: 'item2', name: 'Crimson Dragon', description: 'A crimson color', category: 'nameColor', cost: 600, value: 'text-red-600', tier: 'premium', sortOrder: 7, isActive: true } as ShopItem,
  ],
  nameIcon: [
    { _id: 'item3', name: 'Dragon', description: 'A dragon', category: 'nameIcon', cost: 300, value: '🐉', tier: 'mid', sortOrder: 6, isActive: true } as ShopItem,
  ],
  profileBorder: [],
  title: [],
};

const mockInventory = {
  purchasedItems: [] as PurchasedItem[],
  equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: null } as EquippedFlair,
  pointsBalance: 500,
};

function mockShopUseApi(catalog = mockCatalog, inventory = mockInventory) {
  let callCount = 0;
  useApi.mockImplementation(() => {
    callCount++;
    return callCount % 2 === 1
      ? { data: { data: catalog }, loading: false, error: null }
      : { data: { data: inventory }, loading: false, error: null };
  });
}

describe('Shop page', () => {
  beforeEach(() => {
    mockShopUseApi();
  });

  test('shows loading state initially', () => {
    useApi.mockImplementation(() => ({ data: null, loading: true, error: null }));

    render(<Shop />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('renders category tabs', () => {
    render(<Shop />);

    expect(screen.getByRole('button', { name: /name effects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /icons/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /borders/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /titles/i })).toBeInTheDocument();
  });

  test('displays items for the active tab', () => {
    render(<Shop />);

    expect(screen.getByText('Jade Green')).toBeInTheDocument();
    expect(screen.getByText('Crimson Dragon')).toBeInTheDocument();
  });

  test('switches to Icons tab and shows icon items', () => {
    render(<Shop />);

    fireEvent.click(screen.getByRole('button', { name: /icons/i }));

    expect(screen.getByText('Dragon')).toBeInTheDocument();
    expect(screen.queryByText('Jade Green')).not.toBeInTheDocument();
  });

  test('shows points balance', () => {
    render(<Shop />);

    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  test('links the points balance to the points history page', () => {
    render(<Shop />);

    const link = screen.getByRole('link', { name: /points history/i });
    expect(link).toHaveAttribute('href', '/points');
    expect(link).toHaveTextContent('500');
  });

  test('shows Buy button with cost for unowned items', () => {
    render(<Shop />);

    const buyButtons = screen.getAllByRole('button', { name: /buy/i });
    expect(buyButtons.length).toBeGreaterThan(0);
    expect(screen.getAllByText('250')[0]).toBeInTheDocument();
  });

  test('shows Equip button for owned unequipped items', () => {
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
    });

    render(<Shop />);

    expect(screen.getByRole('button', { name: /equip/i })).toBeInTheDocument();
  });

  test('shows Equipped badge for currently equipped item', () => {
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
      equippedFlair: { nameColor: ownedItem.value, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);

    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });

  test('clicking Equip on an owned item equips it by id', async () => {
    shopApi.equip.mockReset();
    shopApi.equip.mockResolvedValue({});
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
    });

    render(<Shop />);
    fireEvent.click(screen.getByRole('button', { name: /^equip$/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor'));
    expect(await screen.findByText('Equipped Jade Green!')).toBeInTheDocument();
  });

  test('shows an error message when equipping fails', async () => {
    shopApi.equip.mockReset();
    shopApi.equip.mockRejectedValue(new Error('boom'));
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
    });

    render(<Shop />);
    fireEvent.click(screen.getByRole('button', { name: /^equip$/i }));

    expect(await screen.findByText('Failed to equip item. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/^Equipped /)).toBeNull();
  });

  test('clicking Equipped unequips the item', async () => {
    shopApi.equip.mockReset();
    shopApi.equip.mockResolvedValue({});
    const ownedItem = mockCatalog.nameColor[0];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: ownedItem, purchasedAt: '2026-01-01' }],
      equippedFlair: { nameColor: ownedItem.value, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);
    fireEvent.click(screen.getByRole('button', { name: /equipped/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor'));
    expect(await screen.findByText('Unequipped Jade Green')).toBeInTheDocument();
  });

  test('only the item whose value is equipped shows the Equipped badge', () => {
    const ownedA = mockCatalog.nameColor[0];
    const ownedB = mockCatalog.nameColor[1];
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [
        { item: ownedA, purchasedAt: '2026-01-01' },
        { item: ownedB, purchasedAt: '2026-01-01' },
      ],
      equippedFlair: { nameColor: ownedA.value, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);

    expect(screen.getAllByRole('button', { name: /equipped/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^equip$/i })).toHaveLength(1);
  });

  test('a premium name color previews with sparkles', () => {
    const catalog = {
      ...mockCatalog,
      nameColor: [
        { _id: 'gold1', name: 'Mahjong Gold', description: 'Gold', category: 'nameColor', cost: 300, value: 'flair-color-gold', tier: 'premium', sortOrder: 1, isActive: true } as ShopItem,
      ],
    };
    mockShopUseApi(catalog);

    render(<Shop />);

    const card = screen.getByTestId('flair-item-card-gold1');
    // eslint-disable-next-line testing-library/no-node-access -- sparkles are decorative aria-hidden spans with no accessible query
    expect(card.querySelectorAll('.flair-sparkle')).toHaveLength(3);
  });

  test('hovering a premium name color shows sparkles in the preview', () => {
    const catalog = {
      ...mockCatalog,
      nameColor: [
        { _id: 'gold1', name: 'Mahjong Gold', description: 'Gold', category: 'nameColor', cost: 300, value: 'flair-color-gold', tier: 'premium', sortOrder: 1, isActive: true } as ShopItem,
      ],
    };
    mockShopUseApi(catalog);

    render(<Shop />);
    fireEvent.mouseEnter(screen.getByTestId('flair-item-card-gold1'));

    const previewBox = screen.getByTestId('preview-box');
    // eslint-disable-next-line testing-library/no-node-access -- sparkles are decorative aria-hidden elements with no accessible query
    expect(previewBox.querySelectorAll('.flair-sparkle')).toHaveLength(3);
    const nameSpan = screen.getByText('Your Name');
    expect(nameSpan).toHaveClass('flair-color-gold');
    expect(nameSpan).not.toHaveClass('text-gray-900');
  });

  test('a mid icon previews with the shared glow class', () => {
    mockShopUseApi();
    render(<Shop />);

    fireEvent.click(screen.getByRole('button', { name: /icons/i }));

    const card = screen.getByTestId('flair-item-card-item3');
    // eslint-disable-next-line testing-library/no-node-access -- the glow class sits on a decorative aria-hidden span with no accessible query
    expect(card.querySelector('.flair-icon-glow')).toBeInTheDocument();
  });

  describe('retired items', () => {
    const retiredColor = { _id: 'retired1', name: 'Old Teal', description: 'No longer sold', category: 'nameColor', cost: 150, value: 'text-teal-600', tier: 'mid', sortOrder: 9, isActive: false } as ShopItem;
    const retiredTitle = { _id: 'retiredTitle1', name: 'Founding Player', description: 'No longer sold', category: 'title', cost: 500, value: 'Founding Player', tier: 'premium', sortOrder: 9, isActive: false } as ShopItem;
    const noFlair: EquippedFlair = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

    test('lists an owned item missing from the catalog under "Owned (retired)" with Equip and no Buy', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredColor, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);

      expect(screen.getByRole('heading', { name: /owned \(retired\)/i })).toBeInTheDocument();
      const card = screen.getByTestId('flair-item-card-retired1');
      expect(card).toHaveTextContent('Old Teal');
      expect(screen.getAllByRole('button', { name: /^equip$/i })).toHaveLength(1);
      // Only the two catalog items are buyable
      expect(screen.getAllByRole('button', { name: /^buy$/i })).toHaveLength(2);
    });

    test('equips a retired item by id', async () => {
      shopApi.equip.mockReset();
      shopApi.equip.mockResolvedValue({});
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredColor, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      fireEvent.click(screen.getByRole('button', { name: /^equip$/i }));

      await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('retired1', 'nameColor'));
      expect(await screen.findByText('Equipped Old Teal!')).toBeInTheDocument();
    });

    test('unequips an equipped retired item', async () => {
      shopApi.equip.mockReset();
      shopApi.equip.mockResolvedValue({});
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredColor, purchasedAt: '2026-01-01' }],
        equippedFlair: { ...noFlair, nameColor: retiredColor.value },
      });

      render(<Shop />);
      fireEvent.click(screen.getByRole('button', { name: /equipped/i }));

      await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor'));
      expect(await screen.findByText('Unequipped Old Teal')).toBeInTheDocument();
    });

    test('only shows retired items that belong to the active tab', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);

      expect(screen.queryByRole('heading', { name: /owned \(retired\)/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('flair-item-card-retiredTitle1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /titles/i }));

      expect(screen.getByRole('heading', { name: /owned \(retired\)/i })).toBeInTheDocument();
      expect(screen.getByTestId('flair-item-card-retiredTitle1')).toBeInTheDocument();
    });

    test('shows the retired item instead of the empty message when the catalog tab is empty', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      fireEvent.click(screen.getByRole('button', { name: /titles/i }));

      expect(screen.queryByText(/no items available/i)).not.toBeInTheDocument();
    });

    test('does not list an owned catalog item as retired', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: mockCatalog.nameColor[0], purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);

      expect(screen.queryByRole('heading', { name: /owned \(retired\)/i })).not.toBeInTheDocument();
      expect(screen.getAllByText('Jade Green')).toHaveLength(1);
    });

    test('tolerates a purchase whose item no longer exists', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [
          { item: null, purchasedAt: '2026-01-01' } as unknown as PurchasedItem,
          { item: mockCatalog.nameColor[0], purchasedAt: '2026-01-01' },
        ],
      });

      render(<Shop />);

      expect(screen.getByRole('button', { name: /^equip$/i })).toBeInTheDocument();
    });

    test('shows an equipped retired title in the preview', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredTitle, purchasedAt: '2026-01-01' }],
        equippedFlair: { ...noFlair, title: retiredTitle.value },
      });

      render(<Shop />);

      expect(screen.getByTestId('preview-title-badge')).toBeInTheDocument();
    });

    test('hovering a retired item previews it', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: retiredColor, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      const nameSpan = screen.getByText('Your Name');
      expect(nameSpan).not.toHaveClass('text-teal-600');

      fireEvent.mouseEnter(screen.getByTestId('flair-item-card-retired1'));

      expect(nameSpan).toHaveClass('text-teal-600');
    });
  });

  describe('hover preview', () => {
    test('hovering a nameColor item applies the color class and removes text-gray-900 from the preview name', () => {
      mockShopUseApi(); // default catalog: nameColor[0] has value 'text-emerald-600'
      render(<Shop />);

      // Before hover — span has the fallback text-gray-900
      const nameSpan = screen.getByText('Your Name');
      expect(nameSpan).toHaveClass('text-gray-900');

      // Fire hover on 'Jade Green' (value: 'text-emerald-600')
      const itemCard = screen.getByTestId('flair-item-card-item1');
      fireEvent.mouseEnter(itemCard);

      // After hover — color class applied, text-gray-900 removed
      expect(nameSpan).toHaveClass('text-emerald-600');
      expect(nameSpan).not.toHaveClass('text-gray-900');
    });

    test('hovering a profileBorder item applies its class to the preview avatar', () => {
      const catalogWithBorder = {
        ...mockCatalog,
        profileBorder: [
          {
            _id: 'border1',
            name: 'Jade Ring',
            description: 'A jade ring',
            category: 'profileBorder' as const,
            cost: 250,
            value: 'flair-mid-jade',
            tier: 'mid' as const,
            sortOrder: 3,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithBorder);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /borders/i }));

      // Before hover — preview avatar wrapper has no border class
      const avatarDiv = screen.getByTestId('preview-avatar');
      expect(avatarDiv).not.toHaveClass('flair-mid-jade');

      // Fire hover
      const itemCard = screen.getByTestId('flair-item-card-border1');
      fireEvent.mouseEnter(itemCard);

      // After hover — preview avatar wrapper has the gradient border class
      expect(avatarDiv).toHaveClass('flair-mid-jade');
    });

    test('shows equipped title in preview without hovering a title item', () => {
      const catalogWithTitle = {
        ...mockCatalog,
        title: [
          {
            _id: 'title1',
            name: 'Chicken Farmer',
            description: 'A special title',
            category: 'title' as const,
            cost: 500,
            value: 'Chicken Farmer',
            tier: 'premium' as const,
            sortOrder: 1,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithTitle, {
        ...mockInventory,
        equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Chicken Farmer' },
      });
      render(<Shop />);

      // Default tab is nameColor — no title items visible in grid
      // The equipped title should still appear in the preview box
      expect(screen.queryByTestId('preview-title-badge')).toBeInTheDocument();
    });

    test('hovering a title item shows that title in the preview', () => {
      const catalogWithTitle = {
        ...mockCatalog,
        title: [
          {
            _id: 'title2',
            name: 'Chombo Chaser',
            description: 'A chaos title',
            category: 'title' as const,
            cost: 500,
            value: 'Chombo Chaser',
            tier: 'premium' as const,
            sortOrder: 2,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithTitle);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /titles/i }));

      expect(screen.queryByTestId('preview-title-badge')).not.toBeInTheDocument();

      // 'Chombo Chaser' appears as the item name in the card (exact text, no emoji)
      const itemCard = screen.getByTestId('flair-item-card-title2');
      fireEvent.mouseEnter(itemCard);

      expect(screen.queryByTestId('preview-title-badge')).toBeInTheDocument();
    });

    test('mid-tier title item renders with silver metallic badge in item grid', () => {
      const catalogWithMidTitle = {
        ...mockCatalog,
        title: [
          {
            _id: 'title-mid1',
            name: 'East Wind',
            description: 'The dealer seat',
            category: 'title' as const,
            cost: 250,
            value: 'East Wind',
            tier: 'mid' as const,
            sortOrder: 3,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithMidTitle);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /titles/i }));

      const itemCard = screen.getByTestId('flair-item-card-title-mid1');
      const badge = itemCard.querySelector('.flair-title-mid');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('East Wind');
    });
  });
});
