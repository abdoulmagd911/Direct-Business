/* ===== v43: per-session identity — offers/activities stamp the real signed-in person ===== */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sbN=null;
function nc(){ if(!sbN&&window.supabase){try{sbN=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sbN; }
function fetchMe(){
  /* The login layer now sets __userName the moment the role check answers, so most of the
     time this lookup has nothing left to do — skip the network round-trip it used to make
     three times on every load. It still runs when the name is genuinely missing. */
  if(window.__userName) return;
  var c=nc(); if(!c)return;
  c.auth.getSession().then(function(s){
    var u=s&&s.data&&s.data.session&&s.data.session.user; if(!u)return;
    c.from('app_users').select('full_name').eq('id',u.id).maybeSingle().then(function(r){
      var nm=(r.data&&(r.data.full_name||'').trim())||(u.email||'').split('@')[0];
      if(nm)window.__userName=nm;
    });
  });
}
/* me() now prefers THIS session's signed-in person; the shared-blob name is only a fallback */
var _oldMe=window.me;
window.me=function(){
  if(window.__userName)return window.__userName;
  try{var v=_oldMe?_oldMe():'';return v||'';}catch(_){return '';}
};
fetchMe(); setTimeout(fetchMe,2500); setTimeout(fetchMe,7000);
try{document.addEventListener('visibilitychange',function(){if(!document.hidden)fetchMe();});}catch(_){}
console.info('%c[v43 per-session identity] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v43 failed',e);}})();
