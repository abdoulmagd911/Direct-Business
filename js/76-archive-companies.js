/* 76 — the Archive page lists deleted companies and can bring one back (2026-09-09, live test AR1).

   Found on the live site, by hand: the Archive page read "Archived leads 0" while four companies
   sat archived in the database, and its own footnote admitted "Deleted companies are not listed
   here … no screen restores one". Deleting a company in this app never erases it — js/02 stamps
   archived_at on the row and the loader stops fetching it — so the only way back was Activity &
   Audit → Undo inside 24 hours, then an admin in the database. A person who deleted the wrong
   company on Monday and noticed on Wednesday had no button.

   This layer wraps renderArchive and, after the original page draws, asks the database for every
   businesses row whose archived_at is set (the loader deliberately never fetches these) and adds
   one card:
     · a company deleted from a card shows who deleted it and when, with a Restore button;
       Restore clears archived_at/archived_by on the row (the database's record_history trigger
       logs that as a 'restore', so Activity & Audit shows it) and reloads the page, because the
       loader is the only thing that turns a row into a company on screen;
     · a company archived by a MERGE (archived_by = 'merged-into:<id>') is listed but gets no
       Restore button — bringing it back on its own would resurrect the duplicate the merge
       removed; the row says which company it now lives inside and that the merge is undone
       from Activity & Audit;
     · the old "Archived leads 0" tile is relabelled "Deleted companies" with the real count, and
       the footnote that promised nothing could be listed is replaced with what is true now.
   Viewers (no edit right on the page, per js/52's matrix) see the list without the button.
   Restore asks through js/57's in-page box, never window.confirm (live test D1). */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function mayEdit(){ try{ return typeof window.mayEditPage==='function'?window.mayEditPage('archive')!==false:true; }catch(_){ return true; } }
  function when(iso){ try{ var d=new Date(iso); if(isNaN(d))return ''; return d.toLocaleDateString(isAr()?'ar-SA':'en-GB',{day:'numeric',month:'short',year:'numeric'})+' '+d.toLocaleTimeString(isAr()?'ar-SA':'en-GB',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return String(iso||''); } }
  /* the app's own id for a business may be a legacy id; the database row id is the uuid — walk
     DB.businesses through js/02's map to name the company a merge folded this one into */
  function nameByUuid(u){ try{ var list=(typeof DB!=='undefined'&&DB.businesses)||[]; for(var i=0;i<list.length;i++){ var b=list[i]; if(!b)continue; var id=(window.__bizUuid?window.__bizUuid(b.id):b.id); if(id===u||b.id===u) return b.name||''; } }catch(_){} return ''; }

  var STATE={rows:null,loading:false,err:null,ticket:0,cb:null};
  function load(cb){
    STATE.cb=cb;                                            // the newest render is the one that gets told
    var c=client(); if(!c){ setTimeout(function(){ if(STATE.cb===cb) load(cb); },400); return; }
    if(STATE.loading)return; STATE.loading=true;
    var done=function(){ STATE.loading=false; var f=STATE.cb; STATE.cb=null; try{ if(f) f(); }catch(_){} };
    c.from('businesses').select('id,name,archived_at,archived_by,is_client,stage').not('archived_at','is',null).order('archived_at',{ascending:false}).limit(500).then(function(r){
      if(r&&r.error){ STATE.err=r.error.message||String(r.error); STATE.rows=[]; }
      else { STATE.err=null; STATE.rows=Array.isArray(r&&r.data)?r.data:[]; }
      done();
    }).catch(function(e){ STATE.err=String((e&&e.message)||e); STATE.rows=[]; done(); });
  }

  window.v76RestoreCompany=function(id){
    var row=(STATE.rows||[]).filter(function(x){ return x.id===id; })[0]; if(!row)return;
    var msg=fl('Bring "'+(row.name||'')+'" back to the list?\nIt returns exactly as it was when it was deleted, and the change is logged in Activity & Audit.',
               'إعادة «'+(row.name||'')+'» إلى القائمة؟\nتعود كما كانت عند حذفها، ويُسجَّل ذلك في النشاط والتدقيق.');
    var go=function(){
      var c=client(); if(!c){ try{ toast(fl('Not connected — try again in a moment.','غير متصل — حاول بعد لحظة.'),'err'); }catch(_){} return; }
      c.from('businesses').update({archived_at:null,archived_by:null}).eq('id',id).select('id,archived_at').then(function(r){
        var okRow=r&&!r.error&&Array.isArray(r.data)&&r.data.length===1&&r.data[0].archived_at==null;
        if(!okRow){
          var why=(r&&r.error&&r.error.message)||fl('the database did not accept the change (permission?)','لم تقبل قاعدة البيانات التغيير (صلاحية؟)');
          try{ toast(fl('Not restored — ','لم تُستعد — ')+why,'err'); }catch(_){}
          return;
        }
        try{ toast(fl('Restored — reloading the list…','تمت الاستعادة — يُعاد تحميل القائمة…')); }catch(_){}
        try{ localStorage.setItem('v76_restored',JSON.stringify({id:id,name:row.name||'',at:Date.now()})); }catch(_){}
        setTimeout(function(){ try{ location.reload(); }catch(_){} },900);
      }).catch(function(e){ try{ toast(fl('Not restored — ','لم تُستعد — ')+String((e&&e.message)||e),'err'); }catch(_){} });
    };
    if(typeof window.pfConfirm==='function') window.pfConfirm(msg,go); else go();
  };

  function paint(v,ticket){
    if(ticket!==STATE.ticket)return;                       // a newer render owns the page now
    if(!v||!v.isConnected)return;
    var old=v.querySelector('.v76-archived-companies'); if(old)old.remove();
    var rows=STATE.rows||[]; var edit=mayEdit();
    /* the core tile — relabel and put the real number on it */
    try{
      v.querySelectorAll('.kl').forEach(function(k){
        if(/^Archived leads$/.test((k.textContent||'').trim())||/المؤرشفون/.test(k.textContent||'')){
          k.textContent=fl('Deleted companies','الشركات المحذوفة'); var kv=k.parentNode&&k.parentNode.querySelector('.kv'); if(kv){ kv.textContent=String(rows.length); kv.setAttribute('data-archived-companies',String(rows.length)); }
        }
      });
    }catch(_){}
    var card=document.createElement('div'); card.className='card v76-archived-companies'; card.setAttribute('data-count',String(rows.length));
    var body='';
    if(STATE.err){ body='<div class="empty" data-v76-err>'+esc(fl('Could not read the deleted companies: ','تعذّر قراءة الشركات المحذوفة: ')+STATE.err)+'</div>'; }
    else if(!rows.length){ body='<div class="empty" data-v76-empty>'+esc(fl('No company has been deleted.','لم تُحذف أي شركة.'))+'</div>'; }
    else body=rows.map(function(x){
      /* Seen live (9 Sep): archived_by can be 'merged-into:<id> (was: cleanup-…)' — read the id
         token only — and 'owner-ruling-2026-08-23' on the company the owner ruled out of the
         app for good. A ruling is not a deletion anyone may reverse from a button. */
      var by=String(x.archived_by||''); var merged=/^merged-into:/.test(by); var keep=merged?by.slice('merged-into:'.length).trim().split(/\s/)[0]:''; var keepName=merged?nameByUuid(keep):'';
      var ruled=/^owner-ruling/i.test(by);
      var who=merged
        ? fl('merged into '+(keepName||'another company')+' — its records live there now; undo the merge from Activity & Audit','دُمجت في '+(keepName||'شركة أخرى')+' — سجلاتها هناك الآن؛ التراجع عن الدمج من النشاط والتدقيق')
        : ruled ? fl('removed by owner ruling ('+by.replace(/^owner-ruling-?/i,'')+') — not restorable from here','أُزيلت بقرار المالك ('+by.replace(/^owner-ruling-?/i,'')+') — لا تُستعاد من هنا')
        : fl('deleted by '+(by||'unknown'),'حذفها '+(by||'غير معروف'));
      var btn=(!merged&&!ruled&&edit)?'<button class="btn sm" data-v76-restore="'+esc(x.id)+'" onclick="v76RestoreCompany(\''+esc(x.id)+'\')">↺ '+esc(fl('Restore','استعادة'))+'</button>':'';
      return '<div class="fact" data-v76-row="'+esc(x.id)+'" data-v76-kind="'+(merged?'merged':ruled?'ruled':'deleted')+'"><span class="k archived-row"><b>'+esc(x.name||'')+'</b>'+(x.is_client?' · '+esc(fl('client','عميل')):'')+'<span style="color:var(--muted);font-size:12px"> · '+esc(who)+' · '+esc(when(x.archived_at))+'</span></span><span class="v">'+btn+'</span></div>';
    }).join('');
    card.innerHTML='<h3>'+esc(fl('Deleted companies','الشركات المحذوفة'))+' · '+rows.length+'</h3>'+body;
    /* the footnote that said nothing could be listed — replace its words with what is true now */
    var note=fl('A deleted company is archived, never erased. Restore puts it back on the list exactly as it was and is logged in Activity & Audit; a company removed by a merge is undone from there instead.',
                'الشركة المحذوفة تُؤرشَف ولا تُمحى. «استعادة» تعيدها إلى القائمة كما كانت ويُسجَّل ذلك في النشاط والتدقيق؛ أما الشركة التي أزالها دمج فيُتراجع عنه من هناك.');
    var cards=v.querySelectorAll(':scope > .card'); var last=cards[cards.length-1];
    if(last&&/Deleted companies are not listed|الشركات المحذوفة لا تظهر/.test(last.textContent||'')){ last.innerHTML='<div style="font-size:12.5px;color:var(--muted);line-height:1.6" data-v76-note>'+esc(note)+'</div>'; v.insertBefore(card,last); }
    else v.appendChild(card);
    /* the "Nothing archived yet" empty card is no longer the whole truth once a company is listed */
    if(rows.length){ v.querySelectorAll(':scope > .card > .empty').forEach(function(e){ if(/Nothing archived yet/.test(e.textContent||'')) e.parentNode.remove(); }); }
  }

  if(typeof window.renderArchive==='function'){
    var _orig=window.renderArchive;
    window.renderArchive=function(v){
      var out=_orig.apply(this,arguments);
      try{
        var ticket=++STATE.ticket;
        if(STATE.rows&&!STATE.loading) paint(v,ticket);   // show the last answer at once, then refresh it
        load(function(){ paint(v,ticket); });
      }catch(e){ console.warn('[76]',e); }
      return out;
    };
  }
  /* after a restore's reload, say what came back */
  setTimeout(function(){ try{ var s=localStorage.getItem('v76_restored'); if(!s)return; localStorage.removeItem('v76_restored'); var o=JSON.parse(s); if(o&&Date.now()-o.at<60000&&typeof toast==='function') toast(fl('"'+o.name+'" is back on the list.','«'+o.name+'» عادت إلى القائمة.')); }catch(_){} },2500);
}catch(e){ console.warn('[76 archive-companies]',e); }})();
