/* ===== Service-Fee Proposal tab — the company's most important sales artefact =====
   (Phase 1, STEP 3, 2026-08-25)

   A 5–6 page branded deck for ONE client: gradient cover → About Direct (identity
   from company_identity, show_on_documents only) → per-service fee tables →
   standard T&C footnotes → closing page (SLA + contacts + signature block).

   GENERIC AND SCENARIO-FIRST (owner ruling): nothing hardcoded to any client.
   Real decks are selectable SEED SCENARIOS read live from the
   `service_fee_scenarios` table; every fee stays fully editable after seeding.

   Rules honoured (docs/DECISIONS.md):
   - P5/F1: preview styled ONLY with var(--…) resolved from /brand/tokens.css
     (injected by js/66) under data-identity="classic". No copied brand hexes.
   - F2/F3: NO per-browser storage anywhere. Proposals live in `generated_documents`
     (family 'SFP'); numbering is server-side via next_document_number('SFP'),
     assigned ONLY at issue time — drafts carry no number.
   - B2: every write chains .select() and checks the returned row count.
   - M8: seeded fees come from the approved knowledge DB — nothing invented here;
     the numbers live in the database, not in this file.
   - D4: no real client data in this file — clients are PICKED from DB.businesses.

   Registers through the js/66 seam: window.dgRegisterTab('fees', renderFn). */
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
  function fmt(n){ if(!isFinite(n))return '—'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:2}); }

  /* ---------- bilingual document strings ---------- */
  var T={
    en:{cover:'Service-Fee Proposal',coverSub:'Travel & Tourism Services',prepFor:'Prepared for',
        year:'Year',no:'Proposal no.',date:'Date',valid:'Valid until',draftPill:'DRAFT',
        draft:'DRAFT — no number yet',wm:'DRAFT',
        about:'About Direct',aboutLead:'Direct — دايركت للسفر والسياحة — is a Saudi travel & tourism company. Global supplier power. Saudi service. One partner.',
        fees:'Service fees',svc:'Service',num:'#',free:'FREE',
        totalNote:'(Total — includes all charges)',
        termsHead:'Standard terms',
        terms:'All listed fees exclude VAT · per person, per ticket, document or visa · fees cover our service fees only, excluding embassy/consulate/shipping/hotel/airline fees (unless a line is marked Total).',
        slaHead:'Our service commitments',
        sla:['Urgent requests answered within 3 hours','Emergencies handled within 24 hours','Service available 24/7'],
        contactsHead:'Contacts',signHead:'Agreement',
        signName:'Name',signTitle:'Title',signSig:'Signature',signDate:'Date',
        partyA:'For Direct',partyB:'For the client',
        notesHead:'Notes',thanks:'Thank You',
        tag:'Global supplier power. Saudi service. One partner.'},
    ar:{cover:'عرض رسوم الخدمات',coverSub:'خدمات السفر والسياحة',prepFor:'مقدم إلى',
        year:'السنة',no:'رقم العرض',date:'التاريخ',valid:'صالح حتى',draftPill:'مسودة',
        draft:'مسودة — بلا رقم بعد',wm:'مسودة',
        about:'عن دايركت',aboutLead:'دايركت للسفر والسياحة شركة سعودية للسفر والسياحة. قوة موردين عالمية. خدمة سعودية. شريك واحد.',
        fees:'عرض رسوم خدمة',svc:'الخدمة',num:'#',free:'مجاناً',
        totalNote:'(شامل جميع الرسوم)',
        termsHead:'الشروط القياسية',
        terms:'جميع الرسوم المذكورة غير شاملة ضريبة القيمة المضافة · لكل شخص أو تذكرة أو مستند أو تأشيرة · الرسوم تغطي رسوم خدماتنا فقط ولا تشمل رسوم السفارات/القنصليات/الشحن/الفنادق/شركات الطيران (ما لم يُوضَّح أن السطر إجمالي).',
        slaHead:'التزامات الخدمة',
        sla:['الرد على الطلبات العاجلة خلال 3 ساعات','معالجة الحالات الطارئة خلال 24 ساعة','خدمة متاحة على مدار الساعة 24/7'],
        contactsHead:'التواصل',signHead:'التوقيعات',
        signName:'الاسم',signTitle:'المسمى',signSig:'التوقيع',signDate:'التاريخ',
        partyA:'عن دايركت',partyB:'عن العميل',
        notesHead:'ملاحظات',thanks:'شكراً لكم',
        tag:'قوة موردين عالمية. خدمة سعودية. شريك واحد.'}
  };

  /* ---------- state ---------- */
  /* unitEn/unitAr, disc (discount %), noteTxt round-trip client_service_fees
     rows through the editor; blank on scenario/blank rows. fee may carry a
     trailing % — that renders as text and saves as fee_type='percent'. */
  function blankRow(){ return {en:'',ar:'',fee:'',fee2:'',total:false,free:false,
    unitEn:'',unitAr:'',disc:'',noteTxt:''}; }
  function blankSection(){ return {tEn:'',tAr:'',rows:[blankRow()]}; }
  function blankProp(){
    var y=new Date().getFullYear();
    return { lang:'en', clientId:'', titleEn:'', titleAr:'', year:String(y),
      validity:'', notes:'', scenarioId:'',
      col2:{on:false,head1En:'',head1Ar:'',headEn:'',headAr:''}, sections:[blankSection()] };
  }
  var S={ cur:blankProp(), rowId:null, docNumber:null, status:'draft',
          list:null, listLoading:false, identity:null, scenarios:null, scnLoading:false, saving:false,
          /* per-client saved rates (client_service_fees) */
          cfRows:null, cfBiz:null, cfLoading:false, cfSaving:false };

  /* ---------- data ---------- */
  function loadIdentity(){
    if(S.identity!==null)return;
    var c=client(); if(!c)return;
    S.identity=[]; /* in-flight marker */
    c.from('company_identity').select('key,category,label_en,label_ar,value_en,value_ar,show_on_documents,sensitive,sort')
     .order('sort',{ascending:true}).then(function(r){
        S.identity=r.error?[]:(r.data||[]); repaint();
     });
  }
  function idv(key,lang){
    var r=(S.identity||[]).find(function(x){return x.key===key;})||{};
    if(lang==='ar') return r.value_ar||r.value_en||'';
    return r.value_en||r.value_ar||'';
  }
  function loadScenarios(){
    if(S.scenarios!==null||S.scnLoading)return;
    var c=client(); if(!c)return;
    S.scnLoading=true;
    c.from('service_fee_scenarios').select('*').order('sort',{ascending:true}).then(function(r){
      S.scnLoading=false;
      S.scenarios=r.error?[]:(r.data||[]);
      repaint();
    });
  }
  function loadList(force){
    if(S.listLoading)return; if(S.list&&!force)return;
    var c=client(); if(!c)return;
    S.listLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,payload')
     .eq('family','SFP').order('created_at',{ascending:false}).limit(60)
     .then(function(r){ S.listLoading=false; S.list=r.error?[]:(r.data||[]); repaint(); });
  }
  /* client_service_fees — this client's standing rates record (26 Aug feature).
     Loaded whenever a client is picked; a fetch error just shows nothing. */
  function loadClientFees(){
    var id=S.cur.clientId;
    S.cfRows=null; S.cfBiz=id||null;
    if(!id)return;
    var c=client(); if(!c)return;
    S.cfLoading=true;
    c.from('client_service_fees').select('*').eq('business_id',id).eq('enabled',true)
     .order('sort',{ascending:true}).then(function(r){
        S.cfLoading=false;
        if(S.cfBiz!==id)return;                      /* a later pick superseded this */
        S.cfRows=r.error?null:(r.data||[]);
        repaint();
     });
  }
  function bizName(id){
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===id;});
      return b?(isAr()&&b.nameAr?b.nameAr:b.name):''; }catch(_){ return ''; }
  }
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
    return '<div class="sf-foot">'+
      '<img class="fq" src="/brand/direct_qr_directksa.png" alt="" onerror="this.style.display=\'none\'">'+
      '<div class="fc">'+esc(mail)+'<br>'+esc(site)+'</div>'+
      '<div class="fb">You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam</div>'+
      '<div class="fl" dir="rtl">الاسم التجاري: شركة المسافر المباشر للسفر والسياحة<br>'+
        'الرقم الموحد '+esc(unn)+' · رقم الترخيص '+esc(lic)+'</div>'+
    '</div>';
  }
  function docClientName(lang){
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===S.cur.clientId;});
      if(!b)return '';
      return (lang==='ar'&&b.nameAr)?b.nameAr:(b.name||b.nameAr||''); }catch(_){ return ''; }
  }

  /* ---------- scenario seeding (the editor stays fully editable after) ---------- */
  window.sfSeed=function(id){
    if(!id){ return; }
    var sc=(S.scenarios||[]).find(function(x){return x.id===id;}); if(!sc)return;
    var cols=Array.isArray(sc.columns)?sc.columns:[];
    S.cur.scenarioId=id;
    S.cur.col2={ on:cols.length>1,
      head1En:cols.length>0?(cols[0].header_en||''):'',
      head1Ar:cols.length>0?(cols[0].header_ar||''):'',
      headEn:cols.length>1?(cols[1].header_en||''):'',
      headAr:cols.length>1?(cols[1].header_ar||''):'' };
    S.cur.sections=(Array.isArray(sc.rows)?sc.rows:[]).map(function(sec){
      return { tEn:sec.title_en||'', tAr:sec.title_ar||'',
        rows:(sec.rows||[]).map(function(r){
          var fees=r.fees||[];
          return { en:r.svc_en||'', ar:r.svc_ar||'',
            fee:fees.length>0?String(fees[0]):'', fee2:fees.length>1?String(fees[1]):'',
            total:!!r.total, free:!!r.free };
        })};
    });
    if(!S.cur.sections.length)S.cur.sections=[blankSection()];
    if(!S.cur.titleEn)S.cur.titleEn=sc.name_en||'';
    if(!S.cur.titleAr)S.cur.titleAr=sc.name_ar||'';
    repaint();
    toast(fl('Scenario loaded — every fee stays editable','تم تحميل السيناريو — كل الرسوم قابلة للتعديل'));
  };
  /* QA hooks */
  window.__sfProbe=function(){
    return { sections:(S.cur.sections||[]).length,
      rows:(S.cur.sections||[]).reduce(function(a,s){return a+(s.rows||[]).length;},0),
      col2:!!(S.cur.col2&&S.cur.col2.on), scenarioId:S.cur.scenarioId||null };
  };
  window.__sfTermsProbe=function(){ return { en:T.en.terms, ar:T.ar.terms }; };
  window.__sfFeesProbe=function(){
    return { biz:S.cfBiz, loaded:Array.isArray(S.cfRows), saved:Array.isArray(S.cfRows)?S.cfRows.length:null, saving:!!S.cfSaving };
  };

  /* ---------- per-client saved rates (client_service_fees) ---------- */
  /* Fill the fee tables from this client's saved rates. Percent fees render as
     "5%" in the fee cell; unit / discount / notes print as a small line under
     the service name. Everything stays editable after loading. */
  window.sfLoadClientRates=function(){
    var rows=S.cfRows||[]; if(!rows.length)return;
    S.cur.sections=[{ tEn:'', tAr:'', rows:rows.map(function(r){
      var fee=r.fee_type==='percent'
        ? (r.fee_value==null?'':String(r.fee_value)+'%')
        : (r.fee_value==null?'':String(r.fee_value));
      return { en:r.service_en||'', ar:r.service_ar||'', fee:fee, fee2:'',
        total:false, free:false,
        unitEn:r.unit_en||'', unitAr:r.unit_ar||'',
        disc:(r.discount_pct==null?'':String(r.discount_pct)), noteTxt:r.notes||'' };
    })}];
    S.cur.col2={on:false,head1En:'',head1Ar:'',headEn:'',headAr:''};
    repaint();
    toast(fl('Saved rates loaded — every fee stays editable','تم تحميل الأسعار المحفوظة — كل الرسوم قابلة للتعديل'));
  };
  /* Write the current fee tables as this client's standing rates:
     delete-then-insert, BOTH .select()-checked (B2). A fee cell ending in %
     saves as fee_type='percent'. Fee values come only from the tables — a row
     with a non-numeric or missing fee refuses the whole save (M8). */
  window.sfSaveClientRates=function(){
    var bid=S.cur.clientId; if(!bid)return;
    if(S.cfSaving)return;
    var c=client(); if(!c){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); return; }
    var out=[], bad=null, i=0;
    (S.cur.sections||[]).forEach(function(sec){ (sec.rows||[]).forEach(function(r){
      var feeStr=String(r.fee==null?'':r.fee).trim();
      if(!(r.en||r.ar||feeStr))return;               /* fully blank row — skip */
      var isPct=/%$/.test(feeStr);
      var num=r.free?0:Number(feeStr.replace(/%$/,'').replace(/,/g,''));
      if((feeStr===''&&!r.free)||!isFinite(num)){ bad=(r.en||r.ar||feeStr); return; }
      var d=(r.disc!=null&&String(r.disc).trim()!=='')?Number(String(r.disc).trim()):null;
      out.push({ business_id:bid, service_en:r.en||'', service_ar:r.ar||'',
        fee_type:(isPct&&!r.free)?'percent':'fixed', fee_value:num,
        discount_pct:(d!=null&&isFinite(d))?d:null,
        unit_en:r.unitEn||null, unit_ar:r.unitAr||null,
        notes:r.noteTxt||null, sort:++i, enabled:true });
    });});
    if(bad!=null){ toast(fl('Not saved — a row has no valid fee: ','لم يُحفظ — سطر بلا رسوم صالحة: ')+bad); return; }
    if(!out.length){ toast(fl('Nothing to save — the fee tables are empty','لا شيء للحفظ — جداول الرسوم فارغة')); return; }
    S.cfSaving=true; repaint();
    c.from('client_service_fees').delete().eq('business_id',bid).select('id').then(function(del){
      /* B2: an RLS-refused delete "succeeds" with zero rows — if we KNOW this
         client has saved rows and none came back deleted, stop before inserting
         duplicates next to the rows that never went away. */
      var known=(S.cfBiz===bid&&Array.isArray(S.cfRows))?S.cfRows.length:null;
      if(del.error||!del.data||(known!==null&&known>0&&del.data.length===0)){
        S.cfSaving=false; repaint();
        toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء'));
        return;
      }
      c.from('client_service_fees').insert(out).select('id').then(function(ins){
        S.cfSaving=false;
        if(ins.error||!ins.data||ins.data.length!==out.length){
          toast(fl('Saving the new rates FAILED after the old ones were cleared — this client has no saved rates right now. Fix and press Save again.',
                   'فشل حفظ الأسعار الجديدة بعد مسح القديمة — لا توجد الآن أسعار محفوظة لهذا العميل. صحّح ثم احفظ مرة أخرى.'));
          loadClientFees(); repaint(); return;
        }
        toast(fl('Saved '+out.length+' rates as this client\'s rates','تم حفظ '+out.length+' من الأسعار كأسعار هذا العميل'));
        loadClientFees(); repaint();
      });
    });
  };

  /* ---------- persistence (B2: every write .select()-checked) ---------- */
  function rowFromState(){
    return {
      family:'SFP', doc_type:'service_fee_proposal',
      business_id:S.cur.clientId||null,
      title:(S.cur.titleEn||S.cur.titleAr||T[S.cur.lang||'en'].cover),
      payload:S.cur, status:S.status||'draft',
      doc_number:S.docNumber||null,
      updated_at:new Date().toISOString(),
      updated_by:(window.__userEmail||null)
    };
  }
  function refusedMsg(){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); }
  window.sfSaveDraft=function(then){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.saving)return; S.saving=true; repaintBar();
    var rec=rowFromState();
    var done=function(ok,row){
      S.saving=false;
      if(!ok){ refusedMsg(); repaintBar(); return; }
      if(row&&row.id)S.rowId=row.id;
      loadList(true); repaint();
      toast(fl('Saved to the proposals registry','تم الحفظ في سجل العروض'));
      if(typeof then==='function')then();
    };
    if(S.rowId){
      c.from('generated_documents').update(rec).eq('id',S.rowId).select().then(function(r){
        done(!r.error&&r.data&&r.data.length===1, r.data&&r.data[0]);
      });
    }else{
      rec.created_by=(window.__userEmail||null);
      c.from('generated_documents').insert(rec).select().then(function(r){
        done(!r.error&&r.data&&r.data.length===1, r.data&&r.data[0]);
      });
    }
  };
  /* number assigned ONLY here, server-side, at issue time */
  window.sfIssue=function(){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.docNumber){ toast(fl('Already issued as '+S.docNumber,'صدر مسبقاً برقم '+S.docNumber)); return; }
    var go=function(){
      c.rpc('next_document_number',{p_family:'SFP'}).then(function(r){
        if(r.error||!r.data){ toast(fl('Numbering was refused — the proposal stays a draft','رُفض الترقيم — يبقى العرض مسودة')); return; }
        var no=r.data;
        c.from('generated_documents')
         .update({doc_number:no,status:'sent',updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
         .eq('id',S.rowId).select().then(function(u){
            if(u.error||!u.data||u.data.length!==1){ refusedMsg(); return; }
            S.docNumber=no; S.status='sent';
            loadList(true); repaint();
            toast(fl('Issued: '+no,'صدر العرض: '+no));
         });
      });
    };
    if(S.rowId) window.sfSaveDraft(go); else window.sfSaveDraft(function(){ if(S.rowId)go(); });
  };
  window.sfOpen=function(id){
    var rec=(S.list||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    S.cur=Object.assign(blankProp(),rec.payload);
    if(!S.cur.sections||!S.cur.sections.length)S.cur.sections=[blankSection()];
    if(!S.cur.col2)S.cur.col2={on:false,head1En:'',head1Ar:'',headEn:'',headAr:''};
    S.rowId=rec.id; S.docNumber=rec.doc_number||null; S.status=rec.status||'draft';
    loadClientFees();
    repaint();
  };
  window.sfNew=function(){ S.cur=blankProp(); S.rowId=null; S.docNumber=null; S.status='draft'; loadClientFees(); repaint(); };

  /* ---------- form mutation ---------- */
  window.sfSet=function(k,v){
    S.cur[k]=v;
    if(k==='clientId'){ loadClientFees(); repaint(); return; }
    repaintPreview();
  };
  window.sfCol2=function(k,v){ S.cur.col2[k]=(k==='on')?!!v:v; if(k==='on')repaint(); else repaintPreview(); };
  window.sfSecSet=function(si,k,v){ if(S.cur.sections[si]){ S.cur.sections[si][k]=v; repaintPreview(); } };
  window.sfRowSet=function(si,ri,k,v){
    var s=S.cur.sections[si]; if(!s||!s.rows[ri])return;
    s.rows[ri][k]=(k==='total'||k==='free')?!!v:v;
    if(k==='total'||k==='free')repaint(); else repaintPreview();
  };
  window.sfSec=function(op,si){
    var A=S.cur.sections;
    if(op==='add')A.push(blankSection());
    else if(op==='rm'){ A.splice(si,1); if(!A.length)A.push(blankSection()); }
    else if(op==='up'&&si>0){ var a=A[si-1];A[si-1]=A[si];A[si]=a; }
    else if(op==='down'&&si<A.length-1){ var b=A[si+1];A[si+1]=A[si];A[si]=b; }
    repaint();
  };
  window.sfRow=function(op,si,ri){
    var s=S.cur.sections[si]; if(!s)return; var L=s.rows;
    if(op==='add')L.push(blankRow());
    else if(op==='rm'){ L.splice(ri,1); if(!L.length)L.push(blankRow()); }
    else if(op==='up'&&ri>0){ var a=L[ri-1];L[ri-1]=L[ri];L[ri]=a; }
    else if(op==='down'&&ri<L.length-1){ var b=L[ri+1];L[ri+1]=L[ri];L[ri]=b; }
    repaint();
  };
  window.sfLang=function(l){ S.cur.lang=l; repaint(); };

  /* Professional print name: "Direct — Service-Fee Proposal <no|DRAFT> — <client>" */
  function pdfName(){
    var cn=docClientName('en')||docClientName('ar');
    return 'Direct — Service-Fee Proposal '+(S.docNumber||'DRAFT')+(cn?' — '+cn:'');
  }
  window.sfPrint=function(){
    var t0=document.title;
    var restore=function(){ try{ document.title=t0; }catch(_){} };
    try{
      document.title=pdfName();
      window.addEventListener('afterprint',function h(){ restore(); window.removeEventListener('afterprint',h); });
      window.print();
    }catch(_){}
    setTimeout(restore,2000);
  };

  /* ---------- render: css (var(--…) only for brand colours) ---------- */
  function css(){ return '<style id="sfCss">'+
    '#sfWrap{display:grid;grid-template-columns:400px 1fr;gap:18px;align-items:start}'+
    '@media(max-width:1100px){#sfWrap{grid-template-columns:1fr}}'+
    '#sfPreviewCol{min-width:0;overflow-x:auto}'+
    '#sfWrap .sf-form label{display:block;font-weight:700;font-size:12px;margin:10px 0 4px;color:var(--ink)}'+
    '#sfWrap .sf-form input,#sfWrap .sf-form select,#sfWrap .sf-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--hairline,#ddd);border-radius:9px;padding:8px 10px;font-size:13.5px;font-family:inherit;background:var(--surface,#fff);color:var(--ink)}'+
    '#sfWrap .sf-form textarea{min-height:70px;resize:vertical}'+
    '#sfWrap .sf-seg{display:flex;border:1px solid var(--hairline,#ddd);border-radius:10px;overflow:hidden;margin-top:4px}'+
    '#sfWrap .sf-seg button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted,#777)}'+
    '#sfWrap .sf-seg button.on{background:var(--accent);color:#fff}'+
    '#sfWrap fieldset{border:1px solid var(--hairline,#ddd);border-radius:12px;margin:14px 0 0;padding:10px 12px 12px}'+
    '#sfWrap legend{font-weight:800;font-size:12px;padding:0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}'+
    '#sfWrap .sf-sec{border:1px solid var(--hairline,#ddd);border-radius:10px;padding:9px;margin-bottom:10px;background:var(--wash,#f7f7f7)}'+
    '#sfWrap .sf-row{border:1px dashed var(--hairline,#ccc);border-radius:9px;padding:8px;margin:8px 0;background:var(--surface,#fff)}'+
    '#sfWrap .rm{float:inline-end;border:0;background:none;color:#D92D20;font-weight:700;cursor:pointer;font-size:12px}'+
    '#sfWrap .mv{float:inline-end;border:0;background:none;color:var(--muted,#777);cursor:pointer;font-size:13px;font-weight:700;padding:0 4px}'+
    '#sfWrap .sf-add{width:100%;border:1px dashed var(--accent);background:var(--wash-accent,#fff6f0);color:var(--accent);font-weight:800;border-radius:10px;padding:8px;cursor:pointer;font-size:13px}'+
    '#sfWrap .sf-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
    '#sfWrap .sf-status{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:800}'+
    '#sfWrap .sf-status.draft{background:var(--wash,#eee);color:var(--muted,#777)}'+
    '#sfWrap .sf-status.sent{background:var(--wash-accent,#fff3ec);color:var(--accent)}'+
    '#sfWrap .sf-status.accepted{background:#EAF6EE;color:#1E7A34}'+
    '#sfWrap .sf-flags{display:flex;gap:14px;margin-top:6px;font-size:12px}'+
    '#sfWrap .sf-flags label{display:flex;align-items:center;gap:6px;margin:0;font-weight:600}'+
    '#sfWrap .sf-flags input{width:auto}'+
    /* --- A4 preview, Classic identity --- */
    '#sfPages{display:flex;flex-direction:column;gap:20px;align-items:center;overflow-x:auto}'+
    '#sfPages .sf-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.15));position:relative;display:flex;flex-direction:column;flex:none;color:var(--ink)}'+
    '#sfPages .sf-page.ar{direction:rtl;font-family:var(--font-ar,serif)}'+
    '#sfPages .sf-page.en{direction:ltr;font-family:var(--font-en,sans-serif)}'+
    /* full-bleed brand-primary cover / back-cover (real Family-A design) */
    '#sfPages .sf-page.grad{background:var(--accent);color:#fff}'+
    '#sfPages .sf-cvr{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 60px 44px}'+
    '#sfPages .sf-cvr .lg{width:210px}'+
    '#sfPages .sf-cvr .mid{margin:auto 0}'+
    '#sfPages .sf-cvr .t{font-size:40px;font-weight:800;line-height:1.35;margin:0}'+
    '#sfPages .sf-cvr .t span{display:block}'+
    '#sfPages .sf-cvr .yr{font-size:22px;opacity:.95;margin-top:6px}'+
    '#sfPages .sf-cvr .sw{width:250px;height:20px;border-bottom:2.5px solid rgba(255,255,255,.92);border-radius:0 0 55% 55%/0 0 100% 100%;margin:8px auto 0}'+
    '#sfPages .sf-cvr .qrb{margin-top:auto}'+
    '#sfPages .sf-cvr .qrb img{width:74px;height:74px;background:#fff;padding:5px;border-radius:10px;display:block;margin:0 auto}'+
    '#sfPages .sf-content{flex:1;display:flex;flex-direction:column;padding:44px 56px 104px}'+
    '#sfPages .sf-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}'+
    '#sfPages .sf-head img{height:34px}'+
    '#sfPages .sf-head .m{font-size:11.5px;color:var(--muted)}'+
    '#sfPages .sf-h2{text-align:center;margin:0 0 4px;font-size:24px;font-weight:800}'+
    '#sfPages .sf-h2 .dia{color:var(--accent);font-size:14px;vertical-align:middle}'+
    '#sfPages .sf-sub{text-align:center;color:var(--muted);margin:0 0 24px;font-size:14px}'+
    '#sfPages .sf-lead{font-size:14px;line-height:1.9;color:var(--ink);margin:0 0 20px}'+
    '#sfPages table.sf-id{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:18px}'+
    '#sfPages table.sf-id td{padding:8px 10px;border-bottom:1px solid var(--hairline)}'+
    '#sfPages table.sf-id td.k{color:var(--muted);white-space:nowrap;width:40%}'+
    '#sfPages table.sf-id td.v{font-weight:700}'+
    '#sfPages .sf-sechead{margin:22px 0 8px;font-size:16px;font-weight:800;color:var(--accent)}'+
    '#sfPages table.sf-fee{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:13.5px}'+
    '#sfPages table.sf-fee th{background:var(--accent-strong);color:#fff;font-weight:700;padding:9px 12px;font-size:12.5px}'+
    '#sfPages table.sf-fee th:first-child{border-start-start-radius:999px;border-end-start-radius:999px}'+
    '#sfPages table.sf-fee th:last-child{border-start-end-radius:999px;border-end-end-radius:999px}'+
    '#sfPages table.sf-fee td{background:var(--wash);padding:9px 12px;text-align:center}'+
    '#sfPages table.sf-fee tr:nth-child(even) td{background:var(--wash-accent)}'+   /* zebra */
    '#sfPages table.sf-fee td.svc{text-align:start;font-weight:600}'+
    '#sfPages table.sf-fee td.amt{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--accent)}'+
    '#sfPages table.sf-fee td.amt .fr{color:var(--accent);letter-spacing:.04em}'+
    '#sfPages .sf-totnote{display:block;font-size:10.5px;font-weight:600;color:var(--muted)}'+
    '#sfPages .sf-terms{margin-top:26px;background:var(--wash);border-inline-start:4px solid var(--accent);border-radius:10px;padding:13px 16px;font-size:12px;line-height:1.8;color:var(--muted)}'+
    '#sfPages .sf-terms b{display:block;color:var(--ink);font-size:12.5px;margin-bottom:4px}'+
    /* real-design footer strip: QR · email/site · branches · Arabic legal block */
    '#sfPages .sf-foot{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:12px 40px 14px;font-size:9.5px;color:var(--muted);box-sizing:border-box;border-top:1px solid var(--hairline)}'+
    '#sfPages .sf-foot .fq{width:44px;height:44px;flex:none}'+
    '#sfPages .sf-foot .fc{line-height:1.7;white-space:nowrap}'+
    '#sfPages .sf-foot .fb{flex:1;text-align:center;line-height:1.6}'+
    '#sfPages .sf-foot .fl{text-align:right;line-height:1.7;white-space:nowrap}'+
    /* commitments/signature CONTENT page (the deck now closes with the back-cover) */
    '#sfPages .sf-slahead{font-size:20px;font-weight:800;margin:6px 0 12px;color:var(--accent)}'+
    '#sfPages .sf-sla{font-size:15px;line-height:2.2;margin:0 0 22px;padding:0;list-style:none}'+
    '#sfPages .sf-sla li:before{content:"◆  ";font-size:11px;color:var(--accent)}'+
    '#sfPages .sf-contact{font-size:14px;line-height:2;border-top:1px solid var(--hairline);padding-top:16px;margin-bottom:26px;color:var(--ink)}'+
    '#sfPages .sf-sign{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:auto}'+
    '#sfPages .sf-sign .pt{border:1.5px solid var(--accent);border-radius:12px;padding:16px 18px;font-size:13.5px}'+
    '#sfPages .sf-sign .pt b{display:block;font-size:15px;margin-bottom:10px;color:var(--accent)}'+
    '#sfPages .sf-sign .ln{display:flex;gap:8px;border-bottom:1px dashed var(--hairline,#bbb);margin:16px 0 0;padding-bottom:4px}'+
    '#sfPages .sf-draftmark{position:absolute;top:18px;inset-inline-end:18px;background:rgba(255,255,255,.9);color:var(--muted);font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;border:1px dashed var(--muted);z-index:2}'+
    '#sfPages .sf-wm{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;overflow:hidden;z-index:1}'+
    '#sfPages .sf-wm span{font-size:150px;font-weight:800;letter-spacing:.1em;color:var(--muted);opacity:.10;transform:rotate(-32deg);white-space:nowrap;user-select:none}'+
    '@media print{'+
      'body *{visibility:hidden}'+
      '#sfPages,#sfPages *{visibility:visible}'+
      '#sfPages{position:absolute;left:0;top:0;display:block}'+
      '#sfPages .sf-page{width:auto;box-shadow:none;margin:0;page-break-after:always}'+
      '#sfPages .sf-page.grad{min-height:0;height:99.3vh;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '#sfPages .sf-page:not(.grad){height:auto;min-height:99.3vh}'+
      '#sfPages .sf-page:last-child{page-break-after:auto}'+
      '#sfPages table.sf-fee tr{page-break-inside:avoid}'+
      '#sfPages table.sf-fee th,#sfPages table.sf-fee tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '}'+
    '@page{size:A4;margin:0}'+
    '</style>'; }

  /* ---------- render: preview pages ---------- */
  function feeCell(row,val,t){
    if(row.free)return '<span class="fr">'+t.free+'</span>';
    if(val===''||val==null)return '—';
    var n=Number(val);
    if(!isFinite(n))return esc(String(val));
    if(n===0)return '<span class="fr">'+t.free+'</span>';
    return fmt(n);
  }
  function pagesHtml(){
    var lang=S.cur.lang||'en', t=T[lang], ar=lang==='ar';
    var dirCls=ar?'ar':'en';
    var title=(ar?S.cur.titleAr:S.cur.titleEn)||t.cover;
    var cn=docClientName(lang);
    var issued=!!S.docNumber, no=S.docNumber||'—';
    var draftMark=issued?'':'<div class="sf-draftmark">'+t.draft+'</div>';
    var wm=issued?'':'<div class="sf-wm"><span>'+t.wm+'</span></div>';
    var site=idv('website','en')||'www.directksa.com';
    var phone=idv('phone_licence','en');
    var mail=idv('email','en');
    var addr=idv('address',lang)||idv('address','en');
    var legal=idv('legal_name',lang);
    var crL=idv('cr_number','en'), vatL=idv('vat_number','en');
    var footer=footHtml();

    /* page 1 — real Family-A cover: full-bleed brand orange, white logo top-center,
       stacked centered title + "For {client}" with the thin curved underline, QR
       bottom-center. NO date, number or contact on the cover. */
    var cover=
    '<div class="sf-page grad '+dirCls+'">'+draftMark+'<div class="sf-cvr">'+
      '<img class="lg" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="mid"><h1 class="t"><span>'+esc(title)+'</span>'+
        (cn?'<span>'+t.prepFor+'</span><span>'+esc(cn)+'</span>':'')+
      '</h1><div class="sw"></div>'+
      (S.cur.year?'<div class="yr">'+esc(S.cur.year)+'</div>':'')+'</div>'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';

    /* page 2 — About Direct: identity rows flagged show_on_documents (never sensitive) */
    var showRows=(S.identity||[]).filter(function(r){ return r.show_on_documents&&!r.sensitive; });
    var idHtml=showRows.length?('<table class="sf-id">'+showRows.map(function(r){
        var lb=ar&&r.label_ar?r.label_ar:(r.label_en||r.key);
        var v=ar&&r.value_ar?r.value_ar:(r.value_en||r.value_ar||'—');
        return '<tr><td class="k">'+esc(lb)+'</td><td class="v">'+esc(v)+'</td></tr>';
      }).join('')+'</table>')
      :'<div class="sf-lead" style="color:var(--muted)">'+fl('Company identity rows marked "show on documents" appear here.','تظهر هنا بيانات الشركة المحددة للعرض على المستندات.')+'</div>';
    var about=
    '<div class="sf-page '+dirCls+'">'+wm+'<div class="sf-content">'+
      '<div class="sf-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
        '<div class="m">'+t.no+' '+esc(issued?no:t.draftPill)+'</div></div>'+
      '<h2 class="sf-h2"><span class="dia">◆</span> '+t.about+' <span class="dia">◆</span></h2>'+
      '<p class="sf-lead">'+esc(t.aboutLead)+'</p>'+
      idHtml+footer+
    '</div></div>';

    /* fee-table pages — one page per group of sections */
    var col2=S.cur.col2&&S.cur.col2.on;
    var h2en=(S.cur.col2&&S.cur.col2.headEn)||'', h2ar=(S.cur.col2&&S.cur.col2.headAr)||'';
    var head;
    if(col2){
      /* dual-rate columns: # | Service | first fee | custom-headed second fee.
         The scenario's own column headers seed col2; both stay editable. */
      var c1en=(S.cur.col2&&S.cur.col2.head1En)||'', c1ar=(S.cur.col2&&S.cur.col2.head1Ar)||'';
      head='<tr><th>'+t.num+'</th><th>'+t.svc+'</th>'+
        '<th>'+esc(ar?(c1ar||c1en||'الرسوم (ريال)'):(c1en||c1ar||'Fee (SAR)'))+'</th>'+
        '<th>'+esc(ar?(h2ar||h2en):(h2en||h2ar))+'</th></tr>';
    }else{
      head='<tr><th>'+t.num+'</th><th>'+t.svc+'</th><th>'+(ar?'الرسوم (ريال)':'Fee (SAR)')+'</th></tr>';
    }
    var secsHtml=(S.cur.sections||[]).map(function(sec){
      var rows=(sec.rows||[]).filter(function(r){return r.en||r.ar||r.fee!==''||r.fee2!=='';});
      if(!rows.length)return '';
      var body=rows.map(function(r,i){
        var svc=ar?(r.ar||r.en):(r.en||r.ar);
        var note=r.total?'<span class="sf-totnote">'+t.totalNote+'</span>':'';
        /* per-client rate extras: unit · Discount X% · notes (from client_service_fees) */
        var extras=[];
        var u=ar?(r.unitAr||r.unitEn):(r.unitEn||r.unitAr); if(u)extras.push(u);
        if(r.disc!=null&&String(r.disc).trim()!=='')
          extras.push(ar?('خصم ٪'+String(r.disc)):('Discount: '+String(r.disc)+'%'));
        if(r.noteTxt)extras.push(r.noteTxt);
        if(extras.length)note+='<span class="sf-totnote">'+esc(extras.join(' · '))+'</span>';
        return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(svc)+note+'</td>'+
          '<td class="amt">'+feeCell(r,r.fee,t)+'</td>'+
          (col2?'<td class="amt">'+feeCell(r,r.fee2,t)+'</td>':'')+'</tr>';
      }).join('');
      var st=ar?(sec.tAr||sec.tEn):(sec.tEn||sec.tAr);
      return (st?'<div class="sf-sechead">'+esc(st)+'</div>':'')+
        '<table class="sf-fee"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
    }).join('');
    var feePage=
    '<div class="sf-page '+dirCls+'">'+wm+'<div class="sf-content">'+
      '<div class="sf-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
        '<div class="m">'+t.no+' '+esc(issued?no:t.draftPill)+'</div></div>'+
      '<h2 class="sf-h2"><span class="dia">◆</span> '+t.fees+' <span class="dia">◆</span></h2>'+
      '<p class="sf-sub">'+esc(cn||'')+(S.cur.year?' · '+esc(S.cur.year):'')+'</p>'+
      (secsHtml||'<div class="sf-lead" style="color:var(--muted);text-align:center">'+fl('Pick a scenario or add services — the tables appear here.','اختر سيناريو أو أضف خدمات — تظهر الجداول هنا.')+'</div>')+
      '<div class="sf-terms"><b>'+t.termsHead+'</b>'+esc(t.terms)+
        (S.cur.notes?'<div style="margin-top:8px"><b>'+t.notesHead+'</b>'+esc(S.cur.notes)+'</div>':'')+'</div>'+
      footer+
    '</div></div>';

    /* commitments page — SLA + contacts + signature block, now a CONTENT page
       (the real decks close with a bare back-cover, not a text page) */
    var contactLines=[addr,mail,site,phone].filter(Boolean).map(function(x){return esc(x);}).join('<br>');
    function party(label){
      return '<div class="pt"><b>'+label+'</b>'+
        '<div class="ln">'+t.signName+':</div>'+
        '<div class="ln">'+t.signTitle+':</div>'+
        '<div class="ln">'+t.signSig+':</div>'+
        '<div class="ln">'+t.signDate+':</div></div>';
    }
    var commitPage=
    '<div class="sf-page '+dirCls+'">'+wm+'<div class="sf-content">'+
      '<div class="sf-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
        '<div class="m">'+t.no+' '+esc(issued?no:t.draftPill)+'</div></div>'+
      '<h2 class="sf-h2"><span class="dia">◆</span> '+t.slaHead+' <span class="dia">◆</span></h2>'+
      '<ul class="sf-sla">'+t.sla.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
      '<div class="sf-contact"><b>'+t.contactsHead+'</b><br>'+(contactLines||'&nbsp;')+'</div>'+
      '<div class="sf-sign">'+party(t.partyA)+party(t.partyB)+'</div>'+
      footer+
    '</div></div>';

    /* back-cover — full-bleed orange, white logo centered, QR bottom-center */
    var closing=
    '<div class="sf-page grad '+dirCls+'">'+draftMark+'<div class="sf-cvr">'+
      '<img class="lg" style="margin:auto 0" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';

    return cover+about+feePage+commitPage+closing;
  }

  /* ---------- render: form ---------- */
  function rowHtml(r,si,ri){
    return '<div class="sf-row">'+
      '<button type="button" class="rm" onclick="sfRow(\'rm\','+si+','+ri+')">✕</button>'+
      '<button type="button" class="mv" onclick="sfRow(\'down\','+si+','+ri+')">↓</button>'+
      '<button type="button" class="mv" onclick="sfRow(\'up\','+si+','+ri+')">↑</button>'+
      '<label>'+fl('Service (EN)','الخدمة بالإنجليزية')+'</label><input value="'+esc(r.en)+'" oninput="sfRowSet('+si+','+ri+',\'en\',this.value)">'+
      '<label>'+fl('Service (AR)','الخدمة بالعربية')+'</label><input dir="rtl" value="'+esc(r.ar)+'" oninput="sfRowSet('+si+','+ri+',\'ar\',this.value)">'+
      '<div class="sf-row2">'+
      '<div><label>'+fl('Fee (SAR or %)','الرسوم (ريال أو ٪)')+'</label><input type="text" inputmode="decimal" value="'+esc(r.fee)+'" oninput="sfRowSet('+si+','+ri+',\'fee\',this.value)"></div>'+
      (S.cur.col2&&S.cur.col2.on?'<div><label>'+fl('Second fee (SAR)','الرسوم الثانية (ريال)')+'</label><input type="text" inputmode="decimal" value="'+esc(r.fee2)+'" oninput="sfRowSet('+si+','+ri+',\'fee2\',this.value)"></div>':'')+
      '</div>'+
      '<div class="sf-flags">'+
        '<label><input type="checkbox" '+(r.total?'checked':'')+' onchange="sfRowSet('+si+','+ri+',\'total\',this.checked)"> '+fl('Total (all-inclusive)','إجمالي (شامل)')+'</label>'+
        '<label><input type="checkbox" '+(r.free?'checked':'')+' onchange="sfRowSet('+si+','+ri+',\'free\',this.checked)"> '+fl('Free','مجاني')+'</label>'+
      '</div>'+
    '</div>';
  }
  function secHtml(sec,si){
    return '<div class="sf-sec">'+
      '<button type="button" class="rm" onclick="sfSec(\'rm\','+si+')">✕</button>'+
      '<button type="button" class="mv" onclick="sfSec(\'down\','+si+')">↓</button>'+
      '<button type="button" class="mv" onclick="sfSec(\'up\','+si+')">↑</button>'+
      '<label>'+fl('Section title (EN)','عنوان القسم بالإنجليزية')+'</label><input value="'+esc(sec.tEn)+'" placeholder="Flights / Hotels / Visas…" oninput="sfSecSet('+si+',\'tEn\',this.value)">'+
      '<label>'+fl('Section title (AR)','عنوان القسم بالعربية')+'</label><input dir="rtl" value="'+esc(sec.tAr)+'" oninput="sfSecSet('+si+',\'tAr\',this.value)">'+
      (sec.rows||[]).map(function(r,ri){ return rowHtml(r,si,ri); }).join('')+
      '<button type="button" class="sf-add" onclick="sfRow(\'add\','+si+')">+ '+fl('Add service row','إضافة سطر خدمة')+'</button>'+
    '</div>';
  }
  function clientOptions(){
    var bs; try{ bs=(DB.businesses||[]).slice(); }catch(_){ bs=[]; }
    var clients=bs.filter(function(b){return b.isClient;});
    var leads=bs.filter(function(b){return !b.isClient;});
    function opts(list){ return list.map(function(b){
      var nm=isAr()&&b.nameAr?b.nameAr:(b.name||b.nameAr||'');
      return '<option value="'+esc(b.id)+'" '+(S.cur.clientId===b.id?'selected':'')+'>'+esc(nm)+'</option>';
    }).join(''); }
    return '<option value="">'+fl('— pick from the app\'s records —','— اختر من سجلات التطبيق —')+'</option>'+
      (clients.length?'<optgroup label="'+fl('Clients','العملاء')+'">'+opts(clients)+'</optgroup>':'')+
      (leads.length?'<optgroup label="'+fl('Leads','العملاء المحتملون')+'">'+opts(leads)+'</optgroup>':'');
  }
  function scenarioOptions(){
    var list=S.scenarios;
    if(list===null)return '<option value="">'+fl('Loading scenarios…','جارٍ تحميل السيناريوهات…')+'</option>';
    return '<option value="">'+fl('— choose a scenario —','— اختر سيناريو —')+'</option>'+
      (list||[]).map(function(s){
        return '<option value="'+esc(s.id)+'" '+(S.cur.scenarioId===s.id?'selected':'')+'>'+esc(isAr()?(s.name_ar||s.name_en):(s.name_en||s.name_ar))+'</option>';
      }).join('');
  }
  function savedOptions(){
    var list=S.list||[];
    return '<option value="">'+
      (list.length?fl('— open a saved proposal ('+list.length+') —','— افتح عرضاً محفوظاً ('+list.length+') —')
                  :fl('— no saved proposals yet —','— لا توجد عروض محفوظة بعد —'))+'</option>'+
      list.map(function(o){
        var label=(o.doc_number||fl('draft','مسودة'))+' · '+(bizName(o.business_id)||o.title||'')+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'" '+(S.rowId===o.id?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }
  /* the per-client rates note + Load/Save buttons under the client picker */
  function clientRatesHtml(){
    if(!S.cur.clientId)return '';
    var h='';
    if(S.cfLoading)
      h+='<div style="margin-top:8px;font-size:12px;color:var(--muted,#777)">'+fl('Checking saved rates…','جارٍ التحقق من الأسعار المحفوظة…')+'</div>';
    if(S.cfRows&&S.cfRows.length){
      h+='<div style="margin-top:8px;font-size:12.5px;font-weight:700;color:var(--accent)">'+
           fl('This client has saved rates','لهذا العميل أسعار محفوظة')+' ('+S.cfRows.length+')</div>'+
         '<button type="button" class="btn sm ghost" style="margin-top:6px" onclick="sfLoadClientRates()">'+
           fl('Load saved rates','تحميل الأسعار المحفوظة')+'</button>';
    }
    var hasRows=(S.cur.sections||[]).some(function(s){
      return (s.rows||[]).some(function(r){return r.en||r.ar||String(r.fee==null?'':r.fee).trim()!=='';});
    });
    if(hasRows&&canWrite()){
      h+='<div style="margin-top:6px"><button type="button" class="btn sm ghost" '+(S.cfSaving?'disabled':'')+' onclick="sfSaveClientRates()">'+
         (S.cfSaving?fl('Saving…','جارٍ الحفظ…'):fl('Save as this client\'s rates','حفظ كأسعار هذا العميل'))+'</button></div>';
    }
    return h;
  }
  function formHtml(){
    var st=S.status||'draft';
    var stLabel=st==='draft'?fl('Draft','مسودة'):st==='sent'?fl('Issued / sent','صادر / مُرسل'):fl('Accepted','مقبول');
    return '<div class="card sf-form">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<b>'+fl('Service-Fee Proposal','عرض رسوم الخدمات')+'</b>'+
        '<span class="sf-status '+esc(st)+'">'+stLabel+(S.docNumber?' · '+esc(S.docNumber):'')+'</span>'+
      '</div>'+
      '<label>'+fl('Saved proposals','العروض المحفوظة')+'</label>'+
      '<select onchange="if(this.value)sfOpen(this.value)">'+savedOptions()+'</select>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" onclick="sfNew()">＋ '+fl('New','جديد')+'</button>'+
      '</div>'+
      '<label>'+fl('Document language','لغة المستند')+'</label>'+
      '<div class="sf-seg">'+
        '<button type="button" class="'+((S.cur.lang||'en')==='en'?'on':'')+'" onclick="sfLang(\'en\')">English</button>'+
        '<button type="button" class="'+(S.cur.lang==='ar'?'on':'')+'" onclick="sfLang(\'ar\')">العربية</button>'+
      '</div>'+
      '<fieldset><legend>'+fl('Client','العميل')+'</legend>'+
        '<label>'+fl('Company','الشركة')+'</label>'+
        '<select onchange="sfSet(\'clientId\',this.value)">'+clientOptions()+'</select>'+
        '<div id="sfClientRates">'+clientRatesHtml()+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Proposal','العرض')+'</legend>'+
        '<label>'+fl('Title (EN)','العنوان بالإنجليزية')+'</label>'+
        '<input value="'+esc(S.cur.titleEn)+'" placeholder="Service-Fee Proposal" oninput="sfSet(\'titleEn\',this.value)">'+
        '<label>'+fl('Title (AR)','العنوان بالعربية')+'</label>'+
        '<input dir="rtl" value="'+esc(S.cur.titleAr)+'" placeholder="عرض رسوم الخدمات" oninput="sfSet(\'titleAr\',this.value)">'+
        '<div class="sf-row2">'+
          '<div><label>'+fl('Year','السنة')+'</label><input value="'+esc(S.cur.year)+'" oninput="sfSet(\'year\',this.value)"></div>'+
          '<div><label>'+fl('Valid until','صالح حتى')+'</label><input type="date" value="'+esc(S.cur.validity)+'" oninput="sfSet(\'validity\',this.value)"></div>'+
        '</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Scenario','السيناريو')+'</legend>'+
        '<label>'+fl('Start from a scenario','ابدأ من سيناريو')+'</label>'+
        '<select onchange="sfSeed(this.value)">'+scenarioOptions()+'</select>'+
        '<div style="margin-top:6px;font-size:11.5px;color:var(--muted,#777)">'+
          fl('Scenarios carry the approved fee sets. Nothing is hardcoded to any client — every fee stays editable.',
             'تحمل السيناريوهات الرسوم المعتمدة. لا شيء ثابت لأي عميل — كل الرسوم قابلة للتعديل.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Fee columns','أعمدة الرسوم')+'</legend>'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" style="width:auto" '+(S.cur.col2&&S.cur.col2.on?'checked':'')+' onchange="sfCol2(\'on\',this.checked)"> '+fl('Second fee column (dual-rate)','عمود رسوم ثانٍ (تسعيرة مزدوجة)')+'</label>'+
        (S.cur.col2&&S.cur.col2.on?
          '<label>'+fl('First column header (EN)','عنوان العمود الأول بالإنجليزية')+'</label>'+
          '<input value="'+esc(S.cur.col2.head1En||'')+'" placeholder="Company rate" oninput="sfCol2(\'head1En\',this.value)">'+
          '<label>'+fl('First column header (AR)','عنوان العمود الأول بالعربية')+'</label>'+
          '<input dir="rtl" value="'+esc(S.cur.col2.head1Ar||'')+'" placeholder="سعر الشركة" oninput="sfCol2(\'head1Ar\',this.value)">'+
          '<label>'+fl('Second column header (EN)','عنوان العمود الثاني بالإنجليزية')+'</label>'+
          '<input value="'+esc(S.cur.col2.headEn)+'" placeholder="Employee rate" oninput="sfCol2(\'headEn\',this.value)">'+
          '<label>'+fl('Second column header (AR)','عنوان العمود الثاني بالعربية')+'</label>'+
          '<input dir="rtl" value="'+esc(S.cur.col2.headAr)+'" placeholder="سعر الموظف" oninput="sfCol2(\'headAr\',this.value)">':'')+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Fee tables','جداول الرسوم')+'</legend>'+
        (S.cur.sections||[]).map(secHtml).join('')+
        '<button type="button" class="sf-add" onclick="sfSec(\'add\')">+ '+fl('Add section','إضافة قسم')+'</button>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Notes','ملاحظات')+'</legend>'+
        '<textarea oninput="sfSet(\'notes\',this.value)" placeholder="'+esc(fl('Extra notes shown under the standard terms','ملاحظات إضافية تظهر أسفل الشروط القياسية'))+'">'+esc(S.cur.notes)+'</textarea>'+
      '</fieldset>'+
      '<div id="sfBar" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+barHtml()+'</div>'+
      '<div style="margin-top:10px;font-size:11.5px;color:var(--muted,#777);line-height:1.5">'+
        fl('All listed fees are service fees, ex-VAT. Tax invoices come from Direct Payment.',
           'جميع الرسوم رسوم خدمات غير شاملة الضريبة. الفواتير الضريبية تصدر من دايركت للمدفوعات.')+'</div>'+
    '</div>';
  }
  function barHtml(){
    var w=canWrite();
    return (w?'<button class="btn sm pri" '+(S.saving?'disabled':'')+' onclick="sfSaveDraft()">'+(S.saving?fl('Saving…','جارٍ الحفظ…'):fl('Save draft','حفظ المسودة'))+'</button>':'')+
      (w&&!S.docNumber?'<button class="btn sm ghost" data-v21relabeled="true" onclick="sfIssue()">'+fl('Issue proposal','إصدار العرض')+'</button>':'')+
      '<button class="btn sm ghost" onclick="sfPrint()">'+fl('Print / PDF','طباعة / PDF')+'</button>';
  }

  /* ---------- render: tab body + targeted repaints ---------- */
  function tabHtml(){
    loadIdentity(); loadScenarios(); loadList();
    return css()+
      '<div id="sfWrap">'+
        '<div>'+formHtml()+'</div>'+
        '<div id="sfPreviewCol" data-identity="classic"><div id="sfPages">'+pagesHtml()+'</div></div>'+
      '</div>';
  }
  function repaint(){ try{ if(typeof current!=='undefined'&&current==='documents')render(); }catch(_){} }
  function repaintPreview(){
    var el=document.getElementById('sfPages');
    if(el)el.innerHTML=pagesHtml(); else repaint();
  }
  function repaintBar(){
    var el=document.getElementById('sfBar');
    if(el)el.innerHTML=barHtml();
  }

  /* ---------- register through the js/66 seam ---------- */
  if(typeof window.dgRegisterTab==='function'){
    window.dgRegisterTab('fees', tabHtml);
  }else{
    console.warn('[sf] dgRegisterTab missing — js/66 not loaded first?');
  }

  console.info('[sf] service-fee proposal tab loaded (generated_documents / SFP)');
}catch(e){ if(window.console)console.warn('[sf] init',e); }})();
