import React from 'react';

interface Props {
  onClose: () => void;
}

const GAME_ROWS: [string, string][] = [
  ['1st place', '+10'],
  ['2nd place', '+7'],
  ['3rd place', '+4'],
  ['4th place', '+2'],
  ['Submit a game', '+2'],
  ['Verify a game', '+1'],
];

const TOURNAMENT_ROWS: [string, string][] = [
  ['Participate', '+15'],
  ['1st place', '+200'],
  ['2nd place', '+100'],
  ['3rd place', '+70'],
  ['4th place', '+50'],
];

// Mirrors GAME_DAILY_CAP and REPEAT_GROUP_* in server/src/utils/pointsService.js — keep in sync.
const GAME_DAILY_CAP = 60;
const REPEAT_GROUP_MAX_GAMES = 6;
const REPEAT_GROUP_WINDOW_DAYS = 7;

function PointsTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="min-w-full text-sm">
      <tbody className="divide-y divide-gray-100">
        {rows.map(([label, pts]) => (
          <tr key={label}>
            <td className="py-2 text-gray-700">{label}</td>
            <td className="py-2 text-right font-medium text-green-600">{pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const PointsHelpModal: React.FC<Props> = ({ onClose }) => (
  <div
    data-testid="modal-backdrop"
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">How to Earn Points</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ✕
        </button>
      </div>
      <div className="p-6 space-y-6">
        <section aria-label="Games">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Games</h3>
          <PointsTable rows={GAME_ROWS} />
        </section>
        <section aria-label="Tournaments">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Tournaments</h3>
          <PointsTable rows={TOURNAMENT_ROWS} />
        </section>
        <section aria-label="Ranked League">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Ranked League</h3>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 text-gray-700">Qualify for the leaderboard</td>
                <td className="py-2 text-right font-medium text-green-600">+10</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section aria-label="Limits">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Limits</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>
              You can earn at most {GAME_DAILY_CAP} game points in any 24-hour period. Awards
              beyond that are trimmed or skipped.
            </li>
            <li>
              The same set of registered players (guests don't count) earns points from at most{' '}
              {REPEAT_GROUP_MAX_GAMES} games per {REPEAT_GROUP_WINDOW_DAYS} days. Later games in
              that window award no points.
            </li>
            <li>Tournament awards are not limited.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
);

export default PointsHelpModal;
