/* ===== v38c: sidebar shows the real signed-in person, not hardcoded name =====
   2026-09-24 (fire #252): writes the name the app shows for a person — displayName() in js/54:
   nickname in the page language, else Arabic name in Arabic, else the full name — not the raw
   full name. Writing the raw name here every 1.2 s is what undid js/50's Arabic swap and made the
   footer flip between two names on the live app. Same name as the top-bar chip now (M94). */
(function(){try{
function upd(){try{
  var nm=(typeof me==='function'?me():'')||'';
  if(!nm)return;
  var shown=(typeof window.displayName==='function')?(window.displayName(nm)||nm):nm;
  var foot=document.querySelector('.foot'); if(!foot)return;
  var b=foot.querySelector('b'); if(b&&b.textContent!==shown)b.textContent=shown;
  var av=foot.querySelector('.av'); if(av){ var ini=(shown[0]||'D').toUpperCase(); if(av.textContent!==ini)av.textContent=ini; }
}catch(_){}}
setInterval(upd,1200); upd();
}catch(e){console.warn('v38c failed',e);}})();
