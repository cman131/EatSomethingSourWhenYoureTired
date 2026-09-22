# Prestige Earn-Only Flair Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tournament winners and ranked-season champions earn a unique, unbuyable prestige title badge; shop items can carry an availability window.

**Architecture:** Earned titles are `ShopItem` rows created at grant time (unique `sourceKey`), owned through the existing `User.purchasedItems` list, so inventory and equip code are unchanged. A new `flairGrantService` creates the item and grants ownership idempotently and is called from tournament completion and the existing season payout. The client recognizes prestige titles by a reserved `🏆 ` value prefix. Tournament creators choose the title text (`winnerTitle`, max 30 chars, auto-filled from the name).

**Tech Stack:** Node/Express + Mongoose 7 + Jest/supertest (server); React 18 + TypeScript strict + Jest/React Testing Library (client).

**Spec:** `docs/superpowers/specs/2026-09-21-prestige-earn-only-items-design.md` (Task 14 aligns it with the decisions below).

**Conventions used in every task**
- Work from the worktree root. Server tests: `cd server && npx jest <path> --runInBand`. Client tests: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false <path>` (plain `npm test -- --watchAll=false` finds 0 tests when the checkout lives under `.claude/worktrees/`; in a normal checkout use `npm test -- --watchAll=false --testPathPattern=<path>`).
- Server tests share one Mongo database. Give every test document a unique `test-…` prefix and delete only those documents.
- Backend code is CommonJS, 2-space indent, braces always, `async`/`await` (no `.then` chains).
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Do not push. Only the initial `InProgress` commit is on the remote.

## Deviations from the spec (decided while reading the code)

1. `purchasedItems[].source` uses `kind` instead of `type` (a schema path named `type` collides with Mongoose's type keyword).
2. The marker/limit helpers live in `server/src/utils/prestigeTitle.js` (not `winnerTitle.js`), since the file also owns the `🏆 ` marker.
3. The prestige badge needs a **print** fallback only. Windows forced-colors already overrides badge colors, and existing badges (chicken, chombo, tsumonami) have neither rule.
4. Earned cards in the shop show the item name (the title text) and a fixed description; there is no separate "source label" line, so the client `PurchasedItem` type is unchanged.
5. Form auto-fill is covered by hook tests (`useWinnerTitle`) plus the TypeScript build, not by full-page render tests of the two large forms.

## File Structure

| File | Responsibility |
|------|----------------|
| `server/src/utils/prestigeTitle.js` (create) | Marker constant, 30-char limit, default/resolved/normalized winner title, prestige value builder. Pure functions. |
| `server/src/utils/flairGrantService.js` (create) | Create the earned `ShopItem` and grant ownership idempotently; tournament and season entry points. |
| `server/src/utils/shopService.js` (modify) | Add `isPurchasable` and `purchasableItemsFilter` (acquisition + window rules). |
| `server/src/models/ShopItem.js`, `User.js`, `Tournament.js` (modify) | New fields. |
| `server/src/routes/shop.js` (modify) | List/purchase/seed honor acquisition and window. |
| `server/src/routes/tournaments.js` (modify) | Grant on completion; accept `winnerTitle` on create/update. |
| `server/src/utils/rankedLeagueService.js`, `pointsService.js` (modify) | Grant during season payout; export `rankQualifiedPlayers`. |
| `client/src/utils/winnerTitle.ts` (create) | `WINNER_TITLE_MAX_LENGTH`, `defaultWinnerTitle`. |
| `client/src/hooks/useWinnerTitle.ts` (create) | Form state that follows the tournament name until edited. |
| `client/src/pages/TournamentSubmission.tsx`, `components/tournaments/EditTournamentModal.tsx`, `pages/TournamentDetail.tsx`, `services/api.ts` (modify) | Winner title input and types. |
| `client/src/utils/flairUtils.ts`, `styles/flair.css` (modify) | Prestige tier, marker match, badge style. |
| `client/src/pages/Shop.tsx` (modify) | "Earned" group. |

---

### Task 1: Prestige title helpers (server)

**Files:**
- Create: `server/src/utils/prestigeTitle.js`
- Test: `server/src/utils/prestigeTitle.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/prestigeTitle.test.js`:

```js
const {
  PRESTIGE_TITLE_MARKER,
  WINNER_TITLE_MAX_LENGTH,
  defaultWinnerTitle,
  resolveWinnerTitle,
  normalizeWinnerTitle,
  prestigeTitleValue,
} = require('./prestigeTitle');

describe('prestige title constants', () => {
  test('the marker and limit match what has shipped to clients', () => {
    expect(PRESTIGE_TITLE_MARKER).toBe('🏆 ');
    expect(WINNER_TITLE_MAX_LENGTH).toBe(30);
  });
});

describe('defaultWinnerTitle', () => {
  test('returns a short name trimmed', () => {
    expect(defaultWinnerTitle('  Spring Open  ')).toBe('Spring Open');
  });

  test('cuts a long name to the limit', () => {
    expect(defaultWinnerTitle('a'.repeat(50))).toBe('a'.repeat(30));
  });

  test('drops trailing whitespace exposed by the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)} bbb`)).toBe('a'.repeat(29));
  });

  test('never splits a surrogate pair at the cut', () => {
    const result = defaultWinnerTitle(`${'a'.repeat(29)}😀`);
    expect(result).toBe('a'.repeat(29));
    expect(result.length).toBeLessThanOrEqual(WINNER_TITLE_MAX_LENGTH);
  });

  test('returns an empty string for a missing name', () => {
    expect(defaultWinnerTitle(undefined)).toBe('');
  });
});

describe('resolveWinnerTitle', () => {
  test('uses the custom title, trimmed', () => {
    expect(resolveWinnerTitle({ name: 'Spring Open', winnerTitle: '  Spring Champ ' })).toBe('Spring Champ');
  });

  test('falls back to the truncated name when the title is blank', () => {
    expect(resolveWinnerTitle({ name: 'Spring Open', winnerTitle: '   ' })).toBe('Spring Open');
  });

  test('falls back to the truncated name when the title is missing', () => {
    expect(resolveWinnerTitle({ name: 'b'.repeat(40) })).toBe('b'.repeat(30));
  });
});

describe('normalizeWinnerTitle', () => {
  test('treats null and undefined as blank', () => {
    expect(normalizeWinnerTitle(undefined)).toEqual({ value: '' });
    expect(normalizeWinnerTitle(null)).toEqual({ value: '' });
  });

  test('trims the value', () => {
    expect(normalizeWinnerTitle('  Champ ')).toEqual({ value: 'Champ' });
  });

  test('accepts exactly the limit', () => {
    expect(normalizeWinnerTitle('a'.repeat(30))).toEqual({ value: 'a'.repeat(30) });
  });

  test('rejects a value over the limit', () => {
    expect(normalizeWinnerTitle('a'.repeat(31))).toEqual({
      error: 'winnerTitle cannot be more than 30 characters',
    });
  });

  test('rejects a non-string value', () => {
    expect(normalizeWinnerTitle(42)).toEqual({ error: 'winnerTitle must be a string' });
  });
});

