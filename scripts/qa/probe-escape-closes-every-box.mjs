/* probe-escape-closes-every-box.mjs — guards the 2026-09-18 fixes of fires #91 and #92, in js/57,
   js/31, js/77, js/09, js/15, js/49 and js/58, plus check-structure's new overlay rule.
   js/10 had said in a comment since 2026-09-10 that "the missing-Escape gripe is app-wide", and nobody
   had driven it. js/35 added a global handler on 2026-08-08, but it only ever looks at `#modal` and
   calls closeModal() — so every overlay built outside that one element was on its own.
   Driven with the real Escape key against every box a person can open, in both languages: the nine
   built on #modal obeyed it, and so did the events form, which had wired its own. Two did not —
   `#pfConfirmBox`, the box behind every "are you sure" in the app, and `#v48ov`, the Team & Access
   overlay (its sibling `#v53ov` in the same file had the same gap and was fixed with it). Both closed
   on a click outside, so nobody was trapped; Escape is simply the reflex.
   THE CHECK THAT MATTERS MOST is not that Escape closes the confirm box — it is that Escape CANCELS
   it. pfConfirm gates every destructive action in the app, so an Escape that confirmed instead of
   cancelling would be far worse than one that did nothing. This probe presses Escape on a live confirm
   box and asserts the yes-callback never ran.
   FIRE #92 turned this from hand-picking into a rule. Rather than guess at more boxes, a check was
   added to check-structure: any js/ file that builds a fixed full-screen element must mention Escape.
   It immediately named FIVE more — js/77's share panel, js/09's funnel-details editor, js/15's admin
   page-access overlay, js/49's permission message box and js/58's fallback confirm. Four were real
   dialogs and were fixed. The fifth, js/50's sign-out banner, must NOT be dismissible: it has no
   button at all and a real sign-out follows it a moment later, so letting Escape hide it would leave
   somebody at a login screen with no idea why. It satisfies the rule by saying that in a comment, and
   this probe asserts both halves of that — the rule still exists, and the exception is still explained.
   Sabotage-tested: with all seven edits and the structure rule stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-escape-closes-every-box.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
/* the repo root, resolved the way check-decisions-wired and check-probe-integrity do it, so the two
   source reads below work from any working directory */
const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9069; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1050 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const natives = []; p.on('dialog', async (d) => { natives.push(d.message()); await d.dismiss(); });
const wrote = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof window.editBusiness === 'function' && typeof window.pfConfirm === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
await p.waitForTimeout(3500);
const lead = await p.evaluate(() => ((DB.businesses || []).find((x) => !x.isClient) || {}).id);

const up = () => p.evaluate(() => Array.from(document.querySelectorAll('body > *, #ov')).filter((e) => {
  try { const s = getComputedStyle(e); if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); return r.width > 300 && r.height > 200; } catch (_) { return false; } }).length);
const clear = async () => { await p.evaluate(() => { try { closeModal(); } catch (_) { } try { document.querySelectorAll('[data-ev-form],#pfConfirmBox,#v48ov,#v53ov,#teamModal,#finModal,#shareBox').forEach((x) => x.remove()); } catch (_) { } }); await p.waitForTimeout(400); };

/* every box, opened the way a person opens it */
const BOXES = [
  ['lead edit form', 'leads', 'editBusiness', 'lead'],
  ['log activity', 'leads', 'logActivity', 'lead'],
  ['new supplier', 'vendors', 'editSupplier', ''],
  ['new SOP', 'sopsla', 'editSop', ''],
  ['events add form', 'events', 'evOpenModal', null],
  /* 2026-09-18 (fire #92): five MORE overlays, found not by guessing but by the new overlay-Escape
     rule in check-structure, which reads every js/ file for a full-screen element whose file never
     mentions the key. Four were real dialogs and were fixed; the fifth is js/50's sign-out banner,
     which must NOT be dismissible and now says so in a comment — see the source check below. */
  ['funnel details editor', 'leads', '__editFunnelDetails', 'lead'],
  ['share links panel', 'settings', 'shareLinksPanel', null],
];
const results = [];
for (const [name, page, fn, key] of BOXES) {
  await clear();
  await p.evaluate((pg) => { try { current = pg; openLead = null; render(); } catch (_) { } }, page);
  await p.waitForTimeout(800);
  const before = await up();
  await p.evaluate(({ fn, arg, hasArg }) => { try { const f = window[fn]; if (typeof f === 'function') hasArg ? f(arg) : f(); } catch (_) { } },
    { fn, arg: key ? lead : '', hasArg: key !== null });
  await p.waitForTimeout(1600);
  const opened = await up();
  if (opened <= before) { results.push({ name, opened: false }); continue; }
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  results.push({ name, opened: true, closedByEsc: (await up()) < opened });
}
/* js/49's permission message box: Escape must close it, and it legitimately refuses a stray backdrop
   click because its whole job is to be acknowledged — it offers OK and nothing else. */
