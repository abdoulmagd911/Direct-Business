/* probe-export-records.mjs — Export ▾ "full details" on Leads, Operations, Proposals and Projects,
   EN and AR (2026-09-02, attack round 23 — the second pass over the shared exporter). Found:
     - a lead's contacts cell read "true c9 Contact 9 Manager …" — the people bridge's own
       bookkeeping marks (_fromTable / _tid) leaked into the spreadsheet
     - createdAt exported as a 13-digit epoch (1788347355534) on Operations and Projects
     - in Arabic, Operations / Proposals / Projects "full details" carried dozens of bare keys and
       English code-list values (Urgent, Draft, Price offer, Not checked …)
   Asserts EN: contacts cell is the person's details only, time columns are date-times, no
   "[object Object]"; AR: every title Arabic + keyed, code-list values Arabic, names / free text
   untouched. Sabotage: drop the "_"-key skip in core-05 → "true c9" → red. Drop the epoch branch
   → 13-digit cell → red. Drop the ops/proposals labels in js/73 → bare keys → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8381;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.waitForTimeout(7000);   // sign-in + the people bridge's settle (contacts attach to leads)

  async function exportFile(view, lang) {
    await p.evaluate(([v, l]) => { LANG = l; if (typeof applyLang === 'function') applyLang(); openSup = null; openLead = null; current = v; render(); }, [view, lang]); await p.waitForTimeout(600);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.top button')].find((x) => /Export|تصدير/.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(300);
    const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.offsetParent !== null && /CSV.*(full|كل التفاصيل)/i.test(x.textContent)); if (b) b.click(); });
    const d = await dl; await p.evaluate(() => document.body.click());
    if (!d) return null;
    const t = fs.readFileSync(await d.path(), 'utf8');
    const rows = t.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.slice(1, -1).split('","'));
    return { text: t, head: rows[0], rows: rows.slice(1) };
  }
  const col = (f, keyRe) => f.head.findIndex((h) => keyRe.test(h));
  const bareTitles = (f) => f.head.filter((h) => !/[؀-ۿ]/.test(h) && !/^(GDS \(gds\)|PNR \(pnr\))$/.test(h));

  // ---- EN
  const leads = await exportFile('leads', 'en');
  if (!leads) fail('EN leads full CSV did not download');
  else {
    const cI = col(leads, /^contacts$/); const r9 = leads.rows.find((r) => r[0] === 'Test Company 9') || [];
    if (r9[cI] === 'Contact 9 Manager c9@example.com +966500000009') ok('EN leads: contacts cell is the person only (no bridge marks): ' + r9[cI]); else fail('EN leads: contacts cell → ' + JSON.stringify(r9[cI]));
    if (!/\[object Object\]/.test(leads.text)) ok('EN leads full: no "[object Object]" (' + leads.rows.length + ' rows)'); else fail('EN leads full has "[object Object]"');
  }
  const ops = await exportFile('ops', 'en');
  if (!ops) fail('EN operations full CSV did not download');
  else {
    const tI = col(ops, /^createdAt$/); const r0 = ops.rows[0] || [];
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r0[tI] || '')) ok('EN operations: createdAt is a readable date-time (' + r0[tI] + '), not an epoch'); else fail('EN operations: createdAt → ' + JSON.stringify(r0[tI]));
    if (!ops.rows.some((r) => r.some((c) => /^\d{13}$/.test(c)))) ok('EN operations: no 13-digit epoch anywhere'); else fail('EN operations: an epoch survives');
  }
  const projEn = await exportFile('projects', 'en');
  if (!projEn) fail('EN projects full CSV did not download');
  else { const tI = col(projEn, /^createdAt$/); const r0 = projEn.rows[0] || []; if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r0[tI] || '')) ok('EN projects: createdAt readable (' + r0[tI] + ')'); else fail('EN projects: createdAt → ' + JSON.stringify(r0[tI])); }

  // ---- AR
  const opsAr = await exportFile('ops', 'ar');
  if (!opsAr) fail('AR operations full CSV did not download');
  else {
    const bare = bareTitles(opsAr);
    if (!bare.length) ok('AR operations: all ' + opsAr.head.length + ' titles Arabic'); else fail('AR operations: bare titles ' + JSON.stringify(bare));
    const pI = col(opsAr, /\(priority\)$/); const sI = col(opsAr, /\(stage\)$/); const r0 = opsAr.rows[0] || [];
    if (r0[pI] === 'عاجل' && r0[sI] === 'جديد') ok('AR operations: priority and stage words are Arabic'); else fail('AR operations: priority/stage → ' + JSON.stringify([r0[pI], r0[sI]]));
    if (r0[col(opsAr, /\(client\)$/)] === 'Test Company 0') ok('AR operations: client name left as data'); else fail('AR operations: client cell → ' + JSON.stringify(r0[col(opsAr, /\(client\)$/)]));
  }
  const offAr = await exportFile('offers', 'ar');
  if (!offAr) fail('AR proposals full CSV did not download');
  else {
    const bare = bareTitles(offAr);
    if (!bare.length) ok('AR proposals: all ' + offAr.head.length + ' titles Arabic'); else fail('AR proposals: bare titles ' + JSON.stringify(bare));
    const r0 = offAr.rows[0] || [];
    const got = [r0[col(offAr, /\(status\)$/)], r0[col(offAr, /\(proposalType\)$/)], r0[col(offAr, /\(policyStatus\)$/)], r0[col(offAr, /\(approvalStatus\)$/)], r0[col(offAr, /\(promotedToProject\)$/)]];
    if (JSON.stringify(got) === JSON.stringify(['مسودة', 'عرض سعر', 'لم يُفحص', 'غير مطلوب', 'لا'])) ok('AR proposals: code-list values Arabic (status, type, policy, approval, yes/no)'); else fail('AR proposals: code-list values → ' + JSON.stringify(got));
    if (r0[col(offAr, /\(subject\)$/)] === 'Seed proposal 0') ok('AR proposals: free text left as data'); else fail('AR proposals: subject → ' + JSON.stringify(r0[col(offAr, /\(subject\)$/)]));
  }
  const projAr = await exportFile('projects', 'ar');
  if (!projAr) fail('AR projects full CSV did not download');
  else { const bare = bareTitles(projAr); if (!bare.length && projAr.rows[0][col(projAr, /\(status\)$/)] === 'نشط') ok('AR projects: all ' + projAr.head.length + ' titles Arabic, status Arabic'); else fail('AR projects: bare ' + JSON.stringify(bare) + ' status ' + JSON.stringify(projAr.rows[0][col(projAr, /\(status\)$/)])); }
  const leadsAr = await exportFile('leads', 'ar');
  if (!leadsAr) fail('AR leads full CSV did not download');
  else { const bare = bareTitles(leadsAr); const r9 = leadsAr.rows.find((r) => r[0] === 'Test Company 9') || []; if (!bare.length && r9[col(leadsAr, /\(source\)$/)] === 'استيراد' && r9[col(leadsAr, /\(contacts\)$/)] === 'Contact 9 Manager c9@example.com +966500000009') ok('AR leads: titles Arabic, source word Arabic, contact details left as data'); else fail('AR leads: bare ' + JSON.stringify(bare) + ' source ' + JSON.stringify(r9[col(leadsAr, /\(source\)$/)]) + ' contacts ' + JSON.stringify(r9[col(leadsAr, /\(contacts\)$/)])); }

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexport-records OK — record exports carry people, dates and Arabic titles a person can read');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
