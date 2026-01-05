import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { decisionQuizzesApi, DecisionQuiz, usersApi, User } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import UserDisplay from '../components/user/UserDisplay';
import { LinkIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getTileImagePath } from '../utils/tileUtils';

// Tile Display Component
interface TileDisplayProps {
  tile: { id: string; name: string };
  size?: 'small' | 'medium' | 'large' | 'dora';
  className?: string;
  onClick?: () => void;
}

const TileDisplay: React.FC<TileDisplayProps> = ({ tile, size = 'medium', className = '', onClick }) => {
  const sizeClasses = {
    small: 'w-4 h-6 md:w-8 md:h-12',
    medium: 'w-6 h-9 md:w-8 md:h-12',
    large: 'w-8 h-12 md:w-12 md:h-16',
    dora: 'w-4 h-6 md:w-8 md:h-12'
  };

  const baseClasses = 'object-contain rounded border';
  const defaultClasses = size === 'dora' 
    ? 'bg-yellow-100 border-2 border-yellow-400'
    : 'border-gray-300 bg-white';

  const combinedClassName = `${sizeClasses[size]} ${baseClasses} ${defaultClasses} ${className}`;

  return (
    <img
      src={getTileImagePath(tile.id)}
      alt={tile.name}
      title={tile.name}
      className={combinedClassName}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    />
  );
};

