import React from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi } from '../hooks/useApi';
import { usersApi, Game } from '../services/api';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';

const Profile: React.FC = () => {
  useRequireAuth();
  const { user } = useAuth();

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
        <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
        <div className="space-y-2">
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

