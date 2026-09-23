# Admin Points Adjustment UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a working UI to search for a club member and adjust their points balance, calling the existing `POST /api/points/admin/adjust` endpoint, entered from an "Adjust Points" link on that member's Profile page.

**Architecture:** A new client-side API method (`pointsApi.adjustBalance`) wraps the existing endpoint. A new page (`AdminPointsAdjustment.tsx`, route `/admin/points`) does admin-gate → user lookup (via `?userId=` deep link or inline debounced search) → balance display → amount/reason form → submit → balance refresh. `Profile.tsx` gets a small admin-only link into that page. `Points.tsx` gets a one-line label change for `admin_adjustment` transactions.

**Tech Stack:** TypeScript, React 18, react-router-dom v6, Jest + React Testing Library (`--watchAll=false`).

---

## Spec

Design doc: `docs/superpowers/specs/2026-09-22-admin-points-adjustment-ui-design.md`

## Task 1: Add `pointsApi.adjustBalance`

**Files:**
- Modify: `client/src/services/api.ts:775-787`

- [ ] **Step 1: Add the method**

In `client/src/services/api.ts`, the `pointsApi` object currently reads:

```ts
export const pointsApi = {
  getSummary: async () => {
    return apiRequest<ApiResponse<PointsSummary>>('/points/me');
  },

  getHistory: async (page = 1, limit = 20) => {
    return apiRequest<ApiResponse<PointsHistory>>(`/points/me/history?page=${page}&limit=${limit}`);
  },

  getConfig: async () => {
    return apiRequest<ApiResponse<PointsConfig>>('/points/config');
  },
};
```

Replace it with:

```ts
export const pointsApi = {
  getSummary: async () => {
    return apiRequest<ApiResponse<PointsSummary>>('/points/me');
  },

  getHistory: async (page = 1, limit = 20) => {
    return apiRequest<ApiResponse<PointsHistory>>(`/points/me/history?page=${page}&limit=${limit}`);
  },

  getConfig: async () => {
    return apiRequest<ApiResponse<PointsConfig>>('/points/config');
  },

  adjustBalance: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
    return apiRequest<ApiResponse<{ message: string }>>('/points/admin/adjust', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    });
  },
};
```

This mirrors every other mutating method in this file (e.g. `usersApi.updateNotificationPreferences` a few hundred lines up) — `apiRequest` already throws `Error(message)` on a non-2xx response, so no extra error handling is needed here. There is no dedicated test file for `services/api.ts` (checked: none of `pointsApi`'s other methods have one either) — this method is exercised through the `AdminPointsAdjustment` page tests in Task 2/3.

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat: add pointsApi.adjustBalance client method"
```

---

## Task 2: Write failing tests for the `AdminPointsAdjustment` page

**Files:**
- Test: `client/src/pages/__tests__/AdminPointsAdjustment.test.tsx`

- [ ] **Step 1: Write the test file**

Create `client/src/pages/__tests__/AdminPointsAdjustment.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPointsAdjustment from '../AdminPointsAdjustment';

jest.mock('react-router-dom', () => ({
  useSearchParams: jest.fn(),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  usersApi: {
    searchUsers: jest.fn(),
    getUser: jest.fn(),
  },
  pointsApi: {
    adjustBalance: jest.fn(),
  },
}));

jest.mock('../../components/user/UserDisplay', () => ({ user }: { user: { displayName: string } }) => (
  <div>{user.displayName}</div>
));

import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi, pointsApi } from '../../services/api';

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUsersApi = usersApi as jest.Mocked<typeof usersApi>;
const mockPointsApi = pointsApi as jest.Mocked<typeof pointsApi>;

function setSearchParams(query = '') {
  mockUseSearchParams.mockReturnValue([new URLSearchParams(query), jest.fn()]);
}

function setAuth(overrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({ user: { _id: 'admin-1', isAdmin: true, ...overrides } });
}

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  _id: 'user-1',
  displayName: 'Alice',
  pointsBalance: 42,
  ...overrides,
});

