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
  // share views are read-only everywhere (2026-09-02) — finCanWrite re-applies that half of the rule
  function canEdit62(){ try{ if(window.finCanWrite) return !!window.finCanWrite(); return window.canFinEdit?canFinEdit():false; }catch(_){ return false; } }
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
  /* 2026-09-07 (watch cycle 43) — A PREDICATE THAT CAN ACTUALLY BE FALSE.
     Cycle 42 found that `Object.keys(DB.settings).length` is never 0 in the running app (js/09
     fills DB.settings at load), so every guard resting on it — cycle 40's merge-dialog refusal
     and cycle 41's importer gate — could not fire. Cycle 42 fixed the importer by asking the
     server at commit time. This is the same fact made available to the surfaces that only
     DISPLAY, which cannot afford a network round trip on every render.
     Two independent ways to know the list has arrived, because neither alone covers both cases:
       · DB.settings.financeExclusions is an ARRAY — the blob landed carrying the key. Instant,
         free, and true for any workspace that has ever configured an exclusion.
       · a one-shot read of app_settings at startup — the only thing that can distinguish "no
         exclusions configured" from "not loaded yet" in a workspace that has none, since the
         key is simply absent in both.
     Until one of them answers, the honest report is "not known", and the standing rule applies:
     a display may degrade to "not checked yet"; it may not present an excluded partner's money
     as an ordinary client's. */
  var EXCL={known:false,list:null,tries:0};
  function exclLoad(){
    if(EXCL.known||EXCL.tries>5)return;
    EXCL.tries++;
    var c=client62(); if(!c){ setTimeout(exclLoad,1500); return; }
    try{
      c.from('app_settings').select('data').eq('id','main').then(function(r){
        if(r&&!r.error&&r.data&&r.data.length){
          var blob=r.data[0].data||{};
          EXCL.list=blob.financeExclusions||[]; EXCL.known=true;
          try{ if(typeof render==='function'&&window.current==='finance')render(); }catch(_){}
          return;
        }
        setTimeout(exclLoad,1500);
      }).catch(function(){ setTimeout(exclLoad,1500); });
    }catch(_){ setTimeout(exclLoad,1500); }
  }
  try{ setTimeout(exclLoad,300); }catch(_){}
  window.finExclusionsKnown=function(){
    try{ if(Array.isArray(DB.settings&&DB.settings.financeExclusions))return true; }catch(_){}
    return !!EXCL.known;
  };

  window.finExclusionCheck=function(name){
    var n=norm62(name); if(!n)return null;
    /* the page's own copy first, then the authoritative one read at startup — the second covers
       the window before js/35 merges the blob, where the page copy is still empty */
    var list=exclusions(); if(EXCL.list&&EXCL.list.length)list=list.concat(EXCL.list);
    for(var i=0;i<list.length;i++){
      var e=list[i], names=e.matchNames||[];
      for(var j=0;j<names.length;j++){ if(norm62(names[j])===n) return e; }
    }
    return null;
  };
  window.finExclusionList=exclusions;

  /* 2026-09-07 (watch cycle 41, CORRECTED BY CYCLE 42) — "not on the list" and "no list yet"
     are not the same answer, and finExclusionCheck() returns the same null for both. Six call
     sites across four files (js/16, js/31, js/41, js/62, js/65) read that null as "safe to
     proceed". The rule that follows still stands and is the reason any of this exists:
     DISPLAYING a number may degrade to "not checked yet"; WRITING rows must refuse. A read that
     is briefly wrong is corrected by the next render. A row written under a list that had not
     loaded is in the database until someone finds it by hand.

     CYCLE 41 GOT THE MECHANISM WRONG AND THE BATTERY CAUGHT IT. It discriminated on
     `Object.keys(DB.settings).length` — empty meaning "the blob has not landed". Measured
     directly in cycle 42, with the app_settings response held back 25 seconds:

         DB.settings keys  ["lang","currency","funnels","funnelSubs"]
         finExclusionsReady()      true
         finExclusionCheck(...)    false

     js/09's ensureFunnel() writes `funnels`/`funnelSubs` unconditionally at load, and the app
     sets lang and currency for itself, so DB.settings is NEVER empty by the time anyone can
     press a button. The gate could not fire in the running app; it only passed its own probe
     because the probe forced `DB.settings = {}` by hand — a state the app is never in. A guard
     verified against a world constructed to suit it is the exact failure this whole arc has
     been removing, and it happened here.

     So stop inferring. There is no local fact that answers "has the exclusion list loaded" —
     js/35 merges the blob key by key and leaves no marker — and adding one means editing js/35,
     which is outside this lane. Ask the server instead. A write is about to make a round trip
     anyway, so one authoritative read of app_settings before it costs nothing that matters and
     replaces a guess with the actual list. It fails CLOSED: if the list cannot be read, the
     write does not happen. */
  function matchIn(list,name){
    var n=norm62(name); if(!n)return null;
    for(var i=0;i<(list||[]).length;i++){
      var e=list[i], names=e.matchNames||[];
      for(var j=0;j<names.length;j++){ if(norm62(names[j])===n) return e; }
    }
    return null;
  }
  /* Reads the exclusion list from app_settings itself and checks the rows about to be written
     against it. cb(null) means proceed; cb(message) is the reason not to, in the reader's own
     language, ready to show. Callers must not proceed on anything but an explicit null. */
  window.finExclusionGateRows=function(rows,cb){
    var done=false, finish=function(m){ if(done)return; done=true; try{cb(m);}catch(_){} };
    var c=client62();
    if(!c){ finish(fl('Not connected, so this import could not be checked against the exclusion list. Nothing was written.',
                      'لا يوجد اتصال، لذا تعذّر فحص هذا الاستيراد مقابل قائمة الاستبعاد. لم يُكتب أي شيء.')); return; }
    /* a read that hangs must not hang the commit — it must refuse */
    var timer=setTimeout(function(){ finish(fl('The exclusion list could not be read in time, so this import was not checked against it. Nothing was written. Try again.',
                                               'تعذّرت قراءة قائمة الاستبعاد في الوقت المناسب، لذا لم يُفحص هذا الاستيراد مقابلها. لم يُكتب أي شيء. حاول مجددًا.')); },20000);
    try{
      c.from('app_settings').select('data').eq('id','main').then(function(r){
        clearTimeout(timer);
        if(r&&r.error){ finish(fl('The exclusion list could not be read, so this import was not checked against it. Nothing was written. ',
                                  'تعذّرت قراءة قائمة الاستبعاد، لذا لم يُفحص هذا الاستيراد مقابلها. لم يُكتب أي شيء. ')+((r.error&&r.error.message)||'')); return; }
        var rowsBack=(r&&r.data)||[];
        if(!rowsBack.length){ finish(fl('The workspace settings could not be read, so the exclusion list is unknown. Nothing was written.',
                                        'تعذّرت قراءة إعدادات مساحة العمل، لذا قائمة الاستبعاد غير معروفة. لم يُكتب أي شيء.')); return; }
        /* THE UNION OF BOTH LISTS, not the server's alone. Each knows something the other does
           not. The server is authoritative for what the PREVIEW may have missed — a list that
           had not loaded when the file was sorted. The page is authoritative for what the
           SERVER has not caught up with — an exclusion the owner added a moment ago whose save
           has not flushed. Trusting either one alone writes a row the other would have stopped;
           probe-importer-scale-attacks holds the page half, probe-stale-preview-exclusion the
           server half. Neither is a fallback for the other. */
        var blob=rowsBack[0].data||{}, list=(blob.financeExclusions||[]).concat(exclusions()), hits=[];
        (rows||[]).forEach(function(x){
          if(!x)return;
          var e=matchIn(list,x.client_group)||matchIn(list,x.customer_raw_name);
          var nm=x.client_group||x.customer_raw_name;
          if(e&&hits.indexOf(nm)<0)hits.push(nm);
        });
        if(!hits.length){ finish(null); return; }
        finish(fl('Nothing was written. This file was sorted before the exclusion list had loaded, so ',
                  'لم يُكتب أي شيء. جرى فرز هذا الملف قبل اكتمال تحميل قائمة الاستبعاد، لذا ')+
               hits.join('، ')+
               fl(' came through as an ordinary client. Every other decision in that preview was made the same way, so the whole file is refused rather than partly imported. Drop the file again — it will be checked properly this time.',
                  ' مرّ كعميل عادي. وكل قرار آخر في تلك المعاينة اتُّخذ بالطريقة نفسها، لذا رُفض الملف كاملًا بدل استيراده جزئيًا. أعد إسقاط الملف — سيُفحص فحصًا سليمًا هذه المرة.'));
      }).catch(function(e){ clearTimeout(timer); finish(fl('The exclusion list could not be read, so this import was not checked against it. Nothing was written. ',
                                                          'تعذّرت قراءة قائمة الاستبعاد، لذا لم يُفحص هذا الاستيراد مقابلها. لم يُكتب أي شيء. ')+String((e&&e.message)||e)); });
    }catch(e){ clearTimeout(timer); finish(fl('The exclusion list could not be read, so this import was not checked against it. Nothing was written.',
                                              'تعذّرت قراءة قائمة الاستبعاد، لذا لم يُفحص هذا الاستيراد مقابلها. لم يُكتب أي شيء.')); }
  };

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
  window.finGroupCandidates=function(){ return groupCandidates(); };

  // Every distinct client_group value currently live, with its own invoice count and total —
  // the real preview behind the alias picker and the suggestion pass, not a blind text field.
  /* 2026-09-07 (cycle 43): refuses while the list is unknown. An entry in the alias picker is
     an OFFER TO MERGE two company records, and merging is a write — so this sits on the write
     side of the standing rule, not the display side. Returning nothing makes the picker say it
     cannot check yet, which is true; listing everything would quietly offer a standing-excluded
     partner on the screen that decides which company record survives. */
  function groupCandidates(){
    if(!window.finExclusionsKnown())return {};
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
    /* 2026-09-07 (cycle 43): say it, rather than showing an empty list that looks like "no
       clients". The person is one click from merging two company records; "I could not check
       this against the exclusion list yet" is the only honest thing to put on that screen. */
    if(!window.finExclusionsKnown()){
      alert(fl('The exclusion list has not finished loading, so the merge candidates could not be checked against it. Nothing is being offered yet — give it a moment and try again.',
               'لم تكتمل بعد قراءة قائمة الاستبعاد، لذا تعذّر فحص خيارات الدمج مقابلها. لا يُعرض أي خيار الآن — أمهله لحظة ثم أعد المحاولة.'));
      return;
    }
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
    /* 2026-09-08 (watch cycle 56) — THIS DIALOG WAITED FOR THE PROFILES AND NOT FOR THE COMPANIES.
       The line above is the right instinct: if the profiles are not loaded, load them and come
       back. Nothing did the equivalent for DB.businesses, which fills the "group them under"
       dropdown — so the dialog opened onto an EMPTY list, let the person choose profiles and a
       name, and only at Save said "Choose the company to group them under": an instruction
       nobody can follow, about a list that was never there. Measured with probe-grouping-dialog-
       readiness — a workspace with no client companies opens the dialog with nothing in it and
       says nothing at all.
       The same blank list appears whether no client company exists or the list simply has not
       arrived, and one refusal covers both — which is why this does not try to tell them apart.
       It says what is true either way: there is nothing to group under yet. This is the screen
       that decides which company record a client's money ends up under (cycles 40 and 43), so
       it should not be enterable in a state where that choice cannot be made. */
    var _bizReady=(DB.businesses||[]).filter(function(b){return b&&b.isClient;}).length;
    if(!_bizReady){
      alert(fl('There are no client companies to group these profiles under yet — either the company list has not finished loading, or none is marked as a client. Nothing was changed. Give it a moment, or add a client company first.',
               'لا توجد شركات عملاء لتجميع هذه الملفات تحتها بعد — إما أن قائمة الشركات لم تكتمل بعد، أو لا توجد شركة معلَّمة كعميل. لم يتغيّر شيء. أمهله لحظة، أو أضف شركة عميل أولًا.'));
      return;
    }
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
        c.from('client_profiles').update({business_id:target,grouped_by:who62(),grouped_at:new Date().toISOString()}).in('id',sel).select('id').then(function(r){
          if(r.error){ alert(fl('Could not save: ','تعذر الحفظ: ')+r.error.message); return; }
          var moved=(r.data||[]).length;
          if(moved!==sel.length){ alert(fl('Only '+moved+' of '+sel.length+' profiles were actually moved — the database refused the rest (permissions). Reloading to show what is really there.','نُقل '+moved+' من '+sel.length+' ملفات فقط — رفضت قاعدة البيانات الباقي (صلاحيات). سيُعاد التحميل لعرض الوضع الفعلي.')); }
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
    /* 2026-09-07 (watch cycle 40): read through js/16's chokepoint. This total is printed in the
       MERGE CONFIRMATION — "… invoice links (2 invoices, 20,000 SAR) … moves to …" — which is the
       fact a person reads when deciding which of two company records to KEEP and which to
       ARCHIVE. It used to re-implement live()'s three rules here (drop deleted, drop excluded,
       coerce money with a raw `+`) and got the third wrong: FIN.rows is only clean as a side
       effect of live() having run, because live() sanitises IN PLACE. The duplicate-companies
       card is reachable without ever opening Finance, and measured that way the dialog read
       "2 invoices, 0 SAR" for a company holding 20,000 — the COUNT right and the money zero,
       which reads as a coherent fact rather than an obvious error. Cycle 39 found the same hole
       in js/16's invoice modal. window.finLive() applies all three rules in one place, so this
       surface cannot drift from every other total again; the old loop stays as a fallback for
       the case where the ledger layer never loaded, where there is nothing to read anyway. */
    if(groups.length){
      var rows=null;
      try{ if(typeof window.finLive==='function') rows=window.finLive(); }catch(_){ rows=null; }
      if(rows){
        rows.forEach(function(r){ if(groups.indexOf(r.client_group)<0)return; if(!seen[r.invoice_no]){seen[r.invoice_no]=1;n++;} total+=(+r.total_incl_vat_sar||0); });
        return {n:n,total:total,groups:groups};
      }
      if(window.FIN&&FIN.rows){
        FIN.rows.forEach(function(r){ if(r.deleted_at)return; if(groups.indexOf(r.client_group)<0)return; if(finExclusionCheck(r.client_group))return; try{ if(typeof window.finSanitizeMoney==='function')window.finSanitizeMoney(r); }catch(_){} if(!seen[r.invoice_no]){seen[r.invoice_no]=1;n++;} total+=(+r.total_incl_vat_sar||0); });
      }
    }
    return {n:n,total:total,groups:groups};
  }
  /* Has the settings blob (js/35's app_settings read) landed at all? An empty DB.settings means
     it has not; a populated one with no financeExclusions key means the workspace genuinely has
     no exclusions. The difference matters here because finExclusionCheck() answers "not
     excluded" in BOTH cases, so a total computed before the blob arrives silently INCLUDES an
     excluded client's money — measured 2026-09-07 (watch cycle 40): the merge dialog offered
     "2 invoices, 889,388 SAR" for a company whose own money is 500, the rest being a standing-
     excluded partner's. That is a fail-open on the owner's hardest ruling, on the surface that
     decides which company record survives. The number is not guessed at and not silently
     wrong: the dialog says the total could not be checked yet. */
  /* 2026-09-07 (cycle 43): was `Object.keys(DB.settings).length`, which cycle 42 measured as
     never false in the running app — so this dialog's refusal, added in cycle 40, had never
     once fired. It rests on a fact now rather than on an assumption. */
  function settingsLanded(){ try{ return !!window.finExclusionsKnown(); }catch(_){ return false; } }
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
    if(!settingsLanded()){
      alert(fl('Not yet — the exclusion list has not finished loading, so the invoice totals below cannot be checked against it and could include a client this workspace excludes. Give it a moment and try again.',
               'ليس بعد — لم تكتمل بعد قراءة قائمة الاستبعاد، لذا لا يمكن التحقق من إجماليات الفواتير أدناه مقابلها وقد تشمل عميلاً يستبعده هذا الحساب. أمهله لحظة ثم أعد المحاولة.'));
      return;
    }
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
          +(canEdit62()
            ?('<button class="btn pri sm" onclick="(function(){var s=document.getElementById(\''+sid+'\');var k=s.value;var d=(k===\''+esc62(p.ua)+'\')?\''+esc62(p.ub)+'\':\''+esc62(p.ua)+'\';v62MergeBiz(k,d);})()">'+fl('Merge »','دمج »')+'</button>'
              +'<button class="btn ghost sm" onclick="v62DismissDup(\''+esc62(p.key)+'\')">'+fl('Not a duplicate','ليست مكرّرة')+'</button>')
            :('<span style="color:var(--muted);font-size:12px">'+fl('Only an admin or manager can merge.','الدمج للمدير أو المشرف فقط.')+'</span>'))
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
          /* 2026-09-08 (watch cycle 66): the kept company is often ARCHIVED by a later merge, and
             an archived company is not in DB.businesses — so this fell through to printing a raw
             uuid in the Kept column. The later merge holds its name in its own snapshot; use it. */
          var nameOfBiz=function(uuid){
            var all=((typeof DB!=='undefined')&&DB.businesses)||[];
            for(var i=0;i<all.length;i++){ if(bizUuid(all[i])===uuid)return all[i].name; }
            for(var j=0;j<ms.length;j++){ if(ms[j]&&ms[j].dropped_id===uuid&&ms[j].dropped_snapshot&&ms[j].dropped_snapshot.name)return ms[j].dropped_snapshot.name; }
            return uuid;
          };
          var keptName=nameOfBiz(m.kept_id);
          var dropName=(m.dropped_snapshot&&m.dropped_snapshot.name)||m.dropped_id;
          var undone=!!m.undone_at;
          /* 2026-09-08 (watch cycle 66) — MERGES CAN CHAIN, AND UNDO IS ORDER-DEPENDENT.
             Merge B into A, then A into C, and both sit here with an Undo button each. Undo the
             FIRST and its moved-list puts B's records back on B — but they are on C by then;
             undo the second afterwards and ITS moved-list (which still names those records,
             because they were on A when A was merged) puts them on A. Which company ends up with
             the money depends on which button is pressed first, and nothing said so.
             Checked read-only before writing this: the database functions already refuse a double
             undo (`where id = p_merge_id and undone_at is null`) and refuse merging into an
             archived company — so those two are NOT defects. Order is the one nobody guards, and
             it is guarded here rather than in the functions, which are not this session's to
             change (P4) and do not need to be: the chain is visible in rows this file already has.
             The later merge keeps its Undo — it is the one that is safe, and taking the whole
             chain away would leave no way back at all. */
          var blocker=null;
          if(!undone){
            for(var bi=0;bi<ms.length;bi++){
              var o=ms[bi];
              if(o&&!o.undone_at&&o.id!==m.id&&o.dropped_id===m.kept_id){ blocker=o; break; }
            }
          }
          var action;
          if(undone) action='';
          else if(blocker) action='<span style="color:#B54708;font-size:11.5px">'+fl(
              'Undo "'+esc62(((blocker.dropped_snapshot&&blocker.dropped_snapshot.name)||blocker.dropped_id))+' \u2192 '+esc62(nameOfBiz(blocker.kept_id))+'" first \u2014 '+esc62(keptName)+' has since been merged away, so undoing this one now would be reversed by that one.',
              '\u062a\u0631\u0627\u062c\u0639 \u0623\u0648\u0644\u0627\u064b \u0639\u0646 \u00ab'+esc62(((blocker.dropped_snapshot&&blocker.dropped_snapshot.name)||blocker.dropped_id))+' \u2192 '+esc62(nameOfBiz(blocker.kept_id))+'\u00bb \u2014 \u0641\u0640 '+esc62(keptName)+' \u062f\u064f\u0645\u0650\u062c\u064e\u062a \u0628\u0639\u062f \u0630\u0644\u0643\u060c \u0641\u0627\u0644\u062a\u0631\u0627\u062c\u0639 \u0647\u0646\u0627 \u0627\u0644\u0622\u0646 \u0633\u064a\u064f\u0644\u063a\u064a\u0647 \u0630\u0644\u0643 \u0627\u0644\u062a\u0631\u0627\u062c\u0639.')+'</span>';
          else action='<button class="btn ghost sm" onclick="v62UnmergeBiz(\''+esc62(m.id)+'\')">'+fl('Undo','تراجع')+'</button>';
          return '<tr'+(undone?' style="opacity:.55"':'')+'><td style="padding:6px 8px;font-weight:700">'+esc62(keptName)+'</td><td style="padding:6px 8px">'+esc62(dropName)+'</td>'
            +'<td style="padding:6px 8px;color:var(--muted);font-size:11px">'+esc62(String(m.merged_at||'').slice(0,10))+' · '+esc62(m.actor||'')+(undone?(' · '+fl('undone','أُلغي')+' '+esc62(String(m.undone_at).slice(0,10))):'')+'</td>'
            +'<td style="padding:6px 8px">'+action+'</td></tr>';
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
