import React from 'react';
import { UserIcon } from '@heroicons/react/24/outline';

interface UserAvatarProps {
  user: {
    avatar?: string | null;
    displayName?: string;
    privateMode?: boolean;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const iconSizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  className = '',
}) => {
  if (user.privateMode) {
    user.displayName = 'Hidden';
    user.avatar = undefined;
  }
  const sizeClass = sizeClasses[size];
  const displayName = user.displayName || 'User';
  const altText = `${displayName}'s avatar`;
  const avatar = user.avatar;
  const isPrivate = user.privateMode === true;

  // If user is in private mode, always show placeholder
  if (isPrivate || !avatar) {
    const iconSizeClass = iconSizeClasses[size];
    return (
      <div className={`${sizeClass} rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center ${className}`}>
        <UserIcon className={`${iconSizeClass} text-gray-400`} />
      </div>
    );
  }

  return (
    <img
      src={avatar}
      alt={altText}
      className={`${sizeClass} rounded-full object-cover border border-gray-200 ${className}`}
      onError={(e) => {
        // Hide image if it fails to load
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};

export default UserAvatar;

