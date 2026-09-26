/* js/113-company-card.js — Phase 3 release 4: the company card (2026-09-26).
   One card on a CLIENT's page that gathers the three things a company has with Direct:
     1. its Direct Payments client IDs — 1 to 3 open, each Tender / Prepaid / Postpaid, unique across companies,
        each a link OUT to Direct Payments (D6: this app records which IDs a company has; Direct Payments owns them);
     2. its discount codes — optional, B2C website codes linked to the company; the codes themselves are never written
        here and a link never counts in the company's B2B finance;
     3. its files — CR, VAT certificate, agreement, IBAN letter, business cards — in the private store: added, removed,
        never replaced or moved; IBAN letters and agreements open for managers and admins only (the money rule of
        2026-09-25), which the database enforces — this screen only says so.
   Everyone with Full control of Clients may change it (D7); View only looks. Every change is in record_history.
   Database: scripts/sql/phase3-r4-company-card.sql. Guards: scripts/qa/phase3 R4-01..08 and probe-company-card.       */
(function(){try{
  if(typeof window.renderLeadDetail!=='function') return;
  var fl=function(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; };
  var e=function(s){ return (typeof esc==='function')?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var client=function(){ try{ return window.fc?fc():null; }catch(_){ return null; } };
  var canWrite=function(){ try{ return typeof window.mayEditPage==='function' && window.mayEditPage('clients')===true; }catch(_){ return false; } };
  var TYPES={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};
  var DOCS=[['cr','Commercial registration (CR)','السجل التجاري'],['vat','VAT certificate','شهادة ضريبة القيمة المضافة'],
            ['agreement','Agreement','الاتفاقية'],['iban','IBAN letter','خطاب الآيبان'],['business_card','Business cards','بطاقات العمل'],['other','Other','أخرى']];
  var MONEY={iban:1,agreement:1}, NEEDED=['cr','vat','agreement'];
  var docName=function(t){ var d=DOCS.find(function(x){return x[0]===t;}); return d?fl(d[1],d[2]):t; };
  /* the database's refusals, in words a person reads */
  function said(err){
    var m=String((err&&err.message)||err||'');
    if(/at most 3 open/i.test(m)) return fl('This company already has 3 open client IDs — close one in Direct Payments first.','لدى هذه الشركة 3 معرّفات عملاء مفتوحة — أغلق واحدًا في دايركت للمدفوعات أولًا.');
    if(/client_profiles_direct_client_id_key|duplicate key.*direct_client_id/i.test(m)) return fl('That client ID already belongs to a company — each ID belongs to one company only.','معرّف العميل هذا مسجّل لشركة أخرى — كل معرّف لشركة واحدة فقط.');
    if(/one_company|duplicate key.*company_discount_codes/i.test(m)) return fl('That code is already linked to another company.','هذا الرمز مرتبط بشركة أخرى.');
    if(/stays removed/i.test(m)) return fl('It was removed, and a removal is final — add it again if it is needed.','تمت إزالته، والإزالة نهائية — أضفه من جديد إذا لزم.');
    if(/never re-pointed/i.test(m)) return fl('A file or link is never moved — remove it and add the right one.','الملف أو الرابط لا يُنقل — أزله وأضف الصحيح.');
    if(/row-level security|permission|42501/i.test(m)) return fl('You may not change this — it needs Full control of the Clients page.','لا يمكنك تغيير هذا — يلزم تحكم كامل في صفحة العملاء.');
    return fl('Could not save: ','تعذر الحفظ: ')+m;
  }
  window.__v113Said=said;

  var S={}, CODES=null;   // S[bizUuid] = {links, docs, presence, loading, error}
  function load(biz, done){
    var c=client(); if(!c){ S[biz]={error:'offline',loaded:true}; done(); return; }
    var st=S[biz]=S[biz]||{}; (st.waiters=st.waiters||[]).push(done); if(st.loading) return; st.loading=true;
    /* the page redraws itself while this is in flight (other layers finish loading) — every card waiting when the
       answer arrives is drawn, not only the one that asked */
    var finish=function(){ var w=st.waiters||[]; st.waiters=[]; w.forEach(function(f){ try{ f(); }catch(_){} }); };
    var jobs=[
      c.from('company_discount_codes').select('id,promo_code_id,note,linked_at,removed_at').eq('business_id',biz).is('removed_at',null),
      c.from('company_documents').select('id,doc_type,title,valid_to,file_name,storage_path,created_at,deleted_at').eq('business_id',biz).is('deleted_at',null),
      c.rpc('company_documents_presence',{p_business:biz}),
      CODES?Promise.resolve({data:CODES}):c.from('promo_codes').select('id,code,kind,value_pct,valid_from,valid_to,active,expired,partner_business_id').order('code',{ascending:true})
    ];
    Promise.all(jobs).then(function(r){
      st.loading=false;
      var bad=r.slice(0,4).filter(function(x){return x&&x.error;});
      st.error=bad.length?String(bad[0].error.message||bad[0].error):null;
      st.links=(r[0]&&r[0].data)||[]; st.docs=(r[1]&&r[1].data)||[]; st.presence=(r[2]&&r[2].data)||{};
      if(r[3]&&r[3].data) CODES=r[3].data;
      st.loaded=true; finish();
    },function(err){ st.loading=false; st.error=String(err&&err.message||err); st.loaded=true; finish(); });
  }
  function reload(biz){ if(S[biz]){ S[biz].loaded=false; S[biz].loading=false; } CODES=null; var el=document.querySelector('.v113-card'); if(el) draw(el); }
  window.__v113Reload=reload;

  function fmtCode(p){ var v=p.kind==='fixed'?(p.value_pct+' '+fl('SAR','ر.س')):(p.value_pct+'%'); var st=codeStatus(p);
    return '<b>'+e(p.code)+'</b> · '+e(v)+(p.valid_to?' · '+fl('until ','حتى ')+e(p.valid_to):'')+' <span class="tag" style="font-size:11px;'+(st[1])+'">'+st[0]+'</span>'; }
  function codeStatus(p){ var t=(new Date()).toISOString().slice(0,10);
    if(p.active===false) return [fl('off','متوقف'),'background:#F2F0EE;color:#827164'];
    if(p.expired||(p.valid_to&&p.valid_to<t)) return [fl('expired','منتهي'),'background:#FDECEC;color:#B42318'];
    if(p.valid_from&&p.valid_from>t) return [fl('upcoming','قادم'),'background:#EEF4FF;color:#2E5AAC'];
    return [fl('active','فعّال'),'background:#E7F8EF;color:#0F6E56']; }

  function draw(el){
    var id=el.getAttribute('data-id'); var biz=el.getAttribute('data-biz'); var st=S[biz];
    if(!st||!st.loaded){ el.querySelector('.v113-body').innerHTML='<div class="muted" style="font-size:12.5px">'+fl('Loading the company card…','جارٍ تحميل بطاقة الشركة…')+'</div>';
      load(biz,function(){ var now=document.querySelector('.v113-card[data-biz="'+biz+'"]'); if(now) draw(now); }); return; }
    var w=canWrite(), h='';
    if(st.error) h+='<div style="color:#B42318;font-size:12.5px;margin-bottom:8px">'+fl('Part of the card could not be read — what shows below may be incomplete.','تعذرت قراءة جزء من البطاقة — قد يكون المعروض ناقصًا.')+'</div>';
    /* 1 · client IDs — js/27 loads them (CP); its loader drops a second caller while it is busy, so this never waits
       on it: while they are not in yet the section says so, and js/27 redraws the page when they arrive */
    if(!window.CP||window.CP.rows==null){ if(window.CP&&typeof window.cpLoad==='function') window.cpLoad(function(){ var now=document.querySelector('.v113-card[data-biz="'+biz+'"]'); if(now) draw(now); }); }
    var ids=((window.CP&&window.CP.byBiz&&window.CP.byBiz[biz])||[]).slice().sort(function(a,b){ return (a.closed_at?1:0)-(b.closed_at?1:0); });
    var open=ids.filter(function(x){return !x.closed_at;});
    h+='<div class="v113-sec" data-sec="ids"><div class="v113-h">'+fl('Direct Payments client IDs','معرّفات العميل في دايركت للمدفوعات')+' <span class="muted">· '+open.length+' '+fl('of 3 open','من 3 مفتوحة')+'</span></div>';
    h+=ids.length?ids.map(function(p){ var tl=TYPES[p.profile_type]||[p.profile_type,p.profile_type];
      var link=(typeof window.pdClientLink==='function')?window.pdClientLink(p.direct_client_id):'#';
      return '<div class="v113-row'+(p.closed_at?' closed':'')+'"><span class="tag" style="font-weight:700">'+e(fl(tl[0],tl[1]))+'</span> <b>#'+e(p.direct_client_id)+'</b>'+
        (p.closed_at?' <span class="muted">'+fl('closed','مغلق')+'</span>':'')+'<span style="flex:1"></span><a class="chiplink" href="'+e(link)+'" target="_blank" rel="noopener">'+fl('Open in Direct Payments ↗','افتح في دايركت للمدفوعات ↗')+'</a></div>'; }).join('')
      :'<div class="muted v113-empty">'+fl('No client ID yet.','لا يوجد معرّف عميل بعد.')+'</div>';
    if(w) h+=open.length>=3?'<div class="muted" style="font-size:12px;margin-top:4px">'+fl('3 open client IDs — the most a company holds. Close one in Direct Payments to add another.','3 معرّفات مفتوحة — الحد الأقصى للشركة. أغلق واحدًا في دايركت للمدفوعات لإضافة غيره.')+'</div>'
               :'<button class="btn ghost sm v113-add-id" onclick="v34AddProfile(\''+e(id)+'\')">'+fl('+ Add client ID','+ إضافة معرّف عميل')+'</button>';
    h+='</div>';
    /* 2 · discount codes */
    var byId={}; (CODES||[]).forEach(function(p){ byId[p.id]=p; });
    var linked=st.links.map(function(l){ return {l:l,p:byId[l.promo_code_id]}; }).filter(function(x){return x.p;});
    var imported=(CODES||[]).filter(function(p){ return p.partner_business_id===biz && !linked.some(function(x){return x.p.id===p.id;}); });
    h+='<div class="v113-sec" data-sec="codes"><div class="v113-h">'+fl('Discount codes','رموز الخصم')+' <span class="muted">· '+fl('B2C website codes — not part of this company\'s B2B finance','رموز الموقع للأفراد — ليست من مالية الشركة (B2B)')+'</span></div>';
    h+=(linked.length||imported.length)?linked.map(function(x){ return '<div class="v113-row">'+fmtCode(x.p)+(x.l.note?' <span class="muted">— '+e(x.l.note)+'</span>':'')+'<span style="flex:1"></span>'+
          (w?'<button class="btn ghost sm v113-unlink" onclick="v113Unlink(\''+e(x.l.id)+'\',\''+e(biz)+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</div>'; }).join('')+
        imported.map(function(p){ return '<div class="v113-row">'+fmtCode(p)+' <span class="muted">— '+fl('linked in Direct Payments','مرتبط في دايركت للمدفوعات')+'</span></div>'; }).join('')
      :'<div class="muted v113-empty">'+fl('No discount code — optional.','لا يوجد رمز خصم — اختياري.')+'</div>';
    if(w) h+='<button class="btn ghost sm v113-link" onclick="v113LinkCode(\''+e(biz)+'\')">'+fl('+ Link a code','+ ربط رمز')+'</button>';
    h+='</div>';
    /* 3 · files */
    var pres=st.presence||{};
    h+='<div class="v113-sec" data-sec="files"><div class="v113-h">'+fl('Company files','ملفات الشركة')+'</div>';
    DOCS.forEach(function(d){
      var mine=st.docs.filter(function(x){return x.doc_type===d[0];}); var n=Number(pres[d[0]]||0);
      if(!mine.length&&!n&&NEEDED.indexOf(d[0])<0) return;
      h+='<div class="v113-row v113-doc" data-type="'+d[0]+'"><span class="v113-dt">'+e(fl(d[1],d[2]))+'</span>';
      if(mine.length) h+=mine.map(function(x){ var exp=x.valid_to&&x.valid_to<(new Date()).toISOString().slice(0,10);
          return '<span class="v113-file"><a href="#" onclick="v113Open(\''+e(x.id)+'\',\''+e(biz)+'\');return false">'+e(x.title||x.file_name)+'</a>'+
            (x.valid_to?' <span class="muted"'+(exp?' style="color:#B42318"':'')+'>'+(exp?fl('expired ','انتهى '):fl('valid to ','ساري حتى '))+e(x.valid_to)+'</span>':'')+
            (w?' <button class="btn ghost sm v113-remove" onclick="v113Remove(\''+e(x.id)+'\',\''+e(biz)+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</span>'; }).join(' ');
      else if(n) h+='<span class="muted v113-locked">🔒 '+fl('On file','محفوظ')+' ('+n+') — '+fl('managers and admins only','للمديرين والمسؤولين فقط')+'</span>';
      else h+='<span class="v113-missing">'+fl('Missing','غير موجود')+'</span>';
      h+='</div>'; });
    if(w) h+='<button class="btn ghost sm v113-upload" onclick="v113Upload(\''+e(biz)+'\')">'+fl('+ Add a file','+ إضافة ملف')+'</button>'+
             '<div class="muted" style="font-size:11.5px;margin-top:4px">'+fl('Files are added and removed, never replaced. IBAN letters and agreements open for managers and admins only.','الملفات تُضاف وتُزال ولا تُستبدل. خطاب الآيبان والاتفاقية يفتحهما المديرون والمسؤولون فقط.')+'</div>';
    h+='</div>';
    el.querySelector('.v113-body').innerHTML=h;
  }

  var CSS='.v113-card{padding:14px 16px;margin-bottom:12px}.v113-card .v113-title{font-weight:800;font-size:15px;margin-bottom:8px}'+
    '.v113-sec{border-top:1px solid var(--line,#EDE2DA);padding:9px 0 6px}.v113-sec:first-child{border-top:0}.v113-h{font-weight:700;font-size:13px;margin-bottom:6px}'+
    '.v113-h .muted{font-weight:400;font-size:12px}.v113-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0;font-size:13px}.v113-row.closed{opacity:.6}'+
    '.v113-dt{min-width:190px;color:var(--muted,#827164)}.v113-missing{color:#B54708;font-weight:600;font-size:12.5px}.v113-file{display:inline-flex;gap:6px;align-items:center}'+
    '.v113-empty{font-size:12.5px;padding:2px 0 4px}';
  function inject(id){try{
      if(typeof current!=='undefined'&&current!=='leads'&&current!=='clients')return;
      id=id||(typeof openLead!=='undefined'?openLead:null); if(!id)return;
      var b=(typeof getLead==='function')?getLead(id):null; if(!b||!b.isClient)return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v113-card'))return;
      var grid=view.querySelector('.detail-grid'); if(!grid||!grid.parentNode)return;
      if(!document.getElementById('v113css')){ var s=document.createElement('style'); s.id='v113css'; s.textContent=CSS; document.head.appendChild(s); }
      var biz=(window.__bizUuid?window.__bizUuid(id):id);
      var el=document.createElement('div'); el.className='v113-card card'; el.setAttribute('data-id',id); el.setAttribute('data-biz',biz);
      el.innerHTML='<div class="v113-title">'+fl('Company card','بطاقة الشركة')+'</div><div class="v113-body"></div>';
      var after=view.querySelector('.v34-link'); if(after&&after.parentNode===grid.parentNode) after.parentNode.insertBefore(el,after.nextSibling); else grid.parentNode.insertBefore(el,grid);
      draw(el);
    }catch(err){ if(window.console)console.warn('[v113] card',err); }}
  /* after the detail page is drawn — and after ANY redraw of the page: some layers rebuild the view without going
     through renderLeadDetail, which took the card away until the next full render (the v44b pattern) */
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){ _rld.apply(this,arguments); setTimeout(function(){ inject(id); },90); };
  if(typeof window.render==='function'){ var _r=window.render; window.render=function(){ var out=_r.apply(this,arguments); setTimeout(function(){ inject(null); },120); return out; }; }

  /* ---------- the changes (each asks the database; the database decides) ---------- */
  window.v113LinkCode=function(biz){try{
    if(!canWrite()) return;
    var taken={}; Object.keys(S).forEach(function(k){ ((S[k]||{}).links||[]).forEach(function(l){ taken[l.promo_code_id]=1; }); });
    var opts=(CODES||[]).filter(function(p){ return !taken[p.id] && !p.partner_business_id; }).map(function(p){
      var v=p.kind==='fixed'?(p.value_pct+' SAR'):(p.value_pct+'%'); return '<option value="'+e(p.id)+'">'+e(p.code)+' · '+e(v)+(p.valid_to?' · '+e(p.valid_to):'')+'</option>'; }).join('');
    openModal(fl('Link a discount code','ربط رمز خصم'),
      '<div class="ch-sub">'+fl('Codes come from Direct\'s website (Direct Payments) — this only records which company a code is for. It does not change the code, and it is not B2B finance.','الرموز من موقع دايركت (دايركت للمدفوعات) — هنا نسجّل فقط لأي شركة الرمز. لا يغيّر الرمز، وليس من مالية الشركات.')+'</div>'+
      '<div class="field"><label>'+fl('Code','الرمز')+'</label><select id="v113_code">'+(opts||'<option value="">'+fl('— no free code —','— لا يوجد رمز متاح —')+'</option>')+'</select></div>'+
      '<div class="field"><label>'+fl('What it is for (optional)','الغرض (اختياري)')+'</label><input id="v113_note" placeholder="'+fl('e.g. staff leisure travel','مثال: سفر الموظفين الشخصي')+'"></div>',
      function(){
        var pc=(document.getElementById('v113_code')||{}).value; if(!pc){ alert(fl('Pick a code.','اختر رمزًا.')); return false; }
        var note=((document.getElementById('v113_note')||{}).value||'').trim()||null;
        client().from('company_discount_codes').insert({business_id:biz,promo_code_id:pc,note:note}).select('id').then(function(r){
          if(r.error||!r.data||!r.data.length){ alert(said(r.error||'refused')); return; }
          try{ closeModal(); }catch(_){} reload(biz); });
        return false;
      });
  }catch(err){ if(window.console)console.warn('[v113] link',err); }};

  window.v113Unlink=function(linkId,biz){try{
    if(!canWrite()) return;
    var go=function(){ client().from('company_discount_codes').update({removed_at:new Date().toISOString()}).eq('id',linkId).select('id').then(function(r){
      if(r.error||!r.data||!r.data.length){ alert(said(r.error||'refused')); return; } reload(biz); }); };
    if(typeof askInPage==='function') askInPage(fl('Remove this code from the company? The code itself stays as it is in Direct Payments.','إزالة هذا الرمز من الشركة؟ يبقى الرمز كما هو في دايركت للمدفوعات.'),go); else if(confirm('Remove?')) go();
  }catch(err){ if(window.console)console.warn('[v113] unlink',err); }};

  var MAX=10*1024*1024;
  window.v113Upload=function(biz){try{
    if(!canWrite()) return;
    openModal(fl('Add a company file','إضافة ملف للشركة'),
      '<div class="field"><label>'+fl('Kind of file','نوع الملف')+'</label><select id="v113_type">'+DOCS.map(function(d){ return '<option value="'+d[0]+'">'+e(fl(d[1],d[2]))+(MONEY[d[0]]?' 🔒':'')+'</option>'; }).join('')+'</select></div>'+
      '<div class="field"><label>'+fl('File (PDF or image, up to 10 MB)','الملف (PDF أو صورة، حتى 10 ميغابايت)')+'</label><input id="v113_file" type="file" accept=".pdf,image/*"></div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Name on the card (optional)','الاسم في البطاقة (اختياري)')+'</label><input id="v113_title"></div>'+
      '<div class="field"><label>'+fl('Valid until (optional)','ساري حتى (اختياري)')+'</label><input id="v113_valid" type="date"></div></div>'+
      '<div class="ch-sub">'+fl('🔒 IBAN letters and agreements open for managers and admins only — you can add one, and it will then show as "on file".','🔒 خطاب الآيبان والاتفاقية يفتحهما المديرون والمسؤولون فقط — يمكنك إضافة أحدهما، وسيظهر بعدها "محفوظ".')+'</div>',
      function(){
        var f=(document.getElementById('v113_file')||{}).files; f=f&&f[0];
        if(!f){ alert(fl('Choose a file.','اختر ملفًا.')); return false; }
        if(f.size>MAX){ alert(fl('That file is over 10 MB.','حجم الملف أكبر من 10 ميغابايت.')); return false; }
        var type=document.getElementById('v113_type').value, id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('x'+Date.now());
        var safe=String(f.name||'file').replace(/[^A-Za-z0-9._-]+/g,'_').slice(-80)||'file';
        var path='clients/'+biz+'/'+id+'/'+safe, c=client();
        var row={id:id,business_id:biz,doc_type:type,storage_path:path,file_name:f.name,mime_type:f.type||null,size_bytes:f.size,
                 title:((document.getElementById('v113_title')||{}).value||'').trim()||null,valid_to:(document.getElementById('v113_valid')||{}).value||null};
        /* the row first — it names the file's path, so the store can check who may read it — then the file, once.
           Inserted without asking the row back: a team member may add an IBAN letter they are not allowed to open. */
        c.from('company_documents').insert(row).then(function(r){
          if(r.error){ alert(said(r.error)); return; }
          c.storage.from('company-docs').upload(path,f,{upsert:false,contentType:f.type||undefined}).then(function(u){
            if(u.error){ c.from('company_documents').update({deleted_at:new Date().toISOString()}).eq('id',id).then(function(){});
              alert(fl('The file did not reach the store, so nothing was added: ','لم يصل الملف إلى المخزن، فلم يُضف شيء: ')+(u.error.message||u.error)); reload(biz); return; }
            try{ closeModal(); }catch(_){} reload(biz); });
        });
        return false;
      });
  }catch(err){ if(window.console)console.warn('[v113] upload',err); }};

  window.v113Open=function(docId,biz){try{
    var d=((S[biz]||{}).docs||[]).find(function(x){return x.id===docId;}); if(!d) return;
    var w=null; try{ w=window.open('','_blank'); }catch(_){}   /* opened inside the click, then pointed at the signed link */
    client().storage.from('company-docs').createSignedUrl(d.storage_path,120).then(function(r){
      var url=r&&r.data&&(r.data.signedUrl||r.data.signedURL);
      if(!url){ try{ if(w) w.close(); }catch(_){} alert(fl('Could not open that file.','تعذر فتح الملف.')); return; }
      if(w){ try{ w.location=url; return; }catch(_){} } window.open(url,'_blank'); });
  }catch(err){ if(window.console)console.warn('[v113] open',err); }};

  window.v113Remove=function(docId,biz){try{
    if(!canWrite()) return;
    var go=function(){ client().from('company_documents').update({deleted_at:new Date().toISOString()}).eq('id',docId).select('id').then(function(r){
      if(r.error||!r.data||!r.data.length){ alert(said(r.error||'refused')); return; } reload(biz); }); };
    if(typeof askInPage==='function') askInPage(fl('Remove this file from the company card? A removal is final — it is kept on record, and a new file can be added.','إزالة هذا الملف من بطاقة الشركة؟ الإزالة نهائية — يُحتفظ به في السجل، ويمكن إضافة ملف جديد.'),go); else if(confirm('Remove?')) go();
  }catch(err){ if(window.console)console.warn('[v113] remove',err); }};

  window.__v113={state:S, codes:function(){return CODES;}};
  console.info('%c[v113] company card loaded','color:#16B364;font-weight:700');
}catch(err){ if(window.console)console.warn('[v113] init',err); }})();
