import React from 'react';
import { getIconClass } from '../../utils/flairUtils';

interface FlairIconProps {
  value: string;
  className?: string;
}

// The inner span is the animation/filter target so the wrapper's layout never moves.
const FlairIcon: React.FC<FlairIconProps> = ({ value, className = '' }) => {
  const classes = ['flair-icon', getIconClass(value), className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden="true">
      <span className="flair-icon-glyph">{value}</span>
    </span>
  );
};

export default FlairIcon;
