import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserDisplay from '../UserDisplay';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'other-user' } }),
}));

const baseUser = {
  _id: 'user1',
  displayName: 'Alice',
};

describe('UserDisplay flair rendering', () => {
  test('renders name without flair by default', () => {
    render(<UserDisplay user={baseUser} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  test('applies nameColor CSS class to name when equippedFlair.nameColor is set', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'text-emerald-600', nameIcon: null, profileBorder: null, title: null },
    };

    render(<UserDisplay user={user} />);

    const nameEl = screen.getByText('Alice').closest('span, a');
    expect(nameEl?.className).toContain('text-emerald-600');
  });

  test('renders nameIcon emoji when set', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: '🐉', profileBorder: null, title: null },
    };

    render(<UserDisplay user={user} />);

    expect(screen.getByText('🐉')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  test('applies no extra class when equippedFlair is undefined', () => {
    render(<UserDisplay user={baseUser} />);
    const nameEl = screen.getByText('Alice').closest('span, a');
    expect(nameEl?.className).not.toContain('text-emerald');
  });

  test('renders mid-tier title with silver metallic flair-title-mid class', () => {
    const user = {
      ...baseUser,
      equippedFlair: {
        nameColor: null,
        nameIcon: null,
        profileBorder: null,
        title: 'East Wind',
      },
    };

    render(<UserDisplay user={user} />);

    const badge = document.querySelector('.flair-title-mid');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('East Wind');
  });

  test('renders mid-tier Dragon Slayer title with flair-title-mid class', () => {
    const user = {
      ...baseUser,
      equippedFlair: {
        nameColor: null,
        nameIcon: null,
        profileBorder: null,
        title: 'Dragon Slayer',
      },
    };

    render(<UserDisplay user={user} />);

    const badge = document.querySelector('.flair-title-mid');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Dragon Slayer');
  });
});
