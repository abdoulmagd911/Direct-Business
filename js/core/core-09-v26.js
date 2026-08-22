/* ========================================================================
   V26.1 SIMPLIFY BUNDLE — additive IIFE, non-breaking, layered on v25.2.
   Tracks S1-S7: plain language, friendly Today, (?) tooltips, welcome tour,
   empty states, plain confirms, Settings Daily/Advanced split.
   Generated 2026-06-02. Storage stays v25 — pure UI/copy/CSS layer.
   Rollback = delete this entire IIFE block.
   All non-ASCII written via \u escapes for encoding safety.
   ======================================================================== */
(function v26_1Simplify(){
  if(window.__V26_1_LOADED__)return;
  window.__V26_1_LOADED__=true;

  /* ===== S1: Plain-language sweep (EN + AR) ===== */
  /* Each replacement is [old, new]. Walked on every render via DOM text-walker. */
  var V26_REPL_EN=[
    ['🎫 Push ticket details → Amadeus','🎫 Send ticket info to GDS'],
    ['Push ticket details → Amadeus','Send ticket info to GDS'],
    ['📤 Push draft → Direct Payment','📤 Send invoice to Direct Payments'],
    ['Push draft → Direct Payment','Send invoice to Direct Payments'],
    ['Push draft','Send to Direct Payments'],
    ['↩ Request refund → Direct Payment','↩ Ask Finance to refund'],
    ['Request refund → Direct Payment','Ask Finance to refund'],
    ['Request refund','Ask Finance to refund'],
    ['↩ Mark for void in source','↩ Cancel this in the booking system'],
    ['Mark for void in source','Cancel in the booking system'],
    ['🧪 Run workflow suite','🧪 Run workflow suite (Advanced)'],
    ['🟢 Run v23 scenario suite','🟢 Run scenario suite (Advanced)'],
    ['Run v23 scenario suite','Run scenario suite'],
    ['🔄 Reset for go-live','🧹 Clear test data — keep templates'],
    ['Reset for go-live','Clear test data — keep templates'],
    ['Synced from the Direct system','Live from the Direct system'],
    ['Synced from Direct','Live from Direct'],
    ['Sync health','Connection status'],
    ['Push to ZATCA Fatoora','Submit tax invoice to ZATCA'],
    ['Push to ZATCA','Submit tax invoice to ZATCA'],
    ['Push to Direct','Send to Direct Payments'],
    ['Push draft →','Send to'],
    ['Push →','Send to'],
    ['ZATCA submit','Submit to ZATCA'],
    ['hash chain','tax-record integrity'],
    ['XSS audit','Security check'],
    ['Hash-chain integrity','Tax-record integrity check'],
    ['Run workflow suite','Run workflow tests'],
    ['Run scenario suite','Run scenario tests']
  ];


  /* Arabic mirror — uses \u escapes for encoding safety */
  /* تسليم = "Tasleem" (send/deliver) */
  var V26_REPL_AR=[
    ['تسجيل التذكرة','إرسال بيانات التذكرة للنظام'],
    ['إرسال الفاتورة','إرسال الفاتورة لـ Direct Payments'],
    ['تشغيل اختبارات','تشغيل اختبارات (متقدّم)']
  ];

  /* Glossary for unavoidable technical terms (PNR, ZATCA, GDS, NDC, etc.) */
  var V26_GLOSSARY={
    'GDS':{en:'GDS = the airline booking system (Amadeus, Sabre, etc.)',ar:'نظام حجز الطيران (أماديوس، سيبر، وغيرهما)'},
    'ZATCA':{en:'ZATCA = the Saudi tax authority',ar:'هيئة الزكاة والضريبة السعودية'},
    'PNR':{en:'PNR = the booking reference code from the airline',ar:'رمز الحجز لدى شركة الطيران'},
    'NDC':{en:'NDC = newer airline booking standard (more content, direct from carrier)',ar:'معيار حجز أحدث مباشرة من الخطوط الجوية'},
    'EMD':{en:'EMD = electronic miscellaneous document — for ancillaries (bags, seats, refunds)',ar:'وثيقة إلكترونية للخدمات الإضافية'},
    'BSP':{en:'BSP = the IATA billing/settlement system between agencies and airlines',ar:'نظام التسوية بين الوكالات وشركات الطيران'},
    'TTL':{en:'TTL = ticketing time limit — when the booking expires if not paid',ar:'وقت انتهاء صلاحية الحجز'},
    'FOP':{en:'FOP = form of payment (cash, card, IATA agency credit, etc.)',ar:'طريقة الدفع'},
    'RBD':{en:'RBD = the fare class letter (Y, J, F…)',ar:'حرف درجة السعر'},
    'IATA Wakeel':{en:'IATA Wakeel = the licensed travel-agency number in Saudi Arabia',ar:'رقم وكالة السفر المرخصة'},
    'IBAN':{en:'IBAN = the international bank account number used for transfers',ar:'رقم الحساب البنكي الدولي'}
  };
  window.V26_GLOSSARY=V26_GLOSSARY;

  var v26GetLang=function(){return (typeof LANG!=='undefined'&&LANG)||'en';};

  /* Apply text-content replacements after every render */
  var v26ApplyPlainLanguage=function(){
    try{
      var view=document.getElementById('view');
      if(!view)return;
      var repls=V26_REPL_EN.concat(v26GetLang()==='ar'?V26_REPL_AR:[]);
      var w=document.createTreeWalker(view,NodeFilter.SHOW_TEXT,null,false);
      var nodes=[],n;while(n=w.nextNode())nodes.push(n);
      nodes.forEach(function(tn){
        var txt=tn.nodeValue;
        if(!txt||txt.length<3)return;
        var changed=false;
        for(var i=0;i<repls.length;i++){
          if(txt.indexOf(repls[i][0])>=0){txt=txt.split(repls[i][0]).join(repls[i][1]);changed=true;}
        }
        if(changed)tn.nodeValue=txt;
      });
      // Also sweep visible button labels (innerText preserves)
      var btns=view.querySelectorAll('button');
      btns.forEach(function(b){
        for(var i=0;i<repls.length;i++){
          if(b.innerText&&b.innerText.indexOf(repls[i][0])>=0){
            b.innerText=b.innerText.split(repls[i][0]).join(repls[i][1]);
          }
        }
      });
    }catch(e){console.warn('[v26.1] plain language sweep',e);}
  };
  window.v26ApplyPlainLanguage=v26ApplyPlainLanguage;


  /* Glossary tooltips — find badges/codes that match glossary keys, add title attr */
  var v26ApplyGlossaryTooltips=function(){
    try{
      var view=document.getElementById('view');
      if(!view)return;
      var lang=v26GetLang();
      // Walk all text nodes; for each glossary key found, wrap parent in title attr
      Object.keys(V26_GLOSSARY).forEach(function(term){
        var tip=V26_GLOSSARY[term][lang]||V26_GLOSSARY[term].en;
        // Find elements whose textContent equals or starts with term (e.g., badge spans)
        var els=view.querySelectorAll('span.tag, span.bench, .pip, label, th, .l');
        els.forEach(function(el){
          if(el.dataset.v26TipApplied)return;
          var t=(el.textContent||'').trim();
          if(t===term||t.startsWith(term+' ')||t.endsWith(' '+term)||t==='('+term+')'){
            el.setAttribute('title',tip);
            el.setAttribute('aria-label',el.getAttribute('aria-label')||t+' — '+tip);
            el.style.cursor='help';
            el.style.borderBottom='1px dotted currentColor';
            el.dataset.v26TipApplied='1';
          }
        });
      });
    }catch(e){console.warn('[v26.1] glossary tooltips',e);}
  };
  window.v26ApplyGlossaryTooltips=v26ApplyGlossaryTooltips;


  /* ===== S3: "What is this?" tooltips per section ===== */
  var V26_TIPS={
    today:{
      en:'Your home. It shows what needs your attention right now — quotes to send, invoices to push, low-margin offers, expiring deadlines.',
      ar:'صفحتك الرئيسية. تعرض ما يحتاج اهتمامك الآن — عروض للإرسال، فواتير معلّقة، عروض بهامش منخفض، مواعيد قاربت على الانتهاء.'
    },
    leads:{
      en:'People or companies that might book travel with us. Add new ones here and follow up over time.',
      ar:'الأشخاص أو الشركات الذين قد يحجزون السفر معنا. أضفهم هنا وتابع معهم.'
    },
    clients:{
      en:'Companies that already book with us — your managed accounts.',
      ar:'الشركات التي تحجز معنا بالفعل — حساباتك المُدارة.'
    },
    bookings:{
      en:'Live from the Direct booking system. View only — make changes in Direct.',
      ar:'مباشر من نظام Direct للحجز. للعرض فقط — أجرِ التعديلات داخل Direct.'
    },
    invoices:{
      en:'Live from Direct Payments. View and submit. Editing and refunds happen in Direct.',
      ar:'مباشر من Direct Payments. للعرض والإرسال. التعديل والاسترداد يتمّان داخل Direct.'
    },
    tickets:{
      en:'Live ticket register from the Direct booking system. View only — issuing and voiding happen in Direct.',
      ar:'سجل التذاكر مباشر من نظام Direct. للعرض فقط — الإصدار والإلغاء داخل Direct.'
    },
    offers:{
      en:'Quotes you send to clients before they decide to book. Build, save, and share by email or WhatsApp.',
      ar:'عروض الأسعار التي ترسلها للعملاء قبل تأكيد الحجز. أنشئها، احفظها، شاركها بالبريد أو واتساب.'
    },
    projects:{
      en:'Big multi-trip jobs — like an MDD roadshow. Track budget, services, profit, and the proposal deck.',
      ar:'مهام كبيرة متعددة الرحلات — مثل جولات MDD. تابع الميزانية والخدمات والأرباح وعرض المقترح.'
    },
    airlines:{
      en:'Your airline accounts — IATA codes, portals, contacts, and notes on each carrier.',
      ar:'حسابات شركات الطيران — أكواد إياتا والبوابات وجهات الاتصال والملاحظات.'
    },
    vendors:{
      en:'Providers and GDSs you source from — hotels, day tours, GDS aggregators, contacts and process notes.',
      ar:'الموردون وأنظمة الـ GDS — الفنادق، الجولات، المُجمّعون، جهات الاتصال وملاحظات العمل.'
    },
    sops:{
      en:'Our follow-up rulebook. Every desk procedure the team should run, with the common-practice baseline and our own standard.',
      ar:'دليل قواعد المتابعة. كل إجراء يجب أن يتبعه الفريق، مع الممارسة الشائعة ومعيارنا.'
    },
    slas:{
      en:'Our internal response-time targets. The windows we hold ourselves to per task type.',
      ar:'الأهداف الزمنية الداخلية. النوافذ التي نلتزم بها لكل نوع مهمة.'
    },
    sync:{
      en:'The connections to other systems we get data from. A green dot means it is working; red means it needs your attention.',
      ar:'الاتصالات مع الأنظمة الأخرى التي نسحب منها البيانات. النقطة الخضراء تعني أنها تعمل؛ الحمراء تعني تحتاج تدخّلك.'
    },
    settings:{
      en:'Language, backup, team, company profile, and the credit pool cap. Advanced developer tools are hidden inside the Advanced section.',
      ar:'اللغة، النسخ الاحتياطي، الفريق، ملف الشركة، وسقف ائتمان المجموعة. الأدوات المتقدمة مخفية ضمن قسم "متقدّم".'
    },
    activity:{
      en:'Every change, who did it and when. Use it for audit and to retrace steps.',
      ar:'كل تعديل، من قام به ومتى. استخدمه للتدقيق ولتتبع الخطوات.'
    },
    archive:{
      en:'Soft-deleted items — restorable within 30 days.',
      ar:'العناصر المؤرشفة — يمكن استعادتها خلال 30 يومًا.'
    },
    dashboard:{
      en:'A high-level overview of the whole pipeline.',
      ar:'نظرة عامة على خط الإمداد التجاري.'
    },
    ops:{
      en:'Requests in flight — intake to fulfilment to handover.',
      ar:'الطلبات قيد التنفيذ — من الاستلام إلى التسليم.'
    }
  };
  window.V26_TIPS=V26_TIPS;


  var v26InjectSectionTip=function(){
    try{
      var vT=document.getElementById('vTitle');
      var vS=document.getElementById('vSub');
      if(!vT)return;
      // Remove any existing tip button to avoid duplicates
      var old=document.getElementById('v26TipBtn');
      if(old)old.remove();
      var tip=V26_TIPS[typeof current!=='undefined'?current:'today'];
      if(!tip)return;
      var lang=v26GetLang();
      var tipText=tip[lang]||tip.en;
      var btn=document.createElement('button');
      btn.id='v26TipBtn';
      btn.type='button';
      btn.setAttribute('aria-label','What is this section?');
      btn.title=tipText;
      btn.textContent='?';
      btn.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1.5px solid #FF6B00;background:#FFF1E6;color:#FF6B00;font-weight:800;font-size:11px;cursor:help;margin-left:10px;padding:0;line-height:1;vertical-align:middle;font-family:inherit';
      btn.onclick=function(ev){
        ev.preventDefault();
        v26ShowTipPopover(btn,tipText);
      };
      vT.appendChild(btn);
    }catch(e){console.warn('[v26.1] section tip',e);}
  };
  window.v26InjectSectionTip=v26InjectSectionTip;

  window.v26ShowTipPopover=function(anchor,text){
    var existing=document.getElementById('v26TipPopover');
    if(existing){existing.remove();return;}
    var rect=anchor.getBoundingClientRect();
    var pop=document.createElement('div');
    pop.id='v26TipPopover';
    pop.style.cssText='position:fixed;top:'+(rect.bottom+8)+'px;left:'+Math.max(12,rect.left-200)+'px;background:#1C1E2B;color:#fff;padding:12px 14px;border-radius:10px;max-width:320px;font-size:13px;line-height:1.5;box-shadow:0 12px 30px rgba(0,0,0,.35);z-index:200';
    pop.innerHTML='<div style="font-weight:700;color:#FF9D45;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">What is this?</div>'+
      '<div>'+(text+'').replace(/</g,'&lt;')+'</div>'+
      '<button onclick="document.getElementById(\'v26TipPopover\').remove()" style="background:transparent;border:0;color:#AEB4CC;font-size:11px;margin-top:8px;cursor:pointer;padding:0">Close (Esc)</button>';
    document.body.appendChild(pop);
    var closeOnEsc=function(e){if(e.key==='Escape'){pop.remove();document.removeEventListener('keydown',closeOnEsc);}};
    document.addEventListener('keydown',closeOnEsc);
    setTimeout(function(){
      var closeOnClick=function(e){if(!pop.contains(e.target)&&e.target!==anchor){pop.remove();document.removeEventListener('click',closeOnClick);}};
      document.addEventListener('click',closeOnClick);
    },50);
  };


  /* ===== S2: Today as friendly hub ===== */
  var v26GreetingEN=function(){
    var h=new Date().getHours();
    if(h<5)return 'Late night,';
    if(h<12)return 'Good morning,';
    if(h<17)return 'Good afternoon,';
    if(h<22)return 'Good evening,';
    return 'Hello,';
  };
  var v26GreetingAR=function(){
    var h=new Date().getHours();
    if(h<5)return 'مساء الخير،';
    if(h<12)return 'صباح الخير،';
    if(h<17)return 'مساء الخير،';
    return 'مرحبًا،';
  };

  var v26TodaySummary=function(){
    var lang=v26GetLang();
    try{
      var offers=(DB.offers||[]).filter(function(o){return o.status==='Draft'||o.status==='Pending';}).length;
      var invoices=(DB.invoices||[]).filter(function(i){return i.status==='Draft'||i.status==='Pending';}).length;
      var bookings=(DB.bookings||[]).filter(function(b){return !b._archived;}).length;
      var parts=[];
      if(offers>0)parts.push(lang==='ar'?(offers+' عرض للإرسال'):(offers+' '+(offers===1?'quote':'quotes')+' to send'));
      if(invoices>0)parts.push(lang==='ar'?(invoices+' فاتورة للإرسال إلى Direct Payments'):(invoices+' '+(invoices===1?'invoice':'invoices')+' waiting to go to Direct Payments'));
      if(parts.length===0)return lang==='ar'?'لا توجد مهام عاجلة. اليوم هادئ.':'Nothing urgent. Today is calm.';
      return (lang==='ar'?'لديك ':'You have ')+parts.join(lang==='ar'?' و ':' and ')+'.';
    }catch(_){return lang==='ar'?'مرحبًا بعودتك.':'Welcome back.';}
  };

  var V26_ACTION_CARDS=[
    {id:'openQueue',ic:'✅',en:'Open my queue',ar:'افتح قائمتي',sub_en:'See what needs your attention',sub_ar:'اعرض ما يحتاج تدخّلك',color:'#FF6B00',bg:'#FFF3EC',run:function(){current='today';render();}},
    {id:'findClient',ic:'🔍',en:'Find a client',ar:'ابحث عن عميل',sub_en:'Search across all clients',sub_ar:'ابحث في جميع العملاء',color:'#B24E00',bg:'#FCEFE4',run:function(){if(typeof openPalette==='function')openPalette();else{var gs=document.getElementById('gsearch');if(gs)gs.focus();}}}
  ];

  var v26BuildTodayHub=function(){
    try{
      if(typeof current==='undefined'||current!=='today')return;
      var view=document.getElementById('view');
      if(!view||view.querySelector('#v26TodayHub'))return;
      var lang=v26GetLang();
      var greet=lang==='ar'?v26GreetingAR():v26GreetingEN();
      var name=(function(){try{if(window.__userName)return window.__userName;if(typeof me==='function'){var m=me();if(m)return m;}}catch(_){}return (typeof currentUser==='string'&&currentUser)||'';})();
      var summary=v26TodaySummary();
      var hub=document.createElement('div');
      hub.id='v26TodayHub';
      var html='<div class="card" style="background:linear-gradient(135deg,#FFFAF3,#FFFCF7);border:1px solid #FBD9B8;margin-bottom:18px;padding:24px">';
      html+='<div style="font-size:13px;color:#7C8194;font-weight:600;margin-bottom:4px">'+greet+'</div>';
      html+='<div style="font-size:26px;font-weight:800;letter-spacing:-.02em;color:#1C1E2B;margin-bottom:6px">'+name+'</div>';
      html+='<div style="font-size:14px;color:#3C4050;line-height:1.55">'+summary+'</div></div>';
      // 4 action cards in a grid
      html+='<div class="v26-actiongrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px">';
      V26_ACTION_CARDS.forEach(function(card){
        var label=lang==='ar'?card.ar:card.en;
        var sub=lang==='ar'?card.sub_ar:card.sub_en;
        html+='<button class="v26-action-card" data-action="'+card.id+'" style="background:'+card.bg+';border:2px solid transparent;border-radius:16px;padding:20px 18px;text-align:left;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:8px;min-height:128px;transition:.15s">'+
          '<div style="font-size:30px">'+card.ic+'</div>'+
          '<div style="font-size:15.5px;font-weight:800;color:'+card.color+'">'+label+'</div>'+
          '<div style="font-size:12px;color:#55596A">'+sub+'</div>'+
          '</button>';
      });
      html+='</div>';
      hub.innerHTML=html;
      // Insert at top of view
      view.insertBefore(hub,view.firstChild);
      // Wire actions
      V26_ACTION_CARDS.forEach(function(card){
        var el=hub.querySelector('[data-action="'+card.id+'"]');
        if(el){
          el.onclick=function(){try{card.run();}catch(e){console.warn(e);}};
          el.onmouseover=function(){el.style.borderColor=card.color;el.style.transform='translateY(-2px)';};
          el.onmouseout=function(){el.style.borderColor='transparent';el.style.transform='';};
        }
      });
    }catch(e){console.warn('[v26.1] Today hub',e);}
  };
  window.v26BuildTodayHub=v26BuildTodayHub;


  /* ===== S4: First-run welcome tour ===== */
  var V26_TOUR_STEPS=[
    {selector:null,en:{title:'Welcome',body:'This is the Direct Business dashboard. Let\'s take 30 seconds to walk through it.'},ar:{title:'مرحبًا',body:'هذه لوحة Direct Business. خذ 30 ثانية لجولة سريعة.'}},
    {selector:'.nav button',en:{title:'Today is your home',body:'Today is your home screen. It shows what needs your attention right now — quotes to send, invoices to push, deadlines.'},ar:{title:'اليوم هو صفحتك الرئيسية',body:'تعرض هذه الصفحة ما يحتاج اهتمامك الآن — عروض للإرسال، فواتير معلّقة، مواعيد قاربت.'}},
    {selector:'.nav button:nth-of-type(2)',en:{title:'Leads',body:'Leads is where you track potential clients — people we might book travel for.'},ar:{title:'العملاء المحتملون',body:'هنا تتابع العملاء المحتملين — الجهات التي قد نحجز لها.'}},
    {selector:null,en:{title:'Quick search anywhere',body:'Press Ctrl+K (or ⌘K on Mac) to jump to any section or run any action — quick add a lead, open the pool, find a project.'},ar:{title:'بحث سريع في كل مكان',body:'اضغط Ctrl+K (أو ⌘K على ماك) للقفز إلى أي قسم أو لتنفيذ أي إجراء.'}},
    {selector:'#langBtn,#v25PresetBtn',en:{title:'Language + view preset',body:'Switch between English and Arabic anytime. Right next to it, View as… shapes what you see on every page based on your role.'},ar:{title:'اللغة + نمط العرض',body:'بدّل بين الإنجليزية والعربية في أي وقت. بجانبها "اعرض كـ" يُشكّل ما تراه حسب دورك.'}}
  ];
  window.V26_TOUR_STEPS=V26_TOUR_STEPS;

  var v26TourState={idx:0,active:false};

  window.v26StartTour=function(force){return; /* v29: tour disabled for now */
    try{
      if(!force && localStorage.getItem('v26.tourCompleted')==='1')return;
      v26TourState.idx=0;
      v26TourState.active=true;
      v26TourRender();
    }catch(e){console.warn('[v26.1] tour start',e);}
  };
  window.v26SkipTour=function(){
    localStorage.setItem('v26.tourCompleted','1');
    v26TourCleanup();
  };
  window.v26FinishTour=function(){
    localStorage.setItem('v26.tourCompleted','1');
    v26TourCleanup();
    if(typeof logActivity==='function')logActivity('Welcome tour finished');
  };
  var v26TourCleanup=function(){
    v26TourState.active=false;
    var ov=document.getElementById('v26TourOverlay');if(ov)ov.remove();
    var tip=document.getElementById('v26TourTip');if(tip)tip.remove();
    document.querySelectorAll('.v26-tour-highlight').forEach(function(el){el.classList.remove('v26-tour-highlight');});
  };

  var v26TourRender=function(){
    var step=V26_TOUR_STEPS[v26TourState.idx];
    if(!step){v26FinishTour();return;}
    var lang=v26GetLang();
    var copy=step[lang]||step.en;
    // Build overlay
    var ov=document.getElementById('v26TourOverlay')||document.createElement('div');
    ov.id='v26TourOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(20,22,32,.55);backdrop-filter:blur(2px);z-index:5000';
    if(!ov.parentNode)document.body.appendChild(ov);
    // Build tip
    var tip=document.getElementById('v26TourTip')||document.createElement('div');
    tip.id='v26TourTip';
    var anchorEl=step.selector?document.querySelector(step.selector):null;
    document.querySelectorAll('.v26-tour-highlight').forEach(function(el){el.classList.remove('v26-tour-highlight');});
    if(anchorEl)anchorEl.classList.add('v26-tour-highlight');
    var pos='';
    if(anchorEl){
      var r=anchorEl.getBoundingClientRect();
      pos='top:'+Math.min(window.innerHeight-280,r.bottom+14)+'px;left:'+Math.max(14,Math.min(window.innerWidth-360,r.left))+'px';
    } else {
      pos='top:50%;left:50%;transform:translate(-50%,-50%)';
    }
    tip.style.cssText='position:fixed;'+pos+';background:#fff;color:#1C1E2B;padding:20px 22px;border-radius:14px;max-width:340px;box-shadow:0 18px 50px rgba(0,0,0,.45);z-index:5001;font-size:14px;line-height:1.55';
    var stepLbl=(v26TourState.idx+1)+' / '+V26_TOUR_STEPS.length;
    var nextLbl=lang==='ar'?(v26TourState.idx===V26_TOUR_STEPS.length-1?'إنهاء':'التالي'):(v26TourState.idx===V26_TOUR_STEPS.length-1?'Finish':'Next');
    var skipLbl=lang==='ar'?'تخطّي':'Skip tour';
    var backLbl=lang==='ar'?'السابق':'Back';
    tip.innerHTML='<div style="font-size:11px;color:#FF6B00;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">'+stepLbl+'</div>'+
      '<div style="font-size:17px;font-weight:800;margin-bottom:8px">'+copy.title+'</div>'+
      '<div style="margin-bottom:14px">'+copy.body+'</div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'+
      '<button onclick="v26SkipTour()" style="background:transparent;border:0;color:#7C8194;font-size:13px;cursor:pointer;padding:8px 12px;font-family:inherit">'+skipLbl+'</button>'+
      (v26TourState.idx>0?'<button onclick="v26TourPrev()" style="background:#EEF0F5;border:0;color:#1C1E2B;font-size:13px;cursor:pointer;padding:8px 14px;border-radius:8px;font-family:inherit;font-weight:600">'+backLbl+'</button>':'')+
      '<button onclick="v26TourNext()" style="background:#FF6B00;border:0;color:#fff;font-size:13px;cursor:pointer;padding:8px 18px;border-radius:8px;font-family:inherit;font-weight:700">'+nextLbl+'</button>'+
      '</div>';
    if(!tip.parentNode)document.body.appendChild(tip);
  };
  window.v26TourNext=function(){if(v26TourState.idx>=V26_TOUR_STEPS.length-1){v26FinishTour();return;}v26TourState.idx++;v26TourRender();};
  window.v26TourPrev=function(){if(v26TourState.idx>0){v26TourState.idx--;v26TourRender();}};


  /* ===== S5: Friendly empty states ===== */
  var V26_EMPTY={
    leads:{ic:'📭',en:{t:'No leads yet',sub:'Add the first person or company you want to follow up with.',btn:'+ Add your first lead',sub2:'Or import from Excel'},ar:{t:'لا يوجد عملاء محتملون بعد',sub:'أضف أول شخص أو شركة تودّ متابعتها.',btn:'+ أضف أول عميل محتمل',sub2:'أو استورد من Excel'},onClick:function(){if(typeof addBusiness==='function')addBusiness();else{var b=document.querySelector('button.btn.pri');if(b)b.click();}}},
    bookings:{ic:'✈️',en:{t:'No bookings yet',sub:'Bookings appear here once they are created in the Direct system.'},ar:{t:'لا توجد حجوزات بعد',sub:'تظهر الحجوزات هنا بمجرد إنشائها داخل نظام Direct.'},onClick:function(){window.open('https://payments.direct.com.sa/en/admin','_blank');},btnEn:'Open Direct ↗',btnAr:'افتح Direct ↗'},
    invoices:{ic:'🧾',en:{t:'No invoices yet',sub:'Invoices appear here once they are created in Direct Payments.'},ar:{t:'لا توجد فواتير بعد',sub:'تظهر الفواتير هنا بمجرد إنشائها داخل Direct Payments.'},onClick:function(){window.open('https://payments.direct.com.sa/en/admin/invoices','_blank');},btnEn:'Open Direct Payments ↗',btnAr:'افتح Direct Payments ↗'},
    tickets:{ic:'🎟️',en:{t:'No tickets yet',sub:'Tickets appear here once they are issued in the Direct system.'},ar:{t:'لا توجد تذاكر بعد',sub:'تظهر التذاكر هنا بمجرد إصدارها داخل نظام Direct.'},onClick:function(){window.open('https://payments.direct.com.sa/en/admin','_blank');},btnEn:'Open Direct ↗',btnAr:'افتح Direct ↗'},
    offers:{ic:'📋',en:{t:'No offers yet',sub:'Build a quote to send a client by email or WhatsApp.',btn:'+ Build your first offer'},ar:{t:'لا توجد عروض بعد',sub:'أنشئ عرض سعر لإرساله للعميل بالبريد أو واتساب.',btn:'+ أنشئ أول عرض'},onClick:function(){if(typeof newOffer==='function'){newOffer();render();}}},
    projects:{ic:'📁',en:{t:'No projects yet',sub:'Projects are big multi-trip jobs — like an MDD roadshow. Track budget, services, and profit per project.',btn:'+ Add your first project'},ar:{t:'لا توجد مشاريع بعد',sub:'المشاريع مهام كبيرة متعددة الرحلات. تابع الميزانية والخدمات والأرباح.',btn:'+ أضف أول مشروع'},onClick:function(){if(typeof v25NewProject==='function')v25NewProject();}},
    clients:{ic:'🏢',en:{t:'No clients yet',sub:'Clients are companies that already book with us. Add the first one to start managing.',btn:'+ Add your first client'},ar:{t:'لا يوجد عملاء بعد',sub:'العملاء هم الشركات التي تحجز معنا. أضف الأول لتبدأ.',btn:'+ أضف أول عميل'},onClick:function(){if(typeof addBusiness==='function')addBusiness();}},
    activity:{ic:'📊',en:{t:'No activity yet',sub:'Every change, who did it and when, will appear here.'},ar:{t:'لا توجد أنشطة بعد',sub:'كل تعديل ومن قام به ومتى سيظهر هنا.'}},
    archive:{ic:'🗂️',en:{t:'Archive is empty',sub:'Soft-deleted items appear here. You can restore them within 30 days.'},ar:{t:'الأرشيف فارغ',sub:'تظهر العناصر المؤرشفة هنا. يمكن استعادتها خلال 30 يومًا.'}}
  };
  window.V26_EMPTY=V26_EMPTY;

  var v26EmptyCard=function(section){
    var info=V26_EMPTY[section];
    if(!info)return '';
    var lang=v26GetLang();
    var c=info[lang]||info.en;
    var btnLbl=c.btn||info['btn'+(lang==='ar'?'Ar':'En')]||'';
    var sub2=c.sub2||'';
    var btn=btnLbl?'<button class="btn pri" style="margin-top:12px" onclick="v26EmptyAction(\''+section+'\')">'+btnLbl+'</button>':'';
    var sub2El=sub2?'<div style="font-size:11.5px;color:#7C8194;margin-top:10px"><a href="#" onclick="v26EmptyImport(\''+section+'\');return false;" style="color:#7C8194;border-bottom:1px dotted #A6AAB8">'+sub2+'</a></div>':'';
    return '<div class="card v26-empty-card" style="text-align:center;padding:38px 24px;border:2px dashed #E5DED2;background:#FAFBFD">'+
      '<div style="font-size:42px;margin-bottom:10px">'+info.ic+'</div>'+
      '<div style="font-size:16px;font-weight:800;margin-bottom:6px;color:#1C1E2B">'+c.t+'</div>'+
      '<div style="font-size:13px;color:#55596A;max-width:380px;margin:0 auto 4px">'+c.sub+'</div>'+
      btn+sub2El+'</div>';
  };
  window.v26EmptyCard=v26EmptyCard;
  window.v26EmptyAction=function(section){var info=V26_EMPTY[section];if(info&&typeof info.onClick==='function')info.onClick();};
  window.v26EmptyImport=function(section){
    alert(v26GetLang()==='ar'?'أضف العناصر يدويًا باستخدام الزر أعلاه.':'Add items one at a time using the button above.');
  };

  var v26ReplaceBlankStates=function(){
    try{
      if(typeof current==='undefined')return;
      var view=document.getElementById('view');
      if(!view)return;
      // Trigger when section has no leads/items at all
      var emptyMap={leads:'.board',clients:'tbody',bookings:'tbody',invoices:'tbody',tickets:'tbody',offers:'tbody',projects:'.board',activity:'tbody',archive:'tbody'};
      var sel=emptyMap[current];
      if(!sel)return;
      var containers=view.querySelectorAll(sel);
      // Check each container has only "empty" or zero meaningful children
      containers.forEach(function(c){
        var hasItems=false;
        if(current==='leads'||current==='projects'){
          hasItems=c.querySelectorAll('.lead').length>0;
        } else {
          hasItems=c.querySelectorAll('tr').length>0;
        }
        if(hasItems)return;
        // Only inject once at top of view (avoid duplicates)
        if(view.querySelector('.v26-empty-card'))return;
        var card=document.createElement('div');
        card.innerHTML=v26EmptyCard(current);
        if(card.firstChild)view.insertBefore(card.firstChild,view.firstChild.nextSibling);
      });
    }catch(e){console.warn('[v26.1] empty states',e);}
  };
  window.v26ReplaceBlankStates=v26ReplaceBlankStates;


  /* ===== S6: Plain-language confirms ===== */
  /* Wrap window.confirm so destructive flows use a friendlier dialog. */
  var V26_CONFIRM_MAP=[
    {match:/archive|soft-delete|delete this lead|delete lead/i,en:{title:'Delete this lead?',body:'It moves to Archive where you can restore it within 30 days.',cancel:'Cancel',ok:'Yes, delete'},ar:{title:'حذف هذا العميل المحتمل؟',body:'سينتقل إلى الأرشيف ويمكن استعادته خلال 30 يومًا.',cancel:'إلغاء',ok:'نعم، احذف'}},
    {match:/reset|clear test|go-live|wipe/i,en:{title:'Clear all test data?',body:'Templates, settings, and your real B2B clients stay. A backup is saved first.',cancel:'Cancel',ok:'Yes, clear'},ar:{title:'مسح جميع بيانات الاختبار؟',body:'القوالب والإعدادات وعملاء B2B الحقيقيون يبقون. سيتم حفظ نسخة احتياطية أولاً.',cancel:'إلغاء',ok:'نعم، امسح'}},
    {match:/credit|over-limit|override/i,en:{title:'Over the credit limit',body:'This client is over their credit limit. Override means you choose to proceed anyway and the action is logged for Finance.',cancel:'Cancel',ok:'Override and continue'},ar:{title:'تجاوز حد الائتمان',body:'هذا العميل تجاوز حد الائتمان. التجاوز يعني اختيار المتابعة وتسجيل العملية للحسابات.',cancel:'إلغاء',ok:'تجاوَز وتابع'}},
    {match:/refund|cancel.*ticket|void/i,en:{title:'Cancel / refund?',body:'This will ask Finance to refund. The actual refund happens inside Direct Payments.',cancel:'Cancel',ok:'Yes, ask Finance'},ar:{title:'إلغاء / استرداد؟',body:'سيُطلب من قسم الحسابات الاسترداد. التنفيذ الفعلي يتم داخل Direct Payments.',cancel:'إلغاء',ok:'نعم، اطلب من الحسابات'}},
    {match:/.+/,en:{title:'Are you sure?',body:'',cancel:'Cancel',ok:'Yes, continue'},ar:{title:'هل أنت متأكد؟',body:'',cancel:'إلغاء',ok:'نعم، تابع'}}
  ];

  var __v26_origConfirm=window.confirm;
  window.confirm=function(message){
    try{
      var msg=String(message||'');
      var lang=v26GetLang();
      // Pick matching template
      var tpl=null;
      for(var i=0;i<V26_CONFIRM_MAP.length;i++){
        if(V26_CONFIRM_MAP[i].match.test(msg)){tpl=V26_CONFIRM_MAP[i];break;}
      }
      tpl=tpl||V26_CONFIRM_MAP[V26_CONFIRM_MAP.length-1];
      var c=tpl[lang]||tpl.en;
      // Build inline modal blocking? confirm() must be SYNCHRONOUS — so we keep native fallback.
      // But we can show our prettier modal first, then return native's value.
      // Simplest: keep native call AND show our message via a brief overlay before. For synchronous return we just append our friendlier prefix to the native dialog.
      var prettyMsg=c.title+'\n\n'+(c.body||msg)+'\n\n['+c.cancel+'  /  '+c.ok+']';
      return __v26_origConfirm.call(window,prettyMsg);
    }catch(e){return __v26_origConfirm.call(window,message);}
  };

  /* Optionally promote known confirm() callers to use a friendly openModal flow */
  window.v26FriendlyConfirm=function(kind,onYes){
    var tpl=V26_CONFIRM_MAP.find(function(x){return x.match.test(kind);})||V26_CONFIRM_MAP[V26_CONFIRM_MAP.length-1];
    var lang=v26GetLang();
    var c=tpl[lang]||tpl.en;
    if(typeof openModal!=='function'){if(onYes&&__v26_origConfirm(c.title+'\n'+c.body))onYes();return;}
    openModal(c.title,
      '<div style="font-size:14px;line-height:1.55;color:#3C4050">'+c.body+'</div>',
      function(){try{onYes&&onYes();}catch(_){}}
    );
    // Override the Save button label
    setTimeout(function(){
      var saveBtn=document.querySelector('#modal #mSave');
      if(saveBtn)saveBtn.textContent=c.ok;
      var cancelBtn=document.querySelector('#modal .btn.ghost');
      if(cancelBtn)cancelBtn.textContent=c.cancel;
    },30);
  };


  /* ===== S7: Settings — Daily vs Advanced split ===== */
  var V26_DAILY_LABELS={
    language:{en:'Language',ar:'اللغة'},
    backup:{en:'💾 Backup & Restore',ar:'💾 نسخ احتياطي واستعادة'},
    chain:{en:'Chain-of-command rules',ar:'قواعد التسلسل الإداري'},
    team:{en:'Team members + roles',ar:'أعضاء الفريق والأدوار'},
    company:{en:'Company profile',ar:'ملف الشركة'},
    viewAs:{en:'View as',ar:'اعرض كـ'},
    pool:{en:'Commercial Credit Pool',ar:'سقف الائتمان التجاري'}
  };
  var V26_ADV_LABELS={
    workflow:{en:'🧪 Run workflow tests',ar:'🧪 تشغيل اختبارات الأعمال'},
    scenario:{en:'🟢 Run scenario tests',ar:'🟢 تشغيل اختبارات السيناريوهات'},
    perf:{en:'⚙ Performance overlay',ar:'⚙ طبقة الأداء'},
    sec:{en:'🔐 Security checks',ar:'🔐 فحوصات الأمان'},
    wipe:{en:'🗑 Wipe local data',ar:'🗑 مسح البيانات المحلية'},
    tour:{en:'↩ Replay welcome tour',ar:'↩ إعادة تشغيل جولة الترحيب'},
    exportState:{en:'📦 Export full state JSON',ar:'📦 تصدير الحالة الكاملة'},
    relearn:{en:'🔄 Refresh proposal templates',ar:'🔄 تحديث قوالب العروض'},
    clearTest:{en:'🧹 Clear test data — keep templates',ar:'🧹 مسح بيانات الاختبار — مع الإبقاء على القوالب'}
  };
  var v26L=function(o){var l=v26GetLang();return o[l]||o.en;};

  var v26ReorgSettings=function(){
    try{
      if(current!=='settings')return;
      var view=document.getElementById('view');
      if(!view||view.querySelector('#v26SettingsOrg'))return;
      var lang=v26GetLang();
      var wrap=document.createElement('div');
      wrap.id='v26SettingsOrg';
      // Build "Daily use" section header
      var daily=document.createElement('div');
      daily.style.cssText='margin-bottom:16px';
      daily.innerHTML='<h3 style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7C8194;font-weight:800">'+(lang==='ar'?'الاستخدام اليومي':'Daily use')+'</h3>';
      var dailyGrid=document.createElement('div');
      dailyGrid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px';
      // Create simple cards for each Daily action
      var dailyCards=[
        {label:V26_DAILY_LABELS.language,sub:lang==='ar'?'بدّل بين EN و AR':'Switch between EN and AR',onClick:function(){if(typeof toggleLang==='function')toggleLang();}},
        {label:V26_DAILY_LABELS.viewAs,sub:lang==='ar'?'غيّر نمط العرض':'Change preset',onClick:function(){var b=document.getElementById('v25PresetBtn');if(b)b.click();}},
        {label:V26_DAILY_LABELS.pool,sub:lang==='ar'?'حرّر السقف وراجع التاريخ':'Edit cap, see history',onClick:function(){if(typeof v25OpenPoolSettings==='function')v25OpenPoolSettings();}},
        {label:V26_DAILY_LABELS.company,sub:lang==='ar'?'الرقم التجاري، الضريبي، IBAN، Wakeel':'CR, VAT, IBAN, Wakeel',onClick:function(){if(typeof editBusiness==='function'){var me=(DB.businesses||[]).find(function(b){return b.id==='b_directbusiness'||b.isSelf;});if(me){editBusiness(me.id);return;}}var cs=Array.prototype.slice.call(document.querySelectorAll('#view .card'));var c=null;for(var i=0;i<cs.length;i++){if(/printables|للطباعة/.test(cs[i].textContent||'')){c=cs[i];break;}}if(c){c.scrollIntoView({behavior:'smooth',block:'center'});c.style.outline='2px solid #FF6B00';setTimeout(function(){c.style.outline='';},1600);}}},
        {label:V26_DAILY_LABELS.chain,sub:lang==='ar'?'من يوافق على ماذا':'Who approves what',onClick:function(){var m=(lang==='ar'?'تتم إدارة قواعد التسلسل داخل ملف كل عميل (افتح العميل ثم «التسلسل الإداري»).':'Chain-of-command lives inside each client (open a client → Chain of command).');if(typeof toast==='function')toast(m);else alert(m);}},
        {label:V26_DAILY_LABELS.team,sub:lang==='ar'?'الأعضاء، الأدوار، الصلاحيات':'Members, roles, page access',onClick:function(){if(typeof window.v48Users==='function')window.v48Users();else if(typeof toast==='function')toast('Team & Access');}}
      ];
      dailyCards.forEach(function(card){
        var btn=document.createElement('button');
        btn.style.cssText='background:#fff;border:1px solid #E5DED2;border-radius:14px;padding:18px;text-align:left;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:6px;box-shadow:var(--shadow);transition:.15s';
        btn.innerHTML='<div style="font-size:15px;font-weight:700">'+v26L(card.label)+'</div><div style="font-size:12px;color:#7C8194">'+card.sub+'</div>';
        btn.onmouseover=function(){btn.style.borderColor='#FF6B00';btn.style.transform='translateY(-1px)';};
        btn.onmouseout=function(){btn.style.borderColor='#E5DED2';btn.style.transform='';};
        btn.onclick=card.onClick;
        dailyGrid.appendChild(btn);
      });
      daily.appendChild(dailyGrid);
      wrap.appendChild(daily);

      // Advanced — collapsed
      var details=document.createElement('details');
      details.style.cssText='margin-top:22px;border:1px solid #E5DED2;border-radius:14px;padding:14px 18px;background:#FAFBFD';
      var summary=document.createElement('summary');
      summary.style.cssText='cursor:pointer;font-weight:800;font-size:13px;color:#1C1E2B;list-style:none';
      summary.innerHTML='<span style="display:inline-block;margin-right:8px">▸</span>'+
        (lang==='ar'?'متقدّم — افتح فقط إذا كنت تعرف ما تفعل':'Advanced — only open this if you know what you are doing');
      details.appendChild(summary);
      var advGrid=document.createElement('div');
      advGrid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:14px';
      /* v49: dropped the developer test-runners (Run workflow/scenario tests, Security checks)
         and the destructive "Clear test data".
         v51: dropped "Export full state JSON" too — code/data safety is handled by the platform
         (GitHub + Vercel + Supabase auto-save), so a manual JSON export is not a team tool.
         Only the proposal-template refresh remains — a real business action. */
      var advCards=[
        {label:V26_ADV_LABELS.relearn,run:function(){if(typeof v25TemplateLearn==='function'){v25TemplateLearn();var m=(lang==='ar'?'تم تحديث قوالب العروض':'Proposal templates refreshed.');if(typeof toast==='function')toast(m);else alert(m);}}}
      ];
      advCards.forEach(function(c){
        var btn=document.createElement('button');
        btn.className='btn sm';
        btn.style.cssText='justify-content:flex-start;text-align:left;padding:10px 14px';
        btn.textContent=v26L(c.label);
        btn.onclick=c.run;
        advGrid.appendChild(btn);
      });
      details.appendChild(advGrid);
      wrap.appendChild(details);
      // Insert wrap at the very top of the view (above existing settings)
      view.insertBefore(wrap,view.firstChild);
      // Hide native test-suite buttons elsewhere on settings to dedupe
      view.querySelectorAll('button').forEach(function(b){
        if(b.closest('#v26SettingsOrg'))return;
        var t=(b.textContent||'').trim();
        if(/Run workflow|Run scenario|workflow suite|scenario suite|Reset for go-live|Hash-chain integrity|XSS audit|Run business tests|Security checks|Performance overlay|Tag current state|Enable idle lock|Wipe local data|Wipe test records|Run a day/i.test(t)){
          b.style.display='none';
        }
      });
    }catch(e){console.warn('[v26.1] settings reorg',e);}
  };
  window.v26ReorgSettings=v26ReorgSettings;


  /* ===== P0-2: Fix KPI rows that render as raw text on mobile ===== */
  /* Sweep for sequences of number+label patterns and convert to grid */
  var v26FixKpiLayouts=function(){
    try{
      var view=document.getElementById('view');
      if(!view)return;
      // Look for "Open pipeline 3.45M | Weighted 973k | ..." text-stacked blocks
      // Strategy: find divs whose direct text contains 4+ number-tokens with labels
      var allDivs=view.querySelectorAll('div:not(.v26-kpi-grid):not(.card):not(.lead):not(.kpi):not(.kpis):not(.chip)');
      allDivs.forEach(function(d){
        if(d.dataset.v26KpiProcessed)return;
        // Never grid-ify the kanban board, its columns/cards, tables or timelines —
        // their card text is full of numbers and false-matches the KPI heuristic.
        if(d.closest&&d.closest('.board,.col,.reqcard,.lead,.tbl-wrap,table,.timeline,.detail-head,#board,#reqboard'))return;
        // …and never a container that WRAPS a table/board: turning it into a grid
        // (or letting v26.3 demote it as an "aggregate block") hides real records.
        if(d.querySelector&&d.querySelector('table,.board,.tbl-wrap,.col'))return;
        if(d.children.length>0&&d.children.length<2)return;
        var txt=(d.textContent||'').replace(/\s+/g,' ').trim();
        if(txt.length<40||txt.length>800)return;
        // Heuristic: line contains 4+ numeric values (SAR, K, M, %, count)
        var nums=txt.match(/[0-9][0-9\.]*[KkMm%]?(?:\s*(?:SAR|days?|d|hrs?|h))?/g)||[];
        if(nums.length<4)return;
        // If parent already has a grid class don't touch
        if(d.classList.contains('kpis')||d.classList.contains('v26-kpi-grid'))return;
        // Mark as processed and apply grid
        d.dataset.v26KpiProcessed='1';
        d.classList.add('v26-kpi-grid');
      });
      // Also normalize the existing .kpis container behavior on mobile
      view.querySelectorAll('.kpis').forEach(function(k){
        if(!k.classList.contains('v26-kpis-fixed')){
          k.classList.add('v26-kpis-fixed');
        }
      });
    }catch(e){console.warn('[v26.1] KPI layout fix',e);}
  };
  window.v26FixKpiLayouts=v26FixKpiLayouts;


  /* ===== Master render wrap: chain all v26.1 hooks ===== */
  try{
    var __v26_origRender=window.render;
    window.render=function(){
      var r=__v26_origRender.apply(this,arguments);
      try{ v26ApplyPlainLanguage(); }catch(_){}
      try{ v26ApplyGlossaryTooltips(); }catch(_){}
      try{ v26InjectSectionTip(); }catch(_){}
      try{ v26BuildTodayHub(); }catch(_){}
      try{ v26ReplaceBlankStates(); }catch(_){}
      try{ v26ReorgSettings(); }catch(_){}
      try{ v26FixKpiLayouts(); }catch(_){}
      return r;
    };
  }catch(e){console.warn('[v26.1] master render wrap',e);}

  /* ===== CSS appendix: P0-2 KPI grids + P0-3 mobile header + tour styles + action cards ===== */
  try{
    if(!document.getElementById('v26css')){
      var st=document.createElement('style');
      st.id='v26css';
      st.textContent=
        /* P0-2: KPI grid (default + mobile-first) */
        ".v26-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:14px 0;padding:0}"+
        ".v26-kpi-grid>*{background:#fff;border:1px solid #EEE8DE;border-radius:11px;padding:12px 14px;font-size:13px;line-height:1.4}"+
        ".v26-kpis-fixed{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}"+
        "@media(max-width:640px){.v26-kpi-grid{grid-template-columns:repeat(2,1fr)}}"+
        "@media(max-width:380px){.v26-kpi-grid{grid-template-columns:1fr}}"+
        /* P0-3: Mobile header — title own row, controls below */
        "@media(max-width:640px){"+
          ".top{flex-direction:column;align-items:stretch;gap:8px;padding:12px 16px}"+
          ".top>div:first-child{order:1;width:100%}"+
          ".top h1{font-size:17px;line-height:1.2;word-break:break-word}"+
          ".top .tools{order:2;width:100%;display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}"+
          ".top .tools .btn,.top .tools .btn.sm{padding:6px 10px;font-size:12px;min-height:36px}"+
          ".tools #v25PresetBtn{font-size:11.5px;padding:6px 8px}"+
          "#v26TipBtn{margin-left:6px}"+
        "}"+
        /* Action grid Today hub mobile */
        "@media(max-width:480px){.v26-actiongrid{grid-template-columns:1fr 1fr!important;gap:10px}}"+
        "@media(max-width:640px){.v26-action-card{min-height:108px!important;padding:14px 14px!important}}"+
        /* Tour highlight */
        ".v26-tour-highlight{position:relative;z-index:5002;outline:3px solid #FF6B00;outline-offset:4px;border-radius:8px;box-shadow:0 0 0 9999px rgba(20,22,32,.55)}"+
        /* Section tip button */
        "#v26TipBtn:hover{background:#FF6B00;color:#fff}"+
        /* Friendly empty state */
        ".v26-empty-card{margin:14px 0}"+
        /* Settings reorg cards */
        "#v26SettingsOrg button:focus-visible{outline:3px solid #FF6B00;outline-offset:2px}"+
        /* Plain confirm spacing */
        "#modal .mb{font-size:14px}"+
        /* Hide raw version markers from default view */
        ".v22GoLiveBanner [data-version],.v21DraftBanner [data-version]{display:none}"+
        /* Print: hide v26 chrome */
        "@media print{#v26TipBtn,.v26-tour-highlight,#v26TodayHub{display:none!important}}";
      document.head.appendChild(st);
    }
  }catch(e){console.warn('[v26.1] css inject',e);}

  /* ===== Auto-start tour on first load (if not completed) ===== */
  try{
    /* v29: tour auto-start disabled */
    
  }catch(e){console.warn('[v26.1] tour autostart',e);}

  /* ===== ⌘K palette extension: tour replay + report a bug + glossary lookup ===== */
  try{
    if(typeof CMD_ACTIONS==='function'){
      var __origCmd=window.CMD_ACTIONS||CMD_ACTIONS;
      window.CMD_ACTIONS=function(){
        var arr=__origCmd.apply(this,arguments)||[];
        var lang=v26GetLang();
        var extras=[
          
          {kind:'Help',ic:'❓',lbl:lang==='ar'?'ما هو هذا القسم؟':'What is this section?',sub:lang==='ar'?'افتح تلميح القسم':'Open the section tooltip',run:function(){var b=document.getElementById('v26TipBtn');if(b)b.click();}}
        ];
        return arr.concat(extras);
      };
    }
  }catch(e){console.warn('[v26.1] palette extend',e);}

  console.info('%c[v26.1] Simplify bundle loaded — S1-S7 + P0 fixes active','color:#FF6B00;font-weight:700');
})();




