import React from 'react';
import { getBackdropStyle } from '../../utils/flairUtils';

interface ProfilePageBackdropProps {
  value: string | null | undefined;
}

// A full-page background layer for the profile page: breaks out of the centered content column
// to fill the browser width, and fills its positioned ancestor's height (Layout's <main>) via
// `.profile-page-backdrop` in flair.css. Registered with Layout through usePageBackdrop rather
// than rendered inline, since it needs to sit behind everything in <main>, flush with the navbar
// and footer — see docs/superpowers/specs/2026-09-23-full-page-profile-backdrop-design.md.
const ProfilePageBackdrop: React.FC<ProfilePageBackdropProps> = ({ value }) => {
  if (!value || !getBackdropStyle(value)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="profile-page-backdrop"
      className={['profile-page-backdrop', value].join(' ')}
    />
  );
};

export default ProfilePageBackdrop;
