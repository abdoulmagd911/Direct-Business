/* v36 — Client profile is owned by Direct: collapse the duplicate onboarding form behind a
   "managed in Direct" note. The client master (registration, documents, pricing scheme, credit
   line) is the source of truth in Direct Payments — re-typing it here is the duplication trap.
   REVERSIBLE: the local full form is untouched (v22OpenClientOnboarding still exists) and stays
   reachable via a quiet fallback link + the "Edit client profile (full form)" button. Removing
   this block restores the loud "KSA onboarding" button on the next render — nothing is deleted. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function directHref(b){try{var f=(window.pdLink||(typeof pdLink==='function'?pdLink:null));return f?f(b):'https://payments.directksa.com/en/admin';}catch(e){return 'https://payments.directksa.com/en/admin';}}
  function enhance(){try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(typeof openLead==='undefined'||!openLead)return;
    var b=(typeof getLead==='function')?getLead(openLead):null; if(!b||!b.isClient)return; // clients only
    var view=document.getElementById('view'); if(!view)return;
    // (a) hide the redundant loud "KSA onboarding" button — a duplicate of "Edit client profile (full form)"
    var loud=view.querySelector('.v22OnboardBtn'); if(loud) loud.style.display='none';
    // (b) fold the "managed in Direct" reflection INTO the v34 Direct-link strip, so the client
    //     detail shows ONE Direct strip. v34 is client-only and reliably present; if it is ever
    //     absent, the "Edit client profile (full form)" button still reaches the local form, so we
    //     simply do nothing rather than risk a competing second strip.
    var stray=view.querySelector('.v36-managed'); if(stray&&stray.parentNode) stray.parentNode.removeChild(stray); // heal any legacy standalone strip
    var link=view.querySelector('.v34-link'); if(!link) return;
    if(link.querySelector('.v36-inline')) return; // already folded in this render
    var sp=document.createElement('span'); sp.className='v36-inline';
    sp.style.cssText='display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--muted,#7C8194)';
    sp.innerHTML='<span style="color:var(--line-2,#d7dae2)">|</span>'
      +'<span>🏛 '+fl('Profile &amp; pricing in','الملف والتسعير في')+' <b>Direct</b></span>'
      +'<a class="chiplink" href="'+directHref(b)+'" target="_blank" rel="noopener" style="font-size:11.5px">'+fl('Manage ↗','إدارة ↗')+'</a>'
      +'<a href="javascript:void 0" class="v36-local" style="color:#8A8F9E;text-decoration:underline;cursor:pointer;font-size:11px;white-space:nowrap">'+fl('local form','النموذج المحلي')+'</a>';
    var lf0=sp.querySelector('.v36-local'); if(lf0) lf0.onclick=function(e){e.preventDefault();try{window.v22OpenClientOnboarding(openLead);}catch(_){}};
    link.appendChild(sp);
  }catch(e){if(window.console)console.warn('[v36] enhance',e);}}
  try{ var _r=window.render; window.render=function(){var x=_r.apply(this,arguments);setTimeout(enhance,110);return x;}; }catch(_){}
  console.info('%c[v36] client profile managed-in-Direct note loaded','color:#9AA1B6;font-weight:700');
}catch(e){if(window.console)console.warn('[v36] init',e);}})();
