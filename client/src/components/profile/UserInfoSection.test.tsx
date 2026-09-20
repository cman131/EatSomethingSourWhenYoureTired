import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserInfoSection from './UserInfoSection';

jest.mock('../user/UserAvatar', () => () => <div data-testid="user-avatar" />);
jest.mock('../EditProfileModal', () => () => null);
jest.mock('../NotificationPreferencesModal', () => () => null);
jest.mock('../RiichiMusicModal', () => () => null);
jest.mock('./RiichiMusicDisplay', () => () => null);
jest.mock('../../utils/tileUtils', () => ({ getTileImagePath: () => '/tile.png' }));

const baseUser = {
  _id: 'u1',
  displayName: 'TestPlayer',
  avatar: null,
  privateMode: false,
  equippedFlair: null,
} as any;

const noopAsync = async () => {};

describe('UserInfoSection flair rendering', () => {
  test('renders display name with no flair', () => {
    render(
      <UserInfoSection
        user={baseUser}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.getByText('TestPlayer')).toBeInTheDocument();
  });

  test('applies nameColor class to display name', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'text-emerald-600', nameIcon: null, profileBorder: null, title: null },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    const nameEl = screen.getByText('TestPlayer');
    expect(nameEl.className).toContain('text-emerald-600');
  });

  test('renders nameIcon emoji before display name', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: '🐉', profileBorder: null, title: null },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.getByText('🐉')).toBeInTheDocument();
  });

  test('renders title badge when title is equipped', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Dragon' },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.getByText('Dragon')).toBeInTheDocument();
  });

  test('does not render title badge when title is null', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: null },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.queryByTestId('flair-title-badge')).not.toBeInTheDocument();
  });
});
