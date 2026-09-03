/* ===== Page access, actually enforced (2026-08-21) =====

   window.mayOpenPage()/window.myAllowedPages() (js/52-v76-access-model.js) were defined and
   never called by anything — confirmed by grepping the whole tree. So a forbidden page's nav
   button was hidden, but a direct URL visit (bookmark, typed address, a stale deep link)
   rendered it anyway; nothing client-side ever stopped that. The real backstop stays
   server-side RLS, which is uneven across pages (see js/56's own "the database also
   enforces" list) — this layer does not change that. What it adds: a person who lands on a
   page they cannot open gets sent to Today with a plain one-line explanation instead of a
   silently blank or half-drawn page, and the attempt is logged so a PATTERN of them is
   visible to whoever reads Activity & Audit, not just a one-off bounce nobody ever sees
   again.

   Gated on window.__accessKnown() (js/52's own known() export) — not merely on
   myAllowedPages() returning a restricted list. Before the role is confirmed, myAllowedPages()
   already answers with the safe PAGES_EMPLOYEE floor (see js/52), and if this layer acted on
   that answer during the unknown-role window it would bounce someone who was about to turn
   out to be an admin, purely because the answer hadn't arrived yet. Once __accessKnown() is
   true the decision is final — admins get null (unrestricted) immediately and are never at
   risk here regardless of how slowly the page_access matrix itself loads. */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }

  var BANNER_ID='v64-access-denied';
  function showBanner(){
    var v=document.getElementById('view'); if(!v||document.getElementById(BANNER_ID))return;
    var d=document.createElement('div');
    d.id=BANNER_ID; d.className='card';
    d.style.cssText='border-color:#F0453A;background:#FDECEB;margin-bottom:14px;color:#D92D20;font-weight:600';
    d.textContent=fl('You do not have access to that page — ask an admin if you need it.','ليست لديك صلاحية للوصول إلى هذه الصفحة — اطلب من أحد المسؤولين إذا احتجت إليها.');
    v.insertBefore(d,v.firstChild);
  }
  function logDenied(page){
    // supabase-js's .rpc() returns a lazy "thenable" builder — it only actually sends the
    // request once something calls .then() on it. Calling .catch() alone (no .then()) never
    // triggers the request at all, silently: found by reproducing this exact call dropping
    // its request with zero error, every time, until a .then() was added. Not a guess —
    // confirmed by adding a .then() with everything else identical.
    try{ var c=client(); if(c&&c.rpc) c.rpc('log_page_denied',{p_page:page}).then(function(){},function(){}); }catch(_){}
  }

  var lastLogged=null; // one log entry per attempt, not one per re-render while stuck on it
  /* 2026-09-03 (audit/events/search attack round): the card was inserted into #view and then
     wiped by the very next render — Today refreshes itself a few hundred milliseconds after
     the bounce, so the explanation flashed up and vanished (measured: present at 400 ms, gone
     by 900 ms) and the person was left moved with no reason given. Re-assert it on the renders
     that follow the bounce, for long enough to be read; showBanner() is already idempotent. */
  var stickUntil=0, STICK_MS=8000;
  if(typeof window.render==='function'){
    var _r64=window.render;
    window.render=function(){
      try{
        if(typeof window.__accessKnown==='function' && window.__accessKnown()
           && typeof window.myAllowedPages==='function' && typeof current!=='undefined' && current){
          var allowed=window.myAllowedPages();
          if(allowed && allowed.indexOf(current)<0){
            var denied=current;
            current='today';
            if(lastLogged!==denied){ lastLogged=denied; logDenied(denied); }
            var out=_r64.apply(this,arguments);
            stickUntil=Date.now()+STICK_MS;
            showBanner();
            return out;
          }
        }
      }catch(e){ if(window.console)console.warn('[v64] access guard',e); }
      lastLogged=null;
      var out2=_r64.apply(this,arguments);
      try{ if(Date.now()<stickUntil) showBanner(); }catch(_){}
      return out2;
    };
  }
}catch(e){ if(window.console)console.warn('[v64] init',e); }})();
