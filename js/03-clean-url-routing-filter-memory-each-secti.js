/* Clean URL routing + filter memory: each section/record gets a real path (no # and no query);
   refresh, back & forward keep your place. The active filters and sub-tabs on Leads/Clients are
   recorded in history too, so pressing Back first UNDOES the last filter you applied and keeps you
   on the page, instead of ejecting you out to whatever section you were on before. */
(function(){try{
  var VALID=['today','dashboard','leads','clients','airlines','vendors','providers','sops','slas','sopsla','reports','ops','operations','offers','activity','archive','bookings','invoices','tickets','finance','settings','events','sync','projects','documents'];
  // capture the address the page opened at (accept clean path, or migrate an old #/hash); ignore any ?v= cache param
  var boot=(function(){var h=String(location.hash||'');if(h.indexOf('#/')===0)return h.slice(1);return String(location.pathname||'/');})();
  /* 2026-09-06 (round 58) — publish the address the page actually opened at.
     location.pathname is NOT a safe substitute for any module loaded after this one:
     restoreBoot() below rewrites it to '/' + current a few hundred ms into boot, and on a
     slower device that happens BEFORE the later scripts have even been evaluated. Found by
     watch cycle 35 and reproduced here by CPU throttling alone — a /documents/<tab> deep
     link survives at 1x and is lost from 4x up, which is an ordinary mid-range phone.
     See docs/DEEPLINK-BOOT-RACE.md. */
  try{ window.__bootPath=boot; }catch(_){}
  var ready=false, lastPath=null, restoring=false;
  /* 2026-09-09 (live test C5): a CLIENT's card is the same screen as a lead's (openLead under the
     Leads section), so its address read /leads/lead/<id>. The address now says what the person
     opened — /clients/client/<id> — and both shapes are understood on the way back in. */
  function parse(path){var m=String(path||'').match(/^\/([a-zA-Z]+)(?:\/(lead|client|offer|invoice)\/([^\/?#]+))?/);return m?{sec:m[1],dk:m[2],dv:m[3]}:null;}
  function isClientId(id){try{var b=(typeof getLead==='function')?getLead(id):null;return !!(b&&b.isClient);}catch(_){return false;}}
  function curSafe(){try{return current;}catch(_){return undefined;}}
  function leadSafe(){try{return (typeof openLead!=='undefined')?openLead:'';}catch(_){return '';}}
  function buildPath(){var c=curSafe();if(typeof c==='undefined')return null;var p='/'+c;try{if(typeof openLead!=='undefined'&&openLead){if(c==='leads'&&isClientId(openLead))p='/clients/client/'+openLead;else p+='/lead/'+openLead;}else if(typeof openOffer!=='undefined'&&openOffer)p+='/offer/'+openOffer;else if(typeof openInvoice!=='undefined'&&openInvoice)p+='/invoice/'+openInvoice;}catch(_){}return p;}
  // ---- the sub-state that Back should step through, per section (search text is left out on purpose,
  //      so Back never has to walk back through every keystroke) ----
  function snapFilters(){try{var c=curSafe();
    if(c==='leads'){var lf=(typeof leadFilter!=='undefined')?leadFilter:{};
      return JSON.stringify({s:lf.stage||'all',c:lf.cat||'all',h:!!lf.hideClosed,a:!!lf.attention,
        ft:(typeof window.__funnelTab!=='undefined'?window.__funnelTab:'all'),
        na:(typeof window.__needsAttn!=='undefined'?!!window.__needsAttn:false)});}
    if(c==='clients'){var cf=(typeof window.clFilter!=='undefined')?window.clFilter:{};
      return JSON.stringify({o:cf.owner||'all',t:cf.tier||'all'});}
  }catch(_){}return '';}
  function restoreFilters(fs){if(!fs)return;try{var o=JSON.parse(fs),c=curSafe();
    if(c==='leads'&&typeof leadFilter!=='undefined'){
      leadFilter.stage=o.s||'all';leadFilter.cat=o.c||'all';leadFilter.hideClosed=!!o.h;leadFilter.attention=!!o.a;
      window.__funnelTab=o.ft||'all';window.__needsAttn=!!o.na;
    }else if(c==='clients'&&typeof window.clFilter!=='undefined'){
      window.clFilter.owner=o.o||'all';window.clFilter.tier=o.t||'all';
    }
  }catch(_){}}
  function writeURL(){if(!ready||restoring)return;try{var p=buildPath();if(!p)return;var f=snapFilters();
    var st=history.state||{};var samePath=(location.pathname===p&&!location.hash);
    if(lastPath!==null&&samePath&&st.f===f)return; // nothing meaningful changed → no new history entry
    var entry={p:p,f:f};
    if(lastPath===null)history.replaceState(entry,'',p);else history.pushState(entry,'',p);
    lastPath=p;
  }catch(_){}}
  // Friendly addresses that are not view ids. Before 2026-09-02 (attack round 19) `/providers`
  // was accepted as valid, set current='providers' — a view that does not exist — and the app
  // quietly showed Today under a /providers address. The page's real id is `vendors`.
  var ALIAS={providers:'vendors',operations:'ops',dashboard:'today'};
  function applyRoute(r){if(!r)return false;if(r.sec&&ALIAS[r.sec])r.sec=ALIAS[r.sec];if(VALID.indexOf(r.sec)<0&&!r.dk)return false;try{if((r.dk==='lead'||r.dk==='client')&&r.dv){current='leads';openWhenPresent(r.dv);}else if(r.dk==='offer'&&r.dv){current='offers';openOffer=r.dv;}else if(r.dk==='invoice'&&r.dv){current='invoices';openInvoice=r.dv;}else{if(VALID.indexOf(r.sec)>=0)current=r.sec;try{openLead='';}catch(_){}}}catch(_){return false;}return true;}
  /* 2026-09-09 (live test C5, found while giving client cards their address): a card deep link
     (/leads/lead/<id>) never survived a boot, on any machine. The route was applied a few
     hundred ms in, while DB.businesses still held the start-up copy; the card render could not
     find the record and cleared openLead, and nothing re-applied the route once the table rows
     arrived. Open the card when the record is actually there; the list shows meanwhile. */
  var pendingRec=null;
  function openWhenPresent(id){
    try{ if(typeof getLead==='function'&&getLead(id)){ openLead=id; return true; } }catch(_){}
    pendingRec=id; var n=0;
    var iv=setInterval(function(){ n++; if(pendingRec!==id){ clearInterval(iv); return; }
      try{ if(typeof getLead==='function'&&getLead(id)){ clearInterval(iv); pendingRec=null; current='leads'; openLead=id; if(typeof render==='function')render(); } }catch(_){}
      if(n>240){ clearInterval(iv); if(pendingRec===id)pendingRec=null; } },250);
    return false;
  }
  function restoreBoot(){var r=parse(boot);if(applyRoute(r)){try{if(typeof render==='function')render();}catch(_){}}ready=true;lastPath=buildPath();try{if(lastPath)history.replaceState({p:lastPath,f:snapFilters()},'',lastPath);}catch(_){}}
  // wrap render AND the filter re-draws (renderLeads/drawLeads) so a filter change records history too
  function wrapFn(name){try{var f=window[name];if(typeof f==='function'&&!f.__pathWrap){var _f=f;window[name]=function(){var o=_f.apply(this,arguments);writeURL();return o;};window[name].__pathWrap=true;}}catch(_){}}
  function wrap(){wrapFn('render');wrapFn('renderLeads');wrapFn('drawLeads');}
  var tries=0;var iv=setInterval(function(){tries++;var ok=false;try{ok=(typeof render==='function'&&typeof DB!=='undefined');}catch(_){ok=false;}if(ok){wrap();clearInterval(iv);restoreBoot();}else if(tries>75){clearInterval(iv);wrap();restoreBoot();}},200);
  window.addEventListener('popstate',function(e){if(!ready)return;var r=parse(location.pathname);if(!r)return;
    var st=(e&&e.state)||history.state||{};
    var secChanged=(r.dk==='client'?'leads':r.sec)!==curSafe()||((r.dk==='lead'||r.dk==='client')&&r.dv!==leadSafe())||(!r.dk&&leadSafe());
    restoring=true;
    try{
      if(secChanged)applyRoute(r);
      restoreFilters(st.f);        // put the filters/sub-tabs back to how they were at this history point
      lastPath=buildPath();
      if(typeof render==='function')render();
    }catch(_){}
    restoring=false;
  });
}catch(e){console.warn('router',e);}})();
