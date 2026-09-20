/* ===== js/90 — Activity & Audit and Archive get a button (fire #169, 2026-09-21) =====

   The app routes by address (js/03 keeps the list of valid ones) but the sidebar is built from
   somewhere else entirely, and nothing keeps the two in step. CLAUDE.md already names what that
   costs: "this is how the finance ledger sat live-but-unreachable for two days."

   Swept every routable address against the real database, signed in as an admin (who may open
   everything, so nothing was hidden by permission). Two pages draw real content and appear nowhere
   in the sidebar — not in the rail, not under either collapsed group:

     · **Activity & Audit** — 41,636 characters of page on the live data. It is the audit trail AND
       the Undo screen (js/63): the only place a change made in the last 24 hours can be reversed.
     · **Archive** — the only screen that can bring back a deleted company (js/76, built 2026-09-09
       after exactly this kind of hunt). **Four companies are archived in the live database right
       now.**

   Both are first-class everywhere else: js/56's per-person access matrix offers them by name in
   both languages, js/52 grants both to managers, `activity` is one of the three pages the database
   itself enforces, and js/63 already writes both names in English and Arabic. Only the sidebar
   never heard.

   **Correction, recorded the same day (see DECISIONS M31).** The first version of this comment said
   the two pages could only be reached by typing the address. That was wrong: **Settings ->
   "Admin & history"** links to both, with working buttons, and always has. The sweep that "proved"
   otherwise looked only at the chrome outside `#view`, so it could never see a link on a page.
   What this layer actually buys is discoverability: one click from the nav instead of three clicks
   inside Settings. Worth having, not a rescue.

   **Why not just add them to `VIEWS`.** That was tried first and did nothing, which is the useful
   part: core-08's `v25_2RestructureNav` throws the built nav away and rebuilds it from three
   hardcoded lists (`V25_PRIMARY` / `V25_REFERENCE` / `V25_READONLY`), so a `VIEWS` entry in none of
   them is simply dropped. Worse, that function matches old buttons to views BY INDEX, and js/52
   records what counting positions already cost once ("what hid Finance from an employee and showed
   them Projects instead"). So this layer does not touch `VIEWS` at all — it injects its own
   buttons after the rebuild and re-injects after every render, which is the pattern js/18 already
   uses for Finance.

   They go INSIDE the collapsed "Reference" group rather than on the rail: these are recovery
   screens, not daily-driver pages, and v25's whole design intent is a 6-8 item nav. One click to
   expand beats three clicks inside Settings, and costs the rail nothing.

   And they are hidden from anyone who may not open them, re-checked after every render — because
   js/15's gate matches nav buttons against its own older PAGES list, which predates both pages and
   would leave them showing. A button that bounces you back to Today is its own small lie; that was
   the lesson of #165's jump chips.

   Removing this file removes the two buttons and nothing else — both pages keep working by address
   exactly as they do today. */
(function(){try{
  var WANT=[
    {id:'activity', bid:'v90ActBtn',  en:'Activity & Audit', ar:'النشاط والتدقيق'},
    {id:'archive',  bid:'v90ArchBtn', en:'Archive',          ar:'الأرشيف'}
  ];
  var DOT='<span style="display:inline-block;width:18px;text-align:center">·</span>';

  function isAr(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } }
  /* Not T(): `T('activity')` answers "Activity feed" — a second, older string that wins in I18N —
     while js/56's access matrix, js/63's refusal message and the page's own title all call it
     "Activity & Audit". One page should have one name, so the name is written here, in both
     languages, matching the screen where an admin grants access to it. */
  function labelOf(w){ return isAr()?w.ar:w.en; }
  function mayOpen(id){
    try{
      if(typeof window.mayOpenPage!=='function') return true;      /* unknown never hides */
      return window.mayOpenPage(id)!==false;
    }catch(_){ return true; }
  }

  /* the Reference group: v25 writes a `.v25-more-tog` toggle followed by its wrap. The first one
     is Reference, the second is "From Direct (read-only)". */
  function referenceWrap(nav){
    try{
      var tog=nav.querySelector('button.v25-more-tog');
      if(tog && tog.nextSibling && tog.nextSibling.nodeType===1) return tog.nextSibling;
    }catch(_){}
    return null;
  }

  function mkBtn(w){
    var b=document.createElement('button');
    b.id=w.bid;
    b.setAttribute('data-v90', w.id);
    b.innerHTML=DOT+'<span class="v90-lbl">'+labelOf(w)+'</span>';
    b.style.opacity='.85'; b.style.fontSize='12.5px';
    b.onclick=function(){
      try{ current=w.id; }catch(_){}
      try{ if(typeof openLead!=='undefined')openLead=null; }catch(_){}
      try{ render(); }catch(_){}
      try{ window.scrollTo(0,0); }catch(_){}
      try{ if(typeof closeSide==='function')closeSide(); }catch(_){}
    };
    return b;
  }

  function inject(){try{
    if(window.__isShareView) return;
    var nav=document.getElementById('nav'); if(!nav) return;
    if(!nav.querySelector('button')) return;          /* nav not built yet */
    var wrap=referenceWrap(nav);
    WANT.forEach(function(w){
      var b=document.getElementById(w.bid);
      if(!b){ b=mkBtn(w); (wrap||nav).appendChild(b); }
      var on=false; try{ on=(current===w.id); }catch(_){}
      b.className=on?'active':'';
      /* .v90-lbl, not the first span — the first span is the icon, and writing the label
         into it printed every name twice (caught by driving the nav, not by reading this) */
      var sp=b.querySelector('.v90-lbl'); var want=labelOf(w);
      if(sp && sp.textContent!==want) sp.textContent=want;     /* language can change under us */
      b.style.display = mayOpen(w.id) ? '' : 'none';
    });
  }catch(e){ if(window.console)console.warn('[v90]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(inject,70); return out; };
  }
  setTimeout(inject,900);
  setTimeout(inject,2600);      /* the access matrix lands after the first paint */

  try{ window.__v90Probe=function(){ try{
    var nav=document.getElementById('nav'); if(!nav) return null;
    var seen={};
    WANT.forEach(function(w){
      var b=nav.querySelector('button[data-v90="'+w.id+'"]');
      seen[w.id]= b ? (getComputedStyle(b).display!=='none' ? 'visible' : 'hidden') : 'absent';
    });
    return seen;
  }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v90] init',e); }})();
