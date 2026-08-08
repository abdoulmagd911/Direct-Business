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
  app_users:[{id:UID,email:'test@directksa.com',full_name:'QA Test Account',role:'admin',active:true,created_at:'2026-08-08T00:00:00Z',must_change_password:false,allowed_pages:null}],
  app_state:[{id:1,data:BLOB,updated_at:'2026-08-08T13:52:37Z',updated_by:'test@directksa.com'}],
  funnels:[{id:'f1',key:'default',name_en:'Default',name_ar:'افتراضي',color:'orange',sort_order:1,active:true,field_template:[],created_at:null,updated_at:null}],
  finance_invoices:[...Array(15)].map((_,i)=>({id:'i'+i,invoice_no:'INV-'+(1000+i),zatca_dpin:null,client_group:'Test Company '+i,customer_raw_name:'Test Company '+i,invoice_date:'2026-0'+((i%6)+1)+'-15',month:'June',quarter:'Q'+((i%4)+1),year:2026,products:'Air',service_type:'Ticketing',record_type:'b2b',total_incl_vat_sar:11500+i*10,wallet_portion_sar:0,revenue_sar:11500+i*10,cost_sar:10000,profit_sar:1500+i*10,amount_received_sar:11500,amount_remaining_sar:0,collection_due_date:'2026-07-15',integrity_status:'verified_paid',exclusion_reason:null,notes:null,source_batch:'seed',created_at:'2026-06-01T00:00:00Z',updated_at:'2026-06-01T00:00:00Z',deleted_at:null})),
  ksa_events:[...Array(8)].map((_,i)=>({id:'e'+i,name_en:'Event '+i,name_ar:'فعالية '+i,vertical:['Travel','Tech','Study','Other'][i%4],status:'confirmed',start_date:'2026-09-1'+(i%9),end_date:'2026-09-1'+(i%9),city:'Riyadh',venue:'RICEC',organiser:'Org',link:'https://example.com',opportunity_sales:i%2===0,opportunity_partner:i%3===0,priority:(i%5)+1,notes:null,created_at:null,updated_at:null})),
  ksa_events_audit:[], airlines:[...Array(12)].map((_,i)=>({id:'ai'+i,legacy_id:'A'+i,name:'Airline '+i,code:'X'+i,icao:'XX'+i,stock:null,country:'KSA',type:'FSC',ksa:'yes',alliance:null,adm_risk:'low',gds:[],providers:[],frontend:null,deeplinks:null,manual:null,adm_policy:null,ticketing:{},notes:null,raw:{},contacts:[],contacts_source:null,contacts_updated_at:null})),
  providers:[...Array(6)].map((_,i)=>({id:'p'+i,legacy_id:'P'+i,name:'Provider '+i,kind:'GDS',source:'direct',portal:'https://example.com',login:'user',adm_policy:null,process:null,payment:'credit',contacts:[],notes:null,raw:{}})),
  sops:[...Array(5)].map((_,i)=>({id:'s'+i,legacy_id:'S'+i,title:'SOP '+i,category:'Ops',market_standard:'yes',edge:'n/a',body:'Body text',author:'QA',updated_at:'2026-08-01T00:00:00Z',raw:{}})),
  slas:[...Array(5)].map((_,i)=>({id:'sl'+i,legacy_id:'SL'+i,metric:'Response time',direct_business:'2h',market:'4h',whales:'1h',flag:'green',raw:{}})),
  requests:[...Array(4)].map((_,i)=>({id:'r'+i,legacy_id:'R'+i,title:'Request '+i,business_id:'b'+i,client_name:'Test Company '+i,stage:'open',owner:'QA',priority:'high',supplier:'Provider 1',pnr:'ABC12'+i,cost:900,sell:1100,sla_due:'2026-08-20T00:00:00Z',created_at:'2026-08-01T00:00:00Z',raw:{}})),
  offers:[], external_refs:[], master_db_companies:[], generated_documents:[], app_state_history:[], app_state_bak:[], access_allowlist:[], share_links:[]
};
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
  if(path.startsWith('/rest/v1/rpc/')) return send(res,200,{});
  if(path.startsWith('/rest/v1/')){
    const t=path.replace('/rest/v1/','').split('?')[0];
    let rows=TABLES[t]||[];
    if(req.method!=='GET') return send(res,201,[]);
    const single=(req.headers.accept||'').includes('vnd.pgrst.object');
    return send(res,200, single?(rows[0]||null):rows, {'Content-Range':'0-'+Math.max(rows.length-1,0)+'/'+rows.length});
  }
  let f=path==='/'||path==='/ops'?'/index.html':path;
  try{ const body=fs.readFileSync(APP+f); res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain'}); res.end(body); }
  catch(e){ res.writeHead(404); res.end('nf'); }
 }).listen(port);
}
