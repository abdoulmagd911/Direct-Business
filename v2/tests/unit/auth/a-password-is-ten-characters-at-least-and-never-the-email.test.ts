import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, passwordProblem } from '../../../src/core/auth/password';

// V166: the owner's minimum is 10 characters; a password Auth would cut (over 72 bytes) or the e-mail itself is refused
// before Auth sees it. Made-up values only. Sabotage: tests/sabotage/blind-password-rules.mjs.
describe('a password is ten characters at least and never the email', () => {
  it('refuses fewer than ten characters, counted as a person sees them', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(passwordProblem('Made-up-9')).toBe('too_short');
    expect(passwordProblem('Made-up-10')).toBeNull();
    expect(passwordProblem('كلمةمتخيلة')).toBeNull(); // ten Arabic letters: ten characters, twenty bytes
    expect(passwordProblem('كلمةمتخيل')).toBe('too_short');
  });
  it('refuses what Auth would cut and the email itself', () => {
    expect(passwordProblem('a'.repeat(72))).toBeNull();
    expect(passwordProblem('a'.repeat(73))).toBe('too_long');
    expect(passwordProblem('ب'.repeat(37))).toBe('too_long'); // 74 bytes
    expect(passwordProblem('Test.Person@example.test', 'test.person@example.test')).toBe('same_as_email');
    expect(passwordProblem('Made-up-password-1', 'test.person@example.test')).toBeNull();
  });
});
