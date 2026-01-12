import React, { useState } from 'react';
import { LinkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface ShareButtonProps {
  className?: string;
  title?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ 
  className = 'btn-secondary flex items-center gap-2',
  title = 'Share this page'
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: select the text
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={className}
      title={title}
    >
      {copied ? (
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
  );
};

export default ShareButton;
