/* ================= ENTITY GRAPH (v17) — bookings · invoices · tickets · reflection ================= */
const BK_STATUS=["Confirmed","Pending","Ticketed","Delivered","Cancelled"];
const BK_STATUS_COLOR={Confirmed:"#2E90FA",Pending:"#F79009",Ticketed:"#7A5AF8",Delivered:"#16B364",Cancelled:"#F0453A"};
const INV_STATUS=["Draft","Issued","Paid","Overdue","Refunded"];
const INV_STATUS_COLOR={Draft:"#9AA1B6",Issued:"#2E90FA",Paid:"#16B364",Overdue:"#F0453A",Refunded:"#82868B"};
function topN(o,n){return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n||5);}
function bkAirlines(b){return [...new Set((b.tickets||[]).map(t=>t.airline).filter(Boolean))];}
function bookingsFor(id){return (DB.bookings||[]).filter(b=>b.leadId===id);}
function invoicesFor(id){return (DB.invoices||[]).filter(i=>i.clientId===id);}
function offersFor(id){return (DB.offers||[]).filter(o=>o.linkedLeadId===id);}
function ticketsFor(id){return bookingsFor(id).reduce((a,b)=>a.concat((b.tickets||[]).map(t=>Object.assign({bookingId:b.id,bref:b.ref},t))),[]);}
function allTickets(){return (DB.bookings||[]).reduce((a,b)=>a.concat((b.tickets||[]).map((t,ti)=>Object.assign({bookingId:b.id,bref:b.ref,ti,leadId:b.leadId,provider:b.provider,invoiceId:b.invoiceId,status:b.status},t))),[]);}
function leadName(id){const b=getLead(id);return b?b.name:'—';}
function airlineMatch(t,a){return !!(t.airline&&(t.airline===a.name||t.airline===a.code||(a.name&&t.airline.toLowerCase()===String(a.name).toLowerCase())));}

function bkMargin(b){return onum(b.totalSale)-onum(b.totalCost);}
function airlineStats(a){const bks=(DB.bookings||[]).filter(b=>(b.tickets||[]).some(t=>airlineMatch(t,a)));let nTk=0,fare=0;const routes={},provs={},clients={};bks.forEach(b=>{(b.tickets||[]).filter(t=>airlineMatch(t,a)).forEach(t=>{nTk++;fare+=onum(t.fare)+onum(t.taxes);if(t.route)routes[t.route]=(routes[t.route]||0)+1;});if(b.provider)provs[b.provider]=(provs[b.provider]||0)+1;const nm=leadName(b.leadId);clients[nm]=(clients[nm]||0)+1;});return {bks,nBk:bks.length,nTk,fare,routes:topN(routes),provs:topN(provs),clients:topN(clients)};}
function providerStats(name){const bks=(DB.bookings||[]).filter(b=>b.provider===name);let nTk=0;const air={},clients={};let val=0;bks.forEach(b=>{nTk+=(b.tickets||[]).length;val+=onum(b.totalSale);bkAirlines(b).forEach(al=>air[al]=(air[al]||0)+1);const nm=leadName(b.leadId);clients[nm]=(clients[nm]||0)+1;});return {bks,nBk:bks.length,nTk,val,nAir:Object.keys(air).length,topAir:topN(air),clients:topN(clients)};}
function leadBilled(id){return invoicesFor(id).filter(i=>['Issued','Paid','Overdue'].indexOf(i.status)>-1).reduce((s,i)=>s+onum(i.total),0);}
function leadBookValue(id){return bookingsFor(id).reduce((s,b)=>s+onum(b.totalSale),0);}
function relatedPanel(id){const offs=offersFor(id),bks=bookingsFor(id),invs=invoicesFor(id),tks=ticketsFor(id);
  return `<div class="card"><h3>Related records</h3><div class="ch-sub">Everything connected to this account — click to jump.</div>
  <div style="font-size:12px;color:var(--muted);margin-top:4px">Offers (${offs.length})</div><div class="related">${offs.map(o=>`<a onclick="openOffer='${o.id}';current='offers';render()">📄 ${esc(o.ref||o.subject||'Offer')}</a>`).join('')||'<span class="muted" style="font-size:12px">none</span>'}</div>
  <div style="font-size:12px;color:var(--muted);margin-top:8px">Bookings (${bks.length})</div><div class="related">${bks.map(b=>`<a onclick="openBooking='${b.id}';current='bookings';render()">🧳 ${esc(b.ref)} · ${bkAirlines(b).join(', ')||'—'}</a>`).join('')||'<span class="muted" style="font-size:12px">none</span>'}</div>
  <div style="font-size:12px;color:var(--muted);margin-top:8px">Invoices (${invs.length})</div><div class="related">${invs.map(i=>`<a onclick="openInvoice='${i.id}';current='invoices';render()">🧾 ${esc(i.number)} · ${money(i.total)}</a>`).join('')||'<span class="muted" style="font-size:12px">none</span>'}</div>
  <div style="font-size:12px;color:var(--muted);margin-top:8px">Tickets (${tks.length})</div><div class="related">${tks.map(t=>`<a onclick="openBooking='${t.bookingId}';current='bookings';render()">🎫 ${esc(t.pnr||t.eticket||'PNR')} · ${esc(t.airline||'')}</a>`).join('')||'<span class="muted" style="font-size:12px">none</span>'}</div></div>`;}
