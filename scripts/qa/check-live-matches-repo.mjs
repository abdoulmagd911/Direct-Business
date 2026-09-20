/* check-live-matches-repo.mjs — is the site actually serving what this repository says?

   This project spent months on a particular kind of dead end: a change was made, it looked right,
   and nothing about it reached the screen — because the thing being edited was not the thing being
   served (see "⛔ Do NOT run the old deploy scripts" in CLAUDE.md). Deploys are automatic now, and
   every round of this sweep ends by curling one file to confirm a push landed. One file is a
   sample. This checks all of them.

   What it does: reads every <script src="/js/…"> out of index.html, fetches each one from the live
   site with a cache-buster, and compares the SHA-256 against the file on disk. Then the same for
   index.html itself. It reports three kinds of trouble separately, because they mean different
   things:
     · NOT SERVED — the live site answers something other than 200 for a file the page asks for.
       That is a layer that silently does not exist for anybody using the app.
     · DIFFERENT — served, but not the bytes in this repository. Either a deploy is still in flight
       (wait ~30s and re-run) or the site is serving something this repo did not produce.
     · MISSING LOCALLY — index.html asks for a file that is not in the repo at all.

   It needs the network and reaches production, so it is not in the battery — run it by hand at the
   end of a sweep, the same way check-public-surface is run. A cache-buster is mandatory here: the
   CDN will otherwise hand back the previous version and this check will "prove" a push failed.

   Run:  node scripts/qa/check-live-matches-repo.mjs
         node scripts/qa/check-live-matches-repo.mjs https://direct-business.vercel.app          */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SITE = (process.argv[2] || 'https://www.directksab2b.com').replace(/\/$/, '');
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const html = fs.readFileSync(path.join(ROOT, 'index.html'));
const srcs = [...html.toString('utf8').matchAll(/src="(\/js\/[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(srcs)];
if (!uniq.length) { console.log('check-live-matches-repo: no /js/ script tags found in index.html — nothing to compare'); process.exit(1); }

const notServed = [], different = [], missingLocal = [];
const bust = () => '?cb=' + Date.now() + '-' + Math.random().toString(36).slice(2);

async function one(p) {
  const local = path.join(ROOT, p.replace(/^\//, ''));
  if (!fs.existsSync(local)) { missingLocal.push(p); return; }
  let resp;
  try { resp = await fetch(SITE + p + bust()); } catch (e) { notServed.push(p + ' (' + String(e && e.message || e).slice(0, 60) + ')'); return; }
  if (resp.status !== 200) { notServed.push(p + ' (HTTP ' + resp.status + ')'); return; }
  const live = Buffer.from(await resp.arrayBuffer());
  if (sha(live) !== sha(fs.readFileSync(local))) different.push(p);
}

/* a few at a time — this is production, not a load test */
for (let i = 0; i < uniq.length; i += 4) await Promise.all(uniq.slice(i, i + 4).map(one));

let indexSame = null;
try {
  const r = await fetch(SITE + '/' + bust());
  indexSame = (r.status === 200) ? (sha(Buffer.from(await r.arrayBuffer())) === sha(html)) : null;
  if (r.status !== 200) notServed.push('/ (HTTP ' + r.status + ')');
} catch (e) { notServed.push('/ (' + String(e && e.message || e).slice(0, 60) + ')'); }

console.log('checked ' + uniq.length + ' script files + index.html against ' + SITE);
if (missingLocal.length) console.log('  MISSING LOCALLY (index.html asks for it, the repo has not got it):\n    ' + missingLocal.join('\n    '));
if (notServed.length) console.log('  NOT SERVED by the live site:\n    ' + notServed.join('\n    '));
if (different.length) console.log('  DIFFERENT from this repository (a deploy in flight, or something this repo did not produce):\n    ' + different.join('\n    '));
if (indexSame === false) console.log('  DIFFERENT: index.html itself');

const bad = missingLocal.length + notServed.length + different.length + (indexSame === false ? 1 : 0);
if (bad) { console.log('live-matches-repo FAILED — ' + bad + ' file(s) the site does not serve as this repo has them'); process.exit(1); }
console.log('live-matches-repo OK — every file the page asks for is served, and byte-for-byte what this repository holds');
