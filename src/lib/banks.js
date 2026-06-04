// =====================================================================
// src/lib/banks.js  — bank permission helpers (A1 batch 1b, slice 11)
// Pure helpers extracted VERBATIM from App.jsx. No I/O, no React, no
// theme/context deps — safe to import from both App and the Library screen.
// Storage-bound bank ops (listBanks/loadBank/saveBank/deleteBank/
// setBankVisibility) intentionally stay in App for now (they pull
// safeStorage + KEYS), keeping this module dependency-free.
//
//   newBankId()                      -> string id
//   bankVisibility(bank)             -> 'public' | 'private'
//   isBankOwner(bank, profileId)     -> boolean
//   canSeeBank(bank, profileId, isAdmin) -> boolean
// =====================================================================

export const newBankId = () => `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const bankVisibility = (bank) => (bank && bank.visibility === 'private' ? 'private' : 'public');
export const isBankOwner = (bank, profileId) => !!(bank && profileId && bank.ownerId && bank.ownerId === profileId);

// Who may SEE / browse / import / practise a bank.
export function canSeeBank(bank, profileId, isAdmin) {
  if (!bank) return false;
  if (isAdmin) return true;
  if (bankVisibility(bank) === 'public') return true;
  return isBankOwner(bank, profileId);
}
