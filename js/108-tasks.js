/* ===== js/108 — the Tasks page (Phase 3, release 1: tasks + projects), 2026-09-25 =====

   The task manager lives inside this app (CLAUDE.md rule 8, DECISIONS D1) on the tables of
   scripts/sql/phase3-r1-task-manager.sql. This file draws them: a list of tasks (mine / everyone's,
   by status, by search), the work projects they sit in, a form for a new task or project, and a task's
   card — its status, dates, checklist and comments.

   Who may do what is decided by the DATABASE, never here (M57). The screen only asks the same
   question to decide what to offer: pageLevel('tasks') (js/52, from page_level()):
     · none — the page is not in the menu and the database returns no rows;
     · view — everything readable, nothing offered to change (the database refuses anyway);
     · own  — new tasks for yourself, and changes to tasks you own, created, were handed or help on;
     · full — the D7 default: anyone on the team may help on any task; every change is recorded and
       the owner is told on Today (js/109, changes_to_my_tasks).
   When the database refuses something (a guard's message, e.g. "Client work needs a company or a
   project", or a row-level refusal), the refusal is shown in words and nothing is drawn as saved.

   Money never appears here (M1): tasks and projects carry none. Codes (TSK-2026-001, PRJ-2026-001) come
   from the database's own numbering, never typed. Names come from team_directory, the same roster the
   Leads/Clients owner fields use. Removing this file removes the page; the tables stay. */
