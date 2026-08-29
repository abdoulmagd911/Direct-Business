/* ===== Company Profile tab — WHO WE ARE, no client, no prices =====
   (Phase 1, STEP 4 — final phase-1 step, 2026-08-25)

   A multi-page branded profile document: gradient cover → enabled content
   sections in sort order → closing thank-you/contact page. Structure follows
   the official "Direct Profile NEW 2026". Content is stable/annual and lives
   in the `company_profile_sections` table as editable blocks — nothing about
   any client, except the OPTIONAL "personalized cover" variant which puts a
   client name on the cover only (picked from DB.businesses, never retyped).

   Rules honoured (docs/DECISIONS.md):
   - P5/F1: preview styled ONLY with var(--…) from /brand/tokens.css (injected
     by js/66) under data-identity="classic". No copied brand hexes.
   - F2/F3: NO browser storage. Documents persist in `generated_documents`
     (family 'PRF'); numbering is server-side via next_document_number('PRF'),
     assigned ONLY at issue time — drafts carry no number.
   - B2: every write chains .select() and checks the returned row count.
   - M8: no invented marketing copy or numbers. Placeholder sections say
     "[Edit this section]"; the stats band renders ONLY when the owner has
     entered items — the canonical stats are still an open owner question,
     so nothing is seeded and nothing is approximated.
   - M2: the two verification vendors excluded by owner ruling (see
     docs/DECISIONS.md, rule M2) are deliberately NOT modelled here — there is
     no subsidiary section at all, and their names never appear in this file.
   - D4: nothing real in this file — content lives in the database.

   Registers through the js/66 seam: window.dgRegisterTab('profile', renderFn). */
