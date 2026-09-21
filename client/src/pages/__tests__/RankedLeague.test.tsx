import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RankedLeague from '../RankedLeague';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../services/api', () => ({
  rankedLeaguesApi: {
    getCurrent: jest.fn(),
    joinLeague: jest.fn(),
  },
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../components/user/UserDisplay', () => () => <div />);

import { rankedLeaguesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const mockRankedLeaguesApi = rankedLeaguesApi as jest.Mocked<typeof rankedLeaguesApi>;
const mockUseAuth = useAuth as jest.Mock;

function buildLeague(overrides: object = {}) {
  return {
    _id: 'league-1',
    startDate: new Date().toISOString(),
    rankedGamesThreshold: 3,
    players: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockUseAuth.mockReturnValue({ user: { _id: 'user-1' } });
});

describe('RankedLeague qualification threshold', () => {
  it('keeps players below the league-provided threshold unranked', async () => {
    mockRankedLeaguesApi.getCurrent.mockResolvedValue({
      data: {
        league: buildLeague({
          rankedGamesThreshold: 5,
          players: [{ player: { _id: 'user-2', displayName: 'Other' }, gamesPlayed: 4, rankedPoints: 520 }],
        }),
      },
    } as any);

    render(<RankedLeague />);

    expect(await screen.findByText('No players have qualified yet.')).toBeInTheDocument();
    expect(
      screen.getByText('Less than 5 games — not yet eligible for the leaderboard')
    ).toBeInTheDocument();
  });
});

describe('RankedLeague rules and etiquette', () => {
  it('renders Etiquette and Rules sections once the league has loaded', async () => {
    mockRankedLeaguesApi.getCurrent.mockResolvedValue({
      data: { league: buildLeague() },
    } as any);

    render(<RankedLeague />);

    expect(await screen.findByRole('button', { name: 'Etiquette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
  });

  it('shows the WRC 2025 and penalties links when Rules is expanded', async () => {
    mockRankedLeaguesApi.getCurrent.mockResolvedValue({
      data: { league: buildLeague() },
    } as any);

    render(<RankedLeague />);

    await userEvent.click(await screen.findByRole('button', { name: 'Rules' }));

    expect(screen.getByRole('link', { name: 'WRC 2025' })).toHaveAttribute(
      'href',
      'https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf'
    );
    expect(screen.getByRole('link', { name: /WRC Penalties 2025/ })).toHaveAttribute(
      'href',
      '/penalties'
    );
  });

  it('does not show Rules or Etiquette while the league is loading', async () => {
    mockRankedLeaguesApi.getCurrent.mockReturnValue(new Promise(() => {}));

    render(<RankedLeague />);

    await waitFor(() => {
      expect(screen.getByText('Loading ranked league...')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Rules' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Etiquette' })).not.toBeInTheDocument();
  });
});
