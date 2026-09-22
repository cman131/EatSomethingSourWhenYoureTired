import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileShowcase from '../ProfileShowcase';
import type { ShopItem, ShowcaseEntry, User } from '../../../services/api';

jest.mock('../../../services/api', () => ({
  usersApi: { getUserStats: jest.fn() },
  shopApi: { getInventory: jest.fn() },
}));
jest.mock('../../../utils/tileUtils', () => ({ getTileImagePath: () => '/tile.png' }));

const { usersApi, shopApi } = require('../../../services/api');

const regularTitle = {
  _id: 'i1', name: 'Regular', description: '', category: 'title', cost: 50,
  value: 'Regular', tier: 'entry', sortOrder: 1, isActive: true,
} as ShopItem;
const fujiBackdrop = {
  _id: 'i2', name: 'Fuji Dawn', description: '', category: 'profileBackdrop', cost: 125,
  value: 'flair-backdrop-fuji', tier: 'mid', sortOrder: 4, isActive: true,
} as ShopItem;

const makeUser = (overrides: Partial<User> = {}): User => ({
  _id: 'u1',
  displayName: 'TestPlayer',
  avatar: '',
  email: '',
  privateMode: false,
  showcase: [],
  ...overrides,
} as User);

const renderShowcase = (
  user: User,
  { isOwnProfile = false, onSave = jest.fn().mockResolvedValue(undefined) } = {}
) => {
  render(<ProfileShowcase user={user} isOwnProfile={isOwnProfile} onSave={onSave} />);
  return { onSave };
};

beforeEach(() => {
  usersApi.getUserStats.mockResolvedValue({ data: { stats: { gamesWon: 12, gamesPlayed: 40, highestScore: 48500, averageScore: 25012.6 } } });
  shopApi.getInventory.mockResolvedValue({
    data: {
      purchasedItems: [
        { item: regularTitle, purchasedAt: '2024-01-01' },
        { item: fujiBackdrop, purchasedAt: '2024-01-02' },
      ],
      equippedFlair: {},
      pointsBalance: 0,
    },
  });
});

