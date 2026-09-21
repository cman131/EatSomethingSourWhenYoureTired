import React from 'react';
import { getTitleStyle } from '../../utils/flairUtils';

interface TitleBadgeProps {
  value: string;
}

const TitleBadge: React.FC<TitleBadgeProps> = ({ value }) => {
  const style = getTitleStyle(value);

  if (style && style.className) {
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${style.className}`}>
        {style.emoji && <span className="mr-0.5">{style.emoji}</span>}
        {value}
      </span>
    );
  }

  return (
    <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
      {value}
    </span>
  );
};

export default TitleBadge;
