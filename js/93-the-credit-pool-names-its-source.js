/* ===== js/93 — the Commercial Credit Pool card says where its figures come from
   (fire #173, 2026-09-20) =====

   On the Today page — the morning screen — the default view preset injects a "Commercial Credit
   Pool" card (core-08's `v25InjectTodayPool`). Driven live against the real database, it reads:

       Cap 1.25M · headroom 1.25M
       EXTENDED 0 · RECEIVED (this month) 0 · OUTSTANDING 0 · UTILIZATION 0.0%

   with a green bar, an AGING panel (0-30 / 31-60 / 61-90 / 90+) and "None — all paid up".

   Every one of those numbers comes from `v25PoolCompute`, which reads **`DB.invoices`** — the
   invoices array inside the settings record. **That array is empty**, and the company's real
   invoices live in the `finance_invoices` table: 46 of them, which the Finance page reads through
   its own loader.

   **Said precisely, because the difference matters:** the card is not showing a wrong number today.
   The ledger's outstanding really is 0.00 SAR, so the zeros happen to be right. What it cannot do
   is ever be right *on purpose* — it is not reading the ledger, so it would still show 0 and a
   green 0.0% utilisation with a million riyals outstanding. A green all-clear on receivables that
   is true by coincidence is the thing M32 exists to stop.

   Wiring the card to the ledger is NOT done here. "Extended credit" has to be defined against the
   finance doctrine (what counts as extended, what a wallet deduction does to it, which integrity
   statuses count) and that is the owner's definition to give, not a QA round's to invent — M1
   territory, where a wrong money number is worse than none. It is an open question instead.

   What this layer does is name the source, and put the ledger's own figure beside it so the two can
   be compared at a glance: quiet and grey while they agree, amber the moment they diverge.

   **Gated on Finance access** (M25 / fire #141 — the audit log once handed money figures to people
   who cannot open Finance): anyone without it is told the card does not read the ledger, and is
   shown no amount.

   Bilingual, once per render (the .v93- guard), never in a share view. Removing this file removes
   the line and nothing else. */
(function(){try{
  var LEDGER=null, ASKED=false;

  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function mayFinance(){
    try{ return (typeof window.mayOpenPage==='function')?window.mayOpenPage('finance')!==false:false; }
    catch(_){ return false; }
  }
  function money(n){
    try{ if(typeof moneyShort==='function')return moneyShort(n); }catch(_){}
    try{ return Math.round(n).toLocaleString('en-US')+' SAR'; }catch(_){ return n+' SAR'; }
  }

  /* Caught while building this layer, and worth the extra code: the first version stored whatever
     the first query returned and set a flag so it never asked again. That query goes out before the
     session is ready, the database answers `[]` with no error, and the card then reported the
     ledger as holding ZERO invoices — while it holds 46. That is exactly fire #71's bug in js/66's
     registry loader, reproduced from scratch. So: an empty or failed answer is never stored, a
     retry is always possible, and the count is bounded so a genuinely empty ledger cannot spin. */
  var TRIES=0;
  function ask(){
    if(LEDGER&&!LEDGER.error) return;            /* already have a real answer */
    if(ASKED) return;                            /* one in flight */
    if(!mayFinance()) return;
    var c=client(); if(!c) return;
    if(++TRIES>12) return;
    ASKED=true;
    try{
      c.from('finance_invoices').select('amount_remaining_sar,deleted_at').then(function(r){
        ASKED=false;
        if(r.error) return;                      /* keep nothing — ask again on a later render */
        var all=r.data||[];
        if(!all.length) return;                  /* [] before sign-in is not an answer */
        var live=all.filter(function(x){ return !x.deleted_at; });
        var out=0; live.forEach(function(x){ out+=Number(x.amount_remaining_sar)||0; });
        LEDGER={ error:false, count:live.length, outstanding:out };
        try{ if(typeof current!=='undefined'&&current==='today'&&typeof render==='function')render(); }catch(_){}
      }).catch?.(function(){ ASKED=false; });
    }catch(_){ ASKED=false; }
  }

  /* what the card itself is claiming, read from the same helper it draws from */
  function cardOutstanding(){
    try{ var p=(typeof window.v25PoolCompute==='function')?window.v25PoolCompute():null;
      return p?Number(p.outstanding)||0:null; }catch(_){ return null; }
  }

  function enhance(){try{
    if(window.__isShareView) return;
    if(typeof current==='undefined'||current!=='today') return;
    var view=document.getElementById('view'); if(!view) return;
    var card=view.querySelector('.v25-pool-card'); if(!card) return;
    if(card.querySelector('.v93-source')) return;                  /* once per render */
    ask();
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var held=0; try{ held=((DB&&DB.invoices)||[]).length; }catch(_){}

    var diverged=false, tail='';
    if(!mayFinance()){
      tail=fl('The company’s real invoices are in the finance ledger, which this card does not read.',
              'فواتير الشركة الفعلية في سجل المالية، وهذه البطاقة لا تقرأ منه.');
    }else if(LEDGER&&!LEDGER.error){
      var mine=cardOutstanding();
      diverged=(mine!=null&&Math.abs(mine-LEDGER.outstanding)>=1);
      tail=fl('The finance ledger — which this card does not read — holds '+LEDGER.count+
              ' invoice(s) with '+money(LEDGER.outstanding)+' outstanding.',
              'سجل المالية — وهذه البطاقة لا تقرأ منه — فيه '+
              LEDGER.count+' فاتورة بمستحق '+money(LEDGER.outstanding)+'.');
    }else{
      tail=fl('The finance ledger, which this card does not read, holds the real invoices.',
              'سجل المالية الذي لا تقرأ منه هذه البطاقة يحمل الفواتير الفعلية.');
    }

    var d=document.createElement('div');
    d.className='v93-source';
    /* state it, do not leave it to be read off a colour: the browser serialises the hex to rgb(),
       so a guard that matched the colour string could not see this at all */
    d.setAttribute('data-v93-diverged', diverged?'1':'0');
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='margin-top:10px;padding:7px 10px;border-radius:8px;font-size:11.5px;line-height:1.6;'+
      'text-align:'+(ar?'right':'left')+';'+
      (diverged?'background:#FFF3EC;border:1px solid #F4C892;color:#7a5c00;font-weight:600'
               :'background:#F6F7F9;border:1px solid #E6E8EC;color:#6B7480');
    d.textContent=fl('These figures count invoices held in this app ('+held+'). ',
                     'تحسب هذه الأرقام الفواتير المحفوظة داخل هذا التطبيق ('+held+'). ')+tail;
    card.appendChild(d);
  }catch(e){ if(window.console)console.warn('[v93]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,120); return out; };
  }
  setTimeout(enhance,1400);
  setTimeout(enhance,3200);
  setTimeout(enhance,6000);   /* the finance ledger and the access matrix both land late */
  try{ window.__v93Probe=function(){ try{
    var c=document.querySelector('.v25-pool-card');
    return { card:!!c, line:!!(c&&c.querySelector('.v93-source')),
      text:(c&&c.querySelector('.v93-source'))?c.querySelector('.v93-source').textContent:'',
      diverged:!!(c&&c.querySelector('.v93-source[data-v93-diverged="1"]')) };
  }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v93] init',e); }})();
