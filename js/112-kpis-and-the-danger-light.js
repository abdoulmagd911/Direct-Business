/* ===== KPIs + the danger light (Phase 3 release 3, 2026-09-26) =====

   The Reports page's "Objectives & KPIs" tab used to add up this browser's own list and a number typed by hand
   into each KPI's "actual" box — one person's figures on one machine (js/91 said so). Release 1 built the real
   calculation in the database and nothing drew it yet:
     · kpi_actuals   — each KPI's actual, from the right source and never typed: finished tasks, Finance money
                       (revenue / profit / collected — M1: no VAT anywhere in it), or final achievements carrying a value;
     · kpi_scorecard — target against actual; a KPI nobody measured is "not measured", never 0 (M53);
     · kpi_pace      — the DANGER LIGHT: achieved · on track · at risk · behind · missed · not measured · not started,
                       judged against how much of the month / quarter / year has passed on Riyadh's calendar.
   This layer draws them: the tab now shows, for a chosen period (year, quarter, month) and scope (the company, a
   department, a person), every KPI with its target, its actual, the share of target and its light; a manager
   with Full control on Reports sets targets there (the database refuses anyone else — phase3-r3-kpis.sql). The
   Overview's "KPIs with data" / "Avg progress", the objective bars and the exported report read the same actuals
   and targets (core-10's doors __rptActualHook / __rptLists), so the page tells one story. Today gets a card when
   the company's KPIs for the current period are off pace — drawn only from a successful read, never "all fine"
   on a failed one.                                                                                        */
