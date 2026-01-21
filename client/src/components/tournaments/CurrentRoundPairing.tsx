import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TableCellsIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Tournament, User } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface CurrentRoundPairingProps {
  tournament: Tournament;
  currentUser: User | null;
}

const CurrentRoundPairing: React.FC<CurrentRoundPairingProps> = ({ tournament, currentUser }) => {
  // Find current user's pairing in the latest round
  const currentPairing = React.useMemo(() => {
    if (!currentUser || !tournament || !tournament.rounds || tournament.status === 'NotStarted') {
      return null;
    }

    // Check if user is in the tournament
    const isInTournament = tournament.players.some(
      p => p.player._id === currentUser._id && !p.dropped
    );
    if (!isInTournament) {
      return null;
    }

    // Find rounds with pairings, sorted by round number (latest first)
    const roundsWithPairings = tournament.rounds
      .filter(r => r.pairings && r.pairings.length > 0)
      .sort((a, b) => b.roundNumber - a.roundNumber);

    if (roundsWithPairings.length === 0) {
      return null;
    }

    // Find pairing in the latest round
    for (const round of roundsWithPairings) {
      const pairing = round.pairings.find((p: any) =>
        p.players.some((playerEntry: any) => 
          playerEntry.player && (typeof playerEntry.player === 'string' 
            ? playerEntry.player === currentUser._id 
            : playerEntry.player._id === currentUser._id)
        )
      );

      if (pairing) {
        return {
          pairing,
          round: round.roundNumber
        };
      }
    }

    return null;
  }, [currentUser, tournament]);

  // Calculate time remaining in round
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!currentPairing) {
      setTimeRemaining(null);
      return;
    }

    // Don't calculate remaining time for online tournaments
    if (tournament.isOnline) {
      setTimeRemaining(null);
      return;
    }

    // Find the round object to get its startDate
    const round = tournament.rounds?.find((r: any) => r.roundNumber === currentPairing.round);
    
    if (!round || !(round as any).startDate) {
      setTimeRemaining(null);
      return;
    }

    // Calculate the projected end time (startDate + 90 minutes)
    const roundStart = new Date((round as any).startDate);
    const projectedEnd = new Date(roundStart.getTime() + tournament.roundDurationMinutes! * 60 * 1000);
    
    // Check if pairing has a game (round is complete)
    const game = currentPairing.pairing.game;
    const hasGame = game != null && game !== '';
    
    if (hasGame && typeof game === 'object' && game !== null && 'gameDate' in game) {
      // Game is submitted - calculate time remaining from game datetime to projected end
      const gameDate = new Date((game as any).gameDate);
      const remaining = projectedEnd.getTime() - gameDate.getTime();
      setTimeRemaining(remaining);
      // Don't set up interval - timer is static when game is submitted
      return;
    }

    // No game submitted - calculate time remaining from now to projected end
    const updateTimer = () => {
      const now = new Date();
      const remaining = projectedEnd.getTime() - now.getTime();
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentPairing, tournament]);

  // Format time remaining
  const formatTimeRemaining = (milliseconds: number): string => {
    const isNegative = milliseconds < 0;
    const absMs = Math.abs(milliseconds);
    const totalSeconds = Math.floor(absMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const sign = isNegative ? '-' : '';
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get game ID for linking and check verification status
  const game = currentPairing?.pairing.game;
  const hasGame = game != null && game !== '';
  const gameIsPopulated = hasGame && typeof game === 'object' && game !== null;
  const gameId = gameIsPopulated && '_id' in game 
    ? (game as any)._id 
    : (typeof game === 'string' ? game : game?.toString());
  // Only show verified status if game is populated (has verified property)
  // If not populated, we can't determine status, so don't show badge
  const canCheckVerification = gameIsPopulated && 'verified' in game;
  const gameIsVerified = canCheckVerification && (game as any).verified === true;

  if (!currentPairing) {
    return null;
  }

  return (
    <div className="card bg-primary-50 border-primary-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TableCellsIcon className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Your Current Round Pairing</h2>
        </div>
        {hasGame && canCheckVerification && (
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium flex items-center gap-1 ${
              gameIsVerified
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {!gameIsVerified && (
              <ExclamationTriangleIcon className="h-4 w-4" />
            )}
            {gameIsVerified ? 'Verified' : 'Pending Verification'}
          </span>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="font-medium">Round {currentPairing.round}</span>
          <span className="font-medium">Table {currentPairing.pairing.tableNumber}</span>
          {!tournament.isOnline && timeRemaining !== null && (
            <span className={`font-medium ${timeRemaining < 0 ? 'text-red-600' : ''}`}>
              Time: {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['East', 'South', 'West', 'North'].map((seat) => {
            const playerEntry = currentPairing.pairing.players.find(
              (p: any) => p.seat === seat
            );
            
            if (!playerEntry) {
              return (
                <div
                  key={seat}
                  className="bg-white rounded-lg p-3 border-2 border-gray-200"
                >
                  <div className="text-xs font-medium text-gray-500 mb-1">{seat}</div>
                  <div className="font-medium text-gray-400 text-sm">Empty</div>
                </div>
              );
            }

            const isCurrentUser = (
              typeof playerEntry.player === 'string'
                ? playerEntry.player === currentUser?._id
                : playerEntry.player?._id === currentUser?._id
            );
            const player = playerEntry.player;
            const playerId = typeof player === 'string' ? player : player?._id;
            const displayName = typeof player === 'string' 
              ? 'Loading...' 
              : player?.displayName || 'Unknown';
            const avatar = typeof player === 'string' ? null : player?.avatar;

            return (
              <div
                key={seat}
                className={`bg-white rounded-lg p-3 border-2 ${
                  isCurrentUser ? 'border-primary-500 bg-primary-100' : 'border-gray-200'
                }`}
              >
                <div className="text-xs font-medium text-gray-500 mb-2">{seat}</div>
                {playerId ? (
                  <UserDisplay
                    user={{
                      _id: playerId,
                      displayName: displayName,
                      avatar: avatar || null,
                    }}
                    size="sm"
                    showYouIndicator={true}
                    nameClassName={isCurrentUser ? 'text-primary-600' : ''}
                  />
                ) : (
                  <div className="font-medium text-gray-400 text-sm">{displayName}</div>
                )}
              </div>
            );
          })}
        </div>
        {currentPairing && !hasGame && (
          <div className="pt-3 border-t border-primary-200">
            <Link
              to={`/tournaments/${tournament._id}/submit-game/${currentPairing.round}/${currentPairing.pairing.tableNumber}`}
              className="btn-primary w-full text-center block"
            >
              Submit Game
            </Link>
          </div>
        )}
        {currentPairing && hasGame && gameId && (
          <div className="pt-3 border-t border-primary-200">
            <Link
              to={`/games/${gameId}`}
              className="btn-primary w-full text-center block"
            >
              View Game
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentRoundPairing;