describe('ProfileShowcase display', () => {
  test('renders nothing in private mode, even for the owner', () => {
    const user = makeUser({ privateMode: true, showcase: [{ type: 'favoriteYaku' }], favoriteYaku: 'Riichi' });
    const { container } = render(<ProfileShowcase user={user} isOwnProfile onSave={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for a visitor when nothing is pinned', () => {
    const { container } = render(<ProfileShowcase user={makeUser()} isOwnProfile={false} onSave={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('shows a pinned favorite yaku', () => {
    renderShowcase(makeUser({ showcase: [{ type: 'favoriteYaku' }], favoriteYaku: 'Riichi' }));

    const entry = screen.getByTestId('showcase-entry');
    expect(entry).toHaveTextContent('Favorite Yaku');
    expect(entry).toHaveTextContent('Riichi');
  });

  test('shows a pinned favorite tile with its image and name', () => {
    const tile = { id: 'm1', name: 'One Man' } as any;
    renderShowcase(makeUser({ showcase: [{ type: 'favoriteTile' }], favoriteTile: tile }));

    expect(screen.getByRole('img', { name: 'One Man' })).toBeInTheDocument();
  });

  test('skips a favorite pin whose favorite is no longer set', () => {
    renderShowcase(makeUser({ showcase: [{ type: 'favoriteYaku' }], favoriteYaku: null }));

    expect(screen.queryByTestId('showcase-entry')).not.toBeInTheDocument();
  });

  test('shows pinned flair as it renders elsewhere', () => {
    renderShowcase(makeUser({
      showcase: [
        { type: 'flair', category: 'title', value: 'Regular' },
        { type: 'flair', category: 'profileBackdrop', value: 'flair-backdrop-fuji' },
      ],
    }));

    const entries = screen.getAllByTestId('showcase-entry');
    expect(entries).toHaveLength(2);
    expect(within(entries[0]).getByText('Regular')).toBeInTheDocument();
    expect(entries[1].querySelector('.flair-backdrop-fuji')).not.toBeNull();
  });

  test('fetches stats once and shows each pinned stat', async () => {
    renderShowcase(makeUser({
      showcase: [{ type: 'stat', key: 'gamesWon' }, { type: 'stat', key: 'averageScore' }],
    }));

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('25,013')).toBeInTheDocument();
    expect(usersApi.getUserStats).toHaveBeenCalledTimes(1);
    expect(usersApi.getUserStats).toHaveBeenCalledWith('u1');
  });

  test('shows a dash when the stats cannot be loaded', async () => {
    usersApi.getUserStats.mockRejectedValue(new Error('down'));
    renderShowcase(makeUser({ showcase: [{ type: 'stat', key: 'gamesWon' }] }));

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  test('does not fetch stats when no stat is pinned', () => {
    renderShowcase(makeUser({ showcase: [{ type: 'favoriteYaku' }], favoriteYaku: 'Riichi' }));

    expect(usersApi.getUserStats).not.toHaveBeenCalled();
  });
});

describe('ProfileShowcase editing', () => {
  const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /edit showcase/i }));

  test('only the owner sees the edit button', () => {
    renderShowcase(makeUser({ showcase: [{ type: 'favoriteYaku' }], favoriteYaku: 'Riichi' }), { isOwnProfile: false });

    expect(screen.queryByRole('button', { name: /edit showcase/i })).not.toBeInTheDocument();
  });

  test('the owner with an empty showcase gets a prompt and an edit button', () => {
    renderShowcase(makeUser(), { isOwnProfile: true });

    expect(screen.getByText(/pin up to 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit showcase/i })).toBeInTheDocument();
  });

  test('offers owned flair, set favorites and every stat', async () => {
    renderShowcase(makeUser({ favoriteYaku: 'Riichi' }), { isOwnProfile: true });
    openPicker();

    expect(await screen.findByRole('checkbox', { name: /regular/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /fuji dawn/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /favorite yaku/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /favorite tile/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /games won/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /average score/i })).toBeInTheDocument();
  });

  test('starts with the current pins checked and saves the chosen entries', async () => {
    const { onSave } = renderShowcase(
      makeUser({ showcase: [{ type: 'flair', category: 'title', value: 'Regular' }] }),
      { isOwnProfile: true }
    );
    openPicker();

    expect(await screen.findByRole('checkbox', { name: /regular/i })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /games won/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const expected: ShowcaseEntry[] = [
      { type: 'flair', category: 'title', value: 'Regular' },
      { type: 'stat', key: 'gamesWon' },
    ];
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expected));
  });

  test('disables unchecked options once three are pinned', async () => {
    renderShowcase(makeUser(), { isOwnProfile: true });
    openPicker();

    await screen.findByRole('checkbox', { name: /regular/i });
    fireEvent.click(screen.getByRole('checkbox', { name: /regular/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /games won/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /games played/i }));

    expect(screen.getByRole('checkbox', { name: /highest score/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /games won/i })).toBeEnabled();
    expect(screen.getByText(/3 of 3/i)).toBeInTheDocument();
  });

  test('cancel closes the picker without saving', async () => {
    const { onSave } = renderShowcase(makeUser(), { isOwnProfile: true });
    openPicker();
    await screen.findByRole('checkbox', { name: /regular/i });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('checkbox', { name: /regular/i })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('shows the server message and keeps the picker open when saving fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('You do not own a flair item you tried to pin'));
    renderShowcase(makeUser(), { isOwnProfile: true, onSave });
    openPicker();
    fireEvent.click(await screen.findByRole('checkbox', { name: /games won/i }));

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not own/i);
    expect(screen.getByRole('checkbox', { name: /games won/i })).toBeInTheDocument();
  });

  test('shows an error when the owned flair cannot be loaded', async () => {
    shopApi.getInventory.mockRejectedValue(new Error('down'));
    renderShowcase(makeUser(), { isOwnProfile: true });
    openPicker();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});
