import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { NotificationPreferences } from '../services/api';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: NotificationPreferences) => Promise<void>;
  currentPreferences?: NotificationPreferences;
}

const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentPreferences,
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotificationsEnabled: true,
    emailNotificationsForComments: true,
    emailNotificationsForNewGames: true,
    emailNotificationsForNewTournaments: true,
    emailNotificationsForRoundPairings: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize preferences when modal opens or currentPreferences change
  useEffect(() => {
    if (isOpen) {
      setPreferences({
        emailNotificationsEnabled: currentPreferences?.emailNotificationsEnabled ?? true,
        emailNotificationsForComments: currentPreferences?.emailNotificationsForComments ?? true,
        emailNotificationsForNewGames: currentPreferences?.emailNotificationsForNewGames ?? true,
        emailNotificationsForNewTournaments: currentPreferences?.emailNotificationsForNewTournaments ?? true,
        emailNotificationsForRoundPairings: currentPreferences?.emailNotificationsForRoundPairings ?? true,
      });
      setError(null);
    }
  }, [isOpen, currentPreferences]);

  const handleChange = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      
      // If emailNotificationsEnabled is turned off, disable all other preferences
      if (key === 'emailNotificationsEnabled' && !value) {
        updated.emailNotificationsForComments = false;
        updated.emailNotificationsForNewGames = false;
        updated.emailNotificationsForNewTournaments = false;
        updated.emailNotificationsForRoundPairings = false;
      }
      
      return updated;
    });
    setError(null);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await onSave(preferences);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
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

            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Manage your email notification preferences. You can enable or disable different types of notifications.
              </p>

              {/* Email Notifications Enabled */}
              <div className="flex items-start justify-between py-3 border-b border-gray-200">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    Email Notifications
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Master switch for all email notifications
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotificationsEnabled ?? true}
                      onChange={(e) => handleChange('emailNotificationsEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>

              {/* Email Notifications For Comments */}
              <div className="flex items-start justify-between py-3 border-b border-gray-200">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    Comments on Games
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Get notified when someone comments on a game you're involved in
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotificationsForComments ?? true}
                      onChange={(e) => handleChange('emailNotificationsForComments', e.target.checked)}
                      disabled={!preferences.emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!preferences.emailNotificationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
              </div>

              {/* Email Notifications For New Games */}
              <div className="flex items-start justify-between py-3 border-b border-gray-200">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    New Games
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Get notified when new games are added to the system
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotificationsForNewGames ?? true}
                      onChange={(e) => handleChange('emailNotificationsForNewGames', e.target.checked)}
                      disabled={!preferences.emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!preferences.emailNotificationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
              </div>

              {/* Email Notifications For New Tournaments */}
              <div className="flex items-start justify-between py-3 border-b border-gray-200">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    New Tournaments
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Get notified when new tournaments are created
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotificationsForNewTournaments ?? true}
                      onChange={(e) => handleChange('emailNotificationsForNewTournaments', e.target.checked)}
                      disabled={!preferences.emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!preferences.emailNotificationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
              </div>

              {/* Email Notifications For Round Pairings */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-900">
                    Tournament Round Pairings
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Get notified when round pairings are generated for tournaments you're in
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotificationsForRoundPairings ?? true}
                      onChange={(e) => handleChange('emailNotificationsForRoundPairings', e.target.checked)}
                      disabled={!preferences.emailNotificationsEnabled}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 ${!preferences.emailNotificationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesModal;

