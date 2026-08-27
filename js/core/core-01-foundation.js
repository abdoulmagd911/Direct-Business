"use strict";
/* Shared CSV-cell formula-injection guard (2026-08-22, bulletproof-round finding). Every CSV
   export in the app quoted per RFC-4180 (wrap in "..." , double any embedded ") but that is
   NOT protection against formula injection: Excel strips the CSV quoting on open and then
   still evaluates a cell whose first character is =, +, @, or a bare - that isn't a real
   number — "=HYPERLINK(...)" executes, and a real client name like "-Al Rajhi Trading"
   becomes a broken formula instead of a name. The "-" branch is number-aware on purpose so a
   credit note or refund like -1500.50 stays a real negative number and SUM() in the sheet
   still works — only a "-" that ISN'T a plain number gets the guard. */
function csvGuard(v){
  v=(v==null)?'':String(v);
  if(/^[=+@\t\r]/.test(v))return "'"+v;
  if(/^-/.test(v)&&!/^-?\d+(\.\d+)?$/.test(v))return "'"+v;
  return v;
}
try{window.csvGuard=csvGuard;}catch(_){}
/* Shared amount parser (2026-08-22, bulletproof-round finding). Every manual money-amount
   field in the app used parseFloat(String(v).replace(/[^\d.]/g,'')) — which has three
   distinct failure modes, not one:
     - Arabic-Indic digits (١٢٣) and Extended Arabic-Indic/Persian digits (۱۲۳) are stripped
       entirely (JS's \d only matches ASCII 0-9), so an amount typed on an Arabic keyboard —
       normal for this app's staff — silently became an empty string, then 0, then a generic
       "amount is required" alert with no clue why. Loud, but confusing.
     - a leading "-" was stripped too, silently flipping an intended negative/credit entry
       into a positive charge instead of being rejected.
     - European-style thousands/decimal formatting ("1.500,50", dot=thousands/comma=decimal)
       parses under naive digit-stripping as 1.5005 — wrong by a factor of 1000, and still
       passes an amount>0 guard, so it is stored SILENTLY WRONG. This is the dangerous one;
       the other two fail loudly.
   Returns NaN for anything that isn't a clean, unambiguous amount, on purpose — every caller
   already treats "amount required" as its rejection path, so NaN (a falsy comparison against
   `> 0`) reaches that same loud failure instead of this function silently guessing and
   coercing to 0. Never returns 0 for garbage input; only for a literal "0". */
function parseMoneyInput(raw){
  var s=String(raw==null?'':raw).trim();
  if(!s)return NaN;
  s=s.replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-0x0660);})
     .replace(/[۰-۹]/g,function(c){return String(c.charCodeAt(0)-0x06F0);});
  s=s.replace(/٫/g,'.').replace(/٬/g,',').replace(/\s+/g,'');
  var neg=false;var sm=s.match(/^([+-])/);if(sm){neg=sm[1]==='-';s=s.slice(1);}
  s=s.replace(/[^\d,.]/g,'');
  if(!/\d/.test(s))return NaN;
  var seps=[];for(var i=0;i<s.length;i++)if(s[i]===','||s[i]==='.')seps.push(i);
  var intPart,fracPart='';
  if(seps.length===0){
    intPart=s;
  }else{
    var groups=[],prev=0;
    seps.forEach(function(idx){groups.push(s.slice(prev,idx));prev=idx+1;});
    groups.push(s.slice(prev));
    var types=new Set(seps.map(function(idx){return s[idx];}));
    if(types.size===2){
      // both "," and "." present: the RIGHTMOST separator is the decimal marker, whichever
      // character it is — covers both "1,500.50" and "1.500,50". Everything before it must
      // be a valid thousands grouping (first group 1-3 digits, every later group exactly 3)
      // or this is treated as malformed rather than guessed.
      var decGroup=groups[groups.length-1],thousands=groups.slice(0,-1);
      var validThousands=thousands.length>0&&thousands[0].length>=1&&thousands[0].length<=3&&
        thousands.slice(1).every(function(g){return g.length===3;});
      if(!validThousands||!decGroup.length)return NaN;
      intPart=thousands.join('');fracPart=decGroup;
    }else if(seps.length===1){
      var after=groups[1];
      if(after.length===3)intPart=groups[0]+after;               // "1,500" / "1.500" -> 1500
      else if(after.length>=1&&after.length<=2){intPart=groups[0]||'0';fracPart=after;} // "1500.5"/"1500,50"
      else return NaN;
    }else{
      // same separator repeated 2+ times ("1.500.500") — valid ONLY as pure thousands
      // grouping; "1500.50.25" fails this (the "50" group isn't 3 digits) and is correctly
      // rejected as the typo it is, rather than silently truncated.
      var ok=groups[0].length>=1&&groups[0].length<=3&&groups.slice(1).every(function(g){return g.length===3;});
      if(!ok)return NaN;
      intPart=groups.join('');
    }
  }
  if(!/^\d+$/.test(intPart)||(fracPart&&!/^\d+$/.test(fracPart)))return NaN;
  var n=parseFloat(intPart+(fracPart?'.'+fracPart:''));
  if(!isFinite(n))return NaN;
  return neg?-n:n;
}
/* ================= ICONS ================= */
const IC={
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  leads:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  vend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></svg>',
  sop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  sla:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  ops:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  money:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
};

