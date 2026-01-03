import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

const PlayerSeats = ['East', 'South', 'West', 'North'];

interface GameHistorySectionProps {
  gamesLoading: boolean;
  profileUserId: string;
  allGames: Game[] | null;
}

const GAMES_PER_PAGE = 10;

const GameHistorySection: React.FC<GameHistorySectionProps> = ({
  gamesLoading,
  profileUserId,
  allGames,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Paginate the games
  const paginatedGames = useMemo(() => {
    if (!allGames) return [];
    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    const endIndex = startIndex + GAMES_PER_PAGE;
    return allGames.slice(startIndex, endIndex);
  }, [allGames, currentPage]);

  const totalPages = useMemo(() => {
    if (!allGames) return 0;
    return Math.ceil(allGames.length / GAMES_PER_PAGE);
  }, [allGames]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Game History</h2>
      {gamesLoading ? (
        <p className="text-gray-500 text-center py-8">Loading games...</p>
      ) : allGames && allGames.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-gray-600">
            <span>
              Showing {((currentPage - 1) * GAMES_PER_PAGE) + 1}-
              {Math.min(currentPage * GAMES_PER_PAGE, allGames.length)} of {allGames.length} games
            </span>
          </div>
          <div className="space-y-4">
            {paginatedGames.map((game: Game) => {
              return (
                <div
                  key={game._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          to={`/games/${game._id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer"
                        >
                          Game on {new Date(game.gameDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Link>
                        {game.isEastOnly && (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                            East Only
                          </span>
                        )}
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
                        Submitted by{' '}
                        {game.submittedBy.privateMode ? (
                          <span className="font-medium text-gray-900">
                            {game.submittedBy.displayName}
                          </span>
                        ) : (
                          <Link
                            to={`/profile/${game.submittedBy._id}`}
                            className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {game.submittedBy.displayName}
                          </Link>
                        )}
                        {game.verifiedBy && (
                          <>
                            {' '}• Verified by{' '}
                            {game.verifiedBy.privateMode ? (
                              <span className="font-medium text-gray-900">
                                {game.verifiedBy.displayName}
                              </span>
                            ) : (
                              <Link
                                to={`/profile/${game.verifiedBy._id}`}
                                className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                              >
                                {game.verifiedBy.displayName}
                              </Link>
                            )}
                          </>
                        )}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        {game.players
                          .sort((a, b) => b.score - a.score)
                          .map((player) => (
                            <div
                              key={player.player._id}
                              className={`bg-gray-50 rounded-md p-3 ${
                                player.player._id === profileUserId ? 'ring-2 ring-primary-500' : ''
                              }`}
                            >
                              <div className="text-xs text-gray-500 mb-1">
                                {PlayerSeats[player.position - 1]}
                              </div>
                              <UserDisplay
                                user={player.player}
                                size="sm"
                                showLink={player.player._id !== profileUserId}
                                className="mb-1"
                              />
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
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = 1;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm rounded-md ${
                        currentPage === pageNum
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <span className="text-sm text-gray-600 ml-4">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-center py-8">No games found</p>
      )}
    </div>
  );
};

export default GameHistorySection;

