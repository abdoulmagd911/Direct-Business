/* ===== js/102 — a change that never reached the server is said out loud, once, on the way back in
   (fire #206, 2026-09-22) =====

   Driven end to end against the real database with every write answered 500, the app behaved well
   at the moment of failure and badly one step later:

     · the moment of failure — red pill "Save issue: …", the badge red, a retry with backoff, a
       browser warning if you try to close the tab, AND the edit really is on the device (it is in
       localStorage `directBusinessData_v29`, checked at that second). Nothing wrong here.
     · one reload later — the workspace loads from the cloud, the edit is gone from the app AND
       from the device, with nothing on the screen to say a change was lost. The badge is green
       again ("Synced 9h ago"), because the last confirmed save is still the last confirmed save.

   So the device copy is not a recovery path — it is overwritten at the next load. Two things are
   fixed together and they only work as a pair:
     · the badge no longer says "saved on this device" (js/75 owns that wording), because that
       phrase invites the one action that loses the work;
     · this layer tells the person what was lost the next time they open the app.

   js/02 writes `db_unsent_v1` (when, how many, the names, the database's own reason) whenever a
   push fails, and deletes it on the next confirmed save — so the key exists only while a change
   genuinely never landed. This file reads it once at startup, says so in plain words through the
   app's existing notice card (js/63's v63Notice — the same card the "saved onto a deleted record"
   warning uses, not a second one), and deletes the key so it is said once and not on every load.

   It cannot invent a recovery: re-applying a change that the database refused could overwrite what
   somebody else has since written, and this app is not the system of record. It names the records
   so the change can be made again in seconds.

   Bilingual. Removing this file removes the message and nothing else. */
(function(){try{
  var KEY='db_unsent_v1';
  /* 2026-09-25 (why probe-two-people-one-record-are-told failed only under load): the note is read HERE,
     the moment the page starts, not when the person is signed in. Reading it later meant that on a slow
     machine a save that failed in THIS page's first seconds was picked up and reported as "the page was
     loaded again before it could be sent" — false, and it would be false for a person on a slow laptop
     too. What this page's own failures write is left for the next load, where it is true. */
  var AT_START=null; try{ AT_START=localStorage.getItem(KEY); }catch(_){ AT_START=null; }
  function fl(en,ar){ try{ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }catch(_){ return en; } }
  function whenWords(iso){
    try{ var d=new Date(iso); if(isNaN(d.getTime())) return '';
      var day=d.toISOString().slice(0,10), hm=d.toTimeString().slice(0,5);
      return fl(' on '+day+' at '+hm, ' يوم '+day+' الساعة '+hm);
    }catch(_){ return ''; }
  }
  function say(){
    var raw=AT_START;
    if(!raw) return;
    var d=null; try{ d=JSON.parse(raw); }catch(_){ d=null; }
    /* said once, never on every load — but only the note that was there when the page started is
       removed; one this page wrote since belongs to the next load */
    try{ if(localStorage.getItem(KEY)===raw) localStorage.removeItem(KEY); }catch(_){}
    if(!d) return;
    var n=Number(d.n||0)||0;
    var names=(d.names||[]).filter(Boolean);
    /* built in one piece per language rather than glued from fragments — the two languages do not
       put the pieces in the same order */
    var msg = fl(
      (n===1?'A change you made':(n?(n+' changes you made'):'A change you made'))+whenWords(d.at)+
      ' never reached the server, and it is not in the app now. The page was loaded again before it could be sent.'+
      (names.length?(' It was '+(names.length===1?'this company: ':'these companies: ')+names.join(', ')+'.'):'')+
      ' Please make the change again.'+
      (d.why?(' The database said: '+d.why):''),
      (n===1?'تعديل أجريته':(n?('‏'+n+' تعديلات أجريتها'):'تعديل أجريته'))+whenWords(d.at)+
      ' لم يصل إلى الخادم، وهو غير موجود في التطبيق الآن. أُعيد تحميل الصفحة قبل أن يُرسَل.'+
      (names.length?(' وكان على '+(names.length===1?'هذه الشركة: ':'هذه الشركات: ')+names.join('، ')+'.'):'')+
      ' يُرجى إجراء التعديل من جديد.'+
      (d.why?(' ردّت قاعدة البيانات: '+d.why):'')
    );
    try{ if(typeof window.v63Notice==='function'){ window.v63Notice(msg); return; } }catch(_){}
    try{ if(typeof toast==='function'){ toast(msg,'err'); return; } }catch(_){}
    try{ console.warn('[102] '+msg); }catch(_){}
  }
  /* wait until the person is actually looking at the app: the notice card needs the page, and the
     language is only settled after sign-in */
  var tries=0;
  (function wait(){
    tries++;
    var ready=false;
    try{ ready=!!document.body && typeof window.v63Notice==='function' && !document.getElementById('cl_email'); }catch(_){ ready=false; }
    if(ready){ setTimeout(say,1200); return; }
    if(tries<240) setTimeout(wait,500);
  })();
}catch(e){ try{ console.warn('[102]',e); }catch(_){} }})();
