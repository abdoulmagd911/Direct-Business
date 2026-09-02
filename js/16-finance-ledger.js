/* ===== Finance ledger core — one chapter, one file (Finance sitting F3 — 2026-08-16) =====

   This is the Finance page itself (was js/16-v42). It draws all six tabs — Performance,
   Clients & collections, Ledger, Report Builder, Expenses and Import — loads the invoice
   rows out of finance_invoices, and owns the money maths every other finance chapter
   decorates.

   MUST STAY AT SLOT 16. It defines FIN, fc(), canFinEdit() and canFinView(), and three
   later chapters read them: 25 (reporting add-ons), 41 (money in) and 45 (expenses).
   The renderFinance wrap chain is 16 → 25 → 41 → 45; move this file down the list and the
   chapters above it find nothing to wrap.

   Nothing in the code below was changed in F3 — only the file's name and this comment.
   The 713 lines that follow are the same bytes that were serving the live Finance page.
   ===== v42 layer: FINANCE — master invoice ledger + report builder + import ===== */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sbF=null;
function fc(){ if(!sbF&&window.supabase){try{sbF=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sbF; }
function escF(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function isArF(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||(document.documentElement.getAttribute('data-lang')==='ar');}catch(_){return false;}}
function money(n){n=Number(n)||0;return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
/* Table views show whole numbers (owner 2026-08-12); the exact value with fractions stays in storage, the invoice card and CSV exports. */
function money0(n){n=Number(n)||0;return Math.round(n).toLocaleString('en-US');}
function moneyS(n){n=Number(n)||0;if(Math.abs(n)>=1e6)return (n/1e6).toFixed(2)+'M';if(Math.abs(n)>=1e3)return (n/1e3).toFixed(1)+'K';return n.toFixed(0);}
function canFinEdit(){return !window.__isShareView && (window.__userTier==='admin'||window.__userTier==='manager');}
function canFinView(){return !window.__isShareView;}
/* expose the finance client + permission checks so later layers (e.g. the finance↔client
   mapping in v53) can reach them from their own script block */
try{ window.fc=fc; window.canFinEdit=canFinEdit; window.canFinView=canFinView; }catch(_){}

var FIN={tab:'overview',rows:null,loading:false,showDeleted:false,
  f:{q:'',quarter:'all',month:'all',service:'all',client:'all',status:'verified_paid'},
  rb:{g1:'__client',g2:'',metrics:{revenue_sar:true,cost_sar:true,profit_sar:true},verifiedOnly:true,quarter:'all'}};

try{
  if(typeof TITLES==='object')TITLES.finance=['Finance','Master invoice ledger \u00b7 report builder \u00b7 audited H1 2026 data'];
  if(typeof I18N==='object'){I18N.en&&(I18N.en.finance='Finance');I18N.ar&&(I18N.ar.finance='\u0627\u0644\u0645\u0627\u0644\u064a\u0629');}
  if(typeof V21_STRINGS_AR==='object'){V21_STRINGS_AR['Finance']='\u0627\u0644\u0645\u0627\u0644\u064a\u0629';V21_STRINGS_AR['Report Builder']='\u0645\u0646\u0634\u0626 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631';V21_STRINGS_AR['Ledger']='\u0627\u0644\u0633\u062c\u0644';V21_STRINGS_AR['Overview']='\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629';V21_STRINGS_AR['Import']='\u0627\u0633\u062a\u064a\u0631\u0627\u062f';}
  if(typeof VIEWS!=='undefined'&&VIEWS.push&&!VIEWS.some(function(v){return v.id==='finance';})){
    var ic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    var ix=VIEWS.findIndex(function(v){return v.id==='events';});
    VIEWS.splice(ix>=0?ix+1:VIEWS.length,0,{id:'finance',label:'Finance',ic:ic,primary:true});
  }
}catch(e){console.warn('v42 nav',e);}

function finLoad(cb){
  if(FIN.loading)return; FIN.loading=true;
  var c=fc(); if(!c){FIN.loading=false;return;}
  // The API returns at most 1000 rows per request no matter what limit() asks for,
  // so the ledger MUST page — one big limit() silently drops rows past 1000.
  var _all=[];
  (function _page(from){
    c.from('finance_invoices').select('*').order('invoice_date',{ascending:false}).order('id',{ascending:true}).range(from,from+999).then(function(r){
      if(r.error){finGot(r);return;}
      _all=_all.concat(r.data||[]);
      if((r.data||[]).length===1000)_page(from+1000);
      else finGot({data:_all,error:null});
    });
  })(0);
  function finGot(r){
    if(r.error){console.warn('finance load',r.error);FIN.rows=[];FIN.loadErr=r.error.message;}
    else {FIN.rows=r.data||[];FIN.loadErr=null;}
    // Load the client↔finance links (one row per finance client_group → a real client, or
    // is_client=false for individuals). This is the join key so a client's money reflects by
    // ID, not by fuzzy name. Small table; build lookup maps once loaded.
    c.from('finance_client_links').select('*').then(function(lr){
      FIN.loading=false;
      FIN.links=(lr&&!lr.error&&lr.data)?lr.data:[];
      FIN.linkByGroup={}; FIN.groupsByBiz={};
      FIN.links.forEach(function(l){
        FIN.linkByGroup[l.client_group]=l;
        if(l.business_id){ (FIN.groupsByBiz[l.business_id]=FIN.groupsByBiz[l.business_id]||[]).push(l.client_group); }
      });
      c.from('finance_targets').select('*').then(function(tr){
        FIN.targets=(tr&&!tr.error&&tr.data)?tr.data:[];
        // Promo-code registry (revenue way #4): per-code totals mirrored from Direct Payments.
        c.from('promo_codes').select('*').order('total_sales_sar',{ascending:false}).then(function(pr){
          FIN.promos=(pr&&!pr.error&&pr.data)?pr.data:[];
          if(cb)cb();
          try{if(current==='finance')render();}catch(_){}
        });
      });
    });
  }
}
try{window.FIN=FIN;window.finLoad=finLoad;}catch(_){}  // expose for the Customer-360 finance snapshot (v29)
// Belt-and-suspenders, 2026-08-23: the exclusion list (js/62) was checked at IMPORT time
// only. Ten Takamol invoices entered finance_invoices anyway — not through either
// importer's exclusion check, but by a path outside this app entirely — and rendered in
// every total until caught and removed by hand. A standing exclusion must hold no matter
// how a row arrived, so live() — the one chokepoint every total/export in this file reads
// through — re-checks client_group/customer_raw_name against the exclusion list on every
// call, not just once at load. Filtering here (not in the load callback) also survives the
// real race that a load-time-only filter did not: on a fresh page load, finance_invoices
// can finish loading before DB.settings.financeExclusions does, so a filter that only runs
// once inside the load callback can silently see an empty exclusion list and let a row
// through on that first render; live() re-evaluates on every call, by which point settings
// have always finished loading. docs/DECISIONS.md: "A standing exclusion is not satisfied
// by loading the data and labelling it."
function live(){
  var rows=(FIN.rows||[]).filter(function(r){return !r.deleted_at;});
  if(typeof window.finExclusionCheck==='function'){
    rows=rows.filter(function(r){return !(finExclusionCheck(r.client_group)||finExclusionCheck(r.customer_raw_name));});
  }
  return rows;
}
function verified(){return live().filter(function(r){return r.integrity_status==='verified_paid';});}

/* --- Period structure (owner-directed 2026-08-11) ------------------------------------
   Finance is read monthly / quarterly / half-yearly / annually. ONE period state drives
   every Overview number; nothing is stored per period — all sums stay derived live from
   the raw rows (the storage doctrine). part: all | Q1..Q4 | H1 | H2 | M:<MonthName>. */
FIN.p=FIN.p||{year:'all',part:'all',sector:'all'};
FIN.p.cmp=FIN.p.cmp||'none'; // blueprint step 5 (2026-08-27): compare-to mode, in-memory only — same storage doctrine as the rest of FIN.p, nothing per-period is ever saved.
function finYearOf(r){return r.year||(r.invoice_date?+String(r.invoice_date).slice(0,4):null);}
function finPeriodMatch(r,p){
  if(p.year!=='all'&&String(finYearOf(r))!==String(p.year))return false;
  var pt=p.part||'all';
  if(pt==='all')return true;
  if(pt==='H1')return r.quarter==='Q1'||r.quarter==='Q2';
  if(pt==='H2')return r.quarter==='Q3'||r.quarter==='Q4';
  if(/^Q[1-4]$/.test(pt))return r.quarter===pt;
  if(pt.indexOf('M:')===0)return r.month===pt.slice(2);
  return true;
}
function finInPeriod(r){
  return finPeriodMatch(r,FIN.p||{year:'all',part:'all'});
}
/* Compare-to (blueprint step 5, 2026-08-27): "previous period" and "same period last year",
   the two the owner actually asked for — "pick a period" is left for a later pass rather than
   guessed at. Needs a concrete year to shift from, so it's a no-op (returns null, control hides
   its result) when the year filter is 'all'; "the year before all years" isn't a period. */
function finCompPeriodOf(mode){
  var p=FIN.p||{}; if(!p.year||p.year==='all')return null;
  var y=+p.year, pt=p.part||'all';
  if(mode==='yoy')return {year:y-1,part:pt,sector:p.sector};
  if(mode==='prev'){
    if(pt==='all')return {year:y-1,part:'all',sector:p.sector};
    if(pt==='H1')return {year:y-1,part:'H2',sector:p.sector};
    if(pt==='H2')return {year:y,part:'H1',sector:p.sector};
    if(/^Q[1-4]$/.test(pt)){var qn=+pt.slice(1);return qn===1?{year:y-1,part:'Q4',sector:p.sector}:{year:y,part:'Q'+(qn-1),sector:p.sector};}
    if(pt.indexOf('M:')===0){
      var mname=pt.slice(2),idx=MOI[mname]; if(!idx)return null;
      var pm=idx===1?12:idx-1, py=idx===1?y-1:y;
      var pname=Object.keys(MOI).filter(function(k){return MOI[k]===pm;})[0];
      return pname?{year:py,part:'M:'+pname,sector:p.sector}:null;
    }
  }
  return null;
}
function finCompLabel(p){
  if(!p)return '';
  var ar=isArF();
  var pt=(p.part==='all')?(ar?'كامل الفترة':'Full period'):(p.part.indexOf('M:')===0?(ar?(MO_AR[p.part.slice(2)]||p.part.slice(2)):p.part.slice(2)):p.part);
  return p.year+' · '+pt;
}
/* Same aggregate a comparison period needs — revenue/cost/profit off verified-paid rows (the
   Key indicators basis), plus the incomplete-cost count so the comparison can carry the same
   A7 warning the current period already shows. Never touches FIN.p itself, so building a
   comparison can't disturb what's actually on screen. */
function finPeriodTotals(p){
  var sec=(p&&p.sector)||'all';
  var rows=verified().filter(function(r){return finPeriodMatch(r,p)&&(sec==='all'||finSectorOf(r)===sec);});
  var t={rev:0,cost:0,prof:0,n:rows.length,noCost:0};
  rows.forEach(function(r){t.rev+=+r.revenue_sar||0;t.cost+=+r.cost_sar||0;t.prof+=+r.profit_sar||0;if((+r.cost_sar||0)===0)t.noCost++;});
  return t;
}
window.finCmp=function(v){FIN.p.cmp=v;render();};
/* Sector filter rides the same scope check every tab already uses, so picking a sector
   filters KPIs, charts, clients, ledger and exports alike — scope is a page property. */
var _finInPeriodBase=finInPeriod;
finInPeriod=function(r){
  if(!_finInPeriodBase(r))return false;
  var sec=(FIN.p&&FIN.p.sector)||'all';
  return sec==='all'||finSectorOf(r)===sec;
};
var MO_AR={January:'يناير',February:'فبراير',March:'مارس',April:'أبريل',May:'مايو',June:'يونيو',July:'يوليو',August:'أغسطس',September:'سبتمبر',October:'أكتوبر',November:'نوفمبر',December:'ديسمبر'};
function finPeriodLabel(){
  var p=FIN.p,ar=isArF();
  var y=(p.year==='all')?(ar?'كل السنوات':'All years'):p.year;
  var pt=(p.part==='all')?(ar?'كامل الفترة':'Full period')
    :(p.part.indexOf('M:')===0?(ar?(MO_AR[p.part.slice(2)]||p.part.slice(2)):p.part.slice(2)):p.part);
  return y+' · '+pt;
}
window.finPY=function(v){FIN.p.year=v;render();};
window.finPP=function(v){FIN.p.part=v;render();};
window.finSetTargets=function(y){try{
  var t=(FIN.targets||[]).find(function(x){return +x.year===+y;})||{};
  var e=prompt(isArF()?('الإيراد المتوقع لسنة '+y+' (ريال):'):('Expected revenue for '+y+' (SAR):'), t.expected_sar||''); if(e===null)return;
  var cf=prompt(isArF()?('الإيراد المؤكد (عقود موقعة) لسنة '+y+':'):('Confirmed revenue (signed contracts) for '+y+' (SAR):'), t.confirmed_sar||''); if(cf===null)return;
  var num=function(s){return parseFloat(String(s).replace(/[^0-9.]/g,''))||0;};
  var c=fc(); if(!c)return;
  c.from('finance_targets').upsert({year:+y,expected_sar:num(e),confirmed_sar:num(cf),updated_at:new Date().toISOString(),updated_by:(window.meName?meName():'')},{onConflict:'year'}).then(function(r){
    if(r.error){alert((isArF()?'تعذر الحفظ: ':'Could not save: ')+r.error.message);return;}
    var i=(FIN.targets||[]).findIndex(function(x){return +x.year===+y;});
    var row={year:+y,expected_sar:num(e),confirmed_sar:num(cf)};
    if(i>=0)FIN.targets[i]=row;else (FIN.targets=FIN.targets||[]).push(row);
    render();
  });
}catch(e){console.warn('finSetTargets',e);}};
/* Ledger's own row-level export. Named finLedgerCSV (not finCSV) on purpose — this file also
   defines the Report Builder's export further down, and until 2026-08-20 both were called
   window.finCSV, so the second definition silently replaced this one and the Ledger's own
   "Excel (CSV)" button either did nothing or downloaded the Report Builder's grouped summary
   instead of the invoice rows on screen. Two different jobs, two different names. */
window.finLedgerCSV=function(){
  var L=FIN._csvRows||[]; if(!L.length){alert(isArF()?'لا صفوف للتصدير':'No rows to export');return;}
  var cols=['invoice_date','invoice_no','zatca_dpin','client_group','service_type','products','origin','proposal_ref','month','quarter','year','total_incl_vat_sar','revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','integrity_status'];
  var _hdr=cols.map(function(c){return c==='total_incl_vat_sar'?'invoice_total_sar':c;});
  var csv='\ufeff'+_hdr.join(',')+'\n'+L.map(function(r){return cols.map(function(c){var v=csvGuard(r[c]);return '"'+v.replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-finance-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};
try{window.finInPeriod=finInPeriod;window.finPeriodLabel=finPeriodLabel;}catch(_){}

/* --- Canonical client rollup (v54) ---------------------------------------------------
   A finance invoice carries a raw `client_group` name (however it was typed in Direct
   Payments). `finance_client_links` maps each group to ONE real client (business_id), to
   Individuals, or to nothing yet. finCanon() collapses every group that points at the same
   client into a single canonical row, so the client reports stay correct after two spellings
   of the same company are linked (e.g. "Ma'aden" + "Maaden Co" become one client). The
   row-level Ledger deliberately stays on the raw group — it is an invoice list, not a rollup.
   Cache is rebuilt each finance render (clearFinCanon) since a mapping edit reloads FIN. */
var _finCanonCache={};
/* Freeze found 2026-08-22 (owner reproduced twice): _finBizName did an O(businesses.length)
   linear scan, called once per invoice row via finCanon() — O(rows x businesses) on every
   Clients/Overview/Report-Builder finance render. Indexed once per cache lifetime instead,
   invalidated on the exact same clearFinCanon() calls the existing _finCanonCache already
   relies on, so this can never go stale independently of that cache. */
var _finBizNameIndex=null;
/* Sector, 2026-08-26 — blueprint step 4, built the M14 way: DERIVED AT RENDER from data the
   app already holds, no schema change, nothing stored per invoice. payment_terms='Tender' on
   the linked business makes the invoice a Tender; service_type 'School Commission' makes it
   Academies; everything else is B2B. The alias map cannot hide this: sector reads the raw
   client_group's LINK (FIN.linkByGroup), which survives display grouping untouched. When the
   653-invoice backfill lands with Corporate / codes / incentives, this one function is the
   single place that grows. */
var _finBizTermsIndex=null;
function _finBizTerms(uuid){
  try{
    if(!_finBizTermsIndex){
      _finBizTermsIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizTermsIndex[uu]=list[i].paymentTerms||null;
      }
    }
    return _finBizTermsIndex[uuid]||null;
  }catch(_){ return null; }
}
function finSectorOf(r){
  if(String(r.service_type||'')==='School Commission')return 'academies';
  var l=(FIN.linkByGroup||{})[r.client_group];
  if(l&&l.business_id&&/tender/i.test(String(_finBizTerms(l.business_id)||'')))return 'tenders';
  return 'b2b';
}
var SECTORS=[['all',['All sectors','كل القطاعات']],['tenders',['Tenders','مناقصات']],['b2b',['B2B','أعمال']],['academies',['Academies','أكاديميات']]];
window.finPS=function(v){ FIN.p.sector=v; clearFinCanon(); if(typeof render==='function')render(); };
var _finBizDirectIdIndex=null;
function clearFinCanon(){ _finCanonCache={}; _finBizNameIndex=null; _finBizDirectIdIndex=null; _finBizTermsIndex=null; }
function _finBizName(uuid){
  try{
    if(!_finBizNameIndex){
      _finBizNameIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizNameIndex[uu]=list[i].name||null;
      }
    }
    return Object.prototype.hasOwnProperty.call(_finBizNameIndex,uuid)?_finBizNameIndex[uuid]:null;
  }catch(_){return null;}
}
// Same lazily-built, clearFinCanon()-invalidated index as _finBizName, for the owner's
// "client ID beside the client name" request (2026-08-23) — businesses.direct_client_id is
// the Direct Payments portal id (small integers, e.g. 1, 46, ...). Not every client has one yet.
function _finBizDirectId(uuid){
  try{
    if(!_finBizDirectIdIndex){
      _finBizDirectIdIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizDirectIdIndex[uu]=list[i].directClientId||null;
      }
    }
    return Object.prototype.hasOwnProperty.call(_finBizDirectIdIndex,uuid)?_finBizDirectIdIndex[uuid]:null;
  }catch(_){return null;}
}
function finCanon(clientGroup){
  var ck=(clientGroup==null?'':clientGroup);
  if(_finCanonCache[ck]!==undefined)return _finCanonCache[ck];
  var disp=(ck==='')?'—':ck, res;
  // M14, 2026-08-25 — client name aliases (js/62 Part 1.5) are checked FIRST and win outright:
  // an admin-confirmed canonical name (e.g. "Madar - Smart Systems" for "Madar" + its Arabic
  // spelling) always overrides whatever the linked business's own name field says. Consulted
  // live on every resolution, not applied once — a future import carrying the same raw
  // client_group text groups correctly with zero extra work, exactly like finExclusionCheck().
  var g=(typeof window.finGroupCheck==='function')?window.finGroupCheck(clientGroup):null;
  if(g){
    res={key:'grp:'+g.id,name:g.canonicalName,linked:true,grouped:true};
  }else{
  var l=(FIN.linkByGroup||{})[clientGroup];
  if(l&&l.is_client===false){
    res={key:'__indiv__',name:isArF()?'أفراد / ليس عميلاً':'Individuals / not a client',linked:true};
  }else if(l&&l.business_id){
    var nm=_finBizName(l.business_id);
    res=nm?{key:'biz:'+l.business_id,name:nm,linked:true,directId:_finBizDirectId(l.business_id)}:{key:'raw:'+disp,name:disp,linked:false};
  }else{
    res={key:'raw:'+disp,name:disp,linked:false};
  }
  }
  _finCanonCache[ck]=res; return res;
}
try{window.finCanon=finCanon;window.clearFinCanon=clearFinCanon;}catch(_){}

/* --- Service catalogue (EN → AR) -----------------------------------------------------
   One bilingual map for every service Direct bills, so finance reports, the ledger filter
   and the by-service card all show the service name in the current language. Keys match the
   `service_type` stored on invoices; unknown values fall through to their own text. */
var SVC_CATALOG=[
  ['Flights','الطيران'],['Hotels','الفنادق'],['Visa','التأشيرات'],['Visas','التأشيرات'],
  ['Transfers','التنقلات'],['Transport','التنقلات'],['Car rental','تأجير السيارات'],
  ['Insurance','التأمين'],['Activities / tours','الأنشطة والجولات'],['Tours','الأنشطة والجولات'],
  ['MICE / events','الفعاليات والمؤتمرات'],['Events','الفعاليات والمؤتمرات'],['Packages','الباقات'],
  ['Umrah','العمرة'],['Hajj','الحج'],['Courses','الدورات'],['Training','التدريب'],
  /* 'Wallet top-up' removed from here on purpose, 2026-08-20. This list feeds EVERY service
     dropdown in the app (Expenses, the Individual-bookings form, any future one) — leaving
     it selectable let someone label a real revenue-bearing Finance row "Wallet top-up",
     which is exactly what the owner's explicit rule forbids: no wallet-top-up detail in
     Finance reporting, ever, in any form. Wallet top-ups are tracked ONLY as documents in
     the Payment proofs chapter (js/57), which never touches a Finance total. Caught live by
     the owner's own hands-on testing of the Individual-bookings form. */
  ['Support Services','خدمات الدعم'],['eSIM','شرائح eSIM'],
  ['Study abroad','الدراسة بالخارج'],['Furnished apartments','الشقق المفروشة'],
  ['Translation','ترجمة الوثائق'],['Intl driving permit','رخصة القيادة الدولية'],
  ['VIP meet & assist','استقبال كبار الشخصيات'],['Event halls','قاعات الاجتماعات والفعاليات'],
  ['Shipping','الشحن البريدي'],['Chauffeur','سائق خاص'],
  ['Mixed','خدمات متعددة'],['Other','أخرى'],['(unspecified)','غير محدد']
];
var SVC_AR={}; SVC_CATALOG.forEach(function(p){SVC_AR[p[0]]=p[1];});
/* Service FAMILIES (owner-directed 2026-08-10): Finance shows families briefly,
   expandable to the exact services inside — pattern from Direct's own reports
   ("Direct Support (Flight modification)"). Unlisted services fall into Support & extras. */
var SVC_GROUPS={
  'Flights':{ar:'الطيران',svcs:['Flights']},
  'Hotels':{ar:'الفنادق',svcs:['Hotels','Furnished apartments','Event halls']},
  'Visas':{ar:'التأشيرات',svcs:['Visa','Visas','Translation','Intl driving permit']},
  'Transfers':{ar:'التنقلات',svcs:['Transport','Transfers','Car rental','Chauffeur']},
  'Study abroad':{ar:'الدراسة بالخارج',svcs:['Study abroad','Courses','Training']},
  'Packages':{ar:'الباقات',svcs:['Packages','Tours','Activities / tours','MICE / events','Events','Umrah','Hajj']},
  'Other services':{ar:'خدمات أخرى',svcs:['Support Services','eSIM','Insurance','Shipping','VIP meet & assist','Mixed','Other','(unspecified)']}
};
var SVC2GRP={}; Object.keys(SVC_GROUPS).forEach(function(g){SVC_GROUPS[g].svcs.forEach(function(k){SVC2GRP[k]=g;});});
try{ window.SVC_GROUPS=SVC_GROUPS; window.SVC2GRP=SVC2GRP; }catch(_){}
function svcLabel(k){ k=(k==null||k==='')?'(unspecified)':String(k); return isArF()?(SVC_AR[k]||k):k; }
try{ window.SVC_CATALOG=SVC_CATALOG; window.svcLabel=svcLabel; }catch(_){}

function badge(t,bg,fg){return '<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700;background:'+bg+';color:'+fg+'">'+escF(t)+'</span>';}
function uniq(arr){return Array.from(new Set(arr)).filter(Boolean).sort();}
function opts(list,sel,allLabel){var h='<option value="all">'+escF(allLabel)+'</option>';list.forEach(function(x){h+='<option value="'+escF(x)+'" '+(sel===x?'selected':'')+'>'+escF(x)+'</option>';});return h;}
var SS='padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;background:#fff';

function finTabs(){
  var tabs=[['overview',isArF()?'\u0627\u0644\u0623\u062f\u0627\u0621':'Performance'],['clients',isArF()?'\u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u0627\u0644\u062a\u062d\u0635\u064a\u0644':'Clients & collections'],['ledger',isArF()?'\u0627\u0644\u0633\u062c\u0644':'Ledger'],['reports',isArF()?'\u0645\u0646\u0634\u0626 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631':'Report Builder']];
  if(canFinEdit())tabs.push(['import',isArF()?'\u0627\u0633\u062a\u064a\u0631\u0627\u062f':'Import']);
  return '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'+tabs.map(function(t){
    return '<button class="btn sm '+(FIN.tab===t[0]?'pri':'ghost')+'" onclick="finGo(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('')+'<span style="margin-left:auto;font-size:11px;color:var(--muted);align-self:center">'+(FIN.rows?(function(){var _ic=new Set(live().map(function(r){return r.invoice_no;})).size;var _d=(live().length?live().map(function(r){return r.invoice_date;}).sort().slice(-1)[0]:'\u2014');return isArF()?(_ic+' \u0641\u0627\u062a\u0648\u0631\u0629 \u00b7 \u062d\u062a\u0649 '+_d):(_ic+' invoices \u00b7 data through '+_d);})():'')+'</span></div>';
}
/* Freeze found 2026-08-22 (owner reproduced twice): switching a Finance tab called the
   GLOBAL render() — buildNav(), applyLang(), renderTopExtras(), and (since 'finance' isn't a
   key in the base render() dispatcher) a full wasted renderDash() computation over every
   business, immediately thrown away the instant renderFinance() overwrites the same
   #view.innerHTML right after. None of that depends on FIN.tab — switching tabs never
   changes the nav, the language, or the top bar — so this calls renderFinance() directly on
   the already-open Finance view instead. Falls back to the full render() if #view isn't
   there yet (shouldn't happen — this only fires from a button already inside the rendered
   Finance page — but this is a tab switch, not a page load, so it's cheap insurance either
   way). */
window.finGo=function(t){
  FIN.tab=t;
  var v=document.getElementById('view');
  if(v&&current==='finance')renderFinance(v); else render();
};

function finPeriodBar(){
  /* Keep FIN._csvRows in step with what the user is actually looking at.
     It is read by finLedgerCSV() and by the Records page's finance export, but nothing ever
     assigned it: the comment there says "set by rLedger()", and rLedger() did set it until it
     was refactored onto the transactions table, after which it sets TXN._csvRows instead.
     The result was a permanently broken export — "No rows to export" no matter what the user
     did, with 56 real invoices sitting loaded. Found 2026-08-22 while checking the two things
     the team does daily: add an invoice, and export a report.
     Live rows only (never soft-deleted), and filtered to the chosen period so the export
     matches the figures on screen. finPeriodBar() runs on every finance render. */
  try{ FIN._csvRows = live().filter(finInPeriod); }catch(_){ FIN._csvRows = []; }
  var years=uniq(live().map(function(r){var y=finYearOf(r);return y?String(y):'';}));
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'].filter(function(m){return live().some(function(r){return r.month===m;});});
  var chip=function(val,lbl){return '<button class="btn sm '+((FIN.p.part===val)?'pri':'ghost')+'" onclick="finPP(\''+val+'\')">'+lbl+'</button>';};
  var s='<style>.finh{border-inline-start:4px solid #F06820;padding-inline-start:10px;margin:0 0 12px;font-size:15px;line-height:1.35}.finh i{font-style:normal;display:block;font-size:11px;color:var(--muted);font-weight:500}.finpill{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}</style>';
  s+='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">'+(isArF()?'\u0627\u0644\u0641\u062a\u0631\u0629':'Period')+'</b>'
   +'<select style="'+SS+'" onchange="finPY(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062a':'All years')+'</option>'+years.map(function(y){return '<option '+(String(FIN.p.year)===y?'selected':'')+'>'+y+'</option>';}).join('')+'</select>'
   +chip('all',isArF()?'\u0627\u0644\u0643\u0644':'All')+chip('Q1','Q1')+chip('Q2','Q2')+chip('Q3','Q3')+chip('Q4','Q4')+chip('H1','H1')+chip('H2','H2')
   +'<select style="'+SS+'" onchange="finPP(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0634\u0647\u0648\u0631':'All months')+'</option>'+months.map(function(m){return '<option value="M:'+m+'" '+(FIN.p.part==='M:'+m?'selected':'')+'>'+(isArF()?(MO_AR[m]||m):m)+'</option>';}).join('')+'</select>'
   +SECTORS.map(function(sc){var on=(FIN.p.sector||'all')===sc[0];return '<button class="btn sm '+(on?'pri':'ghost')+'" onclick="finPS(\''+sc[0]+'\')">'+(isArF()?sc[1][1]:sc[1][0])+'</button>';}).join('')
   +'<span style="margin-inline-start:auto;font-size:11px;color:var(--muted)">'+(isArF()?'\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0641\u0642\u0637':'Paid invoices only')+' \u00b7 <b>'+finPeriodLabel()+'</b></span></div>';
  return s;
}
function rFinClients(){
  clearFinCanon();
  var V=verified().filter(finInPeriod);
  var h=finPeriodBar();
  var credit=0;(FIN.links||[]).forEach(function(l){credit+=+l.credit_balance_sar||0;});
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px">'
    +'<div class="card" style="padding:14px 16px;border-top:3px solid #10B981"><div style="font-size:11px;color:var(--muted)">'+(isArF()?'رصيد العملاء (لدينا)':'Client credit (held)')+'</div><div style="font-size:19px;font-weight:800;color:#10B981" title="'+money(credit)+' SAR">'+moneyS(credit)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'
    +'</div>';
  // ---- Collections & ageing (days to collect · % overdue · ageing buckets) — from all live invoices, no name matching ----
  var _fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  var LV=live().filter(finInPeriod);
  var arOut=0,arOver=0,billed=0,ag={b030:0,b3160:0,b6190:0,b90:0},_now=Date.now();
  LV.forEach(function(r){
    billed+=+r.total_incl_vat_sar||0;
    var out=+r.amount_remaining_sar||0; if(out<=0)return;
    arOut+=out;
    var due=r.collection_due_date?new Date(r.collection_due_date).getTime():0; if(due&&due<_now)arOver+=out;
    var invd=r.invoice_date?new Date(r.invoice_date).getTime():_now; var d=Math.floor((_now-invd)/86400000);
    if(d<=30)ag.b030+=out;else if(d<=60)ag.b3160+=out;else if(d<=90)ag.b6190+=out;else ag.b90+=out;
  });
  var _dates=LV.map(function(r){return r.invoice_date;}).filter(Boolean).sort();
  var _span=_dates.length?Math.max(30,Math.round((new Date(_dates[_dates.length-1]).getTime()-new Date(_dates[0]).getTime())/86400000)):180;
  var dso=billed>0?Math.round(arOut/billed*_span):0, pctOver=arOut>0?Math.round(arOver/arOut*100):0;
  /* A1, 2026-08-25 (owner-approved audit fix) — the card used to print DSO 0 / 0% / 0 SAR and a
     green "No outstanding receivables", which reads as "we collect perfectly". It is not: rule M10
     imports only finalised/paid invoices, so an unpaid invoice cannot enter the table at all and
     this card is structurally incapable of finding one. Zero here was a fabricated number filling
     a gap — exactly what rule M8 forbids. When nothing in the period carries any payment state to
     measure, say so instead of showing zeros. */
  var _noUnpaidData=LV.length>0&&!LV.some(function(r){return (+r.amount_remaining_sar||0)>0;})&&LV.every(function(r){return r.integrity_status==='verified_paid';});
  var _mini=function(lbl,val,col){return '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+val+'</div></div>';};
  var _agc=function(lbl,val){return '<div style="flex:1;min-width:90px;background:#F9FAFB;border-radius:8px;padding:8px 10px"><div style="font-size:10.5px;color:var(--muted)">'+lbl+'</div><div style="font-weight:800;font-size:14px">'+moneyS(val)+' <span style="font-size:9px;font-weight:400">SAR</span></div></div>';};
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 10px">'+_fl('Collections & ageing','التحصيل والتقادم')+'</h3>'+
     (_noUnpaidData
       ? ('<div style="font-size:12.5px;color:var(--muted)">'+_fl('Not tracked yet — only paid invoices are imported, so nothing here can show as unpaid.','لم يُتتبَّع بعد — لا تُستورد إلا الفواتير المدفوعة، لذا لا يظهر أي مبلغ غير محصَّل.')+'</div>')
       : ('<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:'+(arOut>0?'14px':'0')+'">'+
       _mini(_fl('Days to collect','مدة التحصيل (أيام)'),dso,'#175CD3')+
       _mini(_fl('% overdue','٪ المتأخر'),pctOver+'%',pctOver>0?'#D92D20':'#0F6E56')+
       _mini(_fl('Outstanding','إجمالي المستحق'),moneyS(arOut)+' SAR',arOut>0?'#D92D20':'#667085')+
     '</div>'+
     (arOut>0?('<div style="display:flex;gap:8px;flex-wrap:wrap">'+_agc(_fl('0–30 days','0–30 يوم'),ag.b030)+_agc(_fl('31–60 days','31–60 يوم'),ag.b3160)+_agc(_fl('61–90 days','61–90 يوم'),ag.b6190)+_agc(_fl('90+ days','90+ يوم'),ag.b90)+'</div>')
       :('<div style="font-size:12px;color:#0F6E56">✓ '+_fl('Nothing outstanding','لا توجد مستحقات')+'</div>'))))+
     '</div>';
  var byC={};V.forEach(function(r){var cc=finCanon(r.client_group);var k=cc.name;byC[k]=byC[k]||{r:0,c:0,p:0,_i:{},key:cc.key,directId:cc.directId};byC[k].r+=+r.revenue_sar;byC[k].c+=+r.cost_sar;byC[k].p+=+r.profit_sar;byC[k]._i[r.invoice_no]=1;});Object.keys(byC).forEach(function(k){byC[k].n=Object.keys(byC[k]._i).length;});
  var top=Object.keys(byC).sort(function(a,b){return byC[b].r-byC[a].r;}).slice(0,10);
  var _tc={r:0,c:0,p:0};Object.keys(byC).forEach(function(k){_tc.r+=byC[k].r;_tc.c+=byC[k].c;_tc.p+=byC[k].p;});
  h+='<div class="card" style="padding:16px"><h3 class="finh" style="margin:0 0 10px">'+(isArF()?'أعلى العملاء':'Top clients by revenue')+'<i>'+finPeriodLabel()+'</i></h3><div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:480px"><tr style="background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+'"><th style="padding:7px 9px">'+(isArF()?'العميل':'Client')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الإيرادات':'Revenue')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'التكلفة':'Cost')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الربح':'Profit')+'</th></tr>'+top.map(function(k){
    return '<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" onclick="finClient(\''+escF(byC[k].key).replace(/'/g,"\\'")+'\',\''+escF(k).replace(/'/g,"\\'")+'\')"><td style="padding:6px 9px;font-weight:600">'+escF(k)+(byC[k].directId?(' <span style="color:var(--muted);font-size:10.5px">#'+escF(byC[k].directId)+'</span>'):'')+'</td><td style="padding:6px 9px;text-align:right;font-weight:700">'+money0(byC[k].r)+'</td><td style="padding:6px 9px;text-align:right;color:#B54708">'+money0(byC[k].c)+'</td><td style="padding:6px 9px;text-align:right;color:#0F6E56;font-weight:700">'+money0(byC[k].p)+'</td></tr>';
  }).join('')+'<tr style="background:#303848;color:#fff;font-weight:800"><td style="padding:7px 9px">'+(isArF()?'الإجمالي الكلي':'Total')+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.r)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.c)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.p)+'</td></tr></table></div></div>';
  return h;
}
function rOverview(){
  clearFinCanon();
  var V=verified().filter(finInPeriod);
  var rev=0,cost=0,prof=0,rec=0,rem=0,wal=0;
  V.forEach(function(r){rev+=+r.revenue_sar;cost+=+r.cost_sar;prof+=+r.profit_sar;rec+=+r.amount_received_sar;rem+=+r.amount_remaining_sar;wal+=+r.wallet_portion_sar;});
  /* Outstanding cannot be read off the verified-paid invoices: an invoice is only verified-paid
     once nothing is left to pay, so summing what remains across them is always zero — which is
     exactly what this tile showed while Clients & collections reported 216.1K of real unpaid
     money on the same page. Money still owed lives on the invoices that are NOT yet settled, so
     it is counted over every live invoice in the period, the same basis the collections tab uses.
     The other five indicators stay on verified invoices, as their subtitle says. */
  rem=0; live().filter(finInPeriod).forEach(function(r){ rem+=+r.amount_remaining_sar||0; });
  var invCount=new Set(V.map(function(r){return r.invoice_no;})).size; // distinct invoices, not service lines
  /* Period bar \u2014 the executive-dashboard structure: year \u00b7 All/Q1\u2013Q4/H1/H2 \u00b7 month */
  var h=finPeriodBar();

  var cards=[[isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue',rev,'#0F6E56'],[isArF()?'\u0627\u0644\u062a\u0643\u0644\u0641\u0629':'Cost',cost,'#B54708'],[isArF()?'\u0627\u0644\u0631\u0628\u062d':'Profit',prof,'#175CD3'],[isArF()?'\u0627\u0644\u0645\u062d\u0635\u0651\u0644':'Received',rec,'#0F6E56'],[isArF()?'\u0627\u0644\u0645\u062a\u0628\u0642\u064a':'Outstanding',rem,rem>0?'#D92D20':'#667085'],[isArF()?'\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631':'Invoices',invCount,'#1C1E2B']];
  h+='<h3 class="finh">'+(isArF()?'\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629':'Key indicators')+'<i>'+finPeriodLabel()+' \u00b7 '+(isArF()?'\u0641\u0639\u0644\u064a \u2014 \u0645\u0646 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0642\u0642\u0629':'actual \u2014 from verified invoices')+'</i></h3>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin-bottom:14px">'+cards.map(function(c,i){
    return '<div class="card" style="padding:14px 16px;border-top:3px solid '+c[2]+'"><div style="font-size:11px;color:var(--muted)">'+c[0]+'</div><div style="font-size:'+(i===cards.length-1?'22px':'19px')+';font-weight:800;color:'+c[2]+'" title="'+(i===cards.length-1?'':money(c[1])+' SAR')+'">'+(i===cards.length-1?c[1]:moneyS(c[1]))+(i===cards.length-1?'':' <span style="font-size:10px;font-weight:400">SAR</span>')+'</div></div>';
  }).join('')+'</div>';
  /* A7, 2026-08-26 (landmine sweep) — the newest month always flattered itself: August showed a
     63.5% margin only because most of its cost had not arrived yet, and nothing marked the gap.
     When the filtered period contains verified invoices carrying no cost, say so right under the
     KPIs, with the count — factual either way (a commission invoice genuinely has no cost; a
     held-back one just doesn't have it YET), so the wording states the fact and hedges the risk. */
  var _noCost=V.filter(function(r){return (+r.cost_sar||0)===0;}).length;
  if(_noCost>0){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 14px">⚠ '+(isArF()
      ?(_noCost+' من '+V.length+' فاتورة في هذه الفترة بلا تكلفة مسجلة — قد يظهر الهامش أعلى من الحقيقة حتى تصل مصروفاتها.')
      :(_noCost+' of '+V.length+' invoices in this period carry no recorded cost — margin may read higher than reality until their expenses arrive.'))+'</div>';
  }
  /* Compare to (blueprint step 5, 2026-08-27): revenue/cost/profit/margin against the previous
     period or the same period last year. Needs one concrete year selected above — spanning
     "all years" has no single "previous" to shift to, so the control still shows but explains
     why, instead of silently doing nothing. */
  h+=(function(){
    var ar=isArF(), cmp=FIN.p.cmp||'none';
    var sel='<select style="'+SS+'" onchange="finCmp(this.value)"><option value="none" '+(cmp==='none'?'selected':'')+'>'+(ar?'بلا مقارنة':'No comparison')+'</option><option value="prev" '+(cmp==='prev'?'selected':'')+'>'+(ar?'مقابل الفترة السابقة':'vs previous period')+'</option><option value="yoy" '+(cmp==='yoy'?'selected':'')+'>'+(ar?'مقابل نفس الفترة العام الماضي':'vs same period last year')+'</option></select>';
    var out='<div class="card" style="padding:14px 16px;margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">'+(ar?'المقارنة':'Compare to')+'</b>'+sel+'</div>';
    if(cmp==='none')return '';
    if(FIN.p.year==='all'){
      out+='<div style="font-size:12px;color:var(--muted);margin-top:8px">'+(ar?'اختر سنة محددة أعلاه أولاً — لا يوجد «سابق» لكل السنوات معًا.':'Pick a specific year above first — there is no "previous" for all years at once.')+'</div></div>';
      return out;
    }
    var cp=finCompPeriodOf(cmp);
    if(!cp){out+='</div>';return out;}
    var ct=finPeriodTotals(cp);
    var rows=[[ar?'الإيرادات':'Revenue',rev,ct.rev],[ar?'التكلفة':'Cost',cost,ct.cost],[ar?'الربح':'Profit',prof,ct.prof],
      [ar?'الهامش':'Margin',rev>0?(prof/rev*100):0,ct.rev>0?(ct.prof/ct.rev*100):0]];
    out+='<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:420px"><thead><tr style="text-align:'+(ar?'right':'left')+';color:var(--muted)"><th style="padding:6px 8px"></th><th style="padding:6px 8px;text-align:right">'+finPeriodLabel()+'</th><th style="padding:6px 8px;text-align:right">'+finCompLabel(cp)+'</th><th style="padding:6px 8px;text-align:right">'+(ar?'الفرق':'Δ')+'</th></tr></thead><tbody>'+rows.map(function(r){
      var isMargin=r[0]===(ar?'الهامش':'Margin');
      var d=r[1]-r[2], pct=r[2]!==0?(d/Math.abs(r[2])*100):(r[1]!==0?null:0);
      var fmt=function(n){return isMargin?(n.toFixed(1)+'%'):(money0(n)+' SAR');};
      var col=d>0?'#0F6E56':(d<0?'#D92D20':'var(--muted)');
      var dTxt=isMargin?((d>=0?'+':'')+d.toFixed(1)+' pts'):((d>=0?'+':'')+money0(d)+' SAR'+(pct===null?'':' ('+(pct>=0?'+':'')+Math.round(pct)+'%)'));
      return '<tr style="border-top:1px solid var(--line,#eee)"><td style="padding:6px 8px;font-weight:600">'+r[0]+'</td><td style="padding:6px 8px;text-align:right">'+fmt(r[1])+'</td><td style="padding:6px 8px;text-align:right;color:var(--muted)">'+fmt(r[2])+'</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:'+col+'">'+dTxt+'</td></tr>';
    }).join('')+'</tbody></table></div>';
    var warn=[]; if(_noCost>0)warn.push(ar?'هذه الفترة':'this period'); if(ct.noCost>0)warn.push(ar?'فترة المقارنة':'the comparison period');
    if(warn.length){out+='<div style="font-size:11.5px;color:#B54708;margin-top:8px">⚠ '+(ar
      ?('التكلفة غير مكتملة في '+warn.join(' و')+' — الفرق قد لا يعكس التغيّر الحقيقي بعد.')
      :('Cost is incomplete in '+warn.join(' and ')+' — the difference may not reflect the real change yet.'))+'</div>';}
    out+='</div>';
    return out;
  })();
  /* Plan vs actual (executive dashboard: expected/confirmed/actual) — actuals derived live. */
  var _ty=(FIN.p.year!=='all')?+FIN.p.year:(new Date()).getFullYear();
  var tgt=(FIN.targets||[]).find(function(t){return +t.year===_ty;});
  var frac=1,fLbl='';
  if(FIN.p.part!=='all'){ frac=(/^Q/.test(FIN.p.part))?0.25:(/^H/.test(FIN.p.part))?0.5:(FIN.p.part.indexOf('M:')===0?1/12:1); fLbl=isArF()?' · تقديري نسبةً للفترة':' · pro-rated for the period'; }
  if(tgt||canFinEdit()){
    var _exp=tgt?Math.round((+tgt.expected_sar||0)*frac):0, _conf=tgt?Math.round((+tgt.confirmed_sar||0)*frac):0;
    var _attT=_exp>0?Math.round(rev/_exp*100):0,_att=Math.min(100,_attT);
    h+='<div class="card" style="padding:16px;margin-bottom:14px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 class="finh" style="margin:0">'+(isArF()?'الخطة مقابل الفعلي':'Plan vs actual')+'<i>'+_ty+fLbl+'</i></h3>'+(canFinEdit()?('<button class="btn sm" onclick="finSetTargets('+_ty+')">'+(isArF()?'تعديل الأرقام':'Set targets')+'</button>'):'')+'</div>';
    if(tgt){
      var _pm=function(lbl,val,col){return '<div style="flex:1;min-width:120px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+moneyS(val)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>';};
      h+='<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">'
        +_pm(isArF()?'متوقع':'Expected',_exp,'#B54708')
        +_pm(isArF()?'مؤكد (عقود)':'Confirmed (signed)',_conf,'#175CD3')
        +_pm(isArF()?'فعلي (مدقق)':'Actual (verified)',rev,'#0F6E56')
        +'<div style="flex:2;min-width:180px"><div style="font-size:11px;color:var(--muted)">'+(isArF()?'نسبة تحقق المتوقع':'Of expected achieved')+' · '+_attT+'%'+(_attT>100?(isArF()?' · فوق الخطة ✓':' · above plan ✓'):'')+'</div><div style="background:#EEF0F5;border-radius:8px;height:14px;margin-top:8px;overflow:hidden"><div style="height:100%;width:'+_att+'%;background:linear-gradient(90deg,#E54525,#F26721)"></div></div></div>'
        +'</div>';
    } else {
      h+='<div class="ch-sub" style="margin-top:8px">'+(isArF()?'لا توجد أرقام خطة لهذه السنة بعد — اضغط «تعديل الأرقام».':'No plan numbers for this year yet — click Set targets.')+'</div>';
    }
    h+='</div>';
  }

  var MO=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var by={};V.forEach(function(r){var k=r.month||'?';by[k]=by[k]||{r:0,p:0};by[k].r+=+r.revenue_sar;by[k].p+=+r.profit_sar;});
  var mos=MO.filter(function(m){return by[m];});var mx=Math.max.apply(null,mos.map(function(m){return by[m].r;}).concat([1]));
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 12px">'+(isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0631\u0628\u062d \u0634\u0647\u0631\u064a\u064b\u0627':'Monthly revenue & profit')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3><div style="overflow-x:auto"><div style="display:flex;gap:14px;align-items:flex-end;height:150px;min-width:520px">'+mos.map(function(m){
    var hR=Math.round(by[m].r/mx*120),hP=Math.round(by[m].p/mx*120);
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;gap:3px;align-items:flex-end;height:124px"><div title="Revenue '+money(by[m].r)+'" style="width:22px;height:'+Math.max(hR,2)+'px;background:#FF6B00;border-radius:4px 4px 0 0"></div><div title="Profit '+money(by[m].p)+'" style="width:22px;height:'+Math.max(hP,2)+'px;background:#303848;border-radius:4px 4px 0 0"></div></div><div style="font-size:10px;color:var(--muted)">'+m.slice(0,3)+'</div><div style="font-size:9.5px;font-weight:700">'+moneyS(by[m].r)+'</div></div>';
  }).join('')+'</div></div><div style="font-size:10px;color:var(--muted);margin-top:8px"><span style="color:#FF6B00">\u25a0</span> '+(isArF()?'\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue')+' &nbsp;<span style="color:#303848">\u25a0</span> '+(isArF()?'\u0631\u0628\u062d':'Profit')+'</div></div>';

  return h;
}
window.finQ=function(v){FIN.f.quarter=v;render();};
/* Drill from a canonical client row \u2192 Ledger filtered to that client (all its invoice groups). */
window.finClient=function(key,name){FIN.tab='ledger';FIN.f.clientKey=key||null;FIN.f.clientName=name||'';FIN.f.client='all';
  // The Ledger tab now reads finance_transactions (Phase 2) — carry the drill-down across
  // by resolving the same business_id the old key encoded, so "Top clients" still filters.
  try{ TXN.f.business=(key&&key.indexOf('biz:')===0)?key.slice(4):'all'; }catch(_){}
  render();};

