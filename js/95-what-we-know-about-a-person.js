/* ===== js/95 — where a person's record came from, and why one needs confirming
   (fire #177, 2026-09-20) =====

   Fire #151 did this for companies. The same three fields exist on the **people** table and had
   never been carried across.

   Counted on the live database: of the 45 contacts, **10 carry a verification source** — the same
   sentence the companies carry, *"Contact-form submission, classified with the owner 2026-08-16"* —
   and **2 are flagged `needs_manual_confirmation` with a reason**.

   What was on screen before this file:
     · the provenance sentence: **nothing**. js/72 never even asked the database for the column, so
       ten people whose record was already vetted with the owner looked exactly like a name typed in
       by somebody yesterday;
     · the confirmation reason: **a `title` tooltip on a small amber badge**. That is invisible on a
       phone, invisible to anyone who does not hover, and invisible when printed. #151's rule was
       that a warning nobody passes is not a warning — a hover is not passing it.

   This layer puts both in words under the person they belong to: the reason first, because it
   changes what somebody does next, and the quiet grey provenance line after it.

   It is READ-ONLY by construction. Clearing a confirmation flag is a judgement about a real person
   at a real company and belongs where the rest of that judgement lives, not behind a button on a
   list.

   Bilingual, once per render (the .v95- guard), never in a share view — M28/M29: these are our own
   notes about a third party, and a link holder is outside the company.

   Removing this file removes the two lines and nothing else; the badge and the tooltip stay exactly
   as they are. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc95(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }

  function people(){
    try{
      if(typeof current==='undefined'||(current!=='leads'&&current!=='clients')) return null;
      if(typeof openLead==='undefined'||!openLead) return null;
      var b=(typeof getLead==='function')?getLead(openLead):null;
      return (b&&b.contacts&&b.contacts.length)?b.contacts:null;
    }catch(_){ return null; }
  }

  function line(text,tone,ar){
    var d=document.createElement('div');
    d.className='v95-note';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='margin-top:3px;font-size:11.5px;line-height:1.55;text-align:'+(ar?'right':'left')+';'+
      (tone==='warn'?'color:#B54708;font-weight:600':'color:#6B7480');
    d.innerHTML=text;
    return d;
  }

  function enhance(){try{
    if(window.__isShareView) return;
    var list=people(); if(!list) return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v95-note')) return;               /* once per render */
    var rows=view.querySelectorAll('.contact-row');
    if(!rows.length) return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    /* the rows are drawn in the same order as b.contacts (core-02 maps straight over it) */
    for(var i=0;i<rows.length&&i<list.length;i++){
      var c=list[i]; if(!c) continue;
      var host=rows[i].querySelector('div[style*="flex:1"]')||rows[i];
      var why=(c.confirmReason==null?'':String(c.confirmReason).trim());
      var src=(c.verificationSource==null?'':String(c.verificationSource).trim());

      if(c.needsConfirm===true){
        host.appendChild(line('<b>'+fl('Confirm this person before using the details','تأكَّد من هذا الشخص قبل استخدام بياناته')+'</b>'+
          (why?('<br>'+esc95(why)):''),'warn',ar));
      }
      if(src){
        host.appendChild(line('<b>'+fl('Where this came from','مصدر هذا السجل')+':</b> '+esc95(src),'quiet',ar));
      }
    }
  }catch(e){ if(window.console)console.warn('[v95]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,110); return out; };
  }
  setTimeout(enhance,1200);
  try{ window.__v95Probe=function(){ try{
    var v=document.getElementById('view');
    return { notes: v?v.querySelectorAll('.v95-note').length:-1 };
  }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v95] init',e); }})();
