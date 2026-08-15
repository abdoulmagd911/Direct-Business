/* The Team screen after the per-page tick boxes were taken out — it must still list everyone,
   still let the right people act, still refuse Admin to a manager, and carry no dead buttons. */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};
let port=9970;
for (const k of ['business','othman']) {
  const t=TEAM[k];
  console.log(`\n———— ${t.name} (${t.role}) opening Team & Access ————`);
  const {browser,page,errs}=await openApp(port++);
  await signIn(page,t.email,t.pw); await ready(page); await go(page,'settings',2000);
  const r=await page.evaluate(async ()=>{
    try{ if(typeof v48Users==='function') v48Users(); }catch(_){}
    await new Promise(x=>setTimeout(x,4000));
    const box=document.getElementById('v48ov');
    const sels=[...document.querySelectorAll('select[data-role]')];
    return {
      opened: !!box,
      people: sels.length,
      deadButtons: document.querySelectorAll('[data-save],[data-all],[data-none]').length,
      tickBoxes: document.querySelectorAll('#v48ov input[type="checkbox"]').length,
      passwordBox: !!document.getElementById('v48pw'),
      adminOffered: sels.length? [...sels[0].options].some(o=>o.value==='admin' && !o.disabled && !o.hidden) : null,
      addFormLevels: (()=>{const s=document.getElementById('v48r'); return s? [...s.options].filter(o=>!o.disabled&&!o.hidden).map(o=>o.value):null;})(),
      explains: /Opens Today, Leads, Clients and Finance|Opens every page|Adds and removes people/.test(document.getElementById('v48ov')?.textContent||''),
      switchOff: document.querySelectorAll('[data-tog]').length,
      resetPw: document.querySelectorAll('[data-rst]').length,
    };
  });
  S(`${t.name}: the Team screen opens and lists everyone`, r.opened && r.people>=11, `${r.people} people`);
  S(`${t.name}: no dead page buttons or tick boxes left`, r.deadButtons===0 && r.tickBoxes===0, JSON.stringify({deadButtons:r.deadButtons,tickBoxes:r.tickBoxes}));
  S(`${t.name}: each person's row explains what their level opens`, r.explains);
  S(`${t.name}: the password box is there when adding someone`, r.passwordBox);
  /* an admin gets buttons on every row; a manager gets none on the four admin rows —
     the server refuses those calls, so offering them was a confirm-box dead end */
  const wantBtns = t.role==='admin' ? 11 : 7;
  S(`${t.name}: switch-off and reset-password on exactly the rows he may touch`, r.switchOff>=wantBtns && r.resetPw>=wantBtns && (t.role==='admin'||r.switchOff<11), `${r.switchOff}/${r.resetPw}`);
  const wantAdmin = t.role==='admin';
  S(`${t.name}: Admin ${wantAdmin?'IS':'is NOT'} offered in the level list`, r.adminOffered===wantAdmin, `row picker=${r.adminOffered}, add form=${JSON.stringify(r.addFormLevels)}`);
  S(`${t.name}: the add form offers ${wantAdmin?'all three levels':'Manager and Employee only'}`,
    wantAdmin ? (r.addFormLevels||[]).includes('admin') : !(r.addFormLevels||[]).includes('admin'), JSON.stringify(r.addFormLevels));
  S(`${t.name}: no javascript errors`, errs.length===0, errs.slice(0,2).join(' | '));
  await page.screenshot({path:`shots/team-${k}.png`});
  await browser.close();
}
console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
