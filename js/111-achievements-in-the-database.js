/* ===== Achievements + proofs in the database (Phase 3 release 2, 2026-09-26) =====

   Until today the Reports page kept its achievements in each browser (localStorage directReportsData_v1,
   core-10): one person's notes on one machine, invisible to colleagues, gone with the browser's data
   (js/91 said so on the page). Release 2 moves them into report_entries (scripts/sql/phase3-r1-task-manager.sql
   + phase3-r2-achievements.sql) — the table release 1 built for exactly this — and adds proofs.

   How it fits the existing page without rewriting it: core-10's four tabs (Overview, Achievements, Objectives &
   KPIs, Generate Report) all read one list, RDB.achievements. This layer fills that list from the database, in
   the shape core-10 already knows, so the counts, the objective progress and the exported report are the
   company's shared achievements with no change to those tabs. What it replaces are the writers: logging,
   editing and deleting an achievement now go to the database, and the browser store is no longer written with
   achievements (the KPI "actual" numbers typed on Objectives & KPIs stay in this browser, and js/91 says so).

   What the database decides — this layer only draws the answer:
     · who may log, edit, finalize or delete (the Reports page level: employees Own work, managers Full
       control, Quality/Strategy/Integrity View — D2/D3); a refusal is shown in words, never as success;
     · credit: an achievement is credited to yourself; crediting a colleague is for a manager or the head;
     · a finished task sent to the report registers its own achievement; closed by a helper it waits as a
       DRAFT for the owner or their manager to finalize (D7) — drafts are marked here with a Finalize button;
     · a month that is issued is locked; a KPI calculated from Finance takes no typed number;
     · proofs are optional (D3): files in the private "proofs" store, added by whoever may edit the
       achievement, seen by anyone who can see the page, removed only by marking them removed (history kept).

   Moving this browser's achievements in: if this browser still holds achievements, a card offers to move them —
   one press, each added once (import_key = the browser record's id, unique in the database, so a second press
   adds nothing), this browser's copy kept untouched and marked as moved. Not automatic: the person sees what
   will be added and presses it themselves.                                                               */