const DecisionQuizPage: React.FC = () => {
  const { isLoading: authLoading } = useRequireAuth();
  const { isAuthenticated, user } = useAuth();
  const { decisionQuizId } = useParams<{ decisionQuizId?: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<DecisionQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedTileForModal, setSelectedTileForModal] = useState<string | null>(null);
  const [modalUsers, setModalUsers] = useState<User[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState<{ seat: 'E' | 'S' | 'W' | 'N'; player: typeof userPlayer } | null>(null);

  const generateAndNavigate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await decisionQuizzesApi.generateRandomQuiz();
      if (response.success) {
        navigate(`/decision-quiz/${response.data.quiz.id}`);
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
      
      const response = await decisionQuizzesApi.getQuiz(quizId);
      if (response.success) {
        const loadedQuiz = response.data.quiz;
        setQuiz(loadedQuiz);
        
        // Check if user has already responded
        if (user && loadedQuiz.responses) {
          const userId = user._id;
          for (const [tileId, userIds] of Object.entries(loadedQuiz.responses)) {
            // Check if userIds is an array containing userId
            if (Array.isArray(userIds) && userIds.includes(userId)) {
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
      return;
    }

    if (decisionQuizId) {
      loadQuizById(decisionQuizId);
    } else {
      generateAndNavigate();
    }
  }, [isAuthenticated, decisionQuizId, generateAndNavigate, loadQuizById]);

  const loadNewQuiz = async () => {
    await generateAndNavigate();
  };

  const handleTileNameClick = async (tileId: string) => {
    if (!quiz) return;

    const responsesObj = quiz.responses || {};
    const userIds = responsesObj[tileId];
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return;
    }

    setSelectedTileForModal(tileId);
    setModalLoading(true);
    setModalUsers([]);

    try {
      // Fetch all users who selected this tile
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

  const handleShare = async () => {
    if (!quiz) return;

    const url = `${window.location.origin}/decision-quiz/${quiz.id}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleTileClick = async (tileId: string) => {
    if (!quiz || submitting || hasResponded) return;

    try {
      setSubmitting(true);
      setSelectedTile(tileId);
      
      const response = await decisionQuizzesApi.submitResponse(quiz.id, tileId);
      if (response.success) {
        setQuiz(response.data.quiz);
        setHasResponded(true);
        
        setTimeout(async () => {
          try {
            const reloadResponse = await decisionQuizzesApi.getQuiz(quiz.id);
            if (reloadResponse.success) {
              setQuiz(reloadResponse.data.quiz);
            }
          } catch (reloadErr) {
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

  // Get all players organized by seat
  const getPlayerBySeat = (seat: 'E' | 'S' | 'W' | 'N') => {
    return quiz?.players.find(p => p.seat === seat);
  };

  const userPlayer = quiz?.players.find(p => p.isUser);
  
  // Rotate table so user is always at bottom (South position)
  // Clockwise order: [East, North, West, South]
  // Map: displayPosition -> actualSeat
  const getDisplayMapping = () => {
    if (!userPlayer) {
      // Default mapping if no user found
      return {
        north: 'N',
        east: 'E',
        south: 'S',
        west: 'W'
      };
    }
    
    const userSeat = userPlayer.seat;
    
    // Rotate so user is always at bottom (South display position)
    // Clockwise order: E -> N -> W -> S
    switch (userSeat) {
      case 'E': // User is East, put at bottom
        // Clockwise from East: E -> N -> W -> S
        // If E is at bottom, then: W at top, N at left, S at right
        return {
          north: 'W', // West at top
          east: 'S',  // South at right
          south: 'E', // East at bottom (user)
          west: 'N'   // North at left
        };
      case 'N': // User is North, put at bottom
        // Clockwise from North: N -> W -> S -> E
        // If N is at bottom, then: W at top, S at left, E at right
        return {
          north: 'S', // West at top
          east: 'E',  // East at right
          south: 'N', // North at bottom (user)
          west: 'W'   // South at left
        };
      case 'W': // User is West, put at bottom
        // Clockwise from West: W -> S -> E -> N
        // If W is at bottom, then: S at top, E at left, N at right
        return {
          north: 'E', // South at top
          east: 'N',  // North at right
          south: 'W', // West at bottom (user)
          west: 'S'   // East at left
        };
      case 'S': // User is South, no rotation needed
      default:
        return {
          north: 'N',
          east: 'W',
          south: 'S',
          west: 'E'
        };
    }
  };
  
  const displayMapping = getDisplayMapping();
  
  // Get players for display positions (rotated so user is at bottom)
  const northPlayer = getPlayerBySeat(displayMapping.north as 'E' | 'S' | 'W' | 'N');
  const eastPlayer = getPlayerBySeat(displayMapping.east as 'E' | 'S' | 'W' | 'N');
  const southPlayer = getPlayerBySeat(displayMapping.south as 'E' | 'S' | 'W' | 'N');
  const westPlayer = getPlayerBySeat(displayMapping.west as 'E' | 'S' | 'W' | 'N');
  
  // Helper to get seat name
  const getSeatName = (seat: 'E' | 'S' | 'W' | 'N') => {
    return seat === 'E' ? 'East' : seat === 'S' ? 'South' : seat === 'W' ? 'West' : 'North';
  };

  // Calculate response percentages (similar to DiscardQuiz)
  // In DecisionQuiz, responses are arrays of user IDs (like DiscardQuiz)
  const calculatePercentages = () => {
    if (!quiz || !quiz.responses) return {};

    // Convert responses to a format we can work with
    const responsesObj: Record<string, string[]> = quiz.responses instanceof Map 
      ? Object.fromEntries(quiz.responses) 
      : quiz.responses;

    // Count total responses (sum of all user IDs across all tiles)
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
  const sortHand = (hand: Array<{ id: string; name: string; suit?: string }>) => {
    return [...hand].sort((a, b) => {
      const suitOrder: Record<string, number> = {
        'Man': 1,
        'Pin': 2,
        'Sou': 3,
        'Wind': 4,
        'Dragon': 5
      };

      const suitDiff = (suitOrder[a.suit || ''] || 99) - (suitOrder[b.suit || ''] || 99);
      if (suitDiff !== 0) return suitDiff;

      const getSortValue = (tileId: string): number => {
        if (tileId.endsWith('R')) {
          const baseId = tileId.slice(0, -1);
          const num = parseInt(baseId.substring(1));
          return num + 0.5;
        }
        
        if (tileId.match(/^[MPS]\d+$/)) {
          return parseInt(tileId.substring(1));
        }
        
        if (tileId === 'E') return 1;
        if (tileId === 'S') return 2;
        if (tileId === 'W') return 3;
        if (tileId === 'N') return 4;
        
        if (tileId === 'w') return 1;
        if (tileId === 'g') return 2;
        if (tileId === 'r') return 3;
        
        return 99;
      };

      return getSortValue(a.id) - getSortValue(b.id);
    });
  };
  
  // Helper to render discard pile in rows of 6
  const renderDiscardPile = (discard: Array<{ id: string; name: string; suit?: string }>) => {
    if (!discard || discard.length === 0) return null;
    
    const rows: Array<Array<{ id: string; name: string; suit?: string }>> = [];
    for (let i = 0; i < discard.length; i += 6) {
      rows.push(discard.slice(i, i + 6));
    }
    
    return (
      <div className="flex flex-col gap-0.5 md:gap-1">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-0.5 md:gap-1 justify-center">
            {row.map((tile, idx) => (
              <TileDisplay
                key={idx}
                tile={tile}
                size="medium"
              />
            ))}
          </div>
        ))}
      </div>
    );
  };
  
  // Helper to render hand tiles (for non-user players, show face down or count)
  const renderOtherPlayerHand = (hand: Array<{ id: string; name: string; suit?: string }>) => {
    if (!hand || hand.length === 0) return null;
    
    return (
      <div className="flex gap-0.5 md:gap-1 justify-center flex-wrap">
        {hand.map((tile, idx) => (
          <div
            key={idx}
            className="w-6 h-9 md:w-8 md:h-12 bg-gray-300 rounded border border-gray-400 flex items-center justify-center"
            title={`${hand.length} tiles in hand`}
          >
            <div className="w-4 h-7 md:w-6 md:h-10 bg-gray-400 rounded"></div>
          </div>
        ))}
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Discard Quiz V2</h1>
        <p className="text-gray-500 text-center py-8">Loading quiz...</p>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Discard Quiz V2</h1>
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

  if (!quiz || !userPlayer) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Discard Quiz V2</h1>
          <div className="flex items-center gap-2">
            {quiz && (
              <button
                onClick={handleShare}
                className="btn-secondary flex items-center gap-2"
                title="Share this quiz"
              >
                {shareCopied ? (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-5 w-5" />
                    Share
                  </>
                )}
              </button>
            )}
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

        {/* Mahjong Table Layout */}
        <div className="relative bg-green-50 border-2 md:border-4 border-amber-800 rounded-lg p-1 md:p-4 lg:p-8 overflow-x-auto">
          {/* Dora Indicators */}
          <div className="flex gap-0.5 md:gap-1 justify-center absolute top-0 left-0 p-1 md:p-2 flex-col">
            <div className="text-[10px] md:text-sm font-semibold text-gray-700">Dora</div>
            <div className="flex gap-0.5 md:gap-1 justify-center">
              {/* Blank tiles before dora indicators */}
              {Array.from({ length: Math.max(0, 5 - quiz.doraIndicators.length) }).map((_, index) => (
                <div
                  key={`blank-${index}`}
                  className="w-4 h-6 md:w-8 md:h-12 bg-gray-300 rounded border border-gray-400 flex items-center justify-center" title="13 tiles in hand"><div className="w-3 h-5 md:w-6 md:h-10 bg-gray-400 rounded"></div></div>
              ))}
               {/* Actual dora indicators */}
               {quiz.doraIndicators.map((dora, index) => (
                 <TileDisplay
                   key={index}
                   tile={dora}
                   size="dora"
                 />
               ))}
            </div>
          </div>

          {/* Table Grid Layout - Responsive */}
          <div className="grid grid-cols-12 grid-rows-12 gap-1 md:gap-2 min-h-[400px] md:min-h-[600px] w-full">
            {/* North Player (Top) */}
            {northPlayer && (
              <div className="col-span-12 row-span-3 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
                <div className="text-[10px] md:text-sm font-semibold text-gray-700">
                  {northPlayer.riichiTile !== null && <span className="ml-1 md:ml-2 text-red-600 text-[10px] md:text-xs">Riichi</span>}
                </div>
                {/* Mobile button to view player */}
                {!northPlayer.isUser && (
                  <button
                    onClick={() => setPlayerModalOpen({ seat: northPlayer.seat, player: northPlayer })}
                    className="md:hidden btn-secondary text-xs px-2 py-1 mb-1"
                  >
                    View Hand & Discard
                  </button>
                )}
                {/* Discard pile - hidden on mobile for other players */}
                <div className={northPlayer.isUser ? '' : 'hidden md:block'}>
                  {renderDiscardPile(northPlayer.discard)}
                </div>
                {northPlayer.isUser ? (
                  <div className="mt-0.5 md:mt-2 w-full">
                    <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 md:mb-2 text-center">
                      {hasResponded ? 'Your Hand' : 'Select a tile'}
                    </div>
                    <div className="flex flex-wrap gap-0.5 md:gap-2 justify-center max-w-6xl mx-auto">
                      {sortHand(northPlayer.hand).map((tile, index) => {
                        const isSelected = selectedTile === tile.id;
                        const percentage = percentages[tile.id] || 0;
                        const responsesObj = quiz.responses || {};
                        const userIds = responsesObj[tile.id];
                        const hasResponse = Array.isArray(userIds) && userIds.length > 0;
                        const responseCount = hasResponse ? userIds.length : 0;

                        return (
                          <button
                            key={`${tile.id}-${index}`}
                            onClick={() => !hasResponded && handleTileClick(tile.id)}
                            disabled={submitting || hasResponded}
                            title={tile.name}
                            className={`
                              relative p-0.5 md:p-1 rounded border-2 transition-all duration-200 flex flex-col items-center justify-center
                              ${isSelected
                                ? 'bg-primary-100 border-primary-500 ring-2 ring-primary-300'
                                : hasResponded
                                ? 'bg-gray-50 border-gray-300 cursor-default'
                                : 'bg-white border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                              }
                              ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <img
                              src={getTileImagePath(tile.id)}
                              alt={tile.name}
                              className="w-7 h-10 md:w-12 md:h-16 object-contain"
                            />
                            {hasResponded && (
                              <div className="w-full mt-0.5 md:mt-1 px-0.5 md:px-1">
                                <div className="text-xs text-gray-600 mb-0.5 text-center">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 md:h-1.5">
                                  <div
                                    className="bg-primary-500 h-1 md:h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 text-center">
                                  {responseCount}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 md:mt-2 hidden md:block">
                    {renderOtherPlayerHand(northPlayer.hand)}
                  </div>
                )}
                {northPlayer.melds.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 md:gap-1 mt-0.5 md:mt-2 hidden md:flex">
                    {northPlayer.melds.map((meld, idx) => (
                      <div key={idx} className="flex gap-0.5">
                        {meld.tiles.map((tile, tileIdx) => (
                          <img
                            key={tileIdx}
                            src={getTileImagePath(tile.id)}
                            alt={tile.name}
                            className="w-4 h-6 md:w-6 md:h-9 object-contain"
                            title={tile.name}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* West Player (Left) */}
            {westPlayer && (
              <div className="col-span-2 md:col-span-3 row-span-6 row-start-4 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
                <div className="text-[10px] md:text-sm font-semibold text-gray-700 transform -rotate-90 whitespace-nowrap">
                  {westPlayer.riichiTile !== null && <span className="ml-1 md:ml-2 text-red-600 text-[10px] md:text-xs">Riichi</span>}
                </div>
                {/* Mobile button to view player */}
                {!westPlayer.isUser && (
                  <button
                    onClick={() => setPlayerModalOpen({ seat: westPlayer.seat, player: westPlayer })}
                    className="md:hidden btn-secondary text-xs px-2 py-1 mb-1 transform rotate-90"
                  >
                    View
                  </button>
                )}
                {/* Discard pile - hidden on mobile for other players */}
                <div className={westPlayer.isUser ? '' : 'hidden md:block'}>
                  {renderDiscardPile(westPlayer.discard)}
                </div>
                {westPlayer.isUser ? (
                  <div className="mt-0.5 md:mt-2 w-full">
                    <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 md:mb-2 text-center transform rotate-90">
                      {hasResponded ? 'Your Hand' : 'Select a tile'}
                    </div>
                    <div className="flex flex-col gap-0.5 md:gap-2 justify-center items-center max-h-64 md:max-h-96 overflow-y-auto">
                      {sortHand(westPlayer.hand).map((tile, index) => {
                        const isSelected = selectedTile === tile.id;
                        const percentage = percentages[tile.id] || 0;
                        const responsesObj = quiz.responses || {};
                        const userIds = responsesObj[tile.id];
                        const hasResponse = Array.isArray(userIds) && userIds.length > 0;
                        const responseCount = hasResponse ? userIds.length : 0;

                        return (
                          <button
                            key={`${tile.id}-${index}`}
                            onClick={() => !hasResponded && handleTileClick(tile.id)}
                            disabled={submitting || hasResponded}
                            title={tile.name}
                            className={`
                              relative p-0.5 md:p-1 rounded border md:border-2 transition-all duration-200 flex flex-col items-center justify-center
                              ${isSelected
                                ? 'bg-primary-100 border-primary-500 ring-1 md:ring-2 ring-primary-300'
                                : hasResponded
                                ? 'bg-gray-50 border-gray-300 cursor-default'
                                : 'bg-white border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                              }
                              ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <img
                              src={getTileImagePath(tile.id)}
                              alt={tile.name}
                              className="w-7 h-10 md:w-12 md:h-16 object-contain"
                            />
                            {hasResponded && (
                              <div className="w-full mt-0.5 md:mt-1 px-0.5 md:px-1">
                                <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 text-center">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-0.5 md:h-1.5">
                                  <div
                                    className="bg-primary-500 h-0.5 md:h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 text-center">
                                  {responseCount}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 md:mt-2 hidden md:block">
                    {renderOtherPlayerHand(westPlayer.hand)}
                  </div>
                )}
                {westPlayer.melds.length > 0 && (
                  <div className="flex flex-col gap-0.5 md:gap-1 mt-0.5 md:mt-2 hidden md:flex">
                    {westPlayer.melds.map((meld, idx) => (
                      <div key={idx} className="flex gap-0.5">
                        {meld.tiles.map((tile, tileIdx) => (
                          <img
                            key={tileIdx}
                            src={getTileImagePath(tile.id)}
                            alt={tile.name}
                            className="w-4 h-6 md:w-6 md:h-9 object-contain"
                            title={tile.name}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Centerpiece */}
            <div className="col-span-8 md:col-span-6 col-start-3 md:col-start-4 row-span-6 row-start-4 flex items-center justify-center bg-amber-100 border md:border-2 md:border-4 border-amber-600 rounded-lg p-1 md:p-4">
              {/* Plus sign layout: 3x3 grid with scores on edges, info in center */}
              <div className="grid grid-cols-3 grid-rows-3 gap-0.5 md:gap-2 w-full h-full items-center justify-center">
                {/* Top (North) */}
                <div className="col-start-2 row-start-1 flex justify-center">
                  {northPlayer && (
                    <div className="bg-white px-1 py-0.5 md:px-3 md:py-2 rounded border border-gray-300 text-center">
                      <div className="text-[10px] md:text-sm font-semibold text-gray-700">{getSeatName(northPlayer.seat)}</div>
                      <div className="text-xs md:text-lg font-bold text-gray-900">{northPlayer.score.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Left (West) */}
                <div className="col-start-1 row-start-2 flex justify-center">
                  {westPlayer && (
                    <div className="bg-white px-1 py-0.5 md:px-3 md:py-2 rounded border border-gray-300 text-center">
                      <div className="text-[10px] md:text-sm font-semibold text-gray-700">{getSeatName(westPlayer.seat)}</div>
                      <div className="text-xs md:text-lg font-bold text-gray-900">{westPlayer.score.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Center */}
                <div className="col-start-2 row-start-2 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
                  <div className="text-[10px] md:text-sm font-bold text-gray-900">
                    {quiz.roundWind === 'E' ? 'East' : 'South'} {quiz.roundNumber}
                  </div>
                  
                  {/* Remaining Tiles */}
                  <div className="text-[10px] md:text-xs text-gray-600">
                    {quiz.remainingTileCount} tiles
                  </div>
                </div>

                {/* Right (East) */}
                <div className="col-start-3 row-start-2 flex justify-center">
                  {eastPlayer && (
                    <div className="bg-white px-1 py-0.5 md:px-3 md:py-2 rounded border border-gray-300 text-center">
                      <div className="text-[10px] md:text-sm font-semibold text-gray-700">{getSeatName(eastPlayer.seat)}</div>
                      <div className="text-xs md:text-lg font-bold text-gray-900">{eastPlayer.score.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Bottom (South) */}
                <div className="col-start-2 row-start-3 flex justify-center">
                  {southPlayer && (
                    <div className="bg-white px-1 py-0.5 md:px-3 md:py-2 rounded border border-gray-300 text-center">
                      <div className="text-[10px] md:text-sm font-semibold text-gray-700">{getSeatName(southPlayer.seat)}</div>
                      <div className="text-xs md:text-lg font-bold text-gray-900">{southPlayer.score.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* East Player (Right) */}
            {eastPlayer && (
              <div className="col-span-2 md:col-span-3 col-start-11 md:col-start-10 row-span-6 row-start-4 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
                <div className="text-[10px] md:text-sm font-semibold text-gray-700 transform rotate-90 whitespace-nowrap">
                  {eastPlayer.riichiTile !== null && <span className="ml-1 md:ml-2 text-red-600 text-[10px] md:text-xs">Riichi</span>}
                </div>
                {/* Mobile button to view player */}
                {!eastPlayer.isUser && (
                  <button
                    onClick={() => setPlayerModalOpen({ seat: eastPlayer.seat, player: eastPlayer })}
                    className="md:hidden btn-secondary text-xs px-2 py-1 mb-1 transform -rotate-90"
                  >
                    View
                  </button>
                )}
                {/* Discard pile - hidden on mobile for other players */}
                <div className={eastPlayer.isUser ? '' : 'hidden md:block'}>
                  {renderDiscardPile(eastPlayer.discard)}
                </div>
                {eastPlayer.isUser ? (
                  <div className="mt-0.5 md:mt-2 w-full">
                    <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 md:mb-2 text-center transform -rotate-90">
                      {hasResponded ? 'Your Hand' : 'Select a tile'}
                    </div>
                    <div className="flex flex-col gap-0.5 md:gap-2 justify-center items-center max-h-64 md:max-h-96 overflow-y-auto">
                      {sortHand(eastPlayer.hand).map((tile, index) => {
                        const isSelected = selectedTile === tile.id;
                        const percentage = percentages[tile.id] || 0;
                        const responsesObj = quiz.responses || {};
                        const userIds = responsesObj[tile.id];
                        const hasResponse = Array.isArray(userIds) && userIds.length > 0;
                        const responseCount = hasResponse ? userIds.length : 0;

                        return (
                          <button
                            key={`${tile.id}-${index}`}
                            onClick={() => !hasResponded && handleTileClick(tile.id)}
                            disabled={submitting || hasResponded}
                            title={tile.name}
                            className={`
                              relative p-0.5 md:p-1 rounded border md:border-2 transition-all duration-200 flex flex-col items-center justify-center
                              ${isSelected
                                ? 'bg-primary-100 border-primary-500 ring-1 md:ring-2 ring-primary-300'
                                : hasResponded
                                ? 'bg-gray-50 border-gray-300 cursor-default'
                                : 'bg-white border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                              }
                              ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <img
                              src={getTileImagePath(tile.id)}
                              alt={tile.name}
                              className="w-7 h-10 md:w-12 md:h-16 object-contain"
                            />
                            {hasResponded && (
                              <div className="w-full mt-0.5 md:mt-1 px-0.5 md:px-1">
                                <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 text-center">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-0.5 md:h-1.5">
                                  <div
                                    className="bg-primary-500 h-0.5 md:h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 text-center">
                                  {responseCount}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 md:mt-2 hidden md:block">
                    {renderOtherPlayerHand(eastPlayer.hand)}
                  </div>
                )}
                {eastPlayer.melds.length > 0 && (
                  <div className="flex flex-col gap-0.5 md:gap-1 mt-0.5 md:mt-2 hidden md:flex">
                    {eastPlayer.melds.map((meld, idx) => (
                      <div key={idx} className="flex gap-0.5">
                        {meld.tiles.map((tile, tileIdx) => (
                          <img
                            key={tileIdx}
                            src={getTileImagePath(tile.id)}
                            alt={tile.name}
                            className="w-4 h-6 md:w-6 md:h-9 object-contain"
                            title={tile.name}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* South Player (Bottom - User) */}
            {southPlayer && (
              <div className="col-span-12 row-span-3 row-start-10 flex flex-col items-center justify-center space-y-0.5 md:space-y-2">
                <div className="text-[10px] md:text-sm font-semibold text-gray-700">
                  {southPlayer.riichiTile !== null && <span className="ml-1 md:ml-2 text-red-600 text-[10px] md:text-xs">Riichi</span>}
                </div>
                {/* Mobile button to view player */}
                {!southPlayer.isUser && (
                  <button
                    onClick={() => setPlayerModalOpen({ seat: southPlayer.seat, player: southPlayer })}
                    className="md:hidden btn-secondary text-xs px-2 py-1 mb-1"
                  >
                    View Hand & Discard
                  </button>
                )}
                {/* Discard pile - hidden on mobile for other players */}
                <div className={southPlayer.isUser ? '' : 'hidden md:block'}>
                  {renderDiscardPile(southPlayer.discard)}
                </div>
                {/* User's Hand - Interactive */}
                {southPlayer.isUser ? (
                  <div className="mt-0.5 md:mt-2 w-full">
                    <div className="text-[10px] md:text-xs text-gray-600 mb-0.5 md:mb-2 text-center">
                      {hasResponded ? 'Your Hand' : 'Select a tile'}
                    </div>
                    <div className="flex flex-wrap gap-0.5 md:gap-2 justify-center max-w-6xl mx-auto">
                      {sortHand(southPlayer.hand).map((tile, index) => {
                        const isSelected = selectedTile === tile.id;
                        const percentage = percentages[tile.id] || 0;
                        const responsesObj = quiz.responses || {};
                        const userIds = responsesObj[tile.id];
                        const hasResponse = Array.isArray(userIds) && userIds.length > 0;
                        const responseCount = hasResponse ? userIds.length : 0;

                        return (
                          <button
                            key={`${tile.id}-${index}`}
                            onClick={() => !hasResponded && handleTileClick(tile.id)}
                            disabled={submitting || hasResponded}
                            title={tile.name}
                            className={`
                              relative p-0.5 md:p-1 rounded border-2 transition-all duration-200 flex flex-col items-center justify-center
                              ${isSelected
                                ? 'bg-primary-100 border-primary-500 ring-2 ring-primary-300'
                                : hasResponded
                                ? 'bg-gray-50 border-gray-300 cursor-default'
                                : 'bg-white border-gray-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                              }
                              ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <img
                              src={getTileImagePath(tile.id)}
                              alt={tile.name}
                              className="w-7 h-10 md:w-12 md:h-16 object-contain"
                            />
                            {hasResponded && (
                              <div className="w-full mt-0.5 md:mt-1 px-0.5 md:px-1">
                                <div className="text-xs text-gray-600 mb-0.5 text-center">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1 md:h-1.5">
                                  <div
                                    className="bg-primary-500 h-1 md:h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 text-center">
                                  {responseCount}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 md:mt-2">
                    {renderOtherPlayerHand(southPlayer.hand)}
                  </div>
                )}
                {southPlayer.melds.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 md:gap-1 mt-0.5 md:mt-2 hidden md:flex">
                    {southPlayer.melds.map((meld, idx) => (
                      <div key={idx} className="flex gap-0.5">
                        {meld.tiles.map((tile, tileIdx) => (
                          <img
                            key={tileIdx}
                            src={getTileImagePath(tile.id)}
                            alt={tile.name}
                            className="w-4 h-6 md:w-6 md:h-9 object-contain"
                            title={tile.name}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {hasResponded && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Response submitted! You selected: <strong>{userPlayer.hand.find(t => t.id === selectedTile)?.name || selectedTile}</strong>
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
                  const tile = userPlayer.hand.find(t => t.id === tileId);
                  const responsesObj = quiz.responses || {};
                  const userIds = responsesObj[tileId];
                  const hasResponse = Array.isArray(userIds) && userIds.length > 0;
                  const responseCount = hasResponse ? userIds.length : 0;
                  
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
                            {responseCount} {responseCount === 1 ? 'vote' : 'votes'}
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

        {/* Response Modal */}
        {selectedTileForModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={closeModal}
              />
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Users who selected: {userPlayer.hand.find(t => t.id === selectedTileForModal)?.name || selectedTileForModal}
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
                    <div className="space-y-3">
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

        {/* Player Hand & Discard Modal */}
        {playerModalOpen && playerModalOpen.player && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => setPlayerModalOpen(null)}
              />
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {getSeatName(playerModalOpen.seat)} Player
                      {playerModalOpen.player.riichiTile !== null && (
                        <span className="ml-2 text-red-600">Riichi</span>
                      )}
                    </h3>
                    <button
                      onClick={() => setPlayerModalOpen(null)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Discard Pile */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        Discard Pile ({playerModalOpen.player.discard.length} tiles)
                      </h4>
                      {playerModalOpen.player.discard.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {playerModalOpen.player.discard.map((tile, idx) => (
                            <TileDisplay
                              key={idx}
                              tile={tile}
                              size="medium"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No discards yet</p>
                      )}
                    </div>

                    {/* Hand */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        Hand ({playerModalOpen.player.hand.length} tiles)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {sortHand(playerModalOpen.player.hand).map((_, idx) => (
                          <div
                            key={`blank-${idx}`}
                            className="w-4 h-6 md:w-8 md:h-12 bg-gray-300 rounded border border-gray-400 flex items-center justify-center" title="13 tiles in hand">
                              <div className="w-3 h-5 md:w-6 md:h-10 bg-gray-400 rounded">
                              </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Melds */}
                    {playerModalOpen.player.melds.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Melds ({playerModalOpen.player.melds.length})
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {playerModalOpen.player.melds.map((meld, idx) => (
                            <div key={idx} className="flex gap-1">
                              {meld.tiles.map((tile, tileIdx) => (
                                <TileDisplay
                                  key={tileIdx}
                                  tile={tile}
                                  size="medium"
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Score */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Score</h4>
                      <p className="text-lg font-bold text-gray-900">
                        {playerModalOpen.player.score.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionQuizPage;

