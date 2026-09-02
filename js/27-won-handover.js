/* ===== Won → client handover — one chapter, one file (Step 1, chapter 5 — 2026-08-15) =====

   What happens when a lead is Won:
     part 1 (was js/27-v34)  capture and surface the Direct client link on the lead card
     part 2 (was js/37-v61)  every road to Won — dropdown, quick edit, stage buttons —
                              ends at the complete-the-client handover screen

   Anchored at slot 27, NOT 37, and the direction matters both ways:
     · part 1 wraps renderLeadDetail, and slot 28 wraps the SAME function on top of it —
       part 1 must keep loading before 28 or the card sections swap order;
     · part 2 wraps setLeadStage and REPLACES __clientHandover, both of which slot 14
       defines first — part 2 must keep loading after 14, which slot 27 satisfies.
   Nothing between the old slots calls either symbol at load time (checked).            */

/* ---------- part 1 — Direct client link on the card (was js/27-v34) ---------- */
/* v34 — Won→Client link: capture & surface the Direct client ID (the link key to Direct's hub).
   Strong prompt, NOT a hard block: a client without a Direct ID shows an amber "not linked"
   banner with a one-tap Add; a linked client shows the ID + a deep link into Direct Payments.
   The ID is entered at handover (v40 modal) or here; stored on b.directClientId (persists via raw). */
