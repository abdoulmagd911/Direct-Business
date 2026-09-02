/* THE LEDGER FINGERPRINT (F3). The money fingerprint only ever looked at the Overview tab,
   but the file being moved in F3 draws ALL FIVE finance tabs — overview, ledger, clients,
   reports and import. So this captures every one of them, in English and Arabic: the KPI
   figures, every rendered table row, the tab strip itself, and the totals held in memory.
   Run it before the move and after; the two must be identical character for character. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';

const TABS = ['overview','ledger','clients','reports','import'];
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
await signIn(page, TEAM.business.email, TEAM.business.pw);
await ready(page);

await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
await page.waitForFunction(()=>window.FIN&&FIN.rows, null, {timeout:40000}).catch(()=>{});
await page.waitForTimeout(3000);

const out = {};
for (const lang of ['en','ar']) {
  if (lang==='ar'){
    await page.evaluate(()=>{ LANG='ar'; if(typeof applyLang==='function') applyLang(); render(); });
    await page.waitForTimeout(3000);
  }
  out[lang] = {};
  for (const tab of TABS) {
    await page.evaluate(t=>{ if(typeof finGo==='function') finGo(t); else { FIN.tab=t; render(); } }, tab);
    await page.waitForTimeout(1800);
    out[lang][tab] = await page.evaluate(()=>{
      const v = document.getElementById('view');
      const txt = v.textContent || '';
      /* KPI tiles by their rendered label, both languages */
      const kpis = {};
      ['Revenue','Cost','Profit','Received','Outstanding','Invoices',
       'الإيراد','التكلفة','الربح','المحصل','المتبقي','الفواتير']
        .forEach(k=>{ const m = txt.match(new RegExp(k+'(?:\\s*\\([^)]*\\))?\\s*([\\d.,]+[KM]?)','i')); if(m) kpis[k]=m[1]; });
      /* every table on the tab, every row, cell by cell */
      const tables = [...v.querySelectorAll('table')].map(t =>
        [...t.querySelectorAll('tr')].map(r =>
          [...r.querySelectorAll('td,th')].map(c => c.textContent.trim()).join('|')
        ).join(' ‖ ')
      );
      /* the tab strip: which buttons exist and which one reads as selected */
      const strip = [...v.querySelectorAll('button')]
        .filter(b => /finGo/.test(b.getAttribute('onclick')||''))
        .map(b => b.textContent.trim() + (b.className.includes('pri') ? '*' : ''))
        .join(' · ');
      /* form controls the ledger owns, so a lost dropdown shows up here */
      const controls = [...v.querySelectorAll('select,input')]
        .map(e => (e.id||e.name||e.type||'?') + (e.tagName==='SELECT' ? ':'+e.options.length : ''))
        .join(',');
      return { kpis, tables, strip, controls, chars: txt.replace(/\s+/g,' ').length };
    });
  }
  out[lang].memory = await page.evaluate(()=>({
    rows: (window.FIN&&FIN.rows||[]).length,
    totalRevenue: (window.FIN&&FIN.rows||[]).reduce((n,r)=>n+(+r.revenue_sar||0),0),
    totalCost:    (window.FIN&&FIN.rows||[]).reduce((n,r)=>n+(+r.cost_sar||0),0),
    totalProfit:  (window.FIN&&FIN.rows||[]).reduce((n,r)=>n+(+r.profit_sar||0),0),
    links: Object.keys((window.FIN&&FIN.linkByGroup)||{}).sort().join(','),
    canEdit: typeof canFinEdit==='function' ? canFinEdit() : null,
    hasClient: typeof fc==='function' ? !!fc() : null
  }));
}
console.log(JSON.stringify(out, null, 1));
console.log('errs', errs.slice(0,3));
await browser.close();
process.exit(0);
