/* ===== Undo + the real who-did-what log (Spec 8, 2026-08-21) =====

   The database side is already live (built and verified against Postgres directly, not
   here): record_history — a trigger on businesses/finance_invoices/finance_transactions/
   client_profiles/contacts logging every create/edit/archive/restore/delete with actor,
   timestamp, and the full before/after row, written by the database so the browser cannot
   forget it and the log cannot be edited from the app — and undo_change(p_id), a function
   that puts a row back and returns either 'ok' or a plain-English refusal (24h window, own
   change vs anyone's, money tables admin/manager only, a hard-deleted row admin only,
   already-undone refused, 'create' entries refused since undoing a create isn't an undo).
   An undo re-fires the very same trigger, so the reversal is itself logged — it can never
   erase what happened, only add "and then this got put back."

   This file is the app side: the Undo control (here, and injected onto a lead/client's
   detail card), and Activity & Audit pointed at record_history instead of the old
   browser-written DB.audit array (js/core/core-06's renderActivity, capped at 800 entries,
   forgotten on a hard refresh if the tab crashed before autosave). renderActivity is fully
   replaced here — not wrapped — because there is nothing left to keep: DB.audit was a
   client-side approximation of exactly what this table now does for real.

   Scope note, deliberate: "an Undo control on the record" is built once, generically, and
   injected onto the ONE highest-traffic surface — the lead/client detail card (businesses).
   It is not duplicated onto invoice/transaction/client-profile/contact detail views
   individually; Activity & Audit already gives every one of those tables full coverage in
   one place, and five near-identical card-injectors would be five times the surface to keep
   in sync for no real gain over the one shared feed. */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){}
    /* Never build a fresh Supabase client in this file — window.fc() is the shared
       memoised client; see the standing rule in CLAUDE.md on why constructing a new one
       with no args is a page-wide outage waiting to happen. */
    return null;
  }

  /* undo_change() returns fixed English strings — this is the exact, exhaustive set from
     the live function body (read directly from Postgres before writing this), translated so
     the person reading the refusal reads it in their own language. Anything NOT in this map
     (a network error, a future new refusal the database starts returning) is shown VERBATIM
     rather than flattened into a generic "not allowed" — the spec was explicit that each
     refusal is already written for the person reading it. */
  var REFUSAL_AR={
    'That change is not in the log.':'هذا التغيير غير موجود في السجل.',
    'Already undone.':'تم التراجع عنه بالفعل.',
    'Too old to undo — this only works within 24 hours. Ask an admin to restore it.':'قديم جدًا على التراجع — يعمل هذا خلال 24 ساعة فقط. اطلب من أحد المسؤولين استعادته.',
    'Undoing a newly created record is not an undo — delete it instead, which is itself logged.':'التراجع عن إنشاء سجل جديد ليس تراجعًا — احذفه بدلاً من ذلك، والحذف نفسه يُسجَّل أيضًا.',
    'Nothing to put back.':'لا يوجد ما يمكن إعادته.',
    'Money records can only be undone by an admin or a manager.':'لا يمكن التراجع عن السجلات المالية إلا من قِبل مسؤول أو مدير.',
    "You can undo your own changes; an admin or manager can undo anyone's.":'يمكنك التراجع عن تغييراتك الخاصة؛ ويمكن للمسؤول أو المدير التراجع عن تغييرات أي شخص.',
    'Bringing back a fully deleted record is an admin action.':'استعادة سجل محذوف بالكامل إجراء يقتصر على المسؤول.'
  };
  function showResult(msg){
    var text=(isAr()&&REFUSAL_AR[msg])?REFUSAL_AR[msg]:msg;
    alert(text);
  }

  /* The one shared Undo call. p_id is record_history.id (bigint), not the record's own id.
     The 24-hour window and every permission rule are answered by the function itself — never
     computed here — so a stale tab can't offer an undo that the database will refuse anyway
     once clicked, and can't offer one that quietly turns out to have expired mid-click either. */
  window.undoRecordChange=function(historyId,onDone){
    var c=client(); if(!c||!c.rpc){ alert(fl('Not connected — try again in a moment.','غير متصل — حاول مرة أخرى بعد لحظة.')); return; }
    if(!confirm(fl('Undo this change?','التراجع عن هذا التغيير؟')))return;
    c.rpc('undo_change',{p_id:historyId}).then(function(r){
      if(r&&r.error){ showResult(r.error.message||String(r.error)); return; }
      var msg=r&&r.data;
      if(msg==='ok'){
        showResult(fl('Undone.','تم التراجع.'));
        try{ if(typeof onDone==='function') onDone(); }catch(_){}
      } else {
        showResult(msg||fl('No answer from the database.','لا يوجد رد من قاعدة البيانات.'));
      }
    }).catch(function(e){ showResult(String((e&&e.message)||e)); });
  };

  /* ---------- Activity & Audit — now reading record_history, not DB.audit ---------- */
  var HIST_CAP=500;   // named so the tile and the query can never drift apart
  var HIST={rows:null,loading:false,err:null};
  function histLoad(cb){
    var c=client(); if(!c){ setTimeout(function(){histLoad(cb);},400); return; }
    if(HIST.loading)return; HIST.loading=true;
    c.from('record_history').select('*').order('at',{ascending:false}).limit(HIST_CAP).then(function(r){
      HIST.loading=false;
      if(r.error){ HIST.err=r.error.message||String(r.error); HIST.rows=[]; }
      else { HIST.err=null; HIST.rows=Array.isArray(r.data)?r.data:[]; }
      try{ if(typeof cb==='function') cb(); }catch(_){}
    }).catch(function(e){ HIST.loading=false; HIST.err=String((e&&e.message)||e); HIST.rows=[]; try{if(typeof cb==='function')cb();}catch(_){} });
  }
  window.histRefresh=function(){ HIST.rows=null; if(typeof render==='function')render(); };

  // computed per call, not cached at parse time — LANG can change after this file loads,
  // and a module-level object built once would freeze these labels in whatever language was
  // active on first render
  function actionLabel(a){ return { create:fl('Created','أُنشئ'), edit:fl('Edited','عُدِّل'), delete:fl('Deleted','حُذف'), archive:fl('Archived','أُرشف'), restore:fl('Restored','استُعيد') }[a] || a; }
  function tableLabel(t){ return { businesses:fl('Lead / client','عميل محتمل / عميل'), finance_invoices:fl('Invoice','فاتورة'), finance_transactions:fl('Transaction','معاملة'), client_profiles:fl('Client profile','ملف العميل'), contacts:fl('Contact','جهة اتصال') }[t] || t; }
  function fmtWhen(iso){ try{ return new Date(iso).toLocaleString(isAr()?'ar':'en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(_){ return iso||''; } }
  function whatChanged(row){
    if(row.action!=='edit'||!row.before_row||!row.after_row)return '';
    var b=row.before_row,a=row.after_row,changed=[];
    Object.keys(a).forEach(function(k){
      if(k==='id'||k==='updated_at'||k==='created_at')return;
      var bv=JSON.stringify(b[k]),av=JSON.stringify(a[k]);
      if(bv!==av)changed.push(k);
    });
    if(!changed.length)return '';
    return changed.slice(0,6).join(', ')+(changed.length>6?' …':'');
  }
  function histRow(row){
    var canUndoAtAll = row.action!=='create' && !row.undone_at;
    var age=Date.now()-new Date(row.at).getTime();
    var withinWindow = age < 24*3600*1000;
    var btn = canUndoAtAll
      ? '<button class="btn sm" onclick="undoRecordChange('+row.id+',window.histRefresh)">'+fl('Undo','تراجع')+'</button>'
      : (row.undone_at ? '<span class="tag" style="background:#EEF0F5;color:#5b6178">'+fl('Undone','تم التراجع')+'</span>' : '');
    var changed=whatChanged(row);
    return '<div class="act-row"><span class="ts" title="'+(withinWindow?'':fl('Over 24h — Undo will likely be refused; click to see why','مضى أكثر من 24 ساعة — على الأرجح سيُرفض التراجع؛ اضغط لمعرفة السبب'))+'">'+esc(fmtWhen(row.at))+'</span>'+
      '<span class="ent">'+esc(tableLabel(row.table_name))+' · '+esc(actionLabel(row.action))+'</span>'+
      '<span>'+esc(row.actor_name||'—')+(changed?' <span style="color:var(--muted)">— '+esc(changed)+'</span>':'')+'</span>'+
      '<span>'+btn+'</span></div>';
  }
  window.renderActivity=function(v){
    if(HIST.rows==null){ histLoad(function(){ if(typeof render==='function')render(); }); }
    var rows=HIST.rows||[];
    var today=rows.filter(function(r){return Date.now()-new Date(r.at).getTime()<86400000;}).length;
    var week=rows.filter(function(r){return Date.now()-new Date(r.at).getTime()<7*86400000;}).length;
    /* 2026-09-02 (round 37): the query above asks for the most recent HIST_CAP entries. The
       tile has always been honestly labelled "Events loaded" rather than "Total events", and
       Today / 7-day are exact as long as the window fits inside the cap — which it does today
       (242 rows live). But when the cap is actually reached, nothing said so: a reader would
       see a round number and no reason to doubt it, and the 7-day count could then be an
       undercount rather than a count. Say it, but only when it is true. */
    var atCap=rows.length>=HIST_CAP;
    v.innerHTML=
      '<div class="card" style="display:flex;flex-wrap:wrap;gap:18px;padding:14px 20px;margin-bottom:14px">'+
        '<div><div class="kl">'+fl('Events loaded','الأحداث المحمّلة')+'</div><div class="kv">'+rows.length+'</div>'+(atCap?('<div style="font-size:10.5px;font-weight:600;color:#B54708;margin-top:2px">'+fl('the most recent '+HIST_CAP+' — there are older ones','أحدث '+HIST_CAP+' فقط — توجد سجلات أقدم')+'</div>'):'')+'</div>'+
        '<div><div class="kl">'+fl('Today','اليوم')+'</div><div class="kv" style="color:#2E90FA">'+today+'</div></div>'+
        '<div><div class="kl">'+fl('7-day','٧ أيام')+'</div><div class="kv" style="color:#16B364">'+week+(atCap?'+':'')+'</div>'+(atCap?('<div style="font-size:10.5px;font-weight:600;color:#B54708;margin-top:2px">'+fl('at least — the log was capped','على الأقل — السجل مقطوع')+'</div>'):'')+'</div>'+
        '<div style="flex:1"></div><button class="btn sm ghost" onclick="histRefresh()">'+fl('↻ Refresh','↻ تحديث')+'</button>'+
      '</div>'+
      (HIST.err?'<div class="card" style="border-color:#F0453A"><b style="color:#D92D20">'+fl('Could not load the log:','تعذّر تحميل السجل:')+'</b> '+esc(HIST.err)+'</div>':'')+
      '<div class="card"><h3>'+fl('Activity & Audit','النشاط والتدقيق')+'</h3>'+
      '<div class="ch-sub">'+fl('Written by the database on every change — cannot be edited from here, and an undo is itself logged.','تكتبها قاعدة البيانات مع كل تغيير — لا يمكن تعديلها من هنا، والتراجع نفسه يُسجَّل أيضًا.')+'</div>'+
      '<div class="act-feed">'+(rows.length?rows.map(histRow).join(''):'<div class="empty">'+(HIST.loading?fl('Loading…','جارٍ التحميل…'):fl('No activity yet.','لا يوجد نشاط بعد.'))+'</div>')+'</div>'+
      '</div>';
  };

  /* ---------- Undo control on the record — lead/client detail card ---------- */
  (function(){
    function injectRecordHistory(){
      try{
        if(typeof current==='undefined'||current!=='leads')return;
        if(typeof openLead==='undefined'||!openLead)return;
        if(typeof leadDetailView!=='undefined'&&leadDetailView!=='detail')return;
        var view=document.getElementById('view'); if(!view)return;
        var head=view.querySelector('.detail-head'); if(!head)return;
        if(view.querySelector('.v63-record-hist'))return; // already injected this render
        var biz=(typeof getLead==='function')?getLead(openLead):null; if(!biz)return;
        var bizUuid=(window.__bizUuid?window.__bizUuid(biz.id):biz.id);
        // legacy_id / non-uuid ids (test data, unsynced rows) have no real database row to
        // look up history for — show nothing rather than a query that can never match
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(bizUuid)))return;
        var c=client(); if(!c)return;
        var card=document.createElement('div');
        card.className='card v63-record-hist';
        card.style.cssText='margin:0 0 14px';
        card.innerHTML='<h3>'+fl('Recent changes','التغييرات الأخيرة')+'</h3><div class="act-feed">'+fl('Loading…','جارٍ التحميل…')+'</div>';
        head.insertAdjacentElement('afterend',card);
        c.from('record_history').select('*').eq('table_name','businesses').eq('record_id',bizUuid).order('at',{ascending:false}).limit(5).then(function(r){
          var feed=card.querySelector('.act-feed'); if(!feed)return;
          var rows=(!r.error&&Array.isArray(r.data))?r.data:[];
          feed.innerHTML=rows.length?rows.map(histRow).join(''):'<div class="empty">'+fl('No logged changes yet for this record.','لا توجد تغييرات مسجَّلة لهذا السجل بعد.')+'</div>';
        }).catch(function(){ var feed=card.querySelector('.act-feed'); if(feed)feed.innerHTML='<div class="empty">'+fl('Could not load.','تعذّر التحميل.')+'</div>'; });
      }catch(e){ if(window.console)console.warn('[v63] record history card',e); }
    }
    if(typeof render==='function'){ var _r63=render; window.render=function(){ var o=_r63.apply(this,arguments); injectRecordHistory(); return o; }; }
  })();
}catch(e){ if(window.console)console.warn('[v63] init',e); }})();
