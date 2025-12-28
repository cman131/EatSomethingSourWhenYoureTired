import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { gamesApi, Game } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeftIcon, TrophyIcon, CheckCircleIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const GameDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const PlayerSeats = ['East', 'South', 'West', 'North'];

  const getOrdinalPlace = (index: number): string => {
    const place = index + 1;
    const lastDigit = place % 10;
    const lastTwoDigits = place % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${place}th`;
    }
    
    switch (lastDigit) {
      case 1: return `${place}st`;
      case 2: return `${place}nd`;
      case 3: return `${place}rd`;
      default: return `${place}th`;
    }
  };

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) {
        setError('Game ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await gamesApi.getGame(id);
        setGame(response.data.game);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id]);

  // Check if current user can verify the game
  const canVerify = React.useMemo(() => {
    if (!isAuthenticated || !user || !game || game.verified) {
      return false;
    }
    
    // User must be a player in the game
    const isPlayer = game.players.some(p => p.player._id === user._id);
    
    // User must NOT be the submitter
    const isNotSubmitter = game.submittedBy._id !== user._id;
    
    return isPlayer && isNotSubmitter;
  }, [isAuthenticated, user, game]);

  const handleVerify = async () => {
    if (!id || !canVerify) return;

    try {
      setVerifying(true);
      setVerifyError(null);
      const response = await gamesApi.verifyGame(id);
      setGame(response.data.game);
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to verify game');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !isAuthenticated || !commentText.trim()) return;

    try {
      setSubmittingComment(true);
      setCommentError(null);
      const response = await gamesApi.addComment(id, commentText.trim());
      setGame(response.data.game);
      setCommentText('');
    } catch (err: any) {
      setCommentError(err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-gray-500 text-center py-8">Loading game...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error || 'Game not found'}</p>
            <Link to="/games" className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeftIcon className="h-5 w-5" />
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sort players by score descending
  const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score || a.position - b.position);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/games"
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Games
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Game Details</h1>
      </div>

      {/* Game Card */}
      <div className="card">
        {/* Game Header */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-semibold text-gray-900">
              Game on {new Date(game.gameDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </h2>
            <div className="flex items-center gap-3">
              {canVerify && (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    {verifying ? 'Verifying...' : 'Verify Game'}
                  </button>
                  {verifyError && (
                    <p className="text-xs text-red-600">{verifyError}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                {game.isEastOnly && (
                  <span className="text-sm px-3 py-1 rounded-full font-medium bg-purple-100 text-purple-800">
                    East Only
                  </span>
                )}
                <span
                  className={`text-sm px-3 py-1 rounded-full font-medium ${
                    game.verified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {game.verified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Submitted by:</span>{' '}
              <Link
                to={`/profile/${game.submittedBy._id}`}
                className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
              >
                {game.submittedBy.displayName}
              </Link>
            </div>
            {game.verifiedBy && (
              <div>
                <span className="font-medium">Verified by:</span>{' '}
                <Link
                  to={`/profile/${game.verifiedBy._id}`}
                  className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
                >
                  {game.verifiedBy.displayName}
                </Link>
              </div>
            )}
            {game.verifiedAt && (
              <div>
                <span className="font-medium">Verified at:</span>{' '}
                <span className="text-gray-900">
                  {new Date(game.verifiedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Players Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Players</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.player._id}
                className={`bg-gray-50 rounded-lg p-4 border-2 ${
                  index === 0 || index === 1
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {index === 0 && (
                      <TrophyIcon className="h-6 w-6 text-yellow-600" />
                    )}
                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        {PlayerSeats[player.position - 1]} • {getOrdinalPlace(index)} place
                      </div>
                      <div className="flex items-center gap-2">
                        {player.player.avatar && (
                          <img
                            src={player.player.avatar}
                            alt={player.player.displayName}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <Link
                          to={`/profile/${player.player._id}`}
                          className="font-semibold text-lg text-gray-900 hover:text-primary-600 hover:underline transition-colors"
                        >
                          {player.player.displayName}
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Score</div>
                    <div className={`text-2xl font-bold ${
                      player.score >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {player.score.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Points Left on Table */}
        {game.pointsLeftOnTable !== undefined && game.pointsLeftOnTable > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Points Left on Table:</span>
              <span className="text-xl font-bold text-orange-700">
                {game.pointsLeftOnTable.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Score Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">Total Score:</span>
            <span className="text-xl font-bold text-blue-700">
              {game.players.reduce((sum, p) => sum + p.score, 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Notes */}
        {game.notes && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{game.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t border-gray-200 pt-4 mt-6">
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-medium">Game ID:</span> {game._id}
            </div>
            <div>
              <span className="font-medium">Created:</span>{' '}
              {new Date(game.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
            {game.updatedAt && game.updatedAt !== game.createdAt && (
              <div>
                <span className="font-medium">Last updated:</span>{' '}
                {new Date(game.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <ChatBubbleLeftIcon className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Comments {game.comments && game.comments.length > 0 && `(${game.comments.length})`}
            </h3>
          </div>

          {/* Comments List */}
          {game.comments && game.comments.length > 0 ? (
            <div className="space-y-4 mb-6">
              {game.comments.map((comment) => (
                <div key={comment._id || comment.createdAt} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    {comment.commenter.avatar && (
                      <img
                        src={comment.commenter.avatar}
                        alt={comment.commenter.displayName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/profile/${comment.commenter._id}`}
                          className="font-semibold text-sm text-gray-900 hover:text-primary-600 hover:underline transition-colors"
                        >
                          {comment.commenter.displayName}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-6">No comments yet. Be the first to comment!</p>
          )}

          {/* Add Comment Form */}
          {isAuthenticated ? (
            <form onSubmit={handleAddComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {commentText.length}/500 characters
                </span>
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
              {commentError && (
                <p className="text-sm text-red-600">{commentError}</p>
              )}
            </form>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Please log in to add a comment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameDetail;

