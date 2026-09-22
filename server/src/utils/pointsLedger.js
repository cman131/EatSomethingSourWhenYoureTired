// Low-level ledger writes shared by pointsService.js (game/tournament/ranked/quiz awards) and
// weeklyStreakService.js (streak awards). Kept separate from pointsService.js so the latter never
// has to require weeklyStreakService.js (or vice versa) just to share this primitive.

const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

const DUPLICATE_KEY_ERROR = 11000;

async function removeLedgerRow(transaction) {
  try {
    await PointTransaction.deleteOne({ _id: transaction._id });
  } catch (cleanupError) {
    console.error(
      `Point ledger drift: transaction ${transaction._id} has no matching balance update`,
      cleanupError
    );
  }
}

// The ledger row is written first; if the balance update then fails the row is removed again,
// so an error leaves the ledger and pointsBalance in agreement.
async function recordAward({ userId, type, amount, metadata = {} }) {
  const transaction = await PointTransaction.create({ user: userId, type, amount, metadata });
  try {
    await User.updateOne(
      { _id: userId },
      { $inc: { pointsBalance: amount, totalPointsEarned: amount } }
    );
  } catch (error) {
    await removeLedgerRow(transaction);
    throw error;
  }
}

// Relies on the unique partial indexes on PointTransaction (per game / per tournament / per league /
// per quiz / per week): a duplicate-key error means this award was already made, so it is skipped.
async function recordAwardOnce(award) {
  try {
    await recordAward(award);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR) {
      throw error;
    }
  }
}

module.exports = { recordAward, recordAwardOnce };
