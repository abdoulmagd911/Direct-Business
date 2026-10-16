import type { Me } from '@/core/auth/me';
import type { AvatarPerson } from './Avatar';

/**
 * What the kit shows of the signed-in person (V9, V53), read from api.me()'s answer: the profile's display name,
 * else the nickname, else the full name; the badge.
 */
export function personOf(me: Me): AvatarPerson & { jobTitle: string | null } {
  const p = me.person;
  const pr = me.profile;
  return {
    displayName: pr?.display_name_en ?? p.nickname_en ?? p.full_name_en,
    fullName: p.full_name_en,
    avatarUrl: null,
    badge: { kind: pr?.badge_kind ?? 'none', value: pr?.badge_value ?? null },
    jobTitle: p.job_title_en,
  };
}

/** Whether a page shows: a level above none (§2.3, V125). A page the database does not know is hidden, not guessed. */
export function canSee(me: Me, pageKey: string): boolean {
  return (me.levels[pageKey] ?? 'none') !== 'none';
}
