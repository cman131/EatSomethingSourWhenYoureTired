import React from 'react';
import { getBackdropStyle } from '../../utils/flairUtils';

interface ProfileBackdropProps {
  value: string | null | undefined;
  className?: string;
  testId?: string;
}

// A decorative banner strip. The stored value is used as a class name, so only values the
// registry knows are rendered. No text is ever drawn on it.
const ProfileBackdrop: React.FC<ProfileBackdropProps> = ({
  value,
  className = '',
  testId = 'profile-backdrop',
}) => {
  if (!value || !getBackdropStyle(value)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className={['rounded-lg', value, className].filter(Boolean).join(' ')}
    />
  );
};

export default ProfileBackdrop;
