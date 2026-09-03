import http from 'http'; import fs from 'fs'; import url from 'url';
/* Which copy of the app to serve. Defaults to the repo this qa folder lives in, so the
   probe always tests the code beside it — not a stale checkout somewhere else. */
import { fileURLToPath } from 'url';
const APP=process.env.APP_DIR || fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/,'');
const UMD='/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js';
const UID='11111111-1111-1111-1111-111111111111';
const now=Math.floor(Date.now()/1000);
const SESSION={access_token:'header.'+Buffer.from(JSON.stringify({sub:UID,email:'test@directksa.com',role:'authenticated',exp:now+3600})).toString('base64url')+'.sig',
  token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'refresh-abc',
  user:{id:UID,aud:'authenticated',role:'authenticated',email:'test@directksa.com',email_confirmed_at:'2026-08-08T00:00:00Z',
        app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'QA Test Account'},created_at:'2026-08-08T00:00:00Z'}};
const STAGES=['new','contacted','in_discussion','proposal','won','lost','on_hold'];
const biz=[...Array(60)].map((_,i)=>({id:'b'+i,legacy_id:'L'+i,name:'Test Company '+i,name_ar:'شركة تجريبية '+i,source:'Import',
  stage:STAGES[i%7],status:'active',category:i%3?'Corporate':'Partner',segment:'MICE / Events',assigned_to:'QA Test Account',
  account_manager:'QA Test Account',tier:i%2?'A':'B',entity_type:'LLC',legal_name:'Test Company '+i+' LLC',cr_vat:'30012345678'+i,
  payment_terms:'Net 30',credit_limit:50000,contract_start:'2026-01-01',contract_end:'2026-12-31',contract_scope:'Air + Hotel',
  contract_sla:'24h',next_review:'2026-09-01',total_sar:12000+i*37,website:'https://example.com',corp_email_flag:'yes',
  is_client:i%4===0,converted_date:i%4===0?'2026-03-01':null,direct_client_id:i===0?'95':null,channels:[],prefs:{},airline_deals:[],pricing:[],notes:'Seed row',
  created_at:'2026-06-0'+((i%9)+1)+'T10:00:00Z',updated_at:'2026-08-01T10:00:00Z',raw:{},verification_source:'manual',
  needs_manual_confirmation:i%11===0,confirmation_reason:i%11===0?'No website found':null,confirmed_by:null,confirmed_at:null,
  scrub_run_id:null,funnel_id:null,funnel_details:i<3?{event_name:'Event 0'}:{},stage_legacy:null,next_action_date:'2026-08-20',next_action_note:'Follow up',
  lost_reason:null,archived_at:null,archived_by:null}));
// Reference data lives in the workspace blob (DB.airlines / DB.vendors), not in the `airlines` /
// `providers` tables below (the app never reads those). Seeded 2026-09-02 (round 19) because the
// blob used to carry none — the Airlines / Providers & GDS drill-downs had never rendered a row in
// the harness. Synthetic carriers and providers with every field the cards display; no real
// contract terms, logins or contacts.
const NDC_SRC=["Amadeus","Travelfusion","Duffel","Babylon","Trip.com","Kiwi"];
const ndcOf=(act,pend)=>{const o={};NDC_SRC.forEach((p,i)=>{o[p]={status:i<act?'Active':i<act+pend?'Pending':'Inactive',content:i<act?'Full NDC content':'—',updated:'2026-07-1'+(i%9),notes:i<act?'Live via '+p:''};});return o;};
const SEED_AIRLINES=[
  {id:'air_qa1',name:'QA National Carrier',code:'Q1',icao:'QAN',stock:'901',type:'FSC',country:'Saudi Arabia',ksa:'Yes',ticketingAuthority:'Authorized (issue via BSP)',alliance:'SkyTeam',admRisk:'Low',hubs:'RUH, JED',gds:'Amadeus, Sabre',providers:'Amadeus NDC',source:'GDS + NDC',payment:'BSP',ndc:ndcOf(3,1),voidRule:'Same-day, before 23:59 local',reissueRule:'Fare diff + 150 SAR',refundRule:'Per fare rules; 300 SAR penalty',corporateDeal:'Yes',saf:'Yes',otp:'84%',portal:'https://example.com/agents',contacts:[{name:'Sales Desk',role:'Agency sales',email:'sales@example.com',phone:'+966 11 000 0000'}],notes:'Seed carrier — full profile.'},
  {id:'air_qa2',name:'QA Gulf Connect',code:'Q2',icao:'QGC',stock:'902',type:'FSC',country:'UAE',ksa:'Yes',ticketingAuthority:'Authorized (issue via BSP)',alliance:'Star Alliance',admRisk:'Medium',hubs:'DXB',gds:'Amadeus',providers:'Travelfusion',source:'GDS',payment:'BSP',ndc:ndcOf(1,2),voidRule:'Same-day',reissueRule:'Fare diff + penalty',refundRule:'Per fare rules',corporateDeal:'No',saf:'No',otp:'79%',contacts:[],notes:''},
  {id:'air_qa3',name:'QA Budget Wings',code:'Q3',icao:'QBW',stock:'903',type:'LCC',country:'Saudi Arabia',ksa:'No',ticketingAuthority:'No authority - TARGET',alliance:'—',admRisk:'High',hubs:'DMM, RUH',gds:'—',providers:'Travelfusion, Kiwi',source:'Direct connect',payment:'card / tfPay',ndc:ndcOf(0,1),voidRule:'No void — credit shell only',reissueRule:'Change fee + fare diff',refundRule:'Non-refundable',lccRefundTo:'Airline wallet / credit shell',corporateDeal:'No',saf:'No',otp:'71%',contacts:[{name:'B2B Support',role:'Trade desk',email:'trade@example.com',phone:''}],notes:''},
  {id:'air_qa4',name:'QA Oneworld Link',code:'Q4',icao:'QOL',stock:'904',type:'FSC',country:'Qatar',ksa:'Yes',ticketingAuthority:'Authorized (issue via BSP)',alliance:'Oneworld',admRisk:'Low',hubs:'DOH',gds:'Sabre',providers:'Duffel',source:'GDS + NDC',payment:'BSP',ndc:ndcOf(2,0),corporateDeal:'Yes',saf:'Yes',otp:'88%',contacts:[],notes:''},
  {id:'air_qa5',name:'QA Empty Profile',code:'Q5',type:'FSC',country:'',ksa:'',contacts:[],notes:''}];
const SEED_VENDORS=[
  {id:'ven_qa1',name:'QA Global GDS',type:'GDS',source:'Direct GDS feed',payment:'Monthly settlement',terms:'Net 30',sla:'99.5% uptime',process:'Book in the GDS, ticket via BSP, ADM disputes within 14 days.',adm:'ADM policy: dispute within 14 days via the ADM portal.',portal:'https://example.com/gds',adminPortal:'https://example.com/gds/adm',login:'qa-agency',caps:{Book:true,Reissue:true,Refund:true,EMD:true,Seats:true,Bags:false,'Split PNR':true},apiStatus:'Healthy',uptime:'99.7%',respTime:'420 ms',costPerBooking:'1.20 USD',settlement:'BSP',markup:'Commission 1%',supportSLA:'4h',accountManager:'Seed Manager',renewalDate:'2027-01-01',useFor:'Full-service carriers',contentMix:'FSC + rail',incidents:'2026-06-03 — 40 min outage, resolved.',contacts:[{name:'Support Line',role:'24/7 desk',email:'support@example.com',phone:'+44 20 0000 0000'}],notes:'Seed provider — full profile.'},
  {id:'ven_qa2',name:'QA LCC Aggregator',type:'Aggregator',source:'Direct connect to LCCs',payment:'Prepaid wallet',terms:'',sla:'',process:'',adm:'',portal:'https://example.com/lcc',login:'',caps:{Book:true,Reissue:false,Refund:false,EMD:false,Seats:true,Bags:true,'Split PNR':false},apiStatus:'Degraded',uptime:'97.1%',respTime:'900 ms',costPerBooking:'0.80 USD',settlement:'Wallet',markup:'Markup 2%',supportSLA:'24h',accountManager:'',renewalDate:'',useFor:'Low-cost carriers',contentMix:'LCC',incidents:'',contacts:[],notes:''},
  {id:'ven_qa3',name:'QA Hotel Bedbank',type:'Bedbank',source:'Hotel API',payment:'Credit line',caps:{},apiStatus:'Down',contacts:[],notes:''},
  {id:'ven_qa4',name:'QA Empty Provider',type:'',source:'',contacts:[]}];
// SOPs / service levels / sync events also live in the blob (live: 12 / 14 / 14 rows) and the harness
// had none — seeded 2026-09-02 (round 20) so the SOP library, the Service Levels table and the Sync
// page render rows in QA. Synthetic wording; nothing copied from the real procedures.
const SEED_SOPS=[
  {id:'sop_qa1',code:'SOP-01',title:'QA Ticket issuance check',purpose:'Issue only after fare rules are read.',cmd:'',body:'Read fare rules, confirm TTL, issue, file the PNR.',market:'Issue on request.',edge:'Read rules first, every time.'},
  {id:'sop_qa2',code:'SOP-02',title:'QA Void window handling',purpose:'Never miss the void cut-off.',cmd:'TRDC/L1',body:'Same-day void before cut-off; otherwise refund path.',market:'Manual reminder.',edge:'Cut-off alarm on the desk.'},
  {id:'sop_qa3',code:'SOP-03',title:'QA Hotel confirmation',purpose:'Confirm every hotel booking in writing.',cmd:'',body:'Send the confirmation and file it on the request.',market:'—',edge:'Written confirmation on file.'}];
