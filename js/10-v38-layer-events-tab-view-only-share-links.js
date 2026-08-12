/* ===== v38 layer: Events tab + view-only share links (additive, safe) ===== */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sb2=null;
function client(){ if(!sb2&&window.supabase){try{sb2=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sb2; }
function esc2(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ---------- detect share-view URL: /s/<token> or /s/<token>/<section> ---------- */
var SHARE=(function(){var m=String(location.pathname||'').match(/^\/s\/([A-Za-z0-9\-]{16,})(?:\/([a-z]+))?/);return m?{token:m[1],sec:m[2]||'dashboard'}:null;})();
window.__isShareView=!!SHARE;

/* ================= EVENTS TAB ================= */
var EV_STATUS={confirmed:['Confirmed','#dff5e1','#1e7a34'],needs_verification:['Needs check','#fff3d6','#8b5b1f'],stale:['Stale','#fddede','#a3242c'],outside_window:['Outside window','#e9e9e9','#666'],outside_ksa:['Outside KSA','#e0e6f7','#3a4f9e'],no_date:['No date','#eee','#888']};
var EV_VERT={Travel:['#e0eef4','#1f6f8b'],Tech:['#f3e0ec','#8b3a62'],Study:['#e8f2dd','#4a7c1f'],Other:['#f2ead2','#8a6d3b']};
var evFilter={vertical:'all',status:'all',q:'',opp:'all'};
var evLoaded=false, evLoading=false;

try{
  if(typeof TITLES==='object')TITLES.events=['Events','KSA events radar — sales & partnership opportunities calendar'];
  if(typeof VIEWS!=='undefined'&&VIEWS.push&&!VIEWS.some(function(v){return v.id==='events';})){
    var ic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    var ix=VIEWS.findIndex(function(v){return v.id==='offers';});
    VIEWS.splice(ix>=0?ix+1:VIEWS.length,0,{id:'events',label:'Events',ic:ic,primary:true});
  }
}catch(e){console.warn('v38 nav',e);}

function loadEvents(cb){
  if(evLoading)return; evLoading=true;
  var c=client(); if(!c){evLoading=false;return;}
  c.from('ksa_events').select('*').order('start_date',{ascending:true,nullsFirst:false}).then(function(r){
    evLoading=false;
    if(r.error){console.warn('events load',r.error);DB.ksaEvents=DB.ksaEvents||[];}
    else DB.ksaEvents=r.data||[];
    evLoaded=true; if(cb)cb();
    try{if(current==='events')render();}catch(_){}
  });
}

function evPill(txt,bg,fg){return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:'+bg+';color:'+fg+';white-space:nowrap">'+esc2(txt)+'</span>';}
function evDate(e){
  if(!e.start_date)return '<span style="color:var(--muted)">—</span>';
  var s=e.start_date,en=e.end_date;
  var f=function(d){try{return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}catch(_){return d;}};
  return '<span style="white-space:nowrap;font-weight:600">'+f(s)+(en&&en!==s?' – '+f(en):'')+' '+String(s).slice(0,4)+'</span>';
}
function canEditEvents(){ return !window.__isShareView && window.__userTier && window.__userTier!=='viewer'; }

window.renderEvents=function(v){
  if(!evLoaded){ v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Loading events…</div>'; loadEvents(); return; }
  var E=(DB.ksaEvents||[]);
  var list=E.filter(function(e){
    if(evFilter.vertical!=='all'&&e.vertical!==evFilter.vertical)return false;
    if(evFilter.status!=='all'&&e.status!==evFilter.status)return false;
    if(evFilter.opp==='sales'&&!e.opportunity_sales)return false;
    if(evFilter.opp==='partner'&&!e.opportunity_partner)return false;
    if(evFilter.q){var q=evFilter.q.toLowerCase();if(((e.name_en||'')+' '+(e.name_ar||'')+' '+(e.city||'')+' '+(e.venue||'')+' '+(e.organiser||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  var kpiConfirmed=E.filter(function(e){return e.status==='confirmed';}).length;
  var kpiSales=E.filter(function(e){return e.opportunity_sales;}).length;
  var kpiPartner=E.filter(function(e){return e.opportunity_partner;}).length;
  var h='';
  h+='<div class="card" style="margin-bottom:12px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding:14px 18px">';
  h+='<div><div style="font-size:22px;font-weight:800">'+E.length+'</div><div style="font-size:11px;color:var(--muted)">Total events</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#1e7a34">'+kpiConfirmed+'</div><div style="font-size:11px;color:var(--muted)">Confirmed</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#1a5c9e">'+kpiSales+'</div><div style="font-size:11px;color:var(--muted)">Sales prospects</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#a35216">'+kpiPartner+'</div><div style="font-size:11px;color:var(--muted)">Partner / competitor</div></div>';
  h+='<div style="margin-left:auto;display:flex;gap:8px">';
  if(canEditEvents())h+='<button class="btn pri sm" onclick="evOpenModal()">+ Add event</button>';
  if(!window.__isShareView)h+='<button class="btn ghost sm" onclick="shareCurrentView()">Share view-only link</button>';
  h+='</div></div>';
  h+='<div class="card" style="margin-bottom:12px;padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px">';
  h+='<select id="evF_v" style="padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit"><option value="all">All verticals</option>'+Object.keys(EV_VERT).map(function(k){return '<option '+(evFilter.vertical===k?'selected':'')+'>'+k+'</option>';}).join('')+'</select>';
  h+='<select id="evF_s" style="padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit"><option value="all">All statuses</option>'+Object.keys(EV_STATUS).map(function(k){return '<option value="'+k+'" '+(evFilter.status===k?'selected':'')+'>'+EV_STATUS[k][0]+'</option>';}).join('')+'</select>';
  h+='<select id="evF_o" style="padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit"><option value="all" '+(evFilter.opp==='all'?'selected':'')+'>All opportunities</option><option value="sales" '+(evFilter.opp==='sales'?'selected':'')+'>Sales prospect</option><option value="partner" '+(evFilter.opp==='partner'?'selected':'')+'>Partner / competitor</option></select>';
  h+='<input id="evF_q" placeholder="Search name, city, venue…" value="'+esc2(evFilter.q)+'" style="padding:7px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;min-width:200px">';
  h+='<span style="margin-left:auto;color:var(--muted);font-size:12px">'+list.length+' of '+E.length+' shown</span></div>';
  h+='<div class="card" style="padding:0;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>';
  ['Event','Vertical','Status','Dates','City','Venue','Opportunity','Pri','Notes',''].forEach(function(c2){h+='<th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border-bottom:1px solid var(--line,#e6e8ec);white-space:nowrap">'+c2+'</th>';});
  h+='</tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="10" style="padding:40px;text-align:center;color:var(--muted)">No events match these filters.</td></tr>';
  list.forEach(function(e){
    var vt=EV_VERT[e.vertical]||EV_VERT.Other, stt=EV_STATUS[e.status]||EV_STATUS.no_date;
    h+='<tr style="border-bottom:1px solid var(--line,#eef0f5)">';
    h+='<td style="padding:9px 10px;min-width:180px"><div style="font-weight:600">'+esc2(e.name_en)+'</div>'+(e.name_ar?'<div style="font-size:11px;color:var(--muted);direction:rtl;text-align:right">'+esc2(e.name_ar)+'</div>':'')+(e.link?'<a href="'+esc2(e.link)+'" target="_blank" rel="noopener" style="font-size:11px">Website ↗</a>':'')+'</td>';
    h+='<td style="padding:9px 10px">'+evPill(e.vertical,vt[0],vt[1])+'</td>';
    h+='<td style="padding:9px 10px">'+evPill(stt[0],stt[1],stt[2])+'</td>';
    h+='<td style="padding:9px 10px">'+evDate(e)+'</td>';
    h+='<td style="padding:9px 10px;white-space:nowrap">'+esc2(e.city||'—')+'</td>';
    h+='<td style="padding:9px 10px;max-width:160px">'+esc2(e.venue||'—')+'</td>';
    h+='<td style="padding:9px 10px;white-space:nowrap">'+(e.opportunity_sales?evPill('Sales','#dceeff','#1a5c9e')+' ':'')+(e.opportunity_partner?evPill('Partner','#ffe6d5','#a35216'):'')+((!e.opportunity_sales&&!e.opportunity_partner)?'—':'')+'</td>';
    h+='<td style="padding:9px 10px;text-align:center;font-weight:700">'+(e.priority||'—')+'</td>';
    h+='<td style="padding:9px 10px;max-width:240px;font-size:11.5px;color:var(--muted)">'+esc2(e.notes||'')+'</td>';
    h+='<td style="padding:9px 10px;white-space:nowrap">'+(canEditEvents()?'<button class="btn ghost sm" onclick="evOpenModal(\''+e.id+'\')">Edit</button> <button class="btn ghost sm" style="color:#a3242c" onclick="evDelete(\''+e.id+'\')">Del</button>':'')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  v.innerHTML=h;
  var b1=document.getElementById('evF_v');if(b1)b1.onchange=function(){evFilter.vertical=this.value;render();};
  var b2=document.getElementById('evF_s');if(b2)b2.onchange=function(){evFilter.status=this.value;render();};
  var b3=document.getElementById('evF_o');if(b3)b3.onchange=function(){evFilter.opp=this.value;render();};
  var b4=document.getElementById('evF_q');if(b4)b4.oninput=function(){evFilter.q=this.value;render();var x=document.getElementById('evF_q');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}};
};

window.evDelete=function(id){
  if(!canEditEvents())return;
  var e=(DB.ksaEvents||[]).find(function(x){return x.id===id;});
  if(!e)return;
  if(!confirm('Delete "'+(e.name_en||'this event')+'"? This removes it for the whole team.'))return;
  client().from('ksa_events').delete().eq('id',id).then(function(r){
    if(r.error){alert('Could not delete: '+r.error.message);return;}
    DB.ksaEvents=DB.ksaEvents.filter(function(x){return x.id!==id;});render();
  });
};

window.evOpenModal=function(id){
  if(!canEditEvents())return;
  var e=(DB.ksaEvents||[]).find(function(x){return x.id===id;})||{vertical:'Travel',status:'needs_verification',priority:3,opportunity_sales:false,opportunity_partner:false};
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(20,22,32,.55);display:flex;align-items:center;justify-content:center;padding:20px';
  function fld(lab,inner){return '<div style="margin-bottom:10px"><label style="font-size:11.5px;font-weight:700;color:#55596A;display:block;margin-bottom:3px">'+lab+'</label>'+inner+'</div>';}
  var inp='style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #E3DCCF;border-radius:8px;font:inherit;font-size:13px"';
  ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:22px" onclick="event.stopPropagation()">'+
    '<div style="font-size:16px;font-weight:800;margin-bottom:14px">'+(id?'Edit event':'Add event')+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">'+
    fld('Name (English) *','<input id="em_ne" '+inp+' value="'+esc2(e.name_en||'')+'">')+
    fld('Name (Arabic)','<input id="em_na" dir="rtl" '+inp+' value="'+esc2(e.name_ar||'')+'">')+
    fld('Vertical','<select id="em_v" '+inp+'>'+Object.keys(EV_VERT).map(function(k){return '<option '+(e.vertical===k?'selected':'')+'>'+k+'</option>';}).join('')+'</select>')+
    fld('Status','<select id="em_s" '+inp+'>'+Object.keys(EV_STATUS).map(function(k){return '<option value="'+k+'" '+(e.status===k?'selected':'')+'>'+EV_STATUS[k][0]+'</option>';}).join('')+'</select>')+
    fld('Start date','<input id="em_sd" type="date" '+inp+' value="'+esc2(e.start_date||'')+'">')+
    fld('End date','<input id="em_ed" type="date" '+inp+' value="'+esc2(e.end_date||'')+'">')+
    fld('City','<input id="em_c" '+inp+' value="'+esc2(e.city||'')+'">')+
    fld('Venue','<input id="em_ve" '+inp+' value="'+esc2(e.venue||'')+'">')+
    fld('Organiser','<input id="em_o" '+inp+' value="'+esc2(e.organiser||'')+'">')+
    fld('Website link','<input id="em_l" '+inp+' value="'+esc2(e.link||'')+'">')+
    fld('Priority (1 = top)','<select id="em_p" '+inp+'>'+[1,2,3,4,5].map(function(n){return '<option '+(e.priority===n?'selected':'')+'>'+n+'</option>';}).join('')+'</select>')+
    fld('Opportunity','<div style="display:flex;gap:14px;padding-top:6px;font-size:13px"><label><input type="checkbox" id="em_os" '+(e.opportunity_sales?'checked':'')+'> Sales</label><label><input type="checkbox" id="em_op" '+(e.opportunity_partner?'checked':'')+'> Partner</label></div>')+
    '</div>'+
    fld('Notes','<textarea id="em_n" rows="3" '+inp+'>'+esc2(e.notes||'')+'</textarea>')+
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button class="btn ghost sm" id="em_x">Cancel</button><button class="btn pri sm" id="em_ok">'+(id?'Save changes':'Add event')+'</button></div></div>';
  ov.onclick=function(){ov.remove();};
  document.body.appendChild(ov);
  document.getElementById('em_x').onclick=function(){ov.remove();};
  document.getElementById('em_ok').onclick=function(){
    var g=function(i){var x=document.getElementById(i);return x?x.value.trim():'';};
    if(!g('em_ne')){alert('The English name is required.');return;}
    var row={name_en:g('em_ne'),name_ar:g('em_na')||null,vertical:g('em_v'),status:g('em_s'),start_date:g('em_sd')||null,end_date:g('em_ed')||null,city:g('em_c')||null,venue:g('em_ve')||null,organiser:g('em_o')||null,link:g('em_l')||null,priority:Number(g('em_p'))||3,opportunity_sales:document.getElementById('em_os').checked,opportunity_partner:document.getElementById('em_op').checked,notes:g('em_n')||null,updated_at:new Date().toISOString()};
    var q=id?client().from('ksa_events').update(row).eq('id',id):client().from('ksa_events').insert(row);
    q.then(function(r){
      if(r.error){alert('Could not save: '+r.error.message);return;}
      ov.remove(); evLoaded=false; loadEvents();
    });
  };
};

/* hook render for events view */
try{
  var _r0=window.render;
  window.render=function(){
    var o=_r0.apply(this,arguments);
    try{ if(current==='events'){var v=document.getElementById('view');if(v)renderEvents(v);} }catch(e){console.warn('v38 events render',e);}
    return o;
  };
}catch(e){console.warn('v38 hook',e);}

/* /events route on boot */
try{ if(!SHARE&&/^\/events\/?$/.test(location.pathname)){ setTimeout(function(){try{current='events';render();}catch(_){}},600);} }catch(_){}

/* ================= VIEW-ONLY SHARE LINKS ================= */
window.shareCurrentView=function(){
  var c=client(); if(!c)return;
  c.auth.getSession().then(function(s){
    var TT=function(m){try{if(typeof toast==='function'){toast(m);return;}}catch(_){}alert(m);};
    if(!(s&&s.data&&s.data.session)){TT('Sign in first to create a share link.');return;}
    var sec=(typeof current!=='undefined'&&current)?current:'dashboard';
    c.from('share_links').insert({scope:'all',created_by:s.data.session.user.id}).select('token').single().then(function(r){
      if(r.error){TT('Could not create link: '+r.error.message);return;}
      var base=/^https?:/.test(location.origin)&&location.host.indexOf('directksab2b.com')>=0?location.origin:'https://www.directksab2b.com';
      var url=base+'/s/'+r.data.token+'/'+sec;
      var done=function(){TT('View-only link copied to clipboard — anyone with it can view (not edit) this workspace.');};
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done,done);else done();
    });
  });
};

/* add a Share button next to the sign-out button for logged-in users */
if(!SHARE){ (function addShare(n){
  try{
    var tools=document.querySelector('.tools');
    if(!tools){ if((n||0)<30)setTimeout(function(){addShare((n||0)+1);},400); return; }
    if(!document.getElementById('cl_share')){
      var b=document.createElement('button'); b.id='cl_share'; b.className='btn sm ghost'; b.textContent='Share (view-only)'; b.style.fontWeight='700';
      b.onclick=function(){shareCurrentView();};
      tools.appendChild(b);
    }
    if(window.render&&!window.render.__shareBtn){var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);try{var t=document.querySelector('.tools');if(t&&!document.getElementById('cl_share'))addShare(0);}catch(_){}return o;};window.render.__shareBtn=true;}
  }catch(_){}
})(0); }

/* ---------- share-view boot: load data via edge function, no login ---------- */
if(SHARE){
  /* keep the login overlay from ever showing */
  var killOv=setInterval(function(){
    try{ document.querySelectorAll('body > div').forEach(function(d){ if(d.style&&String(d.style.zIndex)==='2147483000')d.remove(); }); }catch(_){}
  },250);
  setTimeout(function(){clearInterval(killOv);
    setInterval(function(){try{document.querySelectorAll('body > div').forEach(function(d){if(d.style&&String(d.style.zIndex)==='2147483000')d.remove();});}catch(_){}},2000);
  },15000);

  /* view-only styling: hide edit controls, add banner */
  document.addEventListener('DOMContentLoaded',function(){
    try{
      document.body.setAttribute('data-share','1');
      var st=document.createElement('style');
      st.textContent='body[data-share="1"] .btn.pri,body[data-share="1"] .btn.danger,body[data-share="1"] #cl_share,body[data-share="1"] #cl_signout{display:none!important}'+
        'body[data-share="1"] input,body[data-share="1"] textarea{pointer-events:none;background:#fafafa}'+
        'body[data-share="1"] #v38banner{display:flex!important}';
      document.head.appendChild(st);
      var bn=document.createElement('div');
      bn.id='v38banner';
      bn.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147481000;background:#1C1E2B;color:#fff;font:12.5px Cairo,Inter,system-ui,Arial;padding:8px 16px;display:flex;align-items:center;gap:10px;justify-content:center';
      bn.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:#F79009;display:inline-block"></span><span>View-only shared link — you can look, but nothing can be changed.&nbsp;&nbsp;<span dir="rtl">رابط للعرض فقط — لا يمكن تعديل أي شيء.</span>&nbsp;<a href="/" style="color:#FF9A4D;font-weight:700;text-decoration:none">Sign in to edit · تسجيل الدخول للتعديل</a></span>';
      document.body.appendChild(bn);
      document.body.style.paddingTop='36px';
    }catch(_){}
  });

  /* neutralise all persistence in share mode (server also blocks writes) */
  var lock=setInterval(function(){try{ if(typeof save==='function'){window.save=function(){};} }catch(_){}},500);
  setTimeout(function(){clearInterval(lock);},20000);

  function shareRowToApp(r,FBYID){
    var base=(r.raw&&typeof r.raw==='object')?r.raw:{};
    var o={};for(var k in base)o[k]=base[k];
    o.id=r.legacy_id||r.id;
    if(r.name)o.name=r.name; if(r.name_ar!=null)o.nameAr=r.name_ar;
    if(r.source!=null)o.source=r.source; if(r.status)o.status=r.status;
    if(r.category!=null)o.category=r.category; if(r.website!=null)o.website=r.website;
    if(r.notes)o.notes=r.notes;
    o.isClient=(r.is_client===true)||base.isClient===true;
    var C2S={'new':'Prospect','contacted':'Contacted','in_discussion':'Qualified','proposal':'Proposal','won':'Won','lost':'Lost','on_hold':'Prospect'};
    o.stage=C2S[r.stage]||base.stage||'Prospect';
    var f=FBYID[r.funnel_id]; o.funnelKey=f?f.key:null; o.funnelName=f?f.name_en:null; o.funnelNameAr=f?f.name_ar:null;
    o.funnelDetails=r.funnel_details||{};
    o.nextActionDate=r.next_action_date||null; o.nextActionNote=r.next_action_note||null;
    return o;
  }

  function bootShare(n){
    if(typeof DB==='undefined'||typeof render!=='function'){ if((n||0)<80)setTimeout(function(){bootShare((n||0)+1);},250); return; }
    fetch(SUPA_URL+'/rest/v1/rpc/share_view',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY},body:JSON.stringify({p_token:SHARE.token})})
    .then(function(res){return res.json();})
    .then(function(j){
      if(!j||!j.ok){ document.body.innerHTML='<div style="max-width:460px;margin:110px auto;text-align:center;font-family:Cairo,Inter,system-ui,Arial;color:#1C1E2B"><h2 style="color:#FF6B00">Direct Business</h2><p style="font-size:14.5px;line-height:1.7">This share link is not valid any more.<br>Ask the person who sent it for a fresh link.</p></div>'; return; }
      try{
        var d=j.data||{};
        Object.keys(d.blob||{}).forEach(function(k){ if(k!=='businesses'){try{DB[k]=d.blob[k];}catch(_){}}});
        var FBYID={};(d.funnels||[]).forEach(function(f){FBYID[f.id]=f;});
        window.__FUNNELS=d.funnels||[];
        DB.businesses=(d.businesses||[]).map(function(r){return shareRowToApp(r,FBYID);});
        DB.ksaEvents=d.events||[]; evLoaded=true;
        var sec=SHARE.sec;
        var ok=['dashboard','leads','clients','bookings','invoices','tickets','offers','airlines','vendors','sops','slas','sopsla','ops','reports','events','today'];
        current=(ok.indexOf(sec)>=0)?(sec==='today'?'dashboard':sec):'dashboard';
        render();
      }catch(e){console.warn('share boot',e);}
    })
    .catch(function(e){ console.warn('share fetch',e); });
  }
  bootShare(0);
}

console.info('%c[v38 events + share links] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v38 layer failed',e);}})();
