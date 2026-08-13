/* v61 — every road to Won ends at the "complete the client" step (2026-08-12).
   The v40 handover modal only fired through convertToClient(); the stage dropdown
   (setLeadStage) and the quick-edit set isClient directly and skipped it. */
(function(){try{
  if(typeof setLeadStage==='function'&&!window.__v61won){
    var _s=window.setLeadStage;
    window.setLeadStage=function(id,s){
      var b=(typeof getLead==='function')?getLead(id):null;
      var was=!!(b&&b.isClient);
      var out=_s.apply(this,arguments);
      try{ if(s==='Won'&&b&&!was&&typeof window.__clientHandover==='function')setTimeout(function(){window.__clientHandover(id);},250); }catch(_){}
      return out;
    };
    window.__v61won=true;
    console.info('%c[v61] Won → complete-the-client hook loaded','color:#0F6E56;font-weight:700');
  }
}catch(e){if(window.console)console.warn('[v61] init',e);}})();
