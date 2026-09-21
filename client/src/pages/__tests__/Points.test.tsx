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
  let callCount = 0;
  useApi.mockImplementation(() => {
    callCount += 1;
    if (callCount % 2 === 1) {
      return { data: { data: mockSummary }, loading: false };
    }
    return { data: { data: mockHistory }, loading: false };
  });
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

  test('renders raw type key for ranked_league_placement_1 when it appears in history', () => {
    let callCount = 0;
    useApi.mockImplementation(() => {
      callCount += 1;
      if (callCount % 2 === 1) return { data: { data: mockSummary }, loading: false };
      return {
        data: {
          data: {
            items: [{ _id: 'tx-rl', type: 'ranked_league_placement_1', amount: 20, metadata: {}, createdAt: '2026-01-01T00:00:00Z' }],
            total: 1, page: 1, totalPages: 1,
          },
        },
        loading: false,
      };
    });
    render(<Points />);
    expect(screen.getByText('ranked_league_placement_1')).toBeInTheDocument();
    expect(screen.queryByText('Ranked League 1st Place')).not.toBeInTheDocument();
  });

  test('closes the help modal when the X button is clicked', () => {
    renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: /how to earn points/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('How to Earn Points')).not.toBeInTheDocument();
  });
});
