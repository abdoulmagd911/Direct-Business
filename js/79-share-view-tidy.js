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
      if(typeof current!=='undefined'&&current==='finance'){ current='today'; if(typeof render==='function') render(); return; }
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
