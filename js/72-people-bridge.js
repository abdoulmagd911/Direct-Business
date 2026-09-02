/* ===== js/72 — people bridge: show the `contacts` and `activities` TABLES on every card =====
   2026-09-02 audit finding. The app's cards read a company's people and history from the JSON
   embedded in the business row (b.contacts / b.activities, persisted as businesses.raw). The
   corporate-clients import (2026-08-21), the Contact Submission import and the company merge
   function write people to the real `contacts` / `activities` TABLES — which no screen read.
   Live count at the time: 29 companies with people only in the table (45 people vs 7 embedded),
   30 companies with history only in the table. To the team those clients showed "No contacts
   yet".

   What this layer does, once the businesses have loaded: fetch both tables, attach each row to
   its company (by the uuid → app-id map js/02 exposes), skip anything already embedded (same
   e-mail or phone; same activity note+day), tag every attached item `_fromTable:true` so js/02
   never writes it back into raw on save (it already lives in the table), and carry the human
   flag: a contact with needs_manual_confirmation shows a "needs confirmation" badge with the
   reason (core-02 renders it). Re-runs are idempotent. Nothing here writes to the database. */
try{
(function(){
  var APPLIED={contacts:0,activities:0,runs:0}, LAST_LIST=null, TIMER=null, BUSY=false;
  window.__v72=APPLIED;
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }
  function nrm(s){ return String(s==null?'':s).toLowerCase().trim(); }
  function dig(s){ return String(s==null?'':s).replace(/\D/g,''); }
  function day(v){ try{ var d=(typeof v==='number')?new Date(v):new Date(String(v)); return isNaN(d)?'':d.toISOString().slice(0,10); }catch(_){ return ''; } }
  function uuidOf(b){ try{ return (window.__ROWID&&window.__ROWID[b.id])||b.id; }catch(_){ return b.id; } }
  function attach(contacts,activities){
    var byUuid={}; (DB.businesses||[]).forEach(function(b){ if(b) byUuid[uuidOf(b)]=b; });
    var addedC=0, addedA=0;
    (contacts||[]).forEach(function(r){
      var b=byUuid[r.business_id]; if(!b)return;
      /* 2026-09-02 (attack round 10): creating the array on a company whose stored record had none
         made the first save() of every session see that company as CHANGED and rewrite its row
         with this tab's copy (20 of 33 rows in the harness; 29 live companies) — a stale
         overwrite window on rows nobody touched. Mark the keys this layer created so js/02's
         strip can take them back out and the row compares equal to what was loaded. */
      if(!Array.isArray(b.contacts)){ b.contacts=[]; b._v72mc=1; }
      var em=nrm(r.email), ph=dig(r.phone);
      var have=b.contacts.some(function(c){ if(!c)return false; if(c._tid&&c._tid===r.id)return true; return (em&&nrm(c.email)===em)||(ph&&dig(c.phone)===ph); });
      if(have){
        // keep the badge honest on an already-attached row
        b.contacts.forEach(function(c){ if(c&&c._tid===r.id){ c.needsConfirm=!!r.needs_manual_confirmation; c.confirmReason=r.confirmation_reason||''; } });
        return;
      }
      b.contacts.push({_fromTable:true,_tid:r.id,name:r.name||'',role:r.role||'',email:r.email||'',phone:r.phone||'',needsConfirm:!!r.needs_manual_confirmation,confirmReason:r.confirmation_reason||''});
      addedC++;
    });
    (activities||[]).forEach(function(r){
      var b=byUuid[r.business_id]; if(!b)return;
      if(!Array.isArray(b.activities)){ b.activities=[]; b._v72ma=1; }
      var d=day(r.at), note=String(r.note||'');
      var have=b.activities.some(function(a){ if(!a)return false; if(a._tid&&a._tid===r.id)return true; return note===String(a.note||'')&&d===day(a.date); });
      if(have)return;
      var ts=Date.parse(r.at||''); if(isNaN(ts))ts=Date.now();
      b.activities.push({_fromTable:true,_tid:r.id,date:ts,type:r.type||'note',status:'',note:note,by:r.by_user||''});
      addedA++;
    });
    APPLIED.contacts+=addedC; APPLIED.activities+=addedA; APPLIED.runs++;
    return addedC+addedA;
  }
  function run(cb){
    var c=client(); if(!c||BUSY){ if(cb)cb(0); return; }
    if(!(DB&&Array.isArray(DB.businesses)&&DB.businesses.length)){ if(cb)cb(0); return; }
    BUSY=true;
    var got={};
    function done(){
      BUSY=false;
      var n=0;
      try{ snapFrom(got.contacts||[]); n=attach(got.contacts||[],got.activities||[]); }catch(e){ console.warn('[v72] attach',e); }
      LAST_LIST=DB.businesses;
      try{ if(n&&typeof render==='function'&&(window.openLead||window.current==='leads'||window.current==='clients'))render(); }catch(_){}
      if(cb)cb(n);
    }
    var pending=2;
    // page through in 1,000s (Supabase's default cap) — a hard .limit() would silently drop
    // everyone past it once the tables grow; the loop stops on the first short page.
    function pageAll(table,cols,key){
      var acc=[];
      function page(from){
        c.from(table).select(cols).order('id',{ascending:true}).range(from,from+999).then(function(r){
          var rows=(r&&r.data)||[]; acc=acc.concat(rows);
          if(rows.length===1000&&from<50000){ page(from+1000); return; }
          got[key]=acc; if(--pending===0)done();
        }, function(){ got[key]=acc; if(--pending===0)done(); });
      }
      page(0);
    }
    pageAll('contacts','id,business_id,name,role,email,phone,needs_manual_confirmation,confirmation_reason','contacts');
    pageAll('activities','id,business_id,type,note,by_user,at','activities');
  }
  window.v72Apply=function(cb){ run(cb); };

  /* ---- write-through (2026-09-02 attack round 5) ----
     The card's edit form hands the same contact objects back through readContacts(); a
     table-sourced one keeps its _tid, and js/02 strips it from raw on save — so an edit to it
     used to be silently lost on the next load. Now: an edited table contact is written back
     to the contacts TABLE (name/email/phone); a table contact removed from the form is not
     deleted (never delete a person silently) — it is flagged needs_manual_confirmation with
     the reason, so it shows with the badge until a human decides. */
  var SNAP={};   // _tid → {business_id,name,email,phone} as last seen from the table
  function snapFrom(rows){ (rows||[]).forEach(function(r){ SNAP[r.id]={business_id:r.business_id,name:r.name||'',email:r.email||'',phone:r.phone||''}; }); }
  function writeThrough(list){
    try{
      var c=client(); if(!c||!Array.isArray(list))return;
      var seen={}, bizOf=null;
      list.forEach(function(x){ if(!x||!x._tid||!SNAP[x._tid])return; seen[x._tid]=1; bizOf=bizOf||SNAP[x._tid].business_id;
        var s=SNAP[x._tid], nm=String(x.name||''), em=String(x.email||''), ph=String(x.phone||'');
        if(nm!==s.name||em!==s.email||ph!==s.phone){
          c.from('contacts').update({name:nm,email:em,phone:ph}).eq('id',x._tid).select('id').then(function(r){
            if(r&&r.data&&r.data.length){ SNAP[x._tid].name=nm; SNAP[x._tid].email=em; SNAP[x._tid].phone=ph; }
            else { try{ if(typeof toast==='function')toast((typeof LANG!=='undefined'&&LANG==='ar')?'تعذّر حفظ تعديل جهة الاتصال في قاعدة البيانات':'Could not save the contact edit to the database'); }catch(_){} }
          });
        }
      });
      if(bizOf){
        Object.keys(SNAP).forEach(function(tid){
          if(SNAP[tid].business_id!==bizOf||seen[tid]||SNAP[tid]._flaggedRemoved)return;
          SNAP[tid]._flaggedRemoved=true;
          var who=''; try{ who=(window.meName&&meName())||''; }catch(_){}
          c.from('contacts').update({needs_manual_confirmation:true,confirmation_reason:'Removed from the company card'+(who?(' by '+who):'')+' on '+new Date().toISOString().slice(0,10)+' — delete in the database if confirmed, or clear this flag to keep.'}).eq('id',tid).select('id').then(function(){});
        });
      }
    }catch(e){ console.warn('[v72] write-through',e); }
  }
  (function hookRead(n){
    if(typeof window.readContacts==='function'&&!window.readContacts.__v72){
      var orig=window.readContacts;
      window.readContacts=function(){ var out=orig.apply(this,arguments); writeThrough(out); return out; };
      window.readContacts.__v72=true; return;
    }
    if((n||0)<40)setTimeout(function(){hookRead((n||0)+1);},500);
  })(0);
  // first run once the businesses are in; re-run whenever the list is replaced (a reload)
  function tick(){
    try{
      if(DB&&Array.isArray(DB.businesses)&&DB.businesses.length&&DB.businesses!==LAST_LIST&&!BUSY&&window.__ROWID){ run(); }
    }catch(_){}
    TIMER=setTimeout(tick,1500);
  }
  tick();
})();
}catch(e){ console.warn('[v72] people bridge failed to load',e); }
