/* ===== js/106 — "the owner is told": changes colleagues made to your companies, on Today
   (D7, 2026-09-25) =====

   The owner's ruling (DECISIONS D7): helpers, not locks. Everyone on the team may change any
   company, because they cover for each other; what keeps that safe is that every change is recorded
   (record_history: who, when, before, after), it can be undone for 24 hours, and the OWNER IS TOLD.
   This is the telling: one card on Today, only when somebody other than you changed one of the
   companies you own in the last seven days.

   Where the answer comes from: the database function changes_to_my_companies(days)
   (scripts/sql/d7-changes-to-my-companies.sql). It reads the history of companies, their contacts
   and client profiles, keeps changes made by somebody else, and only for companies whose owner
   ACCOUNT (businesses.owner_id, Phase 1b-E) is you. It runs as you, so it shows nothing you could
   not already read. This file only draws it.

   Deliberate choices:
     · Nothing to say = no card. A failed load also draws nothing — the card never claims "no
       changes"; it only reports changes it actually received (M27).
     · At most five, newest first, with the count of the rest. Each names who, when, which company
       and which fields changed, in words; the company opens in one click, where its "Recent changes"
       shows the before and after and offers Undo.
     · Read-only. It changes nothing and records nothing.
   Removing this file removes the card and nothing else. */
