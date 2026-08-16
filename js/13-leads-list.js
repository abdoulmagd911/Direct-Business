/* ===== Leads list — one chapter, one file (Step 1, Leads sitting L1 — 2026-08-16) =====

   The decorations of the Leads LIST page:
     part 1 (was js/13-v39)  guard rails + Arabic coverage — validates saves, hardens the
                              list against bad stage values
     part 2 (was js/24-v31)  the pipeline conversion strip above the table
     part 3 (was js/26-v33)  the service-fit map on the all-in-one card

   Anchored at slot 13 — forced: part 1 wraps save(), and slot 15 wraps save() on top of
   it, so part 1 must keep loading first. Checked the other two moves: nothing between the
   old slots 13 and 26 wraps renderLeadDetail (part 3's wrap keeps its place FIRST in the
   26→27→28 card chain), and part 2's render hook only inserts the strip — proven
   unchanged by the list fingerprint. Verbatim, each part keeping its own try/catch.     */

/* ---------- part 1 — guard rails + Arabic coverage (was js/13-v39) ---------- */
/* ===== v39 layer: leads guard rails + Arabic coverage for v38 features ===== */
(function(){try{

/* ---------- 1. Arabic translations for everything v38 added ---------- */
try{
  if(typeof I18N==='object'){
    I18N.en.events='Events'; I18N.ar.events='الفعاليات';
  }
  if(typeof V21_STRINGS_AR==='object'){
    V21_STRINGS_AR['Events']='الفعاليات';
    V21_STRINGS_AR['Share (view-only)']='مشاركة (عرض فقط)';
    V21_STRINGS_AR['+ Add event']='+ إضافة فعالية';
    V21_STRINGS_AR['Share view-only link']='مشاركة رابط للعرض فقط';
  }
}catch(_){}

function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar';}catch(_){return false;}}

/* ---------- 2. Duplicate guard: warn when a just-added lead matches an existing one ---------- */
var seenIds=null;
function normDom(u){return String(u||'').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].trim();}
function leadEmails(b){try{return (b.contacts||[]).map(function(c){return String(c.email||'').toLowerCase();}).filter(Boolean);}catch(_){return [];}}
function checkNewLeads(){
  try{
    var B=(DB&&DB.businesses)||[]; if(!B.length)return;
    if(seenIds===null){ seenIds={}; B.forEach(function(b){seenIds[b.id]=1;}); return; }
    var fresh=B.filter(function(b){return !seenIds[b.id];});
    B.forEach(function(b){seenIds[b.id]=1;});
    fresh.forEach(function(nb){
      var nd=normDom(nb.website), nn=String(nb.name||'').trim().toLowerCase(), ne=leadEmails(nb);
      var hit=B.find(function(b){
        if(b.id===nb.id)return false;
        if(nn && String(b.name||'').trim().toLowerCase()===nn) return true;
        if(nd && normDom(b.website)===nd) return true;
        if(ne.length){ var be=leadEmails(b); if(be.some(function(e){return ne.indexOf(e)>=0;})) return true; }
        return false;
      });
      if(hit){
        var msg=isAr()
          ? 'تنبيه تكرار: "'+(nb.name||'')+'" يشبه سجلاً موجوداً: "'+(hit.name||'')+'".\nراجع السجلين وادمجهما إن كانا نفس الجهة.'
          : 'Duplicate warning: "'+(nb.name||'')+'" looks like an existing record: "'+(hit.name||'')+'".\nReview both and merge them if they are the same company.';
        try{ if(typeof toast==='function') toast(msg); }catch(_){}
        /* v49: no blocking alert() — a quiet toast is enough; a duplicate is not an emergency */
      }
    });
  }catch(_){}
}
try{
  if(typeof window.save==='function'&&!window.save.__v39dupe){
    var _s=window.save; window.save=function(){var r=_s.apply(this,arguments); try{checkNewLeads();}catch(_){} return r;};
    window.save.__v39dupe=true;
  }
  setTimeout(checkNewLeads,6000); /* prime the seen-list once, after the paginated cloud load settles */
  /* v49: no 4s interval — it re-fired on every load batch and every test run, spamming warnings.
     The duplicate check now runs only after an actual save (the wrapper above). */
}catch(_){}

/* ---------- 3. Attention strip on Leads: unassigned + stale ---------- */
var STALE_DAYS=14;
function attention(){
  var B=(DB&&DB.businesses)||[];
  var unassigned=[], stale=[];
  var now=Date.now(), cut=now-STALE_DAYS*864e5;
  B.forEach(function(b){
    if(b.isVendor)return;
    var worked=b.stage&&b.stage!=='new'&&b.stage!=='Prospect';
    var owner=(b.assignedTo||b.accountManager||'').trim();
    if(worked&&!owner)unassigned.push(b);
    if(worked&&b.stage!=='Won'&&b.stage!=='Lost'){
      var last=b.lastContact||0;
      try{(b.activities||[]).forEach(function(a){if(a.date>last)last=a.date;});}catch(_){}
      if(last&&last<cut)stale.push(b);
    }
  });
  return {unassigned:unassigned,stale:stale};
}
function injectStrip(){
  try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(window.__isShareView)return;
    var v=document.getElementById('view'); if(!v)return;
    var old=document.getElementById('v39strip'); if(old)old.remove();
    var a=attention();
    if(!a.unassigned.length&&!a.stale.length)return;
    var ar=isAr();
    var parts=[];
    if(a.unassigned.length)parts.push(ar?('<b>'+a.unassigned.length+'</b> فرصة قيد العمل بدون مسؤول'):('<b>'+a.unassigned.length+'</b> worked lead'+(a.unassigned.length>1?'s':'')+' with no owner'));
    if(a.stale.length)parts.push(ar?('<b>'+a.stale.length+'</b> بدون أي حركة منذ أكثر من '+STALE_DAYS+' يوماً'):('<b>'+a.stale.length+'</b> with no movement for '+STALE_DAYS+'+ days'));
    var names=a.unassigned.concat(a.stale).slice(0,8).map(function(b){return (b.name||'').replace(/</g,'&lt;');}).join(' · ');
    var strip=document.createElement('div');
    strip.id='v39strip';
    strip.style.cssText='background:#FFF6E8;border:1px solid #F2C185;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12.5px;color:#7A4B12;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center'+(ar?';direction:rtl':'');
    strip.innerHTML='<span style="font-size:15px">⚠️</span> '+parts.join(' · ')
      +' <span style="color:#A8783D;font-size:11.5px">'+(ar?'أمثلة: ':'e.g. ')+names+'</span>';
    v.insertBefore(strip, v.firstChild);
  }catch(_){}
}
try{
  var _r=window.render;
  window.render=function(){var o=_r.apply(this,arguments); try{injectStrip();}catch(_){} return o;};
}catch(_){}

console.info('%c[v39 guard rails] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v39 layer failed',e);}})();

