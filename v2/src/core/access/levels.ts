/** core.level, ordered: none < view < own < full (spec §3.1, D2). */
export const LEVELS = ['none', 'view', 'own', 'full'] as const;
export type Level = (typeof LEVELS)[number];

export function atLeast(have: Level, need: Level): boolean {
  return LEVELS.indexOf(have) >= LEVELS.indexOf(need);
}
