/* probe-recovery-attacks.mjs — adversarial checks for every promise this app makes about
   REVERSIBILITY: "delete = archive", "an admin can restore it for 30 days", "undo real",
   "never permanently delete data", "recover, don't rebuild".

   Written to FAIL when the promise is hollow, not when the code changes shape. Each check was
   sabotage-tested against the code it guards (revert the fix -> red, restore -> green).

   Runs entirely against the local Supabase stand-in (scripts/qa/mock-supabase.mjs) as the QA
   admin test@directksa.com. Nothing here touches the live project. All companies, people and
   amounts are synthetic (CLAUDE.md rule 7).

   Run:  NODE_PATH=/tmp/node_modules node scripts/qa/probe-recovery-attacks.mjs
   Exit code 1 when any check fails. "REPORT" lines are observations that are deliberately not
   asserted (they are owner decisions, or they live in another session's files).             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
/* 2026-09-03 — a guard that goes red because of where you stand is worse than no guard: it
   trains people to ignore reds. Every source read below used to be relative to the current
   directory, so this probe passed from the repo root and died from scripts/qa with an ENOENT
   that looks exactly like a real defect (and phase E would have scanned whatever `js` folder
   happened to be underfoot). Resolve from this file's own location instead. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoFile = (p) => join(REPO_ROOT, p);

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UID = '11111111-1111-1111-1111-111111111111';
const ME = 'QA Test Account';
const iso = (msOffset) => new Date(Date.now() + msOffset).toISOString();

/* ---------- synthetic companies (shape of a real `businesses` row) ---------- */
function biz(o) {
  return Object.assign({
    id: o.id, legacy_id: o.id, name: o.name, name_ar: o.name_ar || null, source: 'Import',
    stage: o.stage || 'contacted', status: 'active', category: 'Corporate', segment: 'MICE / Events',
    assigned_to: o.owner || ME, account_manager: o.owner || ME, tier: 'A', entity_type: 'LLC',
    legal_name: (o.name || '') + ' LLC', cr_vat: '3001234567800', payment_terms: 'Net 30',
    credit_limit: 50000, contract_start: null, contract_end: null, contract_scope: null,
    contract_sla: null, next_review: null, total_sar: 0, website: null, corp_email_flag: null,
    is_client: !!o.is_client, converted_date: o.is_client ? '2026-03-01' : null,
    direct_client_id: o.direct_client_id || null, channels: [], prefs: {}, airline_deals: [], pricing: [],
    notes: o.notes || '', created_at: '2026-06-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z',
    raw: o.raw || {}, verification_source: 'manual', needs_manual_confirmation: false,
    confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null,
    funnel_id: null, funnel_details: {}, stage_legacy: null, next_action_date: null,
    next_action_note: null, lost_reason: null, archived_at: null, archived_by: null,
  });
}

/* The company under test is a CLIENT with both flags the app reads (is_client column AND
   raw.isClient), an owner, contacts and a direct client id — everything a real restore would
   have to bring back intact. */
const TARGET = 'qa_recover_target';
const COMPANIES = [
  biz({ id: TARGET, name: 'Recover Target Co', name_ar: 'شركة الاسترجاع', is_client: true, stage: 'won',
        direct_client_id: '9001', notes: 'Under test',
        raw: { isClient: true, assignedTo: ME, accountManager: ME, contacts: [{ name: 'Sara Contact', email: 's@example.com', phone: '+966500000001' }] } }),
  biz({ id: 'qa_keep_lead', name: 'Keep Lead Co', raw: { assignedTo: ME } }),
  biz({ id: 'qa_keep_client', name: 'Keep Client Co', is_client: true, stage: 'won', raw: { isClient: true, accountManager: ME } }),
  biz({ id: 'qa_two_tab', name: 'Two Tab Co', raw: { assignedTo: ME }, notes: 'original note' }),
];

/* ---------- harness ---------- */
const RESULTS = []; const REPORTS = [];
function check(name, ok, detail) {
  RESULTS.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' · ' + name + (ok || detail == null ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)));
}
function report(line) { REPORTS.push(line); console.log('REPORT · ' + line); }

function baseUsers() {
  return [{ id: UID, email: 'test@directksa.com', full_name: ME, role: 'admin', active: true,
            created_at: '2026-08-08T00:00:00Z', must_change_password: false, allowed_pages: null, page_access: null }];
}

