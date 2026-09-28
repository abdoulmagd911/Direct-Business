/* probe-d19-delete-asks.mjs (2026-09-28) — the owner's standing rule D19 on the stand-in (made-up data): every delete /
   remove asks first in the app's own box, naming the item, with Cancel focused and a red "Delete" / "Remove".
     A. static: no native confirm() call is left anywhere in js/ or index.html, and no delete/remove path runs its
        action when the box is missing (the old `pfConfirm(...); else go()` shape) — the two known non-removal
        questions ("add it again anyway?", "mark as a won client?") are the only ones allowed to keep a fallback;
     B. in the app, EN: a lead's Delete (edit form), a proposal's Delete, a proposal line's ✕, an onboarding
        signatory's ✕, and Finance → Rules (switch-off and ×) each open #pfConfirmBox naming the item, Cancel
        (#pfConfirmNo) has the focus, the red button says Delete / Remove (switch-off says "Switch off"), and Cancel
        leaves the item exactly where it was;
     C. AR: the lead delete and the proposal line ✕ ask in Arabic (حذف / إزالة) and name the item.
   Sabotage: put back js/core/core-04's old o_delItem (splice with no question) — B's proposal-line checks go red.
   PORTS 9731, 9732 (PORTS_RESERVED: 9731-9732). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const natives = [];
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* ---------- A. static scan ---------- */
function files(dir) { const out = []; for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) out.push(...files(p)); else if (/\.js$/.test(f.name)) out.push(p); } return out; }
function staticScan() {
  console.log('\nA · static');
  const list = files(path.join(ROOT, 'js')).concat([path.join(ROOT, 'index.html')]);
  const nat = [], fb = [];
  const ALLOWED_FALLBACK = [/Add it again anyway/, /as a won client/];
  for (const f of list) {
    const src = fs.readFileSync(f, 'utf8'); const rel = path.relative(ROOT, f);
    src.split('\n').forEach((ln, i) => {
      if (/(?<![\w$])(window\.)?confirm\(\s*[^)\s]/.test(ln)) nat.push(rel + ':' + (i + 1));
      const m = /(pfConfirm|askInPage)\([^\n]*?\)\s*;?\s*else\s+(_?go|_doDel|_save|_go|yes|onYes)\(\)/.exec(ln);
      if (m && !ALLOWED_FALLBACK.some((r) => r.test(src.split('\n').slice(Math.max(0, i - 1), i + 1).join('\n')))) fb.push(rel + ':' + (i + 1));
      if (/function\(t,cb\)\{\s*cb\(\);\s*\}/.test(ln)) fb.push(rel + ':' + (i + 1) + ' (ask that always says yes)');
    });
  }
  check(!nat.length, 'no native confirm() call left in js/ or index.html', nat.join(', '));
  check(!fb.length, 'no delete/remove runs when the box is missing (no "else go()" fallback)', fb.join(', '));
}

/* ---------- B/C. in the app ---------- */
async function session(lang, PORT) {
  process.env.MOCK_ROLE = 'admin'; process.env.MOCK_KPI_FROM_MONEY = '1';
  process.env.MOCK_PAGE_ACCESS = JSON.stringify({ today: 'full', leads: 'full', clients: 'full', finance: 'full', reports: 'full', offers: 'full' });
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.type() + ': ' + d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.pfConfirm === 'function' && (DB.businesses || []).length > 0 && window.__roleKnown === true, null, { timeout: 150000 });
  await p.waitForTimeout(1500);
  return { p, b, srv, errors };
}
/* a button inside a closed <details> is opened first, then clicked like a person would */
const press = async (p, sel) => { await p.evaluate((q) => { const el = document.querySelector(q); let d = el && el.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } if (el) el.scrollIntoView({ block: 'center' }); }, sel); await p.waitForTimeout(150); await p.click(sel, { timeout: 8000 }); };
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const readBox = (p) => p.evaluate(() => { const d = document.getElementById('pfConfirmBox'); if (!d) return null; const y = document.getElementById('pfConfirmYes');
  return { txt: d.innerText, focus: document.activeElement && document.activeElement.id, yes: y.textContent.trim(), red: /B42318|rgb\(180, 35, 24\)/i.test(y.getAttribute('style') || '') }; });
async function asks(p, label, name, yesWords, stillThere) {
  await p.waitForTimeout(300);
  const box = await readBox(p);
  check(!!box, label + ': the app\'s own box opens', 'no #pfConfirmBox');
  if (!box) return;
  check(box.txt.includes(name), label + ': the question names "' + name + '"', box.txt.replace(/\n/g, ' ').slice(0, 160));
  check(box.focus === 'pfConfirmNo', label + ': Cancel has the focus', box.focus);
  check(yesWords.includes(box.yes) && box.red, label + ': the button says ' + yesWords.join('/') + ', in red', box.yes + ' red=' + box.red);
  await p.click('#pfConfirmNo'); await p.waitForTimeout(300);
  const gone = await p.evaluate(() => !document.getElementById('pfConfirmBox'));
  const kept = await p.evaluate(stillThere);
  check(gone && kept, label + ': Cancel closes the box and the item is still there', 'closed=' + gone + ' kept=' + kept);
}

/* seed: a made-up lead with a signatory, and a made-up proposal with one line */
const seed = (p) => p.evaluate(() => {
  const b = DB.businesses.find((x) => !x.isClient) || DB.businesses[0];
  b.name = 'Falcon Test Trading'; b.signatories = [{ name: 'Sara Example', idNumber: '1000000001', title: 'CFO' }];
  newOffer(); const o = curOffer() || DB.offers[DB.offers.length - 1];
  o.ref = 'PR-104'; o.subject = 'Riyadh trip'; o.client = b.name;
  o.options = [{ label: 'Option 1', items: [{ type: 'Hotel', detail: 'Two nights downtown', price: '900' }], freebies: [] }];
  return { bid: b.id, oid: o.id };
});

