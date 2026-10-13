#!/usr/bin/env node
// @ts-check
// Writes the preview gallery's page (index.html) from manifest.jsonl: grouped by page, then by role; the commit and
// the Riyadh time at the top; a role filter, a "needs a look" filter and a full-size viewer. The pictures sit next to
// it in shots/ and are published with it as the Artifact's files. Made-up data only (rule 7).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUN_DIR } from '../sweep/paths.mjs';

const OUT = process.env.QA_GALLERY_OUT || join(RUN_DIR, 'gallery');
const lines = readFileSync(join(OUT, 'manifest.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const sha = process.env.GALLERY_SHA || 'unknown';
const note = process.env.GALLERY_NOTE || '';
const when = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh',
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date());

const personas = [
  ['admin', 'Admin', 'an admin'],
  ['admin_account', 'Admin account', "a second admin, standing in for the owner's own account"],
  ['head', 'Head', 'Head of department'],
  ['manager', 'Manager', 'a manager'],
  ['member', 'Member', 'a member who owns two clients'],
  ['viewer', 'Viewer', 'a viewer'],
  ['noclients', 'Clients = none', 'a member whose Clients level is none'],
  ['qa_test', 'Test account', 'an admin, standing in for the QA test account'],
  ['signed-out', 'Signed out', 'nobody signed in yet'],
];
const data = { sha, when, note, personas, shots: lines };
const json = JSON.stringify(data).replace(/</g, '\\u003c');
// The oversight's review items, each with its retake pictures and fixed / not fixed (review.json beside the manifest).
const reviewFile = join(OUT, 'review.json');
const review = existsSync(reviewFile) ? readFileSync(reviewFile, 'utf8').replace(/</g, '\\u003c') : 'null';
const sweepFile = join(OUT, 'sweep.json');
const sweep = existsSync(sweepFile) ? readFileSync(sweepFile, 'utf8').replace(/</g, '\\u003c') : 'null';

const html = `<title>Commercial v2 — Preview gallery</title>
<style>
/* Layout: a working contact sheet — a sticky filter bar, then one band per page with a row of role frames. */
:root {
  --bg: #f3f4f1; --panel: #ffffff; --ink: #1d2327; --muted: #5d676e; --line: #d9ddd8; --accent: #1f5f8b;
  --ok: #2f6b3f; --okbg: #e3efe5; --warn: #8a5a00; --warnbg: #f7ecd5; --bad: #9b2226; --badbg: #f6dfdf;
  --info: #3d4f8f; --infobg: #e3e7f4; --sheet: #e6e8eb;
  --display: "Fraunces", Georgia, serif; --body: "IBM Plex Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #15191c; --panel: #1d2226; --ink: #e8ebe6; --muted: #9aa4aa; --line: #30373c; --accent: #7fb6dc;
  --ok: #8fd19e; --okbg: #1f3325; --warn: #e8c071; --warnbg: #3a2f17; --bad: #f19a9d; --badbg: #3d1f21;
  --info: #a9b6ee; --infobg: #242b45; --sheet: #2a3035; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #15191c; --panel: #1d2226; --ink: #e8ebe6; --muted: #9aa4aa; --line: #30373c; --accent: #7fb6dc;
  --ok: #8fd19e; --okbg: #1f3325; --warn: #e8c071; --warnbg: #3a2f17; --bad: #f19a9d; --badbg: #3d1f21;
  --info: #a9b6ee; --infobg: #242b45; --sheet: #2a3035; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); }
.wrap { max-width: 1480px; margin: 0 auto; padding-inline: 20px; padding-block: 24px 64px; }
header h1 { font: 600 clamp(26px, 4vw, 38px)/1.1 var(--display); margin: 0 0 6px; text-wrap: balance; }
.meta { color: var(--muted); font: 13px var(--mono); display: flex; flex-wrap: wrap; gap: 6px 18px; }
.meta b { color: var(--ink); font-weight: 600; }
.intro { max-width: 70ch; margin: 12px 0 0; color: var(--muted); }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg);
  border-bottom: 1px solid var(--line); padding-block: 10px; margin-block: 16px 8px; display: flex; flex-wrap: wrap;
  gap: 8px 16px; align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: 13px var(--body); border: 1px solid var(--line); background: var(--panel); color: var(--ink);
  border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.chip:focus-visible, .frame button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
select { font: 13px var(--body); padding: 5px 8px; border-radius: 6px; border: 1px solid var(--line);
  background: var(--panel); color: var(--ink); max-width: 100%; }
.count { color: var(--muted); font: 12px var(--mono); margin-left: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 13px; margin-top: 10px; }
section.page { padding-block: 18px 6px; border-top: 1px solid var(--line); }
section.page h2 { font: 600 20px/1.2 var(--display); margin: 0; }
.where { font: 12px var(--mono); color: var(--muted); margin: 2px 0 12px; overflow-wrap: anywhere; }
.group { font: 600 11px var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--accent);
  margin: 28px 0 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.frame { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; min-width: 0;
  display: flex; flex-direction: column; }
.frame button { all: unset; cursor: zoom-in; display: block; background: var(--sheet); }
.frame img { display: block; width: 100%; height: 230px; object-fit: cover; object-position: top left; }
.cap { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
.who { font-weight: 600; font-size: 14px; }
.states { display: flex; flex-wrap: wrap; gap: 4px; font: 11.5px var(--mono); }
.st { border-radius: 4px; padding: 1px 6px; background: var(--okbg); color: var(--ok); }
.st.no-access, .st.set-password { background: var(--infobg); color: var(--info); }
.st.not-found, .st.failed-read, .st.sign-in, .st.empty { background: var(--warnbg); color: var(--warn); }
.st.crash { background: var(--badbg); color: var(--bad); }
.st.error-page { background: var(--badbg); color: var(--bad); }
.st.app-crash-page { background: var(--warnbg); color: var(--warn); }
.err { font: 11.5px var(--mono); color: var(--bad); }
.empty-note { color: var(--muted); font-style: italic; }
#review { margin-top: 18px; }
#review h2 { font: 600 22px/1.2 var(--display); margin: 0 0 4px; }
#review .sub { color: var(--muted); margin: 0 0 10px; max-width: 75ch; }
.item { display: grid; grid-template-columns: 2.2em minmax(0, 1fr); gap: 4px 10px; padding: 10px 0;
  border-top: 1px solid var(--line); }
.item .n { font: 600 15px var(--mono); color: var(--muted); }
.item .t { font-weight: 600; }
.item .lane { color: var(--muted); font-size: 13px; }
.item .note { color: var(--muted); font-size: 14px; }
.item .row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.item .thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.item .thumbs button { all: unset; cursor: zoom-in; border: 1px solid var(--line); border-radius: 6px; overflow: hidden;
  background: var(--sheet); }
.item .thumbs img { display: block; width: 220px; max-width: 42vw; height: 120px; object-fit: cover; object-position: top left; }
.item .thumbs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rs { border-radius: 4px; padding: 1px 7px; font: 600 12px var(--body); }
.rs.fixed { background: var(--okbg); color: var(--ok); }
.rs.not-fixed { background: var(--badbg); color: var(--bad); }
.rs.partly { background: var(--warnbg); color: var(--warn); }
.rs.on-pr { background: var(--infobg); color: var(--info); }
#viewer { position: fixed; inset: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 94%, transparent);
  overflow: auto; padding: calc(env(safe-area-inset-top, 0px) + 56px) 16px 32px; }
#viewer img { max-width: none; display: block; margin: 0 auto; }
#viewer .top { position: fixed; top: env(safe-area-inset-top, 0px); left: 0; right: 0; display: flex; gap: 10px;
  align-items: center; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
#viewer .top span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#viewer .fit img { max-width: 100%; }
@media (prefers-reduced-motion: no-preference) { .frame { transition: border-color .15s; } .frame:hover { border-color: var(--accent); } }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&display=swap">
<div class="wrap">
  <header>
    <h1>Commercial v2 — Preview gallery</h1>
    <div class="meta" id="meta"></div>
    <p class="intro">Every page of Commercial v2 as each role sees it, desktop (1440) beside phone (390), full length.
      Taken on a local copy of the app with made-up people and organisations only — nothing here is company data.
      Click a picture to open it full size.</p>
    <div class="legend" id="legend"></div>
  </header>
  <div class="bar">
    <div class="chips" id="roles" role="group" aria-label="Show a role"></div>
    <label><select id="only" aria-label="Show"><option value="all">Every picture</option>
      <option value="look">Needs a look (error, not found, sent to sign-in, failed read)</option>
      <option value="noaccess">No-access states</option></select></label>
    <label><select id="jump" aria-label="Go to a page"></select></label>
    <span class="count" id="count"></span>
  </div>
  <section id="review" hidden></section>
  <main id="pages"></main>
</div>
<div id="viewer" hidden><div class="top"><button class="chip" id="prev">Previous</button><button class="chip" id="next">Next</button>
  <button class="chip" id="fit">Fit width</button><span id="vcap"></span><button class="chip" id="close">Close</button></div>
  <div id="vbody"><img id="vimg" alt=""></div></div>
<script>
const DATA = ${json};
const SWEEP = ${sweep};
const REVIEW = ${review};
const STATE_WORDS = { 'renders': 'shows', 'no-access': 'no access', 'not-found': 'not found', 'crash': 'crashed',
  'error-page': 'built-in error page', 'app-crash-page': "the app's crash page",
  'failed-read': 'failed read', 'empty': 'empty', 'sign-in': 'sent to sign-in', 'set-password': 'choose a password' };
const PASS_TITLE = { empty: 'Before any record exists (an admin)', error: 'When the data does not answer (an admin)',
  door: 'Signing in' };
const LOOK = ['crash', 'error-page', 'not-found', 'sign-in', 'failed-read'];
const names = Object.fromEntries(DATA.personas.map((p) => [p[0], p[1]]));
const notes = Object.fromEntries(DATA.personas.map((p) => [p[0], p[2]]));
let role = 'all', only = 'all', list = [], at = 0;
try { role = localStorage.getItem('gallery.role') || 'all'; } catch (e) {}

document.getElementById('meta').innerHTML =
  '<span>v2/main at <b>' + DATA.sha + '</b></span><span>taken <b>' + DATA.when + '</b> (Riyadh)</span>' +
  '<span><b>' + DATA.shots.length + '</b> pictures</span>' + (DATA.note ? '<span>' + DATA.note + '</span>' : '');
document.getElementById('legend').innerHTML = DATA.personas.filter((p) => p[0] !== 'signed-out')
  .map((p) => '<span><b>' + p[1] + '</b>: ' + p[2] + '</span>').join('');

const rolesEl = document.getElementById('roles');
[['all', 'Every role']].concat(DATA.personas.map((p) => [p[0], p[1]])).forEach(([k, label]) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = label; b.dataset.k = k;
  b.addEventListener('click', () => { role = k; try { localStorage.setItem('gallery.role', k); } catch (e) {} render(); });
  rolesEl.appendChild(b);
});
document.getElementById('only').addEventListener('change', (e) => { only = e.target.value; render(); });
document.getElementById('jump').addEventListener('change', (e) => {
  const t = document.getElementById(e.target.value); if (t) t.scrollIntoView(); });

function states(s) {
  const parts = String(s.state).split(' / ');
  const d = s.desktop.state, p = s.phone.state;
  const chip = (st, w) => '<span class="st ' + st + '">' + w + ' ' + (STATE_WORDS[st] || st) + '</span>';
  return d === p ? chip(d, '1440 · 390') : chip(d, '1440') + chip(p, '390');
}
function keep(s) {
  if (role !== 'all' && s.persona !== role) return false;
  if (only === 'look') return LOOK.includes(s.desktop.state) || LOOK.includes(s.phone.state) || s.desktop.errors + s.phone.errors > 0;
  if (only === 'noaccess') return s.desktop.state === 'no-access' || s.phone.state === 'no-access';
  return true;
}
function render() {
  rolesEl.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === role)));
  const order = DATA.personas.map((p) => p[0]);
  const bands = [];
  const seen = new Map();
  for (const s of DATA.shots) {
    const key = (s.pass === 'filled' ? '' : s.pass + ':') + s.route;
    if (!seen.has(key)) { seen.set(key, { key, s, items: [] }); bands.push(seen.get(key)); }
    seen.get(key).items.push(s);
  }
  const passRank = { door: 0, filled: 1, empty: 2, error: 3 };
  bands.sort((a, b) => (passRank[a.s.pass] ?? 4) - (passRank[b.s.pass] ?? 4));
  list = [];
  let html = '', group = '', jump = '';
  for (const band of bands) {
    const items = band.items.filter(keep).sort((a, b) => order.indexOf(a.persona) - order.indexOf(b.persona));
    const g = band.s.pass === 'filled' ? band.s.group : band.s.passTitle || PASS_TITLE[band.s.pass] || band.s.pass;
    if (!items.length) continue;
    const id = 'p-' + band.key.replace(/[^a-z0-9-]/gi, '-');
    if (g !== group) { html += '<div class="group">' + g + '</div>'; group = g; jump += '<optgroup label="' + g + '">'; }
    jump += '<option value="' + id + '">' + band.s.label + '</option>';
    html += '<section class="page" id="' + id + '"><h2>' + band.s.label + '</h2><div class="where">' + band.s.path +
      '</div><div class="grid">';
    for (const s of items) {
      const i = list.push(s) - 1;
      const errs = s.desktop.errors + s.phone.errors;
      html += '<article class="frame"><button data-i="' + i + '" aria-label="Open ' + band.s.label + ' as ' +
        (names[s.persona] || s.persona) + ' full size"><img loading="lazy" src="' + s.file + '" alt=""></button>' +
        '<div class="cap"><span class="who">' + (names[s.persona] || s.persona) + '</span><span class="states">' +
        states(s) + '</span>' + (errs ? '<span class="err">' + errs + ' console error' + (errs > 1 ? 's' : '') +
        '</span>' : '') + '</div></article>';
    }
    html += '</div></section>';
  }
  document.getElementById('pages').innerHTML = html ||
    '<p class="empty-note">No picture matches this filter. Choose "Every picture" or another role.</p>';
  document.getElementById('jump').innerHTML = '<option value="">Go to a page…</option>' + jump;
  document.getElementById('count').textContent = list.length + ' of ' + DATA.shots.length + ' pictures';
  document.querySelectorAll('.frame button').forEach((b) => b.addEventListener('click', () => open(+b.dataset.i)));
}
const viewer = document.getElementById('viewer'), vimg = document.getElementById('vimg');
const RS_WORDS = { 'fixed': 'Fixed', 'not-fixed': 'Not fixed', 'partly': 'Partly fixed', 'on-pr': 'Fixed on a PR, not merged' };
function openFile(file, cap) {
  const i = list.findIndex((s) => s.file === file);
  if (i >= 0) return open(i);
  vimg.src = file; document.getElementById('vcap').textContent = cap;
  viewer.hidden = false; viewer.scrollTop = 0; document.getElementById('close').focus();
}
if (REVIEW && REVIEW.items && REVIEW.items.length) {
  const el = document.getElementById('review');
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  el.innerHTML = '<h2>Review items</h2><p class="sub">' + esc(REVIEW.intro || '') + '</p>' + REVIEW.items.map((it) =>
    '<div class="item"><span class="n">' + esc(it.n) + '</span><div><div class="row"><span class="t">' + esc(it.title) +
    '</span><span class="rs ' + it.status + '">' + (RS_WORDS[it.status] || it.status) + '</span><span class="lane">' +
    esc(it.lane || '') + '</span></div><div class="note">' + esc(it.note || '') + '</div><div class="thumbs">' +
    (it.shots || []).map((f) => '<button data-f="' + esc(f) + '" data-c="' + esc(it.n + ' · ' + it.title) +
      '" aria-label="Open the retake for item ' + esc(it.n) + '"><img loading="lazy" src="' + esc(f) + '" alt=""></button>').join('') +
    '</div></div></div>').join('');
  el.hidden = false;
  el.querySelectorAll('button[data-f]').forEach((b) => b.addEventListener('click', () => openFile(b.dataset.f, b.dataset.c)));
}
function open(i) {
  at = (i + list.length) % list.length; const s = list[at];
  vimg.src = s.file;
  document.getElementById('vcap').textContent = s.label + ' · ' + (names[s.persona] || s.persona) + ' · ' + s.path;
  viewer.hidden = false; viewer.scrollTop = 0; document.getElementById('close').focus();
}
document.getElementById('prev').addEventListener('click', () => open(at - 1));
document.getElementById('next').addEventListener('click', () => open(at + 1));
document.getElementById('fit').addEventListener('click', () => document.getElementById('vbody').classList.toggle('fit'));
document.getElementById('close').addEventListener('click', () => { viewer.hidden = true; });
document.addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'Escape') viewer.hidden = true;
  if (e.key === 'ArrowRight') open(at + 1);
  if (e.key === 'ArrowLeft') open(at - 1);
});
render();
</script>
`;
writeFileSync(join(OUT, 'index.html'), html);
console.log(`gallery page: ${join(OUT, 'index.html')} (${lines.length} pictures)`);
