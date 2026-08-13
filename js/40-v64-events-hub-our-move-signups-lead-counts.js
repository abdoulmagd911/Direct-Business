/* ===== v64 layer: Events tab grows Our move, per-event site logins, lead counts =====
   Supersedes v38's renderEvents/evOpenModal/evDelete (assigned later in load order, so
   these globals win). v38 still owns the nav entry, the /events boot route and share links.
   Everything here runs behind the app login; the events data itself is authenticated-read
   in the database as of 2026-08-12, so nothing renders for anonymous visitors anywhere. */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sb=null;
function client(){ if(!sb&&window.supabase){try{sb=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sb; }
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function safeUrl(u){return (typeof u==='string'&&/^https?:\/\//i.test(u.trim()))?u.trim():null;}
function normName(s){return (s||'').toLowerCase().replace(/\s+/g,' ').trim();}

var EV_STATUS={confirmed:['Confirmed','#dff5e1','#1e7a34'],needs_verification:['Needs check','#fff3d6','#8b5b1f'],stale:['Stale','#fddede','#a3242c'],outside_window:['Outside window','#e9e9e9','#666'],outside_ksa:['Outside KSA','#e0e6f7','#3a4f9e'],no_date:['No date','#eee','#888']};
var EV_VERT={Travel:['#e0eef4','#1f6f8b'],Tech:['#f3e0ec','#8b3a62'],Study:['#e8f2dd','#4a7c1f'],Other:['#f2ead2','#8a6d3b']};
var MOVE={stand:['Have a stand','#ffe6d5','#c2560a'],attend:['Go & meet','#dff5e1','#1e7a34'],mine:['Mine the website','#dceeff','#1a5c9e'],skip:['Skip','#e9e9e9','#666'],undecided:['Not decided','#fff8ec','#8b5b1f']};
var PROG={not_started:'Not started',signed_up:'Signed up',in_progress:'Working on it',leads_added:'Leads collected',done:'Done'};
/* one normaliser so the pill, the filter, the sort and the counts always agree */
function moveOf(e){var m=(e&&e.approach)||'undecided';return MOVE[m]?m:'undecided';}
function progOf(e){var p=(e&&e.approach_status)||'not_started';return PROG[p]?p:'not_started';}

var F={vertical:'all',status:'all',move:'all',ours:false,q:''};
var loaded=false, loading=false;
var SIGNUPS={};            /* event_id -> row from ksa_event_signups (team-only table) */
var LEADS={};              /* normalised event name -> lead count from businesses */
var extrasLoaded=false;

function canEdit(){ return !window.__isShareView && window.__userTier && window.__userTier!=='viewer'; }

function loadAll(){
  if(loading)return; loading=true;
  var c=client(); if(!c){loading=false;return;}
  c.from('ksa_events').select('*').order('start_date',{ascending:true,nullsFirst:false}).then(function(r){
    loading=false;
    if(r.error){console.warn('v64 events load',r.error);DB.ksaEvents=DB.ksaEvents||[];}
    else DB.ksaEvents=r.data||[];
    loaded=true;
    try{if(current==='events')render();}catch(_){}
  });
  /* team extras: the event-site logins and the per-event lead counts.
     Both live behind sign-in; in a share view these queries return nothing and the page
     simply shows no logins and no counts. */
  if(!window.__isShareView){
    c.from('ksa_event_signups').select('*').then(function(r){
      SIGNUPS={};
      if(!r.error&&r.data)r.data.forEach(function(x){SIGNUPS[x.event_id]=x;});
      extrasLoaded=true;
      try{if(current==='events')render();}catch(_){}
    });
    /* paged 1000-by-1000 — a one-shot read silently undercounts past the API cap */
    (function page(from,acc){
      c.from('businesses').select('ev:funnel_details->>event_name').not('funnel_details->>event_name','is',null).range(from,from+999).then(function(r){
        if(r.error||!r.data){finish(acc);return;}
        acc=acc.concat(r.data);
        if(r.data.length<1000)finish(acc);else page(from+1000,acc);
      });
      function finish(rows){
        LEADS={};
        rows.forEach(function(x){var k=normName(x.ev);if(k)LEADS[k]=(LEADS[k]||0)+1;});
        try{if(current==='events')render();}catch(_){}
      }
    })(0,[]);
  }
}

function pill(txt,bg,fg){return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:'+bg+';color:'+fg+';white-space:nowrap">'+esc(txt)+'</span>';}
/* "in 12 days" / "happening now" / "ended" — so nobody has to do date math */
function relDay(e){
  if(!e.start_date)return null;
  var day=function(d){var p=String(d).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);};
  var now=new Date(); now.setHours(0,0,0,0);
  var s=day(e.start_date), en=e.end_date?day(e.end_date):s;
  if(en<now)return ['ended',true];
  if(s<=now&&now<=en)return ['happening now',false];
  var n=Math.round((s-now)/86400000);
  return [n===1?'tomorrow':'in '+n+' days',false];
}
function evDate(e){
  if(!e.start_date)return '<span style="color:var(--muted)">—</span>';
  var s=e.start_date,en=e.end_date;
  var f=function(d){try{return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}catch(_){return d;}};
  return '<span style="white-space:nowrap;font-weight:600">'+f(s)+(en&&en!==s?' – '+f(en):'')+' '+String(s).slice(0,4)+'</span>';
}
function sel(id,opts,cur,allLabel){
  var h='<select id="'+id+'" style="padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit"><option value="all">'+allLabel+'</option>';
  opts.forEach(function(o){h+='<option value="'+esc(o[0])+'" '+(cur===o[0]?'selected':'')+'>'+esc(o[1])+'</option>';});
  return h+'</select>';
}

window.renderEvents=function(v){
  if(!loaded){ v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Loading events…</div>'; loadAll(); return; }
  var E=(DB.ksaEvents||[]);
  var list=E.filter(function(e){
    if(F.vertical!=='all'&&e.vertical!==F.vertical)return false;
    if(F.status!=='all'&&e.status!==F.status)return false;
    if(F.move!=='all'&&moveOf(e)!==F.move)return false;
    if(F.ours&&moveOf(e)!=='stand'&&moveOf(e)!=='attend')return false;
    if(F.q){var q=F.q.toLowerCase();if(((e.name_en||'')+' '+(e.name_ar||'')+' '+(e.city||'')+' '+(e.venue||'')+' '+(e.organiser||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  var n=function(k){return E.filter(function(e){return moveOf(e)===k;}).length;};
  var h='';
  h+='<div class="card" style="margin-bottom:12px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding:14px 18px">';
  h+='<div><div style="font-size:22px;font-weight:800">'+E.length+'</div><div style="font-size:11px;color:var(--muted)">Total events</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#c2560a">'+n('stand')+'</div><div style="font-size:11px;color:var(--muted)">Have a stand</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#1e7a34">'+n('attend')+'</div><div style="font-size:11px;color:var(--muted)">Go & meet</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#1a5c9e">'+n('mine')+'</div><div style="font-size:11px;color:var(--muted)">Mine the website</div></div>';
  h+='<div><div style="font-size:22px;font-weight:800;color:#8b5b1f">'+n('undecided')+'</div><div style="font-size:11px;color:var(--muted)">Not decided</div></div>';
  h+='<div style="margin-left:auto;display:flex;gap:8px">';
  if(canEdit())h+='<button class="btn pri sm" onclick="evOpenModal()">+ Add event</button>';
  h+='</div></div>';
  h+='<div class="card" style="margin-bottom:12px;padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px">';
  h+='<button id="evF_ours" class="btn sm '+(F.ours?'pri':'ghost')+'" title="Only the events we take part in — a stand or going in person" style="font-weight:700">🎪 We take part</button>';
  h+=sel('evF_m',Object.keys(MOVE).map(function(k){return [k,MOVE[k][0]];}),F.move,'All moves');
  h+=sel('evF_v',Object.keys(EV_VERT).map(function(k){return [k,k];}),F.vertical,'All verticals');
  h+=sel('evF_s',Object.keys(EV_STATUS).map(function(k){return [k,EV_STATUS[k][0]];}),F.status,'All statuses');
  h+='<input id="evF_q" placeholder="Search name, city, venue…" value="'+esc(F.q)+'" style="padding:7px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;min-width:180px">';
  h+='<span style="margin-left:auto;color:var(--muted);font-size:12px">'+list.length+' of '+E.length+' shown</span></div>';
  h+='<div class="card" style="padding:0;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>';
  ['Event','Our move','Vertical','Status','Dates','City','Notes',''].forEach(function(c2){h+='<th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border-bottom:1px solid var(--line,#e6e8ec);white-space:nowrap">'+c2+'</th>';});
  h+='</tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--muted)">No events match these filters.</td></tr>';
  list.forEach(function(e){
    var vt=EV_VERT[e.vertical]||EV_VERT.Other, stt=EV_STATUS[e.status]||EV_STATUS.no_date;
    var mv=moveOf(e), pg=progOf(e), mm=MOVE[mv];
    var moveCell=pill(mm[0],mm[1],mm[2]);
    if(mv!=='skip'&&mv!=='undecided')moveCell+='<div style="font-size:10.5px;color:'+((pg==='done'||pg==='leads_added')?'#1e7a34;font-weight:600':'var(--muted)')+';margin-top:3px;white-space:nowrap">'+esc(PROG[pg])+'</div>';
    var lu=safeUrl(e.exhibitor_list_url);
    if(lu)moveCell+='<div><a href="'+esc(lu)+'" target="_blank" rel="noopener" style="font-size:10.5px">Companies list ↗</a></div>';
    var su=SIGNUPS[e.id];
    if(su&&(su.login_email||su.signed_up_by))moveCell+='<div style="font-size:10.5px;color:var(--muted);margin-top:2px;white-space:nowrap">🔑 '+esc(su.login_email||'')+(su.signed_up_by?' ('+esc(su.signed_up_by)+')':'')+'</div>';
    var lc=LEADS[normName(e.name_en)]||0;
    if(lc)moveCell+='<div style="font-size:10.5px;color:#1e7a34;font-weight:600;margin-top:2px">'+lc+' lead'+(lc===1?'':'s')+' in the app</div>';
    var lk=safeUrl(e.link);
    var rel=relDay(e), ended=rel&&rel[1];
    var hiPri=(e.priority||0)>=4&&!ended; /* an ended event is no longer a priority */
    var oppTags=(e.opportunity_sales?pill('Sales','#dceeff','#1a5c9e')+' ':'')+(e.opportunity_partner?pill('Partner','#ffe6d5','#a35216'):'');
    h+='<tr style="border-bottom:1px solid var(--line,#eef0f5)'+(ended?';opacity:.55':'')+(hiPri?';border-left:3px solid #FBAE16':'')+'">';
    h+='<td style="padding:9px 10px;min-width:180px"><div style="font-weight:600">'+esc(e.name_en)+(hiPri?' <span title="High priority" style="color:#FBAE16">★</span>':'')+'</div>'+(e.name_ar?'<div style="font-size:11px;color:var(--muted);direction:rtl;text-align:left">'+esc(e.name_ar)+'</div>':'')+(oppTags?'<div style="margin-top:2px">'+oppTags+'</div>':'')+(lk?'<a href="'+esc(lk)+'" target="_blank" rel="noopener" style="font-size:11px">Website ↗</a>':'')+'</td>';
    h+='<td style="padding:9px 10px">'+moveCell+'</td>';
    h+='<td style="padding:9px 10px">'+pill(e.vertical,vt[0],vt[1])+'</td>';
    h+='<td style="padding:9px 10px">'+pill(stt[0],stt[1],stt[2])+'</td>';
    h+='<td style="padding:9px 10px">'+evDate(e)+(rel?'<div style="font-size:10.5px;color:'+(rel[0]==='happening now'?'#1e7a34;font-weight:600':'var(--muted)')+'">'+esc(rel[0])+'</div>':'')+'</td>';
    h+='<td style="padding:9px 10px;white-space:nowrap">'+esc(e.city||'—')+'</td>';
    h+='<td style="padding:9px 10px;max-width:260px;font-size:11.5px;color:var(--muted)"><div style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="'+esc(e.notes||'')+'">'+esc(e.notes||'')+'</div></td>';
    h+='<td style="padding:9px 10px;white-space:nowrap">'+(canEdit()?'<button class="btn ghost sm" onclick="evOpenModal(\''+esc(e.id)+'\')">Edit</button> <button class="btn ghost sm" style="color:#a3242c" onclick="evDelete(\''+esc(e.id)+'\')">Del</button>':'')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  v.innerHTML=h;
  var b;
  (b=document.getElementById('evF_ours'))&&(b.onclick=function(){F.ours=!F.ours;render();});
  (b=document.getElementById('evF_m'))&&(b.onchange=function(){F.move=this.value;render();});
  (b=document.getElementById('evF_v'))&&(b.onchange=function(){F.vertical=this.value;render();});
  (b=document.getElementById('evF_s'))&&(b.onchange=function(){F.status=this.value;render();});
  (b=document.getElementById('evF_q'))&&(b.oninput=function(){F.q=this.value;render();var x=document.getElementById('evF_q');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}});
};

window.evDelete=function(id){
  if(!canEdit())return;
  var e=(DB.ksaEvents||[]).find(function(x){return x.id===id;});
  if(!e)return;
  if(!confirm('Delete "'+(e.name_en||'this event')+'"? This removes it for the whole team.'))return;
  client().from('ksa_events').delete().eq('id',id).then(function(r){
    if(r.error){alert('Could not delete: '+r.error.message);return;}
    DB.ksaEvents=DB.ksaEvents.filter(function(x){return x.id!==id;});render();
  });
};

window.evOpenModal=function(id){
  if(!canEdit())return;
  var e=(DB.ksaEvents||[]).find(function(x){return x.id===id;})||{vertical:'Travel',status:'needs_verification',priority:3,opportunity_sales:false,opportunity_partner:false,approach:'undecided',approach_status:'not_started'};
  var su=(id&&SIGNUPS[id])||{};
  var fld=function(label,inner){return '<div><label style="display:block;font-size:11px;font-weight:600;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.02em">'+label+'</label>'+inner+'</div>';};
  var inp=function(fid,val,ph){return '<input id="'+fid+'" value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">';};
  var selHtml=function(fid,opts,cur){return '<select id="'+fid+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">'+opts.map(function(o){return '<option value="'+esc(o[0])+'" '+(String(cur)===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';};
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto';
  ov.innerHTML='<div class="card" style="max-width:640px;width:100%;padding:22px 24px;background:var(--card,#fff)">'
    +'<div style="font-size:17px;font-weight:800;margin-bottom:2px">'+(id?'Edit event':'Add event')+'</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Saved to the shared calendar — the whole team sees it.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div style="grid-column:1/-1">'+fld('Event name (English) *',inp('ev_n',e.name_en,''))+'</div>'
    +'<div style="grid-column:1/-1">'+fld('Event name (Arabic)','<input id="ev_nar" dir="rtl" value="'+esc(e.name_ar||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')+'</div>'
    +fld('Start date','<input id="ev_start" type="date" value="'+esc(e.start_date||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
    +fld('End date','<input id="ev_end" type="date" value="'+esc(e.end_date||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
    +fld('City',inp('ev_city',e.city,'Riyadh'))
    +fld('Venue',inp('ev_venue',e.venue,''))
    +fld('Vertical',selHtml('ev_vert',Object.keys(EV_VERT).map(function(k){return [k,k];}),e.vertical))
    +fld('Status',selHtml('ev_stat',Object.keys(EV_STATUS).map(function(k){return [k,EV_STATUS[k][0]];}),e.status))
    +fld('Priority (1–5)',selHtml('ev_pri',[[1,'1 — Low'],[2,'2'],[3,'3 — Medium'],[4,'4'],[5,'5 — High']],e.priority||3))
    +fld('Organiser',inp('ev_org',e.organiser,''))
    +'<div style="grid-column:1/-1">'+fld('Official link',inp('ev_link',e.link,'https://'))+'</div>'
    +'<div style="grid-column:1/-1">'+fld('Our move — what we do with this event',selHtml('ev_move',[['undecided','Not decided yet'],['stand','Have a stand — book a booth and sell from it'],['attend','Go & meet — walk the floor, collect leads in person'],['mine','Mine the website — sign up online, pull the companies list & contacts (no travel)'],['skip','Skip — not for us']],moveOf(e)))+'</div>'
    +fld('Progress',selHtml('ev_prog',Object.keys(PROG).map(function(k){return [k,PROG[k]];}),progOf(e)))
    +fld('Companies list (link)',inp('ev_listurl',e.exhibitor_list_url,'https:// — exhibitor or registry page'))
    +'<div style="grid-column:1/-1;border:1px solid var(--line,#e6e8ec);border-radius:8px;padding:12px;background:var(--wash,#fafbfc)">'
      +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px">Event-site login — the account made on their website (team can see it)</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      +fld('Email used',inp('ev_su_email',su.login_email,'your work email'))
      +fld('Password','<input id="ev_su_pass" type="password" value="'+esc(su.login_password==null?'':su.login_password)+'" placeholder="use a throwaway password" autocomplete="new-password" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
      +'<div style="grid-column:1/-1">'+fld('Who signed up',inp('ev_su_by',su.signed_up_by||(id?'':(window.__userName||'')),'name'))+'</div>'
      +'</div></div>'
    +'<div style="grid-column:1/-1">'+fld('Opportunity','<label style="margin-right:16px;font-size:13px"><input type="checkbox" id="ev_opps" '+(e.opportunity_sales?'checked':'')+'> Sales prospect</label><label style="font-size:13px"><input type="checkbox" id="ev_oppp" '+(e.opportunity_partner?'checked':'')+'> Competitor/partner intel</label>')+'</div>'
    +'<div style="grid-column:1/-1">'+fld('Notes','<textarea id="ev_notes" style="width:100%;min-height:56px;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;resize:vertical">'+esc(e.notes||'')+'</textarea>')+'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line,#e6e8ec)">'
    +'<button class="btn ghost sm" id="ev_cancel">Cancel</button><button class="btn pri sm" id="ev_save">Save event</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(x){if(x.target===ov)ov.remove();});
  document.getElementById('ev_cancel').onclick=function(){ov.remove();};
  document.getElementById('ev_save').onclick=function(){
    var gv=function(fid){var el=document.getElementById(fid);return el?el.value.trim():'';};
    var name=gv('ev_n'); if(!name){alert('Event name is required.');return;}
    var start=gv('ev_start')||null, end=gv('ev_end')||null;
    if(start&&end&&end<start){alert('End date cannot be before start date.');return;}
    var link=gv('ev_link'), listurl=gv('ev_listurl');
    if(link&&!/^https?:\/\//i.test(link)){alert('Official link must start with http:// or https://');return;}
    if(listurl&&!/^https?:\/\//i.test(listurl)){alert('Companies list link must start with http:// or https://');return;}
    var data={name_en:name,name_ar:gv('ev_nar')||null,start_date:start,end_date:end,
      city:gv('ev_city')||null,venue:gv('ev_venue')||null,
      vertical:document.getElementById('ev_vert').value,status:document.getElementById('ev_stat').value,
      priority:parseInt(document.getElementById('ev_pri').value,10),organiser:gv('ev_org')||null,link:link||null,
      approach:document.getElementById('ev_move').value,approach_status:document.getElementById('ev_prog').value,
      exhibitor_list_url:listurl||null,
      opportunity_sales:document.getElementById('ev_opps').checked,opportunity_partner:document.getElementById('ev_oppp').checked,
      notes:gv('ev_notes')||null};
    var c=client();
    var q=id?c.from('ksa_events').update(data).eq('id',id).select('id').single()
            :c.from('ksa_events').insert(data).select('id').single();
    q.then(function(r){
      if(r.error){alert('Could not save: '+r.error.message);return;}
      var savedId=(r.data&&r.data.id)||id;
      var s={event_id:savedId,login_email:gv('ev_su_email')||null,login_password:gv('ev_su_pass')||null,signed_up_by:gv('ev_su_by')||null,updated_at:new Date().toISOString()};
      var had=!!SIGNUPS[savedId], has=s.login_email||s.login_password||s.signed_up_by;
      var done=function(){ov.remove();loaded=false;loadAll();};
      if(savedId&&(has||had)){
        c.from('ksa_event_signups').upsert(s).then(function(r2){
          if(r2.error)alert('Event saved, but the site login did not save: '+r2.error.message);
          else SIGNUPS[savedId]=s;
          done();
        });
      } else done();
    });
  };
};
}catch(e){console.warn('v64 events layer',e);}})();
