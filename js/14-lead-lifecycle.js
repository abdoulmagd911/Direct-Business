/* ===== Lead lifecycle engine + Your Day — one chapter, one file (Leads sitting L3) =====

   The heart of the Leads feature, deliberately merged LAST and alone:
     part 1 (was js/14-v40)  the full lifecycle: canEdit (who may change things), the
                              setLeadStage wrap, quick touches, the hold strip, and the
                              first __clientHandover (later replaced by the won-handover
                              chapter — that replacement order is load-bearing)
     part 2 (was js/34-v57)  the Your-Day card at the top of Today

   Anchored at slot 14 — forced: part 1 declares canEdit and slot 15 declares it again on
   top (15's must win, so 14 stays first), and part 1's setLeadStage/__clientHandover must
   keep loading before the won-handover chapter at 27 that wraps and replaces them.
   Part 2 moved up from slot 34; it only decorates the Today page, reads (never writes)
   the shared esc helper, and does its own Arabic — proven by the Today fingerprint in
   both languages. Verbatim, each part keeps its own try/catch.                          */

/* ---------- part 1 — the lead lifecycle engine (was js/14-v40) ---------- */
/* ===== v40 layer: full lead lifecycle — quick touches, comments, on-hold, client handover ===== */
(function(){try{
function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar';}catch(_){return false;}}
function canEdit(){return !window.__isShareView && window.__userTier!=='viewer';}
function esc4(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function meName(){try{return (typeof me==='function'?me():'')||'Team';}catch(_){return 'Team';}}

/* ---------- 1. Quick-touch logging: one tap per channel, with due date ---------- */
window.v40Touch=function(id,type){
  var b=getLead(id); if(!b||!canEdit())return;
  var ar=isAr();
  openModal((ar?'تسجيل ':'Log ')+type+' — '+esc4(b.name),
    '<div class="field"><label>'+(ar?'ماذا حدث؟':'What happened?')+'</label><textarea id="t_note" rows="3"></textarea></div>'+
    '<div class="grid2"><div class="field"><label>'+(ar?'الإجراء التالي':'Next action')+'</label><input id="t_next" value="'+esc4(b.nextAction||'')+'"></div>'+
    '<div class="field"><label>'+(ar?'موعده':'Due date')+'</label><input id="t_due" type="date" value="'+esc4(b.dueDate||'')+'"></div></div>',
    function(){
      b.activities=b.activities||[];
      b.activities.push({date:Date.now(),type:type,status:'',note:val('t_note'),by:meName()});
      b.lastContact=Date.now();
      var nx=val('t_next'); if(nx)b.nextAction=nx;
      var du=val('t_due'); if(du)b.dueDate=du;
      save();render();
    });
};

/* ---------- 2. Comments thread ---------- */
window.v40AddComment=function(id){
  var b=getLead(id); if(!b||!canEdit())return;
  var inp=document.getElementById('v40cmt'); if(!inp||!inp.value.trim())return;
  b.comments=b.comments||[];
  b.comments.push({ts:Date.now(),by:meName(),text:inp.value.trim()});
  save();render();
};

/* ---------- 3. On hold / resume ---------- */
window.v40Hold=function(id){
  var b=getLead(id); if(!b||!canEdit())return;
  var ar=isAr();
  if(b.onHold){
    if(!confirm(ar?'استئناف العمل على هذه الفرصة؟':'Resume working this lead?'))return;
    b.activities=b.activities||[];
    b.activities.push({date:Date.now(),type:ar?'استئناف':'Resumed',status:'',note:'',by:meName()});
    b.onHold=null; save();render(); return;
  }
  openModal((ar?'إيقاف مؤقت — ':'Put on hold — ')+esc4(b.name),
    '<div class="field"><label>'+(ar?'السبب':'Reason')+'</label><input id="h_reason"></div>'+
    '<div class="field"><label>'+(ar?'تاريخ المتابعة':'Resume / follow-up date')+'</label><input id="h_until" type="date"></div>',
    function(){
      b.onHold={reason:val('h_reason'),until:val('h_until'),ts:Date.now(),by:meName()};
      b.activities=b.activities||[];
      b.activities.push({date:Date.now(),type:isAr()?'إيقاف مؤقت':'On hold',status:'',note:val('h_reason')+(val('h_until')?(' → '+val('h_until')):''),by:meName()});
      save();render();
    });
};

/* clearing hold automatically when the stage moves */
try{ if(typeof setLeadStage==='function'&&!window.__v40stage){
  var _sls=setLeadStage;
  window.setLeadStage=function(id,s){ try{var b=getLead(id); if(b&&b.onHold)b.onHold=null;}catch(_){}
    return _sls.apply(this,arguments); };
  window.__v40stage=true;
}}catch(_){}

/* ---------- 4. Won → client handover ---------- */
try{ if(typeof convertToClient==='function'&&!window.__v40conv){
  var _cv=convertToClient;
  window.__clientHandover=function(id){
    try{
      var b=getLead(id);
      if(b){
        var ar=isAr();
        var _selHtml=function(id,cur,opts){return '<select id="'+id+'"><option value=""></option>'+opts.map(function(t){return '<option value="'+esc4(t[0])+'"'+(cur===t[0]?' selected':'')+'>'+esc4(ar?t[1]:t[0])+'</option>';}).join('')+'</select>';};
        var CT=[['Government','جهة حكومية'],['Semi Government','شبه حكومية'],['Big Company','شركة كبيرة'],['Medium Company','شركة متوسطة'],['Small Company','شركة صغيرة'],['Listed Company','شركة مدرجة'],['PIF company','شركة تابعة لصندوق الاستثمارات'],['Travel Partner','شريك سفر'],['Individual','فرد']];
        var PM=[['Pre-paid','مسبق الدفع'],['Post-paid','آجل'],['Tender','مناقصة']];
        var BC=[['Manual','يدوي'],['Monthly','شهري'],['Weekly','أسبوعي'],['N/A','غير محدد']];
        var AGR=[['Active','سارية'],['Draft','مسودة'],['Pending','قيد الإعداد'],['None','لا يوجد']];
        openModal((ar?'تسليم العميل الجديد — ':'New client handover — ')+esc4(b.name),
          '<div class="ch-sub">'+(ar?'أكمل البيانات المطلوبة لإنشاء العميل في نظام دايركت.':'Complete the data Direct needs to create this client.')+'</div>'+
          '<div class="field"><label>'+(ar?'معرّف العميل في دايركت':'Direct client ID')+' <span style="color:var(--muted);font-weight:400;font-size:11px">'+(ar?'— يربط الفواتير والمالية':'— links invoices & finance')+'</span></label><input id="c_did" value="'+esc4(b.directClientId||'')+'" placeholder="'+(ar?'مثال: 95':'e.g. 95')+'"></div>'+
          '<div class="grid2"><div class="field"><label>'+(ar?'الاسم النظامي':'Legal name')+'</label><input id="c_ln" value="'+esc4(b.legalName||b.name||'')+'"></div>'+
          '<div class="field"><label>'+(ar?'نوع العميل':'Customer type')+'</label>'+_selHtml('c_ct',(b.customerType||b.entityType||''),CT)+'</div></div>'+
          '<div class="grid2"><div class="field"><label>'+(ar?'طريقة الدفع':'Payment mode')+'</label>'+_selHtml('c_pm',(b.paymentMode||''),PM)+'</div>'+
          '<div class="field"><label>'+(ar?'دورة الفوترة':'Billing cycle')+'</label>'+_selHtml('c_bc',(b.billingCycle||''),BC)+'</div></div>'+
          '<div class="grid2"><div class="field"><label>'+(ar?'السجل التجاري / الرقم الضريبي':'CR / VAT')+'</label><input id="c_crv" value="'+esc4(b.crVat||b.vatNumber||'')+'"></div>'+
          '<div class="field"><label>'+(ar?'حد الائتمان (ريال)':'Credit limit (SAR)')+'</label><input id="c_cl" type="number" value="'+esc4(b.creditLimit!=null?b.creditLimit:'')+'"></div></div>'+
          '<div class="grid2"><div class="field"><label>'+(ar?'حالة الاتفاقية':'Agreement status')+'</label>'+_selHtml('c_agr',(b.agreementStatus||''),AGR)+'</div>'+
          '<div class="field"><label>'+(ar?'مدير الحساب':'Account manager')+'</label><input id="c_am" value="'+esc4(b.accountManager||b.assignedTo||meName())+'"></div></div>'+
          '<div class="grid2"><div class="field"><label>'+(ar?'جهة الاتصال الرئيسية':'Point of contact')+'</label><input id="c_poc" value="'+esc4(b.pocName||'')+'" placeholder="'+(ar?'الاسم · الصفة':'Name · role')+'"></div>'+
          '<div class="field"><label>'+(ar?'نطاق التعاقد':'Contract scope')+'</label><input id="c_sc" value="'+esc4(b.contractScope||'')+'" placeholder="'+(ar?'طيران، فنادق، تأشيرات…':'Air, hotel, visa…')+'"></div></div>'+
          '<div class="field"><label>'+(ar?'سبب الفوز':'Win reason')+'</label><input id="c_wr" value="'+esc4(b.winReason||'')+'"></div>',
          function(){
            b.directClientId=(val('c_did')||'').trim(); b.legalName=val('c_ln'); b.customerType=val('c_ct');
            b.paymentMode=val('c_pm'); b.billingCycle=val('c_bc');
            b.paymentTerms=[val('c_pm'),val('c_bc')].filter(Boolean).join(' · ');
            b.crVat=val('c_crv'); var _cl=val('c_cl'); b.creditLimit=(_cl===''||_cl==null)?null:Number(_cl);
            b.agreementStatus=val('c_agr'); b.accountManager=val('c_am');
            b.pocName=val('c_poc'); b.contractScope=val('c_sc'); b.winReason=val('c_wr');
            b.activities=b.activities||[];
            b.activities.push({date:Date.now(),type:isAr()?'تسليم عميل':'Client handover',status:'',note:(b.directClientId?('Direct #'+b.directClientId):(b.accountManager?('AM: '+b.accountManager):'')),by:meName()});
            save();render();
          });
      }
    }catch(_){}
  };
  window.convertToClient=function(id){
    var before=(getLead(id)||{}).isClient;
    _cv.apply(this,arguments);
    try{ var b=getLead(id); if(b&&b.isClient&&!before)window.__clientHandover(id); }catch(_){}
  };
  window.__v40conv=true;
}}catch(_){}

/* ---------- 5. inject the new panels into the lead detail screen ---------- */
function inject(){
  try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(typeof openLead==='undefined'||!openLead)return;
    if(document.getElementById('v40panels'))return;
    var b=getLead(openLead); if(!b)return;
    var grid=document.querySelector('#view .detail-grid'); if(!grid)return;
    var left=grid.firstElementChild; if(!left)return;
    var ar=isAr(), ce=canEdit();
    var wrap=document.createElement('div'); wrap.id='v40panels';

    /* quick-touch bar */
    if(ce){
      var qt=document.createElement('div'); qt.className='card'; qt.style.marginTop='14px';
      qt.innerHTML='<h3>'+(ar?'تسجيل تواصل سريع':'Quick touch')+'</h3><div class="ch-sub">'+(ar?'سجّل بضغطة: ماذا حدث وما الخطوة التالية.':'One tap: what happened + the next step.')+'</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+
        [['📞',(ar?'مكالمة':'Call')],['💬','WhatsApp'],['✉️',(ar?'بريد':'Email')],['🤝',(ar?'اجتماع':'Meeting')],['📝',(ar?'ملاحظة':'Note')]].map(function(t){
          return '<button class="btn sm" onclick="v40Touch(\''+b.id+'\',\''+t[1]+'\')">'+t[0]+' '+t[1]+'</button>';
        }).join('')+
        '<button class="btn sm" style="border-color:#F79009;color:#B54708" onclick="v40Hold(\''+b.id+'\')">'+(b.onHold?(ar?'▶ استئناف':'▶ Resume'):(ar?'⏸ إيقاف مؤقت':'⏸ Put on hold'))+'</button>'+
        '</div>'+
        (b.onHold?'<div style="margin-top:9px;background:#FFF6E8;border:1px solid #F2C185;border-radius:8px;padding:8px 11px;font-size:12px;color:#7A4B12">⏸ '+(ar?'موقوفة مؤقتاً':'On hold')+(b.onHold.reason?': '+esc4(b.onHold.reason):'')+(b.onHold.until?' · '+(ar?'متابعة':'resume')+' '+esc4(b.onHold.until):'')+' · '+esc4(b.onHold.by||'')+'</div>':'');
      wrap.appendChild(qt);
    }

    /* comments thread */
    var cm=document.createElement('div'); cm.className='card'; cm.style.marginTop='14px';
    var list=(b.comments||[]).slice().sort(function(x,y){return y.ts-x.ts;});
    cm.innerHTML='<h3>'+(ar?'التعليقات':'Comments')+'</h3><div class="ch-sub">'+(ar?'نقاش الفريق حول هذه الفرصة — منفصل عن سجل العمل الرسمي.':'Team discussion on this lead — separate from the formal work log.')+'</div>'+
      (list.length?list.map(function(c){
        return '<div style="border-top:1px solid #eef0f5;padding:8px 0"><div style="font-size:11px;color:var(--muted)">'+esc4(c.by||'')+' · '+(typeof fmtDate==='function'?fmtDate(c.ts):new Date(c.ts).toLocaleString())+'</div><div style="font-size:13px;white-space:pre-wrap">'+esc4(c.text)+'</div></div>';
      }).join(''):'<div class="empty">'+(ar?'لا توجد تعليقات بعد.':'No comments yet.')+'</div>')+
      (ce?'<div style="display:flex;gap:6px;margin-top:10px"><input id="v40cmt" placeholder="'+(ar?'اكتب تعليقاً…':'Write a comment…')+'" style="flex:1;padding:8px 10px;border:1px solid var(--line-2,#e3dccf);border-radius:9px;font:inherit;font-size:13px"><button class="btn pri sm" onclick="v40AddComment(\''+b.id+'\')">'+(ar?'إضافة':'Add')+'</button></div>':'');
    wrap.appendChild(cm);
    left.appendChild(wrap);

    var cmtInp=document.getElementById('v40cmt');
    if(cmtInp)cmtInp.addEventListener('keydown',function(e){if(e.key==='Enter')v40AddComment(b.id);});
  }catch(e){console.warn('v40 inject',e);}
}
try{ var _r=window.render; window.render=function(){var o=_r.apply(this,arguments); try{inject();}catch(_){} return o;}; }catch(_){}
setInterval(inject,1500);

/* ---------- 6. overdue holds join the attention logic ---------- */
function holdStrip(){
  try{
    if(typeof current==='undefined'||current!=='leads'||window.__isShareView)return;
    var v=document.getElementById('view'); if(!v)return;
    var old=document.getElementById('v40holds'); if(old)old.remove();
    var today=new Date().toISOString().slice(0,10);
    var due=((DB&&DB.businesses)||[]).filter(function(b){return b.onHold&&b.onHold.until&&b.onHold.until<=today;});
    if(!due.length)return;
    var ar=isAr();
    var d=document.createElement('div'); d.id='v40holds';
    d.style.cssText='background:#FDECEC;border:1px solid #E8A0A0;border-radius:10px;padding:9px 14px;margin-bottom:12px;font-size:12.5px;color:#8A2020'+(ar?';direction:rtl':'');
    d.innerHTML='⏰ '+(ar?('<b>'+due.length+'</b> فرصة موقوفة حان موعد متابعتها: '):('<b>'+due.length+'</b> on-hold lead'+(due.length>1?'s':'')+' due for follow-up: '))+due.slice(0,6).map(function(b){return esc4(b.name);}).join(' · ');
    var strip=document.getElementById('v39strip');
    if(strip)strip.parentNode.insertBefore(d,strip.nextSibling); else v.insertBefore(d,v.firstChild);
  }catch(_){}
}
setInterval(holdStrip,2500);

console.info('%c[v40 lead lifecycle] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v40 layer failed',e);}})();

