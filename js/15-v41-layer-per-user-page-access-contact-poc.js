/* ===== v41 layer: per-user page access + contact/POC/link amendments + language polish ===== */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sb3=null;
function client(){ if(!sb3&&window.supabase){try{sb3=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sb3; }
function isAr(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||document.documentElement.getAttribute('data-lang')==='ar';}catch(_){return false;}}
function canEdit(){return !window.__isShareView && window.__userTier!=='viewer';}
function E(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

var PAGES=window.PAGES=[['today','Today','اليوم'],['leads','Leads','العملاء المحتملون'],['clients','Clients','العملاء'],['finance','Finance','المالية'],['offers','Proposals','العروض المقدمة'],['events','Events','الفعاليات'],['projects','Projects','المشاريع'],['reports','Reports','التقارير'],['airlines','Airlines','شركات الطيران'],['vendors','Providers & GDS','الموردون'],['sopsla','SOPs & SLAs','الإجراءات والمستويات'],['ops','Operations','العمليات'],['bookings','Bookings','الحجوزات'],['invoices','Invoices','الفواتير'],['tickets','Tickets','التذاكر'],['sync','Sync & Integrations','المزامنة'],['settings','Settings','الإعدادات']];

/* ---------- 1. enforce my allowed pages ---------- */
var myPages=null; /* null = everything */
function applyGate(){
  try{
    if(window.__isShareView)return;
    if(!myPages)return;
    var allow={}; myPages.forEach(function(p){allow[p]=1;}); allow['today']=1;
    /* hide nav buttons for pages I can't open */
    document.querySelectorAll('#nav button').forEach(function(btn){
      var label=(btn.textContent||'').trim().toLowerCase();
      var pg=PAGES.find(function(p){return label.indexOf(p[1].toLowerCase())>=0||label.indexOf(p[2])>=0;});
      if(pg&&!allow[pg[0]])btn.style.display='none';
    });
    /* bounce if I'm on a page I can't open */
    if(typeof current!=='undefined'&&!allow[current]&&PAGES.some(function(p){return p[0]===current;})){
      current='today'; try{render();}catch(_){}
    }
  }catch(_){}
}
function loadMyPages(){
  var c=client(); if(!c)return;
  c.auth.getSession().then(function(s){
    if(!(s&&s.data&&s.data.session))return;
    c.from('app_users').select('allowed_pages').eq('id',s.data.session.user.id).maybeSingle().then(function(r){
      if(r.data&&Array.isArray(r.data.allowed_pages)&&r.data.allowed_pages.length){ myPages=r.data.allowed_pages; }
      applyGate();
    });
  });
}
setTimeout(loadMyPages,4000);
setInterval(applyGate,2000);
/* expose for the Team & Access page (v48) and for tests */
try{ window.applyGate=applyGate; window.__setMyPages=function(p){ myPages=(p===undefined?myPages:p); applyGate(); }; }catch(_){}

/* ---------- 2. Access manager (admins): who sees which pages ---------- */
window.v41Access=function(){
  var c=client(); if(!c)return;
  var ar=isAr();
  c.from('app_users').select('id,full_name,email,role,active,allowed_pages').then(function(r){
    if(r.error||!r.data){alert(ar?'هذه الشاشة للمسؤولين فقط.':'This screen is for admins only.');return;}
    var users=r.data;
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:999998;background:rgba(20,22,32,.55);display:flex;align-items:center;justify-content:center;padding:20px';
    var rows=users.map(function(u,i){
      var nm=E((u.full_name||'').trim()||u.email.split('@')[0]);
      var all=!Array.isArray(u.allowed_pages)||!u.allowed_pages.length;
      var chips=PAGES.map(function(p){
        var on=all||u.allowed_pages.indexOf(p[0])>=0;
        return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;background:'+(on?'#FFF3EC':'#f2f2f2')+';border:1px solid '+(on?'#F2C185':'#e3e3e3')+';border-radius:8px;padding:3px 8px;margin:2px;cursor:pointer"><input type="checkbox" data-u="'+i+'" data-p="'+p[0]+'" '+(on?'checked':'')+'> '+(ar?p[2]:p[1])+'</label>';
      }).join('');
      return '<div style="border-top:1px solid #EEE8DE;padding:12px 0"><div style="font-weight:800;font-size:13.5px">'+nm+' <span style="font-weight:400;color:#7C8194;font-size:11.5px">'+E(u.email)+' · '+E(u.role||'')+(u.active===false?' · OFF':'')+'</span></div><div style="margin-top:6px">'+chips+'</div><div style="margin-top:6px"><button class="btn sm" data-save="'+i+'">'+(ar?'حفظ صلاحيات هذا المستخدم':'Save this user\'s access')+'</button> <button class="btn ghost sm" data-all="'+i+'">'+(ar?'كل الصفحات':'Everything')+'</button></div></div>';
    }).join('');
    ov.innerHTML='<div style="background:#FBF8F4;border-radius:16px;max-width:760px;width:100%;max-height:88vh;overflow:auto;padding:24px" '+(ar?'dir="rtl"':'')+'>'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:17px;font-weight:800">'+(ar?'مستويات الوصول — من يرى ماذا':'Access levels — who sees what')+'</div><button class="btn ghost sm" id="v41x">✕</button></div>'+
      '<div class="ch-sub" style="margin:6px 0 4px">'+(ar?'حدد الصفحات المسموحة لكل زميل. "كل الصفحات" = صلاحية كاملة (المسؤولون).':'Tick the pages each colleague may open. "Everything" = full access (admins).')+'</div>'+rows+'</div>';
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    document.getElementById('v41x').onclick=function(){ov.remove();};
    ov.querySelectorAll('[data-save]').forEach(function(btn){
      btn.onclick=function(){
        var i=+btn.getAttribute('data-save'), u=users[i];
        var picked=[].slice.call(ov.querySelectorAll('input[data-u="'+i+'"]:checked')).map(function(x){return x.getAttribute('data-p');});
        var payload=(picked.length>=PAGES.length)?null:picked; /* everything = null */
        c.from('app_users').update({allowed_pages:payload}).eq('id',u.id).then(function(r2){
          if(r2.error){alert((ar?'تعذر الحفظ: ':'Could not save: ')+r2.error.message);return;}
          btn.textContent=ar?'تم الحفظ ✓':'Saved ✓'; setTimeout(function(){btn.textContent=ar?'حفظ صلاحيات هذا المستخدم':'Save this user\'s access';},1500);
        });
      };
    });
    ov.querySelectorAll('[data-all]').forEach(function(btn){
      btn.onclick=function(){var i=+btn.getAttribute('data-all');ov.querySelectorAll('input[data-u="'+i+'"]').forEach(function(x){x.checked=true;});};
    });
  });
};
/* Access button next to Team for admins */
(function addAccessBtn(n){
  try{
    if(window.__isShareView)return;
    var tools=document.querySelector('.tools');
    if(!tools){ if((n||0)<40)setTimeout(function(){addAccessBtn((n||0)+1);},500); return; }
    if(window.__userTier!=='admin'){ if((n||0)<40)setTimeout(function(){addAccessBtn((n||0)+1);},700); return; }
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
