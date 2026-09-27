/* golive-backup.mjs (2026-09-27) — runs the full backup before a data reset (DECISIONS D9). Drives the edge function
   `golive-backup` one table at a time (one call for all 132 tables ran past the worker's compute limit), then keeps a
   SECOND copy of every file on this machine. No data passes through this repository: the files land in the private
   bucket `golive-backups` and in OUT (default: a scratch folder), never in git (rule 7).

   Run:  QA_EMAIL=… QA_PW=… OUT=/some/scratch env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy \
           node scripts/ops/golive-backup.mjs
   The account must be an admin. Prints the stamp, per-table failures, the totals, and exits 1 unless every table's
   file was read back from storage and proved restorable ("same": every row goes back through the table's own type
   and equals the live table). */
import fs from 'fs';
const URL_ = 'https://vkxoeeoauexyfpzqufqd.supabase.co', KEY = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const FN = URL_ + '/functions/v1/golive-backup';
const OUT = process.env.OUT || '/tmp/golive-backup';
if (!process.env.QA_EMAIL || !process.env.QA_PW) throw new Error('QA_EMAIL and QA_PW (an admin account) are required');
const s = await (await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.QA_EMAIL, password: process.env.QA_PW }) })).json();
if (!s.access_token) throw new Error('sign-in failed');
const H = { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'content-type': 'application/json' };
const call = async (b) => { for (let i = 0; i < 3; i++) { const r = await fetch(FN, { method: 'POST', headers: H, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({ error: 'HTTP ' + r.status }));
  if (r.ok) return j; if (i === 2) return { ...j, http: r.status }; await new Promise((z) => setTimeout(z, 2000)); } };
const { stamp, tables } = await call({ mode: 'tables' });
console.log('stamp', stamp, '·', tables.length, 'tables');
const manifest = [];
const TARGET = 400000;   /* ~0.4 MB of stored table per piece (about 1 MB of JSON): a 9 MB table in one piece, then 3 MB pieces, ran past the statement timeout */
for (const t of tables) {
  const plan = await call({ mode: 'plan', t });
  const rows = Number(plan.rows || 0), lim = Math.max(1, Math.floor(rows * TARGET / Math.max(Number(plan.bytes || 1), 1)) || rows || 1);
  const pieces = []; let off = 0, part = 0;
  do {
    const m = await call({ mode: 'piece', stamp, t, part: part++, off, lim });
    /* a piece whose check ran past the statement timeout (a few rows of app_state_bak are several MB each) is taken
       again one row at a time, under new part numbers; the timed-out file stays in the bucket but is not counted */
    if (m.same !== true && lim > 1 && /statement timeout/.test(m.error || '')) {
      for (let k = 0; k < lim && off + k < rows; k++) pieces.push(await call({ mode: 'piece', stamp, t, part: part++, off: off + k, lim: 1 }));
    } else pieces.push(m);
    off += lim;
  } while (off < rows);
  const e = { table: t, rows, pieces: pieces.length, file_rows: pieces.reduce((a, m) => a + Number(m.file_rows || 0), 0),
    bytes: pieces.reduce((a, m) => a + Number(m.bytes || 0), 0), same: pieces.every((m) => m.same === true && m.identical_bytes === true) && pieces.reduce((a, m) => a + Number(m.file_rows || 0), 0) === rows,
    errors: pieces.filter((m) => m.same !== true).map((m) => m.error || ('md5 ' + m.part)) };
  manifest.push(e); if (!e.same) console.log('  ✗', t, JSON.stringify(e).slice(0, 240));
}
const summary = { stamp, bucket: 'golive-backups', tables: manifest.length, all_same: manifest.every((m) => m.same === true),
  rows: manifest.reduce((a, m) => a + Number(m.file_rows || 0), 0), bytes: manifest.reduce((a, m) => a + Number(m.bytes || 0), 0) };
await call({ mode: 'manifest', stamp, manifest: { summary, manifest } });
const L = await call({ mode: 'links', stamp }); const dir = OUT + '/' + stamp; fs.mkdirSync(dir, { recursive: true });
let n = 0, b = 0; for (const [f, u] of Object.entries(L.links || {})) { const buf = Buffer.from(await (await fetch(u)).arrayBuffer()); fs.writeFileSync(dir + '/' + f, buf); n++; b += buf.length; }
console.log(JSON.stringify(summary));
console.log('second copy:', n, 'files,', b, 'bytes in', dir);
process.exit(summary.all_same && n >= manifest.reduce((a, m) => a + m.pieces, 0) + 1 ? 0 : 1);
