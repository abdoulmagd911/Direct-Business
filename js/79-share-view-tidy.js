/* js/79 — the view-only share link keeps its own promise (2026-09-15, fire #50, driven live).
   A share link (/s/<token>/<section>, js/10 + js/77) was opened in a fresh browser with no
   session against the real database. Three things were wrong on the screen, none in the data:
     1. The view-only banner (fixed, 36px) sat ON TOP of the page's top bar: the page title, the
        search box, the language and export buttons were covered. body.paddingTop does not move
        a sticky top bar (top:0) or the sticky sidebar. Both now start below the banner.
     2. The sidebar offered FINANCE. With no session js/52 holds to the employee floor
        (Today · Leads · Clients · Finance), so an outsider holding a link saw a Finance entry
        and could open an (empty) Finance page — while the panel that made the link promises
        "Today, Leads and Clients". Finance is now taken out of the sidebar in a shared view and
        a landing on it is sent to Today.
     3. The sidebar footer showed the app's built-in placeholder person (a real colleague's
        name and "Business Development") as if the outsider were signed in as them. js/20 only
        replaces that footer for a signed-in person. In a shared view it now says "View-only
        guest" / "ضيف — عرض فقط".
   Scoped strictly to the share path — js/10's own test — so nothing here runs for a signed-in
   person. Self-contained, try/catch; rollback = delete this file and its script line. */
(function(){try{
  var SHARE=/^\/s\/[A-Za-z0-9\-]{16,}(?:\/|$)/.test(String(location.pathname||''));
  if(!SHARE) return;
  var isAr=function(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } };
  /* 1. layout below the banner */
  try{
    var st=document.createElement('style'); st.id='v79shareCss';
    st.textContent='body[data-share="1"] .top{top:36px}'+
      'body[data-share="1"] .side{top:36px;height:calc(100vh - 36px)}'+
      'body[data-share="1"] #nav button[data-view="finance"],body[data-share="1"] #v44FinBtn{display:none!important}';
    (document.head||document.documentElement).appendChild(st);
  }catch(_){}
  var ALLOWED=['today','dashboard','leads','clients'];
  function tidy(){
    try{
      /* 2. Finance out of the sidebar, and off the page */
      var nav=document.getElementById('nav');
      if(nav){ nav.querySelectorAll('button').forEach(function(b){
        var id=b.getAttribute('data-view')||'';
        var txt=((b.querySelector('span')||b).textContent||'').trim();
        if(id==='finance'||b.id==='v44FinBtn'||txt==='Finance'||txt==='المالية') b.style.display='none';
      }); }
      /* 2026-09-17 (fire #78): this used to be `current='today'; render(); return;` — a silent bounce.
         It was added on 2026-09-15 (fire #50) because a share view that landed on Finance rendered an
         EMPTY page, which broke the banner's promise of Today, Leads and Clients. The page is not empty
         any more: js/16's renderFinance answers a share view with a sentence of its own ("Finance is not
         part of a view-only link"), because canFinView() is false here. Bouncing therefore costs the one
         thing this layer exists to protect — the holder types /s/<token>/finance, lands on Today and is
         told nothing. Leave Finance alone so it can say why; the sidebar entry above stays hidden, so
         the only way here is by address. Guard: probe-share-and-settings-attacks (the check that had been
         failing since 2026-09-15, unseen because the battery runner reported every probe green). */
      /* 4. INTERNAL APPARATUS OFF A SHARED CARD (2026-09-21, fire #165, measured on a real link).
         M28 asks who else can open a card. The answer on this path is "somebody outside the
         company", and what they were being shown, on a company's own card, was:
           · the ACTIVITY LOG — our own call notes, with "edit · remove" beside each one
             ("call: their finance man is difficult, push the discount" in the test that found it);
           · COMMENTS — internal discussion about the account;
           · NOTES — free text, on 100 of the 108 live companies.
         None of it is data the link is for: the panel that mints a link promises Today, Leads and
         Clients — the pipeline, not the file we keep on a company. Nothing was exposed when this was
         found (all four live links were switched off), which is exactly when to fix it.
         Hidden, not deleted: a signed-in colleague is untouched, and the holder is told once, in
         words, so a missing card is never mistaken for an empty one. */
      var view=document.getElementById('view');
      if(view){
        var INTERNAL=[/activity|workflow|النشاط|سير العمل/i, /^comments\b|التعليقات/i, /^notes\b|^ملاحظات/i];
        var hid=0;
        [].slice.call(view.querySelectorAll('.card')).forEach(function(c){
          try{
            var h=c.querySelector('h3'); if(!h) return;
            var t=(h.textContent||'').replace(/\s+/g,' ').trim();
            if(!INTERNAL.some(function(re){ return re.test(t); })) return;
            if(c.style.display!=='none'){ c.style.display='none'; }
            hid++;
          }catch(_){}
        });
        /* the suggested next step is coaching for our own team, and reads as nonsense to a guest */
        [].slice.call(view.querySelectorAll('.v35-next')).forEach(function(n){ n.style.display='none'; });
        /* v60's jump bar is built from whatever cards exist when it runs, 80ms after render — the
           same moment this is hiding them. Rather than race it, take the chips for the hidden
           sections back out: a button that scrolls to nothing is its own small lie. */
        var jump=document.getElementById('v60jump');
        if(jump){ [].slice.call(jump.querySelectorAll('button')).forEach(function(bt){
          var t=(bt.textContent||'').replace(/\s+/g,' ').trim();
          if(INTERNAL.some(function(re){ return re.test(t); })) bt.style.display='none';
        }); }
        if(hid && !view.querySelector('.v79-internal-note')){
          var note=document.createElement('div');
          note.className='v79-internal-note card';
          note.setAttribute('dir', isAr()?'rtl':'ltr');
          note.style.cssText='background:#F6F7F9;border:1px solid #E6E8EC;color:#4B5563;font-size:12.5px;'+
            'padding:10px 13px;margin:10px 0;text-align:'+(isAr()?'right':'left');
          note.textContent=isAr()
            ? 'الملاحظات الداخلية والتعليقات وسجل النشاط ليست جزءًا من الرابط المشارك.'
            : 'Internal notes, comments and the activity log are not part of a shared link.';
          view.appendChild(note);
        }
      }
      /* 3. an honest footer */
      var foot=document.querySelector('.side .foot')||document.querySelector('.foot');
      if(foot){
        var b=foot.querySelector('b'), s=foot.querySelector('span'), av=foot.querySelector('.av');
        var name=isAr()?'ضيف':'View-only guest', sub=isAr()?'عرض فقط — لا تعديل':'Read-only link · nothing can be changed';
        if(b&&b.textContent!==name) b.textContent=name;
        if(s&&s.textContent!==sub) s.textContent=sub;
        if(av&&av.textContent!=='👁') av.textContent='👁';
        foot.setAttribute('data-share-guest','1');
      }
    }catch(_){}
  }
  function hook(){
    try{
      if(typeof window.render==='function'&&!window.render.__v79){
        var _r=window.render;
        var w=function(){ var o=_r.apply(this,arguments); try{ tidy(); setTimeout(tidy,80); }catch(_){} return o; };
        w.__v79=1; window.render=w;
      }
    }catch(_){}
  }
  hook(); setInterval(function(){ hook(); tidy(); },1000);
  document.addEventListener('DOMContentLoaded',tidy);
}catch(e){ console.warn('[js/79 share-view-tidy]',e); }})();
