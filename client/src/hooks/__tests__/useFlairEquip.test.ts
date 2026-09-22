import { renderHook, act, waitFor } from '@testing-library/react';
import { useFlairEquip } from '../useFlairEquip';
import { EquippedFlair, ShopItem } from '../../services/api';

jest.mock('../../services/api', () => ({
  shopApi: { equip: jest.fn() },
}));

const { shopApi } = require('../../services/api');

const noFlair: EquippedFlair = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

const item: ShopItem = {
  _id: 'item1',
  name: 'Jade Green',
  description: '',
  category: 'nameColor',
  cost: 250,
  value: 'text-emerald-600',
  tier: 'mid',
  sortOrder: 1,
  isActive: true,
};

describe('useFlairEquip', () => {
  beforeEach(() => {
    shopApi.equip.mockReset();
  });

  test('equips an unowned-but-unequipped item by id and slot, then calls onEquipped', async () => {
    shopApi.equip.mockResolvedValue({});
    const onEquipped = jest.fn();
    const { result } = renderHook(() => useFlairEquip(noFlair, onEquipped));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor');
    expect(onEquipped).toHaveBeenCalled();
    expect(result.current.actionSuccess).toBe('Equipped Jade Green!');
    expect(result.current.actionError).toBeNull();
  });

  test('unequips an already-equipped item by passing null', async () => {
    shopApi.equip.mockResolvedValue({});
    const equipped: EquippedFlair = { ...noFlair, nameColor: item.value };
    const { result } = renderHook(() => useFlairEquip(equipped, jest.fn()));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor');
    expect(result.current.actionSuccess).toBe('Unequipped Jade Green');
  });

  test('surfaces the server error message when the API call fails', async () => {
    shopApi.equip.mockRejectedValue(new Error('You do not own this item'));
    const onEquipped = jest.fn();
    const { result } = renderHook(() => useFlairEquip(noFlair, onEquipped));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(result.current.actionError).toBe('You do not own this item');
    expect(result.current.actionSuccess).toBeNull();
    expect(onEquipped).not.toHaveBeenCalled();
  });

  test('falls back to a generic message when the equip error has none', async () => {
    shopApi.equip.mockRejectedValue(new Error(''));
    const { result } = renderHook(() => useFlairEquip(noFlair, jest.fn()));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(result.current.actionError).toBe('Failed to equip item. Please try again.');
  });

  test('ignores a second equipItem call while the first is still in flight', async () => {
    let resolveEquip: (() => void) | undefined;
    shopApi.equip.mockReturnValue(new Promise<void>(resolve => { resolveEquip = resolve; }));
    const { result } = renderHook(() => useFlairEquip(noFlair, jest.fn()));

    let firstCall: Promise<void>;
    act(() => {
      firstCall = result.current.equipItem(item);
    });
    expect(result.current.isEquipping).toBe(true);

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(shopApi.equip).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveEquip?.();
      await firstCall;
    });
    expect(result.current.isEquipping).toBe(false);
  });

  test('clears a previous error on a new attempt', async () => {
    shopApi.equip.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useFlairEquip(noFlair, jest.fn()));

    await act(async () => {
      await result.current.equipItem(item);
    });
    expect(result.current.actionError).not.toBeNull();

    shopApi.equip.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(result.current.actionError).toBeNull();
    expect(result.current.actionSuccess).toBe('Equipped Jade Green!');
  });
});
