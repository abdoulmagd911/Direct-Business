/* v32 — Finance · income-by-service-line + service-fee model framing.
   READ-ONLY presentation over existing finance_invoices values — changes NO stored value.
   Adds an "Income by service line" card to the Finance overview: Gross billed = cost + service fee,
   where the service fee is Direct's taxable income. Each row drills to the invoices behind it (proof).
   Rows whose cost is 0 are flagged so the team can spot invoices still needing a cost / service-fee split. */
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
        var b=by[k]=by[k]||{gross:0,cost:0,rev:0,n:0,_inv:{}};
        b.gross+=+r.total_incl_vat_sar||0; b.cost+=+r.cost_sar||0; b.rev+=+r.revenue_sar||0; b._inv[r.invoice_no]=1; b.n=Object.keys(b._inv).length;
      });
      var keys=Object.keys(by).sort(function(a,b){return by[b].rev-by[a].rev;});
      // Roll services up into families (brief view); each family expands to its services.
      var GB={}; keys.forEach(function(k){
        var g=(window.SVC2GRP&&SVC2GRP[k])||'Other services';
        var gb=GB[g]=GB[g]||{gross:0,cost:0,rev:0,_inv:{},children:[]};
        gb.gross+=by[k].gross; gb.cost+=by[k].cost; gb.rev+=by[k].rev; gb.children.push(k);
        Object.keys(by[k]._inv).forEach(function(i){gb._inv[i]=1;});
      });
      var gkeys=Object.keys(GB).sort(function(a,b){return GB[b].rev-GB[a].rev;});
      window.v32TogGrp=function(i,el){try{
        var rows=document.querySelectorAll('.v32-ch-'+i), open=el.getAttribute('data-open')==='1';
        rows.forEach(function(r){r.style.display=open?'none':'table-row';});
        el.setAttribute('data-open',open?'0':'1');
        var c=el.querySelector('.v32-chev'); if(c)c.textContent=open?'\u25B8':'\u25BE';
      }catch(e){}};
      var tot={gross:0,cost:0,rev:0,n:0}; keys.forEach(function(k){tot.gross+=by[k].gross;tot.cost+=by[k].cost;tot.rev+=by[k].rev;}); tot.n=new Set(rows.map(function(r){return r.invoice_no;})).size;
      var th=function(t,r){return '<th style="padding:6px 8px;text-align:'+(r?'right':'left')+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
      var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Income by service line','الدخل حسب نوع الخدمة')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3>'+
        '<div class="ch-sub" style="margin-bottom:10px">'+fl('Service fee = Direct’s income. Tap a service to see its invoices.','رسوم الخدمة = دخل دايركت. اضغط الخدمة لرؤية فواتيرها.')+'</div>'+
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:560px"><thead><tr>'+
        th(fl('Service','الخدمة'))+th(fl('Gross billed','الإجمالي'),1)+th(fl('Cost','التكلفة'),1)+th(fl('Service fee (income)','رسوم الخدمة (دخل)'),1)+'</tr></thead><tbody>';
      gkeys.forEach(function(g,gi){
        var gb=GB[g], gfee=gb.rev-gb.cost, gmg=gb.rev>0?Math.round(gfee/gb.rev*100):0, gn=Object.keys(gb._inv).length;
        var one=(gb.children.length===1&&gb.children[0]===g);
        var gLbl=fl(g,(window.SVC_GROUPS&&SVC_GROUPS[g])?SVC_GROUPS[g].ar:g);
        h+='<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" '+(one?('data-svc="'+esc(g)+'" onclick="v32DrillService(this.getAttribute(\'data-svc\'))"'):('data-open="0" onclick="v32TogGrp('+gi+',this)"'))+' title="'+(one?fl('Open the invoices for this service','افتح فواتير هذه الخدمة'):fl('Show the services inside','اعرض الخدمات داخل هذه المجموعة'))+'">'+
          '<td style="padding:7px 8px;font-weight:700">'+(one?'':'<span class="v32-chev" style="display:inline-block;width:14px;color:var(--muted)">\u25B8</span>')+esc(gLbl)+(one?'':' <span style="color:var(--muted);font-weight:400;font-size:11px">('+gb.children.length+')</span>')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums">'+mS(gb.gross)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+mS(gb.cost)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:#0F6E56;font-variant-numeric:tabular-nums">'+mS(gfee)+'</td>'+
          '</tr>';
        if(!one) gb.children.forEach(function(k){
          var b=by[k], fee=b.rev-b.cost, mg=b.rev>0?Math.round(fee/b.rev*100):0, flag=(b.cost===0&&b.gross>1000);
          h+='<tr class="v32-ch-'+gi+'" style="display:none;cursor:pointer;background:var(--wash,#FAFAF8)" data-svc="'+esc(k)+'" onclick="v32DrillService(this.getAttribute(\'data-svc\'))" title="'+fl('Open the invoices for this service','افتح فواتير هذه الخدمة')+'">'+
            '<td style="padding:6px 8px 6px 26px;font-weight:500;font-size:12px">'+esc(window.svcLabel?window.svcLabel(k):k)+(flag?' <span style="color:#B54708;font-size:11px" title="'+fl('Cost is 0 — invoice(s) still need a cost / service-fee split','التكلفة صفر — تحتاج فصل التكلفة عن الرسوم')+'">⚠</span>':'')+'</td>'+
            '<td style="padding:6px 8px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums">'+mS(b.gross)+'</td>'+
            '<td style="padding:6px 8px;text-align:right;font-size:12px;color:#B54708;font-variant-numeric:tabular-nums">'+mS(b.cost)+'</td>'+
            '<td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:600;color:#0F6E56;font-variant-numeric:tabular-nums">'+mS(fee)+'</td>'+
            '</tr>';
        });
      });
      h+='<tr style="border-top:2px solid var(--line,#ddd);font-weight:800"><td style="padding:8px">'+fl('All services','كل الخدمات')+'</td>'+
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
  console.info('%c[v32] Finance income-by-service loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v32] init',e);}})();
