import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tournamentsApi, gamesApi, Tournament } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ShareButton from '../components/ShareButton';
import AddressDisplay from '../components/AddressDisplay';
import { ArrowLeftIcon, CalendarIcon, PencilIcon, TableCellsIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/outline';
import Standings from '../components/tournaments/Standings';
import CurrentRoundPairing from '../components/tournaments/CurrentRoundPairing';
import EditTournamentModal from '../components/tournaments/EditTournamentModal';
import TournamentGamesList from '../components/tournaments/TournamentGamesList';
import AddPlayerModal from '../components/tournaments/AddPlayerModal';
import DescriptionDisplay from '../components/tournaments/DescriptionDisplay';
import EtiquetteDisplay from '../components/tournaments/EtiquetteDisplay';
import RulesDisplay from '../components/tournaments/RulesDisplay';
import UserDisplay from '../components/user/UserDisplay';
import { UserPlusIcon } from '@heroicons/react/24/outline';

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [allRoundsHaveGames, setAllRoundsHaveGames] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);

  useEffect(() => {
    const fetchTournament = async () => {
      if (!id) {
        setError('Tournament ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Use public endpoint if not authenticated, otherwise use authenticated endpoint
        const response = isAuthenticated 
          ? await tournamentsApi.getTournament(id)
          : await tournamentsApi.getTournamentPublic(id);
        setTournament(response.data.tournament);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load tournament');
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [id, isAuthenticated]);

  const isSignedUp = React.useMemo(() => {
    if (!user || !tournament) return false;
    return tournament.players.some(
      p => p.player._id === user._id && !p.dropped
    );
  }, [user, tournament]);

  const isOnWaitlist = React.useMemo(() => {
    if (!user || !tournament || !tournament.waitlist) return false;
    return tournament.waitlist.some(
      w => {
        const playerId = typeof w.player === 'string' ? w.player : w.player._id;
        return playerId === user._id;
      }
    );
  }, [user, tournament]);

  const isTournamentFull = React.useMemo(() => {
    if (!tournament || !tournament.maxPlayers) return false;
    const activePlayersCount = tournament.players.filter(p => !p.dropped).length;
    return activePlayersCount >= tournament.maxPlayers;
  }, [tournament]);

  const isTournamentOwner = React.useMemo(() => {
    if (!user || !tournament) return false;
    const createdById = typeof tournament.createdBy === 'string' 
      ? tournament.createdBy 
      : tournament.createdBy?._id;
    return createdById === user._id;
  }, [user, tournament]);

  const canManageTournament = React.useMemo(() => {
    return user?.isAdmin === true || isTournamentOwner;
  }, [user, isTournamentOwner]);



  // Find the current round that can be ended (latest round with pairings where all games are submitted)
  const currentRoundToEnd = React.useMemo(() => {
    if (!tournament || !tournament.rounds || tournament.status === 'NotStarted') {
      return null;
    }

    // Find rounds with pairings, sorted by round number (latest first)
    const roundsWithPairings = tournament.rounds
      .filter(r => r.pairings && r.pairings.length > 0)
      .sort((a, b) => b.roundNumber - a.roundNumber);

    if (roundsWithPairings.length === 0) {
      return null;
    }

    // Check the latest round - if all pairings have games, it can be ended
    const latestRound = roundsWithPairings[0];
    return latestRound;
  }, [tournament]);

  // Check if all pairings have verified games
  useEffect(() => {
    const checkAllGamesVerified = async () => {
      if (!currentRoundToEnd || !currentRoundToEnd.pairings || currentRoundToEnd.pairings.length === 0) {
        setAllRoundsHaveGames(false);
        return;
      }

      const checkPairing = async (p: any): Promise<boolean> => {
        // Game must exist
        if (!p.game || p.game === '') {
          return false;
        }
        
        // If game is populated (object with properties), check if it's verified
        if (typeof p.game === 'object' && p.game !== null && 'verified' in p.game) {
          return p.game.verified === true;
        }
        
        // If game is just an ObjectId (not populated), fetch it to check verification
        try {
          const gameId = typeof p.game === 'string' ? p.game : p.game.toString();
          const response = await gamesApi.getGame(gameId);
          return response.data.game.verified === true;
        } catch (err) {
          console.error('Failed to fetch game:', err);
          return false;
        }
      };

      // Check all pairings in parallel
      const results = await Promise.all(
        currentRoundToEnd.pairings.map(checkPairing)
      );

      const allVerified = results.every(result => result === true);
      setAllRoundsHaveGames(allVerified);
    };

    checkAllGamesVerified();
  }, [currentRoundToEnd]);


  const handleSignup = async () => {
    if (!id) return;

    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.signup(id);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to sign up for tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDrop = async () => {
    if (!id) return;

    if (!window.confirm('Are you sure you want to drop from this tournament?')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.drop(id);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to drop from tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDropFromWaitlist = async () => {
    if (!id) return;

    if (!window.confirm('Are you sure you want to remove yourself from the waitlist?')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.dropFromWaitlist(id);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove from waitlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;

    if (!window.confirm('Are you sure you want to start this tournament? This will generate the first round pairings.')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.startTournament(id);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndRound = async () => {
    if (!id || !currentRoundToEnd.roundNumber) return;

    if (!window.confirm(`Are you sure you want to end Round ${currentRoundToEnd.roundNumber}? This will calculate UMA scores and generate the next round if applicable.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.endRound(id, currentRoundToEnd.roundNumber);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to end round');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTournament = async (data: {
    name?: string;
    description?: string;
    date?: Date;
    isOnline?: boolean;
    location?: any;
    onlineLocation?: string;
    modifications?: string[];
    ruleset?: 'WRC2025';
  }) => {
    if (!id) return;
    await tournamentsApi.updateTournament(id, data);
    // Refresh tournament data
    const response = await tournamentsApi.getTournament(id);
    setTournament(response.data.tournament);
  };

  const handleAddPlayer = async (playerId: string) => {
    if (!id) return;
    if (!user?.isAdmin) {
      setActionError('Only admins can add players');
      return;
    }
    try {
      setActionLoading(true);
      setActionError(null);
      const response = await tournamentsApi.addPlayer(id, playerId);
      setTournament(response.data.tournament);
    } catch (err: any) {
      setActionError(err.message || 'Failed to add player');
      throw err; // Re-throw so modal can handle it
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NotStarted':
        return 'bg-gray-100 text-gray-800';
      case 'InProgress':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
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
          to="/tournaments"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Tournaments
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error || 'Tournament not found'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <Link
        to="/tournaments"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Tournaments
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pr-2 pl-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              {new Date(tournament.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
            {tournament.createdBy && typeof tournament.createdBy === 'object' && tournament.createdBy._id && (
              <UserDisplay
                user={{
                  _id: tournament.createdBy._id,
                  displayName: tournament.createdBy.displayName || 'Tournament Creator',
                  avatar: tournament.createdBy.avatar,
                }}
                size="sm"
                showLink={true}
                showYouIndicator={false}
              />
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
              {tournament.status}
            </span>
            {tournament.isEastOnly && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                East Only
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {tournament.status === 'NotStarted' && (
            <>
              {!isAuthenticated ? (
                <Link
                  to={`/login?redirect=${encodeURIComponent(`/tournaments/${id}`)}`}
                  className="btn-primary w-full sm:w-auto text-center"
                >
                  Login to Register
                </Link>
              ) : isSignedUp ? (
                <button
                  onClick={handleDrop}
                  disabled={actionLoading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {actionLoading ? 'Dropping...' : 'Drop from Tournament'}
                </button>
              ) : isOnWaitlist ? (
                <button
                  onClick={handleDropFromWaitlist}
                  disabled={actionLoading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {actionLoading ? 'Removing...' : 'Leave Waitlist'}
                </button>
              ) : (
                <button
                  onClick={handleSignup}
                  disabled={actionLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {actionLoading 
                    ? (isTournamentFull ? 'Joining waitlist...' : 'Signing up...') 
                    : (isTournamentFull ? 'Join Waitlist' : 'Sign Up for Tournament')}
                </button>
              )}
            </>
          )}

          {tournament.status !== 'NotStarted' && !isAuthenticated && (
            <Link
              to={`/login?redirect=${encodeURIComponent(`/tournaments/${id}`)}`}
              className="btn-primary w-full sm:w-auto text-center"
            >
              Login to View
            </Link>
          )}
          {isAuthenticated && (isSignedUp || canManageTournament) && tournament.status !== 'NotStarted' && (
            <button
              onClick={() => navigate(`/tournaments/${id}/games`)}
              className="btn-secondary flex items-center justify-center w-full sm:w-auto"
              title="View All Tournament Games"
            >
              <TableCellsIcon className="h-4 w-4 mr-2" />
              View All Games
            </button>
          )}
          <div className="w-full sm:w-auto">
            <ShareButton title="Share this tournament" />
          </div>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{actionError}</p>
        </div>
      )}

      {canManageTournament && (
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tournament Management</h2>
          <div className="flex flex-wrap items-center gap-3">
            {tournament.status === 'NotStarted' && (
              <>
                <button
                  onClick={() => setIsAddPlayerModalOpen(true)}
                  disabled={!user?.isAdmin}
                  className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add Player"
                >
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Add Player
                </button>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn-primary flex items-center"
                  title="Edit Tournament"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit Tournament
                </button>
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Starting...' : 'Start Tournament'}
                </button>
              </>
            )}
            {tournament.status === 'InProgress' && (
              <button
                onClick={handleEndRound}
                disabled={actionLoading || !allRoundsHaveGames}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title={!allRoundsHaveGames ? 'All games must be verified before ending the round' : ''}
              >
                {actionLoading ? 'Ending Round...' : `End Round ${currentRoundToEnd?.roundNumber}`}
              </button>
            )}
          </div>
        </div>
      )}

      {isAuthenticated && tournament.status === 'InProgress' && (
        <CurrentRoundPairing tournament={tournament} currentUser={user} />
      )}

      {tournament.description && (
        <DescriptionDisplay description={tournament.description} />
      )}

      {tournament.isOnline && tournament.onlineLocation ? (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Online Location
          </h2>
          <div className="text-gray-700">
            {tournament.onlineLocation}
          </div>
        </div>
      ) : tournament.location ? (
        <AddressDisplay address={tournament.location} />
      ) : null}

      {!tournament.isOnline && <EtiquetteDisplay/> }

      {!tournament.isOnline && <RulesDisplay ruleset={tournament.ruleset} modifications={tournament.modifications} />}

      {isAuthenticated && (
        <Standings 
          tournament={tournament} 
          currentUser={user} 
          onUpdate={(updatedTournament) => setTournament(updatedTournament)}
        />
      )}

      {tournament.status === 'NotStarted' && tournament.waitlist && tournament.waitlist.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClockIcon className="h-6 w-6 text-gray-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Waitlist</h3>
                <p className="text-sm text-gray-600">
                  {tournament.waitlist.length} player{tournament.waitlist.length !== 1 ? 's' : ''} on waitlist
                </p>
              </div>
            </div>
            <Link
              to={`/tournaments/${id}/waitlist`}
              className="btn-secondary flex items-center gap-2"
            >
              <ClockIcon className="h-4 w-4" />
              View Waitlist
            </Link>
          </div>
        </div>
      )}

      {!isAuthenticated && (
        <div className="card">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-6 w-6 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Players</h3>
              <p className="text-sm text-gray-600">
                {tournament.players.filter(p => !p.dropped).length} player{tournament.players.filter(p => !p.dropped).length !== 1 ? 's' : ''} {tournament.status === 'NotStarted' ? 'registered' : tournament.status === 'InProgress' ? 'playing' : 'played'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && tournament.status === 'Completed' && (
        <TournamentGamesList tournament={tournament} currentUser={user} />
      )}

      <EditTournamentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateTournament}
        tournament={tournament}
      />

      <AddPlayerModal
        isOpen={isAddPlayerModalOpen}
        onClose={() => setIsAddPlayerModalOpen(false)}
        onAdd={handleAddPlayer}
        existingPlayerIds={tournament.players.map((p) => p.player._id || p.player.toString())}
      />
    </div>
  );
};

export default TournamentDetail;

