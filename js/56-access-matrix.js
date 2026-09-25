/* ===== Who can open what, page by page, person by person (chapter, 2026-08-17; four levels 2026-09-25) =====

   The owner's spec (D2, docs/DECISIONS.md, 2026-09-25): access is a LEVEL per person per page —

     No access    — the page does not appear.
     View         — sees everything on the page, changes nothing.
     Own work     — full control over their own work on that page only.
     Full control — may change everyone's work on that page.

   Admins are outside the grid: everything, everywhere, because there has to be somebody who can
   repair a grid somebody else got wrong. The role (admin / manager / employee) only sets a new
   person's starting grid; after that an admin — or the manager, for the people under them — sets
   each page. The grid was seeded from what everybody could already do (editor → Full control), so
   switching to four levels changed nobody's working day.

   The answer comes from the DATABASE: page_level() (scripts/sql/phase1a-access-levels.sql) is the
   one check every row rule asks, my_page_levels() hands this screen the same answers, and
   set_page_levels() is the one way to change a grid — it refuses what the screen would never offer
   (a manager raising someone above their own level, anyone changing their own access, an unknown
   page or level word) and writes every change to the history log. This layer keeps no rule of its
   own about who may do what; it draws what the database said.

   "Own work" is shown but cannot be chosen yet: no page knows yet which of its records are whose.
   Each page learns it in Phase 1b, and the option opens for that page the same day (M55 — never
   offer a choice the save cannot keep).                                                           */
