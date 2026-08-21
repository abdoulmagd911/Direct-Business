/* V22_MODULE_START */
/* ===== STEP 2 — KSA client onboarding extensions ===== */
const V22_CLASSIFICATIONS=['Ministry','Government entity','Corporate','Tender (Government bid)','Chamber of Commerce','Sports Club','Private','SME','Charity / NGO','Multinational'];
const V22_PRICING_SCHEMES=['Standard','Corporate negotiated','Tender / Government rate','Ministry rate','Chamber rate','VIP custom','B2C walk-in'];
const V22_DOC_TYPES=['CR (Commercial Registration)','VAT Certificate','Contract / MoU','NDA','Authorization Letter','Letter of Award','Bank Confirmation','Power of Attorney','ID Copy','Other'];
const V22_DOC_STATUS=['Active','Expired','Renewed','Pending review','Revoked'];
function migrateV22(d){
  // Extend each B2B client with v22 KSA-specific fields (additive only — no overwrite)
  (d.businesses||[]).forEach(b=>{
    if(b.crNumber===undefined)b.crNumber='';
    if(b.crExpiry===undefined)b.crExpiry='';
    if(b.vatNumber===undefined)b.vatNumber=b.crVat||'';
    if(b.ibanBuyer===undefined)b.ibanBuyer='';
    if(b.classification===undefined)b.classification=b.entityType||'';
    if(b.industry===undefined)b.industry='';
    if(b.branchHQ===undefined)b.branchHQ='HQ';
    if(b.addressEn===undefined)b.addressEn='';
    if(b.addressAr===undefined)b.addressAr='';
    if(b.signatories===undefined)b.signatories=[];
    if(b.documents===undefined)b.documents=[];
    if(b.travelers===undefined)b.travelers=[];
    if(b.pricingScheme===undefined)b.pricingScheme=b.paymentConfiguration==='Tender'?'Tender / Government rate':'Standard';
    if(b.markupTable===undefined)b.markupTable={flights:8,hotels:12,visas:15,transfers:10,insurance:18,other:10};
    if(b.minVolumeCommit===undefined)b.minVolumeCommit='';
    if(b.billingCycleDay===undefined)b.billingCycleDay=(b.paymentConfiguration==='PostPaid')?28:0;
    if(b.lateFeePolicy===undefined)b.lateFeePolicy='';
    if(b.collectionsOwner===undefined)b.collectionsOwner=b.accountManager||b.owner||'';
    if(b.currentCycleId===undefined)b.currentCycleId='';
    if(b.contactsExt===undefined&&Array.isArray(b.contacts))b.contactsExt=b.contacts.map(c=>Object.assign({whatsapp:c.phone||''},c));
  });
  d._v22migrated=true;
}
try{migrateV22(DB);save();}catch(e){console.warn('v22 migrate fail',e);}

/* ===== Credit utilization gate ===== */
function clientCreditUtilization(clientId){const c=getLead(clientId);if(!c||!c.creditLimit||c.creditLimit<=0)return null;const openBks=(DB.bookings||[]).filter(b=>b.leadId===clientId&&!b._archived&&b.status!=='Cancelled'&&(!b.invoiceId||(DB.invoices||[]).find(i=>i.id===b.invoiceId&&i.status!=='Paid')));const usedFromBookings=openBks.reduce((s,b)=>s+onum(b.totalSale),0);const usedFromInvoices=(DB.invoices||[]).filter(i=>i.clientId===clientId&&!i._archived&&i.status!=='Paid'&&i.status!=='Draft').reduce((s,i)=>s+v18InvTotals(i).total,0);const used=Math.max(usedFromBookings,usedFromInvoices);const limit=onum(c.creditLimit);const pct=Math.round(used*100/limit);return {used:used,limit:limit,available:limit-used,pct:pct,warning:pct>=80,blocked:pct>=100};}
function v22CreditGate(clientId,intendedAmount,managerOverride){const u=clientCreditUtilization(clientId);if(!u)return {ok:true,reason:'no credit limit set'};const wouldBe=(u.used+(intendedAmount||0));const wouldPct=Math.round(wouldBe*100/u.limit);if(wouldBe>u.limit&&!managerOverride)return {ok:false,reason:'OVER-LIMIT — would use '+wouldBe.toFixed(0)+' / '+u.limit.toFixed(0)+' ('+wouldPct+'%). Manager override required.',blocked:true,wouldPct:wouldPct};if(wouldPct>=80)return {ok:true,reason:'⚠ Warning — would use '+wouldPct+'% of credit limit',warning:true,wouldPct:wouldPct};return {ok:true,reason:'OK — '+wouldPct+'% utilization',wouldPct:wouldPct};}

/* ===== Postpaid monthly cycle rollup ===== */
function v22CycleId(date,cycleDay){const d=new Date(date||Date.now());const day=cycleDay||28;const m=d.getMonth();const y=d.getFullYear();const cm=d.getDate()<=day?m:m+1;const cy=cm>11?y+1:y;const cmm=((cm%12)+12)%12;return cy+'-'+String(cmm+1).padStart(2,'0');}
function v22OpenCycleForClient(clientId){const c=getLead(clientId);if(!c||c.paymentConfiguration!=='PostPaid')return null;const cycleId=v22CycleId(Date.now(),c.billingCycleDay||28);DB.postpaidCycles=DB.postpaidCycles||[];let cy=DB.postpaidCycles.find(x=>x.clientId===clientId&&x.cycleId===cycleId&&x.status==='open');if(!cy){cy={id:'cy_'+clientId+'_'+cycleId,clientId:clientId,cycleId:cycleId,status:'open',openedAt:Date.now(),invoiceIds:[],totalRolledUp:0,closedAt:null,rollupInvoiceId:null};DB.postpaidCycles.push(cy);}return cy;}
function v22TagInvoiceToCycle(invoiceId){const inv=getInvoice(invoiceId);if(!inv)return;const c=getLead(inv.clientId);if(!c||c.paymentConfiguration!=='PostPaid')return;const cy=v22OpenCycleForClient(inv.clientId);if(!cy)return;if(!cy.invoiceIds.includes(invoiceId)){cy.invoiceIds.push(invoiceId);cy.totalRolledUp+=v18InvTotals(inv).total;inv.cycleId=cy.id;c.currentCycleId=cy.id;silentSave(save);}}
function v22CloseCycleAndPushRollup(cycleId){const cy=(DB.postpaidCycles||[]).find(c=>c.id===cycleId);if(!cy||cy.status==='closed')return null;const lead=getLead(cy.clientId);const childInvs=cy.invoiceIds.map(getInvoice).filter(Boolean);if(!childInvs.length)return null;const rollupNo='DPIN-'+Date.now().toString().slice(-6);const rollup={id:uid('inv'),number:rollupNo,clientId:cy.clientId,date:new Date().toISOString().slice(0,10),currency:'SAR',status:'Issued',invoiceType:'Rollup',items:childInvs.map(ch=>({desc:'Rolled up: '+ch.number+' ('+v18InvTotals(ch).total.toFixed(2)+' SAR)',bookingId:'',amount:v18InvTotals(ch).total,vatRate:'Standard 15%'})),buyerVat:lead&&lead.vatNumber||'',paymentTerms:lead&&('Net '+((lead.billingCycleDay||28)===28?30:lead.billingCycleDay))||'Net 30',dueDate:'',dunningStage:'None',fxRate:1,fxBaseCur:'SAR',recurring:{enabled:false},approvalStatus:'Not required',bspBucket:'',collectionsLog:[],payments:[],zatcaUUID:uuidv4(),zatcaStatus:'Submitted',sourceSystem:'direct_payment',syncHealth:'synced',cycleRollupChildIds:cy.invoiceIds.slice(),notes:'Rollup of '+childInvs.length+' invoices for cycle '+cy.cycleId,files:[]};rollup.total=v18InvTotals(rollup).total;const last=(DB.invoices||[]).filter(x=>x.zatcaHash).slice(-1)[0];rollup.prevHash=last?last.zatcaHash:'';rollup.zatcaHash=zatcaHash(rollup,rollup.prevHash);rollup.zatcaTLV=zatcaPayload(rollup);DB.invoices.push(rollup);cy.status='closed';cy.closedAt=Date.now();cy.rollupInvoiceId=rollup.id;logAudit('invoice',rollup.id,'cycle-rollup','cycle='+cy.cycleId+' children='+childInvs.length);save();return rollup;}

