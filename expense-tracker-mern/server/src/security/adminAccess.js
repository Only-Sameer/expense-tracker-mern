/** A comma-separated email allowlist is used instead of a public role field. */
export function isAdminEmail(email, configuredEmails = '') {
  if (typeof email !== 'string' || typeof configuredEmails !== 'string' || !configuredEmails.trim()) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return configuredEmails
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}
