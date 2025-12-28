import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePaginatedApi } from '../hooks/useApi';
import { gamesApi, Game } from '../services/api';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

const GamesList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const pageLimit = 20;

  // Memoize the API call function to prevent infinite loops
  const getGames = React.useCallback(
    (page: number, limit: number) => gamesApi.getGames(page, limit),
    []
  );

  // Fetch games with pagination
  const { data: games, loading, pagination, loadPage } = usePaginatedApi<Game>(
    getGames,
    1,
    pageLimit
  );

  // Filter games based on search term (client-side filtering)
  const filteredGames = useMemo(() => {
    if (!games || !searchTerm.trim()) {
      return games || [];
    }

    const searchLower = searchTerm.toLowerCase();
    return games.filter((game: Game) => {
      // Search in player usernames
      const playerNames = game.players
        .map(p => p.player.username.toLowerCase())
        .join(' ');
      
      // Search in submitter username
      const submitterName = game.submittedBy.username.toLowerCase();
      
      // Search in game date
      const gameDate = new Date(game.gameDate).toLocaleDateString().toLowerCase();
      
      // Search in notes
      const notes = (game.notes || '').toLowerCase();

      return (
        playerNames.includes(searchLower) ||
        submitterName.includes(searchLower) ||
        gameDate.includes(searchLower) ||
        notes.includes(searchLower)
      );
    });
  }, [games, searchTerm]);

  const handlePageChange = (page: number) => {
    loadPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">All Games</h1>
        <Link to="/submit-game" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Submit Game
        </Link>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by player name, submitter, date, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Games List */}
      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading games...</p>
        ) : filteredGames && filteredGames.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {searchTerm ? (
                <span>
                  Showing {filteredGames.length} result{filteredGames.length !== 1 ? 's' : ''} 
                  {searchTerm && ` for "${searchTerm}"`}
                </span>
              ) : (
                <span>
                  Showing {((pagination.page - 1) * pagination.limit) + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} games
                </span>
              )}
            </div>
            <div className="space-y-4">
              {filteredGames.map((game: Game) => (
                <div
                  key={game._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Game on {new Date(game.gameDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            game.verified
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {game.verified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Submitted by <span className="font-medium">{game.submittedBy.username}</span>
                        {game.verifiedBy && (
                          <> • Verified by {game.verifiedBy.username}</>
                        )}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        {game.players
                          .sort((a, b) => b.position - a.position)
                          .map((player) => (
                            <div
                              key={player.player._id}
                              className="bg-gray-50 rounded-md p-3"
                            >
                              <div className="text-xs text-gray-500 mb-1">
                                Position {player.position}
                              </div>
                              <div className="font-medium text-gray-900">
                                {player.player.username}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                Score: <span className="font-semibold">{player.score}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                      {game.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {game.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            {searchTerm ? `No games found matching "${searchTerm}"` : 'No games found'}
          </p>
        )}
      </div>
    </div>
  );
};

export default GamesList;

