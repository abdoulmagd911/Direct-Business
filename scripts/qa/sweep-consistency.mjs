import { start } from './mock-seed.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8890, BASE = `http://127.0.0.1:${PORT}`;
/* E (2026-09-27, D16): Finance now reads the database view money_rows together with the rows (js/16 finLoad), and a
   company's money is only what a person typed into it (a client ID, a code or a customer name). mock-seed.mjs has no such
   view — it answers [] — so every invoice stood alone and no client card found its money. Until that mock models the
   view, this probe answers money_rows itself, the way the view does for this seed: a row with no client ID belongs to
   the company its customer name was typed into — the seed's finance_client_links, read as typed names exactly as
   mock-supabase.mjs does (linksToNames); a row with a client ID goes by client_profiles alone; this seed has no
   exclusion rules, so only a row's own exclusion_reason leaves it out. */
const mrNorm = (t) => { let s = String(t == null ? '' : t); try { s = s.normalize('NFKC'); } catch (_) { } s = s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ''); return s || null; };
async function answerMoneyRows(r) {
  const rq = r.request(); const u = new URL(rq.url());
  if (u.pathname !== '/rest/v1/money_rows' || rq.method() !== 'GET') return false;
  const h = {}; const rh = rq.headers(); ['authorization', 'apikey'].forEach((k) => { if (rh[k]) h[k] = rh[k]; });
  const all = async (t) => { let out = []; for (let o = 0; ; o += 1000) { const x = await fetch(`${BASE}/rest/v1/${t}?select=*&offset=${o}&limit=1000`, { headers: h }); const d = await x.json().catch(() => []); if (!Array.isArray(d)) break; out = out.concat(d); if (d.length < 1000) break; } return out; };
  const [inv, links, prof, biz] = await Promise.all([all('finance_invoices'), all('finance_client_links'), all('client_profiles'), all('businesses')]);
  const nameTo = {}; links.forEach((l) => { const k = mrNorm(l.client_group); if (k && l.business_id && !nameTo[k]) nameTo[k] = l.business_id; });
  const bn = {}; biz.forEach((b) => { bn[b.id] = b.name; });
  const rows = inv.filter((i) => !i.deleted_at).map((i) => {
    const cid = mrNorm(i.payments_client_id); const cp = cid ? prof.find((p) => mrNorm(p.direct_client_id) === cid) : null;
    const bizId = cp ? cp.business_id : (!cid ? (nameTo[mrNorm(i.client_group)] || nameTo[mrNorm(i.customer_raw_name)] || null) : null);
    const excluded = i.exclusion_reason != null;
    return { id: i.id, business_id: bizId, company_key: bizId ? 'biz:' + bizId : cid ? 'cid:' + cid : 'name:' + (mrNorm(i.client_group || i.customer_raw_name) || '?'),
      company_name: bizId ? (bn[bizId] || null) : (i.client_group || i.customer_raw_name), merge_state: bizId ? 'merged' : cid ? 'not_merged' : 'no_client_id',
      profile_type: cp ? cp.profile_type : null, rule_id: null, rule_kind: null, rule_value: null, rule_reason: null, excluded, counts: !excluded && i.integrity_status === 'verified_paid', open_age_days: null };
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const off = +(u.searchParams.get('offset') || 0), lim = u.searchParams.get('limit'); const win = rows.slice(off, lim != null ? off + +lim : undefined);
  await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': off + '-' + Math.max(off + win.length - 1, 0) + '/' + rows.length, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(win) });
  return true;
}
start(PORT);
const src = fs.readFileSync(new URL('./mock-seed.mjs', import.meta.url), 'utf8');   // path relative to this file, not the cwd (2026-09-02: ran only from scripts/qa before)
const fin = eval(src.match(/const SEED_FIN=(\[.*?\]);\n/s)[1]);
const biz = eval(src.match(/const SEED_BIZ=(\[.*?\]);\n/s)[1]);
const exp = {};
fin.forEach(r => { const k = r.client_group; exp[k] = exp[k] || { inv: new Set(), billed: 0 }; exp[k].inv.add(r.invoice_no); exp[k].billed += +r.total_incl_vat_sar || 0; });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
await page.route(u=>u.href.includes('cdn.jsdelivr.net'), async r => {
  const u = r.request().url();
  if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
  return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
});
await page.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async r => {
  if (await answerMoneyRows(r)) return;
  const u = new URL(r.request().url());
  const resp = await fetch(BASE + u.pathname + u.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
const em = page.locator('input[type="email"]').first();
if (await em.isVisible().catch(() => false)) {
  await em.fill('test@directksa.com');
  await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
  await page.locator('button:has-text("Sign in"), button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
}
const out = [];
// Per-client card check
for (const b of biz.filter(x => x.is_client)) {
  await page.evaluate(id => { current = 'leads'; openLead = id; render(); }, b.legacy_id);
  await page.waitForTimeout(1200);
  const got = await page.evaluate(() => {
    const card = document.querySelector('.v29-fin'); if (!card) return null;
    const minis = [...card.querySelectorAll('div')].map(d => d.textContent.trim());
    const t = card.textContent;
    const inv = (t.match(/Invoices\s*(\d+)/) || [])[1];
    const billed = (t.match(/Lifetime billed\s*([\d.]+[KM]?)/) || [])[1];
    return { inv, billed };
  });
  const e = exp[b.name];
  if (!e) { out.push(`${b.name}: no finance rows in seed — card ${got ? 'SHOWN (check!)' : 'absent, correct'}`); continue; }
  // 2026-09-02: the "Lifetime billed" figure is deliberately NOT on the client card any more —
  // owner ruling 2026-08-21 ("money belongs to Finance only", guarded by probe-money-placement).
  // A card that SHOWS it is now the failure, not one that doesn't. Invoice count stays checked.
  const ok = got && String(got.inv) === String(e.inv.size) && got.billed === undefined;
  out.push(`${ok ? 'PASS' : 'FAIL'} ${b.name}: card inv=${got && got.inv} exp=${e.inv.size} · money on card=${got && got.billed !== undefined ? 'YES (violates the 21 Aug ruling)' : 'none, correct'}`);
}
// Finance overview totals
await page.evaluate(() => { openLead = null; current = 'finance'; render(); });
await page.waitForTimeout(1500);
const finTop = await page.evaluate(() => {
  const t = document.getElementById('view').textContent;
  return { inv: (t.match(/Invoices\s*(\d+)/) || [])[1], rev: (t.match(/Revenue\s*([\d.]+[KM]?)/) || [])[1] };
});
const totInv = new Set(fin.map(r => r.invoice_no)).size;
const totRev = fin.reduce((a, r) => a + (+r.revenue_sar || 0), 0);
out.push(`${String(finTop.inv) === String(totInv) ? 'PASS' : 'FAIL'} Finance overview: inv=${finTop.inv} exp=${totInv} · rev=${finTop.rev} exp=${(totRev / 1e3).toFixed(1)}K`);
// Clients page tile
await page.evaluate(() => { current = 'clients'; render(); });
await page.waitForTimeout(1200);
const cl = await page.evaluate(() => {
  const t = document.getElementById('view').textContent;
  return { n: (t.match(/CLIENTS IN VIEW\s*(\d+)/i) || t.match(/Clients in view\s*(\d+)/) || [])[1], rows: document.querySelectorAll('table tbody tr').length };
});
const nClients = biz.filter(x => x.is_client).length;
out.push(`${String(cl.n) === String(nClients) && cl.rows === nClients ? 'PASS' : 'FAIL'} Clients page: tile=${cl.n} rows=${cl.rows} exp=${nClients}`);
console.log(out.join('\n'));
console.log('PAGEERRORS:', errors.length);

/* 2026-09-06 (watch cycle 35): this file counted its failures, printed them, and then exited 0.
   The battery reads exit codes, so every regression this probe could see has been reported to
   the runner as a pass for as long as it has existed. The count decides the exit code now. */
const __fails = out.filter((l) => String(l).startsWith('FAIL')).length;
await browser.close();
if (__fails) { console.log(`\nFAILED — ${__fails} check(s) did not pass.`); process.exit(1); }
process.exit(0);
