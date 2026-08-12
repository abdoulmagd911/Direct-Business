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
