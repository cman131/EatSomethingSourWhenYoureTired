import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi, useApi } from '../hooks/useApi';
import { usersApi, Game, UserStats, User } from '../services/api';
import { Link } from 'react-router-dom';
import { PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

const PlayerSeats = ['East', 'South', 'West', 'North'];

const Profile: React.FC = () => {
  useRequireAuth();
  const { id } = useParams<{ id?: string }>();
  const { user: currentUser, updateProfile } = useAuth();
  
  // Determine which user's profile we're viewing
  const profileUserId = id || currentUser?._id;
  const isOwnProfile = !id || id === currentUser?._id;
  
  // Fetch profile user data if viewing another user's profile
  const getProfileUser = React.useCallback(
    async (): Promise<User> => {
      if (!profileUserId) {
        return Promise.reject(new Error('User ID not available'));
      }
      if (isOwnProfile && currentUser) {
        // Use current user data - return immediately without API call
        return currentUser;
      }
      // Fetch other user's data
      const response = await usersApi.getUser(profileUserId);
      return response.data.user;
    },
    [profileUserId, isOwnProfile, currentUser]
  );

  const { data: profileUser, loading: profileUserLoading } = useApi<User>(
    getProfileUser,
    [profileUserId, isOwnProfile, currentUser?._id]
  );

  // Use profile user for display, fallback to current user
  const user = profileUser || (isOwnProfile ? currentUser : null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ username: '', avatar: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Memoize the API call function to prevent infinite loops
  const getUserGames = React.useCallback(
    (page: number, limit: number) => {
      if (!profileUserId) {
        // Return a rejected promise if user is not available yet
        return Promise.reject(new Error('User not available'));
      }
      return usersApi.getUserGames(profileUserId, page, limit);
    },
    [profileUserId]
  );

  const { data: games, loading: gamesLoading, pagination, loadPage } = usePaginatedApi<Game>(
    getUserGames,
    1,
    10
  );

  const handlePageChange = (page: number) => {
    loadPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch user stats from server
  const getUserStats = React.useCallback(
    async () => {
      if (!profileUserId) {
        return Promise.reject(new Error('User not available'));
      }
      const response = await usersApi.getUserStats(profileUserId);
      return response.data.stats;
    },
    [profileUserId]
  );

  const { data: stats, loading: statsLoading } = useApi<UserStats>(
    getUserStats,
    [user?._id]
  );

  const statsData = stats || {
    totalGames: 0,
    gamesSubmitted: 0,
    gamesPlayed: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
  };

  // Initialize form data when user changes or edit mode is enabled
  React.useEffect(() => {
    if (user && isEditing) {
      setFormData({
        username: user.username || '',
        avatar: user.avatar || '',
      });
    }
  }, [user, isEditing]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      await updateProfile({
        username: formData.username.trim(),
        avatar: formData.avatar.trim(),
      });
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
    setFormData({ username: user?.username || '', avatar: user?.avatar || '' });
    setError(null);
    setSuccess(false);
  };


  if (profileUserLoading || !user) {
    return (
      <div className="space-y-8">
        <p className="text-gray-500 text-center py-8">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isOwnProfile ? 'Profile' : `${user.username}'s Profile`}
        </h1>
      </div>

      {/* User Info */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
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
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    className="input-field"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="^[a-zA-Z0-9_]+$"
                    title="Username can only contain letters, numbers, and underscores"
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
                {isOwnProfile && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Email:</span>
                    <span className="ml-2 text-gray-900">{user?.email}</span>
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>
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
          <div className="flex items-start gap-6">
            {user?.avatar && (
              <div className="flex-shrink-0">
                <img
                  src={user.avatar}
                  alt={`${user.username}'s avatar`}
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="space-y-2 flex-1">
              <div>
                <span className="text-sm font-medium text-gray-700">Username:</span>
                <span className="ml-2 text-gray-900">{user?.username}</span>
              </div>
              {isOwnProfile && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">{user?.email}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h2>
        {statsLoading ? (
          <p className="text-gray-500 text-center py-4">Loading statistics...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">{statsData.totalGames}</div>
              <div className="text-sm text-gray-600">Total Games</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{statsData.gamesSubmitted}</div>
              <div className="text-sm text-gray-600">Games Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{statsData.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{statsData.averageScore}</div>
              <div className="text-sm text-gray-600">Average Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">{statsData.highestScore}</div>
              <div className="text-sm text-gray-600">Highest Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">{statsData.lowestScore}</div>
              <div className="text-sm text-gray-600">Lowest Score</div>
            </div>
          </div>
        )}
      </div>

      {/* Game History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Game History</h2>
        {gamesLoading ? (
          <p className="text-gray-500 text-center py-8">Loading games...</p>
        ) : games && games.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} games
              </span>
            </div>
            <div className="space-y-4">
              {games.map((game: Game) => {
                return (
                  <div
                    key={game._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            to={`/games/${game._id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer"
                          >
                            Game on {new Date(game.gameDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Link>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              game.verified
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {game.verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Submitted by{' '}
                          <Link
                            to={`/profile/${game.submittedBy._id}`}
                            className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {game.submittedBy.username}
                          </Link>
                          {game.verifiedBy && (
                            <>
                              {' '}• Verified by{' '}
                              <Link
                                to={`/profile/${game.verifiedBy._id}`}
                                className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                              >
                                {game.verifiedBy.username}
                              </Link>
                            </>
                          )}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          {game.players
                            .sort((a, b) => b.score - a.score)
                            .map((player) => (
                              <div
                                key={player.player._id}
                                className={`bg-gray-50 rounded-md p-3 ${
                                  player.player._id === profileUserId ? 'ring-2 ring-primary-500' : ''
                                }`}
                              >
                                <div className="text-xs text-gray-500 mb-1">
                                  {PlayerSeats[player.position - 1]}
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  {player.player.avatar && (
                                    <img
                                      src={player.player.avatar}
                                      alt={player.player.username}
                                      className="w-8 h-8 rounded-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  {player.player._id !== profileUserId ?
                                    <Link
                                      to={`/profile/${player.player._id}`}
                                      className="font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors"
                                    >
                                      {player.player.username}
                                    </Link>
                                  : <span className="font-medium text-gray-900">{player.player.username}</span>}
                                </div>
                                <div className="text-sm text-gray-700 mt-1">
                                  Score: <span className="font-semibold">{player.score}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                        {game.notes && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {game.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum = 1;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-md ${
                          pagination.page === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <span className="text-sm text-gray-600 ml-4">
                  Page {pagination.page} of {pagination.pages}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">No games found</p>
        )}
      </div>
    </div>
  );
};

export default Profile;

