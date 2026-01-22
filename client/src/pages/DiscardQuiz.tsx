import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { discardQuizzesApi, DiscardQuiz, usersApi, User } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import UserDisplay from '../components/user/UserDisplay';
import ShareButton from '../components/ShareButton';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getTileImagePath } from '../utils/tileUtils';

const DiscardQuizPage: React.FC = () => {
  const { isLoading: authLoading } = useRequireAuth();
  const { isAuthenticated, user } = useAuth();
  const { discardQuizId } = useParams<{ discardQuizId?: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<DiscardQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [selectedTileForModal, setSelectedTileForModal] = useState<string | null>(null);
  const [modalUsers, setModalUsers] = useState<User[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const generateAndNavigate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await discardQuizzesApi.generateRandomQuiz();
      if (response.success) {
        // Navigate to the quiz ID route
        // The loadQuizById will be called when the route changes
        navigate(`/discard-quiz/${response.data.quiz.id}`);
      } else {
        setError('Failed to generate quiz');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setError(err.message || 'Failed to generate quiz');
      setLoading(false);
    }
  }, [navigate]);

  const loadQuizById = useCallback(async (quizId: string) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedTile(null);
      setHasResponded(false);
      
      const response = await discardQuizzesApi.getQuiz(quizId);
      if (response.success) {
        const loadedQuiz = response.data.quiz;
        setQuiz(loadedQuiz);
        
        // Check if user has already responded
        if (user && loadedQuiz.responses) {
          const userId = user._id;
          for (const [tileId, userIds] of Object.entries(loadedQuiz.responses)) {
            if (userIds.includes(userId)) {
              setHasResponded(true);
              setSelectedTile(tileId);
              break;
            }
          }
        }
      } else {
        setError('Failed to load quiz');
      }
    } catch (err: any) {
      console.error('Error loading quiz:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load quiz on mount - either by ID or generate new
  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect will be handled by useRequireAuth
      return;
    }

    if (discardQuizId) {
      loadQuizById(discardQuizId);
    } else {
      generateAndNavigate();
    }
  }, [isAuthenticated, discardQuizId, generateAndNavigate, loadQuizById]);

  const loadNewQuiz = async () => {
    await generateAndNavigate();
  };

  const handleTileNameClick = async (tileId: string) => {
    if (!quiz) return;

    const responsesObj = quiz.responses instanceof Map 
      ? Object.fromEntries(quiz.responses) 
      : quiz.responses;
    
    if (!responsesObj[tileId] || !Array.isArray(responsesObj[tileId]) || responsesObj[tileId].length === 0) {
      return;
    }

    setSelectedTileForModal(tileId);
    setModalLoading(true);
    setModalUsers([]);

    try {
      // Fetch all users who selected this tile
      const userIds = responsesObj[tileId];
      const userPromises = userIds.map((userId: string) => usersApi.getUser(userId));
      const userResponses = await Promise.all(userPromises);
      const users = userResponses.map(response => response.data.user);
      setModalUsers(users);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedTileForModal(null);
    setModalUsers([]);
  };

  const handleTileClick = async (tileId: string) => {
    if (!quiz || submitting) return;

    try {
      setSubmitting(true);
      setSelectedTile(tileId);
      
      const response = await discardQuizzesApi.submitResponse(quiz.id, tileId);
      if (response.success) {
        // Update quiz with the response data (includes all responses from all users)
        setQuiz(response.data.quiz);
        setHasResponded(true);
        
        // Reload the quiz after a short delay to ensure we get the latest responses
        // from all users (in case others responded while we were submitting)
        setTimeout(async () => {
          try {
            const reloadResponse = await discardQuizzesApi.getQuiz(quiz.id);
            if (reloadResponse.success) {
              setQuiz(reloadResponse.data.quiz);
            }
          } catch (reloadErr) {
            // If reload fails, we still have the response data, so continue
            console.warn('Failed to reload quiz after submission:', reloadErr);
          }
        }, 500);
      } else {
        setError('Failed to submit response');
        setSelectedTile(null);
      }
    } catch (err: any) {
      console.error('Error submitting response:', err);
      setError(err.message || 'Failed to submit response');
      setSelectedTile(null);
    } finally {
      setSubmitting(false);
    }
  };

  const calculatePercentages = () => {
    if (!quiz || !quiz.responses) return {};

    // Ensure responses is an object (not a Map)
    const responsesObj: Record<string, string[]> = quiz.responses instanceof Map 
      ? Object.fromEntries(quiz.responses) 
      : quiz.responses;

    // Count total responses
    const totalResponses = Object.values(responsesObj).reduce(
      (sum: number, userIds: string[] | unknown) => sum + (Array.isArray(userIds) ? userIds.length : 0),
      0
    );

    if (totalResponses === 0) return {};

    // Calculate percentage for each tile
    const percentages: Record<string, number> = {};
    for (const [tileId, userIds] of Object.entries(responsesObj)) {
      if (Array.isArray(userIds)) {
        percentages[tileId] = (userIds.length / totalResponses) * 100;
      }
    }

    return percentages;
  };


  const percentages = calculatePercentages();

  // Sort hand tiles: first by suit, then by number/alphabetical
  const sortedHand = quiz ? [...quiz.hand].sort((a, b) => {
    // Define suit order
    const suitOrder: Record<string, number> = {
      'Man': 1,
      'Pin': 2,
      'Sou': 3,
      'Wind': 4,
      'Dragon': 5
    };

    // Compare by suit first
    const suitDiff = (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
    if (suitDiff !== 0) return suitDiff;

    // Within the same suit, sort by ID
    // For numbered tiles, extract the number
    const getSortValue = (tileId: string): number => {
      // Red 5s should come after regular 5s
      if (tileId.endsWith('R')) {
        const baseId = tileId.slice(0, -1);
        const num = parseInt(baseId.substring(1));
        return num + 0.5; // Place red 5s between regular 5 and 6
      }
      
      // Numbered tiles
      if (tileId.match(/^[MPS]\d+$/)) {
        return parseInt(tileId.substring(1));
      }
      
      // Winds: E=1, S=2, W=3, N=4
      if (tileId === 'E') return 1;
      if (tileId === 'S') return 2;
      if (tileId === 'W') return 3;
      if (tileId === 'N') return 4;
      
      // Dragons: w=1, g=2, r=3 (alphabetical)
      if (tileId === 'w') return 1;
      if (tileId === 'g') return 2;
      if (tileId === 'r') return 3;
      
      return 99; // Fallback
    };

    return getSortValue(a.id) - getSortValue(b.id);
  }) : [];

  if (authLoading) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Discard Quiz</h1>
        <p className="text-gray-500 text-center py-8">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Discard Quiz</h1>
        <p className="text-gray-500 text-center py-8">Loading quiz...</p>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Discard Quiz</h1>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadNewQuiz}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Discard Quiz</h1>
          <div className="flex items-center gap-2">
            <ShareButton title="Share this quiz" />
            <button
              onClick={loadNewQuiz}
              className="btn-secondary"
              disabled={submitting}
            >
              New Quiz
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Game Information */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Seat</h2>
            <div className="inline-block px-4 py-2 bg-blue-100 border-2 border-blue-400 rounded-lg">
              <span className="text-lg font-bold text-gray-900">
                {quiz.seat === 'E' ? 'East' : quiz.seat === 'S' ? 'South' : quiz.seat === 'W' ? 'West' : 'North'}
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Round</h2>
            <div className="inline-block px-4 py-2 bg-purple-100 border-2 border-purple-400 rounded-lg">
              <span className="text-lg font-bold text-gray-900">
                {quiz.roundWind === 'E' ? 'East' : 'South'}
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">Dora Indicator</h2>
            <div className="inline-block p-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
              <img
                src={getTileImagePath(quiz.doraIndicator.id)}
                alt={quiz.doraIndicator.name}
                title={quiz.doraIndicator.name}
                className="w-16 h-24 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Hand Tiles */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            {hasResponded ? 'Select a tile to discard (you can change your response)' : 'Select a tile to discard'}
          </h2>
          <div className="grid grid-cols-5 md:grid-cols-9 gap-3">
            {sortedHand.map((tile, index) => {
              const isSelected = selectedTile === tile.id;
              const percentage = percentages[tile.id] || 0;
              const responsesObj = quiz.responses instanceof Map 
                ? Object.fromEntries(quiz.responses) 
                : quiz.responses;
              const responseCount = Array.isArray(responsesObj[tile.id]) 
                ? responsesObj[tile.id].length 
                : 0;

              return (
                <button
                  key={`${tile.id}-${index}`}
                  onClick={() => handleTileClick(tile.id)}
                  disabled={submitting}
                  title={tile.name}
                  className={`
                    relative p-2 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center w-fit mx-auto
                    ${isSelected
                      ? 'bg-primary-100 border-primary-500 ring-2 ring-primary-300'
                      : 'bg-white border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                    }
                    ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <img
                    src={getTileImagePath(tile.id)}
                    alt={tile.name}
                    className="w-16 object-contain"
                  />
                  {hasResponded && (
                    <div className="w-full mt-1">
                      <div className="text-xs text-gray-600 mb-1 text-center">
                        {percentage.toFixed(1)}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {responseCount} {responseCount === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {hasResponded && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Response submitted! You selected: <strong>{quiz.hand.find(t => t.id === selectedTile)?.name || selectedTile}</strong>. You can click another tile to change your response.
            </p>
          </div>
        )}

        {hasResponded && Object.keys(percentages).length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Response Statistics</h3>
            <div className="space-y-2">
              {Object.entries(percentages)
                .sort(([, a], [, b]) => b - a)
                .map(([tileId, percentage]) => {
                  const tile = quiz.hand.find(t => t.id === tileId);
                  return (
                  <div key={tileId} className="flex items-center gap-3">
                    <button
                      onClick={() => handleTileNameClick(tileId)}
                      className="w-32 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline text-left"
                    >
                      {tile?.name || tileId}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">
                          {percentage.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {(() => {
                            const responsesObj = quiz.responses instanceof Map 
                              ? Object.fromEntries(quiz.responses) 
                              : quiz.responses;
                            return Array.isArray(responsesObj[tileId]) 
                              ? responsesObj[tileId].length 
                              : 0;
                          })()} votes
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Users Modal */}
        {selectedTileForModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={closeModal}
              />

              {/* Modal panel */}
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Users who selected: {quiz.hand.find(t => t.id === selectedTileForModal)?.name || selectedTileForModal}
                    </h3>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {modalLoading ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Loading users...</p>
                    </div>
                  ) : modalUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No users found</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {modalUsers.map((user) => (
                        <div
                          key={user._id}
                          onClick={closeModal}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            !user.privateMode ? 'hover:bg-gray-50 transition-colors cursor-pointer' : ''
                          }`}
                        >
                          <UserDisplay
                            user={user}
                            size="md"
                            showLink={true}
                            showRealName={true}
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscardQuizPage;

