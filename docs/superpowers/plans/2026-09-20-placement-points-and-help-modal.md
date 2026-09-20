# Placement-Based Game Points & Help Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat game-played points with placement-based awards, lower submit/verify amounts, and add a comprehensive "How to Earn Points" modal to the Points page.

**Architecture:** Add four new `game_placement_1–4` enum values to the `PointTransaction` model, update `awardGamePoints` to read each player's existing `rank` field, then wire a new `PointsHelpModal` component into `Points.tsx` behind a "?" button.

**Tech Stack:** Node.js/Express/Mongoose (backend), TypeScript/React 18/Tailwind CSS (frontend), Jest + React Testing Library (tests).

---

## File Map

| Action | File |
|--------|------|
| Modify | `server/src/models/PointTransaction.js` |
| Modify | `server/src/utils/pointsService.js` |
| Modify | `server/src/utils/pointsService.test.js` |
| Create | `client/src/components/PointsHelpModal.tsx` |
| Create | `client/src/components/__tests__/PointsHelpModal.test.tsx` |
| Modify | `client/src/pages/Points.tsx` |
| Modify | `client/src/pages/__tests__/Points.test.tsx` |

---

## Task 1: Add placement transaction types to PointTransaction model

**Files:**
- Modify: `server/src/models/PointTransaction.js`

- [ ] **Step 1: Add the four new enum values**

In `server/src/models/PointTransaction.js`, replace the `POINT_TRANSACTION_TYPES` array with:

```js
const POINT_TRANSACTION_TYPES = [
  'game_played',       // legacy — kept for existing DB records
  'game_placement_1',
  'game_placement_2',
  'game_placement_3',
  'game_placement_4',
  'game_submitted',
  'game_verified',
  'tournament_participated',
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
  'ranked_league_qualified',
  'ranked_league_placement_1',
  'ranked_league_placement_2',
  'ranked_league_placement_3',
  'ranked_league_placement_4',
  'shop_purchase',
];
```

- [ ] **Step 2: Commit**

```bash
git add server/src/models/PointTransaction.js
git commit -m "feat: add game_placement_1-4 transaction types to PointTransaction enum"
```

---

## Task 2: Update pointsService — TDD

**Files:**
- Modify: `server/src/utils/pointsService.test.js`
- Modify: `server/src/utils/pointsService.js`

- [ ] **Step 1: Replace the `awardGamePoints` describe block in the test file**

In `server/src/utils/pointsService.test.js`, replace the entire `describe('awardGamePoints', ...)` block (lines 98–169) with:

```js
describe('awardGamePoints', () => {
  let p1, p2, p3, p4;

  beforeEach(async () => {
    [p1, p2, p3, p4] = await User.create([
      { displayName: 'test-points-p1', email: 'p1@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p2', email: 'p2@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p3', email: 'p3@example.com', password: 'password123', clubAffiliation: 'Charleston' },
      { displayName: 'test-points-p4', email: 'p4@example.com', password: 'password123', clubAffiliation: 'Charleston' },
    ]);
  });

  test('awards correct placement type and amount to each player', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const cases = [
      { user: p1._id, type: 'game_placement_1', amount: 8 },
      { user: p2._id, type: 'game_placement_2', amount: 5 },
      { user: p3._id, type: 'game_placement_3', amount: 3 },
      { user: p4._id, type: 'game_placement_4', amount: 1 },
    ];

    for (const { user, type, amount } of cases) {
      const tx = await PointTransaction.findOne({ user, type });
      expect(tx).not.toBeNull();
      expect(tx.amount).toBe(amount);
    }
  });

  test('awards game_submitted (+5) to the submitter', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p1._id, type: 'game_submitted' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(5);
  });

  test('awards game_verified (+2) to the verifier', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const tx = await PointTransaction.findOne({ user: p2._id, type: 'game_verified' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toBe(2);
  });

  test('submitter who finishes 1st gets game_placement_1 and game_submitted (total 13)', async () => {
    const game = {
      _id: new mongoose.Types.ObjectId(),
      players: [
        { player: p1._id, rank: 1 },
        { player: p2._id, rank: 2 },
        { player: p3._id, rank: 3 },
        { player: p4._id, rank: 4 },
      ],
      submittedBy: p1._id,
    };

    await awardGamePoints(game, p2._id);

    const updated = await User.findById(p1._id);
    expect(updated.pointsBalance).toBe(13); // 8 (placement_1) + 5 (submitted)
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd server && npx jest utils/pointsService.test.js
```

