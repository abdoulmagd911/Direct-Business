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
