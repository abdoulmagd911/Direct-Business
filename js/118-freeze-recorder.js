/* 118 — the freeze recorder (2026-09-28). The owner's most repeated complaint is a Finance tab that stops responding.
   It was reproduced once on his PC (Rules tab, ~15 min after the last save) and NOT in 45 minutes of the same page left
   idle in a test browser against the live site — so the cause is something that happens on his machine, and the next
   freeze has to name itself.

   What this does, and nothing else:
     · every second it writes a small heartbeat to this browser's own storage (localStorage, key db_blackbox): the time,
       the page and Finance tab, how many repaints / saves / network calls happened, the last few long script runs
       (PerformanceObserver "longtask", with their length) and the longest gap between two heartbeats;
     · when the page opens, it reads the previous tab's last heartbeat. If that tab was still open when its heartbeats
       stopped for more than 20 s while the page was visible, or it logged a stall of 5 s or more, a small note says so,
       with the time (Riyadh) and what the page was doing — to screenshot and send. Dismissable, never blocking.
   Nothing is sent anywhere; nothing is written to the database; no native dialog. window.__blackbox() returns the
   current record; window.__blackboxLast the previous tab's. */
(function(){try{
  var id=Math.random().toString(36).slice(2,9), KEY='db_blackbox:'+id, started=Date.now();
  var W={renders:0,saves:0,calls:0,long:[],maxGap:0,last:Date.now(),hidden:false};
  function fl(en,ar){ try{ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }catch(_){ return en; } }
  function hm(t){ try{ return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Riyadh'}); }catch(_){ return String(t); } }
  function where(){ var p='?'; try{ p=(typeof current!=='undefined'?current:'?')+((typeof current!=='undefined'&&current==='finance'&&window.FIN)?'/'+FIN.tab:''); }catch(_){} return p; }

  /* the previous tab's record, read BEFORE this one overwrites it */
  /* every tab keeps its own record (db_blackbox:<tab>); one still beating (< 5 s old) belongs to another open tab and is
     left alone; the others are read once, the worst kept, and cleared */
  var prev=null;
  try{ for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(!k||k.indexOf('db_blackbox:')!==0) continue;
      var r=null; try{ r=JSON.parse(localStorage.getItem(k)||'null'); }catch(_){}
      if(r&&!r.closed&&Date.now()-r.at<5000) continue;   // another tab, open right now
      if(r&&(!prev||(r.maxGap||0)>(prev.maxGap||0)||(!r.closed&&prev.closed))) prev=r;
      try{ localStorage.removeItem(k); }catch(_){} } }catch(_){}
  try{ window.__blackboxLast=prev; }catch(_){}

  try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ W.long.push({at:Math.round(performance.timeOrigin+e.startTime),ms:Math.round(e.duration),page:where()}); if(W.long.length>8) W.long.shift(); }); }).observe({type:'longtask',buffered:true}); }catch(_){}
  try{ var of=window.fetch; if(of&&!of.__bb){ var nf=function(i,o){ W.calls++; try{ var m=String((o&&o.method)||(i&&i.method)||'GET').toUpperCase(); if(m!=='GET'&&m!=='HEAD') W.saves++; }catch(_){} return of.apply(this,arguments); }; nf.__bb=1; window.fetch=nf; } }catch(_){}
  (function wrapRender(n){ try{ if(typeof window.render==='function'&&!window.render.__bb){ var r=window.render; var w=function(){ W.renders++; return r.apply(this,arguments); }; w.__bb=1; window.render=w; return; } }catch(_){}
    if((n||0)<60) setTimeout(function(){ wrapRender((n||0)+1); },500); })(0);
  try{ document.addEventListener('visibilitychange',function(){ W.hidden=document.hidden; W.last=Date.now(); }); W.hidden=document.hidden; }catch(_){}

  function snap(){ return {id:id,at:Date.now(),since:started,page:where(),hidden:W.hidden,renders:W.renders,saves:W.saves,calls:W.calls,long:W.long.slice(),maxGap:W.maxGap,gapAt:W.gapAt||null,gapPage:W.gapPage||null,closed:false}; }
  function beat(){
    var now=Date.now(), gap=now-W.last; W.last=now;
    if(!W.hidden&&gap>W.maxGap){ W.maxGap=gap; W.gapAt=now; W.gapPage=where(); }   // a hidden tab is slowed by the browser on purpose — not a stall
    try{ localStorage.setItem(KEY,JSON.stringify(snap())); }catch(_){}
  }
  setInterval(beat,1000);
  try{ window.addEventListener('pagehide',function(){ try{ var s=snap(); s.closed=true; localStorage.setItem(KEY,JSON.stringify(s)); }catch(_){} }); }catch(_){}
  try{ window.__blackbox=snap; }catch(_){}

  /* the note about the previous tab */
  function note(){
    if(!prev||prev.id===id) return;
    var bigLong=(prev.long||[]).filter(function(x){ return x.ms>=5000; });
    var stopped=!prev.closed&&!prev.hidden&&(Date.now()-prev.at>20000);   // the tab's heartbeats stopped while it was on screen and open
    if(!bigLong.length&&!(prev.maxGap>=5000)&&!stopped) return;
    var lines=[];
    if(stopped) lines.push(fl('A Direct Business tab went silent at ','توقفت نافذة لـ Direct Business عن العمل الساعة ')+hm(prev.at)+fl(' (Riyadh) on ',' (بتوقيت الرياض) في ')+(prev.page||'?')+fl(' — it froze, or the computer went to sleep.',' — إما أنها تجمّدت أو أن الجهاز دخل في وضع السكون.'));
    if(prev.maxGap>=5000) lines.push(fl('Longest pause: ','أطول توقف: ')+Math.round(prev.maxGap/1000)+fl(' s, ending ',' ث، انتهى الساعة ')+hm(prev.gapAt||prev.at)+fl(' on ',' في ')+(prev.gapPage||prev.page||'?')+fl(' (a page frozen, or the computer asleep with it open).',' (إما أن الصفحة تجمّدت أو أن الجهاز كان في وضع السكون وهي مفتوحة).'));
    bigLong.forEach(function(x){ lines.push(fl('A script ran for ','استمر تشغيل برنامج ')+Math.round(x.ms/1000)+fl(' s at ',' ث عند ')+hm(x.at)+fl(' on ',' في ')+x.page+'.'); });
    lines.push(fl('Before it: ','قبلها: ')+prev.renders+fl(' repaints, ',' إعادة رسم، ')+prev.saves+fl(' saves, ',' حفظ، ')+prev.calls+fl(' calls since it opened at ',' طلب منذ فتحها الساعة ')+hm(prev.since)+'.');
    var d=document.createElement('div'); d.id='v118Note'; d.setAttribute('role','status');
    d.style.cssText='position:fixed;bottom:16px;inset-inline-end:16px;z-index:99990;max-width:380px;background:#FFF8EB;border:1px solid #F5C26B;border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.55;color:#4A3B1B;box-shadow:0 6px 24px rgba(0,0,0,.15)';
    d.innerHTML='<div style="font-weight:700;margin-bottom:4px">'+fl('Freeze recorder','مسجّل التوقف')+'</div>'+lines.map(function(t){ return '<div>'+String(t).replace(/[<>&]/g,'')+'</div>'; }).join('')+
      '<div style="margin-top:6px;color:#7A6A45">'+fl('Please screenshot this and send it — it names what the page was doing.','يُرجى تصوير هذه الرسالة وإرسالها — فهي تحدد ما كانت الصفحة تفعله.')+'</div>'+
      '<div style="text-align:end;margin-top:6px"><button class="btn sm ghost" type="button">'+fl('Close','إغلاق')+'</button></div>';
    d.querySelector('button').onclick=function(){ d.remove(); };
    document.body.appendChild(d);
  }
  setTimeout(function(){ try{ note(); }catch(_){} },4000);
}catch(e){ if(window.console) console.warn('[118] freeze recorder',e); }})();
