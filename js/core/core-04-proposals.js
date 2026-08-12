/* ----- Offer Builder ----- */
let openOffer=null;
const OFFER_STATUS=["Draft","Sent","Viewed","Accepted","Rejected","Expired"];
const OFFER_STATUS_COLOR={Draft:"#9AA1B6",Sent:"#2E90FA",Viewed:"#7A5AF8",Accepted:"#16B364",Rejected:"#F0453A",Expired:"#82868B"};
const POLICY_STATUS=["Not checked","In-policy","Out-of-policy"];
const APPROVAL_STATUS=["Not required","Pending","Approved","Rejected"];
const OFFER_CONTENT=["—","NDC","EDIFACT","LCC API","Aggregator"];
function onum(s){return parseFloat(String(s==null?'':s).replace(/[^0-9.]/g,''))||0;}
const BUNDLE_TYPES=["Flight","Hotel","Visa","Transfer","Transport","Day tour","Insurance","Meals","Lounge","eSIM","Other"];
function optTotal(op){return onum(op.base)+onum(op.taxes)+onum(op.anc)+onum(op.fee)+(op.items||[]).reduce((s,it)=>s+onum(it.price),0);}
function optFreebieCost(op){return (op.freebies||[]).reduce((s,f)=>s+onum(f.cost),0);}
function offerFreebieCost(o){return (o.options||[]).reduce((s,op)=>s+optFreebieCost(op),0);}
function o_addItem(oi){const o=curOffer();if(!o||!o.options[oi])return;o.options[oi].items=o.options[oi].items||[];o.options[oi].items.push({type:'Hotel',detail:'',price:''});save();offerEditor(document.getElementById('view'),o.id);}
function o_setItem(oi,ii,k,v){const o=curOffer();if(!o)return;o.options[oi].items[ii][k]=v;save();var d=document.getElementById('offerDoc');if(d)d.innerHTML=offerHTML(o);}
function o_delItem(oi,ii){const o=curOffer();if(!o)return;o.options[oi].items.splice(ii,1);save();offerEditor(document.getElementById('view'),o.id);}
function o_addFreebie(oi){const o=curOffer();if(!o)return;o.options[oi].freebies=o.options[oi].freebies||[];o.options[oi].freebies.push({label:'',cost:''});save();offerEditor(document.getElementById('view'),o.id);}
function o_setFreebie(oi,ii,k,v){const o=curOffer();if(!o)return;o.options[oi].freebies[ii][k]=v;save();var d=document.getElementById('offerDoc');if(d)d.innerHTML=offerHTML(o);}
function o_delFreebie(oi,ii){const o=curOffer();if(!o)return;o.options[oi].freebies.splice(ii,1);save();offerEditor(document.getElementById('view'),o.id);}
function offerPax(o){return Math.max(1,(+o.paxAdt||0)+(+o.paxChd||0)+(+o.paxInf||0));}
function offerMargin(o){return onum(o.total)-onum(o.cost);}
function offerExpiry(o){if(!o.validUntil)return null;const d=Math.ceil((new Date(o.validUntil).getTime()-Date.now())/864e5);return {days:d,label:d<0?('Expired '+(-d)+'d ago'):(d===0?'Expires today':'Valid '+d+'d'),color:d<0?'#F0453A':d<=2?'#F79009':'#16B364'};}
function offerStatusBadge(o){const c=OFFER_STATUS_COLOR[o.status]||'#9AA1B6';return `<span class="tag" style="background:${c}1a;color:${c}">${esc(o.status||'Draft')}</span>`;}
function o_addOption(){const o=curOffer();if(!o)return;o.options=o.options||[];o.options.push({label:'Option '+(o.options.length+1),provider:'',content:'—',fareFamily:'',base:'',taxes:'',anc:'',fee:'',refundable:'No',baggage:'1 x 23kg'});save();offerEditor(document.getElementById('view'),o.id);}
function o_setOption(i,k,val){const o=curOffer();if(!o||!o.options[i])return;o.options[i][k]=val;save();const d=document.getElementById('offerDoc');if(d)d.innerHTML=offerHTML(o);}
function o_delOption(i){const o=curOffer();if(!o)return;o.options.splice(i,1);save();offerEditor(document.getElementById('view'),o.id);}
function o_logToLead(){const o=curOffer();if(!o)return;if(!o.linkedLeadId){alert('Link a lead/client first (Deal & workflow section).');return;}const b=getLead(o.linkedLeadId);if(!b){alert('Linked lead not found.');return;}b.activities=b.activities||[];b.activities.push({date:Date.now(),type:'Offer',status:'',note:'Offer '+(o.ref||'')+' ('+(o.status||'Draft')+')'+(o.subject?' — '+o.subject:'')+(o.total?(' · '+o.total+' '+(o.currency||'')):''),by:o.owner||'Abdelrahman'});b.lastContact=Date.now();save();alert('Logged to '+b.name+'’s work log.');}
function renderOffers(v){
  if(openOffer)return offerEditor(v,openOffer);
  v.innerHTML=`
  ${dropZone('offer')}
  <div class="toolbar"><div class="search-wrap">${IC.search}<input id="oq" placeholder="${(typeof LANG!=='undefined'&&LANG==='ar')?'بحث في العروض…':'Search proposals…'}" oninput="drawOffers(this.value)"></div><div style="flex:1"></div><button class="btn sm ${window.offerMine?'pri':'ghost'}" onclick="window.offerMine=!window.offerMine;drawOffers(document.getElementById('oq')?document.getElementById('oq').value:'')">👤 ${(typeof LANG!=='undefined'&&LANG==='ar')?'خاص بي':'Mine'}</button><button class="btn pri" onclick="newOffer()">${(typeof LANG!=='undefined'&&LANG==='ar')?'+ عرض جديد':'+ New proposal'}</button></div>
  <div class="card" style="padding:0"><div class="tbl-wrap"><table><thead><tr><th>Ref</th><th>${(typeof LANG!=='undefined'&&LANG==='ar')?'النوع':'Type'}</th><th>Status</th><th>Client</th><th>Subject</th><th>${(typeof LANG!=='undefined'&&LANG==='ar')?'القيمة':'Value'}</th><th>Valid</th><th></th></tr></thead><tbody id="otb"></tbody></table></div></div>`;
  drawOffers("");
}
function drawOffers(q){q=(q||'').toLowerCase();const ar=(typeof LANG!=='undefined'&&LANG==='ar');const tb=document.getElementById('otb');if(!tb)return;const _meO=(window.meName?meName():'');const O=(DB.offers||[]).filter(o=>(!q||((o.ref||'')+' '+(o.client||'')+' '+(o.subject||'')+' '+(o.proposalType||'')+' '+(o.airline||'')).toLowerCase().includes(q))&&(!window.offerMine||((o.owner||'')===_meO)));
  tb.innerHTML=O.map(o=>{const ptype=ar?(PROPOSAL_TYPES_AR[o.proposalType]||o.proposalType||'—'):(o.proposalType||'—');return `<tr style="cursor:pointer" onclick="openOfferFn('${o.id}')"><td><b>${esc(o.ref||'—')}</b>${(o.docUrl||o.fileName)?' 📎':''}${o.promotedToProject?' 🏗':''}</td><td><span class="tag" style="background:#EEF0F5;color:#4B5563">${esc(ptype)}</span></td><td>${offerStatusBadge(o)}</td><td>${esc(o.client||'—')}</td><td style="color:var(--muted)">${esc(o.subject||'')}</td><td style="font-weight:700;white-space:nowrap">${esc(o.value||o.total||'')} ${esc(o.currency||'SAR')}</td><td style="color:var(--muted);white-space:nowrap">${o.validUntil?`<span style="color:${offerExpiry(o).color}">${offerExpiry(o).label}</span>`:esc(o.date||'')}</td><td style="text-align:right"><span class="chiplink">${ar?'فتح ›':'Open ›'}</span></td></tr>`;}).join('')||`<tr><td colspan="8" class="empty">${ar?'لا توجد عروض بعد — اضغط «عرض جديد».':'No proposals yet — click “New proposal”.'}</td></tr>`;
}
function openOfferFn(id){openOffer=id;render();window.scrollTo(0,0);}
function closeOffer(){openOffer=null;render();}
function newOffer(){const o={id:uid('o'),ref:'DB-'+Date.now().toString().slice(-6),date:new Date().toISOString().slice(0,10),client:'',subject:'',airline:'',route:'',flight:'',cls:'',currency:'SAR',ticketPrice:'',partnerFees:'',serviceFees:'',vat:'',dip:'',total:'',changesBefore:'',changesAfter:'Not permitted',cancelBefore:'',cancelAfter:'Non-Refundable',noShow:'',baggage:'1 piece 23 Kg',lastIssue:'',minStay:'-',maxStay:'-',cheapest:'Yes',remarks:'',addFees:'Partner contractual refund & reissue fees apply. Original handling fees are non-refundable.',status:'Draft',version:1,validUntil:'',ttl:'',linkedLeadId:'',policyStatus:'Not checked',policyReason:'',approvalStatus:'Not required',paxAdt:1,paxChd:0,paxInf:0,cost:'',commission:'',winLoseReason:'',options:[],owner:(window.meName?meName():(typeof me==='function'?me():'')),
  /* full-proposal fields */ proposalType:'Price offer',docUrl:'',scope:'',value:'',promotedToProject:false};(DB.offers=DB.offers||[]).push(o);save();openOffer=o.id;render();}
