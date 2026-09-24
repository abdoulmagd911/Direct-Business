/* ----- Leads ----- */
let leadFilter={q:"",cat:"all",funnel:"all",stage:"all"};
let leadGroup="stage";
let leadView="board";
let openLead=null;
function getLead(id){return DB.businesses.find(b=>b.id===id);}
/* 2026-09-16 (fire #62, live): the "Invoices" key fact printed b.invoices — a number STORED on the record
   at import time. On the live cards it was wrong for 22 of 28 clients: seven training-world records said
   1–4 while the ledger holds 0 for them, and fifteen real clients said 0 while the ledger holds 1–17
   (one holds 17). The card now counts the client's live invoices the same way the finance snapshot card
   (js/38) does — through finance_client_links, via js/16's exclusion chokepoint — and shows "—" until the
   ledger has loaded (js/38 triggers that load and re-renders). Never the stored number. */
function leadInvoiceCount(b){
  try{
    var FIN=window.FIN; if(!FIN||!Array.isArray(FIN.rows)) return null;
    var uuid=(window.__bizUuid?window.__bizUuid(b.id):b.id);
    var groups=(FIN.groupsByBiz&&FIN.groupsByBiz[uuid])||null;
    if(!groups||!groups.length) return 0;
    var g={}; groups.forEach(function(x){g[x]=1;});
    var src=(typeof window.finLive==='function')?window.finLive():FIN.rows;
    var inv={}; (src||[]).forEach(function(r){ if(!r||r.deleted_at||!g[r.client_group]) return; inv[r.invoice_no||('row'+Math.random())]=1; });
    return Object.keys(inv).length;
  }catch(_){ return null; }
}
/* 2026-09-02 (reversibility audit) — this confirm used to promise that the record moves to
   the Archive, stops appearing in anyone's lists, and can be restored by an admin for a month.
   Both halves were untrue. Deleting a company removes it from DB.businesses entirely, so it can never
   reach renderArchive() (which lists DB.businesses.filter(x=>x._archived)); the cloud layer
   archives the ROW (js/02 pushCloud sets archived_at) and the loader filters archived rows
   out, so nothing in the product ever lists it again. And nothing anywhere enforces or even
   records that window: there is no purge job, no expiry column, no cleanup script (checked
   live — no pg_cron, no scheduled cleanup function). The only real reversal window in this
   system is the 24 hours hard-coded in undo_change(). House rule: an honest visible
   limitation beats a comforting false one. */
