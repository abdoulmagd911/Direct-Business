/* ===== js/103 — a link to a company that is no longer there says where it went
   (fire #212, 2026-09-22) =====

   Three of the four companies in this workspace's Archive were removed by a MERGE — their records
   now live on another company's card. Anyone holding a link to one of them (a bookmark, a line in
   an e-mail, a message to a colleague, another system's note) gets this, measured live:

       /leads/lead/<id of a merged company>   →   the Leads list. URL rewritten to /leads.
                                                  2,182 characters of page, not one of them about
                                                  the company that was asked for.

   Same for a client link, and same for an id that never existed. `leadDashboard` does
   `const b=getLead(id); if(!b){ openLead=null; return renderLeads(v); }` — a silent fallback, and
   silent is the problem: the person cannot tell whether the company was deleted, merged, renamed,
   or whether they mistyped. The app knows the answer — the Archive page prints it for each of the
   four — it just never told the one person who asked.

   This layer reads the address the page OPENED at (js/03 publishes `__bootPath` precisely because
   location.pathname is rewritten a few hundred ms into boot), and when that address named a record
   the workspace does not hold, it says which of the three things happened:

     · merged      — "… was merged into <company>. Its records are on <company>'s card now."
                     with a button that opens that card;
     · deleted     — "… was deleted on <date>. You can bring it back from the Archive page."
                     with a button that opens Archive;
     · not found   — "There is no record at that address. It may have been deleted long ago, or
                     the link may be wrong." — said plainly rather than guessed at.

   It asks js/76 for the archived row (that file already fetches exactly this and knows what a
   merge looks like) instead of running a second query with a second idea of what "archived" means,
   and it speaks through js/63's notice card — the same card the "saved onto a deleted record"
   warning and js/102 use. Bilingual. Said once per page load.

   Removing this file removes the message and nothing else.                                       */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function when(iso){ try{ var d=new Date(iso); if(isNaN(d))return ''; return d.toLocaleDateString(isAr()?'ar':'en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(_){ return String(iso||''); } }

  /* the address the tab opened at — NOT location.pathname, which js/03 rewrites during boot */
  function asked(){
    var path=''; try{ path=String(window.__bootPath||''); }catch(_){}
    if(!path) return null;
    var m=path.match(/^\/([a-zA-Z]+)\/(lead|client)\/([^\/?#]+)/);
    return m?{sec:m[1],kind:m[2],id:decodeURIComponent(m[3])}:null;
  }
  function have(id){ try{ return !!(typeof getLead==='function'&&getLead(id)); }catch(_){ return false; } }

  function say(a){
    var open=function(what,arg){
      /* one button, and it must land somewhere real */
      if(what==='card') return "openLead='"+String(arg).replace(/'/g,'')+"';current='leads';render();";
      return "current='archive';openLead=null;render();";
    };
    var finish=function(html){
      try{ if(typeof window.v63Notice==='function'){ window.v63Notice(html); return; } }catch(_){}
      try{ if(typeof toast==='function') toast(String(html).replace(/<[^>]+>/g,' '),'err'); }catch(_){}
    };
    try{
      if(typeof window.v76LookupArchived!=='function'){
        finish(fl('The link you opened points at a record this workspace does not hold. It may have been deleted, or the link may be wrong.',
                  'الرابط الذي فتحته يشير إلى سجل غير موجود في مساحة العمل. ربما حُذف، أو أن الرابط غير صحيح.'));
        return;
      }
      window.v76LookupArchived(a.id,function(row){
        if(!row){
          finish(fl('There is no record at that address. It may have been deleted long ago, or the link may be wrong.',
                    'لا يوجد سجل على هذا العنوان. ربما حُذف منذ وقت طويل، أو أن الرابط غير صحيح.'));
          return;
        }
        var merged=(typeof window.v76MergedInto==='function')?window.v76MergedInto(row):null;
        var nm=esc(row.name||'');
        if(merged){
          var into=merged.name?esc(merged.name):fl('another company','شركة أخرى');
          finish(fl('“'+nm+'” was merged into “'+into+'”. Its records are on that company’s card now — the link you followed points at the old one.',
                    '«'+nm+'» دُمجت في «'+into+'». سجلاتها الآن على بطاقة تلك الشركة — والرابط الذي فتحته يشير إلى السجل القديم.'));
          /* the survivor is a live record, so its app id is the one the card opens with */
          try{
            var list=(typeof DB!=='undefined'&&DB.businesses)||[],i,hit=null;
            for(i=0;i<list.length;i++){ var b=list[i]; if(!b)continue; var u=(window.__bizUuid?window.__bizUuid(b.id):b.id); if(u===merged.uuid||b.id===merged.uuid){ hit=b; break; } }
            if(hit) addButton(fl('Open '+(hit.name||'the company'),'فتح '+(hit.name||'الشركة')), open('card',hit.id));
          }catch(_){}
          return;
        }
        /* not every removal can be undone, and saying "you can bring it back" about one that
           cannot is worse than saying nothing. js/76 refuses a Restore button on a company the
           owner ruled out of the app (archived_by = 'owner-ruling-…'); this says the same thing
           rather than inventing a second policy. */
        if(/^owner-ruling/i.test(String(row.archived_by||''))){
          finish(fl('“'+nm+'” was removed from this app by an owner ruling'+(row.archived_at?(' on '+when(row.archived_at)):'')+'. It is listed on the Archive page, but it is not brought back from there.',
                    '«'+nm+'» أُزيلت من هذا التطبيق بقرار المالك'+(row.archived_at?(' في '+when(row.archived_at)):'')+'. وهي مدرجة في صفحة الأرشيف، لكنها لا تُستعاد من هناك.'));
          addButton(fl('Open Archive','فتح الأرشيف'), open('archive'));
          return;
        }
        finish(fl('“'+nm+'” was deleted'+(row.archived_at?(' on '+when(row.archived_at)):'')+'. Nothing was erased — you can bring it back from the Archive page.',
                  '«'+nm+'» حُذفت'+(row.archived_at?(' في '+when(row.archived_at)):'')+'. لم يُمحَ شيء — يمكنك إعادتها من صفحة الأرشيف.'));
        addButton(fl('Open Archive','فتح الأرشيف'), open('archive'));
      });
    }catch(_){}
  }
  /* the notice card owns its own OK button; a second, primary button is added beside it so the
     message ends somewhere the person can act, not just somewhere they can dismiss */
  function addButton(label,js){
    try{
      var card=document.getElementById('v63Notice'); if(!card) return;
      var row=card.lastElementChild; if(!row) return;
      if(row.querySelector('.v103-go')) return;
      var b=document.createElement('button');
      b.className='btn sm pri v103-go'; b.style.cssText='margin-'+(isAr()?'left':'right')+':8px';
      b.textContent=label;
      b.onclick=function(){ try{ card.remove(); }catch(_){} try{ (new Function(js))(); }catch(_){} };
      row.insertBefore(b,row.firstChild);
    }catch(_){}
  }

  var tries=0;
  (function wait(){
    tries++;
    var a=asked(); if(!a) return;                      /* an ordinary visit — nothing to say */
    var ready=false;
    try{ ready=!!document.body && typeof window.v63Notice==='function' && !document.getElementById('cl_email')
      && (window.__bizTableLoaded===true || tries>60); }catch(_){ ready=false; }
    if(ready){
      /* the record may simply not have arrived yet on a slow load — only speak once the workspace
         says it finished, and even then give the injection layers a moment */
      setTimeout(function(){ try{ if(!have(a.id)) say(a); }catch(_){} },1200);
      return;
    }
    if(tries<240) setTimeout(wait,500);
  })();
}catch(e){ try{ console.warn('[103]',e); }catch(_){} }})();
