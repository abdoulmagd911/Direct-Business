/* ===== Say when a session has expired (chapter, 2026-08-16) =====

   A manager sat on the Finance page and was told "permission denied for function app_role.
   Make sure you are signed in." He *was* signed in, as far as he could tell — the sidebar had
   his name on it and every other page looked normal.

   What had actually happened: his access token had expired and the silent refresh had not
   landed, so the browser's requests were arriving at the database as an anonymous visitor. The
   database is now set up to answer those requests with "nothing to show" instead of an error,
   which stops the alarming message — but an empty Finance page is its own kind of lie. If the
   session is gone, the app should say so, in words, and offer the one thing that fixes it.

   So this watches the session in the background. When it finds the app is showing a signed-in
   screen while the session underneath has lapsed, it tries a quiet refresh first, and only if
   that fails does it say anything. The bar it shows is not dismissable-and-forgotten: it names
   the problem and signs the person back in.                                                  */
(function(){try{
  var BAR_ID='sessgone', checking=false, shown=false;

  function client(){
    try{ if(window.fc) return fc(); }catch(_){}
    try{ return window.supabase && window.supabase.createClient && window.supabase.createClient(); }catch(_){ return null; }
  }
  function ar(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }

  /* Only complain when the app believes somebody is signed in. During the login screen, and
     during the first seconds while the role is still being fetched, silence is correct. */
  function appThinksSignedIn(){
    try{
      if(window.__roleKnown!==true || !window.__userRole) return false;
      /* Signing out deliberately is not an expired session. The role flags can still be set for
         a moment after the sign-out click, so the login screen itself is the deciding evidence:
         if a password box is on the page, the person is being asked to sign in already and has
         nothing to learn from a bar telling them so. */
      var pw=document.querySelector('input[type="password"]');
      if(pw && pw.offsetParent!==null) return false;
      if(window.__signingOut) return false;
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
      ? 'انتهت جلستك. لم تعد بياناتك محمّلة — سجّل الدخول من جديد للمتابعة.'
      : 'Your session has expired, so the app can no longer load your data. Sign in again to continue.')+
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

  function check(){
    if(checking) return; checking=true;
    var c=client();
    if(!c||!c.auth||!c.auth.getSession){ checking=false; return; }
    c.auth.getSession().then(function(r){
      var s=r&&r.data&&r.data.session;
      var alive=!!(s&&s.access_token);
      /* a token that expires within the next half minute is treated as already gone, so the
         refresh happens before the next query fails rather than after */
      if(alive && s.expires_at && (s.expires_at*1000 - Date.now() < 30000)) alive=false;
      if(alive){ checking=false; hide(); return; }
      if(!appThinksSignedIn()){ checking=false; return; }   // login screen — nothing to say
      /* try to mend it quietly before troubling anyone */
      if(c.auth.refreshSession){
        c.auth.refreshSession().then(function(rr){
          checking=false;
          if(rr&&rr.data&&rr.data.session&&rr.data.session.access_token){ hide(); return; }
          show();
        }).catch(function(){ checking=false; show(); });
      } else { checking=false; show(); }
    }).catch(function(){ checking=false; });
  }

  try{ window.__sessionCheck=check; }catch(_){}
  setInterval(check, 45000);
  setTimeout(check, 8000);

  /* If a query still comes back with the old permission error — an older tab, a cached page —
     translate it into the same plain sentence rather than showing database wording. */
  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){
        var out=_r.apply(this,arguments);
        try{
          if(window.FIN && FIN.loadErr && /permission denied|JWT|not authenticated/i.test(String(FIN.loadErr))) check();
        }catch(_){}
        return out;
      };
    },200);
  }catch(_){}

  console.info('%c[session] expiry watch active','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[session] init',e);}})();
