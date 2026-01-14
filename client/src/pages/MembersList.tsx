import React, { useState, useMemo } from 'react';
import { usePaginatedApi } from '../hooks/useApi';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { usersApi, User } from '../services/api';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import UserDisplay from '../components/user/UserDisplay';

const MembersList: React.FC = () => {
  useRequireAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const pageLimit = 20;

  // Memoize the API call function to prevent infinite loops
  const getUsers = React.useCallback(
    (page: number, limit: number) => usersApi.getUsers(page, limit),
    []
  );

  // Fetch users with pagination
  const { data: users, loading, pagination, loadPage } = usePaginatedApi<User>(
    getUsers,
    1,
    pageLimit
  );

  // Filter users based on search term (client-side filtering)
  const filteredUsers = useMemo(() => {
    if (!users) {
      return [];
    }

    // First, filter out guest users
    const nonGuestUsers = users.filter((user: User) => !user.isGuest);

    if (!searchTerm.trim()) {
      return nonGuestUsers;
    }

    const searchLower = searchTerm.toLowerCase();
    return nonGuestUsers.filter((user: User) => {
      // Search in display name
      const displayName = (user.displayName || '').toLowerCase();
      
      // Search in real name
      const realName = (user.realName || '').toLowerCase();
      
      // Search in discord name
      const discordName = (user.discordName || '').toLowerCase();
      
      // Search in mahjong soul name
      const mahjongSoulName = (user.mahjongSoulName || '').toLowerCase();

      return (
        displayName.includes(searchLower) ||
        realName.includes(searchLower) ||
        discordName.includes(searchLower) ||
        mahjongSoulName.includes(searchLower)
      );
    });
  }, [users, searchTerm]);

  const handlePageChange = (page: number) => {
    loadPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">All Members</h1>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by display name, real name, discord name, or mahjong soul name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading members...</p>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {searchTerm ? (
                <span>
                  Showing {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} 
                  {searchTerm && ` for "${searchTerm}"`}
                </span>
              ) : (
                <span>
                  Showing {((pagination.page - 1) * pagination.limit) + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} members
                </span>
              )}
            </div>
            <div className="space-y-4">
              {filteredUsers.map((user: User) => (
                <div
                  key={user._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div>
                    <UserDisplay
                      user={user}
                      size="lg"
                      nameClassName="text-lg font-semibold"
                    />
                    {(user.realName || user.discordName || user.mahjongSoulName) && (
                      <div className="mt-1 ml-0 text-sm text-gray-600 space-y-1">
                        {user.realName && (
                          <div>Real Name: {user.realName}</div>
                        )}
                        {user.discordName && (
                          <div>Discord: {user.discordName}</div>
                        )}
                        {user.mahjongSoulName && (
                          <div>Mahjong Soul: {user.mahjongSoulName}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination - only show if not searching */}
            {!searchTerm && pagination.pages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let pageNum = 1;
                    if (pagination.pages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm rounded-md ${
                          pagination.page === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <span className="text-sm text-gray-600 ml-4">
                  Page {pagination.page} of {pagination.pages}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {searchTerm ? `No members found matching "${searchTerm}"` : 'No members found'}
          </p>
        )}
      </div>
    </div>
  );
};

export default MembersList;

