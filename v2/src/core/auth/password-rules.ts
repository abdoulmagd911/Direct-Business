// The password rules (owner, 29 Sep 13:50; V166): at least ten characters, said plainly on the screen — never a
// strength meter; at most 72 bytes, because Supabase Auth would cut a longer one without a word; never the e-mail
// itself. One place for every form and for the server, which checks them before Auth ever sees a password; the Auth
// project holds the same minimum (supabase/config.toml minimum_password_length; the cloud project's is the owner's).
export const MIN_PASSWORD = 10;

/** Supabase Auth hashes at most 72 bytes of a password; a longer one would be cut without a word, so it is refused. */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = 'too_short' | 'too_long' | 'same_as_email';

/** What is wrong with a password, or null. Characters are counted as a person sees them (an Arabic letter is one). */
export function passwordProblem(password: string, email?: string | null): PasswordProblem | null {
  if (typeof password !== 'string' || [...password].length < MIN_PASSWORD) return 'too_short';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'too_long';
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return 'same_as_email';
  return null;
}

/** Which door the sign-in page shows: `password` (the owner's decision) or `code` (kept in the code, off). */
export type SignInMethod = 'password' | 'code';
export function signInMethod(): SignInMethod {
  return process.env.SIGN_IN_METHOD === 'code' ? 'code' : 'password';
}
