// Where the database is (TECH-SPEC §10). Three settings, pasted into Vercel by the owner only (V84):
//   NEXT_PUBLIC_SUPABASE_URL              the project's address                 public by design, reaches the browser
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  the publishable key (sb_publishable_…) public by design, reaches the browser
//   SUPABASE_SECRET_KEY                   the secret key (sb_secret_…)          server only — read by service.ts alone
// Read when first needed, not at import, so a build without them still succeeds and a missing one fails loudly at the
// first request, naming the setting, instead of as a vague network error.

export class MissingSetting extends Error {
  constructor(readonly setting: string) {
    super(`The setting ${setting} is missing from this deployment's environment.`);
    this.name = 'MissingSetting';
  }
}

function need(setting: string, value: string | undefined): string {
  if (!value) throw new MissingSetting(setting);
  return value;
}

// Written out in full: Next.js inlines NEXT_PUBLIC_ values into the browser bundle only when named literally.
export function supabaseUrl(): string {
  return need('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function publishableKey(): string {
  return need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
