// "Who am I" (A5): the shape api.me() answers in. The (app) gate asks before anything is drawn; screens read it through
// useMe() (me-context.tsx). Levels and capabilities come from the database — the browser never decides access (A12).

export type Level = 'none' | 'view' | 'own' | 'full';

export interface MePerson {
  id: string;
  kind: 'staff';
  full_name_en: string;
  full_name_ar: string | null;
  nickname_en: string | null;
  nickname_ar: string | null;
  job_title_en: string | null;
  job_title_ar: string | null;
  department_id: string;
  team_id: string | null;
  manager_id: string | null;
  role: { id: string; key: string; name_en: string; name_ar: string | null; is_admin: boolean } | null;
}

export interface MeProfile {
  display_name_en: string | null;
  display_name_ar: string | null;
  avatar_file_id: string | null;
  avatar_color: string | null;
  badge_kind: 'none' | 'icon' | 'zodiac';
  badge_value: string | null;
  theme: 'light' | 'dark' | 'colorful' | 'direct' | null;
  density: 'comfortable' | 'compact' | null;
  locale: 'en' | 'ar' | null;
  start_page: string | null;
  drawer_pinned: boolean | null;
  notify: unknown;
  version: number;
}

export interface Me {
  status: 'ok';
  session: { device_id: string; signed_in_at: string; last_seen_at: string; email: string };
  person: MePerson;
  levels: Record<string, Level>;
  capabilities: string[];
  departments: string[];
  profile: MeProfile | null;
}

/** Why a sign-in may not use the app: not on the allow-list, switched off, or this device signed out (and why). */
export type SignOutReason = 'person' | 'admin' | 'inactive' | 'switched_off' | 'unknown';
export type MeRefused =
  { status: 'not_listed' } | { status: 'switched_off' } | { status: 'signed_out'; reason: SignOutReason };

export type MeAnswer = Me | MeRefused;

/** The refusal a signed-out visitor is shown on the sign-in page (?reason=…), from the gate's answer. */
export type Refusal = 'not_listed' | 'switched_off' | 'inactive' | 'signed_out_elsewhere' | 'signed_out_by_admin';

export function refusalOf(answer: MeRefused): Refusal | null {
  if (answer.status !== 'signed_out') return answer.status;
  switch (answer.reason) {
    case 'inactive':
      return 'inactive';
    case 'admin':
      return 'signed_out_by_admin';
    case 'switched_off':
      return 'switched_off';
    case 'person':
      return 'signed_out_elsewhere';
    default:
      return null;
  }
}
