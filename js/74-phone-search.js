/* js/74-phone-search.js — search on a phone (2026-09-02, attack round 21).
   index.html hides the global search box under 780 px (`.gsearch-wrap{display:none}`) and nothing
   replaced it: on a phone the only way to search was the Today page's "Find a client" card, and
   the Leads / Clients / Finance pages had no search at all. This layer adds one 🔍 button to the
   top bar (phone widths only) that reveals the SAME search box as a full-width row under the bar
   and focuses it — no second search engine, the existing runGlobalSearch / gGo do the work. The
   row closes itself after a pick or when focus leaves. Reversible: remove the script line. */
(function(){try{
  var CSS='#v74search{display:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;border:1px solid var(--line-2);background:#fff;cursor:pointer;font-size:16px;flex:0 0 auto;padding:0}'
    +'@media(max-width:780px){#v74search{display:inline-flex}.gsearch-wrap.v74-open{display:block!important;position:absolute;left:10px;right:10px;top:100%;margin:6px 0 0;max-width:none;z-index:9}.gsearch-wrap.v74-open #gres{max-height:60vh;overflow:auto}}';
  function ensure(){
    var top=document.querySelector('.top'),wrap=document.querySelector('.gsearch-wrap');if(!top||!wrap)return;
    if(!document.getElementById('v74css')){var st=document.createElement('style');st.id='v74css';st.textContent=CSS;document.head.appendChild(st);}
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var btn=document.getElementById('v74search');
    if(!btn){btn=document.createElement('button');btn.id='v74search';btn.type='button';btn.textContent='🔍';btn.onclick=function(){toggle();};wrap.insertAdjacentElement('afterend',btn);}
    btn.title=ar?'بحث':'Search';btn.setAttribute('aria-label',btn.title);
  }
  function toggle(force){
    var wrap=document.querySelector('.gsearch-wrap');if(!wrap)return;
    var open=(typeof force==='boolean')?force:!wrap.classList.contains('v74-open');
    wrap.classList.toggle('v74-open',open);
    if(open){var gs=document.getElementById('gsearch');if(gs){gs.focus();try{gs.select();}catch(_){}}}
    else{var box=document.getElementById('gres');if(box)box.style.display='none';}
  }
  window.v74ToggleSearch=toggle;
  // the results box hides itself 220 ms after blur (index.html onblur) — close the row just after that
  document.addEventListener('focusout',function(e){if(e.target&&e.target.id==='gsearch'){setTimeout(function(){toggle(false);},260);}});
  if(typeof window.gGo==='function'){var _gGo=window.gGo;window.gGo=function(){var out=_gGo.apply(this,arguments);toggle(false);return out;};}
  ensure();
  if(typeof render==='function'){var _r=render;window.render=function(){var out=_r.apply(this,arguments);try{ensure();}catch(_){}return out;};}
}catch(e){if(window.console)console.warn('[v74] phone search',e);}})();
