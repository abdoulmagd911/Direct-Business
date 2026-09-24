/* ===== js/94 — Bookings, Invoices and Tickets say when nothing has come from Direct
   (fire #175, 2026-09-20) =====

   Three pages mirror records that Direct owns. Driven live against the real database, each one
   prints a row of confident totals:

     · Invoices — "INVOICES 0 · BILLED 0 SAR · PAID 0 · OUTSTANDING 0 · ZATCA CLEARED 0/0 ·
       AR aging 0–30 DAYS 0"
     · Bookings — "BOOKINGS 0 · TICKETS 0 · TOTAL SALE 0 SAR · MARGIN —"
     · Tickets  — "TICKETS 0 · OPEN 0 · USED 0 · REFUNDED 0 · ADM-FLAGGED 0"

   …under a banner that read **"Live from the Direct system — read-only."**

   Nothing is live. The Sync page of this same app says so in plain words: *"Live two-way sync
   arrives with the hosted backend phase."* There is no connection to Direct; these three lists are
   empty because nothing has ever been brought in. Meanwhile the company's own finance ledger holds
   46 invoices, so "BILLED 0 SAR" is not even this app's own answer.

   Read together, a person opening Invoices was told the figures come live from the system of record
   and that the system of record has billed nothing. Both halves were wrong.

   The banner is fixed at its source (core-08: it now says Direct is the system of record and this
   is read-only, which is true whether or not anything is connected). This layer adds the other
   half: **when one of these pages has no records at all, say so, above the totals**, so the zeros
   cannot be read as Direct's figures.

   It says nothing once records exist — so the day an import or a real sync fills these pages, the
   line disappears by itself instead of becoming furniture.

   Bilingual, once per render (the .v94- guard), never in a share view. Removing this file removes
   the line and nothing else. */
