/* v76 — the access model the owner set on 2026-08-13.

   SUPER ADMIN  everything, everywhere, including giving admin access.
   MANAGER      the employee pages PLUS proposals, events, airlines, settings and the logs.
                Can add and remove people and set their role — but "Admin" is greyed out for
                him: a manager may only grant his own level or lower, and may never touch an
                admin account.
   EMPLOYEE     leads, clients and finance (plus Today) — and may EDIT all three.

   This layer is the screen half of that. The database enforces the same rules on its own
   (see docs/ROLES_AND_ACCESS.md), so nothing here can be bypassed by clicking cleverly.   */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }

  var PAGES_MANAGER  = ['today','leads','clients','finance','offers','events','airlines','settings','activity','archive'];
  var PAGES_EMPLOYEE = ['today','leads','clients','finance'];

  function role(){ try{ return window.__userRole || (window.__userTier==='admin'?'admin':window.__userTier==='manager'?'manager':null); }catch(_){ return null; } }
  function allowedPages(){
    var r=role();
    if(!r) return null;                    // role not known yet — never lock anyone out
    if(r==='admin') return null;           // everything
    if(r==='manager') return PAGES_MANAGER;
    return PAGES_EMPLOYEE;
  }
  function mayOpen(view){
    var a=allowedPages(); if(!a) return true;
    return a.indexOf(view)>=0;
  }
  try{ window.mayOpenPage=mayOpen; window.myAllowedPages=allowedPages; }catch(_){}

  /* Work out which page each sidebar button opens, by its own wording.

     Position is not usable here. The sidebar is built three times over: the core builds
     it from VIEWS, the v25 layer then throws that away and rebuilds it in groups
     (Primary / Reference / From Direct), and later layers append their own buttons
     (Finance, Brand) afterwards. Counting positions is what hid Finance from an employee
     and showed them Projects instead. The wording, on the other hand, is written from the
     same VIEWS list every time — in English and in Arabic — so it always matches. */
  function labelMap(){
    var m={};
    try{
      var VW=(typeof VIEWS!=='undefined')?VIEWS:[];
      VW.forEach(function(v){
        [v.label, (typeof T==='function'?T(v.label):null), (typeof T==='function'?T(v.id):null)]
          .forEach(function(s){ if(s && typeof s==='string'){ s=s.trim(); if(s && !m[s]) m[s]=v.id; } });
      });
    }catch(_){}
    return m;
  }
  function tagNav(){
    try{
      var nav=document.getElementById('nav'); if(!nav) return;
      var m=labelMap();
      nav.querySelectorAll('button').forEach(function(b){
        try{
          if(b.className && /v25-more-tog|v19-more-toggle/.test(b.className)) return;  /* group headers */
          if(b.id==='v44FinBtn'){ b.setAttribute('data-view','finance'); return; }
          var sp=b.querySelector('span');
          var t=((sp?sp.textContent:b.textContent)||'').trim();
          b.setAttribute('data-view', m[t] || ('?'+t));
        }catch(_){}
      });
    }catch(_){}
  }

  /* the pages a person may not open are taken out of the sidebar entirely */
  function hideNav(){
    try{
      var a=allowedPages(); if(!a) return;
      var nav=document.getElementById('nav'); if(!nav) return;
      tagNav();
      nav.querySelectorAll('button[data-view]').forEach(function(b){
        var id=b.getAttribute('data-view');
        /* anything we could not name is not on the list either — the list is a whitelist */
        b.style.display = (a.indexOf(id)>=0) ? '' : 'none';
      });
      /* group headers with nothing left under them */
      nav.querySelectorAll('.v25-more-tog').forEach(function(tg){
        try{
          var w=tg.nextElementSibling; if(!w) return;
          var live=[].slice.call(w.querySelectorAll('button')).filter(function(b){return b.style.display!=='none';});
          var show=live.length>0;
          tg.style.display=show?'':'none';
          if(!show) w.style.display='none';
        }catch(_){}
      });
    }catch(_){}
  }

  /* and if someone lands on one anyway, they are sent back with a plain explanation */
  var lastTold=0;
  function gate(){
    try{
      if(typeof current==='undefined') return;
      if(mayOpen(current)) return;
      var was=current;
      current='today';
      try{ if(typeof render==='function') render(); }catch(_){}
      var now=Date.now();
      if(now-lastTold<4000) return;           // don't stack messages
      lastTold=now;
      var r=role();
      var msg=(r==='manager')
        ? fl('That page is kept to admin accounts.','تلك الصفحة مقتصرة على حسابات المسؤولين.')
        : fl('Your account covers Leads, Clients and Finance. That page is not part of it.','حسابك يشمل العملاء المحتملين والعملاء والمالية. تلك الصفحة ليست ضمنه.');
      if(window.__v70box) window.__v70box(fl('Not part of your access','خارج نطاق صلاحيتك'), msg, fl('Ask an admin if you need it.','اطلب من المسؤول إن احتجتها.'));
      else if(typeof toast==='function') toast(msg);
    }catch(_){}
  }

  /* employees edit finance too, under this model — but a read-only account never does */
  try{
    if(typeof window.canFinEdit==='function' && !window.canFinEdit.__v76){
      var w=function(){ var r=role(); if(!r) return true; return r==='admin'||r==='manager'||r==='team_member'; };
      w.__v76=1; window.canFinEdit=w;
    }
  }catch(_){}

  /* the Team screen belongs to admins AND managers */
  function teamEntry(){
    try{
      var r=role(); if(r!=='manager') return;      // admins already get it from the core
      var tools=document.querySelector('.tools'); if(!tools) return;
      if(document.getElementById('cl_team')||document.getElementById('v76team')) return;
      var b=document.createElement('button'); b.id='v76team'; b.className='btn sm ghost';
      b.style.cssText='font-weight:700'; b.textContent=fl('Team','الفريق');
      b.onclick=function(){ try{ if(typeof v48Users==='function') v48Users(); else if(typeof openTeam==='function') openTeam(); }catch(_){} };
      tools.appendChild(b);
    }catch(_){}
  }

  /* a manager may not hand out admin access: the option is removed from every role picker */
  /* There are only three levels in this company, so the picker offers only three —
     and a manager never sees "Admin" among them. */
  var LEVELS={
    admin:      ['Admin — full control','مسؤول — تحكم كامل'],
    manager:    ['Manager — runs the team','مدير — يدير الفريق'],
    team_member:['Employee — leads, clients, finance','موظف — العملاء المحتملون والعملاء والمالية']
  };
  function trimRolePickers(){
    try{
      var r=role(); if(!r) return;
      var keep=(r==='admin')?['admin','manager','team_member']:['manager','team_member'];
      document.querySelectorAll('select[data-role], #tm_role, select.v48-role').forEach(function(sel){
        try{
          [].slice.call(sel.options).forEach(function(o){
            var v=o.value;
            if(keep.indexOf(v)<0){ o.disabled=true; o.hidden=true; if(o.selected&&v!=='admin')o.selected=false; }
            else if(LEVELS[v]){ var lbl=fl(LEVELS[v][0],LEVELS[v][1]); if(o.textContent!==lbl)o.textContent=lbl; o.disabled=false; o.hidden=false; }
          });
          sel.setAttribute('data-v76done','1');
          if(!sel.__v76){ sel.__v76=1; sel.title=(r==='manager')
            ? fl('A manager can set Manager or Employee. Admin is given by an admin.','المدير يمنح صلاحية مدير أو موظف. صلاحية المسؤول يمنحها المسؤول فقط.')
            : fl('Admin, Manager or Employee.','مسؤول أو مدير أو موظف.'); }
        }catch(_){}
      });
    }catch(_){}
  }

  /* the Team screen is built when it opens, so trim the moment it appears — not on a timer */
  function watchTeamScreen(){
    try{
      /* the wrapping is retried on every pass: some of these are defined by later layers */
      ['v48Users','openTeam','v41Access'].forEach(function(fn){
        try{
          var orig=window[fn]; if(typeof orig!=='function'||orig.__v76)return;
          var w=function(){ var r=orig.apply(this,arguments); [120,400,900,1800,2600,3500].forEach(function(d){setTimeout(trimRolePickers,d);}); return r; };
          w.__v76=1; window[fn]=w;
        }catch(_){}
      });
      if(window.MutationObserver && !window.__v76obs){
        window.__v76obs=1;
        /* the team list arrives over the network, so the pickers can appear at any moment.
           Watching for "a picker we have not trimmed yet" catches every case — including
           the row being the added element itself, which the old check missed. */
        new MutationObserver(function(){
          try{ if(document.querySelector('select[data-role]:not([data-v76done])')) trimRolePickers(); }catch(_){}
        }).observe(document.body,{childList:true,subtree:true});
      }
    }catch(_){}
  }

  function pass(){ tagNav(); hideNav(); gate(); teamEntry(); trimRolePickers(); watchTeamScreen(); }
  try{
    var _r=window.render;
    window.render=function(){ var o=_r.apply(this,arguments); try{ pass(); }catch(_){} return o; };
  }catch(_){}
  [600,1800,4000,8000].forEach(function(d){ setTimeout(pass,d); });
  setInterval(pass, 3000);

  console.info('%c[v76] access model (admin / manager / employee) loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v76] init',e);}})();
