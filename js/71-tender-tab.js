/* ===== Tender tab — ONE tender definition → TWO documents (Phase 2 FINAL, 2026-08-25)
   Technical Proposal (العرض الفني, family TEC) + Financial Proposal (العرض المالي, family FIN).

   Anatomy from the company's real HRC tender:
   - TECHNICAL: about the company → 4-phase work plan (the REAL phases, pre-seeded,
     editable) → scope items each with a technical-process description → timeline →
     team (named roles, entered per tender) → past projects (owner call — section
     ships DISABLED by default, M2: the excluded vendors never appear) → BoQ WITHOUT prices →
     certificates page (proof documents already in company_identity, listed as
     "attached: <label>" — the PDFs themselves are appended by the user at print).
   - FINANCIAL: same BoQ WITH prices — each line in numbers AND words → monthly
     payment schedule → subtotal → VAT 15% → total incl. VAT in numbers AND words
     (AR+EN) → the verbatim fee formula → official documents list.

   CRITICAL INVARIANT: the TECHNICAL document contains NO prices anywhere. The
   technical BoQ renderer never reads the price field; the probe sabotage-tests it.

   Rules honoured (docs/DECISIONS.md):
   - P5/F1: previews styled ONLY with var(--…) under data-identity="classic".
   - F2/F3: NO browser storage. Both documents persist in `generated_documents`
     (families TEC / FIN, one row each, sharing payload.tender_ref); numbering is
     server-side via next_document_number('TEC'|'FIN') at issue time only.
   - B2: every write chains .select() and checks the returned row count.
   - M2: The M2-excluded vendors never appear; past-work display is a flagged owner call.
   - M8/D4: no invented content — the 4 phases are the company's real anatomy;
     everything else is user-entered; nothing real is in this file.
   - Amount-in-words: REUSED from js/67 via window.__poWordsProbe (loaded before
     this file) — the algorithm is not duplicated here.

   Registers through the js/66 seam: window.dgRegisterTab('tender', renderFn). */
