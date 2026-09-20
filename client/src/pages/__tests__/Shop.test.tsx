import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
      equippedFlair: { nameColor: ownedItem._id, nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);

    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });

  describe('hover preview', () => {
    test('hovering a profileBorder item applies its class to the preview avatar', () => {
      const catalogWithBorder = {
        ...mockCatalog,
        profileBorder: [
          {
            _id: 'border1',
            name: 'Jade Ring',
            description: 'A jade ring',
            category: 'profileBorder' as const,
            cost: 200,
            value: 'flair-ring-jade',
            tier: 'entry' as const,
            sortOrder: 1,
            isActive: true,
          } as ShopItem,
        ],
      };
      mockShopUseApi(catalogWithBorder);
      render(<Shop />);

      fireEvent.click(screen.getByRole('button', { name: /borders/i }));

      // Before hover — preview avatar has no border class
      const nameSpan = screen.getByText('Your Name');
      const avatarDiv = nameSpan.previousElementSibling as HTMLElement;
      expect(avatarDiv).not.toHaveClass('flair-ring-jade');

      // Fire hover
      const itemCard = screen.getByText('Jade Ring').closest('div.bg-white') as HTMLElement;
      fireEvent.mouseEnter(itemCard);

      // After hover — preview avatar has the border class
      expect(avatarDiv).toHaveClass('flair-ring-jade');
    });
  });
});
