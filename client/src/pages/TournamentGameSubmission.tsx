import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useMutation } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { tournamentsApi } from '../services/api';
import NumericInput from '../components/NumericInput';

const TournamentGameSubmission: React.FC = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tournamentId, roundNumber, tableNumber } = useParams<{
    tournamentId: string;
    roundNumber: string;
    tableNumber: string;
  }>();

  const [players, setPlayers] = useState<
    Array<{ player: string; playerName: string; score: number; position: number; seat: string }>
  >([]);
  const [notes, setNotes] = useState('');
  const [pointsLeftOnTable, setPointsLeftOnTable] = useState(0);
  const [ranOutOfTime, setRanOutOfTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairingIndex, setPairingIndex] = useState<number | undefined>(undefined);

  // Load tournament and pairing data
  useEffect(() => {
    const loadPairingData = async () => {
      if (!tournamentId || !roundNumber || !tableNumber) {
        setError('Invalid tournament or pairing information');
        setLoading(false);
        return;
      }

      try {
        const response = await tournamentsApi.getTournament(tournamentId);
        const tournament = response.data.tournament;

        // Find the round
        const round = tournament.rounds?.find(
          (r: any) => r.roundNumber === parseInt(roundNumber)
        );

        if (!round) {
          setError('Round not found');
          setLoading(false);
          return;
        }

        // Find the pairing by table number
        const pairingIndex = round.pairings.findIndex(
          (p: any) => p.tableNumber === parseInt(tableNumber)
        );

        if (pairingIndex === -1) {
          setError('Pairing not found');
          setLoading(false);
          return;
        }

        const pairing = round.pairings[pairingIndex];
        setPairingIndex(pairingIndex);

        // Check if pairing already has a game
        if (pairing.game) {
          setError('This pairing already has a game submitted');
          setLoading(false);
          return;
        }

        // Map seat order to position (East=1, South=2, West=3, North=4)
        const seatToPosition: { [key: string]: number } = {
          East: 1,
          South: 2,
          West: 3,
          North: 4,
        };

        // Populate players from pairing
        const pairingPlayers = pairing.players.map((playerEntry: any) => {
          const player = playerEntry.player;
          const playerId = typeof player === 'string' ? player : player?._id;
          const displayName =
            typeof player === 'string' ? 'Loading...' : player?.displayName || 'Unknown';

          return {
            player: playerId || '',
            playerName: displayName,
            score: 25000,
            position: seatToPosition[playerEntry.seat] || 1,
            seat: playerEntry.seat,
          };
        });

        // Sort by position (East, South, West, North)
        pairingPlayers.sort((a: typeof pairingPlayers[0], b: typeof pairingPlayers[0]) => a.position - b.position);

        setPlayers(pairingPlayers);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load pairing data:', err);
        setError(err.message || 'Failed to load pairing data');
        setLoading(false);
      }
    };

    loadPairingData();
  }, [tournamentId, roundNumber, tableNumber]);

  const { mutate: submitGame, loading: submitting } = useMutation(
    (gameData: {
      players: Array<{ player: string; score: number; position: number }>;
      notes?: string;
      pointsLeftOnTable?: number;
      ranOutOfTime?: boolean;
      roundNumber: number;
      pairingIndex?: number;
    }) => tournamentsApi.submitTournamentGame(tournamentId!, gameData)
  );

  const handleScoreChange = (index: number, value: number | null) => {
    const newPlayers = [...players];
    newPlayers[index].score = value ?? 0;
    setPlayers(newPlayers);
  };

  const isFormValid = () => {
    // Validate all players are selected
    if (players.some(p => !p.player)) {
      return false;
    }

    // Validate all scores are numbers
    if (players.some(p => p.score === undefined || p.score === null || isNaN(Number(p.score)))) {
      return false;
    }

    // Validate all players are unique
    const playerIds = players.map(p => p.player);
    if (new Set(playerIds).size !== 4) {
      return false;
    }

    // Validate that the authenticated user is one of the players
    if (!user || !playerIds.includes(user._id)) {
      return false;
    }

    // Validate points left on table is a multiple of 1000
    if (pointsLeftOnTable % 1000 !== 0) {
      return false;
    }

    // Validate total score (players + table) equals 100000 or 120000
    const playersTotal = players.reduce((sum, p) => sum + Number(p.score), 0);
    const totalScore = playersTotal + pointsLeftOnTable;
    if (totalScore !== 100000 && totalScore !== 120000) {
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tournamentId || !roundNumber) {
      alert('Invalid tournament or round information');
      return;
    }

    // Validate all players are selected
    if (players.some(p => !p.player)) {
      alert('Please ensure all players are loaded');
      return;
    }

    // Validate all scores are numbers
    if (players.some(p => !p.score || isNaN(Number(p.score)))) {
      alert('Please enter valid scores for all players');
      return;
    }

    // Validate all players are unique
    const playerIds = players.map(p => p.player);
    if (new Set(playerIds).size !== 4) {
      alert('All players must be unique');
      return;
    }

    // Validate that the authenticated user is one of the players
    if (!user || !playerIds.includes(user._id)) {
      alert('You must be one of the players in this pairing');
      return;
    }

    // Validate points left on table is a multiple of 1000
    if (pointsLeftOnTable % 1000 !== 0) {
      alert('Points left on table must be a multiple of 1000');
      return;
    }

    // Validate total score (players + table) equals 100000 or 120000
    const playersTotal = players.reduce((sum, p) => sum + Number(p.score), 0);
    const totalScore = playersTotal + pointsLeftOnTable;
    if (totalScore !== 100000 && totalScore !== 120000) {
      alert(`Total score (players + table) must equal exactly 100000 or 120000. Current total: ${totalScore}`);
      return;
    }

    try {
      const gameData: {
        players: Array<{ player: string; score: number; position: number }>;
        notes?: string;
        pointsLeftOnTable?: number;
        ranOutOfTime?: boolean;
        roundNumber: number;
        pairingIndex?: number;
      } = {
        players: players.map(p => ({
          player: p.player,
          score: Number(p.score),
          position: p.position
        })),
        notes: notes || undefined,
        pointsLeftOnTable: pointsLeftOnTable || undefined,
        ranOutOfTime: ranOutOfTime || undefined,
        roundNumber: parseInt(roundNumber),
        pairingIndex: pairingIndex,
      };
      await submitGame(gameData);
      navigate(`/tournaments/${tournamentId}`);
    } catch (err) {
      console.error('Failed to submit game:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <p className="text-center text-gray-600">Loading pairing data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Submit Tournament Game</h1>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Players (4 required)
          </label>
          <div className="space-y-4">
            {players.map((player, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">
                    {player.seat} (Position {player.position})
                  </label>
                  <input
                    type="text"
                    value={player.playerName}
                    disabled
                    className="input-field bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <div className="w-24 flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Score</label>
                  <NumericInput
                    value={player.score}
                    onChange={(value) => handleScoreChange(index, value)}
                    step={1000}
                    className="w-full"
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="pointsLeftOnTable" className="block text-sm font-medium text-gray-700 mb-2">
            Points Left on Table (optional)
          </label>
          <NumericInput
            id="pointsLeftOnTable"
            value={pointsLeftOnTable}
            onChange={(value) => setPointsLeftOnTable(value ?? 0)}
            step={1000}
            min={0}
            className="w-full"
            required
          />
          <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total:</span>
              <span className="text-lg font-semibold text-gray-900">
                {(players.reduce((sum, p) => sum + Number(p.score), 0) + pointsLeftOnTable).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer" title="Check this if the game was ended because of time running out">
            <input
              type="checkbox"
              checked={ranOutOfTime}
              onChange={(e) => setRanOutOfTime(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Ran Out of Time</span>
          </label>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field"
            rows={3}
            maxLength={500}
            placeholder="Any additional notes about the game..."
          />
          <p className="mt-1 text-xs text-gray-500">{notes.length}/500 characters</p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting || !isFormValid()}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Game'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default TournamentGameSubmission;

