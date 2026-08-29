/* ===== Finance guardrails: client exclusions + company grouping (Spec 4, 2026-08-21) =====

   Two settings-driven tools, built together because they share one shape (owner-directed):
   a list of entries, each with who-added-it/when, editable only by admin/manager, and
   never silent.

   PART 1 — Exclusion list (item 2). DB.settings.financeExclusions: companies (keyed by
   their real Direct Payments client ID — direct_client_id, never a name, because names
   drift and IDs don't) whose rows must never enter Finance data at all. Fixes a live bug:
   the old check in js/16 and js/41 matched free-text product/notes for the words
   "techtic"/"verification" — it never checked "takamol", so Takamol's own invoices for any
   OTHER service sailed straight through, while an unrelated client's row that merely
   mentioned "verification" in its notes got wrongly excluded. Both directions were wrong.
   Real invoice/CSV exports today only carry a customer NAME per row, not yet a numeric
   client ID (Direct Payments hasn't shipped a transaction-level export with one) — so the
   canonical record here is the ID, but matching at import time uses the "matchNames" list
   captured alongside it as the practical bridge until a real ID-bearing export exists.
   Never silent: window.finExclusionCheck() returns the matched entry so the importer can
   show which id/name fired and why, and the running exclusion count stays visible in the
   preview instead of vanishing into an aggregate.

   PART 2 — Company grouping (item 3). NOT a merge — Abdulrahman's own tender rule (a
   tender's amount is fixed once issued; a new tender means a new profile, never an edit)
   would break if two Tender profiles were folded into one row. Grouping means: these
   client_profiles rows keep their own identity and their own type badge, and just share
   one company (client_profiles.business_id) — "one company, sub details for the rest".
   This is also the manual escape hatch the CR/VAT/domain/name linking waterfall needs,
   since it correctly refuses to auto-merge two Tender profiles even on an identical match.
   grouped_by/grouped_at on client_profiles (migration client_profiles_grouping_audit) are
   the audit trail; reassigning again is how you reverse it — nothing is ever destroyed. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc62(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function client62(){ try{return window.fc?fc():null;}catch(_){return null;} }
  function who62(){ try{ return (window.meName&&meName())||(DB.settings&&DB.settings.currentUser)||'Unknown'; }catch(_){ return 'Unknown'; } }
  function canEdit62(){ try{ return window.canFinEdit?canFinEdit():false; }catch(_){ return false; } }
  function norm62(s){ return String(s==null?'':s).toLowerCase().replace(/[\s\-_.,&()]+/g,' ').trim(); }

  /* ---------- Part 1: exclusion list — read + write + the check itself ---------- */
  function exclusions(){ try{ return (DB.settings&&DB.settings.financeExclusions)||[]; }catch(_){ return []; } }

  // Called by the importers. Returns the matched exclusion entry (with .clientId/.reason) or
  // null. Matches by normalised name against each entry's matchNames — the honest bridge
  // until a real client-ID-bearing export exists (see file header). Callers must show the
  // match, never swallow it silently.
  window.finExclusionCheck=function(name){
    var n=norm62(name); if(!n)return null;
    var list=exclusions();
    for(var i=0;i<list.length;i++){
      var e=list[i], names=e.matchNames||[];
      for(var j=0;j<names.length;j++){ if(norm62(names[j])===n) return e; }
    }
    return null;
  };
  window.finExclusionList=exclusions;

  window.v62AddExclusion=function(){
    if(!canEdit62())return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    openModal(fl('Add exclusion','إضافة استبعاد'),
      '<div class="ch-sub">'+fl('The company\'s rows never enter Finance data, at import — not hidden later. Never silent: every excluded row still shows in the import preview with which id matched and why.','لن تدخل بيانات هذه الشركة إلى المالية عند الاستيراد إطلاقًا — وليس إخفاءً لاحقًا. لا شيء يُستبعد بصمت: كل صف مستبعد يظهر في معاينة الاستيراد مع رقم العميل الذي طابقه والسبب.')+'</div>'+
      '<div class="grid2"><div class="field"><label>'+fl('Direct client ID','معرّف العميل في دايركت')+'</label><input id="x_id" placeholder="'+fl('e.g. 7','مثال: 7')+'"></div>'+
      '<div class="field"><label>'+fl('Reason','السبب')+'</label><input id="x_reason" placeholder="'+fl('e.g. Verification services — accounted for elsewhere','مثال: خدمات توثيق — تُحتسب في نظام آخر')+'"></div></div>'+
      '<div class="field"><label>'+fl('Match names (comma-separated — every spelling this client\'s rows use today)','الأسماء المطابِقة (مفصولة بفواصل — كل صيغة يستخدمها هذا العميل حاليًا)')+'</label><input id="x_names" placeholder="'+fl('e.g. Takamol for Business Services, Techtic Support','مثال: تكامل لخدمات الأعمال')+'"></div>',
      function(){
        var id=(val('x_id')||'').trim(), reason=(val('x_reason')||'').trim(), namesRaw=(val('x_names')||'').trim();
        if(!id){ alert(fl('Enter the Direct client ID.','أدخل معرّف العميل في دايركت.')); return false; }
        if(!namesRaw){ alert(fl('Enter at least one match name.','أدخل اسمًا مطابقًا واحدًا على الأقل.')); return false; }
        var names=namesRaw.split(',').map(function(s){return s.trim();}).filter(Boolean);
        DB.settings=DB.settings||{}; DB.settings.financeExclusions=DB.settings.financeExclusions||[];
        DB.settings.financeExclusions.push({id:'fx'+Date.now(),clientId:id,matchNames:names,reason:reason||null,addedBy:who62(),addedAt:new Date().toISOString()});
        if(typeof save==='function')save(); if(typeof render==='function')render();
      });
  };
  window.v62RemoveExclusion=function(id){
    if(!canEdit62())return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    if(!confirm(fl('Remove this exclusion? Rows matching it will import normally from now on.','إزالة هذا الاستبعاد؟ ستُستورد الصفوف المطابقة له بشكل طبيعي من الآن.')))return;
    DB.settings.financeExclusions=(DB.settings.financeExclusions||[]).filter(function(e){return e.id!==id;});
    if(typeof save==='function')save(); if(typeof render==='function')render();
  };

  /* ---------- Part 1.5: client name aliases — collapse spelling/language variants of one
     company under one canonical display name (owner-directed, 2026-08-25, M14). NOT Part 2
     below: Part 2 moves client_profiles.business_id (billing accounts); this collapses
     finance_invoices.client_group TEXT for display — "MDD" and its Arabic spelling are the
     same company under two spellings, and every revenue rollup that groups by client
     (rFinClients()'s table, the client card, exports, the report builder) must read one line.

     Lives here, checked LIVE by finCanon() (js/16), not applied once as a data rewrite: a
     one-time rename fixes today's rows and nothing else — the next Direct Payments export
     recreates the other spelling as a fresh row and the split is back next month. Because
     nothing in finance_invoices is ever written by this feature, undo is instant and lossless
     — the totals just split back apart on the next render. Same shape as finExclusionCheck():
     never silent, who/when recorded, undo not delete. Auto-suggest below catches FUTURE
     same-script duplicates (a stray "Co" vs "Company") automatically via the same norm62()
     already trusted for the exclusion list; a cross-script rename (English vs Arabic, MDD's
     case) never normalises the same way and always needs a human's call. */
  function groupMap(){ try{ return (DB.settings&&DB.settings.financeGroupMap)||[]; }catch(_){ return []; } }
  function money62(n){ n=Number(n)||0; return Math.round(n).toLocaleString('en-US'); }

  // Called by finCanon() on every client_group→display-name resolution. Exact-shape twin of
  // finExclusionCheck(): normalised match against each ACTIVE entry's aliases, returns the
  // matched entry or null.
  window.finGroupCheck=function(clientGroup){
    var n=norm62(clientGroup); if(!n)return null;
    var list=groupMap();
    for(var i=0;i<list.length;i++){
      var e=list[i]; if(e.active===false)continue;
      var al=e.aliases||[];
      for(var j=0;j<al.length;j++){ if(norm62(al[j])===n) return e; }
    }
    return null;
  };
  window.finGroupList=groupMap;

  // Every distinct client_group value currently live, with its own invoice count and total —
  // the real preview behind the alias picker and the suggestion pass, not a blind text field.
  function groupCandidates(){
    // js/16's live() is IIFE-scoped and never reaches window, so the window.live branch never
    // ran and the fallback listed EXCLUDED clients (Takamol, with its totals) as merge
    // candidates — found by hands-on driving 2026-08-26. Apply the exclusion here directly:
    // finExclusionCheck is defined in this very file, no cross-file reach needed.
    var rows=(FIN.rows||[]).filter(function(r){
      if(r.deleted_at)return false;
      return !(finExclusionCheck(r.client_group)||finExclusionCheck(r.customer_raw_name));
    });
    var byG={};
    rows.forEach(function(r){
      var g=r.client_group||''; if(!g)return;
      byG[g]=byG[g]||{n:0,total:0,_i:{}};
      byG[g]._i[r.invoice_no||('row'+Math.random())]=1; byG[g].total+=(+r.total_incl_vat_sar||0);
    });
    Object.keys(byG).forEach(function(g){ byG[g].n=Object.keys(byG[g]._i).length; });
    return byG;
  }
  // Two independent ways a duplicate surfaces, both one-click suggestions:
  // (a) same normalised spelling ("...Sons Co" vs "...Sons Company") — catches a same-script
  //     rename with zero setup, using the same norm62() already trusted for exclusions.
  // (b) same finance_client_links business_id — catches a CROSS-script rename (MDD's English
  //     vs Arabic spelling never normalises the same way, but the automatic linking system
  //     already resolved both to one business independently of this feature) — the suggested
  //     canonical name defaults to that business's own name, editable before Add.
  function groupSuggestions(){
    var cands=groupCandidates();
    var already={}; groupMap().forEach(function(e){ if(e.active===false)return; (e.aliases||[]).forEach(function(a){already[norm62(a)]=1;}); });
    var buckets={};
    Object.keys(cands).forEach(function(g){ var nk=norm62(g); if(nk)(buckets['n:'+nk]=buckets['n:'+nk]||{aliases:[]}).aliases.push(g); });
    var linkByGroup=(window.FIN&&FIN.linkByGroup)||{};
    var byBiz={};
    Object.keys(cands).forEach(function(g){ var l=linkByGroup[g]; if(l&&l.business_id)(byBiz[l.business_id]=byBiz[l.business_id]||[]).push(g); });
    Object.keys(byBiz).forEach(function(bid){ if(byBiz[bid].length>1)buckets['b:'+bid]={aliases:byBiz[bid],name:bizName62(bid)}; });
    var out=[], seenSets={};
    Object.keys(buckets).forEach(function(k){
      var b=buckets[k], names=b.aliases; if(names.length<2)return;
      var setKey=names.slice().sort().join('|'); if(seenSets[setKey])return;
      if(names.some(function(n){return already[norm62(n)];}))return;
      seenSets[setKey]=1;
      out.push({aliases:names, suggestedName:b.name||names.slice().sort(function(a,b){return b.length-a.length;})[0]});
    });
    return out;
  }

  window.v62UndoGrouping=function(id){
    if(!canEdit62())return;
    if(!confirm(fl('Undo this grouping? Totals split back apart immediately — nothing is deleted, this can be redone.','التراجع عن هذا الدمج؟ ستنفصل الإجماليات فورًا — لا يُحذف شيء، ويمكن إعادته لاحقًا.')))return;
    var list=groupMap(), e=list.filter(function(x){return x.id===id;})[0]; if(!e)return;
    e.active=false; e.undoneBy=who62(); e.undoneAt=new Date().toISOString();
    DB.settings.financeGroupMap=list;
    if(typeof clearFinCanon==='function')clearFinCanon();
    if(typeof save==='function')save(); if(typeof render==='function')render();
  };
  window.v62RedoGrouping=function(id){
    if(!canEdit62())return;
    var list=groupMap(), e=list.filter(function(x){return x.id===id;})[0]; if(!e)return;
    e.active=true; e.undoneBy=null; e.undoneAt=null;
    DB.settings.financeGroupMap=list;
    if(typeof clearFinCanon==='function')clearFinCanon();
    if(typeof save==='function')save(); if(typeof render==='function')render();
  };

  window.v62OpenAddGrouping=function(prefillAliases,prefillName){
    if(!canEdit62())return;
    var cands=groupCandidates();
    var already={}; groupMap().forEach(function(e){ if(e.active===false)return; (e.aliases||[]).forEach(function(a){already[a]=1;}); });
    var names=Object.keys(cands).sort(function(a,b){return cands[b].total-cands[a].total;});
    var opts=names.map(function(g){
      var c=cands[g], sel=(prefillAliases||[]).indexOf(g)>=0?' selected':'';
      return '<option value="'+esc62(g)+'"'+sel+'>'+esc62(g)+' — '+c.n+' '+fl('inv.','فاتورة')+', '+money62(c.total)+' SAR'+(already[g]?(' ('+fl('already grouped','مُدمَجة بالفعل')+')'):'')+'</option>';
    }).join('');
    openModal(fl('Add client name alias','إضافة أسماء بديلة لعميل'),
      '<div class="ch-sub">'+fl('Pick two or more values that are the same real company under different spellings or languages — each shows its own live count and total.','اختر قيمتين أو أكثر تخصان نفس الشركة بصيغ أو لغات مختلفة — كل خيار يعرض عدده وإجماليه الحقيقيين.')+'</div>'+
      '<div class="field"><label>'+fl('Values to merge (Ctrl/Cmd-click for several)','القيم المطلوب دمجها (Ctrl/Cmd + نقر لعدة قيم)')+'</label><select id="g2_aliases" multiple size="8" style="width:100%">'+opts+'</select></div>'+
      '<div class="field"><label>'+fl('Canonical display name','الاسم المعتمد للعرض')+'</label><input id="g2_name" value="'+esc62(prefillName||'')+'" placeholder="'+fl('e.g. MDD - Smart Madad IT','مثال: MDD - Smart Madad IT')+'"></div>'+
      '<div class="field"><label>'+fl('Note (optional)','ملاحظة (اختياري)')+'</label><input id="g2_note"></div>',
      function(){
        var sel=[].slice.call(document.getElementById('g2_aliases').selectedOptions).map(function(o){return o.value;});
        var name=(val('g2_name')||'').trim(), note=(val('g2_note')||'').trim();
        if(sel.length<2){ alert(fl('Pick at least two values.','اختر قيمتين على الأقل.')); return false; }
        if(!name){ alert(fl('Enter the canonical display name.','أدخل الاسم المعتمد للعرض.')); return false; }
        var dupe=sel.filter(function(g){return already[g];});
        if(dupe.length){ alert(fl('Already grouped: ','مُدمَجة بالفعل: ')+dupe.join(', ')+'. '+fl('Undo that grouping first.','تراجع عن ذلك الدمج أولًا.')); return false; }
        var n=0,total=0; sel.forEach(function(g){ var c=cands[g]; if(c){n+=c.n;total+=c.total;} });
        if(!confirm(fl('Merge '+sel.length+' values into "'+name+'" — '+n+' invoices, '+money62(total)+' SAR combined. Reversible anytime. Continue?','دمج '+sel.length+' قيم ضمن "'+name+'" — '+n+' فاتورة، '+money62(total)+' ريال إجمالًا. قابل للتراجع دائمًا. متابعة؟')))return false;
        DB.settings=DB.settings||{}; DB.settings.financeGroupMap=DB.settings.financeGroupMap||[];
        DB.settings.financeGroupMap.push({id:'fg'+Date.now(),canonicalName:name,aliases:sel,note:note||null,addedBy:who62(),addedAt:new Date().toISOString(),active:true,undoneBy:null,undoneAt:null});
        if(typeof clearFinCanon==='function')clearFinCanon();
        if(typeof save==='function')save(); if(typeof render==='function')render();
      });
  };

  /* ---------- Part 2: company grouping — reassign client_profiles.business_id ---------- */
  function bizName62(uuid){ try{ var list=(DB.businesses||[]); for(var i=0;i<list.length;i++){ var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id); if(uu===uuid)return list[i].name||uuid; } }catch(_){} return uuid; }
  var TYPE_LBL62={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};

  window.v62OpenGrouping=function(){
    if(!canEdit62())return;
    if(!window.CP||CP.rows==null){ if(typeof cpLoad==='function')cpLoad(function(){ v62OpenGrouping(); }); return; }
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var rows=(CP.rows||[]).slice().sort(function(a,b){return String(a.direct_client_id).localeCompare(String(b.direct_client_id),undefined,{numeric:true});});
    var opts=rows.map(function(p){
      var tl=TYPE_LBL62[p.profile_type]||[p.profile_type,p.profile_type];
      return '<option value="'+esc62(p.id)+'">#'+esc62(p.direct_client_id)+' — '+esc62(fl(tl[0],tl[1]))+' — '+esc62(bizName62(p.business_id))+'</option>';
    }).join('');
    var bizOpts=(DB.businesses||[]).filter(function(b){return b.isClient;}).slice().sort(function(a,b){return (a.name||'').localeCompare(b.name||'');})
      .map(function(b){return '<option value="'+esc62(window.__bizUuid?window.__bizUuid(b.id):b.id)+'">'+esc62(b.name)+'</option>';}).join('');
    openModal(fl('Group client profiles under one company','تجميع ملفات العملاء تحت شركة واحدة'),
      '<div class="ch-sub">'+fl('This does not merge anything — each profile keeps its own row, its own type badge and its own amount (a Tender\'s amount is fixed once issued; a new tender is always a new profile, never an edit). It only moves the selected profiles under one company, so the Finance page reads them as one company with the rest nested underneath.','هذا لا يدمج أي شيء — يحتفظ كل ملف بصفه الخاص، وشارته الخاصة، ومبلغه الخاص (مبلغ المناقصة ثابت بعد إصدارها؛ أي مناقصة جديدة تعني ملفًا جديدًا دائمًا، لا تعديلًا). هذا يقوم فقط بنقل الملفات المحددة تحت شركة واحدة، بحيث تقرأها صفحة المالية كشركة واحدة والباقي مندرج تحتها.')+'</div>'+
      '<div class="field"><label>'+fl('Select profiles to move (Ctrl/Cmd-click for several)','اختر الملفات المطلوب نقلها (Ctrl/Cmd + نقر لاختيار أكثر من واحد)')+'</label><select id="g_profiles" multiple size="8" style="width:100%">'+opts+'</select></div>'+
      '<div class="field"><label>'+fl('Move them under this company','انقلها تحت هذه الشركة')+'</label><select id="g_target"><option value="">'+fl('— choose —','— اختر —')+'</option>'+bizOpts+'</select></div>',
      function(){
        var sel=[].slice.call(document.getElementById('g_profiles').selectedOptions).map(function(o){return o.value;});
        var target=val('g_target');
        if(!sel.length){ alert(fl('Select at least one profile.','اختر ملفًا واحدًا على الأقل.')); return false; }
        if(!target){ alert(fl('Choose the company to group them under.','اختر الشركة المطلوب التجميع تحتها.')); return false; }
        var c=client62(); if(!c){ alert(fl('Not connected — try again.','غير متصل — حاول مجددًا.')); return false; }
        c.from('client_profiles').update({business_id:target,grouped_by:who62(),grouped_at:new Date().toISOString()}).in('id',sel).then(function(r){
          if(r.error){ alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message); return; }
          CP.rows=null; if(typeof cpLoad==='function')cpLoad(function(){ if(typeof render==='function')render(); });
        });
      });
  };

  /* ---------- inject the settings card into Finance > Import ---------- */
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='finance')return;
      if(typeof FIN==='undefined'||FIN.tab!=='import')return;
      if(!canEdit62())return;
      var view=document.getElementById('view'); if(!view)return;
      if(view.querySelector('.v62-guardrails'))return;
      var ar=(typeof LANG!=='undefined'&&LANG==='ar');
      var ex=exclusions();
      var rows=ex.map(function(e){
        return '<tr><td style="padding:6px 8px;font-weight:700">#'+esc62(e.clientId)+'</td>'
          +'<td style="padding:6px 8px">'+esc62((e.matchNames||[]).join(', '))+'</td>'
          +'<td style="padding:6px 8px;color:var(--muted)">'+esc62(e.reason||'—')+'</td>'
          +'<td style="padding:6px 8px;color:var(--muted);font-size:11px">'+esc62(e.addedBy||'')+' · '+esc62((e.addedAt||'').slice(0,10))+'</td>'
          +'<td style="padding:6px 8px"><button class="btn ghost sm" onclick="v62RemoveExclusion(\''+e.id+'\')">'+fl('Remove','إزالة')+'</button></td></tr>';
      }).join('');
      var gm=groupMap();
      var gRows=gm.map(function(e){
        var active=e.active!==false;
        return '<tr'+(active?'':' style="opacity:.55"')+'><td style="padding:6px 8px;font-weight:700">'+esc62(e.canonicalName)+'</td>'
          +'<td style="padding:6px 8px">'+esc62((e.aliases||[]).join(', '))+'</td>'
          +'<td style="padding:6px 8px;color:var(--muted);font-size:11px">'+esc62(e.addedBy||'')+' · '+esc62((e.addedAt||'').slice(0,10))+(active?'':(' · '+fl('undone','أُلغي')+' '+esc62((e.undoneAt||'').slice(0,10))))+'</td>'
          +'<td style="padding:6px 8px">'+(active
            ?('<button class="btn ghost sm" onclick="v62UndoGrouping(\''+e.id+'\')">'+fl('Undo','تراجع')+'</button>')
            :('<button class="btn ghost sm" onclick="v62RedoGrouping(\''+e.id+'\')">'+fl('Redo','إعادة')+'</button>'))+'</td></tr>';
      }).join('');
      var sugg=groupSuggestions();
      var suggHtml=sugg.length?('<div style="margin-bottom:10px;font-size:12.5px">'+sugg.map(function(s){
        return '<div style="margin-bottom:4px">'+fl('Possible duplicate: ','احتمال تكرار: ')+esc62(s.aliases.join(' / '))
          +' <button class="btn ghost sm" onclick=\'v62OpenAddGrouping('+JSON.stringify(s.aliases)+','+JSON.stringify(s.suggestedName)+')\'>'+fl('Group »','دمج »')+'</button></div>';
      }).join('')+'</div>'):'';
      var card=document.createElement('div'); card.className='card v62-guardrails'; card.style.cssText='padding:18px;max-width:860px;margin-top:16px';
      card.innerHTML='<h3 style="margin:0 0 4px">'+fl('Exclusion list','قائمة الاستبعاد')+'</h3>'
        +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Matched by Direct Payments client ID, not name. Applied at import — every match shown, never silent.','مطابقة حسب معرّف العميل في دايركت، لا بالاسم. تُطبَّق عند الاستيراد — كل تطابق يظهر، لا شيء بصمت.')+'</div>'
        +(rows?('<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr style="background:#303848;color:#fff;text-align:'+(ar?'right':'left')+'"><th style="padding:6px 8px">'+fl('Client ID','معرّف العميل')+'</th><th style="padding:6px 8px">'+fl('Match names','الأسماء المطابِقة')+'</th><th style="padding:6px 8px">'+fl('Reason','السبب')+'</th><th style="padding:6px 8px">'+fl('Added','أُضيف بواسطة')+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>')
          :('<div class="empty" style="padding:10px 0">'+fl('No exclusions yet.','لا توجد استبعادات بعد.')+'</div>'))
        +'<div style="margin-top:10px"><button class="btn sm" onclick="v62AddExclusion()">+ '+fl('Add exclusion','إضافة استبعاد')+'</button></div>'
        +'<hr style="margin:18px 0;border:none;border-top:1px solid var(--line,#eee)">'
        +'<h3 style="margin:0 0 4px">'+fl('Client name aliases','أسماء العملاء البديلة')+'</h3>'
        +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Collapses spelling or language variants into one name, everywhere finance groups by client. Reversible anytime.','يدمج صيغ الاسم المختلفة (لغة أو تهجئة) تحت اسم واحد، أينما تُجمَّع المالية حسب العميل. قابل للتراجع دائمًا.')+'</div>'
        +suggHtml
        +(gRows?('<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr style="background:#303848;color:#fff;text-align:'+(ar?'right':'left')+'"><th style="padding:6px 8px">'+fl('Canonical name','الاسم المعتمد')+'</th><th style="padding:6px 8px">'+fl('Aliases','الأسماء البديلة')+'</th><th style="padding:6px 8px">'+fl('Added','أُضيف بواسطة')+'</th><th></th></tr></thead><tbody>'+gRows+'</tbody></table></div>')
          :('<div class="empty" style="padding:10px 0">'+fl('No aliases yet.','لا توجد أسماء بديلة بعد.')+'</div>'))
        +'<div style="margin-top:10px"><button class="btn sm" onclick="v62OpenAddGrouping()">+ '+fl('Add alias','إضافة اسم بديل')+'</button></div>'
        +'<hr style="margin:18px 0;border:none;border-top:1px solid var(--line,#eee)">'
        +'<h3 style="margin:0 0 4px">'+fl('Billing-profile grouping','تجميع ملفات الفوترة')+'</h3>'
        +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Show several billing profiles under one company.','عرض عدة ملفات فوترة تحت شركة واحدة.')+'</div>'
        +'<button class="btn sm" onclick="v62OpenGrouping()">'+fl('Group profiles…','تجميع الملفات…')+'</button>';
      view.appendChild(card);
    }catch(e){ if(window.console)console.warn('[v62] inject',e); }
  }
  var _r62=window.render;
  if(typeof _r62==='function'){ window.render=function(){ var o=_r62.apply(this,arguments); try{ inject(); }catch(_){ } return o; }; }
  // M12 (docs/DECISIONS.md): a page's own tab-switch is not the same event as a global render.
  // finGo('import') paints via renderFinance() directly, so hooking window.render alone left
  // this card missing on the common first paint of the Import tab — found by hands-on driving
  // 2026-08-26 (the same gap that once left js/65's wiring unattached). Hook finGo too, and
  // re-check shortly after in case finGo was wrapped later by another layer.
  var _g62=window.finGo;
  if(typeof _g62==='function'){ window.finGo=function(){ var o=_g62.apply(this,arguments); try{ inject(); }catch(_){ } try{ setTimeout(inject,300); }catch(_){ } return o; }; }
  setTimeout(inject,1200);
  console.info('%c[v62] finance guardrails (exclusions + grouping) loaded','color:#F06820;font-weight:700');
}catch(e){if(window.console)console.warn('[v62] init',e);}})();