(function(){try{

  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function canEditSections(){ try{ return ['admin','manager'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function canWrite(){ try{ return ['admin','manager','bd','team_member'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function toast(msg){ try{ if(window.__toast){__toast(msg);return;} }catch(_){}
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink,#333);color:#fff;padding:10px 16px;border-radius:10px;z-index:9999;font-size:14px';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){try{t.remove();}catch(_){}} ,2600);
  }

  /* ---------- bilingual document strings ---------- */
  var T={
    en:{cover:'Company Profile',coverSub:'Travel & Tourism',prepFor:'Prepared for',
        year:'Year',no:'Document no.',draftPill:'DRAFT',wm:'DRAFT',
        thanks:'Thank You',contactsHead:'Contacts',
        tag:'Global supplier power. Saudi service. One partner.'},
    ar:{cover:'الملف التعريفي',coverSub:'السفر والسياحة',prepFor:'مقدم إلى',
        year:'السنة',no:'رقم المستند',draftPill:'مسودة',wm:'مسودة',
        thanks:'شكراً لكم',contactsHead:'التواصل',
        tag:'قوة موردين عالمية. خدمة سعودية. شريك واحد.'}
  };

  /* ---------- state ---------- */
  function blankDoc(){
    /* audience: '' = General (no targeting) or one of AUD keys — stored in the
       payload, INTERNAL ONLY, printed nowhere on the document (26 Aug feature) */
    return { lang:'en', clientId:'', year:String(new Date().getFullYear()), audience:'' };
  }
  var S={ cur:blankDoc(), rowId:null, docNumber:null, status:'draft',
          sections:null, secLoading:false, identity:null,
          list:null, listLoading:false, editKey:null, saving:false,
          /* audience targeting (company_achievements) */
          ach:null, achLoading:false, achFail:false, pastOverride:false };

  /* ---------- audiences (owner-approved 26 Aug) ---------- */
  var AUD=[
    {k:'',en:'General',ar:'عام'},
    {k:'travel_trade',en:'Travel trade',ar:'وكالات السفر'},
    {k:'education',en:'Education',ar:'التعليم'},
    {k:'corporate_mice',en:'Corporate & MICE',ar:'الشركات والمؤتمرات'},
    {k:'government',en:'Government',ar:'الجهات الحكومية'}];

  /* ---------- data ---------- */
  function loadSections(force){
    if(S.secLoading)return; if(S.sections&&!force)return;
    var c=client(); if(!c)return;
    S.secLoading=true;
    c.from('company_profile_sections').select('*').order('sort',{ascending:true}).then(function(r){
      S.secLoading=false;
      S.sections=r.error?[]:(r.data||[]); repaint();
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
  /* company_achievements — fetched ONCE (memoised), enabled rows in sort order.
     On ANY failure the document falls back to current behavior exactly (the
     stored sections render as-is); nothing is ever invented (M8). */
  function loadAch(){
    if(S.achLoading||Array.isArray(S.ach))return;
    var c=client(); if(!c)return;
    S.achLoading=true;
    c.from('company_achievements').select('*').eq('enabled',true)
     .order('sort',{ascending:true}).then(function(r){
        S.achLoading=false;
        if(r.error){ S.achFail=true; S.ach=null; }   /* fallback: sections as-is */
        else{ S.achFail=false; S.ach=r.data||[]; }
        repaint();
     });
  }
  /* achievements of one kind matching the chosen audience, or null when the
     audience is General/unset or the fetch has not succeeded (→ fall back). */
  function achFor(kind){
    var a=S.cur.audience;
    if(!a||!Array.isArray(S.ach))return null;
    return S.ach.filter(function(r){
      return r.kind===kind&&Array.isArray(r.audiences)&&r.audiences.indexOf(a)>=0;
    });
  }
  /* "500+ employees" → {value:"500+", label:"employees"} (same split for AR) */
  function statSplit(t){
    var s=String(t||'').trim();
    var m=/^(\S+)\s+([\s\S]+)$/.exec(s);
    return m?{value:m[1],label:m[2]}:{value:s,label:''};
  }
  function loadList(force){
    if(S.listLoading)return; if(S.list&&!force)return;
    var c=client(); if(!c)return;
    S.listLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,payload')
     .eq('family','PRF').order('created_at',{ascending:false}).limit(60)
     .then(function(r){ S.listLoading=false; S.list=r.error?[]:(r.data||[]); repaint(); });
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
    return '<div class="cp-foot">'+
      '<img class="fq" src="/brand/direct_qr_directksa.png" alt="" onerror="this.style.display=\'none\'">'+
      '<div class="fc">'+esc(mail)+'<br>'+esc(site)+'</div>'+
      '<div class="fb">You can visit our branches in Riyadh – Jeddah – Buraydah – Dammam</div>'+
      '<div class="fl" dir="rtl">الاسم التجاري: شركة المسافر المباشر للسفر والسياحة<br>'+
        'الرقم الموحد '+esc(unn)+' · رقم الترخيص '+esc(lic)+'</div>'+
    '</div>';
  }

  /* ---------- markdown-lite: plain paragraphs + "- " bullet lines ---------- */
  function mdLite(body){
    var lines=String(body||'').split(/\r?\n/);
    var out=[], bullets=[];
    function flush(){ if(bullets.length){ out.push('<ul class="cp-ul">'+bullets.map(function(b){return '<li>'+esc(b)+'</li>';}).join('')+'</ul>'); bullets=[]; } }
    lines.forEach(function(ln){
      var s=ln.trim();
      if(!s){ flush(); return; }
      if(s.indexOf('- ')===0){ bullets.push(s.slice(2)); return; }
      flush(); out.push('<p class="cp-p">'+esc(s)+'</p>');
    });
    flush(); return out.join('');
  }

  /* ---------- QA hooks ---------- */
  window.__cpProbe=function(){
    var secs=(S.sections||[]).slice().sort(function(a,b){return a.sort-b.sort;});
    return { loaded:S.sections!==null,
      sections:secs.map(function(s){return {key:s.key,enabled:!!s.enabled,sort:s.sort,items:(Array.isArray(s.items)?s.items.length:0)};}),
      lang:S.cur.lang, clientId:S.cur.clientId||null, docNumber:S.docNumber, status:S.status,
      audience:S.cur.audience||'', achievements:Array.isArray(S.ach)?S.ach.length:null, achFailed:!!S.achFail };
  };

  /* ---------- persistence (generated_documents, family PRF) ---------- */
  function snapshotSections(){
    return (S.sections||[]).filter(function(s){return s.enabled;})
      .sort(function(a,b){return a.sort-b.sort;})
      .map(function(s){ return { key:s.key,title_en:s.title_en,title_ar:s.title_ar,
        body_en:s.body_en,body_ar:s.body_ar,items:s.items,sort:s.sort }; });
  }
  function rowFromState(){
    return {
      family:'PRF', doc_type:'company_profile',
      /* personalized covers link the business; generic profiles leave it null */
      business_id:S.cur.clientId||null,
      title:'Company Profile '+(S.cur.year||''),
      payload:{ lang:S.cur.lang, clientId:S.cur.clientId||null, year:S.cur.year,
                audience:S.cur.audience||'', sections:snapshotSections() },
      status:S.status||'draft',
      doc_number:S.docNumber||null,
      updated_at:new Date().toISOString(),
      updated_by:(window.__userEmail||null)
    };
  }
  function refusedMsg(){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); }
  window.cpSaveDraft=function(then){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.saving)return; S.saving=true;
    var rec=rowFromState();
    var done=function(ok,row){
      S.saving=false;
      if(!ok){ refusedMsg(); return; }
      if(row&&row.id)S.rowId=row.id;
      loadList(true); repaint();
      toast(fl('Saved to the documents registry','تم الحفظ في سجل المستندات'));
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
  window.cpIssue=function(){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.docNumber){ toast(fl('Already issued as '+S.docNumber,'صدر مسبقاً برقم '+S.docNumber)); return; }
    var go=function(){
      c.rpc('next_document_number',{p_family:'PRF'}).then(function(r){
        if(r.error||!r.data){ toast(fl('Numbering was refused — the profile stays a draft','رُفض الترقيم — يبقى الملف مسودة')); return; }
        var no=r.data;
        c.from('generated_documents')
         .update({doc_number:no,status:'sent',updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
         .eq('id',S.rowId).select().then(function(u){
            if(u.error||!u.data||u.data.length!==1){ refusedMsg(); return; }
            S.docNumber=no; S.status='sent';
            loadList(true); repaint();
            toast(fl('Issued: '+no,'صدر المستند: '+no));
         });
      });
    };
    if(S.rowId) window.cpSaveDraft(go); else window.cpSaveDraft(function(){ if(S.rowId)go(); });
  };
  window.cpOpen=function(id){
    var rec=(S.list||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    S.cur={ lang:rec.payload.lang||'en', clientId:rec.payload.clientId||'', year:rec.payload.year||'',
            audience:rec.payload.audience||'' };
    S.rowId=rec.id; S.docNumber=rec.doc_number||null; S.status=rec.status||'draft';
    S.pastOverride=false;
    if(S.cur.audience)loadAch();
    repaint();
  };
  window.cpNew=function(){ S.cur=blankDoc(); S.rowId=null; S.docNumber=null; S.status='draft'; S.pastOverride=false; repaint(); };
  window.cpSet=function(k,v){ S.cur[k]=v; repaintPreview(); };
  window.cpLang=function(l){ S.cur.lang=l; repaint(); };
  /* audience chip — internal targeting only; NEVER printed on the document */
  window.cpAud=function(a){
    S.cur.audience=a||''; S.pastOverride=false;
    if(S.cur.audience)loadAch();
    repaint();
  };

  /* ---------- section editing (admin/manager; RLS enforces server-side) ---------- */
  window.cpToggleSec=function(key,on){
    var c=client(); if(!c)return;
    /* the existing toggles override the audience emphasis: touching the past-
       projects toggle turns the audience default off for this editing session */
    if(key==='past_projects')S.pastOverride=true;
    c.from('company_profile_sections').update({enabled:!!on,updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
     .eq('key',key).select().then(function(r){
        if(r.error||!r.data||r.data.length!==1){ refusedMsg(); loadSections(true); return; }
        var s=(S.sections||[]).find(function(x){return x.key===key;}); if(s)s.enabled=!!on;
        repaint();
     });
  };
  window.cpEditSec=function(key){ S.editKey=key; repaint(); };
  window.cpEditCancel=function(){ S.editKey=null; repaint(); };
  /* items are edited as one line per item, fields separated by " | ":
     values:  EN | AR | description EN | description AR
     stats:   value | label EN | label AR
     others:  EN | AR                                                    */
  function itemsToLines(key,items){
    return (Array.isArray(items)?items:[]).map(function(it){
      if(key==='stats')return [it.value||'',it.label_en||'',it.label_ar||''].join(' | ');
      if(key==='values')return [it.en||'',it.ar||'',it.desc_en||'',it.desc_ar||''].join(' | ');
      return [it.en||'',it.ar||''].join(' | ');
    }).join('\n');
  }
  function linesToItems(key,text){
    return String(text||'').split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean)
      .map(function(l){
        var p=l.split('|').map(function(x){return x.trim();});
        if(key==='stats')return {value:p[0]||'',label_en:p[1]||'',label_ar:p[2]||''};
        if(key==='values')return {en:p[0]||'',ar:p[1]||'',desc_en:p[2]||'',desc_ar:p[3]||''};
        return {en:p[0]||'',ar:p[1]||''};
      });
  }
  window.cpEditSave=function(key){
    var c=client(); if(!c)return;
    function gv(id){ var e=document.getElementById(id); return e?e.value:''; }
    var patch={ title_en:gv('cpE_ten'), title_ar:gv('cpE_tar'),
      body_en:gv('cpE_ben'), body_ar:gv('cpE_bar'),
      updated_at:new Date().toISOString(), updated_by:(window.__userEmail||null) };
    var itEl=document.getElementById('cpE_items');
    if(itEl)patch.items=linesToItems(key,itEl.value);
    c.from('company_profile_sections').update(patch).eq('key',key).select().then(function(r){
      if(r.error||!r.data||r.data.length!==1){ refusedMsg(); return; }
      S.editKey=null; loadSections(true);
      toast(fl('Section saved','تم حفظ القسم'));
    });
  };

  /* Professional print name: "Direct — Company Profile <year> <no|DRAFT>" */
  function pdfName(){
    return 'Direct — Company Profile '+(S.cur.year||'')+' '+(S.docNumber||'DRAFT');
  }
  window.cpPrint=function(){
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
  function css(){ return '<style id="cpCss">'+
    '#cpWrap{display:grid;grid-template-columns:400px 1fr;gap:18px;align-items:start}'+
    '@media(max-width:1100px){#cpWrap{grid-template-columns:1fr}}'+
    '#cpPreviewCol{min-width:0;overflow-x:auto}'+
    '#cpWrap .cp-form label{display:block;font-weight:700;font-size:12px;margin:10px 0 4px;color:var(--ink)}'+
    '#cpWrap .cp-form input,#cpWrap .cp-form select,#cpWrap .cp-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--hairline,#ddd);border-radius:9px;padding:8px 10px;font-size:13.5px;font-family:inherit;background:var(--surface,#fff);color:var(--ink)}'+
    '#cpWrap .cp-form textarea{min-height:70px;resize:vertical}'+
    '#cpWrap .cp-seg{display:flex;border:1px solid var(--hairline,#ddd);border-radius:10px;overflow:hidden;margin-top:4px}'+
    '#cpWrap .cp-seg button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted,#777)}'+
    '#cpWrap .cp-seg button.on{background:var(--accent);color:#fff}'+
    '#cpWrap fieldset{border:1px solid var(--hairline,#ddd);border-radius:12px;margin:14px 0 0;padding:10px 12px 12px}'+
    '#cpWrap legend{font-weight:800;font-size:12px;padding:0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}'+
    '#cpWrap .cp-sec{border:1px solid var(--hairline,#ddd);border-radius:10px;padding:9px;margin-bottom:8px;background:var(--wash,#f7f7f7)}'+
    '#cpWrap .cp-sec .hd{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px}'+
    '#cpWrap .cp-sec .hd input{width:auto}'+
    '#cpWrap .cp-sec .off{color:var(--muted,#999);font-weight:400;font-size:11.5px}'+
    '#cpWrap .cp-aud{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}'+
    '#cpWrap .cp-aud button{border:1px solid var(--hairline,#ddd);background:var(--surface,#fff);color:var(--muted,#777);border-radius:99px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer}'+
    '#cpWrap .cp-aud button.on{background:var(--accent);border-color:var(--accent);color:#fff}'+
    '#cpWrap .cp-status{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:800}'+
    '#cpWrap .cp-status.draft{background:var(--wash,#eee);color:var(--muted,#777)}'+
    '#cpWrap .cp-status.sent{background:var(--wash-accent,#fff3ec);color:var(--accent)}'+
    /* --- A4 preview, Classic identity --- */
    '#cpPages{display:flex;flex-direction:column;gap:20px;align-items:center;overflow-x:auto}'+
    '#cpPages .cp-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.15));position:relative;display:flex;flex-direction:column;flex:none;color:var(--ink)}'+
    '#cpPages .cp-page.ar{direction:rtl;font-family:var(--font-ar,serif)}'+
    '#cpPages .cp-page.en{direction:ltr;font-family:var(--font-en,sans-serif)}'+
    /* Family-B gradient cover/closing: orange-red GRADIENT, rounded-corner frame
       (the real 2026 profile look, adapted to portrait A4) */
    '#cpPages .cp-page.grad{background:var(--direct-gradient);color:#fff;border-radius:22px}'+
    '#cpPages .cp-cvr{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 60px 40px}'+
    '#cpPages .cp-cvr .mid{margin:auto 0}'+
    '#cpPages .cp-cvr .lg{width:240px;display:block;margin:0 auto}'+
    '#cpPages .cp-cvr .ct2{font-size:30px;font-weight:800;margin:26px 0 0}'+
    '#cpPages .cp-cvr .cy2{font-size:20px;opacity:.95;margin-top:6px}'+
    '#cpPages .cp-cvr .cc2{font-size:17px;margin-top:18px;opacity:.95}'+
    '#cpPages .cp-cvr .cc2 b{display:block;font-size:24px;margin-top:4px}'+
    '#cpPages .cp-cvr .bot{margin-top:auto;width:100%;display:flex;align-items:flex-end;justify-content:space-between}'+
    '#cpPages .cp-cvr .bot .site{font-size:13.5px;opacity:.95}'+
    '#cpPages .cp-cvr .bot img{width:64px;height:64px;background:#fff;padding:4px;border-radius:9px;display:block}'+
    '#cpPages .cp-content{flex:1;display:flex;flex-direction:column;padding:44px 56px 104px}'+
    /* section body as a soft rounded card (Family-B content style) */
    '#cpPages .cp-seccard{background:var(--surface);border:1px solid var(--hairline);border-radius:16px;box-shadow:var(--shadow-card);padding:20px 24px}'+
    '#cpPages .cp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}'+
    '#cpPages .cp-head img{height:34px}'+
    '#cpPages .cp-head .m{font-size:11.5px;color:var(--muted)}'+
    '#cpPages .cp-h2{text-align:center;margin:0 0 20px;font-size:24px;font-weight:800}'+
    '#cpPages .cp-h2 .dia{color:var(--accent);font-size:14px;vertical-align:middle}'+
    '#cpPages .cp-p{font-size:14px;line-height:1.9;color:var(--ink);margin:0 0 14px}'+
    '#cpPages .cp-ul{font-size:14px;line-height:1.9;margin:0 0 14px;padding-inline-start:22px}'+
    '#cpPages .cp-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:6px 0 14px}'+
    '#cpPages .cp-card{background:var(--wash);border-radius:14px;padding:16px 18px}'+
    '#cpPages .cp-card b{display:block;color:var(--accent);font-size:15px;margin-bottom:6px}'+
    '#cpPages .cp-card .d{font-size:13px;line-height:1.7;color:var(--muted)}'+
    '#cpPages .cp-svc{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 14px}'+
    '#cpPages .cp-svc .it{background:var(--wash-accent);border-radius:12px;padding:11px 14px;font-size:13.5px;font-weight:600}'+
    '#cpPages .cp-svc .it .n{color:var(--accent);font-weight:800;margin-inline-end:8px}'+
    /* stat cards grid — rounded cards, HUGE orange number (real "لغة الأرقام" page) */
    '#cpPages .cp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:6px 0 14px}'+
    '#cpPages .cp-stat{background:var(--surface);border:1px solid var(--hairline);border-radius:18px;box-shadow:var(--shadow-card);padding:24px 16px;text-align:center}'+
    '#cpPages .cp-stat b{display:block;font-size:36px;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1.2}'+
    '#cpPages .cp-stat span{font-size:13px;color:var(--muted)}'+
    /* real-design footer strip: QR · email/site · branches · Arabic legal block */
    '#cpPages .cp-foot{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:14px;padding:12px 40px 14px;font-size:9.5px;color:var(--muted);box-sizing:border-box;border-top:1px solid var(--hairline)}'+
    '#cpPages .cp-foot .fq{width:44px;height:44px;flex:none}'+
    '#cpPages .cp-foot .fc{line-height:1.7;white-space:nowrap}'+
    '#cpPages .cp-foot .fb{flex:1;text-align:center;line-height:1.6}'+
    '#cpPages .cp-foot .fl{text-align:right;line-height:1.7;white-space:nowrap}'+
    /* Family-B Thank-You closing: gradient page, white logo, big Thank You,
       bottom contact strip separated by thin vertical bars */
    '#cpPages .cp-close{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 60px 40px}'+
    '#cpPages .cp-close .lg{width:210px;display:block;margin:0 auto 30px}'+
    '#cpPages .cp-thanks{font-size:46px;font-weight:800;margin:0}'+
    '#cpPages .cp-idline{font-size:12px;opacity:.85;margin-top:14px}'+
    '#cpPages .cp-cstrip{margin-top:auto;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;font-size:13.5px;opacity:.95;width:100%}'+
    '#cpPages .cp-cstrip span{padding:0 16px;border-inline-end:1px solid rgba(255,255,255,.5)}'+
    '#cpPages .cp-cstrip span:last-child{border-inline-end:0}'+
    '#cpPages .cp-draftmark{position:absolute;top:18px;inset-inline-end:18px;background:rgba(255,255,255,.9);color:var(--muted);font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;border:1px dashed var(--muted);z-index:2}'+
    '#cpPages .cp-wm{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;overflow:hidden;z-index:1}'+
    '#cpPages .cp-wm span{font-size:150px;font-weight:800;letter-spacing:.1em;color:var(--muted);opacity:.10;transform:rotate(-32deg);white-space:nowrap;user-select:none}'+
    '@media print{'+
      'body *{visibility:hidden}'+
      '#cpPages,#cpPages *{visibility:visible}'+
      '#cpPages{position:absolute;left:0;top:0;display:block}'+
      '#cpPages .cp-page{width:auto;box-shadow:none;margin:0;page-break-after:always}'+
      '#cpPages .cp-page.grad{min-height:0;height:99.3vh;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '#cpPages .cp-page:not(.grad){height:auto;min-height:99.3vh}'+
      '#cpPages .cp-card,#cpPages .cp-stat,#cpPages .cp-svc .it{-webkit-print-color-adjust:exact;print-color-adjust:exact;page-break-inside:avoid}'+
      '#cpPages .cp-page:last-child{page-break-after:auto}'+
    '}'+
    '@page{size:A4;margin:0}'+
    '</style>'; }

  /* ---------- render: preview pages ---------- */
  function sectionBody(s,ar){
    var body=ar?(s.body_ar||s.body_en):(s.body_en||s.body_ar);
    var items=Array.isArray(s.items)?s.items:[];
    /* audience emphasis: with a targeted audience chosen AND the achievements
       fetch succeeded, the stats/services/past-projects ITEMS come from the
       audience-tagged company_achievements rows. Values are never filtered.
       Any other situation (General, no selection, fetch failed) renders the
       stored sections exactly as before — never invented content (M8). */
    var achItems=null;
    if(s.key==='services'){
      var svcA=achFor('service');
      if(svcA!==null)achItems=svcA.map(function(r){return {en:r.title_en||'',ar:r.title_ar||''};});
    }else if(s.key==='past_projects'){
      var ppA=achFor('past_project');
      if(ppA!==null)achItems=ppA.map(function(r){return {en:r.title_en||'',ar:r.title_ar||''};});
    }
    if(achItems!==null)items=achItems;
    var html=body?mdLite(body):'';
    if(s.key==='values'&&items.length){
      html+='<div class="cp-cards">'+items.map(function(it){
        var nm=ar?(it.ar||it.en):(it.en||it.ar);
        var d=ar?(it.desc_ar||it.desc_en||''):(it.desc_en||it.desc_ar||'');
        return '<div class="cp-card"><b>'+esc(nm)+'</b>'+(d?'<div class="d">'+esc(d)+'</div>':'')+'</div>';
      }).join('')+'</div>';
    }else if(s.key==='services'&&items.length){
      html+='<div class="cp-svc">'+items.map(function(it,i){
        var nm=ar?(it.ar||it.en):(it.en||it.ar);
        return '<div class="it"><span class="n">'+(i+1)+'</span>'+esc(nm)+'</div>';
      }).join('')+'</div>';
    }else if(s.key==='stats'){
      /* the stats band renders ONLY when items exist — the canonical numbers
         are an open owner question; nothing is invented. With a targeted
         audience the band shows the audience-tagged achievement stats. */
      var statA=achFor('stat');
      var cells;
      if(statA!==null){
        cells=statA.map(function(r){
          return statSplit(ar?(r.title_ar||r.title_en):(r.title_en||r.title_ar));
        });
      }else{
        cells=items.map(function(it){
          if(it&&it.value!=null)
            return {value:it.value,label:ar?(it.label_ar||it.label_en||''):(it.label_en||it.label_ar||'')};
          return statSplit(ar?(it.ar||it.en):(it.en||it.ar));   /* tolerate {en,ar} rows */
        });
      }
      if(!cells.length)return '';
      html+='<div class="cp-stats">'+cells.map(function(c){
        return '<div class="cp-stat"><b>'+esc(c.value||'')+'</b><span>'+esc(c.label||'')+'</span></div>';
      }).join('')+'</div>';
    }else if(items.length){
      html+='<ul class="cp-ul">'+items.map(function(it){
        return '<li>'+esc(ar?(it.ar||it.en):(it.en||it.ar))+'</li>';
      }).join('')+'</ul>';
    }
    return html;
  }
  function pagesHtml(){
    var lang=S.cur.lang||'en', t=T[lang], ar=lang==='ar';
    var dirCls=ar?'ar':'en';
    var issued=!!S.docNumber, no=S.docNumber||'—';
    var draftMark=issued?'':'<div class="cp-draftmark">'+t.draftPill+'</div>';
    var wm=issued?'':'<div class="cp-wm"><span>'+t.wm+'</span></div>';
    var cn=S.cur.clientId?bizName(S.cur.clientId,lang):'';
    var site=idv('website','en')||'www.directksa.com';
    var phone=idv('phone_licence','en');
    var mail=idv('email','en');
    var addr=idv('address',lang)||idv('address','en');
    var legal=idv('legal_name',lang);
    var crL=idv('cr_number','en'), vatL=idv('vat_number','en');
    var footer=footHtml();

    /* page 1 — Family-B gradient cover: white logo centered mid-page, title/year,
       optional client name (personalized cover variant — cover ONLY);
       bottom-left www.directksa.com, bottom-right QR. NO document number. */
    var cover=
    '<div class="cp-page grad '+dirCls+'">'+draftMark+'<div class="cp-cvr">'+
      '<div class="mid">'+
        '<img class="lg" src="/brand/direct_logo_white.png" alt="Direct">'+
        '<div class="ct2">'+t.cover+'</div>'+
        (S.cur.year?'<div class="cy2">'+esc(S.cur.year)+'</div>':'')+
        (cn?'<div class="cc2">'+t.prepFor+'<b>'+esc(cn)+'</b></div>':'')+
      '</div>'+
      '<div class="bot"><span class="site">'+esc(site)+'</span>'+
        '<img src="/brand/direct_qr_directksa.png" alt="QR" onerror="this.style.display=\'none\'">'+
      '</div>'+
    '</div></div>';

    /* one page per enabled section, in sort order. Audience emphasis: past
       projects print for Government / Corporate & MICE and hide for the other
       targeted audiences — a starting default the section toggles override
       (and only when the achievements fetch succeeded; otherwise as-is). */
    var audK=S.cur.audience;
    var hidePast=!!audK&&Array.isArray(S.ach)&&!S.pastOverride&&
      audK!=='government'&&audK!=='corporate_mice';
    var secs=(S.sections||[]).filter(function(s){
        return s.enabled&&!(hidePast&&s.key==='past_projects');
      })
      .sort(function(a,b){return a.sort-b.sort;});
    var secPages=secs.map(function(s){
      var body=sectionBody(s,ar);
      if(!body)return '';                              /* stats with no items → no page */
      var title=ar?(s.title_ar||s.title_en):(s.title_en||s.title_ar);
      return '<div class="cp-page '+dirCls+'">'+wm+'<div class="cp-content">'+
        '<div class="cp-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
          '<div class="m">'+t.cover+' '+esc(S.cur.year||'')+'</div></div>'+
        '<h2 class="cp-h2"><span class="dia">◆</span> '+esc(title)+' <span class="dia">◆</span></h2>'+
        '<div class="cp-seccard">'+body+'</div>'+footer+
      '</div></div>';
    }).join('');

    /* closing — Family-B Thank-You page: gradient, white logo, big white Thank You,
       bottom contact strip phone | email | website separated by thin bars.
       The small identity line keeps CR/VAT visible on the document. */
    var idBits=[legal,crL?('CR '+crL):'',vatL?('VAT '+vatL):''].filter(Boolean).map(function(x){return esc(x);}).join(' · ');
    var strip=[phone,mail,site].filter(Boolean).map(function(x){return '<span>'+esc(x)+'</span>';}).join('');
    var closing=
    '<div class="cp-page grad '+dirCls+'">'+draftMark+'<div class="cp-close">'+
      '<div style="margin:auto 0">'+
        '<img class="lg" src="/brand/direct_logo_white.png" alt="Direct">'+
        '<p class="cp-thanks">'+t.thanks+'</p>'+
        (idBits?'<div class="cp-idline">'+idBits+'</div>':'')+
      '</div>'+
      '<div class="cp-cstrip">'+(strip||'<span>'+esc(site)+'</span>')+'</div>'+
    '</div></div>';

    return cover+secPages+closing;
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
    return '<option value="">'+fl('— generic profile (no client name) —','— ملف عام (بدون اسم عميل) —')+'</option>'+
      (clients.length?'<optgroup label="'+fl('Clients','العملاء')+'">'+opts(clients)+'</optgroup>':'')+
      (leads.length?'<optgroup label="'+fl('Leads','العملاء المحتملون')+'">'+opts(leads)+'</optgroup>':'');
  }
  function savedOptions(){
    var list=S.list||[];
    return '<option value="">'+
      (list.length?fl('— open a saved profile ('+list.length+') —','— افتح ملفاً محفوظاً ('+list.length+') —')
                  :fl('— no saved profiles yet —','— لا توجد ملفات محفوظة بعد —'))+'</option>'+
      list.map(function(o){
        var label=(o.doc_number||fl('draft','مسودة'))+' · '+(o.title||'')+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'" '+(S.rowId===o.id?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }
  function secEditorHtml(s){
    var hasItems=['values','services','stats'].indexOf(s.key)>=0||(Array.isArray(s.items)&&s.items.length>0);
    var hint=s.key==='stats'
      ? fl('One stat per line: value | label EN | label AR. The band prints only when you add lines.',
           'إحصائية في كل سطر: القيمة | التسمية إنجليزي | التسمية عربي. يظهر الشريط فقط عند إضافة أسطر.')
      : s.key==='values'
      ? fl('One value per line: EN | AR | description EN | description AR','قيمة في كل سطر: إنجليزي | عربي | وصف إنجليزي | وصف عربي')
      : fl('One item per line: EN | AR','عنصر في كل سطر: إنجليزي | عربي');
    return '<div style="margin-top:8px">'+
      '<label>'+fl('Title (EN)','العنوان بالإنجليزية')+'</label><input id="cpE_ten" value="'+esc(s.title_en||'')+'">'+
      '<label>'+fl('Title (AR)','العنوان بالعربية')+'</label><input dir="rtl" id="cpE_tar" value="'+esc(s.title_ar||'')+'">'+
      '<label>'+fl('Body (EN) — paragraphs, and lines starting "- " become bullets','النص بالإنجليزية — فقرات، والأسطر التي تبدأ بـ "- " تصبح نقاطاً')+'</label>'+
      '<textarea id="cpE_ben">'+esc(s.body_en||'')+'</textarea>'+
      '<label>'+fl('Body (AR)','النص بالعربية')+'</label>'+
      '<textarea id="cpE_bar" dir="rtl">'+esc(s.body_ar||'')+'</textarea>'+
      (hasItems?'<label>'+fl('Items','العناصر')+'</label>'+
        '<textarea id="cpE_items" style="min-height:110px">'+esc(itemsToLines(s.key,s.items))+'</textarea>'+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:4px">'+hint+'</div>':'')+
      '<div style="margin-top:8px"><button class="btn sm pri" onclick="cpEditSave(\''+esc(s.key)+'\')">'+fl('Save section','حفظ القسم')+'</button> '+
      '<button class="btn sm ghost" onclick="cpEditCancel()">'+fl('Cancel','إلغاء')+'</button></div></div>';
  }
  function sectionsFormHtml(){
    if(S.sections===null)return '<div>'+fl('Loading sections…','جارٍ تحميل الأقسام…')+'</div>';
    var edit=canEditSections();
    return (S.sections||[]).slice().sort(function(a,b){return a.sort-b.sort;}).map(function(s){
      var title=isAr()?(s.title_ar||s.title_en):(s.title_en||s.title_ar);
      return '<div class="cp-sec"><div class="hd">'+
        (edit?'<input type="checkbox" '+(s.enabled?'checked':'')+' onchange="cpToggleSec(\''+esc(s.key)+'\',this.checked)">':'')+
        '<span>'+esc(title)+'</span>'+
        (s.enabled?'':'<span class="off">'+fl('(hidden)','(مخفي)')+'</span>')+
        (edit?'<span style="margin-inline-start:auto"><button class="btn sm ghost" onclick="cpEditSec(\''+esc(s.key)+'\')">'+fl('Edit','تعديل')+'</button></span>':'')+
        '</div>'+
        (S.editKey===s.key?secEditorHtml(s):'')+
      '</div>';
    }).join('');
  }
  function formHtml(){
    var st=S.status||'draft';
    var stLabel=st==='draft'?fl('Draft','مسودة'):fl('Issued / sent','صادر / مُرسل');
    var w=canWrite();
    return '<div class="card cp-form">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<b>'+fl('Company Profile','الملف التعريفي')+'</b>'+
        '<span class="cp-status '+esc(st)+'">'+stLabel+(S.docNumber?' · '+esc(S.docNumber):'')+'</span>'+
      '</div>'+
      '<label>'+fl('Saved profiles','الملفات المحفوظة')+'</label>'+
      '<select onchange="if(this.value)cpOpen(this.value)">'+savedOptions()+'</select>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" onclick="cpNew()">＋ '+fl('New','جديد')+'</button>'+
      '</div>'+
      '<label>'+fl('Document language','لغة المستند')+'</label>'+
      '<div class="cp-seg">'+
        '<button type="button" class="'+((S.cur.lang||'en')==='en'?'on':'')+'" onclick="cpLang(\'en\')">English</button>'+
        '<button type="button" class="'+(S.cur.lang==='ar'?'on':'')+'" onclick="cpLang(\'ar\')">العربية</button>'+
      '</div>'+
      '<fieldset><legend>'+fl('Who is this profile for?','لمن هذا الملف؟')+'</legend>'+
        '<div class="cp-aud">'+AUD.map(function(a){
          return '<button type="button" data-aud="'+esc(a.k)+'" class="'+(((S.cur.audience||'')===a.k)?'on':'')+'" onclick="cpAud(\''+esc(a.k)+'\')">'+esc(fl(a.en,a.ar))+'</button>';
        }).join('')+'</div>'+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:6px">'+
          fl('Internal targeting only — it never prints on the document. It sets which stats, services and past projects are emphasized; every section stays editable.',
             'استهداف داخلي فقط — لا يُطبع على المستند أبداً. يحدد الأرقام والخدمات والمشاريع المُبرزة؛ وتبقى كل الأقسام قابلة للتعديل.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Cover','الغلاف')+'</legend>'+
        '<label>'+fl('Year','السنة')+'</label>'+
        '<input value="'+esc(S.cur.year)+'" oninput="cpSet(\'year\',this.value)">'+
        '<label>'+fl('Personalized cover (optional) — client name on the cover only','غلاف مخصص (اختياري) — اسم العميل على الغلاف فقط')+'</label>'+
        '<select onchange="cpSet(\'clientId\',this.value)">'+clientOptions()+'</select>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Sections','الأقسام')+'</legend>'+
        sectionsFormHtml()+
        '<div style="font-size:11.5px;color:var(--muted,#777);margin-top:6px">'+
          fl('Editing a section changes every future profile.',
             'تعديل أي قسم يغيّر كل ملف مستقبلي.')+'</div>'+
      '</fieldset>'+
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
        (w?'<button class="btn sm pri" '+(S.saving?'disabled':'')+' onclick="cpSaveDraft()">'+(S.saving?fl('Saving…','جارٍ الحفظ…'):fl('Save draft','حفظ المسودة'))+'</button>':'')+
        (w&&!S.docNumber?'<button class="btn sm ghost" data-v21relabeled="true" onclick="cpIssue()">'+fl('Issue profile','إصدار الملف')+'</button>':'')+
        '<button class="btn sm ghost" onclick="cpPrint()">'+fl('Print / PDF','طباعة / PDF')+'</button>'+
      '</div>'+
    '</div>';
  }

  /* ---------- render: tab body + targeted repaints ---------- */
  function tabHtml(){
    loadSections(); loadIdentity(); loadList();
    return css()+
      '<div id="cpWrap">'+
        '<div>'+formHtml()+'</div>'+
        '<div id="cpPreviewCol" data-identity="classic"><div id="cpPages">'+pagesHtml()+'</div></div>'+
      '</div>';
  }
  function repaint(){ try{ if(typeof current!=='undefined'&&current==='documents')render(); }catch(_){} }
  function repaintPreview(){
    var el=document.getElementById('cpPages');
    if(el)el.innerHTML=pagesHtml(); else repaint();
  }

  /* ---------- register through the js/66 seam ---------- */
  if(typeof window.dgRegisterTab==='function'){
    window.dgRegisterTab('profile', tabHtml);
  }else{
    console.warn('[cp] dgRegisterTab missing — js/66 not loaded first?');
  }

  console.info('[cp] company profile tab loaded (generated_documents / PRF)');
}catch(e){ if(window.console)console.warn('[cp] init',e); }})();