/* ===== Phase 2 Ledger rebuild (2026-08-21) =====================================
   Staged ALONGSIDE finance_invoices — Overview / Clients & collections / Report
   Builder / income-by-service above this point are UNTOUCHED and keep reading
   finance_invoices via FIN/live(). Only this tab reads the new tables:
   finance_transactions (+finance_cogs_expenses for confirmed cost, +client_profiles
   for the prepaid/postpaid/tender label, +payment_receipts for what's been paid).
   Rules from docs/DIRECT_PAYMENTS_MODEL.md Round 11 (owner ruling 2026-08-21):
     - Company is the shape, not a toggle: one company row, its profiles nested
       under it, every transaction/invoice row labelled prepaid/postpaid/tender —
       in the UI and in the export.
     - KPI strip is CONFIRMED ONLY: a transaction counts once it has an invoice
       number OR its expense_status is 'ready' (Round 8's stage rule). A 'pending'
       transaction shows its cost_estimate_sar tagged "est." at row level and never
       reaches the headline totals (Round 7).
     - Overdue is a mirror, never invented: only rendered when overdue===true;
       null (not yet mirrored) shows nothing, never "not overdue" (Round 11). */
var TXN={rows:null,profiles:null,loading:false,collapsed:{},
  f:{q:'',profileType:'all',business:'all',stage:'all'}};
