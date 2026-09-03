/* v56 — Ownership: real users own leads/clients/proposals.
      • team dropdowns are fed from the live app_users list (via the team_directory view),
        not free text, so every "assigned to / account manager / owner" offers real people.
      • one-click "Mine" on Leads, Clients and Proposals (owner === the signed-in user).
      me() already resolves to the signed-in user's display name (full name, or email prefix). */
(function(){try{
  if(typeof leadFilter!=='undefined' && leadFilter.mine===undefined) leadFilter.mine=false;
  if(window.offerMine===undefined) window.offerMine=false;

  // Reliable "who am I" display name. The global `me` is the auth session object after login,
  // so we read the resolved display name the app already stores (set by fetchRole / setMe).
  /* Who I am comes from MY SIGN-IN first. The shared settings row is only a fallback: it is one
     row for the whole company, so whoever signed in last used to overwrite everyone else's name
     there — which made "Mine" show another person's work. Session identity always wins now. */
  window.meName=function(){ try{ if(window.__userName) return window.__userName; if(typeof DB!=='undefined'&&DB.settings&&DB.settings.currentUser) return DB.settings.currentUser; if(typeof me==='function') return me(); }catch(_){ } return ''; };

  // Clients "Mine": toggle the existing owner filter between me and everyone.
  window.clToggleMine=function(){ try{ var m=(window.meName?meName():''); if(typeof clFilter==='undefined')return; clFilter.owner=(clFilter.owner===m?'all':m); if(typeof render==='function')render(); }catch(_){} };

  // Prefer the real team roster (loaded below) over the free-text fallback list.
  var _prevTeamList=window.teamList;
  window.teamList=function(){
    if(window.__TEAM && window.__TEAM.length) return window.__TEAM;
    if(typeof _prevTeamList==='function') return _prevTeamList();
    return (typeof DB!=='undefined'&&DB.settings&&DB.settings.team&&DB.settings.team.length)?DB.settings.team:(typeof TEAM!=='undefined'?TEAM:[]);
  };

  // Load the live roster from the team_directory view (readable by every signed-in user).
  // Use the app's ONE shared client (fc(), exposed by js/16). SUPA_URL / SUPA_KEY are declared
  // `var` inside each layer's own IIFE — they are NOT globals — so the old bare reference here
  // threw a ReferenceError (swallowed by the catch) on every call, __sb56 never got built, the
  // roster never loaded, and teamList() fell back forever to the hardcoded TEAM=["Abdelrahman",
  // …]. That stale list is what the owner / account-manager / assigned-to dropdowns showed.
  // (2026-09-02 CRM audit — probe-crm-attacks.mjs asserts the dropdowns list the real roster.)
  function _c56(){ try{ if(window.fc) return fc(); }catch(_){ } return null; }
  var _tries=0, _done=false;
  function loadTeam(){
    if(_done) return; _tries++;
    var c=_c56(); if(!c){ if(_tries<10) return; return; }
    c.auth.getSession().then(function(s){
      var u=s&&s.data&&s.data.session&&s.data.session.user; if(!u){ return; }
      c.from('team_directory').select('id,email,full_name,role,active').then(function(r){
        if(r.error||!Array.isArray(r.data)){ _done=true; return; }  // no view (e.g. harness) → keep fallback
        var seen={}, names=[];
        r.data.forEach(function(x){ if(x.active===false) return; var n=String(x.full_name||'').trim()|| String(x.email||'').split('@')[0]; if(n && !seen[n]){ seen[n]=1; names.push(n); } });
        window.__TEAMU=r.data;
        if(names.length){ window.__TEAM=names.sort(function(a,b){return a.localeCompare(b);}); _done=true; if(typeof render==='function') render(); }
      }).catch(function(){});
    }).catch(function(){});
  }
  var _iv=setInterval(function(){ if(_done||_tries>=10){ clearInterval(_iv); return; } loadTeam(); }, 1500);
  setTimeout(loadTeam, 700);
  console.info('%c[v56] ownership (real team + Mine) loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v56] init',e);}})();
