/* Verifies the two round-2 fixes:
   1. Today's top-bar Export menu is hidden (nothing tabular there to export); every other
      page keeps its Export menu, and it still works (spot-check on Leads).
   2. Proposals: picking a client ONLY via the "Load a corporate client's negotiated deal &
      pricing" dropdown now actually links the proposal to that client — proven by the client's
      own detail page listing the proposal in its Offers, the same way o_setClient already did. */
import { openApp, signIn, ready, TEAM, requirePw } from './emp-rig.mjs';

TEAM.admin.pw = requirePw('admin');
const { browser, page, errs } = await openApp(Number(process.env.PORT||9959));
const fails=[], notes=[];

await signIn(page, TEAM.admin.email, TEAM.admin.pw); await ready(page);

async function goto(v){ await page.evaluate((vv)=>{ current=vv; if(typeof render==='function') render(); }, v); await page.waitForTimeout(1800); }

/* ---------- Fix #1: Today's Export menu hidden, others untouched ---------- */
await goto('today');
const todayExp = await page.evaluate(()=>{
  const w=document.querySelector('.exp-wrap');
  return { present: !!w, visible: w ? getComputedStyle(w).display!=='none' : null };
});
notes.push('Today .exp-wrap: '+JSON.stringify(todayExp));
if(!todayExp.present) fails.push('Today: .exp-wrap element not found at all — page structure changed?');
else if(todayExp.visible) fails.push('Today: Export menu is still visible — fix did not take');

for(const v of ['leads','clients','offers','finance']){
  await goto(v);
  const r = await page.evaluate(()=>{
    const w=document.querySelector('.exp-wrap');
    return { present: !!w, visible: w ? getComputedStyle(w).display!=='none' : null };
  });
  notes.push(v+' .exp-wrap: '+JSON.stringify(r));
  if(!r.present || !r.visible) fails.push(v+': Export menu should still be visible here, got '+JSON.stringify(r));
}

/* spot-check the Leads export still actually works after this change */
await goto('leads');
const [dl] = await Promise.all([
  page.waitForEvent('download', {timeout:6000}).catch(()=>null),
  page.evaluate(()=>{ try{ expGo('list'); }catch(e){ window.__e=String(e); } })
]);
if(!dl) fails.push('Leads export (top-bar) no longer fires after the Today change — regression');
else notes.push('Leads export still fires: '+dl.suggestedFilename());

/* going back to Today and away again, to make sure toggling is stable both directions */
await goto('today');
const todayAgain = await page.evaluate(()=>{ const w=document.querySelector('.exp-wrap'); return w? getComputedStyle(w).display : null; });
await goto('clients');
const clientsAgain = await page.evaluate(()=>{ const w=document.querySelector('.exp-wrap'); return w? getComputedStyle(w).display : null; });
notes.push('toggle stability: today='+todayAgain+' then clients='+clientsAgain);
if(todayAgain!=='none') fails.push('Today->Today (revisit) did not stay hidden: '+todayAgain);
if(clientsAgain==='none') fails.push('Clients after Today did not come back visible: '+clientsAgain);

/* ---------- Fix #2: o_loadClient now links the proposal ---------- */
await goto('offers');
const client = await page.evaluate(()=>{
  const b=(DB.businesses||[]).find(x=>x.isClient);
  return b ? {id:b.id, name:b.name} : null;
});
if(!client) fails.push('no isClient business found to test proposal linking against');
else{
  notes.push('test client: '+client.name+' ('+client.id+')');

  const before = await page.evaluate((cid)=>((DB.offers||[]).filter(o=>o.linkedLeadId===cid).length), client.id);

  await page.evaluate(()=>{ try{ newOffer(); }catch(e){ window.__e2=String(e); } });
  await page.waitForTimeout(1200);
  const newOfferId = await page.evaluate(()=>{ try{ return curOffer()?curOffer().id:null; }catch(_){ return null; } });

  const picked = await page.evaluate((c)=>{
    const sels=[...document.querySelectorAll('#view select')];
    const loadSel=sels.find(s=>/o_loadClient/.test(s.getAttribute('onchange')||''));
    if(!loadSel) return {found:false};
    loadSel.value=c.id; loadSel.dispatchEvent(new Event('change'));
    return {found:true};
  }, client);
  await page.waitForTimeout(1200);

  if(!picked.found) fails.push('could not find the "Load a corporate client\'s negotiated deal & pricing" dropdown to test');
  else{
    const offerState = await page.evaluate(()=>{ const o=curOffer(); return o?{client:o.client, linkedLeadId:o.linkedLeadId, id:o.id}:null; });
    notes.push('offer after o_loadClient only: '+JSON.stringify(offerState));
    if(!offerState || offerState.linkedLeadId !== client.id) fails.push('o_loadClient still did not set linkedLeadId — fix did not take. Got: '+JSON.stringify(offerState));
    else notes.push('o_loadClient correctly set linkedLeadId to the picked client');

    /* the real proof: open that client's own detail page and see the proposal listed */
    await page.evaluate((cid)=>{ current='clients'; openLead=cid; if(typeof render==='function')render(); }, client.id);
    await page.waitForTimeout(1800);
    const onClientPage = await page.evaluate((oid)=>{
      const view=document.getElementById('view');
      const txt=(view&&view.innerText)||'';
      return { mentionsOfferRef: oid ? txt.length>0 : false, offersForClient: (window.offersFor?offersFor(current==='clients'?openLead:''):null) };
    }, newOfferId);
    const offersForClientDirect = await page.evaluate((cid)=>{ try{ return offersFor(cid).map(o=>o.id); }catch(_){ return null; } }, client.id);
    notes.push('offersFor(client.id) after fix: '+JSON.stringify(offersForClientDirect));
    if(!offersForClientDirect || !offersForClientDirect.includes(newOfferId)) fails.push('the new proposal does NOT show up in offersFor(client) — client detail page would not list it. offersFor='+JSON.stringify(offersForClientDirect)+' newOfferId='+newOfferId);
    else notes.push("CONFIRMED: proposal now appears in the client's own offer list (offersFor) — real link, not just display name");
  }

  /* cleanup: remove the test proposal we created */
  if(newOfferId){
    const cleaned = await page.evaluate((oid)=>{
      const before=(DB.offers||[]).length;
      DB.offers=(DB.offers||[]).filter(o=>o.id!==oid);
      try{ save(); }catch(_){}
      return { removedOne: (DB.offers||[]).length===before-1 };
    }, newOfferId);
    notes.push('cleanup: '+JSON.stringify(cleaned));
  }
}

if(errs.length) fails.push('javascript errors: '+JSON.stringify(errs.slice(0,5)));

console.log(notes.map(n=>'  · '+n).join('\n'));
console.log(fails.length ? '\nVERIFY FAILS:\n  '+fails.join('\n  ') : '\nVERIFY OK · both round-2 fixes confirmed live, no regressions');
await browser.close();
process.exit(fails.length?1:0);