/* ========================================================================
   V26.2 CLICK-THROUGH QA BUNDLE — additive IIFE, builds on v26.1
   Adds patches identified by systematic walk: missing handlers, copy fixes,
   tooltip clipping, advanced-form collapse, etc.
   Storage stays v25. Rollback = delete this IIFE.
   ======================================================================== */
(function v26_2QA(){
  if(window.__V26_2_LOADED__)return;
  window.__V26_2_LOADED__=true;

  var v26_2GetLang=function(){return (typeof LANG!=='undefined'&&LANG)||'en';};

  /* Findings will be implemented here as the walk surfaces them. */
  /* Each fix is wrapped in try/catch so one failure can't cascade. */


  /* ===== F4 + F5: Wire client detail to real KSA onboarding + add Chain of command button ===== */
  var v26_2EnhanceClientDetail=function(){
    try{
      if(typeof openLead==='undefined'||!openLead)return;
      var lead=(DB&&DB.businesses||[]).find(function(b){return b.id===openLead;});
      if(!lead||!lead.isClient)return;
      var view=document.getElementById('view');
      if(!view||view.querySelector('[data-v26_2-chain]'))return;
      // Re-wire "Edit profile" button to use v22OpenClientOnboarding for clients
      view.querySelectorAll('button').forEach(function(b){
        var t=(b.textContent||'').trim();
        if(t==='Edit profile'&&typeof window.v22OpenClientOnboarding==='function'){
          b.onclick=function(){window.v22OpenClientOnboarding(openLead);};
          var lang=v26_2GetLang();
          b.textContent=lang==='ar'?'تعديل ملف العميل (نموذج كامل)':'Edit client profile (full form)';
          b.dataset.v26_2Rewired='1';
        }
      });
      // Inject Chain of command button if v24OpenChainOfCommand exists
      if(typeof window.v24OpenChainOfCommand!=='function')return;
      // Find a toolbar/button group to attach
      var anchor=null;
      view.querySelectorAll('button').forEach(function(b){
        if(!anchor && (b.textContent||'').trim()==='Edit profile (full form)'){anchor=b;}
        if(!anchor && (b.textContent||'').trim()==='Edit client profile (full form)'){anchor=b;}
        if(!anchor && (b.textContent||'').trim()==='Edit profile'){anchor=b;}
      });
      if(!anchor)return;
      var chainBtn=document.createElement('button');
      chainBtn.className='btn sm';
      chainBtn.setAttribute('data-v26_2-chain','1');
      var lang=v26_2GetLang();
      chainBtn.textContent=lang==='ar'?'التسلسل الإداري':'Chain of command';
      chainBtn.title=lang==='ar'?'تحرير المخوّلين وصلاحيات الاعتماد':'Edit authorities and approval chain';
      chainBtn.onclick=function(){window.v24OpenChainOfCommand(openLead);};
      anchor.parentNode.insertBefore(chainBtn,anchor.nextSibling);
    }catch(e){console.warn('[v26.2] client detail enhance',e);}
  };
  window.v26_2EnhanceClientDetail=v26_2EnhanceClientDetail;


  /* ===== F6: Self-heal mojibake in DB.projects Arabic names ===== */
  /* Arabic strings written via \u escapes so they survive any file rewrite. */
  var V26_2_PROJECT_AR={
    p_osaka:'جولة أوساكا 2026',
    p_lisbon:'بعثة لشبونة التجارية',
    p_dc:'منتدى واشنطن للاستثمار',
    p_london:'قمة لندن للتقنية',
    p_usa:'جولة شرق أمريكا التعليمية',
    p_morocco:'بعثة المغرب الثقافية'
  };
  try{
    var mojiRe=/[À-ÿ][-ÿ]/;
    var needsHeal=(DB&&DB.projects||[]).some(function(p){return mojiRe.test(p.nameAr||'');});
    if(needsHeal){
      (DB.projects||[]).forEach(function(p){
        if(V26_2_PROJECT_AR[p.id]){p.nameAr=V26_2_PROJECT_AR[p.id];}
      });
      try{if(typeof saveDB==='function')saveDB();}catch(_){}
      try{localStorage.setItem('directBusinessData_v25',JSON.stringify(DB));}catch(_){}
      try{localStorage.setItem('directBusinessData_v24',JSON.stringify(DB));}catch(_){}
      if(typeof logActivity==='function')logActivity('[v26.2] Self-healed mojibake in '+(DB.projects||[]).length+' project Arabic names');
      console.info('[v26.2] Healed project Arabic names mojibake');
    }
  }catch(e){console.warn('[v26.2] project AR heal',e);}


  /* ===== Master render wrap: run v26.2 fixes after each render ===== */
  try{
    var __v26_2_origRender=window.render;
    window.render=function(){
      var r=__v26_2_origRender.apply(this,arguments);
      try{ v26_2EnhanceClientDetail(); }catch(_){}
      return r;
    };
  }catch(e){console.warn('[v26.2] master render wrap',e);}

  /* ===== CSS appendix for v26.2 polish ===== */
  try{
    if(!document.getElementById('v26_2css')){
      var st=document.createElement('style');
      st.id='v26_2css';
      st.textContent=
        /* Make sure the Chain of command button visually pops */
        "[data-v26_2-chain]{background:#FFF1E6;border-color:#FBD9B8;color:#C2691A}"+
        "[data-v26_2-chain]:hover{background:#FBD9B8;color:#9A560F}";
      document.head.appendChild(st);
    }
  }catch(e){console.warn('[v26.2] css inject',e);}

  console.info('%c[v26.2] Click-through QA bundle loaded — F4, F5, F6 patched','color:#FF6B00;font-weight:700');
})();




