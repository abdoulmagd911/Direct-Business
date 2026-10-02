// The admin's steps of the employee view (brief E, V217), made once before the specs as an admin would make them in
// Settings › People & access › Access: a member starts at none on Pipeline (the Business Development and Business
// Solutions people get Own by a person change), a Viewer at none on Tasks and Pipeline; the roles read Head and Member.
// The live project gets the same from the oversight after merge (never from code); the registry's defaults follow when
// builder A's sync can move a starting level that still holds the old default (a database built from zero must match
// the registry — REG-01). Each change is made only where the old starting value still stands.
import pg from 'pg';

const LEVELS: [role: string, page: string, from: string, to: string][] = [
  ['member', 'pipeline', 'own', 'none'],
  ['viewer', 'pipeline', 'view', 'none'],
  ['viewer', 'tasks', 'view', 'none'],
];

const NAMES: [role: string, from: string, to: string][] = [
  ['head', 'Head of department', 'Head'],
  ['member', 'Team member', 'Member'],
];

export default async function employeeViewAccess() {
  const url = process.env.V2_DB_URL;
  if (!url) throw new Error('V2_DB_URL is not set — run the specs with the stack settings (scripts/e2e/stack-env.mjs)');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`select audit.begin('system', 'registry.synced')`);
    for (const [role, page, from, to] of LEVELS)
      await client.query(
        `update core.role_page_level l set level = $4::core.level
           from core.role r where r.id = l.role_id and r.key = $1 and l.page_key = $2 and l.level = $3::core.level`,
        [role, page, from, to],
      );
    for (const [role, from, to] of NAMES)
      await client.query(`update core.role set name_en = $3 where key = $1 and name_en = $2`, [role, from, to]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    await client.end();
  }
}
