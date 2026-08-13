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
var EV_STATUS_AR={confirmed:'مؤكدة',needs_verification:'بحاجة تأكيد',stale:'قديمة',outside_window:'خارج الفترة',outside_ksa:'خارج السعودية',no_date:'بلا تاريخ'};
var EV_VERT={Travel:['#e0eef4','#1f6f8b'],Tech:['#f3e0ec','#8b3a62'],Study:['#e8f2dd','#4a7c1f'],Other:['#f2ead2','#8a6d3b']};
var EV_VERT_AR={Travel:'سفر',Tech:'تقنية',Study:'دراسة',Other:'أخرى'};
/* Same convention as the other layers: whole-string Arabic, chosen at render time. */
function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar';}catch(_){return false;}}
function L(en,ar){return isAr()?ar:en;}
var MOVE_EN={stand:['Have a stand','#ffe6d5','#c2560a'],attend:['Go & meet','#dff5e1','#1e7a34'],mine:['Mine the website','#dceeff','#1a5c9e'],skip:['Skip','#e9e9e9','#666'],undecided:['Not decided','#fff8ec','#8b5b1f']};
var MOVE_AR={stand:['جناح','#ffe6d5','#c2560a'],attend:['حضور ولقاءات','#dff5e1','#1e7a34'],mine:['جمع من الموقع','#dceeff','#1a5c9e'],skip:['تخطّي','#e9e9e9','#666'],undecided:['لم يُحدَّد','#fff8ec','#8b5b1f']};
var MOVE=MOVE_EN; /* kept for the lookups below; the label is chosen by mv() at render */
function mv(k){return (isAr()?MOVE_AR:MOVE_EN)[k];}
var PROG_EN={not_started:'Not started',signed_up:'Signed up',in_progress:'Working on it',leads_added:'Leads collected',done:'Done'};
var PROG_AR={not_started:'لم يبدأ',signed_up:'تم التسجيل',in_progress:'جاري العمل',leads_added:'تم جمع العملاء',done:'منجز'};
var PROG=PROG_EN;
function pg(k){return (isAr()?PROG_AR:PROG_EN)[k];}
/* one normaliser so the pill, the filter, the sort and the counts always agree */
function moveOf(e){var m=(e&&e.approach)||'undecided';return MOVE[m]?m:'undecided';}
function progOf(e){var p=(e&&e.approach_status)||'not_started';return PROG[p]?p:'not_started';}

/* past:false — the calendar opens on what is still ahead. Events that have
   already finished are one click away, never the first thing anyone reads. */
var F={vertical:'all',status:'all',move:'all',ours:false,past:false,q:''};
var loaded=false, loading=false;
var SIGNUPS={};            /* event_id -> row from ksa_event_signups (team-only table) */
var LEADS={};              /* normalised event name -> lead count from businesses */
var extrasLoaded=false;

function canEdit(){ return !window.__isShareView && window.__userTier && window.__userTier!=='viewer'; }

/* On a phone the eight columns pushed the DATE off-screen — on a page whose whole
   job is "when". Below 760px each row becomes a stacked card instead, with the
   quiet columns labelled so nothing loses its meaning. Injected once. */
