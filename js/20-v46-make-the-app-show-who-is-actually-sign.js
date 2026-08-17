/* ===== v46: make the app show who is actually signed in, and clear orphaned hover cards =====
   1. The sidebar footer was static HTML reading "Abdelrahman / Business Development" for
      everyone. It now shows the signed-in person's name and their real role.
   2. Lead rows open a hover card on mouseenter and close it on mouseleave. When the row is
      removed - changing page, re-rendering - mouseleave never fires, so the card was left
      floating over the content on Leads, Clients and Finance and never went away.          */
(function(){try{
  var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
  var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
  var ROLE_EN={admin:'Admin',manager:'Manager',bd:'Business Development',operations:'Operations',team_member:'Team member',viewer:'Read only'};
  var ROLE_AR={admin:'مدير النظام',manager:'مدير',bd:'تطوير الأعمال',operations:'العمليات',team_member:'عضو الفريق',viewer:'قراءة فقط'};
  var who={name:null,role:null};

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function client(){ try{ return (window.supabase&&window.supabase.createClient)?window.supabase.createClient(SUPA_URL,SUPA_KEY):null; }catch(_){ return null; } }

  function paintFooter(){
    var foot=document.querySelector('.side .foot')||document.querySelector('.foot');
    if(!foot) return;
    var nm=who.name||window.__userName||null;
    if(!nm) return;
    var strong=foot.querySelector('b');
    var small=foot.querySelector('span');
    var av=foot.querySelector('.av');
    if(strong && strong.textContent!==nm) strong.textContent=nm;
    if(av){ var initial=(nm.trim()[0]||'?').toUpperCase(); if(av.textContent!==initial) av.textContent=initial; }
    if(small){
      /* Fall back to the role the app already knows. When this layer's own lookup had not
         landed, the label was left as the placeholder text baked into the page — which is how
         a manager's sidebar came to describe him as "Business Development" while the top bar
         correctly said Manager. Better to use the role the rest of the app is already using
         than to leave a stale label standing. */
      var r = who.role || window.__userRole || null;
      var lbl = r ? ((isAr()?ROLE_AR:ROLE_EN)[r]||r) : '';
      if(lbl && small.textContent!==lbl) small.textContent=lbl;
    }
  }

  function fetchWho(){
    var c=client(); if(!c) return;
    c.auth.getSession().then(function(s){
      var u=s&&s.data&&s.data.session&&s.data.session.user; if(!u) return;
      c.from('app_users').select('full_name,role').eq('id',u.id).maybeSingle().then(function(r){
        var d=r&&r.data; if(!d) return;
        who.name=(d.full_name||'').trim()||(u.email||'').split('@')[0];
        who.role=d.role||null;
        if(who.name) window.__userName=who.name;
        paintFooter();
        try{ if(typeof render==='function') render(); }catch(_){}
      });
    }).catch(function(){});
  }

  /* an orphaned hover card belongs to no row any more - drop it */
  function clearStalePops(){
    try{
      var pops=document.querySelectorAll('.v46-leadpop');
      if(!pops.length) return;
      var onLeadPage=false;
      try{ onLeadPage=(current==='leads'||current==='clients'); }catch(_){}
      for(var i=0;i<pops.length;i++){
        var keep = onLeadPage && pops[i].matches(':hover');
        if(!keep && pops[i].parentNode) pops[i].parentNode.removeChild(pops[i]);
      }
    }catch(_){}
  }

  try{
    var _r=window.render;
    if(typeof _r==='function'){
      window.render=function(){
        clearStalePops();
        var o=_r.apply(this,arguments);
        try{ paintFooter(); }catch(e){}
        return o;
      };
    }
  }catch(e){ console.warn('v46 render hook',e); }

  document.addEventListener('click',function(ev){
    try{ if(!ev.target.closest || !ev.target.closest('tr')) clearStalePops(); }catch(_){ clearStalePops(); }
  },true);
  window.addEventListener('scroll',clearStalePops,true);
  setInterval(clearStalePops,3000);

  var n=0;
  var t=setInterval(function(){ n++; paintFooter(); if(who.name||n>60) clearInterval(t); },400);
  fetchWho(); setTimeout(fetchWho,3000); setTimeout(fetchWho,8000);
  try{ document.addEventListener('visibilitychange',function(){ if(!document.hidden) fetchWho(); }); }catch(_){}

  console.info('%c[v46] real signed-in identity + hover-card cleanup','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v46 layer failed',e);}})();
