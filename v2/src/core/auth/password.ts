// The server's side of passwords (V166, V431, V441): the temporary passwords it generates (nobody types a password for
// someone else) and where a sign-in that must change its password goes. The rules themselves live in
// password-rules.ts, shared with the forms; a refusal comes back as a key, and the screen words it.
import { randomInt } from 'node:crypto';
import { MIN_PASSWORD } from './password-rules';

export { PASSWORD_MAX_BYTES, passwordProblem, type PasswordProblem } from './password-rules';

/** The owner's minimum (29 Sep), from the one place the rules live (password-rules.ts). */
export const PASSWORD_MIN_LENGTH = MIN_PASSWORD;

/** A generated temporary password's length (V441: 14 or more). */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/** Where a sign-in that must change its password is sent (builder B's screen, outside the app's gate — V431). */
export const CHANGE_PASSWORD_PATH = '/set-password';

// Letters and digits a person reads back without doubt (no 0/O, 1/l/I), and a few symbols that survive a copy.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.!?';

/** A temporary password (V441): random from a cryptographic source, TEMPORARY_PASSWORD_LENGTH characters. */
export function temporaryPassword(): string {
  let out = '';
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
