/* ===== js/104 — when two people had the same company open, say so (fire #231, 2026-09-23) =====

   MEASURED, NOT SUSPECTED. scripts/qa/diag-two-tabs-one-record.mjs has been reporting this since
   2026-09-10 and still reproduces today: tab A logs a call note and sets a next action on a
   company and saves; tab B — opened earlier, holding a stale copy — changes only the segment and
   saves 2.5 seconds later. Afterwards the table holds B's segment and **A's note and next action
   are gone**, with a green "Saved" on both screens and nothing anywhere saying a thing was lost.
   docs/LANDMINES.md B.1 parked this as "revisit only if it actually bites". It bites.

   WHY IT IS NOT SIMPLY FIXED HERE, which matters before anyone calls this half a job. js/02 only
   sends the rows THIS tab changed — that part is already careful — but each one is sent as a whole
   row, so it carries this tab's stale copy of every other field. The obvious cure, sending only the
   changed fields, does not actually cure it: almost everything a person edits in this app lives
   inside the single `raw` blob, which is ONE column, so two people editing different things about
   the same company still collide in it. A real cure is a three-way merge of that blob inside the
   save path — the one piece of code where a mistake stops the whole team saving. That is the
   owner's call, not a thing to slip into a QA sweep, and it is written up in docs/BACKLOG.md.

   WHAT THIS DOES INSTEAD: turns a silent loss into a named event with a recovery path.
   It keeps its own note of when each company was last written, taken after every save of its own.
   When you save, it asks the database — before your write lands — whether that company has been
   written by anyone since. If it has, it says so, names the company, and points at Activity &
   Audit, where record_history holds the before-image and Undo can put it back for 24 hours.

   IT NEVER BLOCKS A SAVE AND NEVER WRITES ANYTHING. Worst case it says nothing.

   THE ONE RACE, AND HOW IT IS HANDLED: js/02 pushes 900 ms after save(). This asks the database at
   save() time, so the answer almost always arrives first — but on a slow reply it could arrive
   after the push and read back this tab's OWN write as somebody else's. So an answer that takes
   longer than 800 ms is discarded rather than guessed at: no warning that round. A false "somebody
   else changed this" would be worse than a missed one, because the next real one would be ignored.

   Removing this file removes the message and changes nothing else. */
