// =====================================================================
// src/lib/auth-limits.js
// Shared character limits for the username (display name) and password
// fields, used by the signup screen (auth-screen.jsx), the edit-profile
// rename modal (rename-profile-modal.jsx), and the change-password card
// (account-security-card.jsx) so the cap + counter stay consistent.
//
// IMPORTANT: these caps are enforced ONLY where a NEW value is being
// chosen (sign up, rename, set new password). They are deliberately NOT
// enforced on "current password" / login fields, because existing accounts
// may already have a longer password or name from before this limit existed
// — truncating or blocking those would lock people out.
// =====================================================================

// Display name / username: generous but bounded. Most names are < 20 chars;
// 24 leaves room without allowing absurdly long values.
export const USERNAME_MAX = 24;

// Password: 64 is comfortably above any reasonable passphrase while still
// being a sane upper bound (and well within the hashing input limits).
export const PASSWORD_MAX = 64;
