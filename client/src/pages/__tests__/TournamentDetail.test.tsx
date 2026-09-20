import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TournamentDetail from '../TournamentDetail';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../../services/api', () => ({
  tournamentsApi: {
    getTournament: jest.fn(),
    getTournamentPublic: jest.fn(),
    signup: jest.fn(),
    drop: jest.fn(),
    dropFromWaitlist: jest.fn(),
    startTournament: jest.fn(),
    endRound: jest.fn(),
    startRound: jest.fn(),
    reconcileActiveRound: jest.fn(),
    updateTournament: jest.fn(),
    addPlayer: jest.fn(),
  },
  gamesApi: { getGame: jest.fn() },
  getRoundLabel: (_roundNumber: number) => `Round ${_roundNumber}`,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../components/ShareButton', () => () => <div data-testid="share-button" />);
jest.mock('../../components/AddressDisplay', () => () => <div />);
jest.mock('../../components/tournaments/Standings', () => () => <div />);
jest.mock('../../components/tournaments/CurrentRoundPairing', () => () => <div />);
jest.mock('../../components/tournaments/EditTournamentModal', () => () => <div />);
jest.mock('../../components/tournaments/TournamentGamesList', () => () => <div />);
jest.mock('../../components/tournaments/AddPlayerModal', () => () => <div />);
jest.mock('../../components/tournaments/DescriptionDisplay', () => () => <div />);
jest.mock('../../components/tournaments/EtiquetteDisplay', () => () => <div />);
jest.mock('../../components/tournaments/RulesDisplay', () => () => <div />);
jest.mock('../../components/user/UserDisplay', () => () => <div />);
jest.mock('@heroicons/react/24/outline', () => ({
  ArrowLeftIcon: () => null,
  CalendarIcon: () => null,
  PencilIcon: () => null,
  TableCellsIcon: () => null,
  UserGroupIcon: () => null,
  ClockIcon: () => null,
  UserPlusIcon: () => null,
}));

import { useParams } from 'react-router-dom';
import { tournamentsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const mockUseParams = useParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockTournamentsApi = tournamentsApi as jest.Mocked<typeof tournamentsApi>;

function buildTournament(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'tournament-1',
    name: 'Test Tournament',
    date: new Date().toISOString(),
    status: 'InProgress',
    players: [],
    waitlist: [],
    rounds: [],
    createdBy: { _id: 'admin-1', displayName: 'Admin' },
    isOnline: false,
    isEastOnly: false,
    ruleset: 'WRC2025',
    roundStrategy: 'Scramble',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseParams.mockReturnValue({ id: 'tournament-1' });
  mockUseAuth.mockReturnValue({
    user: { _id: 'admin-1', isAdmin: true },
    isAuthenticated: true,
  });
});

describe('TournamentDetail End Round button', () => {
  it('does not render End Round button when no rounds have been started', async () => {
    // Tournament is InProgress but has no rounds: currentRoundToEnd will be null.
    // The bug: the button renders whenever !roundToStart, even when currentRoundToEnd is null.
    const tournament = buildTournament({ status: 'InProgress', rounds: [] });
    mockTournamentsApi.getTournament.mockResolvedValue({
      data: { tournament },
    } as any);

    render(<TournamentDetail />);

    // Wait for the tournament to finish loading (title appears), then assert no End Round button.
    await waitFor(() => {
      expect(screen.getByText('Test Tournament')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /end round/i })).not.toBeInTheDocument();
  });

  it('renders End Round button when there is a started round with pairings', async () => {
    // Regression: the button must still appear in the normal case.
    const round = {
      roundNumber: 1,
      pairings: [{ players: [] }],
      startDate: new Date().toISOString(),
    };
    const tournament = buildTournament({ status: 'InProgress', rounds: [round] });
    mockTournamentsApi.getTournament.mockResolvedValue({
      data: { tournament },
    } as any);

    render(<TournamentDetail />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /end round 1/i })).toBeInTheDocument();
    });
  });
});
