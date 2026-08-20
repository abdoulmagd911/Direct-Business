/* ===== Who can open what, page by page, person by person (chapter, 2026-08-17) =====

   The owner's spec. Three tiers and nothing more:

     Admin    — everything, everywhere. Not in the matrix and never shown it, because there has
                to be somebody who can repair a matrix somebody else got wrong.
     Manager  — driven by the matrix, so the one manager is adjustable rather than hard-coded.
     Employee — driven by the matrix, per person. One employee can be given the Proposal
                Designer or Settings without the others getting it.

   Two things per page: whether this person can open it at all, and whether they can change
   anything once they are in. The second is not decoration — on Finance, Settings and Team &
   Access the database enforces it too (can_edit_page), so a Viewer who goes round the screen
   still cannot write. Elsewhere it is a screen-level setting.

   It was seeded from what everybody could already do, deliberately, so switching to the matrix
   changed nobody's working day. Taking Finance off the employees, or giving them Proposals, are
   real decisions for the owner to make one checkbox at a time — not the side effect of a
   default somebody chose while building this.                                                */
(function(){try{
  var PAGES=[
    ['today','Today','اليوم'],['leads','Leads','العملاء المحتملون'],['clients','Clients','العملاء'],
    ['offers','Proposals','العروض'],['ops','Operations','العمليات'],['reports','Reports','التقارير'],
    ['finance','Finance','المالية'],['settings','Settings','الإعدادات'],['events','Events','الفعاليات'],
    ['airlines','Airlines','شركات الطيران'],['vendors','Suppliers','المورّدون'],['sopsla','SOP & SLA','الإجراءات'],
    ['activity','Activity & Audit','السجل'],['archive','Archive','الأرشيف']
  ];
  /* the three the database also enforces — worth saying on screen so nobody assumes the rest
     are watertight */
  var HARD=['finance','settings','activity'];

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){var c=fc(); if(c) return c;} }catch(_){}
                     /* Only ever use a client that already exists. Calling supabase's createClient, called with nothing passed in, with no
     arguments looks harmless — the v44a memoiser is meant to hand back the shared client — but
     if it happens to be the FIRST call on the page it builds a client with no project URL and
     no key, and memoises that broken thing for everything that follows: sign-in, Finance, the
     roster. That is a page-wide outage caused by a convenience fallback. So: wait for the real
     client rather than risk creating a hollow one. */
                     return null; }
  function amAdmin(){ try{ return window.__userRole==='admin'; }catch(_){ return false; } }

  /* ---------- my own access, loaded once and kept on window for the access-model layer ---------- */
  function loadMine(){
    var c=client(); if(!c||!c.rpc) return;
    c.rpc('my_page_access').then(function(r){
      if(!r||r.error) return;
      window.__pageAccess = r.data || null;      // null for admins = no matrix applies
      window.__pageAccessLoaded = true;
      try{ if(typeof render==='function') render(); }catch(_){}
    }).catch(function(){});
  }
  setTimeout(loadMine, 1200);
  setTimeout(loadMine, 5000);

  /* ---------- the editor, for admins, inside Team & Access ---------- */
  var ROWS=null;
  window.axLoad=function(cb){
    var c=client(); if(!c) return;
    c.from('app_users').select('id,full_name,email,role,active,page_access').order('role').then(function(r){
      ROWS=(r&&!r.error&&r.data)?r.data:[];
      if(cb)cb(); else try{ if(typeof render==='function') render(); }catch(_){}
    });
  };

  window.axSet=function(id,page,val){
    try{
      var u=(ROWS||[]).find(function(x){return x.id===id;}); if(!u)return;
      u.page_access=u.page_access||{};
      if(val==='none') delete u.page_access[page]; else u.page_access[page]=val;
      paint();
    }catch(e){console.warn('[matrix] set',e);}
  };

  window.axSave=function(id){
    try{
      var u=(ROWS||[]).find(function(x){return x.id===id;}); if(!u)return;
      var c=client(); if(!c)return;
      c.from('app_users').update({page_access:u.page_access||{}}).eq('id',u.id).select().then(function(r){
        if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
        /* a refused write comes back as success with nothing in it — count the rows */
        if(!r.data||!r.data.length){alert(fl('Nothing was saved — your account was not allowed to.','لم يُحفظ شيء — لا تملك الصلاحية.'));return;}
        if(typeof toast==='function')toast(fl('Access saved for '+(u.full_name||''),'تم حفظ الصلاحيات'));
        try{ if(window.__note)__note('team',u.id,'page access changed',JSON.stringify(u.page_access||{})); }catch(_){}
      });
    }catch(e){console.warn('[matrix] save',e);}
  };

  /* Never let the last admin be demoted — somebody must always be able to undo a mistake here. */
  window.axSetRole=function(id,newRole){
    try{
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
        u.role=newRole;
        try{ if(window.__note)__note('team',id,'role changed',newRole); }catch(_){}
        if(typeof toast==='function')toast(fl('Role updated','تم تحديث الدور'));
        paint();
      });
    }catch(e){console.warn('[matrix] role',e);}
  };

  var TIER=[['admin','Admin','مسؤول النظام'],['manager','Manager','مدير'],['team_member','Employee','موظف']];

  function card(u){
    var isAdm=u.role==='admin';
    var pa=u.page_access||{};
    var h='<div class="card ax-card" style="padding:14px 16px;margin-bottom:10px">'+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:'+(isAdm?'0':'10px')+'">'+
        '<b style="font-size:14px">'+esc(u.full_name||u.email)+'</b>'+
        '<span style="color:var(--muted);font-size:11.5px">'+esc(u.email)+'</span>'+
        '<select class="inp sm" style="max-width:150px" onchange="axSetRole(\''+u.id+'\',this.value)">'+
          TIER.map(function(t){return '<option value="'+t[0]+'"'+(u.role===t[0]?' selected':'')+'>'+fl(t[1],t[2])+'</option>';}).join('')+
        '</select>'+
        (isAdm?('<span style="color:#0F6E56;font-size:12px;font-weight:700">'+fl('Full access to everything','صلاحية كاملة لكل شيء')+'</span>'):'')+
      '</div>';
    if(isAdm) return h+'</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px">';
    PAGES.forEach(function(p){
      var cur=pa[p[0]]||'none';
      h+='<div style="display:flex;gap:6px;align-items:center;font-size:12.5px">'+
         '<span style="flex:1">'+esc(fl(p[1],p[2]))+(HARD.indexOf(p[0])>=0?' <span title="'+fl('Also enforced by the database','مطبّقة في قاعدة البيانات أيضًا')+'" style="color:#0F6E56">•</span>':'')+'</span>'+
         '<select class="inp sm" style="max-width:105px;font-size:12px" onchange="axSet(\''+u.id+'\',\''+p[0]+'\',this.value)">'+
           '<option value="none"'+(cur==='none'?' selected':'')+'>'+fl('No access','لا يوجد')+'</option>'+
           '<option value="viewer"'+(cur==='viewer'?' selected':'')+'>'+fl('Viewer','مشاهدة')+'</option>'+
           '<option value="editor"'+(cur==='editor'?' selected':'')+'>'+fl('Editor','تعديل')+'</option>'+
         '</select></div>';
    });
    h+='</div><button class="btn pri sm" style="margin-top:10px" onclick="axSave(\''+u.id+'\')">'+fl('Save access','حفظ الصلاحيات')+'</button></div>';
    return h;
  }

  function paint(){
    try{
      if(!amAdmin()) return;
      /* Only on the Settings page (where "Team & Access" lives) — was a text-content guess
         (/team|access/i against the whole page) until 2026-08-20, which fired wrongly on any
         page whose own copy happened to contain the word "team" or "access" (e.g. Finance ›
         Performance has an unrelated note about "the commercial team"), leaking this panel —
         and its live database-writing Save buttons — onto a page it has nothing to do with.
         `current` is the same page identity every other view branch in the app checks. */
      if(typeof current==='undefined'||current!=='settings') return;
      var view=document.getElementById('view'); if(!view) return;
      var host=document.getElementById('axHost');
      if(!host){
        host=document.createElement('div'); host.id='axHost'; host.style.cssText='margin-top:16px';
        view.appendChild(host);
      }
      if(ROWS==null){ host.innerHTML='<div class="card" style="padding:22px;text-align:center;color:var(--muted)">'+fl('Loading access…','جارٍ التحميل…')+'</div>'; axLoad(); return; }
      host.innerHTML='<h3 class="finh" style="margin:0 0 3px">'+fl('Who can open what','من يفتح ماذا')+'</h3>'+
        '<div class="ch-sub" style="margin-bottom:10px">'+fl(
          'Set each person page by page. Admins are not listed here — they always have everything. A green dot means the database enforces that page too, so Viewer really is view-only.',
          'حدّد لكل شخص صفحة بصفحة. المسؤولون غير مدرجين — لديهم كل شيء دائمًا. النقطة الخضراء تعني أن قاعدة البيانات تطبّق ذلك أيضًا.')+'</div>'+
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

  console.info('%c[matrix] per-page access loaded','color:#175CD3;font-weight:700');
}catch(e){if(window.console)console.warn('[matrix] init',e);}})();
