/* ===== js/85 — "this person is also on another company" (fire #141/#142, 2026-09-20) =====

   M18 says one company, one record. The app already had a duplicate check (js/13) and it is a good
   one — it compares names AND contact e-mails. But it only runs after an in-app SAVE, on records
   the browser has just seen appear, and it says its piece in a TOAST. Both of those are fine for
   somebody typing a new lead. They are useless for how records actually arrive here: by import.

   Found on the live database on 2026-09-20. Two CLIENT records, both stage "won", one imported from
   the corporate client list and one from Inbound, share the SAME PERSON'S E-MAIL AND PHONE across
   three contact rows — and they map to TWO DIFFERENT finance client groups, so their money is
   counted apart. No merge is recorded, nothing is flagged, and no screen in the app says a word
   about it. The check that would have caught it never ran, because neither record was ever typed
   into the app.

   So this adds the missing half, and only that half: a quiet line on the company's own card saying
   the contact also appears elsewhere, and naming where. It:
     · NEVER merges, writes or changes anything — deciding two records are one company is the
       owner's call, and a wrong merge is expensive to undo;
     · says which contact detail matched, so the answer is checkable rather than a bare assertion;
     · appears on leads and clients alike, because the pair that prompted it are both clients;
     · is bilingual, and renders once per render (the .v85- guard), following the v33-v36 pattern.

   Removing this file removes the line and nothing else. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc85(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }
  function normEmail(x){ return String(x||'').trim().toLowerCase(); }
  function normPhone(x){ var d=String(x||'').replace(/[^0-9]/g,''); return d.length>=9?d.slice(-9):''; }

  /* every e-mail and phone attached to a company, from its contact rows and its own fields */
  function marks(b){
    var em={}, ph={};
    try{
      (b.contacts||[]).forEach(function(c){
        if(!c) return;
        var e=normEmail(c.email); if(e) em[e]=1;
        var p=normPhone(c.phone); if(p) ph[p]=1;
      });
      var be=normEmail(b.email); if(be) em[be]=1;
      var bp=normPhone(b.phone); if(bp) ph[bp]=1;
    }catch(_){}
    return { em:em, ph:ph };
  }

  function others(b){
    var mine=marks(b), out=[];
    try{
      (DB.businesses||[]).forEach(function(x){
        if(!x||x===b||x.id===b.id) return;
        if(x.archivedAt||x.archived_at) return;
        var m=marks(x), why='';
        for(var e in mine.em){ if(m.em[e]){ why=fl('the e-mail ','البريد ')+e; break; } }
        if(!why){ for(var p in mine.ph){ if(m.ph[p]){ why=fl('a phone number ending ','رقم ينتهي بـ ')+p.slice(-4); break; } } }
        if(why) out.push({ name:(x.name||fl('(no name)','(بلا اسم)')), why:why, isClient:!!x.isClient });
      });
    }catch(_){}
    return out.slice(0,3);
  }

  function enhance(){try{
    /* 2026-09-21 (fire #164): never in a share view. This line NAMES ANOTHER COMPANY — it is an
       internal question about our own records, and the person holding a view-only link is outside
       the company. js/02 also keeps the fields it reads out of the shared payload; this is the
       second lock, on the side that does the talking. */
    if(window.__isShareView) return;
    if(typeof current==='undefined'||current!=='leads') return;
    if(typeof openLead==='undefined'||!openLead) return;
    var b=(typeof getLead==='function')?getLead(openLead):null; if(!b) return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v85-shared')) return;            /* once per render */
    var hits=others(b); if(!hits.length) return;

    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var line=document.createElement('div');
    line.className='v85-shared';
    line.setAttribute('dir', ar?'rtl':'ltr');
    line.style.cssText='background:#FFF3EC;border:1px solid #F4C892;border-radius:10px;padding:10px 13px;margin:10px 0;font-size:12.5px;color:#7a5c00;line-height:1.6;text-align:'+(ar?'right':'left');
    var body=hits.map(function(h){
      return '• <b>'+esc85(h.name)+'</b>'+(h.isClient?(' <span style="color:#0F6E56;font-weight:700">'+fl('(a client)','(عميل)')+'</span>'):'')+
             ' — '+fl('shares ','يشترك في ')+esc85(h.why);
    }).join('<br>');
    line.innerHTML='<b>'+fl('The same person is on another company','الشخص نفسه مسجَّل على جهة أخرى')+'</b><br>'+body+
      '<br><span style="color:#8a6d1a">'+
      fl('That can be perfectly normal — one person can look after two companies in a group. It is worth a look only because two records mean two separate histories, and on a client, two separate sets of money. Nothing has been changed.',
         'قد يكون هذا طبيعيًا تمامًا — قد يتولى شخص واحد جهتين في مجموعة واحدة. يستحق النظر فقط لأن سجلين يعنيان تاريخين منفصلين، ومع العميل مبلغين منفصلين. لم يتغير شيء.')+
      '</span>';

    /* put it under the Contacts card when there is one — that is where the person is named */
    var anchor=null;
    try{
      var cards=[].slice.call(view.querySelectorAll('.card'));
      for(var i=0;i<cards.length;i++){
        var h=cards[i].querySelector('h3');
        if(h&&/contacts|جهات|الاتصال/i.test(h.textContent||'')){ anchor=cards[i]; break; }
      }
    }catch(_){}
    if(anchor&&anchor.appendChild) anchor.appendChild(line);
    else view.appendChild(line);
  }catch(e){ if(window.console)console.warn('[v85]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,60); return out; };
  }
  setTimeout(enhance,900);
  try{ window.__v85Probe=function(id){ try{ var b=(typeof getLead==='function')?getLead(id):null; return b?others(b):[]; }catch(_){ return []; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v85] init',e); }})();
