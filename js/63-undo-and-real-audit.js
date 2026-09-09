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
  /* 2026-09-09 (live test D1): alert()/confirm() froze the owner's tabs. The answer to an Undo is
     shown in a small in-page notice that stays until dismissed (a toast is gone in two seconds
     and these sentences matter), and the question goes through js/57's box. */
  window.v63Notice=function(text){
    try{
      var old=document.getElementById('v63Notice'); if(old)old.remove();
      var d=document.createElement('div'); d.id='v63Notice';
      /* a card at the top of the screen, NOT a full-screen overlay: it stays until dismissed but
         never blocks the rest of the page (the old alert() did, and so did the first cut of this) */
      d.style.cssText='position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:1000000001;max-width:min(420px,92vw);background:var(--card,#fff);border:1px solid #E3DCCF;border-radius:12px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25)';
      d.innerHTML='<div data-v63-text style="font-size:13.5px;line-height:1.5;margin-bottom:12px">'+esc(text)+'</div><div style="display:flex;justify-content:'+(isAr()?'flex-start':'flex-end')+'"><button class="btn sm pri" id="v63NoticeOk">'+fl('OK','حسنًا')+'</button></div>';
      document.body.appendChild(d);
      var close=function(){ try{ d.remove(); }catch(_){} };
      document.getElementById('v63NoticeOk').onclick=close;
      setTimeout(function(){ try{ document.getElementById('v63NoticeOk').focus(); }catch(_){} },30);
    }catch(_){ try{ if(typeof toast==='function') toast(text); }catch(__){} }
  };
  function showResult(msg){
    var text=(isAr()&&REFUSAL_AR[msg])?REFUSAL_AR[msg]:msg;
    window.v63Notice(text);
  }

  /* The one shared Undo call. p_id is record_history.id (bigint), not the record's own id.
     The 24-hour window and every permission rule are answered by the function itself — never
     computed here — so a stale tab can't offer an undo that the database will refuse anyway
     once clicked, and can't offer one that quietly turns out to have expired mid-click either. */
  window.undoRecordChange=function(historyId,onDone){
    var c=client(); if(!c||!c.rpc){ showResult(fl('Not connected — try again in a moment.','غير متصل — حاول مرة أخرى بعد لحظة.')); return; }
    var go=function(){ c.rpc('undo_change',{p_id:historyId}).then(function(r){
      if(r&&r.error){ showResult(r.error.message||String(r.error)); return; }
      var msg=r&&r.data;
      if(msg==='ok'){
        showResult(fl('Undone.','تم التراجع.'));
        try{ if(typeof onDone==='function') onDone(); }catch(_){}
      } else {
        showResult(msg||fl('No answer from the database.','لا يوجد رد من قاعدة البيانات.'));
      }
    }).catch(function(e){ showResult(String((e&&e.message)||e)); }); };
    if(typeof window.pfConfirm==='function') window.pfConfirm(fl('Undo this change?','التراجع عن هذا التغيير؟'),go); else go();
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
  /* 2026-09-09 (live test, AU2 + AU3): every row read "Lead / client · Edited — unknown — raw"
     — no record named, and the column names of the database as the description. A person
     cannot tell WHICH client changed or WHAT about it. Now: the record's own name (or invoice
     number, transaction reference, contact name) sits on the row, and each changed column is
     said in words; a change inside the `raw` record is opened up to the fields that moved
     inside it. The database column stays available as a tooltip for anyone who needs it. */
  var FIELD_WORDS={
    raw:['record details','تفاصيل السجل'], stage:['stage','المرحلة'], status:['status','الحالة'], tier:['tier','الفئة'], name:['name','الاسم'], name_ar:['Arabic name','الاسم بالعربية'],
    segment:['segment','القطاع'], category:['category','التصنيف'], notes:['notes','الملاحظات'], archived_by:['archived by','أُرشف بواسطة'], archived_at:['archived','تاريخ الأرشفة'],
    converted_date:['became a client on','تاريخ التحول إلى عميل'], is_client:['client flag','علامة العميل'], assigned_to:['owner','المسؤول'], account_manager:['account manager','مدير الحساب'],
    business_id:['linked company','الشركة المرتبطة'], client_profile_id:['linked profile','الملف المرتبط'], contract_start:['contract start','بداية العقد'], contract_end:['contract end','نهاية العقد'],
    payment_terms:['payment terms','شروط الدفع'], credit_limit:['credit limit','حد الائتمان'], closed_at:['closed on','تاريخ الإغلاق'], confirmation_reason:['confirmation note','ملاحظة التأكيد'],
    needs_manual_confirmation:['needs manual confirmation','بحاجة إلى تأكيد يدوي'], cost_sar:['cost','التكلفة'], profit_sar:['profit','الربح'], revenue_sar:['revenue','الإيراد'], cost_confirmed_sar:['confirmed cost','التكلفة المؤكدة'],
    cost_estimate_sar:['estimated cost','التكلفة التقديرية'], amount_sar:['amount','المبلغ'], invoice_no:['invoice number','رقم الفاتورة'], client_group:['client group','مجموعة العميل'], integrity_status:['status','الحالة'],
    email:['email','البريد'], phone:['phone','الهاتف'], role:['role','الدور'], next_action_date:['next action date','تاريخ الإجراء التالي'], next_action_note:['next action','الإجراء التالي'], funnel_details:['funnel answers','إجابات القناة'],
    activities:['activity log','سجل النشاط'], lastContact:['last contact','آخر تواصل'], contacts:['contacts','جهات الاتصال'], isClient:['client flag','علامة العميل'], assignedTo:['owner','المسؤول'], nextAction:['next action','الإجراء التالي'],
    dueDate:['due date','تاريخ الاستحقاق'], services:['services','الخدمات'], channels:['channels','القنوات'], nameAr:['Arabic name','الاسم بالعربية'], source:['source','المصدر'], funnelKey:['funnel','القناة'], website:['website','الموقع']
  };
  function fieldWord(k){ var w=FIELD_WORDS[k]; if(w) return isAr()?w[1]:w[0]; return String(k).replace(/_sar$/,'').replace(/_/g,' '); }
  function diffKeys(b,a){
    var out=[]; try{ Object.keys(Object.assign({},b||{},a||{})).forEach(function(k){ if(k==='id'||k==='updated_at'||k==='created_at')return; if(JSON.stringify((b||{})[k])!==JSON.stringify((a||{})[k]))out.push(k); }); }catch(_){}
    return out;
  }
  function whatChanged(row){
    if(row.action!=='edit'||!row.before_row||!row.after_row)return '';
    var b=row.before_row,a=row.after_row,changed=diffKeys(b,a),words=[];
    changed.forEach(function(k){
      if(k==='raw'&&b.raw&&a.raw&&typeof b.raw==='object'&&typeof a.raw==='object'){
        var inner=diffKeys(b.raw,a.raw).filter(function(x){return !/^_/.test(x);});
        inner.slice(0,4).forEach(function(x){ words.push(fieldWord(x)); });
        if(inner.length>4) words.push('…'); if(!inner.length) words.push(fieldWord('raw'));
      } else words.push(fieldWord(k));
    });
    if(!words.length)return '';
    var seen={}; words=words.filter(function(w){ if(seen[w])return false; seen[w]=1; return true; });
    return words.slice(0,6).join(', ')+(words.length>6?' …':'');
  }
  function columnsChanged(row){ try{ return diffKeys(row.before_row,row.after_row).join(', '); }catch(_){ return ''; } }
  function recordName(row){
    var r=row.after_row||row.before_row||{}; var raw=(r.raw&&typeof r.raw==='object')?r.raw:{};
    var n=r.name||raw.name||r.full_name||r.invoice_no||r.transaction_ref||r.receipt_ref||r.client_group||r.customer_raw_name||r.profile_type||r.direct_client_id||'';
    if(!n&&row.table_name==='client_profiles'&&r.business_id)n=fl('a client profile','ملف عميل');
    if(!n&&row.table_name==='contacts'&&(r.email||r.phone))n=r.email||r.phone;
    return n?String(n):'';
  }
  var KNOWN_TABLES={businesses:1,finance_invoices:1,finance_transactions:1,client_profiles:1,contacts:1};
  function histRow(row){
    /* 2026-09-09 (live test, AU4): "Undo" was offered on 18-day-old deletions while the text
       promised 24 hours, and on rows no function can undo (an access log line). A button that
       will be refused is a lie in a button. Past the window, or on a row of an unknown kind, the
       row says so instead. */
    var age=Date.now()-new Date(row.at).getTime();
    var withinWindow = age < 24*3600*1000;
    var undoable = row.action!=='create' && !row.undone_at && KNOWN_TABLES[row.table_name] && row.before_row;
    var btn;
    if(row.undone_at) btn='<span class="tag" style="background:#EEF0F5;color:#5b6178">'+fl('Undone','تم التراجع')+'</span>';
    else if(undoable&&withinWindow) btn='<button class="btn sm" onclick="undoRecordChange('+row.id+',window.histRefresh)">'+fl('Undo','تراجع')+'</button>';
    else if(undoable) btn='<span data-undo-expired="1" style="font-size:11px;color:var(--muted)" title="'+fl('Undo works for 24 hours after a change; after that an admin restores it in the database.','يعمل التراجع لمدة 24 ساعة بعد التغيير؛ بعدها يستعيده مسؤول من قاعدة البيانات.')+'">'+fl('past the 24-hour undo window','انقضت مهلة التراجع (24 ساعة)')+'</span>';
    else btn='';
    var changed=whatChanged(row), name=recordName(row), cols=columnsChanged(row);
    return '<div class="act-row" data-hist-id="'+row.id+'" style="display:grid;grid-template-columns:150px minmax(0,1.1fr) minmax(0,1.4fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line,#EFE9DF);font-size:12.5px">'+
      '<span class="ts" style="color:var(--muted);font-size:11.5px">'+esc(fmtWhen(row.at))+'</span>'+
      '<span class="ent"><b>'+esc(tableLabel(row.table_name))+'</b> · '+esc(actionLabel(row.action))+(name?' · <span data-hist-name="1" style="font-weight:700">'+esc(name)+'</span>':'')+'</span>'+
      '<span><span style="font-weight:600">'+esc(row.actor_name||'—')+'</span>'+(changed?' <span data-hist-fields="1" style="color:var(--muted)" title="'+esc(cols)+'">— '+esc(changed)+'</span>':'')+'</span>'+
      '<span style="text-align:end">'+btn+'</span></div>';
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
        card.setAttribute('data-rec',String(bizUuid));
        fillRecordHistory(card,bizUuid);
      }catch(e){ if(window.console)console.warn('[v63] record history card',e); }
    }
    function fillRecordHistory(card,bizUuid){
      var c=client(); if(!c)return;
      c.from('record_history').select('*').eq('table_name','businesses').eq('record_id',bizUuid).order('at',{ascending:false}).limit(5).then(function(r){
        var feed=card.querySelector('.act-feed'); if(!feed)return;
        var rows=(!r.error&&Array.isArray(r.data))?r.data:[];
        feed.innerHTML=rows.length?rows.map(histRow).join(''):'<div class="empty">'+fl('No logged changes yet for this record.','لا توجد تغييرات مسجَّلة لهذا السجل بعد.')+'</div>';
        card.setAttribute('data-filled',String(Date.now()));
      }).catch(function(){ var feed=card.querySelector('.act-feed'); if(feed)feed.innerHTML='<div class="empty">'+fl('Could not load.','تعذّر التحميل.')+'</div>'; });
    }
    /* 2026-09-09 (live test A3): "No logged changes yet" straight after a save. The card is drawn
       by the render() that follows a save, but the row it is looking for is written by the
       database trigger when the cloud save lands ~1 s later. Re-read the card once the pill says
       Saved (js/02 announces every real round trip through __pillHook; chained here like js/75). */
    window.v63RefreshRecordHistory=function(){ try{ var card=document.querySelector('#view .v63-record-hist'); var id=card&&card.getAttribute('data-rec'); if(card&&id) fillRecordHistory(card,id); }catch(_){} };
    try{ var _prevPill=window.__pillHook; window.__pillHook=function(text,colour){ try{ if(/^Saved/i.test(String(text||''))) setTimeout(window.v63RefreshRecordHistory,400); }catch(_){} if(_prevPill) return _prevPill.apply(this,arguments); }; }catch(_){}
    if(typeof render==='function'){ var _r63=render; window.render=function(){ var o=_r63.apply(this,arguments); injectRecordHistory(); return o; }; }
  })();
}catch(e){ if(window.console)console.warn('[v63] init',e); }})();
