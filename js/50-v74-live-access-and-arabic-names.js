/* v74 — access stays live, and people have Arabic names (2026-08-13).

   1) ACCESS IS RE-CHECKED WHILE YOU WORK. Until now the app asked "who is this and what may
      they do?" once, at sign-in, and never again. So switching someone off in Team, or
      changing their role, did nothing until they happened to reload — they carried on
      clicking, and every save was refused. Now the app re-checks every 90 seconds and
      whenever the tab is brought back to the front:
        · switched off  → they are signed out with a plain message (no silent dead end)
        · role changed  → the new permissions apply immediately and they are told once
      The database was always the real wall; this makes the screen agree with it in real time.

   2) ARABIC NAMES. Everyone's Arabic name is on file. In the Arabic view the owner columns
      and the "assigned to / account manager" dropdowns now SHOW the Arabic name while still
      STORING the English one, so filtering, matching and reports are unaffected.            */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }

  /* ---------- 1. live access re-check ------------------------------------------------ */
  var lastRole=null, told=false;
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }

  function signOutWithReason(title,line){
    try{
      var ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;z-index:2147483200;background:rgba(20,22,43,.6);display:flex;align-items:center;justify-content:center;padding:20px';
      ov.innerHTML='<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:24px;text-align:'+(isAr()?'right':'left')+'">'+
        '<div style="font-size:17px;font-weight:800;color:#D92D20;margin-bottom:8px">'+title+'</div>'+
        '<div style="font-size:13.5px;color:#55596A;line-height:1.7">'+line+'</div></div>';
      document.body.appendChild(ov);
    }catch(_){}
    setTimeout(function(){
      try{
        var c=client();
        if(c&&c.auth&&c.auth.signOut) c.auth.signOut().then(function(){ location.reload(); });
        else location.reload();
      }catch(_){ location.reload(); }
    }, 3500);
  }

  function recheck(){
    try{
      var c=client(); if(!c||!c.auth||!c.auth.getSession)return;
      c.auth.getSession().then(function(s){
        var u=s&&s.data&&s.data.session&&s.data.session.user; if(!u)return;
        c.from('app_users').select('role,active').eq('id',u.id).maybeSingle().then(function(r){
          if(r.error||!r.data)return;                       // network hiccup — never act on doubt
          var d=r.data;
          if(d.active===false){
            signOutWithReason(fl('Your access has been switched off','تم إيقاف صلاحيتك'),
              fl('An admin switched this account off. Anything you already saved is safe. Talk to your admin if this is unexpected.',
                 'قام أحد المسؤولين بإيقاف هذا الحساب. كل ما حفظته محفوظ. راجع المسؤول إذا كان ذلك غير متوقع.'));
            return;
          }
          if(lastRole===null){ lastRole=d.role; return; }   // first look — just remember it
          if(d.role!==lastRole){
            lastRole=d.role;
            try{
              window.__userRole=d.role;
              window.__userTier=(d.role==='admin')?'admin':(d.role==='manager')?'manager':(d.role==='viewer')?'viewer':'team';
              document.body.setAttribute('data-rtier',window.__userTier);
              if(typeof render==='function')render();
            }catch(_){}
            if(!told){
              told=true;
              try{ if(typeof toast==='function') toast(fl('Your access level was changed to '+d.role+' — the app has updated.','تم تغيير مستوى صلاحيتك إلى '+d.role+' — تم تحديث التطبيق.')); }catch(_){}
              setTimeout(function(){ told=false; }, 30000);
            }
          }
        });
      });
    }catch(_){}
  }
  try{ window.__recheckAccess=recheck; window.__localiseNames=function(){try{localiseNames();}catch(_){}}; }catch(_){}
  setTimeout(recheck, 12000);
  setInterval(recheck, 90000);
  try{ document.addEventListener('visibilitychange', function(){ if(!document.hidden) recheck(); }); }catch(_){}

  /* ---------- 2. Arabic names on screen (English still stored) ----------------------- */
  function arMap(){
    var m={};
    try{ (window.__ROSTER||window.__TEAMU||[]).forEach(function(u){
      var en=(u.full_name||'').trim(), ar=(u.name_ar||'').trim(), nick=(u.nickname||'').trim();
      if(en&&ar){ m[en]=ar; if(nick&&nick!==en) m[nick]=ar; }
    }); }catch(_){}
    return m;
  }
  function localiseNames(){
    try{
      if(!isAr())return;
      var m=arMap(); var keys=Object.keys(m); if(!keys.length)return;

      /* dropdowns: swap the LABEL only, never the stored value */
      document.querySelectorAll('#qe_owner option, #qe_am option, #f_assign option, #view select option').forEach(function(o){
        try{
          var t=(o.textContent||'').trim();
          if(m[t]){ if(!o.getAttribute('data-en'))o.setAttribute('data-en',t); o.textContent=m[t]; }
        }catch(_){}
      });
      /* the signed-in person's name in the sidebar footer */
      try{
        var foot=document.querySelector('.side .foot b, .foot b');
        if(foot){ var fn=(foot.textContent||'').trim(); if(m[fn]) foot.textContent=m[fn]; }
      }catch(_){}
      /* owner cells in tables */
      document.querySelectorAll('#view td').forEach(function(td){
        try{
          if(td.children.length)return;                    // leave cells that hold tags/buttons
          var t=(td.textContent||'').trim();
          if(m[t]) td.textContent=m[t];
        }catch(_){}
      });
    }catch(_){}
  }

  try{
    var _r=window.render;
    window.render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(localiseNames,60); }catch(_){} return o; };
  }catch(_){}
  [1500,4000].forEach(function(d){ setTimeout(localiseNames,d); });
  setInterval(localiseNames, 5000);

  console.info('%c[v74] live access re-check + Arabic names loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v74] init',e);}})();
