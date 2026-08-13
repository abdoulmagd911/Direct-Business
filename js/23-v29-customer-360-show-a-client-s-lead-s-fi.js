/* v29 — Customer 360: show a client's/lead's finance snapshot on their detail page,
   and link out to the Finance ledger. SAFETY: finance invoices key to a client only by
   NAME (client_group), so this matches ONLY on an exact normalised name — it errs toward
   showing NOTHING rather than the wrong company's money. Additive card, reversible. */
(function(){try{
  var fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  function norm(s){return String(s==null?'':s).toLowerCase().replace(/[\s\-_.,&()]+/g,' ').replace(/\b(co|company|ltd|llc|est|group|est\.)\b/g,'').replace(/\s+/g,' ').trim();}
  function mS(n){n=Number(n)||0;if(Math.abs(n)>=1e6)return (n/1e6).toFixed(2)+'M';if(Math.abs(n)>=1e3)return (n/1e3).toFixed(1)+'K';return n.toFixed(0);}
  function injectFinance(){
    try{
      if(typeof current==='undefined'||(current!=='leads'&&current!=='clients'))return;
      if(typeof openLead==='undefined'||!openLead)return;
      if(typeof leadDetailView!=='undefined'&&leadDetailView!=='detail')return;
      var view=document.getElementById('view'); if(!view)return;
      var head=view.querySelector('.detail-head'); if(!head)return;
      if(view.querySelector('.v29-fin'))return; // already injected this render
      var biz=(typeof getLead==='function')?getLead(openLead):null; if(!biz||!biz.name)return;
      // finance data loads async; kick it off once, re-render when ready
      var FIN=window.FIN, finLoad=window.finLoad;
      if(!FIN)return;
      if(FIN.rows==null){ if(!FIN.loading && typeof finLoad==='function'){ finLoad(function(){ try{if(typeof render==='function')render();}catch(_){}}); } return; }
      // Prefer the confirmed client↔finance link (join by business id); fall back to exact name
      // only when this client has no link row yet — never guesses a wrong company's money.
      var bizUuid=(window.__bizUuid?window.__bizUuid(biz.id):biz.id);
      var linkedGroups=(window.FIN&&FIN.groupsByBiz&&bizUuid)?FIN.groupsByBiz[bizUuid]:null;
      var rows, matchedByLink=false;
      if(linkedGroups&&linkedGroups.length){
        var gset={}; linkedGroups.forEach(function(g){gset[g]=1;});
        rows=FIN.rows.filter(function(r){ return !r.deleted_at && gset[r.client_group]; });
        matchedByLink=true;
      } else {
        var target=norm(biz.name); if(!target)return;
        rows=FIN.rows.filter(function(r){ if(r.deleted_at)return false; return norm(r.client_group)===target || norm(r.customer_raw_name)===target; });
      }
      if(!rows.length)return; // nothing linked or matched -> show nothing (never a wrong match)
      var billed=0,rec=0,out=0,_rev=0,_cost=0,_prof=0,cg=rows[0].client_group||biz.name,last='',_inv={};
      rows.forEach(function(r){ billed+=+r.total_incl_vat_sar||0; rec+=+r.amount_received_sar||0; out+=+r.amount_remaining_sar||0; _rev+=+r.revenue_sar||0; _cost+=+r.cost_sar||0; _prof+=+r.profit_sar||0; _inv[r.invoice_no||('row'+Math.random())]=1; if((r.invoice_date||'')>last)last=r.invoice_date||''; });
      var nInv=Object.keys(_inv).length;
      var card=document.createElement('div');
      card.className='card v29-fin';
      card.style.cssText='margin:0 0 14px';
      var mini=function(lbl,val,col){return '<div style="flex:1;min-width:100px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:18px;font-weight:800;color:'+(col||'#1C1E2B')+'">'+val+'</div></div>';};
      card.innerHTML='<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
          '<h3 style="margin:0">'+fl('Finance','المالية')+'</h3>'+
          '<button class="btn sm" onclick="try{current=\'finance\';FIN.tab=\'ledger\';FIN.f.client='+JSON.stringify(cg).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+';render();}catch(e){}">'+fl('Open in Finance ledger ↗','افتح في سجل المالية ↗')+'</button></div>'+
        '<div class="ch-sub" style="margin:2px 0 12px">'+(matchedByLink
            ? fl('Linked to Direct finance · '+nInv+' invoice'+(nInv>1?'s':''),'مرتبطة بمالية دايركت · '+nInv+' فاتورة')
            : (fl('Matched to '+nInv+' invoice'+(nInv>1?'s':'')+' by name — not linked yet; ','مطابَقة بـ '+nInv+' فاتورة حسب الاسم — غير مرتبطة بعد؛ ')+'<span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">'+fl('link it now.','اربطها الآن.')+'</span>'))+'</div>'+
        '<div style="display:flex;gap:18px;flex-wrap:wrap">'+
          mini(fl('Lifetime billed','إجمالي الفوترة'),mS(billed)+' SAR','#175CD3')+
          mini(fl('Received','المُحصّل'),mS(rec)+' SAR','#0F6E56')+
          mini(fl('Outstanding','المستحق'),mS(out)+' SAR',out>0?'#D92D20':'#667085')+
          mini(fl('Cost','التكلفة'),mS(_cost)+' SAR','#B54708')+
          mini(fl('Profit (service fee)','الربح (رسوم الخدمة)'),mS(_prof)+' SAR','#0F6E56')+
          mini(fl('Margin %','هامش %'),(_rev>0?Math.round(_prof/_rev*100):0)+'%','#175CD3')+
          (function(){var _cr=0;try{(linkedGroups||[]).forEach(function(g){var l=FIN.linkByGroup[g];if(l)_cr+=+l.credit_balance_sar||0;});}catch(_){ } return _cr>0?mini(fl('Credit held','رصيد لدينا'),mS(_cr)+' SAR','#10B981'):'';})()+
          mini(fl('Invoices','عدد الفواتير'),String(nInv))+
          mini(fl('Last invoice','آخر فاتورة'),last||'—')+
        '</div>';
      head.insertAdjacentElement('afterend',card);
      // reconcile the stale "Key facts" numbers (which read a legacy b.totalSAR field) with the
      // real finance figures, so the page never shows two different "Lifetime billed" values.
      var facts=view.querySelectorAll('.fact');
      for(var fi=0;fi<facts.length;fi++){ var kk=facts[fi].querySelector('.k'), vv=facts[fi].querySelector('.v'); if(!kk||!vv)continue;
        var kt=(kk.textContent||'').trim();
        if(kt==='Lifetime billed'||kt==='إجمالي الفوترة'){ vv.textContent=mS(billed)+' SAR'; }
        else if(kt==='Invoices'||kt==='عدد الفواتير'){ vv.textContent=String(nInv); }
      }
    }catch(e){ if(window.console)console.warn('[v29] fin snapshot',e); }
  }
  window.v29InjectFinance=injectFinance;
  if(typeof render==='function'){ var _r29=render; window.render=function(){ var o=_r29.apply(this,arguments); injectFinance(); return o; }; }
  injectFinance();
}catch(e){ if(window.console)console.warn('[v29] init',e); }})();
