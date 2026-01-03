import React, { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { tilesApi, usersApi, User, Tile, NotificationPreferences, YAKU_LIST } from '../../services/api';
import { getTileImagePath } from '../../utils/tileUtils';
import NotificationPreferencesModal from '../NotificationPreferencesModal';
import UserAvatar from '../user/UserAvatar';
import { PencilIcon, XMarkIcon, CheckIcon, BellIcon } from '@heroicons/react/24/outline';

interface UserInfoSectionProps {
  user: User;
  isOwnProfile: boolean;
  onUpdateProfile: (userData: any) => Promise<void>;
  onRefetchProfile: () => Promise<void>;
}

const UserInfoSection: React.FC<UserInfoSectionProps> = ({
  user,
  isOwnProfile,
  onUpdateProfile,
  onRefetchProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    avatar: '',
    realName: '',
    discordName: '',
    mahjongSoulName: '',
    favoriteYaku: '',
    favoriteTile: '',
    clubAffiliation: 'Charleston' as 'Charleston' | 'Charlotte' | 'Washington D.C.',
    privateMode: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  // Fetch all tiles for favorite tile selection
  const getTiles = React.useCallback(
    async () => {
      const response = await tilesApi.getTiles();
      return response.data.tiles;
    },
    []
  );

  const { data: tiles } = useApi<Tile[]>(getTiles, []);

  // Initialize form data when user changes or edit mode is enabled
  useEffect(() => {
    if (user && isEditing) {
      setFormData({
        displayName: user.displayName || '',
        avatar: user.avatar || '',
        realName: user.realName || '',
        discordName: user.discordName || '',
        mahjongSoulName: user.mahjongSoulName || '',
        favoriteYaku: user.favoriteYaku || '',
        favoriteTile: user.favoriteTile?._id || '',
        clubAffiliation: (user.clubAffiliation || 'Charleston') as 'Charleston' | 'Charlotte' | 'Washington D.C.',
        privateMode: user.privateMode || false,
      });
    }
  }, [user, isEditing]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    setError(null);
    setSuccess(false);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      await onUpdateProfile({
        ...(user.privateMode ? {} : {
          displayName: formData.displayName.trim(),
          avatar: formData.avatar.trim(),
          realName: formData.realName.trim(),
          discordName: formData.discordName.trim(),
          mahjongSoulName: formData.mahjongSoulName.trim(),
          favoriteYaku: formData.favoriteYaku || null,
          favoriteTile: formData.favoriteTile || null,
          clubAffiliation: formData.clubAffiliation,
        }),
        privateMode: formData.privateMode,
      });
      // Refresh profile user data to reflect the changes
      await onRefetchProfile();
      setSuccess(true);
      setIsEditing(false);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      displayName: user?.displayName || '',
      avatar: user?.avatar || '',
      realName: user?.realName || '',
      discordName: user?.discordName || '',
      mahjongSoulName: user?.mahjongSoulName || '',
      favoriteYaku: user?.favoriteYaku || '',
      favoriteTile: user?.favoriteTile?._id || '',
      clubAffiliation: (user?.clubAffiliation || 'Charleston') as 'Charleston' | 'Charlotte' | 'Washington D.C.',
      privateMode: user?.privateMode || false,
    });
    setError(null);
    setSuccess(false);
  };

  // Handle notification preferences save
  const handleNotificationPreferencesSave = async (preferences: NotificationPreferences) => {
    await usersApi.updateNotificationPreferences(preferences);
    // Update the user object to reflect the changes
    user.notificationPreferences = preferences;
    // Refetch to ensure we have the latest data
    await onRefetchProfile();
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
        {isOwnProfile && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => setIsNotificationModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <BellIcon className="h-4 w-4" />
              Notification Preferences
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-sm text-green-600">Profile updated successfully!</p>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {formData.avatar ? (
                <img
                  src={formData.avatar}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect width="96" height="96" fill="%23e5e7eb"/%3E%3C/svg%3E';
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xs">No avatar</span>
                </div>
              )}
            </div>
            <div className="space-y-4 flex-1">
              {!user?.privateMode && (
                <>
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      value={formData.displayName}
                      onChange={handleChange}
                      className="input-field"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="^[a-zA-Z0-9_]+$"
                      title="Display name can only contain letters, numbers, and underscores"
                    />
                  </div>
                  <div>
                    <label htmlFor="avatar" className="block text-sm font-medium text-gray-700 mb-1">
                      Avatar URL
                    </label>
                    <input
                      id="avatar"
                      name="avatar"
                      type="url"
                      value={formData.avatar}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="https://example.com/avatar.jpg"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter a URL to an image for your avatar
                    </p>
                  </div>
                  <div>
                    <label htmlFor="realName" className="block text-sm font-medium text-gray-700 mb-1">
                      Real Name
                    </label>
                    <input
                      id="realName"
                      name="realName"
                      type="text"
                      value={formData.realName}
                      onChange={handleChange}
                      className="input-field"
                      maxLength={30}
                      placeholder="Your real name (optional)"
                    />
                  </div>
                  <div>
                    <label htmlFor="discordName" className="block text-sm font-medium text-gray-700 mb-1">
                      Discord Name
                    </label>
                    <input
                      id="discordName"
                      name="discordName"
                      type="text"
                      value={formData.discordName}
                      onChange={handleChange}
                      className="input-field"
                      maxLength={30}
                      placeholder="Your Discord username (optional)"
                    />
                  </div>
                  <div>
                    <label htmlFor="mahjongSoulName" className="block text-sm font-medium text-gray-700 mb-1">
                      Mahjong Soul Name
                    </label>
                    <input
                      id="mahjongSoulName"
                      name="mahjongSoulName"
                      type="text"
                      value={formData.mahjongSoulName}
                      onChange={handleChange}
                      className="input-field"
                      maxLength={30}
                      placeholder="Your Mahjong Soul username (optional)"
                    />
                  </div>
                  <div>
                    <label htmlFor="favoriteYaku" className="block text-sm font-medium text-gray-700 mb-1">
                      Favorite Yaku
                    </label>
                    <select
                      id="favoriteYaku"
                      name="favoriteYaku"
                      value={formData.favoriteYaku}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="">None (optional)</option>
                      {YAKU_LIST.map((yaku) => (
                        <option key={yaku} value={yaku}>
                          {yaku}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Select your favorite Yaku from the list
                    </p>
                  </div>
                  <div>
                    <label htmlFor="favoriteTile" className="block text-sm font-medium text-gray-700 mb-1">
                      Favorite Tile
                    </label>
                    <select
                      id="favoriteTile"
                      name="favoriteTile"
                      value={formData.favoriteTile}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="">None (optional)</option>
                      {tiles && tiles.map((tile) => (
                        <option key={tile._id} value={tile._id}>
                          {tile.name}
                        </option>
                      ))}
                    </select>
                    {formData.favoriteTile && tiles && (() => {
                      const selectedTile = tiles.find(t => t._id === formData.favoriteTile);
                      return selectedTile ? (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="inline-block p-2 border-2 border-black-400 rounded-lg">
                            <img
                              src={getTileImagePath(selectedTile.id)}
                              alt={selectedTile.name}
                              className="w-12 h-auto object-contain"
                              title={selectedTile.name}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{selectedTile.name}</span>
                        </div>
                      ) : null;
                    })()}
                    <p className="mt-1 text-xs text-gray-500">
                      Select your favorite tile from the list
                    </p>
                  </div>
                  <div>
                    <label htmlFor="clubAffiliation" className="block text-sm font-medium text-gray-700 mb-1">
                      Club Affiliation
                    </label>
                    <select
                      id="clubAffiliation"
                      name="clubAffiliation"
                      value={formData.clubAffiliation}
                      onChange={handleChange}
                      className="input-field"
                      required
                    >
                      <option value="Charleston">Charleston</option>
                      <option value="Charlotte">Charlotte</option>
                      <option value="Washington D.C.">Washington D.C.</option>
                    </select>
                  </div>
                </>
              )}
              {isOwnProfile && (
                <>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Email:</span>
                    <span className="ml-2 text-gray-900">{user?.email}</span>
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="privateMode"
                      name="privateMode"
                      type="checkbox"
                      checked={formData.privateMode}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="privateMode" className="text-sm font-medium text-gray-700">
                      Private Mode
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 -mt-2">
                    When enabled, your profile will be hidden from other users. Your display name will show as "Hidden" and your profile will not be accessible via direct links.
                  </p>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckIcon className="h-4 w-4" />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Avatar and Display Name */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <UserAvatar
                user={user || { displayName: '', avatar: null }}
                size="xl"
                className="border-2"
              />
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900">{user?.displayName}</h3>
            </div>
          </div>

          {/* Other Information */}
          {(!user.privateMode && (user?.realName || user?.discordName || user?.mahjongSoulName || user?.favoriteYaku || user?.favoriteTile || user?.clubAffiliation || (isOwnProfile && user?.email))) && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {user?.realName && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Real Name</div>
                    <div className="text-base font-medium text-gray-900">{user.realName}</div>
                  </div>
                )}
                {user?.discordName && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Discord Name</div>
                    <div className="text-base font-medium text-gray-900">{user.discordName}</div>
                  </div>
                )}
                {user?.mahjongSoulName && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Mahjong Soul Name</div>
                    <div className="text-base font-medium text-gray-900">{user.mahjongSoulName}</div>
                  </div>
                )}
                {user?.favoriteYaku && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Favorite Yaku</div>
                    <div className="text-base font-medium text-gray-900">{user.favoriteYaku}</div>
                  </div>
                )}
                {user?.favoriteTile && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Favorite Tile</div>
                    <div className="flex items-center gap-3">
                      <div className="inline-block p-2 border-2 border-gray-400 rounded-lg bg-white">
                        <img
                          src={getTileImagePath(user.favoriteTile?.id)}
                          alt={user.favoriteTile.name}
                          className="w-12 h-auto object-contain"
                          title={user.favoriteTile.name}
                        />
                      </div>
                      <div className="text-base font-medium text-gray-900">{user.favoriteTile.name}</div>
                    </div>
                  </div>
                )}
                {user?.clubAffiliation && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Club Affiliation</div>
                    <div className="text-base font-medium text-gray-900">{user.clubAffiliation}</div>
                  </div>
                )}
                {isOwnProfile && user?.email && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</div>
                    <div className="text-base font-medium text-gray-900">{user.email}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notification Preferences Modal */}
      {isOwnProfile && (
        <NotificationPreferencesModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
          onSave={handleNotificationPreferencesSave}
          currentPreferences={user?.notificationPreferences}
        />
      )}
    </div>
  );
};

export default UserInfoSection;