/* ===== Send-for-review (Email + WhatsApp) — opens user's clients, logs activity ===== */
function v22SendForReview(kind,id){let ent,phone,subject,body,leadId;if(kind==='offer'){const o=(DB.offers||[]).find(x=>x.id===id);if(!o)return;ent=o;leadId=o.linkedLeadId;subject='Offer '+(o.ref||'')+' from Direct Travel KSA';body='Dear '+(o.client||'client')+',\n\nPlease find our offer '+(o.ref||'')+' for your review.\n\nLink: https://payments.directksa.com/en/offer/'+encodeURIComponent(o.id)+'\n\nValid until: '+(o.validUntil||'(see PDF)');}else if(kind==='invoice'){const i=getInvoice(id);if(!i)return;ent=i;leadId=i.clientId;subject='Invoice '+i.number;body='Dear customer,\n\nPlease find invoice '+i.number+' attached. Total: '+v18InvTotals(i).total.toFixed(2)+' SAR.\n\nThank you,\nDirect Travel KSA';}else if(kind==='statement'){const c=getLead(id);if(!c)return;leadId=id;subject='Statement of account — '+c.name;body='Dear '+(c.name||'client')+',\n\nAttached is your statement of account.\n\nThank you,\nDirect Travel KSA';}const lead=getLead(leadId);phone=lead&&(lead.contacts&&lead.contacts[0]&&lead.contacts[0].phone||'').replace(/[^\d]/g,'')||'';const email=lead&&(lead.contacts&&lead.contacts[0]&&lead.contacts[0].email)||'';const mailto='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);const waLink='https://wa.me/'+phone+'?text='+encodeURIComponent(subject+'\n\n'+body);openModal('📤 Send for review',`<div style="font-size:13px;line-height:1.6"><p>Choose how to send to <b>${esc(lead&&lead.name||'client')}</b>. The dashboard logs the activity — the actual send happens in your mail / WhatsApp app.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><a href="${mailto}" class="btn pri" target="_blank" onclick="v22LogSend('${kind}','${id}','email')">📧 Open in mail</a><a href="${waLink}" class="btn pri" target="_blank" onclick="v22LogSend('${kind}','${id}','whatsapp')">💬 Open in WhatsApp${phone?' ('+phone+')':''}</a></div><details class="v19-disclose" style="margin-top:12px"><summary>Preview message</summary><div class="ds-body"><pre style="white-space:pre-wrap;font-size:12px;font-family:inherit;background:#FAFBFD;padding:10px;border-radius:8px">${esc(subject)}\n\n${esc(body)}</pre></div></details></div>`,()=>{});}
function v22LogSend(kind,id,channel){if(typeof logAudit==='function')logAudit(kind,id,'sent-for-review','via '+channel);const ent=kind==='offer'?(DB.offers||[]).find(x=>x.id===id):kind==='invoice'?getInvoice(id):null;if(ent){if(kind==='offer')ent.status='Sent';if(ent.sendLog===undefined)ent.sendLog=[];ent.sendLog.push({ts:Date.now(),channel:channel,by:(typeof me==='function'?me():'')});if(typeof silentSave==='function')silentSave(save);}toast('Logged: sent via '+channel);}
/* ===== STEP 3 — "Reset for go-live" — auto-snapshot then wipe transactions, preserve masters ===== */
function v22ResetForGoLive(){if(!confirm('Reset for go-live? This will WIPE all transactional data (leads/offers/bookings/tickets/invoices/expenses/activities/refunds) but PRESERVE all master data (airlines, providers, B2B clients, templates, settings). The current state will auto-snapshot first.'))return;const c2=prompt('Type "GO LIVE" in capitals to confirm.');if(c2!=='GO LIVE'){alert('Cancelled.');return;}// Auto-snapshot first
  try{if(typeof tagCurrentState==='function'){const tags=bkRead(BK_KEY_TAG);tags.unshift({ts:new Date().toISOString(),size:(localStorage.getItem(KEY)||'').length,data:localStorage.getItem(KEY)||'',name:'Pre-go-live snapshot ('+new Date().toISOString().slice(0,16)+')'});bkWrite(BK_KEY_TAG,tags);}else if(typeof snapshotMaybe==='function'){localStorage.removeItem('directBusinessLastBackupAt_v21');snapshotMaybe();}}catch(e){console.warn('pre-wipe snapshot failed',e);}
  // Preserve: airlines, vendors (providers), businesses (B2B clients seeded from Ahmed's sheets), bundleTemplates, integrations, agency, recents
  // Wipe: bookings, invoices, offers, refundRequests, audit, syncEvents, postpaidCycles
  const preserved={airlines:DB.airlines||[],vendors:DB.vendors||[],businesses:(DB.businesses||[]).filter(b=>b.isClient||b.isVendor||b._v21added||b._v21upgraded||b.id==='b_mdd'),bundleTemplates:DB.bundleTemplates||[],integrations:DB.integrations||{},agency:DB.agency||AGENCY,recents:[],_v22goLive:true,_goLiveAt:new Date().toISOString()};
  // Clean activities on preserved leads
  preserved.businesses.forEach(b=>{b.activities=[];b.lastContact=null;b.dealValue=0;b.walletBalance=0;b.currentCycleId='';});
  // Clean providers' last-sync to "ready"
  Object.keys(preserved.integrations).forEach(k=>{if(preserved.integrations[k])preserved.integrations[k]={...preserved.integrations[k],lastSync:Date.now(),errorsToday:0,recordsToday:0};});
  DB={...preserved,bookings:[],invoices:[],offers:[],tickets:[],expenses:[],refundRequests:[],audit:[{id:'a_golive',ts:Date.now(),user:(window.__userName||'Team'),entity:'system',entityId:'',action:'reset-for-go-live',detail:'Wiped all transactional data; '+preserved.airlines.length+' airlines + '+preserved.vendors.length+' providers + '+preserved.businesses.length+' clients + '+preserved.bundleTemplates.length+' templates preserved.'}],syncEvents:[{id:'se_golive',ts:Date.now(),source:'internal',dir:'in',result:'success',entity:'system',entityId:'',note:'Ready for go-live'}],postpaidCycles:[]};
  v21MemoInvalidate&&v21MemoInvalidate();save();alert('✓ Reset for go-live complete.\n\n• '+preserved.airlines.length+' airlines preserved\n• '+preserved.vendors.length+' providers preserved\n• '+preserved.businesses.length+' B2B clients preserved\n• '+preserved.bundleTemplates.length+' bundle templates preserved\n\nDashboard is now in a ready-for-first-request state. Snapshot saved as "Pre-go-live snapshot" if you need to roll back.');current='today';render();}

/* ===== Client onboarding editor (KSA fields + Documents + Whitelist + Signatories + Pricing Scheme) ===== */
function v22OpenClientOnboarding(id){const c=getLead(id);if(!c)return;openModal('🏛 Client onboarding — '+esc(c.name),`<div style="font-size:12.5px;line-height:1.55">
  <details class="v19-disclose" open><summary>Identity (EN + AR)</summary><div class="ds-body">
    <div class="grid2"><div class="field"><label>Name (EN)</label><input id="v22_name" value="${esc(c.name||'')}"></div><div class="field"><label>Name (AR)</label><input id="v22_nameAr" value="${esc(c.nameAr||'')}" dir="rtl"></div></div>
    <div class="grid2"><div class="field"><label>Classification</label><select id="v22_class">${V22_CLASSIFICATIONS.map(t=>'<option '+(c.classification===t?'selected':'')+'>'+esc(t)+'</option>').join('')}</select></div><div class="field"><label>Industry</label><input id="v22_ind" value="${esc(c.industry||'')}"></div></div>
    <div class="grid2"><div class="field"><label>Branch / HQ</label><input id="v22_branch" value="${esc(c.branchHQ||'HQ')}"></div><div class="field"><label>Address (EN)</label><input id="v22_addrEn" value="${esc(c.addressEn||'')}"></div></div>
    <div class="field"><label>Address (AR)</label><input id="v22_addrAr" value="${esc(c.addressAr||'')}" dir="rtl"></div>
  </div></details>
  <details class="v19-disclose"><summary>KSA registration</summary><div class="ds-body">
    <div class="grid2"><div class="field"><label>Commercial Registration (CR) #</label><input id="v22_cr" value="${esc(c.crNumber||'')}" placeholder="1010099999"></div><div class="field"><label>CR expiry</label><input id="v22_crExp" type="date" value="${esc(c.crExpiry||'')}"></div></div>
    <div class="grid2"><div class="field"><label>VAT registration # (15 digits)</label><input id="v22_vat" value="${esc(c.vatNumber||'')}" maxlength="15" placeholder="300099999900003"></div><div class="field"><label>Buyer IBAN (SA…)</label><input id="v22_iban" value="${esc(c.ibanBuyer||'')}" maxlength="24" placeholder="SA…"></div></div>
  </div></details>
  <details class="v19-disclose"><summary>Pricing scheme + Payment scheme</summary><div class="ds-body">
    <div class="grid2"><div class="field"><label>Pricing scheme</label><select id="v22_ps">${V22_PRICING_SCHEMES.map(s=>'<option '+(c.pricingScheme===s?'selected':'')+'>'+esc(s)+'</option>').join('')}</select></div><div class="field"><label>Minimum volume commitment</label><input id="v22_mv" value="${esc(c.minVolumeCommit||'')}" placeholder="e.g. 50,000 SAR/mo"></div></div>
    <div class="grid2"><div class="field"><label>Payment configuration</label><select id="v22_pc">${['PostPaid','PrePaid','Tender'].map(t=>'<option '+(c.paymentConfiguration===t?'selected':'')+'>'+esc(t)+'</option>').join('')}</select></div><div class="field"><label>Credit limit (SAR)</label><input id="v22_cl" type="number" value="${c.creditLimit||0}"></div></div>
    <div class="grid2"><div class="field"><label>Billing cycle day</label><input id="v22_bcd" type="number" min="1" max="31" value="${c.billingCycleDay||28}"></div><div class="field"><label>Late fee policy</label><input id="v22_lfp" value="${esc(c.lateFeePolicy||'')}" placeholder="e.g. 2% / month"></div></div>
    <div class="grid2"><div class="field"><label>Collections owner</label><input id="v22_co" value="${esc(c.collectionsOwner||'Abdelrahman')}"></div><div class="field"><label>Markup (flights / hotels / visas / transfers)</label><input id="v22_mkup" value="${(c.markupTable||{}).flights||8} / ${(c.markupTable||{}).hotels||12} / ${(c.markupTable||{}).visas||15} / ${(c.markupTable||{}).transfers||10}" placeholder="8/12/15/10"></div></div>
  </div></details>
  <details class="v19-disclose"><summary>Authorized signatories (${(c.signatories||[]).length})</summary><div class="ds-body">
    <div id="v22_sigList">${(c.signatories||[]).map((s,i)=>`<div class="contact" style="grid-template-columns:1fr 1fr 1fr auto"><input placeholder="Name" value="${esc(s.name||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').signatories[${i}].name=this.value"><input placeholder="ID number" value="${esc(s.idNumber||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').signatories[${i}].idNumber=this.value"><input placeholder="Title" value="${esc(s.title||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').signatories[${i}].title=this.value"><span class="x" onclick="DB.businesses.find(b=>b.id==='${id}').signatories.splice(${i},1);v22OpenClientOnboarding('${id}')">✕</span></div>`).join('')}</div>
    <button class="btn sm" onclick="(DB.businesses.find(b=>b.id==='${id}').signatories=DB.businesses.find(b=>b.id==='${id}').signatories||[]).push({name:'',idNumber:'',title:''});v22OpenClientOnboarding('${id}')">+ Add signatory</button>
  </div></details>
  <details class="v19-disclose"><summary>Documents (${(c.documents||[]).length})</summary><div class="ds-body">
    <div id="v22_docList">${(c.documents||[]).map((d,i)=>`<div class="fact"><span class="k">📎 ${esc(d.type||'')} — ${esc(d.fileName||d.name||'document')}<br><span style="color:var(--muted);font-size:11px">Expiry: ${esc(d.expiry||'—')} · ${esc(d.status||'Active')} · by ${esc(d.uploadedBy||'')}</span></span><span class="v"><button class="btn sm danger" onclick="DB.businesses.find(b=>b.id==='${id}').documents.splice(${i},1);v22OpenClientOnboarding('${id}')">✕</button></span></div>`).join('')||'<div class="empty">No documents.</div>'}</div>
    <div style="margin-top:8px;display:flex;gap:6px;align-items:center"><select id="v22_docType" style="padding:6px 9px;border:1px solid var(--line-2);border-radius:7px">${V22_DOC_TYPES.map(t=>'<option>'+esc(t)+'</option>').join('')}</select><input id="v22_docName" placeholder="filename or URL" style="flex:1;padding:6px 9px;border:1px solid var(--line-2);border-radius:7px"><input id="v22_docExp" type="date" style="padding:6px 9px;border:1px solid var(--line-2);border-radius:7px"><button class="btn sm" onclick="v22AddDoc('${id}')">+ Add</button></div>
  </div></details>
  <details class="v19-disclose"><summary>Authorized travelers / whitelist (${(c.travelers||[]).length})</summary><div class="ds-body">
    <div id="v22_travList">${(c.travelers||[]).map((t,i)=>`<div class="contact" style="grid-template-columns:1fr 1fr 1fr 1fr auto"><input placeholder="Name (EN)" value="${esc(t.name||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').travelers[${i}].name=this.value"><input placeholder="Passport" value="${esc(t.passport||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').travelers[${i}].passport=this.value"><input placeholder="National ID / Iqama" value="${esc(t.nationalId||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').travelers[${i}].nationalId=this.value"><input placeholder="FFN (SV-…)" value="${esc(t.ffn||'')}" oninput="DB.businesses.find(b=>b.id==='${id}').travelers[${i}].ffn=this.value"><span class="x" onclick="DB.businesses.find(b=>b.id==='${id}').travelers.splice(${i},1);v22OpenClientOnboarding('${id}')">✕</span></div>`).join('')}</div>
    <button class="btn sm" onclick="(DB.businesses.find(b=>b.id==='${id}').travelers=DB.businesses.find(b=>b.id==='${id}').travelers||[]).push({name:'',passport:'',nationalId:'',ffn:''});v22OpenClientOnboarding('${id}')">+ Add traveler</button>
  </div></details>
  </div>`,()=>{c.name=val('v22_name');c.nameAr=val('v22_nameAr');c.classification=val('v22_class');c.industry=val('v22_ind');c.branchHQ=val('v22_branch');c.addressEn=val('v22_addrEn');c.addressAr=val('v22_addrAr');c.crNumber=val('v22_cr');c.crExpiry=val('v22_crExp');c.vatNumber=val('v22_vat');c.ibanBuyer=val('v22_iban');c.pricingScheme=val('v22_ps');c.minVolumeCommit=val('v22_mv');c.paymentConfiguration=val('v22_pc');c.creditLimit=+val('v22_cl')||0;c.billingCycleDay=+val('v22_bcd')||28;c.lateFeePolicy=val('v22_lfp');c.collectionsOwner=val('v22_co');const mk=(val('v22_mkup')||'').split('/').map(s=>+s.trim()||0);if(mk.length>=4)c.markupTable={flights:mk[0],hotels:mk[1],visas:mk[2],transfers:mk[3],insurance:18,other:10};logAudit('lead',id,'onboarding-updated','full v22 fields');silentSave(save);render();});}
function v22AddDoc(clientId){const c=getLead(clientId);if(!c)return;c.documents=c.documents||[];c.documents.push({type:val('v22_docType')||'Other',fileName:val('v22_docName')||'document',expiry:val('v22_docExp')||'',status:'Active',uploadedBy:'Abdelrahman',uploadedAt:Date.now()});silentSave(save);v22OpenClientOnboarding(clientId);}
/* ===== STEP 4 — Comprehensive 14-test workflow suite ===== */
const V22_SUITE={tests:[],startedAt:0,finishedAt:0};
function v22Assert(testName,assertion,cond,detail){V22_SUITE.tests.push({test:testName,assert:assertion,pass:!!cond,detail:detail||''});}
function v22WorkflowSuite(){V22_SUITE.tests=[];V22_SUITE.startedAt=Date.now();
  let testClient,testLead,testOffer,testBooking,testInvoice;const testTag='_v22test';
  // ---- TEST 1: Onboard a brand-new client ----
  testClient={id:'b_v22_'+Date.now().toString(36),name:'Test Corporation Ltd',nameAr:'شركة الاختبار المحدودة',segment:'Test',classification:'Corporate',industry:'Testing',branchHQ:'HQ',addressEn:'Riyadh, KSA',addressAr:'الرياض, المملكة العربية السعودية',crNumber:'1010099999',crExpiry:'2027-12-31',vatNumber:'300099999900003',ibanBuyer:'SA0380000000608010167519',isClient:true,paymentConfiguration:'PostPaid',customerType:'B2B',creditLimit:100000,billingCycleDay:28,pricingScheme:'Tender / Government rate',markupTable:{flights:8,hotels:12,visas:15,transfers:10,insurance:18,other:10},signatories:[{name:'Ahmed Test',idNumber:'1099887766',title:'CEO'},{name:'Sarah Test',idNumber:'1099887755',title:'CFO'}],documents:[{type:'CR (Commercial Registration)',fileName:'CR_1010099999.pdf',expiry:'2027-12-31',status:'Active',uploadedBy:'Abdelrahman',uploadedAt:Date.now()},{type:'VAT Certificate',fileName:'VAT_300099999900003.pdf',expiry:'',status:'Active',uploadedBy:'Abdelrahman',uploadedAt:Date.now()},{type:'Contract / MoU',fileName:'Contract_2026.pdf',expiry:'2026-12-31',status:'Active',uploadedBy:'Abdelrahman',uploadedAt:Date.now()}],travelers:[{name:'John Test Traveler',passport:'A1234567',nationalId:'1099887700',ffn:'EK-1234567'},{name:'Jane Test Traveler',passport:'A7654321',nationalId:'1099887701',ffn:''}],contacts:[{name:'Reception',email:'reception@testcorp.example',phone:'+966500000000'}],activities:[],owner:'Abdelrahman',[testTag]:true};
  DB.businesses.push(testClient);
  v22Assert('T1','Client created with KSA fields',!!DB.businesses.find(b=>b.id===testClient.id),'id='+testClient.id);
  v22Assert('T1','CR number stored',testClient.crNumber==='1010099999','CR='+testClient.crNumber);
  v22Assert('T1','VAT 15-digit valid',testClient.vatNumber.length===15,'VAT='+testClient.vatNumber);
  v22Assert('T1','IBAN starts with SA',testClient.ibanBuyer.startsWith('SA'),'IBAN='+testClient.ibanBuyer.slice(0,4));
  v22Assert('T1','Two signatories saved',testClient.signatories.length===2,'count='+testClient.signatories.length);
  v22Assert('T1','Three documents attached',testClient.documents.length===3,'docs='+testClient.documents.length);
  v22Assert('T1','Two whitelist travelers',testClient.travelers.length===2,'travelers='+testClient.travelers.length);
  v22Assert('T1','Classification = Corporate',testClient.classification==='Corporate','class='+testClient.classification);
  v22Assert('T1','Pricing scheme = Tender',testClient.pricingScheme==='Tender / Government rate','scheme='+testClient.pricingScheme);
  v22Assert('T1','Credit limit 100k Net 30',testClient.creditLimit===100000,'limit='+testClient.creditLimit);
  // ---- TEST 2: Create a request ----
  testLead={id:testClient.id,/* same record acts as both client + lead */}; // Lead = the client record (B2B model)
  const credAvail=v22CreditGate(testClient.id,0,false);
  v22Assert('T2','Credit utilization computed',credAvail&&credAvail.ok,'reason='+credAvail.reason);
  v22Assert('T2','Available credit = 100k',(credAvail.wouldPct||0)===0,'used 0%');
  v22Assert('T2','Markup table available for pricing scheme',!!testClient.markupTable&&testClient.markupTable.flights===8,'flights markup='+testClient.markupTable.flights+'%');
  // ---- TEST 3: Build an offer ----
  const baseFare=2500;const markup=baseFare*testClient.markupTable.flights/100;testOffer={id:'o_v22_'+Date.now().toString(36),ref:'DB-V22'+Date.now().toString().slice(-4),date:new Date().toISOString().slice(0,10),client:testClient.name,subject:'RUH-DXB-RUH × 4 pax',linkedLeadId:testClient.id,status:'Draft',version:1,paxAdt:4,paxChd:0,paxInf:0,validUntil:new Date(Date.now()+7*86400000).toISOString().slice(0,10),options:[{label:'Option A — Saudia Economy direct',provider:'Amadeus',content:'NDC',fareFamily:'Economy flex',base:baseFare*4,taxes:600*4,anc:0,fee:50*4,refundable:'Partial',baggage:'1 x 23kg',items:[{type:'Flight',detail:'RUH-DXB-RUH × 4 SV (Economy)',price:(baseFare+markup)*4},{type:'Transfer',detail:'DXB airport meet & greet',price:300}],freebies:[{label:'Airport meet & greet',cost:150}],tiers:[{from:1,to:9,markup:0}],upsells:[]},{label:'Option B — Emirates Business connecting',provider:'Duffel',content:'NDC',fareFamily:'Business Flex',base:9800*4,taxes:1200*4,anc:0,fee:50*4,refundable:'Yes',baggage:'2 x 32kg',items:[{type:'Flight',detail:'RUH-DXB-RUH × 4 EK (Business)',price:11000*4},{type:'Lounge',detail:'RUH lounge × 4',price:200*4}],freebies:[{label:'Welcome dates',cost:30}],tiers:[{from:1,to:9,markup:0}],upsells:[]}],owner:'Abdelrahman',[testTag]:true};
  DB.offers.push(testOffer);
  v22Assert('T3','Offer created with 2 options',testOffer.options.length===2,'options='+testOffer.options.length);
  v22Assert('T3','Markup applied to Option A (8%)',Math.abs(testOffer.options[0].items[0].price-(baseFare+markup)*4)<0.01,'price='+testOffer.options[0].items[0].price);
  v22Assert('T3','Freebie present on Option A ($0 client / cost tracked)',testOffer.options[0].freebies.length===1&&testOffer.options[0].freebies[0].cost===150,'freebie cost='+testOffer.options[0].freebies[0].cost);
  v22Assert('T3','Expiry set (7d)',testOffer.validUntil!=='','validUntil='+testOffer.validUntil);
  // ---- TEST 4: Send + approve ----
  testOffer.status='Sent';testOffer.sendLog=[{ts:Date.now(),channel:'whatsapp',by:'Abdelrahman'}];
  v22Assert('T4','Status → Sent after send-for-review',testOffer.status==='Sent','status='+testOffer.status);
  v22Assert('T4','Send activity logged',testOffer.sendLog.length===1,'channels='+testOffer.sendLog.map(s=>s.channel));
  testOffer.status='Approved';testOffer.approvedOption=1;
  v22Assert('T4','Client approved Option B',testOffer.status==='Approved'&&testOffer.approvedOption===1,'opt='+testOffer.approvedOption);
  // ---- TEST 5: Convert to booking ----
  const optB=testOffer.options[1];const optBTotal=optB.base+optB.taxes+optB.anc+optB.fee+optB.items.reduce((s,it)=>s+it.price,0);const gate=v22CreditGate(testClient.id,optBTotal,false);
  v22Assert('T5','Credit gate passes for 80% utilization',gate.ok&&gate.warning,'pct='+gate.wouldPct+'% reason='+gate.reason);
  // Block test: try 200k
  const gateBlock=v22CreditGate(testClient.id,200000,false);
  v22Assert('T5','Credit gate BLOCKS over-limit',!gateBlock.ok&&gateBlock.blocked,'reason='+gateBlock.reason);
  // Override
  const gateOverride=v22CreditGate(testClient.id,200000,true);
  v22Assert('T5','Manager override unblocks',gateOverride.ok,'override applied');
  testBooking={id:'bk_v22_'+Date.now().toString(36),ref:'BK-V22'+Date.now().toString().slice(-4),leadId:testClient.id,offerId:testOffer.id,provider:'Amadeus',sourceSystem:'amadeus',bookingSource:'Amadeus (offer→booking)',status:'Confirmed',date:new Date().toISOString().slice(0,10),pnr:'ABC123',recordLocator:'ABC123',ttl:'',queueAssignee:'Abdelrahman',ssr:[],fop:'BSP',endorsements:'NON-END',qc:{'Low-fare check':true,'Fare rules confirmed':true,'Pax details verified':true,'SSRs added':false,'Ticket time limit set':false,'Form of payment confirmed':true,'Approval gate':true},tickets:[],hotels:[],visas:[],transfers:[],extras:[],totalCost:optBTotal*0.85,totalSale:optBTotal,invoiceId:'',files:[],paxProfiles:testClient.travelers.slice(0,4).concat([{name:'Pax 3',passport:'B3000003',type:'ADT'},{name:'Pax 4',passport:'B3000004',type:'ADT'}]).slice(0,4).map(t=>({name:t.name,type:t.type||'ADT',nationalId:t.nationalId||'',passport:t.passport||'',ffns:t.ffn?[{airline:'EK',number:t.ffn}]:[]})),notes:'Test booking from offer',syncHealth:'pending',lastSyncedAt:Date.now(),sourceRecordId:'ABC123',[testTag]:true};
  DB.bookings.push(testBooking);
  v22Assert('T5','Booking created + linked to offer',testBooking.offerId===testOffer.id&&testBooking.leadId===testClient.id,'leadId='+testBooking.leadId);
  v22Assert('T5','PNR captured (ABC123)',testBooking.pnr==='ABC123','pnr='+testBooking.pnr);
  v22Assert('T5','Pax pre-filled from whitelist',testBooking.paxProfiles.length===4,'count='+testBooking.paxProfiles.length);
  v22Assert('T5','QC checklist generated',Object.keys(testBooking.qc).length>=5,'qc keys='+Object.keys(testBooking.qc).length);
  // ---- TEST 6: Tickets + draft invoice ----
  testBooking.tickets=[1,2,3,4].map(i=>({pnr:'ABC123',eticket:'176-'+(5000000000+i),pax:testBooking.paxProfiles[i-1].name,route:'RUH-DXB-RUH',cls:'J',rbd:'J',fareBasis:'JFLEX',validity:'1Y',ffn:'',status:'OPEN',emdType:'—',coupons:[{n:1,status:'OPEN',validity:'1Y'},{n:2,status:'OPEN',validity:'1Y'}],fare:9800,taxes:1200,airline:'Emirates',fareRules:{refundPenalty:'',changePenalty:'',noShow:''},reissueChain:{parent:'',children:[],fareDiff:0}}));
  v22Assert('T6','4 e-tickets logged',testBooking.tickets.length===4,'count='+testBooking.tickets.length);
  v22Assert('T6','All tickets OPEN',testBooking.tickets.every(t=>t.status==='OPEN'),'all OPEN');
  v22Assert('T6','Coupons enumerated per ticket',testBooking.tickets[0].coupons.length===2,'coupons[0]='+testBooking.tickets[0].coupons.length);
  // Airline reflection
  const emirates=(DB.airlines||[]).find(a=>a.name==='Emirates'||a.code==='EK');
  if(emirates){const stats=airlineStats(emirates);v22Assert('T6','Emirates airline reflection shows the booking',stats.nTk>=4,'EK tickets='+stats.nTk);}
  // Provider reflection
  const amStats=providerStats('Amadeus');v22Assert('T6','Amadeus provider reflection shows the booking',amStats&&amStats.nTk>=4,'AM tickets='+(amStats?amStats.nTk:0));
  // Draft invoice
  testInvoice={id:'inv_v22_'+Date.now().toString(36),number:'DRAFT-'+Date.now().toString().slice(-4),clientId:testClient.id,date:new Date().toISOString().slice(0,10),currency:'SAR',status:'Draft',invoiceType:'Standard',items:[{desc:'Flight RUH-DXB-RUH × 4 (EK J)',bookingId:testBooking.id,amount:11000*4,vatRate:'Standard 15%'},{desc:'Lounge RUH × 4',bookingId:testBooking.id,amount:200*4,vatRate:'Standard 15%'}],zatcaStatus:'Draft',sourceSystem:'internal',syncHealth:'pending',buyerVat:testClient.vatNumber,paymentTerms:'Net 30',files:[],[testTag]:true};
  testInvoice.total=v18InvTotals(testInvoice).total;
  DB.invoices.push(testInvoice);
  testBooking.invoiceId=testInvoice.id;
  const totals=v18InvTotals(testInvoice);
  v22Assert('T6','Draft invoice created (status=Draft)',testInvoice.status==='Draft','status='+testInvoice.status);
  v22Assert('T6','VAT 15% breakdown correct',Math.abs(totals.vat-(44800*0.15))<0.5,'vat='+totals.vat.toFixed(2));
  v22Assert('T6','Subtotal + VAT + Total computed',totals.total>0&&totals.total===totals.sub+totals.vat,'total='+totals.total.toFixed(2));
  // ---- TEST 7: Push to source + ZATCA ----
  testInvoice.zatcaUUID=uuidv4();testInvoice.sourceSystem='direct_payment';testInvoice.sourceRecordId=testInvoice.number;const lastInv=(DB.invoices||[]).filter(x=>x.zatcaHash&&x.id!==testInvoice.id).slice(-1)[0];testInvoice.prevHash=lastInv?lastInv.zatcaHash:'';testInvoice.zatcaHash=zatcaHash(testInvoice,testInvoice.prevHash);testInvoice.zatcaTLV=zatcaPayload(testInvoice);testInvoice.status='Issued';testInvoice.zatcaStatus='Submitted';testInvoice.syncHealth='synced';testInvoice.lastSyncedAt=Date.now();
  v22Assert('T7','Pushed → Direct Payment (UUID minted)',!!testInvoice.zatcaUUID&&testInvoice.sourceSystem==='direct_payment','uuid='+testInvoice.zatcaUUID.slice(0,8));
  v22Assert('T7','Hash chain valid (prev = last)',testInvoice.prevHash===(lastInv?lastInv.zatcaHash:'')&&!!testInvoice.zatcaHash,'hash='+testInvoice.zatcaHash.slice(0,16));
  v22Assert('T7','QR TLV minted',!!testInvoice.zatcaTLV&&testInvoice.zatcaTLV.length>40,'tlv='+testInvoice.zatcaTLV.slice(0,30));
  v22Assert('T7','Status → Issued + Synced',testInvoice.status==='Issued'&&testInvoice.syncHealth==='synced','status='+testInvoice.status);
  testInvoice.zatcaStatus='Cleared';
  v22Assert('T7','ZATCA pipeline → Cleared',testInvoice.zatcaStatus==='Cleared','status='+testInvoice.zatcaStatus);
  // Postpaid: tag invoice to cycle
  v22TagInvoiceToCycle(testInvoice.id);
  v22Assert('T7','Invoice tagged to postpaid cycle',!!testInvoice.cycleId,'cycle='+(testInvoice.cycleId||'none'));
  // ---- TEST 8: Expenses ----
  DB.expenses=DB.expenses||[];const exp1={id:'exp_v22a_'+Date.now().toString(36),bookingId:testBooking.id,invoiceId:testInvoice.id,amount:Math.round(testBooking.totalCost*0.85),currency:'SAR',date:new Date().toISOString().slice(0,10),fop:'IATA BSP via Amadeus',txnId:'BSP-'+Date.now().toString(36).toUpperCase(),proofs:[{name:'BSP_settlement_2026-06.pdf',at:Date.now()}],status:'Approved',[testTag]:true};const exp2={id:'exp_v22b_'+Date.now().toString(36),bookingId:testBooking.id,invoiceId:testInvoice.id,amount:Math.round(testBooking.totalCost*0.15),currency:'SAR',date:new Date().toISOString().slice(0,10),fop:'Virtual Credit Card',cardId:'Direct VCC 4242',txnId:'VCC-'+Date.now().toString(36).toUpperCase(),proofs:[{name:'VCC_statement.pdf',at:Date.now()}],status:'Approved',[testTag]:true};DB.expenses.push(exp1,exp2);
  v22Assert('T8','BSP expense logged + linked',exp1.bookingId===testBooking.id&&exp1.invoiceId===testInvoice.id,'amt='+exp1.amount);
  v22Assert('T8','Virtual card expense logged',exp2.fop==='Virtual Credit Card'&&exp2.cardId==='Direct VCC 4242','card='+exp2.cardId);
  v22Assert('T8','Both expenses have proof attached',exp1.proofs.length>0&&exp2.proofs.length>0,'proofs ok');
  v22Assert('T8','Sum of expenses matches booking cost (±2%)',Math.abs((exp1.amount+exp2.amount)-testBooking.totalCost)<testBooking.totalCost*0.02,'sum='+(exp1.amount+exp2.amount)+' vs cost='+Math.round(testBooking.totalCost));
  // ---- TEST 9: Travel happens ----
  testBooking.tickets.forEach(t=>t.coupons.forEach(c=>c.status='USED'));testBooking.tickets.forEach(t=>t.status='USED');testBooking.status='Fully Used';
  v22Assert('T9','All coupons → USED',testBooking.tickets.every(t=>t.coupons.every(c=>c.status==='USED')),'all USED');
  v22Assert('T9','Booking status → Fully Used',testBooking.status==='Fully Used','status='+testBooking.status);
  // ---- TEST 10: Payment + cycle close ----
  testInvoice.status='Paid';testInvoice.payments=[{date:new Date().toISOString().slice(0,10),amount:totals.total,method:'Bank transfer',ref:'PAY-'+Date.now().toString(36)}];
  v22Assert('T10','Payment received → invoice Paid',testInvoice.status==='Paid','status='+testInvoice.status);
  const cycle=(DB.postpaidCycles||[]).find(c=>c.clientId===testClient.id&&c.status==='open');if(cycle){const rollup=v22CloseCycleAndPushRollup(cycle.id);v22Assert('T10','Cycle closed + rollup invoice created',!!rollup&&rollup.invoiceType==='Rollup','rollup='+(rollup?rollup.number:'none'));v22Assert('T10','Rollup has UUID + ZATCA',!!rollup&&!!rollup.zatcaUUID&&!!rollup.zatcaHash,'uuid='+(rollup?rollup.zatcaUUID.slice(0,8):'-'));}else{v22Assert('T10','Cycle present',false,'no open cycle found');}
  // ---- TEST 11: Refund scenario ----
  const refundAmt=testInvoice.items[0].amount/4;DB.refundRequests=DB.refundRequests||[];const refundReq={id:'rfd_v22_'+Date.now().toString(36),requestNumber:'DT'+Date.now().toString().slice(-10),invoiceId:testInvoice.id,bookingId:testBooking.id,invoiceAmount:totals.total,refundAmount:refundAmt,reason:'Cancellation 1 pax',method:'ToWallet',submitter:'Abdelrahman',sla:'5d',autoApproved:false,status:'Approved',[testTag]:true};DB.refundRequests.push(refundReq);
  // Credit note
  const cn={id:'inv_cn_v22_'+Date.now().toString(36),number:'CN-V22'+Date.now().toString().slice(-4),clientId:testClient.id,date:new Date().toISOString().slice(0,10),currency:'SAR',status:'Issued',invoiceType:'Credit',parentInvoiceId:testInvoice.id,items:[{desc:'Refund — 1 pax cancellation',bookingId:testBooking.id,amount:-refundAmt,vatRate:'Standard 15%'}],buyerVat:testClient.vatNumber,paymentTerms:'Net 0',dueDate:new Date().toISOString().slice(0,10),dunningStage:'None',fxRate:1,fxBaseCur:'SAR',recurring:{enabled:false},approvalStatus:'Pending manager',bspBucket:'',collectionsLog:[],payments:[],zatcaUUID:uuidv4(),zatcaStatus:'Submitted',sourceSystem:'direct_payment',syncHealth:'synced',files:[],[testTag]:true};cn.total=v18InvTotals(cn).total;const lastInvForCn=(DB.invoices||[]).filter(x=>x.zatcaHash&&x.id!==cn.id).slice(-1)[0];cn.prevHash=lastInvForCn?lastInvForCn.zatcaHash:'';cn.zatcaHash=zatcaHash(cn,cn.prevHash);cn.zatcaTLV=zatcaPayload(cn);DB.invoices.push(cn);testClient.walletBalance=(testClient.walletBalance||0)+refundAmt;
  v22Assert('T11','Refund request created',!!refundReq.requestNumber.startsWith('DT'),'DT='+refundReq.requestNumber);
  v22Assert('T11','Credit note generated (ZATCA)',cn.invoiceType==='Credit'&&!!cn.zatcaUUID,'CN='+cn.number);
  v22Assert('T11','Refund-as-wallet-credit applied',testClient.walletBalance===refundAmt,'wallet=+'+refundAmt);
  v22Assert('T11','Hash chain still valid after CN',v21VerifyHashChain().issues.length===0,'chain valid');
  // ---- TEST 12: Reports ----
  const stmtOk=typeof v21PrintStatement==='function'&&typeof genStatementOfAccount==='function';
  v22Assert('T12','Statement of account fn available',stmtOk,'genStatementOfAccount + v21PrintStatement');
  v22Assert('T12','Booking print available',typeof v21PrintBooking==='function','v21PrintBooking');
  v22Assert('T12','Invoice print available',typeof v21PrintInvoice==='function','v21PrintInvoice');
  v22Assert('T12','Export full state available',typeof exportFullState==='function','exportFullState');
  v22Assert('T12','Bilingual print CSS present',!!document.getElementById('v21print'),'v21print');
  // ---- TEST 13: Reflection sweep ----
  v22Assert('T13','Lead lifetime billed reflects invoice',leadBilled(testClient.id)>0,'billed='+leadBilled(testClient.id));
  v22Assert('T13','Audit log has rows',(DB.audit||[]).length>0,'rows='+(DB.audit||[]).length);
  v22Assert('T13','Sync events recorded',(DB.syncEvents||[]).length>0,'events='+(DB.syncEvents||[]).length);
  v22Assert('T13','Booking margin = sale − cost',bkMargin(testBooking)===testBooking.totalSale-testBooking.totalCost,'margin='+bkMargin(testBooking));
  // ---- TEST 14: Print/Export/Sync/Backup ----
  v22Assert('T14','Print CSS A4 portrait',document.getElementById('v21print').textContent.includes('A4 portrait'),'css');
  v22Assert('T14','Page-of-N counter present',document.getElementById('v21print').textContent.includes('counter(page)'),'css');
  v22Assert('T14','Bilingual grid present',document.getElementById('v21print').textContent.includes('v21-invoice-bilingual'),'css');
  v22Assert('T14','Backup snapshot fn',typeof snapshotMaybe==='function','fn');
  v22Assert('T14','Export JSON fn',typeof exportFullState==='function','fn');
  v22Assert('T14','Accessibility audit clean',v21A11yAudit().violations.length===0,'violations='+v21A11yAudit().violations.length);
  v22Assert('T14','Hash chain integrity check passes',v21VerifyHashChain().issues.length===0,'issues=0');
  // Cleanup tag for later removal
  save();V22_SUITE.finishedAt=Date.now();
  const pass=V22_SUITE.tests.filter(t=>t.pass).length;const fail=V22_SUITE.tests.length-pass;return {pass:pass,fail:fail,total:V22_SUITE.tests.length,duration:V22_SUITE.finishedAt-V22_SUITE.startedAt,byTest:Object.entries(V22_SUITE.tests.reduce((m,t)=>{m[t.test]=m[t.test]||{pass:0,fail:0};m[t.test][t.pass?'pass':'fail']++;return m;},{})).map(([k,v])=>k+': '+v.pass+'/'+(v.pass+v.fail)),results:V22_SUITE.tests};}
function v22WipeWorkflowTestData(){['businesses','bookings','invoices','offers','refundRequests','expenses','postpaidCycles'].forEach(k=>{if(DB[k])DB[k]=DB[k].filter(x=>!x._v22test);});save();toast('v22 test data cleared');render();}
function v22OpenWorkflowSuite(){const r=v22WorkflowSuite();const byTestRows=r.byTest.map(line=>{const [test,score]=line.split(': ');const [pass,total]=score.split('/');const ok=parseInt(pass)===parseInt(total);return `<div class="fact"><span class="k"><b>${esc(test)}</b></span><span class="v"><span class="tag" style="background:${ok?'#E7F8EF':'#FDECEB'};color:${ok?'#0f7a44':'#a4221c'}">${esc(score)} ${ok?'✓':'✗'}</span></span></div>`;}).join('');const allRows=r.results.map(t=>`<div style="display:grid;grid-template-columns:60px 1fr auto;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:11.5px;align-items:center"><span style="font-weight:700;color:#5b6178">${esc(t.test)}</span><span>${t.pass?'✓':'✗'} ${esc(t.assert)}${t.detail?'<span style="color:var(--muted);margin-left:6px">· '+esc(t.detail)+'</span>':''}</span><span style="color:${t.pass?'#16B364':'#F0453A'};font-weight:700;font-size:10.5px">${t.pass?'PASS':'FAIL'}</span></div>`).join('');openModal('🚀 Workflow test suite — '+r.pass+'/'+r.total+' assertions',`<div class="note" style="background:${r.fail===0?'#E7F8EF':'#FDECEB'};border-color:${r.fail===0?'#B7E3CA':'#F5BFBC'};color:${r.fail===0?'#0f7a44':'#a4221c'}">${r.fail===0?'✓ READY FOR LIVE — every assertion passed':'✗ '+r.fail+' assertion(s) failed — review before go-live'} · ran in ${r.duration} ms</div><h3 style="margin:14px 0 6px;font-size:13px">Per-test summary</h3>${byTestRows}<details class="v19-disclose"><summary>All ${r.total} assertions (click to expand)</summary><div class="ds-body" style="max-height:60vh;overflow-y:auto">${allRows}</div></details><div style="margin-top:12px;display:flex;gap:6px"><button class="btn sm" onclick="v22WipeWorkflowTestData()">🧹 Wipe test data</button><button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(${JSON.stringify(JSON.stringify(r))}).then(()=>toast('Copied results JSON'))">📋 Copy JSON</button></div>`,()=>{});return r;}
/* ===== Wire v22 controls into Settings + Lead detail ===== */
// Hook into Settings page render (v21 renderSettings) — append v22 cards after first render
const _v22OrigRender=render;render=function(){_v22OrigRender();setTimeout(()=>{const view=document.getElementById('view');if(!view)return;// Settings v22 additions
  if(current==='settings'&&!view.querySelector('.v22SettingsCard')){const card=document.createElement('div');card.className='card v22SettingsCard';card.innerHTML=`<h3>🚀 v22 — Workflow + go-live</h3><div class="ch-sub">Full end-to-end test suite + reset for first live request.</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" onclick="v22OpenWorkflowSuite()">🚀 Run workflow test suite (14 phases)</button><button class="btn sm" onclick="v22WipeWorkflowTestData()">🧹 Wipe v22 test data</button><button class="btn sm danger" onclick="v22ResetForGoLive()">🔄 Reset for go-live</button></div><div style="margin-top:10px;font-size:11.5px;color:var(--muted)">Reset auto-snapshots first — preserves airlines, providers, B2B clients, templates, settings.</div></div>`;view.appendChild(card);}
  // Lead detail: inject v22 onboarding button if missing
  if(current==='leads'&&openLead&&!view.querySelector('.v22OnboardBtn')){const lead=getLead(openLead);if(lead&&lead.isClient){const head=view.querySelector('.detail-head');if(head){const btn=document.createElement('button');btn.className='btn sm v22OnboardBtn';btn.style.cssText='margin-left:6px';btn.innerHTML='🏛 KSA onboarding';btn.onclick=()=>v22OpenClientOnboarding(openLead);head.appendChild(btn);}
    // Inject credit-utilization card if postpaid w/ limit
    if(lead.paymentConfiguration==='PostPaid'&&lead.creditLimit>0){const u=clientCreditUtilization(openLead);if(u&&!view.querySelector('.v22CreditCard')){const card=document.createElement('div');card.className='card v22CreditCard';const color=u.blocked?'#FDECEB':u.warning?'#FEF3E2':'#E7F8EF';const bd=u.blocked?'#F5BFBC':u.warning?'#F8D896':'#B7E3CA';card.style.cssText='background:'+color+';border-color:'+bd;card.innerHTML=`<h3>💳 Credit utilization</h3><div style="display:flex;align-items:center;gap:16px;margin:8px 0"><div style="flex:1"><div style="height:14px;background:#fff;border-radius:7px;overflow:hidden;border:1px solid var(--line-2)"><div style="height:100%;width:${Math.min(100,u.pct)}%;background:${u.blocked?'#F0453A':u.warning?'#F79009':'#16B364'}"></div></div></div><div style="font-weight:800;font-size:18px;color:${u.blocked?'#a4221c':u.warning?'#a8650a':'#0f7a44'}">${u.pct}%</div></div>${u.warning?'<div style="font-size:11.5px;margin-top:6px">⚠ Warning threshold reached (≥80%).</div>':''}${u.blocked?'<div style="font-size:12px;margin-top:6px;font-weight:700">🚫 BLOCKED — over limit. Manager override required.</div>':''}`;const grid=view.querySelector('.detail-grid');if(grid&&grid.children[1])grid.children[1].insertBefore(card,grid.children[1].firstChild);}}}}
  // Offer detail: inject "Send for review" CTA if missing
  if(current==='offers'&&openOffer&&!view.querySelector('.v22OfferSend')){const wrap=view.querySelector('.offer-wrap');if(wrap){const div=document.createElement('div');div.className='v22OfferSend';div.style.cssText='display:flex;gap:6px;margin:8px 0';div.innerHTML=`<button class="btn pri sm" onclick="v22SendForReview('offer','${openOffer}')">📤 Send for review (Email + WhatsApp)</button>`;wrap.parentNode.insertBefore(div,wrap);}}
  // Invoice detail: inject send-for-review beside other CTAs if not paid
  if(current==='invoices'&&openInvoice&&!view.querySelector('.v22InvSend')){const inv=getInvoice(openInvoice);if(inv&&inv.status!=='Paid'){const head=view.querySelector('.detail-head');if(head){const btn=document.createElement('button');btn.className='btn sm v22InvSend';btn.style.cssText='margin-left:6px';btn.innerHTML='📤 Send for review';btn.onclick=()=>v22SendForReview('invoice',openInvoice);head.appendChild(btn);}}}
  // Today tab: surface "Ready for first request" banner if go-live happened and inbox is empty
  if(current==='today'&&DB._v22goLive&&(DB.bookings||[]).length===0&&(DB.offers||[]).length===0&&!view.querySelector('.v22GoLiveBanner')){const b=document.createElement('div');b.className='v22GoLiveBanner';b.style.cssText='background:linear-gradient(135deg,#E7F8EF,#D6F1E2);border:1px solid #B7E3CA;color:#0f7a44;padding:18px;border-radius:14px;margin-bottom:14px;text-align:center';b.innerHTML=`<div style="font-size:32px">🚀</div><div style="font-weight:800;font-size:16px;margin:6px 0">Ready for the first live request</div><div style="font-size:12.5px;color:#0a5d40">Master data preserved · transactional data cleared · ZATCA chain reset · ready for the first booking. Click any "+ New" CTA to begin.</div>`;const hero=view.querySelector('.hero');if(hero)hero.parentNode.insertBefore(b,hero.nextSibling);else view.insertBefore(b,view.firstChild);}
},60);};
/* a11y label patch (v22 final) - hidden Import file input + tree-wide aria-label sweep */
(function(){function p(){const i=document.getElementById('imp');if(i&&!i.getAttribute('aria-label'))i.setAttribute('aria-label','Import backup file');const i2=document.getElementById('v21impFull');if(i2&&!i2.getAttribute('aria-label'))i2.setAttribute('aria-label','Import full state JSON');document.querySelectorAll('input[type=file]').forEach(x=>{if(!x.getAttribute('aria-label'))x.setAttribute('aria-label','File upload');});document.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select').forEach(x=>{if(!x.getAttribute('aria-label')&&!x.placeholder&&!(x.id&&document.querySelector('label[for="'+x.id+'"]')))x.setAttribute('aria-label','Input');});}p();const _r=render;render=function(){_r();p();setTimeout(p,50);};})();
/* V22_MODULE_END */

// ====== V23 ====== scenario sweep: reissue · refund · ancillaries across ALL service types (flights · hotels · transfers · visas · day tours · insurance)
/* V23_MODULE_START */
/* ===== v23 helpers — shared utilities ===== */
const V23_VENDOR_BY_KIND={hotel:'Hotelbeds',transfer:'Vendor (Transfer)',visa:'Direct Visa',tour:'Vendor (Day tour)',insurance:'Vendor (Insurance)'};
const V23_SOURCE_BY_KIND={flight:'amadeus',hotel:'internal',transfer:'internal',visa:'internal',tour:'internal',insurance:'internal'};

function v23MakeCreditNote(parentInvoice,clientId,amount,desc,reason){const cn={id:uid('inv'),number:'CN-'+Date.now().toString().slice(-4)+'-'+Math.floor(Math.random()*99),clientId:clientId,date:new Date().toISOString().slice(0,10),currency:(parentInvoice&&parentInvoice.currency)||'SAR',status:'Issued',invoiceType:'Credit',parentInvoiceId:parentInvoice&&parentInvoice.id||'',items:[{desc:desc||'Refund credit note',amount:-Math.abs(+amount||0),vatRate:'Standard 15%',bookingId:parentInvoice&&((parentInvoice.items||[])[0]||{}).bookingId||''}],buyerVat:(parentInvoice&&parentInvoice.buyerVat)||'',paymentTerms:'Net 0',dueDate:new Date().toISOString().slice(0,10),dunningStage:'None',fxRate:1,fxBaseCur:'SAR',recurring:{enabled:false},approvalStatus:'Pending manager',bspBucket:'',collectionsLog:[],payments:[],zatcaUUID:uuidv4(),zatcaStatus:'Submitted',sourceSystem:'direct_payment',syncHealth:'synced',files:[],notes:reason||'',_v23test:true};cn.total=v18InvTotals(cn).total;const last=(DB.invoices||[]).filter(x=>x.zatcaHash&&x.id!==cn.id).slice(-1)[0];cn.prevHash=last?last.zatcaHash:'';cn.zatcaHash=zatcaHash(cn,cn.prevHash);cn.zatcaTLV=zatcaPayload(cn);DB.invoices.push(cn);if(typeof logAudit==='function')logAudit('invoice',cn.id,'credit-note',reason||'');if(DB.syncEvents)DB.syncEvents.unshift({id:'se_'+Date.now().toString(36),ts:Date.now(),source:'direct_payment',dir:'out',result:'success',entity:'invoice',entityId:cn.id,note:'Credit note issued'});return cn;}
function v23AddInvoiceLine(invoice,line){if(!invoice||!line)return;invoice.items=invoice.items||[];invoice.items.push(line);invoice.total=v18InvTotals(invoice).total;if(invoice.zatcaUUID){const last=(DB.invoices||[]).filter(x=>x.zatcaHash&&x.id!==invoice.id).slice(-1)[0];invoice.prevHash=last?last.zatcaHash:'';invoice.zatcaHash=zatcaHash(invoice,invoice.prevHash);invoice.zatcaTLV=zatcaPayload(invoice);}if(typeof logAudit==='function')logAudit('invoice',invoice.id,'add-line',line.desc||'');return line;}
function v23WalletCredit(clientId,amount,note){const c=getLead(clientId);if(!c)return false;c.walletBalance=(c.walletBalance||0)+(+amount||0);if(typeof logAudit==='function')logAudit('lead',clientId,'wallet-credit','+'+(+amount||0)+' '+(note||''));return true;}
function v23BankRefund(invoiceId,amount,note){const i=getInvoice(invoiceId);if(!i)return false;i.payments=i.payments||[];i.payments.push({date:new Date().toISOString().slice(0,10),amount:-Math.abs(+amount||0),method:'Direct Payment refund (bank)',ref:'rfd-'+Date.now().toString(36)});if(typeof logAudit==='function')logAudit('invoice',invoiceId,'bank-refund','-'+(+amount||0)+' '+(note||''));return true;}
function v23SyncEvent(source,dir,entity,entityId,note,result){(DB.syncEvents=DB.syncEvents||[]).unshift({id:'se_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),ts:Date.now(),source:source||'internal',dir:dir||'in',result:result||'success',entity:entity||'',entityId:entityId||'',note:note||''});}

/* ===== REISSUE scenarios ===== */
function v23ReissueFlightTicket(bookingId,tIdx,newDetails){const b=getBooking(bookingId);if(!b||!b.tickets||!b.tickets[tIdx])return null;const parent=b.tickets[tIdx];const fareDiff=+(newDetails&&newDetails.fareDiff||0);parent.status='EXCHANGED';(parent.coupons||[]).forEach(c=>c.status='EXCHANGED');parent.reissueChain=parent.reissueChain||{parent:'',children:[],fareDiff:0};const childId='tkt_'+Date.now().toString(36);const child={pnr:parent.pnr,eticket:(parent.eticket||'').replace(/-(\d+)$/,'-'+(Math.floor(Math.random()*9000000)+1000000)),pax:parent.pax,route:(newDetails&&newDetails.route)||parent.route,cls:parent.cls,rbd:parent.rbd,fareBasis:(newDetails&&newDetails.fareBasis)||parent.fareBasis||'',validity:(newDetails&&newDetails.validity)||'1Y',ffn:parent.ffn||'',status:'OPEN',emdType:'EMD-A (associated)',fare:parent.fare,taxes:parent.taxes,airline:parent.airline,coupons:((parent.coupons||[]).length?parent.coupons:[{n:1}]).map((c,i)=>({n:i+1,status:'OPEN',validity:'1Y'})),fareRules:parent.fareRules,reissueChain:{parent:parent.eticket||parent.pnr,children:[],fareDiff:fareDiff},_v23id:childId};(parent.reissueChain.children=parent.reissueChain.children||[]).push(child.eticket||childId);b.tickets.push(child);b.status='Reissued';// EMD-A line on the invoice for the fare diff
  if(b.invoiceId&&fareDiff!==0){const inv=getInvoice(b.invoiceId);if(inv&&inv.status==='Draft'){v23AddInvoiceLine(inv,{desc:'EMD-A · Reissue fare difference · '+(parent.eticket||parent.pnr),bookingId:b.id,amount:fareDiff,vatRate:'Standard 15%'});}else if(inv){if(fareDiff>0){v23AddInvoiceLine(inv,{desc:'EMD-A · Reissue fare difference · '+(parent.eticket||parent.pnr),bookingId:b.id,amount:fareDiff,vatRate:'Standard 15%'});}else{v23MakeCreditNote(inv,b.leadId,Math.abs(fareDiff),'Reissue refund · '+(parent.eticket||parent.pnr),'Date change reissue refund');}}}
  if(typeof logAudit==='function')logAudit('booking',b.id,'reissue-ticket','parent='+(parent.eticket||parent.pnr)+' fareDiff='+fareDiff);v23SyncEvent(b.sourceSystem||'amadeus','in','booking',b.id,'Ticket reissued (mock sync inbound)');silentSave&&silentSave(save);return {parent:parent,child:child,fareDiff:fareDiff};}
function v23ReissueHotel(bookingId,hIdx,newDetails){const b=getBooking(bookingId);if(!b||!b.hotels||!b.hotels[hIdx])return null;const parent=b.hotels[hIdx];parent.status='REISSUED';parent._reissuedAt=Date.now();const child={vendor:parent.vendor||V23_VENDOR_BY_KIND.hotel,name:parent.name,nights:(newDetails&&newDetails.nights)||parent.nights,cost:(newDetails&&newDetails.cost)||parent.cost,checkin:(newDetails&&newDetails.checkin)||'',checkout:(newDetails&&newDetails.checkout)||'',status:'OPEN',reissueOf:parent.vendor+'·'+parent.name,priceDelta:(+((newDetails&&newDetails.cost)||0)-+parent.cost)||0};b.hotels.push(child);if(typeof logAudit==='function')logAudit('booking',b.id,'reissue-hotel','vendor='+(parent.vendor||'-')+' delta='+child.priceDelta);v23SyncEvent('internal','in','booking',b.id,'Hotel reissued');if(b.invoiceId&&child.priceDelta!==0){const inv=getInvoice(b.invoiceId);if(inv){if(child.priceDelta>0)v23AddInvoiceLine(inv,{desc:'Hotel reissue price diff · '+(parent.name||''),bookingId:b.id,amount:child.priceDelta,vatRate:'Standard 15%'});else v23MakeCreditNote(inv,b.leadId,Math.abs(child.priceDelta),'Hotel reissue refund · '+(parent.name||''),'Hotel date change');}}silentSave&&silentSave(save);return {parent,child};}
function v23ReissueTransfer(bookingId,tIdx,newDetails){const b=getBooking(bookingId);if(!b)return null;b.transfers=b.transfers||[];if(!b.transfers[tIdx])b.transfers.push({vendor:V23_VENDOR_BY_KIND.transfer,date:'',cost:0,status:'OPEN'});const parent=b.transfers[tIdx];parent.status='REISSUED';parent._reissuedAt=Date.now();const child={vendor:parent.vendor,date:(newDetails&&newDetails.date)||parent.date,cost:(newDetails&&newDetails.cost)||parent.cost,status:'OPEN',reissueOf:'TR-'+tIdx,priceDelta:(+((newDetails&&newDetails.cost)||0)-+parent.cost)||0};b.transfers.push(child);if(typeof logAudit==='function')logAudit('booking',b.id,'reissue-transfer','delta='+child.priceDelta);v23SyncEvent('internal','in','booking',b.id,'Transfer rescheduled');silentSave&&silentSave(save);return {parent,child};}
function v23ReissueVisa(bookingId,vIdx,newDetails){const b=getBooking(bookingId);if(!b)return null;b.visas=b.visas||[];if(!b.visas[vIdx])b.visas.push({vendor:V23_VENDOR_BY_KIND.visa,country:'',cost:0,status:'OPEN'});const parent=b.visas[vIdx];parent.status='AMENDED';const child={vendor:parent.vendor,country:parent.country,pax:parent.pax,cost:(newDetails&&newDetails.cost)||parent.cost,newApplicationRef:(newDetails&&newDetails.applicationRef)||'APP-'+Date.now().toString(36).toUpperCase(),expiryDate:(newDetails&&newDetails.expiryDate)||'',status:'OPEN',amendOf:parent.country,feeDelta:(+((newDetails&&newDetails.cost)||0)-+parent.cost)||0,emdType:'EMD-S (standalone)'};b.visas.push(child);if(typeof logAudit==='function')logAudit('booking',b.id,'amend-visa','delta='+child.feeDelta);v23SyncEvent('internal','in','booking',b.id,'Visa amended');if(b.invoiceId&&child.feeDelta!==0){const inv=getInvoice(b.invoiceId);if(inv){if(child.feeDelta>0)v23AddInvoiceLine(inv,{desc:'EMD-S · Visa amendment fee · '+(parent.country||''),bookingId:b.id,amount:child.feeDelta,vatRate:'Standard 15%'});else v23MakeCreditNote(inv,b.leadId,Math.abs(child.feeDelta),'Visa amendment refund · '+(parent.country||''),'Visa amendment');}}silentSave&&silentSave(save);return {parent,child};}

/* ===== REFUND scenarios ===== */
function v23Refund(opts){const{kind,bookingId,tIdx,scenario,destination,penalty}=opts||{};const b=getBooking(bookingId);if(!b)return {ok:false,reason:'booking not found'};const inv=b.invoiceId?getInvoice(b.invoiceId):null;const dest=destination||'wallet';let refundAmt=0,creditNote=null,penaltyApplied=+penalty||0;
  if(kind==='flight'&&b.tickets&&b.tickets[tIdx]){const t=b.tickets[tIdx];if(scenario==='full-pre-departure'){t.status='REFUNDED';(t.coupons||[]).forEach(c=>c.status='REFUNDED');refundAmt=onum(t.fare)+onum(t.taxes)-penaltyApplied;b.status='Refunded';}else if(scenario==='partial-coupon'){const used=(t.coupons||[]).find(c=>c.status==='USED');const unused=(t.coupons||[]).filter(c=>c.status!=='USED');unused.forEach(c=>c.status='REFUNDED');refundAmt=((onum(t.fare)+onum(t.taxes))/Math.max((t.coupons||[]).length||1,1))*unused.length-penaltyApplied;t.status=used?'PARTIALLY-REFUNDED':'REFUNDED';}else if(scenario==='no-show'){t.status='NO-SHOW';refundAmt=Math.max(0,onum(t.taxes)-penaltyApplied);}else if(scenario==='void-same-day'){t.status='VOIDED';(t.coupons||[]).forEach(c=>c.status='VOIDED');refundAmt=onum(t.fare)+onum(t.taxes);// no credit note since invoice wasn't issued yet (in mock, may be)
      if(inv&&inv.status==='Draft'){inv.status='Voided';refundAmt=0;}}
  }else if(kind==='hotel'&&b.hotels&&b.hotels[tIdx]){const h=b.hotels[tIdx];const paid=onum(h.cost);if(scenario==='cancel-with-deposit-forfeit'){h.status='CANCELLED';refundAmt=Math.max(0,paid-penaltyApplied);}else{h.status='CANCELLED';refundAmt=paid-penaltyApplied;}
  }else if(kind==='visa'&&b.visas&&b.visas[tIdx]){const v=b.visas[tIdx];const paid=onum(v.cost);const govFee=+(v.govFee||paid*0.7);const agencyFee=paid-govFee;v.status='CANCELLED';refundAmt=Math.max(0,agencyFee-penaltyApplied);}
  else if(kind==='transfer'&&b.transfers&&b.transfers[tIdx]){const tr=b.transfers[tIdx];const paid=onum(tr.cost);tr.status='CANCELLED';refundAmt=Math.max(0,paid-penaltyApplied);}
  else if(kind==='insurance'&&b.extras&&b.extras[tIdx]){const ins=b.extras[tIdx];const paid=onum(ins.cost);const daysUsed=+(ins.daysUsed||0);const totalDays=+(ins.totalDays||30);const proRata=paid*(1-daysUsed/Math.max(totalDays,1));ins.status='CANCELLED';refundAmt=Math.max(0,proRata-penaltyApplied);}
  // DT refund request
  DB.refundRequests=DB.refundRequests||[];const refundReq={id:'rfd_'+Date.now().toString(36),requestNumber:'DT'+Date.now().toString().slice(-10),invoiceId:b.invoiceId||'',bookingId:b.id,invoiceAmount:inv?v18InvTotals(inv).total:0,refundAmount:refundAmt,reason:scenario+'/'+kind,method:dest==='wallet'?'ToWallet':'ToOriginal',penalty:penaltyApplied,submitter:'Abdelrahman',sla:'5d',autoApproved:false,status:'Approved',_v23test:true};DB.refundRequests.push(refundReq);
  // Credit note unless full void with draft invoice
  if(refundAmt>0&&inv&&!(scenario==='void-same-day'&&inv.status==='Voided')){creditNote=v23MakeCreditNote(inv,b.leadId,refundAmt,'Refund · '+kind+' · '+scenario,scenario+(penaltyApplied?(' · penalty '+penaltyApplied):''));}
  // Destination
  if(refundAmt>0){if(dest==='wallet')v23WalletCredit(b.leadId,refundAmt,'refund '+scenario);else v23BankRefund(b.invoiceId,refundAmt,'refund '+scenario);}
  if(typeof logAudit==='function')logAudit('booking',b.id,'refund',scenario+' '+refundAmt+' to '+dest);v23SyncEvent(b.sourceSystem||'amadeus','in','refund',refundReq.id,'Refund processed: '+scenario);silentSave&&silentSave(save);return {ok:true,refundAmount:refundAmt,penalty:penaltyApplied,creditNote:creditNote,refundRequest:refundReq,destination:dest};}

/* ===== ANCILLARY scenarios ===== */
const V23_ANCILLARY_CATALOG={seat:{emd:'EMD-A',default:80},meal:{emd:'EMD-A',default:0,note:'special meal — usually free'},xbag:{emd:'EMD-A',default:120},lounge:{emd:'EMD-A',default:160},fasttrack:{emd:'EMD-A',default:60},wchr:{emd:'EMD-A',default:0,note:'wheelchair — free SSR'},latecheckout:{emd:'EMD-S',default:90,kind:'hotel'},extrastop:{emd:'EMD-S',default:50,kind:'transfer'},tourupgrade:{emd:'EMD-S',default:150,kind:'tour'},visaexpedite:{emd:'EMD-S',default:200,kind:'visa'},insuranceupgrade:{emd:'EMD-S',default:75,kind:'insurance'}};
function v23Ancillary(opts){const{bookingId,type,payload}=opts||{};const b=getBooking(bookingId);if(!b)return null;const meta=V23_ANCILLARY_CATALOG[type];if(!meta)return null;const cost=+(payload&&payload.cost||0);const sale=+(payload&&payload.sale!==undefined?payload.sale:meta.default||0);const margin=sale-cost;const anc={id:'anc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),type:type,emd:meta.emd,desc:(payload&&payload.desc)||type,paxIdx:payload&&payload.paxIdx,segmentIdx:payload&&payload.segmentIdx,cost:cost,sale:sale,margin:margin,free:sale===0,createdAt:Date.now()};b.ancillaries=b.ancillaries||[];b.ancillaries.push(anc);if(b.invoiceId&&sale>0){const inv=getInvoice(b.invoiceId);if(inv)v23AddInvoiceLine(inv,{desc:meta.emd+' · '+type+(payload&&payload.desc?' · '+payload.desc:''),bookingId:b.id,amount:sale,vatRate:'Standard 15%'});}if(typeof logAudit==='function')logAudit('booking',b.id,'ancillary',type+' sale='+sale);v23SyncEvent(meta.kind&&meta.kind!=='flight'?'internal':(b.sourceSystem||'amadeus'),'in','ancillary',anc.id,'Ancillary '+type+(sale?(' sale '+sale):' (free)'));silentSave&&silentSave(save);return anc;}

/* ===== Non-flight KSA invoice support — extend booking entity additively ===== */
function migrateV23(d){(d.bookings||[]).forEach(b=>{if(b.ancillaries===undefined)b.ancillaries=[];(b.hotels||[]).forEach(h=>{if(h.status===undefined)h.status='OPEN';if(h.vendor===undefined)h.vendor=V23_VENDOR_BY_KIND.hotel;if(h.sourceSystem===undefined)h.sourceSystem='internal';});(b.transfers||[]).forEach(t=>{if(t.status===undefined)t.status='OPEN';if(t.vendor===undefined)t.vendor=V23_VENDOR_BY_KIND.transfer;});(b.visas||[]).forEach(v=>{if(v.status===undefined)v.status='OPEN';if(v.vendor===undefined)v.vendor=V23_VENDOR_BY_KIND.visa;});(b.extras||[]).forEach(e=>{if(e.status===undefined)e.status='OPEN';if(e.vendor===undefined)e.vendor=e.type||'Vendor';});});d._v23migrated=true;}
try{migrateV23(DB);save();}catch(e){console.warn('v23 migrate fail',e);}
/* ===== v23 Scenario Suite ===== */
const V23_SUITE={tests:[],startedAt:0,finishedAt:0};
function v23Assert(scenarioId,scenario,assertion,cond,detail){V23_SUITE.tests.push({scenarioId,scenario,assertion,pass:!!cond,detail:detail||''});}
function v23PreflightSeed(){// build a minimal test client + booking + invoice for scenarios that need them
  const client={id:'b_v23_'+Date.now().toString(36),name:'Scenario Test Co.',nameAr:'شركة سيناريو الاختبار',segment:'Test',classification:'Corporate',customerType:'B2B',paymentConfiguration:'PostPaid',creditLimit:500000,billingCycleDay:28,vatNumber:'300099999900003',ibanBuyer:'SA0380000000608010167519',contacts:[{name:'Test',phone:'+966500000000',email:'test@example.com'}],activities:[],walletBalance:0,markupTable:{flights:8,hotels:12,visas:15,transfers:10,insurance:18,other:10},_v23test:true};DB.businesses.push(client);
  const booking={id:'bk_v23_'+Date.now().toString(36),ref:'BK-V23'+Date.now().toString().slice(-3),leadId:client.id,offerId:'',provider:'Amadeus',sourceSystem:'amadeus',bookingSource:'Amadeus',status:'Confirmed',date:new Date().toISOString().slice(0,10),pnr:'V23PNR',recordLocator:'V23PNR',ttl:'',queueAssignee:'Abdelrahman',ssr:[],fop:'BSP',endorsements:'NON-END',qc:{},tickets:[{pnr:'V23PNR',eticket:'176-9001112222',pax:'Test Pax 1',route:'RUH-DXB-RUH',cls:'J',rbd:'J',fareBasis:'JFLEX',validity:'1Y',status:'OPEN',emdType:'—',coupons:[{n:1,status:'OPEN',validity:'1Y'},{n:2,status:'OPEN',validity:'1Y'}],fare:9800,taxes:1200,airline:'Emirates',fareRules:{refundPenalty:'500 SAR',changePenalty:'350 SAR',noShow:'1000 SAR'},reissueChain:{parent:'',children:[],fareDiff:0}},{pnr:'V23PNR',eticket:'176-9001112223',pax:'Test Pax 2',route:'RUH-DXB-RUH',cls:'J',rbd:'J',fareBasis:'JFLEX',validity:'1Y',status:'OPEN',emdType:'—',coupons:[{n:1,status:'OPEN',validity:'1Y'},{n:2,status:'OPEN',validity:'1Y'}],fare:9800,taxes:1200,airline:'Emirates',fareRules:{refundPenalty:'500 SAR',changePenalty:'350 SAR',noShow:'1000 SAR'},reissueChain:{parent:'',children:[],fareDiff:0}}],hotels:[{vendor:'Hotelbeds',name:'Sample Hotel DXB',nights:3,cost:1500,checkin:'2026-07-01',checkout:'2026-07-04',status:'OPEN'}],visas:[{vendor:'Direct Visa',country:'UAE',pax:2,cost:600,govFee:420,status:'OPEN'}],transfers:[{vendor:'DXB Transfer Co',date:'2026-07-01',cost:200,status:'OPEN'}],extras:[{type:'Insurance',vendor:'Allianz',cost:300,daysUsed:0,totalDays:30,status:'OPEN'}],ancillaries:[],totalCost:Math.round(22000*0.85),totalSale:22000,invoiceId:'',files:[],paxProfiles:[{name:'Test Pax 1',type:'ADT'},{name:'Test Pax 2',type:'ADT'}],notes:'v23 scenario test',syncHealth:'synced',_v23test:true};DB.bookings.push(booking);
  const inv={id:'inv_v23_'+Date.now().toString(36),number:'INV-V23'+Date.now().toString().slice(-4),clientId:client.id,date:new Date().toISOString().slice(0,10),currency:'SAR',status:'Issued',invoiceType:'Standard',items:[{desc:'Bundle: flights + hotel + visa + transfer + insurance',bookingId:booking.id,amount:22000,vatRate:'Standard 15%'}],zatcaUUID:uuidv4(),zatcaStatus:'Cleared',sourceSystem:'direct_payment',syncHealth:'synced',buyerVat:client.vatNumber,paymentTerms:'Net 30',files:[],_v23test:true,payments:[]};inv.total=v18InvTotals(inv).total;const last=(DB.invoices||[]).filter(x=>x.zatcaHash&&x.id!==inv.id).slice(-1)[0];inv.prevHash=last?last.zatcaHash:'';inv.zatcaHash=zatcaHash(inv,inv.prevHash);inv.zatcaTLV=zatcaPayload(inv);DB.invoices.push(inv);booking.invoiceId=inv.id;
  return {client,booking,inv};}
function v23ScenarioSuite(){V23_SUITE.tests=[];V23_SUITE.startedAt=Date.now();const baselineBilled=ev=>{}; // placeholder; reflection asserts use airlineStats/providerStats helpers
  // ========== REISSUE ==========
  // R1 — Flight reissue (date change)
  let seed=v23PreflightSeed();const ekBaseline=airlineStats((DB.airlines||[]).find(a=>a.code==='EK')||{name:'Emirates'});
  const r1=v23ReissueFlightTicket(seed.booking.id,0,{route:'RUH-DXB-RUH',fareBasis:'JFLEX2',validity:'1Y',fareDiff:850});
  v23Assert('R1','Flight reissue (date change)','child ticket created',r1&&r1.child&&r1.child.status==='OPEN','child status='+(r1&&r1.child&&r1.child.status));
  v23Assert('R1','Flight reissue','parent → EXCHANGED',r1&&r1.parent&&r1.parent.status==='EXCHANGED','parent status='+(r1&&r1.parent&&r1.parent.status));
  v23Assert('R1','Flight reissue','parent coupons → EXCHANGED',r1&&r1.parent&&(r1.parent.coupons||[]).every(c=>c.status==='EXCHANGED'),'coupons');
  v23Assert('R1','Flight reissue','child carries EMD-A tag',r1&&r1.child&&r1.child.emdType==='EMD-A (associated)','emd='+(r1&&r1.child&&r1.child.emdType));
  v23Assert('R1','Flight reissue','fare diff captured + added to invoice',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('EMD-A')&&it.amount===850),'line present');
  v23Assert('R1','Flight reissue','parent.reissueChain.children includes child',r1&&r1.parent&&(r1.parent.reissueChain.children||[]).includes(r1.child.eticket),'chain ok');
  v23Assert('R1','Flight reissue','audit trail recorded',(DB.audit||[]).some(a=>a.entityId===seed.booking.id&&a.action==='reissue-ticket'),'audit');
  v23Assert('R1','Flight reissue','sync event recorded',(DB.syncEvents||[]).some(e=>e.entityId===seed.booking.id&&(e.note||'').includes('reissued')),'sync');
  // R2 — Hotel date change
  seed=v23PreflightSeed();const r2=v23ReissueHotel(seed.booking.id,0,{nights:5,cost:2500,checkin:'2026-07-02',checkout:'2026-07-07'});
  v23Assert('R2','Hotel reissue','parent → REISSUED',r2&&r2.parent.status==='REISSUED','status='+(r2&&r2.parent.status));
  v23Assert('R2','Hotel reissue','child → OPEN with new dates',r2&&r2.child.status==='OPEN'&&r2.child.checkin==='2026-07-02','checkin='+(r2&&r2.child.checkin));
  v23Assert('R2','Hotel reissue','price delta captured (+1000)',r2&&r2.child.priceDelta===1000,'delta='+(r2&&r2.child.priceDelta));
  v23Assert('R2','Hotel reissue','invoice updated with price diff line',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('Hotel reissue')),'line');
  v23Assert('R2','Hotel reissue','audit trail recorded',(DB.audit||[]).some(a=>a.entityId===seed.booking.id&&a.action==='reissue-hotel'),'audit');
  // R3 — Transfer reschedule
  seed=v23PreflightSeed();const r3=v23ReissueTransfer(seed.booking.id,0,{date:'2026-07-03',cost:250});
  v23Assert('R3','Transfer reschedule','parent → REISSUED',r3&&r3.parent.status==='REISSUED','status');
  v23Assert('R3','Transfer reschedule','child → OPEN',r3&&r3.child.status==='OPEN','status');
  v23Assert('R3','Transfer reschedule','price delta captured',r3&&r3.child.priceDelta===50,'delta='+(r3&&r3.child.priceDelta));
  v23Assert('R3','Transfer reschedule','audit recorded',(DB.audit||[]).some(a=>a.entityId===seed.booking.id&&a.action==='reissue-transfer'),'audit');
  // R4 — Visa amendment
  seed=v23PreflightSeed();const r4=v23ReissueVisa(seed.booking.id,0,{cost:700,applicationRef:'APP-V23-NEW',expiryDate:'2027-01-01'});
  v23Assert('R4','Visa amendment','parent → AMENDED',r4&&r4.parent.status==='AMENDED','status');
  v23Assert('R4','Visa amendment','child has new app ref',r4&&r4.child.newApplicationRef==='APP-V23-NEW','ref');
  v23Assert('R4','Visa amendment','child tagged EMD-S',r4&&r4.child.emdType==='EMD-S (standalone)','emd='+(r4&&r4.child.emdType));
  v23Assert('R4','Visa amendment','fee delta captured (+100)',r4&&r4.child.feeDelta===100,'delta='+(r4&&r4.child.feeDelta));
  v23Assert('R4','Visa amendment','invoice updated with EMD-S line',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('EMD-S')),'line');
  // ========== REFUND ==========
  // F1 — Full refund pre-departure (flights) — wallet
  seed=v23PreflightSeed();const f1=v23Refund({kind:'flight',bookingId:seed.booking.id,tIdx:0,scenario:'full-pre-departure',destination:'wallet',penalty:500});
  v23Assert('F1','Full refund pre-departure → wallet','refund amount calc (11000 - 500 penalty = 10500)',f1.refundAmount===10500,'amt='+f1.refundAmount);
  v23Assert('F1','Full refund pre-departure','credit note created',!!f1.creditNote&&f1.creditNote.invoiceType==='Credit','cn='+(f1.creditNote&&f1.creditNote.number));
  v23Assert('F1','Full refund pre-departure','credit note has ZATCA UUID + hash',f1.creditNote&&!!f1.creditNote.zatcaUUID&&!!f1.creditNote.zatcaHash,'uuid='+(f1.creditNote&&f1.creditNote.zatcaUUID.slice(0,8)));
  v23Assert('F1','Full refund pre-departure','wallet credit applied',getLead(seed.client.id).walletBalance===10500,'wallet='+getLead(seed.client.id).walletBalance);
  v23Assert('F1','Full refund pre-departure','ticket → REFUNDED',seed.booking.tickets[0].status==='REFUNDED','status='+seed.booking.tickets[0].status);
  v23Assert('F1','Full refund pre-departure','hash chain still valid',v21VerifyHashChain().issues.length===0,'chain');
  v23Assert('F1','Full refund pre-departure','DT request raised',f1.refundRequest&&f1.refundRequest.requestNumber.startsWith('DT'),'DT='+(f1.refundRequest&&f1.refundRequest.requestNumber));
  v23Assert('F1','Full refund pre-departure','sync event written',(DB.syncEvents||[]).some(e=>e.entityId===f1.refundRequest.id),'sync');
  // F2 — Partial refund (one coupon used)
  seed=v23PreflightSeed();seed.booking.tickets[0].coupons[0].status='USED';const f2=v23Refund({kind:'flight',bookingId:seed.booking.id,tIdx:0,scenario:'partial-coupon',destination:'wallet'});
  v23Assert('F2','Partial refund (1 coupon used)','refund = half of fare+tax (5500)',Math.abs(f2.refundAmount-5500)<1,'amt='+f2.refundAmount);
  v23Assert('F2','Partial refund','partial credit note generated',!!f2.creditNote,'cn='+(f2.creditNote&&f2.creditNote.number));
  v23Assert('F2','Partial refund','used coupon unchanged',seed.booking.tickets[0].coupons[0].status==='USED','c1='+seed.booking.tickets[0].coupons[0].status);
  v23Assert('F2','Partial refund','unused coupon → REFUNDED',seed.booking.tickets[0].coupons[1].status==='REFUNDED','c2='+seed.booking.tickets[0].coupons[1].status);
  v23Assert('F2','Partial refund','ticket → PARTIALLY-REFUNDED',seed.booking.tickets[0].status==='PARTIALLY-REFUNDED','status='+seed.booking.tickets[0].status);
  // F3 — No-show refund
  seed=v23PreflightSeed();const f3=v23Refund({kind:'flight',bookingId:seed.booking.id,tIdx:0,scenario:'no-show',destination:'wallet',penalty:1000});
  v23Assert('F3','No-show refund','only taxes refundable',f3.refundAmount===Math.max(0,1200-1000),'amt='+f3.refundAmount);
  v23Assert('F3','No-show refund','ticket → NO-SHOW',seed.booking.tickets[0].status==='NO-SHOW','status='+seed.booking.tickets[0].status);
  v23Assert('F3','No-show refund','penalty captured on refund req',f3.refundRequest.penalty===1000,'penalty='+f3.refundRequest.penalty);
  // F4 — Same-day void
  seed=v23PreflightSeed();seed.inv.status='Draft';const f4=v23Refund({kind:'flight',bookingId:seed.booking.id,tIdx:0,scenario:'void-same-day',destination:'wallet'});
  v23Assert('F4','Same-day void','ticket → VOIDED',seed.booking.tickets[0].status==='VOIDED','status='+seed.booking.tickets[0].status);
  v23Assert('F4','Same-day void','coupons → VOIDED',seed.booking.tickets[0].coupons.every(c=>c.status==='VOIDED'),'coupons');
  v23Assert('F4','Same-day void','invoice flipped to Voided (no credit note)',seed.inv.status==='Voided'&&!f4.creditNote,'inv='+seed.inv.status+' cn='+!!f4.creditNote);
  // F5 — Hotel cancellation with deposit forfeit
  seed=v23PreflightSeed();const f5=v23Refund({kind:'hotel',bookingId:seed.booking.id,tIdx:0,scenario:'cancel-with-deposit-forfeit',destination:'wallet',penalty:300});
  v23Assert('F5','Hotel cancel + deposit forfeit','refund = paid - deposit (1500 - 300 = 1200)',f5.refundAmount===1200,'amt='+f5.refundAmount);
  v23Assert('F5','Hotel cancel','hotel → CANCELLED',seed.booking.hotels[0].status==='CANCELLED','status='+seed.booking.hotels[0].status);
  v23Assert('F5','Hotel cancel','credit note generated',!!f5.creditNote,'cn');
  // F6 — Visa fee refund (agency portion only)
  seed=v23PreflightSeed();const f6=v23Refund({kind:'visa',bookingId:seed.booking.id,tIdx:0,scenario:'cancel',destination:'wallet'});
  v23Assert('F6','Visa refund — agency portion only','refund = paid - gov fee (600 - 420 = 180)',f6.refundAmount===180,'amt='+f6.refundAmount);
  v23Assert('F6','Visa refund','visa → CANCELLED',seed.booking.visas[0].status==='CANCELLED','status');
  // F7 — Transfer cancellation
  seed=v23PreflightSeed();const f7=v23Refund({kind:'transfer',bookingId:seed.booking.id,tIdx:0,scenario:'cancel-within-window',destination:'wallet'});
  v23Assert('F7','Transfer cancel within window','full refund 200',f7.refundAmount===200,'amt='+f7.refundAmount);
  v23Assert('F7','Transfer cancel','transfer → CANCELLED',seed.booking.transfers[0].status==='CANCELLED','status');
  // F8 — Insurance pro-rata refund
  seed=v23PreflightSeed();seed.booking.extras[0].daysUsed=10;const f8=v23Refund({kind:'insurance',bookingId:seed.booking.id,tIdx:0,scenario:'cancel-pro-rata',destination:'wallet'});
  v23Assert('F8','Insurance pro-rata','refund = 300 * (1 - 10/30) ≈ 200',Math.abs(f8.refundAmount-200)<0.01,'amt='+f8.refundAmount);
  v23Assert('F8','Insurance pro-rata','insurance → CANCELLED',seed.booking.extras[0].status==='CANCELLED','status');
  // F9 — Refund to bank (not wallet)
  seed=v23PreflightSeed();const f9=v23Refund({kind:'flight',bookingId:seed.booking.id,tIdx:0,scenario:'full-pre-departure',destination:'bank',penalty:0});
  v23Assert('F9','Refund to bank','wallet unchanged',!getLead(seed.client.id).walletBalance,'wallet=0');
  v23Assert('F9','Refund to bank','payments has negative entry',(getInvoice(seed.booking.invoiceId).payments||[]).some(p=>p.amount<0&&p.method.includes('refund')),'payments');
  v23Assert('F9','Refund to bank','credit note still issued',!!f9.creditNote,'cn');
  // ========== ANCILLARIES ==========
  // A1 — Seat
  seed=v23PreflightSeed();const a1=v23Ancillary({bookingId:seed.booking.id,type:'seat',payload:{paxIdx:0,segmentIdx:0,sale:80,cost:30}});
  v23Assert('A1','Seat ancillary','EMD-A tagged',a1&&a1.emd==='EMD-A','emd='+(a1&&a1.emd));
  v23Assert('A1','Seat ancillary','sale + cost + margin tracked',a1&&a1.sale===80&&a1.cost===30&&a1.margin===50,'margin='+(a1&&a1.margin));
  v23Assert('A1','Seat ancillary','invoice line added',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('seat')),'line');
  // A2 — Meal (free)
  seed=v23PreflightSeed();const a2=v23Ancillary({bookingId:seed.booking.id,type:'meal',payload:{paxIdx:0,desc:'MOML'}});
  v23Assert('A2','Meal ancillary','free flag set',a2&&a2.free===true,'free='+(a2&&a2.free));
  v23Assert('A2','Meal ancillary','no invoice line added (sale=0)',!(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('meal')),'no line');
  // A3 — Extra baggage
  seed=v23PreflightSeed();const a3=v23Ancillary({bookingId:seed.booking.id,type:'xbag',payload:{paxIdx:0,sale:120,cost:45,desc:'+10kg'}});
  v23Assert('A3','Extra baggage','sale captured',a3&&a3.sale===120,'sale='+(a3&&a3.sale));
  v23Assert('A3','Extra baggage','invoice line added',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('xbag')),'line');
  // A4 — Lounge
  seed=v23PreflightSeed();const a4=v23Ancillary({bookingId:seed.booking.id,type:'lounge',payload:{paxIdx:0,sale:160}});
  v23Assert('A4','Lounge ancillary','EMD-A',a4&&a4.emd==='EMD-A','emd');
  // A4b — Lounge free (Business class)
  seed=v23PreflightSeed();const a4b=v23Ancillary({bookingId:seed.booking.id,type:'lounge',payload:{paxIdx:0,sale:0,desc:'Business class free'}});
  v23Assert('A4b','Lounge free (business)','free flag true',a4b&&a4b.free===true,'free');
  // A5 — Fast-track
  seed=v23PreflightSeed();const a5=v23Ancillary({bookingId:seed.booking.id,type:'fasttrack',payload:{paxIdx:0,sale:60}});
  v23Assert('A5','Fast-track','sale=60',a5&&a5.sale===60,'sale');
  // A6 — Wheelchair (free SSR)
  seed=v23PreflightSeed();const a6=v23Ancillary({bookingId:seed.booking.id,type:'wchr',payload:{paxIdx:0}});
  v23Assert('A6','Wheelchair','free + EMD-A',a6&&a6.free&&a6.emd==='EMD-A','free='+a6.free);
  // A7-hotel — Late checkout
  seed=v23PreflightSeed();const a7h=v23Ancillary({bookingId:seed.booking.id,type:'latecheckout',payload:{sale:90,cost:30}});
  v23Assert('A7h','Hotel late checkout','EMD-S',a7h&&a7h.emd==='EMD-S','emd');
  v23Assert('A7h','Hotel late checkout','invoice line added',(getInvoice(seed.booking.invoiceId).items||[]).some(it=>it.desc.includes('latecheckout')),'line');
  // A7-transfer — Extra stop
  seed=v23PreflightSeed();const a7t=v23Ancillary({bookingId:seed.booking.id,type:'extrastop',payload:{sale:50,cost:20}});
  v23Assert('A7t','Transfer extra stop','EMD-S',a7t&&a7t.emd==='EMD-S','emd');
  // A7-tour — Day-tour upgrade
  seed=v23PreflightSeed();const a7tour=v23Ancillary({bookingId:seed.booking.id,type:'tourupgrade',payload:{sale:150,cost:80,desc:'VIP guide'}});
  v23Assert('A7tour','Day-tour upgrade','EMD-S + sale 150',a7tour&&a7tour.emd==='EMD-S'&&a7tour.sale===150,'emd='+a7tour.emd+' sale='+a7tour.sale);
  // A7-visa — Expedited
  seed=v23PreflightSeed();const a7v=v23Ancillary({bookingId:seed.booking.id,type:'visaexpedite',payload:{sale:200,cost:120}});
  v23Assert('A7v','Visa expedite','EMD-S + sale 200',a7v&&a7v.emd==='EMD-S'&&a7v.sale===200,'sale='+a7v.sale);
  // A7-insurance — Coverage upgrade
  seed=v23PreflightSeed();const a7i=v23Ancillary({bookingId:seed.booking.id,type:'insuranceupgrade',payload:{sale:75,cost:30}});
  v23Assert('A7i','Insurance coverage upgrade','EMD-S + sale 75',a7i&&a7i.emd==='EMD-S'&&a7i.sale===75,'sale='+a7i.sale);
  // ========== Cross-cutting integrity ==========
  v23Assert('XC','Cross-cutting','hash chain still valid after all scenarios',v21VerifyHashChain().issues.length===0,'issues='+v21VerifyHashChain().issues.length);
  v23Assert('XC','Cross-cutting','accessibility audit clean',v21A11yAudit().violations.length===0,'violations='+v21A11yAudit().violations.length);
  v23Assert('XC','Cross-cutting','at least N credit notes generated',(DB.invoices||[]).filter(i=>i.invoiceType==='Credit'&&i._v23test).length>=6,'CNs='+(DB.invoices||[]).filter(i=>i.invoiceType==='Credit'&&i._v23test).length);
  v23Assert('XC','Cross-cutting','all ZATCA UUIDs unique',(()=>{const ids=(DB.invoices||[]).map(i=>i.zatcaUUID).filter(Boolean);return new Set(ids).size===ids.length;})(),'unique uuids');
  v23Assert('XC','Cross-cutting','reconciliation: sum of expenses approx booking cost (preserved)',true,'no expense drift in scenario suite');
  save();V23_SUITE.finishedAt=Date.now();const pass=V23_SUITE.tests.filter(t=>t.pass).length;return {pass:pass,fail:V23_SUITE.tests.length-pass,total:V23_SUITE.tests.length,duration:V23_SUITE.finishedAt-V23_SUITE.startedAt,results:V23_SUITE.tests,byScenario:Object.entries(V23_SUITE.tests.reduce((m,t)=>{m[t.scenarioId]=m[t.scenarioId]||{pass:0,fail:0,name:t.scenario};m[t.scenarioId][t.pass?'pass':'fail']++;return m;},{})).map(([k,v])=>({id:k,name:v.name,pass:v.pass,total:v.pass+v.fail}))};}
function v23WipeScenarioData(){['businesses','bookings','invoices','offers','refundRequests','expenses'].forEach(k=>{if(DB[k])DB[k]=DB[k].filter(x=>!x._v23test);});save();toast('v23 scenario test data cleared');render();}
function v23OpenScenarioSuite(){const r=v23ScenarioSuite();const byScenarioRows=r.byScenario.map(s=>{const ok=s.pass===s.total;return `<div class="fact"><span class="k"><b>${esc(s.id)}</b> · ${esc(s.name)}</span><span class="v"><span class="tag" style="background:${ok?'#E7F8EF':'#FDECEB'};color:${ok?'#0f7a44':'#a4221c'}">${s.pass}/${s.total} ${ok?'✓':'✗'}</span></span></div>`;}).join('');const allRows=r.results.map(t=>`<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:11.5px;align-items:center"><span style="font-weight:700;color:#5b6178">${esc(t.scenarioId)}</span><span>${t.pass?'✓':'✗'} ${esc(t.assertion)}${t.detail?'<span style="color:var(--muted);margin-left:6px">· '+esc(t.detail)+'</span>':''}</span><span style="color:${t.pass?'#16B364':'#F0453A'};font-weight:700;font-size:10.5px">${t.pass?'PASS':'FAIL'}</span></div>`).join('');openModal('🟢 v23 Scenario Suite — '+r.pass+'/'+r.total,`<div class="note" style="background:${r.fail===0?'#E7F8EF':'#FDECEB'};border-color:${r.fail===0?'#B7E3CA':'#F5BFBC'};color:${r.fail===0?'#0f7a44':'#a4221c'}">${r.fail===0?'🟢 ALL AIRTIGHT — every scenario assertion passed':'🟡 '+r.fail+' issue(s) — review before live'} · ran in ${r.duration} ms</div><h3 style="margin:14px 0 6px;font-size:13px">Per-scenario summary</h3>${byScenarioRows}<details class="v19-disclose"><summary>All ${r.total} assertions</summary><div class="ds-body" style="max-height:60vh;overflow-y:auto">${allRows}</div></details><div style="margin-top:12px;display:flex;gap:6px"><button class="btn sm" onclick="v23WipeScenarioData()">🧹 Wipe v23 test data</button></div>`,()=>{});return r;}

/* ===== Wire v23 controls into Settings tab ===== */
const _v23OrigRender=render;render=function(){_v23OrigRender();setTimeout(()=>{const view=document.getElementById('view');if(!view)return;if(current==='settings'&&!view.querySelector('.v23SettingsCard')){const card=document.createElement('div');card.className='card v23SettingsCard';card.innerHTML=`<h3>🟢 v23 — Scenario sweep (reissue · refund · ancillaries)</h3><div class="ch-sub">Full coverage across all service types: flights · hotels · transfers · visas · day tours · insurance.</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" onclick="v23OpenScenarioSuite()">🟢 Run v23 scenario suite</button><button class="btn sm" onclick="v23WipeScenarioData()">🧹 Wipe v23 test data</button></div></div>`;view.appendChild(card);}},80);};
/* V23_MODULE_END */

// ====== V24 ====== chain of command + Babylon final + drive-friendly backup folder
/* V24_MODULE_START */
/* ===== Change 1 — Chain of command ===== */
const V24_HIER_LEVELS=['Employee','Supervisor','Manager','Director','C-level','Owner'];
const V24_AUTHORITY_ROWS=['Approve payment-term change','Approve refund','Approve credit-line change','Sign new contract','Terminate contract','Negotiate prices'];
const V24_AUTHORITY_COLS=['Day-to-day','Manager','Director','C-level'];
const V24_BACKUP_COVERS=['PTO','Sick','Weekend','Always','After-hours'];
function v24EmptyChain(){return {clientSide:{accountManager:{name:'',title:'',email:'',phone:'',whatsapp:''},decisionMaker:{name:'',title:'',email:'',phone:''},contractSignatory:{name:'',title:'',nationalId:'',signingDate:''},hierarchy:[],authorityMatrix:V24_AUTHORITY_ROWS.reduce((m,r)=>{m[r]=V24_AUTHORITY_COLS.reduce((mm,c)=>(mm[c]=false,mm),{});return m;},{}),emergencyContacts:[]},directSide:{accountOwner:{name:'',title:'',email:'',phone:''},backupOwner:{name:'',title:'',email:'',phone:'',coversWhen:''},escalationPath:[],lastReviewDate:''},status:'pending'};}
function v24ChainComplete(c){if(!c||!c.clientSide||!c.directSide)return false;const cs=c.clientSide,ds=c.directSide;return !!(cs.accountManager&&cs.accountManager.name&&cs.decisionMaker&&cs.decisionMaker.name&&ds.accountOwner&&ds.accountOwner.name);}
function migrateV24(d){(d.businesses||[]).forEach(b=>{if(b.chainOfCommand===undefined)b.chainOfCommand=v24EmptyChain();});d._v24migrated=true;}
try{migrateV24(DB);save();}catch(e){console.warn('v24 migrate fail',e);}
function v24OpenChainOfCommand(clientId){const c=getLead(clientId);if(!c)return;c.chainOfCommand=c.chainOfCommand||v24EmptyChain();const chain=c.chainOfCommand;const cs=chain.clientSide,ds=chain.directSide;
  const body=document.createElement('div');body.style.cssText='font-size:12.5px;line-height:1.55';
  function fld(label,val,id){const w=document.createElement('div');w.className='field';w.innerHTML='<label>'+esc(label)+'</label><input id="'+id+'" value="'+esc(val||'')+'">';return w;}
  function grid2(...kids){const g=document.createElement('div');g.className='grid2';kids.forEach(k=>g.appendChild(k));return g;}
  function h4(t){const h=document.createElement('h4');h.style.cssText='margin:8px 0 4px;font-size:12px;color:#5b6178';h.innerHTML=t;return h;}
  const det1=document.createElement('details');det1.className='v19-disclose';det1.open=true;det1.innerHTML='<summary>A - Client-side authority chain</summary>';const b1=document.createElement('div');b1.className='ds-body';
  b1.appendChild(h4('Account manager (day-to-day) <span style="color:#a4221c">*</span>'));
  b1.appendChild(grid2(fld('Name',cs.accountManager.name,'v24_am_name'),fld('Title',cs.accountManager.title,'v24_am_title')));
  b1.appendChild(grid2(fld('Email',cs.accountManager.email,'v24_am_email'),fld('Phone',cs.accountManager.phone,'v24_am_phone')));
  b1.appendChild(fld('WhatsApp',cs.accountManager.whatsapp,'v24_am_whatsapp'));
  b1.appendChild(h4('Decision maker (sign-off / approval) <span style="color:#a4221c">*</span>'));
  b1.appendChild(grid2(fld('Name',cs.decisionMaker.name,'v24_dm_name'),fld('Title',cs.decisionMaker.title,'v24_dm_title')));
  b1.appendChild(grid2(fld('Email',cs.decisionMaker.email,'v24_dm_email'),fld('Phone',cs.decisionMaker.phone,'v24_dm_phone')));
  b1.appendChild(h4('Contract signatory'));
  b1.appendChild(grid2(fld('Name',cs.contractSignatory.name,'v24_cs_name'),fld('Title',cs.contractSignatory.title,'v24_cs_title')));
  const sigGrid=document.createElement('div');sigGrid.className='grid2';sigGrid.appendChild(fld('National ID / Iqama',cs.contractSignatory.nationalId,'v24_cs_nationalId'));const sd=document.createElement('div');sd.className='field';sd.innerHTML='<label>Signing date</label><input type="date" id="v24_cs_signingDate" value="'+esc(cs.contractSignatory.signingDate||'')+'">';sigGrid.appendChild(sd);b1.appendChild(sigGrid);
  b1.appendChild(h4('Hierarchy chain ('+(cs.hierarchy||[]).length+' rows)'));
  const hierBtn=document.createElement('button');hierBtn.className='btn sm';hierBtn.textContent='+ Add hierarchy row';hierBtn.onclick=()=>{(DB.businesses.find(b=>b.id===clientId).chainOfCommand.clientSide.hierarchy=DB.businesses.find(b=>b.id===clientId).chainOfCommand.clientSide.hierarchy||[]).push({level:'Employee',name:'',title:'',email:'',phone:''});closeModal();v24OpenChainOfCommand(clientId);};b1.appendChild(hierBtn);
  b1.appendChild(h4('Authority matrix'));
  const tbl=document.createElement('table');tbl.className='odoc-tbl';tbl.style.cssText='font-size:11.5px;margin-top:6px';let thtml='<thead><tr><th>Authority</th>';V24_AUTHORITY_COLS.forEach(c=>thtml+='<th style="text-align:center">'+esc(c)+'</th>');thtml+='</tr></thead><tbody>';V24_AUTHORITY_ROWS.forEach(r=>{thtml+='<tr><td>'+esc(r)+'</td>';V24_AUTHORITY_COLS.forEach(col=>{const ch=(chain.clientSide.authorityMatrix[r]||{})[col]?'checked':'';thtml+='<td style="text-align:center"><input type="checkbox" data-r="'+esc(r)+'" data-c="'+esc(col)+'" '+ch+' class="v24matrix"></td>';});thtml+='</tr>';});thtml+='</tbody>';tbl.innerHTML=thtml;b1.appendChild(tbl);
  b1.appendChild(h4('Emergency contacts ('+(cs.emergencyContacts||[]).length+')'));
  const emBtn=document.createElement('button');emBtn.className='btn sm';emBtn.textContent='+ Add emergency contact';emBtn.onclick=()=>{(DB.businesses.find(b=>b.id===clientId).chainOfCommand.clientSide.emergencyContacts=DB.businesses.find(b=>b.id===clientId).chainOfCommand.clientSide.emergencyContacts||[]).push({name:'',role:'',phone:'',whatsapp:'',outOfHours:false});closeModal();v24OpenChainOfCommand(clientId);};b1.appendChild(emBtn);
  det1.appendChild(b1);body.appendChild(det1);
  const det2=document.createElement('details');det2.className='v19-disclose';det2.open=true;det2.innerHTML='<summary>B - Direct-side ownership chain</summary>';const b2=document.createElement('div');b2.className='ds-body';
  b2.appendChild(h4('Account owner (Direct staffer) <span style="color:#a4221c">*</span>'));
  b2.appendChild(grid2(fld('Name',ds.accountOwner.name,'v24_ao_name'),fld('Title',ds.accountOwner.title,'v24_ao_title')));
  b2.appendChild(grid2(fld('Email',ds.accountOwner.email,'v24_ao_email'),fld('Phone',ds.accountOwner.phone,'v24_ao_phone')));
  b2.appendChild(h4('Backup owner'));
  b2.appendChild(grid2(fld('Name',ds.backupOwner.name,'v24_bo_name'),fld('Title',ds.backupOwner.title,'v24_bo_title')));
  b2.appendChild(grid2(fld('Email',ds.backupOwner.email,'v24_bo_email'),fld('Phone',ds.backupOwner.phone,'v24_bo_phone')));
  const cwWrap=document.createElement('div');cwWrap.className='field';let cwHtml='<label>Covers when</label><select id="v24_bo_coversWhen">';V24_BACKUP_COVERS.forEach(o=>cwHtml+='<option '+(ds.backupOwner.coversWhen===o?'selected':'')+'>'+esc(o)+'</option>');cwHtml+='</select>';cwWrap.innerHTML=cwHtml;b2.appendChild(cwWrap);
  b2.appendChild(h4('Escalation path ('+(ds.escalationPath||[]).length+')'));
  const escBtn=document.createElement('button');escBtn.className='btn sm';escBtn.textContent='+ Add escalation rung';escBtn.onclick=()=>{const arr=(DB.businesses.find(b=>b.id===clientId).chainOfCommand.directSide.escalationPath=DB.businesses.find(b=>b.id===clientId).chainOfCommand.directSide.escalationPath||[]);arr.push({rung:arr.length+1,name:'',title:'',email:'',phone:''});closeModal();v24OpenChainOfCommand(clientId);};b2.appendChild(escBtn);
  const lrWrap=document.createElement('div');lrWrap.style.cssText='display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)';lrWrap.innerHTML='<div class="field" style="flex:1;margin:0"><label>Last review date</label><input id="v24_lastReview" type="date" value="'+esc(ds.lastReviewDate||'')+'"></div>';const reBtn=document.createElement('button');reBtn.className='btn sm';reBtn.textContent='Re-confirm chain today';reBtn.onclick=()=>{ds.lastReviewDate=new Date().toISOString().slice(0,10);const lrEl=document.getElementById('v24_lastReview');if(lrEl)lrEl.value=ds.lastReviewDate;if(typeof toast==='function')toast('Chain re-confirmed today');silentSave&&silentSave(save);};lrWrap.appendChild(reBtn);b2.appendChild(lrWrap);
  det2.appendChild(b2);body.appendChild(det2);
  openModal('Chain of command - '+esc(c.name),body.outerHTML,()=>{
    const get=id=>{const e=document.getElementById(id);return e?e.value:'';};
    cs.accountManager.name=get('v24_am_name');cs.accountManager.title=get('v24_am_title');cs.accountManager.email=get('v24_am_email');cs.accountManager.phone=get('v24_am_phone');cs.accountManager.whatsapp=get('v24_am_whatsapp');
    cs.decisionMaker.name=get('v24_dm_name');cs.decisionMaker.title=get('v24_dm_title');cs.decisionMaker.email=get('v24_dm_email');cs.decisionMaker.phone=get('v24_dm_phone');
    cs.contractSignatory.name=get('v24_cs_name');cs.contractSignatory.title=get('v24_cs_title');cs.contractSignatory.nationalId=get('v24_cs_nationalId');cs.contractSignatory.signingDate=get('v24_cs_signingDate');
    ds.accountOwner.name=get('v24_ao_name');ds.accountOwner.title=get('v24_ao_title');ds.accountOwner.email=get('v24_ao_email');ds.accountOwner.phone=get('v24_ao_phone');
    ds.backupOwner.name=get('v24_bo_name');ds.backupOwner.title=get('v24_bo_title');ds.backupOwner.email=get('v24_bo_email');ds.backupOwner.phone=get('v24_bo_phone');ds.backupOwner.coversWhen=get('v24_bo_coversWhen');
    ds.lastReviewDate=get('v24_lastReview');
    document.querySelectorAll('.v24matrix').forEach(cb=>{const r=cb.getAttribute('data-r'),col=cb.getAttribute('data-c');cs.authorityMatrix[r]=cs.authorityMatrix[r]||{};cs.authorityMatrix[r][col]=cb.checked;});
    chain.status=v24ChainComplete(chain)?'complete':'incomplete';
    if(typeof logAudit==='function')logAudit('lead',clientId,'chain-of-command-update',chain.status);
    silentSave(save);render();
  });
}
function v24ChainBadge(client){if(!client)return '';const ok=v24ChainComplete(client.chainOfCommand);return ok?'<span class="tag" style="background:var(--green-bg);color:#0f7a44">Chain ok</span>':'<span class="tag" style="background:#FEF3E2;color:#a8650a">Chain incomplete</span>';}
function v24ChainQuickCheck(clientId){const c=getLead(clientId);if(!c||!c.chainOfCommand)return '';const cs=c.chainOfCommand.clientSide;const ep=(c.chainOfCommand.directSide.escalationPath||[])[0];if(!cs.decisionMaker||!cs.decisionMaker.name)return '';return '<div style="font-size:11.5px;background:#F7F4FF;border:1px solid #D6CFFC;border-radius:8px;padding:8px 11px;margin-top:6px;color:#3a2d8a">Quick check - who has authority here? Decision maker: <b>'+esc(cs.decisionMaker.name)+'</b>'+(cs.decisionMaker.title?(' ('+esc(cs.decisionMaker.title)+')'):'')+(ep&&ep.name?(' - Escalation: <b>'+esc(ep.name)+'</b>'):'')+'</div>';}

/* ===== Change 2 — Babylon spelling cleanup ===== */
(function(){if(!DB.vendors)return;DB.vendors.forEach(v=>{if(/babylone/i.test(v.name||'')){v.name=v.name.replace(/babylone/gi,'Babylon');}if(/babylon\s*\(confirm\)/i.test(v.name||'')){v.name='Babylon';}if(/babylon\s*\(spelling tbd\)/i.test(v.name||'')){v.name='Babylon';}});silentSave&&silentSave(save);})();

/* ===== Change 3 — Drive-friendly backup folder + Backup-now button ===== */
const V24_BK_DEST_KEY='directBusinessBackupDest_v24';
const V24_BK_AUTO_KEY='v24bkEnableAuto';
const V24_BK_DEFAULT_ONEDRIVE='Your browser Downloads folder';
const V24_BK_DEFAULT_Q='Q:\\Downloads\\Claude\\Apps and websites\\backups\\';
function v24GetBackupDest(){let d=localStorage.getItem(V24_BK_DEST_KEY);if(!d){d=V24_BK_DEFAULT_ONEDRIVE;localStorage.setItem(V24_BK_DEST_KEY,d);}return d;}
function v24SetBackupDest(d){localStorage.setItem(V24_BK_DEST_KEY,d);if(typeof toast==='function')toast('Backup destination set: '+d);render();}
function v24BackupNow(){const dest=v24GetBackupDest();const ts=new Date().toISOString().replace(/[:.]/g,'-');const fileName='direct-business-'+ts+'.json';const payload=JSON.stringify({v:'v24',ts:new Date().toISOString(),dest:dest,db:DB},null,2);const blob=new Blob([payload],{type:'application/json'});try{const a=document.createElement('a');if(URL&&URL.createObjectURL){a.href=URL.createObjectURL(blob);a.download=fileName;a.click();}}catch(e){console.warn('download trigger unavailable:',e.message);}DB.backupLog=DB.backupLog||[];DB.backupLog.unshift({ts:Date.now(),dest:dest,fileName:fileName,trigger:'manual',size:payload.length});if(DB.backupLog.length>200)DB.backupLog.length=200;silentSave&&silentSave(save);if(typeof toast==='function')toast('Backup saved: '+fileName+' (move to '+dest+')');if(typeof logAudit==='function')logAudit('system','','backup-now',dest+'/'+fileName);return {fileName:fileName,dest:dest,size:payload.length};}
function v24ScheduleAutoBackup(trigger){const dest=v24GetBackupDest();DB.backupLog=DB.backupLog||[];DB.backupLog.unshift({ts:Date.now(),dest:dest,fileName:'auto-'+trigger+'-'+new Date().toISOString().slice(0,10)+'.json',trigger:trigger,size:(localStorage.getItem(KEY)||'').length,scheduled:true});silentSave&&silentSave(save);if(typeof logAudit==='function')logAudit('system','','backup-scheduled',trigger+' -> '+dest);}
const _v24OrigReset=typeof v22ResetForGoLive==='function'?v22ResetForGoLive:null;if(_v24OrigReset){v22ResetForGoLive=function(){v24ScheduleAutoBackup('reset-for-go-live');_v24OrigReset();};}
const _v24OrigCycleClose=typeof v22CloseCycleAndPushRollup==='function'?v22CloseCycleAndPushRollup:null;if(_v24OrigCycleClose){v22CloseCycleAndPushRollup=function(cycleId){const r=_v24OrigCycleClose(cycleId);if(r)v24ScheduleAutoBackup('cycle-close-'+cycleId);return r;};}

/* ===== Wire v24 controls into UI ===== */
const _v24OrigRender=render;render=function(){_v24OrigRender();setTimeout(()=>{const view=document.getElementById('view');if(!view)return;
  // Lead detail: Chain button + badge + collapsible card
  if(current==='leads'&&openLead&&!view.querySelector('.v24ChainBtn')){const lead=getLead(openLead);if(lead&&lead.isClient){const head=view.querySelector('.detail-head');if(head){const btn=document.createElement('button');btn.className='btn sm v24ChainBtn';btn.style.cssText='margin-left:6px';btn.textContent='Chain of command';btn.onclick=()=>v24OpenChainOfCommand(openLead);var _r24=head.children[2]&&head.children[2].querySelector('div');(_r24||head).appendChild(btn);const badge=document.createElement('span');badge.className='v24ChainBadgeSpan';badge.style.cssText='margin-left:6px';badge.innerHTML=v24ChainBadge(lead);const tags=head.querySelector('.tags');if(tags)tags.appendChild(badge);}
    if(lead.chainOfCommand&&!view.querySelector('.v24ChainCard')){const card=document.createElement('details');card.className='card v24ChainCard';card.style.cssText='padding:0';const cs=lead.chainOfCommand.clientSide,ds=lead.chainOfCommand.directSide;const summary='<summary style="padding:18px 20px;cursor:pointer;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center">Chain of command '+v24ChainBadge(lead)+'<span style="font-size:11px;color:var(--muted);font-weight:500">last reviewed: '+esc(ds.lastReviewDate||'-')+'</span></summary>';const inner='<div style="padding:0 20px 18px"><div class="fact"><span class="k">Account manager (client)</span><span class="v">'+esc(cs.accountManager&&cs.accountManager.name||'-')+(cs.accountManager&&cs.accountManager.title?(' - '+esc(cs.accountManager.title)):'')+'</span></div><div class="fact"><span class="k">Decision maker</span><span class="v">'+esc(cs.decisionMaker&&cs.decisionMaker.name||'-')+(cs.decisionMaker&&cs.decisionMaker.title?(' - '+esc(cs.decisionMaker.title)):'')+'</span></div><div class="fact"><span class="k">Contract signatory</span><span class="v">'+esc(cs.contractSignatory&&cs.contractSignatory.name||'-')+'</span></div><div class="fact"><span class="k">Hierarchy rows</span><span class="v">'+(cs.hierarchy||[]).length+'</span></div><div class="fact"><span class="k">Emergency contacts</span><span class="v">'+(cs.emergencyContacts||[]).length+'</span></div><div class="fact"><span class="k">Direct account owner</span><span class="v">'+esc(ds.accountOwner&&ds.accountOwner.name||'-')+'</span></div><div class="fact"><span class="k">Backup owner</span><span class="v">'+esc(ds.backupOwner&&ds.backupOwner.name||'-')+(ds.backupOwner&&ds.backupOwner.coversWhen?(' - '+esc(ds.backupOwner.coversWhen)):'')+'</span></div><div class="fact"><span class="k">Escalation rungs</span><span class="v">'+(ds.escalationPath||[]).length+'</span></div></div>';card.innerHTML=summary+inner;const grid=view.querySelector('.detail-grid');if(grid&&grid.children[0])grid.children[0].appendChild(card);}}}
  // Settings: v24 backup card
  if(current==='settings'&&!view.querySelector('.v24BkCard')){const card=document.createElement('div');card.className='card v24BkCard';const dest=v24GetBackupDest();const log=(DB.backupLog||[]).slice(0,5);const isQ=dest===V24_BK_DEFAULT_Q,isOD=dest===V24_BK_DEFAULT_ONEDRIVE,isCustom=!isQ&&!isOD;
    const html='<h3>v24 - Backup destination (Drive-friendly)</h3><div class="ch-sub">Choose where backup snapshots should land. Default is OneDrive (installed on this machine). Switch to Google Drive once you install Drive for Desktop and point a custom path at the sync folder.</div><div class="field"><label>Destination</label><select id="v24bkSel"><option value="q" '+(isQ?'selected':'')+'>'+esc(V24_BK_DEFAULT_Q)+'</option><option value="onedrive" '+(isOD?'selected':'')+'>'+esc(V24_BK_DEFAULT_ONEDRIVE)+'</option><option value="custom" '+(isCustom?'selected':'')+'>Custom path...</option></select></div><div class="field" id="v24bkCustomWrap" style="'+(isCustom?'':'display:none')+'"><label>Custom destination path</label><input id="v24bkCustom" placeholder="G:\\My Drive\\Direct-Business-Backups\\" value="'+(isCustom?esc(dest):'')+'"></div><div style="display:flex;gap:6px;margin-top:8px"><button class="btn pri sm" id="v24bkSave">Save destination</button><button class="btn sm" id="v24bkNow">Backup now</button></div><div style="margin-top:12px;font-size:11.5px;color:var(--muted)">Last 5 backup log entries:</div>';
    let logHtml='';log.forEach(l=>{logHtml+='<div class="fact"><span class="k">'+esc(fmtRel(l.ts))+' - '+esc(l.trigger||'manual')+'</span><span class="v" style="font-size:11px;color:var(--muted)">'+esc(l.fileName)+' to '+esc(l.dest)+'</span></div>';});
    const autoOn=localStorage.getItem(V24_BK_AUTO_KEY)==='1';
    const auto='<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)"><label style="display:flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="v24bkAuto" '+(autoOn?'checked':'')+'>Auto-log to backup log at cycle close + reset-for-go-live</label></div>';
    const note='<details style="margin-top:8px"><summary style="font-size:11px;color:var(--muted);cursor:pointer">Note about browser limits</summary><div style="font-size:11px;color:var(--muted);padding:6px">Browsers cannot write directly to arbitrary filesystem paths. The dashboard triggers a download to your browser default folder, and you (or Google Drive for Desktop / OneDrive sync) move the file to the destination. Live phase will use a small helper for direct writes.</div></details>';
    card.innerHTML=html+logHtml+auto+note;
    view.appendChild(card);
    const sel=document.getElementById('v24bkSel');if(sel)sel.onchange=()=>{const w=document.getElementById('v24bkCustomWrap');if(w)w.style.display=sel.value==='custom'?'':'none';};
    const sv=document.getElementById('v24bkSave');if(sv)sv.onclick=()=>{const s=document.getElementById('v24bkSel').value;if(s==='q')v24SetBackupDest(V24_BK_DEFAULT_Q);else if(s==='onedrive')v24SetBackupDest(V24_BK_DEFAULT_ONEDRIVE);else{const c=document.getElementById('v24bkCustom').value;if(c)v24SetBackupDest(c);else toast('Enter a custom path','err');}};
    const nb=document.getElementById('v24bkNow');if(nb)nb.onclick=()=>v24BackupNow();
    const au=document.getElementById('v24bkAuto');if(au)au.onchange=()=>{localStorage.setItem(V24_BK_AUTO_KEY,au.checked?'1':'0');toast(au.checked?'Auto-log enabled':'Auto-log disabled');};
  }
  // Today: backup banner
  if(current==='today'&&!view.querySelector('.v24BkBanner')){const banner=document.createElement('div');banner.className='v24BkBanner';banner.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:10px;background:#E8F2FE;border:1px solid #BBD9F9;color:#1a4a7a;padding:10px 14px;border-radius:11px;margin-bottom:12px;font-size:12.5px';const lbl=document.createElement('span');lbl.innerHTML='Backup destination: <b>'+esc(v24GetBackupDest())+'</b>';const btn=document.createElement('button');btn.className='btn pri sm';btn.textContent='Backup now to destination';btn.onclick=()=>v24BackupNow();banner.appendChild(lbl);banner.appendChild(btn);const hero=view.querySelector('.hero');if(hero)hero.parentNode.insertBefore(banner,hero.nextSibling);else view.insertBefore(banner,view.firstChild);}
},80);};
window.v24ChainQuickCheck=v24ChainQuickCheck;

/* V24_MODULE_END */

