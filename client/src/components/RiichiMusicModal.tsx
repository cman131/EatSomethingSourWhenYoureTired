import React, { useState, useEffect } from 'react';
import { XMarkIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import { User } from '../services/api';

interface RiichiMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (riichiMusic: { url: string; type: 'youtube' | 'spotify' } | null) => Promise<void>;
  currentRiichiMusic?: User['riichiMusic'];
}

const RiichiMusicModal: React.FC<RiichiMusicModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentRiichiMusic,
}) => {
  const [musicUrl, setMusicUrl] = useState('');
  const [musicType, setMusicType] = useState<'youtube' | 'spotify'>('spotify');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);

  // Initialize URL and type when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentRiichiMusic && currentRiichiMusic.url) {
        setMusicUrl(currentRiichiMusic.url);
        setMusicType(currentRiichiMusic.type || 'spotify');
        extractMediaId(currentRiichiMusic.url, currentRiichiMusic.type || 'spotify');
      } else {
        setMusicUrl('');
        setMusicType('spotify');
        setPreviewMediaId(null);
      }
      setError(null);
    }
  }, [isOpen, currentRiichiMusic]);

  // Extract media ID from URL based on type
  const extractMediaId = (url: string, type: 'youtube' | 'spotify'): string | null => {
    if (!url) return null;
    
    if (type === 'spotify') {
      // Handle different Spotify URL formats
      const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
      if (trackMatch) {
        return trackMatch[1];
      }
      const spotifyUriMatch = url.match(/spotify:track:([a-zA-Z0-9]+)/);
      if (spotifyUriMatch) {
        return spotifyUriMatch[1];
      }
      return null;
    } else if (type === 'youtube') {
      // Handle different YouTube URL formats
      const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (watchMatch) {
        return watchMatch[1];
      }
      const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (youtuBeMatch) {
        return youtuBeMatch[1];
      }
      const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) {
        return embedMatch[1];
      }
      return null;
    }
    return null;
  };

  // Validate URL based on type
  const validateUrl = (url: string, type: 'youtube' | 'spotify'): boolean => {
    if (!url.trim()) return true; // Empty is valid (to clear)
    
    const mediaId = extractMediaId(url, type);
    return mediaId !== null;
  };

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setMusicUrl(url);
    setError(null);
    
    if (url.trim()) {
      const mediaId = extractMediaId(url, musicType);
      setPreviewMediaId(mediaId);
      
      if (!mediaId) {
        setError(`Please enter a valid ${musicType === 'spotify' ? 'Spotify' : 'YouTube'} URL`);
      } else {
        setError(null);
      }
    } else {
      setPreviewMediaId(null);
      setError(null);
    }
  };

  // Handle type change
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'youtube' | 'spotify';
    setMusicType(newType);
    setError(null);
    
    if (musicUrl.trim()) {
      const mediaId = extractMediaId(musicUrl, newType);
      setPreviewMediaId(mediaId);
      
      if (!mediaId) {
        setError(`Please enter a valid ${newType === 'spotify' ? 'Spotify' : 'YouTube'} URL`);
      } else {
        setError(null);
      }
    } else {
      setPreviewMediaId(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const urlToSave = musicUrl.trim();
      
      if (!urlToSave) {
        await onSave(null);
        onClose();
        return;
      }
      
      if (!validateUrl(urlToSave, musicType)) {
        setError(`Please enter a valid ${musicType === 'spotify' ? 'Spotify' : 'YouTube'} URL`);
        setIsLoading(false);
        return;
      }
      
      await onSave({
        url: urlToSave,
        type: musicType
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save riichi music');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  // Handle clear
  const handleClear = () => {
    setMusicUrl('');
    setPreviewMediaId(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleCancel}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MusicalNoteIcon className="h-6 w-6 text-primary-600" />
                <h3 className="text-lg font-medium text-gray-900">Set Riichi Music</h3>
              </div>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Set your riichi music! Choose a platform and paste a track/video URL below. This will be displayed on your profile.
              </p>

              <div>
                <label htmlFor="musicType" className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <select
                  id="musicType"
                  value={musicType}
                  onChange={handleTypeChange}
                  className="input-field w-full"
                >
                  <option value="spotify">Spotify</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>

              <div>
                <label htmlFor="musicUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  {musicType === 'spotify' ? 'Spotify Track URL' : 'YouTube Video URL'}
                </label>
                <input
                  id="musicUrl"
                  type="text"
                  value={musicUrl}
                  onChange={handleUrlChange}
                  placeholder={musicType === 'spotify' ? 'https://open.spotify.com/track/...' : 'https://www.youtube.com/watch?v=...'}
                  className="input-field w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {musicType === 'spotify' 
                    ? 'Paste a Spotify track URL (e.g., https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT)'
                    : 'Paste a YouTube video URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)'}
                </p>
              </div>

              {/* Preview */}
              {previewMediaId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                  {musicType === 'spotify' ? (
                    <iframe
                      title="Riichi Music Preview"
                      src={`https://open.spotify.com/embed/track/${previewMediaId}?utm_source=generator&theme=0`}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    />
                  ) : (
                    <iframe
                      title="Riichi Music Preview"
                      src={`https://www.youtube.com/embed/${previewMediaId}`}
                      width="100%"
                      height="315"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg"
                    />
                  )}
                </div>
              )}

              {currentRiichiMusic && currentRiichiMusic.url && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800">
                    You currently have riichi music set. Leave the field empty and save to remove it.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !!(musicUrl.trim() && !previewMediaId)}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            {musicUrl && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiichiMusicModal;
