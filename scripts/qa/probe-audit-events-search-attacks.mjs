/* probe-audit-events-search-attacks.mjs — adversarial checks for three areas neither QA
   session had driven before: the audit trail's own integrity (Activity & Audit +
   record_history + undo_change), the Events page / public events hub, and the header
   "Search everything" box.

   Every check is written to FAIL when the behaviour it guards regresses; each one was
   sabotage-tested (the guarded code was broken, the probe watched go red, then restored).

   Runs entirely against the local Supabase stand-in (scripts/qa/mock-supabase.mjs) as the
   QA admin test@directksa.com. Nothing here touches the live project. All people, companies
   and amounts are synthetic (CLAUDE.md rule 7).

   Live facts this probe was written against (read from Postgres 2026-09-03, read-only):
     - record_history is written by trigger record_history_write() on businesses,
       finance_invoices, finance_transactions, client_profiles and contacts — and by
       nothing else. actor := auth.uid(); actor_name := coalesce(full_name,email,'unknown').
     - 242 rows live, 213 with actor IS NULL (so actor_name 'unknown'); 0 undos ever.
     - undo_change() refuses when `h.actor is distinct from me` unless admin/manager —
       so an actor-null row is un-undoable by anyone below manager.

   Run:  NODE_PATH=/tmp/node_modules node scripts/qa/probe-audit-events-search-attacks.mjs
   Exit code 1 when any check fails. "REPORT" lines are observations that are not asserted
   (they concern code outside the lanes this probe guards).                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UID = '11111111-1111-1111-1111-111111111111';
const ME = 'QA Test Account';

/* the five tables the LIVE trigger covers — anything written outside this set is a
   change that leaves no trace in Activity & Audit */
const TRIGGER_TABLES = ['businesses', 'finance_invoices', 'finance_transactions', 'client_profiles', 'contacts'];

