/* ===== v44a: one Supabase client for the whole page =====
   The app used to create five separate Supabase clients. They all share the same
   browser storage, and each one runs its own token-refresh timer. Refresh tokens are
   single-use, so whichever client refreshed second got a revoked token and silently
   signed the user out - the "you are logged out again after a refresh" bug.
   Memoising createClient means every layer now shares one client and one refresh timer.

   2026-09-27 (speed, finding B of the oversight's list): ONE QUESTION, ONE ANSWER. Measured live on Today as the QA
   account: 62 database calls per page load, 17 of them the exact same question asked again by another layer a moment
   later (the unpaid-invoice total five times, the signed-in person's own row three times, the team list three times, the
   KPI lists twice …). The client is now given a fetch that lets an identical READ share one answer: while the first is
   on its way, and for a short while after (SHARE_MS), the same question gets a copy of the same reply instead of a new
   call. Safe by construction:
     · only reads are shared — a GET on the REST API, or a POST to one of the read-only functions named in READ_RPC;
     · the question is the whole request: method, address with every filter, who is asking (the Authorization header),
       and the paging / count / shape headers (Range, Prefer, Accept) — a different person or a different page never
       shares;
     · ANY write to the database (a table write, any other function, a storage upload, an edge function) forgets every
       shared answer at once, so a read after a save always goes to the database;
     · a failed answer (not 2xx, or the network failing) is never shared;
     · nothing else is touched: the browser's own fetch is called at call time (so a test that wraps window.fetch still
       sees every real call), and requests to sign in (auth) are not shared;
     · "who am I / what may I see" (app_role, my_page_levels) is NEVER shared — it is how the page notices a session that
       lapsed mid-use (js/55), and a copied answer from a moment ago would hide exactly that.
   The window is 0.8 s, not longer (measured in the full battery, 2026-09-27): at 2.5 s four real behaviours broke — a
   layer that re-asks on purpose because it knows the data just changed (activities arriving after a call is logged, a
   person just invited, a card re-reading its contacts) got the answer from before the change. 0.8 s still covers one
   page load's burst of layers asking the same question, and is shorter than any deliberate "ask again". */
(function(){
  var SHARE_MS=800;
  var READ_RPC=/\/rest\/v1\/rpc\/(team_access_list|team_nicknames|team_roster|changes_to_my_tasks|changes_to_my_companies|company_documents_presence)(\?|$)/;
  function hdr(h,name){
    try{
      if(!h) return '';
      if(typeof h.get==='function') return h.get(name)||'';
      var want=name.toLowerCase(); for(var k in h){ if(Object.prototype.hasOwnProperty.call(h,k)&&k.toLowerCase()===want) return String(h[k]); }
    }catch(_){}
    return '';
  }
  function shareFetch(inner){
    var shared={};
    var fn=function(input,init){
      var f=inner||window.fetch;
      try{
        var url=typeof input==='string'?input:((input&&input.url)||String(input));
        var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
        var rest=/\/rest\/v1\//.test(url), readRpc=method==='POST'&&READ_RPC.test(url);
        var read=rest&&((method==='GET'&&!/\/rest\/v1\/rpc\//.test(url))||readRpc);
        if(!read){
          if(method!=='GET'&&method!=='HEAD'&&method!=='OPTIONS'&&!/\/auth\/v1\//.test(url)) shared={};   // a write: forget every shared answer
          /* 2026-09-28 (F2): a record saved straight to its table (a rule, a task, a client ID…) is a save too — tell the
             sync badge (js/75), which otherwise only heard about the old whole-workspace save and kept saying "40 min ago" */
          if(rest&&!/\/rest\/v1\/rpc\//.test(url)&&/^(POST|PATCH|PUT|DELETE)$/.test(method)){
            var wp=f(input,init);
            try{ wp.then(function(r){ try{ if(r&&r.ok&&typeof window.__syncOk==='function') window.__syncOk(); }catch(_){} },function(){}); }catch(_){}
            return wp;
          }
          return f(input,init);
        }
        var h=(init&&init.headers)||(input&&input.headers);
        var key=method+' '+url+' '+hdr(h,'Authorization')+' '+hdr(h,'Range')+' '+hdr(h,'Prefer')+' '+hdr(h,'Accept')+' '+hdr(h,'Accept-Profile')+(readRpc?' '+String((init&&init.body)||''):'');
        var e=shared[key], now=Date.now();
        if(e&&(e.pending||now-e.at<SHARE_MS)){ fn.hits++; return e.p.then(function(r){ return r.clone(); }); }
        var p=f(input,init), box=shared, entry={p:p,at:now,pending:true};
        shared[key]=entry;
        p.then(function(r){ entry.pending=false; entry.at=Date.now(); if(!r||!r.ok){ if(box[key]===entry) delete box[key]; } },
               function(){ if(box[key]===entry) delete box[key]; });
        return p.then(function(r){ return r.clone(); });
      }catch(_){ return f(input,init); }
    };
    fn.hits=0; fn.forget=function(){ shared={}; };
    return fn;
  }
  function patch(){
    var S=window.supabase;
    if(!S||!S.createClient||S.__directSingleton) return !!(S&&S.__directSingleton);
    var real=S.createClient, one=null;
    S.createClient=function(url,key,opts){
      if(one) return one;
      var o=opts||{};
      o.auth=Object.assign({persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},o.auth||{});
      o.global=Object.assign({},o.global||{});
      var sf=shareFetch(o.global.fetch);
      o.global.fetch=sf; window.__sharedReads=sf;   /* __sharedReads.hits: how many calls were answered from a shared reply */
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
