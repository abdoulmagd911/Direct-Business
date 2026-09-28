/* ===== People & teams — one admin page (2026-09-27, the owner's order of 26 Sep, part 2) =====

   Words as agreed on the Drive home page "00 — START HERE (Direct · All In)" §3: the DEPARTMENT is Commercial; a
   TEAM is a unit inside it. Teams are a setting: an admin or a manager adds, renames or retires one — never deletes;
   a retired team's open work moves to another team. Every person has one HOME team and may ASSIST other teams; a
   "reports to" (everyone → the head of Commercial for now). Only an admin or a manager edits people and teams, and
   the DATABASE enforces it (scripts/sql/people-and-teams.sql: person_save, team_retire, the row rules and guards);
   this layer holds no rule of its own — every refusal it shows is the database's sentence, in the reader's language.
   A user can only sign in and out.

   What is here:
     • the page `people` in the menu, for admins and managers only (js/52 reads data-v114-nav and the role gate);
     • Teams: add, rename, retire (choose where its open work goes), bring back, and who heads each;
     • People: names in English and Arabic, e-mail, role, page levels, home team, teams they assist, reports-to,
       job title, on the team list or not; "Invite" creates the login (admin-users) and saves the rest in one go;
     • window.teamOptionsHtml(memberId, selected) — the team picker the task and achievement forms use: the person's
       home team first, then the teams they assist, then every other active team;
     • the Team list section on Settings (js/110) now points here.                                                   */
