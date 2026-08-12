/* Brand name per language — English view shows only "Direct Business", Arabic view shows only "دايركت أعمال" (same weight/colour) */
(function(){try{
  var AR='دايركت أعمال';
  function isAr(){try{if(typeof LANG!=='undefined'&&LANG)return LANG==='ar';}catch(_){}return (document.documentElement.getAttribute('data-lang')==='ar');}
  window.brandName=function(){return isAr()?AR:'Direct Business';};
  // language-aware company name: primary follows the chosen language (Arabic-primary in Arabic view, English-primary in English view)
  window.nmMain=function(b){try{var ar=isAr();var a=(b&&b.nameAr)||'',e=(b&&b.name)||'';return (ar&&a)?a:e;}catch(_){return (b&&b.name)||'';}};
  window.nmSubHTML=function(b){try{var ar=isAr();var a=(b&&b.nameAr)||'',e=(b&&b.name)||'';if(!a)return '';var s=ar?e:a;if(!s)return '';var rtl=!ar;var t;try{t=esc(s);}catch(_){t=String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}return '<div style="font-size:11px;color:var(--muted)'+(rtl?";direction:rtl;text-align:left;font-family:'Cairo','Tajawal',sans-serif":'')+'" dir="'+(rtl?'rtl':'ltr')+'">'+t+'</div>';}catch(_){return '';}};
  function apply(){try{
    var ar=isAr();
    document.querySelectorAll('.brand .lock').forEach(function(el){
      el.innerHTML = ar ? '<b class="bm" style="font-family:\'Cairo\',\'Tajawal\',sans-serif">دايركت <span class="bz">أعمال</span></b>' : '<b class="bm">Direct <span class="bz">Business</span></b>';
    });
    document.title = ar ? AR : 'Direct Business';
    var lg=document.getElementById('cl_logo');
    if(lg&&lg.parentNode){var divs=lg.parentNode.querySelectorAll(':scope > div');if(divs.length>=2){divs[0].style.display=ar?'none':'';divs[1].style.display=ar?'':'none';if(ar){divs[1].style.fontSize='22px';divs[1].style.fontWeight='800';divs[1].style.color='#1C1E2B';divs[1].style.direction='rtl';}else{divs[1].style.fontSize='';divs[1].style.fontWeight='';divs[1].style.color='';}}}
  }catch(_){}}
  var iv=setInterval(function(){if(document.querySelector('.brand .lock')||document.getElementById('cl_logo')||typeof render==='function'){clearInterval(iv);apply();try{if(typeof render==='function'){var _r=render;render=function(){var o=_r.apply(this,arguments);try{apply();}catch(_){}; return o;};}}catch(_){}}},200);
  try{new MutationObserver(apply).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});}catch(_){}
  setTimeout(apply,1200);setTimeout(apply,2500);
}catch(e){console.warn('brand',e);}})();
