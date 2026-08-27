/* ===== Contract / Agreement tab — the company's own service agreement =====
   (Phase 2, STEP 5, 2026-08-25)

   An Arabic-first legal document (contracts are legally Arabic; EN is a
   courtesy layout choice): letterhead header → title → تمهيد with both party
   blocks → numbered sections in the real signed-agreement order → ملحق الرسوم
   (fee annex, same table shape as js/68, importable from a saved Service-Fee
   proposal for the same client) → two-party signature grid.

   CLAUSE MODEL (the important design decision):
   - The SHARED template lives in `contract_clauses` (RLS: read any role,
     write admin+manager). Each contract SNAPSHOTS the template into its own
     payload when clauses first load.
   - Editing a clause inside a contract is OVERRIDE-ON-EDIT: it changes ONLY
     this contract's payload copy (flagged override:true) and NEVER writes to
     contract_clauses. "Reset to template" per clause restores the shared text.
   - A separate, explicit admin/manager action ("save to shared template")
     is the only path that writes contract_clauses.

   Rules honoured (docs/DECISIONS.md):
   - P5/F1: preview styled ONLY with var(--…) from /brand/tokens.css (injected
     by js/66) under data-identity="classic". No copied brand hexes.
   - F2/F3: NO browser storage. Contracts persist in `generated_documents`
     (family 'CTR'); numbering is server-side via next_document_number('CTR'),
     assigned ONLY at issue time — drafts carry no number.
   - B2: every write chains .select() and checks the returned row count.
   - M8: NO invented legal prose — seeded bodies are neutral one-line
     structural skeletons marked "[يُحرَّر حسب الاتفاق / Edit per agreement]";
     the lawyer's wording is the owner's to supply. Direct's signatory
     name/title are EMPTY by default — an owner decision, never invented.
   - D4: nothing real in this file — clients are picked from DB.businesses;
     party-2 details (CR/rep/title/phone) are typed per contract into the
     payload because the client record may lack them.

   Registers through the js/66 seam: window.dgRegisterTab('contract', renderFn). */