const RESULTS = []; const REPORTS = [];
function check(name, ok, detail) { RESULTS.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS' : 'FAIL') + ' · ' + name + (ok || detail == null ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)))); }
function report(line) { REPORTS.push(line); console.log('REPORT · ' + line); }

const dayISO = (off) => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

function baseUsers(extra) {
  return [
    { id: UID, email: 'test@directksa.com', full_name: ME, role: 'admin', active: true, created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: null },
    { id: 'u-salem', email: 'salem.tester@example.com', full_name: 'Salem Tester', role: 'team_member', active: true, created_at: '2026-08-09T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: null },
  ].map(u => (u.id === UID && extra) ? Object.assign(u, extra) : u);
}

function biz(o) {
  return Object.assign({
    id: o.id, legacy_id: o.id, name: o.name, name_ar: o.name_ar || null, source: 'Import',
    stage: o.stage || 'contacted', status: 'active', category: 'Corporate', segment: o.segment || 'MICE / Events',
    assigned_to: null, account_manager: null, tier: null, entity_type: null, legal_name: null, cr_vat: null,
    payment_terms: null, credit_limit: null, contract_start: null, contract_end: null, contract_scope: null,
    contract_sla: null, next_review: null, total_sar: 0, website: null, corp_email_flag: null,
    is_client: !!o.is_client, converted_date: null, direct_client_id: null,
    channels: [], prefs: {}, airline_deals: [], pricing: [], notes: '',
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', raw: o.raw || {},
    verification_source: 'manual', needs_manual_confirmation: false, confirmation_reason: null,
    confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null, funnel_details: {},
    stage_legacy: null, next_action_date: null, next_action_note: null,
    lost_reason: null, archived_at: null, archived_by: null,
  });
}

/* ---------- browser ---------- */
async function openApp(BASE, opts = {}) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e.message || e).slice(0, 300)));
  const writes = [];                 /* every non-GET REST call the app makes */
  const dialogs = []; const dlg = { mode: 'accept' };
  p.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); if (dlg.mode === 'accept') await d.accept('QA'); else await d.dismiss(); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() !== 'GET' && u.pathname.startsWith('/rest/v1/')) {
      const auth = rq.headers()['authorization'] || '';
      writes.push({
        method: rq.method(),
        table: u.pathname.replace('/rest/v1/', '').replace(/^rpc\//, 'rpc:').split('?')[0],
        body: String(rq.postData() || '').slice(0, 400),
        /* a real user JWT carries sub=<uuid>; the publishable key does not. This is how the
           probe can tell whether auth.uid() would be null inside the history trigger. */
        jwtSub: (() => { try { return JSON.parse(Buffer.from(auth.replace(/^Bearer /, '').split('.')[1] || '', 'base64url').toString()).sub || null; } catch (_) { return null; } })(),
      });
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.route('**logo.clearbit.com/**', r => r.abort());
  await p.goto(BASE + (opts.path || '/today'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { browser, p, errors, writes, dialogs, dlg };
}
async function signIn(p) {
  await p.waitForSelector('#cl_email', { timeout: 20000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
}
async function waitReady(p) {
  await p.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && !!window.__userName, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(900);
}
const go = async (p, view, ms = 1200) => { await p.evaluate(v => { try { openLead = null; } catch (_) {} current = v; render(); }, view); await p.waitForTimeout(ms); };

/* ==================================================================================
   PHASE A — the audit trail's own integrity
   ================================================================================== */
const XSS_NAME = '<img src=x onerror="window.__xss=1">';
const XSS_TABLE = '<script>window.__xss2=1</script>';

function historySeed() {
  const rows = [];
  /* 610 filler rows > js/63's HIST_CAP of 500, so the cap is actually reached */
  for (let i = 1; i <= 610; i++) {
    rows.push({
      id: i, at: hoursAgo(i * 0.4 + 3), actor: UID, actor_name: ME, table_name: 'businesses',
      record_id: 'qa_filler', action: 'edit',
      before_row: { id: 'qa_filler', name: 'Filler ' + i, stage: 'new' },
      after_row: { id: 'qa_filler', name: 'Filler ' + i, stage: 'contacted' },
      undone_at: null, undone_by: null,
    });
  }
  /* the live shape: actor IS NULL, so actor_name fell back to 'unknown' */
  rows.push({ id: 900, at: hoursAgo(2), actor: null, actor_name: 'unknown', table_name: 'businesses', record_id: 'qa_a', action: 'edit', before_row: { id: 'qa_a', name: 'Audit Target Co', stage: 'new' }, after_row: { id: 'qa_a', name: 'Audit Target Co', stage: 'won' }, undone_at: null, undone_by: null });
  /* a hostile actor name and table name — the feed must not execute either */
  rows.push({ id: 901, at: hoursAgo(1), actor: 'u-salem', actor_name: XSS_NAME, table_name: XSS_TABLE, record_id: 'qa_a', action: 'edit', before_row: { id: 'qa_a', 'evil<b>key': 1 }, after_row: { id: 'qa_a', 'evil<b>key': 2 }, undone_at: null, undone_by: null });
  /* money: full before/after rows, the shape a Finance-blind reader must not be handed */
  rows.push({ id: 902, at: hoursAgo(3), actor: 'u-salem', actor_name: 'Salem Tester', table_name: 'finance_invoices', record_id: 'i1', action: 'edit', before_row: { id: 'i1', invoice_no: '116361001', total_incl_vat_sar: 12345.67, profit_sar: 999.99, customer_raw_name: 'Test Company 1' }, after_row: { id: 'i1', invoice_no: '116361001', total_incl_vat_sar: 54321.99, profit_sar: 111.11, customer_raw_name: 'Test Company 1' }, undone_at: null, undone_by: null });
  return rows;
}

async function phaseA() {
  const PORT = 9011, BASE = 'http://localhost:' + PORT;
  process.env.MOCK_UNDO_ACTOR_GATE = '1';
  process.env.MOCK_ROLE = 'team_member';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'editor', leads: 'editor', clients: 'editor', events: 'editor', activity: 'viewer' });
  start(PORT, { businesses: [biz({ id: 'qa_a', name: 'Audit Target Co', name_ar: 'شركة التدقيق' })], record_history: historySeed(), app_users: baseUsers({ role: 'team_member', page_access: { today: 'editor', leads: 'editor', clients: 'editor', events: 'editor', activity: 'viewer' } }) });
  const { browser, p, errors, dialogs } = await openApp(BASE);
  await signIn(p); await waitReady(p);
  await go(p, 'activity', 2500);

  const feed = await p.evaluate(() => {
    const v = document.getElementById('view');
    const rows = [...document.querySelectorAll('.act-row')];
    return {
      text: v ? v.innerText : '',
      rowCount: rows.length,
      loaded: (window.HIST_ROWS_FOR_TEST || null),
      firstRows: rows.slice(0, 3).map(r => r.innerText.replace(/\s+/g, ' ').trim()),
      scripts: v ? v.querySelectorAll('script').length : -1,
      imgs: v ? v.querySelectorAll('img').length : -1,
      xss: !!window.__xss, xss2: !!window.__xss2,
      undoBtns: [...document.querySelectorAll('.act-row button')].length,
      bounced: !!document.getElementById('v64-access-denied'),
      cur: (typeof current !== 'undefined') ? current : null,
    };
  });

  check('A1 · Activity page opens for a non-admin whose matrix allows it (no access bounce)',
    feed.cur === 'activity' && !feed.bounced, { cur: feed.cur, bounced: feed.bounced });

  check('A2 · the feed stops at js/63\'s HIST_CAP of 500 rows, not the 614 seeded',
    feed.rowCount === 500, { shown: feed.rowCount, seeded: 614 });

  /* the cap must be SAID, not just silently applied — a round 500 with no note reads as
     "that is everything". (Added by the Code session 2026-09-03; this is the ratchet.) */
  check('A3 · the page says out loud that the log was capped',
    /there are older ones|the log was capped/i.test(feed.text) && /500/.test(feed.text),
    feed.text.slice(0, 300));

  /* ...but saying it is not paging it. There is no control to read past the cap. */
  const pager = await p.evaluate(() => {
    const v = document.getElementById('view'); if (!v) return null;
    return [...v.querySelectorAll('button,a')].map(b => (b.textContent || '').trim()).filter(Boolean);
  });
  const hasPager = (pager || []).some(t => /older|more|next|previous|page|load/i.test(t));
  report('A4 · Activity & Audit caps at ' + feed.rowCount + ' rows and offers ' + (hasPager ? 'a' : 'NO') + ' control to read older entries. The cap is now stated honestly; paging past it is an owner decision (add a pager, or rename the heading "last 500 changes").');

  check('A5 · a hostile actor name / table name is escaped, never executed',
    !feed.xss && !feed.xss2 && feed.scripts === 0 && feed.imgs === 0,
    { xss: feed.xss, xss2: feed.xss2, scripts: feed.scripts, imgs: feed.imgs });

  /* the actor-null row: the page shows "unknown", and undo_change refuses it for a
     team_member because `h.actor is distinct from me` */
  const unknownShown = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.act-row')];
    const r = rows.find(x => /unknown/.test(x.innerText));
    return r ? { text: r.innerText.replace(/\s+/g, ' ').trim(), hasUndo: !!r.querySelector('button') } : null;
  });
  check('A6 · an actor-null entry is displayed as "unknown" and still offers Undo',
    !!unknownShown && unknownShown.hasUndo, unknownShown);

  const dlgMark = dialogs.length;
  await p.evaluate(() => { window.undoRecordChange(900, function () { }); });
  await p.waitForTimeout(1500);
  const refusal = dialogs.slice(dlgMark).map(d => d.message).join(' | ');
  check('A7 · a team_member cannot undo an actor-null entry — the database refusal reaches the screen',
    /You can undo your own changes/.test(refusal), refusal || '(no dialog)');

  const stillOpen = await p.evaluate(async () => {
    const c = window.fc(); const r = await c.from('record_history').select('*').eq('id', 900);
    return (r.data && r.data[0]) ? r.data[0].undone_at : 'missing';
  });
  check('A8 · the refused undo changed nothing — the entry is not marked undone',
    stillOpen === null, stillOpen);

  /* money leak: the Activity feed pulls before_row/after_row wholesale, so a person with no
     Finance access is handed every invoice figure in the page's own memory. */
  const moneyInMemory = await p.evaluate(() => {
    const c = window.fc();
    return c.from('record_history').select('*').order('at', { ascending: false }).limit(500).then(r => {
      const rows = (r.data || []).filter(x => x.table_name === 'finance_invoices');
      const withMoney = rows.filter(x => x.after_row && ('total_incl_vat_sar' in x.after_row || 'profit_sar' in x.after_row));
      return { finance: rows.length, withMoney: withMoney.length, sample: withMoney[0] ? withMoney[0].after_row : null };
    });
  });
  /* what the feed PAINTS must stay field-names-only — the day someone renders values,
     every invoice figure lands on the screen of a person with no Finance page. */
  const painted = feed.text;
  check('A9 · the feed prints which fields changed, never the money values themselves',
    !/12345\.67|54321\.99|999\.99|111\.11/.test(painted), painted.slice(0, 200));
  if (moneyInMemory.withMoney > 0) report('A9 · but the values ARE fetched: record_history RLS is `SELECT ... USING (true)` for every authenticated user and js/63 selects `*`, so a team_member with no Finance page holds total_incl_vat_sar / profit_sar for every invoice — plus every contact\'s email and phone — in before_row/after_row. Owner decision: narrow the RLS policy, or select only the columns the feed renders.');

  check('A10 · no page errors while driving Activity & Audit', errors.length === 0, errors.slice(0, 3));
  await browser.close();
  delete process.env.MOCK_UNDO_ACTOR_GATE; delete process.env.MOCK_ROLE; delete process.env.MOCK_PAGE_ACCESS;
}

/* ==================================================================================
   PHASE B — the Events page and the shared events hub
   ================================================================================== */
const LONG_NAME = 'Riyadh ' + 'Very Long Event Name '.repeat(14) + 'End';
const EV_XSS = '<img src=x onerror="window.__evxss=1">';

function ev(o) {
  return Object.assign({
    id: o.id, name_en: o.name_en, name_ar: o.name_ar || null,
    vertical: o.vertical || 'Travel', status: o.status || 'confirmed',
    start_date: ('start_date' in o) ? o.start_date : null, end_date: ('end_date' in o) ? o.end_date : null,
    city: o.city || 'Riyadh', venue: o.venue || 'RICEC', organiser: o.organiser || 'Org',
    link: ('link' in o) ? o.link : 'https://example.com',
    opportunity_sales: !!o.opportunity_sales, opportunity_partner: !!o.opportunity_partner,
    priority: o.priority || 3, notes: o.notes || null,
    approach: o.approach || 'undecided', approach_status: o.approach_status || 'not_started',
    exhibitor_list_url: o.exhibitor_list_url || null, created_at: null, updated_at: null,
  });
}
const EVENTS = [
  ev({ id: 'ev_nodate', name_en: 'No Date Summit', start_date: null, end_date: null }),
  ev({ id: 'ev_past', name_en: 'Long Finished Expo', start_date: dayISO(-40), end_date: dayISO(-38) }),
  ev({ id: 'ev_soon', name_en: 'Next Week Forum', start_date: dayISO(7), end_date: dayISO(8), approach: 'stand' }),
  ev({ id: 'ev_now', name_en: 'Happening Now Show', start_date: dayISO(-1), end_date: dayISO(1), approach: 'attend' }),
  ev({ id: 'ev_far', name_en: 'Year 2099 Congress', start_date: '2099-11-01', end_date: '2099-11-03' }),
  ev({ id: 'ev_long', name_en: LONG_NAME, start_date: dayISO(20) }),
  ev({ id: 'ev_ar', name_en: 'معرض الرياض للسفر', name_ar: 'معرض الرياض للسفر', city: 'الرياض', start_date: dayISO(14) }),
  ev({ id: 'ev_blank', name_en: '', name_ar: 'فعالية بلا اسم إنجليزي', start_date: dayISO(30) }),
  ev({ id: 'ev_js', name_en: 'Hostile Link Event', link: 'javascript:window.__evxss=2', exhibitor_list_url: 'javascript:window.__evxss=3', start_date: dayISO(9) }),
  ev({ id: 'ev_xss', name_en: EV_XSS, notes: EV_XSS, city: EV_XSS, start_date: dayISO(11) }),
  ev({ id: 'ev_clash', name_en: 'Jeddah Same Week', city: 'Jeddah', start_date: dayISO(7), end_date: dayISO(8), approach: 'stand' }),
];

async function phaseB() {
  const PORT = 9012, BASE = 'http://localhost:' + PORT;
  start(PORT, {
    businesses: [biz({ id: 'qa_b', name: 'Events Lead Co' })], ksa_events: EVENTS,
    ksa_event_signups: [], app_users: baseUsers(),
    share_links: [{ id: 'sl1', token: 'qa-share-token-1234567890', scope: 'all', active: true, created_by: UID, created_at: '2026-09-01T00:00:00Z', last_used_at: null }],
  });
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p); await waitReady(p);
  await go(p, 'events', 2500);

  const view = await p.evaluate(() => {
    const v = document.getElementById('view');
    const rows = [...document.querySelectorAll('.v64-ev-table tbody tr')];
    const tiles = [...document.querySelectorAll('[data-evstat]')].map(t => ({ k: t.getAttribute('data-evstat'), v: (t.querySelector('div') || {}).textContent }));
    return {
      text: v ? v.innerText : '',
      order: rows.map(r => (r.querySelector('td div') || {}).textContent || '').map(s => s.slice(0, 40)),
      dates: rows.map(r => (r.querySelectorAll('td')[4] || {}).innerText || ''),
      rowCount: rows.length,
      tiles,
      shownLine: (v ? v.innerText : '').match(/(\d+) of (\d+) shown/),
      hrefs: [...(v ? v.querySelectorAll('a') : [])].map(a => a.getAttribute('href')),
      xss: !!window.__evxss,
      scripts: v ? v.querySelectorAll('script').length : -1,
      imgs: v ? v.querySelectorAll('img').length : -1,
      total: (window.DB && DB.ksaEvents ? DB.ksaEvents.length : -1),
      pastBtn: !!document.getElementById('evF_past'),
    };
  });

  /* the calendar opens on what is ahead — the finished expo must not be in the list */
  check('B1 · a finished event is hidden until "Past" is asked for',
    !view.order.some(t => /Long Finished/.test(t)) && view.pastBtn, { order: view.order.slice(0, 12), pastBtn: view.pastBtn });

  /* an undated event must sort LAST, never first, in a date-ordered list */
  const ixNoDate = view.order.findIndex(t => /No Date Summit/.test(t));
  check('B2 · an event with no date sorts last, not first',
    ixNoDate === view.order.length - 1, { ixNoDate, of: view.order.length, order: view.order.map(s => s.slice(0, 22)) });

  /* soonest first among the dated ones */
  const ixNow = view.order.findIndex(t => /Happening Now/.test(t));
  const ixSoon = view.order.findIndex(t => /Next Week Forum/.test(t));
  const ixFar = view.order.findIndex(t => /2099/.test(t));
  check('B3 · dated events run soonest → furthest (now < next week < 2099)',
    ixNow >= 0 && ixSoon > ixNow && ixFar > ixSoon, { ixNow, ixSoon, ixFar });

  check('B4 · the "N of M shown" line matches the rows actually on screen',
    !!view.shownLine && Number(view.shownLine[1]) === view.rowCount, { line: view.shownLine && view.shownLine[0], rows: view.rowCount });

  /* the "Still ahead" tile must equal the number of not-yet-ended events, not the table total */
  const ahead = EVENTS.filter(e => !(e.end_date && e.end_date < dayISO(0))).length;
  const aheadTile = Number((view.tiles.find(t => t.k === 'all') || {}).v);
  check('B5 · the "Still ahead" tile is the real count of unfinished events',
    aheadTile === ahead, { tile: aheadTile, expected: ahead });

  check('B6 · a javascript: link is never rendered as a clickable href',
    !view.hrefs.some(h => /^javascript:/i.test(String(h))) && !view.xss, { hrefs: view.hrefs.filter(h => /javascript/i.test(String(h))), xss: view.xss });

  check('B7 · a hostile event name / note / city is escaped, never executed',
    !view.xss && view.scripts === 0 && view.imgs === 0, { xss: view.xss, scripts: view.scripts, imgs: view.imgs });

  /* an event whose English name is blank must still be identifiable on the row */
  const blankRow = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.v64-ev-table tbody tr')];
    const r = rows.find(x => /بلا اسم إنجليزي/.test(x.innerText));
    if (!r) return { found: false };
    const first = r.querySelectorAll('td')[0];
    return { found: true, firstCellText: (first ? first.innerText : '').trim() };
  });
  check('B8 · an event with only an Arabic name still shows a name (row is not blank)',
    blankRow.found && blankRow.firstCellText.length > 0, blankRow);

  /* very long name must not force the page to scroll sideways */
  const overflow = await p.evaluate(() => ({ body: document.body.scrollWidth, win: window.innerWidth }));
  check('B9 · a 300-character event name does not push the page into horizontal scroll',
    overflow.body <= overflow.win + 2, overflow);

  /* Export ships exactly what is on screen, with the CSV-injection guard applied */
  const csv = await p.evaluate(() => {
    const rows = (window.__v64LastList || []);
    return { n: rows.length, names: rows.map(r => r.name_en) };
  });
  check('B10 · the export list is the filtered on-screen list, not the whole table',
    csv.n === view.rowCount, { exportRows: csv.n, screenRows: view.rowCount });

  check('B11 · no page errors while driving Events', errors.length === 0, errors.slice(0, 3));

  /* ---- the shared (signed-out) events hub ---- */
  const s = await openApp(BASE, { path: '/s/qa-share-token-1234567890/events' });
  await s.p.waitForTimeout(4500);
  const shared = await s.p.evaluate(() => {
    const v = document.getElementById('view');
    /* DB is a top-level `const`, not a property of window — `window.DB` is always undefined
       and a guard written that way silently reads as "no data". */
    return {
      cur: (typeof current !== 'undefined') ? current : null,
      events: (typeof DB !== 'undefined' && DB.ksaEvents) ? DB.ksaEvents.length : -1,
      rows: document.querySelectorAll('.v64-ev-table tbody tr').length,
      text: v ? v.innerText.slice(0, 200) : '',
      banner: !!document.getElementById('v38banner'),
      addBtn: [...document.querySelectorAll('button')].some(b => /Add event|إضافة فعالية/.test(b.textContent || '')),
      logins: /🔑/.test(v ? v.innerText : ''),
    };
  });
  /* NOT asserted: fixing this changes behaviour that probe-share-and-settings-attacks.mjs
     (another session's file) currently asserts at its lines 305-309. Recorded, with the diff,
     for the owner of that lane. */
  report('B12 · /s/<token>/events landed on "' + shared.cur + '" with ' + shared.rows + ' event rows. The shared payload DID arrive (' + shared.events + ' events) and js/10 set current=\'events\' — js/52\'s gate() then moved it back to Today, because a share visitor never has a known role and allowedPages() therefore stays on the employee floor (today/leads/clients/finance). Every shared section outside that floor — events, airlines, reports, offers, sops — is silently redirected, and "Share view-only link" builds exactly those addresses.');
  check('B12 · the shared payload the server sent is not thrown away',
    shared.events > 0, shared);
  check('B13 · the shared events hub offers no Add/Edit control',
    !shared.addBtn, { addBtn: shared.addBtn });
  check('B14 · the shared events hub leaks no event-site logins',
    !shared.logins, { logins: shared.logins });
  await s.browser.close();
  await browser.close();
}