/* ----- drop zones + mock ingestion ----- */
function dropZone(kind){
  const _ar=(typeof LANG!=='undefined'&&LANG==='ar');
  const hintEn={invoice:'Invoice PDF',ticket:'Ticket / e-ticket PDF',offer:'Offer / quote PDF',booking:'Booking confirmation / ticket PDF'}[kind]||'file';
  const hintAr={invoice:'فاتورة PDF',ticket:'تذكرة PDF',offer:'عرض / عرض سعر PDF',booking:'تأكيد حجز / تذكرة PDF'}[kind]||'ملف';
  const kindAr={invoice:'الفاتورة',ticket:'التذكرة',offer:'العرض',booking:'الحجز'}[kind]||kind;
  const dropLabel=_ar?('أفلت ملفات '+kindAr+' — أو انقر للإضافة'):('Drop '+kind+' files — or click to add');
  const hint=(_ar?hintAr:hintEn)+(_ar?' · يمكن أكثر من ملف':' · multiple files OK');
  const linkPh=_ar?'الصق رابطًا، ثم Enter':'paste a link, Enter';
  return `<div class="dropzone" ondragover="dzOver(event,this)" ondragleave="dzLeave(this)" ondrop="dzDrop(event,'${kind}',this)" onclick="ingestModal('${kind}','',null)"><div class="dz-ic">📎</div><div style="flex:1;min-width:0"><b>${dropLabel}</b><div style="font-size:11.5px;color:var(--muted)">${hint}</div></div><input type="text" placeholder="${linkPh}" onkeydown="if(event.key==='Enter'){dzLink('${kind}',this.value);this.value=''}" onclick="event.stopPropagation()"></div>`;
}
function dzOver(e,el){e.preventDefault();el.classList.add('over');}
function dzLeave(el){el.classList.remove('over');}
function dzDrop(e,kind,el){e.preventDefault();el.classList.remove('over');const files=[...(e.dataTransfer.files||[])];if(files.length)ingestQueue(kind,files.map(f=>f.name));}
function dzLink(kind,url){if(url&&url.trim())ingestQueue(kind,[url.trim()]);}
function ingestQueue(kind,names){let i=0;const nxt=()=>{if(i>=names.length){render();return;}ingestModal(kind,names[i],()=>{i++;nxt();});};nxt();}
function guessNum(fn){const m=String(fn).match(/\d{3,}/);return m?m[0]:'';}
function ingestModal(kind,fname,cb){const note=fname?`<div class="note">Confirm the details for <b>${esc(fname)}</b> below (pre-filled from the file name where possible).</div>`:'';
  const clientOpts=DB.businesses.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const provOpts=(DB.vendors||[]).map(v=>`<option>${esc(v.name)}</option>`).join('');
  if(kind==='invoice'){openModal('Ingest invoice'+(fname?' — '+esc(fname):''),`${note}<div class="grid2"><div class="field"><label>Invoice #</label><input id="ig_num" value="INV-${guessNum(fname)||Date.now().toString().slice(-4)}"></div><div class="field"><label>Date</label><input id="ig_date" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div><div class="grid2"><div class="field"><label>Client</label><select id="ig_client">${clientOpts}</select></div><div class="field"><label>Status</label><select id="ig_status">${INV_STATUS.map(s=>`<option>${s}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>Total</label><input id="ig_total" type="number"></div><div class="field"><label>Currency</label><select id="ig_cur"><option>SAR</option><option>USD</option><option>EGP</option></select></div></div><div class="field"><label>Line item description</label><input id="ig_desc" placeholder="Air ticket / hotel / service"></div>`,()=>{const inv={id:uid('inv'),number:val('ig_num'),clientId:val('ig_client'),date:val('ig_date'),currency:val('ig_cur'),status:val('ig_status'),total:+val('ig_total')||0,items:[{desc:val('ig_desc'),amount:+val('ig_total')||0}],files:fname?[{name:fname,at:Date.now()}]:[],notes:''};(DB.invoices=DB.invoices||[]).push(inv);save();if(cb)cb();else render();});}
  else if(kind==='offer'){openModal('Ingest offer'+(fname?' — '+esc(fname):''),`${note}<div class="grid2"><div class="field"><label>Subject / passenger</label><input id="ig_subj"></div><div class="field"><label>Client</label><select id="ig_client"><option value="">—</option>${clientOpts}</select></div></div><div class="grid2"><div class="field"><label>Airline</label><input id="ig_air"></div><div class="field"><label>Total</label><input id="ig_total"></div></div>`,()=>{const cl=val('ig_client');const o={id:uid('o'),ref:'DB-'+Date.now().toString().slice(-6),date:new Date().toISOString().slice(0,10),client:cl?leadName(cl):'',subject:val('ig_subj'),airline:val('ig_air'),total:val('ig_total'),currency:'SAR',status:'Draft',version:1,linkedLeadId:cl,paxAdt:1,paxChd:0,paxInf:0,options:[],files:fname?[{name:fname,at:Date.now()}]:[]};(DB.offers=DB.offers||[]).push(o);save();if(cb)cb();else render();});}
  else{/* booking or ticket */openModal('Ingest '+kind+(fname?' — '+esc(fname):''),`${note}<div class="grid2"><div class="field"><label>Booking ref</label><input id="ig_ref" value="BK-${guessNum(fname)||Date.now().toString().slice(-4)}"></div><div class="field"><label>Client</label><select id="ig_client">${clientOpts}</select></div></div><div class="grid2"><div class="field"><label>Provider / GDS</label><select id="ig_prov"><option value="">—</option>${provOpts}</select></div><div class="field"><label>Status</label><select id="ig_status">${BK_STATUS.map(s=>`<option ${s==='Ticketed'?'selected':''}>${s}</option>`).join('')}</select></div></div><h3 style="margin-top:10px">Ticket</h3><div class="grid2"><div class="field"><label>Airline</label><input id="ig_air" placeholder="Saudia"></div><div class="field"><label>PNR</label><input id="ig_pnr"></div></div><div class="grid2"><div class="field"><label>E-ticket #</label><input id="ig_etk"></div><div class="field"><label>Passenger</label><input id="ig_pax"></div></div><div class="grid2"><div class="field"><label>Route</label><input id="ig_route" placeholder="RUH-LHR-RUH"></div><div class="field"><label>Class</label><input id="ig_cls" placeholder="Y / J"></div></div><div class="grid2"><div class="field"><label>Fare</label><input id="ig_fare" type="number"></div><div class="field"><label>Taxes</label><input id="ig_tax" type="number"></div></div><div class="grid2"><div class="field"><label>Total cost</label><input id="ig_cost" type="number"></div><div class="field"><label>Total sale</label><input id="ig_sale" type="number"></div></div>`,()=>{const tk={pnr:val('ig_pnr'),eticket:val('ig_etk'),pax:val('ig_pax'),route:val('ig_route'),cls:val('ig_cls'),fare:+val('ig_fare')||0,taxes:+val('ig_tax')||0,airline:val('ig_air')};const bk={id:uid('bk'),ref:val('ig_ref'),leadId:val('ig_client'),offerId:'',provider:val('ig_prov'),status:val('ig_status'),date:new Date().toISOString().slice(0,10),tickets:(tk.airline||tk.pnr)?[tk]:[],hotels:[],visas:[],transfers:[],extras:[],totalCost:+val('ig_cost')||0,totalSale:+val('ig_sale')||0,invoiceId:'',files:fname?[{name:fname,at:Date.now()}]:[],notes:''};(DB.bookings=DB.bookings||[]).push(bk);const b=getLead(bk.leadId);if(b){b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Booking',note:'Booking '+bk.ref+(tk.airline?(' — '+tk.airline):'')+(tk.route?(' '+tk.route):''),by:(typeof me==='function'?me():'')});b.lastContact=Date.now();}save();if(cb)cb();else render();});}
}
/* ----- Bookings ----- */
let openBooking=null;
function openBookingFn(id){openBooking=id;render();window.scrollTo(0,0);}
function closeBooking(){openBooking=null;render();}
function renderBookings(v){if(openBooking)return bookingDetail(v,openBooking);
  const B=DB.bookings||[];const sale=B.reduce((s,b)=>s+onum(b.totalSale),0);const margin=B.reduce((s,b)=>s+bkMargin(b),0);const tks=B.reduce((s,b)=>s+(b.tickets||[]).length,0);
  v.innerHTML=`
  ${dropZone('booking')}
  <div class="card" style="display:flex;flex-wrap:wrap;gap:18px;padding:14px 20px;margin-bottom:14px"><div><div class="kl">Bookings</div><div class="kv">${B.length}</div></div><div><div class="kl">Tickets</div><div class="kv">${tks}</div></div><div><div class="kl">Total sale</div><div class="kv">${moneyShort(sale)} SAR</div></div><div><div class="kl">Margin</div><div class="kv" style="color:#16B364">${moneyShort(margin)} SAR</div></div><div style="flex:1"></div><button class="btn pri" onclick="ingestModal('booking','',null)">+ New booking</button></div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th>Ref</th><th>Client</th><th>Airlines</th><th>Provider</th><th>Tickets</th><th>Sale</th><th>Margin</th><th>Status</th><th>Date</th></tr></thead><tbody>
  ${B.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(b=>`<tr style="cursor:pointer" onclick="openBookingFn('${b.id}')"><td><b>${esc(b.ref)}</b></td><td>${esc(leadName(b.leadId))}</td><td>${esc(bkAirlines(b).join(', ')||'—')}</td><td style="color:var(--muted)">${esc(b.provider||'—')}</td><td style="color:var(--muted)">${(b.tickets||[]).length}</td><td style="font-weight:700;white-space:nowrap">${moneyShort(b.totalSale)}</td><td style="color:#16B364;white-space:nowrap">${moneyShort(bkMargin(b))}</td><td><span class="tag" style="background:${(BK_STATUS_COLOR[b.status]||'#9AA1B6')}1a;color:${BK_STATUS_COLOR[b.status]||'#9AA1B6'}">${esc(b.status||'—')}</span></td><td style="color:var(--muted);white-space:nowrap">${esc(b.date||'')}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">No bookings yet — drop a confirmation or click “New booking”.</td></tr>'}
  </tbody></table></div></div>`;
}
function getBooking(id){return (DB.bookings||[]).find(b=>b.id===id);}
function bookingDetail(v,id){const b=getBooking(id);if(!b){openBooking=null;return renderBookings(v);}
  const inv=(DB.invoices||[]).find(i=>i.id===b.invoiceId);const off=(DB.offers||[]).find(o=>o.id===b.offerId);
  v.innerHTML=`<button class="btn ghost sm" onclick="closeBooking()">← Bookings</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(b.id)}">🧳</div><div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(b.ref)}</div><div class="tags" style="margin-top:8px"><span class="tag" style="background:${(BK_STATUS_COLOR[b.status]||'#9AA1B6')}1a;color:${BK_STATUS_COLOR[b.status]||'#9AA1B6'}">${esc(b.status||'—')}</span><span class="tag seg">${esc(bkAirlines(b).join(', ')||'—')}</span><span class="tag partner">${esc(b.provider||'—')}</span></div></div>
    <button class="btn sm" onclick="editBooking('${b.id}')">Edit</button></div>
  <div class="chips" style="margin-bottom:14px"><div class="chip"><div class="v">${moneyShort(b.totalSale)}</div><div class="l">Total sale SAR</div></div><div class="chip"><div class="v">${moneyShort(b.totalCost)}</div><div class="l">Total cost</div></div><div class="chip"><div class="v" style="color:#16B364">${moneyShort(bkMargin(b))}</div><div class="l">Margin</div></div><div class="chip"><div class="v">${(b.tickets||[]).length}</div><div class="l">Tickets</div></div></div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Tickets</h3>${(b.tickets||[]).length?`<div class="tbl-wrap"><table><thead><tr><th>Airline</th><th>PNR</th><th>E-ticket</th><th>Pax</th><th>Route</th><th>Cls</th><th>Fare</th></tr></thead><tbody>${b.tickets.map(t=>`<tr><td><b>${esc(t.airline||'—')}</b></td><td>${esc(t.pnr||'—')}</td><td style="color:var(--muted)">${esc(t.eticket||'—')}</td><td>${esc(t.pax||'—')}</td><td>${esc(t.route||'—')}</td><td>${esc(t.cls||'—')}</td><td style="white-space:nowrap">${moneyShort(onum(t.fare)+onum(t.taxes))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No tickets.</div>'}</div>
    ${(b.hotels||[]).length?`<div class="card"><h3>Hotels</h3>${b.hotels.map(h=>`<div class="fact"><span class="k">${esc(h.name||h.vendor||'Hotel')}</span><span class="v">${esc(h.nights||'')} nts · ${moneyShort(h.cost)}</span></div>`).join('')}</div>`:''}
    ${(b.visas||[]).length?`<div class="card"><h3>Visas</h3>${b.visas.map(h=>`<div class="fact"><span class="k">${esc(h.country||'Visa')} · ${esc(h.vendor||'')}</span><span class="v">${esc(h.pax||1)} pax · ${moneyShort(h.cost)}</span></div>`).join('')}</div>`:''}
    ${b.notes?`<div class="card"><h3>Notes</h3><p style="margin:0;font-size:13px;color:#3a4054">${esc(b.notes)}</p></div>`:''}
  </div><div>
    <div class="card"><h3>Related records</h3>
      <div class="related"><a onclick="openLead='${b.leadId}';current='leads';render()">👤 ${esc(leadName(b.leadId))}</a>${off?`<a onclick="openOffer='${off.id}';current='offers';render()">📄 ${esc(off.ref||'Offer')}</a>`:''}${inv?`<a onclick="openInvoice='${inv.id}';current='invoices';render()">🧾 ${esc(inv.number)}</a>`:`<a onclick="invoiceFromBooking('${b.id}')">🧾 + Generate invoice</a>`}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:10px">Airlines (reflected on their dashboards)</div><div class="related">${bkAirlines(b).map(al=>{const a=(DB.airlines||[]).find(x=>x.name===al||x.code===al);return a?`<a onclick="openSup='${a.id}';supKind='air';supView='dash';current='airlines';render()">✈ ${esc(al)}</a>`:`<span class="tag">${esc(al)}</span>`;}).join('')||'—'}</div>
      ${b.provider?`<div style="font-size:12px;color:var(--muted);margin-top:8px">Provider</div><div class="related">${(()=>{const p=(DB.vendors||[]).find(x=>x.name===b.provider);return p?`<a onclick="openSup='${p.id}';supKind='prov';supView='dash';current='vendors';render()">🔌 ${esc(b.provider)}</a>`:`<span class="tag">${esc(b.provider)}</span>`;})()}</div>`:''}
    </div>
    ${(b.files||[]).length?`<div class="card"><h3>Attached files</h3>${b.files.map(f=>`<div class="fact"><span class="k">📎 ${esc(f.name)}</span><span class="v" style="color:var(--muted);font-size:11px">${f.at?fmtDate(f.at):''}</span></div>`).join('')}</div>`:''}
  </div></div>`;
}
function invoiceFromBooking(id){const b=getBooking(id);if(!b)return;const inv={id:uid('inv'),number:'INV-'+Date.now().toString().slice(-4),clientId:b.leadId,date:new Date().toISOString().slice(0,10),currency:'SAR',status:'Draft',items:[{desc:'Booking '+b.ref+' — '+bkAirlines(b).join(', '),bookingId:b.id,amount:onum(b.totalSale)}],total:onum(b.totalSale),files:[],notes:''};(DB.invoices=DB.invoices||[]).push(inv);b.invoiceId=inv.id;save();openInvoice=inv.id;current='invoices';render();}
function editBooking(id){const b=getBooking(id);if(!b)return;const isNew=!id;
  const clientOpts=DB.businesses.map(x=>`<option value="${x.id}" ${b.leadId===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
  const provOpts=`<option value="">—</option>`+(DB.vendors||[]).map(x=>`<option ${b.provider===x.name?'selected':''}>${esc(x.name)}</option>`).join('');
  const t=(b.tickets&&b.tickets[0])||{};
  openModal('Edit '+esc(b.ref),`<div class="grid2"><div class="field"><label>Ref</label><input id="eb_ref" value="${esc(b.ref||'')}"></div><div class="field"><label>Client</label><select id="eb_client">${clientOpts}</select></div></div><div class="grid2"><div class="field"><label>Provider</label><select id="eb_prov">${provOpts}</select></div><div class="field"><label>Status</label><select id="eb_status">${BK_STATUS.map(s=>`<option ${b.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div><h3 style="margin-top:8px">Lead ticket</h3><div class="grid2"><div class="field"><label>Airline</label><input id="eb_air" value="${esc(t.airline||'')}"></div><div class="field"><label>PNR</label><input id="eb_pnr" value="${esc(t.pnr||'')}"></div></div><div class="grid2"><div class="field"><label>Pax</label><input id="eb_pax" value="${esc(t.pax||'')}"></div><div class="field"><label>Route</label><input id="eb_route" value="${esc(t.route||'')}"></div></div><div class="grid2"><div class="field"><label>Fare</label><input id="eb_fare" type="number" value="${t.fare||''}"></div><div class="field"><label>Taxes</label><input id="eb_tax" type="number" value="${t.taxes||''}"></div></div><div class="grid2"><div class="field"><label>Total cost</label><input id="eb_cost" type="number" value="${b.totalCost||0}"></div><div class="field"><label>Total sale</label><input id="eb_sale" type="number" value="${b.totalSale||0}"></div></div><div class="field"><label>Notes</label><textarea id="eb_notes" rows="2">${esc(b.notes||'')}</textarea></div>`,()=>{b.ref=val('eb_ref');b.leadId=val('eb_client');b.provider=val('eb_prov');b.status=val('eb_status');b.totalCost=+val('eb_cost')||0;b.totalSale=+val('eb_sale')||0;b.notes=val('eb_notes');const nt={pnr:val('eb_pnr'),eticket:t.eticket||'',pax:val('eb_pax'),route:val('eb_route'),cls:t.cls||'',fare:+val('eb_fare')||0,taxes:+val('eb_tax')||0,airline:val('eb_air')};if(b.tickets&&b.tickets.length)b.tickets[0]=nt;else b.tickets=[nt];save();render();},()=>{if(confirm('Delete this booking?')){DB.bookings=DB.bookings.filter(x=>x.id!==id);openBooking=null;save();render();}});}
/* ----- Invoices ----- */
let openInvoice=null;
function getInvoice(id){return (DB.invoices||[]).find(i=>i.id===id);}
function renderInvoices(v){if(openInvoice)return invoiceDetail(v,openInvoice);
  const I=DB.invoices||[];const tot=I.reduce((s,i)=>s+onum(i.total),0);const paid=I.filter(i=>i.status==='Paid').reduce((s,i)=>s+onum(i.total),0);const out=I.filter(i=>['Issued','Overdue'].indexOf(i.status)>-1).reduce((s,i)=>s+onum(i.total),0);
  v.innerHTML=`
  ${dropZone('invoice')}
  <div class="card" style="display:flex;flex-wrap:wrap;gap:18px;padding:14px 20px;margin-bottom:14px"><div><div class="kl">Invoices</div><div class="kv">${I.length}</div></div><div><div class="kl">Billed</div><div class="kv">${moneyShort(tot)} SAR</div></div><div><div class="kl">Paid</div><div class="kv" style="color:#16B364">${moneyShort(paid)}</div></div><div><div class="kl">Outstanding</div><div class="kv" style="color:#F0453A">${moneyShort(out)}</div></div><div style="flex:1"></div><button class="btn pri" onclick="ingestModal('invoice','',null)">+ New invoice</button></div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th>Invoice #</th><th>Client</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>
  ${I.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(i=>`<tr style="cursor:pointer" onclick="openInvoice='${i.id}';render()"><td><b>${esc(i.number)}</b></td><td>${esc(leadName(i.clientId))}</td><td style="color:var(--muted)">${(i.items||[]).length}</td><td style="font-weight:700;white-space:nowrap">${moneyShort(i.total)} ${esc(i.currency||'')}</td><td><span class="tag" style="background:${(INV_STATUS_COLOR[i.status]||'#9AA1B6')}1a;color:${INV_STATUS_COLOR[i.status]||'#9AA1B6'}">${esc(i.status||'—')}</span></td><td style="color:var(--muted);white-space:nowrap">${esc(i.date||'')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No invoices yet — drop a PDF or click “New invoice”.</td></tr>'}
  </tbody></table></div></div>`;
}
function invoiceDetail(v,id){const i=getInvoice(id);if(!i){openInvoice=null;return renderInvoices(v);}
  v.innerHTML=`<button class="btn ghost sm" onclick="openInvoice=null;render()">← Invoices</button>
  <div class="detail-head"><div class="ava" style="background:${avaColor(i.id)}">🧾</div><div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:800">${esc(i.number)}</div><div class="tags" style="margin-top:8px"><span class="tag" style="background:${(INV_STATUS_COLOR[i.status]||'#9AA1B6')}1a;color:${INV_STATUS_COLOR[i.status]||'#9AA1B6'}">${esc(i.status||'—')}</span><span class="tag seg">${esc(leadName(i.clientId))}</span></div></div><button class="btn sm" onclick="editInvoice('${i.id}')">Edit</button></div>
  <div class="detail-grid"><div>
    <div class="card"><h3>Line items</h3><div class="tbl-wrap"><table><thead><tr><th>Description</th><th>Links to</th><th>Amount</th></tr></thead><tbody>${(i.items||[]).map(it=>{const bk=it.bookingId?getBooking(it.bookingId):null;return `<tr><td>${esc(it.desc||'—')}</td><td>${bk?`<a class="chiplink" onclick="openBooking='${bk.id}';current='bookings';render()">${esc(bk.ref)} ›</a>`:'<span class="muted">—</span>'}</td><td style="font-weight:700;white-space:nowrap">${moneyShort(it.amount)}</td></tr>`;}).join('')||'<tr><td colspan="3" class="empty">No line items.</td></tr>'}<tr><td></td><td style="text-align:right;font-weight:700">Total</td><td style="font-weight:800;color:var(--orange)">${money(i.total)} ${esc(i.currency||'')}</td></tr></tbody></table></div></div>
  </div><div>
    <div class="card"><h3>Related records</h3><div class="related"><a onclick="openLead='${i.clientId}';current='leads';render()">👤 ${esc(leadName(i.clientId))}</a>${[...new Set((i.items||[]).map(it=>it.bookingId).filter(Boolean))].map(bid=>{const bk=getBooking(bid);return bk?`<a onclick="openBooking='${bk.id}';current='bookings';render()">🧳 ${esc(bk.ref)}</a>`:'';}).join('')}</div></div>
    ${(i.files||[]).length?`<div class="card"><h3>Attached files</h3>${i.files.map(f=>`<div class="fact"><span class="k">📎 ${esc(f.name)}</span><span class="v" style="color:var(--muted);font-size:11px">${f.at?fmtDate(f.at):''}</span></div>`).join('')}</div>`:''}
  </div></div>`;
}
function editInvoice(id){const i=getInvoice(id);if(!i)return;const clientOpts=DB.businesses.map(x=>`<option value="${x.id}" ${i.clientId===x.id?'selected':''}>${esc(x.name)}</option>`).join('');const it=(i.items&&i.items[0])||{};
  openModal('Edit '+esc(i.number),`<div class="grid2"><div class="field"><label>Invoice #</label><input id="ei_num" value="${esc(i.number||'')}"></div><div class="field"><label>Client</label><select id="ei_client">${clientOpts}</select></div></div><div class="grid2"><div class="field"><label>Date</label><input id="ei_date" type="date" value="${esc(i.date||'')}"></div><div class="field"><label>Status</label><select id="ei_status">${INV_STATUS.map(s=>`<option ${i.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="grid2"><div class="field"><label>Total</label><input id="ei_total" type="number" value="${i.total||0}"></div><div class="field"><label>Currency</label><select id="ei_cur"><option ${i.currency==='SAR'?'selected':''}>SAR</option><option ${i.currency==='USD'?'selected':''}>USD</option><option ${i.currency==='EGP'?'selected':''}>EGP</option></select></div></div><div class="field"><label>First line description</label><input id="ei_desc" value="${esc(it.desc||'')}"></div>`,()=>{i.number=val('ei_num');i.clientId=val('ei_client');i.date=val('ei_date');i.status=val('ei_status');i.total=+val('ei_total')||0;i.currency=val('ei_cur');if(i.items&&i.items.length){i.items[0].desc=val('ei_desc');i.items[0].amount=i.total;}else i.items=[{desc:val('ei_desc'),amount:i.total}];save();render();},()=>{if(confirm('Delete this invoice?')){DB.invoices=DB.invoices.filter(x=>x.id!==id);openInvoice=null;save();render();}});}
/* ----- Tickets register ----- */
function renderTickets(v){const T=allTickets();
  v.innerHTML=`
  ${dropZone('ticket')}
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th>Airline</th><th>PNR</th><th>E-ticket</th><th>Pax</th><th>Route</th><th>Cls</th><th>Fare+tax</th><th>Provider</th><th>Booking</th></tr></thead><tbody>
  ${T.map(t=>`<tr style="cursor:pointer" onclick="openBookingFn('${t.bookingId}')"><td><b>${esc(t.airline||'—')}</b></td><td>${esc(t.pnr||'—')}</td><td style="color:var(--muted)">${esc(t.eticket||'—')}</td><td>${esc(t.pax||'—')}</td><td>${esc(t.route||'—')}</td><td>${esc(t.cls||'—')}</td><td style="white-space:nowrap">${moneyShort(onum(t.fare)+onum(t.taxes))}</td><td style="color:var(--muted)">${esc(t.provider||'—')}</td><td><span class="chiplink">${esc(t.bref)} ›</span></td></tr>`).join('')||'<tr><td colspan="9" class="empty">No tickets yet.</td></tr>'}
  </tbody></table></div></div>`;
}
/* ----- Corporate account (whale-grade client structure) ----- */
const ENTITY_TYPES=['Ministry','Government entity','Semi-government','Multinational','Corporate','SME','Charity/NGO'];
function corpCard(b){
  const deals=b.airlineDeals||[];const pr=b.pricing||[];
  return `<div class="card"><div class="card-head" style="margin-bottom:8px"><div><h3>Corporate account</h3><div class="ch-sub" style="margin:0">Contract, policy, negotiated deals & pricing — agents check before quoting</div></div><button class="btn sm" onclick="editCorporate('${b.id}')">Edit profile</button></div>
  <div class="fact"><span class="k">Entity type</span><span class="v">${b.entityType?'<span class="tag gov">'+esc(b.entityType)+'</span>':'—'}</span></div>
  <div class="fact"><span class="k">Legal name / CR·VAT</span><span class="v">${esc(b.legalName||b.nameAr||'—')}${b.crVat?(' · '+esc(b.crVat)):''}</span></div>
  <div class="fact"><span class="k">Account manager</span><span class="v">${esc(b.accountManager||b.owner||'—')}</span></div>
  <div class="fact"><span class="k">Payment terms</span><span class="v">${esc(b.paymentTerms||'—')}${(b.creditLimit&&!b.isClient)?(' · credit '+esc(b.creditLimit)):''}</span></div>
  <div class="fact"><span class="k">Contract</span><span class="v">${esc(b.contractStart||'—')}${b.contractEnd?(' → '+esc(b.contractEnd)):''}${b.contractSLA?(' · SLA: '+esc(b.contractSLA)):''}</span></div>
  ${b.contractScope?`<div class="fact"><span class="k">Scope</span><span class="v">${esc(b.contractScope)}</span></div>`:''}
  ${b.prefs?`<div style="margin-top:9px"><div class="sub-h">Travel policy & preferences</div><p style="margin:0;font-size:12.5px;color:#3a4054;line-height:1.55;white-space:pre-line">${esc(b.prefs)}</p></div>`:''}
  <div class="sub-h" style="margin-top:11px">Airline corporate deals / fares</div>
  ${deals.length?`<table class="odoc-tbl" style="margin:4px 0"><thead><tr><th>Airline</th><th>Code</th><th>Discount</th><th>Notes</th></tr></thead><tbody>${deals.map(d=>`<tr><td>${esc(d.airline)}</td><td>${esc(d.code||'—')}</td><td style="font-weight:700;color:var(--green)">${esc(d.discount||'—')}</td><td style="color:var(--muted)">${esc(d.notes||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty" style="padding:8px">No negotiated airline deals recorded.</div>'}
  <div class="sub-h" style="margin-top:11px">Pricing scheme — markup / fees per service</div>
  ${pr.length?`<table class="odoc-tbl" style="margin:4px 0"><thead><tr><th>Service</th><th>Markup / fee</th><th>Notes</th></tr></thead><tbody>${pr.map(p=>`<tr><td>${esc(p.service)}</td><td style="font-weight:700">${esc(p.value||'—')}</td><td style="color:var(--muted)">${esc(p.notes||'')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty" style="padding:8px">⚠ No pricing scheme set — add before quoting this client.</div>'}
  </div>`;
}
function editCorporate(id){
  const b=getLead(id);if(!b)return;
  window._deals=JSON.parse(JSON.stringify(b.airlineDeals||[]));window._pricing=JSON.parse(JSON.stringify(b.pricing||[]));
  openModal('Corporate profile — '+esc(b.name),`
    <div class="grid2"><div class="field"><label>Entity type</label><select id="c_et">${ENTITY_TYPES.map(t=>`<option ${b.entityType===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>Account manager</label><input id="c_am" value="${esc(b.accountManager||b.owner||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Legal name</label><input id="c_legal" value="${esc(b.legalName||b.nameAr||'')}"></div><div class="field"><label>CR / VAT number</label><input id="c_cr" value="${esc(b.crVat||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Payment terms</label><input id="c_pt" value="${esc(b.paymentTerms||'')}" placeholder="Pre-paid / Post-paid 30d"></div><div class="field"><label>Credit limit</label><input id="c_cl" value="${esc(b.creditLimit||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Contract start</label><input id="c_cs" value="${esc(b.contractStart||'')}" placeholder="2026-01-01"></div><div class="field"><label>Contract end</label><input id="c_ce" value="${esc(b.contractEnd||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Contract scope</label><input id="c_scope" value="${esc(b.contractScope||'')}" placeholder="Air, hotel, transfer, visa"></div><div class="field"><label>Agreed SLA</label><input id="c_sla" value="${esc(b.contractSLA||'')}" placeholder="Quote ≤4h · 24/7"></div></div>
    <div class="field"><label>Travel policy & preferences</label><textarea id="c_prefs" rows="3" placeholder="Cabin rules, preferred carriers/hotels, approval workflow, who may book…">${esc(b.prefs||'')}</textarea></div>
    <div class="field"><label>Airline corporate deals / fares</label><div id="dealrows"></div><button class="btn sm" onclick="addDeal()">+ Add airline deal</button></div>
    <div class="field"><label>Pricing scheme (per service)</label><div id="pricerows"></div><button class="btn sm" onclick="addPrice()">+ Add service pricing</button></div>
  `,()=>{b.entityType=val('c_et');b.accountManager=val('c_am');b.legalName=val('c_legal');b.crVat=val('c_cr');b.paymentTerms=val('c_pt');b.creditLimit=val('c_cl');b.contractStart=val('c_cs');b.contractEnd=val('c_ce');b.contractScope=val('c_scope');b.contractSLA=val('c_sla');b.prefs=val('c_prefs');b.airlineDeals=(window._deals||[]).filter(d=>d.airline);b.pricing=(window._pricing||[]).filter(p=>p.service);save();render();});
  drawDeals();drawPrice();
}
function drawDeals(){const c=document.getElementById('dealrows');if(!c)return;c.innerHTML=(window._deals||[]).map((d,i)=>`<div class="contact" style="grid-template-columns:1.1fr .9fr .7fr 1.2fr auto"><input placeholder="Airline" value="${esc(d.airline||'')}" oninput="window._deals[${i}].airline=this.value"><input placeholder="Tour/Acct code" value="${esc(d.code||'')}" oninput="window._deals[${i}].code=this.value"><input placeholder="Discount" value="${esc(d.discount||'')}" oninput="window._deals[${i}].discount=this.value"><input placeholder="Notes (min vol, blackout)" value="${esc(d.notes||'')}" oninput="window._deals[${i}].notes=this.value"><span class="x" onclick="window._deals.splice(${i},1);drawDeals()">✕</span></div>`).join('');}
function addDeal(){window._deals=window._deals||[];window._deals.push({airline:'',code:'',discount:'',notes:''});drawDeals();}
function drawPrice(){const c=document.getElementById('pricerows');if(!c)return;c.innerHTML=(window._pricing||[]).map((p,i)=>`<div class="contact" style="grid-template-columns:1fr 1fr 1.4fr auto"><input placeholder="Service" value="${esc(p.service||'')}" oninput="window._pricing[${i}].service=this.value"><input placeholder="Markup / fee" value="${esc(p.value||'')}" oninput="window._pricing[${i}].value=this.value"><input placeholder="Notes" value="${esc(p.notes||'')}" oninput="window._pricing[${i}].notes=this.value"><span class="x" onclick="window._pricing.splice(${i},1);drawPrice()">✕</span></div>`).join('');}
function addPrice(){window._pricing=window._pricing||[];window._pricing.push({service:'',value:'',notes:''});drawPrice();}
/* o_setClient (the header "Client" dropdown) sets both o.client AND o.linkedLeadId — the
   real link back to the client's own record. This one only ever set o.client, so a proposal
   picked here alone looked linked (right name showing) but never actually was: it wouldn't
   show up on the client's own page/history. Found by the QA-admin audit, 2026-08-20 — now
   links the same way, on top of the pricing/deals note this dropdown already adds. */
function o_loadClient(id){if(!id)return;const b=getLead(id);const o=curOffer();if(!b||!o)return;o.client=b.name;o.linkedLeadId=id;const parts=[];if(b.pricing&&b.pricing.length)parts.push('Pricing — '+b.pricing.map(p=>p.service+' '+p.value).join('; '));if(b.airlineDeals&&b.airlineDeals.length)parts.push('Deals — '+b.airlineDeals.map(d=>d.airline+' '+(d.discount||'')+(d.code?(' ['+d.code+']'):'')).join('; '));if(parts.length)o.remarks=(o.remarks?o.remarks+' · ':'')+parts.join(' · ');save();offerEditor(document.getElementById('view'),o.id);}

/* ----- Export (per page: summary or full details) ----- */
function supSelectAll(cb){document.querySelectorAll('.supchk').forEach(c=>c.checked=cb.checked);}
/* One flattener for both exporters (2026-09-02, attack round 22). The old one-level join wrote
   "[object Object]" six times per airline for the NDC matrix (an object whose values are objects)
   in the "full details" export, in both languages. Shapes: a list → items joined " | " (an item
   that is an object → its non-empty values joined " "); an object of objects → "key: status" (or
   the first text value) joined " | "; an object of yes/no flags → the keys that are on, joined
   ", "; any other object → its non-empty values joined " ". Scalars pass through. */
function exportFlat(v,k){
  if(v==null)return '';
  // Round 23 additions: keys that start with "_" are the app's own bookkeeping (the people
  // bridge's _fromTable / _tid marks) and never belong in a person's spreadsheet; a 13-digit
  // number on a time column (createdAt, updatedAt, ts) is an epoch and reads as a date-time.
  const one=x=>{if(x==null)return '';if(typeof x!=='object')return String(x);const vals=Object.keys(x).filter(kk=>kk.charAt(0)!=='_').map(kk=>x[kk]).filter(y=>y!==''&&y!=null&&y!==false&&typeof y!=='object');return vals.join(' ');};
  if(typeof v==='number'&&k&&/(At|_at|Date|date|Ts|ts)$/.test(String(k))&&v>1e11&&v<1e13){try{const d=new Date(v);return d.toISOString().slice(0,10)+' '+d.toISOString().slice(11,16);}catch(_){return v;}}
  if(Array.isArray(v))return v.map(one).filter(Boolean).join(' | ');
  if(typeof v==='object'){
    const ks=Object.keys(v);if(!ks.length)return '';
    if(ks.every(k=>v[k]&&typeof v[k]==='object'&&!Array.isArray(v[k])))return ks.map(k=>{const o=v[k];const st=o.status!=null?o.status:(Object.values(o).find(y=>typeof y==='string'&&y)||'');return st?k+': '+st:'';}).filter(Boolean).join(' | ');
    if(ks.every(k=>typeof v[k]==='boolean'))return ks.filter(k=>v[k]).join(', ');
    return one(v);
  }
  return v;
}
function csvCell(v,k){v=exportFlat(v,k);return '"'+csvGuard(v).replace(/"/g,'""')+'"';}
function allKeys(rows){const s=[];rows.forEach(r=>Object.keys(r).forEach(k=>{if(k!=='id'&&s.indexOf(k)<0)s.push(k);}));return s;}
/* Neither export helper ever revoked its blob URL (found 2026-08-20 while chasing a reported
   export freeze — never reproduced, even at 3000 rows with nested JSONB, but an object URL
   held open for the whole page session is real, avoidable waste on a page people leave open
   all day, so it's fixed regardless). The URL is revoked a moment after the click, same
   pattern already used elsewhere in this app (js/57's proofDownload) — enough delay for the
   browser to have started the download from it. */
function downloadCSV(name,rows,fields){const head=fields.map(f=>csvCell(f)).join(',');const body=rows.map(r=>fields.map(f=>csvCell(r[f],f)).join(',')).join('\n');const blob=new Blob(['﻿'+head+'\n'+body],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
function downloadXLS(name,rows,fields){
 const eh=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const cv=(v,k)=>'<td>'+eh(exportFlat(v,k))+'</td>';
 const html='<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><tr>'+fields.map(fd=>'<th>'+eh(fd)+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+fields.map(fd=>cv(r[fd],fd)).join('')+'</tr>').join('')+'</table></body></html>';
 const blob=new Blob(['﻿'+html],{type:'application/vnd.ms-excel;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
function exportCurrent(scope){
  const xls=scope==='xlsList'||scope==='xlsFull';
  const fullScope=scope==='full'||scope==='xlsFull';
  let cur=current;
  if(cur==='sopsla')cur=(window.sopslaTab==='slas')?'slas':'sops';
  const M={leads:{rows:(typeof leadsView==="function"?leadsView():DB.businesses),list:['name','nameAr','area','source','sourceSub','stage','assignedTo','category','segment','website','contacts','linkedin','facebook','instagram','x_twitter','tiktok','youtube','licenceNumber','licenceStatus','mtActivity','verificationStatus','outreachScore','decisionMakers','totalSAR','notes']},
    clients:{rows:(typeof clientsView==="function"?clientsView():(DB.businesses||[]).filter(b=>b.isClient)),list:['name','nameAr','area','source','stage','assignedTo','tier','segment','website','contacts','linkedin','licenceNumber','verificationStatus','channels','totalSAR','convertedDate','nextReview','notes']},
    airlines:{rows:(typeof supListView==="function"&&current==="airlines"?supListView("air"):(DB.airlines||[])),list:['name','code','icao','stock','ksa','ticketingAuthority','alliance','type','country','gds','providers']},
    vendors:{rows:(typeof supListView==="function"&&current==="vendors"?supListView("prov"):DB.vendors),list:['name','type','source','portal','verdict','apiStatus','settlement']},
    sops:{rows:(DB.sops||[]).concat(DB.sopsWhale||[]),list:['code','title','purpose']},
    slas:{rows:DB.slas,list:['event','direct','market','whale']},
    ops:{rows:DB.requests||[],list:['client','service','stage','owner','priority','sell','cost']},
    offers:{rows:DB.offers||[],list:['ref','date','client','airline','total','currency','status']},
    bookings:{rows:DB.bookings||[],list:null},
    invoices:{rows:DB.invoices||[],list:null},
    tickets:{rows:(typeof allTickets==='function'?allTickets():[]),list:null},
    projects:{rows:(DB.projects||[]),list:null},
    /* 'finance' was missing here entirely (found 2026-08-20) — every one of the four labeled
       export buttons fell through to exportData(), the same full JSON backup as the plain
       "Full backup (JSON)" button. FIN._csvRows is the currently-filtered Ledger rows (set
       by rLedger() — the same source the working finCSV() button already exports from), so
       Summary/Full now differ in column count and CSV/Excel now differ in actual format. */
    finance:{rows:(typeof FIN!=='undefined'&&FIN._csvRows)||[],list:['invoice_no','invoice_date','client_group','service_type','total_incl_vat_sar','revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','integrity_status']}};
  const m=M[cur];if(!m){exportData();return;}
  if(cur==='finance'&&!m.rows.length){alert((typeof LANG!=='undefined'&&LANG==='ar')?'لا صفوف للتصدير — افتح تبويب دفتر القيود أولًا':'No rows to export — open the Ledger tab first');return;}
  let rows=m.rows.slice();
  const sel=[...document.querySelectorAll('.supchk:checked')].map(c=>c.value);
  if(sel.length&&(cur==='airlines'||cur==='vendors'))rows=rows.filter(r=>sel.indexOf(r.id)>=0);
  const fields=(cur==='leads'||cur==='clients')?m.list:(fullScope?allKeys(rows):(m.list||allKeys(rows).slice(0,10)));
  const fname='DirectBusiness-'+cur+'-'+(fullScope?'full':'summary')+(sel.length?'-selected':'');
  if(xls)downloadXLS(fname+'.xls',rows,fields);else downloadCSV(fname+'.csv',rows,fields);
}
function expGo(s){var e=document.getElementById('expmenu');if(e)e.classList.remove('show');exportCurrent(s);}

/* ================= MODAL ================= */
function openModal(title,body,onSave,onDelete){
  const m=document.getElementById("modal");
  m.innerHTML=`<div class="mh"><h3>${title}</h3><span class="iconbtn" onclick="closeModal()">✕</span></div><div class="mb">${body}</div><div class="mf"><div>${onDelete?'<button class="btn danger" id="mDel">Delete</button>':''}</div><div style="display:flex;gap:8px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn pri" id="mSave">Save changes</button></div></div>`;
  document.getElementById("ov").classList.add("show");
  document.getElementById("mSave").onclick=()=>{if(onSave()!==false)closeModal();};
  if(onDelete)document.getElementById("mDel").onclick=()=>{onDelete();closeModal();};
  if(document.getElementById("contacts"))drawContacts();
}
function closeModal(){document.getElementById("ov").classList.remove("show");}
document.getElementById("ov").addEventListener("click",e=>{if(e.target.id==="ov")closeModal();});

