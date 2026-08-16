/* ===== Finance reporting add-ons — one chapter, one file (Finance sitting F1 — 2026-08-16) =====

   The reporting sections layered onto the Finance overview:
     part 1 (was js/25-v32)  Income by service line — the flat per-service table
     part 2 (was js/39-v63)  The four ways revenue arrives: the "how did this revenue
                              arrive?" selector on an invoice card, and the promo-codes card

   Both are pure decorations over renderFinance and neither changes a stored value by
   itself. Anchored at slot 25: the renderFinance wrap chain is
   16 (ledger core) → 25 → 39 → 41 (importer) → 45 (expenses), and nothing between the old
   slots 25 and 39 wraps renderFinance, so folding part 2 up to slot 25 keeps every
   wrapper in the same relative order. Verbatim, each part keeps its own try/catch.

   NOT in this chapter, deliberately: js/21-v27. It is named like a reporting helper but is
   the app-wide ARABIC translator — it rewrites headings, buttons, dropdowns and badges on
   every page, not just Finance. It belongs with the other language work, not here.       */

/* ---------- part 1 — income by service line (was js/25-v32) ---------- */
/* v32 — Finance · income-by-service-line + service-fee model framing.
   READ-ONLY presentation over existing finance_invoices values — changes NO stored value.
   Adds an "Income by service line" card to the Finance overview: Gross billed = cost + service fee,
   where the service fee is Direct's taxable income. Each row drills to the invoices behind it (proof).
   2026-08-12 owner order: NO sub-groups — every service is its own flat row ("spread them").
   Grouping may return later with owner-given coordinates. */
(function(){try{
  if(!window.renderFinance) return;
  var _rf=window.renderFinance;
  window.v32DrillService=function(svc){try{if(window.FIN){FIN.tab='ledger';FIN.f.service=svc;if(typeof render==='function')render();}}catch(e){}};
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function mS(n){n=Number(n)||0;var s=n<0?'-':'';n=Math.abs(n);if(n>=1e6)return s+(n/1e6).toFixed(2)+'M';if(n>=1e3)return s+(n/1e3).toFixed(1)+'K';return s+n.toFixed(0);}
  window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(!window.FIN||FIN.tab!=='overview'||!FIN.rows) return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v32-svc')) return;
      var rows=FIN.rows.filter(function(r){return !r.deleted_at && r.integrity_status==='verified_paid' && (!window.finInPeriod||finInPeriod(r));});
      if(!rows.length) return;
      var by={};
      rows.forEach(function(r){
        var k=r.service_type||fl('(unspecified)','(غير محدد)');
        var b=by[k]=by[k]||{gross:0,cost:0,rev:0,n:0,_inv:{},comm:false};
        b.gross+=+r.total_incl_vat_sar||0; b.cost+=+r.cost_sar||0; b.rev+=+r.revenue_sar||0; b._inv[r.invoice_no]=1; b.n=Object.keys(b._inv).length;
        if(r.revenue_way==='commission') b.comm=true;
      });
      var keys=Object.keys(by).sort(function(a,b){return (by[b].rev-by[b].cost)-(by[a].rev-by[a].cost);});
      var tot={gross:0,cost:0,rev:0,n:0}; keys.forEach(function(k){tot.gross+=by[k].gross;tot.cost+=by[k].cost;tot.rev+=by[k].rev;}); tot.n=new Set(rows.map(function(r){return r.invoice_no;})).size;
      var th=function(t,r){return '<th style="padding:6px 8px;text-align:'+(r?'right':'left')+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
      var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Income by service line','الدخل حسب نوع الخدمة')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3>'+
        '<div class="ch-sub" style="margin-bottom:10px">'+fl('Every service on its own row. Service fee = Direct’s income. Tap a service to see its invoices.','كل خدمة في صف مستقل. رسوم الخدمة = دخل دايركت. اضغط الخدمة لرؤية فواتيرها.')+'</div>'+
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:560px"><thead><tr>'+
        th(fl('Service','الخدمة'))+th(fl('Invoices','الفواتير'),1)+th(fl('Gross billed','الإجمالي'),1)+th(fl('Cost','التكلفة'),1)+th(fl('Service fee (income)','رسوم الخدمة (دخل)'),1)+'</tr></thead><tbody>';
      keys.forEach(function(k){
        var b=by[k], fee=b.rev-b.cost, flag=(b.cost===0&&b.gross>1000&&!b.comm);
        h+='<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" data-svc="'+esc(k)+'" onclick="v32DrillService(this.getAttribute(\'data-svc\'))" title="'+fl('Open the invoices for this service','افتح فواتير هذه الخدمة')+'">'+
          '<td style="padding:7px 8px;font-weight:700">'+esc(window.svcLabel?window.svcLabel(k):k)+
            (b.comm?' <span style="color:#7A5AF8;font-size:10.5px;font-weight:700">'+fl('commission','عمولة')+'</span>':'')+
            (flag?' <span style="color:#B54708;font-size:11px" title="'+fl('Cost is 0 — invoice(s) still need a cost / service-fee split','التكلفة صفر — تحتاج فصل التكلفة عن الرسوم')+'">⚠</span>':'')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">'+b.n+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums">'+mS(b.gross)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+mS(b.cost)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:#0F6E56;font-variant-numeric:tabular-nums">'+mS(fee)+'</td>'+
          '</tr>';
      });
      h+='<tr style="border-top:2px solid var(--line,#ddd);font-weight:800"><td style="padding:8px">'+fl('All services','كل الخدمات')+'</td>'+
        '<td style="padding:8px;text-align:right;color:var(--muted)">'+tot.n+'</td>'+
        '<td style="padding:8px;text-align:right;font-variant-numeric:tabular-nums">'+mS(tot.gross)+'</td>'+
        '<td style="padding:8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+mS(tot.cost)+'</td>'+
        '<td style="padding:8px;text-align:right;color:#0F6E56;font-variant-numeric:tabular-nums">'+mS(tot.rev-tot.cost)+'</td>'+
        '</tr>';
      h+='</tbody></table></div>';
      var card=document.createElement('div'); card.className='card v32-svc'; card.style.cssText='padding:16px;margin-bottom:14px'; card.innerHTML=h;
      var kpi=null; view.querySelectorAll('div').forEach(function(d){var s=d.getAttribute('style')||'';if(!kpi&&s.indexOf('grid-template-columns')>=0&&s.indexOf('minmax(132px')>=0)kpi=d;});
      if(kpi&&kpi.parentNode){kpi.parentNode.insertBefore(card,kpi.nextSibling);}
      else if(view.firstChild){view.insertBefore(card,view.firstChild.nextSibling);}
    }catch(e){if(window.console)console.warn('[v32] by-service',e);}
  };
  console.info('%c[v32] Finance income-by-service loaded (flat)','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v32] init',e);}})();

