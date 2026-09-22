import React from 'react';
import { ShopItem } from '../../services/api';
import FlairItemPreview from './FlairItemPreview';

interface PurchaseConfirmDialogProps {
  item: ShopItem;
  pointsBalance: number;
  isPurchasing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const PurchaseConfirmDialog: React.FC<PurchaseConfirmDialogProps> = ({
  item,
  pointsBalance,
  isPurchasing,
  onConfirm,
  onCancel,
}) => (
  <div
    data-testid="purchase-confirm-backdrop"
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={isPurchasing ? undefined : onCancel}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-confirm-title"
      className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
      onClick={e => e.stopPropagation()}
    >
      <h2 id="purchase-confirm-title" className="text-lg font-bold text-gray-900 mb-1">
        Buy this item?
      </h2>
      <p className="text-xs text-gray-500 mb-4">Purchases are permanent and cannot be refunded.</p>

      <div className="mb-4 p-3 border border-gray-200 rounded-md">
        <FlairItemPreview item={item} />
      </div>

      <div className="mb-6 space-y-1 text-sm text-gray-700">
        <p>
          Cost: <span className="font-semibold">{item.cost}</span> points
        </p>
        <p>
          Balance after purchase:{' '}
          <span className="font-semibold">{pointsBalance - item.cost}</span> points
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={isPurchasing}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isPurchasing}
          className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          {isPurchasing ? 'Purchasing…' : 'Confirm purchase'}
        </button>
      </div>
    </div>
  </div>
);

export default PurchaseConfirmDialog;
