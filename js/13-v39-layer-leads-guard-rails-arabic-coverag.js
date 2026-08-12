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