/* ---------- part 2 — the Your-Day card on Today (was js/34-v57) ---------- */
/* v57 — "Your day": a rep-focused card at the top of Today that tells the signed-in user
      exactly what to act on — their follow-ups due, leads going cold, proposals expiring,
      and client reviews due. Built on ownership (owner === meName()). Self-contained. */
(function(){try{
  function ar(){return (typeof LANG!=='undefined'&&LANG==='ar');}
  function today(){return new Date().toISOString().slice(0,10);}
  function meN(){return (window.meName?meName():'');}
  /* Owner match: use the same alias-aware comparison the Leads/Clients/Proposals "Mine"
     filters use (js/43 sameOwner), so a rep's own record counts here whatever spelling of
     their name is stored on it — a nickname, an Arabic spelling, "Abdel/Abdul Rahman". A
     strict === here silently dropped the rep's own overdue leads from their Your-day card
     while the Mine filter still found them (2026-09-02 CRM audit). Falls back to === when the
     alias layer is absent (the harness without a roster, an old cache). */
  function isMine(owner,me){return window.sameOwner?sameOwner(owner,me):((owner||'')===(me||''));}
  function ownLead(b){return (b.assignedTo||b.owner||'');}
  function ownCli(b){return (b.accountManager||b.assignedTo||b.owner||'');}
  function lastTouch(b){var la=(b.activities||[]).slice().sort(function(x,y){return (y.date||0)-(x.date||0);})[0];return b.lastContact||(la&&la.date)||0;}
  function closedLead(b){var s=(typeof leadStage==='function')?leadStage(b):(b.stage||'');return s==='Won'||s==='Lost';}

  function buildYourDay(){
    var me=meN(); if(!me) return null;
    var B=(typeof DB!=='undefined'&&DB.businesses)?DB.businesses:[];
    var O=(typeof DB!=='undefined'&&DB.offers)?DB.offers:[];
    var td=today(), nowMs=Date.now();
    var mineLeads=B.filter(function(b){return !b.isClient && isMine(ownLead(b),me);});
    var mineClients=B.filter(function(b){return b.isClient && isMine(ownCli(b),me);});
    var mineOffers=O.filter(function(o){return isMine(o.owner,me);});

    // 1) Follow-ups due (a next-action date on/at-or-before today), active leads
    var due=mineLeads.filter(function(b){return !closedLead(b) && b.nextActionDate && String(b.nextActionDate).slice(0,10)<=td;})
      .sort(function(a,b){return String(a.nextActionDate).localeCompare(String(b.nextActionDate));});
    var dueIds={}; due.forEach(function(b){dueIds[b.id]=1;});
    // 2) Going cold: active leads not touched in 14+ days (or never), not already in "due"
    var cold=mineLeads.filter(function(b){ if(closedLead(b)||dueIds[b.id])return false; var lt=lastTouch(b); var days=lt?Math.floor((nowMs-lt)/864e5):999; return days>=14; })
      .sort(function(a,b){return lastTouch(a)-lastTouch(b);});
    // 3) Proposals expiring within 7 days (and not long-expired), not closed
    var exp=mineOffers.filter(function(o){ if(!o.validUntil)return false; if(/Accepted|Won|Lost|Rejected/i.test(o.status||''))return false; var d=Math.ceil((new Date(o.validUntil).getTime()-nowMs)/864e5); return d<=7 && d>=-14; })
      .sort(function(a,b){return new Date(a.validUntil)-new Date(b.validUntil);});
    // 4) Client reviews due
    var rev=mineClients.filter(function(b){return b.nextReview && String(b.nextReview).slice(0,10)<=td;})
      .sort(function(a,b){return String(a.nextReview).localeCompare(String(b.nextReview));});

    var n=due.length+cold.length+exp.length+rev.length;
    var esc=(typeof window.esc==='function')?window.esc:function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
    function openL(id){return "openLead='"+id+"';current='leads';leadDetailView='detail';render()";}
    function openO(id){return "openOffer='"+id+"';current='offers';render()";}
    function row(cls,ic,ti,meta,vv,click){return '<div class="v19-today-card '+cls+'" onclick="'+click+'"><div class="ic" style="background:rgba(255,255,255,.65)">'+ic+'</div><div class="body"><div class="ti">'+esc(ti)+'</div><div class="meta">'+esc(meta)+'</div></div>'+(vv?'<div class="v">'+esc(vv)+'</div>':'')+'</div>';}

    /* Greet by the name colleagues use. Use the nickname at build time (js/54 nickOf) AND put
       the name in its own <span> so that if the nickname map only finishes loading AFTER this
       card was injected, js/54's whole-cell swap still localizes it on a later paint — the
       header is "Your day — <name>" in one node, which whole-cell matching would otherwise
       never touch. (2026-09-02 CRM audit.) */
    var who='<span class="v57-me">'+esc((window.nickOf?nickOf(me):me)||me)+'</span>';
    var head='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0;font-size:15px;font-weight:800;color:var(--ink)">☀️ '+(ar()?('يومك — '+who):('Your day — '+who))+'</h3>'+
      (n?'<span class="tag" style="background:#FF6B0014;color:#FF6B00;font-weight:800">'+n+'</span>':'<span class="tag" style="background:#E7F8EF;color:#0F6E56;font-weight:700">'+(ar()?'أنجزت كل شيء 🎉':'All caught up 🎉')+'</span>')+'</div>';

    var body='';
    if(due.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:6px 0 6px">'+(ar()?'متابعات مستحقة':'Follow-ups due')+'</h3>';
      due.slice(0,8).forEach(function(b){ var od=String(b.nextActionDate).slice(0,10)<td; body+=row(od?'red':'amber','📞',(window.nmMain?nmMain(b):b.name),(b.nextAction||(ar()?'متابعة':'Follow up'))+' · '+b.nextActionDate,(od?(ar()?'متأخرة':'Overdue'):(ar()?'اليوم':'Due')),openL(b.id)); }); }
    if(cold.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'تبرد — تحتاج تواصل':'Going cold')+'</h3>';
      cold.slice(0,6).forEach(function(b){ var lt=lastTouch(b); var days=lt?Math.floor((nowMs-lt)/864e5):null; body+=row('amber','❄️',(window.nmMain?nmMain(b):b.name),(typeof leadStage==='function'?leadStage(b):(b.stage||''))+' · '+(days===null?(ar()?'لا تواصل بعد':'never contacted'):(days+(ar()?' يوم':'d')+' '+(ar()?'بلا تواصل':'no contact'))),'',openL(b.id)); }); }
    if(exp.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'عروض تنتهي قريبًا':'Proposals expiring')+'</h3>';
      /* Owner ruling 2026-08-21 (docs/DECISIONS.md → "Money belongs to Finance only"): no amounts
         outside Finance. The card names the proposal and the client; the value stays on Finance. */
      exp.slice(0,6).forEach(function(o){ var info=(typeof offerExpiry==='function'?offerExpiry(o):null); body+=row('amber','⏳',(o.ref||'—')+' · '+(o.subject||''),(o.client||''),(info?info.label:''),openO(o.id)); }); }
    if(rev.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'مراجعات عملاء مستحقة':'Client reviews due')+'</h3>';
      rev.slice(0,6).forEach(function(b){ body+=row('blue','🗓️',(window.nmMain?nmMain(b):b.name),(ar()?'مراجعة الحساب':'Account review')+' · '+b.nextReview,'',openL(b.id)); }); }
    if(!n){ body+='<div class="v19-today-card empty">'+(ar()?'لا مهام متأخرة أو مستحقة اليوم لك.':'Nothing overdue or due today for you.')+'</div>'; }

    var wrap=document.createElement('div');
    wrap.className='card v57-yourday'; wrap.style.cssText='padding:16px 18px;margin-bottom:16px;border-inline-start:3px solid #FF6B00';
    wrap.innerHTML=head+body;
    return wrap;
  }

  function inject(){ try{
    if(typeof current==='undefined'||current!=='today') return;
    var v=document.getElementById('view'); if(!v) return;
    if(v.querySelector('.v57-yourday')) return;
    var card=buildYourDay(); if(!card) return;
    var _sh=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_sh)v.insertBefore(card,_sh.nextSibling);else v.insertBefore(card, v.firstChild);
  }catch(_){} }

  if(window.render && !window.render.__v57){ var _r=window.render; window.render=function(){ var o=_r.apply(this,arguments); setTimeout(inject,60); return o; }; window.render.__v57=true; }
  setTimeout(inject,400);
  console.info('%c[v57] Your day (Today) loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v57] init',e);}})();
