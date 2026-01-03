import React, { useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { usersApi, Game } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RecentGamePerformanceSectionProps {
  profileUserId: string;
}

const RecentGamePerformanceSection: React.FC<RecentGamePerformanceSectionProps> = ({
  profileUserId,
}) => {
  // Fetch last 10 games for performance chart
  const getRecentGames = React.useCallback(
    async () => {
      if (!profileUserId) {
        return Promise.reject(new Error('User not available'));
      }
      const response = await usersApi.getUserGames(profileUserId, 1, 10);
      return response.data.items;
    },
    [profileUserId]
  );

  const { data: recentGames, loading: recentGamesLoading } = useApi<Game[]>(
    getRecentGames,
    [profileUserId]
  );

  // Calculate performance data for chart
  const performanceData = useMemo(() => {
    if (!recentGames || !profileUserId || recentGames.length === 0) {
      return [];
    }

    return recentGames
      .map((game) => {
        // Find the user's player data in this game
        const userPlayer = game.players.find(p => p.player._id === profileUserId);
        if (!userPlayer) return null;

        // Sort players by score (descending) to determine ranking
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        const ranking = sortedPlayers.findIndex(p => p.player._id === profileUserId) + 1;

        return {
          date: new Date(game.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ranking: ranking,
          score: userPlayer.score,
        };
      })
      .filter((item): item is { date: string; ranking: number; score: number } => item !== null)
      .reverse(); // Reverse to show oldest to newest
  }, [recentGames, profileUserId]);

  // Don't render if there's no performance data
  if (performanceData.length === 0 && !recentGamesLoading) {
    return null;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Game Performance</h2>
      {recentGamesLoading ? (
        <p className="text-gray-500 text-center py-8">Loading performance data...</p>
      ) : (
        <div className="w-full" style={{ height: '300px', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                domain={[1, 4]}
                reversed={true}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                label={{ value: 'Ranking', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                ticks={[1, 2, 3, 4]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                formatter={(value: any, name: any, props: any) => {
                  if (value === undefined || value === null) return '';
                  const rankLabels = ['', '1st', '2nd', '3rd', '4th'];
                  const score = props?.payload?.score;
                  return [
                    `${rankLabels[value] || value}${score ? ` (Score: ${score})` : ''}`,
                    'Ranking'
                  ];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                formatter={(value) => 'Ranking'}
              />
              <Line 
                type="monotone" 
                dataKey="ranking" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 text-center mt-2">
            Lower ranking (1st) is better. Shows your position in the last 10 games.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecentGamePerformanceSection;

