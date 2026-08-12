/* Clients aggregate dashboard on the main Clients page (mirrors the Leads dashboard) */
(function(){try{
  function money(n){try{return (typeof moneyShort==='function')?moneyShort(n):(n||0).toLocaleString();}catch(_){return n;}}
  function clientsDash(){try{
    if(typeof current==='undefined'||current!=='clients')return;
    if(typeof openLead!=='undefined'&&openLead)return;
    if(document.getElementById('cl_dash'))return;
    if(typeof DB==='undefined'||!DB.businesses)return;
    var cls=DB.businesses.filter(function(b){return b.isClient;});
    if(!cls.length)return;
    var key=cls.filter(function(b){return b.tier==='Key';}).length;
    var won=cls.reduce(function(s,b){return s+(b.totalSAR||b.dealValue||0);},0);
    var today=new Date().toISOString().slice(0,10);
    var overdue=cls.filter(function(b){return b.nextReview&&b.nextReview<=today;}).length;
    var byArea={}; cls.forEach(function(b){var a=b.area||'—';byArea[a]=(byArea[a]||0)+1;});
    var areas=Object.keys(byArea).sort(function(a,b){return byArea[b]-byArea[a];}).slice(0,6);
    var chips='<div class="chip"><div class="v">'+cls.length+'</div><div class="l">Total clients</div></div>'+
      '<div class="chip"><div class="v">'+key+'</div><div class="l">Key accounts</div></div>'+
      '<div class="chip"><div class="v">'+money(won)+'</div><div class="l">Total won (SAR)</div></div>'+
      '<div class="chip"><div class="v" style="color:'+(overdue?'#D92D20':'inherit')+'">'+overdue+'</div><div class="l">Reviews overdue</div></div>';
    var areaBars=areas.map(function(a){return '<span class="tag" style="background:#EEF0F5;color:#5b6178;margin:0 6px 6px 0">'+a+': <b>'+byArea[a]+'</b></span>';}).join('');
    var d=document.createElement('div'); d.id='cl_dash'; d.style.cssText='margin:0 0 16px';
    d.innerHTML='<div class="chips" style="margin-bottom:10px">'+chips+'</div>'+(areaBars?'<div style="display:flex;flex-wrap:wrap;align-items:center">'+areaBars+'</div>':'');
    var host=document.querySelector('.toolbar')||document.querySelector('table');
    if(host&&host.parentNode){host.parentNode.insertBefore(d,host);}
  }catch(_){}}
  function run(){clientsDash();}
  var iv=setInterval(function(){if(typeof render==='function'){clearInterval(iv);try{var _r=render;render=function(){var o=_r.apply(this,arguments);try{run();}catch(_){}setTimeout(run,40);return o;};}catch(_){}run();}},200);
  setTimeout(run,1500);setTimeout(run,3000);
}catch(e){console.warn('cldash',e);}})();
