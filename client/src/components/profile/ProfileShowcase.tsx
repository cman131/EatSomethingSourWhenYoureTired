import React, { useEffect, useState } from 'react';
import { usersApi, ShowcaseEntry, User, UserStats } from '../../services/api';
import { getTileImagePath } from '../../utils/tileUtils';
import {
  FLAIR_CATEGORY_LABELS,
  SHOWCASE_MAX_ENTRIES,
  SHOWCASE_STAT_LABELS,
  formatStatValue,
  showcaseEntryKey,
} from '../../utils/showcaseUtils';
import FlairSample from '../user/FlairSample';
import ShowcasePicker from './ShowcasePicker';

interface ProfileShowcaseProps {
  user: User;
  isOwnProfile: boolean;
  onSave: (entries: ShowcaseEntry[]) => Promise<void>;
}

type StatsState = { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; stats: UserStats };

// A pinned favorite is only shown while that favorite is still set.
const isDisplayable = (entry: ShowcaseEntry, user: User): boolean => {
  if (entry.type === 'favoriteYaku') {
    return Boolean(user.favoriteYaku);
  }
  if (entry.type === 'favoriteTile') {
    return Boolean(user.favoriteTile);
  }
  return true;
};

const Tile: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div data-testid="showcase-entry" className="bg-gray-50 rounded-lg p-4 border border-gray-200">
    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</div>
    <div className="flex items-center gap-3 text-base font-medium text-gray-900">{children}</div>
  </div>
);

const ProfileShowcase: React.FC<ProfileShowcaseProps> = ({ user, isOwnProfile, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [statsState, setStatsState] = useState<StatsState>({ status: 'loading' });

  const entries = (user.showcase ?? []).filter(entry => isDisplayable(entry, user));
  const hasStatEntry = entries.some(entry => entry.type === 'stat');

  useEffect(() => {
    if (!hasStatEntry) {
      return;
    }
    let cancelled = false;
    const loadStats = async () => {
      try {
        const response = await usersApi.getUserStats(user._id);
        if (!cancelled) {
          setStatsState({ status: 'loaded', stats: response.data.stats });
        }
      } catch {
        if (!cancelled) {
          setStatsState({ status: 'failed' });
        }
      }
    };
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [hasStatEntry, user._id]);

  // Private mode hides the showcase from everyone, the owner included; the server returns it empty.
  if (user.privateMode || (entries.length === 0 && !isOwnProfile)) {
    return null;
  }

  const handleSave = async (nextEntries: ShowcaseEntry[]) => {
    await onSave(nextEntries);
    setEditing(false);
  };

  const renderEntry = (entry: ShowcaseEntry) => {
    switch (entry.type) {
      case 'flair':
        return (
          <Tile key={showcaseEntryKey(entry)} label={FLAIR_CATEGORY_LABELS[entry.category]}>
            <FlairSample category={entry.category} value={entry.value} />
          </Tile>
        );
      case 'favoriteYaku':
        return (
          <Tile key={showcaseEntryKey(entry)} label="Favorite Yaku">
            {user.favoriteYaku}
          </Tile>
        );
      case 'favoriteTile':
        return (
          <Tile key={showcaseEntryKey(entry)} label="Favorite Tile">
            {user.favoriteTile && (
              <>
                <img
                  src={getTileImagePath(user.favoriteTile.id)}
                  alt={user.favoriteTile.name}
                  className="w-10 h-auto object-contain"
                />
                <span>{user.favoriteTile.name}</span>
              </>
            )}
          </Tile>
        );
      case 'stat': {
        const value =
          statsState.status === 'loading'
            ? '…'
            : formatStatValue(entry.key, statsState.status === 'loaded' ? statsState.stats[entry.key] : undefined);
        return (
          <Tile key={showcaseEntryKey(entry)} label={SHOWCASE_STAT_LABELS[entry.key]}>
            {value}
          </Tile>
        );
      }
    }
  };

  return (
    <div className="pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Showcase</h3>
        {isOwnProfile && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Edit showcase
          </button>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{entries.map(renderEntry)}</div>
      ) : (
        <p className="text-sm text-gray-500">
          Pin up to {SHOWCASE_MAX_ENTRIES} things you're proud of: flair you own, your favorites, or your stats.
        </p>
      )}

      {isOwnProfile && editing && (
        <ShowcasePicker user={user} onSave={handleSave} onCancel={() => setEditing(false)} />
      )}
    </div>
  );
};

export default ProfileShowcase;
