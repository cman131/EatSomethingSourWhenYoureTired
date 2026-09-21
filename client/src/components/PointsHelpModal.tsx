import React from 'react';

interface Props {
  onClose: () => void;
}

const GAME_ROWS: [string, string][] = [
  ['1st place', '+8'],
  ['2nd place', '+5'],
  ['3rd place', '+3'],
  ['4th place', '+1'],
  ['Submit a game', '+2'],
  ['Verify a game', '+1'],
];

const TOURNAMENT_ROWS: [string, string][] = [
  ['Participate', '+15'],
  ['1st place', '+40'],
  ['2nd place', '+30'],
  ['3rd place', '+20'],
  ['4th place', '+10'],
];

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
                <td className="py-2 text-gray-700">Qualify (join league)</td>
                <td className="py-2 text-right font-medium text-green-600">+10</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
);

export default PointsHelpModal;
