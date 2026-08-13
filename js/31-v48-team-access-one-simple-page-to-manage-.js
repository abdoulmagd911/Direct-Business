/* ===== v48 — Team & Access: one simple page to manage who can sign in and what they see =====
   Consolidates the old separate "Team" (create/reset/activate) and "Access" (per-page) tools into
   ONE panel: add a teammate, set their level, switch them on or off, and reset a password.
   The per-page tick boxes were removed on 2026-08-13 — a person's LEVEL decides which pages
   they open and what they may save, so the ticks changed nothing, and worse, "Save pages"
   reported success even when the database had refused the write. Reachable from a Settings card (works on phone) and the top-bar Team/Access buttons. */
(function(){try{
  var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
  var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
  var RL={admin:['Admin — full control','مسؤول — تحكم كامل'],manager:['Manager','مدير'],bd:['Business development','تطوير الأعمال'],operations:['Operations','العمليات'],team_member:['Team member','عضو فريق'],viewer:['Read only','قراءة فقط']};
  function ar(){try{return (typeof isAr==='function')?isAr():(document.documentElement.getAttribute('data-lang')==='ar');}catch(_){return false;}}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function cl(){ try{ if(!window.__sb48 && window.supabase){ window.__sb48=window.supabase.createClient(SUPA_URL,SUPA_KEY); } }catch(_){ } return window.__sb48||null; }
  function call(p){ return (window.__callAdmin?window.__callAdmin(p):Promise.resolve({error:'Admin tools not ready — reload and try again.'})); }
  function pages(){
    // Make Finance gateable (it was missing from the shared PAGES list used for enforcement).
    try{ if(window.PAGES && Array.isArray(window.PAGES) && !window.PAGES.some(function(p){return p[0]==='finance';})){
      var ci=-1; window.PAGES.forEach(function(p,i){ if(p[0]==='clients')ci=i; });
      window.PAGES.splice(ci>=0?ci+1:window.PAGES.length,0,['finance','Finance','المالية']);
    }}catch(_){}
    return (window.PAGES&&Array.isArray(window.PAGES))?window.PAGES:[['today','Today','اليوم'],['leads','Leads','العملاء المحتملون'],['clients','Clients','العملاء'],['finance','Finance','المالية']];
  }

  window.v48Users=function(){
    pages();
    var A=ar();
    var old=document.getElementById('v48ov'); if(old)old.remove();
    var ov=document.createElement('div'); ov.id='v48ov';
    ov.style.cssText='position:fixed;inset:0;z-index:2147481600;background:rgba(20,22,35,.55);display:flex;align-items:flex-start;justify-content:center;padding:26px 14px;overflow:auto';
    var box=document.createElement('div');
    box.style.cssText='background:#fff;border-radius:16px;max-width:840px;width:100%;padding:20px 22px;font-family:inherit;box-shadow:0 30px 80px -20px rgba(0,0,0,.5)'+(A?';direction:rtl':'');
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
      '<div style="font-size:18px;font-weight:800">'+(A?'الفريق والصلاحيات':'Team & Access')+'</div>'+
      '<button id="v48x" class="btn ghost sm">'+(A?'إغلاق':'Close')+'</button></div>'+
      '<div style="background:var(--wash-orange,#FFF3EC);border:1px solid #F2C185;border-radius:12px;padding:13px 15px;margin-bottom:16px">'+
        '<div style="font-weight:800;font-size:13px;margin-bottom:9px">'+(A?'إضافة زميل':'Add a teammate')+'</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          '<input id="v48n" placeholder="'+(A?'الاسم الكامل':'Full name')+'" style="flex:1;min-width:140px;padding:9px 11px;border:1px solid var(--line-2,#DADDE3);border-radius:9px;font:inherit;font-size:16px">'+
          '<input id="v48e" placeholder="name@directksa.com" inputmode="email" autocapitalize="none" style="flex:1.3;min-width:180px;padding:9px 11px;border:1px solid var(--line-2,#DADDE3);border-radius:9px;font:inherit;font-size:16px">'+
          '<select id="v48r" style="padding:9px 11px;border:1px solid var(--line-2,#DADDE3);border-radius:9px;font:inherit;font-size:14px">'+Object.keys(RL).map(function(k){return '<option value="'+k+'"'+(k==='team_member'?' selected':'')+'>'+(A?RL[k][1]:RL[k][0])+'</option>';}).join('')+'</select>'+
          '<input id="v48pw" placeholder="'+(A?'كلمة المرور (اختياري)':'Password (optional)')+'" autocomplete="new-password" style="flex:1;min-width:170px;padding:9px 11px;border:1px solid var(--line-2,#DADDE3);border-radius:9px;font:inherit;font-size:16px">'+
          '<button id="v48create" class="btn pri sm">'+(A?'إنشاء':'Create')+'</button>'+
        '</div>'+
        '<div style="font-size:11.5px;color:var(--muted,#6B7480);margin-top:7px">'+(A?'اكتب كلمة مرور لتسليمها بنفسك، أو اتركها فارغة ليصنع التطبيق واحدة مؤقتة ويطلب منه تغييرها أول مرة.':'Type a password to hand over yourself, or leave it blank and the app makes a temporary one they must change on first sign-in.')+'</div>'+
        '<div id="v48res" style="display:none;margin-top:10px"></div>'+
      '</div>'+
      '<div id="v48list" style="font-size:13px;color:var(--muted,#6B7480)">'+(A?'جارٍ التحميل…':'Loading…')+'</div>';
    ov.appendChild(box); document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
    document.getElementById('v48x').onclick=function(){ov.remove();};
    document.getElementById('v48create').onclick=addUser;
    load();

    function addUser(){
      var n=(document.getElementById('v48n').value||'').trim();
      var e=(document.getElementById('v48e').value||'').trim().toLowerCase();
      var r=document.getElementById('v48r').value;
      var pwEl=document.getElementById('v48pw');
      var pw=(pwEl&&pwEl.value||'').trim();
      if(!e||e.indexOf('@')<0){ alert(A?'أدخل بريدًا صحيحًا.':'Enter a valid email address.'); return; }
      if(pw&&pw.length<8){ alert(A?'كلمة المرور تحتاج ٨ أحرف على الأقل.':'A password needs at least 8 characters.'); return; }
      var btn=document.getElementById('v48create'); btn.disabled=true; btn.textContent=A?'جارٍ…':'Creating…';
      call({action:'create',email:e,full_name:n,role:r,password:pw||undefined}).then(function(res){
        btn.disabled=false; btn.textContent=A?'إنشاء':'Create';
        if(res.error){ alert(res.error); return; }
        document.getElementById('v48n').value=''; document.getElementById('v48e').value='';
        if(pwEl) pwEl.value='';
        showTemp(res.email,res.temp_password,res.permanent); load();
      }).catch(function(x){ btn.disabled=false; btn.textContent=A?'إنشاء':'Create'; alert(String(x&&x.message||x)); });
    }
    function showTemp(email,pw,permanent){
      var r=document.getElementById('v48res'); if(!r)return; r.style.display='block';
      r.innerHTML='<div style="background:#E7F8EF;border:1px solid #16B36455;border-radius:10px;padding:11px 13px;font-size:12.5px;color:#0B4229">'+
        '<b>'+(A?'تم إنشاء الحساب':'Account created')+'</b> — '+(A?'أرسل هذا للزميل على واتساب:':'send these to them on WhatsApp:')+
        '<div style="background:#fff;border:1px dashed #C9C2B4;border-radius:8px;padding:9px 11px;margin-top:7px;font-family:monospace;user-select:all;color:#1C1E2B">'+
        (A?'الرابط':'Link')+': '+esc(location.origin)+'<br>'+(A?'البريد':'Email')+': '+esc(email)+'<br>'+(permanent?(A?'كلمة المرور':'Password'):(A?'كلمة مرور مؤقتة':'Temporary password'))+': <b>'+esc(pw)+'</b></div>'+
        '<div style="color:#6B7480;margin-top:6px">'+(permanent?(A?'تظهر مرة واحدة. هذه كلمته الدائمة — لن يُطلب منه تغييرها.':'Shown once. This is their permanent password — they will not be asked to change it.'):(A?'تظهر مرة واحدة. سيختار كلمته الخاصة عند أول دخول.':'Shown once. They choose their own password on first sign-in.'))+'</div></div>';
    }
    /* what this level actually opens — the same lists the app and the server both go by */
    function pagesLine(role){
      if(role==='admin')   return A?'يفتح كل الصفحات، ويمنح أي صلاحية.':'Opens every page, and can grant any level.';
      if(role==='manager') return A?'يفتح: اليوم، العملاء المحتملون، العملاء، المالية، العروض، الفعاليات، شركات الطيران، الإعدادات والسجلات. يضيف ويزيل الزملاء (دون صلاحية مسؤول).':'Opens Today, Leads, Clients, Finance, Proposals, Events, Airlines, Settings and the logs. Adds and removes people — but never an admin.';
      return A?'يفتح: اليوم، العملاء المحتملون، العملاء، المالية — ويعدّل فيها جميعًا.':'Opens Today, Leads, Clients and Finance — and may edit all of them.';
    }
    function load(){
      var lb=document.getElementById('v48list'); if(!lb)return;
      call({action:'list'}).then(function(res){
        if(res.error){ lb.textContent=res.error; return; }
        var users=res.users||[];
        var c=cl();
        draw(users);
      });
    }
    function draw(users){
      var lb=document.getElementById('v48list'); if(!lb)return;
      lb.style.color='var(--txt,#303848)';
      lb.innerHTML=users.map(function(u,i){
        var nm=esc((u.full_name||'').trim()||u.email.split('@')[0]);
        var roleSel='<select data-role="'+u.id+'" style="padding:6px 9px;border:1px solid var(--line-2,#DADDE3);border-radius:8px;font:inherit;font-size:12px;background:#fff">'+Object.keys(RL).map(function(k){return '<option value="'+k+'"'+(u.role===k?' selected':'')+'>'+(A?RL[k][1]:RL[k][0])+'</option>';}).join('')+'</select>';
        return '<div style="border-top:1px solid var(--line,#E6E8EC);padding:13px 0">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
            '<div class="v48-nm"><b style="font-size:13.5px">'+nm+'</b> <span style="color:var(--muted,#6B7480);font-size:11.5px">'+esc(u.email)+'</span>'+(u.must_change_password?' <span style="font-size:10.5px;color:#B54708;font-weight:700">'+(A?'مؤقتة':'temp pw')+'</span>':'')+(u.active===false?' <span style="font-size:10.5px;color:#B54708;font-weight:700">'+(A?'موقوف':'off')+'</span>':'')+'</div>'+
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+roleSel+
              '<button class="btn ghost sm" data-tog="'+u.id+'" data-act="'+(u.active?'0':'1')+'">'+(u.active?(A?'إيقاف':'Switch off'):(A?'تفعيل':'Switch on'))+'</button>'+
              '<button class="btn ghost sm" data-rst="'+u.id+'">'+(A?'كلمة مرور جديدة':'Reset password')+'</button>'+
            '</div></div>'+
          /* The per-page tick boxes were removed on 2026-08-13. A person's LEVEL decides which
             pages they open and what they may save — the ticks changed neither, and the Save
             button said "Saved ✓" even when the database had refused the write outright. */
          '<div style="margin-top:6px;font-size:11.5px;color:var(--muted,#6B7480)">'+pagesLine(u.role)+'</div>'+
        '</div>';
      }).join('') || (A?'لا يوجد مستخدمون بعد.':'No users yet.');
      wire(users);
    }
    function wire(users){
      var lb=document.getElementById('v48list');
      lb.querySelectorAll('[data-role]').forEach(function(sel){ sel.onchange=function(){ call({action:'set_role',id:sel.getAttribute('data-role'),role:sel.value}).then(function(r){ if(r.error){alert(r.error);load();} }); }; });
      lb.querySelectorAll('[data-tog]').forEach(function(b){ b.onclick=function(){ call({action:'set_active',id:b.getAttribute('data-tog'),active:b.getAttribute('data-act')==='1'}).then(function(r){ if(r.error){alert(r.error);return;} load(); }); }; });
      lb.querySelectorAll('[data-rst]').forEach(function(b){ b.onclick=function(){ if(!confirm(A?'إعطاء هذا الشخص كلمة مرور مؤقتة جديدة؟':'Give this person a new temporary password?'))return; b.disabled=true; call({action:'reset_password',id:b.getAttribute('data-rst')}).then(function(r){ b.disabled=false; if(r.error){alert(r.error);return;} var wrap=b.closest('div').parentNode.parentNode; var sp=wrap?wrap.querySelector('.v48-nm span'):null; showTemp(sp?sp.textContent:'',r.temp_password); }); }; });
    }
  };

  /* Settings entry card (admins only) — the discoverable, phone-friendly way in */
  function addSettingsCard(){
    try{
      if(typeof current==='undefined'||current!=='settings')return;
      if(window.__userTier && window.__userTier!=='admin' && window.__userTier!=='manager')return;
      var v=document.getElementById('view'); if(!v||v.querySelector('.v48-card'))return;
      var A=ar();
      var card=document.createElement('div'); card.className='card v48-card'; card.style.cssText='border:1px solid #F2C185';
      card.innerHTML='<h3>'+(A?'الفريق والصلاحيات':'Team & Access')+'</h3>'+
        '<div style="font-size:13px;color:var(--muted,#6B7480);margin:2px 0 12px">'+(A?'أنشئ حسابات الفريق وحدد مستوى كل شخص: مسؤول أو مدير أو موظف. المستوى وحده يحدد الصفحات التي يفتحها وما يمكنه تعديله.':'Create team accounts and set each person’s level — Admin, Manager or Employee. The level alone decides which pages they open and what they may change.')+'</div>'+
        '<button class="btn pri" onclick="v48Users()">'+(A?'فتح الفريق والصلاحيات':'Open Team & Access')+'</button>';
      var _sh=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_sh)v.insertBefore(card,_sh.nextSibling);else v.insertBefore(card, v.firstChild);
    }catch(_){}
  }
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{setTimeout(addSettingsCard,60);}catch(_){}; return o; }; } }catch(_){}
  setTimeout(addSettingsCard,1200); setTimeout(addSettingsCard,3000);

  /* Repoint the existing top-bar Team + Access buttons to the one consolidated page */
  setInterval(function(){ try{
    var t=document.getElementById('cl_team'); if(t&&!t.__v48){ t.__v48=1; t.onclick=function(){v48Users();}; }
    var a=document.getElementById('v41acc'); if(a&&!a.__v48){ a.__v48=1; a.onclick=function(){v48Users();}; }
  }catch(_){} }, 1500);

  console.info('%c[v48] Team & Access page loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v48] init',e);}})();

