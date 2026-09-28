/* ===== Finance reporting add-ons — one chapter, one file (Finance sitting F1 — 2026-08-16) =====

   The reporting sections layered onto the Finance overview:
     part 1 (was js/25-v32)  Income by service line — the flat per-service table
     part 2 (was js/39-v63)  The four ways revenue arrives: the "how did this revenue
                              arrive?" selector on an invoice card, and the promo-codes card
     part 3 (S1, 2026-08-16) Report Builder drill-down — a client (or a client's month)
                              opens to the invoices and services behind the total

   Both are pure decorations over renderFinance and neither changes a stored value by
   itself. Anchored at slot 25: the renderFinance wrap chain is
   16 (ledger core) → 25 → 39 → 41 (importer) → 45 (expenses), and nothing between the old
   slots 25 and 39 wraps renderFinance, so folding part 2 up to slot 25 keeps every
   wrapper in the same relative order. Verbatim, each part keeps its own try/catch.

   NOT in this chapter, deliberately: js/21-v27. It is named like a reporting helper but is
   the app-wide ARABIC translator — it rewrites headings, buttons, dropdowns and badges on
   every page, not just Finance. It belongs with the other language work, not here.       */

/* ---------- part 1 — Income by service (D24, 28 Sep; was "Income by service line", js/25-v32) ---------- */
/* D24 (owner, 28 Sep, via the oversight — "a 100% disaster" of the old table): each invoice LINE goes to ONE main service and
   the lines are added up. The old table grouped whole invoices by the COMBINATION of products on them ("Flights + Hotels +
   Journey Solutions"), called a row a "commission service", put wallet top-ups in as a service and showed gross billed.
   Now, from money_service_rows (the database, js/16 loads it into FIN.svc): per service, over the invoices that COUNT in the
   period —
     · Revenue: the service's lines (a wallet line and anything under a "not income" service never counts);
     · Approved cost: the invoice's approved cost, split across its services by each one's share of the invoice's lines;
     · Est. cost ⚑: the pass-through lines of that service, only on an invoice with no approved cost yet (D23);
     · Profit and margin: over the revenue whose cost is known or estimated — an invoice with neither is revenue only;
   the services, the product defaults and the item overrides are lists on Finance → Rules (nothing hard-coded here).
   An invoice with no item lines, or whose lines do not add up to its revenue, keeps the difference in "Not split by line",
   so the column always adds up to Revenue on the tiles. Until the database change lands, the old table is drawn as it was. */
