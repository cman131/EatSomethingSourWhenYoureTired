import React, { useState, useRef, useEffect } from 'react';
import { TrophyIcon, XMarkIcon, MinusCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { Tournament, User, tournamentsApi, getRoundLabel } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface StandingsProps {
  tournament: Tournament;
  currentUser: User | null;
  onUpdate?: (tournament: Tournament) => void;
}

const Standings: React.FC<StandingsProps> = ({ tournament, currentUser, onUpdate }) => {
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);
  const [penaltyModalPlayer, setPenaltyModalPlayer] = useState<{ playerId: string; displayName?: string } | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState<string>('');
  const [penaltyDescription, setPenaltyDescription] = useState<string>('');
  const [applyingPenalty, setApplyingPenalty] = useState(false);
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const penaltyModalRef = useRef<HTMLDivElement>(null);
  const [viewPenaltiesPlayer, setViewPenaltiesPlayer] = useState<{ playerId: string; displayName?: string } | null>(null);
  const viewPenaltiesModalRef = useRef<HTMLDivElement>(null);

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
    
    // For started tournaments, calculate standings sorted by effective UMA, then table number, then seat
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
    
    // Sort by UMA, then table number, then seat (used for rest and for deriving top 4 by UMA)
    const sortByUmaTableSeat = (a: typeof active[0], b: typeof active[0]) => {
      const aUma = a.uma ?? 0, bUma = b.uma ?? 0;
      if (bUma !== aUma) return bUma - aUma;
      const aPairing = getPlayerPairing(a.player._id), bPairing = getPlayerPairing(b.player._id);
      if (!aPairing && !bPairing) return 0;
      if (!aPairing) return 1;
      if (!bPairing) return -1;
      if (aPairing.tableNumber !== bPairing.tableNumber) return aPairing.tableNumber - bPairing.tableNumber;
      return getSeatOrder(aPairing.seat) - getSeatOrder(bPairing.seat);
    };

    // Define top 4: from tournament.top4 if present, else first 4 by UMA
    let top4Ids: Set<string>;
    if (tournament.top4 && tournament.top4.length >= 4) {
      top4Ids = new Set(
        tournament.top4.slice(0, 4).map((id: any) => (typeof id === 'string' ? id : (id?._id ?? id)).toString())
      );
    } else {
      const byUma = [...active].sort(sortByUmaTableSeat);
      top4Ids = new Set(byUma.slice(0, 4).map(p => p.player._id));
    }

    const top4Group = active.filter(p => top4Ids.has(p.player._id));
    const restGroup = active.filter(p => !top4Ids.has(p.player._id));

    // Sort top 4 by finalsUma desc, then uma desc, then table/seat
    const sortTop4 = (a: typeof active[0], b: typeof active[0]) => {
      const aFu = a.finalsUma ?? 0, bFu = b.finalsUma ?? 0;
      if (bFu !== aFu) return bFu - aFu;
      return sortByUmaTableSeat(a, b);
    };

    const top4Sorted = [...top4Group].sort(sortTop4);
    const restSorted = [...restGroup].sort(sortByUmaTableSeat);
    const sorted = top4Sorted.concat(restSorted);

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
  const showPenaltyButton = currentUser?.isAdmin === true || isTournamentOwner;

  const handleApplyPenalty = async () => {
    if (!penaltyModalPlayer) return;
    const amount = Number(penaltyAmount);
    if (Number.isNaN(amount)) {
      setPenaltyError('Please enter a valid number for the penalty amount');
      return;
    }
    try {
      setApplyingPenalty(true);
      setPenaltyError(null);
      const response = await tournamentsApi.applyUmaPenalty(tournament._id, penaltyModalPlayer.playerId, {
        amount,
        description: penaltyDescription.trim() || undefined
      });
      if (onUpdate) {
        onUpdate(response.data.tournament);
      }
      setPenaltyModalPlayer(null);
      setPenaltyAmount('');
      setPenaltyDescription('');
    } catch (err: any) {
      setPenaltyError(err.message || 'Failed to apply UMA penalty');
    } finally {
      setApplyingPenalty(false);
    }
  };

  useEffect(() => {
    if (!penaltyModalPlayer) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPenaltyModalPlayer(null);
        setPenaltyAmount('');
        setPenaltyDescription('');
        setPenaltyError(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [penaltyModalPlayer]);

  useEffect(() => {
    if (!penaltyModalPlayer) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (penaltyModalRef.current && !penaltyModalRef.current.contains(event.target as Node)) {
        setPenaltyModalPlayer(null);
        setPenaltyAmount('');
        setPenaltyDescription('');
        setPenaltyError(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [penaltyModalPlayer]);

  const getPlayerPenalties = (playerId: string) =>
    (tournament.umaPenalties ?? []).filter(
      (p) => (typeof p.player === 'string' ? p.player : (p as { player?: { _id?: string } }).player?._id) === playerId
    );

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
                (After {getRoundLabel(lastCompletedRound, tournament)})
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
    <>
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
              (After {getRoundLabel(lastCompletedRound, tournament)})
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
                  <div className="flex items-center gap-4">
                    {playerEntry.rank <= 4 && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {(playerEntry.finalsUma ?? 0) > 0 ? '+' : ''}{(playerEntry.finalsUma ?? 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500">Finals UMA</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {(playerEntry.uma ?? 0) > 0 ? '+' : ''}{(playerEntry.uma ?? 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">UMA</div>
                    </div>
                  </div>
                )}
                {getPlayerPenalties(playerEntry.player._id).length > 0 && (
                  <button
                    onClick={() => setViewPenaltiesPlayer({ playerId: playerEntry.player._id, displayName: playerEntry.player.displayName })}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="View UMA penalties"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                )}
                {showPenaltyButton && (
                  <button
                    onClick={() => setPenaltyModalPlayer({ playerId: playerEntry.player._id, displayName: playerEntry.player.displayName })}
                    className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                    title="Apply UMA penalty"
                  >
                    <MinusCircleIcon className="h-5 w-5" />
                  </button>
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

    {penaltyModalPlayer && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => { setPenaltyModalPlayer(null); setPenaltyAmount(''); setPenaltyDescription(''); setPenaltyError(null); }} />
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div ref={penaltyModalRef} className="bg-white px-4 pt-5 pb-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Apply UMA Penalty</h3>
                <button
                  onClick={() => { setPenaltyModalPlayer(null); setPenaltyAmount(''); setPenaltyDescription(''); setPenaltyError(null); }}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Applying penalty for {penaltyModalPlayer.displayName || 'this player'}.
              </p>
              <div className="mb-4">
                <label htmlFor="penalty-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Penalty amount
                </label>
                <input
                  id="penalty-amount"
                  type="number"
                  step="any"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={applyingPenalty}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="penalty-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  id="penalty-description"
                  type="text"
                  value={penaltyDescription}
                  onChange={(e) => setPenaltyDescription(e.target.value)}
                  placeholder="Reason for penalty"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={applyingPenalty}
                />
              </div>
              {penaltyError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{penaltyError}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setPenaltyModalPlayer(null); setPenaltyAmount(''); setPenaltyDescription(''); setPenaltyError(null); }}
                  className="btn-secondary"
                  disabled={applyingPenalty}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPenalty}
                  className="btn-primary"
                  disabled={applyingPenalty}
                >
                  {applyingPenalty ? 'Applying...' : 'Apply penalty'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {viewPenaltiesPlayer && (() => {
      const penalties = getPlayerPenalties(viewPenaltiesPlayer.playerId);
      return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setViewPenaltiesPlayer(null)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div ref={viewPenaltiesModalRef} className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">UMA Penalties</h3>
                  <button
                    onClick={() => setViewPenaltiesPlayer(null)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Penalties for {viewPenaltiesPlayer.displayName || 'this player'}
                </p>
                <ul className="space-y-3">
                  {penalties.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-900 shrink-0">{p.amount > 0 ? '-' : ''}{Math.abs(p.amount).toFixed(1)} UMA</span>
                      {p.description ? (
                        <span className="text-sm text-gray-700">{p.description}</span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">No description</span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setViewPenaltiesPlayer(null)}
                    className="btn-primary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    </>
  );
};

export default Standings;