/* ==================================================================================
   PHASE C — the header "Search everything" box
   ================================================================================== */
const SEARCH_LEADS = [
  biz({ id: 'qa_s1', name: 'Zed Holdings', name_ar: 'شركة زد القابضة', segment: 'Corporate travel' }),
  biz({ id: 'qa_s2', name: 'Unrelated Trading', name_ar: 'مؤسسة غير ذات صلة' }),
  biz({ id: 'qa_s3', name: 'Percent % Underscore _ Co', name_ar: 'شركة الرموز' }),
  ...[...Array(30)].map((_, i) => biz({ id: 'qa_many' + i, name: 'Zedmatch Company ' + i })),
];
const S_XSS = '<img src=x onerror="window.__sxss=1">';

async function phaseC() {
  const PORT = 9013, BASE = 'http://localhost:' + PORT;
  start(PORT, {
    businesses: SEARCH_LEADS.concat([biz({ id: 'qa_sx', name: S_XSS })]),
    contacts: [{ id: 'ct1', business_id: 'qa_s2', name: 'Findable Person', role: 'Manager', email: 'findable@example.com', phone: '+966500001111', meta: {}, source: 'import' }],
    app_users: baseUsers(),
  });
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p); await waitReady(p);

  const search = async (q) => p.evaluate(term => {
    const inp = document.getElementById('gsearch'); inp.value = term; runGlobalSearch(term);
    const box = document.getElementById('gres');
    const items = [...box.querySelectorAll('.gres-item')];
    return {
      shown: items.length,
      pool: (window._gres || []).length,
      types: items.map(i => (i.querySelector('.gres-t') || {}).textContent || ''),
      labels: items.map(i => (i.querySelector('.gres-l') || {}).textContent || ''),
      text: box.innerText,
      html: box.innerHTML.slice(0, 400),
      scripts: box.querySelectorAll('script').length,
      imgs: box.querySelectorAll('img').length,
    };
  }, q);

  const byName = await search('Zed Holdings');
  check('C1 · finds a lead by its English name', byName.labels.some(l => /Zed Holdings/.test(l)), byName.labels.slice(0, 5));

  const byAr = await search('زد القابضة');
  check('C2 · finds a lead by its Arabic name', byAr.labels.some(l => /Zed Holdings/.test(l)), { labels: byAr.labels.slice(0, 5), text: byAr.text.slice(0, 120) });

  const byPartial = await search('holding');
  check('C3 · partial, case-insensitive match works', byPartial.labels.some(l => /Zed Holdings/.test(l)), byPartial.labels.slice(0, 5));

  const byContact = await search('findable@example.com');
  check('C4 · finds a lead through its contact\'s email', byContact.labels.length > 0, byContact.labels.slice(0, 5));

  /* the cap: 34 leads match "Zed", the dropdown shows 14 and says nothing about the rest */
  const many = await search('Zed');
  const clickable = many.shown - (/showing \d+ of \d+|يُعرض \d+ من \d+/.test(many.text) ? 1 : 0);
  check('C5 · when more results exist than the dropdown shows, it says how many are left',
    many.pool <= clickable || (new RegExp('showing ' + clickable + ' of ' + many.pool + '|يُعرض ' + clickable + ' من ' + many.pool).test(many.text)),
    { pool: many.pool, clickable, tail: many.text.split('\n').slice(-1).join('') });

  const hostile = await search(S_XSS);
  check('C6 · a hostile search term is escaped in the results markup, never executed',
    !(await p.evaluate(() => !!window.__sxss)) && hostile.scripts === 0 && hostile.imgs === 0,
    { scripts: hostile.scripts, imgs: hostile.imgs, html: hostile.html.slice(0, 160) });

  const wild = await search('%');
  check('C7 · "%" is a literal, not a wildcard — it must not match every record',
    wild.pool < SEARCH_LEADS.length, { pool: wild.pool, of: SEARCH_LEADS.length });
  const wild2 = await search('_');
  check('C8 · "_" is a literal, not a wildcard',
    wild2.pool < SEARCH_LEADS.length, { pool: wild2.pool, of: SEARCH_LEADS.length });

  const quote = await search('"');
  check('C9 · a bare double-quote does not break the results box',
    quote.scripts === 0 && typeof quote.text === 'string', { text: quote.text.slice(0, 80) });

  const longQ = await search('z'.repeat(5000));
  check('C10 · a 5,000-character search term returns an honest empty answer, not a crash',
    /No matches|لا نتائج/.test(longQ.text) && longQ.pool === 0, { pool: longQ.pool, text: longQ.text.slice(0, 90) });

  const none = await search('zzz-nothing-matches-this-zzz');
  check('C11 · "no results" is said out loud, not left as an empty box',
    /No matches/.test(none.text), none.text.slice(0, 90));

  /* the box promises "Search everything" — an invoice number finds nothing */
  const inv = await search('116361001');
  const placeholder = await p.evaluate(() => (document.getElementById('gsearch') || {}).placeholder || '');
  report('C12 · searching an invoice number returns ' + inv.pool + ' results — Finance (invoices, transactions, expenses) is not in the index at all.');
  /* the box may only claim "everything" if it actually searches everything. Either the index
     grows to cover invoices, or the wording names what it really covers. */
  check('C12 · the search box does not claim to search records it never looks at',
    inv.pool > 0 || !/search everything|ابحث في كل شيء/i.test(placeholder),
    { placeholder, invoiceHits: inv.pool });

  /* the Arabic half of the same promise — js/21 swaps the placeholder by id when LANG flips */
  const arPh = await p.evaluate(async () => {
    try { toggleLang(); } catch (_) { }
    await new Promise(r => setTimeout(r, 1200));
    return { lang: (typeof LANG !== 'undefined') ? LANG : null, ph: (document.getElementById('gsearch') || {}).placeholder || '' };
  });
  check('C14 · the Arabic placeholder makes the same honest claim as the English one',
    arPh.lang === 'ar' && !/كل شيء/.test(arPh.ph) && /ابحث/.test(arPh.ph), arPh);
  await p.evaluate(() => { try { toggleLang(); } catch (_) { } });
  await p.waitForTimeout(800);

  check('C13 · no page errors while driving global search', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* ---- a restricted person searching records they cannot open ---- */
async function phaseD() {
  const PORT = 9014, BASE = 'http://localhost:' + PORT;
  process.env.MOCK_ROLE = 'team_member';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'editor', finance: 'viewer' });
  start(PORT, { businesses: SEARCH_LEADS, app_users: baseUsers({ role: 'team_member', page_access: { today: 'editor', finance: 'viewer' } }) });
  const { browser, p, errors } = await openApp(BASE);
  await signIn(p); await waitReady(p);
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
    const inp = document.getElementById('gsearch');
    if (!inp) return { noBox: true };
    inp.value = 'Zed Holdings'; runGlobalSearch('Zed Holdings');
    const items = [...document.getElementById('gres').querySelectorAll('.gres-item')];
    return { noBox: false, shown: items.length, labels: items.map(i => (i.querySelector('.gres-l') || {}).textContent || '') };
  });
  let landed = null;
  if (!res.noBox && res.shown) {
    await p.evaluate(() => gGo(0));
    await p.waitForTimeout(1500);
    landed = await p.evaluate(() => ({
      cur: current,
      /* js/64 paints a banner in #view; js/52 puts up its own "Not part of your access" box —
         either is fine, being moved with no explanation at all is not. */
      told: !!document.getElementById('v64-access-denied') || !!document.getElementById('v70box'),
    }));
  }
  check('D1 · a search result for a page this person cannot open bounces them AND says why',
    !!landed && landed.cur !== 'leads' && landed.told, { res: { shown: res.shown }, landed });
  /* the explanation used to be wiped by the very next render — present at 400 ms, gone by 900 */
  await p.waitForTimeout(2500);
  const stillTold = await p.evaluate(() => !!document.getElementById('v64-access-denied') || !!document.getElementById('v70box'));
  check('D3 · the "no access" explanation is still on screen 2.5s later, not wiped by the next render',
    stillTold, { stillTold });
  report('D1 · the bounce works, but the dropdown still listed "Zed Holdings" (a lead this person cannot open) with its segment — the header search is not filtered by page access. Owner decision: filter the index by myAllowedPages(), or accept that names are visible to everyone signed in (which is what the `businesses` RLS already allows).');
  check('D2 · no page errors for the restricted person', errors.length === 0, errors.slice(0, 3));
  await browser.close();
  delete process.env.MOCK_ROLE; delete process.env.MOCK_PAGE_ACCESS;
}

