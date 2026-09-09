/* 77 — the Share button opens a panel, not a link (2026-09-09, live test SH1).

   Found on the live site, by hand: one click on "Share (view-only)" minted a permanent link that
   opens the whole workspace read-only to anyone holding it — no confirmation, no list of the
   links that already exist, no way to switch one off from the app. The owner pressed it once
   during the test without meaning to make anything; three older links from August were still
   open. The database side was closed the same day (own rows only; a person may switch off a link
   they made; admins see and control every link). This layer is the screen side:

     · the button opens an in-page panel that says in one sentence what a link does;
     · the panel lists this person's links (every link, for an admin): when it was made, when it
       was last used, whether it is on — with Copy and Switch off;
     · "Create a new link" asks once (js/57's in-page box, never window.confirm) and only then
       calls js/10's shareCurrentView(), which mints the row and copies the address;
     · the new link appears in the list at once.

   js/10 keeps its function and its button; this file only changes what the click does. */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function when(iso){ if(!iso)return fl('never','أبدًا'); try{ var d=new Date(iso); if(isNaN(d))return String(iso); return d.toLocaleDateString(isAr()?'ar-SA':'en-GB',{day:'numeric',month:'short',year:'numeric'})+' '+d.toLocaleTimeString(isAr()?'ar-SA':'en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return String(iso); } }
  function base(){ try{ return (/^https?:/.test(location.origin)&&location.host.indexOf('directksab2b.com')>=0)?location.origin:'https://www.directksab2b.com'; }catch(_){ return 'https://www.directksab2b.com'; } }
  function isAdmin(){ try{ return window.__userRole==='admin'; }catch(_){ return false; } }

  var ROWS=null;
  function close(){ try{ var b=document.getElementById('shareBox'); if(b)b.remove(); }catch(_){} }
  function load(cb){
    var c=client(); if(!c){ ROWS=[]; cb(fl('Not connected — try again in a moment.','غير متصل — حاول بعد لحظة.')); return; }
    c.from('share_links').select('token,scope,active,created_by,created_at,last_used_at').order('created_at',{ascending:false}).limit(200).then(function(r){
      if(r&&r.error){ ROWS=[]; cb(r.error.message||String(r.error)); return; }
      ROWS=Array.isArray(r&&r.data)?r.data:[]; cb(null);
    }).catch(function(e){ ROWS=[]; cb(String((e&&e.message)||e)); });
  }
  function list(err){
    var rows=ROWS||[];
    if(err) return '<div class="empty" data-share-err>'+esc(err)+'</div>';
    if(!rows.length) return '<div class="empty" data-share-empty>'+esc(fl('No links yet.','لا توجد روابط بعد.'))+'</div>';
    return rows.map(function(x){
      var on=x.active===true; var tail=String(x.token||'').slice(-6);
      return '<div class="fact" data-share-row="'+esc(x.token)+'" data-share-on="'+(on?'1':'0')+'" style="'+(on?'':'opacity:.6')+'">'+
        '<span class="k"><b>…'+esc(tail)+'</b> <span style="color:var(--muted);font-size:12px">· '+esc(fl('made ','أُنشئ ')+when(x.created_at))+' · '+esc(fl('last used ','آخر استخدام ')+when(x.last_used_at))+' · '+(on?'<b style="color:#0F6E56">'+esc(fl('on','مفعّل'))+'</b>':esc(fl('switched off','موقوف')))+'</span></span>'+
        '<span class="v" style="display:flex;gap:6px">'+(on?'<button class="btn sm ghost" data-share-copy="'+esc(x.token)+'">'+esc(fl('Copy','نسخ'))+'</button><button class="btn sm" data-share-off="'+esc(x.token)+'">'+esc(fl('Switch off','إيقاف'))+'</button>':'')+'</span></div>';
    }).join('');
  }
  function paint(err){
    var box=document.getElementById('shareBox'); if(!box)return;
    var l=box.querySelector('[data-share-list]'); if(l) l.innerHTML=list(err);
    var n=(ROWS||[]).filter(function(x){return x.active===true;}).length;
    var cnt=box.querySelector('[data-share-count]'); if(cnt) cnt.textContent=String(n);
  }
  function open(){
    close();
    var d=document.createElement('div'); d.id='shareBox';
    d.style.cssText='position:fixed;inset:0;z-index:999999999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
    var note=fl('A link opens Today, Leads and Clients read-only to anyone holding it — no sign-in needed — until it is switched off here. Nothing can be edited through it.',
                'الرابط يفتح «اليوم» و«العملاء المحتملين» و«العملاء» للقراءة فقط لأي شخص يحمله — دون تسجيل دخول — حتى يُوقَف من هنا. لا يمكن التعديل من خلاله.');
    d.innerHTML='<div style="background:var(--card,#fff);border-radius:12px;padding:20px 22px;width:min(640px,94vw);max-height:86vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px"><h3 style="margin:0">'+esc(fl('Share (view-only)','مشاركة (عرض فقط)'))+'</h3><span class="iconbtn" data-share-close>✕</span></div>'+
      '<div style="font-size:12.5px;color:var(--muted);line-height:1.55;margin-bottom:12px" data-share-note>'+esc(note)+'</div>'+
      '<div style="font-size:12px;font-weight:700;margin-bottom:6px">'+esc(isAdmin()?fl('Every link (admin view)','كل الروابط (عرض المسؤول)'):fl('Your links','روابطك'))+' · <span data-share-count>…</span> '+esc(fl('on','مفعّل'))+'</div>'+
      '<div data-share-list><div class="empty">'+esc(fl('Loading…','جارٍ التحميل…'))+'</div></div>'+
      '<div style="display:flex;gap:8px;justify-content:'+(isAr()?'flex-start':'flex-end')+';margin-top:14px"><button class="btn sm ghost" data-share-close>'+esc(fl('Close','إغلاق'))+'</button><button class="btn sm pri" data-share-new>'+esc(fl('Create a new link','إنشاء رابط جديد'))+'</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click',function(e){
      var t=e.target; if(!t||!t.getAttribute)return;
      if(t===d||t.hasAttribute('data-share-close')){ close(); return; }
      var cp=t.getAttribute('data-share-copy'); if(cp){ var url=base()+'/s/'+cp+'/'+((typeof current!=='undefined'&&current)||'dashboard'); var done=function(){ try{ toast(fl('Link copied.','تم نسخ الرابط.')); }catch(_){} }; try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,done); else done(); }catch(_){ done(); } return; }
      var off=t.getAttribute('data-share-off'); if(off){ switchOff(off); return; }
      if(t.hasAttribute('data-share-new')){ makeNew(); return; }
    });
    load(function(err){ paint(err); });
  }
  function switchOff(token){
    var go=function(){
      var c=client(); if(!c)return;
      c.from('share_links').update({active:false}).eq('token',token).select('token,active').then(function(r){
        var okRow=r&&!r.error&&Array.isArray(r.data)&&r.data.length===1&&r.data[0].active===false;
        if(!okRow){ try{ toast(fl('Not switched off — ','لم يُوقَف — ')+((r&&r.error&&r.error.message)||fl('the database did not accept it','لم تقبله قاعدة البيانات')),'err'); }catch(_){} return; }
        try{ toast(fl('Link switched off — it no longer opens anything.','أُوقف الرابط — لم يعد يفتح شيئًا.')); }catch(_){}
        load(function(err){ paint(err); });
      });
    };
    var msg=fl('Switch this link off?\nAnyone who has it will see "invalid link" from now on. This cannot be undone — make a new link if it is needed again.',
               'إيقاف هذا الرابط؟\nمن يحمله سيرى «رابط غير صالح» من الآن. لا يمكن التراجع — أنشئ رابطًا جديدًا عند الحاجة.');
    if(typeof window.pfConfirm==='function') window.pfConfirm(msg,go); else go();
  }
  function makeNew(){
    var go=function(){
      var before=(ROWS||[]).length;
      try{ if(typeof window.shareCurrentView==='function') window.shareCurrentView(); }catch(_){}
      var n=0; var iv=setInterval(function(){ n++; load(function(err){ paint(err); if((ROWS||[]).length>before||n>10) clearInterval(iv); }); },700);
    };
    var msg=fl('Create a new view-only link?\nAnyone holding it can read Today, Leads and Clients without signing in, until you switch it off here. The address is copied to your clipboard.',
               'إنشاء رابط عرض جديد؟\nمن يحمله يستطيع قراءة «اليوم» و«العملاء المحتملين» و«العملاء» دون تسجيل دخول حتى توقفه من هنا. سيُنسخ العنوان.');
    if(typeof window.pfConfirm==='function') window.pfConfirm(msg,go); else go();
  }
  window.shareLinksPanel=open;

  /* take over the click on js/10's button — now and after every render (js/10 re-adds it) */
  function hook(){ try{ var b=document.getElementById('cl_share'); if(b&&!b.__v77){ b.__v77=true; b.onclick=function(e){ try{ e.preventDefault(); }catch(_){} open(); }; b.setAttribute('data-share-panel','1'); } }catch(_){} }
  hook(); setInterval(hook,800);
}catch(e){ console.warn('[77 share-links-panel]',e); }})();
