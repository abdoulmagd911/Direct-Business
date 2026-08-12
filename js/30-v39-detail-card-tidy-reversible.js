/* v39 — detail-card tidy (reversible):
   • Hide the redundant "Managed client" strip (.dt-clientbanner) — the header already carries a
     Client tag, and the Direct strip (v34 + folded-in v36) carries the actionable link. So a
     client detail now shows ONE Direct strip instead of three.
   • Drop the duplicate "Lifetime billed" row from Key facts — the 💰 Finance card shows it prominently.
   • Trim the helper subtitles (.ch-sub) on the lead/client detail — guidance for a new user, noise
     once you know the tool.
   • Native <details> marker + caret polish for the now-collapsible v33 service-fit map.
   Nothing deleted — remove this block (and the v33/v36 edits) to restore everything. */
(function(){try{
  if(!document.getElementById('v39css')){
    var st=document.createElement('style'); st.id='v39css';
    st.textContent=
      '.dt-clientbanner{display:none!important}'+
      '.v33-fit>summary{list-style:none}'+
      '.v33-fit>summary::-webkit-details-marker{display:none}'+
      '.v33-fit[open] .v33-caret{transform:rotate(90deg)}';
    (document.head||document.documentElement).appendChild(st);
  }
  function tidy(){try{
    if(typeof current==='undefined'||current!=='leads')return;
    if(typeof openLead==='undefined'||!openLead)return;
    var view=document.getElementById('view'); if(!view)return;
    var grid=view.querySelector('.detail-grid'); if(!grid)return;
    // (1) trim helper subtitles on the detail cards
    grid.querySelectorAll('.ch-sub').forEach(function(s){ s.style.display='none'; });
    // (2) drop the duplicate "Lifetime billed" row from Key facts (the Finance card shows it)
    var hasFinanceCard=[].slice.call(view.querySelectorAll('.card h3')).some(function(h){return /Finance/.test(h.textContent);});
    if(hasFinanceCard){
      grid.querySelectorAll('.fact').forEach(function(f){
        var k=f.querySelector('.k'); if(k&&/^\s*Lifetime billed\s*$/.test(k.textContent)) f.style.display='none';
      });
    }
  }catch(e){if(window.console)console.warn('[v39] tidy',e);}}
  try{ var _r=window.render; window.render=function(){var x=_r.apply(this,arguments);setTimeout(tidy,140);return x;}; }catch(_){}
  console.info('%c[v39] detail-card tidy loaded','color:#9AA1B6;font-weight:700');
}catch(e){if(window.console)console.warn('[v39] init',e);}})();
