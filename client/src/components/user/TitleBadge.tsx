import React from 'react';
import { getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../../utils/flairUtils';

const PREMIUM_TITLES = new Set(['Chicken Farmer', 'Chombo Chaser']);

interface TitleBadgeProps {
  value: string;
}

const TitleBadge: React.FC<TitleBadgeProps> = ({ value }) => {
  if (PREMIUM_TITLES.has(value)) {
    const premiumClass = getPremiumTitleClass(value);
    const emoji = getPremiumTitleEmoji(value);
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${premiumClass}`}>
        {emoji && <span className="mr-0.5">{emoji}</span>}
        {value}
      </span>
    );
  }
  const midClass = getMidTierTitleClass(value);
  if (midClass) {
    return (
      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${midClass}`}>
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
