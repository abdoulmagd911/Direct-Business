/* probe-access-truth.mjs — the access screen must not lie, and a page you cannot open must not
   be writable (2026-09-02, round 30). Three defects found by reading the source, each confirmed
   against the live schema before being touched. None had bitten yet; all three would bite on
   first use of the feature they sit behind.

   1. THE ACCESS MATRIX CALLED UNKNOWN ROLES "ADMIN".
      js/56 offers three levels (admin / manager / team_member) but app_users.role has no check
      constraint and the app also understands bd, operations and viewer (js/49's CAN table,
      app_role()). A user on one of those matched no <option>, and a select with nothing
      selected shows its FIRST option — "Admin". The one screen whose job is to answer "who has
      admin rights?" answered wrongly, in the most dangerous direction; and an admin who
      "corrected" it to Employee would have silently overwritten the real role. Such a role is
      now shown by name and marked "not one of the three levels".

   2. A DENIED PAGE WAS STILL WRITABLE.
      js/49 guards writes by ROLE; js/64 bounces by the per-user PAGE matrix. They disagreed. A
      team_member whose Proposals access is "No access" passes can('proposals') — the role
      writes proposals — so Today's "New offer" tile ran newOffer(), which pushes a record and
      save()s it on the spot, and only THEN did render() bounce them with "You do not have
      access to that page". A blank proposal was created and stored by someone denied the page,
      who never saw it and could not delete it. Guarded actions now check the page first.

   3. A STRAY "n" SAVED A BLANK PROPOSAL.
      The n shortcut opens a cancellable form on Invoices, Bookings and Leads — nothing is
      stored until you choose to store it. On Proposals alone it called newOffer() straight
      through, so one stray keystroke while reading the list wrote a blank DB-xxxxxx draft into
      the database and the proposal counts. It now asks first. The "+ New proposal" BUTTON is
      unchanged: clicking a button with that label is itself the intent.

   Sabotages: put the plain TIER.map back in js/56 -> an operations user reads "Admin" -> red.
   Drop the mayOpen() call from guardFn -> the denied user's click creates a proposal -> red.
   Drop the confirm -> the keystroke saves without asking -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8396;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  let lastDialog = null;
  p.on('dialog', (d) => { lastDialog = { type: d.type(), message: d.message() }; d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6500);

  // ---- 1. the access matrix, read off the real Settings screen the way an admin sees it.
  // The harness seeds four accounts: admin, team_member, operations and viewer — the last two
  // are roles this screen does not offer, which is the whole point.
  await p.evaluate(() => { openLead = null; current = 'settings'; render(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { if (typeof render === 'function') render(); });   // second pass: axLoad paints on the reply
  await p.waitForTimeout(1500);
  const cards = await p.evaluate(() => {
    const host = document.getElementById('axHost');
    if (!host) return 'no-host';
    return [...host.querySelectorAll('select')]
      .filter((s) => (s.getAttribute('onchange') || '').indexOf('axSetRole') >= 0)
      .map((s) => {
        const card = s.closest('.ax-card');
        const email = card ? (card.querySelector('span') || {}).textContent || '' : '';
        return { email: String(email).trim(), value: s.value, label: ((s.selectedOptions[0] || {}).textContent || '').trim() };
      });
  });
  if (cards === 'no-host') fail('the access matrix did not render on Settings — cannot check what it says');
  else {
    const by = {};
    cards.forEach((c) => { by[c.email] = c; });
    const expect = [
      ['test@directksa.com', 'admin', 'Admin', true],
      ['assem.alsweed@directksa.com', 'team_member', 'Employee', true],
      ['finance.person@directksa.com', 'operations', 'Operations', false],
      ['switched.off@directksa.com', 'viewer', 'Read only', false],
    ];
    expect.forEach(([email, role, word, offered]) => {
      const c = by[email];
      if (!c) { fail('no role dropdown found for ' + email); return; }
      if (c.value !== role) {
        fail(`${email} is role "${role}" in the database but the access screen has "${c.value}" selected (shown as "${c.label}")` +
          (c.value === 'admin' ? ' — the screen that answers "who has admin rights?" is answering it wrongly' : ''));
        return;
      }
      if (offered) ok(`${word.toLowerCase()} reads "${c.label}" — one of the three levels the screen offers`);
      else if (/not one of the three levels|ليس أحد المستويات/.test(c.label)) ok(`a "${role}" user reads "${c.label}" — named and marked, not silently shown as Admin`);
      else fail(`a "${role}" user reads "${c.label}" with nothing to say it is off-list`);
    });
  }

  // ---- 2. a page the person cannot open must not be writable
  const denied = await p.evaluate(() => {
    const before = (DB.offers || []).length;
    // pretend this account's role is confirmed and Proposals is not in its allowed pages —
    // exactly the shape js/64 bounces on
    const realKnown = window.__accessKnown, realAllowed = window.myAllowedPages;
    window.__accessKnown = function () { return true; };
    window.myAllowedPages = function () { return ['today', 'leads', 'clients', 'finance']; };
    let threw = null;
    try { newOffer(); } catch (e) { threw = String(e && e.message); }
    const after = (DB.offers || []).length;
    window.__accessKnown = realKnown; window.myAllowedPages = realAllowed;
    const box = document.getElementById('v70box');
    const said = box ? (box.textContent || '') : '';
    if (box) box.remove();
    return { created: after - before, said, threw };
  });
  if (denied.created === 0) ok('a person whose Proposals access is "No access" creates NOTHING when the New-offer action runs — the old code pushed and saved the record first, then bounced them off the page');
  else fail('a denied person still created ' + denied.created + ' proposal(s) — the record is in the database and they can never see it');
  if (/do not have access/i.test(denied.said)) ok('…and they are told why: "' + denied.said.replace(/\s+/g, ' ').trim().slice(0, 70) + '"');
  else fail('no explanation was shown to the denied person (said: ' + JSON.stringify(denied.said.slice(0, 80)) + ')');

  // an allowed person is NOT blocked by the new check
  const allowed = await p.evaluate(() => {
    const before = (DB.offers || []).length;
    const realKnown = window.__accessKnown, realAllowed = window.myAllowedPages;
    window.__accessKnown = function () { return true; };
    window.myAllowedPages = function () { return ['today', 'leads', 'offers', 'finance']; };
    newOffer();
    const after = (DB.offers || []).length;
    window.__accessKnown = realKnown; window.myAllowedPages = realAllowed;
    const box = document.getElementById('v70box'); if (box) box.remove();
    return after - before;
  });
  if (allowed === 1) ok('a person who DOES have Proposals access still creates one, exactly as before — the guard blocks only the denied case');
  else fail('an allowed person created ' + allowed + ' proposals (expected 1) — the guard went too far');

  // an admin (unrestricted, myAllowedPages -> null) is never blocked
  const adm = await p.evaluate(() => {
    const before = (DB.offers || []).length;
    const realKnown = window.__accessKnown, realAllowed = window.myAllowedPages;
    window.__accessKnown = function () { return true; };
    window.myAllowedPages = function () { return null; };
    newOffer();
    const after = (DB.offers || []).length;
    window.__accessKnown = realKnown; window.myAllowedPages = realAllowed;
    const box = document.getElementById('v70box'); if (box) box.remove();
    return after - before;
  });
  if (adm === 1) ok('an admin (unrestricted) is never blocked by it');
  else fail('an admin was blocked: created ' + adm);

  // and while the role is still unknown, nobody is blocked by accident
  const unknown = await p.evaluate(() => {
    const before = (DB.offers || []).length;
    const realKnown = window.__accessKnown, realAllowed = window.myAllowedPages;
    window.__accessKnown = function () { return false; };            // still loading
    window.myAllowedPages = function () { return ['today']; };        // the safe floor
    newOffer();
    const after = (DB.offers || []).length;
    window.__accessKnown = realKnown; window.myAllowedPages = realAllowed;
    const box = document.getElementById('v70box'); if (box) box.remove();
    return after - before;
  });
  if (unknown === 1) ok('…and during the moment before the role is confirmed nobody is blocked by accident (the floor is not an answer)');
  else fail('someone was blocked while their role was still loading: created ' + unknown);

  // ---- 3. the "n" keystroke on Proposals asks before it writes
  await p.evaluate(() => { openLead = null; openOffer = null; current = 'offers'; render(); });
  await p.waitForTimeout(900);
  lastDialog = null;
  const keyed = await p.evaluate(() => (DB.offers || []).length);
  await p.evaluate(() => document.body.focus());
  await p.keyboard.press('n');
  await p.waitForTimeout(600);
  const afterKey = await p.evaluate(() => (DB.offers || []).length);
  if (lastDialog && /blank proposal|عرض جديد فارغ/i.test(lastDialog.message)) ok('pressing "n" on Proposals ASKS first: "' + lastDialog.message + '"');
  else fail('pressing "n" asked nothing (dialog: ' + JSON.stringify(lastDialog) + ')');
  if (afterKey === keyed) ok('…and because the question was dismissed, no blank proposal was written — the old code saved one on the keystroke alone');
  else fail('a proposal was created despite the question being dismissed (' + keyed + ' → ' + afterKey + ')');

  // saying yes still works
  p.removeAllListeners('dialog');
  p.on('dialog', (d) => d.accept());
  await p.evaluate(() => document.body.focus());
  await p.keyboard.press('n');
  await p.waitForTimeout(900);
  const accepted = await p.evaluate(() => (DB.offers || []).length);
  if (accepted === keyed + 1) ok('answering yes creates exactly one, so the shortcut still works');
  else fail('answering yes created ' + (accepted - keyed) + ' (expected 1)');

  // the BUTTON is unchanged — clicking "+ New proposal" is itself the intent, no question
  await p.evaluate(() => { openOffer = null; current = 'offers'; render(); });
  await p.waitForTimeout(900);
  let buttonAsked = false;
  p.removeAllListeners('dialog');
  p.on('dialog', (d) => { buttonAsked = true; d.accept(); });
  const beforeBtn = await p.evaluate(() => (DB.offers || []).length);
  const clicked = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('#view button')].find((x) => /New proposal|عرض جديد/.test(x.textContent || ''));
    if (!btn) return 'no-button';
    btn.click(); return 'clicked';
  });
  await p.waitForTimeout(900);
  const afterBtn = await p.evaluate(() => (DB.offers || []).length);
  if (clicked !== 'clicked') fail('could not find the "+ New proposal" button');
  else if (afterBtn === beforeBtn + 1 && !buttonAsked) ok('the "+ New proposal" button still creates one instantly, with no question — only the stray keystroke asks');
  else fail('the button behaved differently: created ' + (afterBtn - beforeBtn) + ', asked=' + buttonAsked);

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\naccess-truth OK — the screen names the role it found, and a denied page writes nothing');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
