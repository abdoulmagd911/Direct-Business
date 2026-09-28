/* 120 — Income by service: the three lists behind it, on Finance → Rules (D24, owner, 28 Sep, via the oversight).
   Finance → Overview → "Income by service" (js/25) puts each invoice LINE under ONE main service and adds the lines up. Which
   service a line goes to is decided here, by people, never in code:
     1. Main services — the list itself (Flights, Hotels, Transportation, Visas, Study abroad, Packages, Journey Solutions,
        Other income …), in the order they are shown. A service marked "not income" is never counted (Direct Wallet, Techtic).
     2. Payments products → service — the default for every line of a product ("Direct Flights" → Flights).
     3. Items → service — an item that belongs elsewhere than its product ("Chauffeur Service" → Transportation). The item is
        the first part of a line's name ("Chauffeur Service - 3rd Party Fee"); the item-name list above (pass-through / fee)
        keys on the last part, which many items share, so the two lists are kept apart.
   Anyone with Full control on Finance changes them (the database says the same); everyone who sees Finance reads them. A
   removal asks first in the app's own box, naming the entry (D19), and is final — add it again if needed; every change is
   in the change log. A change updates Finance in place (js/16 finRefreshMoney — punch list A), never a full reload. */
(function(){try{
  function fl(en,ar){ try{ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }catch(_){ return en; } }
  function e(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function canEdit(){ try{ if(window.__isShareView) return false; return typeof window.mayEditPage==='function'?!!window.mayEditPage('finance'):(typeof window.finCanWrite==='function'&&!!window.finCanWrite()); }catch(_){ return false; } }
  function say(m){ try{ (window.v63Notice||window.alert)(m); }catch(_){} }
  function refused(r){ if(r&&r.error) return String(r.error.message||r.error); if(r&&Array.isArray(r.data)&&!r.data.length) return fl('Not saved — changing this list needs Full control on Finance.','لم يُحفظ — تغيير هذه القائمة يحتاج «تحكم كامل» على المالية.'); return null; }
  function day(t){ try{ return typeof dayRiyadh==='function'?dayRiyadh(t):String(t||'').slice(0,10); }catch(_){ return ''; } }

  var SV={svc:null,prod:null,item:null,err:null,loading:false};
  function load(){
    if(SV.loading||window.__roleKnown!==true) return; var c=client(); if(!c) return; SV.loading=true;
    var left=3, err=null, done=function(){ if(--left) return; SV.loading=false; SV.err=err; redraw(); };
    var get=function(t,ord,key){ c.from(t).select('*').is('removed_at',null).order(ord,{ascending:true}).then(function(r){ if(r&&r.error) err=String(r.error.message||r.error); else SV[key]=(r&&r.data)||[]; done(); },function(x){ err=String((x&&x.message)||x); done(); }); };
    get('money_services','sort_order','svc'); get('money_product_services','product','prod'); get('money_item_services','item','item');
  }
  function redraw(){ try{ if(typeof current!=='undefined'&&current==='finance'&&typeof render==='function') render(); }catch(_){} }
  function changed(){ SV.svc=SV.prod=SV.item=null; load(); try{ if(typeof window.finRefreshMoney==='function') window.finRefreshMoney(); }catch(_){} }
  function svcName(id){ var s=(SV.svc||[]).find(function(x){ return x.id===id; }); return s?s.name:fl('(removed service)','(خدمة أُزيلت)'); }
  function svcOptions(sel){ return (SV.svc||[]).map(function(s){ return '<option value="'+e(s.id)+'"'+(s.id===sel?' selected':'')+'>'+e(s.name)+(s.counts_as_income===false?' — '+fl('not income','ليس دخلًا'):'')+'</option>'; }).join(''); }
  var inp='width:100%;padding:8px 10px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit';

  /* ---- adding ---- */
  window.v120AddService=function(){
    if(!canEdit()) return;
    openModal(fl('Add a main service','إضافة خدمة رئيسية'),
      '<label style="display:block;font-size:12px;color:var(--muted)">'+fl('Name','الاسم')+'</label><input id="v120_name" style="'+inp+'">'+
      '<label style="display:block;font-size:12px;color:var(--muted);margin-top:10px">'+fl('Order on screen (small first)','الترتيب على الشاشة (الأصغر أولًا)')+'</label><input id="v120_sort" type="number" value="100" style="'+inp+'">'+
      '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px"><input type="checkbox" id="v120_never"> '+fl('Not income — its lines are never counted (e.g. wallet top-ups)','ليست دخلًا — لا تُحتسب أسطرها أبدًا (مثل شحن المحفظة)')+'</label>',
      function(){
        var nm=String((document.getElementById('v120_name')||{}).value||'').trim(), so=parseInt((document.getElementById('v120_sort')||{}).value,10), nv=!!(document.getElementById('v120_never')||{}).checked;
        if(!nm){ say(fl('Type the service name first.','اكتب اسم الخدمة أولًا.')); return false; }
        client().from('money_services').insert({name:nm,sort_order:isNaN(so)?100:so,counts_as_income:!nv}).select('id').then(function(r){
          var m=refused(r); if(m){ say(/one_live/.test(m)?fl('That service is already on the list.','هذه الخدمة موجودة في القائمة.'):m); return; }
          try{ closeModal(); }catch(_){} changed(); });
        return false;
      });
  };
  function addMapped(table,key,title,label,hint){
    if(!canEdit()) return;
    if(!(SV.svc||[]).length){ say(fl('Add the main services first.','أضف الخدمات الرئيسية أولًا.')); return; }
    openModal(title,
      '<label style="display:block;font-size:12px;color:var(--muted)">'+label+'</label><input id="v120_key" style="'+inp+'" placeholder="'+e(hint)+'">'+
      '<label style="display:block;font-size:12px;color:var(--muted);margin-top:10px">'+fl('Goes to service','يذهب إلى الخدمة')+'</label><select id="v120_svc" style="'+inp+'">'+svcOptions(null)+'</select>',
      function(){
        var k=String((document.getElementById('v120_key')||{}).value||'').trim(), sid=(document.getElementById('v120_svc')||{}).value;
        if(!k){ say(fl('Type it first.','اكتبه أولًا.')); return false; }
        var row={service_id:sid}; row[key]=k;
        client().from(table).insert(row).select('id').then(function(r){
          var m=refused(r); if(m){ say(/one_live/.test(m)?fl('That one is already on the list — change its service there.','هذا موجود في القائمة — غيّر خدمته هناك.'):m); return; }
          try{ closeModal(); }catch(_){} changed(); });
        return false;
      });
  }
  window.v120AddProduct=function(){ addMapped('money_product_services','product',fl('Payments product → service','منتج «المدفوعات» ← خدمة'),fl('Product, as Payments writes it','المنتج كما يكتبه نظام المدفوعات'),'Direct Flights'); };
  window.v120AddItem=function(){ addMapped('money_item_services','item',fl('Item → service','بند ← خدمة'),fl('Item — the first part of the line name, before the dash','البند — الجزء الأول من اسم السطر، قبل الشَّرطة'),'Chauffeur Service'); };

  /* ---- changing a mapping's service, removing ---- */
  window.v120SetService=function(table,id,sid){
    if(!canEdit()) return;
    client().from(table).update({service_id:sid}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ say(m); } changed(); });
  };
  window.v120Remove=function(table,id,label){
    if(!canEdit()) return;
    var go=function(){ client().from(table).update({removed_at:new Date().toISOString()}).eq('id',id).select('id').then(function(r){ var m=refused(r); if(m){ say(m); return; } changed(); }); };
    var q=fl('Remove "','إزالة «')+label+fl('" from the list? Its lines go back to their default. It can be added again.','» من القائمة؟ تعود أسطره إلى الافتراضي. ويمكن إضافته مجددًا.');
    if(typeof window.pfConfirm==='function') window.pfConfirm(q,go,{danger:true});
  };
  window.v120Log=function(){ if(typeof window.openChangeLog==='function') window.openChangeLog([{table:'money_services',all:true},{table:'money_product_services',all:true},{table:'money_item_services',all:true}],fl('Income by service — lists','الدخل حسب الخدمة — القوائم')); };

  /* ---- the card ---- */
  var th=function(t){ return '<th style="padding:7px 9px;text-align:start;white-space:nowrap">'+t+'</th>'; };
  var who=function(x){ return '<td style="padding:7px 9px;color:var(--muted);font-size:11.5px;white-space:nowrap">'+e(x.created_by_name||'—')+' · '+e(day(x.created_at))+'</td>'; };
  function table(title,rows,cols,addFn,addLbl,w){
    var h='<div style="margin-top:14px"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1">'+title+'</b>'+(w?'<button class="btn sm pri" onclick="'+addFn+'()">+ '+addLbl+'</button>':'')+'</div>';
    if(!rows.length) return h+'<div class="empty" style="padding:6px 0;font-size:12.5px">'+fl('Nothing on this list yet.','لا شيء في هذه القائمة بعد.')+'</div></div>';
    return h+'<div style="overflow-x:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#303848;color:#fff">'+cols+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div></div>';
  }
  function card(){
    if((SV.svc==null||SV.prod==null||SV.item==null)&&!SV.err){ load(); return '<div class="card v120-svc" style="padding:14px 18px;margin-bottom:16px;color:var(--muted)">'+fl('Loading the service lists…','جارٍ تحميل قوائم الخدمات…')+'</div>'; }
    var w=canEdit();
    var h='<div class="card v120-svc" data-v120="1" style="padding:18px;margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0;flex:1">'+fl('Income by service — which line goes where','الدخل حسب الخدمة — أين يذهب كل سطر')+'</h3>'+
      '<button class="btn sm ghost" onclick="v120Log()">'+fl('Change log','سجل التغييرات')+'</button></div>'+
      '<div class="fin-note" style="margin:4px 0 0">'+fl('Each invoice line goes to one main service: the item\'s own service if it is on the Items list, else its Payments product\'s. Lines of a "not income" service are never counted. Changing these lists never changes an invoice — only how Overview → Income by service adds them up.',
        'كل سطر في الفاتورة يذهب إلى خدمة رئيسية واحدة: خدمة البند إن كان في قائمة البنود، وإلا خدمة منتجه في «المدفوعات». أسطر الخدمة «ليست دخلًا» لا تُحتسب أبدًا. تغيير هذه القوائم لا يغيّر أي فاتورة — فقط طريقة الجمع في «الدخل حسب الخدمة».')+'</div>';
    if(SV.err) return h+'<div style="color:#B42318;font-size:12.5px;margin-top:8px">'+fl('The lists could not be read: ','تعذّرت قراءة القوائم: ')+e(SV.err)+' <button class="btn sm ghost" onclick="v120Retry()">'+fl('Try again','حاول مجددًا')+'</button></div></div>';
    h+=table(fl('Main services','الخدمات الرئيسية'),SV.svc.map(function(x){
      return '<tr data-v120-svc="'+e(x.name)+'" style="border-top:1px solid var(--line,#EEF0F3)"><td style="padding:7px 9px;font-weight:700">'+e(x.name)+'</td><td style="padding:7px 9px;color:var(--muted)">'+e(x.sort_order)+'</td>'+
        '<td style="padding:7px 9px">'+(x.counts_as_income===false?'<span style="color:#B42318">'+fl('Not income','ليست دخلًا')+'</span>':fl('Income','دخل'))+'</td>'+who(x)+
        '<td style="padding:7px 9px">'+(w?'<button class="btn ghost sm" onclick="v120Remove(\'money_services\',\''+e(x.id)+'\',\''+e(x.name).replace(/'/g,'&#39;')+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</td></tr>'; }),
      th(fl('Service','الخدمة'))+th(fl('Order','الترتيب'))+th(fl('Counts as','يُحتسب'))+th(fl('Added','أُضيفت'))+th(''),'v120AddService',fl('Add a service','إضافة خدمة'),w);
    var mapRows=function(list,table,key){ return list.map(function(x){
      return '<tr data-v120-map="'+e(x[key])+'" style="border-top:1px solid var(--line,#EEF0F3)"><td style="padding:7px 9px;font-weight:700">'+e(x[key])+'</td>'+
        '<td style="padding:7px 9px">'+(w?'<select onchange="v120SetService(\''+table+'\',\''+e(x.id)+'\',this.value)" style="padding:4px 6px;border:1px solid var(--line,#e6e8ec);border-radius:6px;font:inherit;font-size:12.5px">'+svcOptions(x.service_id)+'</select>':e(svcName(x.service_id)))+'</td>'+who(x)+
        '<td style="padding:7px 9px">'+(w?'<button class="btn ghost sm" onclick="v120Remove(\''+table+'\',\''+e(x.id)+'\',\''+e(x[key]).replace(/'/g,'&#39;')+'\')">'+fl('Remove','إزالة')+'</button>':'')+'</td></tr>'; }); };
    h+=table(fl('Payments products → service (the default)','منتجات «المدفوعات» ← خدمة (الافتراضي)'),mapRows(SV.prod,'money_product_services','product'),
      th(fl('Product','المنتج'))+th(fl('Service','الخدمة'))+th(fl('Added','أُضيف'))+th(''),'v120AddProduct',fl('Add a product','إضافة منتج'),w);
    h+=table(fl('Items → service (over the product)','البنود ← خدمة (مقدَّمة على المنتج)'),mapRows(SV.item,'money_item_services','item'),
      th(fl('Item','البند'))+th(fl('Service','الخدمة'))+th(fl('Added','أُضيف'))+th(''),'v120AddItem',fl('Add an item','إضافة بند'),w);
    return h+'</div>';
  }
  window.v120Retry=function(){ SV.err=null; SV.svc=SV.prod=SV.item=null; load(); };
  try{ var c0=client(); if(c0&&c0.auth&&c0.auth.onAuthStateChange) c0.auth.onAuthStateChange(function(ev){ if(ev==='SIGNED_IN'){ SV.svc=SV.prod=SV.item=null; SV.err=null; } }); }catch(_){}

  function place(){
    try{
      if(typeof current==='undefined'||current!=='finance'||!window.FIN||FIN.tab!=='rules') return;
      var view=document.getElementById('view'); if(!view||view.querySelector('.v120-svc')) return;
      var after=view.querySelector('.v119-items')||view.querySelector('.v117-rules'); if(!after) return;
      var b=document.createElement('div'); b.innerHTML=card(); after.parentNode.insertBefore(b.firstChild,after.nextSibling);
    }catch(err){ if(window.console) console.warn('[120] place',err); }
  }
  (function hook(n){
    if(typeof window.renderFinance==='function'&&!window.renderFinance.__v120){
      var _rf=window.renderFinance; var w=function(){ var out=_rf.apply(this,arguments); try{ place(); setTimeout(place,0); setTimeout(place,60); }catch(_){} return out; };
      w.__v120=1; window.renderFinance=w; return;
    }
    if((n||0)<120) setTimeout(function(){ hook((n||0)+1); },250);
  })(0);
}catch(e){ if(window.console) console.warn('[120] income services',e); }})();
