/* ===== v42 layer: FINANCE — master invoice ledger + report builder + import (additive, safe) ===== */
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
        if(cb)cb();
        try{if(current==='finance')render();}catch(_){}
      });
    });
  }
}
try{window.FIN=FIN;window.finLoad=finLoad;}catch(_){}  // expose for the Customer-360 finance snapshot (v29)
function live(){ return (FIN.rows||[]).filter(function(r){return !r.deleted_at;}); }
function verified(){return live().filter(function(r){return r.integrity_status==='verified_paid';});}

/* --- Period structure (owner-directed 2026-08-11) ------------------------------------
   Finance is read monthly / quarterly / half-yearly / annually. ONE period state drives
   every Overview number; nothing is stored per period — all sums stay derived live from
   the raw rows (the storage doctrine). part: all | Q1..Q4 | H1 | H2 | M:<MonthName>. */
FIN.p=FIN.p||{year:'all',part:'all'};
function finYearOf(r){return r.year||(r.invoice_date?+String(r.invoice_date).slice(0,4):null);}
function finInPeriod(r){
  var p=FIN.p||{year:'all',part:'all'};
  if(p.year!=='all'&&String(finYearOf(r))!==String(p.year))return false;
  var pt=p.part||'all';
  if(pt==='all')return true;
  if(pt==='H1')return r.quarter==='Q1'||r.quarter==='Q2';
  if(pt==='H2')return r.quarter==='Q3'||r.quarter==='Q4';
  if(/^Q[1-4]$/.test(pt))return r.quarter===pt;
  if(pt.indexOf('M:')===0)return r.month===pt.slice(2);
  return true;
}
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
window.finCSV=function(){
  var L=FIN._csvRows||[]; if(!L.length){alert(isArF()?'لا صفوف للتصدير':'No rows to export');return;}
  var cols=['invoice_date','invoice_no','zatca_dpin','client_group','service_type','products','origin','proposal_ref','month','quarter','year','total_incl_vat_sar','revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','integrity_status'];
  var csv='\ufeff'+cols.join(',')+'\n'+L.map(function(r){return cols.map(function(c){var v=r[c];v=(v==null)?'':String(v);return '"'+v.replace(/"/g,'""')+'"';}).join(',');}).join('\n');
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
function clearFinCanon(){ _finCanonCache={}; }
function _finBizName(uuid){
  try{
    var list=(typeof DB!=='undefined'&&DB.businesses)||[];
    for(var i=0;i<list.length;i++){
      var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
      if(uu===uuid)return list[i].name||null;
    }
  }catch(_){}
  return null;
}
function finCanon(clientGroup){
  var ck=(clientGroup==null?'':clientGroup);
  if(_finCanonCache[ck]!==undefined)return _finCanonCache[ck];
  var disp=(ck==='')?'—':ck, res;
  var l=(FIN.linkByGroup||{})[clientGroup];
  if(l&&l.is_client===false){
    res={key:'__indiv__',name:isArF()?'أفراد / ليس عميلاً':'Individuals / not a client',linked:true};
  }else if(l&&l.business_id){
    var nm=_finBizName(l.business_id);
    res=nm?{key:'biz:'+l.business_id,name:nm,linked:true}:{key:'raw:'+disp,name:disp,linked:false};
  }else{
    res={key:'raw:'+disp,name:disp,linked:false};
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
  ['Wallet top-up','شحن المحفظة'],['Support Services','خدمات الدعم'],['eSIM','شرائح eSIM'],
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
  'Other services':{ar:'خدمات أخرى',svcs:['Support Services','eSIM','Insurance','Shipping','VIP meet & assist','Wallet top-up','Mixed','Other','(unspecified)']}
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
window.finGo=function(t){FIN.tab=t;render();};

function finPeriodBar(){
  var years=uniq(live().map(function(r){var y=finYearOf(r);return y?String(y):'';}));
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'].filter(function(m){return live().some(function(r){return r.month===m;});});
  var chip=function(val,lbl){return '<button class="btn sm '+((FIN.p.part===val)?'pri':'ghost')+'" onclick="finPP(\''+val+'\')">'+lbl+'</button>';};
  var s='<style>.finh{border-inline-start:4px solid #F06820;padding-inline-start:10px;margin:0 0 12px;font-size:15px;line-height:1.35}.finh i{font-style:normal;display:block;font-size:11px;color:var(--muted);font-weight:500}.finpill{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}</style>';
  s+='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">'+(isArF()?'\u0627\u0644\u0641\u062a\u0631\u0629':'Period')+'</b>'
   +'<select style="'+SS+'" onchange="finPY(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062a':'All years')+'</option>'+years.map(function(y){return '<option '+(String(FIN.p.year)===y?'selected':'')+'>'+y+'</option>';}).join('')+'</select>'
   +chip('all',isArF()?'\u0627\u0644\u0643\u0644':'All')+chip('Q1','Q1')+chip('Q2','Q2')+chip('Q3','Q3')+chip('Q4','Q4')+chip('H1','H1')+chip('H2','H2')
   +'<select style="'+SS+'" onchange="finPP(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0634\u0647\u0648\u0631':'All months')+'</option>'+months.map(function(m){return '<option value="M:'+m+'" '+(FIN.p.part==='M:'+m?'selected':'')+'>'+(isArF()?(MO_AR[m]||m):m)+'</option>';}).join('')+'</select>'
   +'<span style="margin-inline-start:auto;font-size:11px;color:var(--muted)">'+(isArF()?'\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u062a\u0634\u0645\u0644 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0642\u0642\u0629 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0641\u0642\u0637':'Totals count verified-paid invoices only')+' \u00b7 <b>'+finPeriodLabel()+'</b></span></div>';
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
  // ---- Collections & AR aging (DSO · % overdue · aging buckets) — from all live invoices, no name matching ----
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
  var _mini=function(lbl,val,col){return '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+val+'</div></div>';};
  var _agc=function(lbl,val){return '<div style="flex:1;min-width:90px;background:#F9FAFB;border-radius:8px;padding:8px 10px"><div style="font-size:10.5px;color:var(--muted)">'+lbl+'</div><div style="font-weight:800;font-size:14px">'+moneyS(val)+' <span style="font-size:9px;font-weight:400">SAR</span></div></div>';};
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 4px">'+_fl('Collections & AR aging','التحصيل وتقادم الذمم')+'</h3>'+
     '<div class="ch-sub" style="margin-bottom:12px">'+_fl('Uncollected money and how old it is.','الأموال غير المحصّلة وأعمارها.')+'</div>'+
     '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:'+(arOut>0?'14px':'0')+'">'+
       _mini(_fl('DSO (days to collect)','مدة التحصيل (أيام)'),dso,'#175CD3')+
       _mini(_fl('% overdue','٪ المتأخر'),pctOver+'%',pctOver>0?'#D92D20':'#0F6E56')+
       _mini(_fl('Outstanding (AR)','إجمالي المستحق'),moneyS(arOut)+' SAR',arOut>0?'#D92D20':'#667085')+
     '</div>'+
     (arOut>0?('<div style="display:flex;gap:8px;flex-wrap:wrap">'+_agc(_fl('0–30 days','0–30 يوم'),ag.b030)+_agc(_fl('31–60 days','31–60 يوم'),ag.b3160)+_agc(_fl('61–90 days','61–90 يوم'),ag.b6190)+_agc(_fl('90+ days','90+ يوم'),ag.b90)+'</div>')
       :('<div style="font-size:12px;color:#0F6E56">✓ '+_fl('No outstanding receivables in this period.','لا توجد مستحقات في هذه الفترة.')+'</div>'))+
     '</div>';
  var byC={};V.forEach(function(r){var cc=finCanon(r.client_group);var k=cc.name;byC[k]=byC[k]||{r:0,c:0,p:0,_i:{},key:cc.key};byC[k].r+=+r.revenue_sar;byC[k].c+=+r.cost_sar;byC[k].p+=+r.profit_sar;byC[k]._i[r.invoice_no]=1;});Object.keys(byC).forEach(function(k){byC[k].n=Object.keys(byC[k]._i).length;});
  var top=Object.keys(byC).sort(function(a,b){return byC[b].r-byC[a].r;}).slice(0,10);
  var _tc={r:0,c:0,p:0};Object.keys(byC).forEach(function(k){_tc.r+=byC[k].r;_tc.c+=byC[k].c;_tc.p+=byC[k].p;});
  h+='<div class="card" style="padding:16px"><h3 class="finh" style="margin:0 0 10px">'+(isArF()?'أعلى العملاء':'Top clients by revenue')+'<i>'+finPeriodLabel()+'</i></h3><div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:480px"><tr style="background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+'"><th style="padding:7px 9px">'+(isArF()?'العميل':'Client')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الإيرادات':'Revenue')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'التكلفة':'Cost')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الربح':'Profit')+'</th></tr>'+top.map(function(k){
    return '<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" onclick="finClient(\''+escF(byC[k].key).replace(/'/g,"\\'")+'\',\''+escF(k).replace(/'/g,"\\'")+'\')"><td style="padding:6px 9px;font-weight:600">'+escF(k)+'</td><td style="padding:6px 9px;text-align:right;font-weight:700">'+money0(byC[k].r)+'</td><td style="padding:6px 9px;text-align:right;color:#B54708">'+money0(byC[k].c)+'</td><td style="padding:6px 9px;text-align:right;color:#0F6E56;font-weight:700">'+money0(byC[k].p)+'</td></tr>';
  }).join('')+'<tr style="background:#303848;color:#fff;font-weight:800"><td style="padding:7px 9px">'+(isArF()?'الإجمالي الكلي':'Total')+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.r)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.c)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.p)+'</td></tr></table></div></div>';
  return h;
}
function rOverview(){
  clearFinCanon();
  var V=verified().filter(finInPeriod);
  var rev=0,cost=0,prof=0,rec=0,rem=0,wal=0;
  V.forEach(function(r){rev+=+r.revenue_sar;cost+=+r.cost_sar;prof+=+r.profit_sar;rec+=+r.amount_received_sar;rem+=+r.amount_remaining_sar;wal+=+r.wallet_portion_sar;});
  var invCount=new Set(V.map(function(r){return r.invoice_no;})).size; // distinct invoices, not service lines
  /* Period bar \u2014 the executive-dashboard structure: year \u00b7 All/Q1\u2013Q4/H1/H2 \u00b7 month */
  var h=finPeriodBar();

  var cards=[[isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue',rev,'#0F6E56'],[isArF()?'\u0627\u0644\u062a\u0643\u0644\u0641\u0629':'Cost',cost,'#B54708'],[isArF()?'\u0627\u0644\u0631\u0628\u062d':'Profit',prof,'#175CD3'],[isArF()?'\u0627\u0644\u0645\u062d\u0635\u0651\u0644':'Received',rec,'#0F6E56'],[isArF()?'\u0627\u0644\u0645\u062a\u0628\u0642\u064a':'Outstanding',rem,rem>0?'#D92D20':'#667085'],[isArF()?'\u0645\u062d\u0641\u0638\u0629 (\u0645\u0633\u062a\u0628\u0639\u062f)':'Wallet (excluded)',wal,'#667085'],[isArF()?'\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631':'Invoices',invCount,'#1C1E2B']];
  h+='<h3 class="finh">'+(isArF()?'\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629':'Key indicators')+'<i>'+finPeriodLabel()+' \u00b7 '+(isArF()?'\u0641\u0639\u0644\u064a \u2014 \u0645\u0646 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0642\u0642\u0629':'actual \u2014 from verified invoices')+'</i></h3>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin-bottom:14px">'+cards.map(function(c,i){
    return '<div class="card" style="padding:14px 16px;border-top:3px solid '+c[2]+'"><div style="font-size:11px;color:var(--muted)">'+c[0]+'</div><div style="font-size:'+(i===cards.length-1?'22px':'19px')+';font-weight:800;color:'+c[2]+'" title="'+(i===cards.length-1?'':money(c[1])+' SAR')+'">'+(i===cards.length-1?c[1]:moneyS(c[1]))+(i===cards.length-1?'':' <span style="font-size:10px;font-weight:400">SAR</span>')+'</div></div>';
  }).join('')+'</div>';
  /* Plan vs actual (executive dashboard: expected/confirmed/actual) — actuals derived live. */
  var _ty=(FIN.p.year!=='all')?+FIN.p.year:(new Date()).getFullYear();
  var tgt=(FIN.targets||[]).find(function(t){return +t.year===_ty;});
  var frac=1,fLbl='';
  if(FIN.p.part!=='all'){ frac=(/^Q/.test(FIN.p.part))?0.25:(/^H/.test(FIN.p.part))?0.5:(FIN.p.part.indexOf('M:')===0?1/12:1); fLbl=isArF()?' · تقديري نسبةً للفترة':' · pro-rated for the period'; }
  if(tgt||canFinEdit()){
    var _exp=tgt?Math.round((+tgt.expected_sar||0)*frac):0, _conf=tgt?Math.round((+tgt.confirmed_sar||0)*frac):0;
    var _att=_exp>0?Math.min(100,Math.round(rev/_exp*100)):0;
    h+='<div class="card" style="padding:16px;margin-bottom:14px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 class="finh" style="margin:0">'+(isArF()?'الخطة مقابل الفعلي':'Plan vs actual')+'<i>'+_ty+fLbl+'</i></h3>'+(canFinEdit()?('<button class="btn sm" onclick="finSetTargets('+_ty+')">'+(isArF()?'تعديل الأرقام':'Set targets')+'</button>'):'')+'</div>';
    if(tgt){
      var _pm=function(lbl,val,col){return '<div style="flex:1;min-width:120px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+moneyS(val)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>';};
      h+='<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">'
        +_pm(isArF()?'متوقع':'Expected',_exp,'#B54708')
        +_pm(isArF()?'مؤكد (عقود)':'Confirmed (signed)',_conf,'#175CD3')
        +_pm(isArF()?'فعلي (مدقق)':'Actual (verified)',rev,'#0F6E56')
        +'<div style="flex:2;min-width:180px"><div style="font-size:11px;color:var(--muted)">'+(isArF()?'نسبة تحقق المتوقع':'Of expected achieved')+' · '+_att+'%</div><div style="background:#EEF0F5;border-radius:8px;height:14px;margin-top:8px;overflow:hidden"><div style="height:100%;width:'+_att+'%;background:linear-gradient(90deg,#E54525,#F26721)"></div></div></div>'
        +'</div>';
    } else {
      h+='<div class="ch-sub" style="margin-top:8px">'+(isArF()?'لا توجد أرقام خطة لهذه السنة بعد — اضغط «تعديل الأرقام».':'No plan numbers for this year yet — click Set targets.')+'</div>';
    }
    h+='</div>';
  }

  var MO=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var by={};V.forEach(function(r){var k=r.month||'?';by[k]=by[k]||{r:0,p:0};by[k].r+=+r.revenue_sar;by[k].p+=+r.profit_sar;});
  var mos=MO.filter(function(m){return by[m];});var mx=Math.max.apply(null,mos.map(function(m){return by[m].r;}).concat([1]));
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 12px">'+(isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0631\u0628\u062d \u0634\u0647\u0631\u064a\u064b\u0627':'Monthly revenue & profit')+'</h3><div style="overflow-x:auto"><div style="display:flex;gap:14px;align-items:flex-end;height:150px;min-width:520px">'+mos.map(function(m){
    var hR=Math.round(by[m].r/mx*120),hP=Math.round(by[m].p/mx*120);
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;gap:3px;align-items:flex-end;height:124px"><div title="Revenue '+money(by[m].r)+'" style="width:22px;height:'+Math.max(hR,2)+'px;background:#FF6B00;border-radius:4px 4px 0 0"></div><div title="Profit '+money(by[m].p)+'" style="width:22px;height:'+Math.max(hP,2)+'px;background:#303848;border-radius:4px 4px 0 0"></div></div><div style="font-size:10px;color:var(--muted)">'+m.slice(0,3)+'</div><div style="font-size:9.5px;font-weight:700">'+moneyS(by[m].r)+'</div></div>';
  }).join('')+'</div></div><div style="font-size:10px;color:var(--muted);margin-top:8px"><span style="color:#FF6B00">\u25a0</span> '+(isArF()?'\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue')+' &nbsp;<span style="color:#303848">\u25a0</span> '+(isArF()?'\u0631\u0628\u062d':'Profit')+'</div></div>';

  return h;
}
window.finQ=function(v){FIN.f.quarter=v;render();};
/* Drill from a canonical client row \u2192 Ledger filtered to that client (all its invoice groups). */
window.finClient=function(key,name){FIN.tab='ledger';FIN.f.clientKey=key||null;FIN.f.clientName=name||'';FIN.f.client='all';render();};

function rLedger(){
  clearFinCanon();
  var _lh=function(en,ar){return isArF()?ar:en;};
  var L=(FIN.showDeleted?(FIN.rows||[]).filter(function(r){return r.deleted_at;}):live()).filter(function(r){
    var f=FIN.f;
    if(f.quarter!=='all'&&r.quarter!==f.quarter)return false;
    if(f.month!=='all'&&r.month!==f.month)return false;
    if(f.service!=='all'&&r.service_type!==f.service)return false;
    if(f.clientKey&&finCanon(r.client_group).key!==f.clientKey)return false;
    if(f.client!=='all'&&r.client_group!==f.client)return false;
    if(f.status!=='all'&&r.integrity_status!==f.status)return false;
    if(f.origin&&f.origin!=='all'&&(r.origin||'booking')!==f.origin)return false;
    if(f.q){var q=f.q.toLowerCase();if(((r.client_group||'')+' '+(r.customer_raw_name||'')+' '+(r.invoice_no||'')+' '+(r.zatca_dpin||'')+' '+(r.products||'')+' '+(r.proposal_ref||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  var tr=0,tp=0;L.forEach(function(r){tr+=+r.revenue_sar;tp+=+r.profit_sar;});
  FIN._csvRows=L; // exports always carry the full line-level detail
  /* Main view groups by invoice (owner 2026-08-12): one row per invoice; the service
     breakdown lives one click away (the invoice card) or in the "By service line" view. */
  var byInv=(FIN.lview||'invoice')!=='line', D=L;
  if(byInv){ var _g={},_ord=[];
    L.forEach(function(r){ var k=r.invoice_no+(r.deleted_at?'|d':'');
      if(!_g[k]){_g[k]={id:r.id,invoice_no:r.invoice_no,invoice_date:r.invoice_date,zatca_dpin:r.zatca_dpin,client_group:r.client_group,customer_raw_name:r.customer_raw_name,__svc:{},__n:0,total_incl_vat_sar:0,revenue_sar:0,cost_sar:0,profit_sar:0,wallet_portion_sar:0,origin:r.origin,proposal_ref:r.proposal_ref,deleted_at:r.deleted_at,integrity_status:r.integrity_status};_ord.push(k);}
      var G=_g[k]; G.__n++; G.__svc[r.service_type||'-']=1;
      G.total_incl_vat_sar+=+r.total_incl_vat_sar||0; G.revenue_sar+=+r.revenue_sar||0; G.cost_sar+=+r.cost_sar||0; G.profit_sar+=+r.profit_sar||0; G.wallet_portion_sar+=+r.wallet_portion_sar||0;
      if(!G.zatca_dpin&&r.zatca_dpin)G.zatca_dpin=r.zatca_dpin;
      if(r.origin==='project')G.origin='project';
      if(!G.proposal_ref&&r.proposal_ref)G.proposal_ref=r.proposal_ref;
      if(r.invoice_date>G.invoice_date)G.invoice_date=r.invoice_date; });
    D=_ord.map(function(k){return _g[k];}); }
  var h='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px">';
  if(FIN.f.clientKey){
    h+='<span style="display:inline-flex;align-items:center;gap:6px;background:#FFF3EC;color:#9a4413;border:1px solid #F5C9A8;border-radius:9px;padding:5px 8px;font-size:12px;font-weight:600">'+(isArF()?'\u0627\u0644\u0639\u0645\u064a\u0644':'Client')+': '+escF(FIN.f.clientName||'')+' <span style="cursor:pointer;font-weight:800" title="'+(isArF()?'\u0625\u0632\u0627\u0644\u0629':'Clear')+'" onclick="finClientClear()">\u2715</span></span>';
  }
  h+='<input placeholder="'+(isArF()?'\u0628\u062d\u062b\u2026':'Search client / invoice # / DPIN\u2026')+'" value="'+escF(FIN.f.q)+'" style="'+SS+';min-width:200px" oninput="finF(\'q\',this.value)">';
  h+='<select style="'+SS+'" onchange="finF(\'quarter\',this.value)">'+opts(uniq(live().map(function(r){return r.quarter;})),FIN.f.quarter,isArF()?'\u0643\u0644 \u0627\u0644\u0623\u0631\u0628\u0627\u0639':'All quarters')+'</select>';
  h+='<select style="'+SS+'" onchange="finF(\'month\',this.value)">'+opts(['January','February','March','April','May','June','July','August','September','October','November','December'].filter(function(m){return live().some(function(r){return r.month===m;});}),FIN.f.month,isArF()?'\u0643\u0644 \u0627\u0644\u0634\u0647\u0648\u0631':'All months')+'</select>';
  h+='<select style="'+SS+'" onchange="finF(\'service\',this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u062e\u062f\u0645\u0627\u062a':'All services')+'</option>'+uniq(live().map(function(r){return r.service_type;})).map(function(x){return '<option value="'+escF(x)+'" '+(FIN.f.service===x?'selected':'')+'>'+escF(svcLabel(x))+'</option>';}).join('')+'</select>';
  h+='<select style="'+SS+';max-width:220px" onchange="finF(\'client\',this.value)">'+opts(uniq(live().map(function(r){return r.client_group;})),FIN.f.client,isArF()?'\u0643\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621':'All clients')+'</select>';
  h+='<select style="'+SS+'" onchange="finF(\'status\',this.value)"><option value="verified_paid" '+(FIN.f.status==='verified_paid'?'selected':'')+'>'+(isArF()?'\u0645\u062f\u0642\u0642 \u0645\u062f\u0641\u0648\u0639':'Verified paid')+'</option><option value="all" '+(FIN.f.status==='all'?'selected':'')+'>'+(isArF()?'\u0643\u0644 \u0627\u0644\u062d\u0627\u0644\u0627\u062a':'All statuses')+'</option><option value="excluded" '+(FIN.f.status==='excluded'?'selected':'')+'>'+(isArF()?'\u0645\u0633\u062a\u0628\u0639\u062f':'Excluded')+'</option><option value="credit_note" '+(FIN.f.status==='credit_note'?'selected':'')+'>'+(isArF()?'\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u062f\u0627\u0626\u0646\u0629':'Credit notes')+'</option></select>';
  h+='<select style="'+SS+'" onchange="finF(\'origin\',this.value)"><option value="all">'+_lh('All origins','كل الأنواع')+'</option><option value="booking" '+(FIN.f.origin==='booking'?'selected':'')+'>'+_lh('Bookings','حجوزات')+'</option><option value="project" '+(FIN.f.origin==='project'?'selected':'')+'>'+_lh('Projects (with proposal)','مشاريع (بعرض)')+'</option></select>';
  h+='<span style="display:inline-flex;border:1px solid var(--line-2,#e6e8ec);border-radius:9px;overflow:hidden">'+'<button class="btn sm" style="border:0;border-radius:0;'+(byInv?'background:#303848;color:#fff':'')+'" onclick="FIN.lview=\'invoice\';render()">'+_lh('By invoice','حسب الفاتورة')+'</button>'+'<button class="btn sm" style="border:0;border-radius:0;'+(!byInv?'background:#303848;color:#fff':'')+'" onclick="FIN.lview=\'line\';render()">'+_lh('By service line','حسب بند الخدمة')+'</button></span>';
  h+='<button class="btn sm" onclick="finCSV()">⬇ '+_lh('Excel (CSV)','إكسل (CSV)')+'</button>';
  if(canFinEdit())h+='<label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" '+(FIN.showDeleted?'checked':'')+' onchange="FIN.showDeleted=this.checked;render()">'+(isArF()?'\u0627\u0644\u0645\u062d\u0630\u0648\u0641 \u0645\u0624\u062e\u0631\u064b\u0627':'Recently deleted')+'</label>';
  h+='<span style="margin-left:auto;font-size:12px">'+(isArF()?('<b>'+D.length+'</b> \u0635\u0641 \u00b7 \u0625\u064a\u0631\u0627\u062f <b>'+money0(tr)+'</b> \u00b7 \u0631\u0628\u062d <b>'+money0(tp)+'</b>'):('<b>'+D.length+'</b> '+(byInv?'invoices':'rows')+' \u00b7 rev <b>'+money0(tr)+'</b> \u00b7 profit <b>'+money0(tp)+'</b>'))+'</span></div>';
  
  h+='<div class="card" style="padding:0;overflow:auto;max-height:65vh"><table style="width:100%;font-size:12px;border-collapse:collapse;min-width:980px"><thead><tr style="position:sticky;top:0;background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+';z-index:2"><th style="padding:8px">'+_lh('Date','التاريخ')+'</th><th style="padding:8px">'+_lh('Invoice #','رقم الفاتورة')+'</th><th style="padding:8px">'+_lh('Tax inv (DPIN)','الفاتورة الضريبية')+'</th><th style="padding:8px">'+_lh('Client','العميل')+'</th><th style="padding:8px">'+_lh('Service','الخدمة')+'</th><th style="padding:8px;text-align:right">'+_lh('Total','الإجمالي')+'</th><th style="padding:8px;text-align:right">'+_lh('Revenue','الإيراد')+'</th><th style="padding:8px;text-align:right">'+_lh('Cost','التكلفة')+'</th><th style="padding:8px;text-align:right">'+_lh('Profit','الربح')+'</th><th style="padding:8px">'+_lh('Flags','ملاحظات')+'</th></tr></thead><tbody>';
  var LCAP=500; var Lshow=D.slice(0,LCAP);
  Lshow.forEach(function(r,i){
    var flags='';
    if(!r.zatca_dpin)flags+=badge(_lh('no tax inv','لا فاتورة ضريبية'),'#fff3d6','#8b5b1f')+' ';
    if(+r.cost_sar===0&&+r.revenue_sar>0)flags+=badge(_lh('no cost recorded','بدون تكلفة'),'#e0e6f7','#3a4f9e')+' ';
    if(+r.wallet_portion_sar>0)flags+=badge(_lh('wallet','محفظة'),'#e9e9e9','#555')+' ';
    if(r.origin==='project')flags+=badge(_lh('project','مشروع'),'#EDE9FE','#6D28D9')+' ';
    if(r.proposal_ref)flags+=badge(escF(r.proposal_ref),'#FFF3EC','#9a4413')+' ';
    if(r.deleted_at)flags+=badge(_lh('deleted','محذوف'),'#fddede','#a3242c');
    h+='<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" onclick="finRow(\''+r.id+'\')"><td style="padding:7px 8px;white-space:nowrap">'+escF(r.invoice_date)+'</td><td style="padding:7px 8px">'+escF(r.invoice_no)+'</td><td style="padding:7px 8px">'+(r.zatca_dpin?('<a href="'+escF(pdInvoiceLink(r))+'" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open in Direct" style="color:#175CD3;text-decoration:none">'+escF(r.zatca_dpin)+' \u2197</a>'):'\u2014')+'</td><td style="padding:7px 8px;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escF(r.customer_raw_name||'')+'">'+escF(r.client_group)+'</td><td style="padding:7px 8px">'+(r.__svc?(function(ks){return ks.length===1?escF(svcLabel(ks[0])):'<span style="color:#6D28D9;font-weight:600">'+ks.length+' '+_lh('services','خدمات')+'</span>';})(Object.keys(r.__svc)):escF(svcLabel(r.service_type)))+'</td><td style="padding:7px 8px;text-align:right">'+money0(r.total_incl_vat_sar)+'</td><td style="padding:7px 8px;text-align:right;font-weight:700">'+money0(r.revenue_sar)+'</td><td style="padding:7px 8px;text-align:right">'+money0(r.cost_sar)+'</td><td style="padding:7px 8px;text-align:right;color:#175CD3">'+money0(r.profit_sar)+'</td><td style="padding:7px 8px">'+flags+'</td></tr>';
  });
  if(!D.length)h+='<tr><td colspan="10" style="padding:30px;text-align:center;color:var(--muted)">'+_lh('No invoices match.','لا توجد فواتير مطابقة.')+'</td></tr>';
  if(D.length>LCAP)h+='<tr><td colspan="10" style="padding:12px;text-align:center;color:var(--muted);font-size:12px">'+_lh('Showing first '+LCAP+' of '+D.length+' rows — narrow the filters or use the Report Builder for totals.','عرض أول '+LCAP+' من '+L.length+' صف — ضيّق الفلاتر أو استخدم منشئ التقارير للإجماليات.')+'</td></tr>';
  h+='</tbody></table></div>';
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
  var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceUrl)||'https://payments.directksa.com/invoices/{invoice_no}';
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
  var meta=[[_f('Client','\u0627\u0644\u0639\u0645\u064a\u0644'),r.client_group],[_f('Name on invoice','\u0627\u0644\u0627\u0633\u0645 \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629'),r.customer_raw_name],[_f('ZATCA tax invoice','\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0636\u0631\u064a\u0628\u064a\u0629 (\u0632\u0627\u062a\u0643\u0627)'),r.zatca_dpin||_f('\u2014 (see notes)','\u2014 (\u0627\u0646\u0638\u0631 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a)')],[_f('Date','\u0627\u0644\u062a\u0627\u0631\u064a\u062e'),r.invoice_date+' \u00b7 '+r.month+' \u00b7 '+r.quarter],[_f('Received','\u0627\u0644\u0645\u062d\u0635\u0651\u0644'),money(t.rec)+' SAR'],[_f('Outstanding','\u0627\u0644\u0645\u062a\u0628\u0642\u064a'),money(t.rem)+' SAR'],[_f('Origin','النوع'),(r.origin==='project'?_f('Project — full project with a proposal','مشروع متكامل بعرض'):_f('Booking','حجز عادي'))],[_f('Proposal','العرض'),r.proposal_ref||'—'],[_f('Status','\u0627\u0644\u062d\u0627\u0644\u0629'),r.integrity_status],[_f('Notes','\u0645\u0644\u0627\u062d\u0638\u0627\u062a'),r.notes||'\u2014']];
  var th=function(x,rt){return '<th style="padding:6px 8px;text-align:'+(rt?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600">'+x+'</th>';};
  var lineTbl='<div style="overflow-x:auto;margin:6px 0 12px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>'+th(_f('Service','\u0627\u0644\u062e\u062f\u0645\u0629'))+th(_f('Description','\u0627\u0644\u0648\u0635\u0641'))+th(_f('Total','\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a'),1)+th(_f('Cost','\u0627\u0644\u062a\u0643\u0644\u0641\u0629'),1)+th(_f('Service fee','\u0631\u0633\u0648\u0645 \u0627\u0644\u062e\u062f\u0645\u0629'),1)+'</tr></thead><tbody>'+
    lines.map(function(x){return '<tr style="border-top:1px solid #f0efe9"><td style="padding:6px 8px;font-weight:600">'+escF(svcLabel(x.service_type))+'</td><td style="padding:6px 8px;color:var(--muted)">'+escF(x.products||'\u2014')+'</td><td style="padding:6px 8px;text-align:right">'+money(x.total_incl_vat_sar)+'</td><td style="padding:6px 8px;text-align:right;color:#B54708">'+money(x.cost_sar)+'</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:#0F6E56">'+money(x.profit_sar)+'</td></tr>'+((x.items&&x.items.length)?('<tr><td colspan="5" style="padding:2px 10px 9px 24px;font-size:11.5px;color:var(--muted);background:#FCFBF9">'+x.items.map(function(it){return '• '+escF(it.d||'')+(it.q?(' × '+it.q):'')+(it.u?(' — '+money(it.u)+' SAR'):'');}).join('<br>')+'</td></tr>'):'');}).join('')+
    '<tr style="border-top:2px solid #1C1E2B;background:#F3F1EA;font-weight:800"><td style="padding:7px 8px" colspan="2">'+_f('Invoice total','\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629')+' \u00b7 '+lines.length+' '+_f('service(s)','\u062e\u062f\u0645\u0629')+'</td><td style="padding:7px 8px;text-align:right">'+money(t.tot)+'</td><td style="padding:7px 8px;text-align:right;color:#B54708">'+money(t.cost)+'</td><td style="padding:7px 8px;text-align:right;color:#0F6E56">'+money(t.prof)+'</td></tr>'+
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
window.finDelInv=function(invNo){
  if(!canFinEdit())return;
  var ar=isArF();
  if(!confirm(ar?('\u062d\u0630\u0641 \u0643\u0644 \u0628\u0646\u0648\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 '+invNo+'\u061f \u062a\u062e\u062a\u0641\u064a \u0645\u0646 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062a\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639.'):('Soft-delete all lines of invoice '+invNo+'? It disappears from totals but stays recoverable.')))return;
  fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('invoice_no',invNo).is('deleted_at',null).then(function(r){
    if(r.error){alert('Could not delete: '+r.error.message);return;}
    finCloseModal(); FIN.rows=null;finLoad();
  });
};
window.finRestoreInv=function(invNo){
  fc().from('finance_invoices').update({deleted_at:null}).eq('invoice_no',invNo).not('deleted_at','is',null).then(function(r){
    if(r.error){alert('Could not restore: '+r.error.message);return;}
    finCloseModal(); FIN.rows=null;finLoad();
  });
};
window.finCloseModal=function(){var m=document.getElementById('finModal');if(m)m.remove();};
window.finDel=function(id){
  if(!canFinEdit())return;
  if(!confirm('Soft-delete this invoice? It disappears from all totals but stays recoverable under "Recently deleted".'))return;
  fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('id',id).then(function(r){
    if(r.error){alert('Could not delete: '+r.error.message);return;}
    finCloseModal(); FIN.rows=null;finLoad();
  });
};
window.finRestore=function(id){
  fc().from('finance_invoices').update({deleted_at:null}).eq('id',id).then(function(r){
    if(r.error){alert('Could not restore: '+r.error.message);return;}
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
function rReports(){
  var rb=FIN.rb; clearFinCanon();
  var base=(rb.verifiedOnly?verified():live()).filter(function(r){return rb.quarter==='all'||r.quarter===rb.quarter;});
  var h='<div class="card" style="padding:14px 16px;margin-bottom:12px;font-size:13px">';
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
              : ('\u26a0 '+unl+' invoice group'+(unl>1?'s':'')+' not linked to a client yet \u2014 shown under their own name. <span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">Link them</span>'))
      : (isArF()?'\u2713 \u0643\u0644 \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0639\u0645\u064a\u0644.':'\u2713 Every invoice group is linked to a client.'))+'</div>';
  }
  h+='</div>';
  var mets=Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];});
  if(!mets.length)mets=['revenue_sar'];
  var g={};
  base.forEach(function(r){
    var k1=dimVal(r,rb.g1),k2=rb.g2?dimVal(r,rb.g2):null;
    g[k1]=g[k1]||{__sub:{},__tot:{}};
    if(k2){var s=g[k1].__sub[k2]=g[k1].__sub[k2]||{};mets.forEach(function(m){s[m]=(s[m]||0)+(m==='_count'?1:+r[m]);});}
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
    h2+='<tr style="border-top:1px solid var(--line,#eee);background:'+(rb.g2?'#FBFAF7':'#fff')+'"><td style="padding:7px 8px;font-weight:700">'+escF(k)+'</td>'+mets.map(function(m){return '<td style="padding:7px 8px;text-align:right;font-weight:700">'+(m==='_count'?g[k].__tot[m]:money0(g[k].__tot[m]))+'</td>';}).join('')+'</tr>';
    if(rb.g2){
      var subs=Object.keys(g[k].__sub);
      if(rb.g2==='month')subs.sort(function(a,b){return (MOI[a]||99)-(MOI[b]||99);});else subs.sort();
      subs.forEach(function(s){
        h2+='<tr style="border-top:1px solid #f4f2ec"><td style="padding:5px 8px 5px 26px;color:var(--muted)">'+escF(s)+'</td>'+mets.map(function(m){return '<td style="padding:5px 8px;text-align:right">'+(m==='_count'?(g[k].__sub[s][m]||0):money0(g[k].__sub[s][m]||0))+'</td>';}).join('')+'</tr>';
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
  var csv='\ufeff'+out.map(function(r){return r.map(function(c){c=String(c);return (c.indexOf(',')>=0||c.indexOf('"')>=0)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Direct-Finance-Report-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};

function rImport(){
  var _fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  if(!canFinEdit())return '<div class="card" style="padding:30px;text-align:center;color:var(--muted)">'+_fl('Import is restricted to admins and managers.','الاستيراد متاح للمدراء والمسؤولين فقط.')+'</div>';
  var h='<div class="card" style="padding:18px;max-width:860px">';
  h+='<h3 style="margin:0 0 8px">'+_fl('Import invoices (CSV)','استيراد الفواتير (CSV)')+'</h3>';
  h+='<div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:12px">'+_fl('Expected header','الأعمدة المطلوبة')+':<br><code style="font-size:11px;background:#F3F1EA;padding:3px 6px;border-radius:6px;display:inline-block;margin-top:4px;word-break:break-all;max-width:100%">client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes</code><br>'+_fl('Optional last columns: <code style="font-size:11px">origin,proposal_ref</code> (origin = booking or project).','عمودان اختياريان في النهاية: <code style="font-size:11px">origin,proposal_ref</code> (النوع: booking أو project).')+'<br>'+_fl('Duplicates are skipped, totals re-checked, and nothing is written until you confirm the preview.','تُتجاهل الفواتير المكررة وتُراجع الأرقام، ولا يُكتب شيء قبل تأكيدك للمعاينة.')+'</div>';
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
    if(hj!==BASE&&!hasExtra){document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px">Header does not match the expected format. Found:<br><code style="font-size:11px;word-break:break-all">'+escF(hdr.join(','))+'</code></div>';return;}
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
    [['direct wallet','wallet','top-up','topup','محفظة'],'Wallet top-up'],
    [['techtic','support service','دعم'],'Support Services'],
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
