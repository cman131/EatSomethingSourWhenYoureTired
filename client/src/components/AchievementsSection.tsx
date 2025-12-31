import React from 'react';
import { useApi } from '../hooks/useApi';
import { achievementsApi, UserAchievement } from '../services/api';

interface AchievementsSectionProps {
  userId: string;
}

const AchievementsSection: React.FC<AchievementsSectionProps> = ({ userId }) => {
  // Fetch user achievements
  const getUserAchievements = React.useCallback(
    async () => {
      if (!userId) {
        return Promise.reject(new Error('User ID not available'));
      }
      const response = await achievementsApi.getUserAchievements(userId);
      return response.data;
    },
    [userId]
  );

  const { data: achievementsData, loading: achievementsLoading } = useApi<{
    achievements: UserAchievement[];
    earned: UserAchievement[];
    unearned: UserAchievement[];
    summary: {
      total: number;
      earned: number;
      unearned: number;
    };
  }>(
    getUserAchievements,
    [userId]
  );

  // Separate Grand and regular achievements
  const earnedGrand = React.useMemo(() => {
    if (!achievementsData) return [];
    return achievementsData.earned.filter(ua => 
      ua.achievement.requirements?.some(req => req.isGrand)
    );
  }, [achievementsData]);

  const earnedRegular = React.useMemo(() => {
    if (!achievementsData) return [];
    return achievementsData.earned.filter(ua => 
      !ua.achievement.requirements?.some(req => req.isGrand)
    );
  }, [achievementsData]);

  // Calculate non-Grand achievement counts
  const nonGrandTotal = React.useMemo(() => {
    if (!achievementsData) return 0;
    return achievementsData.achievements.filter(ua => 
      !ua.achievement.requirements?.some(req => req.isGrand)
    ).length;
  }, [achievementsData]);

  const nonGrandEarned = earnedRegular.length;
  const nonGrandUnearned = nonGrandTotal - nonGrandEarned;

  // Render achievement card component
  const renderAchievementCard = (userAchievement: UserAchievement, isGrand: boolean) => (
    <div
      key={userAchievement.achievement._id}
      title={userAchievement.achievement.description}
      className={`
        relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200
        ${isGrand 
          ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 border-yellow-600 shadow-lg hover:shadow-2xl transform hover:scale-105 ring-2 ring-yellow-300 ring-opacity-50' 
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
        }
        cursor-help overflow-hidden
      `}
    >
      {isGrand && (
        <>
          <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-600 to-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg z-10 border border-yellow-300">
            GRAND
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/30 via-transparent to-orange-600/30 animate-pulse pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-pulse pointer-events-none" style={{ animationDelay: '0.5s' }}></div>
        </>
      )}
      <div className={`
        text-4xl mb-2 relative z-0
        ${isGrand ? 'drop-shadow-lg filter brightness-110' : ''}
      `}>
        {userAchievement.achievement.icon}
      </div>
      <div className={`
        text-sm font-medium text-center relative z-0
        ${isGrand ? 'text-white font-bold drop-shadow-md' : 'text-gray-900'}
      `}>
        {userAchievement.achievement.name}
      </div>
    </div>
  );

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Achievements</h2>
      {achievementsLoading ? (
        <p className="text-gray-500 text-center py-4">Loading achievements...</p>
      ) : achievementsData && (earnedGrand.length > 0 || earnedRegular.length > 0) ? (
        <div className="space-y-6">
          {/* Grand Achievements Section */}
          {earnedGrand.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">👑</span>
                Grand Achievements
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {earnedGrand.map((userAchievement) => 
                  renderAchievementCard(userAchievement, true)
                )}
              </div>
            </div>
          )}

          {/* Regular Achievements Section */}
          {earnedRegular.length > 0 && (
            <div className="space-y-3">
              {earnedGrand.length > 0 && (
                <h3 className="text-lg font-semibold text-gray-800">Regular Achievements</h3>
              )}
              <div className="mb-4 text-sm text-gray-600">
                <span>
                  {nonGrandEarned} of {nonGrandTotal} regular achievements earned
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {earnedRegular.map((userAchievement) => 
                  renderAchievementCard(userAchievement, false)
                )}
              </div>
            </div>
          )}

          {/* Unearned count (only for regular achievements) */}
          {nonGrandUnearned > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                {nonGrandUnearned} more regular achievement{nonGrandUnearned !== 1 ? 's' : ''} to unlock
              </p>
            </div>
          )}
        </div>
      ) : achievementsData && achievementsData.earned.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No achievements earned yet. Keep playing to unlock achievements!</p>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No achievements data available</p>
      )}
    </div>
  );
};

export default AchievementsSection;

