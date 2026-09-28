/* ===== 115 · The change log on every record (owner's decision 2 of 27 Sep; DECISIONS D13) =====

   "Change log on every record: who, when, field, before, after. Visible to admin + manager only for now."

   Where it comes from: the database's own log (record_history), which a trigger writes on every change to every record
   table (scripts/sql/change-log-and-qa-account.sql), read through the view record_changes — one row per FIELD that
   changed, with its value before and after. A company's `raw` record is opened one level there, so a change inside it
   reads as that field ("stage"), not as the whole record.
   Who sees it: the database answers only an admin or a manager (the log's read rule); everyone else gets no rows. So the
   buttons are only drawn for those two roles — a button that would open an empty window for anyone else is not drawn.

   Where it opens:
     · the company page — a "Full change log" button on its "Recent changes" card (js/63);
     · a task's window (js/108) — "Change log" in its title bar;
     · a person's Edit window and a team's Rename window on People & teams (js/114);
     · any line of Activity & Audit — "Log" opens that record's whole history (js/63).
   It opens in its own window ON TOP of the one you were in, so nothing you were typing is lost.
   window.openChangeLog(targets, title) — targets: [{table, key}] (one or several records, e.g. a person's login and
   their team-list entry). */
(function(){try{
  if(window.__v115) return; window.__v115=true;
  function isAr(){ return (typeof LANG!=='undefined'&&LANG==='ar'); }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function role(){ try{ return window.__userRole||null; }catch(_){ return null; } }
  var canSee=window.changeLogVisible=function(){ var r=role(); return r==='admin'||r==='manager'; };

  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function fieldWord(k){
    var inner=String(k||'').replace(/^raw\./,'');
    try{ if(typeof window.__histFieldWord==='function') return window.__histFieldWord(inner); }catch(_){}
    return inner.replace(/_sar$/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toLowerCase();
  }
  function actorWord(n){ try{ if(typeof window.__histActorWord==='function') return window.__histActorWord(n); }catch(_){} return String(n||'—'); }
  function when(iso){ try{ return new Date(iso).toLocaleString(isAr()?'ar':'en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(_){ return iso||''; } }
  function actionWord(a){ return ({create:fl('Created','أُنشئ'),edit:fl('Edited','عُدِّل'),delete:fl('Deleted','حُذف'),archive:fl('Archived','أُرشف'),restore:fl('Restored','استُعيد')})[a]||a; }
  function val(v){
    if(v===null||v===undefined||v==='') return '<span style="color:var(--muted)">—</span>';
    if(typeof v==='boolean') return v?fl('Yes','نعم'):fl('No','لا');
    if(typeof v==='object'){ var s=JSON.stringify(v); return '<span title="'+esc(s)+'">'+esc(s.length>160?s.slice(0,160)+'…':s)+'</span>'; }
    var t=String(v); return '<span title="'+esc(t)+'">'+esc(t.length>200?t.slice(0,200)+'…':t)+'</span>';
  }

  function overlay(){
    var ov=document.getElementById('v115-ov');
    if(!ov){
      ov=document.createElement('div'); ov.id='v115-ov';
      ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Change log');
      ov.style.cssText='position:fixed;inset:0;background:rgba(20,24,33,.45);z-index:10050;display:none;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
      ov.addEventListener('click',function(e){ if(e.target===ov) closeLog(); });
      document.body.appendChild(ov);
    }
    return ov;
  }
  /* the keyboard (probe-every-box-takes-the-keyboard): opening it takes the keyboard into the window (core-06's shared
     trap, the one every box here uses), Tab stays inside, and closing gives it back to whatever opened it. Each redraw
     inside (Loading… → the log) puts it back on Close if it had fallen out with the old content. */
  var prevFocus=null;
  function setInner(ov,html){
    ov.innerHTML=html;
    try{ if(!ov._v21focusH&&typeof v21TrapFocus==='function') v21TrapFocus(ov); }catch(_){}
    try{ if(!ov.contains(document.activeElement)){ var x=ov.querySelector('[data-v115-close]'); if(x) x.focus(); } }catch(_){}
  }
  function closeLog(){
    var ov=document.getElementById('v115-ov'); if(!ov||ov.style.display==='none') return;
    try{ if(typeof window.v21ReleaseTrap==='function') window.v21ReleaseTrap(ov); else if(typeof v21ReleaseTrap==='function') v21ReleaseTrap(ov); }catch(_){}
    ov.style.display='none'; ov.innerHTML='';
    try{ if(prevFocus&&prevFocus.focus&&document.contains(prevFocus)) prevFocus.focus(); }catch(_){} prevFocus=null;
  }
  window.closeChangeLog=closeLog;
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ var ov=document.getElementById('v115-ov'); if(ov&&ov.style.display!=='none'){ e.stopPropagation(); closeLog(); } } },true);

  function frame(title,inner){
    return '<div class="card" data-v115-log="1" dir="'+(isAr()?'rtl':'ltr')+'" style="max-width:900px;width:100%;margin:0;padding:18px 20px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><h3 style="margin:0;flex:1">'+fl('Change log','سجل التغييرات')+(title?' — '+esc(title):'')+'</h3>'+
      '<button class="btn sm ghost" data-v115-close="1" onclick="closeChangeLog()">'+fl('Close','إغلاق')+'</button></div>'+
      '<div class="ch-sub" style="margin-bottom:12px">'+fl('Written by the database on every change: who, when, which field, before and after. Shown to admins and managers only.',
        'تكتبه قاعدة البيانات مع كل تغيير: من، ومتى، وأي حقل، وقبل وبعد. يظهر للمسؤولين والمدراء فقط.')+'</div>'+inner+'</div>';
  }

  var LABELS=null;
  window.openChangeLog=function(targets,title,labels){
    LABELS=labels||null;
    var ov=overlay();
    if(ov.style.display==='none'||!ov.style.display){ try{ prevFocus=document.activeElement; }catch(_){ prevFocus=null; } }
    ov.style.display='flex';
    var _ov=ov; ov={ set innerHTML(h){ setInner(_ov,h); } };
    if(!canSee()){ ov.innerHTML=frame(title,'<div class="empty">'+fl('The change log is shown to admins and managers.','سجل التغييرات يظهر للمسؤولين والمدراء فقط.')+'</div>'); return; }
    /* {table, all:true} = every record of that table, the removed ones too (F4, 28 Sep: the Rules log asked only for the
       rules still on screen, so a rule switched off, on and then removed showed its creation and nothing after) */
    targets=(targets||[]).filter(function(t){ return t&&t.table&&(t.all===true||(t.key!=null&&String(t.key)!=='')); });
    if(!targets.length){ ov.innerHTML=frame(title,'<div class="empty">'+fl('This record has no saved key yet — nothing to show.','لا يوجد مفتاح محفوظ لهذا السجل بعد — لا شيء لعرضه.')+'</div>'); return; }
    ov.innerHTML=frame(title,'<div class="empty">'+fl('Loading…','جارٍ التحميل…')+'</div>');
    var c=client(); if(!c){ ov.innerHTML=frame(title,'<div class="empty">'+fl('Not connected — try again in a moment.','غير متصل — حاول مرة أخرى بعد لحظة.')+'</div>'); return; }
    var qy=c.from('record_changes').select('history_id,at,actor_name,table_name,record_key,action,undone_at,field,before_value,after_value');
    if(targets.length===1&&targets[0].all===true) qy=qy.eq('table_name',targets[0].table);
    else if(targets.length===1) qy=qy.eq('table_name',targets[0].table).eq('record_key',String(targets[0].key));
    else qy=qy.or(targets.map(function(t){ return t.all===true?'table_name.eq.'+t.table:'and(table_name.eq.'+t.table+',record_key.eq.'+String(t.key)+')'; }).join(','));
    qy.order('history_id',{ascending:false}).limit(600).then(function(r){
      if(r.error){ ov.innerHTML=frame(title,'<div class="empty" style="color:#D92D20">'+fl('Could not load the log: ','تعذّر تحميل السجل: ')+esc(r.error.message||r.error)+'</div>'); return; }
      ov.innerHTML=frame(title,draw(Array.isArray(r.data)?r.data:[],targets.length>1));
    }).catch(function(e){ ov.innerHTML=frame(title,'<div class="empty" style="color:#D92D20">'+esc(String((e&&e.message)||e))+'</div>'); });
  };

  var TABLE_WORD={ app_users:['login','الحساب'], team_members:['team list','قائمة الفريق'] };
  function draw(rows,several){
    if(!rows.length) return '<div class="empty" data-v115-empty="1">'+fl('No logged changes for this record yet.','لا توجد تغييرات مسجَّلة لهذا السجل بعد.')+'</div>';
    var events=[], byId={};
    rows.forEach(function(x){ var e=byId[x.history_id]; if(!e){ e=byId[x.history_id]={id:x.history_id,at:x.at,who:x.actor_name,action:x.action,table:x.table_name,key:x.record_key,undone:x.undone_at,fields:[]}; events.push(e); } e.fields.push(x); });
    var head='<tr style="text-align:start;color:var(--muted);font-size:11.5px"><th style="text-align:start;padding:4px 8px 4px 0">'+fl('Field','الحقل')+'</th><th style="text-align:start;padding:4px 8px">'+fl('Before','قبل')+'</th><th style="text-align:start;padding:4px 0 4px 8px">'+fl('After','بعد')+'</th></tr>';
    return '<div data-v115-events="'+events.length+'">'+events.map(function(e){
      var tw=several&&TABLE_WORD[e.table]?' · '+(isAr()?TABLE_WORD[e.table][1]:TABLE_WORD[e.table][0]):'';
      if(LABELS&&LABELS[e.key]) tw+=' · '+LABELS[e.key];   // which record, when one log covers a whole table
      var lines=e.fields.map(function(f){
        return '<tr data-v115-field="'+esc(f.field)+'" style="border-top:1px solid var(--line,#EFE9DF);vertical-align:top">'+
          '<td style="padding:5px 8px 5px 0;font-weight:600;white-space:nowrap" title="'+esc(f.field)+'">'+esc(fieldWord(f.field))+'</td>'+
          '<td style="padding:5px 8px;color:#8b5b1f;word-break:break-word">'+val(f.before_value)+'</td>'+
          '<td style="padding:5px 0 5px 8px;color:#0F6E56;word-break:break-word">'+val(f.after_value)+'</td></tr>';
      }).join('');
      var table='<table style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed"><colgroup><col style="width:24%"><col style="width:38%"><col style="width:38%"></colgroup>'+head+lines+'</table>';
      /* a creation or a full deletion lists every field it set or removed — useful, but long: folded, one click opens it */
      var body=(e.action==='create'||(e.action==='delete'&&e.fields.length>6))?
        '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:12px;color:var(--muted)">'+fl(e.fields.length+' field(s)',e.fields.length+' حقل')+'</summary>'+table+'</details>':table;
      return '<div class="v115-event" data-v115-event="'+e.id+'" style="padding:10px 0;border-bottom:1px solid var(--line,#EFE9DF)">'+
        '<div style="font-size:12.5px"><span style="color:var(--muted)">'+esc(when(e.at))+'</span> · <b>'+esc(actorWord(e.who))+'</b> · '+esc(actionWord(e.action))+esc(tw)+
        (e.undone?' · <span class="tag" style="background:#EEF0F5;color:#5b6178">'+fl('Undone','تم التراجع')+'</span>':'')+'</div>'+body+'</div>';
    }).join('')+'</div>';
  }

  /* ---------- the buttons ---------- */
  function logBtn(onclick){ return '<button class="btn sm ghost" data-v115-open="1" onclick="'+onclick+'">'+fl('Change log','سجل التغييرات')+'</button>'; }
  function addToModalHead(onclick){
    try{
      if(!canSee()) return;
      var m=document.getElementById('modal'); var h=m&&m.querySelector('.mh'); if(!h||h.querySelector('[data-v115-open]')) return;
      var x=h.querySelector('.iconbtn'); var span=document.createElement('span'); span.style.cssText='margin-inline-start:auto;margin-inline-end:8px';
      span.innerHTML=logBtn(onclick); if(x) h.insertBefore(span,x); else h.appendChild(span);
    }catch(_){}
  }
  function js(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function wrap(name,after){
    var tries=0, iv=setInterval(function(){
      tries++; var f=window[name];
      if(typeof f==='function'&&!f.__v115){ var w=function(){ var o=f.apply(this,arguments); var a=arguments; try{ after.apply(null,a); }catch(_){} return o; }; w.__v115=true; window[name]=w; clearInterval(iv); }
      else if(tries>120) clearInterval(iv);
    },250);
  }
  /* a task's window (js/108) */
  wrap('v108Open',function(id){
    var t=null; try{ t=((window.__v108State&&window.__v108State.tasks)||[]).find(function(x){ return x.id===id; }); }catch(_){}
    addToModalHead("openChangeLog([{table:'tasks',key:'"+js(id)+"'}],'"+js(t?(t.code||t.title):'')+"')");
  });
  /* a person's Edit window and a team's Rename window (js/114) */
  wrap('v114EditPerson',function(uid){
    var T=window.__v114||{}, p=(T.people||[]).find(function(x){ return x.id===uid; })||{}, m=(T.members||[]).find(function(x){ return x.user_id===uid; });
    var tg="[{table:'app_users',key:'"+js(uid)+"'}"+(m?",{table:'team_members',key:'"+js(m.id)+"'}":'')+"]";
    addToModalHead('openChangeLog('+tg+",'"+js(isAr()?(p.name_ar||p.full_name||p.email):(p.full_name||p.email))+"')");
  });
  wrap('v114RenameTeam',function(id){
    var d=((window.__v114||{}).deps||[]).find(function(x){ return x.id===id; })||{};
    addToModalHead("openChangeLog([{table:'departments',key:'"+js(id)+"'}],'"+js(isAr()?d.name_ar:d.name_en)+"')");
  });
  window.__v115LogBtn=logBtn; window.__v115Js=js; window.__v115Uuid=UUID;
}catch(e){ if(window.console) console.warn('[v115] change log',e); }})();