(function(){try{
  var PAGE='people';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function role(){ try{ return window.__userRole||null; }catch(_){ return null; } }
  function canManage(){ var r=role(); return r==='admin'||r==='manager'; }
  function amAdmin(){ return role()==='admin'; }
  try{ if(typeof TITLES==='object') TITLES.people=['People & teams','Who is on the team, their teams, their access']; }catch(_){}

  /* ---------- the database's words, in the reader's language ---------- */
  var AR=[
    [/^Only an admin or a manager can change (people|teams)/,function(){ return 'لا يغيّر ذلك إلا المسؤول أو المدير'; }],
    [/^Only an admin can change an admin's details/,function(){ return 'المسؤول وحده يغيّر بيانات مسؤول'; }],
    [/^A first name is needed in English and in Arabic/,function(){ return 'الاسم الأول مطلوب بالإنجليزية والعربية'; }],
    [/^A team needs a name in English and in Arabic/,function(){ return 'الفريق يحتاج اسمًا بالإنجليزية والعربية'; }],
    [/^Another active team already has that name/,function(){ return 'يوجد فريق نشط آخر بهذا الاسم'; }],
    [/^This team still has open work or people/,function(){ return 'لدى هذا الفريق عمل مفتوح أو أشخاص — استخدم «إيقاف»، فهو ينقلهم إلى فريق آخر أولًا'; }],
    [/^Choose another active team to move its open work to/,function(){ return 'اختر فريقًا نشطًا آخر لنقل عمله المفتوح إليه'; }],
    [/^That team is already retired/,function(){ return 'هذا الفريق موقوف بالفعل'; }],
    [/^That is not a team/,function(){ return 'هذا ليس فريقًا'; }],
    [/^The department itself cannot be retired/,function(){ return 'لا يمكن إيقاف الإدارة نفسها'; }],
    [/^A home team must be an active team/,function(){ return 'يجب أن يكون الفريق الأساسي فريقًا نشطًا'; }],
    [/^A person can only assist an active team/,function(){ return 'لا يساند الشخص إلا فريقًا نشطًا'; }],
    [/^That is already their home team/,function(){ return 'هذا هو فريقه الأساسي بالفعل'; }],
    [/^Nobody reports to themselves/,function(){ return 'لا يتبع أحد نفسه'; }],
    [/^Reports-to must be an active person on the team list/,function(){ return 'يجب أن يكون المسؤول المباشر شخصًا نشطًا في قائمة الفريق'; }],
    [/^Choose a home team/,function(){ return 'اختر الفريق الأساسي أولًا — هذا يضعه في قائمة الفريق'; }],
    [/^A department head must be an active person on the team list/,function(){ return 'يجب أن يكون الرئيس شخصًا نشطًا في قائمة الفريق'; }],
    [/^This person heads (.+) — choose a new head first/,function(m){ return 'هذا الشخص يرأس '+m[1]+' — اختر رئيسًا جديدًا أولًا، ثم اجعله غير نشط'; }],
    [/^Reassign this person's open (tasks|projects)/,function(){ return 'أعد إسناد العمل المفتوح لهذا الشخص قبل جعله غير نشط'; }],
    [/^You cannot change your own access/,function(){ return 'لا يمكنك تغيير صلاحياتك بنفسك'; }],
    [/^You can only give access up to your own level/,function(){ return 'لا يمكنك منح صلاحية أعلى من صلاحيتك'; }],
    [/row-level security|permission denied/i,function(){ return 'رفضت قاعدة البيانات التغيير: هذا للمسؤول والمدير فقط'; }]
  ];
  function said(msg){
    var m=String(msg&&msg.message||msg||'');
    if(/row-level security|permission denied/i.test(m)&&!isAr()) m='The database refused the change: this is for an admin or a manager only.';
    if(!isAr()) return m;
    for(var i=0;i<AR.length;i++){ var x=m.match(AR[i][0]); if(x) return AR[i][1](x); }
    return m;
  }

  /* ---------- data (the teams and the roster load for everyone signed in: the pickers need them) ---------- */
  var T={ deps:null, members:[], assists:[], people:[], levels:{}, err:null, busy:false, msgs:{}, showRetired:false };
  window.__v114=T;
  function load(cb){
    var c=client(); if(!c||T.busy) return; T.busy=true;
    var q=function(p){ return p.then(function(r){ if(r&&r.error) throw r.error; return (r&&r.data)||[]; }); };
    Promise.all([
      q(c.from('departments').select('id,code,name_en,name_ar,parent_id,head_member_id,active,sort').order('sort')),
      q(c.from('team_members').select('id,user_id,department_id,reports_to,job_title_en,job_title_ar,active,left_on')),
      q(c.from('team_member_assists').select('member_id,team_id')).catch(function(){ return []; }),
      q(c.from('team_directory').select('*')),
      canManage()? c.rpc('team_access_list').then(function(r){ return (r&&!r.error&&Array.isArray(r.data))?r.data:[]; }) : Promise.resolve([])
    ]).then(function(a){
      T.busy=false; T.err=null; T.deps=a[0]; T.members=a[1]; T.assists=a[2]; T.people=a[3];
      T.levels={}; (a[4]||[]).forEach(function(u){ T.levels[u.id]=u; });
      if(cb) cb(); paint();
    }).catch(function(e){ T.busy=false; T.err=said(e); if(T.deps==null) T.deps=[]; if(cb) cb(); paint(); });
  }
  window.v114Reload=function(){ T.deps=null; load(); };

  function dep(id){ return (T.deps||[]).filter(function(d){ return d.id===id; })[0]||null; }
  function dname(d){ return d?(isAr()?(d.name_ar||d.name_en):(d.name_en||d.name_ar)):'—'; }
  function person(uid){ return (T.people||[]).filter(function(p){ return p.id===uid; })[0]||{}; }
  function member(mid){ return (T.members||[]).filter(function(m){ return m.id===mid; })[0]||null; }
  function memberOf(uid){ return (T.members||[]).filter(function(m){ return m.user_id===uid; })[0]||null; }
  function pname(uid){ var p=person(uid); var n=isAr()?(p.name_ar||p.full_name):(p.full_name||p.name_ar); return n||p.email||'—'; }
  function mname(mid){ var m=member(mid); return m?pname(m.user_id):'—'; }
  function teams(){ return (T.deps||[]).filter(function(d){ return d.parent_id; }); }
  function activeTeams(){ return teams().filter(function(d){ return d.active; }); }
  function department(){ return (T.deps||[]).filter(function(d){ return !d.parent_id; })[0]||null; }
  function assistsOf(mid){ return (T.assists||[]).filter(function(a){ return a.member_id===mid; }).map(function(a){ return a.team_id; }); }

  /* ---------- the team picker for tasks and achievements: home, then assisted, then the rest ---------- */
  window.teamOptionsHtml=function(mid, sel){
    try{
      if(!T.deps){ load(); return ''; }
      var m=member(mid), home=m?m.department_id:null, helps=m?assistsOf(m.id):[];
      var act=(T.deps||[]).filter(function(d){ return d.active; });
      var h=[], a=[], o=[], whole=[];
      act.forEach(function(d){ if(d.id===home) h.push(d); else if(helps.indexOf(d.id)>=0) a.push(d); else if(d.parent_id) o.push(d); else whole.push(d); });
      if(sel && !act.some(function(d){ return d.id===sel; }) && dep(sel)) o.push(dep(sel));   /* a retired team a record already names */
      var opt=function(d){ return '<option value="'+esc(d.id)+'"'+(d.id===(sel||home)?' selected':'')+'>'+esc(dname(d))+(d.active?'':' · '+fl('retired','موقوف'))+'</option>'; };
      var out='';
      if(h.length) out+='<optgroup label="'+esc(fl('Home team','الفريق الأساسي'))+'">'+h.map(opt).join('')+'</optgroup>';
      if(a.length) out+='<optgroup label="'+esc(fl('Teams they assist','فرق يساندها'))+'">'+a.map(opt).join('')+'</optgroup>';
      if(o.length) out+='<optgroup label="'+esc(fl('Other teams','فرق أخرى'))+'">'+o.map(opt).join('')+'</optgroup>';
      /* the department itself, last — a record may name Commercial as a whole, and an edit must not quietly move it */
      if(whole.length) out+='<optgroup label="'+esc(fl('The whole department','الإدارة كاملة'))+'">'+whole.map(opt).join('')+'</optgroup>';
      return out;
    }catch(e){ return ''; }
  };
  window.teamOptionsReady=function(){ return !!(T.deps&&T.deps.length); };

  /* ---------- one write, one answer ---------- */
  function tell(key,text,err){ T.msgs[key]={ text:text, err:!!err, at:Date.now() }; }
  function told(key){ var m=T.msgs[key]; return m?'<div data-v114-msg="'+(m.err?'err':'ok')+'" data-v114-for="'+esc(key)+'" style="margin:6px 0 0;padding:7px 10px;border-radius:.6rem;font-size:12.5px;background:'+(m.err?'#FDECEC':'#EAF6EE')+';color:'+(m.err?'#9B1C1C':'#1E6B3A')+'">'+esc(m.text)+'</div>':''; }
  function after(key,okText){
    return function(r){
      if(r&&r.error){ tell(key,said(r.error),true); }
      else if(r&&Array.isArray(r.data)&&!r.data.length){ tell(key,fl('Not saved — the database did not accept the change.','لم يُحفظ — لم تقبل قاعدة البيانات التغيير.'),true); }
      else tell(key,okText,false);
      load();
    };
  }
  var REC=fl(' Recorded in Activity & Audit.',' سُجّل في السجل.');

  /* ---------- teams ---------- */
  window.v114AddTeam=function(){
    var c=client(); if(!c) return;
    var en=((document.getElementById('v114_team_en')||{}).value||'').trim(), ar=((document.getElementById('v114_team_ar')||{}).value||'').trim();
    if(!en||!ar){ tell('teams',fl('A team needs a name in English and in Arabic.','الفريق يحتاج اسمًا بالإنجليزية والعربية.'),true); paint(); return; }
    c.from('departments').insert({ name_en:en, name_ar:ar }).select('id').then(after('teams',fl('Team “'+en+'” added.','أُضيف الفريق «'+ar+'».')+REC));
  };
  window.v114RenameTeam=function(id){
    var d=dep(id); if(!d) return;
    openModal(fl('Rename team','إعادة تسمية الفريق'),
      '<div class="grid2"><div class="field"><label>'+fl('Name in English','الاسم بالإنجليزية')+'</label><input id="v114_ren_en" value="'+esc(d.name_en)+'"></div>'+
      '<div class="field"><label>'+fl('Name in Arabic','الاسم بالعربية')+'</label><input id="v114_ren_ar" dir="rtl" value="'+esc(d.name_ar)+'"></div></div>'+
      '<div class="note" style="font-size:12px">'+fl('Its history keeps showing under the new name — nothing is copied or lost.','يظهر تاريخه تحت الاسم الجديد — لا يُنسخ شيء ولا يضيع.')+'</div>',
      function(){
        var c=client(); if(!c) return false;
        c.from('departments').update({ name_en:(document.getElementById('v114_ren_en')||{}).value, name_ar:(document.getElementById('v114_ren_ar')||{}).value }).eq('id',id).select('id')
          .then(after('team:'+id,fl('Renamed.','أُعيدت التسمية.')+REC));
        return true;
      });
  };
  window.v114RetireTeam=function(id){
    var d=dep(id); if(!d) return;
    var others=activeTeams().filter(function(x){ return x.id!==id; });
    var people=(T.members||[]).filter(function(m){ return m.department_id===id&&m.active; }).length;
    openModal(fl('Retire “'+d.name_en+'”','إيقاف «'+d.name_ar+'»'),
      '<div class="note">'+fl('A retired team is never deleted: its history stays. Its open tasks and open projects, and the people whose home team it is ('+people+'), move to the team you choose. Assisting it ends.',
                           'الفريق الموقوف لا يُحذف أبدًا: يبقى تاريخه. تنتقل مهامه ومشاريعه المفتوحة، ومن هو فريقهم الأساسي ('+people+')، إلى الفريق الذي تختاره. وتنتهي مساندته.')+'</div>'+
      '<div class="field"><label>'+fl('Move its open work and people to','انقل عمله المفتوح وأشخاصه إلى')+'</label><select id="v114_move_to"><option value="">'+fl('— choose a team —','— اختر فريقًا —')+'</option>'+
        others.map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(dname(x))+'</option>'; }).join('')+'</select></div>',
      function(){
        var to=(document.getElementById('v114_move_to')||{}).value;
        if(!to){ tell('team:'+id,fl('Choose where its open work goes first.','اختر أولًا أين ينتقل عمله المفتوح.'),true); paint(); return true; }
        var c=client(); if(!c) return false;
        c.rpc('team_retire',{ p_team:id, p_move_to:to }).then(function(r){
          if(r.error){ tell('team:'+id,said(r.error),true); load(); return; }
          var x=r.data||{};
          tell('teams',fl('Retired “'+d.name_en+'”: '+(x.tasks||0)+' open task(s), '+(x.projects||0)+' project(s) and '+(x.people||0)+' person/people moved to '+(x.moved_to||'')+'.','أُوقف «'+d.name_ar+'»: نُقلت '+(x.tasks||0)+' مهمة مفتوحة و'+(x.projects||0)+' مشروع و'+(x.people||0)+' شخص.')+REC,false);
          load();
        });
        return true;
      });
  };
  window.v114BringBack=function(id){ var c=client(); if(!c) return; c.from('departments').update({ active:true }).eq('id',id).select('id').then(after('teams',fl('Team brought back.','أُعيد الفريق.')+REC)); };
  window.v114SetHead=function(id,mid){ var c=client(); if(!c) return; c.from('departments').update({ head_member_id:mid||null }).eq('id',id).select('id').then(after('team:'+id,fl('Head set.','عُيّن الرئيس.')+REC)); };
  window.v114ToggleRetired=function(){ T.showRetired=!T.showRetired; paint(); };

  /* ---------- people ---------- */
  var LV=[['none',fl('No access','بلا وصول')],['view',fl('View','عرض')],['own',fl('Own','الخاص')],['full',fl('Full','كامل')]];
  function pageName(p){ try{ var x=(window.PAGES||[]).filter(function(r){ return r[0]===p; })[0]; if(x) return isAr()?(x[2]||x[1]):x[1]; }catch(_){} return ({tasks:['Tasks','المهام'],reports:['Reports','التقارير'],activity:['Activity & Audit','النشاط والتدقيق'],archive:['Archive','الأرشيف']}[p]||[p,p])[isAr()?1:0]; }
  function roleName(r){ return ({admin:fl('Admin','مسؤول'),manager:fl('Manager','مدير'),team_member:fl('Employee','موظف'),viewer:fl('Read only','قراءة فقط')}[r])||r||'—'; }
  function roleOptions(sel){ var list=amAdmin()?['admin','manager','team_member']:['manager','team_member']; if(sel&&list.indexOf(sel)<0) list.unshift(sel);
    return list.map(function(r){ return '<option value="'+r+'"'+(r===sel?' selected':'')+(r==='admin'&&!amAdmin()?' disabled':'')+'>'+esc(roleName(r))+'</option>'; }).join(''); }
  function homeOptions(sel){
    var c=department(); var list=(c?[c]:[]).concat(activeTeams());
    if(sel&&!list.some(function(d){ return d.id===sel; })&&dep(sel)) list.push(dep(sel));
    return '<option value="">'+fl('— choose —','— اختر —')+'</option>'+list.map(function(d){ return '<option value="'+esc(d.id)+'"'+(d.id===sel?' selected':'')+'>'+esc(dname(d))+(d.parent_id?'':' '+fl('(the department — no team yet)','(الإدارة — بلا فريق بعد)'))+'</option>'; }).join('');
  }
  function reportsOptions(selfMid,sel){
    return '<option value="">'+fl('— nobody —','— لا أحد —')+'</option>'+(T.members||[]).filter(function(m){ return m.active&&m.id!==selfMid; })
      .map(function(m){ return '<option value="'+esc(m.id)+'"'+(m.id===sel?' selected':'')+'>'+esc(pname(m.user_id))+'</option>'; }).join('');
  }
  function personForm(uid){
    var p=uid?person(uid):{}, m=uid?memberOf(uid):null, home=m?m.department_id:((department()||{}).id||''), helps=m?assistsOf(m.id):[];
    var head=(department()||{}).head_member_id;
    var lock=uid&&p.role==='admin'&&!amAdmin();
    var dis=lock?' disabled':'';
    var lv=uid?T.levels[uid]:null, own=uid&&window.__userId===uid;
    var h=(lock?'<div class="v107-note note">'+fl('Only an admin changes an admin’s details.','المسؤول وحده يغيّر بيانات مسؤول.')+'</div>':'')+
      '<div class="grid2">'+
      '<div class="field"><label>'+fl('First name (English)','الاسم الأول (إنجليزي)')+'</label><input id="v114_fe" value="'+esc(p.first_name_en||'')+'"'+dis+'></div>'+
      '<div class="field"><label>'+fl('Last name (English)','اسم العائلة (إنجليزي)')+'</label><input id="v114_le" value="'+esc(p.last_name_en||'')+'"'+dis+'></div>'+
      '<div class="field"><label>'+fl('First name (Arabic)','الاسم الأول (عربي)')+'</label><input id="v114_fa" dir="rtl" value="'+esc(p.first_name_ar||'')+'"'+dis+'></div>'+
      '<div class="field"><label>'+fl('Last name (Arabic)','اسم العائلة (عربي)')+'</label><input id="v114_la" dir="rtl" value="'+esc(p.last_name_ar||'')+'"'+dis+'></div>'+
      '<div class="field"><label>'+fl('E-mail (their sign-in)','البريد (دخوله)')+'</label>'+(uid?'<input value="'+esc(p.email||'')+'" disabled title="'+esc(fl('The sign-in address is changed by an admin in the login system.','يغيّر المسؤول عنوان الدخول في نظام الدخول.'))+'">':'<input id="v114_email" type="email" inputmode="email" autocapitalize="none" placeholder="name@directksa.com">')+'</div>'+
      '<div class="field"><label>'+fl('Role','الدور')+'</label><select id="v114_role"'+dis+(own?' disabled':'')+'>'+roleOptions(p.role||'team_member')+'</select></div>'+
      '<div class="field"><label>'+fl('Home team','الفريق الأساسي')+'</label><select id="v114_home"'+dis+'>'+homeOptions(home)+'</select></div>'+
      '<div class="field"><label>'+fl('Reports to','يتبع')+'</label><select id="v114_rep"'+dis+'>'+reportsOptions(m&&m.id,(m?m.reports_to:head)||'')+'</select></div>'+
      '<div class="field"><label>'+fl('Job title (English)','المسمى الوظيفي (إنجليزي)')+'</label><input id="v114_jte" value="'+esc(m&&m.job_title_en||'')+'"'+dis+'></div>'+
      '<div class="field"><label>'+fl('Job title (Arabic)','المسمى الوظيفي (عربي)')+'</label><input id="v114_jta" dir="rtl" value="'+esc(m&&m.job_title_ar||'')+'"'+dis+'></div>'+
      '</div>'+
      '<div class="field"><label>'+fl('Teams they assist','الفرق التي يساندها')+'</label><div data-v114-assists="1" style="display:flex;flex-wrap:wrap;gap:6px 14px">'+
        activeTeams().map(function(d){ return '<label style="display:flex;gap:6px;align-items:center;font-weight:500;text-transform:none;letter-spacing:0"><input type="checkbox" data-v114-assist="'+esc(d.id)+'"'+(helps.indexOf(d.id)>=0?' checked':'')+dis+'> '+esc(dname(d))+'</label>'; }).join('')+'</div></div>';
    if(!uid) h+='<div class="field"><label>'+fl('Password (optional)','كلمة المرور (اختياري)')+'</label><input id="v114_pw" autocomplete="new-password" placeholder="'+esc(fl('Leave blank — the app makes a temporary one they change at first sign-in','اتركها فارغة — يصنع التطبيق واحدة مؤقتة يغيّرها أول دخول'))+'"></div>';
    if(uid && p.role!=='admin'){
      var L=(lv&&lv.levels)||{};
      h+='<h4 style="margin:12px 0 6px">'+fl('Page levels','مستويات الصفحات')+'</h4>'+(own?'<div class="note" style="font-size:12px">'+fl('Nobody changes their own access — another admin or manager does.','لا يغيّر أحد صلاحياته بنفسه — يغيّرها مسؤول أو مدير آخر.')+'</div>':'')+
        '<div class="v114-levels" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 12px">'+
        Object.keys(L).map(function(pg){ return '<label style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-weight:500;text-transform:none;letter-spacing:0;font-size:12.5px">'+esc(pageName(pg))+
          '<select data-v114-level="'+esc(pg)+'"'+((own||lock)?' disabled':'')+' style="min-width:110px">'+LV.map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===L[pg]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select></label>'; }).join('')+'</div>';
    }
    h+='<div id="v114_msg" style="font-size:12.5px;color:#9B1C1C;margin-top:6px"></div>';
    return h;
  }
  function readForm(){
    var v=function(id){ var e=document.getElementById(id); return e?String(e.value||'').trim():''; };
    var assists=[].slice.call(document.querySelectorAll('[data-v114-assist]')).filter(function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-v114-assist'); });
    var levels={}; [].slice.call(document.querySelectorAll('[data-v114-level]')).forEach(function(s){ levels[s.getAttribute('data-v114-level')]=s.value; });
    return { first_name_en:v('v114_fe'), last_name_en:v('v114_le'), first_name_ar:v('v114_fa'), last_name_ar:v('v114_la'), email:v('v114_email').toLowerCase(),
             role:v('v114_role'), home_team:v('v114_home'), reports_to:v('v114_rep'), job_title_en:v('v114_jte'), job_title_ar:v('v114_jta'), assists:assists, levels:levels, pw:v('v114_pw') };
  }
  function formMsg(t){ var e=document.getElementById('v114_msg'); if(e) e.textContent=t; }
  /* save the person in steps, each answered by the database; stop at the first refusal and say which step */
  function savePerson(uid,f,done){
    var c=client(); if(!c) return;
    var p=person(uid), lv=T.levels[uid], steps=[];
    steps.push(function(){ return c.rpc('person_save',{ p_user:uid, p:{ first_name_en:f.first_name_en, last_name_en:f.last_name_en, first_name_ar:f.first_name_ar, last_name_ar:f.last_name_ar,
      home_team:f.home_team, reports_to:f.reports_to, job_title_en:f.job_title_en, job_title_ar:f.job_title_ar, assists:f.assists } }); });
    if(f.role && f.role!==p.role && window.__callAdmin) steps.push(function(){ return window.__callAdmin({ action:'set_role', id:uid, role:f.role }).then(function(r){ return r&&r.error?{ error:{ message:r.error } }:{ data:r }; }); });
    if(lv && Object.keys(f.levels).length && JSON.stringify(f.levels)!==JSON.stringify(lv.levels||{}) && p.role!=='admin')
      steps.push(function(){ return c.rpc('set_page_levels',{ target:uid, levels:f.levels }); });
    var i=0;
    (function next(){
      if(i>=steps.length){ done(null); return; }
      steps[i++]().then(function(r){ if(r&&r.error){ done(said(r.error)); return; } next(); }).catch(function(e){ done(said(e)); });
    })();
  }
  window.v114EditPerson=function(uid){
    openModal(fl('Edit ','تعديل ')+esc(pname(uid)),personForm(uid),function(){
      var f=readForm();
      if(!f.first_name_en||!f.first_name_ar){ formMsg(fl('A first name is needed in English and in Arabic.','الاسم الأول مطلوب بالإنجليزية والعربية.')); return false; }
      if(!f.home_team){ formMsg(fl('Choose a home team.','اختر الفريق الأساسي.')); return false; }
      savePerson(uid,f,function(err){
        if(err){ formMsg(err); load(); return; }
        try{ closeModal(); }catch(_){}
        tell('person:'+uid,fl('Saved.','حُفظ.')+REC,false); load();
      });
      return false;
    });
  };
  window.v114Invite=function(){
    openModal(fl('Invite someone','دعوة شخص'),personForm(null),function(){
      var f=readForm();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)){ formMsg(fl('Enter their work e-mail.','أدخل بريد العمل.')); return false; }
      if(!f.first_name_en||!f.first_name_ar){ formMsg(fl('A first name is needed in English and in Arabic.','الاسم الأول مطلوب بالإنجليزية والعربية.')); return false; }
      if(!f.home_team){ formMsg(fl('Choose a home team.','اختر الفريق الأساسي.')); return false; }
      if(!window.__callAdmin){ formMsg(fl('The team tools are not ready — reload and try again.','أدوات الفريق غير جاهزة — أعد التحميل وحاول مجددًا.')); return false; }
      formMsg(fl('Creating the login…','جارٍ إنشاء حساب الدخول…'));
      window.__callAdmin({ action:'create', email:f.email, full_name:(f.first_name_en+' '+f.last_name_en).trim(), role:f.role||'team_member', password:f.pw||'' }).then(function(r){
        if(!r||r.error){ formMsg(said((r&&r.error)||'')); return; }
        var pw=r.temp_password, permanent=r.permanent;
        load(function(){
          var p=(T.people||[]).filter(function(x){ return String(x.email||'').toLowerCase()===f.email; })[0];
          if(!p){ formMsg(fl('The login was made, but it did not appear in the team list — reload the page.','أُنشئ الحساب لكنه لم يظهر في قائمة الفريق — أعد تحميل الصفحة.')); return; }
          f.levels={};   /* a new person starts from their role's levels; change them afterwards if needed */
          savePerson(p.id,f,function(err){
            if(err){ formMsg(fl('The login was made; saving the rest was refused: ','أُنشئ الحساب؛ ورُفض حفظ الباقي: ')+err); load(); return; }
            try{ closeModal(); }catch(_){}
            tell('people',fl('Invited '+f.email+'. ','تمت دعوة '+f.email+'. ')+(permanent?fl('They sign in with the password you typed.','يدخل بكلمة المرور التي كتبتها.'):fl('Temporary password: ','كلمة مرور مؤقتة: ')+pw+fl(' — hand it over yourself; they choose their own at first sign-in.',' — سلّمها بنفسك؛ ويختار كلمته عند أول دخول.'))+REC,false);
            load();
          });
        });
      });
      return false;
    });
  };
  window.v114SetOnList=function(mid,on){ var c=client(); if(!c) return;
    var go=function(){ c.from('team_members').update({ active:!!on }).eq('id',mid).select('id').then(after('person:'+((member(mid)||{}).user_id),on?fl('Back on the team list.','عاد إلى قائمة الفريق.')+REC:fl('Made inactive — they stay in the history.','أصبح غير نشط — ويبقى في السجل.')+REC)); };
    if(on){ go(); return; }   // 2026-09-28 (D19): making someone inactive asks first, naming them; no box, no change
    if(typeof window.pfConfirm==='function') window.pfConfirm(fl('Remove "'+mname(mid)+'" from the active team list? They become inactive and stay in the history.','إزالة «'+mname(mid)+'» من قائمة الفريق النشطة؟ يصبح غير نشط ويبقى في السجل.'),go,{danger:true});
  };

  /* ---------- the page ---------- */
  function html(){
    var ar=isAr();
    var h='<div class="v114" dir="'+(ar?'rtl':'ltr')+'">';
    h+='<div class="ch-sub" style="margin-bottom:12px">'+fl('Only an admin or a manager changes people and teams — the database refuses anyone else — and every change is recorded in Activity & Audit. Nobody is deleted: someone who leaves is made inactive, and a team is retired, so their history stays.',
      'لا يغيّر الأشخاص والفرق إلا المسؤول أو المدير — وقاعدة البيانات ترفض غيرهما — وكل تغيير يُسجَّل في السجل. لا يُحذف أحد: من يغادر يصبح غير نشط، والفريق يُوقف، فيبقى تاريخهم.')+'</div>';
    if(T.err) h+='<div class="card" style="border-color:#F3C9C6;background:#FDECEB;color:#8A1C1C" data-v114-error="1">'+fl('Could not read people and teams: ','تعذّرت قراءة الأشخاص والفرق: ')+esc(T.err)+'</div>';
    if(T.deps==null) return h+'<div class="card" style="padding:18px;color:var(--muted)">'+fl('Loading…','جارٍ التحميل…')+'</div></div>';

    /* teams */
    var d=department(), act=activeTeams(), ret=teams().filter(function(x){ return !x.active; });
    var actMembers=(T.members||[]).filter(function(m){ return m.active; });
    var headSel=function(x){ return '<select class="inp" data-v114-head="'+esc(x.code)+'" onchange="v114SetHead(\''+esc(x.id)+'\',this.value)"><option value="">'+fl('— nobody —','— لا أحد —')+'</option>'+
      actMembers.map(function(m){ return '<option value="'+esc(m.id)+'"'+(m.id===x.head_member_id?' selected':'')+'>'+esc(pname(m.user_id))+'</option>'; }).join('')+'</select>'; };
    h+='<h3 class="finh" style="margin:0 0 6px">'+fl('Teams','الفرق')+'</h3>';
    if(d) h+='<div class="note" style="font-size:12.5px;margin-bottom:8px">'+fl('Department','الإدارة')+': <b>'+esc(dname(d))+'</b> · '+fl('head','الرئيس')+': '+headSel(d)+told('team:'+d.id)+'</div>';
    h+=told('teams');
    h+='<div class="card" style="padding:0;overflow-x:auto"><table class="tbl" data-v114-teams="1" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
      '<th style="text-align:start;padding:9px 12px">'+fl('Team','الفريق')+'</th><th style="text-align:start;padding:9px 12px">'+fl('People','الأشخاص')+'</th><th style="text-align:start;padding:9px 12px">'+fl('Head','الرئيس')+'</th><th style="padding:9px 12px"></th></tr></thead><tbody>';
    act.forEach(function(x){
      var home=actMembers.filter(function(m){ return m.department_id===x.id; }).length, help=(T.assists||[]).filter(function(a){ return a.team_id===x.id; }).length;
      h+='<tr data-v114-team="'+esc(x.code)+'" style="border-top:1px solid var(--line,#EDE2DA)"><td style="padding:8px 12px"><b>'+esc(x.name_en)+'</b> · <span dir="rtl">'+esc(x.name_ar)+'</span>'+told('team:'+x.id)+'</td>'+
        '<td style="padding:8px 12px;font-size:12.5px">'+home+' '+fl('home','أساسي')+(help?' · '+help+' '+fl('assisting','مساند'):'')+'</td><td style="padding:8px 12px">'+headSel(x)+'</td>'+
        '<td style="padding:8px 12px;white-space:nowrap;text-align:end"><button class="btn sm" onclick="v114RenameTeam(\''+esc(x.id)+'\')">'+fl('Rename','إعادة تسمية')+'</button> <button class="btn sm" data-v114-retire="'+esc(x.code)+'" onclick="v114RetireTeam(\''+esc(x.id)+'\')">'+fl('Retire','إيقاف')+'</button></td></tr>';
    });
    h+='</tbody></table></div>';
    h+='<div class="card" style="padding:10px 12px;margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center" data-v114-addteam="1"><b style="font-size:13px">'+fl('Add a team','إضافة فريق')+'</b>'+
      '<input class="inp" id="v114_team_en" placeholder="'+esc(fl('Name in English','الاسم بالإنجليزية'))+'" style="min-width:180px"><input class="inp" id="v114_team_ar" dir="rtl" placeholder="'+esc(fl('Name in Arabic','الاسم بالعربية'))+'" style="min-width:180px">'+
      '<button class="btn pri sm" onclick="v114AddTeam()">'+fl('Add','إضافة')+'</button></div>';
    if(ret.length){
      h+='<div style="margin-top:8px;font-size:12.5px"><a href="#" onclick="v114ToggleRetired();return false">'+(T.showRetired?fl('Hide','إخفاء'):fl('Show','عرض'))+' '+fl('retired teams','الفرق الموقوفة')+' ('+ret.length+')</a></div>';
      if(T.showRetired) h+='<div class="card" style="padding:8px 12px;margin-top:6px" data-v114-retired="1">'+ret.map(function(x){ return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">'+esc(dname(x))+' <button class="btn sm" onclick="v114BringBack(\''+esc(x.id)+'\')">'+fl('Bring back','إعادة')+'</button></div>'; }).join('')+'</div>';
    }

    /* people */
    var list=(T.people||[]).slice().sort(function(a,b){ var ma=memberOf(a.id), mb=memberOf(b.id); return ((mb&&mb.active)?1:0)-((ma&&ma.active)?1:0) || pname(a.id).localeCompare(pname(b.id)); });
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 6px"><h3 class="finh" style="margin:0">'+fl('People','الأشخاص')+'</h3><button class="btn pri sm" data-v114-invite="1" onclick="v114Invite()">'+fl('Invite someone','دعوة شخص')+'</button></div>'+told('people');
    h+='<div class="card" style="padding:0;overflow-x:auto"><table class="tbl" data-v114-people="1" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
      ['Person|الشخص','Role|الدور','Home team|الفريق الأساسي','Assists|يساند','Reports to|يتبع','Team list|قائمة الفريق',''].map(function(t){ var x=t.split('|'); return '<th style="text-align:start;padding:9px 12px">'+esc(x[0]?fl(x[0],x[1]):'')+'</th>'; }).join('')+'</tr></thead><tbody>';
    list.forEach(function(p){
      var m=memberOf(p.id), helps=m?assistsOf(m.id).map(function(t){ return dname(dep(t)); }):[];
      var other=isAr()?p.full_name:p.name_ar;
      h+='<tr data-v114-person="'+esc(p.email||p.id)+'" style="border-top:1px solid var(--line,#EDE2DA)'+((m&&m.active)||(!m&&p.active)?'':';opacity:.65')+'">'+
        '<td style="padding:8px 12px"><div style="font-weight:600">'+esc(pname(p.id))+'</div>'+(other?'<div style="font-size:11.5px;color:var(--muted)">'+esc(other)+'</div>':'')+'<div style="font-size:11.5px;color:var(--muted)">'+esc(p.email||'')+(m&&(isAr()?m.job_title_ar:m.job_title_en)?' · '+esc(isAr()?m.job_title_ar:m.job_title_en):'')+'</div>'+told('person:'+p.id)+'</td>'+
        '<td style="padding:8px 12px">'+esc(roleName(p.role))+(p.active?'':' · <span class="tag">'+fl('login off','الدخول معطّل')+'</span>')+'</td>'+
        '<td style="padding:8px 12px">'+(m?esc(dname(dep(m.department_id))):'<span style="color:var(--muted)">'+fl('not on the team list','ليس في قائمة الفريق')+'</span>')+'</td>'+
        '<td style="padding:8px 12px;font-size:12.5px">'+esc(helps.join(', ')||'—')+'</td>'+
        '<td style="padding:8px 12px;font-size:12.5px">'+esc(m&&m.reports_to?mname(m.reports_to):'—')+'</td>'+
        '<td style="padding:8px 12px">'+(m?(m.active?'<span class="tag" style="background:#EAF6EE;color:#1E6B3A">'+fl('Active','نشط')+'</span> <button class="btn sm" onclick="v114SetOnList(\''+esc(m.id)+'\',false)">'+fl('Make inactive','اجعله غير نشط')+'</button>'
                                                      :'<span class="tag">'+fl('Inactive','غير نشط')+(m.left_on?' · '+esc(m.left_on):'')+'</span> <button class="btn sm" onclick="v114SetOnList(\''+esc(m.id)+'\',true)">'+fl('Make active','اجعله نشطًا')+'</button>'):'—')+'</td>'+
        '<td style="padding:8px 12px;text-align:end"><button class="btn sm" data-v114-edit="'+esc(p.email||p.id)+'" onclick="v114EditPerson(\''+esc(p.id)+'\')">'+fl('Edit','تعديل')+'</button></td></tr>';
    });
    h+='</tbody></table></div></div>';
    return h;
  }
  function paint(){try{
    if(typeof current==='undefined'||current!==PAGE) return;
    var v=document.getElementById('view'); if(!v) return;
    try{ document.getElementById('vTitle').textContent=fl('People & teams','الأشخاص والفرق'); document.getElementById('vSub').textContent=fl('Who is on the team, their teams, their access','من في الفريق وفرقهم وصلاحياتهم'); }catch(_){}
    if(!canManage()){ v.innerHTML='<div class="card" data-v114-refused="1">'+fl('People & teams is for an admin or a manager.','صفحة الأشخاص والفرق للمسؤول أو المدير.')+'</div>'; return; }
    if(T.deps==null&&!T.busy) load();
    v.innerHTML=html();
  }catch(e){ if(window.console) console.warn('[people] paint',e); }}
  window.__v114Paint=paint;

  /* ---------- the menu button (admins and managers) ---------- */
  function navButton(){try{
    if(window.__isShareView) return;
    var nav=document.getElementById('nav'); if(!nav||!nav.querySelector('button')) return;
    var b=document.getElementById('v114NavBtn');
    if(!b){
      b=document.createElement('button'); b.id='v114NavBtn'; b.setAttribute('data-v114-nav',PAGE);
      b.innerHTML='<span style="display:inline-block;width:18px;text-align:center">👥</span><span class="v114-lbl"></span>';
      b.onclick=function(){ try{ current=PAGE; openLead=null; render(); window.scrollTo(0,0); if(typeof closeSide==='function')closeSide(); }catch(_){} };
      nav.appendChild(b);
    }
    var sp=b.querySelector('.v114-lbl'), want=fl('People & teams','الأشخاص والفرق'); if(sp&&sp.textContent!==want) sp.textContent=want;
    b.className=(typeof current!=='undefined'&&current===PAGE)?'active':'';
    b.style.display=canManage()?'':'none';
  }catch(_){}}

  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){ var o=_r.apply(this,arguments); try{ Object.keys(T.msgs).forEach(function(k){ if(Date.now()-T.msgs[k].at>4000) delete T.msgs[k]; }); if(current===PAGE) paint(); setTimeout(navButton,60); }catch(_){} return o; };
    },200);
  }catch(_){}
  /* the teams and the roster load once someone is signed in — the task and achievement pickers need them */
  var tries=0, li=setInterval(function(){ tries++; if(tries>120){ clearInterval(li); return; } if(window.__roleKnown===true&&client()){ clearInterval(li); load(); navButton(); } },500);
  setTimeout(navButton,900); setTimeout(navButton,2600);
  console.info('%c[people] People & teams loaded','color:#175CD3;font-weight:700');
}catch(e){ if(window.console) console.warn('[people] init',e); }})();
