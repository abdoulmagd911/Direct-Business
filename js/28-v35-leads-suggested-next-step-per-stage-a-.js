/* v35 — Leads · suggested next step per stage (a nudge from the travel lifecycle, not a task). */
(function(){try{
  if(!window.renderLeadDetail) return;
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  var STEPS={
    'New':['Assign an owner and make first contact.','عيّن مالكاً وابدأ أول تواصل.'],
    'Prospect':['Assign an owner and make first contact.','عيّن مالكاً وابدأ أول تواصل.'],
    'Contacted':['Run a discovery call, and start the service-fit map below.','أجرِ مكالمة استكشاف، وابدأ خريطة ملاءمة الخدمات بالأسفل.'],
    'Qualified':['Prepare and send the service-fee proposal.','جهّز وأرسل عرض رسوم الخدمة.'],
    'Proposal':['Follow up — negotiate terms and the Direct credit line.','تابع — تفاوض على الشروط وحدّ الائتمان لدى دايركت.'],
    'Negotiation':['Close the terms and confirm the credit line.','أغلق الشروط وأكّد حدّ الائتمان.'],
    'Won':['Complete the Direct handover: client ID, agreement, point of contact.','أكمل التسليم لدايركت: المعرّف، الاتفاقية، جهة الاتصال.'],
    'Lost':['Log the lost reason and set a re-approach date.','سجّل سبب الخسارة وحدّد تاريخ إعادة التواصل.'],
    'On hold':['Set a wake-up date so it does not go cold.','حدّد تاريخ متابعة حتى لا يبرد.']
  };
  var _rld=window.renderLeadDetail;
  window.renderLeadDetail=function(v,id){
    _rld.apply(this,arguments);
    setTimeout(function(){try{
      if(typeof current!=='undefined'&&current!=='leads')return;
      var b=(typeof getLead==='function')?getLead(id):null; if(!b||b.isClient)return; // active leads only
      var view=document.getElementById('view'); if(!view||view.querySelector('.v35-next'))return;
      var grid=view.querySelector('.detail-grid'); if(!grid||!grid.parentNode)return;
      var sg=(typeof leadStage==='function')?leadStage(b):(b.stage||'');
      var step=STEPS[sg]; if(!step)return;
      var el=document.createElement('div'); el.className='v35-next card';
      el.style.cssText='padding:10px 14px;margin-bottom:12px;display:flex;gap:9px;align-items:center;flex-wrap:wrap;border-inline-start:3px solid #7A5AF8;background:#F6F4FE';
      el.innerHTML='<span style="font-size:14px">▶</span><span style="font-weight:700;color:#5B3FD4;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:.03em;text-transform:uppercase">'+fl('Next step','الخطوة التالية')+'</span><span style="color:var(--ink);font-size:13px">'+fl(step[0],step[1])+'</span>';
      grid.parentNode.insertBefore(el,grid);
    }catch(e){if(window.console)console.warn('[v35] next',e);}},55);
  };
  console.info('%c[v35] leads next-step nudge loaded','color:#7A5AF8;font-weight:700');
}catch(e){if(window.console)console.warn('[v35] init',e);}})();
