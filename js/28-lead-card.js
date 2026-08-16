/* ===== Lead/client detail card — one chapter, one file (Leads sitting L2 — 2026-08-16) =====

   The decorations of the DETAIL CARD:
     part 1 (was js/28-v35)  the suggested next step, per stage
     part 2 (was js/30-v39)  detail-card tidy (reversible grouping)
     part 3 (was js/32-v55)  proposals on the client/lead detail card
     part 4 (was js/36-v60)  long record cards — lead/client detail grouping

   Anchored at slot 28 — forced from below: part 1 wraps renderLeadDetail, and the chain
   order (funnels-editor → won-handover → THIS) is the behaviour, so it must keep loading
   right after slot 27. Parts 2 and 4 wrap render(); the only other render-wrapper between
   the old slots (34, the Your-Day card) decorates the Today page, not this card — proven
   non-interacting by the card fingerprint. Verbatim, each part keeps its own try/catch.  */

/* ---------- part 1 — suggested next step (was js/28-v35) ---------- */
/* v35 — Leads · suggested next step per stage (a nudge from the travel lifecycle, not a task). */
(function(){try{
  if(!window.renderLeadDetail) return;
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  var STEPS={
    'New':['Assign an owner and make first contact.','عيّن مالكاً وابدأ أول تواصل.'],
    'Prospect':['Assign an owner and make first contact.','عيّن مالكاً وابدأ أول تواصل.'],
    'Contacted':['Run a discovery call, and start the service-fit map below.','أجرِ مكالمة استكشاف، وابدأ خريطة ملاءمة الخدمات بالأسفل.'],
    'Qualified':['Prepare and send the service-fee proposal.','جهّز وأرسل عرض رسوم الخدمة.'],
    'Proposal':['Follow up — negotiate terms and the Direct credit line.','تابع — تفاوض على الشروط وحدّ الائتمان لدى دايركت.'],
    'Negotiation':['Close the terms and confirm the credit line.','أغلق الشروط وأكّد حدّ الائتمان.'],
    'Won':['Complete the Direct handover: client ID, agreement, point of contact.','أكمل التسليم لدايركت: المعرّف، الاتفاقية، جهة الاتصال.'],
    'Lost':['Log the lost reason and set a re-approach date.','سجّل سبب الخسارة وحدّد تاريخ إعادة التواصل.'],
    'On hold':['Set a wake-up date so it does not go cold.','حدّد تاريخ متابعة حتى لا يبرد.']
  };
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var b=(typeof getLead==='function')?getLead(id):null; if(!b||b.isClient)return; // active leads only
      var view=document.getElementById('view'); if(!view||view.querySelector('.v35-next'))return;
      var grid=view.querySelector('.detail-grid'); if(!grid||!grid.parentNode)return;
      var sg=(typeof leadStage==='function')?leadStage(b):(b.stage||'');
      var step=STEPS[sg]; if(!step)return;
      var el=document.createElement('div'); el.className='v35-next card';
      el.style.cssText='padding:10px 14px;margin-bottom:12px;display:flex;gap:9px;align-items:center;flex-wrap:wrap;border-inline-start:3px solid #7A5AF8;background:#F6F4FE';
      el.innerHTML='<span style="font-size:14px">▶</span><span style="font-weight:700;color:#5B3FD4;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:.03em;text-transform:uppercase">'+fl('Next step','الخطوة التالية')+'</span><span style="color:var(--ink);font-size:13px">'+fl(step[0],step[1])+'</span>';
      grid.parentNode.insertBefore(el,grid);
    }catch(e){if(window.console)console.warn('[v35] next',e);}},55);
  };
  console.info('%c[v35] leads next-step nudge loaded','color:#7A5AF8;font-weight:700');
}catch(e){if(window.console)console.warn('[v35] init',e);}})();

/* ---------- part 2 — detail-card tidy (was js/30-v39) ---------- */
/* v39 — detail-card tidy (reversible):
   • Hide the redundant "Managed client" strip (.dt-clientbanner) — the header already carries a
     Client tag, and the Direct strip (v34 + folded-in v36) carries the actionable link. So a
     client detail now shows ONE Direct strip instead of three.
   • Drop the duplicate "Lifetime billed" row from Key facts — the 💰 Finance card shows it prominently.
   • Trim the helper subtitles (.ch-sub) on the lead/client detail — guidance for a new user, noise
     once you know the tool.
   • Native <details> marker + caret polish for the now-collapsible v33 service-fit map.
   Nothing deleted — remove this block (and the v33/v36 edits) to restore everything. */
(function(){try{
  if(!document.getElementById('v39css')){
    var st=document.createElement('style'); st.id='v39css';
    st.textContent=
      '.dt-clientbanner{display:none!important}'+
      '.v33-fit>summary{list-style:none}'+
      '.v33-fit>summary::-webkit-details-marker{display:none}'+
      '.v33-fit[open] .v33-caret{transform:rotate(90deg)}';
    (document.head||document.documentElement).appendChild(st);
  }
  function tidy(){try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(typeof openLead==='undefined'||!openLead)return;
    var view=document.getElementById('view'); if(!view)return;
    var grid=view.querySelector('.detail-grid'); if(!grid)return;
    // (1) trim helper subtitles on the detail cards
    grid.querySelectorAll('.ch-sub').forEach(function(s){ s.style.display='none'; });
    // (2) drop the duplicate "Lifetime billed" row from Key facts (the Finance card shows it)
    var hasFinanceCard=[].slice.call(view.querySelectorAll('.card h3')).some(function(h){return /Finance/.test(h.textContent);});
    if(hasFinanceCard){
      grid.querySelectorAll('.fact').forEach(function(f){
        var k=f.querySelector('.k'); if(k&&/^\s*Lifetime billed\s*$/.test(k.textContent)) f.style.display='none';
      });
    }
  }catch(e){if(window.console)console.warn('[v39] tidy',e);}}
  try{ var _r=window.render; window.render=function(){var x=_r.apply(this,arguments);setTimeout(tidy,140);return x;}; }catch(_){}
  console.info('%c[v39] detail-card tidy loaded','color:#9AA1B6;font-weight:700');
}catch(e){if(window.console)console.warn('[v39] init',e);}})();

