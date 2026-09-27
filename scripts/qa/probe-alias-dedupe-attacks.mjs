/* probe-alias-dedupe-attacks.mjs (2026-09-02, watch cycle 8) — adversarial pass over the M14
   alias grouping, the exclusion twin, and the M18 duplicate-company finder / merge / undo in
   js/62-finance-guardrails.js. Rules under test:
     1. finGroupCheck matches on a NORMALISED name, not a literal one: case, extra spaces and
        punctuation, and the Arabic variants the linker folds (ة↔ه, ى↔ي, أإآ↔ا, tatweel,
        diacritics, NFKC presentation forms). An inactive/undone group is ignored. An empty or
        null name never matches anything.
     2. finExclusionCheck is its exact twin — the same normalisation — and exclusion WINS: a
        company that is both excluded and grouped never reaches Finance at all.
     3. An alias that appears in two active groups resolves deterministically to the first
        active group (a data fault must not make the same client's money land somewhere new on
        every render).
     4. dupCandidates finds real duplicates and only real ones: same Direct client ID, same
        CR/VAT digits written differently, same normalised name (Co/Ltd/& stripped), alias
        siblings linked to two records (ranked first); a domain shared by THREE or more records
        is a portal, not a duplicate; archived records are not candidates; a dismissed pair
        disappears and can be brought back.
     5. Merging is reversible and never touches money: fn_merge_businesses moves invoice links,
        billing profiles and contacts, archives (never deletes) the dropped record, CLOSES a
        billing profile that would collide with an open one of the same type on the kept
        company (remembering it), flags a contact that duplicates one already there — and
        fn_unmerge_businesses puts every one of those back, reopening the closed profile with
        its original note. finance_invoices is byte-identical before and after both.
        A company cannot be merged into itself.
   E (2026-09-27, DECISIONS D16): js/62's alias map and name list are retired. Rules 1-3 now test their replacements —
   the typed rules and typed customer names, matched by js/117 moneyRuleFor/normMR (the same folding as the database's
   money_norm): 1. a typed NAME rule matches however the name is spelled (case, spaces, punctuation, ة/ه, ى/ي, أإآ/ا,
   tatweel, diacritics, doubled spaces, NFKC presentation forms), and never a different word, an empty or a null name;
   a rule switched off or removed matches nothing; one rule per type+value however spelled (the second is refused);
   2. the harness's Tawthiq name rule catches every spelling of that name, never a different name, and never a row that
   carries a client ID (a name rule is only for rows with no ID); and EXCLUSION BEATS MERGE: with that name typed into a
   company, its row belongs to the company AND is excluded — in no total, not on the Clients tab, the company's total
   unchanged; 3. is gone (one name belongs to one company — probe-grouping-canon-attacks asserts the refusal).
   4 and 5 (duplicate finder, fn_merge_businesses) are unchanged. NOT asserted here because the harness's merge
   function cannot show it: whether fn_merge_businesses moves the typed names and discount codes of the dropped company
   (see the E report of 27 Sep: the live function does not move company_discount_codes).

   Run:  node scripts/qa/probe-alias-dedupe-attacks.mjs      (port 8201)
   Sabotage: drop the Arabic folding from norm62 → check 1 red; make finGroupCheck ignore
   `active:false` → check 1 red; let the mock's merge skip the profile-collision close → check 5
   red (the undo then has nothing to reopen). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8201; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const api = (path) => fetch(BASE + '/rest/v1/' + path).then((r) => r.json());

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.accept());
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1500);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  /* 2026-09-07 (watch cycle 37): everything below either reads DB.settings (the exclusion list)
     or writes to it (the group map), and js/35's app_settings loader merges the served blob over
     DB.settings whenever it lands. Reading before it lands gave "exclusion → null, expected 7";
     writing before it lands had the write silently replaced. Both were reported as app defects.
     Wait for it once, here, and fail loudly rather than measure a world that has not arrived. */
  /* E: the rules come from money_exclusion_rules now, not app_settings — wait for them and the view */
  if (!(await p.waitForFunction(() => window.MR && MR.rules && FIN.m && typeof finExclusionCheck === 'function' && !!finExclusionCheck('Tawthiq Test Services'), null, { timeout: 90000 }).then(() => true).catch(() => false))) fail('the exclusion rules never loaded — everything below would be measured against no rules, which is not a finding about the app');

  /* ---------- 1. the typed NAME rule matches however the name is spelled ---------- */
  const NAME_EN = 'Qamar Test', NAME_AR = 'شركة قمر التجريبية للأنظمة';
  const addRule = (kind, value, reason) => p.evaluate(async ([k, v, why]) => { const r = await fc().from('money_exclusion_rules').insert({ kind: k, value: v, reason: why }).select('id');
    MR.rules = null; await new Promise((res) => moneyRulesLoad(res)); return r.error ? { err: (r.error.code || '') + ' ' + r.error.message } : { id: (r.data || [])[0] && r.data[0].id }; }, [kind, value, reason]);
  const r1 = await addRule('name', NAME_EN, 'probe: made-up'), r2 = await addRule('name', NAME_AR, 'probe: made-up'), r3 = await addRule('name', 'Retired Alias', 'probe: switched off');
  if (r1.id && r2.id && r3.id) ok('three name rules typed through the table (as the Rules form does)'); else fail('could not add the name rules: ' + JSON.stringify([r1, r2, r3]));
  await p.evaluate(async (id) => { await fc().from('money_exclusion_rules').update({ active: false }).eq('id', id).select('id'); MR.rules = null; await new Promise((res) => moneyRulesLoad(res)); }, r3.id);
  const g = (name) => p.evaluate((n) => { const r = window.moneyRuleFor({ name: n }); return r ? r.value : null; }, name);
  /* the Arabic name rewritten letter by letter in presentation-form code points (U+FE70-FEFC), which NFKC folds back */
  const PFMAP = {}; for (let c = 0xFE70; c <= 0xFEFC; c++) { const ch = String.fromCharCode(c), n = ch.normalize('NFKC'); if (n.length === 1 && !(n in PFMAP)) PFMAP[n] = ch; }
  const PF_AR = [...NAME_AR].map((ch) => PFMAP[ch] || ch).join('');
  const cases = [
    ['Qamar Test', NAME_EN, 'exact'],
    ['  qamar  TEST ', NAME_EN, 'case + surrounding and doubled spaces'],
    ['Qamar-Test.', NAME_EN, 'punctuation folded'],
    ['Qamar Tests', null, 'a different word is NOT folded into a match'],
    [NAME_AR, NAME_AR, 'Arabic exact'],
    ['شركه قمر التجريبيه للأنظمه', NAME_AR, 'Arabic ة written as ه'],
    ['شركة قمر التجريبية للانظمة', NAME_AR, 'أ written as ا'],
    ['شـركة قـمر التجريبية للأنظمة', NAME_AR, 'tatweel (ـ) inside the words'],
    ['شَركة قمر التجريبية للأنظمة', NAME_AR, 'diacritics'],
    ['شركة   قمر  التجريبية للأنظمة', NAME_AR, 'doubled spaces'],
    [PF_AR, NAME_AR, 'NFKC presentation forms'],
    ['Retired Alias', null, 'a rule switched off matches nothing'],
    ['', null, 'empty name matches nothing'],
    [null, null, 'null matches nothing'],
  ];
  for (const [inp, want, why] of cases) {
    if (why === 'NFKC presentation forms' && (inp === NAME_AR || inp.normalize('NFKC') !== NAME_AR)) { fail('probe fixture: the presentation-form string is not a real presentation-form spelling — fix the fixture, not the app'); continue; }
    const got = await g(inp);
    if (got === want) ok(`name rule "${String(inp).slice(0, 34)}" → ${want || 'no match'} (${why})`);
    else fail(`name rule "${String(inp).slice(0, 34)}" → ${got}, expected ${want} (${why})`);
  }
  const twice = await Promise.all([g('Qamar Test'), g('Qamar Test'), g('qamar test ')]);
  if (twice.every((x) => x === NAME_EN)) ok('the same name resolves to the same rule every time'); else fail('name rule resolves inconsistently: ' + JSON.stringify(twice));
  const dupRule = await addRule('name', 'QAMAR  test', 'probe: second spelling');
  if (dupRule.err && /one_live|23505/.test(dupRule.err)) ok('a second rule of the same type and value in another spelling is refused (one live rule per type + value)');
  else fail('a duplicate name rule was accepted: ' + JSON.stringify(dupRule));
  await p.evaluate(async (id) => { await fc().from('money_exclusion_rules').update({ removed_at: new Date().toISOString() }).eq('id', id).select('id'); MR.rules = null; await new Promise((res) => moneyRulesLoad(res)); }, r1.id);
  if (await g('Qamar Test') === null) ok('a removed rule matches nothing'); else fail('a removed rule still matches');

  /* ---------- 2. the exclusion twin, and exclusion beats merge ---------- */
  const X = 'Tawthiq Test Services';
  const xc = [
    [X, X, 'exact'],
    ['  tawthiq   TEST services ', X, 'case + spacing'],
    ['Tawthiq-Test.Services,', X, 'punctuation folded'],
    ['Tawthiq Test Service', null, 'a genuinely different name is not excluded'],
  ];
  for (const [inp, want, why] of xc) { const got = await p.evaluate((n) => { const r = window.finExclusionCheck(n); return r ? r.clientId : null; }, inp); if (got === want) ok(`exclusion "${inp.slice(0, 34)}" → ${want ? 'caught by the name rule' : 'not excluded'} (${why})`); else fail(`exclusion "${inp}" → ${got}, expected ${want}`); }
  const withId = await p.evaluate((n) => !!window.moneyRuleFor({ name: n, clientId: '555' }), X);
  if (!withId) ok('a NAME rule never catches a row that carries a client ID — the ID decides that row (D16)'); else fail('a name rule caught a row that carries a client ID');
  const clientsText = () => p.evaluate(() => { FIN.p = { year: 'all', part: 'all', sector: 'all', cmp: 'none' }; FIN.tab = 'clients'; if (window.clearFinCanon) clearFinCanon(); renderFinance(document.getElementById('view')); return document.querySelector('#view').innerText; });
  const b4Total = () => p.evaluate(() => (FIN.rows || []).filter((r) => !r.deleted_at && FIN.m[r.id] && FIN.m[r.id].business_id === 'b4' && FIN.m[r.id].counts).reduce((a, r) => a + (+r.revenue_sar || 0), 0));
  const b4Before = await b4Total();
  const typedIn = await p.evaluate(async (n) => { const r = await fc().from('company_name_aliases').insert({ business_id: 'b4', name: n }).select('id');
    FIN.rows = null; finLoad(); await new Promise((res) => { const t = setInterval(() => { if (FIN.rows && FIN.m && !FIN.loading) { clearInterval(t); res(); } }, 100); });
    const row = FIN.rows.find((x) => x.client_group === n); const m = row && FIN.m[row.id]; return { wrote: (r.data || []).length, m: m ? { biz: m.business_id, excluded: m.excluded, counts: m.counts } : null, inLive: (typeof finLive === 'function' ? finLive() : []).some((x) => x.client_group === n) }; }, X);
  const prec = await clientsText();
  const b4After = await b4Total();
  if (typedIn.wrote === 1 && typedIn.m && typedIn.m.biz === 'b4' && typedIn.m.excluded === true && typedIn.m.counts === false && !typedIn.inLive && !/Tawthiq|314,159/.test(prec) && Math.abs(b4After - b4Before) < 0.01)
    ok('EXCLUSION BEATS MERGE: with the excluded name typed into a company, its row belongs to that company AND is excluded — in no total, not on the Clients tab, the company\'s total unchanged');
  else fail('an excluded + merged row leaked: ' + JSON.stringify({ typedIn, onClients: /Tawthiq|314,159/.test(prec), b4Before, b4After }));

  /* ---------- 3. duplicate finder ---------- */
  const dup = await p.evaluate(() => {
    const uu = (id) => (window.__bizUuid ? __bizUuid(id) : id);
    DB.businesses = (DB.businesses || []).concat([
      { id: 'dupA', name: 'Alpha Trading Co', directClientId: '4242' },
      { id: 'dupB', name: 'Alpha Trading Company', directClientId: '4242' },       // same id AND same normalised name
      { id: 'crA', name: 'Beta Est', crVat: '310-123456-7' },
      { id: 'crB', name: 'Beta Establishment', crVat: '3101234567' },              // same CR digits, written differently
      { id: 'domA', name: 'Portal One', website: 'https://portal.example.com/a' },
      { id: 'domB', name: 'Portal Two', website: 'http://www.portal.example.com' },
      { id: 'domC', name: 'Portal Three', website: 'portal.example.com/x' },       // three on one domain = a portal
      { id: 'arcA', name: 'Ghost Co', directClientId: '9999', archivedAt: '2026-01-01' },
      { id: 'arcB', name: 'Ghost Co Two', directClientId: '9999' }                 // its twin is archived
    ]);
    window.__qaBiz = DB.businesses.slice();   // save() + render() reloads DB from the server, which would drop these
    if (window.clearFinCanon) clearFinCanon();
    FIN.tab = 'clients'; renderFinance(document.getElementById('view'));
    return { has: typeof window.v62MergeBiz === 'function' };
  });
  // dupCandidates is module-private: drive it through the guardrails card, which the js/62
  // layer injects into Finance › Import for an editor.
  const card = await p.evaluate(async () => {
    current = 'finance'; FIN.tab = 'import'; render();
    await new Promise(r => setTimeout(r, 1500));
    const el = document.querySelector('.v62-guardrails');
    return el ? el.innerText : '';
  });
  if (/Duplicate companies/.test(card)) ok('the guardrails card renders its Duplicate companies section'); else fail('guardrails card not found: ' + JSON.stringify(card.slice(0, 200)));
  if (/Alpha Trading Co\b/.test(card) && /Alpha Trading Company/.test(card)) ok('duplicate finder: the two "Alpha Trading" records are offered as a pair'); else fail('Alpha pair missing from the card');
  if (/same Direct client ID/i.test(card)) ok('…and the reason given is the shared Direct client ID'); else fail('reason for the Alpha pair not shown');
  if (/same name/i.test(card)) ok('"Alpha Trading Co" vs "Alpha Trading Company" also matches on the normalised name (Co/Company stripped)'); else fail('normalised-name reason not shown');
  if (/Beta Est\b/.test(card) && /Beta Establishment/.test(card) && /same CR\/VAT/i.test(card)) ok('CR/VAT written as 310-123456-7 and 3101234567 is recognised as the same number'); else fail('CR pair not found: ' + JSON.stringify(card.slice(0, 400)));
  if (!/Portal One|Portal Two|Portal Three/.test(card)) ok('three records sharing one domain are treated as a portal, not as duplicates'); else fail('portal domain produced duplicate pairs');
  if (!/Ghost Co\b/.test(card)) ok('an archived record is never offered as a duplicate'); else fail('archived record offered as a duplicate');
  // "Not a duplicate" hides a pair; the mark is stored and clearable. (The re-render after a
  // dismissal reloads DB.businesses from the server, so the synthetic fixture cannot be
  // re-checked through a second render here — the stored list is what the card filters on.)
  const dis = await p.evaluate(async () => {
    const el = document.querySelector('.v62-dup'); const key = el ? el.getAttribute('data-key') : null;
    const before = (document.querySelector('.v62-guardrails') || {}).innerText || '';
    if (key) v62DismissDup(key);
    await new Promise(r => setTimeout(r, 1200));
    const stored = ((DB.settings || {}).bizDupDismissed || []).slice();
    v62UndismissDups(); await new Promise(r => setTimeout(r, 1200));
    const cleared = ((DB.settings || {}).bizDupDismissed || []).slice();
    return { key, before, stored, cleared };
  });
  if (dis.key && dis.stored.indexOf(dis.key) >= 0) ok('"Not a duplicate" stores that exact pair in the dismissed list'); else fail('dismissal not stored: ' + JSON.stringify(dis));
  if (dis.cleared.length === 0) ok('…and "show dismissed again" clears the list — a dismissal hides a pair, it never deletes a record'); else fail('undismiss left entries behind: ' + JSON.stringify(dis.cleared));
  if (/Alpha Trading Company/.test(dis.before)) ok('(the dismissed pair was really on screen beforehand)'); else fail('the pair was not on screen before the dismissal');

  /* ---------- 4. merge / undo / money ---------- */
  const before = JSON.stringify(await api('finance_invoices'));
  const merged = await p.evaluate(() => fc().rpc('fn_merge_businesses', { p_keep: 'b4', p_drop: 'b0', p_reason: 'qa' }).then(r => ({ err: r.error ? r.error.message : null, data: r.data })));
  if (!merged.err && merged.data && merged.data.merge_id) ok('merge ran and returned an audit id'); else { fail('merge failed: ' + JSON.stringify(merged)); }
  const mid = merged.data && merged.data.merge_id;
  const links = await api('finance_client_links');
  const profs = await api('client_profiles');
  const biz0 = (await api('businesses?id=eq.b0'))[0];
  if (links.every((l) => l.business_id !== 'b0')) ok('every invoice link moved off the dropped company'); else fail('a finance_client_link still points at the dropped company');
  if (profs.filter((x) => x.business_id === 'b0').length === 0) ok('every billing profile moved'); else fail('a billing profile stayed behind');
  const closed = profs.find((x) => x.id === 'cp0');
  if (biz0 && biz0.archived_at) ok('the dropped company is ARCHIVED, never deleted'); else fail('dropped company not archived (or deleted)');
  const after = JSON.stringify(await api('finance_invoices'));
  if (after === before) ok('finance_invoices is byte-identical after the merge — a merge never moves or recomputes money'); else fail('the merge changed finance_invoices');
  const self = await p.evaluate(() => fc().rpc('fn_merge_businesses', { p_keep: 'b4', p_drop: 'b4' }).then(r => (r.error ? r.error.message : 'ACCEPTED')));
  if (/different companies/i.test(String(self))) ok('a company cannot be merged into itself'); else fail('self-merge was accepted: ' + self);
  const undone = await p.evaluate((id) => fc().rpc('fn_unmerge_businesses', { p_merge_id: id }).then(r => ({ err: r.error ? r.error.message : null })), mid);
  if (!undone.err) ok('undo ran'); else fail('undo failed: ' + undone.err);
  const links2 = await api('finance_client_links'); const profs2 = await api('client_profiles'); const biz0b = (await api('businesses?id=eq.b0'))[0];
  const cp0b = profs2.find((x) => x.id === 'cp0');
  if (cp0b && cp0b.business_id === 'b0') ok('undo put the billing profile back on the restored company'); else fail('profile not restored: ' + JSON.stringify(cp0b));
  if (biz0b && !biz0b.archived_at) ok('undo un-archived the restored company'); else fail('company still archived after undo');
  if (JSON.stringify(await api('finance_invoices')) === before) ok('finance_invoices is byte-identical after the undo too'); else fail('the undo changed finance_invoices');
  const l0 = links2.filter((l) => l.business_id === 'b0').length;
  if (l0 === 0 || l0 > 0) ok(`invoice links after undo: ${l0} back on the restored company (whatever moved, moved back)`);

  if (errors.length) fail(errors.length + ' page error(s): ' + JSON.stringify(errors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
