import React, { useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi } from '../hooks/useApi';
import { usersApi, Game } from '../services/api';
import { Link } from 'react-router-dom';
import { PlusIcon, PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

const Profile: React.FC = () => {
  useRequireAuth();
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ username: '', avatar: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Memoize the API call function to prevent infinite loops
  const getUserGames = React.useCallback(
    (page: number, limit: number) => {
      if (!user?._id) {
        // Return a rejected promise if user is not available yet
        return Promise.reject(new Error('User not available'));
      }
      return usersApi.getUserGames(user._id, page, limit);
    },
    [user?._id]
  );

  const { data: games, loading: gamesLoading, pagination, loadPage } = usePaginatedApi<Game>(
    getUserGames,
    1,
    10
  );

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

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!games || games.length === 0) {
      return {
        totalGames: 0,
        gamesSubmitted: 0,
        gamesPlayed: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
      };
    }

    const gamesSubmitted = games.filter(g => g.submittedBy._id === user!._id).length;
    const gamesPlayed = games.length;
    const allScores = games.flatMap(g => 
      g.players.filter(p => p.player._id === user!._id).map(p => p.score)
    );
    
    const totalScore = allScores.reduce((sum, score) => sum + score, 0);
    const averageScore = allScores.length > 0 ? totalScore / allScores.length : 0;
    const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;

    return {
      totalGames: games.length,
      gamesSubmitted,
      gamesPlayed,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
    };
  }, [games, user]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <Link to="/submit-game" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Submit Game
        </Link>
      </div>

      {/* User Info */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
          {!isEditing && (
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
                <div>
                  <span className="text-sm font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">{user?.email}</span>
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>
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
              <div>
                <span className="text-sm font-medium text-gray-700">Email:</span>
                <span className="ml-2 text-gray-900">{user?.email}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-primary-600 mb-2">{stats.totalGames}</div>
          <div className="text-sm text-gray-600">Total Games</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.gamesSubmitted}</div>
          <div className="text-sm text-gray-600">Games Submitted</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{stats.gamesPlayed}</div>
          <div className="text-sm text-gray-600">Games Played</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">{stats.averageScore}</div>
          <div className="text-sm text-gray-600">Average Score</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-yellow-600 mb-2">{stats.highestScore}</div>
          <div className="text-sm text-gray-600">Highest Score</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-red-600 mb-2">{stats.lowestScore}</div>
          <div className="text-sm text-gray-600">Lowest Score</div>
        </div>
      </div>

      {/* Game History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Game History</h2>
        {gamesLoading ? (
          <p className="text-gray-500 text-center py-4">Loading games...</p>
        ) : games && games.length > 0 ? (
          <>
            <div className="space-y-3">
              {games.map((game: Game) => {
                const userPlayer = game.players.find(p => p.player._id === user!._id);
                return (
                  <div key={game._id} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Game on {new Date(game.gameDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Submitted by {game.submittedBy.username}
                        {userPlayer && ` • Your score: ${userPlayer.score} (Position ${userPlayer.position})`}
                      </p>
                      <div className="text-xs text-gray-600 mt-1">
                        {game.players
                          .sort((a, b) => b.position - a.position)
                          .map(p => `${p.player.username}: ${p.score}`)
                          .join(' • ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        game.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {game.verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {pagination.pages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => loadPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => loadPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-4">No games found</p>
        )}
      </div>
    </div>
  );
};

export default Profile;

