/* ===== Client card extras — one chapter, one file (Step 1, chapter 4 — 2026-08-15) =====

   The three decorations a CLIENT's card gets when opened from the Leads page:
     part 1 (was js/23-v29)  the Finance panel — the client's invoices and totals (.v29-fin)
     part 2 (was js/29-v36)  the "profile is owned by Direct" strip (.v36-inline/.v36-local)
     part 3 (was js/38-v62)  sidebar context: highlight Clients, add "Back to clients"

   All three only wrap render() with a small post-draw decoration, all three bail unless a
   client is open. Anchored at slot 38 — the latest of the three old slots — so the extras
   are painted after the layers that assemble and reorganise the card body (27, 28, 30, 32,
   36, 37). Proven equivalent by fingerprint: the same panels, the same back button, and
   the same heading order on the same client card, before and after the merge.            */

/* ---------- part 1 — the Finance panel on a client card (was js/23-v29) ---------- */
/* v29 — Customer 360: show a client's/lead's finance snapshot on their detail page,
   and link out to the Finance ledger. SAFETY: finance invoices key to a client only by
   NAME (client_group), so this matches ONLY on an exact normalised name — it errs toward
   showing NOTHING rather than the wrong company's money. Additive card, reversible. */
(function(){try{
  var fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  function norm(s){return String(s==null?'':s).toLowerCase().replace(/[\s\-_.,&()]+/g,' ').replace(/\b(co|company|ltd|llc|est|group|est\.)\b/g,'').replace(/\s+/g,' ').trim();}
  function injectFinance(){
    try{
      if(typeof current==='undefined'||(current!=='leads'&&current!=='clients'))return;
      if(typeof openLead==='undefined'||!openLead)return;
      if(typeof leadDetailView!=='undefined'&&leadDetailView!=='detail')return;
      var view=document.getElementById('view'); if(!view)return;
      var head=view.querySelector('.detail-head'); if(!head)return;
      if(view.querySelector('.v29-fin'))return; // already injected this render
      var biz=(typeof getLead==='function')?getLead(openLead):null; if(!biz||!biz.name)return;
      // Money lives on the Finance page ONLY — owner ruling 2026-08-21, and it means
      // Leads AND Clients, not just Clients. This card still shows (both pages, lead or
      // client) so people can see there's a finance record and jump to it, but it never
      // prints an amount — invoice count, last invoice date, and a link out, nothing else.
      // finance data loads async; kick it off once, re-render when ready
      var FIN=window.FIN, finLoad=window.finLoad;
      if(!FIN)return;
      if(FIN.rows==null){ if(!FIN.loading && typeof finLoad==='function'){ finLoad(function(){ try{if(typeof render==='function')render();}catch(_){}}); } return; }
      // Prefer the confirmed client↔finance link (join by business id); fall back to exact name
      // only when this client has no link row yet — never guesses a wrong company's money.
      var bizUuid=(window.__bizUuid?window.__bizUuid(biz.id):biz.id);
      var linkedGroups=(window.FIN&&FIN.groupsByBiz&&bizUuid)?FIN.groupsByBiz[bizUuid]:null;
      var rows, matchedByLink=false;
      if(linkedGroups&&linkedGroups.length){
        var gset={}; linkedGroups.forEach(function(g){gset[g]=1;});
        rows=FIN.rows.filter(function(r){ return !r.deleted_at && gset[r.client_group]; });
        matchedByLink=true;
      } else {
        var target=norm(biz.name); if(!target)return;
        rows=FIN.rows.filter(function(r){ if(r.deleted_at)return false; return norm(r.client_group)===target || norm(r.customer_raw_name)===target; });
      }
      if(!rows.length)return; // nothing linked or matched -> show nothing (never a wrong match)
      var cg=rows[0].client_group||biz.name,last='',_inv={};
      rows.forEach(function(r){ _inv[r.invoice_no||('row'+Math.random())]=1; if((r.invoice_date||'')>last)last=r.invoice_date||''; });
      var nInv=Object.keys(_inv).length;
      var card=document.createElement('div');
      card.className='card v29-fin';
      card.style.cssText='margin:0 0 14px';
      var mini=function(lbl,val,col){return '<div style="flex:1;min-width:100px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:18px;font-weight:800;color:'+(col||'#1C1E2B')+'">'+val+'</div></div>';};
      card.innerHTML='<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
          '<h3 style="margin:0">'+fl('Finance','المالية')+'</h3>'+
          '<button class="btn sm" onclick="try{current=\'finance\';FIN.tab=\'ledger\';FIN.f.client='+JSON.stringify(cg).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+';render();}catch(e){}">'+fl('Open in Finance ledger ↗','افتح في سجل المالية ↗')+'</button></div>'+
        '<div class="ch-sub" style="margin:2px 0 12px">'+(matchedByLink
            ? fl('Linked to Direct finance · '+nInv+' invoice'+(nInv>1?'s':''),'مرتبطة بمالية دايركت · '+nInv+' فاتورة')
            : (fl('Matched to '+nInv+' invoice'+(nInv>1?'s':'')+' by name — not linked yet; ','مطابَقة بـ '+nInv+' فاتورة حسب الاسم — غير مرتبطة بعد؛ ')+'<span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">'+fl('link it now.','اربطها الآن.')+'</span>'))+'</div>'+
        '<div style="display:flex;gap:18px;flex-wrap:wrap">'+
          mini(fl('Invoices','عدد الفواتير'),String(nInv))+
          mini(fl('Last invoice','آخر فاتورة'),last||'—')+
        '</div>';
      head.insertAdjacentElement('afterend',card);
      // sync the "Invoices" count on the Key facts card to this real finance-linked figure —
      // never touches an amount, this panel doesn't have one to sync.
      var facts=view.querySelectorAll('.fact');
      for(var fi=0;fi<facts.length;fi++){ var kk=facts[fi].querySelector('.k'), vv=facts[fi].querySelector('.v'); if(!kk||!vv)continue;
        var kt=(kk.textContent||'').trim();
        if(kt==='Invoices'||kt==='عدد الفواتير'){ vv.textContent=String(nInv); }
      }
    }catch(e){ if(window.console)console.warn('[v29] fin snapshot',e); }
  }
  window.v29InjectFinance=injectFinance;
  if(typeof render==='function'){ var _r29=render; window.render=function(){ var o=_r29.apply(this,arguments); injectFinance(); return o; }; }
  injectFinance();
}catch(e){ if(window.console)console.warn('[v29] init',e); }})();

