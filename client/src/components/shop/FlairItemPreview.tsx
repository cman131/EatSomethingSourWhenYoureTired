import React from 'react';
import { ShopItem } from '../../services/api';
import { isPremiumBorder, isMidTierBorder } from '../../utils/flairUtils';
import FlairName from '../user/FlairName';
import FlairIcon from '../user/FlairIcon';
import TitleBadge from '../user/TitleBadge';

interface FlairItemPreviewProps {
  item: ShopItem;
}

const FlairItemPreview: React.FC<FlairItemPreviewProps> = ({ item }) => (
  <div className="flex items-center gap-2">
    {item.category === 'nameColor' && (
      <span className="font-semibold text-base">
        <FlairName name="Aa" colorValue={item.value} />
      </span>
    )}
    {item.category === 'nameIcon' && (
      <FlairIcon value={item.value} className="text-2xl" />
    )}
    {item.category === 'profileBorder' && (
      (isPremiumBorder(item.value) || isMidTierBorder(item.value)) ? (
        <div className={item.value}>
          <div className="flair-border-inner w-8 h-8 bg-gray-300" />
        </div>
      ) : (
        <div className={`w-8 h-8 rounded-full bg-gray-300 ${item.value}`} />
      )
    )}
    {item.category === 'title' && (
      <TitleBadge value={item.value} />
    )}
    <span className="font-medium text-gray-900 text-sm">{item.name}</span>
  </div>
);

export default FlairItemPreview;
