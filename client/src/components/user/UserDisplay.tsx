import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from './UserAvatar';

interface UserDisplayProps {
  user: {
    _id: string;
    displayName: string;
    avatar?: string | null;
    realName?: string | null;
    privateMode?: boolean;
    isGuest?: boolean;
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
  // Don't show link for guest users or private users
  const shouldShowLink = showLink && !isPrivate && !isGuest;

  const nameContent = (
    <>
      {displayName}
      {shouldShowYouIndicator && (
        <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
      )}
    </>
  );

  const nameElement = shouldShowLink ? (
    <Link
      to={`/profile/${user._id}`}
      className={`font-medium text-gray-900 hover:text-primary-600 hover:underline transition-colors ${nameClassName}`}
    >
      {nameContent}
    </Link>
  ) : (
    <span className={`font-medium text-gray-900 ${nameClassName}`}>
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
        {nameElement}
        {showRealName && user.realName && (
          <div className="text-xs text-gray-500">{user.realName}</div>
        )}
      </div>
    </div>
  );
};

export default UserDisplay;

