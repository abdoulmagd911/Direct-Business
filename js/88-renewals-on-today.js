/* ===== js/88 — the renewals the company cannot afford to miss, on the page people open
   (fire #163, 2026-09-21) =====

   The Generator's Renewals radar is a good instrument and it tells the truth. Driven against the
   live registry on 2026-09-21 it read, correctly:

       ISO 9001:2015 — EXPIRED · DUNS — EXPIRED · Saudization certificate — EXPIRED
       PCI DSS — EXPIRED · Monsha'at — 50 days left · Commercial Registration — 85 days left

   Four lapsed, and **the CR itself inside three months**. None of it reaches anybody who does not
   open Generator → Company assets & registry, which is not a page you visit unless you already
   suspect something. A warning nobody passes is not a warning.

   So: one line on Today, and only when there is something to say — something already expired, or
   expiring within sixty days. Nothing else changes.

   Deliberate choices, so the next session does not undo them by accident:
     · ADMINS AND MANAGERS ONLY. Seven of the eleven live accounts are employees; a lapsed
       Saudization certificate is not their job and putting it on their morning screen is noise.
     · At most three, most urgent first, with the count of the rest and a link to the page that
       holds the whole list — the radar stays the instrument, this is only the doorbell.
     · It reads the registry through the same accessor every document uses, and it is READ-ONLY:
       renewing a certificate happens in the world, not on a card.
     · Nothing is invented. A row with no expiry date on file is not counted as anything — the
       radar already shows those as "date not on file", and that is where they belong.

   Removing this file removes the line and nothing else. */
(function(){try{
  var SOON_DAYS=60;
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc88(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }
  function maySee(){
    try{
      if(window.__isShareView) return false;
      var r=window.__userRole||'';
      if(r) return (r==='admin'||r==='manager');
      var t=window.__userTier||'';
      return (t==='admin'||t==='manager');
    }catch(_){ return false; }
  }
  /* the same facts the documents obey (js/66) — key, label, expiry, and whether it has expired */
  function facts(){
    try{ return (typeof window.dgCredentialFacts==='function')?window.dgCredentialFacts():{loaded:false,rows:[]}; }
    catch(_){ return {loaded:false,rows:[]}; }
  }
  function daysTo(d){
    try{
      if(!d) return null;
      var today=(typeof todayISO==='function')?todayISO():'';
      if(!today) return null;                       /* no calendar we trust — say nothing at all */
      var a=new Date(today+'T00:00:00'), b=new Date(String(d).slice(0,10)+'T00:00:00');
      if(isNaN(a.getTime())||isNaN(b.getTime())) return null;
      return Math.round((b-a)/86400000);
    }catch(_){ return null; }
  }

  function due(){
    var f=facts(); if(!f.loaded) return null;       /* unknown is not "nothing due" */
    var out=[];
    (f.rows||[]).forEach(function(r){
      if(!r||!r.expires_on) return;                 /* no date on file — the radar says so, not this */
      var d=daysTo(r.expires_on);
      if(d===null) return;
      if(d<0||d<=SOON_DAYS) out.push({ label:(r.label_en||r.key||''), ar:(r.label_ar||''), days:d, on:r.expires_on });
    });
    out.sort(function(a,b){ return a.days-b.days; });
    return out;
  }

  function line(x){
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var name=esc88(ar&&x.ar?x.ar:x.label);
    if(x.days<0) return '<b>'+name+'</b> — '+fl('expired ','انتهت في ')+esc88(x.on);
    if(x.days===0) return '<b>'+name+'</b> — '+fl('expires today','تنتهي اليوم');
    return '<b>'+name+'</b> — '+fl(x.days+' days left','باقي '+x.days+' يوماً')+' ('+esc88(x.on)+')';
  }

  function show(){try{
    if(typeof current==='undefined'||current!=='today') return;
    if(!maySee()) return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v88-renewals')) return;          /* once per render */
    var list=due(); if(!list||!list.length) return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var shown=list.slice(0,3), rest=list.length-shown.length;
    var anyExpired=list.some(function(x){ return x.days<0; });
    var d=document.createElement('div');
    d.className='v88-renewals';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:'+(anyExpired?'#FDECEB':'#FFF3EC')+';border:1px solid '+(anyExpired?'#F0453A':'#F4C892')+';'+
      'border-radius:10px;padding:11px 14px;margin:0 0 12px;font-size:12.5px;line-height:1.65;'+
      'color:'+(anyExpired?'#B42318':'#7a5c00')+';text-align:'+(ar?'right':'left');
    d.innerHTML='<b>'+fl('Company papers needing attention','أوراق الشركة التي تحتاج انتباهًا')+'</b><br>'+
      shown.map(function(x){ return '• '+line(x); }).join('<br>')+
      (rest>0?('<br>'+fl('and '+rest+' more','و'+rest+' غيرها')):'')+
      '<br><span style="opacity:.85">'+
      fl('From your own company registry. The full list, with the documents, is in Generator → Company assets &amp; registry.',
         'من سجل شركتك. القائمة كاملة، مع المستندات، في المولّد ← أصول الشركة والسجل.')+
      '</span>';
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v88]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(show,90); return out; };
  }
  setTimeout(show,1500);
  try{ window.__v88Probe=function(){ return due(); }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v88] init',e); }})();