Expected: failures on the `awardGamePoints` describe block (wrong amounts, `game_placement_*` types not awarded).

- [ ] **Step 3: Implement placement-based awardGamePoints**

Replace the `awardGamePoints` function in `server/src/utils/pointsService.js` with:

```js
const GAME_PLACEMENT_TYPES = {
  1: 'game_placement_1',
  2: 'game_placement_2',
  3: 'game_placement_3',
  4: 'game_placement_4',
};

const GAME_PLACEMENT_AMOUNTS = { 1: 8, 2: 5, 3: 3, 4: 1 };

async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  const playerAwards = game.players.map(({ player, rank }) =>
    awardPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardPoints(game.submittedBy, 'game_submitted', 5, { gameId });
  await awardPoints(verifierId, 'game_verified', 2, { gameId });
}
```

Place `GAME_PLACEMENT_TYPES` and `GAME_PLACEMENT_AMOUNTS` constants just above the `awardGamePoints` function. The `awardPoints` and `spendPoints` functions above it are unchanged. The full file after the edit:

```js
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

async function awardPoints(userId, type, amount, metadata = {}) {
  await PointTransaction.create({ user: userId, type, amount, metadata });
  await User.findByIdAndUpdate(userId, {
    $inc: { pointsBalance: amount, totalPointsEarned: amount },
  });
}

async function spendPoints(userId, amount, metadata = {}) {
  const user = await User.findById(userId).select('pointsBalance');
  if (!user || user.pointsBalance < amount) {
    throw new Error('Insufficient points balance');
  }
  await PointTransaction.create({ user: userId, type: 'shop_purchase', amount: -amount, metadata });
  await User.findByIdAndUpdate(userId, { $inc: { pointsBalance: -amount } });
}

const GAME_PLACEMENT_TYPES = {
  1: 'game_placement_1',
  2: 'game_placement_2',
  3: 'game_placement_3',
  4: 'game_placement_4',
};

const GAME_PLACEMENT_AMOUNTS = { 1: 8, 2: 5, 3: 3, 4: 1 };

async function awardGamePoints(game, verifierId) {
  const gameId = game._id;

  const playerAwards = game.players.map(({ player, rank }) =>
    awardPoints(player, GAME_PLACEMENT_TYPES[rank], GAME_PLACEMENT_AMOUNTS[rank], { gameId })
  );
  await Promise.all(playerAwards);

  await awardPoints(game.submittedBy, 'game_submitted', 5, { gameId });
  await awardPoints(verifierId, 'game_verified', 2, { gameId });
}

const TOURNAMENT_PLACEMENT_TYPES = [
  'tournament_placement_1',
  'tournament_placement_2',
  'tournament_placement_3',
  'tournament_placement_4',
];

async function awardTournamentPoints(tournament) {
  const tournamentId = tournament._id;

  const participantAwards = tournament.players
    .filter(p => !p.dropped)
    .map(p => awardPoints(p.player, 'tournament_participated', 15, { tournamentId }));
  await Promise.all(participantAwards);

  if (Array.isArray(tournament.top4)) {
    const placementAwards = tournament.top4.slice(0, 4).map((playerId, index) => {
      const type = TOURNAMENT_PLACEMENT_TYPES[index];
      const amounts = [40, 30, 20, 10];
      return awardPoints(playerId, type, amounts[index], { tournamentId, placement: index + 1 });
    });
    await Promise.all(placementAwards);
  }
}

module.exports = { awardPoints, spendPoints, awardGamePoints, awardTournamentPoints };
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
cd server && npx jest utils/pointsService.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/pointsService.js server/src/utils/pointsService.test.js
git commit -m "feat: award placement-based points on game verification (1st:8, 2nd:5, 3rd:3, 4th:1); lower submit to 5, verify to 2"
```

---

## Task 3: Create PointsHelpModal — TDD

**Files:**
- Create: `client/src/components/__tests__/PointsHelpModal.test.tsx`
- Create: `client/src/components/PointsHelpModal.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/__tests__/PointsHelpModal.test.tsx`:

