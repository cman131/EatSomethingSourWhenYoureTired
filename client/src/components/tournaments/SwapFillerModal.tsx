import React, { useState, useEffect, useMemo, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { usersApi, tournamentsApi, Tournament, User } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface SwapFillerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwapped: (tournament: Tournament) => void;
  tournament: Tournament;
}

interface FillerOption {
  fillerId: string;
  label: string;
}

interface RoundFillerOptions {
  roundNumber: number;
  options: FillerOption[];
}

function deriveRoundFillerOptions(tournament: Tournament): RoundFillerOptions[] {
  const rounds = (tournament.rounds || []) as any[];

  return rounds
    .map((round) => {
      const options: FillerOption[] = [];
      for (const pairing of round.pairings || []) {
        for (const playerEntry of pairing.players || []) {
          const player = playerEntry.player;
          if (player && typeof player === 'object' && player.isGuest) {
            options.push({
              fillerId: player._id,
              label: `${player.displayName} — Table ${pairing.tableNumber}, ${playerEntry.seat}`,
            });
          }
        }
      }
      return { roundNumber: round.roundNumber, options };
    })
    .filter((round) => round.options.length > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

function derivePlayerIdsToExclude(tournament: Tournament): Set<string> {
  const ids = new Set<string>();
  for (const entry of tournament.players || []) {
    const id = typeof entry.player === 'string' ? entry.player : entry.player._id;
    if (id) ids.add(id);
  }
  for (const entry of tournament.waitlist || []) {
    const id = typeof entry.player === 'string' ? entry.player : entry.player._id;
    if (id) ids.add(id);
  }
  return ids;
}

const SwapFillerModal: React.FC<SwapFillerModalProps> = ({ isOpen, onClose, onSwapped, tournament }) => {
  const roundFillerOptions = useMemo(() => deriveRoundFillerOptions(tournament), [tournament]);
  const excludedPlayerIds = useMemo(() => derivePlayerIdsToExclude(tournament), [tournament]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [realPlayer, setRealPlayer] = useState<User | null>(null);
  const [roundSelections, setRoundSelections] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const response = await usersApi.searchUsers(searchTerm, 20);
        setSearchResults(
          response.data.users.filter((u) => !u.isGuest && !excludedPlayerIds.has(u._id))
        );
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to search users');
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, excludedPlayerIds]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handlePickRound = (roundNumber: number, fillerId: string) => {
    setRoundSelections((prev) => {
      const next = { ...prev };
      if (fillerId) {
        next[roundNumber] = fillerId;
      } else {
        delete next[roundNumber];
      }
      return next;
    });
  };

  const canSubmit = realPlayer !== null && Object.keys(roundSelections).length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!realPlayer) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await tournamentsApi.swapFiller(tournament._id, {
        realPlayerId: realPlayer._id,
        roundSelections: Object.entries(roundSelections).map(([roundNumber, fillerId]) => ({
          roundNumber: Number(roundNumber),
          fillerId,
        })),
      });
      onSwapped(response.data.tournament);
      setSearchTerm('');
      setSearchResults([]);
      setRealPlayer(null);
      setRoundSelections({});
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to swap filler for walk-in player');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Swap In a Walk-In Player</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              {realPlayer ? (
                <div className="flex items-center justify-between">
                  <UserDisplay user={realPlayer} size="md" showLink={false} showRealName={true} />
                  <button
                    onClick={() => setRealPlayer(null)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="swap-filler-search" className="block text-sm font-medium text-gray-700 mb-2">
                    Search for the walk-in player
                  </label>
                  <input
                    ref={searchInputRef}
                    id="swap-filler-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search users..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />

                  <div className="max-h-96 overflow-y-auto mt-2">
                    {searching ? (
                      <p className="text-gray-500 text-sm py-2">Searching users...</p>
                    ) : (
                      searchResults.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => setRealPlayer(user)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-left"
                        >
                          <UserDisplay user={user} size="md" showLink={false} showRealName={true} className="flex-1" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {roundFillerOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No filler-occupied seats found in this tournament.</p>
            ) : (
              <div className="space-y-3">
                {roundFillerOptions.map(({ roundNumber, options }) => (
                  <div key={roundNumber}>
                    <label
                      htmlFor={`swap-filler-round-${roundNumber}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Round {roundNumber}
                    </label>
                    <select
                      id={`swap-filler-round-${roundNumber}`}
                      value={roundSelections[roundNumber] || ''}
                      onChange={(e) => handlePickRound(roundNumber, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    >
                      <option value="">— not this round —</option>
                      {options.map((option) => (
                        <option key={option.fillerId} value={option.fillerId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Swapping...' : 'Swap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapFillerModal;
