/* ===== js/117 — Finance → Rules: the exclusion rules and the company merges (E, owner-approved spec of 2026-09-27;
   DECISIONS D16) =====

   One screen, two cards, maintained by a person:
     EXCLUSION RULES — leave out ONLY what is typed; everything else counts. A rule is a type + a value + a reason, with
       who and when (stamped by the database) and an on/off switch. Types: a Direct Payments client ID; a client name or
       alias (only for rows that carry no client ID); a VAT or CR number (the same legal entity under any ID or name); a
       discount code; one transaction number.
     COMPANY MERGES — merge ONLY what is typed. A company holds a typed list of client IDs (prepaid / postpaid / tender, any
       number of tenders) and a typed list of discount codes; one ID or code belongs to one company only. Anything not
       typed stands alone: a client ID nobody typed is its own entry, named as Payments names it, flagged "Not merged —
       review"; a code nobody typed stays under "Unassigned codes" and still counts.
   Exclusion beats merge. The database view money_rows applies both on every read, so a change here moves every total at
   once — Finance (js/16 live()), its Report Builder and exports, and the KPIs (finance_lines) — with no re-import.
   Anyone with Full control on Finance changes things (D22, 28 Sep — the page level, not the role); everyone with Finance sees. Every add, switch and
   removal is in the change log (record_history), shown here through js/115.
   Nothing in this file creates a record on its own — every write is a button a person pressed (the owner's rule of 27 Sep).

   Also here, because they read the same rules:
     · window.moneyRuleFor(keys) — the same matching as the database, for an import preview;
     · window.finExclusionCheck(name) — now the NAME rules (js/62's name list is retired);
     · "Who to chase" on Clients & collections: outstanding per company in 0-30 / 31-60 / 61-90 / 90+ days, postpaid first
       — outstanding is never added to revenue;
     · finLinkMap (the old link-by-name window) now opens this screen. */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function e(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function sar(n){ n=Number(n)||0; return Math.round(n).toLocaleString('en-US')+' '+fl('SAR','ر.س'); }
  /* (before D22: admin or manager AND) allowed to change Finance (finCanWrite: the page level, share views refused) — the database says the same */
  /* merges (client IDs, codes, customer names) may also be changed from the company card: (before D22: admin or manager AND) allowed to
     change Finance OR Clients — the same rule as the database policies */
  /* 2026-09-28 (D22): follows the page level set in Team & Access, not the role — Full on Finance changes the rules and
     item names; a merge (client ID, code, name) needs Full on Finance OR Full on Clients. No role check. */
  function canMergeMR(){ try{ if(window.__isShareView)return false;
    return (typeof window.finCanWrite==='function'&&!!window.finCanWrite())||(typeof window.mayEditPage==='function'&&window.mayEditPage('clients')===true); }catch(_){ return false; } }
  function canEdit(){ try{ if(window.__isShareView)return false; return typeof window.finCanWrite==='function'?!!window.finCanWrite():false; }catch(_){ return false; } }
  /* the database's money_norm, mirrored: NFKC, lower case, Arabic alef / yeh / teh-marbuta folded, only letters and digits */
  function normMR(s){ s=String(s==null?'':s); try{ s=s.normalize('NFKC'); }catch(_){}
    s=s.toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670\u0640]/g,'');
    try{ return s.replace(/[^\p{L}\p{N}]+/gu,''); }catch(_){ return s.replace(/[\s\W_]+/g,''); } }
  window.normMR=normMR;

  var KINDS=[['client_id','Payments client ID','معرّف العميل في المدفوعات'],
             ['name','Client name or alias (rows with no client ID)','اسم العميل أو اسم بديل (للصفوف بلا معرّف)'],
             ['tax_no','VAT or CR number','الرقم الضريبي أو السجل التجاري'],
             ['discount_code','Discount code','رمز الخصم'],
             ['transaction','One transaction number','رقم عملية واحد']];
  var ORDER=['transaction','client_id','tax_no','discount_code','name'];
  function kindLabel(k){ var x=KINDS.find(function(a){return a[0]===k;}); return x?fl(x[1],x[2]):k; }
  var TYPES={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};
  function typeLabel(t){ var x=TYPES[t]; return x?fl(x[0],x[1]):(t||'—'); }

  var MR={rules:null,err:null,loading:false,codes:null,links:null};
  window.MR=MR;
  /* 2026-09-28: read the rules only once the database knows who is asking. The first read used to run as the page opened,
     before sign-in finished; the database refused it (the rules are not public), the refusal was kept, and nothing read them
     again — so after a fresh sign-in the Rules card said "No exclusion rules" over twenty real ones until a reload. */
  var waitSignIn=null;
  function signedIn(){ try{ return window.__roleKnown===true&&!!window.__userRole; }catch(_){ return false; } }
  function load(cb){
    if(!signedIn()){ if(!waitSignIn){ var n=0; waitSignIn=setInterval(function(){ n++; if(signedIn()||n>240){ clearInterval(waitSignIn); waitSignIn=null; if(signedIn()) load(cb); } },500); } return; }
    if(MR.loading){ return; } MR.loading=true;
    var c=client(); if(!c){ MR.loading=false; return; }
    Promise.all([
      c.from('money_exclusion_rules').select('*').is('removed_at',null).order('created_at',{ascending:true}),
      c.from('company_discount_codes').select('id,business_id,promo_code_id,note,linked_at').is('removed_at',null),
      c.from('promo_codes').select('id,code,kind,value_pct').order('code',{ascending:true}),
      c.from('company_name_aliases').select('id,business_id,name,created_by_name,created_at').is('removed_at',null)
    ]).then(function(r){
      MR.loading=false;
      MR.err=(r[0]&&r[0].error)?String(r[0].error.message||r[0].error):null;
      MR.rules=(r[0]&&r[0].data)||[]; MR.links=(r[1]&&r[1].data)||[]; MR.codes=(r[2]&&r[2].data)||[]; MR.aliases=(r[3]&&r[3].data)||[];
      if(!window.CP||window.CP.rows==null){ if(typeof window.cpLoad==='function') window.cpLoad(function(){ redraw(); }); }
      if(cb)cb(); redraw();
    },function(err){ MR.loading=false; MR.err=String((err&&err.message)||err); MR.rules=[]; redraw(); });
  }
  window.moneyRulesLoad=load;
  /* a new sign-in (or a person switching accounts in the same tab) reads the rules again */
  (function hook(n){ var c=client(); if(c&&c.auth&&c.auth.onAuthStateChange){ c.auth.onAuthStateChange(function(ev){ if(ev==='SIGNED_IN'&&(MR.err||MR.rules==null)){ MR.err=null; MR.rules=null; setTimeout(function(){ load(); },300); } }); return; }
    if((n||0)<120) setTimeout(function(){ hook((n||0)+1); },500); })(0);
  function redraw(){ try{ if(typeof current!=='undefined'&&(current==='finance'||current==='leads'||current==='clients')&&typeof render==='function') render(); }catch(_){} }
  /* after a change: rules, client IDs and Finance all read again, so every figure moves at once */
  function refreshAll(){
    MR.rules=null; load();
    try{ if(window.CP){ window.CP.rows=null; if(typeof window.cpLoad==='function') window.cpLoad(function(){ redraw(); }); } }catch(_){}
    try{ if(window.FIN&&typeof window.finLoad==='function'){ FIN.rows=null; finLoad(); } }catch(_){}
    try{ if(typeof window.__v113Reload==='function'){ var el=document.querySelector('.v113-card'); if(el) window.__v113Reload(el.getAttribute('data-biz')); } }catch(_){}
  }

  /* ---------- matching (the same order and rules as the database's money_row_rules) ---------- */
  function active(){ return (MR.rules||[]).filter(function(r){ return r.active&&!r.removed_at; }); }
  window.moneyRuleFor=function(k){
    k=k||{}; var cid=normMR(k.clientId), nm=[normMR(k.name),normMR(k.name2)].filter(Boolean), tax=normMR(k.taxNo), code=normMR(k.code),
        tx=[normMR(k.txn),normMR(k.invoiceNo)].filter(Boolean), bizTax=normMR(k.bizTax);
    var hits=active().filter(function(r){ var v=normMR(r.value); if(!v)return false;
      if(r.kind==='transaction') return tx.indexOf(v)>=0;
      if(r.kind==='client_id') return !!cid&&v===cid;
      if(r.kind==='tax_no') return (!!tax&&v===tax)||(v.length>=8&&!!bizTax&&bizTax.indexOf(v)>=0);
      if(r.kind==='discount_code') return !!code&&v===code;
      if(r.kind==='name') return !cid&&nm.indexOf(v)>=0;
      return false; });
    hits.sort(function(a,b){ return ORDER.indexOf(a.kind)-ORDER.indexOf(b.kind); });
    return hits[0]||null;
  };
  /* js/62's name list is retired (the owner's order of 27 Sep: its entries were removed, not carried over). The importers
     still ask this question by name; the answer now comes from the typed NAME rules — and it no longer means "skip the
     row": the row is imported and the view leaves it out, so switching the rule off brings it back. */
  window.finExclusionCheck=function(name){ var r=window.moneyRuleFor({name:name}); return r?{id:r.id,clientId:r.value,reason:r.reason,kind:r.kind}:null; };
  /* invoices are decided by the view (FIN.m, loaded with the rows); the page's copy of the rules only drives this screen
     and the transactions list, which the view does not cover */
  window.finExclusionsKnown=function(){ try{ return !!(window.FIN&&FIN.rows&&FIN.m&&!FIN.mErr); }catch(_){ return false; } };
  window.moneyRulesKnown=function(){ return MR.rules!=null&&!MR.err; };
  window.finExclusionList=function(){ return (MR.rules||[]).slice(); };
  window.finExclusionGateRows=function(rows,cb){ try{ cb(null); }catch(_){} };   // nothing to refuse: the view applies the rules to whatever lands
  window.finGroupCheck=function(){ return null; };                               // name aliases retired — a company is what its typed IDs say
  window.finGroupList=function(){ return []; };

  /* ---------- helpers over the loaded data ---------- */
  function bizIndex(){ var ix={}; ((typeof DB!=='undefined'&&DB.businesses)||[]).forEach(function(b){ var u=(window.__bizUuid?window.__bizUuid(b.id):b.id); ix[u]=b; }); return ix; }
  function codeById(){ var ix={}; (MR.codes||[]).forEach(function(p){ ix[p.id]=p; }); return ix; }
  function moneyStats(){   // per rule, per company, the not-merged entries and the unassigned codes — from the one view
    var M=(window.FIN&&FIN.m)||{}, rows=(window.FIN&&FIN.rows)||[], st={rule:{},biz:{},loose:{},unassigned:{n:0,sar:0,codes:{}},noId:{n:0,sar:0}};
    rows.forEach(function(r){ if(r.deleted_at)return; var m=M[r.id]; if(!m)return; var v=Number(r.revenue_sar)||0;
      if(m.rule_id){ var s=st.rule[m.rule_id]=st.rule[m.rule_id]||{n:0,sar:0}; s.n++; s.sar+=v; }
      if(m.excluded)return;
      if(m.business_id){ var b=st.biz[m.business_id]=st.biz[m.business_id]||{n:0,sar:0}; if(m.counts){ b.n++; b.sar+=v; } }
      else if(m.merge_state==='not_merged'||m.merge_state==='no_client_id'){ var l=st.loose[m.company_key]=st.loose[m.company_key]||{n:0,sar:0,name:m.company_name,id:r.payments_client_id||null,kind:m.merge_state==='not_merged'?'client_id':'name'}; l.n++; if(m.counts) l.sar+=v; }
      else if(m.merge_state==='unassigned_code'){ if(m.counts){ st.unassigned.n++; st.unassigned.sar+=v; } if(r.discount_code) st.unassigned.codes[r.discount_code]=1; }
      });
    return st;
  }
  /* the rules that catch a company: its typed client IDs, its typed codes, or its VAT/CR number */
  window.moneyRulesForCompany=function(bizUuid){
    var out=[], b=bizIndex()[bizUuid]||{}, ids=((window.CP&&CP.byBiz&&CP.byBiz[bizUuid])||[]), cx=codeById();
    ids.forEach(function(p){ var r=window.moneyRuleFor({clientId:p.direct_client_id}); if(r) out.push({what:fl('client ID #','معرّف العميل #')+p.direct_client_id,rule:r}); });
    (MR.links||[]).filter(function(l){return l.business_id===bizUuid;}).forEach(function(l){ var p=cx[l.promo_code_id]; if(!p)return;
      var r=window.moneyRuleFor({code:p.code}); if(r) out.push({what:fl('code ','الرمز ')+p.code,rule:r}); });
    var tr=window.moneyRuleFor({bizTax:b.crVat||b.cr_vat}); if(tr&&tr.kind==='tax_no') out.push({what:fl('VAT / CR number','الرقم الضريبي / السجل'),rule:tr});
    return out;
  };

  /* ---------- the changes (each one a button a person pressed; the database decides) ---------- */
  function refused(r){ if(r&&r.error) return said(r.error); if(!r||!r.data||!r.data.length) return fl('The database refused this — nothing was saved. Changing the rules needs Full control on Finance.','رفضت قاعدة البيانات هذا — لم يُحفظ شيء. تغيير القواعد يحتاج «تحكم كامل» على «المالية».'); return null; }
  function said(err){ var m=String((err&&err.message)||err||'');
    if(/money_exclusion_rules_one_live/.test(m)) return fl('That rule already exists (the same type and value, however it is spelled).','هذه القاعدة موجودة بالفعل (النوع والقيمة نفسهما مهما اختلفت الكتابة).');
    if(/money_rule_reason_given/.test(m)) return fl('A reason is required.','السبب مطلوب.');
    if(/money_rule_value_readable/.test(m)) return fl('The value needs at least one letter or digit.','القيمة تحتاج حرفًا أو رقمًا واحدًا على الأقل.');
    if(/one_open_prepaid_postpaid/.test(m)) return fl('This company already has an open prepaid (or postpaid) client ID — a company holds one of each; tenders are unlimited.','لدى هذه الشركة معرّف مسبق الدفع (أو آجل) مفتوح — للشركة واحد من كل منهما؛ والمناقصات بلا حد.');
    if(/row-level security|42501|permission/i.test(m)) return fl('Changing the rules needs Full control on Finance.','تغيير القواعد يحتاج «تحكم كامل» على «المالية».');
    if(typeof window.__v113Said==='function') return window.__v113Said(err);
    return fl('Could not save: ','تعذّر الحفظ: ')+m; }
  function ask(msg,yes,opts){ if(typeof window.askInPage==='function') window.askInPage(msg,yes,opts); }   // 2026-09-28 (D19): no box, no action; never a native confirm()
  function val(id){ var el=document.getElementById(id); return el?String(el.value||'').trim():''; }

  window.v117AddRule=function(kindPre,valEnc){ if(!canEdit())return;
    var vPre=valEnc?decodeURIComponent(valEnc):'';
    openModal(fl('Add an exclusion rule','إضافة قاعدة استبعاد'),
      '<div class="ch-sub">'+fl('Rows that match are left out of every total, KPI, report and export at once — nothing is deleted, and switching the rule off brings them back.','الصفوف المطابقة تُستبعد فورًا من كل إجمالي ومؤشر وتقرير وتصدير — لا يُحذف شيء، وإيقاف القاعدة يعيدها.')+'</div>'+
      '<div class="field"><label>'+fl('Type','النوع')+'</label><select id="v117_kind">'+KINDS.map(function(k){ return '<option value="'+k[0]+'"'+(k[0]===kindPre?' selected':'')+'>'+e(fl(k[1],k[2]))+'</option>'; }).join('')+'</select></div>'+
      '<div class="field"><label>'+fl('Value','القيمة')+'</label><input id="v117_value" value="'+e(vPre)+'" placeholder=""'+e(fl('e.g. 7','مثال: 7'))+'"></div>'+
      '<div class="field"><label>'+fl('Reason (required)','السبب (مطلوب)')+'</label><input id="v117_reason" placeholder="'+e(fl('e.g. test account in Payments','مثال: حساب تجريبي في المدفوعات'))+'"></div>',
      function(){ var kind=val('v117_kind'), v=val('v117_value'), why=val('v117_reason');
        if(!normMR(v)){ alert(fl('Type the value.','اكتب القيمة.')); return false; }
        if(!why){ alert(fl('A reason is required.','السبب مطلوب.')); return false; }
        var dup=(MR.rules||[]).find(function(r){ return r.kind===kind&&normMR(r.value)===normMR(v); });
        if(dup){ alert(fl('That rule already exists: ','هذه القاعدة موجودة: ')+dup.value); return false; }
        client().from('money_exclusion_rules').insert({kind:kind,value:v,reason:why}).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } try{ closeModal(); }catch(_){} refreshAll(); });
        return false; });
  };
  window.v117SwitchRule=function(id,on){ if(!canEdit())return;
    var go=function(){ client().from('money_exclusion_rules').update({active:!!on}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshAll(); }); };
    if(on){ go(); return; }
    /* 2026-09-28 (D19): switching a rule off asks first, naming it. The tick goes back on BEFORE the question, so a Cancel
       leaves it showing the truth; only a Yes switches it off. No box, no change. */
    var r0=(MR.rules||[]).filter(function(x){ return String(x.id)===String(id); })[0]||{}; var rv=String(r0.value||'').slice(0,60);
    try{ var cb=document.querySelector('[data-v117-switch="'+String(id).replace(/"/g,'')+'"]'); if(cb) cb.checked=true; }catch(_){}
    ask(fl('Switch off the rule "'+rv+'"? Its rows count again at once; switch it back on to leave them out again.','إيقاف القاعدة «'+rv+'»؟ تعود صفوفها للحساب فورًا؛ أعد تشغيلها لاستبعادها مجددًا.'),go,{danger:true,yes:'Switch off',yesAr:'إيقاف'}); };
  window.v117RemoveRule=function(id){ if(!canEdit())return;
    var r0=(MR.rules||[]).find(function(r){return r.id===id;}); if(!r0)return;
    ask(fl('Remove the rule "','إزالة القاعدة «')+r0.value+fl('"? Its rows count again at once. A removal is final — add it again if needed.','»؟ تعود صفوفها للحساب فورًا. الإزالة نهائية — أضفها من جديد عند الحاجة.'),function(){
      client().from('money_exclusion_rules').update({removed_at:new Date().toISOString()}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshAll(); }); }); };

  /* no company to choose from: say so, rather than open a form with an empty list (the retired grouping window's guard) */
  function noCompanies(){ var n=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){ return !b.archived&&!b.archivedAt; }).length;
    if(n)return true;
    alert((typeof DB==='undefined'||!DB.businesses)?fl('The company list is still loading — try again in a moment.','قائمة الشركات ما زالت تُحمَّل — حاول بعد لحظة.')
      :fl('There are no companies yet — add the company first (New company… in Needs a decision, or Leads → New).','لا توجد شركات بعد — أضف الشركة أولًا («شركة جديدة…» في «يحتاج قرارًا»، أو العملاء المحتملون ← جديد).'));
    return false; }
  function companyOptions(sel,sug){ var list=((typeof DB!=='undefined'&&DB.businesses)||[]).filter(function(b){ return !b.archived&&!b.archivedAt; }).slice().sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
    return '<option value="">'+fl('— choose the company —','— اختر الشركة —')+'</option>'+list.map(function(b){ var u=(window.__bizUuid?window.__bizUuid(b.id):b.id);
      return '<option value="'+e(u)+'"'+(u===sel?' selected':'')+'>'+e(b.name||'(unnamed)')+(b.isClient?'':' · '+fl('lead','عميل محتمل'))+(sug&&sug.biz===u?' · '+fl('suggested','مقترح'):'')+'</option>'; }).join(''); }
  /* a suggestion, never applied: the same name once spelling is folded (NFKC, case, Arabic letter forms, punctuation and
     spaces) — against a company's English or Arabic name, its legal name, or a name already typed into it */
  function suggest(name){ var n=normMR(name); if(!n)return null; var hit=null;
    ((typeof DB!=='undefined'&&DB.businesses)||[]).some(function(b){ if(b.archived||b.archivedAt)return false;
      var u=(window.__bizUuid?window.__bizUuid(b.id):b.id);
      if([b.name,b.nameAr,b.legalName].some(function(x){ return x&&normMR(x)===n; })){ hit={biz:u,name:b.name,why:fl('same name','الاسم نفسه')}; return true; } return false; });
    if(!hit)(MR.aliases||[]).some(function(a){ if(normMR(a.name)===n){ var b=bizIndex()[a.business_id]; hit={biz:a.business_id,name:(b&&b.name)||'',why:fl('a name already typed into it','اسم مكتوب لها من قبل')}; return true; } return false; });
    return hit; }
  window.v117Suggest=suggest;
  function aliasOwner(name){ var n=normMR(name); return (MR.aliases||[]).find(function(a){ return normMR(a.name)===n; })||null; }
  /* one decision: this client ID / this customer name belongs to the chosen company (typed, logged, remembered) */
  function assign(kind,key,biz,type,done){
    var c=client(), b=bizIndex()[biz];
    if(kind==='client_id'){ var o=owner(key); if(o){ var ob=bizIndex()[o.business_id]; alert(fl('Client ID #','معرّف العميل #')+o.direct_client_id+fl(' already belongs to ',' مسجّل بالفعل لـ ')+((ob&&ob.name)||fl('another company','شركة أخرى'))+fl('. An ID belongs to one company only — remove it there first.','. المعرّف لشركة واحدة فقط — أزله من هناك أولًا.')); return; }
      c.from('client_profiles').insert({business_id:biz,direct_client_id:key,profile_type:type||'tender',status:'active',source:'manual'}).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } if(done)done(); refreshAll(); });
    } else { var a=aliasOwner(key); if(a){ var ab=bizIndex()[a.business_id]; alert(fl('The name "','الاسم «')+key+fl('" already belongs to ','» مسجّل بالفعل لـ ')+((ab&&ab.name)||fl('another company','شركة أخرى'))+fl('. A name belongs to one company only — remove it there first.','. الاسم لشركة واحدة فقط — أزله من هناك أولًا.')); return; }
      c.from('company_name_aliases').insert({business_id:biz,name:key}).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } if(done)done(); refreshAll(); }); }
  }
  window.v117Decide=function(ix,kind,keyEnc){ if(!canMergeMR())return;
    var key=decodeURIComponent(keyEnc), biz=val('v117_d'+ix), t=val('v117_t'+ix)||'tender';
    if(!biz){ alert(fl('Choose the company it belongs to — or New company, or Exclude.','اختر الشركة التي يتبعها — أو شركة جديدة، أو استبعاد.')); return; }
    assign(kind,key,biz,t); };
  /* a new company: the app's own company form opens with the Payments name filled in; when the person saves it, this
     decision is applied to it — nothing is created unless the person saves the form */
  var PENDING=null;
  window.v117NewCompanyFor=function(ix,kind,keyEnc,nameEnc){ if(!canMergeMR())return;
    var key=decodeURIComponent(keyEnc), name=decodeURIComponent(nameEnc||'')||key, t=val('v117_t'+ix)||'tender';
    if(typeof window.editBusiness!=='function'&&typeof window.editLead!=='function'){ alert(fl('The company form is not available here.','نموذج الشركة غير متاح هنا.')); return; }
    var before={}; ((typeof DB!=='undefined'&&DB.businesses)||[]).forEach(function(b){ before[b.id]=1; });
    PENDING={kind:kind,key:key,type:t,before:before,at:Date.now()};
    try{ (window.editBusiness||window.editLead)(''); }catch(_){}
    setTimeout(function(){ var f=document.getElementById('f_name'); if(f&&!f.value){ f.value=name; try{ f.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){} } },60);
    var tries=0, iv=setInterval(function(){ tries++;
      if(!PENDING||tries>240){ clearInterval(iv); return; }   // two minutes to save the form
      var nb=((typeof DB!=='undefined'&&DB.businesses)||[]).find(function(b){ return !PENDING.before[b.id]; }); if(!nb)return;
      var u=(window.__bizUuid?window.__bizUuid(nb.id):nb.id);
      if(!/^[0-9a-f-]{36}$/i.test(String(u||''))&&!(window.__v117AnyId)) return;   // wait until the database has given it its id
      clearInterval(iv); var p=PENDING; PENDING=null; assign(p.kind,p.key,u,p.type); },500);
  };
  window.v117RemoveAlias=function(id){ if(!canMergeMR())return;
    var a=(MR.aliases||[]).find(function(x){return x.id===id;}); if(!a)return;
    ask(fl('Take the name "','إزالة الاسم «')+a.name+fl('" out of this company? Its rows stand alone again (Needs a decision).','» من هذه الشركة؟ تعود صفوفه مستقلة («يحتاج قرارًا»).'),function(){
      client().from('company_name_aliases').update({removed_at:new Date().toISOString()}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshAll(); }); }); };
  function owner(idText){ var n=normMR(idText); var hit=((window.CP&&CP.rows)||[]).find(function(p){ return normMR(p.direct_client_id)===n; }); return hit||null; }
  window.v117AddClientId=function(bizUuid,prefill){ if(!canMergeMR())return;
    if(!noCompanies())return;
    openModal(fl('Add a client ID to a company','إضافة معرّف عميل إلى شركة'),
      '<div class="ch-sub">'+fl('Only what is typed here is merged: every transaction carrying this Direct Payments client ID counts under the company. One ID belongs to one company.','لا يُدمج إلا ما يُكتب هنا: كل عملية تحمل معرّف العميل هذا تُحتسب لهذه الشركة. المعرّف الواحد لشركة واحدة.')+'</div>'+
      '<div class="field"><label>'+fl('Company','الشركة')+'</label><select id="v117_biz">'+companyOptions(bizUuid)+'</select></div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Direct Payments client ID','معرّف العميل في المدفوعات')+'</label><input id="v117_cid" value="'+e(prefill||'')+'" placeholder="'+e(fl('e.g. 20','مثال: 20'))+'"></div>'+
      '<div class="field"><label>'+fl('Type','النوع')+'</label><select id="v117_type"><option value="prepaid">'+typeLabel('prepaid')+'</option><option value="postpaid">'+typeLabel('postpaid')+'</option><option value="tender">'+typeLabel('tender')+'</option></select></div></div>',
      function(){ var biz=val('v117_biz'), cid=val('v117_cid'), t=val('v117_type');
        if(!biz){ alert(fl('Choose the company.','اختر الشركة.')); return false; }
        if(!normMR(cid)){ alert(fl('Type the client ID.','اكتب معرّف العميل.')); return false; }
        var o=owner(cid); if(o){ var ob=bizIndex()[o.business_id]; alert(fl('Client ID #','معرّف العميل #')+o.direct_client_id+fl(' already belongs to ',' مسجّل بالفعل لـ ')+((ob&&ob.name)||fl('another company','شركة أخرى'))+fl('. An ID belongs to one company only — remove it there first.','. المعرّف لشركة واحدة فقط — أزله من هناك أولًا.')); return false; }
        client().from('client_profiles').insert({business_id:biz,direct_client_id:cid,profile_type:t,status:'active',source:'manual'}).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } try{ closeModal(); }catch(_){} refreshAll(); });
        return false; });
  };
  window.v117RemoveClientId=function(profileId){ if(!canMergeMR())return;
    var p=((window.CP&&CP.rows)||[]).find(function(x){return x.id===profileId;}); if(!p)return; var b=bizIndex()[p.business_id];
    ask(fl('Take client ID #','إزالة معرّف العميل #')+p.direct_client_id+fl(' out of ',' من ')+((b&&b.name)||'')+fl('? Its transactions stand alone again ("Not merged — review").','؟ تعود عملياته مستقلة («غير مدموج — للمراجعة»).'),function(){
      client().from('client_profiles').delete().eq('id',profileId).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshAll(); }); }); };
  window.v117AddCode=function(bizUuid){ if(!canMergeMR())return;
    if(!noCompanies())return;
    openModal(fl('Add a discount code to a company','إضافة رمز خصم إلى شركة'),
      '<div class="ch-sub">'+fl('Sales that used this code count under the company, and leave "Unassigned codes" — never counted twice. One code belongs to one company.','المبيعات التي استخدمت هذا الرمز تُحتسب للشركة وتخرج من «رموز غير مخصّصة» — لا تُحتسب مرتين. الرمز الواحد لشركة واحدة.')+'</div>'+
      '<div class="field"><label>'+fl('Company','الشركة')+'</label><select id="v117_cbiz">'+companyOptions(bizUuid)+'</select></div>'+
      '<div class="field"><label>'+fl('Code','الرمز')+'</label><input id="v117_code" list="v117_codes" placeholder="'+e(fl('type the code','اكتب الرمز'))+'"><datalist id="v117_codes">'+(MR.codes||[]).map(function(p){ return '<option value="'+e(p.code)+'">'; }).join('')+'</datalist></div>',
      function(){ var biz=val('v117_cbiz'), code=val('v117_code');
        if(!biz){ alert(fl('Choose the company.','اختر الشركة.')); return false; }
        var p=(MR.codes||[]).find(function(x){ return normMR(x.code)===normMR(code); });
        if(!p){ alert(fl('That code is not in the discount-code list from Direct Payments.','هذا الرمز ليس في قائمة رموز الخصم من المدفوعات.')); return false; }
        var taken=(MR.links||[]).find(function(l){ return l.promo_code_id===p.id; });
        if(taken){ var tb=bizIndex()[taken.business_id]; alert(fl('Code ','الرمز ')+p.code+fl(' already belongs to ',' مخصّص بالفعل لـ ')+((tb&&tb.name)||fl('another company','شركة أخرى'))+fl('. A code belongs to one company only — remove it there first.','. الرمز لشركة واحدة فقط — أزله من هناك أولًا.')); return false; }
        client().from('company_discount_codes').insert({business_id:biz,promo_code_id:p.id}).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } try{ closeModal(); }catch(_){} refreshAll(); });
        return false; });
  };
  window.v117RemoveCode=function(linkId){ if(!canMergeMR())return;
    var cn=''; try{ var lk=(MR.links||[]).filter(function(l){return String(l.id)===String(linkId);})[0]; var pc=lk&&(MR.codes||[]).filter(function(p){return p.id===lk.promo_code_id;})[0]; cn=(pc&&pc.code)||''; }catch(_){}   // 2026-09-28 (D19): names the code
    ask(fl('Take the code "'+cn+'" out of the company? Its sales go back to "Unassigned codes".','إزالة الرمز «'+cn+'» من الشركة؟ تعود مبيعاته إلى «رموز غير مخصّصة».'),function(){
      client().from('company_discount_codes').update({removed_at:new Date().toISOString()}).eq('id',linkId).select('id').then(function(r){ var m=refused(r); if(m){ alert(m); return; } refreshAll(); }); }); };
  window.v117Log=function(){ if(typeof window.openChangeLog!=='function')return;
    /* every rule ever written, removed ones included — a switch-off, switch-on and removal are changes to a rule that may no
       longer be on screen (F4, 28 Sep) */
    var open=function(labels){ window.openChangeLog([{table:'money_exclusion_rules',all:true}],fl('Exclusion rules','قواعد الاستبعاد'),labels); };
    var c=client(); if(!c){ open(null); return; }
    c.from('money_exclusion_rules').select('id,kind,value,removed_at').then(function(r){ var L={};
      ((r&&r.data)||[]).forEach(function(x){ L[x.id]=kindLabel(x.kind)+' '+x.value+(x.removed_at?' ('+fl('removed','أُزيلت')+')':''); }); open(L); },function(){ open(null); }); };

  /* ---------- the screen ---------- */
  var TH='padding:7px 9px;font-weight:700;font-size:12px', TD='padding:7px 9px;font-size:12.5px;border-top:1px solid var(--line,#EEF0F3);vertical-align:top';
  function table(head,rows){ return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#303848;color:#fff;text-align:'+(isAr()?'right':'left')+'">'+
    head.map(function(h){ return '<th style="'+TH+'">'+h+'</th>'; }).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'; }
  function body(){
    var w=canEdit(), st=moneyStats(), h='';
    if(window.FIN&&FIN.mErr) h+='<div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid #D92D20;color:#B42318">'+fl('The rules could not be applied (the database view did not answer), so Finance shows no money until it does. ','تعذّر تطبيق القواعد (لم يجب عرض قاعدة البيانات)، لذا لا تعرض المالية أي مبالغ حتى يجيب. ')+e(FIN.mErr)+'</div>';
    if(MR.err) h+='<div style="color:#B42318;font-size:12.5px;margin-bottom:8px">'+fl('The rules could not be read: ','تعذّرت قراءة القواعد: ')+e(MR.err)+'</div>';
    /* card 1 — exclusion rules */
    var rules=(MR.rules||[]);
    h+='<div class="card v117-rules" style="padding:18px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">'+fl('Exclusion rules','قواعد الاستبعاد')+'</h3>'+
      (w?'<button class="btn sm pri" data-v117="add-rule" onclick="v117AddRule()">+ '+fl('Add a rule','إضافة قاعدة')+'</button>':'')+
      ((typeof window.changeLogVisible==='function'&&window.changeLogVisible())?' <button class="btn sm ghost" onclick="v117Log()">'+fl('Change log','سجل التغييرات')+'</button>':'')+'</div>'+
      '<div class="ch-sub" style="margin:4px 0 10px">'+fl('Only what is typed here is left out; everything else counts. A row caught by an active rule leaves every total, KPI, report and export at once.','لا يُستبعد إلا ما يُكتب هنا؛ وكل ما عداه يُحتسب. الصف الذي تلتقطه قاعدة فعّالة يخرج فورًا من كل إجمالي ومؤشر وتقرير وتصدير.')+'</div>';
    h+=rules.length?table([fl('Type','النوع'),fl('Value','القيمة'),fl('Reason','السبب'),fl('Catches','تلتقط'),fl('Added','أُضيفت'),fl('On','فعّالة'),''],rules.map(function(r){ var s=st.rule[r.id]||{n:0,sar:0};
        return '<tr data-v117-rule="'+e(r.id)+'"'+(r.active?'':' style="opacity:.6"')+'><td style="'+TD+'">'+e(kindLabel(r.kind))+'</td><td style="'+TD+';font-weight:700">'+e(r.value)+'</td><td style="'+TD+'">'+e(r.reason)+'</td>'+
          '<td style="'+TD+';white-space:nowrap">'+(r.active?(s.n+' '+fl('rows','صف')+' · '+sar(s.sar)):fl('off','متوقفة'))+'</td>'+
          '<td style="'+TD+';color:var(--muted);font-size:11.5px">'+e(r.created_by_name||'—')+' · '+e(dayRiyadh(r.created_at))+(r.updated_at?'<br>'+fl('changed ','غُيّرت ')+e(r.updated_by_name||'')+' · '+e(dayRiyadh(r.updated_at)):'')+'</td>'+
          '<td style="'+TD+'"><input type="checkbox" data-v117-switch="'+e(r.id)+'" '+(r.active?'checked':'')+(w?'':' disabled')+' onchange="v117SwitchRule(\''+e(r.id)+'\',this.checked)" aria-label="'+e(fl('Rule on','القاعدة فعّالة'))+'"></td>'+
          '<td style="'+TD+'">'+(w?'<button class="btn ghost sm" onclick="v117RemoveRule(\''+e(r.id)+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</td></tr>'; }))
      :(MR.err?'<div class="empty" data-v117-empty="rules-unread" style="padding:10px 0;color:#B42318">'+fl('The rules could not be read, so this list is not shown. ','تعذّرت قراءة القواعد، فلا تُعرض هذه القائمة. ')+'<button class="btn sm ghost" onclick="MR.err=null;MR.rules=null;moneyRulesLoad()">'+fl('Try again','حاول مجددًا')+'</button></div>'
        :'<div class="empty" data-v117-empty="rules" style="padding:10px 0">'+fl('No exclusion rules — every transaction counts.','لا توجد قواعد استبعاد — كل العمليات تُحتسب.')+'</div>');
    h+='</div>';
    /* card 2 — company merges */
    var bix=bizIndex(), cx=codeById(), byBiz={};
    ((window.CP&&CP.rows)||[]).forEach(function(p){ (byBiz[p.business_id]=byBiz[p.business_id]||{ids:[],codes:[]}).ids.push(p); });
    (MR.links||[]).forEach(function(l){ (byBiz[l.business_id]=byBiz[l.business_id]||{ids:[],codes:[]}).codes.push(l); });
    (MR.aliases||[]).forEach(function(a){ var x=byBiz[a.business_id]=byBiz[a.business_id]||{ids:[],codes:[]}; (x.names=x.names||[]).push(a); });
    var comps=Object.keys(byBiz).sort(function(a,b){ return String((bix[a]||{}).name||'').localeCompare(String((bix[b]||{}).name||'')); });
    h+='<div class="card v117-merges" style="padding:18px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">'+fl('Company merges','دمج الشركات')+'</h3>'+
      (w?'<button class="btn sm pri" data-v117="add-id" onclick="v117AddClientId()">+ '+fl('Client ID','معرّف عميل')+'</button> <button class="btn sm" data-v117="add-code" onclick="v117AddCode()">+ '+fl('Discount code','رمز خصم')+'</button>':'')+'</div>'+
      '<div class="ch-sub" style="margin:4px 0 10px">'+fl('Only what is typed here is merged; nothing is added automatically. A client ID or a code belongs to one company only. Exclusion beats merge.','لا يُدمج إلا ما يُكتب هنا؛ لا يُضاف شيء تلقائيًا. معرّف العميل أو الرمز لشركة واحدة فقط. الاستبعاد يسبق الدمج.')+'</div>';
    h+=comps.length?table([fl('Company','الشركة'),fl('Client IDs and names','المعرّفات والأسماء'),fl('Discount codes','رموز الخصم'),fl('Counts','يُحتسب')],comps.map(function(u){ var c=byBiz[u], b=bix[u]||{}, s=st.biz[u]||{n:0,sar:0};
        var ids=c.ids.map(function(p){ var r=window.moneyRuleFor({clientId:p.direct_client_id});
          return '<div data-v117-cid="'+e(p.direct_client_id)+'"><span class="tag">'+e(typeLabel(p.profile_type))+'</span> <b>#'+e(p.direct_client_id)+'</b>'+(p.closed_at?' <span class="muted">'+fl('closed','مغلق')+'</span>':'')+
            (r?' <span class="tag" style="background:#FDECEC;color:#B42318">'+fl('excluded — ','مستبعد — ')+e(r.reason)+'</span>':'')+
            (w?' <button class="btn ghost sm" style="padding:0 6px" onclick="v117RemoveClientId(\''+e(p.id)+'\')" aria-label="'+e(fl('Remove','إزالة'))+'">×</button>':'')+'</div>'; }).join('');
        var codes=c.codes.map(function(l){ var p=cx[l.promo_code_id]||{}; var r=window.moneyRuleFor({code:p.code});
          return '<div><b>'+e(p.code||'?')+'</b>'+(r?' <span class="tag" style="background:#FDECEC;color:#B42318">'+fl('excluded','مستبعد')+'</span>':'')+(w?' <button class="btn ghost sm" style="padding:0 6px" onclick="v117RemoveCode(\''+e(l.id)+'\')" aria-label="'+e(fl('Remove','إزالة'))+'">×</button>':'')+'</div>'; }).join('');
        var names=(c.names||[]).map(function(a){ return '<div data-v117-alias="'+e(a.name)+'"><span class="tag">'+fl('name','اسم')+'</span> '+e(a.name)+(w?' <button class="btn ghost sm" style="padding:0 6px" onclick="v117RemoveAlias(\''+e(a.id)+'\')" aria-label="'+e(fl('Remove','إزالة'))+'">×</button>':'')+'</div>'; }).join('');
        return '<tr data-v117-company="'+e(u)+'"><td style="'+TD+';font-weight:700">'+e(b.name||fl('(company not found)','(الشركة غير موجودة)'))+'</td><td style="'+TD+'">'+((ids+names)||'—')+'</td><td style="'+TD+'">'+(codes||'—')+'</td><td style="'+TD+'">'+s.n+' · '+sar(s.sar)+'</td></tr>'; }))
      :'<div class="empty" data-v117-empty="merges" style="padding:10px 0">'+fl('No merges yet — every client ID stands alone.','لا يوجد دمج بعد — كل معرّف عميل مستقل.')+'</div>';
    /* Needs a decision (oversight's design, 27 Sep): every client ID and every customer name that no company holds yet,
       largest first — one control each: belongs to a company (a suggestion is pre-selected, never applied), a new company,
       or exclude (reason required). Every answer is typed, logged, and remembered for later imports. */
    var loose=Object.keys(st.loose).sort(function(x,y){ return (st.loose[y].sar-st.loose[x].sar)||(st.loose[y].n-st.loose[x].n); });
    h+='<h4 style="margin:16px 0 6px">'+fl('Needs a decision','يحتاج قرارًا')+' <span class="muted" style="font-weight:400">· '+loose.length+' — '+fl('client IDs and customer names no company holds yet, largest first','معرّفات عملاء وأسماء لا تتبع أي شركة بعد، الأكبر أولًا')+'</span></h4>';
    h+=loose.length?table([fl('Client ID or name','المعرّف أو الاسم'),fl('Name in Payments','الاسم في المدفوعات'),fl('Rows · SAR','صفوف · ر.س'),fl('Decision','القرار')],loose.map(function(k,ix){ var l=st.loose[k];
        var sug=suggest(l.name), key=l.kind==='client_id'?l.id:l.name;
        return '<tr data-v117-loose="'+e(key)+'" data-v117-kind="'+e(l.kind)+'"><td style="'+TD+';font-weight:700">'+(l.kind==='client_id'?'#'+e(l.id):'<span class="tag">'+fl('name','اسم')+'</span>')+'</td><td style="'+TD+'">'+e(l.name||'—')+'</td><td style="'+TD+'">'+l.n+' · '+sar(l.sar)+'</td><td style="'+TD+'">'+
          (w?'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select id="v117_d'+ix+'" style="max-width:220px" aria-label="'+e(fl('Belongs to','تتبع')+' '+(l.name||key))+'">'+companyOptions(sug?sug.biz:'',sug)+'</select>'+
            (l.kind==='client_id'?'<select id="v117_t'+ix+'" aria-label="'+e(fl('Type','النوع'))+'"><option value="prepaid">'+typeLabel('prepaid')+'</option><option value="postpaid">'+typeLabel('postpaid')+'</option><option value="tender">'+typeLabel('tender')+'</option></select>':'')+
            '<button class="btn sm pri" data-v117-decide="belongs" onclick="v117Decide('+ix+',\''+e(l.kind)+'\',\''+encodeURIComponent(key)+'\')">'+fl('Belongs to','تتبع')+'</button>'+
            '<button class="btn sm ghost" data-v117-decide="new" onclick="v117NewCompanyFor('+ix+',\''+e(l.kind)+'\',\''+encodeURIComponent(key)+'\',\''+encodeURIComponent(l.name||'')+'\')">'+fl('New company…','شركة جديدة…')+'</button>'+
            '<button class="btn sm ghost" data-v117-decide="exclude" onclick="v117AddRule(\''+(l.kind==='client_id'?'client_id':'name')+'\',\''+encodeURIComponent(key)+'\')">'+fl('Exclude…','استبعاد…')+'</button></div>'+
            (sug?'<div class="muted" style="font-size:11.5px;margin-top:3px">'+fl('Suggested: ','مقترح: ')+e(sug.name)+' — '+e(sug.why)+' '+fl('(nothing is applied until you press Belongs to)','(لا يُطبَّق شيء حتى تضغط «تتبع»)')+'</div>':'')
           :'<span class="muted">'+fl('someone with Full control on Finance decides','يقرر من لديه «تحكم كامل» على «المالية»')+'</span>')+'</td></tr>'; }))
      :'<div class="muted" style="font-size:12.5px" data-v117-empty="decisions">'+fl('Nothing waits for a decision — every client ID and name in Finance belongs to a company or is excluded.','لا شيء ينتظر قرارًا — كل معرّف واسم في المالية تابع لشركة أو مستبعد.')+'</div>';
    h+='<div style="margin-top:12px;font-size:12.5px" data-v117="unassigned"><b>'+fl('Unassigned codes','رموز غير مخصّصة')+'</b> · '+st.unassigned.n+' '+fl('rows','صف')+' · '+sar(st.unassigned.sar)+
      (Object.keys(st.unassigned.codes).length?' — '+Object.keys(st.unassigned.codes).map(e).join(', '):'')+' <span class="muted">'+fl('(still counted — just not under a company)','(تُحتسب — لكن دون شركة)')+'</span></div>';
    if(false) h+='<div style="margin-top:6px;font-size:12.5px" class="muted">'+st.noId.n+' '+fl('rows carry no client ID or code — they stand under their own name (','صفًا بلا معرّف عميل أو رمز — تظهر باسمها (')+sar(st.noId.sar)+').</div>';
    h+='</div>';
    /* the greyed 'Excluded' list */
    var ex=(typeof window.finExcludedRows==='function')?window.finExcludedRows():[];
    var exSar=ex.reduce(function(a,x){ return a+(Number(x.row.revenue_sar)||0); },0);
    h+='<details class="card v117-excluded" style="padding:14px 18px;opacity:.85"'+(ex.length&&ex.length<=30?' open':'')+'><summary style="cursor:pointer;font-weight:700">'+fl('Excluded','المستبعد')+' · '+active().length+' '+fl('active rule(s)','قاعدة فعّالة')+' · '+ex.length+' '+fl('rows','صف')+' · '+sar(exSar)+' <span class="muted" style="font-weight:400">'+fl('— left out of every total, with the rule that caught each','— خارج كل الإجماليات، مع القاعدة التي التقطت كلًّا منها')+'</span></summary>'+
      (ex.length?'<div style="margin-top:8px;color:#6B7480">'+table([fl('Date','التاريخ'),fl('Invoice / transaction','الفاتورة / العملية'),fl('Client','العميل'),fl('Revenue','الإيراد'),fl('Rule','القاعدة')],ex.slice(0,500).map(function(x){ var r=x.row, m=x.m;
          return '<tr><td style="'+TD+'">'+e(r.invoice_date||'')+'</td><td style="'+TD+'">'+e(r.invoice_no||r.transaction_ref||'')+'</td><td style="'+TD+'">'+e(r.client_group||r.customer_raw_name||'')+(r.payments_client_id?' · #'+e(r.payments_client_id):'')+'</td><td style="'+TD+'">'+sar(r.revenue_sar)+'</td>'+
            '<td style="'+TD+'">'+(m.rule_id?e(kindLabel(m.rule_kind))+': <b>'+e(m.rule_value)+'</b> — '+e(m.rule_reason||''):fl('marked excluded on the row itself: ','مستبعد على الصف نفسه: ')+e(r.exclusion_reason||''))+'</td></tr>'; }))+'</div>'
        :'<div class="muted" style="margin-top:6px;font-size:12.5px">'+fl('Nothing is excluded.','لا يوجد شيء مستبعد.')+'</div>')+'</details>';
    return h;
  }

  /* ---------- who to chase: outstanding per company and age, postpaid first (never added to revenue) ---------- */
  function chaseHtml(){
    var M=(window.FIN&&FIN.m)||{}, rows=(window.FIN&&FIN.rows)||[], by={}, B=['0-30','31-60','61-90','90+'];
    rows.forEach(function(r){ if(r.deleted_at)return; var m=M[r.id]; if(!m||m.excluded||m.open_age_days==null)return; var rem=Number(r.amount_remaining_sar)||0; if(rem<=0)return;
      var d=Number(m.open_age_days)||0, k=d<=30?0:d<=60?1:d<=90?2:3;
      var c=by[m.company_key]=by[m.company_key]||{name:m.company_name,post:m.profile_type==='postpaid',b:[0,0,0,0],t:0}; if(m.profile_type==='postpaid')c.post=true; c.b[k]+=rem; c.t+=rem; });
    var list=Object.keys(by).map(function(k){ return by[k]; }).sort(function(a,b){ return (b.post-a.post)||(b.b[3]-a.b[3])||(b.t-a.t); });
    var tot=[0,0,0,0]; list.forEach(function(c){ c.b.forEach(function(v,i){ tot[i]+=v; }); });
    return '<div class="card v117-chase" style="padding:16px 18px;margin-top:14px"><h3 style="margin:0 0 4px">'+fl('Who to chase','من نتابع للتحصيل')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:10px">'+fl('Outstanding by company and age since the due date (or the invoice date), postpaid clients first. Outstanding is a separate view — never added to revenue.','المستحق حسب الشركة والعمر منذ تاريخ الاستحقاق (أو تاريخ الفاتورة)، والعملاء الآجلون أولًا. المستحق عرض منفصل — لا يُضاف إلى الإيراد أبدًا.')+'</div>'+
      (list.length?table([fl('Company','الشركة'),'0-30','31-60','61-90','90+',fl('Total','الإجمالي')],list.map(function(c){
          return '<tr><td style="'+TD+';font-weight:700">'+e(c.name||'—')+(c.post?' <span class="tag">'+typeLabel('postpaid')+'</span>':'')+'</td>'+c.b.map(function(v,i){ return '<td style="'+TD+(i===3&&v?';color:#B42318;font-weight:700':'')+'">'+(v?sar(v):'—')+'</td>'; }).join('')+'<td style="'+TD+';font-weight:700">'+sar(c.t)+'</td></tr>'; })
          .concat(['<tr style="background:#F6F7F9"><td style="'+TD+';font-weight:700">'+fl('All','الكل')+'</td>'+tot.map(function(v){ return '<td style="'+TD+';font-weight:700">'+sar(v)+'</td>'; }).join('')+'<td style="'+TD+';font-weight:700">'+sar(tot[0]+tot[1]+tot[2]+tot[3])+'</td></tr>']))
        :'<div class="muted" style="font-size:12.5px">'+fl('Nothing outstanding.','لا يوجد مستحق.')+'</div>')+'</div>';
  }

  /* ---------- the import summary: what the rules made of the rows just written, read back from the one view ---------- */
  window.v117ImportSummary=function(invoiceNos){
    var c=client(), out=document.getElementById('finImpOut'); if(!c||!out||!invoiceNos||!invoiceNos.length)return;
    var uniq=Array.from(new Set(invoiceNos)), chunks=[]; for(var i=0;i<uniq.length;i+=150) chunks.push(uniq.slice(i,i+150));
    Promise.all(chunks.map(function(ch){ return c.from('money_rows').select('invoice_no,revenue_sar,integrity_status,business_id,company_name,merge_state,payments_client_id,rule_id,rule_kind,rule_value,rule_reason,counts').in('invoice_no',ch); })).then(function(rs){
      var rows=[]; rs.forEach(function(r){ if(r&&r.data) rows=rows.concat(r.data); });
      var bad=rs.filter(function(r){return r&&r.error;})[0];
      var s={n:0,sar:0,merged:{},rule:{},unpaid:{n:0,sar:0},loose:{}};
      rows.forEach(function(r){ var v=Number(r.revenue_sar)||0;
        if(r.rule_id){ var k=r.rule_id, x=s.rule[k]=s.rule[k]||{n:0,sar:0,label:kindLabel(r.rule_kind)+': '+r.rule_value,why:r.rule_reason}; x.n++; x.sar+=v; return; }
        if(r.integrity_status!=='verified_paid'){ s.unpaid.n++; s.unpaid.sar+=v; return; }
        s.n++; s.sar+=v;
        if(r.merge_state==='merged'){ var m=s.merged[r.company_name]=s.merged[r.company_name]||{n:0,sar:0}; m.n++; m.sar+=v; }
        if(r.merge_state==='not_merged'&&r.payments_client_id){ s.loose[r.payments_client_id]=r.company_name||''; } });
      var li=function(t){ return '<li>'+t+'</li>'; };
      var h='<div class="card v117-import-summary" style="padding:12px 14px;margin-top:10px;font-size:13px"><b>'+fl('What the rules made of this import','ما فعلته القواعد بهذا الاستيراد')+'</b><ul style="margin:6px 0 0;padding-inline-start:18px">'+
        li(fl('Counted: ','يُحتسب: ')+'<b>'+s.n+'</b> '+fl('rows','صف')+' · '+sar(s.sar))+
        (Object.keys(s.merged).length?li(fl('Merged into: ','مدموج في: ')+Object.keys(s.merged).map(function(k){ return e(k)+' ('+s.merged[k].n+' · '+sar(s.merged[k].sar)+')'; }).join('، ')):'')+
        (Object.keys(s.rule).length?li(fl('Left out by a rule: ','تستبعدها قاعدة: ')+Object.keys(s.rule).map(function(k){ var x=s.rule[k]; return e(x.label)+' — '+x.n+' · '+sar(x.sar)+' <span class="muted">('+e(x.why||'')+')</span>'; }).join('؛ ')):li(fl('Left out by a rule: none','تستبعدها قاعدة: لا شيء')))+
        li(fl('Not paid (imported, not counted): ','غير مدفوع (مستورد ولا يُحتسب): ')+s.unpaid.n+' · '+sar(s.unpaid.sar))+
        (Object.keys(s.loose).length?li(fl('New client IDs not merged — review in Finance → Rules: ','معرّفات عملاء غير مدموجة — راجعها في المالية ← القواعد: ')+Object.keys(s.loose).map(function(k){ return '#'+e(k)+(s.loose[k]?' '+e(s.loose[k]):''); }).join('، ')):'')+
        '</ul>'+(bad?'<div style="color:#B42318;margin-top:6px">'+fl('Part of this summary could not be read: ','تعذّرت قراءة جزء من هذا الملخص: ')+e(bad.error.message||bad.error)+'</div>':'')+'</div>';
      if(typeof window.v65AppendDone==='function') window.v65AppendDone(h); else { var box=document.getElementById('finImpOut'); if(box) box.insertAdjacentHTML('beforeend',h); }
    });
  };
  /* js/62's exclusion and alias editors are retired — their buttons now open this screen */
  window.v62AddExclusion=function(){ window.finLinkMap(); };
  window.v62OpenAddGrouping=function(){ window.finLinkMap(); };
  window.v62OpenGrouping=function(){ window.finLinkMap(); };

  /* ---------- the tab, the chase card and the old link window ---------- */
  function markTab(){
    try{
      var view=document.getElementById('view'); if(!view)return;
      var bar=view.querySelector('div'); if(!bar)return;
      var btns=[].slice.call(bar.querySelectorAll('button'));
      if(!btns.length||!/finGo/.test(btns[0].getAttribute('onclick')||''))return;
      var mine=btns.find(function(b){return /finGo\('rules'\)/.test(b.getAttribute('onclick')||'');});
      if(!mine){ mine=document.createElement('button'); mine.className='btn sm ghost'; mine.setAttribute('onclick',"finGo('rules')"); mine.textContent=fl('Rules','القواعد'); mine.style.cssText='white-space:nowrap;flex:0 0 auto';
        var impBtn=btns.find(function(b){return /finGo\('import'\)/.test(b.getAttribute('onclick')||'');}); var box=btns[0].parentNode; box.insertBefore(mine,(impBtn&&impBtn.parentNode===box)?impBtn:null); }
      if(FIN.tab==='rules') btns.concat([mine]).forEach(function(b){ b.className='btn sm '+(/finGo\('rules'\)/.test(b.getAttribute('onclick')||'')?'pri':'ghost'); });
    }catch(_){}
  }
  var _rf=window.renderFinance;
  if(typeof _rf==='function') window.renderFinance=function(v){
    _rf.apply(this,arguments);
    try{
      if(typeof FIN==='undefined')return;
      if(MR.rules==null&&!MR.loading) load();
      var view=document.getElementById('view'); if(!view)return;
      if(FIN.tab==='rules'){
        var bar=view.firstElementChild; view.innerHTML=''; if(bar)view.appendChild(bar);
        view.insertAdjacentHTML('beforeend',(MR.rules==null||FIN.rows==null)?'<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+fl('Loading…','جاري التحميل…')+'</div>':body());
      } else if(FIN.tab==='clients'&&FIN.rows&&!view.querySelector('.v117-chase')){
        view.insertAdjacentHTML('beforeend',chaseHtml());
      }
      if(FIN.rows&&FIN.mErr&&FIN.tab!=='rules'&&!view.querySelector('.v117-nomoney')){
        var bar2=view.firstElementChild; if(bar2) bar2.insertAdjacentHTML('afterend','<div class="card v117-nomoney" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid #D92D20;color:#B42318">'+fl('The exclusion rules could not be applied, so no money is shown — a total that ignored them would be wrong. Reload the page; if it stays, tell an admin.','تعذّر تطبيق قواعد الاستبعاد، لذا لا تُعرض أي مبالغ — فالإجمالي الذي يتجاهلها خاطئ. أعد تحميل الصفحة؛ وإن استمر، أبلغ المسؤول.')+'</div>');
      }
      markTab();
    }catch(err){ if(window.console)console.warn('[v117] render',err); }
  };
  /* the old "link finance to clients by name" window is retired: merging is typed here */
  window.finLinkMap=function(){ try{ current='finance'; FIN.tab='rules'; if(typeof render==='function')render(); }catch(_){} };
  try{ setTimeout(function(){ var b=document.getElementById('v53btn'); if(b) b.remove(); },1500); }catch(_){}

  console.info('%c[v117] Finance → Rules (exclusion rules + company merges) loaded','color:#F06820;font-weight:700');
}catch(e){if(window.console)console.warn('[v117] init',e);}})();
