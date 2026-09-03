/* v73 — "You can’t change this" guard (owner order 2026-08-13: roles must actually hold).
   The database has always enforced the real rules. The SCREEN did not: an Operations person
   or a read-only person was still shown Edit buttons, could type a change, saw it appear —
   and the database quietly refused it. The only hint was a small red pill in the corner.
   This layer makes the screen tell the truth:
     1. it knows what each role may change (same table as the database policies);
     2. it takes away the controls a person may not use, and explains why in one sentence;
     3. if a save is ever refused anyway, it says so clearly and reloads the real data, so the
        screen NEVER shows a change that was not stored.
   Nothing here grants permission — the database remains the wall. Additive and reversible. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}

  /* what each role may WRITE — mirrors the database policies exactly */
  var CAN={
    admin:      {leads:1,proposals:1,requests:1,activities:1,finance:1,promo:1},
    manager:    {leads:1,proposals:1,requests:1,activities:1,finance:1,promo:1},
    bd:         {leads:1,proposals:1,requests:1,activities:1,finance:1,promo:1},
    operations: {leads:1,proposals:1,requests:1,activities:1,finance:1,promo:0},
    team_member:{leads:1,proposals:1,requests:1,activities:1,finance:1,promo:0},
    viewer:     {leads:0,proposals:0,requests:0,activities:0,finance:0,promo:0}
  };
  var ROLE_EN={admin:'Admin',manager:'Manager',bd:'Business development',operations:'Operations',team_member:'Team member',viewer:'Read only'};
  var ROLE_AR={admin:'مدير النظام',manager:'مدير',bd:'تطوير الأعمال',operations:'العمليات',team_member:'عضو الفريق',viewer:'قراءة فقط'};
  /* what each role CAN still do — so the message is never a dead end */
  var INSTEAD={
    operations:['You can create and work requests, and log activity on any company.','يمكنك إنشاء الطلبات ومتابعتها، وتسجيل النشاط على أي شركة.'],
    viewer:    ['Your account is read-only: you can open and read everything, and export reports.','حسابك للقراءة فقط: يمكنك فتح كل شيء وقراءته وتصدير التقارير.'],
    bd:        ['Finance is kept to managers. Everything about leads, clients and proposals is yours.','المالية للمدراء. كل ما يخص العملاء المحتملين والعملاء والعروض متاح لك.'],
    team_member:['Your account covers leads, clients and finance.','حسابك يشمل العملاء المحتملين والعملاء والمالية.']
  };

  function role(){ try{ return window.__userRole || (window.__userTier==='admin'?'admin':window.__userTier==='manager'?'manager':window.__userTier==='viewer'?'viewer':null); }catch(_){ return null; } }
  function can(what){
    /* A view-only SHARE LINK has no role at all, and "no role yet" used to mean "allow" here
       (the line below, which exists so a real user is never blocked while their role loads).
       Consequence found 2026-09-02 driving a share link anonymously: every guarded action was
       still open to the holder — Edit on a lead or a client opened the full Quick-edit modal,
       which also lists every team member by name. The database refused the save, so nothing
       was ever written, but the banner promises "nothing can be changed" while the screen
       offered the change. A share view is a KNOWN state, not an unknown one, so it is decided
       first and answers no to everything. */
    try{ if(window.__isShareView) return false; }catch(_){}
    var r=role(); if(!r) return true;              // role not known yet — never block a real user by accident
    var row=CAN[r]; if(!row) return true;
    return !!row[what];
  }
  try{ window.canDo=can; }catch(_){}

  /* ---- one clear sentence, never a dead end ---------------------------------------- */
  var shown=0;
  function refuse(what){
    /* the share-link holder is not a person with a level — say the true reason instead */
    try{ if(window.__isShareView){
      box(fl('This is a view-only link','هذا رابط للعرض فقط'),
          fl('You are looking at a shared, read-only copy. Nothing on this screen can be changed.',
             'أنت تشاهد نسخة مشتركة للعرض فقط. لا يمكن تغيير أي شيء في هذه الشاشة.'),
          fl('Sign in to the workspace if you need to edit.','سجّل الدخول إلى مساحة العمل إذا احتجت التعديل.'));
      return;
    } }catch(_){}
    var r=role()||'', lbl=fl(ROLE_EN[r]||r,ROLE_AR[r]||r);
    var whatEn={leads:'companies (leads and clients)',proposals:'proposals',requests:'requests',activities:'activity',finance:'finance',promo:'promo codes'}[what]||what;
    var whatAr={leads:'الشركات (العملاء المحتملون والعملاء)',proposals:'العروض',requests:'الطلبات',activities:'النشاط',finance:'المالية',promo:'أكواد الخصم'}[what]||what;
    var extra=INSTEAD[r]?fl(INSTEAD[r][0],INSTEAD[r][1]):'';
    box(fl('You can’t change '+whatEn,'لا يمكنك تعديل '+whatAr),
        fl('Your access level is “'+lbl+'”. '+extra,'مستوى صلاحيتك «'+lbl+'». '+extra),
        fl('Ask an admin if you need this changed.','اطلب من المسؤول تغيير صلاحيتك إذا احتجت ذلك.'));
  }
  try{ window.__v70box=function(a,b,c){ box(a,b,c); }; }catch(_){}
  function box(title,line1,line2,danger){
    try{
      var old=document.getElementById('v70box'); if(old)old.remove();
      var ov=document.createElement('div'); ov.id='v70box';
      ov.style.cssText='position:fixed;inset:0;z-index:2147483100;background:rgba(20,22,43,.45);display:flex;align-items:center;justify-content:center;padding:20px';
      var c=document.createElement('div');
      c.style.cssText='background:#fff;border-radius:16px;max-width:430px;width:100%;padding:22px 24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);font:inherit;text-align:'+((typeof LANG!=='undefined'&&LANG==='ar')?'right':'left');
      c.innerHTML='<div style="font-size:17px;font-weight:800;color:'+(danger?'#D92D20':'#1C1E2B')+';margin-bottom:8px">'+title+'</div>'+
        '<div style="font-size:13.5px;color:#55596A;line-height:1.7">'+line1+'</div>'+
        (line2?'<div style="font-size:12.5px;color:#7C8194;margin-top:8px">'+line2+'</div>':'');
      var b=document.createElement('button'); b.className='btn pri sm'; b.style.cssText='margin-top:16px;width:100%';
      b.textContent=fl('OK','حسنًا'); b.onclick=function(){ov.remove();};
      c.appendChild(b); ov.appendChild(c); document.body.appendChild(ov);
      shown++;
    }catch(_){ alert(title); }
  }

  /* ---- 2. take away what this person may not use ----------------------------------- */

  /* 2026-09-02 (round 30): this layer guards on ROLE, but js/64 bounces on the per-user PAGE
     matrix (js/56) — two different models, and they disagreed. A team_member whose Proposals
     access is set to "No access" still passes can('proposals'), because the team_member role
     writes proposals. So Today's "New offer" tile ran newOffer(), which pushes a record and
     save()s it IMMEDIATELY, and only then did render() bounce them to Today with "You do not
     have access to that page". A blank proposal was created and stored by someone denied the
     page, who never saw it and could not go and delete it.
     Nobody is restricted on Proposals today, so this has not yet bitten — but that matrix is
     exactly what the owner set up to restrict people, so it would bite on first use.
     A guarded action whose page the person cannot open is now refused before it writes.
     Checked at CALL time, not wrap time: myAllowedPages lives in js/52, which loads after
     this file, and the role/matrix arrive later still. An unknown answer never blocks. */
  var PAGE_OF={proposals:'offers',leads:'leads',requests:'ops',finance:'finance'};
  function mayOpen(what){
    try{
      var pg=PAGE_OF[what]; if(!pg) return true;
      if(typeof window.__accessKnown!=='function'||!window.__accessKnown()) return true;
      if(typeof window.myAllowedPages!=='function') return true;
      var allowed=window.myAllowedPages();
      if(!allowed) return true;                    // null = unrestricted (admins)
      return allowed.indexOf(pg)>=0;
    }catch(_){ return true; }
  }
  function refusePage(){
    box(fl('You do not have access to that page','ليست لديك صلاحية للوصول إلى هذه الصفحة'),
        fl('Nothing was created. Ask an admin if you need it.','لم يُنشأ أي شيء. اطلب من أحد المسؤولين إذا احتجت إليها.'),'');
  }
  try{ window.__v73MayOpen=mayOpen; }catch(_){}

  function guardFn(name,what){
    try{
      var orig=window[name]; if(typeof orig!=='function'||orig.__v70)return;
      var wrapped=function(){ if(!can(what)){ refuse(what); return; } if(!mayOpen(what)){ refusePage(); return; } return orig.apply(this,arguments); };
      wrapped.__v70=1; wrapped.__orig=orig; window[name]=wrapped;
    }catch(_){}
  }
  function applyGuards(){
    ['editBusiness','leadQuickEdit','setLeadStage','convertToClient','v40Touch','v40AddComment','v40Hold','v33CycleFit'].forEach(function(f){ guardFn(f,'leads'); });
    ['newOffer','offerEditor','saveOffer'].forEach(function(f){ guardFn(f,'proposals'); });
    ['editRequest'].forEach(function(f){ guardFn(f,'requests'); });
    ['expSave','expDel','finSetWay','finCommit','finSetTargets','finLinkMap'].forEach(function(f){ guardFn(f,'finance'); });
    /* 2026-09-02 (attack round 13, driven as a read-only viewer WITH records on the pages): the
       Ops board's "Advance →" button, the drag-drop between columns, "+ New project",
       "Promote to project" and "Add billing profile" were not in this list — a read-only person
       could move a request a column along and see it move (the database refused it later, so
       the screen lied until reload). */
    ['advanceReq','newRequestForLead'].forEach(function(f){ guardFn(f,'requests'); });
    ['v25NewProject','o_promoteProject'].forEach(function(f){ guardFn(f,'proposals'); });
    ['v34AddProfile'].forEach(function(f){ guardFn(f,'leads'); });
    try{
      var od=window.dropOn;
      if(typeof od==='function'&&!od.__v70){
        var wd=function(e,kind,key,el){
          var what=kind==='req'?'requests':kind==='lead'?'leads':null;
          if(what&&!can(what)){ try{ if(e&&e.preventDefault)e.preventDefault(); }catch(_){} if(el&&el.classList)el.classList.remove('drop'); try{ _drag=null; }catch(_){} refuse(what); return; }
          return od.apply(this,arguments);
        };
        wd.__v70=1; wd.__orig=od; window.dropOn=wd;
      }
    }catch(_){}
    /* NOTE: we deliberately do NOT blanket-hide primary buttons. Guarding the actions above is
       what stops the write; hiding every strong button also removed harmless read-only ones
       (Show all, Export) and left read-only people staring at a stripped screen. */
  }

  /* ---- 3. never let the screen show a change the database refused ------------------- */
  function watchSaves(){
    try{
      if(window.__pillHook) return;
      window.__pillHook=function(text){
        try{
          var t=String(text||'');
          if(!/^Save issue/i.test(t)) return;
          var denied=/row-level security|violates|not authorized|permission|policy/i.test(t);
          box(fl('That change was not saved','لم يتم حفظ التعديل'),
              denied
                ? fl('Your access level does not allow this change, so it was refused.','مستوى صلاحيتك لا يسمح بهذا التعديل، لذلك تم رفضه.')
                : fl('The change could not be stored.','تعذر حفظ التعديل.'),
              fl('The screen will refresh so it matches what is really saved.','ستُحدَّث الشاشة لتطابق المحفوظ فعليًا.'), true);
          setTimeout(function(){ try{ location.reload(); }catch(_){} }, 4500);
        }catch(_){}
      };
    }catch(_){}
  }

  /* ---- the Settings page is for admins only, however you get there ------------------ */
  function gateSettings(){
    try{
      if(typeof current==='undefined'||current!=='settings')return;
      var r=role(); if(!r||r==='admin'||r==='manager')return;
      current='today';
      try{ if(typeof render==='function') render(); }catch(_){}
      box(fl('Settings is for admins','الإعدادات للمسؤولين فقط'),
          fl('That page holds company setup, backups and team tools, so it is kept to admin accounts.','تحتوي تلك الصفحة على إعدادات الشركة والنسخ الاحتياطي وأدوات الفريق، لذلك تقتصر على حسابات المسؤولين.'),
          fl('Ask an admin if you need something changed there.','اطلب من المسؤول إن احتجت تعديل شيء هناك.'));
    }catch(_){}
  }

  /* ---- a quiet line on screen so a read-only person knows why buttons are gone ------ */
  function badge(){
    try{
      var r=role(); if(r!=='viewer'&&r!=='operations')return;
      if(document.getElementById('v70badge'))return;
      var v=document.getElementById('view'); if(!v)return;
      var d=document.createElement('div'); d.id='v70badge';
      d.style.cssText='background:#EEF2FF;border:1px solid #D6DCFF;color:#3A4A8A;border-radius:10px;padding:8px 12px;font-size:12.5px;margin-bottom:12px';
      d.textContent=(r==='viewer')
        ? fl('Read-only account — you can open and read everything, but nothing you do is saved.','حساب للقراءة فقط — يمكنك فتح كل شيء وقراءته، لكن لا يُحفظ أي تعديل.')
        : fl('Operations account — you work requests and log activity; companies and proposals are edited by the sales team.','حساب العمليات — تعمل على الطلبات وتسجيل النشاط؛ الشركات والعروض يعدّلها فريق المبيعات.');
      v.insertBefore(d, v.firstChild);
    }catch(_){}
  }

  try{
    var _r=window.render;
    window.render=function(){ var o=_r.apply(this,arguments); try{ gateSettings(); applyGuards(); watchSaves(); badge(); }catch(_){} return o; };
  }catch(_){}
  [900,2500,5000,9000].forEach(function(d){ setTimeout(function(){ gateSettings(); applyGuards(); watchSaves(); badge(); }, d); });
  setInterval(function(){ gateSettings(); applyGuards(); watchSaves(); }, 6000);

  console.info('%c[v73] permission guard loaded','color:#D92D20;font-weight:700');
}catch(e){if(window.console)console.warn('[v73] init',e);}})();
