import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Tournament } from '../../services/api';

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

const SwapFillerModal: React.FC<SwapFillerModalProps> = ({ isOpen, onClose, tournament }) => {
  const roundFillerOptions = useMemo(() => deriveRoundFillerOptions(tournament), [tournament]);

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

            {roundFillerOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No filler-occupied seats found in this tournament.</p>
            ) : (
              <div className="space-y-3">
                {roundFillerOptions.map(({ roundNumber, options }) => (
                  <div key={roundNumber}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Round {roundNumber}
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapFillerModal;
