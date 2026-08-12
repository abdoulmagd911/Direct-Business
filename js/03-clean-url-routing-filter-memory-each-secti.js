/* Clean URL routing + filter memory: each section/record gets a real path (no # and no query);
   refresh, back & forward keep your place. The active filters and sub-tabs on Leads/Clients are
   recorded in history too, so pressing Back first UNDOES the last filter you applied and keeps you
   on the page, instead of ejecting you out to whatever section you were on before. */
(function(){try{
  var VALID=['today','dashboard','leads','clients','airlines','vendors','providers','sops','slas','sopsla','reports','ops','operations','offers','activity','archive','bookings','invoices','tickets','finance','settings','events','sync','projects'];
  // capture the address the page opened at (accept clean path, or migrate an old #/hash); ignore any ?v= cache param
  var boot=(function(){var h=String(location.hash||'');if(h.indexOf('#/')===0)return h.slice(1);return String(location.pathname||'/');})();
  var ready=false, lastPath=null, restoring=false;
  function parse(path){var m=String(path||'').match(/^\/([a-zA-Z]+)(?:\/(lead|offer|invoice)\/([^\/?#]+))?/);return m?{sec:m[1],dk:m[2],dv:m[3]}:null;}
  function curSafe(){try{return current;}catch(_){return undefined;}}
  function leadSafe(){try{return (typeof openLead!=='undefined')?openLead:'';}catch(_){return '';}}
  function buildPath(){var c=curSafe();if(typeof c==='undefined')return null;var p='/'+c;try{if(typeof openLead!=='undefined'&&openLead)p+='/lead/'+openLead;else if(typeof openOffer!=='undefined'&&openOffer)p+='/offer/'+openOffer;else if(typeof openInvoice!=='undefined'&&openInvoice)p+='/invoice/'+openInvoice;}catch(_){}return p;}
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
  function applyRoute(r){if(!r)return false;if(VALID.indexOf(r.sec)<0&&!r.dk)return false;try{if(r.dk==='lead'&&r.dv){current='leads';openLead=r.dv;}else if(r.dk==='offer'&&r.dv){current='offers';openOffer=r.dv;}else if(r.dk==='invoice'&&r.dv){current='invoices';openInvoice=r.dv;}else{if(VALID.indexOf(r.sec)>=0)current=r.sec;try{openLead='';}catch(_){}}}catch(_){return false;}return true;}
  function restoreBoot(){var r=parse(boot);if(applyRoute(r)){try{if(typeof render==='function')render();}catch(_){}}ready=true;lastPath=buildPath();try{if(lastPath)history.replaceState({p:lastPath,f:snapFilters()},'',lastPath);}catch(_){}}
  // wrap render AND the filter re-draws (renderLeads/drawLeads) so a filter change records history too
  function wrapFn(name){try{var f=window[name];if(typeof f==='function'&&!f.__pathWrap){var _f=f;window[name]=function(){var o=_f.apply(this,arguments);writeURL();return o;};window[name].__pathWrap=true;}}catch(_){}}
  function wrap(){wrapFn('render');wrapFn('renderLeads');wrapFn('drawLeads');}
  var tries=0;var iv=setInterval(function(){tries++;var ok=false;try{ok=(typeof render==='function'&&typeof DB!=='undefined');}catch(_){ok=false;}if(ok){wrap();clearInterval(iv);restoreBoot();}else if(tries>75){clearInterval(iv);wrap();restoreBoot();}},200);
  window.addEventListener('popstate',function(e){if(!ready)return;var r=parse(location.pathname);if(!r)return;
    var st=(e&&e.state)||history.state||{};
    var secChanged=r.sec!==curSafe()||(r.dk==='lead'&&r.dv!==leadSafe())||(!r.dk&&leadSafe());
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
