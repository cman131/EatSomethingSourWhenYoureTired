import { renderHook } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/tournaments', search: '' }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require('../../contexts/AuthContext');

describe('useRequireAuth', () => {
  test('redirects to login with a return path once auth finishes loading and the user is unauthenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    renderHook(() => useRequireAuth());

    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Ftournaments');
  });

  test('does not redirect while auth is still loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    renderHook(() => useRequireAuth());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('redirects with the same return path when a previously authenticated session becomes unauthenticated mid-session', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    const { rerender } = renderHook(() => useRequireAuth());

    expect(mockNavigate).not.toHaveBeenCalled();

    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    rerender();

    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Ftournaments');
  });
});
