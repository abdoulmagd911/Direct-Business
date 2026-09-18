/* probe-today-is-the-users-today.mjs — guards the 2026-09-18 (fire #95) fix in core-01 and the 70
   call sites that now go through it, plus check-structure's new rule.

   The app decided what "today" was in UTC, on a team that works in Riyadh. Every "due today /
   overdue" comparison, every date box that opens pre-filled and every "recorded on" stamp went
   through `new Date().toISOString().slice(0,10)` — the date in UTC. Riyadh is UTC+3, so from
   midnight to 3am local the app was a day behind the people using it, while the Today header, which
   prints toLocaleDateString, showed the real local date. The same page contradicted itself.

   Driven live at 01:13 Riyadh on 19 September 2026: the app called today "2026-09-18" while the
   header read "19 Sept 2026". The worst of it was not the reading but the writing — the expense
   form, the payment-proof form and the B2C booking form all open with the Date box already filled
   in, and at 1am they filled it with yesterday. Somebody recording a real expense after midnight
   would have saved a wrong date without being given anything to notice.

   Nobody had seen it because the sandbox — and every QA round before this one — ran in UTC.

   This probe does not mock the clock, and it does not depend on the hour it is run. It loads the
   app under three real timezones. Two of them are the extremes (UTC+14 and UTC-11): between them at
   least one ALWAYS disagrees with UTC whatever the hour, and the first check asserts that one did —
   so a run where the gap happened to be shut cannot read as a pass.

   It deliberately does NOT settle for asking the new helper what it thinks. Today's other two
   findings were both probes that passed on something absent, so this one reads what a person would
   see: a pre-filled Date box on a real form, and a follow-up dated the person's own today, which
   with today taken from UTC is still tomorrow and never appears on the Your-day card at all. Both
   checks are gated on the thing existing — an absent card and an absent box are failures, not
   passes — and both work whether or not the helper is there, so reverting the call sites alone is
   still caught.

   Sabotage-tested: with the core-01 helper and the call sites reverted, 6 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-today-is-the-users-today.mjs                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9072; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* Asia/Riyadh is the real case. The other two are the extremes of the inhabited range: at any
   instant, UTC+14 has already turned the page or UTC-11 has not yet, so one of them always differs
   from UTC — which is what makes this probe independent of the hour it runs. */
const ZONES = ['Asia/Riyadh', 'Pacific/Kiritimati', 'Pacific/Midway'];

