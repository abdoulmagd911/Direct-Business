/* v33 — Leads · service-fit map (the all-in-one angle).
   Captures, per Direct service, whether the lead buys it elsewhere / already with Direct /
   not a fit — so "buys elsewhere" becomes the consolidation pitch. Stored on the record as
   b.serviceFit and persisted via the businesses raw JSON (rowToApp copies raw fields back). */
(function(){try{
  if(!window.renderLeadDetail) return;
  var CORE=[['flights','✈','Flights','الطيران'],['hotels','🏨','Hotels','الفنادق'],['visa','🛂','Visa / e-Visa','التأشيرات'],['umrah','🕋','Umrah / Hajj','العمرة والحج'],['transfers','🚐','Transfers','التنقلات'],['carrental','🔑','Car rental','تأجير السيارات'],['insurance','🛡','Insurance','التأمين'],['tours','🗺','Activities / tours','الأنشطة والجولات'],['mice','🎤','MICE / events','الفعاليات'],['packages','🧳','Packages','الباقات'],['study','🎓','Study abroad','الدراسة بالخارج']];
  var GROWTH=[['idl','🪪','Intl driving licence','رخصة القيادة الدولية'],['chauffeur','🚘','Chauffeur','سائق خاص'],['esim','📶','eSIM / roaming','شريحة eSIM'],['training','📚','Training','التدريب'],['vip','⭐','VIP meet & assist','استقبال كبار الشخصيات'],['translation','📄','Translation','ترجمة الوثائق'],['shipping','📦','Shipping','الشحن البريدي'],['halls','🏛','Event halls','قاعات الفعاليات'],['support','🛎','Support','الدعم']];
  var ALL=CORE.concat(GROWTH);
  var STATES={unknown:{l:['—','—'],c:'#9AA1B6',bg:'#EEF0F5'},elsewhere:{l:['Buys elsewhere','من غيرنا'],c:'#B54708',bg:'#FEF3E2'},direct:{l:['With Direct','مع دايركت'],c:'#0F6E56',bg:'#E7F8EF'},na:{l:['Not a fit','غير مطلوبة'],c:'#98A2B3',bg:'#F2F4F7'}};
  var ORDER=['unknown','elsewhere','direct','na'];
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  window.v33CycleFit=function(id,key){try{var b=getLead(id);if(!b)return;b.serviceFit=b.serviceFit||{};var cur=b.serviceFit[key]||'unknown';b.serviceFit[key]=ORDER[(ORDER.indexOf(cur)+1)%ORDER.length];if(typeof silentSave==='function')silentSave(save);else save();window.v33Redraw(id);}catch(e){}};
  function rowHtml(id,fit,s){var st=STATES[(fit&&fit[s[0]])||'unknown'];
    return '<button type="button" onclick="v33CycleFit(\''+id+'\',\''+s[0]+'\')" style="display:flex;align-items:center;gap:8px;width:100%;text-align:start;border:1px solid var(--line-2,#e6e8ec);background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer;font:inherit">'+
      '<span style="font-size:14px;width:18px;text-align:center">'+s[1]+'</span>'+
      '<span style="flex:1;font-size:12.5px;font-weight:600">'+fl(s[2],s[3])+'</span>'+
      '<span style="font-size:10.5px;font-weight:700;color:'+st.c+';background:'+st.bg+';padding:2px 8px;border-radius:999px;white-space:nowrap">'+fl(st.l[0],st.l[1])+'</span></button>';
  }
  function cardHtml(id){
    var b=(typeof getLead==='function')?getLead(id):null; if(!b) return '';
    var fit=b.serviceFit||{};
    var opp=ALL.filter(function(s){return fit[s[0]]==='elsewhere';}).length;
    var withD=ALL.filter(function(s){return fit[s[0]]==='direct';}).length;
    var grp=function(title,arr){return '<div style="font-size:10.5px;font-family:ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px">'+title+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+arr.map(function(s){return rowHtml(id,fit,s);}).join('')+'</div>';};
    // one-line summary; the 14 services live inside a collapsed <details> and expand on tap
    var bits=[];
    if(withD)bits.push('<span style="color:#0F6E56;font-weight:700">'+withD+' '+fl('with Direct','مع دايركت')+'</span>');
    if(opp)bits.push('<span style="color:#B54708;font-weight:700">🎯 '+opp+' '+fl('could win','فرصة كسب')+'</span>');
    var summary=bits.length?bits.join('<span style="color:var(--muted)"> · </span>'):'<span style="color:var(--muted);font-weight:600">'+fl('Tap to map their services','اضغط لتحديد خدماتهم')+'</span>';
    return '<details class="card v33-fit">'+
      '<summary style="list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span style="font-weight:800;font-size:14px">'+fl('Service fit','ملاءمة الخدمات')+'</span>'+
        '<span style="flex:1"></span>'+
        '<span style="font-size:12.5px">'+summary+'</span>'+
        '<span class="v33-caret" style="font-size:15px;color:var(--muted);transition:transform .15s">›</span>'+
      '</summary>'+
      '<div style="margin-top:8px">'+
        grp(fl('Core — Direct bills today','أساسية — تفوترها دايركت اليوم'),CORE)+
        grp(fl('Growth — opportunity','نمو — فرصة'),GROWTH)+
      '</div>'+
    '</details>';
  }
  window.v33Redraw=function(id){var c=document.querySelector('#view .v33-fit');if(c){var wasOpen=c.open;c.outerHTML=cardHtml(id);var c2=document.querySelector('#view .v33-fit');if(c2&&wasOpen)c2.open=true;}};
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v33-fit'))return;
      if(!getLead(id))return;
      var grid=view.querySelector('.detail-grid'); if(!grid)return;
      var col=grid.children[0]||grid;
      var wrap=document.createElement('div'); wrap.innerHTML=cardHtml(id);
      if(wrap.firstChild){ var after=col.children[1]||null; col.insertBefore(wrap.firstChild, after); } // 2nd card — prominent, not buried
    }catch(e){if(window.console)console.warn('[v33] fit',e);}},50);
  };
  console.info('%c[v33] leads service-fit map loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v33] init',e);}})();
