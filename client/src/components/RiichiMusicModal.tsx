import React, { useState, useEffect } from 'react';
import { XMarkIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

interface RiichiMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spotifyUrl: string | null) => Promise<void>;
  currentRiichiMusic?: string | null;
}

const RiichiMusicModal: React.FC<RiichiMusicModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentRiichiMusic,
}) => {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  // Initialize URL when modal opens
  useEffect(() => {
    if (isOpen) {
      setSpotifyUrl(currentRiichiMusic || '');
      setError(null);
      setPreviewTrackId(null);
      if (currentRiichiMusic) {
        extractTrackId(currentRiichiMusic);
      }
    }
  }, [isOpen, currentRiichiMusic]);

  // Extract track ID from Spotify URL
  const extractTrackId = (url: string): string | null => {
    if (!url) return null;
    
    // Handle different Spotify URL formats:
    // https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
    // spotify:track:4cOdK2wGLETKBW3PvgPWqT
    // https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
    
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      return trackMatch[1];
    }
    
    const spotifyUriMatch = url.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (spotifyUriMatch) {
      return spotifyUriMatch[1];
    }
    
    return null;
  };

  // Validate Spotify URL
  const validateSpotifyUrl = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is valid (to clear)
    
    const trackId = extractTrackId(url);
    return trackId !== null;
  };

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setSpotifyUrl(url);
    setError(null);
    
    if (url.trim()) {
      const trackId = extractTrackId(url);
      setPreviewTrackId(trackId);
      
      if (!trackId) {
        setError('Please enter a valid Spotify track URL');
      } else {
        setError(null);
      }
    } else {
      setPreviewTrackId(null);
      setError(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const urlToSave = spotifyUrl.trim() || null;
      
      if (urlToSave && !validateSpotifyUrl(urlToSave)) {
        setError('Please enter a valid Spotify track URL');
        setIsLoading(false);
        return;
      }
      
      await onSave(urlToSave);
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
    setSpotifyUrl('');
    setPreviewTrackId(null);
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
                Set your riichi music! Paste a Spotify track URL below. This will be displayed on your profile.
              </p>

              <div>
                <label htmlFor="spotifyUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  Spotify Track URL
                </label>
                <input
                  id="spotifyUrl"
                  type="text"
                  value={spotifyUrl}
                  onChange={handleUrlChange}
                  placeholder="https://open.spotify.com/track/..."
                  className="input-field w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Paste a Spotify track URL (e.g., https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT)
                </p>
              </div>

              {/* Preview */}
              {previewTrackId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                  <iframe
                    title="Riichi Music Preview"
                    src={`https://open.spotify.com/embed/track/${previewTrackId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-lg"
                  />
                </div>
              )}

              {currentRiichiMusic && (
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
              disabled={isLoading || !!(spotifyUrl.trim() && !previewTrackId)}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            {spotifyUrl && (
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
