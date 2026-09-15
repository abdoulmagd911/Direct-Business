/* js/78 — the Ctrl/⌘+K command palette: "New lead" works, and the palette speaks Arabic.
   2026-09-15 (live sweep, fire #48) — driven against the real database for the first time:
     1. "New lead" in the palette threw `editLead is not defined` (core-06 line 492 calls a
        function that never existed; the real form is editBusiness() in core-02). The "N"
        shortcut on the Leads page checks `typeof editLead==='function'` for the same reason,
        so instead of opening the new-lead form it fell through to the palette, whose "New
        lead" row then threw. Fix: editLead(id) is now a thin alias of editBusiness(id).
     2. In Arabic mode every part of the palette was English: the search box hint, 27 of 28
        rows, the ↑↓/↵/Esc footer, the "No matches." line and the "?" cheat sheet. Fix: when
        LANG is 'ar' the rows are relabelled from the table below (the English label is kept
        on each row as `en`, so typing "new" or "settings" still finds it), and the chrome is
        rewritten when the palette or the cheat sheet opens.
   Self-contained, wrapped in try/catch; loads after core-08/core-09 so it wraps their
   CMD_ACTIONS extensions too. Rollback = delete this file and its script line.            */
(function(){
try{
  /* ---- 1. New lead ---- */
  if(typeof window.editLead!=='function'){
    window.editLead=function(id){ if(typeof editBusiness==='function') return editBusiness(id||''); };
  }

  /* ---- 2. Arabic palette ---- */
  var isAr=function(){ return (typeof LANG!=='undefined'&&LANG==='ar'); };
  var ROWS={
    'New invoice':['فاتورة جديدة','افتح نموذج إدخال الفاتورة'],
    'New booking':['حجز جديد','افتح نموذج إدخال الحجز'],
    'New offer':['عرض جديد','افتح منشئ العروض'],
    'New lead':['عميل محتمل جديد','أضف عميلاً محتملاً / جهة جديدة'],
    'Toggle Arabic ⇄ English':['التبديل عربي ⇄ English','قلب اتجاه الواجهة'],
    'Show keyboard shortcuts':['اختصارات لوحة المفاتيح','ورقة الاختصارات'],
    'Go to Today':['الانتقال إلى اليوم','صندوق اليوم'],
    'Go to Leads':['الانتقال إلى العملاء المحتملين',''],
    'Go to Invoices':['الانتقال إلى الفواتير',''],
    'Go to Bookings':['الانتقال إلى الحجوزات',''],
    'Go to Tickets':['الانتقال إلى التذاكر',''],
    'Go to Airlines':['الانتقال إلى شركات الطيران',''],
    'Go to Providers':['الانتقال إلى المزوّدين',''],
    'Go to Offers':['الانتقال إلى العروض',''],
    'Go to Activity & Audit':['الانتقال إلى النشاط والتدقيق',''],
    'Go to Projects':['الانتقال إلى المشاريع','ارتباطات متعددة الرحلات'],
    'Go to Sync & Integrations':['الانتقال إلى المزامنة والتكاملات','صحة المصادر · التعارضات'],
    'Go to Settings':['الانتقال إلى الإعدادات','السقف · الإعدادات المسبقة · القوالب'],
    'Edit credit pool cap':['تعديل سقف مجمع الائتمان','افتح إعدادات المجمع'],
    'Generate service-fee proposal':['إنشاء عرض رسوم الخدمة','PDF + PPTX'],
    'Generate project proposal':['إنشاء عرض المشروع','PDF + PPTX'],
    'New project':['مشروع جديد','ارتباط متعدد الرحلات'],
    'What is this section?':['ما هو هذا القسم؟','افتح تلميح القسم']
  };
  var PRESET_AR={'Commercial':'تجاري','Finance':'المالية','CFO':'المدير المالي','Everything':'كل شيء','B2B snapshot':'لقطة B2B'};
  var KIND_AR={'Action':'إجراء','Nav':'تنقّل','Preset':'عرض','Help':'مساعدة','Lead':'عميل محتمل','Client':'عميل','Booking':'حجز','Invoice':'فاتورة','Offer':'عرض','Airline':'شركة طيران','Provider':'مزوّد'};
  var PLACEHOLDER_AR='ابحث في أي شيء — عملاء محتملون، عملاء، حجوزات، فواتير، شركات طيران، إجراءات…';
  var PLACEHOLDER_EN='Search anything — leads, clients, bookings, invoices, airlines, actions…';
  var FOOT={en:['navigate','open','close'],ar:['تنقّل','فتح','إغلاق']};
  var HELP={en:{h:'⌨ Keyboard shortcuts',rows:['Open command palette','Focus global search','New (context-aware)','Edit focused / current record','Close modal / drawer','This cheat sheet'],btn:'Got it'},
            ar:{h:'⌨ اختصارات لوحة المفاتيح',rows:['فتح لوحة الأوامر','الانتقال إلى البحث العام','جديد (حسب الصفحة)','تعديل السجل الحالي','إغلاق النافذة / اللوحة الجانبية','هذه الورقة'],btn:'فهمت'}};

  /* rows: relabel in Arabic, keep the English label searchable as `en` */
  if(typeof window.CMD_ACTIONS==='function'||typeof CMD_ACTIONS==='function'){
    var __origActions=window.CMD_ACTIONS||CMD_ACTIONS;
    window.CMD_ACTIONS=function(){
      var arr=__origActions.apply(this,arguments)||[];
      if(!isAr()) return arr;
      arr.forEach(function(a){
        if(!a||typeof a.lbl!=='string') return;
        a.en=a.lbl;
        var t=ROWS[a.lbl];
        if(t){ a.lbl=t[0]; if(t[1]) a.sub=t[1]; }
        else if(a.lbl.indexOf('View as ')===0){ var pl=a.lbl.slice(8); a.lbl='عرض كـ: '+(PRESET_AR[pl]||pl); a.sub='تبديل الإعداد المسبق'; }
        if(KIND_AR[a.kind]) a.kind=KIND_AR[a.kind];
      });
      return arr;
    };
  }
  /* results: in Arabic an English query must still find a relabelled row; record kinds get Arabic badges */
  if(typeof CMD_RESULTS==='function'){
    var __origResults=CMD_RESULTS;
    CMD_RESULTS=function(q){
      var out=__origResults.apply(this,arguments)||[];
      if(!isAr()) return out;
      var ql=(q||'').toLowerCase().trim();
      if(ql){
        var have={}; out.forEach(function(r){ have[r.lbl]=1; });
        (window.CMD_ACTIONS?window.CMD_ACTIONS():[]).forEach(function(a){
          if(a&&a.en&&!have[a.lbl]&&a.en.toLowerCase().indexOf(ql)>=0){ out.push(a); have[a.lbl]=1; }
        });
      }
      out.forEach(function(r){ if(r&&KIND_AR[r.kind]) r.kind=KIND_AR[r.kind]; });
      return out.slice(0,40);
    };
  }
  /* chrome: search hint + footer, rewritten each time the palette opens */
  var chrome=function(){
    var ar=isAr();
    var inp=document.getElementById('v19pinput'); if(inp) inp.placeholder=ar?PLACEHOLDER_AR:PLACEHOLDER_EN;
    var foot=document.querySelector('#v19palette .pfoot');
    if(foot){ var spans=foot.querySelectorAll('span'); var w=FOOT[ar?'ar':'en']; spans.forEach(function(s,i){ if(!w[i]) return; var kbds=[].slice.call(s.querySelectorAll('kbd')).map(function(k){return k.outerHTML;}).join(''); s.innerHTML=kbds+' '+w[i]; }); }
  };
  if(typeof openPalette==='function'){
    var __origOpen=openPalette;
    openPalette=function(){ chrome(); return __origOpen.apply(this,arguments); };
  }
  /* "No matches." — patch the empty line after each render */
  if(typeof renderPalette==='function'){
    var __origRender=renderPalette;
    renderPalette=function(){
      var r=__origRender.apply(this,arguments);
      if(isAr()){ var e=document.querySelector('#v19plist .empty'); if(e) e.textContent='لا توجد نتائج.'; }
      return r;
    };
  }
  /* "?" cheat sheet — translated when it is shown */
  var help=document.getElementById('v19help');
  var helpLang=function(){
    if(!help) return; var ar=isAr(); var t=HELP[ar?'ar':'en'];
    var h3=help.querySelector('h3'); if(h3) h3.textContent=t.h;
    help.querySelectorAll('.row span').forEach(function(s,i){ if(t.rows[i]) s.textContent=t.rows[i]; });
    var btn=help.querySelector('button'); if(btn) btn.textContent=t.btn;
  };
  if(help&&typeof MutationObserver==='function'){
    new MutationObserver(function(){ if(help.classList.contains('show')) helpLang(); }).observe(help,{attributes:true,attributeFilter:['class']});
  }
  /* also translate eagerly: now (LANG is already known at load) and on every language flip, so
     the sheet never shows one English frame before the observer catches up */
  helpLang(); chrome();
  if(typeof toggleLang==='function'){
    var __origToggle=toggleLang;
    toggleLang=function(){ var r=__origToggle.apply(this,arguments); try{ helpLang(); chrome(); }catch(_){ } return r; };
  }
}catch(e){ console.warn('[js/78 palette-arabic]',e); }
})();
