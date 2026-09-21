import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatisticsSection from '../StatisticsSection';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'current-user' } }),
}));

jest.mock('../../../hooks/useApi', () => ({
  useApi: () => ({ data: null, loading: false, error: null }),
}));

const makeGame = (players: any[]) => ({
  _id: 'game1',
  gameDate: new Date().toISOString(),
  players: players.map(p => ({ player: p, score: 100 })),
  verifiedBy: null,
  submittedBy: { _id: 'profile-user', displayName: 'Me', avatar: null },
});

describe('StatisticsSection Most Played With', () => {
  test('renders flair nameColor class for a player with equippedFlair in Most Played With', () => {
    const flairPlayer = {
      _id: 'player1',
      displayName: 'Alice',
      avatar: null,
      privateMode: false,
      equippedFlair: { nameColor: 'text-emerald-600', nameIcon: null, profileBorder: null, title: null },
    };

    const games = [
      makeGame([{ _id: 'profile-user', displayName: 'Me', avatar: null }, flairPlayer]),
    ];

    render(
      <StatisticsSection
        profileUserId="profile-user"
        allGames={games as any}
        allGamesLoading={false}
      />
    );

    const nameEl = screen.getByText('Alice').closest('span, a');
    expect(nameEl?.className).toContain('text-emerald-600');
  });

  test('renders nameIcon emoji for a player with equippedFlair in Most Played With', () => {
    const flairPlayer = {
      _id: 'player1',
      displayName: 'Bob',
      avatar: null,
      privateMode: false,
      equippedFlair: { nameColor: null, nameIcon: '🐉', profileBorder: null, title: null },
    };

    const games = [
      makeGame([{ _id: 'profile-user', displayName: 'Me', avatar: null }, flairPlayer]),
    ];

    render(
      <StatisticsSection
        profileUserId="profile-user"
        allGames={games as any}
        allGamesLoading={false}
      />
    );

    expect(screen.getByText('🐉')).toBeInTheDocument();
  });
});