/* ---------- part 3 — proposals on the card (was js/32-v55) ---------- */
/* v55 — Proposals on the client/lead detail (Customer-360): a client's proposals from the
   Offer Builder (offers whose linkedLeadId is this record). Self-contained inject layer. */
(function(){try{
  function A(){return (typeof LANG!=='undefined'&&LANG==='ar');}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='leads')return;
      if(typeof openLead==='undefined'||!openLead)return;
      var view=document.getElementById('view'); if(!view)return;
      if(view.querySelector('.v55-proposals'))return;
      var offers=((typeof DB!=='undefined'&&DB.offers)||[]).filter(function(o){return o.linkedLeadId===openLead;});
      var ar=A();
      var rows=offers.map(function(o){
        var t=ar?((window.PROPOSAL_TYPES_AR&&PROPOSAL_TYPES_AR[o.proposalType])||o.proposalType||'—'):(o.proposalType||'—');
        return '<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #f0efe9;font-size:12.5px">'+
          '<span class="tag" style="background:#EEF0F5;color:#4B5563">'+esc(t)+'</span>'+
          '<a onclick="openOffer=\''+o.id+'\';current=\'offers\';render()" style="cursor:pointer;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(o.subject||o.ref||'')+'</a>'+
          '<span style="color:var(--muted);white-space:nowrap">'+esc(o.value||o.total||'')+' SAR</span>'+
          (o.docUrl?' <a href="'+esc(o.docUrl)+'" target="_blank" rel="noopener" title="'+(ar?'المستند':'Document')+'">📎</a>':'')+
          (o.promotedToProject?' <span title="'+(ar?'مشروع':'Project')+'">🏗</span>':'')+
        '</div>';
      }).join('')||'<div style="color:var(--muted);font-size:12px;padding:6px 0">'+(ar?'لا توجد عروض بعد':'No proposals yet')+'</div>';
      var card=document.createElement('div'); card.className='card v55-proposals'; card.style.cssText='padding:14px 16px;margin-top:12px';
      card.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:14px">'+(ar?'العروض والمقترحات':'Proposals')+' ('+offers.length+')</b><span style="flex:1"></span><button class="btn ghost sm" onclick="v55NewProposal(\''+openLead+'\')">＋ '+(ar?'عرض جديد':'New proposal')+'</button></div>'+rows;
      view.appendChild(card);
    }catch(_){}
  }
  window.v55NewProposal=function(clientId){try{
    if(typeof newOffer!=='function')return;
    newOffer(); var arr=(DB.offers||[]); var o=arr[arr.length-1];
    if(o){ o.linkedLeadId=clientId; var b=(DB.businesses||[]).find(function(x){return x.id===clientId;}); if(b)o.client=b.name; }
    if(typeof current!=='undefined'){ current='offers'; } if(o){ openOffer=o.id; }
    if(typeof save==='function')save(); if(typeof render==='function')render();
  }catch(_){}};
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{[80,400].forEach(function(d){setTimeout(inject,d);});}catch(_){}; return o; }; } }catch(_){}
  [300,900].forEach(function(d){setTimeout(inject,d);});
  console.info('%c[v55] client proposals loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v55] init',e);}})();

/* ---------- part 4 — long record cards (was js/36-v60) ---------- */
/* v60 — long record cards (lead/client detail) get a "jump to section" chip bar under the
   header: one tap scrolls to Finance / Key facts / Contacts / Work log / … Display-only,
   built from whatever cards the page actually shows; nothing is moved or hidden. */
(function(){try{
  function inject(){
    try{
      var view=document.getElementById('view'); if(!view) return;
      var head=view.querySelector('.detail-head');
      var old=document.getElementById('v60jump');
      if(!head){ if(old)old.remove(); return; }
      if(old) return;
      var items=[];
      view.querySelectorAll('.card h3').forEach(function(h3){
        var card=h3.closest('.card'); if(!card) return;
        var t=''; h3.childNodes.forEach(function(n){ if(n.nodeType===3) t+=n.textContent; });
        t=(t||h3.textContent||'').trim();
        t=t.replace(/\s*(Edit|تعديل)\s*$/,'').trim();
        if(t&&t.length<=38) items.push({card:card,t:t});
      });
      if(items.length<4) return; // short pages stay as they are
      var bar=document.createElement('div'); bar.id='v60jump';
      bar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px';
      items.slice(0,10).forEach(function(c){
        var b=document.createElement('button'); b.className='btn sm ghost'; b.textContent=c.t;
        b.onclick=function(){ try{ c.card.scrollIntoView({behavior:'smooth',block:'start'}); }catch(_){ c.card.scrollIntoView(); } };
        bar.appendChild(b);
      });
      head.insertAdjacentElement('afterend',bar);
    }catch(_){}
  }
  var _r=window.render;
  if(typeof _r==='function'){ window.render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(inject,80); }catch(_){ } return o; }; }
  setTimeout(inject,900);
  console.info('%c[v60] record-card section jump bar loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v60] init',e);}})();
