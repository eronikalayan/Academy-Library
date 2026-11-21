/** Apply the same normalization to user lookups and writes. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
