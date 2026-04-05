/**
 * Build a display name from Clerk Backend API user fields (same shape as getUser / getUserList items).
 */
export function displayNameFromClerkUser(u: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
}): string {
  const fn = u.firstName?.trim() ?? '';
  const ln = u.lastName?.trim() ?? '';
  if (fn || ln) {
    return [fn, ln].filter(Boolean).join(' ');
  }
  const full = u.fullName?.trim();
  if (full) return full;
  const un = u.username?.trim();
  if (un) return un;
  const email =
    u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress;
  if (email) {
    const local = email.split('@')[0];
    return local?.trim() || email;
  }
  return '';
}
