/* Owner-notes sweep: verify every standing rule on the running app, EN + AR. */
import { start } from './mock-seed-live.mjs';
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const PORT = 8961, BASE = `http://127.0.0.1:${PORT}`;
start(PORT);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport:{width:1440,height:1000} })).newPage();
let errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,150)));
page.on('dialog',d=>d.accept());
const route = async r => { const u=r.request().url();
  if(u.includes('cdn.jsdelivr.net')){ if(u.includes('supabase-js')) return r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js')}); return r.fulfill({status:200,contentType:'application/javascript',body:''}); }
  const url=new URL(u); const resp=await fetch(BASE+url.pathname+url.search,{method:r.request().method(),headers:r.request().headers(),body:r.request().postDataBuffer()||undefined});
  const body=Buffer.from(await resp.arrayBuffer()); const h={}; resp.headers.forEach((v,k)=>h[k]=v); return r.fulfill({status:resp.status,headers:h,body});
};
await page.route('**cdn.jsdelivr.net/**', route);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
const LOG=[]; const STEP=(n,ok,d='')=>LOG.push(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(2500);
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button:has-text("Sign in")').first().click();
await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.businesses.length>0,null,{timeout:40000});
await page.waitForTimeout(1200);
const vtxt = () => page.evaluate(()=>((document.getElementById('view')||{}).textContent||''));

// RULE: VAT never on any finance view or report (EN + AR)
for (const lang of ['en','ar']) {
  await page.evaluate(l=>{ LANG=l; if(typeof applyLang==='function')applyLang(); },lang);
  for (const tab of ['overview','ledger','clients','reports']) {
    await page.evaluate(t=>{ current='finance'; openLead=null; FIN.tab=t; render(); },tab);
    await page.waitForTimeout(900);
    const t=await vtxt();
    const bad=/VAT(?!_)|ضريبة القيمة المضافة/.test(t.replace(/total_incl_vat_sar|cr_vat/g,''));
    STEP(`no VAT wording on finance ${tab} (${lang})`, !bad);
  }
}
// invoice card too
await page.evaluate(()=>{ LANG='en'; if(typeof applyLang==='function')applyLang(); current='finance'; FIN.tab='ledger'; render(); });
await page.waitForTimeout(800);
await page.evaluate(()=>{ const r=(FIN.rows||[])[0]; finRow(r.id); });
await page.waitForTimeout(700);
const mod=await page.evaluate(()=>((document.getElementById('finModal')||{}).textContent||''));
STEP('no VAT wording on the invoice card', !/VAT|ضريبة القيمة/.test(mod));
await page.evaluate(()=>{ const m=document.getElementById('finModal'); if(m)m.remove(); });

// RULE: CSV export header has no VAT word
await page.evaluate(()=>{ FIN.tab='ledger'; render(); });
// the Ledger reads finance_transactions (loaded async) — export only has rows once they are in
await page.waitForFunction(()=>window.TXN&&Array.isArray(TXN._csvRows)&&TXN._csvRows.length>0,null,{timeout:15000}).catch(()=>null);
await page.waitForTimeout(400);
const dl=page.waitForEvent('download',{timeout:8000}).catch(()=>null);
const csvDialogs=[]; const onDlg=d=>{ csvDialogs.push(d.message()); }; page.on('dialog',onDlg);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('#view button')].find(x=>/CSV/.test(x.textContent)); if(b)b.click(); });
const got=await dl; page.off('dialog',onDlg);
if (got) {
  const p='/tmp/notes-csv-test.csv'; await got.saveAs(p);
  const head=fs.readFileSync(p,'utf8').split('\n')[0];
  STEP('ledger CSV header carries no "vat" word', !/vat/i.test(head), head.slice(0,90));
} else {
  // 2026-09-02: this seed carries no finance_transactions, so the Ledger has nothing to export —
  // the correct behaviour is a plain "No rows to export" message, never a silent no-op.
  const noRows=csvDialogs.some(m=>/No rows to export|لا صفوف/.test(m));
  STEP('ledger CSV export: downloads, or says plainly there is nothing to export', noRows, JSON.stringify(csvDialogs));
}

// RULE: whole numbers in views (ledger cells show no decimals)
const dec=await page.evaluate(()=>{ const tds=[...document.querySelectorAll('#view tbody td')].map(t=>t.textContent.trim()); return tds.filter(t=>/^\d{1,3}(,\d{3})*\.\d/.test(t)).length; });
STEP('ledger shows whole numbers only (full precision stays in storage)', dec===0, dec+' cells with decimals');

// RULE: flat services, promo card, actual-number profit, uncapped plan %
await page.evaluate(()=>{ FIN.tab='overview'; render(); });
await page.waitForTimeout(1000);
const ov=await vtxt();
STEP('income by service is flat (no group counts/chevrons)', !!(await page.evaluate(()=>document.querySelector('.v32-svc'))) && !/\(\d+\)\s*[▸▾]/.test(ov));
// 2026-09-02: inverted on purpose — the promo-code card was turned OFF by rule ("never fabricate a
// number to fill a gap", docs/DECISIONS.md: 27.3M SAR of never-real promo value). It must stay absent.
STEP('promo codes card ABSENT (turned off by rule — its numbers were never real)', !(await page.evaluate(()=>document.querySelector('.v63-promo'))));
STEP('profit is an actual number on the overview (not a percentage KPI)', /Profit/.test(ov) && !/Profit\s*\d+%/.test(ov));

// RULE: settlements NOT built (out of scope)
for (const pid of ['finance','reports']) {
  await page.evaluate(id=>{ current=id; openLead=null; if(id==='finance')FIN.tab='overview'; render(); },pid);
  await page.waitForTimeout(700);
  STEP(`no settlements feature on ${pid}`, !/Settlement|تسوية/.test(await vtxt()));
}

// RULE: old manual mirror folded away
await page.evaluate(()=>{ current='today'; render(); });
await page.waitForTimeout(800);
const fold=await page.evaluate(()=>({ ro: [...document.getElementById('nav').querySelectorAll('*')].some(el=>/From Direct/.test(el.textContent||'')&&el.offsetParent!==null&&el.textContent.length<60), qc: [...document.querySelectorAll('.v19-qc .lab')].map(l=>l.textContent.trim()) }));
STEP('manual mirror folded away (nav clean, Import card on Today)', !fold.ro && fold.qc.includes('Import invoices'));

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l=>l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('ERRORS:', errs.length, errs.slice(0,5));
await browser.close(); process.exit(0);
