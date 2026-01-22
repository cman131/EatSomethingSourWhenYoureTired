import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tournamentsApi, gamesApi, Tournament, Game } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { ArrowLeftIcon, CalendarIcon, CheckCircleIcon, XCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import UserDisplay from '../components/user/UserDisplay';

const TournamentGamesAdmin: React.FC = () => {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [verifyingGameId, setVerifyingGameId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTournament = async () => {
      if (!id) {
        setError('Tournament ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await tournamentsApi.getTournament(id);
        setTournament(response.data.tournament);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load tournament');
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [id]);

  // Organize games by round (including tables without games)
  const gamesByRound = React.useMemo(() => {
    if (!tournament || !tournament.rounds) {
      return [];
    }

    const rounds: Array<{
      roundNumber: number;
      tables: Array<{
        game: Game | null;
        tableNumber: number;
        players: Array<{
          player: any;
          seat: string;
          score?: number;
          rank?: number;
        }>;
        hasGame: boolean;
        isVerified?: boolean;
      }>;
    }> = [];

    // Sort rounds by round number
    const sortedRounds = [...tournament.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

    for (const round of sortedRounds) {
      if (!round.pairings) continue;

      const roundTables: Array<{
        game: Game | null;
        tableNumber: number;
        players: Array<{
          player: any;
          seat: string;
          score?: number;
          rank?: number;
        }>;
        hasGame: boolean;
        isVerified?: boolean;
      }> = [];

      for (const pairing of round.pairings) {
        const game = pairing.game;
        let gameObj: Game | null = null;
        let hasGame = false;
        let isVerified = false;

        // Check if pairing has a game
        if (game && game !== '') {
          // Game can be an ObjectId string or a populated Game object
          if (typeof game === 'object' && game !== null && '_id' in game) {
            gameObj = game as Game;
            hasGame = true;
            isVerified = gameObj.verified || false;
          }
        }

        // Get players from pairing (for tables without games) or from game (for tables with games)
        let players: Array<{
          player: any;
          seat: string;
          score?: number;
          rank?: number;
        }> = [];

        if (hasGame && gameObj) {
          // Get all players from the game with their seat, score, and rank
          players = gameObj.players.map((gp) => {
            // Find the seat from the pairing
            const pairingPlayer = pairing.players.find((p: any) => {
              const playerId = typeof p.player === 'string' ? p.player : p.player?._id;
              const gpPlayerId = typeof gp.player === 'string' ? gp.player : gp.player?._id;
              return playerId === gpPlayerId;
            });

            return {
              player: gp.player,
              seat: pairingPlayer?.seat || 'Unknown',
              score: gp.score,
              rank: gp.rank || gp.position,
            };
          });
        } else {
          // For tables without games, just show the players from the pairing
          players = pairing.players.map((p: any) => ({
            player: p.player,
            seat: p.seat || 'Unknown',
          }));
        }

        roundTables.push({
          game: gameObj,
          tableNumber: pairing.tableNumber,
          players,
          hasGame,
          isVerified,
        });
      }

      if (roundTables.length > 0) {
        rounds.push({
          roundNumber: round.roundNumber,
          tables: roundTables.sort((a, b) => a.tableNumber - b.tableNumber),
        });
      }
    }

    return rounds;
  }, [tournament]);

  const handleDeleteGame = async (gameId: string) => {
    if (!tournament || tournament.status === 'Completed' || !window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingGameId(gameId);
      await gamesApi.deleteGame(gameId);
      // Refresh tournament data
      if (id) {
        const response = await tournamentsApi.getTournament(id);
        setTournament(response.data.tournament);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete game');
    } finally {
      setDeletingGameId(null);
    }
  };

  const handleVerifyGame = async (gameId: string) => {
    if (!id) return;

    try {
      setVerifyingGameId(gameId);
      await gamesApi.verifyGame(gameId);
      // Refresh tournament data
      const response = await tournamentsApi.getTournament(id);
      setTournament(response.data.tournament);
    } catch (err: any) {
      alert(err.message || 'Failed to verify game');
    } finally {
      setVerifyingGameId(null);
    }
  };

  // Check if user is in the tournament
  const isTournamentPlayer = React.useMemo(() => {
    if (!user || !tournament) return false;
    return tournament.players.some(
      p => {
        const playerId = typeof p.player === 'string' ? p.player : p.player?._id;
        return playerId === user._id && !p.dropped;
      }
    );
  }, [user, tournament]);

  // Check if user can manage tournament (admin or creator)
  const canManageTournament = React.useMemo(() => {
    if (!user || !tournament) return false;
    const isAdmin = user.isAdmin === true;
    const createdById = typeof tournament.createdBy === 'string' 
      ? tournament.createdBy 
      : tournament.createdBy?._id;
    const isCreator = createdById === user._id;
    return isAdmin || isCreator;
  }, [user, tournament]);

  // Helper function to check if user is in a specific pairing
  const isUserInPairing = React.useCallback((players: Array<{ player: any }>) => {
    if (!user) return false;
    return players.some((p) => {
      const playerId = typeof p.player === 'string' ? p.player : p.player?._id;
      return playerId === user._id;
    });
  }, [user]);

  // Helper function to check if user is in a specific game
  const isUserInGame = React.useCallback((game: Game | null) => {
    if (!user || !game || !game.players) return false;
    return game.players.some((gp) => {
      const playerId = typeof gp.player === 'string' ? gp.player : gp.player?._id;
      return playerId === user._id;
    });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="card">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="space-y-6">
        <Link
          to={`/tournaments/${id}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Tournament
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error || 'Tournament not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Tournament
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name} - All Games</h1>
          <p className="text-gray-600 mt-2">View of all tournament games organized by round</p>
        </div>
      </div>

      {gamesByRound.length === 0 ? (
        <div className="card">
          <p className="text-gray-500 text-center py-8">No rounds have been created yet.</p>
        </div>
      ) : (
        gamesByRound.map((round) => (
          <div key={round.roundNumber} className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Round {round.roundNumber}
            </h2>
            <div className="space-y-6">
              {round.tables.map((tableData) => (
                <div
                  key={`round-${round.roundNumber}-table-${tableData.tableNumber}`}
                  className={`border rounded-lg p-4 ${
                    tableData.hasGame
                      ? tableData.isVerified
                        ? 'border-green-300 bg-green-50'
                        : 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Table {tableData.tableNumber}
                      </h3>
                      {tableData.hasGame && (
                        <div className="flex items-center gap-2">
                          {tableData.isVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircleIcon className="h-4 w-4" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <XCircleIcon className="h-4 w-4" />
                              Not Verified
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {tableData.hasGame && tableData.game && (
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">
                          {new Date(tableData.game.gameDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                        <Link
                          to={`/games/${tableData.game._id}`}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          View Game Details
                        </Link>
                        {!tableData.isVerified && (isUserInGame(tableData.game) || canManageTournament) && (
                          <button
                            onClick={() => handleVerifyGame(tableData.game!._id)}
                            className="text-sm text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Verify this game"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            {verifyingGameId === tableData.game._id ? 'Verifying...' : 'Verify'}
                          </button>
                        )}
                        {!tableData.isVerified && !isUserInGame(tableData.game) && !canManageTournament && (
                          <span className="text-sm text-gray-400 cursor-not-allowed flex items-center gap-1" title="You must be a player in this game to verify it">
                            <CheckCircleIcon className="h-4 w-4" />
                            Verify
                          </span>
                        )}
                        {tournament.status !== 'Completed' && (
                          <button
                            onClick={() => handleDeleteGame(tableData.game!._id)}
                            disabled={deletingGameId === tableData.game._id}
                            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Delete this game"
                          >
                            <TrashIcon className="h-4 w-4" />
                            {deletingGameId === tableData.game._id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {!tableData.hasGame ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-gray-600 font-medium mb-1">No game submitted yet</p>
                          <p className="text-sm text-gray-500">
                            Waiting for game submission for this table
                          </p>
                        </div>
                        {isUserInPairing(tableData.players) || canManageTournament ? (
                          <Link
                            to={`/tournaments/${id}/submit-game/${round.roundNumber}/${tableData.tableNumber}`}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Submit Game
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400 cursor-not-allowed" title="You must be a player at this table to submit the game">
                            Submit Game
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {tableData.players.map((playerData) => {
                          return (
                            <div
                              key={
                                typeof playerData.player === 'string'
                                  ? playerData.player
                                  : playerData.player._id
                              }
                              className="bg-white rounded-lg p-3 border border-gray-200"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-600">
                                  {playerData.seat}
                                </span>
                              </div>
                              <UserDisplay
                                user={playerData.player}
                                size="sm"
                                showYouIndicator={false}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {tableData.players
                          .sort((a, b) => (a.rank || 0) - (b.rank || 0))
                          .map((playerData) => {
                            const rankEmoji =
                              playerData.rank === 1
                                ? '🥇'
                                : playerData.rank === 2
                                ? '🥈'
                                : playerData.rank === 3
                                ? '🥉'
                                : '';
                            return (
                              <div
                                key={
                                  typeof playerData.player === 'string'
                                    ? playerData.player
                                    : playerData.player._id
                                }
                                className="bg-white rounded-lg p-3 border border-gray-200"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-600">
                                    {playerData.seat}
                                  </span>
                                  {playerData.rank !== undefined && (
                                    <span className="text-sm font-bold text-gray-900">
                                      {rankEmoji || `#${playerData.rank}`}
                                    </span>
                                  )}
                                </div>
                                <UserDisplay
                                  user={playerData.player}
                                  size="sm"
                                  showYouIndicator={false}
                                />
                                {playerData.score !== undefined && (
                                  <div
                                    className={`text-lg font-bold mt-2 ${
                                      playerData.score >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {playerData.score.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      {tableData.game?.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {tableData.game.notes}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TournamentGamesAdmin;