/* ---------- part 2 — the four revenue ways + promo codes card (was js/39-v63) ---------- */
/* v63 — The four ways revenue arrives (owner-directed 2026-08-12).
   1) actual tax invoice  2) transaction awaiting its tax invoice  3) commission held/received
   at a supplier's wallet  4) promo codes (B2B2C) — totals for now, per-invoice detail later.
   Adds: (a) a "How did this revenue arrive?" selector on the invoice card,
         (b) a Promo codes card on the Finance overview reading the promo_codes registry.
   Additive layer — wraps existing renderers, changes no stored value by itself. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function m0(n){n=Number(n)||0;return Math.round(n).toLocaleString('en-US');}
  var WAYS=[
    ['invoice',     'Actual invoice',                     'فاتورة فعلية'],
    ['transaction', 'Transaction — tax invoice later',    'معاملة — الفاتورة الضريبية لاحقًا'],
    ['commission',  'Commission (supplier wallet)',       'عمولة (محفظة المورّد)'],
    ['promo_code',  'Promo code totals',                  'إجمالي كود خصم']
  ];

  /* (a) selector on the invoice card, next to the origin editor */
  window.finSetWay=function(invNo){try{
    var w=(document.getElementById('fin_way')||{}).value||'invoice';
    var c=(typeof fc==='function')?fc():null; if(!c)return;
    c.from('finance_invoices').update({revenue_way:w}).eq('invoice_no',invNo).is('deleted_at',null).then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      ((window.FIN&&FIN.rows)||[]).forEach(function(x){ if(x.invoice_no===invNo&&!x.deleted_at)x.revenue_way=w; });
      var m=document.getElementById('finModal'); if(m)m.remove();
      if(typeof toast==='function')toast(fl('Saved','تم الحفظ'));
      if(typeof render==='function')render();
    });
  }catch(e){console.warn('[v63] setWay',e);}};

  if(window.finRow){
    var _fr=window.finRow;
    window.finRow=function(id){
      _fr.apply(this,arguments);
      try{
        var org=document.getElementById('fin_origin'); if(!org)return; // no edit rights → no editor
        if(document.getElementById('fin_way'))return;
        var row=((window.FIN&&FIN.rows)||[]).find(function(x){return x.id===id;}); if(!row)return;
        var cur=row.revenue_way||'invoice';
        var holder=org.closest('div')||org.parentNode; if(!holder||!holder.parentNode)return;
        var d=document.createElement('div');
        d.style.cssText='margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
        d.innerHTML='<label style="font-size:11.5px;color:var(--muted)">'+fl('How did this revenue arrive?','كيف وصل هذا الإيراد؟')+'</label>'+
          '<select id="fin_way" class="inp sm" style="max-width:260px">'+WAYS.map(function(w){
            return '<option value="'+w[0]+'"'+(cur===w[0]?' selected':'')+'>'+fl(w[1],w[2])+'</option>';}).join('')+'</select>'+
          '<button class="btn sm" onclick="finSetWay(\''+String(row.invoice_no).replace(/'/g,"\\'")+'\')">'+fl('Save','حفظ')+'</button>';
        holder.parentNode.insertBefore(d,holder.nextSibling);
      }catch(e){console.warn('[v63] modal',e);}
    };
  }

  /* (b) Promo codes card on the Finance overview */
  if(window.renderFinance){
    var _rf=window.renderFinance;
    window.renderFinance=function(){
      _rf.apply(this,arguments);
      try{
        if(!window.FIN||FIN.tab!=='overview')return;
        var P=FIN.promos||[]; if(!P.length)return;
        var view=document.getElementById('view'); if(!view||view.querySelector('.v63-promo'))return;
        var used=P.filter(function(p){return +p.total_sales_sar>0;});
        var sales=used.reduce(function(a,p){return a+ +p.total_sales_sar;},0);
        var disc=used.reduce(function(a,p){return a+ +p.total_discount_sar;},0);
        var top=used.slice(0,10);
        var th=function(t,r){return '<th style="padding:6px 8px;text-align:'+(r?'right':'left')+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
        var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Promo codes (B2B2C)','أكواد الخصم (B2B2C)')+'</h3>'+
          '<div class="ch-sub" style="margin-bottom:10px">'+fl('Codes given to partner companies — used as B2C but the revenue belongs to the commercial team. Totals for now; per-invoice detail comes with the importer.','أكواد تُمنح للشركات الشريكة — تُستخدم كأفراد لكن إيرادها يخص الفريق التجاري. الإجماليات الآن، وتفاصيل الفواتير مع أداة الاستيراد.')+'</div>'+
          '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px">'+
            '<div style="flex:1;min-width:120px"><div style="font-size:11px;color:var(--muted)">'+fl('Codes (used / all)','الأكواد (مستخدمة / الكل)')+'</div><div style="font-size:19px;font-weight:800">'+used.length+' / '+P.length+'</div></div>'+
            '<div style="flex:1;min-width:140px"><div style="font-size:11px;color:var(--muted)">'+fl('Sales through codes','المبيعات عبر الأكواد')+'</div><div style="font-size:19px;font-weight:800;color:#0F6E56">'+m0(sales)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'+
            '<div style="flex:1;min-width:140px"><div style="font-size:11px;color:var(--muted)">'+fl('Discounts given','الخصومات الممنوحة')+'</div><div style="font-size:19px;font-weight:800;color:#B54708">'+m0(disc)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>'+
          '</div>'+
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px"><thead><tr>'+
          th(fl('Code','الكود'))+th('%',1)+th(fl('Sales','المبيعات'),1)+th(fl('Discount','الخصم'),1)+th(fl('Status','الحالة'))+'</tr></thead><tbody>'+
          top.map(function(p){
            var st=p.expired?fl('expired','منتهي'):(p.active?fl('active','فعّال'):fl('off','موقوف'));
            var sc=p.expired?'#98A2B3':(p.active?'#0F6E56':'#B54708');
            return '<tr style="border-top:1px solid var(--line,#eee)">'+
              '<td style="padding:6px 8px;font-weight:700">'+String(p.code||'').replace(/</g,'&lt;')+'</td>'+
              '<td style="padding:6px 8px;text-align:right">'+(+p.value_pct||0)+(p.kind==='percent'?'%':'')+'</td>'+
              '<td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">'+m0(p.total_sales_sar)+'</td>'+
              '<td style="padding:6px 8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+m0(p.total_discount_sar)+'</td>'+
              '<td style="padding:6px 8px;color:'+sc+';font-size:11.5px;font-weight:700">'+st+'</td></tr>';
          }).join('')+
          '</tbody></table></div>'+
          (used.length>10?('<div style="font-size:11px;color:var(--muted);margin-top:6px">'+fl('Top 10 of '+used.length+' used codes shown.','عرض أفضل 10 من '+used.length+' كود مستخدم.')+'</div>'):'');
        var card=document.createElement('div'); card.className='card v63-promo'; card.style.cssText='padding:16px;margin-bottom:14px'; card.innerHTML=h;
        var after=view.querySelector('.v32-svc');
        if(after&&after.parentNode)after.parentNode.insertBefore(card,after.nextSibling);
        else view.appendChild(card);
      }catch(e){console.warn('[v63] promo card',e);}
    };
  }
  console.info('%c[v63] revenue ways loaded','color:#BE185D;font-weight:700');
}catch(e){if(window.console)console.warn('[v63] init',e);}})();
