/* ===== js/86 — where this record came from, and whether it still needs confirming
   (fire #151, 2026-09-21) =====

   Counted on the live database the same day. Every company row carries three fields that the
   import and scrub pipeline writes and nobody in this app ever edits:

     · verification_source        — set on 81 of the 108 live companies. It is not a code; it is a
                                    sentence: "Contact-form submission, classified with the owner
                                    2026-08-16". That is where the record came from AND the fact
                                    that it was already vetted with him.
     · needs_manual_confirmation  — true on ONE company.
     · confirmation_reason        — and that one says why: "Organisation inferred from the email
                                    domain only — confirm the company before any outreach."

   Not one of the three reached a screen. The team has been working those 81 leads without being
   able to see that they were already classified with the owner, and the one record that carries a
   warning about itself looked exactly like every other record — so the warning reached nobody, and
   the outreach it asks you to hold off on is one click away.

   js/09's own "needs attention" filter already tests `needsManualConfirmation`, so somebody meant
   this to work; the field simply never arrived. js/02 now bridges all three from the column (fire
   #151), which makes that filter start working on its own. This file adds the visible half:

     · a quiet grey line on the company's own card saying where the record came from;
     · and, when the record is flagged, a separate amber line with the reason, above it.

   It is READ-ONLY by construction — there is no way to clear the flag from here, because clearing
   it is a judgement about a real company and belongs where the rest of that judgement lives. What
   it does is make sure the person about to call knows what the record says about itself.

   Bilingual, renders once per render (the .v86- guard), following the v33-v36 / js/85 pattern.
   Removing this file removes the two lines and nothing else. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc86(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }

  function facts(b){
    if(!b) return null;
    var src=(b.verificationSource==null?'':String(b.verificationSource).trim());
    var flagged=(b.needsManualConfirmation===true);
    var why=(b.confirmationReason==null?'':String(b.confirmationReason).trim());
    if(!src&&!flagged) return null;
    return { src:src, flagged:flagged, why:why };
  }

  function box(ar,bg,border,colour){
    var d=document.createElement('div');
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:'+bg+';border:1px solid '+border+';border-radius:10px;padding:9px 12px;margin:8px 0;'+
      'font-size:12.5px;color:'+colour+';line-height:1.6;text-align:'+(ar?'right':'left');
    return d;
  }

  function enhance(){try{
    /* 2026-09-21 (fire #164): never in a share view. "Confirm this company before reaching out —
       organisation inferred from the email domain only" is our own unfinished judgement about a
       third party; a view-only link holder is outside the company and has no business reading it.
       js/02 keeps these fields out of the shared payload too — two locks. */
    if(window.__isShareView) return;
    if(typeof current==='undefined'||current!=='leads') return;
    if(typeof openLead==='undefined'||!openLead) return;
    var b=(typeof getLead==='function')?getLead(openLead):null; if(!b) return;
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v86-origin')||view.querySelector('.v86-confirm')) return;   /* once per render */
    var f=facts(b); if(!f) return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    /* the warning first — it is the one that changes what a person does next */
    if(f.flagged){
      var w=box(ar,'#FFF3EC','#F4C892','#7a5c00');
      w.className='v86-confirm';
      w.innerHTML='<b>'+fl('Confirm this company before reaching out','تأكَّد من هذه الجهة قبل التواصل')+'</b>'+
        (f.why?('<br>'+esc86(f.why)):'')+
        '<br><span style="color:#8a6d1a">'+
        fl('This record was flagged when it was brought in. It is not saying the company is wrong — only that nobody has checked it yet.',
           'وُضعت هذه العلامة على السجل عند إدخاله. هذا لا يعني أن الجهة خاطئة — فقط أن أحدًا لم يتحقق منها بعد.')+
        '</span>';
      view.insertBefore(w, view.firstChild);
    }
    if(f.src){
      var o=box(ar,'#F6F7F9','#E6E8EC','#4B5563');
      o.className='v86-origin';
      o.innerHTML='<b>'+fl('Where this record came from','مصدر هذا السجل')+':</b> '+esc86(f.src);
      view.appendChild(o);
    }
  }catch(e){ if(window.console)console.warn('[v86]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,70); return out; };
  }
  setTimeout(enhance,900);
  try{ window.__v86Probe=function(id){ try{ var b=(typeof getLead==='function')?getLead(id):null; return facts(b); }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v86] init',e); }})();