(function(){try{
  var PAGES={
    bookings:{ en:'bookings', ar:'حجوزات', list:function(){ try{ return (DB&&DB.bookings)||[]; }catch(_){ return []; } } },
    invoices:{ en:'invoices', ar:'فواتير', list:function(){ try{ return (DB&&DB.invoices)||[]; }catch(_){ return []; } } },
    tickets:{  en:'tickets',  ar:'تذاكر',  list:function(){ try{ return (typeof allTickets==='function')?(allTickets()||[]):[]; }catch(_){ return []; } } }
  };

  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }

  /* 2026-09-24 (fire #242): on the INVOICES page the bold line above read "Nothing has been brought
     in from Direct yet" — and the header of this very file says, three paragraphs up, that the
     company's own finance ledger holds 46 invoices. Those 46 came from Direct: the Direct Payments
     export registry is where this app's real money data comes from (CLAUDE.md). So on that one page
     the sentence was false, and a person who clicked "Invoices" in the sidebar — the obvious name
     — read "nothing from Direct" and "BILLED 0 SAR" while two clicks away Finance held over 2 M SAR
     of revenue from exactly that system. Same shape as fire #175 that built this layer: an empty
     page speaking for a system that is not empty.
     Bookings and Tickets have no ledger behind them, so their wording stands. Invoices now asks
     the ledger — through finLive(), the same gate Finance reads through, so the count is Finance's
     own — and answers in one of three honest ways:
       · the ledger holds N rows  → "This page holds nothing — the N invoices captured from Direct
                                    are on the Finance page", with a button that goes there;
       · the ledger is empty      → the original line, which is then true;
       · not known yet            → neither claim, just "this page holds nothing" and the totals
                                    warning — then the line is redrawn when the rows arrive.
     The ledger is loaded on demand the way the client card (js/38) does it. finLoad returns
     silently when a load is already in flight, so a short watch for FIN.rows is the fallback. */
  function ledgerState(){
    try{
      if(typeof window.FIN==='undefined'||!window.FIN) return {state:'none'};
      if(window.FIN.rows==null){
        if(!window.FIN.loading&&typeof window.finLoad==='function'){ try{ window.finLoad(function(){ redraw(); }); }catch(_){} }
        watchLedger();
        return {state:'loading'};
      }
      var n=0; try{ n=(typeof window.finLive==='function')?(window.finLive()||[]).length:((window.FIN.rows||[]).filter(function(r){return r&&!r.deleted_at;}).length); }catch(_){ n=0; }
      return {state:'loaded',n:n};
    }catch(_){ return {state:'none'}; }
  }
  var _watch=null;
  function watchLedger(){
    if(_watch) return;
    var tries=0;
    _watch=setInterval(function(){
      tries++;
      var ready=false; try{ ready=!!(window.FIN&&window.FIN.rows!=null); }catch(_){}
      if(ready||tries>40){ clearInterval(_watch); _watch=null; if(ready) redraw(); }
    },500);
  }
  function redraw(){
    try{
      if(typeof current==='undefined'||current!=='invoices') return;
      var view=document.getElementById('view'); if(!view) return;
      var old=view.querySelector('.v94-empty'); if(old&&old.parentNode) old.parentNode.removeChild(old);
      enhance();
    }catch(_){}
  }
  window.v94GoFinance=function(){ try{ openLead=null; current='finance'; if(typeof render==='function') render(); }catch(_){} };

  function enhance(){try{
    if(window.__isShareView) return;
    if(typeof current==='undefined') return;
    var cfg=PAGES[current]; if(!cfg) return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v94-empty')) return;                /* once per render */
    if(cfg.list().length) return;                               /* records exist — say nothing */
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    var d=document.createElement('div');
    d.className='v94-empty';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:#FFF3EC;border:1px solid #F4C892;border-radius:10px;padding:9px 12px;'+
      'margin:0 0 10px;font-size:12.5px;color:#7a5c00;line-height:1.65;text-align:'+(ar?'right':'left');

    var totals=fl('The totals below are this page’s own count of what it holds, which is nothing — they are <b>not</b> Direct’s figures. ',
                  'الأرقام أدناه هي عدّ هذه الصفحة لما لديها، ولا شيء لديها — وهي <b>ليست</b> أرقام دايركت. ');
    var noLink=fl('There is no live connection to Direct yet; open it to see the real '+cfg.en+'.',
                  'لا يوجد اتصال مباشر بدايركت بعد؛ افتح دايركت لرؤية ال'+cfg.ar+' الفعلية.');
    var head=fl('Nothing has been brought in from Direct yet','لم يُستورد أي شيء من دايركت بعد');
    var tail=totals+noLink;

    if(current==='invoices'){
      var L=ledgerState();
      if(L.state==='loaded'&&L.n>0){
        d.setAttribute('data-v94-ledger',String(L.n));
        head=fl('This page holds nothing — the '+L.n+' invoice'+(L.n===1?'':'s')+' captured from Direct are on the Finance page',
                'هذه الصفحة فارغة — الفواتير الـ'+L.n+' المستوردة من دايركت موجودة في صفحة المالية');
        tail=totals+
          '<button class="btn sm" type="button" onclick="v94GoFinance()" style="margin-inline-start:6px;vertical-align:middle">'+
          fl('Open Finance →','افتح المالية ←')+'</button>';
      }else if(L.state==='loading'){
        d.setAttribute('data-v94-ledger','loading');
        head=fl('This page holds nothing','هذه الصفحة فارغة');
        tail=totals;
      }else{
        d.setAttribute('data-v94-ledger','0');
      }
    }
    d.innerHTML='<b>'+head+'</b><br>'+tail;

    /* above the banner and the totals — it is the first thing that should be read */
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v94]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,90); return out; };
  }
  setTimeout(enhance,1000);
  try{ window.__v94Probe=function(){ try{
    var v=document.getElementById('view');
    return { line: !!(v&&v.querySelector('.v94-empty')) };
  }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v94] init',e); }})();
