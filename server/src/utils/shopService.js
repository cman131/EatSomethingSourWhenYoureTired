const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

const PurchaseFailure = {
  UserNotFound: 'user_not_found',
  AlreadyOwned: 'already_owned',
  InsufficientBalance: 'insufficient_balance',
};

// Debits the cost and grants the item in one conditional update, so concurrent requests
// cannot overspend the balance or buy the same item twice.
async function debitAndGrantItem(userId, item) {
  return User.findOneAndUpdate(
    {
      _id: userId,
      pointsBalance: { $gte: item.cost },
      'purchasedItems.item': { $ne: item._id },
    },
    {
      $inc: { pointsBalance: -item.cost },
      $push: { purchasedItems: { item: item._id } },
    },
    { projection: { _id: 1 } }
  );
}

// Only runs after a guarded update matched nothing, to report which guard failed.
async function diagnosePurchaseFailure(userId, item) {
  const user = await User.findById(userId).select('pointsBalance purchasedItems');
  if (!user) {
    return PurchaseFailure.UserNotFound;
  }
  const alreadyOwns = user.purchasedItems.some(p => p.item.toString() === item._id.toString());
  return alreadyOwns ? PurchaseFailure.AlreadyOwned : PurchaseFailure.InsufficientBalance;
}

// The purchase has already committed by the time this runs, so a failed ledger insert is logged
// rather than reported to the player as a failed purchase.
async function recordPurchaseInLedger(userId, item) {
  try {
    await PointTransaction.create({
      user: userId,
      type: 'shop_purchase',
      amount: -item.cost,
      metadata: { itemId: item._id },
    });
  } catch (err) {
    console.error(`Failed to record shop_purchase ledger row for user ${userId}, item ${item._id}:`, err);
  }
}

async function purchaseItem(userId, item) {
  const updated = await debitAndGrantItem(userId, item);
  if (!updated) {
    return { purchased: false, reason: await diagnosePurchaseFailure(userId, item) };
  }

  await recordPurchaseInLedger(userId, item);
  return { purchased: true };
}

module.exports = {
  purchaseItem,
  PurchaseFailure,
};