async function openApp(BASE) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e.message || e).slice(0, 300)));
  const dialogs = []; const writes = [];
  p.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); await d.accept('QA'); });
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname === '/rest/v1/rpc/team_nicknames') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (rq.method() !== 'GET' && u.pathname.startsWith('/rest/v1/')) {
      writes.push({ method: rq.method(), path: u.pathname + u.search, body: (rq.postData() || '').slice(0, 4000) });
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.route('**logo.clearbit.com/**', r => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { browser, p, errors, dialogs, writes };
}
async function signIn(p) {
  await p.waitForSelector('#cl_email', { timeout: 20000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
}
async function waitReady(p) {
  await p.waitForFunction(() => typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && !!window.__userName, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(900);
}
const go = async (p, view, ms = 800) => { await p.evaluate(v => { try { openLead = null; } catch (_) {} current = v; render(); }, view); await p.waitForTimeout(ms); };

/* =================================================================================== */
/* PHASE A — promise 1 & 5: "It moves to the Archive … an admin can restore it"          */
/* =================================================================================== */
async function phaseA(TABLES) {
  const PORT = 8941, BASE = 'http://localhost:' + PORT;
  const srv = start(PORT, TABLES);
  const { browser, p, errors, dialogs, writes } = await openApp(BASE);
  await signIn(p); await waitReady(p);

  const before = await p.evaluate((id) => {
    const b = (DB.businesses || []).find(x => x.id === id);
    return { present: !!b, isClient: b && b.isClient, rawIsClient: b && b.raw && b.raw.isClient,
             total: (DB.businesses || []).length,
             clients: (DB.businesses || []).filter(x => x.isClient).length };
  }, TARGET);
  check('A0 target company is loaded, flagged a client on both flags the app reads', before.present && before.isClient === true, before);

  /* --- delete it exactly the way a person does: open the editor, press Delete --- */
  await go(p, 'leads');
  await p.evaluate((id) => editBusiness(id), TARGET);
  await p.waitForTimeout(400);
  const dlgBefore = dialogs.length;
  await p.click('#mDel');
  await p.waitForTimeout(600);
  const confirmMsg = (dialogs[dlgBefore] || {}).message || '';
  check('A1 the delete confirmation does not promise a 30-day restore window (nothing enforces one)',
    !!confirmMsg && !/30\s*(days|يوم)/i.test(confirmMsg), confirmMsg);
  check('A2 the delete confirmation names the real way back (Activity & Audit, 24 hours)',
    /Activity\s*&\s*Audit/i.test(confirmMsg) && /24\s*hours/i.test(confirmMsg), confirmMsg);

  await p.waitForTimeout(2600);   // let the 900ms-debounced cloud push run

  /* --- did it actually leave every list? --- */
  const after = await p.evaluate((id) => {
    const inArr = (DB.businesses || []).some(x => x.id === id);
    const html = document.getElementById('view').innerHTML;
    return { inArr, total: (DB.businesses || []).length,
             clients: (DB.businesses || []).filter(x => x.isClient).length,
             namedOnPage: html.indexOf('Recover Target Co') >= 0 };
  }, TARGET);
  check('A3 deleted company leaves the workspace array and the Leads page', !after.inArr && !after.namedOnPage, after);
  check('A4 the client count drops by one (it was a client)', after.clients === before.clients - 1, { was: before.clients, now: after.clients });

  await go(p, 'clients');
  const inClients = await p.evaluate(() => document.getElementById('view').innerHTML.indexOf('Recover Target Co') >= 0);
  check('A5 deleted company is gone from Clients too', !inClients);

  /* --- the write the app actually sent: archive, never a hard delete --- */
  const arch = writes.filter(w => /\/rest\/v1\/businesses/.test(w.path) && /archived_at/.test(w.body || ''));
  const hardDel = writes.filter(w => w.method === 'DELETE' && /\/rest\/v1\/businesses/.test(w.path));
  check('A6 the cloud write is an archive (archived_at set), not a hard DELETE — "never permanently delete data" holds',
    arch.length === 1 && hardDel.length === 0, { archivePatches: arch.length, hardDeletes: hardDel.length });
  const row = TABLES.businesses.find(b => b.id === TARGET);
  check('A7 the row survives in the database with archived_at + archived_by stamped',
    !!row && row.archived_at != null && row.archived_by != null && row.name === 'Recover Target Co',
    row && { archived_at: row.archived_at, archived_by: row.archived_by });

  /* --- THE PROMISE: can an admin restore it? --- */
  await go(p, 'archive', 1000);
  const archPage = await p.evaluate(() => ({
    text: document.getElementById('view').innerText,
    restoreButtons: [...document.querySelectorAll('#view button')].filter(b => /restore|استعادة|↺/i.test(b.textContent)).length,
    namesTargetCompany: document.getElementById('view').innerHTML.indexOf('Recover Target Co') >= 0,
  }));
  report('Archive page after deleting a company: ' + archPage.restoreButtons + ' restore button(s), company listed = ' + archPage.namesTargetCompany
       + '  →  there is NO restore path for companies anywhere in the product.');
  check('A8 the Archive page does not silently pretend nothing was deleted — it says companies are not listed here',
    /not listed here/i.test(archPage.text) && /Activity/i.test(archPage.text), archPage.text.slice(0, 260));
  check('A9 the Archive page no longer claims a 30-day restore window',
    !/30\s*(days|يوم)/i.test(archPage.text), archPage.text.slice(0, 260));

  /* Arabic side of the same two sentences */
  await p.evaluate(() => { if (typeof LANG !== 'undefined' && LANG !== 'ar') toggleLang(); });
  await p.waitForTimeout(900);
  await go(p, 'archive', 900);
  const archAr = await p.evaluate(() => document.getElementById('view').innerText);
  check('A10 Arabic: the same honest note is shown, not English and not a 30-day claim',
    /الشركات المحذوفة/.test(archAr) && !/30\s*(days|يوم)/i.test(archAr), archAr.slice(0, 240));
  await p.evaluate(() => { if (typeof LANG !== 'undefined' && LANG === 'ar') toggleLang(); });
  await p.waitForTimeout(700);

  /* --- reload: does it come back? --- */
  await p.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(p);
  const afterReload = await p.evaluate((id) => ({
    back: (DB.businesses || []).some(x => x.id === id), total: (DB.businesses || []).length,
  }), TARGET);
  check('A11 a reload does NOT bring the archived company back (the loader filters archived rows)',
    !afterReload.back && afterReload.total === before.total - 1, afterReload);

  /* --- the one in-app reversal that does exist --- */
  await go(p, 'activity', 1600);
  const act = await p.evaluate(() => {
    const v = document.getElementById('view');
    const rows = [...v.querySelectorAll('.act-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim());
    return { rows, undoButtons: [...v.querySelectorAll('button')].filter(b => /undo|تراجع/i.test(b.textContent)).length };
  });
  const archRow = act.rows.find(r => /Archived|أُرشف/.test(r));
  check('A12 Activity & Audit shows the archive event with an Undo control (the only in-app way back)',
    !!archRow && act.undoButtons > 0, { archRow, undoButtons: act.undoButtons });

  check('A13 no page errors through the whole delete flow', errors.length === 0, errors.slice(0, 3));
  await browser.close(); srv.close();
}

/* =================================================================================== */
/* PHASE B — promise 3: Undo                                                            */
/* =================================================================================== */
async function phaseB() {
  const PORT = 8942, BASE = 'http://localhost:' + PORT;
  /* Three history entries against ONE company, deliberately out of order:
       h100  edit 2 hours ago   name 'Ordering Co (v1)'  -> 'Ordering Co (v2)'
       h101  edit 5 minutes ago name 'Ordering Co (v2)'  -> 'Ordering Co (v3)' + notes changed
       h102  edit 30 hours ago  (outside the 24h window undo_change enforces)
     Undoing h100 must NOT silently throw away h101's newer edit.                        */
  const ORD = 'qa_order';
  const v1 = { id: ORD, name: 'Ordering Co (v1)', notes: 'note v1', archived_at: null };
  const v2 = { id: ORD, name: 'Ordering Co (v2)', notes: 'note v1', archived_at: null };
  const v3 = { id: ORD, name: 'Ordering Co (v3)', notes: 'note v3 by the second person', archived_at: null };
  const TABLES = {
    businesses: [biz({ id: ORD, name: 'Ordering Co (v3)', notes: 'note v3 by the second person' })],
    contacts: [], activities: [], app_users: baseUsers(), team_directory: [],
    record_history: [
      { id: 100, at: iso(-2 * 3600e3), actor: UID, actor_name: ME, table_name: 'businesses', record_id: ORD, action: 'edit', before_row: v1, after_row: v2, undone_at: null, undone_by: null },
      { id: 101, at: iso(-5 * 60e3), actor: 'u-other', actor_name: 'Second Person', table_name: 'businesses', record_id: ORD, action: 'edit', before_row: v2, after_row: v3, undone_at: null, undone_by: null },
      { id: 102, at: iso(-30 * 3600e3), actor: UID, actor_name: ME, table_name: 'businesses', record_id: ORD, action: 'edit', before_row: v1, after_row: v2, undone_at: null, undone_by: null },
      { id: 103, at: iso(-10 * 60e3), actor: UID, actor_name: ME, table_name: 'businesses', record_id: ORD, action: 'create', before_row: null, after_row: v1, undone_at: null, undone_by: null },
    ],
  };
  const srv = start(PORT, TABLES);
  const { browser, p, errors, dialogs } = await openApp(BASE);
  await signIn(p); await waitReady(p);

  const rpc = (id) => p.evaluate((pid) => fc().rpc('undo_change', { p_id: pid }).then(r => (r && r.error) ? ('ERR ' + r.error.message) : r.data), id);

  check('B1 undo refuses an entry older than the 24-hour window, in the database\'s own words',
    (await rpc(102)) === 'Too old to undo — this only works within 24 hours. Ask an admin to restore it.');
  check('B2 undo refuses a "create" entry (undoing a create is not an undo)',
    /not an undo/.test(await rpc(103)));

  const r100 = await rpc(100);
  const rowAfter = TABLES.businesses.find(b => b.id === ORD);
  check('B3 undo of the OLDER change reports ok', r100 === 'ok', r100);
  check('B4 ORDERING ATTACK — undoing an older change silently reverts a newer person\'s edit '
      + '(undo_change writes the whole before_row with no check that the row still matches)',
    rowAfter.name === 'Ordering Co (v1)' && rowAfter.notes === 'note v1',
    { name: rowAfter.name, notes: rowAfter.notes });
  report('CONFIRMED against the live function body: undo_change() runs '
       + '`update <table> set (<every non-generated column>) = (select … from jsonb_populate_record(null::<table>, before_row)) where id = record_id` '
       + '— a whole-row overwrite with no optimistic-concurrency guard. B undoing a 2-hour-old change '
       + 'wipes A\'s 5-minute-old edit, and the log records it only as "undone", never as "and A\'s edit was lost".');
  const h101 = TABLES.record_history.find(r => r.id === 101);
  check('B5 …and the newer entry is still shown as un-undone, so the log gives no warning',
    h101.undone_at == null, h101.undone_at);

  check('B6 undoing the same entry twice is refused', (await rpc(100)) === 'Already undone.');
  check('B7 an unknown history id is refused, not silently accepted', (await rpc(999999)) === 'That change is not in the log.');
  check('B8 no page errors during the undo flow', errors.length === 0, errors.slice(0, 3));
  void dialogs;
  await browser.close(); srv.close();
}

/* =================================================================================== */
/* PHASE C — promise 4: the backup tables as a real recovery path                        */
/* =================================================================================== */
async function phaseC() {
  const PORT = 8943, BASE = 'http://localhost:' + PORT;
  /* app_state_history mirrors the LIVE shape exactly: the snapshot blob has NO `businesses`
     key, because js/02 pushCloud() builds app_state as "every key of DB except businesses".
     Verified live 2026-09-02: app_state.data has 35 keys and no businesses. */
  const TABLES = {
    businesses: COMPANIES.map(c => Object.assign({}, c)),
    contacts: [], activities: [], app_users: baseUsers(), team_directory: [],
    app_state_history: [
      { hist_id: 91, saved_at: iso(-3 * 864e5), updated_by: 'test@directksa.com', data: { schemaVersion: 24, settings: { lang: 'en' }, offers: [], invoices: [] } },
      { hist_id: 92, saved_at: iso(-1 * 864e5), updated_by: 'test@directksa.com', data: { schemaVersion: 24, settings: { lang: 'en' }, offers: [], invoices: [] } },
    ],
    app_state_bak: [],
  };
  const srv = start(PORT, TABLES);
  const { browser, p, errors, dialogs, writes } = await openApp(BASE);
  await signIn(p); await waitReady(p);

  const snapHasBiz = TABLES.app_state_history.every(h => !Array.isArray(h.data.businesses));
  check('C1 an incremental snapshot genuinely contains NO leads/clients (same as live app_state)', snapHasBiz);

  const beforeCount = await p.evaluate(() => (DB.businesses || []).length);
  const dlgBefore = dialogs.length;
  await p.evaluate(() => restoreFromBackup('inc', 92));
  await p.waitForTimeout(1500);
  const restoreMsg = (dialogs[dlgBefore] || {}).message || '';
  check('C2 the restore confirmation warns that leads and clients are not part of a snapshot',
    /Leads and clients are NOT part of a snapshot/i.test(restoreMsg), restoreMsg.slice(0, 240));

  const afterRestore = await p.evaluate(() => ({
    biz: (DB.businesses || []).length, isArr: Array.isArray(DB.businesses),
    schema: DB.schemaVersion,
  }));
  check('C3 RESTORE DOES NOT WIPE THE CRM — every lead and client survives restoring a snapshot that has none',
    afterRestore.isArr && afterRestore.biz === beforeCount, { was: beforeCount, now: afterRestore.biz });
  check('C4 …while the snapshot\'s own contents did replace the workspace blob', afterRestore.schema === 24, afterRestore);

  /* The real damage was one step later: the next save saw zero businesses and archived every
     cloud row. Force a save and count what actually goes out. */
  const wBefore = writes.length;
  await p.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.__qaTouch = Date.now(); save(); });
  await p.waitForTimeout(2600);
  const massArchive = writes.slice(wBefore).filter(w => /\/rest\/v1\/businesses/.test(w.path) && /archived_at/.test(w.body || ''));
  const stillLive = TABLES.businesses.filter(b => b.archived_at == null).length;
  check('C5 the save AFTER a restore archives nothing — no mass wipe of the whole company table',
    massArchive.length === 0 && stillLive === COMPANIES.length,
    { archivePatches: massArchive.length, stillLive, expected: COMPANIES.length });

  /* Is there any coded path that restores a company from these tables? */
  const src = ['js/core/core-06-v18-v21.js', 'js/02-direct-business-cloud-layer-login-shared-c.js', 'js/63-undo-and-real-audit.js']
    .map(f => fs.readFileSync(repoFile(f), 'utf8')).join('\n');
  const unarchivers = (src.match(/archived_at\s*:\s*null/g) || []).length;
  check('C6 nothing in the backup/cloud/undo layers ever clears archived_at — restoring a company is not coded anywhere',
    unarchivers === 0, unarchivers + ' occurrence(s) of archived_at:null');
  report('The only code in the whole app that un-archives a company is the company-MERGE undo RPC '
       + '(js/62-finance-guardrails.js:363, another session\'s file) — reachable only for merges, never for deletes.');

  check('C7 no page errors during the restore flow', errors.length === 0, errors.slice(0, 3));
  await browser.close(); srv.close();
}

/* =================================================================================== */
/* PHASE D — promise 5: two people, one company                                          */
/* =================================================================================== */
async function phaseD() {
  const PORT = 8992 /* PROBE-INTEGRITY FIX (meta-audit, 2026-09-03): was 8944, the port attack-day.mjs also binds. Two probes on one port cannot run side by side, and mock-supabase's listen() has no error handler, so the clash surfaced as a bare EADDRINUSE stack instead of a test result. */, BASE = 'http://localhost:' + PORT;
  const TABLES = { businesses: COMPANIES.map(c => Object.assign({}, c)), contacts: [], activities: [],
                   app_users: baseUsers(), team_directory: [] };
  const srv = start(PORT, TABLES);
  const A = await openApp(BASE); await signIn(A.p); await waitReady(A.p);
  const B = await openApp(BASE); await signIn(B.p); await waitReady(B.p);

  const loadedInB = await B.p.evaluate(() => (DB.businesses || []).some(x => x.id === 'qa_two_tab'));
  check('D0 both tabs have the same company open', loadedInB);

  /* A deletes it */
  await go(A.p, 'leads');
  await A.p.evaluate(() => editBusiness('qa_two_tab'));
  await A.p.waitForTimeout(400);
  await A.p.click('#mDel');
  await A.p.waitForTimeout(2600);
  const rowNow = TABLES.businesses.find(b => b.id === 'qa_two_tab');
  check('D1 person A\'s delete archived the row', rowNow.archived_at != null);

  /* B, who never saw that, edits and saves the same company */
  const dlgBefore = B.dialogs.length;
  await B.p.evaluate(() => {
    const b = (DB.businesses || []).find(x => x.id === 'qa_two_tab');
    b.notes = 'edited by the second person after it was deleted';
    save();
  });
  await B.p.waitForTimeout(3000);

  const rowAfterB = TABLES.businesses.find(b => b.id === 'qa_two_tab');
  check('D2 B\'s save lands on the ARCHIVED row and does not resurrect it (appToRow never writes archived_at)',
    rowAfterB.archived_at != null && /second person/.test(rowAfterB.notes || ''),
    { archived_at: rowAfterB.archived_at, notes: rowAfterB.notes });

  const pill = await B.p.evaluate(() => { const el = document.getElementById('cl_pill') || document.querySelector('[id*="pill"]'); return el ? el.textContent.trim() : null; });
  const warned = B.dialogs.slice(dlgBefore).map(d => d.message).join(' | ');
  check('D3 B is TOLD their change went onto a record someone else deleted — no silent green "Saved"',
    /deleted by someone else/i.test(warned) && !/^Saved to cloud$/.test(String(pill)),
    { warned: warned.slice(0, 220), pill });
  check('D4 the warning names the real way back (Activity & Audit, 24 hours)',
    /Activity\s*&\s*Audit/i.test(warned) && /24\s*hours/i.test(warned), warned.slice(0, 220));

  check('D5 no page errors in either tab', A.errors.length === 0 && B.errors.length === 0, { a: A.errors.slice(0, 2), b: B.errors.slice(0, 2) });
  await A.browser.close(); await B.browser.close(); srv.close();
}

/* =================================================================================== */
/* PHASE E — promise 2: the "30 days" claim, checked across the whole repo               */
/* =================================================================================== */
function phaseE() {
  const files = fs.readdirSync(repoFile('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)
    .concat(fs.readdirSync(repoFile('js/core')).map(f => 'js/core/' + f));
  const offenders = [];
  files.forEach(f => {
    const txt = fs.readFileSync(repoFile(f), 'utf8');
    txt.split('\n').forEach((line, i) => {
      if (!/30\s*(days|يوم)/i.test(line)) return;
      // AR aging buckets and payment terms legitimately say "30 days" — only a RESTORE /
      // ARCHIVE claim is a promise about reversibility.
      if (!/(restore|archive|أرشف|الأرشيف|استعاد|soft-delet|deleted)/i.test(line)) return;
      offenders.push(f + ':' + (i + 1));
    });
  });
  check('E1 no file anywhere still claims archived data is restorable for 30 days', offenders.length === 0, offenders);

  const all = files.map(f => fs.readFileSync(repoFile(f), 'utf8')).join('\n');
  /* Something has to actually REMOVE an archived row for a retention window to exist: a hard
     delete against businesses, or a purge/TTL identifier. Neither exists. */
  const remover = all.match(/from\(['"]businesses['"]\)[\s\S]{0,80}?\.delete\(|purgeArchived|archiveRetention|ARCHIVE_(TTL|DAYS)|RETENTION_DAYS/gi) || [];
  check('E2 …and nothing anywhere ever removes an archived company (no purge job, no TTL, no hard delete)',
    remover.length === 0, remover.slice(0, 3));
  report('Checked read-only against the live project: no pg_cron extension, no purge/cleanup/retention/restore '
       + 'function in the public schema, no expiry column. Oldest archived_at is 2026-08-22 and the row is still there. '
       + 'True retention of an archived company = forever, by accident. The only enforced window anywhere is the '
       + '24 hours hard-coded inside undo_change().');
}

/* =================================================================================== */
(async () => {
  process.env.MOCK_UNDO_FAITHFUL = '1';
  const TABLES_A = { businesses: COMPANIES.map(c => Object.assign({}, c)), contacts: [], activities: [],
                     app_users: baseUsers(), team_directory: [] };
  try {
    await phaseA(TABLES_A);
    await phaseB();
    await phaseC();
    await phaseD();
    phaseE();
  } catch (e) {
    check('probe ran to completion', false, String(e && e.stack || e).slice(0, 600));
  }
  const failed = RESULTS.filter(r => !r.ok);
  console.log('\n' + '='.repeat(78));
  console.log('checks: ' + RESULTS.length + '   passed: ' + (RESULTS.length - failed.length) + '   failed: ' + failed.length + '   reports: ' + REPORTS.length);
  if (failed.length) { console.log('\nFAILED:'); failed.forEach(f => console.log('  · ' + f.name)); }
  process.exit(failed.length ? 1 : 0);
})();