function txnLoad(cb){
  if(TXN.loading)return; TXN.loading=true;
  var c=fc(); if(!c){TXN.loading=false;return;}
  c.from('finance_transactions').select('*').is('deleted_at',null).order('created_at_source',{ascending:false}).then(function(r){
    TXN.loading=false;
    if(r.error){ if(window.console)console.warn('finance_transactions load',r.error); TXN.rows=[]; }
    else TXN.rows=r.data||[];
    c.from('client_profiles').select('id,business_id,direct_client_id,profile_type,payment_terms,billing_cycle,status').then(function(pr){
      TXN.profiles={}; ((pr&&!pr.error&&pr.data)||[]).forEach(function(p){TXN.profiles[p.id]=p;});
      if(cb)cb(); try{if(current==='finance'&&FIN.tab==='ledger')render();}catch(_){}
    });
  });
}
try{window.TXN=TXN;window.txnLoad=txnLoad;}catch(_){}
function txnStage(r){
  // Round 8's two-field derivation, plus Round 11's Overdue mirror.
  if(r.invoice_no)return 'invoiced';
  if(r.overdue===true)return 'overdue';
  if(r.expense_status==='ready')return 'ready';
  return 'pending';
}
var TXN_STAGE_LBL={pending:['Expenses pending','بانتظار المصاريف'],ready:['Ready to invoice','جاهز للفوترة'],
  invoiced:['Invoiced','مفوترة'],overdue:['Overdue','متأخر']};
