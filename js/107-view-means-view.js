/* ===== js/107 — View means view: a page someone may only look at shows no way to change it
   (Phase 1, 2026-09-25) =====

   Since Phase 1b the DATABASE refuses every change from someone on View. But fourteen pages still
   OFFERED the change — a button, a stage picker, an editable form — which then failed on the server
   or, worse, looked saved on screen until the next reload. js/56 marked those pages "buttons still
   show". This layer closes that, for every one of them, from ONE answer: window.mayEditPage(page)
   (js/52), which is the database's page_level() as my_page_levels() handed it over. This file keeps
   no rule of its own about who may do what (M57). Admins are untouched. While the levels are still
   loading mayEditPage answers "no" (it fails closed), so the page shows read-only for that moment and
   js/56 re-draws it when the answer arrives.

   Three layers, each covering what the one before might miss:
     1. HIDE — on a view-only page, #view carries data-v107-ro and CSS hides every button that calls
        a changing function (by the function's name in its onclick, so it holds after every re-draw),
        the file drop zones and bulk-selection boxes; fields that write on change are disabled.
     2. READ-ONLY FORMS — the shared editor (openModal, js/core-05) opened on a view-only page shows
        the record with every field disabled, no Save and no Delete, and says why. So a person on View
        can still OPEN a request, supplier, SOP or company to read it.
     3. REFUSE — every changing function itself is wrapped: called for a page the person may only
        view, it does nothing and says so in words. That covers keyboard use, buttons wired without an
        onclick, and anything layer 1 did not name. It never decides by itself: it asks mayEditPage.

   Which page a function belongs to: a company's page follows the record (a client → Clients, else
   Leads); a supplier's follows the screen (Airlines / Suppliers); the rest are fixed below. A page
   not in this list is left exactly as it was.
   Guarded by scripts/qa/probe-view-means-view.mjs. Removing this file puts the buttons back and
   changes nothing else; the database still refuses either way. */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  /* 2026-09-26 (Phase 3 release 2): a page that knows whose work is whose lets someone on Own work make changes —
     to their OWN records; the database refuses anyone else's (Reports: report_entries' row rules, the credit
     guard). For those pages Own opens the controls; every other page stays "Full control or nothing" (js/52). */
  var OWN_WORKS={reports:1};
  function may(page){ try{
    if(OWN_WORKS[page] && typeof window.pageLevel==='function' && window.pageLevel(page)==='own') return true;
    return typeof window.mayEditPage==='function' ? !!window.mayEditPage(page) : false; }catch(_){ return false; } }
  var NAMES={leads:['Leads','العملاء المحتملون'],clients:['Clients','العملاء'],offers:['Proposals','العروض'],ops:['Operations','العمليات'],
    events:['Events','الفعاليات'],airlines:['Airlines','شركات الطيران'],vendors:['Suppliers','المورّدون'],sopsla:['SOP & SLA','الإجراءات'],
    projects:['Projects','المشاريع'],bookings:['Bookings','الحجوزات'],invoices:['Invoices','الفواتير'],tickets:['Tickets','التذاكر'],
    sync:['Sync & Integrations','المزامنة والتكاملات'],reports:['Reports','التقارير']};
  var COVERED=Object.keys(NAMES);
  function pname(p){ var n=NAMES[p]; return n?fl(n[0],n[1]):p; }

  /* ---------- which page is on screen ---------- */
  function leadPage(id){
    try{ var b=(typeof getLead==='function')?getLead(id):null; if(b) return b.isClient?'clients':'leads'; }catch(_){}
    return null;
  }
  function screenPage(){
    try{
      if(typeof current==='undefined') return null;
      if(current==='leads' && typeof openLead!=='undefined' && openLead) return leadPage(openLead)||'leads';
      if(current==='reference') return null;
      return current;
    }catch(_){ return null; }
  }
  function roHere(){ var p=screenPage(); return !!p && COVERED.indexOf(p)>=0 && !may(p); }

  /* ---------- 3. the changing functions, and the page each one changes ---------- */
  var BYREC='@record', HERE='@screen';
  var FN={
    /* companies — the page follows the record */
    editBusiness:BYREC, leadQuickEdit:BYREC, setLeadStage:BYREC, convertToClient:BYREC, logActivity:BYREC,
    v33CycleFit:BYREC, v41AddContact:BYREC, v41AddLink:BYREC, editCorporate:BYREC, v40Touch:BYREC, v40Hold:BYREC,
    v40AddComment:BYREC, v34AddProfile:BYREC, v24OpenChainOfCommand:BYREC, v22OpenClientOnboarding:BYREC,
    __editFunnelDetails:BYREC, __clientHandover:BYREC, leadBulkAssign:'leads', leadBulkStage:'leads',
    leadSelAll:'leads', leadSelToggle:'leads',   /* the tick boxes that feed the bulk actions */
    /* proposals */
    newOffer:'offers', offerFromLead:'offers', v55NewProposal:'offers', o_set:'offers', o_setClient:'offers', o_loadClient:'offers',
    o_uploadFile:'offers', o_addOption:'offers', o_calc:'offers', o_del:'offers', o_logToLead:'offers', v22SendForReview:'offers',
    o_promoteProject:'projects',
    /* operations */
    newRequestForLead:'ops', editRequest:'ops', advanceReq:'ops',
    /* bookings, tickets, invoices */
    bookingFromOffer:'bookings', v20IssueTicket:'bookings', v20VoidBooking:'bookings', v20InvoiceFromBooking:'invoices',
    v20MarkPaid:'invoices', v20Refund:'invoices', invToggleSel:'invoices', invBulkAction:'invoices',
    /* events */
    evOpenModal:'events', evDelete:'events',
    /* airlines / suppliers — the page follows the screen */
    editSupplier:HERE, airQuickEdit:'airlines', setNdc:HERE, setNdcNotes:HERE, setCap:HERE, supSelectAll:HERE,
    /* SOP & SLA, projects, reports */
    editSop:'sopsla', v25NewProject:'projects', v25OpenProjectProposalGen:'projects', rptOpenAch:'reports', rptDelAch:'reports', v111Finalize:'reports', v111MoveBrowser:'reports'
  };
  /* opening one of these WITH a record id only shows the record (through openModal, made read-only
     below); without an id it creates one. */
  var OPENERS={editRequest:1, editSupplier:1, editSop:1, editBusiness:1};
  function openerId(name,args){ return name==='editSupplier' ? args[1] : args[0]; }
  function pageFor(name,args){
    var t=FN[name];
    if(t===BYREC){
      for(var i=0;i<args.length;i++){ var p=(typeof args[i]==='string')?leadPage(args[i]):null; if(p) return p; }
      var s=screenPage(); return (s==='clients'||s==='leads')?s:'leads';
    }
    if(t===HERE){ var h=screenPage(); return (h==='airlines'||h==='vendors')?h:(name==='editSupplier'&&args[0]==='air'?'airlines':'vendors'); }
    return t;
  }
  /* the role guard's word for each page (js/49 PAGE_OF, the other way round) */
  var ROLE_WHAT={leads:'leads',clients:'leads',offers:'proposals',projects:'proposals',ops:'requests'};
  function refuse(page){
    /* when the ROLE itself may not (a 'viewer' account) or this is a share link, js/49's box says the
       truer reason — hand it over, so a person never gets two different messages for one refusal */
    try{
      var what=ROLE_WHAT[page]||'leads';
      if(typeof window.__v73Refuse==='function' &&
         (window.__isShareView || (typeof window.__v73Can==='function' && ROLE_WHAT[page] && !window.__v73Can(what)))){
        window.__v73Refuse(what); return;
      }
    }catch(_){}
    var m=fl('You can view '+pname(page)+' but not change it. Ask an admin or your manager for Full control.',
             'يمكنك مشاهدة «'+pname(page)+'» دون تعديلها. اطلب «تحكم كامل» من المدير أو المشرف.');
    try{ if(typeof window.toast==='function'){ window.toast(m); return; } }catch(_){}
    try{ alert(m); }catch(_){}
  }
  var roModalPage=null;       /* set while an opener shows a record read-only */
  function wrap(name){
    try{
      var f=window[name];
      if(typeof f!=='function' || f.__v107) return false;
      var w=function(){
        var args=[].slice.call(arguments), page=pageFor(name,args);
        if(!page || may(page)) return f.apply(this,args);
        if(OPENERS[name] && openerId(name,args)){
          roModalPage=page;
          try{ return f.apply(this,args); } finally { roModalPage=null; }
        }
        refuse(page);
        return undefined;
      };
      w.__v107=1; w.__v107orig=f;
      window[name]=w;
      return true;
    }catch(_){ return false; }
  }
  function wrapAll(){ Object.keys(FN).forEach(wrap); }

  /* ---------- 2. the shared editor, read-only ---------- */
  function wrapModal(){
    try{
      var f=window.openModal;
      if(typeof f!=='function' || f.__v107) return;
      var w=function(title,body,onSave,onDelete){
        var page=roModalPage || (roHere()?screenPage():null);
        if(!page){ try{ var mm=document.getElementById('modal'); if(mm) mm.removeAttribute('data-v107-ro'); }catch(_){} return f.apply(this,arguments); }
        var out=f.call(this,title,body,function(){ refuse(page); return false; },null);
        try{
          var m=document.getElementById('modal');
          var sv=document.getElementById('mSave'); if(sv) sv.style.display='none';
          var dl=document.getElementById('mDel'); if(dl) dl.style.display='none';
          if(m){
            m.setAttribute('data-v107-ro','1');
            m.querySelectorAll('.mb input,.mb select,.mb textarea').forEach(function(el){ el.disabled=true; });
            var mb=m.querySelector('.mb');
            if(mb && !mb.querySelector('.v107-note')){
              var n=document.createElement('div'); n.className='v107-note note';
              n.textContent=fl('View only — you can read this record; changing it needs Full control on '+pname(page)+'.',
                               'مشاهدة فقط — يمكنك قراءة هذا السجل؛ تعديله يحتاج «تحكم كامل» على «'+pname(page)+'».');
              mb.insertBefore(n, mb.firstChild);
            }
          }
        }catch(_){}
        return out;
      };
      w.__v107=1; w.__v107orig=f;
      window.openModal=w;
    }catch(_){}
  }

  /* ---------- 1. hide on screen ---------- */
  function css(){
    if(document.getElementById('v107-css')) return;
    var sel=[];
    Object.keys(FN).forEach(function(n){
      sel.push('#view[data-v107-ro] button[onclick*="'+n+'("]');
      sel.push('#view[data-v107-ro] a.btn[onclick*="'+n+'("]');
      sel.push('#view[data-v107-ro] input[onclick*="'+n+'("]');
      sel.push('#view[data-v107-ro] input[onchange*="'+n+'("]');
    });
    sel.push('#view[data-v107-ro] .dropzone','#view[data-v107-ro] .lchk','#view[data-v107-ro] .supchk',
             '#view[data-v107-ro] input[onchange*="invBulkSel"]','#view[data-v107-ro] .bulk-bar',
             '#view[data-v107-ro] .v24ChainBtn','#view[data-v107-ro] .v22InvSend',
             '#view[data-v107-ro] button[onclick*="ingestModal("]','#view[data-v107-ro] button[onclick*=".prefs="]',
             '#view[data-v107-ro] button[onclick*="lead.activities"]','#view[data-v107-ro] #v40cmt',
             '#view[data-v107-ro] #v19act_type','#view[data-v107-ro] #v19act_note');
    var st=document.createElement('style'); st.id='v107-css';
    st.textContent=sel.join(',\n')+'{display:none!important}\n'+
      '#modal[data-v107-ro] #mSave,#modal[data-v107-ro] #mDel{display:none!important}\n'+
      '#view[data-v107-ro] input:disabled,#view[data-v107-ro] select:disabled,#view[data-v107-ro] textarea:disabled,#modal[data-v107-ro] .mb input:disabled,#modal[data-v107-ro] .mb select:disabled,#modal[data-v107-ro] .mb textarea:disabled{background:#F7F2EE!important;color:var(--muted,#827164)!important;cursor:not-allowed!important}\n'+
      '.v107-banner{background:#FFF8E8;border:1px solid #FBAE16;color:#6B4E00;border-radius:10px;padding:8px 12px;margin:0 0 12px;font-size:12.5px;line-height:1.6}';
    document.head.appendChild(st);
  }
  var WRITE_FIELD=/\b(o_set|o_setClient|o_loadClient|o_uploadFile|setLeadStage|setNdc|setNdcNotes|setCap)\(/;
  function mark(){
    try{
      var view=document.getElementById('view'); if(!view) return;
      var ro=roHere(), page=screenPage();
      if(!ro){
        if(view.hasAttribute('data-v107-ro')){ view.removeAttribute('data-v107-ro'); var ob=view.querySelector('.v107-banner'); if(ob) ob.remove(); }
        return;
      }
      view.setAttribute('data-v107-ro','1');
      view.querySelectorAll('input,select,textarea').forEach(function(el){
        var h=(el.getAttribute('onchange')||'')+' '+(el.getAttribute('oninput')||'')+' '+(el.getAttribute('onclick')||'');
        if(WRITE_FIELD.test(h)) el.disabled=true;
      });
      if(!view.querySelector('.v107-banner')){
        var b=document.createElement('div'); b.className='v107-banner'; b.setAttribute('dir',isAr()?'rtl':'ltr');
        b.textContent=fl('View only — you can look through '+pname(page)+' and export it; changes need Full control.',
                         'مشاهدة فقط — يمكنك تصفّح «'+pname(page)+'» وتصديرها؛ التعديل يحتاج «تحكم كامل».');
        view.insertBefore(b, view.firstChild);
      }
    }catch(e){ if(window.console)console.warn('[v107] mark',e); }
  }
  function modalReset(){
    try{ var m=document.getElementById('modal'); if(m && !roModalPage && !roHere()) m.removeAttribute('data-v107-ro'); }catch(_){}
  }

  css(); wrapAll(); wrapModal();
  if(typeof render==='function'){
    var _r=render;
    window.render=function(){
      var out=_r.apply(this,arguments);
      try{ wrapAll(); wrapModal(); modalReset(); mark(); setTimeout(mark,60); setTimeout(mark,400); }catch(_){}
      return out;
    };
  }
  /* layers that define their functions after this one, and the levels arriving after sign-in */
  var n=0, iv=setInterval(function(){ n++; wrapAll(); wrapModal(); mark(); if(n>40) clearInterval(iv); },1500);
  try{ window.__v107Probe={ pageFor:pageFor, roHere:roHere, covered:COVERED.slice(), fns:Object.keys(FN) }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v107] init',e); }})();
