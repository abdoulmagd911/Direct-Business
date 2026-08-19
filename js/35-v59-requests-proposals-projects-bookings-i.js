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
          KEYS.forEach(function(k,i){ DB[k]=rs[i].data.map(function(r){return r.data;}); });
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
      Object.keys(prev).forEach(function(id){ if(!(id in curMap)) dels.push(id); });
      if(ups.length) c.from(T[sec]).upsert(ups,{onConflict:'id'}).then(function(r){ if(!r.error) ups.forEach(function(u){ prev[u.id]=JSON.stringify(u.data); }); }).catch(function(){});
      if(dels.length) c.from(T[sec]).delete().in('id',dels).then(function(r){ if(!r.error) dels.forEach(function(id){ delete prev[id]; }); }).catch(function(){});
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
  function wrapSave(){ try{ var f=window.save; if(typeof f==='function'&&!f.__v59){ window.save=function(){ var o=f.apply(this,arguments); queueSync(); return o; }; window.save.__v59=true; } }catch(_){ } }
  wrapSave(); setTimeout(wrapSave,2000);
  setTimeout(loadOps,1200);
  // Backlog item since 2026-08-08: Escape now closes the open dialog.
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ try{ var m=document.getElementById('modal'); if(m&&m.offsetParent&&typeof closeModal==='function') closeModal(); }catch(_){ } } });
}catch(e){if(window.console)console.warn('[v59] init',e);}})();