const SEED_SOPS_WHALE=[
  {id:'sopw_qa1',code:'EXT-01',title:'QA Proactive disruption watch',purpose:'Call the traveller before they call us.',cmd:'',body:'Watch schedule changes; rebook and inform within the hour.',market:'Reactive.',edge:'Proactive.'},
  {id:'sopw_qa2',code:'EXT-02',title:'QA Duty of care log',purpose:'Know where every traveller is.',cmd:'',body:'Keep the traveller location log current per trip.',market:'—',edge:'Live log.'}];
const SEED_SLAS=[
  {id:'sla_qa1',event:'QA Quote turnaround',direct:'2 hours',market:'24 hours',whale:'1 hour',rank:'beat'},
  {id:'sla_qa2',event:'QA Ticket issuance',direct:'30 minutes',market:'Same day',whale:'15 minutes',rank:'beat'},
  {id:'sla_qa3',event:'QA Refund processing',direct:'7 days',market:'7 days',whale:'3 days',rank:'meet'},
  {id:'sla_qa4',event:'QA Disruption response',direct:'1 hour',market:'Next business day',whale:'30 minutes',rank:'beat'}];
const SEED_SYNC_EVENTS=[...Array(6)].map((_,i)=>({id:'se_qa'+i,ts:Date.parse('2026-08-2'+i+'T09:00:00Z'),source:['payments','amadeus','mail'][i%3],dir:i%2?'out':'in',result:i===4?'failed':'success',entity:i%2?'invoice':'booking',entityId:'',note:i===4?'QA seed — one failed pull':'QA seed — routine pull'}));
const BLOB={schemaVersion:24,meta:{},settings:{lang:'en',currency:'SAR'},agency:{name:'Direct'},recents:[],audit:[],
  businesses:[],airlines:SEED_AIRLINES,vendors:SEED_VENDORS,ndcProviders:[],bookings:[],invoices:[],offers:[],requests:[],projects:[],sops:SEED_SOPS,slas:SEED_SLAS,
  sopsWhale:SEED_SOPS_WHALE,syncEvents:SEED_SYNC_EVENTS,templateLibrary:[],bundleTemplates:[],travelerProfiles:[],serviceFeePricing:[],integrations:{},
  _bkSeed:1,_cfMergeV3:1,_invSeed:1,_oldCustMerged:1,_v20seed:1,_v21reconciled:1,_v22migrated:1,_v23migrated:1,_v24migrated:1};