(function(){try{
  var PAGE='tasks';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc8(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function level(){ try{ return typeof window.pageLevel==='function' ? window.pageLevel(PAGE) : null; }catch(_){ return null; } }
  function canWork(){ var l=level(); return l==='own'||l==='full'; }
  function isFull(){ return level()==='full'; }
  try{ if(typeof TITLES==='object') TITLES.tasks=['Tasks','Your work and your team’s — tasks, projects, who is on what']; }catch(_){}

  var S={ loaded:false, loading:false, err:null, uid:null,
          tasks:[], projects:[], statuses:[], priorities:[], workTypes:[], members:[], names:{},
          tab:'tasks', mine:true, status:'open', q:'', open:null, detail:null };
  window.__v108State=S;

  function nm(row){ return row ? (isAr() ? (row.name_ar||row.name_en||row.code) : (row.name_en||row.code)) : ''; }
  function statusRow(code){ return S.statuses.filter(function(s){ return s.code===code; })[0]; }
  function member(id){ return S.members.filter(function(m){ return m.id===id; })[0]; }
  function memberName(id){ var m=member(id); if(!m) return '—'; var n=S.names[m.user_id]; return n ? (isAr()&&n.ar ? n.ar : n.en) : '—'; }
  function myMember(){ return S.members.filter(function(m){ return m.user_id===S.uid && m.active; })[0]||null; }
  function companyName(uuid){
    if(!uuid) return '';
    try{
      var m=window.__ROWID||{};
      for(var k in m){ if(Object.prototype.hasOwnProperty.call(m,k) && m[k]===uuid){ var b=(typeof getLead==='function')?getLead(k):null; if(b) return b.name; } }
      var b2=(typeof getLead==='function')?getLead(uuid):null; if(b2) return b2.name;
    }catch(_){}
    return fl('(company not loaded)','(الشركة غير محمّلة)');
  }
  function projectOf(id){ return S.projects.filter(function(p){ return p.id===id; })[0]; }
  function fmtDate(d){ if(!d) return ''; try{ return String(d).slice(0,10); }catch(_){ return ''; } }
  /* today on the user's own calendar (todayISO, core) — never UTC, which in Riyadh is yesterday until 3 am */
  function todayLocal(){ try{ if(typeof todayISO==='function') return todayISO(); }catch(_){} var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function overdue(t){ var st=statusRow(t.status); if(!t.due_date||(st&&st.is_closed)) return false; return String(t.due_date) < todayLocal(); }
  /* may this person change THIS task? the database's rule, asked the same way: full → any; own → theirs */
  function mayEditTask(t){
    if(isFull()) return true;
    if(!canWork()) return false;
    var me=myMember(); if(!me||!t) return false;
    return t.owner_id===me.id || t.created_by===me.id || t.assigned_by===me.id;
  }

  function note(msg,bad){
    try{ if(typeof window.toast==='function'){ window.toast(msg); return; } }catch(_){}
    try{ if(bad) alert(msg); }catch(_){}
  }
  function refusal(err){
    var m=String((err&&err.message)||err||'');
    if(/row-level security|permission denied|42501/i.test(m) || (err&&err.code==='42501'))
      return fl('The database refused this — it is not part of your access on Tasks.','رفضت قاعدة البيانات هذا الإجراء — ليس ضمن صلاحيتك على صفحة المهام.');
    return m || fl('The change was not saved.','لم يُحفظ التغيير.');
  }

  /* ---------- load ---------- */
  function load(force){
    if(S.loading) return; if(S.loaded && !force) return;
    var c=client(); if(!c) return;
    if(level()===null) return;                 /* the answer is not in yet — js/56 re-draws when it is */
    S.loading=true; S.err=null;
    var q=function(p){ return p.then(function(r){ if(r&&r.error) throw r.error; return (r&&r.data)||[]; }); };
    Promise.all([
      c.auth.getSession().then(function(r){ return r&&r.data&&r.data.session&&r.data.session.user ? r.data.session.user.id : null; }),
      q(c.from('tasks').select('id,code,title,description,status,priority,work_type,owner_id,business_id,project_id,parent_task_id,due_date,start_date,done_at,created_at,created_by,assigned_by,updated_at,include_in_report,report_category_id').is('deleted_at',null).order('created_at',{ascending:false}).limit(1000)),
      q(c.from('projects').select('id,code,name,business_id,owner_id,status,work_type,due_date,created_by,created_at').is('deleted_at',null).order('created_at',{ascending:false}).limit(500)),
      q(c.from('task_statuses').select('*').order('sort')),
      q(c.from('priorities').select('*').order('sort')),
      q(c.from('work_types').select('*').order('sort')),
      q(c.from('team_members').select('id,user_id,department_id,active')),
      q(c.from('team_directory').select('id,full_name,name_ar')),
      /* release 2: the kinds of achievement, for "count this in the monthly report" */
      q(c.from('report_categories').select('id,code,name_en,name_ar,active,sort').order('sort')).catch(function(){ return []; })
    ]).then(function(a){
      S.uid=a[0]; S.tasks=a[1]; S.projects=a[2]; S.statuses=a[3]; S.priorities=a[4]; S.workTypes=a[5]; S.members=a[6];
      S.names={}; a[7].forEach(function(u){ S.names[u.id]={en:u.full_name||'', ar:u.name_ar||''}; });
      S.repCats=a[8]||[];
      S.loaded=true; S.loading=false;
      if(current===PAGE) draw();
    }).catch(function(e){
      S.loading=false; S.err=e; S.loaded=false;
      if(current===PAGE) draw();
    });
  }

  /* ---------- draw ---------- */
  function chip(label,on,handler,data){ return '<button class="v26_3-chip'+(on?' active':'')+'" '+(data||'')+' onclick="'+handler+'">'+label+'</button>'; }
  function visibleTasks(){
    var me=myMember(), q=S.q.trim().toLowerCase();
    return S.tasks.filter(function(t){
      if(S.mine && (!me || (t.owner_id!==me.id && t.created_by!==me.id))) return false;
      var st=statusRow(t.status);
      if(S.status==='open' && st && st.is_closed) return false;
      if(S.status==='done' && !(st && st.is_done)) return false;
      if(S.status==='overdue' && !overdue(t)) return false;
      if(q){ var hay=(t.code+' '+t.title+' '+companyName(t.business_id)+' '+memberName(t.owner_id)).toLowerCase(); if(hay.indexOf(q)<0) return false; }
      return true;
    }).sort(function(a,b){ return String(a.due_date||'9999').localeCompare(String(b.due_date||'9999')) || String(b.created_at).localeCompare(String(a.created_at)); });
  }
  function draw(){try{
    var v=document.getElementById('view'); if(!v) return;
    try{ document.getElementById('vTitle').textContent=fl('Tasks','المهام'); document.getElementById('vSub').textContent=fl('Your work and your team’s','عملك وعمل فريقك'); }catch(_){}
    var ar=isAr(), h='';
    h+='<div class="v108" dir="'+(ar?'rtl':'ltr')+'">';
    if(S.err){
      h+='<div class="card v108-error" style="border-color:#F3C9C6;background:#FDECEB;color:#8A1C1C">'+
         fl('Tasks could not be loaded — nothing below is a real "none". ','تعذّر تحميل المهام — ما يظهر ليس «لا شيء» حقيقيًا. ')+
         esc8(refusal(S.err))+' <button class="btn sm" onclick="v108Reload()">'+fl('Try again','أعد المحاولة')+'</button></div></div>';
      v.innerHTML=h; return;
    }
    if(!S.loaded){ v.innerHTML=h+'<div class="card">'+fl('Loading tasks…','جارٍ تحميل المهام…')+'</div></div>'; load(); return; }
    var lv=level();
    if(lv==='view') h+='<div class="v107-banner" dir="'+(ar?'rtl':'ltr')+'">'+fl('View only — you can look through Tasks and export them; changes need Own work or Full control.','مشاهدة فقط — يمكنك تصفّح المهام وتصديرها؛ التعديل يحتاج «عمله فقط» أو «تحكم كامل».')+'</div>';
    /* no screen manages the team list yet (release 1 fills it once, from the logins) — so this says who
       to ask, not where to click */
    if(canWork() && !myMember()) h+='<div class="v107-banner">'+fl('Your login is not on the team list yet, so no task can be yours and New is not offered. Ask an admin to add you to the team list.','حسابك غير مضاف إلى قائمة الفريق بعد، لذا لا يمكن أن تُسند إليك مهمة ولا يظهر زر «جديد». اطلب من المسؤول إضافتك إلى قائمة الفريق.')+'</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px">'+
       chip(fl('Tasks','المهام'),S.tab==='tasks',"v108Tab('tasks')",'data-v108-tab="tasks"')+
       chip(fl('Projects','المشاريع'),S.tab==='projects',"v108Tab('projects')",'data-v108-tab="projects"')+'</div>';
    h+= S.tab==='projects' ? drawProjects() : drawTasks();
    h+='</div>';
    v.innerHTML=h;
  }catch(e){ if(window.console)console.warn('[v108] draw',e); }}

  function drawTasks(){
    var rows=visibleTasks(), h='';
    h+='<div class="card" style="padding:12px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
       chip(fl('Mine','مهامي'),S.mine,"v108Mine(true)",'data-v108-mine="1"')+chip(fl('Everyone’s','الجميع'),!S.mine,"v108Mine(false)",'data-v108-mine="0"')+
       '<span style="width:10px"></span>'+
       ['open','overdue','done','all'].map(function(k){ var L={open:fl('Open','مفتوحة'),overdue:fl('Overdue','متأخرة'),done:fl('Done','منجزة'),all:fl('All','الكل')}[k];
         return chip(L,S.status===k,"v108Status('"+k+"')",'data-v108-status="'+k+'"'); }).join('')+
       '<input class="inp" id="v108q" placeholder="'+esc8(fl('Search tasks…','ابحث في المهام…'))+'" value="'+esc8(S.q)+'" oninput="v108Search(this.value)" style="flex:1;min-width:160px">'+
       (canWork()&&myMember()?'<button class="btn pri" data-v108-new="task" onclick="v108NewTask()">'+fl('+ New task','+ مهمة جديدة')+'</button>':'')+
       '</div>';
    if(!rows.length){
      h+='<div class="card v108-empty">'+(S.tasks.length ? fl('No task matches these filters — '+S.tasks.length+' task(s) hidden by them.','لا توجد مهمة تطابق هذه التصفية — '+S.tasks.length+' مهمة مخفية بها.')
                                                         : fl('No tasks yet.','لا توجد مهام بعد.'))+'</div>';
      return h;
    }
    h+='<div class="card" style="padding:0"><div class="tbl-wrap"><table class="v108-tasks"><thead><tr>'+
       '<th>'+fl('Task','المهمة')+'</th><th>'+fl('Company / project','الشركة / المشروع')+'</th><th>'+fl('Owner','المسؤول')+'</th><th>'+fl('Due','الاستحقاق')+'</th><th>'+fl('Status','الحالة')+'</th></tr></thead><tbody>';
    rows.forEach(function(t){
      var p=t.project_id?projectOf(t.project_id):null, st=statusRow(t.status), pr=S.priorities.filter(function(x){return x.code===t.priority;})[0];
      h+='<tr data-v108-task="'+esc8(t.id)+'" style="cursor:pointer" onclick="v108Open(\''+esc8(t.id)+'\')">'+
         '<td><b>'+esc8(t.title)+'</b><div style="font-size:11.5px;color:var(--muted)">'+esc8(t.code)+(pr&&t.priority!=='normal'?' · '+esc8(nm(pr)):'')+'</div></td>'+
         '<td>'+esc8(companyName(t.business_id))+(p?'<div style="font-size:11.5px;color:var(--muted)">'+esc8(p.code+' · '+p.name)+'</div>':'')+'</td>'+
         '<td>'+esc8(memberName(t.owner_id))+'</td>'+
         '<td'+(overdue(t)?' style="color:#D90B0B;font-weight:700"':'')+'>'+esc8(fmtDate(t.due_date))+'</td>'+
         '<td>'+esc8(nm(st)||t.status)+'</td></tr>';
    });
    h+='</tbody></table></div></div>';
    return h;
  }

  function drawProjects(){
    var h='<div class="card" style="padding:12px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
          '<span style="flex:1;color:var(--muted);font-size:12.5px">'+fl('Work projects group tasks for one company or an internal goal. (Travel engagements stay on the Projects page.)','مشاريع العمل تجمع مهام شركة واحدة أو هدف داخلي. (مشاريع الرحلات تبقى في صفحة المشاريع.)')+'</span>'+
          (canWork()&&myMember()?'<button class="btn pri" data-v108-new="project" onclick="v108NewProject()">'+fl('+ New project','+ مشروع جديد')+'</button>':'')+'</div>';
    if(!S.projects.length) return h+'<div class="card v108-empty">'+fl('No work projects yet.','لا توجد مشاريع عمل بعد.')+'</div>';
    h+='<div class="card" style="padding:0"><div class="tbl-wrap"><table class="v108-projects"><thead><tr><th>'+fl('Project','المشروع')+'</th><th>'+fl('Company','الشركة')+'</th><th>'+fl('Owner','المسؤول')+'</th><th>'+fl('Open tasks','المهام المفتوحة')+'</th><th>'+fl('Status','الحالة')+'</th></tr></thead><tbody>';
    S.projects.forEach(function(p){
      var open=S.tasks.filter(function(t){ var st=statusRow(t.status); return t.project_id===p.id && !(st&&st.is_closed); }).length;
      h+='<tr data-v108-project="'+esc8(p.id)+'"><td><b>'+esc8(p.name)+'</b><div style="font-size:11.5px;color:var(--muted)">'+esc8(p.code)+'</div></td><td>'+esc8(p.business_id?companyName(p.business_id):fl('Internal','داخلي'))+'</td><td>'+esc8(memberName(p.owner_id))+'</td><td>'+open+'</td><td>'+esc8(p.status)+'</td></tr>';
    });
    return h+'</tbody></table></div></div>';
  }

  /* ---------- actions (the database decides; these only ask) ---------- */
  window.v108Reload=function(){ S.loaded=false; S.err=null; load(true); draw(); };
  window.v108Tab=function(t){ S.tab=t; draw(); };
  window.v108Mine=function(b){ S.mine=!!b; draw(); };
  window.v108Status=function(k){ S.status=k; draw(); };
  window.v108Search=function(val){ S.q=String(val||''); var pos=null; try{ pos=document.getElementById('v108q').selectionStart; }catch(_){} draw(); try{ var i=document.getElementById('v108q'); i.focus(); if(pos!=null)i.setSelectionRange(pos,pos); }catch(_){} };

  function companyOptions(sel){
    var o='<option value="">'+fl('— none (internal work) —','— بدون (عمل داخلي) —')+'</option>';
    try{ (DB.businesses||[]).filter(function(b){ return !b.archived; }).slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); }).forEach(function(b){
      var u=(window.__bizUuid?window.__bizUuid(b.id):b.id); o+='<option value="'+esc8(u)+'"'+(u===sel?' selected':'')+'>'+esc8(b.name)+(b.isClient?'':' · '+fl('lead','عميل محتمل'))+'</option>'; }); }catch(_){}
    return o;
  }
  function optionList(rows,sel){ return rows.map(function(r){ return '<option value="'+esc8(r.code)+'"'+(r.code===sel?' selected':'')+'>'+esc8(nm(r))+'</option>'; }).join(''); }
  function memberOptions(sel){
    return S.members.filter(function(m){ return m.active; }).map(function(m){ return '<option value="'+esc8(m.id)+'"'+(m.id===sel?' selected':'')+'>'+esc8(memberName(m.id))+'</option>'; }).join('');
  }
  function projectOptions(sel){
    return '<option value="">'+fl('— no project —','— بدون مشروع —')+'</option>'+S.projects.filter(function(p){ return p.status!=='done'&&p.status!=='cancelled'; }).map(function(p){ return '<option value="'+esc8(p.id)+'"'+(p.id===sel?' selected':'')+'>'+esc8(p.code+' · '+p.name)+'</option>'; }).join('');
  }
  function val(id){ var e=document.getElementById(id); return e ? String(e.value||'').trim() : ''; }
  function field(label,inner){ return '<div class="field"><label>'+label+'</label>'+inner+'</div>'; }

  window.v108NewTask=function(preset){
    if(!canWork()){ note(refusal({code:'42501'}),true); return; }
    var me=myMember(); preset=preset||{};
    var body='<div class="grid2">'+
      field(fl('Title','العنوان'),'<input id="v108_title" maxlength="300">')+
      field(fl('Kind of work','نوع العمل'),'<select id="v108_type">'+optionList(S.workTypes,preset.work_type||'sales')+'</select>')+
      field(fl('Company','الشركة'),'<select id="v108_biz">'+companyOptions(preset.business_id||'')+'</select>')+
      field(fl('Project','المشروع'),'<select id="v108_proj">'+projectOptions(preset.project_id||'')+'</select>')+
      field(fl('Owner — who does it','المسؤول — من ينفّذها'),'<select id="v108_owner">'+memberOptions(me&&me.id)+'</select>')+
      field(fl('Due','الاستحقاق'),'<input id="v108_due" type="date">')+
      field(fl('Priority','الأولوية'),'<select id="v108_pri">'+optionList(S.priorities,'normal')+'</select>')+
      '</div>'+field(fl('Details','التفاصيل'),'<textarea id="v108_desc" rows="3"></textarea>')+
      '<div class="note" style="font-size:12px">'+fl('Handing a task to someone else is for managers and department heads — the database checks it.','إسناد مهمة لشخص آخر للمدراء ورؤساء الأقسام — وقاعدة البيانات تتحقق من ذلك.')+'</div>';
    openModal(fl('New task','مهمة جديدة'),body,function(){
      var row={ title:val('v108_title'), work_type:val('v108_type'), business_id:val('v108_biz')||null, project_id:val('v108_proj')||null,
                owner_id:val('v108_owner')||null, due_date:val('v108_due')||null, priority:val('v108_pri')||'normal', description:val('v108_desc')||null };
      if(!row.title){ note(fl('A task needs a title.','المهمة تحتاج عنوانًا.'),true); return false; }
      var c=client(); if(!c) return false;
      c.from('tasks').insert(row).select('id,code').then(function(r){
        if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); return; }
        note(fl('Task '+r.data[0].code+' created.','أُنشئت المهمة '+r.data[0].code+'.'));
        S.loaded=false; load(true);
      });
      return true;
    });
  };

  window.v108NewProject=function(){
    if(!canWork()){ note(refusal({code:'42501'}),true); return; }
    var me=myMember();
    var body='<div class="grid2">'+
      field(fl('Name','الاسم'),'<input id="v108p_name" maxlength="200">')+
      field(fl('Kind of work','نوع العمل'),'<select id="v108p_type">'+optionList(S.workTypes,'sales')+'</select>')+
      field(fl('Company','الشركة'),'<select id="v108p_biz">'+companyOptions('')+'</select>')+
      field(fl('Owner','المسؤول'),'<select id="v108p_owner">'+memberOptions(me&&me.id)+'</select>')+
      field(fl('Due','الاستحقاق'),'<input id="v108p_due" type="date">')+'</div>';
    openModal(fl('New work project','مشروع عمل جديد'),body,function(){
      var row={ name:val('v108p_name'), work_type:val('v108p_type'), business_id:val('v108p_biz')||null, owner_id:val('v108p_owner')||null, due_date:val('v108p_due')||null };
      if(!row.name){ note(fl('A project needs a name.','المشروع يحتاج اسمًا.'),true); return false; }
      var c=client(); if(!c) return false;
      c.from('projects').insert(row).select('id,code').then(function(r){
        if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); return; }
        note(fl('Project '+r.data[0].code+' created.','أُنشئ المشروع '+r.data[0].code+'.'));
        S.loaded=false; load(true);
      });
      return true;
    });
  };

  /* a task's card: its fields, checklist and comments */
  window.v108Open=function(id){
    var t=S.tasks.filter(function(x){ return x.id===id; })[0]; if(!t) return;
    S.open=id;
    var c=client(); if(!c) return;
    Promise.all([
      c.from('task_checklist').select('id,text,is_done,sort').eq('task_id',id).order('sort'),
      c.from('task_comments').select('id,author_id,kind,body,created_at').eq('task_id',id).is('deleted_at',null).order('created_at')
    ]).then(function(a){
      S.detail={ checklist:(a[0]&&a[0].data)||[], comments:(a[1]&&a[1].data)||[] };
      showTask(t);
    });
  };
  function showTask(t){
    var edit=mayEditTask(t), dis=edit?'':' disabled', p=t.project_id?projectOf(t.project_id):null, d=S.detail||{checklist:[],comments:[]};
    var body='<div class="v108-card" data-v108-open="'+esc8(t.id)+'">'+
      '<div class="note" style="font-size:12px">'+esc8(t.code)+' · '+fl('owner','المسؤول')+': <b>'+esc8(memberName(t.owner_id))+'</b>'+
        (t.business_id?' · '+esc8(companyName(t.business_id)):'')+(p?' · '+esc8(p.code+' '+p.name):'')+'</div>'+
      (edit?'':'<div class="v107-note note">'+fl('You can read this task; changing it is for its owner, whoever manages it, or someone with Full control on Tasks.','يمكنك قراءة هذه المهمة؛ تعديلها لمالكها أو من يديرها أو من لديه «تحكم كامل» على المهام.')+'</div>')+
      '<div class="grid2">'+
      field(fl('Title','العنوان'),'<input id="v108e_title" value="'+esc8(t.title)+'"'+dis+'>')+
      field(fl('Status','الحالة'),'<select id="v108e_status"'+dis+'>'+optionList(S.statuses,t.status)+'</select>')+
      field(fl('Due','الاستحقاق'),'<input id="v108e_due" type="date" value="'+esc8(fmtDate(t.due_date))+'"'+dis+'>')+
      field(fl('Priority','الأولوية'),'<select id="v108e_pri"'+dis+'>'+optionList(S.priorities,t.priority)+'</select>')+
      '</div>'+field(fl('Details','التفاصيل'),'<textarea id="v108e_desc" rows="3"'+dis+'>'+esc8(t.description||'')+'</textarea>')+
      /* release 2 (2026-09-26): a finished task marked for the report registers its own achievement in the database —
         final when its owner or whoever manages it closes it, a DRAFT for them to finalize when a helper does (D7) */
      '<div class="grid2">'+
      field(fl('Monthly report','التقرير الشهري'),'<label style="display:flex;gap:8px;align-items:center;font-weight:500;text-transform:none;letter-spacing:0"><input type="checkbox" id="v108e_rep"'+(t.include_in_report?' checked':'')+dis+'> '+fl('Count it as an achievement when it is done','احتسبها إنجازًا عند إنجازها')+'</label>')+
      field(fl('Kind of achievement','نوع الإنجاز'),'<select id="v108e_repcat"'+dis+'><option value="">'+fl('— choose —','— اختر —')+'</option>'+(S.repCats||[]).filter(function(c){ return c.active||c.id===t.report_category_id; }).map(function(c){ return '<option value="'+esc8(c.id)+'"'+(c.id===t.report_category_id?' selected':'')+'>'+esc8(fl(c.name_en,c.name_ar))+'</option>'; }).join('')+'</select>')+
      '</div>'+
      '<h4 style="margin:14px 0 6px">'+fl('Checklist','قائمة التحقق')+'</h4><div class="v108-checklist">'+
      (d.checklist.length?d.checklist.map(function(i){ return '<label style="display:flex;gap:8px;align-items:center;margin:3px 0"><input type="checkbox" data-v108-check="'+esc8(i.id)+'"'+(i.is_done?' checked':'')+dis+' onchange="v108Tick(\''+esc8(i.id)+'\',this.checked)"> '+esc8(i.text)+'</label>'; }).join('')
                          :'<div style="color:var(--muted);font-size:12.5px">'+fl('Nothing on the checklist.','لا شيء في قائمة التحقق.')+'</div>')+'</div>'+
      (edit?'<div style="display:flex;gap:6px;margin-top:6px"><input class="inp" id="v108_newcheck" placeholder="'+esc8(fl('Add a step…','أضف خطوة…'))+'" style="flex:1"><button class="btn sm" onclick="v108AddCheck()">'+fl('Add','إضافة')+'</button></div>':'')+
      '<h4 style="margin:14px 0 6px">'+fl('Updates','التحديثات')+'</h4><div class="v108-comments">'+
      (d.comments.length?d.comments.map(function(cm){ return '<div style="border-top:1px solid var(--line);padding:6px 0;font-size:12.5px"><b>'+esc8(memberName(cm.author_id))+'</b> <span style="color:var(--muted)">'+esc8(String(cm.created_at||'').slice(0,16).replace('T',' '))+(cm.kind==='weekly_update'?' · '+fl('weekly update','تحديث أسبوعي'):'')+'</span><div>'+esc8(cm.body)+'</div></div>'; }).join('')
                         :'<div style="color:var(--muted);font-size:12.5px">'+fl('No updates yet.','لا توجد تحديثات بعد.')+'</div>')+'</div>'+
      (canWork()&&myMember()?'<div style="display:flex;gap:6px;margin-top:6px"><input class="inp" id="v108_newcomment" placeholder="'+esc8(fl('Write an update…','اكتب تحديثًا…'))+'" style="flex:1"><button class="btn sm" onclick="v108AddComment()">'+fl('Post','نشر')+'</button></div>':'')+
      '</div>';
    openModal(esc8(t.title),body,function(){
      if(!edit){ note(refusal({code:'42501'}),true); return false; }
      var patch={ title:val('v108e_title'), status:val('v108e_status'), due_date:val('v108e_due')||null, priority:val('v108e_pri'), description:val('v108e_desc')||null };
      try{ var rep=document.getElementById('v108e_rep'); if(rep){ patch.include_in_report=!!rep.checked; patch.report_category_id=val('v108e_repcat')||null; } }catch(_){}
      if(!patch.title){ note(fl('A task needs a title.','المهمة تحتاج عنوانًا.'),true); return false; }
      if(patch.include_in_report && !patch.report_category_id){ note(fl('Choose the kind of achievement it will count as.','اختر نوع الإنجاز الذي ستُحتسب به.'),true); return false; }
      var c=client(); if(!c) return false;
      c.from('tasks').update(patch).eq('id',t.id).select('id,status,done_at').then(function(r){
        if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); S.loaded=false; load(true); return; }
        note(fl('Saved.','حُفظ.')); S.loaded=false; load(true);
      });
      return true;
    });
    if(!edit){ try{ var sv=document.getElementById('mSave'); if(sv) sv.style.display='none'; }catch(_){} }
  }
  window.v108Tick=function(itemId,on){
    var c=client(); if(!c) return;
    c.from('task_checklist').update({ is_done:!!on, done_at: on?new Date().toISOString():null }).eq('id',itemId).select('id').then(function(r){
      if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); if(S.open) v108Open(S.open); }
    });
  };
  window.v108AddCheck=function(){
    var text=val('v108_newcheck'); if(!text||!S.open) return; var c=client(); if(!c) return;
    c.from('task_checklist').insert({ task_id:S.open, text:text, sort:((S.detail&&S.detail.checklist.length)||0)+1 }).select('id').then(function(r){
      if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); return; }
      v108Open(S.open);
    });
  };
  window.v108AddComment=function(){
    var text=val('v108_newcomment'); var me=myMember(); if(!text||!S.open||!me) return; var c=client(); if(!c) return;
    c.from('task_comments').insert({ task_id:S.open, author_id:me.id, body:text }).select('id').then(function(r){
      if(r.error||!r.data||!r.data.length){ note(refusal(r.error||{code:'42501'}),true); return; }
      v108Open(S.open);
    });
  };
  /* js/109 opens a task by id from Today */
  window.v108GoTo=function(id){ try{ current=PAGE; openLead=null; render(); }catch(_){} var tries=0; var iv=setInterval(function(){ tries++; if(S.loaded){ clearInterval(iv); if(id) v108Open(id); } else if(tries>40) clearInterval(iv); },250); };

  /* ---------- the page and its menu button ---------- */
  if(typeof render==='function'){
    var _r=render;
    window.render=function(){
      var out=_r.apply(this,arguments);
      try{ if(current===PAGE) draw(); }catch(e){ if(window.console)console.warn('[v108]',e); }
      setTimeout(navButton,60);
      return out;
    };
  }
  function navButton(){try{
    if(window.__isShareView) return;
    var nav=document.getElementById('nav'); if(!nav||!nav.querySelector('button')) return;
    var b=document.getElementById('v108NavBtn');
    if(!b){
      b=document.createElement('button'); b.id='v108NavBtn'; b.setAttribute('data-v108-nav','tasks');
      b.innerHTML='<span style="display:inline-block;width:18px;text-align:center">✓</span><span class="v108-lbl"></span>';
      b.onclick=function(){ try{ current=PAGE; openLead=null; render(); window.scrollTo(0,0); if(typeof closeSide==='function')closeSide(); }catch(_){} };
      /* on the rail, right after Today: a daily page, not a reference one */
      var today=null; [].slice.call(nav.querySelectorAll('button')).forEach(function(x){ if(!today && /today|اليوم/i.test(x.textContent||'')) today=x; });
      if(today && today.parentNode) today.parentNode.insertBefore(b, today.nextSibling); else nav.appendChild(b);
    }
    var sp=b.querySelector('.v108-lbl'), want=fl('Tasks','المهام'); if(sp&&sp.textContent!==want) sp.textContent=want;
    var on=false; try{ on=(current===PAGE); }catch(_){} b.className=on?'active':'';
    var lv=level(); b.style.display=(lv===null||lv==='none')?'none':'';
  }catch(e){ if(window.console)console.warn('[v108] nav',e); }}
  setTimeout(navButton,900); setTimeout(navButton,2600);
  try{ window.__v108Probe={ state:S, mayEditTask:mayEditTask, level:level }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v108] init',e); }})();
