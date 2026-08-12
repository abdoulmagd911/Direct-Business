/* ===== v38b: show/hide password eye on all password fields ===== */
(function(){try{
var EYE='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYEOFF='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>';
function addEye(inp){
  if(!inp||inp.__eye)return; inp.__eye=1;
  var wrap=document.createElement('div');
  wrap.style.cssText='position:relative;display:block';
  inp.parentNode.insertBefore(wrap,inp); wrap.appendChild(inp);
  var pr=inp.style.paddingRight; inp.style.paddingRight='44px';
  var b=document.createElement('button'); b.type='button'; b.innerHTML=EYE;
  b.setAttribute('aria-label','Show password'); b.title='Show password';
  b.style.cssText='position:absolute;right:9px;top:50%;transform:translateY(-50%);border:0;background:none;cursor:pointer;padding:4px;color:#7C8194;display:flex;align-items:center';
  b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();
    if(inp.type==='password'){inp.type='text';b.innerHTML=EYEOFF;b.title='Hide password';}
    else{inp.type='password';b.innerHTML=EYE;b.title='Show password';}
    inp.focus();
  };
  wrap.appendChild(b);
  /* keep vertical centering right even though the input has its own margins */
  var cs=window.getComputedStyle(inp);
  wrap.style.margin=cs.marginTop+' '+cs.marginRight+' '+cs.marginBottom+' '+cs.marginLeft;
  inp.style.margin='0';
}
setInterval(function(){
  try{ document.querySelectorAll('input[type=password]').forEach(addEye); }catch(_){}
},700);
console.info('%c[v38b password eye] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v38b failed',e);}})();
