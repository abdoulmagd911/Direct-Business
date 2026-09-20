/* ===== js/92 — the Airlines page says when the register has more than it is showing
   (fire #171, 2026-09-20) =====

   There are two stores of airlines, and the page reads the smaller one.

     · `app_state.data.airlines` — a copy inside the settings record. **136 airlines, 26 with
       contact details.** This is what the Airlines page draws; no code in the app ever fetches the
       table.
     · the `airlines` table — **139 airlines, 30 with contact details**, `contacts_updated_at`
       stamped 2026-06-28 on 28 of them.

   Measured live: `DB.airlines` holds 136, the table holds 139, and the three that never arrive are
   **6Y Sereen Air**, **PF Air Sial** — which the register marks as operating in Saudi Arabia — and
   the legacy **XX** bucket row. Nothing on the page suggested anything was missing; the list simply
   ended at 136.

   This does not change where the page reads from. Moving a whole page off the settings blob and
   onto its real table means moving its saves too, and CLAUDE.md already carries that as a known
   structural job ("Moving those into real tables is the fix") — a QA round should not start it
   halfway. It is written up as an open question instead.

   What this layer does is stop the list being quietly wrong: it asks the register how many records
   it holds and, when that is more than the page is showing, says so in one line and names what is
   missing. Following #159's rule for the Events list — a stale copy is fine; a stale copy
   presenting itself as the whole truth is not — and M32's, that a screen must not be more confident
   than the data behind it.

   **It says nothing when the two agree**, so the day the page is moved onto the table this line
   disappears by itself rather than becoming decoration.

   Bilingual, renders once per render (the .v92- guard), never in a share view. Removing this file
   removes the line and nothing else. */
(function(){try{
  var CACHE=null, ASKED=false;

  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc92(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }

  function ask(){
    if(ASKED) return; var c=client(); if(!c) return; ASKED=true;
    try{
      c.from('airlines').select('code,name,contacts').then(function(r){
        if(r.error){ CACHE={error:true}; return; }
        CACHE={ error:false, rows:(r.data||[]) };
        try{ if(typeof current!=='undefined'&&current==='airlines'&&typeof render==='function')render(); }catch(_){}
      });
    }catch(_){ ASKED=false; }
  }

  function gap(){
    if(!CACHE||CACHE.error||!CACHE.rows) return null;
    var shown={}, shownContacts=0;
    try{
      (DB.airlines||[]).forEach(function(a){
        var k=String((a&&a.code)||'').toUpperCase().trim(); if(k)shown[k]=1;
        var cs=a&&a.contacts; if(cs&&cs.length)shownContacts++;
      });
    }catch(_){ return null; }
    var missing=[], regContacts=0;
    CACHE.rows.forEach(function(r){
      var k=String(r.code||'').toUpperCase().trim();
      if(r.contacts&&r.contacts.length)regContacts++;
      if(k&&!shown[k]) missing.push({code:k,name:String(r.name||'')});
    });
    if(!missing.length && regContacts<=shownContacts) return null;      /* in step — say nothing */
    return { missing:missing, regContacts:regContacts, shownContacts:shownContacts,
             register:CACHE.rows.length, showing:Object.keys(shown).length };
  }

  function enhance(){try{
    if(window.__isShareView) return;
    if(typeof current==='undefined'||current!=='airlines') return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v92-gap')) return;                 /* once per render */
    ask();
    var g=gap(); if(!g) return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    var d=document.createElement('div');
    d.className='v92-gap';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:#FFF3EC;border:1px solid #F4C892;border-radius:10px;padding:9px 12px;'+
      'margin:0 0 10px;font-size:12.5px;color:#7a5c00;line-height:1.65;text-align:'+(ar?'right':'left');

    var bits=[];
    bits.push('<b>'+fl('This list is a copy, and the airline register has more',
                       'هذه القائمة نسخة، وسجل شركات الطيران يحتوي على المزيد')+'</b>');
    bits.push(fl('Showing '+g.showing+' of '+g.register+' airlines.',
                 'يُعرض '+g.showing+' من '+g.register+' شركة طيران.'));
    if(g.missing.length){
      var names=g.missing.slice(0,4).map(function(m){ return esc92(m.name||m.code)+' ('+esc92(m.code)+')'; }).join(' · ');
      bits.push(fl('Not shown here: ','غير معروضة هنا: ')+names+
        (g.missing.length>4?fl(' and '+(g.missing.length-4)+' more',' و'+(g.missing.length-4)+' أخرى'):'')+'.');
    }
    if(g.regContacts>g.shownContacts){
      bits.push(fl('The register also has contact people for '+(g.regContacts-g.shownContacts)+
                   ' airline(s) that this list does not carry.',
                   'كما يحتوي السجل على جهات اتصال لـ '+(g.regContacts-g.shownContacts)+
                   ' شركة طيران لا تحملها هذه القائمة.'));
    }
    bits.push('<span style="color:#8a6d1a">'+
      fl('Editing here changes the copy, not the register.',
         'التعديل هنا يغيّر النسخة، لا السجل.')+'</span>');
    d.innerHTML=bits.join('<br>');
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v92]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,80); return out; };
  }
  setTimeout(enhance,1200);
  try{ window.__v92Probe=function(){ try{ return gap(); }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v92] init',e); }})();
