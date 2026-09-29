// The password rule (owner, 29 Sep 13:50): at least ten characters, said plainly on the screen — never a strength
// meter. Checked here on the server and in every form alike.
export const MIN_PASSWORD = 10;

export function passwordOk(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD;
}

/** Which door the sign-in page shows: `password` (the owner's decision) or `code` (kept in the code, off). */
export type SignInMethod = 'password' | 'code';
export function signInMethod(): SignInMethod {
  return process.env.SIGN_IN_METHOD === 'code' ? 'code' : 'password';
}

/** The auth user's `app_metadata` flag: the person sets their own password before anything else (V212). */
export const MUST_CHANGE = 'must_change_password';