/* ---------- part 2 — pipeline conversion strip (was js/24-v31) ---------- */
/* v31 — Leads pipeline conversion strip. A small stat row at the top of the Leads LIST:
   new this month, in pipeline, conversion rate, avg time to win. Aggregate, additive, reversible. */
(function(){try{
  var fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  function created(b){return b.created_at||b.createdAt||b.created||'';}
  function stripHtml(){
    var all=(typeof DB!=='undefined'&&DB.businesses)||[]; if(!all.length)return '';
    var stg=function(b){return (typeof leadStage==='function')?leadStage(b):(b.stage||'');};
    var month=new Date().toISOString().slice(0,7);
    /* count the same population the chips below count: pipeline leads, not converted clients */
    var newThis=all.filter(function(b){return !b.isClient&&String(created(b)).slice(0,7)===month;}).length;
    var won=all.filter(function(b){return stg(b)==='Won'||b.isClient;});
    var lost=all.filter(function(b){return stg(b)==='Lost';}).length;
    var conv=all.length>0?Math.round(won.length/all.length*100):0; // won out of ALL leads, the standard rate
    var active=all.filter(function(b){var s=stg(b);return s!=='Won'&&s!=='Lost'&&!b.isClient;}).length;
    var wt=won.map(function(b){var c=created(b),cv=b.convertedDate||b.convertDate;if(!c||!cv)return null;var d=(new Date(cv).getTime()-new Date(c).getTime())/864e5;return (isFinite(d)&&d>=0)?d:null;}).filter(function(x){return x!=null;});
    var avg=wt.length?Math.round(wt.reduce(function(a,x){return a+x;},0)/wt.length):null;
    var tile=function(v,l,c){return '<div style="flex:1;min-width:118px;border-inline-start:3px solid #FF6B00;padding-inline-start:12px"><div style="font-size:20px;font-weight:800;color:'+(c||'#1C1E2B')+'">'+v+'</div><div style="font-size:11px;color:var(--muted)">'+l+'</div></div>';};
    return '<div class="card v31-conv" style="display:flex;gap:18px;flex-wrap:wrap;padding:14px 18px;margin-bottom:14px">'+
      tile(newThis,fl('New this month','جديد هذا الشهر'),'#175CD3')+
      tile(active,fl('In pipeline','قيد المتابعة'),'#7A5AF8')+
      tile(conv+'%',fl('Conversion rate','نسبة التحويل'),conv>=30?'#16B364':'#F79009')+
      tile(avg==null?'—':(avg+' '+fl('days','يوم')),fl('Avg time to win','متوسط وقت الكسب'),'#0F6E56')+
    '</div>';
  }
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='leads')return;
      if(typeof openLead!=='undefined'&&openLead)return; // list view only, not the lead detail
      var view=document.getElementById('view'); if(!view||view.querySelector('.v31-conv'))return;
      var html=stripHtml(); if(!html)return;
      var wrap=document.createElement('div'); wrap.innerHTML=html;
      if(wrap.firstChild) view.insertBefore(wrap.firstChild,view.firstChild);
    }catch(e){ if(window.console)console.warn('[v31] conv strip',e); }
  }
  window.v31Conv=inject;
  if(typeof render==='function'){ var _r31=render; window.render=function(){ var o=_r31.apply(this,arguments); inject(); return o; }; }
  inject();
}catch(e){ if(window.console)console.warn('[v31] init',e); }})();