(function(){try{
  var DAYS=7, SHOW=5, CACHE_MS=60000;
  var cache=null, cacheAt=0, inflight=false;
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc6(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }

  /* the fields a person recognises, in both languages; anything else is shown by its own name */
  var WORDS={
    name:['Name','الاسم'], name_ar:['Arabic name','الاسم بالعربية'], stage:['Stage','المرحلة'],
    assigned_to:['Owner','المسؤول'], account_manager:['Account manager','مدير الحساب'],
    notes:['Notes','الملاحظات'], next_action:['Next action','الإجراء التالي'], next_action_date:['Next action date','تاريخ الإجراء التالي'],
    is_client:['Client status','حالة العميل'], archived_at:['Archived','الأرشفة'], phone:['Phone','الهاتف'],
    email:['Email','البريد'], website:['Website','الموقع'], city:['City','المدينة'], sector:['Sector','القطاع'],
    segment:['Segment','الشريحة'], tier:['Tier','الفئة'], funnel:['Funnel','المسار'], funnel_details:['Funnel answers','إجابات المسار'],
    payment_terms:['Payment terms','شروط الدفع'], credit_limit:['Credit limit','حد الائتمان'],
    raw:['Details','التفاصيل'], title:['Title','المسمى'], role:['Role','الدور'], mobile:['Mobile','الجوال']
  };
  var SKIP={updated_at:1, created_at:1, owner_id:1, id:1, business_id:1, legacy_id:1};
  function word(k){ var w=WORDS[k]; return w?fl(w[0],w[1]):String(k).replace(/_/g,' '); }
  function changedFields(before, after){
    try{
      if(!before||!after) return [];
      var keys={}; Object.keys(before).forEach(function(k){keys[k]=1;}); Object.keys(after).forEach(function(k){keys[k]=1;});
      var out=[];
      Object.keys(keys).forEach(function(k){
        if(SKIP[k]) return;
        if(JSON.stringify(before[k])!==JSON.stringify(after[k])) out.push(k);
      });
      /* the raw copy follows every column; name it only when nothing else changed */
      if(out.length>1) out=out.filter(function(k){ return k!=='raw'; });
      return out;
    }catch(_){ return []; }
  }
  function what(r){
    var thing = r.table_name==='contacts' ? fl('a contact','جهة اتصال') : r.table_name==='client_profiles' ? fl('a client profile','ملف العميل') : '';
    var a=String(r.action||'');
    if(a==='create') return thing ? fl('added ','أضاف ')+thing : fl('added the company','أضاف الشركة');
    if(a==='delete') return thing ? fl('removed ','حذف ')+thing : fl('deleted the company','حذف الشركة');
    if(a==='archive') return fl('archived the company','أرشف الشركة');
    if(a==='restore') return fl('restored the company','استعاد الشركة');
    var f=changedFields(r.before_row, r.after_row);
    var list=f.slice(0,4).map(word).join(isAr()?'، ':', ')+(f.length>4?(isAr()?' وغيرها':' and more'):'');
    if(thing) return fl('changed ','عدّل ')+thing+(list?(' ('+list+')'):'');
    return list ? fl('changed ','عدّل ')+list : fl('changed the company','عدّل الشركة');
  }
  function ago(t){
    try{
      var ms=Date.now()-new Date(t).getTime(); if(!(ms>=0)) return '';
      var m=Math.round(ms/60000);
      if(m<60) return m<=1?fl('just now','الآن'):fl(m+' min ago','قبل '+m+' دقيقة');
      var h=Math.round(m/60); if(h<24) return fl(h+' h ago','قبل '+h+' ساعة');
      var d=Math.round(h/24); return fl(d+(d===1?' day ago':' days ago'),'قبل '+d+' يوم');
    }catch(_){ return ''; }
  }

  function load(then){
    if(cache && Date.now()-cacheAt<CACHE_MS){ then(cache); return; }
    if(inflight) return;
    var c=client(); if(!c||!c.rpc) return;
    if(window.__roleKnown!==true) return;
    inflight=true;
    c.rpc('changes_to_my_companies',{p_days:DAYS}).then(function(r){
      inflight=false;
      if(!r||r.error||!Array.isArray(r.data)) return;      /* a failed read draws nothing — never "no changes" */
      cache=r.data; cacheAt=Date.now(); then(cache);
    }).catch(function(){ inflight=false; });
  }

  /* the database names a company by its row id; the app may know it by its older id (legacy_id) */
  function appId(uuid){
    try{
      var m=window.__ROWID||{};
      for(var k in m){ if(Object.prototype.hasOwnProperty.call(m,k) && m[k]===uuid) return k; }
    }catch(_){}
    return uuid;
  }
  window.v106OpenCompany=function(uuid){
    try{ current='leads'; openLead=appId(uuid); if(typeof render==='function') render(); }catch(_){}
  };

  function draw(rows){try{
    if(typeof current==='undefined'||current!=='today') return;
    if(window.__isShareView) return;
    var view=document.getElementById('view'); if(!view) return;
    var old=view.querySelector('.v106-changes'); if(old) old.remove();
    if(!rows||!rows.length) return;
    var ar=isAr();
    var shown=rows.slice(0,SHOW), rest=rows.length-shown.length;
    var d=document.createElement('div');
    d.className='v106-changes';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:#F4F8FF;border:1px solid #B9D3F5;border-radius:10px;padding:11px 14px;margin:0 0 12px;font-size:12.5px;line-height:1.7;color:#1F3B63;text-align:'+(ar?'right':'left');
    d.innerHTML='<b>'+fl('Colleagues changed your companies','زملاؤك عدّلوا شركاتك')+'</b> '+
      '<span style="opacity:.8">'+fl('— last '+DAYS+' days','— آخر '+DAYS+' أيام')+'</span><br>'+
      shown.map(function(r){
        return '• <b>'+esc6(r.actor_name||fl('Someone','شخص ما'))+'</b> '+esc6(what(r))+' — '+
          '<a href="javascript:void 0" data-v106-open="'+esc6(r.business_id)+'" style="color:inherit;font-weight:700;text-decoration:underline">'+esc6(r.business_name||'')+'</a>'+
          ' <span style="opacity:.75">'+esc6(ago(r.at))+'</span>';
      }).join('<br>')+
      (rest>0?('<br>'+fl('and '+rest+' more','و'+rest+' غيرها')):'')+
      '<br><span style="opacity:.8">'+fl(
        'Each company\'s "Recent changes" shows the before and after, and Undo puts a change back within 24 hours.',
        'قسم «آخر التغييرات» في بطاقة كل شركة يعرض ما قبل التغيير وما بعده، ويمكن التراجع خلال 24 ساعة.')+'</span>';
    d.addEventListener('click',function(e){
      var a=e.target&&e.target.closest?e.target.closest('[data-v106-open]'):null;
      if(a){ e.preventDefault(); window.v106OpenCompany(a.getAttribute('data-v106-open')); }
    });
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v106]',e); }}

  function pass(){ try{ if(typeof current!=='undefined'&&current==='today') load(draw); }catch(_){} }
  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(pass,120); return out; };
  }
  /* Keep it drawn. Some layers re-draw Today WITHOUT going through window.render (found 2026-09-25:
     after the levels arrive the page is rebuilt and the card was gone until the next ordinary render —
     measured, not guessed). So while Today is open and the card is missing, draw it again from what
     was already read (a fresh read at most once a minute, via load()'s cache). Cheap: one lookup. */
  setInterval(function(){
    try{
      if(window.__roleKnown!==true) return;
      if(typeof current==='undefined'||current!=='today') return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v106-changes')) return;
      pass();
    }catch(_){}
  },1500);
  try{ window.__v106Probe={ changedFields:changedFields, what:what }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v106] init',e); }})();