(async () => {
  staticScan();

  console.log('\nB · EN · admin');
  let s = await session('en', 9731); let p = s.p;
  let ids = await seed(p);
  // 1. lead delete — the Delete button of the lead's edit form
  await p.evaluate((id) => { openOffer = null; current = 'leads'; editBusiness(id); }, ids.bid); await p.waitForSelector('#mDel', { timeout: 10000 });
  await p.click('#mDel');
  await asks(p, 'lead delete', 'Falcon Test Trading', ['Delete'], new Function('return DB.businesses.some(function(x){return x.name===\'Falcon Test Trading\';})'));
  // 2. proposal delete — the Delete button under the proposal
  await p.evaluate((id) => { closeModal && closeModal(); current = 'offers'; openOffer = id; render(); }, ids.oid); await p.waitForTimeout(600);
  await press(p, 'button[onclick^="o_del("]');
  await asks(p, 'proposal delete', 'PR-104 · Riyadh trip', ['Delete'], new Function('return (DB.offers||[]).some(function(o){return o.ref===\'PR-104\';})'));
  // 3. a proposal line's ✕
  await p.evaluate((id) => { current = 'offers'; openOffer = id; render(); }, ids.oid); await p.waitForTimeout(600);
  await press(p, 'span[onclick^="o_delItem("]');
  await asks(p, 'proposal line ✕', 'Hotel · Two nights downtown', ['Remove'], new Function('var o=(DB.offers||[]).find(function(o){return o.ref===\'PR-104\';}); return !!o&&o.options[0].items.length===1;'));
  // 4. an onboarding signatory's ✕
  await p.evaluate((id) => { openOffer = null; current = 'leads'; render(); v22OpenClientOnboarding(id); }, ids.bid); await p.waitForTimeout(600);
  await press(p, '[onclick^="v22RmRow("]');
  await asks(p, 'onboarding signatory ✕', 'Sara Example', ['Remove'], new Function('return DB.businesses.some(function(b){return (b.signatories||[]).some(function(s){return s.name===\'Sara Example\';});})'));
  await p.evaluate(() => { try { closeModal(); } catch (_) { } });
  // 5. Finance → Rules: the × on a rule, and switching a rule off
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForFunction(() => window.FIN && FIN.rows && typeof window.finGo === 'function', null, { timeout: 60000 });
  await p.evaluate(() => { finGo('rules'); }); await p.waitForSelector('[data-v117-rule]', { timeout: 30000 }); await p.waitForTimeout(600);
  const rule = await p.evaluate(() => { const r = (MR.rules || []).find((x) => x.active && !x.removed_at); return r && { id: r.id, value: String(r.value || '').slice(0, 60) }; });
  check(!!rule, 'Finance → Rules lists an active rule to test with');
  if (rule) {
    await p.click('button[onclick^="v117RemoveRule(\'' + rule.id + '\'"], [onclick^="v117RemoveRule(\'' + rule.id + '\'"]');
    await asks(p, 'rule ×', rule.value, ['Remove'], new Function('return (MR.rules||[]).some(function(r){return r.id===' + JSON.stringify(rule.id) + '&&!r.removed_at;})'));
    await p.click('[data-v117-switch="' + rule.id + '"]');
    await asks(p, 'rule switch-off', rule.value, ['Switch off'], new Function('var cb=document.querySelector(\'[data-v117-switch="' + rule.id + '"]\'); return (MR.rules||[]).some(function(r){return r.id===' + JSON.stringify(rule.id) + '&&r.active;}) && !!cb && cb.checked;'));
  }
  check(!s.errors.length, 'no JavaScript error (EN)', s.errors.slice(0, 3).join(' | '));
  await done(s);

  console.log('\nC · AR · admin');
  s = await session('ar', 9732); p = s.p;
  ids = await seed(p);
  await p.evaluate((id) => { openOffer = null; current = 'leads'; editBusiness(id); }, ids.bid); await p.waitForSelector('#mDel', { timeout: 10000 });
  await p.click('#mDel');
  let box = await readBox(p);
  check(!!box && /حذف/.test(box.txt) && box.txt.includes('Falcon Test Trading'), 'AR lead delete: Arabic question (حذف) naming the company', box && box.txt.slice(0, 120));
  check(!!box && box.yes === 'حذف' && box.focus === 'pfConfirmNo', 'AR lead delete: the button says حذف, Cancel (إلغاء) has the focus', box && (box.yes + ' / ' + box.focus));
  if (box) await p.click('#pfConfirmNo');
  await p.evaluate((id) => { try { closeModal(); } catch (_) { } current = 'offers'; openOffer = id; render(); }, ids.oid); await p.waitForTimeout(600);
  await press(p, 'span[onclick^="o_delItem("]'); box = await readBox(p);
  check(!!box && /إزالة/.test(box.txt) && box.txt.includes('Two nights downtown') && box.yes === 'إزالة', 'AR proposal line ✕: Arabic question (إزالة) naming the line, button إزالة', box && (box.yes + ' · ' + box.txt.slice(0, 120)));
  if (box) await p.click('#pfConfirmNo');
  check(!s.errors.length, 'no JavaScript error (AR)', s.errors.slice(0, 3).join(' | '));
  await done(s);

  check(!natives.length, 'no native browser dialog opened', natives.join(' | '));
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
