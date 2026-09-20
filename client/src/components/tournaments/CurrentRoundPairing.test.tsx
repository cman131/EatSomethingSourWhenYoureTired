import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import CurrentRoundPairing from './CurrentRoundPairing';
import { AuthProvider } from '../../contexts/AuthContext';
import { Tournament, User } from '../../services/api';

const START_DATE = '2024-01-01T09:00:00.000Z';

function buildTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    _id: 'tournament-1',
    name: 'Test Tournament',
    status: 'InProgress',
    isOnline: false,
    roundDurationMinutes: 90,
    players: [
      { player: { _id: 'user-1', displayName: 'Alice', avatar: null } as any, dropped: false } as any,
      { player: { _id: 'user-2', displayName: 'Bob', avatar: null } as any, dropped: false } as any,
      { player: { _id: 'user-3', displayName: 'Carol', avatar: null } as any, dropped: false } as any,
      { player: { _id: 'user-4', displayName: 'Dave', avatar: null } as any, dropped: false } as any,
    ],
    rounds: [
      {
        roundNumber: 1,
        startDate: START_DATE,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { seat: 'East', player: { _id: 'user-1', displayName: 'Alice', avatar: null } },
              { seat: 'South', player: { _id: 'user-2', displayName: 'Bob', avatar: null } },
              { seat: 'West', player: { _id: 'user-3', displayName: 'Carol', avatar: null } },
              { seat: 'North', player: { _id: 'user-4', displayName: 'Dave', avatar: null } },
            ],
          },
        ],
      } as any,
    ],
    ...overrides,
  } as Tournament;
}

const currentUser: User = {
  _id: 'user-1',
  displayName: 'Alice',
  email: 'alice@example.com',
  avatar: '',
} as User;

function renderPairing(tournament: Tournament) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CurrentRoundPairing tournament={tournament} currentUser={currentUser} />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('CurrentRoundPairing timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('timer is a link to /round-timer with startDate and duration params', () => {
    renderPairing(buildTournament());

    const link = screen.getByRole('link', { name: /time:/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/round-timer'));
    expect(link).toHaveAttribute('href', expect.stringContaining('startDate='));
    expect(link).toHaveAttribute('href', expect.stringContaining('duration=90'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('timer link encodes startDate from the round', () => {
    renderPairing(buildTournament());

    const link = screen.getByRole('link', { name: /time:/i });
    expect(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(START_DATE)));
  });
});