/* ===== v50 — Settings final tidy: drop dev/audit leftovers, finish the Arabic ===== */
/* The clean "Daily use" tiles + "Advanced" drawer sit at the top (built by v26). A few older
   cards are injected LATER by other layers and leak in below them — two are pure developer /
   audit read-outs with nothing the team uses, and in Arabic several cards still show English.
   This pass runs after those late cards settle: it hides the two dead cards and translates the
   remaining English labels so Arabic Settings reads all-Arabic. Reversible — it only sets
   display / textContent and never touches data. */
(function(){try{
  function isArNow(){try{return (typeof LANG!=='undefined'&&LANG==='ar');}catch(_){return false;}}
  /* Cards removed entirely — all are build-time scaffolding left over from earlier versions of
     the app, none of them tools the team uses:
       · "Security & integrity"  — a ZATCA/XSS/PII audit read-out (a developer check)
       · "Generator templates"   — a re-learn button (already under Advanced) + a dev "show tokens"
       · "Performance"           — a dev performance-hint overlay
       · "Accessibility audit"   — a WCAG dev audit
       · "Internationalization"  — dev translation-coverage stats
       · "Developer / test"      — the "Run a day" / "Wipe test records" harness
       · "Print + PDF"           — developer notes about a print helper
       · "reconcile with Ahmed"  — a one-off import note referencing a Q:\ spreadsheet
       · "Workflow + go-live"    — the v22 end-to-end test suite + "reset for go-live"
       · "Scenario sweep"        — the v23 reissue/refund/ancillaries test runner
     The real proposal Generators, Backup & restore, and the company one-pagers all stay. */
  var DROP=['Security & integrity','Generator templates','Performance','Accessibility audit',
            'Internationalization','Developer / test','Print + PDF','reconcile with Ahmed',
            'Workflow + go-live','Scenario sweep'];
  /* Exact English → Arabic for labels that stayed English in Arabic mode. */
  var ARMAP={
    'Generators':'المولّدات',
    'Backup & restore':'النسخ الاحتياطي والاستعادة',
    'Connections':'الاتصالات',
    'Archive':'الأرشيف',
    'Add':'إضافة',
    'History':'السجل',
    'Service-Fee proposal':'عرض رسوم الخدمة',
    'Project proposal':'عرض المشروع',
    'Export JSON':'تصدير JSON',
    'Import JSON':'استيراد JSON',
    'Browse snapshots':'تصفّح النسخ',
    'Save destination':'حفظ الوجهة',
    'Backup now':'انسخ الآن',
    'Last auto-snapshot':'آخر نسخة تلقائية',
    'Incremental snapshots':'النسخ التزايدية',
    'Daily snapshots':'النسخ اليومية',
    'Tagged restore points':'نقاط الاستعادة الموسومة',
    'Team (lead owners / account managers)':'الفريق (مسؤولو العملاء المحتملين / مديرو الحسابات)',
    'DESTINATION':'الوجهة',
    'Destination':'الوجهة',
    'Last 5 backup log entries:':'آخر 5 مدخلات في سجل النسخ:',
    'Note about browser limits':'ملاحظة حول حدود المتصفح',
    'Your browser Downloads folder':'مجلد التنزيلات في المتصفح',
    'Auto-log to backup log at cycle close + reset-for-go-live':'تسجيل النسخ الاحتياطية تلقائيًا'
  };
  var PH={'Add member':'أضف عضوًا'};
  function apply(){
    try{
      if(typeof current==='undefined'||current!=='settings')return;
      var view=document.getElementById('view'); if(!view)return;
      /* 1) hide the dead dev/audit cards (by heading) */
      view.querySelectorAll('.card').forEach(function(c){
        var h=c.querySelector('h3,h2'); var t=h?(h.textContent||''):'';
        for(var i=0;i<DROP.length;i++){ if(t.indexOf(DROP[i])>=0){ c.style.display='none'; return; } }
      });
      /* 1b) remove the manual backup apparatus (by stable id/class, language-independent).
         Code + data safety is handled by the platform (GitHub + Vercel + Supabase auto-save),
         so Export/Import JSON, snapshots and "backup destination" are not team tools. */
      ['#v21SettingsBackup','.v24BkCard'].forEach(function(sel){
        view.querySelectorAll(sel).forEach(function(c){ var card=c.closest('.card')||c; card.style.display='none'; });
      });
      /* 2) finish the Arabic — walk TEXT nodes only, so we translate the visible words without
         ever touching an icon span, checkbox, or the file input inside "Import JSON". Keep any
         leading emoji/arrow prefix and the original spacing. The clean top block
         (#v26SettingsOrg) is already Arabic, so skip it. */
      if(!isArNow())return;
      var walker=document.createTreeWalker(view,NodeFilter.SHOW_TEXT,null);
      var nodes=[],n; while(n=walker.nextNode()){ nodes.push(n); }
      nodes.forEach(function(node){
        try{
          var pe=node.parentElement; if(!pe)return;
          if(pe.closest('#v26SettingsOrg'))return;
          var m=(node.nodeValue||'').match(/^(\s*)([\s\S]*?)(\s*)$/); if(!m)return;
          var lead=m[1],core=m[2],trail=m[3]; if(!core)return;
          var pre=(core.match(/^[^A-Za-z0-9]*/)||[''])[0];
          var key=core.slice(pre.length).trim();
          if(ARMAP[key]!=null){ node.nodeValue=lead+pre+ARMAP[key]+trail; }
        }catch(_){}
      });
      /* placeholders (attributes, not text nodes) */
      view.querySelectorAll('input[placeholder]').forEach(function(inp){
        if(inp.closest('#v26SettingsOrg'))return;
        var p=(inp.getAttribute('placeholder')||'').trim();
        if(PH[p]!=null)inp.setAttribute('placeholder',PH[p]);
      });
    }catch(_){}
  }
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{[200,700,1600].forEach(function(d){setTimeout(apply,d);});}catch(_){}; return o; }; } }catch(_){}
  [300,1200,3000].forEach(function(d){setTimeout(apply,d);});
  setInterval(apply,2500);
  console.info('%c[v50] Settings tidy loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v50] init',e);}})();