describe('AdminPointsAdjustment page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSearchParams();
    setAuth();
  });

  test('redirects non-admins away', () => {
    setAuth({ isAdmin: false });

    render(<AdminPointsAdjustment />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  test('shows a search box when there is no userId in the URL', () => {
    render(<AdminPointsAdjustment />);

    expect(screen.getByLabelText(/search for a user/i)).toBeInTheDocument();
  });

  test('searches for users after typing and lists results', async () => {
    mockUsersApi.searchUsers.mockResolvedValue({ success: true, message: '', data: { users: [buildUser()] } } as any);

    render(<AdminPointsAdjustment />);
    fireEvent.change(screen.getByLabelText(/search for a user/i), { target: { value: 'ali' } });

    await waitFor(() => expect(mockUsersApi.searchUsers).toHaveBeenCalledWith('ali', 20));
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  test("selecting a search result loads and displays that user's balance", async () => {
    mockUsersApi.searchUsers.mockResolvedValue({ success: true, message: '', data: { users: [buildUser()] } } as any);
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser({ pointsBalance: 42 }) } } as any);

    render(<AdminPointsAdjustment />);
    fireEvent.change(screen.getByLabelText(/search for a user/i), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByText('Alice'));

    await waitFor(() => expect(mockUsersApi.getUser).toHaveBeenCalledWith('user-1'));
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  test('a userId in the URL skips search and loads that user directly', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser({ pointsBalance: 15 }) } } as any);

    render(<AdminPointsAdjustment />);

    expect(screen.queryByLabelText(/search for a user/i)).not.toBeInTheDocument();
    expect(await screen.findByText('15')).toBeInTheDocument();
  });

  test('submitting a valid amount and reason records the adjustment and refreshes the balance', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser
      .mockResolvedValueOnce({ success: true, message: '', data: { user: buildUser({ pointsBalance: 15 }) } } as any)
      .mockResolvedValueOnce({ success: true, message: '', data: { user: buildUser({ pointsBalance: 65 }) } } as any);
    mockPointsApi.adjustBalance.mockResolvedValue({ success: true, message: 'Adjustment recorded', data: { message: 'Adjustment recorded' } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('15');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Bonus for tournament help' } });
    fireEvent.click(screen.getByRole('button', { name: /record adjustment/i }));

    await waitFor(() =>
      expect(mockPointsApi.adjustBalance).toHaveBeenCalledWith({ userId: 'user-1', amount: 50, reason: 'Bonus for tournament help' })
    );
    expect(await screen.findByText('65')).toBeInTheDocument();
    expect(screen.getByText(/adjustment recorded/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/reason/i) as HTMLTextAreaElement).value).toBe('');
  });

  test('the submit button is disabled when the amount is zero', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Test' } });

    expect(screen.getByRole('button', { name: /record adjustment/i })).toBeDisabled();
  });

  test('the submit button is disabled when the reason is empty', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });

    expect(screen.getByRole('button', { name: /record adjustment/i })).toBeDisabled();
  });

  test('shows the server error message when the adjustment fails', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);
    mockPointsApi.adjustBalance.mockRejectedValue(new Error('Adjustment would drop the balance below zero'));

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-1000' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Correction' } });
    fireEvent.click(screen.getByRole('button', { name: /record adjustment/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Adjustment would drop the balance below zero');
  });

  test('"Change user" clears the selection and returns to search', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.click(screen.getByRole('button', { name: /change user/i }));

    expect(screen.getByLabelText(/search for a user/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="AdminPointsAdjustment"`
Expected: FAIL — `Cannot find module '../AdminPointsAdjustment'` (the page doesn't exist yet).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/__tests__/AdminPointsAdjustment.test.tsx
git commit -m "test: add failing tests for AdminPointsAdjustment page"
```

---

## Task 3: Implement `AdminPointsAdjustment.tsx` and register its route

**Files:**
- Create: `client/src/pages/AdminPointsAdjustment.tsx`
- Modify: `client/src/App.tsx:27-28` (import) and `:52` (route)

- [ ] **Step 1: Create the page**

Create `client/src/pages/AdminPointsAdjustment.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { usersApi, pointsApi, User } from '../services/api';
import UserDisplay from '../components/user/UserDisplay';

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <p role="alert" className="text-red-600 text-center py-4">{message}</p>
);

const AdminPointsAdjustment: React.FC = () => {
  useRequireAuth();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const deepLinkedUserId = searchParams.get('userId');

  const [targetUserId, setTargetUserId] = useState<string | null>(deepLinkedUserId);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadSelectedUser = useCallback(async (userId: string) => {
    setUserLoading(true);
    setUserError(null);
    try {
      const response = await usersApi.getUser(userId);
      setSelectedUser(response.data.user);
    } catch (err: any) {
      setUserError(err.message || 'Failed to load user');
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetUserId) {
      loadSelectedUser(targetUserId);
    } else {
      setSelectedUser(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  useEffect(() => {
    if (targetUserId) {
      return;
    }
    if (searchTerm.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await usersApi.searchUsers(searchTerm, 20);
        setSearchResults(response.data.users);
      } catch (err: any) {
        setSearchError(err.message || 'Failed to search users');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, targetUserId]);

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSelectUser = (result: User) => {
    setSearchTerm('');
    setSearchResults([]);
    setTargetUserId(result._id);
  };

  const handleChangeUser = () => {
    setTargetUserId(null);
    setSelectedUser(null);
    setSearchTerm('');
    setSearchResults([]);
    setAmount('');
    setReason('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const parsedAmount = Number(amount);
  const isValidAmount = amount.trim() !== '' && Number.isInteger(parsedAmount) && parsedAmount !== 0;
  const isValidReason = reason.trim().length > 0 && reason.length <= 500;
  const canSubmit = isValidAmount && isValidReason && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !targetUserId) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await pointsApi.adjustBalance({ userId: targetUserId, amount: parsedAmount, reason: reason.trim() });
      setSubmitSuccess(true);
      setAmount('');
      setReason('');
      await loadSelectedUser(targetUserId);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to record adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Adjust Points</h1>

      {!targetUserId && (
        <div className="card">
          <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-2">
            Search for a user
          </label>
          <input
            id="user-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to search users..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {searchError && <ErrorMessage message={searchError} />}
          {searching ? (
            <p className="text-gray-500 text-center py-4">Searching users...</p>
          ) : searchTerm.trim().length === 0 ? (
            <p className="text-gray-500 text-center py-4">Type a name to search for users</p>
          ) : searchResults.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No users found</p>
          ) : (
            <div className="space-y-2 mt-4">
              {searchResults.map((result) => (
                <button
                  key={result._id}
                  type="button"
                  onClick={() => handleSelectUser(result)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <UserDisplay user={result} size="md" showLink={false} showRealName />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {targetUserId && (
        <div className="card space-y-6">
          {userLoading ? (
            <p className="text-gray-500 text-center py-4">Loading user...</p>
          ) : userError ? (
            <ErrorMessage message={userError} />
          ) : selectedUser ? (
            <>
              <div className="flex items-center justify-between">
                <UserDisplay user={selectedUser} size="lg" showLink={false} showRealName />
                <button type="button" onClick={handleChangeUser} className="btn-secondary">
                  Change user
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-indigo-600">{selectedUser.pointsBalance ?? 0}</p>
              </div>

              {submitSuccess && (
                <p role="status" className="text-green-600 text-center">Adjustment recorded</p>
              )}
              {submitError && <ErrorMessage message={submitError} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50 or -20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Recording...' : 'Record Adjustment'}
                </button>
              </form>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminPointsAdjustment;
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="AdminPointsAdjustment"`
Expected: PASS (all 10 tests).

- [ ] **Step 3: Register the route**

In `client/src/App.tsx`, add the import after the `Points` import (line 27):

```ts
import Points from './pages/Points';
import AdminPointsAdjustment from './pages/AdminPointsAdjustment';
import Shop from './pages/Shop';
```

And add the route right after `/points` (line 52):

```tsx
                <Route path="/points" element={<Points />} />
                <Route path="/admin/points" element={<AdminPointsAdjustment />} />
                <Route path="/shop" element={<Shop />} />
```

- [ ] **Step 4: Typecheck and build**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AdminPointsAdjustment.tsx client/src/App.tsx
git commit -m "feat: add admin points adjustment page at /admin/points"
```

---

## Task 4: Add the "Adjust Points" link to `Profile.tsx`

**Files:**
- Modify: `client/src/pages/Profile.tsx:113-119`
- Test: `client/src/pages/__tests__/Profile.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/__tests__/Profile.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from '../Profile';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: () => jest.fn(),
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

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  usersApi: {
    getUser: jest.fn(),
    getUserGames: jest.fn(),
  },
}));

jest.mock('../../components/profile/StatisticsSection', () => () => <div />);
jest.mock('../../components/profile/GameHistorySection', () => () => <div />);
jest.mock('../../components/profile/HeadToHeadSection', () => () => <div />);
jest.mock('../../components/profile/RecentGamePerformanceSection', () => () => <div />);
jest.mock('../../components/profile/TournamentResultsSection', () => () => <div />);
jest.mock('../../components/profile/UserInfoSection', () => () => <div />);
jest.mock('../../components/profile/MyFlairSection', () => () => <div />);
jest.mock('../../components/profile/PointsSection', () => () => <div />);

import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';

const mockUseParams = useParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const viewedUser = {
  _id: 'user-2',
  displayName: 'Bob',
  privateMode: false,
};

function setup({ currentUser, isAdmin }: { currentUser: Record<string, unknown>; isAdmin: boolean }) {
  mockUseParams.mockReturnValue({ id: 'user-2' });
  mockUseAuth.mockReturnValue({
    user: { _id: currentUser._id, isAdmin, ...currentUser },
    updateProfile: jest.fn(),
  });
  // Profile.tsx calls useApi exactly twice per render, in a fixed order: the profile-user fetch
  // first, then the all-games fetch. Both pass a useCallback-wrapped function, so they can't be
  // told apart by reference or type — alternate by call order instead.
  let callCount = 0;
  mockUseApi.mockImplementation(() => {
    callCount += 1;
    const isProfileCall = callCount % 2 === 1;
    return isProfileCall
      ? { data: viewedUser, loading: false, error: null, refetch: jest.fn() }
      : { data: [], loading: false, error: null, refetch: jest.fn() };
  });
}

describe('Profile page admin points link', () => {
  test('shows an "Adjust Points" link when the viewer is an admin', () => {
    setup({ currentUser: { _id: 'admin-1' }, isAdmin: true });

    render(<Profile />);

    const link = screen.getByRole('link', { name: /adjust points/i });
    expect(link).toHaveAttribute('href', '/admin/points?userId=user-2');
  });

  test('hides the "Adjust Points" link when the viewer is not an admin', () => {
    setup({ currentUser: { _id: 'member-1' }, isAdmin: false });

    render(<Profile />);

    expect(screen.queryByRole('link', { name: /adjust points/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="Profile.test"`
Expected: FAIL — no element with role `link` and name `/adjust points/i` found.

- [ ] **Step 3: Add the link**

In `client/src/pages/Profile.tsx`, the header block currently reads:

```tsx
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isOwnProfile ? 'Profile' : `${user.displayName}'s Profile`}
        </h1>
      </div>
```

Replace it with:

```tsx
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isOwnProfile ? 'Profile' : `${user.displayName}'s Profile`}
        </h1>
        {currentUser?.isAdmin && (
          <Link to={`/admin/points?userId=${profileUserId}`} className="btn-secondary">
            Adjust Points
          </Link>
        )}
      </div>
```

(`Link` is already imported at the top of this file from `react-router-dom`, and `profileUserId` is already computed above.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="Profile.test"`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Profile.tsx client/src/pages/__tests__/Profile.test.tsx
git commit -m "feat: add admin-only Adjust Points link to Profile page"
```

---

## Task 5: Relabel `admin_adjustment` transactions to "Deus Ex Machina"

**Files:**
- Modify: `client/src/pages/Points.tsx:27`
- Modify: `client/src/pages/__tests__/Points.test.tsx`

- [ ] **Step 1: Write the failing test**

In `client/src/pages/__tests__/Points.test.tsx`, add this test inside the top-level `describe('Points page', ...)` block (next to the other `renders the label for ...` test around line 131):

```tsx
  test('renders the label for admin_adjustment as Deus Ex Machina', () => {
    renderLoaded(historyWith([transaction({ _id: 'tx-dem', type: 'admin_adjustment', amount: -10 })]));
    expect(screen.getByText('Deus Ex Machina')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="Points.test"`
Expected: FAIL — "Deus Ex Machina" not found (current label is "Admin Adjustment").

- [ ] **Step 3: Change the label**

In `client/src/pages/Points.tsx`, change:

```ts
  admin_adjustment: 'Admin Adjustment',
```

to:

```ts
  admin_adjustment: 'Deus Ex Machina',
```

This is a display-label-only change — the stored `PointTransaction.type` value (`admin_adjustment`) is untouched everywhere else in the codebase (model, `pointsService.js`, `pointsReconciliation.js`, `pointsHistoryContext.js`, and their tests).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npm test -- --watchAll=false --testPathPattern="Points.test"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Points.tsx client/src/pages/__tests__/Points.test.tsx
git commit -m "feat: relabel admin point adjustments as Deus Ex Machina"
```

---

## Final Verification

- [ ] Run the full client test suite: `cd client && npm test -- --watchAll=false`
  Expected: all tests pass, no regressions.
- [ ] Run the client build: `cd client && npm run build`
  Expected: builds successfully.
- [ ] Manually exercise the flow: start `cd server && npm run dev` and `cd client && npm start`, log in as an admin, visit another member's profile, click "Adjust Points", submit an amount + reason, confirm the balance updates and the transaction appears on that member's `/points` page labeled "Deus Ex Machina".
