/* ===== js/84 — Today says where its numbers come from (2026-09-18, fire #89) =====

   Found by driving Today against the real database in both languages. Its five chips read
   `DB.bookings`, `DB.invoices` and `DB.offers` — the workspace blob (core-06's renderToday:
   `const B=activeRows(DB.bookings); const I=activeRows(DB.invoices); const O=activeRows(DB.offers)`).
   Live, all three hold ZERO records, and so does `DB.requests`. Measured: invoices 0, bookings 0,
   offers 0, requests 0, in English and in Arabic.

   Meanwhile the real money lives in the `finance_invoices` TABLE — 46 invoices — which Today never
   looks at. So four of the five chips are structurally incapable of ever showing a number: "0 Overdue
   invoices" is not a measurement, it is an empty box being counted.

   Today that reads correctly by luck: all 46 invoices are fully received, nothing is outstanding, so
   zero happens to be the true answer. The moment one is not, Today will still say zero, and the hero
   line above it will still say "Nothing urgent right now — all clear."

   WHAT THIS LAYER DOES NOT DO: it does not rewire Today to read finance_invoices. That is a real
   feature decision with money rules attached (what counts as overdue, which due date, how aging is
   read), the Finance page already does it properly, and it is the owner's call — not a side effect of
   a QA round. It changes no number and hides nothing.

   WHAT IT DOES: when those collections really are empty, it adds one line under the chips saying the
   chips count records kept in this app, that invoices and bookings live in Direct Payments, and where
   the real ledger is. It disappears on its own the moment any of those collections holds a record —
   so if the app ever does start keeping them, the note stops appearing without anybody removing it.

   Self-contained, wrapped in try/catch. Rollback = delete this file and its script line.            */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function emptySources(){
    try{
      if(typeof DB==='undefined'||!DB) return false;
      return !(DB.invoices||[]).length && !(DB.bookings||[]).length && !(DB.offers||[]).length;
    }catch(_){ return false; }
  }
  function paint(){
    try{
      if(typeof current==='undefined'||current!=='today') return;
      var v=document.getElementById('view'); if(!v) return;
      var old=v.querySelector('.v84-note'); if(old) old.remove();
      if(!emptySources()) return;                      // the chips have something real to count
      var chips=v.querySelector('.hero .chips')||v.querySelector('.chips'); if(!chips) return;
      var n=document.createElement('div');
      n.className='v84-note';
      n.style.cssText='margin-top:10px;font-size:11.5px;line-height:1.7;color:rgba(255,255,255,.82);max-width:640px';
      n.innerHTML=fl(
        'These five count records kept in this app, and there are none — invoices and bookings are minted in Direct Payments, not here. The real ledger is on the <a href="/finance" style="color:#FFD9BD;text-decoration:underline">Finance</a> page.',
        'هذه الخمسة تَعُدّ سجلات محفوظة داخل هذا التطبيق، ولا توجد منها أي سجلات — الفواتير والحجوزات تُصدر في Direct Payments وليس هنا. السجل الحقيقي في صفحة <a href="/finance" style="color:#FFD9BD;text-decoration:underline">المالية</a>.');
      chips.parentNode.insertBefore(n,chips.nextSibling);
    }catch(e){ if(window.console)console.warn('[v84] today note',e); }
  }
  /* same shape as the other Today injectors: after every render, once, and guarded */
  var iv=setInterval(function(){
    if(typeof render!=='function') return;
    clearInterval(iv);
    var _r=window.render;
    window.render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(paint,60); }catch(_){} return o; };
    setTimeout(paint,80);
  },200);
  console.info('%c[v84] Today note loaded','color:#175CD3;font-weight:700');
}catch(e){ if(window.console)console.warn('[v84] init',e); }})();