(function mobileCards(){
  if(document.getElementById('v64-ev-css'))return;
  var st=document.createElement('style'); st.id='v64-ev-css';
  st.textContent='@media(max-width:760px){'
    +'.v64-ev-table thead{display:none}'
    +'.v64-ev-table,.v64-ev-table tbody,.v64-ev-table tr,.v64-ev-table td{display:block;width:100%}'
    +'.v64-ev-table tr{border:1px solid var(--line,#e6e8ec)!important;border-radius:10px;margin:0 0 10px;padding:8px 2px;background:var(--card,#fff)}'
    +'.v64-ev-table td{border:none!important;padding:3px 12px!important;max-width:none!important}'
    +'.v64-ev-table td:empty{display:none}'
    +'.v64-ev-table td[data-l]:not(:empty):before{content:attr(data-l) " ";font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted,#7C8194);font-weight:700}'
    +'.v64-ev-table td[data-act]{padding-top:8px!important;border-top:1px solid var(--line,#eef0f5)!important;margin-top:4px}'
    +'}';
  document.head.appendChild(st);
})();

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
  if(en<now)return [L('ended','انتهت'),true];
  if(s<=now&&now<=en)return [L('happening now','جارية الآن'),false];
  var n=Math.round((s-now)/86400000);
  return [n===1?L('tomorrow','غدًا'):L('in '+n+' days','بعد '+n+' يوم'),false];
}
function hasEnded(e){ var r=relDay(e); return !!(r&&r[1]); }
function evDate(e){
  if(!e.start_date)return '<span style="color:var(--muted)">'+L('no date yet','لا يوجد تاريخ بعد')+'</span>';
  var s=e.start_date,en=e.end_date;
  var f=function(d){try{return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});}catch(_){return d;}};
  return '<span dir="ltr" style="white-space:nowrap;font-weight:600;display:inline-block">'+f(s)+(en&&en!==s?' – '+f(en):'')+' '+String(s).slice(0,4)+'</span>';
}
function statusLabel(k){return isAr()?(EV_STATUS_AR[k]||k):((EV_STATUS[k]||[k])[0]);}
function vertLabel(v){return isAr()?(EV_VERT_AR[v]||v):v;}
function sel(id,opts,cur,allLabel){
  var h='<select id="'+id+'" style="padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit"><option value="all">'+allLabel+'</option>';
  opts.forEach(function(o){h+='<option value="'+esc(o[0])+'" '+(cur===o[0]?'selected':'')+'>'+esc(o[1])+'</option>';});
  return h+'</select>';
}

