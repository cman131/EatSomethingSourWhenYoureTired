// Compares every user's pointsBalance and totalPointsEarned against their PointTransaction
// ledger and reports drift.
//
//   node scripts/reconcilePoints.js                dry run: report only
//   node scripts/reconcilePoints.js --fix          write a corrective admin_adjustment for each
//                                                   pointsBalance drift found (never overwrites
//                                                   the counters directly)
//
// totalPointsEarned drift is always reported but never auto-fixed: admin_adjustment
// intentionally never moves that counter, since it reflects points earned through play.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { reconcilePoints } = require('../src/utils/pointsReconciliation');

const fix = process.argv.includes('--fix');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${fix ? 'APPLY' : 'dry run'})`);

  const { checked, mismatches } = await reconcilePoints({ fix });

  for (const mismatch of mismatches) {
    console.log(
      `${mismatch.userId}: pointsBalance ${mismatch.pointsBalance} vs ledger ${mismatch.ledgerBalance} `
      + `(drift ${mismatch.balanceDrift}); totalPointsEarned ${mismatch.totalPointsEarned} vs ledger `
      + `${mismatch.ledgerEarned} (drift ${mismatch.earnedDrift})`
    );
  }

  const earnedDriftCount = mismatches.filter(m => m.earnedDrift !== 0).length;
  console.log(`Checked ${checked} user(s): ${mismatches.length} mismatch(es) found`);
  if (fix) {
    console.log('Wrote a corrective admin_adjustment for each pointsBalance drift.');
  } else if (mismatches.length > 0) {
    console.log('Re-run with --fix to correct pointsBalance drift via admin_adjustment.');
  }
  if (earnedDriftCount > 0) {
    console.log(`${earnedDriftCount} user(s) have totalPointsEarned drift that requires manual review.`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
