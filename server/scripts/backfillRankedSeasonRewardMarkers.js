// One-off, run before deploying season-end placement rewards.
// Marks every league except the latest as already rewarded so seasons that ended before the feature existed
// are not paid retroactively. The latest league is left unmarked so it pays out when it ends.
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const RankedLeague = require('../src/models/RankedLeague');

async function backfillRewardMarkers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const latestLeague = await RankedLeague.findOne().sort({ startDate: -1 }).select('_id');
  if (!latestLeague) {
    console.log('No ranked leagues found');
    return;
  }

  const result = await RankedLeague.updateMany(
    { _id: { $ne: latestLeague._id }, rewardsAwardedAt: null },
    { $set: { rewardsAwardedAt: new Date() } }
  );
  console.log(`Marked ${result.modifiedCount} past league(s) as rewarded; left ${latestLeague._id} unmarked`);
}

backfillRewardMarkers()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
