import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import { EquippedFlair } from '../../services/api';
import { getPremiumTitleClass, getPremiumTitleEmoji, getMidTierTitleClass } from '../../utils/flairUtils';

interface UserDisplayProps {
  user: {
    _id: string;
    displayName: string;
    avatar?: string | null;
    realName?: string | null;
    privateMode?: boolean;
    isGuest?: boolean;
    equippedFlair?: EquippedFlair | null;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLink?: boolean;
  showYouIndicator?: boolean;
  showRealName?: boolean;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
}

const UserDisplay: React.FC<UserDisplayProps> = ({
  user,
  size = 'md',
  showLink = true,
  showYouIndicator = false,
  showRealName = false,
  className = '',
  avatarClassName = '',
  nameClassName = '',
}) => {
  if (user.privateMode) {
    user.displayName = 'Hidden';
    user.avatar = undefined;
    user.realName = undefined;
  }
  const { user: currentUser } = useAuth();
  const isCurrentUser = currentUser?._id === user._id;
  const displayName = user.displayName || 'Unknown';
  const shouldShowYouIndicator = showYouIndicator && isCurrentUser;
  const isPrivate = user.privateMode === true;
  const isGuest = user.isGuest === true;
  const shouldShowLink = showLink && !isPrivate && !isGuest;

  const flair = user.equippedFlair;
  const nameColorClass = flair?.nameColor || '';
  const nameIcon = flair?.nameIcon || null;
  const title = (!isPrivate && flair?.title) || null;

  const nameContent = (
    <>
      {nameIcon && <span className="mr-1 text-sm" aria-hidden="true">{nameIcon}</span>}
      {displayName}
      {shouldShowYouIndicator && (
        <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
      )}
    </>
  );

  const nameElement = shouldShowLink ? (
    <Link
      to={`/profile/${user._id}`}
      className={`font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors ${nameColorClass} ${nameClassName}`}
    >
      {nameContent}
    </Link>
  ) : (
    <span className={`font-medium text-gray-900 ${nameColorClass} ${nameClassName}`}>
      {nameContent}
    </span>
  );

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <UserAvatar
        user={user}
        size={size}
        className={avatarClassName}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {nameElement}
          {title && <TitleBadge value={title} />}
        </div>
        {showRealName && user.realName && (
          <div className="text-xs text-gray-500">{user.realName}</div>
        )}
      </div>
    </div>
  );
};

const PREMIUM_TITLES = new Set(['Chicken Farmer', 'Chombo Chaser']);

const TitleBadge: React.FC<{ value: string }> = ({ value }) => {
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

export default UserDisplay;
