import React, { useState, useEffect } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { rankedLeaguesApi, RankedLeague as RankedLeagueType } from '../services/api';
import UserDisplay from '../components/user/UserDisplay';
import { StarIcon } from '@heroicons/react/24/outline';

const RankedLeague: React.FC = () => {
  useRequireAuth();
  const { user } = useAuth();
  const [league, setLeague] = useState<RankedLeagueType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchLeague();
  }, []);

  const fetchLeague = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await rankedLeaguesApi.getCurrent();
      setLeague(response.data.league);
    } catch (err: any) {
      setError(err.message || 'Failed to load ranked league');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const response = await rankedLeaguesApi.joinLeague();
      setLeague(response.data.league);
    } catch (err: any) {
      setError(err.message || 'Failed to join ranked league');
    } finally {
      setJoining(false);
    }
  };

  const isInLeague = league && user
    ? league.players.some(p => p.player._id === user._id)
    : false;

  const daysRemaining = league
    ? Math.max(0, 90 - Math.floor((Date.now() - new Date(league.startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <StarIcon className="h-8 w-8 text-yellow-500" />
          Ranked League
        </h1>
        {!loading && league && !isInLeague && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? 'Joining...' : 'Join Ranked League'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card">
          <p className="text-gray-500 text-center py-8">Loading ranked league...</p>
        </div>
      ) : league ? (
        <>
          <div className="card">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Season started: {new Date(league.startDate).toLocaleDateString()}</span>
              <span>{daysRemaining} days remaining in season</span>
            </div>
            {isInLeague && (
              <p className="mt-2 text-sm text-green-600 font-medium">You are enrolled in this season.</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Leaderboard</h2>
            {league.players.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No players have joined this season yet. Be the first!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 text-sm font-medium text-gray-700 w-12">Rank</th>
                      <th className="text-left py-2 pr-4 text-sm font-medium text-gray-700">Player</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-700">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.players.map((entry, index) => (
                      <tr key={entry.player._id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 pr-4 text-sm font-medium text-gray-500">#{index + 1}</td>
                        <td className="py-3 pr-4">
                          <UserDisplay user={entry.player} size="sm" />
                        </td>
                        <td className="py-3 text-right text-sm font-semibold text-gray-900">
                          {entry.rankedPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default RankedLeague;
