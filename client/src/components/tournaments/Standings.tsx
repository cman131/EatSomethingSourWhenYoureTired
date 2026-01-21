import React, { useState } from 'react';
import { TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Tournament, User, tournamentsApi } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface StandingsProps {
  tournament: Tournament;
  currentUser: User | null;
  onUpdate?: (tournament: Tournament) => void;
}

const Standings: React.FC<StandingsProps> = ({ tournament, currentUser, onUpdate }) => {
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);

  // Get registered players for NotStarted tournaments, or standings for started tournaments
  const playerList = React.useMemo(() => {
    if (!tournament) return null;
    
    const active = tournament.players.filter(p => !p.dropped);
    
    // For NotStarted tournaments, just return active players
    if (tournament.status === 'NotStarted') {
      return active.map((player, index) => ({
        ...player,
        rank: index + 1
      }));
    }
    
    // For started tournaments, calculate standings sorted by UMA, then table number, then seat
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
    
    // Sort by top4 position first (if tournament has top4), then UMA, then table number, then seat order
    const sorted = [...active].sort((a, b) => {
      // First: Check if tournament has top4 array (completed tournament with final round)
      if (tournament.top4 && tournament.top4.length > 0) {
        const aTop4Index = tournament.top4.findIndex((id: any) => {
          const top4Id = typeof id === 'string' ? id : id._id || id;
          return top4Id === a.player._id;
        });
        const bTop4Index = tournament.top4.findIndex((id: any) => {
          const top4Id = typeof id === 'string' ? id : id._id || id;
          return top4Id === b.player._id;
        });
        
        // If both players are in top4, sort by their position (lower index = better rank)
        if (aTop4Index !== -1 && bTop4Index !== -1) {
          return aTop4Index - bTop4Index;
        }
        // If only one is in top4, they rank higher
        if (aTop4Index !== -1) return -1;
        if (bTop4Index !== -1) return 1;
      }
      
      // Second: UMA (descending - higher is better)
      if (b.uma !== a.uma) {
        return b.uma - a.uma;
      }
      
      // Third: Table number (ascending - lower is better)
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
      
      // Fourth: Seat order (East, South, West, North)
      const aSeatOrder = getSeatOrder(aPairing.seat);
      const bSeatOrder = getSeatOrder(bPairing.seat);
      return aSeatOrder - bSeatOrder;
    });
    
    return sorted.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
  }, [tournament]);

  const handleKickPlayer = async (playerId: string) => {
    if (!window.confirm('Are you sure you want to remove this player from the tournament?')) {
      return;
    }

    try {
      setKickingPlayerId(playerId);
      const response = await tournamentsApi.kickPlayer(tournament._id, playerId);
      if (onUpdate) {
        onUpdate(response.data.tournament);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove player from tournament');
    } finally {
      setKickingPlayerId(null);
    }
  };

  // Find last completed round
  const lastCompletedRound = React.useMemo(() => {
    if (!tournament || !tournament.rounds) return null;
    
    // Find rounds that have games completed (pairings with games)
    const roundsWithGames = tournament.rounds
      .filter(r => r.pairings && r.pairings.some((p: any) => p.game))
      .sort((a, b) => b.roundNumber - a.roundNumber);
    
    return roundsWithGames.length > 0 ? roundsWithGames[0].roundNumber : null;
  }, [tournament]);

  const isCompleted = tournament.status === 'Completed';
  const isTournamentOwner = React.useMemo(() => {
    if (!currentUser || !tournament) return false;
    const createdById = typeof tournament.createdBy === 'string' 
      ? tournament.createdBy 
      : tournament.createdBy?._id;
    return createdById === currentUser._id;
  }, [currentUser, tournament]);
  const showKickButton = tournament.status !== 'Completed' && (currentUser?.isAdmin === true || isTournamentOwner);

  if (!playerList || playerList.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrophyIcon className="h-5 w-5" />
            {tournament.status === 'NotStarted' 
              ? 'Registered Players' 
              : isCompleted 
              ? 'Final Standings' 
              : 'Standings'}
            <span className="text-sm font-normal text-gray-500">
              {tournament.status === 'NotStarted' && tournament.maxPlayers
                ? `(${tournament.players.filter(p => !p.dropped).length} / ${tournament.maxPlayers})`
                : `(${tournament.players.filter(p => !p.dropped).length})`}
            </span>
            {lastCompletedRound && !isCompleted && tournament.status !== 'NotStarted' && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (After Round {lastCompletedRound})
              </span>
            )}
          </h2>
        </div>
        <p className="text-gray-500 text-center py-8">
          {tournament.status === 'NotStarted' ? 'No players registered yet' : 'No standings available'}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          {tournament.status === 'NotStarted' 
            ? 'Registered Players' 
            : isCompleted 
            ? 'Final Standings' 
            : 'Standings'}
          <span className="text-sm font-normal text-gray-500">
            {tournament.status === 'NotStarted' && tournament.maxPlayers
              ? `(${playerList.filter(p => !p.dropped).length} / ${tournament.maxPlayers})`
              : `(${playerList.filter(p => !p.dropped).length})`}
          </span>
          {lastCompletedRound && !isCompleted && tournament.status !== 'NotStarted' && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (After Round {lastCompletedRound})
            </span>
          )}
        </h2>
      </div>

      <div className="space-y-2">
        {playerList.map((playerEntry) => {
          const isCurrentUser = currentUser && playerEntry.player._id === currentUser._id;
          const rankEmoji = tournament.status !== 'NotStarted' && (playerEntry.rank === 1 ? '🥇' : playerEntry.rank === 2 ? '🥈' : playerEntry.rank === 3 ? '🥉' : '');
          return (playerEntry.player._id &&
            <div
              key={'standings-player-' + playerEntry.player._id}
              className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                isCurrentUser 
                  ? 'border-primary-500 bg-primary-50' 
                  : tournament.status !== 'NotStarted' && playerEntry.rank <= 3
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {tournament.status !== 'NotStarted' && (
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-300 font-bold text-gray-700">
                  {rankEmoji || playerEntry.rank}
                </div>
              )}
              <div className="flex-1">
                <UserDisplay
                  user={playerEntry.player}
                  size="md"
                  showYouIndicator={true}
                  nameClassName="text-base"
                />
              </div>
              <div className="flex items-center gap-3">
                {tournament.status !== 'NotStarted' && (
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {playerEntry.uma > 0 ? '+' : ''}{playerEntry.uma.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">UMA</div>
                  </div>
                )}
                {showKickButton && (
                  <button
                    onClick={() => handleKickPlayer(playerEntry.player._id)}
                    disabled={kickingPlayerId === playerEntry.player._id}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove player from tournament"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Standings;

