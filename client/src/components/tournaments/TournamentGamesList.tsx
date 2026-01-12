import React from 'react';
import { Link } from 'react-router-dom';
import { Tournament, User, Game } from '../../services/api';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface TournamentGamesListProps {
  tournament: Tournament;
  currentUser: User | null;
}

const TournamentGamesList: React.FC<TournamentGamesListProps> = ({ tournament, currentUser }) => {
  // Get all games the current user played in, ordered by round
  const userGames = React.useMemo(() => {
    if (!currentUser || !tournament || !tournament.rounds) {
      return [];
    }

    const games: Array<{
      game: Game;
      roundNumber: number;
      tableNumber: number;
      seat: string;
      score: number;
      rank: number;
    }> = [];

    // Sort rounds by round number
    const sortedRounds = [...tournament.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

    for (const round of sortedRounds) {
      if (!round.pairings) continue;

      for (const pairing of round.pairings) {
        // Check if current user is in this pairing
        const userPlayerEntry = pairing.players.find((p: any) => {
          const playerId = typeof p.player === 'string' ? p.player : p.player?._id;
          return playerId === currentUser._id;
        });

        if (!userPlayerEntry) continue;

        // Check if pairing has a game
        const game = pairing.game;
        if (!game || game === '') continue;

        // Game can be an ObjectId string or a populated Game object
        let gameObj: Game | null = null;
        if (typeof game === 'object' && game !== null && '_id' in game) {
          gameObj = game as Game;
        } else {
          // If game is just an ID, we can't display it without fetching
          // For now, skip it - ideally the tournament should have games populated
          continue;
        }

        // Find the user's score and rank in the game
        const gamePlayer = gameObj.players.find(
          (gp) => {
            const playerId = typeof gp.player === 'string' ? gp.player : gp.player?._id;
            return playerId === currentUser._id;
          }
        );

        if (!gamePlayer) continue;

        games.push({
          game: gameObj,
          roundNumber: round.roundNumber,
          tableNumber: pairing.tableNumber,
          seat: userPlayerEntry.seat,
          score: gamePlayer.score,
          rank: gamePlayer.rank || gamePlayer.position, // Use rank if available, fallback to position
        });
      }
    }

    return games;
  }, [tournament, currentUser]);

  if (!currentUser) {
    return null;
  }

  if (userGames.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Games</h2>
        <p className="text-gray-500 text-center py-8">No games found</p>
      </div>
    );
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      case 4:
        return '4️⃣';
      default:
        return '';
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-orange-50 border-orange-200';
      case 4:
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Games</h2>
      <div className="space-y-3">
        {userGames.map((gameEntry, index) => (
          <Link
            key={gameEntry.game._id}
            to={`/games/${gameEntry.game._id}`}
            className="block"
          >
            <div
              className={`p-4 rounded-lg border-2 hover:shadow-md transition-shadow ${getRankColor(
                gameEntry.rank
              )}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">
                      Round {gameEntry.roundNumber}
                    </span>
                    <span className="text-sm text-gray-600">
                      Table {gameEntry.tableNumber} • {gameEntry.seat}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4" />
                    {new Date(gameEntry.game.gameDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{getRankEmoji(gameEntry.rank)}</span>
                    <span className="text-lg font-bold text-gray-900">
                      {gameEntry.rank}
                      {gameEntry.rank === 1
                        ? 'st'
                        : gameEntry.rank === 2
                        ? 'nd'
                        : gameEntry.rank === 3
                        ? 'rd'
                        : 'th'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    Score: {gameEntry.score.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TournamentGamesList;