var TXN_STAGE_COLOR={pending:'#B54708',ready:'#175CD3',invoiced:'#0F6E56',overdue:'#D92D20'};
function txnConfirmed(r){ return txnStage(r)==='ready'||txnStage(r)==='invoiced'; }
var TXN_TYPE_LBL={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};
window.finTxnCSV=function(){
  var L=TXN._csvRows||[]; if(!L.length){alert(isArF()?'لا صفوف للتصدير':'No rows to export');return;}
  var cols=['company','profile_type','direct_client_id','transaction_ref','invoice_no','zatca_dpin','service_type','stage','amount_sar','cost_confirmed_sar','cost_estimate_sar','amount_received_sar','amount_remaining_sar','overdue','created_at_source'];
  var csv='﻿'+cols.join(',')+'\n'+L.map(function(r){return cols.map(function(c){var v=csvGuard(r[c]);return '"'+v.replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-ledger-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};
window.finTxnF=function(k,v){TXN.f[k]=v;render();};
window.txnToggleCo=function(bizId){TXN.collapsed[bizId]=!TXN.collapsed[bizId];render();};
function rLedger(){
  var _lh=function(en,ar){return isArF()?ar:en;};
  if(TXN.rows==null||TXN.profiles==null){ txnLoad(); return '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+_lh('Loading the ledger…','جارِ تحميل السجل…')+'</div>'; }
  var bizName=_finBizName;
  var rows=(TXN.rows||[]).filter(function(r){
    var f=TXN.f, prof=TXN.profiles[r.client_profile_id];
    if(f.profileType!=='all'&&(!prof||prof.profile_type!==f.profileType))return false;
    if(f.business!=='all'&&r.business_id!==f.business)return false;
    if(f.stage!=='all'&&txnStage(r)!==f.stage)return false;
    if(f.q){var q=f.q.toLowerCase();var nm=bizName(r.business_id)||'';if(((nm)+' '+(r.transaction_ref||'')+' '+(r.invoice_no||'')+' '+(r.zatca_dpin||'')+' '+(r.product||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  // Confirmed-only KPI strip (Round 7/8) — pending never blends in.
  var cRev=0,cCost=0,cProf=0,pendCount=0,pendEst=0,overdueCount=0;
  rows.forEach(function(r){
    if(txnConfirmed(r)){ cRev+=+r.amount_sar||0; cCost+=+r.cost_confirmed_sar||0; cProf+=(+r.amount_sar||0)-(+r.cost_confirmed_sar||0); }
    else { pendCount++; pendEst+=+r.cost_estimate_sar||0; }
    if(txnStage(r)==='overdue')overdueCount++;
  });
  // Company is the primary row, profiles nest under it (owner ruling 2026-08-21).
  var byBiz={},order=[];
  rows.forEach(function(r){ if(!byBiz[r.business_id]){byBiz[r.business_id]=[];order.push(r.business_id);} byBiz[r.business_id].push(r); });
  order.sort(function(a,b){return (bizName(a)||'').localeCompare(bizName(b)||'');});
  // exports always carry the company + profile label, per row (owner ruling)
  TXN._csvRows=rows.map(function(r){var p=TXN.profiles[r.client_profile_id];return Object.assign({},r,{company:bizName(r.business_id)||r.business_id,profile_type:p?p.profile_type:'',direct_client_id:p?p.direct_client_id:'',stage:txnStage(r)});});

  var h='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #0F6E56"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed revenue','الإيراد المؤكد')+'</div><div style="font-size:18px;font-weight:800;color:#0F6E56" title="'+money(cRev)+' SAR">'+moneyS(cRev)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #B54708"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed cost','التكلفة المؤكدة')+'</div><div style="font-size:18px;font-weight:800;color:#B54708" title="'+money(cCost)+' SAR">'+moneyS(cCost)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #175CD3"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed profit','الربح المؤكد')+'</div><div style="font-size:18px;font-weight:800;color:#175CD3" title="'+money(cProf)+' SAR">'+moneyS(cProf)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #B54708"><div style="font-size:11px;color:var(--muted)">'+_lh('Pending (est. only)','بانتظار المصاريف (تقديري)')+'</div><div style="font-size:18px;font-weight:800;color:#8b5b1f">'+pendCount+' <span style="font-size:10px;font-weight:400">· '+moneyS(pendEst)+' '+_lh('est.','تقديري')+'</span></div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid '+(overdueCount?'#D92D20':'#E5E7EB')+'"><div style="font-size:11px;color:var(--muted)">'+_lh('Overdue','متأخر')+'</div><div style="font-size:18px;font-weight:800;color:'+(overdueCount?'#D92D20':'#667085')+'">'+overdueCount+'</div></div>'
    +'</div><div class="ch-sub" style="margin:-4px 0 10px">'+_lh('Confirmed = it has an invoice number, or its expense is marked Ready. A pending row only shows an early estimate — that number is not included above.','المؤكد = له رقم فاتورة، أو مصروفه بحالة جاهز. الصف المعلّق يعرض تقديرًا مبكرًا فقط — هذا الرقم غير مُدرج أعلاه.')+'</div>';

  h+='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px">';
  h+='<input placeholder="'+_lh('Search company / ref / invoice / DPIN…','بحث عن شركة / مرجع / فاتورة…')+'" value="'+escF(TXN.f.q)+'" style="'+SS+';min-width:200px" oninput="finTxnF(\'q\',this.value)">';
  h+='<select style="'+SS+'" onchange="finTxnF(\'profileType\',this.value)"><option value="all">'+_lh('All profile types','كل أنواع الملفات')+'</option><option value="prepaid" '+(TXN.f.profileType==='prepaid'?'selected':'')+'>'+_lh('Prepaid','مسبق الدفع')+'</option><option value="postpaid" '+(TXN.f.profileType==='postpaid'?'selected':'')+'>'+_lh('Postpaid','آجل الدفع')+'</option><option value="tender" '+(TXN.f.profileType==='tender'?'selected':'')+'>'+_lh('Tender','مناقصة')+'</option></select>';
  h+='<select style="'+SS+'" onchange="finTxnF(\'stage\',this.value)"><option value="all">'+_lh('All stages','كل المراحل')+'</option><option value="pending" '+(TXN.f.stage==='pending'?'selected':'')+'>'+_lh('Expenses pending','بانتظار المصاريف')+'</option><option value="ready" '+(TXN.f.stage==='ready'?'selected':'')+'>'+_lh('Ready to invoice','جاهز للفوترة')+'</option><option value="invoiced" '+(TXN.f.stage==='invoiced'?'selected':'')+'>'+_lh('Invoiced','مفوترة')+'</option><option value="overdue" '+(TXN.f.stage==='overdue'?'selected':'')+'>'+_lh('Overdue','متأخر')+'</option></select>';
  h+='<select style="'+SS+';max-width:240px" onchange="finTxnF(\'business\',this.value)"><option value="all">'+_lh('All companies','كل الشركات')+'</option>'+order.map(function(uid){return '<option value="'+escF(uid)+'" '+(TXN.f.business===uid?'selected':'')+'>'+escF(bizName(uid)||uid)+'</option>';}).join('')+'</select>';
  h+='<button class="btn sm" onclick="finTxnCSV()">⬇ '+_lh('Excel (CSV)','إكسل (CSV)')+'</button>';
  h+='<span style="margin-left:auto;font-size:12px">'+(isArF()?('<b>'+rows.length+'</b> معاملة عبر <b>'+order.length+'</b> شركة'):('<b>'+rows.length+'</b> transactions across <b>'+order.length+'</b> compan'+(order.length===1?'y':'ies')))+'</span></div>';

  if(!order.length){ h+='<div class="card" style="padding:30px;text-align:center;color:var(--muted)">'+_lh('No transactions match.','لا توجد معاملات مطابقة.')+'</div>'; return h; }

  order.forEach(function(bizId){
    var list=byBiz[bizId].slice().sort(function(a,b){return (b.created_at_source||'').localeCompare(a.created_at_source||'');});
    var coRev=0,coCost=0; list.forEach(function(r){ if(txnConfirmed(r)){coRev+=+r.amount_sar||0;coCost+=+r.cost_confirmed_sar||0;} });
    var isCollapsed=!!TXN.collapsed[bizId];
    h+='<div class="card" style="padding:0;margin-bottom:10px;overflow:hidden">';
    h+='<div style="padding:10px 14px;background:#F6F7F9;display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer" onclick="txnToggleCo(\''+bizId+'\')">'
      +'<span style="font-weight:800;font-size:13.5px">'+(isCollapsed?'▸':'▾')+' '+escF(bizName(bizId)||bizId)+'</span>'
      +'<span style="font-size:11px;color:var(--muted)">'+list.length+' '+_lh('transactions','معاملة')+'</span>'
      +'<span style="margin-left:auto;font-size:12px"><b style="color:#0F6E56">'+money0(coRev)+'</b> '+_lh('rev','إيراد')+' · <b style="color:#B54708">'+money0(coCost)+'</b> '+_lh('cost','تكلفة')+' <span style="color:var(--muted);font-size:10.5px">('+_lh('confirmed only','مؤكد فقط')+')</span></span></div>';
    if(!isCollapsed){
      h+='<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse;min-width:990px"><thead><tr style="background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+'"><th style="padding:7px 8px">'+_lh('Date','التاريخ')+'</th><th style="padding:7px 8px">'+_lh('Profile','الملف')+'</th><th style="padding:7px 8px">'+_lh('Ref / Invoice','المرجع / الفاتورة')+'</th><th style="padding:7px 8px">'+_lh('Service','الخدمة')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Amount','المبلغ')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Cost','التكلفة')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Profit','الربح')+'</th><th style="padding:7px 8px">'+_lh('Stage','المرحلة')+'</th><th style="padding:7px 8px">'+_lh('Payment','السداد')+'</th></tr></thead><tbody>';
      list.forEach(function(r){
        var p=TXN.profiles[r.client_profile_id];
        var tl=p&&TXN_TYPE_LBL[p.profile_type]?TXN_TYPE_LBL[p.profile_type]:['—','—'];
        var stage=txnStage(r), sc=TXN_STAGE_COLOR[stage], sl=TXN_STAGE_LBL[stage];
        var confirmed=txnConfirmed(r);
        var costCell=confirmed?('<b>'+money0(r.cost_confirmed_sar)+'</b>')
          :(r.cost_estimate_sar!=null?('<span style="color:var(--muted);font-style:italic">'+money0(r.cost_estimate_sar)+' '+_lh('est.','تقديري')+'</span>'):'—');
        var profCell=confirmed?('<span style="color:#175CD3;font-weight:700">'+money0((+r.amount_sar||0)-(+r.cost_confirmed_sar||0))+'</span>'):'<span style="color:var(--muted)">—</span>';
        /* Payment column — owner ruling 2026-08-22 (tab 3: "every bit inside each one
           working"). Deliberately blank when nothing is expected yet — a pending
           transaction is not "Unpaid", and a red badge on every pending row would make the
           column noise instead of signal. */
        var _rec=+r.amount_received_sar||0, _rem=+r.amount_remaining_sar||0, _amt=+r.amount_sar||0;
        var payCell;
        if(_rec<=0&&_rem<=0&&_amt<=0)payCell='<span style="color:var(--muted)">—</span>';
        else if(_rem<=0&&_rec>0)payCell=badge(_lh('Paid','مدفوع'),'#E6F4EA','#0F6E56');
        else if(_rec>0&&_rem>0)payCell=badge(_lh('Partly paid','مدفوع جزئياً'),'#FEF0C7','#B54708');
        else if(_rem>0)payCell=badge(_lh('Unpaid','غير مدفوع'),'#FEE4E2','#D92D20');
        else payCell='<span style="color:var(--muted)">—</span>';
        var refCell=r.invoice_no
          ?('<a href="'+escF(pdInvoiceLink({invoice_no:r.invoice_no,zatca_dpin:r.zatca_dpin,direct_client_id:p?p.direct_client_id:''}))+'" target="_blank" rel="noopener" style="color:#175CD3;text-decoration:none">'+escF(r.invoice_no)+' ↗</a>')
          :escF(r.transaction_ref);
        h+='<tr style="border-top:1px solid var(--line,#eee)"><td style="padding:7px 8px;white-space:nowrap">'+escF((r.created_at_source||'').slice(0,10))+'</td>'
          +'<td style="padding:7px 8px">'+badge(_lh(tl[0],tl[1]),'#EEF0F5','#4B5563')+(p&&p.direct_client_id?(' <span style="color:var(--muted);font-size:10.5px">#'+escF(p.direct_client_id)+'</span>'):'')+'</td>'
          +'<td style="padding:7px 8px">'+refCell+'</td>'
          +'<td style="padding:7px 8px">'+escF(svcLabel(r.service_type))+'</td>'
          +'<td style="padding:7px 8px;text-align:right;font-weight:700">'+money0(r.amount_sar)+'</td>'
          +'<td style="padding:7px 8px;text-align:right">'+costCell+'</td>'
          +'<td style="padding:7px 8px;text-align:right">'+profCell+'</td>'
          +'<td style="padding:7px 8px">'+badge(_lh(sl[0],sl[1]),sc+'1a',sc)+'</td>'
          +'<td style="padding:7px 8px">'+payCell+'</td></tr>';
      });
      h+='</tbody></table></div>';
    }
    h+='</div>';
  });
  return h;
}
window.finF=function(k,v){FIN.f[k]=v;if(k==='client'){FIN.f.clientKey=null;FIN.f.clientName='';}render();};
window.finClientClear=function(){FIN.f.clientKey=null;FIN.f.clientName='';render();};
/* Strategic & quality teams: jump from a project invoice to the proposal behind it. */
window.finSetOrigin=function(invNo){try{
  var o=(document.getElementById('fin_origin')||{}).value||'booking';
  var p=((document.getElementById('fin_pref')||{}).value||'').trim();
  var c=fc(); if(!c)return;
  c.from('finance_invoices').update({origin:o,proposal_ref:p||null}).eq('invoice_no',invNo).is('deleted_at',null).then(function(r){
    if(r.error){alert((isArF()?'تعذر الحفظ: ':'Could not save: ')+r.error.message);return;}
    (FIN.rows||[]).forEach(function(x){ if(x.invoice_no===invNo&&!x.deleted_at){ x.origin=o; x.proposal_ref=p||null; } });
    var m=document.getElementById('finModal'); if(m)m.remove();
    if(typeof toast==='function')toast(isArF()?'تم الحفظ':'Saved');
    render();
  }).catch(function(){});
}catch(e){if(window.console)console.warn('finSetOrigin',e);}};
window.finOpenProposal=function(ref){try{
  var o=(DB.offers||[]).find(function(x){return (x.ref||'')===ref;});
  var m=document.getElementById('finModal'); if(m)m.remove();
  if(o){openOffer=o.id;current='offers';render();window.scrollTo(0,0);}
  else if(typeof toast==='function')toast(isArF()?('لا يوجد عرض بالمرجع '+ref):('No proposal with ref '+ref));
}catch(e){if(window.console)console.warn('finOpenProposal',e);}};
/* Structure for linking into the Direct system (payments.directksa.com).
   The URL pattern is a setting so it can be corrected the moment we see the real
   Direct screens — placeholders: {invoice_no} {dpin} {client_id}. */
window.pdInvoiceLink=function(r){
  // Confirmed from the real system (2026-08-12): admin invoice pages live at
  // /en/admin/invoices/view/{uuid}. When we hold the uuid, deep-link straight to it.
  if(r&&r.direct_uuid){
    var vt=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceViewUrl)||'https://payments.directksa.com/en/admin/invoices/view/{uuid}';
    return vt.replace('{uuid}',encodeURIComponent(r.direct_uuid));
  }
  var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceUrl)||'https://payments.directksa.com/en/admin/invoices';
  return tpl.replace('{invoice_no}',encodeURIComponent(r.invoice_no||'')).replace('{dpin}',encodeURIComponent(r.zatca_dpin||'')).replace('{client_id}',encodeURIComponent(r.direct_client_id||''));
};
window.pdClientLink=function(directClientId){
  var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdClientUrl)||'https://payments.directksa.com/customers/{client_id}';
  return tpl.replace('{client_id}',encodeURIComponent(directClientId||''));
};
window.finRow=function(id){
  var r=(FIN.rows||[]).find(function(x){return x.id===id;});if(!r)return;
  var ar=isArF(), _f=function(en,a){return ar?a:en;};
  // The invoice = every line sharing this invoice number (same deleted state as the one clicked).
  var delState=!!r.deleted_at;
  var lines=(FIN.rows||[]).filter(function(x){return x.invoice_no===r.invoice_no && (!!x.deleted_at)===delState;})
                          .sort(function(a,b){return (a.line_no||1)-(b.line_no||1);});
  var t={tot:0,cost:0,rev:0,prof:0,rec:0,rem:0,wal:0};
  lines.forEach(function(x){t.tot+=+x.total_incl_vat_sar||0;t.cost+=+x.cost_sar||0;t.rev+=+x.revenue_sar||0;t.prof+=+x.profit_sar||0;t.rec+=+x.amount_received_sar||0;t.rem+=+x.amount_remaining_sar||0;t.wal+=+x.wallet_portion_sar||0;});
  var meta=[[_f('Client','\u0627\u0644\u0639\u0645\u064a\u0644'),r.client_group],[_f('Name on invoice','\u0627\u0644\u0627\u0633\u0645 \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629'),r.customer_raw_name],[_f('ZATCA tax invoice','\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0636\u0631\u064a\u0628\u064a\u0629 (\u0632\u0627\u062a\u0643\u0627)'),r.zatca_dpin||_f('\u2014 (see notes)','\u2014 (\u0627\u0646\u0638\u0631 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a)')],[_f('Date','\u0627\u0644\u062a\u0627\u0631\u064a\u062e'),r.invoice_date+' \u00b7 '+r.month+' \u00b7 '+r.quarter],[_f('Received','\u0627\u0644\u0645\u062d\u0635\u0651\u0644'),money(t.rec)+' SAR'],[_f('Outstanding','\u0627\u0644\u0645\u062a\u0628\u0642\u064a'),money(t.rem)+' SAR'],[_f('Origin','النوع'),(r.origin==='project'?_f('Project — full project with a proposal','مشروع متكامل بعرض'):_f('Booking','حجز عادي'))],[_f('Proposal','العرض'),r.proposal_ref||'—'],[_f('Status','\u0627\u0644\u062d\u0627\u0644\u0629'),(function(st){var M={verified_paid:_f('Paid & verified','مدفوعة ومدققة'),pending:_f('Pending payment','بانتظار السداد'),credit_note:_f('Credit note (refund)','إشعار دائن (استرداد)'),excluded:_f('Excluded','مستبعدة')};return M[st]||st;})(r.integrity_status)],[_f('Notes','\u0645\u0644\u0627\u062d\u0638\u0627\u062a'),r.notes||'\u2014']];
  var th=function(x,rt){return '<th style="padding:6px 8px;text-align:'+(rt?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600">'+x+'</th>';};
  var lineTbl='<div style="overflow-x:auto;margin:6px 0 12px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>'+th(_f('Service','\u0627\u0644\u062e\u062f\u0645\u0629'))+th(_f('Description','\u0627\u0644\u0648\u0635\u0641'))+th(_f('Total','\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a'),1)+th(_f('Cost','\u0627\u0644\u062a\u0643\u0644\u0641\u0629'),1)+th(_f('Service fee','\u0631\u0633\u0648\u0645 \u0627\u0644\u062e\u062f\u0645\u0629'),1)+'</tr></thead><tbody>'+
    (function(){
      /* Real Direct Payments model: an invoice can hold several TRANSACTIONS
         (each with its own receipt ref); each transaction spans services. When
         lines carry transaction_ref, group them under transaction headers. */
      var hasTx=lines.some(function(x){return x.transaction_ref;});
      var out='',lastTx=null;
      var ordered=hasTx?lines.slice().sort(function(a,b){return String(a.transaction_ref||'').localeCompare(String(b.transaction_ref||''))||(a.line_no||1)-(b.line_no||1);}):lines;
      ordered.forEach(function(x){
        if(hasTx&&x.transaction_ref!==lastTx){lastTx=x.transaction_ref;
          var txLines=lines.filter(function(y){return y.transaction_ref===lastTx;});
          var txTot=txLines.reduce(function(a,y){return a+(+y.total_incl_vat_sar||0);},0);
          out+='<tr><td colspan="5" style="padding:7px 8px;background:#EEF0F5;font-weight:700;font-size:11.5px;color:#3a4f9e">'+_f('Transaction','المعاملة')+' '+escF(lastTx)+' · '+txLines.length+' '+_f('line(s)','بند')+' · '+money0(txTot)+' SAR</td></tr>';}
        out+='<tr style="border-top:1px solid #f0efe9"><td style="padding:6px 8px;font-weight:600">'+escF(svcLabel(x.service_type))+'</td><td style="padding:6px 8px;color:var(--muted)">'+escF(x.products||'\u2014')+'</td><td style="padding:6px 8px;text-align:right">'+money(x.total_incl_vat_sar)+'</td><td style="padding:6px 8px;text-align:right;color:#B54708">'+money(x.cost_sar)+'</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:#0F6E56">'+money(x.profit_sar)+'</td></tr>'+((x.items&&x.items.length)?('<tr><td colspan="5" style="padding:2px 10px 9px 24px;font-size:11.5px;color:var(--muted);background:#FCFBF9">'+x.items.map(function(it){return '• '+escF(it.d||'')+(it.q?(' × '+it.q):'')+(it.u?(' — '+money(it.u)+' SAR'):'');}).join('<br>')+'</td></tr>'):'');});
      return out;})()+
    '<tr style="border-top:2px solid #1C1E2B;background:#F3F1EA;font-weight:800"><td style="padding:7px 8px" colspan="2">'+_f('Invoice total','\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629')+' \u00b7 '+lines.length+' '+_f('service(s)','\u062e\u062f\u0645\u0629')+'</td><td style="padding:7px 8px;text-align:right">'+money(t.tot)+'</td><td style="padding:7px 8px;text-align:right;color:#B54708">'+money(t.cost)+'</td><td style="padding:7px 8px;text-align:right;color:#0F6E56">'+money(t.prof)+'</td></tr>'+/* VAT is stored (vat_sar) but NEVER shown — owner rule 2026-08-12: no VAT in any view or report */''+
    '</tbody></table></div>';
  var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(20,20,30,.45);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';ov.dir=ar?'rtl':'ltr';
  ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:660px;width:100%;max-height:85vh;overflow:auto;padding:22px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><h3 style="margin:0">'+_f('Invoice','\u0641\u0627\u062a\u0648\u0631\u0629')+' '+escF(r.invoice_no)+'</h3><div style="margin-'+(ar?'right':'left')+':auto;display:flex;gap:6px">'+(canFinEdit()&&!delState?'<button class="btn ghost sm" style="color:#D92D20" onclick="finDelInv(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Delete invoice','\u062d\u0630\u0641 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629')+'</button>':'')+(canFinEdit()&&delState?'<button class="btn ghost sm" onclick="finRestoreInv(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Restore','\u0627\u0633\u062a\u0631\u062c\u0627\u0639')+'</button>':'')+(r.proposal_ref?('<button class="btn ghost sm" onclick="finOpenProposal(\''+escF(r.proposal_ref).replace(/\x27/g,"\\\x27")+'\')">'+_f('Open proposal','فتح العرض')+'</button>'):'')+'<a class="btn ghost sm" target="_blank" rel="noopener" href="'+escF(pdInvoiceLink(r))+'" style="text-decoration:none">'+_f('Open in Direct ↗','فتحها في دايركت ↗')+'</a>'+'<button class="btn sm" onclick="finCloseModal()">'+_f('Close','\u0625\u063a\u0644\u0627\u0642')+'</button></div></div>'+
    lineTbl+
    meta.map(function(x){return '<div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid #f0efe9;font-size:13px"><div style="min-width:150px;color:var(--muted)">'+escF(x[0])+'</div><div style="font-weight:600;word-break:break-word">'+escF(x[1]==null?'\u2014':x[1])+'</div></div>';}).join('')+
    (canFinEdit()&&!delState?('<div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;border-top:1px solid #f0efe9;padding-top:10px"><b style="font-size:12.5px">'+_f('This invoice is:','هذه الفاتورة:')+'</b>'+
      '<select id="fin_origin" style="padding:6px 8px;border:1px solid var(--line-2,#e6e8ec);border-radius:8px;font:inherit;font-size:12.5px"><option value="booking" '+((r.origin||'booking')==='booking'?'selected':'')+'>'+_f('Normal booking','حجز عادي')+'</option><option value="project" '+(r.origin==='project'?'selected':'')+'>'+_f('Project (with a proposal)','مشروع (بعرض)')+'</option></select>'+
      '<input id="fin_pref" value="'+escF(r.proposal_ref||'')+'" placeholder="'+_f('Proposal ref — e.g. DB-500101','مرجع العرض')+'" style="padding:6px 8px;border:1px solid var(--line-2,#e6e8ec);border-radius:8px;font:inherit;font-size:12.5px;min-width:170px">'+
      '<button class="btn sm" onclick="finSetOrigin(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Save','حفظ')+'</button></div>'):'')+'</div>';
  ov.id='finModal';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
};
/* In-page confirm, not window.confirm() \u2014 a native dialog blocks the whole tab on its own
   modal loop, which froze the owner's own hands-on QA of this exact button (same failure the
   Payment proofs chapter had before js/57 introduced pfConfirm; this reuses that same box). */
function finConfirm(msg,onYes){
  try{ if(window.pfConfirm) return pfConfirm(msg,onYes); }catch(_){}
  if(confirm(msg))onYes(); // last-resort fallback if js/57 hasn't loaded for some reason
}
/* Bulletproof-round finding (2026-08-22): none of these four called .select() after
   .update(...) \u2014 Supabase/PostgREST returns no error when an RLS policy silently matches
   zero rows, so a delete/restore a viewer wasn't allowed to make looked like it worked (modal
   closes, row appears gone) and then reappeared on the next refresh with no explanation.
   Inert today (every active account is finance:editor \u2014 verified 0 non-editors), but it fires
   the day the owner sets a new hire to a role without finance-edit rights. */
window.finDelInv=function(invNo){
  if(!canFinEdit())return;
  var ar=isArF();
  finConfirm(ar?('\u062d\u0630\u0641 \u0643\u0644 \u0628\u0646\u0648\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 '+invNo+'\u061f \u062a\u062e\u062a\u0641\u064a \u0645\u0646 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062a\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639.'):('Soft-delete all lines of invoice '+invNo+'? It disappears from totals but stays recoverable.'), function(){
    fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('invoice_no',invNo).is('deleted_at',null).select().then(function(r){
      if(r.error){alert('Could not delete: '+r.error.message);return;}
      if(!r.data||!r.data.length){alert(ar?'\u0644\u0645 \u064a\u064f\u062d\u0630\u0641 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was deleted - your account was not allowed to.');return;}
      finCloseModal(); FIN.rows=null;finLoad();
    });
  });
};
window.finRestoreInv=function(invNo){
  var ar=isArF();
  fc().from('finance_invoices').update({deleted_at:null}).eq('invoice_no',invNo).not('deleted_at','is',null).select().then(function(r){
    if(r.error){alert('Could not restore: '+r.error.message);return;}
    if(!r.data||!r.data.length){alert(ar?'\u0644\u0645 \u064a\u064f\u0633\u062a\u0631\u062c\u0639 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was restored - your account was not allowed to.');return;}
    finCloseModal(); FIN.rows=null;finLoad();
  });
};
window.finCloseModal=function(){var m=document.getElementById('finModal');if(m)m.remove();};
window.finDel=function(id){
  if(!canFinEdit())return;
  var ar=isArF();
  finConfirm(ar?'\u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629\u061f \u062a\u062e\u062a\u0641\u064a \u0645\u0646 \u0643\u0644 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062a\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0645\u0646 \u00ab\u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0629 \u0645\u0624\u062e\u0631\u0627\u064b\u00bb.':'Soft-delete this invoice? It disappears from all totals but stays recoverable under "Recently deleted".', function(){
    fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('id',id).select().then(function(r){
      if(r.error){alert('Could not delete: '+r.error.message);return;}
      if(!r.data||!r.data.length){alert(ar?'\u0644\u0645 \u064a\u064f\u062d\u0630\u0641 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was deleted - your account was not allowed to.');return;}
      finCloseModal(); FIN.rows=null;finLoad();
    });
  });
};
window.finRestore=function(id){
  var ar=isArF();
  fc().from('finance_invoices').update({deleted_at:null}).eq('id',id).select().then(function(r){
    if(r.error){alert('Could not restore: '+r.error.message);return;}
    if(!r.data||!r.data.length){alert(ar?'\u0644\u0645 \u064a\u064f\u0633\u062a\u0631\u062c\u0639 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was restored - your account was not allowed to.');return;}
    finCloseModal(); FIN.rows=null;finLoad();
  });
};

var DIMS={__client:'Client (linked)',client_group:'Invoice group (raw)',month:'Month',quarter:'Quarter',service_type:'Service type',record_type:'Record type'};
var DIMS_AR={__client:'العميل (المرتبط)',client_group:'مجموعة الفواتير (كما وردت)',month:'الشهر',quarter:'الربع',service_type:'نوع الخدمة',record_type:'نوع السجل'};
function dimLbl(k){return isArF()?(DIMS_AR[k]||DIMS[k]):DIMS[k];}
function dimVal(r,dim){return dim==='__client'?finCanon(r.client_group).name:dim==='service_type'?svcLabel(r.service_type):(r[dim]||'—');}
var METS={revenue_sar:'Revenue',cost_sar:'Cost',profit_sar:'Profit',amount_received_sar:'Received',amount_remaining_sar:'Outstanding',_count:'Service lines'};
var METS_AR={revenue_sar:'الإيرادات',cost_sar:'التكلفة',profit_sar:'الربح',amount_received_sar:'المحصّل',amount_remaining_sar:'المتبقي',_count:'عدد البنود'};
function metLbl(k){return isArF()?(METS_AR[k]||METS[k]):METS[k];}
var MOI={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
/* Saved views (owner-requested 2026-08-26): the three report shapes people actually reach
   for, one click instead of five. Each just sets FIN.rb to a known-good combination and
   re-renders \u2014 nothing new is stored, so there is no schema change and no per-view
   persistence to keep in sync. "Collections chase" deliberately turns OFF verified-only:
   an unpaid invoice is exactly what collections needs to see, and it would never appear
   in the verified-paid set by definition. */
var RB_PRESETS={
  exec:{en:'Executive monthly',ar:'\u0645\u0644\u062e\u0635 \u0634\u0647\u0631\u064a \u062a\u0646\u0641\u064a\u0630\u064a',
    rb:{g1:'month',g2:'',quarter:'all',verifiedOnly:true,metrics:{revenue_sar:true,cost_sar:true,profit_sar:true}}},
  collect:{en:'Collections chase',ar:'\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062a\u062d\u0635\u064a\u0644',
    rb:{g1:'__client',g2:'',quarter:'all',verifiedOnly:false,metrics:{amount_received_sar:true,amount_remaining_sar:true}}},
  tax:{en:'Tax pack',ar:'\u062d\u0632\u0645\u0629 \u0627\u0644\u0625\u0642\u0631\u0627\u0631 \u0627\u0644\u0636\u0631\u064a\u0628\u064a',
    rb:{g1:'quarter',g2:'service_type',quarter:'all',verifiedOnly:true,metrics:{revenue_sar:true}}}
};
window.finRBPreset=function(key){
  var p=RB_PRESETS[key];if(!p)return;
  FIN.rb={g1:p.rb.g1,g2:p.rb.g2,quarter:p.rb.quarter,verifiedOnly:p.rb.verifiedOnly,metrics:Object.assign({},p.rb.metrics)};
  render();
};
function rbActivePreset(){
  var rb=FIN.rb,ks=Object.keys(RB_PRESETS);
  for(var i=0;i<ks.length;i++){
    var p=RB_PRESETS[ks[i]].rb;
    if(p.g1===rb.g1&&p.g2===rb.g2&&!!p.verifiedOnly===!!rb.verifiedOnly&&JSON.stringify(Object.keys(p.metrics).sort())===JSON.stringify(Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];}).sort()))return ks[i];
  }
  return null;
}
function rReports(){
  var rb=FIN.rb; clearFinCanon();
  var base=(rb.verifiedOnly?verified():live()).filter(function(r){return rb.quarter==='all'||r.quarter===rb.quarter;});
  var active=rbActivePreset();
  var h='<div class="card" style="padding:14px 16px;margin-bottom:12px;font-size:13px">';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><b>'+(isArF()?'\u0639\u0631\u0636 \u062c\u0627\u0647\u0632':'Quick views')+':</b>'+Object.keys(RB_PRESETS).map(function(k){
    var p=RB_PRESETS[k],on=active===k;
    return '<button class="btn sm'+(on?' pri':'')+'" style="'+(on?'':'background:#fff;border:1px solid var(--line,#ddd)')+'" onclick="finRBPreset(\''+k+'\')">'+(isArF()?p.ar:p.en)+'</button>';
  }).join('')+'</div>';
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center"><b>'+(isArF()?'\u062a\u062c\u0645\u064a\u0639 \u062d\u0633\u0628':'Group by')+':</b>';
  h+='<select style="'+SS+'" onchange="finRB(\'g1\',this.value)">'+Object.keys(DIMS).map(function(k){return '<option value="'+k+'" '+(rb.g1===k?'selected':'')+'>'+dimLbl(k)+'</option>';}).join('')+'</select>';
  h+='<span style="color:var(--muted)">'+(isArF()?'\u062b\u0645':'then')+'</span><select style="'+SS+'" onchange="finRB(\'g2\',this.value)"><option value="">\u2014 '+(isArF()?'\u0644\u0627 \u0634\u064a\u0621':'none')+' \u2014</option>'+Object.keys(DIMS).map(function(k){return k===rb.g1?'':'<option value="'+k+'" '+(rb.g2===k?'selected':'')+'>'+dimLbl(k)+'</option>';}).join('')+'</select>';
  h+='<select style="'+SS+'" onchange="finRB(\'quarter\',this.value)">'+opts(uniq(live().map(function(r){return r.quarter;})),rb.quarter,isArF()?'\u0643\u0644 \u0627\u0644\u0641\u062a\u0631\u0627\u062a':'All periods')+'</select>';
  h+='<label style="display:flex;gap:4px;align-items:center;cursor:pointer;font-size:12px"><input type="checkbox" '+(rb.verifiedOnly?'checked':'')+' onchange="finRB(\'verifiedOnly\',this.checked)"> '+(isArF()?'\u0627\u0644\u0645\u062f\u0642\u0642 \u0641\u0642\u0637':'Verified-paid only')+'</label></div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;align-items:center"><b>'+(isArF()?'\u0627\u0644\u0642\u064a\u0645':'Metrics')+':</b>'+Object.keys(METS).map(function(k){
    return '<label style="display:flex;gap:4px;align-items:center;cursor:pointer;font-size:12px"><input type="checkbox" '+(rb.metrics[k]?'checked':'')+' onchange="finRBM(\''+k+'\',this.checked)"> '+metLbl(k)+'</label>';
  }).join('')+'<button class="btn pri sm" style="margin-left:auto" onclick="finCSV()">\u2b07 '+(isArF()?'\u062a\u0635\u062f\u064a\u0631 CSV':'Export CSV')+'</button></div>';
  /* When grouping by the linked client, tell the user how many invoice groups aren't linked
     yet \u2014 those rows still appear, under their own name, so the total stays complete. */
  if(rb.g1==='__client'||rb.g2==='__client'){
    var seen={},unl=0; base.forEach(function(r){var cg=r.client_group||'';if(seen[cg])return;seen[cg]=1;if(!finCanon(r.client_group).linked)unl++;});
    h+='<div style="margin-top:10px;font-size:12px;color:'+(unl?'#8b5b1f':'#0F6E56')+'">'+(unl
      ? (isArF()?('\u26a0 '+unl+' \u0645\u062c\u0645\u0648\u0639\u0629 \u0641\u0648\u0627\u062a\u064a\u0631 \u063a\u064a\u0631 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0639\u0645\u064a\u0644 \u0628\u0639\u062f \u2014 \u062a\u0638\u0647\u0631 \u0628\u0627\u0633\u0645\u0647\u0627. <span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">\u0627\u0631\u0628\u0637\u0647\u0627 \u0627\u0644\u0622\u0646</span>')
              : ('\u26a0 '+unl+' invoice group'+(unl>1?'s':'')+' could not be matched to a client automatically \u2014 shown under their own name. <span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">Review them</span>'))
      : (isArF()?'\u2713 \u0643\u0644 \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0639\u0645\u064a\u0644.':'\u2713 Every invoice group is linked to a client.'))+'</div>';
  }
  /* Scope caption (2026-08-29, borrowed from Direct's own Marketing dashboards, which label
     every metric with exactly which invoice statuses feed it). Computed from the SAME rb
     state and the SAME base set the table below is built from — never a second copy of the
     rule — so what it says can't drift from what the numbers are. It also states plainly
     what this report does NOT do (follow the period bar), which was the silent gap logged in
     BACKLOG 2026-08-27; saying it on screen is not the design fix, but it stops a reader
     assuming a sector- or year-scoped number they never got. */
  var _rbN=base.length;
  var _capScope=rb.verifiedOnly
    ? (isArF()?'\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0636\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u062f\u0642\u0642\u0629 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u0642\u0637':'verified, fully-paid tax invoices only')
    : (isArF()?'\u0643\u0644 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u062d\u064a\u0629 \u2014 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0648\u063a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0645\u0639\u0627\u064b':'all live invoices, paid and unpaid together');
  var _capPeriod=rb.quarter==='all'?(isArF()?'\u0643\u0644 \u0627\u0644\u0641\u062a\u0631\u0627\u062a':'all periods'):rb.quarter;
  var _capTail=isArF()
    ? '\u0639\u0628\u0631 \u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0648\u0627\u0644\u0642\u0637\u0627\u0639\u0627\u062a \u2014 \u0634\u0631\u064a\u0637 \u0627\u0644\u0641\u062a\u0631\u0629 \u0623\u0639\u0644\u0627\u0647 \u0644\u0627 \u064a\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631. \u0627\u0644\u0645\u0644\u063a\u0627\u0629 \u0648\u0634\u062d\u0646 \u0627\u0644\u0645\u062d\u0641\u0638\u0629 \u0648\u0627\u0644\u062c\u0647\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0628\u0639\u062f\u0629 \u0644\u0627 \u062a\u064f\u062d\u0633\u0628 \u0623\u0628\u062f\u0627\u064b.'
    : 'across all years and sectors \u2014 the period bar above does not apply to this report. Void, wallet top-ups and excluded partners are never counted.';
  h+='<div id="rb-caption" data-scope="'+(rb.verifiedOnly?'verified':'all')+'" data-n="'+_rbN+'" style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#F8F7F4;font-size:12px;color:#444;line-height:1.5">'
    +'<b>'+(isArF()?'\u0645\u0627 \u0627\u0644\u0630\u064a \u064a\u064f\u062d\u0633\u0628 \u0647\u0646\u0627':'What this report counts')+':</b> '+_capScope+' \u00b7 '+_capPeriod+', '+_capTail+' <span style="color:var(--muted)">('+_rbN+' '+(isArF()?'\u0641\u0627\u062a\u0648\u0631\u0629':'invoice'+(_rbN===1?'':'s'))+')</span></div>';
  h+='</div>';
  var mets=Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];});
  if(!mets.length)mets=['revenue_sar'];
  var g={};
  base.forEach(function(r){
    var k1=dimVal(r,rb.g1),k2=rb.g2?dimVal(r,rb.g2):null;
    g[k1]=g[k1]||{__sub:{},__tot:{},__rows:[],__subRows:{}};
    /* Keep the actual invoice rows behind every total. The drill-down (chapter 25, part 3)
       opens THESE rows — not a second copy of this filter written somewhere else — so what
       a row expands to always adds up to the row it expanded from. */
    g[k1].__rows.push(r);
    if(k2){var s=g[k1].__sub[k2]=g[k1].__sub[k2]||{};mets.forEach(function(m){s[m]=(s[m]||0)+(m==='_count'?1:+r[m]);});
      (g[k1].__subRows[k2]=g[k1].__subRows[k2]||[]).push(r);}
    mets.forEach(function(m){g[k1].__tot[m]=(g[k1].__tot[m]||0)+(m==='_count'?1:+r[m]);});
  });
  var keys=Object.keys(g);
  if(rb.g1==='month')keys.sort(function(a,b){return (MOI[a]||99)-(MOI[b]||99);});
  else if(rb.g1==='quarter')keys.sort();
  else keys.sort(function(a,b){return (g[b].__tot[mets[0]]||0)-(g[a].__tot[mets[0]]||0);});
  var grand={};
  keys.forEach(function(k){mets.forEach(function(m){grand[m]=(grand[m]||0)+(g[k].__tot[m]||0);});});
  FIN._lastReport={g1:rb.g1,g2:rb.g2,mets:mets,keys:keys,g:g,grand:grand};
  var h2='<div class="card" style="padding:0;overflow:auto;max-height:60vh"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:600px"><thead><tr style="position:sticky;top:0;background:#F8F7F4;z-index:2;text-align:left;color:var(--muted)"><th style="padding:8px">'+dimLbl(rb.g1)+(rb.g2?' \u203a '+dimLbl(rb.g2):'')+'</th>'+mets.map(function(m){return '<th style="padding:8px;text-align:right">'+metLbl(m)+'</th>';}).join('')+'</tr></thead><tbody>';
  keys.forEach(function(k){
    h2+='<tr data-rbk="'+escF(k)+'" style="border-top:1px solid var(--line,#eee);background:'+(rb.g2?'#FBFAF7':'#fff')+'"><td style="padding:7px 8px;font-weight:700">'+escF(k)+'</td>'+mets.map(function(m){return '<td style="padding:7px 8px;text-align:right;font-weight:700">'+(m==='_count'?g[k].__tot[m]:money0(g[k].__tot[m]))+'</td>';}).join('')+'</tr>';
    if(rb.g2){
      var subs=Object.keys(g[k].__sub);
      if(rb.g2==='month')subs.sort(function(a,b){return (MOI[a]||99)-(MOI[b]||99);});else subs.sort();
      subs.forEach(function(s){
        h2+='<tr data-rbk="'+escF(k)+'" data-rbs="'+escF(s)+'" style="border-top:1px solid #f4f2ec"><td style="padding:5px 8px 5px 26px;color:var(--muted)">'+escF(s)+'</td>'+mets.map(function(m){return '<td style="padding:5px 8px;text-align:right">'+(m==='_count'?(g[k].__sub[s][m]||0):money0(g[k].__sub[s][m]||0))+'</td>';}).join('')+'</tr>';
      });
    }
  });
  h2+='<tr style="border-top:2px solid #1C1E2B;background:#F3F1EA"><td style="padding:9px 8px;font-weight:800">'+(isArF()?'\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a':'TOTAL')+'</td>'+mets.map(function(m){return '<td style="padding:9px 8px;text-align:right;font-weight:800">'+(m==='_count'?grand[m]:money0(grand[m]))+'</td>';}).join('')+'</tr></tbody></table></div>';
  return h+h2;
}
window.finRB=function(k,v){FIN.rb[k]=v;if(k==='g1'&&FIN.rb.g2===v)FIN.rb.g2='';render();};
window.finRBM=function(k,v){FIN.rb.metrics[k]=v;render();};
window.finCSV=function(){
  var R=FIN._lastReport;if(!R)return;
  var out=[[DIMS[R.g1]+(R.g2?' / '+DIMS[R.g2]:'')].concat(R.mets.map(function(m){return METS[m];}))];
  R.keys.forEach(function(k){
    out.push([k].concat(R.mets.map(function(m){return R.g[k].__tot[m]||0;})));
    if(R.g2)Object.keys(R.g[k].__sub).forEach(function(s){out.push(['  '+k+' \u203a '+s].concat(R.mets.map(function(m){return R.g[k].__sub[s][m]||0;})));});
  });
  out.push(['TOTAL'].concat(R.mets.map(function(m){return R.grand[m]||0;})));
  var csv='\ufeff'+out.map(function(r){return r.map(function(c){c=csvGuard(c);return (c.indexOf(',')>=0||c.indexOf('"')>=0||c.charCodeAt(0)===39)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Direct-Finance-Report-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};

function rImport(){
  var _fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  if(!canFinEdit())return '<div class="card" style="padding:30px;text-align:center;color:var(--muted)">'+_fl('Import is restricted to admins and managers.','الاستيراد متاح للمدراء والمسؤولين فقط.')+'</div>';
  var h='<div class="card" style="padding:18px;max-width:860px">';
  h+='<h3 style="margin:0 0 8px">'+_fl('Import invoices (CSV)','استيراد الفواتير (CSV)')+'</h3>';
  // 2026-08-25: dropped the raw 14-column header dump and the "optional columns" filler
  // (density/copy pass, owner-directed) — v65's own signatures auto-detect the real column
  // set on drop, so a hand-typed CSV spec here was stale prose explaining our own plumbing,
  // not something a user needs to read. Kept, shortened: the one load-bearing safety promise.
  h+='<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">'+_fl('Nothing is written until you confirm the preview.','لا يُكتب شيء قبل تأكيدك للمعاينة.')+'</div>';
  h+='<div id="finDrop" style="border:2px dashed #C9CDD6;border-radius:12px;padding:22px;text-align:center;color:var(--muted);font-size:13px;margin-bottom:12px;cursor:pointer" onclick="document.getElementById(\'finFile\').click()">⬇ '+_fl('Drop a CSV file here, or click to choose','أفلت ملف CSV هنا أو انقر للاختيار')+'</div>';
  h+='<input type="file" id="finFile" accept=".csv" style="font-size:13px"> <button class="btn pri sm" onclick="finParse()">'+_fl('Check file','فحص الملف')+'</button>';
  h+='<div id="finImpOut" style="margin-top:14px"></div></div>';
  setTimeout(function(){
    var dz=document.getElementById('finDrop');if(!dz||dz.__wired)return;dz.__wired=1;
    dz.addEventListener('dragover',function(e){e.preventDefault();dz.style.borderColor='#F47A1F';dz.style.background='#FFF3EC';});
    dz.addEventListener('dragleave',function(){dz.style.borderColor='#C9CDD6';dz.style.background='';});
    dz.addEventListener('drop',function(e){
      e.preventDefault();dz.style.borderColor='#C9CDD6';dz.style.background='';
      var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(!f)return;
      var inp=document.getElementById('finFile');
      try{var dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;}catch(_e){}
      if(inp.files&&inp.files.length)finParse();
    });
  },0);
  return h;
}
function csvParse(text){
  text=text.replace(/^\ufeff/,'');
  var rows=[],row=[],cur='',inQ=false;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; } else cur+=ch; }
    else if(ch==='"')inQ=true;
    else if(ch===','){row.push(cur);cur='';}
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')rows.push(row); row=[]; }
    else cur+=ch;
  }
  if(cur!==''||row.length){row.push(cur);if(row.length>1||row[0]!=='')rows.push(row);}
  return rows;
}
var QM={Q1:[1,3],Q2:[4,6],Q3:[7,9],Q4:[10,12]};
window.finParse=function(){
  var f=document.getElementById('finFile').files[0];
  if(!f){var _ar=(typeof LANG!=='undefined'&&LANG==='ar');var _m=_ar?'اختر ملف CSV أولاً.':'Choose a CSV file first.';if(typeof toast==='function')toast(_m);else alert(_m);return;}
  var rd=new FileReader();
  rd.onload=function(){
    var rows=csvParse(String(rd.result));
    var BASE='client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
    var hdr=rows[0]||[],hj=hdr.join(',').trim();
    var hasExtra=(hj===BASE+',origin,proposal_ref');
    // 2026-08-24: this is the LEGACY single-format checker (js/65-universal-importer.js's
    // v65WireImportPanel() rebinds "Check file" away from this the instant the Import tab is
    // wired — which is now immediate, but this label stays as a second, explicit signal in
    // case it's ever seen again, so a rejection here is never mistaken for "your file is
    // wrong" the way the owner did on 2026-08-24 (docs/DECISIONS.md M12).
    if(hj!==BASE&&!hasExtra){document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px"><b>Legacy single-format checker</b> — expects the original Invoice Export columns exactly, nothing else (not expense lines, transaction status, or tax invoices). If you dropped one of those newer file types, this is very likely the wrong checker, not a wrong file — reload this tab, or wait a second and press Check file again. Header does not match the expected format. Found:<br><code style="font-size:11px;word-break:break-all">'+escF(hdr.join(','))+'</code></div>';return;}
    var HDR=(hasExtra?BASE+',origin,proposal_ref':BASE).split(',');
    var existing={};(FIN.rows||[]).forEach(function(r){existing[r.invoice_no]=1;});
    var seen={},ok=[],dups=[],flagged=[];
    rows.slice(1).forEach(function(c,idx){
      if(c.length<9)return;
      var o={};HDR.forEach(function(k,i){o[k]=(c[i]||'').trim();});
      if(!o.invoice_no)return;
      var line=idx+2, probs=[];
      if(existing[o.invoice_no]||seen[o.invoice_no]){dups.push({line:line,no:o.invoice_no});return;}
      seen[o.invoice_no]=1;
      var numF=function(s){s=String(s==null?'':s).replace(/[,\s\u00a0]/g,'');var n=parseFloat(s);return isFinite(n)?n:0;};var tot=numF(o.total_incl_vat_sar),wal=numF(o.wallet_portion_sar),rev=numF(o.revenue_sar),cost=numF(o.cost_sar),prof=numF(o.profit_sar);
      if(Math.abs((tot-wal)-rev)>0.01)probs.push('revenue != total-wallet ('+money(tot-wal)+' expected)');
      if(Math.abs((rev-cost)-prof)>0.01)probs.push('profit != revenue-cost ('+money(rev-cost)+' expected)');
      o.quarter=String(o.quarter||'').trim().toUpperCase();var d=new Date(o.invoice_date+'T00:00:00'),qr=QM[o.quarter];
      if(isNaN(d.getTime()))probs.push('bad date');
      else if(qr&&((d.getMonth()+1)<qr[0]||(d.getMonth()+1)>qr[1]))probs.push('date outside stated quarter');
      var st=o.integrity_status||'verified_paid';
      if(tot<0||/credit/i.test(o.products))st='credit_note';
      var org=String(o.origin||'').trim().toLowerCase();
      // Product-type rule: scans only the products field, never free-text notes — an
      // unrelated row that happens to mention "verification" in its notes must not be
      // caught (Spec 4 item 1, 2026-08-21).
      if(/techtic|verification|توثيق/i.test(String(o.products||'')))probs.push('verification services are accounted for elsewhere — not imported into this ledger');
      // Client-identity rule: a SEPARATE check, by client ID via the exclusion list
      // (js/62) — this is the actual fix for the reported bug. Excluding a company (e.g.
      // Takamol) must never rest on which product a given row happens to be for; the old
      // product-only regex let Takamol's non-verification invoices straight through.
      var xhit16=(typeof window.finExclusionCheck==='function')?window.finExclusionCheck(o.client_group):null;
      if(xhit16)probs.push('excluded client (#'+xhit16.clientId+(xhit16.reason?(': '+xhit16.reason):'')+') — not imported into this ledger');
      /* Same rule as the Direct Payments importer (js/41): wallet top-ups are never Finance
         revenue and must never enter this ledger under any label. The Excel importer already
         detects and skips them before they reach a row; this legacy CSV path had no equal
         guard — a row whose products/notes mentioned "wallet" or "top-up" would have been
         classified service_type='Wallet top-up' by svcType() below and imported as real
         revenue. Found 2026-08-20 while closing the same gap in the Individual-bookings form. */
      if(/wallet|top-up|topup|محفظة/i.test(String(o.products||'')+' '+String(o.notes||'')))probs.push('wallet top-ups are never Finance revenue — not imported into this ledger (see Payment proofs for the document trail)');
      if(org&&org!=='booking'&&org!=='project')probs.push('origin must be booking or project');
      if(org==='project'&&!String(o.proposal_ref||'').trim())probs.push('project rows need a proposal_ref');
      if(probs.length){flagged.push({line:line,no:o.invoice_no,probs:probs});return;}
      ok.push({invoice_no:o.invoice_no,zatca_dpin:o.zatca_dpin||null,client_group:o.client_group,customer_raw_name:o.customer_raw_name||null,invoice_date:o.invoice_date,month:o.month,quarter:o.quarter,products:o.products||null,service_type:svcType(o.products),record_type:'b2b',total_incl_vat_sar:tot,wallet_portion_sar:wal,revenue_sar:rev,cost_sar:cost,profit_sar:prof,amount_received_sar:st==='verified_paid'?tot:0,amount_remaining_sar:0,integrity_status:st,notes:o.notes||null,origin:org||'booking',proposal_ref:String(o.proposal_ref||'').trim()||null,source_batch:'import '+new Date().toISOString().slice(0,10)});
    });
    var trev=0,tcost=0,tprof=0;ok.forEach(function(r){trev+=r.revenue_sar;tcost+=r.cost_sar;tprof+=r.profit_sar;});
    var unkRef=ok.filter(function(r){return r.proposal_ref&&!((typeof DB!=='undefined'&&DB.offers)||[]).some(function(o){return o.ref===r.proposal_ref;});}).length;
    FIN._pending=ok;
    var h='<div style="font-size:13px;line-height:1.8"><b>Preview \u2014 nothing written yet:</b><br>\u2705 Ready to import: <b>'+ok.length+'</b> rows \u00b7 revenue '+money(trev)+' \u00b7 cost '+money(tcost)+' \u00b7 profit '+money(tprof)+'<br>';
    if(dups.length)h+='\u23ed Skipped duplicates (already in the ledger): <b>'+dups.length+'</b> \u2014 '+dups.slice(0,8).map(function(d){return d.no;}).join(', ')+(dups.length>8?'\u2026':'')+'<br>';
    if(flagged.length)h+='\u26a0 Flagged for review (NOT imported): <b>'+flagged.length+'</b><br>'+flagged.slice(0,10).map(function(fl){return '<span style="font-size:11.5px;color:#8b5b1f">line '+fl.line+' \u00b7 '+escF(fl.no)+' \u2014 '+escF(fl.probs.join('; '))+'</span>';}).join('<br>')+(flagged.length>10?'<br>\u2026':'')+'<br>';
    if(unkRef)h+='<span style="font-size:12px;color:#8b5b1f">\u26a0 '+unkRef+' project row(s) name a proposal that is not in the app yet \u2014 the link will say "no proposal" until it exists.</span><br>';
    h+=(ok.length?'<button class="btn pri sm" style="margin-top:8px" onclick="finCommit()">Confirm import of '+ok.length+' rows</button>':'')+'</div>';
    document.getElementById('finImpOut').innerHTML=h;
  };
  rd.readAsText(f,'utf-8');
};
function svcType(p){
  p=String(p||'');
  if(p.indexOf('+')>=0)return 'Mixed';
  var lc=p.toLowerCase();
  var m=[
    [['direct flights','flight','airfare','air ticket','ticket','طيران','تذكر'],'Flights'],
    [['direct hotels','hotel','accommodation','room','فندق','إقام'],'Hotels'],
    [['direct visa','visa','تأشير'],'Visas'],
    [['direct course','course','training','study','دورة','تدريب'],'Courses'],
    /* No 'Wallet top-up' branch here on purpose — the caller now rejects wallet-mentioning
       rows before svcType() ever runs, and this function must never be able to hand back
       that label to any future caller that forgets to add the same guard. */
    [['support service','دعم'],'Support Services'],
    [['transport','transfer','car','bus','نقل'],'Transport'],
    [['insurance','تأمين'],'Insurance'],
    [['package','umrah','hajj','trip','tour','برنامج','عمرة','رحل'],'Packages']
  ];
  for(var i=0;i<m.length;i++)for(var j=0;j<m[i][0].length;j++)if(lc.indexOf(m[i][0][j])>=0)return m[i][1];
  return 'Other';
}
window.finCommit=function(){
  var P=FIN._pending||[];if(!P.length)return;
  FIN._pending=null; // double-click cannot import twice
  document.getElementById('finImpOut').innerHTML='<div style="font-size:13px">Importing '+P.length+' rows\u2026</div>';
  var c=fc(),i=0,errs=[];
  function next(){
    if(i>=P.length){
      document.getElementById('finImpOut').innerHTML='<div style="font-size:13px;color:#0F6E56"><b>Done.</b> Imported '+(P.length-errs.length*50<0?0:P.length)+' rows'+(errs.length?' with errors: <span style="color:#D92D20">'+escF(errs.slice(0,5).join('; '))+'</span>':'')+'.</div>';
      FIN.rows=null;FIN._pending=null;finLoad();
      return;
    }
    var batch=P.slice(i,i+50);i+=50;
    c.from('finance_invoices').insert(batch).then(function(r){
      if(r.error)errs.push(r.error.message);
      next();
    });
  }
  next();
};

window.renderFinance=function(v){
  if(!canFinView()){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Finance is not available in shared view-only links.</div>';return;}
  if(!FIN.rows){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Loading the finance ledger\u2026</div>';finLoad();return;}
  if(FIN.loadErr){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:#D92D20">Could not load: '+escF(FIN.loadErr)+'<br><span style="font-size:12px;color:var(--muted)">Make sure you are signed in.</span></div>';return;}
  var body=FIN.tab==='ledger'?rLedger():FIN.tab==='clients'?rFinClients():FIN.tab==='reports'?rReports():FIN.tab==='import'?rImport():rOverview();
  v.innerHTML=finTabs()+body;
};

try{
  var _rF=window.render;
  window.render=function(){
    var o=_rF.apply(this,arguments);
    try{ if(current==='finance'){var v=document.getElementById('view');if(v)renderFinance(v);} }catch(e){console.warn('v42 finance render',e);}
    return o;
  };
}catch(e){console.warn('v42 hook',e);}

try{ if(!window.__isShareView&&/^\/finance\/?$/.test(location.pathname)){ setTimeout(function(){try{current='finance';render();}catch(_){}},600);} }catch(_){}

console.info('%c[v42 finance ledger] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v42 layer failed',e);}})();
