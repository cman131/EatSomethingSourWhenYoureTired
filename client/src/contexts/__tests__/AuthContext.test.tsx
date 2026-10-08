import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../services/api', () => ({
  authApi: { login: jest.fn(), register: jest.fn() },
  usersApi: { getProfile: jest.fn(), updateProfile: jest.fn() },
  setUnauthorizedHandler: jest.fn(),
}));

const { usersApi, setUnauthorizedHandler } = require('../../services/api');

function Consumer() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? 'in' : 'out'}</div>;
}

describe('AuthContext unauthorized handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('registers logout as the unauthorized handler on mount', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(setUnauthorizedHandler).toHaveBeenCalledTimes(1);
    expect(typeof setUnauthorizedHandler.mock.calls[0][0]).toBe('function');
  });

  test('clears auth state and the stored token when the registered handler fires', async () => {
    localStorage.setItem('authToken', 'token123');
    usersApi.getProfile.mockResolvedValue({
      data: { user: { _id: 'u1', displayName: 'Tester' } },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await screen.findByText('in');

    const registeredHandler = setUnauthorizedHandler.mock.calls[0][0];
    act(() => {
      registeredHandler();
    });

    expect(await screen.findByText('out')).toBeInTheDocument();
    expect(localStorage.getItem('authToken')).toBeNull();
  });
});
