/* ----- Suppliers (Airlines + Providers) ----- */
let openSup=null,supKind="air",supSort={k:"name",dir:1};
function supSortBy(k){if(supSort.k===k)supSort.dir*=-1;else{supSort.k=k;supSort.dir=1;}drawSupTable(document.getElementById("sq")?document.getElementById("sq").value:"");}
function supArrow(k){return supSort.k===k?(supSort.dir>0?" ▲":" ▼"):"";}
let supView="detail";
function setSupView(m){supView=m;render();window.scrollTo(0,0);}
function ndcActive(a){return NDC_PROVIDERS.filter(p=>a.ndc&&a.ndc[p]&&a.ndc[p].status==="Active").length;}
function ndcBadge(a){const n=ndcActive(a);const col=n>0?"#16B364":"#9AA1B6";return `<span class="tag" style="background:${col}1a;color:${col};font-variant-numeric:tabular-nums">${n}/${NDC_PROVIDERS.length} NDC</span>`;}
function admRiskTag(x){const m={Low:"#16B364",Medium:"#F79009",High:"#F0453A"};const c=m[x.admRisk]||"#9AA1B6";return `<span class="tag" style="background:${c}1a;color:${c}">${esc(x.admRisk||"—")}</span>`;}
function allianceTag(x){const c={"Star Alliance":"#F0453A",SkyTeam:"#2E90FA",Oneworld:"#7A5AF8"}[x.alliance]||"#9AA1B6";return x.alliance&&x.alliance!=="—"?`<span class="tag" style="background:${c}1a;color:${c}">${esc(x.alliance)}</span>`:'<span class="muted">—</span>';}
function airNetworkCard(x){return `<div class="card"><h3>Network &amp; commercial profile</h3>
<div class="fact"><span class="k">Alliance</span><span class="v">${allianceTag(x)}</span></div>
<div class="fact"><span class="k">Corporate deal / TMC tariff</span><span class="v">${x.corporateDeal==='Yes'?'<span class="tag" style="background:#16B36418;color:#16B364">Available</span>':'<span class="muted">No</span>'}</span></div>
<div class="fact"><span class="k">Codeshare / interline</span><span class="v">${esc(x.codeshare||'—')}</span></div>
<div class="fact"><span class="k">Hubs / focus cities</span><span class="v">${esc(x.hubs||'—')}</span></div>
<div class="fact"><span class="k">Fleet (primary)</span><span class="v">${esc(x.fleet||'—')}</span></div>
<div class="fact"><span class="k">Classes offered</span><span class="v">${esc(x.classes||'—')}</span></div>
<div class="fact"><span class="k">ADM risk profile</span><span class="v">${admRiskTag(x)}</span></div>
<div class="fact"><span class="k">On-time performance</span><span class="v">${esc(x.otp||'—')}</span></div>
<div class="fact"><span class="k">SAF / sustainability</span><span class="v">${esc(x.saf||'—')}</span></div>
<div class="fact"><span class="k">NDC version · env</span><span class="v">${esc(x.ndcVersion||'—')} · ${esc(x.ndcEnv||'—')}</span></div>
${x.corpPortal?`<div style="margin-top:10px">${supLink(x.corpPortal,'Corporate self-service portal')}</div>`:''}</div>`;}
function setNdc(id,prov,field,v){const a=DB.airlines.find(x=>x.id===id);if(!a)return;a.ndc=a.ndc||{};a.ndc[prov]=a.ndc[prov]||{status:"N/A",content:"—",updated:"",notes:""};a.ndc[prov][field]=v;if(field!=="notes")a.ndc[prov].updated=new Date().toISOString().slice(0,10);save();render();}
function setNdcNotes(id,prov,v){const a=DB.airlines.find(x=>x.id===id);if(!a||!a.ndc[prov])return;a.ndc[prov].notes=v;a.ndc[prov].updated=new Date().toISOString().slice(0,10);save();}
function ndcMatrixHTML(a){
 const hasData=p=>{const c=a.ndc&&a.ndc[p];return !!(c&&((c.status&&c.status!=="N/A")||(c.notes&&c.notes.trim())));};
 const show=window.ndcShowAll?NDC_PROVIDERS:NDC_PROVIDERS.filter(hasData);
 const hidden=NDC_PROVIDERS.length-show.length;
 const row=p=>{const c=(a.ndc&&a.ndc[p])||{status:"N/A",content:"—",updated:"",notes:""};const col=NDC_STATUS_COLOR[c.status]||"#9AA1B6";return `<tr><td><b>${p}</b></td><td><select onchange="setNdc('${a.id}','${p}','status',this.value)" style="border:1px solid ${col};color:${col};background:${col}12;border-radius:7px;padding:4px 8px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">${NDC_STATUS.map(s=>`<option ${s===c.status?"selected":""}>${s}</option>`).join("")}</select></td><td><select onchange="setNdc('${a.id}','${p}','content',this.value)" style="border:1px solid var(--line-2);border-radius:7px;padding:4px 8px;font:inherit;font-size:12px;cursor:pointer">${NDC_CONTENT.map(s=>`<option ${s===c.content?"selected":""}>${s}</option>`).join("")}</select></td><td style="color:var(--muted);white-space:nowrap;font-size:11.5px">${c.updated||"—"}</td><td><input value="${esc(c.notes||"")}" oninput="setNdcNotes('${a.id}','${p}',this.value)" placeholder="account / deeplink / agreement" style="width:100%;min-width:150px;border:1px solid var(--line-2);border-radius:7px;padding:5px 8px;font:inherit;font-size:12px"></td></tr>`;};
 const body=show.map(row).join("")||`<tr><td colspan="5" class="empty">No active NDC / content source on this carrier yet.</td></tr>`;
 const tog=hidden>0?`<button class="btn ghost sm" style="margin-top:8px" onclick="window.ndcShowAll=true;render()">Show all ${NDC_PROVIDERS.length} sources (${hidden} empty hidden)</button>`:(window.ndcShowAll?`<button class="btn ghost sm" style="margin-top:8px" onclick="window.ndcShowAll=false;render()">Hide empty rows</button>`:"");
 return `<div class="tbl-wrap"><table><thead><tr><th>Source / provider</th><th>NDC status</th><th>Content type</th><th>Updated</th><th>Notes (account / link)</th></tr></thead><tbody>${body}</tbody></table></div>${tog}`;
}

