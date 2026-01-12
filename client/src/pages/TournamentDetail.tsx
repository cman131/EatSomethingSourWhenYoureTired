import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tournamentsApi, gamesApi, Tournament } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import UserDisplay from '../components/user/UserDisplay';
import { ArrowLeftIcon, CalendarIcon, MapPinIcon, PencilIcon } from '@heroicons/react/24/outline';
import Standings from '../components/tournaments/Standings';
import CurrentRoundPairing from '../components/tournaments/CurrentRoundPairing';
import EditTournamentModal from '../components/tournaments/EditTournamentModal';
import TournamentGamesList from '../components/tournaments/TournamentGamesList';

const TournamentDetail: React.FC = () => {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [allRoundsHaveGames, setAllRoundsHaveGames] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const isSignedUp = React.useMemo(() => {
    if (!user || !tournament) return false;
    return tournament.players.some(
      p => p.player._id === user._id && !p.dropped
    );
  }, [user, tournament]);



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
    location?: any;
  }) => {
    if (!id) return;
    await tournamentsApi.updateTournament(id, data);
    // Refresh tournament data
    const response = await tournamentsApi.getTournament(id);
    setTournament(response.data.tournament);
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

      <div className="flex items-start justify-between pr-2 pl-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
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
        <div className="flex items-center gap-3">
          {tournament.status === 'NotStarted' && (
            <>
              {user?.isAdmin === true && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn-primary flex items-center"
                  title="Edit Tournament"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              {user?.isAdmin === true && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Starting...' : 'Start Tournament'}
                </button>
              )}
              {isSignedUp ? (
                <button
                  onClick={handleDrop}
                  disabled={actionLoading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Dropping...' : 'Drop from Tournament'}
                </button>
              ) : (
                <button
                  onClick={handleSignup}
                  disabled={actionLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Signing up...' : 'Sign Up for Tournament'}
                </button>
              )}
            </>
          )}
          {tournament.status === 'InProgress' && user?.isAdmin === true && (
            <button
              onClick={handleEndRound}
              disabled={actionLoading || !allRoundsHaveGames}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Ending Round...' : `End Round ${currentRoundToEnd?.roundNumber}`}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{actionError}</p>
        </div>
      )}

      {tournament.description && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{tournament.description}</p>
        </div>
      )}

      {tournament.location && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            Location
          </h2>
          <div className="text-gray-700 space-y-1">
            <div>{tournament.location.streetAddress}</div>
            {tournament.location.addressLine2 && (
              <div>{tournament.location.addressLine2}</div>
            )}
            <div>
              {tournament.location.city}, {tournament.location.state} {tournament.location.zipCode}
            </div>
          </div>
        </div>
      )}

      {tournament.status === 'InProgress' && (
        <CurrentRoundPairing tournament={tournament} currentUser={user} />
      )}

      <Standings 
        tournament={tournament} 
        currentUser={user} 
        onUpdate={(updatedTournament) => setTournament(updatedTournament)}
      />

      {tournament.status === 'Completed' && (
        <TournamentGamesList tournament={tournament} currentUser={user} />
      )}

      <EditTournamentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateTournament}
        tournament={tournament}
      />
    </div>
  );
};

export default TournamentDetail;

