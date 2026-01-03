import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePaginatedApi } from '../hooks/useApi';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { tournamentsApi, Tournament } from '../services/api';
import UserAvatar from '../components/user/UserAvatar';
import { MagnifyingGlassIcon, PlusIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const TournamentsList: React.FC = () => {
  useRequireAuth();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const pageLimit = 20;

  // Memoize the API call function to prevent infinite loops
  const getTournaments = React.useCallback(
    (page: number, limit: number) => tournamentsApi.getTournaments(page, limit),
    []
  );

  // Fetch tournaments with pagination
  const { data: tournaments, loading, pagination, loadPage } = usePaginatedApi<Tournament>(
    getTournaments,
    1,
    pageLimit
  );

  // Filter tournaments based on search term (client-side filtering)
  const filteredTournaments = useMemo(() => {
    if (!tournaments || !searchTerm.trim()) {
      return tournaments || [];
    }

    const searchLower = searchTerm.toLowerCase();
    return tournaments.filter((tournament: Tournament) => {
      // Search in tournament name
      const name = tournament.name.toLowerCase();
      
      // Search in description
      const description = (tournament.description || '').toLowerCase();
      
      // Search in tournament date
      const tournamentDate = new Date(tournament.date).toLocaleDateString().toLowerCase();
      
      // Search in player display names
      const playerNames = tournament.players
        .filter(p => !p.dropped)
        .map(p => p.player.displayName.toLowerCase())
        .join(' ');

      return (
        name.includes(searchLower) ||
        description.includes(searchLower) ||
        tournamentDate.includes(searchLower) ||
        playerNames.includes(searchLower)
      );
    });
  }, [tournaments, searchTerm]);

  const handlePageChange = (page: number) => {
    loadPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const getActivePlayerCount = (tournament: Tournament) => {
    return tournament.players.filter(p => !p.dropped).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">All Tournaments</h1>
        {user?.isAdmin === true && (
          <Link to="/create-tournament" className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Create Tournament
          </Link>
        )}
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by tournament name, description, date, or player name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Tournaments List */}
      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading tournaments...</p>
        ) : filteredTournaments && filteredTournaments.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {searchTerm ? (
                <span>
                  Showing {filteredTournaments.length} result{filteredTournaments.length !== 1 ? 's' : ''} 
                  {searchTerm && ` for "${searchTerm}"`}
                </span>
              ) : (
                <span>
                  Showing {((pagination.page - 1) * pagination.limit) + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tournaments
                </span>
              )}
            </div>
            <div className="space-y-4">
              {filteredTournaments.map((tournament: Tournament) => {
                const activePlayerCount = getActivePlayerCount(tournament);
                return (
                  <div
                    key={tournament._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            to={`/tournaments/${tournament._id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer"
                          >
                            {tournament.name}
                          </Link>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(tournament.status)}`}>
                            {tournament.status}
                          </span>
                          {tournament.isEastOnly && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                              East Only
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
                          <div className="flex items-center gap-1">
                            <UserGroupIcon className="h-4 w-4" />
                            {activePlayerCount} player{activePlayerCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {tournament.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {tournament.description}
                          </p>
                        )}
                        {activePlayerCount > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {tournament.players
                              .filter(p => !p.dropped)
                              .slice(0, 8)
                              .map((playerEntry) => (
                                playerEntry.player.privateMode ? (
                                  <div
                                    key={playerEntry.player._id}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md text-sm text-gray-700"
                                  >
                                    <UserAvatar
                                      user={playerEntry.player}
                                      size="xs"
                                    />
                                    <span>{playerEntry.player.displayName}</span>
                                  </div>
                                ) : (
                                  <Link
                                    key={playerEntry.player._id}
                                    to={`/profile/${playerEntry.player._id}`}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                                  >
                                    <UserAvatar
                                      user={playerEntry.player}
                                      size="xs"
                                    />
                                    <span>{playerEntry.player.displayName}</span>
                                  </Link>
                                )
                              ))}
                            {activePlayerCount > 8 && (
                              <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-md text-sm text-gray-500">
                                +{activePlayerCount - 8} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination - only show if not searching */}
            {!searchTerm && pagination.pages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum = 1;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-md ${
                          pagination.page === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <span className="text-sm text-gray-600 ml-4">
                  Page {pagination.page} of {pagination.pages}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {searchTerm ? `No tournaments found matching "${searchTerm}"` : 'No tournaments found'}
          </p>
        )}
      </div>
    </div>
  );
};

export default TournamentsList;

