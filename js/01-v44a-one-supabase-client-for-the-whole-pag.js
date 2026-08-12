/* ===== v44a: one Supabase client for the whole page =====
   The app used to create five separate Supabase clients. They all share the same
   browser storage, and each one runs its own token-refresh timer. Refresh tokens are
   single-use, so whichever client refreshed second got a revoked token and silently
   signed the user out - the "you are logged out again after a refresh" bug.
   Memoising createClient means every layer now shares one client and one refresh timer. */
(function(){
  function patch(){
    var S=window.supabase;
    if(!S||!S.createClient||S.__directSingleton) return !!(S&&S.__directSingleton);
    var real=S.createClient, one=null;
    S.createClient=function(url,key,opts){
      if(one) return one;
      var o=opts||{};
      o.auth=Object.assign({persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},o.auth||{});
      one=real(url,key,o);
      return one;
    };
    S.__directSingleton=true;
    return true;
  }
  if(!patch()){
    var t=setInterval(function(){ if(patch()) clearInterval(t); },50);
    setTimeout(function(){ clearInterval(t); },15000);
  }
})();
