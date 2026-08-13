/* v67 — Ownership linked to REAL users (owner order 2026-08-13).
   Problem: owner names on records are plain text ("Abdelrahman", "Raad", "عثمان الشرفي"…)
   while the signed-in person resolves to their app_users full_name — so the "Mine"
   filters compared different spellings of the same human and matched nothing.
   Fix: every user now carries full_name + name_ar + nickname in app_users; this layer
   builds an alias index (English name, Arabic name, nickname, email prefix, unique
   first name) and gives the app:
     · ownerCanon(name)  → the person's canonical English full name
     · sameOwner(a,b)    → true when two spellings mean the same human
     · identity: DB.settings.currentUser is set from the signed-in email's roster row
   The Mine filters and owner dropdowns in the core now call sameOwner (guarded, so the
   app still works if this layer is absent). Additive + reversible. */
(function(){try{
  var ROSTER=[], ALIAS={};   // normalised alias → canonical full_name

  function norm(s){
    s=String(s==null?'':s).toLowerCase().trim();
    s=s.replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْـ]/g,'');
    s=s.replace(/[.\-_'’]/g,' ').replace(/\s+/g,' ').trim();
    // common English spellings of the same Arabic name collapse together
    s=s.replace(/\babdel\s?rahman\b|\babdul\s?rahman\b|\babdulrahman\b|\babdelrahman\b/g,'abdulrahman');
    s=s.replace(/\babdul\s?aziz\b|\babdulaziz\b|\babdelaziz\b/g,'abdulaziz');
    s=s.replace(/\bmohammed\b|\bmohammad\b|\bmuhammad\b/g,'mohammed');
    return s;
  }

  function buildIndex(rows){
    ROSTER=rows||[]; ALIAS={};
    var firstCount={};
    ROSTER.forEach(function(u){
      var fn=norm(u.full_name).split(' ')[0];
      if(fn)firstCount[fn]=(firstCount[fn]||0)+1;
    });
    ROSTER.forEach(function(u){
      if(u.active===false)return;
      var canon=(u.full_name||'').trim()||String(u.email||'').split('@')[0];
      [u.full_name,u.name_ar,u.nickname,String(u.email||'').split('@')[0]].forEach(function(a){
        var k=norm(a); if(k)ALIAS[k]=canon;
      });
      var fn=norm(u.full_name).split(' ')[0];
      if(fn&&fn.length>=3&&firstCount[fn]===1)ALIAS[fn]=canon;  // unique first names count too
      var far=norm(u.name_ar).split(' ')[0];
      if(far&&far.length>=3)ALIAS[far]=ALIAS[far]||canon;
    });
  }

  window.ownerCanon=function(s){ var k=norm(s); return (k&&ALIAS[k])||String(s==null?'':s); };
  window.sameOwner=function(a,b){
    var ka=norm(window.ownerCanon(a)), kb=norm(window.ownerCanon(b));
    if(!ka&&!kb)return true; if(!ka||!kb)return false;
    return ka===kb;
  };
  window.ownerLabel=function(s){ // Arabic screens show the Arabic name when we know it
    try{
      if(typeof LANG==='undefined'||LANG!=='ar')return s;
      var canon=window.ownerCanon(s);
      var u=ROSTER.find(function(x){return (x.full_name||'')===canon;});
      return (u&&u.name_ar)||s;
    }catch(_){return s;}
  };

  function client(){ try{ return window.fc?fc():((window.supabase&&window.supabase.createClient)?window.supabase.createClient(SUPA_URL,SUPA_KEY):null); }catch(_){ return null; } }

  var _loaded=false,_tries=0;
  function loadRoster(){
    if(_loaded||_tries>15)return; _tries++;
    var c=client(); if(!c)return;
    c.auth.getSession().then(function(s){
      var u=s&&s.data&&s.data.session&&s.data.session.user; if(!u)return;
      c.from('team_directory').select('id,email,full_name,name_ar,nickname,role,active').then(function(r){
        if(r.error||!r.data)return;
        _loaded=true;
        buildIndex(r.data);
        // the signed-in person's canonical identity, from their email — not from a stale blob value
        var meRow=r.data.find(function(x){return String(x.email||'').toLowerCase()===String(u.email||'').toLowerCase();});
        if(meRow){
          var nm=(meRow.full_name||'').trim()||String(meRow.email||'').split('@')[0];
          window.__userName=nm;
          try{ DB.settings=DB.settings||{}; DB.settings.currentUser=nm; }catch(_){}
        }
        try{ if(typeof render==='function')render(); }catch(_){}
      });
    }).catch(function(){});
  }
  [800,2500,6000].forEach(function(d){setTimeout(loadRoster,d);});
  var iv=setInterval(function(){ if(_loaded){clearInterval(iv);return;} loadRoster(); },4000);

  console.info('%c[v67] ownership linked to real users (alias matching) loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v67] init',e);}})();
