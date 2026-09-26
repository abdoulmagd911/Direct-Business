/* ===== v26.6 ticketing@ airline cases + Provider verdicts + Agency profile spreads (additive; read-only mined 2026-06-06) ===== */
(function(){
 try{
  // A. extra airline cases from ticketing@ inbox
  var MORE_AIR={
   FZ:{casesObservedThisYear:'Schedule-change misconnection reaccommodation (flydubai disruptions; rebooking by ticket stock 141/169/275/365)',commonIssues:['Schedule change / misconnection reaccommodation'],escalationContact:'fzGDS desk (flydubai)',recentReissuePolicyChanges:'FZ rebooking policy for misconnections per ticket stock',vendorEmailDomain:'flydubai.com'},
   PK:{nDCCallouts:'Airline-initiated schedule changes flagged proactively via Duffel order alerts'}
  };
  try{(DB.airlines||[]).forEach(function(a){var c=String(a.code||'').toUpperCase();var d=MORE_AIR[c];if(d)Object.keys(d).forEach(function(k){if(d[k]&&(a[k]===undefined||a[k]===''||(Array.isArray(a[k])&&!a[k].length)))a[k]=d[k];});});}catch(e){}

  // B. provider verdicts (from Drive "Provider's Evaluations" sheet)
  var PV={
   'Travelfusion':{verdict:'Keep',note:'Link our IATA to any TF airline via B2B credentials; economy/LCC; email reply <=1 day.'},
   'Akbar':{verdict:'Keep',note:'Cheaper than airlines on many routes; recurring Russia payment/booking-fail issues.'},
   'Babylon':{verdict:'Keep',note:'Connects via IRIX (not direct); carries LCC content; combines strengths of all providers.',connection:'IRIX'},
   'Kiwi':{verdict:'Upgrade',note:'#1 in affiliation - upgrade in progress.'},
   'SkyScanner':{verdict:'Upgrade',note:'#3 in affiliation - upgrade in progress.'},
   'Trip.com':{verdict:'Upgrade',note:'Upgrade in progress; handles name-amendment cases via support.'},
   'FR24 Flights':{verdict:'Deprecated',note:'Being phased out - better alternatives found.'},
   'flynas24':{verdict:'Deprecated',note:'Being phased out - better alternatives found.'},
   'Dnata':{verdict:'Deprecated',note:'Being phased out - better alternatives found.'}
  };
  // merge verdict onto EXISTING vendor records only (no new records -> suites unaffected)
  try{(DB.vendors||[]).forEach(function(x){var nm=(x.name||'');var k=Object.keys(PV).find(function(p){return p.toLowerCase()===nm.toLowerCase();});if(k&&!x.verdict){x.verdict=PV[k].verdict;x.verdictNote=PV[k].note;if(PV[k].connection&&!x.connection)x.connection=PV[k].connection;}});}catch(e){}
  var keepL=[],upL=[],depL=[];Object.keys(PV).forEach(function(p){if(PV[p].verdict==='Keep')keepL.push(p);else if(PV[p].verdict==='Upgrade')upL.push(p);else depL.push(p);});
  /* one source for the verdicts — js/96 reads this rather than keeping a second copy that drifts (#182) */
  try{window.DT_PROVIDER_VERDICTS=PV;window.DT_PROVIDERS_PHASING_OUT=depL.slice();}catch(_){}

  // helpers
  function awardsStrip(){return '';return '<div class="dt-awards-row" style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0">'+
    [].map(function(a){return '<span style="background:#FFF1E6;color:#A9781A;border:1px solid #F4C892;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">'+a+'</span>';}).join('')+'</div>';}
  /* 2026-09-21 (fire #161): this card was hidden by v29 ("talking-points card hidden for now") and
     everything below the return was already dead — but its list still carried a hardcoded IATA
     number, a digit short of the company's real one, in a public repository. Dead code is not a
     reason to keep real identifiers in the repo, and a hidden card is not a reason to keep a wrong
     number where somebody might one day un-hide it. The function keeps its shape and its silence. */
  function talkingPoints(){ return ''; }


  /* 2026-09-20 (fire #139) — the badge list and the Compliance row below are HARD-CODED, and this
     page is sent to clients and attached to tenders. The company_identity registry — the owner's
     own instrument, shown on the Generator's Renewals radar — said on the day this was written that
     PCI DSS expired 2026-07-14 and DUNS expired 2025-09-10, and that BOTH carry
     show_on_documents = false. The document advertised them anyway, because nothing here ever asked.
     A hard-coded list was overriding an explicit instruction in the database.
     Now every credential named below is checked against the registry and dropped if the registry
     says it has expired or must not appear on documents. Two deliberate choices:
       · the person GENERATING the document is told what was dropped and why, in a .noprint box, so
         a registry row that is merely out of date can be corrected — the client never sees it;
       · if the registry has not loaded, nothing is silently filtered and the box says the list
         could not be checked, the same way v21AgencyHeader refuses to pretend (core-06, round 41).
     Deliberately NOT touched: nothing is ever ADDED to the document from the registry. Leaving a
     true claim off is a small loss; putting a false one on a tender is not. */
  function v29CredFacts(){
    try{ return (typeof window.dgCredentialFacts==='function')?window.dgCredentialFacts():{loaded:false,rows:[]}; }
    catch(_){ return {loaded:false,rows:[]}; }
  }
  function v29Compact(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  /* returns the registry row that forbids this text, or null. Matching is by compacted name in
     either direction, with a 4-character floor so a short token like "CR" cannot match a long
     label by accident. */
  function v29Blocked(text,facts){
    var c=v29Compact(text); if(c.length<4) return null;
    var hit=null;
    (facts.rows||[]).forEach(function(r){
      if(hit) return;
      var rc=v29Compact(r.label_en); if(rc.length<4) return;
      if(c.indexOf(rc)<0 && rc.indexOf(c)<0) return;
      if(r.expired) hit={row:r,why:'expired '+r.expires_on};
      else if(!r.show_on_documents) hit={row:r,why:'marked "not on documents" in the registry'};
    });
    return hit;
  }
  // About one-pager (bilingual, printable)
  /* 2026-09-21 (fire #162) — the strip printed at the foot of the monthly report and on the last
     slide of the PowerPoint export. It used to be one hardcoded string, and it said three things it
     had no right to say: it claimed **PCI-DSS**, which this company's own registry records as
     EXPIRED (2026-07-14) and marked "not on documents" — the exact claim fire #139 stripped out of
     the one-pager, still printing here, on a report that goes to clients and into tenders; it
     carried an IATA number and an Amadeus office as literals in a public repository (rule 7); and
     its phone number was the older one, not the licence phone the registry holds.
     Now every part is asked of the registry and every credential is put through the same filter the
     one-pager uses, so the answer to "may we print this?" is the owner's own instrument, in one
     place, for every document. A part with no value, or one the registry blocks, simply is not
     printed — the strip never invents and never over-claims. */
  function rptFootBits(){
    var idv=function(k){ try{ return (typeof window.dgIdentityValue==='function')?String(window.dgIdentityValue(k,'en')||'').trim():''; }catch(_){ return ''; } };
    var facts=v29CredFacts(), out=[];
    var push=function(label,val){
      if(!val) return;
      if(facts.loaded && label && v29Blocked(label,facts)) return;      /* expired, or not for documents */
      out.push(label?(label+' '+val):val);
    };
    push('', idv('legal_name'));
    push('IATA', idv('iata'));
    push('Amadeus', idv('amadeus'));
    push('', idv('website'));
    push('', idv('phone_licence'));
    return out.join(' \u00b7 ');
  }
  /* the report builder below lives at the file's top level, outside this block — it reaches the
     helper (and, through it, the registry filter) the same way everything else here is reached */
  try{ window.rptFootBits=rptFootBits; }catch(_){}
  window.directAboutPage=function(tender){
    var A=(typeof AGENCY!=='undefined')?AGENCY:{};
    /* 2026-09-21 (fire #161) — every identifier on this page used to come from a literal written
       into core-06's AGENCY constant: the company's DUNS, Zakat/Tax ID, trade licence, Amadeus
       office and PIN, head-office address and phone, all sitting in a PUBLIC repository (rule 7),
       and all a second copy of what the registry already holds. Fire #160 showed where that ends —
       two of those copies had drifted a digit and were printing onto client documents. So: the
       registry is asked, and a fact with no value in it simply does not appear. Nothing here is
       remembered. When the registry has not loaded at all, the notice built below already says so
       in both languages and tells the person to open the Generator once and print again. */
    var _idv=function(k){ try{ return (typeof window.dgIdentityValue==='function')?window.dgIdentityValue(k,'en'):''; }catch(_){ return ''; } };
    var _row=function(label,val){ return String(val||'').trim()?[label,String(val).trim()]:null; };
    var _amadeus=_idv('amadeus');
    var _iata=_idv('iata')||A.iataWakeel||'';
    var _site=_idv('website'), _tel=_idv('phone_licence');
    var rows=[_row('Trade name',_idv('brand_name')||A.name_en),
      ['Experience','10+ years in Saudi B2B travel'],
      ['Scale','600+ airline agreements · 2.5M+ stays · TECHTIC tech subsidiary'],
      _row('IATA',_iata?(_iata+' — PAX accredited'):''),
      _row('Amadeus',_amadeus),
      _row('CR',_idv('cr_number')||A.cr), _row('VAT',_idv('vat_number')||A.vat),
      _row('DUNS',_idv('duns')), _row('Trade License',_idv('mot_licence')),
      _row('Unified number',_idv('unified_number')),
      ['Compliance','PCI-DSS · Bank Guarantee 750K SAR · DUNS registered'],
      _row('Address',_idv('hq_address')),
      _row('Contact',[_site,_tel].filter(Boolean).join(' · '))].filter(Boolean);
    var clients=['Saudi Red Crescent',"Ma'aden",'Saudi Ports Authority','Roads General Authority','Saudi Fund for Development','Ministry of Industry','Islamic University of Madinah'];
    var awards=['World Travel Award 2023','World Travel Award 2024','World Travel Award 2025','Great Place to Work x3','ICEF','English UK','British Council','IATA PAX 2026','PCI-DSS'];
    /* fire #139 — make the document obey the registry (see the note above this function) */
    var _facts=v29CredFacts(), _dropped=[];
    if(_facts.loaded){
      awards=awards.filter(function(a){ var b=v29Blocked(a,_facts); if(b){_dropped.push(a+' — '+b.why);} return !b; });
      rows=rows.map(function(r){
        if(String(r[0])!=='Compliance') return r;
        var parts=String(r[1]).split(' · ').filter(function(pt){
          var b=v29Blocked(pt,_facts); if(b){_dropped.push(pt+' — '+b.why);} return !b; });
        return [r[0], parts.join(' · ')];
      }).filter(function(r){ return !(String(r[0])==='Compliance' && !String(r[1]).trim()); });
    }
    /* the same credential can be dropped from two places (a badge and the Compliance line); the
       person reading the box wants it named once */
    _dropped=_dropped.filter(function(d,i){ return _dropped.indexOf(d)===i; });
    /* the box is bilingual like everything else a person reads here. Fire #125's lesson, made the
       hard way on a placeholder: a notice that only speaks English is a defect on an Arabic screen,
       and this one appears above an Arabic document. */
    var _nAr=(typeof LANG!=='undefined'&&LANG==='ar');
    var _box=function(inner){ return '<div class="noprint" dir="'+(_nAr?'rtl':'ltr')+'" style="background:#FFF8E6;border:1px solid #F4C892;border-radius:8px;padding:10px 13px;margin-bottom:12px;font-size:13px;color:#7a5c00;text-align:'+(_nAr?'right':'left')+'">'+inner+'</div>'; };
    var _notice = !_facts.loaded
      ? _box(_nAr
          ? '<b>⚠ تعذّر التحقق من قائمة الاعتمادات.</b> سجل الشركة لم يُحمّل، لذلك لم يُراجَع شيء في هذه الصفحة مقابله. افتح المولّد مرة ثم اطبع من جديد.'
          : '<b>⚠ The accreditation list could not be checked.</b> The company registry has not loaded, so nothing on this page has been verified against it. Open the Generator once, then print again.')
      : (_dropped.length
        ? _box((_nAr
            ? '<b>أُسقطت من هذه الوثيقة، لأن سجل شركتك يقول ذلك:</b>'
            : '<b>Left off this document, because your company registry says so:</b>')
          + '<br>'+_dropped.map(function(d){return '• '+d;}).join('<br>')+'<br><span style="color:#8a6d1a">'
          + (_nAr
            ? 'إن جُدّد أحدها، حدّثه في المولّد ← أصول الشركة والسجل ثم اطبع من جديد. العميل لا يرى هذا المربع.'
            : 'If one of these has been renewed, update it in Generator → Company assets &amp; registry and print again. The client does not see this box.')
          + '</span>')
        : '');
    var tenderBlock=tender?'<h2>Why Direct for your tender · لماذا دايركت</h2><p>A Saudi-accredited TMC with 10+ years of government & enterprise travel operations, 600+ airline agreements, 24/7 servicing, ZATCA-compliant invoicing, and an in-house technology subsidiary (TECHTIC). Trusted by Saudi Red Crescent, Ma\'aden and Saudi Ports Authority.</p>':'';
    var html='<!DOCTYPE html><meta charset="utf-8"><title>'+(tender?'Direct Travel — Tender One-Pager':'About Direct Travel')+'</title>'+
     '<style>body{font-family:Inter,Arial,sans-serif;color:#1C1E2B;max-width:820px;margin:24px auto;padding:0 24px;line-height:1.6}h1{color:#FF6B00;margin:0 0 2px;font-size:26px}h2{border-bottom:2px solid #FF6B00;padding-bottom:4px;margin-top:22px;font-size:16px}.ar{direction:rtl;text-align:right;font-family:Tajawal,Arial}.row{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.b{background:#FFF1E6;color:#A9781A;border:1px solid #F4C892;border-radius:20px;padding:3px 11px;font-size:12px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:13px}td{border:1px solid #eee;padding:7px 9px}.k{background:#faf7f2;font-weight:700;width:38%}@media print{.noprint{display:none}}</style>'+
     '<button class="noprint" onclick="window.print()" style="background:#FF6B00;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:14px">🖨 Print / Save as PDF</button>'+
     _notice+
     '<h1>Direct Travel · DirectKSA</h1>'+
     '<div class="ar" style="font-size:18px;font-weight:700">دايركت للسفر والسياحة</div>'+
     /* fire #162: the legal entity is the registry's to state, in each language, and the line is
        left out entirely when the registry has not answered — better a missing line than a
        remembered name that has been superseded. */
     (function(){
       var en='', ar='';
       try{ if(typeof window.dgIdentityValue==='function'){ en=String(window.dgIdentityValue('legal_name','en')||'').trim(); ar=String(window.dgIdentityValue('legal_name','ar')||'').trim(); } }catch(_){ }
       if(!en&&!ar) return '';
       return '<p>Legal entity: <b>'+esc(en||ar)+'</b>'+((ar&&ar!==en)?('<br><span class="ar">الاسم النظامي: '+esc(ar)+'</span>'):'')+'</p>';
     })()+
     awardsStrip()+tenderBlock+
     '<h2>At a glance · لمحة</h2><table>'+rows.map(function(r){return '<tr><td class="k">'+r[0]+'</td><td>'+r[1]+'</td></tr>';}).join('')+'</table>'+
     '<h2>Key clients · أبرز العملاء</h2><div class="row">'+clients.map(function(c){return '<span class="b">'+c+'</span>';}).join('')+'</div>'+
     '<h2>Awards &amp; accreditations · الجوائز والاعتمادات</h2><div class="row">'+awards.map(function(c){return '<span class="b">'+c+'</span>';}).join('')+'</div>';
    var w=window.open('','_blank'); if(!w){alert((typeof LANG!=='undefined'&&LANG==='ar')?'اسمح بالنوافذ المنبثقة لعرض الصفحة الواحدة.':'Allow popups to view the one-pager.');return;} w.document.write(html); w.document.close();
  };
  window.directTenderPage=function(){window.directAboutPage(true);};

  // render-wrap injections
  var _r=window.render;
  window.render=function(){var out=_r.apply(this,arguments);try{
    var cur=(typeof current!=='undefined')?current:null;
    var v=document.getElementById('view'); if(!v)return out;
    if((cur==='today'||cur==='dashboard'||cur==='leads')&&!v.querySelector('.dt-talk')&&!(typeof openLead!=='undefined'&&openLead)){
      var d=document.createElement('div'); d.className='dt-talk'; d.innerHTML=talkingPoints(); v.insertBefore(d,v.firstChild);
    }
    if(cur==='vendors'&&!v.querySelector('.dt-verdicts')){
      var _arPv=(typeof LANG!=='undefined'&&LANG==='ar');
      var b=document.createElement('div');b.className='dt-verdicts card';b.style.cssText='margin-bottom:12px;border-left:3px solid #FF6B00';
      b.innerHTML='<h3>'+(_arPv?'أحكام الموردين':'Provider verdicts')+'</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">'+(_arPv?'من بطاقة تقييم الموردين':'From the Provider Evaluations scorecard')+'</div><div style="font-size:13px;line-height:1.8">'+
        '<div><span style="color:#16B364;font-weight:700">'+(_arPv?'إبقاء:':'Keep:')+'</span> '+keepL.join(', ')+'</div>'+
        '<div><span style="color:#2E90FA;font-weight:700">'+(_arPv?'ترقية قيد التنفيذ:':'Upgrade in progress:')+'</span> '+upL.join(', ')+'</div>'+
        '<div><span style="color:#F0453A;font-weight:700">'+(_arPv?'إيقاف تدريجي:':'Deprecated (phasing out):')+'</span> '+depL.join(', ')+'</div></div>';
      v.insertBefore(b,v.firstChild);
    }
    /* 2026-09-20 (fire #182) — this line used to be:
         document.querySelectorAll('select option').forEach(o => { if (deprecated) o.remove(); })
       It ran on EVERY render, over EVERY <select> in the document, and silently deleted the option.
       Driven live: the "Provider / GDS" box opened with 24 suppliers including Dnata, and one
       render() later it held 23 — the supplier vanished mid-form with nothing said. Worse, a
       booking already recorded against that supplier read back as an EMPTY provider, and a Save
       would have written the blank. Phasing a supplier out is the right intent; deleting the word
       for it is not. js/96 now marks those options instead: disabled and labelled, and left
       selectable on a record that already holds one. */
    if(cur==='settings'&&!v.querySelector('.dt-about-btns')){
      var s=document.createElement('div');s.className='dt-about-btns card';s.style.cssText='margin-bottom:12px;border-left:3px solid #FF6B00';
      s.innerHTML='<h3>Company profile — printables</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="btn pri" onclick="directAboutPage()">About Direct Travel (one-pager)</button><button class="btn" onclick="directTenderPage()">Tender one-pager</button></div>';
      (function(){var _h=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_h)v.insertBefore(s,_h.nextSibling);else v.insertBefore(s,v.firstChild);})();
    }
    if(cur==='offers'&&!v.querySelector('.dt-awards')){
      var a=document.createElement('div');a.className='dt-awards';a.innerHTML=awardsStrip();(function(){var _h=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_h)v.insertBefore(a,_h.nextSibling);else v.insertBefore(a,v.firstChild);})();
    }
  }catch(e){}return out;};
  console.info('%c[v26.6] provider verdicts + profile spreads loaded','color:#FF6B00;font-weight:700');
 }catch(e){console.warn('[v26.6] failed',e);}
})();