function supArr(k){return k==="air"?(DB.airlines=DB.airlines||[]):(DB.vendors=DB.vendors||[]);}
function openSupFn(kind,id){openSup=id;supKind=kind;supView="detail";window.ndcShowAll=false;render();window.scrollTo(0,0);}
function closeSup(){openSup=null;supView="detail";render();}
function renderSuppliers(v,kind){
  supKind=kind;
  if(openSup)return supView==='dash'?(kind==='air'?supDashboard(v,openSup):provDashboard(v,openSup)):supplierDetail(v,kind,openSup);
  const isAir=kind==="air";
  const _arSup=(typeof LANG!=='undefined'&&LANG==='ar');
  v.innerHTML=`
  <div class="toolbar"><div class="search-wrap">${IC.search}<input id="sq" placeholder="${_arSup?'بحث…':'Search…'}" oninput="drawSupTable(this.value)"></div><div style="flex:1"></div><button class="btn pri" onclick="editSupplier('${kind}')">+ New ${isAir?'airline':'provider'}</button></div>`;
  v.innerHTML+=`<div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th style="width:26px"><input type="checkbox" onclick="supSelectAll(this)"></th><th style="width:32px">#</th>${isAir?`<th style="cursor:pointer" onclick="supSortBy('name')">Airline${supArrow('name')}</th><th style="cursor:pointer" onclick="supSortBy('code')">IATA${supArrow('code')}</th><th style="cursor:pointer" onclick="supSortBy('stock')">Stock${supArrow('stock')}</th><th style="cursor:pointer" onclick="supSortBy('ksa')">KSA BSP${supArrow('ksa')}</th><th style="cursor:pointer" onclick="supSortBy('ticketingAuthority')">Authority${supArrow('ticketingAuthority')}</th><th>NDC</th><th>Void</th><th>Refund to</th>`:`<th style="cursor:pointer" onclick="supSortBy('name')">Provider${supArrow('name')}</th><th style="cursor:pointer" onclick="supSortBy('type')">Type${supArrow('type')}</th><th>API</th><th style="cursor:pointer" onclick="supSortBy('source')">Availability source${supArrow('source')}</th><th>Portal</th><th>Contacts</th>`}${isAir?``:`<th></th>`}</tr></thead><tbody id="suptb"></tbody></table></div></div>`;
  drawSupTable("");
}
function drawSupTable(q){q=(q||"").toLowerCase();const isAir=supKind==="air";const arr=supArr(supKind);const tb=document.getElementById("suptb");if(!tb)return;
  const _arSt=(typeof LANG!=='undefined'&&LANG==='ar');
  let rows=arr.filter(x=>!q||(x.name+" "+(x.code||"")+" "+(x.type||"")+" "+(x.stock||"")+" "+(x.ksa||"")+" "+(x.country||"")+" "+(x.source||"")+" "+(x.alliance||"")+" "+(x.ticketingAuthority||"")).toLowerCase().includes(q));
  const k=supSort.k,d=supSort.dir;rows=rows.slice().sort((a,b)=>{const va=(a[k]==null?"":a[k]).toString().toLowerCase(),vb=(b[k]==null?"":b[k]).toString().toLowerCase();return va<vb?-1*d:va>vb?1*d:0;});
  const authTag=x=>{const t=x.ticketingAuthority||'';return t.indexOf('Authorized')===0?'<span class="tag" style="background:#16B36418;color:#16B364">Authorized</span>':t?'<span class="tag" style="background:#F7900918;color:#B54708">Target</span>':'—';};
  tb.innerHTML=rows.map((x,i)=>`<tr style="cursor:pointer" onclick="openSupFn('${supKind}','${x.id}')"><td onclick="event.stopPropagation()"><input type="checkbox" class="supchk" value="${x.id}"></td><td style="color:var(--muted)">${i+1}</td><td><b>${esc(x.name)}</b>${isAir?` <button class="btn ghost sm" style="padding:1px 7px;font-size:10.5px" onclick="event.stopPropagation();airQuickEdit('${x.id}')">Edit</button>`:``}<div style="font-size:11px;color:var(--muted)">${esc(x.country||'')}${x.country&&x.type?' · ':''}${esc(x.type||'')}</div></td>${isAir?`<td><span class="tag seg">${esc(x.code||'—')}</span></td><td style="font-weight:700;font-variant-numeric:tabular-nums">${esc(x.stock||'—')}</td><td>${x.ksa==='Yes'?'<span class="tag" style="background:#16B36418;color:#16B364">Yes</span>':x.ksa==='No'?'<span class="tag" style="background:#9AA1B618;color:#82868B">No</span>':'—'}</td><td>${authTag(x)}</td><td>${ndcBadge(x)}</td><td style="font-size:11px;color:var(--muted);max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.voidRule||"")}">${esc(String(x.voidRule||"-").slice(0,24))}</td><td style="font-size:11px;color:var(--muted);max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc((x.type==="LCC"?x.lccRefundTo:x.refundRule)||"")}">${esc(String((x.type==="LCC"?x.lccRefundTo:x.refundRule)||"-").slice(0,24))}</td>`:`<td><span class="tag seg">${esc(x.type||'—')}</span></td><td>${apiTag(x)}</td><td style="color:var(--muted)">${esc(x.source||'—')}</td><td>${x.portal?'<span class="chiplink">●</span>':'<span class="muted">—</span>'}</td><td style="color:var(--muted)">${(x.contacts||[]).length||0}</td>`}${isAir?``:`<td style="text-align:right"><span class="chiplink">Open ›</span></td>`}</tr>`).join("")||`<tr><td colspan="9" class="empty">${_arSt?'لا توجد سجلات بعد.':'No records yet.'}</td></tr>`;
}

