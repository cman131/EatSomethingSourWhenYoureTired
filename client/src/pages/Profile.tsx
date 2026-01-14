import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { usersApi, Game, User } from '../services/api';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import AchievementsSection from '../components/profile/AchievementsSection';
import StatisticsSection from '../components/profile/StatisticsSection';
import GameHistorySection from '../components/profile/GameHistorySection';
import HeadToHeadSection from '../components/profile/HeadToHeadSection';
import RecentGamePerformanceSection from '../components/profile/RecentGamePerformanceSection';
import TournamentResultsSection from '../components/profile/TournamentResultsSection';
import UserInfoSection from '../components/profile/UserInfoSection';

const Profile: React.FC = () => {
  useRequireAuth();
  const { id } = useParams<{ id?: string }>();
  const { user: currentUser, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  // Determine which user's profile we're viewing
  const profileUserId = id || currentUser?._id;
  const isOwnProfile = !id || id === currentUser?._id;
  
  // Fetch profile user data if viewing another user's profile
  const getProfileUser = React.useCallback(
    async (): Promise<User> => {
      if (!profileUserId) {
        return Promise.reject(new Error('User ID not available'));
      }
      if (isOwnProfile && currentUser) {
        // Use current user data - return immediately without API call
        return currentUser;
      }
      // Fetch other user's data
      const response = await usersApi.getUser(profileUserId);
      if (response.data.user.isGuest) {
        return Promise.reject(new Error('User is a guest'));
      }
      return response.data.user;
    },
    [profileUserId, isOwnProfile, currentUser]
  );

  const { data: profileUser, loading: profileUserLoading, error: profileUserError, refetch: refetchProfileUser } = useApi<User>(
    getProfileUser,
    [profileUserId, isOwnProfile, currentUser?._id]
  );

  // Redirect if trying to view another user's profile and they're a guest
  React.useEffect(() => {
    if (profileUserError && profileUserError === 'User is a guest') {
      navigate('/members');
    }
  }, [profileUserError, navigate]);

  // Use profile user for display, fallback to current user
  // When viewing own profile, prioritize currentUser to ensure we have the latest data
  const user = (isOwnProfile && currentUser) ? currentUser : (profileUser || null);


  // Fetch all games for calculating most played with players
  const getAllGames = React.useCallback(
    async () => {
      if (!profileUserId) {
        return Promise.reject(new Error('User not available'));
      }
      // Fetch a large number of games to get accurate statistics
      const response = await usersApi.getUserGames(profileUserId, 1, 1000);
      return response.data.items;
    },
    [profileUserId]
  );

  const { data: allGames, loading: allGamesLoading } = useApi<Game[]>(
    getAllGames,
    [profileUserId]
  );


  if (profileUserLoading || !user) {
    return (
      <div className="space-y-8">
        <p className="text-gray-500 text-center py-8">Loading profile...</p>
      </div>
    );
  }

  // If viewing someone else's profile and they have privateMode enabled, show 404
  if (id && user.privateMode === true) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="text-center py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h1>
            <p className="text-gray-600 mb-4">The profile you're looking for doesn't exist or is not available.</p>
            <Link to="/members" className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Members
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isOwnProfile ? 'Profile' : `${user.displayName}'s Profile`}
        </h1>
      </div>

      {/* User Info */}
      {user && (
        <UserInfoSection
          user={user}
          isOwnProfile={isOwnProfile}
          onUpdateProfile={updateProfile}
          onRefetchProfile={async () => { await refetchProfileUser(); }}
        />
      )}

      {/* Only show other sections if user is not in private mode */}
      {!user?.privateMode && (
        <>
          {/* Head-to-Head Statistics */}
          <HeadToHeadSection
            currentUser={currentUser}
            profileUserId={profileUserId || ''}
            profileUserDisplayName={user?.displayName || ''}
            allGames={allGames}
            allGamesLoading={allGamesLoading}
            isOwnProfile={isOwnProfile}
          />

          {/* Achievements */}
          {profileUserId && <AchievementsSection userId={profileUserId} />}

          {/* Tournament Results */}
          {profileUserId && <TournamentResultsSection profileUserId={profileUserId} />}

          {/* Statistics */}
          {profileUserId && (
            <StatisticsSection
              profileUserId={profileUserId}
              allGames={allGames}
              allGamesLoading={allGamesLoading}
            />
          )}

          {/* Recent Game Performance */}
          {profileUserId && (
            <RecentGamePerformanceSection profileUserId={profileUserId} />
          )}

          {/* Game History */}
          {profileUserId && (
            <GameHistorySection
              gamesLoading={allGamesLoading}
              profileUserId={profileUserId}
              allGames={allGames}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Profile;
