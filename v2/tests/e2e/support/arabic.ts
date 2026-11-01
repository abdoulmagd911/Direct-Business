import pg from 'pg';
import { sql } from './stack';

/**
 * Arabic on for the length of one case, then off again. The setting reaches every screen and the Arabic specs run in
 * parallel workers, so they take turns: one database lock is held for the whole case (a second case waits for it, and
 * one case's clean-up can never switch Arabic off under another). Every spec that turns Arabic on goes through this.
 */
export async function withArabicOn(by: string, reason: string, run: () => Promise<void>): Promise<void> {
  const url = process.env.V2_DB_URL;
  if (!url)
    throw new Error("V2_DB_URL is not set — run the specs with the stack's settings (scripts/e2e/stack-env.mjs)");
  const lock = new pg.Client({ connectionString: url });
  await lock.connect();
  try {
    await lock.query(`select pg_advisory_lock(hashtext('e2e: Arabic is on'))`);
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled' and deleted_at is null`);
    await sql(
      `insert into core.setting (key, value, valid_from, reason, created_by)
         values ('app.arabic_enabled', 'true'::jsonb, current_date, $2, $1)`,
      [by, reason],
    );
    try {
      await run();
    } finally {
      await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
    }
  } finally {
    await lock.end();
  }
}
