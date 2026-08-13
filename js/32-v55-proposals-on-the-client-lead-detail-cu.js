/* v55 — Proposals on the client/lead detail (Customer-360): a client's proposals from the
   Offer Builder (offers whose linkedLeadId is this record). Self-contained inject layer. */
(function(){try{
  function A(){return (typeof LANG!=='undefined'&&LANG==='ar');}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function inject(){
    try{
      if(typeof current==='undefined'||current!=='leads')return;
      if(typeof openLead==='undefined'||!openLead)return;
      var view=document.getElementById('view'); if(!view)return;
      if(view.querySelector('.v55-proposals'))return;
      var offers=((typeof DB!=='undefined'&&DB.offers)||[]).filter(function(o){return o.linkedLeadId===openLead;});
      var ar=A();
      var rows=offers.map(function(o){
        var t=ar?((window.PROPOSAL_TYPES_AR&&PROPOSAL_TYPES_AR[o.proposalType])||o.proposalType||'—'):(o.proposalType||'—');
        return '<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #f0efe9;font-size:12.5px">'+
          '<span class="tag" style="background:#EEF0F5;color:#4B5563">'+esc(t)+'</span>'+
          '<a onclick="openOffer=\''+o.id+'\';current=\'offers\';render()" style="cursor:pointer;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(o.subject||o.ref||'')+'</a>'+
          '<span style="color:var(--muted);white-space:nowrap">'+esc(o.value||o.total||'')+' SAR</span>'+
          (o.docUrl?' <a href="'+esc(o.docUrl)+'" target="_blank" rel="noopener" title="'+(ar?'المستند':'Document')+'">📎</a>':'')+
          (o.promotedToProject?' <span title="'+(ar?'مشروع':'Project')+'">🏗</span>':'')+
        '</div>';
      }).join('')||'<div style="color:var(--muted);font-size:12px;padding:6px 0">'+(ar?'لا توجد عروض بعد':'No proposals yet')+'</div>';
      var card=document.createElement('div'); card.className='card v55-proposals'; card.style.cssText='padding:14px 16px;margin-top:12px';
      card.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:14px">'+(ar?'العروض والمقترحات':'Proposals')+' ('+offers.length+')</b><span style="flex:1"></span><button class="btn ghost sm" onclick="v55NewProposal(\''+openLead+'\')">＋ '+(ar?'عرض جديد':'New proposal')+'</button></div>'+rows;
      view.appendChild(card);
    }catch(_){}
  }
  window.v55NewProposal=function(clientId){try{
    if(typeof newOffer!=='function')return;
    newOffer(); var arr=(DB.offers||[]); var o=arr[arr.length-1];
    if(o){ o.linkedLeadId=clientId; var b=(DB.businesses||[]).find(function(x){return x.id===clientId;}); if(b)o.client=b.name; }
    if(typeof current!=='undefined'){ current='offers'; } if(o){ openOffer=o.id; }
    if(typeof save==='function')save(); if(typeof render==='function')render();
  }catch(_){}};
  try{ if(typeof render==='function'){ var _r=render; render=function(){ var o=_r.apply(this,arguments); try{[80,400].forEach(function(d){setTimeout(inject,d);});}catch(_){}; return o; }; } }catch(_){}
  [300,900].forEach(function(d){setTimeout(inject,d);});
  console.info('%c[v55] client proposals loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v55] init',e);}})();
