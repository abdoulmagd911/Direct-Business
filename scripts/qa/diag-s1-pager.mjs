/* Does the drill-down fight the pager? The pager counts every row with more than one cell,
   and the rows I insert have several. Open a client, then switch the table to 10-per-page
   and see what the count says and what is actually on screen. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
const { browser, page, errs } = await openApp(Number(process.env.PORT||9942));
await signIn(page, TEAM.business.email, TEAM.business.pw);
await ready(page);
await page.evaluate(()=>{ current='finance'; render(); });
await page.waitForFunction(()=>window.FIN&&FIN.rows,null,{timeout:40000}).catch(()=>{});
await page.waitForTimeout(2500);
await page.evaluate(()=>{ finGo('reports'); });
await page.waitForTimeout(1800);
await page.evaluate(()=>{ finRB('g2',''); finRB('g1','__client'); });
await page.waitForTimeout(1500);

const read = async (label) => {
  const r = await page.evaluate(()=>{
    const bar=[...document.querySelectorAll('#view .pg-bar')].pop();
    const tbl=[...document.querySelectorAll('#view table')].find(t=>t.querySelector('tr[data-rbk]'));
    const vis=[...tbl.tBodies[0].rows].filter(r=>r.style.display!=='none');
    return {
      label: bar?bar.querySelector('span').textContent:'(no pager)',
      visibleGroupRows: vis.filter(r=>r.hasAttribute('data-rbk')).length,
      visibleKidRows:  vis.filter(r=>(r.className||'').indexOf('s1-kid')>=0).length,
      hiddenKidRows:   [...tbl.tBodies[0].rows].filter(r=>(r.className||'').indexOf('s1-kid')>=0 && r.style.display==='none').length
    };
  });
  console.log(label.padEnd(34), JSON.stringify(r));
  return r;
};

await read('fresh, nothing opened');
await page.evaluate(()=>{ const R=FIN._lastReport; s1Toggle(R.keys[0],''); });
await page.waitForTimeout(600);
const opened = await read('one client opened');

/* now force the pager to recount */
await page.evaluate(()=>{
  const sel=[...document.querySelectorAll('#view select.pg-size')].pop();
  sel.value='10'; sel.dispatchEvent(new Event('change',{bubbles:true}));
});
await page.waitForTimeout(900);
const paged = await read('after switching to 10 / page');

/* What actually makes this right:
     1  the "of N" total counts the report's own rows, and opening detail must not change it
     2  no detail row may be left on screen once the page turns (it would sit under the
        wrong client), and none may be hidden mid-list either                            */
const total = s => Number((String(s).match(/of\s+(\d+)/)||[])[1]||-1);
const problems = [];
if (total(opened.label) !== total(paged.label))
  problems.push(`the row count changed when the page size changed: ${total(opened.label)} → ${total(paged.label)}`);
if (paged.visibleKidRows > 0)
  problems.push(`${paged.visibleKidRows} detail rows survived the page change`);
if (paged.hiddenKidRows > 0)
  problems.push(`${paged.hiddenKidRows} detail rows were hidden mid-list`);
if (opened.visibleKidRows === 0)
  problems.push('opening a client revealed nothing — the test proved nothing');
console.log('\nerrs',errs.slice(0,2));
console.log(problems.length ? 'PAGER CONFLICT: '+problems.join('; ') : 'pager and drill-down agree · count stays honest · no stranded detail');
await browser.close();
process.exit(problems.length ? 1 : 0);
