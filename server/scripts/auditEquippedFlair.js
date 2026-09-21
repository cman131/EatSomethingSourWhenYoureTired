// One-off audit for User.equippedFlair values that do not match any shop item of that slot's
// category (e.g. a nameColor value sitting in the title slot).
//
//   node scripts/auditEquippedFlair.js           dry run: report only
//   node scripts/auditEquippedFlair.js --apply   clear each invalid slot (set to null)
//
// Inactive shop items still count as valid, since users may keep wearing a retired item.

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ShopItem = require('../src/models/ShopItem');
const User = require('../src/models/User');
const { buildValidValueLookup, findInvalidSlots } = require('../src/utils/equippedFlairAudit');

const apply = process.argv.includes('--apply');

async function auditEquippedFlair() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`);

  const lookup = buildValidValueLookup(await ShopItem.find({}).select('category value').lean());

  let usersChecked = 0;
  let usersAffected = 0;
  let slotsFound = 0;

  const equippedUsers = User.find({
    $or: ['nameColor', 'nameIcon', 'profileBorder', 'title'].map(slot => ({
      [`equippedFlair.${slot}`]: { $nin: [null, ''] },
    })),
  })
    .select('displayName equippedFlair')
    .lean()
    .cursor();

  for await (const user of equippedUsers) {
    usersChecked++;
    const invalid = findInvalidSlots(user.equippedFlair, lookup);
    if (invalid.length === 0) {
      continue;
    }

    usersAffected++;
    slotsFound += invalid.length;
    for (const { slot, value } of invalid) {
      console.log(`${user._id} (${user.displayName}): ${slot} = ${JSON.stringify(value)}`);
    }

    if (apply) {
      const clear = Object.fromEntries(invalid.map(({ slot }) => [`equippedFlair.${slot}`, null]));
      await User.updateOne({ _id: user._id }, { $set: clear });
    }
  }

  console.log(
    `Checked ${usersChecked} user(s) with equipped flair: ${slotsFound} invalid slot(s) on ${usersAffected} user(s)`
  );
  if (slotsFound > 0) {
    console.log(apply ? 'Cleared.' : 'Re-run with --apply to clear them.');
  }
  await mongoose.disconnect();
}

auditEquippedFlair().catch(err => {
  console.error(err);
  process.exit(1);
});
