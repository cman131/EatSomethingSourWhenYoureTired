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

  test('renders the icon and the (You) tag outside the gradient name span', () => {
    const user = {
      _id: 'other-user',
      displayName: 'Alice',
      equippedFlair: { nameColor: 'flair-color-fuji', nameIcon: '🦊', profileBorder: null, title: null },
    };

    render(<UserDisplay user={user} showYouIndicator />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-fuji');
    expect(name).not.toContainElement(screen.getByText('🦊'));
    expect(name).not.toContainElement(screen.getByText('(You)'));
  });

  test('premium name colors render sparkles around the name', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'flair-color-neon', nameIcon: null, profileBorder: null, title: null },
    };

    const { container } = render(<UserDisplay user={user} />);

    expect(screen.getByText('Alice')).toHaveClass('flair-color-neon');
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- sparkles are decorative aria-hidden elements with no role or text to query
    expect(container.querySelectorAll('.flair-sparkle')).toHaveLength(3);
  });

  test('keeps the flair color class off the link and on the name span', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'flair-color-pink', nameIcon: null, profileBorder: null, title: null },
    };

    render(<UserDisplay user={user} />);

    expect(screen.getByText('Alice')).toHaveClass('flair-color-pink');
    expect(screen.getByRole('link', { name: 'Alice' })).not.toHaveClass('flair-color-pink');
  });

  test.each([
    ['🐉', 'flair-icon-glow'],
    ['🔥', 'flair-icon-flame'],
  ])('icon %s gets the %s class', (icon, tierClass) => {
    render(
      <UserDisplay user={{ ...baseUser, equippedFlair: { nameColor: null, nameIcon: icon, profileBorder: null, title: null } }} />
    );
    // eslint-disable-next-line testing-library/no-node-access -- the icon wrapper is decorative (aria-hidden), so its tier class is only reachable via the parent
    expect(screen.getByText(icon).parentElement).toHaveClass(tierClass);
  });

  test('renders a new premium title with its badge class', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Tsumo-nami' },
    };

    render(<UserDisplay user={user} />);

    expect(screen.getByText('Tsumo-nami')).toHaveClass('flair-title-tsumonami');
  });
});
