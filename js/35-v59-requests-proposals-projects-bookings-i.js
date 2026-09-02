/* v59 — requests / proposals / projects / bookings / invoices / settings move OUT of the
   app_state blob into real tables (app_requests / app_offers / app_projects, and since
   2026-08-11 app_bookings / app_invoices / app_settings — the LAST blob sections).
   Strategy: TABLE-READ, DUAL-WRITE.
   - Load: once signed in, fetch the three tables and replace DB.requests / DB.offers /
     DB.projects with the table contents (one row per record, data = the exact JSON the
     app already uses). If the tables are unreachable (e.g. the QA mock), the blob copy
     silently stays — nothing breaks.
   - Save: after every save(), diff the three arrays against the last-seen snapshot and
     upsert changed records / delete removed ones, row by row. Two people editing two
     DIFFERENT records no longer overwrite each other. The blob keeps carrying its own
     copy too, so rolling back = delete this layer; nothing else changes.
   Backup of the pre-migration blob: app_state_backup_20260810_premigration. */
(function(){try{
  var T={requests:'app_requests',offers:'app_offers',projects:'app_projects',bookings:'app_bookings',invoices:'app_invoices'};
  var SNAP=null; // id -> JSON string, per section; null until first successful table read
  /* Found in the 2026-08-17 audit: this called supabase's createClient, called with nothing passed in, with no arguments as a
     way to reach the shared client, and cached whatever came back into window.__sb59 forever.
     Safe today only because js/02 creates the real client synchronously before this file's slot
     35 loads — but if that ever changed, or a zero-argument call landed first, it would build a
     client with no project URL and no key and lock that broken client in for the rest of the
     page load. Same class of bug as the one found in three other files this session. Reading
     through window.fc — the accessor js/16 already publishes for exactly this — never creates
     a client of its own, so there is nothing here left to race. */
  function cli(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){ } return null; }
  function who(){ try{ return (window.meName&&meName())||(DB.settings&&DB.settings.currentUser)||''; }catch(_){ return ''; } }
  function snapOf(arr){ var m={}; (arr||[]).forEach(function(r){ if(r&&r.id!=null) m[String(r.id)]=JSON.stringify(r); }); return m; }

  /* ids the person has deleted in this tab since the tables were read — see apply() and
     syncOps(). Keyed by id alone, which is enough: ids are unique across these sections. */
  var _GONE={};

  var _tries=0, _loaded=false;
  function loadOps(){
    if(_loaded) return; _tries++;
    var c=cli(); if(!c){ if(_tries<20) setTimeout(loadOps,1500); return; }
    c.auth.getSession().then(function(s){
      var u=s&&s.data&&s.data.session&&s.data.session.user;
      if(!u){ if(_tries<20) setTimeout(loadOps,1500); return; }
      var KEYS=Object.keys(T);
      Promise.all(KEYS.map(function(k){return c.from(T[k]).select('id,data');}).concat([c.from('app_settings').select('id,data').eq('id','main')])).then(function(rs){
        if(rs.some(function(r){return r.error||!r.data;})) { return; } // tables unreachable → keep blob copy
        _loaded=true;
        var apply=function(){
          /* 2026-09-02 (round 32): `rs` is the response captured at LOAD time, so every
             re-assert replays the world as it was when the page opened. Anything the person
             has deleted since then would be resurrected. _GONE remembers those ids (recorded
             in syncOps, where the delete is actually issued) and they are filtered out here,
             so a delete holds even when the blob loader really does land late. */
          KEYS.forEach(function(k,i){ DB[k]=rs[i].data.map(function(r){return r.data;}).filter(function(r){ return !(r&&r.id!=null&&_GONE[String(r.id)]); }); });
          var st=rs[KEYS.length].data[0];
          if(st&&st.data){ DB.settings=DB.settings||{}; Object.keys(st.data).forEach(function(k){ DB.settings[k]=st.data[k]; }); }
          window.__v59ref=DB.requests;
          SNAP={}; KEYS.forEach(function(k){ SNAP[k]=snapOf(DB[k]); }); SNAP.__settings=JSON.stringify(DB.settings||{});
          try{ if(typeof render==='function') render(); }catch(_){ }
        };
        apply();
        // The workspace blob loader may finish AFTER us and put the blob copy back —
        // re-assert the table copy until the app settles (identity check, ~20s window).
        var _re=0, _iv=setInterval(function(){ _re++; if(DB.requests!==window.__v59ref){ apply(); } if(_re>13) clearInterval(_iv); },1500);
        console.info('%c[v59] blob sections loaded from tables ('+KEYS.map(function(k,i){return k+':'+rs[i].data.length;}).join(' ')+' settings:'+(rs[KEYS.length].data.length?'yes':'no')+')','color:#0F6E56;font-weight:700');
      }).catch(function(){});
    }).catch(function(){});
  }

  var _syncT=null;
  function syncOps(){
    var c=cli(); if(!c||!SNAP) return; // never write before a successful read (protects against clobbering)
    Object.keys(T).forEach(function(sec){
      var cur=(DB&&DB[sec])||[], curMap=snapOf(cur), prev=SNAP[sec]||{};
      var ups=[], dels=[];
      Object.keys(curMap).forEach(function(id){ if(prev[id]!==curMap[id]) ups.push({id:id,data:JSON.parse(curMap[id]),updated_at:new Date().toISOString(),updated_by:who()}); });
      Object.keys(prev).forEach(function(id){ if(!(id in curMap)){ dels.push(id); _GONE[String(id)]=1; } });
      /* M13 (2026-09-02, attack round 10): only the records the database confirms back count as
         synced. Before, a silent policy refusal (no error, no rows) was recorded as "synced" and
         the request/proposal change lived only in this tab until reload. A refused record stays
         different from its snapshot, so the next save() tries it again; the person is told once. */
      if(ups.length) c.from(T[sec]).upsert(ups,{onConflict:'id'}).select('id').then(function(r){
        var okIds={}; ((r&&r.data)||[]).forEach(function(x){ okIds[String(x.id)]=1; });
        if(!r.error) ups.forEach(function(u){ if(okIds[String(u.id)]) prev[u.id]=JSON.stringify(u.data); });
        var got=Object.keys(okIds).length;
        if(r.error||got<ups.length){
          var why=r.error?r.error.message:('only '+got+' of '+ups.length+' accepted');
          try{ if(typeof toast==='function') toast((typeof LANG!=='undefined'&&LANG==='ar')?('لم يُحفظ التغيير — رفضته قاعدة البيانات ('+sec+')'):('Not saved — the database refused the '+sec+' change ('+why+')')); }catch(_){}
          if(window.console) console.warn('[v59] '+sec+' sync refused: '+why);
        }
      }).catch(function(){});
      if(dels.length) c.from(T[sec]).delete().in('id',dels).select('id').then(function(r){
        var okIds={}; ((r&&r.data)||[]).forEach(function(x){ okIds[String(x.id)]=1; });
        if(!r.error) dels.forEach(function(id){ if(okIds[String(id)]) delete prev[id]; });
        if(!r.error&&Object.keys(okIds).length<dels.length&&window.console) console.warn('[v59] '+sec+' delete refused for '+(dels.length-Object.keys(okIds).length)+' record(s)');
      }).catch(function(){});
      SNAP[sec]=prev;
    });
    try{
      var sj=JSON.stringify(DB.settings||{});
      if(SNAP.__settings!==undefined && sj!==SNAP.__settings){
        c.from('app_settings').upsert({id:'main',data:JSON.parse(sj),updated_at:new Date().toISOString(),updated_by:who()},{onConflict:'id'}).then(function(r){ if(!r.error) SNAP.__settings=sj; }).catch(function(){});
      }
    }catch(_){ }
  }
  function queueSync(){ clearTimeout(_syncT); _syncT=setTimeout(syncOps,500); }
  /* 2026-09-02 (round 32): the re-assert guard above watches DB.requests's IDENTITY, because a
     late-finishing blob loader replaces the array wholesale. But so does a delete —
     `DB.requests = DB.requests.filter(...)` — and the guard could not tell the two apart. A
     request deleted in the first ~20 seconds after the page opened was therefore put straight
     back on screen 1.5 s later, restored from the load-time response, even though the DELETE
     had already reached the database: the person was looking at a row the database no longer
     had, and touching it would have written it back.
     Re-pointing the reference after every save() makes the guard mean what it was meant to
     mean — "the array was swapped by something that did not go through save()", which is the
     blob loader and nothing else. (An edit was never exposed: it assigns in place and keeps
     the identity. Only a delete replaced the array, which is why only deletes came back.) */
  function wrapSave(){ try{ var f=window.save; if(typeof f==='function'&&!f.__v59){ window.save=function(){ var o=f.apply(this,arguments); try{ window.__v59ref=DB.requests; }catch(_){} queueSync(); return o; }; window.save.__v59=true; } }catch(_){ } }
  wrapSave(); setTimeout(wrapSave,2000);
  setTimeout(loadOps,1200);
  // Backlog item since 2026-08-08: Escape now closes the open dialog.
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ try{ var m=document.getElementById('modal'); if(m&&m.offsetParent&&typeof closeModal==='function') closeModal(); }catch(_){ } } });
}catch(e){if(window.console)console.warn('[v59] init',e);}})();
