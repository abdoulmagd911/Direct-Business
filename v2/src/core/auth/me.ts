import type { Level } from '@/core/access/levels';

/**
 * `Me` — what the server knows about the signed-in person before the first paint (spec A5).
 * Shape follows core.person + core.person_profile (spec §3.1). Builder A's P3-2 fills it from api.me();
 * until then `getMe()` serves a made-up development person so the shell can be built and tested.
 */
export type AvatarColor = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6';
export type BadgeKind = 'none' | 'icon' | 'zodiac';

export type MeStatus = 'ok' | 'not_listed' | 'switched_off';

export type Me = {
  /** api.me() answers ok, not_listed or switched_off (V109); only ok comes with a person. */
  status: MeStatus;
  person: {
    id: string;
    fullName: string;
    displayName: string;
    jobTitle: string | null;
    teamName: string | null;
    avatarUrl: string | null;
    avatarColor: AvatarColor;
    badge: { kind: BadgeKind; value: string | null };
  };
  isAdmin: boolean;
  /** Effective level per page key (registry keys). */
  levels: Record<string, Level>;
  /** Capability keys granted (tasks.assign, finance.credit …). */
  capabilities: string[];
  /** Department ids: the person's own plus any granted. */
  departments: string[];
  unreadNotifications: number;
};

export const DEV_ME: Me = {
  status: 'ok',
  person: {
    id: '00000000-0000-4000-8000-000000000001',
    fullName: 'Test Person',
    displayName: 'Test',
    jobTitle: 'Key Account Manager',
    teamName: 'Corporate accounts',
    avatarUrl: null,
    avatarColor: 'c3',
    badge: { kind: 'icon', value: 'compass' },
  },
  isAdmin: true,
  levels: {
    'my-day': 'full',
    overview: 'full',
    partners: 'full',
    pipeline: 'full',
    projects: 'full',
    tasks: 'full',
    finance: 'full',
    kpis: 'full',
    reports: 'full',
    appraisal: 'own',
    settings: 'full',
  },
  capabilities: ['tasks.assign', 'companies.identify', 'finance.credit'],
  departments: ['00000000-0000-4000-8000-0000000000d1'],
  unreadNotifications: 0,
};

/**
 * Server-side: resolve the person for this request. Builder A replaces the body with the session check
 * and api.me() in P3-2 (spec §4); the signature stays. Returns null when nobody is signed in.
 */
export async function getMe(): Promise<Me | null> {
  if (
    process.env.V2_DEV_ME === '1' ||
    (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    return DEV_ME;
  }
  return null;
}
