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
  /* 2026-09-20 (fire #111): comparing raw digit strings made the SAME Saudi number in two written
     forms look like two numbers — "0500000001" against "+966 50 000 0001" is 0500000001 vs
     966500000001 — so one person recorded locally in the company card and internationally in the
     contacts table appeared twice. probe-crm-attacks had been reporting this for a while and
     naming the remedy: reduce both to the nine significant digits, exactly as core-10's
     pdPhoneId() already does for the Direct Payments link. Same rule here, so the two agree.
     A number that is not a nine-digit Saudi one is left as its plain digits. */
  function dig(s){
    var d=String(s==null?'':s).replace(/\D/g,'');
    if(d.indexOf('00')===0)d=d.slice(2);
    if(d.indexOf('966')===0)d=d.slice(3);
    if(d.indexOf('0')===0)d=d.slice(1);
    if(d.length>9)d=d.slice(-9);
    return d;
  }
  /* a person's name, loosely: case, punctuation and doubled spaces are not a different person */
  function nrmName(s){ return String(s==null?'':s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim(); }
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
      var em=nrm(r.email), ph=dig(r.phone), nm=nrmName(r.name);
      /* 2026-09-19 (fire #109): this asked "is this person already on the card?" by matching the
         EMAIL or the PHONE alone, and answered yes for two different people who share either one.
         Measured on the live database: one company has four people recorded and the card showed
         two. Of the two it swallowed, one shares a mailbox with a colleague and one shares a phone
         number — different names in both cases, and neither is an accident: a switchboard number
         and an info@ address are exactly what a company's contacts look like. Their name, role,
         email and phone were simply gone from the app, and the master brief's rule is explicit
         that a mismatch is flagged, never silently merged.
         A shared line is now only evidence of the same person when the NAME agrees too — or when
         one side has no name to compare, which is the case this de-duplication was written for
         (the same person stored once in the company record and once in the contacts table). */
      var have=b.contacts.some(function(c){
        if(!c)return false;
        if(c._tid&&c._tid===r.id)return true;
        var cn=nrmName(c.name);
        if(nm&&cn&&nm!==cn)return false;                 // two different people — never merge them
        return (em&&nrm(c.email)===em)||(ph&&dig(c.phone)===ph);
      });
      if(have){
        // keep the badge honest on an already-attached row
        b.contacts.forEach(function(c){ if(c&&c._tid===r.id){ c.needsConfirm=!!r.needs_manual_confirmation; c.confirmReason=r.confirmation_reason||''; c.verificationSource=r.verification_source||''; } });
        return;
      }
      b.contacts.push({_fromTable:true,_tid:r.id,name:r.name||'',role:r.role||'',email:r.email||'',phone:r.phone||'',needsConfirm:!!r.needs_manual_confirmation,confirmReason:r.confirmation_reason||'',verificationSource:r.verification_source||''});
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
  /* which of the two tables did not answer on the last run — read by the card notice below and by
     js/09's "needs attention" rule, which must not read a failed load as "this company has nobody" */
  var FAILED={contacts:false,activities:false};
  try{ window.__v72Failed=function(k){ return k?FAILED[k]===true:(FAILED.contacts===true||FAILED.activities===true); }; }catch(_){}
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
    /* 2026-09-21 (fire #155, found by failing this request on purpose against the real database):
       a refused or failed page used to be indistinguishable from an empty table. r.data is null on
       an error, rows became [], and the card then said "No contacts yet." about a company that has
       a contact in the database — the same words it uses for one that genuinely has none. Somebody
       reading that adds the person again, and the app's own "needs attention" rule counts every
       company as missing its people. The failure is remembered now, and the two places that speak
       about it say so instead. */
    function pageAll(table,cols,key){
      var acc=[];
      function page(from){
        c.from(table).select(cols).order('id',{ascending:true}).range(from,from+999).then(function(r){
          if(r&&r.error){ FAILED[key]=true; got[key]=acc; if(--pending===0)done(); return; }
          var rows=(r&&r.data)||[]; acc=acc.concat(rows);
          if(rows.length===1000&&from<50000){ page(from+1000); return; }
          FAILED[key]=false; got[key]=acc; if(--pending===0)done();
        }, function(){ FAILED[key]=true; got[key]=acc; if(--pending===0)done(); });
      }
      page(0);
    }
    /* 2026-09-20 (fire #177): verification_source added. Ten of the 45 people carry a sentence
       saying where the record came from — "Contact-form submission, classified with the owner
       2026-08-16" — the same provenance #151 surfaced for companies. It was never fetched, so it
       reached nobody. js/95 draws it. */
    pageAll('contacts','id,business_id,name,role,email,phone,needs_manual_confirmation,confirmation_reason,verification_source','contacts');
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
  function snapFrom(rows){ (rows||[]).forEach(function(r){ SNAP[r.id]={business_id:r.business_id,name:r.name||'',role:r.role||'',email:r.email||'',phone:r.phone||''}; }); }
  function writeThrough(list){
    try{
      var c=client(); if(!c||!Array.isArray(list))return;
      var seen={}, bizOf=null;
      list.forEach(function(x){ if(!x||!x._tid||!SNAP[x._tid])return; seen[x._tid]=1; bizOf=bizOf||SNAP[x._tid].business_id;
        /* 2026-09-20 (fire #120) — role travels with the other three now that the form can write
           one. It is the same column the card has always printed and the same update statement. */
        var s=SNAP[x._tid], nm=String(x.name||''), rl=String(x.role||''), em=String(x.email||''), ph=String(x.phone||'');
        if(nm!==s.name||rl!==(s.role||'')||em!==s.email||ph!==s.phone){
          c.from('contacts').update({name:nm,role:rl,email:em,phone:ph}).eq('id',x._tid).select('id').then(function(r){
            if(r&&r.data&&r.data.length){ SNAP[x._tid].name=nm; SNAP[x._tid].role=rl; SNAP[x._tid].email=em; SNAP[x._tid].phone=ph; }
            else { try{ if(typeof toast==='function')toast((typeof LANG!=='undefined'&&LANG==='ar')?'تعذّر حفظ تعديل جهة الاتصال في قاعدة البيانات':'Could not save the contact edit to the database'); }catch(_){} }
          });
        }
      });
      if(bizOf){
        Object.keys(SNAP).forEach(function(tid){
          if(SNAP[tid].business_id!==bizOf||seen[tid]||SNAP[tid]._flaggedRemoved)return;
          SNAP[tid]._flaggedRemoved=true;
          var who=''; try{ who=(window.meName&&meName())||''; }catch(_){}
          c.from('contacts').update({needs_manual_confirmation:true,confirmation_reason:'Removed from the company card'+(who?(' by '+who):'')+' on '+todayISO()+' — delete in the database if confirmed, or clear this flag to keep.'}).eq('id',tid).select('id').then(function(){});
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
  /* ---- say it on the card (fire #155) ----
     Only the empty line is replaced, and only while that table's last load failed. A company that
     really has nobody keeps its ordinary "No contacts yet." — which is the point: the two states
     must stop looking the same. The notice carries a Try again that re-runs the bridge, because
     the honest answer to "we could not reach it" is usually one more attempt. */
  function v72Notice(){
    try{
      var view=document.getElementById('view'); if(!view) return;
      var ar=(typeof LANG!=='undefined'&&LANG==='ar');
      var WORDS={
        contacts:[ar?'تعذّر تحميل الأشخاص المسجّلين على هذه الجهة — قد يكون هناك من هو مسجَّل فعلًا. لا تُضف شخصًا قبل نجاح التحميل.'
                     :'Could not load the people on this record — there may well be some. Do not add anyone until this loads.',/contact|جهات|الاتصال/i],
        activities:[ar?'تعذّر تحميل سجل النشاط — قد يكون هناك نشاط مسجَّل بالفعل.'
                      :'Could not load the activity log — there may well be activity on this record.',/activity|workflow|النشاط|سجل/i]
      };
      Object.keys(WORDS).forEach(function(k){
        if(FAILED[k]!==true) return;
        var re=WORDS[k][1], msg=WORDS[k][0];
        [].slice.call(view.querySelectorAll('.card')).forEach(function(card){
          var h=card.querySelector('h3'); if(!h||!re.test(h.textContent||'')) return;
          [].slice.call(card.querySelectorAll('.empty')).forEach(function(em){
            if(em.getAttribute('data-v72notice')) return;
            em.setAttribute('data-v72notice','1');
            em.style.cssText='background:#FFF3EC;border:1px solid #F4C892;border-radius:10px;padding:9px 12px;color:#7a5c00;font-weight:600';
            em.textContent=msg+' ';
            var a=document.createElement('a');
            a.href='#'; a.style.cssText='color:#B54708;font-weight:700;text-decoration:underline';
            a.textContent=ar?'أعد المحاولة':'Try again';
            a.onclick=function(e){ try{ e.preventDefault(); }catch(_){ } try{ window.v72Apply(function(){ if(typeof render==='function')render(); }); }catch(_){ } return false; };
            em.appendChild(a);
          });
        });
      });
    }catch(e){ if(window.console)console.warn('[v72] notice',e); }
  }
  try{
    if(typeof window.render==='function'&&!window.render.__v72notice){
      var _r72=window.render;
      window.render=function(){ var out=_r72.apply(this,arguments); setTimeout(v72Notice,40); return out; };
      window.render.__v72notice=true;
    }
  }catch(_){}

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