function _delWarn(){
  /* 2026-09-09 (live test AR1): the Archive page lists deleted companies and restores one — the
     warning used to say there was no such screen. */
  var ar=(typeof LANG!=='undefined'&&LANG==='ar');
  return ar
    ? 'حذف هذه الشركة؟\n\nلا يُمحى شيء — يُؤرشَف السجل في قاعدة البيانات ويختفي من قوائم الجميع. تجده في صفحة «الأرشيف» ومنها يمكن استعادته في أي وقت؛ كما يمكن التراجع من «النشاط والتدقيق ← تراجع» خلال 24 ساعة.'
    : 'Delete this company?\n\nNothing is erased — the record is archived in the database and stops appearing in anyone\'s lists. It is listed on the Archive page, where it can be restored at any time; Activity & Audit \u2192 Undo also reverses it within 24 hours.';
}
let leadDetailView="detail";
function openLeadFn(id){openLead=id;leadDetailView="detail";render();window.scrollTo(0,0);}
function closeLead(){openLead=null;leadDetailView="detail";render();}
function setLeadView(m){leadDetailView=m;render();window.scrollTo(0,0);}
function renderLeads(v){
  if(openLead){renderLeadDetail(v,openLead);return;}if(leadView!=='table'&&leadView!=='dash')leadView='table';
  const _arRL=(typeof LANG!=='undefined'&&LANG==='ar');
  v.innerHTML=`<div id="leadoverview"></div><div class="toolbar">
    <div class="search-wrap">${IC.search}<input id="lq" placeholder="${_arRL?'ابحث عن منشأة أو جهة اتصال أو بريد أو هاتف…':'Search business, contact, email, phone…'}" value="${esc(leadFilter.q)}"></div>
    <div class="seg" id="viewseg"></div>
    <div class="seg" id="grpseg" style="display:none"></div>
    <div class="seg" id="catseg" style="display:none"></div><select id="fnsel" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer"></select><select id="stgsel" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer"></select>
    <button class="btn pri" onclick="editBusiness()">+ New business</button>
  </div><div id="leadsum"></div><div id="board"></div>`;
  const vs=document.getElementById("viewseg");
  [["table","Table"],["dash","Dashboard"]].forEach(([k,lab])=>{const b=document.createElement("button");b.textContent=lab;b.className=leadView===k?"on":"";b.onclick=()=>{leadView=k;renderLeads(v);};vs.appendChild(b);});
  const g=document.getElementById("grpseg");
  [["stage","By stage"],["category","By category"],["source","By funnel"]].forEach(([k,lab])=>{const b=document.createElement("button");b.textContent=lab;b.className=leadGroup===k?"on":"";b.onclick=()=>{leadGroup=k;renderLeads(v);};g.appendChild(b);});
  const seg=document.getElementById("catseg");
  [["all","All"]].concat(CATEGORIES.map(c=>[c,c])).forEach(([k,lab])=>{const b=document.createElement("button");b.textContent=lab;b.className=leadFilter.cat===k?"on":"";b.onclick=()=>{leadFilter.cat=k;renderLeads(v);};seg.appendChild(b);});
  const fns=document.getElementById("fnsel");if(fns){
    const _ar=(typeof LANG!=='undefined'&&LANG==='ar');
    /* 2026-09-16 (fire #60, live): the dropdown was built from EVERY business, so the two import-batch
       source tags that only CLIENTS carry showed up as raw keys ("corporate_clients_import_20260821",
       "Direct Payments import") — dead entries on a list that shows leads only. Leads only now. */
    const _fm={};(DB.businesses||[]).filter(b=>!b.isClient).forEach(b=>{const k=b.funnelKey||b.source;if(k&&!_fm[k])_fm[k]=_ar?(b.funnelNameAr||b.funnelName||k):(b.funnelName||k);});
    fns.innerHTML='<option value="all">'+(_ar?'كل القنوات':'All funnels')+'</option>'+Object.keys(_fm).map(k=>'<option value="'+esc(k)+'" '+(leadFilter.funnel===k?"selected":"")+'>'+esc(_fm[k])+'</option>').join("");
    fns.onchange=e=>{leadFilter.funnel=e.target.value;drawLeads();};}const sgs=document.getElementById("stgsel");if(sgs){sgs.innerHTML='<option value="all">All stages</option>'+LEAD_STAGES.map(s=>'<option value="'+s+'" '+(leadFilter.stage===s?"selected":"")+'>'+(s==="Won"?"Client":s)+'</option>').join("");sgs.onchange=e=>{leadFilter.stage=e.target.value;drawLeads();};}document.getElementById("lq").oninput=e=>{leadFilter.q=e.target.value;drawLeads();};
  drawLeads();
}
function drawLeads(){var sum=document.getElementById("leadsum");if(leadView==='dash'){if(sum)sum.innerHTML="";drawLeadsDash();}else{renderLeadSummary();drawTable();}try{window.v26_3RefreshChipCounts('leads');}catch(_){}}
function drawLeadsDash(){
const board=document.getElementById("board");board.className="";
const SL=s=>s==="Won"?"Client":s;
/* 2026-09-09 (live test, L1): with the Lost chip on, this board read "Total leads 2 · Lost 3" —
   a converted CLIENT whose stage still says Lost was counted as a lost lead while "Total leads"
   (rightly) leaves clients out. One pool for every tile: leads only, the same rows the table
   shows (Hide-closed included when no stage is picked); "Became client" counts the clients the
   same filters match, on their own. */
const _hc=(typeof leadFilter!=='undefined'&&leadFilter.hideClosed&&(leadFilter.stage==='all'||!leadFilter.stage));
const _all=DB.businesses.filter(matchLead);
const B=_all.filter(b=>!b.isClient).filter(b=>!_hc||(leadStage(b)!=="Won"&&leadStage(b)!=="Lost"));
const open=B.filter(b=>{const s=leadStage(b);return s!=="Won"&&s!=="Lost";});
/* 2026-09-15 (fire #54, live, by eye): the board listed "Negotiation" — a stage the database
   cannot hold (the locked list is new/contacted/in_discussion/proposal/won/lost/on_hold, and
   the chips above the table show Prospect/Contacted/Qualified/Proposal/Won/Lost) — and "Client"
   (Won relabelled), which for LEADS is always 0 because a won lead becomes a client and is
   counted in the "Became client" tile. Both bars are gone; the bars now speak the chips'
   vocabulary. Lost is counted from the leads the filters match BEFORE Hide-closed removes
   them: with Hide-closed on (the default) the chip said "Lost 2" while this board said
   "Lost 0" on the same screen. Clients are still never counted as lost leads (L1, 2026-09-09). */
const _leadsAll=_all.filter(b=>!b.isClient);
/* the bars' stage words and the "leads" unit follow the page language (the same Arabic words js/21
   uses for the chips) — the Arabic board used to show English bars under Arabic tiles */
const _dashAr=(typeof LANG!=='undefined'&&LANG==='ar');
const _stageN=s=>((s==="Lost"||s==="Won")?_leadsAll:B).filter(b=>leadStage(b)===s).length;
const _DASH_STAGES=LEAD_STAGES.filter(s=>s!=="Negotiation"&&s!=="Won");
const fmax=Math.max(1,..._DASH_STAGES.map(_stageN));
const byStage=_DASH_STAGES.map(s=>({s,n:_stageN(s),c:LSTAGE_COLOR[s]}));
const srcCount={};B.forEach(b=>{const _arF=(typeof LANG!=="undefined"&&LANG==="ar");const k=(_arF?(b.funnelNameAr||b.funnelName):b.funnelName)||b.source||"Other";srcCount[k]=(srcCount[k]||0)+1;});
const bySource=Object.entries(srcCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
const ownerCount={};B.forEach(b=>{const o=b.assignedTo||b.owner||"Unassigned";ownerCount[o]=(ownerCount[o]||0)+1;});
const byOwner=Object.entries(ownerCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
const clients=_all.filter(b=>b.isClient||leadStage(b)==="Won").length;
const lost=_stageN("Lost");
/* "Total leads" counts leads. A company that has become a client is no longer one, and
   counting it in both places made the tile read 91 when there were 81 leads and 10 clients.
   The clients keep their own tile next door, so nothing is hidden — it is just not
   double-counted. (2026-08-16, found by the owner testing the live page.) */
const leadsOnly=B.filter(b=>!b.isClient);
/* 2026-09-09 (live test, L4): .chip is styled for the dark hero (white-on-dark, translucent
   box) — on this white board the four tiles drew as faint outlined strips with a dark number
   and an unreadable grey label. Light-surface styling, inline, so nothing else changes. */
const _tile=(v,l)=>`<div class="chip" style="background:#fff;border:1px solid #EFE9DF;color:#1C1E2B;min-width:150px;padding:14px 18px"><div class="v" style="font-size:24px;line-height:1.1">${v}</div><div class="l" style="color:#6B7480;margin-top:4px">${l}</div></div>`;
board.innerHTML=`<div class="chips leads-dash-tiles" style="margin:0 0 14px">${_tile(leadsOnly.length,'Total leads')}${_tile(open.length,'In pipeline')}${_tile(clients,'Became client')}${_tile(lost,'Lost')}</div>
<div class="detail-grid"><div><div class="card"><h3>Leads by stage</h3>${byStage.map(f=>`<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:600">${_dashAr?({Prospect:'مرتقب',Contacted:'تم التواصل',Qualified:'مؤهل',Proposal:'عرض مقدم',Lost:'مفقود'}[f.s]||SL(f.s)):SL(f.s)}</span><span style="color:var(--muted)">${_dashAr?(f.n+' عميل محتمل'):(f.n+' lead'+(f.n===1?"":"s"))}</span></div><div style="height:10px;background:#eef0f5;border-radius:6px;overflow:hidden;margin-top:3px"><div style="height:100%;width:${Math.round(f.n/fmax*100)}%;background:${f.c}"></div></div></div>`).join("")}</div></div>
<div><div class="card"><h3>Leads by funnel</h3>${bySource.length?bySource.map(e=>`<div class="fact"><span class="k">${esc(e[0])}</span><span class="v">${e[1]}</span></div>`).join(""):'<div class="empty">No funnels.</div>'}</div>
<div class="card"><h3>By owner</h3>${byOwner.length?byOwner.map(e=>`<div class="fact"><span class="k">${esc(e[0])}</span><span class="v">${e[1]}</span></div>`).join(""):'<div class="empty">No owners.</div>'}</div></div></div>`;
}

function renderLeadSummary(){
  const el=document.getElementById("leadsum");if(!el)return;
  /* Leads only — a converted client is counted on the Clients page, not here.
     The "SAR billed" figure was removed on 2026-08-16: it was the clients' lifetime billing
     total showing up on the Leads page, where it means nothing. Money belongs to Clients
     and Finance; this strip counts companies. */
  /* 2026-09-10 (live test L3, second look): with Hide-closed on this strip still read "In view
     80 · Lost 2" over a table of 78 rows — it never applied Hide-closed. The same rule as the
     table and the dashboard tiles: when Hide-closed is on and no stage is picked, Won/Lost are
     not in view, so they are not counted here either. */
  const _hcS=(typeof leadFilter!=='undefined'&&leadFilter.hideClosed&&(leadFilter.stage==='all'||!leadFilter.stage));
  const list=DB.businesses.filter(b=>!b.isClient).filter(matchLead).filter(b=>!_hcS||(leadStage(b)!=="Won"&&leadStage(b)!=="Lost"));
  const byStage=LEAD_STAGES.map(s=>({s,n:list.filter(b=>leadStage(b)===s).length})).filter(x=>x.n);
  const _arLS=(typeof LANG!=='undefined'&&LANG==='ar');
  /* 2026-09-22 (fire #209): counted live, the page drew 78 rows over 80 leads. Nothing was wrong —
     "Hide closed" is on by default and 2 leads are Lost — but this page was the only list in the
     app that did not say so. Airlines says "Showing 136 of 139 airlines" and then names the three;
     Events says "43 of 80 shown"; Leads showed a tick labelled "Hide closed" and left the reader to
     work out that two records existed at all. Same app, same kind of statement, less information.
     The strip now names the number it is holding back, and offers the one click that shows them. */
  const _hiddenClosed=_hcS
    ? DB.businesses.filter(b=>!b.isClient).filter(matchLead).filter(b=>{const s=leadStage(b);return s==="Won"||s==="Lost";}).length
    : 0;
  const _hiddenBadge=_hiddenClosed
    ? `<span class="statusbadge v209-hidden" style="background:var(--wash,#F6F7F9);color:var(--muted,#6B7480);font-weight:600">${_hiddenClosed} ${_arLS?'مغلقة مخفية':('closed hidden')} · <a href="#" onclick="event.preventDefault();leadFilter.hideClosed=false;drawLeads();" style="color:inherit;text-decoration:underline">${_arLS?'إظهار':'Show'}</a></span>`
    : '';
  el.innerHTML=`<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:13px 18px;margin-bottom:14px"><div><div style="font-size:10.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">${_arLS?'ضمن العرض':'In view'}</div><div style="font-size:17px;font-weight:800;letter-spacing:-.02em">${list.length} ${_arLS?'عميل محتمل':(list.length===1?"lead":"leads")}</div></div><div style="flex:1;display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">${byStage.map(x=>`<span class="statusbadge" style="background:${LSTAGE_COLOR[x.s]}1a;color:${LSTAGE_COLOR[x.s]}"><span class="dot" style="background:${LSTAGE_COLOR[x.s]}"></span>${esc(_actStageWord(x.s))} ${x.n}</span>`).join("")}${_hiddenBadge}</div></div>`;
}
/* base drawTable deleted 2026-08-10 — superseded by the v30 window.drawTable override (bulk-select + priority table) */
function matchLead(b){if(leadFilter.stage&&leadFilter.stage!=="all"&&leadStage(b)!==leadFilter.stage)return false;if(leadFilter.funnel&&leadFilter.funnel!=="all"&&(b.funnelKey||b.source||"")!==leadFilter.funnel)return false;const q=leadFilter.q.trim();if(leadGroup==="category"&&leadFilter.cat!=="all"&&b.category!==leadFilter.cat)return false;if(!q)return true;
  /* fire #194: was its own field list — the fourth and last copy, and the one the team uses most.
     Now the shared recordHay (core-01), which is what M38 asks for. It also ends this box's own
     version of the run-together bug #180 fixed here: contacts used to be joined as
     name+email+phone with no spaces. */
  /* fire #214: hayHas folds the query the same way recordHay folds the record, so «الهيئه» finds
     «الهيئة». Both sides must be folded by the same function or neither is. */
  return hayHas(b,q);}


function leadDashboard(v,id){
  const b=getLead(id);if(!b){openLead=null;return renderLeads(v);}
  const sg=leadStage(b);const acts=(b.activities||[]).slice().sort((x,y)=>y.date-x.date);const stageIdx=LEAD_STAGES.indexOf(sg);
  const sc=leadScore(b),sb=scoreBand(sc);
  const tiles=[["Lead score",sc+" · "+sb.l],["Activities",acts.length],["Assigned",b.assignedTo||b.owner||"Unassigned"]];
  v.innerHTML=`<button class="btn ghost sm" onclick="closeLead()">${(typeof LANG!=='undefined'&&LANG==='ar')?'← العودة إلى القائمة':'← Back to pipeline'}</button>
  <div class="detail-head">
    <div class="ava" style="background:${avaColor(b.id)}">${initials(b.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800;letter-spacing:-.02em">${window.nmMain?esc(nmMain(b)):esc(b.name)}</div>${window.nmSubHTML?nmSubHTML(b):''}<div class="tags" style="margin-top:8px"><span class="statusbadge" style="background:${LSTAGE_COLOR[sg]}1a;color:${LSTAGE_COLOR[sg]}"><span class="dot" style="background:${LSTAGE_COLOR[sg]}"></span>${sg}</span>${directLinkTag(b)}${b.source?'<span class="tag" style="background:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'1a;color:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'">'+esc(b.source)+'</span>':""}${b.website?'<a class="tag" style="background:#2E90FA14;color:#2E90FA;text-decoration:none" target="_blank" rel="noopener" href="'+esc(b.website)+'">Website</a>':""}${b.corpEmailFlag?'<span class="tag" style="background:#F0453A14;color:#D92D20" title="Individual using a company email - check">Corp email: '+esc(b.corpEmailFlag)+'</span>':""}<span class="tag" style="background:${sb.c}1a;color:${sb.c}">Score ${sc} · ${sb.l}</span><span class="tag seg">${esc(b.segment||"")}</span></div>${leadRisks(b).length?`<div class="tags" style="margin-top:6px">${riskTags(b)}</div>`:""}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" onclick="setLeadView('detail')">📄 Detail view</button><button class="btn pri sm" onclick="logActivity('${b.id}')">＋ Log activity</button><button class="btn sm" onclick="editBusiness('${b.id}')">Edit</button></div>
  </div>
  <div class="chips" style="margin-bottom:14px">${tiles.map(t=>`<div class="chip"><div class="v">${esc(String(t[1]))}</div><div class="l">${t[0]}</div></div>`).join("")}</div>
  <div class="card" style="margin-bottom:14px"><h3>Pipeline stage</h3><div class="ch-sub">Click a stage to move the deal — syncs to the table, board and dashboard.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${pickableStages(sg).map((s,i)=>`<button onclick="setLeadStage('${b.id}','${s}')" style="flex:1;min-width:84px;border:0;cursor:pointer;border-radius:9px;padding:11px 8px;font:inherit;font-size:12px;font-weight:700;color:${i<=stageIdx&&sg!=='Lost'?'#fff':s===sg?'#fff':'var(--muted)'};background:${s===sg?LSTAGE_COLOR[s]:(i<stageIdx&&sg!=='Lost'?LSTAGE_COLOR[s]+'cc':'#eceef4')}">${s}</button>`).join("")}</div>
  </div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Work log</h3><div class="ch-sub">Calls, meetings, emails, tasks — the full history with this account.</div>
      ${acts.length?`<div class="timeline">${acts.map(a=>`<div class="tl-item" data-act-i="${_actIdx(b,a)}"><div class="when">${fmtDate(a.date)} · ${fmtAgo(a.date)}${_actBy(a)}${_actMeta(b,a)}</div><div class="what">${_actWhat(a,false)}</div></div>`).join("")}</div>`:'<div class="empty">'+((typeof LANG!=='undefined'&&LANG==='ar')?'لا يوجد نشاط بعد — اضغط «تسجيل نشاط».':'No activity yet — click “Log activity”.')+'</div>'}
      <div style="margin-top:10px"><button class="btn sm" onclick="logActivity('${b.id}')">＋ Log activity</button></div>
    </div>
    ${b.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6">${esc(b.notes)}</p></div>`:""}
  </div><div>
    <div class="card"><h3>Relationship to Direct</h3>
      <div class="fact"><span class="k">Link type</span><span class="v">${directLinkTag(b)}${b.source?'<span class="tag" style="background:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'1a;color:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'">'+esc(b.source)+'</span>':""}${b.website?'<a class="tag" style="background:#2E90FA14;color:#2E90FA;text-decoration:none" target="_blank" rel="noopener" href="'+esc(b.website)+'">Website</a>':""}${b.corpEmailFlag?'<span class="tag" style="background:#F0453A14;color:#D92D20" title="Individual using a company email - check">Corp email: '+esc(b.corpEmailFlag)+'</span>':""}</span></div>
      <div class="fact"><span class="k">Category</span><span class="v">${esc(b.category||"—")}</span></div>
      <div class="fact"><span class="k">Invoices</span><span class="v">${(function(){var n=leadInvoiceCount(b);return n==null?"—":n;})()}</span></div>
      <div class="fact"><span class="k">Is client</span><span class="v">${b.isClient?'<span class="tag" style="background:#16B36418;color:#16B364">Yes</span>':"No"}</span></div>
      <div class="fact"><span class="k">Tickets issued</span><span class="v">${ticketsFor(b.id).length}</span></div>
      <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">${!b.isClient?`<button class="btn sm" style="border-color:#16B364;color:#16B364" onclick="convertToClient('${b.id}')">★ Convert to client</button>`:''}<a class="chiplink" href="${pdLink(b)}" target="_blank" rel="noopener">Direct Payments ↗</a></div>
    </div>
    <div class="card"><h3>Deal intelligence</h3>
      <div class="fact"><span class="k">Lead score</span><span class="v"><span class="tag" style="background:${sb.c}1a;color:${sb.c}">${sc} · ${sb.l}</span></span></div>
      <div class="fact"><span class="k">Parent account</span><span class="v">${esc(b.parentAccount||"—")}</span></div>
      <div class="fact"><span class="k">Champion</span><span class="v">${esc(b.champion||"—")}</span></div>
      <div class="fact"><span class="k">Exec sponsor</span><span class="v">${b.execSponsor?"Yes":"No"}</span></div>
      <div class="fact"><span class="k">Competing against</span><span class="v">${esc(b.competitor||"—")}</span></div>
      ${sg==="Won"?`<div class="fact"><span class="k">Win reason</span><span class="v">${esc(b.winReason||"—")}</span></div>`:""}${sg==="Lost"?`<div class="fact"><span class="k">Loss reason</span><span class="v">${esc(b.lossReason||"—")}</span></div>`:""}
      ${leadRisks(b).length?`<div style="margin-top:10px" class="tags">${riskTags(b)}</div>`:'<div style="margin-top:8px;font-size:12px;color:#16B364">✓ No open risk flags</div>'}
    </div>
    ${relatedPanel(b.id)}
    <div class="card"><h3>Next action</h3>
      <div class="fact"><span class="k">Action</span><span class="v">${esc(b.nextAction||"—")}</span></div>
      <div class="fact"><span class="k">Due</span><span class="v">${b.dueDate?fmtDate(new Date(b.dueDate).getTime()):"—"}</span></div>
      <div class="fact"><span class="k">Owner</span><span class="v">${esc(b.assignedTo||b.owner||"Unassigned")}</span></div>
      <div class="fact"><span class="k">Last touched</span><span class="v">${b.lastContact?fmtDate(b.lastContact):"—"}</span></div>
    </div>
    <div class="card"><h3>Contacts &amp; channels</h3>${(b.contacts||[]).length?b.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||c.email||"?")}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||"—")}${c.role?` <span style="font-weight:400;color:var(--muted);font-size:11.5px">· ${esc(c.role)}</span>`:""}${c.needsConfirm?` <span class="v72-confirm" title="${esc(c.confirmReason||"")}" style="display:inline-block;margin-inline-start:6px;padding:1px 7px;border-radius:9px;background:#FFF3EC;color:#B54708;font-size:10.5px;font-weight:700;cursor:help">⚠ ${(typeof LANG!=="undefined"&&LANG==="ar")?"يحتاج تأكيدًا":"needs confirmation"}</span>`:""}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?esc(c.email):""}${c.email&&c.phone?" · ":""}${c.phone?esc(c.phone):""}</div></div></div>`).join(""):'<div class="empty">No contacts yet.</div>'}${(b.channels||[]).length?`<div style="margin-top:8px;font-size:12px"><span style="color:var(--muted)">Channels: </span>${b.channels.map(esc).join(", ")}</div>`:''}</div>
  </div></div>`;
}
function renderLeadDetail(v,id){
  const b=getLead(id);if(!b){openLead=null;return renderLeads(v);}
  const st=leadStage(b);const acts=(b.activities||[]).slice().sort((x,y)=>y.date-x.date);
  const tags=[];if(b.isClient)tags.push('<span class="tag client">Client</span>');if(b.isVendor)tags.push('<span class="tag vendor">Commission</span>');if(b.b2c)tags.push('<span class="tag b2c">B2C-found</span>');
  v.innerHTML=`<button class="btn ghost sm" onclick="closeLead()">${(typeof LANG!=='undefined'&&LANG==='ar')?'← العودة إلى القائمة':'← Back to pipeline'}</button>
  <div class="detail-head">
    <div class="ava" style="background:${avaColor(b.id)}">${initials(b.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800;letter-spacing:-.02em">${window.nmMain?esc(nmMain(b)):esc(b.name)}</div>${window.nmSubHTML?nmSubHTML(b):''}<div class="tags" style="margin-top:8px">${tags.join("")}<span class="tag seg">${esc(b.segment||"")}</span></div></div>
    <div style="text-align:right">
      <select onchange="setLeadStage('${b.id}',this.value)" style="padding:9px 12px;border-radius:10px;border:1px solid ${LSTAGE_COLOR[st]};color:${LSTAGE_COLOR[st]};font-weight:700;background:${LSTAGE_COLOR[st]}12;font-family:inherit;cursor:pointer">${pickableStages(st).map(s=>`<option value="${s}" ${s===st?"selected":""}>${s}</option>`).join("")}</select>
      <div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap"><button class="btn sm" style="display:none" onclick="setLeadView('dash')">📊 Dashboard view</button>${!b.isClient?`<button class="btn sm" style="border-color:#16B364;color:#16B364" onclick="convertToClient('${b.id}')">★ Convert to client</button>`:''}<button class="btn pri sm" onclick="logActivity('${b.id}')">＋ Log activity</button><button class="btn sm" onclick="newRequestForLead('${b.id}')">＋ Request</button><button class="btn sm" onclick="editBusiness('${b.id}')">Edit</button></div>
    </div>
  </div>
  <div class="detail-grid">
    <div>
      <div class="card"><h3>Activity &amp; workflow</h3><div class="ch-sub">Every touch with this business — no digging through chats or invoices</div>
      ${acts.length?`<div class="timeline">${acts.map(a=>`<div class="tl-item" data-act-i="${_actIdx(b,a)}"><div class="when">${fmtDate(a.date)} · ${fmtAgo(a.date)}${_actBy(a)}${_actMeta(b,a)}</div><div class="what">${_actWhat(a,true)}</div></div>`).join("")}</div>`:'<div class="empty">'+((typeof LANG!=='undefined'&&LANG==='ar')?'لا يوجد نشاط بعد — اضغط «تسجيل نشاط» بعد أول تواصل.':'No activity yet — click “Log activity” after your first contact.')+'</div>'}</div>
      <div class="card"><h3>Contacts</h3>${(b.contacts||[]).length?b.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||c.email||"?")}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||"—")}${c.role?` <span style="font-weight:400;color:var(--muted);font-size:11.5px">· ${esc(c.role)}</span>`:""}${c.needsConfirm?` <span class="v72-confirm" title="${esc(c.confirmReason||"")}" style="display:inline-block;margin-inline-start:6px;padding:1px 7px;border-radius:9px;background:#FFF3EC;color:#B54708;font-size:10.5px;font-weight:700;cursor:help">⚠ ${(typeof LANG!=="undefined"&&LANG==="ar")?"يحتاج تأكيدًا":"needs confirmation"}</span>`:""}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.email&&c.phone?" · ":""}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> <a href="https://wa.me/${String(c.phone).replace(/[^0-9]/g,"").replace(/^0/,"966")}" target="_blank" rel="noopener" style="color:#16B364;font-weight:800" title="WhatsApp">WA</a>`:""}</div></div></div>`).join(""):'<div class="empty">No contacts yet.</div>'}</div>${corpCard(b)}
    </div>
    <div>
      <div class="card"><h3>Key facts</h3>
        <div class="fact"><span class="k">Invoices</span><span class="v">${(function(){var n=leadInvoiceCount(b);return n==null?"—":n;})()}</span></div>
        <!-- Category had no fallback here, so a lead without one printed the word "undefined"
             on screen. Every other row on this panel already had one. -->
        <div class="fact"><span class="k">Category</span><span class="v">${esc(b.category||"—")}</span></div>
        ${b.lostReason?`<div class="fact"><span class="k" style="color:#D92D20">Why we lost it</span><span class="v" style="color:#D92D20;font-weight:600">${esc(b.lostReason)}</span></div>`:""}
        <div class="fact"><span class="k">Funnel</span><span class="v">${(()=>{const fn=(typeof LANG!=='undefined'&&LANG==='ar'&&b.funnelNameAr)?b.funnelNameAr:b.funnelName;return fn?`<span class="tag" style="background:#EEF0F5;color:#4B5563">${esc(fn)}</span>`:(b.source?`<span data-no-funnel="1" style="color:var(--muted)">— <small>${(typeof LANG!=='undefined'&&LANG==='ar')?'المصدر: ':'source: '}${esc(b.source)}</small></span>`:"—");})()}</span></div>
        ${b.isClient?`<div class="fact"><span class="k" data-k="won-by">${(typeof LANG!=='undefined'&&LANG==='ar')?'كسبها':'Won by'}</span><span class="v">${esc(b.assignedTo||b.owner||"—")}</span></div>
        <div class="fact"><span class="k" data-k="account-manager">${(typeof LANG!=='undefined'&&LANG==='ar')?'مدير الحساب':'Account manager'}</span><span class="v">${esc(b.accountManager||"—")}</span></div>`:`<div class="fact"><span class="k">Assigned to</span><span class="v">${esc(b.assignedTo||b.owner||"Unassigned")}</span></div>`}
        <div class="fact"><span class="k">Channels</span><span class="v">${(b.channels||[]).length?b.channels.map(esc).join(", "):"—"}</span></div>
        <div class="fact"><span class="k">Last contact</span><span class="v">${b.lastContact?fmtDate(b.lastContact):"—"}</span></div>
        <div class="fact"><span class="k">Next action</span><span class="v">${esc(b.nextAction||"—")}</span></div>
        <div class="fact"><span class="k">Services</span><span class="v">${esc(b.services||"—")}</span></div>
        <div style="margin-top:13px"><a class="chiplink" href="${pdLink(b)}" target="_blank" rel="noopener">Open invoices in Direct Payments ↗</a></div>
      </div>
      ${b.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6">${esc(b.notes)}</p></div>`:""}
    </div>
  </div>`;
}

/* 2026-09-09 (live test D1 family): the Won question went through window.confirm — the box that
   froze the owner's tabs — on the busiest path in the app. It asks through js/57's in-page box
   now; because the answer arrives later, the conversion announces itself with a 'lead-converted'
   event, which js/14 listens for to open the client handover (it used to check synchronously). */
function convertToClient(id){const b=getLead(id);if(!b)return;if(!b.accountManager&&b.assignedTo)b.accountManager=b.assignedTo;var _ar=(typeof LANG!=='undefined'&&LANG==='ar');
  /* 2026-09-17 (fire #81): this set `status` but never `stage`, and the row builder reads `stage`
     (appToRow: stage:S2C[o.stage]||'new'). Measured by driving the real button against the live
     database with the write intercepted: converting a lead sitting at Prospect sent
     is_client=true, raw.isClient=true, converted_date set — and stage='new'. So the app's own
     "mark as won client" button produced a client whose stage contradicted its client status,
     which is the sibling of the half-converted record CLAUDE.md warns about: both copies of the
     flag agreed, the stage did not. Anything that groups or counts by stage — the pipeline chips,
     a stage report — then files that client under "New". The other route to the same place,
     setLeadStage('Won'), sets stage AND status and lets the database trigger set is_client, so the
     two routes disagreed. Setting the screen stage here makes them agree: S2C maps 'Won' → 'won'.
     Existing records are untouched; this only changes what a future conversion writes.
     Guard: scripts/qa/probe-convert-writes-won-stage.mjs */
  const _go=()=>{b.isClient=true;b.stage="Won";b.status="Won";b.convertedDate=Date.now();b.lastContact=Date.now();b.activities=b.activities||[];b.activities.push({date:Date.now(),type:"Won",status:"Won",note:"Converted from lead to client",by:(typeof me==="function"?me():"Abdelrahman")});save();render();try{document.dispatchEvent(new CustomEvent('lead-converted',{detail:{id:id}}));}catch(_){}};
  const _msg=_ar?("اعتماد «"+b.name+"» كعميل رابح؟ سينتقل إلى قائمة عملائك."):("Mark “"+b.name+"” as a won client? It moves into your Clients book of business.");
  if(typeof window.pfConfirm==='function')window.pfConfirm(_msg,_go);else _go();}
// Client health — one scannable status from engagement + review governance.
// Red is reserved for a real problem (overdue review, or contact that HAS happened but has gone stale).
// A client with no logged history yet is "New", not "At risk" — we don't manufacture alarms from empty data.
function clientHealth(b){
  var today=todayISO();
/* 2026-09-24 (fire #237): a null inside the activities array threw here — reading .date off
   it — and killed the render wrapper. Same shape as the one in js/02's loader, two files over.
   .filter(Boolean) first, and the comparator no longer assumes either side is an object. */
  var la=(b.activities||[]).filter(Boolean).sort((x,y)=>((y&&y.date)||0)-((x&&x.date)||0))[0];
  var last=b.lastContact||(la&&la.date)||0;           // canonical last-touch, ms; 0 = never
  var daysAct=last?Math.floor((Date.now()-last)/864e5):null;
  var reviewOverdue=b.nextReview&&b.nextReview<=today;
  /* 2026-09-09 (live test EX3): a client whose stage reads Lost sat on the Clients list with
     Health "Good" and the "Won: converted" line — nothing on the row said the account was lost.
     Lost outranks every other health reading. */
  var _stg=(typeof leadStage==='function')?leadStage(b):(b.stage||'');
  if(_stg==='Lost')return {l:'Lost',c:'#6B7480',why:'Marked Lost — no longer an active client'};
  if(reviewOverdue)return {l:'At risk',c:'#D92D20',why:'Account review overdue'};
  if(daysAct===null)return {l:'New',c:'#6B7480',why:'No activity logged yet'};
  if(daysAct>90)return {l:'At risk',c:'#D92D20',why:'No contact in 90+ days'};
  if(daysAct>45)return {l:'Watch',c:'#F79009',why:'No contact in 45+ days'};
  return {l:'Good',c:'#16B364',why:'Active and up to date'};
}
function renderClients(v){
  let cl=DB.businesses.filter(b=>b.isClient);
  /* 2026-09-21 (fire #148) — the Clients search used to look at the company name, its Arabic name,
     and contacts' e-mail and phone. Measured live against the real database, three things a person
     would actually type could not find their client:
       · THE CONTACT PERSON'S NAME — you can find a LEAD by the person's name (matchLead includes
         it) and you could not find a CLIENT by the same person. You remember the person.
       · THE DIRECT CLIENT ID — the link key to Direct Payments, on 20 clients. Worse than missing:
         searching it returned TWO matches and NEITHER was the right company, because the digits
         happened to appear inside other records' phone numbers. A confidently wrong answer.
       · THE CR / VAT NUMBER — nothing.
     All three are in the haystack now. The parts are also joined with SPACES: e-mail and phone used
     to be concatenated with nothing between them, so a search could match across the seam of two
     different values and hit a record that contains neither. */
  /* fire #180: was its own copy of this list. Now the shared recordHay (core-01) — see M38. */
  if(clFilter.q){const q=clFilter.q.trim();cl=cl.filter(b=>hayHas(b,q));}
  /* 2026-09-03 (round 43): "__none__" lists the clients nobody owns. The dropdown was built from
     the names actually present and .filter(Boolean), so there was no way to ASK for the unowned
     ones — you could only spot the red "Unassigned" tags by scrolling. Live that day: 20 of
     Direct's 28 clients had no account manager (all from the August corporate-client import), so
     the one view a manager most needs in order to fix it was the one view the page could not show. */
  if(clFilter.owner==="__none__")cl=cl.filter(b=>!String(b.accountManager||b.assignedTo||"").trim());
  else if(clFilter.owner!=="all")cl=cl.filter(b=>window.sameOwner?sameOwner(b.accountManager||b.assignedTo,clFilter.owner):(b.accountManager||b.assignedTo||"")===clFilter.owner);
  if(clFilter.tier!=="all")cl=cl.filter(b=>(b.tier||"Standard")===clFilter.tier);
  /* 2026-09-19 (fire #99), two things driven live on the real 28 clients:

     HEALTH — this map had no entry for 'Lost', which clientHealth() has returned since 2026-09-09.
     An unknown label gave undefined, and undefined compares equal to everything, so the one Lost
     client landed in the MIDDLE of the Watch block: At risk ×4, Watch ×3, Lost, Watch ×2, New…
     The column's own tooltip promises "click to surface at-risk clients", and a health was split in
     two. Lost is now ranked last — it is the one reading that needs no chasing — and anything this
     map has never heard of sorts after everything rather than nowhere.

     NAME — the rows show the Arabic name when there is one (js/54's nmMain), but the sort key was
     always b.name, the stored English one. In Arabic the list therefore read Abdel Hadi… /
     Al Sharq… / مؤسسة العرض… / نادي الجندل… / alnahla… — Arabic names sitting in the middle of a
     Latin run, ordered by something the reader cannot see. It now sorts by the name actually on the
     row, with localeCompare in the language being read, so Arabic collates as Arabic. */
  const HEALTH_RANK={"At risk":0,Watch:1,New:2,Good:3,Lost:4};
  const shownName=(b)=>String((window.nmMain?nmMain(b):b.name)||b.name||"");
  const sv=(b,k)=>k==="am"?String(b.accountManager||b.assignedTo||"").toLowerCase():k==="tier"?String(b.tier||"Standard"):k==="review"?(b.nextReview||"9999-99"):k==="health"?(HEALTH_RANK[clientHealth(b).l]!==undefined?HEALTH_RANK[clientHealth(b).l]:99):shownName(b);
  const _clLoc=(typeof LANG!=='undefined'&&LANG==='ar')?'ar':'en';
  cl=cl.slice().sort((a,b)=>{const va=sv(a,clSort.k),vb=sv(b,clSort.k);
    if(typeof va==='number'&&typeof vb==='number')return (va-vb)*clSort.dir;
    try{ return String(va).localeCompare(String(vb),_clLoc,{sensitivity:'base',numeric:true})*clSort.dir; }
    catch(_){ return (va<vb?-1:va>vb?1:0)*clSort.dir; }});
  const won=DB.businesses.filter(b=>!b.isClient&&leadStatus(b)==="Won").length;
  const today=todayISO();
  const team=teamList();
  const _arCl=(typeof LANG!=='undefined'&&LANG==='ar');
  v.innerHTML=`
  <div class="card" style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:14px 20px;margin-bottom:14px">
    <!-- ids so the "At risk" chip can recalculate these; it filters rows in the table itself,
         which used to leave these totals frozen at the all-clients figures (2026-08-16) -->
    <div><div class="kl">Clients in view</div><div class="kv" id="cl_kv_count">${cl.length}</div></div>
    <div><div class="kl">Key accounts</div><div class="kv" id="cl_kv_key">${cl.filter(b=>b.tier==="Key").length}</div></div>
    <div><div class="kl">Won leads not yet converted</div><div class="kv" style="color:#FF6B00">${won}</div></div>
    <div style="flex:1"></div><button class="btn sm ghost" onclick="current='leads';render()">&larr; Leads pipeline</button></div>
  <div class="toolbar">
    <div class="search-wrap">${IC.search}<input id="clq" placeholder="${_arCl?'ابحث عن العملاء...':'Search clients...'}" value="${esc(clFilter.q)}"></div>
    <select onchange="clFilter.owner=this.value;render()" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer"><option value="all">All managers</option>${(function(){var _n=DB.businesses.filter(b=>b.isClient&&!String(b.accountManager||b.assignedTo||"").trim()).length;/* built bilingual here on purpose: js/21's translator matches an option's text exactly, and
   "Unassigned (20)" is not the bare "Unassigned" that its dictionary holds */
