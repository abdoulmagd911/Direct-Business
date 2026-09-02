/* ----- Leads ----- */
let leadFilter={q:"",cat:"all",funnel:"all",stage:"all"};
let leadGroup="stage";
let leadView="board";
let openLead=null;
function getLead(id){return DB.businesses.find(b=>b.id===id);}
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
    const _fm={};(DB.businesses||[]).forEach(b=>{const k=b.funnelKey||b.source;if(k&&!_fm[k])_fm[k]=_ar?(b.funnelNameAr||b.funnelName||k):(b.funnelName||k);});
    fns.innerHTML='<option value="all">'+(_ar?'كل القنوات':'All funnels')+'</option>'+Object.keys(_fm).map(k=>'<option value="'+esc(k)+'" '+(leadFilter.funnel===k?"selected":"")+'>'+esc(_fm[k])+'</option>').join("");
    fns.onchange=e=>{leadFilter.funnel=e.target.value;drawLeads();};}const sgs=document.getElementById("stgsel");if(sgs){sgs.innerHTML='<option value="all">All stages</option>'+LEAD_STAGES.map(s=>'<option value="'+s+'" '+(leadFilter.stage===s?"selected":"")+'>'+(s==="Won"?"Client":s)+'</option>').join("");sgs.onchange=e=>{leadFilter.stage=e.target.value;drawLeads();};}document.getElementById("lq").oninput=e=>{leadFilter.q=e.target.value;drawLeads();};
  drawLeads();
}
function drawLeads(){var sum=document.getElementById("leadsum");if(leadView==='dash'){if(sum)sum.innerHTML="";drawLeadsDash();}else{renderLeadSummary();drawTable();}try{window.v26_3RefreshChipCounts('leads');}catch(_){}}
function drawLeadsDash(){
const board=document.getElementById("board");board.className="";
const SL=s=>s==="Won"?"Client":s;
const B=DB.businesses.filter(matchLead);
const open=B.filter(b=>{const s=leadStage(b);return s!=="Won"&&s!=="Lost";});
const fmax=Math.max(1,...LEAD_STAGES.map(s=>B.filter(b=>leadStage(b)===s).length));
const byStage=LEAD_STAGES.map(s=>({s,n:B.filter(b=>leadStage(b)===s).length,c:LSTAGE_COLOR[s]}));
const srcCount={};B.forEach(b=>{const _arF=(typeof LANG!=="undefined"&&LANG==="ar");const k=(_arF?(b.funnelNameAr||b.funnelName):b.funnelName)||b.source||"Other";srcCount[k]=(srcCount[k]||0)+1;});
const bySource=Object.entries(srcCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
const ownerCount={};B.forEach(b=>{const o=b.assignedTo||b.owner||"Unassigned";ownerCount[o]=(ownerCount[o]||0)+1;});
const byOwner=Object.entries(ownerCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
const clients=B.filter(b=>leadStage(b)==="Won").length;
const lost=B.filter(b=>leadStage(b)==="Lost").length;
/* "Total leads" counts leads. A company that has become a client is no longer one, and
   counting it in both places made the tile read 91 when there were 81 leads and 10 clients.
   The clients keep their own tile next door, so nothing is hidden — it is just not
   double-counted. (2026-08-16, found by the owner testing the live page.) */
const leadsOnly=B.filter(b=>!b.isClient);
board.innerHTML=`<div class="chips" style="margin-bottom:14px"><div class="chip"><div class="v">${leadsOnly.length}</div><div class="l">Total leads</div></div><div class="chip"><div class="v">${open.length}</div><div class="l">In pipeline</div></div><div class="chip"><div class="v">${clients}</div><div class="l">Became client</div></div><div class="chip"><div class="v">${lost}</div><div class="l">Lost</div></div></div>
<div class="detail-grid"><div><div class="card"><h3>Leads by stage</h3>${byStage.map(f=>`<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:600">${SL(f.s)}</span><span style="color:var(--muted)">${f.n} lead${f.n===1?"":"s"}</span></div><div style="height:10px;background:#eef0f5;border-radius:6px;overflow:hidden;margin-top:3px"><div style="height:100%;width:${Math.round(f.n/fmax*100)}%;background:${f.c}"></div></div></div>`).join("")}</div></div>
<div><div class="card"><h3>Leads by funnel</h3>${bySource.length?bySource.map(e=>`<div class="fact"><span class="k">${esc(e[0])}</span><span class="v">${e[1]}</span></div>`).join(""):'<div class="empty">No funnels.</div>'}</div>
<div class="card"><h3>By owner</h3>${byOwner.length?byOwner.map(e=>`<div class="fact"><span class="k">${esc(e[0])}</span><span class="v">${e[1]}</span></div>`).join(""):'<div class="empty">No owners.</div>'}</div></div></div>`;
}

function renderLeadSummary(){
  const el=document.getElementById("leadsum");if(!el)return;
  /* Leads only — a converted client is counted on the Clients page, not here.
     The "SAR billed" figure was removed on 2026-08-16: it was the clients' lifetime billing
     total showing up on the Leads page, where it means nothing. Money belongs to Clients
     and Finance; this strip counts companies. */
  const list=DB.businesses.filter(b=>!b.isClient).filter(matchLead);
  const byStage=LEAD_STAGES.map(s=>({s,n:list.filter(b=>leadStage(b)===s).length})).filter(x=>x.n);
  const _arLS=(typeof LANG!=='undefined'&&LANG==='ar');
  el.innerHTML=`<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:13px 18px;margin-bottom:14px"><div><div style="font-size:10.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">${_arLS?'ضمن العرض':'In view'}</div><div style="font-size:17px;font-weight:800;letter-spacing:-.02em">${list.length} ${_arLS?'عميل محتمل':(list.length===1?"lead":"leads")}</div></div><div style="flex:1;display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">${byStage.map(x=>`<span class="statusbadge" style="background:${LSTAGE_COLOR[x.s]}1a;color:${LSTAGE_COLOR[x.s]}"><span class="dot" style="background:${LSTAGE_COLOR[x.s]}"></span>${x.s} ${x.n}</span>`).join("")}</div></div>`;
}
/* base drawTable deleted 2026-08-10 — superseded by the v30 window.drawTable override (bulk-select + priority table) */
function matchLead(b){if(leadFilter.stage&&leadFilter.stage!=="all"&&leadStage(b)!==leadFilter.stage)return false;if(leadFilter.funnel&&leadFilter.funnel!=="all"&&(b.funnelKey||b.source||"")!==leadFilter.funnel)return false;const q=leadFilter.q.toLowerCase().trim();if(leadGroup==="category"&&leadFilter.cat!=="all"&&b.category!==leadFilter.cat)return false;if(!q)return true;const hay=(b.name+" "+(b.nameAr||"")+" "+(b.segment||"")+" "+(b.source||"")+" "+(b.assignedTo||"")+" "+(b.notes||"")+" "+(b.contacts||[]).map(c=>c.name+c.email+c.phone).join(" ")).toLowerCase();return hay.includes(q);}


function leadDashboard(v,id){
  const b=getLead(id);if(!b){openLead=null;return renderLeads(v);}
  const sg=leadStage(b);const acts=(b.activities||[]).slice().sort((x,y)=>y.date-x.date);const stageIdx=LEAD_STAGES.indexOf(sg);
  const sc=leadScore(b),sb=scoreBand(sc);
  const tiles=[["Lead score",sc+" · "+sb.l],["Activities",acts.length],["Assigned",b.assignedTo||b.owner||"Unassigned"]];
  v.innerHTML=`<button class="btn ghost sm" onclick="closeLead()">← Back to pipeline</button>
  <div class="detail-head">
    <div class="ava" style="background:${avaColor(b.id)}">${initials(b.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800;letter-spacing:-.02em">${window.nmMain?esc(nmMain(b)):esc(b.name)}</div>${window.nmSubHTML?nmSubHTML(b):''}<div class="tags" style="margin-top:8px"><span class="statusbadge" style="background:${LSTAGE_COLOR[sg]}1a;color:${LSTAGE_COLOR[sg]}"><span class="dot" style="background:${LSTAGE_COLOR[sg]}"></span>${sg}</span>${directLinkTag(b)}${b.source?'<span class="tag" style="background:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'1a;color:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'">'+esc(b.source)+'</span>':""}${b.website?'<a class="tag" style="background:#2E90FA14;color:#2E90FA;text-decoration:none" target="_blank" rel="noopener" href="'+esc(b.website)+'">Website</a>':""}${b.corpEmailFlag?'<span class="tag" style="background:#F0453A14;color:#D92D20" title="Individual using a company email - check">Corp email: '+esc(b.corpEmailFlag)+'</span>':""}<span class="tag" style="background:${sb.c}1a;color:${sb.c}">Score ${sc} · ${sb.l}</span><span class="tag seg">${esc(b.segment||"")}</span></div>${leadRisks(b).length?`<div class="tags" style="margin-top:6px">${riskTags(b)}</div>`:""}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" onclick="setLeadView('detail')">📄 Detail view</button><button class="btn pri sm" onclick="logActivity('${b.id}')">＋ Log activity</button><button class="btn sm" onclick="editBusiness('${b.id}')">Edit</button></div>
  </div>
  <div class="chips" style="margin-bottom:14px">${tiles.map(t=>`<div class="chip"><div class="v">${esc(String(t[1]))}</div><div class="l">${t[0]}</div></div>`).join("")}</div>
  <div class="card" style="margin-bottom:14px"><h3>Pipeline stage</h3><div class="ch-sub">Click a stage to move the deal — syncs to the table, board and dashboard.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${LEAD_STAGES.map((s,i)=>`<button onclick="setLeadStage('${b.id}','${s}')" style="flex:1;min-width:84px;border:0;cursor:pointer;border-radius:9px;padding:11px 8px;font:inherit;font-size:12px;font-weight:700;color:${i<=stageIdx&&sg!=='Lost'?'#fff':s===sg?'#fff':'var(--muted)'};background:${s===sg?LSTAGE_COLOR[s]:(i<stageIdx&&sg!=='Lost'?LSTAGE_COLOR[s]+'cc':'#eceef4')}">${s}</button>`).join("")}</div>
  </div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Work log</h3><div class="ch-sub">Calls, meetings, emails, tasks — the full history with this account.</div>
      ${acts.length?`<div class="timeline">${acts.map(a=>`<div class="tl-item"><div class="when">${fmtDate(a.date)} · ${fmtAgo(a.date)}${a.by?" · "+esc(a.by):""}</div><div class="what"><b>${esc(a.type)}</b>${a.status?` → <b>${esc(a.status)}</b>`:""}${a.note?": "+esc(a.note):""}</div></div>`).join("")}</div>`:'<div class="empty">No activity yet — click “Log activity”.</div>'}
      <div style="margin-top:10px"><button class="btn sm" onclick="logActivity('${b.id}')">＋ Log activity</button></div>
    </div>
    ${b.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6">${esc(b.notes)}</p></div>`:""}
  </div><div>
    <div class="card"><h3>Relationship to Direct</h3>
      <div class="fact"><span class="k">Link type</span><span class="v">${directLinkTag(b)}${b.source?'<span class="tag" style="background:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'1a;color:'+(SOURCE_COLOR[b.source]||"#9AA1B6")+'">'+esc(b.source)+'</span>':""}${b.website?'<a class="tag" style="background:#2E90FA14;color:#2E90FA;text-decoration:none" target="_blank" rel="noopener" href="'+esc(b.website)+'">Website</a>':""}${b.corpEmailFlag?'<span class="tag" style="background:#F0453A14;color:#D92D20" title="Individual using a company email - check">Corp email: '+esc(b.corpEmailFlag)+'</span>':""}</span></div>
      <div class="fact"><span class="k">Category</span><span class="v">${esc(b.category||"—")}</span></div>
      <div class="fact"><span class="k">Invoices</span><span class="v">${b.invoices||0}</span></div>
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
  v.innerHTML=`<button class="btn ghost sm" onclick="closeLead()">← Back to pipeline</button>
  <div class="detail-head">
    <div class="ava" style="background:${avaColor(b.id)}">${initials(b.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800;letter-spacing:-.02em">${window.nmMain?esc(nmMain(b)):esc(b.name)}</div>${window.nmSubHTML?nmSubHTML(b):''}<div class="tags" style="margin-top:8px">${tags.join("")}<span class="tag seg">${esc(b.segment||"")}</span></div></div>
    <div style="text-align:right">
      <select onchange="setLeadStage('${b.id}',this.value)" style="padding:9px 12px;border-radius:10px;border:1px solid ${LSTAGE_COLOR[st]};color:${LSTAGE_COLOR[st]};font-weight:700;background:${LSTAGE_COLOR[st]}12;font-family:inherit;cursor:pointer">${LEAD_STAGES.map(s=>`<option ${s===st?"selected":""}>${s}</option>`).join("")}</select>
      <div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap"><button class="btn sm" style="display:none" onclick="setLeadView('dash')">📊 Dashboard view</button>${!b.isClient?`<button class="btn sm" style="border-color:#16B364;color:#16B364" onclick="convertToClient('${b.id}')">★ Convert to client</button>`:''}<button class="btn pri sm" onclick="logActivity('${b.id}')">＋ Log activity</button><button class="btn sm" onclick="newRequestForLead('${b.id}')">＋ Request</button><button class="btn sm" onclick="editBusiness('${b.id}')">Edit</button></div>
    </div>
  </div>
  <div class="detail-grid">
    <div>
      <div class="card"><h3>Activity &amp; workflow</h3><div class="ch-sub">Every touch with this business — no digging through chats or invoices</div>
      ${acts.length?`<div class="timeline">${acts.map(a=>`<div class="tl-item"><div class="when">${fmtDate(a.date)} · ${fmtAgo(a.date)}${a.by?" · "+esc(a.by):""}</div><div class="what"><b>${esc(a.type)}</b>${a.status?` → moved to <b>${esc(a.status)}</b>`:""}${a.note?": "+esc(a.note):""}</div></div>`).join("")}</div>`:'<div class="empty">No activity yet — click “Log activity” after your first contact.</div>'}</div>
      <div class="card"><h3>Contacts</h3>${(b.contacts||[]).length?b.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||c.email||"?")}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||"—")}${c.role?` <span style="font-weight:400;color:var(--muted);font-size:11.5px">· ${esc(c.role)}</span>`:""}${c.needsConfirm?` <span class="v72-confirm" title="${esc(c.confirmReason||"")}" style="display:inline-block;margin-inline-start:6px;padding:1px 7px;border-radius:9px;background:#FFF3EC;color:#B54708;font-size:10.5px;font-weight:700;cursor:help">⚠ ${(typeof LANG!=="undefined"&&LANG==="ar")?"يحتاج تأكيدًا":"needs confirmation"}</span>`:""}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:""}${c.email&&c.phone?" · ":""}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> <a href="https://wa.me/${String(c.phone).replace(/[^0-9]/g,"").replace(/^0/,"966")}" target="_blank" rel="noopener" style="color:#16B364;font-weight:800" title="WhatsApp">WA</a>`:""}</div></div></div>`).join(""):'<div class="empty">No contacts yet.</div>'}</div>${corpCard(b)}
    </div>
    <div>
      <div class="card"><h3>Key facts</h3>
        <div class="fact"><span class="k">Invoices</span><span class="v">${b.invoices||0}</span></div>
        <!-- Category had no fallback here, so a lead without one printed the word "undefined"
             on screen. Every other row on this panel already had one. -->
        <div class="fact"><span class="k">Category</span><span class="v">${esc(b.category||"—")}</span></div>
        ${b.lostReason?`<div class="fact"><span class="k" style="color:#D92D20">Why we lost it</span><span class="v" style="color:#D92D20;font-weight:600">${esc(b.lostReason)}</span></div>`:""}
        <div class="fact"><span class="k">Funnel</span><span class="v">${(()=>{const fn=(typeof LANG!=='undefined'&&LANG==='ar'&&b.funnelNameAr)?b.funnelNameAr:b.funnelName;return fn?`<span class="tag" style="background:#EEF0F5;color:#4B5563">${esc(fn)}</span>`:(b.source?`<span class="tag" style="background:${SOURCE_COLOR[b.source]}1a;color:${SOURCE_COLOR[b.source]}">${esc(b.source)}</span>`:"—");})()}</span></div>
        <div class="fact"><span class="k">Assigned to</span><span class="v">${esc(b.assignedTo||b.owner||"Unassigned")}</span></div>
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

function convertToClient(id){const b=getLead(id);if(!b)return;if(!b.accountManager&&b.assignedTo)b.accountManager=b.assignedTo;var _ar=(typeof LANG!=='undefined'&&LANG==='ar');if(!confirm(_ar?("اعتماد «"+b.name+"» كعميل رابح؟ سينتقل إلى قائمة عملائك."):("Mark “"+b.name+"” as a won client? It moves into your Clients book of business.")))return;b.isClient=true;b.status="Won";b.convertedDate=Date.now();b.lastContact=Date.now();b.activities=b.activities||[];b.activities.push({date:Date.now(),type:"Won",status:"Won",note:"Converted from lead to client",by:(typeof me==="function"?me():"Abdelrahman")});save();render();}
// Client health — one scannable status from engagement + review governance.
// Red is reserved for a real problem (overdue review, or contact that HAS happened but has gone stale).
// A client with no logged history yet is "New", not "At risk" — we don't manufacture alarms from empty data.
function clientHealth(b){
  var today=new Date().toISOString().slice(0,10);
  var la=(b.activities||[]).slice().sort((x,y)=>(y.date||0)-(x.date||0))[0];
  var last=b.lastContact||(la&&la.date)||0;           // canonical last-touch, ms; 0 = never
  var daysAct=last?Math.floor((Date.now()-last)/864e5):null;
  var reviewOverdue=b.nextReview&&b.nextReview<=today;
  if(reviewOverdue)return {l:'At risk',c:'#D92D20',why:'Account review overdue'};
  if(daysAct===null)return {l:'New',c:'#6B7480',why:'No activity logged yet'};
  if(daysAct>90)return {l:'At risk',c:'#D92D20',why:'No contact in 90+ days'};
  if(daysAct>45)return {l:'Watch',c:'#F79009',why:'No contact in 45+ days'};
  return {l:'Good',c:'#16B364',why:'Active and up to date'};
}
function renderClients(v){
  let cl=DB.businesses.filter(b=>b.isClient);
  if(clFilter.q){const q=clFilter.q.toLowerCase();cl=cl.filter(b=>((b.name||"")+" "+(b.nameAr||"")+" "+((b.contacts||[]).map(c=>String(c.email||"")+String(c.phone||"")).join(" "))).toLowerCase().includes(q));}
  if(clFilter.owner!=="all")cl=cl.filter(b=>window.sameOwner?sameOwner(b.accountManager||b.assignedTo,clFilter.owner):(b.accountManager||b.assignedTo||"")===clFilter.owner);
  if(clFilter.tier!=="all")cl=cl.filter(b=>(b.tier||"Standard")===clFilter.tier);
  const sv=(b,k)=>k==="am"?String(b.accountManager||b.assignedTo||"").toLowerCase():k==="tier"?String(b.tier||"Standard"):k==="review"?(b.nextReview||"9999-99"):k==="health"?({"At risk":0,Watch:1,New:2,Good:3}[clientHealth(b).l]):String(b.name||"").toLowerCase();
  cl=cl.slice().sort((a,b)=>{const va=sv(a,clSort.k),vb=sv(b,clSort.k);return va<vb?-1*clSort.dir:va>vb?1*clSort.dir:0;});
  const won=DB.businesses.filter(b=>!b.isClient&&leadStatus(b)==="Won").length;
  const today=new Date().toISOString().slice(0,10);
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
    <select onchange="clFilter.owner=this.value;render()" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer"><option value="all">All managers</option>${[...new Set(DB.businesses.filter(b=>b.isClient).map(b=>b.accountManager||b.assignedTo).filter(Boolean))].sort().map(t=>`<option value="${t}" ${clFilter.owner===t?"selected":""}>${t}</option>`).join("")}</select>
    <button class="btn sm ${clFilter.owner===(window.meName?meName():"")&&clFilter.owner!=="all"?"pri":"ghost"}" onclick="clToggleMine()">👤 ${(typeof LANG!=="undefined"&&LANG==="ar")?"خاص بي":"Mine"}</button>
    <select onchange="clFilter.tier=this.value;render()" style="border:1px solid var(--line-2);border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;background:#fff;cursor:pointer"><option value="all">All tiers</option><option ${clFilter.tier==="Key"?"selected":""}>Key</option><option ${clFilter.tier==="Standard"?"selected":""}>Standard</option></select>
  </div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th style="cursor:pointer" onclick="clSortBy('name')">Client${clArrow('name')}</th><th style="cursor:pointer" onclick="clSortBy('am')">Account manager${clArrow('am')}</th><th style="cursor:pointer" onclick="clSortBy('tier')">Tier${clArrow('tier')}</th><th>Client since</th><th style="cursor:pointer" onclick="clSortBy('review')">Next review${clArrow('review')}</th><th style="cursor:pointer" onclick="clSortBy('health')" title="Client health — Good / Watch / At risk. Click to surface at-risk clients.">Health${clArrow('health')}</th><th></th></tr></thead><tbody>
  ${cl.map(b=>{const am=b.accountManager||b.assignedTo;const overdue=b.nextReview&&b.nextReview<=today;const la=(b.activities||[]).slice().sort((x,y)=>(y.date||0)-(x.date||0))[0];const since=b.convertedDate||b.convertDate||'';const _h=clientHealth(b);return `<tr data-health="${_h.l}" data-client-row="1" data-key="${b.tier==="Key"?1:0}" style="cursor:pointer" onclick="openLead='${b.id}';current='leads';render()"><td><b>${window.nmMain?esc(nmMain(b)):esc(b.name)}</b>${b.directClientId?` <span style="color:var(--muted);font-size:10.5px">#${esc(b.directClientId)}</span>`:''}${window.nmSubHTML?nmSubHTML(b):''}${la?`<div style="font-size:11px;color:#0F6E56;margin-top:2px">↪ ${esc(String((la.type||'Activity')+(la.note?': '+la.note:'')).slice(0,46))}</div>`:''}</td><td>${am?esc(am):'<span class="tag" style="background:#F0453A14;color:#D92D20">Unassigned</span>'}</td><td>${(b.tier==="Key")?'<span class="tag" style="background:#A9781A1a;color:#A9781A;font-weight:800">KEY</span>':'<span class="tag" style="background:#EEF0F5;color:#5b6178">Standard</span>'}</td><td style="white-space:nowrap;color:var(--muted);font-size:12px">${since?esc(typeof since==='number'?new Date(since).toISOString().slice(0,10):String(since)):'<span style="color:#C9C2B6">—</span>'}</td><td style="white-space:nowrap;${overdue?'color:#D92D20;font-weight:700':'color:var(--muted)'}">${b.nextReview?esc(b.nextReview):'-'}</td>${(function(){var h=_h;return '<td><span class="tag" style="background:'+h.c+'1a;color:'+h.c+';font-weight:700" title="'+h.why+'">'+h.l+'</span></td>';})()}<td><button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="event.stopPropagation();leadQuickEdit('${b.id}')">Edit</button></td></tr>`;}).join("")||'<tr><td colspan="7" class="empty">No clients match.</td></tr>'}
  </tbody></table></div></div>`;
  const cq=document.getElementById("clq");if(cq){cq.oninput=e=>{clFilter.q=e.target.value;render();const n=document.getElementById("clq");if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(_){}}};}
}
function logActivity(id){const b=getLead(id);if(!b)return;
  openModal("Log activity — "+esc(b.name),`<div class="grid2"><div class="field"><label>Type</label><select id="a_type">${ACT_TYPES.map(t=>`<option>${t}</option>`).join("")}</select></div><div class="field"><label>Move stage to</label><select id="a_status"><option value="">— keep ${esc(leadStage(b))} —</option>${LEAD_STAGES.map(s=>`<option>${s}</option>`).join("")}</select></div></div><div class="field"><label>What happened? — paste the conversation or write a summary</label><textarea id="a_note" rows="7" placeholder="e.g. Called Mr. Nasser — interested, sending the proposal Sunday"></textarea></div><div class="field"><label>Next action (optional)</label><input id="a_next" value="${esc(b.nextAction||"")}"></div>`,
  ()=>{const ns=val("a_status");b.activities=b.activities||[];b.activities.push({date:Date.now(),type:val("a_type"),status:ns||"",note:val("a_note"),by:(typeof me==="function"?me():"Abdelrahman")});if(ns){b.stage=ns;b.status=ns;if(ns==="Won")b.isClient=true;}b.lastContact=Date.now();b.nextAction=val("a_next");save();render();});
}

