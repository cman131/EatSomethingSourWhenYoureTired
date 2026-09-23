import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserInfoSection from './UserInfoSection';
import { shopApi } from '../../services/api';

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

  test('renders premium title badge with premium class and emoji', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'Chicken Farmer' },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.getByText('Chicken Farmer').className).toContain('flair-title-chicken');
    expect(screen.getByText('🐔')).toBeInTheDocument();
  });

  test('renders mid-tier title badge with mid-tier class', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: null, nameIcon: null, profileBorder: null, title: 'East Wind' },
    };
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );
    expect(screen.getByText('East Wind').className).toContain('flair-title-mid');
  });

  test('renders standard title badge with default styling', () => {
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
    expect(screen.getByText('Dragon').className).toContain('bg-primary-100');
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

  test('premium name color renders sparkles and keeps the icon outside the gradient span', () => {
    const user = {
      ...baseUser,
      equippedFlair: { nameColor: 'flair-color-neon', nameIcon: '🥷', profileBorder: null, title: null },
    };
    const { container } = render(
      <UserInfoSection
        user={user}
        isOwnProfile={false}
        onUpdateProfile={noopAsync}
        onRefetchProfile={noopAsync}
      />
    );

    const nameEl = screen.getByText('TestPlayer');
    expect(nameEl).toHaveClass('flair-color-neon');
    expect(nameEl).not.toContainElement(screen.getByText('🥷'));
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative sparkles are aria-hidden
    expect(container.querySelectorAll('.flair-sparkle')).toHaveLength(3);
    // eslint-disable-next-line testing-library/no-node-access -- the icon wrapper is an aria-hidden span with no role or text
    expect(screen.getByText('🥷').parentElement).toHaveClass('flair-icon-ninja');
  });
});

describe('UserInfoSection backdrop and showcase', () => {
  const renderSection = (
    user: any,
    { isOwnProfile = false, onUpdateProfile = noopAsync, onRefetchProfile = noopAsync } = {}
  ) =>
    render(
      <UserInfoSection
        user={user}
        isOwnProfile={isOwnProfile}
        onUpdateProfile={onUpdateProfile}
        onRefetchProfile={onRefetchProfile}
      />
    );

  beforeEach(() => {
    jest.spyOn(shopApi, 'getInventory').mockResolvedValue({
      data: { purchasedItems: [], equippedFlair: {}, pointsBalance: 0 },
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows a visitor the pinned showcase entries', () => {
    renderSection({ ...baseUser, favoriteYaku: 'Riichi', showcase: [{ type: 'favoriteYaku' }] });

    expect(screen.getByRole('heading', { name: 'Showcase' })).toBeInTheDocument();
    expect(screen.getByTestId('showcase-entry')).toHaveTextContent('Riichi');
  });

  test('shows a visitor no showcase block when nothing is pinned', () => {
    renderSection({ ...baseUser, showcase: [] });

    expect(screen.queryByRole('heading', { name: 'Showcase' })).not.toBeInTheDocument();
  });

  test('lets the owner edit and saves the showcase through the profile update, then refetches', async () => {
    const onUpdateProfile = jest.fn().mockResolvedValue(undefined);
    const onRefetchProfile = jest.fn().mockResolvedValue(undefined);
    renderSection({ ...baseUser, showcase: [] }, { isOwnProfile: true, onUpdateProfile, onRefetchProfile });

    fireEvent.click(screen.getByRole('button', { name: /edit showcase/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /games won/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(onUpdateProfile).toHaveBeenCalledWith({ showcase: [{ type: 'stat', key: 'gamesWon' }] })
    );
    await waitFor(() => expect(onRefetchProfile).toHaveBeenCalled());
  });
});
