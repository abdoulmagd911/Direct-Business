// The password rules (V166), checked by the server before Auth ever sees a password — when an admin sets a starting
// one and when a person changes theirs. The Auth project holds the same minimum (supabase/config.toml
// minimum_password_length; the cloud project's setting is the owner's). Nothing here is shown as a hint (V59): a
// refusal comes back as a key, and the screen words it.

/** The owner's minimum (29 Sep). */
export const PASSWORD_MIN_LENGTH = 10;

/** Supabase Auth hashes at most 72 bytes of a password; a longer one would be cut without a word, so it is refused. */
export const PASSWORD_MAX_BYTES = 72;

/** Where a sign-in that must change its password is sent (the screen is builder B's; outside the app's gate). */
export const CHANGE_PASSWORD_PATH = '/change-password';

export type PasswordProblem = 'too_short' | 'too_long' | 'same_as_email';

/** What is wrong with a password, or null. Characters are counted as a person sees them (an Arabic letter is one). */
export function passwordProblem(password: string, email?: string | null): PasswordProblem | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'too_long';
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return 'same_as_email';
  return null;
}
