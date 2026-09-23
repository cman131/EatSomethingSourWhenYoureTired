import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPointsAdjustment from '../AdminPointsAdjustment';

jest.mock('react-router-dom', () => ({
  useSearchParams: jest.fn(),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  usersApi: {
    searchUsers: jest.fn(),
    getUser: jest.fn(),
  },
  pointsApi: {
    adjustBalance: jest.fn(),
  },
}));

jest.mock('../../components/user/UserDisplay', () => ({ user }: { user: { displayName: string } }) => (
  <div>{user.displayName}</div>
));

import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi, pointsApi } from '../../services/api';

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUsersApi = usersApi as jest.Mocked<typeof usersApi>;
const mockPointsApi = pointsApi as jest.Mocked<typeof pointsApi>;

function setSearchParams(query = '') {
  mockUseSearchParams.mockReturnValue([new URLSearchParams(query), jest.fn()]);
}

function setAuth(overrides: Record<string, unknown> = {}) {
  mockUseAuth.mockReturnValue({ user: { _id: 'admin-1', isAdmin: true, ...overrides } });
}

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  _id: 'user-1',
  displayName: 'Alice',
  pointsBalance: 42,
  ...overrides,
});

describe('AdminPointsAdjustment page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSearchParams();
    setAuth();
  });

  test('redirects non-admins away', () => {
    setAuth({ isAdmin: false });

    render(<AdminPointsAdjustment />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  test('shows a search box when there is no userId in the URL', () => {
    render(<AdminPointsAdjustment />);

    expect(screen.getByLabelText(/search for a user/i)).toBeInTheDocument();
  });

  test('searches for users after typing and lists results', async () => {
    mockUsersApi.searchUsers.mockResolvedValue({ success: true, message: '', data: { users: [buildUser()] } } as any);

    render(<AdminPointsAdjustment />);
    fireEvent.change(screen.getByLabelText(/search for a user/i), { target: { value: 'ali' } });

    await waitFor(() => expect(mockUsersApi.searchUsers).toHaveBeenCalledWith('ali', 20));
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  test("selecting a search result loads and displays that user's balance", async () => {
    mockUsersApi.searchUsers.mockResolvedValue({ success: true, message: '', data: { users: [buildUser()] } } as any);
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser({ pointsBalance: 42 }) } } as any);

    render(<AdminPointsAdjustment />);
    fireEvent.change(screen.getByLabelText(/search for a user/i), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByText('Alice'));

    await waitFor(() => expect(mockUsersApi.getUser).toHaveBeenCalledWith('user-1'));
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  test('a userId in the URL skips search and loads that user directly', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser({ pointsBalance: 15 }) } } as any);

    render(<AdminPointsAdjustment />);

    expect(screen.queryByLabelText(/search for a user/i)).not.toBeInTheDocument();
    expect(await screen.findByText('15')).toBeInTheDocument();
  });

  test('submitting a valid amount and reason records the adjustment and refreshes the balance', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser
      .mockResolvedValueOnce({ success: true, message: '', data: { user: buildUser({ pointsBalance: 15 }) } } as any)
      .mockResolvedValueOnce({ success: true, message: '', data: { user: buildUser({ pointsBalance: 65 }) } } as any);
    mockPointsApi.adjustBalance.mockResolvedValue({ success: true, message: 'Adjustment recorded', data: { message: 'Adjustment recorded' } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('15');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Bonus for tournament help' } });
    fireEvent.click(screen.getByRole('button', { name: /record adjustment/i }));

    await waitFor(() =>
      expect(mockPointsApi.adjustBalance).toHaveBeenCalledWith({ userId: 'user-1', amount: 50, reason: 'Bonus for tournament help' })
    );
    expect(await screen.findByText('65')).toBeInTheDocument();
    expect(screen.getByText(/adjustment recorded/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/reason/i) as HTMLTextAreaElement).value).toBe('');
  });

  test('the submit button is disabled when the amount is zero', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Test' } });

    expect(screen.getByRole('button', { name: /record adjustment/i })).toBeDisabled();
  });

  test('the submit button is disabled when the reason is empty', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });

    expect(screen.getByRole('button', { name: /record adjustment/i })).toBeDisabled();
  });

  test('shows the server error message when the adjustment fails', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);
    mockPointsApi.adjustBalance.mockRejectedValue(new Error('Adjustment would drop the balance below zero'));

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-1000' } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'Correction' } });
    fireEvent.click(screen.getByRole('button', { name: /record adjustment/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Adjustment would drop the balance below zero');
  });

  test('"Change user" clears the selection and returns to search', async () => {
    setSearchParams('userId=user-1');
    mockUsersApi.getUser.mockResolvedValue({ success: true, message: '', data: { user: buildUser() } } as any);

    render(<AdminPointsAdjustment />);
    await screen.findByText('42');

    fireEvent.click(screen.getByRole('button', { name: /change user/i }));

    expect(screen.getByLabelText(/search for a user/i)).toBeInTheDocument();
  });
});
