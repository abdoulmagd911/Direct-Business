/* v31 — Leads pipeline conversion strip. A small stat row at the top of the Leads LIST:
   new this month, in pipeline, conversion rate, avg time to win. Aggregate, additive, reversible. */
(function(){try{
  var fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  function created(b){return b.created_at||b.createdAt||b.created||'';}
  function stripHtml(){
    var all=(typeof DB!=='undefined'&&DB.businesses)||[]; if(!all.length)return '';
    var stg=function(b){return (typeof leadStage==='function')?leadStage(b):(b.stage||'');};
    var month=new Date().toISOString().slice(0,7);
    /* count the same population the chips below count: pipeline leads, not converted clients */
    var newThis=all.filter(function(b){return !b.isClient&&String(created(b)).slice(0,7)===month;}).length;
    var won=all.filter(function(b){return stg(b)==='Won'||b.isClient;});
    var lost=all.filter(function(b){return stg(b)==='Lost';}).length;
    var conv=all.length>0?Math.round(won.length/all.length*100):0; // won out of ALL leads, the standard rate
    var active=all.filter(function(b){var s=stg(b);return s!=='Won'&&s!=='Lost'&&!b.isClient;}).length;
    var wt=won.map(function(b){var c=created(b),cv=b.convertedDate||b.convertDate;if(!c||!cv)return null;var d=(new Date(cv).getTime()-new Date(c).getTime())/864e5;return (isFinite(d)&&d>=0)?d:null;}).filter(function(x){return x!=null;});
    var avg=wt.length?Math.round(wt.reduce(function(a,x){return a+x;},0)/wt.length):null;
    var tile=function(v,l,c){return '<div style="flex:1;min-width:118px;border-inline-start:3px solid #FF6B00;padding-inline-start:12px"><div style="font-size:20px;font-weight:800;color:'+(c||'#1C1E2B')+'">'+v+'</div><div style="font-size:11px;color:var(--muted)">'+l+'</div></div>';};
    return '<div class="card v31-conv" style="display:flex;gap:18px;flex-wrap:wrap;padding:14px 18px;margin-bottom:14px">'+
      tile(newThis,fl('New this month','جديد هذا الشهر'),'#175CD3')+
      tile(active,fl('In pipeline','قيد المتابعة'),'#7A5AF8')+
      tile(conv+'%',fl('Conversion rate','نسبة التحويل'),conv>=30?'#16B364':'#F79009')+
      tile(avg==null?'—':(avg+' '+fl('days','يوم')),fl('Avg time to win','متوسط وقت الكسب'),'#0F6E56')+
    '</div>';
  }
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='leads')return;
      if(typeof openLead!=='undefined'&&openLead)return; // list view only, not the lead detail
      var view=document.getElementById('view'); if(!view||view.querySelector('.v31-conv'))return;
      var html=stripHtml(); if(!html)return;
      var wrap=document.createElement('div'); wrap.innerHTML=html;
      if(wrap.firstChild) view.insertBefore(wrap.firstChild,view.firstChild);
    }catch(e){ if(window.console)console.warn('[v31] conv strip',e); }
  }
  window.v31Conv=inject;
  if(typeof render==='function'){ var _r31=render; window.render=function(){ var o=_r31.apply(this,arguments); inject(); return o; }; }
  inject();
}catch(e){ if(window.console)console.warn('[v31] init',e); }})();
