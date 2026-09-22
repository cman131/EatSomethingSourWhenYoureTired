const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');
const { adjustPoints } = require('./pointsService');

const RECONCILE_ADMIN_REASON = 'automated reconciliation: balance/ledger mismatch';

// admin_adjustment rows are excluded from ledgerEarned because adjustPoints deliberately never
// moves totalPointsEarned: that counter reflects points earned through play, not corrections.
async function loadLedgerTotals() {
  const rows = await PointTransaction.aggregate([
    {
      $group: {
        _id: '$user',
        ledgerBalance: { $sum: '$amount' },
        ledgerEarned: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$amount', 0] }, { $ne: ['$type', 'admin_adjustment'] }] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]);
  return new Map(rows.map(row => [row._id.toString(), row]));
}

function findMismatch(user, ledger) {
  const balanceDrift = user.pointsBalance - ledger.ledgerBalance;
  const earnedDrift = user.totalPointsEarned - ledger.ledgerEarned;
  if (balanceDrift === 0 && earnedDrift === 0) {
    return null;
  }

  return {
    userId: user._id,
    pointsBalance: user.pointsBalance,
    ledgerBalance: ledger.ledgerBalance,
    balanceDrift,
    totalPointsEarned: user.totalPointsEarned,
    ledgerEarned: ledger.ledgerEarned,
    earnedDrift,
  };
}

// Pure decision logic, kept separate from the DB scan below so it can be unit tested against
// fabricated input instead of the whole (shared, parallel-test-polluted) User collection.
function findMismatches(users, ledgerTotals) {
  const mismatches = [];
  for (const user of users) {
    const ledger = ledgerTotals.get(user._id.toString()) || { ledgerBalance: 0, ledgerEarned: 0 };
    const mismatch = findMismatch(user, ledger);
    if (mismatch) {
      mismatches.push(mismatch);
    }
  }
  return mismatches;
}

// Corrects pointsBalance back to the ledger sum via a ledgered admin_adjustment rather than
// overwriting the counter directly. earnedDrift is reported but never auto-corrected: there is
// no adjustment type that is allowed to move totalPointsEarned, so it needs manual investigation.
async function fixBalanceDrift(mismatch, adjustedBy) {
  if (mismatch.balanceDrift === 0) {
    return;
  }
  await adjustPoints({
    userId: mismatch.userId,
    amount: -mismatch.balanceDrift,
    adjustedBy,
    reason: RECONCILE_ADMIN_REASON,
  });
}

async function reconcilePoints({ fix = false, adjustedBy = null } = {}) {
  const ledgerTotals = await loadLedgerTotals();
  const users = await User.find({}).select('pointsBalance totalPointsEarned').lean();
  const mismatches = findMismatches(users, ledgerTotals);

  if (fix) {
    for (const mismatch of mismatches) {
      await fixBalanceDrift(mismatch, adjustedBy);
    }
  }

  return { checked: users.length, mismatches };
}

module.exports = { reconcilePoints, findMismatches, fixBalanceDrift, RECONCILE_ADMIN_REASON };
