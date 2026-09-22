import React from 'react';
import { FlairCategory } from '../../services/api';
import { isPremiumBorder, isMidTierBorder } from '../../utils/flairUtils';
import FlairName from './FlairName';
import FlairIcon from './FlairIcon';
import TitleBadge from './TitleBadge';
import ProfileBackdrop from './ProfileBackdrop';

interface FlairSampleProps {
  category: FlairCategory;
  value: string;
}

// A small specimen of one flair item, drawn the way it appears on a profile.
const FlairSample: React.FC<FlairSampleProps> = ({ category, value }) => {
  switch (category) {
    case 'nameColor':
      return (
        <span className="font-semibold text-base">
          <FlairName name="Aa" colorValue={value} />
        </span>
      );
    case 'nameIcon':
      return <FlairIcon value={value} className="text-2xl" />;
    case 'profileBorder':
      return isPremiumBorder(value) || isMidTierBorder(value) ? (
        <div className={value}>
          <div className="flair-border-inner w-8 h-8 bg-gray-300" />
        </div>
      ) : (
        <div className={`w-8 h-8 rounded-full bg-gray-300 ${value}`} />
      );
    case 'profileBackdrop':
      return <ProfileBackdrop value={value} className="w-16 h-8" />;
    case 'title':
      return <TitleBadge value={value} />;
  }
};

export default FlairSample;