/* ===== v26.7 Airline operational rules: void / refund (incl. LCC refund-to) / reissue / no-show / ADM (verified Jun 2026) ===== */
(function(){
 try{
  var FSCvoid='Same-day void before midnight of issue date via BSP (anti-ADM: do not void after window)';
  var OPS={
   SV:{voidRule:FSCvoid,refundRule:'Per fare basis to original form of payment via Refund Application; 24h free cancellation on ALL fares; refund ~7 business days',lccRefundTo:'N/A (FSC - refunds to original payment)',reissueRule:'Voluntary: change fee + fare difference per fare rule; involuntary (schedule change) reissued free',noShow:'Fare forfeited per rule; residual taxes refundable',admRisk:'Medium'},
   GF:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via Refund Application (RA) - STRICT RA submission compliance required (Gulf Air enforces)',lccRefundTo:'N/A (FSC)',reissueRule:'NDC involuntary exchange for impacted bookings; voluntary = change fee + ADC',noShow:'Per fare rule',/* fire #140 — named third party + personal mobile removed from a public repo; see the note in
      js/core/core-09-v26.js. Escalate through the airline's own Riyadh sales mailbox. */
   admRisk:'High - active ADM / RA compliance (escalate via RUH.Sales@gulfair.com)'},
   KU:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP; impacted-flight refunds per KU re-issue & refund circular',lccRefundTo:'N/A (FSC)',reissueRule:'Reissue per KU circular for impacted flights; voluntary = change fee + ADC',noShow:'Per fare rule',admRisk:'Medium (KU-RUH desk RUHSRKU)'},
   TK:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference; groups via GSO (Group Sales Optimizer)',noShow:'Per fare rule',admRisk:'Medium'},
   BA:{voidRule:'Same-day void (BSP) / per NDC policy',refundRule:'Per fare rule to original FOP; NDC servicing (deferred payment in change booking)',lccRefundTo:'N/A (FSC)',reissueRule:'NDC change booking; update agency email after booking creation (live 28 May 2026)',noShow:'Per fare rule',admRisk:'Medium'},
   QR:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP/RA',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference per fare rule',noShow:'Per fare rule',admRisk:'Medium'},
   EK:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference per fare rule',noShow:'Per fare rule; residual value per fare',admRisk:'Medium'},
   EY:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference per fare rule',noShow:'Per fare rule',admRisk:'Medium'},
   MS:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP/RA',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference per fare rule',noShow:'Per fare rule',admRisk:'Medium'},
   AI:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP; AI Partner / NDC servicing',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference; NDC (AI Partner) for IATA & non-IATA',noShow:'Per fare rule',admRisk:'Medium'},
   PK:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + ADC; airline-initiated schedule changes flagged via Duffel alerts',noShow:'Per fare rule; STRICT KSA baggage acceptance policy - brief passengers',admRisk:'Medium-High (ADM policy active in BSP SA)'},
   WY:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via BSP',lccRefundTo:'N/A (FSC)',reissueRule:'Change fee + fare difference; NDC content via Gold Medal aggregator',noShow:'Per fare rule',admRisk:'Medium'},
   XY:{voidRule:'No GDS void (LCC); 24h risk-free cancellation if 7+ days before departure',refundRule:'Standard fare NON-REFUNDABLE (credit shell only); Plus & above refundable; voluntary cancel up to 4h before departure with fee; government taxes refundable on request',lccRefundTo:'Nas wallet / credit shell (valid 1 year from issue)',reissueRule:'Change fee + fare difference (no reissue via BSP - manage in flynas portal)',noShow:'Fare lost; taxes refundable on request',admRisk:'Low (LCC, direct settlement - not BSP)'},
   F3:{voidRule:'No GDS void (LCC); 24h window',refundRule:'Non-refundable; flyMax fare cancellable to wallet credit (3 months); exceptional refund (bereavement/major illness) with documents',lccRefundTo:'flyadeal wallet (valid 3 months)',reissueRule:'Change fee + fare difference in flyadeal portal',noShow:'Forfeited',admRisk:'Low (LCC)'},
   G9:{voidRule:'No void (LCC); cancellation -> Credit Shell',refundRule:'Basic NON-REFUNDABLE -> Credit Shell (1yr, same passenger); Value = credit (AED100 fee) or original FOP (AED300 fee); Ultimate = credit or original FOP (AED200 fee)',lccRefundTo:'Air Arabia Credit Shell (valid 1 year, same passenger)',reissueRule:'Change fee + fare difference',noShow:'Per fare rule',admRisk:'Low (LCC)'},
   FZ:{voidRule:'Generally no cash void (LCC/hybrid); cancellation -> flydubai voucher per fare',refundRule:'Cancellation -> flydubai voucher per fare type; cash refund generally not offered; misconnection reaccommodation per fzGDS circular',lccRefundTo:'flydubai wallet / voucher',reissueRule:'Change fee + fare difference; misconnection rebooking per ticket stock 141/169/275/365 (fzGDS desk)',noShow:'Per fare rule',admRisk:'Low-Medium'},
   PC:{voidRule:'No GDS void (LCC)',refundRule:'Promo/Basic non-refundable; flexible fares refundable; cancellation typically to Pegasus wallet/BolBol per fare',lccRefundTo:'Pegasus wallet (BolBol) per fare',reissueRule:'Change fee + fare difference in Pegasus portal',noShow:'Forfeited per fare',admRisk:'Low (LCC)'},
   J9:{voidRule:'No GDS void (LCC); 24h free cancellation',refundRule:'Voluntary cancel NOT refundable unless Flexible fare; promo/basic non-refundable; 24h-from-booking = free full refund',lccRefundTo:'Jazeera credit / wallet per fare',reissueRule:'Reschedule with minimal cost on Flexible fare; otherwise change fee + fare diff',noShow:'Forfeited per fare',admRisk:'Low (LCC)'},
   '6E':{voidRule:'No GDS void (LCC)',refundRule:'Non-refundable basic -> credit shell; refundable fares per rule',lccRefundTo:'IndiGo credit shell per fare',reissueRule:'Change fee + fare difference',noShow:'Forfeited per fare',admRisk:'Low (LCC)'}
  };
  try{(DB.airlines||[]).forEach(function(a){var d=OPS[String(a.code||'').toUpperCase()];if(!d)return;Object.keys(d).forEach(function(k){var cur=a[k];if(cur===undefined||cur===''||cur===null||(Array.isArray(cur)&&!cur.length))a[k]=d[k];});});}catch(e){}
  console.info('%c[v26.7] airline operational rules loaded','color:#FF6B00;font-weight:700');
 }catch(e){console.warn('[v26.7] ops failed',e);}
})();



