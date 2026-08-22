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
      var card=document.createElement('div'); card.className='card v62-guardrails'; card.style.cssText='padding:18px;max-width:860px;margin-top:16px';
      card.innerHTML='<h3 style="margin:0 0 4px">'+fl('Exclusion list','قائمة الاستبعاد')+'</h3>'
        +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Companies whose rows never enter Finance data, by their real Direct Payments client ID — never by name. Applied at import; every match is shown, never silent.','الشركات التي لن تدخل بياناتها إلى المالية، حسب معرّف العميل الحقيقي في دايركت — وليس بالاسم. يُطبَّق عند الاستيراد، وكل تطابق يظهر، لا شيء يحدث بصمت.')+'</div>'
        +(rows?('<div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr style="background:#303848;color:#fff;text-align:'+(ar?'right':'left')+'"><th style="padding:6px 8px">'+fl('Client ID','معرّف العميل')+'</th><th style="padding:6px 8px">'+fl('Match names','الأسماء المطابِقة')+'</th><th style="padding:6px 8px">'+fl('Reason','السبب')+'</th><th style="padding:6px 8px">'+fl('Added','أُضيف بواسطة')+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>')
          :('<div class="empty" style="padding:10px 0">'+fl('No exclusions yet.','لا توجد استبعادات بعد.')+'</div>'))
        +'<div style="margin-top:10px"><button class="btn sm" onclick="v62AddExclusion()">+ '+fl('Add exclusion','إضافة استبعاد')+'</button></div>'
        +'<hr style="margin:18px 0;border:none;border-top:1px solid var(--line,#eee)">'
        +'<h3 style="margin:0 0 4px">'+fl('Company grouping','تجميع الشركات')+'</h3>'
        +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Declare that several billing profiles (prepaid / postpaid / one per tender) belong to the same real company — the manual fix for cases the automatic linking can\'t merge on its own, and it never touches a profile\'s own amount.','أعلن أن عدة ملفات فوترة (مسبق الدفع / آجل الدفع / ملف لكل مناقصة) تخص نفس الشركة الحقيقية — الحل اليدوي للحالات التي لا يستطيع الربط التلقائي دمجها بنفسه، ولا يمس مبلغ أي ملف على الإطلاق.')+'</div>'
        +'<button class="btn sm" onclick="v62OpenGrouping()">'+fl('Group profiles…','تجميع الملفات…')+'</button>';
      view.appendChild(card);
    }catch(e){ if(window.console)console.warn('[v62] inject',e); }
  }
  var _r62=window.render;
  if(typeof _r62==='function'){ window.render=function(){ var o=_r62.apply(this,arguments); try{ inject(); }catch(_){ } return o; }; }
  setTimeout(inject,1200);
  console.info('%c[v62] finance guardrails (exclusions + grouping) loaded','color:#F06820;font-weight:700');
}catch(e){if(window.console)console.warn('[v62] init',e);}})();
