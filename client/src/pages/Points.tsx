import React from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useApi } from '../hooks/useApi';
import { pointsApi, PointsSummary, PointsHistory } from '../services/api';

const POINT_TYPE_LABELS: Record<string, string> = {
  game_played: 'Game Played',
  game_submitted: 'Game Submitted',
  game_verified: 'Game Verified',
  tournament_participated: 'Tournament Participated',
  tournament_placement_1: 'Tournament 1st Place',
  tournament_placement_2: 'Tournament 2nd Place',
  tournament_placement_3: 'Tournament 3rd Place',
  tournament_placement_4: 'Tournament 4th Place',
  ranked_league_qualified: 'Ranked League Qualified',
  ranked_league_placement_1: 'Ranked League 1st Place',
  ranked_league_placement_2: 'Ranked League 2nd Place',
  ranked_league_placement_3: 'Ranked League 3rd Place',
  ranked_league_placement_4: 'Ranked League 4th Place',
  shop_purchase: 'Shop Purchase',
};

const Points: React.FC = () => {
  useRequireAuth();

  const { data: summaryResponse, loading: summaryLoading } = useApi<{ data: PointsSummary }>(
    pointsApi.getSummary,
    []
  );

  const { data: historyResponse, loading: historyLoading } = useApi<{ data: PointsHistory }>(
    pointsApi.getHistory,
    []
  );

  if (summaryLoading || historyLoading) {
    return (
      <div className="space-y-8">
        <p className="text-gray-500 text-center py-8">Loading points...</p>
      </div>
    );
  }

  const summary = summaryResponse?.data;
  const history = historyResponse?.data;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Club Points</h1>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-sm text-gray-500 mb-1">Available Balance</p>
            <p className="text-4xl font-bold text-indigo-600">{summary.balance}</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-gray-500 mb-1">Total Earned (Lifetime)</p>
            <p className="text-4xl font-bold text-gray-800">{summary.totalEarned}</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaction History</h2>
        {!history || history.items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.items.map(tx => (
                  <tr key={tx._id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {POINT_TYPE_LABELS[tx.type] ?? tx.type}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Points;
