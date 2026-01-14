import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { tournamentsApi, Tournament } from '../../services/api';
import { TrophyIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface TournamentResultsSectionProps {
  profileUserId: string;
}

interface TournamentResult {
  tournament: Tournament;
  rank: number;
}

const TournamentResultsSection: React.FC<TournamentResultsSectionProps> = ({
  profileUserId,
}) => {
  // Fetch all tournaments by making multiple requests if needed
  const getAllTournaments = React.useCallback(async () => {
    const allTournaments: Tournament[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await tournamentsApi.getTournaments(page, limit);
      const tournaments = response.data.items;
      allTournaments.push(...tournaments);
      
      hasMore = tournaments.length === limit && page < response.data.pagination.pages;
      page++;
    }

    return allTournaments;
  }, []);

  const { data: tournaments, loading } = useApi<Tournament[]>(
    getAllTournaments,
    []
  );

  // Calculate tournament results for completed tournaments
  const tournamentResults = useMemo(() => {
    if (!tournaments || tournaments.length === 0 || !profileUserId) return [];

    const results: TournamentResult[] = [];

    for (const tournament of tournaments) {
      // Only process completed tournaments
      if (tournament.status !== 'Completed') continue;

      // Check if user participated in this tournament
      const userPlayer = tournament.players.find(
        (p) => p.player._id === profileUserId && !p.dropped
      );

      if (!userPlayer) continue;

      // Calculate rank using the same logic as Standings component
      const activePlayers = tournament.players.filter((p) => !p.dropped);

      // Helper function to get seat order (East=1, South=2, West=3, North=4)
      const getSeatOrder = (seat: string): number => {
        const seatOrder: Record<string, number> = {
          East: 1,
          South: 2,
          West: 3,
          North: 4,
        };
        return seatOrder[seat] || 99;
      };

      // Helper function to find player's pairing in latest round
      const getPlayerPairing = (playerId: string) => {
        if (!tournament.rounds) return null;

        const roundsWithPairings = tournament.rounds
          .filter((r) => r.pairings && r.pairings.length > 0)
          .sort((a, b) => b.roundNumber - a.roundNumber);

        const latestRound =
          roundsWithPairings.length > 0 ? roundsWithPairings[0] : null;
        if (!latestRound) return null;

        for (const pairing of latestRound.pairings) {
          const playerEntry = pairing.players.find((p: any) => {
            const pId =
              typeof p.player === 'string' ? p.player : p.player?._id;
            return pId === playerId;
          });

          if (playerEntry) {
            return {
              tableNumber: pairing.tableNumber,
              seat: playerEntry.seat,
            };
          }
        }
        return null;
      };

      // Sort by UMA descending, then table number ascending, then seat order
      const sorted = [...activePlayers].sort((a, b) => {
        // First: UMA (descending - higher is better)
        if (b.uma !== a.uma) {
          return b.uma - a.uma;
        }

        // Second: Table number (ascending - lower is better)
        const aPairing = getPlayerPairing(a.player._id);
        const bPairing = getPlayerPairing(b.player._id);

        // If one player has no pairing, they rank lower
        if (!aPairing && !bPairing) {
          return 0;
        }
        if (!aPairing) return 1;
        if (!bPairing) return -1;

        if (aPairing.tableNumber !== bPairing.tableNumber) {
          return aPairing.tableNumber - bPairing.tableNumber;
        }

        // Third: Seat order (East, South, West, North)
        const aSeatOrder = getSeatOrder(aPairing.seat);
        const bSeatOrder = getSeatOrder(bPairing.seat);
        return aSeatOrder - bSeatOrder;
      });

      // Find user's rank
      const userRank =
        sorted.findIndex((p) => p.player._id === profileUserId) + 1;

      if (userRank > 0) {
        results.push({
          tournament,
          rank: userRank,
        });
      }
    }

    // Sort by date descending (most recent first)
    return results.sort(
      (a, b) =>
        new Date(b.tournament.date).getTime() -
        new Date(a.tournament.date).getTime()
    );
  }, [tournaments, profileUserId]);

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇 1st';
    if (rank === 2) return '🥈 2nd';
    if (rank === 3) return '🥉 3rd';
    return `${rank}${rank === 11 || rank === 12 || rank === 13 ? 'th' : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th'}`;
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Tournament Results
        </h2>
        <p className="text-gray-500 text-center py-8">Loading tournament results...</p>
      </div>
    );
  }

  if (tournamentResults.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Tournament Results
        </h2>
        <p className="text-gray-500 text-center py-8">
          No completed tournament results yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrophyIcon className="h-5 w-5" />
        Tournament Results
      </h2>
      <div className="space-y-3">
        {tournamentResults.map((result) => {
          const tournamentDate = new Date(result.tournament.date);
          const formattedDate = tournamentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            <Link
              key={result.tournament._id}
              to={`/tournaments/${result.tournament._id}`}
              className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {result.tournament.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{formattedDate}</span>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {getRankDisplay(result.rank)}
                    </div>
                    <div className="text-xs text-gray-500">Place</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentResultsSection;
