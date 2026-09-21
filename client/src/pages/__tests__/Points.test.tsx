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
const { pointsApi } = require('../../services/api');

const mockSummary = {
  balance: 75,
  totalEarned: 100,
  recentTransactions: [],
};

const mockHistory = {
  items: [
    { _id: 'tx1', type: 'game_placement_1', amount: 8, metadata: {}, context: null, createdAt: '2026-01-01T00:00:00Z' },
    { _id: 'tx2', type: 'game_submitted', amount: 5, metadata: {}, context: null, createdAt: '2026-01-02T00:00:00Z' },
  ],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
};

type ApiState = { data?: unknown; loading?: boolean; error?: string | null };

// The summary call is identified by its function; anything else is the history call.
function mockApis({ summary, history }: { summary: ApiState; history: ApiState }) {
  useApi.mockImplementation((apiCall: unknown) => {
    const state = apiCall === pointsApi.getSummary ? summary : history;
    return { data: null, loading: false, error: null, ...state };
  });
}

const loaded = (data: unknown): ApiState => ({ data: { data } });

function renderLoaded(history: unknown = mockHistory) {
  mockApis({ summary: loaded(mockSummary), history: loaded(history) });
  render(<Points />);
}

function historyWith(items: unknown[], overrides: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, limit: 20, totalPages: 1, ...overrides };
}

function transaction(overrides: Record<string, unknown>) {
  return {
    _id: 'tx', type: 'game_submitted', amount: 2, metadata: {}, context: null,
    createdAt: '2026-01-01T00:00:00Z', ...overrides,
  };
}

describe('Points page', () => {
  test('shows loading state while fetching the summary', () => {
    mockApis({ summary: { loading: true }, history: { loading: true } });

    render(<Points />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows points balance and total earned after load', () => {
    renderLoaded();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('links to the flair shop to spend points', () => {
    renderLoaded();
    const link = screen.getByRole('link', { name: /flair shop/i });
    expect(link).toHaveAttribute('href', '/shop');
  });

  test('renders transaction rows with placement labels', () => {
    renderLoaded();
    expect(screen.getByText('Game 1st Place')).toBeInTheDocument();
    expect(screen.getByText('Game Submitted')).toBeInTheDocument();
  });

  test('shows empty state when no transactions exist', () => {
    renderLoaded(historyWith([], { totalPages: 0 }));

    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  test('opens the help modal when the ? button is clicked', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /how to earn points/i }));
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('renders the label for ranked_league_placement_1 when it appears in history', () => {
    renderLoaded(historyWith([transaction({ _id: 'tx-rl', type: 'ranked_league_placement_1', amount: 20 })]));
    expect(screen.getByText('Ranked Season 1st Place')).toBeInTheDocument();
  });

  test('closes the help modal when the X button is clicked', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /how to earn points/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('How to Earn Points')).not.toBeInTheDocument();
  });

  describe('loading and error states', () => {
    test('shows an error when the summary fails to load', () => {
      mockApis({ summary: { error: 'Summary exploded' }, history: loaded(mockHistory) });

      render(<Points />);

      expect(screen.getByRole('alert')).toHaveTextContent('Summary exploded');
    });

    test('shows an error in place of the history when it fails to load', () => {
      mockApis({ summary: loaded(mockSummary), history: { error: 'History exploded' } });

      render(<Points />);

      expect(screen.getByRole('alert')).toHaveTextContent('History exploded');
      expect(screen.queryByText(/no transactions/i)).not.toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    test('keeps the balance visible while the history is loading', () => {
      mockApis({ summary: loaded(mockSummary), history: { loading: true } });

      render(<Points />);

      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
      expect(screen.queryByText(/no transactions/i)).not.toBeInTheDocument();
    });
  });

  describe('transaction context', () => {
    test('links a tournament award to the tournament', () => {
      renderLoaded(historyWith([transaction({
        type: 'tournament_placement_1',
        context: { kind: 'tournament', id: 't1', label: 'Spring Open', missing: false },
      })]));

      expect(screen.getByRole('link', { name: 'Spring Open' })).toHaveAttribute('href', '/tournaments/t1');
    });

    test('links a game award to the game', () => {
      renderLoaded(historyWith([transaction({
        type: 'game_placement_2',
        context: { kind: 'game', id: 'g1', label: 'Game played 2026-03-04', missing: false },
      })]));

      expect(screen.getByRole('link', { name: 'Game played 2026-03-04' })).toHaveAttribute('href', '/games/g1');
    });

    test('links a ranked season award to the ranked league', () => {
      renderLoaded(historyWith([transaction({
        type: 'ranked_league_placement_1',
        context: { kind: 'rankedSeason', id: 'r1', label: 'Ranked season starting 2026-01-15', missing: false },
      })]));

      expect(screen.getByRole('link', { name: 'Ranked season starting 2026-01-15' })).toHaveAttribute('href', '/ranked');
    });

    test('links a shop purchase to the shop and shows the item name', () => {
      renderLoaded(historyWith([transaction({
        type: 'shop_purchase',
        amount: -200,
        context: { kind: 'shopItem', id: 'i1', label: 'Jade', missing: false },
      })]));

      expect(screen.getByRole('link', { name: 'Jade' })).toHaveAttribute('href', '/shop');
    });

    test('shows a neutral label without a link when the referenced document was deleted', () => {
      renderLoaded(historyWith([transaction({
        type: 'tournament_participated',
        context: { kind: 'tournament', id: 't-gone', label: null, missing: true },
      })]));

      expect(screen.getByText('Tournament no longer available')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /tournament/i })).not.toBeInTheDocument();
    });

    test('shows no sub-label when a transaction has no context', () => {
      renderLoaded(historyWith([transaction({ type: 'game_submitted', context: null })]));

      expect(screen.queryByRole('link', { name: /game|tournament|season/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/no longer available/i)).not.toBeInTheDocument();
    });
  });

  describe('paging', () => {
    const pagedHistory = (page: number, totalPages: number) =>
      historyWith([transaction({ _id: `tx-${page}` })], { page, totalPages, total: totalPages });

    function latestHistoryCall() {
      const historyCalls = useApi.mock.calls.filter(([apiCall]: [unknown]) => apiCall !== pointsApi.getSummary);
      return historyCalls[historyCalls.length - 1];
    }

    test('hides the pager when everything fits on one page', () => {
      renderLoaded();

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    });

    test('shows the current page and disables Previous on the first page', () => {
      renderLoaded(pagedHistory(1, 3));

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    });

    test('disables Next on the last page', () => {
      renderLoaded(pagedHistory(1, 2));

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
    });

    test('requests the next page when Next is clicked', () => {
      renderLoaded(pagedHistory(1, 3));

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      const [apiCall, deps] = latestHistoryCall();
      expect(deps).toEqual([2]);
      apiCall();
      expect(pointsApi.getHistory).toHaveBeenLastCalledWith(2);
    });

    test('requests the previous page when Previous is clicked', () => {
      renderLoaded(pagedHistory(1, 3));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      fireEvent.click(screen.getByRole('button', { name: /previous/i }));

      const [apiCall, deps] = latestHistoryCall();
      expect(deps).toEqual([1]);
      apiCall();
      expect(pointsApi.getHistory).toHaveBeenLastCalledWith(1);
    });
  });
});
