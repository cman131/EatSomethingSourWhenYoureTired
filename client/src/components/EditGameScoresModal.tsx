import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Game, gamesApi } from '../services/api';
import UserDisplay from './user/UserDisplay';

const PLAYER_SEATS = ['East', 'South', 'West', 'North'];

interface EditGameScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  onSave: (updatedGame: Game) => void;
}

const EditGameScoresModal: React.FC<EditGameScoresModalProps> = ({
  isOpen,
  onClose,
  game,
  onSave,
}) => {
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersByPosition = game
    ? [...game.players].sort((a, b) => a.position - b.position)
    : [];

  useEffect(() => {
    if (isOpen && game && game.players.length === 4) {
      const ordered = [...game.players].sort((a, b) => a.position - b.position);
      setScores(ordered.map((p) => p.score));
      setError(null);
    }
  }, [isOpen, game]);

  if (!isOpen || !game) return null;

  const handleScoreChange = (index: number, value: string) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    if (Number.isNaN(num)) return;
    setScores((prev) => {
      const next = [...prev];
      next[index] = num;
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      const playersPayload = playersByPosition.map((p, i) => ({
        player: p.player._id,
        score: scores[i],
        position: p.position,
      }));
      const response = await gamesApi.updateGameScores(game._id, playersPayload);
      onSave(response.data.game);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update scores');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit scores</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Update the scores for each player. Positions (seats) are unchanged.
            </p>
            <div className="space-y-4 mb-6">
              {playersByPosition.map((player, index) => (
                <div
                  key={player.player._id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-0.5">
                      {PLAYER_SEATS[player.position - 1]}
                    </div>
                    <UserDisplay
                      user={player.player}
                      size="sm"
                      nameClassName="font-semibold text-gray-900"
                    />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <label htmlFor={`score-${index}`} className="sr-only">
                      Score for {player.player.displayName}
                    </label>
                    <input
                      id={`score-${index}`}
                      type="number"
                      value={scores[index]}
                      onChange={(e) => handleScoreChange(index, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      disabled={saving}
                    />
                  </div>
                </div>
              ))}
            </div>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditGameScoresModal;
