/* Attack probe — the view-only SHARE LINK and Settings ▸ TEAM & ACCESS (2026-09-02).
   Nobody had attacked either before. Two things this probe does that no earlier probe did:

     1. It opens the shared view in a FRESH BROWSER CONTEXT WITH NO SESSION, against a mock
        that models the real grant/RLS wall (MOCK_ANON_ENFORCE=1 — share_view and app_role are
        executable by `anon` on the live project, save_state / save_state_patch / undo_change /
        log_page_denied / my_page_access are NOT, every table read policy is app_role() IS NOT
        NULL). Testing a share view while signed in proves nothing; this is the real thing.
     2. It edits the section in the share URL to prove whether the link is scoped at all.

   Run: node scripts/qa/probe-share-and-settings-attacks.mjs
   Notes: touches scripts/qa/mock-supabase.mjs ADDITIVELY (share_links INSERT, share_view RPC,
   MOCK_ANON_ENFORCE) — nothing existing changed.                                            */
import { chromium } from 'playwright';
/* 2026-09-03 — a guard that goes red because of where you stand is worse than no guard:
   it trains people to ignore reds. These source reads used to be relative to the current
   directory, so the probe passed from the repo root and failed from scripts/qa with an
   ENOENT that looks exactly like a real defect. Resolve from this file's own location. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoFile = (p) => join(REPO_ROOT, p);

import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB=fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js','utf8');
const PORT=8911; const srv=start(PORT); const BASE='http://localhost:'+PORT;
const UID='11111111-1111-1111-1111-111111111111';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errors=[]; const checks=[]; const notes=[];
const ok=(n,v)=>checks.push([n,!!v]);

async function newPage(){
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async r=>{
    const rq=r.request(); const u=new URL(rq.url());
    try{ const resp=await fetch(BASE+u.pathname+u.search,{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()});
      const body=await resp.text(); const h={}; resp.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding'].includes(k))h[k]=v;});
      await r.fulfill({status:resp.status,headers:h,body}); }catch(e){ await r.fulfill({status:500,body:'{}'}); }
  });
  await p.route('**cdn.jsdelivr.net/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:LIB}));
  await p.route('**fonts.googleapis.com/**', r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('**fonts.gstatic.com/**', r=>r.abort());
  return {ctx,p};
}
async function signIn(p,path='/today'){
  await p.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1800);
  await p.fill('#cl_email','test@directksa.com'); await p.fill('#cl_pw','Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
}
const api=(path,init)=>fetch(BASE+path,init).then(r=>r.text()).then(t=>{try{return JSON.parse(t);}catch(_){return t;}});
const setRole=role=>api('/rest/v1/app_users?id=eq.'+UID,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});

/* ══ PHASE 1 — signed-in admin creates a share link ══════════════════════════════════ */
await setRole('admin');
/* Seed the workspace blob the way the LIVE one actually looks — money rows, an agency profile
   and an audit trail — so "what does an anonymous holder see?" is answered against a realistic
   blob, not the mock's empty arrays. All synthetic (repo rule 7). __canary proves in phase 3
   that the anonymous view never wrote to it. */
const SEED_PATCH={__canary:'v1',
  invoices:[{id:'inv_qa1',no:'INV-QA-9001',client:'Test Company 4',date:'2026-08-01',total:184500,currency:'SAR',status:'Issued'},
            {id:'inv_qa2',no:'INV-QA-9002',client:'Test Company 0',date:'2026-08-14',total:96250,currency:'SAR',status:'Paid'}],
  offers:[{id:'ofr_qa1',ref:'OFR-QA-31',subject:'MICE programme',client:'Test Company 4',value:427000,total:427000,currency:'SAR',owner:'QA Test Account',status:'Sent',date:'2026-08-10'}],
  bookings:[{id:'bkg_qa1',ref:'BKG-QA-77',client:'Test Company 0',pax:'QA Traveller',route:'RUH-DXB',total:31800,currency:'SAR',status:'Ticketed',owner:'QA Test Account'}],
  agency:{name_en:'QA Agency',name_ar:'وكالة تجريبية',cr:'QA-CR-0000',vat:'QA-VAT-0000',iban:'SA00QA0000000000000000',
          bank:'QA Test Bank',amadeusOffice:'QAOFFICE1',amadeusPin:'QAPIN1',amadeusWS:'QAWS0001',ceo:'QA Test Person',phone:'+966 11 000 0000'},
  audit:[{id:'a1',ts:Date.now(),user:'QA Test Account',action:'edit',entity:'business',entityId:'b0',detail:'stage → contacted'}]};
