import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi } from '../hooks/useApi';
import { gamesApi, Game } from '../services/api';
import { 
  ChartBarIcon,
  CalendarIcon,
  ArrowTopRightOnSquareIcon,
  CalculatorIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const PlayerSeats = ['East', 'South', 'West', 'North'];
  
  // Memoize the API call function to prevent infinite loops
  // Only fetch games if user is authenticated
  const getGames = React.useCallback(
    (page: number, limit: number) => {
      if (!isAuthenticated) {
        // Return empty data when not authenticated
        return Promise.resolve({
          success: true,
          data: {
            items: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 0
            }
          }
        });
      }
      return gamesApi.getGames(page, limit);
    },
    [isAuthenticated]
  );
  
  // Fetch recent games (only when authenticated)
  const { data: games, loading: gamesLoading } = usePaginatedApi<Game>(
    getGames,
    1,
    10
  );

  const features = [
    {
      name: 'View Upcoming Events',
      description: 'View upcoming mahjong events in the Charleston area.',
      icon: CalendarIcon,
      href: 'https://www.meetup.com/charleston-riichi-mahjong/events/',
      color: 'bg-blue-500',
      requiresAuth: false,
      external: true
    },
    {
      name: 'Score a Hand',
      description: 'Calculate the score for your Riichi Mahjong hand',
      icon: CalculatorIcon,
      href: '/calculator',
      color: 'bg-red-500',
      requiresAuth: false,
      external: false
    },
    {
      name: 'View Games',
      description: 'Browse all submitted games and see game history.',
      icon: ChartBarIcon,
      href: '/games',
      color: 'bg-green-500',
      requiresAuth: true,
      external: false
    },
    {
      name: 'View Members',
      description: 'Browse all club members and view their profiles.',
      icon: UserGroupIcon,
      href: '/members',
      color: 'bg-purple-500',
      requiresAuth: true,
      external: false
    },
    {
      name: 'Do a Quiz',
      description: 'Test your mahjong knowledge with discard quizzes.',
      icon: QuestionMarkCircleIcon,
      href: '/discard-quiz',
      color: 'bg-yellow-500',
      requiresAuth: true,
      external: false
    },
    {
      name: 'Shop Merch',
      description: 'Browse and purchase Charleston Riichi Mahjong merchandise.',
      icon: ShoppingBagIcon,
      href: 'https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club',
      color: 'bg-indigo-500',
      requiresAuth: false,
      external: true
    },
  ];

  const filteredFeatures = features.filter(f => !f.requiresAuth || isAuthenticated);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg shadow-lg p-8 text-white">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">
            {isAuthenticated ? `Welcome back, ${user?.displayName}!` : 'Welcome to Charleston\'s Riichi Mahjong Club!'}
          </h1>
          <p className="text-xl text-primary-100 mb-6">
            We primarily play 10am - 12pm every Sunday at <b>
              <a href="https://blumsc.com" rel="noreferrer" target="_blank"><ArrowTopRightOnSquareIcon className="h-4 w-4 inline-block mr-1" />Blum downtown
              </a></b>.
            <br/>
            All skill levels are welcome and we're happy to teach! Come learn to play {":)"}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/submit-game"
                  className="btn-primary bg-white text-primary-600 hover:bg-gray-100"
                >
                  Submit New Game
                </Link>
                <Link
                  to="/profile"
                  className="btn-primary bg-white text-primary-600 hover:bg-gray-100"
                >
                  View Profile
                </Link>
              </>
            ) : (
              <Link
                to="/register"
                className="btn-primary bg-white text-primary-600 hover:bg-gray-100"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Get Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFeatures.map((feature) => {
            const cardContent = (
              <>
                <div className={`${feature.color} rounded-lg p-3 w-fit mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.name}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </>
            );

            return feature.external ? (
              <a
                key={feature.name}
                href={feature.href}
                target="_blank"
                rel="noreferrer"
                className="card hover:shadow-lg transition-shadow duration-200 group"
              >
                {cardContent}
              </a>
            ) : (
              <Link
                key={feature.name}
                to={feature.href}
                className="card hover:shadow-lg transition-shadow duration-200 group"
              >
                {cardContent}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Games */}
      {isAuthenticated && (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Games</h2>
        {gamesLoading ? (
          <p className="text-gray-500 text-center py-8">Loading games...</p>
        ) : games && games.length > 0 ? (
          <div className="space-y-4">
            {games.slice(0, 5).map((game: Game) => (
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
                      <Link
                        to={`/profile/${game.submittedBy._id}`}
                        className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {game.submittedBy.displayName}
                      </Link>
                      {game.verifiedBy && (
                        <>
                          {' '}• Verified by{' '}
                          <Link
                            to={`/profile/${game.verifiedBy._id}`}
                            className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {game.verifiedBy.displayName}
                          </Link>
                        </>
                      )}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      {game.players
                        .sort((a, b) => b.score - a.score)
                        .map((player) => (
                          <div
                            key={player.player._id}
                            className="bg-gray-50 rounded-md p-3"
                          >
                            <div className="text-xs text-gray-500 mb-1">
                              {PlayerSeats[player.position - 1]}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              {player.player.avatar && (
                                <img
                                  src={player.player.avatar}
                                      alt={player.player.displayName}
                                  className="w-8 h-8 rounded-full object-cover"
                                  onError={(e) => {
                                    // Hide image if it fails to load
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                              <Link
                                to={`/profile/${player.player._id}`}
                                className="font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors"
                              >
                                    {player.player.displayName}
                              </Link>
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
          ) : (
            <p className="text-gray-500 text-center py-8">No games submitted yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;

