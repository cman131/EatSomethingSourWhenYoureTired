# Equip From Profile & Saved Flair Loadouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player equip/unequip owned flair and save/apply up to 2 named "loadouts" (all four slots at once) from their own profile page, sharing preview/equip logic with the existing Shop page instead of duplicating it.

**Architecture:** Add a `flairLoadouts` array to `User`, a small pure-validation module (`flairLoadoutService.js`) that reuses the existing `equippedFlairAudit.js` slot/category/value matching logic against a user's *owned* items, and four new routes on `server/src/routes/shop.js`. On the client, extract the equip-mutation and preview-composition logic out of `Shop.tsx` into a shared hook (`useFlairEquip`) and a pure helper (`composeFlairPreview`), then build `MyFlairSection.tsx` (own-profile-only) on top of both, wired into `Profile.tsx`.

**Tech Stack:** Node.js/Express, Mongoose 7, Jest + Supertest (backend); React 18/TypeScript, Jest + React Testing Library (frontend).

---

## Reference: design spec

Full design: `docs/superpowers/specs/2026-09-21-profile-equip-and-saved-loadouts-design.md`. Source tech-debt plan: `docs/tech-debt/flair/profile-equip-and-saved-loadouts.md` (now at `docs/completed-tech-debt/...` once this plan finishes — that move is out of scope for this plan; it's handled by the tech-debt runner).

Key decisions already made (do not re-litigate):
- Loadout cap is a fixed constant, `MAX_FLAIR_LOADOUTS = 2`, in `server/src/utils/flairLoadoutService.js`.
- Retired (no-longer-sold) owned items ARE allowed in loadouts — validation only checks ownership + category, never `isActive`.

## Test running

- Backend: from `server/`, run `npx jest <path>` for a single file, or `npx jest` for everything. Needs a local MongoDB reachable at `mongodb://localhost:27017/mahjong-test` (or `MONGO_URI` env var) — same as all existing server tests.
- Frontend: from `client/`, run `npm test -- --watchAll=false --testPathPattern="<path>"` for one file (per `CLAUDE.md`, `--watchAll=false` is mandatory).
- **Known pre-existing baseline failures (not caused by this plan, do not try to fix them here):** `server/src/models/DecisionQuiz.test.js`, `server/src/utils/rankedLeagueService.test.js`, and `server/src/utils/pointsService.test.js` (13 failing tests, root cause `awardPointsOnce is not defined` in `pointsService.js` plus one unrelated `DecisionQuiz` validation test). Confirm these are the *only* failures before and after this plan's changes — don't let new failures hide among them.

---

## File Structure

**Backend — create:**
- `server/src/utils/flairLoadoutService.js` — `MAX_FLAIR_LOADOUTS`, `LOADOUT_SLOT_KEYS`, `validateLoadoutSlots`, `applyLoadout`.
- `server/src/utils/flairLoadoutService.test.js` — pure unit tests for `validateLoadoutSlots`.

**Backend — modify:**
- `server/src/models/User.js` — add `flairLoadouts` array field.
- `server/src/models/User.shopFlair.test.js` — add coverage for the new field.
- `server/src/routes/shop.js` — add `POST/PUT/DELETE /loadouts[...]` routes, extend `GET /inventory`.
- `server/src/routes/shop.test.js` — add route-level coverage for all four new endpoints and the extended inventory response.

**Frontend — create:**
- `client/src/utils/flairPreview.ts` — `composeFlairPreview`, `FlairPreview` type.
- `client/src/utils/__tests__/flairPreview.test.ts`
- `client/src/hooks/useFlairEquip.ts` — equip/unequip mutation + success/error messaging, shared by Shop and the profile panel.
- `client/src/hooks/__tests__/useFlairEquip.test.ts`
- `client/src/components/profile/MyFlairSection.tsx` — the new own-profile-only panel.
- `client/src/components/profile/__tests__/MyFlairSection.test.tsx`

**Frontend — modify:**
- `client/src/services/api.ts` — `FlairLoadout` type, `ShopInventory.flairLoadouts`, `shopApi.createLoadout/renameLoadout/deleteLoadout/applyLoadout`.
- `client/src/pages/Shop.tsx` — use `useFlairEquip` + `composeFlairPreview` instead of inline duplicated logic (no behavior change).
- `client/src/pages/Profile.tsx` — render `MyFlairSection` for `isOwnProfile`.

---

## Task 1: `User.flairLoadouts` field

**Files:**
- Modify: `server/src/models/User.js:161-170` (right after `purchasedItems`/`equippedFlair`)
- Test: `server/src/models/User.shopFlair.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `server/src/models/User.shopFlair.test.js` (after the existing `describe('User flair fields', ...)` block, before the final closing — i.e. append at end of file):

```js
describe('User flairLoadouts', () => {
  test('new user has an empty flairLoadouts array', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-new',
      email: 'test-flair-loadouts-new@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    expect(user.flairLoadouts).toHaveLength(0);
  });

  test('can add a flairLoadout with all four slots', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-add',
      email: 'test-flair-loadouts-add@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({
      name: 'Tournament Look',
      nameColor: 'flair-color-gold',
      nameIcon: '🐉',
      profileBorder: 'flair-border-hanabi',
      title: 'Chicken Farmer',
    });
    await user.save();

    const found = await User.findById(user._id);
    expect(found.flairLoadouts).toHaveLength(1);
    expect(found.flairLoadouts[0].name).toBe('Tournament Look');
    expect(found.flairLoadouts[0].nameColor).toBe('flair-color-gold');
    expect(found.flairLoadouts[0].title).toBe('Chicken Farmer');
  });

  test('a flairLoadout slot defaults to null when omitted', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-partial',
      email: 'test-flair-loadouts-partial@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({ name: 'Just a color', nameColor: 'flair-color-pink' });
    await user.save();

    const found = await User.findById(user._id);
    expect(found.flairLoadouts[0].nameIcon).toBeNull();
    expect(found.flairLoadouts[0].profileBorder).toBeNull();
    expect(found.flairLoadouts[0].title).toBeNull();
  });

  test('rejects a flairLoadout with no name', async () => {
    const user = await User.create({
      displayName: 'test-flair-loadouts-noname',
      email: 'test-flair-loadouts-noname@example.com',
      password: 'password123',
      clubAffiliation: 'Charleston',
    });

    user.flairLoadouts.push({ nameColor: 'flair-color-pink' });
    await expect(user.save()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx jest src/models/User.shopFlair.test.js -t "flairLoadouts"`
Expected: FAIL — `flairLoadouts` is undefined on the schema (`user.flairLoadouts.push is not a function` or similar).

- [ ] **Step 3: Add the field to the schema**

In `server/src/models/User.js`, right after the `equippedFlair` field (currently lines 165-170) and before the closing `}, {`:

```js
  equippedFlair: {
    nameColor:     { type: String, default: null },
    nameIcon:      { type: String, default: null },
    profileBorder: { type: String, default: null },
    title:         { type: String, default: null },
  },
  // Up to MAX_FLAIR_LOADOUTS (server/src/utils/flairLoadoutService.js) named looks a player can
  // save and one-click apply. Same slot shape as equippedFlair.
  flairLoadouts: [{
    name:          { type: String, required: [true, 'Loadout name is required'], trim: true, minlength: 1, maxlength: 30 },
    nameColor:     { type: String, default: null },
    nameIcon:      { type: String, default: null },
    profileBorder: { type: String, default: null },
    title:         { type: String, default: null },
  }],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/models/User.shopFlair.test.js`
Expected: PASS — all tests in the file, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/User.js server/src/models/User.shopFlair.test.js
git commit -m "feat(flair): add flairLoadouts array to User model"
```

---

## Task 2: `flairLoadoutService.js` — pure validation + apply

**Files:**
- Create: `server/src/utils/flairLoadoutService.js`
- Test: `server/src/utils/flairLoadoutService.test.js`
- Reference (do not modify): `server/src/utils/equippedFlairAudit.js`

- [ ] **Step 1: Write the failing tests**

Create `server/src/utils/flairLoadoutService.test.js`:

```js
const { MAX_FLAIR_LOADOUTS, validateLoadoutSlots } = require('./flairLoadoutService');

const ownedItems = [
  { category: 'nameColor', value: 'flair-color-pink' },
  { category: 'nameIcon', value: '🏮' },
  { category: 'title', value: 'Regular' },
];

describe('MAX_FLAIR_LOADOUTS', () => {
  test('is fixed at 2', () => {
    expect(MAX_FLAIR_LOADOUTS).toBe(2);
  });
});

describe('validateLoadoutSlots', () => {
  test('accepts a loadout using only owned items', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Everyday',
      nameColor: 'flair-color-pink',
      nameIcon: '🏮',
      profileBorder: null,
      title: 'Regular',
    });

    expect(result).toEqual({ valid: true });
  });

  test('ignores empty slots', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Just a color',
      nameColor: 'flair-color-pink',
      nameIcon: null,
      profileBorder: null,
      title: null,
    });

    expect(result.valid).toBe(true);
  });

  test('treats missing slot keys the same as null', () => {
    const result = validateLoadoutSlots(ownedItems, { name: 'Sparse', nameColor: 'flair-color-pink' });

    expect(result.valid).toBe(true);
  });

  test('rejects a slot value the user does not own', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Fancy',
      nameColor: 'flair-color-gold',
    });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([{ slot: 'nameColor', value: 'flair-color-gold' }]);
  });

  test('rejects an owned value equipped into the wrong slot category', () => {
    // 'flair-color-pink' is owned, but only as a nameColor item — not a title.
    const result = validateLoadoutSlots(ownedItems, { name: 'Odd', title: 'flair-color-pink' });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([{ slot: 'title', value: 'flair-color-pink' }]);
  });

  test('reports every invalid slot at once', () => {
    const result = validateLoadoutSlots(ownedItems, {
      name: 'Very Odd',
      nameColor: 'not-owned',
      title: 'also-not-owned',
    });

    expect(result.valid).toBe(false);
    expect(result.invalidSlots).toEqual([
      { slot: 'nameColor', value: 'not-owned' },
      { slot: 'title', value: 'also-not-owned' },
    ]);
  });

  test('allows a retired owned item (ownedItems has no isActive field to check)', () => {
    const retiredOwned = [{ category: 'nameColor', value: 'flair-color-old-retired' }];
    const result = validateLoadoutSlots(retiredOwned, { name: 'Retro', nameColor: 'flair-color-old-retired' });

    expect(result.valid).toBe(true);
  });

  test('a loadout with no slots set at all is valid (an empty look)', () => {
    const result = validateLoadoutSlots(ownedItems, { name: 'Blank' });

    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx jest src/utils/flairLoadoutService.test.js`
Expected: FAIL with `Cannot find module './flairLoadoutService'`.

- [ ] **Step 3: Implement `flairLoadoutService.js`**

Create `server/src/utils/flairLoadoutService.js`:

```js
// Validation and application logic for User.flairLoadouts (saved, named combinations of the
// four flair slots a player can one-click apply). Reuses the same slot/category/value matching
// as equippedFlairAudit.js, but built from a user's *owned* items rather than the full catalog —
// so an item is valid in a loadout exactly when it would be valid to /equip directly, including
// retired (no-longer-sold) items the user already owns.
const { buildValidValueLookup, findInvalidSlots } = require('./equippedFlairAudit');
const User = require('../models/User');

// A later tech-debt item (flair/shop-points-sink-and-sellback.md) may let players purchase
// additional loadout slots; when it lands, raise this one constant.
const MAX_FLAIR_LOADOUTS = 2;

const LOADOUT_SLOT_KEYS = ['nameColor', 'nameIcon', 'profileBorder', 'title'];

// Pulls just the four flair slots off a loadout-like object (a Mongoose subdocument or a plain
// request body), defaulting any missing/undefined slot to null so it's treated as empty.
function extractSlots(loadout) {
  const slots = {};
  for (const key of LOADOUT_SLOT_KEYS) {
    slots[key] = loadout[key] ?? null;
  }
  return slots;
}

// ownedItems: plain objects (or populated ShopItem docs) with `category` and `value` — the
// user's purchasedItems' items, isActive or not.
function validateLoadoutSlots(ownedItems, loadout) {
  const lookup = buildValidValueLookup(ownedItems);
  const invalidSlots = findInvalidSlots(extractSlots(loadout), lookup);

  if (invalidSlots.length > 0) {
    return { valid: false, invalidSlots };
  }
  return { valid: true };
}

// Atomically writes all four equippedFlair.* fields from a loadout's slots in one update, so a
// loadout apply can never leave equippedFlair in a partially-applied state.
async function applyLoadout(userId, loadout) {
  const slots = extractSlots(loadout);
  return User.findByIdAndUpdate(
    userId,
    {
      'equippedFlair.nameColor': slots.nameColor,
      'equippedFlair.nameIcon': slots.nameIcon,
      'equippedFlair.profileBorder': slots.profileBorder,
      'equippedFlair.title': slots.title,
    },
    { new: true }
  );
}

module.exports = {
  MAX_FLAIR_LOADOUTS,
  LOADOUT_SLOT_KEYS,
  validateLoadoutSlots,
  applyLoadout,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/flairLoadoutService.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/flairLoadoutService.js server/src/utils/flairLoadoutService.test.js
git commit -m "feat(flair): add flairLoadoutService validation and apply logic"
```

---

## Task 3: `POST /api/shop/loadouts` — create

**Files:**
- Modify: `server/src/routes/shop.js`
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `server/src/routes/shop.test.js`, after the closing of `describe('GET /api/shop/inventory', ...)` (before `describe('POST /api/shop/seed', ...)`):

```js
describe('POST /api/shop/loadouts', () => {
  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });
  });

  test('creates a loadout using an owned item', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Everyday', nameColor: item.value, nameIcon: null, profileBorder: null, title: null });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Everyday');
    expect(res.body.data.nameColor).toBe(item.value);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(1);
    expect(updated.flairLoadouts[0].name).toBe('Everyday');
  });

  test('returns 400 for an empty name', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: '  ', nameColor: item.value });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('returns 400 for a slot value the user does not own', async () => {
    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Not owned', nameColor: 'text-some-unowned-color' });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('allows a retired owned item in a loadout', async () => {
    await ShopItem.findByIdAndUpdate(item._id, { isActive: false });

    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Retro', nameColor: item.value });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(item.value);
  });

  test('returns 400 once the user already has MAX_FLAIR_LOADOUTS loadouts', async () => {
    const { MAX_FLAIR_LOADOUTS } = require('../utils/flairLoadoutService');
    for (let i = 0; i < MAX_FLAIR_LOADOUTS; i++) {
      const ok = await request(app)
        .post('/api/shop/loadouts')
        .send({ name: `Look ${i}`, nameColor: item.value });
      expect(ok.status).toBe(200);
    }

    const res = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'One too many', nameColor: item.value });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/loadout/i);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(MAX_FLAIR_LOADOUTS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `server/`): `npx jest src/routes/shop.test.js -t "POST /api/shop/loadouts"`
Expected: FAIL — 404s, since the route doesn't exist yet.

- [ ] **Step 3: Add the route**

In `server/src/routes/shop.js`:

1. Add the import near the top, with the other requires:

```js
const { purchaseItem, PurchaseFailure } = require('../utils/shopService');
const {
  MAX_FLAIR_LOADOUTS,
  validateLoadoutSlots,
  applyLoadout,
} = require('../utils/flairLoadoutService');
const { SHOP_CATALOG } = require('../data/shopCatalog');
const { validateMongoIdBody, validateOptionalMongoIdBody, validateMongoId, handleValidationErrors } = require('../middleware/validation');
const { body } = require('express-validator');
```

(This replaces the existing `const { validateMongoIdBody, validateOptionalMongoIdBody } = require('../middleware/validation');` line — add `validateMongoId, handleValidationErrors` to that same destructure instead of duplicating the require.)

2. Add a body validator and helper, right after `VALID_SLOTS`:

```js
const VALID_SLOTS = ['nameColor', 'nameIcon', 'profileBorder', 'title'];

const validateLoadoutName = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Loadout name must be between 1 and 30 characters'),
  handleValidationErrors,
];

function loadoutSlotsFromBody(body) {
  const slots = { name: typeof body.name === 'string' ? body.name.trim() : body.name };
  for (const slot of VALID_SLOTS) {
    slots[slot] = body[slot] ?? null;
  }
  return slots;
}
```

3. Add the route itself, right after the `POST /equip` route (before `POST /seed`):

```js
// POST /api/shop/loadouts — body: { name, nameColor, nameIcon, profileBorder, title }
router.post('/loadouts', validateLoadoutName, async (req, res) => {
  try {
    const loadout = loadoutSlotsFromBody(req.body);

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.flairLoadouts.length >= MAX_FLAIR_LOADOUTS) {
      return res.status(400).json({
        success: false,
        message: `You can only save up to ${MAX_FLAIR_LOADOUTS} loadouts`,
      });
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, loadout);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Loadout includes an item you do not own' });
    }

    user.flairLoadouts.push(loadout);
    await user.save();

    res.json({ success: true, message: 'Loadout saved', data: user.flairLoadouts[user.flairLoadouts.length - 1] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/routes/shop.test.js -t "POST /api/shop/loadouts"`
Expected: PASS — 5 tests.

Then run the whole file to confirm nothing else broke: `npx jest src/routes/shop.test.js`
Expected: PASS — same total as before plus these 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat(flair): add POST /api/shop/loadouts to save a loadout"
```

---

## Task 4: `PUT /api/shop/loadouts/:loadoutId` — rename/update

**Files:**
- Modify: `server/src/routes/shop.js`
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing tests**

Add after the `describe('POST /api/shop/loadouts', ...)` block from Task 3:

```js
describe('PUT /api/shop/loadouts/:loadoutId', () => {
  let loadoutId;

  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { item: item._id } },
    });
    const created = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Original', nameColor: item.value });
    loadoutId = created.body.data._id;
  });

  test('renames a loadout without changing its slots', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
    expect(res.body.data.nameColor).toBe(item.value);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].name).toBe('Renamed');
  });

  test('replaces a slot value with another owned item', async () => {
    const otherItem = await ShopItem.create({
      name: 'test-shop-route-second-color',
      description: 'Second color',
      category: 'nameColor',
      cost: 100,
      value: 'text-second-color',
    });
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: otherItem._id } } });

    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Original', nameColor: otherItem.value });

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(otherItem.value);
  });

  test('returns 400 when replacing a slot with an item the user does not own', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: 'Original', nameColor: 'not-owned-value' });

    expect(res.status).toBe(400);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts[0].nameColor).toBe(item.value);
  });

  test('returns 404 for a loadout id that does not belong to the user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/shop/loadouts/${fakeId}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  test('returns 400 for an empty name', async () => {
    const res = await request(app)
      .put(`/api/shop/loadouts/${loadoutId}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/routes/shop.test.js -t "PUT /api/shop/loadouts"`
Expected: FAIL — 404 for all (route doesn't exist) or wrong assertions.

- [ ] **Step 3: Add the route**

In `server/src/routes/shop.js`, right after the `POST /loadouts` route added in Task 3:

```js
// PUT /api/shop/loadouts/:loadoutId — body: any subset of { name, nameColor, nameIcon, profileBorder, title }
router.put('/loadouts/:loadoutId', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : loadout.name;
    if (!name || name.length > 30) {
      return res.status(400).json({ success: false, message: 'Loadout name must be between 1 and 30 characters' });
    }

    const updatedSlots = { name };
    for (const slot of VALID_SLOTS) {
      updatedSlots[slot] = req.body[slot] !== undefined ? req.body[slot] : loadout[slot];
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, updatedSlots);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Loadout includes an item you do not own' });
    }

    loadout.name = updatedSlots.name;
    for (const slot of VALID_SLOTS) {
      loadout[slot] = updatedSlots[slot];
    }
    await user.save();

    res.json({ success: true, message: 'Loadout updated', data: loadout });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/routes/shop.test.js -t "PUT /api/shop/loadouts"`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat(flair): add PUT /api/shop/loadouts/:loadoutId to rename/update a loadout"
```

---

## Task 5: `DELETE /api/shop/loadouts/:loadoutId`

**Files:**
- Modify: `server/src/routes/shop.js`
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing tests**

Add after the `describe('PUT /api/shop/loadouts/:loadoutId', ...)` block:

```js
describe('DELETE /api/shop/loadouts/:loadoutId', () => {
  let loadoutId;

  beforeEach(async () => {
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: item._id } } });
    const created = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'To delete', nameColor: item.value });
    loadoutId = created.body.data._id;
  });

  test('deletes a loadout the user owns', async () => {
    const res = await request(app).delete(`/api/shop/loadouts/${loadoutId}`);

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(0);
  });

  test('returns 404 for a loadout id that does not belong to the user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/shop/loadouts/${fakeId}`);

    expect(res.status).toBe(404);

    const updated = await User.findById(user._id);
    expect(updated.flairLoadouts).toHaveLength(1);
  });

  test('deleting one loadout leaves the user free to save a new one at the cap', async () => {
    const { MAX_FLAIR_LOADOUTS } = require('../utils/flairLoadoutService');
    for (let i = 0; i < MAX_FLAIR_LOADOUTS - 1; i++) {
      await request(app).post('/api/shop/loadouts').send({ name: `Extra ${i}`, nameColor: item.value });
    }
    // Now at the cap (the one from beforeEach plus these).
    const overCap = await request(app).post('/api/shop/loadouts').send({ name: 'Over', nameColor: item.value });
    expect(overCap.status).toBe(400);

    await request(app).delete(`/api/shop/loadouts/${loadoutId}`);

    const afterDelete = await request(app).post('/api/shop/loadouts').send({ name: 'Fits now', nameColor: item.value });
    expect(afterDelete.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/routes/shop.test.js -t "DELETE /api/shop/loadouts"`
Expected: FAIL — route doesn't exist (404s where 200 expected).

- [ ] **Step 3: Add the route**

In `server/src/routes/shop.js`, right after the `PUT /loadouts/:loadoutId` route added in Task 4. This mirrors the existing subdocument-removal pattern in `server/src/routes/users.js` (`user.notifications.pull(id); await user.save();`):

```js
// DELETE /api/shop/loadouts/:loadoutId
router.delete('/loadouts/:loadoutId', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    user.flairLoadouts.pull(loadoutId);
    await user.save();

    res.json({ success: true, message: 'Loadout deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/routes/shop.test.js -t "DELETE /api/shop/loadouts"`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat(flair): add DELETE /api/shop/loadouts/:loadoutId"
```

---

## Task 6: `POST /api/shop/loadouts/:loadoutId/apply`

**Files:**
- Modify: `server/src/routes/shop.js`
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing tests**

Add after the `describe('DELETE /api/shop/loadouts/:loadoutId', ...)` block:

```js
describe('POST /api/shop/loadouts/:loadoutId/apply', () => {
  let secondItem, loadoutId;

  beforeEach(async () => {
    secondItem = await ShopItem.create({
      name: 'test-shop-route-apply-icon',
      description: 'An icon',
      category: 'nameIcon',
      cost: 100,
      value: '🐉',
    });
    await User.findByIdAndUpdate(user._id, {
      $push: { purchasedItems: { $each: [{ item: item._id }, { item: secondItem._id }] } },
    });
    const created = await request(app)
      .post('/api/shop/loadouts')
      .send({ name: 'Full look', nameColor: item.value, nameIcon: secondItem.value });
    loadoutId = created.body.data._id;
  });

  test('applies all four slots atomically from the loadout', async () => {
    const res = await request(app).post(`/api/shop/loadouts/${loadoutId}/apply`);

    expect(res.status).toBe(200);

    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBe(item.value);
    expect(updated.equippedFlair.nameIcon).toBe(secondItem.value);
    expect(updated.equippedFlair.profileBorder).toBeNull();
    expect(updated.equippedFlair.title).toBeNull();
  });

  test('overwrites whatever was equipped before, including slots the loadout leaves empty', async () => {
    await User.findByIdAndUpdate(user._id, { 'equippedFlair.profileBorder': 'flair-mid-old' });

    const res = await request(app).post(`/api/shop/loadouts/${loadoutId}/apply`);

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.profileBorder).toBeNull();
  });

  test('applies a loadout containing a retired owned item', async () => {
    await ShopItem.findByIdAndUpdate(item._id, { isActive: false });

    const res = await request(app).post(`/api/shop/loadouts/${loadoutId}/apply`);

    expect(res.status).toBe(200);
    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBe(item.value);
  });

  test('returns 400 and leaves equippedFlair unchanged when the loadout references an item deleted from the catalog', async () => {
    await ShopItem.deleteOne({ _id: item._id });

    const res = await request(app).post(`/api/shop/loadouts/${loadoutId}/apply`);

    expect(res.status).toBe(400);
    const updated = await User.findById(user._id);
    expect(updated.equippedFlair.nameColor).toBeNull();
    expect(updated.equippedFlair.nameIcon).toBeNull();
  });

  test('returns 404 for a loadout id that does not belong to the user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/shop/loadouts/${fakeId}/apply`);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/routes/shop.test.js -t "POST /api/shop/loadouts/:loadoutId/apply"`
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Add the route**

In `server/src/routes/shop.js`, right after the `DELETE /loadouts/:loadoutId` route added in Task 5:

```js
// POST /api/shop/loadouts/:loadoutId/apply — atomically sets all four equippedFlair slots
router.post('/loadouts/:loadoutId/apply', validateMongoId('loadoutId'), async (req, res) => {
  try {
    const { loadoutId } = req.params;

    const user = await User.findById(req.user._id).populate('purchasedItems.item');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const loadout = user.flairLoadouts.id(loadoutId);
    if (!loadout) {
      return res.status(404).json({ success: false, message: 'Loadout not found' });
    }

    const ownedItems = user.purchasedItems.filter(p => p.item).map(p => p.item);
    const validation = validateLoadoutSlots(ownedItems, loadout);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'This loadout includes an item you no longer own' });
    }

    await applyLoadout(user._id, loadout);

    res.json({ success: true, message: 'Loadout applied' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/routes/shop.test.js -t "POST /api/shop/loadouts/:loadoutId/apply"`
Expected: PASS — 5 tests.

Then run the full file once more: `npx jest src/routes/shop.test.js`
Expected: PASS — all tests, including everything from Tasks 3–6.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat(flair): add POST /api/shop/loadouts/:loadoutId/apply"
```

---

## Task 7: Extend `GET /api/shop/inventory` with `flairLoadouts`

**Files:**
- Modify: `server/src/routes/shop.js:38-54`
- Test: `server/src/routes/shop.test.js`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('GET /api/shop/inventory', ...)` block in `server/src/routes/shop.test.js` (after the last test, `'omits purchases whose item no longer exists'`):

```js
  test('includes flairLoadouts', async () => {
    await User.findByIdAndUpdate(user._id, { $push: { purchasedItems: { item: item._id } } });
    await request(app).post('/api/shop/loadouts').send({ name: 'Everyday', nameColor: item.value });

    const res = await request(app).get('/api/shop/inventory');

    expect(res.status).toBe(200);
    expect(res.body.data.flairLoadouts).toHaveLength(1);
    expect(res.body.data.flairLoadouts[0].name).toBe('Everyday');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/routes/shop.test.js -t "includes flairLoadouts"`
Expected: FAIL — `res.body.data.flairLoadouts` is `undefined`.

- [ ] **Step 3: Update the route**

In `server/src/routes/shop.js`, update the existing `GET /inventory` handler (lines ~38-54):

```js
// GET /api/shop/inventory — current user's purchasedItems + equippedFlair + flairLoadouts.
// Owned items are returned even when retired (isActive: false) so owners can still equip or
// unequip them; purchases whose ShopItem no longer exists are skipped.
router.get('/inventory', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('purchasedItems.item')
      .select('purchasedItems equippedFlair pointsBalance flairLoadouts');
    res.json({
      success: true,
      data: {
        purchasedItems: user.purchasedItems.filter(p => p.item),
        equippedFlair: user.equippedFlair,
        pointsBalance: user.pointsBalance,
        flairLoadouts: user.flairLoadouts,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/routes/shop.test.js`
Expected: PASS — every test in the file (all prior tasks' tests plus this one).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/shop.js server/src/routes/shop.test.js
git commit -m "feat(flair): include flairLoadouts in GET /api/shop/inventory"
```

---

## Task 8: Client API types and `shopApi` loadout methods

**Files:**
- Modify: `client/src/services/api.ts:762-830` (the flair/shop section at the end of the file)

No new test file — this task is pure typed plumbing exercised by the tests in Tasks 9–11. There is no separate `api.test.ts` in this codebase (the service layer is exercised indirectly through the pages/components that call it, matching existing convention).

- [ ] **Step 1: Add the `FlairLoadout` type and extend `ShopInventory`**

In `client/src/services/api.ts`, right after the `PurchasedItem` interface (around line 785-788):

```ts
export interface PurchasedItem {
  item: ShopItem;
  purchasedAt: string;
}

export interface FlairLoadout {
  _id: string;
  name: string;
  nameColor: string | null;
  nameIcon: string | null;
  profileBorder: string | null;
  title: string | null;
}

export interface ShopCatalog {
  nameColor?: ShopItem[];
  nameIcon?: ShopItem[];
  profileBorder?: ShopItem[];
  title?: ShopItem[];
}

export interface ShopInventory {
  purchasedItems: PurchasedItem[];
  equippedFlair: EquippedFlair;
  pointsBalance: number;
  flairLoadouts: FlairLoadout[];
}
```

(This replaces the existing `ShopCatalog`/`ShopInventory` interfaces in place — only `ShopInventory` gains the new `flairLoadouts` field; `ShopCatalog` is unchanged and shown here only for placement context.)

- [ ] **Step 2: Add the `shopApi` methods**

In `client/src/services/api.ts`, inside the `shopApi` object, right after the existing `equip` method and before `seed`:

```ts
  equip: async (itemId: string | null, slot: FlairCategory) => {
    return apiRequest<ApiResponse<null>>('/shop/equip', {
      method: 'POST',
      body: JSON.stringify({ itemId, slot }),
    });
  },

  createLoadout: async (loadout: { name: string } & EquippedFlair) => {
    return apiRequest<ApiResponse<FlairLoadout>>('/shop/loadouts', {
      method: 'POST',
      body: JSON.stringify(loadout),
    });
  },

  renameLoadout: async (loadoutId: string, name: string) => {
    return apiRequest<ApiResponse<FlairLoadout>>(`/shop/loadouts/${loadoutId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  deleteLoadout: async (loadoutId: string) => {
    return apiRequest<ApiResponse<null>>(`/shop/loadouts/${loadoutId}`, {
      method: 'DELETE',
    });
  },

  applyLoadout: async (loadoutId: string) => {
    return apiRequest<ApiResponse<null>>(`/shop/loadouts/${loadoutId}/apply`, {
      method: 'POST',
    });
  },

  seed: async () => {
```

- [ ] **Step 3: Verify the file still type-checks**

Run (from `client/`): `npx tsc --noEmit`
Expected: no new errors. (Pre-existing errors, if any, are out of scope — compare against a `git stash`-free baseline only if this command reports something; if it's clean, move on.)

- [ ] **Step 4: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat(flair): add FlairLoadout type and shopApi loadout methods"
```

---

## Task 9: `composeFlairPreview` — extracted preview logic

**Files:**
- Create: `client/src/utils/flairPreview.ts`
- Test: `client/src/utils/__tests__/flairPreview.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/utils/__tests__/flairPreview.test.ts`:

```ts
import { composeFlairPreview } from '../flairPreview';
import { EquippedFlair, ShopItem } from '../../services/api';

const noFlair: EquippedFlair = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

const titleItem: ShopItem = {
  _id: 't1',
  name: 'Chicken Farmer',
  description: '',
  category: 'title',
  cost: 500,
  value: 'Chicken Farmer',
  tier: 'premium',
  sortOrder: 1,
  isActive: true,
};

describe('composeFlairPreview', () => {
  test('with no hovered item and nothing equipped, previews an empty look', () => {
    const preview = composeFlairPreview(noFlair, null, []);

    expect(preview).toEqual({ nameColor: null, nameIcon: '', border: '', titleValue: null });
  });

  test('reflects the currently equipped flair when nothing is hovered', () => {
    const equipped: EquippedFlair = { nameColor: 'text-emerald-600', nameIcon: '🐉', profileBorder: 'flair-mid-jade', title: null };

    const preview = composeFlairPreview(equipped, null, []);

    expect(preview.nameColor).toBe('text-emerald-600');
    expect(preview.nameIcon).toBe('🐉');
    expect(preview.border).toBe('flair-mid-jade');
  });

  test('a hovered item overrides only its own slot', () => {
    const equipped: EquippedFlair = { nameColor: 'text-emerald-600', nameIcon: null, profileBorder: null, title: null };
    const hovered: ShopItem = {
      _id: 'b1',
      name: 'Jade Ring',
      description: '',
      category: 'profileBorder',
      cost: 250,
      value: 'flair-mid-jade',
      tier: 'mid',
      sortOrder: 1,
      isActive: true,
    };

    const preview = composeFlairPreview(equipped, hovered, []);

    expect(preview.nameColor).toBe('text-emerald-600');
    expect(preview.border).toBe('flair-mid-jade');
  });

  test('shows a title badge value only when the equipped title matches a known title item', () => {
    const equipped: EquippedFlair = { ...noFlair, title: 'Chicken Farmer' };

    const preview = composeFlairPreview(equipped, null, [titleItem]);

    expect(preview.titleValue).toBe('Chicken Farmer');
  });

  test('hides the title badge when the equipped title matches no known title item', () => {
    const equipped: EquippedFlair = { ...noFlair, title: 'Some Unknown Title' };

    const preview = composeFlairPreview(equipped, null, [titleItem]);

    expect(preview.titleValue).toBeNull();
  });

  test('a hovered title item is previewed even before it is equipped', () => {
    const preview = composeFlairPreview(noFlair, titleItem, [titleItem]);

    expect(preview.titleValue).toBe('Chicken Farmer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `client/`): `npm test -- --watchAll=false --testPathPattern="flairPreview"`
Expected: FAIL with `Cannot find module '../flairPreview'`.

- [ ] **Step 3: Implement `flairPreview.ts`**

Create `client/src/utils/flairPreview.ts`:

```ts
import type { EquippedFlair, ShopItem } from '../services/api';

export interface FlairPreview {
  nameColor: string | null;
  nameIcon: string;
  border: string;
  // The equipped/hovered title's value, but only when it matches a known title item — otherwise
  // null, so callers can gate rendering a title badge on this alone.
  titleValue: string | null;
}

// Composes what should render in a live flair preview: the currently equipped flair, with one
// slot optionally overridden by a hovered/selected item (e.g. hovering a shop card, or selecting
// an owned item on the profile panel). Shared by Shop.tsx and MyFlairSection.tsx so preview
// math lives in exactly one place.
export function composeFlairPreview(
  equippedFlair: EquippedFlair,
  hoveredItem: ShopItem | null,
  knownTitleItems: Pick<ShopItem, 'value'>[]
): FlairPreview {
  const previewFlair = hoveredItem
    ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
    : equippedFlair;

  const titleValue = previewFlair.title;
  const isKnownTitle = titleValue ? knownTitleItems.some(i => i.value === titleValue) : false;

  return {
    nameColor: previewFlair.nameColor ?? null,
    nameIcon: previewFlair.nameIcon ?? '',
    border: previewFlair.profileBorder ?? '',
    titleValue: isKnownTitle ? titleValue : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="flairPreview"`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/flairPreview.ts client/src/utils/__tests__/flairPreview.test.ts
git commit -m "feat(flair): extract composeFlairPreview shared preview logic"
```

---

## Task 10: `useFlairEquip` — shared equip/unequip hook

**Files:**
- Create: `client/src/hooks/useFlairEquip.ts`
- Test: `client/src/hooks/__tests__/useFlairEquip.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/hooks/__tests__/useFlairEquip.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFlairEquip } from '../useFlairEquip';
import { EquippedFlair, ShopItem } from '../../services/api';

jest.mock('../../services/api', () => ({
  shopApi: { equip: jest.fn() },
}));

const { shopApi } = require('../../services/api');

const noFlair: EquippedFlair = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

const item: ShopItem = {
  _id: 'item1',
  name: 'Jade Green',
  description: '',
  category: 'nameColor',
  cost: 250,
  value: 'text-emerald-600',
  tier: 'mid',
  sortOrder: 1,
  isActive: true,
};

describe('useFlairEquip', () => {
  beforeEach(() => {
    shopApi.equip.mockReset();
  });

  test('equips an unowned-but-unequipped item by id and slot, then calls onEquipped', async () => {
    shopApi.equip.mockResolvedValue({});
    const onEquipped = jest.fn();
    const { result } = renderHook(() => useFlairEquip(noFlair, onEquipped));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor');
    expect(onEquipped).toHaveBeenCalled();
    expect(result.current.actionSuccess).toBe('Equipped Jade Green!');
    expect(result.current.actionError).toBeNull();
  });

  test('unequips an already-equipped item by passing null', async () => {
    shopApi.equip.mockResolvedValue({});
    const equipped: EquippedFlair = { ...noFlair, nameColor: item.value };
    const { result } = renderHook(() => useFlairEquip(equipped, jest.fn()));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor');
    expect(result.current.actionSuccess).toBe('Unequipped Jade Green');
  });

  test('sets actionError and does not call onEquipped when the API call fails', async () => {
    shopApi.equip.mockRejectedValue(new Error('boom'));
    const onEquipped = jest.fn();
    const { result } = renderHook(() => useFlairEquip(noFlair, onEquipped));

    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(result.current.actionError).toBe('Failed to equip item. Please try again.');
    expect(result.current.actionSuccess).toBeNull();
    expect(onEquipped).not.toHaveBeenCalled();
  });

  test('clears a previous error on a new attempt', async () => {
    shopApi.equip.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useFlairEquip(noFlair, jest.fn()));

    await act(async () => {
      await result.current.equipItem(item);
    });
    expect(result.current.actionError).not.toBeNull();

    shopApi.equip.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.equipItem(item);
    });

    expect(result.current.actionError).toBeNull();
    expect(result.current.actionSuccess).toBe('Equipped Jade Green!');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `client/`): `npm test -- --watchAll=false --testPathPattern="useFlairEquip"`
Expected: FAIL with `Cannot find module '../useFlairEquip'`.

- [ ] **Step 3: Implement `useFlairEquip.ts`**

Create `client/src/hooks/useFlairEquip.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="useFlairEquip"`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useFlairEquip.ts client/src/hooks/__tests__/useFlairEquip.test.ts
git commit -m "feat(flair): extract useFlairEquip shared equip/unequip hook"
```

---

## Task 11: Refactor `Shop.tsx` to use the shared hook/util

**Files:**
- Modify: `client/src/pages/Shop.tsx`
- Do not modify: `client/src/pages/__tests__/Shop.test.tsx` (it must pass unchanged — this task is a pure refactor with no behavior change)

- [ ] **Step 1: Confirm the current baseline passes**

Run (from `client/`): `npm test -- --watchAll=false --testPathPattern="pages/__tests__/Shop.test"`
Expected: PASS — all existing tests (this is the safety net for the refactor).

- [ ] **Step 2: Replace the inline preview/equip logic with the shared hook and util**

In `client/src/pages/Shop.tsx`:

1. Add imports, replacing the existing `isFlairEquipped` import line:

```tsx
import { isPremiumBorder, isMidTierBorder, isFlairEquipped } from '../utils/flairUtils';
import { composeFlairPreview } from '../utils/flairPreview';
import { useFlairEquip } from '../hooks/useFlairEquip';
```

2. Remove the `actionError`/`actionSuccess` `useState` pair and the `handleEquip` function (currently):

```tsx
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
```

and:

```tsx
  const handleEquip = async (item: ShopItem) => {
    setActionError(null);
    setActionSuccess(null);
    const slot = item.category;
    const isEquipped = isFlairEquipped(equippedFlair, item);
    try {
      await shopApi.equip(isEquipped ? null : item._id, slot);
      setActionSuccess(isEquipped ? `Unequipped ${item.name}` : `Equipped ${item.name}!`);
      refreshInventory();
    } catch {
      setActionError('Failed to equip item. Please try again.');
    }
  };
```

Replace both with a single hook call, placed where `handleEquip` was:

```tsx
  const { actionError, actionSuccess, equipItem } = useFlairEquip(equippedFlair, refreshInventory);
```

3. Replace the preview composition block (currently):

```tsx
  const previewUser = {
    _id: 'preview',
    displayName: 'Your Name',
    equippedFlair: hoveredItem
      ? { ...equippedFlair, [hoveredItem.category]: hoveredItem.value }
      : equippedFlair,
  };

  const previewNameColor = previewUser.equippedFlair.nameColor ?? null;
  const previewIcon = previewUser.equippedFlair.nameIcon ?? '';
  const previewBorder = previewUser.equippedFlair.profileBorder ?? '';
  const previewNeedsGradientBorder = isPremiumBorder(previewBorder) || isMidTierBorder(previewBorder);

  const previewTitleValue = previewUser.equippedFlair.title;
  const knownTitleItems = [
    ...(catalog?.title ?? []),
    ...ownedItems.filter(i => i.category === 'title' && !catalogIds.has(i._id)),
  ];
  const previewTitleItem = previewTitleValue
    ? knownTitleItems.find(i => i.value === previewTitleValue) ?? null
    : null;
```

with:

```tsx
  const knownTitleItems = [
    ...(catalog?.title ?? []),
    ...ownedItems.filter(i => i.category === 'title' && !catalogIds.has(i._id)),
  ];
  const preview = composeFlairPreview(equippedFlair, hoveredItem, knownTitleItems);
  const previewNeedsGradientBorder = isPremiumBorder(preview.border) || isMidTierBorder(preview.border);
```

4. In `renderCard`, change `onEquip={handleEquip}` to `onEquip={equipItem}`.

5. In the preview JSX block, replace every use of the old names with the new `preview` object:
   - `className={previewBorder}` → `className={preview.border}` (both the gradient-border branch and the plain branch, including the interpolated `${previewBorder}`)
   - `{previewIcon && <FlairIcon value={previewIcon} .../>}` → `{preview.nameIcon && <FlairIcon value={preview.nameIcon} .../>}`
   - `colorValue={previewNameColor}` → `colorValue={preview.nameColor}`
   - `{previewTitleItem && (<span data-testid="preview-title-badge"><TitleBadge value={previewTitleItem.value} /></span>)}` → `{preview.titleValue && (<span data-testid="preview-title-badge"><TitleBadge value={preview.titleValue} /></span>)}`

- [ ] **Step 3: Run tests to verify the refactor is behavior-preserving**

Run: `npm test -- --watchAll=false --testPathPattern="pages/__tests__/Shop.test"`
Expected: PASS — the exact same tests as Step 1, unchanged, still passing.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Shop.tsx
git commit -m "refactor(flair): Shop.tsx uses shared useFlairEquip + composeFlairPreview"
```

---

## Task 12: `MyFlairSection.tsx`

**Files:**
- Create: `client/src/components/profile/MyFlairSection.tsx`
- Test: `client/src/components/profile/__tests__/MyFlairSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/profile/__tests__/MyFlairSection.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyFlairSection from '../MyFlairSection';
import { ShopInventory } from '../../../services/api';

jest.mock('../../../hooks/useApi', () => ({ useApi: jest.fn() }));
jest.mock('../../../services/api', () => ({
  shopApi: {
    getInventory: jest.fn(),
    equip: jest.fn(),
    createLoadout: jest.fn(),
    renameLoadout: jest.fn(),
    deleteLoadout: jest.fn(),
    applyLoadout: jest.fn(),
  },
}));

const { useApi } = require('../../../hooks/useApi');
const { shopApi } = require('../../../services/api');

const colorItem = { _id: 'item1', name: 'Jade Green', description: '', category: 'nameColor', cost: 250, value: 'text-emerald-600', tier: 'mid', sortOrder: 1, isActive: true };
const retiredTitleItem = { _id: 'title1', name: 'Founding Player', description: '', category: 'title', cost: 500, value: 'Founding Player', tier: 'premium', sortOrder: 1, isActive: false };

function baseInventory(overrides: Partial<ShopInventory> = {}): ShopInventory {
  return {
    purchasedItems: [{ item: colorItem, purchasedAt: '2026-01-01' }],
    equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: null },
    pointsBalance: 500,
    flairLoadouts: [],
    ...overrides,
  };
}

function mockInventory(inventory: ShopInventory) {
  useApi.mockReturnValue({ data: { data: inventory }, loading: false, error: null });
}

const onRefetchProfile = async () => {};

describe('MyFlairSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a loading state', () => {
    useApi.mockReturnValue({ data: null, loading: true, error: null });

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('lists owned items grouped by slot', () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByRole('button', { name: /jade green/i })).toBeInTheDocument();
  });

  test('lists a retired owned item alongside active ones', () => {
    mockInventory(baseInventory({
      purchasedItems: [
        { item: colorItem, purchasedAt: '2026-01-01' },
        { item: retiredTitleItem, purchasedAt: '2026-01-01' },
      ],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByRole('button', { name: /founding player/i })).toBeInTheDocument();
  });

  test('clicking an owned item equips it', async () => {
    shopApi.equip.mockResolvedValue({});
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /jade green/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith('item1', 'nameColor'));
  });

  test('clicking an equipped item unequips it', async () => {
    shopApi.equip.mockResolvedValue({});
    mockInventory(baseInventory({
      equippedFlair: { nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null },
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /jade green/i }));

    await waitFor(() => expect(shopApi.equip).toHaveBeenCalledWith(null, 'nameColor'));
  });

  test('shows "no saved loadouts" when there are none', () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.getByText(/no saved loadouts/i)).toBeInTheDocument();
  });

  test('saves the current look as a new loadout', async () => {
    shopApi.createLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      equippedFlair: { nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null },
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.change(screen.getByLabelText(/save current look as/i), { target: { value: 'Everyday' } });
    fireEvent.click(screen.getByRole('button', { name: /save loadout/i }));

    await waitFor(() =>
      expect(shopApi.createLoadout).toHaveBeenCalledWith({
        name: 'Everyday',
        nameColor: colorItem.value,
        nameIcon: null,
        profileBorder: null,
        title: null,
      })
    );
  });

  test('shows a validation message instead of calling the API when saving with a blank name', async () => {
    mockInventory(baseInventory());

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /save loadout/i }));

    expect(await screen.findByText(/give this loadout a name/i)).toBeInTheDocument();
    expect(shopApi.createLoadout).not.toHaveBeenCalled();
  });

  test('lists saved loadouts with an Apply action', async () => {
    shopApi.applyLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    expect(screen.getByText('Tournament Look')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(shopApi.applyLoadout).toHaveBeenCalledWith('l1'));
  });

  test('deletes a loadout', async () => {
    shopApi.deleteLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(shopApi.deleteLoadout).toHaveBeenCalledWith('l1'));
  });

  test('renames a loadout', async () => {
    shopApi.renameLoadout.mockResolvedValue({});
    mockInventory(baseInventory({
      flairLoadouts: [{ _id: 'l1', name: 'Tournament Look', nameColor: colorItem.value, nameIcon: null, profileBorder: null, title: null }],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByLabelText(/loadout name/i), { target: { value: 'Everyday' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(shopApi.renameLoadout).toHaveBeenCalledWith('l1', 'Everyday'));
  });

  test('hides the "save current look" input once at the loadout cap and shows an explanation', () => {
    mockInventory(baseInventory({
      flairLoadouts: [
        { _id: 'l1', name: 'Look 1', nameColor: null, nameIcon: null, profileBorder: null, title: null },
        { _id: 'l2', name: 'Look 2', nameColor: null, nameIcon: null, profileBorder: null, title: null },
      ],
    }));

    render(<MyFlairSection onRefetchProfile={onRefetchProfile} />);

    expect(screen.queryByLabelText(/save current look as/i)).not.toBeInTheDocument();
    expect(screen.getByText(/maximum for now/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `client/`): `npm test -- --watchAll=false --testPathPattern="MyFlairSection"`
Expected: FAIL with `Cannot find module '../MyFlairSection'`.

- [ ] **Step 3: Implement `MyFlairSection.tsx`**

Create `client/src/components/profile/MyFlairSection.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { shopApi, ShopItem, ShopInventory, FlairCategory, FlairLoadout } from '../../services/api';
import { isPremiumBorder, isMidTierBorder, isFlairEquipped } from '../../utils/flairUtils';
import { composeFlairPreview } from '../../utils/flairPreview';
import { useFlairEquip } from '../../hooks/useFlairEquip';
import FlairName from '../user/FlairName';
import FlairIcon from '../user/FlairIcon';
import TitleBadge from '../user/TitleBadge';

const SLOTS: { key: FlairCategory; label: string }[] = [
  { key: 'nameColor', label: 'Name Color' },
  { key: 'nameIcon', label: 'Icon' },
  { key: 'profileBorder', label: 'Border' },
  { key: 'title', label: 'Title' },
];

// Matches server/src/utils/flairLoadoutService.js's MAX_FLAIR_LOADOUTS — the server is the
// source of truth (a create/apply past this is rejected there too); this only drives the UI
// hint so a player isn't shown a "Save" box that would just be rejected.
const MAX_LOADOUTS = 2;

const EMPTY_FLAIR = { nameColor: null, nameIcon: null, profileBorder: null, title: null };

interface MyFlairSectionProps {
  onRefetchProfile: () => Promise<void>;
}

const MyFlairSection: React.FC<MyFlairSectionProps> = ({ onRefetchProfile }) => {
  const [inventoryKey, setInventoryKey] = useState(0);
  const inventoryFetcher = useCallback(() => shopApi.getInventory(), [inventoryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: inventoryRes, loading } = useApi<{ data: ShopInventory }>(inventoryFetcher, [inventoryKey]);
  const inventory = inventoryRes?.data;

  const [hoveredItem, setHoveredItem] = useState<ShopItem | null>(null);
  const [newLoadoutName, setNewLoadoutName] = useState('');
  const [loadoutError, setLoadoutError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const equippedFlair = inventory?.equippedFlair ?? EMPTY_FLAIR;
  const ownedItems = (inventory?.purchasedItems ?? []).flatMap(p => (p.item ? [p.item] : []));
  const loadouts = inventory?.flairLoadouts ?? [];

  const refresh = useCallback(async () => {
    setInventoryKey(k => k + 1);
    await onRefetchProfile();
  }, [onRefetchProfile]);

  const { actionError, actionSuccess, equipItem } = useFlairEquip(equippedFlair, refresh);

  const knownTitleItems = ownedItems.filter(i => i.category === 'title');
  const preview = composeFlairPreview(equippedFlair, hoveredItem, knownTitleItems);
  const previewNeedsGradientBorder = isPremiumBorder(preview.border) || isMidTierBorder(preview.border);

  const handleSaveLoadout = async () => {
    setLoadoutError(null);
    const name = newLoadoutName.trim();
    if (!name) {
      setLoadoutError('Give this loadout a name.');
      return;
    }
    try {
      await shopApi.createLoadout({ name, ...equippedFlair });
      setNewLoadoutName('');
      await refresh();
    } catch {
      setLoadoutError('Failed to save loadout. Please try again.');
    }
  };

  const handleApplyLoadout = async (loadout: FlairLoadout) => {
    setLoadoutError(null);
    try {
      await shopApi.applyLoadout(loadout._id);
      await refresh();
    } catch {
      setLoadoutError('Failed to apply loadout. Please try again.');
    }
  };

  const handleDeleteLoadout = async (loadoutId: string) => {
    setLoadoutError(null);
    try {
      await shopApi.deleteLoadout(loadoutId);
      await refresh();
    } catch {
      setLoadoutError('Failed to delete loadout. Please try again.');
    }
  };

  const startRename = (loadout: FlairLoadout) => {
    setRenamingId(loadout._id);
    setRenameValue(loadout.name);
  };

  const handleRenameLoadout = async (loadoutId: string) => {
    setLoadoutError(null);
    const name = renameValue.trim();
    if (!name) {
      setLoadoutError('Give this loadout a name.');
      return;
    }
    try {
      await shopApi.renameLoadout(loadoutId, name);
      setRenamingId(null);
      await refresh();
    } catch {
      setLoadoutError('Failed to rename loadout. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-gray-500">Loading your flair…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">My Flair</h2>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          {actionError}
        </div>
      )}

      {/* Live preview */}
      <div data-testid="my-flair-preview-box" className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</div>
        <div className="flex items-center gap-3">
          {previewNeedsGradientBorder ? (
            <div className={preview.border} data-testid="my-flair-preview-avatar">
              <div className="flair-border-inner w-10 h-10 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs">?</span>
              </div>
            </div>
          ) : (
            <div
              className={`w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${preview.border}`}
              data-testid="my-flair-preview-avatar"
            >
              <span className="text-gray-400 text-xs">?</span>
            </div>
          )}
          <span className="font-medium">
            {preview.nameIcon && <FlairIcon value={preview.nameIcon} className="mr-1 text-sm" />}
            <FlairName name="Your Name" colorValue={preview.nameColor} defaultColorClass="text-gray-900" />
          </span>
          {preview.titleValue && (
            <span data-testid="my-flair-preview-title-badge">
              <TitleBadge value={preview.titleValue} />
            </span>
          )}
        </div>
      </div>

      {/* Owned items by slot */}
      {SLOTS.map(slot => {
        const items = ownedItems.filter(i => i.category === slot.key);
        if (items.length === 0) {
          return null;
        }
        return (
          <div key={slot.key} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{slot.label}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map(item => {
                const equipped = isFlairEquipped(equippedFlair, item);
                return (
                  <button
                    key={item._id}
                    type="button"
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => equipItem(item)}
                    aria-pressed={equipped}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                      equipped
                        ? 'bg-green-600 text-white border-green-600'
                        : 'text-primary-700 border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    {item.name}
                    {equipped ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {ownedItems.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">You don&apos;t own any flair yet — visit the Shop to get started.</p>
      )}

      {/* Saved loadouts */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Saved Loadouts</h3>

        {loadoutError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
            {loadoutError}
          </div>
        )}

        {loadouts.length === 0 && <p className="text-sm text-gray-500 mb-3">No saved loadouts yet.</p>}

        <ul className="space-y-2 mb-4">
          {loadouts.map(loadout => (
            <li key={loadout._id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md">
              {renamingId === loadout._id ? (
                <>
                  <label htmlFor={`rename-loadout-${loadout._id}`} className="sr-only">
                    Loadout name
                  </label>
                  <input
                    id={`rename-loadout-${loadout._id}`}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                  <button type="button" onClick={() => handleRenameLoadout(loadout._id)} className="text-sm font-medium text-primary-700">
                    Save
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-sm text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-900">{loadout.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyLoadout(loadout)}
                      className="text-sm font-medium text-primary-700 hover:text-primary-800"
                    >
                      Apply
                    </button>
                    <button type="button" onClick={() => startRename(loadout)} className="text-sm text-gray-500 hover:text-gray-700">
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoadout(loadout._id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {loadouts.length < MAX_LOADOUTS ? (
          <div className="flex items-center gap-2">
            <label htmlFor="new-loadout-name" className="sr-only">
              Save current look as
            </label>
            <input
              id="new-loadout-name"
              type="text"
              placeholder="Save current look as…"
              value={newLoadoutName}
              onChange={e => setNewLoadoutName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md"
            />
            <button
              type="button"
              onClick={handleSaveLoadout}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
            >
              Save Loadout
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            You&apos;ve saved {MAX_LOADOUTS} loadouts, the maximum for now. Delete one to save a new look.
          </p>
        )}
      </div>
    </div>
  );
};

export default MyFlairSection;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern="MyFlairSection"`
Expected: PASS — all 13 tests.

Note: the "save current look as a new loadout" button is labeled **"Save Loadout"** and the per-loadout rename-confirm button is labeled plain **"Save"** — deliberately different accessible names, since both can be on screen at once (e.g. mid-rename with an unfilled loadout slot still available) and `getByRole('button', { name: /^save$/i })` must stay unambiguous.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/profile/MyFlairSection.tsx client/src/components/profile/__tests__/MyFlairSection.test.tsx
git commit -m "feat(flair): add MyFlairSection profile panel for equip and saved loadouts"
```

---

## Task 13: Wire `MyFlairSection` into `Profile.tsx`

**Files:**
- Modify: `client/src/pages/Profile.tsx`

No new test file: `Profile.tsx` currently has no dedicated test file in this codebase (verify with `ls client/src/pages/__tests__/ | grep -i profile` — if one exists, add a test there instead of skipping verification; as of this plan's writing, there is none, so this task is verified by running the full client suite in Task 14).

- [ ] **Step 1: Add the import and render it for `isOwnProfile`**

In `client/src/pages/Profile.tsx`:

1. Add the import, after the `UserInfoSection` import:

```tsx
import UserInfoSection from '../components/profile/UserInfoSection';
import MyFlairSection from '../components/profile/MyFlairSection';
import PointsSection from '../components/profile/PointsSection';
```

2. Extract the repeated refetch callback and render the section. Replace:

```tsx
      {/* User Info */}
      {user && (
        <UserInfoSection
          user={user}
          isOwnProfile={isOwnProfile}
          onUpdateProfile={updateProfile}
          onRefetchProfile={async () => { await refetchProfileUser(); }}
        />
      )}
```

with:

```tsx
      {/* User Info */}
      {user && (
        <UserInfoSection
          user={user}
          isOwnProfile={isOwnProfile}
          onUpdateProfile={updateProfile}
          onRefetchProfile={refetchProfile}
        />
      )}

      {/* My Flair — equip owned items and manage saved loadouts (own profile only) */}
      {isOwnProfile && <MyFlairSection onRefetchProfile={refetchProfile} />}
```

3. Add the extracted `refetchProfile` callback right above the `if (profileUserLoading || !user)` check (so it's defined once, used by both):

```tsx
  const refetchProfile = React.useCallback(async () => {
    await refetchProfileUser();
  }, [refetchProfileUser]);

  if (profileUserLoading || !user) {
```

- [ ] **Step 2: Run the full client suite**

Run (from `client/`): `npm test -- --watchAll=false`
Expected: PASS — same total pass count as the pre-existing baseline (334) plus every test added in Tasks 9–12 (6 + 4 + 13 = 23 new), i.e. 357 passing, 0 failing.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Profile.tsx
git commit -m "feat(flair): render MyFlairSection on the own profile page"
```

---

## Task 14: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run (from `server/`): `npx jest`
Expected: the same 3 pre-existing failing suites/13 failing tests noted at the top of this plan (`DecisionQuiz.test.js`, `rankedLeagueService.test.js`, `pointsService.test.js`), and every other suite — including `User.shopFlair.test.js`, `flairLoadoutService.test.js`, and `shop.test.js` — passing. No new failures.

- [ ] **Step 2: Run the full frontend suite**

Run (from `client/`): `npm test -- --watchAll=false`
Expected: 100% pass, 0 failures (the frontend baseline had no pre-existing failures).

- [ ] **Step 3: Type-check the frontend**

Run (from `client/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Build the frontend**

Run (from `client/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Review the diff against the design spec**

Run: `git diff main --stat` (or `git log --oneline main..HEAD` to list this plan's commits)
Confirm every item in `## Suggested Fix` of `docs/tech-debt/flair/profile-equip-and-saved-loadouts.md` is addressed:
1. Extracted preview/equip logic (Tasks 9–11) ✓
2. Owner-only "My Flair" section on the profile with equip/unequip and live preview (Tasks 12–13) ✓
3. `flairLoadouts` on `User` + save/rename/delete/apply endpoints, validated, atomic (Tasks 1–7) ✓
4. Loadout selection with one-click apply in the panel (Task 12) ✓
5. Tests: unowned item rejected, retired owned item allowed, cap enforcement (Tasks 3, 6, throughout) ✓

- [ ] **Step 6: No commit needed** — this task only verifies prior commits.