/* v26.8 Amadeus-verified airline code corrections (Office RUHS2234B, Jun 2026): F3 stock 000->560, WY icao OAS->OMA, RX stock ->122 */
(function(){try{(DB.airlines||[]).forEach(function(a){var c=String(a.code||'').toUpperCase();if(c==='F3'){a.stock='560';}if(c==='WY'){a.icao='OMA';}if(c==='RX'){a.stock='122';}});console.info('%c[v26.8] Amadeus code corrections applied','color:#16B364;font-weight:700');}catch(e){console.warn('[v26.8] fail',e);}})();
/* v26.9 Amadeus PV/C ticketing authority (Office RUHS2234B LAT list) + OV SalamAir code fix - 7 Jun 2026 */
(function(){try{
 (DB.airlines||[]).forEach(function(a){if(String(a.code||'').toUpperCase()==='OV'){a.stock='960';}});
 var LAT=["AA","AC","AF","AH","AM","AT","AZ","A3","BA","BI","BJ","B4","DT","DV","EK","ET","EY","FZ","F3","GA","GF","GP","G9","HC","HR","HU","HY","H9","J2","J4","J9","KC","KL","KP","KQ","KU","K3","LH","LX","ME","MF","MH","MJ","MS","MU","NE","NP","NX","OD","OV","PC","PR","P4","QR","Q4","RA","RJ","RQ","R5","SA","SM","SQ","SV","TC","TG","TK","TP","TU","UJ","UL","UX","VF","WB","WY","W2","XJ","XY","5J","6E"];
 window.LAT_AUTHORIZED=LAT;
 (DB.airlines||[]).forEach(function(a){var c=String(a.code||"").toUpperCase();a.ticketingAuthority=(LAT.indexOf(c)>-1)?"Authorized (issue via BSP)":"No authority - TARGET";});
 console.info("%c[v26.9] ticketing authority applied","color:#16B364;font-weight:700");
}catch(e){console.warn("[v26.9] fail",e);}})();
/* v27.0 simplify: Activity/Archive shortcuts in Settings + slim dense booking-detail cards */
(function(){try{
  var NOISE=['quality-control checklist','special service requests','pax / traveler profiles'];
  var _r=window.render;
  window.render=function(){var out=_r.apply(this,arguments);try{
    var cur=(typeof current!=='undefined')?current:null;
    var v=document.getElementById('view'); if(!v)return out;
    if(cur==='settings'&&!v.querySelector('.dt-admin-links')){
      var _arAdm=(typeof LANG!=='undefined'&&LANG==='ar');
      var s=document.createElement('div');s.className='dt-admin-links card';s.style.cssText='margin-bottom:12px;border-left:3px solid #7C8194';
      s.innerHTML='<h3>'+(_arAdm?'الإدارة والسجل':'Admin & history')+'</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">'+(_arAdm?'سجل التدقيق والسجلات المؤرشفة':'Audit trail and archived records')+'</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="current=\'activity\';render();window.scrollTo(0,0);">'+(_arAdm?'النشاط والتدقيق':'Activity & Audit')+'</button><button class="btn" onclick="current=\'archive\';render();window.scrollTo(0,0);">'+(_arAdm?'الأرشيف':'Archive')+'</button><button class="btn" onclick="current=\'sync\';render();window.scrollTo(0,0);">'+(_arAdm?'الاتصالات':'Connections')+'</button></div>'+(typeof v295TeamCard==="function"?v295TeamCard():"")+'';
      (function(){var _h=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_h)v.insertBefore(s,_h.nextSibling);else v.insertBefore(s,v.firstChild);})();
    }
    if(cur==='bookings'&&typeof openBooking!=='undefined'&&openBooking){
      v.querySelectorAll('.card').forEach(function(c){var h=c.querySelector('h3');if(h){var t=(h.textContent||'').toLowerCase();if(NOISE.some(function(n){return t.indexOf(n)>-1;}))c.style.display='none';}});
    }
  }catch(e){}return out;};
  console.info('%c[v27.0] simplify pass loaded','color:#7C8194;font-weight:700');
}catch(e){console.warn('[v27.0] fail',e);}})();
/* v27.1 add 17 authorized-but-untracked carriers from PV/C LAT (decode stock/icao later) */
(function(){try{
 var ADD=[["AM","Aeromexico","FSC","139","AMX","Mexico"],["BI","Royal Brunei Airlines","FSC","672","RBA","Brunei"],["DT","TAAG Angola Airlines","FSC","118","DTA","Angola"],["HC","Air Senegal","FSC","490","SNG","Senegal"],["HR","Hahn Air","FSC","169","HHN","Germany"],["HY","Uzbekistan Airways","FSC","250","UZB","Uzbekistan"],["J2","Azerbaijan Airlines (AZAL)","FSC","771","AHY","Azerbaijan"],["J4","Badr Airlines","FSC","","BDR","Sudan"],["KC","Air Astana","FSC","465","KZR","Kazakhstan"],["MF","Xiamen Airlines","FSC","731","CXA","China"],["NX","Air Macau","FSC","675","AMU","Macau"],["OD","Batik Air Malaysia","FSC","686","MXD","Malaysia"],["RQ","Kam Air","FSC","","KMF","Afghanistan"],["TC","Air Tanzania","FSC","197","ATC","Tanzania"],["UX","Air Europa","FSC","996","AEA","Spain"],["XJ","Thai AirAsia X","LCC","682","TAX","Thailand"],["5J","Cebu Pacific","LCC","203","CEB","Philippines"]];
 DB.airlines=DB.airlines||[];
 var have={}; DB.airlines.forEach(function(a){have[String(a.code||"").toUpperCase()]=1;});
 ADD.forEach(function(r){var ex=null;DB.airlines.forEach(function(a){if(String(a.code||"").toUpperCase()===r[0])ex=a;});if(ex){if(!ex.stock)ex.stock=r[3];if(!ex.icao)ex.icao=r[4];if(!ex.country)ex.country=r[5];}else{DB.airlines.push({id:"air_"+r[0].toLowerCase(),name:r[1],code:r[0],type:r[2],stock:r[3],icao:r[4],country:r[5],ticketingAuthority:"Authorized (issue via BSP)",_addedFromLAT:true});}});
 console.info("%c[v27.1] LAT carriers added","color:#16B364;font-weight:700");
}catch(e){console.warn("[v27.1] fail",e);}})();
/* ===== v29.1 REPORTS MODULE — embedded from Reports-Tab.html (storage key directReportsData_v1 unchanged; fully separate from operational DB — no bleed into Today/Leads) ===== */
(function(){
// tAr/deptAr added 2026-08-21 (owner's own pre-launch pass): these 14 titles rendered
// entirely in English on the Reports Overview tab — an otherwise fully-Arabic page — the
// most visible defect found in that pass. The 30 KPIs and 12 initiatives further down stay
// English-only for this round (deeper in an expandable accordion, lower visibility, and a
// much larger translation surface); not silently dropped, just scoped out of this pass.
const RPT_DEPT_AR={
  "Visas & Study + Hotels & Flights":"التأشيرات والدراسة + الفنادق والطيران",
  "All Departments":"جميع الإدارات","Products and Tech":"المنتجات والتقنية","NA":"—"
};
const RPT_OBJECTIVES=[
 {n:1, t:"Increase revenue from commercial contracts and direct sales", tAr:"زيادة الإيرادات من العقود التجارية والمبيعات المباشرة", link:"4.1 - 5.1", dept:"Visas & Study + Hotels & Flights"},
 {n:2, t:"Expand participation in public and private tenders as a revenue stream", tAr:"توسيع المشاركة في المناقصات الحكومية والخاصة كمصدر للإيرادات", link:"5.2", dept:"Visas & Study + Hotels & Flights"},
 {n:3, t:"Improve supplier terms and contract conditions", tAr:"تحسين شروط الموردين وبنود العقود", link:"4.3", dept:"All Departments"},
 {n:4, t:"Increase the number of payment solutions", tAr:"زيادة عدد حلول الدفع", link:"4.1", dept:"Products and Tech"},
 {n:5, t:"Raise customer satisfaction by improving complaint handling", tAr:"رفع رضا العملاء من خلال تحسين التعامل مع الشكاوى", link:"1.1", dept:"All Departments"},
 {n:6, t:"Expand strategic partnerships to enhance travel and service integration", tAr:"توسيع الشراكات الاستراتيجية لتعزيز تكامل السفر والخدمات", link:"3.1", dept:"Products and Tech"},
 {n:7, t:"Explore new travel services \"support services\" and increase the number of embassies for visas business", tAr:"استكشاف خدمات سفر جديدة \"خدمات الدعم\" وزيادة عدد السفارات لأعمال التأشيرات", link:"3.1", dept:"Products and Tech"},
 {n:8, t:"Achieve recognition through a local or international award in tourism or education", tAr:"تحقيق تقدير عبر جائزة محلية أو دولية في السياحة أو التعليم", link:"2", dept:"NA"},
 {n:9, t:"Drive innovation by engaging employees to generate and implement creative ideas", tAr:"دفع الابتكار من خلال إشراك الموظفين في توليد الأفكار الإبداعية وتنفيذها", link:"7.3", dept:"NA"},
 {n:10,t:"Apply unified quality standards across all departments", tAr:"تطبيق معايير جودة موحدة في جميع الإدارات", link:"8.3", dept:"All Departments"},
 {n:11,t:"Manage the commercial pricing across all products", tAr:"إدارة التسعير التجاري عبر جميع المنتجات", link:"5.1", dept:"NA"},
 {n:12,t:"Direct's presence at key B2B travel and exhibitions and conferences", tAr:"حضور دايركت في معارض ومؤتمرات السفر التجارية الرئيسية (B2B)", link:"2", dept:"NA"},
 {n:13,t:"Build a centralised commercial platform providing all departments with real-time data and insights", tAr:"بناء منصة تجارية مركزية تزوّد جميع الإدارات ببيانات ورؤى فورية", link:"8.2", dept:"NA"},
 {n:14,t:"Commercially launch and grow a full suite of luxury travel services", tAr:"إطلاق وتنمية مجموعة كاملة من خدمات السفر الفاخرة تجاريًا", link:"3.1", dept:"NA"}
];
function rptObjTitle(o){return (typeof LANG!=='undefined'&&LANG==='ar'&&o.tAr)?o.tAr:o.t;}
/* 2026-09-20 (fire #112): the owner's own pre-launch pass on 2026-08-21 gave every OBJECTIVE an
   Arabic title, and rptObjTitle above uses it. The KPIs under those objectives never got one, and
   nothing here looked for one either — so the Arabic report prints Arabic objectives with 42
   English KPI lines beneath them, which is the half-English report a Saudi reader actually gets.
   The Arabic wording of a KPI is the owner's to write — it is his performance framework, not
   something to invent here — so this does the half that is code: every place a KPI title is
   printed now asks for `tAr` first, exactly as objectives do. Adding the Arabic text later is then
   a content edit and nothing else. */
function rptKpiTitle(k){return (typeof LANG!=='undefined'&&LANG==='ar'&&k&&k.tAr)?k.tAr:(k?k.t:'');}
try{ window.rptKpiTitle=rptKpiTitle; }catch(_){}
/* the KPI list itself, so a driven test can put an Arabic title on one and see it reach the page —
   the objectives were already reachable through rptObjTitle, these were not */
try{ setTimeout(function(){ try{ window.RPT_KPIS=RPT_KPIS; }catch(_){} },0); }catch(_){}
function rptDeptLabel(d){return (typeof LANG!=='undefined'&&LANG==='ar'&&RPT_DEPT_AR[d])?RPT_DEPT_AR[d]:d;}
/* 2026-09-16 (fire #59, live): the Reports page was driven in Arabic — the objective cards, the built
   report, the copy text, the three alerts and the PowerPoint slide labels were all English. rptAr() is the
   page's own EN/AR switch; the KPI NAMES and their focus lines stay as written (the owner's plan wording —
   an owner call, see BACKLOG). File names stay English (rptTitleEn) so downloads sort the same way. */
function rptAr(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
const RPT_MONTHS_AR=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const RPT_KPIS=[
 {n:1, t:"Improvement of suppliers contracts terms", obj:3, target:20, type:"pct", f:["Improve contract conditions with service suppliers","Reduce operational service costs","Achieve higher discount rates from suppliers"]},
 {n:2, t:"Number of embassies added to the platform", obj:7, target:60, type:"count", f:["Add new embassies to the platform","Expand geographical coverage of embassy services","Develop digital integration with embassy systems"]},
 {n:3, t:"Number of tenders submitted", obj:2, target:50, type:"count", f:["Increase participation in public and private tenders","Improve the quality of tender submissions","Establish contracts with clear payment schedules"]},
 {n:4, t:"Number of new support services", obj:7, target:33, type:"count", f:["Develop and launch new travel support services","Design innovative services aligned with customer needs","Expand VIP and value-added services"]},
 {n:5, t:"Number of employee-generated development ideas", obj:9, target:5000, type:"count", f:["Promote a culture of innovation among employees","Encourage staff participation in idea generation","Implement an internal platform for collecting ideas"]},
 {n:6, t:"Overall customer satisfaction rate", obj:5, target:93, type:"pct", f:["Enhance customer experience across services","Analyze customer feedback to improve services","Improve responsiveness and service quality"]},
 {n:7, t:"Technical Integration Options in Hotel and Airline products", obj:6, target:13, type:"count", f:["Strengthen integration with global booking systems","Expand hotel and airline supplier network","Develop technical API integrations for the platform"]},
 {n:8, t:"Value of commercial agreements and direct sales closed", obj:1, target:20000000, type:"sar", f:["Expand new commercial partnerships","Strengthen collaboration with existing partners","Activate additional sales channels"]},
 {n:9, t:"Number of nominations submitted for awards in tourism or education", obj:8, target:4, type:"count", f:["Identify relevant industry awards","Prepare high-quality nomination submissions","Increase company visibility in sector awards"]},
 {n:10,t:"Number of available payment solutions", obj:4, target:12, type:"count", f:["Expand available payment options","Integrate additional digital payment gateways","Enhance the payment management system"]},
 {n:11,t:"First attempt resolution rate for complaints", obj:5, target:97, type:"pct", f:["Improve customer support team performance","Enhance complaint resolution procedures","Reduce resolution time on first contact"]},
 {n:12,t:"Departments with implemented quality standards", obj:10, target:95, type:"pct", f:["Develop and implement quality standards framework","Improve internal operational procedures","Ensure departmental compliance with quality standards"]},
 {n:13,t:"Internal operational improvement rate", obj:5, target:20, type:"pct", f:["Enhance operational efficiency","Implement internal process improvement initiatives","Automate operational workflows"]},
 {n:14,t:"Number of countries offering chauffeur service", obj:7, target:50, type:"count", f:["Expand chauffeur service to additional countries","Increase geographical service coverage","Add service through local transportation partners"]},
 {n:15,t:"Number of B2B deal contracts", obj:1, target:80, type:"count", f:["Strengthen engagement with target companies","Sign new corporate partnership agreements","Activate corporate client management systems"]},
 {n:16,t:"Tenders awarded value", obj:2, target:5000000, type:"sar", f:["Improve competitiveness of tender proposals","Analyze competitors in tender processes","Increase success rate in tender awards"]},
 {n:17,t:"Number of Commercial employees", obj:1, target:50, type:"count", f:["Recruit qualified sales professionals","Strengthen departmental workforce structure","Clarify roles and responsibilities within the team"]},
 {n:18,t:"Number of sales channels/platforms for our products", obj:1, target:8, type:"count", f:["Launch new digital sales platforms","Expand online distribution channels","Increase product availability across platforms"]},
 {n:19,t:"Commercial Total Revenue", obj:1, target:6000000, type:"sar", f:["Expand commercial partnerships","Increase participation in tenders","Develop new services and products"]},
 {n:20,t:"Government entity corporate contracts signed", obj:1, target:5, type:"count", f:["Engage with government entities","Submit proposals for government contracts","Strengthen government relations"]},
 {n:21,t:"Corporate client satisfaction score", obj:5, target:4.5, type:"score", f:["Enhance corporate client experience","Conduct regular satisfaction surveys","Implement feedback-driven improvements"]},
 {n:22,t:"Products with approved pricing structure", obj:11, target:15, type:"pct", f:["Review and standardize product pricing","Align pricing with market benchmarks","Obtain management approval on pricing"]},
 {n:23,t:"Number of luxury travel service", obj:14, target:7, type:"count", f:["Develop luxury travel offerings","Partner with premium service providers","Market luxury services to target segments"]},
 {n:24,t:"Number of qualified B2B leads generated from events", obj:12, target:50, type:"count", f:["Participate in key B2B events","Capture and qualify leads at events","Follow up on event-generated leads"]},
 {n:25,t:"Departments actively using the commercial Tool", obj:13, target:7, type:"pct", f:["Roll out commercial tool across departments","Train departments on tool usage","Monitor adoption and usage rates"]},
 {n:26,t:"Airlines with active agreements (IATA/platform)", obj:6, target:100, type:"count", draft:true, f:["Tracked quarterly since 2023 (9 then, 82 by Q4 2025)","Draft target - confirm with Ahmed"]},
 {n:27,t:"External biometric passports processed", obj:7, target:400, type:"count", draft:true, f:["Tracked quarterly in 2024-2025 dept reports","Draft target - confirm with Ahmed"]},
 {n:28,t:"New partnerships signed", obj:6, target:12, type:"count", draft:true, f:["Q4 2025 reported 3 new partnerships","Draft target - confirm with Ahmed"]},
 {n:29,t:"Exhibitions and conferences participated", obj:12, target:8, type:"count", draft:true, f:["Q4 2025 reported 3 participations","Draft target - confirm with Ahmed"]},
 {n:30,t:"Tenders awarded (count)", obj:2, target:10, type:"count", draft:true, f:["Q4 2025: 4 tenders won + completion certificates","KPI 16 tracks value; this tracks the count","Draft target - confirm with Ahmed"]}
];
const RPT_INITIATIVES=[
 {n:1, t:"Develop an updated and categorized database of target companies across sectors", obj:1},
 {n:2, t:"Create an executive plan focused on growth and optimization", obj:1},
 {n:3, t:"Analyze winning tenders in the market", obj:2},
 {n:4, t:"Conduct semi-annual partner evaluations", obj:2},
 {n:5, t:"Assess providers twice a year based on complaints and service quality", obj:3},
 {n:6, t:"Review active contracts and analyze clauses", obj:3},
 {n:7, t:"Enhance complaint resolution skills via scenario-based training", obj:5},
 {n:8, t:"Explore integration opportunities with service providers (flights & hotels)", obj:6},
 {n:9, t:"Launching the cruise reservations service", obj:7},
 {n:10,t:"Launching the private jet reservation service", obj:7},
 {n:11,t:"Launch a company-wide quality rollout covering all departments", obj:10},
 {n:12,t:"Explore new payment solutions and nominate the best option", obj:4}
];
const RPT_TEAM=["Abdelrahman","Othman Al Sharafi","Raad","Kareem","Other"];
/* 2026-09-25 (fire #248), driven live in Arabic: the achievement form's people list was this
   hard-coded four-name list while the team has eleven accounts and js/33 keeps the live roster
   (teamList) — seven colleagues could only ever be logged as "Other". The roster is used now, the
   legacy names kept only where a saved entry still carries one (so nothing already logged loses
   its person), and "Other" stays last with its STORED value unchanged — only its label speaks
   Arabic. RPT_TEAM stays as the fallback for a session where the roster has not loaded. */
function rptTeam(){
  try{
    var names=[]; var seen={};
    var add=function(n){ n=String(n==null?'':n).trim(); if(!n||n==='Other'||seen[n])return; seen[n]=1; names.push(n); };
    var live=(typeof window.teamList==='function')?(window.teamList()||[]):[];
    if(live.length){ live.forEach(add); } else { RPT_TEAM.forEach(add); }
    try{ (RDB.achievements||[]).forEach(function(a){ if(a&&a.member) add(a.member); }); }catch(_){}
    names.push('Other');
    return names;
  }catch(_){ return RPT_TEAM.slice(); }
}
/* fire #250: while the roster read has failed, every people list says so first (js/33 owns the words) */
function rptRosterWarn(){ try{ return (typeof window.teamRosterWarnOption==='function')?window.teamRosterWarnOption():''; }catch(_){ return ''; } }
function rptMemberOpt(t,sel){ return '<option value="'+esc(t)+'" '+(sel===t?'selected':'')+'>'+(t==='Other'?rptAr('Other','أخرى'):esc(t))+'</option>'; }
const RPT_KEY="directReportsData_v1";
function rptLoad(){try{const d=JSON.parse(localStorage.getItem(RPT_KEY));if(d&&d.achievements)return d;}catch(e){}return {achievements:[],overrides:{}};}
let RDB=rptLoad();
/* 2026-09-26 (Phase 3 release 2): three hooks for js/111, which moves achievements into the company database.
   This block is sealed, so js/111 cannot reach RDB, rptSave or rptRowAch by name; these are the only doors:
   the live list (__rptDB), a replaceable writer (__rptSaveHook — js/111 keeps only this browser's own data
   here), and a row decorator (__rptRowHook — draft / proof marks). Without js/111 all three do nothing. */
try{ Object.defineProperty(window,'__rptDB',{get:function(){return RDB;},configurable:true}); }catch(_){}
try{ window.__rptLists={ objectives:RPT_OBJECTIVES, kpis:RPT_KPIS, objTitle:rptObjTitle, kpiTitle:rptKpiTitle, deptLabel:function(d){ return rptDeptLabel(d); } }; }catch(_){}
function rptSave(){ if(typeof window.__rptSaveHook==='function'){ window.__rptSaveHook(RDB); return; } localStorage.setItem(RPT_KEY,JSON.stringify(RDB));}
const rptUid=()=>"a_"+Date.now()+"_"+Math.floor(Math.random()*1e4);
const rfmtN=v=>v==null||isNaN(v)?"—":Number(v).toLocaleString("en-US",{maximumFractionDigits:1});
function rfmtTarget(k){return k.type==="sar"?rfmtN(k.target)+" SAR":k.type==="pct"?k.target+"%":k.type==="score"?k.target:rfmtN(k.target);}
function rfmtVal(k,v){if(v==null)return "—";return k.type==="sar"?rfmtN(v)+" SAR":k.type==="pct"?rfmtN(v)+"%":rfmtN(v);}
function rptActual(k){
  /* 2026-09-26 (Phase 3 release 3): the KPI's actual comes from the database (kpi_actuals — Finance, tasks and final
     achievements) when js/112 has it; the hand-typed number and this browser's list are the old way, used only
     without js/112. undefined = "js/112 has no answer yet", null = "not measured". */
  try{ if(typeof window.__rptActualHook==='function'){ const v=window.__rptActualHook(k); if(v!==undefined) return v; } }catch(_){}
  const ov=RDB.overrides[k.n];
  if(ov!=null&&ov!=="")return Number(ov);
  const rows=RDB.achievements.filter(a=>Number(a.kpi)===k.n&&a.value!==""&&a.value!=null&&!isNaN(a.value));
  if(!rows.length)return null;
  if(k.type==="pct"||k.type==="score"){rows.sort((a,b)=>(a.date>b.date?1:-1));return Number(rows[rows.length-1].value);}
  return rows.reduce((s,a)=>s+Number(a.value),0);
}
function rptPct(k){const a=rptActual(k);return a==null?0:Math.min(100,Math.round(a/k.target*100));}
/* 2026-09-22 (fire #205): a KPI nobody has recorded a number for is NOT a KPI at zero, and this
   page used to say it was. rptPct() returns 0 for "no data" — right for a progress bar, which
   cannot be drawn as null — and three places read that 0 as a measurement:
     · an objective's progress divided the sum by ALL its KPIs. Measured live: one KPI recorded at
       exactly its 20,000,000 SAR target made objective #1 read **17%** (100 ÷ 6) instead of 100%
       of what has actually been measured;
     · the headline "Avg progress to 2026 targets" divided by all 30 KPIs — the same run read 3%;
     · the printed report's "Gaps & focus areas (<50% of target)" listed **29 shortfalls, every one
       of them saying "no data"**, on a report that goes to management.
   The author was aware — the `withData` guard below was already here — but the denominator stayed
   the full list, so awareness never reached the arithmetic. These two now average over what was
   measured and return null when nothing was, and every caller prints "not measured" and the
   fraction it is speaking for. House rule: never fill a gap with a number; leave it empty and say
   why (CLAUDE.md, and M53's "an empty answer is not a zero" in its third costume). */
function rptMeasuredOf(ks){return ks.filter(k=>rptActual(k)!=null);}
function rptAvgPct(ks){const m=rptMeasuredOf(ks);if(!m.length)return null;return Math.round(m.reduce((s,k)=>s+rptPct(k),0)/m.length);}
function rptObjProgress(on){const ks=RPT_KPIS.filter(k=>k.obj===on);if(!ks.length)return null;return rptAvgPct(ks);}
function rptObjMeasured(on){const ks=RPT_KPIS.filter(k=>k.obj===on);return {n:rptMeasuredOf(ks).length,of:ks.length};}
/* "1 KPIs" and «1 مؤشرات» are how a counted noun goes wrong in each language: English needs the
   singular at one, Arabic needs a different word at one, two, 3-10 and 11+. */
function rptNKpi(n){return (typeof LANG!=='undefined'&&LANG==='ar')
 ?(n===1?'مؤشر واحد':n===2?'مؤشرين':n<=10?(n+' مؤشرات'):(n+' مؤشرًا'))
 :(n+' KPI'+(n===1?'':'s'));}
function rptMonthKey(d){return (d||"").slice(0,7);}
function rptQuarterOf(d){const m=Number((d||"").slice(5,7));return m?Math.ceil(m/3):0;}
const RPT_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
function rptMonthLabel(mk){if(!mk)return "";const p=mk.split("-");return ((typeof LANG!=='undefined'&&LANG==='ar')?RPT_MONTHS_AR:RPT_MONTHS)[Number(p[1])-1]+" "+p[0];}
function rptMonthLabelEn(mk){if(!mk)return "";const p=mk.split("-");return RPT_MONTHS[Number(p[1])-1]+" "+p[0];}
let rptTab="overview",rptOpenObjs={},rptAchFilter={month:"",member:"",obj:""};
let rptRep={type:"monthly",month:new Date().toISOString().slice(0,7),quarter:"Q"+Math.ceil((new Date().getMonth()+1)/3),year:new Date().getFullYear(),scope:"dept",member:rptTeam()[0],obj:""};
window.rptGo=function(k){rptTab=k;render();};
function rptCss(){
 if(document.getElementById('rptcss'))return;
 const s=document.createElement('style');s.id='rptcss';
 s.textContent='.rpt-tabs{display:flex;gap:4px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:4px;overflow-x:auto;margin-bottom:14px}.rpt-tabs button{border:0;background:none;padding:9px 16px;font:600 13px inherit;font-family:inherit;color:var(--muted);cursor:pointer;border-radius:9px;white-space:nowrap}.rpt-tabs button.on{color:#fff;background:linear-gradient(135deg,var(--orange),var(--orange-2))}.rpt-bar{height:8px;background:#F2EDE4;border-radius:99px;overflow:hidden}.rpt-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--orange),var(--orange-2))}.rpt-bar i.ok{background:#1E9E62}.rpt-bar i.warn{background:#D9920B}.rpt-small{font-size:11.5px;color:var(--muted)}.rpt-obj{border:1px solid var(--line);border-radius:13px;background:#fff;margin-bottom:12px;overflow:hidden}.rpt-obj>.head{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.rpt-obj .n{min-width:30px;height:30px;border-radius:99px;background:var(--orange);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}.rpt-obj .t{flex:1;font-weight:600}.rpt-obj .meta{font-size:11.5px;color:var(--muted)}.rpt-obj .body{border-top:1px solid var(--line);padding:14px 16px;display:none;background:#FDFBF7}.rpt-obj.open .body{display:block}.rpt-kpirow{display:grid;grid-template-columns:1fr 130px 170px 90px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed var(--line)}.rpt-kpirow:last-child{border-bottom:0}.rpt-kpirow .kt{font-size:13px;font-weight:500}.rpt-kpirow .kf{font-size:11px;color:var(--muted);margin-top:2px}.rpt-preview{background:#fff;border:1px solid var(--line);border-radius:13px;padding:26px;margin-top:16px;overflow-x:auto}@media(max-width:760px){.rpt-tabs{flex-wrap:wrap}.rpt-preview{padding:14px}.rpt-kpirow{grid-template-columns:1fr 90px;row-gap:4px}.rpt-kpirow .ov,.rpt-kpirow .pr{grid-column:1/-1}}';
 document.head.appendChild(s);
}
window.renderReports=function(v){
 rptCss();
 const tabs=[["overview","Overview"],["achievements","Achievements"],["objectives","Objectives & KPIs"],["report","Generate Report"]];
 let html='<div class="rpt-tabs">'+tabs.map(t=>'<button class="'+(rptTab===t[0]?'on':'')+'" onclick="rptGo(\''+t[0]+'\')">'+t[1]+'</button>').join('')+'</div><div id="rptbody"></div>';
 v.innerHTML=html;
 const b=document.getElementById('rptbody');
 /* release 3: a tab js/112 draws from the database replaces core-10's own (window.__rptTabs) */
 const _tabs=Object.assign({overview:rptOverview,achievements:rptAch,objectives:rptObj,report:rptReport},(window.__rptTabs||{}));
 _tabs[rptTab](b);
};
function rptRowAch(a,withActs){
 const k=RPT_KPIS.find(x=>x.n===Number(a.kpi));
 return '<tr><td style="white-space:nowrap">'+esc(a.date)+'</td>'+
 '<td><b>'+esc(a.title)+'</b>'+(a.desc?'<div class="rpt-small">'+esc(a.desc)+'</div>':'')+(a.client?'<div class="rpt-small">'+rptAr('Client: ','العميل: ')+esc(a.client)+'</div>':'')+'</td>'+
 '<td>'+esc(a.member)+'</td>'+
 '<td>'+(a.objective?'<span class="tag">#'+a.objective+'</span>':'')+(k?'<div class="rpt-small">KPI '+k.n+'</div>':'')+'</td>'+
 '<td>'+(a.value!==''&&a.value!=null?rfmtVal(k||{type:a.unit==='SAR'?'sar':'count'},a.value):'—')+'</td>'+
 (withActs?'<td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" onclick="rptOpenAch(\''+a.id+'\')">'+rptAr('Edit','تعديل')+'</button> <button class="btn ghost sm" style="color:#D94B3F" onclick="rptDelAch(\''+a.id+'\')">✕</button></td>':'')+'</tr>';
}
/* the row decorator door (see __rptDB above) */
const _rptRowAchPlain=rptRowAch;
rptRowAch=function(a,withActs){ const h=_rptRowAchPlain(a,withActs); try{ if(typeof window.__rptRowHook==='function') return window.__rptRowHook(a,h,withActs); }catch(_){} return h; };
function rptOverview(v){
 const _ar=(typeof LANG!=='undefined'&&LANG==='ar');
 const tot=RDB.achievements.length;
 const nowMk=new Date().toISOString().slice(0,7);
 const thisM=RDB.achievements.filter(a=>rptMonthKey(a.date)===nowMk).length;
 const tracked=RPT_KPIS.filter(k=>rptActual(k)!=null).length;
 const avg=rptAvgPct(RPT_KPIS);   /* null while nothing is measured — never 0 */
 const recent=RDB.achievements.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8);
 /* an unmeasured objective sinks to the bottom rather than sitting among the genuine zeros */
 const objBars=RPT_OBJECTIVES.map(o=>{const p=rptObjProgress(o.n);const m=rptObjMeasured(o.n);return {o:o,p:p,bar:(p==null?0:p),m:m};}).sort((a,b)=>(b.p==null?-1:b.p)-(a.p==null?-1:a.p));
 v.innerHTML='<div class="chips" style="margin-bottom:14px">'+
 '<div class="chip"><div class="v">'+tot+'</div><div class="l">'+(_ar?'الإنجازات المسجّلة':'Achievements logged')+'</div></div>'+
 '<div class="chip"><div class="v">'+thisM+'</div><div class="l">'+(_ar?'هذا الشهر':'This month')+'</div></div>'+
 '<div class="chip"><div class="v">'+tracked+' / '+RPT_KPIS.length+'</div><div class="l">'+(_ar?'مؤشرات لها بيانات':'KPIs with data')+'</div></div>'+
 '<div class="chip"><div class="v">'+(avg==null?'—':avg+'%')+'</div><div class="l">'+(avg==null
   ?(_ar?'لا مؤشر مقيس بعد — لا متوسط':'No KPI measured yet — no average')
   :(_ar?('متوسط التقدم نحو أهداف 2026 — للمؤشرات المقيسة ('+tracked+' من '+RPT_KPIS.length+')')
        :('Avg progress to 2026 targets — of the '+tracked+' measured, not all '+RPT_KPIS.length)))+'</div></div></div>'+
 '<div class="card"><h3>'+(_ar?'تقدّم الأهداف <span class="rpt-small">— متوسط تقدّم مؤشرات كل هدف</span>':'Objective progress <span class="rpt-small">— average of each objective\'s KPI progress</span>')+'</h3>'+
 objBars.map(x=>'<div style="display:flex;gap:10px;align-items:center;margin:7px 0"><span class="tag" style="min-width:34px;text-align:center">#'+x.o.n+'</span><div style="flex:1"><div style="font-size:12.5px;margin-bottom:3px">'+esc(rptObjTitle(x.o))+
 ' <span class="rpt-small">'+(x.m.of===0?(_ar?'· بلا مؤشر':'· no KPI')
   :x.m.of===1?(x.m.n?(_ar?'· مؤشره الوحيد مقيس':'· its only KPI is measured'):(_ar?'· لم يُقَس مؤشره الوحيد':'· its only KPI is not measured'))
   :x.m.n===0?(_ar?('· لم يُقَس أي من '+rptNKpi(x.m.of)):('· none of its '+rptNKpi(x.m.of)+' measured'))
   :(_ar?('· قيس '+x.m.n+' من '+rptNKpi(x.m.of)):('· '+x.m.n+' of '+rptNKpi(x.m.of)+' measured')))+'</span>'+
 '</div><div class="rpt-bar"><i class="'+(x.p>=100?'ok':x.p>=50?'':'warn')+'" style="width:'+x.bar+'%"></i></div></div><b style="min-width:42px;text-align:right">'+(x.p==null?'—':x.p+'%')+'</b></div>').join('')+'</div>'+
 '<div class="card"><h3>'+(_ar?'أحدث الإنجازات':'Recent achievements')+' <button class="btn pri sm" onclick="rptOpenAch()">＋ '+(_ar?'تسجيل إنجاز':'Log achievement')+'</button></h3>'+
 (recent.length?'<div class="tbl-wrap"><table><thead><tr><th>'+(_ar?'التاريخ':'Date')+'</th><th>'+(_ar?'الإنجاز':'Achievement')+'</th><th>'+(_ar?'العضو':'Member')+'</th><th>'+(_ar?'الهدف':'Objective')+'</th><th>'+(_ar?'القيمة':'Value')+'</th></tr></thead><tbody>'+recent.map(a=>rptRowAch(a,false)).join('')+'</tbody></table></div>':'<div class="empty">'+(_ar?'لا إنجازات بعد — سجّل أول إنجاز.':'No achievements yet — log the first one.')+'</div>')+'</div>';
}
function rptAch(v){
 let rows=RDB.achievements.slice().sort((a,b)=>a.date<b.date?1:-1);
 if(rptAchFilter.month)rows=rows.filter(a=>rptMonthKey(a.date)===rptAchFilter.month);
 if(rptAchFilter.member)rows=rows.filter(a=>a.member===rptAchFilter.member);
 if(rptAchFilter.obj)rows=rows.filter(a=>String(a.objective)===rptAchFilter.obj);
 const months=[...new Set(RDB.achievements.map(a=>rptMonthKey(a.date)))].sort().reverse();
 v.innerHTML='<div class="toolbar">'+
 '<select onchange="rptSetFilter(\'month\',this.value)"><option value="">'+rptAr('All months','كل الأشهر')+'</option>'+months.map(m=>'<option value="'+m+'" '+(rptAchFilter.month===m?'selected':'')+'>'+rptMonthLabel(m)+'</option>').join('')+'</select>'+
 '<select onchange="rptSetFilter(\'member\',this.value)"><option value="">'+rptAr('All members','كل الأعضاء')+'</option>'+rptRosterWarn()+rptTeam().map(t=>rptMemberOpt(t,rptAchFilter.member)).join('')+'</select>'+
 '<select onchange="rptSetFilter(\'obj\',this.value)"><option value="">'+rptAr('All objectives','كل الأهداف')+'</option>'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(rptAchFilter.obj==o.n?'selected':'')+'>#'+o.n+' — '+esc(rptObjTitle(o).slice(0,40))+'…</option>').join('')+'</select>'+
 '<span class="rpt-small">'+rptAr(rows.length+' entr'+(rows.length===1?'y':'ies'),rows.length+(rows.length===1?' سجل':' سجلات'))+'</span><span style="flex:1"></span>'+
 '<button class="btn pri" onclick="rptOpenAch()">＋ '+rptAr('Log achievement','تسجيل إنجاز')+'</button></div>'+
 '<div class="card">'+(rows.length?'<div class="tbl-wrap"><table><thead><tr><th>'+rptAr('Date','التاريخ')+'</th><th>'+rptAr('Achievement','الإنجاز')+'</th><th>'+rptAr('Member','العضو')+'</th><th>'+rptAr('Objective / KPI','الهدف / المؤشر')+'</th><th>'+rptAr('Value','القيمة')+'</th><th></th></tr></thead><tbody>'+rows.map(a=>rptRowAch(a,true)).join('')+'</tbody></table></div>':'<div class="empty">Nothing here yet. Log achievements as they happen — tenders submitted, contracts signed, embassies added, services launched…</div>')+'</div>';
}
window.rptSetFilter=function(k,val){rptAchFilter[k]=val;render();};
window.rptOpenAch=function(id){
 const a=id?RDB.achievements.find(x=>x.id===id):{date:todayISO(),member:rptTeam()[0],title:"",desc:"",objective:"",kpi:"",value:"",client:""};
 if(!a)return;
 openModal(id?rptAr('Edit achievement','تعديل الإنجاز'):rptAr('Log achievement','تسجيل إنجاز'),
 '<div class="grid2"><div class="field"><label>'+rptAr('Date','التاريخ')+'</label><input type="date" id="rf_date" value="'+esc(a.date)+'"></div><div class="field"><label>'+rptAr('Team member','عضو الفريق')+'</label><select id="rf_member">'+rptRosterWarn()+rptTeam().map(t=>rptMemberOpt(t,a.member)).join('')+'</select></div></div>'+
 '<div class="field"><label>'+rptAr('What was achieved','ما الذي تحقق')+'</label><input type="text" id="rf_title" value="'+esc(a.title)+'" placeholder="'+rptAr('e.g. Tender submitted to Saudi Ports Authority','مثال: تقديم مناقصة لهيئة الموانئ')+'"></div>'+
 '<div class="field"><label>'+rptAr('Details (optional)','التفاصيل (اختياري)')+'</label><textarea id="rf_desc" rows="2">'+esc(a.desc||'')+'</textarea></div>'+
 '<div class="grid2"><div class="field"><label>'+rptAr('Linked objective','الهدف المرتبط')+'</label><select id="rf_obj" onchange="rptSyncKpiList()"><option value="">'+rptAr('— none —','— لا شيء —')+'</option>'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(a.objective==o.n?'selected':'')+'>#'+o.n+' — '+esc(rptObjTitle(o).slice(0,46))+'</option>').join('')+'</select></div><div class="field"><label>'+rptAr('Linked KPI','المؤشر المرتبط')+'</label><select id="rf_kpi"></select></div></div>'+
 '<div class="grid2"><div class="field"><label>'+rptAr('Numeric value (counts toward the KPI)','قيمة رقمية (تُحتسب في المؤشر)')+'</label><input type="number" id="rf_value" value="'+(a.value!=null?a.value:'')+'" placeholder="'+rptAr('e.g. 1 tender · 300000 SAR','مثال: مناقصة واحدة · 300000 ريال')+'"></div><div class="field"><label>'+rptAr('Client / entity (optional)','العميل / الجهة (اختياري)')+'</label><input type="text" id="rf_client" value="'+esc(a.client||'')+'"></div></div>',
 function(){
   const g=i=>document.getElementById(i).value;
   const rec={date:g('rf_date'),member:g('rf_member'),title:g('rf_title').trim(),desc:g('rf_desc').trim(),objective:g('rf_obj'),kpi:g('rf_kpi'),value:g('rf_value'),client:g('rf_client').trim()};
   if(!rec.title){toast('Please write what was achieved.','err');try{document.getElementById('rf_title').focus();}catch(_){}return false;}
   if(!rec.objective&&rec.kpi){const k=RPT_KPIS.find(x=>x.n===Number(rec.kpi));if(k)rec.objective=String(k.obj);}
   if(id){Object.assign(RDB.achievements.find(x=>x.id===id),rec);}else{rec.id=rptUid();rec.createdAt=new Date().toISOString();RDB.achievements.push(rec);}
   rptSave();render();
 });
 rptSyncKpiList(a.kpi);
};
window.rptSyncKpiList=function(sel){
 const onEl=document.getElementById('rf_obj');if(!onEl)return;
 const on=onEl.value;
 const list=on?RPT_KPIS.filter(k=>k.obj===Number(on)):RPT_KPIS;
 document.getElementById('rf_kpi').innerHTML='<option value="">'+rptAr('— none —','— لا شيء —')+'</option>'+list.map(k=>'<option value="'+k.n+'" '+(String(sel)===String(k.n)?'selected':'')+'>KPI '+k.n+' — '+esc(rptKpiTitle(k).slice(0,46))+' (target '+rfmtTarget(k)+')</option>').join('');
};
window.rptDelAch=function(id){askInPage('Delete this achievement?',function(){RDB.achievements=RDB.achievements.filter(x=>x.id!==id);rptSave();render();});};
window.rptToggleObj=function(n){rptOpenObjs[n]=!rptOpenObjs[n];render();};
window.rptSetOverride=function(n,val){RDB.overrides[n]=val;rptSave();render();};
function rptObj(v){
 v.innerHTML=RPT_OBJECTIVES.map(o=>{
  const ks=RPT_KPIS.filter(k=>k.obj===o.n);
  const ins=RPT_INITIATIVES.filter(i=>i.obj===o.n);
  const ach=RDB.achievements.filter(a=>Number(a.objective)===o.n);
  const p=rptObjProgress(o.n);
  const open=rptOpenObjs[o.n];
  return '<div class="rpt-obj '+(open?'open':'')+'"><div class="head" onclick="rptToggleObj('+o.n+')">'+
  '<span class="n">'+o.n+'</span><div class="t">'+esc(rptObjTitle(o))+'<div class="meta">'+((typeof LANG!=='undefined'&&LANG==='ar')?('الربط الاستراتيجي '+esc(o.link)+' · '+esc(rptDeptLabel(o.dept))+' · '+rptNKpi(ks.length)+' ('+rptMeasuredOf(ks).length+' مقيس) · '+ach.length+' إنجاز'):('Strategic link '+esc(o.link)+' · '+esc(rptDeptLabel(o.dept))+' · '+rptNKpi(ks.length)+' ('+rptMeasuredOf(ks).length+' measured) · '+ach.length+' achievement'+(ach.length!==1?'s':'')))+'</div></div>'+
  '<div style="min-width:130px"><div class="rpt-bar"><i class="'+((p>=100)?'ok':(p>=50)?'':'warn')+'" style="width:'+(p||0)+'%"></i></div><div class="rpt-small" style="text-align:right">'+
  (p!=null?(p+'%'):ks.length?rptAr('not measured','لم يُقَس'):rptAr('no KPI','بلا مؤشر'))+'</div></div></div>'+
  '<div class="body">'+
  (ks.length?ks.map(k=>{
    const act=rptActual(k);const pc=rptPct(k);const ov=RDB.overrides[k.n];
    return '<div class="rpt-kpirow"><div><div class="kt">KPI '+k.n+' — '+esc(rptKpiTitle(k))+(k.draft?' <span class="tag" style="background:#FEF3E2;color:#B54708">'+rptAr('draft - confirm target','مسودة — أكّد الهدف')+'</span>':'')+'</div><div class="kf">'+k.f.map(esc).join(' · ')+'</div></div>'+
    '<div><div class="rpt-small">'+rptAr('Target','الهدف')+'</div><b>'+rfmtTarget(k)+'</b></div>'+
    '<div class="pr"><div class="rpt-small">'+rptAr('Actual: ','الفعلي: ')+'<b>'+rfmtVal(k,act)+'</b>'+((ov!=null&&ov!=='')?' <span class="tag">'+rptAr('manual','يدوي')+'</span>':'')+'</div><div class="rpt-bar"><i class="'+(pc>=100?'ok':pc>=50?'':'warn')+'" style="width:'+pc+'%"></i></div></div>'+
    '<div class="ov"><input type="number" placeholder="'+rptAr('override','قيمة يدوية')+'" value="'+((ov!=null)?ov:'')+'" style="width:100%" onchange="rptSetOverride('+k.n+',this.value)"></div></div>';
  }).join(''):'<div class="rpt-small">'+rptAr('No KPIs linked to this objective.','لا مؤشرات مرتبطة بهذا الهدف.')+'</div>')+
  (ins.length?'<div style="margin-top:12px"><div class="rpt-small" style="font-weight:700;margin-bottom:5px">'+rptAr('INITIATIVES','المبادرات')+'</div>'+ins.map(i=>'<div class="rpt-small">• '+esc(i.t)+'</div>').join('')+'</div>':'')+
  (ach.length?'<div style="margin-top:12px"><div class="rpt-small" style="font-weight:700;margin-bottom:5px">'+rptAr('ACHIEVEMENTS','الإنجازات')+'</div>'+ach.sort((a,b)=>a.date<b.date?1:-1).slice(0,6).map(a=>'<div class="rpt-small">• '+esc(a.date)+' — '+esc(a.title)+' ('+esc(a.member)+')</div>').join('')+'</div>':'')+
  '</div></div>';
 }).join('');
}
function rptReport(v){
 v.innerHTML='<div class="card"><h3>Generate report</h3><div class="grid2">'+
 '<div class="field"><label>Report type</label><select onchange="rptRepSet(\'type\',this.value)"><option value="monthly" '+(rptRep.type==='monthly'?'selected':'')+'>Monthly department report</option><option value="quarterly" '+(rptRep.type==='quarterly'?'selected':'')+'>Quarterly objectives review</option></select></div>'+
 (rptRep.type==='monthly'
  ?'<div class="field"><label>Month</label><input type="month" value="'+rptRep.month+'" onchange="rptRepSet(\'month\',this.value)"></div>'
  :'<div class="field"><label>'+rptAr('Quarter','الربع')+'</label><select onchange="rptRepSet(\'quarter\',this.value)">'+['Q1','Q2','Q3','Q4'].map(q=>'<option '+(rptRep.quarter===q?'selected':'')+'>'+q+'</option>').join('')+'</select></div><div class="field"><label>'+rptAr('Year','السنة')+'</label><input type="number" value="'+rptRep.year+'" onchange="rptRepSet(\'year\',this.value)"></div>')+
 '<div class="field"><label>'+rptAr('Scope','النطاق')+'</label><select onchange="rptRepSet(\'scope\',this.value)"><option value="dept" '+(rptRep.scope==='dept'?'selected':'')+'>'+rptAr('Whole department','القسم كاملًا')+'</option><option value="member" '+(rptRep.scope==='member'?'selected':'')+'>'+rptAr('One member','عضو واحد')+'</option><option value="obj" '+(rptRep.scope==='obj'?'selected':'')+'>One objective</option></select></div>'+
 (rptRep.scope==='member'?'<div class="field"><label>'+rptAr('Member','العضو')+'</label><select onchange="rptRepSet(\'member\',this.value)">'+rptRosterWarn()+rptTeam().map(t=>rptMemberOpt(t,rptRep.member)).join('')+'</select></div>':'')+
 (rptRep.scope==='obj'?'<div class="field"><label>'+rptAr('Objective','الهدف')+'</label><select onchange="rptRepSet(\'obj\',this.value)">'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(rptRep.obj==o.n?'selected':'')+'>#'+o.n+' — '+esc(rptObjTitle(o).slice(0,40))+'</option>').join('')+'</select></div>':'')+
 '</div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
 '<button class="btn pri" onclick="rptBuildReport()">Build report</button>'+
 '<button class="btn" onclick="rptPrintReport()">Print / PDF</button>'+
 '<button class="btn" onclick="rptDownloadReport()">Download .html</button>'+
 '<button class="btn" onclick="rptWord()">Word (.doc)</button><button class="btn" onclick="rptPpt()">PowerPoint (.pptx)</button><button class="btn" onclick="rptCopyReport()">Copy text</button></div></div><div id="rptout"></div>';
 rptBuildReport();
}
window.rptRepSet=function(k,val){rptRep[k]=val;render();};
function rptFilterAch(){
 let rows=RDB.achievements.slice();
 if(rptRep.type==='monthly')rows=rows.filter(a=>rptMonthKey(a.date)===rptRep.month);
 else rows=rows.filter(a=>String(new Date(a.date).getFullYear())===String(rptRep.year)&&'Q'+rptQuarterOf(a.date)===rptRep.quarter);
 if(rptRep.scope==='member')rows=rows.filter(a=>a.member===rptRep.member);
 if(rptRep.scope==='obj')rows=rows.filter(a=>String(a.objective)===String(rptRep.obj));
 return rows.sort((a,b)=>a.date<b.date?-1:1);
}
function rptTitleEn(){
 const period=rptRep.type==='monthly'?rptMonthLabelEn(rptRep.month):rptRep.quarter+' '+rptRep.year;
 const scope=rptRep.scope==='member'?(' — '+rptRep.member):rptRep.scope==='obj'?(' — Objective #'+rptRep.obj):'';
 return (rptRep.type==='monthly'?'Monthly Commercial Report':'Quarterly Objectives Review')+' · '+period+scope;
}
function rptTitle(){
 if(!(typeof LANG!=='undefined'&&LANG==='ar'))return rptTitleEn();
 const period=rptRep.type==='monthly'?rptMonthLabel(rptRep.month):rptRep.quarter+' '+rptRep.year;
 const scope=rptRep.scope==='member'?(' — '+rptRep.member):rptRep.scope==='obj'?(' — الهدف #'+rptRep.obj):'';
 return (rptRep.type==='monthly'?'التقرير التجاري الشهري':'مراجعة الأهداف الربعية')+' · '+period+scope;
}
function rptHTML(){
 const rows=rptFilterAch();
 const objs=rptRep.scope==='obj'?RPT_OBJECTIVES.filter(o=>String(o.n)===String(rptRep.obj)):RPT_OBJECTIVES;
 const td='padding:6px;border-bottom:1px solid #F5F1E9';
 const kpiRows=objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n)).map(k=>{
  const act=rptActual(k);const pc=rptPct(k);
  return '<tr><td style="'+td+'">KPI '+k.n+'</td><td style="'+td+'">'+esc(rptKpiTitle(k))+'</td><td style="'+td+';text-align:right">'+rfmtTarget(k)+'</td><td style="'+td+';text-align:right">'+rfmtVal(k,act)+'</td><td style="'+td+';text-align:right;color:'+(pc>=100?'#1E9E62':pc>=50?'#FF6B00':'#D9920B')+';font-weight:700">'+(act==null?'—':pc+'%')+'</td></tr>';
 }).join('');
 /* a KPI nobody has recorded is not a shortfall. Before this, a report with ONE measurement on it
    listed 29 "gaps", all 29 reading "no data" — see the note on rptObjProgress. Gaps are now the
    MEASURED ones under half their target, and the unmeasured are counted out loud underneath so
    the shorter list cannot be read as "everything else is fine". */
 const scoped=objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n));
 const unmeasured=scoped.filter(k=>rptActual(k)==null).length;
 const gaps=scoped.filter(k=>rptActual(k)!=null&&rptPct(k)<50).map(k=>'<li>KPI '+k.n+' — '+esc(rptKpiTitle(k))+': '+rptAr('at '+rptPct(k)+'% of target '+rfmtTarget(k),rptPct(k)+'% من الهدف '+rfmtTarget(k))+'</li>').join('');
 const gapsNote=unmeasured?('<div style="font-size:12px;color:#7C8194;margin-top:6px">'+rptAr(
   unmeasured+' of '+scoped.length+' KPIs have no figure recorded for this period and are not counted as gaps — see the table above.',
   unmeasured+' من '+scoped.length+' مؤشرًا بلا رقم مسجّل لهذه الفترة، ولا تُحتسب ضمن الفجوات — انظر الجدول أعلاه.')+'</div>'):'';
 return '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF6B00;padding-bottom:14px;margin-bottom:18px">'+
 '<div>'+(typeof logoSrc==='function'?'<img src="'+logoSrc()+'" style="height:40px;display:block;margin-bottom:6px" alt="Direct">':'')+'<div style="font-weight:800;font-size:21px">'+(typeof brandName==='function'?brandName():'Direct Business')+'</div>'+
 '<div style="color:#7C8194;font-size:12px">'+rptAr('Commercial Department · Operational Plan 2026','القسم التجاري · الخطة التشغيلية 2026')+'</div></div>'+
 '<div style="text-align:'+rptAr('right','left')+';font-size:12px;color:#7C8194">'+rptAr('Generated ','أُنشئ في ')+todayISO()+'</div></div>'+
 '<h2 style="font-weight:700;font-size:17px;margin-bottom:14px">'+esc(rptTitle())+'</h2>'+
 '<h3 style="font-weight:700;font-size:13.5px;margin:16px 0 8px;color:#3C4050">'+rptAr('1 · Achievements','1 · الإنجازات')+' ('+rows.length+')</h3>'+
 (rows.length?'<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#7C8194;text-align:'+rptAr('left','right')+'"><th style="padding:6px;border-bottom:1px solid #EEE8DE">'+rptAr('Date','التاريخ')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">'+rptAr('Achievement','الإنجاز')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">'+rptAr('Member','العضو')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">'+rptAr('Obj.','الهدف')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Value</th></tr></thead><tbody>'+
 rows.map(a=>{const k=RPT_KPIS.find(x=>x.n===Number(a.kpi));return '<tr><td style="'+td+';white-space:nowrap">'+esc(a.date)+'</td><td style="'+td+'"><b>'+esc(a.title)+'</b>'+(a.client?'<br><span style="color:#7C8194">'+esc(a.client)+'</span>':'')+'</td><td style="'+td+'">'+esc(a.member)+'</td><td style="'+td+'">'+(a.objective?'#'+a.objective:'')+'</td><td style="'+td+';text-align:right">'+(a.value!==''&&a.value!=null?rfmtVal(k||{type:'count'},a.value):'—')+'</td></tr>';}).join('')+'</tbody></table>'
 :'<div style="color:#7C8194;font-size:13px">'+rptAr('No achievements logged in this period'+(rptRep.scope!=='dept'?' for this scope':'')+'.','لم تُسجَّل إنجازات في هذه الفترة'+(rptRep.scope!=='dept'?' لهذا النطاق':'')+'.')+'</div>')+
 '<h3 style="font-weight:700;font-size:13.5px;margin:18px 0 8px;color:#3C4050">'+rptAr('2 · KPI progress vs 2026 targets','2 · تقدّم المؤشرات مقابل أهداف 2026')+'</h3>'+
 '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#7C8194;text-align:'+rptAr('left','right')+'"><th style="padding:6px;border-bottom:1px solid #EEE8DE">#</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">'+rptAr('KPI','المؤشر')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">'+rptAr('Target','الهدف')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">'+rptAr('Actual (YTD)','الفعلي (منذ بداية السنة)')+'</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Progress</th></tr></thead><tbody>'+kpiRows+'</tbody></table>'+
 ((gaps||gapsNote)?'<h3 style="font-weight:700;font-size:13.5px;margin:18px 0 8px;color:#3C4050">'+rptAr('3 · Gaps &amp; focus areas (&lt;50% of target)','3 · الفجوات ومجالات التركيز (أقل من 50% من الهدف)')+'</h3>'+
 (gaps?'<ul style="font-size:12.5px;padding-left:18px;color:#1C1E2B">'+gaps+'</ul>'
      :'<div style="font-size:12.5px;color:#1C1E2B">'+rptAr('No measured KPI is below half its target.','لا يوجد مؤشر مقيس دون نصف هدفه.')+'</div>')+gapsNote:'')+
 (function(){var _f=(typeof window.rptFootBits==='function')?window.rptFootBits():''; return _f?('<div style="margin-top:24px;border-top:1px solid #EEE8DE;padding-top:10px;font-size:10.5px;color:#7C8194">'+esc(_f)+'</div>'):'';})();
}
window.rptBuildReport=function(){const o=document.getElementById('rptout');if(o)o.innerHTML='<div class="rpt-preview" id="rptdoc">'+rptHTML()+'</div>';
 // the preview is injected without a render() pass, so the Arabic chrome layer (js/21) never saw
 // it — its section and table heads stayed English in Arabic (2026-09-02, round 24)
 try{if(typeof window.v27ArHeaders==='function')window.v27ArHeaders();}catch(_){}};
