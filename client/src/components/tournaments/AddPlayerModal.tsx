import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { usersApi, User } from '../../services/api';
import UserDisplay from '../user/UserDisplay';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (playerId: string) => Promise<void>;
  existingPlayerIds: string[];
}

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingPlayerIds,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Search users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim().length > 0) {
        setLoading(true);
        try {
          const response = await usersApi.searchUsers(searchTerm, 20);
          // Filter out users already in the tournament and guest users
          const filtered = response.data.users.filter(
            (user) => !existingPlayerIds.includes(user._id) && !user.isGuest
          );
          setSearchResults(filtered);
          setError(null);
        } catch (err: any) {
          console.error('Failed to search users:', err);
          setSearchResults([]);
          setError(err.message || 'Failed to search users');
        } finally {
          setLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, existingPlayerIds]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  const handleSelectPlayer = async (user: User) => {
    if (adding) return;

    try {
      setAdding(true);
      setError(null);
      await onAdd(user._id);
      // Reset state on success
      setSearchTerm('');
      setSearchResults([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add player');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div ref={modalRef} className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Player to Tournament</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search for a user
              </label>
              <input
                ref={searchInputRef}
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to search users..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={adding}
              />
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Searching users...</p>
                </div>
              ) : searchTerm.trim().length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Type a name to search for users</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => handleSelectPlayer(user)}
                      disabled={adding}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <UserDisplay
                        user={user}
                        size="md"
                        showLink={false}
                        showRealName={true}
                        className="flex-1"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {adding && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">Adding player...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPlayerModal;