(function(){try{
  if(!window.renderFinance) return;
  var _rf=window.renderFinance;
  window.v32DrillService=function(svc){try{if(window.FIN){FIN.tab='ledger';FIN.f.serviceDrill=svc;FIN.f.clientKey=null;FIN.f.clientName='';if(typeof render==='function')render();}}catch(e){}};
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function mS(n){n=Number(n)||0;var s=n<0?'-':'';n=Math.abs(n);if(n>=1e6)return s+(n/1e6).toFixed(2)+'M';if(n>=1e3)return s+(n/1e3).toFixed(1)+'K';return s+n.toFixed(0);}
  var th=function(t,r){return '<th style="padding:6px 8px;text-align:'+(r?'right':'left')+';color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap">'+t+'</th>';};
  var td=function(v,st){return '<td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums;'+(st||'')+'"><span dir="ltr" style="unicode-bidi:isolate">'+v+'</span></td>';};
  function place(view,card){
    var kpi=null; view.querySelectorAll('div').forEach(function(d){var s=d.getAttribute('style')||'';if(!kpi&&s.indexOf('grid-template-columns')>=0&&s.indexOf('minmax(132px')>=0)kpi=d;});
    if(kpi&&kpi.parentNode){kpi.parentNode.insertBefore(card,kpi.nextSibling);} else if(view.firstChild){view.insertBefore(card,view.firstChild.nextSibling);}
  }
  /* the per-service table (D24) */
  function byService(){
    var NOT=fl('Not split by line','غير موزّعة على البنود'), NONE=fl('No service yet — set it on Rules','بلا خدمة بعد — حدّدها في القواعد');
    var by={}, order={};
    var add=function(k,sort){ if(!by[k]){ by[k]={rev:0,cost:0,est:0,revP:0,_inv:{}}; order[k]=sort; } return by[k]; };
    var src=(typeof window.finLive==='function')?window.finLive():FIN.rows;
    var n=0;
    src.forEach(function(r){
      if(r.deleted_at) return; var m=(FIN.m&&FIN.m[r.id])||{}; if(!m.counts) return; if(window.finInPeriod&&!finInPeriod(r)) return;
      n++;
      var rev=+r.revenue_sar||0, lines=FIN.svcBy[r.id]||[], sum=0; lines.forEach(function(x){ sum+=+x.revenue_sar||0; });
      var hasCost=(r.cost_sar!=null&&r.cost_sar!==''), cost=+r.cost_sar||0, estOn=!hasCost&&!!m.cost_estimated;
      var known=hasCost||estOn||r.revenue_way==='commission';
      lines.forEach(function(x){
        var k=x.service_name||NONE, b=add(k,x.service_name?(+x.sort_order||100):950), v=+x.revenue_sar||0;
        b.rev+=v; b._inv[r.id]=1;
        if(hasCost&&sum>0) b.cost+=cost*v/sum;
        if(estOn) b.est+=+x.pass_through_sar||0;
        if(known) b.revP+=v;
      });
      var rest=Math.round((rev-sum)*100)/100;
      if(Math.abs(rest)>=1){ var b=add(NOT,990); b.rev+=rest; b._inv[r.id]=1; if(hasCost&&sum<=0) b.cost+=cost; if(known) b.revP+=rest; }
    });
    var keys=Object.keys(by).sort(function(a,b){ return (order[a]-order[b])||(by[b].rev-by[a].rev); });
    var tot={rev:0,cost:0,est:0,revP:0};
    var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Income by service','الدخل حسب الخدمة')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:10px">'+fl('Each invoice line goes to one service (Finance → Rules decides which), then the lines are added up — paid sales only, never top-ups or billing links. Cost is the approved expense split by each service’s share; ⚑ is the flagged estimate where no approved expense has arrived yet. Profit and margin are measured where the cost is known or estimated.',
        'كل بند في الفاتورة يذهب إلى خدمة واحدة (تحدّدها المالية ← القواعد)، ثم تُجمع البنود — المبيعات المدفوعة فقط، لا شحن المحفظة ولا الفواتير التجميعية. التكلفة هي المصروف المعتمد موزّعًا بحصة كل خدمة؛ ⚑ هو التقدير حيث لم يصل مصروف معتمد بعد. الربح والهامش يُقاسان حيث التكلفة معروفة أو مقدّرة.')+'</div>'+
      '<div style="overflow-x:auto"><table data-v24-svc="1" style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:620px"><thead><tr>'+
      th(fl('Service','الخدمة'))+th(fl('Invoices','الفواتير'),1)+th(fl('Revenue','الإيراد'),1)+th(fl('Approved cost','التكلفة المعتمدة'),1)+th(fl('Est. cost ⚑','تكلفة تقديرية ⚑'),1)+th(fl('Profit','الربح'),1)+th(fl('Margin','الهامش'),1)+'</tr></thead><tbody>';
    keys.forEach(function(k){
      var b=by[k], prof=b.revP-b.cost-b.est, mg=b.revP>0?(prof/b.revP*100):null;
      tot.rev+=b.rev; tot.cost+=b.cost; tot.est+=b.est; tot.revP+=b.revP;
      h+='<tr style="border-top:1px solid var(--line,#eee)" data-v24-row="'+esc(k)+'" data-rev="'+b.rev.toFixed(2)+'" data-cost="'+b.cost.toFixed(2)+'" data-est="'+b.est.toFixed(2)+'">'+
        '<td style="padding:7px 8px;font-weight:700">'+esc(k)+'</td>'+
        '<td style="padding:7px 8px;text-align:right;color:var(--muted)">'+Object.keys(b._inv).length+'</td>'+
        td(mS(b.rev))+td(mS(b.cost),'color:#B54708')+td(b.est?mS(b.est)+' ⚑':'—','color:#B54708')+
        td(mS(prof)+(b.est?' ⚑':''),'font-weight:700;color:'+(prof<0?'#B42318':'#0F6E56'))+td(mg==null?'—':mg.toFixed(1)+'%','color:var(--muted)')+'</tr>';
    });
    var tp=tot.revP-tot.cost-tot.est;
    h+='<tr style="border-top:2px solid var(--line,#ddd);font-weight:800" data-v24-total="1" data-rev="'+tot.rev.toFixed(2)+'"><td style="padding:8px">'+fl('All services','كل الخدمات')+'</td>'+
      '<td style="padding:8px;text-align:right;color:var(--muted)">'+n+'</td>'+td(mS(tot.rev))+td(mS(tot.cost),'color:#B54708')+td(tot.est?mS(tot.est)+' ⚑':'—','color:#B54708')+
      td(mS(tp)+(tot.est?' ⚑':''),'color:'+(tp<0?'#B42318':'#0F6E56'))+td(tot.revP>0?(tp/tot.revP*100).toFixed(1)+'%':'—','color:var(--muted)')+'</tr></tbody></table></div>';
    return n?h:'';
  }
  /* the old table, drawn only until the database change lands (money_service_rows unreadable) */
  function byServiceType(){
    var _src=(typeof window.finLive==='function')?window.finLive():FIN.rows;
    var rows=_src.filter(function(r){return !r.deleted_at && r.integrity_status==='verified_paid' && (!window.finInPeriod||finInPeriod(r));});
    if(!rows.length) return '';
    var by={};
    rows.forEach(function(r){ var k=r.service_type||fl('(unspecified)','(غير محدد)'); var b=by[k]=by[k]||{rev:0,cost:0,_inv:{}}; b.cost+=+r.cost_sar||0; b.rev+=+r.revenue_sar||0; b._inv[r.invoice_no]=1; });
    var keys=Object.keys(by).sort(function(a,b){return by[b].rev-by[a].rev;});
    var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Income by service','الدخل حسب الخدمة')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3>'+
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:480px"><thead><tr>'+th(fl('Service','الخدمة'))+th(fl('Invoices','الفواتير'),1)+th(fl('Revenue','الإيراد'),1)+th(fl('Approved cost','التكلفة المعتمدة'),1)+'</tr></thead><tbody>';
    keys.forEach(function(k){ var b=by[k]; h+='<tr style="border-top:1px solid var(--line,#eee)"><td style="padding:7px 8px;font-weight:700">'+esc(window.svcLabel?window.svcLabel(k):k)+'</td><td style="padding:7px 8px;text-align:right;color:var(--muted)">'+Object.keys(b._inv).length+'</td>'+td(mS(b.rev))+td(mS(b.cost),'color:#B54708')+'</tr>'; });
    return h+'</tbody></table></div>';
  }
  window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(!window.FIN||FIN.tab!=='overview'||!FIN.rows) return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v32-svc')) return;
      var h=(FIN.svcBy&&!FIN.svcErr)?byService():byServiceType();
      if(!h) return;
      var card=document.createElement('div'); card.className='card v32-svc'; card.style.cssText='padding:16px;margin-bottom:14px'; card.innerHTML=h;
      place(view,card);
    }catch(e){if(window.console)console.warn('[v24] by-service',e);}
  };
  try{ window.__v24ByService=function(){ return byService(); }; }catch(_){}
}catch(e){if(window.console)console.warn('[v24] init',e);}})();

