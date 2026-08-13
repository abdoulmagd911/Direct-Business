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