(function(){try{
  if(!window.renderLeadDetail) return;
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function client(){ try{return window.fc?fc():null;}catch(_){return null;} }
  var TYPE_LBL={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};
  function typeLbl(t){var e=TYPE_LBL[t]||[t,t];return fl(e[0],e[1]);}

  /* client_profiles (Phase 1, 2026-08-21): the real schema behind "one company = several
     Direct Payments billing accounts". Replaces the old free-text b.billingAccounts blob.
     The select list is deliberately narrow — it never fetches tender_amount_sar /
     expected_cogs_sar / expected_gp_sar / credit_limit_sar, so those money columns can
     never end up rendered on the Clients page even by accident (owner ruling 2026-08-21:
     the Clients page shows identity only — type badge + client ID + payment terms, no
     figures). Those columns exist in the table for the Finance page to read separately. */
  var CP={rows:null,loading:false,byBiz:{}};
  window.CP=CP;
  function cpLoad(cb){
    if(CP.loading)return; CP.loading=true;
    var c=client(); if(!c){CP.loading=false;return;}
    c.from('client_profiles').select('id,business_id,direct_client_id,profile_type,status,payment_terms,billing_cycle,opened_at,closed_at')
      .order('opened_at',{ascending:true}).then(function(r){
        CP.loading=false;
        if(r.error){ if(window.console)console.warn('client_profiles load',r.error); CP.rows=[]; }
        else { CP.rows=r.data||[]; }
        CP.byBiz={};
        (CP.rows||[]).forEach(function(p){ (CP.byBiz[p.business_id]=CP.byBiz[p.business_id]||[]).push(p); });
        cb&&cb();
      });
  }
  window.cpLoad=cpLoad;

  window.v34AddProfile=function(id){try{
    var b=getLead(id); if(!b)return;
    var bizUuid=(window.__bizUuid?window.__bizUuid(id):id);
    openModal(fl('Add billing profile','إضافة ملف فوترة'),
      '<div class="ch-sub">'+fl('One company can hold several Direct Payments profiles — one Prepaid, one Postpaid, and a new one for each Tender.','شركة واحدة قد يكون لها أكثر من ملف في مدفوعات دايركت — ملف واحد لمسبق الدفع، وملف لآجل الدفع، وملف جديد لكل مناقصة.')+'</div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Direct client ID','معرّف العميل في دايركت')+'</label><input id="cp_id" placeholder="'+fl('e.g. 95','مثال: 95')+'"></div>'+
      '<div class="field"><label>'+fl('Profile type','نوع الملف')+'</label><select id="cp_type"><option value="prepaid">'+fl('Prepaid','مسبق الدفع')+'</option><option value="postpaid">'+fl('Postpaid','آجل الدفع')+'</option><option value="tender">'+fl('Tender','مناقصة')+'</option></select></div></div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Payment terms','شروط الدفع')+'</label><input id="cp_terms" placeholder="'+fl('e.g. Net 30','مثال: 30 يومًا')+'"></div>'+
      '<div class="field"><label>'+fl('Billing cycle','دورة الفوترة')+'</label><input id="cp_cycle" placeholder="'+fl('e.g. Monthly','مثال: شهري')+'"></div></div>'+
      '<div class="ch-sub">'+fl('Money for this profile (tender amount, expected COGS/GP, credit limit) is entered and read on the Finance page — not here.','أرقام هذا الملف (قيمة المناقصة، التكلفة والربح المتوقعان، حد الائتمان) تُدخل وتُعرض في صفحة المالية — وليس هنا.')+'</div>',
      function(){
        var did=(val('cp_id')||'').trim();
        if(!did){ alert(fl('Enter the Direct client ID.','أدخل معرّف العميل في دايركت.')); return false; }
        var c=client(); if(!c){ alert(fl('Not connected — try again.','غير متصل — حاول مجددًا.')); return false; }
        c.from('client_profiles').insert({
          business_id:bizUuid, direct_client_id:did, profile_type:val('cp_type'),
          payment_terms:val('cp_terms')||null, billing_cycle:val('cp_cycle')||null,
          status:'active', source:'manual'
        }).select('id').then(function(r){
          if(r.error){ alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message); return; }
          /* M13 (2026-09-02, attack round 11): no error but no row back = the database refused it
             silently — say so instead of reloading as if it had been saved. */
          if(!r.data||!r.data.length){ alert(fl('The database refused this profile — nothing was saved (permission?).','رفضت قاعدة البيانات هذا الملف — لم يُحفظ شيء (صلاحية؟).')); return; }
          CP.rows=null; cpLoad(function(){ if(typeof render==='function')render(); });
        });
      });
  }catch(e){if(window.console)console.warn('v34AddProfile',e);}};

  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var b=(typeof getLead==='function')?getLead(id):null; if(!b||!b.isClient)return; // clients only
      var view=document.getElementById('view'); if(!view||view.querySelector('.v34-link'))return;
      var grid=view.querySelector('.detail-grid'); if(!grid||!grid.parentNode)return;
      if(CP.rows==null){ cpLoad(function(){ try{if(typeof render==='function')render();}catch(_){} }); return; }
      var bizUuid=(window.__bizUuid?window.__bizUuid(id):id);
      var accts=CP.byBiz[bizUuid]||[];
      var linked=accts.length>0;
      var acctHtml=accts.map(function(a2){
        var extra=[a2.payment_terms,a2.billing_cycle].filter(Boolean).join(' · ');
        var suspended=a2.status&&a2.status!=='active';
        return '<span class="tag" style="background:'+(suspended?'#F0453A14':'#E7F8EF')+';color:'+(suspended?'#D92D20':'#0F6E56')+';font-weight:700">'+typeLbl(a2.profile_type)+' · #'+esc(String(a2.direct_client_id))+(extra?(' · '+esc(extra)):'')+(suspended?(' · '+esc(fl('Suspended','موقوف'))):'')+'</span>';
      }).join(' ');
      var el=document.createElement('div'); el.className='v34-link card';
      el.style.cssText='padding:11px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-inline-start:3px solid '+(linked?'#16B364':'#F79009');
      if(linked){
        el.innerHTML='<span style="font-size:15px">🔗</span><span style="font-weight:700;color:#0F6E56">'+fl('Linked to Direct','مرتبط بدايركت')+'</span>'+
          '<span style="color:var(--muted);font-size:12.5px">'+fl(accts.length>1?'billing profiles':'profile','ملفات الفوترة')+'</span> '+acctHtml+'<span style="flex:1"></span>'+
          '<a class="chiplink" href="'+((accts[0]&&typeof pdClientLink==='function')?pdClientLink(accts[0].direct_client_id):(typeof pdLink==='function'?pdLink(b):'#'))+'" target="_blank" rel="noopener">'+fl('Open in Direct Payments ↗','افتح في مدفوعات دايركت ↗')+'</a>'+
          ' <button class="btn ghost sm" onclick="v34AddProfile(\''+id+'\')">'+fl('+ Add profile','+ إضافة ملف')+'</button>';
      } else {
        el.innerHTML='<span style="font-size:15px">⚠️</span><span style="font-weight:700;color:#B54708">'+fl('Not linked to Direct yet','غير مرتبط بدايركت بعد')+'</span>'+
          '<span style="color:var(--muted);font-size:12.5px">'+fl('Add a billing profile so finance & invoices connect.','أضف ملف فوترة لربط الفواتير والمالية.')+'</span><span style="flex:1"></span>'+
          '<button class="btn pri sm" onclick="v34AddProfile(\''+id+'\')">'+fl('+ Add profile','+ إضافة ملف')+'</button>';
      }
      grid.parentNode.insertBefore(el,grid);
    }catch(e){if(window.console)console.warn('[v34] link',e);}},60);
  };
  console.info('%c[v34] client Direct-link banner loaded','color:#16B364;font-weight:700');
}catch(e){if(window.console)console.warn('[v34] init',e);}})();

/* ---------- part 2 — every road to Won ends at the handover (was js/37-v61) ---------- */
/* v61 — every road to Won ends at the "complete the client" step (2026-08-12).
   The v40 handover modal only fired through convertToClient(); the stage dropdown
   (setLeadStage) and the quick-edit set isClient directly and skipped it. */
(function(){try{
  if(typeof setLeadStage==='function'&&!window.__v61won){
    var _s=window.setLeadStage;
    window.setLeadStage=function(id,s){
      var b=(typeof getLead==='function')?getLead(id):null;
      var was=!!(b&&b.isClient);
      var out=_s.apply(this,arguments);
      try{ if(s==='Won'&&b&&!was&&typeof window.__clientHandover==='function')setTimeout(function(){window.__clientHandover(id);},250); }catch(_){}
      return out;
    };
    window.__v61won=true;
    console.info('%c[v61] Won → complete-the-client hook loaded','color:#0F6E56;font-weight:700');
  }
}catch(e){if(window.console)console.warn('[v61] init',e);}})();