/* ========================================================================
   V26.3 LANDING PATTERN BUNDLE — additive IIFE, layers on v26.2.
   Visual identity blends Sahara's calm chrome with Direct's orange.
   - Navy #303848 top bar (56px desktop / 48px mobile)
   - Orange #FF6B00 primary action
   - IBM Plex Sans Arabic + Inter fonts
   - One pattern repeated on every section:
       slim header + stage chips + optional one-line strip + LIST/BOARD fills the rest
   - Aggregate KPIs / funnels / charts collapse under "📊 Insights ▾" (closed by default)
   Storage stays v25. Rollback = delete this IIFE block.
   ======================================================================== */
(function v26_3LandingPattern(){
  if(window.__V26_3_LOADED__)return;
  window.__V26_3_LOADED__=true;

  var v26_3GetLang=function(){return (typeof LANG!=='undefined'&&LANG)||'en';};


  /* ===== 1. Load fonts: IBM Plex Sans Arabic + Inter ===== */
  try{
    if(!document.getElementById('v26_3-fonts')){
      var pre1=document.createElement('link');pre1.rel='preconnect';pre1.href='https://fonts.googleapis.com';
      var pre2=document.createElement('link');pre2.rel='preconnect';pre2.href='https://fonts.gstatic.com';pre2.crossOrigin='';
      var link=document.createElement('link');
      link.id='v26_3-fonts';
      link.rel='stylesheet';
      link.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap';
      document.head.appendChild(pre1);document.head.appendChild(pre2);document.head.appendChild(link);
    }
  }catch(e){console.warn('[v26.3] font load',e);}

  /* ===== 2. CSS appendix: navy chrome + section-head pattern + chips + Insights toggle ===== */
  try{
    if(!document.getElementById('v26_3css')){
      var st=document.createElement('style');
      st.id='v26_3css';
      st.textContent=
        /* Font wiring */
        "body{font-family:'Cairo','Inter',system-ui,sans-serif!important}"+
        ":lang(ar),[dir=rtl]{font-family:'Cairo','Tajawal',sans-serif!important}"+

        /* ===== Navy slim top bar (overrides .top) ===== */
        ".top{background:rgba(255,255,255,.85)!important;color:var(--ink)!important;backdrop-filter:saturate(180%) blur(12px)!important;border-bottom:1px solid #e7e7e7!important;padding:0 20px!important;height:56px;align-items:center}"+
        ".top h1{color:var(--ink)!important;font-size:15px!important;font-weight:700!important;letter-spacing:-.01em!important;margin:0}"+
        ".top .sub{display:none!important}"+
        ".top .tools{margin-left:auto;display:flex;align-items:center;gap:8px}"+
        ".top .tools .btn{background:#fff!important;border:1px solid #e7e7e7!important;color:var(--ink)!important;box-shadow:none!important;border-radius:9999px!important;font-size:12px!important;padding:6px 12px!important;min-height:32px}"+
        ".top .tools .btn:hover{background:#FFF3EC!important;border-color:#FFD3B0!important;color:#B24E00!important;transform:none!important}"+
        ".top .tools .btn.pri{background:#FF6B00!important;color:#fff!important;font-weight:600!important;border:0!important;border-radius:9999px!important;padding:7px 16px!important;min-height:36px;box-shadow:none!important}"+
        ".top .tools .btn.pri:hover{background:#E36810!important;filter:none!important}"+
        ".top .v25-sync-pill,.top .v26_3-sync-pill{display:inline-flex;align-items:center;gap:6px;background:#F5F5F5;padding:5px 11px;border-radius:9999px;font-size:11px;color:#555;font-weight:500}"+
        ".top .v26_3-sync-pill .dot{width:7px;height:7px;border-radius:50%;background:#22C55E}"+
        "@media(max-width:640px){.top{height:48px!important;padding:0 12px!important;flex-wrap:wrap;gap:8px}.top h1{font-size:14px!important}.top .v26_3-sync-pill{display:none}}"+

        /* ===== Section header strip pattern ===== */
        ".v26_3-section-head{display:flex;align-items:center;gap:14px;padding:24px 28px 12px;flex-wrap:wrap}"+
        "@media(max-width:640px){.v26_3-section-head{padding:16px 14px 8px}}"+
        ".v26_3-section-head .title-block{flex:1;min-width:0}"+
        ".v26_3-section-head h2{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0;color:#303848;display:inline-flex;align-items:center;gap:10px}"+
        ".v26_3-section-head .sub{font-size:13px;color:#7C8194;margin-top:4px}"+
        ".v26_3-section-head .help-dot{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1.5px solid #FF6B00;color:#FF6B00;font-weight:800;font-size:11px;cursor:help;background:#FFF1E6;line-height:1;font-family:'Cairo','Inter',sans-serif}"+
        ".v26_3-insights-btn{background:#fff;border:1px solid #E5E1D8;color:#303848;padding:8px 14px;border-radius:9999px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;min-height:38px;cursor:pointer;font-family:inherit}"+
        ".v26_3-insights-btn:hover{border-color:#303848;background:#F2F4F8}"+
        ".v26_3-insights-btn.active{background:#FF6B00;color:#fff;border-color:#FF6B00}"+

        /* ===== Chip strip ===== */
        ".v26_3-chips{display:flex;gap:8px;flex-wrap:wrap;padding:0 28px 14px;align-items:center}"+
        "@media(max-width:640px){.v26_3-chips{padding:0 14px 10px}}"+
        ".v26_3-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;background:#fff;border:1px solid #E5E1D8;border-radius:9999px;font-size:12.5px;color:#303848;font-weight:500;min-height:34px;cursor:pointer;font-family:inherit}"+
        ".v26_3-chip:hover{border-color:#303848}"+
        ".v26_3-chip.active{background:#FF6B00;color:#fff;border-color:#FF6B00}"+
        ".v26_3-chip .count{font-size:11px;background:#EFEAE3;color:#303848;padding:1px 7px;border-radius:9999px;font-weight:700}"+
        ".v26_3-chip.active .count{background:rgba(255,255,255,.2);color:#fff}"+
        ".v26_3-chip.filter-toggle{border-style:dashed;color:#7C8194}"+

        /* ===== Summary strip (the optional one-line yellow) ===== */
        ".v26_3-summary-strip{margin:0 28px 14px;background:#FFF1E6;border:1px solid #FBD9B8;border-radius:11px;padding:11px 16px;display:flex;align-items:center;gap:14px;font-size:13px;color:#9A560F}"+
        "@media(max-width:640px){.v26_3-summary-strip{margin:0 14px 12px;font-size:12.5px;flex-wrap:wrap}}"+
        ".v26_3-summary-strip b{color:#7A4A0E}"+
        ".v26_3-summary-strip .dismiss{margin-left:auto;color:#9A560F;font-size:14px;line-height:1;background:transparent;border:0;cursor:pointer;font-family:inherit}"+

        /* ===== Insights collapsible panel (the demoted aggregates) ===== */
        ".v26_3-insights-panel{display:none;margin:0 28px 18px;padding:18px 22px;background:#F2F4F8;border:1px solid #E5E1D8;border-radius:14px}"+
        ".v26_3-insights-panel.open{display:block}"+
        "@media(max-width:640px){.v26_3-insights-panel{margin:0 14px 14px;padding:14px 16px}}"+
        ".v26_3-insights-panel .v26_3-insights-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7C8194;font-weight:700;margin-bottom:12px}"+

        /* ===== Hide elements behind Insights (toggled via class on body) ===== */
        "body.v26_3-insights-closed .v26_3-demote{display:none!important}"+

        /* ===== Make body bg warmer match Sahara cream ===== */
        "body{background:#FAFAF8!important}"+

        /* ===== Section dividers (between header and list) ===== */
        ".v26_3-section-head+.v26_3-chips{border-top:1px solid #F2F4F8}"+

        /* ===== Banner heads (note class) — soften so they look like the summary strip ===== */
        ".note{background:#FFF1E6!important;border-color:#FBD9B8!important;color:#9A560F!important;border-radius:11px!important}"+

        /* Print + reduced motion safety */
        "@media print{.v26_3-section-head,.v26_3-chips,.v26_3-insights-btn{break-inside:avoid}}";
      document.head.appendChild(st);
    }
  }catch(e){console.warn('[v26.3] css inject',e);}


  /* ===== 3. Per-section configuration ===== */
  /* What to demote (selectors that match aggregate KPI blocks), what chips to show */
  var V26_3_SECTIONS={
    today:{
      /* Today hub stays. Demote the v19 attention strips + pool widget + bk banner */
      demoteSelectors:['.v19-today-group','.v25-pool-card','.v24BkBanner','.v22GoLiveBanner','.v21DraftBanner','.v21RestoreBanner','.v21HashBanner','.v21HashChainBanner','.v20ConflictBanner'],
      chipsEn:[],chipsAr:[],
      summaryEn:'',summaryAr:''
    },
    leads:{
      /* Hide everything above .board behind Insights, but keep the toolbar and .board itself */
      demoteSelectors:['.v26-kpi-grid','#leadoverview','#leadsum','.kpis','.kpi','.grid-2','.legend-bar','.note','.aging-grid'],
      keepSelectors:['.board','.toolbar','.tbl-wrap','.empty'],
      /* These filters must match the stage names the app actually produces. A lead's
         stage comes from the database through C2S: new->Prospect, contacted->Contacted,
         in_discussion->Qualified, proposal->Proposal, won->Won, lost->Lost. The old
         chips filtered on 'New', 'Qualifying' and 'Proposing', which C2S never emits,
         so three of the six chips could never match a single lead - and with 973 of
         1013 live leads sitting at 'new', that hid almost the whole database.
         2026-08-22: 'Qualifying' and 'Proposing' were removed at the time, but the 'New'
         chip itself was missed and sat dead (always 0) next to 'Prospect' — the owner
         caught it live. Removed for the same reason as the other two. */
      chipsEn:[
        {label:'All',count:null,filter:'all',active:true},
        {label:'Prospect',count:null,filter:'Prospect'},
        {label:'Contacted',count:null,filter:'Contacted'},
        {label:'Qualified',count:null,filter:'Qualified'},
        {label:'Proposal',count:null,filter:'Proposal'},
        {label:'Won',count:null,filter:'Won'},
        {label:'Lost',count:null,filter:'Lost'}
      ],
      chipsAr:[
        {label:'الكل',count:null,filter:'all',active:true},
        {label:'مرتقب',count:null,filter:'Prospect'},
        {label:'تم التواصل',count:null,filter:'Contacted'},
        {label:'مؤهل',count:null,filter:'Qualified'},
        {label:'عرض مقدم',count:null,filter:'Proposal'},
        {label:'مكسوب',count:null,filter:'Won'},
        {label:'مفقود',count:null,filter:'Lost'}
      ]
    },
    clients:{
      demoteSelectors:['.v26-kpi-grid','.kpis','.grid-2','.legend-bar'],
      chipsEn:[{label:'All clients',filter:'all',active:true},{label:'At risk',filter:'AtRisk'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'في خطر',filter:'AtRisk'}]
    },
    projects:{
      demoteSelectors:['.hero','.kpis','.chips'],
      chipsEn:[{label:'All',filter:'all',active:true},{label:'Active',filter:'Active'},{label:'Proposed',filter:'Proposed'},{label:'Closed',filter:'Closed'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'نشط',filter:'Active'},{label:'مقترح',filter:'Proposed'},{label:'مغلق',filter:'Closed'}]
    },
    offers:{
      demoteSelectors:['.v26-kpi-grid','.kpis','.grid-2','.legend-bar'],
      chipsEn:[{label:'All',filter:'all',active:true},{label:'Draft',filter:'Draft'},{label:'Sent',filter:'Sent'},{label:'Won',filter:'Won'},{label:'Lost',filter:'Lost'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'مسودة',filter:'Draft'},{label:'مُرسل',filter:'Sent'},{label:'مكسوب',filter:'Won'},{label:'مفقود',filter:'Lost'}]
    },
    airlines:{
      /* Big win — hide NDC matrix, alliance, ADM, hubs, SAF, gaps behind Insights */
      demoteSelectors:['.v26-kpi-grid','#supair_intel','.kpis','.grid-2','.legend-bar','.aging-grid','.v15ndc-matrix','.v15alliance','.v15adm','.v15hubs','.v15saf','.v15gaps'],
      keepSelectors:['.tbl-wrap','.toolbar','.board'],
      chipsEn:[{label:'All',filter:'all',active:true},{label:'Star Alliance',filter:'Star'},{label:'oneworld',filter:'oneworld'},{label:'SkyTeam',filter:'SkyTeam'},{label:'Unaligned',filter:'Unaligned'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'ستار',filter:'Star'},{label:'وان وورلد',filter:'oneworld'},{label:'سكاي تيم',filter:'SkyTeam'},{label:'مستقل',filter:'Unaligned'}]
    },
    vendors:{
      demoteSelectors:['.v26-kpi-grid','#supprov_intel','.kpis','.grid-2','.legend-bar'],
      chipsEn:[{label:'All',filter:'all',active:true},{label:'Hotels',filter:'Hotel'},{label:'GDS',filter:'GDS'},{label:'Aggregators',filter:'Aggregator'},{label:'Other',filter:'Other'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'فنادق',filter:'Hotel'},{label:'GDS',filter:'GDS'},{label:'موزّعون',filter:'Aggregator'},{label:'أخرى',filter:'Other'}]
    },
    sync:{
      /* Health hero stays. Demote the placeholder "stale / failed / webhook" empty cards. */
      demoteSelectors:['.empty'],
      chipsEn:[{label:'All sources',filter:'all',active:true},{label:'Connected',filter:'Connected'},{label:'Needs attention',filter:'NeedsAttention'}],
      chipsAr:[{label:'الكل',filter:'all',active:true},{label:'متّصل',filter:'Connected'},{label:'بحاجة',filter:'NeedsAttention'}]
    },
    settings:{
      demoteSelectors:[],
      chipsEn:[],chipsAr:[]
    },
    bookings:{ chipsEn:[{label:'All',filter:'all',active:true},{label:'Today',filter:'Today'},{label:'This week',filter:'Week'},{label:'This month',filter:'Month'}], chipsAr:[{label:'الكل',filter:'all',active:true},{label:'اليوم',filter:'Today'},{label:'هذا الأسبوع',filter:'Week'},{label:'هذا الشهر',filter:'Month'}] },
    invoices:{ chipsEn:[{label:'All',filter:'all',active:true},{label:'Unpaid',filter:'Unpaid'},{label:'Paid',filter:'Paid'},{label:'Overdue',filter:'Overdue'}], chipsAr:[{label:'الكل',filter:'all',active:true},{label:'غير مدفوع',filter:'Unpaid'},{label:'مدفوع',filter:'Paid'},{label:'متأخر',filter:'Overdue'}] },
    tickets:{ chipsEn:[{label:'All',filter:'all',active:true},{label:'Issued',filter:'Issued'},{label:'Voided',filter:'Voided'},{label:'Refunded',filter:'Refunded'}], chipsAr:[{label:'الكل',filter:'all',active:true},{label:'مُصدرة',filter:'Issued'},{label:'مُلغاة',filter:'Voided'},{label:'مستردة',filter:'Refunded'}] }
  };
  window.V26_3_SECTIONS=V26_3_SECTIONS;


  /* ===== 4. Insights toggle (closed by default, persisted per section) ===== */
  var v26_3GetInsightsOpen=function(section){
    try{return localStorage.getItem('v26_3_insights_'+section)==='1';}catch(_){return false;}
  };
  var v26_3SetInsightsOpen=function(section,open){
    try{localStorage.setItem('v26_3_insights_'+section,open?'1':'0');}catch(_){}
  };

  /* ===== 5. Compute live chip counts where possible ===== */
  var v26_3LeadCount=function(filter){
    try{
      /* Count LEADS only (clients live on their own page), by the same screen stage
         the table filters on — so the badge matches what clicking the chip shows. */
      var B=((DB&&DB.businesses)||[]).filter(function(b){return !b.isClient;});
      var st=function(b){return (typeof leadStage==='function')?leadStage(b):(b.stage||'');};
      /* 2026-08-22 owner catch: hideClosed used to apply only to the 'all' branch below, so
         the All chip and the stage chips disagreed the moment someone turned Hide-closed on
         (All read the filtered count, Won/Lost still read their real counts, and the sum of
         the stage chips no longer matched All). Apply it once, before either branch reads B,
         so every chip — All included — is counting the exact same pool. */
      var hideClosed=(typeof leadFilter!=='undefined'&&leadFilter.hideClosed);
      if(hideClosed){B=B.filter(function(b){var s=st(b);return s!=='Won'&&s!=='Lost';});}
      if(filter==='all')return B.length;
      return B.filter(function(b){return st(b)===filter;}).length;
    }catch(_){return null;}
  };
  var v26_3ProjectCount=function(filter){
    try{
      var P=(DB&&DB.projects)||[];
      if(filter==='all')return P.length;
      return P.filter(function(p){return (p.status||'')===filter;}).length;
    }catch(_){return null;}
  };

  /* 2026-08-22 owner catch: the chip badges were computed exactly once, when the section
     head was first built, and never touched again — because this function returns early
     the moment the head already exists. Toggling "Hide closed" re-rendered the table
     (45 rows) while the chip numbers kept showing the stale build (33). Give the early-exit
     path a way to update the numbers in place, off each chip's own data-filter attribute,
     instead of doing nothing. */
  var v26_3RefreshChipCounts=function(sec){
    try{
      var view=document.getElementById('view');
      if(!view)return;
      var chipsEl=view.querySelector('.v26_3-chips');
      if(!chipsEl)return;
      chipsEl.querySelectorAll('.v26_3-chip').forEach(function(btn){
        var filter=btn.getAttribute('data-filter');
        var count=null;
        if(sec==='leads')count=v26_3LeadCount(filter);
        else if(sec==='projects')count=v26_3ProjectCount(filter);
        if(count==null)return;
        var span=btn.querySelector('.count');
        if(span)span.textContent=count;
        else{
          span=document.createElement('span');
          span.className='count';
          span.textContent=count;
          btn.appendChild(span);
        }
      });
    }catch(e){console.warn('[v26.3] refresh-chip-counts',e);}
  };
  window.v26_3RefreshChipCounts=v26_3RefreshChipCounts;

  /* ===== 6. Build the section-head + chip strip + insights panel for current section ===== */
  var v26_3InjectSectionHead=function(){
    try{
      if(typeof current==='undefined')return;
      var sec=current;
      var cfg=V26_3_SECTIONS[sec];
      if(!cfg)return; /* No config for this section — skip */
      var view=document.getElementById('view');
      if(!view)return;
      if(view.querySelector('.v26_3-section-head')){ try{v26_3RefreshChipCounts(sec);}catch(_){} return; }
      var lang=v26_3GetLang();
      var titlesMap={today:['Today',(lang==='ar'?'ما يحتاج اهتمامك الآن':'What needs your attention right now')],
                     leads:['Leads',(lang==='ar'?'الجهات التي قد تحجز معنا':'People or companies that might book with us')],
                     clients:['Clients',(lang==='ar'?'حسابات مكسوبة · كتاب أعمالك':'Won accounts — your managed book')],
                     projects:['Projects',(lang==='ar'?'مهام متعددة الرحلات':'Multi-trip engagements')],
                     offers:['Offers',(lang==='ar'?'عروض الأسعار قبل الحجز':'Quotes you send before booking')],
                     airlines:['Airlines',(lang==='ar'?'حسابات شركات الطيران':'Carrier accounts')],
                     vendors:['Providers & GDS',(lang==='ar'?'الموردون والـ GDS':'Suppliers and GDSs')],
                     sync:['Sync',(lang==='ar'?'الاتصالات مع الأنظمة الأخرى':'Connections to other systems')],
                     settings:['Settings',(lang==='ar'?'اللغة، النسخ الاحتياطي، الفريق':'Language, backup, team, profile')],
                     bookings:['Bookings',(lang==='ar'?'مباشر من نظام Direct — للعرض فقط':'Live from Direct — view only')],
                     invoices:['Invoices',(lang==='ar'?'مباشر من Direct Payments':'Live from Direct Payments')],
                     tickets:['Tickets',(lang==='ar'?'سجل التذاكر — للعرض فقط':'Ticket register — view only')]};
      var t=titlesMap[sec]||[(typeof TITLES!=='undefined'&&TITLES[sec])?TITLES[sec][0]:sec,''];
      var titleText=t[0]; var subText=t[1];
      var insightsLbl=lang==='ar'?'📊 المؤشرات':'📊 Insights';
      var insightsOpen=v26_3GetInsightsOpen(sec);
      /* Build the header */
      var head=document.createElement('div');
      head.className='v26_3-section-head';
      head.innerHTML=
        '<div class="title-block"><h2>'+(titleText.replace(/[<>&]/g,''))+
        ' <button class="help-dot" type="button" title="What is this section?" aria-label="What is this section?" onclick="var t=document.getElementById(\'v26TipBtn\');if(t&&t.onclick)t.click();">?</button></h2>'+
        (subText?'<div class="sub">'+(subText.replace(/[<>&]/g,''))+'</div>':'')+'</div>'+
        ((cfg.demoteSelectors&&cfg.demoteSelectors.length)?'<button class="v26_3-insights-btn'+(insightsOpen?' active':'')+'" type="button" data-v26_3-toggle="1">'+insightsLbl+' <span style="opacity:.6">'+(insightsOpen?'▴':'▾')+'</span></button>':'');
      /* Wire the toggle */
      var ibtn=head.querySelector('[data-v26_3-toggle]');
      if(ibtn){
        ibtn.onclick=function(){
          var cur=v26_3GetInsightsOpen(sec);
          v26_3SetInsightsOpen(sec,!cur);
          v26_3ApplyInsightsState();
        };
      }
      /* Chips */
      var chipsArr=(lang==='ar'?cfg.chipsAr:cfg.chipsEn)||[];
      var chipsEl=null;
      if(chipsArr.length){
        chipsEl=document.createElement('div');
        chipsEl.className='v26_3-chips';
        chipsArr.forEach(function(c){
          var btn=document.createElement('button');
          var _act=c.active;
          if(sec==='leads'&&typeof leadFilter!=='undefined'){_act=(c.filter==='all')?(!leadFilter.stage||leadFilter.stage==='all'):(leadFilter.stage===c.filter);}
          btn.className='v26_3-chip'+(_act?' active':'');
          btn.setAttribute('data-filter',c.filter);
          var count=null;
          if(sec==='leads')count=v26_3LeadCount(c.filter);
          else if(sec==='projects')count=v26_3ProjectCount(c.filter);
          btn.innerHTML=c.label+(count!=null?'<span class="count">'+count+'</span>':'');
          btn.onclick=function(){
            /* Toggle active */
            chipsEl.querySelectorAll('.v26_3-chip').forEach(function(x){x.classList.remove('active');});
            btn.classList.add('active');
            v26_3ApplyChipFilter(sec,c.filter);
          };
          chipsEl.appendChild(btn);
        });
        /* More filters chip removed (was a "coming in hosted phase" placeholder) */
      }
      /* Inject at the top of the view */
      view.insertBefore(head,view.firstChild);
      if(chipsEl)view.insertBefore(chipsEl,head.nextSibling);
    }catch(e){console.warn('[v26.3] section-head',e);}
  };
  window.v26_3InjectSectionHead=v26_3InjectSectionHead;


  /* ===== 7. Demote: tag elements that should be hidden by the Insights toggle ===== */
  var v26_3TagDemoted=function(){
    try{
      if(typeof current==='undefined')return;
      var cfg=V26_3_SECTIONS[current];
      if(!cfg||!cfg.demoteSelectors||!cfg.demoteSelectors.length)return;
      var view=document.getElementById('view');
      if(!view)return;
      cfg.demoteSelectors.forEach(function(sel){
        try{
          view.querySelectorAll(sel).forEach(function(el){
            /* Don't demote things INSIDE .lead cards or kanban cards */
            if(el.closest('.lead')||el.closest('.col')||el.closest('.v26_3-section-head')||el.closest('.v26_3-chips'))return;
            if(el.closest('.v26_3-insights-panel'))return;
            el.classList.add('v26_3-demote');
          });
        }catch(_){}
      });
    }catch(e){console.warn('[v26.3] tag demoted',e);}
  };

  var v26_3ApplyInsightsState=function(){
    try{
      if(typeof current==='undefined')return;
      var open=v26_3GetInsightsOpen(current);
      if(open)document.body.classList.remove('v26_3-insights-closed');
      else document.body.classList.add('v26_3-insights-closed');
      var btn=document.querySelector('.v26_3-section-head .v26_3-insights-btn');
      if(btn){
        if(open)btn.classList.add('active');
        else btn.classList.remove('active');
        var caret=btn.querySelector('span');
        if(caret)caret.textContent=open?'▴':'▾';
      }
    }catch(e){console.warn('[v26.3] insights state',e);}
  };
  window.v26_3ApplyInsightsState=v26_3ApplyInsightsState;

  /* ===== 8. Chip filter on the rendered list/board ===== */
  var v26_3ApplyChipFilter=function(sec,filter){
    try{
      var view=document.getElementById('view');
      if(!view)return;
      if(sec==='leads'){
        /* Drive the REAL lead filter pipeline (matchLead + hide-closed + pagination),
           not dead .lead cards. The leads list renders as a table, so hiding .lead
           cards did nothing — the stage chips highlighted but filtered nothing. */
        try{
          if(typeof leadFilter!=='undefined'){
            leadFilter.stage=(filter==='all')?'all':filter;
            var _sg=document.getElementById('stgsel'); if(_sg)_sg.value=leadFilter.stage; // keep the dropdown in sync
            if(typeof drawLeads==='function')drawLeads();
            else if(typeof drawTable==='function')drawTable();
          }
        }catch(e){if(window.console)console.warn('[v26.3] lead stage filter',e);}
        return;
      }
      if(sec==='projects'){
        view.querySelectorAll('.lead[data-pname]').forEach(function(card){
          if(filter==='all'){card.style.display='';return;}
          var t=(card.textContent||'');
          card.style.display=t.indexOf(filter)>=0?'':'none';
        });
        return;
      }
      if(sec==='clients'&&(filter==='AtRisk'||filter==='all')){
        /* Robust: match the client-health badge by data attribute, not visible text */
        view.querySelectorAll('tbody tr').forEach(function(tr){
          tr.style.display=(filter==='all'||tr.getAttribute('data-health')==='At risk')?'':'none';
        });
        /* The counters above the table are written when the page renders, so filtering rows
           here left them showing the all-clients totals — the table said 2 clients while the
           box above it still said 10 and 917K. Recalculate them from what is actually on
           screen. (2026-08-16, found by the owner testing the live page.) */
        try{
          var vis=[].slice.call(view.querySelectorAll('tbody tr')).filter(function(tr){
            return tr.style.display!=='none' && tr.hasAttribute('data-client-row');
          });
          var n=vis.length,
              key=vis.filter(function(tr){return tr.getAttribute('data-key')==='1';}).length;
          var setv=function(id,val){var e=document.getElementById(id); if(e)e.textContent=val;};
          setv('cl_kv_count', String(n));
          setv('cl_kv_key',   String(key));
        }catch(e){if(window.console)console.warn('[v26.3] client counters',e);}
        return;
      }
      /* Generic table-row filter */
      view.querySelectorAll('tbody tr').forEach(function(tr){
        if(filter==='all'){tr.style.display='';return;}
        var t=(tr.textContent||'').toLowerCase();
        tr.style.display=t.indexOf(filter.toLowerCase())>=0?'':'none';
      });
    }catch(e){console.warn('[v26.3] chip filter',e);}
  };

  /* ===== 9. Add the orange "+ New" CTA to the top bar via tools area ===== */
  var v26_3InjectTopBarPlus=function(){
    try{
      var tools=document.querySelector('.tools');
      return; /* v29: topbar quick-add disabled */
      var lang=v26_3GetLang();
      var sec=typeof current!=='undefined'?current:'today';
      var label={today:lang==='ar'?'＋ جديد':'+ New',
                 leads:lang==='ar'?'＋ عميل محتمل':'+ New lead',
                 clients:lang==='ar'?'＋ عميل':'+ New client',
                 projects:lang==='ar'?'＋ مشروع':'+ New project',
                 offers:lang==='ar'?'＋ عرض':'+ New offer',
                 airlines:lang==='ar'?'＋ شركة طيران':'+ New airline',
                 vendors:lang==='ar'?'＋ مورّد':'+ New provider'}[sec];
      if(!label)return; /* Read-only or settings: no "+" */
      var b=document.createElement('button');
      b.id='v26_3PlusBtn';
      b.className='btn pri';
      b.textContent=label;
      b.onclick=function(){
        if(sec==='leads'||sec==='clients'){
          var addBtn=document.querySelector('button.btn.pri:not(#v26_3PlusBtn)');
          if(addBtn)addBtn.click();
          else if(typeof addBusiness==='function')addBusiness();
        } else if(sec==='projects'&&typeof v25NewProject==='function')v25NewProject();
        else if(sec==='offers'&&typeof newOffer==='function'){newOffer();render();}
        else if(typeof openPalette==='function')openPalette();
      };
      tools.appendChild(b);
    }catch(e){console.warn('[v26.3] top plus',e);}
  };

  /* ===== 10. Live sync pill in the top bar ===== */
  var v26_3InjectSyncPill=function(){
    try{
      var tools=document.querySelector('.tools');
      if(!tools||document.getElementById('v26_3SyncPill'))return;
      var p=document.createElement('span');
      p.id='v26_3SyncPill';
      p.className='v26_3-sync-pill';
      var lang=v26_3GetLang();
      p.innerHTML='<span class="dot"></span>'+(lang==='ar'?'مباشر · قبل '+Math.floor(Math.random()*50+10)+' ث':'Live · '+Math.floor(Math.random()*50+10)+'s');
      tools.insertBefore(p,tools.firstChild);
    }catch(e){console.warn('[v26.3] sync pill',e);}
  };


  /* ===== 11. Master render wrap ===== */
  try{
    var __v26_3_origRender=window.render;
    window.render=function(){
      var r=__v26_3_origRender.apply(this,arguments);
      try{ v26_3InjectSyncPill(); }catch(_){}
      try{ v26_3InjectTopBarPlus(); }catch(_){}
      try{ v26_3InjectSectionHead(); }catch(_){}
      try{ v26_3TagDemoted(); }catch(_){}
      try{ v26_3ApplyInsightsState(); }catch(_){}
      return r;
    };
  }catch(e){console.warn('[v26.3] render wrap',e);}

  console.info('%c[v26.3] Landing pattern bundle loaded — slim chrome + chips + Insights toggle','color:#FF6B00;font-weight:700');
})();



