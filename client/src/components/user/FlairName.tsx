import React from 'react';
import { getNameColorStyle } from '../../utils/flairUtils';

interface FlairNameProps {
  name: string;
  colorValue?: string | null;
  // Applied when no color is equipped (e.g. the shop preview's neutral text color).
  defaultColorClass?: string;
  // Small list text: omit the top-middle sparkle.
  compact?: boolean;
}

// The color class goes on a span holding only the name text. Gradient text is made
// transparent for background-clip, and that would blank anything nested inside it, so
// icons, the "(You)" tag and the sparkles are rendered outside this span.
const FlairName: React.FC<FlairNameProps> = ({
  name,
  colorValue,
  defaultColorClass = '',
  compact = false,
}) => {
  const colorClass = colorValue || defaultColorClass;
  const nameSpan = <span className={colorClass || undefined}>{name}</span>;
  const sparkleClass = colorValue ? getNameColorStyle(colorValue)?.sparkleClass : undefined;

  if (!sparkleClass) {
    return nameSpan;
  }

  return (
    <span className="flair-sparkle-wrap">
      {nameSpan}
      <span className={`flair-sparkle flair-sparkle-tr ${sparkleClass}`} aria-hidden="true">✦</span>
      <span className={`flair-sparkle flair-sparkle-bl ${sparkleClass}`} aria-hidden="true">✦</span>
      {!compact && (
        <span className={`flair-sparkle flair-sparkle-tm ${sparkleClass}`} aria-hidden="true">✦</span>
      )}
    </span>
  );
};

export default FlairName;