/* ==================================================================================
   PHASE E — is the log complete? Drive one change of each kind and watch the writes.
   ================================================================================== */
async function phaseE() {
  const PORT = 9015, BASE = 'http://localhost:' + PORT;
  start(PORT, {
    businesses: [biz({ id: 'qa_e1', name: 'Log Test Co' }), biz({ id: 'qa_e2', name: 'Log Client Co', is_client: true })],
    ksa_events: [ev({ id: 'ev_e1', name_en: 'Loggable Event', start_date: dayISO(5) })],
    app_users: baseUsers(), record_history: [],
  });
  const { browser, p, errors, writes } = await openApp(BASE);
  await signIn(p); await waitReady(p);

  const mark = () => writes.length;
  const since = (n) => writes.slice(n).map(w => w.table);
  const tables = (arr) => [...new Set(arr)];
  const covered = (arr) => arr.some(t => TRIGGER_TABLES.includes(t));

  const actions = [];

  /* 1 — edit a lead field */
  let m = mark();
  await p.evaluate(() => { const b = getLead('qa_e1'); b.name = 'Log Test Co RENAMED'; save(); });
  await p.waitForTimeout(2200); actions.push({ what: 'rename a lead', tables: tables(since(m)) });

  /* 2 — change a stage */
  m = mark();
  await p.evaluate(() => setLeadStage('qa_e1', 'Proposal'));
  await p.waitForTimeout(2200); actions.push({ what: 'change a lead stage', tables: tables(since(m)) });

  /* 3 — add a contact to a company */
  m = mark();
  await p.evaluate(() => { const b = getLead('qa_e1'); b.contacts = (b.contacts || []).concat([{ name: 'New Contact', email: 'nc@example.com', phone: '+966500000000' }]); save(); });
  await p.waitForTimeout(2200); actions.push({ what: 'add a contact', tables: tables(since(m)) });

  /* 4 — change a client's account manager */
  m = mark();
  await p.evaluate(() => { const b = getLead('qa_e2'); b.accountManager = 'Salem Tester'; save(); });
  await p.waitForTimeout(2200); actions.push({ what: "change a client's account manager", tables: tables(since(m)) });

  /* 5 — delete (archive) a company */
  m = mark();
  await p.evaluate(() => { DB.businesses = DB.businesses.filter(b => b.id !== 'qa_e2'); save(); });
  await p.waitForTimeout(2600); actions.push({ what: 'delete a company', tables: tables(since(m)) });

  /* 6 — change an event */
  m = mark();
  await p.evaluate(async () => { const c = window.fc(); await c.from('ksa_events').update({ city: 'Jeddah' }).eq('id', 'ev_e1').select('id'); });
  await p.waitForTimeout(1600); actions.push({ what: 'change an event', tables: tables(since(m)) });

  actions.forEach(a => report('E · ' + a.what + ' → wrote to [' + a.tables.join(', ') + '] · in Activity & Audit=' + (covered(a.tables) ? 'yes' : 'NO')));

  /* ksa_events has its own trigger (log_ksa_events_audit → ksa_events_audit), but it records
     event_id / operation / old_data / new_data and NO actor — and Activity & Audit never reads
     that table. So an event change is stored, unattributed, and invisible to the log the app
     shows. Everything held in the app_state blob (requests, bookings, offers, projects,
     airlines, providers, SOPs, service levels, targets, exclusions) and every write to
     finance_expenses / proof_documents / finance_targets / finance_client_links / app_settings
     / app_users has no history trigger at all — verified against pg_trigger 2026-09-03. */
  const silent = actions.filter(a => !covered(a.tables)).map(a => a.what);
  const logged = actions.filter(a => covered(a.tables)).map(a => a.what);

  check('E1 · renaming a lead reaches a table the history trigger covers',
    covered((actions.find(a => a.what === 'rename a lead') || {}).tables || []), actions[0]);
  check('E2 · a stage change reaches a table the history trigger covers',
    covered((actions.find(a => a.what === 'change a lead stage') || {}).tables || []), actions[1]);
  check('E3 · adding a contact reaches a table the history trigger covers',
    covered((actions.find(a => a.what === 'add a contact') || {}).tables || []), actions[2]);
  check('E4 · changing an account manager reaches a table the history trigger covers',
    covered((actions.find(a => a.what === "change a client's account manager") || {}).tables || []), actions[3]);
  check('E5 · deleting a company reaches a table the history trigger covers',
    covered((actions.find(a => a.what === 'delete a company') || {}).tables || []), actions[4]);

  /* every write the app makes must carry the signed-in person's JWT, or auth.uid() is null
     inside record_history_write() and the entry is stamped "unknown" forever */
  const bizWrites = writes.filter(w => TRIGGER_TABLES.includes(w.table));
  const anon = bizWrites.filter(w => w.jwtSub !== UID);
  check('E6 · every write to a history-logged table carries the signed-in user\'s JWT (auth.uid() is not null)',
    bizWrites.length > 0 && anon.length === 0,
    { writes: bizWrites.length, withoutUserJwt: anon.length, sample: anon[0] || null });

  report('E · silently unlogged: ' + (silent.length ? silent.join('; ') : '(none in this drive)'));
  report('E · logged: ' + (logged.length ? logged.join('; ') : '(none)'));
  check('E7 · no page errors while driving the write paths', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

/* ================================ run ================================ */
(async () => {
  try { await phaseA(); } catch (e) { check('phase A crashed', false, String(e && e.message || e)); }
  try { await phaseB(); } catch (e) { check('phase B crashed', false, String(e && e.message || e)); }
  try { await phaseC(); } catch (e) { check('phase C crashed', false, String(e && e.message || e)); }
  try { await phaseD(); } catch (e) { check('phase D crashed', false, String(e && e.message || e)); }
  try { await phaseE(); } catch (e) { check('phase E crashed', false, String(e && e.message || e)); }
  const fails = RESULTS.filter(r => !r.ok);
  console.log('\n' + RESULTS.length + ' checks · ' + (RESULTS.length - fails.length) + ' pass · ' + fails.length + ' fail · ' + REPORTS.length + ' report-only notes');
  if (fails.length) { console.log('\nFAILED:'); fails.forEach(f => console.log('  · ' + f.name)); }
  process.exit(fails.length ? 1 : 0);
})();