/* ---------- part 2 — owned-by-Direct strip (was js/29-v36) ---------- */
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

/* ---------- part 3 — sidebar context + back button (was js/38-v62) ---------- */
/* v62 — a CLIENT's card should feel like Clients, not Leads (owner note 2026-08-12).
   The record card is one shared component (so history + reports keep working across the
   lead→client life). What changes is the furniture: when the open record is a client,
   the page title says Clients, the pipeline stage chips hide, and Back goes to Clients. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  var _r=window.render;
  if(typeof _r!=='function'||window.__v62)return; window.__v62=true;
  window.render=function(){var out=_r.apply(this,arguments);try{
    if(current==='leads'&&typeof openLead!=='undefined'&&openLead){
      var b=(typeof getLead==='function')?getLead(openLead):null;
      if(b&&b.isClient){
        var t=document.getElementById('vTitle'); if(t&&/Leads|العملاء المحتملون/.test(t.textContent))t.textContent=fl('Clients','العملاء');
        /* the sidebar highlight should sit on Clients too, not Leads */
        try{ var nav=document.getElementById('nav'); if(nav){ nav.querySelectorAll('button').forEach(function(nb){
          var lbl=(nb.textContent||'').trim();
          if(/^Leads$|^العملاء المحتملون$/.test(lbl))nb.className='';
          if(/^Clients$|^العملاء$/.test(lbl))nb.className='active';
        }); } }catch(_){ }
        var view=document.getElementById('view');
        if(view){
          var chips=view.querySelector('.v26_3-chips'); if(chips)chips.style.display='none';
          var head=view.querySelector('.v26_3-section-head'); if(head){var h1=head.querySelector('h1,h2,.v26_3-title'); if(h1&&/Leads|العملاء المحتملون/.test(h1.textContent))h1.textContent=fl('Clients','العملاء');}
          view.querySelectorAll('button').forEach(function(btn){
            var tx=(btn.textContent||'').trim();
            if(tx==='← Back to pipeline'||tx==='← العودة إلى القائمة'){
              btn.textContent=fl('← Back to clients','← العودة إلى العملاء');
              btn.onclick=function(){openLead=null;current='clients';render();};
            }
          });
        }
      }
    }
  }catch(_){ }
  return out;};
  console.info('%c[v62] client-card context loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v62] init',e);}})();