await api('/rest/v1/rpc/save_state_patch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch:SEED_PATCH})});

let A=await newPage();
await signIn(A.p,'/leads');                       // create the link while standing on LEADS
const shareBtn=await A.p.evaluate(()=>{ const b=document.getElementById('cl_share'); return b?{text:b.textContent.trim(),visible:!!b.offsetParent}:null; });
ok('header carries a "Share (view-only)" button', shareBtn && /view-only/i.test(shareBtn.text));
await A.p.evaluate(()=>{ window.__toasts=[]; if(typeof toast==='function'){const t=toast; window.toast=function(m){window.__toasts.push(String(m)); return t.apply(this,arguments);};} document.getElementById('cl_share').click(); });
await A.p.waitForTimeout(2500);
const promise=await A.p.evaluate(()=>({toasts:window.__toasts||[]}));
const links=await api('/rest/v1/share_links');
ok('clicking Share creates exactly one share_links row', Array.isArray(links)&&links.length===1);
const TOKEN=(links[0]||{}).token||'';
ok('token is 64 chars (two UUIDs, hyphens stripped — the live column default)', TOKEN.length===64);
ok('token alphabet is hex only — no short/guessable alphabet', /^[0-9a-f]{64}$/.test(TOKEN));
ok('token is minted SERVER-side, not by client Math.random()',
   !/Math\.random[\s\S]{0,200}token/i.test(fs.readFileSync(repoFile('js/10-events.js'),'utf8')));
ok('share_links row has scope "all" — never the page it was created from', (links[0]||{}).scope==='all');
ok('share_links row has NO expiry column (no expires_at / valid_until)',
   !('expires_at' in (links[0]||{})) && !('valid_until' in (links[0]||{})));
/* revoke: is there any way, anywhere in the app, to switch a link off again? */
const src=['js/10-events.js','index.html'].map(f=>fs.readFileSync(repoFile(f),'utf8')).join('\n');
const HAS_REVOKE=/share_links[\s\S]{0,160}(update|delete)\s*\(/i.test(src);
ok('KNOWN GAP recorded: no revoke/expire control exists in the UI', HAS_REVOKE===false);
if(!HAS_REVOKE) notes.push('share links cannot be revoked or listed from the app — only by hand in SQL');
/* what the toast PROMISES the holder can see */
const promiseText=(promise.toasts||[]).join(' ');
ok('the on-screen promise mentions view-only / cannot change', /view/i.test(promiseText)&&/not\s*edit|cannot|nothing can be changed/i.test(promiseText));
notes.push('promise shown to the sharer: '+JSON.stringify(promiseText.slice(0,140)));
await A.ctx.close();

/* WHO may mint one: the button is added with no role check at all (js/10 addShare), and the
   table's only RLS policy is `authenticated ALL true` — so a read-only account can create a
   permanent anonymous link to the whole workspace. Recorded, not changed: who may share is
   an owner decision, not a bug to fix quietly. */
await setRole('viewer');
let RO=await newPage();
await signIn(RO.p,'/today');
const roShare=await RO.p.evaluate(()=>{ const b=document.getElementById('cl_share');
  return {tier:window.__userTier, shown:!!(b&&b.offsetParent)}; });
if(roShare.shown){ await RO.p.evaluate(()=>document.getElementById('cl_share').click()); await RO.p.waitForTimeout(2500); }
const linksAfterViewer=await api('/rest/v1/share_links');
ok('OWNER DECISION recorded: a read-only account is offered the Share button', roShare.shown===true);
ok('OWNER DECISION recorded: a read-only account can actually mint a link', linksAfterViewer.length===2);
notes.push('read-only account tier when it minted a link: '+roShare.tier);
await RO.ctx.close(); await setRole('admin');

/* ══ PHASE 2 — ANONYMOUS holder opens the link (no session, real anon wall) ══════════ */
/* 2a. What the RPC hands over, measured at the wire — a bare fetch with NO credentials of any
      kind, only the token. This is the decisive evidence and it does not depend on which
      pages the UI happens to draw. */
await api('/rest/v1/rpc/save_state_patch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch:SEED_PATCH})});
process.env.MOCK_ANON_ENFORCE='1';
const wire=await api('/rest/v1/rpc/share_view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_token:TOKEN})});
const blob=(wire.data||{}).blob||{};
ok('a bare token with NO credentials returns ok:true from share_view', wire.ok===true);
ok('WIRE: the reply carries the WHOLE workspace blob, not one page',
   Object.keys(blob).length>10 && !!wire.data.businesses && !!wire.data.funnels && !!wire.data.events);
ok('WIRE: invoices, proposals and bookings are included in full',
   (blob.invoices||[]).length>0 && (blob.offers||[]).length>0 && (blob.bookings||[]).length>0);
ok('WIRE: invoice amounts are included (money reaches an anonymous holder)',
   (blob.invoices||[]).some(i=>Number(i.total)>0));
ok('WIRE: the agency profile is included — bank, IBAN and the Amadeus office/PIN',
   !!(blob.agency||{}).iban && !!(blob.agency||{}).amadeusPin && !!(blob.agency||{}).bank);
ok('WIRE: the who-did-what audit trail with staff names is included', (blob.audit||[]).length>0);
ok('WIRE: every non-archived company row is included', (wire.data.businesses||[]).length>0);
ok('WIRE: company rows carry CR/VAT, lifetime value and the named owner',
   Object.keys((wire.data.businesses||[])[0]||{}).includes('cr_vat')
   && Object.keys((wire.data.businesses||[])[0]||{}).includes('total_sar')
   && Object.keys((wire.data.businesses||[])[0]||{}).includes('assigned_to'));
ok('the scope column is returned but is always "all" — never a page or a record', wire.scope==='all');
notes.push('WIRE blob keys handed to an anonymous holder: '+JSON.stringify(Object.keys(blob).filter(k=>k[0]!=='_')));

/* 2b. and now the browser, with no session at all */
let B=await newPage();
await B.p.goto(BASE+'/s/'+TOKEN+'/dashboard',{waitUntil:'domcontentloaded',timeout:60000});
await B.p.waitForTimeout(6000);

const anon=await B.p.evaluate(()=>{
  const keys=Object.keys(localStorage||{});
  const sess=keys.filter(k=>/supabase|auth-token|sb-/.test(k));
  const D=(typeof DB!=='undefined'&&DB)?DB:(window.DB||{});   // DB is a plain global, not on window
  const biz=(D.businesses||[]);
  const money=v=>Array.isArray(v)?v.length:0;
  const txt=document.body.innerText||'';
  return {
    shareFlag:!!window.__isShareView,
    sessionKeys:sess,
    banner:!!document.getElementById('v38banner'),
    bannerText:(document.getElementById('v38banner')||{}).innerText||'',
    loginOverlay:[...document.querySelectorAll('body > div')].some(d=>d.style&&String(d.style.zIndex)==='2147483000'),
    counts:{businesses:biz.length,invoices:money(D.invoices),offers:money(D.offers),bookings:money(D.bookings),
            requests:money(D.requests),projects:money(D.projects),audit:money(D.audit),vendors:money(D.vendors),
            airlines:money(D.airlines),travelerProfiles:money(D.travelerProfiles),events:money(D.ksaEvents)},
    agencyKeys:Object.keys(D.agency||{}),
    settingsKeys:Object.keys(D.settings||{}),
    bizFields:Object.keys(biz[0]||{}),
    bizSample:biz[0]?{name:biz[0].name,owner:biz[0].assigned_to||biz[0].account_manager,cr:biz[0].cr_vat,total:biz[0].total_sar}:null,
    shareBtnGone:!document.getElementById('cl_share'),
    signOutGone:!document.getElementById('cl_signout'),
    navIds:[...document.querySelectorAll('.side a,.side button,nav a,nav button')].map(e=>(e.textContent||'').trim()).filter(Boolean).slice(0,40),
    bodyExcerpt:txt.slice(0,600)
  };
});
ok('share view opens with NO session in storage', anon.shareFlag && anon.sessionKeys.length===0);
ok('the login overlay never appears (anonymous really does get in)', !anon.loginOverlay);
ok('the view-only banner is shown in EN and AR', anon.banner && /View-only/.test(anon.bannerText) && /عرض فقط/.test(anon.bannerText));
/* where the token ends up: js/03's clean-URL layer replaces the address on the first render,
   so the token leaves the visible bar — but it was still in the request line, the browser
   history entry and any server access log before that happened. */
const urlNow=await B.p.evaluate(()=>location.pathname);
ok('the token is rewritten out of the address bar by the clean-URL layer', !urlNow.startsWith('/s/'));
notes.push('address after the share view settles: '+urlNow);
ok('Share and Sign-out controls are hidden from the anonymous holder', anon.shareBtnGone && anon.signOutGone);
ok('anonymous holder receives the WHOLE company workspace, not one page',
   anon.counts.businesses>0 && anon.agencyKeys.length>0);
/* the exposure itself — recorded as facts, each asserted so the report has evidence */
ok('EXPOSED: every non-archived company row (leads + clients)', anon.counts.businesses>0);
ok('EXPOSED: the invoices/proposals/bookings from the blob reach the browser too',
   anon.counts.invoices>0 && anon.counts.offers>0 && anon.counts.bookings>0);
ok('EXPOSED: the agency profile — bank, IBAN and the Amadeus office/PIN reach the browser',
   anon.agencyKeys.includes('iban') && anon.agencyKeys.includes('amadeusPin'));
ok('EXPOSED: the who-did-what audit trail with real staff names', anon.counts.audit>0);
notes.push('anon DB counts: '+JSON.stringify(anon.counts));
notes.push('anon agency keys: '+JSON.stringify(anon.agencyKeys));

/* 2c. FIX (2026-09-02): the guard must treat a share view as a decided "no", not as an
       unknown role, and no row-level edit control may be offered at all. Run on LEADS,
       the page that actually renders one Edit control per row. */
await B.p.goto(BASE+'/s/'+TOKEN+'/leads',{waitUntil:'domcontentloaded',timeout:60000});
await B.p.waitForTimeout(8000);
const rowsSeen=await B.p.evaluate(()=>document.querySelectorAll('#view tbody tr').length);
ok('the shared Leads page really is showing rows (so the check below can fail)', rowsSeen>0);
const guard=await B.p.evaluate(async ()=>{
  const vis=[...document.querySelectorAll('#view [onclick]')].filter(e=>e.offsetParent
    && /leadQuickEdit|editBusiness|editLead|convertToClient|setLeadStage/.test(e.getAttribute('onclick')||''));
  const out={canDo:(typeof canDo==='function'?canDo('leads'):null), editControls:vis.length, box:null, quickEdit:false};
  try{ if(typeof leadQuickEdit==='function') leadQuickEdit('b0'); }catch(_){}
  await new Promise(r=>setTimeout(r,900));
  const bx=document.getElementById('v70box');
  out.box=bx?bx.innerText.replace(/\s+/g,' ').slice(0,160):null;
  out.quickEdit=!!document.querySelector('#modal.show, .modal.show');
  return out;
});
/* Export is NOT a write, so the guard leaves it alone — but it lets a link holder walk off
   with the whole lead/client list as a file. Recorded as current behaviour, deliberately not
   changed: removing it makes the share feature less useful and is the owner's call. */
const exports_=await B.p.evaluate(()=>[...document.querySelectorAll('#view button,.tools button')]
  .filter(e=>e.offsetParent && /export/i.test(e.textContent||'')).map(e=>(e.textContent||'').trim()));
ok('OWNER DECISION recorded: export controls are offered to an anonymous holder', exports_.length>0);
notes.push('export controls offered anonymously: '+JSON.stringify(exports_));
ok('FIX: canDo() answers no for every write in a shared view', guard.canDo===false);
ok('FIX: no row carries an Edit control in a shared view', guard.editControls===0);
ok('FIX: calling the editor directly is refused with a view-only message, not an edit form',
   !guard.quickEdit && /view-only link/i.test(guard.box||''));
/* the house pattern is whole-string Arabic chosen at render time, so parity is proved by
   flipping the language with the app's own button and asking again */
const guardAr=await B.p.evaluate(async ()=>{
  const b=document.getElementById('v70box'); if(b)b.remove();
  try{ document.getElementById('langBtn').click(); }catch(_){}
  await new Promise(r=>setTimeout(r,1200));
  try{ if(typeof leadQuickEdit==='function') leadQuickEdit('b0'); }catch(_){}
  await new Promise(r=>setTimeout(r,900));
  const bx=document.getElementById('v70box');
  const out={lang:(typeof LANG!=='undefined'?LANG:null), box:bx?bx.innerText.replace(/\s+/g,' ').slice(0,160):null};
  if(bx)bx.remove();
  try{ document.getElementById('langBtn').click(); }catch(_){}
  await new Promise(r=>setTimeout(r,900));
  return out;
});
ok('FIX: the same refusal appears in Arabic when the app is in Arabic',
   guardAr.lang==='ar' && /رابط للعرض فقط/.test(guardAr.box||''));
await B.p.evaluate(()=>{ const b=document.getElementById('v70box'); if(b)b.remove(); });

/* ══ PHASE 3 — every write path an anonymous holder can reach must be refused ════════ */
const rpcBefore=(await api('/__rpclog')).length;
const writes=await B.p.evaluate(async ()=>{
  const out={saveIsStub:false,clicked:0,attempts:[]};
  try{ out.saveIsStub = typeof save==='function' && /^\s*function\s*\(\s*\)\s*\{\s*\}\s*$/.test(String(save)); }catch(_){}
  try{ if(typeof save==='function') save(); }catch(e){ out.attempts.push('save() threw: '+e.message); }
  try{ if(typeof silentSave==='function') silentSave(save); }catch(_){}
  /* click every enabled, visible control the anonymous page still offers */
  const btns=[...document.querySelectorAll('#view button, .tools button, .card button')]
    .filter(x=>!x.disabled && x.offsetParent && !/close|إغلاق/i.test(x.textContent||''));
  for(const x of btns.slice(0,25)){ try{ x.click(); out.clicked++; }catch(_){} }
  /* and the page's own supabase client, driven straight at the mutating endpoints */
  const c=window.supabase&&window.supabase.createClient
    ? window.supabase.createClient('https://vkxoeeoauexyfpzqufqd.supabase.co','sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr') : null;
  if(c){
    for(const [label,fn] of [
      ['save_state_patch', ()=>c.rpc('save_state_patch',{patch:{__hacked:true}})],
      ['save_state',       ()=>c.rpc('save_state',{payload:{__hacked:true}})],
      ['undo_change',      ()=>c.rpc('undo_change',{p_id:1})],
      ['businesses.update',()=>c.from('businesses').update({name:'__hacked'}).eq('id','b0').select()],
      ['businesses.insert',()=>c.from('businesses').insert({id:'__hacked',name:'__hacked'}).select()],
      ['share_links.read', ()=>c.from('share_links').select('token')],
      ['app_users.read',   ()=>c.from('app_users').select('email,role')],
      ['finance_invoices.read',()=>c.from('finance_invoices').select('*')],
    ]){
      try{ const r=await fn(); out.attempts.push({label,error:r.error?String(r.error.message||r.error.code):null,rows:Array.isArray(r.data)?r.data.length:(r.data?1:0)}); }
      catch(e){ out.attempts.push({label,error:String(e.message||e),rows:0}); }
    }
  }
  return out;
});
await B.p.waitForTimeout(1500);
const rpcAfter=(await api('/__rpclog')).slice(rpcBefore);
process.env.MOCK_ANON_ENFORCE='0';
const stateAfter=(await api('/rest/v1/app_state'))[0]||{};
process.env.MOCK_ANON_ENFORCE='1';
const att=Object.fromEntries((writes.attempts||[]).filter(a=>a&&a.label).map(a=>[a.label,a]));
ok('save() in the shared view is a no-op stub', writes.saveIsStub);
ok('save_state_patch from the anonymous view is REFUSED', !!(att['save_state_patch']||{}).error);
ok('save_state from the anonymous view is REFUSED', !!(att['save_state']||{}).error);
ok('undo_change from the anonymous view is REFUSED', !!(att['undo_change']||{}).error);
ok('businesses UPDATE returns zero rows (RLS refusal)', ((att['businesses.update']||{}).rows||0)===0);
ok('businesses INSERT returns zero rows (RLS refusal)', ((att['businesses.insert']||{}).rows||0)===0);
ok('anonymous holder cannot read share_links (cannot harvest other tokens)', ((att['share_links.read']||{}).rows||0)===0);
ok('anonymous holder cannot read app_users (no staff emails/roles table)', ((att['app_users.read']||{}).rows||0)===0);
ok('anonymous holder cannot read finance_invoices directly', ((att['finance_invoices.read']||{}).rows||0)===0);
ok('the workspace blob is byte-for-byte unchanged after every write attempt',
   (stateAfter.data||{}).__canary==='v1' && !('__hacked' in (stateAfter.data||{})));
ok('no save_state / save_state_patch RPC ever succeeded from the shared view',
   rpcAfter.every(r=>!/^save_state/.test(r.fn)||r.refused));
notes.push('anonymous write attempts: '+JSON.stringify(writes.attempts.filter(a=>a&&a.label)));

/* ══ PHASE 4 — SCOPE: edit the section in the URL and see what else opens ════════════ */
const SECTIONS=['leads','clients','invoices','bookings','offers','reports','events','tickets'];
const reached=[];
for(const s of SECTIONS){
  await B.p.goto(BASE+'/s/'+TOKEN+'/'+s,{waitUntil:'domcontentloaded',timeout:60000});
  await B.p.waitForTimeout(3500);
  const r=await B.p.evaluate(()=>({cur:(typeof current!=='undefined'?current:null),
    rows:document.querySelectorAll('#view tbody tr, #view .lead, #view .row').length,
    txt:(document.getElementById('view')||{}).innerText||''}));
  reached.push({s,cur:r.cur,rows:r.rows,money:/\b\d{1,3}(,\d{3})+(\.\d+)?\b/.test(r.txt),sar:/SAR|ر\.س|ريال/.test(r.txt)});
}
const opened=reached.filter(x=>x.cur===x.s&&x.rows>0);
const bounced=reached.filter(x=>x.cur!==x.s);
/* The link is scoped to nothing: the section is a client-side hint, and the token opens any of
   them. What actually contains it is js/52's employee page floor (today/leads/clients/finance),
   which applies because a share view has no role — an ACCIDENT, not a share rule, and silent. */
ok('SCOPE: the section in the URL is not enforced by the token — other sections open',
   opened.length>=2 && opened.some(x=>x.s==='clients'));
ok('SCOPE: sections outside the employee floor are silently redirected to Today',
   bounced.length>=4 && bounced.every(x=>x.cur==='today'));
ok('SCOPE: the redirect says nothing to the holder (no explanation card)',
   await B.p.evaluate(()=>!document.getElementById('v64-access-denied')));
notes.push('sections reached anonymously: '+JSON.stringify(reached));
/* Finance is the one page that refuses */
await B.p.goto(BASE+'/s/'+TOKEN+'/finance',{waitUntil:'domcontentloaded',timeout:60000});
await B.p.waitForTimeout(3500);
const fin=await B.p.evaluate(()=>{ try{ current='finance'; render(); }catch(e){ return {err:String(e.message||e)}; }
  return new Promise(r=>setTimeout(()=>r({txt:(document.getElementById('view')||{}).innerText||'',
    canFinView:(typeof canFinView==='function'?canFinView():null)}),1500)); });
ok('canFinView() is false in a shared view', fin.canFinView===false);
ok('Finance page itself refuses in a shared view', /not available in shared|غير متاح/i.test(fin.txt||''));
notes.push('finance-in-share excerpt: '+JSON.stringify(String(fin.txt||fin.err||'').slice(0,180)));
/* a wrong / short / truncated token must be refused, not fall back to the app */
for(const [label,tok] of [['short token','abc'],['wrong token','0'.repeat(64)],['token with one char changed', TOKEN.slice(0,63)+(TOKEN[63]==='a'?'b':'a')]]){
  await B.p.goto(BASE+'/s/'+tok+'/dashboard',{waitUntil:'domcontentloaded',timeout:60000});
  await B.p.waitForTimeout(3000);
  const t=await B.p.evaluate(()=>document.body.innerText||'');
  ok('rejected: '+label, /not valid any more|Sign in|تسجيل الدخول/i.test(t) && !/Test Company/.test(t));
}
await B.ctx.close();
process.env.MOCK_ANON_ENFORCE='0';

/* ══ PHASE 5 — Settings ▸ Team & Access ═════════════════════════════════════════════ */
/* 5a — a VIEWER must not be able to reach it */
await setRole('viewer');
let V=await newPage();
await signIn(V.p,'/settings');
await V.p.waitForTimeout(3000);
const viewer=await V.p.evaluate(()=>({card:!!document.querySelector('.v48-card'),team:!!document.getElementById('cl_team'),
  team76:!!document.getElementById('v76team'),acc:!!document.getElementById('v41acc'),tier:window.__userTier}));
ok('viewer: no Team & Access card on Settings', !viewer.card);
ok('viewer: no Team button in the header', !viewer.team && !viewer.team76);
ok('viewer: no Access button in the header', !viewer.acc);
await V.ctx.close();

/* 5b — a MANAGER may open it, but may never hand out admin */
await setRole('manager');
let M=await newPage();
await signIn(M.p,'/settings');
await M.p.waitForTimeout(2500);
const mgrEntry=await M.p.evaluate(()=>({card:!!document.querySelector('.v48-card'),
  team:!!(document.getElementById('cl_team')||document.getElementById('v76team'))}));
ok('manager: Team & Access is reachable (card or header button)', mgrEntry.card||mgrEntry.team);
await M.p.evaluate(()=>{ v48Users(); });
await M.p.waitForTimeout(4500);
const mgr=await M.p.evaluate(()=>{
  const pick=s=>[...document.querySelectorAll(s)].map(sel=>[...sel.options].map(o=>({v:o.value,d:o.disabled})));
  return {add:pick('#v48r'),rows:pick('select[data-role]'),listed:document.querySelectorAll('select[data-role]').length};
});
const flat=a=>[].concat(...a);
ok('manager: roster actually rendered (so the check below is meaningful)', mgr.listed>0);
ok('manager: "Add a teammate" offers NO selectable admin option',
   flat(mgr.add).filter(o=>o.v==='admin'&&!o.d).length===0);
ok('manager: no per-person picker offers a selectable admin option',
   flat(mgr.rows).filter(o=>o.v==='admin'&&!o.d).length===0);

/* 5c — the password minimum (already fixed by the lead: form must enforce 10, not 8).
   alert() is captured IN the page — Playwright's dialog event races the click and swallowed
   several of these on the first run. */
const trySubmit=(page,name,email,pw)=>page.evaluate(async v=>{
  window.__alerts=[]; const a0=window.alert; window.alert=m=>{window.__alerts.push(String(m));};
  document.getElementById('v48n').value=v.name; document.getElementById('v48e').value=v.email;
  document.getElementById('v48pw').value=v.pw;
  document.getElementById('v48create').click();
  await new Promise(r=>setTimeout(r,900));
  const out=window.__alerts.slice(); window.alert=a0; return out;
},{name,email,pw});

let al=await trySubmit(M.p,'QA Person','qa.person@directksa.com','123456789');   // 9 chars
ok('9-character password is refused by the create form', al.some(d=>/at least 10/.test(d)));
ok('the refusal names the SHARED minimum (10), never a second hardcoded number',
   al.some(d=>/\b10\b/.test(d)) && !al.some(d=>/at least 8\b/.test(d)));
ok('MIN_PW is one shared constant, read not re-declared', await M.p.evaluate(()=>window.MIN_PW===10));
al=await trySubmit(M.p,'QA Person','qa.person@directksa.com','1234567890');      // 10 chars
ok('a 10-character password passes the form', al.length===0);

/* 5d — email shape */
const badEmails=['notanemail','a@','@directksa.com','two words@directksa.com','qa@directksa'];
const emailVerdict=[];
for(const e of badEmails){
  const a=await trySubmit(M.p,'QA',e,'');
  emailVerdict.push({e,refused:a.some(d=>/valid email|بريدًا صحيحًا/i.test(d))});
}
ok('every malformed email is refused by the create form: '+JSON.stringify(emailVerdict.filter(x=>!x.refused).map(x=>x.e)),
   emailVerdict.every(x=>x.refused));
const goodEmail=await trySubmit(M.p,'QA Person','qa.person@directksa.com','');
ok('a well-formed email is still accepted (the check did not over-tighten)', goodEmail.length===0);

/* 5e — switching a person off takes effect, and the screen agrees */
const before=await api('/functions/v1/admin-users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list'})});
const target=(before.users||[]).find(u=>u.id!==UID&&u.active!==false);
await M.p.evaluate(id=>{ const b=document.querySelector('[data-tog="'+id+'"]'); if(b)b.click(); }, target.id);
await M.p.waitForTimeout(2500);
const after=await api('/functions/v1/admin-users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list'})});
const nowOff=(after.users||[]).find(u=>u.id===target.id);
ok('Switch off actually flips the person off in the database', nowOff && nowOff.active===false);
const redrawn=await M.p.evaluate(id=>{ const b=document.querySelector('[data-tog="'+id+'"]');
  return {label:b?b.textContent.trim():null, offTag:/off|موقوف/i.test((b&&b.closest('div').parentElement.parentElement.innerText)||'')}; }, target.id);