```tsx
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PointsHelpModal from '../PointsHelpModal';

describe('PointsHelpModal', () => {
  test('renders the modal heading', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('renders all three section headings', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ranked League' })).toBeInTheDocument();
  });

  test('Games section shows correct point values', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const gamesSection = screen.getByRole('region', { name: 'Games' });
    expect(within(gamesSection).getByText('+8')).toBeInTheDocument();
    expect(within(gamesSection).getByText('+3')).toBeInTheDocument();
    expect(within(gamesSection).getByText('+1')).toBeInTheDocument();
    expect(within(gamesSection).getByText('Submit a game')).toBeInTheDocument();
    expect(within(gamesSection).getByText('Verify a game')).toBeInTheDocument();
  });

  test('Tournaments section shows correct point values', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const tourSection = screen.getByRole('region', { name: 'Tournaments' });
    expect(within(tourSection).getByText('Participate')).toBeInTheDocument();
    expect(within(tourSection).getByText('+15')).toBeInTheDocument();
    expect(within(tourSection).getByText('+40')).toBeInTheDocument();
  });

  test('Ranked League section shows qualify points and coming soon', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const leagueSection = screen.getByRole('region', { name: 'Ranked League' });
    expect(within(leagueSection).getByText('Qualify (join league)')).toBeInTheDocument();
    expect(within(leagueSection).getByText('+10')).toBeInTheDocument();
    expect(within(leagueSection).getByText('Coming soon')).toBeInTheDocument();
  });

  test('calls onClose when the X button is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not call onClose when the modal content is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByText('How to Earn Points'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="PointsHelpModal"
```

Expected: FAIL — `Cannot find module '../PointsHelpModal'`.

- [ ] **Step 3: Create the PointsHelpModal component**

Create `client/src/components/PointsHelpModal.tsx`:

```tsx
import React from 'react';

interface Props {
  onClose: () => void;
}

const GAME_ROWS: [string, string][] = [
  ['1st place', '+8'],
  ['2nd place', '+5'],
  ['3rd place', '+3'],
  ['4th place', '+1'],
  ['Submit a game', '+5'],
  ['Verify a game', '+2'],
];

const TOURNAMENT_ROWS: [string, string][] = [
  ['Participate', '+15'],
  ['1st place', '+40'],
  ['2nd place', '+30'],
  ['3rd place', '+20'],
  ['4th place', '+10'],
];

function PointsTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="min-w-full text-sm">
      <tbody className="divide-y divide-gray-100">
        {rows.map(([label, pts]) => (
          <tr key={label}>
            <td className="py-2 text-gray-700">{label}</td>
            <td className="py-2 text-right font-medium text-green-600">{pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const PointsHelpModal: React.FC<Props> = ({ onClose }) => (
  <div
    data-testid="modal-backdrop"
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">How to Earn Points</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ✕
        </button>
      </div>
      <div className="p-6 space-y-6">
        <section aria-label="Games">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Games</h3>
          <PointsTable rows={GAME_ROWS} />
        </section>
        <section aria-label="Tournaments">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Tournaments</h3>
          <PointsTable rows={TOURNAMENT_ROWS} />
        </section>
        <section aria-label="Ranked League">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Ranked League</h3>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 text-gray-700">Qualify (join league)</td>
                <td className="py-2 text-right font-medium text-green-600">+10</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-700">Season placements</td>
                <td className="py-2 text-right font-medium text-gray-400">Coming soon</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
);

export default PointsHelpModal;
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="PointsHelpModal"
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PointsHelpModal.tsx client/src/components/__tests__/PointsHelpModal.test.tsx
git commit -m "feat: add PointsHelpModal component with game, tournament, and ranked league sections"
```

---

## Task 4: Update Points.tsx and its tests

**Files:**
- Modify: `client/src/pages/Points.tsx`
- Modify: `client/src/pages/__tests__/Points.test.tsx`

- [ ] **Step 1: Update the Points.test.tsx fixture and add modal tests**

Replace the entire contents of `client/src/pages/__tests__/Points.test.tsx` with:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Points from '../Points';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../hooks/useApi', () => ({
  useApi: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  pointsApi: {
    getSummary: jest.fn(),
    getHistory: jest.fn(),
  },
}));

const { useApi } = require('../../hooks/useApi');

const mockSummary = {
  balance: 75,
  totalEarned: 100,
  recentTransactions: [],
};