(function(){try{
  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }

  var SEEN={};        /* app id -> updated_at as of the last time we looked */
  var MINE={};        /* app id -> the record as we last synced it, to see what this tab changed */
  var ready=false, refreshing=false, told={};

  function snapOf(b){ try{ return JSON.stringify(b); }catch(_){ return String(Math.random()); } }
  function ids(){ try{ return (DB.businesses||[]).map(function(b){ return b&&b.id!=null?String(b.id):null; }).filter(Boolean); }catch(_){ return []; } }

  /* A record's id INSIDE the app is `legacy_id || id` (js/02 rowToApp), and measured live only 21
     of the 108 companies carry a legacy_id — the other 87 go by their uuid. Asking only by
     legacy_id therefore watched a fifth of the data and said nothing about the rest, which is how
     the first cut of this file shipped in testing and got caught by driving it against the real
     database. So: one query by legacy_id (a text column, so any value is safe to send) covering
     everything, and a second by id for the uuid-shaped ones. Both answers are keyed back the same
     way the app keys them, `legacy_id || id`, so the two merge without either winning.
     .in() rather than a hand-built in.(…) string: the client quotes each value itself, and an id
     holding a comma or a quote would otherwise split the list. */
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function readStamps(list,cb){
    var c=client(); if(!c||!list.length){ cb(null); return; }
    var uuids=list.filter(function(v){ return UUID.test(String(v)); });
    var out={}, pending=1+(uuids.length?1:0), failed=false;
    var take=function(r){
      if(!r||r.error||!Array.isArray(r.data)){ failed=true; }
      else r.data.forEach(function(x){ if(!x)return; var k=String(x.legacy_id||x.id||''); if(k) out[k]=x.updated_at||''; });
      if(--pending<=0) cb(failed&&!Object.keys(out).length?null:out);
    };
    try{
      c.from('businesses').select('id,legacy_id,updated_at').in('legacy_id',list).then(take).catch(function(){ take(null); });
      if(uuids.length) c.from('businesses').select('id,legacy_id,updated_at').in('id',uuids).then(take).catch(function(){ take(null); });
    }catch(_){ cb(null); }
  }

  /* take our own note of where things stand — after sign-in, and after every save of ours */
  function refresh(list){
    if(refreshing) return; refreshing=true;
    var want=(list&&list.length)?list:ids();
    readStamps(want,function(map){
      refreshing=false;
      if(!map) return;
      Object.keys(map).forEach(function(k){ SEEN[k]=map[k]; });
      try{ (DB.businesses||[]).forEach(function(b){ if(b&&b.id!=null&&map[String(b.id)]!==undefined) MINE[String(b.id)]=snapOf(b); }); }catch(_){}
      ready=true;
    });
  }

  function nameOf(id){
    try{ var b=(DB.businesses||[]).filter(function(x){ return String(x.id)===String(id); })[0];
      return (b&&(window.nmMain?nmMain(b):b.name))||String(id); }catch(_){ return String(id); }
  }

  function tell(id){
    if(told[id]) return; told[id]=Date.now();
    var n=nameOf(id);
    var msg=fl('Somebody else changed “'+n+'” while you had it open. Your save has just gone out, and it may have replaced part of what they did. Open Activity & Audit to see both changes — an undo is there for 24 hours.',
               'عدّل شخص آخر «'+n+'» بينما كانت مفتوحة لديك. حفظك أُرسل للتو، وربما استبدل جزءًا مما فعله. افتح «النشاط والتدقيق» لرؤية التغييرين — وخيار التراجع متاح لمدة ٢٤ ساعة.');
    try{ document.dispatchEvent(new CustomEvent('v104-collision',{detail:{id:String(id),name:String(n)}})); }catch(_){}
    try{ if(typeof window.v63Notice==='function'){ window.v63Notice(msg); return; } }catch(_){}
    try{ if(typeof window.toast==='function') window.toast(msg); }catch(_){}
  }

  function check(){
    if(!ready||refreshing) return;
    var changed=[];
    try{ (DB.businesses||[]).forEach(function(b){ if(!b||b.id==null)return; var k=String(b.id);
      if(MINE[k]!==undefined && MINE[k]!==snapOf(b)) changed.push(k); }); }catch(_){}
    if(!changed.length) return;
    var asked=Date.now();
    readStamps(changed,function(map){
      /* the race: past 800 ms our own write may already have landed, and this answer would then be
         our own timestamp read as somebody else's change. Say nothing rather than cry wolf. */
      if(!map||(Date.now()-asked)>800){ setTimeout(function(){ refresh(changed); },2600); return; }
      changed.forEach(function(k){
        var now=map[k]; if(now===undefined) return;
        if(SEEN[k]!==undefined && now && now!==SEEN[k]) tell(k);
      });
      setTimeout(function(){ refresh(changed); },2600);
    });
  }

  /* wait for a signed-in session before asking the database anything — an anonymous read is
     refused, and the refusal is noise in the console at every page load (js/54 learned this) */
  var boot=setInterval(function(){
    try{
      if(window.__roleKnown!==true) return;
      if(!client()) return;
      if(!(DB&&Array.isArray(DB.businesses)&&DB.businesses.length)) return;
      clearInterval(boot);
      refresh();
      if(typeof window.save==='function'&&!window.save.__v104){
        var orig=window.save;
        var wrapped=function(){ var out=orig.apply(this,arguments); try{ check(); }catch(_){} return out; };
        wrapped.__v104=1; window.save=wrapped;
      }
    }catch(_){}
  },900);
  try{ window.__v104={ seen:SEEN, refresh:refresh, check:check }; }catch(_){}
  console.info('%c[v104] two people, one record — the second one is told','color:#B54708;font-weight:700');
}catch(e){ if(window.console)console.warn('[v104] init',e); }})();
