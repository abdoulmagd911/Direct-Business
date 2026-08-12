/* ===== v45: stop one person's save wiping another's work =====
   Leads already save row by row, so two people editing different leads is safe.
   Everything else - bookings, invoices, offers, requests, projects, settings - lives in
   one JSON row that pushCloud() used to replace in full on every save. Whoever saved
   last silently overwrote the other person's sections.

   This wraps the shared client's rpc(): a save_state call is turned into a
   save_state_patch call carrying only the sections whose contents actually changed since
   this tab loaded. Untouched sections are no longer sent, so they can no longer be
   clobbered. If anything about the patch path fails it falls straight back to the old
   full save, so saving can never be worse than before.                                   */
(function(){try{
  var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
  var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
  var baseline=null;

  function getDB(){ try{ if(typeof DB!=='undefined' && DB) return DB; }catch(_){} return window.DB||null; }
  function j(v){ try{ return JSON.stringify(v); }catch(_){ return null; } }
  function snapshot(obj){
    var o={}; Object.keys(obj||{}).forEach(function(k){ if(k!=='businesses') o[k]=j(obj[k]); }); return o;
  }

  /* Baseline = the blob exactly as this tab loaded it. Taken once the workspace is up. */
  var bt=0;
  var bi=setInterval(function(){
    bt++;
    var d=getDB();
    var loaded = d && Object.keys(d).length>3 && !document.getElementById('cl_go');
    if(loaded){ baseline=snapshot(d); clearInterval(bi); console.info('%c[v45] baseline taken: '+Object.keys(baseline).length+' sections','color:#FF6B00'); }
    else if(bt>900) clearInterval(bi);
  },400);

  function wrap(client){
    if(!client || typeof client.rpc!=='function' || client.__v45) return false;
    var orig=client.rpc.bind(client);
    client.rpc=function(fn,args){
      try{
        if(fn==='save_state' && args && args.payload && baseline){
          var payload=args.payload, patch={}, n=0;
          Object.keys(payload).forEach(function(k){
            if(k==='businesses') return;
            var cur=j(payload[k]);
            if(cur!==baseline[k]){ patch[k]=payload[k]; n++; }
          });
          if(!n){ return Promise.resolve({data:null,error:null}); }   /* nothing changed */
          return orig('save_state_patch',{patch:patch}).then(function(r){
            if(r && r.error){
              console.warn('[v45] patch save failed, falling back to full save',r.error.message);
              return orig('save_state',{payload:payload});
            }
            Object.keys(patch).forEach(function(k){ baseline[k]=j(patch[k]); });
            return r;
          }).catch(function(e){
            console.warn('[v45] patch save threw, falling back to full save',e);
            return orig('save_state',{payload:payload});
          });
        }
      }catch(e){ console.warn('[v45] wrap error, using full save',e); }
      return orig.apply(null,arguments);
    };
    client.__v45=true;
    console.info('%c[v45] partial saves active','color:#FF6B00;font-weight:700');
    return true;
  }

  var wt=0;
  var wi=setInterval(function(){
    wt++;
    try{
      if(window.supabase && window.supabase.createClient){
        if(wrap(window.supabase.createClient(SUPA_URL,SUPA_KEY))) clearInterval(wi);
      }
    }catch(_){}
    if(wt>300) clearInterval(wi);
  },200);
}catch(e){console.warn('v45 layer failed',e);}})();
