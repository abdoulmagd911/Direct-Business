/* probe-one-haystack-for-every-search-box.mjs — all four company search boxes read ONE list of
   fields, and that list includes the ones people actually have.

   Fire #194. M38 says a second surface searching the same records shares the first one's haystack.
   Fire #180 applied it to three boxes — the Clients filter, the Ctrl/K palette, the top-bar box —
   and left out the fourth, which is the one the team uses most: the Leads page filter, whose
   `matchLead` kept its own field list. Driven against the REAL database (108 records, 28 clients),
   the two lists disagreed in both directions, and each gap has a count behind it:

       a word from a company's own notes        100 of 108 records — found on the Leads page,
                                                found NOWHERE else
       the person the record is assigned to      88 of 108 — same
       its CR / VAT number                       20 of 108 — the reverse: found everywhere
                                                EXCEPT the Leads page
       its own website domain                    25 of 108 — in neither list, so a company could
                                                not be found by its domain anywhere in the app

   That last one is the one to feel: a stranger e-mails from a company address and the only thing
   you hold is the domain. Typing it found nothing, on a book where 78 of 108 records carry a
   website. (25, not 78, because for the other 53 the domain word already appears in the name.)

   `recordHay` (core-01) now carries source, assignedTo, notes and website as well, and `matchLead`
   (core-02) calls it instead of building its own string — which also ends that box's copy of the
   run-together bug #180 fixed here, where a contact's name, e-mail and phone were joined with no
   spaces into a word matching none of the three.

   This probe seeds its OWN record with unique tokens — one token per field — rather than leaning on
   whatever the harness happens to hold, so each check names exactly which field it is testing.

   What this holds, for a lead and for a client:
     1. the Leads box finds a record by a word that appears only in its notes;
     2. the Leads box finds a record by its CR/VAT number;
     3. the Clients box finds a client by a word that appears only in its notes;
     4. the Clients box finds a client by the person it is assigned to;
     5. the top-bar box finds a company by its website domain;
     6. the Ctrl/K palette finds the same company by the same domain;
     7. the Leads box still finds a record by its name, its Arabic name and a contact's e-mail —
        widening the list must not drop what already worked;
     8. a word that is in NO field of that record finds nothing;
     9. no JS errors.

   Check 8 is the brake, and it is not decorative: a haystack that returned everything, or a filter
   that stopped filtering, would pass all of 1 to 7. Check 7 is the second brake — it fails if the
   shared list is adopted by dropping fields the Leads box already had.

   Sabotage-tested three ways against COPIES of the app (APP_DIR — the repository untouched), and
   these are the runs, not a guess at them:
     · putting the old `matchLead` field list back — fails check 2 alone, which is the whole of what
       that list was missing;
     · dropping source/assignedTo/notes/website from `recordHay` — fails 1, 3, 4, 5 and 6. It fails
       1 as well as 3-to-6 precisely because the Leads box now reads the shared list: the two are
       one thing, which is the point;
     · a `recordHay` that returns a string containing every probe word — fails 2, 3, 6, 7 and 8,
       i.e. both brakes plus the checks whose counts it inflates.
   Run: node scripts/qa/probe-one-haystack-for-every-search-box.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9227 — one mock. */
const PORT = 9227; const BASE = 'http://localhost:' + PORT;

/* one unmistakable token per field, so a pass names the field it proves */
const T = {
  name: 'Qzyxwv Holding',
  nameAr: 'قزيكسو القابضة',
  notes: 'qznotetoken',
  owner: 'Qzowner',
  site: 'https://www.qzdomaintoken.example/path',
  domain: 'qzdomaintoken',
  cr: 'QZCR44821',
  email: 'qzmailtoken@example.test',
  absent: 'qznowherewordtoken',
};

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(2500);

/* seed one lead and one client, each cloned from a real record of that kind so every other field
   the page needs is present, then overwritten with the tokens. Memory only — writes are blocked. */
const seeded = await p.evaluate((t) => {
  const B = DB.businesses || [];
  const clone = (src, id, isClient) => {
    const c = JSON.parse(JSON.stringify(src));
    c.id = id; c.isClient = isClient;
    c.name = t.name + (isClient ? ' Client' : ' Lead'); c.nameAr = t.nameAr;
    c.notes = 'nothing of note here ' + t.notes + ' and nothing after';
    c.assignedTo = t.owner; c.website = t.site; c.crVat = t.cr;
    c.contacts = [{ name: 'Qz Person', email: t.email, phone: '+966500000000' }];
    if (c.raw) { c.raw = {}; }
    return c;
  };
  const aLead = B.find((x) => !x.isClient) || B[0];
  const aClient = B.find((x) => x.isClient) || B[0];
  if (!aLead || !aClient) return { ok: false };
  B.push(clone(aLead, 'qa_hay_lead', false));
  B.push(clone(aClient, 'qa_hay_client', true));
  return { ok: true, total: B.length };
}, T);
await p.waitForTimeout(600);

