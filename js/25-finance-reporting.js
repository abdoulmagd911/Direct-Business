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
      /* 2026-09-02 (attack round 11): read through js/16's chokepoint (exclusion + sanitised money),
         not the raw rows — the raw list still carries an excluded partner's rows. */
      var _src=(typeof window.finLive==='function')?window.finLive():FIN.rows;
      var rows=_src.filter(function(r){return !r.deleted_at && r.integrity_status==='verified_paid' && (!window.finInPeriod||finInPeriod(r));});
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
        /* Audit, quality and strategy asked for this view in their own words — "Flights:
           revenue, cost, profit". The figures were already exactly that, checked against
           all 28 live invoices: gross billed equals revenue on every row, and the service
           fee equals revenue minus cost, which is profit. Only the column names differed,
           so the owner's service-fee wording is kept and their words added beside it. */
        th(fl('Service','الخدمة'))+th(fl('Invoices','الفواتير'),1)+th(fl('Gross billed (revenue)','الإجمالي (الإيراد)'),1)+th(fl('Cost','التكلفة'),1)+th(fl('Service fee (income = profit)','رسوم الخدمة (دخل = ربح)'),1)+'</tr></thead><tbody>';
      keys.forEach(function(k){
        var b=by[k], fee=b.rev-b.cost, flag=(b.cost===0&&b.gross>1000&&!b.comm);
        h+='<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" data-svc="'+esc(k)+'" onclick="v32DrillService(this.getAttribute(\'data-svc\'))" title="'+fl('Open the invoices for this service','افتح فواتير هذه الخدمة')+'">'+
          '<td style="padding:7px 8px;font-weight:700">'+esc(window.svcLabel?window.svcLabel(k):k)+
            (b.comm?' <span style="color:#7A5AF8;font-size:10.5px;font-weight:700">'+fl('commission','عمولة')+'</span>':'')+
            (flag?' <span style="color:#B54708;font-size:11px" title="'+fl('Cost is 0 — invoice(s) still need a cost / service-fee split','التكلفة صفر — تحتاج فصل التكلفة عن الرسوم')+'">⚠</span>':'')+'</td>'+
          '<td style="padding:7px 8px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums">'+b.n+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums">'+mS(b.gross)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+mS(b.cost)+'</td>'+
          '<td style="padding:7px 8px;text-align:right;font-weight:700;color:'+(fee<0?'#B42318':'#0F6E56')+';font-variant-numeric:tabular-nums"><span dir="ltr" style="unicode-bidi:isolate">'+mS(fee)+'</span></td>'+   /* dir=ltr: in Arabic a negative used to render as "18.0K-" */
          '</tr>';
      });
      h+='<tr style="border-top:2px solid var(--line,#ddd);font-weight:800"><td style="padding:8px">'+fl('All services','كل الخدمات')+'</td>'+
        '<td style="padding:8px;text-align:right;color:var(--muted)">'+tot.n+'</td>'+
        '<td style="padding:8px;text-align:right;font-variant-numeric:tabular-nums">'+mS(tot.gross)+'</td>'+
        '<td style="padding:8px;text-align:right;color:#B54708;font-variant-numeric:tabular-nums">'+mS(tot.cost)+'</td>'+
        '<td style="padding:8px;text-align:right;color:'+((tot.rev-tot.cost)<0?'#B42318':'#0F6E56')+';font-variant-numeric:tabular-nums"><span dir="ltr" style="unicode-bidi:isolate">'+mS(tot.rev-tot.cost)+'</span></td>'+
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
    if(typeof window.finCanWrite==='function'?!window.finCanWrite():(typeof window.canFinEdit==='function'&&!window.canFinEdit()))return;   // 2026-09-02: guard the function, not just the button (share views included)
    var w=(document.getElementById('fin_way')||{}).value||'invoice';
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