function supLink(u,label){if(!u)return '<span class="muted" style="font-size:12px">—</span>';const href=u.startsWith("http")?u:"https://"+u;return `<a class="chiplink" href="${esc(href)}" target="_blank" rel="noopener">${label} ↗</a>`;}
function airlinesOverview(){const A=DB.airlines||[];const n=A.length;
  const anyNdc=A.filter(a=>ndcActive(a)>0).length;const corp=A.filter(a=>a.corporateDeal==='Yes').length;
  const avgCov=n?(A.reduce((s,a)=>s+ndcActive(a),0)/n).toFixed(1):0;const saf=A.filter(a=>a.saf==='Yes').length;
  const kpis=[["Airlines",n],["NDC active",anyNdc],["Corporate-deal",corp],["Avg NDC /6",avgCov],["SAF-flagged",Math.round(saf/Math.max(1,n)*100)+"%"],["Coverage gaps",A.filter(a=>ndcActive(a)===0).length]];
  const provStats=NDC_PROVIDERS.map(p=>({p,act:A.filter(a=>a.ndc&&a.ndc[p]&&a.ndc[p].status==='Active').length,pend:A.filter(a=>a.ndc&&a.ndc[p]&&a.ndc[p].status==='Pending').length,inact:A.filter(a=>a.ndc&&a.ndc[p]&&a.ndc[p].status==='Inactive').length}));
  const allianceCount={};A.forEach(a=>{const k=(a.alliance&&a.alliance!=='—')?a.alliance:'Unaligned';allianceCount[k]=(allianceCount[k]||0)+1;});
  const allRows=["Star Alliance","SkyTeam","Oneworld","Unaligned"].map(k=>[k,allianceCount[k]||0]);
  const admCount={Low:0,Medium:0,High:0};A.forEach(a=>{if(admCount[a.admRisk]!=null)admCount[a.admRisk]++;});
  const hubCount={};A.forEach(a=>{(a.hubs||'').split(/[,/]/).map(s=>s.trim()).filter(Boolean).forEach(h=>{hubCount[h.toUpperCase()]=(hubCount[h.toUpperCase()]||0)+1;});});
  const topHubs=Object.entries(hubCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const gaps=A.filter(a=>ndcActive(a)===0).slice(0,14);
  return `<div class="card" style="margin-bottom:14px"><h3>Airlines overview</h3><div class="ch-sub">Aggregate across ${n} carriers · NDC coverage, alliances, ADM risk and gaps.</div>
  <div class="chips" style="margin-top:4px">${kpis.map(k=>`<div class="chip"><div class="v">${esc(String(k[1]))}</div><div class="l">${k[0]}</div></div>`).join("")}</div></div>
  <div class="detail-grid"><div>
    <div class="card"><h3>NDC status by provider</h3>${provStats.map(s=>{const tot=Math.max(1,s.act+s.pend+s.inact+ (A.length-s.act-s.pend-s.inact));return `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:600">${s.p}</span><span style="color:var(--muted)">${s.act} active · ${s.pend} pending</span></div><div style="height:12px;border-radius:6px;overflow:hidden;display:flex;margin-top:3px;background:#eef0f5"><div style="width:${s.act/Math.max(1,A.length)*100}%;background:#16B364"></div><div style="width:${s.pend/Math.max(1,A.length)*100}%;background:#F79009"></div><div style="width:${s.inact/Math.max(1,A.length)*100}%;background:#F0453A"></div></div></div>`;}).join("")}<div style="font-size:11px;color:var(--muted);margin-top:6px"><span style="color:#16B364">■</span> Active &nbsp;<span style="color:#F79009">■</span> Pending &nbsp;<span style="color:#F0453A">■</span> Inactive</div></div>
    <div class="card"><h3>Coverage gaps — no provider active</h3><div class="ch-sub">${gaps.length} carriers need an NDC / content source. Tap to open.</div>${gaps.length?gaps.map(a=>`<span class="tag" style="cursor:pointer;background:#F0453A14;color:#F0453A;margin:3px 3px 0 0;display:inline-block" onclick="openSupFn('air','${a.id}')">${esc(a.name)}</span>`).join(""):'<div style="color:#16B364;font-size:13px">✓ Every carrier has at least one active source.</div>'}</div>
  </div><div>
    <div class="card"><h3>Alliance breakdown</h3>${allRows.map(([k,nn])=>`<div class="fact"><span class="k">${esc(k)}</span><span class="v">${nn}</span></div>`).join("")}</div>
    <div class="card"><h3>ADM risk distribution</h3>${[["Low","#16B364"],["Medium","#F79009"],["High","#F0453A"]].map(([k,c])=>`<div class="fact"><span class="k"><span class="tag" style="background:${c}1a;color:${c}">${k}</span></span><span class="v">${admCount[k]}</span></div>`).join("")}</div>
    <div class="card"><h3>Top hubs (carriers using)</h3>${topHubs.length?topHubs.map(([h,nn])=>`<div class="fact"><span class="k">${esc(h)}</span><span class="v">${nn}</span></div>`).join(""):'<div class="empty">Add hubs to carriers to populate this.</div>'}</div>
  </div></div>`;
}
function setProvMeta(i,f,v){DB.ndcProviders=DB.ndcProviders||NDC_PROVIDERS.map(p=>({key:p,lastUpdated:"",notes:""}));DB.ndcProviders[i][f]=v;save();}
function ndcProviderPanel(){
  const arr=DB.airlines||[];const prov=DB.ndcProviders||NDC_PROVIDERS.map(p=>({key:p,lastUpdated:"",notes:""}));
  return `<div class="card" style="margin-bottom:14px"><h3>NDC providers — content sources</h3><div class="ch-sub">Current-generation integrations (these will be refreshed over time). “Active” = how many airlines are live on NDC through that source.</div>
  <div class="tbl-wrap"><table><thead><tr><th>Provider</th><th>Airlines active</th><th>Last updated</th><th>Notes / version</th></tr></thead><tbody>
  ${prov.map((p,i)=>{const act=arr.filter(a=>a.ndc&&a.ndc[p.key]&&a.ndc[p.key].status==='Active').length;return `<tr><td><b>${esc(p.key)}</b></td><td style="font-weight:700;font-variant-numeric:tabular-nums">${act}/${arr.length}</td><td><input type="date" value="${esc(p.lastUpdated||'')}" onchange="setProvMeta(${i},'lastUpdated',this.value)" style="border:1px solid var(--line-2);border-radius:7px;padding:4px 7px;font:inherit;font-size:12px"></td><td><input value="${esc(p.notes||'')}" oninput="setProvMeta(${i},'notes',this.value)" placeholder="version / status / contact" style="width:100%;min-width:150px;border:1px solid var(--line-2);border-radius:7px;padding:5px 8px;font:inherit;font-size:12px"></td></tr>`;}).join("")}
  </tbody></table></div></div>`;
}
function setCap(id,cap,v){const x=(DB.vendors||[]).find(s=>s.id===id);if(!x)return;x.caps=x.caps||{};x.caps[cap]=v;save();render();}
function capMatrixHTML(x){return `<div style="display:flex;flex-wrap:wrap;gap:6px">${PROV_CAPS.map(c=>{const on=x.caps&&x.caps[c];return `<button onclick="event.stopPropagation();setCap('${x.id}','${c}',${!on})" style="border:0;cursor:pointer;border-radius:8px;padding:8px 12px;font:inherit;font-size:12px;font-weight:700;color:${on?'#fff':'var(--muted)'};background:${on?'#16B364':'#eceef4'}">${on?'✓ ':''}${c}</button>`;}).join('')}</div>`;}
function apiTag(x){const m={Healthy:"#16B364",Degraded:"#F79009",Down:"#F0453A"};const c=m[x.apiStatus]||"#9AA1B6";return `<span class="tag" style="background:${c}1a;color:${c}">${esc(x.apiStatus||"—")}</span>`;}
function provCommercialCard(x){return `<div class="card"><h3>Servicing &amp; commercial</h3>
<div class="fact" style="align-items:flex-start"><span class="k">Servicing</span><span class="v" style="text-align:right">${capMatrixHTML(x)}</span></div>
<div class="fact"><span class="k">Content mix</span><span class="v">${esc(x.contentMix||'—')}</span></div>
<div class="fact"><span class="k">Settlement</span><span class="v">${esc(x.settlement||'—')}</span></div>
<div class="fact"><span class="k">Commission / markup</span><span class="v">${esc(x.markup||x.terms||'—')}</span></div>
<div class="fact"><span class="k">Cost per booking</span><span class="v">${esc(x.costPerBooking||'—')}</span></div>
<div class="fact"><span class="k">Uptime · response</span><span class="v">${esc(x.uptime||'—')} · ${esc(x.respTime||'—')}</span></div>
<div class="fact"><span class="k">Support SLA</span><span class="v">${esc(x.supportSLA||'—')}</span></div>
<div class="fact"><span class="k">Account manager</span><span class="v">${esc(x.accountManager||'—')}</span></div>
<div class="fact"><span class="k">Contract renewal</span><span class="v">${esc(x.renewalDate||'—')}</span></div>
<div class="fact"><span class="k">Use for</span><span class="v">${esc(x.useFor||'—')}</span></div></div>`;}
function provDashboard(v,id){const x=(DB.vendors||[]).find(s=>s.id===id);if(!x){openSup=null;return renderSuppliers(v,'prov');}
  const tiles=[["API status",x.apiStatus||"—"],["Uptime",x.uptime||"—"],["Response",x.respTime||"—"],["Cost / booking",x.costPerBooking||"—"],["Settlement",x.settlement||"—"],["Renewal",x.renewalDate||"—"]];
  v.innerHTML=`<button class="btn ghost sm" onclick="closeSup()">← Back to providers</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(x.id)}">${initials(x.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(x.name)}</div><div class="tags" style="margin-top:8px"><span class="tag seg">${esc(x.type||'')}</span>${apiTag(x)}</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" onclick="setSupView('detail')">📄 Detail view</button><button class="btn sm" onclick="editSupplier('prov','${x.id}')">Edit</button></div></div>
  <div class="chips" style="margin-bottom:14px">${tiles.map(t=>`<div class="chip"><div class="v">${esc(String(t[1]))}</div><div class="l">${t[0]}</div></div>`).join("")}</div>
  <div class="card"><h3>Servicing capability matrix</h3><div class="ch-sub">Click to toggle what we can do through this provider — syncs to the list &amp; detail view.</div>${capMatrixHTML(x)}</div>
  <div class="detail-grid"><div>
    ${provCommercialCard(x)}
    <div class="card"><h3>Routed volume (reflected)</h3><div class="ch-sub">Auto-aggregated from bookings routed through this provider.</div>${(()=>{const st=providerStats(x.name);return `<div class="chips"><div class="chip"><div class="v">${st.nBk}</div><div class="l">Bookings</div></div><div class="chip"><div class="v">${st.nTk}</div><div class="l">Tickets</div></div><div class="chip"><div class="v">${moneyShort(st.val)}</div><div class="l">Value SAR</div></div><div class="chip"><div class="v">${st.nAir}</div><div class="l">Airlines</div></div></div>${st.topAir.length?`<div style="font-size:12px;color:var(--muted);margin-top:8px">Top airlines via ${esc(x.name)}</div>${st.topAir.map(r=>`<div class="fact"><span class="k">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')}`:''}${st.clients.length?`<div style="font-size:12px;color:var(--muted);margin-top:6px">Top clients</div>${st.clients.map(r=>`<div class="fact"><span class="k">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')}`:''}${st.bks.length?`<div class="related" style="margin-top:8px">${st.bks.slice(0,6).map(b=>`<a onclick="openBooking='${b.id}';current='bookings';render()">🧳 ${esc(b.ref)}</a>`).join('')}</div>`:'<div class="empty" style="margin-top:8px">No bookings routed here yet.</div>'}`;})()}</div>
    ${x.incidents?`<div class="card"><h3>Incident / outage history</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6;white-space:pre-line">${esc(x.incidents)}</p></div>`:''}
  </div><div>
    <div class="card"><h3>Contacts</h3>${(x.contacts||[]).length?x.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||'?')}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||'—')}${c.role?' · <span style="color:var(--muted);font-weight:400">'+esc(c.role)+'</span>':''}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?esc(c.email):''}${c.email&&c.phone?' · ':''}${c.phone?esc(c.phone):''}</div></div></div>`).join(""):'<div class="empty">No contacts yet.</div>'}</div>
    ${x.portal?`<div class="card"><h3>Portal</h3><div style="margin-top:4px">${supLink(x.portal,'Portal')}</div></div>`:''}
    ${x.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6">${esc(x.notes)}</p></div>`:''}
  </div></div>`;
}
function supDashboard(v,id){
  const a=DB.airlines.find(x=>x.id===id);if(!a){openSup=null;return renderSuppliers(v,'air');}
  const nA=ndcActive(a);
  const tiles=[["Ticket stock",a.stock||"—"],["KSA IATA",a.ksa||"—"],["Alliance",(a.alliance&&a.alliance!=="—")?a.alliance:"Unaligned"],["NDC active",nA+"/"+NDC_PROVIDERS.length],["ADM risk",a.admRisk||"—"],["On-time",a.otp||"—"]];
  v.innerHTML=`<button class="btn ghost sm" onclick="closeSup()">← Back to airlines</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(a.id)};font-size:17px">${esc(a.code||initials(a.name))}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(a.name)}</div><div class="tags" style="margin-top:8px"><span class="tag seg">${esc(a.type||'')}</span><span class="tag partner">${esc(a.country||'')}</span>${ndcBadge(a)}</div></div>
    <div style="display:flex;gap:6px"><button class="btn sm" onclick="setSupView('detail')">📄 Detail view</button><button class="btn sm" onclick="editSupplier('air','${a.id}')">Edit</button></div></div>
  <div class="chips" style="margin-bottom:16px">${tiles.map(t=>`<div class="chip"><div class="v">${esc(t[1])}</div><div class="l">${t[0]}</div></div>`).join("")}</div>
  <div class="card"><h3>NDC activation — by source</h3><div class="ch-sub">Single source of truth — editing any cell here also updates the front list and the detailed page.</div>${ndcMatrixHTML(a)}</div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Ticketing rules</h3><div class="fact"><span class="k">Void window</span><span class="v">${esc(a.voidRule||'Same-day, before cut-off')}</span></div><div class="fact"><span class="k">Reissue (voluntary)</span><span class="v">${esc(a.reissueRule||'Fare diff + penalty')}</span></div><div class="fact"><span class="k">Refund (voluntary)</span><span class="v">${esc(a.refundRule||'Per fare rules; penalty')}</span></div>${a.type==='LCC'?`<div class="fact"><span class="k">LCC refund to</span><span class="v">${esc(a.lccRefundTo||'Airline wallet / credit shell')}</span></div>`:''}</div>
    <div class="card"><h3>Sourcing</h3><div class="fact"><span class="k">GDS</span><span class="v">${esc(a.gds||'—')}</span></div><div class="fact"><span class="k">Content providers</span><span class="v">${esc(a.providers||'—')}</span></div><div class="fact"><span class="k">Availability source</span><span class="v">${esc(a.source||'—')}</span></div><div class="fact"><span class="k">Payment</span><span class="v">${esc(a.payment||(a.type==='LCC'?'card / tfPay':'BSP'))}</span></div></div>
    ${airNetworkCard(a)}
    <div class="card"><h3>Booked volume (reflected)</h3><div class="ch-sub">Auto-aggregated from bookings &amp; tickets — add a booking on this carrier and it lands here.</div>${(()=>{const st=airlineStats(a);return `<div class="chips"><div class="chip"><div class="v">${st.nBk}</div><div class="l">Bookings</div></div><div class="chip"><div class="v">${st.nTk}</div><div class="l">Tickets</div></div><div class="chip"><div class="v">${moneyShort(st.fare)}</div><div class="l">Fare value SAR</div></div></div>${st.routes.length?`<div style="font-size:12px;color:var(--muted);margin-top:8px">Top routes</div>${st.routes.map(r=>`<div class="fact"><span class="k">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')}`:''}${st.provs.length?`<div style="font-size:12px;color:var(--muted);margin-top:6px">Booked via</div>${st.provs.map(r=>`<div class="fact"><span class="k">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')}`:''}${st.clients.length?`<div style="font-size:12px;color:var(--muted);margin-top:6px">Top clients flying</div>${st.clients.map(r=>`<div class="fact"><span class="k">${esc(r[0])}</span><span class="v">${r[1]}</span></div>`).join('')}`:''}${st.bks.length?`<div class="related" style="margin-top:8px">${st.bks.slice(0,6).map(b=>`<a onclick="openBooking='${b.id}';current='bookings';render()">🧳 ${esc(b.ref)}</a>`).join('')}</div>`:'<div class="empty" style="margin-top:8px">No bookings yet for this carrier.</div>'}`;})()}</div>
  </div><div>
    <div class="card"><h3>Contacts</h3>${(a.contacts||[]).length?a.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||'?')}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||'—')}${c.role?' · <span style="color:var(--muted);font-weight:400">'+esc(c.role)+'</span>':''}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?esc(c.email):''}${c.email&&c.phone?' · ':''}${c.phone?esc(c.phone):''}</div></div></div>`).join(""):'<div class="empty">No contacts yet — add via Edit.</div>'}</div>
    ${a.portal?`<div class="card"><h3>Portal</h3><div style="margin-top:4px">${supLink(a.portal,'Agent portal')}</div></div>`:''}
    ${a.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.6">${esc(a.notes)}</p></div>`:''}
  </div></div>`;
}
function supplierDetail(v,kind,id){
  const isAir=kind==="air";const x=supArr(kind).find(s=>s.id===id);if(!x){openSup=null;return renderSuppliers(v,kind);}
  if(!isAir){
  v.innerHTML=`<button class="btn ghost sm" onclick="closeSup()">← Back</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(x.id)};font-size:20px">${initials(x.name)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(x.name)}</div><div class="tags" style="margin-top:8px"><span class="tag seg">${esc(x.type||'')}</span>${x.source?`<span class="tag partner">${esc(x.source)}</span>`:''}</div></div>
    <div style="display:flex;gap:6px;align-items:flex-start"><button class="btn sm" onclick="setSupView('dash')">📊 Dashboard view</button><button class="btn sm" onclick="editSupplier('${kind}','${x.id}')">Edit</button></div></div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Availability &amp; sourcing</h3>
      <div class="fact"><span class="k">Where we get availability</span><span class="v">${esc(x.source||'—')}</span></div>
      <div class="fact"><span class="k">Payment</span><span class="v">${esc(x.payment||'—')}</span></div>
      ${x.terms?`<div class="fact"><span class="k">Terms</span><span class="v">${esc(x.terms)}</span></div>`:''}
      ${x.sla?`<div class="fact"><span class="k">SLA</span><span class="v">${esc(x.sla)}</span></div>`:''}
    </div>
    <div class="card"><h3>Process</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.65;white-space:pre-line">${esc(x.process||'—')}</p></div>
    <div class="card"><h3>ADM / compliance</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.65;white-space:pre-line">${esc(x.adm||'—')}</p></div>
  </div><div>
    ${provCommercialCard(x)}
    <div class="card"><h3>Portals &amp; logins</h3>
      <div class="fact"><span class="k">Booking / agent portal</span><span class="v">${supLink(x.portal,'Open')}</span></div>
      <div class="fact"><span class="k">ADM / admin portal</span><span class="v">${supLink(x.adminPortal,'Open')}</span></div>
      <div class="fact"><span class="k">Account / username</span><span class="v">${esc(x.login||'—')}</span></div>
      <div style="margin-top:10px;font-size:11px;color:var(--muted)">🔒 Passwords stay in your password manager — never stored in this app.</div>
    </div>
    <div class="card"><h3>Points of contact</h3>${(x.contacts||[]).length?x.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||"?")}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||'—')}${c.role?` · <span style="color:var(--muted);font-weight:500">${esc(c.role)}</span>`:''}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.email&&c.phone?' · ':''}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> <a href="https://wa.me/${String(c.phone).replace(/[^0-9]/g,"").replace(/^0/,"966")}" target="_blank" rel="noopener" style="color:#16B364;font-weight:800" title="WhatsApp">WA</a>`:''}</div></div></div>`).join(""):'<div class="empty">No contacts yet.</div>'}</div>
    ${x.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054">${esc(x.notes)}</p></div>`:''}
  </div></div>`;
  return;}
  const sum='style="cursor:pointer;font-weight:800;font-size:13.5px;list-style-position:inside"';
  v.innerHTML=`<button class="btn ghost sm" onclick="closeSup()">← Back</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(x.id)};font-size:17px">${esc(x.code||initials(x.name))}</div>
    <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(x.name)}</div><div class="tags" style="margin-top:8px"><span class="tag seg">${esc(x.type||'')}</span><span class="tag partner">${esc(x.country||'—')}</span>${(x.ticketingAuthority||'').indexOf('Authorized')===0?'<span class="tag" style="background:#16B36418;color:#16B364">BSP authorized</span>':'<span class="tag" style="background:#F7900918;color:#B54708">No authority — target</span>'}${ndcBadge(x)}</div></div>
    <div style="display:flex;gap:6px;align-items:flex-start"><button class="btn sm" onclick="setSupView('dash')">📊 Dashboard view</button><button class="btn sm" onclick="editSupplier('${kind}','${x.id}')">Edit</button></div></div>
  <details class="card" open><summary ${sum}>Overview &amp; sourcing</summary>
      <div class="fact" style="margin-top:8px"><span class="k">IATA / ICAO</span><span class="v">${esc(x.code||'—')} / ${esc(x.icao||'—')}</span></div>
      <div class="fact"><span class="k">Ticket stock</span><span class="v" style="font-weight:800;font-variant-numeric:tabular-nums">${esc(x.stock||'—')}</span></div>
      <div class="fact"><span class="k">On KSA IATA (BSP Saudi)</span><span class="v">${x.ksa==='Yes'?'<span class="tag" style="background:#16B36418;color:#16B364">Yes</span>':x.ksa==='No'?'<span class="tag" style="background:#9AA1B618;color:#82868B">No</span>':'—'}</span></div>
      <div class="fact"><span class="k">Country · Type</span><span class="v">${esc(x.country||'—')} · ${esc(x.type||'')}</span></div>
      <div class="fact"><span class="k">GDS</span><span class="v">${esc(x.gds||'—')}</span></div>
      <div class="fact"><span class="k">Content providers</span><span class="v">${esc(x.providers||'—')}</span></div>
      <div class="fact"><span class="k">Manual provider</span><span class="v">${esc(x.manual||'—')}</span></div>
      <div class="fact"><span class="k">Frontend (OTA)</span><span class="v">${esc(x.frontend||'—')}</span></div>
      <div class="fact"><span class="k">Deeplinks</span><span class="v">${esc(x.deeplinks||'—')}</span></div>
      <div class="fact"><span class="k">Payment</span><span class="v">${esc(x.payment||(x.type==='LCC'?'card / tfPay':'BSP'))}</span></div>
      ${x.terms?`<div class="fact"><span class="k">Terms</span><span class="v">${esc(x.terms)}</span></div>`:''}
      ${x.sla?`<div class="fact"><span class="k">SLA</span><span class="v">${esc(x.sla)}</span></div>`:''}
      <h3 style="margin-top:14px">Process</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.65;white-space:pre-line">${esc(x.process||(x.type==='LCC'?'Direct / aggregator → instant issuance; changes per fare brand.':'GDS book → read fare rules → BSP ticket ≥24h before TTL → reissue/refund per rules (EMD for penalties).'))}</p>
      <h3 style="margin-top:14px">ADM / compliance</h3><p style="margin:0;font-size:13px;color:#3a4054;line-height:1.65;white-space:pre-line">${esc(x.adm||(x.type==='LCC'?'LCC — fare-brand rules; minimal BSP ADM.':'BSP ADMs — watch fare/tax recalc, churning, duplicate/passive segments, no-show. Clear dead segments; ticket same-day bookings.'))}</p>
  </details>
  <details class="card"><summary ${sum}>Ticketing &amp; fare rules</summary>
      <div class="fact" style="margin-top:8px"><span class="k">Ticketing authority</span><span class="v">${esc(x.ticketingAuthority||'—')}</span></div>
      <div class="fact"><span class="k">Void window</span><span class="v">${esc(x.voidRule||'Same-day, before BSP/airline cut-off')}</span></div>
      <div class="fact"><span class="k">Reissue (voluntary)</span><span class="v">${esc(x.reissueRule||'Fare difference + penalty per fare rules')}</span></div>
      <div class="fact"><span class="k">Refund (voluntary)</span><span class="v">${esc(x.refundRule||'Per fare rules; penalty applies')}</span></div>
      ${x.type==='LCC'?`<div class="fact"><span class="k">LCC refund to</span><span class="v">${esc(x.lccRefundTo||'Airline wallet / credit shell (not original method)')}</span></div>`:''}
      ${x.noShow?`<div class="fact"><span class="k">No-show</span><span class="v">${esc(x.noShow)}</span></div>`:''}
      ${x.admRisk?`<div class="fact"><span class="k">ADM risk</span><span class="v">${admRiskTag(x)}</span></div>`:''}
      <div style="margin-top:8px;font-size:11px;color:var(--muted)">Verified from airline policy &amp; ops circulars — Jun 2026. Per-fare rules in Amadeus (cat 16/31/33) always win.</div>
  </details>
  <details class="card"><summary ${sum}>NDC &amp; content sources</summary>
      <div style="margin-top:8px">${ndcMatrixHTML(x)}</div>
      <h3 style="margin-top:14px">Portals &amp; logins</h3>
      <div class="fact"><span class="k">Booking / agent portal</span><span class="v">${supLink(x.portal,'Open')}</span></div>
      <div class="fact"><span class="k">ADM / admin portal</span><span class="v">${supLink(x.adminPortal,'Open')}</span></div>
      <div class="fact"><span class="k">Account / username</span><span class="v">${esc(x.login||'—')}</span></div>
      <div style="margin-top:10px;font-size:11px;color:var(--muted)">🔒 Passwords stay in your password manager — never stored in this app.</div>
  </details>
  <details class="card"><summary ${sum}>Network &amp; commercial profile</summary><div style="margin-top:8px">${airNetworkCard(x)}</div></details>
  <details class="card"><summary ${sum}>Contacts &amp; notes</summary>
      <div style="margin-top:8px">${(x.contacts||[]).length?x.contacts.map(c=>`<div class="contact-row"><div class="ci">${initials(c.name||"?")}</div><div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.name||'—')}${c.role?` · <span style="color:var(--muted);font-weight:500">${esc(c.role)}</span>`:''}</div><div style="font-size:11.5px;color:var(--muted)">${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.email&&c.phone?' · ':''}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> <a href="https://wa.me/${String(c.phone).replace(/[^0-9]/g,"").replace(/^0/,"966")}" target="_blank" rel="noopener" style="color:#16B364;font-weight:800" title="WhatsApp">WA</a>`:''}</div></div></div>`).join(""):'<div class="empty">No contacts yet — add via Edit.</div>'}</div>
      ${x.notes?`<h3 style="margin-top:12px">Notes</h3><p style="margin:0;font-size:13px;color:#3a4054">${esc(x.notes)}</p>`:''}
  </details>`;
}

