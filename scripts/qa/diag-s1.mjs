/* S1 VERIFICATION — the drill-down must add up.

   A report that opens to show you the invoices behind a figure is worse than useless if
   those invoices don't sum to the figure: it looks like proof while being wrong. So this
   checks three things, on the live data, in both languages:

     1  every row that opens, opens to invoices that sum EXACTLY to the total on that row
        — both the underlying values and the rounded figures a person actually reads
     2  a client's total is the same whether the report rolls by month or by quarter
        (the owner's "auto rolling month to quarter")
     3  no javascript errors, and the per-service table still shows the same numbers
*/
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';

const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
await signIn(page, TEAM.business.email, TEAM.business.pw);
await ready(page);
await page.evaluate(()=>{ current='finance'; if(typeof render==='function') render(); });
await page.waitForFunction(()=>window.FIN&&FIN.rows, null, {timeout:40000}).catch(()=>{});
await page.waitForTimeout(2500);
await page.evaluate(()=>{ finGo('reports'); });
await page.waitForTimeout(2000);

const num = s => Number(String(s).replace(/[^\d.-]/g,''))||0;

async function group(g1,g2){
  await page.evaluate(a=>{ finRB('g2',''); finRB('g1',a[0]); if(a[1]) finRB('g2',a[1]); }, [g1,g2]);
  await page.waitForTimeout(1600);
}

/* --- check 1: opened detail reconciles to the row it came from --- */
async function reconcile(tag){
  return await page.evaluate(t=>{
    const R = window.FIN && FIN._lastReport;
    if(!R) return {tag:t, error:'no report'};
    const deep = !!R.g2;
    const out = {tag:t, g1:R.g1, g2:R.g2||'', mets:R.mets, opened:0, under:[], shown:[]};

    /* the underlying arithmetic: rows kept behind each total */
    for(const k of R.keys){
      const G = R.g[k];
      const cases = deep ? Object.keys(G.__sub||{}).map(s=>[s,(G.__subRows||{})[s],G.__sub[s]])
                         : [['', G.__rows, G.__tot]];
      for(const [s,rows,tot] of cases){
        const bad=[];
        for(const m of R.mets){
          const want = (tot&&tot[m])||0;
          const got  = (rows||[]).reduce((a,r)=>a+(m==='_count'?1:(+r[m]||0)),0);
          if(Math.abs(want-got) > 0.005) bad.push({m, want, got});
        }
        out.under.push({k, s, n:(rows||[]).length, ok:!bad.length, bad});
      }
    }

    /* what a person actually sees: open each row, sum the printed child figures */
    const rows=[...document.querySelectorAll('#view tr[data-rbk]')].filter(tr=>{
      const s=tr.getAttribute('data-rbs')||''; return deep ? !!s : !s;
    });
    for(const tr of rows){
      const k=tr.getAttribute('data-rbk'), s=tr.getAttribute('data-rbs')||'';
      const parent=[...tr.querySelectorAll('td')].slice(1).map(td=>td.textContent.trim());
      window.s1Toggle(k,s);
      out.opened++;
      const kids=[]; let n=tr.nextElementSibling;
      while(n && n.className && n.className.indexOf('s1-kid')>=0){ kids.push(n); n=n.nextElementSibling; }
      const dataKids=kids.filter(x=>x.querySelectorAll('td').length>1);
      const withheld=kids.some(x=>/withheld|غير معروضة/.test(x.textContent||''));
      const sums=parent.map((_,i)=>dataKids.reduce((a,x)=>{
        const c=x.querySelectorAll('td')[i+1]; return a + (Number(String(c?c.textContent:'').replace(/[^\d.-]/g,''))||0);
      },0));
      const P=parent.map(v=>Number(String(v).replace(/[^\d.-]/g,''))||0);
      out.shown.push({k, s, kids:dataKids.length, withheld,
                      parent:P, sums, match:P.every((v,i)=>Math.abs(v-sums[i])<0.5)});
      window.s1Toggle(k,s);
    }
    return out;
  }, tag);
}

const results={};
await group('__client','');            results.client        = await reconcile('client → invoices');
await group('__client','month');       results.clientMonth   = await reconcile('client › month → invoices');
await group('__client','quarter');     results.clientQuarter = await reconcile('client › quarter → invoices');
await group('service_type','');        results.service       = await reconcile('service → invoices');

/* --- check 2: a client's total must not change when the roll-up changes --- */
await group('__client','month');
const byMonth = await page.evaluate(()=>{const R=FIN._lastReport;const o={};R.keys.forEach(k=>o[k]=R.g[k].__tot.revenue_sar||0);return o;});
await group('__client','quarter');
const byQuarter = await page.evaluate(()=>{const R=FIN._lastReport;const o={};R.keys.forEach(k=>o[k]=R.g[k].__tot.revenue_sar||0);return o;});
const rollOk = Object.keys(byMonth).every(k=>Math.abs(byMonth[k]-(byQuarter[k]||0))<0.005)
            && Object.keys(byMonth).length===Object.keys(byQuarter).length;

/* --- check 3: Arabic --- */
await page.evaluate(()=>{ LANG='ar'; if(typeof applyLang==='function') applyLang(); render(); });
await page.waitForTimeout(2500);
await page.evaluate(()=>{ finGo('reports'); });
await page.waitForTimeout(1600);
await group('__client','');
results.arabic = await reconcile('AR client → invoices');

console.log(JSON.stringify({results, rollOk, byMonth, byQuarter}, null, 1));
console.log('errs', errs.slice(0,4));

/* verdict */
let fails=[];
for (const [name,r] of Object.entries(results)){
  if(r.error){ fails.push(name+': '+r.error); continue; }
  r.under.filter(x=>!x.ok).forEach(x=>fails.push(`${name}: underlying rows do not sum for "${x.k}${x.s?' › '+x.s:''}" ${JSON.stringify(x.bad)}`));
  r.shown.filter(x=>x.withheld).forEach(x=>fails.push(`${name}: detail withheld for "${x.k}${x.s?' › '+x.s:''}"`));
  r.shown.filter(x=>!x.match).forEach(x=>fails.push(`${name}: printed detail does not sum to the printed total for "${x.k}${x.s?' › '+x.s:''}" parent=${JSON.stringify(x.parent)} kids=${JSON.stringify(x.sums)}`));
  if(!r.opened) fails.push(`${name}: no rows opened at all`);
}
if(!rollOk) fails.push('month roll-up and quarter roll-up give different client totals');
if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,3)));

console.log(fails.length ? 'S1 FAILS:\n  '+fails.join('\n  ') : 'S1 OK · every opened row reconciles · month and quarter roll-ups agree · no errors');
await browser.close();
process.exit(fails.length?1:0);
