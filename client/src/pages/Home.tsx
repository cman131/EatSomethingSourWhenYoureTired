import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi } from '../hooks/useApi';
import { gamesApi, Game } from '../services/api';
import { 
  ChartBarIcon,
  TrophyIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  
  // Memoize the API call function to prevent infinite loops
  const getGames = React.useCallback(
    (page: number, limit: number) => gamesApi.getGames(page, limit),
    [] // No dependencies - gamesApi.getGames is stable
  );
  
  // Fetch recent games
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
      requiresAuth: true
    },
    {
      name: 'View Games',
      description: 'Browse all submitted games and see game history.',
      icon: ChartBarIcon,
      href: '/games',
      color: 'bg-green-500',
      requiresAuth: false
    },
    {
      name: 'Your Profile',
      description: 'View your game history and statistics.',
      icon: TrophyIcon,
      href: '/profile',
      color: 'bg-yellow-500',
      requiresAuth: true
    },
  ];

  const filteredFeatures = features.filter(f => !f.requiresAuth || isAuthenticated);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-lg shadow-lg p-8 text-white">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">
            {isAuthenticated ? `Welcome back, ${user?.username}!` : 'Welcome to Mahjong Club'}
          </h1>
          <p className="text-xl text-primary-100 mb-6">
            Track and record your mahjong games. Submit completed games with 4 players and their scores 
            to keep a record of your club's mahjong sessions.
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
                  className="btn-secondary border-white text-white hover:bg-white hover:text-primary-600"
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
          {filteredFeatures.map((feature) => (
            <Link
              key={feature.name}
              to={feature.href}
              className="card hover:shadow-lg transition-shadow duration-200 group"
            >
              <div className={`${feature.color} rounded-lg p-3 w-fit mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.name}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Games */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Games</h2>
        {gamesLoading ? (
          <p className="text-gray-500 text-center py-4">Loading games...</p>
        ) : games && games.length > 0 ? (
          <div className="space-y-3">
            {games.slice(0, 5).map((game: Game) => (
              <div key={game._id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Game on {new Date(game.gameDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted by {game.submittedBy.username} • {game.players.length} players
                  </p>
                  <div className="text-xs text-gray-600 mt-1">
                    {game.players
                      .sort((a, b) => b.position - a.position)
                      .map(p => `${p.player.username}: ${p.score}`)
                      .join(' • ')}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  game.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {game.verified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No games submitted yet</p>
        )}
      </div>
    </div>
  );
};

export default Home;

