/* js/73 — Arabic exports: column titles and enum values in the shared CSV/Excel exporters.
   Found in the 2026-09-02 attack loop (round 8): with the app in Arabic, every "Export ▾"
   file (Leads, Clients, Finance, Airlines, Providers, Ops, Offers, Events) came out with the
   raw field keys as column titles — nameAr, assignedTo, totalSAR, invoice_no — and English
   stage words / true-false in the cells, so an Arabic-speaking colleague opened a spreadsheet
   they could not read. The menu itself was already Arabic (core-06), which made it worse: an
   Arabic button producing an English-keyed file.

   How: the two shared exporters (core-05's downloadCSV / downloadXLS) take (name, rows,
   fields). In Arabic this layer re-keys each row by an Arabic title that keeps the original
   key in brackets — "الاسم (name)" — so the file stays readable to a person AND
   machine-recognisable (the importer's teach-once mapping and anyone matching on the key).
   Values: a lead's stage word comes from the same map the screens use (window.__STAGE_AR,
   js/21); true/false and Yes/No become نعم/لا. Nothing else in a cell is touched — company
   names, notes and numbers are data, never translated. English exports are byte-identical
   to before (the wrapper steps aside unless LANG==='ar'). Self-contained, try/catch,
   reversible: remove the script line and exports go back to raw keys. */
(function(){try{
  var LBL={
    // leads / clients (core-05 exportCurrent summary lists)
    name:'الاسم', nameAr:'الاسم (عربي)', area:'المنطقة', source:'المصدر', sourceSub:'المصدر الفرعي',
    stage:'المرحلة', assignedTo:'المسؤول', owner:'المسؤول', category:'الفئة', segment:'الشريحة',
    website:'الموقع الإلكتروني', contacts:'جهات الاتصال', linkedin:'لينكدإن', facebook:'فيسبوك',
    instagram:'إنستغرام', x_twitter:'إكس (تويتر)', tiktok:'تيك توك', youtube:'يوتيوب',
    licenceNumber:'رقم الترخيص', licenceStatus:'حالة الترخيص', mtActivity:'نشاط وزارة السياحة',
    verificationStatus:'حالة التحقق', outreachScore:'درجة التواصل', decisionMakers:'صنّاع القرار',
    totalSAR:'الإجمالي (ريال)', notes:'ملاحظات', tier:'الفئة', channels:'القنوات',
    convertedDate:'تاريخ التحويل', nextReview:'المراجعة القادمة', isClient:'عميل؟', funnel:'المسار',
    priority:'الأولوية', nextAction:'الإجراء التالي', nextActionDate:'تاريخ الإجراء التالي',
    email:'البريد', phone:'الهاتف', city:'المدينة', createdAt:'تاريخ الإنشاء', updatedAt:'آخر تحديث',
    // airlines / providers
    code:'الرمز', icao:'رمز ICAO', stock:'رمز التذاكر', ksa:'السعودية', ticketingAuthority:'صلاحية الإصدار',
    alliance:'التحالف', type:'النوع', country:'الدولة', gds:'GDS', providers:'الموردون', portal:'البوابة',
    verdict:'التقييم', apiStatus:'حالة الربط', settlement:'التسوية',
    // SOPs / SLAs / ops / offers
    title:'العنوان', purpose:'الغرض', event:'الحدث', direct:'Direct', market:'السوق', whale:'المعيار المرتفع',
    client:'العميل', service:'الخدمة', sell:'البيع', cost:'التكلفة', ref:'المرجع', date:'التاريخ',
    airline:'شركة الطيران', total:'الإجمالي', currency:'العملة', status:'الحالة',
    // finance ledger rows
    invoice_no:'رقم الفاتورة', invoice_date:'تاريخ الفاتورة', client_group:'العميل', service_type:'نوع الخدمة',
    total_incl_vat_sar:'الإجمالي (ريال)', revenue_sar:'الإيرادات (ريال)', cost_sar:'التكلفة (ريال)',
    profit_sar:'الربح (ريال)', amount_received_sar:'المُحصّل (ريال)', amount_remaining_sar:'المتبقي (ريال)',
    integrity_status:'حالة السلامة', revenue_way:'طريقة الإيراد', payment_status:'حالة الدفع',
    invoice_total_sar:'إجمالي الفاتورة (ريال)', zatca_dpin:'رقم DPIN', products:'البنود', origin:'المنشأ',
    proposal_ref:'مرجع العرض', month:'الشهر', quarter:'الربع', year:'السنة',
    // events (js/10 evExport builds display keys)
    'Event':'الفعالية', 'Event (AR)':'الفعالية (عربي)', 'Our move':'خطوتنا', 'Progress':'التقدم',
    'When':'البداية', 'Until':'النهاية', 'City':'المدينة', 'Venue':'المكان', 'Vertical':'القطاع',
    'Status':'الحالة', 'Priority':'الأولوية', 'Organiser':'المنظّم', 'Website':'الموقع الإلكتروني',
    'Companies list':'قائمة الشركات', 'Signed up by':'سجّل بواسطة', 'Sign-up email':'بريد التسجيل',
    'Leads in the app':'عملاء محتملون في التطبيق', 'Sales prospect':'فرصة بيع',
    'Competitor/partner':'منافس / شريك', 'Notes':'ملاحظات'
  };
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function label(k){ var l=LBL[k]; return l?(l+' ('+k+')'):k; }
  function val(k,v){
    if(v===true)return 'نعم'; if(v===false)return 'لا';
    if(v==='Yes')return 'نعم'; if(v==='No')return 'لا';
    if(k==='stage'&&typeof v==='string'){ try{ var m=window.__STAGE_AR; if(m&&m[v])return m[v]; }catch(_){} }
    return v;
  }
  function arabize(rows,fields){
    var labels=fields.map(label);
    var out=(rows||[]).map(function(r){ var o={}; fields.forEach(function(f,i){ o[labels[i]]=val(f, r?r[f]:''); }); return o; });
    return {rows:out, fields:labels};
  }
  function wrap(name){
    var orig=window[name]; if(typeof orig!=='function'||orig.__v73)return false;
    var w=function(fname,rows,fields){
      try{
        if(isAr()&&Array.isArray(fields)){ var a=arabize(rows,fields); return orig.call(this,fname,a.rows,a.fields); }
      }catch(_){}
      return orig.apply(this,arguments);
    };
    w.__v73=1; w.__orig=orig; window[name]=w; return true;
  }
  (function arm(n){
    var a=wrap('downloadCSV'), b=wrap('downloadXLS');
    if(!a&&!b&&typeof window.downloadCSV!=='function'&&(n||0)<40) setTimeout(function(){arm((n||0)+1);},300);
  })(0);
  window.__v73={label:label, val:val, arabize:arabize};
}catch(e){ if(window.console)console.warn('[v73] export-arabic',e); }})();
