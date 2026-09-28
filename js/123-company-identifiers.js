/* js/123-company-identifiers.js — company identifiers (second builder, 28 Sep 2026; DECISIONS D27, owner's rulings of 28 Sep).

   Each company holds typed identifiers — Payments client ID, discount code (optional dates), names in English or Arabic,
   contact emails, phones, VAT and CR numbers — each belonging to one company only (public.company_identifiers; the database
   enforces it). Every money row is matched LIVE by the database (money_company_match: client ID → VAT/CR → code → email →
   phone → name), so adding or removing an identifier re-links past rows at once in Finance, reports, the card and the KPIs.

   This layer holds what the screens share: the same comparison as the database (identNorm, for previews and suggestions),
   the list (loaded by js/117 into MR.idents), add / remove / put back (asks by name, D19; logged; a removal is undone by
   putting it back), the "Add an identifier" form, and the card's Identifiers section (js/113 draws it in place of the old
   client-ID and code sections; js/117 uses the same pieces on Finance → Rules). Never an identifier: a Direct staff email,
   the dummy test VAT, a value under an exclusion rule (the database refuses them and the form says why).
   Guards: scripts/qa/probe-company-identifiers.mjs and phase3 IDN-01…11. */
(function(){try{
  var fl=function(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; };
  var e=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var client=function(){ try{ return window.fc?fc():null; }catch(_){ return null; } };
  var canWrite=function(){ try{ if(window.__isShareView)return false; if(!(window.__userRole==='admin'||window.__userRole==='manager'))return false;
    return (typeof window.finCanWrite==='function'&&!!window.finCanWrite())||(typeof window.mayEditPage==='function'&&window.mayEditPage('clients')===true); }catch(_){ return false; } };

  /* ---------- the same comparison as the database (ident_name / ident_phone / ident_digits / money_norm) ---------- */
  var AR_DIG='٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
  function arDig(s){ return String(s).replace(/[٠-٩۰-۹]/g,function(c){ return String(AR_DIG.indexOf(c)%10); }); }
  function digits(t){ var s=arDig(t==null?'':t).replace(/[^0-9]/g,''); return s||null; }
  function phone(t){ var d=(digits(t)||'').replace(/^00/,'').replace(/^966/,'').replace(/^0+/,''); return d.length>=7?d:null; }
  var FORM={'شركه':1,'موسسه':1,'company':1,'co':1,'corp':1,'corporation':1,'ltd':1,'limited':1,'llc':1,'inc':1,'est':1};
  function name(t){ var s=String(t==null?'':t); try{ s=s.normalize('NFKC'); }catch(_){}
    s=arDig(s.toLowerCase().replace(/[أإآٱ]/g,'ا').replace(/[ىئ]/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و'))
      .replace(/[ً-ٰٟـ]/g,'').replace(/[^0-9a-zء-غف-يٮ-ۓۺ-ۿ]+/g,' ');
    var w=s.trim().split(/\s+/).filter(function(x){ return x&&!FORM[x]; }); return w.join('')||null; }
  function moneyNorm(t){ var s=String(t==null?'':t); try{ s=s.normalize('NFKC'); }catch(_){}
    s=s.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ٰٟـ]/g,'');
    try{ s=s.replace(/[^\p{L}\p{N}]+/gu,''); }catch(_){ s=s.replace(/[^0-9a-z؀-ۿ]+/g,''); } return s||null; }
  function identNorm(kind,v){ if(kind==='name') return name(v); if(kind==='email'){ var x=String(v==null?'':v).trim().toLowerCase(); return x||null; }
    if(kind==='phone') return phone(v); if(kind==='vat'||kind==='cr') return digits(v); return moneyNorm(v); }
  window.identNorm=identNorm;
  var STAFF=/@([a-z0-9-]+\.)*directksa\./i;
  window.identIsStaffEmail=function(v){ return STAFF.test(String(v||'')); };

  var KINDS=[['client_id','Client ID','معرّف العميل'],['vat','VAT no.','الرقم الضريبي'],['cr','CR no.','السجل التجاري'],['discount_code','Discount code','رمز الخصم'],
             ['email','Email','البريد'],['phone','Phone','الهاتف'],['name','Name','الاسم']];
  function kindLabel(k){ for(var i=0;i<KINDS.length;i++) if(KINDS[i][0]===k) return fl(KINDS[i][1],KINDS[i][2]); return k; }
  window.identKindLabel=kindLabel;
  function live(){ return ((window.MR&&window.MR.idents)||[]).filter(function(x){ return !x.removed_at; }); }
  window.identOwner=function(kind,v){ var n=identNorm(kind,v); if(!n) return null;
    return live().filter(function(x){ return x.kind===kind&&(x.value_norm||identNorm(x.kind,x.value))===n; })[0]||null; };
  function bizName(u){ var b=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(x){ return (window.__bizUuid?window.__bizUuid(x.id):x.id)===u; })[0]; return (b&&b.name)||fl('another company','شركة أخرى'); }
  function refreshed(){ try{ if(typeof window.v117RefreshAll==='function') window.v117RefreshAll(); }catch(_){} }
  function refused(r){ if(r&&r.error){ var m=String(r.error.message||r.error);
      if(/one_company|duplicate key/i.test(m)) return fl('That identifier already belongs to another company — one identifier, one company.','هذا المعرّف مسجّل لشركة أخرى — معرّف واحد لشركة واحدة.');
      if(/not_staff/.test(m)) return fl('A Direct staff email is never a company identifier.','بريد موظفي دايركت لا يكون معرّفًا لشركة.');
      if(/dummy_vat/.test(m)) return fl('That is the Payments test VAT number — never an identifier.','هذا رقم ضريبي تجريبي من المدفوعات — لا يكون معرّفًا.');
      if(/exclusion rule/i.test(m)) return fl('That value is under an exclusion rule on Finance → Rules (a test client or a left-out company) — never an identifier.','هذه القيمة تحت قاعدة استبعاد في المالية ← القواعد — لا تكون معرّفًا.');
      if(/row-level security|42501/.test(m)) return fl('Only an admin or a manager with edit rights on Finance or Clients changes identifiers.','يغيّر المعرّفات المسؤول أو المدير ممن له صلاحية التعديل على المالية أو العملاء.');
      if(/readable|email_shape/.test(m)) return fl('That does not read as a ','هذه القيمة لا تُقرأ كـ')+fl('value of this type.','قيمة من هذا النوع.');
      return m; }
    if(r&&Array.isArray(r.data)&&!r.data.length) return fl('The change did not land (no rights, or it was already changed).','لم يُحفظ التغيير (لا صلاحية، أو تغيّر من قبل).');
    return null; }

  /* ---------- add / remove / put back ---------- */
  window.identAdd=function(biz,kind,value,opts,done){ opts=opts||{};
    if(!canWrite()){ alert(fl('Only an admin or a manager with edit rights on Finance or Clients changes identifiers.','يغيّر المعرّفات المسؤول أو المدير ممن له صلاحية التعديل على المالية أو العملاء.')); return; }
    if(!biz){ alert(fl('Choose the company.','اختر الشركة.')); return; }
    if(!identNorm(kind,value)){ alert(fl('Type the ','اكتب ')+kindLabel(kind)+'.'); return; }
    if(kind==='email'&&window.identIsStaffEmail(value)){ alert(fl('A Direct staff email is never a company identifier.','بريد موظفي دايركت لا يكون معرّفًا لشركة.')); return; }
    var o=window.identOwner(kind,value); if(o){ alert(o.business_id===biz?fl('This company already has it.','هذه الشركة لديها هذا المعرّف.'):kindLabel(kind)+' «'+value+'» '+fl('already belongs to ','مسجّل بالفعل لـ ')+bizName(o.business_id)+'.'); return; }
    var row={business_id:biz,kind:kind,value:String(value).trim(),source:opts.source||'person'};
    if(kind==='discount_code'){ if(opts.valid_from) row.valid_from=opts.valid_from; if(opts.valid_to) row.valid_to=opts.valid_to; }
    if(opts.note) row.note=opts.note;
    client().from('company_identifiers').insert(row).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } if(done) done(); refreshed(); });
  };
  function ask(msg,yes){ if(typeof window.askInPage==='function') window.askInPage(msg,yes); }
  window.identRemove=function(id){ if(!canWrite()) return;
    var x=((window.MR&&MR.idents)||[]).filter(function(r){ return r.id===id; })[0]; if(!x) return;
    ask(fl('Remove the ','إزالة ')+kindLabel(x.kind)+' «'+x.value+'» '+fl('from ','من ')+bizName(x.business_id)+fl('? Its rows are matched again without it at once (it can be put back).','؟ تُطابَق صفوفه من جديد بدونه فورًا (يمكن إعادته).'),
      function(){ client().from('company_identifiers').update({removed_at:new Date().toISOString()}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshed(); }); }); };
  window.identPutBack=function(id){ if(!canWrite()) return;
    var x=((window.MR&&MR.idents)||[]).filter(function(r){ return r.id===id; })[0]; if(!x) return;
    var o=window.identOwner(x.kind,x.value); if(o){ alert(kindLabel(x.kind)+' «'+x.value+'» '+fl('now belongs to ','صار الآن لـ ')+bizName(o.business_id)+fl(' — it cannot come back here.',' — لا يمكن إعادته هنا.')); return; }
    client().from('company_identifiers').update({removed_at:null}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshed(); }); };

  /* ---------- the form ---------- */
  function companyOptions(sel){ var list=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){ return !b.archived&&!b.archivedAt; }).slice().sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
    return '<option value="">'+fl('— choose the company —','— اختر الشركة —')+'</option>'+list.map(function(b){ var u=(window.__bizUuid?window.__bizUuid(b.id):b.id);
      return '<option value="'+e(u)+'"'+(u===sel?' selected':'')+'>'+e(b.name||'(unnamed)')+'</option>'; }).join(''); }
  window.v123AddIdentifier=function(biz,kind,value){ if(!canWrite()) return;
    if(typeof window.openModal!=='function'){ alert(fl('The form is not available here.','النموذج غير متاح هنا.')); return; }
    openModal(fl('Add an identifier','إضافة معرّف'),
      '<div class="ch-sub">'+fl('Every money row carrying it is matched to this company at once, past rows too. One identifier belongs to one company.','كل صف مالي يحمله يُطابَق مع هذه الشركة فورًا، والصفوف السابقة أيضًا. المعرّف الواحد لشركة واحدة.')+'</div>'+
      (biz?'<input type="hidden" id="v123_biz" value="'+e(biz)+'">':'<div class="field"><label>'+fl('Company','الشركة')+'</label><select id="v123_biz">'+companyOptions('')+'</select></div>')+
      '<div class="grid2"><div class="field"><label>'+fl('Type','النوع')+'</label><select id="v123_kind" onchange="v123KindChanged()">'+KINDS.map(function(k){ return '<option value="'+k[0]+'"'+(k[0]===(kind||'name')?' selected':'')+'>'+e(fl(k[1],k[2]))+'</option>'; }).join('')+'</select></div>'+
      '<div class="field"><label>'+fl('Value','القيمة')+'</label><input id="v123_value" value="'+e(value||'')+'"></div></div>'+
      '<div class="grid2" id="v123_dates" style="display:'+((kind||'name')==='discount_code'?'':'none')+'"><div class="field"><label>'+fl('Counts from (optional)','يُحتسب من (اختياري)')+'</label><input type="date" id="v123_from"></div>'+
      '<div class="field"><label>'+fl('Counts to (optional)','يُحتسب حتى (اختياري)')+'</label><input type="date" id="v123_to"></div></div>',
      function(){ var b=(document.getElementById('v123_biz')||{}).value, k=(document.getElementById('v123_kind')||{}).value, v=(document.getElementById('v123_value')||{}).value;
        window.identAdd(b,k,v,{valid_from:(document.getElementById('v123_from')||{}).value||null,valid_to:(document.getElementById('v123_to')||{}).value||null},function(){ try{ closeModal(); }catch(_){} });
        return false; });
  };
  window.v123KindChanged=function(){ var k=(document.getElementById('v123_kind')||{}).value, d=document.getElementById('v123_dates'); if(d) d.style.display=k==='discount_code'?'':'none'; };

  /* ---------- the card's Identifiers section (js/113 puts it where the client IDs and codes were) ---------- */
  var TYPES={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل'],tender:['Tender','مناقصة']};
  window.v123CardSection=function(biz){
    var w=canWrite(), all=((window.MR&&MR.idents)||[]).filter(function(x){ return x.business_id===biz; });
    var on=all.filter(function(x){ return !x.removed_at; }), off=all.filter(function(x){ return x.removed_at; }).slice(-5);
    var prof={}; (((window.CP&&CP.byBiz&&CP.byBiz[biz])||[])).forEach(function(p){ prof[identNorm('client_id',p.direct_client_id)]=p; });
    var h='<div class="v113-h">'+fl('Identifiers','المعرّفات')+' <span class="muted">· '+on.length+' — '+fl('every money row carrying one of these counts under this company, past rows too','كل صف مالي يحمل أحدها يُحتسب لهذه الشركة، والصفوف السابقة أيضًا')+'</span></div>';
    if(window.MR&&MR.idents==null) h+='<div class="muted v113-empty">'+fl('Loading…','جارٍ التحميل…')+'</div>';
    else if(!on.length) h+='<div class="muted v113-empty" data-v123-empty="1">'+fl('No identifier yet — add the client ID, VAT or CR number, the names and spellings, emails and phones this company uses.','لا معرّف بعد — أضف معرّف العميل، الرقم الضريبي أو السجل، الأسماء والتهجئات، البريد والهاتف.')+'</div>';
    KINDS.forEach(function(k){ var of=on.filter(function(x){ return x.kind===k[0]; }); if(!of.length) return;
      h+='<div class="v113-row" data-v123-kind="'+k[0]+'"><span class="tag" style="font-weight:700">'+e(fl(k[1],k[2]))+'</span> '+of.map(function(x){
        var p=x.kind==='client_id'?prof[x.value_norm||identNorm('client_id',x.value)]:null, tl=p&&TYPES[p.profile_type];
        return '<span class="v123-ident" data-v123-ident-id="'+e(x.id)+'" style="display:inline-flex;gap:4px;align-items:center;margin-inline-end:10px"><b>'+e(x.value)+'</b>'+
          (tl?' <span class="muted">'+e(fl(tl[0],tl[1]))+(p.closed_at?' · '+fl('closed','مغلق'):'')+'</span>':'')+
          (x.valid_from||x.valid_to?' <span class="muted">'+e((x.valid_from||'…')+' → '+(x.valid_to||'…'))+'</span>':'')+
          (w?' <button class="btn ghost sm" style="padding:0 6px" data-v123-remove="'+e(x.id)+'" onclick="identRemove(\''+e(x.id)+'\')" aria-label="'+e(fl('Remove','إزالة')+' '+x.value)+'">×</button>':'')+'</span>'; }).join('')+'</div>'; });
    if(off.length) h+='<div class="muted" style="font-size:11.5px;margin-top:4px" data-v123-removed="'+off.length+'">'+fl('Removed: ','أُزيل: ')+off.map(function(x){
        return e(kindLabel(x.kind))+' «'+e(x.value)+'»'+(w?' <a href="#" data-v123-putback="'+e(x.id)+'" onclick="identPutBack(\''+e(x.id)+'\');return false">'+fl('put back','إعادة')+'</a>':''); }).join(' · ')+'</div>';
    if(w) h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn ghost sm v123-add" onclick="v123AddIdentifier(\''+e(biz)+'\')">'+fl('+ Add an identifier','+ إضافة معرّف')+'</button>'+
      (typeof window.v117AddClientId==='function'?'<button class="btn ghost sm v113-add-id" onclick="v117AddClientId(\''+e(biz)+'\')">'+fl('+ Client ID with its billing type','+ معرّف عميل مع نوع الفوترة')+'</button>':'')+
      ((window.__userRole==='admin'||window.__userRole==='manager')&&typeof window.openChangeLog==='function'?'<button class="btn ghost sm" onclick="v123Log(\''+e(biz)+'\')">'+fl('Change log','سجل التغييرات')+'</button>':'')+'</div>';
    return h; };
  window.v123Log=function(biz){ try{ window.openChangeLog(((window.MR&&MR.idents)||[]).filter(function(x){ return x.business_id===biz; }).map(function(x){ return {table:'company_identifiers',key:x.id}; }),fl('Identifiers — change log','المعرّفات — سجل التغييرات')); }catch(_){} };

  window.v123={ identNorm:identNorm, name:name, phone:phone, digits:digits, kinds:KINDS };
  console.info('%c[v123] company identifiers','color:#175CD3;font-weight:700');
}catch(err){ if(window.console) console.warn('[v123] init',err); }})();