/* ---------- part 3 — service-fit map (was js/26-v33) ---------- */
/* v33 — Leads · service-fit map (the all-in-one angle).
   Captures, per Direct service, whether the lead buys it elsewhere / already with Direct /
   not a fit — so "buys elsewhere" becomes the consolidation pitch. Stored on the record as
   b.serviceFit and persisted via the businesses raw JSON (rowToApp copies raw fields back). */
(function(){try{
  if(!window.renderLeadDetail) return;
  var CORE=[['flights','✈','Flights','الطيران'],['hotels','🏨','Hotels','الفنادق'],['visa','🛂','Visa / e-Visa','التأشيرات'],['umrah','🕋','Umrah / Hajj','العمرة والحج'],['transfers','🚐','Transfers','التنقلات'],['carrental','🔑','Car rental','تأجير السيارات'],['insurance','🛡','Insurance','التأمين'],['tours','🗺','Activities / tours','الأنشطة والجولات'],['mice','🎤','MICE / events','الفعاليات'],['packages','🧳','Packages','الباقات'],['study','🎓','Study abroad','الدراسة بالخارج']];
  var GROWTH=[['idl','🪪','Intl driving licence','رخصة القيادة الدولية'],['chauffeur','🚘','Chauffeur','سائق خاص'],['esim','📶','eSIM / roaming','شريحة eSIM'],['training','📚','Training','التدريب'],['vip','⭐','VIP meet & assist','استقبال كبار الشخصيات'],['translation','📄','Translation','ترجمة الوثائق'],['shipping','📦','Shipping','الشحن البريدي'],['halls','🏛','Event halls','قاعات الفعاليات'],['support','🛎','Support','الدعم']];
  var ALL=CORE.concat(GROWTH);
  var STATES={unknown:{l:['—','—'],c:'#9AA1B6',bg:'#EEF0F5'},elsewhere:{l:['Buys elsewhere','من غيرنا'],c:'#B54708',bg:'#FEF3E2'},direct:{l:['With Direct','مع دايركت'],c:'#0F6E56',bg:'#E7F8EF'},na:{l:['Not a fit','غير مطلوبة'],c:'#98A2B3',bg:'#F2F4F7'}};
  var ORDER=['unknown','elsewhere','direct','na'];
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  window.v33CycleFit=function(id,key){try{var b=getLead(id);if(!b)return;b.serviceFit=b.serviceFit||{};var cur=b.serviceFit[key]||'unknown';b.serviceFit[key]=ORDER[(ORDER.indexOf(cur)+1)%ORDER.length];if(typeof silentSave==='function')silentSave(save);else save();window.v33Redraw(id);}catch(e){}};
  function rowHtml(id,fit,s){var st=STATES[(fit&&fit[s[0]])||'unknown'];
    return '<button type="button" onclick="v33CycleFit(\''+id+'\',\''+s[0]+'\')" style="display:flex;align-items:center;gap:8px;width:100%;text-align:start;border:1px solid var(--line-2,#e6e8ec);background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer;font:inherit">'+
      '<span style="font-size:14px;width:18px;text-align:center">'+s[1]+'</span>'+
      '<span style="flex:1;font-size:12.5px;font-weight:600">'+fl(s[2],s[3])+'</span>'+
      '<span style="font-size:10.5px;font-weight:700;color:'+st.c+';background:'+st.bg+';padding:2px 8px;border-radius:999px;white-space:nowrap">'+fl(st.l[0],st.l[1])+'</span></button>';
  }
  function cardHtml(id){
    var b=(typeof getLead==='function')?getLead(id):null; if(!b) return '';
    var fit=b.serviceFit||{};
    var opp=ALL.filter(function(s){return fit[s[0]]==='elsewhere';}).length;
    var withD=ALL.filter(function(s){return fit[s[0]]==='direct';}).length;
    var grp=function(title,arr){return '<div style="font-size:10.5px;font-family:ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px">'+title+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+arr.map(function(s){return rowHtml(id,fit,s);}).join('')+'</div>';};
    // one-line summary; the 14 services live inside a collapsed <details> and expand on tap
    var bits=[];
    if(withD)bits.push('<span style="color:#0F6E56;font-weight:700">'+withD+' '+fl('with Direct','مع دايركت')+'</span>');
    if(opp)bits.push('<span style="color:#B54708;font-weight:700">🎯 '+opp+' '+fl('could win','فرصة كسب')+'</span>');
    var summary=bits.length?bits.join('<span style="color:var(--muted)"> · </span>'):'<span style="color:var(--muted);font-weight:600">'+fl('Tap to map their services','اضغط لتحديد خدماتهم')+'</span>';
    return '<details class="card v33-fit">'+
      '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span style="font-weight:800;font-size:14px">'+fl('Service fit','ملاءمة الخدمات')+'</span>'+
        '<span style="flex:1"></span>'+
        '<span style="font-size:12.5px">'+summary+'</span>'+
        '<span class="v33-caret" style="font-size:15px;color:var(--muted);transition:transform .15s">›</span>'+
      '</summary>'+
      '<div style="margin-top:8px">'+
        grp(fl('Core — Direct bills today','أساسية — تفوترها دايركت اليوم'),CORE)+
        grp(fl('Growth — opportunity','نمو — فرصة'),GROWTH)+
      '</div>'+
    '</details>';
  }
  window.v33Redraw=function(id){var c=document.querySelector('#view .v33-fit');if(c){var wasOpen=c.open;c.outerHTML=cardHtml(id);var c2=document.querySelector('#view .v33-fit');if(c2&&wasOpen)c2.open=true;}};
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v33-fit'))return;
      if(!getLead(id))return;
      var grid=view.querySelector('.detail-grid'); if(!grid)return;
      var col=grid.children[0]||grid;
      var wrap=document.createElement('div'); wrap.innerHTML=cardHtml(id);
      if(wrap.firstChild){ var after=col.children[1]||null; col.insertBefore(wrap.firstChild, after); } // 2nd card — prominent, not buried
    }catch(e){if(window.console)console.warn('[v33] fit',e);}},50);
  };
  console.info('%c[v33] leads service-fit map loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v33] init',e);}})();