/* ================= SEED ================= */
const SEED = {
  meta:{name:"Direct Business",version:2},
  businesses:[
    {id:"b_mdd",name:"Falcon Conferences Group",nameAr:"شركة الصقر للمؤتمرات",segment:"Corporate / Events & Travel",category:"Anchor",isClient:true,totalSAR:6204662,invoices:41,contacts:[{name:"Accounts Desk",email:"contact1@mice1.example",phone:"+966500000001"},{name:"Client Support",email:"contact2@mice1.example",phone:"+966500000002"},{name:"Front Office",email:"contact3@mice1.example",phone:"+966500000003"}],entityType:"Corporate",legalName:"شركة الصقر للمؤتمرات",crVat:"0000000000000",accountManager:"Abdelrahman",paymentTerms:"Pre-paid (wallet)",contractScope:"Air, hotel, transfer, conference",contractSLA:"Quote ≤4h · 24/7",airlineDeals:[{airline:"Saudia (SV)",code:"SV-CORP-DIRECT",discount:"7%",notes:"Min 200 seats/yr; excl. peak Umrah"},{airline:"Emirates (EK)",code:"EK-CORP-RUH",discount:"5%",notes:"J/Y only"}],pricing:[{service:"Flights",value:"+3% (min SAR 75)",notes:"per ticket"},{service:"Hotels",value:"+8%",notes:"on net"},{service:"Transfer",value:"+SAR 30",notes:""}],notes:"Sample scenario record."},
    {id:"b_maaden",name:"Crestline Minerals",nameAr:"شركة القمة للتعدين",segment:"Enterprise / Mining",category:"Anchor",isClient:true,totalSAR:704931,invoices:108,contacts:[{name:"Client Support",email:"contact1@mining2.example",phone:""},{name:"Front Office",email:"contact2@mining2.example",phone:"+966500000004"}],notes:"Sample scenario record."},
    {id:"b_qahtani",name:"Northgate Contracting & Sons",nameAr:"شركة البوابة للمقاولات",segment:"Enterprise / Contracting",category:"Anchor",isClient:true,totalSAR:342449,invoices:16,contacts:[{name:"Front Office",email:"contact1@contracting3.example",phone:"+966500000005"}],notes:"Sample scenario record."},
    {id:"b_bta",name:"Bright Logistics",nameAr:"شركة النجمة للخدمات اللوجستية",segment:"Travel sub-agent",category:"Anchor",isClient:true,totalSAR:139025,invoices:22,contacts:[{name:"Partnerships Desk",email:"contact1@logistics4.example",phone:"+966500000006"},{name:"Reservations",email:"",phone:"+966500000007"}],notes:"Sample scenario record."},
    {id:"b_benchmark",name:"Silver Conferences Group",nameAr:"شركة الساحل للمؤتمرات",segment:"MICE / Events",category:"Anchor",isClient:true,totalSAR:97535,invoices:13,contacts:[{name:"Reservations",email:"contact1@mice5.example",phone:"+966500000008"}],notes:"Sample scenario record."},
    {id:"b_maaal",name:"Amber Media",nameAr:"شركة الجوهرة للإعلام",segment:"Media / Corporate",category:"Anchor",isClient:true,totalSAR:101400,invoices:4,contacts:[{name:"Info Desk",email:"contact1@media6.example",phone:"+966500000009"}],notes:"Sample scenario record."},
    {id:"b_ultimates",name:"Cedar Holdings",nameAr:"شركة الواحة القابضة",segment:"Corporate",category:"Anchor",isClient:true,totalSAR:59539,invoices:2,contacts:[{name:"Sales Office",email:"contact1@corporate7.example",phone:"+966500000010"}],notes:"Sample scenario record."},
    {id:"b_kayan",name:"Palm Foundation",nameAr:"شركة المسار الخيرية",segment:"Charity",category:"Anchor",isClient:true,totalSAR:1154200,invoices:3,contacts:[],notes:"Sample scenario record."},
    {id:"b_kaplan",name:"Summit Language Institute",nameAr:"شركة الشراع للغات",segment:"Study-abroad school",category:"Vendor",isVendor:true,totalSAR:196117,invoices:5,contacts:[{name:"Client Support",email:"contact1@school9.example",phone:"+966500000011"}],notes:"Sample scenario record."},
    {id:"b_bayswater",name:"Harbor Language Institute",nameAr:"شركة الأفق للغات",segment:"Study-abroad school",category:"Vendor",isVendor:true,totalSAR:135722,invoices:18,contacts:[{name:"Front Office",email:"contact1@school10.example",phone:"+966500000012"}],notes:"Sample scenario record."},
    {id:"b_schools",name:"Meridian Language Institute",nameAr:"شركة الصقر للغات",segment:"Study-abroad schools",category:"Vendor",isVendor:true,totalSAR:84360,invoices:23,contacts:[{name:"Partnerships Desk",email:"contact1@school11.example",phone:"+966500000013"},{name:"Reservations",email:"contact2@school11.example",phone:"+966500000014"}],notes:"Sample scenario record."},
    {id:"b_amadeus",name:"Golden Distribution Systems",nameAr:"شركة القمة لأنظمة التوزيع",segment:"GDS partner",category:"Partner",isVendor:true,totalSAR:163675,invoices:5,contacts:[{name:"Reservations",email:"",phone:"+966500000015"}],notes:"Sample scenario record."},
    {id:"b_bookingcom",name:"Atlas Hospitality Partners",nameAr:"شركة البوابة للضيافة",segment:"Hotel supplier partner",category:"Partner",isVendor:true,totalSAR:153786,invoices:8,contacts:[{name:"Info Desk",email:"contact1@hotel13.example",phone:""}],notes:"Sample scenario record."},
    {id:"b_mawani",name:"Beacon Public Authority",nameAr:"شركة النجمة العامة",segment:"Government",category:"Convert",totalSAR:105601,invoices:4,contacts:[{name:"Sales Office",email:"contact1@government14.example",phone:"+966500000016"}],entityType:"Government entity",legalName:"شركة النجمة العامة",accountManager:"Abdelrahman",paymentTerms:"Post-paid (govt PO)",contractScope:"Air + hotel for delegations",contractSLA:"Per tender terms",pricing:[{service:"Hotels",value:"+10%",notes:"tender-priced"}],notes:"Sample scenario record."},
    {id:"b_riyadhchamber",name:"Orbit Public Authority",nameAr:"شركة الساحل العامة",segment:"Semi-government",category:"Convert",totalSAR:130298,invoices:8,contacts:[{name:"Accounts Desk",email:"contact1@government15.example",phone:"+966500000017"},{name:"Client Support",email:"contact2@government15.example",phone:"+966500000018"}],notes:"Sample scenario record."},
    {id:"b_rawiz",name:"Granite Holdings",nameAr:"شركة الجوهرة القابضة",segment:"Corporate",category:"Re-engage",totalSAR:87508,invoices:3,contacts:[{name:"Client Support",email:"contact1@corporate16.example",phone:"+966500000019"}],notes:""},
    {id:"b_publicsec",name:"Coral Public Authority",nameAr:"شركة الواحة العامة",segment:"Government",category:"Convert",totalSAR:78000,invoices:1,contacts:[{name:"Front Office",email:"contact1@government17.example",phone:""}],notes:"Sample scenario record."},
    {id:"b_sunnah",name:"Ivory Group",nameAr:"شركة المسار التجارية",segment:"Religious tourism",category:"Re-engage",totalSAR:70560,invoices:1,contacts:[{name:"Partnerships Desk",email:"contact1@default18.example",phone:""}],notes:""},
    {id:"b_euroconsult",name:"Juniper Consulting",nameAr:"شركة الشراع للاستشارات",segment:"Engineering consultancy",category:"Re-engage",totalSAR:60000,invoices:1,contacts:[],notes:""},
    {id:"b_alrajhi",name:"Horizon Events Co.",nameAr:"شركة الأفق للمؤتمرات",segment:"MICE / Events",category:"Re-engage",totalSAR:47550,invoices:2,contacts:[{name:"Info Desk",email:"contact1@mice20.example",phone:"+966500000020"}],notes:""},
    {id:"b_sfs",name:"Falcon Civic Directorate",nameAr:"شركة الصقر العامة",segment:"Government",category:"Convert",totalSAR:27600,invoices:1,contacts:[{name:"Sales Office",email:"contact1@government21.example",phone:""}],notes:"Sample scenario record."},
    {id:"b_redcrescent",name:"Crestline Civic Directorate",nameAr:"شركة القمة العامة",segment:"Government",category:"Convert",totalSAR:24955,invoices:1,contacts:[{name:"Accounts Desk",email:"",phone:"+966500000021"}],notes:"Sample scenario record."},
    {id:"b_iu",name:"Northgate Civic Directorate",nameAr:"شركة البوابة العامة",segment:"Government / Education",category:"Re-engage",totalSAR:24340,invoices:3,contacts:[{name:"Client Support",email:"contact1@government23.example",phone:"+966500000022"}],notes:""},
    {id:"b_imsiu",name:"Bright Civic Directorate",nameAr:"شركة النجمة العامة",segment:"Government / Education",category:"Re-engage",totalSAR:23988,invoices:1,contacts:[{name:"Front Office",email:"contact1@government24.example",phone:""}],notes:""},
    {id:"b_nobalaa",name:"Silver Advisory",nameAr:"شركة الساحل للاستشارات",segment:"Consulting",category:"Convert",totalSAR:1410260,invoices:8,b2c:true,contacts:[{name:"Partnerships Desk",email:"",phone:"+966500000023"}],notes:"Sample scenario record."},
    {id:"b_coffee",name:"Amber Guild",nameAr:"شركة الجوهرة الجمعية",segment:"Association",category:"Convert",totalSAR:88955,invoices:5,b2c:true,contacts:[{name:"Reservations",email:"contact1@association26.example",phone:"+966500000024"}],notes:"Sample scenario record."},
    {id:"b_nes",name:"Cedar Technologies",nameAr:"شركة الواحة للأنظمة التقنية",segment:"Technology",category:"Convert",totalSAR:89040,invoices:1,b2c:true,contacts:[{name:"Info Desk",email:"",phone:"+966500000025"}],notes:"Sample scenario record."},
    {id:"b_azm",name:"Palm Group",nameAr:"شركة المسار القابضة",segment:"Corporate",category:"Convert",totalSAR:77000,invoices:4,b2c:true,contacts:[{name:"Sales Office",email:"contact1@corporate28.example",phone:"+966500000026"}],notes:"Sample scenario record."},
    {id:"b_tvtc",name:"Summit Civic Directorate",nameAr:"شركة الشراع العامة",segment:"Government / Training",category:"Convert",totalSAR:23338,invoices:4,b2c:true,contacts:[{name:"Accounts Desk",email:"contact1@government29.example",phone:"+966500000027"}],notes:"Sample scenario record."},
    {id:"b_afaq",name:"Harbor Trading Co.",nameAr:"شركة الأفق للتجارة",segment:"Trading (SME)",category:"Re-engage",totalSAR:5876,invoices:24,b2c:true,contacts:[{name:"Client Support",email:"contact1@trading30.example",phone:"+966500000028"}],notes:"Sample scenario record."},
    {id:"b_tunnels",name:"Meridian Builders",nameAr:"شركة الصقر للمقاولات",segment:"Contracting (SME)",category:"Re-engage",totalSAR:6697,invoices:17,b2c:true,contacts:[{name:"Front Office",email:"contact1@contracting31.example",phone:"+966500000029"}],notes:"Sample scenario record."},
    {id:"b_majal",name:"Golden Builders",nameAr:"شركة القمة للمقاولات",segment:"Contracting (SME)",category:"Re-engage",totalSAR:8418,invoices:15,b2c:true,contacts:[{name:"Partnerships Desk",email:"contact1@contracting32.example",phone:"+966500000030"}],notes:"Sample scenario record."},
    {id:"c_acgc",name:"Atlas Manufacturing Group",segment:"Industrial / Corporate",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Reservations",email:"contact1@industrial33.example",phone:"+966500000031"}],notes:"Sample scenario record."},
    {id:"c_sulalaa",name:"Beacon Transport Group",segment:"Transport / Logistics",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Info Desk",email:"contact1@logistics34.example"}],notes:"Sample scenario record."},
    {id:"c_zaps",name:"Orbit Group",segment:"Corporate group",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Sales Office",email:"contact1@corporate35.example",phone:"+966500000032"}],notes:"Sample scenario record."},
    {id:"c_directfn",name:"Granite Technologies",segment:"Fintech / Data",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Accounts Desk",email:"contact1@technology36.example",phone:"+966500000033"}],notes:"Sample scenario record."},
    {id:"c_neom",name:"Coral Civic Directorate",segment:"Giga-project / Government",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Client Support",email:"contact1@government37.example"}],notes:"Sample scenario record."},
    {id:"c_alshaya",name:"Ivory Stores",segment:"Retail (multinational)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Front Office",email:"contact1@retail38.example"}],notes:"Sample scenario record."},
    {id:"c_kemya",name:"Juniper Manufacturing Group",segment:"Petrochemicals",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Partnerships Desk",email:"contact1@industrial39.example"}],notes:"Sample scenario record."},
    {id:"c_stcbank",name:"Horizon Financial Group",segment:"Banking",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Reservations",email:"contact1@banking40.example",phone:"+966500000034"}],notes:"Sample scenario record."},
    {id:"c_sama",name:"Falcon Regional Office",segment:"Government",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Info Desk",email:"contact1@government41.example",phone:"+966500000035"}],notes:"Sample scenario record."},
    {id:"c_elm",name:"Crestline Networks",segment:"Gov-tech",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Sales Office",email:"contact1@technology42.example",phone:"+966500000036"}],notes:"Sample scenario record."},
    {id:"c_alfanar",name:"Northgate Industries",segment:"Industrial / Energy",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Accounts Desk",email:"contact1@industrial43.example",phone:"+966500000037"}],notes:"Sample scenario record."},
    {id:"c_walaa",name:"Bright Insurance Group",segment:"Insurance",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Client Support",email:"contact1@insurance44.example",phone:"+966500000038"}],notes:"Sample scenario record."},
    {id:"c_honeywell",name:"Silver Industries",segment:"Multinational (industrial)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Front Office",email:"contact1@industrial45.example",phone:"+966500000039"}],notes:"Sample scenario record."},
    {id:"c_gevernova",name:"Amber Energy",segment:"Multinational (energy)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Partnerships Desk",email:"contact1@energy46.example",phone:"+966500000040"}],notes:"Sample scenario record."},
    {id:"c_abbvie",name:"Cedar Pharma",segment:"Pharma (multinational)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Reservations",email:"contact1@pharma47.example"}],notes:"Sample scenario record."},
    {id:"c_iff",name:"Palm Enterprises",segment:"Multinational",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Info Desk",email:"contact1@corporate48.example"}],notes:"Sample scenario record."},
    {id:"c_landmark",name:"Summit Retail Group",segment:"Retail (multinational)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Sales Office",email:"contact1@retail49.example"}],notes:"Sample scenario record."},
    {id:"c_hyatt",name:"Harbor Hospitality Group",segment:"Hospitality",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Accounts Desk",email:"contact1@hospitality50.example"}],notes:"Sample scenario record."},
    {id:"c_savvy",name:"Meridian Enterprises",segment:"PIF entity",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Client Support",email:"contact1@corporate51.example"}],notes:"Sample scenario record."},
    {id:"c_hisense",name:"Golden Networks",segment:"Multinational (electronics)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Front Office",email:"contact1@technology52.example"}],notes:"Sample scenario record."},
    {id:"c_alrushaid",name:"Atlas Industries",segment:"Industrial group",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Partnerships Desk",email:"contact1@industrial53.example",phone:"+966500000041"}],notes:"Sample scenario record."},
    {id:"c_lazurde",name:"Beacon Industries",segment:"Manufacturing (jewellery)",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Reservations",email:"contact1@industrial54.example"}],notes:"Sample scenario record."},
    {id:"c_theeb",name:"Orbit Logistics",segment:"Mobility",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Info Desk",email:"contact1@logistics55.example"}],notes:"Sample scenario record."},
    {id:"c_zamil",name:"Granite Industries",segment:"Industrial group",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Sales Office",email:"contact1@industrial56.example"}],notes:"Sample scenario record."},
    {id:"c_alj",name:"Coral Enterprises",segment:"Conglomerate",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Accounts Desk",email:"contact1@corporate57.example"}],notes:"Sample scenario record."},
    {id:"c_kafalah",name:"Ivory Regional Office",segment:"Government",category:"Convert",source:"Contact form",status:"New",contacts:[{name:"Client Support",email:"contact1@government58.example"}],notes:"Sample scenario record."},
    {id:"c_jeddahexpo",name:"Juniper Gatherings",segment:"MICE / Events",category:"Partner",source:"Conferences",status:"New",contacts:[{name:"Front Office",email:"contact1@mice59.example",phone:"+966500000042"}],notes:"Sample scenario record."},
    {id:"c_ideaevents",name:"Horizon Conferences Group",segment:"MICE / Events",category:"Partner",source:"Conferences",status:"New",contacts:[{name:"Partnerships Desk",email:"contact1@mice60.example",phone:"+966500000043"}],notes:"Sample scenario record."},
    {id:"c_qsexpo",name:"Falcon Conferences Group",segment:"MICE / Events",category:"Partner",source:"Conferences",status:"New",contacts:[{name:"Reservations",email:"contact1@mice61.example"}],notes:"Sample scenario record."},
    {id:"c_modernstruct",name:"Crestline Conferences Group",segment:"Event management (Riyadh)",category:"Partner",source:"Conferences",status:"New",contacts:[{name:"Info Desk",email:"contact1@mice62.example"}],notes:"Sample scenario record."},
    {id:"c_boston",name:"Northgate Est.",segment:"Study-abroad partner",category:"Partner",source:"Contact form",status:"New",contacts:[{name:"Sales Office",email:"contact1@default63.example"}],notes:"Sample scenario record."},
    {id:"c_bctravel",name:"Bright Transport Group",segment:"Travel sub-agent",category:"Partner",source:"Contact form",status:"New",contacts:[{name:"Accounts Desk",email:"contact1@logistics64.example",phone:"+966500000044"}],notes:"Sample scenario record."},
    {id:"c_travelyalla",name:"Silver Destination Partners",segment:"DMC partner",category:"Partner",source:"Contact form",status:"New",contacts:[{name:"Client Support",email:"contact1@dmc65.example"}],notes:"Sample scenario record."}
  ],
  vendors:[
    {id:"v_amadeus",name:"Amadeus",type:"GDS",source:"GDS (primary) + NDC content",portal:"Amadeus Selling Platform Connect",adminPortal:"BSPlink (report.iata.org)",login:"agency Office ID",payment:"BSP",terms:"GDS / NDC content",sla:"—",adm:"GDS ADMs settle through BSP — watch fare/tax recalc, churning, duplicate PNRs, no-show.",process:"Primary booking GDS; reissue/refund in GDS within fare rules; NDC where the carrier mandates it.",contact:"+966122252371",contacts:[{name:"Amadeus Saudi",role:"Agency support",email:"",phone:"+966122252371"}],notes:"Primary GDS."},
    {id:"v_sabre",name:"Sabre",type:"GDS",source:"GDS (DCS)",portal:"Sabre Red 360",adminPortal:"BSPlink",login:"agency PCC",payment:"BSP",terms:"GDS",sla:"—",adm:"BSP ADM rules.",process:"Secondary GDS / DCS fares.",contact:"",contacts:[],notes:"Cross-ref in SOPs."},
    {id:"v_galileo",name:"Galileo / Travelport",type:"GDS",source:"GDS",portal:"Travelport Smartpoint",adminPortal:"BSPlink",login:"agency PCC",payment:"BSP",terms:"GDS",sla:"—",adm:"BSP ADM rules.",process:"GDS fares where applicable.",contact:"",contacts:[],notes:""},
    {id:"v_tf",name:"Travel Fusion",type:"Aggregator (LCC/NDC)",source:"Aggregator — LCC + NDC via tfPay",portal:"reports.travelfusion.com",adminPortal:"reports.travelfusion.com (golive checklist)",login:"agency API credentials",payment:"tfPay / card",terms:"LCC/NDC aggregation",sla:"—",adm:"No BSP ADM (card/tfPay) — reconcile tfPay charges; B2B supplier credentials added per carrier.",process:"Search/book LCC + some NDC via the platform; instant ticketing; changes via portal.",contact:"",contacts:[{name:"Afaq",role:"Integration / dev liaison",email:"afaq@devdksa.com",phone:""}],notes:"Main LCC content source."},
    {id:"v_iwtx",name:"iWTX / IRIX",type:"Aggregator",source:"Content / credential store",portal:"",adminPortal:"",login:"agency account",payment:"—",terms:"Content/credentials",sla:"—",adm:"",process:"Supplier credential management across carriers.",contact:"",contacts:[],notes:""},
    {id:"v_ratehawk",name:"RateHawk",type:"Hotels + Transfers",source:"Direct portal (online) + FIT offline",portal:"ratehawk.com",adminPortal:"",login:"agency account",payment:"VCC / wallet / credit",terms:"Online + FIT offline; refundable vs non-ref per rate",sla:"Ticket resolution ≤72h (often breached — monitor)",adm:"Non-air — no ADM. Cancellation penalties per rate; track non-refundable bookings carefully.",process:"Search online for best net rate → book → HCN + voucher. For special/group use FIT offline email request. Transfers: capture driver details + flight no., escalate if >10 min late.",contacts:[{name:"Mina (Mena)",role:"Account/support",email:"",phone:""},{name:"Mamdouh Ahmed",role:"FIT / support",email:"mamdouh.ahmed@ratehawk.com",phone:""},{name:"Transfers desk",role:"Transfers",email:"Transfer@ratehawk.com",phone:""}],notes:"HCN/voucher workflow; FIT team for offline quotes."},
    {id:"v_bookingcom",name:"Booking.com",type:"Hotels",source:"Direct supplier / API",portal:"admin.booking.com",adminPortal:"",login:"agency account",payment:"VCC / card",terms:"Supplier",sla:"—",adm:"Cancellation per rate — flag non-refundable.",process:"Online book → voucher; reconfirm with property 24–48h before arrival.",contact:"",contacts:[],notes:""},
    {id:"v_webbeds",name:"WebBeds",type:"Hotels (bedbank)",source:"Bedbank — online + offline",portal:"webbeds.com",adminPortal:"",login:"agency account",payment:"credit / VCC",terms:"Bedbank",sla:"—",adm:"Cancellation per rate.",process:"Compare net rate; book → HCN/voucher; reconfirm.",contact:"",contacts:[],notes:""},
    {id:"v_hotelbeds",name:"Hotelbeds",type:"Hotels (bedbank)",source:"Bedbank — API/portal",portal:"hotelbeds.com",adminPortal:"",login:"agency account",payment:"credit / VCC",terms:"Bedbank",sla:"—",adm:"Cancellation per rate.",process:"Compare net rate; book → voucher; reconfirm.",contact:"",contacts:[],notes:""},
    {id:"v_tbo",name:"TBO",type:"Hotels (bedbank)",source:"Bedbank — portal/API",portal:"tbo.com",adminPortal:"",login:"agency account",payment:"credit / VCC",terms:"Bedbank",sla:"—",adm:"Cancellation per rate.",process:"Compare net rate; book → voucher.",contact:"",contacts:[],notes:""},
    {id:"v_zetexa",name:"Zetexa",type:"eSIM",source:"White-label eSIM platform / API",portal:"Zetexa partner portal",adminPortal:"",login:"partner account",payment:"wallet / card",terms:"White-label eSIM",sla:"—",adm:"",process:"Issue eSIM via white-label; deliver QR to client.",contact:"",contacts:[{name:"Varun",role:"Partnerships (MENA)",email:"",phone:"+91 93726 10501"}],notes:"Airalo/Simly also evaluated."},
    {id:"v_moola",name:"Moola",type:"Payments",source:"Payment gateway",portal:"",adminPortal:"",login:"merchant account",payment:"auth / capture / refund",terms:"Payment auth/refund",sla:"—",adm:"",process:"Card auth → capture; refunds reconciled.",contact:"",contacts:[],notes:""},
    {id:"v_sifi",name:"SIFI",type:"Payments",source:"Payment gateway",portal:"",adminPortal:"",login:"merchant account",payment:"card",terms:"Payments",sla:"—",adm:"",process:"Payment processing & reconciliation.",contact:"",contacts:[],notes:""},
    {id:"v_almosafer",name:"Almosafer",type:"Benchmark / OTA",source:"Benchmark only (not a supplier)",portal:"almosafer.com",adminPortal:"",login:"",payment:"—",terms:"Benchmark",sla:"—",adm:"",process:"Price benchmark vs our quotes.",contact:"",contacts:[],notes:"Price benchmark, not a supplier."}
  ],
  sops:[
    {id:"s1",code:"SOP 1",title:"Reservation & PNR Retrieval",purpose:"Open and read any booking before acting.",cmd:"RT6XXXXX · RT/AHMED · RTA (itinerary) · RTF (ticket+amount) · RT*E (history)",body:"Retrieve → verify names vs passport → check itinerary & ticketing status before quoting.",market:"Saudi desk relies on agent memory; no mandatory pre-action read.",edge:"Mandatory retrieve-and-verify step on every action — eliminates name/itinerary errors before they reach the client."},
    {id:"s2",code:"SOP 2",title:"Pricing & Quoting",purpose:"Price correctly and read fare conditions before issuing.",cmd:"FXR (adult) · FXR/RCH (child) · FXX then FQN1*PE (penalty)",body:"Always read penalty & change rules (FQN1*PE) BEFORE issuing. Domestic penalties often per-sector.",market:"Quote on price alone; penalties discovered later, passed to client as surprises.",edge:"Penalty + change rules read and disclosed at quote time — no surprise fees, matching the transparency the whales sell on."},
    {id:"s3",code:"SOP 3",title:"Fare Families, Baggage & Ancillaries",purpose:"Add baggage, meals, wheelchair correctly.",cmd:"SR XBAG-TTL20KG ACC BAG/S2/P1 · SRWCHC/P1 · SRFSML/P1/S1",body:"Some Saudia/Kuwait classes carry NO baggage — confirm before selling on price.",market:"Baggage assumptions cause complaints at the airport.",edge:"Class/baggage confirmed at sell — fare-family clarity like an NDC retailer."},
    {id:"s4",code:"SOP 4",title:"Reissue / Exchange",purpose:"Change a ticket within fare rules.",cmd:"Reissue: FXB→FXO · FXR→FXE · FXP→FXQ · FXX→FXF",body:"Read conditions → confirm penalty/fare-diff → reissue, collect penalty (EMD where required).",market:"Reissues often refused or delayed; manual errors trigger ADMs.",edge:"Structured reissue with EMD discipline — fewer ADMs, faster changes."},
    {id:"s5",code:"SOP 5",title:"Refund / Void",purpose:"Refund correctly; prefer void in window.",cmd:"Full refund · Partial (unused coupons) · VOID (same-day before BSP)",body:"Void preferred over refund while in window. Cancel erroneous refunds before BSP settles.",market:"Refunds take weeks; void window routinely missed.",edge:"Void-first policy + ≤48h refund initiation (see SLAs) vs the market's multi-week norm."},
    {id:"s6",code:"SOP 6",title:"EMD & Ancillary Documents",purpose:"Issue EMD for prepaid baggage/seat, penalties, deposits.",cmd:"Add SSR → issue EMD against service",body:"EMD refund/void follows the same void-window rule as tickets.",market:"Ancillaries handled informally / off-system.",edge:"All ancillaries documented as EMD — clean audit trail and revenue capture."},
    {id:"s7",code:"SOP 7",title:"Tickets Issued by Another Agency",purpose:"Read a ticket not issued by your office.",cmd:"ITRD/TKT077-... (display) · ITR/... (print)",body:"Foreign-website tickets with no online change must go back to the owning agency.",market:"Confusion over who owns the ticket; client bounced around.",edge:"Clear ownership rule — client always told exactly who actions their ticket."},
    {id:"s8",code:"SOP 8",title:"Compliance — Avoiding ADM Fines",purpose:"Avoid airline debit memos billed to the agency.",cmd:"Watch: inactive segments · churning · duplicates · passive segments · day-of-travel ticketing · no-show",body:"Clear dead segments; never churn/duplicate; ticket day-of-travel immediately; void un-ticketed PNRs. Backed by ADM Policy V4 (Jun 2024).",market:"ADM fines treated as cost of doing business.",edge:"Active ADM-prevention checklist on every PNR — protects margin the way a large TMC's QC desk does."},
    {id:"s9",code:"SOP 9",title:"Waitlist (fare-saving)",purpose:"Book a cheaper sold-out class and wait for confirmation.",cmd:"WAITLIST lower class",body:"If airline confirms the lower class, customer gets the lower fare. Monitor and reprice.",market:"Rarely used; client overpays.",edge:"Proactive fare-saving — demonstrable savings to report back to the client."},
    {id:"s10",code:"SOP 10",title:"Hotels, Packages, Cruise, Car",purpose:"Non-air fulfilment basics.",cmd:"Room types: RO/BB/HB/FB/AI · PACKAGE MAKER",body:"Know room types & board basis; confirm visa/transfers/board before quoting packages.",market:"Inconsistent room/board knowledge → wrong bookings.",edge:"Standardised room/board taxonomy + package checklist across the desk."},
    {id:"s11",code:"SOP 11",title:"Visas, Umrah/Hajj & Permits",purpose:"Handle travel documentation.",cmd:"Safa Online · Nusuk · التصريح الأمني · تصريح السفر",body:"Security/travel permits for specific nationalities & countries; allow lead time for endorsements.",market:"Documentation gaps cause denied boarding.",edge:"Built-in document & permit checks per nationality/route — a duty-of-care safeguard."},
    {id:"s12",code:"SOP 12",title:"Customer Handling & Sales",purpose:"Respond to price pressure professionally.",cmd:"Best price w/o sacrificing service · ±3 days · multiple offers",body:"Build the package around the customer's real need; don't discount blindly.",market:"Discount-to-win; margin erosion.",edge:"Value-led handling with options & date flex — consultative selling like the global TMCs."}
  ],
  /* Whale-grade SOPs that the Saudi market base lacks */
  sopsWhale:[
    {id:"wf",code:"FLIGHTS",title:"Air Booking — End-to-End Standard",purpose:"Deliver every flight to global-TMC standard: best fare, clean fare rules, zero ADM risk.",cmd:"Multi-source: GDS + NDC + LCC aggregators · ±3 days / nearby airports · FQN1*PE (rules) · SR/OSI (seat, meal, FF, APIS) · respect TTL · EMD for ancillaries",body:"1) Search across GDS, NDC and LCC/aggregator content — never single-source; check ±3 days and nearby airports. 2) Read fare rules, baggage and change/refund penalties BEFORE quoting and disclose them to the client. 3) Add SSR/OSI: seats, meals, wheelchair, frequent-flyer, passport/APIS. 4) Hold within the TTL; ticket ≥24h before the deadline; never churn, duplicate or hold speculative segments (ADM). 5) Issue, then send e-ticket + itinerary the same day. 6) Pre-ticket QA: names vs passport, routing, dates/times, fare basis, baggage. 7) Post-ticket: monitor schedule changes proactively and notify the traveler; handle exchanges/refunds strictly per fare rules, collecting penalties via EMD.",market:"Single-GDS, price-only quotes; penalties found after sale; manual / last-minute ticketing → ADMs and surprise fees.",edge:"Multi-source NDC best-fare + disclosed rules + pre-ticket QA + proactive schedule monitoring — an Amex GBT / CWT-grade air desk."},
    {id:"wh",code:"HOTELS",title:"Hotel Booking — End-to-End Standard",purpose:"Source, book and service hotels to global standard — best net rate, no surprises, reconfirmed.",cmd:"Compare bedbanks: RateHawk / WebBeds / Hotelbeds / TBO / Booking + direct · refundable vs non-ref · board RO/BB/HB/FB/AI · pay by VCC · HCN + voucher · FIT offline for special",body:"1) Compare live net rates across bedbanks and direct; check rate parity. 2) Confirm board basis, cancellation policy (refundable vs non-refundable) and inclusions BEFORE quoting. 3) Capture special requests in writing to the property — bed type, early check-in, connecting / accessible rooms. 4) Pay via virtual credit card / wallet — never expose the client's card. 5) Issue voucher + HCN same day; reconfirm with the property 24–48h before arrival. 6) Use an offline FIT request for groups, long-stay or special rates. 7) Manage modify / cancel within policy; escalate the supplier per SLA (ack ≤2h, resolve ≤72h). 8) Keep the stay on the traveler's trip record (duty of care).",market:"Book the first source seen; board / cancellation assumed; client card exposed; no reconfirmation → check-in surprises and disputes.",edge:"Multi-bedbank best-net + parity check + reconfirmation + VCC payment + duty-of-care record — a global-TMC hotel desk."},
    {id:"w1",code:"DUTY OF CARE",title:"Traveler Tracking & Safety",purpose:"Know where every traveler is and reach them in a crisis.",body:"Maintain a live trip record (flights, hotels, transfers) per traveler; flag risk destinations; keep an emergency contact path and a 24/7 assistance number on every itinerary.",market:"Largely absent in local B2B — once ticketed, the traveler is on their own.",edge:"Adopt the single biggest differentiator of Amex GBT/CWT/Navan: real-time traveler visibility & duty of care."},
    {id:"w2",code:"24/7",title:"Follow-the-Sun Servicing",purpose:"Coverage outside office hours.",body:"After-hours desk / on-call rota with a written handover log; emergencies acknowledged ≤30 min, resolved ≤4h, any hour.",market:"Saudi desks are business-hours only; nights & weekends go unanswered.",edge:"24/7 reachability — Navan's core promise — brought to the KSA B2B segment."},
    {id:"w3",code:"PROACTIVE",title:"Disruption Management",purpose:"Fix problems before the traveler feels them.",body:"Monitor schedule changes, delays, cancellations & weather; rebook and notify the traveler before they call. Standing rebooking authority for the desk.",market:"Reactive — the client discovers the disruption first and chases us.",edge:"Proactive outreach + rebooking authority = the 'we fixed it before you knew' experience."},
    {id:"w3b",code:"VIP",title:"Executive / VIP Handling",purpose:"White-glove service for key travelers.",body:"VIP profiles (seat, carrier, hotel, dietary, loyalty); priority queue; meet-&-greet and lounge where relevant; named owner per VIP.",market:"No formal VIP tier; depends on which agent picks up.",edge:"Consistent executive-grade handling — what wins and retains corporate accounts."},
    {id:"w4",code:"QA",title:"Quality Assurance & PNR Audit",purpose:"Catch errors before they cost money or trust.",body:"Pre-ticket QC checklist (names, dates, fare rules, TTL, SSR) + post-trip review; maintain an error log and root-cause it monthly.",market:"No QC layer; errors found by the client/airport.",edge:"A QC desk like the big TMCs — measurably fewer errors & ADMs."},
    {id:"w5",code:"ESCALATION",title:"Escalation Matrix",purpose:"Make sure nothing stalls.",body:"Tiered escalation (Agent → Senior → Manager → Ops Head) with time triggers tied to SLAs; every unresolved request auto-escalates.",market:"Escalation is ad-hoc via WhatsApp; things get lost.",edge:"Time-bound, owner-assigned escalation — accountability the market lacks."},
    {id:"w6",code:"CONTENT",title:"NDC & Content Strategy",purpose:"Always offer the best available fare/content.",body:"Decision logic across GDS / NDC / aggregators / direct; capture NDC-only fares & ancillaries; record why a source was chosen.",market:"Single-source by habit; misses NDC fares & ancillaries.",edge:"Multi-source best-fare logic — the content edge the whales compete on."},
    {id:"w7",code:"ACCOUNTS",title:"Reporting & Account Reviews",purpose:"Make the relationship sticky.",body:"Per-client savings & spend reports + quarterly business reviews (QBRs); show value, surface optimisation, renew.",market:"No structured reporting; relationship is transactional.",edge:"QBRs + savings reporting = the retention engine of every major TMC."}
  ],
  slas:[
    {id:"sla1",event:"First response to a client request",direct:"≤ 2 business hrs (after-hours ack ≤ 30 min)",market:"24–48 hrs, business hours only",whale:"24/7, agent in <2 min (Navan)",rank:"meet"},
    {id:"sla2",event:"Quote — simple (online rate)",direct:"≤ 4 hrs",market:"Same/next day",whale:"Minutes via self-serve",rank:"beat"},
    {id:"sla3",event:"Quote — complex / offline (FIT, group, charter)",direct:"≤ 24 hrs",market:"48–72 hrs",whale:"≤ 24 hrs, dedicated team",rank:"meet"},
    {id:"sla4",event:"Booking confirmation after approval",direct:"≤ 24 hrs",market:"≥ 48 hrs",whale:"Real-time via OBT",rank:"beat"},
    {id:"sla5",event:"Air ticketing vs fare deadline (TTL)",direct:"Issue ≥ 24 hrs before TTL; never miss",market:"Last-minute; frequent ADM risk",whale:"Automated queue management",rank:"beat"},
    {id:"sla6",event:"Voucher / itinerary delivery",direct:"Same day as confirmation",market:"Next day",whale:"Instant in-app",rank:"beat"},
    {id:"sla7",event:"Modify / cancel handling",direct:"Ack ≤ 2 hrs · resolve ≤ 72 hrs",market:"72 hrs+ and often breached",whale:"≤ 24 hrs, rebooking authority",rank:"beat"},
    {id:"sla8",event:"Refund processing",direct:"Initiate ≤ 48 hrs of approval",market:"Weeks",whale:"Automated",rank:"beat"},
    {id:"sla9",event:"Transfer / chauffeur",direct:"Driver details ≥ 12 hrs before; escalate if >10 min late",market:"Reactive; no-shows common",whale:"Live tracking",rank:"beat"},
    {id:"sla10",event:"Complaint resolution",direct:"≤ 3 business days, closed-loop",market:"Undefined",whale:"Closed-loop + NPS",rank:"meet"},
    {id:"sla11",event:"In-trip emergency",direct:"Respond ≤ 4 hrs, 24/7",market:"Business hours only",whale:"24/7 follow-the-sun + proactive",rank:"meet"},
    {id:"sla12",event:"Proactive disruption outreach",direct:"Notify before traveler notices",market:"None — client finds out first",whale:"Standard (live monitoring)",rank:"meet"},
    {id:"sla13",event:"Traveler satisfaction (NPS)",direct:"Target ≥ 50, measured quarterly",market:"Not measured",whale:"Measured & published",rank:"beat"},
    {id:"sla14",event:"First-contact resolution",direct:"Target ≥ 80%",market:"Not tracked",whale:"Tracked KPI",rank:"beat"}
  ],
  requests:[
    {id:"r1",client:"Beacon Public Authority",service:"Hotels",detail:"Tender delegation — 18 rooms, Jeddah, 2 nights",stage:"New",owner:"Abdelrahman",priority:"Urgent",createdAt:Date.now()-1.2*3600e3,supplier:"",pnr:"",sell:0,notes:""},
    {id:"r2",client:"Falcon Conferences Group",service:"Flights",detail:"3 pax RUH→LHR business class, 12–18 Jun",stage:"Quoting",owner:"Abdelrahman",priority:"High",createdAt:Date.now()-3*3600e3,supplier:"Amadeus",pnr:"",sell:0,notes:""},
    {id:"r3",client:"Orbit Public Authority",service:"Group / MICE",detail:"20 rooms + meeting hall, conference",stage:"Awaiting client",owner:"Raad",priority:"Normal",createdAt:Date.now()-30*3600e3,supplier:"RateHawk",pnr:"",sell:0,notes:"Quote sent, awaiting PO"},
    {id:"r4",client:"Harbor Language Institute (student)",service:"Transfer / Chauffeur",detail:"Student RUH→MAN flight + airport chauffeur",stage:"Ticketed",owner:"Kareem",priority:"Normal",createdAt:Date.now()-50*3600e3,supplier:"Travel Fusion",pnr:"X4K9PQ",sell:4200,cost:3600,notes:""},
    {id:"r5",client:"Silver Conferences Group",service:"Hotels",detail:"Speaker accommodation, 4 rooms Riyadh",stage:"Delivered",owner:"Abdelrahman",priority:"Normal",createdAt:Date.now()-90*3600e3,supplier:"WebBeds",pnr:"HCN-602966",sell:9800,cost:8200,notes:"Vouchers delivered"}
  ],
  airlines:[
    {id:"air_sv",name:"Saudia",code:"SV",type:"FSC",icao:"SVA",stock:"065",country:"Saudi Arabia",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Trip, Almosafer",manual:"RateHawk",login:"IATA agency account",contacts:[{name:"Saudia Trade Support",role:"Agency desk",email:"",phone:""}],notes:"National carrier — primary domestic + Umrah volume."},
    {id:"air_xy",name:"flynas",code:"XY",type:"LCC",icao:"KNE",stock:"593",country:"Saudi Arabia",gds:"Sabre, Amadeus",providers:"Travel Fusion",frontend:"Yes",deeplinks:"Trip.com, Wego",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:"Saudi LCC — high domestic frequency."},
    {id:"air_f3",name:"flyadeal",code:"F3",type:"LCC",icao:"FAD",stock:"000",country:"Saudi Arabia",gds:"",providers:"Travel Fusion",frontend:"Yes",deeplinks:"Elmosafer, Ubfly, Trip.com",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:"Saudia-group LCC."},
    {id:"air_ek",name:"Emirates",code:"EK",type:"FSC",icao:"UAE",stock:"176",country:"United Arab Emirates",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"",manual:"",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_ey",name:"Etihad Airways",code:"EY",type:"FSC",icao:"ETD",stock:"607",country:"United Arab Emirates",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_qr",name:"Qatar Airways",code:"QR",type:"FSC",icao:"QTR",stock:"157",country:"Qatar",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Elmosafer, Ubfly, Trip.com",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:"Prefer Qatar NDC to avoid GDS surcharge ADMs."},
    {id:"air_fz",name:"flydubai",code:"FZ",type:"LCC",icao:"FDB",stock:"141",country:"United Arab Emirates",gds:"Sabre, Amadeus",providers:"Duffel, Travel Fusion",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:""},
    {id:"air_g9",name:"Air Arabia",code:"G9",type:"LCC",icao:"ABY",stock:"514",country:"United Arab Emirates",gds:"Amadeus",providers:"",frontend:"N/A",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"Flight Route",login:"agency account",contacts:[],notes:""},
    {id:"air_gf",name:"Gulf Air",code:"GF",type:"FSC",icao:"GFA",stock:"072",country:"Bahrain",gds:"Sabre, Amadeus",providers:"",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_ku",name:"Kuwait Airways",code:"KU",type:"FSC",icao:"KAC",stock:"229",country:"Kuwait",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Flight Network, MyTrip, Booking, Safarni",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_wy",name:"Oman Air",code:"WY",type:"FSC",icao:"OAS",stock:"910",country:"Oman",gds:"Sabre, Amadeus",providers:"Duffel, Travel Fusion",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_j9",name:"Jazeera Airways",code:"J9",type:"LCC",icao:"JZR",stock:"486",country:"Kuwait",gds:"Amadeus",providers:"Travel Fusion",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:""},
    {id:"air_ms",name:"EgyptAir",code:"MS",type:"FSC",icao:"MSR",stock:"077",country:"Egypt",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Ubfly, Booking, Almosafer",manual:"RateHawk",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_sm",name:"Air Cairo",code:"SM",type:"LCC",icao:"MSC",stock:"381",country:"Egypt",gds:"Amadeus",providers:"",frontend:"Yes",deeplinks:"Almosafer, Safarni, Trip",manual:"RateHawk",login:"agency account",contacts:[],notes:""},
    {id:"air_np",name:"Nile Air",code:"NP",type:"FSC",icao:"NIA",stock:"325",country:"Egypt",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Ubfly, Trip, Almosafer",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_ne",name:"Nesma Airlines",code:"NE",type:"LCC",icao:"NMA",stock:"477",country:"Egypt",gds:"Sabre, Amadeus",providers:"Travel Fusion",frontend:"Yes",deeplinks:"Elmosafer, Ubfly, Trip.com",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:""},
    {id:"air_tk",name:"Turkish Airlines",code:"TK",type:"FSC",icao:"THY",stock:"235",country:"Turkey",gds:"Sabre, Amadeus",providers:"Duffel, Travel Fusion",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_pc",name:"Pegasus Airlines",code:"PC",type:"LCC",icao:"PGT",stock:"624",country:"Turkey",gds:"Sabre, Amadeus",providers:"Duffel, Travel Fusion",frontend:"Yes",deeplinks:"Trip, Almosafer, eDreams",manual:"RateHawk, Flight Route",login:"agency account",contacts:[],notes:""},
    {id:"air_rj",name:"Royal Jordanian",code:"RJ",type:"FSC",icao:"RJA",stock:"512",country:"Jordan",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"N/A",deeplinks:"",manual:"",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_me",name:"Middle East Airlines",code:"ME",type:"FSC",icao:"MEA",stock:"076",country:"Lebanon",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_at",name:"Royal Air Maroc",code:"AT",type:"FSC",icao:"RAM",stock:"147",country:"Morocco",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Flight Network, MyTrip, Booking, Safarni",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_et",name:"Ethiopian Airlines",code:"ET",type:"FSC",icao:"ETH",stock:"071",country:"Ethiopia",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Ubfly, Trip, Almosafer",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_pk",name:"Pakistan International",code:"PK",type:"FSC",icao:"PIA",stock:"214",country:"Pakistan",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Flight Network, MyTrip, Booking, Safarni",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_ai",name:"Air India",code:"AI",type:"FSC",icao:"AIC",stock:"098",country:"India",gds:"",providers:"",frontend:"Yes",deeplinks:"Elmosafer, Ubfly, Flyin",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:"Need 50K baggage."},
    {id:"air_ix",name:"Air India Express",code:"IX",type:"LCC",icao:"AXB",stock:"236",country:"India",gds:"",providers:"Travel Fusion",frontend:"Yes",deeplinks:"Ubfly, Almosafer, Wingie",manual:"RateHawk, PKFare, Dnata",login:"agency account",contacts:[],notes:""},
    {id:"air_6e",name:"IndiGo",code:"6E",type:"LCC",icao:"IGO",stock:"312",country:"India",gds:"Amadeus",providers:"Travel Fusion",frontend:"N/A",deeplinks:"",manual:"",login:"agency account",contacts:[],notes:""},
    {id:"air_ba",name:"British Airways",code:"BA",type:"FSC",icao:"BAW",stock:"125",country:"United Kingdom",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_lh",name:"Lufthansa",code:"LH",type:"FSC",icao:"DLH",stock:"220",country:"Germany",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Ubfly, Flight Network, Go To Gate",manual:"Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_af",name:"Air France",code:"AF",type:"FSC",icao:"AFR",stock:"057",country:"France",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_kl",name:"KLM Royal Dutch Airlines",code:"KL",type:"FSC",icao:"KLM",stock:"074",country:"Netherlands",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_sq",name:"Singapore Airlines",code:"SQ",type:"FSC",icao:"SIA",stock:"618",country:"Singapore",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"Yes",deeplinks:"Almosafer, Skyscanner, Expedia, Trip",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_tg",name:"Thai Airways",code:"TG",type:"FSC",icao:"THA",stock:"217",country:"Thailand",gds:"Sabre, Amadeus",providers:"Duffel",frontend:"N/A",deeplinks:"Trip, eDreams, Kiwi, Go To Gate",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""},
    {id:"air_ul",name:"SriLankan Airlines",code:"UL",type:"FSC",icao:"ALK",stock:"603",country:"Sri Lanka",gds:"Sabre, Amadeus",providers:"",frontend:"N/A",deeplinks:"Travelwings",manual:"RateHawk, Flight Route",login:"IATA agency account",contacts:[],notes:""}
  ],
  offers:[]
};

const CATEGORIES=["Anchor","Convert","Re-engage","Dormant","Vendor","Partner"];
const CAT_DESC={Anchor:"Key clients — deepen",Convert:"Billed us, not yet a client",["Re-engage"]:"Past business — re-engage",Dormant:"Long-tail / inactive",Vendor:"Pays us commission",Partner:"Supplier / GDS"};
const CAT_COLOR={Anchor:"#16B364",Convert:"#FF6B00",["Re-engage"]:"#2E90FA",Dormant:"#9AA1B6",Vendor:"#7A5AF8",Partner:"#15B8A6"};
const LEAD_STATUSES=["New","To contact","Contacted","In discussion","Proposal sent","Won","Lost","On hold"];
const STATUS_COLOR={New:"#9AA1B6","To contact":"#FF6B00",Contacted:"#2E90FA","In discussion":"#7A5AF8","Proposal sent":"#F79009",Won:"#16B364",Lost:"#F0453A","On hold":"#82868B"};
/* ----- Lead pipeline stages (the headline pipeline) ----- */
const LEAD_STAGES=["Prospect","Contacted","Qualified","Proposal","Negotiation","Won","Lost"];
const LSTAGE_COLOR={Prospect:"#9AA1B6",Contacted:"#2E90FA",Qualified:"#7A5AF8",Proposal:"#F79009",Negotiation:"#FF6B00",Won:"#16B364",Lost:"#F0453A"};
const STATUS_TO_STAGE={New:"Prospect","To contact":"Prospect",Contacted:"Contacted","In discussion":"Qualified","Proposal sent":"Proposal",Won:"Won",Lost:"Lost","On hold":"Qualified"};
function leadStage(b){return b.stage||(b.isClient?"Won":(STATUS_TO_STAGE[b.status]||"Prospect"));}
window.captureLostReason=function(b){try{var ar=(typeof LANG!=='undefined'&&LANG==='ar');var r=prompt(ar?('لماذا خسرنا «'+b.name+'»؟ (سبب مختصر — يُحفظ للتعلم منه)'):('Why did we lose "'+b.name+'"? (short reason — kept so we learn from it)'),b.lostReason||'');if(r!=null&&String(r).trim()!==''){b.lostReason=String(r).trim();b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Lost',status:'Lost',note:'Lost — '+b.lostReason,by:(window.meName?meName():'Team')});}}catch(_){}};
function setLeadStage(id,s){const b=getLead(id);if(!b)return;if(s==='Lost')captureLostReason(b);b.stage=s;b.status=s;b.activities=b.activities||[];b.activities.push({date:Date.now(),type:"Stage change",status:s,note:"",by:(typeof me==="function"?me():"Abdelrahman")});b.lastContact=Date.now();if(s==="Won")b.isClient=true;save();render();}
const DIRECT_LINK={Anchor:{l:"Key client",c:"#16B364"},Convert:{l:"Warm conversion",c:"#FF6B00"},"Re-engage":{l:"Re-engage",c:"#2E90FA"},Dormant:{l:"Dormant",c:"#9AA1B6"},Vendor:{l:"Commission vendor",c:"#7A5AF8"},Partner:{l:"Partner / supplier",c:"#15B8A6"}};
function directLink(b){if(b.isClient)return{l:"Client",c:"#16B364"};if(b.b2c)return{l:"B2C-hidden",c:"#7A5AF8"};return DIRECT_LINK[b.category]||{l:b.category||"—",c:"#9AA1B6"};}
function directLinkTag(b){const d=directLink(b);return `<span class="tag" style="background:${d.c}1a;color:${d.c}">${esc(d.l)}</span>`;}
const STAGES=["New","Quoting","Awaiting client","Booked","Ticketed","Delivered","Closed"];
const STAGE_COLOR={New:"#9AA1B6",Quoting:"#F79009","Awaiting client":"#2E90FA",Booked:"#7A5AF8",Ticketed:"#15B8A6",Delivered:"#16B364",Closed:"#82868B"};
const ACT_TYPES=["Call","WhatsApp","Email","Meeting","Teams / Zoom / Meet","Proposal","Note"];
/* ----- Funnels (lead source) + team ----- */
const SOURCES=["Old Customers","Individuals from B2B","Conferences","Contact form","Tender","Direct outreach","Referral","Invoice history"];
const SOURCE_COLOR={"Old Customers":"#A9781A","Individuals from B2B":"#7A5AF8","Conferences":"#FF6B00","Contact form":"#2E90FA","Tender":"#15B8A6","Direct outreach":"#16B364","Referral":"#EC4899","Invoice history":"#9AA1B6"};
const SOURCE_DESC={"Individuals from B2B":"Businesses found hidden inside B2C invoices","Conferences":"MICE / events leads","Contact form":"Inbound from directksa.com contact form","Tender":"Government / corporate tenders & RFPs","Direct outreach":"We approached them","Referral":"Referred by a client or partner","Invoice history":"Billed before with full tax invoice"};
const TEAM=["Abdelrahman","Othman Al Sharafi","Raad","Kareem","Unassigned"];
/* ----- Channels of communication (faces of comms) ----- */
const CHANNELS=["WhatsApp","Email","Phone","Portal","In person","Tender portal"];
/* ----- Airline 3-digit ticket stock (IATA accounting code) + KSA-IATA (BSP Saudi) flag ----- */
const AIR_CODE={SV:{s:"065",k:"Yes"},MS:{s:"077",k:"Yes"},NP:{s:"325",k:"Yes"},FZ:{s:"141",k:"Yes"},EK:{s:"176",k:"Yes"},EY:{s:"607",k:"Yes"},QR:{s:"157",k:"Yes"},GF:{s:"072",k:"Yes"},KU:{s:"229",k:"Yes"},RJ:{s:"512",k:"Yes"},WY:{s:"910",k:"Yes"},TK:{s:"235",k:"Yes"},LH:{s:"220",k:"Yes"},BA:{s:"125",k:"Yes"},AF:{s:"057",k:"Yes"},KL:{s:"074",k:"Yes"},LX:{s:"724",k:"Yes"},AZ:{s:"055",k:"Yes"},IB:{s:"075",k:"Yes"},AY:{s:"105",k:"Yes"},SN:{s:"082",k:"Yes"},TP:{s:"047",k:"Yes"},AI:{s:"098",k:"Yes"},SQ:{s:"618",k:"Yes"},CX:{s:"160",k:"Yes"},TG:{s:"217",k:"Yes"},NH:{s:"205",k:"Yes"},JL:{s:"131",k:"Yes"},CA:{s:"999",k:"Yes"},CZ:{s:"784",k:"Yes"},VN:{s:"738",k:"Yes"},QF:{s:"081",k:"Yes"},AC:{s:"014",k:"Yes"},AA:{s:"001",k:"Yes"},DL:{s:"006",k:"Yes"},UA:{s:"016",k:"Yes"},SU:{s:"020",k:"No"},PK:{s:"214",k:"Yes"},UL:{s:"603",k:"Yes"},ET:{s:"071",k:"Yes"},PR:{s:"079",k:"No"},GA:{s:"126",k:"No"},KE:{s:"180",k:"Yes"},OZ:{s:"988",k:"Yes"},BR:{s:"695",k:"Yes"},MU:{s:"781",k:"Yes"},MH:{s:"232",k:"Yes"},KQ:{s:"706",k:"Yes"},LA:{s:"045",k:"No"},AV:{s:"134",k:"No"},A3:{s:"390",k:"Yes"},SK:{s:"117",k:"No"},OS:{s:"257",k:"Yes"},LO:{s:"080",k:"No"},EI:{s:"053",k:"No"},AT:{s:"147",k:"Yes"},TU:{s:"199",k:"Yes"},AH:{s:"124",k:"Yes"},BG:{s:"997",k:"Yes"},SG:{s:"775",k:"Yes"},PG:{s:"829",k:"No"},HU:{s:"880",k:"No"},SA:{s:"083",k:"No"},IY:{s:"635",k:"Yes"}};
/* carriers to ensure present in the database (deduped by code) */
const AIR_ADD=[
{name:"Gulf Air",code:"GF",icao:"GFA",type:"FSC",country:"Bahrain"},
{name:"Kuwait Airways",code:"KU",icao:"KAC",type:"FSC",country:"Kuwait"},
{name:"Royal Jordanian",code:"RJ",icao:"RJA",type:"FSC",country:"Jordan"},
{name:"Oman Air",code:"WY",icao:"OMA",type:"FSC",country:"Oman"},
{name:"Air Arabia",code:"G9",icao:"ABY",type:"LCC",country:"UAE"},
{name:"Jazeera Airways",code:"J9",icao:"JZR",type:"LCC",country:"Kuwait"},
{name:"SalamAir",code:"OV",icao:"OMS",type:"LCC",country:"Oman"},
{name:"Nile Air",code:"NP",icao:"NIA",type:"FSC",country:"Egypt"},
{name:"Lufthansa",code:"LH",icao:"DLH",type:"FSC",country:"Germany"},
{name:"British Airways",code:"BA",icao:"BAW",type:"FSC",country:"United Kingdom"},
{name:"Air France",code:"AF",icao:"AFR",type:"FSC",country:"France"},
{name:"KLM Royal Dutch Airlines",code:"KL",icao:"KLM",type:"FSC",country:"Netherlands"},
{name:"Swiss International Air Lines",code:"LX",icao:"SWR",type:"FSC",country:"Switzerland"},
{name:"ITA Airways",code:"AZ",icao:"ITY",type:"FSC",country:"Italy"},
{name:"Iberia",code:"IB",icao:"IBE",type:"FSC",country:"Spain"},
{name:"Finnair",code:"AY",icao:"FIN",type:"FSC",country:"Finland"},
{name:"Brussels Airlines",code:"SN",icao:"BEL",type:"FSC",country:"Belgium"},
{name:"TAP Air Portugal",code:"TP",icao:"TAP",type:"FSC",country:"Portugal"},
{name:"Air India",code:"AI",icao:"AIC",type:"FSC",country:"India"},
{name:"Singapore Airlines",code:"SQ",icao:"SIA",type:"FSC",country:"Singapore"},
{name:"Cathay Pacific",code:"CX",icao:"CPA",type:"FSC",country:"Hong Kong"},
{name:"Thai Airways",code:"TG",icao:"THA",type:"FSC",country:"Thailand"},
{name:"All Nippon Airways",code:"NH",icao:"ANA",type:"FSC",country:"Japan"},
{name:"Japan Airlines",code:"JL",icao:"JAL",type:"FSC",country:"Japan"},
{name:"Air China",code:"CA",icao:"CCA",type:"FSC",country:"China"},
{name:"China Southern Airlines",code:"CZ",icao:"CSN",type:"FSC",country:"China"},
{name:"Vietnam Airlines",code:"VN",icao:"HVN",type:"FSC",country:"Vietnam"},
{name:"Qantas",code:"QF",icao:"QFA",type:"FSC",country:"Australia"},
{name:"Air Canada",code:"AC",icao:"ACA",type:"FSC",country:"Canada"},
{name:"American Airlines",code:"AA",icao:"AAL",type:"FSC",country:"USA"},
{name:"Delta Air Lines",code:"DL",icao:"DAL",type:"FSC",country:"USA"},
{name:"United Airlines",code:"UA",icao:"UAL",type:"FSC",country:"USA"},
{name:"Pakistan International Airlines",code:"PK",icao:"PIA",type:"FSC",country:"Pakistan"},
{name:"SriLankan Airlines",code:"UL",icao:"ALK",type:"FSC",country:"Sri Lanka"},
{name:"Ethiopian Airlines",code:"ET",icao:"ETH",type:"FSC",country:"Ethiopia"},
{name:"Philippine Airlines",code:"PR",icao:"PAL",type:"FSC",country:"Philippines"},
{name:"Garuda Indonesia",code:"GA",icao:"GIA",type:"FSC",country:"Indonesia"},
{name:"Riyadh Air",code:"RX",icao:"RXI",type:"FSC",country:"Saudi Arabia"},
{name:"Korean Air",code:"KE",icao:"KAL",type:"FSC",country:"South Korea"},
{name:"Asiana Airlines",code:"OZ",icao:"AAR",type:"FSC",country:"South Korea"},
{name:"EVA Air",code:"BR",icao:"EVA",type:"FSC",country:"Taiwan"},
{name:"China Eastern Airlines",code:"MU",icao:"CES",type:"FSC",country:"China"},
{name:"Hainan Airlines",code:"HU",icao:"CHH",type:"FSC",country:"China"},
{name:"Malaysia Airlines",code:"MH",icao:"MAS",type:"FSC",country:"Malaysia"},
{name:"Bangkok Airways",code:"PG",icao:"BKP",type:"FSC",country:"Thailand"},
{name:"Biman Bangladesh Airlines",code:"BG",icao:"BBC",type:"FSC",country:"Bangladesh"},
{name:"US-Bangla Airlines",code:"BS",icao:"UBG",type:"FSC",country:"Bangladesh"},
{name:"SpiceJet",code:"SG",icao:"SEJ",type:"LCC",country:"India"},
{name:"Kenya Airways",code:"KQ",icao:"KQA",type:"FSC",country:"Kenya"},
{name:"RwandAir",code:"WB",icao:"RWD",type:"FSC",country:"Rwanda"},
{name:"South African Airways",code:"SA",icao:"SAA",type:"FSC",country:"South Africa"},
{name:"LATAM Airlines",code:"LA",icao:"LAN",type:"FSC",country:"Chile"},
{name:"Avianca",code:"AV",icao:"AVA",type:"FSC",country:"Colombia"},
{name:"Aegean Airlines",code:"A3",icao:"AEE",type:"FSC",country:"Greece"},
{name:"Scandinavian Airlines",code:"SK",icao:"SAS",type:"FSC",country:"Sweden"},
{name:"Austrian Airlines",code:"OS",icao:"AUA",type:"FSC",country:"Austria"},
{name:"LOT Polish Airlines",code:"LO",icao:"LOT",type:"FSC",country:"Poland"},
{name:"Aer Lingus",code:"EI",icao:"EIN",type:"FSC",country:"Ireland"},
{name:"Royal Air Maroc",code:"AT",icao:"RAM",type:"FSC",country:"Morocco"},
{name:"Tunisair",code:"TU",icao:"TAR",type:"FSC",country:"Tunisia"},
{name:"Air Algérie",code:"AH",icao:"DAH",type:"FSC",country:"Algeria"},
{name:"Yemenia",code:"IY",icao:"IYE",type:"FSC",country:"Yemen"},
{name:"Wizz Air",code:"W6",icao:"WZZ",type:"LCC",country:"Hungary"},
{name:"easyJet",code:"U2",icao:"EZY",type:"LCC",country:"United Kingdom"},
{name:"Ryanair",code:"FR",icao:"RYR",type:"LCC",country:"Ireland"},
{name:"Vueling",code:"VY",icao:"VLG",type:"LCC",country:"Spain"}
];
const NDC_PROVIDERS=["Amadeus","Travelfusion","Duffel","Babylon","Trip.com","Kiwi"];
const NDC_STATUS=["Active","Pending","Inactive","N/A"];
const NDC_STATUS_COLOR={Active:"#16B364",Pending:"#F79009",Inactive:"#F0453A","N/A":"#9AA1B6"};
const NDC_CONTENT=["NDC","EDIFACT","API","Aggregator","—"];
/* ===== v15 benchmark fields ===== */
const STAGE_PROB={Prospect:.05,Contacted:.1,Qualified:.25,Proposal:.5,Negotiation:.75,Won:1,Lost:0};
const DEMO_DEALS={c_acgc:[450000,"Proposal"],c_neom:[800000,"Qualified"],c_sama:[600000,"Contacted"],c_stcbank:[300000,"Qualified"],c_savvy:[250000,"Proposal"],c_alshaya:[500000,"Contacted"],c_kemya:[350000,"Qualified"],c_alfanar:[200000,"Negotiation"]};
const WIN_REASONS=["—","Price / fees","Service & SLA","Relationship","Corporate fares","Tech / portal","Replaced incumbent","Other"];
const LOSS_REASONS=["—","Price","Lost to incumbent","No budget / on hold","No decision","Competitor fares","Service concerns","Unresponsive","Other"];
const ALLIANCES=["—","Star Alliance","SkyTeam","Oneworld","Unaligned"];
const ALLIANCE_MAP={SV:"SkyTeam",MS:"Star Alliance",SQ:"Star Alliance",TK:"Star Alliance",LH:"Star Alliance",OS:"Star Alliance",LO:"Star Alliance",SN:"Star Alliance",A3:"Star Alliance",NH:"Star Alliance",OZ:"Star Alliance",CA:"Star Alliance",AI:"Star Alliance",ET:"Star Alliance",SK:"Star Alliance",TP:"Star Alliance",BR:"Star Alliance",AC:"Star Alliance",UA:"Star Alliance",AF:"SkyTeam",KL:"SkyTeam",DL:"SkyTeam",AZ:"SkyTeam",MU:"SkyTeam",CZ:"SkyTeam",KE:"SkyTeam",VN:"SkyTeam",KQ:"SkyTeam",RJ:"Oneworld",QR:"Oneworld",BA:"Oneworld",AA:"Oneworld",IB:"Oneworld",CX:"Oneworld",JL:"Oneworld",QF:"Oneworld",UL:"Oneworld",AT:"Oneworld",MH:"Oneworld",AY:"Oneworld",EK:"Unaligned",EY:"Unaligned",FZ:"Unaligned",G9:"Unaligned",J9:"Unaligned",XY:"Unaligned",WY:"Unaligned",GF:"Unaligned",KU:"Unaligned",NP:"Unaligned",F3:"Unaligned",SM:"Unaligned",NE:"Unaligned",PC:"Unaligned",IX:"Unaligned","6E":"Unaligned",PK:"Unaligned",SG:"Unaligned",HU:"Unaligned",RX:"Unaligned",OV:"Unaligned",BG:"Unaligned",BS:"Unaligned",PG:"Unaligned",AH:"Unaligned",TU:"Unaligned",IY:"Unaligned",W6:"Unaligned",U2:"Unaligned",FR:"Unaligned",VY:"Unaligned",EI:"Unaligned",GA:"SkyTeam",PR:"Unaligned",SA:"Star Alliance",LA:"Unaligned",AV:"Star Alliance",WB:"Unaligned"};
const ADM_RISK=["—","Low","Medium","High"];
const PROV_CAPS=["Book","Reissue","Refund","EMD","Seats","Bags","Split PNR"];
const PROV_API=["Healthy","Degraded","Down","—"];
const SETTLEMENTS=["—","BSP","Direct","Virtual card","Wallet","Mixed"];
const PROV_ADD=[{name:"Travelfusion",type:"Aggregator / LCC API"},{name:"Duffel",type:"NDC aggregator"},{name:"Babylon",type:"NDC aggregator"},{name:"Trip.com",type:"OTA / API"},{name:"Kiwi",type:"Aggregator / virtual interlining"}];
function leadScore(b){if(b.scoreOverride!=null&&b.scoreOverride!=="")return +b.scoreOverride;let fit=({Anchor:30,Convert:25,"Re-engage":18,Partner:20,Vendor:15,Dormant:8}[b.category]||15);if(b.isClient)fit=30;const _fk=b.funnelKey||"";if(_fk==="past_invoices"||_fk==="inbound"||_fk==="website_form_b2b"||_fk==="website_form_entity")fit+=10;const stIdx=LEAD_STAGES.indexOf(leadStage(b));let intent=Math.max(0,stIdx)*7;if(b.nextAction||b.nextActionDate)intent+=5;if(leadStage(b)==="Lost")intent=0;const acts=(b.activities||[]).length;let eng=Math.min(20,acts*3);const days=b.lastContact?(Date.now()-b.lastContact)/864e5:999;if(days>30)eng=Math.max(0,eng-8);const val=Math.min(20,Math.round((b.dealValue||b.totalSAR||0)/50000));return Math.max(0,Math.min(100,fit+intent+eng+val));}
function scoreBand(s){return s>=70?{l:"Hot",c:"#F0453A"}:s>=45?{l:"Warm",c:"#FF6B00"}:s>=25?{l:"Cool",c:"#2E90FA"}:{l:"Cold",c:"#9AA1B6"};}
function daysSince(ms){return ms?Math.floor((Date.now()-ms)/864e5):null;}
function leadRisks(b){const r=[];const open=leadStage(b)!=="Won"&&leadStage(b)!=="Lost";if(open&&(b.contacts||[]).length<=1)r.push("Single-threaded");if(open&&!b.champion)r.push("No champion");const ds=daysSince(b.lastContact);if(open&&ds!=null&&ds>14)r.push("Stalled "+ds+"d");if(open&&!b.execSponsor)r.push("No exec sponsor");return r;}
function riskTags(b){return leadRisks(b).map(x=>`<span class="tag" style="background:#F0453A18;color:#F0453A">⚠ ${esc(x)}</span>`).join("");}
function migrate(d){
  d.businesses=d.businesses||[];
  d.businesses.forEach(b=>{
    if(b.assignedTo===undefined)b.assignedTo=b.owner||"";
    if(!b.source){b.source = b.b2c?"Individuals from B2B" : (/Conference|MICE|Event/i.test(b.segment||"")?"Conferences" : (b.isVendor||b.category==="Partner"||b.category==="Vendor")?"Direct outreach" : /Government|Semi/.test(b.segment||"")?"Tender":"Invoice history");}
    if(b.channels===undefined)b.channels=[];
    if(!b.stage)b.stage=b.isClient?"Won":(STATUS_TO_STAGE[b.status]||"Prospect");
    if(b.dealValue===undefined)b.dealValue=0;
    if(b.parentAccount===undefined)b.parentAccount="";
    if(b.champion===undefined)b.champion="";
    if(b.execSponsor===undefined)b.execSponsor=false;
    if(b.competitor===undefined)b.competitor="";
    if(b.winReason===undefined)b.winReason="";
    if(b.lossReason===undefined)b.lossReason="";
    if(b.dueDate===undefined)b.dueDate="";
    if(b.scoreOverride===undefined)b.scoreOverride="";
    if(DEMO_DEALS[b.id]&&!b.dealValue){b.dealValue=DEMO_DEALS[b.id][0];if(leadStage(b)==="Prospect")b.stage=DEMO_DEALS[b.id][1];}
  });
  d.airlines=d.airlines||[];
  d.airlines.forEach(a=>{const c=AIR_CODE[(a.code||"").toUpperCase()];if(c){if(!a.stock)a.stock=c.s;if(a.ksa==null||a.ksa==="")a.ksa=c.k;}if(a.ksa==null||a.ksa==="")a.ksa="—";if(!a.stock)a.stock="—";if(!a.ndc)a.ndc={};NDC_PROVIDERS.forEach(p=>{if(!a.ndc[p])a.ndc[p]={status:"N/A",content:"—",updated:"",notes:""};});
    if(a.alliance===undefined)a.alliance=ALLIANCE_MAP[(a.code||"").toUpperCase()]||"—";
    if(a.codeshare===undefined)a.codeshare="";
    if(a.corporateDeal===undefined)a.corporateDeal=(a.type==="FSC"?"Yes":"No");
    if(a.hubs===undefined)a.hubs="";
    if(a.fleet===undefined)a.fleet="";
    if(a.classes===undefined)a.classes=(a.type==="LCC"?"Y":"Y / J");
    if(a.admRisk===undefined)a.admRisk=(a.type==="LCC"?"Low":"Medium");
    if(a.otp===undefined)a.otp="";
    if(a.saf===undefined)a.saf="—";
    if(a.corpPortal===undefined)a.corpPortal="";
    if(a.ndcVersion===undefined)a.ndcVersion="";
    if(a.ndcEnv===undefined)a.ndcEnv="—";});
  const have=new Set(d.airlines.map(a=>(a.code||"").toUpperCase()).filter(Boolean));
  AIR_ADD.forEach(a=>{if(!have.has(a.code.toUpperCase())){const c=AIR_CODE[a.code.toUpperCase()]||{};d.airlines.push(Object.assign({id:"air_"+a.code.toLowerCase(),source:"GDS (Amadeus / Sabre)",stock:c.s||"—",ksa:c.k||"—",portal:"",contacts:[],adm:"",notes:""},a));have.add(a.code.toUpperCase());}});
  d.airlines.forEach(a=>{if(!a.ndc){a.ndc={};NDC_PROVIDERS.forEach(p=>a.ndc[p]={status:"N/A",content:"—",updated:"",notes:""});}});
  d.ndcProviders=d.ndcProviders||NDC_PROVIDERS.map(p=>({key:p,lastUpdated:"",notes:""}));
  d.vendors=d.vendors||[];
  const vhave=new Set(d.vendors.map(x=>(x.name||"").toLowerCase()));
  PROV_ADD.forEach(p=>{if(!vhave.has(p.name.toLowerCase())){d.vendors.push({id:"v_"+p.name.toLowerCase().replace(/[^a-z]/g,""),name:p.name,type:p.type,source:"NDC / API content",portal:"",contacts:[],adm:"",notes:""});vhave.add(p.name.toLowerCase());}});
  d.vendors.forEach(x=>{if(!x.caps)x.caps={};PROV_CAPS.forEach(c=>{if(x.caps[c]===undefined)x.caps[c]=false;});if(x.contentMix===undefined)x.contentMix="";if(x.settlement===undefined)x.settlement="—";if(x.markup===undefined)x.markup="";if(x.uptime===undefined)x.uptime="";if(x.respTime===undefined)x.respTime="";if(x.supportSLA===undefined)x.supportSLA="";if(x.apiStatus===undefined)x.apiStatus="—";if(x.apiLast===undefined)x.apiLast="";if(x.costPerBooking===undefined)x.costPerBooking="";if(x.accountManager===undefined)x.accountManager="";if(x.renewalDate===undefined)x.renewalDate="";if(x.useFor===undefined)x.useFor="";if(x.incidents===undefined)x.incidents="";});
  d.offers=d.offers||[];
  d.offers.forEach(o=>{if(o.status===undefined)o.status="Draft";if(o.version===undefined)o.version=1;if(o.validUntil===undefined)o.validUntil="";if(o.ttl===undefined)o.ttl="";if(o.linkedLeadId===undefined)o.linkedLeadId="";if(o.policyStatus===undefined)o.policyStatus="Not checked";if(o.policyReason===undefined)o.policyReason="";if(o.approvalStatus===undefined)o.approvalStatus="Not required";if(o.paxAdt===undefined)o.paxAdt=1;if(o.paxChd===undefined)o.paxChd=0;if(o.paxInf===undefined)o.paxInf=0;if(o.cost===undefined)o.cost="";if(o.commission===undefined)o.commission="";if(o.winLoseReason===undefined)o.winLoseReason="";if(o.options===undefined)o.options=[];if(o.bundleMode===undefined)o.bundleMode=false;if(!o.files)o.files=[];(o.options||[]).forEach(op=>{if(!op.items)op.items=[];if(!op.freebies)op.freebies=[];});});
  d.bookings=d.bookings||[];
  if(!d._bkSeed&&d.bookings.length===0){d._bkSeed=true;d.bookings=[
    {id:"bk_1",ref:"BK-1001",leadId:"b_mdd",offerId:"",provider:"Amadeus",status:"Ticketed",date:"2026-05-10",tickets:[{pnr:"X7K2QP",eticket:"065-2401111111",pax:"Mohammed Almasar",route:"RUH-LHR-RUH",cls:"J",fare:9800,taxes:1200,airline:"Saudia"}],hotels:[],visas:[],transfers:[],extras:[],totalCost:10500,totalSale:12000,invoiceId:"inv_1",files:[],notes:"MDD executive — London."},
    {id:"bk_2",ref:"BK-1002",leadId:"b_maaden",offerId:"",provider:"Sabre",status:"Ticketed",date:"2026-05-12",tickets:[{pnr:"M3R8TT",eticket:"176-2402222222",pax:"Saud Alkahtani",route:"DMM-DXB-DMM",cls:"Y",fare:2100,taxes:400,airline:"Emirates"}],hotels:[],visas:[],transfers:[],extras:[],totalCost:2300,totalSale:2750,invoiceId:"inv_2",files:[],notes:""},
    {id:"bk_3",ref:"BK-1003",leadId:"c_acgc",offerId:"",provider:"Amadeus",status:"Confirmed",date:"2026-05-20",tickets:[{pnr:"P9L1ZK",eticket:"065-2403333333",pax:"Barath Kumar",route:"RUH-CAI",cls:"Y",fare:1500,taxes:300,airline:"Saudia"}],hotels:[],visas:[{vendor:"Direct Visa",country:"Egypt",cost:200,pax:1}],transfers:[],extras:[],totalCost:1700,totalSale:2000,invoiceId:"",files:[],notes:""},
    {id:"bk_4",ref:"BK-1004",leadId:"b_mdd",offerId:"",provider:"Travelfusion",status:"Ticketed",date:"2026-05-22",tickets:[{pnr:"KZ44MN",eticket:"235-2404444444",pax:"Omar Aldhalaan",route:"RUH-IST-RUH",cls:"Y",fare:1800,taxes:250,airline:"Turkish Airlines"}],hotels:[{vendor:"RateHawk",name:"Hilton Istanbul",nights:3,cost:1200}],visas:[],transfers:[],extras:[],totalCost:3100,totalSale:3700,invoiceId:"",files:[],notes:""}
  ];}
  d.invoices=d.invoices||[];
  if(!d._invSeed&&d.invoices.length===0){d._invSeed=true;d.invoices=[
    {id:"inv_1",number:"INV-5001",clientId:"b_mdd",date:"2026-05-11",currency:"SAR",status:"Paid",items:[{desc:"Air ticket RUH-LHR-RUH (Saudia, J) — Mohammed Almasar",bookingId:"bk_1",amount:12000}],total:12000,files:[],notes:""},
    {id:"inv_2",number:"INV-5002",clientId:"b_maaden",date:"2026-05-13",currency:"SAR",status:"Issued",items:[{desc:"Air ticket DMM-DXB (Emirates) — Saud Alkahtani",bookingId:"bk_2",amount:2750}],total:2750,files:[],notes:""}
  ];}
  d.bookings.forEach(b=>{["tickets","hotels","visas","transfers","extras","files"].forEach(k=>{if(!b[k])b[k]=[];});if(b.totalCost===undefined)b.totalCost=0;if(b.totalSale===undefined)b.totalSale=0;if(b.status===undefined)b.status="Confirmed";});
  d.invoices.forEach(i=>{if(!i.items)i.items=[];if(!i.files)i.files=[];if(i.total===undefined)i.total=0;if(i.status===undefined)i.status="Draft";});
}
function leadStatus(b){return b.status||(b.isClient||b.isVendor?"Won":"To contact");}
function fmtDate(ms){if(!ms)return"—";return new Date(ms).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}
function fmtAgo(ms){if(!ms)return"";const h=(Date.now()-ms)/3600e3;if(h<1)return Math.max(1,Math.round(h*60))+"m ago";if(h<24)return Math.round(h)+"h ago";return Math.round(h/24)+"d ago";}
function fmtTime(ms){return new Date(ms).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
function pdLink(b){const cs=b.contacts||[];let ph="";for(const c of cs){if(c.phone){ph=String(c.phone).replace(/[^0-9+]/g,"");break;}}if(ph){if(ph.indexOf("00")===0)ph="+"+ph.slice(2);else if(ph.indexOf("05")===0)ph="+966"+ph.slice(1);else if(ph.indexOf("966")===0)ph="+"+ph;else if(ph.indexOf("5")===0&&ph.length===9)ph="+966"+ph;return "https://payments.directksa.com/en/admin/invoices?customer_identifier="+encodeURIComponent(ph);}const em=(cs.find(c=>c.email)||{}).email;return "https://payments.directksa.com/en/admin/invoices?customer_identifier="+encodeURIComponent(em||b.name);}

/* ================= STORE ================= */
const KEY="directBusinessData_v29";
let DB=load();try{migrate(DB);save();}catch(e){console.warn('migrate fail',e);}
function load(){try{const r=localStorage.getItem(KEY);if(r)return JSON.parse(r);const prev=localStorage.getItem("directBusinessData_v24")||localStorage.getItem("directBusinessData_v22")||localStorage.getItem("directBusinessData_v21")||localStorage.getItem("directBusinessData_v20")||localStorage.getItem("directBusinessData_v19")||localStorage.getItem("directBusinessData_v18")||localStorage.getItem("directBusinessData_v17")||localStorage.getItem("directBusinessData_v16")||localStorage.getItem("directBusinessData_v15");if(prev)return JSON.parse(prev);}catch(e){}return JSON.parse(JSON.stringify(SEED));}
function save(){try{localStorage.setItem(KEY,JSON.stringify(DB));window.__quotaWarned=false;}catch(e){if(!window.__quotaWarned){window.__quotaWarned=true;console.warn("Storage full - changes kept in memory only. Export a JSON backup and clear old data.",e);try{if(typeof toast==="function")toast("Storage full - export a backup! Changes not saved to disk.");}catch(_){}}}}
function resetData(){if(confirm("Reset all data to the seeded version? Edits will be lost.")){DB=JSON.parse(JSON.stringify(SEED));save();render();}}
function exportData(){const b=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="direct-business-data.json";a.click();}
function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{DB=JSON.parse(r.result);save();render();alert("Imported.");}catch(e){alert("Invalid file.");}};r.readAsText(f);}
const money=n=>(n||0).toLocaleString("en-US")+" SAR";
const moneyShort=n=>{n=n||0;if(n>=1e6)return(n/1e6).toFixed(2)+"M";if(n>=1e3)return Math.round(n/1e3)+"k";return""+n;};
const uid=p=>p+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function val(id){const e=document.getElementById(id);return e?e.value:"";}
function initials(s){return (s||"?").replace(/[^A-Za-z؀-ۿ ]/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"·";}
const AVA=["#FF6B00","#2E90FA","#16B364","#7A5AF8","#15B8A6","#F79009","#EC4899"];
function avaColor(id){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))%AVA.length;return AVA[h];}

/* ================= NAV ================= */
const VIEWS=[{id:"today",label:"Today",ic:IC.dash,primary:true},{id:"leads",label:"Leads",ic:IC.leads,primary:true},{id:"clients",label:"Clients",ic:IC.leads,primary:true},{id:"bookings",label:"Bookings",ic:IC.ops,primary:false},{id:"invoices",label:"Invoices",ic:IC.vend,primary:false},{id:"tickets",label:"Tickets",ic:IC.sop,primary:false},{id:"offers",label:"Proposals",ic:IC.sop,primary:true},{id:"airlines",label:"Airlines",ic:IC.ops,primary:false},{id:"vendors",label:"Providers & GDS",ic:IC.vend,primary:false},{id:"sopsla",label:"SOPs & SLAs",ic:IC.sop,primary:true},{id:"sops",label:"SOP Library",ic:IC.sop,primary:false},{id:"slas",label:"Service Levels",ic:IC.sla,primary:false},{id:"ops",label:"Operations",ic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/></svg>',primary:false},{id:"reports",label:"Reports",ic:IC.sop,primary:true}];
let current="today";
function toggleSide(){const s=document.querySelector(".side"),sc=document.getElementById("scrim");if(!s)return;const open=s.classList.toggle("open");if(sc)sc.classList.toggle("show",open);}
function closeSide(){const s=document.querySelector(".side"),sc=document.getElementById("scrim");if(s)s.classList.remove("open");if(sc)sc.classList.remove("show");}
function buildNav(){const n=document.getElementById("nav");n.innerHTML="";VIEWS.forEach(v=>{const b=document.createElement("button");b.innerHTML=v.ic+"<span>"+v.label+"</span>";b.className=v.id===current?"active":"";b.onclick=()=>{current=v.id;openLead=null;openSup=null;openOffer=null;openBooking=null;openInvoice=null;supView="detail";leadDetailView="detail";render();window.scrollTo(0,0);closeSide();};n.appendChild(b);});}
const TITLES={reports:["Reports","Objectives 2026 - achievements - KPI progress - report generator"],sopsla:["SOPs & SLAs","Procedures and service-level standards"],dashboard:["Dashboard","Your commercial command center"],leads:["Leads","Funnels · one business · many contacts · assignable pipeline"],clients:["Clients","Won accounts — your managed book of business"],bookings:["Bookings","Every fulfilment — tickets, hotels, visas, transfers · linked to client, offer & invoice"],invoices:["Invoices","Billing — line items linked to bookings & tickets"],tickets:["Tickets","Ticket register — every PNR / e-ticket across all bookings"],airlines:["Airlines","Carrier accounts — sourcing, portals, ADMs & contacts"],vendors:["Providers & GDS","Suppliers — sourcing, logins, ADMs, process & contacts"],sops:["SOP Library","Saudi-market procedures, elevated to global standard"],slas:["Service Levels","Direct Business vs the market vs the industry whales"],ops:["Operations","Request intake → fulfilment → handover"],offers:["Proposals","Every proposal — price offers, tenders, technical bids — linked to its client"]};

/* ================= CHARTS (inline SVG) ================= */
function donut(segs){const tot=segs.reduce((s,x)=>s+x.v,0)||1;let a=-Math.PI/2;const R=52,r=34,cx=64,cy=64;let p="";segs.forEach(s=>{const ang=s.v/tot*Math.PI*2;const a2=a+ang;const x1=cx+R*Math.cos(a),y1=cy+R*Math.sin(a),x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);const xi2=cx+r*Math.cos(a2),yi2=cy+r*Math.sin(a2),xi1=cx+r*Math.cos(a);const yi1=cy+r*Math.sin(a);const lg=ang>Math.PI?1:0;p+=`<path d="M${x1} ${y1} A${R} ${R} 0 ${lg} 1 ${x2} ${y2} L${xi2} ${yi2} A${r} ${r} 0 ${lg} 0 ${xi1} ${yi1} Z" fill="${s.c}"/>`;a=a2;});return `<svg viewBox="0 0 128 128" width="128" height="128">${p}<text x="64" y="60" text-anchor="middle" font-size="20" font-weight="800" fill="#13151E">${tot}</text><text x="64" y="76" text-anchor="middle" font-size="9" fill="#7A8198" letter-spacing="1">TOTAL</text></svg>`;}

/* ================= RENDER ================= */
function render(){buildNav();const v=document.getElementById("view");document.getElementById("vTitle").textContent=TITLES[current][0];document.getElementById("vSub").textContent=TITLES[current][1];
  if(typeof applyLang==='function')applyLang();
  if(typeof renderTopExtras==='function')renderTopExtras();
  const map={dashboard:renderDash,leads:renderLeads,clients:renderClients,bookings:renderBookings,invoices:renderInvoices,tickets:renderTickets,airlines:(vv)=>renderSuppliers(vv,'air'),vendors:(vv)=>renderSuppliers(vv,'prov'),sops:renderSops,slas:renderSlas,sopsla:renderSopSla,reports:(typeof renderReports==="function"?renderReports:renderDash),ops:(vv)=>{renderOps(vv);vv.insertAdjacentHTML("afterbegin","<div style=\"margin-bottom:12px\"><button class=\"btn ghost sm\" onclick=\"gotoProjects()\">Projects board</button></div>");},offers:renderOffers,activity:(typeof renderActivity==='function'?renderActivity:renderDash),archive:(typeof renderArchive==='function'?renderArchive:renderDash)};
  (map[current]||renderDash)(v);}

function renderDash(v){
  const B=DB.businesses;const clients=B.filter(b=>b.isClient);const convert=B.filter(b=>b.category==="Convert");const vendors=B.filter(b=>b.isVendor);
  const totalVal=B.reduce((s,b)=>s+(b.totalSAR||0),0);const convertVal=convert.reduce((s,b)=>s+(b.totalSAR||0),0);
  const reqMargin=(DB.requests||[]).reduce((s,r)=>s+((+r.sell||0)-(+r.cost||0)),0);const reqSell=(DB.requests||[]).reduce((s,r)=>s+(+r.sell||0),0);
  const segs=CATEGORIES.map(c=>({nm:c,v:B.filter(b=>b.category===c).length,c:CAT_COLOR[c]})).filter(x=>x.v);
  const top=B.slice().filter(b=>!b.isVendor).sort((a,b)=>(b.totalSAR||0)-(a.totalSAR||0)).slice(0,6);
  const mx=top.length?top[0].totalSAR:1;
  const funnel=[{l:"All businesses",v:B.length,c:"#13151E"},{l:"Conversion targets",v:convert.length,c:"#FF6B00"},{l:"Existing clients",v:clients.length,c:"#16B364"}];
  const fmax=B.length||1;
  v.innerHTML=`
  <div class="hero">
    <h2>Welcome back, ${(typeof me==='function'?me():'').split(' ')[0]||'team'}</h2>
    <p>Every business you've ever billed — clients, warm conversion targets, study-abroad commission vendors and the businesses hidden in B2C invoices — in one pipeline, ready to work.</p>
    <div class="chips">
      <div class="chip"><div class="v">${B.length}</div><div class="l">Businesses</div></div>
      <div class="chip"><div class="v">${money(totalVal).replace(' SAR','')}</div><div class="l">SAR lifetime billed</div></div>
      <div class="chip"><div class="v">${convert.length}</div><div class="l">To convert</div></div>
      <div class="chip"><div class="v">${DB.sops.length+DB.sopsWhale.length}</div><div class="l">SOPs</div></div>
    </div>
  </div>
  <div class="kpis">
    ${kpi(IC.leads,'var(--blue)','var(--blue-bg)','Total businesses',B.length,'in the pipeline','up')}
    ${kpi(IC.star,'var(--green)','var(--green-bg)','Existing clients',clients.length,'already onboarded','up')}
    ${kpi(IC.target,'var(--orange)','var(--orange-bg,#FEF1E6)','Conversion targets',convert.length,money(convertVal).replace(' SAR',' SAR billed'),'up')}
    ${kpi(IC.box,'var(--violet)','var(--violet-bg)','Vendors / partners',vendors.length,'commission & supply','flat')}
    ${kpi(IC.money,'var(--green)','var(--green-bg)','Booked margin',moneyShort(reqMargin)+' SAR',moneyShort(reqSell)+' SAR request pipeline','up')}
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-head"><div><h3>Top relationships by lifetime value</h3><div class="ch-sub">Excludes commission vendors</div></div></div>
      ${top.map(b=>`<div class="hbar" style="cursor:pointer" onclick="openLeadFn('${b.id}')"><div class="nm" title="${esc(b.name)}">${esc(b.name)}</div><div class="track"><div class="fill" style="width:${Math.max(5,(b.totalSAR/mx)*100)}%"></div></div><div class="vl">${moneyShort(b.totalSAR)}</div></div>`).join("")}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Pipeline by category</h3><div class="ch-sub">${B.length} businesses</div></div></div>
      <div style="display:flex;gap:18px;align-items:center">
        <div>${donut(segs)}</div>
        <div class="legend" style="flex:1">${segs.map(s=>`<div class="it"><span class="dot" style="background:${s.c}"></span><span class="nm">${s.nm}</span><span class="vl">${s.v}</span></div>`).join("")}</div>
      </div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <h3>Conversion funnel</h3><div class="ch-sub">From every billed business down to active clients</div>
      <div class="funnel">${funnel.map(f=>`<div class="st"><div class="lab">${f.l}</div><div class="bar" style="width:${Math.max(22,(f.v/fmax)*100)}%;background:${f.c}">${f.v}</div></div>`).join("")}</div>
    </div>
    <div class="card" style="background:linear-gradient(135deg,#1C1E2B,#3C4050);color:#fff;border:0">
      <h3 style="color:#fff">Standard of service</h3><div class="ch-sub" style="color:#AEB4CC">How Direct Business is positioned</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px">
        <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:14px"><div style="font-size:24px;font-weight:800">${DB.slas.filter(s=>s.rank==='beat').length}/${DB.slas.length}</div><div style="font-size:11px;color:#AEB4CC;margin-top:3px">SLAs that BEAT the market</div></div>
        <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:14px"><div style="font-size:24px;font-weight:800">${DB.sopsWhale.length}</div><div style="font-size:11px;color:#AEB4CC;margin-top:3px">Whale-grade SOPs added</div></div>
      </div>
      <p style="color:#AEB4CC;font-size:12.5px;margin:14px 0 0;line-height:1.6">Built on the Saudi-market desk playbook, elevated with the operating model of Amex GBT, BCD, CWT & Navan — duty of care, 24/7, proactive disruption, QA and account reviews.</p>
    </div>
  </div>`;
}
function kpi(ic,col,bg,l,v,s,tr){return `<div class="kpi"><div class="ic" style="background:${bg};color:${col}">${ic}</div><div class="trend ${tr}">${tr==='up'?'● live':'—'}</div><div class="l">${l}</div><div class="v">${v}</div><div class="ch-sub" style="margin:4px 0 0">${s}</div></div>`;}

/* ----- Global search & cross-module actions ----- */
function runGlobalSearch(q){
  q=(q||'').toLowerCase().trim();const box=document.getElementById('gres');if(!box)return;
  if(!q){box.style.display='none';box.innerHTML='';return;}
  const res=[];
  DB.businesses.forEach(b=>{if((b.name+' '+(b.nameAr||'')+' '+(b.segment||'')+' '+(b.contacts||[]).map(c=>c.name+' '+c.email+' '+c.phone).join(' ')).toLowerCase().includes(q))res.push({t:'Lead',label:b.name,sub:b.segment||'',go:()=>{openSup=null;openLead=b.id;current='leads';render();}});});
  (DB.requests||[]).forEach(r=>{if((r.client+' '+r.service+' '+r.detail+' '+(r.owner||'')+' '+(r.pnr||'')).toLowerCase().includes(q))res.push({t:'Request',label:r.client+' · '+r.service,sub:r.stage,go:()=>{openLead=null;openSup=null;current='ops';render();editRequest(r.id);}});});
  (DB.airlines||[]).forEach(a=>{if((a.name+' '+(a.code||'')+' '+(a.source||'')).toLowerCase().includes(q))res.push({t:'Airline',label:a.name+(a.code?' ('+a.code+')':''),sub:a.source||'',go:()=>{openLead=null;supKind='air';openSup=a.id;current='airlines';render();}});});
  DB.vendors.forEach(v=>{if((v.name+' '+(v.type||'')+' '+(v.source||'')).toLowerCase().includes(q))res.push({t:'Provider',label:v.name,sub:v.type||'',go:()=>{openLead=null;supKind='prov';openSup=v.id;current='vendors';render();}});});
  DB.sops.concat(DB.sopsWhale).forEach(s=>{if((s.title+' '+(s.purpose||'')+' '+(s.body||'')).toLowerCase().includes(q))res.push({t:'SOP',label:s.title,sub:s.code,go:()=>{openLead=null;openSup=null;current='sops';render();setTimeout(()=>{const d=[...document.querySelectorAll('.sop')].find(x=>x.querySelector('.ti')&&x.querySelector('.ti').textContent===s.title);if(d){d.open=true;d.scrollIntoView({block:'center'});}},60);}});});
  window._gres=res;
  box.innerHTML=res.length?res.slice(0,14).map((r,i)=>`<div class="gres-item" onmousedown="gGo(${i})"><span class="gres-t">${esc(r.t)}</span><span class="gres-l">${esc(r.label)}</span><span class="gres-s">${esc(r.sub)}</span></div>`).join(''):('<div class="gres-item" style="color:var(--muted)">No matches for “'+esc(q)+'”</div>');
  box.style.display='block';
}
function gGo(i){const r=(window._gres||[])[i];const box=document.getElementById('gres');if(box)box.style.display='none';const inp=document.getElementById('gsearch');if(inp)inp.value='';if(r&&r.go){r.go();window.scrollTo(0,0);}}
function advanceReq(id,ev){if(ev)ev.stopPropagation();const r=(DB.requests||[]).find(x=>x.id===id);if(!r)return;const i=STAGES.indexOf(r.stage);if(i>=0&&i<STAGES.length-1){r.stage=STAGES[i+1];save();render();}}
function newRequestForLead(id){const b=getLead(id);openLead=null;current='ops';render();editRequest();setTimeout(()=>{const el=document.getElementById('r_client');if(el)el.value=b?b.name:'';},40);}
/* drag & drop (pipeline + leads board) */
let _drag=null;
function dragStart(e,kind,id){_drag={kind:kind,id:id};if(e.dataTransfer)e.dataTransfer.effectAllowed='move';}
function allowDrop(e,el){e.preventDefault();if(el)el.classList.add('drop');}
function leaveDrop(el){if(el)el.classList.remove('drop');}
function dropOn(e,kind,key,el){e.preventDefault();if(el)el.classList.remove('drop');if(!_drag||_drag.kind!==kind){_drag=null;return;}
  if(kind==='req'){const r=(DB.requests||[]).find(x=>x.id===_drag.id);if(r&&r.stage!==key)r.stage=key;}
  else if(kind==='lead'){const b=getLead(_drag.id);if(b){if(leadGroup==='stage'){b.stage=key;b.status=key;if(key==='Won')b.isClient=true;}else if(leadGroup==='source')b.source=key;else b.category=key;}}
  _drag=null;save();render();}

