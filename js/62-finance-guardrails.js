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
  // 2026-09-02: folds Arabic letter variants (أإآ→ا, ى→ي, ة→ه, diacritics, tatweel) and Unicode
  // presentation forms (NFKC) the same way js/41's linker does — an alias spelled "…ة" used to
  // miss an export row spelled "…ه", so the sibling never linked.
  function norm62(s){
    s=String(s==null?'':s); try{ s=s.normalize('NFKC'); }catch(_){}
    s=s.toLowerCase().replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْـ]/g,'');
    return s.replace(/[\s\-_.,&()]+/g,' ').trim();
  }

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
     finance_invoices.client_group TEXT for display — a client's English short name and its Arabic spelling are the
     same company under two spellings, and every revenue rollup that groups by client
     (rFinClients()'s table, the client card, exports, the report builder) must read one line.

     Lives here, checked LIVE by finCanon() (js/16), not applied once as a data rewrite: a
     one-time rename fixes today's rows and nothing else — the next Direct Payments export
     recreates the other spelling as a fresh row and the split is back next month. Because
     nothing in finance_invoices is ever written by this feature, undo is instant and lossless
     — the totals just split back apart on the next render. Same shape as finExclusionCheck():
     never silent, who/when recorded, undo not delete. Auto-suggest below catches FUTURE
     same-script duplicates (a stray "Co" vs "Company") automatically via the same norm62()
     already trusted for the exclusion list; a cross-script rename (English vs Arabic, the real case's
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
  // (b) same finance_client_links business_id — catches a CROSS-script rename (the real case's English
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
      '<div class="field"><label>'+fl('Canonical display name','الاسم المعتمد للعرض')+'</label><input id="g2_name" value="'+esc62(prefillName||'')+'" placeholder="'+fl('e.g. Madar - Smart Systems','مثال: Madar - Smart Systems')+'"></div>'+
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

  /* ---------- Part 3: duplicate companies — detect, merge (reversibly), undo (M18, 2026-08-29)
     The MDD split was TWO business records for one company (the corporate-clients import
     created "MDD" beside the older "MDD — Smart Madad IT"), so the alias map merged the
     display while contacts, profiles, links and transactions stayed split. Owner: "find the
     fix for the future and go ahead." Detection runs live from data the app already holds;
     the merge is ONE audited RPC (fn_merge_businesses, migration business_merges_reversible)
     that repoints every child row to the survivor, fills the survivor's empty profile fields,
     archives the other record, and remembers exactly what moved — fn_unmerge_businesses puts
     it all back. Same shape as everything else in this file: previewed, never silent, undo not
     delete. Signals, strongest first: alias siblings linked to different records (the owner
     already said "same company"); same Direct client ID; same CR/VAT; same normalised name
     (EN/AR/legal); same website root domain. Contacts' phones/emails are not on the business
     row and are deliberately not used yet — that is the next signal to add, here. */
  var MERGES=null, MERGES_LOADING=false;
  function normB(s){
    s=String(s==null?'':s).toLowerCase();
    s=s.replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْـ]/g,'');
    s=s.replace(/[&.,'’`"()\/\\\-_+·|—–]/g,' ');
    var stop=['company','co','ltd','llc','inc','corp','corporation','group','holding','est','establishment','trading','for','the','and','of',
              'شركه','شركة','مؤسسه','مؤسسة','مجموعه','مجموعة','قابضه','قابضة','التجاريه','التجارية','المحدوده','المحدودة','وشركاه','وأولاده','واولاده'];
    return s.split(/\s+/).filter(function(t){return t&&stop.indexOf(t)<0;}).join(' ').trim();
  }
  function crDigits(s){ var d=String(s||'').replace(/\D/g,''); return d.length>=6?d:''; }
  function rootDomain(w){
    var s=String(w||'').toLowerCase().trim(); if(!s)return '';
    s=s.replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[\/?#]/)[0];
    if(!s||s.indexOf('.')<0)return '';
    if(/(gmail|hotmail|yahoo|outlook|icloud|live)\./.test(s))return '';
    if(/^(example|test|localhost|domain|website|site|na|none)\./.test(s))return '';   // placeholders, never a signal
    return s;
  }
  function bizUuid(b){ try{ return (window.__bizUuid?__bizUuid(b.id):b.id); }catch(_){ return b.id; } }
  function bizFinance(uuid){
    var groups=((window.FIN&&FIN.groupsByBiz)||{})[uuid]||[]; var n=0,total=0,seen={};
    if(groups.length&&window.FIN&&FIN.rows){
      FIN.rows.forEach(function(r){ if(r.deleted_at)return; if(groups.indexOf(r.client_group)<0)return; if(finExclusionCheck(r.client_group))return; if(!seen[r.invoice_no]){seen[r.invoice_no]=1;n++;} total+=(+r.total_incl_vat_sar||0); });
    }
    return {n:n,total:total,groups:groups};
  }
  function dupDismissed(){ try{ return (DB.settings&&DB.settings.bizDupDismissed)||[]; }catch(_){ return []; } }
  function pairKey(a,b){ return [a,b].sort().join('|'); }
  function dupCandidates(){
    var list=((typeof DB!=='undefined')&&DB.businesses)||[]; list=list.filter(function(b){return b&&!b.archivedAt&&!b.archived_at&&!b._archived;});
    var byUuid={}; list.forEach(function(b){ byUuid[bizUuid(b)]=b; });
    var pairs={};
    function add(ua,ub,why){ if(!ua||!ub||ua===ub||!byUuid[ua]||!byUuid[ub])return; var k=pairKey(ua,ub); (pairs[k]=pairs[k]||{a:byUuid[ua],b:byUuid[ub],why:[]}); if(pairs[k].why.indexOf(why)<0)pairs[k].why.push(why); }
    // (1) alias siblings linked to different records
    var linkBy=(window.FIN&&FIN.linkByGroup)||{};
    groupMap().forEach(function(e){
      if(e.active===false)return;
      var ids=[]; (e.aliases||[]).forEach(function(a){ var l=linkBy[a]; if(l&&l.business_id&&ids.indexOf(l.business_id)<0)ids.push(l.business_id); });
      for(var i=0;i<ids.length;i++)for(var j=i+1;j<ids.length;j++)add(ids[i],ids[j],fl('alias siblings "'+e.canonicalName+'" linked to two records','أسماء بديلة لـ "'+e.canonicalName+'" مرتبطة بسجلّين'));
    });
    // (2..5) shared stable keys
    var byKey={};
    function key(k,uuid){ if(!k)return; (byKey[k]=byKey[k]||[]); if(byKey[k].indexOf(uuid)<0)byKey[k].push(uuid); }
    list.forEach(function(b){
      var u=bizUuid(b);
      if(b.directClientId)key('id:'+String(b.directClientId).trim(),u);
      var cr=crDigits(b.crVat||b.vatNumber||b.crNumber); if(cr)key('cr:'+cr,u);
      [b.name,b.nameAr,b.legalName].forEach(function(n){ var k=normB(n); if(k&&k.length>=4)key('nm:'+k,u); });
      var d=rootDomain(b.website); if(d)key('dom:'+d,u);
    });
    Object.keys(byKey).forEach(function(k){
      var ids=byKey[k]; if(ids.length<2)return;
      if(k.indexOf('dom:')===0&&ids.length>2)return;   // a domain shared by many records is a portal/group site, not a duplicate
      var why=k.indexOf('id:')===0?fl('same Direct client ID','نفس معرّف العميل في دايركت'):k.indexOf('cr:')===0?fl('same CR/VAT number','نفس رقم السجل/الضريبة'):k.indexOf('dom:')===0?fl('same website','نفس الموقع'):fl('same name','نفس الاسم');
      for(var i=0;i<ids.length;i++)for(var j=i+1;j<ids.length;j++)add(ids[i],ids[j],why);
    });
    var dis=dupDismissed();
    function rank(p){ return p.why.reduce(function(s,w){ return s+(/alias|بديلة/.test(w)?100:/client ID|معرّف/.test(w)?50:/CR\/VAT|السجل/.test(w)?40:/name|الاسم/.test(w)?20:5); },0); }
    return Object.keys(pairs).filter(function(k){return dis.indexOf(k)<0;}).map(function(k){ var p=pairs[k]; p.key=k; p.ua=bizUuid(p.a); p.ub=bizUuid(p.b); p.fa=bizFinance(p.ua); p.fb=bizFinance(p.ub); return p; })
      .sort(function(x,y){ return rank(y)-rank(x); });   // strongest evidence first
  }
  function loadMerges(cb){
    if(MERGES!==null){ cb(); return; }
    if(MERGES_LOADING)return; MERGES_LOADING=true;
    var c=client62(); if(!c){ MERGES=[]; MERGES_LOADING=false; cb(); return; }
    c.from('business_merges').select('*').order('merged_at',{ascending:false}).limit(50).then(function(r){ MERGES=(r&&r.data)||[]; MERGES_LOADING=false; cb(); });
  }
  // stage word in the reader's language (the Arabic map lives in js/21); falls back to the raw word
  function stageLabel62(s){ s=String(s||''); try{ var m=window.__STAGE_AR||window.STAGE_AR; if(isAr62()&&m&&m[s])return m[s]; }catch(_){} return s; }
  function isAr62(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function bizCard(b,f){
    return '<div style="flex:1;min-width:220px;border:1px solid var(--line,#eee);border-radius:10px;padding:10px 12px;font-size:12.5px">'
      +'<div style="font-weight:800">'+esc62(b.name||'')+'</div>'
      +(b.nameAr?('<div>'+esc62(b.nameAr)+'</div>'):'')
      +(b.legalName&&b.legalName!==b.name?('<div style="color:var(--muted)">'+esc62(b.legalName)+'</div>'):'')
      +'<div style="color:var(--muted);margin-top:4px">'+(b.crVat?(fl('CR/VAT ','س.ت/الرقم الضريبي ')+esc62(b.crVat)+' · '):'')+(b.directClientId?(fl('Direct #','دايركت #')+esc62(b.directClientId)+' · '):'')+esc62(stageLabel62(b.stage))+(b.isClient?' · '+fl('client','عميل'):'')+'</div>'
      +'<div style="margin-top:4px"><b>'+f.n+'</b> '+fl('invoices','فاتورة')+' · <b>'+money62(f.total)+'</b> '+fl('SAR','ر.س')+'</div>'
      +'</div>';
  }
  window.v62MergeBiz=function(keepU,dropU){
    if(!canEdit62())return;
    var all=((typeof DB!=='undefined')&&DB.businesses)||[]; var K=null,D=null;
    all.forEach(function(b){ var u=bizUuid(b); if(u===keepU)K=b; if(u===dropU)D=b; });
    if(!K||!D){ alert(fl('Could not find both companies.','تعذّر العثور على الشركتين.')); return; }
    var fd=bizFinance(dropU), fk=bizFinance(keepU);
    var msg=fl('Merge "'+(D.name||'')+'" INTO "'+(K.name||'')+'"?\n\nEverything on "'+(D.name||'')+'" — contacts, activities, billing profiles, invoice links ('+fd.n+' invoices, '+money62(fd.total)+' SAR), transactions, documents — moves to "'+(K.name||'')+'" ('+fk.n+' invoices, '+money62(fk.total)+' SAR). Empty profile fields on the kept record are filled from the merged one. The merged record is archived, not deleted, and this can be undone.',
      'دمج "'+(D.name||'')+'" في "'+(K.name||'')+'"؟\n\nكل ما على "'+(D.name||'')+'" — جهات الاتصال والأنشطة وملفات الفوترة وروابط الفواتير ('+fd.n+' فاتورة، '+money62(fd.total)+' ر.س) والمعاملات والمستندات — ينتقل إلى "'+(K.name||'')+'" ('+fk.n+' فاتورة، '+money62(fk.total)+' ر.س). تُملأ الحقول الفارغة في السجل المُبقى من السجل المدمج. يُؤرشف السجل المدمج ولا يُحذف، ويمكن التراجع.');
    if(!confirm(msg))return;
    var c=client62(); if(!c){ alert(fl('Not connected.','غير متصل.')); return; }
    c.rpc('fn_merge_businesses',{p_keep:keepU,p_drop:dropU,p_reason:'duplicate company (guardrails card)'}).then(function(r){
      if(r&&r.error){ alert(fl('Merge failed: ','فشل الدمج: ')+(r.error.message||'')); return; }
      try{ if(typeof toast==='function')toast(fl('Merged. Reloading…','تم الدمج. جارٍ إعادة التحميل…')); }catch(_){}
      setTimeout(function(){ location.reload(); },600);
    });
  };
  window.v62UnmergeBiz=function(id){
    if(!canEdit62())return;
    if(!confirm(fl('Undo this merge? Every moved record goes back to the restored company, which is un-archived.','التراجع عن هذا الدمج؟ يعود كل سجل منقول إلى الشركة المستعادة، وتُلغى أرشفتها.')))return;
    var c=client62(); if(!c)return;
    c.rpc('fn_unmerge_businesses',{p_merge_id:id}).then(function(r){
      if(r&&r.error){ alert(fl('Undo failed: ','فشل التراجع: ')+(r.error.message||'')); return; }
      try{ if(typeof toast==='function')toast(fl('Merge undone. Reloading…','تم التراجع. جارٍ إعادة التحميل…')); }catch(_){}
      setTimeout(function(){ location.reload(); },600);
    });
  };
  window.v62DismissDup=function(key){
    if(!canEdit62())return;
    DB.settings=DB.settings||{}; DB.settings.bizDupDismissed=DB.settings.bizDupDismissed||[];
    if(DB.settings.bizDupDismissed.indexOf(key)<0)DB.settings.bizDupDismissed.push(key);
    if(typeof save==='function')save(); if(typeof render==='function')render();
  };
  window.v62UndismissDups=function(){
    if(!canEdit62())return;
    DB.settings=DB.settings||{}; DB.settings.bizDupDismissed=[];
    if(typeof save==='function')save(); if(typeof render==='function')render();
  };
  function dupSectionHtml(ar){
    var cands=dupCandidates();
    var h='<hr style="margin:18px 0;border:none;border-top:1px solid var(--line,#eee)">'
      +'<h3 style="margin:0 0 4px" class="v62-dup-h">'+fl('Duplicate companies','الشركات المكرّرة')+'</h3>'
      +'<div class="ch-sub" style="margin-bottom:10px">'+fl('Two records for one company split its contacts, profiles and invoices. Merging moves everything to one record; the other is archived, not deleted — undo below.','سجلّان لشركة واحدة يقسمان جهات اتصالها وملفاتها وفواتيرها. الدمج ينقل كل شيء إلى سجل واحد؛ يُؤرشف الآخر ولا يُحذف — التراجع أدناه.')+'</div>';
    if(cands.length){
      h+=cands.map(function(p){
        var keepDefault=(p.a.directClientId||crDigits(p.a.crVat))&&!(p.b.directClientId||crDigits(p.b.crVat))?p.ua:((p.b.directClientId||crDigits(p.b.crVat))&&!(p.a.directClientId||crDigits(p.a.crVat))?p.ub:(p.fa.n>=p.fb.n?p.ua:p.ub));
        var sid='dk_'+p.key.replace(/[^a-z0-9]/gi,'');
        return '<div class="v62-dup" data-key="'+esc62(p.key)+'" style="border:1px solid #F0C9A8;background:#FFF8F2;border-radius:12px;padding:12px;margin-bottom:10px">'
          +'<div style="font-size:12px;color:#B54708;margin-bottom:8px">⚠ '+fl('Why: ','السبب: ')+esc62(p.why.join(' · '))+'</div>'
          +'<div style="display:flex;gap:10px;flex-wrap:wrap">'+bizCard(p.a,p.fa)+bizCard(p.b,p.fb)+'</div>'
          +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:12.5px">'
          +'<label>'+fl('Keep:','الإبقاء على:')+' <select id="'+sid+'" style="font-size:12.5px">'
            +'<option value="'+esc62(p.ua)+'" '+(keepDefault===p.ua?'selected':'')+'>'+esc62(p.a.name||'')+'</option>'
            +'<option value="'+esc62(p.ub)+'" '+(keepDefault===p.ub?'selected':'')+'>'+esc62(p.b.name||'')+'</option></select></label>'
          +'<button class="btn pri sm" onclick="(function(){var s=document.getElementById(\''+sid+'\');var k=s.value;var d=(k===\''+esc62(p.ua)+'\')?\''+esc62(p.ub)+'\':\''+esc62(p.ua)+'\';v62MergeBiz(k,d);})()">'+fl('Merge »','دمج »')+'</button>'
          +'<button class="btn ghost sm" onclick="v62DismissDup(\''+esc62(p.key)+'\')">'+fl('Not a duplicate','ليست مكرّرة')+'</button>'
          +'</div></div>';
      }).join('');
    } else {
      h+='<div class="empty" style="padding:6px 0 10px">'+fl('No likely duplicates found.','لا توجد شركات يُرجّح تكرارها.')+'</div>';
    }
    var dis=dupDismissed();
    if(dis.length)h+='<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">'+dis.length+' '+fl('dismissed as not duplicates','مستبعدة كغير مكرّرة')+' · <a href="#" onclick="v62UndismissDups();return false;">'+fl('show again','إظهارها مجددًا')+'</a></div>';
    var ms=MERGES||[];
    if(ms.length){
      h+='<div style="overflow-x:auto"><table class="v62-merges" style="width:100%;font-size:12.5px;border-collapse:collapse"><thead><tr style="background:#303848;color:#fff;text-align:'+(ar?'right':'left')+'"><th style="padding:6px 8px">'+fl('Kept','المُبقى')+'</th><th style="padding:6px 8px">'+fl('Merged away','المدمج')+'</th><th style="padding:6px 8px">'+fl('When · by','متى · بواسطة')+'</th><th style="padding:6px 8px"></th></tr></thead><tbody>'
        +ms.map(function(m){
          var keptName=(function(){ var all=((typeof DB!=='undefined')&&DB.businesses)||[]; for(var i=0;i<all.length;i++){ if(bizUuid(all[i])===m.kept_id)return all[i].name; } return m.kept_id; })();
          var dropName=(m.dropped_snapshot&&m.dropped_snapshot.name)||m.dropped_id;
          var undone=!!m.undone_at;
          return '<tr'+(undone?' style="opacity:.55"':'')+'><td style="padding:6px 8px;font-weight:700">'+esc62(keptName)+'</td><td style="padding:6px 8px">'+esc62(dropName)+'</td>'
            +'<td style="padding:6px 8px;color:var(--muted);font-size:11px">'+esc62(String(m.merged_at||'').slice(0,10))+' · '+esc62(m.actor||'')+(undone?(' · '+fl('undone','أُلغي')+' '+esc62(String(m.undone_at).slice(0,10))):'')+'</td>'
            +'<td style="padding:6px 8px">'+(undone?'':('<button class="btn ghost sm" onclick="v62UnmergeBiz(\''+esc62(m.id)+'\')">'+fl('Undo','تراجع')+'</button>'))+'</td></tr>';
        }).join('')+'</tbody></table></div>';
    } else if(MERGES===null){
      h+='<div style="font-size:11.5px;color:var(--muted)">'+fl('Loading merge history…','جارٍ تحميل سجل الدمج…')+'</div>';
    }
    return h;
  }

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
        +'<button class="btn sm" onclick="v62OpenGrouping()">'+fl('Group profiles…','تجميع الملفات…')+'</button>'
        +dupSectionHtml(ar);
      view.appendChild(card);
      // Part 3's merge history comes from Supabase — load once per page session, then repaint
      // this card so Undo buttons appear; nothing else on the tab is touched.
      if(MERGES===null){ loadMerges(function(){ try{ var old=view.querySelector('.v62-guardrails'); if(old)old.remove(); inject(); }catch(_){ } }); }
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
