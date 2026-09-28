/**
 * The sign-in door (spec §4, V2, corrected by V59 — owner, 28 Sep): the ONLY door is the emailed
 * 6-digit code. Builder A's P3-2 implements it against Supabase Auth; the screen only knows the calls
 * and their outcomes. Every refusal is a named reason said in words. Google and Zoom may return only
 * when their keys exist and the owner asks.
 */
export type SignInRefusal = 'invalidEmail' | 'notListed' | 'switchedOff' | 'expired' | 'wrongCode' | 'unavailable';
export type SignInResult = { ok: true } | { ok: false; reason: SignInRefusal };

export type SignInApi = {
  sendCode: (email: string) => Promise<SignInResult>;
  verifyCode: (email: string, code: string) => Promise<SignInResult>;
};

/** Development stand-in until P3-2 lands: accepts any address on the two staff domains and the code 000000. */
export const devSignInApi: SignInApi = {
  async sendCode(email) {
    if (!/^[^@\s]+@(directksa\.com|directksa\.net)$/i.test(email)) return { ok: false, reason: 'notListed' };
    return { ok: true };
  },
  async verifyCode(_email, code) {
    return code === '000000' ? { ok: true } : { ok: false, reason: 'wrongCode' };
  },
};
