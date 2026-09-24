/* ===== js/105 — when the companies have not loaded, the app stops showing the examples it ships
   with as if they were yours (fire #235, 2026-09-24) =====

   MEASURED against the real database, by failing one request. Make the `businesses` read answer
   500 (or 403 — a permission refusal looks the same), sign in, and the Leads page comes up like
   this:

       0 New this month · 57 In pipeline · 12% · Became clients · 8 of 65

   Sixty-five companies, a full pipeline, stage chips with counts, rows you can open — and **not one
   of them is real**. They are the demo records this app ships with, hardcoded in core-01:
   "Falcon Conferences Group", "Crestline Minerals", ids `b_mdd`, `b_maaden`. The real database
   holds 108 companies and none of them is on the screen.

   The app is not silent about the failure: a red line reads "Could not load leads: server error".
   But it sits above a page that looks entirely normal, and everything under it is invented. Miss
   one line and you are reading a fictional pipeline — and worse, those rows behave like records: a
   person can open one and edit it.

   THE FLAG FOR THIS ALREADY EXISTS, and its comment already says why. js/02 sets
   `window.__bizTableLoaded = true` only after the real rows arrive: *"the one flag that says 'these
   are the real rows'. Before this point DB.businesses is whatever the page started with, and a card
   computed from it is a not-loaded-yet state shown as a fact."* That was applied to one card on
   Today (js/14) in September. Every list in the app still draws the demo set.

   So this layer: while the flag is not set and somebody is signed in, the company lists show
   nothing and say why, instead of showing fiction. It covers BOTH shapes with one honest sentence
   — a load that failed, and a load still running — because from the reader's side they are the
   same thing: what is on screen is not their data. If the app has a specific reason (that red
   line), it is quoted.

   Nothing is deleted: the demo records are kept aside and put straight back the moment the real
   rows arrive, which is also what happens on a normal slow load, so this costs a working app
   nothing. Emptying the list cannot cause a write either — js/02 only archives rows that were in
   its SNAP, and on a failed load SNAP is empty.

   Bilingual, once per render, never in a share view. Removing this file brings the demo pipeline
   straight back. */
