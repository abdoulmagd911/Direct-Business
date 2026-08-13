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
  var depLower=depL.map(function(s){return s.toLowerCase();});

  // helpers
  function awardsStrip(){return '';return '<div class="dt-awards-row" style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0">'+
    [].map(function(a){return '<span style="background:#FFF1E6;color:#A9781A;border:1px solid #F4C892;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">'+a+'</span>';}).join('')+'</div>';}
  function talkingPoints(){
    var A=(typeof AGENCY!=='undefined')?AGENCY:{};
    var pts=['10+ years in Saudi B2B travel','600+ airline agreements','2.5M+ accommodation options','IATA '+(A.iata||'7123828')+' - PAX accredited','Amadeus production + NDC content','PCI-DSS certified, Bank Guarantee 750K SAR','World Travel Award x3 + Great Place to Work x3',"Clients: Saudi Red Crescent, Ma'aden, Saudi Ports"];
    return ''; /* v29: talking-points card hidden for now */ var __v29dead='<div class="card"><h3>x</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">For cold calls &amp; first-contact messages - pulled from the company profile</div><ul style="margin:0;padding-inline-start:18px;font-size:13px;line-height:1.7">'+pts.map(function(p){return '<li>'+p+'</li>';}).join('')+'</ul></div>';
  }

  // About one-pager (bilingual, printable)
  window.directAboutPage=function(tender){
    var A=(typeof AGENCY!=='undefined')?AGENCY:{};
    var rows=[['Trade name',(A.tradeName||'Direct Travel / DirectKSA')],
      ['Experience','10+ years in Saudi B2B travel'],
      ['Scale','600+ airline agreements · 2.5M+ stays · TECHTIC tech subsidiary'],
      ['IATA',(A.iata||'7123828')+' — PAX accredited (2024/25/26)'],
      ['Amadeus','Office '+(A.amadeusOffice||'RUHS2234B')+' · Web Services '+(A.amadeusWS||'WSMSMTBS')+' (DCS PLUS integration)'],
      ['CR',(A.cr||'-')],['VAT',(A.vat||'-')],['DUNS',(A.duns||'-')],['Zakat / Tax ID',(A.zakatId||'-')],['Trade License',(A.tradeLicense||'-')],['Amadeus org / PIN',((A.org||'-')+' / PIN '+(A.amadeusPin||'-'))],
      ['Compliance','PCI-DSS · Bank Guarantee 750K SAR · DUNS registered'],
      ['Address',(A.address||'Saif Plaza, Jeddah Road, Al-Hada District, Riyadh 12321')],
      ['Contact',(A.website||'www.directksa.com')+' · '+(A.phone||'+966 508 434 126')]];
    var clients=['Saudi Red Crescent',"Ma'aden",'Saudi Ports Authority','Roads General Authority','Saudi Fund for Development','Ministry of Industry','Islamic University of Madinah'];
    var awards=['World Travel Award 2023','World Travel Award 2024','World Travel Award 2025','Great Place to Work x3','ICEF','English UK','British Council','IATA PAX 2026','PCI-DSS'];
    var tenderBlock=tender?'<h2>Why Direct for your tender · لماذا دايركت</h2><p>A Saudi-accredited TMC with 10+ years of government & enterprise travel operations, 600+ airline agreements, 24/7 servicing, ZATCA-compliant invoicing, and an in-house technology subsidiary (TECHTIC). Trusted by Saudi Red Crescent, Ma\'aden and Saudi Ports Authority.</p>':'';
    var html='<!DOCTYPE html><meta charset="utf-8"><title>'+(tender?'Direct Travel — Tender One-Pager':'About Direct Travel')+'</title>'+
     '<style>body{font-family:Inter,Arial,sans-serif;color:#1C1E2B;max-width:820px;margin:24px auto;padding:0 24px;line-height:1.6}h1{color:#FF6B00;margin:0 0 2px;font-size:26px}h2{border-bottom:2px solid #FF6B00;padding-bottom:4px;margin-top:22px;font-size:16px}.ar{direction:rtl;text-align:right;font-family:Tajawal,Arial}.row{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.b{background:#FFF1E6;color:#A9781A;border:1px solid #F4C892;border-radius:20px;padding:3px 11px;font-size:12px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:13px}td{border:1px solid #eee;padding:7px 9px}.k{background:#faf7f2;font-weight:700;width:38%}@media print{.noprint{display:none}}</style>'+
     '<button class="noprint" onclick="window.print()" style="background:#FF6B00;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;margin-bottom:14px">🖨 Print / Save as PDF</button>'+
     '<h1>Direct Travel · DirectKSA</h1>'+
     '<div class="ar" style="font-size:18px;font-weight:700">دايركت للسفر والسياحة</div>'+
     '<p>Legal entity: <b>Al-Masafer Al-Mubashar for Travel &amp; Tourism</b><br><span class="ar">الاسم النظامي: المسافر المباشر للسفر والسياحة</span></p>'+
     awardsStrip()+tenderBlock+
     '<h2>At a glance · لمحة</h2><table>'+rows.map(function(r){return '<tr><td class="k">'+r[0]+'</td><td>'+r[1]+'</td></tr>';}).join('')+'</table>'+
     '<h2>Key clients · أبرز العملاء</h2><div class="row">'+clients.map(function(c){return '<span class="b">'+c+'</span>';}).join('')+'</div>'+
     '<h2>Awards &amp; accreditations · الجوائز والاعتمادات</h2><div class="row">'+awards.map(function(c){return '<span class="b">'+c+'</span>';}).join('')+'</div>';
    var w=window.open('','_blank'); if(!w){alert('Allow popups to view the one-pager.');return;} w.document.write(html); w.document.close();
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
      var b=document.createElement('div');b.className='dt-verdicts card';b.style.cssText='margin-bottom:12px;border-left:3px solid #FF6B00';
      b.innerHTML='<h3>Provider verdicts</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">From the Provider Evaluations scorecard</div><div style="font-size:13px;line-height:1.8">'+
        '<div><span style="color:#16B364;font-weight:700">Keep:</span> '+keepL.join(', ')+'</div>'+
        '<div><span style="color:#2E90FA;font-weight:700">Upgrade in progress:</span> '+upL.join(', ')+'</div>'+
        '<div><span style="color:#F0453A;font-weight:700">Deprecated (phasing out):</span> '+depL.join(', ')+'</div></div>';
      v.insertBefore(b,v.firstChild);
    }
    try{if(depLower.length)document.querySelectorAll('select option').forEach(function(o){if(depLower.indexOf((o.textContent||'').trim().toLowerCase())>-1)o.remove();});}catch(e){}
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
   GF:{voidRule:FSCvoid,refundRule:'Per fare rule to original FOP via Refund Application (RA) - STRICT RA submission compliance required (Gulf Air enforces)',lccRefundTo:'N/A (FSC)',reissueRule:'NDC involuntary exchange for impacted bookings; voluntary = change fee + ADC',noShow:'Per fare rule',admRisk:'High - active ADM / RA compliance (contact Robert Catal +966 505430118)'},
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
      var s=document.createElement('div');s.className='dt-admin-links card';s.style.cssText='margin-bottom:12px;border-left:3px solid #7C8194';
      s.innerHTML='<h3>Admin & history</h3><div class="ch-sub" style="color:#7C8194;font-size:12px;margin-bottom:6px">Audit trail and archived records</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="current=\'activity\';render();window.scrollTo(0,0);">Activity & Audit</button><button class="btn" onclick="current=\'archive\';render();window.scrollTo(0,0);">Archive</button><button class="btn" onclick="current=\'sync\';render();window.scrollTo(0,0);">Connections</button></div>'+(typeof v295TeamCard==="function"?v295TeamCard():"")+'';
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
const RPT_OBJECTIVES=[
 {n:1, t:"Increase revenue from commercial contracts and direct sales", link:"4.1 - 5.1", dept:"Visas & Study + Hotels & Flights"},
 {n:2, t:"Expand participation in public and private tenders as a revenue stream", link:"5.2", dept:"Visas & Study + Hotels & Flights"},
 {n:3, t:"Improve supplier terms and contract conditions", link:"4.3", dept:"All Departments"},
 {n:4, t:"Increase the number of payment solutions", link:"4.1", dept:"Products and Tech"},
 {n:5, t:"Raise customer satisfaction by improving complaint handling", link:"1.1", dept:"All Departments"},
 {n:6, t:"Expand strategic partnerships to enhance travel and service integration", link:"3.1", dept:"Products and Tech"},
 {n:7, t:"Explore new travel services \"support services\" and increase the number of embassies for visas business", link:"3.1", dept:"Products and Tech"},
 {n:8, t:"Achieve recognition through a local or international award in tourism or education", link:"2", dept:"NA"},
 {n:9, t:"Drive innovation by engaging employees to generate and implement creative ideas", link:"7.3", dept:"NA"},
 {n:10,t:"Apply unified quality standards across all departments", link:"8.3", dept:"All Departments"},
 {n:11,t:"Manage the commercial pricing across all products", link:"5.1", dept:"NA"},
 {n:12,t:"Direct's presence at key B2B travel and exhibitions and conferences", link:"2", dept:"NA"},
 {n:13,t:"Build a centralised commercial platform providing all departments with real-time data and insights", link:"8.2", dept:"NA"},
 {n:14,t:"Commercially launch and grow a full suite of luxury travel services", link:"3.1", dept:"NA"}
];
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
const RPT_KEY="directReportsData_v1";
function rptLoad(){try{const d=JSON.parse(localStorage.getItem(RPT_KEY));if(d&&d.achievements)return d;}catch(e){}return {achievements:[],overrides:{}};}
let RDB=rptLoad();
function rptSave(){localStorage.setItem(RPT_KEY,JSON.stringify(RDB));}
const rptUid=()=>"a_"+Date.now()+"_"+Math.floor(Math.random()*1e4);
const rfmtN=v=>v==null||isNaN(v)?"—":Number(v).toLocaleString("en-US",{maximumFractionDigits:1});
function rfmtTarget(k){return k.type==="sar"?rfmtN(k.target)+" SAR":k.type==="pct"?k.target+"%":k.type==="score"?k.target:rfmtN(k.target);}
function rfmtVal(k,v){if(v==null)return "—";return k.type==="sar"?rfmtN(v)+" SAR":k.type==="pct"?rfmtN(v)+"%":rfmtN(v);}
function rptActual(k){
  const ov=RDB.overrides[k.n];
  if(ov!=null&&ov!=="")return Number(ov);
  const rows=RDB.achievements.filter(a=>Number(a.kpi)===k.n&&a.value!==""&&a.value!=null&&!isNaN(a.value));
  if(!rows.length)return null;
  if(k.type==="pct"||k.type==="score"){rows.sort((a,b)=>(a.date>b.date?1:-1));return Number(rows[rows.length-1].value);}
  return rows.reduce((s,a)=>s+Number(a.value),0);
}
function rptPct(k){const a=rptActual(k);return a==null?0:Math.min(100,Math.round(a/k.target*100));}
function rptObjProgress(on){const ks=RPT_KPIS.filter(k=>k.obj===on);if(!ks.length)return null;const withData=ks.filter(k=>rptActual(k)!=null);if(!withData.length)return 0;return Math.round(ks.reduce((s,k)=>s+rptPct(k),0)/ks.length);}
function rptMonthKey(d){return (d||"").slice(0,7);}
function rptQuarterOf(d){const m=Number((d||"").slice(5,7));return m?Math.ceil(m/3):0;}
const RPT_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
function rptMonthLabel(mk){if(!mk)return "";const p=mk.split("-");return RPT_MONTHS[Number(p[1])-1]+" "+p[0];}
let rptTab="overview",rptOpenObjs={},rptAchFilter={month:"",member:"",obj:""};
let rptRep={type:"monthly",month:new Date().toISOString().slice(0,7),quarter:"Q"+Math.ceil((new Date().getMonth()+1)/3),year:new Date().getFullYear(),scope:"dept",member:RPT_TEAM[0],obj:""};
window.rptGo=function(k){rptTab=k;render();};
function rptCss(){
 if(document.getElementById('rptcss'))return;
 const s=document.createElement('style');s.id='rptcss';
 s.textContent='.rpt-tabs{display:flex;gap:4px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:4px;overflow-x:auto;margin-bottom:14px}.rpt-tabs button{border:0;background:none;padding:9px 16px;font:600 13px inherit;font-family:inherit;color:var(--muted);cursor:pointer;border-radius:9px;white-space:nowrap}.rpt-tabs button.on{color:#fff;background:linear-gradient(135deg,var(--orange),var(--orange-2))}.rpt-bar{height:8px;background:#F2EDE4;border-radius:99px;overflow:hidden}.rpt-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--orange),var(--orange-2))}.rpt-bar i.ok{background:#1E9E62}.rpt-bar i.warn{background:#D9920B}.rpt-small{font-size:11.5px;color:var(--muted)}.rpt-obj{border:1px solid var(--line);border-radius:13px;background:#fff;margin-bottom:12px;overflow:hidden}.rpt-obj>.head{display:flex;gap:12px;align-items:center;padding:14px 16px;cursor:pointer}.rpt-obj .n{min-width:30px;height:30px;border-radius:99px;background:var(--orange);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}.rpt-obj .t{flex:1;font-weight:600}.rpt-obj .meta{font-size:11.5px;color:var(--muted)}.rpt-obj .body{border-top:1px solid var(--line);padding:14px 16px;display:none;background:#FDFBF7}.rpt-obj.open .body{display:block}.rpt-kpirow{display:grid;grid-template-columns:1fr 130px 170px 90px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed var(--line)}.rpt-kpirow:last-child{border-bottom:0}.rpt-kpirow .kt{font-size:13px;font-weight:500}.rpt-kpirow .kf{font-size:11px;color:var(--muted);margin-top:2px}.rpt-preview{background:#fff;border:1px solid var(--line);border-radius:13px;padding:26px;margin-top:16px}@media(max-width:760px){.rpt-kpirow{grid-template-columns:1fr 90px;row-gap:4px}.rpt-kpirow .ov,.rpt-kpirow .pr{grid-column:1/-1}}';
 document.head.appendChild(s);
}
window.renderReports=function(v){
 rptCss();
 const tabs=[["overview","Overview"],["achievements","Achievements"],["objectives","Objectives & KPIs"],["report","Generate Report"]];
 let html='<div class="rpt-tabs">'+tabs.map(t=>'<button class="'+(rptTab===t[0]?'on':'')+'" onclick="rptGo(\''+t[0]+'\')">'+t[1]+'</button>').join('')+'</div><div id="rptbody"></div>';
 v.innerHTML=html;
 const b=document.getElementById('rptbody');
 ({overview:rptOverview,achievements:rptAch,objectives:rptObj,report:rptReport})[rptTab](b);
};
function rptRowAch(a,withActs){
 const k=RPT_KPIS.find(x=>x.n===Number(a.kpi));
 return '<tr><td style="white-space:nowrap">'+esc(a.date)+'</td>'+
 '<td><b>'+esc(a.title)+'</b>'+(a.desc?'<div class="rpt-small">'+esc(a.desc)+'</div>':'')+(a.client?'<div class="rpt-small">Client: '+esc(a.client)+'</div>':'')+'</td>'+
 '<td>'+esc(a.member)+'</td>'+
 '<td>'+(a.objective?'<span class="tag">#'+a.objective+'</span>':'')+(k?'<div class="rpt-small">KPI '+k.n+'</div>':'')+'</td>'+
 '<td>'+(a.value!==''&&a.value!=null?rfmtVal(k||{type:a.unit==='SAR'?'sar':'count'},a.value):'—')+'</td>'+
 (withActs?'<td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" onclick="rptOpenAch(\''+a.id+'\')">Edit</button> <button class="btn ghost sm" style="color:#D94B3F" onclick="rptDelAch(\''+a.id+'\')">✕</button></td>':'')+'</tr>';
}
function rptOverview(v){
 const tot=RDB.achievements.length;
 const nowMk=new Date().toISOString().slice(0,7);
 const thisM=RDB.achievements.filter(a=>rptMonthKey(a.date)===nowMk).length;
 const tracked=RPT_KPIS.filter(k=>rptActual(k)!=null).length;
 const avg=RPT_KPIS.length?Math.round(RPT_KPIS.reduce((s,k)=>s+rptPct(k),0)/RPT_KPIS.length):0;
 const recent=RDB.achievements.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8);
 const objBars=RPT_OBJECTIVES.map(o=>{const p=rptObjProgress(o.n);return {o:o,p:p==null?0:p};}).sort((a,b)=>b.p-a.p);
 v.innerHTML='<div class="chips" style="margin-bottom:14px">'+
 '<div class="chip"><div class="v">'+tot+'</div><div class="l">Achievements logged</div></div>'+
 '<div class="chip"><div class="v">'+thisM+'</div><div class="l">This month</div></div>'+
 '<div class="chip"><div class="v">'+tracked+' / '+RPT_KPIS.length+'</div><div class="l">KPIs with data</div></div>'+
 '<div class="chip"><div class="v">'+avg+'%</div><div class="l">Avg progress to 2026 targets</div></div></div>'+
 '<div class="card"><h3>Objective progress <span class="rpt-small">— average of each objective\'s KPI progress</span></h3>'+
 objBars.map(x=>'<div style="display:flex;gap:10px;align-items:center;margin:7px 0"><span class="tag" style="min-width:34px;text-align:center">#'+x.o.n+'</span><div style="flex:1"><div style="font-size:12.5px;margin-bottom:3px">'+esc(x.o.t)+'</div><div class="rpt-bar"><i class="'+(x.p>=100?'ok':x.p>=50?'':'warn')+'" style="width:'+x.p+'%"></i></div></div><b style="min-width:42px;text-align:right">'+x.p+'%</b></div>').join('')+'</div>'+
 '<div class="card"><h3>Recent achievements <button class="btn pri sm" onclick="rptOpenAch()">＋ Log achievement</button></h3>'+
 (recent.length?'<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Achievement</th><th>Member</th><th>Objective</th><th>Value</th></tr></thead><tbody>'+recent.map(a=>rptRowAch(a,false)).join('')+'</tbody></table></div>':'<div class="empty">No achievements yet — log the first one.</div>')+'</div>';
}
function rptAch(v){
 let rows=RDB.achievements.slice().sort((a,b)=>a.date<b.date?1:-1);
 if(rptAchFilter.month)rows=rows.filter(a=>rptMonthKey(a.date)===rptAchFilter.month);
 if(rptAchFilter.member)rows=rows.filter(a=>a.member===rptAchFilter.member);
 if(rptAchFilter.obj)rows=rows.filter(a=>String(a.objective)===rptAchFilter.obj);
 const months=[...new Set(RDB.achievements.map(a=>rptMonthKey(a.date)))].sort().reverse();
 v.innerHTML='<div class="toolbar">'+
 '<select onchange="rptSetFilter(\'month\',this.value)"><option value="">All months</option>'+months.map(m=>'<option value="'+m+'" '+(rptAchFilter.month===m?'selected':'')+'>'+rptMonthLabel(m)+'</option>').join('')+'</select>'+
 '<select onchange="rptSetFilter(\'member\',this.value)"><option value="">All members</option>'+RPT_TEAM.map(t=>'<option '+(rptAchFilter.member===t?'selected':'')+'>'+t+'</option>').join('')+'</select>'+
 '<select onchange="rptSetFilter(\'obj\',this.value)"><option value="">All objectives</option>'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(rptAchFilter.obj==o.n?'selected':'')+'>#'+o.n+' — '+esc(o.t.slice(0,40))+'…</option>').join('')+'</select>'+
 '<span class="rpt-small">'+rows.length+' entr'+(rows.length===1?'y':'ies')+'</span><span style="flex:1"></span>'+
 '<button class="btn pri" onclick="rptOpenAch()">＋ Log achievement</button></div>'+
 '<div class="card">'+(rows.length?'<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Achievement</th><th>Member</th><th>Objective / KPI</th><th>Value</th><th></th></tr></thead><tbody>'+rows.map(a=>rptRowAch(a,true)).join('')+'</tbody></table></div>':'<div class="empty">Nothing here yet. Log achievements as they happen — tenders submitted, contracts signed, embassies added, services launched…</div>')+'</div>';
}
window.rptSetFilter=function(k,val){rptAchFilter[k]=val;render();};
window.rptOpenAch=function(id){
 const a=id?RDB.achievements.find(x=>x.id===id):{date:new Date().toISOString().slice(0,10),member:RPT_TEAM[0],title:"",desc:"",objective:"",kpi:"",value:"",client:""};
 if(!a)return;
 openModal((id?'Edit':'Log')+' achievement',
 '<div class="grid2"><div class="field"><label>Date</label><input type="date" id="rf_date" value="'+esc(a.date)+'"></div><div class="field"><label>Team member</label><select id="rf_member">'+RPT_TEAM.map(t=>'<option '+(a.member===t?'selected':'')+'>'+t+'</option>').join('')+'</select></div></div>'+
 '<div class="field"><label>What was achieved</label><input type="text" id="rf_title" value="'+esc(a.title)+'" placeholder="e.g. Tender submitted to Saudi Ports Authority"></div>'+
 '<div class="field"><label>Details (optional)</label><textarea id="rf_desc" rows="2">'+esc(a.desc||'')+'</textarea></div>'+
 '<div class="grid2"><div class="field"><label>Linked objective</label><select id="rf_obj" onchange="rptSyncKpiList()"><option value="">— none —</option>'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(a.objective==o.n?'selected':'')+'>#'+o.n+' — '+esc(o.t.slice(0,46))+'</option>').join('')+'</select></div><div class="field"><label>Linked KPI</label><select id="rf_kpi"></select></div></div>'+
 '<div class="grid2"><div class="field"><label>Numeric value (counts toward the KPI)</label><input type="number" id="rf_value" value="'+(a.value!=null?a.value:'')+'" placeholder="e.g. 1 tender · 300000 SAR"></div><div class="field"><label>Client / entity (optional)</label><input type="text" id="rf_client" value="'+esc(a.client||'')+'"></div></div>',
 function(){
   const g=i=>document.getElementById(i).value;
   const rec={date:g('rf_date'),member:g('rf_member'),title:g('rf_title').trim(),desc:g('rf_desc').trim(),objective:g('rf_obj'),kpi:g('rf_kpi'),value:g('rf_value'),client:g('rf_client').trim()};
   if(!rec.title){alert('Please write what was achieved.');return false;}
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
 document.getElementById('rf_kpi').innerHTML='<option value="">— none —</option>'+list.map(k=>'<option value="'+k.n+'" '+(String(sel)===String(k.n)?'selected':'')+'>KPI '+k.n+' — '+esc(k.t.slice(0,46))+' (target '+rfmtTarget(k)+')</option>').join('');
};
window.rptDelAch=function(id){if(!confirm('Delete this achievement?'))return;RDB.achievements=RDB.achievements.filter(x=>x.id!==id);rptSave();render();};
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
  '<span class="n">'+o.n+'</span><div class="t">'+esc(o.t)+'<div class="meta">Strategic link '+esc(o.link)+' · '+esc(o.dept)+' · '+ks.length+' KPI'+(ks.length!==1?'s':'')+' · '+ach.length+' achievement'+(ach.length!==1?'s':'')+'</div></div>'+
  '<div style="min-width:130px"><div class="rpt-bar"><i class="'+((p>=100)?'ok':(p>=50)?'':'warn')+'" style="width:'+(p||0)+'%"></i></div><div class="rpt-small" style="text-align:right">'+(p==null?'no KPI':p+'%')+'</div></div></div>'+
  '<div class="body">'+
  (ks.length?ks.map(k=>{
    const act=rptActual(k);const pc=rptPct(k);const ov=RDB.overrides[k.n];
    return '<div class="rpt-kpirow"><div><div class="kt">KPI '+k.n+' — '+esc(k.t)+(k.draft?' <span class="tag" style="background:#FEF3E2;color:#B54708">draft - confirm target</span>':'')+'</div><div class="kf">'+k.f.map(esc).join(' · ')+'</div></div>'+
    '<div><div class="rpt-small">Target</div><b>'+rfmtTarget(k)+'</b></div>'+
    '<div class="pr"><div class="rpt-small">Actual: <b>'+rfmtVal(k,act)+'</b>'+((ov!=null&&ov!=='')?' <span class="tag">manual</span>':'')+'</div><div class="rpt-bar"><i class="'+(pc>=100?'ok':pc>=50?'':'warn')+'" style="width:'+pc+'%"></i></div></div>'+
    '<div class="ov"><input type="number" placeholder="override" value="'+((ov!=null)?ov:'')+'" style="width:100%" onchange="rptSetOverride('+k.n+',this.value)"></div></div>';
  }).join(''):'<div class="rpt-small">No KPIs linked to this objective.</div>')+
  (ins.length?'<div style="margin-top:12px"><div class="rpt-small" style="font-weight:700;margin-bottom:5px">INITIATIVES</div>'+ins.map(i=>'<div class="rpt-small">• '+esc(i.t)+'</div>').join('')+'</div>':'')+
  (ach.length?'<div style="margin-top:12px"><div class="rpt-small" style="font-weight:700;margin-bottom:5px">ACHIEVEMENTS</div>'+ach.sort((a,b)=>a.date<b.date?1:-1).slice(0,6).map(a=>'<div class="rpt-small">• '+esc(a.date)+' — '+esc(a.title)+' ('+esc(a.member)+')</div>').join('')+'</div>':'')+
  '</div></div>';
 }).join('');
}
function rptReport(v){
 v.innerHTML='<div class="card"><h3>Generate report</h3><div class="grid2">'+
 '<div class="field"><label>Report type</label><select onchange="rptRepSet(\'type\',this.value)"><option value="monthly" '+(rptRep.type==='monthly'?'selected':'')+'>Monthly department report</option><option value="quarterly" '+(rptRep.type==='quarterly'?'selected':'')+'>Quarterly objectives review</option></select></div>'+
 (rptRep.type==='monthly'
  ?'<div class="field"><label>Month</label><input type="month" value="'+rptRep.month+'" onchange="rptRepSet(\'month\',this.value)"></div>'
  :'<div class="field"><label>Quarter</label><select onchange="rptRepSet(\'quarter\',this.value)">'+['Q1','Q2','Q3','Q4'].map(q=>'<option '+(rptRep.quarter===q?'selected':'')+'>'+q+'</option>').join('')+'</select></div><div class="field"><label>Year</label><input type="number" value="'+rptRep.year+'" onchange="rptRepSet(\'year\',this.value)"></div>')+
 '<div class="field"><label>Scope</label><select onchange="rptRepSet(\'scope\',this.value)"><option value="dept" '+(rptRep.scope==='dept'?'selected':'')+'>Whole department</option><option value="member" '+(rptRep.scope==='member'?'selected':'')+'>One member</option><option value="obj" '+(rptRep.scope==='obj'?'selected':'')+'>One objective</option></select></div>'+
 (rptRep.scope==='member'?'<div class="field"><label>Member</label><select onchange="rptRepSet(\'member\',this.value)">'+RPT_TEAM.map(t=>'<option '+(rptRep.member===t?'selected':'')+'>'+t+'</option>').join('')+'</select></div>':'')+
 (rptRep.scope==='obj'?'<div class="field"><label>Objective</label><select onchange="rptRepSet(\'obj\',this.value)">'+RPT_OBJECTIVES.map(o=>'<option value="'+o.n+'" '+(rptRep.obj==o.n?'selected':'')+'>#'+o.n+' — '+esc(o.t.slice(0,40))+'</option>').join('')+'</select></div>':'')+
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
function rptTitle(){
 const period=rptRep.type==='monthly'?rptMonthLabel(rptRep.month):rptRep.quarter+' '+rptRep.year;
 const scope=rptRep.scope==='member'?(' — '+rptRep.member):rptRep.scope==='obj'?(' — Objective #'+rptRep.obj):'';
 return (rptRep.type==='monthly'?'Monthly Commercial Report':'Quarterly Objectives Review')+' · '+period+scope;
}
function rptHTML(){
 const rows=rptFilterAch();
 const objs=rptRep.scope==='obj'?RPT_OBJECTIVES.filter(o=>String(o.n)===String(rptRep.obj)):RPT_OBJECTIVES;
 const td='padding:6px;border-bottom:1px solid #F5F1E9';
 const kpiRows=objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n)).map(k=>{
  const act=rptActual(k);const pc=rptPct(k);
  return '<tr><td style="'+td+'">KPI '+k.n+'</td><td style="'+td+'">'+esc(k.t)+'</td><td style="'+td+';text-align:right">'+rfmtTarget(k)+'</td><td style="'+td+';text-align:right">'+rfmtVal(k,act)+'</td><td style="'+td+';text-align:right;color:'+(pc>=100?'#1E9E62':pc>=50?'#FF6B00':'#D9920B')+';font-weight:700">'+(act==null?'—':pc+'%')+'</td></tr>';
 }).join('');
 const gaps=objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n)).filter(k=>rptPct(k)<50).map(k=>'<li>KPI '+k.n+' — '+esc(k.t)+': at '+(rptActual(k)==null?'no data':rptPct(k)+'%')+' of target '+rfmtTarget(k)+'</li>').join('');
 return '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF6B00;padding-bottom:14px;margin-bottom:18px">'+
 '<div>'+(typeof logoSrc==='function'?'<img src="'+logoSrc()+'" style="height:40px;display:block;margin-bottom:6px" alt="Direct">':'')+'<div style="font-weight:800;font-size:21px">'+(typeof brandName==='function'?brandName():'Direct Business')+'</div>'+
 '<div style="color:#7C8194;font-size:12px">Commercial Department · Operational Plan 2026</div></div>'+
 '<div style="text-align:right;font-size:12px;color:#7C8194">Generated '+new Date().toISOString().slice(0,10)+'</div></div>'+
 '<h2 style="font-weight:700;font-size:17px;margin-bottom:14px">'+esc(rptTitle())+'</h2>'+
 '<h3 style="font-weight:700;font-size:13.5px;margin:16px 0 8px;color:#3C4050">1 · Achievements ('+rows.length+')</h3>'+
 (rows.length?'<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#7C8194;text-align:left"><th style="padding:6px;border-bottom:1px solid #EEE8DE">Date</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">Achievement</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">Member</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">Obj.</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Value</th></tr></thead><tbody>'+
 rows.map(a=>{const k=RPT_KPIS.find(x=>x.n===Number(a.kpi));return '<tr><td style="'+td+';white-space:nowrap">'+esc(a.date)+'</td><td style="'+td+'"><b>'+esc(a.title)+'</b>'+(a.client?'<br><span style="color:#7C8194">'+esc(a.client)+'</span>':'')+'</td><td style="'+td+'">'+esc(a.member)+'</td><td style="'+td+'">'+(a.objective?'#'+a.objective:'')+'</td><td style="'+td+';text-align:right">'+(a.value!==''&&a.value!=null?rfmtVal(k||{type:'count'},a.value):'—')+'</td></tr>';}).join('')+'</tbody></table>'
 :'<div style="color:#7C8194;font-size:13px">No achievements logged in this period'+(rptRep.scope!=='dept'?' for this scope':'')+'.</div>')+
 '<h3 style="font-weight:700;font-size:13.5px;margin:18px 0 8px;color:#3C4050">2 · KPI progress vs 2026 targets</h3>'+
 '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="color:#7C8194;text-align:left"><th style="padding:6px;border-bottom:1px solid #EEE8DE">#</th><th style="padding:6px;border-bottom:1px solid #EEE8DE">KPI</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Target</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Actual (YTD)</th><th style="padding:6px;border-bottom:1px solid #EEE8DE;text-align:right">Progress</th></tr></thead><tbody>'+kpiRows+'</tbody></table>'+
 (gaps?'<h3 style="font-weight:700;font-size:13.5px;margin:18px 0 8px;color:#3C4050">3 · Gaps &amp; focus areas (&lt;50% of target)</h3><ul style="font-size:12.5px;padding-left:18px;color:#1C1E2B">'+gaps+'</ul>':'')+
 '<div style="margin-top:24px;border-top:1px solid #EEE8DE;padding-top:10px;font-size:10.5px;color:#7C8194">AL MOSAFER AL MOBASHER TRAVEL &amp; TOURISM · IATA 71238285 · Amadeus RUHS2234B · PCI-DSS · www.directksa.com · +966 508 434 126</div>';
}
window.rptBuildReport=function(){const o=document.getElementById('rptout');if(o)o.innerHTML='<div class="rpt-preview" id="rptdoc">'+rptHTML()+'</div>';};
function rptText(){
 const rows=rptFilterAch();
 let t=rptTitle()+'\n'+'='.repeat(40)+'\n\nACHIEVEMENTS ('+rows.length+')\n';
 rows.forEach(a=>{t+='• '+a.date+' — '+a.title+(a.client?' ['+a.client+']':'')+' — '+a.member+(a.value?(' — '+a.value):'')+'\n';});
 t+='\nKPI PROGRESS\n';
 const objs=rptRep.scope==='obj'?RPT_OBJECTIVES.filter(o=>String(o.n)===String(rptRep.obj)):RPT_OBJECTIVES;
 objs.flatMap(o=>RPT_KPIS.filter(k=>k.obj===o.n)).forEach(k=>{const a=rptActual(k);t+='• KPI '+k.n+' '+k.t+': '+rfmtVal(k,a)+' / '+rfmtTarget(k)+(a==null?'':' ('+rptPct(k)+'%)')+'\n';});
 t+='\n— Direct Business · Commercial Department · directksa.com';
 return t;
}
window.rptCopyReport=function(){navigator.clipboard.writeText(rptText()).then(()=>alert('Report text copied — paste into WhatsApp or email.'));};
function rptFullDoc(){return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(rptTitle())+'</title><style>body{font-family:Cairo,Inter,system-ui,sans-serif;color:#1C1E2B;max-width:860px;margin:30px auto;padding:0 20px}</style></head><body>'+rptHTML()+'</body></html>';}
window.rptPrintReport=function(){const w=window.open('','_blank');if(!w){alert('Allow popups to print.');return;}w.document.write(rptFullDoc());w.document.close();setTimeout(()=>w.print(),400);};
window.rptDownloadReport=function(){const b=new Blob([rptFullDoc()],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=rptTitle().replace(/[^\w]+/g,'-')+'.html';a.click();};
window.rptExportJSON=function(){const b=new Blob([JSON.stringify(RDB,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-reports-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();};
window.rptWord=function(){var b=new Blob([String.fromCharCode(0xFEFF)+rptFullDoc()],{type:"application/msword"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=rptTitle().replace(/[^\w]+/g,"-")+".doc";a.click();};
window.rptPpt=function(){
 var go=function(){try{
  var P=new PptxGenJS();P.defineLayout({name:"W",width:13.33,height:7.5});P.layout="W";
  var ORANGE="F47A1F",INK="1C1E2B",CREAM="FBF8F4",MUT="7C8194";
  var s=P.addSlide();s.background={color:INK};
  try{if(typeof logoSrc==="function")s.addImage({data:logoSrc(),x:0.7,y:0.6,h:0.85,w:2.6});}catch(_){}
  s.addText("Direct Business",{x:0.7,y:2.7,w:11,fontSize:44,bold:true,color:"FFFFFF",fontFace:"Cairo"});
  s.addText(rptTitle(),{x:0.7,y:3.8,w:11,fontSize:22,color:"FF9D45",fontFace:"Cairo"});
  s.addText("Commercial Department - Operational Plan 2026 - directksa.com",{x:0.7,y:6.6,w:11,fontSize:12,color:"B9BDCB",fontFace:"Cairo"});
  var hdr=[{text:"KPI",options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:"Target",options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:"Actual",options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}},{text:"Progress",options:{bold:true,color:"FFFFFF",fill:{color:ORANGE}}}];
  var all=RPT_KPIS.map(function(k){var act=rptActual(k);var pc=rptPct(k);return [{text:"KPI "+k.n+" - "+k.t,options:{color:INK}},{text:rfmtTarget(k),options:{color:INK,align:"right"}},{text:rfmtVal(k,act),options:{color:INK,align:"right"}},{text:(act==null?"-":pc+"%"),options:{bold:true,align:"right",color:(pc>=100?"1E9E62":pc>=50?ORANGE:"D9920B")}}];});
  for(var i=0;i<all.length;i+=12){
    var sl=P.addSlide();sl.background={color:CREAM};
    sl.addText("KPI progress vs 2026 targets"+(all.length>12?(" ("+(Math.floor(i/12)+1)+")"):""),{x:0.6,y:0.35,fontSize:20,bold:true,color:INK,fontFace:"Cairo"});
    sl.addTable([hdr].concat(all.slice(i,i+12)),{x:0.6,y:1.0,w:12.1,fontSize:11,fontFace:"Cairo",border:{type:"solid",color:"EEE8DE",pt:0.5},colW:[7.3,1.6,1.6,1.6]});
  }
  var ach=rptFilterAch();
  for(var j=0;j<ach.length;j+=7){
    var sa=P.addSlide();sa.background={color:CREAM};
    sa.addText("Achievements"+(ach.length>7?(" ("+(Math.floor(j/7)+1)+")"):""),{x:0.6,y:0.35,fontSize:20,bold:true,color:INK,fontFace:"Cairo"});
    sa.addText(ach.slice(j,j+7).map(function(a){return {text:a.date+"  "+a.title+(a.client?" ["+a.client+"]":"")+" - "+a.member+(a.value?(" - "+a.value):""),options:{bullet:true,fontSize:13,color:INK,breakLine:true,fontFace:"Cairo"}};}),{x:0.6,y:1.1,w:12.1,h:5.6});
  }
  if(!ach.length){var se=P.addSlide();se.background={color:CREAM};se.addText("No achievements logged in this period.",{x:0.6,y:3,fontSize:16,color:MUT,fontFace:"Cairo"});}
  var sf=P.addSlide();sf.background={color:INK};
  sf.addText("AL MOSAFER AL MOBASHER TRAVEL & TOURISM",{x:0.7,y:3.0,w:11,fontSize:18,bold:true,color:"FFFFFF",fontFace:"Cairo"});
  sf.addText("IATA 71238285 - Amadeus RUHS2234B - PCI-DSS - www.directksa.com - +966 508 434 126",{x:0.7,y:3.8,w:11,fontSize:13,color:"FF9D45",fontFace:"Cairo"});
  P.writeFile({fileName:rptTitle().replace(/[^\w]+/g,"-")+".pptx"});
 }catch(e){alert("PowerPoint export failed: "+(e&&e.message?e.message:e));}};
 if(window.PptxGenJS){go();return;}
 var sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/pptxgen/3.12.0/pptxgen.bundle.min.js";sc.onload=go;sc.onerror=function(){alert("Internet needed once to load the PowerPoint engine.");};document.head.appendChild(sc);
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
/* v29.3 contact merge v3: proper company names + ALL contacts (emails & phones) + ALL sheet comments inside the lead card */
(function(){try{
 if(DB._cfMergeV3){}else{
 var DATA=[{"msgs":["[2026-04-21] استفسار: السلام عليكم ورحمة اللة . اخواني في مكتب دايركت انا مقيم وعايز اقدم لفيزا تركيا ولاكن من شروط الفيزا تاشيرة الخروج والعودة . وانا الشركة ما بتصدر التاشيرة الايوم السفر . هل في طريقة او حل لهاذا الشئ . وشكراً لكم.","[2026-04-04] شكوى: بلغى الحجز اللي باسمي وماقدرت","[2026-01-06] enquiry: طريقة التسجيل في الماجستير","[2025-10-04] استفسار: هل اقدر اقدم ع اللوترى من خلالكم","[2025-08-28] استفسار: تاشيرة قطر لمقيمي مجلس التعاون. انا مقيم. في السعوديه","[2025-08-25] enquiry: بسم الله الرحمن الرحيم  سعادة / رئيس مجلس الإدارة                                                 حفظة الله       السلام عليكم ورحمة الله وبركاته ... الموضوع / طلب مساعدة مالية أرسل لمقام سعادتكم الكريم خطابي هذا وفيه اطلب تقديم يد العون لي ولأسرتي وأملي بالله ثم بكم كبير. فأنا وزوجتي وأربعة من اخوا...","[2025-05-25] استفسار: عن التأشيرات","[2025-05-14] complaint: قدمت استخراج فيزاء لايطاليا واتصل علي مندوب دايركت وطلب مني الاوراق المطلوبه فاخبرته بان يتواصل معاي بالواتس   ولم يتواصل معاي اي احد لاجهز الاوراق المطلوبه","[2025-05-04] استفسار: بخصوص التاشيره","[2025-04-26] complaint: لو سمحت الاتصال لان الطلب اتاخر جدا ومش عارف فين مشكله","[2025-04-16] enquiry: فيزه للهند كم التكلفه.  و الشنقن","[2024-10-31] enquiry: US visa"],"contacts":[{"e":"abu.nader011@gamil.com","p":"500199070","n":"عبدالله خلف المالكي"},{"e":"nona20full@gamil.com","p":"555771835","n":"نوره الشمري"},{"e":"ta.alhad@gamil.com","p":"0598018888","n":"تميم ال هادي"},{"e":"adeebahalsaleem@gamil.com","p":"503896477","n":"اديبه"},{"e":"msq3116@gamil.com","p":"555940403","n":"محمد"},{"e":"bi007678@gamil.com","p":"552295510","n":"نايف علي محمد"},{"e":"dfgg@gamil.com","p":"553550218","n":"Salwa"},{"e":"a.alkurdi1975@gamil.com","p":"0547979179","n":"احمد ابراهيم الكردي"},{"e":"shakeer1400@gamil.com","p":"533831137","n":"شاكر ال درويش"},{"e":"yoyogamal930@gamil.com","p":"542980527","n":"ايه جمال عبد المطلب محمد"},{"e":"ahmedalpan555@gamil.com","p":"571855717","n":"احمد عبدالجبار احمد"},{"e":"yasmeen166180@gamil.com","p":"558337323","n":"ياسمين محمد حمامة"}],"dom":"gamil.com"},{"msgs":["[2026-04-16] شكوى: ابي ‏إلقاء الحجز ما قدرت"],"contacts":[{"e":"ft8768@iclond.com","p":"0535238768","n":"فاطمه احمد"}],"dom":"iclond.com"},{"msgs":["[2026-04-12] enquiry: تجديد جواز"],"contacts":[{"e":"amalrasheed@sama.gov.sa","p":"505478294","n":"عبدالعزيز"}],"dom":"sama.gov.sa"},{"msgs":["[2026-04-11] suggestion: تحية طيبة وبعد   نحن في مجموعة عماد بدور جهة متخصصة في تقديم خدمات الأعمال، الاستثمار، والإقامة في إسبانيا، ونعمل حالياً على بناء شبكة قوية من الشركاء في الدول العربية لتقديم حلول متكاملة واحترافية للعملاء الراغبين في الاستثمار أو الدراسة أو الاستقرار في إسبانيا أو حتى الحصول على الإقامة دون العيش ف..."],"contacts":[{"e":"info@imadbadour.com","p":"0534634609","n":"Imad Badour"}],"dom":"imadbadour.com"},{"msgs":["[2026-04-08] suggestion: لدينا منشأة - فندق كورنيت النورس نريد ادراج المكان في موقعكم ماهي الاجرائات"],"contacts":[{"e":"reservations@cornettalnawrashotel.com","p":"559164777","n":"احمد"}],"dom":"cornettalnawrashotel.com"},{"msgs":["[2026-04-06] استفسار: تقديم فيزا لفرنسا سياحية","[2025-06-15] استفسار: ابغا اسافر اليمن إلى مطار صنعاء ليش مايطلع لي ؟"],"contacts":[{"e":"hiamnader20@mail.com","p":"0568001163","n":"Dr Hiam Nader"},{"e":"qw250718@mail.com","p":"0574878061","n":"محمد الزراري"}],"dom":"mail.com"},{"msgs":["[2026-04-04] enquiry: Dear Sir,"],"contacts":[{"e":"amer.azmat@gmsil.com","p":"567577948","n":"AMIR SHAHZAD"}],"dom":"gmsil.com"},{"msgs":["[2026-03-31] enquiry: Informations about tourism Visa for Italy"],"contacts":[{"e":"osama.elfkey1@gevernova.com","p":"569880477","n":"Ossama Elfeky"}],"dom":"gevernova.com"},{"msgs":["[2026-03-19] enquiry: i would like to inquire , what happen for visa application after payment  i was applying for Japan and only system requested for passport copy ? would you please explain the process"],"contacts":[{"e":"hesham.hamed@honeywell.com","p":"0564236733","n":"Hesham Hamed"}],"dom":"honeywell.com"},{"msgs":["[2026-03-16] suggestion: Test by Saleh AlRibi","[2025-12-21] enquiry: الغاء الطلب و شكرا","[2025-08-12] استفسار: نوع الاستفسار انه هل تطلع  التأشيرات  لعائله مكونه من 6 اشخاص المتكفل بالدفع الام لوجود وظيفه حكوميه ولديها مبلغ وهل تطلع التأشيره  لولد  البنت لان البنت منفصله وساكنه مع عائلتها  فولدها معها وش الاجراء ارجو الرد","[2025-06-19] enquiry: السلام عليكم , انا مصرى بمقيم بالمملكه العربيه السعوديه ومع زوجتى وطفل تاشيره زياره عائليه , هل يمكننا التقديم على فيزا تركيا ؟"],"contacts":[{"e":"mu.mahmoud20@gmai.com","p":"580019548","n":"Mustafa Mahmoud"},{"e":"123abdulazizmasiri@gmai.com","p":"552892392","n":"Maram Ali M"},{"e":"musaomhammedseiko@gmai.com","p":"536043387","n":"محمد"},{"e":"saleh.ribi@gmai.com","p":"545735996","n":"saleh"}],"dom":"gmai.com"},{"msgs":["[2026-03-13] enquiry: Hi there,  I\u0027m Leo, just a short inquiry if blog.directksa.com is open to accepting paid posts?  If so, let me know how much you charge and your preferred payment method.  Sincerely,  Leo Corado Link Builder|Outreach Manager"],"contacts":[{"e":"connect@leocorado.com","p":"0500000000","n":"Leo Corado"}],"dom":"leocorado.com"},{"msgs":["[2026-03-10] enquiry: 966114963102"],"contacts":[{"e":"khalid@jkalomboskylusarls.com","p":"596771203","n":"khalid Muhammad"}],"dom":"jkalomboskylusarls.com"},{"msgs":["[2026-03-09] استفسار: خطاء ف التأشيرة. دولة التأشيرة المملكة العربية السعودية  وانا وضعت مصر. الرجاء تعديلها"],"contacts":[{"e":"pizzahut@mails.saudi.pizzahut.me","p":"557800875","n":"نوال  مصلح"}],"dom":"mails.saudi.pizzahut.me"},{"msgs":["[2026-03-07] شكوى: الفندق لم يصل لهم الحجز والدفع"],"contacts":[{"e":"thurayya100200@gmal.com","p":"0553778164","n":"ثريا القحطاني"}],"dom":"gmal.com"},{"msgs":["[2026-03-06] استفسار: هل لديكم b2b"],"contacts":[{"e":"saeed@bctravell.com","p":"500990414","n":"سعيد ال عايض"}],"dom":"bctravell.com"},{"msgs":["[2026-02-24] enquiry: I would like to connect with Marketing or Operations department for a strategic collaboration with our partner banks. This step could mutually benefit the parties in terms of short-term and long-term campaigns.","[2025-05-28] enquiry: تحيات!  أنا الشيخ سليمان من زابس للتسويق. نود أن نتعاون مع دايركت للسفر والسياحة كشراكة تخفيض مع عملائنا.   العملاء: البنك الأهلي، بنك السعودي الأول، البنك العربي الوطني، بنك السعودي الفرنسي، البنك السعودي للاستثمار، نايفات، فيزا، ماستركارد، الاتصالات السعودية (قطاف) ، البنك الدولي الخليجي، بنك البل...","[2025-05-28] enquiry: We would like to onboard Direct KSA for a discount partnership with our clients.  The Clients: Saudi National Bank, Saudi Awwal Bank, Arab National Bank, Banque Saudi Fransi, Saudi Investment Bank, Nayifat, Visa, Mastercard, Saudi Telecom (Qitaf), Gulf International bank,  Bank Al-Bilad and Bank Al-..."],"contacts":[{"e":"shaikh.sulaiman@zapsgroup.com","p":"530364278","n":"Shaikh Sulaiman"}],"dom":"zapsgroup.com"},{"msgs":["[2026-02-21] enquiry: استخراج تأشيرة لاذربيجان سياحية"],"contacts":[{"e":"a.abdulbaset@ibnroshd.edu.sa","p":"0556292751","n":"احمد عبد الباسط عبد الرحيم محمد"}],"dom":"ibnroshd.edu.sa"},{"msgs":["[2026-02-08] enquiry: Hi, We are looking for a Travel Agency to provide a complete Travel Management for our corporate company. Kindly call me to discuss further. Thanks, Barath Kumar","[2026-02-08] enquiry: Hi,"],"contacts":[{"e":"b.subramaniam@acgc.com.sa","p":"572262781","n":"Barath Kumar S"}],"dom":"acgc.com.sa"},{"msgs":["[2026-02-05] suggestion: Greetings,  We are pleased to introduce IDEA, with over 10 years of experience in exhibition booth design and execution, conference and event management, and integrated display solutions. We would be happy to support and execute your requirements for the LEAP Exhibition, should this be of interest. ..."],"contacts":[{"e":"sales1@ideaevents.net","p":"599062772","n":"Manal"}],"dom":"ideaevents.net"},{"msgs":["[2026-02-04] enquiry: Need Visa for Russia already visited about 4 to 5 months ago"],"contacts":[{"e":"export@basqats.com","p":"0581491626","n":"Ibrahim Aqel"}],"dom":"basqats.com"},{"msgs":["[2026-02-01] استفسار: انا مصري الجنسيه مقيم بالسعودية الرياض وزوجتي واولادي معهم تأشيرة زيارة متواجدين حاليا بالسعوديه أرغب بإصدار تأشيرة سياحه لهم ماهي الطلبات","[2026-01-04] استفسار: طلب تأشيره","[2025-06-24] enquiry: كيفية سداد الاعتماد المهني"],"contacts":[{"e":"mohammed.a00111@gmil.com","p":"590008008","n":"Mohammed"},{"e":"alhdadabwshym@gmil.com","p":"556813776","n":"محمد الحداد"},{"e":"raoufgad@gmil.com","p":"","n":"عبدالرؤف محمد السيد جاد"}],"dom":"gmil.com"},{"msgs":["[2026-01-27] enquiry: 0"],"contacts":[{"e":"mawadh@expo-time.co","p":"542902992","n":"mawada ahmed"}],"dom":"expo-time.co"},{"msgs":["[2026-01-18] Enquiry: I submitted the documents for Japan visa. Please call me"],"contacts":[{"e":"j.bhatti@evostel.com","p":"0554565425","n":"JAVED Bhatti"}],"dom":"evostel.com"},{"msgs":["[2026-01-04] enquiry: corporate services for organizations."],"contacts":[{"e":"gamea@directfn.com","p":"504484141","n":"Mohammed Gamea"}],"dom":"directfn.com"},{"msgs":["[2026-01-04] enquiry: I would like to follow up on the status of my China visa application submitted under Order No. [52137174]. It has been more than 10 days since the submission, and I have not yet received an update."],"contacts":[{"e":"meer.ali@aqpci.net","p":"557957264","n":"MEER ATIF ALI"}],"dom":"aqpci.net"},{"msgs":["[2026-01-02] استفسار: ارغب بالتواصل مع ادارة التطبيق لبحث فرصة تعاون مع شركة علم"],"contacts":[{"e":"saloraini@elm.sa","p":"0582270666","n":"Saleh"}],"dom":"elm.sa"},{"msgs":["[2026-01-01] enquiry: عن فيزا تركيا"],"contacts":[{"e":"mohamed.elmesalmy@alfanar.com","p":"532284155","n":"محمد المسلمي"}],"dom":"alfanar.com"},{"msgs":["[2025-12-29] enquiry: Shamil Translation specializes in certified translations for visa processing, document clearance services. We would be glad to assist your team with accurate and timely translation support. Kindly let us know how we may proceed. Thank you."],"contacts":[{"e":"shamil@shamiltranslation.com","p":"0558765896","n":"Mohammed AlAbdulla"}],"dom":"shamiltranslation.com"},{"msgs":["[2025-12-28] complaint: كنت سددت و لم تصلني الفاتورة"],"contacts":[{"e":"osama.omer@euroconsult.com","p":"534376630","n":"اسامة محمد عمر"}],"dom":"euroconsult.com"},{"msgs":["[2025-12-23] enquiry: I want a visit visa for dubai , I am india living in riyadh with valid passport and iqama . I want to join a event in dubai so want visa for it , can you please help me to get it ?"],"contacts":[{"e":"suppychain@hjeen.com","p":"546389834","n":"Shahnawaz Hassan"}],"dom":"hjeen.com"},{"msgs":["[2025-12-22] enquiry: تقديم اسهل فيزا شنجن"],"contacts":[{"e":"mahmoud@samanasm.com","p":"569848135","n":"Mahmoud barakat"}],"dom":"samanasm.com"},{"msgs":["[2025-12-15] suggestion: We are excited to invite you to the 14th Jeddah International Travel and Tourism Exhibition (JTTX), taking place from 28–30 January 2026 at the Jeddah Hilton Hotel.  JTTX is one of the region’s top B2B and B2C travel events, providing a powerful platform for networking, brand exposure, and business ..."],"contacts":[{"e":"sheikh.h@4m.com.sa","p":"568059954","n":"Sheikh Hafeez"}],"dom":"4m.com.sa"},{"msgs":["[2025-12-12] استفسار: اريد فيزا للسفر لامريكا يوم 26/12 ها بامكانكم المساعده"],"contacts":[{"e":"menna.hesham@speakol.com","p":"0502205348","n":"Mennatallah Hesham Yehia"}],"dom":"speakol.com"},{"msgs":["[2025-12-08] enquiry: نرغب بمساهمتكم معنا في مبادرة تشجير في محمية الملك عبدالعزيز الملكية عن طريق المسؤولية الاجتماعية"],"contacts":[{"e":"info@wasm.org.sa","p":"536808060","n":"جمعية وسم البيئية"}],"dom":"wasm.org.sa"},{"msgs":["[2025-12-04] enquiry: السلام عليكم","[2024-10-31] complaint: لقد تقدمت بطلب تاشيرة زيارة من السفارة البريطانية وتم اصدار التاشيرة لكن اتضح ان اسم زوجتي في خطا وهذا سوف يسبب لنا مشاكل ارجو حل الموضوع على اتم السرعه وبالاسم الصحيح تقبلو تحياتي"],"contacts":[{"e":"sshahrani@al-rushaid.com","p":"553001085","n":"سعد الشهراني"}],"dom":"al-rushaid.com"},{"msgs":["[2025-12-01] enquiry: Greetings,   We, Al Sharq Office Company for Trading Contracting \u0026 Maintenance, are interested in using your provided Travel and Tourism Services to our Employees. So, Kindly, provide us with your best Technical \u0026 Financial proposal for an opportunity of collaboration.  Best Regards, Osama Mohammed."],"contacts":[{"e":"o.almoqhem@asoc.com.sa","p":"553578944","n":"Osama Mohammed"}],"dom":"asoc.com.sa"},{"msgs":["[2025-12-01] enquiry: SELECT UserId, Name, Password FROM Users WHERE UserId = 105 or 1=1;"],"contacts":[{"e":"a@a.com","p":"","n":"SELECT UserId, Name, Password FROM Users WHERE UserId = 105 or 1=1;"}],"dom":"a.com"},{"msgs":["[2025-11-29] enquiry: طلب تأشيرة للصين انا مقيم بالسعودية","[2025-11-29] enquiry: طلب إصدار تأشيرة للصين"],"contacts":[{"e":"m.samir@feed.com.sa","p":"532438208","n":"Mohamed Samir"}],"dom":"feed.com.sa"},{"msgs":["[2025-11-24] استفسار: تاشيرت كندا","[2025-07-10] استفسار: طلب حجز","[2025-05-03] استفسار: تجديد جواز عامله بنغلاديشية","[2025-01-02] enquiry: التقديم على الفيزا للصين"],"contacts":[{"e":"g_m_e@hotmil.com","p":"505865233","n":"علي حسين ال فاران"},{"e":"princeazizo@hotmil.com","p":"0599899961","n":"عبدالعزيز باصفار"},{"e":"malek_k2020@hotmil.com","p":"0592050207","n":"خالد الحاجي"},{"e":"fahad2774@hotmil.com","p":"555455622","n":"فهد"}],"dom":"hotmil.com"},{"msgs":["[2025-11-24] suggestion: بحث شراكة بين الطرفين في تأمين السفر"],"contacts":[{"e":"fahad.alhusinan@walaa.com","p":"557088837","n":"فهد الحسينان- مدير الشراكات شركة ولاء للتأمين التعاوني"}],"dom":"walaa.com"},{"msgs":["[2025-11-19] استفسار: Visa"],"contacts":[{"e":"sales@sondosfac.com.sa","p":"509995331","n":"Ahmad alkahder"}],"dom":"sondosfac.com.sa"},{"msgs":["[2025-11-09] استفسار: I want to apply to Morrocco visa"],"contacts":[{"e":"hany.moustafa@omc.com","p":"0563007884","n":"Hany"}],"dom":"omc.com"},{"msgs":["[2025-11-05] enquiry: i would like your support for issuance of Schengen visa for my C.E.O. He would like to travel to italy"],"contacts":[{"e":"molgin.george@alsadara.com","p":"0554852709","n":"molgin george"}],"dom":"alsadara.com"},{"msgs":["[2025-11-04] complaint: Greetings,"],"contacts":[{"e":"azooz-19@mail.net.sa","p":"544485196","n":"abdulaziz"}],"dom":"mail.net.sa"},{"msgs":["[2025-11-02] suggestion: i want to collaborate with Direct company and be your DMC in Egypt."],"contacts":[{"e":"incoming@travelyalla.com","p":"","n":"Mariam Eskander"}],"dom":"travelyalla.com"},{"msgs":["[2025-10-26] enquiry: Dear Direct Office,"],"contacts":[{"e":"nalghwairi@stcbank.com.sa","p":"541606186","n":"Naif Alghwairi"}],"dom":"stcbank.com.sa"},{"msgs":["[2025-10-23] enquiry: نحن شركة و نرغب في عمل تعاقد مع مزود خدمات السياحة و السفر لتزويدنا بخدمات السفر و السياحة من منصتهم"],"contacts":[{"e":"aidha.b@drc.net.sa","p":"544171356","n":"Aidha Saleh"}],"dom":"drc.net.sa"},{"msgs":["[2025-10-20] suggestion: Let’s Help Students Prepare for Study Abroad  Dear Direct,  I’m HICHAM, founder of Boston English Center, an online school that helps students preparing to study abroad improve their English.  We teach:  Everyday English to help students adjust to life in a new country  Business English for internsh..."],"contacts":[{"e":"partnership@bostonenglishcenter.com","p":"","n":"HICHAM"}],"dom":"bostonenglishcenter.com"},{"msgs":["[2025-10-13] enquiry: يمني مقيم بالسعودية"],"contacts":[{"e":"saeedtop1@hotamil.com","p":"554061022","n":"سعيد صالح"}],"dom":"hotamil.com"},{"msgs":["[2025-10-12] enquiry: لا"],"contacts":[{"e":"abc@xyz.com","p":"0563147741","n":"حازم الابراهيم"}],"dom":"xyz.com"},{"msgs":["[2025-10-10] استفسار: مقيم في السعودية من الجنسية اليمنية هلا استطيع السفر الى كندا او بريطانيا وايش المتطلبات مني بالتفاصيل كامل","[2025-03-16] enquiry: اريد اسافر للعمل"],"contacts":[{"e":"bwkhldkhmys@gmaii.com","p":"0590872391","n":"مبخوت علي احمد خميسي"},{"e":"aii0506614721@gmaii.com","p":"0506614721","n":"جهاد محمد منصور الحميري"}],"dom":"gmaii.com"},{"msgs":["[2025-09-30] استفسار: أريد إضافه تاشيره دخول شهر واحد فقط بالعلم انه يوجد طلب سابق لتأشيرة ؟ والبرنامج غير قابل بأنه يضيف التأشيره الأخرى أرجو حل المشكله"],"contacts":[{"e":"kholud.e.banaemah@hotmmail.com","p":"0542244883","n":"خلود"}],"dom":"hotmmail.com"},{"msgs":["[2025-09-29] enquiry: test","[2024-10-15] complaint: I Love you Direct"],"contacts":[{"e":"saeedkhan@test.com","p":"532165478","n":"Saeed Test"},{"e":"test@test.com","p":"566666666","n":"test"}],"dom":"test.com"},{"msgs":["[2025-09-24] enquiry: شروط حول ناشيرة على الهند مقدم الطلب يحمل الجنسية الجزائريه"],"contacts":[{"e":"n.tebib@ucc-cpc.com","p":"508803916","n":"نور الدين"}],"dom":"ucc-cpc.com"},{"msgs":["[2025-09-18] استفسار: لاصدار تأشيرة لألمانيا هل بيتم حجز موعد السفارة من خلال داريكت ام من خلالي انا"],"contacts":[{"e":"engmohamedhamdi@fmail.com","p":"544888175","n":"محمد حمدي محمد علي"}],"dom":"fmail.com"},{"msgs":["[2025-09-17] enquiry: تأشيرة شنغن سياحه لاسبانيا"],"contacts":[{"e":"mohammedapdeltif@gomal.com","p":"545050325","n":"محمد عبد اللطيف حسين"}],"dom":"gomal.com"},{"msgs":["[2025-09-17] enquiry: I want to apply for China visa. I am attending a Conference in Suzhou, China from 04th November to 09. What do I need to provide as documents for the visitor visa for China?"],"contacts":[{"e":"l.ghouti@tuwaiq.edu.sa","p":"536591825","n":"Lahouari Ghouti"}],"dom":"tuwaiq.edu.sa"},{"msgs":["[2025-09-15] enquiry: 52034581"],"contacts":[{"e":"sameer@myideas-adv.com","p":"506218722","n":"سمير نور"}],"dom":"myideas-adv.com"},{"msgs":["[2025-09-11] enquiry: بصثبصبصبصبصبصبصب"],"contacts":[{"e":"nofiwih309@dpwev.com","p":"551019904","n":"ff"}],"dom":"dpwev.com"},{"msgs":["[2025-09-09] enquiry: ما عندي طلب بس عايز أقدم الا الشنغن"],"contacts":[{"e":"salahyousif770@gemil.com","p":"566123019","n":"صالح يوسف صالح محمد"}],"dom":"gemil.com"},{"msgs":["[2025-08-20] enquiry: I am writing to you today from Impel College of London, an educational institution located in London, holds UK ACCREDITION from ASIC (Accreditation services for international schools, colleges and Universities). We have been established since 2010  and are actively seeking to expand our internationa..."],"contacts":[{"e":"mufti@impelcollege.co.uk","p":"519666553","n":"SHOAIB MUFTI"}],"dom":"impelcollege.co.uk"},{"msgs":["[2025-08-17] suggestion: I hope this message finds you well.  At Simles, we specialize in delivering instant, affordable, and seamless eSIM connectivity across 175+ countries, empowering travelers to stay connected without the hassle of physical SIM cards, roaming charges, or long activations.  We believe that integrating S..."],"contacts":[{"e":"ismat.mjaled@simles.net","p":"554501796","n":"ismat mjaled"}],"dom":"simles.net"},{"msgs":["[2025-08-16] استفسار: ارسلت لكم من قبل للان لم يتم الرد ؟؟؟؟","[2025-08-06] استفسار: السلام عليكم قدمت من يس اطلس هولندا سياحه انا يمني وجبت جميع المستندات المطلوبة مني جاني رفظ السبب انو مو مقتنعين من رجوعي يس اطلس ماطلب مني اوراق ثانيه كنت بقدم لهم عادي أطفالي مواليد مكه اعمل مشرف فروع"],"contacts":[{"e":"j.hajji@bon.com.sa","p":"0597388611","n":"جلال حجي"}],"dom":"bon.com.sa"},{"msgs":["[2025-08-13] enquiry: I applied for schengen visa, and already confirmed my appointment, once went in VFS in Riyadh, I found that I don\u0027t have any blank page for the visa, so I requested a new passport. my question now is, what will I do to have the second appointment? Do I need to pay again or direct can help me resched...","[2025-08-13] enquiry: Dear Direct,"],"contacts":[{"e":"malturk@hala.com","p":"556797708","n":"Mazhar Al Turk"}],"dom":"hala.com"},{"msgs":["[2025-08-07] استفسار: لدي وكاله  7Stars للسفر والسياحه ومقرنا الرياض  وحابين نتعاون معكم بموضوع الفيزا   واحتاج احد يتواصل معي بخصوص هذا الامر  0566488929  محمد السعد"],"contacts":[{"e":"admin@7starsss.com","p":"0566488929","n":"MOHAMMED SAAD"}],"dom":"7starsss.com"},{"msgs":["[2025-08-06] استفسار: بخصوص متطلبات فيزا لهانق كونق لموظف يمني لدينا يود السفر بشهر سبتمبر"],"contacts":[{"e":"admin@werecle.com","p":"0555586861","n":"Hamdan"}],"dom":"werecle.com"},{"msgs":["[2025-08-06] complaint: I paid last July for 500 sar for france visa appointment.  I haven\u0027t heard from you guys since. it\u0027s been more than a month.  Please let me know the status.","[2025-07-07] enquiry: Hello, I’ve already applied and ready to submit but Vfs don’t have open schedule. Can I make my appointment via direct KSA ? It’s my 5th visa from france all approved from Riyadh."],"contacts":[{"e":"chad.araneta@comeanddo.fr","p":"509586141","n":"chad araneta"}],"dom":"comeanddo.fr"},{"msgs":["[2025-08-03] enquiry: السلام عليكم انا أتواجد بالسعودية يمني ولي خبرة طويله في الزراعه والري"],"contacts":[{"e":"hatabco@nsn.com","p":"554163621","n":"عبدالقادر حطاب"}],"dom":"nsn.com"},{"msgs":["[2025-08-03] complaint: I am writing to follow up on my certificate validation request submitted via the https://qvp.pacc.sa website. I completed the payment on 28/07/2025, and my request ID is QVP-753124. As of today, the status of my request has not changed. Kindly find the payment invoice attached for your reference. I ..."],"contacts":[{"e":"mohamed.farouk@cis.asu.edu.eg","p":"","n":"Mohamed"}],"dom":"cis.asu.edu.eg"},{"msgs":["[2025-07-29] enquiry: asd"],"contacts":[{"e":"asd@asd.com","p":"555555555","n":"asd"}],"dom":"asd.com"},{"msgs":["[2025-07-28] استفسار: سداد رسوم","[2025-07-28] استفسار: سداد رسوم","[2025-07-28] enquiry: سداد رسوم"],"contacts":[{"e":"m.roshdy@awalmidmac.com","p":"544586232","n":"محمود رشدي فهمي"}],"dom":"awalmidmac.com"},{"msgs":["[2025-07-23] شكوى: ماحدث من خطاء من قبلكم لحجز الفندق  وبعد تسليمي جواز السفر للسفاره والتبصيم تفاجأنا باتصال من قبل موظف السفاره يفيد من حجز الفندق محجوز في ألبانيا وليس في إيطاليا.  من المسؤال عن هذا الخطاء يا ادارة داريركت","[2025-04-23] استفسار: أريد غرفة لشخص واحد في منتجع في العمارية بتاريخ من 29 ابريل الي 1 مايو"],"contacts":[{"e":"amg-1234@hotmai.com","p":"506164008","n":"Amal"},{"e":"aasscc_2008@hotmai.com","p":"0540543516","n":"عادل الجعيد"}],"dom":"hotmai.com"},{"msgs":["[2025-07-16] شكوى: السلام عليكم انا رفعت طلب لتأشيرة الشنغن فرنسا و كلمتوني قولتو مافي مواعيد ف السفارة اول ما تفتح المواعيد نتواصل معك و نحدد اليوم و الصباح الساعه 10 فتحت المواعيد و كلمتكم قولتو راح يتواصل معك قسم الحجوزات و الى الان لم يتواصل معي احد غير معقول و اذا خلصت المواعيد مشكلة صراحه"],"contacts":[{"e":"a.d.aljohani11@hotmqil.com","p":"0569731630","n":"Ahmed"}],"dom":"hotmqil.com"},{"msgs":["[2025-07-13] استفسار: استفسار بخصوص التأشيرات السياحيه"],"contacts":[{"e":"moneybog12345@gail.com","p":"0543576355","n":"مؤمن خلف"}],"dom":"gail.com"},{"msgs":["[2025-07-12] enquiry: أنا يمنيهبغيت استفسر عن سفاره الصينيه"],"contacts":[{"e":"hnynalrfaee45@gnail.com","p":"0546273141","n":"حنين"}],"dom":"gnail.com"},{"msgs":["[2025-07-10] enquiry: Want to ask about how to apply for VISA to Thailand (tourism VISA) for 30 days, I am professor Hamid from Taif University. VISA for me my son and my wife"],"contacts":[{"e":"ha.osman@tu.edu.sa","p":"503503162","n":"Hamid Osman"}],"dom":"tu.edu.sa"},{"msgs":["[2025-07-08] enquiry: السلام عليكم ورحمة الله وبركاته   السادة / فريق دايركت، تحية طيبة،  نرغب بالتعرف على الخدمات التي تقدمونها للشركات في مجال حجوزات الطيران والفنادق. هل يمكنكم إرسال معلومات عامة عن:  - نطاق الخدمات المتاحة للشركات. - مميزات التعاقد مع برنامجكم. - آلية التواصل مع فريق خدمة العملاء المخصص للشركات. - شر..."],"contacts":[{"e":"aalkhadhairi@abeel.sa","p":"508156669","n":"اديب"}],"dom":"abeel.sa"},{"msgs":["[2025-07-04] enquiry: لدي فيزه شنغن ساريه المفعلول؛ وارغب في استخارج فيزه لزوجتي واطفالي؛ علما بان زوجتي غير موظفه وحسابها البنكي لا يوجد به مبالغ كبيرة."],"contacts":[{"e":"hkhered@rvc.com.sa","p":"557799349","n":"حسن"}],"dom":"rvc.com.sa"},{"msgs":["[2025-07-01] enquiry: Awards Invitation - The Global Economics Awards, 2025 - Dubai"],"contacts":[{"e":"lisha@theglobaleconomics.com","p":"","n":"Lisha"}],"dom":"theglobaleconomics.com"},{"msgs":["[2025-06-29] شكوى: البطئ في عمليه اكمال الاجراءات وعدم التواصل والتحديث حتى يتم التواصل من جهتي"],"contacts":[{"e":"shahraniabm@hadeed.com.sa","p":"0553832680","n":"As"}],"dom":"hadeed.com.sa"},{"msgs":["[2025-06-27] enquiry: رفعت تعريف بالراتب باللغة العربية وارغب اعيد رفعه باللغة الانجليزية مع العلم اني استخدمت مرفقات اخري في رفع ملف كشف البنك باللغة الانجليزية"],"contacts":[{"e":"md@ramapr.net","p":"566007006","n":"محمد"}],"dom":"ramapr.net"},{"msgs":["[2025-06-19] enquiry: اود التقديم لمنحة لدراسة الطب البشري","[2025-06-19] enquiry: ارغب للتقديم لبنتي لدراسة الطب البشري علماً بان معدلها 95.5 % ارجو تقديم خيارات"],"contacts":[{"e":"badr.abdella@lazurde.com","p":"557020159","n":"بدرالدين محمد عبدالله"}],"dom":"lazurde.com"},{"msgs":["[2025-06-17] enquiry: Let me know if you give service to Chinese visa, duration and cost of it"],"contacts":[{"e":"dop@hitechksa.com","p":"593113288","n":"Jiju varghese"}],"dom":"hitechksa.com"},{"msgs":["[2025-06-17] enquiry: السادة/ شركة دايركت للسفر والسياحة المحترمين السلام عليكم ورحمة الله وبركاته،  نتشرف في شركة أريس لحلول المتكاملة المحدودة للسفر والسياحة وتنظيم الرحلات بالتواصل معكم، ونتطلع إلى فتح آفاق تعاون مشترك بين شركتينا في مجال السفر والسياحة، بما يخدم مصلحة الطرفين ويعزز جودة الخدمات المقدمة للعملاء.  يسرّ..."],"contacts":[{"e":"info@areesltd.com","p":"599777719","n":"Mutaz Gindeel"}],"dom":"areesltd.com"},{"msgs":["[2025-06-17] enquiry: الرجاء الطلب منكم ارسال الفاتورة باللغة الانجليزية"],"contacts":[{"e":"aalklabi@eagle.org","p":"533881002","n":"عبدالعزيز احمد الكلابي"}],"dom":"eagle.org"},{"msgs":["[2025-06-16] enquiry: هل تم إصدارها 51890331 رقم التأشيرة"],"contacts":[{"e":"mahmoud@abuzohair.com","p":"544388999","n":"محمود"}],"dom":"abuzohair.com"},{"msgs":["[2025-06-16] استفسار: حاب أدفع أونلاين بس تم ضغط دفع كاش عن طريق الخطأ."],"contacts":[{"e":"ali@tigercapital.ai","p":"0580290777","n":"Ali Aliaalghannam@gmail.com"}],"dom":"tigercapital.ai"},{"msgs":["[2025-06-15] شكوى: لم يتم استرداد المبلغ بالغم من تقديمي للشكوى عدة مرات ياليت ينزل المبلغ بأقرب وقت في حسابي"],"contacts":[{"e":"hindfahad10@gamail.com","p":"0541291255","n":"هند فهد المزيني"}],"dom":"gamail.com"},{"msgs":["[2025-06-14] enquiry: كم هي تكلفه تأشيرة السياحه الي تركيا وما هيا مدة صلاحية التاشيرة وما هي الفترة المسموح لي بالاقامة فيها داخل تركيا بناء علي تاشيرة السياحة"],"contacts":[{"e":"ahmed@digitalwaves.sa","p":"547595003","n":"Ahmed"}],"dom":"digitalwaves.sa"},{"msgs":["[2025-06-13] استفسار: تاشيرة سياحة"],"contacts":[{"e":"abc@com.com","p":"0567235115","n":"Ahmad"}],"dom":"com.com"},{"msgs":["[2025-06-10] استفسار: هل تم حجز الموعد للتأشيرة رقم 51868658"],"contacts":[{"e":"saadahrm@alj.com","p":"0503676491","n":"رشدي متولي محمد سعده"}],"dom":"alj.com"},{"msgs":["[2025-06-09] enquiry: السلام عليكم ورحمة الله وبركاته"],"contacts":[{"e":"anfalaldou7@gma.com","p":"509629266","n":"Anfal"}],"dom":"gma.com"},{"msgs":["[2025-06-08] enquiry: ممكن احد يكلمني بخصوص استخراج تأشيرة للصين","[2025-06-08] enquiry: السلام عليكم  مساء الخير  انا ماشي للصين - شنجهاي في تاريخ 29 JUNE.","[2025-02-09] complaint: لم يتم تحديد موعد للسفارة علما باني دفعت منذ اكثر من اكثر من اسبوعين","[2025-02-09] complaint: لم يتم تحديد موعد لدى السفارة كمذ اسبوعين"],"contacts":[{"e":"amer@jubailsources.com","p":"504850955","n":"Amer"}],"dom":"jubailsources.com"},{"msgs":["[2025-06-07] استفسار: تاشيرة بولندا"],"contacts":[{"e":"aahmm999@jotmail.com","p":"559993382","n":"احمد"}],"dom":"jotmail.com"},{"msgs":["[2025-06-05] شكوى: تقدمت بطلب اصدار تاشيرة للعامله لزيارة الامارات لكن للأسف لم تتم خدمتي بالشكل المطلوب من قبل الموظف مصطفى بل ايضا لم يتم تقديم الطلب بسبب الادعاء بوجود مشكلة في الدفع ورغم طلبي التحدث مع احد المدراء لكن لم يستجب الموظف لطلبي وقمت بإتمام تقديم الطلب كاملا و اجراء الدفع وارغب في الغاء طلب الخدمة معكم ..."],"contacts":[{"e":"mskh99@hotnsil.com","p":"0504681582","n":"محمد خليفة"}],"dom":"hotnsil.com"},{"msgs":["[2025-06-05] استفسار: انا في العجله رباحت 200 ريال نقدي كيف طريقه السحب او كيف الاستفاده من المبلغ هذاRLTAqM2UKcavjRLT"],"contacts":[{"e":"101126@theeb.sa","p":"0533522668","n":"منذر محمد علي الناصر"}],"dom":"theeb.sa"},{"msgs":["[2025-05-30] enquiry: المنح الدراسية في جامعة اكسفورد ماجستير ا"],"contacts":[{"e":"mohammed.k.abdulaziz@jci.com","p":"504667494","n":"عبدالرحمن"}],"dom":"jci.com"},{"msgs":["[2025-05-30] استفسار: حجز تذكرة طيران تفاصيل"],"contacts":[{"e":"uiuooodd@iclod.com","p":"0560344734","n":"حسين سليم العميري"}],"dom":"iclod.com"},{"msgs":["[2025-05-27] استفسار: اتممت عمليه طلب التأشيرة لروسيا وتم الدفع كامل المبلغ ليه ولزوجتي باسم خالد حمد وميمونه الجامعي ونسيت ماارفق الصور الشخصيه"],"contacts":[{"e":"khamad@saudia.com","p":"0599595085","n":"خالد حمد"}],"dom":"saudia.com"},{"msgs":["[2025-05-27] استفسار: أنا دفعت تأشيرة أندنوسيا ولا اعلم هل شغاله اوكيف الطريقة"],"contacts":[{"e":"king77930@iclaud.cm","p":"0555377630","n":"عبدالرحمن"}],"dom":"iclaud.cm"},{"msgs":["[2025-05-26] استفسار: اقامة حجز طيران"],"contacts":[{"e":"amr.rahman@paintco.net","p":"0543687453","n":"Amr"}],"dom":"paintco.net"},{"msgs":["[2025-05-25] enquiry: تأشيرة ل أذربيجان"],"contacts":[{"e":"mina.azer@hyatt.com","p":"554288244","n":"Mina Azer"}],"dom":"hyatt.com"},{"msgs":["[2025-05-25] complaint: Hello Team Direct,  We contacted your Riyadh office to apply for Japan visa for our General Manager Dr. Ashraf Daoud via your agency and paid the fee of SR 349  Applicant Name – Ashraf Daoud  Mobile Number - 0563130031  Later we were informed by your agents that service is exclusive for Saudi nation..."],"contacts":[{"e":"muhammad.amin@abbvie.com","p":"563130031","n":"Ashraf Daoud"}],"dom":"abbvie.com"},{"msgs":["[2025-05-23] enquiry: طلب الحصول على فيزا شينقن"],"contacts":[{"e":"balaydi@psu.edu.sa","p":"555377789","n":"bader"}],"dom":"psu.edu.sa"},{"msgs":["[2025-05-17] استفسار: ارجو التواصل لتحديد موعد السفاره الايطاليه اصدار التاشيره"],"contacts":[{"e":"er.manager@zamilco.com","p":"540669492","n":"علي محي الدين علي"}],"dom":"zamilco.com"},{"msgs":["[2025-05-15] شكوى: كان عندكم موعد لـ ابنتي وِد ولم تذهبوا لتسليم الاوراق لسفاره .. قلتوا سقط سهواً !!!! غلط فادح ولا يغتفر وقلتوا سوف يتم التواصل معكم والان يوممين ولم تقوموا بالتواصل معنا!!!!!!!"],"contacts":[{"e":"atherralmani@gmai.con","p":"566356925","n":"اثير المانع"}],"dom":"gmai.con"},{"msgs":["[2025-05-13] استفسار: تم التقديم على تاشيره سفر إلى الولايات المتحده الأمريكية وسداد الرسوم  ولم يتم الاتصال بنا حتى الان ونريد معرفه مزيدا من التفاصيل"],"contacts":[{"e":"m.saad@ohod.com.sa","p":"0548818414","n":"مصطفى سعد"}],"dom":"ohod.com.sa"},{"msgs":["[2025-05-12] شكوى: تم تقديم طلب تأشيرة لليابان عدد 2 واحدة في تاريخ 27/4 والأخرى في 22/4 وتم إصدار التأشيرة في 7/5 علما بانها لم تصلني على الإيميل او اي إشعار بصدورها مع أني في متابعه دائمه مع خدمة العملاء بالواتساب وكان ردهم لي في كل مره مازالت في الإجراء الآن وقد صدرت في التاريخ المذكور وعدم إرسالها لي اتلغت رحلتي إ..."],"contacts":[{"e":"a.harbi@abam.sa","p":"0558556001","n":"عبدالمحسن محمد الحربي"}],"dom":"abam.sa"},{"msgs":["[2025-05-11] enquiry: I would like to know about applying for a UK visa for a housemaid of my employer. Please give me your Jeddah office, mobile and WhatsApp numbers. Thank you."],"contacts":[{"e":"qamar@elkhereiji.com","p":"506631558","n":"Qamar ul Hassan"}],"dom":"elkhereiji.com"},{"msgs":["[2025-05-06] enquiry: BOSNIA VISA FOR HOUSE MAID FROM  UGANDA , GOING WITH SPONSOR TO BOSNIA FROM KSA"],"contacts":[{"e":"m.khan@ajdan.com","p":"547864577","n":"MOHAMMED"}],"dom":"ajdan.com"},{"msgs":["[2025-05-05] enquiry: I would like to inquire about the renewal of US Passport of Abdullah Faisal through your services."],"contacts":[{"e":"noel.kim@alshaya.com","p":"543867024","n":"Noel Kim P. Tangcalagan"}],"dom":"alshaya.com"},{"msgs":["[2025-05-03] enquiry: احتاج عنوان موقع المكتب فى جدة"],"contacts":[{"e":"aalqurashi@kau.edu.sa","p":"556692228","n":"Rateen Alqurasi"}],"dom":"kau.edu.sa"},{"msgs":["[2025-04-29] شكوى: Good morning Yesterday I recorded a refuse from empassy But I don\u0027t know why any advise to do ?"],"contacts":[{"e":"hanyelhamy@icloyd.com","p":"0543098081","n":"Hanyvelhamy"}],"dom":"icloyd.com"},{"msgs":["[2025-04-28] استفسار: أنا صاحب مؤسسه هل صوره السجل تكفي عن تعريف بالراتب"],"contacts":[{"e":"alshaer@salshaer.com","p":"0505852748","n":"سعيد الشاعر"}],"dom":"salshaer.com"},{"msgs":["[2025-04-26] enquiry: طلب عرض سعر خاص"],"contacts":[{"e":"gm@skhaa.sa","p":"547662244","n":"حسين"}],"dom":"skhaa.sa"},{"msgs":["[2025-04-26] enquiry: ابغى اسوي الغاء للطلب حق الرخصة الدولية"],"contacts":[{"e":"ridew49356@reahla.com","p":"537335682","n":"احمد مساعد سعد الصبحي"}],"dom":"reahla.com"},{"msgs":["[2025-04-23] استفسار: تغير موعد التاشيرة  من 1/ مايو الى 10 مايو"],"contacts":[{"e":"layla.1441ah@gmeil.com","p":"0531966000","n":"ليلى"}],"dom":"gmeil.com"},{"msgs":["[2025-04-22] استفسار: سفر عمره من الرياض إلى جده خمس ايام لشخصين مع فندق بالحرم برج الساعه مطل  عالكنبه مع وجبات فطور"],"contacts":[{"e":"abeeralbasiry19@hotaiml.com","p":"0530062818","n":"عبير عثمان البصري"}],"dom":"hotaiml.com"},{"msgs":["[2025-04-21] استفسار: متابعة حالة طلب التاشيرة. لم يتم التواصل معي لتحديد موعد"],"contacts":[{"e":"maaaldera@pnu.edu.sa","p":"0505496763","n":"مها الدرع"}],"dom":"pnu.edu.sa"},{"msgs":["[2025-04-19] استفسار: هل تاشيره تشمل المقمين"],"contacts":[{"e":"azzhar073@gomail.com","p":"534450809","n":"ازهار"}],"dom":"gomail.com"},{"msgs":["[2025-04-13] enquiry: رقم الطلب51771564"],"contacts":[{"e":"i.aldimiati@pcbs.com.sa","p":"0545417337","n":"ابراهيم حسن - شركه منظومة المباني"}],"dom":"pcbs.com.sa"},{"msgs":["[2025-04-10] enquiry: i need your services to get a Schengen visa via French embassy if possible"],"contacts":[{"e":"info@staff-gate.com","p":"0570220322","n":"Rabih Hanna Assaad"}],"dom":"staff-gate.com"},{"msgs":["[2025-04-09] enquiry: اود استفسر لطلب تاشيرة شنقن لاسبانيا وتكون سهله لغيرها من دول مثل اليابان وسنقافورا استنادا بعد وجود فيزا شينقن من خلالكم يتم تسهيل تاشيرة الدول الاخرى مثل سانقفورا واليابان الكترونيا"],"contacts":[{"e":"l.mana@dair.es","p":"598987109","n":"ليان"}],"dom":"dair.es"},{"msgs":["[2025-04-04] enquiry: testing something"],"contacts":[{"e":"testing@testing.com","p":"533333333","n":"test test"}],"dom":"testing.com"},{"msgs":["[2025-03-24] enquiry: عزيزي محمد، شكراً للتواصل معنا على شبكة ST ورمضان مبارك.  نحن مدرسة لغات مقرها في غلاسكو، اسكتلندا، ومعتمدة من المجلس البريطاني ونحظى باحترام كبير، حيث نقدم جودة وقيمة ممتازة لطلابنا الدوليين. إذا كنت ترغب في العمل معنا، يرجى مراسلتي عبر البريد الإلكتروني."],"contacts":[{"e":"adell@live-language.com","p":"511111111","n":"Adell"}],"dom":"live-language.com"},{"msgs":["[2025-03-23] enquiry: نرغب في شركة المجموعة العربية للتنمية والاستثمار ، اقامة شراكة معكم من خلال حصولنا على حق امتياز - فرانشايز - للشعار والهوية في شهاداتنا ومقرراتنا او التعاون معكم في تطوير مقرراتنا والاستعانة بالكفاءات البشرية ،، نامل الرد منكم لاستكمال باقي التفاصيل  تقبلوا وافر التحية والتقدير","[2025-03-23] enquiry: ممثلا عن شركة المجموعة العربية للتنمية والاستثمار","[2025-03-23] enquiry: السلام عليكم ورحمة الله وبركاته"],"contacts":[{"e":"education@mak4.com","p":"554640266","n":"د. هاني حامد عز الدين"}],"dom":"mak4.com"},{"msgs":["[2025-03-05] enquiry: تأشيرة اليابان"],"contacts":[{"e":"i@hsb-holding.com","p":"540575858","n":"السيد صقر"}],"dom":"hsb-holding.com"},{"msgs":["[2025-03-04] enquiry: ما هي متتطلبات تاشيرة صربيا"],"contacts":[{"e":"ashraf@dawodbooking.com","p":"502194929","n":"اشرف محمد"}],"dom":"dawodbooking.com"},{"msgs":["[2025-03-03] enquiry: I am in urgent need of Cyprus visa, can someone call me urgently"],"contacts":[{"e":"msiddiqui@savvygames.com","p":"558999171","n":"Muhammad Rizwan"}],"dom":"savvygames.com"},{"msgs":["[2025-02-27] enquiry: Hi, I work in an International company and I need to get Denmark Visa to attend a training."],"contacts":[{"e":"moustafa.ali@iff.com","p":"501277702","n":"Moustafa Ali"}],"dom":"iff.com"},{"msgs":["[2025-02-26] enquiry: Dear All, I am looking for a Saudi based visa specialist to help us with business visas. Can UK nationals get a business visa while they are already in Saudi? Thank you.","[2025-02-26] enquiry: Dear All,"],"contacts":[{"e":"iaverlingyte@brogangroup.com","p":"","n":"Inesa Averlingyte"}],"dom":"brogangroup.com"},{"msgs":["[2025-02-26] enquiry: Hello, I am reaching out to connect with your team to discuss collaboration opportunity with Hisense Saudi Arabia"],"contacts":[{"e":"ghada.adel@hisense.com","p":"552794030","n":"Ghada Adel"}],"dom":"hisense.com"},{"msgs":["[2025-02-25] enquiry: I need to pay the verification for my MSc to the university of Leicester. QVP directed me to this website, but it is not clear how I pay.","[2025-02-25] enquiry: I want to pay for my university cert verification by paying Leicester University\u0027s charge. I was given this link to pay, but still can\u0027t. Can you help"],"contacts":[{"e":"wharrison@lciksa.com","p":"570327426","n":"William Nicholas Harrison"}],"dom":"lciksa.com"},{"msgs":["[2025-02-24] enquiry: Hi"],"contacts":[{"e":"abdu.yassin@landmarkgroup.com","p":"507492967","n":"Abdu Yassin"}],"dom":"landmarkgroup.com"},{"msgs":["[2025-02-10] enquiry: I would like to inquire about schenghen visa application services for non-Saudi\u0027s resident in KSA."],"contacts":[{"e":"nomtai.tukura@neom.com","p":"0536712742","n":"Nomtai Kauna  Tukura"}],"dom":"neom.com"},{"msgs":["[2025-02-04] enquiry: Good morning,  Headmaster’s request for a meeting: Jeddah (Wednesday 12th and Thursday 13th February 2025) and Riyadh (Friday 14th February and Saturday 15th February 2025)  I have sent an email last week and just now - it would be great if you could reply.","[2025-02-04] enquiry: Good afternoon,"],"contacts":[{"e":"nlp@tettcoll.co.uk","p":"","n":"Nikki Phelps"}],"dom":"tettcoll.co.uk"},{"msgs":["[2025-01-26] enquiry: مرحبا نحن شركة هاي تاتش لخدمات البوثات نتطلع بالعمل معكم في سوق السفر السعودي الرجاء من المسؤول عن إدارة مشاركتكم في المعرض التواصل معي على الرقم (0539922867)   شاكرة لكم ..","[2025-01-26] enquiry: مرحبا"],"contacts":[{"e":"hala@hightouch.sa","p":"539922867","n":"هلا المقرن"}],"dom":"hightouch.sa"},{"msgs":["[2025-01-22] enquiry: Inquiry on the UK tourist visa","[2025-01-14] enquiry: I would like to inquire about the visa process for the United Kingdom. What document do you provide for my application? Is it require Hotel booking and Flight tickets?"],"contacts":[{"e":"sanjay.lolage@kaust.edu.sa","p":"0545492976","n":"Sanjay Lolage"}],"dom":"kaust.edu.sa"},{"msgs":["[2025-01-20] suggestion: السادة في دايركت،   تحية طيبة وبعد،   نحن في \"إيفينترز\" نختص بتقديم خدمات تصميم وتنفيذ أجنحة المعارض على أعلى مستوى، بما في ذلك المعارض المحلية والدولية.  بفضل خبرتنا الواسعة في أسواق المملكة والخليج العربي بالإضافة للأسواق الأروبية,  نحن قادرون على تقديم حلول مبتكرة تتناسب مع احتياجاتكم وميزانيتكم...."],"contacts":[{"e":"n.alattar@eventers-sa.com","p":"599096660","n":"نور العطار"}],"dom":"eventers-sa.com"},{"msgs":["[2025-01-18] enquiry: بخصوص معرض سوق السفر السعودي"],"contacts":[{"e":"businessdev@qawafi.sa","p":"511560639","n":"عبدالرحمن"}],"dom":"qawafi.sa"},{"msgs":["[2025-01-16] enquiry: We are an event management company in Riyadh , we are interested in doing your booth for the Saudi Travel Market STM in February , 2025. Kindly connect us with your team."],"contacts":[{"e":"info@modernstructuresa.com","p":"540809309","n":"Aml Ali"}],"dom":"modernstructuresa.com"},{"msgs":["[2025-01-13] suggestion: لايمكنني الدخول لااكما ل الاجراءات"],"contacts":[{"e":"shaheenay@kemya.sabic.com","p":"535533978","n":"عبدالله يوسف الشاهين"}],"dom":"kemya.sabic.com"},{"msgs":["[2025-01-09] enquiry: نحن شركاء الحدث لتنظيم المعارض وتنفيذ ديكورات المعارض  اتواصل معكم بخصوص مشاركتكم في سوق السفر السعودي   الرجاء التواصل معي في اقرب وقت ممكن  تحياتي،،","[2025-01-09] enquiry: نحن شركاء الحدث لتنظيم المعارض وتنفيذ ديكورات المعارض","[2025-01-09] enquiry: نحن شركاء الحدث لتنظيم المعارض وتنفيذ ديكورات المعارض"],"contacts":[{"e":"atheer@ep-ksa.com","p":"592818038","n":"أثير"}],"dom":"ep-ksa.com"},{"msgs":["[2024-12-30] enquiry: أصدار تأشيرات لمقيم فالسعودية للدخول إلى"],"contacts":[{"e":"hr@mcdc.com.sa","p":"505551235","n":"مشهور المقاطي"}],"dom":"mcdc.com.sa"},{"msgs":["[2024-12-29] suggestion: معك رسمية من شركة الأفكار العصرية-Modren Ideas نحن شركة متخصصة في بناء وتصميم وتنفيذ أجنحة المعارض و الفعاليات نطمح إلى التعاون وعقد شراكة دائمة معكم اتواصل معكم بخصوص البوث الخاص بكم في سوق السفر السعودي 10 - 12 فبراير 2025  ارغب بالتواصل مع القسم المختص لهذه الفعالية لتقديم خدماتنا لكم  شاكرة حسن ..."],"contacts":[{"e":"marketing@modern-ideas.com","p":"0504415086","n":"Rasmiah"}],"dom":"modern-ideas.com"},{"msgs":["[2024-12-19] enquiry: I need to apply for China visit visa less than 3 months and my nationality is Pakistani. Kindly let me know what documents are needed?"],"contacts":[{"e":"namin@denodo.com","p":"531469522","n":"Nabeel Amin"}],"dom":"denodo.com"},{"msgs":["[2024-12-17] complaint: افيدكم انه راح الموعد القديم وارغب في اصدار موعد جديد في اقرب وقت ولكم تحياتي"],"contacts":[{"e":"n.algehani@fitnesslines-sa.com","p":"561010070","n":"سارة الخريجي"}],"dom":"fitnesslines-sa.com"},{"msgs":["[2024-11-25] enquiry: يرغب برنامج كفالة بالتعاقد معكم لتقديم خدمات السفر والسياحة لمنسوبي البرنامج.","[2024-11-20] enquiry: السادة الكرام تحية طيبة،،  اتواصل معكم للاستفسار عن إمكانية التعاون معكم لإدارة ترتيبات السفر لمنسوبي برنامج كفالة، نظراً لإنتداب منسوبينا خارج المملكة بشكل دوري لحضور (دورات تدريبية – مؤتمرات – رحلات عمل...) بشكل متكرر نبحث عن شريك موثوق للعام القادم 2025م لتقديم أفضل الحلول الملائمة لإحتياجاتنا."],"contacts":[{"e":"d.ghamdi@kafalah.gov.sa","p":"543655081","n":"دلال الغامدي"}],"dom":"kafalah.gov.sa"},{"msgs":["[2024-11-24] enquiry: أريد تقديم على تاشيرة للهند لمدة اسبوع زيارة. هل ممكن المساعدة في تقديمها؟؟؟"],"contacts":[{"e":"tarik@cmc-ksa.com","p":"505238874","n":"طارق"}],"dom":"cmc-ksa.com"},{"msgs":["[2024-11-21] enquiry: We at Sulalaa Transport are interested in exploring a B2B collaboration with your company. We offer high-quality transport services, including airport transfers, ziyarat tours, and custom group transportation. Our fleet is designed for comfort and reliability, ensuring seamless travel for families a..."],"contacts":[{"e":"ameer@sulalaa.com","p":"508588148","n":"Ameer"}],"dom":"sulalaa.com"},{"msgs":["[2024-11-21] enquiry: Hi,  I hope this message finds you well. My name is Farzan H, and I am the Business Development Manager at John Academy. We bring eight years of experience in the Ed-tech sector, offering over 2,500 CPDQS-accredited online courses.  Would you like to expand your offerings by reselling our CPD-accred...","[2024-11-16] enquiry: Hi,   I hope this message finds you well. My name is Farzan H, and I am the Business Development Manager at John Academy. We bring eight years of experience in the Ed-tech sector, offering over 2,500 CPDQS-accredited online courses.   Would you be interested in reselling our e-learning courses under...","[2024-11-12] suggestion: Hi,   I hope this message finds you well. My name is Farzan H, and I am the Business Development Manager at John Academy. We have eight years of experience, offering over 2,500 CPD-accredited online courses across a broad range of subjects.   We are currently looking to collaborate with organization..."],"contacts":[{"e":"business@johnacademy.co.uk","p":"","n":"Farzan H"}],"dom":"johnacademy.co.uk"},{"msgs":["[2024-11-14] enquiry: I would like to inquire about your charges/fees for arranging Schengen Visa application for Saudi Nationals. They have been to Europe last year. Thank you"],"contacts":[{"e":"mary.torres@falghanim.com","p":"","n":"Mary Torres"}],"dom":"falghanim.com"},{"msgs":["[2024-11-10] suggestion: Dear Direct Team,"],"contacts":[{"e":"hkarsoun@telgani.com","p":"0537770261","n":"Hany Magdy"}],"dom":"telgani.com"},{"msgs":["[2024-11-04] enquiry: اريد معرفة ما هى تكاليف فيزا سياحة الى مصر لشخص جنسيتة هندي مقيم فى الامارات وماهى الاوراق المطلوبة وماهى المدة لاستخراج الفيزا المصرية سياحة"],"contacts":[{"e":"tamer@finitic.com","p":"","n":"tamer emam"}],"dom":"finitic.com"},{"msgs":["[2024-11-04] enquiry: Hello! I am Song Jia. We cordially invite you to participate in the QSE China Investment Immigration Study Abroad and Real Estate Expo, which will be held from March 7-9, 2025, for a period of three days. The exhibition will be a professional overseas immigration study abroad and real estate exhibit..."],"contacts":[{"e":"expo@qs-expo.com","p":"0511512217","n":"songjia"}],"dom":"qs-expo.com"},{"msgs":["[2024-10-31] enquiry: Dear @comercial@jdimmigration.com.br,,  We are delighted to present our distinguished organization, Tasc-outsourcing. At this time, we are actively seeking reputable agencies in Bosnia that have the requisite qualifications to assist us in securing a visa stamp. This will facilitate a constructive d..."],"contacts":[{"e":"cathleen@tascoutsourcing.com","p":"546082940","n":"Cathleen"}],"dom":"tascoutsourcing.com"},{"msgs":["[2024-10-29] enquiry: السلام عليكم..أرغب الاستفسار عن تأشيرة أمريكا من حيث المتطلبات والتكلفة والوقت المتوقع للحصول على موعد المقابلة والحصول على التأشيرة"],"contacts":[{"e":"mahmoud.gamal@acmainfo.org","p":"504113967","n":"Dr Mahmoud Gamal"}],"dom":"acmainfo.org"},{"msgs":["[2024-10-25] enquiry: Hi,  I\u0027m Kanika, reaching out from CISS International to explore a partnership opportunity with you for our prestigious summer camp programs at top universities like Oxford, Columbia and Harvard for students aged 13-18.   We offer three-week all-inclusive residential academic programs designed to pr...","[2024-10-24] enquiry: Hi,  I\u0027m Kanika, reaching out from CISS International to explore a partnership opportunity with you for our prestigious summer camp programs at top universities like Oxford, Columbia and Harvard for students aged 13-18.   We offer three-week all-inclusive residential academic programs designed to pr..."],"contacts":[{"e":"partnerships@cissinternational.com","p":"500000000","n":"kanika"}],"dom":"cissinternational.com"},{"msgs":["[2024-10-17] enquiry: i need to know can help DS 160 application fee in oman"],"contacts":[{"e":"pro@mizanidesign.com","p":"","n":"Zaino"}],"dom":"mizanidesign.com"},{"msgs":["[2024-10-15] enquiry: \u003ca class=\"q-btn q-btn-item non-selectable no-outline q-btn--outline q-btn--rectangle q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase directions-btn full-width mt-3 rounded-borders\" tabindex=\"0\" href=\"https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7251.550865647809!2d46.621225!3d2..."],"contacts":[{"e":"asdsadsa@aasasa.com","p":"532165478","n":"asdasd"}],"dom":"aasasa.com"}];
 var JUNK={"gamil.com":1,"gmial.com":1,"gmal.com":1,"gmaill.com":1,"hotmial.com":1,"hotmil.com":1,"yahooo.com":1,"iclod.com":1,"icloud.con":1,"gmail.con":1,"gmail.co":1,"hotmail.co":1,"outlok.com":1,"exemple.com":1,"example.com":1,"test.com":1,"email.com":1,"mail.com":1,"none.com":1,"no.com":1,"na.com":1,"iclond.com":1,"icloid.com":1,"icoud.com":1,"iclould.com":1,"icloud.com.sa":1,"hotmai.com":1,"hotmaill.com":1,"gnail.com":1,"gmsil.com":1,"gemail.com":1,"gmali.com":1,"gimail.com":1,"outloock.com":1,"otlook.com":1,"yaho.com":1,"yhoo.com":1};var JUNKIDS={};Object.keys(JUNK).forEach(function(k){JUNKIDS["b_cf_"+k.replace(/[^a-z0-9]/g,"")]=1;});DB.businesses=DB.businesses.filter(function(b){return !JUNKIDS[String(b.id)];});var BRAND={neom:'NEOM',sabic:'SABIC',stc:'STC',aramco:'Aramco',elm:'Elm',sama:'SAMA',mdd:'MDD',alshaya:'Alshaya',honeywell:'Honeywell',hisense:'Hisense',abbvie:'AbbVie',iff:'IFF',alfanar:'Alfanar',zamil:'Zamil Group',theeb:'Theeb Rent a Car',kafalah:'Kafalah',alj:'Abdul Latif Jameel',hyatt:'Hyatt',savvygames:'Savvy Games',gevernova:'GE Vernova',stcbank:'STC Bank',walaa:'Walaa Insurance',landmarkgroup:'Landmark Group',acgc:'ACGC',dfn:'DirectFN',kemya:'Kemya (SABIC)',samacares:'SAMA'};
 var pretty=function(dom){var root=String(dom).split('.')[0];if(BRAND[root])return BRAND[root];var parts=root.split(/[-_\d]+/).filter(Boolean);if(!parts.length)parts=[root];return parts.map(function(p){return p.length<=3?p.toUpperCase():p.charAt(0).toUpperCase()+p.slice(1);}).join(' ');};
 var domOf=function(b){var ds={};(b.contacts||[]).forEach(function(c){var m=String(c.email||'').toLowerCase().match(/@([^@\s]+)$/);if(m)ds[m[1]]=1;});return ds;};
 var norm=function(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');};
 var added=0,upgraded=0;
 DATA.forEach(function(it){ if(JUNK[it.dom])return;
   var nm=pretty(it.dom);
   var cid='b_cf_'+String(it.dom).replace(/[^a-z0-9]/g,'');
   var ex=DB.businesses.find(function(b){if(b.id===cid)return true;var ds=domOf(b);if(ds[it.dom])return true;return norm(b.name)===norm(nm);});
   var noteAll=(it.msgs&&it.msgs.length)?('Contact form comments:\n- '+it.msgs.join('\n- ')):'';
   if(ex){
     if(String(ex.id).indexOf('b_cf_')===0){ ex.name=nm; if(!ex.segment||ex.segment==='')ex.segment='Website lead - '+it.dom; }
     (it.contacts||[]).forEach(function(c){ if(c.e&&!(ex.contacts||[]).some(function(x){return String(x.email||'').toLowerCase()===String(c.e).toLowerCase();})){ex.contacts=ex.contacts||[];ex.contacts.push({name:c.n||'',email:c.e,phone:c.p||''});} else if(c.p){var m=(ex.contacts||[]).find(function(x){return String(x.email||'').toLowerCase()===String(c.e).toLowerCase();});if(m&&!m.phone)m.phone=c.p;} });
     if(noteAll&&String(ex.notes||'').indexOf('Contact form comments:')<0){
       var keep=String(ex.notes||'').split('\n').filter(function(l){return l.indexOf('Contact form:')!==0;}).join('\n');
       ex.notes=(keep?keep+'\n':'')+noteAll;
     }
     upgraded++;
   } else {
     DB.businesses.push({id:cid,name:nm,nameAr:'',segment:'Website lead - '+it.dom,category:'Convert',source:'Contact form',stage:'Prospect',status:'Prospect',assignedTo:'',channels:['Email'],isClient:false,isVendor:false,totalSAR:0,invoices:0,contacts:(it.contacts||[]).map(function(c){return {name:c.n||'',email:c.e||'',phone:c.p||''};}),notes:noteAll,activities:[]});
     added++;
   }
 });
 DB._cfMergeV3=true; save();
 console.info('%c[v29.3] contact merge v3: +'+added+' new, '+upgraded+' upgraded','color:#2E90FA;font-weight:700');
 }
}catch(e){console.warn('[v29.3] contact merge v3 fail',e);}})();

/* v29.2 old-customers merge: 336 fully-paid B2B invoices (2020-2026-06-11, non-simplified, seller=Direct) scraped from Direct Payments admin, aggregated to unique customers. Companies -> funnel "Old Customers"; persons -> "Individuals from B2B"; matches to existing CLIENTS keep/confirm stage Client. */
(function(){try{
 if(DB._oldCustMerged){}else{
 var DATA=[
{"n":"Abdel Hadi Abdullah AlQahtani Sons Co","e":"ashalhooub@aqsse.com","c":6,"t":167974,"alias":"alqahtani"},
{"n":"شركة عبدالهادي عبدالله القحطاني واولاده سينوبك شنغهاي انجنيرنج للمقاولات","e":"ashalhoub@aqsse.com","c":7,"t":76142,"alias":"alqahtani"},
{"n":"شركة التعدين العربية السعودية معادن","e":"AljabrA@maaden.com.sa","c":79,"t":483914,"alias":"maaden"},
{"n":"Altadin Alarabiyya Alsaudiyya Maaden Company","e":"alansarit@maaden.com.sa","c":13,"t":71178,"alias":"maaden"},
{"n":"شركة مدد الذكية لتقنية المعلومات","e":"A.alrashed@mdd.sa","c":27,"t":3566390,"alias":"mdd"},
{"n":"MDD","e":"A.alrashedd@mdd.sa","c":3,"t":1116861,"alias":"mdd"},
{"n":"National Electronic Systems Company","e":"na.huraysi@nes.com.sa","c":6,"t":278685},
{"n":"booking.com","e":"dataprotectionoffice@booking.com","c":8,"t":153786,"vendor":true},
{"n":"Bayswater","e":"bookings@bayswater.ac","c":13,"t":127960},
{"n":"Kaplan","e":"MENAB2B.Support@kaplan.com","c":4,"t":100798},
{"n":"Riyadh Chamber","e":"A.hayan@rdcci.org.sa","c":7,"t":127696,"alias":"riyadhchamber"},
{"n":"الغرفة التجارية الصناعية بالرياض","e":"A.hayan@rdcci.org.sa","c":4,"t":32796,"alias":"riyadhchamber"},
{"n":"Benchmark for Conferences","e":"mdhafarhg@gmail.com","c":6,"t":88827},
{"n":"شركة راوز للأستثمار","e":"info@rawiz.com.sa","c":3,"t":87508},
{"n":"AMADEUS SAUDI ARABIA LTD","e":"","c":2,"t":79026,"vendor":true},
{"n":"Directorate of Public Security","e":"info@moi.gov.sa","c":1,"t":78000},
{"n":"The Sunnah Experience","e":"info@thesunnahexperience.com","c":1,"t":70560},
{"n":"Maaal","e":"acc@maaal.com","c":3,"t":67600},
{"n":"شركه الكثبان الصفراء للزخرفه و الدعايه و الاعلان","e":"mourad.abdulmajid@gmail.com","c":4,"t":64104},
{"n":"حجز و تذكره","e":"","c":17,"t":75306},
{"n":"الهيئة العامة للموانئ","e":"JIP@mawani.gov.sa","c":2,"t":52801,"alias":"mawani"},
{"n":"شركة فيصل عبدالله الجربوع وشركاؤه","e":"aboelmagd@directksa.com","c":1,"t":46679},
{"n":"عبدالمحسن براك الحميد","e":"","c":1,"t":49208},
{"n":"يزيد الهويمل","e":"Yazeednsh@hotmail.com","c":1,"t":60000},
{"n":"ETC International College","e":"invoices@etc-inter.net","c":10,"t":30003},
{"n":"Special Forces for Security and Protection","e":"SSF_RL@moisp.gov.sa","c":1,"t":27600},
{"n":"هيئة الهلال الأحمر السعودي","e":"","c":1,"t":24955},
{"n":"مستشفي قوي الامن بمكة المكرمة","e":"waladwani@sfhm.med.sa","c":1,"t":24265},
{"n":"Islamic University of Madinah","e":"Pr@iu.edu.sa","c":3,"t":24340},
{"n":"Imam Mohammad Ibn Saud Islamic University (IMSIU)","e":"info@imamu.edu.sa","c":1,"t":23988},
{"n":"EC","e":"MaysTayyem@ecenglish.com","c":3,"t":22780},
{"n":"Booking and ticket agency","e":"a.alhumaid1993@gmail.com","c":2,"t":21969},
{"n":"شركة الوسائل الوقائية للسلامة","e":"wasal_salamh@yahoo.com","c":1,"t":20147},
{"n":"جمعية كيان للايتام","e":"","c":2,"t":23500},
{"n":"شركة الحلول الاولى لتنظيم المعارض والمؤتمرات","e":"","c":1,"t":16661},
{"n":"شركة تجمع الإدارة العربي لتنظيم المعارض والمؤتمرات","e":"Sales@amgevent.com","c":2,"t":15743},
{"n":"alrajhi alawla litanzim almaarid walmutamarat Company","e":"procurment@saaraj.sa","c":3,"t":83510},
{"n":"AHMAD HUWAIMEL","e":"ahmadalhoimel1@gmail.com","c":2,"t":11315},
{"n":"عبدالعزيز بن فهد","e":"","c":2,"t":8136},
{"n":"Malvern","e":"bookings@malvernplc.com","c":1,"t":6619},
{"n":"شركة سادن المتخصصة للإستشارات الجيولوجية","e":"main@saden.sa","c":1,"t":5695},
{"n":"Sultan Mohmmed Alameer","e":"alameer.s@rdcci.org.sa","c":3,"t":5325},
{"n":"شركة الدايل العالميه المحدوده للتجارة والصناعة والمقاولات","e":"ealdail2030@gmail.com","c":1,"t":5100},
{"n":"ELC Chester","e":"admin@elc-chester.co.uk","c":1,"t":4979},
{"n":"Rahmah Alahmari","e":"","c":1,"t":4945},
{"n":"CES","e":"london@ces-schools.com","c":2,"t":4109},
{"n":"شركة نسكا المحدودة","e":"turki@neska.com.sa","c":1,"t":3500},
{"n":"Sheffield Academy Malaysia","e":"yusuf@sheffield.edu.my","c":1,"t":3253},
{"n":"Trip.com","e":"Tianyu.huang@trip.com","c":2,"t":4405,"vendor":true},
{"n":"شركة رباعيات كود للاستشارات الهندسية","e":"alyami.1211@gmail.com","c":1,"t":2697},
{"n":"شركة بيرو فيريتاس الشرق الأوسط الإقليمي","e":"k_seif@outlook.com","c":1,"t":2023},
{"n":"شركه كود لتقديم الوجبات","e":"INFO@CODECO.COM.SA","c":1,"t":1998},
{"n":"شركه زمو التجاريه المحدوده","e":"mohamed.abdelaziz@ibsagulf.com","c":1,"t":1766},
{"n":"شركة التكامل الوطنية للزراعة","e":"s.z.subaie@gmail.com","c":1,"t":1708},
{"n":"شركة ميس السعودية لانظمة الري المحدودة","e":"mais@maisirrig.com.sa","c":1,"t":1649},
{"n":"شركة إرصاف لخدمات الأعمال شركة شخص واحد","e":"Ersafcompany@gmail.com","c":1,"t":1379},
{"n":"الجمعية الخيرية لتحفيظ القران الكريم ببريدة","e":"","c":1,"t":1318},
{"n":"شركة الجولة الفارهة للسفر و السياحة","e":"Ticket@tand.sa","c":1,"t":1145},
{"n":"شركة لام للصناعة","e":"SAIF@LAAMKSA.COM","c":2,"t":1123},
{"n":"New College Group","e":"admissions@newcollegegroup.com","c":1,"t":1059},
{"n":"The Language Institute Edinburgh","e":"info@tlieurope.com","c":1,"t":1017},
{"n":"شركة وكالة نظم الوان","e":"Smsm50030@gmail.com","c":2,"t":1004},
{"n":"المطاحن الأولى","e":"ab.haddadi@firstmills.com","c":1,"t":978},
{"n":"شركة باترفلاي للصناعة شخص واحد","e":"Mzayed@butterflyled.com","c":1,"t":949},
{"n":"Kings","e":"Tariq.Heshri@kingseducation.com","c":1,"t":770},
{"n":"مؤسسه حمد المتحده التجاريه","e":"Hamad@hamadunited.com","c":1,"t":749},
{"n":"مؤسسة مثلث النمو لتنظيم المعارض والمؤتمرات","e":"abdullah@growthtri.com","c":1,"t":669},
{"n":"شركة نقوة للحلويات","e":"Yasser.leroux@gmail.com","c":2,"t":610},
{"n":"Lamprell Saudi Arabia","e":"malmehthel@lamprell.com","c":2,"t":140},
{"n":"Waleed (NHARA)","e":"W.ALSULAIM@NHARA.SA","c":2,"t":1040},
{"n":"شركة اعمال المجد للصناعة","e":"info@backcare.com.sa","c":1,"t":374},
{"n":"مصنع الشرق للبولسترين المحدودة","e":"info@stayromax.com","c":1,"t":352},
{"n":"مؤسسة المنصورية الأولي للمقاولات","e":"purchasedept@almansouryah.com","c":1,"t":294},
{"n":"مؤسسة اصدار السياراة لتجارة الجملة والتجزئة","e":"Shakerrabiah@gmail.com","c":1,"t":300},
{"n":"شركة مستودغ الصفا للأدوية","e":"raed@alswayeh.com","c":1,"t":1065},
{"n":"شركة موج فون","e":"redasobh885@gmail.com","c":1,"t":339},
{"n":"شركة لويت لخدمات الاعاشة","e":"nffssdfgh@gmail.com","c":3,"t":180},
{"n":"شركة ارت للإستشارات الهندسية","e":"nffssdfgh@gmail.com","c":1,"t":40},
{"n":"شركة الخبراء المميزين للاستشارات الهندسية","e":"hossamadel555@yahoo.com","c":1,"t":400},
{"n":"شركة داو سبيشيالتيز المحدودة","e":"M.A.ALSHEHRI@GMAIL.COM","c":1,"t":90},
{"n":"شركة التعمير المتقن للمقاولات شركة شخص واحد","e":"","c":1,"t":239},
{"n":"Abdulhafeez Mohammed Abdulsadiq Idris","e":"","c":4,"t":4073,"ind":true},
{"n":"Al-Obaid Al-Hussain Al-Obaid Al-Hussain","e":"","c":4,"t":4073,"ind":true},
{"n":"ABDULLAH ALHAYAN","e":"","c":2,"t":3492,"ind":true},
{"n":"Abdullah bin Abdulrahman bin Asaad Al-Zahrani","e":"","c":2,"t":3492,"ind":true},
{"n":"ANAS AL TUWAIM","e":"","c":2,"t":3662,"ind":true},
{"n":"Ayman bin Yahya Hamad Al-Ahmed","e":"","c":2,"t":3581,"ind":true},
{"n":"Naif bin Hamidi bin Mazlouh Al-Subaie Al-Anazi","e":"","c":2,"t":3492,"ind":true},
{"n":"Omar Mohammed K Al-Malki","e":"","c":2,"t":3492,"ind":true},
{"n":"Thamer bin Abdullah Saad Al-Hayek","e":"","c":2,"t":2723,"ind":true},
{"n":"Mohamed Alamro","e":"","c":1,"t":1812,"ind":true},
{"n":"Mohammed Alghamdi","e":"","c":1,"t":1700,"ind":true},
{"n":"ABDULLAH ALFAIFI","e":"","c":1,"t":351,"ind":true},
{"n":"SAAD BIN MADUJ","e":"","c":1,"t":351,"ind":true},
{"n":"Abrar Ali A Alahmari","e":"","c":1,"t":528,"ind":true},
{"n":"BODOR SALEH","e":"","c":1,"t":750,"ind":true},
{"n":"مراد زلماط","e":"mourad@kdc.sa","c":1,"t":1199,"ind":true},
{"n":"عبد الله القفاري","e":"","c":1,"t":374,"ind":true},
{"n":"السيد عبد الفتاح","e":"","c":1,"t":449,"ind":true},
{"n":"عقيل الصمعاني","e":"","c":1,"t":99,"ind":true}
]
;
 var norm=function(s){return String(s||'').toLowerCase().replace(/\b(company|co|ltd|llc)\b/g,'').replace(/[^a-z0-9؀-ۿ]/g,'');};
 var added=0,updated=0,clientsConfirmed=0;
 DATA.forEach(function(it){
   var nn=norm(it.n);
   var ex=DB.businesses.find(function(b){
     var bn=norm(b.name),ba=norm(b.nameAr||'');
     if(bn&&nn&&(bn===nn||bn.indexOf(nn)>=0||nn.indexOf(bn)>=0))return true;
     if(ba&&nn&&(ba===nn||ba.indexOf(nn)>=0||nn.indexOf(ba)>=0))return true;
     if(it.alias){var al=norm(it.alias);if(bn.indexOf(al)>=0||ba.indexOf(al)>=0)return true;}
     if(it.e&&(b.contacts||[]).some(function(c){return String(c.email||'').toLowerCase()===String(it.e).toLowerCase();}))return true;
     return false;
   });
   var src=it.ind?'Individuals from B2B':'Old Customers';
   var note='Paid B2B invoices: '+it.c+' invoice(s), '+Math.round(it.t).toLocaleString()+' SAR fully paid (2020-2026).';
   if(ex){
     if(ex.isClient){ex.stage='Won';ex.status='Won';clientsConfirmed++;}
     else if(!ex.source||ex.source==='Invoice history'){ex.source=src;}
     if((ex.totalSAR||0)<it.t)ex.totalSAR=Math.round(it.t);
     if((ex.invoices||0)<it.c)ex.invoices=it.c;
     if(String(ex.notes||'').indexOf('Paid B2B invoices:')<0){ex.notes=((ex.notes||'')+'\n'+note).replace(/^\n/,'');}
     if(it.e&&!(ex.contacts||[]).some(function(c){return String(c.email||'').toLowerCase()===String(it.e).toLowerCase();})){ex.contacts=ex.contacts||[];if(ex.contacts.length<6)ex.contacts.push({name:'',email:it.e,phone:''});}
     updated++;
   } else {
     DB.businesses.push({id:'b_oc_'+nn.slice(0,28),name:it.n,nameAr:'',segment:it.ind?'Individual (B2B invoices)':'',category:it.vendor?'Vendor':'Re-engage',source:src,stage:'Prospect',status:'Prospect',assignedTo:'',channels:['Email'],isClient:false,isVendor:!!it.vendor,totalSAR:Math.round(it.t),invoices:it.c,contacts:it.e?[{name:'',email:it.e,phone:''}]:[],notes:note,activities:[]});
     added++;
   }
 });
 DB._oldCustMerged=true; save();
 console.info('%c[v29.2] old-customers merge: +'+added+' new, '+updated+' updated, '+clientsConfirmed+' clients confirmed','color:#A9781A;font-weight:700');
 }
}catch(e){console.warn('[v29.2] old-customers merge fail',e);}})();
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
 window.leadSortVal=function(b,k){switch(k){case "name":return String(b.name||"").toLowerCase();case "stage":return LEAD_STAGES.indexOf(leadStage(b));case "funnel":return String(b.source||"").toLowerCase();case "last":return b.lastContact||0;case "owner":return String(b.assignedTo||b.owner||"").toLowerCase();case "score":return leadScore(b);default:return b.totalSAR||0;}};
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
  openModal("Quick edit - "+esc(b.name),
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
  openModal("Quick edit - "+esc(x.name),
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
 window.me=function(){return (DB.settings&&DB.settings.currentUser)||(window.__userName||'');};
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
  if(leadFilter.attention)list=list.filter(function(b){return !(b.contacts||[]).length||!b.source;});
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
 window.drawTable=function(){
  var board=document.getElementById('board');if(!board)return;board.className='';
  var list=leadTableList();
  var vis={};list.forEach(function(b){vis[b.id]=1;});Array.from(leadSel).forEach(function(id){if(!vis[id])leadSel.delete(id);});
  var sel=leadSel.size;var team=(typeof teamList==='function')?teamList():[];
  var selStyle='border:1px solid var(--line-2);border-radius:9px;padding:7px 9px;font:inherit;font-size:12px;background:#fff;cursor:pointer';
  var ctrl='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'+
    '<button class="btn sm '+(leadFilter.hideClosed?'pri':'ghost')+'" onclick="leadFilter.hideClosed=!leadFilter.hideClosed;drawLeads()">'+(leadFilter.hideClosed?'✓ ':'')+'Hide closed</button>'+
    '<button class="btn sm '+(leadFilter.attention?'pri':'ghost')+'" onclick="leadFilter.attention=!leadFilter.attention;drawLeads()">⚠ Needs attention</button>'+
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
     '<td>'+(function(){var fn=(typeof LANG!=='undefined'&&LANG==='ar'&&b.funnelNameAr)?b.funnelNameAr:b.funnelName;return fn?'<span class="tag" style="background:#EEF0F5;color:#4B5563">'+esc(fn)+'</span>':(b.source?'<span class="tag" style="background:'+sc+'1a;color:'+sc+'">'+esc(b.source)+'</span>':'-');})()+'</td>'+
     '<td style="color:var(--muted);white-space:nowrap">'+(b.lastContact?fmtAgo(b.lastContact):'—')+'</td>'+
     '<td style="color:var(--muted);max-width:170px;white-space:normal">'+(function(){var t=b.nextAction||b.nextActionNote||'';var d=b.nextActionDate?String(b.nextActionDate).slice(0,10):'';if(!t&&!d)return '—';var od=d&&d<new Date().toISOString().slice(0,10);return esc(t||((typeof LANG!=='undefined'&&LANG==='ar')?'متابعة':'Follow up'))+(d?' <span style="white-space:nowrap;color:'+(od?'#D92D20':'var(--muted)')+'">· '+d+'</span>':'');})()+'</td>'+
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
 window.qeAddOwner=function(leadId){var n=prompt('New team member name:');if(n&&n.trim()){DB.settings=DB.settings||{};DB.settings.team=(typeof teamList==='function'?teamList():[]).slice();if(DB.settings.team.indexOf(n.trim())<0)DB.settings.team.push(n.trim());save();leadQuickEdit(leadId,{owner:n.trim()});}else{leadQuickEdit(leadId);}};
 window.qeAddFunnel=function(leadId){var n=prompt('New funnel name:');if(n&&n.trim()){DB.settings=DB.settings||{};DB.settings.funnels=((DB.settings.funnels)||[]).slice();if(funnelList().indexOf(n.trim())<0)DB.settings.funnels.push(n.trim());if(typeof SOURCE_COLOR!=='undefined'&&!SOURCE_COLOR[n.trim()])SOURCE_COLOR[n.trim()]='#7C8194';save();leadQuickEdit(leadId,{funnel:n.trim()});}else{leadQuickEdit(leadId);}};

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
  openModal('Quick edit - '+esc(b.name),
   '<div class="grid2"><div class="field"><label>Stage</label>'+stageSel+'</div><div class="field"><label>Assigned to</label>'+ownerSel+'</div></div>'+
   '<div class="field"><label>'+((typeof LANG!=='undefined'&&LANG==='ar')?'القناة (المصدر)':'Funnel')+'</label>'+funnelSel+'</div>'+
   '<div class="field"><label>Next action</label><input id="qe_next" value="'+esc(b.nextAction||'')+'"></div>'+
   extra+
   '<div class="field"><label>Quick note (optional - logs an activity)</label><textarea id="qe_note" rows="2"></textarea></div>',
   function(){
    var ns=val('qe_stage')||leadStage(b); // an empty stage must never be saved
    try{if(ns==='Lost'&&leadStage(b)!=='Lost'&&typeof captureLostReason==='function')captureLostReason(b);}catch(_){}
    var _newWon=(ns==='Won'&&!b.isClient);
    if(b.isClient&&ns!=='Won'&&leadStage(b)==='Won'){
      var _arQ=(typeof LANG!=='undefined'&&LANG==='ar');
      if(confirm(_arQ?'هذه الشركة عميل حاليًا. الرجوع بها إلى قائمة العملاء المحتملين؟\nموافق = تعود عميلاً محتملاً (يبقى سجلها وماليتها). إلغاء = تبقى عميلاً.':'This company is currently a client. Move it back to the leads pipeline?\nOK = becomes a lead again (its history and finance links stay). Cancel = stays a client.')){
        b.isClient=false;
        b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Stage change',status:ns,note:_arQ?'أُعيدت من العملاء إلى المحتملين':'Moved back from clients to the pipeline',by:(typeof me==='function'?me():'Team')});
      }
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
         bn.innerHTML='<span style="font-size:18px">★</span><div style="flex:1"><b>Managed client</b> — work this account in the Clients book; it is no longer in the active leads pipeline.</div><button class="btn sm" onclick="current=\'clients\';openLead=null;render()">Open in Clients ↗</button>';
         var head=v.querySelector('.detail-head');if(head&&head.parentNode)head.parentNode.insertBefore(bn,head.nextSibling);
       }
       // website row into Key facts if missing
       var facts=[...v.querySelectorAll('.card h3')].filter(function(h){return h.textContent.trim()==='Key facts';})[0];
       if(facts&&b.website&&!facts.parentNode.querySelector('.dt-webrow')){
         var row=document.createElement('div');row.className='fact dt-webrow';row.innerHTML='<span class="k">Website</span><span class="v"><a href="'+esc(b.website)+'" target="_blank" rel="noopener" style="color:#2E90FA">'+esc(dom)+' ↗</a></span>';
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