(function(){try{
  var PAGE='reports', RPT_KEY='directReportsData_v1';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function level(){ try{ return typeof window.pageLevel==='function' ? window.pageLevel(PAGE) : null; }catch(_){ return null; } }
  function canWork(){ var l=level(); return l==='own'||l==='full'; }
  function say(m,kind){ try{ if(typeof window.toast==='function'){ window.toast(m,kind); return; } }catch(_){} try{ console.warn('[v111] '+m); }catch(_){} }

  /* the database's refusals, in the reader's language */
  var AR=[
    [/Only a manager or the department head can credit an achievement to someone else/,'لا يستطيع نسب الإنجاز إلى زميل إلا المدير أو رئيس القسم'],
    [/This month is issued and locked/,'هذا الشهر صدر تقريره وأُقفل — أضف تصحيحًا في الشهر التالي'],
    [/report_no_typed_money/,'هذا المؤشر يُحسب من النظام (المالية) — لا تُكتب له قيمة'],
    [/achievement_needs_category/,'اختر تصنيف الإنجاز'],
    [/This month is issued — its proofs are frozen/,'هذا الشهر صدر تقريره — إثباتاته مجمّدة'],
    [/row-level security|permission denied/i,'قاعدة البيانات رفضت التغيير: ليست لديك صلاحية على هذا الإنجاز']
  ];
  function said(msg){
    var m=String(msg||'');
    if(/report_no_typed_money/.test(m)&&!isAr()) return 'This KPI is calculated from the system (Finance) — nothing is typed against it.';
    if(/achievement_needs_category/.test(m)&&!isAr()) return 'Choose what kind of achievement this is.';
    if(/row-level security|permission denied/i.test(m)&&!isAr()) return 'The database refused the change: you do not have control of this achievement.';
    if(!isAr()) return m;
    for(var i=0;i<AR.length;i++){ if(AR[i][0].test(m)) return AR[i][1]; }
    return m;
  }

  /* ---------- what this browser still holds (read once, never overwritten with the shared list) ---------- */
  var LOCAL={ achievements:[], overrides:{}, movedToDb:{} };
  try{ var raw=JSON.parse(localStorage.getItem(RPT_KEY)||'null'); if(raw&&typeof raw==='object'){ LOCAL.achievements=Array.isArray(raw.achievements)?raw.achievements:[]; LOCAL.overrides=raw.overrides||{}; LOCAL.movedToDb=raw.movedToDb||{}; } }catch(_){}
  function writeLocal(){ try{ localStorage.setItem(RPT_KEY, JSON.stringify({ achievements:LOCAL.achievements, overrides:(R()&&R().overrides)||LOCAL.overrides, movedToDb:LOCAL.movedToDb })); }catch(_){} }
  function notMoved(){ return LOCAL.achievements.filter(function(a){ return a && a.id && !LOCAL.movedToDb[a.id]; }); }
  /* core-10's list and writer, reached through the doors it opens for this layer (core-10 is a sealed block) */
  function R(){ try{ return window.__rptDB||null; }catch(_){ return null; } }
  function L(){ try{ return window.__rptLists||{ objectives:[], kpis:[], objTitle:function(o){ return (o&&o.t)||''; }, kpiTitle:function(k){ return (k&&k.t)||''; } }; }catch(_){ return { objectives:[], kpis:[] }; } }
  /* core-10's rptSave wrote the whole list — now the shared one — into this browser. From here on it keeps
     only what is still this browser's: its KPI actuals and its own original achievements. */
  window.__rptSaveHook=function(){ writeLocal(); };
  /* the page does not present this browser's list as the company's while the shared one loads */
  try{ if(R()) R().achievements=[]; }catch(_){}

  var S={ loaded:false, busy:false, err:null, rows:[], periods:[], cats:[], members:[], people:[], objs:{}, objByN:{}, kpis:{}, kpiByN:{}, proofs:{}, biz:[], me:null };
  window.__v111=S;

  function personOfMember(mid){ var m=S.members.filter(function(x){ return x.id===mid; })[0]; if(!m) return null; return S.people.filter(function(p){ return p.id===m.user_id; })[0]||null; }
  function memberName(mid){ var p=personOfMember(mid); if(!p) return mid?'—':'Other'; return (isAr()?(p.name_ar||p.full_name):(p.full_name||p.name_ar))||p.email||'—'; }
  function memberByName(n){
    n=String(n||'').trim().toLowerCase(); if(!n||n==='other') return null;
    for(var i=0;i<S.members.length;i++){ var p=S.people.filter(function(x){ return x.id===S.members[i].user_id; })[0]; if(!p) continue;
      if([p.full_name,p.name_ar,p.nickname,(p.email||'').split('@')[0]].some(function(v){ return v&&String(v).trim().toLowerCase()===n; })) return S.members[i]; }
    return null;
  }
  function monthOf(d){ d=String(d||''); return S.periods.filter(function(p){ return p.kind==='month' && d>=p.start_date && d<=p.end_date; })[0]||null; }
  function bizName(id){ var b=S.biz.filter(function(x){ return x.id===id; })[0]; return b?((isAr()&&b.name_ar)?b.name_ar:b.name):''; }
  function bizByName(n){ n=String(n||'').trim().toLowerCase(); if(!n) return null; return S.biz.filter(function(b){ return String(b.name||'').trim().toLowerCase()===n || String(b.name_ar||'').trim()===n; })[0]||null; }

  function toPage(r){
    var body=r.title ? (isAr()?(r.text_ar||r.text_en):(r.text_en||r.text_ar)) : '';
    return { id:r.id, date:r.entry_date||((S.periods.filter(function(p){ return p.id===r.period_id; })[0]||{}).start_date)||'',
      member:memberName(r.member_id), title:r.title||r.text_en||r.text_ar||'', desc:body||'',
      objective:S.objs[r.objective_id]||(r.kpi_id&&S.kpis[r.kpi_id]?S.kpis[r.kpi_id].obj:'')||'', kpi:(S.kpis[r.kpi_id]||{}).n||'',
      value:(r.value==null?'':Number(r.value)), client:bizName(r.business_id),
      _db:true, _status:r.status, _source:r.source, _cat:r.category_id, _member:r.member_id, _row:r,
      _proofs:(S.proofs[r.id]||[]) };
  }

  function load(){
    var c=client(); if(!c||S.busy) return; S.busy=true;
    var q=function(p){ return p.then(function(r){ if(r.error) throw r.error; return r.data||[]; }); };
    Promise.all([
      q(c.from('report_entries').select('*').eq('section','achievement')),
      c.auth.getSession().then(function(r){ return r&&r.data&&r.data.session&&r.data.session.user ? r.data.session.user.id : null; }),
      q(c.from('periods').select('id,kind,year,month,start_date,end_date,locked_at').eq('kind','month')),
      q(c.from('report_categories').select('id,code,name_en,name_ar,active,sort').order('sort')),
      q(c.from('team_members').select('id,user_id,department_id,active')),
      /* the names are a nicety, not the record: if they fail the achievements still load, and every people list
         says so first (js/33's warning option — fire #250's rule) */
      q(c.from('team_directory').select('id,email,full_name,name_ar,nickname')).catch(function(){ return null; }),
      q(c.from('objectives').select('id,year,n')),
      q(c.from('kpi_definitions').select('id,n,method,unit,objective_id')),
      q(c.from('evidence_files').select('id,entry_id,storage_path,file_name,created_at').is('deleted_at',null)),
      q(c.from('businesses').select('id,name,name_ar').is('archived_at',null))
    ]).then(function(r){
      S.busy=false; S.err=null;
      S.periods=r[2]; S.cats=r[3]; S.members=r[4]; S.people=r[5]||[]; S.rosterErr=(r[5]==null); S.biz=r[9];
      S.objs={}; S.objByN={}; r[6].forEach(function(o){ if(o.year===2026){ S.objs[o.id]=o.n; S.objByN[o.n]=o.id; } });
      S.kpis={}; S.kpiByN={}; r[7].forEach(function(k){ var on=S.objs[k.objective_id]||''; S.kpis[k.id]={ n:k.n, method:k.method, unit:k.unit, obj:on }; if(k.n!=null) S.kpiByN[k.n]=k; });
      S.proofs={}; r[8].forEach(function(f){ (S.proofs[f.entry_id]=S.proofs[f.entry_id]||[]).push(f); });
      var uid=r[1];
      S.me=S.members.filter(function(m){ return m.active && (m.user_id===uid); })[0]||null;
      S.rows=r[0];
      try{ if(R()) R().achievements=S.rows.map(toPage); }catch(_){}
      S.loaded=true;
      if(typeof current!=='undefined'&&current==='reports'&&typeof render==='function') render();
    }).catch(function(e){ S.busy=false; S.err=(e&&e.message)||String(e); S.loaded=true; if(typeof current!=='undefined'&&current==='reports'&&typeof render==='function') render(); });
  }
  window.v111Reload=function(){ load(); };

  /* who is signed in: the team-list entry is found by login id (js/02 keeps it) or, failing that, e-mail */
  function findMe(){
    if(S.me) return S.me;
    try{ var em=String(window.__userEmail||'').toLowerCase(); var p=S.people.filter(function(x){ return String(x.email||'').toLowerCase()===em; })[0];
      if(p) S.me=S.members.filter(function(m){ return m.user_id===p.id && m.active; })[0]||null; }catch(_){}
    return S.me;
  }

  /* ---------- log / edit ---------- */
  function field(id){ var el=document.getElementById(id); return el?el.value:''; }
  window.rptOpenAch=function(id){
    if(!S.loaded){ say(fl('Achievements are still loading from the database.','لا تزال الإنجازات قيد التحميل من قاعدة البيانات.')); return; }
    /* a failed read means the team list is unknown too: nobody could be credited correctly — say so, open nothing */
    if(S.err){ say(fl('The achievements (and the team list they are credited to) could not be read from the database, so nothing can be logged right now. Reload the page; if it persists, tell an admin.','تعذّرت قراءة الإنجازات (وقائمة الفريق التي تُنسب إليها) من قاعدة البيانات، فلا يمكن التسجيل الآن. أعد تحميل الصفحة؛ وإن استمر ذلك فأبلغ المسؤول.'),'err'); return; }
    var a=id?((R()?R().achievements:[]).filter(function(x){ return x.id===id; })[0]):null;
    if(id&&!a) return;
    var me=findMe();
    var r=a?a._row:{ entry_date:todayISO(), member_id:me?me.id:null, title:'', text_en:'', text_ar:'', category_id:'', objective_id:'', kpi_id:'', value:'', business_id:null };
    var memberOpts=S.members.filter(function(m){ return m.active||m.id===r.member_id; }).map(function(m){ return '<option value="'+esc(m.id)+'"'+(m.id===r.member_id?' selected':'')+'>'+esc(memberName(m.id))+'</option>'; }).join('')+
      '<option value=""'+(r.member_id?'':' selected')+'>'+fl('Nobody in particular (the department)','لا أحد بعينه (القسم)')+'</option>';
    var catOpts='<option value="">'+fl('— choose —','— اختر —')+'</option>'+S.cats.filter(function(c){ return c.active||c.id===r.category_id; }).map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===r.category_id?' selected':'')+'>'+esc(isAr()?c.name_ar:c.name_en)+'</option>'; }).join('');
    var objOpts='<option value="">'+fl('— none —','— لا شيء —')+'</option>'+(L().objectives||[]).map(function(o){ return '<option value="'+o.n+'"'+(S.objs[r.objective_id]===o.n?' selected':'')+'>#'+o.n+' — '+esc((L().objTitle?L().objTitle(o):'').slice(0,46))+'</option>'; }).join('');
    var kpiN=(S.kpis[r.kpi_id]||{}).n||'';
    var kpiOpts='<option value="">'+fl('— none —','— لا شيء —')+'</option>'+(L().kpis||[]).map(function(k){ var d=S.kpiByN[k.n]; var calc=d&&d.method!=='manual'; return '<option value="'+k.n+'"'+(String(kpiN)===String(k.n)?' selected':'')+'>KPI '+k.n+' — '+esc((L().kpiTitle?L().kpiTitle(k):'').slice(0,40))+(calc?fl(' (from Finance)',' (من المالية)'):'')+'</option>'; }).join('');
    var body=r.title?(isAr()?(r.text_ar||r.text_en):(r.text_en||r.text_ar)):'';
    var proofs=(a&&a._proofs)||[];
    var warn=''; try{ if(S.rosterErr&&typeof window.teamRosterWarnOption==='function') warn=window.teamRosterWarnOption()||''; }catch(_){}
    if(S.rosterErr&&!warn) warn='<option value="" disabled data-roster-warn="1">⚠ '+fl('The team list did not load — these names may be out of date','لم تُحمَّل قائمة الفريق — قد تكون هذه الأسماء قديمة')+'</option>';
    openModal(id?fl('Edit achievement','تعديل الإنجاز'):fl('Log achievement','تسجيل إنجاز'),
      '<div class="grid2"><div class="field"><label>'+fl('Date','التاريخ')+'</label><input type="date" id="v111_date" value="'+esc(r.entry_date||'')+'"></div>'+
      '<div class="field"><label>'+fl('Credited to','يُنسب إلى')+'</label><select id="v111_member">'+warn+memberOpts+'</select></div></div>'+
      '<div class="field"><label>'+fl('What was achieved','ما الذي تحقق')+'</label><input type="text" id="v111_title" value="'+esc(r.title||'')+'"></div>'+
      '<div class="field"><label>'+fl('Details (optional)','التفاصيل (اختياري)')+'</label><textarea id="v111_desc" rows="2">'+esc(body)+'</textarea></div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Kind of achievement','نوع الإنجاز')+'</label><select id="v111_cat">'+catOpts+'</select></div>'+
      '<div class="field"><label>'+fl('Client / entity (optional)','العميل / الجهة (اختياري)')+'</label><input type="text" id="v111_client" list="v111_bizlist" value="'+esc(bizName(r.business_id))+'"><datalist id="v111_bizlist">'+S.biz.slice(0,400).map(function(b){ return '<option value="'+esc(b.name)+'">'; }).join('')+'</datalist></div></div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Linked objective','الهدف المرتبط')+'</label><select id="v111_obj">'+objOpts+'</select></div>'+
      '<div class="field"><label>'+fl('KPI','المؤشر')+'</label><select id="v111_kpi">'+kpiOpts+'</select></div></div>'+
      '<div class="field"><label>'+fl('Numeric value (counts toward the KPI — never money)','قيمة رقمية (تُحتسب في المؤشر — ليست مبلغًا)')+'</label><input type="number" id="v111_value" value="'+esc(r.value==null?'':r.value)+'"></div>'+
      '<div class="field"><label>'+fl('Proof (optional) — contract, agreement, e-mail, screenshot','إثبات (اختياري) — عقد، اتفاقية، بريد، لقطة شاشة')+'</label><input type="file" id="v111_files" multiple>'+
        (proofs.length?'<div class="rpt-small" style="margin-top:4px">'+fl('Already attached: ','مرفق بالفعل: ')+proofs.map(function(f){ return esc(f.file_name); }).join(', ')+'</div>':'')+'</div>'+
      '<div id="v111_msg" style="font-size:12.5px;color:#9B1C1C"></div>',
      function(){ save(id); return false; });
  };

  function save(id){
    var c=client(); if(!c) return;
    var msgEl=document.getElementById('v111_msg'); var tell=function(t){ if(msgEl) msgEl.textContent=t; else say(t,'err'); };
    var date=field('v111_date'), title=field('v111_title').trim(), cat=field('v111_cat'), mid=field('v111_member')||null;
    if(!title){ tell(fl('Please write what was achieved.','يُرجى كتابة ما تحقق.')); return; }
    if(!cat){ tell(fl('Choose what kind of achievement this is.','اختر نوع الإنجاز.')); return; }
    var per=monthOf(date); if(!per){ tell(fl('Choose a date inside a month the company reports on.','اختر تاريخًا ضمن شهر تُعد له التقارير.')); return; }
    var me=findMe(); var m=mid?S.members.filter(function(x){ return x.id===mid; })[0]:null;
    var dep=(m&&m.department_id)||(me&&me.department_id);
    if(!dep){ tell(fl('Your login is not on the team list yet, so no achievement can be registered for you. Ask an admin to add you to the team list.','حسابك غير مدرج في قائمة الفريق بعد، فلا يمكن تسجيل إنجاز لك. اطلب من المسؤول إضافتك.')); return; }
    var kN=field('v111_kpi'), oN=field('v111_obj'), val=field('v111_value');
    var k=kN?S.kpiByN[kN]:null;
    var desc=field('v111_desc').trim(); var cl=field('v111_client').trim(); var b=bizByName(cl);
    if(cl&&!b) desc=(desc?desc+'\n':'')+fl('Client: ','العميل: ')+cl;
    var row={ period_id:per.id, department_id:dep, member_id:mid, section:'achievement', category_id:cat, title:title, entry_date:date,
      text_en:isAr()?null:(desc||null), text_ar:isAr()?(desc||null):null,
      objective_id:oN?(S.objByN[oN]||null):(k&&k.objective_id)||null, kpi_id:k?k.id:null,
      value:(val===''||val==null)?null:Number(val), business_id:b?b.id:null };
    if(id){ var old=((R()?R().achievements:[]).filter(function(x){ return x.id===id; })[0]||{})._row||{}; if(isAr()) row.text_en=old.text_en; else row.text_ar=old.text_ar; }
    var files=[]; try{ files=[].slice.call((document.getElementById('v111_files')||{}).files||[]); }catch(_){}
    var go=id?c.from('report_entries').update(row).eq('id',id).select('id'):c.from('report_entries').insert(Object.assign({status:'final'},row)).select('id');
    go.then(function(r){
      if(r.error){ tell(said(r.error.message)); return; }
      if(!r.data||!r.data.length){ tell(fl('Not saved — the database did not accept the change.','لم يُحفظ — لم تقبل قاعدة البيانات التغيير.')); return; }
      var eid=r.data[0].id;
      addProofs(eid,files).then(function(bad){
        try{ closeModal(); }catch(_){}
        say(bad?fl('Saved. '+bad+' proof file(s) could not be attached — the database refused them.','حُفظ. تعذّر إرفاق '+bad+' ملف إثبات — رفضتها قاعدة البيانات.'):fl('Saved to the company database.','حُفظ في قاعدة بيانات الشركة.'), bad?'err':undefined);
        load();
      });
    }).catch(function(e){ tell(said(e&&e.message||e)); });
  }

  /* each file: stored in the private proofs store under the achievement, then registered; returns how many failed */
  function addProofs(eid,files){
    var c=client(); var me=findMe(); if(!c||!files.length) return Promise.resolve(0);
    var bad=0;
    return files.reduce(function(p,f){ return p.then(function(){
      var safe=String(f.name||'file').replace(/[^\w.\-]+/g,'_').slice(-80);
      var path='proofs/'+eid+'/'+Date.now()+'-'+safe;
      return c.storage.from('proofs').upload(path,f,{upsert:false}).then(function(u){
        if(u.error){ bad++; return; }
        return c.from('evidence_files').insert({ entry_id:eid, storage_path:path, file_name:f.name||safe, mime_type:f.type||null, size_bytes:f.size||null, uploaded_by:me?me.id:null }).select('id')
          .then(function(r){ if(r.error||!r.data||!r.data.length) bad++; });
      }).catch(function(){ bad++; });
    }); }, Promise.resolve()).then(function(){ return bad; });
  }

  window.rptDelAch=function(id){
    var c=client(); if(!c) return;
    var ask=typeof window.askInPage==='function'?window.askInPage:function(t,cb){ cb(); };
    ask(fl('Delete this achievement? It is removed for everyone; the change is recorded.','حذف هذا الإنجاز؟ يُحذف للجميع ويُسجَّل التغيير.'),function(){
      c.from('report_entries').delete().eq('id',id).select('id').then(function(r){
        if(r.error) say(said(r.error.message),'err');
        else if(!r.data||!r.data.length) say(fl('Not deleted — the database did not accept it.','لم يُحذف — لم تقبله قاعدة البيانات.'),'err');
        else say(fl('Deleted.','حُذف.'));
        load();
      });
    });
  };

  /* a draft (a task closed by a helper) is finalized by its owner or whoever manages it — stamped by the database */
  window.v111Finalize=function(id){
    var c=client(); if(!c) return;
    c.from('report_entries').update({status:'final'}).eq('id',id).select('id').then(function(r){
      if(r.error) say(said(r.error.message),'err');
      else if(!r.data||!r.data.length) say(fl('Not finalized — only the owner or whoever manages it can.','لم يُعتمد — لا يعتمده إلا صاحبه أو من يدير المهمة.'),'err');
      else say(fl('Finalized — it now counts in the report.','اعتُمد — يُحتسب الآن في التقرير.'));
      load();
    });
  };

  /* proofs: signed links that last five minutes (the store is private) */
  window.v111Proofs=function(id){
    var c=client(); var list=S.proofs[id]||[]; if(!c) return;
    Promise.all(list.map(function(f){ return c.storage.from('proofs').createSignedUrl(f.storage_path,300).then(function(r){ return { f:f, url:(r&&r.data&&r.data.signedUrl)||null }; }).catch(function(){ return { f:f, url:null }; }); }))
      .then(function(rows){
        openModal(fl('Proofs','الإثباتات'), rows.length?('<ul style="margin:0;padding-inline-start:18px" data-v111-proofs="1">'+rows.map(function(x){
          return '<li style="margin:4px 0">'+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.f.file_name)+'</a>':esc(x.f.file_name)+' <span class="rpt-small">'+fl('(could not open)','(تعذّر الفتح)')+'</span>')+'</li>'; }).join('')+'</ul>')
          :'<div class="rpt-small">'+fl('No proof attached. A proof is optional.','لا يوجد إثبات مرفق. الإثبات اختياري.')+'</div>', function(){ return true; });
      });
  };

  /* ---------- the row: the database's state beside the achievement (core-10's row door) ---------- */
  window.__rptRowHook=function(a,h){
    if(!a||!a._db) return h;
    var extra='';
    if(a._status==='draft') extra+=' <span class="tag" data-v111-draft="1" style="background:#FFF3EC;color:#9A4A0B">'+fl('Draft — waiting for the owner or their manager','مسودة — بانتظار صاحبها أو مديره')+'</span>'+
      (canWork()?' <button class="btn sm" onclick="v111Finalize(\''+esc(a.id)+'\')">'+fl('Finalize','اعتماد')+'</button>':'');
    if(a._source==='task') extra+=' <span class="rpt-small">'+fl('from a task','من مهمة')+'</span>';
    var np=(a._proofs||[]).length;
    extra+=' <a href="#" data-v111-proof-link="'+np+'" onclick="v111Proofs(\''+esc(a.id)+'\');return false" class="rpt-small">📎 '+(np?(np+' '+fl(np===1?'proof':'proofs',np===1?'إثبات':'إثباتات')):fl('no proof','بلا إثبات'))+'</a>';
    var i=h.indexOf('</b>'); return i<0?h:(h.slice(0,i+4)+extra+h.slice(i+4));
  };

  /* ---------- the move card + the line that says where things live ---------- */
  window.v111MoveBrowser=function(){
    var c=client(); if(!c) return;
    var list=notMoved(); if(!list.length) return;
    var me=findMe();
    if(!me){ say(fl('Your login is not on the team list yet, so nothing can be moved in for you. Ask an admin to add you.','حسابك غير مدرج في قائمة الفريق بعد، فلا يمكن نقل شيء لك. اطلب من المسؤول إضافتك.'),'err'); return; }
    var other=(S.cats.filter(function(x){ return x.code==='other'; })[0]||{}).id;
    var keys=list.map(function(a){ return 'browser:'+a.id; });
    c.from('report_entries').select('id,import_key').in('import_key',keys).then(function(ex){
      var have={}; ((ex&&ex.data)||[]).forEach(function(x){ have[x.import_key]=x.id; });
      var added=0, already=0, failed=[], dropped=0;
      return list.reduce(function(p,a){ return p.then(function(){
        var key='browser:'+a.id;
        if(have[key]){ LOCAL.movedToDb[a.id]=have[key]; already++; return; }
        var per=monthOf(a.date); if(!per){ failed.push(a.title||a.id); return; }
        var m=memberByName(a.member); var k=a.kpi?S.kpiByN[a.kpi]:null;
        var val=(a.value===''||a.value==null||isNaN(a.value))?null:Number(a.value);
        if(val!=null&&k&&k.method!=='manual'){ val=null; dropped++; }
        var notes=[a.desc||'']; var b=bizByName(a.client); if(a.client&&!b) notes.push(fl('Client: ','العميل: ')+a.client);
        /* a name that is not on the team list (an old roster name, "Other" aside) is never dropped: kept in the text */
        if(!m && a.member && a.member!=='Other') notes.push(fl('Logged for: ','سُجّل لـ: ')+a.member);
        var row={ period_id:per.id, department_id:(m&&m.department_id)||me.department_id, member_id:m?m.id:null, section:'achievement', category_id:other,
          title:a.title||'—', entry_date:a.date, text_en:notes.filter(Boolean).join('\n')||null, objective_id:a.objective?(S.objByN[a.objective]||null):null,
          kpi_id:k?k.id:null, value:k?val:null, business_id:b?b.id:null, status:'final', import_key:key };
        var put=function(r){ return c.from('report_entries').insert(r).select('id').then(function(x){
          if(x.error&&/credit an achievement to someone else/.test(x.error.message)&&r.member_id){
            /* an employee moving a colleague's line: kept, credited to nobody in particular, the name kept in the text */
            var r2=Object.assign({},r,{ member_id:null, department_id:me.department_id, text_en:[r.text_en,fl('Logged for: ','سُجّل لـ: ')+(a.member||'')].filter(Boolean).join('\n') });
            return put(r2);
          }
          if(x.error&&x.error.code==='23505'){ already++; return; }
          if(x.error||!x.data||!x.data.length){ failed.push(a.title||a.id); return; }
          LOCAL.movedToDb[a.id]=x.data[0].id; added++;
        }); };
        return put(row);
      }); }, Promise.resolve()).then(function(){
        writeLocal();
        var msg=fl('Moved into the company database: '+added+' added'+(already?(', '+already+' already there'):'')+(failed.length?(', '+failed.length+' could not be moved ('+failed.slice(0,3).join('; ')+')'):'')+(dropped?('. '+dropped+' value(s) against a KPI calculated from Finance were left out — Finance supplies that number'):'')+'. This browser keeps its own copy.',
                   'نُقل إلى قاعدة بيانات الشركة: '+added+' مضاف'+(already?('، '+already+' موجود مسبقًا'):'')+(failed.length?('، '+failed.length+' تعذّر نقله'):'')+(dropped?('. تُركت '+dropped+' قيمة لمؤشر يُحسب من المالية'):'')+'. يحتفظ هذا المتصفح بنسخته.');
        say(msg, failed.length?'err':undefined);
        load();
      });
    });
  };

  function enhance(){
    try{
      if(typeof current==='undefined'||current!=='reports') return;
      var view=document.getElementById('view'); if(!view||!view.querySelector('.rpt-tabs')) return;
      if(!S.loaded&&!S.busy) load();
      if(view.querySelector('.v111-card')) return;
      var d=document.createElement('div'); d.className='v111-card'; d.setAttribute('dir',isAr()?'rtl':'ltr');
      var pending=notMoved();
      var h='';
      if(!S.loaded) h+='<div data-v111-state="loading" class="rpt-small" style="margin:0 0 8px">'+fl('Loading the company\'s achievements from the database…','جارٍ تحميل إنجازات الشركة من قاعدة البيانات…')+'</div>';
      else if(S.err) h+='<div data-v111-state="error" style="margin:0 0 8px;padding:8px 12px;border-radius:.6rem;background:#FDECEC;color:#9B1C1C;font-size:12.5px">'+fl('Could not read the achievements from the database — the figures below are not the company\'s: ','تعذّرت قراءة الإنجازات من قاعدة البيانات — الأرقام أدناه ليست أرقام الشركة: ')+esc(S.err)+'</div>';
      if(S.loaded&&!S.err&&pending.length&&canWork())
        h+='<div data-v111-move="'+pending.length+'" style="margin:0 0 10px;padding:10px 12px;border-radius:.6rem;background:#EEF4FF;border:1px solid #C9D8F5;font-size:12.5px;line-height:1.6">'+
          '<b>'+fl('This browser still holds '+pending.length+' achievement'+(pending.length===1?'':'s')+' that only this browser can see.','ما زال هذا المتصفح يحتفظ بـ '+pending.length+' إنجاز لا يراه إلا هذا المتصفح.')+'</b> '+
          fl('Move them into the company database so the team and the report see them. Each is added once (pressing again adds nothing); their kind is set to "Other" for you to adjust; this browser keeps its copy.',
             'انقلها إلى قاعدة بيانات الشركة ليراها الفريق والتقرير. يُضاف كلٌّ منها مرة واحدة (الضغط مرة أخرى لا يضيف شيئًا)؛ ويُضبط نوعها على «أخرى» لتعدّله؛ ويحتفظ هذا المتصفح بنسخته.')+
          ' <button class="btn pri sm" onclick="v111MoveBrowser()">'+fl('Move them','انقلها')+'</button></div>';
      if(!h) return;
      d.innerHTML=h;
      var tabs=view.querySelector('.rpt-tabs'); tabs.parentNode.insertBefore(d,tabs);
    }catch(e){ if(window.console) console.warn('[v111]',e); }
  }
  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(enhance,40); }catch(_){} return o; };
    },200);
  }catch(_){}
  /* load once signed in, so Today's and the Overview's counts are the shared ones from the first look */
  (function wait(n){ try{ if(client()&&window.__pageLevels&&!document.getElementById('cl_email')){ if(canWork()||level()==='view') load(); return; } }catch(_){} if(n<240) setTimeout(function(){ wait(n+1); },500); })(0);
  console.info('%c[v111] achievements + proofs in the database loaded','color:#175CD3;font-weight:700');
}catch(e){ if(window.console) console.warn('[v111] init',e); }})();
