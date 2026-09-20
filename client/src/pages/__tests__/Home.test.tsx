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
  tournamentsApi: { getTournaments: jest.fn() },
  gamesApi: { getGames: jest.fn() },
}));

jest.mock('../../components/user/UserDisplay', () => () => <div />);
jest.mock('@heroicons/react/24/outline', () => ({
  CalculatorIcon: () => null,
}));

const { useAuth } = require('../../contexts/AuthContext');
const { useApi, usePaginatedApi } = require('../../hooks/useApi');

function setupAuthenticatedWithTournaments(tournaments: object[]) {
  useAuth.mockReturnValue({ isAuthenticated: true, user: { displayName: 'Tester' } });
  useApi.mockReturnValue({ data: { data: { items: tournaments } } });
  usePaginatedApi.mockReturnValue({ data: [], loading: false });
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
