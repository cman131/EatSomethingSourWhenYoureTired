import React from 'react';
import { User } from '../../services/api';

interface RiichiMusicDisplayProps {
  riichiMusic: User['riichiMusic'];
}

const RiichiMusicDisplay: React.FC<RiichiMusicDisplayProps> = ({ riichiMusic }) => {
  if (!riichiMusic || !riichiMusic.url) {
    return null;
  }

  // Extract video/track ID based on type
  const getMediaId = (url: string, type: 'youtube' | 'spotify'): string | null => {
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
      // https://www.youtube.com/watch?v=VIDEO_ID
      // https://youtu.be/VIDEO_ID
      // https://www.youtube.com/embed/VIDEO_ID
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

  const mediaId = getMediaId(riichiMusic.url, riichiMusic.type);
  
  if (!mediaId) {
    return null;
  }

  return (
    <div className="pt-6 border-t border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Riichi Music</h3>
      <div className="max-w-md">
        {riichiMusic.type === 'spotify' ? (
          <iframe
            title="Riichi Music"
            src={`https://open.spotify.com/embed/track/${mediaId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-lg"
          />
        ) : riichiMusic.type === 'youtube' ? (
          <iframe
            title="Riichi Music"
            src={`https://www.youtube.com/embed/${mediaId}`}
            width="100%"
            height="315"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-lg"
          />
        ) : null}
      </div>
    </div>
  );
};

export default RiichiMusicDisplay;
