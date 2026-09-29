// The password rules (V166, V431, V441), checked by the server before Auth ever sees a password — when a person
// changes theirs — and the temporary passwords the server generates (nobody types a password for someone else). The
// Auth project holds the same minimum (supabase/config.toml minimum_password_length; the cloud project's setting is the
// owner's). Nothing here is shown as a hint (V59): a refusal comes back as a key, and the screen words it.
import { randomInt } from 'node:crypto';

/** The owner's minimum (29 Sep). */
export const PASSWORD_MIN_LENGTH = 10;

/** Supabase Auth hashes at most 72 bytes of a password; a longer one would be cut without a word, so it is refused. */
export const PASSWORD_MAX_BYTES = 72;

/** A generated temporary password's length (V441: 14 or more). */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/** Where a sign-in that must change its password is sent (builder B's screen, outside the app's gate — V431). */
export const CHANGE_PASSWORD_PATH = '/set-password';

export type PasswordProblem = 'too_short' | 'too_long' | 'same_as_email';

/** What is wrong with a password, or null. Characters are counted as a person sees them (an Arabic letter is one). */
export function passwordProblem(password: string, email?: string | null): PasswordProblem | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'too_long';
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return 'same_as_email';
  return null;
}

// Letters and digits a person reads back without doubt (no 0/O, 1/l/I), and a few symbols that survive a copy.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.!?';

/** A temporary password (V441): random from a cryptographic source, TEMPORARY_PASSWORD_LENGTH characters. */
export function temporaryPassword(): string {
  let out = '';
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
