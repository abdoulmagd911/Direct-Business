/* New-features probe — proposal file library, import origin columns + drag-drop,
   Won → complete-the-client, Direct links, svcType broadening, UI trims. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8917, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
let nextDialog = null;
page.on('dialog', async d => {
  if (nextDialog !== null) { const v = nextDialog; nextDialog = null; if (d.type() === 'prompt') await d.accept(v); else await d.accept(); }
  else await d.accept();
});
const route = async r => {
  const u = r.request().url();
  if (u.includes('cdn.jsdelivr.net')) {
    if (u.includes('supabase-js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  const url = new URL(u);
  const resp = await fetch(BASE + url.pathname + url.search, { method: r.request().method(), headers: r.request().headers(), body: r.request().postData() || undefined });
  const body = Buffer.from(await resp.arrayBuffer());
  const headers = {}; resp.headers.forEach((v, k) => headers[k] = v);
  return r.fulfill({ status: resp.status, headers, body });
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
const LOG = [];
let shotN = 0;
const STEP = async (name, ok, detail = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${name}${detail ? ' — ' + detail : ''}`); };
const SHOT = async (name) => { shotN++; await page.screenshot({ path: `shots/nf${String(shotN).padStart(2, '0')}-${name}.png` }); };
const nav = async (re) => { await page.locator('#nav button').filter({ hasText: re }).first().click(); await page.waitForTimeout(1100); };

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(4000);

// ===== 1+2 · Import: optional origin/proposal_ref + validation + drag-drop + svcType via stored rows =====
await nav(/^(Finance|المالية)$/);
await page.waitForTimeout(1500);
await page.locator('#view button, #view .btn').filter({ hasText: /Import|استيراد/ }).first().click();
await page.waitForTimeout(900);
const impUI = await page.evaluate(() => ({
  drop: !!document.getElementById('finDrop'),
  optional: (document.getElementById('view').textContent || '').includes('origin,proposal_ref'),
  shortText: !(document.getElementById('view').textContent || '').includes('recomputed and mismatches')
}));
await STEP('import: drag-drop zone present', impUI.drop);
await STEP('import: optional columns documented', impUI.optional);
await STEP('import: verbose paragraph trimmed', impUI.shortText);
await SHOT('import-page');
const CSV = ['client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes,origin,proposal_ref',
  'Al-Noor Schools,August,Q3,DP-9101,TTIN-9101,Al-Noor Schools Group,2026-08-03,School trip flights,23000,0,23000,20000,3000,verified_paid,,project,DB-500103',
  'Al-Noor Schools,August,Q3,DP-9102,TTIN-9102,Al-Noor Schools Group,2026-08-10,Hotel rooms Makkah,11500,0,11500,10000,1500,verified_paid,,booking,',
  'Al-Noor Schools,August,Q3,DP-9103,,Al-Noor Schools Group,2026-08-12,Visa processing x4,4600,0,4600,4000,600,verified_paid,,tender,',
  'Al-Noor Schools,August,Q3,DP-9104,,Al-Noor Schools Group,2026-08-12,Transfer bus,2300,0,2300,2000,300,verified_paid,,project,',
  'Al-Noor Schools,August,Q3,DP-9105,,Al-Noor Schools Group,2026-08-14,حجز فندق مكة ٣ ليال,8050,0,8050,7000,1050,verified_paid,,booking,',
  'Rawabi Holding,August,Q3,DP-9101,,dup row,2026-08-13,Anything,100,0,100,50,50,verified_paid,,booking,'].join('\r\n');
fs.writeFileSync('shots/newfeat-import.csv', '﻿' + CSV);
await page.setInputFiles('#finFile', 'shots/newfeat-import.csv');
await page.evaluate(() => finParse());
await page.waitForTimeout(1200);
const prev = await page.evaluate(() => (document.getElementById('finImpOut').textContent || '').replace(/\s+/g, ' '));
await STEP('import: 3 clean rows ready', /Ready to import: 3/.test(prev), prev.slice(0, 140));
await STEP('import: bad origin flagged', /origin must be booking or project/.test(prev));
await STEP('import: project without proposal_ref flagged', /project rows need a proposal_ref/.test(prev));
await STEP('import: duplicate skipped', /Skipped duplicates.*1/.test(prev));
await SHOT('import-preview');
await page.evaluate(() => finCommit());
await page.waitForTimeout(1500);
const imported = await page.evaluate(async () => {
  const r = await fetch('http://127.0.0.1:8917/rest/v1/finance_invoices').then(x => x.json()).catch(() => null);
  if (!r) return null;
  const a = r.find(x => x.invoice_no === 'DP-9101'), b = r.find(x => x.invoice_no === 'DP-9102'), c = r.find(x => x.invoice_no === 'DP-9105');
  return a && b && c ? { aOrigin: a.origin, aRef: a.proposal_ref, aSvc: a.service_type, bOrigin: b.origin, bSvc: b.service_type, arSvc: c.service_type } : null;
});
await STEP('import: origin/proposal_ref/service stored (EN+AR keywords)', !!imported && imported.aOrigin === 'project' && imported.aRef === 'DB-500103' && imported.aSvc === 'Flights' && imported.bOrigin === 'booking' && imported.bSvc === 'Hotels' && imported.arSvc === 'Hotels', JSON.stringify(imported));

// ===== 3 · Invoice modal: Open in Direct + DPIN link =====
await page.locator('#view button, #view .btn').filter({ hasText: /Ledger|السجل/ }).first().click();
await page.waitForTimeout(1200);
const dpinLink = await page.evaluate(() => { const a = [...document.querySelectorAll('#view a')].find(x => (x.href || '').includes('payments.directksa.com')); return a ? a.href : null; });
await STEP('ledger: DPIN cell links into Direct', !!dpinLink, dpinLink || '');
await page.evaluate(() => { const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-9101'); finRow(r.id); });
await page.waitForTimeout(600);
const modalLink = await page.evaluate(() => { const m = document.getElementById('finModal'); const a = m && [...m.querySelectorAll('a')].find(x => (x.href || '').includes('payments.directksa.com')); return a ? { href: a.href, label: a.textContent.trim() } : null; });
await STEP('invoice modal: "Open in Direct ↗" links into Direct Payments (uuid page, or admin list when no uuid)', !!modalLink && /payments\.directksa\.com\/en\/admin\/invoices/.test(modalLink.href), JSON.stringify(modalLink));
const tplWorks = await page.evaluate(() => { DB.settings = DB.settings || {}; DB.settings.pdInvoiceUrl = 'https://payments.directksa.com/x/{dpin}?inv={invoice_no}'; const r = (FIN.rows || []).find(x => x.invoice_no === 'DP-9101'); const out = pdInvoiceLink(r); delete DB.settings.pdInvoiceUrl; return out; });
await STEP('Direct link template is a setting (placeholders work)', tplWorks === 'https://payments.directksa.com/x/TTIN-9101?inv=DP-9101', tplWorks);
await SHOT('invoice-direct-link');
await page.evaluate(() => finCloseModal());

// ===== 4 · Proposal file library =====
await nav(/^(Proposals|العروض)$/);
await page.waitForTimeout(900);
await page.locator('#otb tr').first().click();
await page.waitForTimeout(900);
const upUI = await page.evaluate(() => ({ inp: !!document.getElementById('o_file'), label: (document.getElementById('view').textContent || '').match(/stored in the app|محفوظ داخل التطبيق/) !== null }));
await STEP('proposal editor: file input present', upUI.inp && upUI.label);
fs.writeFileSync('shots/test-proposal.pdf', '%PDF-1.4 test proposal for library\n%%EOF');
await page.setInputFiles('#o_file', 'shots/test-proposal.pdf');
await page.waitForTimeout(2000);
const upDone = await page.evaluate(() => { const o = (DB.offers || []).find(x => x.fileName); return o ? { name: o.fileName, path: o.filePath, url: (o.fileUrl || '').includes('/storage/v1/object/public/proposals/') } : null; });
await STEP('proposal file uploads to the library and is remembered', !!upDone && upDone.name === 'test-proposal.pdf' && upDone.url, JSON.stringify(upDone));
const chipShown = await page.evaluate(() => (document.getElementById('view').textContent || '').includes('test-proposal.pdf'));
await STEP('stored file shown on the proposal with 📎', chipShown);
await SHOT('proposal-file-attached');
await page.locator('#view button').filter({ hasText: /← Offers/ }).first().click();
await page.waitForTimeout(800);
const listClip = await page.evaluate(() => { const o = (DB.offers || []).find(x => x.fileName); const row = [...document.querySelectorAll('#otb tr')].find(tr => tr.textContent.includes(o.ref)); return row ? row.textContent.includes('📎') : false; });
await STEP('proposal list marks the file with 📎', listClip);

// ===== 5 · Won → complete-the-client =====
await nav(/^(Leads|العملاء المحتملون)$/);
await page.waitForTimeout(900);
// create a lead through the real modal then win it via quick edit
await page.locator('#view button', { hasText: '+ New business' }).first().click();
await page.waitForTimeout(600);
await page.fill('#f_name', 'Qimam Events Co');
await page.fill('#f_seg', 'Events');
await page.locator('#mSave').click();
await page.waitForTimeout(900);
await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Qimam Events Co'); leadQuickEdit(b.id); });
await page.waitForTimeout(700);
await page.evaluate(() => { document.getElementById('qe_stage').value = 'Won'; });
await page.locator('#mSave').click();
await page.waitForTimeout(1200);
const handover = await page.evaluate(() => { const m = document.querySelector('.modal, #modal'); const t = document.body.textContent || ''; return /New client handover|تسليم العميل الجديد/.test(t) && !!document.getElementById('c_did'); });
await STEP('quick-edit Won opens "complete the client" handover', handover);
await SHOT('won-handover');
if (handover) {
  await page.fill('#c_did', '911');
  await page.fill('#c_poc', 'Sara Qimam · CEO office');
  await page.locator('#mSave').click();
  await page.waitForTimeout(900);
  const saved = await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Qimam Events Co'); return { id: b.directClientId, client: b.isClient, poc: b.pocName }; });
  await STEP('handover saves Direct ID + POC on the new client', saved.id === '911' && saved.client === true && saved.poc.includes('Sara'), JSON.stringify(saved));
}
// setLeadStage path too
const hv2 = await page.evaluate(async () => {
  const b = { id: 'nf-t2', name: 'Stage Path Test Co', stage: 'Proposal', status: 'Proposal', contacts: [], activities: [] };
  DB.businesses.push(b); setLeadStage('nf-t2', 'Won');
  await new Promise(r => setTimeout(r, 600));
  return !!document.getElementById('c_did');
});
await STEP('setLeadStage Won also opens the handover', hv2);
await page.locator('#mSave').click().catch(() => {});
await page.waitForTimeout(600);

// ===== 6 · KPI grid + client Direct link =====
await nav(/^(Finance|المالية)$/);
await page.waitForTimeout(1200);
await page.locator('#view button, #view .btn').filter({ hasText: /Performance|الأداء/ }).first().click();
await page.waitForTimeout(1000);
const kpi = await page.evaluate(() => { const g = [...document.querySelectorAll('#view .card')].find(c => (c.parentElement.getAttribute('style') || '').includes('minmax(132px')); return g ? g.parentElement.children.length : 0; });
await STEP('KPI grid uses the tightened 132px cards', kpi === 6, 'cards=' + kpi);
await SHOT('finance-kpis');

console.log(LOG.join('\n'));
console.log(`\n${LOG.filter(l => l.startsWith('PASS')).length}/${LOG.length} PASS · pageerrors: ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 6).join('\n'));
await browser.close(); process.exit(0);
