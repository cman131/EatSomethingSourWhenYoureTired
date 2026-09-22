import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyFlairSection from '../MyFlairSection';
import { ShopInventory } from '../../../services/api';

jest.mock('../../../hooks/useApi', () => ({ useApi: jest.fn() }));
jest.mock('../../../services/api', () => ({
  shopApi: {
    getInventory: jest.fn(),
    equip: jest.fn(),
    createLoadout: jest.fn(),
    renameLoadout: jest.fn(),
    deleteLoadout: jest.fn(),
    applyLoadout: jest.fn(),
  },
}));

const { useApi } = require('../../../hooks/useApi');
const { shopApi } = require('../../../services/api');

const colorItem = { _id: 'item1', name: 'Jade Green', description: '', category: 'nameColor', cost: 250, value: 'text-emerald-600', tier: 'mid', sortOrder: 1, isActive: true };
const retiredTitleItem = { _id: 'title1', name: 'Founding Player', description: '', category: 'title', cost: 500, value: 'Founding Player', tier: 'premium', sortOrder: 1, isActive: false };

function baseInventory(overrides: Partial<ShopInventory> = {}): ShopInventory {
  return {
    purchasedItems: [{ item: colorItem, purchasedAt: '2026-01-01' }],
    equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: null },
    pointsBalance: 500,
    flairLoadouts: [],
    ...overrides,
  };
}

function mockInventory(inventory: ShopInventory) {
  useApi.mockReturnValue({ data: { data: inventory }, loading: false, error: null });
}

const onRefetchProfile = async () => {};

describe('MyFlairSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a loading state', () => {
    useApi.mockReturnValue({ data: null, loading: true, error: null });

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('lists owned items grouped by slot', () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByRole('button', { name: /jade green/i })).toBeInTheDocument();
  });

  test('lists a retired owned item alongside active ones', () => {
    mockInventory(baseInventory({
      purchasedItems: [
        { item: colorItem, purchasedAt: '2026-01-01' },
        { item: retiredTitleItem, purchasedAt: '2026-01-01' },
      ],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByRole('button', { name: /founding player/i })).toBeInTheDocument();
  });

  test('clicking an owned item equips it', async () => {
    shopApi.equip.mockResolvedValue({});
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /jade green/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor'));
  });

  test('clicking an equipped item unequips it', async () => {
    shopApi.equip.mockResolvedValue({});
    mockInventory(baseInventory({
      equippedFlair: { nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null },
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /jade green/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor'));
  });

  test('shows "no saved loadouts" when there are none', () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByText(/no saved loadouts/i)).toBeInTheDocument();
  });

  test('saves the current look as a new loadout', async () => {
    shopApi.createLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      equippedFlair: { nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null },
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.change(screen.getByLabelText(/save current look as/i), { target: { value: 'Everyday' } });
    fireEvent.click(screen.getByRole('button', { name: /save loadout/i }));

    await waitFor(() =>
      expect(shopApi.createLoadout).toHaveBeenCalledWith({
        name: 'Everyday',
        nameColor: colorItem.value,
        nameIcon: null,
        profileBorder: null,
        title: null,
      })
    );
  });

  test('shows a validation message instead of calling the API when saving with a blank name', async () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /save loadout/i }));

    expect(await screen.findByText(/give this loadout a name/i)).toBeInTheDocument();
    expect(shopApi.createLoadout).not.toHaveBeenCalled();
  });

  test('lists saved loadouts with an Apply action', async () => {
    shopApi.applyLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    expect(screen.getByText('Tournament Look')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(shopApi.applyLoadout).toHaveBeenCalledWith('l1'));
  });

  test('deletes a loadout', async () => {
    shopApi.deleteLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(shopApi.deleteLoadout).toHaveBeenCalledWith('l1'));
  });

  test('renames a loadout', async () => {
    shopApi.renameLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByLabelText(/loadout name/i), { target: { value: 'Everyday' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(shopApi.renameLoadout).toHaveBeenCalledWith('l1', 'Everyday'));
  });

  test('hides the "save current look" input once at the loadout cap and shows an explanation', () => {
    mockInventory(baseInventory({
      flairLoadouts: [
        { _id: 'l1', name: 'Look 1', nameColor: null, nameIcon: null, profileBorder: null, title: null },
        { _id: 'l2', name: 'Look 2', nameColor: null, nameIcon: null, profileBorder: null, title: null },
      ],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.queryByLabelText(/save current look as/i)).not.toBeInTheDocument();
    expect(screen.getByText(/maximum for now/i)).toBeInTheDocument();
  });
});
