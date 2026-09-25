/* ===== v41 layer: per-user page access + contact/POC/link amendments + language polish ===== */
(function(){try{
function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar';}catch(_){return false;}}
function canEdit(){return !window.__isShareView && window.__userTier!=='viewer';}
function E(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ---------- 1–2. RETIRED 2026-09-25 (Phase 1a, D2) ----------
   This layer used to run a second page gate of its own: every two seconds it read
   app_users.allowed_pages and hid sidebar buttons by matching their wording, beside the real gate
   (js/52, fed by the per-person grid) — two lists deciding the same thing, which agreed only because
   nobody had changed one without the other. It also carried its own "Access" window that wrote
   allowed_pages, a list nothing else reads. Both are gone: the one check is the database's
   page_level(), which js/56 loads and js/52 applies, and Team & Access (in Settings) is the one
   place to change it. The allowed_pages column is left in place, unread, for a later clean-up.
   v41Access and the "Access" button stay as a door to that one place, so nothing that opened the
   old window is left pointing at nothing. */
window.v41Access=function(){
  try{
    if(typeof current!=='undefined'){ current='settings'; if(typeof render==='function') render(); }
    setTimeout(function(){ try{ var h=document.getElementById('axHost'); if(h&&h.scrollIntoView) h.scrollIntoView({block:'start'}); }catch(_){} },500);
  }catch(_){}
};
(function addAccessBtn(n){
  try{
    if(window.__isShareView)return;
    var tools=document.querySelector('.tools');
    var r=window.__userRole;
    if(!tools || (r!=='admin' && r!=='manager')){ if((n||0)<40)setTimeout(function(){addAccessBtn((n||0)+1);},700); return; }
    if(!document.getElementById('v41acc')){
      var b=document.createElement('button'); b.id='v41acc'; b.className='btn sm ghost'; b.style.fontWeight='700';
      b.textContent=isAr()?'الصلاحيات':'Access'; b.onclick=function(){v41Access();};
      tools.appendChild(b);
    }
  }catch(_){}
})(0);

/* ---------- 3. amendments: add contact / POC / links on the lead card ---------- */
window.v41AddContact=function(id){
  var b=getLead(id); if(!b||!canEdit())return; var ar=isAr();
  openModal((ar?'إضافة جهة اتصال — ':'Add contact — ')+E(b.name),
    '<div class="grid2"><div class="field"><label>'+(ar?'الاسم':'Name')+'</label><input id="nc_n"></div>'+
    '<div class="field"><label>'+(ar?'الصفة / الدور':'Role / title')+'</label><input id="nc_r" placeholder="'+(ar?'مثال: مدير المشتريات':'e.g. Procurement manager')+'"></div></div>'+
    '<div class="grid2"><div class="field"><label>'+(ar?'البريد':'Email')+'</label><input id="nc_e"></div>'+
    '<div class="field"><label>'+(ar?'الجوال':'Phone')+'</label><input id="nc_p"></div></div>',
    function(){
      var em=val('nc_e').trim().toLowerCase();
      b.contacts=b.contacts||[];
      if(em&&b.contacts.some(function(c){return String(c.email||'').toLowerCase()===em;})){alert(ar?'هذا البريد موجود بالفعل على هذه البطاقة.':'This email is already on this card.');return;}
      var nm=val('nc_n')+(val('nc_r')?' — '+val('nc_r'):'');
      b.contacts.push({name:nm,email:val('nc_e'),phone:val('nc_p')});
      save();render();
    });
};
window.v41AddLink=function(id){
  var b=getLead(id); if(!b||!canEdit())return; var ar=isAr();
  openModal((ar?'إضافة رابط — ':'Add link — ')+E(b.name),
    '<div class="grid2"><div class="field"><label>'+(ar?'الوصف':'Label')+'</label><input id="nl_l" placeholder="'+(ar?'لينكدإن / السجل التجاري / عرضنا…':'LinkedIn / CR / our proposal…')+'"></div>'+
    '<div class="field"><label>'+(ar?'الرابط':'URL')+'</label><input id="nl_u" placeholder="https://…"></div></div>',
    function(){
      var u=val('nl_u').trim(); if(!u)return;
      if(!/^https?:\/\//i.test(u))u='https://'+u;
      b.links=b.links||[]; b.links.push({label:val('nl_l')||u.replace(/^https?:\/\//,'').split('/')[0],url:u});
      save();render();
    });
};
function injectAmend(){
  try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(typeof openLead==='undefined'||!openLead)return;
    if(document.getElementById('v41amend'))return;
    var b=getLead(openLead); if(!b)return;
    var cards=document.querySelectorAll('#view .card h3');
    var target=null;
    cards.forEach(function(h){ if(/Contacts|جهات/.test(h.textContent))target=h.parentNode; });
    if(!target)return;
    var ar=isAr();
    var d=document.createElement('div'); d.id='v41amend'; d.style.cssText='margin-top:10px;display:flex;gap:6px;flex-wrap:wrap';
    if(canEdit())d.innerHTML='<button class="btn sm" onclick="v41AddContact(\''+b.id+'\')">＋ '+(ar?'جهة اتصال':'Contact / POC')+'</button>'+
      '<button class="btn sm" onclick="v41AddLink(\''+b.id+'\')">🔗 '+(ar?'رابط':'Link')+'</button>';
    var links=(b.links||[]);
    if(links.length){
      var lw=document.createElement('div'); lw.style.cssText='margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;width:100%';
      lw.innerHTML=links.map(function(l){return '<a class="tag" style="background:#2E90FA14;color:#2E90FA;text-decoration:none" target="_blank" rel="noopener" href="'+E(l.url)+'">🔗 '+E(l.label)+'</a>';}).join('');
      d.appendChild(lw);
    }
    target.appendChild(d);
  }catch(_){}
}
setInterval(injectAmend,1200);

/* ---------- 4. language polish: translate the Events editor when Arabic is on ---------- */
var EVAR={'Name (English) *':'الاسم (إنجليزي) *','Name (Arabic)':'الاسم (عربي)','Vertical':'المجال','Status':'الحالة','Start date':'تاريخ البداية','End date':'تاريخ النهاية','City':'المدينة','Venue':'المكان','Organiser':'المنظم','Website link':'رابط الموقع','Priority (1 = top)':'الأولوية (1 = الأعلى)','Opportunity':'نوع الفرصة','Notes':'ملاحظات','Cancel':'إلغاء','Save changes':'حفظ التغييرات','Add event':'إضافة فعالية','Edit event':'تعديل فعالية'};
setInterval(function(){
  try{
    if(!isAr())return;
    document.querySelectorAll('div[style*="z-index: 999999"] label, div[style*="z-index:999999"] label').forEach(function(l){
      var t=l.firstChild&&l.firstChild.nodeType===3?l.firstChild.textContent.trim():l.textContent.trim();
      if(EVAR[t]){ if(l.firstChild&&l.firstChild.nodeType===3)l.firstChild.textContent=EVAR[t]; else l.textContent=EVAR[t]; }
    });
    document.querySelectorAll('div[style*="z-index: 999999"] button, div[style*="z-index:999999"] button').forEach(function(bt){
      var t=bt.textContent.trim(); if(EVAR[t])bt.textContent=EVAR[t];
    });
  }catch(_){}
},800);

console.info('%c[v41 access + amendments] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v41 layer failed',e);}})();