/* ===== v51 — brand character: Today hero band + top-bar accent line ===== */
(function(){try{
  function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar');}catch(_){return false;}}
  if(!document.getElementById('v51-style')){
    var st=document.createElement('style'); st.id='v51-style';
    st.textContent=
      /* remove ALL manual-backup UI everywhere (Today banner + Settings cards) — the platform
         (GitHub + Vercel + Supabase) owns code/data safety, so this isn't a team tool */
      '.v24BkBanner,.v24BkCard,#v21SettingsBackup{display:none!important}'+
      /* a thin Direct-gradient signature under the top bar, on every page */
      '.top{position:relative}'+
      '.top::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,#E54525,#F26721 55%,#FBAE16);z-index:2}'+
      /* the Today welcome hero */
      '.v51-hero{background:linear-gradient(120deg,#E54525,#F26721 58%,#F79009);border-radius:18px;padding:20px 24px;margin:0 0 18px;color:#fff;box-shadow:0 14px 34px -14px rgba(229,69,37,.55);display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;position:relative;overflow:hidden}'+
      '.v51-hero::before{content:"";position:absolute;inset:auto -50px -80px auto;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.10)}'+
      '.v51-hero>div{position:relative;z-index:1}'+
      '.v51-hero .hl{font-size:22px;font-weight:800;letter-spacing:-.02em}'+
      '.v51-hero .hs{font-size:12px;font-weight:800;opacity:.96;margin-top:6px;letter-spacing:.05em;text-transform:uppercase}'+
      '.v51-hero .hd{text-align:right}'+
      'html[dir=rtl] .v51-hero .hd,body[dir=rtl] .v51-hero .hd{text-align:left}';
    document.head.appendChild(st);
  }
  function heroHTML(){
    var ar=isAr();
    var dateStr=''; try{ dateStr=new Date().toLocaleDateString(ar?'ar':'en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric',calendar:'gregory'}); }catch(_){ try{dateStr=new Date().toISOString().slice(0,10);}catch(__){} }
    var promise=ar?'قوة موردين عالمية · خدمة سعودية · شريك واحد':'Global supplier power. Saudi service. One partner.';
    var sub=ar?'دايركت أعمال — مساحة عمل الفريق':'Direct Business — team workspace';
    return '<div style="max-width:72%"><div class="hl" style="font-size:20px;line-height:1.32">'+promise+'</div><div class="hs">'+sub+'</div></div>'+
      '<div class="hd"><div style="font-size:14px;font-weight:800">'+dateStr+'</div></div>';
  }
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='today')return;
      var v=document.getElementById('view'); if(!v)return;
      if(v.querySelector('.v51-hero'))return;
      var d=document.createElement('div'); d.className='v51-hero'; d.innerHTML=heroHTML();
      v.insertBefore(d,v.firstChild);
    }catch(_){}
  }
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{setTimeout(inject,50);}catch(_){}; return o; }; } }catch(_){}
  [200,900,2500].forEach(function(d){setTimeout(inject,d);});
  console.info('%c[v51] brand hero + accent loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v51] init',e);}})();

