import React, { useState } from 'react';
import { usersApi, User, NotificationPreferences } from '../../services/api';
import { getTileImagePath } from '../../utils/tileUtils';
import NotificationPreferencesModal from '../NotificationPreferencesModal';
import RiichiMusicModal from '../RiichiMusicModal';
import EditProfileModal from '../EditProfileModal';
import UserAvatar from '../user/UserAvatar';
import { PencilIcon, BellIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isRiichiMusicModalOpen, setIsRiichiMusicModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  // Handle profile save
  const handleProfileSave = async (userData: any) => {
    await onUpdateProfile(userData);
    // Refresh profile user data to reflect the changes
    await onRefetchProfile();
    setSuccess(true);
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  };

  // Handle notification preferences save
  const handleNotificationPreferencesSave = async (preferences: NotificationPreferences) => {
    await usersApi.updateNotificationPreferences(preferences);
    // Update the user object to reflect the changes
    user.notificationPreferences = preferences;
    // Refetch to ensure we have the latest data
    await onRefetchProfile();
  };

  // Handle riichi music save
  const handleRiichiMusicSave = async (spotifyUrl: string | null) => {
    await onUpdateProfile({ riichiMusic: spotifyUrl });
    // Refetch to ensure we have the latest data
    await onRefetchProfile();
  };

  return (
    <>
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
        {isOwnProfile && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => setIsRiichiMusicModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <MusicalNoteIcon className="h-4 w-4" />
              Set Riichi Music
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

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-sm text-green-600">Profile updated successfully!</p>
        </div>
      )}

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

          {/* Riichi Music */}
          {!user?.privateMode && user?.riichiMusic && (() => {
            const trackIdMatch = user.riichiMusic.match(/track\/([a-zA-Z0-9]+)/);
            const trackId = trackIdMatch ? trackIdMatch[1] : null;
            const spotifyUriMatch = user.riichiMusic.match(/spotify:track:([a-zA-Z0-9]+)/);
            const trackIdFromUri = spotifyUriMatch ? spotifyUriMatch[1] : null;
            const finalTrackId = trackId || trackIdFromUri;
            
            return finalTrackId ? (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Riichi Music</h3>
                <div className="max-w-md">
                  <iframe
                    title="Riichi Music"
                    src={`https://open.spotify.com/embed/track/${finalTrackId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-lg"
                  />
                </div>
              </div>
            ) : null;
          })()}

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
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleProfileSave}
          user={user}
        />
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

      {/* Riichi Music Modal */}
      {isOwnProfile && (
        <RiichiMusicModal
          isOpen={isRiichiMusicModalOpen}
          onClose={() => setIsRiichiMusicModalOpen(false)}
          onSave={handleRiichiMusicSave}
          currentRiichiMusic={user?.riichiMusic}
        />
      )}
    </>
  );
};

export default UserInfoSection;

