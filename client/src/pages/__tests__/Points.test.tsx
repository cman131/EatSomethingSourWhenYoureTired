import React from 'react';
import { render, screen } from '@testing-library/react';
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
    { _id: 'tx1', type: 'game_played', amount: 5, metadata: {}, createdAt: '2026-01-01T00:00:00Z' },
    { _id: 'tx2', type: 'game_submitted', amount: 10, metadata: {}, createdAt: '2026-01-02T00:00:00Z' },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

describe('Points page', () => {
  test('shows loading state while fetching', () => {
    useApi
      .mockReturnValueOnce({ data: null, loading: true })
      .mockReturnValueOnce({ data: null, loading: true });

    render(<Points />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows points balance and total earned after load', () => {
    useApi
      .mockReturnValueOnce({ data: { data: mockSummary }, loading: false })
      .mockReturnValueOnce({ data: { data: mockHistory }, loading: false });

    render(<Points />);

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('renders transaction rows for history items', () => {
    useApi
      .mockReturnValueOnce({ data: { data: mockSummary }, loading: false })
      .mockReturnValueOnce({ data: { data: mockHistory }, loading: false });

    render(<Points />);

    expect(screen.getByText('Game Played')).toBeInTheDocument();
    expect(screen.getByText('Game Submitted')).toBeInTheDocument();
  });

  test('shows empty state when no transactions exist', () => {
    useApi
      .mockReturnValueOnce({ data: { data: { balance: 0, totalEarned: 0, recentTransactions: [] } }, loading: false })
      .mockReturnValueOnce({ data: { data: { items: [], total: 0, page: 1, totalPages: 0 } }, loading: false });

    render(<Points />);

    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