function editSupplier(kind,id){
  const isAir=kind==="air";const arr=supArr(kind);const isNew=!id;
  const x=id?JSON.parse(JSON.stringify(arr.find(s=>s.id===id))):{id:uid(isAir?"air":"v"),name:"",code:"",type:isAir?"FSC":"Hotels",source:"",gds:"",portal:"",adminPortal:"",login:"",adm:"",process:"",payment:"",terms:"",sla:"",contacts:[],notes:""};
  openModal(isNew?(isAir?"New airline":"New provider"):esc(x.name),`
    <div class="grid2"><div class="field"><label>Name</label><input id="x_name" value="${esc(x.name)}"></div>${isAir?`<div class="field"><label>IATA code</label><input id="x_code" value="${esc(x.code||'')}"></div>`:`<div class="field"><label>Type</label><input id="x_type" value="${esc(x.type||'')}" placeholder="GDS / Hotels / eSIM / Payments"></div>`}</div>
    ${isAir?`<div class="grid2"><div class="field"><label>Type</label><select id="x_type"><option ${x.type==='FSC'?'selected':''}>FSC</option><option ${x.type==='LCC'?'selected':''}>LCC</option><option ${x.type==='Charter'?'selected':''}>Charter</option></select></div><div class="field"><label>GDS</label><input id="x_gds" value="${esc(x.gds||'')}" placeholder="Amadeus / Sabre / Galileo"></div></div>
    <div class="grid2"><div class="field"><label>Ticket stock (3-digit IATA code)</label><input id="x_stock" value="${esc(x.stock||'')}" placeholder="e.g. 065 (Saudia)"></div><div class="field"><label>On KSA IATA (BSP Saudi)?</label><select id="x_ksa"><option ${x.ksa==='Yes'?'selected':''}>Yes</option><option ${x.ksa==='No'?'selected':''}>No</option><option ${(!x.ksa||x.ksa==='—')?'selected':''}>—</option></select></div></div>
    <div class="field"><label>Country</label><input id="x_country" value="${esc(x.country||'')}"></div>
    <div class="grid2"><div class="field"><label>Alliance</label><select id="x_alliance">${ALLIANCES.map(s=>`<option ${(x.alliance||'—')===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Corporate deal / TMC tariff</label><select id="x_corp"><option ${x.corporateDeal==='Yes'?'selected':''}>Yes</option><option ${x.corporateDeal==='No'?'selected':''}>No</option></select></div></div>
    <div class="grid2"><div class="field"><label>Codeshare / interline partners</label><input id="x_cs" value="${esc(x.codeshare||'')}" placeholder="AF, KL, DL"></div><div class="field"><label>Hubs / focus cities</label><input id="x_hubs" value="${esc(x.hubs||'')}" placeholder="JED, RUH"></div></div>
    <div class="grid2"><div class="field"><label>Fleet (primary)</label><input id="x_fleet" value="${esc(x.fleet||'')}" placeholder="A320, B789"></div><div class="field"><label>Classes offered</label><input id="x_classes" value="${esc(x.classes||'')}" placeholder="Y / W / J / F"></div></div>
    <div class="grid2"><div class="field"><label>ADM risk profile</label><select id="x_admrisk">${ADM_RISK.map(s=>`<option ${(x.admRisk||'—')===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>On-time performance band</label><input id="x_otp" value="${esc(x.otp||'')}" placeholder="80-85%"></div></div>
    <div class="grid2"><div class="field"><label>SAF / sustainability</label><select id="x_saf"><option ${(x.saf||'—')==='—'?'selected':''}>—</option><option ${x.saf==='Yes'?'selected':''}>Yes</option><option ${x.saf==='No'?'selected':''}>No</option></select></div><div class="field"><label>Corporate self-service portal</label><input id="x_corpportal" value="${esc(x.corpPortal||'')}"></div></div>
    <div class="grid2"><div class="field"><label>NDC version supported</label><input id="x_ndcver" value="${esc(x.ndcVersion||'')}" placeholder="21.3"></div><div class="field"><label>NDC environment</label><select id="x_ndcenv"><option ${(x.ndcEnv||'—')==='—'?'selected':''}>—</option><option ${x.ndcEnv==='Sandbox'?'selected':''}>Sandbox</option><option ${x.ndcEnv==='Production'?'selected':''}>Production</option></select></div></div>`:''}
    ${!isAir?`<div class="grid2"><div class="field"><label>Content mix</label><input id="p_mix" value="${esc(x.contentMix||'')}" placeholder="60% NDC / 30% EDIFACT / 10% LCC"></div><div class="field"><label>Settlement model</label><select id="p_settle">${SETTLEMENTS.map(s=>`<option ${(x.settlement||'—')===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="field"><label>Commission / markup</label><input id="p_markup" value="${esc(x.markup||'')}"></div><div class="field"><label>Cost per booking</label><input id="p_cost" value="${esc(x.costPerBooking||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Uptime</label><input id="p_up" value="${esc(x.uptime||'')}" placeholder="99.9%"></div><div class="field"><label>Avg response time</label><input id="p_rt" value="${esc(x.respTime||'')}" placeholder="320ms"></div></div>
    <div class="grid2"><div class="field"><label>Support SLA</label><input id="p_sla" value="${esc(x.supportSLA||'')}" placeholder="P1 < 1h"></div><div class="field"><label>API status</label><select id="p_api">${PROV_API.map(s=>`<option ${(x.apiStatus||'—')===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="field"><label>Account manager</label><input id="p_am" value="${esc(x.accountManager||'')}"></div><div class="field"><label>Contract renewal</label><input id="p_renew" type="date" value="${esc(x.renewalDate||'')}"></div></div>
    <div class="field"><label>Use for (route-family recommendation)</label><input id="p_use" value="${esc(x.useFor||'')}" placeholder="Duffel → short-haul EU LCCs"></div>
    <div class="field"><label>Servicing capabilities</label><div style="display:flex;flex-wrap:wrap;gap:8px">${PROV_CAPS.map(c=>`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;background:#f6f3ee;padding:6px 10px;border-radius:8px;cursor:pointer"><input type="checkbox" class="p_cap" value="${c}" ${(x.caps&&x.caps[c])?'checked':''}>${c}</label>`).join('')}</div></div>
    <div class="field"><label>Incident / outage history</label><textarea id="p_inc" rows="2">${esc(x.incidents||'')}</textarea></div>`:''}
    <div class="field"><label>Availability source (where we book)</label><input id="x_source" value="${esc(x.source||'')}" placeholder="GDS / NDC / Direct portal / Aggregator (Travel Fusion)"></div>
    <div class="grid2"><div class="field"><label>Booking / agent portal link</label><input id="x_portal" value="${esc(x.portal||'')}"></div><div class="field"><label>ADM / admin portal link</label><input id="x_admp" value="${esc(x.adminPortal||'')}"></div></div>
    <div class="field"><label>Account / username (🔒 no passwords)</label><input id="x_login" value="${esc(x.login||'')}"></div>
    <div class="grid2"><div class="field"><label>Payment</label><input id="x_pay" value="${esc(x.payment||'')}" placeholder="BSP / card / credit / wallet"></div><div class="field"><label>Terms</label><input id="x_terms" value="${esc(x.terms||'')}"></div></div>
    <div class="field"><label>ADM / compliance notes</label><textarea id="x_adm" rows="2">${esc(x.adm||'')}</textarea></div>
    ${isAir?`<div class="grid2"><div class="field"><label>Void window</label><input id="x_void" value="${esc(x.voidRule||'')}" placeholder="Same-day before cut-off"></div><div class="field"><label>Reissue (voluntary)</label><input id="x_reissue" value="${esc(x.reissueRule||'')}" placeholder="Fare diff + penalty"></div></div>
    <div class="grid2"><div class="field"><label>Refund (voluntary)</label><input id="x_refund" value="${esc(x.refundRule||'')}" placeholder="Per fare rules; penalty"></div><div class="field"><label>LCC refund to</label><input id="x_lccref" value="${esc(x.lccRefundTo||'')}" placeholder="Original method / airline wallet"></div></div>`:''}
    <div class="field"><label>Process (booking / ticketing / issuance)</label><textarea id="x_process" rows="3">${esc(x.process||'')}</textarea></div>
    <div class="field"><label>Points of contact</label><div id="supc"></div><button class="btn sm" onclick="addSupC()">+ Add contact</button></div>
    <div class="field"><label>Notes</label><textarea id="x_notes" rows="2">${esc(x.notes||'')}</textarea></div>
  `,()=>{x.name=val("x_name");if(isAir){x.code=val("x_code");x.gds=val("x_gds");x.stock=val("x_stock");x.ksa=val("x_ksa");x.country=val("x_country");x.voidRule=val("x_void");x.reissueRule=val("x_reissue");x.refundRule=val("x_refund");x.lccRefundTo=val("x_lccref");x.alliance=val("x_alliance");x.corporateDeal=val("x_corp");x.codeshare=val("x_cs");x.hubs=val("x_hubs");x.fleet=val("x_fleet");x.classes=val("x_classes");x.admRisk=val("x_admrisk");x.otp=val("x_otp");x.saf=val("x_saf");x.corpPortal=val("x_corpportal");x.ndcVersion=val("x_ndcver");x.ndcEnv=val("x_ndcenv");}if(!isAir){x.contentMix=val("p_mix");x.settlement=val("p_settle");x.markup=val("p_markup");x.costPerBooking=val("p_cost");x.uptime=val("p_up");x.respTime=val("p_rt");x.supportSLA=val("p_sla");x.apiStatus=val("p_api");x.accountManager=val("p_am");x.renewalDate=val("p_renew");x.useFor=val("p_use");x.incidents=val("p_inc");x.caps={};[...document.querySelectorAll(".p_cap:checked")].forEach(e=>x.caps[e.value]=true);}x.type=val("x_type");x.source=val("x_source");x.portal=val("x_portal");x.adminPortal=val("x_admp");x.login=val("x_login");x.payment=val("x_pay");x.terms=val("x_terms");x.adm=val("x_adm");x.process=val("x_process");x.notes=val("x_notes");x.contacts=readSupC();if(!x.name.trim()){alert("Name required");return false;}const i=arr.findIndex(s=>s.id===x.id);if(i>=0)arr[i]=x;else arr.push(x);save();render();},isNew?null:()=>{if(confirm("Delete this record?")){const i=arr.findIndex(s=>s.id===id);arr.splice(i,1);openSup=null;save();render();}});
  window._supc=(x.contacts||[]).slice();drawSupC();
}
function drawSupC(){const c=document.getElementById("supc");if(!c)return;c.innerHTML=(window._supc||[]).map((ct,i)=>`<div class="contact" style="grid-template-columns:1fr 1fr 1.2fr 1fr auto"><input placeholder="Name" value="${esc(ct.name||'')}" oninput="window._supc[${i}].name=this.value"><input placeholder="Role" value="${esc(ct.role||'')}" oninput="window._supc[${i}].role=this.value"><input placeholder="Email" value="${esc(ct.email||'')}" oninput="window._supc[${i}].email=this.value"><input placeholder="Phone" value="${esc(ct.phone||'')}" oninput="window._supc[${i}].phone=this.value"><span class="x" onclick="window._supc.splice(${i},1);drawSupC()">✕</span></div>`).join("");}
function addSupC(){window._supc=window._supc||[];window._supc.push({name:"",role:"",email:"",phone:""});drawSupC();}
function readSupC(){return (window._supc||[]).filter(c=>(c.name||c.email||c.phone));}

/* ----- SOPs ----- */
window.sopslaTab=window.sopslaTab||'sops';
window.setSopslaTab=function(id){window.sopslaTab=id;render();};
window.gotoProjects=function(){current='projects';render();window.scrollTo(0,0);};
function renderSopSla(v){
 if(window.sopslaTab==='slas'){renderSlas(v);}else{renderSops(v);}
 const mk=(id,lb)=>'<button class="btn '+(window.sopslaTab===id?'':'ghost ')+'sm" onclick="setSopslaTab(\''+id+'\')">'+lb+'</button>';
 v.insertAdjacentHTML('afterbegin','<div style="display:flex;gap:8px;margin-bottom:14px">'+mk('sops','SOP Library')+mk('slas','Service Levels')+'</div>');
}
function renderSops(v){
  const _arSp=(typeof LANG!=='undefined'&&LANG==='ar');
  v.innerHTML=`
  <div class="toolbar"><div class="search-wrap">${IC.search}<input id="sq" placeholder="${_arSp?'ابحث في إجراءات العمل…':'Search SOPs…'}" oninput="filterSops(this.value)"></div><button class="btn pri" onclick="editSop()">+ New SOP</button></div>
  <h3 style="margin:6px 2px 12px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Desk procedures (Saudi base · elevated)</h3>
  <div id="sopBase">${DB.sops.map(s=>sopHtml(s,false)).join("")}</div>
  <h3 style="margin:24px 2px 12px;font-size:13px;color:var(--violet);text-transform:uppercase;letter-spacing:.06em">★ Whale-grade additions (the market gap)</h3>
  <div id="sopWhale">${DB.sopsWhale.map(s=>sopHtml(s,true)).join("")}</div>`;
}
function sopHtml(s,whale){return `<details class="sop" data-t="${esc((s.title+' '+(s.purpose||'')+' '+(s.body||'')).toLowerCase())}"><summary><span class="lft"><span class="code ${whale?'whale':''}">${esc(s.code)}</span><span class="ti">${esc(s.title)}</span></span><button class="btn sm ghost" onclick="event.preventDefault();editSop('${s.id}',${whale})">Edit</button></summary>
  <div class="body"><p style="margin-top:14px"><b>Purpose.</b> ${esc(s.purpose||"")}</p>${s.cmd?`<pre>${esc(s.cmd)}</pre>`:""}${s.body?`<p>${esc(s.body)}</p>`:""}
  <div class="vs"><div class="box mkt"><div class="h">Saudi market standard</div><p>${esc(s.market||"—")}</p></div><div class="box edge"><div class="h">${IC.star} Direct Business edge</div><p>${esc(s.edge||"—")}</p></div></div></div></details>`;}
function filterSops(q){q=(q||"").toLowerCase().trim();document.querySelectorAll('#sopBase details,#sopWhale details').forEach(d=>{d.style.display=!q||d.getAttribute('data-t').includes(q)?"":"none";});}
function editSop(id,whale){const arr=whale?DB.sopsWhale:DB.sops;const isNew=!id;const s=id?JSON.parse(JSON.stringify(arr.find(x=>x.id===id))):{id:uid("s"),code:"SOP",title:"",purpose:"",cmd:"",body:"",market:"",edge:""};
  openModal(isNew?"New SOP":esc(s.title),`<div class="grid2"><div class="field"><label>Code</label><input id="s_code" value="${esc(s.code)}"></div><div class="field"><label>Title</label><input id="s_title" value="${esc(s.title)}"></div></div><div class="field"><label>Purpose</label><input id="s_purpose" value="${esc(s.purpose||"")}"></div><div class="field"><label>Commands (optional)</label><textarea id="s_cmd" rows="2">${esc(s.cmd||"")}</textarea></div><div class="field"><label>Procedure</label><textarea id="s_body" rows="3">${esc(s.body||"")}</textarea></div><div class="field"><label>Saudi market standard</label><textarea id="s_market" rows="2">${esc(s.market||"")}</textarea></div><div class="field"><label>Direct Business edge</label><textarea id="s_edge" rows="2">${esc(s.edge||"")}</textarea></div>`,
  ()=>{s.code=val("s_code");s.title=val("s_title");s.purpose=val("s_purpose");s.cmd=val("s_cmd");s.body=val("s_body");s.market=val("s_market");s.edge=val("s_edge");if(!s.title.trim()){alert("Title required");return false;}const i=arr.findIndex(x=>x.id===s.id);if(i>=0)arr[i]=s;else arr.push(s);save();render();},isNew?null:()=>{if(confirm("Delete SOP?")){const i=arr.findIndex(x=>x.id===id);arr.splice(i,1);save();render();}});
}

/* ----- SLAs ----- */
function renderSlas(v){
  const beat=DB.slas.filter(s=>s.rank==="beat").length;
  v.innerHTML=`
  <div class="legend-bar"><span><span class="bench beat">★ Beats market</span></span><span><span class="bench meet">✓ Meets best practice</span></span></div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th style="width:24%">Event</th><th style="width:24%;color:var(--orange)">Direct Business</th><th style="width:22%">Saudi market</th><th style="width:22%">Industry whales</th><th></th></tr></thead><tbody>
  ${DB.slas.map(s=>`<tr>
    <td><div style="display:flex;align-items:center;gap:8px"><span class="bench ${s.rank}">${s.rank==='beat'?'★':'✓'}</span><input class="cell" style="font-weight:600" value="${esc(s.event)}" onchange="setSla('${s.id}','event',this.value)"></div></td>
    <td><textarea class="cell" rows="2" style="font-weight:600;color:#C2691A" onchange="setSla('${s.id}','direct',this.value)">${esc(s.direct)}</textarea></td>
    <td><textarea class="cell" rows="2" style="color:var(--muted)" onchange="setSla('${s.id}','market',this.value)">${esc(s.market)}</textarea></td>
    <td><textarea class="cell" rows="2" style="color:var(--muted)" onchange="setSla('${s.id}','whale',this.value)">${esc(s.whale)}</textarea></td>
    <td style="text-align:right"><span class="x" onclick="if(confirm('Delete SLA?')){DB.slas=DB.slas.filter(x=>x.id!=='${s.id}');save();render();}">✕</span></td></tr>`).join("")}
  </tbody></table></div></div>
  <button class="btn sm" onclick="DB.slas.push({id:uid('sla'),event:'New event',direct:'',market:'',whale:'',rank:'meet'});save();render();">+ Add SLA</button>`;
}
function setSla(id,k,val){const s=DB.slas.find(x=>x.id===id);if(s){s[k]=val;save();}}

/* ----- Operations (live) ----- */
function slaDue(r){return (r.createdAt||Date.now())+2*3600e3;}
function slaOverdue(r){return r.stage!=="Closed"&&r.stage!=="Delivered"&&Date.now()>slaDue(r);}
function renderOps(v){
  const R=DB.requests||[];const open=R.filter(r=>r.stage!=="Closed");const over=open.filter(slaOverdue).length;
  const sumSell=R.reduce((s,r)=>s+(+r.sell||0),0);
  /* 2026-09-02 (round 31): sumMargin was Σ(sell − cost) over EVERY request, and `+r.cost||0`
     read a request whose cost nobody has recorded as a cost of ZERO — so its entire sale was
     reported as booked margin, and the percentage beside it was computed on that. That is the
     same rule the proposal editor broke (round 29): cost is approved expenses only; a gap is
     left as a gap and named, never filled with a number that looks researched.
     Only requests that actually record a cost count; the percentage is taken against those
     same requests' sales, not against the whole pipeline (mixing the two would understate it);
     and the requests left out are counted on the tile so nothing is quietly dropped. */
  const _opsHasCost=r=>r&&r.cost!=null&&String(r.cost).trim()!=='';
  const _opsCosted=R.filter(_opsHasCost);
  const opsNoCost=R.filter(r=>!_opsHasCost(r)&&(+r.sell||0)>0);
  const sumMargin=_opsCosted.reduce((s,r)=>s+((+r.sell||0)-(+r.cost||0)),0);
  const costedSell=_opsCosted.reduce((s,r)=>s+(+r.sell||0),0);
  const mPct=costedSell?Math.round(sumMargin/costedSell*100):0;
  const _arOps=(typeof LANG!=='undefined'&&LANG==='ar');
  const marginNote=_opsCosted.length
    ? ((_arOps?'الهامش ':'margin ')+'<span dir="ltr">'+mPct+'%</span>'+(opsNoCost.length?('<br>'+(_arOps?(opsNoCost.length+' بدون تكلفة مسجّلة — غير محتسبة'):(opsNoCost.length+' with no cost recorded — not counted'))):''))
    : (_arOps?'لا توجد تكلفة مسجّلة على أي طلب':'no request has a cost recorded');
  const marginValue=_opsCosted.length?(moneyShort(sumMargin)+' SAR'):'—';
  /* 2026-09-02 (attack round 10): "10k SAR · 15%" wrapped mid-value inside the tile on desktop and
     phone alike — the percentage is now its own small line under the amount. */
  const kp=[["Open requests",open.length,"var(--blue)"],["SLA overdue",over,"var(--red)"],["Awaiting client",R.filter(r=>r.stage==="Awaiting client").length,"var(--amber)"],["Pipeline value",moneyShort(sumSell)+" SAR","var(--violet)"],["Booked margin",marginValue+'<div style="font-size:12px;font-weight:600;color:var(--muted);margin-top:2px">'+marginNote+'</div>',"var(--green)"],["Delivered / closed",R.filter(r=>r.stage==="Delivered"||r.stage==="Closed").length,"var(--ink-3)"]];
  v.innerHTML=`
  <div class="toolbar"><div class="search-wrap">${IC.search}<input id="rq" placeholder="${_arOps?'ابحث في الطلبات…':'Search requests…'}" oninput="drawReqBoard(this.value)"></div><div style="flex:1"></div><button class="btn pri" onclick="editRequest()">+ New request</button></div>
  <div class="kpis" style="margin-bottom:18px">${kp.map(([l,vv,c])=>`<div class="kpi"><div class="l">${l}</div><div class="v" style="color:${c}">${vv}</div></div>`).join("")}</div>
  <div id="reqboard"></div>`;
  drawReqBoard("");
}
function drawReqBoard(q){q=(q||"").toLowerCase();const board=document.getElementById("reqboard");if(!board)return;board.className="board";
  board.innerHTML=STAGES.map(stage=>{const items=(DB.requests||[]).filter(r=>r.stage===stage&&(!q||(r.client+" "+r.service+" "+r.detail+" "+(r.owner||"")).toLowerCase().includes(q)));
    return `<div class="col" ondragover="allowDrop(event,this)" ondragleave="leaveDrop(this)" ondrop="dropOn(event,'req','${stage}',this)"><div class="ch"><span class="t"><span class="pip" style="background:${STAGE_COLOR[stage]}"></span>${stage}</span><span class="n">${items.length}</span></div>${items.map(reqCard).join("")||'<div class="empty">—</div>'}</div>`;}).join("");
}
function reqCard(r){const over=slaOverdue(r);const early=(r.stage==="New"||r.stage==="Quoting");
  /* 2026-09-02 (attack round 10 — the first time this board was driven WITH records in Arabic):
     the card's own words were English under Arabic ("Advance → Booked", "SLA overdue", "resp by",
     "Unassigned", priority), and "800 SAR · △150" scrambled to "SAR · △150 800" in the
     right-to-left line. Stage words come from js/21's own map; the amount is an isolated
     left-to-right span; the service chip uses the catalogue label like the editor does. */
  const ar=(typeof LANG!=='undefined'&&LANG==='ar');
  const stAr=(s)=>{try{return (ar&&window.__OPS_STAGE_AR&&window.__OPS_STAGE_AR[s])||s;}catch(_){return s;}};
  const next=STAGES[STAGES.indexOf(r.stage)+1]||'';
  const due=over?(ar?'⚠ تأخّر مستوى الخدمة':'⚠ SLA overdue'):(early?(ar?'الرد قبل ':'resp by ')+fmtTime(slaDue(r)):'');
  const prioAr={Urgent:'عاجل',High:'مرتفع',Normal:'عادي',Low:'منخفض'};
  return `<div class="reqcard" draggable="true" ondragstart="dragStart(event,'req','${r.id}')" onclick="editRequest('${r.id}')"><div class="rc-top"><span class="svc">${esc(typeof svcLabel==='function'?svcLabel(r.service):r.service)}</span><span class="due ${over?'over':'ok'}">${due}</span></div>
  <div style="font-weight:700;margin-top:8px;font-size:13.5px">${esc(r.client)}</div>
  <div style="font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4">${esc(r.detail||"")}</div>
  <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted)"><span>${esc(r.owner||(ar?'غير مُسند':'Unassigned'))}${r.pnr?" · "+esc(r.pnr):""}</span>${r.sell?`<span style="font-weight:700;direction:ltr;unicode-bidi:isolate">${moneyShort(r.sell)} SAR${r.cost?` · <span style="color:var(--green)">△${moneyShort(r.sell-r.cost)}</span>`:""}</span>`:`<span style="font-weight:700;color:${r.priority==='Urgent'?'var(--red)':r.priority==='High'?'var(--amber)':'var(--muted)'}">${esc(ar?(prioAr[r.priority]||r.priority||''):(r.priority||""))}</span>`}</div>${r.stage!=="Closed"?('<button class="btn sm" style="width:100%;margin-top:9px;justify-content:center;padding:6px" onclick="advanceReq(\''+r.id+'\',event)">'+(ar?('التالي &#8592; '+esc(stAr(next))):('Advance &#8594; '+esc(next)+' &#9656;'))+'</button>'):''}</div>`;}
function editRequest(id){
  const isNew=!id;const r=id?JSON.parse(JSON.stringify((DB.requests||[]).find(x=>x.id===id))):{id:uid("r"),client:"",service:"Flights",detail:"",stage:"New",owner:"",priority:"Normal",createdAt:Date.now(),supplier:"",pnr:"",sell:0,notes:""};
  openModal(isNew?"New request":"Request — "+esc(r.client),`
    <div class="field"><label>Client / business</label><input id="r_client" list="bizlist" value="${esc(r.client)}" placeholder="Type or pick a business"><datalist id="bizlist">${DB.businesses.map(b=>`<option value="${esc(b.name)}">`).join("")}</datalist></div>
    <div class="grid2"><div class="field"><label>Service</label><select id="r_service">${(window.SVC_CATALOG?SVC_CATALOG.map(p=>p[0]).filter(s=>!["Visas","Transport","Tours","Events","Wallet top-up","Mixed","(unspecified)"].includes(s)):["Flights","Hotels","Transfer / Chauffeur","Visa","eSIM","Package","Group / MICE","Other"]).concat(r.service&&!(window.SVC_CATALOG||[]).some(p=>p[0]===r.service)?[r.service]:[]).map(s=>`<option value="${esc(s)}" ${r.service===s?"selected":""}>${esc(typeof svcLabel==='function'?svcLabel(s):s)}</option>`).join("")}</select></div><div class="field"><label>Stage</label><select id="r_stage">${STAGES.map(s=>`<option ${r.stage===s?"selected":""}>${s}</option>`).join("")}</select></div></div>
    <div class="field"><label>Request detail</label><textarea id="r_detail" rows="2">${esc(r.detail||"")}</textarea></div>
    <div class="grid2"><div class="field"><label>Owner</label><input id="r_owner" value="${esc(r.owner||"")}"></div><div class="field"><label>Priority</label><select id="r_priority">${["Urgent","High","Normal","Low"].map(p=>`<option ${r.priority===p?"selected":""}>${p}</option>`).join("")}</select></div></div>
    <div class="grid2"><div class="field"><label>Supplier / GDS</label><input id="r_supplier" list="vendlist" value="${esc(r.supplier||"")}"><datalist id="vendlist">${DB.vendors.map(x=>`<option value="${esc(x.name)}">`).join("")}</datalist></div><div class="field"><label>PNR / Ref / HCN</label><input id="r_pnr" value="${esc(r.pnr||"")}"></div></div>
    <div class="grid2"><div class="field"><label>Sell value (SAR)</label><input id="r_sell" type="number" value="${r.sell||0}"></div><div class="field"><label>Cost (SAR)</label><input id="r_cost" type="number" value="${r.cost||0}"></div></div>
    <div class="field"><label>Notes</label><input id="r_notes" value="${esc(r.notes||"")}"></div>
  `,()=>{r.client=val("r_client");r.service=val("r_service");r.stage=val("r_stage");r.detail=val("r_detail");r.owner=val("r_owner");r.priority=val("r_priority");r.supplier=val("r_supplier");r.pnr=val("r_pnr");r.sell=+val("r_sell")||0;r.cost=+val("r_cost")||0;r.notes=val("r_notes");if(!r.client.trim()){alert("Client required");return false;}DB.requests=DB.requests||[];const i=DB.requests.findIndex(x=>x.id===r.id);if(i>=0)DB.requests[i]=r;else DB.requests.push(r);save();render();},isNew?null:()=>{if(confirm("Delete request?")){DB.requests=DB.requests.filter(x=>x.id!==r.id);save();render();}});
}