/* Proposal types Direct actually uses (from the real Drive proposals folder). */
const PROPOSAL_TYPES=['Price offer','Technical proposal','Financial bid','Business solution','Training','Tender','Travel — flights','Other'];
const PROPOSAL_TYPES_AR={'Price offer':'عرض سعر','Technical proposal':'عرض فني','Financial bid':'عرض مالي','Business solution':'حل أعمال','Training':'تدريب','Tender':'مناقصة','Travel — flights':'سفر — طيران','Other':'أخرى'};
function o_setClient(id){const o=curOffer();if(!o)return;o.linkedLeadId=id;var b=(DB.businesses||[]).find(x=>x.id===id);o.client=b?b.name:o.client;save();offerEditor(document.getElementById('view'),o.id);}
function o_promoteProject(id){const o=(DB.offers||[]).find(x=>x.id===id);if(!o)return;if(o.promotedToProject){if(typeof toast==='function')toast('Already a project');return;}
  const _ar=(typeof LANG!=='undefined'&&LANG==='ar');
  if(!confirm(_ar?('تحويل هذا العرض إلى مشروع؟'):('Promote this proposal to a project?')))return;
  DB.projects=DB.projects||[];DB.projects.push({id:uid('prj'),name:o.subject||o.ref||'Project',nameAr:'',client:o.client||'',linkedClientId:o.linkedLeadId||'',value:o.value||o.total||'',status:'Active',fromOfferId:o.id,owner:o.owner||'',createdAt:Date.now(),notes:o.scope||''});
  o.promotedToProject=true;save();offerEditor(document.getElementById('view'),o.id);if(typeof toast==='function')toast(_ar?'تم إنشاء مشروع':'Project created');}