async function run(tz) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 950 }, timezoneId: tz, locale: 'en-GB' });
  await ctx.addInitScript(() => { try { localStorage.setItem('dbLang', 'en'); } catch (_) { } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(tz + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && window.__bizTableLoaded === true && (DB.businesses || []).length > 0, { timeout: 90000 });
  await p.waitForTimeout(2000);

  const out = await p.evaluate(() => {
    const d = new Date(); const p2 = (n) => String(n).padStart(2, '0');
    const localDate = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    const utcDate = d.toISOString().slice(0, 10);
    let appToday = null; try { appToday = window.todayISO ? window.todayISO() : '(no helper)'; } catch (e) { appToday = 'ERR ' + e.message; }
    /* the header a person reads at the top of Today, which always printed the LOCAL date */
    const hero = ((document.querySelector('.hero') || {}).innerText || '').replace(/\s+/g, ' ');
    return { localDate, utcDate, appToday, offsetHours: -d.getTimezoneOffset() / 60, hero: hero.slice(0, 160) };
  });

  /* A lead whose next action falls on the person's OWN today. With today taken from UTC this date
     is still in the future, so the card leaves it out entirely; with today taken from the person's
     calendar it is due now. This is the behavioural half, and it does not depend on the helper
     existing — it reads what the card puts on screen either way. */
  out.yourDay = await p.evaluate((localDate) => {
    try {
      const me = window.meName ? meName() : '';
      const b2 = (DB.businesses || []).find((x) => !x.isClient);
      if (!b2) return { seeded: false };
      /* the card shows the eight earliest-dated follow-ups, and the harness seed is full of older
         ones — a row dated today sorts last and would be cut off, which is not the thing under
         test. Clear the others' dates first so the one being measured is the one on screen. */
      (DB.businesses || []).forEach((x) => { if (x !== b2) x.nextActionDate = ''; });
      b2.assignedTo = me; b2.owner = me; b2.nextAction = 'QA timezone check'; b2.nextActionDate = localDate;
      b2.stage = 'new'; b2.status = 'To contact';
      current = 'today'; openLead = null;
      document.querySelectorAll('.v57-yourday').forEach((x) => x.remove());
      render();
    } catch (e) { return { seeded: false, err: String(e.message) }; }
    return new Promise((res) => setTimeout(() => {
      const card = document.querySelector('.v57-yourday');
      const txt = card ? card.innerText : '';
      res({ seeded: true, hasCard: !!card, listed: /QA timezone check/.test(txt),
        overdue: /QA timezone check[\s\S]{0,80}Overdue/.test(txt.replace(/\n/g, ' ')) });
    }, 2500));
  }, out.localDate);

  /* a real pre-filled date box, on the page a person actually types into */
  await p.evaluate(() => { try { current = 'finance'; FIN.tab = 'expenses'; render(); } catch (_) { } });
  await p.waitForTimeout(3000);
  out.dateBox = await p.evaluate(() => { const el = document.getElementById('xp_date'); return el ? el.value : null; });
  await ctx.close();
  return out;
}

const seen = {};
for (const tz of ZONES) { seen[tz] = await run(tz); console.log(`  ${tz.padEnd(20)} offset ${String(seen[tz].offsetHours).padStart(5)}h · local ${seen[tz].localDate} · UTC ${seen[tz].utcDate} · app says ${seen[tz].appToday} · date box ${JSON.stringify(seen[tz].dateBox)}`); }
await b.close(); srv.close?.();

const rows = ZONES.map((z) => seen[z]);
/* the zone where the two calendars actually disagree right now — the one that proves anything */
const gapZone = ZONES.find((z) => seen[z].localDate !== seen[z].utcDate);
const gap = gapZone ? seen[gapZone] : null;
const structureSrc = fs.readFileSync(REPO + '/scripts/qa/check-structure.mjs', 'utf8');
const checks = [
  /* without this, a run at an hour when every zone agreed with UTC would pass while proving nothing */
  ['at least one timezone really is on a different date from UTC right now, so there is something to catch', !!gapZone],
  ['in that timezone the app says today is the date on the person\'s own calendar', !!gap && gap.appToday === gap.localDate],
  ['and NOT the UTC date — which is the whole defect', !!gap && gap.appToday !== gap.utcDate],
  ['the Your-day card was really built, so what follows is read off a card that exists', !!gap && gap.yourDay && gap.yourDay.seeded === true && gap.yourDay.hasCard === true],
  ['a follow-up dated the person\'s own today is listed as due — with today taken from UTC it is still tomorrow and never appears', !!gap && gap.yourDay && gap.yourDay.listed === true],
  ['and it is not called overdue', !!gap && gap.yourDay && gap.yourDay.overdue === false],
  ['the pre-filled date box on a real form exists and carries that same date, so nothing is saved a day out',
    !!gap && typeof gap.dateBox === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(gap.dateBox) && gap.dateBox === gap.localDate],
  ['every timezone tried agrees: the app\'s today is the browser\'s today', rows.every((r) => r.appToday === r.localDate)],
  ['including Riyadh, where the team actually is', seen['Asia/Riyadh'].appToday === seen['Asia/Riyadh'].localDate],
  ['check-structure still fails a layer that takes today from UTC', structureSrc.includes('todayISO') && structureSrc.includes('toISOString') && structureSrc.includes('today-from-UTC check could not run')],
  ['reading and rendering wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify(seen, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