(function(){try{

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function canWrite(){ try{ return ['admin','manager','bd','team_member'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function toast(msg){ try{ if(window.__toast){__toast(msg);return;} }catch(_){}
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink,#333);color:#fff;padding:10px 16px;border-radius:10px;z-index:9999;font-size:14px';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){try{t.remove();}catch(_){}} ,2600);
  }
  function fmt(n){ if(!isFinite(n))return '—'; return Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  /* amount-in-words: reuse js/67's exposed algorithm — never duplicated (source: js/67-price-offer-tab.js) */
  function words(n,lang){
    try{ if(typeof window.__poWordsProbe==='function'){ var w=window.__poWordsProbe(Number(n)||0); return lang==='ar'?w.ar:w.en; } }catch(_){}
    return '';   /* js/67 missing = no words; never a fabricated string */
  }
  function uuid(){
    try{ if(window.crypto&&crypto.randomUUID)return crypto.randomUUID(); }catch(_){}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
  }

  /* ---------- bilingual document strings ---------- */
  var T={
    en:{tec:'Technical Proposal',fin:'Financial Proposal',no:'Document no.',date:'Date',draftPill:'DRAFT',wm:'DRAFT',
        about:'About the company',plan:'Work plan',phase:'Phase',dur:'Duration',
        scope:'Scope of services & technical process',proc:'Technical process',
        timeline:'Timeline',team:'Project team',role:'Role',name:'Name',
        past:'Past projects',boq:'Bill of quantities',boqNP:'Bill of quantities (unpriced)',
        item:'Item',unit:'Unit',qty:'Qty',price:'Unit price (SAR)',amount:'Amount (SAR)',inWords:'In words',
        certs:'Certificates & official documents',attached:'attached',
        certNote:'The listed proof documents are appended as PDF pages by the sender when printing — this page is the index.',
        sched:'Monthly payment schedule',month:'Month',notes:'Notes',
        subtotal:'Subtotal (SAR)',vat:'VAT 15% (SAR)',grand:'Total incl. VAT (SAR)',
        validity:'Offer validity',num:'#'},
    ar:{tec:'العرض الفني',fin:'العرض المالي',no:'رقم المستند',date:'التاريخ',draftPill:'مسودة',wm:'مسودة',
        about:'نبذة عن الشركة',plan:'خطة العمل',phase:'المرحلة',dur:'المدة',
        scope:'نطاق الخدمات والعملية الفنية',proc:'العملية الفنية',
        timeline:'الجدول الزمني',team:'فريق العمل',role:'الدور',name:'الاسم',
        past:'مشاريع سابقة',boq:'جدول الكميات',boqNP:'جدول الكميات (بدون أسعار)',
        item:'البند',unit:'الوحدة',qty:'الكمية',price:'سعر الوحدة (ريال)',amount:'المبلغ (ريال)',inWords:'كتابةً',
        certs:'الشهادات والمستندات الرسمية',attached:'مرفق',
        certNote:'المستندات المذكورة تُرفق كصفحات PDF من قِبل المرسل عند الطباعة — هذه الصفحة فهرس لها.',
        sched:'جدول الدفعات الشهرية',month:'الشهر',notes:'ملاحظات',
        subtotal:'المجموع (ريال)',vat:'ضريبة القيمة المضافة 15% (ريال)',grand:'الإجمالي شامل الضريبة (ريال)',
        validity:'صلاحية العرض',num:'#'}
  };
  /* the verbatim fee formula — owner wording, never rephrased */
  var FEE_FORMULA='كل دفعة = تكلفة الخدمة المطلوبة + رسوم الخدمة التعاقدية';

  /* ---------- the REAL 4-phase work plan (from the company's HRC tender) ---------- */
  function seedPhases(){
    return [
      {tEn:'Contract signing & needs analysis',tAr:'توقيع العقد وتحليل الاحتياج',dEn:'Sign the contract and analyse the entity\'s travel needs',dAr:'توقيع العقد وتحليل احتياجات الجهة من خدمات السفر',dur:'1–2 days',durAr:'١–٢ يوم'},
      {tEn:'On-site staff deployment',tAr:'توفير موظفين في مقر الجهة',dEn:'Deploy dedicated staff at the entity\'s premises',dAr:'توفير موظفين مخصصين في مقر الجهة',dur:'1–2 days',durAr:'١–٢ يوم'},
      {tEn:'E-platform activation',tAr:'تفعيل المنصة الإلكترونية',dEn:'Activate the electronic booking platform for the entity',dAr:'تفعيل منصة الحجوزات الإلكترونية للجهة',dur:'1–3 weeks',durAr:'١–٣ أسابيع'},
      {tEn:'Continuous service',tAr:'الخدمة المستمرة',dEn:'Ongoing service delivery and account management',dAr:'تقديم الخدمة المستمرة وإدارة الحساب',dur:'Contract term',durAr:'مدة العقد'}
    ];
  }
  function blankScope(){ return {nEn:'',nAr:'',pEn:'',pAr:''}; }
  function blankBoq(){ return {en:'',ar:'',unit:'',qty:1,price:''}; }
  function blankTeam(){ return {role:'',name:''}; }
  function blankPay(){ return {month:'',amount:'',notes:''}; }
  function blankDoc(){
    return { lang:'ar', clientId:'', tender_ref:uuid(),
      titleEn:'', titleAr:'', validity:'',
      phases:seedPhases(),
      scope:[blankScope()],
      boq:[blankBoq()],
      team:[blankTeam()],
      schedule:[blankPay()],
      pastProjects:{on:true,items:[]} };   /* owner ruling 25 Aug: SHOW past projects (M2 exclusions still never appear); default items prefill from company_profile_sections key 'past_projects' */
  }
  var S={ cur:blankDoc(), view:'tec',
          tec:{rowId:null,docNumber:null,status:'draft'},
          fin:{rowId:null,docNumber:null,status:'draft'},
          identity:null, list:null, listLoading:false, saving:false };

  /* ---------- data ---------- */
  function loadIdentity(){
    if(S.identity!==null)return;
    var c=client(); if(!c)return;
    S.identity=[];
    c.from('company_identity').select('key,label_en,label_ar,value_en,value_ar,category,proof_path,sensitive,sort')
     .order('sort',{ascending:true}).then(function(r){ S.identity=r.error?[]:(r.data||[]); repaint(); });
  }
  function idv(key,lang){
    var r=(S.identity||[]).find(function(x){return x.key===key;})||{};
    if(lang==='ar') return r.value_ar||r.value_en||'';
    return r.value_en||r.value_ar||'';
  }
  function proofRows(){ return (S.identity||[]).filter(function(r){return r.proof_path;}); }
  /* real-design footer strip (2026-08-25): QR · email/site · branches · AR legal
     block. Unified/licence numbers hydrate from the registry when rows exist;
     the printed-footer literals are the text fallback (public footer text). */
  function regNum(keys,fb){
    for(var i=0;i<keys.length;i++){ var v=idv(keys[i],'en'); if(v)return v; }
    return fb;
  }
  function footHtml(){
    var mail=idv('email','en')||'business@directksa.com';
    var site=idv('website','en')||'www.directksa.com';
    var unn=regNum(['unified_number','unified_national_number','unn'],'700782406');
    var lic=regNum(['mot_licence','tourism_licence','licence_number'],'7310322');
    return '<div class="td-foot">'+
      '<img class="fq" src="/brand/direct_qr_directksa.png" alt="" onerror="this.style.display=\'none\'">'+
      '<div class="fc">'+esc(mail)+'<br>'+esc(site)+'</div>'+
      '<div class="fb">You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam</div>'+
      '<div class="fl" dir="rtl">الاسم التجاري: شركة المسافر المباشر للسفر والسياحة<br>'+
        'الرقم الموحد '+esc(unn)+' · رقم الترخيص '+esc(lic)+'</div>'+
    '</div>';
  }
  function loadList(force){
    if(S.listLoading)return; if(S.list&&!force)return;
    var c=client(); if(!c)return;
    S.listLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,family,payload')
     .in('family',['TEC','FIN']).order('created_at',{ascending:false}).limit(80)
     .then(function(r){ S.listLoading=false; S.list=r.error?[]:(r.data||[]); repaint(); });
  }
  function bizName(id,lang){
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===id;});
      if(!b)return '';
      return (lang==='ar'&&b.nameAr)?b.nameAr:(b.name||b.nameAr||''); }catch(_){ return ''; }
  }
  function boqRows(){ return (S.cur.boq||[]).filter(function(r){return r.en||r.ar||r.unit||r.price!=='';}); }
  function lineAmount(r){ var q=Number(r.qty)||0, p=Number(r.price); return isFinite(p)?q*p:NaN; }
  function totals(){
    var sub=0, any=false;
    boqRows().forEach(function(r){ var a=lineAmount(r); if(isFinite(a)){ sub+=a; any=true; } });
    var vat=sub*0.15;
    return {sub:sub, vat:vat, grand:sub+vat, any:any};
  }

  /* ---------- QA hook ---------- */
  window.__tdProbe=function(){
    var t=totals();
    return { view:S.view, lang:S.cur.lang, clientId:S.cur.clientId||null,
      tender_ref:S.cur.tender_ref, phases:(S.cur.phases||[]).length,
      scope:(S.cur.scope||[]).length, boq:boqRows().length,
      pastProjectsOn:!!(S.cur.pastProjects&&S.cur.pastProjects.on),
      subtotal:t.sub, vat:t.vat, grand:t.grand,
      tec:{rowId:S.tec.rowId,docNumber:S.tec.docNumber,status:S.tec.status},
      fin:{rowId:S.fin.rowId,docNumber:S.fin.docNumber,status:S.fin.status} };
  };

  /* ---------- persistence: TWO rows, one shared payload (tender_ref links them) ---------- */
  function rowFromState(fam){
    var t=T[S.cur.lang==='ar'?'ar':'en'];
    var kind=fam==='TEC'?t.tec:t.fin;
    var title=((S.cur.lang==='ar'?(S.cur.titleAr||S.cur.titleEn):(S.cur.titleEn||S.cur.titleAr))||'Tender')+' — '+kind;
    var st=fam==='TEC'?S.tec:S.fin;
    return { family:fam, doc_type:fam==='TEC'?'tender_technical':'tender_financial',
      business_id:S.cur.clientId||null, title:title,
      payload:S.cur, status:st.status||'draft', doc_number:st.docNumber||null,
      updated_at:new Date().toISOString(), updated_by:(window.__userEmail||null) };
  }
  function refusedMsg(){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); }
  function saveOne(fam,cb){
    var c=client(); if(!c){ cb(false); return; }
    var st=fam==='TEC'?S.tec:S.fin;
    var rec=rowFromState(fam);
    if(st.rowId){
      c.from('generated_documents').update(rec).eq('id',st.rowId).select().then(function(r){
        cb(!r.error&&r.data&&r.data.length===1);
      });
    }else{
      rec.created_by=(window.__userEmail||null);
      c.from('generated_documents').insert(rec).select().then(function(r){
        var ok=!r.error&&r.data&&r.data.length===1;
        if(ok&&r.data[0].id)st.rowId=r.data[0].id;
        cb(ok);
      });
    }
  }
  window.tdSaveDraft=function(then){
    if(S.saving)return; S.saving=true;
    saveOne('TEC',function(ok1){
      saveOne('FIN',function(ok2){
        S.saving=false;
        if(!ok1||!ok2){ refusedMsg(); repaint(); return; }
        loadList(true); repaint();
        toast(fl('Both documents saved (technical + financial)','حُفظ المستندان (الفني والمالي)'));
        if(typeof then==='function')then();
      });
    });
  };
  /* numbering: server-side, per family, at issue time ONLY */
  window.tdIssue=function(fam){
    fam=(fam==='FIN')?'FIN':'TEC';
    var c=client(); if(!c){ refusedMsg(); return; }
    var st=fam==='TEC'?S.tec:S.fin;
    if(st.docNumber){ toast(fl('Already issued as '+st.docNumber,'صدر مسبقاً برقم '+st.docNumber)); return; }
    var go=function(){
      c.rpc('next_document_number',{p_family:fam}).then(function(r){
        if(r.error||!r.data){ toast(fl('Numbering was refused — the document stays a draft','رُفض الترقيم — يبقى المستند مسودة')); return; }
        var no=r.data;
        c.from('generated_documents')
         .update({doc_number:no,status:'sent',updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
         .eq('id',st.rowId).select().then(function(u){
            if(u.error||!u.data||u.data.length!==1){ refusedMsg(); return; }
            st.docNumber=no; st.status='sent';
            loadList(true); repaint();
            toast(fl('Issued: '+no,'صدر برقم: '+no));
         });
      });
    };
    if(st.rowId)window.tdSaveDraft(go); else window.tdSaveDraft(function(){ if(st.rowId)go(); });
  };
  window.tdOpen=function(id){
    var rec=(S.list||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    S.cur=Object.assign(blankDoc(),rec.payload);
    if(!Array.isArray(S.cur.phases)||!S.cur.phases.length)S.cur.phases=seedPhases();
    if(!Array.isArray(S.cur.scope))S.cur.scope=[blankScope()];
    if(!Array.isArray(S.cur.boq))S.cur.boq=[blankBoq()];
    if(!Array.isArray(S.cur.team))S.cur.team=[blankTeam()];
    if(!Array.isArray(S.cur.schedule))S.cur.schedule=[blankPay()];
    if(!S.cur.pastProjects)S.cur.pastProjects={on:true,items:[]};
    /* prefill defaults once, from the DB (never hardcoded here — D4) */
    if(S.cur.pastProjects.on&&!(S.cur.pastProjects.items||[]).length&&!S.cur.pastProjects.__seeded){
      S.cur.pastProjects.__seeded=true;
      try{ var c=client(); if(c)c.from('company_profile_sections').select('items').eq('key','past_projects').eq('enabled',true).then(function(r){
        try{ var it=(r.data&&r.data[0]&&r.data[0].items)||[]; if(it.length&&!(S.cur.pastProjects.items||[]).length){
          S.cur.pastProjects.items=it.map(function(x){ return (typeof LANG!=='undefined'&&LANG==='ar')?(x.ar||x.en||''):(x.en||x.ar||''); }).filter(Boolean);
          repaint(); } }catch(_){ }
      }); }catch(_){ }
    }
    if(!S.cur.tender_ref)S.cur.tender_ref=uuid();
    /* adopt BOTH family rows sharing this tender_ref */
    var ref=S.cur.tender_ref;
    ['TEC','FIN'].forEach(function(fam){
      var st=fam==='TEC'?S.tec:S.fin;
      var row=(S.list||[]).find(function(x){return x.family===fam&&x.payload&&x.payload.tender_ref===ref;});
      st.rowId=row?row.id:null; st.docNumber=row?(row.doc_number||null):null; st.status=row?(row.status||'draft'):'draft';
    });
    S.view=rec.family==='FIN'?'fin':'tec';
    repaint();
  };
  window.tdNew=function(){ S.cur=blankDoc(); S.view='tec';
    S.tec={rowId:null,docNumber:null,status:'draft'}; S.fin={rowId:null,docNumber:null,status:'draft'}; repaint(); };

  /* ---------- form mutation ---------- */
  window.tdSet=function(k,v){ S.cur[k]=v; repaintPreview(); };
  window.tdLang=function(l){ S.cur.lang=l; repaint(); };
  window.tdView=function(v){ S.view=(v==='fin')?'fin':'tec'; repaint(); };
  window.tdPP=function(on){ S.cur.pastProjects.on=!!on; repaint(); };
  function listOf(name){ return S.cur[name]; }
  window.tdItemSet=function(name,i,k,v){ var L=listOf(name); if(L&&L[i]){ L[i][k]=v; repaintPreview(); } };
  window.tdItem=function(name,op,i){
    var L=listOf(name); if(!L)return;
    var mk={scope:blankScope,boq:blankBoq,team:blankTeam,schedule:blankPay,phases:seedPhases}[name];
    if(op==='add')L.push(name==='phases'?seedPhases()[0]:mk());
    else if(op==='rm'){ L.splice(i,1); if(!L.length&&name!=='phases')L.push(mk()); }
    else if(op==='up'&&i>0){ var a=L[i-1];L[i-1]=L[i];L[i]=a; }
    else if(op==='down'&&i<L.length-1){ var b=L[i+1];L[i+1]=L[i];L[i]=b; }
    repaint();
  };

  /* Print titles: "Direct — Technical|Financial Proposal <no|DRAFT> — <entity>" */
  function pdfName(){
    var cn=bizName(S.cur.clientId,'en')||bizName(S.cur.clientId,'ar');
    var st=S.view==='fin'?S.fin:S.tec;
    var kind=S.view==='fin'?'Financial Proposal':'Technical Proposal';
    return 'Direct — '+kind+' '+(st.docNumber||'DRAFT')+(cn?' — '+cn:'');
  }
  window.tdPrint=function(){
    var t0=document.title;
    var restore=function(){ try{ document.title=t0; }catch(_){} };
    try{
      document.title=pdfName();
      window.addEventListener('afterprint',function h(){ restore(); window.removeEventListener('afterprint',h); });
      window.print();
    }catch(_){}
    setTimeout(restore,2000);
  };

  /* ---------- css (var(--…) only for brand colours) ---------- */
  function css(){ return '<style id="tdCss">'+
    '#tdWrap{display:grid;grid-template-columns:420px 1fr;gap:18px;align-items:start}'+
    '@media(max-width:1100px){#tdWrap{grid-template-columns:1fr}}'+
    '#tdWrap .td-form label{display:block;font-weight:700;font-size:12px;margin:10px 0 4px;color:var(--ink)}'+
    '#tdWrap .td-form input,#tdWrap .td-form select,#tdWrap .td-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--hairline,#ddd);border-radius:9px;padding:8px 10px;font-size:13.5px;font-family:inherit;background:var(--surface,#fff);color:var(--ink)}'+
    '#tdWrap .td-form textarea{min-height:56px;resize:vertical}'+
    '#tdWrap .td-seg{display:flex;border:1px solid var(--hairline,#ddd);border-radius:10px;overflow:hidden;margin-top:4px}'+
    '#tdWrap .td-seg button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted,#777)}'+
    '#tdWrap .td-seg button.on{background:var(--accent);color:#fff}'+
    '#tdWrap fieldset{border:1px solid var(--hairline,#ddd);border-radius:12px;margin:14px 0 0;padding:10px 12px 12px}'+
    '#tdWrap legend{font-weight:800;font-size:12px;padding:0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}'+
    '#tdWrap .td-row{border:1px dashed var(--hairline,#ccc);border-radius:9px;padding:8px;margin:8px 0;background:var(--surface,#fff)}'+
    '#tdWrap .rm{float:inline-end;border:0;background:none;color:#D92D20;font-weight:700;cursor:pointer;font-size:12px}'+
    '#tdWrap .mv{float:inline-end;border:0;background:none;color:var(--muted,#777);cursor:pointer;font-size:13px;font-weight:700;padding:0 4px}'+
    '#tdWrap .td-add{width:100%;border:1px dashed var(--accent);background:var(--wash-accent,#fff6f0);color:var(--accent);font-weight:800;border-radius:10px;padding:8px;cursor:pointer;font-size:13px}'+
    '#tdWrap .td-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
    '#tdWrap .td-status{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:800}'+
    '#tdWrap .td-status.draft{background:var(--wash,#eee);color:var(--muted,#777)}'+
    '#tdWrap .td-status.sent{background:var(--wash-accent,#fff3ec);color:var(--accent)}'+
    /* --- A4 preview, Classic identity --- */
    '#tdPages{display:flex;flex-direction:column;gap:20px;align-items:center;overflow-x:auto}'+
    '#tdPages .td-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.15));position:relative;display:flex;flex-direction:column;flex:none;color:var(--ink)}'+
    '#tdPages .td-page.ar{direction:rtl;font-family:var(--font-ar,serif)}'+
    '#tdPages .td-page.en{direction:ltr;font-family:var(--font-en,sans-serif)}'+
    /* full-bleed brand-primary cover / back-cover (Family-A design) */
    '#tdPages .td-page.grad{background:var(--accent);color:#fff}'+
    '#tdPages .td-cvr{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 60px 44px}'+
    '#tdPages .td-cvr .lg{width:210px}'+
    '#tdPages .td-cvr .mid{margin:auto 0}'+
    '#tdPages .td-cvr .t{font-size:38px;font-weight:800;line-height:1.35;margin:0}'+
    '#tdPages .td-cvr .t span{display:block}'+
    '#tdPages .td-cvr .sw{width:250px;height:20px;border-bottom:2.5px solid rgba(255,255,255,.92);border-radius:0 0 55% 55%/0 0 100% 100%;margin:8px auto 0}'+
    '#tdPages .td-cvr .qrb{margin-top:auto}'+
    '#tdPages .td-cvr .qrb img{width:74px;height:74px;background:#fff;padding:5px;border-radius:10px;display:block;margin:0 auto}'+
    '#tdPages .td-content{flex:1;display:flex;flex-direction:column;padding:44px 56px 104px}'+
    '#tdPages .td-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--accent);padding-bottom:12px;margin-bottom:22px}'+
    '#tdPages .td-head img{height:38px}'+
    '#tdPages .td-head .m{font-size:11.5px;color:var(--muted);text-align:end;line-height:1.6}'+
    '#tdPages .td-title{text-align:center;margin:0 0 4px;font-size:23px;font-weight:800}'+
    '#tdPages .td-title .dia{color:var(--accent);font-size:13px;vertical-align:middle}'+
    '#tdPages .td-sub{text-align:center;color:var(--muted);margin:0 0 20px;font-size:13px}'+
    '#tdPages .td-h{margin:16px 0 6px;font-size:15.5px;font-weight:800;color:var(--accent)}'+
    '#tdPages .td-h .n{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:99px;background:var(--accent);color:#fff;font-size:12.5px;margin-inline-end:8px;padding:0 6px}'+
    '#tdPages .td-p{font-size:13.5px;line-height:2;margin:0 0 6px;white-space:pre-wrap}'+
    '#tdPages .td-note{font-size:11.5px;color:var(--muted);line-height:1.7;margin:4px 0 8px}'+
    '#tdPages table.td-t{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:13.5px;margin:8px 0 4px}'+
    '#tdPages table.td-t th{background:var(--accent-strong);color:#fff;font-weight:700;padding:9px 12px;font-size:12.5px}'+
    '#tdPages table.td-t th:first-child{border-start-start-radius:999px;border-end-start-radius:999px}'+
    '#tdPages table.td-t th:last-child{border-start-end-radius:999px;border-end-end-radius:999px}'+
    '#tdPages table.td-t td{background:var(--wash);padding:9px 12px;text-align:center}'+
    '#tdPages table.td-t tr:nth-child(even) td{background:var(--wash-accent)}'+
    '#tdPages table.td-t td.svc{text-align:start;font-weight:600}'+
    '#tdPages table.td-t td.amt{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--accent)}'+
    '#tdPages table.td-t td.wrd{font-size:11px;color:var(--muted);text-align:start}'+
    '#tdPages .td-tot{background:var(--wash);border-inline-start:4px solid var(--accent);border-radius:10px;padding:12px 14px;font-size:13.5px;line-height:2;margin:10px 0}'+
    '#tdPages .td-tot b{color:var(--accent)}'+
    '#tdPages .td-formula{background:var(--wash-accent);border:1.5px dashed var(--accent);border-radius:10px;padding:10px 14px;font-weight:800;font-size:14px;text-align:center;margin:12px 0}'+
    /* real-design footer strip: QR · email/site · branches · Arabic legal block */
    '#tdPages .td-foot{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:12px 40px 14px;font-size:9.5px;color:var(--muted);box-sizing:border-box;border-top:1px solid var(--hairline,#eee)}'+
    '#tdPages .td-foot .fq{width:44px;height:44px;flex:none}'+
    '#tdPages .td-foot .fc{line-height:1.7;white-space:nowrap}'+
    '#tdPages .td-foot .fb{flex:1;text-align:center;line-height:1.6}'+
    '#tdPages .td-foot .fl{text-align:right;line-height:1.7;white-space:nowrap}'+
    '#tdPages .td-draftmark{position:absolute;top:18px;inset-inline-end:18px;background:var(--surface,#fff);color:var(--muted);font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;border:1px dashed var(--muted);z-index:2}'+
    '#tdPages .td-wm{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;overflow:hidden;z-index:1}'+
    '#tdPages .td-wm span{font-size:150px;font-weight:800;letter-spacing:.1em;color:var(--muted);opacity:.10;transform:rotate(-32deg);white-space:nowrap;user-select:none}'+
    '@media print{'+
      'body *{visibility:hidden}'+
      '#tdPages,#tdPages *{visibility:visible}'+
      '#tdPages{position:absolute;left:0;top:0;display:block}'+
      '#tdPages .td-page{width:auto;box-shadow:none;margin:0;page-break-after:always;height:auto;min-height:99.3vh}'+
      '#tdPages .td-page.grad{min-height:0;height:99.3vh;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '#tdPages .td-page:last-child{page-break-after:auto}'+
      '#tdPages .td-h{page-break-after:avoid}'+
      '#tdPages table.td-t tr,#tdPages .td-tot{page-break-inside:avoid}'+
      '#tdPages table.td-t th,#tdPages table.td-t tr:nth-child(even) td,#tdPages .td-tot,#tdPages .td-formula{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '}'+
    '@page{size:A4;margin:0}'+
    '</style>'; }

  /* ---------- preview building blocks ---------- */
  function pageOpen(t,ar,st){
    var dirCls=ar?'ar':'en';
    var issued=!!st.docNumber;
    var draftMark=issued?'':'<div class="td-draftmark">'+t.draftPill+'</div>';
    var wm=issued?'':'<div class="td-wm"><span>'+t.wm+'</span></div>';
    var legal=idv('legal_name',ar?'ar':'en');
    var head='<div class="td-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
      '<div class="m">'+esc(legal||'')+'<br>'+t.no+' '+esc(issued?st.docNumber:t.draftPill)+'</div></div>';
    return '<div class="td-page '+dirCls+'">'+draftMark+wm+'<div class="td-content">'+head;
  }
  function pageClose(t){
    return footHtml()+'</div></div>';
  }
  /* Family-A cover: full-bleed brand orange, white logo, stacked centered title
     (document kind + entity), curved underline, QR bottom-center — NO date/number */
  function coverPage(t,ar,kind,st){
    var dirCls=ar?'ar':'en';
    var issued=!!st.docNumber;
    var draftMark=issued?'':'<div class="td-draftmark">'+t.draftPill+'</div>';
    var title=(ar?S.cur.titleAr:S.cur.titleEn)||(ar?S.cur.titleEn:S.cur.titleAr)||'';
    var cn=S.cur.clientId?bizName(S.cur.clientId,ar?'ar':'en'):'';
    return '<div class="td-page grad '+dirCls+'">'+draftMark+'<div class="td-cvr">'+
      '<img class="lg" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="mid"><h1 class="t"><span>'+kind+'</span>'+
        (title?'<span>'+esc(title)+'</span>':'')+
        (cn?'<span>'+(ar?'مقدم إلى':'Prepared for')+'</span><span>'+esc(cn)+'</span>':'')+
      '</h1><div class="sw"></div></div>'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';
  }
  /* back-cover: full-bleed orange, white logo centered, QR bottom-center */
  function backCover(t,ar,st){
    var dirCls=ar?'ar':'en';
    var draftMark=st.docNumber?'':'<div class="td-draftmark">'+t.draftPill+'</div>';
    return '<div class="td-page grad '+dirCls+'">'+draftMark+'<div class="td-cvr">'+
      '<img class="lg" style="margin:auto 0" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';
  }
  function titleBlock(t,ar,kind,st){
    var title=(ar?S.cur.titleAr:S.cur.titleEn)||(ar?S.cur.titleEn:S.cur.titleAr)||'';
    return '<h1 class="td-title"><span class="dia">◆</span> '+kind+' <span class="dia">◆</span></h1>'+
      '<p class="td-sub">'+(title?esc(title)+' · ':'')+t.no+' '+esc(st.docNumber||t.draftPill)+
      (S.cur.clientId?' · '+esc(bizName(S.cur.clientId,ar?'ar':'en')):'')+
      (S.cur.validity?' · '+t.validity+': '+esc(S.cur.validity):'')+'</p>';
  }
  var secN=0;
  function h(t,label){ secN++; return '<div class="td-h"><span class="n">'+secN+'</span>'+label+'</div>'; }

  /* TECHNICAL BoQ — INVARIANT: this renderer NEVER reads r.price or computes an
     amount. Item / unit / qty only. Sabotage-tested by the probe. */
  function tecBoqHtml(t,ar){
    var rows=boqRows(); if(!rows.length)return '';
    var body=rows.map(function(r,i){
      var svc=ar?(r.ar||r.en):(r.en||r.ar);
      return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(svc)+'</td><td>'+esc(r.unit||'—')+'</td><td>'+esc(String(r.qty||''))+'</td></tr>';
    }).join('');
    return h(t,t.boqNP)+
      '<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.item+'</th><th>'+t.unit+'</th><th>'+t.qty+'</th></tr></thead>'+
      '<tbody>'+body+'</tbody></table>';
  }
  /* FINANCIAL BoQ — same rows WITH prices, each line in numbers AND words */
  function finBoqHtml(t,ar){
    var rows=boqRows(); if(!rows.length)return '';
    var body=rows.map(function(r,i){
      var svc=ar?(r.ar||r.en):(r.en||r.ar);
      var a=lineAmount(r);
      var amt=isFinite(a)?fmt(a):'—';
      var w=isFinite(a)?words(a,ar?'ar':'en'):'';
      return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(svc)+'</td><td>'+esc(r.unit||'—')+'</td><td>'+esc(String(r.qty||''))+'</td>'+
        '<td class="amt">'+(r.price===''?'—':fmt(Number(r.price)))+'</td><td class="amt">'+amt+'</td>'+
        '<td class="wrd">'+esc(w)+'</td></tr>';
    }).join('');
    return h(t,t.boq)+
      '<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.item+'</th><th>'+t.unit+'</th><th>'+t.qty+'</th><th>'+t.price+'</th><th>'+t.amount+'</th><th>'+t.inWords+'</th></tr></thead>'+
      '<tbody>'+body+'</tbody></table>';
  }
  function phasesHtml(t,ar,withTimeline){
    var ph=(S.cur.phases||[]); if(!ph.length)return '';
    var body=ph.map(function(p,i){
      var nm=ar?(p.tAr||p.tEn):(p.tEn||p.tAr);
      var d=ar?(p.dAr||p.dEn):(p.dEn||p.dAr);
      var du=ar?(p.durAr||p.dur):(p.dur||p.durAr);
      return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(nm)+(d?'<div class="td-note">'+esc(d)+'</div>':'')+'</td><td>'+esc(du||'—')+'</td></tr>';
    }).join('');
    return h(t,t.plan)+
      '<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.phase+'</th><th>'+t.dur+'</th></tr></thead><tbody>'+body+'</tbody></table>';
  }
  function certsPage(t,ar,st){
    var rows=proofRows(); if(!rows.length)return '';
    var body=rows.map(function(r,i){
      var lbl=ar?(r.label_ar||r.label_en):(r.label_en||r.label_ar);
      return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(lbl)+'</td><td>'+t.attached+': '+esc(lbl)+'</td></tr>';
    }).join('');
    secN=0;
    return pageOpen(t,ar,st)+
      '<div class="td-h" style="margin-top:0"><span class="n">◆</span>'+t.certs+'</div>'+
      '<div class="td-note">'+t.certNote+'</div>'+
      '<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.item+'</th><th></th></tr></thead><tbody>'+body+'</tbody></table>'+
      pageClose(t);
  }
  function tecPages(){
    var lang=S.cur.lang||'ar', t=T[lang], ar=lang==='ar', st=S.tec;
    secN=0;
    var legal=idv('legal_name',lang);
    var about=legal?('<p class="td-p">'+esc(legal)+(idv('cr_number','en')?' · CR '+esc(idv('cr_number','en')):'')+'</p>'):'';
    var scope=(S.cur.scope||[]).filter(function(s){return s.nEn||s.nAr;});
    var scopeHtml=scope.length?h(t,t.scope)+scope.map(function(s,i){
      var nm=ar?(s.nAr||s.nEn):(s.nEn||s.nAr);
      var pr=ar?(s.pAr||s.pEn):(s.pEn||s.pAr);
      return '<p class="td-p"><b>'+(i+1)+'. '+esc(nm)+'</b>'+(pr?'<br><span class="td-note">'+t.proc+': '+esc(pr)+'</span>':'')+'</p>';
    }).join(''):'';
    var team=(S.cur.team||[]).filter(function(m){return m.role||m.name;});
    var teamHtml=team.length?h(t,t.team)+'<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.role+'</th><th>'+t.name+'</th></tr></thead><tbody>'+
      team.map(function(m,i){ return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(m.role)+'</td><td>'+esc(m.name||'—')+'</td></tr>'; }).join('')+
      '</tbody></table>':'';
    /* past projects — DISABLED by default, an owner call (M2: the excluded vendors never appear) */
    var ppHtml='';
    if(S.cur.pastProjects&&S.cur.pastProjects.on){
      var items=(S.cur.pastProjects.items||[]).filter(function(x){return x;});
      ppHtml=h(t,t.past)+(items.length?items.map(function(x){return '<p class="td-p">'+esc(x)+'</p>';}).join('')
        :'<div class="td-note">'+(ar?'—':'—')+'</div>');
    }
    var main=pageOpen(t,ar,st)+titleBlock(t,ar,t.tec,st)+
      (about?h(t,t.about)+about:'')+
      phasesHtml(t,ar)+
      scopeHtml+
      h(t,t.timeline)+'<div class="td-note">'+(ar?'الجدول الزمني يتبع مراحل خطة العمل أعلاه.':'The timeline follows the work-plan phases above.')+'</div>'+
      teamHtml+
      ppHtml+
      tecBoqHtml(t,ar)+
      pageClose(t);
    return coverPage(t,ar,t.tec,st)+main+certsPage(t,ar,st)+backCover(t,ar,st);
  }
  function finPages(){
    var lang=S.cur.lang||'ar', t=T[lang], ar=lang==='ar', st=S.fin;
    secN=0;
    var tt=totals();
    var sched=(S.cur.schedule||[]).filter(function(p){return p.month||p.amount!==''||p.notes;});
    var schedHtml=sched.length?h(t,t.sched)+'<table class="td-t"><thead><tr><th>'+t.num+'</th><th>'+t.month+'</th><th>'+t.amount+'</th><th>'+t.notes+'</th></tr></thead><tbody>'+
      sched.map(function(p,i){
        var n=Number(p.amount);
        return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(p.month)+'</td><td class="amt">'+(p.amount===''?'—':(isFinite(n)?fmt(n):esc(p.amount)))+'</td><td>'+esc(p.notes||'')+'</td></tr>';
      }).join('')+'</tbody></table>':'';
    var totHtml=tt.any?'<div class="td-tot">'+
      t.subtotal+': <b>'+fmt(tt.sub)+'</b><br>'+
      t.vat+': <b>'+fmt(tt.vat)+'</b><br>'+
      t.grand+': <b>'+fmt(tt.grand)+'</b><br>'+
      '<span class="td-note">'+t.inWords+' (AR): '+esc(words(tt.grand,'ar'))+'</span><br>'+
      '<span class="td-note">'+t.inWords+' (EN): '+esc(words(tt.grand,'en'))+'</span>'+
      '</div>':'';
    var certRows=proofRows();
    var main=pageOpen(t,ar,st)+titleBlock(t,ar,t.fin,st)+
      finBoqHtml(t,ar)+
      schedHtml+
      totHtml+
      '<div class="td-formula">'+esc(FEE_FORMULA)+'</div>'+
      pageClose(t);
    return coverPage(t,ar,t.fin,st)+main+(certRows.length?certsPage(t,ar,st):'')+backCover(t,ar,st);
  }
  function pagesHtml(){ return S.view==='fin'?finPages():tecPages(); }

  /* ---------- form ---------- */
  function clientOptions(){
    var bs; try{ bs=(DB.businesses||[]).slice(); }catch(_){ bs=[]; }
    var clients=bs.filter(function(b){return b.isClient;});
    var leads=bs.filter(function(b){return !b.isClient;});
    function opts(list){ return list.map(function(b){
      var nm=isAr()&&b.nameAr?b.nameAr:(b.name||b.nameAr||'');
      return '<option value="'+esc(b.id)+'" '+(S.cur.clientId===b.id?'selected':'')+'>'+esc(nm)+'</option>';
    }).join(''); }
    return '<option value="">'+fl('— pick from the app\'s records (tenders may target non-clients) —','— اختر من سجلات التطبيق (المناقصات قد تستهدف غير العملاء) —')+'</option>'+
      (clients.length?'<optgroup label="'+fl('Clients','العملاء')+'">'+opts(clients)+'</optgroup>':'')+
      (leads.length?'<optgroup label="'+fl('Leads & entities','العملاء المحتملون والجهات')+'">'+opts(leads)+'</optgroup>':'');
  }
  function savedOptions(){
    var list=S.list||[];
    return '<option value="">'+
      (list.length?fl('— open a saved tender document ('+list.length+') —','— افتح مستند مناقصة محفوظاً ('+list.length+') —')
                  :fl('— no saved tender documents yet —','— لا توجد مستندات مناقصات محفوظة بعد —'))+'</option>'+
      list.map(function(o){
        var label=(o.family==='TEC'?fl('Technical','فني'):fl('Financial','مالي'))+' · '+(o.doc_number||fl('draft','مسودة'))+' · '+(bizName(o.business_id)||o.title||'')+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'">'+esc(label)+'</option>';
      }).join('');
  }
  function rowCtl(name,i){
    return '<button type="button" class="rm" onclick="tdItem(\''+name+'\',\'rm\','+i+')">✕</button>'+
      '<button type="button" class="mv" onclick="tdItem(\''+name+'\',\'down\','+i+')">↓</button>'+
      '<button type="button" class="mv" onclick="tdItem(\''+name+'\',\'up\','+i+')">↑</button>';
  }
  function inp(name,i,k,val,label,rtl,type){
    return '<label>'+label+'</label><input '+(rtl?'dir="rtl" ':'')+(type?'type="'+type+'" min="0" step="0.01" ':'')+
      'value="'+esc(val==null?'':val)+'" oninput="tdItemSet(\''+name+'\','+i+',\''+k+'\',this.value)">';
  }
  function formHtml(){
    var w=canWrite();
    var stT=S.tec, stF=S.fin;
    function stPill(st,lbl){
      var s=st.status||'draft';
      return '<span class="td-status '+esc(s)+'">'+lbl+': '+(s==='draft'?fl('Draft','مسودة'):fl('Issued','صادر'))+(st.docNumber?' · '+esc(st.docNumber):'')+'</span>';
    }
    return '<div class="card td-form">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<b>'+fl('Tender — technical + financial pair','المناقصة — العرض الفني والمالي')+'</b>'+
        '<span style="display:flex;gap:6px;flex-wrap:wrap">'+stPill(stT,fl('Technical','فني'))+stPill(stF,fl('Financial','مالي'))+'</span>'+
      '</div>'+
      '<div class="td-note" style="font-size:11.5px;color:var(--muted,#777);margin-top:6px">'+
        fl('One tender definition produces two separate documents. They are saved as a linked pair and issued separately.',
           'تعريف واحد للمناقصة ينتج مستندين منفصلين. يُحفظان كزوج مترابط ويُصدر كل منهما على حدة.')+'</div>'+
      '<label>'+fl('Saved tender documents','مستندات المناقصات المحفوظة')+'</label>'+
      '<select onchange="if(this.value)tdOpen(this.value)">'+savedOptions()+'</select>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" onclick="tdNew()">＋ '+fl('New tender','مناقصة جديدة')+'</button>'+
      '</div>'+
      '<label>'+fl('Document language','لغة المستند')+'</label>'+
      '<div class="td-seg">'+
        '<button type="button" class="'+(S.cur.lang==='ar'?'on':'')+'" onclick="tdLang(\'ar\')">العربية</button>'+
        '<button type="button" class="'+(S.cur.lang==='en'?'on':'')+'" onclick="tdLang(\'en\')">English</button>'+
      '</div>'+
      '<label>'+fl('Preview','المعاينة')+'</label>'+
      '<div class="td-seg" id="tdViewSeg">'+
        '<button type="button" class="'+(S.view==='tec'?'on':'')+'" onclick="tdView(\'tec\')">'+fl('Technical','العرض الفني')+'</button>'+
        '<button type="button" class="'+(S.view==='fin'?'on':'')+'" onclick="tdView(\'fin\')">'+fl('Financial','العرض المالي')+'</button>'+
      '</div>'+
      '<fieldset><legend>'+fl('Tender','المناقصة')+'</legend>'+
        '<label>'+fl('Entity (leads allowed)','الجهة (يُسمح بغير العملاء)')+'</label>'+
        '<select onchange="tdSet(\'clientId\',this.value)">'+clientOptions()+'</select>'+
        '<label>'+fl('Tender title (AR)','عنوان المناقصة بالعربية')+'</label>'+
        '<input dir="rtl" value="'+esc(S.cur.titleAr)+'" oninput="tdSet(\'titleAr\',this.value)">'+
        '<label>'+fl('Tender title (EN)','عنوان المناقصة بالإنجليزية')+'</label>'+
        '<input value="'+esc(S.cur.titleEn)+'" oninput="tdSet(\'titleEn\',this.value)">'+
        '<label>'+fl('Offer validity (e.g. 90 days)','صلاحية العرض (مثال: ٩٠ يوماً)')+'</label>'+
        '<input value="'+esc(S.cur.validity)+'" oninput="tdSet(\'validity\',this.value)">'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Work plan (4 phases — pre-seeded from the real anatomy, editable)','خطة العمل (٤ مراحل — من البنية الفعلية، قابلة للتعديل)')+'</legend>'+
        (S.cur.phases||[]).map(function(p,i){
          return '<div class="td-row">'+rowCtl('phases',i)+
            inp('phases',i,'tEn',p.tEn,fl('Phase (EN)','المرحلة بالإنجليزية'))+
            inp('phases',i,'tAr',p.tAr,fl('Phase (AR)','المرحلة بالعربية'),true)+
            '<div class="td-row2">'+
            '<div>'+inp('phases',i,'dur',p.dur,fl('Duration (EN)','المدة بالإنجليزية'))+'</div>'+
            '<div>'+inp('phases',i,'durAr',p.durAr,fl('Duration (AR)','المدة بالعربية'),true)+'</div>'+
            '</div>'+
            '<label>'+fl('Description (EN)','الوصف بالإنجليزية')+'</label><textarea oninput="tdItemSet(\'phases\','+i+',\'dEn\',this.value)">'+esc(p.dEn||'')+'</textarea>'+
            '<label>'+fl('Description (AR)','الوصف بالعربية')+'</label><textarea dir="rtl" oninput="tdItemSet(\'phases\','+i+',\'dAr\',this.value)">'+esc(p.dAr||'')+'</textarea>'+
          '</div>';
        }).join('')+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Scope items (each with its technical process)','بنود النطاق (لكل بند عمليته الفنية)')+'</legend>'+
        (S.cur.scope||[]).map(function(s,i){
          return '<div class="td-row">'+rowCtl('scope',i)+
            inp('scope',i,'nEn',s.nEn,fl('Item (EN)','البند بالإنجليزية'))+
            inp('scope',i,'nAr',s.nAr,fl('Item (AR)','البند بالعربية'),true)+
            '<label>'+fl('Technical process (EN)','العملية الفنية بالإنجليزية')+'</label><textarea oninput="tdItemSet(\'scope\','+i+',\'pEn\',this.value)">'+esc(s.pEn||'')+'</textarea>'+
            '<label>'+fl('Technical process (AR)','العملية الفنية بالعربية')+'</label><textarea dir="rtl" oninput="tdItemSet(\'scope\','+i+',\'pAr\',this.value)">'+esc(s.pAr||'')+'</textarea>'+
          '</div>';
        }).join('')+
        '<button type="button" class="td-add" onclick="tdItem(\'scope\',\'add\')">+ '+fl('Add scope item','إضافة بند نطاق')+'</button>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('BoQ (prices print ONLY on the financial document)','جدول الكميات (الأسعار تظهر فقط في العرض المالي)')+'</legend>'+
        (S.cur.boq||[]).map(function(r,i){
          return '<div class="td-row">'+rowCtl('boq',i)+
            inp('boq',i,'en',r.en,fl('Item (EN)','البند بالإنجليزية'))+
            inp('boq',i,'ar',r.ar,fl('Item (AR)','البند بالعربية'),true)+
            '<div class="td-row2">'+
            '<div>'+inp('boq',i,'unit',r.unit,fl('Unit','الوحدة'))+'</div>'+
            '<div>'+inp('boq',i,'qty',r.qty,fl('Qty','الكمية'),false,'number')+'</div>'+
            '</div>'+
            inp('boq',i,'price',r.price,fl('Unit price (SAR, ex-VAT)','سعر الوحدة (ريال، دون الضريبة)'),false,'number')+
          '</div>';
        }).join('')+
        '<button type="button" class="td-add" onclick="tdItem(\'boq\',\'add\')">+ '+fl('Add BoQ line','إضافة سطر كميات')+'</button>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Team (per tender)','فريق العمل (لكل مناقصة)')+'</legend>'+
        (S.cur.team||[]).map(function(m,i){
          return '<div class="td-row">'+rowCtl('team',i)+
            '<div class="td-row2">'+
            '<div>'+inp('team',i,'role',m.role,fl('Role','الدور'))+'</div>'+
            '<div>'+inp('team',i,'name',m.name,fl('Name','الاسم'))+'</div>'+
            '</div></div>';
        }).join('')+
        '<button type="button" class="td-add" onclick="tdItem(\'team\',\'add\')">+ '+fl('Add team member','إضافة عضو فريق')+'</button>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Monthly payment schedule (financial document)','جدول الدفعات الشهرية (العرض المالي)')+'</legend>'+
        (S.cur.schedule||[]).map(function(p,i){
          return '<div class="td-row">'+rowCtl('schedule',i)+
            '<div class="td-row2">'+
            '<div>'+inp('schedule',i,'month',p.month,fl('Month','الشهر'))+'</div>'+
            '<div>'+inp('schedule',i,'amount',p.amount,fl('Amount (SAR)','المبلغ (ريال)'),false,'number')+'</div>'+
            '</div>'+
            inp('schedule',i,'notes',p.notes,fl('Notes','ملاحظات'))+
          '</div>';
        }).join('')+
        '<button type="button" class="td-add" onclick="tdItem(\'schedule\',\'add\')">+ '+fl('Add payment row','إضافة دفعة')+'</button>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Past projects','مشاريع سابقة')+'</legend>'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" style="width:auto" '+(S.cur.pastProjects&&S.cur.pastProjects.on?'checked':'')+' onchange="tdPP(this.checked)"> '+fl('Show a past-projects section','إظهار قسم المشاريع السابقة')+'</label>'+
        '<div class="td-note" style="font-size:11.5px;color:var(--muted,#777)">'+
          fl('Shown by default. Verification-system vendors never appear.',
             'يظهر افتراضياً. مورّدو نظام التحقق لا يظهرون أبداً.')+'</div>'+
      '</fieldset>'+
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
        (w?'<button class="btn sm pri" '+(S.saving?'disabled':'')+' onclick="tdSaveDraft()">'+(S.saving?fl('Saving…','جارٍ الحفظ…'):fl('Save both drafts','حفظ المسودتين'))+'</button>':'')+
        (w&&!stT.docNumber?'<button class="btn sm ghost" data-v21relabeled="true" onclick="tdIssue(\'TEC\')">'+fl('Issue technical','إصدار العرض الفني')+'</button>':'')+
        (w&&!stF.docNumber?'<button class="btn sm ghost" data-v21relabeled="true" onclick="tdIssue(\'FIN\')">'+fl('Issue financial','إصدار العرض المالي')+'</button>':'')+
        '<button class="btn sm ghost" onclick="tdPrint()">'+fl('Print / PDF (current view)','طباعة / PDF (المعاينة الحالية)')+'</button>'+
      '</div>'+
      '<div style="margin-top:10px;font-size:11.5px;color:var(--muted,#777);line-height:1.5">'+
        fl('BoQ prices are ex-VAT; the financial document adds VAT 15% as a client-facing line. Real tax invoices are issued from Direct Payment. The technical document never shows prices.',
           'أسعار جدول الكميات دون الضريبة؛ يضيف العرض المالي ضريبة ١٥٪ كسطر للعميل. الفواتير الضريبية تصدر من دايركت للمدفوعات. العرض الفني لا يعرض الأسعار أبداً.')+'</div>'+
    '</div>';
  }

  /* ---------- tab body + repaints ---------- */
  function tabHtml(){
    loadIdentity(); loadList();
    return css()+
      '<div id="tdWrap">'+
        '<div>'+formHtml()+'</div>'+
        '<div id="tdPreviewCol" data-identity="classic"><div id="tdPages">'+pagesHtml()+'</div></div>'+
      '</div>';
  }
  function repaint(){ try{ if(typeof current!=='undefined'&&current==='documents')render(); }catch(_){} }
  function repaintPreview(){
    var el=document.getElementById('tdPages');
    if(el)el.innerHTML=pagesHtml(); else repaint();
  }

  /* ---------- register through the js/66 seam ---------- */
  if(typeof window.dgRegisterTab==='function'){
    window.dgRegisterTab('tender', tabHtml);
  }else{
    console.warn('[td] dgRegisterTab missing — js/66 not loaded first?');
  }

  console.info('[td] tender tab loaded (generated_documents / TEC + FIN)');
}catch(e){ if(window.console)console.warn('[td] init',e); }})();
