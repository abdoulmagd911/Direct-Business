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
const BLOB={schemaVersion:24,meta:{},settings:{lang:'en',currency:'SAR'},agency:{name:'Direct'},recents:[],audit:[],
  businesses:[],airlines:[],vendors:[],ndcProviders:[],bookings:[],invoices:[],offers:[],requests:[],projects:[],sops:[],slas:[],
  sopsWhale:[],syncEvents:[],templateLibrary:[],bundleTemplates:[],travelerProfiles:[],serviceFeePricing:[],integrations:{},
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
  finance_invoices:[...Array(15)].map((_,i)=>{const _svc=['Flights','Hotels','Visa','Support Services','Packages'][i%5];const _mo=['January','February','March','April','May','June'][i%6];const _q='Q'+(Math.floor((i%6)/3)+1);const _tot=5000+i*777;const _cost=_svc==='Support Services'?0:Math.round(_tot*0.88);const _rev=_tot-_cost;return {id:'i'+i,invoice_no:'11636'+(1000+i),zatca_dpin:(i%3)?('TTIN-'+(9000+i)):null,client_group:'Test Company '+(i%6),customer_raw_name:'Test Company '+(i%6),invoice_date:'2026-0'+((i%6)+1)+'-15',month:_mo,quarter:_q,year:2026,products:_svc,service_type:_svc,record_type:'b2b',total_incl_vat_sar:_tot,wallet_portion_sar:0,revenue_sar:_rev,cost_sar:_cost,profit_sar:_rev,amount_received_sar:_tot,amount_remaining_sar:0,collection_due_date:'2026-07-15',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed',created_at:'2026-06-01T00:00:00Z',updated_at:'2026-06-01T00:00:00Z',deleted_at:null};}),
  ksa_events:[...Array(8)].map((_,i)=>({id:'e'+i,name_en:'Event '+i,name_ar:'فعالية '+i,vertical:['Travel','Tech','Study','Other'][i%4],status:'confirmed',start_date:i===3?'2026-08-01':'2026-09-1'+(i%9),end_date:i===3?'2026-08-02':'2026-09-1'+(i%9),city:'Riyadh',venue:'RICEC',organiser:'Org',link:'https://example.com',opportunity_sales:i%2===0,opportunity_partner:i%3===0,priority:(i%5)+1,notes:null,approach:['attend','stand','mine','skip','undecided'][i%5],approach_status:i===0?'signed_up':'not_started',exhibitor_list_url:i===2?'https://example.com/exhibitors':null,created_at:null,updated_at:null})),
  ksa_event_signups:[{event_id:'e2',login_email:'business@directksa.com',login_password:'throwaway-1',signed_up_by:'Abdulrahman',updated_at:null}],
  ksa_events_audit:[], airlines:[...Array(12)].map((_,i)=>({id:'ai'+i,legacy_id:'A'+i,name:'Airline '+i,code:'X'+i,icao:'XX'+i,stock:null,country:'KSA',type:'FSC',ksa:'yes',alliance:null,adm_risk:'low',gds:[],providers:[],frontend:null,deeplinks:null,manual:null,adm_policy:null,ticketing:{},notes:null,raw:{},contacts:[],contacts_source:null,contacts_updated_at:null})),
  providers:[...Array(6)].map((_,i)=>({id:'p'+i,legacy_id:'P'+i,name:'Provider '+i,kind:'GDS',source:'direct',portal:'https://example.com',login:'user',adm_policy:null,process:null,payment:'credit',contacts:[],notes:null,raw:{}})),
  sops:[...Array(5)].map((_,i)=>({id:'s'+i,legacy_id:'S'+i,title:'SOP '+i,category:'Ops',market_standard:'yes',edge:'n/a',body:'Body text',author:'QA',updated_at:'2026-08-01T00:00:00Z',raw:{}})),
  slas:[...Array(5)].map((_,i)=>({id:'sl'+i,legacy_id:'SL'+i,metric:'Response time',direct_business:'2h',market:'4h',whales:'1h',flag:'green',raw:{}})),
  requests:[...Array(4)].map((_,i)=>({id:'r'+i,legacy_id:'R'+i,title:'Request '+i,business_id:'b'+i,client_name:'Test Company '+i,stage:'open',owner:'QA',priority:'high',supplier:'Provider 1',pnr:'ABC12'+i,cost:900,sell:1100,sla_due:'2026-08-20T00:00:00Z',created_at:'2026-08-01T00:00:00Z',raw:{}})),
  offers:[], external_refs:[], master_db_companies:[], generated_documents:[], app_state_history:[], app_state_bak:[], access_allowlist:[], share_links:[],
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
  if(path==='/auth/v1/user') return send(res,200,SESSION.user);
  if(path==='/auth/v1/logout') return send(res,204,'');
  if(path.startsWith('/auth/v1/recover')) return send(res,200,{});
  if(path.startsWith('/functions/v1/admin-users')){
    let body='';
    req.on('data',c=>body+=c);
    return req.on('end',()=>{
      let p={}; try{p=JSON.parse(body||'{}');}catch(_){}
      const A=p.action;
      if(A==='list') return send(res,200,{users:TABLES.app_users.map(u=>({id:u.id,email:u.email,full_name:u.full_name,role:u.role,active:u.active,must_change_password:u.must_change_password,created_at:u.created_at}))});
      if(A==='create'){ const nu={id:'u-'+(TABLES.app_users.length),email:String(p.email||'').toLowerCase(),full_name:p.full_name||'',role:p.role||'team_member',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:true,allowed_pages:['today','leads','clients']}; TABLES.app_users.push(nu); return send(res,200,{ok:true,email:nu.email,temp_password:'Riyadh1234!'}); }
      if(A==='set_role'){ const u=TABLES.app_users.find(x=>x.id===p.id); if(u)u.role=p.role; return send(res,200,{ok:true}); }
      if(A==='set_active'){ const u=TABLES.app_users.find(x=>x.id===p.id); if(u)u.active=p.active===true; return send(res,200,{ok:true}); }
      if(A==='reset_password'){ return send(res,200,{ok:true,temp_password:'Jeddah5678@'}); }
      if(A==='clear_must_change') return send(res,200,{ok:true});
      return send(res,200,{error:'unknown'});
    });
  }
  if(path==='/__rpclog') return send(res,200,RPCLOG);
  if(path.startsWith('/rest/v1/rpc/')){
    let body='';
    req.on('data',c=>body+=c);
    return req.on('end',()=>{
      let parsed=null; try{parsed=JSON.parse(body||'{}');}catch(_){}
      const fn=path.replace('/rest/v1/rpc/','');
      RPCLOG.push({fn, keys: parsed?Object.keys(parsed.patch||parsed.payload||{}):[], arg: parsed?Object.keys(parsed):[]});
      // Spec 7b (2026-08-21): app_role() and my_page_access() read the SAME app_users row
      // the login layer already reads, mirroring the real functions exactly —
      //   app_role()        = role from app_users where id = auth.uid() and active
      //   my_page_access()  = null for admin, else that row's page_access
      // so a probe driving MOCK_ROLE/MOCK_PAGE_ACCESS gets one consistent answer everywhere,
      // not two stubs that could quietly disagree with each other.
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
    if(req.method!=='GET') return send(res,201,[]);
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
