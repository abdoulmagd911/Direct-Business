/* v62 — a CLIENT's card should feel like Clients, not Leads (owner note 2026-08-12).
   The record card is one shared component (so history + reports keep working across the
   lead→client life). What changes is the furniture: when the open record is a client,
   the page title says Clients, the pipeline stage chips hide, and Back goes to Clients. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  var _r=window.render;
  if(typeof _r!=='function'||window.__v62)return; window.__v62=true;
  window.render=function(){var out=_r.apply(this,arguments);try{
    if(current==='leads'&&typeof openLead!=='undefined'&&openLead){
      var b=(typeof getLead==='function')?getLead(openLead):null;
      if(b&&b.isClient){
        var t=document.getElementById('vTitle'); if(t&&/Leads|العملاء المحتملون/.test(t.textContent))t.textContent=fl('Clients','العملاء');
        /* the sidebar highlight should sit on Clients too, not Leads */
        try{ var nav=document.getElementById('nav'); if(nav){ nav.querySelectorAll('button').forEach(function(nb){
          var lbl=(nb.textContent||'').trim();
          if(/^Leads$|^العملاء المحتملون$/.test(lbl))nb.className='';
          if(/^Clients$|^العملاء$/.test(lbl))nb.className='active';
        }); } }catch(_){ }
        var view=document.getElementById('view');
        if(view){
          var chips=view.querySelector('.v26_3-chips'); if(chips)chips.style.display='none';
          var head=view.querySelector('.v26_3-section-head'); if(head){var h1=head.querySelector('h1,h2,.v26_3-title'); if(h1&&/Leads|العملاء المحتملون/.test(h1.textContent))h1.textContent=fl('Clients','العملاء');}
          view.querySelectorAll('button').forEach(function(btn){
            var tx=(btn.textContent||'').trim();
            if(tx==='← Back to pipeline'||tx==='← العودة إلى القائمة'){
              btn.textContent=fl('← Back to clients','← العودة إلى العملاء');
              btn.onclick=function(){openLead=null;current='clients';render();};
            }
          });
        }
      }
    }
  }catch(_){ }
  return out;};
  console.info('%c[v62] client-card context loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v62] init',e);}})();
