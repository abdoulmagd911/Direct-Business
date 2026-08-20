/* ===== S5 — expenses rolled up next to the invoice they sit behind, never into it (chapter, 2026-08-20) =====

   The owner's own wording for this sitting: "expense roll-up into invoice cost,
   record-only/audit-trail." Two halves that sound like they pull against each other —
   this file is exactly the resolution. Decision 1 (already confirmed weeks ago, still
   the rule S5's own Expenses chapter (js/45) was built to guarantee): a service cost
   recorded here must NEVER change an invoice's `cost_sar` or `profit_sar`, anywhere,
   ever. "Roll-up" means the opposite of merging two numbers into one — it means SHOWING
   them side by side on the same screen, clearly labelled as two different things, so
   whoever opens an invoice can see what Direct Business has on file for what it actually
   cost, right next to what Direct Payments reports. Nothing here writes to
   `finance_invoices`. This only reads `finance_expenses` and shows what it finds.

   Matched the same way `transaction_ref` already links an invoice to the transaction it
   grew from (S4, same file's own convention): an expense counts as behind THIS invoice if
   its own `transaction_ref` equals either the invoice's `invoice_no` (an expense logged
   once the tax invoice existed) or the invoice's own `transaction_ref` (an expense logged
   back when it was still the pending transaction — the invoice inherited that reference at
   S4's twin-resolution step, so the same lookup catches both). */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }

  function panel(rows,ar){
    var tot=0; rows.forEach(function(r){tot+=+r.amount_sar||0;});
    /* class stays on the OUTER div even after outerHTML swaps the loading marker for this
       real content — the marker and the finished panel must share one findable identity,
       or anything (tests included) that looks for '.s5rollup' after the swap finds nothing
       and wrongly concludes the panel never rendered. */
    var h='<div class="s5rollup" style="margin-top:14px;padding-top:12px;border-top:1px solid #f0efe9">'+
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px">'+
        '<b style="font-size:12.5px">'+fl('Recorded expenses behind this transaction','التكاليف المسجّلة خلف هذه المعاملة')+'</b>'+
        '<span style="font-size:11px;color:var(--muted)">'+fl('from the Expenses chapter — record only, never part of this invoice’s cost or profit above','من صفحة المصروفات — للسجل فقط، ولا تدخل ضمن تكلفة أو ربح هذه الفاتورة أعلاه')+'</span>'+
      '</div>';
    if(!rows.length){
      h+='<div style="font-size:12px;color:var(--muted)">'+fl('None recorded yet.','لا يوجد مصروف مسجَّل بعد.')+'</div></div>';
      return h;
    }
    h+='<div style="font-size:12.5px;margin-bottom:6px"><b style="color:#B54708">'+m0(tot)+' SAR</b> · '+rows.length+' '+fl('record(s)','سجل')+'</div>'+
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>'+
      rows.map(function(r){
        return '<tr style="border-top:1px solid #f6f5f1"><td style="padding:5px 6px;white-space:nowrap;color:var(--muted)">'+esc(r.expense_date)+'</td>'+
          '<td style="padding:5px 6px">'+esc(r.description)+'</td>'+
          '<td style="padding:5px 6px;text-align:right;font-weight:600;color:#B54708">'+m0(r.amount_sar)+'</td>'+
          '<td style="padding:5px 6px">'+(r.proof_path?('<span style="color:#0F6E56">'+fl('proof attached','مستند مرفق')+'</span>'):('<span style="color:var(--muted)">'+fl('no proof','بلا مستند')+'</span>'))+'</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div></div>';
    return h;
  }

  function inject(invoiceNo, transactionRef){
    var host=document.getElementById('finModal'); if(!host) return;
    var body=host.querySelector('div'); if(!body) return; // the single inner card div finRow builds
    if(body.querySelector('.s5rollup')) return; // already injected for this open
    var mark=document.createElement('div'); mark.className='s5rollup';
    mark.innerHTML='<div style="font-size:12px;color:var(--muted)">'+fl('Loading recorded expenses…','جارٍ تحميل المصروفات المسجّلة…')+'</div>';
    body.appendChild(mark);
    var c=client(); if(!c){ mark.innerHTML=''; return; }
    var refs=[invoiceNo]; if(transactionRef && transactionRef!==invoiceNo) refs.push(transactionRef);
    c.from('finance_expenses').select('expense_date,description,amount_sar,proof_path')
      .in('transaction_ref',refs).is('deleted_at',null).order('expense_date',{ascending:false})
      .then(function(r){
        if(!mark.isConnected) return; // modal closed while this was loading
        var rows=(r&&!r.error&&r.data)?r.data:[];
        mark.outerHTML=panel(rows,(typeof LANG!=='undefined'&&LANG==='ar'));
      });
  }

  var _finRow=window.finRow;
  if(typeof _finRow==='function'){
    window.finRow=function(id){
      var out=_finRow.apply(this,arguments);
      try{
        var r=((window.FIN&&FIN.rows)||[]).find(function(x){return x.id===id;});
        if(r) setTimeout(function(){ inject(r.invoice_no, r.transaction_ref); },0);
      }catch(e){ console.warn('[s5-rollup] inject',e); }
      return out;
    };
  }

  console.info('%c[S5] expenses rolled up next to their invoice — display only, never merged into it','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[s5-rollup] init',e);}})();