(function(){try{
  /* the one list of pages the grid covers — the same twenty, in the same words, as access_pages()
     in the database. Exported as window.PAGES for the layers that name a page in words (js/31, js/63). */
  var PAGES=[
    ['today','Today','اليوم'],['leads','Leads','العملاء المحتملون'],['clients','Clients','العملاء'],
    ['offers','Proposals','العروض'],['documents','Generator','المولّد'],['ops','Operations','العمليات'],['reports','Reports','التقارير'],
    ['finance','Finance','المالية'],['settings','Settings','الإعدادات'],['events','Events','الفعاليات'],
    ['airlines','Airlines','شركات الطيران'],['vendors','Suppliers','المورّدون'],['sopsla','SOP & SLA','الإجراءات'],
    ['activity','Activity & Audit','السجل'],['archive','Archive','الأرشيف'],
    ['projects','Projects','المشاريع'],['bookings','Bookings','الحجوزات'],['invoices','Invoices','الفواتير'],
    ['tickets','Tickets','التذاكر'],['sync','Sync & Integrations','المزامنة والتكاملات']
  ];
  try{ window.PAGES=PAGES; window.ACCESS_PAGES=PAGES; }catch(_){}
  var LEVELS=[['none','No access','لا وصول'],['view','View','مشاهدة'],['own','Own work','عمله فقط'],['full','Full control','تحكم كامل']];
  var RANK={none:0,view:1,own:2,full:3};
  /* pages whose own records know their owner, so "Own work" can be chosen there. Empty until Phase 1b
     teaches a page; adding a page here is part of that page's change, never ahead of it. */
  var OWN_READY=[];
  /* the pages whose CHANGES the database enforces by level. Since Phase 1b (2026-09-25) that is every
     page that stores anything: each table, file store and workspace section answers to its page's
     level (scripts/sql/phase1b-*). Today stores nothing of its own; Reports lives in each browser
     (M32); Tickets has no store of its own. */
  var HARD=['leads','clients','offers','documents','ops','finance','settings','events','airlines','vendors','sopsla',
            'activity','archive','projects','bookings','invoices','sync'];
  /* 2026-09-21 (fire #189) — and the pages whose SCREENS hold a View setting. The list lives in js/52
     beside mayEditPage, which is the thing that decides; read it, never copy it. If js/52 has not
     loaded, say nothing rather than guess. */
  function viewerHolds(pageId){
    try{
      var l=window.PAGES_VIEWER_ENFORCED;
      if(!l||!l.length) return true;          /* unknown — do not warn on a guess */
      return l.indexOf(pageId)>=0;
    }catch(_){ return true; }
  }

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){var c=fc(); if(c) return c;} }catch(_){}
                     /* Only ever use a client that already exists. Calling supabase's createClient
     with no arguments looks harmless — the v44a memoiser is meant to hand back the shared client —
     but if it happens to be the FIRST call on the page it builds a client with no project URL and
     no key, and memoises that broken thing for everything that follows: sign-in, Finance, the
     roster. So: wait for the real client rather than risk creating a hollow one. */
                     return null; }
  function myRole(){ try{ return window.__userRole||null; }catch(_){ return null; } }
  function amAdmin(){ return myRole()==='admin'; }
  function canManage(){ var r=myRole(); return r==='admin'||r==='manager'; }
  function myEmail(){ try{ return String(window.__userEmail||'').toLowerCase(); }catch(_){ return ''; } }
  function levelName(l){ var t=LEVELS.filter(function(x){return x[0]===l;})[0]; return t?fl(t[1],t[2]):String(l||''); }
  function pageName(p){ var t=PAGES.filter(function(x){return x[0]===p;})[0]; return t?fl(t[1],t[2]):String(p||''); }

  /* the older grid words, for the layers that still read __pageAccess ('editor' / 'viewer') */
  function legacyMap(L){
    var m={}; if(!L) return m;
    Object.keys(L).forEach(function(p){ var l=L[p]; if(l==='full') m[p]='editor'; else if(l==='view') m[p]='viewer'; else if(l==='own') m[p]='own'; });
    return m;
  }
  /* a person drawn from the older words (the probe seam hands one in) — read as the database does */
  function levelsOf(u){
    if(u && u.levels && typeof u.levels==='object') return u.levels;
    var pa=(u&&u.page_access)||{}, out={};
    var W={full:'full',editor:'full',own:'own',view:'view',viewer:'view'};
    PAGES.forEach(function(p){ var l=W[pa[p[0]]]||'none'; if(p[0]==='today'&&l==='none') l='view'; out[p[0]]=l; });
    return out;
  }

  /* ---------- my own levels, loaded once and kept on window for the access-model layer ---------- */
  /* 2026-09-09 (live drive against the real database, signing in at typing speed): this used to
     fire before anyone had finished typing a password. Each call went out anonymous, the database
     refused it, the error was swallowed, and nothing ever asked again — so the per-person grid never
     arrived on a normal sign-in. Now: wait until js/02 has confirmed who this is (__roleKnown), then
     ask — and if the answer is an error, ask again a few times rather than giving up on the first
     hiccup.
     2026-09-25 (Phase 1a): asks my_page_levels() — every page in the four words, admins included
     (all full). __pageAccess is still filled, in the older words, for the layers that read it. */
  var mineTries=0;
  function loadMine(){
    if(window.__pageAccessLoaded===true) return;
    if(window.__roleKnown!==true){ if(mineTries++<240) setTimeout(loadMine,500); return; }   /* up to two minutes at the sign-in form */
    var c=client(); if(!c||!c.rpc){ if(mineTries++<240) setTimeout(loadMine,500); return; }
    c.rpc('my_page_levels').then(function(r){
      if(!r||r.error||!r.data||typeof r.data!=='object'){ if(mineTries++<240) setTimeout(loadMine,3000); return; }
      window.__pageLevels = r.data;
      window.__pageAccess = amAdmin() ? null : legacyMap(r.data);   // null for admins = no grid applies
      window.__pageAccessLoaded = true;
      try{ if(typeof render==='function') render(); }catch(_){}
    }).catch(function(){ if(mineTries++<240) setTimeout(loadMine,3000); });
  }
  setTimeout(loadMine, 800);
  /* the same account can sign out and another sign in without a reload — js/02 flips __roleKnown
     false and true again; when it does, the levels are the new person's to fetch */
  try{
    var lastKnown=null;
    setInterval(function(){
      var k=(window.__roleKnown===true);
      if(k!==lastKnown){ if(k && lastKnown===false){ window.__pageAccessLoaded=false; window.__pageAccess=null; window.__pageLevels=null; mineTries=0; loadMine(); } lastKnown=k; }
    },1000);
  }catch(_){}

  /* ---------- the editor, for admins and the manager, inside Settings ---------- */
  var ROWS=null;
  try{ window.__axCardProbe=card; }catch(_){}

  window.axLoad=function(cb){
    var c=client(); if(!c) return;
    c.rpc('team_access_list').then(function(r){
      ROWS=(r&&!r.error&&Array.isArray(r.data))?r.data:[];
      if(cb)cb(); else try{ if(typeof render==='function') render(); }catch(_){}
    });
  };

  window.axSet=function(id,page,val){
    try{
      var u=(ROWS||[]).find(function(x){return x.id===id;}); if(!u)return;
      u.levels=levelsOf(u); u.levels[page]=val; u.__dirty=true;
      paint();
    }catch(e){console.warn('[matrix] set',e);}
  };

  window.axSave=function(id){
    try{
      var u=(ROWS||[]).find(function(x){return x.id===id;}); if(!u)return;
      var c=client(); if(!c)return;
      c.rpc('set_page_levels',{target:u.id, levels:levelsOf(u)}).then(function(r){
        if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
        /* a save that returns nothing did not happen — never say "saved" for it (M13) */
        if(!r.data||typeof r.data!=='object'){alert(fl('Nothing was saved — your account was not allowed to.','لم يُحفظ شيء — لا تملك الصلاحية.'));return;}
        if(typeof toast==='function')toast(fl('Access saved for '+(u.full_name||u.email||''),'تم حفظ الصلاحيات'));
        /* draw what the database now holds, not what was sent */
        axLoad();
      });
    }catch(e){console.warn('[matrix] save',e);}
  };

  /* Never let the last admin be demoted — somebody must always be able to undo a mistake here. */
  window.axSetRole=function(id,newRole){
    try{
      if(!amAdmin()) return;
      var u=(ROWS||[]).find(function(x){return x.id===id;}); if(!u)return;
      if(u.role==='admin' && newRole!=='admin'){
        var others=(ROWS||[]).filter(function(x){return x.role==='admin'&&x.active&&x.id!==id;}).length;
        if(others===0){
          alert(fl('This is the only admin left. Make somebody else an admin first, or nobody will be able to change access again.',
                   'هذا هو المسؤول الوحيد المتبقي. عيّن مسؤولًا آخر أولًا وإلا لن يتمكن أحد من تعديل الصلاحيات.'));
          paint(); return;
        }
      }
      var c=client(); if(!c)return;
      c.from('app_users').update({role:newRole}).eq('id',id).select().then(function(r){
        if(r.error){alert(r.error.message);return;}
        if(!r.data||!r.data.length){alert(fl('Nothing was saved — your account was not allowed to.','لم يُحفظ شيء — لا تملك الصلاحية.'));return;}
        try{ if(window.__note)__note('team',id,'role changed',newRole); }catch(_){}
        /* 2026-09-18 (live drive of this screen, fire #85): the level plays no part in which pages
           open — the per-page grid decides that — so demoting someone leaves their pages exactly as
           they were. An admin doing that to take Settings away would have believed they had. So the
           sentence names what the grid still holds. (Someone moving DOWN from admin has no grid;
           the database gives them their new role's starting grid, which the reload below shows.) */
        var kept=[]; try{ var L=levelsOf(u); PAGES.forEach(function(pp){ if(L[pp[0]]&&L[pp[0]]!=='none'&&pp[0]!=='today') kept.push(pp); }); }catch(_){}
        var wasAdmin=(u.role==='admin');
        u.role=newRole;
        if(kept.length && !wasAdmin){
          var hard=kept.filter(function(pp){ return HARD.indexOf(pp[0])>=0; }).map(function(pp){ return fl(pp[1],pp[2]); });
          /* Arabic counts 3–10 with the plural and 11+ with the singular; English just needs an s. */
          var nEn=kept.length+' '+(kept.length===1?'page':'pages');
          var nAr=kept.length+' '+(kept.length>=3&&kept.length<=10?'صفحات مُحدَّدة':'صفحة مُحدَّدة');
          u.__levelNote=fl('Level changed to '+roleName(newRole)+'. That does not close a page: this person still opens the '+nEn+' set below'+(hard.length?', including '+hard.join(' and '):'')+'. Change those if you meant to take access away.',
                           'تم تغيير المستوى إلى '+roleName(newRole)+'. هذا لا يُغلق أي صفحة: لا يزال يفتح '+nAr+' أدناه'+(hard.length?'، منها '+hard.join(' و'):'')+'. عدّل تلك الخيارات إذا كنت تقصد سحب الصلاحية.');
          if(typeof toast==='function')toast(fl('Level changed — the pages below are unchanged','تم تغيير المستوى — الصفحات أدناه لم تتغير'));
        } else {
          u.__levelNote='';
          if(typeof toast==='function')toast(fl('Role updated','تم تحديث الدور'));
        }
        /* someone moving DOWN from admin had no grid; the database has just given them their new
           role's starting one — fetch it rather than draw an empty card */
        if(wasAdmin){ var note=u.__levelNote; axLoad(function(){ var v=(ROWS||[]).find(function(x){return x.id===id;}); if(v) v.__levelNote=note; paint(); }); }
        else paint();
      });
    }catch(e){console.warn('[matrix] role',e);}
  };

  var TIER=[['admin','Admin','مسؤول النظام'],['manager','Manager','مدير'],['team_member','Employee','موظف']];
  /* 2026-09-02 (round 30): app_users.role is the six-label enum user_role — the database also
     understands bd / operations / viewer. A user on one of those matched NO option, and a <select>
     with nothing selected falls back to its first option — "Admin". A role this screen does not
     offer is shown by name and marked, rather than guessed. */
  var ROLE_NAME={bd:['Business development','تطوير الأعمال'],operations:['Operations','العمليات'],viewer:['Read only','قراءة فقط']};
  function roleName(r){ var t=TIER.filter(function(x){return x[0]===r;})[0]; if(t) return fl(t[1],t[2]);
                        var n=ROLE_NAME[r]; return n?fl(n[0],n[1]):String(r||''); }
  function tierOptions(u){
    var known=TIER.some(function(t){return u.role===t[0];});
    var h=TIER.map(function(t){return '<option value="'+t[0]+'"'+(u.role===t[0]?' selected':'')+'>'+fl(t[1],t[2])+'</option>';}).join('');
    if(!known){
      var nm=ROLE_NAME[u.role]||[u.role,u.role];
      h='<option value="'+esc(u.role||'')+'" selected>'+esc(fl(nm[0],nm[1]))+' — '+fl('not one of the three levels','ليس أحد المستويات الثلاثة')+'</option>'+h;
    }
    return h;
  }

  /* the options one page's select may offer, for the person looking at it */
  function levelOptions(page,cur){
    var mine=(typeof window.pageLevel==='function')?window.pageLevel(page):null;
    return LEVELS.map(function(l){
      var v=l[0], why='';
      if(v==='own' && OWN_READY.indexOf(page)<0) why=fl('This page does not know whose work is whose yet','هذه الصفحة لا تعرف بعد لمن كل عمل');
      else if(!amAdmin() && RANK[v]>RANK[cur] && RANK[v]>RANK[mine||'none']) why=fl('Above your own level on this page','أعلى من مستواك في هذه الصفحة');
      var dis=(why && v!==cur);
      return '<option value="'+v+'"'+(v===cur?' selected':'')+(dis?' disabled title="'+esc(why)+'"':'')+'>'+esc(fl(l[1],l[2]))+'</option>';
    }).join('');
  }

  /* Probe seam (fire #189), the same pattern as window.__poCalcProbe and window.__dgBrandProbe:
     card() is the real markup this editor renders, and a guard has to measure THAT, not a copy of
     it. Exported read-only; it renders a string and touches nothing. */
  function card(u){
    var isAdm=u.role==='admin';
    var self=!!(myEmail() && String(u.email||'').toLowerCase()===myEmail());
    var locked=self || (!amAdmin() && isAdm);
    var L=isAdm?null:levelsOf(u);
    var h='<div class="card ax-card" style="padding:14px 16px;margin-bottom:10px">'+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:'+(isAdm?'0':'10px')+'">'+
        '<b style="font-size:14px">'+esc(u.full_name||u.email)+'</b>'+
        '<span style="color:var(--muted);font-size:11.5px">'+esc(u.email)+'</span>'+
        (amAdmin()
          ? '<select class="inp sm" style="max-width:150px" onchange="axSetRole(\''+u.id+'\',this.value)">'+tierOptions(u)+'</select>'
          : '<span class="tag">'+esc(roleName(u.role))+'</span>')+
        (isAdm?('<span style="color:#0F6E56;font-size:12px;font-weight:700">'+fl('Full access to everything','صلاحية كاملة لكل شيء')+'</span>'):'')+
      '</div>';
    if(isAdm) return h+'</div>';
    /* 2026-09-18: the two halves of this card do different jobs and the screen never said so — the
       level is what decides who they may manage; the pages below decide what they may open and
       change. Changing one does not move the other (see axSetRole). */
    h+='<div style="font-size:11.5px;color:var(--muted);margin:-4px 0 8px">'+fl(
        'The level decides who they may manage. The pages below decide what they can open and change — changing the level does not close a page.',
        'المستوى يحدّد مَن يديره. الصفحات أدناه تحدّد ما يفتحه ويعدّله — تغيير المستوى لا يُغلق أي صفحة.')+'</div>';
    if(u.__levelNote) h+='<div class="ax-levelnote" style="font-size:12px;border:1px solid #FBAE16;background:#FFF8E8;color:#6B4E00;border-radius:8px;padding:8px 10px;margin-bottom:9px">'+esc(u.__levelNote)+'</div>';
    if(self) h+='<div data-ax-self="1" style="font-size:12px;color:var(--muted);margin-bottom:8px">'+fl('This is you — nobody changes their own access; ask an admin.','هذا أنت — لا أحد يغيّر صلاحياته بنفسه؛ اطلب من المسؤول.')+'</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px">';
    PAGES.forEach(function(p){
      var cur=L[p[0]]||'none';
      h+='<div style="display:flex;gap:6px;align-items:center;font-size:12.5px">'+
         '<span style="flex:1">'+esc(fl(p[1],p[2]))+(HARD.indexOf(p[0])>=0?' <span title="'+fl('Also enforced by the database','مطبّقة في قاعدة البيانات أيضًا')+'" style="color:#0F6E56">•</span>':'')+'</span>'+
         (locked
           ? '<span class="tag" data-ax-level="'+esc(p[0])+'">'+esc(levelName(cur))+'</span>'
           : '<select class="inp sm" data-ax-page="'+esc(p[0])+'" style="max-width:120px;font-size:12px" onchange="axSet(\''+u.id+'\',\''+p[0]+'\',this.value)">'+levelOptions(p[0],cur)+'</select>')+
         /* fire #189: in WORDS, on the row, and only where it is true and being relied on */
         ((cur==='view'&&!viewerHolds(p[0]))
           ? '<span data-ax-notheld="'+esc(p[0])+'" title="'+fl('This page still shows its editing buttons to someone on View; the database refuses the change','هذه الصفحة ما زالت تُظهر أزرار التعديل لصاحب صلاحية المشاهدة؛ وقاعدة البيانات ترفض التغيير')+'" style="flex:0 0 auto;background:#FFF8E8;color:#6B4E00;border:1px solid #FBAE16;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap">'+fl('buttons still show','الأزرار ما زالت ظاهرة')+'</span>'
           : '')+
         '</div>';
    });
    h+='</div>';
    /* fire #189: name the total once, so the marks above are not read as isolated oddities */
    try{
      var nh=PAGES.filter(function(pp){ return (L[pp[0]]||'none')==='view' && !viewerHolds(pp[0]); });
      if(nh.length){
        h+='<div data-ax-notheld-note="1" style="font-size:11.5px;border:1px solid #F2C4C4;background:#FDECEC;color:#7a2028;border-radius:8px;padding:8px 10px;margin-top:9px;line-height:1.6">'+
          esc(fl(nh.length+' of the pages set to View still show their editing buttons to this person: '+
                   nh.map(function(pp){ return fl(pp[1],pp[2]); }).join(', ')+'. The database refuses any change they try there, but the page does not say so until they try. The buttons will be withdrawn as each page is taught.',
                 'عدد '+nh.length+' من الصفحات المحددة كـ«مشاهدة» ما زالت تُظهر أزرار التعديل لهذا الشخص: '+
                   nh.map(function(pp){ return fl(pp[1],pp[2]); }).join('، ')+'. قاعدة البيانات ترفض أي تغيير يحاوله هناك، لكن الصفحة لا تقول ذلك إلا عند المحاولة. ستُسحب الأزرار مع تعليم كل صفحة.'))+'</div>';
      }
    }catch(_){}
    if(!locked) h+='<button class="btn pri sm" style="margin-top:10px" onclick="axSave(\''+u.id+'\')">'+fl('Save access','حفظ الصلاحيات')+'</button>';
    return h+'</div>';
  }

  function paint(){
    try{
      if(!canManage()) return;
      /* Only on the Settings page (where "Team & Access" lives) — was a text-content guess until
         2026-08-20, which leaked this panel, and its live Save buttons, onto pages whose own copy
         happened to contain the word "team". `current` is the page identity every view checks. */
      if(typeof current==='undefined'||current!=='settings') return;
      var view=document.getElementById('view'); if(!view) return;
      var host=document.getElementById('axHost');
      if(!host){
        host=document.createElement('div'); host.id='axHost'; host.style.cssText='margin-top:16px';
        view.appendChild(host);
      }
      if(ROWS==null){ host.innerHTML='<div class="card" style="padding:22px;text-align:center;color:var(--muted)">'+fl('Loading access…','جارٍ التحميل…')+'</div>'; axLoad(); return; }
      host.innerHTML='<h3 class="finh" style="margin:0 0 3px">'+fl('Who can open what','من يفتح ماذا')+'</h3>'+
        '<div class="ch-sub" style="margin-bottom:6px">'+fl(
          'Four levels per person, page by page: No access · View (sees everything, changes nothing) · Own work (changes only their own) · Full control (changes everyone\'s). Admins are not listed with pages — they always have everything. A green dot means the database enforces that page too.',
          'أربعة مستويات لكل شخص، صفحة بصفحة: لا وصول · مشاهدة (يرى كل شيء ولا يغيّر شيئًا) · عمله فقط (يغيّر عمله فقط) · تحكم كامل (يغيّر عمل الجميع). المسؤولون لديهم كل شيء دائمًا. النقطة الخضراء تعني أن قاعدة البيانات تطبّق ذلك أيضًا.')+'</div>'+
        '<div data-ax-own-note="1" style="font-size:11.5px;color:var(--muted);margin-bottom:10px">'+fl(
          '"Own work" cannot be chosen yet. The database already holds it for Leads and Clients (each company has an owner account); it opens there once those pages stop offering changes on other people\'s companies, and on other pages as they learn whose records are whose.',
          '«عمله فقط» غير متاح بعد. قاعدة البيانات تطبّقه الآن على العملاء المحتملين والعملاء (لكل شركة حساب مالك)؛ ويُتاح هناك عندما تتوقف الصفحتان عن عرض التعديل على شركات الآخرين، وفي بقية الصفحات عندما تعرف لمن كل سجل.')+'</div>'+
        (ROWS||[]).map(card).join('');
    }catch(e){console.warn('[matrix] paint',e);}
  }

  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(paint,60); }catch(_){} return o; };
    },200);
  }catch(_){}

  console.info('%c[matrix] per-page access (four levels) loaded','color:#175CD3;font-weight:700');
}catch(e){if(window.console)console.warn('[matrix] init',e);}})();
