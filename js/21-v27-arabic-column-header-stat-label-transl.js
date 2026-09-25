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
    /* ---- lead-edit form labels, 2026-09-18 (fire #86): measured live, 11 of 24 were English.
       The other six of the eleven are the channel chips, which wrap a checkbox and are handled by
       translateChannelChips above. Exact whole strings, question marks included — translateDecorated
       tries the full string before it tries stripping a trailing "?". ---- */
    'Channels of communication':'قنوات التواصل','Existing client?':'عميل حالي؟',
    'Vendor / commission?':'مورّد / عمولة؟','Next action due':'تاريخ الإجراء التالي',
    'Contacts (same business, multiple people)':'جهات الاتصال (نفس المنشأة، عدة أشخاص)',
    '+ Add contact':'+ إضافة جهة اتصال',
    /* ---- the rest of the dialogs, 2026-09-18 (fire #87): measured by opening all 23 in Arabic.
       Client onboarding is the form v36 deliberately collapsed as a duplication of Direct's own client
       master — hidden, not deleted, so it is still reachable and was still fully English. ---- */
    'Name (EN)':'الاسم (إنجليزي)','Name (AR)':'الاسم (عربي)','Classification':'التصنيف',
    'Industry':'القطاع','Branch / HQ':'الفرع / المركز الرئيسي',
    'Address (EN)':'العنوان (إنجليزي)','Address (AR)':'العنوان (عربي)',
    'Commercial Registration (CR) #':'رقم السجل التجاري','CR expiry':'انتهاء السجل التجاري',
    'VAT registration # (15 digits)':'الرقم الضريبي (15 رقمًا)','Buyer IBAN (SA…)':'آيبان المشتري (SA…)',
    'Payment configuration':'إعداد الدفع','Pricing scheme':'نظام الأسعار',
    'Credit limit (SAR)':'حد الائتمان (ريال)','Billing cycle day':'يوم دورة الفوترة',
    'Collections owner':'مسؤول التحصيل','Late fee policy':'سياسة غرامة التأخير',
    'Minimum volume commitment':'الحد الأدنى للالتزام بالحجم',
    'Markup (flights / hotels / visas / transfers)':'الهامش (طيران / فنادق / تأشيرات / نقل)',
    '+ Add signatory':'+ إضافة مفوّض بالتوقيع','+ Add traveler':'+ إضافة مسافر','+ Add':'+ إضافة',
    /* Chain of command (v24) */
    /* plain field labels, never data — the chain-of-command form repeats them per row. Safe to put in
       the main dictionary: an <option> is only translated when it carries a value attribute, so no
       dropdown can end up storing the Arabic word. WhatsApp keeps its own name. */
    'Email':'البريد الإلكتروني','Phone':'الهاتف',
    'National ID / Iqama':'الهوية / الإقامة','Covers when':'يغطي عند','Signing date':'تاريخ التوقيع',
    'Last review date':'تاريخ آخر مراجعة',
    '+ Add hierarchy row':'+ إضافة صف في التسلسل','+ Add emergency contact':'+ إضافة جهة اتصال للطوارئ',
    '+ Add escalation rung':'+ إضافة درجة تصعيد','Re-confirm chain today':'تأكيد التسلسل اليوم',
    /* the snapshot browser's row action — 117 of them on screen, all English */
    'Restore':'استعادة',
    /* ---- Finance and Ops forms, 2026-09-18 (fire #87). These three could not be opened against the
       live database at all — there are 0 invoices, 0 bookings and 0 requests in it — so they were
       reached on the mock, which has them seeded. Every industry acronym is KEPT and only the words
       around it are translated: PNR, RBD, FFN, ADM, BSP, IATA SIS, GDS, NDC, OTA, ZATCA. Nothing about
       what any field means or stores is changed; these are labels only. ---- */
    'Invoice type':'نوع الفاتورة','Due date':'تاريخ الاستحقاق','PO number (corporate)':'رقم أمر الشراء (للشركات)',
    'Dunning stage':'مرحلة التحصيل','Total (subtotal pre-VAT)':'الإجمالي (قبل ضريبة القيمة المضافة)',
    'VAT rate (line 1)':'نسبة ضريبة القيمة المضافة (السطر 1)','ZATCA status':'حالة هيئة الزكاة والضريبة',
    'Currency · FX rate':'العملة · سعر الصرف','First line description':'وصف السطر الأول',
    'Recurring schedule':'جدول التكرار','BSP / IATA SIS bucket':'سلة BSP / IATA SIS',
    'PNR / Record locator':'PNR / رقم الحجز','Booking source':'مصدر الحجز',
    'Queue assignee':'المسؤول في قائمة العمل','Queue due by':'موعد قائمة العمل',
    'RBD / class':'RBD / الدرجة','Fare basis':'أساس الأجرة','FFN (frequent flyer)':'FFN (المسافر الدائم)',
    'Validity':'مدة الصلاحية','E-ticket status':'حالة التذكرة الإلكترونية','E-ticket #':'رقم التذكرة الإلكترونية',
    'Refund penalty':'غرامة الاسترداد','Change penalty':'غرامة التغيير',
    'ADM linked?':'مرتبطة بـ ADM؟','ADM ID':'رقم ADM',
    'Endorsements / restrictions':'التظهيرات / القيود','Lead ticket':'التذكرة الرئيسية',
    'Fare':'الأجرة','Taxes':'الضرائب','Total cost':'إجمالي التكلفة',
    'Amount (SAR)':'المبلغ (ريال)','Method':'طريقة الدفع','Bank/PSP reference':'مرجع البنك / مزوّد الدفع',
    /* Corporate profile (2026-09-18, fire #88) — the last reachable dialog still in English. It is
       opened from a client's card AND from a lead's, and it was the same 12 strings either way. */
    'CR / VAT number':'رقم السجل التجاري / الرقم الضريبي',
    'Contract start':'بداية العقد','Contract end':'نهاية العقد','Contract scope':'نطاق العقد',
    'Agreed SLA':'مستوى الخدمة المتفق عليه','Travel policy & preferences':'سياسة السفر والتفضيلات',
    'Pricing scheme (per service)':'نظام الأسعار (لكل خدمة)','+ Add service pricing':'+ إضافة سعر خدمة',
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
    'New':'جديد','Good':'جيد','Watch':'مراقبة','At risk':'معرّض للخطر','Lost':'مفقود',
    '0–30 days':'0–30 يومًا','31–60 days':'31–60 يومًا','61–90 days':'61–90 يومًا','90+ days':'90+ يومًا',
    'Total clients':'إجمالي العملاء','Key accounts':'حسابات رئيسية','Total won (SAR)':'إجمالي المكسوب (ريال)',
    'Clients in view':'العملاء المعروضون','Won leads not yet converted':'صفقات مكسوبة لم تُحوَّل بعد',
    'Reviews overdue':'مراجعات متأخرة','Open requests':'طلبات مفتوحة','SLA overdue':'تأخّر مستوى الخدمة',
    'Awaiting client':'بانتظار العميل','Pipeline value':'قيمة المسار','Booked margin':'هامش المحجوز',
    /* 2026-09-23 (fire #232) — four headings on /dashboard that stayed English on the Arabic
       page. They were missed for one reason only: probe-a-page-heading-is-never-english-in-arabic
       swept 19 routes and the app answers 25, and /dashboard was one of the six it never
       visited. The wording follows what is already agreed here — «المسار» for pipeline, as in
       'Pipeline value' just above. */
    'Top relationships by lifetime value':'أهم العلاقات حسب القيمة التراكمية',
    'Pipeline by category':'المسار حسب الفئة','Conversion funnel':'مسار التحوّل',
    'Standard of service':'مستوى الخدمة',
    'Delivered / closed':'مُسلّم / مغلق',
    // ---- filter + action buttons ----
    'Table':'جدول','Dashboard':'لوحة','By stage':'حسب المرحلة','By category':'حسب الفئة','By funnel':'حسب المسار',
    '↓ Export CSV':'↓ تصدير CSV','⚠ Needs attention':'⚠ بحاجة إلى انتباه','✓ Hide closed':'✓ إخفاء المغلقة',
    'Has app':'له تطبيق','Edit':'تعديل','Del':'حذف','‹ Prev':'‹ السابق','Next ›':'التالي ›',
    '← Leads pipeline':'← مسار العملاء المحتملين','All clients':'كل العملاء','Aggregators':'مجمّعات',
    'All tiers':'كل الفئات','All managers':'كل المدراء','Overdue':'متأخر','Unpaid':'غير مدفوع',
    /* 2026-09-23 (fire #225): this button read «+ عمل جديد» — "new work / new job" — while the
       dialog it opens is titled «جهة جديدة» and the form's own first field is «اسم الجهة». Three
       words in the app for one object, on the busiest page, and the one on the button was the odd
       one out: a record here is a company, not a job. «جهة» throughout now. */
    '+ New business':'+ جهة جديدة','+ New offer':'+ عرض جديد','+ New airline':'+ شركة طيران جديدة',
    '+ New provider':'+ مورّد جديد','+ New SOP':'+ إجراء جديد','+ New request':'+ طلب جديد',
    '+ Booking':'+ حجز','+ Invoice':'+ فاتورة','+ Add event':'+ إضافة فعالية',
    'Share view-only link':'مشاركة رابط للعرض فقط','Projects board':'لوحة المشاريع',
    'Backup now':'انسخ الآن','Backup now to destination':'انسخ الآن','＋ Log achievement':'＋ تسجيل إنجاز',
    // ---- proposal editor (2026-09-02, attack round 10 — first Arabic drive of the editor WITH a
    // record): its form labels, section summaries, buttons and the two injected action buttons
    // were English. Whole-string matches on <label>/<summary>/.ch-sub (selectors added below);
    // the client-facing preview document itself is deliberately left as authored. ----
    '← Offers':'← العروض','Live preview — this is what the client sees':'معاينة حية — هذا ما يراه العميل',
    '🧳 Convert to booking':'🧳 حجز مبدئي — يُؤكَّد لاحقاً في Direct Payments','🧳 Draft booking (push to source on confirm)':'🧳 حجز مبدئي — يُؤكَّد لاحقاً في Direct Payments','🧳 Draft booking — confirmed later in Direct Payments':'🧳 حجز مبدئي — يُؤكَّد لاحقاً في Direct Payments','Issue in Direct Payments':'الإصدار في Direct Payments',
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
    /* 2026-09-22 (fire #218, found by reading every page in Arabic against the real database):
       'Key' was already here and the screen still said KEY. The Clients table's tier badge is
       written SHOUTED — `<span class="tag">KEY</span>` — and this dictionary matches whole strings
       exactly, so «قياسي» appeared beside an untranslated KEY in the same column: the standard
       clients read Arabic and the important ones read English. The shouted spelling is added here
       rather than making the whole dictionary case-insensitive, which would start matching words
       this layer has deliberately kept out of it. */
    'All tiers':'كل الفئات','Key':'رئيسي','KEY':'رئيسي','Standard':'قياسي','Unassigned':'غير معيّن',
    /* and the two plainest words in the app were never in it at all: the Airlines list's "on Saudi
       BSP" column is a Yes/No badge, so every row of the list carried an English word on the Arabic page, and
       the airline card's own fact row repeated it. Whole-string matches on chrome only — a record's
       own name lives in a <td><b> this pass never touches. */
    'Yes':'نعم','No':'لا',
    '10 / page':'10 / صفحة','20 / page':'20 / صفحة','50 / page':'50 / صفحة','100 / page':'100 / صفحة','Show all':'عرض الكل',
    // ---- lead category chips ----
    'Anchor':'مرتكز','Convert':'للتحويل','Re-engage':'إعادة تفعيل','Dormant':'خامل','Vendor':'مورّد','Partner':'شريك',
    // ---- events filters ----
    'All verticals':'كل القطاعات','Travel':'سفر','Tech':'تقنية','Study':'دراسة',
    // 2026-09-25 (fire #249): every form the app opens with openModal was driven live in Arabic —
    // sixteen of them. These are the label and title words this list did not know, so they were the
    // English left inside #modal: New project, the service-fee generator, the three import previews,
    // and the airline editor's GDS label. WhatsApp keeps its own name and the provider form's EMD chip
    // stays a code — both are rules stated further down this file (and fire #64), not omissions.
    'New project':'مشروع جديد','Start':'البداية','End':'النهاية','Budget (SAR)':'الميزانية (ريال)',
    'Validity (days)':'الصلاحية (أيام)',
    'Booking ref':'مرجع الحجز','Provider / GDS':'المورّد / نظام التوزيع (GDS)','PNR':'رقم الحجز (PNR)',
    'Passenger':'المسافر','Subject / passenger':'الموضوع / المسافر','Class':'الدرجة',
    'Subtotal (pre-VAT)':'المجموع الفرعي (قبل الضريبة)','VAT rate':'نسبة الضريبة','Buyer VAT (B2B)':'الرقم الضريبي للمشتري (B2B)',
    'Line item description':'وصف البند',
    'GDS':'نظام التوزيع (GDS)',
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
    /* 2026-09-02 (round 33): the QC group is the only Today group that renders CONDITIONALLY —
       it needs a ticketed booking whose quality checklist is incomplete. The harness had no
       app_bookings seed at all, so it had never appeared, and it was the one heading in this
       list nobody had noticed was missing. */
    '✅ QC checklist incomplete':'✅ قائمة الجودة غير مكتملة',
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
    /* fire #225: «سلسلة القرار» here and «تسلسل المسؤولية» further down, while the BUTTON a person
       actually presses on a client card (core-09) says «التسلسل الإداري». Both dictionary entries
       now match the button — the word you click should be the word you read. */
    'Chain of command':'التسلسل الإداري','Chain incomplete':'السلسلة غير مكتملة','Chain ok':'السلسلة مكتملة',
    'New booking':'حجز جديد','Create proposal':'إنشاء عرض','Log activity':'تسجيل نشاط','Log activity +':'تسجيل نشاط +',
    'Request':'طلب','Request +':'طلب +','Key facts':'حقائق أساسية','Corporate account':'الحساب المؤسسي',
    'Activity & workflow':'النشاط وسير العمل','Contacts & channels':'جهات الاتصال والقنوات',
    '＋ Log activity':'＋ تسجيل نشاط','＋ Request':'＋ طلب','＋ Contact / POC':'＋ جهة اتصال / مسؤول','🔗 Link':'🔗 رابط','📄 Detail view':'📄 عرض التفاصيل',
    /* ---- Dialogs, found 2026-09-07 (round 61) by the first sweep that PRESSES BUTTONS in
       Arabic. Round 26 wired this file into openModal, but a dialog only exists after a click,
       and every tool until now walked the nav and read the page as it landed — so these had
       never been on an Arabic screen anybody or anything looked at. Three dialogs in daily use:
       the quick-edit on a lead and on a client, the Ops new-request form, and the two Settings
       generators. Whole-string chrome only; every <option> below carries an explicit value in
       its own markup (checked one by one), so the stored value stays English. ---- */
    // quick edit (lead + client) — core-10
    'Assigned to':'مُسند إلى','+ Add new person...':'+ إضافة شخص جديد...',
    'Quick note (optional - logs an activity)':'ملاحظة سريعة (اختيارية — تُسجَّل كنشاط)',
    'Account tier':'فئة الحساب','Next account review':'المراجعة القادمة للحساب',
    // Ops new-request form — the option words only became translatable in round 61, when
    // core-03 gave them explicit values; before that translating them would have stored Arabic
    'New request':'طلب جديد','Quoting':'تسعير','Booked':'محجوز','Closed':'مغلق',
    /* Medium rides along with High/Low: the airline quick-edit's ADM-risk select offers all
       three, and translating two of them would read worse than translating none. */
    'Urgent':'عاجل','High':'مرتفع','Medium':'متوسط','Normal':'عادي','Low':'منخفض',
    // Settings → credit pool + the two proposal generators — core-08
    'Commercial Credit Pool — settings':'مجمع الائتمان التجاري — الإعدادات',
    'Change reason (logged to audit)':'سبب التغيير (يُسجَّل في التدقيق)',
    'Pool cap history':'سجل سقف المجمع','When':'متى','Cap':'السقف','Reason':'السبب',
    'Generate service-fee proposal':'إنشاء عرض رسوم الخدمة','— Pick a client —':'— اختر عميلاً —',
    'Fee card':'بطاقة الرسوم','Effective from':'سارٍ من','Notes / scope':'ملاحظات / النطاق',
    'Generate project proposal':'إنشاء عرض المشروع','Project':'المشروع',
    '— Pick a project —':'— اختر مشروعًا —','Executive summary':'الملخص التنفيذي','📥 Both':'📥 كليهما',
    // 2026-09-10 (live Arabic pass) — the lead / client card's own chrome, seen in English on an
    // otherwise Arabic card: the convert button, key-fact labels, the empty states, the pricing
    // sub-heading and the Direct Payments chip. Whole-string matches; the record's data is untouched.
    '★ Convert to client':'★ تحويل إلى عميل','Convert to client':'تحويل إلى عميل',
    'Last contact':'آخر تواصل','Services':'الخدمات','Website':'الموقع الإلكتروني',
    'Legal name / CR·VAT':'الاسم القانوني / السجل·الضريبة','Legal name':'الاسم القانوني',
    'Pricing scheme — markup / fees per service':'نظام التسعير — هامش / رسوم لكل خدمة',
    '⚠ No pricing scheme set — add before quoting this client.':'⚠ لم يُحدَّد نظام تسعير — أضِفه قبل تقديم عرض لهذا العميل.',
    'No negotiated airline deals recorded.':'لا توجد اتفاقيات طيران متفاوض عليها مسجَّلة.',
    'Open invoices in Direct Payments ↗':'الفواتير المفتوحة في Direct Payments ↗',
    'Sheet owner':'مسؤول الشيت','Existing relationship':'علاقة قائمة','Map ↗':'الخريطة ↗','Open ›':'فتح ›'
  };
  // ---- Reference drill-downs (2026-09-02, attack round 19 — the first Arabic drive of an airline
  // detail/dashboard and a provider detail/dashboard WITH a record; the harness had carried zero
  // airlines/providers until then). Whole-string chrome only: back buttons, card titles, fact labels
  // (.fact>.k, added below), KPI tiles, table heads, explanatory sub-lines and the servicing flags.
  // Added with "existing entry wins" so nothing already translated elsewhere changes meaning.
  // Deliberately NOT here: the NDC matrix <option> words (Active / Pending / Inactive / N/A /
  // EDIFACT / Aggregator) — those <option>s carry no value attribute, so translating their text
  // would make setNdc() store an Arabic word and ndcActive() (status==="Active") would stop counting. ----
  /* 2026-09-02 (round 33): booking / ticket / invoice words that only ever appear ON A ROW.
     The harness had no app_bookings or app_invoices seed at all, so Bookings, Invoices,
     Tickets and Archive had never rendered a single row in QA and these were never seen.
     'Confirmed' was already translated and 'Ticketed' was not — the same column showing one
     word in Arabic and the next in English — because 'Ticketed' lived only in the
     Operations-board dictionary below. Display only: the stored status is untouched, and none
     of these is an <option> (see round 28's rule about value-less options being stored by
     their label). */
  var ROW_AR={
    'Ticketed':'تم إصدار التذكرة','Cancelled':'ملغاة','Draft':'مسودة','Pending':'قيد الانتظار','Delivered':'تم التسليم',
    'Credit':'ائتمان','Cash':'نقدًا','Card':'بطاقة','Wallet':'محفظة','Invoice':'فاتورة',
    'OPEN':'مفتوحة','USED':'مستخدمة','REFUNDED':'مستردة','VOID':'ملغاة','EXCHANGED':'مستبدلة',
    'Issued':'صادرة','Paid':'مدفوعة','Overdue':'متأخرة','Cleared':'مقبولة','Not submitted':'لم تُرسل',
    'Standard':'قياسية','Credit note':'إشعار دائن','Debit':'إشعار مدين','None':'لا يوجد',
    'Friendly reminder':'تذكير ودّي','Final notice':'إشعار أخير','Escalation':'تصعيد',
    'Nothing archived yet. Use the Archive button on any record to soft-delete it.':'لا يوجد شيء في الأرشيف بعد. استخدم زر الأرشفة على أي سجل.',
    'Archived invoices':'الفواتير المؤرشفة','Archived bookings':'الحجوزات المؤرشفة','Archived offers':'العروض المؤرشفة','Archived leads':'العملاء المحتملون المؤرشفون',
    '↺ Restore':'↺ استعادة','not recorded':'غير مسجّلة','unknown':'غير معروف'
  };
  try{ Object.keys(ROW_AR).forEach(function(k){ if(!V27_AR[k]) V27_AR[k]=ROW_AR[k]; }); }catch(_){}

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
    'Open in your Amadeus session':'افتح في جلسة Amadeus لديك','Read-only':'للقراءة فقط','Open':'فتح',
    /* 2026-09-21 (fire #150) — first Arabic drive of this page since it was rewritten into a list
       of where to go. The area names were translated and NOTHING in the second column was: every
       "what lives there" line, the one area name nobody had added, and the page's own heading were
       still English on the Arabic side. Company and product names (Direct, Amadeus, DPIN/TTIN,
       Google Drive, payments.directksa.com, the mailbox addresses, the Amadeus office code) stay
       as they are — they are names, not words. */
    'Sync':'المزامنة','Expenses':'المصروفات','Other working sources':'مصادر عمل أخرى',
    'Client records, credit limits, payment terms':'سجلات العملاء وحدود الائتمان وشروط الدفع',
    'DPIN/TTIN invoices, tax view, publishing':'فواتير DPIN/TTIN والعرض الضريبي والنشر',
    'Expense submissions and approvals':'طلبات المصروفات واعتمادها',
    'Refund queue with assignee and approver':'قائمة طلبات الاسترداد مع المسؤول والمعتمِد',
    'Balance/payment receipts applied to invoices':'إيصالات الرصيد والدفع المطبّقة على الفواتير',
    'Per-client price overrides':'أسعار خاصة لكل عميل',
    'Office RUHS2234B - live reservations and ticketing':'مكتب RUHS2234B — الحجوزات وإصدار التذاكر المباشر',
    'business@ / ticketing@ / accounting1@ - mined read-only for airline cases and BSP/ADM intel':'business@ / ticketing@ / accounting1@ — تُقرأ فقط لاستخراج حالات شركات الطيران ومعلومات BSP/ADM',
    'Provider evaluations and operations sheets':'تقييمات المورّدين وجداول التشغيل'
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
  // ---- Client card (2026-09-02, round 25 — the Corporate account card, the activity card's
  // sub-line, the onboarding / profile buttons). Fact labels via the .fact>.k pass, the
  // "Airline corporate deals / fares" sub-head via .sub-h (selector added above). ----
  var CLIENT_CARD_AR={
    'Every touch with this business — no digging through chats or invoices':'كل تواصل مع هذه الجهة — دون البحث في المحادثات أو الفواتير',
    'Contract, policy, negotiated deals & pricing — agents check before quoting':'العقد والسياسة والاتفاقيات المتفاوض عليها والتسعير — يراجعها الموظفون قبل التسعير',
    'Entity type':'نوع الجهة','Legal name':'الاسم القانوني','CR':'السجل التجاري','Payment terms':'شروط الدفع','Contract':'العقد','Credit limit':'سقف الائتمان',
    'Airline corporate deals / fares':'اتفاقيات الشركات مع الطيران / الأسعار','+ Add airline deal':'+ إضافة اتفاقية طيران',
    '🏛 KSA onboarding':'🏛 تسجيل العميل','Edit profile':'تعديل الملف','Edit client profile (full form)':'تعديل ملف العميل (النموذج الكامل)',
    'Open in Clients ↗':'افتح في العملاء ↗','Open in Clients':'افتح في العملاء'
  };
  Object.keys(CLIENT_CARD_AR).forEach(function(k){ if(V27_AR[k]===undefined) V27_AR[k]=CLIENT_CARD_AR[k]; });
  // ---- Dialog forms (2026-09-02, round 26): titles and field labels of the Log activity, New
  // request, New business / Edit lead, airline / provider edit and New SOP dialogs. Whole-string
  // matches; the dropdown option words are deliberately NOT here (see the safe-options rule). ----
  var MODAL_AR={
    'New request':'طلب جديد','New business':'جهة جديدة','New SOP':'إجراء جديد','New event':'فعالية جديدة',
    // log activity
    'Type':'النوع','Move stage to':'نقل المرحلة إلى','What happened? — paste the conversation or write a summary':'ماذا حدث؟ — الصق المحادثة أو اكتب ملخصًا','Next action (optional)':'الإجراء التالي (اختياري)',
    // request
    'Client / business':'العميل / الجهة','Service':'الخدمة','Stage':'المرحلة','Request detail':'تفاصيل الطلب','Owner':'المسؤول','Priority':'الأولوية',
    'Supplier / GDS':'المورّد / GDS','PNR / Ref / HCN':'PNR / المرجع / HCN','Sell value (SAR)':'قيمة البيع (ر.س)','Cost (SAR)':'التكلفة (ر.س)','Notes':'ملاحظات',
    // lead / business form
    'Business name (canonical)':'اسم الجهة (الرسمي)','Arabic name':'الاسم بالعربية','Segment':'الشريحة','Category':'الفئة','Funnel — where this lead came from':'المسار — من أين جاء هذا العميل المحتمل',
    'Funnel / source':'المسار / المصدر','Assigned to (who works it)':'مسند إلى (من يعمل عليه)','Area (city)':'المنطقة (المدينة)','Agency subtype':'نوع الوكالة','Services they use':'الخدمات التي يستخدمونها',
    // airline / provider edit
    'Name':'الاسم','IATA code':'رمز IATA','Ticket stock (3-digit IATA code)':'رمز التذاكر (3 أرقام IATA)','On KSA IATA (BSP Saudi)?':'على IATA السعودية (BSP)؟','Country':'الدولة',
    'Codeshare / interline partners':'الرمز المشترك / شركاء الربط','Availability source (where we book)':'مصدر التوفر (أين نحجز)','Booking / agent portal link':'رابط بوابة الحجز / الوكيل',
    'ADM / admin portal link':'رابط بوابة ADM / الإدارة','Account / username (🔒 no passwords)':'الحساب / اسم المستخدم (🔒 بدون كلمات مرور)','ADM / compliance notes':'ملاحظات ADM / الامتثال',
    'Process (booking / ticketing / issuance)':'آلية العمل (الحجز / الإصدار)','Points of contact':'جهات الاتصال','+ Add contact':'+ إضافة جهة اتصال','Servicing capabilities':'إمكانات الخدمة','Settlement model':'نموذج التسوية',
    'Avg response time':'متوسط زمن الاستجابة','Use for (route-family recommendation)':'يُستخدم لـ (توصية حسب عائلة المسار)','Corporate self-service portal':'بوابة الخدمة الذاتية للشركات',
    'NDC version supported':'إصدار NDC المدعوم','NDC environment':'بيئة NDC','On-time performance band':'نطاق الالتزام بالمواعيد',
    // SOP
    'Code':'الرمز','Title':'العنوان','Purpose':'الغرض','Commands (optional)':'الأوامر (اختياري)','Procedure':'الإجراء','Saudi market standard':'المعيار السوقي السعودي','Direct Business edge':'ميزة Direct Business'
  };
  Object.keys(MODAL_AR).forEach(function(k){ if(V27_AR[k]===undefined) V27_AR[k]=MODAL_AR[k]; });
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
  /* 2026-09-18 (fire #86, found by driving the lead-edit form live in Arabic): the form was HALF
     translated — 11 of its 24 labels and every one of its 8 placeholders stayed English, so a person
     working in Arabic read a form in two languages. Two reasons, both structural rather than an
     oversight:
       · the communication-channel chips are <label><input type=checkbox>Email</label>, and the label
         pass above deliberately skips a label that wraps an input (that rule is what stops free text
         being flattened). The chips are a fixed enum whose STORED value is the value attribute, never
         the text, so their wording is safe to translate on its own narrow pass;
       · placeholders are attributes, and this file only ever patched one of them (#gsearch, by id).
     The activity-type options (Call / Meeting / Note …) are NOT touched and must not be: they carry no
     value attribute, so their text IS what gets stored — the universal rule in the option pass below.
     Both passes here are whole-string and remember the English for a clean switch back. */
  /* ---- Hover words and screen-reader labels (2026-09-24, fire #254). `title` and `aria-label` are
     attributes, like placeholders, and this file never touched them: in Arabic every tooltip on the
     Leads table ("Individual using a company email - check", "WhatsApp"), the Reports table ("Select
     all in view", "Open the lead to change stage", "Lead score 7"), the top bar's icon buttons
     ("Toggle language", "Open command palette", "Show keyboard shortcuts", "Open menu", "Menu") and the
     generic "Icon button" a screen reader is handed stayed English — 23 of them counted across the
     layers. Same shape as PLACEHOLDER_AR: exact text → Arabic, the English kept on the element so the
     flip back restores it. TITLE_PREFIX_ATTR_AR covers the two that carry a value after a fixed
     prefix. Brand names (WhatsApp) and format names keep their own, as everywhere else in this file. */
  var TITLE_AR={
    'Android app':'تطبيق أندرويد','iOS app':'تطبيق iOS','Command palette':'لوحة الأوامر',
    'FX rate to SAR':'سعر الصرف إلى الريال','File upload':'رفع ملف','Hide password':'إخفاء كلمة المرور',
    'Show password':'إظهار كلمة المرور','Icon button':'زر','Import backup file':'استيراد ملف نسخة احتياطية',
    'Import full state JSON':'استيراد ملف الحالة الكاملة (JSON)','Input':'حقل إدخال',
    'Individual using a company email - check':'فرد يستخدم بريد شركة — تحقّق','Menu':'القائمة',
    'Open menu':'فتح القائمة','Open the lead to change stage':'افتح العميل المحتمل لتغيير المرحلة',
    'Primary navigation':'التنقّل الرئيسي','Select all in view':'تحديد كل المعروض',
    'Switch view preset':'تبديل إعداد العرض','Toggle language':'تبديل اللغة',
    'Open command palette':'فتح لوحة الأوامر','Show keyboard shortcuts':'عرض اختصارات لوحة المفاتيح',
    'What is this section?':'ما هذا القسم؟',
    'How hot this lead is (Hot / Warm / Cool / Cold). Click to sort — work the hottest first.':'مدى سخونة هذا العميل المحتمل (ساخن / دافئ / فاتر / بارد). انقر للفرز — ابدأ بالأسخن.',
    'Client health — Good / Watch / At risk. Click to surface at-risk clients.':'صحة العميل — جيد / مراقبة / في خطر. انقر لإبراز العملاء في خطر.'
  };
  var TITLE_PREFIX_ATTR_AR={'Lead score ':'درجة العميل المحتمل ','Source of truth: ':'مصدر الحقيقة: '};
  function arAttrWord(t){
    if(TITLE_AR[t]!==undefined) return TITLE_AR[t];
    for(var pre in TITLE_PREFIX_ATTR_AR){ if(t.indexOf(pre)===0) return TITLE_PREFIX_ATTR_AR[pre]+t.slice(pre.length); }
    return undefined;
  }
  function translateTitles(scope){
    if(!scope)return;
    var ATTRS=['title','aria-label'],a;
    for(a=0;a<ATTRS.length;a++){
      var attr=ATTRS[a], mark='data-v27'+(attr==='title'?'ttl':'al')+'en';
      var els=scope.querySelectorAll('['+attr+']'),i;
      /* no "already marked, skip" here: core-06's labeller writes "Open menu" onto the menu button
         30 ms after EVERY render, on top of the Arabic this pass had set — a marked element whose
         value is English again is simply translated again, and the mark keeps the newest English.
         An element whose value is Arabic is not in the map and falls through untouched. */
      for(i=0;i<els.length;i++){ var el=els[i];
        var t=el.getAttribute(attr); if(!t)continue; var ar=arAttrWord(t.trim());
        if(ar===undefined)continue; el.setAttribute(mark,t); el.setAttribute(attr,ar); }
    }
  }
  function restoreTitles(){
    var pairs=[['title','data-v27ttlen'],['aria-label','data-v27alen']],p;
    for(p=0;p<pairs.length;p++){ var els=document.querySelectorAll('['+pairs[p][1]+']'),i;
      for(i=0;i<els.length;i++){ var el=els[i]; el.setAttribute(pairs[p][0],el.getAttribute(pairs[p][1])); el.removeAttribute(pairs[p][1]); } }
  }
  /* ---- Pop-up notices (2026-09-24, fire #256). core-06's toast() is the one box every layer uses for
     "done" / "could not" after an action — 31 of its texts were written in English only, in the core
     files and js/02: "Please write what was achieved.", "Idle lock enabled · 5 min", "Backup
     destination set: …", "Offer created from …", "Invoice marked paid · …". They are the last thing a
     person reads after pressing a button. Same shape as the other dictionaries in this file: exact
     text, or a fixed head with a value after it (TOAST_HEAD_AR), or a value in the middle
     (TOAST_PATTERN_AR). The single wrapper below translates at the moment of showing, so the callers
     stay as they are and no second copy of a message exists anywhere. */
  var TOAST_AR={
    'Wrong passphrase':'عبارة المرور غير صحيحة',
    'Ticket added (auto-defaults from booking)':'أُضيفت التذكرة (قيم افتراضية من الحجز)',
    'Test records cleared':'حُذفت سجلات الاختبار',
    'Team & Access':'الفريق والصلاحيات',
    'Storage full - export a backup! Changes not saved to disk.':'الذاكرة ممتلئة — صدّر نسخة احتياطية! لم تُحفظ التغييرات على القرص.',
    'Retry succeeded':'نجحت إعادة المحاولة',
    'Replayed':'أُعيد التشغيل',
    'Please write what was achieved.':'اكتب ما تم إنجازه من فضلك.',
    'Idle lock enabled · 5 min':'قفل الخمول مفعّل · 5 دقائق',
    'Idle lock disabled':'قفل الخمول معطّل',
    'Exported':'تم التصدير',
    'Enter a custom path':'أدخل مسارًا مخصصًا',
    'Copied results JSON':'نُسخت نتائج JSON',
    'Chain re-confirmed today':'أُعيد تأكيد السلسلة اليوم',
    'Booking created from offer':'أُنشئ الحجز من العرض',
    'Already a project':'مشروع بالفعل',
    'Allow pop-ups to open the proposal':'اسمح بالنوافذ المنبثقة لفتح العرض'
  };
  var TOAST_HEAD_AR={
    'Test OK — ':'الاختبار ناجح — ','Tagged: ':'وُسِم: ','Source accepted · ':'قُبل المصدر · ',
    'Pending sync to ':'بانتظار المزامنة مع ','Offer created from ':'أُنشئ العرض من ','Logged: sent via ':'سُجّل: أُرسل عبر ',
    'Logged to ':'سُجّل في ','Invoice marked paid · ':'حُدّدت الفاتورة كمدفوعة · ','Hash chain repaired (':'أُصلحت سلسلة التجزئة (',
    'Force-sync done — ':'تمت المزامنة الإجبارية — ','Default term: ':'المدة الافتراضية: ',
    'Backup saved: ':'حُفظت النسخة الاحتياطية: ','Backup destination set: ':'تم تعيين وجهة النسخ الاحتياطي: ',
    /* fire #257: the backup screen's failure report is a notice (error kind) — the same head the
       alert fallback uses */
    'Backup: ':'النسخة الاحتياطية: '
  };
  var TOAST_PATTERN_AR=[
    [/^Noted (.+) as preferred$/, function(m){ return 'سُجّل '+m[1]+' كمفضّل'; }],
    [/^Added (.+) to preferred$/, function(m){ return 'أُضيف '+m[1]+' إلى المفضّلة'; }]
  ];
  function toastWord(msg){
    var t=String(msg==null?'':msg);
    if(TOAST_AR[t]!==undefined) return TOAST_AR[t];
    /* a known detail sentence after the head (the backup screen's, fire #257) is translated too */
    for(var h in TOAST_HEAD_AR){ if(t.indexOf(h)===0){ var tail=t.slice(h.length); return TOAST_HEAD_AR[h]+((typeof ALERT_DETAIL_AR!=='undefined'&&ALERT_DETAIL_AR[tail]!==undefined)?ALERT_DETAIL_AR[tail]:tail); } }
    for(var i=0;i<TOAST_PATTERN_AR.length;i++){ var m=t.match(TOAST_PATTERN_AR[i][0]); if(m) return TOAST_PATTERN_AR[i][1](m); }
    return undefined;
  }
  /* the word this file would show for a notice — for probes and for any layer that wants to ask */
  window.v27ToastWord=function(msg){ try{ if(!(typeof LANG!=='undefined'&&LANG==='ar')) return msg; var w=toastWord(msg); return w===undefined?msg:w; }catch(_){ return msg; } };
  try{
    if(typeof window.toast==='function'&&!window.toast.__v27){
      var _toast=window.toast;
      var wrapped=function(msg,kind){ return _toast.call(this, window.v27ToastWord(msg), kind); };
      wrapped.__v27=1; window.toast=wrapped;
    }
  }catch(_){}
  /* ---- Reports and questions (2026-09-24, fire #257). Twenty sentences the fire-#88 probe could not
     see because they are not bare literals: a fixed head with the detail after it — alert('Could not
     delete: '+e), alert('Backup: '+msg), alert('Export failed: '+…), alert('Invalid file: '+…) — and the
     questions the app asks in its own box — v18Ask('Set a passphrase …'), v18Ask('Move to dunning
     stage? '), v18Ask('Tag name? (e.g. …'), pfPrompt('Copy the offer:'). A report of a failure is the
     one message a person reads most carefully, and these read English in Arabic. Same shape as the
     notices above: exact texts and fixed heads, one word function, and the wrappers below. The alert
     wrapper is put on LATE, after js/63 has replaced window.alert with its in-page card, so the card
     draws the Arabic (a wrap put on before js/63 would translate only the native fallback). */
  var ALERT_HEAD_AR={
    'Export failed: ':'فشل التصدير: ','Could not delete: ':'تعذّر الحذف: ','Could not restore: ':'تعذّرت الاستعادة: ',
    'Saved template: ':'حُفظ القالب: ','Backup: ':'النسخة الاحتياطية: ','Invalid file: ':'ملف غير صالح: ',
    'Logged to ':'سُجّل في ','Logged: ':'سُجّل: ','PPTX generation failed: ':'فشل إنشاء ملف PPTX: ','Conflict ':'تعارض '
  };
  var ASK_AR={
    'Save as bundle template — name?':'حفظ كقالب حزمة — الاسم؟',
    'Set a passphrase (privacy screen — NOT auth):':'عيّن عبارة مرور (شاشة خصوصية — ليست مصادقة):',
    'Copy the offer:':'نسخ العرض:'
  };
  var ASK_HEAD_AR={'Tag name? (e.g. ':'اسم الوسم؟ (مثال: ','Move to dunning stage? ':'الانتقال إلى مرحلة التحصيل؟ '};
  /* the detail after a head is usually a value (a file name, a count) — but the backup screen passes
     a sentence of its own, so a translated head with an English tail would be half a message */
  var ALERT_DETAIL_AR={
    'could not load the backup list':'تعذّر تحميل قائمة النسخ الاحتياطية',
    'no Supabase connection — cannot restore':'لا يوجد اتصال بقاعدة البيانات — لا يمكن الاستعادة',
    'that snapshot has no data — nothing was restored':'هذه اللقطة لا تحتوي بيانات — لم يُستعد شيء',
    'could not fetch that snapshot — nothing was restored':'تعذّر جلب تلك اللقطة — لم يُستعد شيء'
  };
  function alertWord(msg){
    var t=String(msg==null?'':msg);
    if(ASK_AR[t]!==undefined) return ASK_AR[t];
    var h;
    for(h in ALERT_HEAD_AR){ if(t.indexOf(h)===0){ var tail=t.slice(h.length); return ALERT_HEAD_AR[h]+(ALERT_DETAIL_AR[tail]!==undefined?ALERT_DETAIL_AR[tail]:tail); } }
    for(h in ASK_HEAD_AR){ if(t.indexOf(h)===0) return ASK_HEAD_AR[h]+t.slice(h.length); }
    return undefined;
  }
  window.v27AlertWord=function(msg){ try{ if(!(typeof LANG!=='undefined'&&LANG==='ar')) return msg; var w=alertWord(msg); return w===undefined?msg:w; }catch(_){ return msg; } };
  (function lateWraps(n){
    try{ if(typeof window.v18Ask==='function'&&!window.v18Ask.__v27){ var _ask=window.v18Ask; var wa=function(q,def,cb){ return _ask.call(this,window.v27AlertWord(q),def,cb); }; wa.__v27=1; window.v18Ask=wa; } }catch(_){}
    try{ if(typeof window.pfPrompt==='function'&&!window.pfPrompt.__v27){ var _pp=window.pfPrompt; var wp=function(msg,def,cb){ return _pp.call(this,window.v27AlertWord(msg),def,cb); }; wp.__v27=1; window.pfPrompt=wp; } }catch(_){}
    try{ if(window.__nativeAlert&&typeof window.alert==='function'&&!window.alert.__v27){ var _al=window.alert; var wl=function(m){ return _al.call(window,window.v27AlertWord(m)); }; wl.__v27=1; window.alert=wl; } }catch(_){}
    var done=false; try{ done=!!(window.v18Ask&&window.v18Ask.__v27&&window.pfPrompt&&window.pfPrompt.__v27&&window.alert&&window.alert.__v27); }catch(_){}
    if(!done&&(n||0)<80) setTimeout(function(){ lateWraps((n||0)+1); },300);
  })(0);
  /* ---- The question before the act (2026-09-25, fire #258). Twelve yes/no questions asked through
     askInPage / pfConfirm — the words in front of the Confirm button that deletes, archives or resets
     something — were written in English only: "Delete this invoice?", "Archive this booking? (soft
     delete — restorable)", "Reset all data to the seeded version? …", "Import this file? …". Same
     shape as the notices and reports above: exact texts, a few patterns with a value in the middle,
     and one wrapper on pfConfirm (the box every such question goes through), put on late once js/57
     has defined it. */
  var CONFIRM_AR={
    'Delete this achievement?':'حذف هذا الإنجاز؟',
    'Delete this booking?':'حذف هذا الحجز؟',
    'Delete this invoice?':'حذف هذه الفاتورة؟',
    'Delete this bundle template?':'حذف قالب الحزمة هذا؟',
    'Delete this tagged backup?':'حذف هذه النسخة الاحتياطية الموسومة؟',
    'Archive this invoice? (soft delete — restorable)':'أرشفة هذه الفاتورة؟ (حذف ناعم — يمكن الاستعادة)',
    'Archive this booking? (soft delete — restorable)':'أرشفة هذا الحجز؟ (حذف ناعم — يمكن الاستعادة)',
    'Reset all data to the seeded version? Edits will be lost. Leads and clients are kept as they are.':'إعادة ضبط كل البيانات إلى النسخة الأولية؟ ستُفقد التعديلات. العملاء المحتملون والعملاء يبقون كما هم.',
    "Import this file? Settings and records are replaced by the file's. Leads and clients are NOT imported — they stay exactly as they are.":'استيراد هذا الملف؟ ستُستبدل الإعدادات والسجلات بمحتوى الملف. العملاء المحتملون والعملاء لا يُستوردون — يبقون كما هم تمامًا.'
  };
  var CONFIRM_PATTERN_AR=[
    [/^Archive (\d+) invoice\(s\)\?$/, function(m){ return 'أرشفة '+m[1]+' فاتورة/فواتير؟'; }],
    [/^Archive project (.+)$/, function(m){ return 'أرشفة المشروع '+m[1]; }],
    [/^Create credit note against (.+)$/, function(m){ return 'إنشاء إشعار دائن مقابل '+m[1]; }],
    [/^Archive (.+)$/, function(m){ return 'أرشفة '+m[1]; }]
  ];
  function confirmWord(msg){
    var t=String(msg==null?'':msg);
    if(CONFIRM_AR[t]!==undefined) return CONFIRM_AR[t];
    for(var i=0;i<CONFIRM_PATTERN_AR.length;i++){ var m=t.match(CONFIRM_PATTERN_AR[i][0]); if(m) return CONFIRM_PATTERN_AR[i][1](m); }
    return undefined;
  }
  window.v27ConfirmWord=function(msg){ try{ if(!(typeof LANG!=='undefined'&&LANG==='ar')) return msg; var w=confirmWord(msg); return w===undefined?msg:w; }catch(_){ return msg; } };
  (function lateConfirmWrap(n){
    try{ if(typeof window.pfConfirm==='function'&&!window.pfConfirm.__v27){ var _pc=window.pfConfirm; var wc=function(msg,onYes){ return _pc.call(this,window.v27ConfirmWord(msg),onYes); }; wc.__v27=1; window.pfConfirm=wc; return; } }catch(_){}
    if((n||0)<80) setTimeout(function(){ lateConfirmWrap((n||0)+1); },300);
  })(0);
  window.v27AttrWord=function(en){ try{ if(!(typeof LANG!=='undefined'&&LANG==='ar')) return en; var k=String(en==null?'':en); var ar=arAttrWord(k); return ar===undefined?k:ar; }catch(_){ return en; } };
  var PLACEHOLDER_AR={
    // fire #249 — the example hints on the same forms
    /* fire #255 (2026-09-24) — the hints the form sweep (#249) did not reach: the airline and provider
       editors' rule and source hints, the corporate-deal rows, the offer editor's item and freebie
       hints and its tier rows, the booking editor's source, the onboarding form's people rows, the
       team dialog, the lead page's quick note and the Events filter. 22 words; codes and brand
       names (A320, RUH-LHR-RUH, Y / J, Amadeus / Duffel, Light / Flex / Business, SV-1234567,
       DIRECT10, SA…, name@directksa.com, a Drive address, "P1 < 1h", "% Δ") stay as they are —
       they read the same in both languages. */
    'Same-day before cut-off':'في نفس اليوم قبل الموعد النهائي',
    'Fare diff + penalty':'فرق السعر + غرامة',
    'Per fare rules; penalty':'حسب شروط التعرفة؛ غرامة',
    'Original method / airline wallet':'طريقة الدفع الأصلية / محفظة شركة الطيران',
    'BSP / card / credit / wallet':'BSP / بطاقة / آجل / محفظة',
    'GDS / NDC / Direct portal / Aggregator (Travel Fusion)':'GDS / NDC / بوابة مباشرة / مجمّع (Travel Fusion)',
    'GDS / NDC / OTA / Direct':'GDS / NDC / OTA / مباشر',
    'Duffel → short-haul EU LCCs':'Duffel → الرحلات القصيرة لشركات الطيران الاقتصادية في أوروبا',
    'Role':'الدور / المنصب',
    'Tour/Acct code':'رمز Tour/Acct',
    'Discount':'الخصم',
    'Notes (min vol, blackout)':'ملاحظات (الحد الأدنى للحجم، فترات الحظر)',
    'Markup / fee':'هامش / رسوم',
    'detail / vendor / pax':'التفاصيل / المورّد / الركاب',
    'price':'السعر',
    'e.g. airport transfer / upgrade':'مثال: نقل من المطار / ترقية',
    'our cost':'تكلفتنا',
    'from':'من','to':'إلى','threshold':'الحد','suggest…':'اقتراح…',
    'What happened?':'ماذا حدث؟',
    'passphrase':'عبارة المرور',
    'ID number':'رقم الهوية','Passport':'جواز السفر',
    'Full name':'الاسم الكامل',
    'Search name, city, venue…':'ابحث بالاسم أو المدينة أو المكان…',
    'account / deeplink / agreement':'حساب / رابط مباشر / اتفاقية',
    'version / status / contact':'الإصدار / الحالة / جهة الاتصال',
    'e.g. Mr. Mohammed Almasar (2 pax)':'مثال: السيد محمد المسار (راكبان)',
    'e.g. Riyadh Investment Summit':'مثال: قمة الرياض للاستثمار',
    'Optional context — e.g. excludes peak season':'سياق اختياري — مثال: باستثناء موسم الذروة',
    'One-paragraph framing of the project':'فقرة واحدة تُؤطّر المشروع',
    'e.g. 065 (Saudia)':'مثال: 065 (السعودية)','GDS / Hotels / eSIM / Payments':'نظام توزيع / فنادق / eSIM / مدفوعات',
    'Saudia':'السعودية','Air ticket / hotel / service':'تذكرة طيران / فندق / خدمة',
    'Name':'الاسم','Email':'البريد الإلكتروني','Phone':'الهاتف',
    'Government / Study-abroad school…':'جهة حكومية / معهد دراسة بالخارج…',
    'Flights, Hotels, Visa, Insurance, Intl driving permit…':'طيران، فنادق، تأشيرات، تأمين، رخصة سياقة دولية…',
    'e.g. Called Mr. Nasser — interested, sending the proposal Sunday':'مثال: تحدّثت مع الأستاذ ناصر — مهتم، سنرسل العرض الأحد',
    /* 2026-09-18 (fire #87) — the prose hints found by opening every dialog in Arabic. The supplier
       form's own hints are NOT here on purpose: 320ms, P1 < 1h, BSP / card / credit / wallet,
       GDS / NDC / Direct portal / Aggregator (Travel Fusion) and the rest are the airline and GDS
       vocabulary this team works in, and an IBAN's "SA…" and a link's "https://…" are not words. */
    'Type or pick a business':'اكتب أو اختر منشأة',
    'e.g. 50,000 SAR/mo':'مثال: 50,000 ريال/شهر','e.g. 2% / month':'مثال: 2% شهريًا',
    'filename or URL':'اسم الملف أو الرابط',
    /* Finance and Ops hints. The code examples keep their codes: a GDS list, a ticket number pair and a
       VAT-number shape are not words, and "BSP-SA-2026-W22" is a real reference format. */
    'e.g. BSP-SA-2026-W22':'مثال: BSP-SA-2026-W22',
    '250 SAR + 50%':'250 ريال + 50%','150 SAR + fare diff':'150 ريال + فرق الأجرة',
    'Direct Payments / bank txn ID':'Direct Payments / معرّف عملية البنك',
    /* the corporate profile's own prose hints (fire #88) */
    'Air, hotel, transfer, visa':'طيران، فندق، نقل، تأشيرة',
    'Pre-paid / Post-paid 30d':'دفع مسبق / آجل 30 يومًا',
    'Quote ≤4h · 24/7':'عرض سعر خلال 4 ساعات · على مدار الساعة',
    'Cabin rules, preferred carriers/hotels, approval workflow, who may book…':'قواعد الدرجة، الناقلون والفنادق المفضّلة، مسار الموافقات، من يحق له الحجز…'
  };
  var CHANNEL_AR={ 'Email':'البريد','Phone':'الهاتف','Portal':'البوابة','In person':'حضور شخصي','Tender portal':'بوابة المناقصات' };
  /* 2026-09-18 (fire #87): fire #86 fixed one form; opening all 23 dialogs in Arabic showed the same
     three failures spread across the app, plus a fourth this file had no mechanism for — a dialog
     TITLE of the shape "<English prefix> — <the record's own name>". The whole string never matched a
     dictionary entry (it carries live data), and translateDecorated only strips a TRAILING decoration,
     so "Log activity — <company>" and "Chain of command - <company>" stayed English on every dialog
     that names its record. Only the prefix is translated here, split on the first em-dash or hyphen
     separator, and the name after it is never touched — the same care the rest of this file takes
     about never translating business data.
     NOT translated, deliberately, and measured as such: a lead's or client's own dialog title (it IS
     the company name, nothing else), the WhatsApp chip, the supplier form's EMD chip, and that form's
     seven hints — 320ms, P1 < 1h, BSP / card / credit / wallet, GDS / NDC / Direct portal /
     Aggregator (Travel Fusion) and the rest are the airline and GDS vocabulary this team works in;
     rendering them in Arabic would make them harder to read, not easier. */
  var TITLE_WHOLE_AR={
    'Sync log':'سجل المزامنة','Browse backup snapshots':'استعراض النسخ الاحتياطية',
    'ZATCA hash-chain integrity report':'تقرير سلامة سلسلة التجزئة (هيئة الزكاة)','New provider':'مورّد جديد'
  };
  var TITLE_PREFIX_AR={
    'Log activity':'تسجيل نشاط','Chain of command':'التسلسل الإداري',   /* fire #225 — one wording */
    '🏛 Client onboarding':'🏛 تسجيل عميل جديد','Client onboarding':'تسجيل عميل جديد',
    'Record payment':'تسجيل دفعة','Corporate profile':'الملف المؤسسي',
    /* only visible once the dialog opens, and it never opens against live data — there are 0 invoices,
       and genStatementOfAccount says "no invoices for this client" and returns before building it */
    'Statement of account':'كشف حساب'
  };
  /* "Edit INV-3001" / "Edit BK-2001" — a prefix and a reference, separated by nothing but a space. The
     word alone is far too common to translate on sight, so the remainder must LOOK like a reference:
     capitals, digits and dashes only. "Edit client profile (full form)" and anything else wordy is
     left alone by that test. */
  var REF_TITLE=/^(Edit|Record payment) ([A-Z][A-Z0-9]*-[A-Za-z0-9-]+)$/;
  var REF_VERB_AR={ 'Edit':'تعديل','Record payment':'تسجيل دفعة' };
  function translateDialogTitle(scope){
    if(!scope)return;
    var h=scope.querySelector('.mh h3'); if(!h||h.getAttribute('data-v27'))return;
    var t=(h.textContent||'').trim(); if(!t)return;
    if(TITLE_WHOLE_AR[t]!==undefined){ setText(h,TITLE_WHOLE_AR[t]); return; }
    /* Match the KNOWN prefixes against the start of the title, rather than splitting on the first
       separator: "Chain of command - Mawani — Saudi Ports Authority" separates with a hyphen and then
       contains an em-dash inside the company's own name, so splitting on the first em-dash produced
       the prefix "Chain of command - Mawani" and matched nothing. Measured, fixed, re-measured. */
    var keys=Object.keys(TITLE_PREFIX_AR),i;
    for(i=0;i<keys.length;i++){
      var pre=keys[i], seps=[' — ',' - '],s;
      for(s=0;s<seps.length;s++){
        if(t.indexOf(pre+seps[s])!==0)continue;
        setText(h,TITLE_PREFIX_AR[pre]+' — '+t.slice(pre.length+seps[s].length));
        return;
      }
    }
    var ref=t.match(REF_TITLE);
    if(ref&&REF_VERB_AR[ref[1]]!==undefined){ setText(h,REF_VERB_AR[ref[1]]+' '+ref[2]); return; }
    /* a title that is only the record's own name is left exactly as it is */
  }
  function translatePlaceholders(scope){
    if(!scope)return;
    var ins=scope.querySelectorAll('input[placeholder],textarea[placeholder]'),i;
    for(i=0;i<ins.length;i++){ var el=ins[i]; if(el.hasAttribute('data-v27phen'))continue;
      var t=el.getAttribute('placeholder'); if(!t)continue; var ar=PLACEHOLDER_AR[t.trim()];
      if(ar===undefined)continue; el.setAttribute('data-v27phen',t); el.setAttribute('placeholder',ar); }
  }
  function translateChannelChips(scope){
    if(!scope)return;
    /* only the chips this app generates for the channel enum — found by their own class, so no
       other label that happens to wrap a checkbox is ever reached. WhatsApp keeps its own name. */
    var boxes=scope.querySelectorAll('label > input.f_ch'),i;
    for(i=0;i<boxes.length;i++){ var lab=boxes[i].parentNode; if(!lab||lab.getAttribute('data-v27'))continue;
      var t=(lab.textContent||'').trim(); var ar=CHANNEL_AR[t]; if(ar===undefined)continue;
      lab.setAttribute('data-v27en',t); replaceLeadText(lab,ar); lab.setAttribute('data-v27','1'); }
  }
  function restorePlaceholders(){
    var ins=document.querySelectorAll('[data-v27phen]'),i;
    for(i=0;i<ins.length;i++){ var el=ins[i]; if(el.id==='gsearch')continue;   // that one has its own pair
      el.setAttribute('placeholder',el.getAttribute('data-v27phen')); el.removeAttribute('data-v27phen'); }
  }
  function scopeTranslate(scope,safeOptions){
    if(!scope)return;
    translatePlaceholders(scope); translateChannelChips(scope); translateDialogTitle(scope); translateTitles(scope);
    var heads=scope.querySelectorAll('th,h2,h3'),i;
    for(i=0;i<heads.length;i++){ var hd=heads[i]; if(hd.getAttribute('data-v27')||hd.querySelector('input,select'))continue; translateDecorated(hd,V27_AR); }
    // label / summary / .ch-sub added 2026-09-02 for the proposal editor — whole-string matches only,
    // and a label wrapping an input/select/textarea is skipped, so free text is never touched
    // .empty added 2026-09-02 (round 24) for the Reports empty states — whole-string matches only
    var els=scope.querySelectorAll('.kl,.l,button,a.btn,.chiplink,.tag,label,summary,.ch-sub,.empty,.sub-h,.fopflag,.bk-nocost-note'),j;   // .chiplink added 2026-09-10: the card's Direct Payments chip and the Providers rows' "Open ›" are chrome, not data
    for(j=0;j<els.length;j++){ var el=els[j]; if(el.getAttribute('data-v27')||el.querySelector('input,select,textarea'))continue; translateDecorated(el,V27_AR); }
    // fact-row labels (.fact > .k) added 2026-09-02 for the Reference drill-downs — the label half of
    // a key/value row only, whole-string matches only, and a label that wraps markup (a tag pill in
    // the ADM-risk distribution, say) is skipped so the pill is never flattened to text
    var fk=scope.querySelectorAll('.fact>.k'),f;
    for(f=0;f<fk.length;f++){ var kl=fk[f]; if(kl.getAttribute('data-v27')||kl.children.length)continue; translateDecorated(kl,V27_AR); }
    // 2026-09-24 (Build lane sweep, driven live in Arabic): the card's Category row read «الفئة»
    // over the English "Anchor" — a word this file already carries. Category is a list the app
    // itself offers (CATEGORIES in core-02), so its value is the app's own vocabulary (M58) and
    // only THOSE words are translated here; any other .fact value is a person's data and stays.
    var CATS=(typeof CATEGORIES!=='undefined'&&Array.isArray(CATEGORIES))?CATEGORIES:['Anchor','Convert','Re-engage','Dormant','Vendor','Partner'];
    var fv=scope.querySelectorAll('.fact>.v'),fvi;
    for(fvi=0;fvi<fv.length;fvi++){ var vl=fv[fvi]; if(vl.getAttribute('data-v27')||vl.children.length)continue; var vt=(vl.textContent||'').trim(); if(CATS.indexOf(vt)<0||!V27_AR[vt])continue; translateDecorated(vl,V27_AR); }
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
      /* 2026-09-21 (fire #150): and the SECOND column with them. "What lives there" was English on
         the Arabic side for all nine rows — the area name was translated and the sentence next to
         it was not, which reads worse than leaving both. Safe here for the same reason the line
         above is: on this page a <td> is chrome, not a record. Whole-string matches only, so
         anything not in the dictionary is left exactly as it is. */
      var sd=scope.querySelectorAll('td'),sdi;
      for(sdi=0;sdi<sd.length;sdi++){ var nd=sd[sdi]; if(nd.getAttribute('data-v27')||nd.children.length)continue; translateDecorated(nd,V27_AR); }
      /* The six "Open" buttons read «مفتوحة» — "open" as a STATE, because one dictionary serves the
         whole app and a ticket status claimed the word first ('Open':'مفتوحة', with Used and
         Refunded beside it). Here it is an instruction, so it is «فتح». The English is already
         remembered on the element by the pass above, so switching back restores it. */
      var sl=scope.querySelectorAll('a.btn[data-v27en="Open"]'),sli;
      for(sli=0;sli<sl.length;sli++){ sl[sli].textContent='فتح'; }
      var note=scope.querySelector('.note.v29-connections');
      if(note&&!note.getAttribute('data-v27')){ var nt=(note.textContent||'').replace(/\s+/g,' ').trim(); if(V27_AR[nt]!==undefined){ note.setAttribute('data-v27en',nt); note.textContent=V27_AR[nt]; note.setAttribute('data-v27','1'); } }
    }
    // dropdown options: main dict, then stage words (safe — options are filter values, not data)
    var opts=scope.querySelectorAll('option'),o;
    for(o=0;o<opts.length;o++){ var op=opts[o]; if(op.getAttribute('data-v27'))continue;
      /* An <option> with NO value attribute is stored BY ITS TEXT — `this.value` returns the
         label — so translating it saves an Arabic word as data.
         Round 26 applied this rule to dialogs only, on the assumption recorded in the old
         comment here that in-page options are "filter values, not data". That assumption was
         wrong: the proposal editor is a FORM rendered inside #view, and its type / status /
         policy / approval / refundable selects are all value-less
         (`<option ${it.type===t?'selected':''}>` in js/core/core-04-proposals.js). With
         'Other' in the dictionary below, an Arabic user picking it stored "أخرى" as the
         service-bundle type. Found 2026-09-02 (round 28) by the eight-area sweep and confirmed
         in source. The rule is now universal: no value attribute → never translated, in ANY
         scope. A dropdown whose wording should read Arabic must carry an explicit value. */
      if(!op.hasAttribute('value'))continue;
      var ot=(op.textContent||'').trim(); if(!ot)continue;
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
  /* 2026-09-03 (search attack round): both placeholders used to promise "everything" / "كل شيء".
     The index carries leads, clients, requests, airlines, providers and SOPs — and nothing from
     Finance: an invoice number, a transaction or an expense returns zero results. Name what it
     really searches rather than promising what it does not. */
  var GSEARCH_PLACEHOLDER_AR='ابحث في العملاء المحتملين والعملاء والطلبات وشركات الطيران والموردين والإجراءات';
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
        restorePlaceholders(); restoreTitles();
        patchGlobalSearchPlaceholder(false);
        patchSkipLinks(false);
        return;
      }
      scopeTranslate(document.getElementById('view'));
      scopeTranslate(document.querySelector('.top'));
      /* fire #254: the shell's own labelled controls outside #view and .top (the phone menu button, the sidebar nav) */
      translateTitles(document.body);
      patchGlobalSearchPlaceholder(true);
      patchSkipLinks(true);
    }catch(e){ if(window.console)console.warn('[v27] ar-translate',e); }
  }
  window.v27ArHeaders=v27ArHeaders;
  /* 2026-09-23 (fire #229): one word, one owner. This file translates a cell AFTER it is drawn, so
     a renderer that needs to know what its own cell will SAY — a sorter ordering by what the reader
     sees (M75) — had no way to ask, and the only alternative was a second copy of these words
     somewhere else, which is the M38 family of bugs. Same reasoning as __STAGE_AR and
     __OPS_STAGE_AR above, generalised: ask here, get the word this file will paint. Returns the
     English unchanged when the page is English, or when the dictionary has never heard of it. */
  window.v27Word=function(en){
    try{
      var k=String(en==null?'':en);
      if(!(typeof LANG!=='undefined'&&LANG==='ar')) return k;
      return (V27_AR[k]!==undefined&&V27_AR[k]!=='')?V27_AR[k]:k;
    }catch(_){ return en; }
  };
  // ---- Dialogs (2026-09-02, attack round 26): every modal form (Log activity, New request, New
  // business, airline/provider edit, New SOP …) was English in Arabic because this file only ever
  // scanned #view and .top — the dialog overlay lives beside them. Wrap the dialog opener once and
  // run the same pass on the dialog, with the safe-options rule above. ----
  function translateModal(){
    try{ if(typeof LANG==='undefined'||LANG!=='ar')return; var m=document.getElementById('modal')||document.getElementById('ov'); if(!m)return; scopeTranslate(m,true); }catch(e){ if(window.console)console.warn('[v27] modal',e); }
  }
  window.v27TranslateModal=translateModal;
  try{ if(typeof window.openModal==='function'&&!window.openModal.__v27){ var _om=window.openModal; var w=function(){ var out=_om.apply(this,arguments); translateModal(); setTimeout(translateModal,80); return out; }; w.__v27=1; window.openModal=w; } }catch(_){}
  /* 2026-09-18 (fire #86): the contact rows are the one part of a dialog that is rebuilt AFTER the
     dialog's own pass — core-05's openModal calls drawContacts(), core-02 calls it again with the
     company's people, and addContactRow() and the ✕ call it on every add and remove. Each rebuild
     replaces the inputs with fresh English ones, so the pass above translated rows that no longer
     existed: measured live, calling the translator by hand right afterwards produced الاسم / البريد
     الإلكتروني / الهاتف, which is how this was identified as timing rather than matching. Wrapping
     the redraw is what makes it hold — including after somebody adds or deletes a row. */
  (function wrapDrawContacts(n){
    try{
      if(typeof window.drawContacts==='function'&&!window.drawContacts.__v27){
        var _dc=window.drawContacts;
        var wd=function(){ var out=_dc.apply(this,arguments);
          try{ if(typeof LANG!=='undefined'&&LANG==='ar'){ var h=document.getElementById('contacts'); if(h){ translatePlaceholders(h); } } }catch(_){}
          return out; };
        wd.__v27=1; window.drawContacts=wd; return;
      }
    }catch(_){}
    if((n||0)<40)setTimeout(function(){ wrapDrawContacts((n||0)+1); },500);
  })(0);
  /* 2026-09-19 (fire #98): the pass above is hung on render(). A list that is REDRAWN without a
     render — which is what every search box and filter chip in the app does — writes fresh English
     headers straight over the Arabic ones, and nothing puts them back.
     Measured live on Leads, the busiest page, with the app in Arabic: before typing the headers read
     المنشأة / المرحلة / المسار / آخر نشاط / الإجراء التالي / المسؤول / الأولوية, and one keystroke in
     the search turned all seven into BUSINESS / STAGE / FUNNEL / LAST ACTIVITY / NEXT ACTION / OWNER
     / PRIORITY — still English six seconds later, and for the rest of the session.
     Fire #86 fixed exactly this shape for the contact rows by wrapping their redraw. Rather than
     chase the next one by hand, every drawer the app publishes is wrapped here: drawLeads,
     drawOffers, drawSupTable, drawTable and the rest. Debounced, because a search fires one redraw
     per keystroke and the pass walks the view. */
  (function wrapEveryDrawer(n){
    var timer=null;
    function later(){ if(timer)clearTimeout(timer); timer=setTimeout(function(){ timer=null; v27ArHeaders(); },60); }
    var names=[]; try{ for(var k in window){ if(/^draw[A-Z]/.test(k)&&typeof window[k]==='function') names.push(k); } }catch(_){}
    var wrapped=0;
    names.forEach(function(k){
      try{
        var f=window[k]; if(f.__v27draw) return;
        var w=function(){ var out=f.apply(this,arguments); try{ if(typeof LANG!=='undefined'&&LANG==='ar') later(); }catch(_){} return out; };
        w.__v27draw=1; try{ w.__v27=f.__v27; }catch(_){}
        window[k]=w; wrapped++;
      }catch(_){}
    });
    /* the drawers are defined by different layers at different times, so keep looking for a while */
    if((n||0)<40) setTimeout(function(){ wrapEveryDrawer((n||0)+1); },500);
    if(wrapped&&window.console&&!(n||0)) try{ console.info('%c[v27] re-translating after '+wrapped+' list redraws','color:#FF6B00'); }catch(_){}
  })(0);
  if(typeof render==='function'){ var _r27=render; window.render=function(){ var out=_r27.apply(this,arguments); v27ArHeaders(); setTimeout(v27ArHeaders,80); return out; }; }
  v27ArHeaders();
}catch(e){ if(window.console)console.warn('[v27] init',e); }})();
