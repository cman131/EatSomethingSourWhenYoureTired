import React from 'react';
import { Link } from 'react-router-dom';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { Tournament, User } from '../../services/api';

interface StandingsProps {
  tournament: Tournament;
  currentUser: User | null;
}

const Standings: React.FC<StandingsProps> = ({ tournament, currentUser }) => {
  // Calculate standings sorted by UMA, then table number, then seat
  const standings = React.useMemo(() => {
    if (!tournament || tournament.status === 'NotStarted') return null;
    
    const active = tournament.players.filter(p => !p.dropped);
    
    // Find the latest round with pairings
    const roundsWithPairings = tournament.rounds
      ? tournament.rounds
          .filter(r => r.pairings && r.pairings.length > 0)
          .sort((a, b) => b.roundNumber - a.roundNumber)
      : [];
    
    const latestRound = roundsWithPairings.length > 0 ? roundsWithPairings[0] : null;
    
    // Helper function to get seat order (East=1, South=2, West=3, North=4)
    const getSeatOrder = (seat: string): number => {
      const seatOrder: Record<string, number> = {
        'East': 1,
        'South': 2,
        'West': 3,
        'North': 4
      };
      return seatOrder[seat] || 99;
    };
    
    // Helper function to find player's pairing in latest round
    const getPlayerPairing = (playerId: string) => {
      if (!latestRound) return null;
      
      for (const pairing of latestRound.pairings) {
        const playerEntry = pairing.players.find((p: any) => {
          const pId = typeof p.player === 'string' ? p.player : p.player?._id;
          return pId === playerId;
        });
        
        if (playerEntry) {
          return {
            tableNumber: pairing.tableNumber,
            seat: playerEntry.seat
          };
        }
      }
      return null;
    };
    
    // Sort by UMA descending, then table number ascending, then seat order
    const sorted = [...active].sort((a, b) => {
      // First: UMA (descending - higher is better)
      if (b.uma !== a.uma) {
        return b.uma - a.uma;
      }
      
      // Second: Table number (ascending - lower is better)
      const aPairing = getPlayerPairing(a.player._id);
      const bPairing = getPlayerPairing(b.player._id);
      
      // If one player has no pairing, they rank lower
      if (!aPairing && !bPairing) {
        return 0;
      }
      if (!aPairing) return 1;
      if (!bPairing) return -1;
      
      if (aPairing.tableNumber !== bPairing.tableNumber) {
        return aPairing.tableNumber - bPairing.tableNumber;
      }
      
      // Third: Seat order (East, South, West, North)
      const aSeatOrder = getSeatOrder(aPairing.seat);
      const bSeatOrder = getSeatOrder(bPairing.seat);
      return aSeatOrder - bSeatOrder;
    });
    
    return sorted.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
  }, [tournament]);

  // Find last completed round
  const lastCompletedRound = React.useMemo(() => {
    if (!tournament || !tournament.rounds) return null;
    
    // Find rounds that have games completed (pairings with games)
    const roundsWithGames = tournament.rounds
      .filter(r => r.pairings && r.pairings.some((p: any) => p.game))
      .sort((a, b) => b.roundNumber - a.roundNumber);
    
    return roundsWithGames.length > 0 ? roundsWithGames[0].roundNumber : null;
  }, [tournament]);

  if (!standings || standings.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            Standings
            {lastCompletedRound && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (After Round {lastCompletedRound})
              </span>
            )}
          </h2>
        </div>
        <p className="text-gray-500 text-center py-8">No standings available</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Standings
          {lastCompletedRound && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (After Round {lastCompletedRound})
            </span>
          )}
        </h2>
      </div>

      <div className="space-y-2">
        {standings.map((playerEntry) => {
          const isCurrentUser = currentUser && playerEntry.player._id === currentUser._id;
          const rankEmoji = playerEntry.rank === 1 ? '🥇' : playerEntry.rank === 2 ? '🥈' : playerEntry.rank === 3 ? '🥉' : '';
          return (
            <div
              key={playerEntry.player._id}
              className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                isCurrentUser 
                  ? 'border-primary-500 bg-primary-50' 
                  : playerEntry.rank <= 3
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-300 font-bold text-gray-700">
                {rankEmoji || playerEntry.rank}
              </div>
              {playerEntry.player.avatar && (
                <img
                  src={playerEntry.player.avatar}
                  alt={playerEntry.player.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1">
                <Link
                  to={`/profile/${playerEntry.player._id}`}
                  className="font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors"
                >
                  {playerEntry.player.displayName}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
                  )}
                </Link>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {playerEntry.uma > 0 ? '+' : ''}{playerEntry.uma.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">UMA</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Standings;