(function(){try{

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function canEditTemplate(){ try{ return ['admin','manager'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function canWrite(){ try{ return ['admin','manager','bd','team_member'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function toast(msg){ try{ if(window.__toast){__toast(msg);return;} }catch(_){}
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink,#333);color:#fff;padding:10px 16px;border-radius:10px;z-index:9999;font-size:14px';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){try{t.remove();}catch(_){}} ,2600);
  }
  function fmt(n){ if(!isFinite(n))return '—'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:2}); }

  /* ---------- bilingual document strings ---------- */
  var T={
    en:{docKind:'Service Agreement',no:'Contract no.',date:'Date',draftPill:'DRAFT',wm:'DRAFT',
        party1:'First party',party2:'Second party',
        cr:'Commercial registration',rep:'Represented by',roleTitle:'Title',phone:'Phone',
        sig:'Signature',sigDate:'Date',annex:'Fee annex',svc:'Service',num:'#',free:'FREE',
        totalNote:'(Total — includes all charges)',clauseWord:'Section'},
    ar:{docKind:'اتفاقية خدمات',no:'رقم العقد',date:'التاريخ',draftPill:'مسودة',wm:'مسودة',
        party1:'الطرف الأول',party2:'الطرف الثاني',
        cr:'السجل التجاري',rep:'يمثلها',roleTitle:'الصفة',phone:'الهاتف',
        sig:'التوقيع',sigDate:'التاريخ',annex:'ملحق الرسوم',svc:'الخدمة',num:'#',free:'مجاناً',
        totalNote:'(شامل جميع الرسوم)',clauseWord:'البند'}
  };

  /* ---------- state ---------- */
  function blankRow(){ return {en:'',ar:'',fee:'',fee2:'',total:false,free:false}; }
  function blankSection(){ return {tEn:'',tAr:'',rows:[blankRow()]}; }
  function blankDoc(){
    return { lang:'ar', clientId:'',
      titleEn:'Travel & Tourism Services Agreement',
      titleAr:'اتفاقية تقديم خدمات سفر وسياحة',
      party1:{rep:'',title:''},                       /* Direct's signatory — owner decision, EMPTY by default */
      party2:{cr:'',rep:'',title:'',phone:''},        /* per-contract; client record may lack them */
      noticeDays:'30',
      clauses:null,                                    /* snapshot of contract_clauses, per-contract copy */
      annex:{ col2:{on:false,head1En:'',head1Ar:'',headEn:'',headAr:''}, sections:[] },
      importedFrom:null };
  }
  var S={ cur:blankDoc(), rowId:null, docNumber:null, status:'draft',
          tpl:null, tplLoading:false, identity:null,
          list:null, listLoading:false,
          sfpList:null, sfpFor:null, sfpLoading:false,
          editKey:null, saving:false };

  /* ---------- data ---------- */
  function loadTemplates(force){
    if(S.tplLoading)return; if(S.tpl&&!force)return;
    var c=client(); if(!c)return;
    S.tplLoading=true;
    c.from('contract_clauses').select('*').order('sort',{ascending:true}).then(function(r){
      S.tplLoading=false;
      S.tpl=r.error?[]:(r.data||[]);
      snapshotClauses();
      repaint();
    });
  }
  /* per-contract snapshot: templates copied ONCE into this contract's payload */
  function snapshotClauses(){
    if(S.cur.clauses!==null)return;
    if(!S.tpl||!S.tpl.length)return;
    S.cur.clauses=S.tpl.map(function(t){
      return { key:t.key, title_en:t.title_en, title_ar:t.title_ar,
        body_en:t.body_en, body_ar:t.body_ar,
        optional:!!t.optional, enabled:!!t.enabled, sort:t.sort, override:false };
    });
  }
  function loadIdentity(){
    if(S.identity!==null)return;
    var c=client(); if(!c)return;
    S.identity=[]; /* in-flight marker */
    c.from('company_identity').select('key,label_en,label_ar,value_en,value_ar,show_on_documents,sensitive,sort')
     .order('sort',{ascending:true}).then(function(r){ S.identity=r.error?[]:(r.data||[]); repaint(); });
  }
  function idv(key,lang){
    var r=(S.identity||[]).find(function(x){return x.key===key;})||{};
    if(lang==='ar') return r.value_ar||r.value_en||'';
    return r.value_en||r.value_ar||'';
  }
  function loadList(force){
    if(S.listLoading)return; if(S.list&&!force)return;
    var c=client(); if(!c)return;
    S.listLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,payload')
     .eq('family','CTR').order('created_at',{ascending:false}).limit(60)
     .then(function(r){ S.listLoading=false; S.list=r.error?[]:(r.data||[]); repaint(); });
  }
  /* saved Service-Fee proposals for the SELECTED client — annex import source */
  function loadSfp(){
    var id=S.cur.clientId;
    if(!id){ S.sfpList=null; S.sfpFor=null; return; }
    if(S.sfpLoading||S.sfpFor===id)return;
    var c=client(); if(!c)return;
    S.sfpLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,payload')
     .eq('family','SFP').eq('business_id',id).order('created_at',{ascending:false}).limit(30)
     .then(function(r){
        S.sfpLoading=false; S.sfpFor=id;
        S.sfpList=r.error?[]:(r.data||[]); repaint();
     });
  }
  function bizName(id,lang){
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===id;});
      if(!b)return '';
      return (lang==='ar'&&b.nameAr)?b.nameAr:(b.name||b.nameAr||''); }catch(_){ return ''; }
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
    return '<div class="ct-foot">'+
      '<img class="fq" src="/brand/direct_qr_directksa.png" alt="" onerror="this.style.display=\'none\'">'+
      '<div class="fc">'+esc(mail)+'<br>'+esc(site)+'</div>'+
      '<div class="fb">You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam</div>'+
      '<div class="fl" dir="rtl">الاسم التجاري: شركة المسافر المباشر للسفر والسياحة<br>'+
        'الرقم الموحد '+esc(unn)+' · رقم الترخيص '+esc(lic)+'</div>'+
    '</div>';
  }

  /* ---------- QA hooks ---------- */
  window.__ctProbe=function(){
    return { tplLoaded:S.tpl!==null,
      clauses:(S.cur.clauses||[]).map(function(c){return {key:c.key,enabled:!!c.enabled,optional:!!c.optional,sort:c.sort,override:!!c.override};}),
      lang:S.cur.lang, clientId:S.cur.clientId||null,
      noticeDays:S.cur.noticeDays,
      annexSections:(S.cur.annex.sections||[]).length,
      importedFrom:S.cur.importedFrom,
      placeholderClauseKeys:(window.__ctPlaceholderClauses?window.__ctPlaceholderClauses():[]).map(function(c){return c.key;}),
      docNumber:S.docNumber, status:S.status };
  };

  /* ---------- persistence (generated_documents, family CTR) ---------- */
  function rowFromState(){
    return {
      family:'CTR', doc_type:'contract',
      business_id:S.cur.clientId||null,
      title:(S.cur.lang==='ar'?(S.cur.titleAr||S.cur.titleEn):(S.cur.titleEn||S.cur.titleAr))||'Contract',
      payload:S.cur, status:S.status||'draft',
      doc_number:S.docNumber||null,
      updated_at:new Date().toISOString(),
      updated_by:(window.__userEmail||null)
    };
  }
  function refusedMsg(){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); }
  window.ctSaveDraft=function(then){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.saving)return; S.saving=true;
    var rec=rowFromState();
    var done=function(ok,row){
      S.saving=false;
      if(!ok){ refusedMsg(); repaint(); return; }
      if(row&&row.id)S.rowId=row.id;
      loadList(true); repaint();
      toast(fl('Saved to the contracts registry','تم الحفظ في سجل العقود'));
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
  /* Guard: a contract must never go out to a client still carrying the
     seeded placeholder wording — "[Edit per agreement]" / "[يُحرَّر حسب الاتفاق]".
     That text is a deliberate, visible flag (M8: no invented legal prose),
     not real legal wording — so Issue is refused while any ENABLED clause
     still carries it, and the editor is told exactly which ones. */
  var PH_EN='Edit per agreement', PH_AR='يُحرَّر حسب الاتفاق';
  function placeholderClauses(){
    return (S.cur.clauses||[]).filter(function(c){
      if(!c.enabled)return false;
      var en=c.body_en||'', ar=c.body_ar||'';
      return en.indexOf(PH_EN)>=0 || ar.indexOf(PH_AR)>=0;
    });
  }
  window.__ctPlaceholderClauses=placeholderClauses; /* QA hook */
  /* number assigned ONLY here, server-side, at issue time */
  window.ctIssue=function(){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.docNumber){ toast(fl('Already issued as '+S.docNumber,'صدر مسبقاً برقم '+S.docNumber)); return; }
    var ph=placeholderClauses();
    if(ph.length){
      var names=ph.map(function(x){return fl(x.title_en||x.key,x.title_ar||x.key);}).join('، ');
      toast(fl('Still has placeholder wording — edit before issuing: '+names,
                'لا تزال تحمل نصاً مبدئياً — حرّرها قبل الإصدار: '+names));
      return;
    }
    var go=function(){
      c.rpc('next_document_number',{p_family:'CTR'}).then(function(r){
        if(r.error||!r.data){ toast(fl('Numbering was refused — the contract stays a draft','رُفض الترقيم — يبقى العقد مسودة')); return; }
        var no=r.data;
        c.from('generated_documents')
         .update({doc_number:no,status:'sent',updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
         .eq('id',S.rowId).select().then(function(u){
            if(u.error||!u.data||u.data.length!==1){ refusedMsg(); return; }
            S.docNumber=no; S.status='sent';
            loadList(true); repaint();
            toast(fl('Issued: '+no,'صدر العقد برقم: '+no));
         });
      });
    };
    if(S.rowId) window.ctSaveDraft(go); else window.ctSaveDraft(function(){ if(S.rowId)go(); });
  };
  window.ctOpen=function(id){
    var rec=(S.list||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    S.cur=Object.assign(blankDoc(),rec.payload);
    if(!S.cur.party1)S.cur.party1={rep:'',title:''};
    if(!S.cur.party2)S.cur.party2={cr:'',rep:'',title:'',phone:''};
    if(!S.cur.annex)S.cur.annex={col2:{on:false,head1En:'',head1Ar:'',headEn:'',headAr:''},sections:[]};
    if(S.cur.clauses===undefined)S.cur.clauses=null;
    snapshotClauses();
    S.rowId=rec.id; S.docNumber=rec.doc_number||null; S.status=rec.status||'draft';
    S.sfpFor=null; S.sfpList=null;
    repaint();
  };
  window.ctNew=function(){ S.cur=blankDoc(); S.rowId=null; S.docNumber=null; S.status='draft'; S.sfpFor=null; S.sfpList=null; snapshotClauses(); repaint(); };

  /* ---------- form mutation ---------- */
  window.ctSet=function(k,v){ S.cur[k]=v; if(k==='clientId'){ S.sfpFor=null; S.sfpList=null; repaint(); } else repaintPreview(); };
  window.ctParty=function(p,k,v){ if(S.cur[p])S.cur[p][k]=v; repaintPreview(); };
  window.ctLang=function(l){ S.cur.lang=l; repaint(); };

  /* ---------- clause enable/disable + OVERRIDE-ON-EDIT (payload only) ---------- */
  function clause(key){ return (S.cur.clauses||[]).find(function(x){return x.key===key;}); }
  window.ctClauseToggle=function(key,on){ var c=clause(key); if(c){ c.enabled=!!on; repaint(); } };
  window.ctClauseEdit=function(key){ S.editKey=key; repaint(); };
  window.ctClauseEditCancel=function(){ S.editKey=null; repaint(); };
  /* saves into THIS contract's payload copy only — never touches contract_clauses */
  window.ctClauseSave=function(key){
    var c=clause(key); if(!c)return;
    function gv(id){ var e=document.getElementById(id); return e?e.value:''; }
    c.title_en=gv('ctE_ten'); c.title_ar=gv('ctE_tar');
    c.body_en=gv('ctE_ben'); c.body_ar=gv('ctE_bar');
    c.override=true;                       /* per-contract override; template untouched */
    S.editKey=null; repaint();
    toast(fl('Changed in this contract only — the shared template is untouched','عُدِّل في هذا العقد فقط — القالب المشترك لم يتغير'));
  };
  window.ctClauseReset=function(key){
    var c=clause(key); var t=(S.tpl||[]).find(function(x){return x.key===key;});
    if(!c||!t)return;
    c.title_en=t.title_en; c.title_ar=t.title_ar;
    c.body_en=t.body_en; c.body_ar=t.body_ar; c.override=false;
    repaint(); toast(fl('Reset to the shared template','أُعيد إلى القالب المشترك'));
  };
  /* the ONLY path that writes the shared template (explicit, admin/manager) */
  window.ctClauseSaveTemplate=function(key){
    if(!canEditTemplate())return;
    var c=clause(key); if(!c)return;
    var cl=client(); if(!cl)return;
    cl.from('contract_clauses')
      .update({title_en:c.title_en,title_ar:c.title_ar,body_en:c.body_en,body_ar:c.body_ar,
               updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
      .eq('key',key).select().then(function(r){
        if(r.error||!r.data||r.data.length!==1){ refusedMsg(); return; }
        c.override=false; loadTemplates(true);
        toast(fl('Saved to the shared template — future contracts start from this text','حُفظ في القالب المشترك — العقود المستقبلية تبدأ من هذا النص'));
      });
  };

  /* ---------- fee annex (same data shape as js/68) ---------- */
  window.ctCol2=function(k,v){ S.cur.annex.col2[k]=(k==='on')?!!v:v; if(k==='on')repaint(); else repaintPreview(); };
  window.ctSecSet=function(si,k,v){ var s=S.cur.annex.sections[si]; if(s){ s[k]=v; repaintPreview(); } };
  window.ctRowSet=function(si,ri,k,v){
    var s=S.cur.annex.sections[si]; if(!s||!s.rows[ri])return;
    s.rows[ri][k]=(k==='total'||k==='free')?!!v:v;
    if(k==='total'||k==='free')repaint(); else repaintPreview();
  };
  window.ctSec=function(op,si){
    var A=S.cur.annex.sections;
    if(op==='add')A.push(blankSection());
    else if(op==='rm')A.splice(si,1);
    else if(op==='up'&&si>0){ var a=A[si-1];A[si-1]=A[si];A[si]=a; }
    else if(op==='down'&&si<A.length-1){ var b=A[si+1];A[si+1]=A[si];A[si]=b; }
    repaint();
  };
  window.ctRow=function(op,si,ri){
    var s=S.cur.annex.sections[si]; if(!s)return; var L=s.rows;
    if(op==='add')L.push(blankRow());
    else if(op==='rm'){ L.splice(ri,1); if(!L.length)L.push(blankRow()); }
    else if(op==='up'&&ri>0){ var a=L[ri-1];L[ri-1]=L[ri];L[ri]=a; }
    else if(op==='down'&&ri<L.length-1){ var b=L[ri+1];L[ri+1]=L[ri];L[ri]=b; }
    repaint();
  };
  /* import fee tables from a SAVED Service-Fee proposal for the same client */
  window.ctImportSFP=function(id){
    if(!id)return;
    var rec=(S.sfpList||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    var pl=rec.payload;
    S.cur.annex.sections=(Array.isArray(pl.sections)?pl.sections:[]).map(function(sec){
      return { tEn:sec.tEn||'', tAr:sec.tAr||'',
        rows:(sec.rows||[]).map(function(r){
          return { en:r.en||'', ar:r.ar||'', fee:r.fee==null?'':String(r.fee),
            fee2:r.fee2==null?'':String(r.fee2), total:!!r.total, free:!!r.free };
        })};
    });
    S.cur.annex.col2=pl.col2?{ on:!!pl.col2.on, head1En:pl.col2.head1En||'', head1Ar:pl.col2.head1Ar||'',
      headEn:pl.col2.headEn||'', headAr:pl.col2.headAr||'' }:{on:false,head1En:'',head1Ar:'',headEn:'',headAr:''};
    S.cur.importedFrom=rec.doc_number||rec.id;
    repaint();
    toast(fl('Fee tables imported from proposal '+(rec.doc_number||'(draft)')+' — everything stays editable',
             'استُوردت جداول الرسوم من العرض '+(rec.doc_number||'(مسودة)')+' — كل شيء قابل للتعديل'));
  };

  /* Professional print name: "Direct — Contract <no|DRAFT> — <client>" */
  function pdfName(){
    var cn=bizName(S.cur.clientId,'en')||bizName(S.cur.clientId,'ar');
    return 'Direct — Contract '+(S.docNumber||'DRAFT')+(cn?' — '+cn:'');
  }
  window.ctPrint=function(){
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
  function css(){ return '<style id="ctCss">'+
    '#ctWrap{display:grid;grid-template-columns:420px 1fr;gap:18px;align-items:start}'+
    '@media(max-width:1100px){#ctWrap{grid-template-columns:1fr}}'+
    '#ctPreviewCol{min-width:0;overflow-x:auto}'+
    '#ctWrap .ct-form label{display:block;font-weight:700;font-size:12px;margin:10px 0 4px;color:var(--ink)}'+
    '#ctWrap .ct-form input,#ctWrap .ct-form select,#ctWrap .ct-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--hairline,#ddd);border-radius:9px;padding:8px 10px;font-size:13.5px;font-family:inherit;background:var(--surface,#fff);color:var(--ink)}'+
    '#ctWrap .ct-form textarea{min-height:70px;resize:vertical}'+
    '#ctWrap .ct-seg{display:flex;border:1px solid var(--hairline,#ddd);border-radius:10px;overflow:hidden;margin-top:4px}'+
    '#ctWrap .ct-seg button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted,#777)}'+
    '#ctWrap .ct-seg button.on{background:var(--accent);color:#fff}'+
    '#ctWrap fieldset{border:1px solid var(--hairline,#ddd);border-radius:12px;margin:14px 0 0;padding:10px 12px 12px}'+
    '#ctWrap legend{font-weight:800;font-size:12px;padding:0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}'+
    '#ctWrap .ct-cl{border:1px solid var(--hairline,#ddd);border-radius:10px;padding:9px;margin-bottom:8px;background:var(--wash,#f7f7f7)}'+
    '#ctWrap .ct-cl .hd{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px}'+
    '#ctWrap .ct-cl .hd input{width:auto}'+
    '#ctWrap .ct-cl .off{color:var(--muted,#999);font-weight:400;font-size:11.5px}'+
    '#ctWrap .ct-cl .ovr{color:var(--accent);font-weight:700;font-size:11px;border:1px solid var(--accent);border-radius:99px;padding:1px 7px}'+
    '#ctWrap .ct-sec{border:1px solid var(--hairline,#ddd);border-radius:10px;padding:9px;margin-bottom:10px;background:var(--wash,#f7f7f7)}'+
    '#ctWrap .ct-row{border:1px dashed var(--hairline,#ccc);border-radius:9px;padding:8px;margin:8px 0;background:var(--surface,#fff)}'+
    '#ctWrap .rm{float:inline-end;border:0;background:none;color:#D92D20;font-weight:700;cursor:pointer;font-size:12px}'+
    '#ctWrap .mv{float:inline-end;border:0;background:none;color:var(--muted,#777);cursor:pointer;font-size:13px;font-weight:700;padding:0 4px}'+
    '#ctWrap .ct-add{width:100%;border:1px dashed var(--accent);background:var(--wash-accent,#fff6f0);color:var(--accent);font-weight:800;border-radius:10px;padding:8px;cursor:pointer;font-size:13px}'+
    '#ctWrap .ct-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
    '#ctWrap .ct-flags{display:flex;gap:14px;margin-top:6px;font-size:12px}'+
    '#ctWrap .ct-flags label{display:flex;align-items:center;gap:6px;margin:0;font-weight:600}'+
    '#ctWrap .ct-flags input{width:auto}'+
    '#ctWrap .ct-status{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:800}'+
    '#ctWrap .ct-status.draft{background:var(--wash,#eee);color:var(--muted,#777)}'+
    '#ctWrap .ct-status.sent{background:var(--wash-accent,#fff3ec);color:var(--accent)}'+
    /* --- A4 preview, Classic identity — a legal document, letterhead not gradient --- */
    '#ctPages{display:flex;flex-direction:column;gap:20px;align-items:center;overflow-x:auto}'+
    '#ctPages .ct-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.15));position:relative;display:flex;flex-direction:column;flex:none;color:var(--ink)}'+
    '#ctPages .ct-page.ar{direction:rtl;font-family:var(--font-ar,serif)}'+
    '#ctPages .ct-page.en{direction:ltr;font-family:var(--font-en,sans-serif)}'+
    /* full-bleed brand-primary cover / back-cover (Family-A styling, sensibly applied) */
    '#ctPages .ct-page.grad{background:var(--accent);color:#fff}'+
    '#ctPages .ct-cvr{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 60px 44px}'+
    '#ctPages .ct-cvr .lg{width:210px}'+
    '#ctPages .ct-cvr .mid{margin:auto 0}'+
    '#ctPages .ct-cvr .t{font-size:38px;font-weight:800;line-height:1.35;margin:0}'+
    '#ctPages .ct-cvr .t span{display:block}'+
    '#ctPages .ct-cvr .sw{width:250px;height:20px;border-bottom:2.5px solid rgba(255,255,255,.92);border-radius:0 0 55% 55%/0 0 100% 100%;margin:8px auto 0}'+
    '#ctPages .ct-cvr .qrb{margin-top:auto}'+
    '#ctPages .ct-cvr .qrb img{width:74px;height:74px;background:#fff;padding:5px;border-radius:10px;display:block;margin:0 auto}'+
    '#ctPages .ct-content{flex:1;display:flex;flex-direction:column;padding:44px 56px 104px}'+
    '#ctPages .ct-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--accent);padding-bottom:12px;margin-bottom:22px}'+
    '#ctPages .ct-head img{height:38px}'+
    '#ctPages .ct-head .m{font-size:11.5px;color:var(--muted);text-align:end;line-height:1.6}'+
    '#ctPages .ct-title{text-align:center;margin:0 0 4px;font-size:23px;font-weight:800}'+
    '#ctPages .ct-title .dia{color:var(--accent);font-size:13px;vertical-align:middle}'+
    '#ctPages .ct-sub{text-align:center;color:var(--muted);margin:0 0 20px;font-size:13px}'+
    '#ctPages .ct-parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:6px 0 16px}'+
    '#ctPages .ct-party{background:var(--wash);border-inline-start:4px solid var(--accent);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.9}'+
    '#ctPages .ct-party b{display:block;color:var(--accent);font-size:13.5px;margin-bottom:4px}'+
    '#ctPages .ct-party .nm{font-weight:800;font-size:14px}'+
    '#ctPages .ct-clh{margin:16px 0 6px;font-size:15.5px;font-weight:800;color:var(--accent)}'+
    '#ctPages .ct-clh .n{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:99px;background:var(--accent);color:#fff;font-size:12.5px;margin-inline-end:8px;padding:0 6px}'+
    '#ctPages .ct-clb{font-size:13.5px;line-height:2;margin:0 0 6px;white-space:pre-wrap}'+
    '#ctPages table.ct-fee{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:13.5px;margin:8px 0 4px}'+
    '#ctPages table.ct-fee th{background:var(--accent-strong);color:#fff;font-weight:700;padding:9px 12px;font-size:12.5px}'+
    '#ctPages table.ct-fee th:first-child{border-start-start-radius:999px;border-end-start-radius:999px}'+
    '#ctPages table.ct-fee th:last-child{border-start-end-radius:999px;border-end-end-radius:999px}'+
    '#ctPages table.ct-fee td{background:var(--wash);padding:9px 12px;text-align:center}'+
    '#ctPages table.ct-fee tr:nth-child(even) td{background:var(--wash-accent)}'+
    '#ctPages table.ct-fee td.svc{text-align:start;font-weight:600}'+
    '#ctPages table.ct-fee td.amt{font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--accent)}'+
    '#ctPages .ct-totnote{display:block;font-size:10.5px;font-weight:600;color:var(--muted)}'+
    '#ctPages .ct-sign{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:26px}'+
    '#ctPages .ct-sign .pt{border:1.5px solid var(--accent);border-radius:12px;padding:14px 16px;font-size:13px}'+
    '#ctPages .ct-sign .pt b{display:block;font-size:14.5px;margin-bottom:8px;color:var(--accent)}'+
    '#ctPages .ct-sign .ln{display:flex;gap:8px;border-bottom:1px dashed var(--hairline,#bbb);margin:12px 0 0;padding-bottom:3px}'+
    '#ctPages .ct-sign .ln i{font-style:normal;color:var(--muted);white-space:nowrap}'+
    /* real-design footer strip: QR · email/site · branches · Arabic legal block */
    '#ctPages .ct-foot{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:12px 40px 14px;font-size:9.5px;color:var(--muted);box-sizing:border-box;border-top:1px solid var(--hairline,#eee)}'+
    '#ctPages .ct-foot .fq{width:44px;height:44px;flex:none}'+
    '#ctPages .ct-foot .fc{line-height:1.7;white-space:nowrap}'+
    '#ctPages .ct-foot .fb{flex:1;text-align:center;line-height:1.6}'+
    '#ctPages .ct-foot .fl{text-align:right;line-height:1.7;white-space:nowrap}'+
    '#ctPages .ct-draftmark{position:absolute;top:18px;inset-inline-end:18px;background:var(--surface,#fff);color:var(--muted);font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;border:1px dashed var(--muted);z-index:2}'+
    '#ctPages .ct-wm{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;overflow:hidden;z-index:1}'+
    '#ctPages .ct-wm span{font-size:150px;font-weight:800;letter-spacing:.1em;color:var(--muted);opacity:.10;transform:rotate(-32deg);white-space:nowrap;user-select:none}'+
    '@media print{'+
      'body *{visibility:hidden}'+
      '#ctPages,#ctPages *{visibility:visible}'+
      '#ctPages{position:absolute;left:0;top:0;display:block}'+
      '#ctPages .ct-page{width:auto;box-shadow:none;margin:0;page-break-after:always;height:auto;min-height:99.3vh}'+
      '#ctPages .ct-page.grad{min-height:0;height:99.3vh;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '#ctPages .ct-page:last-child{page-break-after:auto}'+
      '#ctPages .ct-clh{page-break-after:avoid}'+
      '#ctPages table.ct-fee tr,#ctPages .ct-sign .pt,#ctPages .ct-party{page-break-inside:avoid}'+
      '#ctPages table.ct-fee th,#ctPages table.ct-fee tr:nth-child(even) td,#ctPages .ct-party{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '}'+
    '@page{size:A4;margin:0}'+
    '</style>'; }

  /* ---------- render: preview ---------- */
  function feeCell(row,val,t){
    if(row.free)return '<span class="fr" style="color:var(--accent);letter-spacing:.04em">'+t.free+'</span>';
    if(val===''||val==null)return '—';
    var n=Number(val);
    if(!isFinite(n))return esc(String(val));
    if(n===0)return '<span class="fr" style="color:var(--accent)">'+t.free+'</span>';
    return fmt(n);
  }
  function clauseBody(c,ar){
    var b=ar?(c.body_ar||c.body_en):(c.body_en||c.body_ar);
    b=String(b||'').replace(/\{\{notice_days\}\}/g,String(S.cur.noticeDays||'—'));
    return b;
  }
  function partyBlock(t,ar,which){
    var isFirst=which===1;
    var legal=idv('legal_name',ar?'ar':'en');
    var name=isFirst?(legal||'Direct'):(bizName(S.cur.clientId,ar?'ar':'en')||'—');
    var cr=isFirst?idv('cr_number','en'):(S.cur.party2.cr||'—');
    var rep=isFirst?(S.cur.party1.rep||'—'):(S.cur.party2.rep||'—');
    var role=isFirst?(S.cur.party1.title||'—'):(S.cur.party2.title||'—');
    var ph=isFirst?(idv('phone_licence','en')||'—'):(S.cur.party2.phone||'—');
    return '<div class="ct-party"><b>'+(isFirst?t.party1:t.party2)+'</b>'+
      '<span class="nm">'+esc(name)+'</span><br>'+
      t.cr+': '+esc(cr)+'<br>'+
      t.rep+': '+esc(rep)+'<br>'+
      t.roleTitle+': '+esc(role)+'<br>'+
      t.phone+': '+esc(ph)+'</div>';
  }
  function signBlock(t,ar){
    function pt(label,cr,rep,role,ph){
      return '<div class="pt"><b>'+label+'</b>'+
        '<div class="ln"><i>'+t.cr+':</i> '+esc(cr||'')+'</div>'+
        '<div class="ln"><i>'+t.rep+':</i> '+esc(rep||'')+'</div>'+
        '<div class="ln"><i>'+t.roleTitle+':</i> '+esc(role||'')+'</div>'+
        '<div class="ln"><i>'+t.phone+':</i> '+esc(ph||'')+'</div>'+
        '<div class="ln"><i>'+t.sig+':</i></div>'+
        '<div class="ln"><i>'+t.sigDate+':</i></div></div>';
    }
    return '<div class="ct-sign">'+
      pt(t.party1,idv('cr_number','en'),S.cur.party1.rep,S.cur.party1.title,idv('phone_licence','en'))+
      pt(t.party2,S.cur.party2.cr,S.cur.party2.rep,S.cur.party2.title,S.cur.party2.phone)+
    '</div>';
  }
  function annexHtml(t,ar){
    var A=S.cur.annex, secs=(A.sections||[]);
    var any=secs.some(function(s){return (s.rows||[]).some(function(r){return r.en||r.ar||r.fee!==''||r.fee2!=='';});});
    if(!any)return '';
    var col2=A.col2&&A.col2.on;
    var head;
    if(col2){
      var c1=ar?(A.col2.head1Ar||A.col2.head1En||'الرسوم (ريال)'):(A.col2.head1En||A.col2.head1Ar||'Fee (SAR)');
      var c2=ar?(A.col2.headAr||A.col2.headEn||''):(A.col2.headEn||A.col2.headAr||'');
      head='<tr><th>'+t.num+'</th><th>'+t.svc+'</th><th>'+esc(c1)+'</th><th>'+esc(c2)+'</th></tr>';
    }else{
      head='<tr><th>'+t.num+'</th><th>'+t.svc+'</th><th>'+(ar?'الرسوم (ريال)':'Fee (SAR)')+'</th></tr>';
    }
    var tables=secs.map(function(sec){
      var rows=(sec.rows||[]).filter(function(r){return r.en||r.ar||r.fee!==''||r.fee2!=='';});
      if(!rows.length)return '';
      var body=rows.map(function(r,i){
        var svc=ar?(r.ar||r.en):(r.en||r.ar);
        var note=r.total?'<span class="ct-totnote">'+t.totalNote+'</span>':'';
        return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(svc)+note+'</td>'+
          '<td class="amt">'+feeCell(r,r.fee,t)+'</td>'+
          (col2?'<td class="amt">'+feeCell(r,r.fee2,t)+'</td>':'')+'</tr>';
      }).join('');
      var st=ar?(sec.tAr||sec.tEn):(sec.tEn||sec.tAr);
      return (st?'<div class="ct-clh" style="font-size:14px">'+esc(st)+'</div>':'')+
        '<table class="ct-fee"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
    }).join('');
    return '<div id="ctAnnex"><div class="ct-clh"><span class="n">◆</span>'+t.annex+'</div>'+tables+'</div>';
  }
  function pagesHtml(){
    var lang=S.cur.lang||'ar', t=T[lang], ar=lang==='ar';
    var dirCls=ar?'ar':'en';
    var issued=!!S.docNumber, no=S.docNumber||'—';
    var draftMark=issued?'':'<div class="ct-draftmark">'+t.draftPill+'</div>';
    var wm=issued?'':'<div class="ct-wm"><span>'+t.wm+'</span></div>';
    var title=(ar?S.cur.titleAr:S.cur.titleEn)||(ar?S.cur.titleEn:S.cur.titleAr)||t.docKind;
    var site=idv('website','en')||'www.directksa.com';
    var legal=idv('legal_name',lang);
    var crL=idv('cr_number','en'), vatL=idv('vat_number','en');
    var footer=footHtml();

    /* cover — Family-A: full-bleed brand orange, white logo, stacked centered title
       + client, curved underline, QR bottom-center; NO date/number/contact */
    var cn=S.cur.clientId?bizName(S.cur.clientId,lang):'';
    var cover=
    '<div class="ct-page grad '+dirCls+'">'+draftMark+'<div class="ct-cvr">'+
      '<img class="lg" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="mid"><h1 class="t"><span>'+esc(title)+'</span>'+
        (cn?'<span>'+(ar?'مقدم إلى':'Prepared for')+'</span><span>'+esc(cn)+'</span>':'')+
      '</h1><div class="sw"></div></div>'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';
    /* back-cover — full-bleed orange, white logo centered, QR bottom-center */
    var backCover=
    '<div class="ct-page grad '+dirCls+'">'+draftMark+'<div class="ct-cvr">'+
      '<img class="lg" style="margin:auto 0" src="/brand/direct_logo_white.png" alt="Direct">'+
      '<div class="qrb"><img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.parentNode.style.display=\'none\'"></div>'+
    '</div></div>';

    /* letterhead header from company_identity */
    var head='<div class="ct-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
      '<div class="m">'+esc(legal||'')+'<br>'+t.no+' '+esc(issued?no:t.draftPill)+'</div></div>';

    /* clauses in sort order; disabled clauses NEVER render */
    var enabled=(S.cur.clauses||[]).filter(function(c){return c.enabled;})
      .sort(function(a,b){return a.sort-b.sort;});
    var n=0;
    var clausesHtml=enabled.map(function(c){
      n++;
      var ttl=ar?(c.title_ar||c.title_en):(c.title_en||c.title_ar);
      var body=clauseBody(c,ar);
      var extra='';
      if(c.key==='preamble'){
        extra='<div class="ct-parties">'+partyBlock(t,ar,1)+partyBlock(t,ar,2)+'</div>';
      }
      return '<div class="ct-clh"><span class="n">'+n+'</span>'+esc(ttl)+'</div>'+
        (body?'<p class="ct-clb">'+esc(body)+'</p>':'')+extra;
    }).join('');

    return cover+'<div class="ct-page '+dirCls+'">'+draftMark+wm+'<div class="ct-content">'+
      head+
      '<h1 class="ct-title"><span class="dia">◆</span> '+esc(title)+' <span class="dia">◆</span></h1>'+
      '<p class="ct-sub">'+t.no+' '+esc(issued?no:t.draftPill)+(S.cur.clientId?' · '+esc(bizName(S.cur.clientId,lang)):'')+'</p>'+
      clausesHtml+
      annexHtml(t,ar)+
      signBlock(t,ar)+
      footer+
    '</div></div>'+backCover;
  }

  /* ---------- render: form ---------- */
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
  function savedOptions(){
    var list=S.list||[];
    return '<option value="">'+
      (list.length?fl('— open a saved contract ('+list.length+') —','— افتح عقداً محفوظاً ('+list.length+') —')
                  :fl('— no saved contracts yet —','— لا توجد عقود محفوظة بعد —'))+'</option>'+
      list.map(function(o){
        var label=(o.doc_number||fl('draft','مسودة'))+' · '+(bizName(o.business_id)||o.title||'')+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'" '+(S.rowId===o.id?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }
  function sfpOptions(){
    if(!S.cur.clientId)return '<option value="">'+fl('— pick a client first —','— اختر العميل أولاً —')+'</option>';
    var list=S.sfpList;
    if(list===null)return '<option value="">'+fl('Looking for saved proposals…','جارٍ البحث عن عروض محفوظة…')+'</option>';
    if(!list.length)return '<option value="">'+fl('— no saved proposals for this client —','— لا توجد عروض محفوظة لهذا العميل —')+'</option>';
    return '<option value="">'+fl('— import fee tables from a proposal —','— استيراد جداول الرسوم من عرض —')+'</option>'+
      list.map(function(o){
        var label=fl('Import fee tables from proposal ','استيراد جداول الرسوم من العرض ')+(o.doc_number||fl('(draft)','(مسودة)'))+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'">'+esc(label)+'</option>';
      }).join('');
  }
  function clauseEditorHtml(c){
    return '<div style="margin-top:8px">'+
      '<label>'+fl('Title (EN)','العنوان بالإنجليزية')+'</label><input id="ctE_ten" value="'+esc(c.title_en||'')+'">'+
      '<label>'+fl('Title (AR)','العنوان بالعربية')+'</label><input dir="rtl" id="ctE_tar" value="'+esc(c.title_ar||'')+'">'+
      '<label>'+fl('Body (EN)','النص بالإنجليزية')+'</label><textarea id="ctE_ben">'+esc(c.body_en||'')+'</textarea>'+
      '<label>'+fl('Body (AR)','النص بالعربية')+'</label><textarea id="ctE_bar" dir="rtl">'+esc(c.body_ar||'')+'</textarea>'+
      (c.key==='term'?'<div style="font-size:11.5px;color:var(--muted,#777);margin-top:4px">'+
        fl('Keep {{notice_days}} where the notice period should print — the field below fills it.',
           'أبقِ {{notice_days}} حيث يجب أن تظهر مدة الإشعار — الحقل أدناه يعبئها.')+'</div>':'')+
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+
      '<button class="btn sm pri" onclick="ctClauseSave(\''+esc(c.key)+'\')">'+fl('Save in this contract','حفظ في هذا العقد')+'</button>'+
      '<button class="btn sm ghost" onclick="ctClauseEditCancel()">'+fl('Cancel','إلغاء')+'</button>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--muted,#777);margin-top:6px">'+
        fl('Saving here changes this contract only. The shared template stays as it is.',
           'الحفظ هنا يغيّر هذا العقد فقط. القالب المشترك يبقى كما هو.')+'</div>'+
      '</div>';
  }
  function clausesFormHtml(){
    if(S.cur.clauses===null)return '<div>'+fl('Loading the clause library…','جارٍ تحميل مكتبة البنود…')+'</div>';
    var tplEdit=canEditTemplate();
    return (S.cur.clauses||[]).slice().sort(function(a,b){return a.sort-b.sort;}).map(function(c){
      var title=isAr()?(c.title_ar||c.title_en):(c.title_en||c.title_ar);
      return '<div class="ct-cl"><div class="hd">'+
        '<input type="checkbox" '+(c.enabled?'checked':'')+' onchange="ctClauseToggle(\''+esc(c.key)+'\',this.checked)">'+
        '<span>'+esc(title)+'</span>'+
        (c.optional?'<span class="off">'+fl('(optional)','(اختياري)')+'</span>':'')+
        (c.enabled?'':'<span class="off">'+fl('(hidden)','(مخفي)')+'</span>')+
        (c.override?'<span class="ovr">'+fl('edited here','معدّل هنا')+'</span>':'')+
        '<span style="margin-inline-start:auto;display:flex;gap:4px">'+
        '<button class="btn sm ghost" onclick="ctClauseEdit(\''+esc(c.key)+'\')">'+fl('Edit','تعديل')+'</button>'+
        (c.override?'<button class="btn sm ghost" onclick="ctClauseReset(\''+esc(c.key)+'\')">'+fl('Reset to template','إعادة للقالب')+'</button>':'')+
        (c.override&&tplEdit?'<button class="btn sm ghost" onclick="ctClauseSaveTemplate(\''+esc(c.key)+'\')">'+fl('Save to shared template','حفظ في القالب المشترك')+'</button>':'')+
        '</span></div>'+
        (S.editKey===c.key?clauseEditorHtml(c):'')+
      '</div>';
    }).join('');
  }
  function annexRowHtml(r,si,ri){
    return '<div class="ct-row">'+
      '<button type="button" class="rm" onclick="ctRow(\'rm\','+si+','+ri+')">✕</button>'+
      '<button type="button" class="mv" onclick="ctRow(\'down\','+si+','+ri+')">↓</button>'+
      '<button type="button" class="mv" onclick="ctRow(\'up\','+si+','+ri+')">↑</button>'+
      '<label>'+fl('Service (EN)','الخدمة بالإنجليزية')+'</label><input value="'+esc(r.en)+'" oninput="ctRowSet('+si+','+ri+',\'en\',this.value)">'+
      '<label>'+fl('Service (AR)','الخدمة بالعربية')+'</label><input dir="rtl" value="'+esc(r.ar)+'" oninput="ctRowSet('+si+','+ri+',\'ar\',this.value)">'+
      '<div class="ct-row2">'+
      '<div><label>'+fl('Fee (SAR)','الرسوم (ريال)')+'</label><input type="number" min="0" step="0.01" value="'+esc(r.fee)+'" oninput="ctRowSet('+si+','+ri+',\'fee\',this.value)"></div>'+
      (S.cur.annex.col2&&S.cur.annex.col2.on?'<div><label>'+fl('Second fee (SAR)','الرسوم الثانية (ريال)')+'</label><input type="number" min="0" step="0.01" value="'+esc(r.fee2)+'" oninput="ctRowSet('+si+','+ri+',\'fee2\',this.value)"></div>':'')+
      '</div>'+
      '<div class="ct-flags">'+
        '<label><input type="checkbox" '+(r.total?'checked':'')+' onchange="ctRowSet('+si+','+ri+',\'total\',this.checked)"> '+fl('Total (all-inclusive)','إجمالي (شامل)')+'</label>'+
        '<label><input type="checkbox" '+(r.free?'checked':'')+' onchange="ctRowSet('+si+','+ri+',\'free\',this.checked)"> '+fl('Free','مجاني')+'</label>'+
      '</div>'+
    '</div>';
  }
  function annexSecHtml(sec,si){
    return '<div class="ct-sec">'+
      '<button type="button" class="rm" onclick="ctSec(\'rm\','+si+')">✕</button>'+
      '<button type="button" class="mv" onclick="ctSec(\'down\','+si+')">↓</button>'+
      '<button type="button" class="mv" onclick="ctSec(\'up\','+si+')">↑</button>'+
      '<label>'+fl('Section title (EN)','عنوان القسم بالإنجليزية')+'</label><input value="'+esc(sec.tEn)+'" oninput="ctSecSet('+si+',\'tEn\',this.value)">'+
      '<label>'+fl('Section title (AR)','عنوان القسم بالعربية')+'</label><input dir="rtl" value="'+esc(sec.tAr)+'" oninput="ctSecSet('+si+',\'tAr\',this.value)">'+
      (sec.rows||[]).map(function(r,ri){ return annexRowHtml(r,si,ri); }).join('')+
      '<button type="button" class="ct-add" onclick="ctRow(\'add\','+si+')">+ '+fl('Add service row','إضافة سطر خدمة')+'</button>'+
    '</div>';
  }
  function formHtml(){
    var st=S.status||'draft';
    var stLabel=st==='draft'?fl('Draft','مسودة'):fl('Issued / sent','صادر / مُرسل');
    var w=canWrite();
    var A=S.cur.annex;
    return '<div class="card ct-form">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<b>'+fl('Contract / Agreement','العقد / الاتفاقية')+'</b>'+
        '<span class="ct-status '+esc(st)+'">'+stLabel+(S.docNumber?' · '+esc(S.docNumber):'')+'</span>'+
      '</div>'+
      '<label>'+fl('Saved contracts','العقود المحفوظة')+'</label>'+
      '<select onchange="if(this.value)ctOpen(this.value)">'+savedOptions()+'</select>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" onclick="ctNew()">＋ '+fl('New','جديد')+'</button>'+
      '</div>'+
      '<label>'+fl('Document language','لغة المستند')+'</label>'+
      '<div class="ct-seg">'+
        '<button type="button" class="'+(S.cur.lang==='ar'?'on':'')+'" onclick="ctLang(\'ar\')">العربية</button>'+
        '<button type="button" class="'+(S.cur.lang==='en'?'on':'')+'" onclick="ctLang(\'en\')">English</button>'+
      '</div>'+
      '<fieldset><legend>'+fl('Title','العنوان')+'</legend>'+
        '<label>'+fl('Title (AR)','العنوان بالعربية')+'</label>'+
        '<input dir="rtl" value="'+esc(S.cur.titleAr)+'" oninput="ctSet(\'titleAr\',this.value)">'+
        '<label>'+fl('Title (EN)','العنوان بالإنجليزية')+'</label>'+
        '<input value="'+esc(S.cur.titleEn)+'" oninput="ctSet(\'titleEn\',this.value)">'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Second party (the client)','الطرف الثاني (العميل)')+'</legend>'+
        '<label>'+fl('Company','الشركة')+'</label>'+
        '<select onchange="ctSet(\'clientId\',this.value)">'+clientOptions()+'</select>'+
        '<label>'+fl('Commercial registration (CR)','السجل التجاري')+'</label>'+
        '<input value="'+esc(S.cur.party2.cr)+'" oninput="ctParty(\'party2\',\'cr\',this.value)">'+
        '<label>'+fl('Represented by','يمثلها')+'</label>'+
        '<input value="'+esc(S.cur.party2.rep)+'" oninput="ctParty(\'party2\',\'rep\',this.value)">'+
        '<label>'+fl('Title / capacity','الصفة')+'</label>'+
        '<input value="'+esc(S.cur.party2.title)+'" oninput="ctParty(\'party2\',\'title\',this.value)">'+
        '<label>'+fl('Phone','الهاتف')+'</label>'+
        '<input value="'+esc(S.cur.party2.phone)+'" oninput="ctParty(\'party2\',\'phone\',this.value)">'+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:4px">'+
          fl('These live in this contract only — the client record may not carry them.',
             'تُحفظ هذه البيانات في هذا العقد فقط — سجل العميل قد لا يحملها.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('First party (Direct) signatory','موقّع الطرف الأول (دايركت)')+'</legend>'+
        '<label>'+fl('Represented by','يمثلها')+'</label>'+
        '<input value="'+esc(S.cur.party1.rep)+'" oninput="ctParty(\'party1\',\'rep\',this.value)">'+
        '<label>'+fl('Title / capacity','الصفة')+'</label>'+
        '<input value="'+esc(S.cur.party1.title)+'" oninput="ctParty(\'party1\',\'title\',this.value)">'+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:4px">'+
          fl('Legal name, CR and phone come from the company registry automatically.',
             'الاسم القانوني والسجل والهاتف تأتي من سجل الشركة تلقائياً.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Term & notice','المدة والإشعار')+'</legend>'+
        '<label>'+fl('Termination notice (days)','مدة إشعار الإنهاء (أيام)')+'</label>'+
        '<input type="number" min="1" placeholder="'+esc(fl('e.g. 7 or 30','مثال: 7 أو 30'))+'" value="'+esc(S.cur.noticeDays)+'" oninput="ctSet(\'noticeDays\',this.value)">'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Clauses','البنود')+'</legend>'+
        clausesFormHtml()+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:6px">'+
          fl('Seeded texts are neutral skeletons — the legal wording is the owner\'s lawyer\'s to supply. Edits apply to this contract only unless explicitly saved to the shared template.',
             'النصوص المزروعة هياكل محايدة — الصياغة القانونية يوفرها محامي المالك. التعديلات على هذا العقد فقط ما لم تُحفظ صراحةً في القالب المشترك.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Fee annex','ملحق الرسوم')+'</legend>'+
        '<label>'+fl('Import from a saved Service-Fee proposal','استيراد من عرض رسوم محفوظ')+'</label>'+
        '<select onchange="ctImportSFP(this.value)">'+sfpOptions()+'</select>'+
        (S.cur.importedFrom?'<div style="font-size:11.5px;color:var(--muted,#777);margin-top:4px">'+
          fl('Imported from proposal ','مستورد من العرض ')+esc(S.cur.importedFrom)+'</div>':'')+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600;margin-top:10px"><input type="checkbox" style="width:auto" '+(A.col2&&A.col2.on?'checked':'')+' onchange="ctCol2(\'on\',this.checked)"> '+fl('Second fee column (dual-rate)','عمود رسوم ثانٍ (تسعيرة مزدوجة)')+'</label>'+
        (A.col2&&A.col2.on?
          '<label>'+fl('First column header (EN)','عنوان العمود الأول بالإنجليزية')+'</label>'+
          '<input value="'+esc(A.col2.head1En||'')+'" oninput="ctCol2(\'head1En\',this.value)">'+
          '<label>'+fl('First column header (AR)','عنوان العمود الأول بالعربية')+'</label>'+
          '<input dir="rtl" value="'+esc(A.col2.head1Ar||'')+'" oninput="ctCol2(\'head1Ar\',this.value)">'+
          '<label>'+fl('Second column header (EN)','عنوان العمود الثاني بالإنجليزية')+'</label>'+
          '<input value="'+esc(A.col2.headEn||'')+'" oninput="ctCol2(\'headEn\',this.value)">'+
          '<label>'+fl('Second column header (AR)','عنوان العمود الثاني بالعربية')+'</label>'+
          '<input dir="rtl" value="'+esc(A.col2.headAr||'')+'" oninput="ctCol2(\'headAr\',this.value)">':'')+
        (A.sections||[]).map(annexSecHtml).join('')+
        '<button type="button" class="ct-add" style="margin-top:8px" onclick="ctSec(\'add\')">+ '+fl('Add annex section','إضافة قسم للملحق')+'</button>'+
      '</fieldset>'+
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
        (w?'<button class="btn sm pri" '+(S.saving?'disabled':'')+' onclick="ctSaveDraft()">'+(S.saving?fl('Saving…','جارٍ الحفظ…'):fl('Save draft','حفظ المسودة'))+'</button>':'')+
        (w&&!S.docNumber?'<button class="btn sm ghost" data-v21relabeled="true" onclick="ctIssue()">'+fl('Issue contract','إصدار العقد')+'</button>':'')+
        '<button class="btn sm ghost" onclick="ctPrint()">'+fl('Print / PDF','طباعة / PDF')+'</button>'+
      '</div>'+
      '<div style="margin-top:10px;font-size:11.5px;color:var(--muted,#777);line-height:1.5">'+
        fl('All annex fees are service fees, ex-VAT. Real tax invoices are issued from Direct Payment.',
           'جميع رسوم الملحق رسوم خدمات غير شاملة الضريبة. الفواتير الضريبية تصدر من دايركت للمدفوعات.')+'</div>'+
    '</div>';
  }

  /* ---------- render: tab body + targeted repaints ---------- */
  function tabHtml(){
    loadTemplates(); loadIdentity(); loadList(); loadSfp();
    snapshotClauses();
    return css()+
      '<div id="ctWrap">'+
        '<div>'+formHtml()+'</div>'+
        '<div id="ctPreviewCol" data-identity="classic"><div id="ctPages">'+pagesHtml()+'</div></div>'+
      '</div>';
  }
  function repaint(){ try{ if(typeof current!=='undefined'&&current==='documents')render(); }catch(_){} }
  function repaintPreview(){
    var el=document.getElementById('ctPages');
    if(el)el.innerHTML=pagesHtml(); else repaint();
  }

  /* ---------- register through the js/66 seam ---------- */
  if(typeof window.dgRegisterTab==='function'){
    window.dgRegisterTab('contract', tabHtml);
  }else{
    console.warn('[ct] dgRegisterTab missing — js/66 not loaded first?');
  }

  console.info('[ct] contract tab loaded (generated_documents / CTR)');
}catch(e){ if(window.console)console.warn('[ct] init',e); }})();
