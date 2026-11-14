import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwapFillerModal from './SwapFillerModal';
import { AuthProvider } from '../../contexts/AuthContext';
import { Tournament, usersApi, tournamentsApi } from '../../services/api';

jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api');
  return {
    ...actual,
    usersApi: { searchUsers: jest.fn() },
    tournamentsApi: { swapFiller: jest.fn() },
  };
});

const mockedSearchUsers = usersApi.searchUsers as jest.Mock;
const mockedSwapFiller = tournamentsApi.swapFiller as jest.Mock;

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
    <AuthProvider>
      <SwapFillerModal
        isOpen={true}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
        tournament={tournament}
      />
    </AuthProvider>
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

describe('SwapFillerModal player search and submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('excludes a search result who is already registered or waitlisted', async () => {
    mockedSearchUsers.mockResolvedValue({
      data: {
        users: [
          { _id: 'walkin-1', displayName: 'Walkin', isGuest: false },
          { _id: 'registered-1', displayName: 'AlreadyIn', isGuest: false },
          { _id: 'waitlisted-1', displayName: 'OnWaitlist', isGuest: false },
        ],
      },
    });
    renderModal(buildTournament({
      players: [{ player: { _id: 'registered-1' }, dropped: false } as any],
      waitlist: [{ player: { _id: 'waitlisted-1' } } as any],
    }));

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'a' } });
    await screen.findByText('Walkin');

    expect(screen.queryByText('AlreadyIn')).not.toBeInTheDocument();
    expect(screen.queryByText('OnWaitlist')).not.toBeInTheDocument();
  });

  test('submit is disabled until a player is picked and at least one round is mapped', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    renderModal(buildTournament());

    expect(screen.getByRole('button', { name: /swap/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await screen.findByText('Walkin');
    fireEvent.click(screen.getByText('Walkin'));

    expect(screen.getByRole('button', { name: /swap/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });

    expect(screen.getByRole('button', { name: /swap/i })).not.toBeDisabled();
  });

  test('submits the real player id and the mapped round selections', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    const updatedTournament = buildTournament();
    mockedSwapFiller.mockResolvedValue({ data: { tournament: updatedTournament } });
    const onSwapped = jest.fn();
    const onClose = jest.fn();
    render(
      <AuthProvider>
        <SwapFillerModal isOpen={true} onClose={onClose} onSwapped={onSwapped} tournament={buildTournament()} />
      </AuthProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await screen.findByText('Walkin');
    fireEvent.click(screen.getByText('Walkin'));
    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });
    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    await waitFor(() => expect(mockedSwapFiller).toHaveBeenCalledWith('tournament-1', {
      realPlayerId: 'walkin-1',
      roundSelections: [{ roundNumber: 1, fillerId: 'filler-1' }],
    }));
    await waitFor(() => expect(onSwapped).toHaveBeenCalledWith(updatedTournament));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('shows the server error on a failed submit', async () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] } });
    mockedSwapFiller.mockRejectedValue(new Error('Round 1 has some tables already played'));
    renderModal(buildTournament());

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Walk' } });
    await screen.findByText('Walkin');
    fireEvent.click(screen.getByText('Walkin'));
    fireEvent.change(screen.getByLabelText(/round 1/i), { target: { value: 'filler-1' } });
    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    await screen.findByText(/already played/i);
  });

  test('clears a stale search error once a subsequent search succeeds', async () => {
    mockedSearchUsers.mockRejectedValueOnce(new Error('network blip'));
    renderModal(buildTournament());

    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'W' } });
    await screen.findByText(/network blip/i);

    mockedSearchUsers.mockResolvedValueOnce({
      data: { users: [{ _id: 'walkin-1', displayName: 'Walkin', isGuest: false }] },
    });
    fireEvent.change(screen.getByPlaceholderText(/type to search/i), { target: { value: 'Wa' } });
    await screen.findByText('Walkin');

    expect(screen.queryByText(/network blip/i)).not.toBeInTheDocument();
  });
});

describe('SwapFillerModal keyboard interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('closes on Escape key press', () => {
    mockedSearchUsers.mockResolvedValue({ data: { users: [] } });
    const onClose = jest.fn();
    render(
      <AuthProvider>
        <SwapFillerModal isOpen={true} onClose={onClose} onSwapped={jest.fn()} tournament={buildTournament()} />
      </AuthProvider>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
