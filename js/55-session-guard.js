/* ===== Never show an empty page when the session is the problem (chapter, 2026-08-17) =====

   The story so far. A manager was shown "permission denied for function app_role" on Finance.
   The cause was that anonymous requests could not execute app_role(), so a lapsed token turned
   every query into an error. Granting anon the right to execute it fixed the error — and
   replaced it with something worse: Finance loaded happily and showed Revenue 0, Cost 0,
   Profit 0, Invoices 0. Real money, invisible, with nothing on screen saying anything was
   wrong. An error at least tells you not to trust the page.

   THIS FILE'S ONE JOB: if the app cannot see who you are, say so — never render zeros.

   IT DOES NOT TOUCH TOKENS. The first version of this guard called refreshSession() to try to
   mend a lapsed session. That was a mistake: this project has a documented history of sessions
   being silently destroyed by competing refresh-token rotation, and the auth log showed
   invalid-refresh-token events in the hours after it shipped. The Supabase client refreshes
   itself perfectly well; nothing here interferes with it. This only ever reads.

   HOW IT ASKS. It calls app_role() on the database, which answers with your role — or null if
   the request arrived without a valid session. That single answer is the whole test: it comes
   back through the same connection the data queries use, so it cannot disagree with them the
   way a locally-cached token can.                                                            */
(function(){try{
  var BAR_ID='sessgone', busy=false, shown=false;

  function client(){
    try{ if(window.fc) { var c=fc(); if(c) return c; } }catch(_){}
    /* Only ever use a client that already exists. Calling supabase.createClient() with no
     arguments looks harmless — the v44a memoiser is meant to hand back the shared client — but
     if it happens to be the FIRST call on the page it builds a client with no project URL and
     no key, and memoises that broken thing for everything that follows: sign-in, Finance, the
     roster. That is a page-wide outage caused by a convenience fallback. So: wait for the real
     client rather than risk creating a hollow one. */
    return null;
  }
  function ar(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }

  /* Only speak when the app believes somebody is signed in and is not on the login screen.
     A deliberate sign-out is not an expired session. */
  function signedInScreen(){
    try{
      if(window.__roleKnown!==true || !window.__userRole) return false;
      var pw=document.querySelector('input[type="password"]');
      if(pw && pw.offsetParent!==null) return false;
      return true;
    }catch(_){ return false; }
  }

  function show(){
    if(shown||document.getElementById(BAR_ID)) return;
    shown=true;
    var d=document.createElement('div');
    d.id=BAR_ID;
    d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#B54708;color:#fff;'+
      'padding:11px 16px;font:inherit;font-size:13.5px;display:flex;gap:12px;align-items:center;'+
      'justify-content:center;flex-wrap:wrap;box-shadow:0 2px 10px rgba(0,0,0,.25)';
    d.innerHTML='<span>'+(ar()
      ? 'انتهت جلستك، والأرقام المعروضة غير مكتملة. سجّل الدخول من جديد.'
      : 'Your session has expired — the figures on screen are not your real data. Sign in again.')+
      '</span><button id="sessgone_btn" style="background:#fff;color:#B54708;border:0;border-radius:8px;'+
      'padding:6px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">'+
      (ar()?'تسجيل الدخول':'Sign in again')+'</button>';
    document.body.appendChild(d);
    var b=document.getElementById('sessgone_btn');
    if(b) b.onclick=function(){
      try{ var c=client(); if(c&&c.auth&&c.auth.signOut) c.auth.signOut(); }catch(_){}
      try{ location.reload(); }catch(_){}
    };
  }
  function hide(){ var d=document.getElementById(BAR_ID); if(d)d.remove(); shown=false; }

  /* Ask the database who it thinks we are. Read-only, no tokens rotated. */
  function check(){
    if(busy) return; busy=true;
    var c=client();
    if(!c||!c.rpc){ busy=false; return; }
    c.rpc('app_role').then(function(r){
      busy=false;
      var role=(r&&!r.error)?r.data:null;
      if(role){ hide(); return; }                 // the database knows us — all is well
      if(!signedInScreen()) return;               // login screen or signing out — say nothing
      show();
    }).catch(function(){ busy=false; });
  }
  try{ window.__sessionCheck=check; }catch(_){}

  setTimeout(check, 6000);
  setInterval(check, 60000);

  /* Finance showing a full set of zeros is the exact shape of this fault, so check there and
     then rather than waiting for the next sweep. */
  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){
        var out=_r.apply(this,arguments);
        try{
          if(window.FIN){
            if(FIN.loadErr && /permission denied|JWT|not authenticated/i.test(String(FIN.loadErr))) check();
            else if(Array.isArray(FIN.rows) && FIN.rows.length===0) check();
          }
        }catch(_){}
        return out;
      };
    },200);
  }catch(_){}

  console.info('%c[session] expiry watch active (read-only)','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[session] init',e);}})();
