/* ===== Document Generator — one page, tabs per document family (phase 1, 2026-08-24) =====

   The single page that will generate every client-facing document: Company Assets ·
   Price Offer · Service-Fee Proposal · Company Profile (phase 2: Contract, Technical+
   Financial). One engine + scenario templates; nothing hardcoded to any client.

   This file ships STEP 1 of the approved build order: the Company Assets tab, backed by
   the `company_identity` registry in Supabase (single source of truth for CR, VAT,
   licences, IBANs, contacts — with expiry dates driving a renewals radar).

   Architecture rules honoured here (docs/DECISIONS.md):
   - P5/F1: brand comes from /brand/tokens.css AT RUNTIME. This layer injects the
     stylesheet and styles the document surfaces with var(--...) only. No copied hexes
     for brand colours anywhere in this file. window.__dgBrandProbe() exists so a QA
     probe can PROVE the tokens are read (sabotage-testable, rule B7).
   - F2/F3: nothing here touches localStorage. Registry lives in Supabase; document
     numbering is server-side and atomic (public.next_document_number).
   - D4: registry VALUES (IBANs etc.) live in Supabase only — none are in this file.
   - B2: every write uses .select() and checks the returned row count.
   - M8: the registry stores a named source per value; the editor keeps it visible.     */
(function(){try{

  /* ---------- shared helpers ---------- */
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function canEdit(){ try{ var r=window.__userRole; return r==='admin'||r==='manager'; }catch(_){ return false; } }
  function toast(msg){ try{ if(window.__toast){__toast(msg);return;} }catch(_){}
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink,#333);color:#fff;padding:10px 16px;border-radius:10px;z-index:9999;font-size:14px';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){try{t.remove();}catch(_){}} ,2600);
  }

  /* ---------- part 1 — tokens.css wired at runtime (F1 fix + probe hook) ---------- */
  (function wireTokens(){
    if(!document.getElementById('dgTokensLink')){
      var l=document.createElement('link');
      l.id='dgTokensLink'; l.rel='stylesheet'; l.href='/brand/tokens.css';
      document.head.appendChild(l);
    }
  })();
  /* Probe hook: computes the identity variables the way any generated document will —
     from a live element carrying data-identity — so a QA probe can compare the values
     the page actually resolves against the ones written in /brand/tokens.css. If the
     stylesheet is not loaded (sabotage test: remove the link), the vars come back empty
     and the probe fails loudly. */
  window.__dgBrandProbe=function(identity){
    var el=document.createElement('div');
    el.setAttribute('data-identity',identity||'classic');
    el.style.display='none'; document.body.appendChild(el);
    var cs=getComputedStyle(el);
    var out={
      accent:cs.getPropertyValue('--accent').trim(),
      accentStrong:cs.getPropertyValue('--accent-strong').trim(),
      ink:cs.getPropertyValue('--ink').trim(),
      gold:cs.getPropertyValue('--gold').trim(),
      linkPresent:!!document.getElementById('dgTokensLink')
    };
    el.remove(); return out;
  };

  /* ---------- part 2 — register the page ---------- */
  var IC_DOCS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';
  try{
    /* User-facing name is "Generator" (owner-approved rename). The internal page id
       stays 'documents' — router keys and access lists depend on it. Labels only. */
    if(typeof TITLES==='object')TITLES.documents=['Generator','Generate every client-facing document from one place'];
    try{ if(window.__V25_TITLES_AR)window.__V25_TITLES_AR.documents=['المولّد','أنشئ كل مستندات العملاء من مكان واحد']; }catch(_){}
    try{ if(typeof I18N==='object'&&I18N.en&&I18N.ar){ I18N.en['Generator']='Generator'; I18N.ar['Generator']='المولّد'; } }catch(_){}
    if(typeof VIEWS!=='undefined'&&VIEWS.push&&!VIEWS.some(function(v){return v.id==='documents';})){
      var ix=VIEWS.findIndex(function(v){return v.id==='offers';});
      VIEWS.splice(ix>=0?ix+1:VIEWS.length,0,{id:'documents',label:'Generator',ic:IC_DOCS,primary:true});
      try{ if(typeof buildNav==='function')buildNav(); }catch(_){}
    }else if(typeof VIEWS!=='undefined'){
      VIEWS.forEach(function(v){ if(v.id==='documents')v.label='Generator'; });
    }
  }catch(e){ console.warn('[dg] view register',e); }

  /* ---------- part 3 — state + data ---------- */
  var DG={tab:'assets', rows:null, loading:false, editKey:null, revealed:{}, __push:false};

  /* ---------- sub-addresses: /documents/<tab> ----------
     js/03 (not modified) parses /documents/offer as sec='documents' and ignores the
     second segment — verified against its regex. Its writeURL, wrapped OUTERMOST
     around render, would rewrite the address bar to plain '/documents' after every
     render. So this layer: (a) adopts the tab from the pathname when the URL changed
     outside us (initial load, back/forward), (b) parks the path at '/documents'
     synchronously during render so js/03's writeURL sees "nothing changed" and never
     pushes a duplicate entry, then (c) restores '/documents/<tab>' on a 0-timeout,
     which runs after writeURL. Tab clicks push a real history entry (back undoes
     the tab switch); everything else replaces in place. */
  var TAB_IDS=['assets','offer','fees','profile','contract','tender'];
  function pathTab(){ var m=String(location.pathname||'').match(/^\/documents\/([a-zA-Z]+)\/?$/); return (m&&TAB_IDS.indexOf(m[1])>=0)?m[1]:null; }
  (function(){ var t=pathTab(); if(t)DG.tab=t; })();
  function urlSync(){
    try{
      var t=pathTab();
      if(t&&t!==DG.tab&&!DG.__push)DG.tab=t;           /* external change: boot / popstate */
      if(location.pathname!=='/documents')history.replaceState({p:'/documents',f:''},'','/documents');
      var push=DG.__push; DG.__push=false;
      setTimeout(function(){ try{
        if(typeof current!=='undefined'&&current!=='documents')return;   /* user already left */
        var want='/documents/'+DG.tab;
        if(location.pathname==='/documents'){
          if(push)history.pushState({p:want,f:''},'',want);
          else history.replaceState({p:want,f:''},'',want);
        }
      }catch(_){} },0);
    }catch(_){}
  }
  /* QA hook: lets a probe read which tab the page believes is open */
  window.__dgTabProbe=function(){ return DG.tab; };
  /* Eager registry load (audit fix): the AGENCY hydration above must not wait for the
     Generator page to be opened — invoice previews can print before that. Retry until
     the shared client exists (sign-in) and the rows arrive, then stop. */
  (function(){ var tries=0; var t=setInterval(function(){ try{
    tries++; if(DG.rows||tries>40){ clearInterval(t); return; }
    loadRegistry();
  }catch(_){ } },1500); })();
  function loadRegistry(force){
    if(DG.loading)return; if(DG.rows&&!force)return;
    var c=client(); if(!c)return;
    DG.loading=true;
    c.from('company_identity').select('*').order('sort',{ascending:true}).then(function(r){
      DG.loading=false;
      if(r.error){ console.warn('[dg] registry load',r.error); DG.rows=[]; }
      else DG.rows=r.data||[];
      /* Hydrate the legacy AGENCY block (core-06) from the registry — audit fix 2026-08-24.
         Its VAT/IBAN literals were stale (old VAT number; an IBAN matching none of the
         registered accounts) and printed on in-app invoice previews + seeded the ZATCA QR.
         The literals are now empty in core-06; the CURRENT values flow from here, so a
         registry edit updates every consumer. Default document account = Al Rajhi (the
         account on recent letters — owner question Q4; change the registry row to change it). */
      try{
        /* AGENCY is a top-level const in core-06 — a global binding but NOT a window property */
        if(typeof AGENCY!=='undefined'&&AGENCY&&DG.rows&&DG.rows.length){
          var g=function(k){ var x=DG.rows.find(function(r){return r.key===k;}); return x?(x.value_en||''):''; };
          if(g('vat_number'))AGENCY.vat=g('vat_number');
          /* owner ruling 25 Aug: the DEFAULT account on documents is ALINMA */
          if(g('iban_alinma')){ AGENCY.iban=g('iban_alinma'); AGENCY.bank='Alinma Bank'; }
          else if(g('iban_alrajhi')){ AGENCY.iban=g('iban_alrajhi'); AGENCY.bank='Al Rajhi Bank'; }
          if(g('cr_number'))AGENCY.cr=g('cr_number');
          if(g('capital'))AGENCY.capital=g('capital')+' SAR';
        }
      }catch(e){ console.warn('[dg] agency hydrate',e); }
      try{ if(current==='documents')render(); }catch(_){}
    });
  }

  var CAT_LABEL={legal:['Legal identity','الهوية القانونية'],tax:['Tax','الضرائب'],licence:['Licences','التراخيص'],
    banking:['Bank accounts','الحسابات البنكية'],
    wallet:['Wallets — outgoing only','المحافظ — للإرسال فقط'],
    contact:['Contact & address','التواصل والعنوان'],
    membership:['Memberships & certificates','العضويات والشهادات'],stats:['Company numbers','أرقام الشركة'],
    brand:['Brand','العلامة'],other:['Other','أخرى']};
  var CAT_ORDER=['legal','tax','licence','membership','banking','wallet','contact','brand','stats','other'];
  /* one small muted note under a category header (wallets: never a receiving account) */
  var CAT_NOTE={wallet:['Used to fund virtual cards; we do not receive money on wallets.','تُستخدم لتغذية البطاقات الافتراضية؛ لا نستقبل أموالاً عليها.']};

  function expiryState(d){
    if(!d)return null;
    var today=new Date(); today.setHours(0,0,0,0);
    var x=new Date(d+'T00:00:00'); var days=Math.round((x-today)/86400000);
    if(days<0)return {cls:'exp',days:days,txt:fl('EXPIRED','منتهية')};
    if(days<=90)return {cls:'soon',days:days,txt:fl(days+' days left','باقي '+days+' يوماً')};
    return {cls:'ok',days:days,txt:fl('valid','سارية')};
  }

  function copyText(txt,okMsg){
    function done(){ toast(okMsg||fl('Copied','تم النسخ')); }
    try{ navigator.clipboard.writeText(txt).then(done,function(){ fallback(); }); }
    catch(_){ fallback(); }
    function fallback(){ try{ var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }catch(_){ toast(fl('Copy failed','فشل النسخ')); } }
  }
  window.dgCopy=function(key){
    var r=(DG.rows||[]).find(function(x){return x.key===key;}); if(!r)return;
    copyText(isAr()&&r.value_ar?r.value_ar:(r.value_en||''), fl('Copied','تم النسخ'));
  };
  window.dgReveal=function(key){ DG.revealed[key]=!DG.revealed[key]; try{render();}catch(_){} };

  /* ---------- proof documents (PRIVATE bucket 'company-docs') ----------
     Rows with proof_path get View/Download via a short-lived signed URL. Opening the
     signed URL in a new tab is the ONE allowed exception to "nothing leaves this
     page" — a PDF has to open somewhere. */
  function signedProof(key,cb,forDownload){
    var r=(DG.rows||[]).find(function(x){return x.key===key;});
    if(!r||!r.proof_path){ cb(null); return; }
    var c=client(); if(!c){ cb(null); return; }
    /* download_name (registry column) is the descriptive file name used ONLY at download
       time — e.g. "Darb Pay virtual IBAN for Direct Travel.pdf". Never shown on screen. */
    var opts=forDownload?{download:(r.download_name||((r.label_en||r.key)+'.pdf'))}:undefined;
    try{
      c.storage.from('company-docs').createSignedUrl(r.proof_path,600,opts).then(function(res){
        if(res.error||!res.data||!res.data.signedUrl){ cb(null); return; }
        cb(res.data.signedUrl);
      },function(){ cb(null); });
    }catch(_){ cb(null); }
  }
  window.dgProofView=function(key){
    signedProof(key,function(u){
      if(!u){ toast(fl('Could not open the document','تعذّر فتح المستند')); return; }
      try{ var w=window.open(u,'_blank','noopener'); if(!w)toast(fl('Pop-up blocked — allow pop-ups to view','حُجبت النافذة — اسمح بالنوافذ المنبثقة للعرض')); }catch(_){}
    });
  };
  window.dgProofDownload=function(key){
    /* the signed URL already carries &download=<descriptive name> (createSignedUrl's
       download option), so the browser saves the file under its proper name */
    signedProof(key,function(u){
      if(!u){ toast(fl('Could not open the document','تعذّر فتح المستند')); return; }
      try{ var w=window.open(u,'_blank','noopener'); if(!w)toast(fl('Pop-up blocked','حُجبت النافذة')); }catch(_){}
    },true);
  };
  window.dgProofUpload=function(key,input){
    var f=input&&input.files&&input.files[0]; if(!f)return;
    var r=(DG.rows||[]).find(function(x){return x.key===key;}); if(!r)return;
    var c=client(); if(!c)return;
    var mExt=String(f.name||'').match(/\.([A-Za-z0-9]+)$/);
    var ext=(mExt?mExt[1]:'pdf').toLowerCase();
    var path=(r.category||'other')+'/'+r.key+'.'+ext;   /* clean, stable path; upsert replaces */
    toast(fl('Uploading…','جارٍ الرفع…'));
    try{
      c.storage.from('company-docs').upload(path,f,{upsert:true}).then(function(up){
        if(up.error){ toast(fl('Upload was refused','رُفض الرفع')); return; }
        c.from('company_identity').update({proof_path:path,updated_by:(window.__userEmail||null)})
         .eq('key',key).select().then(function(s){
            if(s.error||!s.data||s.data.length!==1){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); return; }
            loadRegistry(true); toast(fl('Proof attached','تم إرفاق المستند'));
         });
      },function(){ toast(fl('Upload was refused','رُفض الرفع')); });
    }catch(_){ toast(fl('Upload was refused','رُفض الرفع')); }
  };
  function proofBtns(r,mini){
    if(!r.proof_path)return '';
    return '<button class="btn sm ghost dg-mini" onclick="dgProofView(\''+esc(r.key)+'\')">'+fl('View document','عرض المستند')+'</button> '+
      (mini?'':'<button class="btn sm ghost dg-mini" onclick="dgProofDownload(\''+esc(r.key)+'\')">'+fl('Download','تنزيل')+'</button> ');
  }
  function proofAttach(r){
    if(!canEdit())return '';
    return '<label class="btn sm ghost dg-mini" style="cursor:pointer">'+
      (r.proof_path?fl('Replace proof','استبدال المستند'):fl('Attach proof','إرفاق مستند'))+
      '<input type="file" accept="application/pdf,image/*" style="display:none" onchange="dgProofUpload(\''+esc(r.key)+'\',this)"></label> ';
  }

  /* "Send bank details" one-tap block: built from live registry rows, Al Rajhi first.
     RECEIVING accounts only — category 'banking'. Wallets (category 'wallet') are
     outgoing-only and are deliberately excluded from this block. */
  window.dgCopyBank=function(){
    var rows=(DG.rows||[]).filter(function(r){return r.category==='banking';});
    rows.sort(function(a,b){return a.sort-b.sort;});
    var name=(DG.rows||[]).find(function(r){return r.key==='legal_name';})||{};
    var cr=(DG.rows||[]).find(function(r){return r.key==='cr_number';})||{};
    var vat=(DG.rows||[]).find(function(r){return r.key==='vat_number';})||{};
    var L=[];
    L.push(isAr()?(name.value_ar||name.value_en||''):(name.value_en||''));
    if(cr.value_en)L.push(fl('CR: ','السجل التجاري: ')+cr.value_en);
    if(vat.value_en)L.push(fl('VAT: ','الرقم الضريبي: ')+vat.value_en);
    L.push('');
    rows.forEach(function(r){ L.push((isAr()&&r.label_ar?r.label_ar:r.label_en)+': '+(r.value_en||'')); });
    copyText(L.join('\n'), fl('Bank details copied — paste into WhatsApp or email','تم نسخ البيانات البنكية — الصقها في واتساب أو البريد'));
  };

  /* ---------- part 4 — inline editor (admin/manager; RLS enforces server-side) ---------- */
  window.dgEdit=function(key){ DG.editKey=key; try{render();}catch(_){} };
  window.dgEditCancel=function(){ DG.editKey=null; try{render();}catch(_){} };
  window.dgEditSave=function(key){
    var c=client(); if(!c)return;
    function gv(id){ var e=document.getElementById(id); return e?e.value:null; }
    var patch={ value_en:gv('dgE_en'), value_ar:gv('dgE_ar'), source:gv('dgE_src'),
      expires_on:(gv('dgE_exp')||null), updated_by:(window.__userEmail||null) };
    if(patch.expires_on==='')patch.expires_on=null;
    c.from('company_identity').update(patch).eq('key',key).select().then(function(r){
      if(r.error||!r.data||r.data.length!==1){ /* B2: refused writes must not look like success */
        toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); return;
      }
      DG.editKey=null; loadRegistry(true);
      toast(fl('Saved','تم الحفظ'));
    });
  };

  /* ---------- part 5 — render ---------- */
  var TABS=[
    ['assets', 'Company Assets','أصول الشركة'],
    ['offer',  'Price Offer','عرض السعر'],
    ['fees',   'Service-Fee Proposal','عرض رسوم الخدمات'],
    ['profile','Company Profile','الملف التعريفي'],
    ['contract','Contract / العقد','العقد'],
    ['tender','Tender / المناقصات','المناقصات']
  ];
  window.dgGo=function(t){ DG.tab=t; DG.__push=true; try{render();}catch(_){} };
  /* back/forward inside the page: js/03's popstate handler re-renders; renderDocs then
     adopts the tab from the restored pathname via urlSync(). Defensive extra listener:
     if js/03's render did not run (edge), repaint ourselves. */
  window.addEventListener('popstate',function(){
    try{
      if(typeof current==='undefined'||current!=='documents')return;
      var t=pathTab();
      if(t&&t!==DG.tab){ DG.tab=t; var v=document.getElementById('view'); if(v&&v.querySelector('#dgWrap'))renderDocs(v); }
    }catch(_){}
  });

  function css(){ return '<style>'+
    '#dgWrap{--dg-acc:var(--accent,#888)}'+
    '#dgWrap .dg-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}'+
    '#dgWrap .dg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}'+
    '#dgWrap .dg-grid>*{min-width:0}'+
    '#dgWrap .dg-cat h3{margin:18px 0 8px;color:var(--accent);font-size:15px}'+
    '#dgWrap table.dg{width:100%;border-collapse:collapse;font-size:13.5px}'+
    '#dgWrap table.dg td{padding:7px 8px;border-bottom:1px solid var(--hairline,#eee);vertical-align:top}'+
    '#dgWrap .dg-key{color:var(--muted,#777);white-space:nowrap}'+
    '#dgWrap .dg-val{font-weight:600;word-break:break-all}'+
    '#dgWrap .dg-src{color:var(--muted,#999);font-size:11.5px;font-weight:400;margin-top:2px}'+
    '#dgWrap .dg-pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:700;white-space:nowrap}'+
    '#dgWrap .dg-pill.exp{background:#FDECEB;color:#D92D20}'+
    '#dgWrap .dg-pill.soon{background:var(--wash-accent,#FFF3EC);color:var(--accent)}'+
    '#dgWrap .dg-pill.ok{background:#EAF6EE;color:#1E7A34}'+
    '#dgWrap .dg-pill.nodate{background:var(--wash,#F0F0F0);color:var(--muted,#777)}'+
    '#dgWrap .dg-chip{display:flex;flex-direction:column;align-items:center;gap:8px;border:1px solid var(--hairline,#eee);border-radius:12px;padding:12px;width:150px}'+
    '#dgWrap .dg-chip .th{display:grid;place-items:center;width:100%;height:64px;border-radius:8px}'+
    '#dgWrap .dg-chip .th.light{background:var(--wash,#F6F7F9)}'+
    '#dgWrap .dg-chip .th.dark{background:var(--ink,#333)}'+
    '#dgWrap .dg-chip img{max-width:90%;max-height:52px}'+
    '#dgWrap .dg-chip .nm{font-size:12px;color:var(--muted,#777);text-align:center}'+
    '#dgWrap .dg-mini{font-size:12px;padding:3px 9px}'+
    '#dgWrap .dg-radar{overflow-x:auto}'+
    '#dgWrap .dg-date{white-space:nowrap}'+
    '#dgWrap .dg-grid>.card{display:flex;flex-direction:column;margin:0}'+
    '#dgWrap .dg-assets img{max-width:100%;max-height:56px}'+
    '#dgWrap .dg-edit{background:var(--wash,#F6F7F9);border-radius:10px}'+
    '#dgWrap .dg-edit-title{font-weight:700;font-size:13px;margin:2px 0 8px}'+
    '#dgWrap .dg-edit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}'+
    '#dgWrap .dg-f{display:flex;flex-direction:column;gap:3px;min-width:0}'+
    '#dgWrap .dg-fl{font-size:11.5px;color:var(--muted,#777)}'+
    '#dgWrap .dg-edit input{width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:7px 8px;border:1px solid var(--hairline,#ccc);border-radius:8px;font-size:13px}'+
    '</style>'; }

  function rowHtml(r){
    if(DG.editKey===r.key){
      /* owner feedback 2026-08-25: editing felt "kinda weird" — bare unlabeled inputs
         stacked in a jumping row. Now: a labeled 2-column grid (label ABOVE each input,
         consistent widths, date input capped) spanning the full row, so nothing shifts. */
      function fld(label,inner){ return '<label class="dg-f"><span class="dg-fl">'+label+'</span>'+inner+'</label>'; }
      return '<tr class="dg-editrow"><td colspan="3" class="dg-edit">'+
        '<div class="dg-edit-title">'+fl('Editing: ','تعديل: ')+esc(isAr()&&r.label_ar?r.label_ar:r.label_en)+'</div>'+
        '<div class="dg-edit-grid">'+
        fld(fl('Value (English)','القيمة (إنجليزي)'),'<input id="dgE_en" value="'+esc(r.value_en||'')+'">')+
        fld(fl('Value (Arabic)','القيمة (عربي)'),'<input id="dgE_ar" value="'+esc(r.value_ar||'')+'" dir="rtl">')+
        fld(fl('Expiry date (leave empty if none)','تاريخ الانتهاء (اتركه فارغاً إن لم يوجد)'),'<input id="dgE_exp" type="date" value="'+esc(r.expires_on||'')+'">')+
        fld(fl('Source — the named document this value comes from','المصدر — المستند المسمى الذي جاءت منه القيمة'),'<input id="dgE_src" value="'+esc(r.source||'')+'">')+
        '</div>'+
        '<div style="margin-top:10px"><button class="btn sm pri" onclick="dgEditSave(\''+esc(r.key)+'\')">'+fl('Save','حفظ')+'</button> '+
        '<button class="btn sm ghost" onclick="dgEditCancel()">'+fl('Cancel','إلغاء')+'</button> '+
        /* Replace proof lives HERE (declutter, 2026-08-26): rows that already carry a
           proof keep View/Download on the row strip and replace it from the edit form.
           Same label + handler as before — only the placement moved. */
        (r.proof_path?proofAttach(r):'')+
        '</div></td></tr>';
    }
    var val=isAr()&&r.value_ar?r.value_ar:(r.value_en||'—');
    var shown=(r.sensitive&&!DG.revealed[r.key])?'•••• '+fl('hidden','مخفي'):esc(val);
    var ex=expiryState(r.expires_on);
    return '<tr><td class="dg-key">'+esc(isAr()&&r.label_ar?r.label_ar:r.label_en)+'</td>'+
      '<td class="dg-val">'+shown+
      (ex?' <span class="dg-pill '+ex.cls+'">'+esc(ex.txt)+(r.expires_on?' · '+esc(r.expires_on):'')+'</span>':'')+
      '<div class="dg-src">'+esc(r.source||'')+'</div></td>'+
      '<td style="white-space:nowrap;text-align:end">'+
      (r.sensitive?'<button class="btn sm ghost dg-mini" onclick="dgReveal(\''+esc(r.key)+'\')">'+(DG.revealed[r.key]?fl('Hide','إخفاء'):fl('Show','عرض'))+'</button> ':'')+
      /* rows WITH a proof no longer show Replace here (it moved into the edit form);
         rows WITHOUT one keep Attach proof visible — there is nothing to view yet */
      proofBtns(r,false)+(r.proof_path?'':proofAttach(r))+
      '<button class="btn sm ghost dg-mini" onclick="dgCopy(\''+esc(r.key)+'\')">'+fl('Copy','نسخ')+'</button>'+
      (canEdit()?' <button class="btn sm ghost dg-mini" onclick="dgEdit(\''+esc(r.key)+'\')">'+fl('Edit','تعديل')+'</button>':'')+
      '</td></tr>';
  }

  function assetsTab(){
    var rows=DG.rows;
    if(rows===null){ loadRegistry(); return '<div class="card">'+fl('Loading the company registry…','جارٍ تحميل سجل الشركة…')+'</div>'; }
    if(!rows.length) return '<div class="card">'+fl('The registry is empty or could not be read.','السجل فارغ أو تعذّرت قراءته.')+'</div>';

    /* renewals radar — every certificate-like row (licence/membership/tax/legal) shows,
       even with no date on file: a neutral "date not on file" pill instead of silence,
       so a missing date is visible, never fabricated. Sort: expired → soonest → no date. */
    var CERT_CATS=['licence','membership','tax','legal'];
    var radar=rows.filter(function(r){return r.expires_on||['licence','membership'].indexOf(r.category)>=0; /* audit: identity rows that never expire (legal name, unified no., VAT) do not belong on a renewals radar */})
      .map(function(r){return {r:r,ex:expiryState(r.expires_on)};})
      .sort(function(a,b){
        var da=a.ex?a.ex.days:Infinity, db=b.ex?b.ex.days:Infinity;
        return da-db;
      });
    var radarHtml='<div class="card dg-radar"><h3 style="margin-top:0;color:var(--accent)">'+fl('Renewals radar','رادار التجديدات')+'</h3>'+
      '<table class="dg">'+radar.map(function(x){
        var pill=x.ex?'<span class="dg-pill '+x.ex.cls+'">'+esc(x.ex.txt)+'</span>'
                     :'<span class="dg-pill nodate">'+fl('date not on file','التاريخ غير مسجل')+'</span>';
        return '<tr><td class="dg-key">'+esc(isAr()&&x.r.label_ar?x.r.label_ar:x.r.label_en)+'</td>'+
          '<td class="dg-date">'+esc(x.r.expires_on||'—')+'</td><td class="dg-date">'+pill+'</td>'+
          '<td style="text-align:end">'+proofBtns(x.r,true)+'</td></tr>';
      }).join('')+'</table>'+
      '<div class="dg-src" style="margin-top:6px">'+fl('Some documents have no expiry date on file','بعض الوثائق لا يتوفر لها تاريخ انتهاء')+'</div></div>';

    var bankHtml='<div class="card"><h3 style="margin-top:0;color:var(--accent)">'+fl('Send bank details','إرسال البيانات البنكية')+'</h3>'+
      '<div style="font-size:13px;color:var(--muted,#777);margin-bottom:8px">'+fl('Copies name, CR, VAT and receiving IBANs. Wallets excluded.','ينسخ الاسم والسجل والرقم الضريبي وآيبانات الاستقبال. المحافظ مستثناة.')+'</div>'+
      '<button class="btn sm pri" onclick="dgCopyBank()">'+fl('Copy bank details block','نسخ البيانات البنكية')+'</button></div>';

    /* brand assets render INLINE — thumbnail chips on the right light/dark ground, each
       with its own Download. Nothing here opens another page or tab. */
    var ASSETS=[
      ['direct_logo_color.png','Color logo (PNG)','الشعار الملون (PNG)','light'],
      ['direct_logo_color.svg','Color logo (SVG)','الشعار الملون (SVG)','light'],
      ['direct_logo_white.png','White logo (PNG)','الشعار الأبيض (PNG)','dark'],
      ['direct_logo_slate.png','Slate logo (PNG)','الشعار الرمادي (PNG)','light'],
      ['direct_qr_directksa.png','QR — directksa.com','رمز QR — directksa.com','light']
    ];
    var brandHtml='<div class="card dg-assets"><h3 style="margin-top:0;color:var(--accent)">'+fl('Brand assets','أصول الهوية')+'</h3>'+
      '<div style="display:flex;gap:12px;flex-wrap:wrap">'+
      ASSETS.map(function(a){
        return '<div class="dg-chip"><div class="th '+a[3]+'"><img src="/brand/'+a[0]+'" alt="'+esc(a[1])+'" loading="lazy"></div>'+
          '<div class="nm">'+esc(fl(a[1],a[2]))+'</div>'+
          '<a class="btn sm ghost dg-mini" href="/brand/'+a[0]+'" download>'+fl('Download','تنزيل')+'</a></div>';
      }).join('')+'</div></div>';

    var cats=CAT_ORDER.filter(function(c){return rows.some(function(r){return r.category===c;});});
    var regHtml=cats.map(function(c){
      var rs=rows.filter(function(r){return r.category===c;});
      var note=CAT_NOTE[c]?'<div class="dg-src" style="margin:-4px 0 8px">'+esc(fl.apply(null,CAT_NOTE[c]))+'</div>':'';
      return '<div class="dg-cat"><h3>'+esc(fl.apply(null,CAT_LABEL[c]||[c,c]))+'</h3>'+note+
        '<div class="card" style="overflow-x:auto"><table class="dg">'+rs.map(rowHtml).join('')+'</table></div></div>';
    }).join('');

    return '<div class="dg-grid">'+radarHtml+bankHtml+brandHtml+'</div>'+regHtml;
  }

  /* ---------- plug-in seam: later layer files own their own tab body ----------
     window.dgRegisterTab('offer', fn) replaces that tab's comingSoon placeholder.
     Tiny and defensive: if the layer file is missing nothing breaks, and a
     throwing renderer falls back to the placeholder instead of killing the page. */
  var EXT={};
  window.dgRegisterTab=function(id,fn){
    try{ if(typeof id==='string'&&typeof fn==='function'){ EXT[id]=fn;
      if(typeof current!=='undefined'&&current==='documents')render(); } }catch(_){}
  };
  function extTab(id){
    if(!EXT[id])return null;
    try{ var h=EXT[id](); return (typeof h==='string')?h:null; }
    catch(e){ console.warn('[dg] ext tab '+id,e); return null; }
  }

  function comingSoon(name){
    return '<div class="card">'+fl('The '+name+' tab is the next build step — it will run on this same engine and registry.','هذا القسم هو خطوة البناء التالية — سيعمل على نفس المحرك والسجل.')+'</div>';
  }

  function renderDocs(view){
    if(!view)return;
    urlSync();
    if(view.querySelector('#dgWrap'))view.innerHTML='';
    var tabs=TABS.map(function(t){
      return '<button class="btn sm '+(DG.tab===t[0]?'pri':'ghost')+'" onclick="dgGo(\''+t[0]+'\')">'+esc(fl(t[1],t[2]))+'</button>';
    }).join('');
    var body= DG.tab==='assets'?assetsTab()
            : DG.tab==='offer'?(extTab('offer')||comingSoon('Price Offer'))
            : DG.tab==='fees'?(extTab('fees')||comingSoon('Service-Fee Proposal'))
            : DG.tab==='contract'?(extTab('contract')||comingSoon('Contract'))
            : DG.tab==='tender'?(extTab('tender')||comingSoon('Tender'))
            : (extTab('profile')||comingSoon('Company Profile'));
    /* Page chrome uses the app's product identity; document previews (later tabs) will
       carry data-identity="classic". */
    view.innerHTML=css()+'<div id="dgWrap" data-identity="product">'+
      '<div class="dg-tabs">'+tabs+'</div>'+body+'</div>';
  }

  /* hook render */
  (function(){
    var _r=window.render;
    if(typeof _r==='function'){
      window.render=function(){
        var out=_r.apply(this,arguments);
        try{ if(typeof current!=='undefined'&&current==='documents'){ var v=document.getElementById('view'); if(v)renderDocs(v); } }
        catch(e){ console.warn('[dg] render',e); }
        return out;
      };
    }
  })();

  console.info('[dg] document generator loaded (Company Assets)');
}catch(e){ if(window.console)console.warn('[dg] init',e); }})();