/* ---------- part 2 — the revenue ways + promo codes card (was js/39-v63) ---------- */
/* v63 — The ways revenue arrives (owner-directed 2026-08-12; a fifth added 2026-08-20).
   1) actual tax invoice  2) transaction awaiting its tax invoice  3) commission held/received
   at a supplier's wallet  4) promo codes (B2B2C) — totals for now, per-invoice detail later
   5) b2c_manual — an individual booking typed in by hand (js/58), which has no export to
      import from. Written as "the four ways" until 2026-09-03, when a watch cycle found that
      the editor below still offered only four and silently rewrote the fifth.
   Adds: (a) a "How did this revenue arrive?" selector on the invoice card,
         (b) a Promo codes card on the Finance overview reading the promo_codes registry.
   Additive layer — wraps existing renderers, changes no stored value by itself. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function m0(n){n=Number(n)||0;return Math.round(n).toLocaleString('en-US');}
  /* 2026-09-03 (watch cycle 27): this list held FOUR ways and the database accepts FIVE.
     b2c_manual arrived on 2026-08-20 (js/58, "the fifth revenue pattern") and this editor,
     written on 2026-08-12, was never told. The consequence was not a missing option but a
     silent rewrite: a b2c_manual invoice opened with no matching <option>, so the browser
     showed the FIRST one — "Actual invoice" — and one Save wrote 'invoice' over the stored
     way without anybody choosing it. The live CHECK constraint on finance_invoices is
     revenue_way = ANY (ARRAY['invoice','transaction','commission','promo_code','b2c_manual']);
     this list must carry every value that constraint accepts. */
  var WAYS=[
    ['invoice',     'Actual invoice',                     'فاتورة فعلية'],
    ['transaction', 'Transaction — tax invoice later',    'معاملة — الفاتورة الضريبية لاحقًا'],
    ['commission',  'Commission (supplier wallet)',       'عمولة (محفظة المورّد)'],
    ['promo_code',  'Promo code totals',                  'إجمالي كود خصم'],
    ['b2c_manual',  'Individual booking — entered by hand','حجز فردي — مُدخل يدويًا']
  ];

  /* (a) selector on the invoice card, next to the origin editor */
  window.finSetWay=function(invNo){try{
    /* 2026-09-09 (watch cycle 71): the guard was right and said nothing. js/16 now owns both
       halves - may this session write, and if not, why - so this asks the one function and the
       person hears the same sentence here as on every other Finance write. The old test is kept
       as the fallback for a tree where js/16 predates it. */
    if(typeof window.finRefuseWrite==='function'
        ? window.finRefuseWrite()
        : (typeof window.finCanWrite==='function'?!window.finCanWrite():(typeof window.canFinEdit==='function'&&!window.canFinEdit())))return;
    var w=(document.getElementById('fin_way')||{}).value||'invoice';
    /* 2026-09-07 (watch cycle 44) — THIS DROPDOWN DECIDES MEMBERSHIP OF A PAGE IT KNOWS
       NOTHING ABOUT. js/58's own header says it: "revenue_way='b2c_manual' and
       record_type='b2c' are the only things that mark it as this pattern" — and js/58 then
       lists the hand-entered B2C bookings with .eq('revenue_way','b2c_manual') alone. So the
       two fields must agree, and until now nothing made them.
       Measured both ways with probe-revenue-way-attacks:
         · a hand-entered booking moved to any other way VANISHES from the only page that
           lists it. The row is still there, still counted in every total, and unreachable
           from the screen built to manage it. One dropdown, no warning, nothing on screen
           afterwards to say where it went.
         · an ordinary b2b invoice moved TO b2c_manual APPEARS among the hand-entered
           bookings, on a page whose whole purpose is rows somebody typed in by hand.
       Refuse both, and say which page and what would have happened — the alternative is a
       Save button that looks like it worked and quietly moved a booking out of sight. The
       record_type is the fixed fact here (js/58 sets it once at creation and never offers it
       for editing), so it is what the way is checked against. */
    try{
      var _row=((window.FIN&&FIN.rows)||[]).find(function(x){return x&&x.invoice_no===invNo&&!x.deleted_at;});
      var _rt=_row&&_row.record_type;
      if(_rt==='b2c'&&w!=='b2c_manual'){
        alert(fl('This is a hand-entered B2C booking, and the B2C page finds it by exactly this setting. Changing it would leave the booking in the database, still counted, but off the only page that lists it. Nothing was changed. If this really should become an ordinary invoice, its record type has to change with it, and this editor does not do that.',
                 'هذا حجز B2C مُدخل يدويًا، وصفحة B2C تجده بهذا الإعداد تحديدًا. تغييره سيُبقي الحجز في قاعدة البيانات ومحسوبًا، لكن خارج الصفحة الوحيدة التي تعرضه. لم يتغيّر شيء. وإن كان يجب فعلًا أن يصبح فاتورة عادية، فيجب تغيير نوع السجل معه، وهذا المحرر لا يفعل ذلك.'));
        return;
      }
      if(w==='b2c_manual'&&_rt&&_rt!=='b2c'){
        alert(fl('That setting is what puts a booking on the hand-entered B2C page, and this is a '+String(_rt).toUpperCase()+' invoice — it was not entered there by hand. It would appear on that page as something nobody created. Nothing was changed.',
                 'هذا الإعداد هو ما يضع الحجز في صفحة B2C المُدخلة يدويًا، وهذه فاتورة '+String(_rt).toUpperCase()+' — لم تُدخل هناك يدويًا. ستظهر في تلك الصفحة كسجل لم ينشئه أحد. لم يتغيّر شيء.'));
        return;
      }
    }catch(_){}
    var c=(typeof fc==='function')?fc():null; if(!c)return;
    c.from('finance_invoices').update({revenue_way:w}).eq('invoice_no',invNo).is('deleted_at',null).select('id').then(function(r){
      if(r.error){alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message);return;}
      if(!r.data||!r.data.length){alert(fl('Not saved — the database confirmed no rows (permissions, or the invoice is deleted). Nothing changed.','لم يُحفظ — لم تؤكد قاعدة البيانات أي صف (صلاحيات أو فاتورة محذوفة). لم يتغير شيء.'));return;}
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
        /* And belt-and-braces for the next time the database gains a way before this file
           hears about it: never let the editor present a value the row does not hold. An
           unrecognised stored way is offered back as itself, labelled, so the worst case is
           an ugly option rather than a silent overwrite. */
        var OPTS=WAYS.slice();
        if(!OPTS.some(function(w){return w[0]===cur;}))
          OPTS.unshift([cur, cur+' (stored value — unknown way)', cur+' (القيمة المخزنة — طريقة غير معروفة)']);
        var holder=org.closest('div')||org.parentNode; if(!holder||!holder.parentNode)return;
        var d=document.createElement('div');
        d.style.cssText='margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
        d.innerHTML='<label style="font-size:11.5px;color:var(--muted)">'+fl('How did this revenue arrive?','كيف وصل هذا الإيراد؟')+'</label>'+
          '<select id="fin_way" class="inp sm" style="max-width:260px">'+OPTS.map(function(w){
            return '<option value="'+w[0]+'"'+(cur===w[0]?' selected':'')+'>'+fl(w[1],w[2])+'</option>';}).join('')+'</select>'+
          '<button class="btn sm" onclick="finSetWay(\''+String(row.invoice_no).replace(/'/g,"\\'")+'\')">'+fl('Save','حفظ')+'</button>';
        holder.parentNode.insertBefore(d,holder.nextSibling);
      }catch(e){console.warn('[v63] modal',e);}
    };
  }

  /* (b) Promo codes card on the Finance overview — off, per owner ruling 2026-08-22: the
     promo-code registry does not belong bundled into Finance's Performance view (200 rows
     claiming 27,304,067 SAR against 8,755,055 real revenue read as a live number on the
     page, not a footnote). "For now" — he wants it on its own page later, so the loading
     (FIN.promos) and part (a)'s "How did this revenue arrive?" selector stay untouched;
     only this injection is switched off. */
  var SHOW_PROMO_ON_FINANCE=false;
  if(SHOW_PROMO_ON_FINANCE&&window.renderFinance){
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

/* ---------- part 3 — Report Builder drill-down (sitting S1, 2026-08-16) ----------
   Owner's ask: "per client, time rolled — <client> January total, expandable down to
   the invoices and services under it."

   The Report Builder already totals by client and by month. What it could not do was show
   the invoices those totals are made of, so anyone checking a figure had to leave the
   report, go to the ledger and filter by hand. This opens a row in place.

   READ-ONLY. It writes nothing, saves nothing and changes no figure on the page — it only
   reveals rows that were already counted.

   Where the detail comes from matters. The ledger (chapter 16) now keeps the actual invoice
   rows behind each total in FIN._lastReport, and this reads THOSE. It does not re-filter the
   invoices itself. A second copy of that filter would look right for months and then quietly
   disagree the day someone changed one and not the other — which is exactly the kind of
   money bug that destroys trust in a finance page. Belt and braces: before showing any
   detail, the rows are summed and checked against the total they hang under. If they ever
   disagree by more than a hallala, the detail is refused and the row says so, rather than
   showing numbers that don't add up.                                                      */
(function(){try{
  if(!window.renderFinance) return;
  var _rf=window.renderFinance;
  var OPEN={};                 /* which rows the user has opened, kept across re-renders */
  var SEP='␟', CAP=200;   /* CAP: never silently truncate — the note says what is hidden */

  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function ex(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function m0(n){return Math.round(Number(n)||0).toLocaleString('en-US');}
  function svc(r){try{return window.svcLabel?window.svcLabel(r.service_type):(r.service_type||'—');}catch(_){return r.service_type||'—';}}

  window.s1Toggle=function(k,s){ try{ var id=k+(s?SEP+s:''); OPEN[id]=!OPEN[id]; paint(); }catch(e){console.warn('[S1] toggle',e);} };

  function rowsFor(R,k,s){
    var G=R.g&&R.g[k]; if(!G) return null;
    return s ? ((G.__subRows&&G.__subRows[s])||null) : (G.__rows||null);
  }
  /* the total this detail must reconcile to — the number already printed on the row */
  function totalFor(R,k,s){
    var G=R.g&&R.g[k]; if(!G) return null;
    return s ? (G.__sub&&G.__sub[s]) : G.__tot;
  }

  function paint(){
    var R=window.FIN&&FIN._lastReport; if(!R||!R.g) return;
    var view=document.getElementById('view'); if(!view) return;
    var all=[].slice.call(view.querySelectorAll('tr[data-rbk]'));
    if(!all.length) return;
    [].slice.call(view.querySelectorAll('tr.s1-kid')).forEach(function(t){ t.parentNode&&t.parentNode.removeChild(t); });

    /* With a second grouping the sub-rows are the ones that open (client › month › invoices).
       Without one, the group rows open directly. Opening both would drop a client's invoices
       above its own months and read as nonsense. */
    var deep=!!R.g2;
    all.forEach(function(tr){
      var k=tr.getAttribute('data-rbk'), s=tr.getAttribute('data-rbs')||'';
      if(deep ? !s : !!s) return;

      var td=tr.firstElementChild; if(!td) return;
      var id=k+(s?SEP+s:'');
      if(!td.querySelector('.s1-mark')){
        var mk=document.createElement('span');
        mk.className='s1-mark';
        mk.style.cssText='display:inline-block;width:13px;color:#FF6B00;font-weight:700';
        td.insertBefore(mk,td.firstChild);
        tr.style.cursor='pointer';
        tr.title=fl('Open the invoices behind this total','افتح الفواتير خلف هذا الإجمالي');
        tr.addEventListener('click',function(){ window.s1Toggle(k,s); });
      }
      var mark=td.querySelector('.s1-mark'); if(mark) mark.textContent=OPEN[id]?'▾':'▸';
      if(!OPEN[id]) return;

      var src=rowsFor(R,k,s), tot=totalFor(R,k,s);
      var span=1+(R.mets?R.mets.length:1);
      function note(msg,colour){
        var t=document.createElement('tr'); t.className='s1-kid';
        t.innerHTML='<td colspan="'+span+'" style="padding:6px 8px 6px 30px;font-size:11.5px;color:'+(colour||'var(--muted)')+'">'+ex(msg)+'</td>';
        return t;
      }
      var frag=document.createDocumentFragment();
      if(!src||!src.length){ frag.appendChild(note(fl('No invoice detail for this row.','لا توجد تفاصيل فواتير لهذا الصف.'))); }
      else{
        /* reconcile before showing anything */
        var off=null;
        (R.mets||[]).forEach(function(m){
          var want=(tot&&tot[m])||0;
          var got=src.reduce(function(a,r){return a+(m==='_count'?1:(+r[m]||0));},0);
          if(Math.abs(want-got)>0.01) off=m;
        });
        if(off){
          frag.appendChild(note(fl('Detail withheld: these invoices do not add up to the total above. Nothing is lost — open the Ledger tab to see them.',
                                   'التفاصيل غير معروضة: مجموع هذه الفواتير لا يطابق الإجمالي أعلاه. افتح تبويب السجل لرؤيتها.'),'#B54708'));
        }else{
          var head=document.createElement('tr'); head.className='s1-kid';
          head.innerHTML='<td colspan="'+span+'" style="padding:5px 8px 3px 30px;font-size:10.5px;color:var(--muted);letter-spacing:.03em;text-transform:uppercase">'+
            ex(fl('Invoices and services behind this total','الفواتير والخدمات خلف هذا الإجمالي'))+'</td>';
          frag.appendChild(head);
          src.slice(0,CAP).forEach(function(r){
            var t=document.createElement('tr'); t.className='s1-kid';
            t.style.cssText='border-top:1px solid #f7f5f0;background:#FCFBF8';
            var lbl='<span style="color:var(--muted)">'+ex(r.invoice_date||'')+'</span> · <b>'+ex(r.invoice_no||'—')+'</b> · '+ex(svc(r));
            t.innerHTML='<td style="padding:5px 8px 5px 42px;font-size:12px">'+lbl+'</td>'+
              (R.mets||[]).map(function(m){
                return '<td style="padding:5px 8px;text-align:right;font-size:12px;color:#4a5060;font-variant-numeric:tabular-nums">'+
                       (m==='_count'?1:m0(r[m]))+'</td>';
              }).join('');
            frag.appendChild(t);
          });
          if(src.length>CAP) frag.appendChild(note(fl('Showing the first '+CAP+' of '+src.length+' invoices — use Export CSV for all of them.',
                                                     'يتم عرض أول '+CAP+' من '+src.length+' فاتورة — استخدم تصدير CSV للكل.')));
          /* 2026-09-08 (watch cycle 59): the reconcile loop above compares the RAW numbers and
             passes to the hallala — but the group row prints money0(total) and each line prints
             m0(value), rounded independently, so three invoices of 100.40 print 100+100+100
             under a total printed 301. The internal guard was satisfied while the only
             arithmetic a person can actually do was wrong, and adding these lines up is the one
             thing this feature exists for. Costs here carry real fractions (the approved expense
             lines total 1,935,461.74) and profit is revenue minus cost, so this is ordinary, not
             contrived. Say it, and give the exact figure — the house pattern from cycle 49/50:
             keep the rounded headline, print the exact number underneath when they differ.
             Only when the whole set is on screen; past the cap the note above already explains
             why these lines cannot sum to the total. The metric's name is read from the table's
             own header rather than a second copy of the label map, so it cannot drift from the
             column it is talking about. */
          if(src.length<=CAP){
            var rnd=function(n){return Math.round(Number(n)||0);};
            var _th=view.querySelector('table thead tr'), offs=[];
            (R.mets||[]).forEach(function(m,i){
              if(m==='_count')return;
              var shown=src.reduce(function(a,r){return a+rnd(r[m]);},0), head=rnd((tot&&tot[m])||0);
              if(shown!==head) offs.push({lbl:(_th&&_th.cells[i+1])?_th.cells[i+1].textContent.trim():m, shown:shown, head:head, exact:Number((tot&&tot[m])||0)});
            });
            if(offs.length) frag.appendChild(note(fl(
              'These lines are rounded to the nearest riyal, so adding them up does not land on the total above. '+offs.map(function(o){return o.lbl+': the lines read '+m0(o.shown)+', the total reads '+m0(o.head)+', and the exact figure is '+o.exact.toFixed(2)+' SAR';}).join('; ')+'.',
              '\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0633\u0637\u0648\u0631 \u0645\u064f\u0642\u0631\u064e\u0651\u0628\u0629 \u0625\u0644\u0649 \u0623\u0642\u0631\u0628 \u0631\u064a\u0627\u0644\u060c \u0644\u0630\u0627 \u0644\u0627 \u064a\u0637\u0627\u0628\u0642 \u0645\u062c\u0645\u0648\u0639\u0647\u0627 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0639\u0644\u0627\u0647. '+offs.map(function(o){return o.lbl+': \u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0633\u0637\u0648\u0631 '+m0(o.shown)+'\u060c \u0648\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a '+m0(o.head)+'\u060c \u0648\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062f\u0642\u064a\u0642 '+o.exact.toFixed(2)+' \u0631\u064a\u0627\u0644';}).join('\u061b')+'.')));
          }
        }
      }
      if(tr.parentNode) tr.parentNode.insertBefore(frag,tr.nextSibling);
    });

    /* Turning the page closes what is open. Opened detail belongs directly under its own
       row, so if that row moves to another page the detail must not be left behind on
       this one, stranded under somebody else's client. */
    [].slice.call(view.querySelectorAll('.pg-bar')).forEach(function(bar){
      if(bar.__s1) return; bar.__s1=1;
      bar.addEventListener('click',function(e){ if(e.target&&e.target.tagName==='BUTTON'){ OPEN={}; setTimeout(paint,0); } });
      bar.addEventListener('change',function(){ OPEN={}; setTimeout(paint,0); });
    });
  }

  window.renderFinance=function(){
    _rf.apply(this,arguments);
    try{
      if(!window.FIN||FIN.tab!=='reports') return;
      /* the table is rebuilt by the render above, so the open rows are re-opened here */
      paint();
    }catch(e){if(window.console)console.warn('[S1] drill-down',e);}
  };
  console.info('%c[S1] report drill-down loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[S1] init',e);}})();
