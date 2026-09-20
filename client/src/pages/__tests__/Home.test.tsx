import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../Home';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../hooks/useApi', () => ({
  useApi: jest.fn(),
  usePaginatedApi: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  rankedLeaguesApi: { getCurrent: jest.fn() },
  tournamentsApi: { getTournaments: jest.fn() },
  gamesApi: { getGames: jest.fn() },
}));

jest.mock('../../components/user/UserDisplay', () => () => <div />);
jest.mock('@heroicons/react/24/outline', () => ({
  CalculatorIcon: () => null,
}));

const { useAuth } = require('../../contexts/AuthContext');
const { useApi, usePaginatedApi } = require('../../hooks/useApi');

const mockUser = { _id: 'user1', displayName: 'Tester' };

function setupAuthenticatedWithTournaments(tournaments: object[]) {
  useAuth.mockReturnValue({ isAuthenticated: true, user: mockUser });
  useApi.mockReturnValue({ data: { data: { items: tournaments } } });
  usePaginatedApi.mockReturnValue({ data: [], loading: false });
}

function makeLeagueData(players: { _id: string; displayName: string; gamesPlayed: number; rankedPoints: number }[], daysAgo = 10) {
  return {
    data: {
      league: {
        _id: 'league1',
        startDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        players: players.map(p => ({
          player: { _id: p._id, displayName: p.displayName },
          gamesPlayed: p.gamesPlayed,
          rankedPoints: p.rankedPoints,
        })),
        createdAt: '',
        updatedAt: '',
      },
    },
  };
}

// Sets up useApi for both calls: tournaments (first) and league (second)
function setupAuthenticatedWithLeague(leagueData: object | null, loading = false) {
  useAuth.mockReturnValue({ isAuthenticated: true, user: mockUser });
  usePaginatedApi.mockReturnValue({ data: [], loading: false });
  useApi
    .mockReturnValueOnce({ data: { data: { items: [] } } })
    .mockReturnValueOnce({ data: leagueData, loading });
}

describe('Home — authenticated tournament card', () => {
  test('always renders a tournament card when authenticated and no upcoming tournament exists', () => {
    setupAuthenticatedWithTournaments([]);

    render(<Home />);

    expect(screen.getByText('Tournaments')).toBeInTheDocument();
    expect(screen.getByText('No upcoming tournaments')).toBeInTheDocument();
  });

  test('renders tournament name and view details link when an upcoming tournament exists', () => {
    const futureTournament = {
      _id: 'tourney-1',
      name: 'Spring Championship',
      status: 'NotStarted',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: { city: 'Charleston', state: 'SC' },
    };
    setupAuthenticatedWithTournaments([futureTournament]);

    render(<Home />);

    expect(screen.getByText('Spring Championship')).toBeInTheDocument();
    expect(screen.getByText('View details →')).toBeInTheDocument();
    expect(screen.queryByText('No upcoming tournaments')).not.toBeInTheDocument();
  });
});

describe('Home ranked league card', () => {
  test('shows "Current Season" while the league is loading', () => {
    setupAuthenticatedWithLeague(null, true);
    render(<Home />);
    expect(screen.getByText('Current Season')).toBeInTheDocument();
  });

  test('shows "Current Season" when league data is absent', () => {
    setupAuthenticatedWithLeague(null, false);
    render(<Home />);
    expect(screen.getByText('Current Season')).toBeInTheDocument();
  });

  test('shows "Not registered" when user is not in the league', () => {
    setupAuthenticatedWithLeague(makeLeagueData([]));
    render(<Home />);
    expect(screen.getByText('Not registered')).toBeInTheDocument();
  });

  test('shows "Join →" link to /ranked when user is not registered', () => {
    setupAuthenticatedWithLeague(makeLeagueData([]));
    render(<Home />);
    const joinLink = screen.getByRole('link', { name: 'Join →' });
    expect(joinLink).toHaveAttribute('href', '/ranked');
  });

  test('shows qualifying status when user has fewer than 6 games', () => {
    setupAuthenticatedWithLeague(makeLeagueData([
      { _id: 'user1', displayName: 'Tester', gamesPlayed: 3, rankedPoints: 0 },
    ]));
    render(<Home />);
    expect(screen.getByText('Qualifying — 3 / 6 games complete')).toBeInTheDocument();
  });

  test('shows ranked status with correct position when user has 6 or more games', () => {
    setupAuthenticatedWithLeague(makeLeagueData([
      { _id: 'other1', displayName: 'Other Player', gamesPlayed: 10, rankedPoints: 200 },
      { _id: 'user1', displayName: 'Tester', gamesPlayed: 8, rankedPoints: 150 },
    ]));
    render(<Home />);
    expect(screen.getByText('Ranked — #2 · 8 games played')).toBeInTheDocument();
  });

  test('shows days remaining after league loads', () => {
    setupAuthenticatedWithLeague(makeLeagueData([], 10));
    render(<Home />);
    expect(screen.getByText('80 days remaining')).toBeInTheDocument();
  });

  test('does not show days remaining when league is absent', () => {
    setupAuthenticatedWithLeague(null, false);
    render(<Home />);
    expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument();
  });

  test('always shows "View →" link to /ranked', () => {
    setupAuthenticatedWithLeague(makeLeagueData([]));
    render(<Home />);
    const viewLink = screen.getByRole('link', { name: 'View →' });
    expect(viewLink).toHaveAttribute('href', '/ranked');
  });
});