ok('the roster redraws after Switch off — the button now reads "Switch on"', /switch on|تفعيل/i.test(redrawn.label||''));

/* 5f — a REFUSED action must say what happened and put the screen back, never look like it
        worked. Driven through the server's own self-lockout guard ("You cannot change your
        own role." / "You cannot switch off your own access.") — the exact wording deployed. */
const selfRole=await M.p.evaluate(async id=>{
  window.__alerts=[]; const a0=window.alert; window.alert=m=>{window.__alerts.push(String(m));};
  const sel=document.querySelector('select[data-role="'+id+'"]');
  if(!sel) return {missing:true};
  sel.value='team_member'; sel.dispatchEvent(new Event('change'));
  await new Promise(r=>setTimeout(r,2600));
  const back=document.querySelector('select[data-role="'+id+'"]');
  const out={alerts:window.__alerts.slice(),valueNow:back?back.value:null}; window.alert=a0; return out;
}, UID);
ok('demoting YOURSELF is refused, and the refusal says why',
   (selfRole.alerts||[]).some(a=>/your own role/i.test(a)));
ok('after that refusal the roster is redrawn — the level does NOT sit showing the change',
   selfRole.valueNow==='manager');
const selfOff=await M.p.evaluate(async id=>{
  window.__alerts=[]; const a0=window.alert; window.alert=m=>{window.__alerts.push(String(m));};
  const b=document.querySelector('[data-tog="'+id+'"]'); if(!b) return {missing:true};
  b.click(); await new Promise(r=>setTimeout(r,2200));
  const out={alerts:window.__alerts.slice()}; window.alert=a0; return out;
}, UID);
ok('switching YOURSELF off is refused, and the refusal says why',
   (selfOff.alerts||[]).some(a=>/your own access/i.test(a)));
await M.ctx.close();
await setRole('admin');

/* ── report ─────────────────────────────────────────────────────────────────────────── */
await b.close(); srv.close?.();
ok('no JS errors anywhere in the run', errors.length===0);
let fail=0; for(const [n,v] of checks){ console.log((v?'PASS':'FAIL')+' · '+n); if(!v)fail++; }
console.log('\n--- notes ---'); notes.forEach(n=>console.log('· '+n));
if(errors.length) console.log('\nJS errors:', errors.slice(0,8));
console.log('\n'+(checks.length-fail)+'/'+checks.length+' checks passed');
process.exit(fail?1:0);
