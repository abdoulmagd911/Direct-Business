/* ===== Funnels — one chapter, one file (Step 1, chapter 3 — 2026-08-15) =====

   The funnel feature in one place:
     part 1 (was js/06)      the Service Integration Partners funnel registration, the
                              technical-integration panel on a lead card, app-store badges
                              and the Has-app filter
     part 2 (was js/09-v33)  the funnel tabs on the Leads page, hover previews, and the
                              funnel-details editor

   Merged at slot 09, NOT slot 06 — part 2 wraps the Leads drawing functions
   (renderLeads / drawTable / matchLead), and half a dozen later layers wrap the same
   functions on top of it; the wrap order IS the behaviour, so the wrapping part stays
   where it was. Part 1 moved down three slots: checked first that slots 07–08 neither
   read anything part 1 provides nor touch any leads function. Each part keeps its own
   try/catch, exactly as before.                                                        */

/* ---------- part 1 — SIP funnel registration + integration panel (was js/06) ---------- */
/* Service Integration Partners — funnel registration + Technical-integration card panel + app-store badges + Has-app filter */
(function(){try{
  var SIP='Service Integration Partners';
  var SUBS=['eSIM provider','Travel insurance','International driving permit','Other service integration'];
  var hasAppOnly=false;
  function E(x){try{return window.esc?esc(x):(''+(x==null?'':x)).replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}catch(_){return ''+(x==null?'':x);}}
  function ensureFunnel(){try{if(typeof DB==='undefined'||!DB)return;DB.settings=DB.settings||{};DB.settings.funnels=DB.settings.funnels||[];if(DB.settings.funnels.indexOf(SIP)<0)DB.settings.funnels.push(SIP);DB.settings.funnelSubs=DB.settings.funnelSubs||{};if(!DB.settings.funnelSubs[SIP])DB.settings.funnelSubs[SIP]=SUBS.slice();if(typeof SOURCE_COLOR!=='undefined'&&!SOURCE_COLOR[SIP])SOURCE_COLOR[SIP]='#0EA5E9';}catch(_){}}
  function bizById(id){try{var a=(typeof DB!=='undefined'&&DB.businesses)||[];for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];}catch(_){}return null;}
  function rowBiz(tr){try{var m=(tr.innerHTML.match(/openLeadFn\('([^']+)'\)|openLead='([^']+)'/)||[]);return bizById(m[1]||m[2]);}catch(_){return null;}}
  function panel(){try{
    var old=document.querySelector('.sip-panel'); if(old)old.parentNode.removeChild(old);
    var b=(typeof openLead!=='undefined'&&openLead)?bizById(openLead):null; if(!b)return;
    if(!(b.source===SIP||b.appleAppStoreUrl||b.googlePlayStoreUrl||b.integrationDocsUrl||b.integrationStatus||b.hasApp))return;
    var h=document.querySelector('[style*="font-size:21px"][style*="font-weight:800"]'); if(!h)return;
    var host=h.parentNode; if(!host)return;
    function L(u,lbl,bg,col){return u?('<a href="'+E(u)+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;background:'+bg+';color:'+col+';text-decoration:none;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:600;margin:0 7px 7px 0">'+lbl+'</a>'):'';}
    var links=L(b.appleAppStoreUrl,'App Store','#1118270d','#111827')+L(b.googlePlayStoreUrl,'Google Play','#16B36414','#0F7A44')+L(b.integrationDocsUrl,'API / Partner docs','#2E90FA14','#2E90FA')+L(b.website,'Website','#7C819414','#5b6178');
    var ppc=b.partnerProgramContact?('<div style="font-size:12px;color:#5b6178;margin-top:6px">Partner contact: <b>'+E(b.partnerProgramContact)+'</b></div>'):'';
    var p=document.createElement('div'); p.className='sip-panel';
    p.style.cssText='margin:14px 0;padding:13px 15px;border:1px solid #BAE6FD;background:linear-gradient(135deg,#F0F9FF,#fff);border-radius:12px';
    p.innerHTML='<div style="font-weight:800;font-size:13px;color:#0369A1;margin-bottom:9px">Technical integration <span style="font-weight:600;font-size:11px;background:#0EA5E91a;color:#0369A1;padding:2px 9px;border-radius:20px;margin-left:6px">'+E(b.integrationStatus||'Not approached')+'</span></div>'+(links||'<span style="font-size:12px;color:#7C8194">No app or docs links on file.</span>')+ppc;
    host.parentNode.insertBefore(p,host.nextSibling);
  }catch(_){}}
  function badges(){try{
    var trs=document.querySelectorAll('table tbody tr');
    for(var i=0;i<trs.length;i++){var tr=trs[i];
      var b=rowBiz(tr);
      var has=b&&(b.appleAppStoreUrl||b.googlePlayStoreUrl);
      if(has&&!tr.querySelector('.sip-appbadge')){var bold=tr.querySelector('td b');if(bold){var sp=document.createElement('span');sp.className='sip-appbadge';sp.style.cssText='margin-left:6px;font-size:10.5px;white-space:nowrap;color:#0369A1';sp.innerHTML=(b.appleAppStoreUrl?'<a href="'+E(b.appleAppStoreUrl)+'" target="_blank" rel="noopener" title="iOS app" onclick="event.stopPropagation()" style="text-decoration:none;color:#0369A1">iOS</a> ':'')+(b.googlePlayStoreUrl?'<a href="'+E(b.googlePlayStoreUrl)+'" target="_blank" rel="noopener" title="Android app" onclick="event.stopPropagation()" style="text-decoration:none;color:#0369A1">Android</a>':'');bold.appendChild(sp);}}
      if(hasAppOnly)tr.style.display=has?'':'none';
    }
  }catch(_){}}
  function filterChip(){try{
    if(typeof current==='undefined'||current!=='leads')return; // Has-app filter belongs to the SIP leads funnel, not Clients/Offers/Airlines
    return; /* Has app pill retired 2026-08-10 (owner) — SIP-funnel filter, restore when that funnel is worked */
    var btn=document.createElement('button'); btn.id='sip_hasapp'; btn.type='button'; btn.textContent='Has app';
    btn.style.cssText='padding:7px 12px;font-size:12.5px;border-radius:9px;border:1px solid var(--line-2,#e3ddd2);background:'+(hasAppOnly?'#0EA5E9':'#fff')+';color:'+(hasAppOnly?'#fff':'inherit')+';cursor:pointer';
    btn.onclick=function(){hasAppOnly=!hasAppOnly;btn.style.background=hasAppOnly?'#0EA5E9':'#fff';btn.style.color=hasAppOnly?'#fff':'inherit';badges();};
    tb.appendChild(btn);
  }catch(_){}}
  function run(){ensureFunnel();filterChip();panel();badges();}
  var iv=setInterval(function(){if(typeof render==='function'){clearInterval(iv);try{var _r=render;render=function(){var o=_r.apply(this,arguments);try{run();}catch(_){}setTimeout(run,40);return o;};}catch(_){}run();}},200);
  setTimeout(run,1500);setTimeout(run,3000);
}catch(e){console.warn('sip',e);}})();

/* ---------- part 2 — funnel tabs, previews, details editor (was js/09-v33) ---------- */
/* ===== v33 funnel UI layer: funnel tabs + hover preview + funnel-specific lead card section ===== */
(function(){
  function F(){return window.__FUNNELS||[];}
  var FCOLOR={blue:'#185FA5',purple:'#534AB7',teal:'#0F6E56',amber:'#854F0B',gray:'#5F5E5A'};
  window.__funnelTab=window.__funnelTab||'all';
  window.__needsAttn=false;

  function fdef(b){var out=null;F().forEach(function(f){if(f.key===b.funnelKey)out=f;});return out;}
  function overdue(b){return b.nextActionDate&&(new Date(b.nextActionDate+'T23:59:59')<new Date());}
  function attention(b){return !(b.contacts&&b.contacts.length)||overdue(b)||b.needsManualConfirmation===true;}

  var _match=window.matchLead;
  window.matchLead=function(b){
    if(!_match(b))return false;
    if(window.__funnelTab!=='all'&&b.funnelKey!==window.__funnelTab)return false;
    if(window.__needsAttn&&!attention(b))return false;
    return true;
  };

  var _rl=window.renderLeads;
  window.renderLeads=function(v){
    _rl(v);
    try{addTabs(v);}catch(e){console.warn('v33 tabs',e);}
  };
  function addTabs(v){
    if(window.openLead)return;
    var tb=v.querySelector('.toolbar');if(!tb||document.getElementById('funnelTabs'))return;
    var strip=document.createElement('div');
    strip.id='funnelTabs';
    strip.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px';
    /* 2026-08-22 owner catch: this used to count DB.businesses outright, which includes
       clients and archived rows — a 79-row leads table showed a funnel "All" tab reading
       118 because it was silently counting the 30 live clients too. Leads only. */
    var leadPool=function(){return (DB.businesses||[]).filter(function(b){return !b.isClient&&!b.archivedAt&&!b._archived;});};
    var counts={all:leadPool().length};
    F().forEach(function(f){counts[f.key]=leadPool().filter(function(b){return b.funnelKey===f.key;}).length;});
    function chip(key,label,color){
      var on=window.__funnelTab===key;
      var b=document.createElement('button');
      b.textContent=label+' \u00b7 '+(counts[key]||0);
      b.style.cssText='border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:999px;background:'+(on?(color||'#1C1E2B'):'#eef0f5')+';color:'+(on?'#fff':'#3a3f52');
      b.onclick=function(){window.__funnelTab=key;renderLeads(v);};
      return b;
    }
    strip.appendChild(chip('all','All','#1C1E2B'));
    F().forEach(function(f){strip.appendChild(chip(f.key,f.name_en,FCOLOR[f.color]||'#5F5E5A'));});
    var attnCount=leadPool().filter(function(b){return attention(b);}).length;
    var na=document.createElement('button');
    na.textContent='\u26a0 Needs attention \u00b7 '+attnCount;
    na.style.cssText='border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:999px;margin-left:auto;background:'+(window.__needsAttn?'#D92D20':'#F0453A14')+';color:'+(window.__needsAttn?'#fff':'#D92D20');
    na.onclick=function(){window.__needsAttn=!window.__needsAttn;renderLeads(v);};
    strip.appendChild(na);
    /* Distinct wording + a title tooltip on purpose (QA-admin audit, 2026-08-20) \u2014 this sits
       right next to the top bar's own "Export \u25be" menu (CSV/Excel, summary/full, always ALL
       leads) and used to say the same generic "Export CSV," so the two looked like duplicates
       of each other. They're not: this one respects whichever funnel tab / Needs-attention
       filter is active right now, and its columns include each funnel's own answers, next
       action and contact info that the top-bar export doesn't carry. Not touching the
       top-bar menu itself \u2014 it's shared by every page in the app. */
    var ex=document.createElement('button');
    var _arEx=(typeof LANG!=='undefined'&&LANG==='ar');
    ex.textContent=_arEx?'\u2193 \u062a\u0635\u062f\u064a\u0631 \u0647\u0630\u0627 \u0627\u0644\u0639\u0631\u0636 (CSV)':'\u2193 Export this view (CSV)';
    ex.title=_arEx?'\u064a\u0635\u062f\u0651\u0631 \u0628\u0627\u0644\u0636\u0628\u0637 \u0645\u0627 \u0647\u0648 \u0645\u0639\u0631\u0648\u0636 \u0647\u0646\u0627 \u2014 \u0627\u0644\u062a\u0628\u0648\u064a\u0628 \u0627\u0644\u0646\u0634\u0637 \u0648\u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0645\u0639 \u0628\u064a\u0627\u0646\u0627\u062a \u0643\u0644 \u0642\u0645\u0639 \u0648\u0627\u0644\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u062a\u0627\u0644\u064a \u0648\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644. \u0644\u0643\u0644 \u0639\u0645\u064a\u0644 \u0645\u062d\u062a\u0645\u0644 \u0628\u063a\u0636 \u0627\u0644\u0646\u0638\u0631 \u0639\u0646 \u0627\u0644\u0641\u0644\u062a\u0631\u0629\u060c \u0627\u0633\u062a\u062e\u062f\u0645 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0641\u064a \u0627\u0644\u0634\u0631\u064a\u0637 \u0627\u0644\u0639\u0644\u0648\u064a \u0628\u062f\u0644\u0627\u064b \u0645\u0646 \u0630\u0644\u0643.':'Exports exactly what\u2019s shown here \u2014 the active funnel tab and filters, with each funnel\u2019s own detail fields, next action and contact info. For every lead regardless of filter, use the Export \u25be menu in the top bar instead.';
    ex.style.cssText='border:1px solid #E3DCCF;cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:999px;background:#fff;color:#3a3f52';
    ex.onclick=exportCSV;
    strip.appendChild(ex);
    tb.parentNode.insertBefore(strip,tb);
  }

  function exportCSV(){
    try{
      var list=(DB.businesses||[]).filter(matchLead);
      /* 2026-09-02 (attack round 8): in Arabic this file came out with English column titles,
         English funnel names, English stage words and Yes/No — an Arabic button producing a
         file its user could not read. Titles, funnel name, stage word and نعم/لا follow LANG;
         the data cells (names, notes, contacts) are never translated. */
      var ar=(typeof LANG!=='undefined'&&LANG==='ar');
      var head=ar?['الاسم','الاسم (عربي)','المسار','المرحلة','المصدر','المسؤول','عميل؟','الموقع الإلكتروني','تاريخ الإجراء التالي','الإجراء التالي','جهة الاتصال الرئيسية','هاتف جهة الاتصال','بريد جهة الاتصال','تفاصيل المسار','ملاحظات']
                 :['Name','Name (AR)','Funnel','Stage','Source','Owner','Client?','Website','Next action date','Next action','Primary contact','Contact phone','Contact email','Funnel details','Notes'];
      var lines=[head.join(',')];
      function q(s){s=csvGuard(s).replace(/"/g,'""');return '"'+s+'"';}
      list.forEach(function(b){
        var c=(b.contacts&&b.contacts[0])||{};
        var f=fdef(b);
        var det=b.funnelDetails||{};
        var detTxt=Object.keys(det).map(function(k){return k+': '+det[k];}).join(' | ');
        var st=(typeof leadStage==='function'?leadStage(b):b.stage);
        if(ar&&typeof st==='string'){ try{ if(window.__STAGE_AR&&window.__STAGE_AR[st])st=window.__STAGE_AR[st]; }catch(_){} }
        lines.push([q(b.name),q(b.nameAr),q(f?((ar&&f.name_ar)?f.name_ar:f.name_en):''),q(st),q(b.source),q(b.assignedTo||b.owner),q(b.isClient?(ar?'نعم':'Yes'):(ar?'لا':'No')),q(b.website),q(b.nextActionDate),q(b.nextAction||b.nextActionNote),q(c.name),q(c.phone),q(c.email),q(detTxt),q(b.notes)].join(','));
      });
      var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='leads-export-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
    }catch(e){alert('Export failed: '+e.message);}
  }

  var pop=null;
  function hidePop(){if(pop){pop.remove();pop=null;}}
  var _dt=window.drawTable;
  window.drawTable=function(){
    _dt();
    try{
      var list=DB.businesses.filter(matchLead).slice().sort(function(a,b){var va=leadSortVal(a,leadSort.k),vb=leadSortVal(b,leadSort.k);return va<vb?-1*leadSort.dir:va>vb?1*leadSort.dir:0;});
      var rows=document.querySelectorAll('#board table tbody tr');
      rows.forEach(function(tr,i){
        var b=list[i];if(!b)return;
        tr.addEventListener('mouseenter',function(){showPop(b,tr);});
        tr.addEventListener('mouseleave',hidePop);
      });
    }catch(e){}
  };
  function showPop(b,tr){
    hidePop();
    var f=fdef(b),det=b.funnelDetails||{},rowsH='';
    if(f)(f.field_template||[]).forEach(function(fl){
      if(!fl.hover)return;var val=det[fl.key];if(val==null||val==='')return;
      if(typeof val==='boolean')val=val?'Yes':'No';
      rowsH+='<div style="margin:3px 0;font-size:12px;line-height:1.5"><span style="color:#7C8194">'+fl.label_en+':</span> '+String(val).replace(/</g,'&lt;').slice(0,240)+'</div>';
    });
    var extra='';
    var _ar=(typeof LANG!=='undefined'&&LANG==='ar');
    if(!(b.contacts&&b.contacts.length))extra+='<div style="color:#D92D20;font-size:11.5px;margin-top:5px">\u26a0 '+(_ar?'\u0644\u0627 \u062a\u0648\u062c\u062f \u062c\u0647\u0629 \u0627\u062a\u0635\u0627\u0644 \u0645\u0633\u062c\u0651\u0644\u0629':'No contact person recorded')+'</div>';
    if(overdue(b))extra+='<div style="color:#D92D20;font-size:11.5px;margin-top:2px">\u26a0 '+(_ar?'\u0627\u0644\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u062a\u0627\u0644\u064a \u0645\u062a\u0623\u062e\u0631':'Next action overdue')+' ('+b.nextActionDate+')</div>';
    if(!rowsH&&!extra)return;
    pop=document.createElement('div');
    pop.className='v46-leadpop';
    pop.style.cssText='position:fixed;z-index:2147480000;max-width:390px;background:#fff;border:1px solid #E3DCCF;border-radius:12px;box-shadow:0 16px 40px -12px rgba(0,0,0,.25);padding:12px 15px;pointer-events:none';
    pop.innerHTML='<div style="font-size:10.5px;font-weight:800;color:'+(FCOLOR[(f||{}).color]||'#5F5E5A')+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">'+((f&&f.name_en)||'Lead')+' \u00b7 '+String(b.name||'').replace(/</g,'&lt;')+'</div>'+rowsH+extra;
    document.body.appendChild(pop);
    var r=tr.getBoundingClientRect();
    var top=r.bottom+6;
    pop.style.left=Math.min(r.left+40,Math.max(10,window.innerWidth-410))+'px';
    if(top+pop.offsetHeight>window.innerHeight)top=r.top-pop.offsetHeight-6;
    pop.style.top=Math.max(8,top)+'px';
  }

  var _rld=window.renderLeadDetail;
  if(_rld){
    window.renderLeadDetail=function(v,id){
      _rld(v,id);
      try{addDetailCard(v,id);}catch(e){console.warn('v33 detail',e);}
    };
  }
  function addDetailCard(v,id){
    if(document.getElementById('funnelCard'))return;
    var b=getLead(id);if(!b)return;var f=fdef(b);if(!f)return;
    var det=b.funnelDetails||{};
    var card=document.createElement('div');card.className='card';card.id='funnelCard';
    card.style.cssText='border:1.5px solid '+(FCOLOR[f.color]||'#5F5E5A')+'55';
    var inner='<h3 style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="color:'+(FCOLOR[f.color]||'#5F5E5A')+'">'+f.name_en+' details</span><button class="btn ghost sm" onclick="window.__editFunnelDetails(\''+String(b.id).replace(/'/g,"\\'")+'\')">Edit</button></h3>';
    (f.field_template||[]).forEach(function(fl){
      var val=det[fl.key];if(val==null||val==='')val='\u2014';
      if(typeof val==='boolean')val=val?'Yes':'No';
      inner+='<div class="fact"><span class="k">'+fl.label_en+'</span><span class="v" style="max-width:58%;text-align:right;white-space:normal">'+String(val).replace(/</g,'&lt;')+'</span></div>';
    });
    card.innerHTML=inner;
    var grid=v.querySelector('.detail-grid');
    var col=grid?grid.querySelector('div'):null;
    if(col)col.insertBefore(card,col.firstChild);
    else if(grid)grid.appendChild(card);
    else v.appendChild(card);
  }

  window.__editFunnelDetails=function(id){
    var b=getLead(id);if(!b)return;var f=fdef(b);if(!f)return;
    var det=b.funnelDetails||{};
    var old=document.getElementById('fdModal');if(old)old.remove();
    var ov=document.createElement('div');ov.id='fdModal';
    ov.style.cssText='position:fixed;inset:0;z-index:2147481000;background:rgba(20,22,35,.55);display:flex;align-items:center;justify-content:center;padding:20px';
    var inner='<div style="background:#fff;border-radius:16px;max-width:480px;width:100%;max-height:86vh;overflow:auto;padding:22px 24px;font-family:inherit">'+
      '<div style="font-size:16px;font-weight:800;margin-bottom:14px">'+f.name_en+' details \u2014 '+String(b.name||'').replace(/</g,'&lt;')+'</div>';
    (f.field_template||[]).forEach(function(fl){
      var val=det[fl.key];if(val==null)val='';
      var fid='fd_'+fl.key;
      inner+='<label style="display:block;font-size:12px;font-weight:700;color:#55596A;margin:10px 0 4px">'+fl.label_en+(fl.label_ar?' \u00b7 '+fl.label_ar:'')+'</label>';
      var t=String(fl.type||'text');
      if(t==='textarea')inner+='<textarea id="'+fid+'" style="width:100%;box-sizing:border-box;min-height:74px;padding:9px 11px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px">'+String(val).replace(/</g,'&lt;')+'</textarea>';
      else if(t==='boolean')inner+='<select id="'+fid+'" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px"><option value=""'+(val===''?' selected':'')+'>\u2014</option><option value="true"'+(val===true?' selected':'')+'>Yes</option><option value="false"'+(val===false?' selected':'')+'>No</option></select>';
      else if(t.indexOf('select:')===0){
        var opts=t.slice(7).split(',');
        inner+='<select id="'+fid+'" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px"><option value="">\u2014</option>'+opts.map(function(o){return '<option value="'+o+'"'+(val===o?' selected':'')+'>'+o.replace(/_/g,' ')+'</option>';}).join('')+'</select>';
      }
      else inner+='<input id="'+fid+'" type="'+(t==='date'?'date':t==='number'?'number':'text')+'" value="'+String(val).replace(/"/g,'&quot;')+'" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px">';
    });
    inner+='<div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">'+
      '<button id="fd_cancel" style="border:1px solid #E3DCCF;background:#fff;border-radius:10px;padding:10px 18px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">Cancel</button>'+
      '<button id="fd_save" style="border:0;background:#FF6B00;color:#fff;border-radius:10px;padding:10px 20px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">Save</button></div></div>';
    ov.innerHTML=inner;
    document.body.appendChild(ov);
    document.getElementById('fd_cancel').onclick=function(){ov.remove();};
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
    document.getElementById('fd_save').onclick=function(){
      var out={};
      (f.field_template||[]).forEach(function(fl){
        var e=document.getElementById('fd_'+fl.key);if(!e)return;
        var v2=e.value;
        if(v2===''||v2==null)return;
        var t=String(fl.type||'text');
        if(t==='boolean')out[fl.key]=(v2==='true');
        else if(t==='number')out[fl.key]=Number(v2);
        else out[fl.key]=v2;
      });
      b.funnelDetails=out;
      try{save();}catch(_){}
      ov.remove();
      try{render();}catch(_){}
    };
  };
  console.info('%c[v33 funnel UI] loaded','color:#FF6B00;font-weight:700');
})();
