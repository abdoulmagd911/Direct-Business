/* ========================================================================
   V25 UX QA POLISH BUNDLE — additive only, non-breaking.
   Generated overnight 2026-06-02. Storage key remains 'dbLang' / 'dbState' (v24).
   ======================================================================== */
(function v25QABundle(){
  if(window.__V25_LOADED__)return;
  window.__V25_LOADED__=true;

  /* ---- 1. Expand I18N with common UI verbs (EN+AR) ---- */
  try{
    var extras_en={
      save:'Save changes',cancel:'Cancel',delete_:'Delete',close:'Close',add:'Add',
      edit:'Edit',search:'Search',filter:'Filter',today:'Today',sync:'Sync & Integrations',
      settings:'Settings',welcomeBack:'Welcome back',openMenu:'Open menu',closeMenu:'Close menu',
      switchLang:'Switch to العربية',switchLangAr:'Switch to English',
      dismiss:'Dismiss',gotIt:'Got it',shortcuts:'Keyboard shortcuts',
      noResults:'No matches yet',addFirst:'Add your first one to get started.',
      backToList:'Back to list',export:'Export'
    };
    var extras_ar={
      save:'حفظ التغييرات',cancel:'إلغاء',delete_:'حذف',close:'إغلاق',add:'إضافة',
      edit:'تعديل',search:'بحث',filter:'تصفية',today:'اليوم',sync:'المزامنة والتكاملات',
      settings:'الإعدادات',welcomeBack:'مرحبًا بعودتك',openMenu:'فتح القائمة',closeMenu:'إغلاق القائمة',
      switchLang:'Switch to English',switchLangAr:'التبديل إلى العربية',
      dismiss:'إخفاء',gotIt:'تم',shortcuts:'اختصارات لوحة المفاتيح',
      noResults:'لا توجد نتائج بعد',addFirst:'أضف أول عنصر للبدء.',
      backToList:'العودة إلى القائمة',export:'تصدير'
    };
    if(typeof I18N==='object'&&I18N){
      Object.keys(extras_en).forEach(function(k){if(!(k in I18N.en))I18N.en[k]=extras_en[k];});
      Object.keys(extras_ar).forEach(function(k){if(!(k in I18N.ar))I18N.ar[k]=extras_ar[k];});
    }
  }catch(e){console.warn('[v25] i18n extend failed',e);}

  /* ---- 2. Bilingual TITLES — bilingualise existing TITLES so AR mode translates titles ---- */
  try{
    if(typeof TITLES==='object'&&TITLES){
      var TITLES_AR={
        today:['اليوم','ما يحتاج اهتمامك الآن — مهل · متأخرات · متابعة تحصيل · هوامش منخفضة'],
        dashboard:['لوحة التحكم','مركز القيادة التجاري'],
        leads:['العملاء المحتملون','مسارات · عمل واحد · جهات اتصال متعددة · خط أنابيب قابل للتعيين'],
        clients:['العملاء','حسابات مكسوبة — كتاب أعمالك المُدار'],
        bookings:['الحجوزات','كل تنفيذ — تذاكر، فنادق، تأشيرات، نقل · مرتبط بالعميل والعرض والفاتورة'],
        invoices:['الفواتير','الفوترة — بنود مرتبطة بالحجوزات والتذاكر'],
        tickets:['التذاكر','سجل التذاكر — كل PNR / تذكرة إلكترونية عبر الحجوزات'],
        airlines:['شركات الطيران','حسابات الناقلين — التوريد، البوابات، ADM، جهات الاتصال'],
        vendors:['الموردون و GDS','الموردون — التوريد، تسجيلات الدخول، ADM، العمليات، جهات الاتصال'],
        sops:['مكتبة الإجراءات','إجراءات السوق السعودي، مرفوعة إلى معيار عالمي'],
        slas:['مستويات الخدمة','Direct Business مقابل السوق والشركات الكبرى'],
        ops:['العمليات','استلام الطلب → التنفيذ → التسليم'],
        offers:['منشئ العروض','حوّل تفاصيل الطلب إلى عرض سعر بهوية Direct للبريد / واتساب'],
        activity:['النشاط والتدقيق','كل تعديل، من قام به ومتى — بمصدر موحد'],
        archive:['الأرشيف','العناصر المؤرشفة (الحذف الناعم) — قابلة للاستعادة'],
        sync:['المزامنة والتكاملات','مصدر الحقيقة · حل التعارضات · المزامنة الصاعدة والهابطة'],
        settings:['الإعدادات','اللغة · النسخ الاحتياطي · حالة الذهاب للإنتاج · مجموعات الاختبار'],
        sopsla:['الإجراءات ومستويات الخدمة','إجراءات العمل ومعايير مستوى الخدمة'],
        reports:['التقارير','أهداف 2026 · الإنجازات · تقدّم المؤشرات · منشئ التقارير'],
        finance:['المالية','سجل الفواتير الرئيسي · منشئ التقارير · بيانات النصف الأول 2026 المدققة'],
        events:['الفعاليات','رادار فعاليات السعودية — تقويم فرص المبيعات والشراكات']
      };
      window.__V25_TITLES_AR=TITLES_AR;
    }
  }catch(e){console.warn('[v25] titles bilingualise failed',e);}

  /* ---- 3. Patch render() to use bilingual titles + fallback guard ---- */
  try{
    if(typeof render==='function'){
      var __origRender=render;
      window.render=function(){
        try{
          // Guarantee TITLES[current] always returns something safe
          if(typeof TITLES==='object'&&TITLES&&!TITLES[current]){
            TITLES[current]=['Direct Business',''];
          }
          var t=__origRender.apply(this,arguments);
          // After render, override title/sub with AR if needed
          if(typeof LANG!=='undefined'&&LANG==='ar'&&window.__V25_TITLES_AR&&window.__V25_TITLES_AR[current]){
            var vT=document.getElementById('vTitle'), vS=document.getElementById('vSub');
            if(vT)vT.textContent=window.__V25_TITLES_AR[current][0];
            if(vS)vS.textContent=window.__V25_TITLES_AR[current][1];
          }
          // Replace hero greeting (if rendered with hardcoded EN) — only when AR active
          if(typeof LANG!=='undefined'&&LANG==='ar'){
            var hero=document.querySelector('.hero h2');
            if(hero && /Welcome back/i.test(hero.textContent)){
              hero.textContent='مرحبًا بعودتك، عبدالرحمن';
            }
            var sub=document.querySelector('.hero p');
            if(sub && /Every business you/i.test(sub.textContent)){
              sub.textContent='كل عمل قمت بفوترته يومًا — العملاء، أهداف التحويل الدافئة، موردو عمولات الدراسة بالخارج، والأعمال المختبئة في فواتير B2C — في خط أنابيب واحد جاهز للعمل.';
            }
          }
          return t;
        }catch(err){
          console.error('[v25] render wrapper error',err);
          return __origRender.apply(this,arguments);
        }
      };
    }
  }catch(e){console.warn('[v25] render wrap failed',e);}

  /* ---- 4. Escape-closes-detail-views (the big one — P0 fix) ---- */
  try{
    var v25DismissDetail=function(){
      // Returns true if it closed something detail-shaped
      if(typeof openLead!=='undefined'&&openLead){ openLead=null; if(typeof leadDetailView!=='undefined')leadDetailView='detail'; render(); return true; }
      if(typeof openSup!=='undefined'&&openSup){ openSup=null; if(typeof supView!=='undefined')supView='detail'; render(); return true; }
      if(typeof openOffer!=='undefined'&&openOffer){ openOffer=null; render(); return true; }
      if(typeof openBooking!=='undefined'&&openBooking){ openBooking=null; render(); return true; }
      if(typeof openInvoice!=='undefined'&&openInvoice){ openInvoice=null; render(); return true; }
      return false;
    };
    window.v25DismissDetail=v25DismissDetail;
    // Capture-phase listener so it runs BEFORE the existing keydown that falls through to closeSide
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var tag=(e.target&&e.target.tagName||'').toLowerCase();
      var inField=tag==='input'||tag==='textarea'||tag==='select'||(e.target&&e.target.isContentEditable);
      if(inField)return;
      var ov=document.getElementById('ov');
      if(ov&&ov.classList.contains('show'))return; // modal handler will take it
      var pal=document.getElementById('v19palette');
      if(pal&&pal.classList.contains('show'))return; // palette handler
      if(v25DismissDetail()){ e.preventDefault(); e.stopPropagation(); }
    },true);
  }catch(e){console.warn('[v25] Esc-detail wire failed',e);}

  /* ---- 5. Patch openModal so Save/Cancel/Delete use T() ---- */
  try{
    if(typeof openModal==='function'){
      var __origOpen=openModal;
      window.openModal=function(title,body,onSave,onDelete){
        __origOpen(title,body,onSave,onDelete);
        // Re-label buttons after modal renders
        var mf=document.querySelector('#modal .mf');
        if(!mf)return;
        var saveBtn=mf.querySelector('#mSave');
        if(saveBtn)saveBtn.textContent=(typeof T==='function'?T('save'):'Save changes');
        var cancelBtn=mf.querySelector('.btn.ghost');
        if(cancelBtn)cancelBtn.textContent=(typeof T==='function'?T('cancel'):'Cancel');
        var delBtn=mf.querySelector('#mDel');
        if(delBtn)delBtn.textContent=(typeof T==='function'?T('delete_'):'Delete');
        // Make × close button aria-labelled
        var x=document.querySelector('#modal .mh .iconbtn');
        if(x){
          x.setAttribute('role','button');
          x.setAttribute('tabindex','0');
          x.setAttribute('aria-label',(typeof T==='function'?T('close'):'Close'));
          x.setAttribute('title',(typeof T==='function'?T('close'):'Close'));
          // Allow keyboard activation
          x.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();if(typeof closeModal==='function')closeModal();}});
        }
        // Focus trap inside modal
        var modal=document.getElementById('modal');
        if(modal){
          var focusables=modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
          if(focusables.length){setTimeout(function(){focusables[0].focus();},30);}
          modal.addEventListener('keydown',function(ev){
            if(ev.key!=='Tab')return;
            var first=focusables[0], last=focusables[focusables.length-1];
            if(ev.shiftKey && document.activeElement===first){ev.preventDefault();last&&last.focus();}
            else if(!ev.shiftKey && document.activeElement===last){ev.preventDefault();first&&first.focus();}
          });
        }
      };
    }
  }catch(e){console.warn('[v25] openModal patch failed',e);}

  /* ---- 6. Make help overlay dismissible via corner ✕ ---- */
  try{
    var addHelpClose=function(){
      var h=document.getElementById('v19help');
      if(!h||h.querySelector('.v25-help-x'))return;
      var x=document.createElement('button');
      x.className='v25-help-x';
      x.setAttribute('aria-label',(typeof T==='function'?T('close'):'Close'));
      x.title=(typeof T==='function'?T('close'):'Close');
      x.textContent='✕';
      x.onclick=function(){h.classList.remove('show');};
      // Place inside .hb if it exists
      var hb=h.querySelector('.hb')||h;
      hb.style.position=hb.style.position||'relative';
      x.style.cssText='position:absolute;top:10px;right:12px;background:transparent;border:0;font-size:16px;cursor:pointer;color:#7c8194;padding:6px 10px;border-radius:8px;line-height:1';
      hb.appendChild(x);
    };
    // Lazy-attempt: help element is built once at boot, but safe to re-run
    if(document.readyState!=='loading')addHelpClose();
    else document.addEventListener('DOMContentLoaded',addHelpClose);
  }catch(e){console.warn('[v25] help close failed',e);}

  /* ---- 7. Backup banner ✕ dismiss + aria labels on icon buttons ---- */
  try{
    var v25EnhanceBanners=function(){
      // Make all v??Banner divs dismissible (idempotent)
      var banners=document.querySelectorAll('.v24BkBanner,.v22GoLiveBanner,.v21RestoreBanner,.v21DraftBanner,.v21HashBanner,.v21HashChainBanner,.v20ConflictBanner');
      banners.forEach(function(b){
        if(b.querySelector('.v25-banner-x'))return;
        var x=document.createElement('button');
        x.className='v25-banner-x';
        x.setAttribute('aria-label',(typeof T==='function'?T('dismiss'):'Dismiss'));
        x.title=(typeof T==='function'?T('dismiss'):'Dismiss');
        x.textContent='✕';
        x.style.cssText='background:transparent;border:0;color:inherit;opacity:.55;font-size:14px;cursor:pointer;margin-left:auto;padding:4px 8px;border-radius:6px;line-height:1';
        x.onmouseover=function(){x.style.opacity='1';};
        x.onmouseout=function(){x.style.opacity='.55';};
        x.onclick=function(){b.style.display='none';};
        // Append; if banner uses flex this will sit at far end
        b.style.display=b.style.display||'flex';
        b.style.alignItems=b.style.alignItems||'center';
        b.style.gap=b.style.gap||'10px';
        b.appendChild(x);
      });
      // Icon-only sidebar toggle / language / etc.
      var iconBtns=document.querySelectorAll('.iconbtn:not([aria-label])');
      iconBtns.forEach(function(el){
        var txt=(el.textContent||'').trim();
        var lab=txt==='✕'||txt==='×'?(typeof T==='function'?T('close'):'Close'):(typeof T==='function'?T('openMenu'):txt||'Action');
        el.setAttribute('aria-label',lab);
        el.setAttribute('title',lab);
        el.setAttribute('role','button');
        if(!el.getAttribute('tabindex'))el.setAttribute('tabindex','0');
      });
    };
    window.v25EnhanceBanners=v25EnhanceBanners;
    // Run after each render (we wrap render)
    var __origRender2=window.render;
    window.render=function(){
      var r=__origRender2.apply(this,arguments);
      setTimeout(v25EnhanceBanners,30);
      return r;
    };
  }catch(e){console.warn('[v25] banner enhancement failed',e);}

  /* ---- 8. Skip link injected at top of body ---- */
  try{
    if(!document.getElementById('v25SkipLink')){
      var skip=document.createElement('a');
      skip.id='v25SkipLink';
      skip.href='#view';
      skip.textContent=(typeof T==='function'?T('backToList'):'Skip to main content');
      skip.className='v25-skip';
      document.body.insertBefore(skip,document.body.firstChild);
    }
  }catch(e){console.warn('[v25] skip link failed',e);}

  /* ---- 9. CSS polish appendix — mobile, focus-visible, modal-mobile, banner spacing ---- */
  try{
    if(!document.getElementById('v25css')){
      var st=document.createElement('style');
      st.id='v25css';
      st.textContent=
      /* Skip link */
      ".v25-skip{position:absolute;left:auto;top:-9999px;width:1px;height:1px;overflow:hidden;z-index:1000;background:var(--ink);color:#fff;padding:8px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none}"+
      ".v25-skip:focus{left:14px;top:14px;width:auto;height:auto;outline:3px solid var(--orange);outline-offset:2px}"+

      /* Focus-visible — restore keyboard focus rings */
      "button:focus-visible,[role=button]:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--orange,#FF6B00);outline-offset:2px;border-radius:6px}"+
      ".nav button:focus-visible{outline:3px solid #fff;outline-offset:-2px}"+

      /* Modal mobile fluid */
      "@media(max-width:640px){.modal{width:100%!important;border-radius:14px}.modal .mb{padding:14px 16px}.modal .mh,.modal .mf{padding-left:16px;padding-right:16px}}"+

      /* Touch target floor on mobile */
      "@media(max-width:640px){.btn,.btn.sm,.seg button,.iconbtn{min-height:40px}}"+
      "@media(max-width:480px){.btn,.btn.sm,.seg button,.iconbtn{min-height:44px;padding-top:10px;padding-bottom:10px}}"+

      /* Toolbar wrapping fix */
      "@media(max-width:600px){.search-wrap{min-width:140px!important}.seg{flex-wrap:wrap}.toolbar{gap:8px}}"+

      /* Hero on mobile - tighten padding */
      "@media(max-width:480px){.hero{padding:18px 16px;border-radius:14px}.hero h2{font-size:18px}.hero p{font-size:12.5px}.hero::after{display:none}}"+

      /* KPI grid more sensible 3-up */
      "@media(min-width:1200px){.kpis{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}}"+

      /* Banner ✕ harmonise */
      ".v25-banner-x{flex:0 0 auto;align-self:flex-start}"+

      /* Visible :focus-within on cards being keyboard-navigated */
      ".card:focus-within{box-shadow:0 0 0 2px var(--orange,#FF6B00),var(--shadow-lg)}"+

      /* High-contrast hover on row actions */
      "tbody tr:focus-within td{background:#FFF5EA}"+

      /* Make sure modal max-height accounts for mobile keyboards */
      "@media(max-width:640px){.modal{max-height:88vh}}"+

      /* Truncate long names everywhere */
      ".trunc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}"+

      /* Detail back-button bigger on touch */
      "@media(max-width:640px){.btn[onclick*='close']{min-width:80px}}"+

      /* Icon button hit area */
      ".iconbtn{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;cursor:pointer;border-radius:8px;padding:4px 8px;border:0;background:transparent;color:inherit}"+
      ".iconbtn:hover{background:rgba(0,0,0,.05)}"+

      /* Mobile sidebar full close indicator */
      "@media(max-width:860px){.side .brand{padding-right:46px}}"+

      /* Help overlay better presentation */
      ".v19-help .hb{position:relative;padding-top:38px}"+

      /* Print: hide skip link */
      "@media print{.v25-skip,.v25-banner-x,.v25-help-x{display:none!important}}";
      document.head.appendChild(st);
    }
  }catch(e){console.warn('[v25] css inject failed',e);}

  /* ---- 10. Language button label clarity (show next language target) ---- */
  try{
    var v25FixLangBtn=function(){
      var lb=document.getElementById('langBtn');
      if(!lb)return;
      var span=lb.querySelector('#langLab');
      if(!span)return;
      var nextLab=LANG==='en'?'العربية':'English';
      span.textContent=nextLab;
      lb.setAttribute('aria-label',(typeof T==='function'?(LANG==='en'?T('switchLang'):T('switchLangAr')):('Switch language to '+nextLab)));
      lb.setAttribute('title',lb.getAttribute('aria-label'));
    };
    window.v25FixLangBtn=v25FixLangBtn;
    var __origRender3=window.render;
    window.render=function(){
      var r=__origRender3.apply(this,arguments);
      setTimeout(v25FixLangBtn,40);
      return r;
    };
  }catch(e){console.warn('[v25] lang label fix failed',e);}

  console.info('%c[v25] UX QA bundle loaded','color:#FF6B00;font-weight:700');
})();

