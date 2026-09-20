import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Shop from '../Shop';

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
    { _id: 'item1', name: 'Jade Green', description: 'A jade green', category: 'nameColor', cost: 200, value: 'text-emerald-600', sortOrder: 1, isActive: true },
    { _id: 'item2', name: 'Crimson', description: 'A crimson color', category: 'nameColor', cost: 200, value: 'text-red-600', sortOrder: 2, isActive: true },
  ],
  nameIcon: [
    { _id: 'item3', name: 'Dragon', description: 'A dragon', category: 'nameIcon', cost: 150, value: '🐉', sortOrder: 1, isActive: true },
  ],
  profileBorder: [],
  title: [],
};

const mockInventory = {
  purchasedItems: [],
  equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: null },
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
    expect(screen.getByText('Crimson')).toBeInTheDocument();
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
    expect(screen.getAllByText('200')[0]).toBeInTheDocument();
  });

  test('shows Equip button for owned unequipped items', () => {
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: { _id: 'item1', name: 'Jade Green', category: 'nameColor', cost: 200, value: 'text-emerald-600' }, purchasedAt: '2026-01-01' }],
    });

    render(<Shop />);

    expect(screen.getByRole('button', { name: /equip/i })).toBeInTheDocument();
  });

  test('shows Equipped badge for currently equipped item', () => {
    mockShopUseApi(mockCatalog, {
      ...mockInventory,
      purchasedItems: [{ item: { _id: 'item1', name: 'Jade Green', category: 'nameColor', cost: 200, value: 'text-emerald-600' }, purchasedAt: '2026-01-01' }],
      equippedFlair: { nameColor: 'item1', nameIcon: null, profileBorder: null, title: null },
    });

    render(<Shop />);

    expect(screen.getByText(/equipped/i)).toBeInTheDocument();
  });
});
