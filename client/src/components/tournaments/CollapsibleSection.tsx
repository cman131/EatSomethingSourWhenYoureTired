import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  storageKey,
  children,
  defaultExpanded = false,
}) => {
  // Initialize state from localStorage, defaulting to defaultExpanded if not found
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? JSON.parse(saved) : defaultExpanded;
    } catch {
      return defaultExpanded;
    }
  });

  // Save to localStorage whenever the state changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(isExpanded));
    } catch (error) {
      // Handle localStorage errors (e.g., quota exceeded, private browsing)
      console.error(`Failed to save ${storageKey} preference:`, error);
    }
  }, [isExpanded, storageKey]);

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {isExpanded ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
