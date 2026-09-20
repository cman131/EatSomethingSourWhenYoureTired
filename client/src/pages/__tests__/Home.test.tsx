import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../Home';
import { rankedLeaguesApi, tournamentsApi, gamesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../services/api', () => ({
  rankedLeaguesApi: { getCurrent: jest.fn() },
  tournamentsApi: { getTournaments: jest.fn() },
  gamesApi: { getGames: jest.fn() },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../components/user/UserDisplay', () => ({
  __esModule: true,
  default: ({ user }: { user: { displayName: string } }) => <span>{user.displayName}</span>,
}));

const mockUser = { _id: 'user1', displayName: 'Test User' };

const emptyTournamentsResponse = {
  success: true,
  data: { items: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
};

const emptyGamesResponse = {
  success: true,
  data: { items: [], pagination: { page: 1, limit: 5, total: 0, pages: 0 } },
};

function makeLeague(players: { _id: string; displayName: string; gamesPlayed: number; rankedPoints: number }[], daysAgo = 10) {
  return {
    success: true,
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

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, user: mockUser });
  (tournamentsApi.getTournaments as jest.Mock).mockResolvedValue(emptyTournamentsResponse);
  (gamesApi.getGames as jest.Mock).mockResolvedValue(emptyGamesResponse);
});

describe('Home ranked league card', () => {
  it('shows static "Current Season" while the league API call is pending', () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<Home />);
    expect(screen.getByText('Current Season')).toBeInTheDocument();
  });

  it('shows "Not registered" after load when user is not in the league', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(makeLeague([]));
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Not registered')).toBeInTheDocument();
    });
  });

  it('shows "Join →" link to /ranked when user is not registered', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(makeLeague([]));
    render(<Home />);
    await waitFor(() => {
      const joinLink = screen.getByRole('link', { name: 'Join →' });
      expect(joinLink).toHaveAttribute('href', '/ranked');
    });
  });

  it('shows qualifying status when user has fewer than 6 games', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(
      makeLeague([{ _id: 'user1', displayName: 'Test User', gamesPlayed: 3, rankedPoints: 0 }])
    );
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Qualifying — 3 / 6 games complete')).toBeInTheDocument();
    });
  });

  it('shows ranked status with correct position when user has 6 or more games', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(
      makeLeague([
        { _id: 'other1', displayName: 'Other Player', gamesPlayed: 10, rankedPoints: 200 },
        { _id: 'user1', displayName: 'Test User', gamesPlayed: 8, rankedPoints: 150 },
      ])
    );
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('Ranked — #2 · 8 games played')).toBeInTheDocument();
    });
  });

  it('shows days remaining after league loads', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(makeLeague([], 10));
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText('80 days remaining')).toBeInTheDocument();
    });
  });

  it('does not show days remaining if league fails to load', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<Home />);
    await waitFor(() => {
      expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument();
    });
  });

  it('keeps the "View →" link to /ranked in all states', async () => {
    (rankedLeaguesApi.getCurrent as jest.Mock).mockResolvedValue(makeLeague([]));
    render(<Home />);
    await waitFor(() => {
      const viewLink = screen.getByRole('link', { name: 'View →' });
      expect(viewLink).toHaveAttribute('href', '/ranked');
    });
  });
});