(function(){try{
  function ar(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,a){ return ar()?a:en; }
  var HELD=null;

  function loaded(){ try{ return window.__bizTableLoaded===true; }catch(_){ return false; } }
  /* NOT `__roleKnown`: when the companies read fails, js/02 returns before it ever fetches the
     role, so the flag this would most naturally use is exactly the one the failure prevents.
     NOR the sign-in field: measured on the failing page, `#cl_email` is still in the document with
     a height of 43px while the overlay that holds it is `display:none` — the app emits that form
     in two places, so asking about it answers a different question than the one intended.
     What is actually being asked is "is the app on screen in front of somebody", so that is what
     is measured: the overlay is not up, and the working area has real height. On the failing page
     the overlay is down, the view is 2424px tall, and the middle of the screen is app content —
     the fictional pipeline is not behind anything. */
  function signedIn(){
    try{
      var ov=document.getElementById('ov');
      if(ov){ var cs=getComputedStyle(ov);
        if(cs.display!=='none'&&cs.visibility!=='hidden'&&ov.offsetHeight>0) return false; }
      var v=document.getElementById('view');
      return !!(v&&v.offsetHeight>80);
    }catch(_){ return false; }
  }

  /* the examples this app ships with, recognised by the ids core-01 gives them */
  function isSeed(b){ try{ return /^(b_|c_)/.test(String((b&&b.id)||'')); }catch(_){ return false; } }
  function reason(){
    try{ var e=document.getElementById('cl_err');
      if(e&&e.offsetHeight>0){ var t=String(e.textContent||'').trim(); if(t) return t; } }catch(_){}
    return '';
  }

  function enhance(){try{
    if(window.__isShareView) return;
    if(typeof current==='undefined') return;
    if(current!=='leads'&&current!=='clients'&&current!=='today') return;
    var view=document.getElementById('view'); if(!view) return;

    if(loaded()){
      /* the real rows are in — put back anything held and never speak again */
      if(HELD){ HELD=null; }
      var old=view.querySelector('.v105-notloaded'); if(old) old.remove();
      /* 2026-09-24 (fire #237) — a PARTIAL load is a different thing from a failed one, and it used
         to be invisible: js/02 now keeps a row the converter cannot read out of the list instead of
         losing every company with it, and counts them. A shorter list with nothing said is the gap
         this codebase keeps paying for, so it is said. */
      try{
        var sk=Number(window.__bizSkipped||0);
        var note=view.querySelector('.v105-skipped');
        if(sk>0&&(current==='leads'||current==='clients')){
          if(!note){
            var w=document.createElement('div');
            w.className='v105-skipped'; w.setAttribute('dir', ar()?'rtl':'ltr');
            w.style.cssText='background:#FEF3E2;border:1px solid #F4C892;border-radius:10px;padding:9px 12px;'+
              'margin:0 0 10px;font-size:12.5px;color:#a8650a;line-height:1.6;text-align:'+(ar()?'right':'left');
            w.textContent=fl(sk+' record'+(sk===1?'':'s')+' could not be read and '+(sk===1?'is':'are')+
                             ' missing from this list. Everything else loaded normally.',
                             sk+' من السجلات تعذّرت قراءتها وهي غير موجودة في هذه القائمة. وحُمِّل كل ما عداها بشكل طبيعي.');
            view.insertBefore(w, view.firstChild);
          }
        } else if(note){ note.remove(); }
      }catch(_){}
      return;
    }
    if(!signedIn()) return;                                  /* still at the sign-in form */

    /* 2026-09-24 (fire #236) — Today has two verdict lines, and with the workspace read failing
       they both reassured: "Nothing urgent. Today is calm." and "Nothing urgent right now — all
       clear.", while `__bizTableLoaded` was false. Fire #211 had already made those lines count
       the RIGHT things (js/14's yourDayLists, M51); what neither of them asks is whether those
       things are real. That is this flag's whole job, and joining the two is the fix.
       The banner is the robust half and does not depend on any wording. Silencing the two
       sentences does — they are found by the words they say, in both languages — so the probe
       checks for them by name: if the app ever rephrases them, the check goes red rather than the
       reassurance quietly coming back. */
    if(current==='today'){
      try{
        var calm=/Today is calm|all clear|اليوم هادئ|على ما يرام/i;
        var said=fl('Today cannot be judged — your records have not loaded.',
                    'لا يمكن الحكم على اليوم — لم تُحمَّل سجلاتك.');
        [].slice.call(view.querySelectorAll('p,div,span,h2,h3')).forEach(function(n){
          try{ if(n.children.length) return; var t=(n.textContent||'').trim();
            if(t.length<100&&calm.test(t)&&n.getAttribute('data-v105')!=='1'){
              n.setAttribute('data-v105','1'); n.textContent=said; } }catch(_){}
        });
      }catch(_){}
    }

    var list=[]; try{ list=DB.businesses||[]; }catch(_){}
    if(current!=='today'&&list.length&&list.every(isSeed)){
      /* keep them, show none of them — a fictional pipeline is worse than an empty one */
      HELD=list;
      try{ DB.businesses=[]; }catch(_){}
      try{ if(typeof drawLeads==='function'&&current==='leads') drawLeads(); }catch(_){}
    }
    if(view.querySelector('.v105-notloaded')) return;         /* once per render */

    var why=reason();
    var d=document.createElement('div');
    d.className='v105-notloaded';
    d.setAttribute('dir', ar()?'rtl':'ltr');
    d.style.cssText='background:#FDECEB;border:1px solid #F0453A55;border-radius:10px;padding:10px 13px;'+
      'margin:0 0 12px;font-size:12.5px;color:#a4221c;line-height:1.65;text-align:'+(ar()?'right':'left');
    var onToday=(current==='today');
    d.innerHTML='<b>'+(onToday
        ? fl('Your records are not loaded — nothing on this page is worked out from your data',
             'لم تُحمَّل سجلاتك — لا شيء في هذه الصفحة محسوب من بياناتك')
        : fl('Your companies are not loaded — this list is empty for that reason, not because you have none',
             'لم تُحمَّل شركاتك — القائمة فارغة لهذا السبب، لا لأنه ليس لديك أي سجل'))+'</b><br>'+
      (onToday
        ? fl('Every count and verdict here is computed from records that did not arrive, so none of it describes your day. '+
             'Reload the page to try again.',
             'كل عدد وكل حكم هنا محسوب من سجلات لم تصل، فلا شيء منها يصف يومك. أعد تحميل الصفحة للمحاولة مرة أخرى.')
        : fl('Until they arrive, nothing is shown here rather than the sample records this app ships with, which are not your data. '+
             'Reload the page to try again.',
             'إلى أن تصل، لا يُعرض هنا شيء بدلًا من السجلات التجريبية المرفقة بالتطبيق، وهي ليست بياناتك. '+
             'أعد تحميل الصفحة للمحاولة مرة أخرى.'))+
      (why?('<br><span style="opacity:.85">'+fl('The app reported: ','ما أبلغ عنه التطبيق: ')+
            String(why).replace(/[<>&]/g,'')+'</span>'):'');
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v105]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,120); return out; };
  }
  setTimeout(enhance,1500);
  setTimeout(enhance,6000);
  try{ window.__v105Run=enhance; }catch(_){}
  try{ window.__v105Why=function(){ try{ return {
      share: !!window.__isShareView, current: (typeof current!=='undefined'?current:'(undefined)'),
      view: !!document.getElementById('view'), loaded: loaded(), signedIn: signedIn(),
      n: (function(){ try{ return (DB.businesses||[]).length; }catch(_){ return -1; } })(),
      allSeed: (function(){ try{ var l=DB.businesses||[]; return l.length>0&&l.every(isSeed); }catch(_){ return null; } })()
    }; }catch(e){ return {threw:String(e)}; } }; }catch(_){}
  try{ window.__v105Probe=function(){ try{
    var v=document.getElementById('view');
    return { banner: !!(v&&v.querySelector('.v105-notloaded')),
             text: (v&&v.querySelector('.v105-notloaded'))?(v.querySelector('.v105-notloaded').innerText||'').replace(/\s+/g,' ').trim():null,
             shown: (function(){ try{ return (DB.businesses||[]).length; }catch(_){ return -1; } })(),
             skipped: (function(){ try{ return Number(window.__bizSkipped||0); }catch(_){ return -1; } })(),
             skippedNote: (function(){ try{ var v=document.getElementById('view'); var n=v&&v.querySelector('.v105-skipped');
               return n?(n.textContent||'').trim():null; }catch(_){ return null; } })(),
             held: HELD?HELD.length:0, loaded: loaded() };
  }catch(_){ return null; } }; }catch(_){}
  console.info('%c[v105] not loaded is not your data','color:#D92D20;font-weight:700');
}catch(e){ if(window.console)console.warn('[v105] init',e); }})();