const mockHistory = {
  items: [
    { _id: 'tx1', type: 'game_placement_1', amount: 8, metadata: {}, createdAt: '2026-01-01T00:00:00Z' },
    { _id: 'tx2', type: 'game_submitted', amount: 5, metadata: {}, createdAt: '2026-01-02T00:00:00Z' },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

function renderLoaded() {
  useApi
    .mockReturnValueOnce({ data: { data: mockSummary }, loading: false })
    .mockReturnValueOnce({ data: { data: mockHistory }, loading: false });
  render(<Points />);
}

describe('Points page', () => {
  test('shows loading state while fetching', () => {
    useApi
      .mockReturnValueOnce({ data: null, loading: true })
      .mockReturnValueOnce({ data: null, loading: true });

    render(<Points />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows points balance and total earned after load', () => {
    renderLoaded();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('renders transaction rows with placement labels', () => {
    renderLoaded();
    expect(screen.getByText('Game 1st Place')).toBeInTheDocument();
    expect(screen.getByText('Game Submitted')).toBeInTheDocument();
  });

  test('shows empty state when no transactions exist', () => {
    useApi
      .mockReturnValueOnce({ data: { data: { balance: 0, totalEarned: 0, recentTransactions: [] } }, loading: false })
      .mockReturnValueOnce({ data: { data: { items: [], total: 0, page: 1, totalPages: 0 } }, loading: false });

    render(<Points />);

    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  test('opens the help modal when the ? button is clicked', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /how to earn points/i }));
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('closes the help modal when the X button is clicked', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /how to earn points/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('How to Earn Points')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Points"
```

Expected: failures on `'Game 1st Place'` not found and modal tests (modal not yet in component).

- [ ] **Step 3: Update Points.tsx**

Replace the entire contents of `client/src/pages/Points.tsx` with:

```tsx
import React, { useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useApi } from '../hooks/useApi';
import { pointsApi, PointsSummary, PointsHistory } from '../services/api';
import PointsHelpModal from '../components/PointsHelpModal';

const POINT_TYPE_LABELS: Record<string, string> = {
  game_played: 'Game Played',
  game_placement_1: 'Game 1st Place',
  game_placement_2: 'Game 2nd Place',
  game_placement_3: 'Game 3rd Place',
  game_placement_4: 'Game 4th Place',
  game_submitted: 'Game Submitted',
  game_verified: 'Game Verified',
  tournament_participated: 'Tournament Participated',
  tournament_placement_1: 'Tournament 1st Place',
  tournament_placement_2: 'Tournament 2nd Place',
  tournament_placement_3: 'Tournament 3rd Place',
  tournament_placement_4: 'Tournament 4th Place',
  ranked_league_qualified: 'Ranked League Qualified',
  ranked_league_placement_1: 'Ranked League 1st Place',
  ranked_league_placement_2: 'Ranked League 2nd Place',
  ranked_league_placement_3: 'Ranked League 3rd Place',
  ranked_league_placement_4: 'Ranked League 4th Place',
  shop_purchase: 'Shop Purchase',
};

const Points: React.FC = () => {
  useRequireAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: summaryResponse, loading: summaryLoading } = useApi<{ data: PointsSummary }>(
    pointsApi.getSummary,
    []
  );

  const { data: historyResponse, loading: historyLoading } = useApi<{ data: PointsHistory }>(
    pointsApi.getHistory,
    []
  );

  if (summaryLoading || historyLoading) {
    return (
      <div className="space-y-8">
        <p className="text-gray-500 text-center py-8">Loading points...</p>
      </div>
    );
  }

  const summary = summaryResponse?.data;
  const history = historyResponse?.data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Club Points</h1>
        <button
          onClick={() => setModalOpen(true)}
          aria-label="How to earn points"
          className="text-gray-400 hover:text-indigo-600 transition-colors text-xl font-bold leading-none"
        >
          ?
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-sm text-gray-500 mb-1">Available Balance</p>
            <p className="text-4xl font-bold text-indigo-600">{summary.balance}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-500 mb-1">Total Earned (Lifetime)</p>
            <p className="text-4xl font-bold text-gray-800">{summary.totalEarned}</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaction History</h2>
        {!history || history.items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.items.map(tx => (
                  <tr key={tx._id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {POINT_TYPE_LABELS[tx.type] ?? tx.type}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && <PointsHelpModal onClose={() => setModalOpen(false)} />}
    </div>
  );
};

export default Points;
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
cd client && npm test -- --watchAll=false --testPathPattern="pages/__tests__/Points"
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full client test suite to check for regressions**

```bash
cd client && npm test -- --watchAll=false
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Points.tsx client/src/pages/__tests__/Points.test.tsx
git commit -m "feat: add placement point labels and How to Earn Points modal to Points page"
```
