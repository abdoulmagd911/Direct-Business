/* 83 — what you print is what you saw (2026-09-17, fire #76).

   Found by laying the app out at paper width with print media on, and by making real A4 PDFs of it:
   the lists print with their right-hand side silently missing. The Leads table is about 1275px wide
   inside a 678px column; on screen that column scrolls sideways, so nothing is lost. Paper has no
   scrollbar. The browser simply draws the first 678px and throws the rest away — on Leads that is
   597px, very nearly half the table, and on Clients 456px. Nothing on the page, and nothing in the
   PDF, says a column is missing: the printout looks like a complete table that happens to end at
   "Stage". Someone printing a lead list for a meeting takes an incomplete list and cannot tell.
   (Finance lost 16px and 72px off two rows of tiles the same way.)

   This layer adds print rules only — no screen rule changes, nothing is hidden, no column is dropped:
     · the scrolling box stops scrolling on paper and simply shows everything;
     · the table is asked to fit the paper instead of keeping its natural width, and cell text wraps
       rather than staying on one line;
     · the type and padding come down a little so the wrapped table stays readable;
     · headers repeat at the top of each printed page, and a row is not split across two pages.

   Reversible: delete this file and its <script> line and printing goes back to what it was.
   Guard: scripts/qa/probe-print-tables-fit.mjs (sabotage-verified). */
(function(){try{
  if(document.getElementById('v83print'))return;
  var s=document.createElement('style'); s.id='v83print';
  s.textContent=
  '@media print{'+
    /* 1 — a box that scrolls on screen must not scroll on paper: show all of it.
       Only the table wrapper: turning overflow off everywhere pushed Finance's tile rows PAST the
       paper edge instead of keeping them on it (measured — the page went from 680px to 735px wide),
       which trades a clipped box for a clipped page. Everything else is kept inside the paper by
       the max-width rule below instead. */
    '#view .tbl-wrap,#view .tbl-wrap *{overflow:visible!important;overflow-x:visible!important;overflow-y:visible!important}'+
    '#view .tbl-wrap{max-width:100%!important;width:100%!important}'+
    /* 2 — the table fits the paper rather than keeping its natural width */
    '#view table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:auto!important;border-collapse:collapse!important}'+
    '#view table th,#view table td{white-space:normal!important;word-break:normal;overflow-wrap:anywhere;padding:4px 5px!important;font-size:8.5pt!important;line-height:1.35!important}'+
    '#view table thead th{font-size:7.5pt!important;letter-spacing:.02em!important}'+
    /* a cell can hold a fixed-width control (a select, an input); let those shrink too */
    '#view table th *,#view table td *{max-width:100%!important}'+
    '#view table td input,#view table td select,#view table td textarea{width:100%!important;min-width:0!important;font-size:8.5pt!important}'+
    /* 3 — headers repeat on every page, and no row is split in half */
    '#view table thead{display:table-header-group!important}'+
    '#view table tfoot{display:table-footer-group!important}'+
    '#view table tr{break-inside:avoid!important;page-break-inside:avoid!important}'+
    /* 4 — nothing sticks out past the paper, and a row of tiles wraps onto the next line instead of
       running off the edge. flex-wrap is applied broadly on purpose: it does nothing at all unless
       the element really is a flex row, so it cannot rearrange anything that is not one. */
    '#view *{max-width:100%!important}'+
    '#view div,#view .kpis,#view .board,#view .toolbar{flex-wrap:wrap!important}'+
  '}';
  (document.head||document.documentElement).appendChild(s);
  /* so a probe can prove the rules are present and reach the table, rather than guessing from pixels */
  try{ window.__v83Print=function(){ try{ var t=document.querySelector('#view .tbl-wrap table'); var w=document.querySelector('#view .tbl-wrap');
    return { styled:!!document.getElementById('v83print'),
             wrapOverflowX:w?getComputedStyle(w).overflowX:null,
             tableW:t?Math.round(t.getBoundingClientRect().width):null,
             wrapW:w?Math.round(w.clientWidth):null,
             scrollLoss:w?Math.max(0,w.scrollWidth-w.clientWidth):null }; }catch(_){ return {styled:!!document.getElementById('v83print')}; } }; }catch(_){}
  console.info('%c[83] printed tables fit the paper','color:#0F6E56;font-weight:700');
}catch(e){ if(window.console)console.warn('[83] print tables',e); }})();
