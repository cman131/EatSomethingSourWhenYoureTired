import { useState, useCallback } from 'react';
import { shopApi, ShopItem, EquippedFlair } from '../services/api';
import { isFlairEquipped } from '../utils/flairUtils';

// Shared equip/unequip mutation, extracted so Shop.tsx and the profile's "My Flair" panel don't
// each duplicate the equip call and its success/error messaging.
export function useFlairEquip(equippedFlair: EquippedFlair, onEquipped: () => void) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const equipItem = useCallback(
    async (item: ShopItem) => {
      setActionError(null);
      setActionSuccess(null);
      const isEquipped = isFlairEquipped(equippedFlair, item);
      try {
        await shopApi.equip(isEquipped ? null : item._id, item.category);
        setActionSuccess(isEquipped ? `Unequipped ${item.name}` : `Equipped ${item.name}!`);
        onEquipped();
      } catch {
        setActionError('Failed to equip item. Please try again.');
      }
    },
    [equippedFlair, onEquipped]
  );

  return { actionError, actionSuccess, equipItem };
}