await clear();
await p.evaluate(() => { try { current = 'leads'; render(); } catch (_) { } }); await p.waitForTimeout(600);
const boxUp = await p.evaluate(() => { try { if (typeof window.__v70box === 'function') window.__v70box('QA escape test', 'Nothing has changed.', ''); } catch (_) { } return !!document.getElementById('v70box'); });
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
const boxGone = await p.evaluate(() => !document.getElementById('v70box'));
/* the confirm box, and the half that matters: Escape must CANCEL, never confirm */
await clear();
await p.evaluate(() => { try { current = 'leads'; render(); } catch (_) { } }); await p.waitForTimeout(700);
const confirmRun = await p.evaluate(() => { window.__qaYesRan = false;
  try { pfConfirm('QA escape test — nothing happens either way.', function () { window.__qaYesRan = true; }); } catch (_) { }
  return !!document.getElementById('pfConfirmBox'); });
await p.keyboard.press('Escape'); await p.waitForTimeout(900);
const confirmAfter = await p.evaluate(() => ({ boxGone: !document.getElementById('pfConfirmBox'), yesRan: window.__qaYesRan === true }));
/* and the listener must not outlive the box: open and Escape twice, then check nothing lingers */
await p.evaluate(() => { try { pfConfirm('again', function () { window.__qaYesRan = true; }); } catch (_) { } });
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
const secondTime = await p.evaluate(() => ({ boxGone: !document.getElementById('pfConfirmBox'), yesRan: window.__qaYesRan === true }));
/* the Team & Access overlay */
await clear();
await p.evaluate(() => { try { current = 'settings'; render(); } catch (_) { } }); await p.waitForTimeout(1200);
const teamOpened = await p.evaluate(() => { try { if (typeof v48Users === 'function') v48Users(); } catch (_) { } return null; });
await p.waitForTimeout(2500);
const teamUp = await p.evaluate(() => !!document.getElementById('v48ov'));
await p.keyboard.press('Escape'); await p.waitForTimeout(900);
const teamGone = await p.evaluate(() => !document.getElementById('v48ov'));
/* 2026-09-20 (fire #129) — js/16's invoice box, the LAST own-overlay in the app with no Escape key
   at all, and the one that carries the Delete invoice button. It slipped through the rule below for
   two days because that rule looked for the WORD "Escape" anywhere in the file and js/16 says
   "Cancel/Escape" in a comment about js/57's pfPrompt twelve hundred lines above its own box. The
   gate now demands a real key comparison; this drives the key itself. */
await clear();
await p.evaluate(() => { try { current = 'finance'; render(); if (typeof finGo === 'function') finGo('ledger'); } catch (_) { } });
await p.waitForTimeout(1500);
await p.waitForFunction(() => (((window.FIN || {}).rows) || []).length > 0, { timeout: 40000 }).catch(() => { });
const invUp = await p.evaluate(() => { const r = (((window.FIN || {}).rows) || [])[0];
  try { if (r && window.finRow) window.finRow(r.id); } catch (_) { } return !!document.getElementById('finModal'); });
await p.keyboard.press('Escape'); await p.waitForTimeout(900);
const invGone = await p.evaluate(() => !document.getElementById('finModal'));
await b.close(); srv.close?.();

/* the static half: the rule that found these, and the one documented exception, must both survive */
const structureSrc = fs.readFileSync(REPO + '/scripts/qa/check-structure.mjs', 'utf8');
const bannerSrc = fs.readFileSync(REPO + '/js/50-v74-live-access-and-arabic-names.js', 'utf8');
const drove = results.filter((r) => r.opened);
const checks = [
  ['the drive really happened — several boxes opened and were closed by key', drove.length >= 4],
  ['every box built on the shared dialog still closes on Escape', drove.every((r) => r.closedByEsc === true)],
  ['the in-page confirm box closes on Escape', confirmRun === true && confirmAfter.boxGone === true],
  ['and Escape CANCELS it — the confirm action never ran', confirmAfter.yesRan === false],
  ['it works a second time, so the key handler did not outlive its box', secondTime.boxGone === true && secondTime.yesRan === false],
  ['the Team & Access overlay opens and closes on Escape', teamUp === true && teamGone === true],
  ['no native browser dialog was involved', natives.length === 0],
  ['pressing keys wrote nothing of its own', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['js/49\'s permission message box closes on Escape', boxUp === true && boxGone === true],
  ['js/16\'s invoice box — the one with Delete invoice on it — opens and closes on Escape', invUp === true && invGone === true],
  ['check-structure still enforces the rule that found these — a new overlay with no Escape fails the gate', /overlay/i.test(structureSrc) && /Escape/.test(structureSrc) && /position:fixed;inset:0/.test(structureSrc)],
  ['and the gate now demands a real key comparison, not just the word somewhere in the file', /key\\s\*===\\s\*\['"\]Escape/.test(structureSrc) && /overlays-without-escape/.test(structureSrc)],
  ['the one box that must not be dismissible is judged in writing, with a reason', (() => { try {
    const l = fs.readFileSync(REPO + '/scripts/qa/overlays-without-escape.txt', 'utf8');
    const row = l.split('\n').find((x) => x.trim() && !x.startsWith('#') && x.includes('js/50'));
    return !!row && (row.split('\t')[1] || '').trim().length > 30; } catch (_) { return false; } })()],
  ['and the one overlay that must NOT be dismissible still says why, so the gate is satisfied honestly', /DELIBERATELY IGNORES Escape/.test(bannerSrc) && !/keydown/.test(bannerSrc.split('signOutWithReason')[1] || '')],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ results, confirmRun, confirmAfter, secondTime, teamUp, teamGone, wrote: [...new Set(wrote)] }, null, 1)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
