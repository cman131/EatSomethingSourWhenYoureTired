import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tournamentsApi, Tournament } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import UserDisplay from '../components/user/UserDisplay';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';

const TournamentWaitlist: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTournament = async () => {
      if (!id) {
        setError('Tournament ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
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
          to={`/tournaments/${id || ''}`}
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

  const waitlist = tournament.waitlist || [];
  const activePlayersCount = tournament.players.filter(p => !p.dropped).length;
  const maxPlayers = tournament.maxPlayers || 0;
  const spotsAvailable = maxPlayers > 0 ? maxPlayers - activePlayersCount : 0;

  return (
    <div className="space-y-6">
      <Link
        to={`/tournaments/${id}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Tournament
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name} - Waitlist</h1>
        <div className="text-sm text-gray-600 mb-6">
          {tournament.status === 'NotStarted' && maxPlayers > 0 && (
            <div className="flex items-center gap-4">
              <span>
                {activePlayersCount} / {maxPlayers} players registered
              </span>
              {spotsAvailable > 0 && (
                <span className="text-green-600 font-medium">
                  {spotsAvailable} spot{spotsAvailable !== 1 ? 's' : ''} available
                </span>
              )}
              {spotsAvailable === 0 && (
                <span className="text-red-600 font-medium">Tournament is full</span>
              )}
            </div>
          )}
        </div>
      </div>

      {waitlist.length === 0 ? (
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Waitlist</h3>
              <p className="text-sm text-gray-500">
                There are currently no players on the waitlist for this tournament.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Waitlist ({waitlist.length})
            </h2>
            {tournament.status === 'NotStarted' && maxPlayers > 0 && spotsAvailable > 0 && (
              <span className="text-sm text-gray-600">
                Next {Math.min(spotsAvailable, waitlist.length)} player{Math.min(spotsAvailable, waitlist.length) !== 1 ? 's' : ''} will be promoted when spots open
              </span>
            )}
          </div>

          <div className="space-y-2">
            {waitlist.map((waitlistEntry, index) => {
              const player = typeof waitlistEntry.player === 'string' 
                ? null 
                : waitlistEntry.player;
              const isCurrentUser = user && player && player._id === user._id;
              
              return (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                    isCurrentUser 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-300 font-bold text-gray-700">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    {player ? (
                      <UserDisplay
                        user={player}
                        size="md"
                        showYouIndicator={true}
                        nameClassName="text-base"
                      />
                    ) : (
                      <div className="text-gray-500">Loading player...</div>
                    )}
                  </div>
                  {waitlistEntry.addedAt && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        Added {new Date(waitlistEntry.addedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentWaitlist;