/* ===== v52 — brand character (round 2): page-title accent + stat-card accent ===== */
(function(){try{
  if(!document.getElementById('v52-style')){
    var st=document.createElement('style'); st.id='v52-style';
    st.textContent=
      /* a short Direct-gradient rule under the main page title */
      '.v52-h{position:relative;padding-bottom:11px!important}'+
      '.v52-h::after{content:"";position:absolute;left:0;bottom:0;width:46px;height:4px;border-radius:3px;background:linear-gradient(90deg,#FF6B00,#FBAE16)}'+
      'html[dir=rtl] .v52-h::after,body[dir=rtl] .v52-h::after{left:auto;right:0}'+
      /* matching Direct left-accent on KPI cards (Operations etc.), so every stat row is on-brand */
      '#view .kpi{border-inline-start:3px solid #FF6B00}'+
      /* subtle brand top-rule on content stat cards that carry a value (not filter chips / top-bar pills) */
      '#view .chip:has(.v){border-top:2px solid rgba(255,107,0,.6)}';
    document.head.appendChild(st);
  }
  function tagTitle(){
    try{
      var v=document.getElementById('view'); if(!v)return;
      var h2s=v.querySelectorAll('h2'), picked=null;
      for(var i=0;i<h2s.length;i++){ var h=h2s[i];
        if(h.closest('.card')||h.closest('.v51-hero')) continue;
        if(h.offsetParent===null) continue;
        picked=h; break;
      }
      v.querySelectorAll('.v52-h').forEach(function(x){ if(x!==picked)x.classList.remove('v52-h'); });
      if(picked)picked.classList.add('v52-h');
    }catch(_){}
  }
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{[60,500,1500].forEach(function(d){setTimeout(tagTitle,d);});}catch(_){}; return o; }; } }catch(_){}
  [300,1200].forEach(function(d){setTimeout(tagTitle,d);});
  console.info('%c[v52] page-title + stat accents loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v52] init',e);}})();