function curOffer(){return (DB.offers||[]).find(x=>x.id===openOffer);}
function o_set(k,val){const o=curOffer();if(!o)return;o[k]=val;save();const d=document.getElementById('offerDoc');if(d)d.innerHTML=offerHTML(o);}
function o_calc(){const o=curOffer();if(!o)return;const num=s=>parseFloat(String(s).replace(/[^0-9.]/g,''))||0;o.total=String(num(o.ticketPrice)+num(o.partnerFees)+num(o.serviceFees)+num(o.vat)+num(o.dip));save();offerEditor(document.getElementById('view'),o.id);}
function logoSrc(){const i=document.querySelector('.brand .logo');return i?i.src:'';}
function offerEditor(v,id){
  const o=(DB.offers||[]).find(x=>x.id===id);if(!o){openOffer=null;return renderOffers(v);}
  const F=(k,lab,ph)=>`<div class="field"><label>${lab}</label><input id="of_${k}" value="${esc(o[k]||'')}" ${ph?('placeholder="'+ph+'"'):''} oninput="o_set('${k}',this.value)"></div>`;
  const _par=(typeof LANG!=='undefined'&&LANG==='ar');const _pl=(en,ar)=>_par?ar:en;
  const _clients=(DB.businesses||[]).filter(b=>b.isClient);
  const proposalHead=`<div class="card" style="padding:14px 16px;margin-bottom:12px;border-inline-start:3px solid #FF6B00">
     <h3 style="margin:0 0 10px">${_pl('Proposal','العرض / المقترح')}</h3>
     <div class="grid2">
       <div class="field"><label>${_pl('Type','النوع')}</label><select onchange="o_set('proposalType',this.value)">${PROPOSAL_TYPES.map(t=>`<option value="${t}" ${o.proposalType===t?'selected':''}>${_par?(PROPOSAL_TYPES_AR[t]||t):t}</option>`).join('')}</select></div>
       <div class="field"><label>${_pl('Client','العميل')}</label><select onchange="o_setClient(this.value)"><option value="">${_pl('— pick a client —','— اختر عميلاً —')}</option>${_clients.map(b=>`<option value="${esc(b.id)}" ${o.linkedLeadId===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
     </div>
     <div class="grid2">
       <div class="field"><label>${_pl('Value (SAR)','القيمة (ريال)')}</label><input value="${esc(o.value||o.total||'')}" oninput="o_set('value',this.value)"></div>
       <div class="field"><label>${_pl('Valid until','صالح حتى')}</label><input type="date" value="${esc(o.validUntil||'')}" oninput="o_set('validUntil',this.value)"></div>
     </div>
     <div class="field"><label>${_pl('Scope — one service per line','النطاق — خدمة في كل سطر')}</label><textarea rows="4" oninput="o_set('scope',this.value)">${esc(o.scope||'')}</textarea></div>
     <div class="field"><label>${_pl('Document link (the actual proposal file)','رابط المستند (ملف العرض الفعلي)')}</label><input value="${esc(o.docUrl||'')}" oninput="o_set('docUrl',this.value)" placeholder="https://drive.google.com/…">${o.docUrl?` <a href="${esc(o.docUrl)}" target="_blank" rel="noopener" class="chiplink">${_pl('Open ↗','فتح ↗')}</a>`:''}</div>
     <div class="field"><label>${_pl('Proposal file — stored in the app','ملف العرض — محفوظ داخل التطبيق')}</label>${o.fileName?`<div style="display:flex;gap:8px;align-items:center;background:#FFF3EC;border:1px solid #FBD9B8;border-radius:9px;padding:7px 10px;margin-bottom:6px;font-size:12.5px">📎 <a href="${esc(o.fileUrl||'#')}" target="_blank" rel="noopener" style="font-weight:700;color:var(--ink)">${esc(o.fileName)}</a><span style="flex:1"></span><span onclick="o_removeFile('${o.id}')" style="cursor:pointer;color:#F0453A" title="${_pl('Remove','إزالة')}">✕</span></div>`:''}<input type="file" id="o_file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" style="font-size:12.5px" onchange="o_uploadFile('${o.id}')"><span id="o_fileMsg" style="font-size:12px;color:var(--muted)"></span></div>
     <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><button class="btn sm pri" onclick="o_genProposal('${o.id}')">🖨 ${_pl('Generate branded proposal','إنشاء عرض بهوية دايركت')}</button>${o.promotedToProject?`<span class="tag" style="background:#E7F8EF;color:#0F6E56">✓ ${_pl('Promoted to project','حُوّل إلى مشروع')}</span>`:`<button class="btn sm" onclick="o_promoteProject('${o.id}')">↗ ${_pl('Promote to project','تحويل إلى مشروع')}</button>`}</div>
   </div>`;
  v.innerHTML=`<button class="btn ghost sm" onclick="closeOffer()">← Offers</button>
  ${proposalHead}
  <div class="offer-wrap">
   <div class="offer-form card"><h3>${_pl('Quote details (travel)','تفاصيل عرض السفر')}</h3>
     <div class="grid2">${F('ref','Ref #')}${F('date','Date')}</div>
     <div class="grid2">${F('client','Client')}${F('owner','Counselor')}</div>
     <div style="margin:-4px 0 8px"><select onchange="o_loadClient(this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--line-2);border-radius:9px;font:inherit;font-size:12.5px"><option value="">↧ Load a corporate client's negotiated deal & pricing…</option>${DB.businesses.filter(x=>x.isClient||((x.pricing||[]).length)||((x.airlineDeals||[]).length)).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')}</select></div>
     ${F('subject','Passenger / subject','e.g. Mr. Mohammed Almasar (2 pax)')}
     <div class="grid2">${F('airline','Airline')}${F('cls','Class / fare basis')}</div>
     ${F('route','Route','RUH → LHR → RUH')}${F('flight','Flight details','EK231 09 Jan 08:10 / EK232 16 Jan 10:30')}
     <h3 style="margin-top:14px">Pricing</h3>
     <div class="grid2">${F('ticketPrice','Ticket price')}${F('partnerFees',"Partner's fees")}</div>
     <div class="grid2">${F('serviceFees','Service fees')}${F('vat','VAT amount')}</div>
     <div class="grid2">${F('dip','DIP')}${F('total','Total')}</div>
     <div style="margin-top:6px;display:flex;gap:8px;align-items:center"><button class="btn sm" onclick="o_calc()">∑ Auto-total</button><label style="font-size:12px;color:var(--muted)">Currency</label><select onchange="o_set('currency',this.value);offerEditor(document.getElementById('view'),'${o.id}')" style="padding:6px 8px;border:1px solid var(--line-2);border-radius:8px;font:inherit"><option ${o.currency==='SAR'?'selected':''}>SAR</option><option ${o.currency==='USD'?'selected':''}>USD</option><option ${o.currency==='EGP'?'selected':''}>EGP</option></select></div>
     <div style="margin-top:8px;padding:9px 11px;background:#f6f3ee;border-radius:9px;font-size:12.5px">🔒 <b>Agency only:</b> Cost <input value="${esc(o.cost||'')}" oninput="o_set('cost',this.value);document.getElementById('mgn').textContent=(onum(curOffer().total)-onum(this.value)).toLocaleString()+' '+(curOffer().currency||'')" style="width:78px;border:1px solid var(--line-2);border-radius:6px;padding:3px 6px;font:inherit"> · Commission <input value="${esc(o.commission||'')}" oninput="o_set('commission',this.value)" style="width:78px;border:1px solid var(--line-2);border-radius:6px;padding:3px 6px;font:inherit"> · <b>Margin: <span id="mgn" style="color:${offerMargin(o)>=0?'#16B364':'#F0453A'}">${offerMargin(o).toLocaleString()} ${esc(o.currency||'')}</span></b>${offerFreebieCost(o)?` · 🎁 freebies cost ${offerFreebieCost(o).toLocaleString()} · <b>net ${(offerMargin(o)-offerFreebieCost(o)).toLocaleString()}</b>`:''}</div>
     <details ${(window.__ofO=window.__ofO||{}).opt?'open':''} ontoggle="__ofO.opt=this.open"><summary style="cursor:pointer;font-weight:800;font-size:14px;margin-top:14px;color:var(--ink)">Fare options — compare 2–3 fares (${(o.options||[]).length})</summary>
     <div class="ch-sub">Add 2–3 fare families / sources to compare — they appear in the client quote with NDC/EDIFACT badges.</div>
     <div id="optList">${(o.options||[]).map((op,i)=>`<div class="card" style="padding:10px;margin:8px 0;background:#faf9f6"><div class="grid2"><div class="field"><label>Label</label><input value="${esc(op.label||'')}" oninput="o_setOption(${i},'label',this.value)"></div><div class="field"><label>Provider / source</label><input value="${esc(op.provider||'')}" oninput="o_setOption(${i},'provider',this.value)" placeholder="Amadeus / Duffel"></div></div><div class="grid2"><div class="field"><label>Content</label><select onchange="o_setOption(${i},'content',this.value)">${OFFER_CONTENT.map(c=>`<option ${op.content===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>Fare family</label><input value="${esc(op.fareFamily||'')}" oninput="o_setOption(${i},'fareFamily',this.value)" placeholder="Light / Flex / Business"></div></div><div class="grid2"><div class="field"><label>Base</label><input value="${esc(op.base||'')}" oninput="o_setOption(${i},'base',this.value)"></div><div class="field"><label>Taxes / YQ</label><input value="${esc(op.taxes||'')}" oninput="o_setOption(${i},'taxes',this.value)"></div></div><div class="grid2"><div class="field"><label>Ancillaries</label><input value="${esc(op.anc||'')}" oninput="o_setOption(${i},'anc',this.value)"></div><div class="field"><label>Agency fee</label><input value="${esc(op.fee||'')}" oninput="o_setOption(${i},'fee',this.value)"></div></div><div class="grid2"><div class="field"><label>Refundable</label><select onchange="o_setOption(${i},'refundable',this.value)"><option ${op.refundable==='No'?'selected':''}>No</option><option ${op.refundable==='Yes'?'selected':''}>Yes</option><option ${op.refundable==='Partial'?'selected':''}>Partial</option></select></div><div class="field"><label>Baggage</label><input value="${esc(op.baggage||'')}" oninput="o_setOption(${i},'baggage',this.value)"></div></div><div style="border-top:1px dashed var(--line-2);margin:8px 0;padding-top:6px"><div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.04em">SERVICE BUNDLE</div>${(op.items||[]).map((it,j)=>`<div style="display:flex;gap:5px;margin:4px 0;flex-wrap:wrap"><select onchange="o_setItem(${i},${j},'type',this.value)" style="flex:0 0 90px;border:1px solid var(--line-2);border-radius:6px;padding:4px;font:inherit;font-size:11.5px">${BUNDLE_TYPES.map(t=>`<option ${it.type===t?'selected':''}>${t}</option>`).join('')}</select><input value="${esc(it.detail||'')}" oninput="o_setItem(${i},${j},'detail',this.value)" placeholder="detail / vendor / pax" style="flex:1;min-width:80px;border:1px solid var(--line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:11.5px"><input value="${esc(it.price||'')}" oninput="o_setItem(${i},${j},'price',this.value)" placeholder="price" style="flex:0 0 60px;border:1px solid var(--line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:11.5px"><span onclick="o_delItem(${i},${j})" style="cursor:pointer;color:#F0453A;align-self:center">✕</span></div>`).join('')}<button class="btn sm" onclick="o_addItem(${i})">+ Add service</button>
       <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.04em;margin-top:8px">🎁 FREEBIES — complimentary to client ($0), internal cost tracked</div>${(op.freebies||[]).map((fb,j)=>`<div style="display:flex;gap:5px;margin:4px 0"><input value="${esc(fb.label||'')}" oninput="o_setFreebie(${i},${j},'label',this.value)" placeholder="e.g. airport transfer / upgrade" style="flex:1;border:1px solid var(--line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:11.5px"><input value="${esc(fb.cost||'')}" oninput="o_setFreebie(${i},${j},'cost',this.value)" placeholder="our cost" style="flex:0 0 64px;border:1px solid var(--line-2);border-radius:6px;padding:4px 6px;font:inherit;font-size:11.5px"><span onclick="o_delFreebie(${i},${j})" style="cursor:pointer;color:#F0453A;align-self:center">✕</span></div>`).join('')}<button class="btn sm" onclick="o_addFreebie(${i})">+ Add freebie</button>${optFreebieCost(op)?`<div style="font-size:11px;color:var(--muted);margin-top:4px">Freebie internal cost: ${optFreebieCost(op).toLocaleString()} ${esc(o.currency||'')} — reduces margin</div>`:''}</div>
       <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><b>Option total: ${optTotal(op).toLocaleString()} ${esc(o.currency||'')}</b><button class="btn sm danger" onclick="o_delOption(${i})">Remove</button></div></div>`).join('')}</div>
     <button class="btn sm" onclick="o_addOption()">+ Add fare option</button></details>
     <details ${__ofO.deal?'open':''} ontoggle="__ofO.deal=this.open"><summary style="cursor:pointer;font-weight:800;font-size:14px;margin-top:14px;color:var(--ink)">Deal, workflow &amp; compliance</summary>
     <div class="grid2"><div class="field"><label>Status</label><select onchange="o_set('status',this.value);offerEditor(document.getElementById('view'),'${o.id}')">${OFFER_STATUS.map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Valid until (expiry)</label><input type="date" value="${esc(o.validUntil||'')}" oninput="o_set('validUntil',this.value);offerEditor(document.getElementById('view'),'${o.id}')"></div></div>
     <div class="grid2"><div class="field"><label>Ticket time limit (TTL)</label><input value="${esc(o.ttl||'')}" oninput="o_set('ttl',this.value)" placeholder="10 Jan 18:00"></div><div class="field"><label>Version</label><input value="${esc(o.version||1)}" oninput="o_set('version',this.value)"></div></div>
     <div class="field"><label>Link to lead / client (auto-log on send)</label><select onchange="o_set('linkedLeadId',this.value)"><option value="">— none —</option>${DB.businesses.map(b=>`<option value="${b.id}" ${o.linkedLeadId===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
     <div class="grid2"><div class="field"><label>Travel policy</label><select onchange="o_set('policyStatus',this.value)">${POLICY_STATUS.map(s=>`<option ${o.policyStatus===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Approval</label><select onchange="o_set('approvalStatus',this.value)">${APPROVAL_STATUS.map(s=>`<option ${o.approvalStatus===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
     <div class="field"><label>Out-of-policy reason</label><input value="${esc(o.policyReason||'')}" oninput="o_set('policyReason',this.value)"></div>
     <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div class="field"><label>ADT</label><input type="number" value="${o.paxAdt||0}" oninput="o_set('paxAdt',this.value);offerEditor(document.getElementById('view'),'${o.id}')"></div><div class="field"><label>CHD</label><input type="number" value="${o.paxChd||0}" oninput="o_set('paxChd',this.value)"></div><div class="field"><label>INF</label><input type="number" value="${o.paxInf||0}" oninput="o_set('paxInf',this.value)"></div></div>
     <div class="field"><label>Win / lose reason (on Accepted/Rejected)</label><input value="${esc(o.winLoseReason||'')}" oninput="o_set('winLoseReason',this.value)"></div>
     <div style="margin-top:6px"><button class="btn sm" onclick="o_logToLead()">⤷ Log this offer to the linked lead</button></div>
     </details><details ${__ofO.rules?'open':''} ontoggle="__ofO.rules=this.open"><summary style="cursor:pointer;font-weight:800;font-size:14px;margin-top:14px;color:var(--ink)">Fare rules</summary>
     <div class="grid2">${F('changesBefore','Changes — before')}${F('changesAfter','Changes — after')}</div>
     <div class="grid2">${F('cancelBefore','Cancellation — before')}${F('cancelAfter','Cancellation — after')}</div>
     <div class="grid2">${F('noShow','No-show fees')}${F('baggage','Baggage allowance')}</div>
     <div class="grid2">${F('lastIssue','Last issue date')}${F('cheapest','Cheapest fare?')}</div>
     <div class="grid2">${F('minStay','Min stay')}${F('maxStay','Max stay')}</div>
     <div class="field"><label>Remarks</label><textarea id="of_remarks" rows="2" oninput="o_set('remarks',this.value)">${esc(o.remarks||'')}</textarea></div>
     <div class="field"><label>Additional fees</label><textarea id="of_addFees" rows="2" oninput="o_set('addFees',this.value)">${esc(o.addFees||'')}</textarea></div>
     </details><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" onclick="o_copyText()">⧉ Copy for WhatsApp / Email</button><button class="btn" onclick="o_download()">⭳ Download</button><button class="btn" onclick="o_print()">🖨 Print / PDF</button><button class="btn danger" onclick="o_del('${o.id}')">Delete</button></div>
   </div>
   <div class="offer-preview"><div class="ch-sub" style="margin-bottom:8px">Live preview — this is what the client sees</div><div id="offerDoc">${offerHTML(o)}</div></div>
  </div>`;
}
function offerHTML(o){const cur=esc(o.currency||'SAR');const c=v=>esc(v||'—');
  return `<div class="odoc"><div class="odoc-head"><img src="${logoSrc()}" style="height:34px;background:#fff;border-radius:7px;padding:5px 8px"><div style="text-align:right"><div style="font-weight:800;font-size:16px;color:var(--ink)">Quotation · عرض سعر</div><div style="font-size:11px;color:var(--muted)">Ref ${c(o.ref)} · ${c(o.date)}</div></div></div>
  <div class="odoc-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${offerStatusBadge(o)}${o.validUntil?`<span class="tag" style="background:${offerExpiry(o).color}1a;color:${offerExpiry(o).color}">${offerExpiry(o).label}</span>`:''}${o.ttl?`<span class="tag" style="background:#F7900918;color:#9A560F">TTL ${c(o.ttl)}</span>`:''}${o.policyStatus&&o.policyStatus!=='Not checked'?`<span class="tag" style="background:${o.policyStatus==='In-policy'?'#16B364':'#F0453A'}1a;color:${o.policyStatus==='In-policy'?'#16B364':'#F0453A'}">${c(o.policyStatus)}</span>`:''}${o.approvalStatus&&o.approvalStatus!=='Not required'?`<span class="tag" style="background:#7A5AF81a;color:#7A5AF8">Approval: ${c(o.approvalStatus)}</span>`:''}${(o.version&&o.version!=1)?`<span class="tag">v${c(o.version)}</span>`:''}</div>
  <div class="odoc-row"><b>Client:</b> ${c(o.client)} &nbsp;&nbsp; <b>Passenger:</b> ${c(o.subject)}</div>
  <div class="odoc-row"><b>Airline:</b> ${c(o.airline)} &nbsp;&nbsp; <b>Class:</b> ${c(o.cls)} &nbsp;&nbsp; <b>Route:</b> ${c(o.route)}</div>
  ${o.flight?`<div class="odoc-row"><b>Flight:</b> ${c(o.flight)}</div>`:''}
  <table class="odoc-tbl"><thead><tr><th>Ticket price</th><th>Partner's fees</th><th>Service fees</th><th>VAT</th><th>DIP</th><th>Total</th></tr></thead><tbody><tr><td>${c(o.ticketPrice)}</td><td>${c(o.partnerFees)}</td><td>${c(o.serviceFees)}</td><td>${c(o.vat)}</td><td>${c(o.dip)}</td><td style="font-weight:800;color:var(--orange)">${c(o.total)} ${cur}</td></tr></tbody></table>
  ${offerPax(o)>1?`<div class="odoc-row" style="font-size:12px;color:#555">Total for ${offerPax(o)} pax · ≈ ${Math.round(onum(o.total)/offerPax(o)).toLocaleString()} ${cur}/pax (${o.paxAdt||0} ADT · ${o.paxChd||0} CHD · ${o.paxInf||0} INF)</div>`:''}
  ${(o.options&&o.options.length)?`<div style="font-weight:700;margin:12px 0 4px;color:var(--ink)">Compare fare options</div><table class="odoc-tbl"><thead><tr><th>Option</th><th>Source</th><th>Base</th><th>Taxes</th><th>Anc.</th><th>Fee</th><th>Total</th><th>Refund</th><th>Baggage</th><th>Includes</th></tr></thead><tbody>${o.options.map(op=>`<tr><td><b>${c(op.label)}</b>${op.fareFamily?'<br><span style="font-size:11px;color:#888">'+c(op.fareFamily)+'</span>':''}</td><td>${c(op.provider)}${op.content&&op.content!=='—'?' <span style="font-size:10px;background:#eef;color:#436;padding:1px 5px;border-radius:6px">'+c(op.content)+'</span>':''}</td><td>${c(op.base)}</td><td>${c(op.taxes)}</td><td>${c(op.anc)}</td><td>${c(op.fee)}</td><td style="font-weight:800;color:var(--orange)">${optTotal(op).toLocaleString()} ${cur}</td><td>${c(op.refundable)}</td><td>${c(op.baggage)}</td><td style="font-size:11px">${[...(op.items||[]).map(it=>esc(it.type)+(it.detail?' '+esc(it.detail):'')+(it.price?' ('+esc(it.price)+')':'')),...(op.freebies||[]).map(fb=>'🎁 '+esc(fb.label||'')+' (free)')].join('<br>')||'—'}</td></tr>`).join('')}</tbody></table>`:''}
  <table class="odoc-tbl"><tbody>
    <tr><td class="k">Changes</td><td>Before: ${c(o.changesBefore)}</td><td>After: ${c(o.changesAfter)}</td></tr>
    <tr><td class="k">Cancellation</td><td>Before: ${c(o.cancelBefore)}</td><td>After: ${c(o.cancelAfter)}</td></tr>
    <tr><td class="k">No-show</td><td colspan="2">${c(o.noShow)}</td></tr>
    <tr><td class="k">Baggage</td><td colspan="2">${c(o.baggage)}</td></tr>
    <tr><td class="k">Last issue</td><td>${c(o.lastIssue)}</td><td>Cheapest fare: ${c(o.cheapest)}</td></tr>
    <tr><td class="k">Min / Max stay</td><td colspan="2">${c(o.minStay)} / ${c(o.maxStay)}</td></tr>
  </tbody></table>
  ${o.remarks?`<div class="odoc-row"><b>Remarks:</b> ${c(o.remarks)}</div>`:''}
  ${o.addFees?`<div class="odoc-note"><b>Additional fees:</b> ${c(o.addFees)}</div>`:''}
  <div class="odoc-foot">${c(o.owner)} · ${brandName()} · payments.directksa.com<br></div></div>`;
}
function offerText(o){const c=o.currency||'SAR';const L=[];
  L.push('*Direct Business — Quotation / عرض سعر*');L.push('Ref '+(o.ref||'')+' · '+(o.date||''));L.push('Status: '+(o.status||'Draft')+(o.validUntil?(' · '+offerExpiry(o).label):'')+(o.ttl?(' · TTL '+o.ttl):''));L.push('');
  if(o.client)L.push('Client: '+o.client);if(o.subject)L.push('Passenger: '+o.subject);
  if(o.airline||o.cls)L.push('Airline: '+(o.airline||'')+(o.cls?(' · '+o.cls):''));if(o.route)L.push('Route: '+o.route);if(o.flight)L.push('Flight: '+o.flight);
  L.push('');L.push('— Pricing ('+c+') —');
  [['Ticket price',o.ticketPrice],["Partner's fees",o.partnerFees],['Service fees',o.serviceFees],['VAT',o.vat],['DIP',o.dip]].forEach(function(p){if(p[1])L.push(p[0]+': '+p[1]);});
  L.push('*Total: '+(o.total||'')+' '+c+'*');if(offerPax(o)>1)L.push('('+offerPax(o)+' pax · '+Math.round(onum(o.total)/offerPax(o)).toLocaleString()+' '+c+'/pax)');
  if(o.options&&o.options.length){L.push('');L.push('— Compare options —');o.options.forEach(function(op){L.push('• '+(op.label||'')+(op.provider?(' ['+op.provider+(op.content&&op.content!=='—'?'/'+op.content:'')+']'):'')+': '+optTotal(op).toLocaleString()+' '+c+(op.refundable?(' · '+op.refundable+' refund'):''));});}
  L.push('');L.push('— Fare rules —');
  L.push('Changes: before '+(o.changesBefore||'-')+' / after '+(o.changesAfter||'-'));
  L.push('Cancellation: before '+(o.cancelBefore||'-')+' / after '+(o.cancelAfter||'-'));
  if(o.noShow)L.push('No-show: '+o.noShow);if(o.baggage)L.push('Baggage: '+o.baggage);
  if(o.lastIssue)L.push('Last issue date: '+o.lastIssue);L.push('Cheapest fare: '+(o.cheapest||''));
  if(o.remarks)L.push('Remarks: '+o.remarks);if(o.addFees){L.push('');L.push('Additional fees: '+o.addFees);}
  L.push('');L.push((o.owner||'')+' · '+brandName());
  return L.join('\n');
}
function o_copyText(){const o=curOffer();if(!o)return;const t=offerText(o);if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){alert('Offer copied — paste into WhatsApp or email.');},function(){prompt('Copy the offer:',t);});}else{prompt('Copy the offer:',t);}}
function o_styleBlock(){return '<style>:root{--orange:#FF6B00;--orange-2:#FF9D45;--ink:#1C1E2B;--muted:#7C8194;--line:#EEE8DE}body{font-family:Inter,Arial,sans-serif;background:#fff;padding:24px;color:#1C1E2B}.odoc-head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF6B00;padding-bottom:12px;margin-bottom:14px}.odoc-row{font-size:13px;margin:7px 0;color:#33384a}.odoc-tbl{width:100%;border-collapse:collapse;margin:12px 0;font-size:12.5px}.odoc-tbl th,.odoc-tbl td{border:1px solid #e2ddd2;padding:8px 9px;text-align:left}.odoc-tbl th{background:#faf7f2}.odoc-tbl .k{font-weight:700;background:#faf7f2;width:130px}.odoc-note{background:#FFF1E6;border:1px solid #FBD9B8;color:#9A560F;padding:10px;border-radius:8px;font-size:12px;margin-top:10px}.odoc-foot{margin-top:14px;border-top:1px solid #eee;padding-top:9px;font-size:11px;color:#888}</style>';}
function o_download(){const o=curOffer();if(!o)return;const html='<!DOCTYPE html><meta charset="utf-8"><title>Offer '+(o.ref||'')+'</title>'+o_styleBlock()+'<body>'+offerHTML(o)+'</body>';const b=new Blob([html],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='Offer-'+(o.ref||'direct')+'.html';a.click();}
function o_print(){const o=curOffer();if(!o)return;const w=window.open('','_blank');if(!w)return;w.document.write('<!DOCTYPE html><meta charset="utf-8"><title>Offer '+(o.ref||'')+'</title>'+o_styleBlock()+'<body>'+offerHTML(o)+'</body>');w.document.close();w.focus();setTimeout(function(){w.print();},250);}
function o_del(id){if(confirm('Delete this offer?')){DB.offers=(DB.offers||[]).filter(x=>x.id!==id);openOffer=null;save();render();}}
/* Proposal file library — the file itself lives in the app (Supabase storage bucket "proposals"). */
window.o_uploadFile=function(id){
  var o=(DB.offers||[]).find(function(x){return x.id===id;});if(!o)return;
  var inp=document.getElementById('o_file'),msg=document.getElementById('o_fileMsg');
  var f=inp&&inp.files&&inp.files[0];if(!f)return;
  var _ar=(typeof LANG!=='undefined'&&LANG==='ar');
  if(!/\.(pdf|png|jpe?g|docx|xlsx)$/i.test(f.name)){if(msg)msg.textContent=_ar?'الأنواع المقبولة: PDF · صور · Word · Excel.':'Accepted types: PDF, images, Word, Excel.';inp.value='';return;}
  if(f.size>25*1024*1024){if(msg)msg.textContent=_ar?'الملف أكبر من 25MB.':'File is larger than 25MB.';return;}
  if(msg)msg.textContent=_ar?'جارٍ الرفع…':'Uploading…';
  var c=window.supabase.createClient();
  var path=(o.ref||o.id).replace(/[^\w.\-]+/g,'_')+'/'+Date.now()+'-'+f.name.replace(/[^\w.\-؀-ۿ]+/g,'_');
  c.storage.from('proposals').upload(path,f,{upsert:true}).then(function(r){
    if(r.error){if(msg)msg.textContent=(_ar?'فشل الرفع: ':'Upload failed: ')+r.error.message;return;}
    var pub=c.storage.from('proposals').getPublicUrl(path);
    o.fileUrl=(pub&&pub.data&&pub.data.publicUrl)||'';o.fileName=f.name;o.filePath=path;save();
    offerEditor(document.getElementById('view'),o.id);
    if(typeof toast==='function')toast(_ar?'تم حفظ الملف في مكتبة العروض':'File saved to the proposal library');
  }).catch(function(e){if(msg)msg.textContent='Upload failed: '+e;});
};
window.o_removeFile=function(id){
  var o=(DB.offers||[]).find(function(x){return x.id===id;});if(!o)return;
  var _ar=(typeof LANG!=='undefined'&&LANG==='ar');
  if(!confirm(_ar?'إزالة الملف من هذا العرض؟':'Remove the file from this proposal?'))return;
  var p=o.filePath;
  o.fileUrl='';o.fileName='';o.filePath='';save();
  if(p){try{window.supabase.createClient().storage.from('proposals').remove([p]).then(function(){});}catch(_e){}}
  offerEditor(document.getElementById('view'),id);
};

/* Branded proposal generator — pours a proposal record into a Direct-branded, bilingual,
   print-ready document (browser "Save as PDF"), using the real identity (docs/DIRECT_IDENTITY.md).
   Design/identity of the document is v1 here; refine the template over time. */
function o_genProposal(id){
  var o=(DB.offers||[]).find(function(x){return x.id===id;})||(typeof curOffer==='function'?curOffer():null); if(!o)return;
  var _b=(DB.businesses||[]).find(function(x){return x.id===o.linkedLeadId;});
  var esc=window.esc||function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  var AG=(typeof AGENCY!=='undefined')?AGENCY:{};
  var client=o.client||(_b&&_b.name)||'Client';
  var clientAr=(_b&&_b.nameAr)||'';
  var typeEn=o.proposalType||'Proposal';
  var typeAr=(typeof PROPOSAL_TYPES_AR!=='undefined'&&PROPOSAL_TYPES_AR[o.proposalType])||typeEn;
  var subject=o.subject||o.scope||typeEn;
  var scope=o.scope||'';
  var today=new Date().toISOString().slice(0,10);
  var ref=o.ref||''; var valid=o.validUntil||''; var cur=o.currency||'SAR';
  var vnum=Number(String(o.value||o.total||'').replace(/[^\d.]/g,'')); var val=vnum?vnum.toLocaleString('en-US'):'';
  var COL={grad1:'#E54525',grad2:'#F26721',orange:'#F06820',svcHead:'#F87020',gold:'#FBAE16',ink:'#303848',muted:'#6B7480',hair:'#E6E8EC',wash:'#F6F7F9',washO:'#FFF3EC'};
  var subjectAr=o.subjectAr||'';
  function row(k,ka,v){return v?('<tr><td class="k">'+esc(k)+'<span class="ka">'+esc(ka)+'</span></td><td class="v">'+esc(v)+'</td></tr>'):'';}
  var stats=[['2016','Founded · التأسيس'],['5','Branches · فروع'],['700K+','Visas issued · تأشيرات'],['17K+','Study-abroad students · مبتعث'],['2M+','App downloads · تحميلات'],['450+','Airline deals · اتفاقيات طيران'],['300+','Travel specialists · مختص سفر']];
  var whys=[['One accountable partner','شريك واحد مسؤول'],['Global supplier power, Saudi service','قوة موردين عالمية وخدمة سعودية'],['Transparent service-fee pricing','تسعير شفاف برسوم خدمة'],['Dedicated advisor · digital platform · 24/7','مستشار مخصص · منصة رقمية · دعم على مدار الساعة']];
  /* Scope lines become the signature numbered services table (the shape of Direct's real
     tender offers: جدول الكميات). One line in the Scope box = one service row. */
  var scopeLines=String(scope||'').split(/\n+/).map(function(s){return s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/,'').trim();}).filter(Boolean);
  /* How we start — condensed from the real technical offer's work plan & timeline. */
  var steps=[['Sign the agreement','توقيع الاتفاقية','Day 0','اليوم 0'],['Needs analysis + your dedicated travel advisor','تحليل الاحتياجات وتجهيز مستشار السفر المخصص','1–2 days','1–2 يوم'],['Free digital platform activated & linked','تفعيل المنصة الرقمية المجانية وربطها','1–3 weeks','1–3 أسابيع'],['Ongoing service & follow-up, 24/7','خدمة ومتابعة مستمرة على مدار الساعة','Life of contract','طوال مدة العقد']];
  /* The generated document mirrors Direct's REAL proposals (the HRC technical offer, the
     SGC proposal): a paged A4 document — orange-gradient COVER with the white logo,
     a "this proposal includes" CONTENTS page, content pages, and a gradient CLOSING page.
     On screen it previews like a PDF (grey desk, white sheets); printing gives one A4 PDF. */
  var rtl=(typeof LANG!=='undefined'&&LANG==='ar');
  var logo=(typeof logoSrc==='function'?logoSrc():'')||'';
  /* scope line syntax: "Service text | fee" → fee lands in the signature Fee column */
  var svcRows=scopeLines.map(function(s){var p=s.split('|');return {svc:p[0].trim(),fee:(p[1]||'').trim()};});
  var isMoney=(o.proposalType==='Financial bid'||o.proposalType==='Price offer');
  var toc=[['About Direct','عن دايركت']];
  if(svcRows.length)toc.push(['Scope of services','نطاق الخدمات']);
  toc.push(['Work plan','خطة العمل']);
  if(val||isMoney)toc.push(['Commercial summary','الملخص التجاري']);
  toc.push(['Why Direct','لماذا دايركت']);
  function pageHead(){return '<div class="phead"><img src="'+logo+'" class="plogo" alt="Direct"><span>Directksa.com</span></div>';}
  function secTitle(en,ar2){return '<div class="stitle"><b>'+esc(en)+'</b><i>'+esc(ar2)+'</i></div>';}
  var doc='<!DOCTYPE html><html lang="'+(rtl?'ar':'en')+'" dir="'+(rtl?'rtl':'ltr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc((typeEn+' — '+client))+'</title><style>'
   +'*{box-sizing:border-box}@page{size:A4;margin:0}'
   +'body{margin:0;background:#4B4F57;font-family:"Proxima Nova","Proxima Nova Alt","29LT Zarid Slab","Zarid Slab","Segoe UI",Tahoma,Arial,sans-serif;color:'+COL.ink+';line-height:1.55}'
   +'.page{width:210mm;min-height:296mm;margin:16px auto;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden;position:relative}'
   +'.grad{background:linear-gradient(150deg,'+COL.grad1+','+COL.grad2+');color:#fff}'
   +'.cover{justify-content:space-between;padding:20mm 18mm}'
   +'.wlogo{height:15mm;width:auto;align-self:flex-start;filter:brightness(0) invert(1)}'
   +'.closing .wlogo{align-self:center}'
   +'.ctype{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);padding:5px 16px;border-radius:22px;font-size:13px;font-weight:700;letter-spacing:.02em}'
   +'.ctitle{font-size:34px;font-weight:800;line-height:1.22;margin:14px 0 4px;max-width:150mm}'
   +'.ctitlear{font-size:20px;font-weight:700;opacity:.95;margin-bottom:18px}'
   +'.cfor{font-size:15px;opacity:.96}.cfor b{font-size:19px;display:block;margin-top:3px}'
   +'.ctag{margin-top:16mm;font-size:15px;font-weight:700}.ctag i{display:block;font-style:normal;font-size:13px;opacity:.9;font-weight:500}'
   +'.cmeta{display:flex;gap:11mm;font-size:12px;opacity:.95;border-top:1px solid rgba(255,255,255,.35);padding-top:6mm}'
   +'.cmeta b{display:block;font-size:13.5px;margin-top:2px}'
   +'.csite{position:absolute;top:20mm;'+(rtl?'left':'right')+':18mm;font-size:12.5px;font-weight:700;opacity:.95}'
   +'.phead{display:flex;justify-content:space-between;align-items:center;padding:10mm 18mm 0}'
   +'.phead .plogo{height:8mm}.phead span{font-size:11px;color:'+COL.muted+';font-weight:700}'
   +'.body{padding:8mm 18mm 14mm;flex:1}'
   +'.stitle{border-'+(rtl?'right':'left')+':4px solid '+COL.orange+';padding:2px 12px;margin-bottom:8mm}'
   +'.stitle b{display:block;font-size:23px;font-weight:800;color:'+COL.ink+'}'
   +'.stitle i{font-style:normal;font-size:15px;color:'+COL.orange+';font-weight:700}'
   +'.toc{list-style:none;margin:0;padding:0}'
   +'.toc li{display:flex;align-items:center;gap:7mm;padding:7mm 0;border-bottom:1px solid '+COL.hair+';font-size:17px;font-weight:700}'
   +'.toc li i{font-style:normal;color:'+COL.muted+';font-weight:500;font-size:14.5px;margin-'+(rtl?'right':'left')+':auto}'
   +'.toc .n{flex:0 0 12mm;height:12mm;border-radius:50%;background:'+COL.washO+';color:'+COL.orange+';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800}'
   +'.stats{display:flex;flex-wrap:wrap;gap:6mm 10mm;background:'+COL.washO+';border-radius:12px;padding:8mm 9mm;margin-top:7mm}'
   +'.stat b{display:block;font-size:23px;font-weight:800;color:'+COL.orange+'}.stat span{font-size:10.5px;color:'+COL.muted+'}'
   +'.about{font-size:13.5px;color:#3a4250;max-width:160mm}'
   +'table.svc{width:100%;border-collapse:collapse;margin-top:2mm}'
   +'table.svc thead th{background:'+COL.svcHead+';color:#fff;text-align:'+(rtl?'right':'left')+';font-size:12.5px;padding:9px 13px;font-weight:700}'
   +'table.svc td{padding:9px 13px;border-bottom:1px solid '+COL.hair+';font-size:13px}'
   +'table.svc tbody tr:nth-child(even){background:'+COL.wash+'}'
   +'table.svc td.n{color:'+COL.orange+';font-weight:800;width:9mm}'
   +'table.svc td.fee{color:'+COL.orange+';font-weight:800;white-space:nowrap;width:26mm}'
   +'.tnote{font-size:11px;color:'+COL.muted+';margin-top:4mm}'
   +'.plan{counter-reset:st;margin-top:2mm}'
   +'.pstep{display:flex;gap:6mm;padding:6mm 0;border-bottom:1px solid '+COL.hair+'}'
   +'.pstep .n{flex:0 0 11mm;height:11mm;border-radius:50%;background:'+COL.washO+';color:'+COL.orange+';display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px}'
   +'.pstep b{display:block;font-size:14.5px}.pstep i{font-style:normal;display:block;font-size:12.5px;color:'+COL.muted+'}'
   +'.pstep .when{font-size:11px;color:'+COL.gold+';font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-top:2mm}'
   +'.why{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:2mm}'
   +'.why div{background:'+COL.wash+';border-'+(rtl?'right':'left')+':3px solid '+COL.orange+';border-radius:8px;padding:5mm 6mm;font-size:13px;font-weight:700}'
   +'.why div span{display:block;font-size:12px;color:'+COL.muted+';font-weight:400;margin-top:1mm}'
   +'.val{font-size:27px;font-weight:800;color:'+COL.orange+';margin-bottom:4mm}'
   +'table.kv{width:100%;border-collapse:collapse;border:1px solid '+COL.hair+'}'
   +'table.kv td{padding:9px 13px;border-bottom:1px solid '+COL.hair+';font-size:13px}'
   +'table.kv td.k{color:'+COL.muted+';width:52%}table.kv td.k .ka{display:block;font-size:11px;color:#aeb4c0}'
   +'table.kv td.v{font-weight:700}'
   +'.note{font-size:11.5px;color:'+COL.muted+';background:'+COL.wash+';border-radius:8px;padding:5mm 6mm;margin-top:5mm}'
   +'.closing{justify-content:center;align-items:center;text-align:center;padding:20mm}'
   +'.closing .tg{font-size:24px;font-weight:800;margin-top:10mm}.closing .tga{font-size:17px;opacity:.94;margin-top:2mm}'
   +'.closing .ct{margin-top:14mm;font-size:13px;opacity:.96;line-height:2}'
   +'.pbar{position:fixed;top:10px;'+(rtl?'left':'right')+':14px;z-index:9}.pbar button{background:'+COL.orange+';color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font-family:inherit}'
   +'@media print{body{background:#fff}.page{margin:0;box-shadow:none;min-height:auto;height:296mm;page-break-after:always}.page:last-child{page-break-after:auto}.pbar{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}table.svc tr,.pstep{page-break-inside:avoid}}'
   +'</style></head><body>'
   +'<div class="pbar"><button onclick="window.print()">🖨 '+(rtl?'حفظ PDF':'Save as PDF')+'</button></div>'
   /* ---- Page 1 · cover ---- */
   +'<div class="page grad cover"><div class="csite">Directksa.com</div>'
   +'<img src="'+logo+'" class="wlogo" alt="Direct">'
   +'<div><div class="ctype">'+esc(typeEn)+' · '+esc(typeAr)+'</div>'
   +'<div class="ctitle">'+esc(subject)+'</div>'
   +(subjectAr?('<div class="ctitlear">'+esc(subjectAr)+'</div>'):'')
   +'<div class="cfor">Prepared for · أُعدّ لـ<b>'+esc(client)+(clientAr?(' · '+esc(clientAr)):'')+'</b></div>'
   +'<div class="ctag">Global supplier power. Saudi service. One partner.<i>قوة موردين عالمية. خدمة سعودية. شريك واحد.</i></div></div>'
   +'<div class="cmeta"><div>Date · التاريخ<b>'+esc(today)+'</b></div>'+(ref?('<div>Ref · المرجع<b>'+esc(ref)+'</b></div>'):'')+(valid?('<div>Valid until · صالح حتى<b>'+esc(valid)+'</b></div>'):'')+'</div></div>'
   /* ---- Page 2 · contents ---- */
   +'<div class="page">'+pageHead()+'<div class="body">'+secTitle('This proposal includes','يشمل هذا العرض الآتي')
   +'<ul class="toc">'+toc.map(function(t,i){return '<li><span class="n">'+(i+1)+'</span>'+esc(t[0])+'<i>'+esc(t[1])+'</i></li>';}).join('')+'</ul></div></div>'
   /* ---- Page 3 · about ---- */
   +'<div class="page">'+pageHead()+'<div class="body">'+secTitle('About Direct','عن دايركت')
   +'<p class="about">Direct is a Saudi company specialising in travel, tourism and study abroad (est. 2016, Riyadh). One digital platform and a dedicated travel advisor cover flights, hotels, visas for 35+ countries, study abroad across 1,500+ institutes, transfers and VIP services — serving government and private clients with a 24/7 service centre.</p>'
   +'<p class="about" style="color:'+COL.muted+'">دايركت شركة سعودية متخصصة في خدمات السفر والسياحة والدراسة بالخارج. منصة رقمية واحدة ومستشار سفر مخصص يغطيان الطيران والفنادق والتأشيرات والتنقلات وخدمات كبار الشخصيات — بخدمة عملاء على مدار الساعة.</p>'
   +'<div class="stats">'+stats.map(function(s){return '<div class="stat"><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div>';}).join('')+'</div>'
   +'<p class="about" style="margin-top:7mm;font-size:12px;color:'+COL.muted+'">Awards · World Travel Awards (Best Travel &amp; Tourism Company in KSA) · International Travel Awards — Best Visa Agency 2024 · Great Place to Work · ICEF-accredited.</p>'
   +'</div></div>'
   /* ---- Page 4 · scope (signature table) ---- */
   +(svcRows.length?('<div class="page">'+pageHead()+'<div class="body">'+secTitle('Scope of services','نطاق الخدمات')
     +'<table class="svc"><thead><tr><th>#</th><th>Service · الخدمة</th><th>Fee · الرسوم</th></tr></thead><tbody>'
     +svcRows.map(function(r,i){return '<tr><td class="n">'+(i+1)+'</td><td>'+esc(r.svc)+'</td><td class="fee">'+(r.fee?esc(r.fee):'—')+'</td></tr>';}).join('')
     +'</tbody></table>'
     +'<div class="tnote">'+(isMoney?'Fees are Direct’s service fee per transaction, excluding VAT and supplier cost unless a row says Total. · الرسوم هي رسوم خدمة دايركت لكل عملية، غير شاملة الضريبة وتكلفة المورد ما لم يُذكر.':'Prices are provided in the separate financial offer. · تُقدَّم الأسعار في العرض المالي المنفصل.')+'</div>'
     +'</div></div>'):'')
   /* ---- Page 5 · work plan + commercial + why ---- */
   +'<div class="page">'+pageHead()+'<div class="body">'+secTitle('Work plan','خطة العمل')
   +'<div class="plan">'+steps.map(function(s,i){return '<div class="pstep"><span class="n">'+(i+1)+'</span><div><b>'+esc(s[0])+'</b><i>'+esc(s[1])+'</i><div class="when">'+esc(s[2])+' · '+esc(s[3])+'</div></div></div>';}).join('')+'</div>'
   +((val||isMoney)?('<div style="margin-top:9mm">'+secTitle('Commercial summary','الملخص التجاري')
     +(val?('<div class="val">'+esc(val)+' '+esc(cur)+'</div>'):'')
     +'<table class="kv"><tbody>'
     +row('Proposal type','نوع العرض',typeEn+' · '+typeAr)
     +(val?row('Estimated value','القيمة التقديرية',val+' '+cur):'')
     +row('Valid until','صالح حتى',valid)
     +row('Reference','المرجع',ref)
     +'</tbody></table>'
     +'<div class="note">This is a commercial proposal — not a tax invoice. Each payment = Direct’s contracted service fee + the cost of the requested service, excluding VAT unless stated. Tax invoices are issued through Direct Payments.<br>هذا عرض تجاري وليس فاتورة ضريبية. كل دفعة = رسوم الخدمة التعاقدية + تكلفة الخدمة المطلوبة، غير شاملة الضريبة ما لم يُذكر. تصدر الفواتير الضريبية عبر دايركت للمدفوعات.</div></div>'):'')
   +'<div style="margin-top:9mm">'+secTitle('Why Direct','لماذا دايركت')
   +'<div class="why">'+whys.map(function(w){return '<div>'+esc(w[0])+'<span>'+esc(w[1])+'</span></div>';}).join('')+'</div></div>'
   +'</div></div>'
   /* ---- Page 6 · closing ---- */
   +'<div class="page grad closing">'
   +'<img src="'+logo+'" class="wlogo" alt="Direct">'
   +'<div class="tg">One accountable partner.</div><div class="tga">شريك واحد مسؤول.</div>'
   +'<div class="ct">Directksa.com · Riyadh, Saudi Arabia · الرياض، المملكة العربية السعودية<br>App: Direct | دايركت — Google Play &amp; App Store'+(AG&&AG.vat?('<br>VAT '+esc(AG.vat)):'')+(AG&&AG.iban?(' · IBAN '+esc(AG.iban)):'')+'</div>'
   +'</div>'
   +'</body></html>';
  var w=window.open('','_blank'); if(!w){if(typeof toast==='function')toast('Allow pop-ups to open the proposal');return;}
  w.document.write(doc); w.document.close(); w.focus(); setTimeout(function(){try{w.print();}catch(_){}} ,350);
}

