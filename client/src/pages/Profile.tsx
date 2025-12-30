import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi, useApi } from '../hooks/useApi';
import { usersApi, Game, UserStats, User, NotificationPreferences } from '../services/api';
import NotificationPreferencesModal from '../components/NotificationPreferencesModal';
import { Link } from 'react-router-dom';
import { PencilIcon, XMarkIcon, CheckIcon, BellIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [formData, setFormData] = useState({ 
    displayName: '', 
    avatar: '',
    realName: '',
    discordName: '',
    mahjongSoulName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

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

  // Fetch last 10 games for performance chart
  const getRecentGames = React.useCallback(
    async () => {
      if (!profileUserId) {
        return Promise.reject(new Error('User not available'));
      }
      const response = await usersApi.getUserGames(profileUserId, 1, 10);
      return response.data.items;
    },
    [profileUserId]
  );

  const { data: recentGames, loading: recentGamesLoading } = useApi<Game[]>(
    getRecentGames,
    [profileUserId]
  );

  // Calculate performance data for chart
  const performanceData = useMemo(() => {
    if (!recentGames || !profileUserId || recentGames.length === 0) {
      return [];
    }

    return recentGames
      .map((game) => {
        // Find the user's player data in this game
        const userPlayer = game.players.find(p => p.player._id === profileUserId);
        if (!userPlayer) return null;

        // Sort players by score (descending) to determine ranking
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        const ranking = sortedPlayers.findIndex(p => p.player._id === profileUserId) + 1;

        return {
          date: new Date(game.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ranking: ranking,
          score: userPlayer.score,
        };
      })
      .filter((item): item is { date: string; ranking: number; score: number } => item !== null)
      .reverse(); // Reverse to show oldest to newest
  }, [recentGames, profileUserId]);

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
    gamesVerified: 0,
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
        displayName: user.displayName || '',
        avatar: user.avatar || '',
        realName: user.realName || '',
        discordName: user.discordName || '',
        mahjongSoulName: user.mahjongSoulName || '',
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
        displayName: formData.displayName.trim(),
        avatar: formData.avatar.trim(),
        realName: formData.realName.trim(),
        discordName: formData.discordName.trim(),
        mahjongSoulName: formData.mahjongSoulName.trim(),
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
    setFormData({ 
      displayName: user?.displayName || '', 
      avatar: user?.avatar || '',
      realName: user?.realName || '',
      discordName: user?.discordName || '',
      mahjongSoulName: user?.mahjongSoulName || ''
    });
    setError(null);
    setSuccess(false);
  };

  // Handle notification preferences save
  const handleNotificationPreferencesSave = async (preferences: NotificationPreferences) => {
    await usersApi.updateNotificationPreferences(preferences);
    user!.notificationPreferences = preferences;
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
          {isOwnProfile ? 'Profile' : `${user.displayName}'s Profile`}
        </h1>
      </div>

      {/* User Info */}
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
          <div className="space-y-4">
            {/* Avatar and Display Name */}
            <div className="flex items-center gap-6">
              {user?.avatar ? (
                <div className="flex-shrink-0">
                  <img
                    src={user.avatar}
                    alt={`${user.displayName}'s avatar`}
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-400 text-xs">No avatar</span>
                </div>
              )}
              <div>
                <h3 className="text-3xl font-bold text-gray-900">{user?.displayName}</h3>
              </div>
            </div>
            
            {/* Other Information */}
            {(user?.realName || user?.discordName || user?.mahjongSoulName || (isOwnProfile && user?.email)) && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                {user?.realName && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Real Name:</span>
                    <span className="ml-2 text-gray-900">{user.realName}</span>
                  </div>
                )}
                {user?.discordName && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Discord Name:</span>
                    <span className="ml-2 text-gray-900">{user.discordName}</span>
                  </div>
                )}
                {user?.mahjongSoulName && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Mahjong Soul Name:</span>
                    <span className="ml-2 text-gray-900">{user.mahjongSoulName}</span>
                  </div>
                )}
                {isOwnProfile && user?.email && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Email:</span>
                    <span className="ml-2 text-gray-900">{user.email}</span>
                  </div>
                )}
              </div>
            )}
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
              <div className="text-3xl font-bold text-blue-600 mb-2">{statsData.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{statsData.gamesSubmitted}</div>
              <div className="text-sm text-gray-600">Games Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">{statsData.gamesVerified}</div>
              <div className="text-sm text-gray-600">Games Verified</div>
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

      {/* Recent Game Performance */}
      {performanceData.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Game Performance</h2>
          {recentGamesLoading ? (
            <p className="text-gray-500 text-center py-8">Loading performance data...</p>
          ) : (
            <div className="w-full" style={{ height: '300px', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    domain={[1, 4]}
                    reversed={true}
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    label={{ value: 'Ranking', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                    ticks={[1, 2, 3, 4]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any, name: any, props: any) => {
                      if (value === undefined || value === null) return '';
                      const rankLabels = ['', '1st', '2nd', '3rd', '4th'];
                      const score = props?.payload?.score;
                      return [
                        `${rankLabels[value] || value}${score ? ` (Score: ${score})` : ''}`,
                        'Ranking'
                      ];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    formatter={(value) => 'Ranking'}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ranking" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 text-center mt-2">
                Lower ranking (1st) is better. Shows your position in the last 10 games.
              </p>
            </div>
          )}
        </div>
      )}

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
                          {game.isEastOnly && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                              East Only
                            </span>
                          )}
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
                            {game.submittedBy.displayName}
                          </Link>
                          {game.verifiedBy && (
                            <>
                              {' '}• Verified by{' '}
                              <Link
                                to={`/profile/${game.verifiedBy._id}`}
                                className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                              >
                                {game.verifiedBy.displayName}
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
                                      alt={player.player.displayName}
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
                                      {player.player.displayName}
                                    </Link>
                                  : <span className="font-medium text-gray-900">{player.player.displayName}</span>}
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

export default Profile;