/* ===== v53 — Finance ↔ client mapping: map each invoice group to the real client ===== */
(function(){try{
  function isAr(){ try{return (typeof LANG!=='undefined'&&LANG==='ar');}catch(_){return false;} }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function money(n){ n=Number(n)||0; if(Math.abs(n)>=1e6)return (n/1e6).toFixed(2)+'M'; if(Math.abs(n)>=1e3)return (n/1e3).toFixed(0)+'K'; return n.toFixed(0); }
  function client(){ try{ if(window.fc)return window.fc(); return (typeof fc==='function')?fc():null; }catch(_){ return null; } }
  function canEdit(){ try{ if(window.canFinEdit)return window.canFinEdit(); return (window.__userTier==='admin'||window.__userTier==='manager'); }catch(_){ return false; } }

  window.finLinkMap=function(){
    var A=isAr(); var FIN=window.FIN||{};
    if(FIN.rows==null){ if(typeof finLoad==='function')finLoad(function(){finLinkMap();}); return; }
    var byG={}; (FIN.rows||[]).forEach(function(r){ if(r.deleted_at)return; var g=r.client_group||'(blank)'; byG[g]=byG[g]||{rev:0,inv:0}; byG[g].rev+=+r.revenue_sar||0; byG[g].inv++; });
    var groups=Object.keys(byG).sort(function(a,b){return byG[b].rev-byG[a].rev;});
    var linkByGroup=FIN.linkByGroup||{};
    var clients=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){return b.isClient;}).sort(function(a,b){return (a.name||'').localeCompare(b.name||'');});
    var editable=canEdit();

    var old=document.getElementById('v53ov'); if(old)old.remove();
    var ov=document.createElement('div'); ov.id='v53ov';
    ov.style.cssText='position:fixed;inset:0;z-index:2147482000;background:rgba(20,22,43,.45);display:flex;align-items:flex-start;justify-content:center;padding:26px 12px;overflow:auto';
    var box=document.createElement('div'); box.style.cssText='background:#fff;border-radius:16px;max-width:760px;width:100%;padding:20px 22px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5)'; ov.appendChild(box);
    var head=document.createElement('div'); head.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px';
    head.innerHTML='<h3 style="margin:0">'+(A?'ربط المالية بالعملاء':'Link finance to clients')+'</h3>';
    var xBtn=document.createElement('button'); xBtn.className='btn ghost sm'; xBtn.textContent=(A?'إغلاق':'Close'); head.appendChild(xBtn); box.appendChild(head);
    var sub=document.createElement('div'); sub.style.cssText='font-size:12.5px;color:#6B7480;margin-bottom:12px';
    sub.textContent=(A?'اختر العميل لكل مجموعة فواتير حتى تنعكس أموالها على بطاقته. ⚠ = غير مرتبطة بعد.':'Pick the client for each invoice group so its money reflects on that client. ⚠ = not linked yet.');
    box.appendChild(sub);
    if(!editable){ var ro=document.createElement('div'); ro.style.cssText='font-size:12px;color:#a8650a;background:#FEF3E2;border-radius:9px;padding:8px 11px;margin-bottom:10px'; ro.textContent=(A?'العرض فقط — الربط للمدراء والمسؤولين.':'View only — mapping is for admins and managers.'); box.appendChild(ro); }

    groups.forEach(function(g){
      var l=linkByGroup[g]||{}; var curBiz=l.business_id||''; var indiv=(l.is_client===false);
      var curAppId=''; if(curBiz){ for(var i=0;i<clients.length;i++){ var uu=(window.__bizUuid?window.__bizUuid(clients[i].id):clients[i].id); if(uu===curBiz){curAppId=clients[i].id;break;} } }
      var row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #EEF0F3';
      var info=document.createElement('div'); info.style.cssText='flex:1;min-width:0';
      info.innerHTML='<div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(g)+'</div><div style="font-size:11px;color:#7C8194">'+money(byG[g].rev)+' SAR · '+byG[g].inv+' '+(A?'فاتورة':'inv')+'</div>';
      var stat=document.createElement('span'); stat.style.cssText='width:16px;text-align:center;font-size:13px'; stat.textContent=curAppId?'✓':(indiv?'—':'⚠');
      var sel=document.createElement('select'); sel.style.cssText='flex:1.2;min-width:180px;padding:7px 9px;border:1px solid #DADDE3;border-radius:9px;font:inherit;font-size:13px'; sel.disabled=!editable;
      var o0=document.createElement('option'); o0.value=''; o0.textContent=(A?'— غير مرتبطة —':'— unmapped —'); sel.appendChild(o0);
      var oi=document.createElement('option'); oi.value='__indiv__'; oi.textContent=(A?'أفراد / ليس عميلاً':'Individuals / not a client'); if(indiv)oi.selected=true; sel.appendChild(oi);
      clients.forEach(function(c){ var o=document.createElement('option'); o.value=c.id; o.textContent=c.name||'(unnamed)'; if(c.id===curAppId)o.selected=true; sel.appendChild(o); });
      sel.onchange=function(){
        var val=sel.value; var payload={client_group:g, updated_at:new Date().toISOString()};
        if(val==='__indiv__'){ payload.business_id=null; payload.is_client=false; payload.confirmed_by=(window.__userName||'app'); payload.confirmed_at=new Date().toISOString(); }
        else if(val===''){ payload.business_id=null; payload.is_client=true; payload.confirmed_by=null; payload.confirmed_at=null; }
        else { payload.business_id=(window.__bizUuid?window.__bizUuid(val):val); payload.is_client=true; payload.confirmed_by=(window.__userName||'app'); payload.confirmed_at=new Date().toISOString(); }
        var c=client(); stat.textContent='…';
        if(!c){ stat.textContent='⚠'; return; }
        c.from('finance_client_links').upsert(payload,{onConflict:'client_group'}).then(function(r){
          if(r&&r.error){ stat.textContent='⚠'; if(typeof toast==='function')toast(A?'تعذّر الحفظ':'Save failed'); return; }
          FIN.linkByGroup=FIN.linkByGroup||{}; FIN.linkByGroup[g]=payload;
          FIN.groupsByBiz={}; Object.keys(FIN.linkByGroup).forEach(function(k){var L=FIN.linkByGroup[k]; if(L.business_id){(FIN.groupsByBiz[L.business_id]=FIN.groupsByBiz[L.business_id]||[]).push(k);}});
          stat.textContent=(val==='__indiv__')?'—':(val===''?'⚠':'✓');
        });
      };
      row.appendChild(info); row.appendChild(stat); row.appendChild(sel); box.appendChild(row);
    });

    document.body.appendChild(ov);
    function close(){ ov.remove(); try{ FIN.rows=null; if(typeof finLoad==='function')finLoad(function(){ if(typeof render==='function')render(); }); }catch(_){} }
    xBtn.onclick=close; ov.addEventListener('click',function(e){ if(e.target===ov)close(); });
  };

  /* entry button on the Finance page (admin/manager) */
  function injectFinBtn(){
    try{
      if(typeof current==='undefined'||current!=='finance')return;
      if(!canEdit())return;
      var view=document.getElementById('view'); if(!view||document.getElementById('v53btn'))return;
      var b=document.createElement('button'); b.id='v53btn'; b.className='btn sm'; b.style.cssText='margin:0 0 10px';
      b.textContent=(isAr()?'ربط المالية بالعملاء':'Link finance to clients');
      b.onclick=function(){ finLinkMap(); };
      view.insertBefore(b, view.firstChild);
    }catch(_){}
  }
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{[120,700].forEach(function(d){setTimeout(injectFinBtn,d);});}catch(_){}; return o; }; } }catch(_){}
  [500,1500].forEach(function(d){setTimeout(injectFinBtn,d);});
  console.info('%c[v53] finance↔client mapping loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v53] init',e);}})();