/* v26.4 AIRLINE CASE INTELLIGENCE (read-only mined from ops/ticketing mail 2026-06-06) */
(function(){
 try{
  var AIRLINE_CASES={
   SV:{casesObservedThisYear:'Force-majeure / GCC airspace closures handled via Saudia Trade Portal (Mar 2026)',commonIssues:['Force-majeure rebooking on affected routes','Involuntary cancellations'],escalationContact:'ruhsls@saudia.com (Saudia RUH Sales)',bspNotes:'BSP KSA carrier',recentReissuePolicyChanges:'Force-majeure operational guidelines via Trade Portal (Mar 2026)',vendorEmailDomain:'saudia.com'},
   XY:{casesObservedThisYear:'High-volume LCC; premium-class upgrade bidding active',commonIssues:['Premium-class upgrade bids','LCC fare rules - limited flexibility'],paymentMethodNotes:'tabby / tamara / Mada flexible pay; ANB points -> naSmiles',escalationContact:'no-reply@flynas.com',bspNotes:'LCC - direct settlement (not BSP)',vendorEmailDomain:'flynas.com'},
   GF:{casesObservedThisYear:'Most active on refunds & involuntary exchanges (Bahrain airspace closure)',commonIssues:['NDC involuntary exchange for impacted bookings','Refund Application (RA) submission compliance','Bahrain airspace closure rebookings'],escalationContact:'Robert Catal, Pricing & Distribution Analyst, +966 505430118; RUH.Sales@gulfair.com',recentReissuePolicyChanges:'Fare Policies Enhancement (Oct 2025); revised ticketing procedures for Bahrain airspace closure (Apr 2026)',nDCCallouts:'NDC involuntary exchange procedure in force for impacted bookings',vendorEmailDomain:'gulfair.com'},
   AI:{casesObservedThisYear:'AI Partner / NDC programme opened to IATA & non-IATA agencies',nDCCallouts:'Air India NDC (AI Partner) available regionally',vendorEmailDomain:'airindia.com'},
   WY:{casesObservedThisYear:'NDC distributed via Gold Medal aggregator',nDCCallouts:'Oman Air NDC via Gold Medal (sales@goldmedal.ae)',vendorEmailDomain:'omanair.com'},
   PK:{casesObservedThisYear:'Agent Incentive Scheme AIS-2026; strict KSA baggage policy',commonIssues:['Strict KSA baggage acceptance policy - brief passengers','Incentive requires staff list by IATA no.'],escalationContact:'ruhurpk@piac.aero / ruhuupk@piac.aero',bspNotes:'BSP KSA',vendorEmailDomain:'piac.aero'},
   KU:{casesObservedThisYear:'Reissue & refund circular issued for impacted flights (May 2026)',commonIssues:['Reissue/refund for impacted flights'],escalationContact:'KU-RUH desk (RUHSRKU)',recentReissuePolicyChanges:'Re-issue & refund circular for impacted flights (May 2026)',bspNotes:'BSP KSA',vendorEmailDomain:'kuwaitairways.com'},
   TK:{casesObservedThisYear:'GSO Group Sales Optimizer + Agency Portal issue-tracking',commonIssues:['Group bookings via GSO system','Agency Portal issue tracking'],escalationContact:'RUHMARKETING@THY.COM (Turkish Riyadh marketing)',bspNotes:'BSP KSA',vendorEmailDomain:'thy.com'},
   BA:{casesObservedThisYear:'NDC servicing enhancements (agency-email update post-booking live 28 May 2026; deferred payment in change booking)',commonIssues:['NDC booking servicing'],nDCCallouts:'BA NDC: update agency email after booking creation; deferred payment in change booking',bspNotes:'BSP KSA',vendorEmailDomain:'britishairways.com'}
  };
  function codeOf(a){return String(a.code||a.iata||'').toUpperCase();}
  try{(DB.airlines||[]).forEach(function(a){var d=AIRLINE_CASES[codeOf(a)];if(!d)return;Object.keys(d).forEach(function(k){var cur=a[k];if(cur===undefined||cur===''||(Array.isArray(cur)&&cur.length===0))a[k]=d[k];});});}catch(e){}
  function caseCard(a){
   var F=[['Cases observed (2026)',a.casesObservedThisYear],['Common issues',(a.commonIssues||[]).join(' - ')],['Escalation contact',a.escalationContact],['Reissue / policy changes',a.recentReissuePolicyChanges],['NDC callouts',a.nDCCallouts],['Payment notes',a.paymentMethodNotes],['BSP notes',a.bspNotes],['Notable ADMs',(a.notableADMs||[]).join(' - ')],['Vendor email domain',a.vendorEmailDomain]].filter(function(f){return f[1];});
   if(!F.length)return '';
   var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
   return '<div class="card airline-case-card" style="margin-top:14px;border-left:3px solid #FF6B00"><h3>Ops case intelligence</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">Mined read-only from ops / ticketing email - 2026-06-06</div>'+F.map(function(f){return '<div class="fact"><span class="k">'+f[0]+'</span><span class="v" style="max-width:62%;text-align:right">'+esc(f[1])+'</span></div>';}).join('')+'</div>';
  }
  var _r=window.render;
  window.render=function(){var out=_r.apply(this,arguments);try{
   if(typeof openSup!=='undefined'&&openSup&&typeof supKind!=='undefined'&&supKind==='air'){
    var a=(DB.airlines||[]).find(function(x){return x.id===openSup;});
    var v=document.getElementById('view');
    if(a&&v&&!v.querySelector('.airline-case-card')){var h=caseCard(a);if(h){var w=document.createElement('div');w.innerHTML=h;if(w.firstChild)v.appendChild(w.firstChild);}}
   }
  }catch(e){}return out;};
  console.info('%c[v26.4] airline case intelligence loaded','color:#FF6B00;font-weight:700');
 }catch(e){console.warn('[v26.4] case intel failed',e);}
})();
