import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useMutation } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { gamesApi, usersApi, User } from '../services/api';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/airbnb.css';

const GameSubmission: React.FC = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [players, setPlayers] = useState([
    { player: '', playerName: '', score: 25000, position: 1 },
    { player: '', playerName: '', score: 25000, position: 2 },
    { player: '', playerName: '', score: 25000, position: 3 },
    { player: '', playerName: '', score: 25000, position: 4 },
  ]);
  const [gameDate, setGameDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [pointsLeftOnTable, setPointsLeftOnTable] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);
  const PlayerSeats = ['East', 'South', 'West', 'North'];
  const searchInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Search users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim().length > 0 && selectedPlayerIndex !== null) {
        try {
          const response = await usersApi.searchUsers(searchTerm, 10);
          setSearchResults(response.data.users);
        } catch (error) {
          console.error('Failed to search users:', error);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedPlayerIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedPlayerIndex !== null) {
        const inputElement = searchInputRefs.current[selectedPlayerIndex];
        const target = event.target as Node;
        
        // Check if click is outside both the input and the dropdown
        if (inputElement && !inputElement.contains(target)) {
          const dropdown = inputElement.parentElement?.querySelector('.user-search-dropdown');
          if (dropdown && !dropdown.contains(target)) {
            setSelectedPlayerIndex(null);
            setSearchTerm('');
            setSearchResults([]);
          }
        }
      }
    };

    if (selectedPlayerIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedPlayerIndex]);

  const { mutate: createGame, loading, error } = useMutation(
    (gameData: {
      players: Array<{ player: string; score: number; position: number }>;
      gameDate: Date;
      notes?: string;
      pointsLeftOnTable?: number;
    }) => gamesApi.createGame(gameData)
  );

  const handlePlayerNameChange = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index].playerName = value;
    setPlayers(newPlayers);
    setSearchTerm(value);
    setSelectedPlayerIndex(index);
  };

  const handleScoreChange = (index: number, value: number) => {
    const newPlayers = [...players];
    newPlayers[index].score = value;
    setPlayers(newPlayers);
  };

  const selectPlayer = (user: User) => {
    if (selectedPlayerIndex !== null) {
      const newPlayers = [...players];
      newPlayers[selectedPlayerIndex].player = user._id;
      newPlayers[selectedPlayerIndex].playerName = user.username;
      setPlayers(newPlayers);
      setSearchTerm('');
      setSearchResults([]);
      setSelectedPlayerIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all players are selected
    if (players.some(p => !p.player)) {
      alert('Please select all 4 players');
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
      alert('You must include yourself as one of the players');
      return;
    }

    // Validate points left on table is a multiple of 100
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
      await createGame({
        players: players.map(p => ({
          player: p.player,
          score: Number(p.score),
          position: p.position
        })),
        gameDate,
        notes: notes || undefined,
        pointsLeftOnTable: pointsLeftOnTable || undefined
      });
      navigate('/games');
    } catch (err) {
      console.error('Failed to submit game:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Submit Game</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label htmlFor="gameDate" className="block text-sm font-medium text-gray-700 mb-2">
            Game Date
          </label>
          <Flatpickr
            id="gameDate"
            className="input-field"
            required
            value={gameDate ? new Date(gameDate) : undefined}
            onChange={(date) => setGameDate(date[0])}
            options={{
              enableTime: true,
              time_24hr: false,
              minuteIncrement: 10,
              dateFormat: 'm-d-Y h:i K',
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Players (4 required)
          </label>
          <div className="space-y-4">
            {players.map((player, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">
                    Player {player.position} ({PlayerSeats[player.position - 1]})
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => (searchInputRefs.current[index] = el)}
                      type="text"
                      placeholder="Search for player..."
                      value={player.playerName}
                      onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                      onFocus={() => {
                        setSelectedPlayerIndex(index);
                        if (player.playerName) {
                          setSearchTerm(player.playerName);
                        }
                      }}
                      className="input-field"
                      required
                    />
                    {selectedPlayerIndex === index && (
                      <div className="user-search-dropdown absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {searchResults.length > 0 ? (
                        <div className="py-1">
                          {searchResults.map((user) => {
                            const isSelected = players.some(p => p.player === user._id);
                            return (
                              <button
                                key={user._id}
                                type="button"
                                onClick={() => !isSelected && selectPlayer(user)}
                                disabled={isSelected}
                                className={`w-full text-left px-4 py-2 hover:bg-primary-50 transition-colors ${
                                  isSelected 
                                    ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                                    : 'cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {user.avatar && (
                                    <div className="flex-shrink-0">
                                      <img
                                        src={user.avatar}
                                        alt={`${user.username}'s avatar`}
                                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                        onError={(e) => {
                                          // Hide image if it fails to load
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{user.username}</div>
                                    {user.email && (
                                      <div className="text-xs text-gray-500">{user.email}</div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <span className="text-xs text-primary-600 font-medium">Selected</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : searchTerm.trim().length > 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          No users found matching "{searchTerm}"
                        </div>
                      ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-600 mb-1">Score</label>
                  <input
                    type="number"
                    value={player.score}
                    step={100}
                    onChange={(e) => handleScoreChange(index, Number(e.target.value))}
                    className="input-field"
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
          <input
            id="pointsLeftOnTable"
            type="number"
            value={pointsLeftOnTable}
            step={1000}
            min={0}
            onChange={(e) => setPointsLeftOnTable(Number(e.target.value) || 0)}
            className="input-field"
            placeholder="0"
          />
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
            disabled={loading}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Game'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default GameSubmission;