/* count real rows (an empty-state row has one or two cells, a record row has more) */
const rows = () => p.evaluate(() => {
  const v = document.querySelector('#view'); if (!v) return -1;
  return [...v.querySelectorAll('table tbody tr')].filter((tr) => tr.querySelectorAll('td').length > 2).length;
});
/* does a named seeded record survive the filter? counted through the app's own pipeline, so
   pagination cannot hide it */
const leadsFind = async (q, id) => {
  await p.evaluate(() => { current = 'leads'; openLead = null; leadFilter.stage = 'all'; render(); });
  await p.waitForTimeout(900);
  await p.fill('#lq', q); await p.waitForTimeout(1200);
  return p.evaluate((wanted) => {
    try { return (DB.businesses || []).filter(matchLead).some((b) => b.id === wanted); } catch (_) { return null; }
  }, id);
};
const clientsFind = async (q, id) => {
  await p.evaluate(() => { current = 'clients'; openLead = null; render(); });
  await p.waitForTimeout(900);
  await p.fill('#clq', q); await p.waitForTimeout(1200);
  return p.evaluate((wanted) => {
    try { return recordHay((DB.businesses || []).find((b) => b.id === wanted) || {}).includes(String(document.getElementById('clq').value || '').toLowerCase().trim()); }
    catch (_) { return null; }
  }, id);
};
const clientsRowsFor = async (q) => { await clientsFind(q, 'qa_hay_client'); return rows(); };
const globalFind = (q, id) => p.evaluate(([qq, wanted]) => {
  try { runGlobalSearch(qq); return (window._gres || []).some((r) => r.label && r.label.indexOf(wanted) >= 0); } catch (_) { return null; }
}, [q, T.name]);
const paletteFind = (q) => p.evaluate(([qq, wanted]) => {
  try { return (CMD_RESULTS(qq) || []).some((r) => r.lbl && r.lbl.indexOf(wanted) >= 0); } catch (e) { return 'ERR ' + e.message; }
}, [q, T.name]);

const r = {};
r.leadNote = await leadsFind(T.notes, 'qa_hay_lead');
r.leadCr = await leadsFind(T.cr, 'qa_hay_lead');
r.leadName = await leadsFind('Qzyxwv', 'qa_hay_lead');
r.leadAr = await leadsFind(T.nameAr, 'qa_hay_lead');
r.leadMail = await leadsFind('qzmailtoken', 'qa_hay_lead');
r.leadAbsent = await leadsFind(T.absent, 'qa_hay_lead');
r.leadAbsentRows = await rows();
r.clientNote = await clientsFind(T.notes, 'qa_hay_client');
r.clientOwner = await clientsFind(T.owner, 'qa_hay_client');
r.clientNoteRows = await clientsRowsFor(T.notes);
r.clientAbsentRows = await clientsRowsFor(T.absent);
r.globalDomain = await globalFind(T.domain, 'qa_hay_lead');
r.globalAbsent = await globalFind(T.absent, 'qa_hay_lead');
r.paletteDomain = await paletteFind(T.domain);
r.paletteAbsent = await paletteFind(T.absent);

await b.close(); srv.close?.();

const checks = [
  ['the Leads box finds a record by a word only in its notes', r.leadNote === true, 'found=' + r.leadNote],
  ['the Leads box finds a record by its CR/VAT number', r.leadCr === true, 'found=' + r.leadCr],
  ['the Clients box finds a client by a word only in its notes',
    r.clientNote === true && r.clientNoteRows === 1, 'matched=' + r.clientNote + ', rows on screen=' + r.clientNoteRows],
  ['the Clients box finds a client by the person it is assigned to', r.clientOwner === true, 'found=' + r.clientOwner],
  ['the top-bar box finds a company by its website domain', r.globalDomain === true, 'found=' + r.globalDomain],
  ['the Ctrl/K palette finds the same company by the same domain', r.paletteDomain === true, 'found=' + r.paletteDomain],
  ['what already worked still works — name, Arabic name, a contact e-mail',
    r.leadName === true && r.leadAr === true && r.leadMail === true,
    JSON.stringify({ name: r.leadName, arabic: r.leadAr, contactEmail: r.leadMail })],
  ['a word in NO field of that record finds nothing, in every box',
    r.leadAbsent === false && r.leadAbsentRows === 0 && r.globalAbsent === false &&
    r.paletteAbsent === false && r.clientAbsentRows === 0,
    JSON.stringify({ leads: r.leadAbsent, leadRows: r.leadAbsentRows, clientRows: r.clientAbsentRows, global: r.globalAbsent, palette: r.paletteAbsent })],
  ['both records were actually seeded', seeded.ok === true, JSON.stringify(seeded)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