var _ar=(typeof LANG!=='undefined'&&LANG==='ar');return _n?`<option value="__none__" ${clFilter.owner==="__none__"?"selected":""}>${_ar?"غير معيّن":"Unassigned"} (${_n})</option>`:"";})()}${[...new Set(DB.businesses.filter(b=>b.isClient).map(b=>b.accountManager||b.assignedTo).filter(Boolean))].sort().map(t=>`<option value="${t}" ${clFilter.owner===t?"selected":""}>${t}</option>`).join("")}</select>
    <button class="btn sm ${clFilter.owner===(window.meName?meName():"")&&clFilter.owner!=="all"?"pri":"ghost"}" onclick="clToggleMine()">👤 ${(typeof LANG!=="undefined"&&LANG==="ar")?"خاص بي":"Mine"}</button>
    <select onchange="clFilter.tier=this.value;render()" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer">${(function(){
      /* 2026-09-03 (round 45) — these two options carried NO value attribute, so the browser used
         their visible text as the value and `clFilter.tier=this.value` compared it against
         b.tier==='Key'. js/21 therefore refused to translate them, correctly and by its own
         documented rule: translating a value-less option changes what gets stored and compared.
         So an Arabic user read "Key" and "Standard" in English, and the translator was right to
         leave them alone — the markup was the bug, not the translation.

         Giving them explicit values IS the whole fix. js/21's dictionary already holds
         Key -> رئيسي, Standard -> قياسي and All tiers -> كل الفئات, and once the value is safe to
         keep it applies them. The Arabic is deliberately NOT repeated here: one dictionary, one
         place to change a wording, nothing to drift. Confirmed by testing both halves separately —
         remove the value and the words revert to English AND the filter starts storing Arabic. */
      return '<option value="all">All tiers</option>'+
             '<option value="Key" '+(clFilter.tier==="Key"?"selected":"")+'>Key</option>'+
             '<option value="Standard" '+(clFilter.tier==="Standard"?"selected":"")+'>Standard</option>';
    })()}</select>
  </div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th style="cursor:pointer" onclick="clSortBy('name')">Client${clArrow('name')}</th><th style="cursor:pointer" onclick="clSortBy('am')">Account manager${clArrow('am')}</th><th style="cursor:pointer" onclick="clSortBy('tier')">Tier${clArrow('tier')}</th><th>Client since</th><th style="cursor:pointer" onclick="clSortBy('review')">Next review${clArrow('review')}</th><th style="cursor:pointer" onclick="clSortBy('health')" title="Client health — Good / Watch / At risk. Click to surface at-risk clients.">Health${clArrow('health')}</th><th></th></tr></thead><tbody>
  ${cl.map(b=>{const am=b.accountManager||b.assignedTo;const overdue=b.nextReview&&b.nextReview<=today;const la=(b.activities||[]).filter(Boolean).sort((x,y)=>((y&&y.date)||0)-((x&&x.date)||0))[0];const since=b.convertedDate||b.convertDate||'';const _h=clientHealth(b);return `<tr data-health="${_h.l}" data-client-row="1" data-key="${b.tier==="Key"?1:0}" style="cursor:pointer" onclick="openLead='${b.id}';current='leads';render()"><td><b>${window.nmMain?esc(nmMain(b)):esc(b.name)}</b>${b.directClientId?` <span style="color:var(--muted);font-size:10.5px">#${esc(b.directClientId)}</span>`:''}${window.nmSubHTML?nmSubHTML(b):''}${la?`<div style="font-size:11px;color:#0F6E56;margin-top:2px">↪ ${esc(String(actTypeLabel(la.type)+(la.note?': '+la.note:'')).slice(0,46))}</div>`:''}</td><td>${am?esc(am):'<span class="tag" style="background:#F0453A14;color:#D92D20">Unassigned</span>'}</td><td>${(b.tier==="Key")?'<span class="tag" style="background:#A9781A1a;color:#A9781A;font-weight:800">KEY</span>':'<span class="tag" style="background:#EEF0F5;color:#5b6178">Standard</span>'}</td><td style="white-space:nowrap;color:var(--muted);font-size:12px">${since?esc(typeof since==='number'?new Date(since).toISOString().slice(0,10):String(since)):'<span style="color:#C9C2B6">—</span>'}</td><td style="white-space:nowrap;${overdue?'color:#D92D20;font-weight:700':'color:var(--muted)'}">${b.nextReview?esc(b.nextReview):'-'}</td>${(function(){var h=_h;return '<td><span class="tag" style="background:'+h.c+'1a;color:'+h.c+';font-weight:700" title="'+h.why+'">'+h.l+'</span></td>';})()}<td><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="event.stopPropagation();leadQuickEdit('${b.id}')">Edit</button></td></tr>`;}).join("")||('<tr><td colspan="7" class="empty">'+((typeof LANG!=='undefined'&&LANG==='ar')?'لا يوجد عملاء مطابقون.':'No clients match.')+'</td></tr>')}
  </tbody></table></div></div>`;
  const cq=document.getElementById("clq");if(cq){cq.oninput=e=>{clFilter.q=e.target.value;render();const n=document.getElementById("clq");if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(_){}}};}
}
/* 2026-09-09 (live test A2): a logged activity could never be corrected or removed — a wrong
   note, a duplicate rehearsal call, stayed on the record for good. Each timeline entry now
   carries its index in the record and, for someone who may edit the page, an edit and a remove
   control (both timelines: the lead dashboard's and the detail card's). */
function _actIdx(b,a){return (b.activities||[]).indexOf(a);}
/* 2026-09-10 (live test, second pass): a row that js/72 bridged in from the activities TABLE
   (_fromTable — e.g. the trigger's "stage_change: new → contacted" by "system") is not the
   record's own note: editing or removing it would not persist (the table row stays and comes
   back on the next load), so no tools are offered on it; and it reads in words, not column
   names — "Stage changed: Prospect → Contacted · automatic". */
const _ACT_STAGE_WORD={new:'Prospect',contacted:'Contacted',in_discussion:'Qualified',proposal:'Proposal',won:'Won',lost:'Lost',on_hold:'On hold'};
function _actStageWord(k){const w=_ACT_STAGE_WORD[String(k||'').trim().toLowerCase()]||String(k||'').trim();const _ar=(typeof LANG!=='undefined'&&LANG==='ar');return (_ar&&window.__STAGE_AR&&window.__STAGE_AR[w])||w;}
function _actBy(a){if(!a.by)return '';const _ar=(typeof LANG!=='undefined'&&LANG==='ar');const who=String(a.by).toLowerCase()==='system'?(_ar?'تلقائي':'automatic'):a.by;return ' · '+esc(who);}
/* 2026-09-21 (fire #197) — ONE list of activity words, and it matches the data.
   Two copies of the same map lived here: this function's, and another inline in the Clients table
   above. Both keyed on lowercase — `{note:…, call:…, meeting:…}` — while **every activity in the
   live data is capitalised**: measured the same day, 68 of 68 rows across 38 companies carry
   `Note` (15), `stage_change` (28), `Won` (10), `Call` (8), `Task` (4), `Meeting` (2),
   `Proposal` (1). Not one of them could ever hit a key. So in Arabic the Clients list read
   "↪ Note: …" on 11 of 11 rows, and a client's own timeline read Call / Task / Note / Won in
   English down its whole length — the history screen, in the language half the team reads.
   Three faults, one helper: the lookup is case-insensitive, the words people actually log are in
   it, and `stage_change` — a database identifier, never a label — gets a phrase in both languages
   instead of leaking through the fallback. Stage-shaped words (Won, Lost, Proposal) are taken from
   `window.__STAGE_AR`, the map the stage chips and the Arabic export already share, so the same
   thing cannot come out worded two ways. An unrecognised type still falls through to its stored
   value, which is the honest answer when we genuinely do not know the word. */
const _ACT_WORD={
  note:['Note','ملاحظة'], call:['Call','مكالمة'], email:['Email','بريد'], meeting:['Meeting','اجتماع'],
  whatsapp:['WhatsApp','واتساب'], visit:['Visit','زيارة'], task:['Task','مهمة'],
  activity:['Activity','نشاط'], stage_change:['Stage changed','تغيّرت المرحلة']
};
function actTypeLabel(type){
  try{
    const raw=String(type||'Activity').trim();
    /* 2026-09-21 (fire #198) — fire #197 keyed this against the values in the `activities` TABLE,
       where a stage change is written `stage_change`. The app writes its OWN stage changes into
       the record's blob as `"Stage change"` — a space, not an underscore — so the fix of one round
       ago missed the very entries the app creates itself. Nobody had moved a stage through the app
       since the data was rebuilt, so the live table held none of them and the gap stayed invisible:
       it would have appeared in Arabic the first time anyone advanced a lead. Separators are
       normalised here so the space, the underscore and the hyphen are one key. The lesson #197
       wrote down was "key against the data"; the completion of it is that the same fact can be
       spelled differently by different writers, and a normalised key is what covers all of them. */
    const k=raw.toLowerCase().replace(/[\s\-]+/g,'_');
    const _ar=(typeof LANG!=='undefined'&&LANG==='ar');
    if(_ACT_WORD[k]) return _ACT_WORD[k][_ar?1:0];
    /* Won / Lost / Proposal and anything else the stage vocabulary already names */
    const cap=raw.charAt(0).toUpperCase()+raw.slice(1).toLowerCase();
    if(_ar){ try{ if(window.__STAGE_AR&&window.__STAGE_AR[cap]) return window.__STAGE_AR[cap]; }catch(_){} }
    return _ar?raw:cap;
  }catch(_){ return String(type||'Activity'); }
}
try{ window.actTypeLabel=actTypeLabel; }catch(_){}
function _actWhat(a,moved){const _ar=(typeof LANG!=='undefined'&&LANG==='ar');const t=String(a.type||'');
  /* fire #198: same normalisation as actTypeLabel — the app's own entries say "Stage change" */
  if(String(t).toLowerCase().replace(/[\s\-]+/g,'_')==='stage_change'){const m=String(a.note||'').match(/^\s*(\S.*?)\s*(?:→|->)\s*(\S.*?)\s*$/);const from=m?_actStageWord(m[1]):'';const to=m?_actStageWord(m[2]):_actStageWord(a.note);return `<b>${_ar?'تغيّرت المرحلة':'Stage changed'}</b>${from?': '+esc(from)+' → '+esc(to):(to?': '+esc(to):'')}`;}
  const label=actTypeLabel(t);   /* fire #197: was its own lowercase-keyed copy — see actTypeLabel */
  const st=a.status?(moved?(_ar?` ← نُقل إلى <b>${esc(a.status)}</b>`:` → moved to <b>${esc(a.status)}</b>`):` → <b>${esc(a.status)}</b>`):'';
  return `<b>${esc(label)}</b>${st}${a.note?": "+esc(a.note):""}`;}
function _actMeta(b,a){const i=_actIdx(b,a);const _ar=(typeof LANG!=='undefined'&&LANG==='ar');let h='';if(a._fromTable)return h;if(a.edited)h+=` · <span data-act-edited title="${esc((a.edited.by||'')+' '+(a.edited.at?fmtDate(a.edited.at):''))}">${_ar?'(عُدِّل)':'(edited)'}</span>`;const may=(typeof window.mayEditPage==='function')?window.mayEditPage('leads')!==false:true;if(!may||i<0)return h;return h+` · <span class="tl-tools" style="font-size:11px"><a href="javascript:void 0" data-act-edit="${i}" onclick="event.stopPropagation();editActivity('${b.id}',${i})" style="color:var(--muted)">${_ar?'تعديل':'edit'}</a> · <a href="javascript:void 0" data-act-remove="${i}" onclick="event.stopPropagation();removeActivity('${b.id}',${i})" style="color:var(--muted)">${_ar?'إزالة':'remove'}</a></span>`;}
/* 2026-09-09 (live test A5): "Last contact" is the newest activity that is still on the record.
   Logging moved it forward; removing the entry never moved it back, so a deleted note left a
   contact date that no longer had anything behind it. */
function recomputeLastContact(b){var mx=0;(b.activities||[]).forEach(function(a){var d=(typeof a.date==='number')?a.date:Date.parse(a.date)||0;if(d>mx)mx=d;});if(mx)b.lastContact=mx;else delete b.lastContact;return mx||null;}
function editActivity(id,i){const b=getLead(id);if(!b||!b.activities||!b.activities[i])return;const a=b.activities[i];const _ar=(typeof LANG!=='undefined'&&LANG==='ar');const d=new Date(typeof a.date==='number'?a.date:(Date.parse(a.date)||Date.now()));const pad=n=>String(n).padStart(2,'0');const dl=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  openModal((_ar?'تعديل النشاط — ':'Edit activity — ')+esc(b.name),`<div class="grid2"><div class="field"><label>${_ar?'النوع':'Type'}</label><select id="ae_type">${ACT_TYPES.concat(ACT_TYPES.indexOf(a.type)<0&&a.type?[a.type]:[]).map(t=>`<option ${t===a.type?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div class="field"><label>${_ar?'التاريخ والوقت':'When'}</label><input id="ae_when" type="datetime-local" value="${dl}"></div></div><div class="field"><label>${_ar?'ماذا حدث؟':'What happened?'}</label><textarea id="ae_note" rows="6">${esc(a.note||'')}</textarea></div>${a.status?`<div class="ch-sub">${_ar?'نقل المرحلة المسجّل هنا يبقى كما هو: ':'The stage move recorded here stays as it is: '}<b>${esc(a.status)}</b></div>`:''}`,
  ()=>{const note=val('ae_note');const t=val('ae_type');const w=Date.parse(val('ae_when'));if(!note.trim()&&!t){toast(_ar?'اكتب ما حدث':'Write what happened','err');return false;}a.type=t||a.type;a.note=note;const _o=(typeof a.date==='number')?a.date:Date.parse(a.date)||0;if(w&&!isNaN(w)&&Math.floor(w/60000)!==Math.floor(_o/60000))a.date=w;/* the picker drops seconds — an untouched date stays exactly as it was */a.edited={by:(typeof me==='function'?me():''),at:Date.now()};recomputeLastContact(b);if(typeof logAudit==='function')logAudit('lead',id,'activity-edited',t);save();render();toast(_ar?'تم تعديل النشاط':'Activity updated');});}
function removeActivity(id,i){const b=getLead(id);if(!b||!b.activities||!b.activities[i])return;const a=b.activities[i];const _ar=(typeof LANG!=='undefined'&&LANG==='ar');const _go=()=>{b.activities.splice(i,1);const lc=recomputeLastContact(b);if(typeof logAudit==='function')logAudit('lead',id,'activity-removed',a.type||'');save();render();toast(_ar?('أُزيل النشاط · آخر تواصل: '+(lc?fmtDate(lc):'لا يوجد')):('Activity removed · last contact: '+(lc?fmtDate(lc):'none')));};
  const msg=(_ar?'إزالة هذا النشاط من السجل؟':'Remove this activity from the record?')+'\n'+(a.type||'')+(a.note?': '+String(a.note).slice(0,80):'')+'\n'+(_ar?'يُعاد حساب «آخر تواصل» من النشاطات المتبقية.':'"Last contact" is recomputed from what remains.');
  if(typeof window.pfConfirm==='function')window.pfConfirm(msg,_go);else _go();}
function logActivity(id){const b=getLead(id);if(!b)return;
  openModal("Log activity — "+esc(b.name),`<div class="grid2"><div class="field"><label>Type</label><select id="a_type">${ACT_TYPES.map(t=>`<option>${t}</option>`).join("")}</select></div><div class="field"><label>Move stage to</label><select id="a_status"><option value="">— keep ${esc(leadStage(b))} —</option>${pickableStages(leadStage(b)).map(s=>`<option value="${s}">${s}</option>`).join("")}</select></div></div><div class="field"><label>What happened? — paste the conversation or write a summary</label><textarea id="a_note" rows="7" placeholder="e.g. Called Mr. Nasser — interested, sending the proposal Sunday"></textarea></div><div class="field"><label>Next action (optional)</label><input id="a_next" value="${esc(b.nextAction||"")}"></div>`,
  ()=>{const ns=val("a_status");b.activities=b.activities||[];b.activities.push({date:Date.now(),type:val("a_type"),status:ns||"",note:val("a_note"),by:(typeof me==="function"?me():"Abdelrahman")});if(ns){b.stage=ns;b.status=ns;if(ns==="Won")b.isClient=true;}b.lastContact=Date.now();b.nextAction=val("a_next");save();render();});
}

function editBusiness(id){
  const isNew=!id;const b=id?JSON.parse(JSON.stringify(getLead(id))):{id:uid("b"),name:"",nameAr:"",segment:"",category:"Convert",source:"Direct outreach",assignedTo:(window.meName?meName():""),channels:[],isClient:false,isVendor:false,totalSAR:0,invoices:0,contacts:[],notes:"",owner:"",services:"",nextAction:""};
  openModal(isNew?"New business":esc(b.name),`
    <div class="grid2"><div class="field"><label>Business name (canonical)</label><input id="f_name" value="${esc(b.name)}"></div><div class="field"><label>Arabic name</label><input id="f_ar" value="${esc(b.nameAr||"")}" dir="rtl"></div></div>
    <div class="grid2"><div class="field"><label>Segment</label><input id="f_seg" value="${esc(b.segment||"")}" placeholder="Government / Study-abroad school…"></div><div class="field"><label>Category</label><select id="f_cat">${/* 2026-09-20 (fire #116) — the same hole from the other side: 98 of the 108 live companies have no category at all, and with no empty option this box opened on "Anchor" and Save recorded it. Nothing recorded has to be something the form can say. */(function(){var _c=b.category||"",_ar=(typeof LANG!=="undefined"&&LANG==="ar");return '<option value=""'+(_c?"":" selected")+'>'+(_ar?"— بدون تصنيف —":"— none —")+'</option>'+CATEGORIES.map(function(c){return '<option'+(_c===c?" selected":"")+'>'+esc(c)+'</option>';}).join("")+((_c&&CATEGORIES.indexOf(_c)<0)?('<option value="'+esc(_c)+'" selected>'+esc(_c)+' · '+(_ar?"المسجَّل":"on file")+'</option>'):"");})()}</select></div></div>
    <div class="field"><label>Funnel — where this lead came from</label><select id="f_funnel"><option value="">${(typeof LANG!=="undefined"&&LANG==="ar")?"— بدون قناة —":"— no funnel —"}</option>${(window.__funnelDefs||[]).map(f=>`<option value="${f.key}" ${b.funnelKey===f.key?"selected":""}>${(typeof LANG!=="undefined"&&LANG==="ar")?(f.name_ar||f.name_en):f.name_en}</option>`).join("")}</select></div>
    
    <div class="grid2"><div class="field"><label>Funnel / source</label><select id="f_source" onchange="(function(v){var w=document.getElementById('f_sub_wrap');if(w)w.style.display=(v==='Travel Agencies')?'':'none';})(this.value)">${/* 2026-09-20 (fire #116) — this box had no empty option, so a lead whose source is not one of the sixteen the list offers selected the FIRST of them, and Save wrote it back. ALL 108 live companies are in that state ("Contact Submission" on 81 of them, an import tag on 19, the funnel names on the rest), so opening any lead and pressing Save without touching anything changed where it came from to "Old Customers" — the field the two August re-verification rounds were built on. Same remedy as the funnel form the round before: an empty option for "nothing recorded", and the stored value as its own option where the list has no match. */(function(){var _l=(typeof funnelList==='function'?funnelList():SOURCES),_c=b.source||"",_ar=(typeof LANG!=="undefined"&&LANG==="ar");return '<option value=""'+(_c?"":" selected")+'>'+(_ar?"— غير مسجّل —":"— not recorded —")+'</option>'+_l.map(function(s){return '<option'+(_c===s?" selected":"")+'>'+esc(s)+'</option>';}).join("")+((_c&&_l.indexOf(_c)<0)?('<option value="'+esc(_c)+'" selected>'+esc(_c)+' · '+(_ar?"المسجَّل":"on file")+'</option>'):"");})()}</select></div><div class="field"><label>Assigned to (who works it)</label><select id="f_assign"><option value="">${(typeof LANG!=="undefined"&&LANG==="ar")?"— غير معيّن —":"— Unassigned —"}</option>${(typeof teamRosterWarnOption==="function")?teamRosterWarnOption():""}${teamList().map(t=>`<option ${(b.assignedTo||"")===t?"selected":""}>${t}</option>`).join("")}</select></div></div>
    <div class="grid2" id="f_sub_wrap" style="display:${(b.source==='Travel Agencies')?'':'none'}"><div class="field"><label>Agency subtype</label><select id="f_sub"><option value="">— General —</option>${((DB.settings&&DB.settings.funnelSubs&&DB.settings.funnelSubs['Travel Agencies'])||[]).map(s=>`<option ${(b.sourceSub||'')===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="field"><label>Services they use</label><input id="f_serv" list="svclist" value="${esc(b.services||"")}" placeholder="Flights, Hotels, Visa, Insurance, Intl driving permit…"><datalist id="svclist">${(window.SVC_CATALOG||[]).filter(p=>!["Visas","Transport","Tours","Events","Wallet top-up","Mixed","(unspecified)"].includes(p[0])).map(p=>`<option value="${esc(p[0])}">`).join("")}</datalist></div><div class="field"><label>Area (city)</label><select id="f_area"><option value="">— Select —</option>${['Riyadh','Jeddah','Makkah','Madinah','Dammam','Khobar','Other'].map(a=>`<option ${(b.area||'')===a?'selected':''}>${a}</option>`).join('')}</select></div></div>
    <div class="field"><label>Channels of communication</label><div style="display:flex;flex-wrap:wrap;gap:8px">${CHANNELS.map(ch=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;background:#f6f3ee;padding:5px 10px;border-radius:8px;cursor:pointer"><input type="checkbox" class="f_ch" value="${ch}" ${(b.channels||[]).includes(ch)?"checked":""}>${ch}</label>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label>Existing client?</label><select id="f_client"><option value="no" ${!b.isClient?"selected":""}>No</option><option value="yes" ${b.isClient?"selected":""}>Yes</option></select></div><div class="field"><label>Vendor / commission?</label><select id="f_vendor"><option value="no" ${!b.isVendor?"selected":""}>No</option><option value="yes" ${b.isVendor?"selected":""}>Yes</option></select></div></div>
    <div class="grid2"><div class="field"><label>Stage</label><select id="f_stage">${LEAD_STAGES.map(s=>`<option value="${s}" ${leadStage(b)===s?"selected":""}>${s}</option>`).join("")}</select></div><div class="field"><label>${/* 2026-09-20 (fire #121) — 78 of the 108 live companies carry a website; the card shows it, the leads list de-duplicates on its domain, and NO FORM IN THE APP WROTE IT. One could not be added, corrected or removed. It goes in the empty half of the Stage row so no layout moves, and the label is written bilingually in place for the reason given in fire #120. */(typeof LANG!=="undefined"&&LANG==="ar")?"\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a":"Website"}</label><input id="f_web" value="${esc(b.website||"")}" placeholder="${/* 2026-09-21 (fire #125) — the battery caught this the round after it shipped: the placeholder was the bare "example.com", which is English on an Arabic form, and TWO Arabic probes went red on it. The domain itself must stay in Latin, so the Arabic side frames it the way this form already frames its other example placeholders — «مثال: …». */(typeof LANG!=="undefined"&&LANG==="ar")?"\u0645\u062b\u0627\u0644: example.com":"example.com"}"></div></div>
    <div class="grid2"><div class="field"><label>Next action</label><input id="f_next" value="${esc(b.nextAction||"")}"></div><div class="field"><label>Next action due</label><input id="f_due" type="date" value="${esc(b.dueDate||"")}"></div></div>
    
    <div class="field"><label>Contacts (same business, multiple people)</label><div id="contacts"></div><button class="btn sm" onclick="addContactRow()">+ Add contact</button></div>
    <div class="field"><label>Notes</label><textarea id="f_notes" rows="2">${esc(b.notes||"")}</textarea></div>
  `,()=>{b.name=val("f_name");b.nameAr=val("f_ar");b.segment=val("f_seg");b.area=val("f_area");b.category=val("f_cat");b.services=val("f_serv");b.nextAction=val("f_next");b.source=val("f_source");b.sourceSub=(val("f_source")==='Travel Agencies'?val("f_sub"):'');b.assignedTo=val("f_assign")||(window.meName?meName():"")||(typeof me==="function"?me():"");const _fk=val("f_funnel");b.funnelKey=_fk||null;const _fd=(window.__funnelDefs||[]).find(f=>f.key===_fk);b.funnelName=_fd?_fd.name_en:null;b.funnelNameAr=_fd?_fd.name_ar:null;const _wasClient=!!b.isClient;b.stage=val("f_stage");b.status=val("f_stage");b.dueDate=val("f_due");b.channels=[...document.querySelectorAll(".f_ch:checked")].map(e=>e.value);b.isClient=val("f_client")==="yes";if(b.stage==="Won")b.isClient=true;b.isVendor=val("f_vendor")==="yes";b.notes=val("f_notes");/* 2026-09-21 (fire #121) — a website typed without a scheme is stored with one, because the card renders it as a link and "example.com" without https:// resolves against this app's own address and goes nowhere. Empty stays empty; nothing is invented for a company that has none. */var _w=(val("f_web")||"").trim();b.website=_w?(/^https?:\/\//i.test(_w)?_w:("https://"+_w)):"";b.contacts=readContacts();if(!b.name.trim()){/* 2026-09-09 (live test, D1): a native alert() froze the whole tab on the owner's own test; say it in the page and put the cursor where the fix goes */try{var _nm=document.getElementById("f_name");if(_nm){_nm.style.borderColor="#D92D20";_nm.focus();}}catch(_){}var _m=(typeof LANG!=="undefined"&&LANG==="ar")?"اسم الجهة مطلوب.":"Business name required.";if(typeof toast==="function")toast(_m,"err");else alert(_m);return false;}const i=DB.businesses.findIndex(x=>x.id===b.id);if(i>=0)DB.businesses[i]=b;else{if(!b.createdAt)b.createdAt=new Date().toISOString();/* 2026-09-09 (live test, L5): a lead made here carried no created date until the next reload, so "New this month" stayed 0 for the person who just made it */DB.businesses.push(b);}save();render();if(b.isClient&&!_wasClient&&typeof window.__clientHandover==='function')setTimeout(()=>window.__clientHandover(b.id),250);},isNew?null:()=>{const _doDel=()=>{DB.businesses=DB.businesses.filter(x=>x.id!==id);openLead=null;if(typeof logAudit==='function')try{logAudit('lead',id,'delete',(b&&b.name)||'');}catch(_){}save();render();};/* D1: in-page confirm (js/57's box) — a native confirm() blocks the tab */if(window.pfConfirm)pfConfirm(_delWarn(),_doDel);else if(confirm(_delWarn()))_doDel();});
  window._contacts=(b.contacts||[]).slice();drawContacts();
}
/* 2026-09-20 (fire #120) — the contacts table has a `role` column, the lead card prints it beside
   the name ("Delegations office · Protocol"), and eleven of the 45 live contacts carry one. This
   form offered name, email and phone only, so the app showed a field nobody could write or correct
   and the other 34 people could never get one. The column is updatable by an authenticated user, so
   the gap was here and not in the permissions.
   Two notes on how it is done. The grid is widened by an inline style rather than by editing
   index.html's stylesheet, because touching index.html is a connection step and this does not need
   to be one. And the placeholder is written bilingually in place, while the other three are still
   translated after render from js/21's dictionary — inline cannot fall out of step with a
   dictionary that was not updated, which is exactly how a label goes English on an Arabic screen. */
function drawContacts(){const c=document.getElementById("contacts");if(!c)return;var _ar=(typeof LANG!=="undefined"&&LANG==="ar");c.innerHTML=(window._contacts||[]).map((ct,i)=>`<div class="contact" style="grid-template-columns:1fr .8fr 1fr 1fr auto"><input placeholder="${_ar?"\u0627\u0644\u0627\u0633\u0645":"Name"}" value="${esc(ct.name||"")}" oninput="window._contacts[${i}].name=this.value"><input placeholder="${_ar?"\u0627\u0644\u0635\u0641\u0629":"Role"}" value="${esc(ct.role||"")}" oninput="window._contacts[${i}].role=this.value"><input placeholder="${_ar?"\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a":"Email"}" value="${esc(ct.email||"")}" oninput="window._contacts[${i}].email=this.value"><input placeholder="${_ar?"\u0627\u0644\u0647\u0627\u062a\u0641":"Phone"}" value="${esc(ct.phone||"")}" oninput="window._contacts[${i}].phone=this.value"><span class="x" onclick="window._contacts.splice(${i},1);drawContacts()">✕</span></div>`).join("");}
function addContactRow(){window._contacts.push({name:"",role:"",email:"",phone:""});drawContacts();}
function readContacts(){return (window._contacts||[]).filter(c=>(c.name||c.email||c.phone));}

