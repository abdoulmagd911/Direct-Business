/* ===== js/91 — the Reports page says whose figures those are (fire #170, 2026-09-21) =====

   The Reports page has four tabs — Overview, Achievements, Objectives & KPIs, Generate Report — and
   presents company-level numbers: "Achievements logged", "N / 30 KPIs with data", "Avg progress to
   2026 targets", and a progress percentage against each of the company's 2026 objectives.

   All of it is stored in `localStorage` under `directReportsData_v1` (core-10, `rptLoad`/`rptSave`).
   Nothing else in the app touches that key: it is never written to the database, never included in
   Settings' "Full backup (JSON)", and never sent anywhere.

   Measured, not read — two browser profiles, the same account, the same live database:

     · profile A, after one achievement is recorded:
       "1 Achievements logged · 1 This month · 1 / 30 KPIs with data · 3% Avg progress to 2026 targets"
     · profile B, at the same moment:
       "0 Achievements logged · 0 This month · 0 / 30 KPIs with data · 0%"
     · database writes attempted while A saved: NONE.

   So a screen that reads as the company's reporting is one person's private notes on one machine.
   Fill in thirty KPIs on the office desktop and the same page on a laptop reads zero; a colleague
   opening Reports sees zero; clearing the browser's site data erases the lot, with no backup
   anywhere. Nothing on the page said so.

   This does not move the data. Where company KPIs belong is a real decision and not one a QA round
   should make on its own — the owner already runs a separate appraisal/KPI system, so quietly
   duplicating them into this database could be exactly the wrong answer. It is written up as an
   open question instead (docs/BACKLOG.md).

   What this layer does is stop the page misleading anyone in the meantime: one plain line, above
   the tabs, saying where these figures live and what that means. Following M27's doctrine — a
   number that is not what it appears to be must say so on the screen showing it.

   Bilingual, renders once per render (the .v91- guard). Removing this file removes the line and
   nothing else. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }

  function enhance(){try{
    if(window.__isShareView) return;
    if(typeof current==='undefined'||current!=='reports') return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v91-local')) return;              /* once per render */
    if(!view.querySelector('.rpt-tabs')) return;              /* only the real Reports page */
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    var d=document.createElement('div');
    d.className='v91-local';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:#FFF3EC;border:1px solid #F4C892;border-radius:10px;padding:9px 12px;'+
      'margin:0 0 10px;font-size:12.5px;color:#7a5c00;line-height:1.65;text-align:'+(ar?'right':'left');
    d.innerHTML='<b>'+fl('These figures are kept in this browser only','هذه الأرقام محفوظة في هذا المتصفح فقط')+'</b><br>'+
      fl('Nothing on this page is saved to the company database, shared with a colleague, or included in the full backup. '+
         'Open Reports on another device and it reads zero; clearing this browser’s data erases it. '+
         'Use <b>Generate Report</b> to take a copy out before you rely on any of it.',
         'لا يُحفظ أي شيء في هذه الصفحة في قاعدة بيانات الشركة، ولا يُشارَك مع زميل، ولا يدخل في النسخة الاحتياطية الكاملة. '+
         'افتح التقارير على جهاز آخر وستجدها صفرًا؛ ومسح بيانات هذا المتصفح يمحوها. '+
         'استخدم <b>إنشاء تقرير</b> لأخذ نسخة قبل الاعتماد عليها.');

    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v91]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,70); return out; };
  }
  setTimeout(enhance,900);
  try{ window.__v91Probe=function(){ try{
    var v=document.getElementById('view');
    return { line: !!(v&&v.querySelector('.v91-local')) };
  }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v91] init',e); }})();