function rptText(){
 const rows=rptFilterAch();
 let t=rptTitle()+'\n'+'='.repeat(40)+'\n\n'+rptAr('ACHIEVEMENTS','الإنجازات')+' ('+rows.length+')\n';
 rows.forEach(a=>{t+='• '+a.date+' — '+a.title+(a.client?' ['+a.client+']':'')+' — '+a.member+(a.value?(' — '+a.value):'')+'\n';});
 t+='\n'+rptAr('KPI PROGRESS','تقدّم المؤشرات')+'\n';
 const objs=rptRep.scope==='obj'?RPT_OBJECTIVES.filter(o=>String(o.n)===String(rptRep.obj)):RPT_OBJECTIVES;
 objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n)).forEach(k=>{const a=rptActual(k);t+='• KPI '+k.n+' '+rptKpiTitle(k)+': '+rfmtVal(k,a)+' / '+rfmtTarget(k)+(a==null?'':' ('+rptPct(k)+'%)')+'\n';});
 t+='\n— '+rptAr('Direct Business · Commercial Department','دايركت أعمال · القسم التجاري')+' · directksa.com';
 return t;
}
window.rptCopyReport=function(){navigator.clipboard.writeText(rptText()).then(()=>alert(rptAr('Report text copied — paste into WhatsApp or email.','تم نسخ نص التقرير — الصقه في واتساب أو البريد.')));};
function rptFullDoc(){return '<!DOCTYPE html><html'+rptAr('',' dir="rtl" lang="ar"')+'><head><meta charset="UTF-8"><title>'+esc(rptTitle())+'</title><style>body{font-family:Cairo,Inter,system-ui,sans-serif;color:#1C1E2B;max-width:860px;margin:30px auto;padding:0 20px}</style></head><body>'+rptHTML()+'</body></html>';}
window.rptPrintReport=function(){const w=window.open('','_blank');if(!w){alert(rptAr('Allow popups to print.','اسمح بالنوافذ المنبثقة للطباعة.'));return;}w.document.write(rptFullDoc());w.document.close();setTimeout(()=>w.print(),400);};
window.rptDownloadReport=function(){const b=new Blob([rptFullDoc()],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=rptTitleEn().replace(/[^\w]+/g,'-')+'.html';a.click();};
window.rptExportJSON=function(){const b=new Blob([JSON.stringify(RDB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-reports-backup-'+todayISO()+'.json';a.click();};
window.rptWord=function(){var b=new Blob([String.fromCharCode(0xFEFF)+rptFullDoc()],{type:"application/msword"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=rptTitleEn().replace(/[^\w]+/g,"-")+".doc";a.click();};
window.rptPpt=function(){
 var go=function(){try{
  var P=new PptxGenJS();P.defineLayout({name:"W",width:13.33,height:7.5});P.layout="W";
  /* 2026-09-23 (fire #222): this deck is a DOCUMENT, and brand/index.html puts the rule in one
     line — "Documents use #F06820 · tiny marks & favicons use #FF6C00 · the app uses #F47A1F. They
     are siblings — don't fix one to match another." It was painted in the app's orange because a
     PPTX cannot read brand/tokens.css and the literal was written by hand. The same correction is
     applied to the two client-facing decks in core-08. */
  var ORANGE="F06820",INK="1C1E2B",CREAM="FBF8F4",MUT="7C8194";
  var s=P.addSlide();s.background={color:INK};
  try{if(typeof logoSrc==="function")s.addImage({data:logoSrc(),x:0.7,y:0.6,h:0.85,w:2.6});}catch(_){}
  s.addText("Direct Business",{x:0.7,y:2.7,w:11,fontSize:44,bold:true,color:"FFFFFF",fontFace:"Cairo"});
  s.addText(rptTitle(),{x:0.7,y:3.8,w:11,fontSize:22,color:"FF9D45",fontFace:"Cairo"});
  s.addText(rptAr("Commercial Department - Operational Plan 2026","القسم التجاري - الخطة التشغيلية 2026")+" - directksa.com",{x:0.7,y:6.6,w:11,fontSize:12,color:"B9BDCB",fontFace:"Cairo"});
  var hdr=[{text:rptAr("KPI","المؤشر"),options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:rptAr("Target","الهدف"),options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:rptAr("Actual","الفعلي"),options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:rptAr("Progress","التقدم"),options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}}];
  var all=RPT_KPIS.map(function(k){var act=rptActual(k);var pc=rptPct(k);return [{text:"KPI "+k.n+" - "+k.t,options:{color:INK}},{text:rfmtTarget(k),options:{color:INK,align:"right"}},{text:rfmtVal(k,act),options:{color:INK,align:"right"}},{text:(act==null?"-":pc+"%"),options:{bold:true,align:"right",color:(pc>=100?"1E9E62":pc>=50?ORANGE:"D9920B")}}];});
  for(var i=0;i<all.length;i+=12){
    var sl=P.addSlide();sl.background={color:CREAM};
    sl.addText(rptAr("KPI progress vs 2026 targets","تقدّم المؤشرات مقابل أهداف 2026")+(all.length>12?(" ("+(Math.floor(i/12)+1)+")"):""),{x:0.6,y:0.35,fontSize:20,bold:true,color:INK,fontFace:"Cairo"});
    sl.addTable([hdr].concat(all.slice(i,i+12)),{x:0.6,y:1.0,w:12.1,fontSize:11,fontFace:"Cairo",border:{type:"solid",color:"EEE8DE",pt:0.5},colW:[7.3,1.6,1.6,1.6]});
  }
  var ach=rptFilterAch();
  for(var j=0;j<ach.length;j+=7){
    var sa=P.addSlide();sa.background={color:CREAM};
    sa.addText(rptAr("Achievements","الإنجازات")+(ach.length>7?(" ("+(Math.floor(j/7)+1)+")"):""),{x:0.6,y:0.35,fontSize:20,bold:true,color:INK,fontFace:"Cairo"});
    sa.addText(ach.slice(j,j+7).map(function(a){return {text:a.date+"  "+a.title+(a.client?" ["+a.client+"]":"")+" - "+a.member+(a.value?(" - "+a.value):""),options:{bullet:true,fontSize:13,color:INK,breakLine:true,fontFace:"Cairo"}};}),{x:0.6,y:1.1,w:12.1,h:5.6});
  }
  if(!ach.length){var se=P.addSlide();se.background={color:CREAM};se.addText(rptAr("No achievements logged in this period.","لم تُسجَّل إنجازات في هذه الفترة."),{x:0.6,y:3,fontSize:16,color:MUT,fontFace:"Cairo"});}
  var sf=P.addSlide();sf.background={color:INK};
  var _ppName=''; try{ if(typeof window.dgIdentityValue==='function') _ppName=String(window.dgIdentityValue('legal_name','en')||'').trim(); }catch(_){ }
  if(_ppName) sf.addText(_ppName,{x:0.7,y:3.0,w:11,fontSize:18,bold:true,color:"FFFFFF",fontFace:"Cairo"});
  var _ppFoot=((typeof window.rptFootBits==='function')?window.rptFootBits():'').replace(/\u00b7/g,'-');
  if(_ppFoot) sf.addText(_ppFoot,{x:0.7,y:3.8,w:11,fontSize:13,color:"FF9D45",fontFace:"Cairo"});
  P.writeFile({fileName:rptTitleEn().replace(/[^\w]+/g,"-")+".pptx"});
 }catch(e){alert(rptAr("PowerPoint export failed: ","تعذّر تصدير PowerPoint: ")+(e&&e.message?e.message:e));}};
 if(window.PptxGenJS){go();return;}
 var sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/pptxgen/3.12.0/pptxgen.bundle.min.js";sc.onload=go;sc.onerror=function(){alert(rptAr("Internet needed once to load the PowerPoint engine.","يلزم اتصال بالإنترنت مرة واحدة لتحميل محرك PowerPoint."));};document.head.appendChild(sc);
};console.info('%c[v29.1] Reports module embedded (storage: directReportsData_v1)','color:#FF6B00;font-weight:700');
})();

/* v29 i18n chrome sweep: exact-match known labels in AR mode (safe - only dict keys) */
(function(){try{
 var _r=window.render;
 window.render=function(){var out=_r.apply(this,arguments);try{
  if(typeof LANG!=='undefined'&&LANG==='ar'&&typeof I18N!=='undefined'&&I18N.ar){
   var els=document.querySelectorAll('#view h3, #view summary, #view th, #view .chip .l, #view .ch-sub, .v25-more-tog, .exp-menu button, .rpt-tabs button');
   els.forEach(function(el){
    if(el.childElementCount>0)return;
    var raw=(el.textContent||'').trim();var arrow='';var k=raw;
    if(/ [▲▼]$/.test(raw)){arrow=raw.slice(-2);k=raw.slice(0,-2).trim();}
    var D=(typeof V21_STRINGS_AR!=='undefined'&&V21_STRINGS_AR)||I18N.ar||{};
    if(k&&D[k]){if(!el.hasAttribute('data-v27en'))el.setAttribute('data-v27en',el.textContent);el.textContent=D[k]+arrow;}
   });
  }
 }catch(e){}return out;};
}catch(e){}})();
/* v29.4 helpers: dual Direct Payments links, website derivation, corp-email flags, lead sorting */
(function(){try{
 window.pdPhoneId=function(b){var cs=b.contacts||[];for(var i=0;i<cs.length;i++){var c=cs[i];if(c.phone){var d=String(c.phone).replace(/[^0-9]/g,"");if(d.indexOf("00")===0)d=d.slice(2);if(d.indexOf("966")===0)d=d.slice(3);if(d.indexOf("0")===0)d=d.slice(1);if(d.length>9)d=d.slice(-9);if(d.length===9)return d;}}return "";};
 window.pdEmailId=function(b){var c=(b.contacts||[]).find(function(x){return x.email;});return c?String(c.email).toLowerCase():"";};
 var PDBASE="https://payments.directksa.com/en/admin/invoices?customer_identifier=";
 window.pdCellLinks=function(b){var p=pdPhoneId(b),e=pdEmailId(b);var h="";if(p)h+='<a class="chiplink" href="'+PDBASE+encodeURIComponent(p)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Tel</a> ';if(e)h+='<a class="chiplink" href="'+PDBASE+encodeURIComponent(e)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">Mail</a>';return h||'<span class="muted">-</span>';};
 window.pdLink=function(b){var p=pdPhoneId(b);if(p)return PDBASE+encodeURIComponent(p);var e=pdEmailId(b);return PDBASE+encodeURIComponent(e||b.name);};
 var FREE2=/(gmail|icloud|hotmail|outlook|yahoo|live\.|msn\.|aol\.|proton|windowslive|me\.com|googlemail|gamil|iclond|gnail|yaho\.)/;
 (DB.businesses||[]).forEach(function(b){
  if(!b.website){var c=(b.contacts||[]).find(function(x){return x.email&&!FREE2.test(String(x.email).toLowerCase())&&String(x.email).toLowerCase().indexOf("directksa")<0;});if(c){var m=String(c.email).toLowerCase().match(/@([^@]+)$/);if(m)b.website="https://"+m[1];}}
  if(!b.corpEmailFlag&&(b.source==="Individuals from B2B"||b.segment==="Individual (B2B invoices)")){var c2=(b.contacts||[]).find(function(x){return x.email&&!FREE2.test(String(x.email).toLowerCase())&&String(x.email).toLowerCase().indexOf("directksa")<0;});if(c2)b.corpEmailFlag=String(c2.email).toLowerCase().split("@")[1];}
 });save();
 window.leadSort={k:"value",dir:-1};
 window.leadSortBy=function(k){if(leadSort.k===k)leadSort.dir*=-1;else{leadSort.k=k;leadSort.dir=(k==="last"||k==="value")?-1:1;}drawLeads();};
 window.leadArrow=function(k){return leadSort.k===k?(leadSort.dir>0?" \u25B2":" \u25BC"):"";};
 /* Sorting needs a tie-breaker (owner approved 2026-08-16).
    Sort by Owner when every lead has the same owner, or by Priority when they are all "Cool",
    and the rows come back in a different order every click: the comparator says "equal" and
    the browser is free to arrange equal rows however it likes. Nothing is corrupted, but it
    looks broken, and after the contact-form import 81 leads share those values.
    Each sort value now carries the company name and then the created date appended after it,
    so equal rows fall into a fixed, obvious order. Numbers are zero-padded to a fixed width
    first, otherwise comparing them as text would put "10" before "9". */
 window.leadSortTieBreak=function(b){return "\0"+String(b.name||"").toLowerCase()+"\0"+String(b.createdAt||b.created_at||"");};
 window.leadSortNum=function(n){n=Math.round((Number(n)||0)*100); var neg=n<0; if(neg)n=-n;
   return (neg?"-":"0")+String(n).padStart(15,"0");};
 /* 2026-09-23 (fire #228) — two columns of this table sorted by something that is not in the
    cell. Both were found by clicking the headers against the real 80 leads, in both languages.

    FUNNEL sorted by `b.source`, the raw import tag. Live, all 80 records carry the same tag
    ("Contact Submission"), so every row's key was identical and the tie-break — the company name —
    decided the order. The column headed FUNNEL therefore did nothing to the funnel: 78 rows
    holding exactly two funnels came out in THIRTEEN blocks, the seven "Website Form — B2B" rows
    scattered all through the "Website Form — Entities" ones, ascending and descending alike, in
    English and in Arabic. It now sorts by the funnel text that is actually in the cell. A row with
    no funnel — the one that reads "— source: x" — sorts last instead of passing its import tag off
    as a funnel name.

    OWNER sorted by the stored full name while the cell shows the nickname js/54 paints in. Live in
    Arabic the column read عبدالرحمن / أبو ناصر / أبو سليمان; in Arabic that is back to front, ع
    sorting after أ. Same defect #99 fixed one table over on Clients, and the same remedy.

    HOW, given this comparator: the three sorters that call this function compare the returned
    strings with < and >, and the numeric columns rely on leadSortNum's zero-padding to do it. So a
    text column is turned into a RANK among its own distinct on-screen values first — localeCompare
    in the language being read, base sensitivity, numeric so "company 4" precedes "company 12" —
    and that rank is padded like any other number. The numeric columns are untouched.
    (nickOf's map arrives just after sign-in; until it does it returns the full name, so a sort
    clicked in the first moment ranks on that. The next click re-sorts with the map in hand.) */
 var _lsRank=null,_lsRankKey="";
 window.leadShownName=function(b){ return String((window.nmMain?nmMain(b):b.name)||b.name||""); };
 window.leadShownFunnel=function(b){
   var ar=(typeof LANG!=="undefined"&&LANG==="ar");
   var fn=(ar&&b.funnelNameAr)?b.funnelNameAr:b.funnelName;
   return fn?String(fn):"";
 };
 window.leadShownOwner=function(b){
   var n=String(b.assignedTo||b.owner||"").trim(); if(!n) return "";
   try{ return String(window.nickOf?nickOf(n):n); }catch(_){ return n; }
 };
 function _lsBuild(){
   var loc=(typeof LANG!=="undefined"&&LANG==="ar")?"ar":"en";
   var pool=((typeof DB!=="undefined"&&DB.businesses)||[]);
   var out={};
   [["name",window.leadShownName],["funnel",window.leadShownFunnel],["owner",window.leadShownOwner]]
     .forEach(function(p){
       var seen={},list=[];
       pool.forEach(function(b){ var t=p[1](b); if(t&&!seen[t]){seen[t]=1;list.push(t);} });
       try{ list.sort(function(x,y){ return x.localeCompare(y,loc,{sensitivity:"base",numeric:true}); }); }
       catch(_){ list.sort(); }
       var idx={}; list.forEach(function(t,i){ idx[t]=i; });
       out[p[0]]=idx;
     });
   _lsRank=out; _lsRankKey=loc+"|"+pool.length;
   return out;
 }
 /* A value the table shows but the rank has never seen (a funnel renamed, a person added, since
    the ranks were built) rebuilds them once rather than landing at an arbitrary position. An
    EMPTY cell is not that case: it sorts last on purpose, which is what 9e6 is for. */
 window.leadSortRank=function(k,text){
   if(!text) return 9e6;
   var loc=(typeof LANG!=="undefined"&&LANG==="ar")?"ar":"en";
   var pool=((typeof DB!=="undefined"&&DB.businesses)||[]);
   if(!_lsRank||_lsRankKey!==loc+"|"+pool.length) _lsBuild();
   var i=_lsRank[k]?_lsRank[k][text]:undefined;
   if(i===undefined){ _lsBuild(); i=_lsRank[k]?_lsRank[k][text]:undefined; }
   return (i===undefined)?(9e6-1):i;
 };
 window.leadSortVal=function(b,k){
   var v;
   switch(k){
     case "name":   v=leadSortNum(leadSortRank("name",leadShownName(b))); break;
     case "stage":  v=leadSortNum(LEAD_STAGES.indexOf(leadStage(b))); break;
     case "funnel": v=leadSortNum(leadSortRank("funnel",leadShownFunnel(b))); break;
     case "last":   v=leadSortNum(b.lastContact||0); break;
     case "owner":  v=leadSortNum(leadSortRank("owner",leadShownOwner(b))); break;
     case "score":  v=leadSortNum(leadScore(b)); break;
     default:       v=leadSortNum(b.totalSAR||0);
   }
   return v+leadSortTieBreak(b);
 };
 console.info("%c[v29.4] helpers + website/corp-flag migration loaded","color:#2E90FA;font-weight:700");
}catch(e){console.warn("[v29.4] fail",e);}})();
/* v29.5 ownership + quick edit: team list (editable), lead quick-edit modal, account manager / key-account fields */
(function(){try{
 window.teamList=function(){return (DB.settings&&DB.settings.team&&DB.settings.team.length)?DB.settings.team:(typeof TEAM!=="undefined"?TEAM:[]);};
 window.tmAdd=function(){var i=document.getElementById("tmNew");if(!i||!i.value.trim())return;DB.settings=DB.settings||{};DB.settings.team=teamList().slice();if(DB.settings.team.indexOf(i.value.trim())<0)DB.settings.team.push(i.value.trim());save();render();};
 window.tmDel=function(n){DB.settings=DB.settings||{};DB.settings.team=teamList().filter(function(x){return x!==n;});save();render();};
 window.v295TeamCard=function(){return '';};/* retired: owners come from real users via Team & Access */
 window.leadQuickEdit=function(id){
  var b=getLead(id);if(!b)return;
  var sel=function(opts,cur,fid){return '<select id="'+fid+'">'+opts.map(function(o){var v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+v+'" '+(cur===v?"selected":"")+'>'+l+'</option>';}).join("")+'</select>';};
  var stages=LEAD_STAGES.map(function(s){return [s,(s==="Won"?"Client":s)];});
  var team=[["","Unassigned"]].concat(teamList().map(function(x){return [x,x];}));
  var extra=b.isClient?('<div class="grid2"><div class="field"><label>Account manager</label>'+sel(team,b.accountManager||"","qe_am")+'</div><div class="field"><label>Account tier</label>'+sel([["Standard","Standard"],["Key","Key account"]],b.tier||"Standard","qe_tier")+'</div></div><div class="field"><label>Next account review</label><input type="date" id="qe_review" value="'+esc(b.nextReview||"")+'"></div>'):"";
  openModal((((typeof LANG!=='undefined'&&LANG==='ar')?'\u062a\u0639\u062f\u064a\u0644 \u0633\u0631\u064a\u0639 - ':"Quick edit - "))+esc(b.name),
   '<div class="grid2"><div class="field"><label>Stage</label>'+sel(stages,leadStage(b),"qe_stage")+'</div><div class="field"><label>Assigned to</label>'+sel(team,b.assignedTo||"","qe_owner")+'</div></div>'+
   '<div class="field"><label>Next action</label><input id="qe_next" value="'+esc(b.nextAction||"")+'"></div>'+
   extra+
   '<div class="field"><label>Quick note (optional - logs an activity)</label><textarea id="qe_note" rows="2"></textarea></div>',
   function(){
    var ns=val("qe_stage");b.stage=ns;b.status=ns;if(ns==="Won")b.isClient=true;
    b.assignedTo=val("qe_owner");b.nextAction=val("qe_next");
    try{if(val("qe_stage")==="Lost"&&leadStage(b)!=="Lost")captureLostReason(b);}catch(_){}
    if(document.getElementById("qe_am")){b.accountManager=val("qe_am");b.tier=val("qe_tier");b.nextReview=val("qe_review");}
    var note=val("qe_note");
    if(note){b.activities=b.activities||[];b.activities.push({date:Date.now(),type:"Note",status:"",note:note,by:(typeof me==="function"?me():(b.assignedTo||"Team"))});b.lastContact=Date.now();}
    save();render();
   });
 };
 console.info("%c[v29.5] ownership + quick edit loaded","color:#7A5AF8;font-weight:700");
}catch(e){console.warn("[v29.5] fail",e);}})();
/* v29.6 ux: close export menu on outside click; airline quick-edit; clients sort/filter */
(function(){try{
 document.addEventListener("click",function(e){var m=document.getElementById("expmenu");if(m&&m.classList.contains("show")&&!(e.target.closest&&e.target.closest(".exp-wrap")))m.classList.remove("show");},true);
 window.clSort={k:"name",dir:1};
 window.clFilter={q:"",owner:"all",tier:"all"};
 window.clSortBy=function(k){if(clSort.k===k)clSort.dir*=-1;else{clSort.k=k;clSort.dir=1;}render();};
 window.clArrow=function(k){return clSort.k===k?(clSort.dir>0?" \u25B2":" \u25BC"):"";};
 window.airQuickEdit=function(id){
  var x=(DB.airlines||[]).find(function(a){return a.id===id;});if(!x)return;
  var sel=function(opts,cur,fid){return '<select id="'+fid+'">'+opts.map(function(o){return '<option value="'+o+'" '+(cur===o?"selected":"")+'>'+o+'</option>';}).join("")+'</select>';};
  openModal((((typeof LANG!=='undefined'&&LANG==='ar')?'\u062a\u0639\u062f\u064a\u0644 \u0633\u0631\u064a\u0639 - ':"Quick edit - "))+esc(x.name),
   '<div class="grid2"><div class="field"><label>IATA code</label><input id="aq_code" value="'+esc(x.code||"")+'"></div><div class="field"><label>Ticket stock</label><input id="aq_stock" value="'+esc(x.stock||"")+'"></div></div>'+
   '<div class="grid2"><div class="field"><label>KSA BSP</label>'+sel(["","Yes","No"],x.ksa||"","aq_ksa")+'</div><div class="field"><label>Alliance</label>'+sel(["","Star Alliance","SkyTeam","Oneworld","Unaligned"],x.alliance||"","aq_alliance")+'</div></div>'+
   '<div class="grid2"><div class="field"><label>ADM risk</label>'+sel(["","Low","Medium","High"],x.admRisk||"","aq_adm")+'</div><div class="field"><label>Type</label>'+sel(["FSC","LCC"],x.type||"FSC","aq_type")+'</div></div>'+
   '<div class="field"><label>Notes</label><textarea id="aq_notes" rows="2">'+esc(x.notes||"")+'</textarea></div>',
   function(){x.code=val("aq_code");x.stock=val("aq_stock");x.ksa=val("aq_ksa");x.alliance=val("aq_alliance");x.admRisk=val("aq_adm");x.type=val("aq_type");x.notes=val("aq_notes");save();render();});
 };
 console.info("%c[v29.6] ux pack loaded","color:#16B364;font-weight:700");
}catch(e){console.warn("[v29.6] fail",e);}})();
/* v29.6b views: the exact filtered+sorted lists the tables show - reused by Export so the app behaves like a queryable database */
(function(){try{
 window.leadsView=function(){return DB.businesses.filter(matchLead).slice().sort(function(a,b){var va=leadSortVal(a,leadSort.k),vb=leadSortVal(b,leadSort.k);return va<vb?-1*leadSort.dir:va>vb?1*leadSort.dir:0;});};
 window.clientsView=function(){
  var cl=DB.businesses.filter(function(b){return b.isClient;});
  if(clFilter.q){var q=clFilter.q.toLowerCase();cl=cl.filter(function(b){return ((b.name||"")+" "+(b.nameAr||"")).toLowerCase().indexOf(q)>=0;});}
  if(clFilter.owner!=="all")cl=cl.filter(function(b){return window.sameOwner?sameOwner(b.accountManager||b.assignedTo,clFilter.owner):(b.accountManager||b.assignedTo||"")===clFilter.owner;});
  if(clFilter.tier!=="all")cl=cl.filter(function(b){return (b.tier||"Standard")===clFilter.tier;});
  var sv=function(b,k){return k==="am"?String(b.accountManager||b.assignedTo||"").toLowerCase():k==="tier"?String(b.tier||"Standard"):k==="review"?(b.nextReview||"9999-99"):String(b.name||"").toLowerCase();};
  return cl.slice().sort(function(a,b){var va=sv(a,clSort.k),vb=sv(b,clSort.k);return va<vb?-1*clSort.dir:va>vb?1*clSort.dir:0;});
 };
 window.supListView=function(kind){
  var arr=supArr(kind);var qEl=document.getElementById("sq");var q=(qEl?qEl.value:"").toLowerCase();
  /* 2026-09-19 (fire #104): this helper exists so Export gives the list the table is showing.
     The alliance/type chip is part of that list now, so it has to be applied here too — otherwise
     exporting while a chip is on would quietly hand over every row. */
  var _chip=(window.supChip||{})[kind]||'all';
  if(typeof window.supChipMatch==='function') arr=arr.filter(function(x){return window.supChipMatch(kind,x,_chip);});
  var rows=arr.filter(function(x){return !q||((x.name||"")+" "+(x.code||"")+" "+(x.type||"")+" "+(x.stock||"")+" "+(x.ksa||"")+" "+(x.country||"")+" "+(x.source||"")+" "+(x.alliance||"")+" "+(x.ticketingAuthority||"")).toLowerCase().indexOf(q)>=0;});
  var k=supSort.k,d=supSort.dir;
  return rows.slice().sort(function(a,b){var va=(a[k]==null?"":a[k]).toString().toLowerCase(),vb=(b[k]==null?"":b[k]).toString().toLowerCase();return va<vb?-1*d:va>vb?1*d:0;});
 };
 console.info("%c[v29.6b] view helpers loaded","color:#16B364;font-weight:700");
}catch(e){console.warn("[v29.6b] fail",e);}})();
/* v29.7b airline rules completion: KSA from verified LAT list; explicit type-based void/refund/reissue/no-show on every carrier; J4-RQ flagged for live DNA */
(function(){try{
 var lat=(typeof LAT_AUTHORIZED!=="undefined")?LAT_AUTHORIZED:[];
 (DB.airlines||[]).forEach(function(a){
  var code=String(a.code||"").toUpperCase();
  if(!a.ksa&&lat.indexOf(code)>=0)a.ksa="Yes";
  var lcc=a.type==="LCC";
  if(!a.voidRule)a.voidRule=lcc?"No void - 24h cooling window only (per brand)":"Same-day void before midnight of issue via BSP";
  if(!a.refundRule&&!lcc)a.refundRule="Per fare basis to original FOP via Refund Application/BSP";
  if(lcc&&!a.lccRefundTo)a.lccRefundTo="Airline wallet / credit shell (not original FOP)";
  if(!a.reissueRule)a.reissueRule=lcc?"Per fare brand - change fee + difference":"Fare difference + penalty per fare rules (cat 16/31)";
  if(!a.noShow)a.noShow=lcc?"Full forfeit on most brands":"No-show fee per fare rules; rebooking penalties apply";
  if((code==="J4"||code==="RQ")&&!a.stock&&String(a.notes||"").indexOf("stock pending")<0)a.notes=((a.notes||"")+" | Accounting code/stock pending live Amadeus DNA check").replace(/^ \| /,"");
 });
 save();
 console.info("%c[v29.7b] airline rules completion applied","color:#A9781A;font-weight:700");
}catch(e){console.warn("[v29.7b] fail",e);}})();
/* v29 migration: retire mock sync-conflict flags (Sync is now the honest Connections page) */
try{let __chg=false;[(DB.invoices||[]),(DB.bookings||[])].forEach(function(arr){arr.forEach(function(x){if(x.syncHealth==="conflict"){x.syncHealth="synced";delete x.syncConflict;__chg=true;}});});if(__chg)save();}catch(e){}
/* v29.2 top-gap fix: neutralize phantom top offset (e.g. injected by browser extensions) */
(function(){var fix=function(){try{var a=document.querySelector('.app');if(!a)return;var t=a.getBoundingClientRect().top+window.scrollY;if(t>4&&t<60){a.style.marginTop=(-t)+'px';}}catch(e){}};window.addEventListener('load',function(){setTimeout(fix,250);});setTimeout(fix,800);})();
/* ===== v29.8 (2026-06-13): RECOVERED BSP-SA verified airline data (from session local_0f78c2d9 audit log: BSPlink master + Amadeus TGBD-SA/PV/C). Restores 136 airlines, 113 KSA-verified, J4=367 RQ=384 XJ=940, and upgrades generic rules to verified BSP-SA text. Data-only - does NOT touch the v29.7 table layout. ===== */
(function(){try{
var BSP_ACTIVE={AA:'001',DL:'006',AC:'014',UA:'016',HO:'018',KP:'032',TP:'047',EI:'053',AZ:'055',AF:'057',HM:'061',SV:'065',ET:'071',GF:'072',KL:'074',ME:'076',MS:'077',PR:'079',LO:'080',QF:'081',SA:'083',AI:'098',FI:'108',UR:'109',UJ:'110',SK:'117',DT:'118',RX:'122',AH:'124',BA:'125',GA:'126',JL:'131',AM:'139',FZ:'141',AT:'147',R5:'151',QR:'157',CX:'160',HR:'169',EK:'176',KE:'180',TC:'197',TU:'199',SD:'200','5J':'203',VF:'204',PK:'214',N4:'216',TG:'217',LH:'220',KU:'229',MH:'232',TK:'235',MK:'239',HY:'250',GP:'275',RA:'285',Q4:'291','6E':'312','8D':'319',NP:'325',W2:'365',J4:'367',SM:'381',RQ:'384',A3:'390',SZ:'413',S7:'421',WB:'459',KC:'465',NE:'477',J9:'486',C6:'488',HC:'490',RJ:'512',G9:'514',QP:'516',SU:'555',F3:'560',XY:'593',UL:'603',EY:'607',SQ:'618',PC:'624',GQ:'633',K3:'645',DV:'655',TR:'668',BI:'672',NX:'675',BR:'695',KQ:'706',P4:'710',LX:'724',MF:'731',VN:'738',H9:'769',J2:'771',BS:'779',MU:'781',CZ:'784',BJ:'796',OD:'816',E5:'844',HU:'880',WY:'910',VS:'932',XJ:'940',OV:'960',B4:'971',UX:'996',BG:'997',CA:'999'};
var BSP_NEW={HO:['Juneyao Airlines','China','DKH'],HM:['Air Seychelles','Seychelles','SEY'],FI:['Icelandair','Iceland','ICE'],UR:['Uganda Airlines','Uganda','UGD'],SD:['Sudan Airways','Sudan','SUD'],N4:['Nordwind Airlines','Russia','NWS'],MK:['Air Mauritius','Mauritius','MAU'],'8D':['FitsAir','Sri Lanka','EXV'],SZ:['Somon Air','Tajikistan','SMR'],S7:['S7 Airlines','Russia','SBI'],C6:['Centrum Air (My Freighter)','Uzbekistan','MFX'],QP:['Akasa Air','India','AKJ'],SU:['Aeroflot','Russia','AFL'],GQ:['Sky Express','Greece','SEH'],TR:['Scoot','Singapore','TGW'],E5:['Air Arabia Egypt','Egypt','RBG'],VS:['Virgin Atlantic','UK','VIR']};
var BSP_INACTIVE=['VO','CO','QD','US','CY','OA','IC','OK','8Q','RB','SR','IT','ER','KW','FT','UK','BD','OS','MD','DQ','RL','FS','LV','VL','DN','8U','PS','6S','4H','9W','KK','IY','B8','MJ','S2','4Q','AB','YO','RT','VA','ZS','BN','50'];
var LAT='AA AC AF AH AM AT AZ A3 BA BI BJ B4 DT DV EK ET EY FZ F3 GA GF GP G9 HC HR HU HY H9 J2 J4 J9 KC KL KP KQ KU K3 LH LO LX ME MF MH MJ MS MU NE NP NX OD OV PC PR P4 QR Q4 RA RJ RQ R5 SA SM SQ SV TC TG TK TP TU UJ UL UX VF WB WY W2 XJ XY 5J 6E'.split(' ');
var KNOWN_LCC=['XY','F3','G9','FZ','PC','J9','6E','W6','U2','FR','VY','XJ','5J','TR','QP','VF','E5','IX','SG','8D','OV','QZ','IU'];
var TYPE_FILL={B4:'FSC',VF:'LCC',P4:'FSC',KP:'FSC',DQ:'FSC',UJ:'FSC',GP:'GSSA / plating',W2:'Plating platform',Q4:'Plating platform',H9:'FSC',MJ:'FSC',RA:'FSC',K3:'FSC',DV:'FSC',ER:'FSC',QZ:'LCC',IU:'LCC',BJ:'FSC',R5:'FSC',HO:'FSC',HM:'FSC',FI:'FSC',UR:'FSC',SD:'FSC',N4:'FSC',MK:'FSC','8D':'LCC',SZ:'FSC',S7:'FSC',C6:'FSC',QP:'LCC',SU:'FSC',GQ:'FSC',TR:'LCC',E5:'LCC',VS:'FSC'};
var LCC_ADD={XJ:'AirAsia credit account (BIG wallet) - verify per fare','5J':'Cebu Pacific Travel Fund (wallet); cash refund only if airline-cancelled',TR:'Scoot voucher (wallet); cash to original FOP only if airline-cancelled - verify',QP:'Akasa: refundable fares to original FOP; promo fares to credit - verify',VF:'AJet: per fare brand; credit/voucher typical - verify',E5:'Air Arabia Credit Shell (1 year, same passenger)',W6:'WIZZ account credit; cash to original FOP only if airline-cancelled',U2:'easyJet: refund to original FOP within 24h of booking; after that non-refundable',FR:'Ryanair: non-refundable; refund to original FOP only if airline-cancelled',VY:'Vueling: per fare; Flex refundable - verify',OV:'SalamAir credit shell - verify',IX:'Air India Express: refundable fares to original FOP; promo per fare - verify',SG:'SpiceJet credit shell - verify',QZ:'AirAsia credit account (BIG wallet) - verify',IU:'Super Air Jet: credit per fare - verify','8D':'FitsAir: per fare - verify'};
var FSC_VOID='Same-day void via BSP-SA (until 23:59 local on date of issue, before the BSP sales report closes); late void = ADM risk';
var LCC_VOID='No BSP void (LCC) - cancellation per fare brand; 24h grace only where the carrier offers it';
var FSC_REF='Per fare rule, refund to ORIGINAL form of payment via BSP Refund Application (RA)';
var LCC_REF='Per fare brand; voluntary refund usually to airline wallet / credit shell - see LCC refund-to';
var FSC_REI='Voluntary: change fee + fare difference per fare rule (Amadeus cat 31); involuntary/schedule change per airline policy';
var LCC_REI='Change fee + fare difference in the airline portal, per fare brand';
var FSC_NOSHOW='Per fare rule - fare may be forfeited; unused taxes refundable on request';
var LCC_NOSHOW='Forfeited per fare brand';
/* generic strings my v29.7b wrote - safe to upgrade to the verified text above */
var GEN=['No void - 24h cooling window only (per brand)','Same-day void before midnight of issue via BSP','Per fare basis to original FOP via Refund Application/BSP','Airline wallet / credit shell (not original FOP)','Per fare brand - change fee + difference','Fare difference + penalty per fare rules (cat 16/31)','Full forfeit on most brands','No-show fee per fare rules; rebooking penalties apply'];
function gen(v){return !v||GEN.indexOf(v)>=0;}
function isLcc(a){return ((a.type||'').toUpperCase().indexOf('LCC')>=0)||KNOWN_LCC.indexOf((a.code||'').toUpperCase())>=0;}
window.isLccAir=isLcc;
DB.airlines=DB.airlines||[];
DB.airlines.forEach(function(a){var c=(a.code||'').toUpperCase();if(!c||c==='XB')return;
 if(!a.type&&TYPE_FILL[c])a.type=TYPE_FILL[c];
 if(BSP_ACTIVE[c]){a.ksa='Yes';a.stock=BSP_ACTIVE[c];a.ksaVerified='2026-06-11 (BSPlink SA master + Amadeus TGBD-SA)';}
 else if(BSP_INACTIVE.indexOf(c)>=0){a.ksa='No';a.ksaVerified='2026-06-11 - BSP-SA registration expired (BSPlink)';}
 else {a.ksa='No';a.ksaVerified='2026-06-11 - not in BSP-SA master (BSPlink)';}
 a.ticketingAuthority=(LAT.indexOf(c)>=0)?'Authorized (issue via BSP-SA)':'No authority - source via partner / NDC / aggregator';
 if(!a.icao&&BSP_NEW[c])a.icao=BSP_NEW[c][2];
 if(!a.icao&&c==='J4')a.icao='BDR';
 if(!a.icao&&c==='RQ')a.icao='KMF';
 var l=isLcc(a);
 if(gen(a.voidRule))a.voidRule=l?LCC_VOID:FSC_VOID;
 if(gen(a.refundRule))a.refundRule=l?LCC_REF:FSC_REF;
 if(gen(a.reissueRule))a.reissueRule=l?LCC_REI:FSC_REI;
 if(gen(a.noShow))a.noShow=l?LCC_NOSHOW:FSC_NOSHOW;
 if(l&&gen(a.lccRefundTo))a.lccRefundTo=LCC_ADD[c]||'Airline wallet / credit shell (verify with carrier)';
 if(!l&&gen(a.lccRefundTo))a.lccRefundTo='N/A (FSC - refunds to original payment)';
});
Object.keys(BSP_NEW).forEach(function(c){
 if(DB.airlines.some(function(a){return (a.code||'').toUpperCase()===c;}))return;
 var l=KNOWN_LCC.indexOf(c)>=0;
 DB.airlines.push({id:'air_'+c.toLowerCase().replace(/[^a-z0-9]/g,''),code:c,name:BSP_NEW[c][0],country:BSP_NEW[c][1],icao:BSP_NEW[c][2],stock:BSP_ACTIVE[c]||'',ksa:'Yes',ksaVerified:'2026-06-11 (BSPlink SA master + Amadeus DNA)',type:(TYPE_FILL[c]||(l?'LCC':'FSC')),source:'GDS',gds:'Amadeus',ticketingAuthority:(LAT.indexOf(c)>=0)?'Authorized (issue via BSP-SA)':'No authority - source via partner / NDC / aggregator',voidRule:l?LCC_VOID:FSC_VOID,refundRule:l?LCC_REF:FSC_REF,reissueRule:l?LCC_REI:FSC_REI,noShow:l?LCC_NOSHOW:FSC_NOSHOW,lccRefundTo:l?(LCC_ADD[c]||'Airline wallet / credit shell (verify with carrier)'):'N/A (FSC - refunds to original payment)',contacts:[]});
});
save();
console.info('%c[v29.8] BSP-SA airline data recovered','color:#16B364;font-weight:700');
}catch(err){console.error('v29.8 recovery block failed',err);}})();

/* v29.9 current-user ("who am I") so team-test attributions are correct, not hardcoded to Abdelrahman */
(function(){try{
 DB.settings=DB.settings||{};
 /* no invented default identity — v67 sets currentUser from the signed-in email */
 window.me=function(){return (window.__userName)||(DB.settings&&DB.settings.currentUser)||'';};
 window.setMe=function(v){DB.settings=DB.settings||{};DB.settings.currentUser=v;save();var p=document.getElementById('mePick');if(p)p.value=v;};
 function mountPicker(){
  try{ var old=document.getElementById('meWrap'); if(old) old.remove(); }catch(_){}
 }
 var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);mountPicker();return o;};
 setTimeout(mountPicker,300);
 console.info('%c[v29.9] current-user picker loaded','color:#7A5AF8;font-weight:700');
}catch(e){console.warn('[v29.9] fail',e);}})();

/* v30 leads: bulk select + bulk assign/stage, hide-closed toggle, needs-attention filter. Single source of truth (leadTableList) shared by table + export. */
(function(){try{
 if(typeof leadFilter!=='undefined'){ if(leadFilter.hideClosed===undefined)leadFilter.hideClosed=true; if(leadFilter.attention===undefined)leadFilter.attention=false; }
 window.leadSel=window.leadSel||new Set();
 // one filtered+refined+sorted list used by BOTH the table and Export
 window.leadTableList=function(){
  var list=DB.businesses.filter(matchLead);
  if(leadFilter.mine){var _meN=(window.meName?meName():'');list=list.filter(function(b){return window.sameOwner?sameOwner(b.assignedTo||b.owner,_meN):(b.assignedTo||b.owner||'')===_meN;});}
  if(leadFilter.hideClosed&&(leadFilter.stage==='all'||!leadFilter.stage))list=list.filter(function(b){var s=leadStage(b);return s!=='Won'&&s!=='Lost';});
  /* 2026-09-22 (fire #216): this used to be its own definition of "needs attention" — no contact
     person OR no source — while the chip six pixels away used another (no contact person, an
     overdue next action, or flagged for confirmation). Two controls, the same words, different
     meanings. js/09 owns the rule now and this asks it. */
  if(leadFilter.attention)list=list.filter(function(b){ try{ return window.leadAttention?window.leadAttention(b):(!(b.contacts||[]).length||!b.source); }catch(_){ return !(b.contacts||[]).length||!b.source; } });
  return list.slice().sort(function(a,b){var va=leadSortVal(a,leadSort.k),vb=leadSortVal(b,leadSort.k);return va<vb?-1*leadSort.dir:va>vb?1*leadSort.dir:0;});
 };
 // make Export respect the same view
 window.leadsView=function(){return leadTableList();};
 window.leadClearFilters=function(){try{leadFilter.stage='all';leadFilter.cat='all';leadFilter.mine=false;leadFilter.hideClosed=false;leadFilter.attention=false;if(window.leadFilterFunnel!==undefined)window.leadFilterFunnel='all';drawLeads();}catch(e){console.warn(e);}};
 window.leadSelToggle=function(id,on){if(on)leadSel.add(id);else leadSel.delete(id);drawTable();};
 window.leadSelAll=function(on){var l=leadTableList();if(on)l.forEach(function(b){leadSel.add(b.id);});else leadSel.clear();drawTable();};
 window.leadSelClear=function(){leadSel.clear();drawTable();};
 window.leadBulkAssign=function(o){if(!o||!leadSel.size)return;var n=0;leadSel.forEach(function(id){var b=getLead(id);if(b){b.assignedTo=o;b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Assigned',status:'',note:'Bulk-assigned to '+o,by:(typeof me==='function'?me():'Team')});n++;}});save();if(typeof toast==='function')toast(n+' assigned to '+o);drawTable();};
 window.leadBulkStage=function(s){if(!s||!leadSel.size)return;var n=0;leadSel.forEach(function(id){var b=getLead(id);if(b){b.stage=s;b.status=s;if(s==='Won')b.isClient=true;b.lastContact=Date.now();b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Stage change',status:s,note:'Bulk stage change',by:(typeof me==='function'?me():'Team')});n++;}});save();if(typeof toast==='function')toast(n+' moved to '+(s==='Won'?'Client':s));leadSel.clear();render();};
 /* 2026-09-22 (fire #216): the button says how many and, in its tooltip, WHY — a warning that
    flags 71 of 80 leads and gives no reason is furniture. The reasons come from js/09's rule, the
    same one the filter applies, so the count and the explanation cannot drift apart. */
    /* and over js/09's POOL, not a second one: counting every non-client row in memory made this
       button read 45 beside a chip reading 33, because archived rows and the Won/Lost ones "Hide
       closed" is hiding are not leads this page will show you. */
 function _attnLeads(){ try{ var pool=window.leadAttnPool?window.leadAttnPool():(DB.businesses||[]).filter(function(b){ return !b.isClient; });
   return pool.filter(function(b){ try{ return window.leadAttention?window.leadAttention(b):(!(b.contacts||[]).length||!b.source); }catch(_){ return false; } }); }catch(_){ return []; } }
 function _attnCount(){ try{ if(window.leadAttnCount) return window.leadAttnCount(); }catch(_){} return _attnLeads().length; }
 /* js/09 owns the rule, so it owns the wording too — this asks rather than keeping a second copy */
 function _attnTitle(){ try{ return window.leadAttentionTitle?window.leadAttentionTitle():''; }catch(_){ return ''; } }
 window.drawTable=function(){
  var board=document.getElementById('board');if(!board)return;board.className='';
  var list=leadTableList();
  var vis={};list.forEach(function(b){vis[b.id]=1;});Array.from(leadSel).forEach(function(id){if(!vis[id])leadSel.delete(id);});
  var sel=leadSel.size;var team=(typeof teamList==='function')?teamList():[];
  var selStyle='border:1px solid var(--line-2);border-radius:9px;padding:7px 9px;font:inherit;font-size:12px;background:#fff;cursor:pointer';
  var ctrl='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'+
    '<button class="btn sm '+(leadFilter.hideClosed?'pri':'ghost')+'" onclick="leadFilter.hideClosed=!leadFilter.hideClosed;drawLeads()">'+(leadFilter.hideClosed?'✓ ':'')+'Hide closed</button>'+
    '<button class="btn sm '+(leadFilter.attention?'pri':'ghost')+'" title="'+esc(_attnTitle())+'" onclick="(window.leadAttnSet?window.leadAttnSet(!leadFilter.attention):leadFilter.attention=!leadFilter.attention);drawLeads()">⚠ '+((typeof LANG!=="undefined"&&LANG==="ar")?"بحاجة إلى انتباه":"Needs attention")+' · '+_attnCount()+'</button>'+
    '<button class="btn sm '+(leadFilter.mine?'pri':'ghost')+'" onclick="leadFilter.mine=!leadFilter.mine;drawLeads()">'+(leadFilter.mine?'✓ ':'')+'👤 '+((typeof LANG!=="undefined"&&LANG==="ar")?"خاص بي":"Mine")+'</button>'+
    (sel?('<span style="flex:1"></span><span class="tag" style="background:#7A5AF81a;color:#7A5AF8;font-weight:700">'+sel+' selected</span>'+
      '<select onchange="leadBulkAssign(this.value);this.value=\'\'" style="'+selStyle+'"><option value="">Assign to…</option>'+team.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select>'+
      '<select onchange="leadBulkStage(this.value);this.value=\'\'" style="'+selStyle+'"><option value="">Set stage…</option>'+LEAD_STAGES.map(function(s){return '<option value="'+s+'">'+(s==='Won'?'Client':s)+'</option>';}).join('')+'</select>'+
      '<button class="btn ghost sm" onclick="leadSelClear()">Clear</button>'):'')+
    '</div>';
  var allOn=sel>0&&sel===list.length;
  var head='<tr><th style="width:26px"><input type="checkbox" '+(allOn?'checked':'')+' onclick="leadSelAll(this.checked)" title="Select all in view"></th>'+
    '<th style="cursor:pointer" onclick="leadSortBy(\'name\')">Business'+leadArrow('name')+'</th>'+
    '<th style="cursor:pointer" onclick="leadSortBy(\'stage\')">Stage'+leadArrow('stage')+'</th>'+
    '<th style="cursor:pointer" onclick="leadSortBy(\'funnel\')">Funnel'+leadArrow('funnel')+'</th>'+
    '<th style="cursor:pointer" onclick="leadSortBy(\'last\')">Last activity'+leadArrow('last')+'</th>'+
    '<th>Next action</th><th style="cursor:pointer" onclick="leadSortBy(\'owner\')">Owner'+leadArrow('owner')+'</th>'+
    '<th style="cursor:pointer" onclick="leadSortBy(\'score\')" title="How hot this lead is (Hot / Warm / Cool / Cold). Click to sort — work the hottest first.">Priority'+leadArrow('score')+'</th></tr>';
  var rows=list.map(function(b){
    var sg=leadStage(b);var stale=b.lastContact&&(Date.now()-b.lastContact>1209600000)&&sg!=='Won'&&sg!=='Lost';
    var sc=(SOURCE_COLOR[b.source]||'#9AA1B6');
    return '<tr style="'+(stale?'background:#FFF7EC':'')+'" title="'+(stale?'No touch in 14+ days':'')+'">'+
     '<td onclick="event.stopPropagation()"><input type="checkbox" class="lchk" '+(leadSel.has(b.id)?'checked':'')+' onclick="leadSelToggle(\''+b.id+'\',this.checked)"></td>'+
     '<td style="cursor:pointer" onclick="openLeadFn(\''+b.id+'\')"><b>'+(window.nmMain?esc(nmMain(b)):esc(b.name))+'</b>'+(window.nmSubHTML?nmSubHTML(b):'')+' <button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="event.stopPropagation();leadQuickEdit(\''+b.id+'\')">Edit</button> '+(b.b2c?'<span class="tag b2c">B2C</span>':'')+(b.isClient?'<span class="tag client">Client</span>':'')+(b.corpEmailFlag?'<span class="tag" style="background:#F0453A14;color:#D92D20" title="Individual using a company email - check">Corp email</span>':'')+'<div style="font-size:11px;color:var(--muted)">'+esc(b.segment||'')+'</div></td>'+
     '<td><span class="statusbadge" style="background:'+LSTAGE_COLOR[sg]+'1a;color:'+LSTAGE_COLOR[sg]+';cursor:pointer" onclick="openLeadFn(\''+b.id+'\')" title="Open the lead to change stage"><span class="dot" style="background:'+LSTAGE_COLOR[sg]+'"></span>'+(sg==='Won'?'Client':sg)+'</span></td>'+
     '<td>'+(function(){var fn=(typeof LANG!=='undefined'&&LANG==='ar'&&b.funnelNameAr)?b.funnelNameAr:b.funnelName;/* 2026-09-09 (live test L7): no funnel → say so, and name the source in small muted text — never the source dressed as a funnel tag */return fn?'<span class="tag" style="background:#EEF0F5;color:#4B5563">'+esc(fn)+'</span>':(b.source?'<span data-no-funnel="1" style="color:var(--muted)">— <small>'+((typeof LANG!=='undefined'&&LANG==='ar')?'المصدر: ':'source: ')+esc(b.source)+'</small></span>':'-');})()+'</td>'+
     '<td style="color:var(--muted);white-space:nowrap">'+(b.lastContact?fmtAgo(b.lastContact):'—')+'</td>'+
     '<td style="color:var(--muted);max-width:170px;white-space:normal">'+(function(){var t=b.nextAction||b.nextActionNote||'';var d=b.nextActionDate?String(b.nextActionDate).slice(0,10):'';if(!t&&!d)return '—';var od=d&&d<todayISO();return esc(t||((typeof LANG!=='undefined'&&LANG==='ar')?'متابعة':'Follow up'))+(d?' <span style="white-space:nowrap;color:'+(od?'#D92D20':'var(--muted)')+'">· '+d+'</span>':'');})()+'</td>'+
     '<td style="color:var(--muted)">'+((b.assignedTo||b.owner)?esc(b.assignedTo||b.owner):'<span class="tag" style="background:#F0453A14;color:#D92D20">Unassigned</span>')+'</td>'+
     '<td>'+(function(){var _s=leadScore(b),_sb=scoreBand(_s);return '<span class="tag" style="background:'+_sb.c+'1a;color:'+_sb.c+';font-weight:700" title="Lead score '+_s+'/100">'+_sb.l+'</span>';})()+'</td></tr>';
  }).join('')||(function(){
    var base=DB.businesses.filter(matchLead).length;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    if(base>0){return '<tr><td colspan="8" class="empty">'+(ar?('لا نتائج مع الفلاتر الحالية — '+base+' سجل مخفي.'):('No results with the current filters — '+base+' record(s) hidden.'))+' <button class="btn sm pri" onclick="leadClearFilters()">'+(ar?'إظهار الكل':'Show all')+'</button></td></tr>';}
    return '<tr><td colspan="8" class="empty">'+(ar?'لا توجد سجلات بعد.':'No businesses yet.')+'</td></tr>';
  })();
  board.innerHTML=ctrl+'<div class="card" style="padding:0"><div class="tbl-wrap"><table><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div></div>';
 };
 console.info('%c[v30] leads bulk + hide-closed + needs-attention loaded','color:#7A5AF8;font-weight:700');
}catch(e){console.warn('[v30] fail',e);}})();

/* v30.1 leads: add-new assignee + editable funnel in quick-edit; converted clients leave the Leads pipeline; company logo + website on the detail card */
(function(){try{
 // ----- editable funnel list (built-in SOURCES + custom) -----
 window.funnelList=function(){var custom=(DB.settings&&DB.settings.funnels)||[];return (typeof SOURCES!=='undefined'?SOURCES:[]).concat(custom.filter(function(f){return SOURCES.indexOf(f)<0;}));};
 /* 2026-09-10 (live test D1 family): the two name questions ask in the page (js/57 pfPrompt), not through the browser's prompt() box */
 function qeAsk(q,cb){ if(typeof window.pfPrompt==='function')window.pfPrompt(q,'',cb); else cb(prompt(q)); }
 window.qeAddOwner=function(leadId){qeAsk('New team member name:',function(n){if(n&&n.trim()){DB.settings=DB.settings||{};DB.settings.team=(typeof teamList==='function'?teamList():[]).slice();if(DB.settings.team.indexOf(n.trim())<0)DB.settings.team.push(n.trim());save();leadQuickEdit(leadId,{owner:n.trim()});}else{leadQuickEdit(leadId);}});};
 window.qeAddFunnel=function(leadId){qeAsk('New funnel name:',function(n){if(n&&n.trim()){DB.settings=DB.settings||{};DB.settings.funnels=((DB.settings.funnels)||[]).slice();if(funnelList().indexOf(n.trim())<0)DB.settings.funnels.push(n.trim());if(typeof SOURCE_COLOR!=='undefined'&&!SOURCE_COLOR[n.trim()])SOURCE_COLOR[n.trim()]='#7C8194';save();leadQuickEdit(leadId,{funnel:n.trim()});}else{leadQuickEdit(leadId);}});};

 // ----- redefined quick-edit with add-new owner + funnel -----
 window.leadQuickEdit=function(id,preset){
  var b=getLead(id);if(!b)return;preset=preset||{};
  var curOwner=preset.owner||b.assignedTo||'';
  var curFunnel=preset.funnel||b.funnelKey||'';
  var opt=function(v,l,cur){return '<option value="'+esc(v)+'" '+(String(cur)===String(v)?'selected':'')+'>'+esc(l)+'</option>';};
  var stageSel='<select id="qe_stage">'+LEAD_STAGES.map(function(s){return opt(s,(s==='Won'?'Client':s),leadStage(b));}).join('')+'</select>';
  var team=(typeof teamList==='function'?teamList():[]);
  var _team=team.slice(); if(curOwner&&_team.indexOf(curOwner)<0)_team.unshift(curOwner);
  var ownerSel='<select id="qe_owner" onchange="if(this.value===\'__add__\')qeAddOwner(\''+b.id+'\')">'+opt('','Unassigned',curOwner)+_team.map(function(t){return opt(t,t,curOwner);}).join('')+'<option value="__add__">+ Add new person...</option></select>';
  var funnelSel='<select id="qe_funnel">'+opt('',((typeof LANG!=='undefined'&&LANG==='ar')?'— بدون قناة —':'— no funnel —'),curFunnel)+((window.__funnelDefs||[]).map(function(f){return opt(f.key,((typeof LANG!=='undefined'&&LANG==='ar')?(f.name_ar||f.name_en):f.name_en),curFunnel);}).join(''))+'</select>';
  var extra=b.isClient?('<div class="grid2"><div class="field"><label>Account manager</label><select id="qe_am">'+opt('','Unassigned',b.accountManager||'')+(function(){var _t=team.slice();var _am=b.accountManager||'';if(_am&&_t.indexOf(_am)<0)_t.unshift(_am);return _t;})().map(function(t){return opt(t,t,b.accountManager||'');}).join('')+'</select></div><div class="field"><label>Account tier</label><select id="qe_tier">'+opt('Standard','Standard',b.tier||'Standard')+opt('Key','Key account',b.tier||'Standard')+'</select></div></div><div class="field"><label>Next account review</label><input type="date" id="qe_review" value="'+esc(b.nextReview||'')+'"></div>'):'';
  openModal((((typeof LANG!=='undefined'&&LANG==='ar')?'\u062a\u0639\u062f\u064a\u0644 \u0633\u0631\u064a\u0639 - ':"Quick edit - "))+esc(b.name),
   '<div class="grid2"><div class="field"><label>Stage</label>'+stageSel+'</div><div class="field"><label>Assigned to</label>'+ownerSel+'</div></div>'+
   '<div class="field"><label>'+((typeof LANG!=='undefined'&&LANG==='ar')?'القناة (المصدر)':'Funnel')+'</label>'+funnelSel+'</div>'+
   '<div class="field"><label>Next action</label><input id="qe_next" value="'+esc(b.nextAction||'')+'"></div>'+
   extra+
   '<div class="field"><label>Quick note (optional - logs an activity)</label><textarea id="qe_note" rows="2"></textarea></div>',
   function(){
    var ns=val('qe_stage')||leadStage(b); // an empty stage must never be saved
    try{if(ns==='Lost'&&leadStage(b)!=='Lost'&&typeof captureLostReason==='function')captureLostReason(b);}catch(_){}
    var _newWon=(ns==='Won'&&!b.isClient);
    /* 2026-09-09 (live test D1 family): the client → pipeline question asked through window.confirm
       inside the save. It asks through askInPage now; the form stays open until the answer, and
       on yes the whole save runs. Cancel leaves the form open with nothing saved. */
    var _demote=(b.isClient&&ns!=='Won'&&leadStage(b)==='Won');
    var _arQ=(typeof LANG!=='undefined'&&LANG==='ar');
    var _applyAll=function(demote){
      if(demote){
        b.isClient=false;
        b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Stage change',status:ns,note:_arQ?'أُعيدت من العملاء إلى المحتملين':'Moved back from clients to the pipeline',by:(typeof me==='function'?me():'Team')});
      }
    b.stage=ns;b.status=ns;if(ns==='Won')b.isClient=true;
    var ov=val('qe_owner');if(ov!=='__add__')b.assignedTo=ov;
    var fv=val('qe_funnel');b.funnelKey=fv||null;var _fd=(window.__funnelDefs||[]).find(function(f){return f.key===fv;});b.funnelName=_fd?_fd.name_en:null;b.funnelNameAr=_fd?_fd.name_ar:null;
    b.nextAction=val('qe_next');
    if(document.getElementById('qe_am')){b.accountManager=val('qe_am');b.tier=val('qe_tier');b.nextReview=val('qe_review');}
    var note=val('qe_note');
    if(note){b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Note',status:'',note:note,by:(typeof me==='function'?me():'Team')});b.lastContact=Date.now();}
    save();render();
    if(_newWon&&typeof window.__clientHandover==='function')setTimeout(function(){window.__clientHandover(b.id);},250);
    };
    if(_demote){ askInPage(_arQ?'هذه الشركة عميل حاليًا. الرجوع بها إلى قائمة العملاء المحتملين؟\nموافق = تعود عميلاً محتملاً (يبقى سجلها وماليتها). إلغاء = تبقى عميلاً.':'This company is currently a client. Move it back to the leads pipeline?\nOK = becomes a lead again (its history and finance links stay). Cancel = stays a client.',function(){ _applyAll(true); try{ closeModal(); }catch(_){} }); return false; }
    _applyAll(false);
   });
 };

 // ----- converted clients leave the Leads pipeline (managed in Clients only) -----
 var _ltl=window.leadTableList;
 window.leadTableList=function(){return _ltl().filter(function(b){return !b.isClient;});};

 // ----- company logo + website + client banner on the detail card (render-wrap) -----
 function domainOf(b){if(!b.website)return '';return String(b.website).replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'');}
 var _r=window.render;window.render=function(){var out=_r.apply(this,arguments);try{
   if(current==='leads'&&typeof openLead!=='undefined'&&openLead&&(typeof leadDetailView==='undefined'||leadDetailView==='detail')){
     var b=getLead(openLead);var v=document.getElementById('view');
     if(b&&v){
       // logo into the avatar
       var ava=v.querySelector('.detail-head .ava');var dom=domainOf(b);
       if(ava&&dom&&!ava.querySelector('img')){
         var im=document.createElement('img');im.src='https://logo.clearbit.com/'+dom;im.alt='';im.style.cssText='width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff';
         im.onerror=function(){this.remove();};
         ava.style.background='#fff';ava.textContent='';ava.appendChild(im);
       }
       // client banner
       if(b.isClient&&!v.querySelector('.dt-clientbanner')){
         var bn=document.createElement('div');bn.className='dt-clientbanner card';bn.style.cssText='display:flex;align-items:center;gap:10px;border-left:3px solid #16B364;background:#E7F8EF;margin-bottom:12px';
         var _bnAr=(typeof LANG!=='undefined'&&LANG==='ar');
         bn.innerHTML='<span style="font-size:18px">★</span><div style="flex:1">'+(_bnAr?'<b>عميل مُدار</b> — اعمل على هذا الحساب في سجل العملاء؛ لم يعد ضمن مسار العملاء المحتملين النشط.':'<b>Managed client</b> — work this account in the Clients book; it is no longer in the active leads pipeline.')+'</div><button class="btn sm" onclick="current=\'clients\';openLead=null;render()">'+(_bnAr?'افتح في العملاء ↗':'Open in Clients ↗')+'</button>';
         var head=v.querySelector('.detail-head');if(head&&head.parentNode)head.parentNode.insertBefore(bn,head.nextSibling);
       }
       // website row into Key facts if missing
       var facts=[...v.querySelectorAll('.card h3')].filter(function(h){return h.textContent.trim()==='Key facts';})[0];
       if(facts&&b.website&&!facts.parentNode.querySelector('.dt-webrow')){
         var row=document.createElement('div');row.className='fact dt-webrow';row.innerHTML='<span class="k">Website</span><span class="v"><a href="'+esc(webHref(b.website))+'" target="_blank" rel="noopener" style="color:#2E90FA">'+esc(dom)+' ↗</a></span>';
         var firstFact=facts.parentNode.querySelector('.fact');if(firstFact)firstFact.parentNode.insertBefore(row,firstFact);
       }
     }
   }
 }catch(e){}return out;};
 console.info('%c[v30.1] quick-edit add-new + client unify + logo loaded','color:#7A5AF8;font-weight:700');
}catch(e){console.warn('[v30.1] fail',e);}})();

/* v31 row logos: after each leads/clients table render, prepend a company logo (or initials) to the business-name cell */
(function(){try{
 function dom(b){return b.website?String(b.website).replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,''):'';}
 function logoNode(b){
  var box=document.createElement('span');
  box.className='rowlogo';
  box.style.cssText='width:30px;height:30px;border-radius:9px;background:#F4EFE6;border:1px solid #EEE8DE;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:#55596A;flex:0 0 30px;position:relative;overflow:hidden;margin-right:10px;vertical-align:middle';
  box.textContent=(typeof initials==='function')?initials(b.name||'?'):'';
  var d=dom(b);
  if(d){var im=document.createElement('img');im.src='https://logo.clearbit.com/'+d;im.alt='';im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:3px';im.onerror=function(){this.remove();};box.appendChild(im);}
  return box;
 }
 function paint(){
  try{
   if(current!=='leads'&&current!=='clients')return;
   if(typeof openLead!=='undefined'&&openLead)return;
   var v=document.getElementById('view');if(!v)return;
   var rows=v.querySelectorAll('tbody tr');
   rows.forEach(function(tr){
    var cell=tr.cells&&tr.cells.length?tr.querySelector('td b'):null;
    if(!cell||cell.parentNode.querySelector('.rowlogo'))return;
    var btn=tr.querySelector('[onclick*="openLeadFn"],[onclick*="openLead="]');
    var id=null;var m;
    var any=tr.querySelector('[onclick]');
    if(any){m=(any.getAttribute('onclick')||'').match(/openLeadFn\('([^']+)'\)|openLead='([^']+)'/);if(m)id=m[1]||m[2];}
    if(!id)return;
    var b=getLead(id);if(!b)return;
    cell.parentNode.insertBefore(logoNode(b),cell.parentNode.firstChild);
    cell.parentNode.style.whiteSpace='nowrap';
   });
  }catch(e){}
 }
 var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);paint();return o;};
 setTimeout(paint,200);
 console.info('%c[v31 row logos] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('[v31 row logos] fail',e);}})();

try{render();}catch(e){console.error('Init render failed',e);document.body.innerHTML='<div style="max-width:520px;margin:80px auto;font-family:sans-serif;text-align:center;padding:24px;color:#1C1E2B"><h2 style="color:#FF6B00;margin:0 0 8px">Direct Business</h2><p style="color:#444">The saved data could not be loaded. Reset to the seeded data to recover — your saved file is unchanged.</p><button onclick="try{localStorage.removeItem(KEY);}catch(_){}finally{location.reload();}" style="background:#FF6B00;color:#fff;border:0;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Reset &amp; reload</button></div>';}
