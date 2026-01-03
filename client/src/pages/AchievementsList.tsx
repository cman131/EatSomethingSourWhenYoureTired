import React, { useMemo, useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { usePaginatedApi } from '../hooks/useApi';
import { achievementsApi, Achievement, User } from '../services/api';
import UserDisplay from '../components/user/UserDisplay';

const AchievementsList: React.FC = () => {
  useRequireAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all achievements with pagination
  const getAchievements = React.useCallback(
    (page: number, limit: number) => achievementsApi.getAchievements(page, limit),
    []
  );

  const { data: achievements, loading } = usePaginatedApi<Achievement>(
    getAchievements,
    1,
    100 // Fetch a large number to get all achievements
  );

  // Separate Grand and regular achievements
  const { grandAchievements, regularAchievements } = useMemo(() => {
    if (!achievements) return { grandAchievements: [], regularAchievements: [] };

    const grand: Achievement[] = [];
    const regular: Achievement[] = [];

    achievements.forEach(achievement => {
      const isGrand = achievement.requirements?.some(req => req.isGrand);
      if (isGrand) {
        grand.push(achievement);
      } else {
        regular.push(achievement);
      }
    });

    return { grandAchievements: grand, regularAchievements: regular };
  }, [achievements]);

  // Filter regular achievements based on search term
  const filteredRegularAchievements = useMemo(() => {
    if (!regularAchievements || !searchTerm.trim()) {
      return regularAchievements || [];
    }

    const searchLower = searchTerm.toLowerCase();
    return regularAchievements.filter((achievement: Achievement) => {
      const name = (achievement.name || '').toLowerCase();
      const description = (achievement.description || '').toLowerCase();
      return name.includes(searchLower) || description.includes(searchLower);
    });
  }, [regularAchievements, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">All Achievements</h1>
      </div>

      {/* Grand Achievements Section */}
      {grandAchievements.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">👑</span>
            Grand Achievements
          </h2>
          {loading ? (
            <p className="text-gray-500 text-center py-4">Loading Grand achievements...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grandAchievements.map((achievement) => (
                <GrandAchievementCard key={achievement._id} achievement={achievement} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Bar for Regular Achievements */}
      <div className="card">
        <div className="relative">
          <input
            type="text"
            placeholder="Search regular achievements by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Regular Achievements List */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Regular Achievements</h2>
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading achievements...</p>
        ) : filteredRegularAchievements && filteredRegularAchievements.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {searchTerm ? (
                <span>
                  Showing {filteredRegularAchievements.length} result{filteredRegularAchievements.length !== 1 ? 's' : ''} 
                  {searchTerm && ` for "${searchTerm}"`}
                </span>
              ) : (
                <span>
                  Showing {filteredRegularAchievements.length} regular achievement{filteredRegularAchievements.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {filteredRegularAchievements.map((achievement: Achievement) => (
                <div
                  key={achievement._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-3xl">
                        {achievement.icon}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-gray-900">
                        {achievement.name}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {achievement.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {searchTerm ? `No achievements found matching "${searchTerm}"` : 'No regular achievements found'}
          </p>
        )}
      </div>
    </div>
  );
};

// Component for displaying a Grand achievement with its holder(s)
const GrandAchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const [holders, setHolders] = React.useState<Array<{
    user: User;
    value: number;
    stats: any;
  }> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchHolder = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await achievementsApi.getGrandAchievementHolder(achievement.name);
        if (response.data.isGrand) {
          // Set holders to the users array (could be empty)
          setHolders(response.data.users || []);
        } else {
          setHolders([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load holder');
        setHolders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHolder();
  }, [achievement.name]);

  return (
    <div className="border-2 border-yellow-300 rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-orange-50 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 border-2 border-yellow-600 flex items-center justify-center text-3xl shadow-lg">
            {achievement.icon}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-lg font-bold text-gray-900">
              {achievement.name}
            </div>
            <span className="px-2 py-0.5 bg-gradient-to-br from-yellow-600 to-orange-600 text-white text-xs font-bold rounded-full shadow-md">
              GRAND
            </span>
          </div>
          <div className="text-sm text-gray-700 mb-3">
            {achievement.description}
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading holder...</div>
          ) : error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : holders && holders.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <div className="text-xs font-semibold text-gray-600 mb-2">Current Holder{holders.length > 1 ? 's' : ''}:</div>
              <div className="flex flex-wrap gap-3">
                {holders.map((holder) => (
                  <div
                    key={holder.user._id}
                    className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-yellow-200 ${
                      !holder.user.privateMode ? 'hover:border-yellow-400 hover:shadow-md transition-all' : ''
                    }`}
                  >
                    <UserDisplay
                      user={holder.user}
                      size="sm"
                      showLink={true}
                      nameClassName="text-sm font-medium"
                    />
                    <div className="text-xs text-gray-500">
                      Value: {holder.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <div className="text-sm text-gray-500 italic">No current holder</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementsList;

