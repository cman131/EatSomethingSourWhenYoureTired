import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { usersApi, pointsApi, User } from '../services/api';
import UserDisplay from '../components/user/UserDisplay';

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <p role="alert" className="text-red-600 text-center py-4">{message}</p>
);

const AdminPointsAdjustment: React.FC = () => {
  useRequireAuth();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const deepLinkedUserId = searchParams.get('userId');

  const [targetUserId, setTargetUserId] = useState<string | null>(deepLinkedUserId);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadSelectedUser = useCallback(async (userId: string) => {
    setUserLoading(true);
    setUserError(null);
    try {
      const response = await usersApi.getUser(userId);
      setSelectedUser(response.data.user);
    } catch (err: any) {
      setUserError(err.message || 'Failed to load user');
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetUserId) {
      loadSelectedUser(targetUserId);
    } else {
      setSelectedUser(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  useEffect(() => {
    if (targetUserId) {
      return;
    }
    if (searchTerm.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await usersApi.searchUsers(searchTerm, 20);
        setSearchResults(response.data.users);
      } catch (err: any) {
        setSearchError(err.message || 'Failed to search users');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, targetUserId]);

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSelectUser = (result: User) => {
    setSearchTerm('');
    setSearchResults([]);
    setTargetUserId(result._id);
  };

  const handleChangeUser = () => {
    setTargetUserId(null);
    setSelectedUser(null);
    setSearchTerm('');
    setSearchResults([]);
    setAmount('');
    setReason('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const parsedAmount = Number(amount);
  const isValidAmount = amount.trim() !== '' && Number.isInteger(parsedAmount) && parsedAmount !== 0;
  const isValidReason = reason.trim().length > 0 && reason.length <= 500;
  const canSubmit = isValidAmount && isValidReason && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !targetUserId) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await pointsApi.adjustBalance({ userId: targetUserId, amount: parsedAmount, reason: reason.trim() });
      setSubmitSuccess(true);
      setAmount('');
      setReason('');
      await loadSelectedUser(targetUserId);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to record adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Adjust Points</h1>

      {!targetUserId && (
        <div className="card">
          <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-2">
            Search for a user
          </label>
          <input
            id="user-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to search users..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {searchError && <ErrorMessage message={searchError} />}
          {searching ? (
            <p className="text-gray-500 text-center py-4">Searching users...</p>
          ) : searchTerm.trim().length === 0 ? (
            <p className="text-gray-500 text-center py-4">Type a name to search for users</p>
          ) : searchResults.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No users found</p>
          ) : (
            <div className="space-y-2 mt-4">
              {searchResults.map((result) => (
                <button
                  key={result._id}
                  type="button"
                  onClick={() => handleSelectUser(result)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <UserDisplay user={result} size="md" showLink={false} showRealName />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {targetUserId && (
        <div className="card space-y-6">
          {userLoading ? (
            <p className="text-gray-500 text-center py-4">Loading user...</p>
          ) : userError ? (
            <ErrorMessage message={userError} />
          ) : selectedUser ? (
            <>
              <div className="flex items-center justify-between">
                <UserDisplay user={selectedUser} size="lg" showLink={false} showRealName />
                <button type="button" onClick={handleChangeUser} className="btn-secondary">
                  Change user
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-indigo-600">{selectedUser.pointsBalance ?? 0}</p>
              </div>

              {submitSuccess && (
                <p role="status" className="text-green-600 text-center">Adjustment recorded</p>
              )}
              {submitError && <ErrorMessage message={submitError} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50 or -20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Recording...' : 'Record Adjustment'}
                </button>
              </form>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminPointsAdjustment;
