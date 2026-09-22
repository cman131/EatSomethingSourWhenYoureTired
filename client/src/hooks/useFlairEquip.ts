import { useState, useRef, useCallback } from 'react';
import { shopApi, ShopItem, EquippedFlair } from '../services/api';
import { isFlairEquipped } from '../utils/flairUtils';
import { getErrorMessage } from '../utils/apiError';

const EQUIP_FAILED_MESSAGE = 'Failed to equip item. Please try again.';

// Shared equip/unequip mutation, extracted so Shop.tsx and the profile's "My Flair" panel don't
// each duplicate the equip call, its success/error messaging, and its in-flight guard.
export function useFlairEquip(equippedFlair: EquippedFlair, onEquipped: () => void) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isEquipping, setIsEquipping] = useState(false);
  // A ref alongside the state: state drives the disabled UI, but the ref is read synchronously so
  // a second click that lands before a re-render can't slip past the guard.
  const isEquippingRef = useRef(false);

  const equipItem = useCallback(
    async (item: ShopItem) => {
      if (isEquippingRef.current) {
        return;
      }
      isEquippingRef.current = true;
      setIsEquipping(true);
      setActionError(null);
      setActionSuccess(null);
      const isEquipped = isFlairEquipped(equippedFlair, item);
      try {
        await shopApi.equip(isEquipped ? null : item._id, item.category);
        setActionSuccess(isEquipped ? `Unequipped ${item.name}` : `Equipped ${item.name}!`);
        onEquipped();
      } catch (err) {
        setActionError(getErrorMessage(err, EQUIP_FAILED_MESSAGE));
      } finally {
        isEquippingRef.current = false;
        setIsEquipping(false);
      }
    },
    [equippedFlair, onEquipped]
  );

  // Setters are exposed so callers with a second, related action — like Shop.tsx's purchase
  // flow — can share the same message state.
  return { actionError, actionSuccess, isEquipping, equipItem, setActionError, setActionSuccess };
}
