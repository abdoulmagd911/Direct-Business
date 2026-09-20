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
    d.innerHTML='<b>'+fl('Nothing has been brought in from Direct yet','لم يُستورد أي شيء من دايركت بعد')+'</b><br>'+
      fl('The totals below are this page’s own count of what it holds, which is nothing — they are <b>not</b> Direct’s figures. '+
         'There is no live connection to Direct yet; open it to see the real '+cfg.en+'.',
         'الأرقام أدناه هي عدّ هذه الصفحة لما لديها، ولا شيء لديها — وهي <b>ليست</b> أرقام دايركت. '+
         'لا يوجد اتصال مباشر بدايركت بعد؛ افتح دايركت لرؤية ال'+cfg.ar+' الفعلية.');

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
