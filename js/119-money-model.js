/* 119 — the money model on screen (D1, 2026-09-28; DECISIONS D21). Three things, all read from what the database already
   decided (money_rows) — nothing here computes a figure of its own:

   1. PERFORMANCE → "Needs attention": the invoices a total leaves out or flags, each with its count and SAR, in plain words —
      waiting for cost, loss-making, "Fully Paid (Audit Required)", wallet top-ups (stored, never revenue), billing invoices
      linked to their transactions (zero revenue), not paid yet, and invoice lines whose item name nobody has classed yet.
   2. "Month by": the paid date (the default — invoice_date holds it for a paid invoice) or the date the invoice was created.
      Reports and KPIs always count by the paid date; the switch only regroups Performance, and says so.
   3. FINANCE → RULES → "Invoice item names": the list a person keeps of which item names are pass-through and which are
      Direct's fee. It only changes the "pass-through on the invoice" figure shown beside the cost — never cost or profit
      (the item split is a VAT split, not cost: owner, 22 Aug). Admins and managers with Full on Finance add and remove;
      a removal asks first, naming the item (D19), and stays removed; everything is in the change log. */
(function(){try{
  function fl(en,ar){ try{ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }catch(_){ return en; } }
  function e(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function n0(v){ try{ return (typeof money0==='function')?money0(v):Math.round(+v||0).toLocaleString('en-US'); }catch(_){ return String(Math.round(+v||0)); } }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function role(){ return window.__userRole||''; }
  function canEdit(){ try{ if(window.__isShareView) return false; return (role()==='admin'||role()==='manager')&&typeof window.finCanWrite==='function'&&!!window.finCanWrite(); }catch(_){ return false; } }   // as js/117: the database says the same

  /* ---------- 1. Needs attention ---------- */
  function rowsInPeriod(){
    var rows=((window.FIN&&FIN.rows)||[]).filter(function(r){ return !r.deleted_at; });
    try{ if(typeof finInPeriod==='function') return rows.filter(function(r){ return finInPeriod(r); }); }catch(_){}
    return rows;
  }
  function attention(){
    if(!window.FIN||!FIN.rows||!FIN.m) return '';
    var m=FIN.m, R=rowsInPeriod(), g={};
    function add(k,r){ var x=g[k]=g[k]||{n:0,sar:0,refs:[],ids:[]}; x.n++; x.sar+=(+r.total_incl_vat_sar||0); x.ids.push(r.id); if(x.refs.length<8) x.refs.push(r.invoice_no); }
    R.forEach(function(r){
      var v=m[r.id]||{};
      if(r.row_kind==='wallet_topup') { add('topup',r); return; }
      if(r.row_kind==='billing_link') { add('billing',r); return; }
      if(v.counts===true){
        if(v.cost_missing) add('nocost',r);
        if(v.loss) add('loss',r);
        if(r.audit_required) add('audit',r);
        if(+v.unclassed_sar>0) add('unclassed',r);
      } else if(r.integrity_status!=='verified_paid'&&!v.excluded) add('unpaid',r);
    });
    var L=[
      ['nocost', fl('Waiting for their cost — left out of cost and profit','بانتظار تكلفتها — خارج التكلفة والربح'),'#B54708'],
      ['loss', fl('Loss-making — approved cost above revenue','خاسرة — التكلفة المعتمدة أعلى من الإيراد'),'#B42318'],
      ['audit', fl('"Fully Paid (Audit Required)" — counted, flagged for a check','«مدفوعة بالكامل (تتطلب تدقيقًا)» — تُحتسب وتُعلَّم للتدقيق'),'#B54708'],
      ['unclassed', fl('Invoice lines whose item name is not classed yet (Rules → Invoice item names)','أسطر فواتير لم يُصنَّف اسم بندها بعد (القواعد ← أسماء بنود الفواتير)'),'#475467'],
      ['topup', fl('Wallet top-ups — stored, never revenue','تعبئة المحفظة — تُخزَّن ولا تُحتسب إيرادًا'),'#475467'],
      ['billing', fl('Billing invoices linked to their transactions — zero revenue (not counted twice)','فواتير فوترة مربوطة بمعاملاتها — إيراد صفر (لا يُحتسب مرتين)'),'#475467'],
      ['unpaid', fl('Not paid yet (Pending / Void / Cancelled / Draft) — not counted','غير مدفوعة بعد (معلّقة / ملغاة / مسودة) — لا تُحتسب'),'#475467']];
    var any=L.some(function(x){ return g[x[0]]; });
    var basis=(FIN.p&&FIN.p.basis)==='created'?'created':'paid';
    var sw='<span style="font-size:12px;color:var(--muted)">'+fl('Month by','الشهر حسب')+': '+
      '<select data-v119-basis="1" onchange="v119Basis(this.value)" style="padding:3px 6px;border:1px solid var(--line,#e6e8ec);border-radius:6px;font:inherit;font-size:12px">'+
      '<option value="paid"'+(basis==='paid'?' selected':'')+'>'+fl('paid date','تاريخ السداد')+'</option>'+
      '<option value="created"'+(basis==='created'?' selected':'')+'>'+fl('date created','تاريخ الإنشاء')+'</option></select>'+
      (basis==='created'?' <span style="color:#B54708">'+fl('— this page only; reports and KPIs count by the paid date','— هذه الصفحة فقط؛ التقارير والمؤشرات تحتسب بتاريخ السداد')+'</span>':'')+'</span>';
    var h='<div class="card v119-attention" data-v119-attention="1" style="padding:12px 16px;margin:0 0 14px">'+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="flex:1">'+fl('Needs attention','يحتاج انتباهًا')+'</b>'+sw+'</div>';
    if(!any) h+='<div style="font-size:12.5px;color:var(--muted);margin-top:6px">'+fl('Nothing in this period is waiting, flagged or held apart.','لا شيء في هذه الفترة ينتظر أو مُعلَّم أو محجوز.')+'</div>';
    else h+='<div style="margin-top:6px">'+L.filter(function(x){ return g[x[0]]; }).map(function(x){ var v=g[x[0]];
      ATT[x[0]]={title:x[1],ids:v.ids};
      return '<div data-v119-k="'+x[0]+'" data-n="'+v.n+'" style="font-size:12.5px;line-height:1.8;color:'+x[2]+'"><a href="javascript:void(0)" onclick="v119AttList(\''+x[0]+'\')" data-v119-open="'+x[0]+'" style="color:inherit;text-decoration:underline" title="'+e(fl('Open the list','افتح القائمة'))+'"><b>'+v.n+'</b> · '+n0(v.sar)+' '+fl('SAR','ريال')+'</a> — '+e(x[1])+
        ' <span style="color:var(--muted);font-size:11.5px">('+e(v.refs.join(', '))+(v.n>v.refs.length?' …':'')+')</span></div>'; }).join('')+'</div>';
    return h+'</div>';
  }
  /* Punch list B9 (28 Sep): each count opens the list of its invoices (number, date, customer, total, status) */
  var ATT={};
  window.v119AttList=function(k){
    try{
      var a=ATT[k]; if(!a) return; var by={}; (FIN.rows||[]).forEach(function(r){ by[r.id]=r; });
      var rows=a.ids.map(function(id){ return by[id]; }).filter(Boolean).sort(function(x,y){ return String(y.invoice_date||'').localeCompare(String(x.invoice_date||'')); });
      var h='<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">'+e(a.title)+' · '+rows.length+'</div><div style="max-height:60vh;overflow:auto"><table data-v119-list="'+e(k)+'" style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#303848;color:#fff">'+
        ['Invoice','Date','Customer','Total (SAR)','Status'].map(function(t,i){ var ar=['الفاتورة','التاريخ','العميل','الإجمالي (ريال)','الحالة'][i]; return '<th style="padding:6px 8px;text-align:'+(i===3?'end':'start')+'">'+fl(t,ar)+'</th>'; }).join('')+'</tr></thead><tbody>'+
        rows.map(function(r){ return '<tr style="border-top:1px solid var(--line,#EEF0F3)"><td style="padding:6px 8px;font-weight:700">'+e(r.invoice_no)+'</td><td style="padding:6px 8px;white-space:nowrap">'+e(r.invoice_date||'')+'</td><td style="padding:6px 8px">'+e(r.client_group||r.customer_raw_name||'')+'</td><td style="padding:6px 8px;text-align:end;font-variant-numeric:tabular-nums">'+n0(r.total_incl_vat_sar)+'</td><td style="padding:6px 8px">'+e(r.payments_status||r.integrity_status||'')+'</td></tr>'; }).join('')+'</tbody></table></div>';
      if(typeof openModal==='function'){ openModal(fl('Needs attention','يحتاج انتباهًا'),h,function(){ return true; }); var sv=document.getElementById('mSave'); if(sv) sv.textContent=fl('Close','إغلاق'); }
    }catch(err){ if(window.console) console.warn('[119] list',err); }
  };
  window.v119Basis=function(v){ try{ FIN.p=FIN.p||{}; FIN.p.basis=(v==='created')?'created':'paid'; if(typeof render==='function') render(); }catch(_){} };

  /* ---------- 3. the item-name list (Rules tab) ---------- */
  var IC={rows:null,err:null,loading:false};
  function icLoad(){
    if(IC.loading) return; if(window.__roleKnown!==true) return; IC.loading=true;
    var c=client(); if(!c){ IC.loading=false; return; }
    c.from('money_item_classes').select('*').is('removed_at',null).order('name',{ascending:true}).then(function(r){
      IC.loading=false; IC.err=(r&&r.error)?String(r.error.message||r.error):null; IC.rows=IC.err?null:((r&&r.data)||[]); redraw();
    },function(err){ IC.loading=false; IC.err=String((err&&err.message)||err); redraw(); });
  }
  function redraw(){ try{ if(typeof current!=='undefined'&&current==='finance'&&typeof render==='function') render(); }catch(_){} }
  function refused(r){ if(r&&r.error) return String(r.error.message||r.error); if(r&&Array.isArray(r.data)&&!r.data.length) return fl('Not saved — you may not change this list.','لم يُحفظ — لا يمكنك تغيير هذه القائمة.'); return null; }
  function say(m){ try{ (window.v63Notice||window.alert)(m); }catch(_){} }
  window.v119AddItem=function(){
    if(!canEdit()) return;
    var html='<div class="ch-sub" style="margin-bottom:10px">'+fl('The last part of an invoice line\'s name, as Payments writes it (e.g. "3rd Party Fee", "Service Fee", "رسوم الخدمة"). Pass-through lines are shown beside the cost as "pass-through on the invoice"; they never become cost or profit.',
        'الجزء الأخير من اسم سطر الفاتورة كما يكتبه نظام المدفوعات (مثل «3rd Party Fee» أو «Service Fee» أو «رسوم الخدمة»). تظهر البنود المارّة بجانب التكلفة باسم «المبالغ المارّة على الفاتورة»، ولا تصبح تكلفة ولا ربحًا أبدًا.')+'</div>'+
      '<div class="field"><label>'+fl('Item name','اسم البند')+'</label><input id="v119_name" maxlength="120"></div>'+
      '<div class="field"><label>'+fl('It is','هو')+'</label><select id="v119_class"><option value="pass_through">'+fl('Pass-through (a supplier\'s price passed on)','مبلغ مارّ (سعر مورد يُمرَّر)')+'</option><option value="fee">'+fl('Direct\'s fee','رسوم دايركت')+'</option></select></div>'+
      '<div class="field"><label>'+fl('Note (optional)','ملاحظة (اختياري)')+'</label><input id="v119_note" maxlength="200"></div>';
    openModal(fl('Add an invoice item name','إضافة اسم بند فاتورة'),html,function(){
      var nm=String((document.getElementById('v119_name')||{}).value||'').trim(), cl=(document.getElementById('v119_class')||{}).value, no=String((document.getElementById('v119_note')||{}).value||'').trim();
      if(!nm){ say(fl('Type the item name first.','اكتب اسم البند أولًا.')); return false; }
      client().from('money_item_classes').insert({name:nm,class:cl,note:no||null}).select('id').then(function(r){
        var m=refused(r); if(m){ say(/one_live/.test(m)?fl('That item name is already on the list.','اسم البند هذا موجود في القائمة.'):m); return; }
        try{ closeModal(); }catch(_){} IC.rows=null; icLoad(); try{ if(window.FIN&&typeof window.finRefreshMoney==='function') window.finRefreshMoney(); }catch(_){}
      });
      return false;
    });
  };
  window.v119RemoveItem=function(id){
    if(!canEdit()) return;
    var it=(IC.rows||[]).find(function(x){ return x.id===id; }); if(!it) return;
    var go=function(){ client().from('money_item_classes').update({removed_at:new Date().toISOString()}).eq('id',id).select('id').then(function(r){
      var m=refused(r); if(m){ say(m); return; } IC.rows=null; icLoad(); try{ if(window.FIN&&typeof window.finRefreshMoney==='function') window.finRefreshMoney(); }catch(_){} }); };
    var q=fl('Remove the item name "','إزالة اسم البند «')+it.name+fl('" from the list? Its lines go back to "not classed". It can be added again.','» من القائمة؟ تعود أسطره إلى «غير مصنّفة». ويمكن إضافته مجددًا.');
    if(typeof window.pfConfirm==='function') window.pfConfirm(q,go,{danger:true});   // D19: the app's own box, Cancel first, never a native one
  };
  window.v119ItemLog=function(){ if(typeof window.openChangeLog==='function') window.openChangeLog([{table:'money_item_classes',all:true}],fl('Invoice item names','أسماء بنود الفواتير')); };
  function itemCard(){
    if(IC.rows==null&&!IC.err){ icLoad(); return '<div class="card v119-items" style="padding:14px 18px;margin-bottom:16px;color:var(--muted)">'+fl('Loading the invoice item names…','جارٍ تحميل أسماء بنود الفواتير…')+'</div>'; }
    var w=canEdit();
    var h='<div class="card v119-items" style="padding:18px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">'+fl('Invoice item names','أسماء بنود الفواتير')+'</h3>'+
      (w?'<button class="btn sm pri" onclick="v119AddItem()">+ '+fl('Add an item name','إضافة اسم بند')+'</button>':'')+
      ((role()==='admin'||role()==='manager')?' <button class="btn sm ghost" onclick="v119ItemLog()">'+fl('Change log','سجل التغييرات')+'</button>':'')+'</div>'+
      '<div class="ch-sub" style="margin:4px 0 10px">'+fl('Which invoice lines are a supplier\'s price passed on, and which are Direct\'s fee. Used only for "pass-through on the invoice", shown beside the cost — cost itself is approved expenses only.',
        'أي أسطر الفاتورة سعر مورد مُمرَّر، وأيها رسوم دايركت. تُستخدم فقط في «المبالغ المارّة على الفاتورة» بجانب التكلفة — أما التكلفة نفسها فهي المصروفات المعتمدة فقط.')+'</div>';
    if(IC.err) return h+'<div style="color:#B42318;font-size:12.5px">'+fl('The list could not be read: ','تعذّرت قراءة القائمة: ')+e(IC.err)+' <button class="btn sm ghost" onclick="v119Retry()">'+fl('Try again','حاول مجددًا')+'</button></div></div>';
    if(!IC.rows.length) return h+'<div class="empty" style="padding:8px 0">'+fl('No item names yet — every invoice line shows as "not classed".','لا أسماء بنود بعد — كل أسطر الفواتير تظهر «غير مصنّفة».')+'</div></div>';
    h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#303848;color:#fff"><th style="padding:7px 9px;text-align:start">'+fl('Item name','اسم البند')+'</th><th style="padding:7px 9px;text-align:start">'+fl('It is','هو')+'</th><th style="padding:7px 9px;text-align:start">'+fl('Added','أُضيف')+'</th><th></th></tr></thead><tbody>'+
      IC.rows.map(function(x){ return '<tr data-v119-item="'+e(x.id)+'" style="border-top:1px solid var(--line,#EEF0F3)"><td style="padding:7px 9px;font-weight:700">'+e(x.name)+(x.note?'<div style="font-weight:400;color:var(--muted);font-size:11.5px">'+e(x.note)+'</div>':'')+'</td>'+
        '<td style="padding:7px 9px">'+(x.class==='pass_through'?fl('Pass-through','مبلغ مارّ'):fl('Direct\'s fee','رسوم دايركت'))+'</td>'+
        '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px;white-space:nowrap">'+e(x.created_by_name||'—')+' · '+e(typeof dayRiyadh==='function'?dayRiyadh(x.created_at):String(x.created_at||''))+'</td>'+
        '<td style="padding:7px 9px">'+(w?'<button class="btn ghost sm" onclick="v119RemoveItem(\''+e(x.id)+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</td></tr>'; }).join('')+'</tbody></table></div>';
    return h+'</div>';
  }
  window.v119Retry=function(){ IC.err=null; IC.rows=null; icLoad(); };
  try{ var c0=client(); if(c0&&c0.auth&&c0.auth.onAuthStateChange) c0.auth.onAuthStateChange(function(ev){ if(ev==='SIGNED_IN'){ IC.rows=null; IC.err=null; } }); }catch(_){}

  /* ---------- placing them, after Finance paints (the same pattern js/117 uses) ---------- */
  function place(){
    try{
      if(typeof current==='undefined'||current!=='finance'||!window.FIN) return;
      var view=document.getElementById('view'); if(!view) return;
      if(FIN.tab==='overview'&&!view.querySelector('.v119-attention')){
        var html=attention(); if(!html) return;
        var anchor=view.querySelector('.finh'); var box=document.createElement('div'); box.innerHTML=html;
        if(anchor&&anchor.parentNode) anchor.parentNode.insertBefore(box.firstChild,anchor); else view.insertBefore(box.firstChild,view.firstChild);
      }
      if(FIN.tab==='rules'&&!view.querySelector('.v119-items')){
        var after=view.querySelector('.v117-rules'); if(!after) return;
        var b2=document.createElement('div'); b2.innerHTML=itemCard(); after.parentNode.insertBefore(b2.firstChild,after.nextSibling);
      }
    }catch(err){ if(window.console) console.warn('[119] place',err); }
  }
  (function hook(n){
    if(typeof window.renderFinance==='function'&&!window.renderFinance.__v119){
      var _rf=window.renderFinance; var w=function(){ var out=_rf.apply(this,arguments); try{ place(); setTimeout(place,0); }catch(_){} return out; };
      w.__v119=1; window.renderFinance=w; return;
    }
    if((n||0)<120) setTimeout(function(){ hook((n||0)+1); },250);
  })(0);
  try{ window.__v119Attention=attention; }catch(_){}
}catch(e){ if(window.console) console.warn('[119] money model on screen',e); }})();
