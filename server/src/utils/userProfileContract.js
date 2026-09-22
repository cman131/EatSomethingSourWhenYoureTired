// GET /api/users/:id lets any authenticated member look up any other member's profile, but
// User.toJSON() only strips internal-only fields (password, reset tokens) and privateMode
// redactions — it does not distinguish "the profile owner" from "everyone else". Fields that are
// private regardless of privateMode (spendable balance, inventory, email, notification settings)
// are stripped here for any viewer who is neither the owner nor an admin.

const OWNER_ONLY_FIELDS = [
  'email',
  'pointsBalance',
  'purchasedItems',
  'notifications',
  'notificationPreferences',
];

function isOwnerOrAdmin(profileUserId, viewer) {
  if (!viewer) return false;
  if (viewer.isAdmin) return true;
  return viewer._id?.toString() === profileUserId.toString();
}

// `profileUser` is a User document (or already-serialized user.toJSON() object); `viewer` is the
// authenticated requester (req.user).
function toUserProfileResponse(profileUser, viewer) {
  const json = typeof profileUser.toJSON === 'function' ? profileUser.toJSON() : { ...profileUser };

  if (!isOwnerOrAdmin(profileUser._id, viewer)) {
    for (const field of OWNER_ONLY_FIELDS) {
      delete json[field];
    }
  }

  return json;
}

module.exports = { toUserProfileResponse, OWNER_ONLY_FIELDS };
