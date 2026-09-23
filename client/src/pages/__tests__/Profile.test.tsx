import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from '../Profile';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: () => jest.fn(),
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

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  usersApi: {
    getUser: jest.fn(),
    getUserGames: jest.fn(),
  },
}));

jest.mock('../../components/profile/StatisticsSection', () => () => <div />);
jest.mock('../../components/profile/GameHistorySection', () => () => <div />);
jest.mock('../../components/profile/HeadToHeadSection', () => () => <div />);
jest.mock('../../components/profile/RecentGamePerformanceSection', () => () => <div />);
jest.mock('../../components/profile/TournamentResultsSection', () => () => <div />);
jest.mock('../../components/profile/UserInfoSection', () => () => <div />);
jest.mock('../../components/profile/MyFlairSection', () => () => <div />);
jest.mock('../../components/profile/PointsSection', () => () => <div />);

import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';

const mockUseParams = useParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseApi = useApi as jest.Mock;

const viewedUser = {
  _id: 'user-2',
  displayName: 'Bob',
  privateMode: false,
};

function setup({ currentUser, isAdmin }: { currentUser: Record<string, unknown>; isAdmin: boolean }) {
  mockUseParams.mockReturnValue({ id: 'user-2' });
  mockUseAuth.mockReturnValue({
    user: { _id: currentUser._id, isAdmin, ...currentUser },
    updateProfile: jest.fn(),
  });
  // Profile.tsx calls useApi exactly twice per render, in a fixed order: the profile-user fetch
  // first, then the all-games fetch. Both pass a useCallback-wrapped function, so they can't be
  // told apart by reference or type — alternate by call order instead.
  let callCount = 0;
  mockUseApi.mockImplementation(() => {
    callCount += 1;
    const isProfileCall = callCount % 2 === 1;
    return isProfileCall
      ? { data: viewedUser, loading: false, error: null, refetch: jest.fn() }
      : { data: [], loading: false, error: null, refetch: jest.fn() };
  });
}

describe('Profile page admin points link', () => {
  test('shows an "Adjust Points" link when the viewer is an admin', () => {
    setup({ currentUser: { _id: 'admin-1' }, isAdmin: true });

    render(<Profile />);

    const link = screen.getByRole('link', { name: /adjust points/i });
    expect(link).toHaveAttribute('href', '/admin/points?userId=user-2');
  });

  test('hides the "Adjust Points" link when the viewer is not an admin', () => {
    setup({ currentUser: { _id: 'member-1' }, isAdmin: false });

    render(<Profile />);

    expect(screen.queryByRole('link', { name: /adjust points/i })).not.toBeInTheDocument();
  });
});
