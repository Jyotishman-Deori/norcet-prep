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

// Display name / username: short and tidy. Capped at 15 characters.
export const USERNAME_MAX = 15;

// Password: capped at 15 characters (minimum 8, enforced separately at the
// signup/reset call sites). Existing longer passwords still work at login —
// see the note above; the cap only applies when CHOOSING a new value.
export const PASSWORD_MAX = 15;
