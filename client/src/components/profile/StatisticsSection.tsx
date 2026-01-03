import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { usersApi, UserStats, User, Game } from '../../services/api';
import UserAvatar from '../user/UserAvatar';

interface StatisticsSectionProps {
  profileUserId: string;
  allGames: Game[] | null;
  allGamesLoading: boolean;
}

const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  profileUserId,
  allGames,
  allGamesLoading,
}) => {
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
    [profileUserId]
  );

  const statsData = stats || {
    gamesWon: 0,
    gamesVerified: 0,
    gamesSubmitted: 0,
    gamesPlayed: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    quizzesRespondedTo: 0,
    commentsMade: 0,
  };

  // Calculate most played with players
  const mostPlayedWith = useMemo(() => {
    if (!allGames || !profileUserId || allGames.length === 0) {
      return [];
    }

    // Map to track player counts and their most recent game date
    const playerCounts = new Map<string, { count: number; mostRecentDate: Date; player: User }>();

    allGames.forEach((game) => {
      const gameDate = new Date(game.gameDate);
      // Find other players in this game (exclude the profile user)
      game.players.forEach((gamePlayer) => {
        if (gamePlayer.player._id !== profileUserId) {
          const playerId = gamePlayer.player._id;
          const existing = playerCounts.get(playerId);
          
          if (existing) {
            existing.count += 1;
            // Update most recent date if this game is more recent
            if (gameDate > existing.mostRecentDate) {
              existing.mostRecentDate = gameDate;
            }
          } else {
            playerCounts.set(playerId, {
              count: 1,
              mostRecentDate: gameDate,
              player: gamePlayer.player,
            });
          }
        }
      });
    });

    // Convert to array and sort by count (descending), then by most recent date (descending)
    const sorted = Array.from(playerCounts.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count; // Higher count first
      }
      return b.mostRecentDate.getTime() - a.mostRecentDate.getTime(); // More recent first
    });

    // If there are ties at the top, limit to most recent 3
    if (sorted.length > 0) {
      const topCount = sorted[0].count;
      const tiedPlayers = sorted.filter(p => p.count === topCount);
      
      if (tiedPlayers.length > 3) {
        // Return the 3 most recent from the tied players
        return tiedPlayers.slice(0, 3).map(p => p.player);
      } else {
        // Return all tied players (up to 3)
        return tiedPlayers.map(p => p.player);
      }
    }

    return [];
  }, [allGames, profileUserId]);
  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h2>
      {statsLoading ? (
        <p className="text-gray-500 text-center py-4">Loading statistics...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600 mb-2">{statsData.gamesWon}</div>
            <div className="text-sm text-gray-600">Games Won</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{statsData.gamesPlayed}</div>
            <div className="text-sm text-gray-600">Games Played</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600 mb-2">{statsData.quizzesRespondedTo}</div>
            <div className="text-sm text-gray-600">Quizzes Completed</div>
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
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{statsData.gamesSubmitted}</div>
            <div className="text-sm text-gray-600">Games Submitted</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">{statsData.gamesVerified}</div>
            <div className="text-sm text-gray-600">Games Verified</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-600 mb-2">{statsData.commentsMade}</div>
            <div className="text-sm text-gray-600">Comments Made</div>
          </div>
          {/* Most Played With */}
          <div className="text-center md:col-span-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Most Played With</div>
            {allGamesLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : mostPlayedWith.length > 0 ? (
              <div className="flex flex-wrap justify-center items-center gap-3">
                {mostPlayedWith.map((player) => (
                  player.privateMode ? (
                    <div
                      key={player._id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md"
                    >
                      <UserAvatar
                        user={player}
                        size="xs"
                        className="w-6 h-6"
                      />
                      <span className="text-sm font-medium text-gray-900">{player.displayName}</span>
                    </div>
                  ) : (
                    <Link
                      key={player._id}
                      to={`/profile/${player._id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      <UserAvatar
                        user={player}
                        size="xs"
                        className="w-6 h-6"
                      />
                      <span className="text-sm font-medium text-gray-900">{player.displayName}</span>
                    </Link>
                  )
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No games played yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsSection;

