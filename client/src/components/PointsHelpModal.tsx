import React from 'react';
import { useApi } from '../hooks/useApi';
import { pointsApi, PointsConfig } from '../services/api';

interface Props {
  onClose: () => void;
}

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

function buildRows(config: PointsConfig) {
  const gameRows: [string, string][] = [
    ['1st place', `+${config.gamePlacementAmounts[1]}`],
    ['2nd place', `+${config.gamePlacementAmounts[2]}`],
    ['3rd place', `+${config.gamePlacementAmounts[3]}`],
    ['4th place', `+${config.gamePlacementAmounts[4]}`],
    ['Submit a game', `+${config.gameSubmittedAmount}`],
    ['Verify a game', `+${config.gameVerifiedAmount}`],
  ];
  const tournamentRows: [string, string][] = [
    ['Participate', `+${config.tournamentParticipationAmount}`],
    ['1st place', `+${config.tournamentPlacementAmounts[0]}`],
    ['2nd place', `+${config.tournamentPlacementAmounts[1]}`],
    ['3rd place', `+${config.tournamentPlacementAmounts[2]}`],
    ['4th place', `+${config.tournamentPlacementAmounts[3]}`],
  ];
  const rankedRows: [string, string][] = [
    ['Qualify for the leaderboard', `+${config.rankedQualificationAmount}`],
    ['Finish a season 1st', `+${config.rankedPlacementAmounts[0]}`],
    ['Finish a season 2nd', `+${config.rankedPlacementAmounts[1]}`],
    ['Finish a season 3rd', `+${config.rankedPlacementAmounts[2]}`],
  ];
  const quizRows: [string, string][] = [
    ['Complete a quiz', `+${config.quizCompletionAmount}`],
  ];
  return { gameRows, tournamentRows, rankedRows, quizRows };
}

const PointsHelpModal: React.FC<Props> = ({ onClose }) => {
  const { data, loading, error } = useApi<{ data: PointsConfig }>(pointsApi.getConfig, []);
  const config = data?.data;
  const rows = config ? buildRows(config) : null;

  return (
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
          {loading && <p className="text-sm text-gray-500">Loading point values...</p>}
          {error && <p className="text-sm text-red-600">Failed to load point values.</p>}
          {config && rows && (
            <>
              <section aria-label="Games">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Games</h3>
                <PointsTable rows={rows.gameRows} />
              </section>
              <section aria-label="Tournaments">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Tournaments</h3>
                <PointsTable rows={rows.tournamentRows} />
              </section>
              <section aria-label="Ranked League">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Ranked League</h3>
                <PointsTable rows={rows.rankedRows} />
                <p className="mt-2 text-xs text-gray-500">
                  Season placements are paid when the 90-day season ends, to qualified players only. Tied players share a placement.
                </p>
              </section>
              <section aria-label="Quizzes">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Quizzes</h3>
                <PointsTable rows={rows.quizRows} />
                <p className="mt-2 text-xs text-gray-500">
                  Capped at {config.quizWeeklyCapCount} points per week.
                </p>
              </section>
              <section aria-label="Weekly Streak">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Weekly Streak</h3>
                <p className="text-sm text-gray-700">
                  Play a verified game, complete a quiz, and visit the site in the same week to earn a bonus
                  that grows the more consecutive weeks you keep it up: +{config.weeklyStreakAmounts.join(' / +')},
                  capped at +{config.weeklyStreakAmounts[config.weeklyStreakAmounts.length - 1]}.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointsHelpModal;
