import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useApi } from '../hooks/useApi';
import { pointsApi, PointsSummary, PointsHistory, PointTransactionContext } from '../services/api';
import PointsHelpModal from '../components/PointsHelpModal';

const POINT_TYPE_LABELS: Record<string, string> = {
  game_played: 'Game Played',
  game_placement_1: 'Game 1st Place',
  game_placement_2: 'Game 2nd Place',
  game_placement_3: 'Game 3rd Place',
  game_placement_4: 'Game 4th Place',
  game_submitted: 'Game Submitted',
  game_verified: 'Game Verified',
  tournament_participated: 'Tournament Participated',
  tournament_placement_1: 'Tournament 1st Place',
  tournament_placement_2: 'Tournament 2nd Place',
  tournament_placement_3: 'Tournament 3rd Place',
  tournament_placement_4: 'Tournament 4th Place',
  ranked_league_qualified: 'Ranked League Qualified',
  ranked_league_placement_1: 'Ranked Season 1st Place',
  ranked_league_placement_2: 'Ranked Season 2nd Place',
  ranked_league_placement_3: 'Ranked Season 3rd Place',
  shop_purchase: 'Shop Purchase',
};

const CONTEXT_KIND_NAMES: Record<PointTransactionContext['kind'], string> = {
  game: 'Game',
  tournament: 'Tournament',
  rankedSeason: 'Ranked season',
  shopItem: 'Item',
};

const buildContextLink = (context: PointTransactionContext): string => {
  switch (context.kind) {
    case 'game':
      return `/games/${context.id}`;
    case 'tournament':
      return `/tournaments/${context.id}`;
    case 'rankedSeason':
      return '/ranked';
    case 'shopItem':
      return '/shop';
  }
};

const TransactionContext: React.FC<{ context?: PointTransactionContext | null }> = ({ context }) => {
  if (!context) {
    return null;
  }

  if (context.missing || !context.label) {
    return (
      <p className="text-xs text-gray-400">{CONTEXT_KIND_NAMES[context.kind]} no longer available</p>
    );
  }

  return (
    <Link to={buildContextLink(context)} className="text-xs text-indigo-600 hover:text-indigo-800">
      {context.label}
    </Link>
  );
};

interface HistoryPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const HistoryPager: React.FC<HistoryPagerProps> = ({ page, totalPages, onPageChange }) => (
  <div className="flex items-center justify-between pt-4">
    <button
      onClick={() => onPageChange(page - 1)}
      disabled={page <= 1}
      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Previous
    </button>
    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
    <button
      onClick={() => onPageChange(page + 1)}
      disabled={page >= totalPages}
      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Next
    </button>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <p role="alert" className="text-red-600 text-center py-4">{message}</p>
);

const Points: React.FC = () => {
  useRequireAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: summaryResponse, loading: summaryLoading, error: summaryError } = useApi<{ data: PointsSummary }>(
    pointsApi.getSummary,
    []
  );

  const { data: historyResponse, loading: historyLoading, error: historyError } = useApi<{ data: PointsHistory }>(
    () => pointsApi.getHistory(page),
    [page]
  );

  if (summaryLoading) {
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Club Points</h1>
          <button
            onClick={() => setModalOpen(true)}
            aria-label="How to earn points"
            className="text-gray-400 hover:text-indigo-600 transition-colors text-xl font-bold leading-none"
          >
            ?
          </button>
        </div>
        <Link
          to="/shop"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
        >
          <SparklesIcon className="h-4 w-4" />
          Spend points in the Flair Shop
        </Link>
      </div>

      {summaryError && <ErrorMessage message={summaryError} />}

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
        {historyError ? (
          <ErrorMessage message={historyError} />
        ) : historyLoading ? (
          <p className="text-gray-500 text-center py-4">Loading transactions...</p>
        ) : !history || history.items.length === 0 ? (
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
                      <p>{POINT_TYPE_LABELS[tx.type] ?? tx.type}</p>
                      <TransactionContext context={tx.context} />
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
        {history && history.totalPages > 1 && !historyError && (
          <HistoryPager page={page} totalPages={history.totalPages} onPageChange={setPage} />
        )}
      </div>

      {modalOpen && <PointsHelpModal onClose={() => setModalOpen(false)} />}
    </div>
  );
};

export default Points;
