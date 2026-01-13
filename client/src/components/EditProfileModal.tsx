import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { tilesApi, User, Tile, YAKU_LIST } from '../services/api';
import { getTileImagePath } from '../utils/tileUtils';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: any) => Promise<void>;
  user: User;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
}) => {
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

  // Fetch all tiles for favorite tile selection
  const getTiles = React.useCallback(
    async () => {
      const response = await tilesApi.getTiles();
      return response.data.tiles;
    },
    []
  );

  const { data: tiles } = useApi<Tile[]>(getTiles, []);

  // Initialize form data when modal opens or user changes
  useEffect(() => {
    if (isOpen && user) {
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
      setError(null);
    }
  }, [isOpen, user]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    setError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSave({
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
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleCancel}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Profile</h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

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
                </div>
              </div>
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