describe('prestigeTitleValue', () => {
  test('prefixes the label with the marker', () => {
    expect(prestigeTitleValue('Spring Open')).toBe('🏆 Spring Open');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/utils/prestigeTitle.test.js --runInBand`
Expected: FAIL with `Cannot find module './prestigeTitle'`

- [ ] **Step 3: Write minimal implementation**

Create `server/src/utils/prestigeTitle.js`:

```js
// Earned (prestige) titles are recognized by clients from this reserved prefix on the stored
// title value, so it must never change once shipped and no shop item value may start with it.
const PRESTIGE_TITLE_MARKER = '🏆 ';

const WINNER_TITLE_MAX_LENGTH = 30;

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

function defaultWinnerTitle(name) {
  let cut = String(name || '').trim().slice(0, WINNER_TITLE_MAX_LENGTH);
  const lastUnit = cut.charCodeAt(cut.length - 1);
  if (lastUnit >= HIGH_SURROGATE_MIN && lastUnit <= HIGH_SURROGATE_MAX) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd();
}

function resolveWinnerTitle(tournament) {
  const custom = typeof tournament.winnerTitle === 'string' ? tournament.winnerTitle.trim() : '';
  return custom || defaultWinnerTitle(tournament.name);
}

// Validates a winnerTitle taken from a request body. Blank is allowed and means "use the default".
function normalizeWinnerTitle(raw) {
  if (raw === undefined || raw === null) {
    return { value: '' };
  }
  if (typeof raw !== 'string') {
    return { error: 'winnerTitle must be a string' };
  }
  const value = raw.trim();
  if (value.length > WINNER_TITLE_MAX_LENGTH) {
    return { error: `winnerTitle cannot be more than ${WINNER_TITLE_MAX_LENGTH} characters` };
  }
  return { value };
}

function prestigeTitleValue(label) {
  return `${PRESTIGE_TITLE_MARKER}${label}`;
}

module.exports = {
  PRESTIGE_TITLE_MARKER,
  WINNER_TITLE_MAX_LENGTH,
  defaultWinnerTitle,
  resolveWinnerTitle,
  normalizeWinnerTitle,
  prestigeTitleValue,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/utils/prestigeTitle.test.js --runInBand`
Expected: PASS, 15 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/prestigeTitle.js server/src/utils/prestigeTitle.test.js
git commit -m "feat: add prestige title helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Model fields (ShopItem, User, Tournament)

**Files:**
- Modify: `server/src/models/ShopItem.js`
- Modify: `server/src/models/User.js:161-164`
- Modify: `server/src/models/Tournament.js` (add `winnerTitle` after `description`, and the import at the top)
- Test: `server/src/models/ShopItem.test.js`, `server/src/models/User.shopFlair.test.js`, `server/src/models/Tournament.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/models/ShopItem.test.js`:

```js
describe('ShopItem acquisition fields', () => {
  test('defaults to a shop item with no availability window and no sourceKey', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-acq-defaults',
      description: 'Defaults',
      category: 'title',
      cost: 50,
      value: 'test-shop-acq-defaults',
    });

    expect(item.acquisition).toBe('shop');
    expect(item.availableFrom).toBeNull();
    expect(item.availableUntil).toBeNull();
    expect(item.sourceKey).toBeUndefined();
  });

  test('accepts the prestige tier and the earned acquisition type', async () => {
    const item = await ShopItem.create({
      name: 'test-shop-acq-earned',
      description: 'Earned',
      category: 'title',
      cost: 0,
      value: '🏆 test-shop-acq-earned',
      tier: 'prestige',
      acquisition: 'earned',
      sourceKey: 'test-shop-src:earned',
    });

    expect(item.tier).toBe('prestige');
    expect(item.acquisition).toBe('earned');
  });

  test('rejects an unknown acquisition type', async () => {
    await expect(ShopItem.create({
      name: 'test-shop-acq-bad',
      description: 'Bad',
      category: 'title',
      cost: 0,
      value: 'test-shop-acq-bad',
      acquisition: 'gifted',
    })).rejects.toThrow(/acquisition/);
  });

  test('enforces a unique sourceKey but allows many items without one', async () => {
    await ShopItem.init();
    const base = { description: 'Dup', category: 'title', cost: 0, tier: 'prestige', acquisition: 'earned' };
    await ShopItem.create({ ...base, name: 'test-shop-acq-dup-a', value: 'test-shop-acq-dup-a', sourceKey: 'test-shop-src:dup' });

    await expect(ShopItem.create({
      ...base, name: 'test-shop-acq-dup-b', value: 'test-shop-acq-dup-b', sourceKey: 'test-shop-src:dup',
    })).rejects.toMatchObject({ code: 11000 });

    await ShopItem.create({ ...base, name: 'test-shop-acq-none-a', value: 'test-shop-acq-none-a' });
    await ShopItem.create({ ...base, name: 'test-shop-acq-none-b', value: 'test-shop-acq-none-b' });
  });
});
```

Append to `server/src/models/User.shopFlair.test.js`:

```js
describe('purchasedItems source', () => {
  const buildEarnedUser = (name, purchasedItems) => User.create({
    displayName: name,
    email: `${name}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
    purchasedItems,
  });

  test('records the event an item was earned from', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-earned', description: 'Earned', category: 'title', cost: 0, value: '🏆 test-flair-earned',
    });
    const refId = new mongoose.Types.ObjectId();

    const user = await buildEarnedUser('test-flair-source', [
      { item: item._id, source: { kind: 'tournament', refId, label: 'Spring Open' } },
    ]);

    const found = await User.findById(user._id);
    expect(found.purchasedItems[0].source.kind).toBe('tournament');
    expect(found.purchasedItems[0].source.refId.toString()).toBe(refId.toString());
    expect(found.purchasedItems[0].source.label).toBe('Spring Open');
  });

  test('leaves source empty for a purchase', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-bought', description: 'Bought', category: 'title', cost: 50, value: 'test-flair-bought',
    });

    const user = await buildEarnedUser('test-flair-nosource', [{ item: item._id }]);

    const found = await User.findById(user._id);
    expect(found.purchasedItems[0].source.kind).toBeUndefined();
  });

  test('rejects an unknown source kind', async () => {
    const item = await ShopItem.create({
      name: 'test-flair-badkind', description: 'Bad', category: 'title', cost: 0, value: 'test-flair-badkind',
    });

    await expect(buildEarnedUser('test-flair-badkind-user', [
      { item: item._id, source: { kind: 'raffle', refId: new mongoose.Types.ObjectId(), label: 'x' } },
    ])).rejects.toThrow(/kind/);
  });
});
```

Append to `server/src/models/Tournament.test.js`:

```js
describe('Tournament winnerTitle', () => {
  const { WINNER_TITLE_MAX_LENGTH } = require('../utils/prestigeTitle');

  test('is optional and capped at the shared limit', () => {
    const path = Tournament.schema.path('winnerTitle');
    expect(path).toBeDefined();
    expect(path.options.maxlength[0]).toBe(WINNER_TITLE_MAX_LENGTH);
  });

  test('accepts exactly the limit', () => {
    const tournament = new Tournament({ name: 'x', date: new Date(), winnerTitle: 'a'.repeat(WINNER_TITLE_MAX_LENGTH) });
    const error = tournament.validateSync();
    expect(error?.errors.winnerTitle).toBeUndefined();
  });

  test('rejects a title over the limit', () => {
    const tournament = new Tournament({ name: 'x', date: new Date(), winnerTitle: 'a'.repeat(WINNER_TITLE_MAX_LENGTH + 1) });
    const error = tournament.validateSync();
    expect(error?.errors.winnerTitle).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/models/ShopItem.test.js src/models/User.shopFlair.test.js src/models/Tournament.test.js --runInBand`
Expected: FAIL (new fields do not exist; `acquisition`/`source` assertions fail)

- [ ] **Step 3: Implement the schema changes**

Replace `server/src/models/ShopItem.js` with:

```js
const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['nameColor', 'nameIcon', 'profileBorder', 'title'],
    required: true,
  },
  cost: { type: Number, required: true },
  value: { type: String, required: true },
  tier: { type: String, enum: ['entry', 'mid', 'premium', 'prestige'], default: 'entry' },
  // 'earned' items are granted for achievements and are never purchasable.
  acquisition: { type: String, enum: ['shop', 'earned'], default: 'shop' },
  // Purchasable only inside this window; null means unbounded on that side. Owners keep the item.
  availableFrom: { type: Date, default: null },
  availableUntil: { type: Date, default: null },
  // Identifies the event an earned item was created for (e.g. "tournament:<id>"); absent on shop items.
  sourceKey: { type: String, default: undefined },
  previewCss: { type: String, default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

shopItemSchema.index({ sourceKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ShopItem', shopItemSchema);
```

In `server/src/models/User.js`, replace the `purchasedItems` block:

```js
  purchasedItems: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
    purchasedAt: { type: Date, default: Date.now },
    // Only set for earned items: which event granted it.
    source: {
      kind: { type: String, enum: ['tournament', 'ranked_season'] },
      refId: { type: mongoose.Schema.Types.ObjectId },
      label: { type: String },
    },
  }],
```

In `server/src/models/Tournament.js`, add near the top with the other requires:

```js
const { WINNER_TITLE_MAX_LENGTH } = require('../utils/prestigeTitle');
```

and add this field directly after the `description` field of `tournamentSchema`:

```js
  // Text of the prestige title the winner earns. Blank falls back to the truncated name (see prestigeTitle.js).
  winnerTitle: {
    type: String,
    trim: true,
    maxlength: [WINNER_TITLE_MAX_LENGTH, `Winner title cannot be more than ${WINNER_TITLE_MAX_LENGTH} characters`]
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/models/ShopItem.test.js src/models/User.shopFlair.test.js src/models/Tournament.test.js --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/models
git commit -m "feat: add acquisition, availability window, source and winnerTitle fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `grantEarnedTitle` (core, idempotent)

**Files:**
- Create: `server/src/utils/flairGrantService.js`
- Test: `server/src/utils/flairGrantService.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/flairGrantService.test.js`:

```js
const mongoose = require('mongoose');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const PointTransaction = require('../models/PointTransaction');
const { grantEarnedTitle, GRANT_KIND } = require('./flairGrantService');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mahjong-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  await mongoose.connection.close();
});

let player;
let otherPlayer;

const newRefId = () => new mongoose.Types.ObjectId();
const grantSpring = (userId, refId) =>
  grantEarnedTitle(userId, { kind: GRANT_KIND.Tournament, refId, label: 'test-grant Spring Open' });
const itemsFor = refId => ShopItem.find({ sourceKey: `tournament:${refId}` });

async function createPlayer(name) {
  return User.create({
    displayName: name,
    email: `${name}@example.com`,
    password: 'password123',
    clubAffiliation: 'Charleston',
    pointsBalance: 40,
    totalPointsEarned: 40,
  });
}

beforeEach(async () => {
  await ShopItem.init();
  await User.deleteMany({ displayName: /^test-grant/ });
  await ShopItem.deleteMany({ name: /^🏆 test-grant/ });
  player = await createPlayer('test-grant-player');
  otherPlayer = await createPlayer('test-grant-other');
});

describe('grantEarnedTitle', () => {
  test('creates an earned prestige title and grants it to the player', async () => {
    const refId = newRefId();

    const item = await grantSpring(player._id, refId);

    expect(item.name).toBe('🏆 test-grant Spring Open');
    expect(item.value).toBe('🏆 test-grant Spring Open');
    expect(item.category).toBe('title');
    expect(item.tier).toBe('prestige');
    expect(item.acquisition).toBe('earned');
    expect(item.cost).toBe(0);
    expect(item.isActive).toBe(true);
    expect(item.sourceKey).toBe(`tournament:${refId}`);

    const updated = await User.findById(player._id);
    expect(updated.purchasedItems).toHaveLength(1);
    expect(updated.purchasedItems[0].item.toString()).toBe(item._id.toString());
    expect(updated.purchasedItems[0].source.kind).toBe('tournament');
    expect(updated.purchasedItems[0].source.refId.toString()).toBe(refId.toString());
    expect(updated.purchasedItems[0].source.label).toBe('test-grant Spring Open');
  });

  test('granting twice for the same event leaves one item and one entry', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(player._id, refId);

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('concurrent grants for the same event converge on one item and one entry', async () => {
    const refId = newRefId();

    await Promise.all(Array.from({ length: 5 }, () => grantSpring(player._id, refId)));

    expect(await itemsFor(refId)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('two players granted for one event share the single item', async () => {
    const refId = newRefId();

    await grantSpring(player._id, refId);
    await grantSpring(otherPlayer._id, refId);

    const items = await itemsFor(refId);
    expect(items).toHaveLength(1);
    const first = await User.findById(player._id);
    const second = await User.findById(otherPlayer._id);
    expect(first.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
    expect(second.purchasedItems[0].item.toString()).toBe(items[0]._id.toString());
  });

  test('different events give the same player separate items', async () => {
    await grantSpring(player._id, newRefId());
    await grantSpring(player._id, newRefId());

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(2);
  });

  test('does not touch points', async () => {
    await grantSpring(player._id, newRefId());

    const updated = await User.findById(player._id);
    expect(updated.pointsBalance).toBe(40);
    expect(updated.totalPointsEarned).toBe(40);
    expect(await PointTransaction.countDocuments({ user: player._id })).toBe(0);
  });

  test('does not grant to guest users', async () => {
    const guest = await User.create({ displayName: 'test-grant-guest', isGuest: true });

    await grantSpring(guest._id, newRefId());

    expect((await User.findById(guest._id)).purchasedItems).toHaveLength(0);
  });

  test('does not throw for a user that no longer exists', async () => {
    await expect(grantSpring(new mongoose.Types.ObjectId(), newRefId())).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/utils/flairGrantService.test.js --runInBand`
Expected: FAIL with `Cannot find module './flairGrantService'`

- [ ] **Step 3: Write minimal implementation**

Create `server/src/utils/flairGrantService.js`:

```js
const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { prestigeTitleValue } = require('./prestigeTitle');

const GRANT_KIND = {
  Tournament: 'tournament',
  RankedSeason: 'ranked_season',
};

const GRANT_DESCRIPTIONS = {
  [GRANT_KIND.Tournament]: 'Awarded for winning a tournament',
  [GRANT_KIND.RankedSeason]: 'Awarded for winning a ranked season',
};

const DUPLICATE_KEY_ERROR = 11000;

// One earned item per event. The unique sourceKey makes concurrent callers converge on one row: the
// loser of an upsert race gets a duplicate-key error and reads the winner's row instead.
async function upsertEarnedTitleItem(kind, refId, label) {
  const sourceKey = `${kind}:${refId}`;
  const value = prestigeTitleValue(label);
  try {
    return await ShopItem.findOneAndUpdate(
      { sourceKey },
      {
        $setOnInsert: {
          sourceKey,
          name: value,
          value,
          description: GRANT_DESCRIPTIONS[kind],
          category: 'title',
          tier: 'prestige',
          acquisition: 'earned',
          cost: 0,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === DUPLICATE_KEY_ERROR) {
      return ShopItem.findOne({ sourceKey });
    }
    throw err;
  }
}

// The conditional update makes a repeat grant a no-op. Guests have no account to equip from.
function addOwnership(userId, item, source) {
  return User.findOneAndUpdate(
    { _id: userId, isGuest: { $ne: true }, 'purchasedItems.item': { $ne: item._id } },
    { $push: { purchasedItems: { item: item._id, source } } },
    { projection: { _id: 1 } }
  );
}

async function grantEarnedTitle(userId, { kind, refId, label }) {
  const item = await upsertEarnedTitleItem(kind, refId, label);
  await addOwnership(userId, item, { kind, refId, label });
  return item;
}

module.exports = {
  GRANT_KIND,
  grantEarnedTitle,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/utils/flairGrantService.test.js --runInBand`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/flairGrantService.js server/src/utils/flairGrantService.test.js
git commit -m "feat: add idempotent earned title grant service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Tournament and season grant entry points

**Files:**
- Modify: `server/src/utils/pointsService.js` (export `rankQualifiedPlayers`)
- Modify: `server/src/utils/flairGrantService.js`
- Modify: `server/src/utils/flairGrantService.test.js`

- [ ] **Step 1: Write the failing tests**

Update the import line in `server/src/utils/flairGrantService.test.js`:

```js
const {
  grantEarnedTitle,
  grantTournamentChampionTitle,
  grantSeasonChampionTitles,
  GRANT_KIND,
} = require('./flairGrantService');
```

Append to the same file:

```js
describe('grantTournamentChampionTitle', () => {
  const makeTournament = (overrides = {}) => ({
    _id: newRefId(),
    name: 'test-grant Spring Open 2026',
    players: [
      { player: player._id, dropped: false },
      { player: otherPlayer._id, dropped: false },
    ],
    top4: [player._id, otherPlayer._id],
    ...overrides,
  });

  test('grants the winner a title built from winnerTitle', async () => {
    const tournament = makeTournament({ winnerTitle: 'test-grant Champ' });

    await grantTournamentChampionTitle(tournament);

    const updated = await User.findById(player._id).populate('purchasedItems.item');
    expect(updated.purchasedItems).toHaveLength(1);
    expect(updated.purchasedItems[0].item.value).toBe('🏆 test-grant Champ');
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
  });

  test('falls back to the truncated tournament name when winnerTitle is blank', async () => {
    const tournament = makeTournament({ name: 'test-grant Spring Open 2026' });

    await grantTournamentChampionTitle(tournament);

    const updated = await User.findById(player._id).populate('purchasedItems.item');
    expect(updated.purchasedItems[0].item.value).toBe('🏆 test-grant Spring Open 2026');
  });

  test('accepts a top4 entry that is a populated user document', async () => {
    const tournament = makeTournament({ top4: [player, otherPlayer] });

    await grantTournamentChampionTitle(tournament);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });

  test('skips a winner who dropped', async () => {
    const tournament = makeTournament({
      players: [
        { player: player._id, dropped: true },
        { player: otherPlayer._id, dropped: false },
      ],
    });

    await grantTournamentChampionTitle(tournament);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(0);
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
  });

  test('does nothing when the tournament has no top4', async () => {
    await expect(grantTournamentChampionTitle(makeTournament({ top4: [] }))).resolves.toBeUndefined();
  });

  test('replaying completion grants nothing new', async () => {
    const tournament = makeTournament({ winnerTitle: 'test-grant Champ' });

    await grantTournamentChampionTitle(tournament);
    await grantTournamentChampionTitle(tournament);

    expect(await itemsFor(tournament._id)).toHaveLength(1);
    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
  });
});

describe('grantSeasonChampionTitles', () => {
  let third;

  const makeLeague = standings => ({
    _id: newRefId(),
    startDate: new Date(Date.UTC(2026, 0, 15)),
    players: standings,
  });

  beforeEach(async () => {
    third = await createPlayer('test-grant-third');
  });

  test('grants only the top qualified player, labelled by season start', async () => {
    const league = makeLeague([
      { player: player._id, rankedPoints: 560, gamesPlayed: 5 },
      { player: otherPlayer._id, rankedPoints: 530, gamesPlayed: 4 },
      { player: third._id, rankedPoints: 900, gamesPlayed: 2 },
    ]);

    await grantSeasonChampionTitles(league);

    const champion = await User.findById(player._id).populate('purchasedItems.item');
    expect(champion.purchasedItems).toHaveLength(1);
    expect(champion.purchasedItems[0].item.value).toBe('🏆 Season Champion: Jan 2026');
    expect(champion.purchasedItems[0].source.kind).toBe('ranked_season');
    expect((await User.findById(otherPlayer._id)).purchasedItems).toHaveLength(0);
    expect((await User.findById(third._id)).purchasedItems).toHaveLength(0);
  });

  test('grants every player tied for first', async () => {
    const league = makeLeague([
      { player: player._id, rankedPoints: 560, gamesPlayed: 5 },
      { player: otherPlayer._id, rankedPoints: 560, gamesPlayed: 4 },
      { player: third._id, rankedPoints: 510, gamesPlayed: 3 },
    ]);

    await grantSeasonChampionTitles(league);

    const first = await User.findById(player._id);
    const second = await User.findById(otherPlayer._id);
    expect(first.purchasedItems).toHaveLength(1);
    expect(second.purchasedItems).toHaveLength(1);
    expect(first.purchasedItems[0].item.toString()).toBe(second.purchasedItems[0].item.toString());
    expect((await User.findById(third._id)).purchasedItems).toHaveLength(0);
  });

  test('does nothing when nobody qualified', async () => {
    const league = makeLeague([{ player: player._id, rankedPoints: 600, gamesPlayed: 2 }]);

    await grantSeasonChampionTitles(league);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(0);
  });

  test('replaying the payout grants nothing new', async () => {
    const league = makeLeague([{ player: player._id, rankedPoints: 560, gamesPlayed: 5 }]);

    await grantSeasonChampionTitles(league);
    await grantSeasonChampionTitles(league);

    expect((await User.findById(player._id)).purchasedItems).toHaveLength(1);
    expect(await ShopItem.countDocuments({ sourceKey: `ranked_season:${league._id}` })).toBe(1);
  });
});
```

Note: the season describe creates a league whose value is `🏆 Season Champion: Jan 2026`, which does not start with `🏆 test-grant`, so add `await ShopItem.deleteMany({ sourceKey: /^ranked_season:/ });` to the top-level `beforeEach` and to `afterAll` of this test file (the season tests use fresh random ids, so this only removes rows created by this file's runs).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/utils/flairGrantService.test.js --runInBand`
Expected: FAIL — `grantTournamentChampionTitle is not a function`

- [ ] **Step 3: Implement**

In `server/src/utils/pointsService.js`, add `rankQualifiedPlayers` to `module.exports`:

```js
module.exports = {
  awardPoints,
  spendPoints,
  awardGamePoints,
  awardTournamentPoints,
  awardRankedQualificationPoints,
  awardRankedSeasonPlacementPoints,
  rankQualifiedPlayers,
};
```

In `server/src/utils/flairGrantService.js`, add the imports after the existing requires:

```js
const { resolveWinnerTitle } = require('./prestigeTitle');
const { rankQualifiedPlayers } = require('./pointsService');
```

(replace the existing `const { prestigeTitleValue } = require('./prestigeTitle');` with `const { prestigeTitleValue, resolveWinnerTitle } = require('./prestigeTitle');` so `prestigeTitle` is required once), and add these functions above `module.exports`:

```js
// top4 holds user ids in production but may hold populated users; the points code treats both alike.
function idOf(entry) {
  return entry._id || entry;
}

async function grantTournamentChampionTitle(tournament) {
  const winner = Array.isArray(tournament.top4) ? tournament.top4[0] : undefined;
  if (!winner) {
    return;
  }

  const winnerId = idOf(winner);
  const entry = tournament.players.find(p => p.player.toString() === winnerId.toString());
  if (entry && entry.dropped) {
    return;
  }

  await grantEarnedTitle(winnerId, {
    kind: GRANT_KIND.Tournament,
    refId: tournament._id,
    label: resolveWinnerTitle(tournament),
  });
}

function seasonChampionLabel(league) {
  const month = league.startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `Season Champion: ${month} ${league.startDate.getUTCFullYear()}`;
}

// Ties share placement 1, so every tied player is a champion.
async function grantSeasonChampionTitles(league) {
  const champions = rankQualifiedPlayers(league).filter(({ placement }) => placement === 1);
  const label = seasonChampionLabel(league);

  for (const { playerId } of champions) {
    await grantEarnedTitle(playerId, { kind: GRANT_KIND.RankedSeason, refId: league._id, label });
  }
}
```

and extend the exports:

```js
module.exports = {
  GRANT_KIND,
  grantEarnedTitle,
  grantTournamentChampionTitle,
  grantSeasonChampionTitles,
};
```

- [ ] **Step 3b: Confirm there is no require cycle**

Run: `cd server && node -e "require('./src/utils/flairGrantService'); require('./src/utils/rankedLeagueService'); console.log('ok')"`
Expected: prints `ok` (`flairGrantService` → `pointsService` → `rankedLeagueConstants`; nothing requires back).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/utils/flairGrantService.test.js --runInBand`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils
git commit -m "feat: grant champion titles for tournaments and ranked seasons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Grant on tournament completion

**Files:**
- Modify: `server/src/routes/tournaments.js:12` (import) and `:1285-1291` (completion block)
- Test: `server/src/routes/__tests__/tournaments.endRound.test.js`

All four completion paths (`tournaments.js:1208, 1221, 1275, 1278`) set `status = 'Completed'` and then reach the single `if (tournament.status === 'Completed')` block that awards points, so one call site is enough.

- [ ] **Step 1: Write the failing tests**

In `server/src/routes/__tests__/tournaments.endRound.test.js`, add this mock directly after the existing `pointsService` mock:

```js
jest.mock('../../utils/flairGrantService', () => ({
  grantTournamentChampionTitle: jest.fn().mockResolvedValue(undefined)
}));
```

add this import after the existing `awardTournamentPoints` require:

```js
const { grantTournamentChampionTitle } = require('../../utils/flairGrantService');
```

and append these tests inside the `describe('PUT /tournaments/:id/rounds/:roundNumber/end — tournament points', ...)` block, before its closing `});`:

```js
  test('grants the champion title once when the tournament completes', async () => {
    const tournament = makeMockTournament();
    Tournament.findById.mockResolvedValue(tournament);

    const res = await endRound();

    expect(res.status).toBe(200);
    expect(grantTournamentChampionTitle).toHaveBeenCalledTimes(1);
    expect(grantTournamentChampionTitle).toHaveBeenCalledWith(tournament);
  });

  test('still completes the round when the title grant fails', async () => {
    const tournament = makeMockTournament();
    Tournament.findById.mockResolvedValue(tournament);
    grantTournamentChampionTitle.mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await endRound();

    expect(res.status).toBe(200);
    expect(tournament.status).toBe('Completed');
    errorSpy.mockRestore();
  });

  test('grants no title when the tournament was already completed', async () => {
    Tournament.findById.mockResolvedValue(makeMockTournament({ status: 'Completed' }));

    await endRound();

    expect(grantTournamentChampionTitle).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/routes/__tests__/tournaments.endRound.test.js --runInBand`
Expected: FAIL — `grantTournamentChampionTitle` called 0 times (expected 1)

- [ ] **Step 3: Implement**

In `server/src/routes/tournaments.js`, add after the `awardTournamentPoints` require (line 12):

```js
const { grantTournamentChampionTitle } = require('../utils/flairGrantService');
```

and replace the completion block:

```js
    if (tournament.status === 'Completed') {
      try {
        await awardTournamentPoints(tournament);
      } catch (err) {
        console.error('Failed to award tournament points:', err);
      }
    }
```

with:

```js
    if (tournament.status === 'Completed') {
      try {
        await awardTournamentPoints(tournament);
      } catch (err) {
        console.error('Failed to award tournament points:', err);
      }

      try {
        await grantTournamentChampionTitle(tournament);
      } catch (err) {
        console.error('Failed to grant tournament champion title:', err);
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/routes/__tests__ --runInBand`
Expected: PASS (all tournament route tests, including the three new ones)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.endRound.test.js
git commit -m "feat: grant winner title when a tournament completes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Grant during the ranked season payout

**Files:**
- Modify: `server/src/utils/rankedLeagueService.js:1-3` and `payEndedSeason`
- Test: `server/src/utils/rankedLeagueService.test.js`

- [ ] **Step 1: Write the failing tests**

In `server/src/utils/rankedLeagueService.test.js`, add to the imports at the top:

```js
const ShopItem = require('../models/ShopItem');
```

Inside `describe('ranked season-end placement rewards', ...)`, add to its `beforeEach` (after the `RankedLeague.deleteMany({})` line):

```js
    await ShopItem.deleteMany({ sourceKey: /^ranked_season:/ });
```

and append these tests before that describe's closing `});`:

```js
  const seasonTitleItems = async player => {
    const found = await User.findById(player._id).populate('purchasedItems.item');
    return found.purchasedItems.filter(p => p.source && p.source.kind === 'ranked_season');
  };

  test('grants the champion title to the top qualified player when the season is paid', async () => {
    const ended = await createExpiredLeague();

    await getCurrentLeague();

    const champion = await seasonTitleItems(players[0]);
    expect(champion).toHaveLength(1);
    expect(champion[0].item.acquisition).toBe('earned');
    expect(champion[0].item.sourceKey).toBe(`ranked_season:${ended._id}`);
    expect(await seasonTitleItems(players[1])).toHaveLength(0);
    // players[3] has the most points but is unqualified
    expect(await seasonTitleItems(players[3])).toHaveLength(0);
  });

  test('a retry after a failed grant pays points once and grants the title once', async () => {
    const ended = await createExpiredLeague();
    const grantSpy = jest.spyOn(ShopItem, 'findOneAndUpdate').mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await getCurrentLeague();

    expect((await RankedLeague.findById(ended._id)).rewardsAwardedAt).toBeNull();
    grantSpy.mockRestore();
    errorSpy.mockRestore();

    await getCurrentLeague();

    expect(await seasonTitleItems(players[0])).toHaveLength(1);
    expect(await balanceOf(players[0])).toBe(150);
    expect((await RankedLeague.findById(ended._id)).rewardsAwardedAt).toBeInstanceOf(Date);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/utils/rankedLeagueService.test.js --runInBand`
Expected: FAIL — the champion has 0 season titles (expected 1)

- [ ] **Step 3: Implement**

In `server/src/utils/rankedLeagueService.js`, add after the `pointsService` require:

```js
const { grantSeasonChampionTitles } = require('./flairGrantService');
```

and in `payEndedSeason`, replace the `try` body:

```js
  try {
    await awardRankedSeasonPlacementPoints(claimedLeague);
  } catch (err) {
```

with:

```js
  try {
    await awardRankedSeasonPlacementPoints(claimedLeague);
    await grantSeasonChampionTitles(claimedLeague);
  } catch (err) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/utils/rankedLeagueService.test.js src/routes/rankedLeagues.test.js --runInBand`
Expected: PASS (existing season tests plus the two new ones)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/rankedLeagueService.js server/src/utils/rankedLeagueService.test.js
git commit -m "feat: grant season champion title during the season payout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `winnerTitle` on tournament create and update

**Files:**
- Modify: `server/src/routes/tournaments.js` (imports, `POST /` at `:592`, `PUT /:id` at `:723`)
- Create: `server/src/routes/__tests__/tournaments.winnerTitle.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/src/routes/__tests__/tournaments.winnerTitle.test.js`:

```js
const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { _id: 'adminUserId123456789012', isAdmin: true };
    next();
  }
}));

jest.mock('../../middleware/validation', () => ({
  validateMongoId: () => (req, res, next) => next(),
  validateGameCreation: () => (req, res, next) => next()
}));

jest.mock('../../models/Tournament', () => {
  const Tournament = jest.fn();
  Tournament.findById = jest.fn();
  return Tournament;
});

jest.mock('../../models/User', () => ({
  findById: jest.fn(),
  PLAYER_POPULATE_FIELDS: 'displayName avatar'
}));

jest.mock('../../models/Game');
jest.mock('../../utils/roundGenerationService', () => ({ generateRoundPairings: jest.fn(), getFinalsMatchCount: jest.fn() }));
jest.mock('../../utils/gameService', () => ({ createGame: jest.fn() }));
jest.mock('../../utils/emailService', () => ({
  sendRoundPairingNotificationEmail: jest.fn(),
  sendNewTournamentNotificationEmail: jest.fn(),
  sendWaitlistPromotionNotificationEmail: jest.fn(),
  sendTournamentUpdateNotificationEmail: jest.fn()
}));
jest.mock('../../utils/pointsService', () => ({ awardTournamentPoints: jest.fn() }));
jest.mock('../../utils/flairGrantService', () => ({ grantTournamentChampionTitle: jest.fn() }));

const Tournament = require('../../models/Tournament');
const router = require('../tournaments');

const app = express();
app.use(express.json());
app.use('/tournaments', router);

const TOURNAMENT_ID = '507f1f77bcf86cd799439011';

// Under 7 days away, so the create route does not fan out new-tournament notification emails.
const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

const onlineTournamentBody = extra => ({
  name: 'Spring Open',
  date: soon,
  isOnline: true,
  onlineLocation: 'https://example.com/room',
  ...extra
});

function makeStoredTournament(overrides = {}) {
  return {
    _id: TOURNAMENT_ID,
    name: 'Spring Open',
    status: 'NotStarted',
    winnerTitle: undefined,
    date: new Date('2027-05-01T00:00:00.000Z'),
    isOnline: true,
    rounds: [],
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('POST /tournaments — winnerTitle', () => {
  let created;

  beforeEach(() => {
    jest.clearAllMocks();
    Tournament.mockImplementation(data => {
      created = { ...data, _id: TOURNAMENT_ID, save: jest.fn().mockResolvedValue(undefined), populate: jest.fn().mockResolvedValue(undefined), status: 'NotStarted', rounds: [] };
      return created;
    });
  });

  test('stores a trimmed winnerTitle', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: '  Spring Champ  ' }));

    expect(res.status).toBe(201);
    expect(created.winnerTitle).toBe('Spring Champ');
  });

  test('omits winnerTitle when blank so the name default applies', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: '   ' }));

    expect(res.status).toBe(201);
    expect(created).not.toHaveProperty('winnerTitle');
  });

  test('rejects a winnerTitle over 30 characters', async () => {
    const res = await request(app).post('/tournaments').send(onlineTournamentBody({ winnerTitle: 'a'.repeat(31) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be more than 30 characters');
    expect(Tournament).not.toHaveBeenCalled();
  });
});

describe('PUT /tournaments/:id — winnerTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const put = body => request(app).put(`/tournaments/${TOURNAMENT_ID}`).send(body);

  test('updates the winnerTitle before the tournament completes', async () => {
    const stored = makeStoredTournament();
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: ' Spring Champ ' });

    expect(res.status).toBe(200);
    expect(stored.winnerTitle).toBe('Spring Champ');
    expect(stored.save).toHaveBeenCalled();
  });

  test('clears the winnerTitle when blank', async () => {
    const stored = makeStoredTournament({ winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: '' });

    expect(res.status).toBe(200);
    expect(stored.winnerTitle).toBeUndefined();
  });

  test('rejects a winnerTitle over 30 characters', async () => {
    Tournament.findById.mockResolvedValue(makeStoredTournament());

    const res = await put({ winnerTitle: 'a'.repeat(31) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be more than 30 characters');
  });

  test('rejects changing the winnerTitle once the tournament is completed', async () => {
    const stored = makeStoredTournament({ status: 'Completed', winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ winnerTitle: 'New' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('winnerTitle cannot be changed after the tournament is completed');
    expect(stored.winnerTitle).toBe('Old');
    expect(stored.save).not.toHaveBeenCalled();
  });

  test('allows resending the unchanged winnerTitle on a completed tournament', async () => {
    const stored = makeStoredTournament({ status: 'Completed', winnerTitle: 'Old' });
    Tournament.findById.mockResolvedValue(stored);

    const res = await put({ description: 'Updated', winnerTitle: 'Old' });

    expect(res.status).toBe(200);
    expect(stored.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/routes/__tests__/tournaments.winnerTitle.test.js --runInBand`
Expected: FAIL — `winnerTitle` is not stored and the over-limit requests return 201/200

- [ ] **Step 3: Implement**

In `server/src/routes/tournaments.js`, add after the `flairGrantService` require:

```js
const { normalizeWinnerTitle } = require('../utils/prestigeTitle');
```

In `POST /` (`router.post('/', …)`), add `winnerTitle` to the destructured body:

```js
    const { name, description, date, location, onlineLocation, isOnline, modifications, ruleset, maxPlayers, roundDurationMinutes, startingPointValue, roundStrategy, winnerTitle } = req.body;
```

and, immediately after the `if (!name || !date) { … }` check, add:

```js
    const winnerTitleResult = normalizeWinnerTitle(winnerTitle);
    if (winnerTitleResult.error) {
      return res.status(400).json({
        success: false,
        message: winnerTitleResult.error
      });
    }
```

Then, right after the `tournamentData` object literal is closed (before `// Add maxPlayers if provided`), add:

```js
    if (winnerTitleResult.value) {
      tournamentData.winnerTitle = winnerTitleResult.value;
    }
```

In `PUT /:id`, add `winnerTitle` to the destructured body:

```js
    const { name, description, date, location, onlineLocation, isOnline, modifications, ruleset, maxPlayers, roundDurationMinutes, startingPointValue, roundStrategy, notifyParticipants, winnerTitle } = req.body;
```

and add this block directly before `if (roundStrategy !== undefined) {` inside the PUT handler:

```js
    if (winnerTitle !== undefined) {
      const winnerTitleResult = normalizeWinnerTitle(winnerTitle);
      if (winnerTitleResult.error) {
        return res.status(400).json({
          success: false,
          message: winnerTitleResult.error
        });
      }
      const changed = winnerTitleResult.value !== (tournament.winnerTitle || '');
      if (changed && tournament.status === 'Completed') {
        return res.status(400).json({
          success: false,
          message: 'winnerTitle cannot be changed after the tournament is completed'
        });
      }
      tournament.winnerTitle = winnerTitleResult.value || undefined;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/routes/__tests__ --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/tournaments.js server/src/routes/__tests__/tournaments.winnerTitle.test.js
git commit -m "feat: accept and validate winnerTitle on tournament create and update

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Shop honors acquisition and availability window

**Files:**
- Modify: `server/src/utils/shopService.js`
- Modify: `server/src/routes/shop.js` (`GET /`, `POST /purchase`, `POST /seed`)
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/shop.test.js`:

```js
describe('earned items and availability windows', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const inDays = days => new Date(Date.now() + days * DAY_MS);

  const createItem = (suffix, overrides = {}) => ShopItem.create({
    name: `test-shop-route-${suffix}`,
    description: suffix,
    category: 'title',
    cost: 100,
    value: `test-shop-route-${suffix}`,
    ...overrides,
  });

  const listedNames = async () => {
    const res = await request(app).get('/api/shop');
    return (res.body.data.title || []).map(i => i.name);
  };

  test('GET /api/shop hides earned items', async () => {
    await createItem('earned', { acquisition: 'earned', tier: 'prestige', cost: 0 });
    await createItem('bought');

    const names = await listedNames();

    expect(names).toContain('test-shop-route-bought');
    expect(names).not.toContain('test-shop-route-earned');
  });

  test('GET /api/shop lists an item inside its window', async () => {
    await createItem('open', { availableFrom: inDays(-1), availableUntil: inDays(1) });

    expect(await listedNames()).toContain('test-shop-route-open');
  });

  test('GET /api/shop hides an expired item', async () => {
    await createItem('expired', { availableFrom: inDays(-10), availableUntil: inDays(-1) });

    expect(await listedNames()).not.toContain('test-shop-route-expired');
  });

  test('GET /api/shop hides an item that has not opened yet', async () => {
    await createItem('future', { availableFrom: inDays(1) });

    expect(await listedNames()).not.toContain('test-shop-route-future');
  });

  test('POST /purchase rejects an earned item and does not charge', async () => {
    const earned = await createItem('earned-buy', { acquisition: 'earned', tier: 'prestige', cost: 0 });

    const res = await request(app).post('/api/shop/purchase').send({ itemId: earned._id.toString() });

    expect(res.status).toBe(404);
    expect((await User.findById(user._id)).purchasedItems).toHaveLength(0);
  });

  test('POST /purchase rejects an expired item and does not charge', async () => {
    const expired = await createItem('expired-buy', { availableUntil: inDays(-1) });

    const res = await request(app).post('/api/shop/purchase').send({ itemId: expired._id.toString() });

    expect(res.status).toBe(404);
    const unchanged = await User.findById(user._id);
    expect(unchanged.pointsBalance).toBe(500);
    expect(unchanged.purchasedItems).toHaveLength(0);
  });

  test('an owner keeps an expired item in inventory and can equip it', async () => {
    const expired = await createItem('expired-owned', { availableUntil: inDays(-1) });
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: expired._id } } });

    const inventory = await request(app).get('/api/shop/inventory');
    const equip = await request(app).post('/api/shop/equip').send({ itemId: expired._id.toString(), slot: 'title' });

    expect(inventory.body.data.purchasedItems.map(p => p.item.name)).toContain('test-shop-route-expired-owned');
    expect(equip.status).toBe(200);
    expect((await User.findById(user._id)).equippedFlair.title).toBe('test-shop-route-expired-owned');
  });
});

describe('POST /api/shop/seed and earned items', () => {
  const seedAsAdmin = async () => {
    expect(mongoose.connection.name).toMatch(/test/);
    return request(buildTestApp({ _id: user._id, isAdmin: true })).post('/api/shop/seed');
  };

  afterAll(async () => {
    if (/test/.test(mongoose.connection.name)) {
      await ShopItem.deleteMany({ name: { $in: SHOP_CATALOG.map(i => i.name) } });
    }
  });

  test('leaves earned items active', async () => {
    const earned = await ShopItem.create({
      name: 'test-shop-route-seed-earned',
      description: 'Earned',
      category: 'title',
      cost: 0,
      value: '🏆 test-shop-route-seed-earned',
      tier: 'prestige',
      acquisition: 'earned',
    });

    const res = await seedAsAdmin();

    expect(res.status).toBe(200);
    expect((await ShopItem.findById(earned._id)).isActive).toBe(true);
  });

  test('still deactivates shop items that are not in the catalog, including legacy rows without acquisition', async () => {
    await ShopItem.collection.insertOne({
      name: 'test-shop-route-legacy',
      description: 'Legacy row',
      category: 'title',
      cost: 100,
      value: 'test-shop-route-legacy',
      tier: 'entry',
      isActive: true,
    });

    await seedAsAdmin();

    expect((await ShopItem.findOne({ name: 'test-shop-route-legacy' })).isActive).toBe(false);
  });

  test('seeded catalog items are shop items with no window', async () => {
    await seedAsAdmin();

    const jade = await ShopItem.findOne({ name: 'Jade Green' });
    expect(jade.acquisition).toBe('shop');
    expect(jade.availableFrom).toBeNull();
    expect(jade.availableUntil).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/routes/shop.test.js --runInBand`
Expected: FAIL — earned/expired/future items are listed and purchasable; the seed deactivates the earned item

- [ ] **Step 3: Implement**

In `server/src/utils/shopService.js`, add above `async function purchaseItem`:

```js
function isWithinWindow(item, now) {
  const opened = !item.availableFrom || item.availableFrom <= now;
  const notClosed = !item.availableUntil || item.availableUntil > now;
  return opened && notClosed;
}

// Earned items are never sold. Legacy rows have no acquisition field and count as shop items.
function isPurchasable(item, now = new Date()) {
  return item.isActive && item.acquisition !== 'earned' && isWithinWindow(item, now);
}

// Query form of isPurchasable, so the shop list and the purchase route cannot disagree.
function purchasableItemsFilter(now = new Date()) {
  return {
    isActive: true,
    acquisition: { $ne: 'earned' },
    $and: [
      { $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] },
      { $or: [{ availableUntil: null }, { availableUntil: { $gt: now } }] },
    ],
  };
}
```

and extend its exports:

```js
module.exports = {
  purchaseItem,
  isPurchasable,
  purchasableItemsFilter,
  PurchaseFailure,
};
```

In `server/src/routes/shop.js`, change the import:

```js
const { purchaseItem, isPurchasable, purchasableItemsFilter, PurchaseFailure } = require('../utils/shopService');
```

In `GET /`, replace `ShopItem.find({ isActive: true })` with `ShopItem.find(purchasableItemsFilter())` and update the comment above the route to `// GET /api/shop — list purchasable items (active, not earned, inside their window) grouped by category`.

In `POST /purchase`, replace `if (!item || !item.isActive) {` with `if (!item || !isPurchasable(item)) {`.

In `POST /seed`, replace the deactivation and upsert calls (`updateMany(...)` and the `Promise.all(SHOP_CATALOG.map(...))`) with:

```js
    // Deactivate shop items no longer in the catalog. Earned items are created at grant time and
    // are never part of the catalog, so they are left alone.
    await ShopItem.updateMany(
      { name: { $nin: catalogNames }, acquisition: { $ne: 'earned' } },
      { $set: { isActive: false } }
    );

    const results = await Promise.all(
      SHOP_CATALOG.map(({ name, category, cost, tier, description, value, sortOrder, availableFrom, availableUntil }) =>
        ShopItem.findOneAndUpdate(
          { name, acquisition: { $ne: 'earned' } },
          {
            $set: {
              cost,
              tier,
              description,
              value,
              sortOrder,
              isActive: true,
              availableFrom: availableFrom ?? null,
              availableUntil: availableUntil ?? null,
            },
            $setOnInsert: { name, category, acquisition: 'shop' },
          },
          { upsert: true, new: true }
        )
      )
    );
```

(Keep the existing comment `// Deactivate items no longer in the catalog` removed since the new comment replaces it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/routes/shop.test.js --runInBand`
Expected: PASS (existing shop tests plus the new ones)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/shopService.js server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat: hide earned and out-of-window items from the shop and reject buying them

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Catalog guard tests (server)

**Files:**
- Modify: `server/src/data/shopCatalog.test.js`

The catalog itself does not change; these tests stop it drifting into conflict with earned items.

- [ ] **Step 1: Write the tests**

Add to the top of `server/src/data/shopCatalog.test.js`, after the existing `require` line:

```js
const { PRESTIGE_TITLE_MARKER } = require('../utils/prestigeTitle');
```

and add these tests inside `describe('SHOP_CATALOG', …)` before its closing `});`:

```js
  test('no catalog name or value can be mistaken for an earned prestige title', () => {
    for (const item of SHOP_CATALOG) {
      expect(item.name.startsWith(PRESTIGE_TITLE_MARKER)).toBe(false);
      expect(item.value.startsWith(PRESTIGE_TITLE_MARKER)).toBe(false);
    }
  });

  test('the catalog contains only purchasable shop items', () => {
    for (const item of SHOP_CATALOG) {
      expect(item.tier).not.toBe('prestige');
      expect(item.acquisition === undefined || item.acquisition === 'shop').toBe(true);
    }
  });

  test('an availability window opens before it closes', () => {
    for (const item of SHOP_CATALOG) {
      if (item.availableFrom && item.availableUntil) {
        expect(new Date(item.availableFrom).getTime()).toBeLessThan(new Date(item.availableUntil).getTime());
      }
    }
  });
```

- [ ] **Step 2: Run tests**

Run: `cd server && npx jest src/data/shopCatalog.test.js --runInBand`
Expected: PASS (the catalog satisfies all three today; they are guards for future edits)

- [ ] **Step 3: Prove a guard bites**

Temporarily change one catalog `value` to `'🏆 Regular'`, rerun the command, confirm the first new test FAILS, then revert with `git checkout server/src/data/shopCatalog.js`.

- [ ] **Step 4: Commit**

```bash
git add server/src/data/shopCatalog.test.js
git commit -m "test: guard the shop catalog against prestige-title collisions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Client winner-title helper and form hook

**Files:**
- Create: `client/src/utils/winnerTitle.ts`
- Create: `client/src/hooks/useWinnerTitle.ts`
- Test: `client/src/utils/__tests__/winnerTitle.test.ts`, `client/src/hooks/__tests__/useWinnerTitle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/__tests__/winnerTitle.test.ts`:

```ts
import { WINNER_TITLE_MAX_LENGTH, defaultWinnerTitle } from '../winnerTitle';

// Reads the server helper directly so the two packages cannot drift apart.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('../../../../server/src/utils/prestigeTitle');

describe('defaultWinnerTitle', () => {
  test('trims a short name', () => {
    expect(defaultWinnerTitle('  Spring Open  ')).toBe('Spring Open');
  });

  test('cuts a long name to the limit', () => {
    expect(defaultWinnerTitle('a'.repeat(50))).toBe('a'.repeat(30));
  });

  test('drops trailing whitespace exposed by the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)} bbb`)).toBe('a'.repeat(29));
  });

  test('never splits a surrogate pair at the cut', () => {
    expect(defaultWinnerTitle(`${'a'.repeat(29)}😀`)).toBe('a'.repeat(29));
  });
});

describe('parity with the server helper', () => {
  test('uses the same limit', () => {
    expect(WINNER_TITLE_MAX_LENGTH).toBe(server.WINNER_TITLE_MAX_LENGTH);
  });

  test.each([
    'Spring Open',
    '  padded  ',
    'x'.repeat(45),
    `${'y'.repeat(29)} tail`,
    `${'z'.repeat(29)}😀`,
    '',
  ])('gives the same default for %j', name => {
    expect(defaultWinnerTitle(name)).toBe(server.defaultWinnerTitle(name));
  });
});
```

Create `client/src/hooks/__tests__/useWinnerTitle.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { useWinnerTitle } from '../useWinnerTitle';

describe('useWinnerTitle', () => {
  test('starts as the truncated name', () => {
    const { result } = renderHook(() => useWinnerTitle('Spring Open'));

    expect(result.current.winnerTitle).toBe('Spring Open');
  });

  test('follows name changes until the creator edits it', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: 'Spring Open' },
    });

    rerender({ name: 'Spring Open 2026' });
    expect(result.current.winnerTitle).toBe('Spring Open 2026');

    act(() => result.current.setWinnerTitle('Spring Champ'));
    rerender({ name: 'Autumn Open' });

    expect(result.current.winnerTitle).toBe('Spring Champ');
  });

  test('truncates a long name as it follows', () => {
    const { result } = renderHook(() => useWinnerTitle('a'.repeat(60)));

    expect(result.current.winnerTitle).toBe('a'.repeat(30));
  });

  test('caps typed input at the limit', () => {
    const { result } = renderHook(() => useWinnerTitle('x'));

    act(() => result.current.setWinnerTitle('b'.repeat(40)));

    expect(result.current.winnerTitle).toBe('b'.repeat(30));
  });

  test('reset restores a saved custom title and stops following the name', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.resetWinnerTitle('Spring Open', 'Spring Champ'));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Renamed Open' });

    expect(result.current.winnerTitle).toBe('Spring Champ');
  });

  test('reset with no saved title follows the name again', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.setWinnerTitle('Typed'));
    act(() => result.current.resetWinnerTitle('Spring Open', undefined));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Spring Open 2027' });

    expect(result.current.winnerTitle).toBe('Spring Open 2027');
  });

  test('reset with a saved title equal to the default keeps following the name', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.resetWinnerTitle('Spring Open', 'Spring Open'));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Spring Open 2027' });

    expect(result.current.winnerTitle).toBe('Spring Open 2027');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/utils/__tests__/winnerTitle.test.ts src/hooks/__tests__/useWinnerTitle.test.ts`
Expected: FAIL — `Cannot find module '../winnerTitle'`

- [ ] **Step 3: Write minimal implementation**

Create `client/src/utils/winnerTitle.ts`:

```ts
// Mirrors server/src/utils/prestigeTitle.js; winnerTitle.test.ts keeps the two in step.
export const WINNER_TITLE_MAX_LENGTH = 30;

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

export function defaultWinnerTitle(name: string): string {
  let cut = name.trim().slice(0, WINNER_TITLE_MAX_LENGTH);
  const lastUnit = cut.charCodeAt(cut.length - 1);
  if (lastUnit >= HIGH_SURROGATE_MIN && lastUnit <= HIGH_SURROGATE_MAX) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd();
}
```

Create `client/src/hooks/useWinnerTitle.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { WINNER_TITLE_MAX_LENGTH, defaultWinnerTitle } from '../utils/winnerTitle';

// Form state for the tournament's winner title. It mirrors the truncated tournament name until the
// creator types their own value, after which it is left alone.
export function useWinnerTitle(name: string) {
  const [winnerTitle, setWinnerTitleState] = useState(() => defaultWinnerTitle(name));
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!edited) {
      setWinnerTitleState(defaultWinnerTitle(name));
    }
  }, [name, edited]);

  const setWinnerTitle = useCallback((value: string) => {
    setEdited(true);
    setWinnerTitleState(value.slice(0, WINNER_TITLE_MAX_LENGTH));
  }, []);

  // Loads a saved tournament: a custom title is kept, anything else keeps following the name.
  const resetWinnerTitle = useCallback((savedName: string, savedTitle?: string) => {
    const saved = savedTitle?.trim() ?? '';
    const fallback = defaultWinnerTitle(savedName);
    setEdited(saved !== '' && saved !== fallback);
    setWinnerTitleState(saved || fallback);
  }, []);

  return { winnerTitle, setWinnerTitle, resetWinnerTitle };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/utils/__tests__/winnerTitle.test.ts src/hooks/__tests__/useWinnerTitle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/winnerTitle.ts client/src/hooks client/src/utils/__tests__/winnerTitle.test.ts
git commit -m "feat: add winner title helper and form hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Winner title input in the create and edit forms

**Files:**
- Modify: `client/src/services/api.ts` (`Tournament`, `createTournament`, `updateTournament`)
- Modify: `client/src/pages/TournamentSubmission.tsx`
- Modify: `client/src/components/tournaments/EditTournamentModal.tsx`
- Modify: `client/src/pages/TournamentDetail.tsx:289-302`

The forms are large and have no render tests; this task is verified by the TypeScript compile plus the existing `TournamentDetail` tests.

- [ ] **Step 1: API types**

In `client/src/services/api.ts`:
- In `interface Tournament`, add after `description?: string;`: `winnerTitle?: string;`
- In both the `createTournament` and `updateTournament` parameter types, add after `description?: string;`: `winnerTitle?: string;`

- [ ] **Step 2: `TournamentSubmission.tsx`**

Add imports at the top:

```tsx
import { useWinnerTitle } from '../hooks/useWinnerTitle';
import { WINNER_TITLE_MAX_LENGTH } from '../utils/winnerTitle';
```

Directly after `const [name, setName] = useState('');` add:

```tsx
  const { winnerTitle, setWinnerTitle } = useWinnerTitle(name);
```

Add `winnerTitle?: string;` after `description?: string;` in **both** inline `tournamentData` type literals (the `useMutation` parameter type and the `const tournamentData: { … }` type). In the `tournamentData` object literal, add after `description: description.trim() || undefined,`:

```tsx
        winnerTitle: winnerTitle.trim() || undefined,
```

Insert this block directly after the closing `</div>` of the Tournament Name field (the block ending with `{name.length}/100 characters</p>`):

```tsx
          <div>
            <label htmlFor="winnerTitle" className="block text-sm font-medium text-gray-700 mb-2">
              Winner Title
            </label>
            <input
              id="winnerTitle"
              type="text"
              value={winnerTitle}
              onChange={(e) => setWinnerTitle(e.target.value)}
              className="input-field"
              maxLength={WINNER_TITLE_MAX_LENGTH}
              placeholder="Title the winner earns"
            />
            <p className="mt-1 text-xs text-gray-500">
              Shown on the winner&apos;s badge. Starts as the tournament name; edit it to change.{' '}
              {winnerTitle.length}/{WINNER_TITLE_MAX_LENGTH} characters
            </p>
          </div>
```

- [ ] **Step 3: `EditTournamentModal.tsx`**

Add imports:

```tsx
import { useWinnerTitle } from '../../hooks/useWinnerTitle';
import { WINNER_TITLE_MAX_LENGTH } from '../../utils/winnerTitle';
```

Add `winnerTitle?: string;` after `description?: string;` in the `onSave` prop type and in the `updateData` type literal. Directly after `const [name, setName] = useState('');` add:

```tsx
  const { winnerTitle, setWinnerTitle, resetWinnerTitle } = useWinnerTitle(name);
```

In the initialization `useEffect`, add after `setName(tournament.name || '');`:

```tsx
      resetWinnerTitle(tournament.name || '', tournament.winnerTitle);
```

and change that effect's dependency array from `[isOpen, tournament]` to `[isOpen, tournament, resetWinnerTitle]`.

In the `updateData` assembly, add after the `if (addressOrDateChanged && notifyParticipants) { … }` block and before `await onSave(updateData);`:

```tsx
      // The server locks the title once the tournament is completed.
      if (tournament?.status !== 'Completed') {
        updateData.winnerTitle = winnerTitle.trim();
      }
```

Insert this block directly after the closing `</div>` of the Tournament Name field (the block with `placeholder="Tournament Name"`):

```tsx
              <div>
                <label htmlFor="winnerTitle" className="block text-sm font-medium text-gray-700 mb-2">
                  Winner Title
                </label>
                <input
                  id="winnerTitle"
                  type="text"
                  value={winnerTitle}
                  onChange={(e) => setWinnerTitle(e.target.value)}
                  className="input-field"
                  maxLength={WINNER_TITLE_MAX_LENGTH}
                  disabled={tournament?.status === 'Completed'}
                  placeholder="Title the winner earns"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {tournament?.status === 'Completed'
                    ? 'The winner title cannot be changed after the tournament is completed.'
                    : `Shown on the winner's badge. ${winnerTitle.length}/${WINNER_TITLE_MAX_LENGTH} characters`}
                </p>
              </div>
```

- [ ] **Step 4: `TournamentDetail.tsx`**

Add `winnerTitle?: string;` after `description?: string;` in the `handleUpdateTournament` data type (`:289`).

- [ ] **Step 5: Type-check and run related tests**

Run: `cd client && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/pages/__tests__/TournamentDetail.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/services/api.ts client/src/pages/TournamentSubmission.tsx client/src/components/tournaments/EditTournamentModal.tsx client/src/pages/TournamentDetail.tsx
git commit -m "feat: add winner title field to tournament create and edit forms

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Prestige tier, marker match, badge style

**Files:**
- Modify: `client/src/utils/flairUtils.ts`
- Modify: `client/src/styles/flair.css`
- Test: `client/src/utils/__tests__/flairCatalog.test.ts`, `client/src/utils/__tests__/flairUtils.test.ts`, `client/src/components/user/__tests__/TitleBadge.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `client/src/utils/__tests__/flairCatalog.test.ts`, add `PRESTIGE_TITLE_MARKER` to the import from `'../flairUtils'`:

```ts
import {
  getTitleStyle,
  getIconStyle,
  getNameColorStyle,
  isPremiumBorder,
  isMidTierBorder,
  PRESTIGE_TITLE_MARKER,
} from '../flairUtils';
```

add this require after the existing server-catalog require:

```ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PRESTIGE_TITLE_MARKER: SERVER_PRESTIGE_TITLE_MARKER } = require('../../../../server/src/utils/prestigeTitle');
```

and append:

```ts
describe('prestige titles', () => {
  test('use the same marker as the server', () => {
    expect(PRESTIGE_TITLE_MARKER).toBe(SERVER_PRESTIGE_TITLE_MARKER);
  });

  test('any value starting with the marker resolves to the prestige style', () => {
    const style = getTitleStyle(`${PRESTIGE_TITLE_MARKER}Spring Open`);

    expect(style?.tier).toBe('prestige');
    expect(cssDefines(style?.className ?? '')).toBe(true);
  });

  test('the marker only counts at the start of the value', () => {
    expect(getTitleStyle(`Spring ${PRESTIGE_TITLE_MARKER}Open`)).toBeNull();
  });

  test('no shop catalog title resolves to the prestige style', () => {
    for (const item of itemsIn('title')) {
      expect(getTitleStyle(item.value)?.tier).not.toBe('prestige');
    }
  });
});
```

Append to `client/src/components/user/__tests__/TitleBadge.test.tsx`, inside the `describe`:

```tsx
  test('renders earned titles with the prestige badge', () => {
    render(<TitleBadge value="🏆 Spring Open" />);

    const badge = screen.getByText('🏆 Spring Open');
    expect(badge).toHaveClass('flair-title-prestige');
    expect(badge).not.toHaveClass('bg-primary-100');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/utils/__tests__/flairCatalog.test.ts src/components/user/__tests__/TitleBadge.test.tsx`
Expected: FAIL — `PRESTIGE_TITLE_MARKER` is undefined / the badge has no prestige class

- [ ] **Step 3: Implement**

In `client/src/utils/flairUtils.ts`, change the tier type:

```ts
export type FlairTier = 'entry' | 'mid' | 'premium' | 'prestige';
```

Add after the `MID_TITLE` constant:

```ts
// Earned titles are stored with this prefix (see server/src/utils/prestigeTitle.js), so any value
// carrying it is styled as prestige without a per-item registry entry. Never change it once shipped.
export const PRESTIGE_TITLE_MARKER = '🏆 ';
const PRESTIGE_TITLE: TitleStyle = { tier: 'prestige', className: 'flair-title-prestige' };
```

and replace `getTitleStyle`:

```ts
export function getTitleStyle(titleValue: string): TitleStyle | null {
  if (titleValue.startsWith(PRESTIGE_TITLE_MARKER)) {
    return PRESTIGE_TITLE;
  }
  return lookup(TITLE_STYLES, titleValue);
}
```

In `client/src/styles/flair.css`, add directly after the `.flair-title-mid` rule (before the "Reduced motion" comment block):

```css
/* Earned titles: a dark badge with gold lettering, unlike any purchasable tier. Static, so it needs
   no reduced-motion rule. Forced-colors mode replaces badge colors on its own. */
.flair-title-prestige {
  background: linear-gradient(135deg, #1c1917, #44403c, #1c1917);
  color: #fcd34d;
  border: 1px solid #d97706;
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.45), 0 1px 4px rgba(0, 0, 0, 0.35);
}

/* Printing drops backgrounds, which would leave pale gold text on white. */
@media print {
  .flair-title-prestige {
    background: none;
    color: #78350f;
    border-color: #78350f;
    box-shadow: none;
  }
}
```

- [ ] **Step 4: Run tests, type-check and the full flair suites**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/utils src/components/user`
Expected: PASS

Run: `cd client && npx tsc --noEmit -p tsconfig.json`
Expected: no errors (a new `FlairTier` member must not break any switch or `Record`)

- [ ] **Step 5: Commit**

```bash
git add client/src/utils client/src/styles/flair.css client/src/components/user
git commit -m "feat: add prestige title tier styled by the earned-title marker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: "Earned" group in the shop page

**Files:**
- Modify: `client/src/services/api.ts` (`ShopItem`)
- Modify: `client/src/pages/Shop.tsx:196-198` and `:290-318`
- Test: `client/src/pages/__tests__/Shop.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `client/src/pages/__tests__/Shop.test.tsx`, inside the top-level `describe('Shop page', …)` before its closing `});`:

```tsx
  describe('earned items', () => {
    const earnedTitle = {
      _id: 'earned1',
      name: '🏆 Spring Open',
      description: 'Awarded for winning a tournament',
      category: 'title',
      cost: 0,
      value: '🏆 Spring Open',
      tier: 'prestige',
      acquisition: 'earned',
      sortOrder: 0,
      isActive: true,
    } as ShopItem;
    const retiredTitle = {
      _id: 'retiredTitle2',
      name: 'Founding Player',
      description: 'No longer sold',
      category: 'title',
      cost: 500,
      value: 'Founding Player',
      tier: 'premium',
      sortOrder: 9,
      isActive: false,
    } as ShopItem;

    const showTitles = () => fireEvent.click(screen.getByRole('button', { name: /titles/i }));

    test('lists an earned title under "Earned" with Equip and no Buy', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: earnedTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      showTitles();

      expect(screen.getByRole('heading', { name: /^earned$/i })).toBeInTheDocument();
      expect(screen.getByTestId('flair-item-card-earned1')).toHaveTextContent('🏆 Spring Open');
      expect(screen.getByRole('button', { name: /^equip$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^buy$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /owned \(retired\)/i })).not.toBeInTheDocument();
    });

    test('keeps earned and retired titles in separate groups', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [
          { item: earnedTitle, purchasedAt: '2026-01-01' },
          { item: retiredTitle, purchasedAt: '2026-01-01' },
        ],
      });

      render(<Shop />);
      showTitles();

      expect(screen.getByRole('heading', { name: /^earned$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /owned \(retired\)/i })).toBeInTheDocument();
    });

    test('shows the earned title instead of the empty message', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: earnedTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      showTitles();

      expect(screen.queryByText(/no items available in this category/i)).not.toBeInTheDocument();
    });

    test('equips an earned title by id', async () => {
      shopApi.equip.mockReset();
      shopApi.equip.mockResolvedValue({});
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: earnedTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      showTitles();
      fireEvent.click(screen.getByRole('button', { name: /^equip$/i }));

      await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('earned1', 'title'));
    });

    test('renders an earned title with the prestige badge', () => {
      mockShopUseApi(mockCatalog, {
        ...mockInventory,
        purchasedItems: [{ item: earnedTitle, purchasedAt: '2026-01-01' }],
      });

      render(<Shop />);
      showTitles();

      const card = screen.getByTestId('flair-item-card-earned1');
      // eslint-disable-next-line testing-library/no-node-access -- the badge is a styled span with no accessible role
      expect(card.querySelector('.flair-title-prestige')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/pages/__tests__/Shop.test.tsx`
Expected: FAIL — there is no "Earned" heading (the title is listed under "Owned (retired)")

- [ ] **Step 3: Implement**

In `client/src/services/api.ts`, update `ShopItem`: change the tier line and add two fields after `isActive`:

```ts
  tier: 'entry' | 'mid' | 'premium' | 'prestige';
  ...
  isActive: boolean;
  acquisition?: 'shop' | 'earned';
  availableUntil?: string | null;
```

In `client/src/pages/Shop.tsx`, replace:

```tsx
  const retiredItems = ownedItems.filter(i => i.category === activeTab && !catalogIds.has(i._id));
```

with:

```tsx
  const ownedInTab = ownedItems.filter(i => i.category === activeTab);
  const earnedItems = ownedInTab.filter(i => i.acquisition === 'earned');
  const retiredItems = ownedInTab.filter(i => i.acquisition !== 'earned' && !catalogIds.has(i._id));
```

Replace the empty-state condition:

```tsx
      {currentItems.length === 0 && retiredItems.length === 0 && (
```

with:

```tsx
      {currentItems.length === 0 && earnedItems.length === 0 && retiredItems.length === 0 && (
```

Insert this section directly before the `{/* Owned items that are no longer sold — still equippable, never buyable */}` comment:

```tsx
      {/* Awarded for achievements — equippable by their owners, never buyable */}
      {earnedItems.length > 0 && (
        <section className={currentItems.length > 0 ? 'mt-8' : undefined}>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Earned</h2>
          <p className="text-xs text-gray-500 mb-4">
            Awarded for winning tournaments and ranked seasons. These cannot be bought.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {earnedItems.map(renderCard)}
          </div>
        </section>
      )}

```

and change the retired section's opening tag from `<section className={currentItems.length > 0 ? 'mt-8' : undefined}>` to:

```tsx
        <section className={currentItems.length > 0 || earnedItems.length > 0 ? 'mt-8' : undefined}>
```

- [ ] **Step 4: Run tests and type-check**

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false src/pages/__tests__/Shop.test.tsx`
Expected: PASS (existing retired-item tests still pass, plus 5 new)

Run: `cd client && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add client/src/services/api.ts client/src/pages/Shop.tsx client/src/pages/__tests__/Shop.test.tsx
git commit -m "feat: show earned titles in their own shop group

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Docs and full verification

**Files:**
- Modify: `docs/flair-style-guide.md`
- Modify: `docs/superpowers/specs/2026-09-21-prestige-earn-only-items-design.md`

- [ ] **Step 1: Style guide**

In `docs/flair-style-guide.md`:

1. Change `The shop has three tiers.` to `The shop has three purchasable tiers, plus a fourth earn-only tier (Prestige, below).`
2. Add this section directly before `## CSS Architecture`:

```markdown
## Prestige (earn-only) titles

Prestige is not a shop tier and cannot be bought. A tournament winner or ranked-season champion is granted a title whose stored `value` starts with the reserved marker `🏆 ` (for example `🏆 Spring Open` or `🏆 Season Champion: Jan 2026`). `getTitleStyle` in `flairUtils.ts` recognizes the marker and returns the single shared `flair-title-prestige` style, so a new event needs no CSS or registry entry.

- **Look:** a dark badge with gold lettering and a gold ring. Deliberately unlike every purchasable badge. It is static, so it needs no reduced-motion rule. It has a `@media print` fallback because the dark background is dropped when printing; forced-colors mode replaces badge colors on its own.
- **Never change the marker.** It is stored in every earned title and matched by the client.
- **No shop value may start with the marker**, or a purchasable item would be styled as prestige. `shopCatalog.test.js` and `flairCatalog.test.ts` enforce this.
- **Text comes from the tournament's `winnerTitle`** (max 30 characters, defaulting to the truncated name) or, for seasons, the season's start month. Both are shown verbatim after the marker.
```

- [ ] **Step 2: Align the spec with what was built**

In `docs/superpowers/specs/2026-09-21-prestige-earn-only-items-design.md`:
- Replace every `winnerTitle.js` with `prestigeTitle.js`.
- In section 1, change `source`: optional `{ type: 'tournament' | 'ranked_season', …}` to use `kind` instead of `type`.
- In section 5, replace the "`Shop.tsx`: earned items appear under an "Earned" group (source label, equip/unequip, no Buy)…" bullet's parenthetical with `(item name and description, equip/unequip, no Buy)`.
- In section 6, replace "Forced-colors and print fallbacks are added like other badges." with "A print fallback is added (the dark background is dropped when printing); forced-colors mode replaces badge colors on its own."
- In section 7, replace "`client/src/utils/__tests__/flairCatalog.test.ts`: … listed in the forced-colors and print blocks;" with "… the class is defined in `flair.css`;".
- In section 8 (Client), replace the `TournamentSubmission` bullet with "`useWinnerTitle` follows the name until the creator edits the title, then stops; reset restores a saved custom title."

- [ ] **Step 3: Full verification**

Run: `cd server && npx jest --runInBand`
Expected: all suites pass (baseline before this work: 16 suites, 167 tests; expect more now, 0 failures)

Run: `cd client && NODE_ENV=test npx jest -c jest.config.js --watchAll=false`
Expected: all suites pass (baseline: 19 suites, 320 tests; expect more now, 0 failures)

Run: `cd client && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

Run: `cd client && npx prettier --check src/utils/winnerTitle.ts src/hooks/useWinnerTitle.ts` (skip if the repo has no Prettier config: the project rules call for `prettier --check` before finishing)
Expected: no formatting issues, or fix with `--write` and amend.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: document prestige titles and align the spec with the build

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage**

| Spec requirement | Task |
|------------------|------|
| ShopItem `acquisition`, window, `sourceKey`, `prestige` tier | 2 |
| `purchasedItems.source` | 2 |
| `Tournament.winnerTitle` (30 max) | 2, 7 |
| Prestige helpers, default/resolve/normalize | 1 |
| `grantEarnedTitle` idempotent, no points, race-safe | 3 |
| Tournament winner grant (skip dropped) | 4, 5 |
| Season champion grant incl. ties, inside claim/lease retry | 4, 6 |
| GET hides earned/expired; purchase rejects them; seed spares earned; window on catalog | 8 |
| Owner keeps expired item, can equip | 8 (test) |
| Catalog guard tests | 9 |
| Client default-title helper + hook, parity with server | 10 |
| Winner title input on create and edit, locked when completed | 11 |
| Prestige tier, `🏆 ` marker match, badge CSS | 12 |
| "Earned" group in the shop | 13 |
| Style guide, spec alignment, full verification | 14 |

**Placeholder scan:** no TBD/TODO; every code step shows code; the only "similar to" wording is the instruction to add the same `winnerTitle?: string` line to several type literals, each named explicitly.

**Type consistency:** `GRANT_KIND.Tournament = 'tournament'`, `GRANT_KIND.RankedSeason = 'ranked_season'` match the `source.kind` enum (Task 2) and `sourceKey` prefixes used in tests (`tournament:`, `ranked_season:`). `PRESTIGE_TITLE_MARKER` is `'🏆 '` in `prestigeTitle.js` and `flairUtils.ts`, with a parity test. `resolveWinnerTitle`, `normalizeWinnerTitle`, `defaultWinnerTitle`, `prestigeTitleValue` are defined in Task 1 and used with the same names in Tasks 3, 4 and 7. `useWinnerTitle` returns `{ winnerTitle, setWinnerTitle, resetWinnerTitle }` in Task 10 and is destructured identically in Task 11. `isPurchasable` / `purchasableItemsFilter` defined and imported under the same names in Task 8.