function editBusiness(id){
  const isNew=!id;const b=id?JSON.parse(JSON.stringify(getLead(id))):{id:uid("b"),name:"",nameAr:"",segment:"",category:"Convert",source:"Direct outreach",assignedTo:(window.meName?meName():""),channels:[],isClient:false,isVendor:false,totalSAR:0,invoices:0,contacts:[],notes:"",owner:"",services:"",nextAction:""};
  openModal(isNew?"New business":esc(b.name),`
    <div class="grid2"><div class="field"><label>Business name (canonical)</label><input id="f_name" value="${esc(b.name)}"></div><div class="field"><label>Arabic name</label><input id="f_ar" value="${esc(b.nameAr||"")}" dir="rtl"></div></div>
    <div class="grid2"><div class="field"><label>Segment</label><input id="f_seg" value="${esc(b.segment||"")}" placeholder="Government / Study-abroad school…"></div><div class="field"><label>Category</label><select id="f_cat">${CATEGORIES.map(c=>`<option ${b.category===c?"selected":""}>${c}</option>`).join("")}</select></div></div>
    <div class="field"><label>Funnel — where this lead came from</label><select id="f_funnel"><option value="">${(typeof LANG!=="undefined"&&LANG==="ar")?"— بدون قناة —":"— no funnel —"}</option>${(window.__funnelDefs||[]).map(f=>`<option value="${f.key}" ${b.funnelKey===f.key?"selected":""}>${(typeof LANG!=="undefined"&&LANG==="ar")?(f.name_ar||f.name_en):f.name_en}</option>`).join("")}</select></div>
    
    <div class="grid2"><div class="field"><label>Funnel / source</label><select id="f_source" onchange="(function(v){var w=document.getElementById('f_sub_wrap');if(w)w.style.display=(v==='Travel Agencies')?'':'none';})(this.value)">${(typeof funnelList==='function'?funnelList():SOURCES).map(s=>`<option ${(b.source||"")===s?"selected":""}>${s}</option>`).join("")}</select></div><div class="field"><label>Assigned to (who works it)</label><select id="f_assign"><option value="">— Unassigned —</option>${teamList().map(t=>`<option ${(b.assignedTo||"")===t?"selected":""}>${t}</option>`).join("")}</select></div></div>
    <div class="grid2" id="f_sub_wrap" style="display:${(b.source==='Travel Agencies')?'':'none'}"><div class="field"><label>Agency subtype</label><select id="f_sub"><option value="">— General —</option>${((DB.settings&&DB.settings.funnelSubs&&DB.settings.funnelSubs['Travel Agencies'])||[]).map(s=>`<option ${(b.sourceSub||'')===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="field"><label>Services they use</label><input id="f_serv" list="svclist" value="${esc(b.services||"")}" placeholder="Flights, Hotels, Visa, Insurance, Intl driving permit…"><datalist id="svclist">${(window.SVC_CATALOG||[]).filter(p=>!["Visas","Transport","Tours","Events","Wallet top-up","Mixed","(unspecified)"].includes(p[0])).map(p=>`<option value="${esc(p[0])}">`).join("")}</datalist></div><div class="field"><label>Area (city)</label><select id="f_area"><option value="">— Select —</option>${['Riyadh','Jeddah','Makkah','Madinah','Dammam','Khobar','Other'].map(a=>`<option ${(b.area||'')===a?'selected':''}>${a}</option>`).join('')}</select></div></div>
    <div class="field"><label>Channels of communication</label><div style="display:flex;flex-wrap:wrap;gap:8px">${CHANNELS.map(ch=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;background:#f6f3ee;padding:5px 10px;border-radius:8px;cursor:pointer"><input type="checkbox" class="f_ch" value="${ch}" ${(b.channels||[]).includes(ch)?"checked":""}>${ch}</label>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label>Existing client?</label><select id="f_client"><option value="no" ${!b.isClient?"selected":""}>No</option><option value="yes" ${b.isClient?"selected":""}>Yes</option></select></div><div class="field"><label>Vendor / commission?</label><select id="f_vendor"><option value="no" ${!b.isVendor?"selected":""}>No</option><option value="yes" ${b.isVendor?"selected":""}>Yes</option></select></div></div>
    <div class="grid2"><div class="field"><label>Stage</label><select id="f_stage">${LEAD_STAGES.map(s=>`<option ${leadStage(b)===s?"selected":""}>${s}</option>`).join("")}</select></div></div>
    <div class="grid2"><div class="field"><label>Next action</label><input id="f_next" value="${esc(b.nextAction||"")}"></div><div class="field"><label>Next action due</label><input id="f_due" type="date" value="${esc(b.dueDate||"")}"></div></div>
    
    <div class="field"><label>Contacts (same business, multiple people)</label><div id="contacts"></div><button class="btn sm" onclick="addContactRow()">+ Add contact</button></div>
    <div class="field"><label>Notes</label><textarea id="f_notes" rows="2">${esc(b.notes||"")}</textarea></div>
  `,()=>{b.name=val("f_name");b.nameAr=val("f_ar");b.segment=val("f_seg");b.area=val("f_area");b.category=val("f_cat");b.services=val("f_serv");b.nextAction=val("f_next");b.source=val("f_source");b.sourceSub=(val("f_source")==='Travel Agencies'?val("f_sub"):'');b.assignedTo=val("f_assign")||(window.meName?meName():"")||(typeof me==="function"?me():"");const _fk=val("f_funnel");b.funnelKey=_fk||null;const _fd=(window.__funnelDefs||[]).find(f=>f.key===_fk);b.funnelName=_fd?_fd.name_en:null;b.funnelNameAr=_fd?_fd.name_ar:null;const _wasClient=!!b.isClient;b.stage=val("f_stage");b.status=val("f_stage");b.dueDate=val("f_due");b.channels=[...document.querySelectorAll(".f_ch:checked")].map(e=>e.value);b.isClient=val("f_client")==="yes";if(b.stage==="Won")b.isClient=true;b.isVendor=val("f_vendor")==="yes";b.notes=val("f_notes");b.contacts=readContacts();if(!b.name.trim()){alert("Business name required.");return false;}const i=DB.businesses.findIndex(x=>x.id===b.id);if(i>=0)DB.businesses[i]=b;else DB.businesses.push(b);save();render();if(b.isClient&&!_wasClient&&typeof window.__clientHandover==='function')setTimeout(()=>window.__clientHandover(b.id),250);},isNew?null:()=>{if(confirm("Delete this company?\n\nIt moves to the Archive and stops appearing in anyone's lists. An admin can restore it for 30 days.")){DB.businesses=DB.businesses.filter(x=>x.id!==id);openLead=null;if(typeof logAudit==='function')try{logAudit('lead',id,'delete',(b&&b.name)||'');}catch(_){}save();render();}});
  window._contacts=(b.contacts||[]).slice();drawContacts();
}
function drawContacts(){const c=document.getElementById("contacts");if(!c)return;c.innerHTML=(window._contacts||[]).map((ct,i)=>`<div class="contact"><input placeholder="Name" value="${esc(ct.name||"")}" oninput="window._contacts[${i}].name=this.value"><input placeholder="Email" value="${esc(ct.email||"")}" oninput="window._contacts[${i}].email=this.value"><input placeholder="Phone" value="${esc(ct.phone||"")}" oninput="window._contacts[${i}].phone=this.value"><span class="x" onclick="window._contacts.splice(${i},1);drawContacts()">✕</span></div>`).join("");}
function addContactRow(){window._contacts.push({name:"",email:"",phone:""});drawContacts();}
function readContacts(){return (window._contacts||[]).filter(c=>(c.name||c.email||c.phone));}

