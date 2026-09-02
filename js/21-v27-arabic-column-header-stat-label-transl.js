/* v27 — Arabic column-header + stat-label translation.
   Safe by construction: runs ONLY in Arabic, matches WHOLE strings (no fragment
   corruption like the old verb relabeler), and only touches <th> headers, .kl stat
   labels, and .tag badges — never free-text table-body values (a company's actual
   name, notes, a real per-record next-action note someone typed). A .tag element in
   this app is always a DERIVED status/enum label the app itself generated (priority
   Hot/Warm/Cool/Cold, Unassigned, Import, Client), never raw business data — exact
   whole-string matching against a short, deliberately-curated word list keeps that
   distinction safe even though the scan itself is broad. Found live 2026-08-21 (owner's
   own pre-launch pass): Leads/Clients row badges for priority, owner and source sat in
   this exact shape and were never scanned at all, so they showed in English on an
   otherwise fully-Arabic table. Self-contained, try/catch, reversible. */
(function(){try{
  var V27_AR={
    // ---- table column headers ----
    'Account manager':'مدير الحساب','Airline':'شركة الطيران','Airlines':'شركات الطيران',
    'Area':'المنطقة','Authority':'صلاحية الإصدار','Availability source':'مصدر التوفر',
    'Booking':'الحجز','Business':'المنشأة','Channels':'القنوات','City':'المدينة',
    'Client':'العميل','Client since':'عميل منذ','Contacts':'جهات الاتصال','Coupons':'الكوبونات',
    'Health':'الصحة',
    'Date':'التاريخ','Date · Hijri':'التاريخ · هجري','Dates':'التواريخ','Dunning':'التحصيل',
    'Event':'الفعالية','Fare+tax':'الأجرة + الضريبة','Flags':'مؤشرات','Funnel':'المسار',
    'Inv':'فواتير','Invoice #':'رقم الفاتورة','KSA BSP':'BSP السعودية','Last activity':'آخر نشاط',
    'Margin':'الهامش','Next action':'الإجراء التالي','Next review':'المراجعة القادمة','Notes':'ملاحظات',
    'Open in Direct':'افتح في Direct','Opportunity':'الفرصة','Owner':'المسؤول',
    'PNR · e-ticket':'PNR · التذكرة','Pax':'المسافرون','Portal':'البوابة','Pri':'الأولوية','Priority':'الأولوية',
    'Profit':'الربح','Provider':'المورّد','Provider · Source':'المورّد · المصدر',
    'QC':'الجودة','Ref':'المرجع','Ref · PNR':'المرجع · PNR','Refund to':'الاسترداد إلى',
    'Revenue':'الإيرادات','Route · RBD':'المسار · RBD','Sale':'البيع','Stage':'المرحلة',
    'Status':'الحالة','Status · FOP':'الحالة · الدفع','Stock':'رمز التذاكر','Subject':'الموضوع',
    'Subtotal':'المجموع الفرعي','TTL':'مهلة','Tickets':'التذاكر','Tier':'الفئة','Total':'الإجمالي',
    'Type':'النوع','Valid':'صالح حتى','Venue':'المكان','Vertical':'القطاع',
    'Void':'الإبطال','Deal value (SAR)':'المكسوب (ريال)',
    // ---- .tag row badges (priority / tier — see .tag comment above; Import, Unassigned,
    // Standard, Key account, Client already exist above/below for other contexts and are
    // reused here on purpose, same word, same meaning) ----
    'Hot':'ساخن','Warm':'دافئ','Cool':'فاتر','Cold':'بارد','Key account':'حساب رئيسي',
    // ---- stat-tile labels (.kl) ----
    'Billed':'المفوتر','Paid':'مدفوع','Outstanding':'المستحق',
    'ZATCA cleared':'معتمد من هيئة الزكاة','Cost':'التكلفة','Received':'المُحصّل',
    'Wallet (excluded)':'المحفظة (مستثناة)','Invoices':'الفواتير',
    'Open':'مفتوحة','Used':'مستخدمة','Refunded':'مستردة','ADM-flagged':'مُعلَّمة ADM',
    // ---- KPI / stat tile labels ----
    'Tickets due soon':'تذاكر يقترب موعد إصدارها','Nothing urgent right now — all clear.':'لا شيء عاجل الآن — كل شيء على ما يرام.','Overdue invoices':'فواتير متأخرة','Being chased':'قيد التحصيل',
    'Low-profit offers':'عروض ربح منخفض','My queue':'قائمتي',
    'Total sale':'إجمالي المبيعات','QC complete':'اكتمال الفحص',
    'New':'جديد','Good':'جيد','Watch':'مراقبة','At risk':'معرّض للخطر',
    '0–30 days':'0–30 يومًا','31–60 days':'31–60 يومًا','61–90 days':'61–90 يومًا','90+ days':'90+ يومًا',
    'Total clients':'إجمالي العملاء','Key accounts':'حسابات رئيسية','Total won (SAR)':'إجمالي المكسوب (ريال)',
    'Clients in view':'العملاء المعروضون','Won leads not yet converted':'صفقات مكسوبة لم تُحوَّل بعد',
    'Reviews overdue':'مراجعات متأخرة','Open requests':'طلبات مفتوحة','SLA overdue':'تأخّر مستوى الخدمة',
    'Awaiting client':'بانتظار العميل','Pipeline value':'قيمة خط الأنابيب','Booked margin':'هامش المحجوز',
    'Delivered / closed':'مُسلّم / مغلق',
    // ---- filter + action buttons ----
    'Table':'جدول','Dashboard':'لوحة','By stage':'حسب المرحلة','By category':'حسب الفئة','By funnel':'حسب المسار',
    '↓ Export CSV':'↓ تصدير CSV','⚠ Needs attention':'⚠ بحاجة إلى انتباه','✓ Hide closed':'✓ إخفاء المغلقة',
    'Has app':'له تطبيق','Edit':'تعديل','Del':'حذف','‹ Prev':'‹ السابق','Next ›':'التالي ›',
    '← Leads pipeline':'← مسار العملاء المحتملين','All clients':'كل العملاء','Aggregators':'مجمّعات',
    'All tiers':'كل الفئات','All managers':'كل المدراء','Overdue':'متأخر','Unpaid':'غير مدفوع',
    '+ New business':'+ عمل جديد','+ New offer':'+ عرض جديد','+ New airline':'+ شركة طيران جديدة',
    '+ New provider':'+ مورّد جديد','+ New SOP':'+ إجراء جديد','+ New request':'+ طلب جديد',
    '+ Booking':'+ حجز','+ Invoice':'+ فاتورة','+ Add event':'+ إضافة فعالية',
    'Share view-only link':'مشاركة رابط للعرض فقط','Projects board':'لوحة المشاريع',
    'Backup now':'انسخ الآن','Backup now to destination':'انسخ الآن','＋ Log achievement':'＋ تسجيل إنجاز',
    // ---- top-bar controls ----
    'Access':'الصلاحيات','Team':'الفريق','Sign out':'تسجيل الخروج','Export':'تصدير','▾ Export':'▾ تصدير',
    'Export ▾':'تصدير ▾','Share (view-only)':'مشاركة (عرض فقط)',
    // ---- in-page page headings (the ? help button is preserved) ----
    'Leads':'العملاء المحتملون','Clients':'العملاء','Offers':'العروض','Bookings':'الحجوزات',
    'Invoices':'الفواتير','Tickets':'التذاكر','Settings':'الإعدادات','Providers GDS':'الموردون و GDS',
    'Provider verdicts':'تقييمات الموردين','Monthly revenue & profit':'الإيرادات والأرباح الشهرية',
    'Top clients by revenue':'أعلى العملاء إيراداً','★ Extended procedures':'★ إجراءات موسّعة',
    'SOP Library':'مكتبة الإجراءات','Service Levels':'مستويات الخدمة','Desk procedures (Saudi base · elevated)':'إجراءات المكتب (المعيار السعودي · مُرفَّع)',
    // ---- funnel / count chips + dropdowns ----
    'Default':'افتراضي','Old Customers':'عملاء سابقون','Conferences':'مؤتمرات',
    'All':'الكل','All funnels':'كل المسارات','All stages':'كل المراحل','All managers':'كل المدراء',
    'All tiers':'كل الفئات','Key':'رئيسي','Standard':'قياسي','Unassigned':'غير معيّن',
    '10 / page':'10 / صفحة','20 / page':'20 / صفحة','50 / page':'50 / صفحة','100 / page':'100 / صفحة','Show all':'عرض الكل',
    // ---- lead category chips ----
    'Anchor':'مرتكز','Convert':'للتحويل','Re-engage':'إعادة تفعيل','Dormant':'خامل','Vendor':'مورّد','Partner':'شريك',
    // ---- events filters ----
    'All verticals':'كل القطاعات','Travel':'سفر','Tech':'تقنية','Study':'دراسة',
    'Other':'أخرى','All statuses':'كل الحالات','Confirmed':'مؤكدة','Needs check':'بحاجة لتحقق','Stale':'قديمة','No date':'بدون تاريخ',
    'All opportunities':'كل الفرص','Sales prospect':'فرصة مبيعات','Partner / competitor':'شريك / منافس',
    // ---- finance / reports tabs ----
    'Overview':'نظرة عامة','Ledger':'السجل','Report Builder':'منشئ التقارير','Import':'استيراد',
    'All (H1 2026)':'الكل (النصف الأول 2026)','Achievements':'الإنجازات','Objectives & KPIs':'الأهداف والمؤشرات',
    'Generate Report':'إنشاء تقرير',
    // ---- Today section headings (with emoji) ----
    'Today':'اليوم','Commercial Credit Pool':'مجمع الائتمان التجاري',
    '⏰ TTL expiring (next 48h)':'⏰ مهل تنتهي (خلال 48 ساعة)','💸 Overdue invoices (>30 days)':'💸 فواتير متأخرة (> 30 يوم)',
    '📞 Dunning sequence active':'📞 تسلسل تحصيل نشط','📉 Low-margin offers / approvals':'📉 عروض هامش منخفض / موافقات',
    '📌 My queue (next 7 days)':'📌 قائمتي (خلال 7 أيام)',
    // ---- lead source / funnel names ----
    'Contact form':'نموذج تواصل','Tender':'مناقصة','Referral':'إحالة','Invoice history':'سجل الفواتير',
    'Service Integration Partners':'شركاء تكامل الخدمات','Outreach':'تواصل مباشر','Inbound':'وارد','Website Form':'نموذج الموقع',
    // the seven real funnels (names shown in the Funnel column, chips + "All funnels" dropdown)
    'Travel Trade':'وكالات السفر','Partners & Tenders':'شركاء ومناقصات','Website Form — B2B':'نموذج الموقع — أعمال',
    'Website Form — Entities':'نموذج الموقع — جهات','Outreach & Network':'تواصل وعلاقات','Past Invoices':'فواتير سابقة',
    // ---- Settings (the real cards that remain after the dev tidy) ----
    'Admin & history':'الإدارة والسجل','Activity & Audit':'النشاط والتدقيق','Company profile — printables':'ملف الشركة — للطباعة',
    'Tender one-pager':'صفحة المناقصة','About Direct Travel (one-pager)':'عن Direct Travel','Edit cap…':'تعديل السقف…',
    '👤 View preset':'👤 نمط العرض','🎯 Commercial':'🎯 تجاري','💰 Finance':'💰 المالية','📊 CFO':'📊 المدير المالي',
    '🌐 Everything':'🌐 الكل','📈 B2B snapshot':'📈 لقطة B2B',
    // ---- Client/lead card header + jump bar (2026-09-02 Arabic drive found these in English) ----
    'Chain of command':'سلسلة القرار','Chain incomplete':'السلسلة غير مكتملة','Chain ok':'السلسلة مكتملة',
    'New booking':'حجز جديد','Create proposal':'إنشاء عرض','Log activity':'تسجيل نشاط','Log activity +':'تسجيل نشاط +',
    'Request':'طلب','Request +':'طلب +','Key facts':'حقائق أساسية','Corporate account':'الحساب المؤسسي',
    'Activity & workflow':'النشاط وسير العمل','Contacts & channels':'جهات الاتصال والقنوات',
    '＋ Log activity':'＋ تسجيل نشاط','＋ Request':'＋ طلب','＋ Contact / POC':'＋ جهة اتصال / مسؤول','🔗 Link':'🔗 رابط','📄 Detail view':'📄 عرض التفاصيل'
  };
  // Stage badge words — translated ONLY inside .statusbadge / stage pills, to avoid
  // colliding with the same words used elsewhere (headers, chips, filters).
  var STAGE_AR={'New':'جديد','Prospect':'مرتقب','Contacted':'تم التواصل','Qualified':'مؤهل','Proposal':'عرض مقدم','Negotiation':'تفاوض','Won':'مكسوب','Lost':'مفقود','Client':'عميل','On hold':'مُعلّق','In discussion':'قيد النقاش'};
  try{ window.__STAGE_AR=STAGE_AR; }catch(_){}   // 2026-09-02: shared so other layers (js/62's merge card) use the same words
  // Operations kanban column headers (js/core/core-03-reference-ops.js STAGES) — a different
  // word set from lead stages above (Quoting/Ticketed/Delivered don't exist as lead stages,
  // and "New"/"Closed" here must never leak into the shared V27_AR dict, which is scanned
  // much more broadly and could then wrongly translate an unrelated button or label that
  // happens to say exactly "New" or "Closed"). Found live 2026-08-21: these headers sat
  // inside a nested <span class="pip"> + text-node structure that no existing scan touched
  // at all, so the whole Operations board rendered its column headers in English on an
  // otherwise fully-Arabic page.
  var OPS_STAGE_AR={'New':'جديد','Quoting':'تسعير','Awaiting client':'بانتظار العميل','Booked':'محجوز','Ticketed':'تم إصدار التذكرة','Delivered':'تم التسليم','Closed':'مغلق'};
  var ARROWS=/[▲▼↑↓\s]+$/; // trailing sort arrows / whitespace
  function replaceLeadText(el,val){ // set text but keep child nodes (icon / arrow span)
    if(el.children.length===0){ el.textContent=val; return; }
    var tn=null,i; for(i=0;i<el.childNodes.length;i++){ if(el.childNodes[i].nodeType===3 && el.childNodes[i].textContent.trim()){ tn=el.childNodes[i]; break; } }
    if(tn) tn.textContent=val; else el.textContent=val;
  }
  function setText(el,val){ // translate, remembering the English original for restore
    if(!el.hasAttribute('data-v27en')) el.setAttribute('data-v27en', el.textContent);
    replaceLeadText(el,val); el.setAttribute('data-v27','1');
  }
  var TRAIL=/\s*(?:[·▾▸►?▲▼↑↓]\s*)+\d*\s*$/; // trailing "· 60", " ?", " ▲", "▾ 0"
  function translateDecorated(el,dict){
    var full=(el.textContent||'').trim(); if(!full)return;
    if(dict[full]!==undefined){ setText(el,dict[full]); return; }
    var base=full.replace(TRAIL,'').trim();
    if(base && base!==full && dict[base]!==undefined){
      if(!el.hasAttribute('data-v27en'))el.setAttribute('data-v27en',el.textContent);
      if(el.children.length===0){ var idx=full.indexOf(base); el.textContent=dict[base]+(idx>=0?full.slice(idx+base.length):''); }
      else replaceLeadText(el,dict[base]);
      el.setAttribute('data-v27','1');
    }
  }
  function scopeTranslate(scope){
    if(!scope)return;
    var heads=scope.querySelectorAll('th,h2,h3'),i;
    for(i=0;i<heads.length;i++){ var hd=heads[i]; if(hd.getAttribute('data-v27')||hd.querySelector('input,select'))continue; translateDecorated(hd,V27_AR); }
    var els=scope.querySelectorAll('.kl,.l,button,a.btn,.tag'),j;
    for(j=0;j<els.length;j++){ var el=els[j]; if(el.getAttribute('data-v27')||el.querySelector('input,select,textarea'))continue; translateDecorated(el,V27_AR); }
    // dropdown options: main dict, then stage words (safe — options are filter values, not data)
    var opts=scope.querySelectorAll('option'),o;
    for(o=0;o<opts.length;o++){ var op=opts[o]; if(op.getAttribute('data-v27'))continue; var ot=(op.textContent||'').trim(); if(!ot)continue;
      if(V27_AR[ot]!==undefined) setText(op,V27_AR[ot]); else if(STAGE_AR[ot]!==undefined) setText(op,STAGE_AR[ot]); }
    // stage badges (row pills) — isolated stage dictionary
    var bd=scope.querySelectorAll('.statusbadge,.stage-badge,.lead-stage'),k;
    for(k=0;k<bd.length;k++){ var pill=bd[k]; if(pill.getAttribute('data-v27'))continue; var pt=(pill.textContent||'').trim(); if(STAGE_AR[pt]!==undefined) setText(pill,STAGE_AR[pt]); }
    // Operations kanban column headers — isolated dictionary, see OPS_STAGE_AR's own comment
    var ops=scope.querySelectorAll('.col .ch .t'),q;
    for(q=0;q<ops.length;q++){ var colHead=ops[q]; if(colHead.getAttribute('data-v27'))continue; translateDecorated(colHead,OPS_STAGE_AR); }
  }
  // #gsearch's placeholder is a static attribute baked into index.html itself (never
  // re-rendered per page), not app-generated markup — so it never went through this file's
  // usual textContent-scanning path at all, in either direction. Patched directly, by id,
  // the same "translate, remember the English original for restore" shape as setText() uses
  // elsewhere in this file, just via the placeholder attribute instead of textContent.
  var GSEARCH_PLACEHOLDER_AR='ابحث في كل شيء — العملاء، الطلبات، شركات الطيران، الموردون، الإجراءات…';
  function patchGlobalSearchPlaceholder(isAr){
    var gs=document.getElementById('gsearch'); if(!gs)return;
    if(isAr){
      if(!gs.hasAttribute('data-v27phen')) gs.setAttribute('data-v27phen', gs.placeholder);
      gs.placeholder=GSEARCH_PLACEHOLDER_AR;
    } else if(gs.hasAttribute('data-v27phen')){
      gs.placeholder=gs.getAttribute('data-v27phen'); gs.removeAttribute('data-v27phen');
    }
  }
  // The two accessibility skip-links (js/core/core-06-v18-v21.js's #v21SkipLink and
  // js/core/core-08-v25.js's #v25SkipLink) are inserted once as the FIRST CHILD of <body> —
  // siblings of #view and .top, not descendants of either, so scopeTranslate's
  // document.getElementById('view')/.querySelector('.top') scoping can never reach them no
  // matter what's added to its selector list. Same shape as the #gsearch placeholder patch:
  // patched directly by id, with the pre-switch text remembered for a clean restore.
  var SKIP_LINK_TEXT_AR='تخطّي إلى المحتوى';
  function patchSkipLinks(isAr){
    ['v21SkipLink','v25SkipLink'].forEach(function(id){
      var el=document.getElementById(id); if(!el)return;
      if(isAr){
        if(!el.hasAttribute('data-v27en')) el.setAttribute('data-v27en', el.textContent);
        el.textContent=SKIP_LINK_TEXT_AR;
      } else if(el.hasAttribute('data-v27en')){
        el.textContent=el.getAttribute('data-v27en'); el.removeAttribute('data-v27en');
      }
    });
  }
  function v27ArHeaders(){
    try{
      if(typeof LANG==='undefined')return;
      if(LANG!=='ar'){ // restore any surviving translated element (e.g. persistent top bar) to English
        var stale=document.querySelectorAll('[data-v27en]');
        for(var s=0;s<stale.length;s++){ stale[s].textContent=stale[s].getAttribute('data-v27en'); stale[s].removeAttribute('data-v27en'); stale[s].removeAttribute('data-v27'); }
        patchGlobalSearchPlaceholder(false);
        patchSkipLinks(false);
        return;
      }
      scopeTranslate(document.getElementById('view'));
      scopeTranslate(document.querySelector('.top'));
      patchGlobalSearchPlaceholder(true);
      patchSkipLinks(true);
    }catch(e){ if(window.console)console.warn('[v27] ar-translate',e); }
  }
  window.v27ArHeaders=v27ArHeaders;
  if(typeof render==='function'){ var _r27=render; window.render=function(){ var out=_r27.apply(this,arguments); v27ArHeaders(); setTimeout(v27ArHeaders,80); return out; }; }
  v27ArHeaders();
}catch(e){ if(window.console)console.warn('[v27] init',e); }})();