window.renderEvents=function(v){
  if(!loaded){ v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+L('Loading events…','جاري تحميل الفعاليات…')+'</div>'; loadAll(); return; }
  var E=(DB.ksaEvents||[]);
  var list=E.filter(function(e){
    if(F.vertical!=='all'&&e.vertical!==F.vertical)return false;
    if(F.status!=='all'&&e.status!==F.status)return false;
    if(!F.past&&hasEnded(e))return false;
    if(F.move!=='all'&&moveOf(e)!==F.move)return false;
    if(F.ours&&moveOf(e)!=='stand'&&moveOf(e)!=='attend')return false;
    if(F.q){var q=F.q.toLowerCase();if(((e.name_en||'')+' '+(e.name_ar||'')+' '+(e.city||'')+' '+(e.venue||'')+' '+(e.organiser||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  /* Counts describe the LIVE calendar (what is still ahead), so the tiles never
     promise more than the list below them shows. */
  var AHEAD=E.filter(function(e){return !hasEnded(e);});
  var n=function(k){return AHEAD.filter(function(e){return moveOf(e)===k;}).length;};
  var endedCount=E.length-AHEAD.length;
  var h='';
  /* Each tile is a filter — tapping "Not decided" is the fastest route to the
     events still waiting on a decision. */
  var tile=function(key,val,label,color){
    var on=(key==='undecided'||key==='stand'||key==='attend'||key==='mine')&&F.move===key;
    return '<div data-evstat="'+key+'" title="Show only these" style="cursor:pointer;padding:2px 8px;border-radius:8px;'+(on?'background:var(--wash-orange,#fff3ec);':'')+'">'
      +'<div style="font-size:22px;font-weight:800;'+(color?'color:'+color:'')+'">'+val+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+label+'</div></div>';
  };
  h+='<div class="card" style="margin-bottom:12px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:14px 18px">';
  h+=tile('all',AHEAD.length,L('Still ahead','القادمة'),'');
  h+=tile('stand',n('stand'),mv('stand')[0],'#c2560a');
  h+=tile('attend',n('attend'),mv('attend')[0],'#1e7a34');
  h+=tile('mine',n('mine'),mv('mine')[0],'#1a5c9e');
  h+=tile('undecided',n('undecided'),mv('undecided')[0],'#8b5b1f');
  h+='<div style="margin-left:auto;display:flex;gap:8px">';
  if(canEdit())h+='<button class="btn pri sm" onclick="evOpenModal()">'+L('+ Add event','+ إضافة فعالية')+'</button>';
  h+='</div></div>';
  h+='<div class="card" style="margin-bottom:12px;padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px">';
  h+='<button id="evF_ours" class="btn sm '+(F.ours?'pri':'ghost')+'" title="'+L('Only the events we take part in — a stand or going in person','الفعاليات التي نشارك فيها فقط — جناح أو حضور شخصي')+'" style="font-weight:700">🎪 '+L('We take part','نشارك فيها')+'</button>';
  if(endedCount)h+='<button id="evF_past" class="btn sm '+(F.past?'pri':'ghost')+'" title="'+L('Events that already finished','فعاليات انتهت')+'">'+(F.past?L('Hide past','إخفاء المنتهية'):L('Past','المنتهية')+' ('+endedCount+')')+'</button>';
  h+=sel('evF_m',Object.keys(MOVE_EN).map(function(k){return [k,mv(k)[0]];}),F.move,L('All moves','كل الخطط'));
  h+=sel('evF_v',Object.keys(EV_VERT).map(function(k){return [k,vertLabel(k)];}),F.vertical,L('All verticals','كل القطاعات'));
  h+=sel('evF_s',Object.keys(EV_STATUS).map(function(k){return [k,statusLabel(k)];}),F.status,L('All statuses','كل الحالات'));
  h+='<input id="evF_q" placeholder="'+L('Search name, city, venue…','ابحث بالاسم أو المدينة أو المكان…')+'" value="'+esc(F.q)+'" style="padding:7px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;min-width:180px">';
  h+='<span style="margin-'+(isAr()?'right':'left')+':auto;color:var(--muted);font-size:12px">'+L(list.length+' of '+E.length+' shown', 'عرض '+list.length+' من '+E.length)+'</span></div>';
  h+='<div class="card" style="padding:0;overflow:auto"><table class="v64-ev-table" style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>';
  (isAr()?['الفعالية','خطتنا','القطاع','الحالة','التواريخ','المدينة','ملاحظات','']
        :['Event','Our move','Vertical','Status','Dates','City','Notes','']).forEach(function(c2){h+='<th style="text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border-bottom:1px solid var(--line,#e6e8ec);white-space:nowrap">'+c2+'</th>';});
  h+='</tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--muted)">'+L('No events match these filters.','لا توجد فعاليات مطابقة.')+'</td></tr>';
  list.forEach(function(e){
    var vt=EV_VERT[e.vertical]||EV_VERT.Other, stt=EV_STATUS[e.status]||EV_STATUS.no_date;
    var mvk=moveOf(e), pgk=progOf(e), mm=mv(mvk);
    var moveCell=pill(mm[0],mm[1],mm[2]);
    if(mvk!=='skip'&&mvk!=='undecided')moveCell+='<div style="font-size:10.5px;color:'+((pgk==='done'||pgk==='leads_added')?'#1e7a34;font-weight:600':'var(--muted)')+';margin-top:3px;white-space:nowrap">'+esc(pg(pgk))+'</div>';
    var lu=safeUrl(e.exhibitor_list_url);
    if(lu)moveCell+='<div><a href="'+esc(lu)+'" target="_blank" rel="noopener" style="font-size:10.5px">'+L('Companies list ↗','قائمة الشركات ↗')+'</a></div>';
    var su=SIGNUPS[e.id];
    if(su&&(su.login_email||su.signed_up_by))moveCell+='<div style="font-size:10.5px;color:var(--muted);margin-top:2px;white-space:nowrap">🔑 '+esc(su.login_email||'')+(su.signed_up_by?' ('+esc(su.signed_up_by)+')':'')+'</div>';
    var lc=LEADS[normName(e.name_en)]||0;
    if(lc)moveCell+='<div style="font-size:10.5px;color:#1e7a34;font-weight:600;margin-top:2px">'+L(lc+' lead'+(lc===1?'':'s')+' in the app', lc+' عميل محتمل في التطبيق')+'</div>';
    var lk=safeUrl(e.link);
    var rel=relDay(e), ended=rel&&rel[1];
    var hiPri=(e.priority||0)>=4&&!ended; /* an ended event is no longer a priority */
    var oppTags=(e.opportunity_sales?pill(L('Sales','عميل محتمل'),'#dceeff','#1a5c9e')+' ':'')+(e.opportunity_partner?pill(L('Partner','منافس/شريك'),'#ffe6d5','#a35216'):'');
    h+='<tr style="border-bottom:1px solid var(--line,#eef0f5)'+(ended?';opacity:.55':'')+(hiPri?';border-left:3px solid #FBAE16':'')+'">';
    h+='<td style="padding:9px 10px;min-width:180px"><div style="font-weight:600">'+esc(e.name_en)+(hiPri?' <span title="'+L('High priority','أولوية عالية')+'" style="color:#FBAE16">★</span>':'')+'</div>'+(e.name_ar?'<div style="font-size:11px;color:var(--muted);direction:rtl;text-align:left">'+esc(e.name_ar)+'</div>':'')+(oppTags?'<div style="margin-top:2px">'+oppTags+'</div>':'')+(lk?'<a href="'+esc(lk)+'" target="_blank" rel="noopener" style="font-size:11px">'+L('Website ↗','الموقع ↗')+'</a>':'')+'</td>';
    h+='<td data-l="'+L('Our move','خطتنا')+'" style="padding:9px 10px">'+moveCell+'</td>';
    h+='<td style="padding:9px 10px">'+pill(vertLabel(e.vertical),vt[0],vt[1])+'</td>';
    h+='<td style="padding:9px 10px">'+pill(statusLabel(e.status),stt[1],stt[2])+'</td>';
    h+='<td data-l="'+L('When','متى')+'" style="padding:9px 10px">'+evDate(e)+(rel?'<div style="font-size:10.5px;color:'+(rel[0]==='happening now'?'#1e7a34;font-weight:600':'var(--muted)')+'">'+esc(rel[0])+'</div>':'')+'</td>';
    h+='<td data-l="'+L('City','المدينة')+'" style="padding:9px 10px;white-space:nowrap">'+esc(e.city||'—')+'</td>';
    h+='<td style="padding:9px 10px;max-width:260px;font-size:11.5px;color:var(--muted)"><div style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="'+esc(e.notes||'')+'">'+esc(e.notes||'')+'</div></td>';
    h+='<td data-act="1" style="padding:9px 10px;white-space:nowrap">'+(canEdit()?'<button class="btn ghost sm" onclick="evOpenModal(\''+esc(e.id)+'\')">'+L('Edit','تعديل')+'</button> <button class="btn ghost sm" style="color:#a3242c" onclick="evDelete(\''+esc(e.id)+'\')">'+L('Del','حذف')+'</button>':'')+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  v.innerHTML=h;
  var b;
  (b=document.getElementById('evF_ours'))&&(b.onclick=function(){F.ours=!F.ours;render();});
  (b=document.getElementById('evF_past'))&&(b.onclick=function(){F.past=!F.past;render();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-evstat]'),function(el){
    el.onclick=function(){
      var k=el.getAttribute('data-evstat');
      F.move=(k==='all'||F.move===k)?'all':k;  /* tapping the active tile clears it */
      if(k!=='all')F.ours=false;
      render();
    };
  });
  (b=document.getElementById('evF_m'))&&(b.onchange=function(){F.move=this.value;render();});
  (b=document.getElementById('evF_v'))&&(b.onchange=function(){F.vertical=this.value;render();});
  (b=document.getElementById('evF_s'))&&(b.onchange=function(){F.status=this.value;render();});
  (b=document.getElementById('evF_q'))&&(b.oninput=function(){F.q=this.value;render();var x=document.getElementById('evF_q');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}});
};

window.evDelete=function(id){
  if(!canEdit())return;
  var e=(DB.ksaEvents||[]).find(function(x){return x.id===id;});
  if(!e)return;
  if(!confirm(L('Delete "'+(e.name_en||'this event')+'"? This removes it for the whole team.','حذف «'+(e.name_en||'')+'»؟ سيُحذف للفريق بالكامل.')))return;
  client().from('ksa_events').delete().eq('id',id).then(function(r){
    if(r.error){alert(L('Could not delete: ','تعذّر الحذف: ')+r.error.message);return;}
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
    +'<div style="font-size:17px;font-weight:800;margin-bottom:2px">'+(id?L('Edit event','تعديل فعالية'):L('Add event','إضافة فعالية'))+'</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">'+L('Saved to the shared calendar — the whole team sees it.','يُحفظ في التقويم المشترك — يراه الفريق بالكامل.')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div style="grid-column:1/-1">'+fld(L('Event name (English) *','اسم الفعالية (إنجليزي) *'),inp('ev_n',e.name_en,''))+'</div>'
    +'<div style="grid-column:1/-1">'+fld(L('Event name (Arabic)','اسم الفعالية (عربي)'),'<input id="ev_nar" dir="rtl" value="'+esc(e.name_ar||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')+'</div>'
    +fld(L('Start date','تاريخ البداية'),'<input id="ev_start" type="date" value="'+esc(e.start_date||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
    +fld(L('End date','تاريخ النهاية'),'<input id="ev_end" type="date" value="'+esc(e.end_date||'')+'" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
    +fld(L('City','المدينة'),inp('ev_city',e.city,'Riyadh'))
    +fld(L('Venue','المكان'),inp('ev_venue',e.venue,''))
    +fld(L('Vertical','القطاع'),selHtml('ev_vert',Object.keys(EV_VERT).map(function(k){return [k,vertLabel(k)];}),e.vertical))
    +fld(L('Status','الحالة'),selHtml('ev_stat',Object.keys(EV_STATUS).map(function(k){return [k,statusLabel(k)];}),e.status))
    +fld(L('Priority (1–5)','الأولوية (1–5)'),selHtml('ev_pri',[[1,L('1 — Low','1 — منخفضة')],[2,'2'],[3,L('3 — Medium','3 — متوسطة')],[4,'4'],[5,L('5 — High','5 — عالية')]],e.priority||3))
    +fld(L('Organiser','المنظّم'),inp('ev_org',e.organiser,''))
    +'<div style="grid-column:1/-1">'+fld(L('Official link','الرابط الرسمي'),inp('ev_link',e.link,'https://'))+'</div>'
    +'<div style="grid-column:1/-1">'+fld(L('Our move — what we do with this event','خطتنا — ماذا نفعل بهذه الفعالية'),selHtml('ev_move',[
        ['undecided',L('Not decided yet','لم يُحدَّد بعد')],
        ['stand',L('Have a stand — book a booth and sell from it','جناح — نحجز جناحًا ونبيع منه')],
        ['attend',L('Go & meet — walk the floor, collect leads in person','حضور ولقاءات — نحضر شخصيًا ونجمع العملاء')],
        ['mine',L('Mine the website — sign up online, pull the companies list & contacts (no travel)','جمع من الموقع — تسجيل إلكتروني وسحب قائمة الشركات وجهات الاتصال (بدون سفر)')],
        ['skip',L('Skip — not for us','تخطّي — لا تناسبنا')]],moveOf(e)))+'</div>'
    +fld(L('Progress','التقدّم'),selHtml('ev_prog',Object.keys(PROG_EN).map(function(k){return [k,pg(k)];}),progOf(e)))
    +fld(L('Companies list (link)','رابط قائمة الشركات'),inp('ev_listurl',e.exhibitor_list_url,'https://'))
    +'<div style="grid-column:1/-1;border:1px solid var(--line,#e6e8ec);border-radius:8px;padding:12px;background:var(--wash,#fafbfc)">'
      +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.02em;margin-bottom:8px">'+L('Event-site login — the account made on their website (team can see it)','حساب موقع الفعالية — الحساب الذي أنشأناه على موقعهم (يراه الفريق)')+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      +fld(L('Email used','البريد المستخدم'),inp('ev_su_email',su.login_email,L('your work email','بريد العمل')))
      +fld(L('Password','كلمة المرور'),'<input id="ev_su_pass" type="password" value="'+esc(su.login_password==null?'':su.login_password)+'" placeholder="'+L('use a throwaway password','استخدم كلمة مرور مؤقتة')+'" autocomplete="new-password" style="width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit">')
      +'<div style="grid-column:1/-1">'+fld(L('Who signed up','من سجّل'),inp('ev_su_by',su.signed_up_by||(id?'':(window.__userName||'')),L('name','الاسم')))+'</div>'
      +'</div></div>'
    +'<div style="grid-column:1/-1">'+fld(L('Opportunity','الفرصة'),'<label style="margin-'+(isAr()?'left':'right')+':16px;font-size:13px"><input type="checkbox" id="ev_opps" '+(e.opportunity_sales?'checked':'')+'> '+L('Sales prospect','عميل محتمل')+'</label><label style="font-size:13px"><input type="checkbox" id="ev_oppp" '+(e.opportunity_partner?'checked':'')+'> '+L('Competitor/partner intel','معلومات منافس/شريك')+'</label>')+'</div>'
    +'<div style="grid-column:1/-1">'+fld(L('Notes','ملاحظات'),'<textarea id="ev_notes" style="width:100%;min-height:56px;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;resize:vertical">'+esc(e.notes||'')+'</textarea>')+'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line,#e6e8ec)">'
    +'<button class="btn ghost sm" id="ev_cancel">'+L('Cancel','إلغاء')+'</button><button class="btn pri sm" id="ev_save">'+L('Save event','حفظ الفعالية')+'</button></div></div>';
  document.body.appendChild(ov);
  /* Escape closes it — the missing-Escape gripe is app-wide; at least this dialog obeys. */
  var onEsc=function(x){ if(x.key==='Escape'){ close(); } };
  function close(){ try{ov.remove();}catch(_){} document.removeEventListener('keydown',onEsc); }
  document.addEventListener('keydown',onEsc);
  ov.addEventListener('click',function(x){if(x.target===ov)close();});
  document.getElementById('ev_cancel').onclick=close;
  try{ document.getElementById('ev_n').focus(); }catch(_){}
  document.getElementById('ev_save').onclick=function(){
    var gv=function(fid){var el=document.getElementById(fid);return el?el.value.trim():'';};
    var name=gv('ev_n'); if(!name){alert(L('Event name is required.','اسم الفعالية مطلوب.'));return;}
    if(!id){
      var clash=(DB.ksaEvents||[]).filter(function(x){return normName(x.name_en)===normName(name);});
      if(clash.length&&!confirm(L('"'+name+'" is already on the calendar. Add it again anyway?','«'+name+'» موجودة بالفعل في التقويم. هل تضيفها مرة أخرى؟')))return;
    }
    var start=gv('ev_start')||null, end=gv('ev_end')||null;
    if(start&&end&&end<start){alert(L('End date cannot be before start date.','تاريخ النهاية لا يمكن أن يسبق البداية.'));return;}
    var link=gv('ev_link'), listurl=gv('ev_listurl');
    if(link&&!/^https?:\/\//i.test(link)){alert(L('Official link must start with http:// or https://','الرابط الرسمي يجب أن يبدأ بـ http:// أو https://'));return;}
    if(listurl&&!/^https?:\/\//i.test(listurl)){alert(L('Companies list link must start with http:// or https://','رابط قائمة الشركات يجب أن يبدأ بـ http:// أو https://'));return;}
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
      if(r.error){alert(L('Could not save: ','تعذّر الحفظ: ')+r.error.message);return;}
      var savedId=(r.data&&r.data.id)||id;
      var s={event_id:savedId,login_email:gv('ev_su_email')||null,login_password:gv('ev_su_pass')||null,signed_up_by:gv('ev_su_by')||null,updated_at:new Date().toISOString()};
      var had=!!SIGNUPS[savedId], has=s.login_email||s.login_password||s.signed_up_by;
      var done=function(){close();loaded=false;loadAll();};
      if(savedId&&(has||had)){
        c.from('ksa_event_signups').upsert(s).then(function(r2){
          if(r2.error)alert(L('Event saved, but the site login did not save: ','حُفظت الفعالية، لكن حساب الموقع لم يُحفظ: ')+r2.error.message);
          else SIGNUPS[savedId]=s;
          done();
        });
      } else done();
    });
  };
};
}catch(e){console.warn('v64 events layer',e);}})();
