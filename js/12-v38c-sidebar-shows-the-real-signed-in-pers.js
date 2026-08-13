/* ===== v38c: sidebar shows the real signed-in person, not hardcoded name ===== */
(function(){try{
function upd(){try{
  var nm=(typeof me==='function'?me():'')||'';
  if(!nm)return;
  var foot=document.querySelector('.foot'); if(!foot)return;
  var b=foot.querySelector('b'); if(b&&b.textContent!==nm)b.textContent=nm;
  var av=foot.querySelector('.av'); if(av)av.textContent=(nm[0]||'D').toUpperCase();
}catch(_){}}
setInterval(upd,1200); upd();
}catch(e){console.warn('v38c failed',e);}})();