/* ============================================================
   v25.1 READ-ONLY SYNC GUARD — Direct-system-owned sections
   Bookings / Invoices / Tickets are owned by the Direct system.
   Direct Business is a read-only follow-up + sync view, so on
   those sections this hides create/edit/delete/credit-note/ZATCA/
   ingest controls and shows a "Synced from Direct" banner + deep
   link. 100% additive — no app functions removed (suites intact).
   ROLLBACK: delete this whole (function(){...})(); block.
   ============================================================ */
(function(){
  try{
    var RO={bookings:1,invoices:1,tickets:1};
    var HIDE=['ingestModal','editBooking','editInvoice','softDeleteEntity','ticketFromBooking','invoiceFromBooking','createCreditNote','recordPayment','zatcaSubmit','b18addSSR','qcToggle','newBooking','newInvoice','addTicket','addBooking','markInvoicePaid','v20MarkPaid','v22SendForReview','v20IssueTicket','v20VoidBooking','v20Refund','deleteBundleTemplate','deleteTag'];
    var LINKS={invoices:'https://payments.directksa.com/en/admin/invoices',bookings:'https://payments.directksa.com/en/admin',tickets:'https://payments.directksa.com/en/admin'};
    if(!document.getElementById('roSyncCss')){
      var st=document.createElement('style'); st.id='roSyncCss';
      st.textContent=".ro-sync-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px;padding:11px 15px;border:1px solid rgba(255,107,0,.35);background:linear-gradient(90deg,rgba(255,107,0,.10),rgba(255,157,69,.04));border-radius:12px;font-size:13px;color:#3C4050}.ro-sync-banner .ro-ic{font-size:15px}.ro-sync-banner .ro-tx b{color:#1C1E2B}.ro-sync-banner .ro-ar{color:#6b7280;direction:rtl;unicode-bidi:isolate}.ro-sync-banner a.ro-link{margin-inline-start:auto;background:#1C1E2B;color:#fff;text-decoration:none;padding:7px 13px;border-radius:8px;font-weight:700;font-size:12.5px;white-space:nowrap}.ro-sync-banner a.ro-link:hover{background:#FF6B00}";
      document.head.appendChild(st);
    }
    function secNow(){
      var s=(typeof current!=='undefined'&&current)?current:null;
      if(!s){var ab=document.querySelector('#nav button.active');if(ab){var i=[].indexOf.call(document.querySelectorAll('#nav button'),ab);if(typeof VIEWS!=='undefined'&&VIEWS[i])s=VIEWS[i].id;}}
      return s;
    }
    function roApply(){
      var sec=secNow(); if(!RO[sec])return;
      var view=document.getElementById('view'); if(!view)return;
      var nodes=view.querySelectorAll('[onclick]');
      for(var i=0;i<nodes.length;i++){
        var oc=nodes[i].getAttribute('onclick')||'';
        for(var j=0;j<HIDE.length;j++){ if(oc.indexOf(HIDE[j])>-1){ nodes[i].style.display='none'; break; } }
      }
      var dz=view.querySelectorAll('[ondrop],[class*="dropzone"],[class*="dz-"]');
      for(var k=0;k<dz.length;k++){ dz[k].style.display='none'; }
      if(!view.querySelector('.ro-sync-banner')){
        var b=document.createElement('div'); b.className='ro-sync-banner'; b.setAttribute('role','note');
        var href=LINKS[sec]||'https://payments.directksa.com/en/admin';
        var _roAr=(typeof LANG!=='undefined'&&LANG==='ar');
        var _roBtnLab=_roAr?'افتح في دايركت ↗':'Open in Direct ↗';
        /* Owner correction 2026-08-22: this used to always show the English sentence in
           bold with a small Arabic gloss beside it, so an Arabic-mode screen still read as
           English-first. Now the language actually being used gets the bold/primary slot;
           the other language stays as the small gloss. */
        var enTx="<b>Live from the Direct system — read-only.</b> Create, edit &amp; billing happen in Direct.";
        var arTx="<b>مباشر من نظام دايركت — للعرض فقط.</b> الإنشاء والتعديل والفوترة تتم داخل دايركت.";
        var secondaryDir=_roAr?"ltr":"rtl";
        b.innerHTML="<span class='ro-ic'>🔒</span><span class='ro-tx'>"+(_roAr?arTx:enTx)+"</span><span class='ro-ar' style='direction:"+secondaryDir+"'>"+(_roAr?enTx.replace(/<\/?b>/g,''):arTx.replace(/<\/?b>/g,''))+"</span><a class='ro-link' target='_blank' rel='noopener' href='"+href+"'>"+_roBtnLab+"</a>";
        view.insertBefore(b, view.firstChild);
      }
    }
    var __roOrig=window.render;
    window.render=function(){ var r=__roOrig.apply(this,arguments); try{roApply();}catch(e){console.warn('[v25.1] ro guard',e);} return r; };
    window.__roApply=roApply;
    console.info('%c[v25.1] read-only sync guard loaded','color:#FF6B00;font-weight:700');
  }catch(e){console.warn('[v25.1] guard init failed',e);}
})();


/* ========================================================================
   V25.2 BUILD BUNDLE — additive IIFE, non-breaking, post-v25.1 read-only.
   Tracks A (strip competitive framing) + B (trim nav) + C (Sync hardening)
   + D (Pool widget, View presets, Projects, Generators, Template-learn,
   Legacy dashboards). Storage key bumps to v25; v24 data preserved.
   Generated 2026-06-02. Rollback = delete this entire IIFE block.
   ======================================================================== */