(function(){try{
  var PAGE='reports';
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function level(){ try{ return typeof window.pageLevel==='function' ? window.pageLevel(PAGE) : null; }catch(_){ return null; } }
  function role(){ try{ return window.__userRole||null; }catch(_){ return null; } }
  /* the screen offers "Set target" to whom the database allows it: an admin, or a manager with Full control on Reports */
  function canSetTargets(){ var r=role(); return r==='admin' || (r==='manager' && level()==='full'); }
  function say(m,kind){ try{ if(typeof window.toast==='function'){ window.toast(m,kind); return; } }catch(_){} }
  function lists(){ try{ return window.__rptLists||{ objectives:[], kpis:[] }; }catch(_){ return { objectives:[], kpis:[] }; } }

  var LIGHTS={
    achieved:['Achieved','تحقق','#1E6B3A','#EAF6EE'], on_track:['On track','على المسار','#1E6B3A','#EAF6EE'],
    at_risk:['At risk','معرّض للتأخر','#9A4A0B','#FFF3EC'], behind:['Behind','متأخر','#9B1C1C','#FDECEC'],
    missed:['Missed','لم يتحقق','#FFFFFF','#9B1C1C'], not_measured:['Not measured','غير مقاس','#6B7480','#F1F2F4'],
    not_started:['Not started','لم يبدأ','#6B7480','#F1F2F4'], no_target:['No target set','لا هدف محدد','#6B7480','#F6F7F9']
  };
  function chip(light){ var l=LIGHTS[light]||LIGHTS.not_measured; return '<span class="tag" data-v112-light="'+esc(light)+'" style="color:'+l[2]+';background:'+l[3]+';white-space:nowrap">'+esc(fl(l[0],l[1]))+'</span>'; }
  var SRC={ tasks_done:['finished tasks','المهام المنجزة'], tasks_on_time_pct:['tasks done on time','المهام المنجزة في وقتها'],
    finance_revenue:['Finance — revenue','المالية — الإيرادات'], finance_profit:['Finance — profit','المالية — الربح'],
    finance_collected:['Finance — collected','المالية — المحصّل'], manual:['achievements with a value','الإنجازات ذات القيمة'] };
  function fmt(unit,v){
    if(v==null||v==='') return '—'; var n=Number(v); if(isNaN(n)) return '—';
    var s=n.toLocaleString('en-US',{maximumFractionDigits:1});
    if(unit==='SAR') return s+' '+fl('SAR','ريال'); if(unit==='percent') return s+'%'; if(unit==='days') return s+' '+fl('days','يوم'); return s;
  }

  var S={ loaded:false, busy:false, err:null, defs:[], byId:{}, byN:{}, pace:[], actuals:[], periods:[], deps:[], members:[], people:[], objs:[],
          sel:{ kind:'year', period:null, scope:'company', who:null } };
  window.__v112=S;

  function todayISO_(){ return todayISO(); }   /* Riyadh's calendar, the app's own (js/core) */
  function periodOf(kind,d){ return S.periods.filter(function(p){ return p.kind===kind && d>=p.start_date && d<=p.end_date; })[0]||null; }
  function planYear(){ return S.periods.filter(function(p){ return p.kind==='year' && p.year===2026; })[0]||null; }

  function load(){
    var c=client(); if(!c||S.busy) return; S.busy=true;
    var q=function(p){ return p.then(function(r){ if(r.error) throw r.error; return r.data||[]; }); };
    Promise.all([
      q(c.from('kpi_definitions').select('id,code,n,name_en,name_ar,unit,aggregation,direction,method,objective_id,is_draft,active')),
      q(c.from('kpi_pace').select('*')),
      q(c.from('kpi_actuals').select('*')),
      q(c.from('periods').select('id,kind,year,quarter,month,start_date,end_date,label_en,label_ar')),
      q(c.from('departments').select('id,code,name_en,name_ar,active,sort').order('sort')),
      q(c.from('team_members').select('id,user_id,department_id,active')),
      q(c.from('team_directory').select('id,full_name,name_ar')).catch(function(){ return []; }),
      q(c.from('objectives').select('id,year,n,title_en,title_ar'))
    ]).then(function(r){
      S.busy=false; S.err=null;
      S.defs=r[0]; S.pace=r[1]; S.actuals=r[2]; S.periods=r[3]; S.deps=r[4]; S.members=r[5]; S.people=r[6]; S.objs=r[7];
      S.byId={}; S.byN={}; S.defs.forEach(function(d){ S.byId[d.id]=d; if(d.n!=null) S.byN[d.n]=d; });
      if(!S.sel.period){ var y=periodOf('year',todayISO_())||planYear(); S.sel.period=y?y.id:null; }
      /* core-10's plan list takes its targets from the database (company, 2026) so every bar on the page agrees */
      try{ var yr=planYear(); (lists().kpis||[]).forEach(function(k){ var d=S.byN[k.n]; if(!d||!yr) return;
        var row=S.pace.filter(function(p){ return p.kpi_id===d.id && p.scope==='company' && p.period_id===yr.id; })[0];
        if(row&&row.target_value!=null) k.target=Number(row.target_value); }); }catch(_){}
      S.loaded=true; redraw();
    }).catch(function(e){ S.busy=false; S.loaded=true; S.err=(e&&e.message)||String(e); redraw(); });
  }
  window.v112Reload=function(){ load(); };
  function redraw(){ try{ if(typeof current!=='undefined' && (current==='reports'||current==='today') && typeof render==='function') render(); }catch(_){} }

  /* core-10's door: the company's 2026 actual for a plan KPI. null = not measured; while loading, null too —
     never this browser's typed number (release 3: actuals are the database's). */
  window.__rptActualHook=function(k){
    if(!S.loaded||S.err) return null;
    var d=S.byN[k&&k.n]; var yr=planYear(); if(!d||!yr) return null;
    var a=S.actuals.filter(function(x){ return x.kpi_id===d.id && x.scope==='company' && x.period_id===yr.id; })[0];
    return a&&a.actual!=null?Number(a.actual):null;
  };

  function who(){
    if(S.sel.scope==='department') return (S.deps.filter(function(d){ return d.id===S.sel.who; })[0]||{});
    if(S.sel.scope==='member') return (S.members.filter(function(m){ return m.id===S.sel.who; })[0]||{});
    return {};
  }
  function personName(mid){ var m=S.members.filter(function(x){ return x.id===mid; })[0]; if(!m) return '—'; var p=S.people.filter(function(x){ return x.id===m.user_id; })[0]; return p?(isAr()?(p.name_ar||p.full_name):(p.full_name||p.name_ar))||'—':'—'; }
  function depName(d){ return d?(isAr()?(d.name_ar||d.name_en):d.name_en):''; }
  function matches(row){
    if(row.scope!==S.sel.scope || row.period_id!==S.sel.period) return false;
    if(S.sel.scope==='department') return row.department_id===S.sel.who;
    if(S.sel.scope==='member') return row.member_id===S.sel.who;
    return true;
  }
  function periodLabel(p){ return p?(isAr()?(p.label_ar||p.label_en):p.label_en):''; }

  window.v112Set=function(k,v){
    if(k==='kind'){ S.sel.kind=v; var p=periodOf(v,todayISO_())||S.periods.filter(function(x){ return x.kind===v; })[0]; S.sel.period=p?p.id:null; }
    else if(k==='period') S.sel.period=v;
    else if(k==='scope'){ var parts=String(v).split(':'); S.sel.scope=parts[0]; S.sel.who=parts[1]||null; }
    if(typeof render==='function') render();
  };

  function tab(b){
    if(!S.loaded){ b.innerHTML='<div class="card" data-v112-state="loading" style="padding:18px;color:var(--muted)">'+fl('Loading the KPIs from the database…','جارٍ تحميل المؤشرات من قاعدة البيانات…')+'</div>'; if(!S.busy) load(); return; }
    if(S.err){ b.innerHTML='<div class="card" data-v112-state="error" style="padding:14px;background:#FDECEC;color:#9B1C1C">'+fl('The KPIs could not be read from the database, so no figure is shown — none of them would be the company\'s: ','تعذّرت قراءة المؤشرات من قاعدة البيانات، فلا يُعرض أي رقم — لن يكون أيٌّ منها رقم الشركة: ')+esc(S.err)+'</div>'; return; }
    var kinds=[['year',fl('Year','سنة')],['quarter',fl('Quarter','ربع')],['month',fl('Month','شهر')]];
    var pers=S.periods.filter(function(p){ return p.kind===S.sel.kind; }).sort(function(a,b){ return a.start_date<b.start_date?-1:1; });
    var scopes='<option value="company"'+(S.sel.scope==='company'?' selected':'')+'>'+fl('The company','الشركة')+'</option>'+
      '<optgroup label="'+esc(fl('Departments','الأقسام'))+'">'+S.deps.filter(function(d){ return d.active; }).map(function(d){ return '<option value="department:'+esc(d.id)+'"'+(S.sel.scope==='department'&&S.sel.who===d.id?' selected':'')+'>'+esc(depName(d))+'</option>'; }).join('')+'</optgroup>'+
      '<optgroup label="'+esc(fl('People','الأشخاص'))+'">'+S.members.filter(function(m){ return m.active; }).map(function(m){ return '<option value="member:'+esc(m.id)+'"'+(S.sel.scope==='member'&&S.sel.who===m.id?' selected':'')+'>'+esc(personName(m.id))+'</option>'; }).join('')+'</optgroup>';
    var h='<div class="toolbar" data-v112-toolbar="1">'+
      '<select onchange="v112Set(\'kind\',this.value)">'+kinds.map(function(k){ return '<option value="'+k[0]+'"'+(S.sel.kind===k[0]?' selected':'')+'>'+esc(k[1])+'</option>'; }).join('')+'</select>'+
      '<select onchange="v112Set(\'period\',this.value)">'+pers.map(function(p){ return '<option value="'+esc(p.id)+'"'+(S.sel.period===p.id?' selected':'')+'>'+esc(periodLabel(p))+'</option>'; }).join('')+'</select>'+
      '<select onchange="v112Set(\'scope\',this.value)">'+scopes+'</select>'+
      '<span class="rpt-small">'+fl('Actuals come from Finance, finished tasks and final achievements — never typed.','الأرقام الفعلية من المالية والمهام المنجزة والإنجازات المعتمدة — لا تُكتب يدويًا.')+'</span></div>';
    h+='<div class="rpt-small" data-v112-legend="1" style="margin:4px 0 10px;line-height:2">'+['achieved','on_track','at_risk','behind','missed','not_measured','no_target'].map(chip).join(' ')+
      ' — '+fl('the light compares the share of target with how much of the period has passed.','يقارن الضوء نسبة الإنجاز من الهدف بما مضى من الفترة.')+'</div>';
    var objs=S.objs.filter(function(o){ return o.year===2026; }).sort(function(a,b){ return a.n-b.n; });
    var groups=objs.map(function(o){ return { o:o, defs:S.defs.filter(function(d){ return d.objective_id===o.id && d.active; }) }; });
    var loose=S.defs.filter(function(d){ return d.active && !objs.some(function(o){ return o.id===d.objective_id; }); });
    if(loose.length) groups.push({ o:null, defs:loose });
    var counts={};
    var rows=function(defs){ return defs.sort(function(a,b){ return (a.n||0)-(b.n||0); }).map(function(d){
      var pr=S.pace.filter(function(p){ return p.kpi_id===d.id && matches(p); })[0];
      var ac=S.actuals.filter(function(a){ return a.kpi_id===d.id && matches(a); })[0];
      var light=pr?(pr.light||'not_measured'):'no_target'; counts[light]=(counts[light]||0)+1;
      var actual=pr?pr.actual:(ac?ac.actual:null);
      var plan=(lists().kpis||[]).filter(function(k){ return k.n===d.n; })[0];
      var name=isAr()?(d.name_ar||(plan&&plan.tAr)||d.name_en):d.name_en;
      var note=(pr&&pr.lines_cost_missing>0)||(ac&&ac.lines_cost_missing>0)?'<div class="rpt-small" style="color:#9A4A0B">'+fl('Some invoices in this figure have no cost recorded yet — their profit equals their revenue.','بعض الفواتير في هذا الرقم بلا تكلفة مسجّلة بعد — ربحها يساوي إيرادها.')+'</div>':'';
      return '<tr data-v112-kpi="'+esc(d.n)+'"><td style="white-space:nowrap">KPI '+esc(d.n)+(d.is_draft?' <span class="tag">'+fl('draft','مسودة')+'</span>':'')+'</td>'+
        '<td>'+esc(name)+'<div class="rpt-small">'+esc(fl((SRC[d.method]||SRC.manual)[0],(SRC[d.method]||SRC.manual)[1]))+'</div>'+note+'</td>'+
        '<td style="white-space:nowrap">'+(pr?fmt(d.unit,pr.target_value):'—')+'</td>'+
        '<td style="white-space:nowrap" data-v112-actual="1">'+(actual==null?fl('not measured','غير مقاس'):fmt(d.unit,actual))+'</td>'+
        '<td style="white-space:nowrap">'+(pr&&pr.pct_of_target!=null?esc(pr.pct_of_target)+'%':'—')+'</td>'+
        '<td>'+chip(light)+'</td>'+
        '<td style="text-align:end;white-space:nowrap">'+(canSetTargets()?'<button class="btn ghost sm" onclick="v112Target(\''+esc(d.id)+'\')">'+(pr?fl('Change target','تغيير الهدف'):fl('Set target','تحديد هدف'))+'</button>':'')+'</td></tr>';
    }).join(''); };
    var body=groups.filter(function(g){ return g.defs.length; }).map(function(g){
      var title=g.o?('#'+g.o.n+' — '+(isAr()?(g.o.title_ar||g.o.title_en):g.o.title_en)):fl('Other KPIs','مؤشرات أخرى');
      return '<div class="card" style="margin-bottom:12px"><h3 style="margin:0 0 8px;font-size:14px">'+esc(title)+'</h3><div class="tbl-wrap"><table><thead><tr><th></th><th>'+fl('KPI','المؤشر')+'</th><th>'+fl('Target','الهدف')+'</th><th>'+fl('Actual','الفعلي')+'</th><th>'+fl('Of target','من الهدف')+'</th><th>'+fl('Light','الضوء')+'</th><th></th></tr></thead><tbody>'+rows(g.defs)+'</tbody></table></div></div>';
    }).join('');
    var sum='<div class="rpt-small" data-v112-summary="1" style="margin:0 0 10px">'+Object.keys(LIGHTS).filter(function(k){ return counts[k]; }).map(function(k){ return chip(k)+' '+counts[k]; }).join(' · ')+'</div>';
    b.innerHTML=h+sum+body;
  }
  try{ window.__rptTabs=Object.assign(window.__rptTabs||{}, { objectives:tab }); }catch(_){}

  /* setting a target: the database decides (admin, or manager with Full control on Reports) */
  window.v112Target=function(kpiId){
    var d=S.byId[kpiId]; if(!d) return;
    var pr=S.pace.filter(function(p){ return p.kpi_id===kpiId && matches(p); })[0];
    var per=S.periods.filter(function(p){ return p.id===S.sel.period; })[0];
    var whoTxt=S.sel.scope==='company'?fl('the company','الشركة'):S.sel.scope==='department'?depName(who()):personName(S.sel.who);
    openModal(fl('Target','الهدف')+' — KPI '+esc(d.n),
      '<div class="rpt-small" style="margin-bottom:8px">'+esc(isAr()?(d.name_ar||d.name_en):d.name_en)+' · '+esc(periodLabel(per))+' · '+esc(whoTxt)+'</div>'+
      '<div class="field"><label>'+fl('Target','الهدف')+' ('+esc(d.unit)+')</label><input type="number" min="0" id="v112_target" value="'+esc(pr?pr.target_value:'')+'"></div>'+
      '<div id="v112_msg" style="font-size:12.5px;color:#9B1C1C"></div>',
      function(){
        var c=client(); var v=(document.getElementById('v112_target')||{}).value; var m=document.getElementById('v112_msg');
        if(v===''||isNaN(Number(v))||Number(v)<0){ if(m) m.textContent=fl('Write the target as a number of zero or more.','اكتب الهدف رقمًا صفرًا أو أكثر.'); return false; }
        var row={ kpi_id:kpiId, scope:S.sel.scope, period_id:S.sel.period, target_value:Number(v),
          department_id:S.sel.scope==='department'?S.sel.who:null, member_id:S.sel.scope==='member'?S.sel.who:null };
        var go=pr&&pr.target_id?c.from('kpi_targets').update({ target_value:Number(v) }).eq('id',pr.target_id).select('id'):c.from('kpi_targets').insert(row).select('id');
        go.then(function(r){
          if(r.error||!r.data||!r.data.length){ if(m) m.textContent=(r.error&&/row-level security|permission/i.test(r.error.message||''))||!r.error?fl('The database refused: targets are set by an admin, or a manager with Full control on Reports.','رفضت قاعدة البيانات: يحدد الأهدافَ المسؤولُ أو مديرٌ لديه تحكم كامل في التقارير.'):(r.error.message||''); return; }
          try{ closeModal(); }catch(_){} say(fl('Target saved. Recorded in Activity & Audit.','حُفظ الهدف. سُجّل في السجل.')); load();
        });
        return false;
      });
  };

  /* ---------- Today: the company's KPIs off pace this period ---------- */
  function todayCard(){
    try{
      if(typeof current==='undefined'||current!=='today') return;
      var view=document.getElementById('view'); if(!view) return;
      var l=level(); if(!l||l==='none') return;
      if(!S.loaded){ if(!S.busy) load(); return; }
      if(S.err) return;                                           /* a failed read draws nothing — never "all fine" */
      var today=todayISO_();
      var cur=['month','quarter','year'].map(function(k){ return periodOf(k,today); }).filter(Boolean).map(function(p){ return p.id; });
      var bad=S.pace.filter(function(p){ return p.scope==='company' && cur.indexOf(p.period_id)>=0 && (p.light==='behind'||p.light==='at_risk'||p.light==='missed'); });
      var old=view.querySelector('.v112-today'); if(old) old.remove();
      if(!bad.length) return;
      var byLight={}; bad.forEach(function(p){ byLight[p.light]=(byLight[p.light]||0)+1; });
      var worst=bad.slice().sort(function(a,b){ return (a.pct_of_target||0)-(b.pct_of_target||0); }).slice(0,3);
      var d=document.createElement('div'); d.className='card v112-today'; d.setAttribute('data-v112-today',String(bad.length)); d.setAttribute('dir',isAr()?'rtl':'ltr');
      d.style.cssText='margin:12px 0;padding:12px 14px';
      d.innerHTML='<div style="font-weight:700;margin-bottom:6px">'+fl('Company KPIs off pace','مؤشرات الشركة المتأخرة عن المسار')+' — '+['missed','behind','at_risk'].filter(function(k){ return byLight[k]; }).map(function(k){ return chip(k)+' '+byLight[k]; }).join(' ')+'</div>'+
        worst.map(function(p){ var def=S.byId[p.kpi_id]||{}; var per=S.periods.filter(function(x){ return x.id===p.period_id; })[0];
          return '<div class="rpt-small" style="margin:2px 0">KPI '+esc(def.n)+' · '+esc(isAr()?(def.name_ar||def.name_en):def.name_en)+' · '+esc(periodLabel(per))+' · '+(p.pct_of_target!=null?esc(p.pct_of_target)+'%':fl('not measured','غير مقاس'))+'</div>'; }).join('')+
        '<a href="#" onclick="v112Open();return false" class="rpt-small">'+fl('Open Objectives & KPIs →','افتح الأهداف والمؤشرات ←')+'</a>';
      view.insertBefore(d, view.children[1]||null);
    }catch(e){ if(window.console) console.warn('[v112] today',e); }
  }
  window.v112Open=function(){ try{ openLead=null; current='reports'; if(typeof rptGo==='function'){ render(); rptGo('objectives'); } else render(); }catch(_){} };

  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(todayCard,90); }catch(_){} return o; };
    },200);
  }catch(_){}
  (function wait(n){ try{ if(client()&&window.__pageLevels&&!document.getElementById('cl_email')){ var l=level(); if(l&&l!=='none') load(); return; } }catch(_){} if(n<240) setTimeout(function(){ wait(n+1); },500); })(0);
  console.info('%c[v112] KPIs + the danger light loaded','color:#175CD3;font-weight:700');
}catch(e){ if(window.console) console.warn('[v112] init',e); }})();
