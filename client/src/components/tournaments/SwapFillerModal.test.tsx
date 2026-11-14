import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwapFillerModal from './SwapFillerModal';
import { Tournament } from '../../services/api';

jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api');
  return {
    ...actual,
    usersApi: { searchUsers: jest.fn() },
    tournamentsApi: { swapFiller: jest.fn() },
  };
});

function buildTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    _id: 'tournament-1',
    name: 'Test Tournament',
    status: 'InProgress',
    isOnline: false,
    isEastOnly: false,
    ruleset: 'WRC2025',
    players: [],
    rounds: [
      {
        roundNumber: 1,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { seat: 'East', player: { _id: 'filler-1', displayName: 'Filler 1', isGuest: true } },
              { seat: 'South', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
              { seat: 'West', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
              { seat: 'North', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
            ],
          },
        ],
      } as any,
      {
        roundNumber: 2,
        pairings: [
          {
            tableNumber: 1,
            game: null,
            players: [
              { seat: 'East', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
              { seat: 'South', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
              { seat: 'West', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
              { seat: 'North', player: { _id: 'user-5', displayName: 'Eve', isGuest: false } },
            ],
          },
        ],
      } as any,
    ],
    ...overrides,
  } as Tournament;
}

function renderModal(tournament: Tournament) {
  return render(
    <SwapFillerModal
      isOpen={true}
      onClose={jest.fn()}
      onSwapped={jest.fn()}
      tournament={tournament}
    />
  );
}

describe('SwapFillerModal round/filler derivation', () => {
  test('shows round 1 (has a filler) but not round 2 (no filler) before a player is picked', () => {
    renderModal(buildTournament());

    expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/round 2/i)).not.toBeInTheDocument();
  });

  test('labels the filler option with its table and seat', () => {
    renderModal(buildTournament());

    expect(screen.getByText(/Filler 1.*Table 1.*East/i)).toBeInTheDocument();
  });

  test('renders nothing selectable when no round has a filler', () => {
    renderModal(buildTournament({
      rounds: [
        {
          roundNumber: 1,
          pairings: [
            {
              tableNumber: 1,
              game: null,
              players: [
                { seat: 'East', player: { _id: 'user-1', displayName: 'Alice', isGuest: false } },
                { seat: 'South', player: { _id: 'user-2', displayName: 'Bob', isGuest: false } },
                { seat: 'West', player: { _id: 'user-3', displayName: 'Carol', isGuest: false } },
                { seat: 'North', player: { _id: 'user-4', displayName: 'Dave', isGuest: false } },
              ],
            },
          ],
        } as any,
      ],
    }));

    expect(screen.getByText(/no filler-occupied seats/i)).toBeInTheDocument();
  });
});