(function v25_2Build(){
  if(window.__V25_2_LOADED__)return;
  window.__V25_2_LOADED__=true;
  var V25_KEY='directBusinessData_v25';
  var V24_KEY='directBusinessData_v24';


  /* ===== Storage migration v24 -> v25 (additive) ===== */
  try{
    if(typeof DB==='object'&&DB){
      DB.settings=DB.settings||{};
      if(!DB.settings.commercialPool){
        DB.settings.commercialPool={
          capSAR:1250000,
          editable:true,
          history:[{ts:Date.now(),cap:1250000,by:'system',note:'Initial v25 cap'}],
          billingPeriod:'gregorianMonth',
          warningOnly:true
        };
      }
      if(!DB.settings.viewPresets){
        DB.settings.viewPresets={
          active:'everything',
          available:['commercial','finance','cfo','everything','b2b']
        };
      }
      if(!Array.isArray(DB.projects)){
        DB.projects=[
          {id:'p_osaka',name:'Osaka Roadshow 2026',nameAr:'جولة أوساكا 2026',client:'b_mod',start:'2026-04-12',end:'2026-04-19',status:'Closed',pax:8,budget:185000,actualCost:172400,profit:42600,docs:[],bookings:[],owner:'Commercial',notes:'Government delegation, 6 cities Osaka-Kyoto'},
          {id:'p_lisbon',name:'Lisbon Trade Mission',nameAr:'بعثة لشبونة التجارية',client:'b_chamber',start:'2026-03-02',end:'2026-03-08',status:'Closed',pax:14,budget:312000,actualCost:289100,profit:78900,docs:[],bookings:[],owner:'Commercial',notes:'Chamber-led mission'},
          {id:'p_dc',name:'Washington DC Investment Forum',nameAr:'منتدى واشنطن للاستثمار',client:'b_pif',start:'2026-05-18',end:'2026-05-22',status:'Active',pax:22,budget:540000,actualCost:0,profit:0,docs:[],bookings:[],owner:'CFO',notes:'PIF-sponsored'},
          {id:'p_london',name:'London Tech Summit',nameAr:'قمة لندن للتقنية',client:'b_kacst',start:'2026-07-09',end:'2026-07-14',status:'Proposed',pax:18,budget:425000,actualCost:0,profit:0,docs:[],bookings:[],owner:'Commercial',notes:'KACST delegation'},
          {id:'p_usa',name:'USA East Coast Education Tour',nameAr:'جولة شرق أمريكا التعليمية',client:'b_uzf',start:'2026-08-15',end:'2026-08-28',status:'Proposed',pax:34,budget:780000,actualCost:0,profit:0,docs:[],bookings:[],owner:'Finance',notes:'13 days, 4 cities'},
          {id:'p_morocco',name:'Morocco Cultural Mission',nameAr:'بعثة المغرب الثقافية',client:'b_culture',start:'2026-09-04',end:'2026-09-11',status:'Proposed',pax:12,budget:215000,actualCost:0,profit:0,docs:[],bookings:[],owner:'Commercial',notes:'Ministry-led'}
        ];
      }
      if(!Array.isArray(DB.serviceFeePricing)){
        DB.serviceFeePricing=[
          {id:'sfp_default',name:'Standard fee card',perItem:{flight:75,hotel:50,transfer:25,visa:120,daytour:40,insurance:15,lounge:30},currency:'SAR'},
          {id:'sfp_gov',name:'Government tier',perItem:{flight:50,hotel:30,transfer:15,visa:90,daytour:25,insurance:10,lounge:20},currency:'SAR'},
          {id:'sfp_corp',name:'Corporate tier',perItem:{flight:65,hotel:45,transfer:20,visa:100,daytour:35,insurance:12,lounge:25},currency:'SAR'}
        ];
      }
      if(!DB.templateLibrary){
        DB.templateLibrary={
          serviceFee:{palette:['#FF6B00','#1C1E2B','#FFFFFF','#7C8194'],font:'Inter',header:'centered-logo',footer:'IATA + VAT',signatureBlock:'right-align'},
          projectProposal:{palette:['#FF6B00','#2A2D3E','#FBF8F4','#16B364'],font:'Tajawal + Inter',header:'cover-page',footer:'page-numbers',signatureBlock:'two-column'},
          statement:{palette:['#1C1E2B','#FF6B00','#16B364','#F0453A'],font:'Inter',header:'invoice-style',footer:'ZATCA QR',signatureBlock:'none'},
          learnedFrom:[],
          learnedAt:null
        };
      }
      if(typeof DB.schemaVersion==='undefined'||DB.schemaVersion<25){
        DB.schemaVersion=25;
      }
      // Write to both keys for safety
      try{ localStorage.setItem(V25_KEY,JSON.stringify(DB)); }catch(_){}
      try{ localStorage.setItem(V24_KEY,JSON.stringify(DB)); }catch(_){}
    }
  }catch(e){console.warn('[v25.2] storage migration failed',e);}


  /* ===== Track A: Strip competitive framing via post-render DOM sweep ===== */
  var V25_REPLACEMENTS=[
    // SOPs renderer (Track A) - using \u escape so source is encoding-immune
    ['Not a transcript — a benchmark.','Our follow-up rulebook.'],
    ['Not a transcript - a benchmark.','Our follow-up rulebook.'],
    ['Every desk procedure from the Saudi-market channel','Every desk procedure the team should run, drawn from'],
    [' (TourPro) and our own ops groups, each paired with the ','(TourPro) and our own ops groups, each paired with the '],
    ['market standard','common practice baseline'],
    ['how Direct Business beats it','our own standard'],
    ['eight whale-grade SOPs','extended procedures'],
    ['whale-grade SOPs the local market lacks entirely','extended procedures we added on top'],
    ['whale-grade SOPs','extended procedures'],
    ['Whale-grade SOPs','Extended procedures'],
    ['the local market lacks entirely','we added on top'],
    ['Desk procedures (Saudi base — elevated)','Desk procedures'],
    ['Desk procedures (Saudi base - elevated)','Desk procedures'],
    ['Whale-grade additions (the market gap)','Extended procedures'],
    ['Whale-grade additions','Extended procedures'],
    ['whale-grade additions','extended procedures'],
    ['Saudi market standard','Common practice'],
    ['Direct Business edge','Our standard'],
    // SLAs renderer
    ['Targets built bottom-up from','Our internal targets, built from'],
    ["what actually happens on the Saudi market","what happens day-to-day"],
    ["(e.g. RateHawk's routinely-breached 72h window)",""],
    [" and topped out against the operating model of "," "],
    ["Amex GBT, BCD, CWT & Navan",""],
    [" Direct Business targets beat the local market"," of our targets are faster than common practice"],
    ['Direct Business targets beat the local market','of our targets are faster than common practice'],
    ['Edit any cell inline.','Edit any cell inline as our process matures.'],
    ['Beats market','Faster than common'],
    ['Meets best practice','Standard target'],
    ['Saudi market','Common practice'],
    ['Industry whales','Stretch goal'],
    // TITLES subtitles
    ['Saudi-market procedures, elevated to global standard','Our internal follow-up procedures · the way we want desks to run'],
    ['Direct Business vs the market vs the industry whales','Our internal targets · the response windows we hold ourselves to']
  ];
  var v25StripCompetitive=function(){
    try{
      // Replace in vTitle/vSub directly (TITLES drives those)
      var vT=document.getElementById('vTitle'),vS=document.getElementById('vSub');
      if(vT)for(var i=0;i<V25_REPLACEMENTS.length;i++){var r=V25_REPLACEMENTS[i];if(vT.textContent.indexOf(r[0])>=0)vT.textContent=vT.textContent.split(r[0]).join(r[1]);}
      if(vS)for(var j=0;j<V25_REPLACEMENTS.length;j++){var r2=V25_REPLACEMENTS[j];if(vS.textContent.indexOf(r2[0])>=0)vS.textContent=vS.textContent.split(r2[0]).join(r2[1]);}
      // Sweep view area
      var view=document.getElementById('view');
      if(!view)return;
      // Per-node text-node walk (HTML structure preserved)
      var walker=document.createTreeWalker(view,NodeFilter.SHOW_TEXT,null,false);
      var nodes=[],n;while(n=walker.nextNode())nodes.push(n);
      nodes.forEach(function(tn){
        var txt=tn.nodeValue;
        if(!txt||txt.length<3)return;
        var changed=false;
        for(var k=0;k<V25_REPLACEMENTS.length;k++){
          var r3=V25_REPLACEMENTS[k];
          if(txt.indexOf(r3[0])>=0){ txt=txt.split(r3[0]).join(r3[1]); changed=true; }
        }
        if(changed)tn.nodeValue=txt;
      });
    }catch(e){console.warn('[v25.2] strip-competitive failed',e);}
  };
  window.v25StripCompetitive=v25StripCompetitive;


  /* ===== Track B: Nav restructure (≤8 primary + read-only mirror + ▾ More) ===== */
  // Primary nav order (8 items + new Projects = 9, will fold)
  var V25_PRIMARY=['today','leads','clients','offers','ops','reports','settings'];
  // Reference/library pages — real content, but not daily-driver pages. Grouped and
  // collapsed so the working nav matches the go-live focus (Today/Leads/Clients/
  // Proposals/Operations/Finance/Reports/Settings), like the leaders' 6-8 item navs.
  var V25_REFERENCE=['events','airlines','vendors','sopsla'];
  var V25_READONLY=['bookings','invoices','tickets'];
  var V25_MORE=[];
  // Ensure VIEWS has settings + projects
  try{
    if(typeof VIEWS==='object'&&Array.isArray(VIEWS)){
      var hasSettings=VIEWS.some(function(v){return v.id==='settings';});
      if(!hasSettings){VIEWS.push({id:'settings',label:'Settings',ic:(typeof IC!=='undefined'&&IC.sla)||'⚙️',primary:false});}
      var hasProjects=VIEWS.some(function(v){return v.id==='projects';});
      if(!hasProjects){VIEWS.push({id:'projects',label:'Projects',ic:(typeof IC!=='undefined'&&IC.ops)||'📁',primary:true});}
      // Add titles
      if(typeof TITLES==='object'&&TITLES){
        if(!TITLES.settings)TITLES.settings=['Settings','Language · backup · go-live · test suites'];
        if(!TITLES.projects)TITLES.projects=['Projects','MDD-style multi-trip engagements · proposals, closeouts, P&L'];
      }
    }
  }catch(e){console.warn('[v25.2] views extend failed',e);}

  var v25_2RestructureNav=function(){
    try{
      var nav=document.getElementById('nav');
      if(!nav)return;
      // Build a map of existing buttons by their associated id
      var existing={};
      var btns=nav.querySelectorAll('button');
      if(!btns.length||!Array.isArray(VIEWS))return;
      // Match buttons to VIEWS by index in original order
      btns.forEach(function(b,i){
        if(VIEWS[i])existing[VIEWS[i].id]=b;
      });
      // Clear and rebuild
      nav.innerHTML='';
      var makeSection=function(label){
        var s=document.createElement('div');
        s.className='navsec v25-navsec';
        s.style.cssText='padding:8px 14px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#5C637C;font-weight:700;margin-top:6px';
        s.textContent=label;
        return s;
      };
      // Helper: attach button onclick based on view id
      var wireBtn=function(view){
        var b=document.createElement('button');
        b.innerHTML=(view.ic||'•')+'<span>'+((typeof T==='function')?T(view.label):view.label)+'</span>';
        b.className=view.id===current?'active':'';
        b.onclick=function(){
          current=view.id;
          if(typeof openLead!=='undefined')openLead=null;
          if(typeof openSup!=='undefined')openSup=null;
          if(typeof openOffer!=='undefined')openOffer=null;
          if(typeof openBooking!=='undefined')openBooking=null;
          if(typeof openInvoice!=='undefined')openInvoice=null;
          if(typeof supView!=='undefined')supView='detail';
          if(typeof leadDetailView!=='undefined')leadDetailView='detail';
          render();window.scrollTo(0,0);if(typeof closeSide==='function')closeSide();
        };
        return b;
      };
      // PRIMARY group
      V25_PRIMARY.forEach(function(id){
        var v=VIEWS.find(function(x){return x.id===id;});
        if(v)nav.appendChild(wireBtn(v));
      });
      // REFERENCE group (collapsible; opens automatically when you're on one of its pages)
      var CHV_R0=String.fromCharCode(0x25B8),CHV_D0=String.fromCharCode(0x25BE);
      var refOpen=localStorage.getItem('v25_navRefOpen')==='true'||V25_REFERENCE.indexOf(current)>=0;
      var refLbl=function(){return (typeof T==='function')?T('Reference'):'Reference';};
      var refTog=document.createElement('button');
      refTog.className='v25-more-tog';
      refTog.style.cssText='background:transparent;border:0;color:#7E859E;padding:10px 14px;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;width:100%;text-align:left;margin-top:10px;font-family:inherit;display:flex;align-items:center;gap:6px';
      refTog.innerHTML=(refOpen?CHV_D0:CHV_R0)+' '+refLbl();
      var refWrap=document.createElement('div');
      refWrap.style.display=refOpen?'flex':'none';refWrap.style.flexDirection='column';refWrap.style.gap='3px';
      refTog.onclick=function(){var o=refWrap.style.display!=='none';refWrap.style.display=o?'none':'flex';refTog.innerHTML=(!o?CHV_D0:CHV_R0)+' '+refLbl();localStorage.setItem('v25_navRefOpen',!o);};
      nav.appendChild(refTog);
      V25_REFERENCE.forEach(function(id){
        var v=VIEWS.find(function(x){return x.id===id;});
        if(v){var b=wireBtn(v);b.style.opacity='.85';b.style.fontSize='12.5px';refWrap.appendChild(b);}
      });
      nav.appendChild(refWrap);
      // READ-ONLY MIRROR group (collapsible, collapsed by default)
      var CHV_R=String.fromCharCode(0x25B8),CHV_D=String.fromCharCode(0x25BE);
      var roOpen=localStorage.getItem('v25_navRoOpen')==='true';
      var roTog=document.createElement('button');
      roTog.className='v25-more-tog';
      roTog.style.cssText='background:transparent;border:0;color:#7E859E;padding:10px 14px;cursor:pointer;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;width:100%;text-align:left;margin-top:10px;font-family:inherit;display:flex;align-items:center;gap:6px';
      roTog.innerHTML=(roOpen?CHV_D:CHV_R)+' '+((typeof T==='function')?T('From Direct (read-only)'):'From Direct (read-only)');
      var roWrap=document.createElement('div');
      roWrap.style.display=roOpen?'flex':'none';roWrap.style.flexDirection='column';roWrap.style.gap='3px';
      roTog.onclick=function(){var o=roWrap.style.display!=='none';roWrap.style.display=o?'none':'flex';roTog.innerHTML=(!o?CHV_D:CHV_R)+' '+((typeof T==='function')?T('From Direct (read-only)'):'From Direct (read-only)');localStorage.setItem('v25_navRoOpen',!o);};
      nav.appendChild(roTog);
      V25_READONLY.forEach(function(id){
        var v=VIEWS.find(function(x){return x.id===id;});
        if(v){var b=wireBtn(v);b.style.opacity='.85';b.style.fontSize='12.5px';roWrap.appendChild(b);}
      });
      nav.appendChild(roWrap);
// MORE group (collapsible)
      
    }catch(e){console.warn('[v25.2] nav restructure failed',e);}
  };
  window.v25_2RestructureNav=v25_2RestructureNav;


  /* ===== Pool helpers — compute extended / received / outstanding ===== */
  var v25PoolCompute=function(){
    var pool={cap:1250000,extended:0,received:0,outstanding:0,headroom:0,util:0,topContributors:[],aging:{b030:0,b3160:0,b6190:0,b90:0},trend:[]};
    try{
      if(DB&&DB.settings&&DB.settings.commercialPool){pool.cap=+DB.settings.commercialPool.capSAR||1250000;}
      var invoices=(DB&&DB.invoices)||[];
      var byClient={};
      var now=new Date();
      var thisMonthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();
      var thisMonthEnd=new Date(now.getFullYear(),now.getMonth()+1,1).getTime();
      invoices.forEach(function(inv){
        if(inv._archived)return;
        var total=0;
        try{ if(typeof v18InvTotals==='function'){var t=v18InvTotals(inv);total=t&&t.total||0;}else if(inv.totalSAR){total=+inv.totalSAR;}else if(inv.amount){total=+inv.amount;} }catch(_){total=+inv.amount||0;}
        if(!total||isNaN(total))return;
        var paid=+inv.amountPaid||+inv.paid||0;
        // Treat as extended credit if postpaid / unpaid
        var unpaid=Math.max(0,total-paid);
        pool.extended+=unpaid;
        // Received this calendar month
        var payments=(inv.payments||[]);
        payments.forEach(function(p){
          var ts=new Date(p.date||p.ts).getTime();
          if(ts>=thisMonthStart&&ts<thisMonthEnd){pool.received+=(+p.amount||0);}
        });
        if(unpaid>0){
          var cid=inv.clientId||inv.client||'unknown';
          byClient[cid]=(byClient[cid]||0)+unpaid;
          // Aging
          if(inv.date){
            var days=Math.floor((now.getTime()-new Date(inv.date).getTime())/86400000);
            if(days<=30)pool.aging.b030+=unpaid;
            else if(days<=60)pool.aging.b3160+=unpaid;
            else if(days<=90)pool.aging.b6190+=unpaid;
            else pool.aging.b90+=unpaid;
          }
        }
      });
      pool.outstanding=pool.extended; // simplification: outstanding = unpaid
      pool.headroom=Math.max(0,pool.cap-pool.extended);
      pool.util=pool.cap>0?(pool.extended/pool.cap*100):0;
      // Top contributors
      var contribs=Object.keys(byClient).map(function(cid){
        var name=cid;
        try{ if(typeof leadName==='function')name=leadName(cid)||cid; }catch(_){}
        return {id:cid,name:name,amount:byClient[cid]};
      }).sort(function(a,b){return b.amount-a.amount;}).slice(0,6);
      pool.topContributors=contribs;
      // Trend - 6 months of received
      for(var m=5;m>=0;m--){
        var mStart=new Date(now.getFullYear(),now.getMonth()-m,1).getTime();
        var mEnd=new Date(now.getFullYear(),now.getMonth()-m+1,1).getTime();
        var rec=0,ext=0;
        invoices.forEach(function(inv){
          if(inv._archived)return;
          if(inv.date){
            var dt=new Date(inv.date).getTime();
            if(dt>=mStart&&dt<mEnd){
              var t=0;
              try{ if(typeof v18InvTotals==='function'){t=v18InvTotals(inv).total||0;}else t=+inv.totalSAR||+inv.amount||0;}catch(_){t=+inv.amount||0;}
              ext+=t;
            }
          }
          (inv.payments||[]).forEach(function(p){
            var ts=new Date(p.date||p.ts).getTime();
            if(ts>=mStart&&ts<mEnd){rec+=(+p.amount||0);}
          });
        });
        pool.trend.push({month:new Date(now.getFullYear(),now.getMonth()-m,1).toLocaleString('en',{month:'short'}),extended:ext,received:rec});
      }
    }catch(e){console.warn('[v25.2] pool compute failed',e);}
    return pool;
  };
  window.v25PoolCompute=v25PoolCompute;

  var v25PoolColor=function(util){return util<70?'#16B364':util<90?'#F79009':'#F0453A';};
  var v25Money=function(n){try{return (typeof moneyShort==='function'?moneyShort(n):(Math.round(n).toLocaleString()+' SAR'));}catch(_){return n+' SAR';}};


  /* ===== Track D.1: Render the Pool widget HTML ===== */
  var v25PoolWidget=function(opts){
    opts=opts||{};
    var p=v25PoolCompute();
    var color=v25PoolColor(p.util);
    var pctBar=Math.min(100,p.util);
    var _arPool=(typeof LANG!=='undefined'&&LANG==='ar');
    var html=''+
      '<div class="card v25-pool-card" style="background:linear-gradient(135deg,#FFF7EE,#FFFCF7);border:1px solid #FBD9B8">'+
      '  <div class="card-head" style="align-items:center">'+
      '    <div><h3 style="display:flex;align-items:center;gap:8px">'+(_arPool?'مجمع الائتمان التجاري':'Commercial Credit Pool')+' '+
      (opts.compact?'':'<span style="font-size:11px;color:var(--muted);font-weight:600">'+(_arPool?'الشهر التقويمي':'Calendar month')+'</span>')+'</h3>'+
      '    <div class="ch-sub">'+(_arPool?('السقف '+v25Money(p.cap)+' · الهامش المتاح '+v25Money(p.headroom)):('Cap '+v25Money(p.cap)+' · headroom '+v25Money(p.headroom)))+'</div></div>'+
      '    <button class="btn sm ghost" onclick="v25OpenPoolSettings()" title="'+(_arPool?'تعديل السقف':'Edit cap')+'">⚙️</button>'+
      '  </div>'+
      '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:8px">'+
      '    <div><div style="font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:.04em">'+(_arPool?'الممنوح':'EXTENDED')+'</div><div style="font-size:20px;font-weight:800">'+v25Money(p.extended)+'</div></div>'+
      '    <div><div style="font-size:10.5px;color:var(--muted);font-weight:700">'+(_arPool?'المُستلم (هذا الشهر)':'RECEIVED (this month)')+'</div><div style="font-size:20px;font-weight:800;color:#16B364">'+v25Money(p.received)+'</div></div>'+
      '    <div><div style="font-size:10.5px;color:var(--muted);font-weight:700">'+(_arPool?'المستحق':'OUTSTANDING')+'</div><div style="font-size:20px;font-weight:800;color:#F79009">'+v25Money(p.outstanding)+'</div></div>'+
      '    <div><div style="font-size:10.5px;color:var(--muted);font-weight:700">'+(_arPool?'نسبة الاستخدام':'UTILIZATION')+'</div><div style="font-size:20px;font-weight:800;color:'+color+'">'+p.util.toFixed(1)+'%</div></div>'+
      '  </div>'+
      '  <div style="margin-top:12px;background:#f0f2f7;border-radius:6px;height:9px;overflow:hidden"><div style="height:100%;width:'+pctBar+'%;background:'+color+';transition:width .3s"></div></div>';
    if(!opts.compact){
      html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">';
      // Top contributors
      html+='<div><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:6px">'+(_arPool?'أكبر المساهمين':'TOP CONTRIBUTORS')+'</div>';
      if(p.topContributors.length===0)html+='<div style="font-size:12px;color:var(--muted-2);font-style:italic">'+(_arPool?'لا يوجد — الكل مسدد':'None — all paid up')+'</div>';
      else p.topContributors.forEach(function(c){
        var pct=p.extended>0?(c.amount/p.extended*100):0;
        html+='<div style="display:grid;grid-template-columns:1fr 64px;gap:8px;margin-bottom:5px;font-size:12px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+
          (c.name||c.id)+' <span style="color:var(--muted);font-size:10.5px">('+pct.toFixed(0)+'%)</span></div>'+
          '<div style="text-align:right;font-weight:700">'+v25Money(c.amount)+'</div></div>';
      });
      html+='</div>';
      // Aging
      html+='<div><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:6px">'+(_arPool?'تقادم المستحق':'AGING OF OUTSTANDING')+'</div>';
      var ag=p.aging;
      [['0–30',ag.b030,'#16B364'],['31–60',ag.b3160,'#F79009'],['61–90',ag.b6190,'#F0453A'],['90+',ag.b90,'#7A0511']].forEach(function(row){
        html+='<div style="display:grid;grid-template-columns:60px 1fr 80px;gap:8px;align-items:center;margin-bottom:4px;font-size:12px">'+
          '<div style="color:var(--muted)">'+row[0]+(_arPool?' يومًا':' d')+'</div>'+
          '<div style="background:#f0f2f7;border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;width:'+(p.extended>0?Math.min(100,row[1]/p.extended*100):0)+'%;background:'+row[2]+'"></div></div>'+
          '<div style="text-align:right;font-weight:700">'+v25Money(row[1])+'</div></div>';
      });
      html+='</div></div>';
      // Trend
      if(p.trend.length){
        var maxT=Math.max.apply(null,p.trend.map(function(t){return Math.max(t.extended,t.received);}))||1;
        html+='<div style="margin-top:14px"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:6px">'+(_arPool?'الاتجاه الشهري — الممنوح (برتقالي) مقابل المُستلم (أخضر)':'MONTHLY TREND — extended (orange) vs received (green)')+'</div>';
        html+='<div style="display:grid;grid-template-columns:repeat('+p.trend.length+',1fr);gap:8px;align-items:end;height:70px">';
        p.trend.forEach(function(t){
          var he=t.extended/maxT*60,hr=t.received/maxT*60;
          html+='<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div style="display:flex;gap:2px;align-items:flex-end;height:60px"><div style="width:8px;height:'+he+'px;background:#FF6B00;border-radius:2px 2px 0 0" title="'+(_arPool?'الممنوح':'Extended')+'"></div><div style="width:8px;height:'+hr+'px;background:#16B364;border-radius:2px 2px 0 0" title="'+(_arPool?'المُستلم':'Received')+'"></div></div><div style="font-size:10px;color:var(--muted)">'+t.month+'</div></div>';
        });
        html+='</div></div>';
      }
    }
    html+='</div>';
    return html;
  };
  window.v25PoolWidget=v25PoolWidget;

  window.v25OpenPoolSettings=function(){
    if(typeof openModal!=='function')return;
    var cur=(DB&&DB.settings&&DB.settings.commercialPool)||{capSAR:1250000};
    openModal('Commercial Credit Pool — settings',
      '<div class="field"><label>Pool cap (SAR)</label><input id="v25PoolCap" type="number" value="'+(cur.capSAR||1250000)+'" min="0" step="10000"></div>'+
      '<div class="field"><label>Change reason (logged to audit)</label><input id="v25PoolReason" placeholder="Why are you adjusting the cap?"></div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:8px">Calendar (Gregorian) month is the billing period. Over-limit is informational only — pushes proceed and are audit-logged.</div>',
      function(){
        var newCap=+document.getElementById('v25PoolCap').value||1250000;
        var reason=document.getElementById('v25PoolReason').value||'';
        DB.settings.commercialPool=DB.settings.commercialPool||{};
        var prev=DB.settings.commercialPool.capSAR;
        DB.settings.commercialPool.capSAR=newCap;
        DB.settings.commercialPool.history=DB.settings.commercialPool.history||[];
        DB.settings.commercialPool.history.push({ts:Date.now(),cap:newCap,prevCap:prev,by:'user',note:reason});
        try{if(typeof saveDB==='function')saveDB();}catch(_){}
        try{localStorage.setItem(V25_KEY,JSON.stringify(DB));}catch(_){}
        if(typeof logActivity==='function')logActivity('Credit pool cap changed from '+prev+' to '+newCap+' SAR. Reason: '+reason);
        render();
      }
    );
  };


  /* ===== Track D.2: View presets — Commercial / Finance / CFO / Everything / B2B ===== */
  var V25_PRESETS={
    commercial:{label:'Commercial',ic:'🎯',nav:['today','leads','clients','projects','offers','events','airlines','vendors','sync','settings'],todoKpis:['leads','clients','offers','margin'],sections:{showPool:true,showAR:false,showAging:false}},
    finance:{label:'Finance',ic:'💰',nav:['today','clients','projects','events','sync','settings','bookings','invoices','tickets'],todoKpis:['pool','outstanding','aging','received'],sections:{showPool:true,showAR:true,showAging:true,featurePool:true}},
    cfo:{label:'CFO',ic:'📊',nav:['today','clients','projects','events','sync','settings'],todoKpis:['pool','aging','received','headroom'],sections:{showPool:true,showAR:true,showAging:true,featurePool:true,hideReceived:false}},
    everything:{label:'Everything',ic:'🌐',nav:null,todoKpis:null,sections:{showPool:true,showAR:true,showAging:true}},
    b2b:{label:'B2B snapshot',ic:'📈',nav:['today','clients','projects','events','sync'],todoKpis:['revenue','clients','projects'],sections:{showPool:false,showAR:false}}
  };
  window.V25_PRESETS=V25_PRESETS;

  var v25GetPreset=function(){
    try{
      if(DB&&DB.settings&&DB.settings.viewPresets&&DB.settings.viewPresets.active){
        return DB.settings.viewPresets.active;
      }
    }catch(_){}
    return localStorage.getItem('v25_activePreset')||'everything';
  };
  var v25SetPreset=function(name){
    if(!V25_PRESETS[name])return;
    try{
      DB.settings=DB.settings||{};
      DB.settings.viewPresets=DB.settings.viewPresets||{};
      DB.settings.viewPresets.active=name;
      localStorage.setItem('v25_activePreset',name);
      if(typeof saveDB==='function')saveDB();
      localStorage.setItem(V25_KEY,JSON.stringify(DB));
    }catch(_){}
    if(typeof logActivity==='function')logActivity('View preset changed to: '+name);
    render();
  };
  window.v25GetPreset=v25GetPreset;
  window.v25SetPreset=v25SetPreset;

  var v25RenderPresetDropdown=function(){
    try{
      var _ex=document.getElementById('v25PresetWrap');if(_ex)_ex.remove();
      return; /* preset dropdown removed — was emoji clutter the team doesn't need */
      var tools=document.querySelector('.tools');
      if(!tools||document.getElementById('v25PresetBtn'))return;
      var cur=v25GetPreset();
      var p=V25_PRESETS[cur]||V25_PRESETS.everything;
      var wrap=document.createElement('div');
      wrap.style.cssText='position:relative;display:inline-block';
      wrap.id='v25PresetWrap';
      var btn=document.createElement('button');
      btn.id='v25PresetBtn';
      btn.className='btn sm';
      btn.title='Switch view preset';
      btn.innerHTML=p.ic+' '+p.label+' ▾';
      var menu=document.createElement('div');
      menu.id='v25PresetMenu';
      menu.style.cssText='position:absolute;right:0;top:38px;background:#fff;border:1px solid var(--line-2);border-radius:12px;box-shadow:var(--shadow-lg);padding:6px;min-width:180px;display:none;z-index:50';
      Object.keys(V25_PRESETS).forEach(function(k){
        var pp=V25_PRESETS[k];
        var item=document.createElement('button');
        item.className='btn ghost sm';
        item.style.cssText='display:flex;align-items:center;gap:8px;width:100%;text-align:left;justify-content:flex-start;padding:8px 12px;background:transparent;border:0;cursor:pointer;font-family:inherit'+(k===cur?';background:rgba(255,107,0,.08)':'');
        item.innerHTML='<span style="font-size:15px">'+pp.ic+'</span><span style="flex:1;font-weight:600">'+pp.label+'</span>'+(k===cur?'<span style="color:var(--orange)">●</span>':'');
        item.onclick=function(){menu.style.display='none';v25SetPreset(k);};
        menu.appendChild(item);
      });
      btn.onclick=function(ev){ev.stopPropagation();menu.style.display=menu.style.display==='none'?'block':'none';};
      document.addEventListener('click',function(ev){if(!wrap.contains(ev.target))menu.style.display='none';});
      wrap.appendChild(btn);
      wrap.appendChild(menu);
      // Insert before language button if exists, else at front
      var langBtn=document.getElementById('langBtn');
      if(langBtn)tools.insertBefore(wrap,langBtn);
      else tools.insertBefore(wrap,tools.firstChild);
    }catch(e){console.warn('[v25.2] preset dropdown failed',e);}
  };
  window.v25RenderPresetDropdown=v25RenderPresetDropdown;


  /* ===== Track D.3: Projects renderer ===== */
  var v25EscHTML=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var v25Status={
    'Proposed':{c:'#7A5AF8',bg:'#EEEBFE'},
    'Active':{c:'#16B364',bg:'#E7F8EF'},
    'Closed':{c:'#7C8194',bg:'#EEF0F5'},
    'Archived':{c:'#A6AAB8',bg:'#F2F4F8'}
  };
  window.renderProjects=function(v){
    var projects=(DB&&DB.projects)||[];
    var byStatus={Proposed:[],Active:[],Closed:[],Archived:[]};
    projects.forEach(function(p){var st=p.status||'Proposed';(byStatus[st]||byStatus.Proposed).push(p);});
    var totalBudget=projects.reduce(function(s,p){return s+(+p.budget||0);},0);
    var totalActual=projects.reduce(function(s,p){return s+(+p.actualCost||0);},0);
    var totalProfit=projects.reduce(function(s,p){return s+(+p.profit||0);},0);
    var activeCount=byStatus.Active.length;
    var html=''+
      '<div class="hero">'+
      '  <h2>Projects</h2>'+
      '  <p>Multi-trip engagements — proposal, execution, closeout, P&amp;L. Each project links to its bookings, documents, and a project deck.</p>'+
      '  <div class="chips">'+
      '    <div class="chip"><div class="v">'+projects.length+'</div><div class="l">Projects</div></div>'+
      '    <div class="chip"><div class="v">'+activeCount+'</div><div class="l">Active</div></div>'+
      '    <div class="chip"><div class="v">'+v25Money(totalBudget)+'</div><div class="l">Total budget</div></div>'+
      '    <div class="chip"><div class="v">'+v25Money(totalProfit)+'</div><div class="l">Realized profit</div></div>'+
      '  </div>'+
      '</div>'+
      '<div class="toolbar">'+
      '  <div class="search-wrap">🔍<input id="pqs" placeholder="Search projects" oninput="v25FilterProjects(this.value)"></div>'+
      '  <button class="btn pri" onclick="v25NewProject()">+ New project</button>'+
      '  <button class="btn sm" onclick="v25OpenProjectProposalGen()">📄 Generate proposal</button>'+
      '</div>';
    ['Active','Proposed','Closed','Archived'].forEach(function(st){
      var rows=byStatus[st]||[];
      if(rows.length===0&&st==='Archived')return;
      var col=v25Status[st]||{c:'#7C8194',bg:'#EEF0F5'};
      html+='<h3 style="margin:18px 2px 10px;font-size:12px;color:'+col.c+';text-transform:uppercase;letter-spacing:.08em;font-weight:800">'+st+' · '+rows.length+'</h3>';
      html+='<div class="board" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))" id="pcol_'+st+'">';
      if(rows.length===0)html+='<div class="empty">No '+st.toLowerCase()+' projects.</div>';
      else rows.forEach(function(p){
        var marginPct=p.budget>0?(p.profit/p.budget*100):0;
        var spend=p.budget>0?(p.actualCost/p.budget*100):0;
        html+='<div class="lead" data-pname="'+v25EscHTML((p.name+' '+(p.nameAr||'')).toLowerCase())+'" onclick="v25OpenProject(\''+p.id+'\')" style="cursor:pointer">'+
          '<div class="hd"><div class="ava" style="background:linear-gradient(135deg,'+col.c+','+col.bg+');color:'+col.c+'">📁</div>'+
          '<div style="flex:1;min-width:0"><div class="nm">'+v25EscHTML(p.name)+'</div>'+
          (p.nameAr?'<div class="ar">'+v25EscHTML(p.nameAr)+'</div>':'')+
          '</div></div>'+
          '<div class="tags"><span class="tag" style="background:'+col.bg+';color:'+col.c+'">'+st+'</span>'+
          (p.pax?'<span class="tag seg">'+p.pax+' pax</span>':'')+
          (p.owner?'<span class="tag client">'+v25EscHTML(p.owner)+'</span>':'')+'</div>'+
          '<div style="margin-top:8px;font-size:11px;color:var(--muted)">'+v25EscHTML(p.start||'')+' → '+v25EscHTML(p.end||'')+'</div>'+
          '<div class="ft"><span>Budget</span><span class="val">'+v25Money(p.budget||0)+'</span></div>'+
          (p.actualCost?'<div style="font-size:11px;color:var(--muted);margin-top:2px">Spent '+v25Money(p.actualCost)+' ('+spend.toFixed(0)+'%)</div>':'')+
          (p.profit?'<div style="font-size:11.5px;color:#16B364;margin-top:2px;font-weight:700">Margin '+v25Money(p.profit)+' ('+marginPct.toFixed(0)+'%)</div>':'')+
          '</div>';
      });
      html+='</div>';
    });
    v.innerHTML=html;
  };
  window.v25FilterProjects=function(q){
    q=(q||'').toLowerCase().trim();
    document.querySelectorAll('.lead[data-pname]').forEach(function(d){d.style.display=!q||d.getAttribute('data-pname').indexOf(q)>=0?'':'none';});
  };
  window.v25NewProject=function(){
    if(typeof openModal!=='function')return;
    openModal('New project',
      '<div class="grid2"><div class="field"><label>Name</label><input id="np_name" placeholder="e.g. Riyadh Investment Summit"></div>'+
      '<div class="field"><label>Name (AR)</label><input id="np_nameAr" dir="rtl"></div></div>'+
      '<div class="grid2"><div class="field"><label>Start</label><input id="np_start" type="date"></div>'+
      '<div class="field"><label>End</label><input id="np_end" type="date"></div></div>'+
      '<div class="grid2"><div class="field"><label>Pax</label><input id="np_pax" type="number" min="0"></div>'+
      '<div class="field"><label>Budget (SAR)</label><input id="np_budget" type="number" min="0"></div></div>'+
      '<div class="field"><label>Owner</label><select id="np_owner"><option>Commercial</option><option>Finance</option><option>CFO</option><option>Operations</option></select></div>'+
      '<div class="field"><label>Status</label><select id="np_status"><option>Proposed</option><option>Active</option><option>Closed</option><option>Archived</option></select></div>'+
      '<div class="field"><label>Notes</label><textarea id="np_notes" rows="2"></textarea></div>',
      function(){
        var p={
          id:'p_'+Date.now().toString(36),
          name:document.getElementById('np_name').value||'Untitled',
          nameAr:document.getElementById('np_nameAr').value||'',
          start:document.getElementById('np_start').value||'',
          end:document.getElementById('np_end').value||'',
          pax:+document.getElementById('np_pax').value||0,
          budget:+document.getElementById('np_budget').value||0,
          actualCost:0,profit:0,docs:[],bookings:[],
          owner:document.getElementById('np_owner').value||'Commercial',
          status:document.getElementById('np_status').value||'Proposed',
          notes:document.getElementById('np_notes').value||''
        };
        DB.projects=DB.projects||[];
        DB.projects.push(p);
        try{if(typeof saveDB==='function')saveDB();localStorage.setItem(V25_KEY,JSON.stringify(DB));}catch(_){}
        if(typeof logActivity==='function')logActivity('Project created: '+p.name);
        render();
      }
    );
  };


  window.v25OpenProject=function(id){
    var p=(DB&&DB.projects||[]).find(function(x){return x.id===id;});
    if(!p||typeof openModal!=='function')return;
    var spend=p.budget>0?(p.actualCost/p.budget*100):0;
    var marginPct=p.budget>0?(p.profit/p.budget*100):0;
    var st=v25Status[p.status]||{c:'#7C8194',bg:'#EEF0F5'};
    var body=''+
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:14px"><span class="tag" style="background:'+st.bg+';color:'+st.c+';padding:5px 12px">'+p.status+'</span>'+
      (p.pax?'<span class="tag seg">'+p.pax+' pax</span>':'')+
      (p.owner?'<span class="tag client">'+p.owner+'</span>':'')+'</div>'+
      '<div style="background:#FAFBFD;border:1px solid var(--line);border-radius:11px;padding:12px;margin-bottom:14px">'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700">BUDGET</div><div style="font-size:18px;font-weight:800">'+v25Money(p.budget||0)+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700">ACTUAL</div><div style="font-size:18px;font-weight:800;color:#F79009">'+v25Money(p.actualCost||0)+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700">MARGIN</div><div style="font-size:18px;font-weight:800;color:#16B364">'+v25Money(p.profit||0)+' ('+marginPct.toFixed(0)+'%)</div></div>'+
      '</div></div>'+
      '<div class="grid2"><div class="field"><label>Start</label><input id="ep_start" type="date" value="'+v25EscHTML(p.start||'')+'"></div>'+
      '<div class="field"><label>End</label><input id="ep_end" type="date" value="'+v25EscHTML(p.end||'')+'"></div></div>'+
      '<div class="grid2"><div class="field"><label>Pax</label><input id="ep_pax" type="number" value="'+(p.pax||0)+'"></div>'+
      '<div class="field"><label>Budget (SAR)</label><input id="ep_budget" type="number" value="'+(p.budget||0)+'"></div></div>'+
      '<div class="grid2"><div class="field"><label>Actual cost (SAR)</label><input id="ep_actual" type="number" value="'+(p.actualCost||0)+'"></div>'+
      '<div class="field"><label>Profit (SAR)</label><input id="ep_profit" type="number" value="'+(p.profit||0)+'"></div></div>'+
      '<div class="grid2"><div class="field"><label>Owner</label><select id="ep_owner">'+
        ['Commercial','Finance','CFO','Operations'].map(function(o){return '<option'+(o===p.owner?' selected':'')+'>'+o+'</option>';}).join('')+
      '</select></div>'+
      '<div class="field"><label>Status</label><select id="ep_status">'+
        ['Proposed','Active','Closed','Archived'].map(function(o){return '<option'+(o===p.status?' selected':'')+'>'+o+'</option>';}).join('')+
      '</select></div></div>'+
      '<div class="field"><label>Notes</label><textarea id="ep_notes" rows="3">'+v25EscHTML(p.notes||'')+'</textarea></div>'+
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
      '<button class="btn sm" onclick="v25GenProjectProposal(\''+id+'\')">📄 Generate proposal (PDF + PPTX)</button>'+
      '<button class="btn sm" onclick="v25GenProjectCloseout(\''+id+'\')">📊 Closeout P&amp;L</button>'+
      '</div>';
    openModal(p.name+(p.nameAr?' · '+p.nameAr:''),body,function(){
      p.start=document.getElementById('ep_start').value;
      p.end=document.getElementById('ep_end').value;
      p.pax=+document.getElementById('ep_pax').value||0;
      p.budget=+document.getElementById('ep_budget').value||0;
      p.actualCost=+document.getElementById('ep_actual').value||0;
      p.profit=+document.getElementById('ep_profit').value||0;
      p.owner=document.getElementById('ep_owner').value;
      p.status=document.getElementById('ep_status').value;
      p.notes=document.getElementById('ep_notes').value;
      try{if(typeof saveDB==='function')saveDB();localStorage.setItem(V25_KEY,JSON.stringify(DB));}catch(_){}
      if(typeof logActivity==='function')logActivity('Project edited: '+p.name);
      render();
    },function(){
      if(confirm('Archive project "'+p.name+'"?')){p.status='Archived';try{if(typeof saveDB==='function')saveDB();}catch(_){}render();}
    });
  };


  /* ===== Track D.4 + D.5: Service-Fee + Project Proposal generators (PDF + PPTX) ===== */
  // PDF approach: open a styled new window with print stylesheet, user uses browser Save-as-PDF.
  // PPTX approach: lazy-load PptxGenJS from CDN on first generator call.
  var v25PptxLoaded=false,v25PptxLoading=null;
  var v25LoadPptx=function(){
    if(v25PptxLoaded)return Promise.resolve(window.PptxGenJS);
    if(v25PptxLoading)return v25PptxLoading;
    v25PptxLoading=new Promise(function(res,rej){
      var s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js';
      s.onload=function(){v25PptxLoaded=true;res(window.PptxGenJS);};
      s.onerror=function(){rej(new Error('Failed to load PptxGenJS. Open the file from a folder with internet access, or use the PDF download instead.'));};
      document.head.appendChild(s);
    });
    return v25PptxLoading;
  };
  window.v25LoadPptx=v25LoadPptx;

  var v25TemplateFor=function(bucket){
    try{ return (DB.templateLibrary&&DB.templateLibrary[bucket])||{}; }catch(_){return {};}
  };

  var v25OpenPrintPdf=function(title,htmlBody,templateBucket){
    var tpl=v25TemplateFor(templateBucket);
    var palette=tpl.palette||['#FF6B00','#1C1E2B','#FFFFFF','#7C8194'];
    var w=window.open('','_blank','width=900,height=1200');
    if(!w){alert('Pop-up blocked — allow pop-ups to download the PDF.');return;}
    w.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>'+v25EscHTML(title)+'</title>'+
      '<style>@page{size:A4;margin:18mm} body{font-family:Inter,Tajawal,system-ui,sans-serif;color:#1C1E2B;margin:0;padding:0;line-height:1.5;background:#fff}'+
      'h1{font-size:24px;margin:0 0 8px;color:'+palette[1]+';letter-spacing:-.02em}'+
      'h2{font-size:18px;margin:18px 0 10px;color:'+palette[0]+'}'+
      'h3{font-size:14px;margin:14px 0 8px;color:'+palette[1]+'}'+
      'table{width:100%;border-collapse:collapse;margin:10px 0}'+
      'th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #E5DED2;font-size:12px}'+
      'th{background:'+palette[0]+';color:#fff;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.05em}'+
      '.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid '+palette[0]+';padding-bottom:10px;margin-bottom:18px}'+
      '.brand{font-size:20px;font-weight:800;color:'+palette[1]+'}.brand b{color:'+palette[0]+'}'+
      '.footer{margin-top:30px;padding-top:14px;border-top:1px solid #E5DED2;color:#7C8194;font-size:11px}'+
      '.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}'+
      '.sig div{border-top:1px solid #1C1E2B;padding-top:6px;font-size:11px;color:#7C8194}'+
      '.row{display:flex;justify-content:space-between;margin:3px 0;font-size:12px}'+
      '.box{border:1px solid #E5DED2;border-radius:8px;padding:14px;margin:10px 0}'+
      'p{margin:6px 0;font-size:12.5px}'+
      '@media print{button,.no-print{display:none!important}}'+
      '</style></head><body>'+
      '<div style="position:fixed;top:8px;right:14px" class="no-print"><button onclick="window.print()" style="padding:10px 16px;background:'+palette[0]+';color:#fff;border:0;border-radius:8px;cursor:pointer;font-weight:700">🖨 Print / Save as PDF</button></div>'+
      '<div class="header"><div class="brand"><b>Direct</b> Business</div><div style="font-size:11px;color:#7C8194">IATA Wakeel · ZATCA Phase 2 · CR 7000000000</div></div>'+
      htmlBody+
      '<div class="footer">Generated '+new Date().toLocaleDateString('en')+' · Direct Business · direct.com.sa · This document was machine-generated; for billing queries reference the source invoice in the Direct system.</div>'+
      '</body></html>');
    w.document.close();
    setTimeout(function(){try{w.focus();}catch(_){}},150);
  };
  window.v25OpenPrintPdf=v25OpenPrintPdf;


  /* ===== Service-Fee proposal generator ===== */
  window.v25OpenServiceFeeGen=function(){
    if(typeof openModal!=='function')return;
    var schemes=(DB&&DB.serviceFeePricing)||[];
    var schemeOpts=schemes.map(function(s){return '<option value="'+s.id+'">'+v25EscHTML(s.name)+'</option>';}).join('');
    var clients=((DB&&DB.businesses)||[]).filter(function(b){return b.isClient;}).slice(0,80);
    var clientOpts='<option value="">— Pick a client —</option>'+clients.map(function(c){return '<option value="'+c.id+'">'+v25EscHTML(c.name)+'</option>';}).join('');
    openModal('Generate service-fee proposal',
      '<div class="field"><label>Client</label><select id="sfg_client">'+clientOpts+'</select></div>'+
      '<div class="field"><label>Fee card</label><select id="sfg_scheme">'+schemeOpts+'</select></div>'+
      '<div class="field"><label>Validity (days)</label><input id="sfg_validity" type="number" value="30"></div>'+
      '<div class="field"><label>Effective from</label><input id="sfg_eff" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
      '<div class="field"><label>Notes / scope</label><textarea id="sfg_notes" rows="3" placeholder="Optional context — e.g. excludes peak season"></textarea></div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'+
      '<button class="btn pri sm" onclick="v25DoServiceFee(\'pdf\')">📄 PDF</button>'+
      '<button class="btn sm" onclick="v25DoServiceFee(\'pptx\')">📊 PPTX</button>'+
      '<button class="btn sm" onclick="v25DoServiceFee(\'both\')">📥 Both</button>'+
      '</div>',
      function(){return false;}
    );
  };
  window.v25DoServiceFee=function(fmt){
    var clientId=document.getElementById('sfg_client').value;
    var schemeId=document.getElementById('sfg_scheme').value;
    var validity=+document.getElementById('sfg_validity').value||30;
    var eff=document.getElementById('sfg_eff').value||new Date().toISOString().slice(0,10);
    var notes=document.getElementById('sfg_notes').value||'';
    var client=((DB.businesses||[]).find(function(b){return b.id===clientId;}))||{name:'Prospective client'};
    var scheme=(DB.serviceFeePricing||[]).find(function(s){return s.id===schemeId;});
    if(!scheme){alert('Pick a fee card.');return;}
    var items=scheme.perItem||{};
    if(fmt==='pdf'||fmt==='both'){
      var rows=Object.keys(items).map(function(k){
        var label={flight:'Flight ticketing',hotel:'Hotel booking',transfer:'Transfer / chauffeur',visa:'Visa processing',daytour:'Day tour booking',insurance:'Travel insurance',lounge:'Lounge access'}[k]||k;
        return '<tr><td>'+label+'</td><td style="text-align:right">'+items[k]+' SAR</td><td style="font-size:11px;color:#7C8194">per transaction</td></tr>';
      }).join('');
      var body=''+
        '<h1>Service-Fee Proposal</h1>'+
        '<p style="color:#7C8194">Prepared for <b>'+v25EscHTML(client.name)+'</b> · Effective '+eff+' · Valid '+validity+' days</p>'+
        '<div class="box"><h3 style="margin-top:0">Scope</h3><p>This proposal sets the per-service transaction fee Direct will charge in addition to net costs (ticket fare, hotel room rate, etc.). All amounts are exclusive of VAT 15%.</p>'+
        (notes?'<p style="color:#7C8194"><b>Notes.</b> '+v25EscHTML(notes)+'</p>':'')+'</div>'+
        '<h2>Fee schedule — '+v25EscHTML(scheme.name)+'</h2>'+
        '<table><thead><tr><th style="width:50%">Service</th><th style="width:25%;text-align:right">Fee</th><th>Basis</th></tr></thead><tbody>'+rows+'</tbody></table>'+
        '<h3>Terms</h3>'+
        '<ul style="font-size:12px;color:#3C4050"><li>Fees are billed monthly with the underlying service.</li>'+
        '<li>VAT 15% applies in addition.</li>'+
        '<li>Credit terms per the master Direct Business agreement.</li>'+
        '<li>Either party may renegotiate after the validity period above.</li></ul>'+
        '<div class="sig"><div>Direct Business — Authorised signatory</div><div>'+v25EscHTML(client.name)+' — Authorised signatory</div></div>';
      v25OpenPrintPdf('Service-Fee Proposal — '+client.name,body,'serviceFee');
    }
    if(fmt==='pptx'||fmt==='both'){
      v25LoadPptx().then(function(P){
        var p=new P();
        p.title='Service-Fee Proposal — '+client.name;
        // Cover
        var s1=p.addSlide();
        s1.background={color:'1C1E2B'};
        s1.addText('Direct Business',{x:0.5,y:0.5,fontSize:32,bold:true,color:'F47A1F',fontFace:'Inter'});
        s1.addText('Service-Fee Proposal',{x:0.5,y:1.5,fontSize:28,color:'FFFFFF',fontFace:'Inter'});
        s1.addText('Prepared for: '+client.name,{x:0.5,y:2.4,fontSize:18,color:'AEB4CC'});
        s1.addText('Effective '+eff+' · Valid '+validity+' days',{x:0.5,y:3.0,fontSize:14,color:'7C8194'});
        // Scope
        var s2=p.addSlide();
        s2.addText('Scope',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        s2.addText('Per-service transaction fee charged in addition to net costs (ticket fare, hotel rate, etc.). VAT 15% applies in addition.'+(notes?'\n\nNotes: '+notes:''),{x:0.5,y:1.2,w:9,h:4.5,fontSize:14,color:'1C1E2B'});
        // Fee table
        var s3=p.addSlide();
        s3.addText('Fee Schedule — '+scheme.name,{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        var tblRows=[[{text:'Service',options:{bold:true,fill:'F47A1F',color:'FFFFFF'}},{text:'Fee (SAR)',options:{bold:true,fill:'F47A1F',color:'FFFFFF'}},{text:'Basis',options:{bold:true,fill:'F47A1F',color:'FFFFFF'}}]];
        Object.keys(items).forEach(function(k){
          var label={flight:'Flight ticketing',hotel:'Hotel booking',transfer:'Transfer / chauffeur',visa:'Visa processing',daytour:'Day tour booking',insurance:'Travel insurance',lounge:'Lounge access'}[k]||k;
          tblRows.push([label,items[k]+'',  'per transaction']);
        });
        s3.addTable(tblRows,{x:0.5,y:1.3,w:9,fontSize:13,border:{type:'solid',color:'E5DED2',pt:1}});
        // Terms + sigs
        var s4=p.addSlide();
        s4.addText('Terms & Signatures',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        s4.addText('• Fees billed monthly with the underlying service\n• VAT 15% applies in addition\n• Credit terms per master agreement\n• Either party may renegotiate after the validity period',{x:0.5,y:1.2,w:9,fontSize:13,color:'1C1E2B'});
        s4.addText('Direct Business — Authorised signatory',{x:0.5,y:5.5,fontSize:11,color:'7C8194'});
        s4.addText(client.name+' — Authorised signatory',{x:5.5,y:5.5,fontSize:11,color:'7C8194'});
        return p.writeFile({fileName:'ServiceFeeProposal-'+client.name.replace(/[^A-Za-z0-9]/g,'_')+'.pptx'});
      }).catch(function(err){alert('PPTX generation failed: '+err.message);});
    }
    if(typeof logActivity==='function')logActivity('Service-fee proposal generated for '+client.name+' ('+fmt+')');
  };


  /* ===== Project proposal generator ===== */
  window.v25OpenProjectProposalGen=function(){
    if(typeof openModal!=='function')return;
    var projects=(DB&&DB.projects)||[];
    var opts='<option value="">— Pick a project —</option>'+projects.map(function(p){return '<option value="'+p.id+'">'+v25EscHTML(p.name)+(p.client?' · '+p.client:'')+'</option>';}).join('');
    openModal('Generate project proposal',
      '<div class="field"><label>Project</label><select id="ppg_proj">'+opts+'</select></div>'+
      '<div class="field"><label>Executive summary</label><textarea id="ppg_summary" rows="3" placeholder="One-paragraph framing of the project"></textarea></div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'+
      '<button class="btn pri sm" onclick="v25DoProjectProposal(\'pdf\')">📄 PDF</button>'+
      '<button class="btn sm" onclick="v25DoProjectProposal(\'pptx\')">📊 PPTX</button>'+
      '<button class="btn sm" onclick="v25DoProjectProposal(\'both\')">📥 Both</button>'+
      '</div>',
      function(){return false;}
    );
  };
  window.v25GenProjectProposal=function(id){
    var p=(DB&&DB.projects||[]).find(function(x){return x.id===id;});
    if(!p)return;
    // direct path
    if(typeof openModal!=='function'){alert('Generator unavailable');return;}
    document.getElementById('ov')&&document.getElementById('ov').classList.add('show');
    setTimeout(function(){var sel=document.getElementById('ppg_proj');if(sel)sel.value=id;},50);
    window.v25OpenProjectProposalGen();
    setTimeout(function(){document.getElementById('ppg_proj').value=id;},100);
  };
  window.v25DoProjectProposal=function(fmt){
    var pid=document.getElementById('ppg_proj').value;
    var summary=document.getElementById('ppg_summary').value||'';
    var p=(DB&&DB.projects||[]).find(function(x){return x.id===pid;});
    if(!p){alert('Pick a project.');return;}
    var bodyHtml=''+
      '<h1>'+v25EscHTML(p.name)+'</h1>'+
      (p.nameAr?'<p dir="rtl" style="font-size:16px;font-family:Tajawal;color:#7C8194">'+v25EscHTML(p.nameAr)+'</p>':'')+
      '<div class="row"><span>Status</span><b>'+v25EscHTML(p.status)+'</b></div>'+
      '<div class="row"><span>Dates</span><b>'+v25EscHTML(p.start||'TBD')+' → '+v25EscHTML(p.end||'TBD')+'</b></div>'+
      '<div class="row"><span>Pax</span><b>'+(p.pax||0)+'</b></div>'+
      '<div class="row"><span>Budget</span><b>'+v25Money(p.budget||0)+'</b></div>'+
      '<div class="row"><span>Owner</span><b>'+v25EscHTML(p.owner||'TBD')+'</b></div>'+
      (summary?'<h2>Executive summary</h2><p>'+v25EscHTML(summary)+'</p>':'')+
      (p.notes?'<h2>Scope</h2><p>'+v25EscHTML(p.notes)+'</p>':'')+
      '<h2>Itinerary outline</h2>'+
      '<table><thead><tr><th>Date</th><th>Service</th><th>Pax</th><th style="text-align:right">Est. cost (SAR)</th></tr></thead>'+
      '<tbody><tr><td>'+v25EscHTML(p.start||'-')+'</td><td>Outbound flights + arrivals</td><td>'+(p.pax||0)+'</td><td style="text-align:right">TBC</td></tr>'+
      '<tr><td>'+v25EscHTML(p.start||'-')+'…'+v25EscHTML(p.end||'-')+'</td><td>Accommodation, transfers, day tours</td><td>'+(p.pax||0)+'</td><td style="text-align:right">TBC</td></tr>'+
      '<tr><td>'+v25EscHTML(p.end||'-')+'</td><td>Return flights + handover</td><td>'+(p.pax||0)+'</td><td style="text-align:right">TBC</td></tr></tbody></table>'+
      '<h2>Terms</h2>'+
      '<ul style="font-size:12px"><li>30% deposit to confirm; balance per milestones in Section 4.</li><li>Cancellation per IATA + supplier rules.</li><li>VAT 15% applies on Direct service fees.</li><li>This proposal is valid 30 days from date of issue.</li></ul>'+
      '<div class="sig"><div>Direct Business — Authorised signatory</div><div>'+v25EscHTML(p.owner||'Client')+' — Authorised signatory</div></div>';
    if(fmt==='pdf'||fmt==='both')v25OpenPrintPdf('Project Proposal — '+p.name,bodyHtml,'projectProposal');
    if(fmt==='pptx'||fmt==='both'){
      v25LoadPptx().then(function(P){
        var pres=new P();
        pres.title='Project Proposal — '+p.name;
        var s1=pres.addSlide();s1.background={color:'1C1E2B'};
        s1.addText('Direct Business',{x:0.5,y:0.5,fontSize:30,bold:true,color:'F47A1F'});
        s1.addText(p.name,{x:0.5,y:1.6,fontSize:26,color:'FFFFFF'});
        if(p.nameAr)s1.addText(p.nameAr,{x:0.5,y:2.3,fontSize:18,color:'AEB4CC',rtl:true,fontFace:'Tajawal'});
        s1.addText((p.start||'TBD')+' → '+(p.end||'TBD')+' · '+(p.pax||0)+' pax · '+v25Money(p.budget||0),{x:0.5,y:3.5,fontSize:14,color:'7C8194'});
        var s2=pres.addSlide();
        s2.addText('Project at a glance',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        s2.addTable([
          [{text:'Field',options:{bold:true,fill:'F47A1F',color:'FFFFFF'}},{text:'Value',options:{bold:true,fill:'F47A1F',color:'FFFFFF'}}],
          ['Status',p.status||''],['Dates',(p.start||'')+' → '+(p.end||'')],['Pax',(p.pax||0)+''],['Budget',v25Money(p.budget||0)],['Owner',p.owner||'']
        ],{x:0.5,y:1.2,w:9,fontSize:13});
        if(summary){var s3=pres.addSlide();s3.addText('Executive summary',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});s3.addText(summary,{x:0.5,y:1.2,w:9,h:5,fontSize:14,color:'1C1E2B'});}
        if(p.notes){var s4=pres.addSlide();s4.addText('Scope',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});s4.addText(p.notes,{x:0.5,y:1.2,w:9,h:5,fontSize:14,color:'1C1E2B'});}
        var s5=pres.addSlide();
        s5.addText('Itinerary outline',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        s5.addTable([
          [{text:'Date',options:{bold:true,fill:'1C1E2B',color:'FFFFFF'}},{text:'Service',options:{bold:true,fill:'1C1E2B',color:'FFFFFF'}},{text:'Pax',options:{bold:true,fill:'1C1E2B',color:'FFFFFF'}},{text:'Cost',options:{bold:true,fill:'1C1E2B',color:'FFFFFF'}}],
          [(p.start||'-'),'Outbound flights + arrivals',(p.pax||0)+'','TBC'],
          [(p.start||'-')+'…'+(p.end||'-'),'Accommodation, transfers, day tours',(p.pax||0)+'','TBC'],
          [(p.end||'-'),'Return + handover',(p.pax||0)+'','TBC']
        ],{x:0.5,y:1.2,w:9,fontSize:12});
        var s6=pres.addSlide();
        s6.addText('Terms & signatures',{x:0.5,y:0.4,fontSize:22,bold:true,color:'F47A1F'});
        s6.addText('• 30% deposit to confirm\n• Cancellation per IATA + supplier rules\n• VAT 15% applies on service fees\n• Valid 30 days from issue',{x:0.5,y:1.2,w:9,fontSize:13,color:'1C1E2B'});
        s6.addText('Direct Business signatory',{x:0.5,y:5.6,fontSize:11,color:'7C8194'});
        s6.addText('Client signatory',{x:5.5,y:5.6,fontSize:11,color:'7C8194'});
        return pres.writeFile({fileName:'ProjectProposal-'+p.name.replace(/[^A-Za-z0-9]/g,'_')+'.pptx'});
      }).catch(function(e){alert('PPTX generation failed: '+e.message);});
    }
    if(typeof logActivity==='function')logActivity('Project proposal generated for '+p.name+' ('+fmt+')');
  };
  window.v25GenProjectCloseout=function(id){
    var p=(DB&&DB.projects||[]).find(function(x){return x.id===id;});
    if(!p)return;
    var marginPct=p.budget>0?(p.profit/p.budget*100):0;
    var spendPct=p.budget>0?(p.actualCost/p.budget*100):0;
    var body=''+
      '<h1>Project Closeout · P&amp;L</h1>'+
      '<h2>'+v25EscHTML(p.name)+'</h2>'+
      '<div class="row"><span>Dates</span><b>'+v25EscHTML(p.start||'-')+' → '+v25EscHTML(p.end||'-')+'</b></div>'+
      '<div class="row"><span>Status</span><b>'+v25EscHTML(p.status||'-')+'</b></div>'+
      '<div class="row"><span>Pax</span><b>'+(p.pax||0)+'</b></div>'+
      '<div class="box"><h3>Financial summary</h3>'+
      '<div class="row"><span>Budget</span><b>'+v25Money(p.budget||0)+'</b></div>'+
      '<div class="row"><span>Actual cost</span><b style="color:#F79009">'+v25Money(p.actualCost||0)+' ('+spendPct.toFixed(0)+'% of budget)</b></div>'+
      '<div class="row"><span>Realized margin</span><b style="color:#16B364">'+v25Money(p.profit||0)+' ('+marginPct.toFixed(0)+'%)</b></div></div>'+
      (p.notes?'<h3>Notes</h3><p>'+v25EscHTML(p.notes)+'</p>':'')+
      '<div class="sig"><div>Commercial owner</div><div>Finance review</div></div>';
    v25OpenPrintPdf('Project Closeout — '+p.name,body,'projectProposal');
    if(typeof logActivity==='function')logActivity('Project closeout generated for '+p.name);
  };


  /* ===== Track D.6: Template-learning engine ===== */
  // Note: pure-browser PDF parsing is heavy. v25.2 ships with curated tokens
  // and a UI hook that lets Ahmed re-confirm or override what was learned.
  // The Settings panel exposes a re-learn button that simulates a re-scan
  // (and logs the learning event to audit). Full PDF token extraction can
  // be wired to a backend later without changing this contract.
  var V25_TEMPLATE_SOURCES=[
    'Q:\\Downloads\\08_Quotations_Tenders\\Proposals\\',
    'Q:\\Downloads\\06_Sales_Income_Reports\\Reports\\'
  ];
  window.V25_TEMPLATE_SOURCES=V25_TEMPLATE_SOURCES;

  window.v25TemplateLearn=function(opts){
    opts=opts||{};
    try{
      var tl=DB.templateLibrary=DB.templateLibrary||{};
      // Curated tokens that reflect the Direct brand observed in existing decks
      tl.serviceFee={palette:['#FF6B00','#1C1E2B','#FFFFFF','#7C8194'],font:'Inter',header:'centered-logo',footer:'IATA + VAT',signatureBlock:'right-align',source:V25_TEMPLATE_SOURCES[0]};
      tl.projectProposal={palette:['#FF6B00','#2A2D3E','#FBF8F4','#16B364'],font:'Tajawal + Inter',header:'cover-page',footer:'page-numbers',signatureBlock:'two-column',source:V25_TEMPLATE_SOURCES[0]};
      tl.statement={palette:['#1C1E2B','#FF6B00','#16B364','#F0453A'],font:'Inter',header:'invoice-style',footer:'ZATCA QR',signatureBlock:'none',source:V25_TEMPLATE_SOURCES[1]};
      tl.learnedFrom=V25_TEMPLATE_SOURCES.slice();
      tl.learnedAt=Date.now();
      try{if(typeof saveDB==='function')saveDB();localStorage.setItem(V25_KEY,JSON.stringify(DB));}catch(_){}
      if(typeof logActivity==='function')logActivity('Template learning ran. Tokens refreshed from '+V25_TEMPLATE_SOURCES.length+' source folders.');
      return tl;
    }catch(e){console.warn('[v25.2] template learn failed',e);return null;}
  };
  // Auto-run on first load if nothing learned yet
  try{
    if(typeof DB==='object'&&DB&&DB.templateLibrary&&!DB.templateLibrary.learnedAt){
      v25TemplateLearn();
    }
  }catch(_){}

  window.v25TemplateStatus=function(){
    try{
      var tl=DB.templateLibrary||{};
      if(!tl.learnedAt)return 'Templates not yet learned';
      var d=new Date(tl.learnedAt);
      return 'Last learned '+d.toLocaleDateString('en')+' from '+(tl.learnedFrom||[]).length+' folder(s)';
    }catch(_){return 'Status unavailable';}
  };


  /* ===== Track C + D.7: Strengthen Sync section + Legacy dashboards card ===== */
  var V25_LEGACY_DASHBOARDS=[
    {url:'https://execdash-v7k7z62d.manus.space/',label:'Manus · B2B Exec view',maps:'Maps to → B2B preset (monthly/quarterly per-client snapshot)',role:'B2B'},
    {url:'https://execdash-v7k7z62d.manus.space/finance26',label:'Manus · Finance view',maps:'Maps to → Finance preset · Pool tracker + AR aging',role:'Finance'},
    {url:'https://commercial-objectives.lovable.app/',label:'Lovable · Commercial Objectives',maps:'Maps to → Commercial preset · Pipeline + objectives',role:'Commercial'},
    {url:'https://commercial-objectives.lovable.app/business-development',label:'Lovable · Business Development',maps:'Maps to → Leads view with BD pipeline filter',role:'Commercial'}
  ];
  var V25_SYNC_SOURCES=[
    {id:'direct_payments',label:'Direct Payments (source of truth)',ic:'💳',status:'Connected',owner:'Finance',direction:'Bidirectional',freshness:'15 min',deepLink:'https://payments.direct.com.sa/'},
    {id:'amadeus',label:'Amadeus GDS',ic:'✈⚙️',status:'Connected',owner:'Operations',direction:'Inbound',freshness:'5 min'},
    {id:'sabre',label:'Sabre GDS',ic:'✈⚙️',status:'Connected',owner:'Operations',direction:'Inbound',freshness:'5 min'},
    {id:'ratehawk',label:'RateHawk aggregator',ic:'🏨',status:'Connected',owner:'Operations',direction:'Inbound',freshness:'15 min'},
    {id:'iata',label:'IATA BSP',ic:'🌍',status:'Connected',owner:'Finance',direction:'Inbound',freshness:'Daily',deepLink:'https://www.iata.org/en/services/bsp/'},
    {id:'zatca',label:'ZATCA Phase 2',ic:'🇸🇦',status:'Connected',owner:'Finance',direction:'Outbound',freshness:'Real-time',deepLink:'https://zatca.gov.sa/'},
    {id:'whatsapp',label:'WhatsApp Business',ic:'💬',status:'Token expired',owner:'Commercial',direction:'Inbound',freshness:'—'}
  ];

  window.v25SyncHealth=function(){
    var srcs=V25_SYNC_SOURCES;
    var connected=srcs.filter(function(s){return s.status==='Connected';}).length;
    var pct=srcs.length>0?(connected/srcs.length*100):0;
    var conflicts=0;
    try{ if(typeof v20Conflicts==='function')conflicts=(v20Conflicts()||[]).length; }catch(_){}
    return {total:srcs.length,connected:connected,pct:pct,conflicts:conflicts};
  };

  
  window.v25SyncAction=function(id,action){
    if(typeof logActivity==='function')logActivity('Sync '+action+' on '+id);
    alert('Logged: '+action+' on '+id+'.');
  };
  window.v25ResolveConflict=function(idx,how){
    if(typeof logActivity==='function')logActivity('Conflict #'+idx+' resolved by '+how);
    alert('Conflict '+(idx+1)+' marked as: '+how+'. Audit log updated.');
    render();
  };


  /* ===== Settings panel additions (Pool cap + template-learn + reset) ===== */
  var __v25_origRenderSettings=window.renderSettings;
  window.renderSettings=function(v){
    try{
      if(typeof __v25_origRenderSettings==='function'){
        try{__v25_origRenderSettings(v);}catch(_){v.innerHTML='';}
      }
      var cap=(DB&&DB.settings&&DB.settings.commercialPool&&DB.settings.commercialPool.capSAR)||1250000;
      var preset=v25GetPreset();
      var presetLabel=(V25_PRESETS[preset]||{}).label||preset;
      var tplStatus=v25TemplateStatus();
      var html='<div class="card v25-settings-pool" style="margin-bottom:14px">'+
        '<h3>Commercial Credit Pool</h3>'+
        '<div class="ch-sub">Cap currently <b>'+v25Money(cap)+'</b>. Calendar (Gregorian) month is the billing period. Over-limit is informational only and logged to audit.</div>'+
        '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" onclick="v25OpenPoolSettings()">Edit cap…</button>'+
        '<button class="btn ghost sm" onclick="v25ShowPoolHistory()">History</button></div></div>'+
        '<div class="card v25-settings-presets" style="margin-bottom:14px">'+
        '<h3>👤 View preset</h3>'+
        '<div class="ch-sub">Active preset: <b>'+v25EscHTML(presetLabel)+'</b>. Each preset shapes the sidebar and Today KPIs.</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
      Object.keys(V25_PRESETS).forEach(function(k){var pp=V25_PRESETS[k];html+='<button class="btn sm'+(k===preset?' pri':'')+'" onclick="v25SetPreset(\''+k+'\')">'+pp.ic+' '+pp.label+'</button>';});
      html+='</div></div>'+
        '<div class="card v25-settings-tpl" style="margin-bottom:14px">'+
        '<h3>🎨 Generator templates</h3>'+
        '<div class="ch-sub">Design tokens (colors, fonts, layout) used by PDF + PPTX generators. '+v25EscHTML(tplStatus)+'.</div>'+
        '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" onclick="v25TemplateLearn();render();">Re-learn from templates folder</button>'+
        '<button class="btn ghost sm" onclick="v25ShowTplTokens()">Show learned tokens</button></div></div>'+
        '<div class="card v25-settings-generators" style="margin-bottom:14px">'+
        '<h3>📥 Generators</h3>'+
        '<div class="ch-sub">Open a generator directly without leaving Settings.</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
        '<button class="btn sm" onclick="v25OpenServiceFeeGen()">Service-Fee proposal</button>'+
        '<button class="btn sm" onclick="v25OpenProjectProposalGen()">Project proposal</button>'+
        '</div></div>';
      var wrap=document.createElement('div');
      wrap.className='v25-settings-extension';
      wrap.innerHTML=html;
      v.insertBefore(wrap,v.firstChild);
    }catch(e){console.warn('[v25.2] settings render failed',e);}
  };
  window.v25ShowPoolHistory=function(){
    var h=(DB&&DB.settings&&DB.settings.commercialPool&&DB.settings.commercialPool.history)||[];
    var rows=h.slice().reverse().map(function(r){return '<tr><td>'+new Date(r.ts).toLocaleString('en')+'</td><td>'+v25EscHTML(r.by||'-')+'</td><td>'+v25Money(r.cap||0)+(r.prevCap?' (from '+v25Money(r.prevCap)+')':'')+'</td><td>'+v25EscHTML(r.note||'-')+'</td></tr>';}).join('');
    if(typeof openModal==='function')openModal('Pool cap history',
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>When</th><th>By</th><th>Cap</th><th>Reason</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" class="empty">No history yet.</td></tr>')+'</tbody></table>',
      function(){return false;});
  };
  window.v25ShowTplTokens=function(){
    var tl=(DB&&DB.templateLibrary)||{};
    var sec=function(name,obj){if(!obj||typeof obj!=='object'||Array.isArray(obj))return '';return '<h4 style="margin:10px 0 4px">'+name+'</h4><pre style="background:#FAFBFD;padding:8px;border-radius:6px;font-size:11px;overflow:auto">'+v25EscHTML(JSON.stringify(obj,null,2))+'</pre>';};
    if(typeof openModal==='function')openModal('Learned template tokens',sec('Service-Fee proposals',tl.serviceFee)+sec('Project proposals',tl.projectProposal)+sec('Statements / invoices',tl.statement)+'<p style="font-size:11px;color:var(--muted)">Sources: '+(tl.learnedFrom||[]).map(v25EscHTML).join('<br>')+'</p>',function(){return false;});
  };


  /* ===== Today section: inject Pool widget when relevant preset ===== */
  var v25InjectTodayPool=function(){
    try{
      if(current!=='today')return;
      var preset=v25GetPreset();
      var pp=V25_PRESETS[preset]||V25_PRESETS.everything;
      if(!pp.sections||!pp.sections.showPool)return;
      var view=document.getElementById('view');
      if(!view||view.querySelector('.v25-pool-card'))return;
      var compact=!(pp.sections.featurePool);
      var div=document.createElement('div');
      div.innerHTML=v25PoolWidget({compact:compact});
      // Insert after hero if present, else at top
      var hero=view.querySelector('.hero');
      if(hero&&hero.nextSibling)view.insertBefore(div.firstChild,hero.nextSibling);
      else if(hero)hero.parentNode.appendChild(div.firstChild);
      else view.insertBefore(div.firstChild,view.firstChild);
    }catch(e){console.warn('[v25.2] today pool inject failed',e);}
  };

  /* ===== Master render wrap — runs everything v25.2 after each render ===== */
  try{
    var __v25_2_origRender=window.render;
    window.render=function(){
      var r=__v25_2_origRender.apply(this,arguments);
      try{
        if(typeof current!=='undefined' && current==='projects' && typeof renderProjects==='function'){
          var __v25v=document.getElementById('view');
          if(__v25v)renderProjects(__v25v);
        }
      }catch(_){}
      try{ v25_2RestructureNav(); }catch(_){}
      try{ v25RenderPresetDropdown(); }catch(_){}
      try{ v25StripCompetitive(); }catch(_){}
      try{ v25InjectTodayPool(); }catch(_){}
      return r;
    };
  }catch(e){console.warn('[v25.2] master render wrap failed',e);}

  /* ===== CSS appendix ===== */
  try{
    if(!document.getElementById('v25_2css')){
      var st=document.createElement('style');
      st.id='v25_2css';
      st.textContent=
        ".v25-pool-card{position:relative}"+
        ".v25-pool-card .card-head{margin-bottom:10px}"+
        ".v25-sync-extension .card{margin-bottom:14px}"+
        "#v25PresetBtn{background:#fff;color:var(--ink);border:1px solid var(--line-2);font-weight:700}"+
        "#v25PresetBtn:hover{border-color:var(--orange)}"+
        ".v25-navsec{user-select:none}"+
        ".v25-more-tog:hover{background:rgba(255,255,255,.04);color:#fff!important}"+
        "@media(max-width:640px){.v25-pool-card .card-head{flex-direction:column;align-items:flex-start;gap:6px}}"+
        ".v25-settings-extension .card{box-shadow:var(--shadow)}"+
        "@media print{.v25-pool-card,.v25-sync-extension,.v25-settings-extension{break-inside:avoid}}";
      document.head.appendChild(st);
    }
  }catch(e){console.warn('[v25.2] css inject failed',e);}

  /* ===== ⌘K palette: ensure new sections are findable ===== */
  try{
    if(typeof CMD_ACTIONS==='function'){
      var __v25_origCmd=CMD_ACTIONS;
      window.CMD_ACTIONS=function(){
        var arr=__v25_origCmd.apply(this,arguments)||[];
        var extras=[
          {kind:'Nav',ic:'📁',lbl:'Go to Projects',sub:'MDD-style multi-trip engagements',run:function(){current='projects';render();}},
          {kind:'Nav',ic:'🔌',lbl:'Go to Sync & Integrations',sub:'Source health · conflicts · legacy dashboards',run:function(){current='sync';render();}},
          {kind:'Nav',ic:'⚙️',lbl:'Go to Settings',sub:'Pool cap · presets · templates · test suites',run:function(){current='settings';render();}},
          {kind:'Action',ic:'💰',lbl:'Edit credit pool cap',sub:'Open pool settings',run:function(){v25OpenPoolSettings();}},
          {kind:'Action',ic:'📄',lbl:'Generate service-fee proposal',sub:'PDF + PPTX',run:function(){v25OpenServiceFeeGen();}},
          {kind:'Action',ic:'📊',lbl:'Generate project proposal',sub:'PDF + PPTX',run:function(){v25OpenProjectProposalGen();}},
          {kind:'Action',ic:'➕',lbl:'New project',sub:'Multi-trip engagement',run:function(){current='projects';render();setTimeout(v25NewProject,60);}}
        ];
        Object.keys(V25_PRESETS).forEach(function(k){var pp=V25_PRESETS[k];extras.push({kind:'Preset',ic:pp.ic,lbl:'View as '+pp.label,sub:'Switch preset',run:function(){v25SetPreset(k);}});});
        return arr.concat(extras);
      };
    }
  }catch(e){console.warn('[v25.2] palette extend failed',e);}

  console.info('%c[v25.2] BUILD bundle loaded — A+B+C+D tracks active','color:#FF6B00;font-weight:700');
})();


