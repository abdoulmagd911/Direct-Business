import http from 'http'; import fs from 'fs'; import url from 'url';
const APP='/home/user/Direct-Business';
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
  is_client:i%4===0,converted_date:i%4===0?'2026-03-01':null,channels:[],prefs:{},airline_deals:[],pricing:[],notes:'Seed row',
  created_at:'2026-06-0'+((i%9)+1)+'T10:00:00Z',updated_at:'2026-08-01T10:00:00Z',raw:{},verification_source:'manual',
  needs_manual_confirmation:i%11===0,confirmation_reason:i%11===0?'No website found':null,confirmed_by:null,confirmed_at:null,
  scrub_run_id:null,funnel_id:null,funnel_details:{},stage_legacy:null,next_action_date:'2026-08-20',next_action_note:'Follow up',
  lost_reason:null,archived_at:null,archived_by:null}));
const BLOB={schemaVersion:24,meta:{},settings:{lang:'en',currency:'SAR'},agency:{name:'Direct'},recents:[],audit:[],
  businesses:[],airlines:[],vendors:[],ndcProviders:[],bookings:[],invoices:[],offers:[],requests:[],projects:[],sops:[],slas:[],
  sopsWhale:[],syncEvents:[],templateLibrary:[],bundleTemplates:[],travelerProfiles:[],serviceFeePricing:[],integrations:{},
  _bkSeed:1,_cfMergeV3:1,_invSeed:1,_oldCustMerged:1,_v20seed:1,_v21reconciled:1,_v22migrated:1,_v23migrated:1,_v24migrated:1};
const TABLES={
  businesses:biz,
  contacts:[...Array(20)].map((_,i)=>({id:'c'+i,business_id:'b'+i,name:'Contact '+i,role:'Manager',email:'c'+i+'@example.com',phone:'+96650000000'+i,verification_source:'manual',needs_manual_confirmation:false,confirmation_reason:null,confirmed_by:null,confirmed_at:null,meta:{},source:'import'})),
  activities:[...Array(10)].map((_,i)=>({id:'a'+i,business_id:'b'+i,type:'note',note:'Activity '+i,by_user:'QA',at:'2026-08-01T10:00:00Z'})),
  app_users:[{id:UID,email:'test@directksa.com',full_name:'QA Test Account',role:'admin',active:true,created_at:'2026-08-08T00:00:00Z',must_change_password:false,allowed_pages:null},
    {id:'u-assem',email:'assem.alsweed@directksa.com',full_name:'Assem Alsweed',role:'team_member',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:true,allowed_pages:['today','leads','clients']},
    {id:'u-fin',email:'finance.person@directksa.com',full_name:'Finance Person',role:'operations',active:true,created_at:'2026-08-09T00:00:00Z',must_change_password:false,allowed_pages:['today','finance']},
    {id:'u-off',email:'switched.off@directksa.com',full_name:'Switched Off',role:'viewer',active:false,created_at:'2026-08-09T00:00:00Z',must_change_password:false,allowed_pages:['today','reports']}],
  app_state:[{id:1,data:BLOB,updated_at:'2026-08-08T13:52:37Z',updated_by:'test@directksa.com'}],
  funnels:[{id:'f1',key:'default',name_en:'Default',name_ar:'افتراضي',color:'orange',sort_order:1,active:true,field_template:[],created_at:null,updated_at:null}],
  finance_invoices:[...Array(15)].map((_,i)=>{const _svc=['Flights','Hotels','Visa','Support Services','Packages'][i%5];const _mo=['January','February','March','April','May','June'][i%6];const _q='Q'+(Math.floor((i%6)/3)+1);const _tot=5000+i*777;const _cost=_svc==='Support Services'?0:Math.round(_tot*0.88);const _rev=_tot-_cost;return {id:'i'+i,invoice_no:'11636'+(1000+i),zatca_dpin:(i%3)?('TTIN-'+(9000+i)):null,client_group:'Test Company '+(i%6),customer_raw_name:'Test Company '+(i%6),invoice_date:'2026-0'+((i%6)+1)+'-15',month:_mo,quarter:_q,year:2026,products:_svc,service_type:_svc,record_type:'b2b',total_incl_vat_sar:_tot,wallet_portion_sar:0,revenue_sar:_rev,cost_sar:_cost,profit_sar:_rev,amount_received_sar:_tot,amount_remaining_sar:0,collection_due_date:'2026-07-15',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed',created_at:'2026-06-01T00:00:00Z',updated_at:'2026-06-01T00:00:00Z',deleted_at:null};}),
  ksa_events:[...Array(8)].map((_,i)=>({id:'e'+i,name_en:'Event '+i,name_ar:'فعالية '+i,vertical:['Travel','Tech','Study','Other'][i%4],status:'confirmed',start_date:'2026-09-1'+(i%9),end_date:'2026-09-1'+(i%9),city:'Riyadh',venue:'RICEC',organiser:'Org',link:'https://example.com',opportunity_sales:i%2===0,opportunity_partner:i%3===0,priority:(i%5)+1,notes:null,created_at:null,updated_at:null})),
  ksa_events_audit:[], airlines:[...Array(12)].map((_,i)=>({id:'ai'+i,legacy_id:'A'+i,name:'Airline '+i,code:'X'+i,icao:'XX'+i,stock:null,country:'KSA',type:'FSC',ksa:'yes',alliance:null,adm_risk:'low',gds:[],providers:[],frontend:null,deeplinks:null,manual:null,adm_policy:null,ticketing:{},notes:null,raw:{},contacts:[],contacts_source:null,contacts_updated_at:null})),
  providers:[...Array(6)].map((_,i)=>({id:'p'+i,legacy_id:'P'+i,name:'Provider '+i,kind:'GDS',source:'direct',portal:'https://example.com',login:'user',adm_policy:null,process:null,payment:'credit',contacts:[],notes:null,raw:{}})),
  sops:[...Array(5)].map((_,i)=>({id:'s'+i,legacy_id:'S'+i,title:'SOP '+i,category:'Ops',market_standard:'yes',edge:'n/a',body:'Body text',author:'QA',updated_at:'2026-08-01T00:00:00Z',raw:{}})),
  slas:[...Array(5)].map((_,i)=>({id:'sl'+i,legacy_id:'SL'+i,metric:'Response time',direct_business:'2h',market:'4h',whales:'1h',flag:'green',raw:{}})),
  requests:[...Array(4)].map((_,i)=>({id:'r'+i,legacy_id:'R'+i,title:'Request '+i,business_id:'b'+i,client_name:'Test Company '+i,stage:'open',owner:'QA',priority:'high',supplier:'Provider 1',pnr:'ABC12'+i,cost:900,sell:1100,sla_due:'2026-08-20T00:00:00Z',created_at:'2026-08-01T00:00:00Z',raw:{}})),
  offers:[], external_refs:[], master_db_companies:[], generated_documents:[], app_state_history:[], app_state_bak:[], access_allowlist:[], share_links:[]
};
const RPCLOG=[];
function send(res,code,body,extra={}){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'content-range','Access-Control-Allow-Methods':'*',...extra});res.end(typeof body==='string'?body:JSON.stringify(body));}
export function start(port){
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
      send(res,200,{});
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