const TABLES={
  businesses:biz,
  contacts:[...Array(20)].map((_,i)=>({id:'c'+i,business_id:'b'+i,name:'Contact '+i,role:'Manager',email:'c'+i+'@example.com',phone:'+96650000000'+i,verification_source:'manual',needs_manual_confirmation:false,confirmation_reason:null,confirmed_by:null,confirmed_at:null,meta:{},source:'import'})),
  activities:[...Array(10)].map((_,i)=>({id:'a'+i,business_id:'b'+i,type:'note',note:'Activity '+i,by_user:'QA',at:'2026-08-01T10:00:00Z'})),
  app_users:[{id:UID,email:'test@directksa.com',full_name:'QA Test Account',role:'admin',active:true,created_at:'2026-08-08T00:00:00Z',must_change_password:false,allowed_pages:null,page_access:null},
    {id:'u-assem',email:'assem.alsweed@directksa.com',full_name:'Assem Alsweed',role:'team_member',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:true,allowed_pages:['today','leads','clients']},
    {id:'u-fin',email:'finance.person@directksa.com',full_name:'Finance Person',role:'operations',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:false,allowed_pages:['today','finance']},
    {id:'u-off',email:'switched.off@directksa.com',full_name:'Switched Off',role:'viewer',active:false,created_at:'2026-08-09T00:00:00Z',must_change_password:false,allowed_pages:['today','reports']}],
  app_state:[{id:1,data:BLOB,updated_at:'2026-08-08T13:52:37Z',updated_by:'test@directksa.com'}],
  funnels:[{id:'f1',key:'default',name_en:'Default',name_ar:'افتراضي',color:'orange',sort_order:1,active:true,field_template:[],created_at:null,updated_at:null}],
  finance_invoices:[...Array(15)].map((_,i)=>{const _svc=['Flights','Hotels','Visa','Support Services','Packages'][i%5];const _mo=['January','February','March','April','May','June'][i%6];const _q='Q'+(Math.floor((i%6)/3)+1);const _tot=5000+i*777;const _cost=_svc==='Support Services'?0:Math.round(_tot*0.88);/* 2026-09-02 (round 38): this fixture used to store revenue = total − cost and profit = revenue,
       which the live database could never produce. The trigger finance_derive_fields defines
       revenue = total − wallet and profit = revenue − cost, and 12 of these 17 rows broke the
       first rule while 13 broke the second. The Performance tiles then showed a Cost LARGER
       than Revenue — which reads as an app bug and is a fixture bug. Every finance probe in
       the harness was asserting against numbers no real invoice could have. */
    const _wal=0;const _rev=_tot-_wal;const _prof=_rev-_cost;return {id:'i'+i,invoice_no:'11636'+(1000+i),zatca_dpin:(i%3)?('TTIN-'+(9000+i)):null,client_group:'Test Company '+(i%6),customer_raw_name:'Test Company '+(i%6),invoice_date:'2026-0'+((i%6)+1)+'-15',month:_mo,quarter:_q,year:2026,products:_svc,service_type:_svc,record_type:'b2b',total_incl_vat_sar:_tot,wallet_portion_sar:_wal,revenue_sar:_rev,cost_sar:_cost,profit_sar:_prof,amount_received_sar:_tot,amount_remaining_sar:0,collection_due_date:'2026-07-15',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed',created_at:'2026-06-01T00:00:00Z',updated_at:'2026-06-01T00:00:00Z',deleted_at:null};})
    // Standing invariant fixture (2026-08-23, docs/DECISIONS.md — Takamol/Techtic never
    // appear anywhere): a live, non-deleted, verified_paid row for an excluded client,
    // exactly matching the shape a re-import mistake would produce — the exclusion list
    // (app_settings below) carries this exact name. Tests that the belt-and-suspenders
    // filter in js/16-finance-ledger.js's finGot() catches it even though the row itself
    // looks otherwise perfectly normal. scripts/qa/probe-finance-invariants.mjs asserts
    // this row NEVER reaches FIN.rows, any displayed total, or any CSV export — if this
    // one row silently counts anywhere, that probe must fail the build.
    .concat([{id:'i-qa-takamol',invoice_no:'9999999999',zatca_dpin:'TTIN-9999',client_group:'Takamol for Business Services',customer_raw_name:'Takamol for Business Services',invoice_date:'2026-06-20',month:'June',quarter:'Q2',year:2026,products:'B2B',service_type:'B2B',record_type:'b2b',total_incl_vat_sar:314159,wallet_portion_sar:0,revenue_sar:314159,cost_sar:0,profit_sar:314159,amount_received_sar:314159,amount_remaining_sar:0,collection_due_date:'2026-06-20',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed-invariant-qa',created_at:'2026-06-20T00:00:00Z',updated_at:'2026-06-20T00:00:00Z',deleted_at:null},
    // M1 canary (2026-08-23, docs/DECISIONS.md — "VAT never enters cost, profit or revenue"):
    // a real VAT-bearing row (vat_sar>0, unlike the 15 seed rows above which carry no VAT at
    // all — this app's fixture never actually exercised a VAT-bearing figure before, which is
    // its own gap). Correctly clean: total 11500 = revenue 10000 + vat 1500, and
    // profit 4000 = revenue 10000 - cost 6000, with no vat_sar term anywhere in either
    // calculation. scripts/qa/probe-no-vat-display.mjs asserts this arithmetic directly.
    {id:'i-qa-vatclean',invoice_no:'8888888888',zatca_dpin:'TTIN-8888',client_group:'Test Company VAT Canary',customer_raw_name:'Test Company VAT Canary',invoice_date:'2026-06-21',month:'June',quarter:'Q2',year:2026,products:'Hotels',service_type:'Hotels',record_type:'b2b',total_incl_vat_sar:11500,wallet_portion_sar:0,revenue_sar:10000,cost_sar:6000,profit_sar:4000,vat_sar:1500,amount_received_sar:11500,amount_remaining_sar:0,collection_due_date:'2026-06-21',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed-invariant-qa',created_at:'2026-06-21T00:00:00Z',updated_at:'2026-06-21T00:00:00Z',deleted_at:null}]),
  ksa_events:[...Array(8)].map((_,i)=>({id:'e'+i,name_en:'Event '+i,name_ar:'فعالية '+i,vertical:['Travel','Tech','Study','Other'][i%4],status:'confirmed',start_date:i===3?'2026-08-01':'2026-09-1'+(i%9),end_date:i===3?'2026-08-02':'2026-09-1'+(i%9),city:'Riyadh',venue:'RICEC',organiser:'Org',link:'https://example.com',opportunity_sales:i%2===0,opportunity_partner:i%3===0,priority:(i%5)+1,notes:null,approach:['attend','stand','mine','skip','undecided'][i%5],approach_status:i===0?'signed_up':'not_started',exhibitor_list_url:i===2?'https://example.com/exhibitors':null,created_at:null,updated_at:null})),
  ksa_event_signups:[{event_id:'e2',login_email:'business@directksa.com',login_password:'throwaway-1',signed_up_by:'Abdulrahman',updated_at:null}],
  ksa_events_audit:[], airlines:[...Array(12)].map((_,i)=>({id:'ai'+i,legacy_id:'A'+i,name:'Airline '+i,code:'X'+i,icao:'XX'+i,stock:null,country:'KSA',type:'FSC',ksa:'yes',alliance:null,adm_risk:'low',gds:[],providers:[],frontend:null,deeplinks:null,manual:null,adm_policy:null,ticketing:{},notes:null,raw:{},contacts:[],contacts_source:null,contacts_updated_at:null})),
  providers:[...Array(6)].map((_,i)=>({id:'p'+i,legacy_id:'P'+i,name:'Provider '+i,kind:'GDS',source:'direct',portal:'https://example.com',login:'user',adm_policy:null,process:null,payment:'credit',contacts:[],notes:null,raw:{}})),
  sops:[...Array(5)].map((_,i)=>({id:'s'+i,legacy_id:'S'+i,title:'SOP '+i,category:'Ops',market_standard:'yes',edge:'n/a',body:'Body text',author:'QA',updated_at:'2026-08-01T00:00:00Z',raw:{}})),
  slas:[...Array(5)].map((_,i)=>({id:'sl'+i,legacy_id:'SL'+i,metric:'Response time',direct_business:'2h',market:'4h',whales:'1h',flag:'green',raw:{}})),
  requests:[...Array(4)].map((_,i)=>({id:'r'+i,legacy_id:'R'+i,title:'Request '+i,business_id:'b'+i,client_name:'Test Company '+i,stage:'open',owner:'QA',priority:'high',supplier:'Provider 1',pnr:'ABC12'+i,cost:900,sell:1100,sla_due:'2026-08-20T00:00:00Z',created_at:'2026-08-01T00:00:00Z',raw:{}})),
  offers:[], external_refs:[], master_db_companies:[], generated_documents:[],
  // Operations + Proposals live in real tables since v59 (js/35): one row per record, `data` =
  // the exact JSON the app uses. Until 2026-09-02 (attack round 10) the mock served NOTHING
  // for app_requests / app_offers — and because an unknown table answers `[]`, js/35 took that
  // as "tables reachable, empty" and replaced the blob copy with nothing, so every harness run
  // of the Ops board and the Proposals list was on an EMPTY page. Seven requests, one per
  // board stage, with sell/cost so the KPI arithmetic is checkable; three proposals in the
  // three statuses. `createdAt` is relative to mock start: the first two are 1 h old (inside
  // the 2 h SLA), the rest 5 h old (overdue unless Delivered/Closed).
  app_requests:[['New','Flights',1100,900],['Quoting','Hotels',5400,4700],['Awaiting client','Visa',800,650],['Booked','Package',12000,10100],['Ticketed','Flights',3300,2900],['Delivered','eSIM',150,90],['Closed','Group / MICE',48000,41000]]
    .map((s,i)=>({id:'req'+i,data:{id:'req'+i,client:'Test Company '+i,service:s[1],detail:'Seed request '+i,stage:s[0],owner:i%2?'QA':'',priority:['Urgent','High','Normal','Low'][i%4],createdAt:Date.now()-(i<2?1:5)*3600e3,supplier:'Provider 1',pnr:i%3?('PNR'+i):'',sell:s[2],cost:s[3],notes:''},updated_at:'2026-08-01T00:00:00Z',updated_by:'QA'})),
  app_offers:[['Draft','Price offer',12000,''],['Sent','Tender',48000,'2026-12-31'],['Won','Training',9500,'']]
    .map((s,i)=>({id:'off'+i,data:{id:'off'+i,ref:'DB-10000'+i,date:'2026-08-1'+i,client:'Test Company '+i,subject:'Seed proposal '+i,airline:'',route:'',currency:'SAR',ticketPrice:'',partnerFees:'',serviceFees:'',vat:'',total:'',status:s[0],version:1,validUntil:s[3],linkedLeadId:'',policyStatus:'Not checked',approvalStatus:'Not required',paxAdt:1,paxChd:0,paxInf:0,cost:'',commission:'',options:[],owner:'QA',proposalType:s[1],docUrl:'',scope:'',value:s[2],promotedToProject:false},updated_at:'2026-08-01T00:00:00Z',updated_by:'QA'})),
  /* app_bookings / app_invoices had NO seed at all (2026-09-02, round 33). js/35 lists them in
     its KEYS, so the empty answer REPLACED whatever the blob carried — meaning Bookings,
     Invoices, Tickets and the whole Archive page had never rendered a single row in the
     harness, in any run. Same shape of gap as the reference pages (round 19) and the SOP/SLA
     pages (round 20), and it hid real defects both of those times.
     Six bookings: a mix of statuses, one with a TTL inside 72 h, one QC-complete, one ADM-
     flagged ticket, and — deliberately — one with NO cost recorded, which is what a booking
     converted from a proposal now looks like since round 29 made the app stop inventing one.
     Five invoices: issued / paid / overdue / a credit note / one on a far date, with items so
     v18InvTotals has something real to add up. */
  app_bookings:[
    ['BK-2001','Test Company 1','Amadeus','Ticketed', 12000, 9500, 20, 'OPEN', false],
    ['BK-2002','Test Company 2','Sabre',  'Confirmed',  8400, 6100, 96, 'OPEN', false],
    ['BK-2003','Test Company 3','Amadeus','Ticketed',  26000,21000, -8, 'USED', true ],
    ['BK-2004','Test Company 4','Galileo','Draft',      3200, 2400,240, 'OPEN', false],
    ['BK-2005','Test Company 1','Amadeus','Ticketed',  15500,     0, 48, 'OPEN', false],
    ['BK-2006','Test Company 5','Sabre',  'Cancelled',  4100, 3300,300, 'REFUNDED', false]
  ].map(function(s,i){
    var noCost = s[5]===0;
    return {id:'bkg'+i,data:{id:'bkg'+i,ref:s[0],leadId:'L'+((i%6)),client:s[1],provider:s[2],status:s[3],
      pnr:'PNR'+(200+i), recordLocator:'PNR'+(200+i), bookingSource:'GDS',
      ttl:new Date(Date.now()+s[6]*3600e3).toISOString(),
      fop:'Credit', queueAssignee:i%2?'Abdelrahman':'', queueDueBy:i%2?new Date(Date.now()+3*86400e3).toISOString().slice(0,10):'',
      endorsements:'', totalSale:s[4], totalCost:noCost?'':s[5], costNotRecorded:noCost,
      date:'2026-08-0'+((i%9)+1), notes:'', provider2:'',
      tickets:[{pnr:'PNR'+(200+i), eticket:'065-1234'+(560+i), pax:'PAX '+(i+1), route:'RUH-JED', cls:'Y', rbd:'Y',
        fareBasis:'YOWSA', validity:'1Y', ffn:'', status:s[7], emdType:'', fare:s[4]*0.8, taxes:s[4]*0.2,
        airline:['SV','XY','MS','TK','EK','QR'][i%6], admFlag:s[8], admId:s[8]?'ADM-77'+i:'',
        fareRules:{refundPenalty:'200 SAR',changePenalty:'150 SAR',noShow:'Non-refundable'},
        reissueChain:{parent:'',children:[],fareDiff:0}, autoRefund:false, fraudScore:0, mileage:'', conjunction:false,
        linkedTickets:[], coupons:[{n:1,status:s[7],validity:'1Y'}]}],
      qc:i===0?{fareRulesChecked:true,paxNamesChecked:true,ssrChecked:true,priceChecked:true,docsChecked:true}:{}
    },updated_at:'2026-08-01T00:00:00Z',updated_by:'QA'};
  }),
  app_invoices:[
    ['INV-3001','Issued',   'Standard', 14000, '2026-08-02', 'None'],
    ['INV-3002','Paid',     'Standard',  9200, '2026-07-11', 'None'],
    ['INV-3003','Overdue',  'Standard', 22400, '2026-05-04', 'Friendly reminder'],
    ['INV-3004','Issued',   'Credit',   -3100, '2026-08-14', 'None'],
    ['INV-3005','Issued',   'Standard',  6750, '2026-08-20', 'None']
  ].map(function(s,i){
    return {id:'inv'+i,data:{id:'inv'+i,number:s[0],clientId:'L'+(i%6),invoiceType:s[2],status:s[1],
      date:s[4], dueDate:'2026-09-0'+((i%9)+1), paymentTerms:'Net 30', poNumber:'PO-'+(9000+i), buyerVat:'',
      dunningStage:s[5], currency:'SAR', fxRate:1, zatcaStatus:i%2?'Cleared':'Not submitted',
      zatcaUUID:'uuid-seed-'+i, zatcaHash:'', prevHash:'', notes:'',
      recurring:{enabled:false,every:'Monthly'}, bspBucket:'',
      items:[{desc:'Seed line '+i, amount:s[3], vatRate:'Standard 15%'}], total:s[3]*1.15,
      collectionsLog:[]
    },updated_at:'2026-08-01T00:00:00Z',updated_by:'QA'};
  }),
  app_projects:[['Active',120000,80000,25000,40],['Proposed',48000,0,0,12]]
    .map((s,i)=>({id:'prj'+i,data:{id:'prj'+i,name:'Seed project '+i,nameAr:'مشروع تجريبي '+i,client:'Test Company '+i,linkedClientId:'',value:String(s[1]),status:s[0],fromOfferId:'',owner:'QA',createdAt:1756000000000+i,notes:'',budget:s[1],actualCost:s[2],profit:s[3],pax:s[4],start:'2026-10-0'+(i+1),end:'2026-10-0'+(i+5)},updated_at:'2026-08-01T00:00:00Z',updated_by:'QA'})),
  // Backups-in-Supabase fixture (2026-08-23, docs/DECISIONS.md — moved off localStorage per
  // P1). Mirrors the real live project: app_state_history is trigger-populated (never
  // client-inserted, admin-only SELECT by RLS) — seeded with 3 rows so the harness can test
  // the admin-visible path; app_state_bak starts empty so tagCurrentState()/migration tests
  // start from a clean slate and their own inserts are what gets asserted against.
  app_state_history:[
    {hist_id:1,saved_at:'2026-08-20T09:00:00Z',updated_by:'test@directksa.com',data:{schemaVersion:24,seed:'qa-hist-1'}},
    {hist_id:2,saved_at:'2026-08-21T09:00:00Z',updated_by:'test@directksa.com',data:{schemaVersion:24,seed:'qa-hist-2'}},
    {hist_id:3,saved_at:'2026-08-22T09:00:00Z',updated_by:'test@directksa.com',data:{schemaVersion:24,seed:'qa-hist-3'}},
  ],
  app_state_bak:[],
  // M15 (2026-08-25) capture-persistence fixture — empty on purpose: probes assert their OWN
  // writes land (delete-then-insert for lines, upsert for gates), not a pre-seeded state.
  finance_expense_lines_capture:[], finance_expense_gate_capture:[],
  business_merges:[],
  access_allowlist:[], share_links:[],
  // client↔finance link fixture: maps finance group "Test Company 4" to business b4 (a client),
  // so the harness exercises the real link path (legacy-id L4 → uuid b4 → group → invoices).
  // A SECOND group "Test Company 5" also maps to b4 — simulating two invoice-spellings of one
  // company — so the canonical-client rollup (both groups collapse into one client row) is tested.
  finance_client_links:[
    {id:'fl0',client_group:'Test Company 4',business_id:'b4',is_client:true,note:'auto: test',confirmed_by:'system',confirmed_at:'2026-08-10T00:00:00Z',created_at:'2026-08-10T00:00:00Z',updated_at:'2026-08-10T00:00:00Z'},
    {id:'fl1',client_group:'Test Company 5',business_id:'b4',is_client:true,note:'dup spelling → same client',confirmed_by:'system',confirmed_at:'2026-08-10T00:00:00Z',created_at:'2026-08-10T00:00:00Z',updated_at:'2026-08-10T00:00:00Z'}
  ],
  // client_profiles fixture (Phase 1, 2026-08-21): identity rows only — no money columns,
  // matching what the real select actually asks for. b0 = one Tender profile; b4 = a
  // Prepaid + Postpaid pair, so the harness exercises both the single- and multi-profile
  // rendering paths on the client card.
  client_profiles:[
    {id:'cp0',business_id:'b0',direct_client_id:'95',profile_type:'tender',status:'active',payment_terms:null,billing_cycle:null,opened_at:'2026-05-19',closed_at:null},
    {id:'cp1',business_id:'b4',direct_client_id:'12',profile_type:'prepaid',status:'active',payment_terms:null,billing_cycle:'Manual',opened_at:'2026-03-01',closed_at:null},
    {id:'cp2',business_id:'b4',direct_client_id:'13',profile_type:'postpaid',status:'active',payment_terms:'Net 30',billing_cycle:'Monthly',opened_at:'2026-03-05',closed_at:null}
  ],
  // Phase 2 Ledger fixture (2026-08-21): covers all four stages (invoiced / ready /
  // pending / overdue) across the three profile types, so the harness exercises the
  // confirmed-only KPI gate and the est.-tag / Overdue-mirror rules, not just the happy path.
  finance_transactions:[
    {id:'tx0',transaction_ref:'TXN-QA-001',invoice_no:'INV-QA-001',zatca_dpin:'DPIN-11001',direct_uuid:null,business_id:'b0',client_profile_id:'cp0',product:'Direct Hotels',service_type:'Hotels',amount_sar:42000,expense_status:null,cost_confirmed_sar:35000,cost_estimate_sar:null,amount_received_sar:42000,amount_remaining_sar:0,overdue:null,created_at_source:'2026-07-01T10:00:00Z',origin:'booking',proposal_ref:null,source:'seed'},
    {id:'tx1',transaction_ref:'TXN-QA-002',invoice_no:null,zatca_dpin:null,direct_uuid:null,business_id:'b4',client_profile_id:'cp1',product:'Direct Flights',service_type:'Flights',amount_sar:9500,expense_status:'ready',cost_confirmed_sar:7600,cost_estimate_sar:null,amount_received_sar:0,amount_remaining_sar:9500,overdue:null,created_at_source:'2026-08-10T10:00:00Z',origin:'booking',proposal_ref:null,source:'seed'},
    {id:'tx2',transaction_ref:'TXN-QA-003',invoice_no:null,zatca_dpin:null,direct_uuid:null,business_id:'b4',client_profile_id:'cp2',product:'Direct Visa',service_type:'Visas',amount_sar:6000,expense_status:'pending',cost_confirmed_sar:0,cost_estimate_sar:4800,amount_received_sar:0,amount_remaining_sar:0,overdue:null,created_at_source:'2026-08-18T10:00:00Z',origin:'booking',proposal_ref:null,source:'seed'},
    {id:'tx3',transaction_ref:'TXN-QA-004',invoice_no:null,zatca_dpin:null,direct_uuid:null,business_id:'b0',client_profile_id:'cp0',product:'Direct Packages',service_type:'Packages',amount_sar:15000,expense_status:'pending',cost_confirmed_sar:0,cost_estimate_sar:12000,amount_received_sar:0,amount_remaining_sar:0,overdue:true,created_at_source:'2026-08-05T10:00:00Z',origin:'booking',proposal_ref:null,source:'seed'}
  ],
  // status/source_system normalised 2026-08-21 (Round 13): Direct Payments' COGs Report
  // returns zero rows for every filter tested — Corporate Expenses > View Assignments is
  // the verified real cost source, so that's the default source_system here.
  finance_cogs_expenses:[
    {id:'cog0',transaction_id:'tx0',reference_id:'COG-QA-001',invoice_id:'INV-QA-001',expense_template_type:'Hotel Cost',status:'approved',source_system:'corporate_expenses',amount_sar:35000,merchant:'Hotel supplier',submitted_by:'Ops team',approved_rejected_by:'Finance ops',source:'seed'},
    {id:'cog1',transaction_id:'tx1',reference_id:'COG-QA-002',invoice_id:null,expense_template_type:'Airline Fees',status:'approved',source_system:'corporate_expenses',amount_sar:7600,merchant:'Airline',submitted_by:'Ops team',approved_rejected_by:'Finance ops',source:'seed'},
    {id:'cog2',transaction_id:'tx2',reference_id:'COG-QA-003',invoice_id:null,expense_template_type:'Embassy Expenses',status:'under_review',source_system:'corporate_expenses',amount_sar:4800,merchant:'Embassy',submitted_by:'Ops team',approved_rejected_by:null,source:'seed'}
  ],
  payment_receipts:[
    {id:'pr0',receipt_ref:'PR-QA-001',payment_method:'Bank transfer',amount_sar:42000,remaining_after_sar:0,status:'fully_applied',paid_by:'Finance ops',created_at_source:'2026-07-02T10:00:00Z',allocations:[{transaction_id:'tx0',allocated_amount_sar:42000}],source:'seed'}
  ],
  // Spec 8 (2026-08-21): record_history — the real who-did-what log the database writes on
  // every create/edit/archive/restore/delete of businesses/finance_invoices/
  // finance_transactions/client_profiles/contacts. One of each action shape, plus one
  // already-undone row and one 'create' row (Undo hidden on both, for different reasons),
  // so the harness exercises every branch of js/63's histRow() rendering.
  record_history:[
    {id:1,at:'2026-08-21T09:00:00Z',actor:UID,actor_name:'QA Test Account',table_name:'businesses',record_id:'b0',action:'edit',before_row:{id:'b0',name:'Test Company 0',stage:'new'},after_row:{id:'b0',name:'Test Company 0',stage:'contacted'},undone_at:null,undone_by:null},
    {id:2,at:'2026-08-20T14:00:00Z',actor:'u-assem',actor_name:'Assem Alsweed',table_name:'finance_invoices',record_id:'i2',action:'edit',before_row:{id:'i2',status:'Draft'},after_row:{id:'i2',status:'Issued'},undone_at:null,undone_by:null},
    {id:3,at:'2026-08-19T11:00:00Z',actor:'u-assem',actor_name:'Assem Alsweed',table_name:'businesses',record_id:'b1',action:'archive',before_row:{id:'b1',archived_at:null},after_row:{id:'b1',archived_at:'2026-08-19T11:00:00Z'},undone_at:'2026-08-19T12:00:00Z',undone_by:UID},
    {id:4,at:'2026-08-18T08:00:00Z',actor:UID,actor_name:'QA Test Account',table_name:'businesses',record_id:'b2',action:'create',before_row:null,after_row:{id:'b2',name:'Test Company 2'},undone_at:null,undone_by:null}
  ],
  // Spec 4 (2026-08-21): DB.settings loads from app_settings (v59, js/35), not the
  // app_state blob — the harness needs its own row here or the exclusion list/grouping
  // tool would render against an empty DB.settings.financeExclusions every run.
  app_settings:[{id:'main',data:{lang:'en',currency:'SAR',financeExclusions:[
    {id:'fx-qa-takamol',clientId:'7',matchNames:['Takamol for Business Services','Techtic Support'],reason:'Takamol — verification services, accounted for elsewhere',addedBy:'QA seed',addedAt:'2026-08-21T00:00:00Z'}
  ]},updated_at:'2026-08-21T00:00:00Z',updated_by:'QA seed'}]
};
// Spec 7b (2026-08-21): drive the app as any role without a second account. MOCK_ROLE /
// MOCK_PAGE_ACCESS (a JSON string, e.g. '{"leads":"editor","finance":"editor"}') override
// the signed-in test@directksa.com row's role/page_access at startup — one source of truth,
// same as the real database: the plain `SELECT role,... FROM app_users` the login layer
// reads AND the app_role()/my_page_access() RPCs below all read this same row, so nothing
// can disagree with itself the way two separately-hardcoded stubs could.
(function applyMockRoleEnv(){
  const me=TABLES.app_users.find(u=>u.id===UID); if(!me) return;
  if(process.env.MOCK_ROLE) me.role=process.env.MOCK_ROLE;
  if(process.env.MOCK_PAGE_ACCESS){
    try{ me.page_access=JSON.parse(process.env.MOCK_PAGE_ACCESS); }
    catch(e){ throw new Error('MOCK_PAGE_ACCESS is not valid JSON: '+e.message); }
  }
})();
const RPCLOG=[];
// Lapsed-session switch (2026-09-02, attack round 18): GET /__lapse?on=1 makes the mock answer
// like PostgREST does to an anonymous caller — app_role()/my_page_access() null, every table
// read [] — without touching the browser's token, so js/55's "never show zeros as truth" guard
// can be driven for real. /__lapse?on=0 restores.
let LAPSED=false;
let _finIdSeq=0; // new finance_invoices rows inserted through the mock get mock-fi-N ids
// 2026-09-02 (watch cycle 5): mirror of the LIVE trigger finance_derive_fields() (BEFORE INSERT OR
// UPDATE on finance_invoices, read from pg_trigger the same day) — month/quarter from the date,
// revenue = total − wallet, profit = revenue − cost, remaining = 0 on excluded/credit rows. Without
// it the harness stored whatever the client sent, so an importer that computed revenue differently
// from the database looked idempotent here and was not on the real table (every re-import of the
// same file then reported "updated" rows and wrote a history entry per invoice, for nothing).
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
function deriveFinanceInvoice(r){
  if(!r||typeof r!=='object')return r;
  if(r.invoice_date&&/^\d{4}-\d{2}-\d{2}/.test(String(r.invoice_date))){ const mo=+String(r.invoice_date).slice(5,7); r.month=MONTHS_EN[mo-1]||null; r.quarter='Q'+(Math.floor((mo-1)/3)+1); }
  else if(r.invoice_date==null){ r.month=null; r.quarter=null; }
  const n=x=>Number(x)||0;
  const rev=n(r.total_incl_vat_sar)-n(r.wallet_portion_sar);
  if(Math.abs(rev-n(r.revenue_sar))>0.01) r.revenue_sar=Math.round(rev*100)/100;
  const prof=n(r.revenue_sar)-n(r.cost_sar);
  if(Math.abs(prof-n(r.profit_sar))>0.01) r.profit_sar=Math.round(prof*100)/100;
  if(r.integrity_status==='excluded'||r.integrity_status==='credit_note') r.amount_remaining_sar=0;
  return r;
}
export { deriveFinanceInvoice };
let _bakIdSeq=0; // new app_state_bak rows inserted through the mock get sequential bak_ids
// Password-recovery probes (2026-08-22): three inspectable logs, same pattern as RPCLOG below —
// a probe drains these over HTTP instead of guessing at what the client actually sent.
const RECOVERLOG=[];   // every resetPasswordForEmail() call the mock's /auth/v1/recover saw
const PWUPDATELOG=[];  // every updateUser({password}) call the mock's PUT /auth/v1/user saw
function send(res,code,body,extra={}){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'content-range','Access-Control-Allow-Methods':'*',...extra});res.end(typeof body==='string'?body:JSON.stringify(body));}
// start(port) keeps the standard seed; start(port,{table:rows}) swaps a table's rows,
// so a probe can drive the app at real-world scale without disturbing other probes.
export function start(port, seedOverrides){
 if(seedOverrides) Object.keys(seedOverrides).forEach(k=>{ TABLES[k]=seedOverrides[k]; });
 return http.createServer((req,res)=>{
  const u=url.parse(req.url,true); const path=u.pathname;
  if(req.method==='OPTIONS') return send(res,204,'');
  if(path==='/__lib') { res.writeHead(200,{'Content-Type':'application/javascript'}); return res.end(fs.readFileSync(UMD)); }
  if(path.startsWith('/auth/v1/token')) return send(res,200,SESSION);
  if(path==='/auth/v1/user'){
    if(req.method==='PUT'){
      let body=''; req.on('data',c=>body+=c);
      return req.on('end',()=>{
        let p={}; try{p=JSON.parse(body||'{}');}catch(_){}
        // Never log the actual password, even in a mock — just that one was submitted.
        PWUPDATELOG.push({hadPassword:!!p.password, passwordLen:p.password?String(p.password).length:0, at:new Date().toISOString()});
        return send(res,200,SESSION.user);
      });
    }
    return send(res,200,SESSION.user);
  }
  if(path==='/auth/v1/logout') return send(res,204,'');
  if(path.startsWith('/auth/v1/recover')){
    let body=''; req.on('data',c=>body+=c);
    return req.on('end',()=>{
      let p={}; try{p=JSON.parse(body||'{}');}catch(_){}
      // supabase-js sends redirect_to as a query param on this endpoint, not in the body.
      RECOVERLOG.push({email:p.email||null, redirectTo:u.query.redirect_to||p.redirect_to||null, at:new Date().toISOString()});
      return send(res,200,{});
    });
  }
  if(path==='/__recoverlog') return send(res,200,RECOVERLOG);
  if(path==='/__pwupdatelog') return send(res,200,PWUPDATELOG);
  if(path.startsWith('/functions/v1/admin-users')){
    let body='';
    req.on('data',c=>body+=c);
    return req.on('end',()=>{
      let p={}; try{p=JSON.parse(body||'{}');}catch(_){}
      const A=p.action;
      if(A==='list') return send(res,200,{users:TABLES.app_users.map(u=>({id:u.id,email:u.email,full_name:u.full_name,role:u.role,active:u.active,must_change_password:u.must_change_password,created_at:u.created_at})),caller_role:(TABLES.app_users.find(x=>x.id===UID)||{}).role||''});
      if(A==='create'){ const nu={id:'u-'+(TABLES.app_users.length),email:String(p.email||'').toLowerCase(),full_name:p.full_name||'',role:p.role||'team_member',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:true,allowed_pages:['today','leads','clients']}; TABLES.app_users.push(nu); return send(res,200,{ok:true,email:nu.email,temp_password:'Riyadh1234!'}); }
      if(A==='set_role'){ const u=TABLES.app_users.find(x=>x.id===p.id); if(u)u.role=p.role; return send(res,200,{ok:true}); }
      if(A==='set_active'){ const u=TABLES.app_users.find(x=>x.id===p.id); if(u)u.active=p.active===true; return send(res,200,{ok:true}); }
      if(A==='reset_password'){ return send(res,200,{ok:true,temp_password:'Jeddah5678@'}); }
      // 2026-08-22: mirrors the real admin-users edge function's send_reset_link action —
      // admin-only (server-enforced there via app_users.role, mocked here the same way via
      // the signed-in test row, which MOCK_ROLE can override), never a password in the
      // response, and a record_history row written for the caller to see logged.
      if(A==='send_reset_link'){
        const caller=TABLES.app_users.find(x=>x.id===UID);
        if(!caller||caller.role!=='admin') return send(res,200,{error:'Only an admin can send a reset link.'});
        const target=TABLES.app_users.find(x=>x.id===p.id);
        if(!target) return send(res,200,{error:'Person not found.'});
        RECOVERLOG.push({email:target.email, redirectTo:p.origin||null, at:new Date().toISOString(), via:'admin-users'});
        TABLES.record_history.unshift({id:(TABLES.record_history.length?Math.max(...TABLES.record_history.map(r=>r.id)):0)+1,at:new Date().toISOString(),actor:UID,actor_name:caller.full_name||caller.email,table_name:'access',record_id:p.id,action:'reset_link_sent',before_row:null,after_row:{target_email:target.email},undone_at:null,undone_by:null});
        return send(res,200,{ok:true});
      }
      if(A==='clear_must_change') return send(res,200,{ok:true});
      return send(res,200,{error:'unknown'});
    });
  }
  if(path==='/__rpclog') return send(res,200,RPCLOG);
  if(path==='/__lapse'){ LAPSED=String(u.query.on||'')==='1'; return send(res,200,{lapsed:LAPSED}); }
  if(path.startsWith('/rest/v1/rpc/')){
    let body='';
    req.on('data',c=>body+=c);
    return req.on('end',()=>{
      let parsed=null; try{parsed=JSON.parse(body||'{}');}catch(_){}
      const fn=path.replace('/rest/v1/rpc/','');
      RPCLOG.push({fn, keys: parsed?Object.keys(parsed.patch||parsed.payload||{}):[], arg: parsed?Object.keys(parsed):[]});
      if(LAPSED&&(fn==='app_role'||fn==='my_page_access')) return send(res,200,'null');   // anonymous caller: no role
      // Spec 7b (2026-08-21): app_role() and my_page_access() read the SAME app_users row
      // the login layer already reads, mirroring the real functions exactly —
      //   app_role()        = role from app_users where id = auth.uid() and active
      //   my_page_access()  = null for admin, else that row's page_access
      // so a probe driving MOCK_ROLE/MOCK_PAGE_ACCESS gets one consistent answer everywhere,
      // not two stubs that could quietly disagree with each other.
      // M16 (2026-08-25) — mirrors fn_commit_finance_import() (migration
      // finance_commit_import_rpc): ONE atomic call replacing v65Commit()'s old several
      // sequential .insert()/.upsert() round trips. The real function's explicit
      // jsonb_to_recordset() column lists ARE the write allowlist (M13) — a stray `year` (or
      // any other unlisted key) is silently ignored here too, never fails the call, matching
      // the real function's behavior exactly (stricter/kinder than the old direct-REST path,
      // which rejected the whole batch on a `year` key).
      if(fn==='fn_commit_finance_import'){
        const WRITABLE=['invoice_no','zatca_dpin','client_group','customer_raw_name','invoice_date',
          'month','quarter','products','service_type','record_type','total_incl_vat_sar','wallet_portion_sar',
          'revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','collection_due_date',
          'integrity_status','exclusion_reason','notes','source_batch','line_no','branch','salesman','project_tag',
          'discount_sar','origin','proposal_ref','items','transaction_ref','direct_uuid','vat_sar','revenue_way'];
        const pick=(row,extra)=>{ const out={}; (extra?WRITABLE.concat(extra):WRITABLE).forEach(k=>{ if(Object.prototype.hasOwnProperty.call(row,k)) out[k]=row[k]; }); return out; };
        const pIns=Array.isArray(parsed.p_insert)?parsed.p_insert:[];
        const pUpd=Array.isArray(parsed.p_update)?parsed.p_update:[];
        const pCapLines=Array.isArray(parsed.p_capture_lines)?parsed.p_capture_lines:[];
        const pCapGates=Array.isArray(parsed.p_capture_gates)?parsed.p_capture_gates:[];
        const fiTable=TABLES.finance_invoices;
        let inserted=0, updated=0;
        pIns.forEach(row=>{
          const clean=pick(row);
          fiTable.push(deriveFinanceInvoice(Object.assign({id:'mock-fi-'+(++_finIdSeq)}, clean)));
          inserted++;
        });
        pUpd.forEach(row=>{
          if(!row.id)return;
          const clean=pick(row);
          const ix=fiTable.findIndex(r=>r.id===row.id);
          if(ix>=0){ fiTable[ix]=deriveFinanceInvoice(Object.assign({},fiTable[ix],clean,{updated_at:new Date().toISOString()})); updated++; }
        });
        if(pCapLines.length){
          const refs=[...new Set(pCapLines.map(l=>l.transaction_ref))];
          const linesTable=TABLES.finance_expense_lines_capture;
          for(let i=linesTable.length-1;i>=0;i--){ if(refs.includes(linesTable[i].transaction_ref)) linesTable.splice(i,1); }
          pCapLines.forEach(l=>{ linesTable.push(Object.assign({id:'mock-cap-'+Math.random().toString(36).slice(2)}, pick(l,['transaction_ref','amount_sar','expense_status','source_batch']), {captured_at:new Date().toISOString()})); });
        }
        if(pCapGates.length){
          const byRef={}; pCapGates.forEach(g=>{byRef[g.transaction_ref]=g;});
          const gatesTable=TABLES.finance_expense_gate_capture;
          Object.keys(byRef).forEach(ref=>{
            const g=pick(byRef[ref],['transaction_ref','txn_expense_status','invoice_issuing_raw','source_batch']);
            const ix=gatesTable.findIndex(r=>r.transaction_ref===ref);
            if(ix>=0) gatesTable[ix]=Object.assign({},gatesTable[ix],g,{captured_at:new Date().toISOString()});
            else gatesTable.push(Object.assign({},g,{captured_at:new Date().toISOString()}));
          });
        }
        return send(res,200, JSON.stringify({inserted, updated, capture_lines:pCapLines.length, capture_gates:Object.keys(pCapGates.reduce((a,g)=>{a[g.transaction_ref]=1;return a;},{})).length}));
      }
      // M18 (2026-08-29) — mirrors fn_merge_businesses()/fn_unmerge_businesses() (migration
      // business_merges_reversible): repoint child rows to the survivor, archive the dropped
      // company, record exactly what moved so undo puts it back. The mock only carries the
      // child tables it has (finance_client_links); the real function covers eleven.
      if(fn==='fn_merge_businesses'){
        const keep=parsed&&parsed.p_keep, drop=parsed&&parsed.p_drop;
        if(!keep||!drop||keep===drop) return send(res,400,{message:'keep and drop must be two different companies',code:'P0001'});
        const moved={finance_client_links:[],client_profiles:[],client_profiles_closed:[],contacts:[],contacts_flagged:[]};
        (TABLES.finance_client_links||[]).forEach(l=>{ if(l.business_id===drop){ l.business_id=keep; moved.finance_client_links.push(l.id||l.client_group); } });
        // contacts move; one that duplicates a contact already on the kept company (same e-mail or
        // phone) is FLAGGED for a human, never silently doubled, never deleted (2026-09-02 audit).
        const keepContacts=(TABLES.contacts||[]).filter(c=>c.business_id===keep);
        const nrm=s=>String(s||'').toLowerCase().trim(), dig=s=>String(s||'').replace(/\D/g,'');
        (TABLES.contacts||[]).forEach(c=>{ if(c.business_id!==drop)return;
          const dup=keepContacts.find(k=>(nrm(k.email)&&nrm(k.email)===nrm(c.email))||(dig(k.phone)&&dig(k.phone)===dig(c.phone)));
          if(dup){ moved.contacts_flagged.push({id:c.id,needs:!!c.needs_manual_confirmation,reason:c.confirmation_reason||null,dup_of:dup.id}); c.needs_manual_confirmation=true; c.confirmation_reason=(c.confirmation_reason?c.confirmation_reason+' | ':'')+'Possible duplicate of contact '+dup.id+' (same e-mail or phone) after merging — confirm which record to keep.'; }
          c.business_id=keep; moved.contacts.push(c.id); });
        // 2026-09-02, learned from the first live merge: an open prepaid/postpaid profile may
        // not sit twice on one company (unique index client_profiles_one_open_prepaid_postpaid)
        // — the dropped company's colliding open profile is CLOSED as it moves, remembered for undo.
        const openOnKeep=new Set((TABLES.client_profiles||[]).filter(p=>p.business_id===keep&&!p.closed_at&&['prepaid','postpaid'].includes(p.profile_type)).map(p=>p.profile_type));
        (TABLES.client_profiles||[]).forEach(p=>{ if(p.business_id!==drop)return;
          if(!p.closed_at&&openOnKeep.has(p.profile_type)){ moved.client_profiles_closed.push({id:p.id,notes:p.notes||null}); p.closed_at=new Date().toISOString(); p.notes=(p.notes?p.notes+'\n':'')+'Closed by merging this company into '+keep+': the kept company already had an open '+p.profile_type+' profile. Undoing the merge reopens it.'; }
          p.business_id=keep; moved.client_profiles.push(p.id); });
        const dropRow=(TABLES.businesses||[]).find(b=>b.id===drop);
        if(dropRow){ dropRow.archived_at=new Date().toISOString(); dropRow.archived_by='merged-into:'+keep; }
        const row={id:'mock-merge-'+Math.random().toString(36).slice(2), kept_id:keep, dropped_id:drop, dropped_snapshot:dropRow||{id:drop}, kept_before:{}, moved, reason:(parsed&&parsed.p_reason)||null, actor:'mock', merged_at:new Date().toISOString(), undone_at:null, undone_by:null};
        TABLES.business_merges.push(row);
        return send(res,200,{merge_id:row.id,kept_id:keep,dropped_id:drop,moved});
      }
      if(fn==='fn_unmerge_businesses'){
        const row=(TABLES.business_merges||[]).find(r=>r.id===(parsed&&parsed.p_merge_id)&&!r.undone_at);
        if(!row) return send(res,400,{message:'merge not found or already undone',code:'P0001'});
        (TABLES.finance_client_links||[]).forEach(l=>{ if((row.moved.finance_client_links||[]).indexOf(l.id||l.client_group)>=0) l.business_id=row.dropped_id; });
        (TABLES.client_profiles||[]).forEach(p=>{ if((row.moved.client_profiles||[]).indexOf(p.id)>=0) p.business_id=row.dropped_id;
          const c=(row.moved.client_profiles_closed||[]).find(x=>x.id===p.id); if(c){ p.closed_at=null; p.notes=c.notes; } });
        (TABLES.contacts||[]).forEach(c=>{ if((row.moved.contacts||[]).indexOf(c.id)>=0) c.business_id=row.dropped_id;
          const f=(row.moved.contacts_flagged||[]).find(x=>x.id===c.id); if(f){ c.needs_manual_confirmation=f.needs; c.confirmation_reason=f.reason; } });
        const dropRow=(TABLES.businesses||[]).find(b=>b.id===row.dropped_id); if(dropRow){ dropRow.archived_at=null; dropRow.archived_by=null; }
        row.undone_at=new Date().toISOString(); row.undone_by='mock';
        return send(res,200,{merge_id:row.id,restored_id:row.dropped_id,kept_id:row.kept_id});
      }
      // Workspace blob writes (2026-09-02, attack round 17 — two tabs): mirrors the real
      // save_state_patch (merge only the sections sent) and save_state (replace), so a probe can
      // prove one person's partial save never wipes another's section.
      if(fn==='save_state_patch'||fn==='save_state'){
        const st=(TABLES.app_state=TABLES.app_state||[{id:1,data:{}}])[0];
        if(fn==='save_state'&&parsed&&parsed.payload&&typeof parsed.payload==='object') st.data=Object.assign({},st.data,parsed.payload);
        if(fn==='save_state_patch'&&parsed&&parsed.patch&&typeof parsed.patch==='object') Object.keys(parsed.patch).forEach(k=>{ st.data[k]=parsed.patch[k]; });
        st.updated_at=new Date().toISOString(); st.updated_by='test@directksa.com';
        return send(res,200, JSON.stringify(true));
      }
      if(fn==='app_role'){
        const me=TABLES.app_users.find(u=>u.id===UID && u.active);
        return send(res,200, JSON.stringify(me?me.role:null));
      }
      if(fn==='my_page_access'){
        const me=TABLES.app_users.find(u=>u.id===UID && u.active);
        const val=(me && me.role!=='admin') ? (me.page_access||null) : null;
        return send(res,200, val);
      }
      // Spec 8 (2026-08-21): undo_change(p_id) — approximates the real function's own
      // ordering (not in the log / already undone / create entries refused / else mark
      // undone and answer 'ok') closely enough to drive the app's Undo control end to end in
      // the harness. This is NOT a substitute for testing the real 24h/role/money-table
      // rules — that only means anything against real Postgres, which is what rls-matrix.sql
      // and the live function itself are for.
      if(fn==='undo_change'){
        const row=TABLES.record_history.find(r=>r.id===(parsed&&parsed.p_id));
        if(!row) return send(res,200, JSON.stringify('That change is not in the log.'));
        if(row.undone_at) return send(res,200, JSON.stringify('Already undone.'));
        if(row.action==='create') return send(res,200, JSON.stringify('Undoing a newly created record is not an undo — delete it instead, which is itself logged.'));
        row.undone_at=new Date().toISOString(); row.undone_by=UID;
        return send(res,200, JSON.stringify('ok'));
      }
      // page-access enforcement (2026-08-21): log_page_denied(p_page) appends a real row so
      // the harness can prove the client actually calls it, not just that it redirects.
      if(fn==='log_page_denied'){
        const me=TABLES.app_users.find(u=>u.id===UID && u.active);
        const nextId=Math.max(0,...TABLES.record_history.map(r=>r.id))+1;
        TABLES.record_history.push({id:nextId,at:new Date().toISOString(),actor:UID,actor_name:(me&&me.full_name)||'unknown',table_name:'access',record_id:'mock-'+nextId,action:'denied',before_row:null,after_row:{page:parsed&&parsed.p_page},undone_at:null,undone_by:null});
        return send(res,200, {});
      }
      // Real PostgREST answers a SET-returning function with a JSON array, not an object —
      // {} for every RPC (the old default here) let callers whose guard only checked
      // truthiness (not Array.isArray) pass a non-array to .forEach and throw on every page.
      // team_nicknames() is set-returning; add more names here as new set-returning RPCs
      // are introduced. Everything else keeps the harmless {} stub.
      const SET_RETURNING=new Set(['team_nicknames']);
      send(res,200, SET_RETURNING.has(fn)?[]:{});
    });
  }
  if(path.startsWith('/rest/v1/')){
    const t=path.replace('/rest/v1/','').split('?')[0];
    let rows=TABLES[t]||[];
    if(LAPSED&&req.method==='GET') return send(res,200,[]);   // RLS shows an anonymous caller nothing
    // finance_invoices writes are persisted for real (insert + upsert-by-id) — everything
    // else keeps the old no-op 201,[] stub. Scoped narrowly on purpose: the universal
    // importer's own idempotency (import, then re-import the same file → all Unchanged) is
    // untestable the OBVIOUS way without this — FIN.rows never reflected a prior "commit",
    // so a plain re-drop always answered "New" again and looked exactly like a real bug
    // (confirmed live 2026-08-21 — cost the session real time before the cause was found:
    // the mock, not the importer). Widening this to every table is a bigger, riskier change
    // some other probe might be unknowingly relying on the current no-op — not done here.
    if(req.method!=='GET'){
      // Generic silent-refusal switch (2026-09-02, attack round 11): MOCK_REFUSE_TABLES=a,b makes
      // every write to those tables answer no error and no rows — the RLS-refused shape every
      // M13 check must detect. Lets one probe exercise the refusal path of any write site.
      if((process.env.MOCK_REFUSE_TABLES||'').split(',').map(s=>s.trim()).filter(Boolean).includes(t)){
        req.on('data',()=>{}); return req.on('end',()=>send(res, req.method==='DELETE'?200:201, []));
      }
      // app_state_bak writes are persisted for real too — insert (tagCurrentState, migration)
      // and delete (deleteTag), each real, RLS-shaped, .select()-checked call sites this app
      // makes since the backup-to-Supabase move (2026-08-23, docs/DECISIONS.md P1). Scoped
      // narrowly, same reasoning as finance_invoices above — everything else still no-ops.
      if(t==='app_state_bak'){
        const table=TABLES.app_state_bak;
        if(req.method==='DELETE'){
          let want=u.query.bak_id; if(Array.isArray(want))want=want[0];
          const m=String(want||'').match(/^eq\.(.*)$/);
          const id=m?m[1]:null;
          const removed=[];
          for(let i=table.length-1;i>=0;i--){ if(id!=null&&String(table[i].bak_id)===id){ removed.push(...table.splice(i,1)); } }
          return send(res,200, removed);
        }
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          const written=payload.map(row=>{
            const newRow=Object.assign({bak_id:++_bakIdSeq, created_at:new Date().toISOString(), note:null, data:null}, row);
            table.push(newRow);
            return newRow;
          });
          return send(res,201, written);
        });
      }
      // M15 capture tables — lines: DELETE .in('transaction_ref',[...]) then INSERT (delete-
      // then-insert per touched transaction_ref); gates: POST upsert on_conflict=transaction_ref
      // (latest wins). Mirrors exactly what js/65-universal-importer.js's flushPendingCapture()
      // actually sends, so a probe here proves the real write shape, not an assumed one.
      if(t==='finance_expense_lines_capture'||t==='finance_expense_gate_capture'){
        const table=TABLES[t];
        if(req.method==='DELETE'){
          let want=u.query.transaction_ref; if(Array.isArray(want))want=want[0];
          const m=String(want||'').match(/^in\.\((.*)\)$/);
          const refs=m?m[1].split(',').map(s=>s.trim()):[];
          const removed=[];
          for(let i=table.length-1;i>=0;i--){ if(refs.indexOf(String(table[i].transaction_ref))>=0){ removed.push(...table.splice(i,1)); } }
          return send(res,200, removed);
        }
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          let onConflict=u.query.on_conflict; if(Array.isArray(onConflict))onConflict=onConflict[0];
          const written=payload.map(row=>{
            if(onConflict==='transaction_ref'){
              const ix=table.findIndex(r=>r.transaction_ref===row.transaction_ref);
              if(ix>=0){ table[ix]=Object.assign({},table[ix],row,{captured_at:new Date().toISOString()}); return table[ix]; }
            }
            const newRow=Object.assign({id: row.id || ('mock-cap-'+Math.random().toString(36).slice(2))}, row, {captured_at:row.captured_at||new Date().toISOString()});
            table.push(newRow);
            return newRow;
          });
          return send(res,201, written);
        });
      }
      // PATCH = UPDATE (2026-09-02). Before this, every non-GET on finance_invoices was treated
      // as an insert — an update from the app quietly ADDED a stray row to the mock table and
      // returned it, so a .select()+row-count check could never fail here and the harness could
      // not model "RLS refused the update" at all. Now: apply the eq./is./in. filters from the
      // query string exactly like PostgREST, update the matching rows in place, and return only
      // those — zero matches returns [] (the silent-refusal shape the app must now detect).
      // Same for finance_targets and client_profiles, the other tables the Finance layers
      // update and previously fell through to the blanket `201 []`.
      // 2026-09-02 attack round 6: the same honest UPDATE for the tables the Leads/Events/linker
      // layers update, so their new row-count checks can be exercised here too.
      if(req.method==='PATCH'&&(t==='finance_invoices'||t==='finance_targets'||t==='client_profiles'||t==='ksa_events'||t==='businesses'||t==='finance_client_links'||t==='app_users')){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let patch={}; try{ patch=JSON.parse(body||'{}'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(Object.prototype.hasOwnProperty.call(patch,'year')) return send(res,400,{message:'cannot insert a non-DEFAULT value into column "year"',code:'428C9'});
          const table=TABLES[t]||[];
          let rows=table.slice();
          Object.keys(u.query||{}).forEach(k=>{
            if(k==='select'||k==='order'||k==='limit'||k==='offset'||k==='on_conflict')return;
            let val=u.query[k]; if(Array.isArray(val))val=val[0]; val=String(val||'');
            let m;
            if((m=val.match(/^eq\.(.*)$/))) rows=rows.filter(r=>String(r[k])===m[1]);
            else if(val==='is.null') rows=rows.filter(r=>r[k]==null);
            else if(val==='not.is.null') rows=rows.filter(r=>r[k]!=null);
            else if((m=val.match(/^in\.\((.*)\)$/))){ const set=m[1].split(',').map(x=>x.replace(/^"|"$/g,'')); rows=rows.filter(r=>set.includes(String(r[k]))); }
          });
          rows.forEach(r=>{ Object.assign(r,patch); if(t==='finance_invoices')deriveFinanceInvoice(r); });
          return send(res,200, rows);
        });
      }
      if(t==='finance_targets'&&req.method==='POST'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          TABLES.finance_targets=TABLES.finance_targets||[];
          const written=payload.map(row=>{ const ix=TABLES.finance_targets.findIndex(r=>+r.year===+row.year); if(ix>=0){ TABLES.finance_targets[ix]=Object.assign({},TABLES.finance_targets[ix],row); return TABLES.finance_targets[ix]; } TABLES.finance_targets.push(row); return row; });
          return send(res,201, written);
        });
      }
      if(t==='finance_invoices'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          // `year` is GENERATED ALWAYS AS (EXTRACT(year FROM invoice_date))::integer STORED on
          // the real table (verified against the live schema, docs/DECISIONS.md M13) — Postgres
          // refuses ANY statement that assigns it explicitly, even a matching value, and because
          // PostgREST sends one batch as ONE insert/upsert statement, a single row carrying it
          // fails the WHOLE batch — nothing in the batch is written, matching the real symptom
          // the owner hit (27 intended, 0 actually written). Mirrored here so a regression in the
          // app's own payload-building code (spreading a full existing row back into a write) is
          // caught locally, not only against the live database.
          if(payload.some(row=>Object.prototype.hasOwnProperty.call(row,'year'))){
            return send(res,400,{message:'cannot insert a non-DEFAULT value into column "year"',code:'428C9',hint:'Column "year" is a generated column.'});
          }
          let onConflict=u.query.on_conflict; if(Array.isArray(onConflict))onConflict=onConflict[0];
          const table=TABLES.finance_invoices;
          const written=payload.map(row=>{
            if(onConflict==='id' && row.id){
              const ix=table.findIndex(r=>r.id===row.id);
              if(ix>=0){ table[ix]=deriveFinanceInvoice(Object.assign({},table[ix],row)); return table[ix]; }
            }
            const newRow=deriveFinanceInvoice(Object.assign({id: row.id || ('mock-fi-'+(++_finIdSeq))}, row));
            table.push(newRow);
            return newRow;
          });
          return send(res,201, written);
        });
      }
      // contacts PATCH persisted for real (2026-09-02): js/72's write-through edits a
      // table-sourced contact by id — the probe must see the edit survive a reload.
      if(t==='contacts' && req.method==='PATCH'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let patch={}; try{ patch=JSON.parse(body||'{}'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          let want=u.query.id; if(Array.isArray(want))want=want[0];
          const m=String(want||'').match(/^eq\.(.*)$/); const id=m?m[1]:null;
          const hit=(TABLES.contacts||[]).filter(r=>id?String(r.id)===id:false);
          hit.forEach(r=>Object.assign(r,patch));
          return send(res,200,hit);
        });
      }
      // ksa_events: DELETE by id returns the removed rows; INSERT returns the new row (2026-09-02).
      if(t==='ksa_events'&&req.method==='DELETE'){
        let want=u.query.id; if(Array.isArray(want))want=want[0];
        const m=String(want||'').match(/^eq\.(.*)$/); const id=m?m[1]:null;
        const removed=[]; const table=TABLES.ksa_events||[];
        for(let i=table.length-1;i>=0;i--){ if(id&&String(table[i].id)===id){ removed.push(...table.splice(i,1)); } }
        return send(res,200,removed);
      }
      // businesses INSERT / UPSERT (2026-09-02): the app's save path expects id+legacy_id back for
      // every row it sent; fewer rows back is the silent-refusal shape it must now detect.
      // client_profiles INSERT (2026-09-02, attack round 11): js/27's manual profile form expects
      // its row back; a plain 201 [] hid a refusal behind a reload that showed nothing new.
      if(t==='client_profiles'&&req.method==='POST'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          TABLES.client_profiles=TABLES.client_profiles||[];
          const written=payload.map(row=>{ const newRow=Object.assign({id:row.id||('mock-cp-'+Math.random().toString(36).slice(2)),created_at:new Date().toISOString()},row); TABLES.client_profiles.push(newRow); return newRow; });
          return send(res,201,written);
        });
      }
      if(t==='businesses'&&req.method==='POST'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          if(process.env.MOCK_REFUSE_BUSINESS_WRITES==='1') return send(res,201,[]);   // sabotage switch for the probe
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          const table=TABLES.businesses;
          const written=payload.map(row=>{
            let ix=row.id?table.findIndex(r=>String(r.id)===String(row.id)):-1;
            if(ix<0&&row.legacy_id) ix=table.findIndex(r=>String(r.legacy_id)===String(row.legacy_id));
            if(ix>=0){ table[ix]=Object.assign({},table[ix],row); return {id:table[ix].id,legacy_id:table[ix].legacy_id}; }
            const newRow=Object.assign({id:row.id||('mock-biz-'+Math.random().toString(36).slice(2))},row);
            table.push(newRow); return {id:newRow.id,legacy_id:newRow.legacy_id};
          });
          return send(res,201,written);
        });
      }
      if((t==='ksa_events'||t==='ksa_event_signups'||t==='finance_client_links')&&req.method==='POST'){
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          TABLES[t]=TABLES[t]||[];
          const key=t==='ksa_event_signups'?'event_id':t==='finance_client_links'?'client_group':'id';
          const written=payload.map(row=>{
            const ix=row[key]!=null?TABLES[t].findIndex(r=>String(r[key])===String(row[key])):-1;
            if(ix>=0){ TABLES[t][ix]=Object.assign({},TABLES[t][ix],row); return TABLES[t][ix]; }
            const newRow=Object.assign({id:row.id||('mock-'+t+'-'+Math.random().toString(36).slice(2))},row);
            TABLES[t].push(newRow); return newRow;
          });
          return send(res,201,written);
        });
      }
      // v59 record tables (2026-09-02, attack round 10): honest UPSERT by id (rows back) and
      // DELETE by id=in.(...) (removed rows back). MOCK_REFUSE_OPS_WRITES=1 answers [] to every
      // write — the silent-refusal shape js/35 must now detect instead of recording "synced".
      if(/^app_(requests|offers|projects|bookings|invoices)$/.test(t)){
        const table=TABLES[t]=TABLES[t]||[];
        if(req.method==='DELETE'){
          if(process.env.MOCK_REFUSE_OPS_WRITES==='1') return send(res,200,[]);
          let want=u.query.id; if(Array.isArray(want))want=want[0];
          const m=String(want||'').match(/^in\.\((.*)\)$/); const ids=m?m[1].split(',').map(s=>s.replace(/^"|"$/g,'')):[];
          const removed=[]; for(let i=table.length-1;i>=0;i--){ if(ids.includes(String(table[i].id))) removed.push(...table.splice(i,1)); }
          return send(res,200,removed);
        }
        let body=''; req.on('data',c=>body+=c);
        return req.on('end',()=>{
          if(process.env.MOCK_REFUSE_OPS_WRITES==='1') return send(res,201,[]);
          let payload=[]; try{ payload=JSON.parse(body||'[]'); }catch(_){ return send(res,400,{message:'invalid JSON body'}); }
          if(!Array.isArray(payload)) payload=[payload];
          const written=payload.map(row=>{ const ix=table.findIndex(r=>String(r.id)===String(row.id)); if(ix>=0){ table[ix]=Object.assign({},table[ix],row); return table[ix]; } table.push(row); return row; });
          return send(res,201,written);
        });
      }
      return send(res,201,[]);
    }
    // apply simple eq filters from the query string (e.g. id=eq.<uuid>) like real PostgREST,
    // so .eq(...).maybeSingle() returns exactly the matching row (not row[0] of the whole table).
    Object.keys(u.query||{}).forEach(k=>{
      if(k==='select'||k==='order'||k==='limit'||k==='offset')return;
      let val=u.query[k]; if(Array.isArray(val))val=val[0];
      const m=String(val||'').match(/^eq\.(.*)$/);
      if(m){ const want=m[1]; rows=rows.filter(r=>String(r[k])===want); }
    });
    // json-path filter used by the events layer: funnel_details->>event_name=not.is.null
    Object.keys(u.query||{}).forEach(k=>{
      if(!k.includes('->>'))return;
      let val=u.query[k]; if(Array.isArray(val))val=val[0];
      const [col,key]=k.split('->>');
      if(String(val)==='not.is.null') rows=rows.filter(r=>r[col]&&r[col][key]!=null&&r[col][key]!=='');
    });
    // alias select over a json path: select=ev:funnel_details->>event_name
    const selRaw=Array.isArray(u.query.select)?u.query.select[0]:u.query.select;
    const am=selRaw&&String(selRaw).match(/^(\w+):(\w+)->>(\w+)$/);
    if(am) rows=rows.map(r=>({[am[1]]:(r[am[2]]||{})[am[3]]??null}));
    // .order(col,{ascending}) / .limit(n) — additive, only applied when those query params are
    // actually present, so every existing caller that never passes them is unaffected. Added
    // 2026-08-23 for the Supabase-backed backup list (app_state_history/app_state_bak), the
    // first callers in this app to actually need real ordering from the mock.
    let orderRaw=Array.isArray(u.query.order)?u.query.order[0]:u.query.order;
    if(orderRaw){
      const [col,dir]=String(orderRaw).split('.');
      const asc=dir!=='desc';
      rows=rows.slice().sort((a,b)=>{
        const av=a[col],bv=b[col];
        if(av===bv)return 0;
        return (av>bv?1:-1)*(asc?1:-1);
      });
    }
    let limitRaw=Array.isArray(u.query.limit)?u.query.limit[0]:u.query.limit;
    if(limitRaw!=null) rows=rows.slice(0,parseInt(limitRaw,10)||rows.length);
    const single=(req.headers.accept||'').includes('vnd.pgrst.object');
    return send(res,200, single?(rows[0]||null):rows, {'Content-Range':'0-'+Math.max(rows.length-1,0)+'/'+rows.length});
  }
  // Serve a real file if it exists; otherwise fall back to index.html (mirrors the vercel.json
  // SPA rewrite) so deep paths like /leads or /clients and browser reloads work as in production.
  let f=path==='/'?'/index.html':path; let body=null;
  try{ body=fs.readFileSync(APP+f); }
  catch(_){ try{ body=fs.readFileSync(APP+'/index.html'); f='/index.html'; }catch(e){ res.writeHead(404); return res.end('nf'); } }
  res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':(f.endsWith('.js')?'application/javascript':'text/plain')}); res.end(body);
 }).listen(port);
}
