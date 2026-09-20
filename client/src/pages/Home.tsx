import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedApi, useApi } from '../hooks/useApi';
import { gamesApi, Game, tournamentsApi, Tournament, PaginatedResponse } from '../services/api';
import UserDisplay from '../components/user/UserDisplay';
import { CalculatorIcon } from '@heroicons/react/24/outline';

const MEETUP_URL = 'https://www.meetup.com/charleston-riichi-mahjong/events/';
const DISCORD_URL = 'https://discord.gg/xhZtZZF3Jk';
const PLAYER_SEATS = ['East', 'South', 'West', 'North'];

const CLUB_PHOTOS = [
  { src: '/images/club/best_pic.jpg', alt: 'Club members playing together' },
  { src: '/images/club/session-mural.jpg', alt: 'Playing in front of the colorful mural' },
  { src: '/images/club/session-wide.jpg', alt: "A busy Sunday session at Annie O'Loves" },
];

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getTournaments = React.useCallback(
    () => tournamentsApi.getTournaments(1, 100),
    []
  );
  const { data: tournamentsResponse } = useApi<PaginatedResponse<Tournament>>(getTournaments);

  const nextTournament: Tournament | null = React.useMemo(() => {
    if (!tournamentsResponse?.data?.items) return null;
    const now = new Date();
    return (
      tournamentsResponse.data.items
        .filter(t => t.status === 'NotStarted' && new Date(t.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null
    );
  }, [tournamentsResponse]);

  const getGames = React.useCallback(
    (page: number, limit: number) => {
      if (!isAuthenticated) {
        return Promise.resolve({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } },
        });
      }
      return gamesApi.getGames(page, limit);
    },
    [isAuthenticated]
  );
  const { data: games, loading: gamesLoading } = usePaginatedApi<Game>(getGames, 1, 5);

  if (isAuthenticated) {
    return (
      <div className="space-y-6">
        {/* Greeting strip */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900">Welcome back, {user?.displayName}!</span>
          <Link
            to="/submit-game"
            className="bg-primary-600 text-white text-sm font-semibold px-3 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            + Submit Game
          </Link>
        </div>

        {/* Tournaments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Tournaments</h2>
            <Link to="/tournaments" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {nextTournament && (
              <div className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Upcoming</div>
                    <div className="font-semibold text-gray-900">{nextTournament.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(nextTournament.date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {nextTournament.location &&
                        ` · ${nextTournament.location.city}, ${nextTournament.location.state}`}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/tournaments/${nextTournament._id}`}
                  className="text-sm text-primary-600 font-semibold mt-3 inline-block hover:text-primary-700"
                >
                  View details →
                </Link>
              </div>
            )}
            <div className="card flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ranked League</div>
                <div className="font-semibold text-gray-900">Current Season</div>
              </div>
              <Link to="/ranked" className="text-sm text-primary-600 font-semibold hover:text-primary-700">
                View →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent games */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Recent Games</h2>
            <Link to="/games" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="card">
            {gamesLoading ? (
              <p className="text-gray-500 text-center py-8">Loading games...</p>
            ) : games && games.length > 0 ? (
              <div className="space-y-4">
                {games.slice(0, 5).map((game: Game) => (
                  <div key={game._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <Link
                            to={`/games/${game._id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer"
                          >
                            Game on{' '}
                            {new Date(game.gameDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </Link>
                          {game.isEastOnly && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                              East Only
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              game.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {game.verified ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Submitted by{' '}
                          {game.submittedBy.privateMode ? (
                            <span className="font-medium text-gray-900">{game.submittedBy.displayName}</span>
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
                                <span className="font-medium text-gray-900">{game.verifiedBy.displayName}</span>
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
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          {[...game.players]
                            .sort((a, b) => b.score - a.score)
                            .map((player) => (
                              <div key={player.player._id} className="bg-gray-50 rounded-md p-3">
                                <div className="text-xs text-gray-500 mb-1">{PLAYER_SEATS[player.position - 1]}</div>
                                <UserDisplay user={player.player} size="sm" className="mb-1" />
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
        </div>
      </div>
    );
  }

  // Guest view
  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-b from-primary-600 to-primary-800 rounded-t-lg shadow-lg px-6 py-10 text-white text-center">
        <p className="text-xs text-primary-200 uppercase tracking-widest mb-2">Charleston, SC</p>
        <h1 className="text-3xl font-black mb-3 leading-tight">Riichi Mahjong Club</h1>
        <p className="text-primary-100 mb-7 text-sm">
          Sundays 10am–1pm · Annie O&apos;Loves · All skill levels welcome!
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <a
            href={MEETUP_URL}
            target="_blank"
            rel="noreferrer"
            className="bg-white text-primary-700 font-bold py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            📅 Join us on Meetup
          </a>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="bg-white/15 text-white font-bold py-3 rounded-lg border border-white/40 hover:bg-white/25 transition-colors"
          >
            💬 Join our Discord
          </a>
        </div>
      </div>

      {/* Photo strip — flush to bottom of hero, no gap */}
      <div className="grid grid-cols-3 gap-0.5">
        {CLUB_PHOTOS.map((photo) => (
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            className="w-full h-28 object-cover"
            loading="lazy"
          />
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 mt-2 mb-4">
        Our Sunday sessions at Annie O&apos;Loves
      </p>

      {/* Calculator quick link */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">Score a hand</span>
        <Link
          to="/calculator"
          className="text-sm text-primary-600 font-semibold flex items-center gap-1 hover:text-primary-700"
        >
          <CalculatorIcon className="h-4 w-4" />
          Calculator →
        </Link>
      </div>

      {/* Upcoming tournament — hidden when none exists */}
      {nextTournament && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Upcoming Tournament</p>
          <p className="font-semibold text-gray-900">{nextTournament.name}</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(nextTournament.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            {nextTournament.location &&
              ` · ${nextTournament.location.city}, ${nextTournament.location.state}`}
          </p>
          <Link
            to={`/tournaments/${nextTournament._id}`}
            className="text-sm text-primary-600 font-semibold mt-2 inline-block hover:text-primary-700"
          >
            View details →
          </Link>
        </div>
      )}
    </div>
  );
};

export default Home;
