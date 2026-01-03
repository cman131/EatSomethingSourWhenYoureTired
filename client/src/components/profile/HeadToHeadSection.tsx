import React, { useMemo } from 'react';
import { Game, User } from '../../services/api';

interface HeadToHeadSectionProps {
  currentUser: User | null;
  profileUserId: string;
  profileUserDisplayName: string;
  allGames: Game[] | null;
  allGamesLoading: boolean;
  isOwnProfile: boolean;
}

const HeadToHeadSection: React.FC<HeadToHeadSectionProps> = ({
  currentUser,
  profileUserId,
  profileUserDisplayName,
  allGames,
  allGamesLoading,
  isOwnProfile,
}) => {
  // Calculate head-to-head statistics
  const headToHeadStats = useMemo(() => {
    if (!allGames || !currentUser || !profileUserId || isOwnProfile) {
      return null;
    }

    // Find games where both players participated
    const gamesTogether = allGames.filter((game) => {
      const hasCurrentUser = game.players.some(p => p.player._id === currentUser._id);
      const hasProfileUser = game.players.some(p => p.player._id === profileUserId);
      return hasCurrentUser && hasProfileUser;
    });

    if (gamesTogether.length === 0) {
      return { gamesTogether: 0 };
    }

    let currentUserWins = 0;
    let profileUserWins = 0;
    let currentUserTotalScore = 0;
    let profileUserTotalScore = 0;
    let currentUserRankings: number[] = [];
    let profileUserRankings: number[] = [];

    gamesTogether.forEach((game) => {
      // Sort players by score to determine ranking
      const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
      
      const currentUserPlayer = game.players.find(p => p.player._id === currentUser._id);
      const profileUserPlayer = game.players.find(p => p.player._id === profileUserId);

      if (currentUserPlayer && profileUserPlayer) {
        // Compare scores
        if (currentUserPlayer.score > profileUserPlayer.score) {
          currentUserWins += 1;
        } else if (profileUserPlayer.score > currentUserPlayer.score) {
          profileUserWins += 1;
        }

        // Accumulate scores
        currentUserTotalScore += currentUserPlayer.score;
        profileUserTotalScore += profileUserPlayer.score;

        // Get rankings
        const currentUserRank = sortedPlayers.findIndex(p => p.player._id === currentUser._id) + 1;
        const profileUserRank = sortedPlayers.findIndex(p => p.player._id === profileUserId) + 1;
        currentUserRankings.push(currentUserRank);
        profileUserRankings.push(profileUserRank);
      }
    });

    const averageScoreDiff = (currentUserTotalScore - profileUserTotalScore) / gamesTogether.length;
    const currentUserAvgRank = currentUserRankings.reduce((a, b) => a + b, 0) / currentUserRankings.length;
    const profileUserAvgRank = profileUserRankings.reduce((a, b) => a + b, 0) / profileUserRankings.length;

    return {
      gamesTogether: gamesTogether.length,
      currentUserWins,
      profileUserWins,
      averageScoreDiff,
      currentUserAvgRank,
      profileUserAvgRank,
    };
  }, [allGames, currentUser, profileUserId, isOwnProfile]);

  // Don't render if it's the user's own profile
  if (isOwnProfile || !currentUser) {
    return null;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Head-to-Head: You vs {profileUserDisplayName}
      </h2>
      {allGamesLoading ? (
        <p className="text-gray-500 text-center py-4">Loading head-to-head statistics...</p>
      ) : headToHeadStats && headToHeadStats.gamesTogether > 0 && 'averageScoreDiff' in headToHeadStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {headToHeadStats.gamesTogether}
            </div>
            <div className="text-sm text-gray-600">Games Together</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {headToHeadStats.currentUserWins}
            </div>
            <div className="text-sm text-gray-600">Your Wins</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {headToHeadStats.profileUserWins}
            </div>
            <div className="text-sm text-gray-600">{profileUserDisplayName}'s Wins</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${
              headToHeadStats.averageScoreDiff! > 0 ? 'text-green-600' : 
              headToHeadStats.averageScoreDiff! < 0 ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {headToHeadStats.averageScoreDiff! > 0 ? '+' : ''}
              {headToHeadStats.averageScoreDiff!.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">Avg Score Difference</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {headToHeadStats.currentUserAvgRank!.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Your Avg Ranking</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              {headToHeadStats.profileUserAvgRank!.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">{profileUserDisplayName}'s Avg Ranking</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No game history between you and {profileUserDisplayName}
          </p>
        </div>
      )}
    </div>
  );
};

export default HeadToHeadSection;

