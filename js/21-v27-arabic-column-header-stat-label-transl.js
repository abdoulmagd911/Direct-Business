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
    'Awaiting client':'بانتظار العميل','Pipeline value':'قيمة المسار','Booked margin':'هامش المحجوز',
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
    // ---- proposal editor (2026-09-02, attack round 10 — first Arabic drive of the editor WITH a
    // record): its form labels, section summaries, buttons and the two injected action buttons
    // were English. Whole-string matches on <label>/<summary>/.ch-sub (selectors added below);
    // the client-facing preview document itself is deliberately left as authored. ----
    '← Offers':'← العروض','Live preview — this is what the client sees':'معاينة حية — هذا ما يراه العميل',
    '🧳 Convert to booking':'🧳 حجز مبدئي (يُدفع إلى المصدر عند التأكيد)','🧳 Draft booking (push to source on confirm)':'🧳 حجز مبدئي (يُدفع إلى المصدر عند التأكيد)',
    '📤 Send for review (Email + WhatsApp)':'📤 إرسال للمراجعة (بريد + واتساب)','📤 Send for review':'📤 إرسال للمراجعة',
    'Pricing':'التسعير','Fare options — compare 2–3 fares':'خيارات الأسعار — قارن 2–3 أسعار',
    'Add 2–3 fare families / sources to compare — they appear in the client quote with NDC/EDIFACT badges.':'أضف 2–3 عائلات أسعار / مصادر للمقارنة — تظهر في عرض العميل مع شارات NDC/EDIFACT.',
    'Deal, workflow & compliance':'الصفقة وسير العمل والامتثال','Fare rules':'قواعد السعر',
    'Ref #':'المرجع #','Counselor':'المستشار','Passenger / subject':'المسافر / الموضوع','Class / fare basis':'الدرجة / أساس السعر',
    'Route':'المسار','Flight details':'تفاصيل الرحلة','Ticket price':'سعر التذكرة',"Partner's fees":'رسوم الشريك','Service fees':'رسوم الخدمة',
    'VAT amount':'مبلغ الضريبة','Currency':'العملة','Valid until (expiry)':'صالح حتى (الانتهاء)','Ticket time limit (TTL)':'مهلة إصدار التذكرة (TTL)',
    'Version':'الإصدار','Link to lead / client (auto-log on send)':'ربط بعميل محتمل / عميل (يُسجَّل تلقائيًا عند الإرسال)',
    'Travel policy':'سياسة السفر','Approval':'الموافقة','Out-of-policy reason':'سبب مخالفة السياسة','ADT':'بالغ','CHD':'طفل','INF':'رضيع',
    'Win / lose reason (on Accepted/Rejected)':'سبب الفوز / الخسارة (عند القبول/الرفض)','Remarks':'ملاحظات','Additional fees':'رسوم إضافية',
    'Changes — before':'التغييرات — قبل السفر','Changes — after':'التغييرات — بعد السفر','Cancellation — before':'الإلغاء — قبل السفر','Cancellation — after':'الإلغاء — بعد السفر',
    'No-show fees':'رسوم عدم الحضور','Baggage allowance':'الأمتعة المسموحة','Last issue date':'آخر موعد للإصدار','Cheapest fare?':'أرخص سعر؟','Min stay':'أقل مدة إقامة','Max stay':'أقصى مدة إقامة',
    'Label':'التسمية','Provider / source':'المورّد / المصدر','Content':'المحتوى','Fare family':'عائلة السعر','Base':'الأساس','Taxes / YQ':'الضرائب / YQ',
    'Ancillaries':'الإضافات','Agency fee':'رسوم الوكالة','Refundable':'قابل للاسترداد','Baggage':'الأمتعة',
    '∑ Auto-total':'∑ الإجمالي تلقائيًا','⧉ Copy for WhatsApp / Email':'⧉ نسخ لواتساب / البريد','Delete':'حذف','Remove':'إزالة',
    '+ Add fare option':'+ إضافة خيار سعر','+ Add service':'+ إضافة خدمة','+ Add freebie':'+ إضافة مجاني','⤷ Log this offer to the linked lead':'⤷ تسجيل هذا العرض على العميل المرتبط',
    // ---- top-bar controls ----
    'Access':'الصلاحيات','Team':'الفريق','Sign out':'تسجيل الخروج','Export':'تصدير','▾ Export':'▾ تصدير',
    'Export ▾':'تصدير ▾','Share (view-only)':'مشاركة (عرض فقط)',
    // ---- in-page page headings (the ? help button is preserved) ----
    'Leads':'العملاء المحتملون','Clients':'العملاء','Offers':'العروض','Bookings':'الحجوزات','Projects':'المشاريع',
    'Invoices':'الفواتير','Tickets':'التذاكر','Settings':'الإعدادات','Providers GDS':'الموردون و GDS','Providers & GDS':'الموردون و GDS',
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
  // ---- Reference drill-downs (2026-09-02, attack round 19 — the first Arabic drive of an airline
  // detail/dashboard and a provider detail/dashboard WITH a record; the harness had carried zero
  // airlines/providers until then). Whole-string chrome only: back buttons, card titles, fact labels
  // (.fact>.k, added below), KPI tiles, table heads, explanatory sub-lines and the servicing flags.
  // Added with "existing entry wins" so nothing already translated elsewhere changes meaning.
  // Deliberately NOT here: the NDC matrix <option> words (Active / Pending / Inactive / N/A /
  // EDIFACT / Aggregator) — those <option>s carry no value attribute, so translating their text
  // would make setNdc() store an Arabic word and ndcActive() (status==="Active") would stop counting. ----
  var REF_AR={
    '← Back':'← رجوع','← Back to airlines':'← العودة إلى شركات الطيران','← Back to providers':'← العودة إلى الموردين',
    '📊 Dashboard view':'📊 لوحة المؤشرات','Hide empty rows':'إخفاء الصفوف الفارغة',
    // airline dashboard tiles + cards
    'Ticket stock':'مخزون التذاكر','KSA IATA':'IATA السعودية','Alliance':'التحالف','NDC active':'NDC مفعّل','ADM risk':'مخاطر ADM','On-time':'الالتزام بالمواعيد',
    'NDC activation — by source':'تفعيل NDC — حسب المصدر','Ticketing rules':'قواعد الإصدار','Sourcing':'المصادر','Booked volume (reflected)':'حجم الحجوزات (منعكس)',
    'Fare value SAR':'قيمة التذاكر (ر.س)','Value SAR':'القيمة (ر.س)',
    'Single source of truth — editing any cell here also updates the front list and the detailed page.':'مصدر واحد للحقيقة — أي تعديل هنا ينعكس على القائمة الأمامية وصفحة التفاصيل.',
    'Auto-aggregated from bookings & tickets — add a booking on this carrier and it lands here.':'يُجمَّع تلقائيًا من الحجوزات والتذاكر — أضف حجزًا على هذه الشركة وسيظهر هنا.',
    'Source / provider':'المصدر / المزوّد','NDC status':'حالة NDC','Content type':'نوع المحتوى','Updated':'آخر تحديث','Notes (account / link)':'ملاحظات (الحساب / الرابط)',
    'No active NDC / content source on this carrier yet.':'لا يوجد مصدر NDC / محتوى مفعّل على هذه الشركة بعد.',
    // airline detail (fact labels + section summaries)
    'Ticketing & fare rules':'قواعد الإصدار والأسعار','NDC & content sources':'NDC ومصادر المحتوى',
    'On KSA IATA (BSP Saudi)':'على IATA السعودية (BSP)','Country · Type':'الدولة · النوع','Content providers':'مزوّدو المحتوى','Manual provider':'مزوّد يدوي',
    'Frontend (OTA)':'الواجهة (OTA)','Deeplinks':'روابط مباشرة','Payment':'الدفع','Terms':'الشروط','Ticketing authority':'صلاحية الإصدار',
    'Void window':'مهلة الإبطال','Reissue (voluntary)':'إعادة الإصدار (اختياري)','Refund (voluntary)':'الاسترداد (اختياري)','LCC refund to':'استرداد LCC إلى','No-show':'عدم الحضور',
    'Corporate deal / TMC tariff':'اتفاقية شركات / تعرفة TMC','Codeshare / interline':'الرمز المشترك / الربط البيني','Hubs / focus cities':'المحاور / المدن الرئيسية',
    'Fleet (primary)':'الأسطول (الرئيسي)','Classes offered':'الدرجات المتاحة','ADM risk profile':'ملف مخاطر ADM','On-time performance':'الالتزام بالمواعيد',
    'SAF / sustainability':'الوقود المستدام / الاستدامة','NDC version · env':'إصدار NDC · البيئة','Availability source':'مصدر التوفر',
    'BSP authorized':'مصرّح عبر BSP','No authority — target':'بدون صلاحية — مستهدف','Authorized':'مصرّح','Target':'مستهدف','Available':'متاح',
    // provider detail / dashboard
    'Servicing & commercial':'الخدمة والجانب التجاري','Servicing capability matrix':'مصفوفة إمكانات الخدمة','Routed volume (reflected)':'الحجم الموجَّه (منعكس)',
    'Incident / outage history':'سجل الأعطال والانقطاعات','Where we get availability':'من أين نحصل على التوفر','Servicing':'الخدمة','Content mix':'مزيج المحتوى',
    'Settlement':'التسوية','Commission / markup':'العمولة / الهامش','Cost per booking':'التكلفة لكل حجز','Uptime · response':'التشغيل · الاستجابة','Support SLA':'اتفاقية الدعم',
    'Account manager':'مدير الحساب','Contract renewal':'تجديد العقد','Use for':'يُستخدم لـ','Booking / agent portal':'بوابة الحجز / الوكيل','ADM / admin portal':'بوابة ADM / الإدارة',
    'Account / username':'الحساب / اسم المستخدم','API status':'حالة API','Uptime':'زمن التشغيل','Response':'زمن الاستجابة','Cost / booking':'التكلفة / حجز','Renewal':'التجديد',
    'Click to toggle what we can do through this provider — syncs to the list & detail view.':'انقر لتبديل ما يمكننا تنفيذه عبر هذا المورّد — يتزامن مع القائمة وصفحة التفاصيل.',
    'Auto-aggregated from bookings routed through this provider.':'يُجمَّع تلقائيًا من الحجوزات الموجَّهة عبر هذا المورّد.',
    'Healthy':'سليم','Degraded':'متدهور','Down':'متوقف',
    // servicing flags (buttons; "✓ " prefix when on)
    'Book':'حجز','✓ Book':'✓ حجز','Reissue':'إعادة إصدار','✓ Reissue':'✓ إعادة إصدار','Refund':'استرداد','✓ Refund':'✓ استرداد',
    'Seats':'المقاعد','✓ Seats':'✓ المقاعد','Bags':'الأمتعة','✓ Bags':'✓ الأمتعة','Split PNR':'فصل PNR','✓ Split PNR':'✓ فصل PNR'
  };
  Object.keys(REF_AR).forEach(function(k){ if(V27_AR[k]===undefined) V27_AR[k]=REF_AR[k]; });
  // ---- Service Levels + Sync page (2026-09-02, attack round 20 — first Arabic drive of both WITH
  // rows; the harness had carried no service levels or sync events). The SLA legend/th words come
  // in two spellings because core-08's de-jargon pass rewrites them after render ("Beats market" →
  // "Faster than common") and this file may see either. Same "existing entry wins" rule. ----
  var SLA_SYNC_AR={
    '★ Beats market':'★ أسرع من الشائع','★ Faster than common':'★ أسرع من الشائع','✓ Meets best practice':'✓ الهدف القياسي','✓ Standard target':'✓ الهدف القياسي',
    'Saudi market':'السوق السعودي','Common practice':'الممارسة الشائعة','Industry whales':'كبرى الشركات','Stretch goal':'هدف طموح','+ Add SLA':'+ إضافة مستوى خدمة',
    'SOP Library':'مكتبة الإجراءات','Service Levels':'مستويات الخدمة',
    // sync page: the note paragraph (whole element, see scopeTranslate), the sub-line, the area names and tags
    'This workspace is a read-and-follow-up layer. All payment, invoice, tax and client actions happen in the Direct system - open the right page below. Live two-way sync arrives with the hosted backend phase.':'مساحة العمل هذه طبقة للقراءة والمتابعة. كل إجراءات الدفع والفواتير والضرائب والعملاء تتم داخل نظام Direct — افتح الصفحة المناسبة أدناه. المزامنة الحية في الاتجاهين تأتي مع مرحلة الخادم المستضاف.',
    'Deep links into payments.directksa.com (admin login required)':'روابط مباشرة إلى payments.directksa.com (يلزم تسجيل دخول المشرف)',
    'Corporate clients':'عملاء الشركات','Refund requests':'طلبات الاسترداد','Receipts and settlements':'الإيصالات والتسويات','Pricing settings':'إعدادات التسعير','Mailboxes':'صناديق البريد',
    'Open in your Amadeus session':'افتح في جلسة Amadeus لديك','Read-only':'للقراءة فقط','Open':'فتح'
  };
  Object.keys(SLA_SYNC_AR).forEach(function(k){ if(V27_AR[k]===undefined) V27_AR[k]=SLA_SYNC_AR[k]; });
  // ---- Reports: Generate Report tab, Achievements filters, the built report's heads (2026-09-02,
  // round 24 — first Arabic drive of the report builder). The type/scope <select>s carry value
  // attributes, so translating their option text is safe (rptRepSet reads this.value). ----
  var REPORTS_AR={
    'Generate report':'إنشاء تقرير','Report type':'نوع التقرير','Month':'الشهر','Scope':'النطاق',
    'Monthly department report':'تقرير القسم الشهري','Quarterly objectives review':'مراجعة الأهداف الربعية',
    'Whole department':'القسم كاملًا','One member':'عضو واحد','One objective':'هدف واحد',
    'Build report':'إنشاء التقرير','Print / PDF':'طباعة / PDF','Download .html':'تنزيل .html','Copy text':'نسخ النص',
    'All months':'كل الأشهر','All members':'كل الأعضاء','All objectives':'كل الأهداف',
    'Nothing here yet. Log achievements as they happen — tenders submitted, contracts signed, embassies added, services launched…':'لا شيء هنا بعد. سجّل الإنجازات فور حدوثها — مناقصات مقدّمة، عقود موقّعة، سفارات مضافة، خدمات مطلقة…',
    'Date':'التاريخ','Achievement':'الإنجاز','Member':'العضو','Objective / KPI':'الهدف / المؤشر','Value':'القيمة',
    '1 · Achievements':'1 · الإنجازات','2 · KPI progress vs 2026 targets':'2 · تقدّم المؤشرات مقابل أهداف 2026','3 · Gaps & focus areas (<50% of target)':'3 · الفجوات ومجالات التركيز (أقل من 50% من الهدف)',
    'KPI':'المؤشر','Target':'الهدف','Actual (YTD)':'الفعلي (منذ بداية السنة)','Progress':'التقدم'
  };
  Object.keys(REPORTS_AR).forEach(function(k){ if(V27_AR[k]===undefined) V27_AR[k]=REPORTS_AR[k]; });
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
  try{ window.__OPS_STAGE_AR=OPS_STAGE_AR; }catch(_){}   // 2026-09-02: shared so the request cards' "Advance →" button uses the same words as the column headers
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
  var TRAIL=/\s*(?:[·▾▸►?▲▼↑↓]\s*)+\d*\s*$|\s*\(\d+\)\s*$/; // trailing "· 60", " ?", " ▲", "▾ 0", " (3)"
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
    // label / summary / .ch-sub added 2026-09-02 for the proposal editor — whole-string matches only,
    // and a label wrapping an input/select/textarea is skipped, so free text is never touched
    // .empty added 2026-09-02 (round 24) for the Reports empty states — whole-string matches only
    var els=scope.querySelectorAll('.kl,.l,button,a.btn,.tag,label,summary,.ch-sub,.empty'),j;
    for(j=0;j<els.length;j++){ var el=els[j]; if(el.getAttribute('data-v27')||el.querySelector('input,select,textarea'))continue; translateDecorated(el,V27_AR); }
    // fact-row labels (.fact > .k) added 2026-09-02 for the Reference drill-downs — the label half of
    // a key/value row only, whole-string matches only, and a label that wraps markup (a tag pill in
    // the ADM-risk distribution, say) is skipped so the pill is never flattened to text
    var fk=scope.querySelectorAll('.fact>.k'),f;
    for(f=0;f<fk.length;f++){ var kl=fk[f]; if(kl.getAttribute('data-v27')||kl.children.length)continue; translateDecorated(kl,V27_AR); }
    // Service Levels legend pills (.bench) — whole-string matches only (2026-09-02, round 20)
    var bn=scope.querySelectorAll('.bench'),bi;
    for(bi=0;bi<bn.length;bi++){ var bp=bn[bi]; if(bp.getAttribute('data-v27')||bp.children.length)continue; translateDecorated(bp,V27_AR); }
    // Sync page only: the area names (<td><b>) are chrome there, not data — on every other page a
    // <td><b> is a record name and is never touched. The note paragraph wraps a <b>, so it is
    // translated as a whole element (the English is remembered as plain text; the page re-renders
    // on a language switch anyway).
    if(typeof current!=='undefined'&&current==='sync'){
      var sb=scope.querySelectorAll('td>b'),si;
      for(si=0;si<sb.length;si++){ var nb=sb[si]; if(nb.getAttribute('data-v27')||nb.children.length)continue; translateDecorated(nb,V27_AR); }
      var note=scope.querySelector('.note.v29-connections');
      if(note&&!note.getAttribute('data-v27')){ var nt=(note.textContent||'').replace(/\s+/g,' ').trim(); if(V27_AR[nt]!==undefined){ note.setAttribute('data-v27en',nt); note.textContent=V27_AR[nt]; note.setAttribute('data-v27','1'); } }
    }
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
