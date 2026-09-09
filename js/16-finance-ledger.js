/* ===== Finance ledger core — one chapter, one file (Finance sitting F3 — 2026-08-16) =====

   This is the Finance page itself (was js/16-v42). It draws all six tabs — Performance,
   Clients & collections, Ledger, Report Builder, Expenses and Import — loads the invoice
   rows out of finance_invoices, and owns the money maths every other finance chapter
   decorates.

   MUST STAY AT SLOT 16. It defines FIN, fc(), canFinEdit() and canFinView(), and three
   later chapters read them: 25 (reporting add-ons), 41 (money in) and 45 (expenses).
   The renderFinance wrap chain is 16 → 25 → 41 → 45; move this file down the list and the
   chapters above it find nothing to wrap.

   Nothing in the code below was changed in F3 — only the file's name and this comment.
   The 713 lines that follow are the same bytes that were serving the live Finance page.
   ===== v42 layer: FINANCE — master invoice ledger + report builder + import ===== */
(function(){try{
var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
var sbF=null;
function fc(){ if(!sbF&&window.supabase){try{sbF=window.supabase.createClient(SUPA_URL,SUPA_KEY);}catch(_){}} return sbF; }
function escF(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function isArF(){try{return (typeof LANG!=='undefined'&&LANG==='ar')||(document.documentElement.getAttribute('data-lang')==='ar');}catch(_){return false;}}
function money(n){n=Number(n)||0;return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
/* Table views show whole numbers (owner 2026-08-12); the exact value with fractions stays in storage, the invoice card and CSV exports. */
function money0(n){n=Number(n)||0;return Math.round(n).toLocaleString('en-US');}
/* 2026-09-08 (watch cycle 50) — THE EXACT FIGURE, WHERE A PHONE CAN READ IT.
   Cycle 49 put this under the ageing buckets, which rounded money with nothing exact anywhere.
   Asking the remaining moneyS() callers one at a time turned up a sharper rule than "which of
   these matter", because this file has already answered that question: several carry
   title="…exact…" on the element. Somebody looked at each and decided the rounded form was not
   enough. That judgement is made; it is simply delivered through a hover, and the owner reads
   Finance on a phone, where there is no hover — so on the device he actually uses "8.76M" is the
   whole answer and the exact figure he asked for is unreachable.
   The rule, which needs no per-tile argument: IF A NUMBER WAS JUDGED TO NEED ITS EXACT VALUE, IT
   NEEDS IT ON A PHONE TOO. probe-hover-only-money holds it by SCANNING for money titles rather
   than naming tiles, so a sixth added later is caught without anyone remembering.
   Printed only when the short form is a DIFFERENT NUMBER — compared as numbers, not as strings.
   Cycle 49 said it did this and did not: its numeric version was lost when a patch rolled back
   on a failed assert, leaving a string comparison that prints "4,000" under "4.0K". That is
   noise, and the commit message claiming otherwise was wrong. */
/* 2026-09-08 (watch cycle 62): the predicate below — "does the short form hide anything?" — is
   now needed twice: once to decide whether to print the exact line, and once to know WHICH figure
   a reader ends up with, so six of them can be checked against the total they belong to. One
   definition, two callers; a second copy would drift the day either is touched. */
function finShortBack(val){
  var short=moneyS(val);
  var back=Number(String(short).replace(/,/g,'').replace(/M$/,'e6').replace(/K$/,'e3'));
  return isFinite(back)?back:null;
}
function finShortHides(val){
  var back=finShortBack(val);
  return back!==null&&Math.round(back)!==Math.round(Number(val)||0);
}
/* The number the person actually reads off the card: the exact line when one is printed, and the
   shortened form when it is not. Not the stored value — that is the whole point. */
function finPrintedValue(val){
  if(finShortHides(val))return Math.round(Number(val)||0);
  var back=finShortBack(val);
  return back===null?0:back;
}
function finExactUnder(val){
  var full=money0(val);
  if(!finShortHides(val))return '';
  return '<div style="font-size:10px;color:var(--muted);font-weight:600;margin-top:1px">'+full+' SAR</div>';
}
function moneyS(n){n=Number(n)||0;if(Math.abs(n)>=1e6)return (n/1e6).toFixed(2)+'M';if(Math.abs(n)>=1e3)return (n/1e3).toFixed(1)+'K';return n.toFixed(0);}
function canFinEdit(){return !window.__isShareView && (window.__userTier==='admin'||window.__userTier==='manager');}
/* 2026-09-02 (overnight cycle, scripts/qa/probe-permissions-attacks.mjs) — js/52's access model
   REPLACES window.canFinEdit with a wrapper that returns true outright for an admin, and that
   wrapper dropped the `!window.__isShareView` half of the rule above. A read-only share link
   opened in an admin's session therefore came back as "may edit": delete an invoice, merge two
   companies, run an import. The wrapper is outside Finance's lane (it governs every page), so it
   is reported rather than rewritten — but every Finance write goes through THIS check, which
   re-applies the share-view half no matter which canFinEdit is in force. A share view is
   read-only, always. */
/* 2026-09-06 (watch cycle 32): this asked two questions — is this a share view, and does this
   person have EDIT rights — and never the third: does this person's role allow the Finance page at
   all. That is the same half that was missing from the CSV exports (cycle 30, closed by round 50),
   from the Records export (round 51) and from finRow (cycle 31); the write paths are the oldest
   surface and were the last still asking the narrow question. Measured before this change, with a
   tier that still reads 'admin' (so canFinEdit says yes) and a page access that no longer includes
   Finance (so the page refuses in words): FIVE of seven write paths still changed the database —
   delete and restore by number, delete and restore by id, and the origin editor. finMaySeeMoney()
   already covers the share view, so asking it first is a superset of the old rule, and every path
   that routes through finCanWrite is covered at once rather than one guard at a time. */
/* 2026-09-09 (watch cycle 71) - THE REFUSAL WAS CORRECT AND SILENT.
   Every Finance write routes through finCanWrite(), and all eight callers did the same thing when
   it said no: `return`. No row changed - and nothing was said. The database is safe and the person
   is told nothing at all.
   That state is not theoretical. js/65's own guard names it - "a stale tab (or a role changed
   while it was open)" - and it is the session cycle 32 measured: a TIER that still reads 'admin'
   (so canFinEdit says yes) while the person's page access no longer includes Finance. The page
   refuses that session IN WORDS. The buttons already drawn on it refuse in silence. Someone who
   presses Delete and sees the invoice still sitting there cannot tell "you may not" from "it is
   broken", so they press it again, and the app has taught them nothing either time.
   The reason is derived from the SAME three questions, in the same order, by the same function:
   finWriteBlock() returns '' when the write may proceed and a reason code when it may not, and
   finCanWrite() is that answer read as a boolean. Keeping them apart would let the guard and the
   sentence drift, which is how a person gets told "only admins may do this" while they are an
   admin - cycle 68's rule: put the change in the thing the callers share.
   The buttons are deliberately NOT re-gated to this predicate. Hiding them would make a stale tab
   quietly lose its controls with nothing said - the same silence moved somewhere harder to
   notice. A control that answers when pressed tells the person more than one that disappears. */
var FIN_BLOCK_ACCESS='access', FIN_BLOCK_SHARE='share', FIN_BLOCK_TIER='tier', FIN_BLOCK_UNKNOWN='unknown';
/* 2026-09-09 (watch cycle 72) - A TIER THAT IS NOT YET KNOWN WAS BEING READ AS A TIER THAT IS NOT
   ENOUGH. canFinEdit() is `__userTier==='admin'||__userTier==='manager'`, so an unloaded tier reads
   as no, and cycle 71's new sentence then told the person "Changing Finance data is limited to
   admins and managers" - which for an actual admin in that window is FALSE, and points them at the
   wrong fix. Cycle 71 made the refusal audible; that is how this became visible at all.
   Measured, not assumed (scripts/qa/probe-write-refusal-speaks, and a throwaway harness that timed
   the boot): on a healthy sign-in the Finance write functions exist 141 ms before __roleKnown turns
   true. With one transient error on the role lookup - the path js/02 built on purpose, "let them in
   on the floor, keep trying", hideOverlay() then setTimeout(fetchRole,5000) - the window is 5.2
   SECONDS of a fully drawn Finance page, and it repeats on every retry. Throughout it __userTier is
   `undefined`, never a string, so the two states ARE distinguishable.
   The app already knows how to make this distinction and says so in its own words: js/49's can() -
   "role not known yet - never block a real user by accident" - and js/52's known(), which js/53,
   js/55 and js/64 all gate on. Finance was the one place that collapsed them.
   The guard is NOT widened. An unknown tier still refuses, and finCanWrite() returns false in
   exactly the cases it did before: every state that reaches this question with no tier would have
   fallen through to FIN_BLOCK_TIER anyway. Only the sentence changes - from something false to
   something the person can act on. Letting an unknown tier through would be widening a write guard
   to tidy up a message, which is not a trade this lane makes. */
function finTierKnown(){
  try{ if(window.__userTier) return true; }catch(_){}        /* any tier at all is an answer - the test js/10, js/45 and js/57 already use */
  try{ if(window.__roleKnown===true) return true; }catch(_){} /* settled, per js/02, even if the tier arrived by another route */
  return false;
}
function finWriteBlock(){
  /* The share view is asked FIRST, and the order matters for the sentence even though it never
     mattered for the boolean. finMaySeeMoney() asks canFinView(), which IS `!__isShareView` — so
     with the old order (inherited from finCanWrite, where every no was the same no) a share link
     was refused as "your access no longer includes Finance", and the reason for the share link
     could never be reached at all. Measured by probe-write-refusal-speaks on its first run: all
     eight paths read out the access sentence to a share view. Asking the narrower question first
     changes no answer, only which true thing gets said. */
  try{ if(window.__isShareView) return FIN_BLOCK_SHARE; }catch(_){}
  try{ if(typeof finMaySeeMoney==='function'&&!finMaySeeMoney()) return FIN_BLOCK_ACCESS; }catch(_){}
  /* asked before the tier rule, and only when there is no answer to read: a person with a real
     tier of 'viewer' or 'team' is told the tier rule, because that IS why they were refused */
  try{ if(!finTierKnown()) return FIN_BLOCK_UNKNOWN; }catch(_){}
  try{ if(!((typeof window.canFinEdit==='function')&&window.canFinEdit())) return FIN_BLOCK_TIER; }catch(_){ return FIN_BLOCK_TIER; }
  return '';
}
/* Name the reason that actually applied. Telling an admin "only admins may do this" is worse than
   saying nothing: it is a sentence they can prove wrong, and it sends them to the wrong person. */
function finBlockMsg(why){
  var ar=isArF();
  if(why===FIN_BLOCK_SHARE)
    return ar?'\u0647\u0630\u0627 \u0631\u0627\u0628\u0637 \u0645\u0634\u0627\u0631\u0643\u0629 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637\u060c \u0641\u0644\u0645 \u064a\u064f\u0646\u0641\u0651\u0630 \u0647\u0630\u0627 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0648\u0644\u0645 \u064a\u062a\u063a\u064a\u0651\u0631 \u0634\u064a\u0621 \u0641\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.'
            :'This is a read-only share link, so the change was not made and nothing in the data changed.';
  if(why===FIN_BLOCK_UNKNOWN)
    return ar?'\u0644\u0645 \u064a\u0646\u062a\u0647 \u062a\u062d\u0645\u064a\u0644 \u0645\u0633\u062a\u0648\u0649 \u0635\u0644\u0627\u062d\u064a\u062a\u0643 \u0628\u0639\u062f\u060c \u0641\u0644\u0645 \u064a\u064f\u0646\u0641\u0651\u0630 \u0647\u0630\u0627 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0648\u0644\u0645 \u064a\u062a\u063a\u064a\u0651\u0631 \u0634\u064a\u0621 \u0641\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a. \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0628\u0639\u062f \u0644\u062d\u0638\u0629 - \u0648\u0625\u0646 \u062a\u0643\u0631\u0631 \u0630\u0644\u0643 \u0641\u0623\u0639\u062f \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629.'
            :'Your access level has not finished loading, so the change was not made and nothing in the data changed. Try again in a moment - if it keeps happening, reload the page.';
  if(why===FIN_BLOCK_ACCESS)
    return ar?'\u0644\u0645 \u062a\u0639\u062f \u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0645\u062a\u0627\u062d\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629\u060c \u0641\u0644\u0645 \u064a\u064f\u0646\u0641\u0651\u0630 \u0647\u0630\u0627 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0648\u0644\u0645 \u064a\u062a\u063a\u064a\u0651\u0631 \u0634\u064a\u0621 \u0641\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a. \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u062f\u062e\u0648\u0644\u0643 \u0644\u0645 \u062a\u0639\u062f \u062a\u0634\u0645\u0644 \u0627\u0644\u0645\u0627\u0644\u064a\u0629 - \u0627\u0637\u0644\u0628 \u0625\u0639\u0627\u062f\u062a\u0647\u0627 \u062b\u0645 \u0623\u0639\u062f \u0641\u062a\u062d \u0627\u0644\u0635\u0641\u062d\u0629.'
            :'The Finance page is no longer open to this session, so the change was not made and nothing in the data changed. Your access no longer includes Finance - ask for it back, then reopen the page.';
  return ar?'\u062a\u0639\u062f\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0645\u062a\u0627\u062d \u0644\u0644\u0645\u062f\u0631\u0627\u0621 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644\u064a\u0646 \u0641\u0642\u0637\u060c \u0641\u0644\u0645 \u064a\u064f\u0646\u0641\u0651\u0630 \u0647\u0630\u0627 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0648\u0644\u0645 \u064a\u062a\u063a\u064a\u0651\u0631 \u0634\u064a\u0621 \u0641\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.'
          :'Changing Finance data is limited to admins and managers, so the change was not made and nothing in the data changed.';
}
function finCanWrite(){ return finWriteBlock()===''; }
/* Ask, and SAY SO when the answer is no. Returns true when the caller must stop, so a caller reads
   `if(finRefuseWrite())return;` - the same shape as the silent guard it replaces. */
function finRefuseWrite(){
  var why=finWriteBlock();
  if(!why) return false;
  try{ alert(finBlockMsg(why)); }catch(_){}
  return true;
}
try{ window.finCanWrite=finCanWrite; window.finWriteBlock=finWriteBlock; window.finRefuseWrite=finRefuseWrite; }catch(_){}
function canFinView(){return !window.__isShareView;}
/* 2026-09-06 (round 50) — watch cycle 30 gave the three CSV exports a guard, and it closed half
   the case it described. canFinView() asks ONE question: is this a read-only share link. But the
   Finance page is refused for a second reason as well — a ROLE that does not allow it, enforced by
   js/49's mayOpen('finance') and js/64. Measured on the merged tree: with a role that denies
   Finance and no share view, the page refuses in words ("You do not have access to that page")
   while canFinView() returns true and finLedgerCSV still produced 16 rows and finTxnCSV 4.
   That is precisely the stale-tab shape cycle 30 set out to close — "a role changed while it was
   open" — and it is the likelier half of it: a revoked role is an ordinary event, a share link is
   the rarer one. The exports ask both questions now. Kept as its own helper rather than widened
   into canFinView(), because canFinView() also drives the page's own share-view wording (and
   js/45 / js/57 read it), and a role-denied person should get js/49's message, not that one.
   Unknown answers never block, matching mayOpen's own rule. */
/* 2026-09-06 (watch cycle 31): round 50 built the two-question check below for the CSV exports,
   and the name describes its first caller rather than the question it asks. The question — "may
   this session see Finance's money at all" — is not specific to a file: finRow() prints one
   invoice's total, cost, revenue, profit, received and remaining into a modal, and had no check
   of its own. So the predicate is named for the question and finMayExport delegates to it, which
   leaves round 50's name, its callers and its probe exactly as they were. */
function finMaySeeMoney(){
  try{ if(typeof canFinView==='function'&&!canFinView())return false; }catch(_){}
  try{ if(typeof window.__v73MayOpen==='function'&&!window.__v73MayOpen('finance'))return false; }catch(_){}
  return true;
}
try{ window.finMaySeeMoney=finMaySeeMoney; }catch(_){}
function finMayExport(){ return finMaySeeMoney(); }
try{ window.finMayExport=finMayExport; }catch(_){}
/* expose the finance client + permission checks so later layers (e.g. the finance↔client
   mapping in v53) can reach them from their own script block */
try{ window.fc=fc; window.canFinEdit=canFinEdit; window.canFinView=canFinView; }catch(_){}

var FIN={tab:'overview',rows:null,loading:false,showDeleted:false,
  f:{q:'',quarter:'all',month:'all',service:'all',client:'all',status:'verified_paid'},
  rb:{g1:'__client',g2:'',metrics:{revenue_sar:true,cost_sar:true,profit_sar:true},verifiedOnly:true,quarter:'all'}};

try{
  if(typeof TITLES==='object')TITLES.finance=['Finance','Master invoice ledger \u00b7 report builder \u00b7 audited H1 2026 data'];
  if(typeof I18N==='object'){I18N.en&&(I18N.en.finance='Finance');I18N.ar&&(I18N.ar.finance='\u0627\u0644\u0645\u0627\u0644\u064a\u0629');}
  if(typeof V21_STRINGS_AR==='object'){V21_STRINGS_AR['Finance']='\u0627\u0644\u0645\u0627\u0644\u064a\u0629';V21_STRINGS_AR['Report Builder']='\u0645\u0646\u0634\u0626 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631';V21_STRINGS_AR['Ledger']='\u0627\u0644\u0633\u062c\u0644';V21_STRINGS_AR['Overview']='\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629';V21_STRINGS_AR['Import']='\u0627\u0633\u062a\u064a\u0631\u0627\u062f';}
  if(typeof VIEWS!=='undefined'&&VIEWS.push&&!VIEWS.some(function(v){return v.id==='finance';})){
    var ic='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
    var ix=VIEWS.findIndex(function(v){return v.id==='events';});
    VIEWS.splice(ix>=0?ix+1:VIEWS.length,0,{id:'finance',label:'Finance',ic:ic,primary:true});
  }
}catch(e){console.warn('v42 nav',e);}

/* 2026-09-03 (watch cycle 13): ONE paging helper for the whole Finance lane.
   The API returns at most 1000 rows per request no matter what the client asks for, and says so
   only in a Content-Range header nobody reads — so a read that does not page returns a clean,
   plausible, WRONG answer: the first 1000 rows presented as the whole table. finLoad() has paged
   since August; txnLoad() and five other reads in this lane did not, which meant the Ledger's own
   totals (confirmed revenue, cost, outstanding, the Overdue count) were computed from whatever
   1000 transactions came back first, with nothing on screen admitting it. mk() must return a
   FRESH query builder each call — a PostgREST builder is single-use. */
function finPageAll(mk, cb){
  var all=[];
  (function _page(from){
    var q; try{ q=mk(); }catch(e){ cb({data:null,error:e}); return; }
    q.range(from, from+999).then(function(r){
      if(r&&r.error){ cb({data:null,error:r.error}); return; }
      var d=(r&&r.data)||[];
      all=all.concat(d);
      if(d.length===1000)_page(from+1000); else cb({data:all,error:null});
    }, function(e){ cb({data:null,error:e}); });
  })(0);
}
try{ window.finPageAll=finPageAll; }catch(_){}

function finLoad(cb){
  if(FIN.loading)return; FIN.loading=true;
  var c=fc(); if(!c){FIN.loading=false;return;}
  // The API returns at most 1000 rows per request no matter what limit() asks for,
  // so the ledger MUST page — one big limit() silently drops rows past 1000.
  finPageAll(function(){return c.from('finance_invoices').select('*').order('invoice_date',{ascending:false}).order('id',{ascending:true});}, finGot);
  function finGot(r){
    if(r.error){console.warn('finance load',r.error);FIN.rows=[];FIN.loadErr=r.error.message;}
    else {FIN.rows=r.data||[];FIN.loadErr=null;}
    // Load the client↔finance links (one row per finance client_group → a real client, or
    // is_client=false for individuals). This is the join key so a client's money reflects by
    // ID, not by fuzzy name. Small table; build lookup maps once loaded.
    finPageAll(function(){return c.from('finance_client_links').select('*').order('id',{ascending:true});}, function(lr){
      FIN.loading=false;
      FIN.links=(lr&&!lr.error&&lr.data)?lr.data:[];
      FIN.linkByGroup={}; FIN.groupsByBiz={};
      FIN.links.forEach(function(l){
        FIN.linkByGroup[l.client_group]=l;
        if(l.business_id){ (FIN.groupsByBiz[l.business_id]=FIN.groupsByBiz[l.business_id]||[]).push(l.client_group); }
      });
      // the sector key: business_id -> profile_type, so finSectorOf can prefer the explicit field
      finPageAll(function(){return c.from('client_profiles').select('id,business_id,profile_type,status').order('id',{ascending:true});}, function(cp){
        FIN.profileTypeByBiz={};
        ((cp&&!cp.error&&cp.data)||[]).forEach(function(x){
          if(!x||!x.business_id)return;
          // an archived or closed profile must not decide a sector; only a live one does
          if(x.status&&String(x.status).toLowerCase()!=='active')return;
          FIN.profileTypeByBiz[x.business_id]=x.profile_type||null;
        });
        try{ if(typeof clearFinCanon==='function')clearFinCanon(); }catch(_){}
      });
      finPageAll(function(){return c.from('finance_targets').select('*').order('year',{ascending:true});}, function(tr){
        FIN.targets=(tr&&!tr.error&&tr.data)?tr.data:[];
        // Promo-code registry (revenue way #4): per-code totals mirrored from Direct Payments.
        finPageAll(function(){return c.from('promo_codes').select('*').order('total_sales_sar',{ascending:false}).order('code',{ascending:true});}, function(pr){
          FIN.promos=(pr&&!pr.error&&pr.data)?pr.data:[];
          if(cb)cb();
          try{if(current==='finance')render();}catch(_){}
        });
      });
    });
  }
}
try{window.FIN=FIN;window.finLoad=finLoad;}catch(_){}  // expose for the Customer-360 finance snapshot (v29)
/* 2026-09-02 (attack round 11): live() is THE chokepoint — soft-deleted rows out, the standing
   exclusion applied, money sanitised. Other layers that read FIN.rows directly bypassed all of
   that (the Link-finance dialog listed an excluded partner as a group to link). Shared here so
   they read through the same gate. */
try{window.finLive=function(){return live();};}catch(_){}
// Belt-and-suspenders, 2026-08-23: the exclusion list (js/62) was checked at IMPORT time
// only. Ten Takamol invoices entered finance_invoices anyway — not through either
// importer's exclusion check, but by a path outside this app entirely — and rendered in
// every total until caught and removed by hand. A standing exclusion must hold no matter
// how a row arrived, so live() — the one chokepoint every total/export in this file reads
// through — re-checks client_group/customer_raw_name against the exclusion list on every
// call, not just once at load. Filtering here (not in the load callback) also survives the
// real race that a load-time-only filter did not: on a fresh page load, finance_invoices
// can finish loading before DB.settings.financeExclusions does, so a filter that only runs
// once inside the load callback can silently see an empty exclusion list and let a row
// through on that first render; live() re-evaluates on every call, by which point settings
// have always finished loading. docs/DECISIONS.md: "A standing exclusion is not satisfied
// by loading the data and labelling it."
/* Money-field sanity at the one chokepoint (2026-09-02, watch cycle 2 — found by
   probe-overview-attacks): every total in this file did `sum += +r.revenue_sar`. One row with the
   key ABSENT (+undefined) or a string with a thousands separator ("1,000.00") turns the running
   sum into NaN, and money()/moneyS() then coerce NaN to 0 — so a single malformed row silently
   showed Revenue / Cost / Profit as a clean 0.00 for the whole company, nothing on screen saying
   why. Supabase returns numeric columns as numbers or null, so the real-data path was safe; rows
   pushed into FIN.rows by an import preview or another layer are not guaranteed to be. Rule:
   read every money field through here — absent/null → 0, "1,250.50" → 1250.5, anything that
   still isn't a finite number → 0 AND the row is flagged (r._badMoney) so the Overview can say
   "N rows had unreadable amounts" instead of quietly under-counting. */
var MONEY_FIELDS=['total_incl_vat_sar','revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','wallet_portion_sar','vat_sar'];
function finSanitizeMoney(r){
  var bad=null;
  for(var i=0;i<MONEY_FIELDS.length;i++){
    var k=MONEY_FIELDS[i], v=r[k];
    if(v==null||v===''){ r[k]=0; continue; }
    if(typeof v==='number'){ if(!isFinite(v)){ r[k]=0; (bad=bad||[]).push(k); } continue; }
    var n=parseFloat(String(v).replace(/[,\s]/g,''));
    if(isFinite(n)&&/^-?[\d.,\s]+$/.test(String(v).trim())) r[k]=n; else { r[k]=0; (bad=bad||[]).push(k); }
  }
  // Sticky on purpose: the first pass rewrites the bad value to 0, so a second pass would see a
  // clean number and — if this cleared the flag — erase the only evidence. A reload brings fresh rows.
  if(bad) r._badMoney=bad;
  return r;
}
function live(){
  var rows=(FIN.rows||[]).filter(function(r){return !r.deleted_at;});
  if(typeof window.finExclusionCheck==='function'){
    rows=rows.filter(function(r){return !(finExclusionCheck(r.client_group)||finExclusionCheck(r.customer_raw_name));});
  }
  for(var i=0;i<rows.length;i++)finSanitizeMoney(rows[i]);
  return rows;
}
try{ window.finSanitizeMoney=finSanitizeMoney; }catch(_){}
function verified(){return live().filter(function(r){return r.integrity_status==='verified_paid';});}

/* --- Period structure (owner-directed 2026-08-11) ------------------------------------
   Finance is read monthly / quarterly / half-yearly / annually. ONE period state drives
   every Overview number; nothing is stored per period — all sums stay derived live from
   the raw rows (the storage doctrine). part: all | Q1..Q4 | H1 | H2 | M:<MonthName>. */
FIN.p=FIN.p||{year:'all',part:'all',sector:'all'};
FIN.p.cmp=FIN.p.cmp||'none'; // blueprint step 5 (2026-08-27): compare-to mode, in-memory only — same storage doctrine as the rest of FIN.p, nothing per-period is ever saved.
function finYearOf(r){return r.year||(r.invoice_date?+String(r.invoice_date).slice(0,4):null);}
/* 2026-09-08 (watch cycle 65): finYearOf has always fallen back to the invoice date when a row
   carries no year, and it has to — js/16's OWN B2B import writes invoice_date, month and quarter
   and never a year, so without the fallback every row it wrote would drop out of every year.
   That same import writes `month:o.month, quarter:o.quarter` straight off the parsed file, so a
   file with no Month/Quarter column produces a row that HAS a date and no quarter. Quarter and
   month had no fallback, so that row counted in "All periods" and in its year and vanished from
   every quarter, half and month: Q1+Q2+Q3+Q4 came to less than the year they partition, with
   nothing saying which money went missing. One field defended, two not, from the same source.
   Derived from the date, never invented: a row with NO date still belongs to no period, which is
   rule M8 and is what the probe's fourth check holds this to. A stored value always wins — this
   only fills a gap, it never overrules what the row says about itself. */
/* 2026-09-09 (watch cycle 70): the derivation itself, named once. finMonthOf/finQuarterOf answer
   "which period does this row belong to" (stored first — see cycle 65); these two answer "what does
   the DATE say", which is a different question and the only way to notice the two disagreeing.
   One definition, three callers; a second copy would drift the day either is touched (cycle 68). */
function finMonthFromDate(date){
  if(!date)return null;
  var mi=+String(date).slice(5,7);
  return (mi>=1&&mi<=12)?['January','February','March','April','May','June','July','August','September','October','November','December'][mi-1]:null;
}
function finQuarterFromDate(date){
  if(!date)return null;
  var mi=+String(date).slice(5,7);
  return (mi>=1&&mi<=12)?('Q'+(Math.floor((mi-1)/3)+1)):null;
}
function finMonthOf(r){ return r.month||finMonthFromDate(r.invoice_date); }
function finQuarterOf(r){ return r.quarter||finQuarterFromDate(r.invoice_date); }
/* A row that carries BOTH a date and a stored period which disagree with it. The stored value
   wins everywhere (cycle 65 decided that deliberately: overruling it would move money on the
   say-so of a date that might be the wrong field), so this only ever counts — it never changes
   what any figure includes. */
function finPeriodDisagrees(r){
  if(!r||!r.invoice_date)return false;
  var dm=finMonthFromDate(r.invoice_date), dq=finQuarterFromDate(r.invoice_date);
  if(!dm||!dq)return false;
  return !!((r.month&&r.month!==dm)||(r.quarter&&r.quarter!==dq));
}
try{ window.finPeriodDisagrees=finPeriodDisagrees; window.finMonthFromDate=finMonthFromDate; window.finQuarterFromDate=finQuarterFromDate; }catch(_){}
function finPeriodMatch(r,p){
  if(p.year!=='all'&&String(finYearOf(r))!==String(p.year))return false;
  var pt=p.part||'all';
  if(pt==='all')return true;
  var q=finQuarterOf(r);
  if(pt==='H1')return q==='Q1'||q==='Q2';
  if(pt==='H2')return q==='Q3'||q==='Q4';
  if(/^Q[1-4]$/.test(pt))return q===pt;
  if(pt.indexOf('M:')===0)return finMonthOf(r)===pt.slice(2);
  return true;
}
try{ window.finMonthOf=finMonthOf; window.finQuarterOf=finQuarterOf; }catch(_){}
function finInPeriod(r){
  return finPeriodMatch(r,FIN.p||{year:'all',part:'all'});
}
/* Compare-to (blueprint step 5, 2026-08-27): "previous period" and "same period last year",
   the two the owner actually asked for — "pick a period" is left for a later pass rather than
   guessed at. Needs a concrete year to shift from, so it's a no-op (returns null, control hides
   its result) when the year filter is 'all'; "the year before all years" isn't a period. */
function finCompPeriodOf(mode){
  var p=FIN.p||{}; if(!p.year||p.year==='all')return null;
  var y=+p.year, pt=p.part||'all';
  if(mode==='yoy')return {year:y-1,part:pt,sector:p.sector};
  if(mode==='prev'){
    if(pt==='all')return {year:y-1,part:'all',sector:p.sector};
    if(pt==='H1')return {year:y-1,part:'H2',sector:p.sector};
    if(pt==='H2')return {year:y,part:'H1',sector:p.sector};
    if(/^Q[1-4]$/.test(pt)){var qn=+pt.slice(1);return qn===1?{year:y-1,part:'Q4',sector:p.sector}:{year:y,part:'Q'+(qn-1),sector:p.sector};}
    if(pt.indexOf('M:')===0){
      var mname=pt.slice(2),idx=MOI[mname]; if(!idx)return null;
      var pm=idx===1?12:idx-1, py=idx===1?y-1:y;
      var pname=Object.keys(MOI).filter(function(k){return MOI[k]===pm;})[0];
      return pname?{year:py,part:'M:'+pname,sector:p.sector}:null;
    }
  }
  return null;
}
try{ window.finCompPeriodOf=finCompPeriodOf; }catch(_){}   // exposed 2026-09-02 so scripts/qa/probe-compare-attacks.mjs can check every period shape directly
function finCompLabel(p){
  if(!p)return '';
  var ar=isArF();
  var pt=(p.part==='all')?(ar?'كامل الفترة':'Full period'):(p.part.indexOf('M:')===0?(ar?(MO_AR[p.part.slice(2)]||p.part.slice(2)):p.part.slice(2)):p.part);
  return p.year+' · '+pt;
}
/* Same aggregate a comparison period needs — revenue/cost/profit off verified-paid rows (the
   Key indicators basis), plus the incomplete-cost count so the comparison can carry the same
   A7 warning the current period already shows. Never touches FIN.p itself, so building a
   comparison can't disturb what's actually on screen. */
function finPeriodTotals(p){
  var sec=(p&&p.sector)||'all';
  var rows=verified().filter(function(r){return finPeriodMatch(r,p)&&(sec==='all'||finSectorOf(r)===sec);});
  var t={rev:0,cost:0,prof:0,n:rows.length,noCost:0};
  rows.forEach(function(r){t.rev+=+r.revenue_sar||0;t.cost+=+r.cost_sar||0;t.prof+=+r.profit_sar||0;if((+r.cost_sar||0)===0)t.noCost++;});
  return t;
}
window.finCmp=function(v){FIN.p.cmp=v;render();};
/* Sector filter rides the same scope check every tab already uses, so picking a sector
   filters KPIs, charts, clients, ledger and exports alike — scope is a page property. */
var _finInPeriodBase=finInPeriod;
finInPeriod=function(r){
  if(!_finInPeriodBase(r))return false;
  var sec=(FIN.p&&FIN.p.sector)||'all';
  return sec==='all'||finSectorOf(r)===sec;
};
var MO_AR={January:'يناير',February:'فبراير',March:'مارس',April:'أبريل',May:'مايو',June:'يونيو',July:'يوليو',August:'أغسطس',September:'سبتمبر',October:'أكتوبر',November:'نوفمبر',December:'ديسمبر'};
function finPeriodLabel(){
  var p=FIN.p,ar=isArF();
  var y=(p.year==='all')?(ar?'كل السنوات':'All years'):p.year;
  var pt=(p.part==='all')?(ar?'كامل الفترة':'Full period')
    :(p.part.indexOf('M:')===0?(ar?(MO_AR[p.part.slice(2)]||p.part.slice(2)):p.part.slice(2)):p.part);
  return y+' · '+pt;
}
window.finPY=function(v){FIN.p.year=v;render();};
window.finPP=function(v){FIN.p.part=v;render();};
/* 2026-09-02 (overnight cycle, scripts/qa/probe-targets-attacks.mjs) — the old parser was
   `parseFloat(String(s).replace(/[^0-9.]/g,''))||0`, which SILENTLY changed what the person
   typed: Arabic-Indic digits (١٥٠٠٠٠٠) became 0 in an app that is half-Arabic, "1e6" became
   16, any text became 0, and "-500" became +500. A target nobody typed is a fabricated number
   (M8). This reads the same digits the importer already reads (js/65 asciiDigits) and REFUSES
   anything that is not a plain amount, naming the box — it never guesses. Empty stays a
   deliberate "clear to 0". */
function finTargetNum(sv){
  var AR={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٫':'.','٬':','};
  var s=String(sv==null?'':sv).replace(/[٠-٩۰-۹٫٬]/g,function(c){return AR[c]||c;}).trim();
  s=s.replace(/[\s,\u00a0]/g,'').replace(/(?:SAR|ر\.?س|ريال)$/i,'');
  if(s==='')return 0;
  if(!/^\d+(\.\d+)?$/.test(s))return null;   // no exponents, no minus, no stray text
  var n=parseFloat(s); return isFinite(n)?n:null;
}
try{ window.finTargetNum=finTargetNum; }catch(_){}
window.finSetTargets=function(y){try{
  if(finRefuseWrite())return;   // the button is already gated; guard the function too, like finDelInv
  var t=(FIN.targets||[]).find(function(x){return +x.year===+y;})||{};
  var e=prompt(isArF()?('الإيراد المتوقع لسنة '+y+' (ريال):'):('Expected revenue for '+y+' (SAR):'), t.expected_sar||''); if(e===null)return;
  var cf=prompt(isArF()?('الإيراد المؤكد (عقود موقعة) لسنة '+y+':'):('Confirmed revenue (signed contracts) for '+y+' (SAR):'), t.confirmed_sar||''); if(cf===null)return;
  var _e=finTargetNum(e), _c=finTargetNum(cf);
  if(_e===null||_c===null){
    var _bad=(_e===null)?(isArF()?'«الإيراد المتوقع»':'"Expected revenue"'):(isArF()?'«الإيراد المؤكد»':'"Confirmed revenue"');
    alert(isArF()
      ?('لم يُحفظ — '+_bad+' ليست مبلغًا مقروءًا: "'+String(_e===null?e:cf)+'". اكتب رقمًا موجبًا (الفواصل والأرقام العربية مقبولة). لم يتغير شيء.')
      :('Not saved — '+_bad+' is not a readable amount: "'+String(_e===null?e:cf)+'". Type a positive number (commas and Arabic digits are fine). Nothing changed.'));
    return;
  }
  var num=function(){ return 0; };   // kept out of reach: every value below is already parsed
  var c=fc(); if(!c)return;
  /* B2 / M13 shape (fixed 2026-09-02): a write without .select() + a row-count check reports
     success even when Row-Level Security silently refused it — the screen would then show the
     new target while the database still held the old one. Every write in this file now asks
     for the rows back and refuses to update the screen unless the database confirmed them. */
  /* 2026-09-03 (watch cycle 19) — measured in watch cycle 15 and parked: two people setting the
     same year's target is last-write-wins, and the first person was never told. One row, no
     corruption, so nothing was broken — but a number someone typed can be replaced by a number
     someone else typed and neither of them ever knows. Read the stored row first: if it has moved
     since this tab loaded it, say so and let the person decide, rather than overwriting in
     silence. This is a WARNING, not a lock — the owner has never asked for one, and a lock on a
     single yearly figure would cost more than it saves. */
  c.from('finance_targets').select('year,expected_sar,confirmed_sar,updated_by').eq('year',+y).then(function(pre){
    var stored=(pre&&!pre.error&&pre.data&&pre.data[0])||null;
    var mine=(FIN.targets||[]).find(function(x){return +x.year===+y;})||null;
    var moved=!!(stored&&mine&&(Number(stored.expected_sar)!==Number(mine.expected_sar)||Number(stored.confirmed_sar)!==Number(mine.confirmed_sar)));
    if(!moved) return _finTargetWrite(c,y,_e,_c);
    var who=stored.updated_by?(' ('+stored.updated_by+')'):'';
    var msg=isArF()
      ? ('\u062a\u063a\u064a\u0651\u0631 \u0647\u062f\u0641 '+y+' \u0628\u064a\u0646\u0645\u0627 \u0643\u0627\u0646\u062a \u0634\u0627\u0634\u062a\u0643 \u0645\u0641\u062a\u0648\u062d\u0629'+who+': \u0627\u0644\u0645\u062e\u0632\u0651\u0646 \u0627\u0644\u0622\u0646 '+money(stored.expected_sar)+' / '+money(stored.confirmed_sar)+'. \u0647\u0644 \u062a\u0633\u062a\u0628\u062f\u0644\u0647 \u0628\u0645\u0627 \u0643\u062a\u0628\u062a\u061f')
      : ('The '+y+' target changed while your screen was open'+who+': it now holds '+money(stored.expected_sar)+' expected / '+money(stored.confirmed_sar)+' confirmed. Replace it with what you just typed?');
    finConfirm(msg,function(){ _finTargetWrite(c,y,_e,_c); });
  },function(){
    /* 2026-09-03 (watch cycle 19): if the pre-read itself fails, the save must still go ahead —
       found by the probe, whose refusal test went silent because a rejected read left this chain
       with nowhere to go and finSetTargets quietly did nothing at all. The write has its own
       row-count check (M13), so proceeding is safe; refusing to write because a courtesy read
       failed would be a worse answer than the problem it guards. */
    _finTargetWrite(c,y,_e,_c);
  });
}catch(e){console.warn('finSetTargets',e);}};
function _finTargetWrite(c,y,_e,_c){
  var isArF2=isArF;
  c.from('finance_targets').upsert({year:+y,expected_sar:_e,confirmed_sar:_c,updated_at:new Date().toISOString(),updated_by:(window.meName?meName():'')},{onConflict:'year'}).select('year').then(function(r){
    if(r.error){alert((isArF()?'تعذر الحفظ: ':'Could not save: ')+r.error.message);return;}
    if(!r.data||!r.data.length){alert(isArF()?'لم يُحفظ — رفضت قاعدة البيانات الكتابة (صلاحيات). لم يتغير شيء.':'Not saved — the database refused the write (permissions). Nothing changed.');return;}
    var i=(FIN.targets||[]).findIndex(function(x){return +x.year===+y;});
    var row={year:+y,expected_sar:_e,confirmed_sar:_c};
    if(i>=0)FIN.targets[i]=row;else (FIN.targets=FIN.targets||[]).push(row);
    render();
  });
}
try{ window._finTargetWrite=_finTargetWrite; }catch(_){}
/* UNREACHABLE FROM THE UI (established 2026-09-08, watch cycle 61). No button, no menu and no
   other file calls window.finLedgerCSV — the whole repo mentions the name only in comments and
   in one probe. The Ledger tab's own "Excel (CSV)" button is finTxnCSV (transactions), and the
   Records page's finance export reads FIN._csvRows directly rather than calling this. So this
   function's role guard, its Arabic header path and the probe coverage on it are all about a
   file nobody can produce by pressing anything. Cycle 56's rule applies: "unreachable" is a more
   honest answer than "low-risk", and saying so is cheaper than leaving the next reader to
   rediscover it. Kept, not deleted — probe-access-truth exercises it, and it is the obvious
   thing to wire up if the Ledger is ever asked for a row-level invoice export.
   ONE THING TO FIX FIRST IF IT IS EVER WIRED UP: FIN._csvRows is live().filter(finInPeriod) —
   the period bar ONLY. It does not carry the client scope or any other filter the person has
   set, so a button on it would export more than the screen is showing, which is this very
   function's oldest defect (see below). The same applies today to the Records page's finance
   export, whose own comment claims FIN._csvRows is "the currently-filtered Ledger rows". It is
   not. That file is not this session's to edit; the claim is logged in docs/BACKLOG.md.

   Ledger's own row-level export. Named finLedgerCSV (not finCSV) on purpose — this file also
   defines the Report Builder's export further down, and until 2026-08-20 both were called
   window.finCSV, so the second definition silently replaced this one and the Ledger's own
   "Excel (CSV)" button either did nothing or downloaded the Report Builder's grouped summary
   instead of the invoice rows on screen. Two different jobs, two different names. */
window.finLedgerCSV=function(){
  /* 2026-09-06 (watch cycle 30): the READ-OUT paths had no check of their own. Cycle 12 found
     and closed exactly this shape on all ten Finance WRITE paths — "a stale tab, a role changed
     while it was open, or a share view leaves the function one call away" — and the exports were
     never looked at. They build a file out of state the page filled in while it was still allowed
     to render, so a tab that was an admin's a moment ago hands over every invoice, every
     transaction and the whole report to a session the page itself now refuses in words. Same rule
     as the screen: canFinView() is what rFinance checks before it will render at all. This is not
     claimed as a boundary against someone reading the rows out of devtools — the rows are already
     in the tab — only that pressing something must not produce Finance's file for a person
     Finance is refused to. */
  if(typeof finMayExport==='function'&&!finMayExport()){alert(isArF()?'التصدير غير متاح لهذه الصلاحية.':'Export is not available for this access level.');return;}
  var L=FIN._csvRows||[]; if(!L.length){alert(isArF()?'لا صفوف للتصدير':'No rows to export');return;}
  var cols=['invoice_date','invoice_no','zatca_dpin','client_group','service_type','products','origin','proposal_ref','month','quarter','year','total_incl_vat_sar','revenue_sar','cost_sar','profit_sar','amount_received_sar','amount_remaining_sar','integrity_status'];
  var _hdr=cols.map(function(c){return c==='total_incl_vat_sar'?'invoice_total_sar':c;});
  /* 2026-09-02 (attack round 9): in Arabic the titles come from the same Arabic label map the
     shared exporters use (js/73) — "رقم الفاتورة (invoice_no)" — with the raw key as fallback. */
  try{ if(isArF()&&window.__v73&&window.__v73.label) _hdr=_hdr.map(function(c){return window.__v73.label(c);}); }catch(_){}
  var csv='\ufeff'+_hdr.join(',')+'\n'+L.map(function(r){return cols.map(function(c){var v=csvGuard(r[c]);return '"'+v.replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-finance-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};
try{window.finInPeriod=finInPeriod;window.finPeriodLabel=finPeriodLabel;}catch(_){}

/* --- Canonical client rollup (v54) ---------------------------------------------------
   A finance invoice carries a raw `client_group` name (however it was typed in Direct
   Payments). `finance_client_links` maps each group to ONE real client (business_id), to
   Individuals, or to nothing yet. finCanon() collapses every group that points at the same
   client into a single canonical row, so the client reports stay correct after two spellings
   of the same company are linked (e.g. "Ma'aden" + "Maaden Co" become one client). The
   row-level Ledger deliberately stays on the raw group — it is an invoice list, not a rollup.
   Cache is rebuilt each finance render (clearFinCanon) since a mapping edit reloads FIN. */
var _finCanonCache={};
/* Freeze found 2026-08-22 (owner reproduced twice): _finBizName did an O(businesses.length)
   linear scan, called once per invoice row via finCanon() — O(rows x businesses) on every
   Clients/Overview/Report-Builder finance render. Indexed once per cache lifetime instead,
   invalidated on the exact same clearFinCanon() calls the existing _finCanonCache already
   relies on, so this can never go stale independently of that cache. */
var _finBizNameIndex=null;
/* Sector, 2026-08-26 — blueprint step 4, built the M14 way: DERIVED AT RENDER from data the
   app already holds, no schema change, nothing stored per invoice. payment_terms='Tender' on
   the linked business makes the invoice a Tender; service_type 'School Commission' makes it
   Academies; everything else is B2B. The alias map cannot hide this: sector reads the raw
   client_group's LINK (FIN.linkByGroup), which survives display grouping untouched. When the
   653-invoice backfill lands with Corporate / codes / incentives, this one function is the
   single place that grows. */
var _finBizTermsIndex=null;
function _finBizTerms(uuid){
  try{
    if(!_finBizTermsIndex){
      _finBizTermsIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizTermsIndex[uu]=list[i].paymentTerms||null;
      }
    }
    return _finBizTermsIndex[uuid]||null;
  }catch(_){ return null; }
}
/* 2026-09-03 (watch cycle 18) — raised in cycles 2, 3 and 7, now measured and fixed.
   The Tenders chip was decided by matching the word "tender" against a client's FREE-TEXT
   payment terms. `client_profiles.profile_type` exists for exactly this purpose and carries an
   explicit 'tender' value. Read live from the database on 3 Sep: 6 clients carry that profile,
   4 of them have invoices, 9 invoices belong to them — and the free-text rule was calling only 4
   of those 9 a tender. Five real tender invoices were being reported as ordinary B2B. Nothing in
   the other direction: no client whose terms say "tender" has a profile saying otherwise.
   So: the explicit field wins where a profile exists; the free-text match is kept ONLY as a
   fallback for a client with no profile yet, so nothing that used to be classified stops being.
   finSectorBasis() says which of the two answered, so the page can show it rather than mixing
   the two silently. */
function finProfileTypeOf(bizId){
  try{
    if(!bizId)return null;
    var ix=(FIN&&FIN.profileTypeByBiz)||null;
    if(!ix)return null;
    return Object.prototype.hasOwnProperty.call(ix,bizId)?ix[bizId]:null;
  }catch(_){ return null; }
}
function finSectorBasis(r){
  if(String(r.service_type||'')==='School Commission')return 'service';
  var l=(FIN.linkByGroup||{})[r.client_group];
  if(l&&l.business_id&&finProfileTypeOf(l.business_id))return 'profile';
  if(l&&l.business_id&&/tender/i.test(String(_finBizTerms(l.business_id)||'')))return 'terms';
  return 'default';
}
function finSectorOf(r){
  if(String(r.service_type||'')==='School Commission')return 'academies';
  var l=(FIN.linkByGroup||{})[r.client_group];
  if(l&&l.business_id){
    var pt=finProfileTypeOf(l.business_id);
    if(pt) return (String(pt).toLowerCase()==='tender')?'tenders':'b2b';
    if(/tender/i.test(String(_finBizTerms(l.business_id)||'')))return 'tenders';
  }
  return 'b2b';
}
try{ window.finSectorOf=finSectorOf; window.finSectorBasis=finSectorBasis; }catch(_){}
var SECTORS=[['all',['All sectors','كل القطاعات']],['tenders',['Tenders','مناقصات']],['b2b',['B2B','أعمال']],['academies',['Academies','أكاديميات']]];
window.finPS=function(v){ FIN.p.sector=v; clearFinCanon(); if(typeof render==='function')render(); };
var _finBizDirectIdIndex=null;
function clearFinCanon(){ _finCanonCache={}; _finBizNameIndex=null; _finBizDirectIdIndex=null; _finBizTermsIndex=null; }
function _finBizName(uuid){
  try{
    if(!_finBizNameIndex){
      _finBizNameIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizNameIndex[uu]=list[i].name||null;
      }
    }
    return Object.prototype.hasOwnProperty.call(_finBizNameIndex,uuid)?_finBizNameIndex[uuid]:null;
  }catch(_){return null;}
}
// Same lazily-built, clearFinCanon()-invalidated index as _finBizName, for the owner's
// "client ID beside the client name" request (2026-08-23) — businesses.direct_client_id is
// the Direct Payments portal id (small integers, e.g. 1, 46, ...). Not every client has one yet.
function _finBizDirectId(uuid){
  try{
    if(!_finBizDirectIdIndex){
      _finBizDirectIdIndex={};
      var list=(typeof DB!=='undefined'&&DB.businesses)||[];
      for(var i=0;i<list.length;i++){
        var uu=(window.__bizUuid?window.__bizUuid(list[i].id):list[i].id);
        _finBizDirectIdIndex[uu]=list[i].directClientId||null;
      }
    }
    return Object.prototype.hasOwnProperty.call(_finBizDirectIdIndex,uuid)?_finBizDirectIdIndex[uuid]:null;
  }catch(_){return null;}
}
function finCanon(clientGroup){
  var ck=(clientGroup==null?'':clientGroup);
  if(_finCanonCache[ck]!==undefined)return _finCanonCache[ck];
  /* 2026-09-03 (watch cycle 16): client_group is NOT NULL on the live table, but "" and "   "
     both satisfy that — and only the exact empty string fell back to the em-dash, so a
     whitespace-only name rendered as a row of real money with no visible owner. Trim before
     deciding. The LOOKUP below deliberately still uses the raw value, because a link may
     legitimately be keyed on the name exactly as Direct Payments typed it, padding included. */
  var disp=(String(ck).trim()==='')?'—':ck, res;
  // M14, 2026-08-25 — client name aliases (js/62 Part 1.5) are checked FIRST and win outright:
  // an admin-confirmed canonical name (e.g. "Madar - Smart Systems" for "Madar" + its Arabic
  // spelling) always overrides whatever the linked business's own name field says. Consulted
  // live on every resolution, not applied once — a future import carrying the same raw
  // client_group text groups correctly with zero extra work, exactly like finExclusionCheck().
  var g=(typeof window.finGroupCheck==='function')?window.finGroupCheck(clientGroup):null;
  if(g){
    res={key:'grp:'+g.id,name:g.canonicalName,linked:true,grouped:true};
  }else{
  var l=(FIN.linkByGroup||{})[clientGroup];
  if(l&&l.is_client===false){
    res={key:'__indiv__',name:isArF()?'أفراد / ليس عميلاً':'Individuals / not a client',linked:true};
  }else if(l&&l.business_id){
    var nm=_finBizName(l.business_id);
    res=nm?{key:'biz:'+l.business_id,name:nm,linked:true,directId:_finBizDirectId(l.business_id)}:{key:'raw:'+disp,name:disp,linked:false};
  }else{
    res={key:'raw:'+disp,name:disp,linked:false};
  }
  }
  _finCanonCache[ck]=res; return res;
}
try{window.finCanon=finCanon;window.clearFinCanon=clearFinCanon;}catch(_){}

/* --- Service catalogue (EN → AR) -----------------------------------------------------
   One bilingual map for every service Direct bills, so finance reports, the ledger filter
   and the by-service card all show the service name in the current language. Keys match the
   `service_type` stored on invoices; unknown values fall through to their own text. */
var SVC_CATALOG=[
  ['Flights','الطيران'],['Hotels','الفنادق'],['Visa','التأشيرات'],['Visas','التأشيرات'],
  ['Transfers','التنقلات'],['Transport','التنقلات'],['Car rental','تأجير السيارات'],
  ['Insurance','التأمين'],['Activities / tours','الأنشطة والجولات'],['Tours','الأنشطة والجولات'],
  ['MICE / events','الفعاليات والمؤتمرات'],['Events','الفعاليات والمؤتمرات'],['Packages','الباقات'],
  ['Umrah','العمرة'],['Hajj','الحج'],['Courses','الدورات'],['Training','التدريب'],
  /* 'Wallet top-up' removed from here on purpose, 2026-08-20. This list feeds EVERY service
     dropdown in the app (Expenses, the Individual-bookings form, any future one) — leaving
     it selectable let someone label a real revenue-bearing Finance row "Wallet top-up",
     which is exactly what the owner's explicit rule forbids: no wallet-top-up detail in
     Finance reporting, ever, in any form. Wallet top-ups are tracked ONLY as documents in
     the Payment proofs chapter (js/57), which never touches a Finance total. Caught live by
     the owner's own hands-on testing of the Individual-bookings form. */
  ['Support Services','خدمات الدعم'],['eSIM','شرائح eSIM'],
  ['Study abroad','الدراسة بالخارج'],['Furnished apartments','الشقق المفروشة'],
  ['Translation','ترجمة الوثائق'],['Intl driving permit','رخصة القيادة الدولية'],
  ['VIP meet & assist','استقبال كبار الشخصيات'],['Event halls','قاعات الاجتماعات والفعاليات'],
  ['Shipping','الشحن البريدي'],['Chauffeur','سائق خاص'],
  ['Mixed','خدمات متعددة'],['Other','أخرى'],['(unspecified)','غير محدد']
];
var SVC_AR={}; SVC_CATALOG.forEach(function(p){SVC_AR[p[0]]=p[1];});
/* Service FAMILIES (owner-directed 2026-08-10): Finance shows families briefly,
   expandable to the exact services inside — pattern from Direct's own reports
   ("Direct Support (Flight modification)"). Unlisted services fall into Support & extras. */
var SVC_GROUPS={
  'Flights':{ar:'الطيران',svcs:['Flights']},
  'Hotels':{ar:'الفنادق',svcs:['Hotels','Furnished apartments','Event halls']},
  'Visas':{ar:'التأشيرات',svcs:['Visa','Visas','Translation','Intl driving permit']},
  'Transfers':{ar:'التنقلات',svcs:['Transport','Transfers','Car rental','Chauffeur']},
  'Study abroad':{ar:'الدراسة بالخارج',svcs:['Study abroad','Courses','Training']},
  'Packages':{ar:'الباقات',svcs:['Packages','Tours','Activities / tours','MICE / events','Events','Umrah','Hajj']},
  'Other services':{ar:'خدمات أخرى',svcs:['Support Services','eSIM','Insurance','Shipping','VIP meet & assist','Mixed','Other','(unspecified)']}
};
var SVC2GRP={}; Object.keys(SVC_GROUPS).forEach(function(g){SVC_GROUPS[g].svcs.forEach(function(k){SVC2GRP[k]=g;});});
try{ window.SVC_GROUPS=SVC_GROUPS; window.SVC2GRP=SVC2GRP; }catch(_){}
function svcLabel(k){ k=(k==null||k==='')?'(unspecified)':String(k); return isArF()?(SVC_AR[k]||k):k; }
try{ window.SVC_CATALOG=SVC_CATALOG; window.svcLabel=svcLabel; }catch(_){}

function badge(t,bg,fg){return '<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700;background:'+bg+';color:'+fg+'">'+escF(t)+'</span>';}
function uniq(arr){return Array.from(new Set(arr)).filter(Boolean).sort();}
function opts(list,sel,allLabel){var h='<option value="all">'+escF(allLabel)+'</option>';list.forEach(function(x){h+='<option value="'+escF(x)+'" '+(sel===x?'selected':'')+'>'+escF(x)+'</option>';});return h;}
var SS='padding:7px 9px;border:1px solid var(--line,#e6e8ec);border-radius:8px;font:inherit;background:#fff';

function finTabs(){
  var tabs=[['overview',isArF()?'\u0627\u0644\u0623\u062f\u0627\u0621':'Performance'],['clients',isArF()?'\u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u0627\u0644\u062a\u062d\u0635\u064a\u0644':'Clients & collections'],['ledger',isArF()?'\u0627\u0644\u0633\u062c\u0644':'Ledger'],['reports',isArF()?'\u0645\u0646\u0634\u0626 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631':'Report Builder']];
  if(finCanWrite())tabs.push(['import',isArF()?'\u0627\u0633\u062a\u064a\u0631\u0627\u062f':'Import']);
  return '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'+tabs.map(function(t){
    return '<button class="btn sm '+(FIN.tab===t[0]?'pri':'ghost')+'" onclick="finGo(\''+t[0]+'\')">'+t[1]+'</button>';
  }).join('')+'<span style="margin-left:auto;font-size:11px;color:var(--muted);align-self:center">'+(FIN.rows?(function(){var _ic=new Set(live().map(function(r){return r.invoice_no;})).size;var _d=(live().length?live().map(function(r){return r.invoice_date;}).sort().slice(-1)[0]:'\u2014');return isArF()?(_ic+' \u0641\u0627\u062a\u0648\u0631\u0629 \u00b7 \u062d\u062a\u0649 '+_d):(_ic+' invoices \u00b7 data through '+_d);})():'')+'</span></div>';
}
/* Freeze found 2026-08-22 (owner reproduced twice): switching a Finance tab called the
   GLOBAL render() — buildNav(), applyLang(), renderTopExtras(), and (since 'finance' isn't a
   key in the base render() dispatcher) a full wasted renderDash() computation over every
   business, immediately thrown away the instant renderFinance() overwrites the same
   #view.innerHTML right after. None of that depends on FIN.tab — switching tabs never
   changes the nav, the language, or the top bar — so this calls renderFinance() directly on
   the already-open Finance view instead. Falls back to the full render() if #view isn't
   there yet (shouldn't happen — this only fires from a button already inside the rendered
   Finance page — but this is a tab switch, not a page load, so it's cheap insurance either
   way). */
window.finGo=function(t){
  FIN.tab=t;
  var v=document.getElementById('view');
  if(v&&current==='finance')renderFinance(v); else render();
};

function finPeriodBar(){
  /* Keep FIN._csvRows in step with what the user is actually looking at.
     It is read by finLedgerCSV() and by the Records page's finance export, but nothing ever
     assigned it: the comment there says "set by rLedger()", and rLedger() did set it until it
     was refactored onto the transactions table, after which it sets TXN._csvRows instead.
     The result was a permanently broken export — "No rows to export" no matter what the user
     did, with 56 real invoices sitting loaded. Found 2026-08-22 while checking the two things
     the team does daily: add an invoice, and export a report.
     Live rows only (never soft-deleted), and filtered to the chosen period so the export
     matches the figures on screen. finPeriodBar() runs on every finance render. */
  try{ FIN._csvRows = live().filter(finInPeriod); }catch(_){ FIN._csvRows = []; }
  var years=uniq(live().map(function(r){var y=finYearOf(r);return y?String(y):'';}));
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'].filter(function(m){return live().some(function(r){return r.month===m;});});
  var chip=function(val,lbl){return '<button class="btn sm '+((FIN.p.part===val)?'pri':'ghost')+'" onclick="finPP(\''+val+'\')">'+lbl+'</button>';};
  var s='<style>.finh{border-inline-start:4px solid #F06820;padding-inline-start:10px;margin:0 0 12px;font-size:15px;line-height:1.35}.finh i{font-style:normal;display:block;font-size:11px;color:var(--muted);font-weight:500}.finpill{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}</style>';
  s+='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">'+(isArF()?'\u0627\u0644\u0641\u062a\u0631\u0629':'Period')+'</b>'
   +'<select style="'+SS+'" onchange="finPY(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062a':'All years')+'</option>'+years.map(function(y){return '<option '+(String(FIN.p.year)===y?'selected':'')+'>'+y+'</option>';}).join('')+'</select>'
   +chip('all',isArF()?'\u0627\u0644\u0643\u0644':'All')+chip('Q1','Q1')+chip('Q2','Q2')+chip('Q3','Q3')+chip('Q4','Q4')+chip('H1','H1')+chip('H2','H2')
   +'<select style="'+SS+'" onchange="finPP(this.value)"><option value="all">'+(isArF()?'\u0643\u0644 \u0627\u0644\u0634\u0647\u0648\u0631':'All months')+'</option>'+months.map(function(m){return '<option value="M:'+m+'" '+(FIN.p.part==='M:'+m?'selected':'')+'>'+(isArF()?(MO_AR[m]||m):m)+'</option>';}).join('')+'</select>'
   +SECTORS.map(function(sc){var on=(FIN.p.sector||'all')===sc[0];return '<button class="btn sm '+(on?'pri':'ghost')+'" onclick="finPS(\''+sc[0]+'\')">'+(isArF()?sc[1][1]:sc[1][0])+'</button>';}).join('')
   +'<span style="margin-inline-start:auto;font-size:11px;color:var(--muted)">'+(isArF()?'\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0641\u0642\u0637':'Paid invoices only')+' \u00b7 <b>'+finPeriodLabel()+'</b></span></div>';
  return s;
}
/* 2026-09-09 (watch cycle 73) — CYCLE 43'S RULE WAS APPLIED TO ONE TAB OF THE FOUR.
   rFinClients refuses while the exclusion list is outstanding, and the reason it gives is general:
   "a display may degrade to 'not checked yet'; it may not present money the owner ruled out as
   somebody's revenue." Nothing else in this file mentions the list. Measured with the
   app_settings response held back 4 seconds, one ordinary client at 100,000 SAR beside a standing-
   excluded partner at 900,000 (a 90% share, chosen near the real Takamol case — 6.7M SAR, 77% of
   displayed revenue — so a wrong total cannot be read as rounding):

     Overview   shows 1,000,000, says nothing, and silently corrects itself to 100,000 later
     Reports    shows 1,000,000 AND NAMES the excluded partner in its table, says nothing
     Clients    refuses, in words                                        (cycle 43)
     Ledger     reads finance_transactions, a different source — outside this finding either way

   So Reports commits exactly the fault cycle 43 named, on a tab cycle 43 did not visit, and the
   Overview quotes a figure inflated tenfold on the tab everyone lands on.

   THE TWO ARE TREATED DIFFERENTLY, ON PURPOSE.
   Reports refuses. Its default grouping is BY CLIENT: it puts the excluded partner's name and its
   money in a row of its own, which is the attribution cycle 43 forbade, and grouping by month
   instead only moves the money into May's revenue rather than nobody's.
   The Overview does NOT blank. It names no one — every figure there is a total — and it is the
   landing tab, so blanking it would hide the whole page behind a caveat card. That matters more
   than it looks: exclLoad() gives up after five tries, so finExclusionsKnown() can be false
   PERMANENTLY in a workspace whose app_settings never answers. Cycle 43 accepted a permanently
   refusing Clients tab; a permanently blank Finance page is a different bargain. So the Overview
   keeps its figures and says, unmissably, that they have not been checked yet.
   What would change this: if the Overview ever starts naming a client — a "top clients" block, a
   per-client tile — the refusal is the right answer there too, because the fault is attribution,
   not size. Today it does not; rFinClients owns the only such table in this file. */
function finUncheckedNotice(){
  try{ if(typeof window.finExclusionsKnown!=='function')return ''; }catch(_){ return ''; }
  try{ if(window.finExclusionsKnown())return ''; }catch(_){ return ''; }
  var ar=isArF();
  return '<div id="ov-unchecked" class="card" style="padding:12px 14px;margin-bottom:12px;background:#FFF7E6;border:1px solid #F2C879;border-top:3px solid #F59E0B;font-size:12.5px">'
    +'<b>'+(ar?'\u0644\u0645 \u062a\u064f\u0641\u062d\u0635 \u0628\u0639\u062f':'Not checked yet')+'</b> \u00b7 '
    +(ar
      ?'\u0644\u0645 \u062a\u0643\u062a\u0645\u0644 \u0628\u0639\u062f \u0642\u0631\u0627\u0621\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0633\u062a\u0628\u0639\u0627\u062f\u060c \u0641\u0642\u062f \u062a\u0634\u0645\u0644 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0623\u062f\u0646\u0627\u0647 \u0634\u0631\u064a\u0643\u064b\u0627 \u0645\u0633\u062a\u0628\u0639\u062f\u064b\u0627. \u0633\u062a\u064f\u0635\u062d\u064e\u0651\u062d \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u062e\u0644\u0627\u0644 \u0644\u062d\u0638\u0627\u062a \u2014 \u0644\u0627 \u062a\u0646\u0642\u0644 \u0631\u0642\u0645\u064b\u0627 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629 \u0642\u0628\u0644 \u0630\u0644\u0643.'
      :'The exclusion list has not finished loading, so the figures below may still include a partner this workspace excludes. They will correct themselves in a moment \u2014 do not quote a number from this screen until they do.')
    +'</div>';
}
try{ window.finUncheckedNotice=finUncheckedNotice; }catch(_){}
/* The refusal card the Clients tab has used since cycle 43, now shared with Reports so the two
   cannot drift into saying different things about the same state. `what` names the tab's own risk
   in its own terms; everything else is one sentence in one place. */
function finUncheckedRefusal(whatEn,whatAr){
  var ar=isArF();
  return finPeriodBar()+'<div class="card" style="padding:18px;border-top:3px solid #F59E0B">'
    +'<div style="font-size:13px;font-weight:700;margin-bottom:4px">'+(ar?'\u0644\u0645 \u062a\u064f\u0641\u062d\u0635 \u0628\u0639\u062f':'Not checked yet')+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+(ar?whatAr:whatEn)+'</div></div>';
}
function rFinClients(){
  clearFinCanon();
  /* 2026-09-07 (watch cycle 43): this whole tab is money grouped BY CLIENT, and the grouping
     rests on finExclusionCheck(), which answers the same null for "not on the list" and "no
     list yet". Built before app_settings lands, the table shows a standing-excluded partner as
     an ordinary client with its money counted — measured directly with the blob held back, and
     caught by probe-clients-attacks under six-way load ("excluded partner leaked into
     Clients"). The standing rule: a display may degrade to "not checked yet"; it may not
     present money the owner ruled out as somebody's revenue. So say so and render nothing —
     js/62's own load re-renders this page the moment the list arrives. */
  try{
    if(typeof window.finExclusionsKnown==='function'&&!window.finExclusionsKnown()){
      /* 2026-09-09 (watch cycle 73): the wording moved into finUncheckedRefusal, unchanged, so
         Reports says the same thing about the same state instead of a second version of it. */
      return finUncheckedRefusal(
        'The exclusion list has not finished loading, so these figures cannot be grouped by client without risking showing a standing-excluded partner as an ordinary one. They will appear on their own in a moment.',
        'لم تكتمل بعد قراءة قائمة الاستبعاد، لذا لا يمكن عرض هذه الأرقام مجمّعة حسب العميل دون المخاطرة بإظهار شريك مستبعَد كعميل عادي. ستظهر تلقائيًا خلال لحظات.');
    }
  }catch(_){}
  var V=verified().filter(finInPeriod);
  var h=finPeriodBar();
  var credit=0;(FIN.links||[]).forEach(function(l){credit+=+l.credit_balance_sar||0;});
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px">'
    +'<div class="card" style="padding:14px 16px;border-top:3px solid #10B981"><div style="font-size:11px;color:var(--muted)">'+(isArF()?'رصيد العملاء (لدينا)':'Client credit (held)')+'</div><div style="font-size:19px;font-weight:800;color:#10B981" title="'+money(credit)+' SAR">'+moneyS(credit)+' <span style="font-size:10px;font-weight:400">SAR</span>'+finExactUnder(credit)+'</div></div>'
    +'</div>';
  // ---- Collections & ageing (days to collect · % overdue · ageing buckets) — from all live invoices, no name matching ----
  var _fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  var LV=live().filter(finInPeriod);
  var arOut=0,arOver=0,arNoDue=0,billed=0,ag={b030:0,b3160:0,b6190:0,b90:0,nodate:0,future:0},_now=Date.now();
  LV.forEach(function(r){
    billed+=+r.total_incl_vat_sar||0;
    var out=+r.amount_remaining_sar||0; if(out<=0)return;
    arOut+=out;
    var due=r.collection_due_date?new Date(r.collection_due_date).getTime():0; if(due&&due<_now)arOver+=out;
    /* 2026-09-06 (watch cycle 28): "% overdue" can only ever see money on an invoice that carries
       a collection due date. 19 of the 46 live invoices carry none, so the figure is a percentage
       of a subset while reading as a percentage of everything — and with no due date anywhere it
       prints a confident 0% beside a full 90+ bucket. Measure how much money it cannot see, so
       the card can say so instead of letting the number speak for money it never looked at. */
    if(!due)arNoDue+=out;
    /* 2026-09-02 (watch cycle 6, scripts/qa/probe-clients-attacks.mjs): a row with NO invoice
       date used to be aged from "today", i.e. shown as 0–30 days — an invented age (M8). It now
       sits in its own "No invoice date" amount, still inside Outstanding, never in a bucket. */
    var invd=r.invoice_date?new Date(r.invoice_date).getTime():NaN;
    if(isNaN(invd)){ ag.nodate+=out; return; }
    var d=Math.floor((_now-invd)/86400000);
    /* 2026-09-06 (watch cycle 28): an invoice dated in the FUTURE gave a negative age, and the
       first comparison below is `d<=30`, so it was reported as 0-30 days old — an age it cannot
       have. Same invented-age shape cycle 6 removed from the no-date row, and the same answer:
       its own amount, still inside Outstanding, never in a bucket that claims it has aged. */
    if(d<0){ ag.future+=out; return; }
    if(d<=30)ag.b030+=out;else if(d<=60)ag.b3160+=out;else if(d<=90)ag.b6190+=out;else ag.b90+=out;
  });
  var _dates=LV.map(function(r){return r.invoice_date;}).filter(Boolean).sort();
  var _span=_dates.length?Math.max(30,Math.round((new Date(_dates[_dates.length-1]).getTime()-new Date(_dates[0]).getTime())/86400000)):180;
  var dso=billed>0?Math.round(arOut/billed*_span):0, pctOver=arOut>0?Math.round(arOver/arOut*100):0;
  /* A1, 2026-08-25 (owner-approved audit fix) — the card used to print DSO 0 / 0% / 0 SAR and a
     green "No outstanding receivables", which reads as "we collect perfectly". It is not: rule M10
     imports only finalised/paid invoices, so an unpaid invoice cannot enter the table at all and
     this card is structurally incapable of finding one. Zero here was a fabricated number filling
     a gap — exactly what rule M8 forbids. When nothing in the period carries any payment state to
     measure, say so instead of showing zeros. */
  var _noUnpaidData=LV.length>0&&!LV.some(function(r){return (+r.amount_remaining_sar||0)>0;})&&LV.every(function(r){return r.integrity_status==='verified_paid';});
  var _mini=function(lbl,val,col){return '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+val+'</div></div>';};
  /* 2026-09-07 (watch cycle 49) — THESE FOUR NUMBERS ARE WHO GETS CHASED, AND THEY WERE ROUNDED.
     moneyS() renders anything over a million as "8.76M" and anything over a thousand as
     "999.9K", so a 90+ bucket holding 8,755,055 SAR read as "8.76M" — a band ten thousand riyals
     wide — and 999,999 read as "1000.0K", which is a different million from the one it is. The
     credit tile eight lines above carries its exact figure in a title attribute; these carried
     nothing at all. Two standards on one screen, and the rounded one is the screen somebody
     works from when deciding who to call about a late invoice.
     A title would not have fixed it. The owner reads Finance on a phone, where there is no hover
     — so the exact figure goes ON the card, under the short one. The short form stays as the
     headline: four full-length numbers is not an improvement on a 390px screen, and the point is
     to be able to read it exactly, not to stop being able to read it at a glance. */
  var _exact=function(val){ return finExactUnder(val); };   // one definition of the rule, hoisted in cycle 50

  var _agc=function(lbl,val){return '<div style="flex:1;min-width:90px;background:#F9FAFB;border-radius:8px;padding:8px 10px"><div style="font-size:10.5px;color:var(--muted)">'+lbl+'</div><div style="font-weight:800;font-size:14px">'+moneyS(val)+' <span style="font-size:9px;font-weight:400">SAR</span>'+_exact(val)+'</div></div>';};
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 10px">'+_fl('Collections & ageing','التحصيل والتقادم')+'</h3>'+
     (_noUnpaidData
       ? ('<div style="font-size:12.5px;color:var(--muted)">'+_fl('Not tracked yet — only paid invoices are imported, so nothing here can show as unpaid.','لم يُتتبَّع بعد — لا تُستورد إلا الفواتير المدفوعة، لذا لا يظهر أي مبلغ غير محصَّل.')+'</div>')
       : ('<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:'+(arOut>0?'14px':'0')+'">'+
       _mini(_fl('Days to collect','مدة التحصيل (أيام)'),dso,'#175CD3')+
       _mini(_fl('% overdue','٪ المتأخر'),pctOver+'%',pctOver>0?'#D92D20':'#0F6E56')+
       _mini(_fl('Outstanding','إجمالي المستحق'),moneyS(arOut)+' SAR'+_exact(arOut),arOut>0?'#D92D20':'#667085')+
     '</div>'+
     (arOut>0?('<div style="display:flex;gap:8px;flex-wrap:wrap">'+_agc(_fl('0–30 days','0–30 يوم'),ag.b030)+_agc(_fl('31–60 days','31–60 يوم'),ag.b3160)+_agc(_fl('61–90 days','61–90 يوم'),ag.b6190)+_agc(_fl('90+ days','90+ يوم'),ag.b90)+(ag.nodate>0?_agc(_fl('No invoice date','بدون تاريخ فاتورة'),ag.nodate):'')+(ag.future>0?_agc(_fl('Dated in the future','بتاريخ مستقبلي'),ag.future):'')+'</div>'+
       /* 2026-09-08 (watch cycle 62): the fourth surface in the class cycles 59-61 opened, and the
          one where reading down is the whole job — every riyal in Outstanding is in exactly one of
          these six by construction, so a person deciding who to chase expects them to come to the
          figure above. Cycle 49 made each amount legible on its own (moneyS hid 8,755,055 inside
          "8.76M"); it did not make six of them add up to a seventh. The gap is quieter than the
          one cycle 49 fixed: moneyS(1000.40) is "1.0K", finExactUnder stays silent because to the
          nearest riyal nothing is hidden, and six such silences are two and a half riyals the
          reader cannot see. Say it, with the exact total, and only when it shows. */
       (function(){
         var _bk=[ag.b030,ag.b3160,ag.b6190,ag.b90].concat(ag.nodate>0?[ag.nodate]:[],ag.future>0?[ag.future]:[]);
         var _ps=_bk.reduce(function(a,v){return a+finPrintedValue(v);},0), _po=finPrintedValue(arOut);
         if(_ps===_po)return '';
         return '<div style="font-size:11.5px;color:#444;margin-top:8px">'+_fl(
           'These amounts are shortened to fit, so reading down them comes to '+money0(_ps)+' where Outstanding reads '+money0(_po)+'. Every riyal outstanding is in exactly one of them — the exact total is '+(Number(arOut)||0).toFixed(2)+' SAR.',
           '\u0647\u0630\u0647 \u0627\u0644\u0645\u0628\u0627\u0644\u063a \u0645\u062e\u062a\u0635\u0631\u0629 \u0644\u062a\u0646\u0627\u0633\u0628 \u0627\u0644\u0639\u0631\u0636\u060c \u0644\u0630\u0627 \u064a\u0628\u0644\u063a \u0645\u062c\u0645\u0648\u0639\u0647\u0627 '+money0(_ps)+' \u0628\u064a\u0646\u0645\u0627 \u064a\u0638\u0647\u0631 \u0627\u0644\u0645\u0633\u062a\u062d\u0642 '+money0(_po)+'. \u0643\u0644 \u0631\u064a\u0627\u0644 \u0645\u0633\u062a\u062d\u0642 \u0645\u0648\u062c\u0648\u062f \u0641\u064a \u0648\u0627\u062d\u062f \u0645\u0646\u0647\u0627 \u0641\u0642\u0637 \u2014 \u0648\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062f\u0642\u064a\u0642 '+(Number(arOut)||0).toFixed(2)+' \u0631\u064a\u0627\u0644.')+'</div>';
       })()+
       (arNoDue>0?('<div style="font-size:11.5px;color:var(--muted);margin-top:8px">'+_fl(
         '% overdue is measured on the '+moneyS(arOut-arNoDue)+' SAR that carries a collection due date. The other '+moneyS(arNoDue)+' SAR has none, so it can never count as overdue however old it is.',
         'تُحتسب نسبة المتأخر على '+moneyS(arOut-arNoDue)+' ريال تحمل تاريخ استحقاق. أما '+moneyS(arNoDue)+' ريال المتبقية فبلا تاريخ استحقاق، فلا يمكن احتسابها متأخرة مهما تقادمت.')+'</div>'):''))
       :('<div style="font-size:12px;color:#0F6E56">✓ '+_fl('Nothing outstanding','لا توجد مستحقات')+'</div>'))))+
     '</div>';
  /* 2026-09-02 (round 35): the overview headline already warns that some invoices in the period
     carry no recorded cost — but THIS table is where a manager decides which client is worth
     the effort, and it was showing those clients a Cost of 0 and a Profit equal to their whole
     revenue, with nothing to say the cost is simply unknown. Live today that is 5 of 18 client
     groups and 131,871 SAR presented as 100% margin. Same rule as everywhere else (M8): a cost
     nobody has recorded is not zero, and a profit derived from it is not a profit.
     nz counts the invoices in each group with no cost recorded. */
  var byC={};V.forEach(function(r){var cc=finCanon(r.client_group);var k=cc.name;byC[k]=byC[k]||{r:0,c:0,p:0,nz:0,_i:{},key:cc.key,directId:cc.directId};byC[k].r+=+r.revenue_sar;byC[k].c+=+r.cost_sar;byC[k].p+=+r.profit_sar;if((+r.cost_sar||0)===0)byC[k].nz++;byC[k]._i[r.invoice_no]=1;});Object.keys(byC).forEach(function(k){byC[k].n=Object.keys(byC[k]._i).length;});
  function _cCell(x){ // cost cell: a group with NO cost on any invoice shows the words, not a 0
    if(x.nz>=x.n) return '<span style="color:#B54708" title="'+(isArF()?'لم تُسجَّل تكلفة لأي فاتورة لهذا العميل':'No cost recorded on any of this client\'s invoices')+'">'+(isArF()?'غير مسجّلة':'not recorded')+'</span>';
    return money0(x.c)+(x.nz?('<span style="color:#B54708;font-size:10.5px" title="'+(isArF()?'بعض الفواتير بلا تكلفة مسجّلة':'some invoices carry no recorded cost')+'"> ⚠</span>'):'');
  }
  function _pCell(x){ // profit follows: unknown cost means unknown profit, never the whole sale
    if(x.nz>=x.n) return '<span style="color:#B54708" title="'+(isArF()?'الربح غير معروف حتى تُسجَّل التكلفة':'Profit is unknown until a cost is recorded')+'">'+(isArF()?'غير معروف':'unknown')+'</span>';
    return money0(x.p)+(x.nz?'<span style="color:#B54708;font-size:10.5px"> ⚠</span>':'');
  }
  var top=Object.keys(byC).sort(function(a,b){return byC[b].r-byC[a].r;}).slice(0,10);
  var _tc={r:0,c:0,p:0,gaps:0};Object.keys(byC).forEach(function(k){_tc.r+=byC[k].r;_tc.c+=byC[k].c;_tc.p+=byC[k].p;if(byC[k].nz)_tc.gaps++;});
  /* The Total row keeps the real arithmetic — it must still reconcile against the ledger — but
     a total built partly on unrecorded costs is an upper bound on profit, not a profit, and it
     now says so rather than leaving the reader to infer it from the rows above. */
  var _tcNote=_tc.gaps?('<div style="font-size:11px;color:#B54708;font-weight:600;margin-top:8px">⚠ '+(isArF()
    ?(_tc.gaps+' من العملاء لديهم فواتير بلا تكلفة مسجّلة — إجمالي الربح أعلاه حدّ أقصى وليس رقمًا نهائيًا.')
    :(_tc.gaps+' of these clients have invoices with no recorded cost — the profit total above is an upper bound, not a final figure.'))+'</div>'):'';
  /* 2026-09-08 (watch cycle 63): fifth surface in the class cycles 59-62 opened. Every cell in
     this table is money0() — each row rounded to the whole riyal separately from the Total under
     it — so five clients billing 1,000.40 print five rows of 1,000 above a Total of 5,002. This is
     the table where a manager decides which client is worth the effort, and reading a column down
     is how they check it.
     TWO reasons this table's columns may legitimately not add up are already declared on screen,
     and neither is this one — so neither may be restated as rounding:
       · only the top 10 rows are shown while the Total covers every client (said in the header),
         so this says nothing at all unless every client is on screen;
       · a client with no recorded cost anywhere prints the WORDS "not recorded"/"unknown" rather
         than a 0 (M8), which makes those two columns unaddable — skipped, and _tcNote already
         explains that case. */
  var _rnote=(function(){
    if(top.length!==Object.keys(byC).length)return '';
    var anyWords=top.some(function(k){return byC[k].nz>=byC[k].n;});
    var cols=[['r',isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue',true],['c',isArF()?'\u0627\u0644\u062a\u0643\u0644\u0641\u0629':'Cost',!anyWords],['p',isArF()?'\u0627\u0644\u0631\u0628\u062d':'Profit',!anyWords]];
    var offs=[];
    cols.forEach(function(c){
      if(!c[2])return;
      var rws=top.reduce(function(a,k){return a+Math.round(Number(byC[k][c[0]])||0);},0), tot=Math.round(Number(_tc[c[0]])||0);
      if(rws!==tot)offs.push({lbl:c[1],rows:rws,tot:tot,exact:Number(_tc[c[0]])||0});
    });
    if(!offs.length)return '';
    return '<div style="font-size:11px;color:#444;margin-top:8px">'+(isArF()
      ?('\u0643\u0644 \u0631\u0642\u0645 \u0647\u0646\u0627 \u0645\u064f\u0642\u0631\u064e\u0651\u0628 \u0625\u0644\u0649 \u0623\u0642\u0631\u0628 \u0631\u064a\u0627\u0644 \u0639\u0644\u0649 \u062d\u062f\u0629\u060c \u0644\u0630\u0627 \u0642\u062f \u0644\u0627 \u064a\u0628\u0644\u063a \u062c\u0645\u0639 \u0627\u0644\u0639\u0645\u0648\u062f \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a. '+offs.map(function(o){return o.lbl+': \u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0635\u0641\u0648\u0641 '+money0(o.rows)+'\u060c \u0648\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a '+money0(o.tot)+'\u060c \u0648\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062f\u0642\u064a\u0642 '+o.exact.toFixed(2)+' \u0631\u064a\u0627\u0644';}).join('\u061b ')+'.')
      :('Each figure here is rounded to the nearest riyal on its own, so reading a column down does not always reach the Total. '+offs.map(function(o){return o.lbl+': the rows read '+money0(o.rows)+', the Total reads '+money0(o.tot)+', and the exact figure is '+o.exact.toFixed(2)+' SAR';}).join('; ')+'.'))+'</div>';
  })();
  h+='<div class="card" style="padding:16px"><h3 class="finh" style="margin:0 0 10px">'+(isArF()?'أعلى العملاء':'Top clients by revenue')+'<i>'+finPeriodLabel()+'</i></h3><div style="overflow-x:auto"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:480px"><tr style="background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+'"><th style="padding:7px 9px">'+(isArF()?'العميل':'Client')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الإيرادات':'Revenue')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'التكلفة':'Cost')+'</th><th style="padding:7px 9px;text-align:right">'+(isArF()?'الربح':'Profit')+'</th></tr>'+top.map(function(k){
    return '<tr style="border-top:1px solid var(--line,#eee);cursor:pointer" onclick="finClient(\''+escF(byC[k].key).replace(/'/g,"\\'")+'\',\''+escF(k).replace(/'/g,"\\'")+'\')"><td style="padding:6px 9px;font-weight:600">'+escF(k)+(byC[k].directId?(' <span style="color:var(--muted);font-size:10.5px">#'+escF(byC[k].directId)+'</span>'):'')+'</td><td style="padding:6px 9px;text-align:right;font-weight:700">'+money0(byC[k].r)+'</td><td style="padding:6px 9px;text-align:right;color:#B54708">'+_cCell(byC[k])+'</td><td style="padding:6px 9px;text-align:right;color:#0F6E56;font-weight:700">'+_pCell(byC[k])+'</td></tr>';
  }).join('')+'<tr style="background:#303848;color:#fff;font-weight:800"><td style="padding:7px 9px">'+(isArF()?'الإجمالي الكلي':'Total')+(Object.keys(byC).length>top.length?(' <span style="font-weight:400;font-size:10.5px;opacity:.85">'+(isArF()?('— كل العملاء ('+Object.keys(byC).length+')، أعلى 10 معروضون'):('— all '+Object.keys(byC).length+' clients, top 10 shown'))+'</span>'):'')+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.r)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.c)+'</td><td style="padding:7px 9px;text-align:right">'+money0(_tc.p)+'</td></tr></table></div>'+_tcNote+_rnote+'</div>';
  return h;
}
function rOverview(){
  clearFinCanon();
  var V=verified().filter(finInPeriod);
  var rev=0,cost=0,prof=0,rec=0,rem=0,wal=0;
  V.forEach(function(r){rev+=+r.revenue_sar;cost+=+r.cost_sar;prof+=+r.profit_sar;rec+=+r.amount_received_sar;rem+=+r.amount_remaining_sar;wal+=+r.wallet_portion_sar;});
  /* Outstanding cannot be read off the verified-paid invoices: an invoice is only verified-paid
     once nothing is left to pay, so summing what remains across them is always zero — which is
     exactly what this tile showed while Clients & collections reported 216.1K of real unpaid
     money on the same page. Money still owed lives on the invoices that are NOT yet settled, so
     it is counted over every live invoice in the period, the same basis the collections tab uses.
     The other five indicators stay on verified invoices, as their subtitle says.
     Labelled "(invoiced)" since 2026-08-29: money on transactions not yet invoiced ("Ready to
     invoice" on the Ledger tab) is a different amount and is never added in here — the two
     stay two lines, never one (DECISIONS: never sum invoices and transactions). */
  rem=0; live().filter(finInPeriod).forEach(function(r){ rem+=+r.amount_remaining_sar||0; });
  var invCount=new Set(V.map(function(r){return r.invoice_no;})).size; // distinct invoices, not service lines
  /* Period bar \u2014 the executive-dashboard structure: year \u00b7 All/Q1\u2013Q4/H1/H2 \u00b7 month */
  /* 2026-09-09 (watch cycle 73): above the cards, not under them — it qualifies every figure on
     the tab, and a caveat below the number it qualifies is read after the number is believed. */
  var h=finPeriodBar()+finUncheckedNotice();

  var cards=[[isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue',rev,'#0F6E56'],[isArF()?'\u0627\u0644\u062a\u0643\u0644\u0641\u0629':'Cost',cost,'#B54708'],[isArF()?'\u0627\u0644\u0631\u0628\u062d':'Profit',prof,'#175CD3'],[isArF()?'\u0627\u0644\u0645\u062d\u0635\u0651\u0644':'Received',rec,'#0F6E56'],[isArF()?'\u0627\u0644\u0645\u062a\u0628\u0642\u064a (\u0645\u0641\u0648\u062a\u0631)':'Outstanding (invoiced)',rem,rem>0?'#D92D20':'#667085'],[isArF()?'\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631':'Invoices',invCount,'#1C1E2B']];
  h+='<h3 class="finh">'+(isArF()?'\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629':'Key indicators')+'<i>'+finPeriodLabel()+' \u00b7 '+(isArF()?'\u0641\u0639\u0644\u064a \u2014 \u0645\u0646 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0642\u0642\u0629':'actual \u2014 from verified invoices')+'</i></h3>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin-bottom:14px">'+cards.map(function(c,i){
    return '<div class="card" style="padding:14px 16px;border-top:3px solid '+c[2]+'"><div style="font-size:11px;color:var(--muted)">'+c[0]+'</div><div style="font-size:'+(i===cards.length-1?'22px':'19px')+';font-weight:800;color:'+c[2]+'" title="'+(i===cards.length-1?'':money(c[1])+' SAR')+'">'+(i===cards.length-1?c[1]:moneyS(c[1]))+(i===cards.length-1?'':' <span style="font-size:10px;font-weight:400">SAR</span>')+(i===cards.length-1?'':finExactUnder(c[1]))+'</div></div>';
  }).join('')+'</div>';
  /* A7, 2026-08-26 (landmine sweep) — the newest month always flattered itself: August showed a
     63.5% margin only because most of its cost had not arrived yet, and nothing marked the gap.
     When the filtered period contains verified invoices carrying no cost, say so right under the
     KPIs, with the count — factual either way (a commission invoice genuinely has no cost; a
     held-back one just doesn't have it YET), so the wording states the fact and hedges the risk. */
  /* 2026-09-08 (watch cycle 64): the sixth and last surface in the class cycles 59-63 opened, and
     the one people look at first. These six cards are NOT a column that sums — Outstanding is
     deliberately measured over ALL live invoices while the other five are verified-only (see the
     comment above; cycle 4 fixed the opposite bug), and Invoices is a count. Exactly ONE relation
     holds across them, and it is the first thing anybody checks: Profit = Revenue − Cost.
     Each of the three is moneyS() with an exact line only when the short form hides a whole riyal,
     so all three can be individually defensible and jointly wrong: Revenue 3,000.30, Cost 1,201.80
     and Profit 1,798.50 print as 3,000 − 1,202 = 1,798 beside a Profit of 1,799. It does not
     happen for most figures — round(a)−round(b) and round(a−b) usually agree — which is exactly
     why it needs saying when it does rather than being left for someone to hit alone. */
  (function(){
    var _pr=finPrintedValue(rev), _pc=finPrintedValue(cost), _pp=finPrintedValue(prof);
    if(_pr-_pc===_pp)return;
    h+='<div id="ov-rounding" style="font-size:12px;color:#444;margin:-6px 0 14px">'+(isArF()
      ?('\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0623\u0639\u0644\u0627\u0647 \u0645\u064f\u0642\u0631\u064e\u0651\u0628 \u0643\u0644 \u0645\u0646\u0647\u0627 \u0639\u0644\u0649 \u062d\u062f\u0629\u060c \u0644\u0630\u0627 \u0641\u0625\u0646 '+money0(_pr)+' \u0646\u0627\u0642\u0635 '+money0(_pc)+' \u062a\u0639\u0637\u064a '+money0(_pr-_pc)+' \u0628\u064a\u0646\u0645\u0627 \u064a\u0638\u0647\u0631 \u0627\u0644\u0631\u0628\u062d '+money0(_pp)+'. \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062f\u0642\u064a\u0642\u0629: \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a '+(Number(rev)||0).toFixed(2)+' \u0631\u064a\u0627\u0644\u060c \u0627\u0644\u062a\u0643\u0644\u0641\u0629 '+(Number(cost)||0).toFixed(2)+' \u0631\u064a\u0627\u0644\u060c \u0627\u0644\u0631\u0628\u062d '+(Number(prof)||0).toFixed(2)+' \u0631\u064a\u0627\u0644.')
      :('Each figure above is rounded on its own, so '+money0(_pr)+' minus '+money0(_pc)+' reads as '+money0(_pr-_pc)+' where Profit reads '+money0(_pp)+'. Exactly: revenue '+(Number(rev)||0).toFixed(2)+' SAR, cost '+(Number(cost)||0).toFixed(2)+' SAR, profit '+(Number(prof)||0).toFixed(2)+' SAR.'))+'</div>';
  })();
  var _badMoney=live().filter(finInPeriod).filter(function(r){return r._badMoney;}).length;
  if(_badMoney>0){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 14px">⚠ '+(isArF()
      ? (_badMoney+' صف/صفوف في هذه الفترة تحمل مبالغ غير قابلة للقراءة (ليست أرقامًا) — حُسبت كصفر هنا. راجع الاستيراد.')
      : (_badMoney+' row'+(_badMoney>1?'s':'')+' in this period carr'+(_badMoney>1?'y':'ies')+' an unreadable amount (not a number) — counted as 0 here. Check the import.'))+'</div>';
  }
  /* 2026-09-09 (watch cycle 70) — SURFACE THE DISAGREEMENT, DO NOT RESOLVE IT.
     Cycle 65 gave month and quarter the same date-fallback that finYearOf has always had, so a row
     with a date and no stored period no longer vanishes from every quarter. It deliberately left
     the other case alone: a row whose stored quarter says Q2 while its date says March is still
     counted as Q2, because overruling a stored value on the say-so of a date that might itself be
     the wrong field would move money silently — and which field is authoritative is the owner's
     call, not this code's. What was wrong was that NOTHING said the two disagree. Checked
     read-only on 8 Sep: zero live invoices disagree today, so this is a watch, not an alarm — it
     shows only when it has something to show, and it changes no figure on any screen. */
  var _perDis=live().filter(finInPeriod).filter(finPeriodDisagrees).length;
  if(_perDis>0){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 14px">⚠ '+(isArF()
      ?(_perDis+' فاتورة/فواتير تحمل شهرًا أو ربعًا لا يطابق تاريخ الفاتورة. تُحتسب حسب القيمة المخزَّنة كما هي — لم يتغير أي رقم — لكن شريط الفترة أعلاه يتبع المخزَّن، لا التاريخ.')
      :(_perDis+' invoice'+(_perDis>1?'s':'')+' carr'+(_perDis>1?'y':'ies')+' a month or quarter that does not match its invoice date. They are counted under the stored value as they always were — no figure has changed — but the period bar above follows what is stored, not the date.'))+'</div>';
  }
  var _noCost=V.filter(function(r){return (+r.cost_sar||0)===0;}).length;
  if(_noCost>0){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 14px">⚠ '+(isArF()
      ?(_noCost+' من '+V.length+' فاتورة في هذه الفترة بلا تكلفة مسجلة — قد يظهر الهامش أعلى من الحقيقة حتى تصل مصروفاتها.')
      :(_noCost+' of '+V.length+' invoices in this period carry no recorded cost — margin may read higher than reality until their expenses arrive.'))+'</div>';
  }
  /* Compare to (blueprint step 5, 2026-08-27): revenue/cost/profit/margin against the previous
     period or the same period last year. Needs one concrete year selected above — spanning
     "all years" has no single "previous" to shift to, so the control still shows but explains
     why, instead of silently doing nothing. */
  h+=(function(){
    var ar=isArF(), cmp=FIN.p.cmp||'none';
    var sel='<select style="'+SS+'" onchange="finCmp(this.value)"><option value="none" '+(cmp==='none'?'selected':'')+'>'+(ar?'بلا مقارنة':'No comparison')+'</option><option value="prev" '+(cmp==='prev'?'selected':'')+'>'+(ar?'مقابل الفترة السابقة':'vs previous period')+'</option><option value="yoy" '+(cmp==='yoy'?'selected':'')+'>'+(ar?'مقابل نفس الفترة العام الماضي':'vs same period last year')+'</option></select>';
    var out='<div class="card" style="padding:14px 16px;margin-bottom:14px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:13px">'+(ar?'المقارنة':'Compare to')+'</b>'+sel+'</div>';
    if(cmp==='none')return '';
    if(FIN.p.year==='all'){
      out+='<div style="font-size:12px;color:var(--muted);margin-top:8px">'+(ar?'اختر سنة محددة أعلاه أولاً — لا يوجد «سابق» لكل السنوات معًا.':'Pick a specific year above first — there is no "previous" for all years at once.')+'</div></div>';
      return out;
    }
    var cp=finCompPeriodOf(cmp);
    if(!cp){out+='</div>';return out;}
    var ct=finPeriodTotals(cp);
    /* 2026-09-02 (watch cycle 7, scripts/qa/probe-compare-attacks.mjs) — a period with NO
       invoices at all is not "0 SAR of revenue". Printing 0 and a −100% / +0% Δ against it is
       a fabricated number (M8), the same shape as the A1 collections fix: it reads as "we
       earned nothing then", when the truth is "there is no data for that period". Say which
       side is empty and draw no table. Both directions matter — an empty CURRENT period
       compared against a real one reads as a collapse that never happened. */
    var _curN=V.length;
    if(!_curN||!ct.n){
      var _who=[];
      if(!_curN)_who.push(ar?('هذه الفترة ('+finPeriodLabel()+')'):('this period ('+finPeriodLabel()+')'));
      if(!ct.n)_who.push(ar?('فترة المقارنة ('+finCompLabel(cp)+')'):('the comparison period ('+finCompLabel(cp)+')'));
      out+='<div style="font-size:12px;color:#B54708;margin-top:8px">⚠ '+(ar
        ?('لا توجد فواتير في '+_who.join(' ولا في ')+' — لا يوجد ما يُقارن به. (هذا ليس صفرًا: تلك الفترة بلا بيانات.)')
        :('No invoices in '+_who.join(' or ')+' — there is nothing to compare against. (That is not a zero: the period has no data.)'))+'</div></div>';
      return out;
    }
    var rows=[[ar?'الإيرادات':'Revenue',rev,ct.rev],[ar?'التكلفة':'Cost',cost,ct.cost],[ar?'الربح':'Profit',prof,ct.prof],
      [ar?'الهامش':'Margin',rev>0?(prof/rev*100):0,ct.rev>0?(ct.prof/ct.rev*100):0]];
    out+='<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:420px"><thead><tr style="text-align:'+(ar?'right':'left')+';color:var(--muted)"><th style="padding:6px 8px"></th><th style="padding:6px 8px;text-align:right">'+finPeriodLabel()+'</th><th style="padding:6px 8px;text-align:right">'+finCompLabel(cp)+'</th><th style="padding:6px 8px;text-align:right">'+(ar?'الفرق':'Δ')+'</th></tr></thead><tbody>'+rows.map(function(r){
      var isMargin=r[0]===(ar?'الهامش':'Margin');
      var d=r[1]-r[2], pct=r[2]!==0?(d/Math.abs(r[2])*100):(r[1]!==0?null:0);
      var fmt=function(n){return isMargin?(n.toFixed(1)+'%'):(money0(n)+' SAR');};
      var col=d>0?'#0F6E56':(d<0?'#D92D20':'var(--muted)');
      var dTxt=isMargin?((d>=0?'+':'')+d.toFixed(1)+' pts'):((d>=0?'+':'')+money0(d)+' SAR'+(pct===null?'':' ('+(pct>=0?'+':'')+Math.round(pct)+'%)'));
      return '<tr style="border-top:1px solid var(--line,#eee)"><td style="padding:6px 8px;font-weight:600">'+r[0]+'</td><td style="padding:6px 8px;text-align:right">'+fmt(r[1])+'</td><td style="padding:6px 8px;text-align:right;color:var(--muted)">'+fmt(r[2])+'</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:'+col+'">'+dTxt+'</td></tr>';
    }).join('')+'</tbody></table></div>';
    var warn=[]; if(_noCost>0)warn.push(ar?'هذه الفترة':'this period'); if(ct.noCost>0)warn.push(ar?'فترة المقارنة':'the comparison period');
    if(warn.length){out+='<div style="font-size:11.5px;color:#B54708;margin-top:8px">⚠ '+(ar
      ?('التكلفة غير مكتملة في '+warn.join(' و')+' — الفرق قد لا يعكس التغيّر الحقيقي بعد.')
      :('Cost is incomplete in '+warn.join(' and ')+' — the difference may not reflect the real change yet.'))+'</div>';}
    out+='</div>';
    return out;
  })();
  /* Plan vs actual (executive dashboard: expected/confirmed/actual) — actuals derived live. */
  var _ty=(FIN.p.year!=='all')?+FIN.p.year:(new Date()).getFullYear();
  var tgt=(FIN.targets||[]).find(function(t){return +t.year===_ty;});
  var frac=1,fLbl='';
  if(FIN.p.part!=='all'){ frac=(/^Q/.test(FIN.p.part))?0.25:(/^H/.test(FIN.p.part))?0.5:(FIN.p.part.indexOf('M:')===0?1/12:1); fLbl=isArF()?' · تقديري نسبةً للفترة':' · pro-rated for the period'; }
  if(tgt||canFinEdit()){
    var _exp=tgt?Math.round((+tgt.expected_sar||0)*frac):0, _conf=tgt?Math.round((+tgt.confirmed_sar||0)*frac):0;
    var _attT=_exp>0?Math.round(rev/_exp*100):0,_att=Math.min(100,_attT);
    h+='<div class="card" style="padding:16px;margin-bottom:14px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3 class="finh" style="margin:0">'+(isArF()?'الخطة مقابل الفعلي':'Plan vs actual')+'<i>'+_ty+fLbl+'</i></h3>'+(canFinEdit()?('<button class="btn sm" onclick="finSetTargets('+_ty+')">'+(isArF()?'تعديل الأرقام':'Set targets')+'</button>'):'')+'</div>';
    if(tgt){
      var _pm=function(lbl,val,col){return '<div style="flex:1;min-width:120px"><div style="font-size:11px;color:var(--muted)">'+lbl+'</div><div style="font-size:19px;font-weight:800;color:'+col+'">'+moneyS(val)+' <span style="font-size:10px;font-weight:400">SAR</span></div></div>';};
      h+='<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px">'
        +_pm(isArF()?'متوقع':'Expected',_exp,'#B54708')
        +_pm(isArF()?'مؤكد (عقود)':'Confirmed (signed)',_conf,'#175CD3')
        +_pm(isArF()?'فعلي (مدقق)':'Actual (verified)',rev,'#0F6E56')
        +'<div style="flex:2;min-width:180px"><div style="font-size:11px;color:var(--muted)">'+(isArF()?'نسبة تحقق المتوقع':'Of expected achieved')+' · '+_attT+'%'+(_attT>100?(isArF()?' · فوق الخطة ✓':' · above plan ✓'):'')+'</div><div style="background:#EEF0F5;border-radius:8px;height:14px;margin-top:8px;overflow:hidden"><div style="height:100%;width:'+_att+'%;background:linear-gradient(90deg,#E54525,#F26721)"></div></div></div>'
        +'</div>';
    } else {
      h+='<div class="ch-sub" style="margin-top:8px">'+(isArF()?'لا توجد أرقام خطة لهذه السنة بعد — اضغط «تعديل الأرقام».':'No plan numbers for this year yet — click Set targets.')+'</div>';
    }
    h+='</div>';
  }

  var MO=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var by={};var _noMonth=0;
  V.forEach(function(r){var k=r.month||'?';if(k==='?')_noMonth++;by[k]=by[k]||{r:0,p:0};by[k].r+=+r.revenue_sar;by[k].p+=+r.profit_sar;});
  /* 2026-09-03 (watch cycle 23): draw EVERY month, not only the ones with business in them.
     Filtering to months that have rows put January, February, May and December side by side as
     four adjacent bars — a year with two long silences in it read as four consecutive months, and
     a year holding one invoice read as a single full-height bar spanning the whole chart. A chart
     makes a claim about shape, and shape is the one thing a correct total cannot correct. An
     empty month is now an empty slot: it says "nothing was billed here", which is information. */
  MO.forEach(function(m){ by[m]=by[m]||{r:0,p:0}; });
  var mos=MO;var mx=Math.max.apply(null,mos.map(function(m){return by[m].r;}).concat([1]));
  h+='<div class="card" style="padding:16px;margin-bottom:14px"><h3 class="finh" style="margin:0 0 12px">'+(isArF()?'\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0631\u0628\u062d \u0634\u0647\u0631\u064a\u064b\u0627':'Monthly revenue & profit')+(window.finPeriodLabel?'<i>'+finPeriodLabel()+'</i>':'')+'</h3><div style="overflow-x:auto"><div style="display:flex;gap:14px;align-items:flex-end;height:150px;min-width:520px">'+mos.map(function(m){
    var hR=Math.round(by[m].r/mx*120),hP=Math.round(by[m].p/mx*120);
    var lbl=isArF()?((typeof MO_AR!=='undefined'&&MO_AR[m])||m):m.slice(0,3);   // 2026-09-02: Arabic month names in Arabic
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;gap:3px;align-items:flex-end;height:124px"><div title="'+(isArF()?'الإيرادات ':'Revenue ')+money(by[m].r)+'" style="width:22px;height:'+Math.max(hR,2)+'px;background:#FF6B00;border-radius:4px 4px 0 0"></div><div title="'+(isArF()?'الربح ':'Profit ')+money(by[m].p)+'" style="width:22px;height:'+Math.max(hP,2)+'px;background:#303848;border-radius:4px 4px 0 0"></div></div><div style="font-size:10px;color:var(--muted)">'+lbl+'</div><div style="font-size:9.5px;font-weight:700"><span dir="ltr" style="unicode-bidi:isolate">'+moneyS(by[m].r)+'</span></div></div>';
  }).join('')+'</div></div><div style="font-size:10px;color:var(--muted);margin-top:8px"><span style="color:#FF6B00">\u25a0</span> '+(isArF()?'\u0625\u064a\u0631\u0627\u062f\u0627\u062a':'Revenue')+' &nbsp;<span style="color:#303848">\u25a0</span> '+(isArF()?'\u0631\u0628\u062d':'Profit')+'</div></div>';

  return h;
}
window.finQ=function(v){FIN.f.quarter=v;render();};
/* Drill from a canonical client row \u2192 Ledger filtered to that client (all its invoice groups). */
window.finClient=function(key,name){FIN.tab='ledger';FIN.f.clientKey=key||null;FIN.f.clientName=name||'';FIN.f.client='all';
  // The Ledger tab now reads finance_transactions (Phase 2) — carry the drill-down across
  // by resolving the same business_id the old key encoded, so "Top clients" still filters.
  try{ TXN.f.business=(key&&key.indexOf('biz:')===0)?key.slice(4):'all'; }catch(_){}
  render();};

/* ===== Phase 2 Ledger rebuild (2026-08-21) =====================================
   Staged ALONGSIDE finance_invoices — Overview / Clients & collections / Report
   Builder / income-by-service above this point are UNTOUCHED and keep reading
   finance_invoices via FIN/live(). Only this tab reads the new tables:
   finance_transactions (+finance_cogs_expenses for confirmed cost, +client_profiles
   for the prepaid/postpaid/tender label, +payment_receipts for what's been paid).
   Rules from docs/DIRECT_PAYMENTS_MODEL.md Round 11 (owner ruling 2026-08-21):
     - Company is the shape, not a toggle: one company row, its profiles nested
       under it, every transaction/invoice row labelled prepaid/postpaid/tender —
       in the UI and in the export.
     - KPI strip is CONFIRMED ONLY: a transaction counts once it has an invoice
       number OR its expense_status is 'ready' (Round 8's stage rule). A 'pending'
       transaction shows its cost_estimate_sar tagged "est." at row level and never
       reaches the headline totals (Round 7).
     - Overdue is a mirror, never invented: only rendered when overdue===true;
       null (not yet mirrored) shows nothing, never "not overdue" (Round 11).
       An invoiced row can be overdue too — the tile/filter/marker count the flag,
       not the stage label (2026-09-02, scripts/qa/probe-ledger-attacks.mjs). */
var TXN={rows:null,profiles:null,loading:false,collapsed:{},
  f:{q:'',profileType:'all',business:'all',stage:'all'}};
function txnLoad(cb){
  if(TXN.loading)return; TXN.loading=true;
  var c=fc(); if(!c){TXN.loading=false;return;}
  /* 2026-09-03 (watch cycle 13, probe-scale-attacks): both of these reads used to be a single
     unpaged select. Past 1000 transactions the Ledger silently showed the first 1000 and computed
     its confirmed revenue / cost / outstanding / Overdue count from them; past 1000 client
     profiles, every transaction beyond the cut lost its company and profile type and fell out of
     the profile filter. finance_transactions grows faster than invoices — one invoice can carry
     many transactions — so this was a matter of when, not if. Both page now. */
  finPageAll(function(){return c.from('finance_transactions').select('*').is('deleted_at',null).order('created_at_source',{ascending:false}).order('id',{ascending:true});}, function(r){
    TXN.loading=false;
    if(r.error){ if(window.console)console.warn('finance_transactions load',r.error); TXN.rows=[]; }
    else TXN.rows=r.data||[];
    finPageAll(function(){return c.from('client_profiles').select('id,business_id,direct_client_id,profile_type,payment_terms,billing_cycle,status').order('id',{ascending:true});}, function(pr){
      TXN.profiles={}; FIN.profileTypeByBiz=FIN.profileTypeByBiz||{};
      ((pr&&!pr.error&&pr.data)||[]).forEach(function(p){
        TXN.profiles[p.id]=p;
        if(p.business_id&&(!p.status||String(p.status).toLowerCase()==='active')) FIN.profileTypeByBiz[p.business_id]=p.profile_type||null;
      });
      if(cb)cb(); try{if(current==='finance'&&FIN.tab==='ledger')render();}catch(_){}
    });
  });
}
try{window.TXN=TXN;window.txnLoad=txnLoad;}catch(_){}
/* 2026-09-03 (watch cycle 19) — the second half of what watch cycle 2 fixed for invoices, parked
   at the time and now due. Every Ledger total reads `+r.amount_sar||0`. A row whose amount
   arrives as a formatted string ("1,250.00") makes that NaN, and `||0` turns it into a clean
   ZERO — so the same string reads 1,250 on Performance (where live() sanitises it) and 0 on the
   Ledger, two tabs of one page disagreeing, with nothing on screen saying which is right.
   Supabase returns numerics as numbers, so the live path is safe today; a row pushed into
   TXN.rows by another layer is not. Same rule as everywhere else: read every amount through one
   place, repair what is repairable, and COUNT what is not so the tab can say so (M8). */
var TXN_MONEY_FIELDS=['amount_sar','cost_confirmed_sar','cost_estimate_sar','amount_received_sar','amount_remaining_sar'];
function txnSanitizeMoney(r){
  var bad=null;
  for(var i=0;i<TXN_MONEY_FIELDS.length;i++){
    var k=TXN_MONEY_FIELDS[i], v=r[k];
    if(v==null||v===''){ r[k]=0; continue; }
    if(typeof v==='number'){ if(!isFinite(v)){ r[k]=0; (bad=bad||[]).push(k); } continue; }
    var n=parseFloat(String(v).replace(/[,\s]/g,''));
    if(isFinite(n)&&/^-?[\d.,\s]+$/.test(String(v).trim())) r[k]=n; else { r[k]=0; (bad=bad||[]).push(k); }
  }
  if(bad) r._badMoney=bad;   // sticky, like the invoice one: the first pass rewrites the value
  return r;
}
/* 2026-09-07 (round 68) — THE STANDING EXCLUSION, ON THIS TABLE TOO.
   This file's own header states the doctrine the Takamol incident taught: "a standing exclusion
   must hold no matter how a row arrived, so live() — the one chokepoint every total and export in
   this file reads through — re-checks client_group/customer_raw_name against the exclusion list on
   every call, not just once at load." That was written for finance_INVOICES. Transactions are a
   second money table, loaded from the same source system, and this is their chokepoint — and it
   sanitised money and did nothing else. Measured with a transaction on the standing-excluded
   client: the Transactions tab's confirmed revenue read 751,000 SAR of which 750,000 was theirs,
   and BOTH excluded rows were written into the file finTxnCSV() hands the owner to send onward.
   Transactions carry a stronger key than invoices do, which is why this can be done properly
   rather than by name alone: an exclusion entry has a clientId, and a transaction's client_profile
   row has direct_client_id. That is the real client-ID bridge js/62's comment says it is waiting
   for, already present on this table — so a second spelling of the company name, or a rename, no
   longer brings the money back. The name is still checked, for a row whose profile is missing or
   whose id was never filled in. */
function txnLive(){
  var rows=(TXN.rows||[]);
  for(var i=0;i<rows.length;i++)txnSanitizeMoney(rows[i]);
  try{
    if(typeof window.finExclusionCheck!=='function') return rows;
    var list=(typeof window.finExclusionList==='function')?(window.finExclusionList()||[]):[];
    var ids={},any=false;
    list.forEach(function(e){ var c=e&&e.clientId; if(c!=null&&String(c).trim()!==''){ ids[String(c).trim()]=1; any=true; } });
    return rows.filter(function(r){
      var prof=(TXN.profiles||{})[r.client_profile_id];
      if(any&&prof&&prof.direct_client_id!=null&&ids[String(prof.direct_client_id).trim()]) return false;
      /* _finBizName, not bizName: `bizName` is a LOCAL of the transactions render function
         (var bizName=_finBizName, further down), so at this point in the file it resolves to
         nothing and `typeof bizName==='function'` is false. Written that way first, the name
         test silently never ran — the guard was there and did nothing, which the probe caught
         only because its fixture includes a transaction with no client profile, where the name
         is the only thing that can hold the row. */
      var nm=(typeof _finBizName==='function')?_finBizName(r.business_id):'';
      if(nm&&window.finExclusionCheck(nm)) return false;
      return true;
    });
  }catch(_){ return rows; }
}
/* Whether the exclusion list has arrived at all. finExclusionCheck() answers "not excluded" both
   for a client that is not on the list AND for a list that has not loaded, so a total computed
   before app_settings lands quietly includes money the owner ruled out (watch cycle 40 measured
   exactly that on the merge dialog). A number on screen can degrade honestly; a FILE cannot, so
   finTxnCSV refuses while the answer is unknown. Duplicated from js/62's settingsLanded() on
   purpose and noted in docs/BACKLOG.md: the right home for it is finExclusionCheck itself, which
   is the only code that can tell "not excluded" from "cannot answer yet", and that file is the
   oversight lane's. */
function txnExclusionsKnown(){ try{ return !!(DB.settings&&Object.keys(DB.settings).length); }catch(_){ return false; } }
try{ window.txnSanitizeMoney=txnSanitizeMoney; window.txnLive=txnLive; }catch(_){}
function txnStage(r){
  // Round 8's two-field derivation, plus Round 11's Overdue mirror.
  if(r.invoice_no)return 'invoiced';
  if(r.overdue===true)return 'overdue';
  if(r.expense_status==='ready')return 'ready';
  return 'pending';
}
var TXN_STAGE_LBL={pending:['Expenses pending','بانتظار المصاريف'],ready:['Ready to invoice','جاهز للفوترة'],
  invoiced:['Invoiced','مفوترة'],overdue:['Overdue','متأخر']};
var TXN_STAGE_COLOR={pending:'#B54708',ready:'#175CD3',invoiced:'#0F6E56',overdue:'#D92D20'};
function txnConfirmed(r){ return txnStage(r)==='ready'||txnStage(r)==='invoiced'; }
/* 2026-09-02 (watch cycle 4): Overdue is a MIRROR of Direct Payments' flag, and the flag can
   be true on an invoiced row too — invoice_no winning the stage label must not hide it. The
   Overdue tile, the Overdue stage filter and the row marker all read the flag directly;
   txnStage() keeps its precedence so confirmed totals are untouched. */
function txnOverdue(r){ return r.overdue===true; }
var TXN_TYPE_LBL={prepaid:['Prepaid','مسبق الدفع'],postpaid:['Postpaid','آجل الدفع'],tender:['Tender','مناقصة']};
window.finTxnCSV=function(){
  /* 2026-09-06 (watch cycle 30): the READ-OUT paths had no check of their own. Cycle 12 found
     and closed exactly this shape on all ten Finance WRITE paths — "a stale tab, a role changed
     while it was open, or a share view leaves the function one call away" — and the exports were
     never looked at. They build a file out of state the page filled in while it was still allowed
     to render, so a tab that was an admin's a moment ago hands over every invoice, every
     transaction and the whole report to a session the page itself now refuses in words. Same rule
     as the screen: canFinView() is what rFinance checks before it will render at all. This is not
     claimed as a boundary against someone reading the rows out of devtools — the rows are already
     in the tab — only that pressing something must not produce Finance's file for a person
     Finance is refused to. */
  if(typeof finMayExport==='function'&&!finMayExport()){alert(isArF()?'التصدير غير متاح لهذه الصلاحية.':'Export is not available for this access level.');return;}
  if(!txnExclusionsKnown()){alert(isArF()
    ?'ليس بعد — لم تكتمل قراءة قائمة الاستبعاد، فلا يمكن التحقق من أن هذا الملف لا يحتوي على عميل مستبعد. أمهله لحظة ثم أعد المحاولة.'
    :'Not yet — the exclusion list has not finished loading, so this file cannot be checked for a client this workspace excludes. Give it a moment and try again.');return;}
  var L=TXN._csvRows||[]; if(!L.length){alert(isArF()?'لا صفوف للتصدير':'No rows to export');return;}
  var cols=['company','profile_type','direct_client_id','transaction_ref','invoice_no','zatca_dpin','service_type','stage','amount_sar','cost_confirmed_sar','cost_estimate_sar','amount_received_sar','amount_remaining_sar','overdue','created_at_source'];
  var csv='\ufeff'+cols.join(',')+'\n'+L.map(function(r){return cols.map(function(c){var v=csvGuard(r[c]);return '"'+v.replace(/"/g,'""')+'"';}).join(',');}).join('\n');   // escaped BOM, not a literal invisible byte (2026-09-02)
  var b=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='direct-ledger-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};
window.finTxnF=function(k,v){TXN.f[k]=v; if(k==='business'){FIN.f.clientKey=null;FIN.f.clientName='';} render();};
window.txnToggleCo=function(bizId){TXN.collapsed[bizId]=!TXN.collapsed[bizId];render();};
function rLedger(){
  var _lh=function(en,ar){return isArF()?ar:en;};
  if(TXN.rows==null||TXN.profiles==null){ txnLoad(); return '<div class="card" style="padding:40px;text-align:center;color:var(--muted)">'+_lh('Loading the ledger…','جارِ تحميل السجل…')+'</div>'; }
  var bizName=_finBizName;
  /* 2026-09-02 (watch cycle 6): a drill-down from a Clients row whose client has no linked
     company (or is an alias group) used to open the WHOLE ledger with nothing saying so. Say
     which client was asked for and why no company filter applies; clears with the ✕ or the
     moment a company is chosen in the filter. */
  var _drillNote='';
  if(FIN.f&&FIN.f.clientKey&&!/^biz:/.test(FIN.f.clientKey)&&TXN.f.business==='all'){
    _drillNote='<div class="card" style="padding:10px 14px;margin-bottom:10px;background:#FFF3EC;border:1px solid #F6C9A8;font-size:12.5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      +'<span>'+(isArF()?('طلبت «'+escF(FIN.f.clientName||'')+'» — لا توجد شركة مرتبطة بهذا الاسم بعد، لذا يُعرض السجل لكل الشركات.'):('You asked for <b>'+escF(FIN.f.clientName||'')+'</b> — no linked company for that name yet, so the Ledger below shows <b>all companies</b>. Link it on the Clients page to filter here.'))+'</span>'
      +'<button class="btn ghost sm" style="margin-inline-start:auto" onclick="finClientClear()">✕</button></div>';
  }
  /* 2026-09-06 (round 52) — the SAME defect as the note above, a second time, uncaught since the
     Phase 2 rebuild. "Income by service line" says "Tap a service to see its invoices" and sends
     you here with FIN.f.service set — a key NOTHING reads any more, because this tab lists
     finance_transactions by company and has no service filter at all. So the tap opened the whole
     ledger, unfiltered, silently, for someone who asked for one service. Say it plainly rather
     than let the page pass itself off as the answer. A per-service invoice list does not exist
     yet — recorded in docs/BACKLOG.md; this note is honest, not a substitute for building it. */
  if(FIN.f&&FIN.f.serviceDrill){
    _drillNote+='<div class="card" style="padding:10px 14px;margin-bottom:10px;background:#FFF3EC;border:1px solid #F6C9A8;font-size:12.5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      +'<span>'+(isArF()?('طلبت خدمة «'+escF(FIN.f.serviceDrill)+'» — هذا السجل يسرد المعاملات حسب الشركة ولا يحتوي على فلتر للخدمة، لذلك يُعرض كل شيء. أرقام هذه الخدمة في جدول «الدخل حسب نوع الخدمة» في الأداء.')
        :('You asked for the service <b>'+escF(FIN.f.serviceDrill)+'</b> \u2014 this Ledger lists transactions by company and has no service filter, so it is showing <b>everything</b>. That service\u2019s own figures are the row you tapped, on Performance.'))+'</span>'
      +'<button class="btn ghost sm" style="margin-inline-start:auto" onclick="finServiceClear()">✕</button></div>';
  }
  var rows=txnLive().filter(function(r){
    var f=TXN.f, prof=TXN.profiles[r.client_profile_id];
    if(f.profileType!=='all'&&(!prof||prof.profile_type!==f.profileType))return false;
    if(f.business!=='all'&&r.business_id!==f.business)return false;
    if(f.stage==='overdue'){ if(!txnOverdue(r))return false; }
    else if(f.stage!=='all'&&txnStage(r)!==f.stage)return false;
    if(f.q){var q=f.q.toLowerCase();var nm=bizName(r.business_id)||'';if(((nm)+' '+(r.transaction_ref||'')+' '+(r.invoice_no||'')+' '+(r.zatca_dpin||'')+' '+(r.product||'')).toLowerCase().indexOf(q)<0)return false;}
    return true;
  });
  /* 2026-09-03 (watch cycle 19) — parked in watch cycle 4, now due. Two rows carrying the SAME
     transaction reference were listed side by side with nothing to say so, and their amounts were
     both counted. Direct Payments' export has produced repeated refs before. This does not guess
     which one is right — deduplicating would be inventing an answer — it MARKS them, so the
     person can see there are two and decide. Counted across every row the ledger holds, not just
     the filtered view, or a filter could hide the twin and make the marker lie. */
  var _refSeen={};
  (TXN.rows||[]).forEach(function(r){ var k=r.transaction_ref; if(!k)return; _refSeen[k]=(_refSeen[k]||0)+1; });
  var _dupRefs=Object.keys(_refSeen).filter(function(k){return _refSeen[k]>1;});
  // Confirmed-only KPI strip (Round 7/8) — pending never blends in.
  var cRev=0,cCost=0,cProf=0,pendCount=0,pendEst=0,overdueCount=0;
  rows.forEach(function(r){
    if(txnConfirmed(r)){ cRev+=+r.amount_sar||0; cCost+=+r.cost_confirmed_sar||0; cProf+=(+r.amount_sar||0)-(+r.cost_confirmed_sar||0); }
    else { pendCount++; pendEst+=+r.cost_estimate_sar||0; }
    if(txnOverdue(r))overdueCount++;   // every mirrored overdue row, invoiced ones included
  });
  // Company is the primary row, profiles nest under it (owner ruling 2026-08-21).
  var byBiz={},order=[];
  rows.forEach(function(r){ if(!byBiz[r.business_id]){byBiz[r.business_id]=[];order.push(r.business_id);} byBiz[r.business_id].push(r); });
  order.sort(function(a,b){return (bizName(a)||'').localeCompare(bizName(b)||'');});
  // exports always carry the company + profile label, per row (owner ruling)
  TXN._csvRows=rows.map(function(r){var p=TXN.profiles[r.client_profile_id];return Object.assign({},r,{company:bizName(r.business_id)||r.business_id,profile_type:p?p.profile_type:'',direct_client_id:p?p.direct_client_id:'',stage:txnStage(r)});});

  var h=_drillNote+'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #0F6E56"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed revenue','الإيراد المؤكد')+'</div><div style="font-size:18px;font-weight:800;color:#0F6E56" title="'+money(cRev)+' SAR">'+moneyS(cRev)+' <span style="font-size:10px;font-weight:400">SAR</span>'+finExactUnder(cRev)+'</div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #B54708"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed cost','التكلفة المؤكدة')+'</div><div style="font-size:18px;font-weight:800;color:#B54708" title="'+money(cCost)+' SAR">'+moneyS(cCost)+' <span style="font-size:10px;font-weight:400">SAR</span>'+finExactUnder(cCost)+'</div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #175CD3"><div style="font-size:11px;color:var(--muted)">'+_lh('Confirmed profit','الربح المؤكد')+'</div><div style="font-size:18px;font-weight:800;color:#175CD3" title="'+money(cProf)+' SAR">'+moneyS(cProf)+' <span style="font-size:10px;font-weight:400">SAR</span>'+finExactUnder(cProf)+'</div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid #B54708"><div style="font-size:11px;color:var(--muted)">'+_lh('Pending (est. only)','بانتظار المصاريف (تقديري)')+'</div><div style="font-size:18px;font-weight:800;color:#8b5b1f">'+pendCount+' <span style="font-size:10px;font-weight:400">· '+moneyS(pendEst)+' '+_lh('est.','تقديري')+'</span></div></div>'
    +'<div class="card" style="padding:12px 14px;border-top:3px solid '+(overdueCount?'#D92D20':'#E5E7EB')+'"><div style="font-size:11px;color:var(--muted)">'+_lh('Overdue','متأخر')+'</div><div style="font-size:18px;font-weight:800;color:'+(overdueCount?'#D92D20':'#667085')+'">'+overdueCount+'</div></div>'
    +'</div><div class="ch-sub" style="margin:-4px 0 10px">'+_lh('Confirmed = it has an invoice number, or its expense is marked Ready. A pending row only shows an early estimate — that number is not included above.','المؤكد = له رقم فاتورة، أو مصروفه بحالة جاهز. الصف المعلّق يعرض تقديرًا مبكرًا فقط — هذا الرقم غير مُدرج أعلاه.')+'</div>';
  /* 2026-09-03 (watch cycle 19): say it, the way the Overview has said it since watch cycle 2 —
     a row whose amount cannot be read is counted as zero, and the person is told how many. */
  if(_dupRefs.length){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 12px">\u26a0 '+(isArF()
      ? (_dupRefs.length+' \u0645\u0631\u062c\u0639 \u0645\u0639\u0627\u0645\u0644\u0629 \u0645\u0643\u0631\u0631 \u2014 \u0623\u0643\u062b\u0631 \u0645\u0646 \u0635\u0641 \u064a\u062d\u0645\u0644 \u0646\u0641\u0633 \u0627\u0644\u0645\u0631\u062c\u0639\u060c \u0648\u0643\u0644\u0651 \u0645\u0646\u0647\u0627 \u0645\u062d\u0633\u0648\u0628. \u0631\u0627\u062c\u0639\u0647\u0627 \u0641\u064a Direct Payments.')
      : (_dupRefs.length+' transaction reference'+(_dupRefs.length>1?'s appear':' appears')+' on more than one row, and every copy is counted. Check them in Direct Payments \u2014 nothing was merged or dropped here.'))+'</div>';
  }
  var _txnBad=rows.filter(function(r){return r._badMoney;}).length;
  if(_txnBad>0){
    h+='<div style="font-size:12px;color:#B54708;margin:-6px 0 12px">\u26a0 '+(isArF()
      ? (_txnBad+' \u0635\u0641/\u0635\u0641\u0648\u0641 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0633\u062c\u0644 \u062a\u062d\u0645\u0644 \u0645\u0628\u0627\u0644\u063a \u063a\u064a\u0631 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 (\u0644\u064a\u0633\u062a \u0623\u0631\u0642\u0627\u0645\u064b\u0627) \u2014 \u062d\u064f\u0633\u0628\u062a \u0643\u0635\u0641\u0631 \u0647\u0646\u0627.')
      : (_txnBad+' row'+(_txnBad>1?'s':'')+' in this ledger carr'+(_txnBad>1?'y':'ies')+' an unreadable amount (not a number) \u2014 counted as 0 here.'))+'</div>';
  }

  h+='<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px">';
  h+='<input placeholder="'+_lh('Search company / ref / invoice / DPIN…','بحث عن شركة / مرجع / فاتورة…')+'" value="'+escF(TXN.f.q)+'" style="'+SS+';min-width:200px" oninput="finTxnF(\'q\',this.value)">';
  h+='<select style="'+SS+'" onchange="finTxnF(\'profileType\',this.value)"><option value="all">'+_lh('All profile types','كل أنواع الملفات')+'</option><option value="prepaid" '+(TXN.f.profileType==='prepaid'?'selected':'')+'>'+_lh('Prepaid','مسبق الدفع')+'</option><option value="postpaid" '+(TXN.f.profileType==='postpaid'?'selected':'')+'>'+_lh('Postpaid','آجل الدفع')+'</option><option value="tender" '+(TXN.f.profileType==='tender'?'selected':'')+'>'+_lh('Tender','مناقصة')+'</option></select>';
  h+='<select style="'+SS+'" onchange="finTxnF(\'stage\',this.value)"><option value="all">'+_lh('All stages','كل المراحل')+'</option><option value="pending" '+(TXN.f.stage==='pending'?'selected':'')+'>'+_lh('Expenses pending','بانتظار المصاريف')+'</option><option value="ready" '+(TXN.f.stage==='ready'?'selected':'')+'>'+_lh('Ready to invoice','جاهز للفوترة')+'</option><option value="invoiced" '+(TXN.f.stage==='invoiced'?'selected':'')+'>'+_lh('Invoiced','مفوترة')+'</option><option value="overdue" '+(TXN.f.stage==='overdue'?'selected':'')+'>'+_lh('Overdue','متأخر')+'</option></select>';
  /* 2026-09-06 (round 52): this select's options were built from `order`, which is the list of
     companies IN THE FILTERED ROWS. So the moment a filter (or a drill-down from a client card)
     narrowed to a company with nothing to show, that company vanished from its own dropdown and
     the control fell back to reading "All companies" — while it was in fact hiding everything.
     The control has to be able to state the filter it is applying, so the list comes from every
     company the ledger holds, and the current pick is added even if the ledger holds none. */
  var _allBiz=[]; (function(){ var seen={}; txnLive().forEach(function(r){ if(r.business_id&&!seen[r.business_id]){seen[r.business_id]=1;_allBiz.push(r.business_id);} });
    if(TXN.f.business!=='all'&&!seen[TXN.f.business])_allBiz.push(TXN.f.business);
    _allBiz.sort(function(a,b){return (bizName(a)||'').localeCompare(bizName(b)||'');}); })();
  h+='<select style="'+SS+';max-width:240px" onchange="finTxnF(\'business\',this.value)"><option value="all">'+_lh('All companies','كل الشركات')+'</option>'+_allBiz.map(function(uid){return '<option value="'+escF(uid)+'" '+(TXN.f.business===uid?'selected':'')+'>'+escF(bizName(uid)||uid)+'</option>';}).join('')+'</select>';
  h+='<button class="btn sm" onclick="finTxnCSV()">⬇ '+_lh('Excel (CSV)','إكسل (CSV)')+'</button>';
  h+='<span style="margin-left:auto;font-size:12px">'+(isArF()?('<b>'+rows.length+'</b> معاملة عبر <b>'+order.length+'</b> شركة'):('<b>'+rows.length+'</b> transactions across <b>'+order.length+'</b> compan'+(order.length===1?'y':'ies')))+'</span></div>';

  if(!order.length){ h+='<div class="card" style="padding:30px;text-align:center;color:var(--muted)">'+_lh('No transactions match.','لا توجد معاملات مطابقة.')+'</div>'; return h; }

  order.forEach(function(bizId){
    var list=byBiz[bizId].slice().sort(function(a,b){return (b.created_at_source||'').localeCompare(a.created_at_source||'');});
    var coRev=0,coCost=0; list.forEach(function(r){ if(txnConfirmed(r)){coRev+=+r.amount_sar||0;coCost+=+r.cost_confirmed_sar||0;} });
    var isCollapsed=!!TXN.collapsed[bizId];
    h+='<div class="card" style="padding:0;margin-bottom:10px;overflow:hidden">';
    h+='<div style="padding:10px 14px;background:#F6F7F9;display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer" onclick="txnToggleCo(\''+bizId+'\')">'
      +'<span style="font-weight:800;font-size:13.5px">'+(isCollapsed?'▸':'▾')+' '+escF(bizName(bizId)||bizId)+'</span>'
      +'<span style="font-size:11px;color:var(--muted)">'+list.length+' '+_lh('transactions','معاملة')+'</span>'
      +'<span style="margin-left:auto;font-size:12px"><b style="color:#0F6E56">'+money0(coRev)+'</b> '+_lh('rev','إيراد')+' · <b style="color:#B54708">'+money0(coCost)+'</b> '+_lh('cost','تكلفة')+' <span style="color:var(--muted);font-size:10.5px">('+_lh('confirmed only','مؤكد فقط')+')</span></span></div>';
    if(!isCollapsed){
      h+='<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse;min-width:990px"><thead><tr style="background:#303848;color:#fff;text-align:'+(isArF()?'right':'left')+'"><th style="padding:7px 8px">'+_lh('Date','التاريخ')+'</th><th style="padding:7px 8px">'+_lh('Profile','الملف')+'</th><th style="padding:7px 8px">'+_lh('Ref / Invoice','المرجع / الفاتورة')+'</th><th style="padding:7px 8px">'+_lh('Service','الخدمة')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Amount','المبلغ')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Cost','التكلفة')+'</th><th style="padding:7px 8px;text-align:right">'+_lh('Profit','الربح')+'</th><th style="padding:7px 8px">'+_lh('Stage','المرحلة')+'</th><th style="padding:7px 8px">'+_lh('Payment','السداد')+'</th></tr></thead><tbody>';
      list.forEach(function(r){
        var p=TXN.profiles[r.client_profile_id];
        var tl=p&&TXN_TYPE_LBL[p.profile_type]?TXN_TYPE_LBL[p.profile_type]:['—','—'];
        var stage=txnStage(r), sc=TXN_STAGE_COLOR[stage], sl=TXN_STAGE_LBL[stage];
        var confirmed=txnConfirmed(r);
        var costCell=confirmed?('<b>'+money0(r.cost_confirmed_sar)+'</b>')
          :(r.cost_estimate_sar!=null?('<span style="color:var(--muted);font-style:italic">'+money0(r.cost_estimate_sar)+' '+_lh('est.','تقديري')+'</span>'):'—');
        var profCell=confirmed?('<span style="color:#175CD3;font-weight:700">'+money0((+r.amount_sar||0)-(+r.cost_confirmed_sar||0))+'</span>'):'<span style="color:var(--muted)">—</span>';
        /* Payment column — owner ruling 2026-08-22 (tab 3: "every bit inside each one
           working"). Deliberately blank when nothing is expected yet — a pending
           transaction is not "Unpaid", and a red badge on every pending row would make the
           column noise instead of signal. */
        var _rec=+r.amount_received_sar||0, _rem=+r.amount_remaining_sar||0, _amt=+r.amount_sar||0;
        var payCell;
        if(_rec<=0&&_rem<=0&&_amt<=0)payCell='<span style="color:var(--muted)">—</span>';
        else if(_rem<=0&&_rec>0)payCell=badge(_lh('Paid','مدفوع'),'#E6F4EA','#0F6E56');
        else if(_rec>0&&_rem>0)payCell=badge(_lh('Partly paid','مدفوع جزئياً'),'#FEF0C7','#B54708');
        else if(_rem>0)payCell=badge(_lh('Unpaid','غير مدفوع'),'#FEE4E2','#D92D20');
        else payCell='<span style="color:var(--muted)">—</span>';
        var _dupMark=(r.transaction_ref&&_refSeen[r.transaction_ref]>1)
          ?(' '+badge(_lh(_refSeen[r.transaction_ref]+'\u00d7 same ref',_refSeen[r.transaction_ref]+'\u00d7 \u0646\u0641\u0633 \u0627\u0644\u0645\u0631\u062c\u0639'),'#FEF0C7','#B54708'))
          :'';
        var refCell=r.invoice_no
          ?('<a href="'+escF(pdInvoiceLink({invoice_no:r.invoice_no,zatca_dpin:r.zatca_dpin,direct_client_id:p?p.direct_client_id:''}))+'" target="_blank" rel="noopener" style="color:#175CD3;text-decoration:none">'+escF(r.invoice_no)+' ↗</a>')
          :escF(r.transaction_ref);
        h+='<tr style="border-top:1px solid var(--line,#eee)"><td style="padding:7px 8px;white-space:nowrap">'+escF((r.created_at_source||'').slice(0,10))+'</td>'
          +'<td style="padding:7px 8px">'+badge(_lh(tl[0],tl[1]),'#EEF0F5','#4B5563')+(p&&p.direct_client_id?(' <span style="color:var(--muted);font-size:10.5px">#'+escF(p.direct_client_id)+'</span>'):'')+'</td>'
          +'<td style="padding:7px 8px">'+refCell+_dupMark+'</td>'
          +'<td style="padding:7px 8px">'+escF(svcLabel(r.service_type))+'</td>'
          +'<td style="padding:7px 8px;text-align:right;font-weight:700">'+money0(r.amount_sar)+'</td>'
          +'<td style="padding:7px 8px;text-align:right">'+costCell+'</td>'
          +'<td style="padding:7px 8px;text-align:right">'+profCell+'</td>'
          +'<td style="padding:7px 8px">'+badge(_lh(sl[0],sl[1]),sc+'1a',sc)+((stage!=='overdue'&&txnOverdue(r))?(' '+badge(_lh('Overdue','متأخر'),TXN_STAGE_COLOR.overdue+'1a',TXN_STAGE_COLOR.overdue)):'')+'</td>'
          +'<td style="padding:7px 8px">'+payCell+'</td></tr>';
      });
      h+='</tbody></table></div>';
    }
    h+='</div>';
  });
  return h;
}
window.finF=function(k,v){FIN.f[k]=v;if(k==='client'){FIN.f.clientKey=null;FIN.f.clientName='';}render();};
window.finClientClear=function(){FIN.f.clientKey=null;FIN.f.clientName='';render();};
window.finServiceClear=function(){FIN.f.serviceDrill=null;render();};
/* Strategic & quality teams: jump from a project invoice to the proposal behind it. */
window.finSetOrigin=function(invNo){try{
  if(finRefuseWrite())return;   // 2026-09-02: the editor block is gated, guard the function too (finDelInv's pattern)
  var o=(document.getElementById('fin_origin')||{}).value||'booking';
  var p=((document.getElementById('fin_pref')||{}).value||'').trim();
  var c=fc(); if(!c)return;
  c.from('finance_invoices').update({origin:o,proposal_ref:p||null}).eq('invoice_no',invNo).is('deleted_at',null).select('id').then(function(r){
    if(r.error){alert((isArF()?'تعذر الحفظ: ':'Could not save: ')+r.error.message);return;}
    if(!r.data||!r.data.length){alert(isArF()?'لم يُحفظ — لم تؤكد قاعدة البيانات أي صف (صلاحيات أو فاتورة محذوفة). لم يتغير شيء.':'Not saved — the database confirmed no rows (permissions, or the invoice is deleted). Nothing changed.');return;}
    (FIN.rows||[]).forEach(function(x){ if(x.invoice_no===invNo&&!x.deleted_at){ x.origin=o; x.proposal_ref=p||null; } });
    var m=document.getElementById('finModal'); if(m)m.remove();
    if(typeof toast==='function')toast(isArF()?'تم الحفظ':'Saved');
    render();
  }).catch(function(){});
}catch(e){if(window.console)console.warn('finSetOrigin',e);}};
window.finOpenProposal=function(ref){try{
  /* 2026-09-08 (watch cycle 55) — "NO PROPOSAL WITH REF X", SAID ABOUT ONE THAT EXISTS.
     DB.offers is filled by js/35 from app_offers, on the same lazy schedule as the exclusion
     list that cycles 41–43 were spent on. Before it lands the list is empty, and this function
     used to answer in the definite: the proposal does not exist. Same mistake as
     finExclusionCheck()'s null meaning both "not on the list" and "no list yet" — except this
     one says the wrong half out loud, to a person, as a fact about their own records.
     The discriminator is specific to this call site and does not need a network read: THIS
     BUTTON ONLY EXISTS WHEN THE INVOICE CARRIES A proposal_ref, so a proposal was created at
     some point. An empty offers list here therefore means "not loaded yet", not "none exist" —
     a workspace with no proposals would have no invoice carrying a ref to click from.
     And the card is no longer closed before the answer is known. It used to be removed first, so
     "not yet" arrived with nowhere to go back to: the invoice being read was gone and the person
     was told, wrongly, that its proposal was missing. Now it closes only when there is somewhere
     to go. */
  var loaded=Array.isArray(DB.offers)&&DB.offers.length>0;
  var o=loaded?DB.offers.find(function(x){return (x.ref||'')===ref;}):null;
  if(o){ var m=document.getElementById('finModal'); if(m)m.remove(); openOffer=o.id;current='offers';render();window.scrollTo(0,0); return; }
  if(typeof toast==='function'){
    if(!loaded) toast(isArF()
      ?('لم تكتمل بعد قراءة قائمة العروض، لذا لا يمكن التحقق من المرجع '+ref+' الآن. أمهله لحظة ثم أعد المحاولة.')
      :('The proposals list has not finished loading, so '+ref+' cannot be checked yet. Give it a moment and try again.'));
    else toast(isArF()?('لا يوجد عرض بالمرجع '+ref):('No proposal with ref '+ref));
  }
}catch(e){if(window.console)console.warn('finOpenProposal',e);}};
/* Structure for linking into the Direct system (payments.directksa.com).
   The URL pattern is a setting so it can be corrected the moment we see the real
   Direct screens — placeholders: {invoice_no} {dpin} {client_id}. */
window.pdInvoiceLink=function(r){
  /* 2026-09-08 (watch cycle 55) — THE DEEP-LINK BRANCH BELOW IS UNREACHABLE BY IMPORT, and that
     is established rather than assumed. direct_uuid is in js/65's WRITABLE_INVOICE_FIELDS, so it
     would be carried if a file supplied it — but nothing supplies it: no CSV column maps to it,
     no builder assigns it, and the real Direct Payments invoice-export signature (Type, Product,
     Customer Name, Invoice Reference #, Invoice Number, Invoice Create Date, Invoice Status,
     Name, Item Is Taxable, Item Discount, Item Total, Invoice Total, Sale Branch, Salesman) has
     no uuid column at all. Measured live on 2026-09-08: direct_uuid is present on 0 of 46
     finance_invoices and 0 of 33 finance_transactions.
     So this branch fires only if someone writes a uuid in by hand. It is kept, not deleted — it
     is correct, and the day Direct Payments' export carries an id it starts working — but it
     must not be read as "the deep link works". It does not; cycle 54's honest label is what
     people actually get. Making it real needs a uuid (or id) column in that export, which is a
     question for the owner, not a change that can be made here. */
  // Confirmed from the real system (2026-08-12): admin invoice pages live at
  // /en/admin/invoices/view/{uuid}. When we hold the uuid, deep-link straight to it.
  if(r&&r.direct_uuid){
    var vt=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceViewUrl)||'https://payments.directksa.com/en/admin/invoices/view/{uuid}';
    return vt.replace('{uuid}',encodeURIComponent(r.direct_uuid));
  }
  var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceUrl)||'https://payments.directksa.com/en/admin/invoices';
  return tpl.replace('{invoice_no}',encodeURIComponent(r.invoice_no||'')).replace('{dpin}',encodeURIComponent(r.zatca_dpin||'')).replace('{client_id}',encodeURIComponent(r.direct_client_id||''));
};
/* 2026-09-08 (watch cycle 54) — A LINK MAY FAIL TO BE A DEEP LINK; IT MAY NOT SAY IT IS ONE.
   pdInvoiceLink deep-links when the row carries a direct_uuid and otherwise falls back to a
   template whose default — 'https://payments.directksa.com/en/admin/invoices' — contains no
   {invoice_no}, {dpin} or {client_id}, so every replace() below is a no-op and the href is the
   generic invoice LIST. Measured against the live database on 2026-09-08: of 46 live invoices,
   direct_uuid is present on ZERO. The deep-link branch has never run in production, and the
   button labelled "Open in Direct ↗" has been opening the list of every invoice, for every
   invoice, every time — while saying it opens this one. Somebody following it to check an amount
   lands on a list of hundreds and searches by hand, or reads whichever invoice is on top.
   The href is NOT invented here. Adding a ?q= or /search/ this system may not support would be
   guessing at another product's behaviour to make a number look right, which is the one thing
   this project never does (M8). The list page is where it really goes; what changes is that the
   button says so. A workspace that has configured a template carrying {invoice_no} keeps its
   deep link and its original label — this only speaks for the case where there is nothing to
   deep-link with. */
window.pdInvoiceLinkIsDeep=function(r){
  try{
    if(r&&r.direct_uuid)return true;
    var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdInvoiceUrl)||'https://payments.directksa.com/en/admin/invoices';
    return /\{(invoice_no|dpin|client_id)\}/.test(tpl);
  }catch(_){ return false; }
};
window.pdClientLink=function(directClientId){
  var tpl=(typeof DB!=='undefined'&&DB.settings&&DB.settings.pdClientUrl)||'https://payments.directksa.com/customers/{client_id}';
  return tpl.replace('{client_id}',encodeURIComponent(directClientId||''));
};
window.finRow=function(id){
  /* 2026-09-06 (watch cycle 31): this modal is one invoice's whole money — total, cost, revenue,
     profit, received, remaining and wallet — and it had no check of its own. Same stale-tab shape
     cycle 12 closed on the writes and cycle 30 / round 50 closed on the exports: the page refuses
     this session in words while the function sits on window with the rows already in memory.
     Returns silently rather than alerting: the only way to reach it on a refused page is a stale
     tab or the console, and the person already has the refusal on screen — an alert would be noise
     on top of it, not the missing explanation the write paths needed. */
  if(typeof finMaySeeMoney==='function'&&!finMaySeeMoney())return;
  var r=(FIN.rows||[]).find(function(x){return x.id===id;});if(!r)return;
  var ar=isArF(), _f=function(en,a){return ar?a:en;};
  // The invoice = every line sharing this invoice number (same deleted state as the one clicked).
  var delState=!!r.deleted_at;
  var lines=(FIN.rows||[]).filter(function(x){return x.invoice_no===r.invoice_no && (!!x.deleted_at)===delState;})
                          .sort(function(a,b){return (a.line_no||1)-(b.line_no||1);});
  /* 2026-09-07 (watch cycle 39): sanitise before summing. This modal reads FIN.rows DIRECTLY,
     not through live() — and live() is where finSanitizeMoney runs. For a row live() has
     already returned that is harmless, because it sanitises in place. But live() FILTERS
     soft-deleted rows out BEFORE it sanitises, so a deleted invoice never passes the
     chokepoint at all — and a deleted invoice is exactly what this modal is opened on, from
     the Ledger, next to its own Restore button. Measured with a deleted invoice storing
     "9,999.00": the modal printed Total 0.00, Cost 0.00, Received 0.00 SAR, Outstanding
     0.00 SAR — every figure a clean zero, because `+"9,999.00"` is NaN and money() coerces
     NaN to 0. Cycle 2's landmine, on the one surface with no second number to contradict it,
     in front of the person deciding whether to bring the invoice back. */
  try{ if(typeof finSanitizeMoney==='function') lines.forEach(function(x){ finSanitizeMoney(x); }); }catch(_){}
  var t={tot:0,cost:0,rev:0,prof:0,rec:0,rem:0,wal:0};
  lines.forEach(function(x){t.tot+=+x.total_incl_vat_sar||0;t.cost+=+x.cost_sar||0;t.rev+=+x.revenue_sar||0;t.prof+=+x.profit_sar||0;t.rec+=+x.amount_received_sar||0;t.rem+=+x.amount_remaining_sar||0;t.wal+=+x.wallet_portion_sar||0;});
  var meta=[[_f('Client','\u0627\u0644\u0639\u0645\u064a\u0644'),r.client_group],[_f('Name on invoice','\u0627\u0644\u0627\u0633\u0645 \u0639\u0644\u0649 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629'),r.customer_raw_name],[_f('ZATCA tax invoice','\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0627\u0644\u0636\u0631\u064a\u0628\u064a\u0629 (\u0632\u0627\u062a\u0643\u0627)'),r.zatca_dpin||_f('\u2014 (see notes)','\u2014 (\u0627\u0646\u0638\u0631 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a)')],[_f('Date','\u0627\u0644\u062a\u0627\u0631\u064a\u062e'),r.invoice_date+' \u00b7 '+r.month+' \u00b7 '+r.quarter],[_f('Received','\u0627\u0644\u0645\u062d\u0635\u0651\u0644'),money(t.rec)+' SAR'],[_f('Outstanding','\u0627\u0644\u0645\u062a\u0628\u0642\u064a'),money(t.rem)+' SAR'],[_f('Origin','النوع'),(r.origin==='project'?_f('Project — full project with a proposal','مشروع متكامل بعرض'):_f('Booking','حجز عادي'))],[_f('Proposal','العرض'),r.proposal_ref||'—'],[_f('Status','\u0627\u0644\u062d\u0627\u0644\u0629'),(function(st){var M={verified_paid:_f('Paid & verified','مدفوعة ومدققة'),pending:_f('Pending payment','بانتظار السداد'),credit_note:_f('Credit note (refund)','إشعار دائن (استرداد)'),excluded:_f('Excluded','مستبعدة')};return M[st]||st;})(r.integrity_status)],[_f('Notes','\u0645\u0644\u0627\u062d\u0638\u0627\u062a'),r.notes||'\u2014']];
  var th=function(x,rt){return '<th style="padding:6px 8px;text-align:'+(rt?'right':(ar?'right':'left'))+';color:var(--muted);font-size:11px;font-weight:600">'+x+'</th>';};
  var lineTbl='<div style="overflow-x:auto;margin:6px 0 12px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>'+th(_f('Service','\u0627\u0644\u062e\u062f\u0645\u0629'))+th(_f('Description','\u0627\u0644\u0648\u0635\u0641'))+th(_f('Total','\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a'),1)+th(_f('Cost','\u0627\u0644\u062a\u0643\u0644\u0641\u0629'),1)+th(_f('Service fee','\u0631\u0633\u0648\u0645 \u0627\u0644\u062e\u062f\u0645\u0629'),1)+'</tr></thead><tbody>'+
    (function(){
      /* Real Direct Payments model: an invoice can hold several TRANSACTIONS
         (each with its own receipt ref); each transaction spans services. When
         lines carry transaction_ref, group them under transaction headers. */
      var hasTx=lines.some(function(x){return x.transaction_ref;});
      var out='',lastTx=null;
      var ordered=hasTx?lines.slice().sort(function(a,b){return String(a.transaction_ref||'').localeCompare(String(b.transaction_ref||''))||(a.line_no||1)-(b.line_no||1);}):lines;
      ordered.forEach(function(x){
        if(hasTx&&x.transaction_ref!==lastTx){lastTx=x.transaction_ref;
          var txLines=lines.filter(function(y){return y.transaction_ref===lastTx;});
          var txTot=txLines.reduce(function(a,y){return a+(+y.total_incl_vat_sar||0);},0);
          out+='<tr><td colspan="5" style="padding:7px 8px;background:#EEF0F5;font-weight:700;font-size:11.5px;color:#3a4f9e">'+_f('Transaction','المعاملة')+' '+escF(lastTx)+' · '+txLines.length+' '+_f('line(s)','بند')+' · '+money0(txTot)+' SAR</td></tr>';}
        out+='<tr style="border-top:1px solid #f0efe9"><td style="padding:6px 8px;font-weight:600">'+escF(svcLabel(x.service_type))+'</td><td style="padding:6px 8px;color:var(--muted)">'+escF(x.products||'\u2014')+'</td><td style="padding:6px 8px;text-align:right">'+money(x.total_incl_vat_sar)+'</td><td style="padding:6px 8px;text-align:right;color:#B54708">'+money(x.cost_sar)+'</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:#0F6E56">'+money(x.profit_sar)+'</td></tr>'+((x.items&&x.items.length)?('<tr><td colspan="5" style="padding:2px 10px 9px 24px;font-size:11.5px;color:var(--muted);background:#FCFBF9">'+x.items.map(function(it){return '• '+escF(it.d||'')+(it.q?(' × '+it.q):'')+(it.u?(' — '+money(it.u)+' SAR'):'');}).join('<br>')+'</td></tr>'):'');});
      return out;})()+
    '<tr style="border-top:2px solid #1C1E2B;background:#F3F1EA;font-weight:800"><td style="padding:7px 8px" colspan="2">'+_f('Invoice total','\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629')+' \u00b7 '+lines.length+' '+_f('service(s)','\u062e\u062f\u0645\u0629')+'</td><td style="padding:7px 8px;text-align:right">'+money(t.tot)+'</td><td style="padding:7px 8px;text-align:right;color:#B54708">'+money(t.cost)+'</td><td style="padding:7px 8px;text-align:right;color:#0F6E56">'+money(t.prof)+'</td></tr>'+/* VAT is stored (vat_sar) but NEVER shown — owner rule 2026-08-12: no VAT in any view or report */''+
    '</tbody></table></div>';
  var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(20,20,30,.45);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px';ov.dir=ar?'rtl':'ltr';
  ov.innerHTML='<div style="background:#fff;border-radius:14px;max-width:660px;width:100%;max-height:85vh;overflow:auto;padding:22px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><h3 style="margin:0">'+_f('Invoice','\u0641\u0627\u062a\u0648\u0631\u0629')+' '+escF(r.invoice_no)+'</h3><div style="margin-'+(ar?'right':'left')+':auto;display:flex;gap:6px">'+(canFinEdit()&&!delState?'<button class="btn ghost sm" style="color:#D92D20" onclick="finDelInv(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Delete invoice','\u062d\u0630\u0641 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629')+'</button>':'')+(canFinEdit()&&delState?'<button class="btn ghost sm" onclick="finRestoreInv(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Restore','\u0627\u0633\u062a\u0631\u062c\u0627\u0639')+'</button>':'')+(r.proposal_ref?('<button class="btn ghost sm" onclick="finOpenProposal(\''+escF(r.proposal_ref).replace(/\x27/g,"\\\x27")+'\')">'+_f('Open proposal','فتح العرض')+'</button>'):'')+'<a class="btn ghost sm" target="_blank" rel="noopener" href="'+escF(pdInvoiceLink(r))+'" style="text-decoration:none">'+(window.pdInvoiceLinkIsDeep(r)?_f('Open in Direct ↗','فتحها في دايركت ↗'):_f('Find in Direct ↗','ابحث عنها في دايركت ↗'))+'</a>'+'<button class="btn sm" onclick="finCloseModal()">'+_f('Close','\u0625\u063a\u0644\u0627\u0642')+'</button></div></div>'+
    lineTbl+
    meta.map(function(x){return '<div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid #f0efe9;font-size:13px"><div style="min-width:150px;color:var(--muted)">'+escF(x[0])+'</div><div style="font-weight:600;word-break:break-word">'+escF(x[1]==null?'\u2014':x[1])+'</div></div>';}).join('')+
    (canFinEdit()&&!delState?('<div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;border-top:1px solid #f0efe9;padding-top:10px"><b style="font-size:12.5px">'+_f('This invoice is:','هذه الفاتورة:')+'</b>'+
      '<select id="fin_origin" style="padding:6px 8px;border:1px solid var(--line-2,#e6e8ec);border-radius:8px;font:inherit;font-size:12.5px"><option value="booking" '+((r.origin||'booking')==='booking'?'selected':'')+'>'+_f('Normal booking','حجز عادي')+'</option><option value="project" '+(r.origin==='project'?'selected':'')+'>'+_f('Project (with a proposal)','مشروع (بعرض)')+'</option></select>'+
      '<input id="fin_pref" value="'+escF(r.proposal_ref||'')+'" placeholder="'+_f('Proposal ref — e.g. DB-500101','مرجع العرض')+'" style="padding:6px 8px;border:1px solid var(--line-2,#e6e8ec);border-radius:8px;font:inherit;font-size:12.5px;min-width:170px">'+
      '<button class="btn sm" onclick="finSetOrigin(\''+escF(r.invoice_no).replace(/\x27/g,"\\\x27")+'\')">'+_f('Save','حفظ')+'</button></div>'):'')+'</div>';
  ov.id='finModal';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
};
/* In-page confirm, not window.confirm() \u2014 a native dialog blocks the whole tab on its own
   modal loop, which froze the owner's own hands-on QA of this exact button (same failure the
   Payment proofs chapter had before js/57 introduced pfConfirm; this reuses that same box). */
function finConfirm(msg,onYes){
  try{ if(window.pfConfirm) return pfConfirm(msg,onYes); }catch(_){}
  if(confirm(msg))onYes(); // last-resort fallback if js/57 hasn't loaded for some reason
}
/* Bulletproof-round finding (2026-08-22): none of these four called .select() after
   .update(...) \u2014 Supabase/PostgREST returns no error when an RLS policy silently matches
   zero rows, so a delete/restore a viewer wasn't allowed to make looked like it worked (modal
   closes, row appears gone) and then reappeared on the next refresh with no explanation.
   Inert today (every active account is finance:editor \u2014 verified 0 non-editors), but it fires
   the day the owner sets a new hire to a role without finance-edit rights. */
/* 2026-09-03 (watch cycle 15, scripts/qa/probe-concurrency-attacks.mjs): a delete or restore that
   matched ZERO rows used to give exactly one explanation — "your account was not allowed to".
   That is only one of the three things zero rows can mean, and on a team it is usually the wrong
   one: the common case is that a colleague (or another tab) already did it, and the screen in
   front of you is simply out of date. Telling that person they lack permission sends them to ask
   for rights they already have, and leaves them believing the invoice is still there. Rule M8
   applies to explanations as much as to numbers: say what is actually known. This asks the
   database which of the three it is, then says so — and on a race reloads, so the screen stops
   showing a state that is no longer true. */
function finZeroRowMsg(col,val,wantDeleted,cb){
  var ar=isArF();
  var permMsg=wantDeleted?(ar?'\u0644\u0645 \u064a\u064f\u062d\u0630\u0641 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was deleted - your account was not allowed to.')
                         :(ar?'\u0644\u0645 \u064a\u064f\u0633\u062a\u0631\u062c\u0639 \u0634\u064a\u0621 \u2014 \u0644\u0627 \u062a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629.':'Nothing was restored - your account was not allowed to.');
  var c=fc(); if(!c){ cb(permMsg,false); return; }
  c.from('finance_invoices').select('id,deleted_at').eq(col,val).then(function(r){
    var rows=(r&&!r.error&&r.data)||[];
    if(!rows.length){ cb(ar?'\u0644\u0645 \u064a\u062a\u063a\u064a\u0631 \u0634\u064a\u0621 \u2014 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0644\u0645 \u062a\u0639\u062f \u0645\u0648\u062c\u0648\u062f\u0629 \u0641\u064a \u0627\u0644\u062c\u062f\u0648\u0644.':'Nothing changed - that invoice is no longer in the table.',true); return; }
    var already=wantDeleted?rows.every(function(x){return !!x.deleted_at;})
                           :rows.every(function(x){return !x.deleted_at;});
    if(already){
      cb(wantDeleted?(ar?'\u062d\u064f\u0630\u0641\u062a \u0628\u0627\u0644\u0641\u0639\u0644 \u2014 \u0634\u062e\u0635 \u0622\u062e\u0631 \u0623\u0648 \u062a\u0628\u0648\u064a\u0628 \u0622\u062e\u0631 \u0633\u0628\u0642\u0643. \u0644\u0645 \u064a\u062a\u063a\u064a\u0631 \u0634\u064a\u0621 \u0647\u0646\u0627 \u2014 \u064a\u064f\u0639\u0627\u062f \u0627\u0644\u062a\u062d\u0645\u064a\u0644.':'Already deleted - someone else, or another tab, got there first. Nothing changed here; reloading.')
                    :(ar?'\u0627\u064f\u0633\u062a\u064f\u0631\u062c\u0639\u062a \u0628\u0627\u0644\u0641\u0639\u0644 \u2014 \u0634\u062e\u0635 \u0622\u062e\u0631 \u0623\u0648 \u062a\u0628\u0648\u064a\u0628 \u0622\u062e\u0631 \u0633\u0628\u0642\u0643. \u0644\u0645 \u064a\u062a\u063a\u064a\u0631 \u0634\u064a\u0621 \u0647\u0646\u0627 \u2014 \u064a\u064f\u0639\u0627\u062f \u0627\u0644\u062a\u062d\u0645\u064a\u0644.':'Already restored - someone else, or another tab, got there first. Nothing changed here; reloading.'),true);
      return;
    }
    cb(permMsg,false);
  },function(){ cb(permMsg,false); });
}
try{ window.finZeroRowMsg=finZeroRowMsg; }catch(_){}
window.finDelInv=function(invNo){
  if(finRefuseWrite())return;
  var ar=isArF();
  finConfirm(ar?('\u062d\u0630\u0641 \u0643\u0644 \u0628\u0646\u0648\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 '+invNo+'\u061f \u062a\u062e\u062a\u0641\u064a \u0645\u0646 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062a\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639.'):('Soft-delete all lines of invoice '+invNo+'? It disappears from totals but stays recoverable.'), function(){
    fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('invoice_no',invNo).is('deleted_at',null).select().then(function(r){
      if(r.error){alert('Could not delete: '+r.error.message);return;}
      if(!r.data||!r.data.length){ finZeroRowMsg('invoice_no',invNo,true,function(m,raced){ alert(m); if(raced){ finCloseModal(); FIN.rows=null; finLoad(); } }); return; }
      finCloseModal(); FIN.rows=null;finLoad();
    });
  });
};
window.finRestoreInv=function(invNo){
  if(finRefuseWrite())return;   // 2026-09-02: delete guarded itself, restore did not — the pair now matches
  var ar=isArF();
  /* 2026-09-07 (watch cycle 46) — RESTORE WAS NOT THE INVERSE OF DELETE.
     The unique key is (invoice_no, line_no), so one invoice number legitimately holds several
     rows. finDelInv is careful about that: `.is('deleted_at',null)` means it only takes rows
     that are currently live, and a line deleted last month is left where it is. This function
     had no such limit — `.not('deleted_at','is',null)` un-deleted EVERY deleted row for the
     number, whenever it was deleted and whoever deleted it.
     So a duplicate line deleted deliberately in August came back when somebody deleted the
     invoice in September and pressed Restore to undo it. Measured by
     probe-restore-scope-attacks: the round trip put 100,000 SAR back that nobody asked for,
     into every total, with nothing on screen saying three rows had been restored where two
     were removed.
     Restore the LAST deletion, not all of them. finDelInv stamps one timestamp across the
     batch it takes, so rows sharing the newest deleted_at are exactly the action being undone.
     Anything older was a separate decision and stays made — and is named, so "why is that line
     still gone?" is answered on screen rather than in the database. */
  fc().from('finance_invoices').select('id,line_no,deleted_at').eq('invoice_no',invNo).not('deleted_at','is',null).then(function(q){
    if(q.error){alert('Could not restore: '+q.error.message);return;}
    /* filter here as well as in the query: the server filter is what production relies on, and
       this makes the function correct even where a caller or a harness answers the filter
       loosely — cycle 46 found the mock ignoring `deleted_at=not.is.null` on a GET. */
    var dead=((q.data)||[]).filter(function(x){return x&&x.deleted_at!=null;});
    if(!dead.length){ finZeroRowMsg('invoice_no',invNo,false,function(m,raced){ alert(m); if(raced){ finCloseModal(); FIN.rows=null; finLoad(); } }); return; }
    var newest=dead.map(function(x){return String(x.deleted_at||'');}).sort().pop();
    var batch=dead.filter(function(x){return String(x.deleted_at||'')===newest;});
    var older=dead.filter(function(x){return String(x.deleted_at||'')!==newest;});
    var ids=batch.map(function(x){return x.id;});
    fc().from('finance_invoices').update({deleted_at:null}).in('id',ids).select().then(function(r){
      if(r.error){alert('Could not restore: '+r.error.message);return;}
      if(!r.data||!r.data.length){ finZeroRowMsg('invoice_no',invNo,false,function(m,raced){ alert(m); if(raced){ finCloseModal(); FIN.rows=null; finLoad(); } }); return; }
      if(older.length){
        var oldest=older.map(function(x){return String(x.deleted_at||'');}).sort()[0].slice(0,10);
        var lines=older.map(function(x){return x.line_no;}).filter(function(x){return x!=null;}).join(', ');
        alert(ar
          ? ('تم استرجاع '+r.data.length+' بند. وتُرك '+older.length+' بند'+(lines?(' (رقم '+lines+')'):'')+' محذوفًا كما هو — فقد حُذف في وقت سابق ('+oldest+') بقرار منفصل، وهذا الاسترجاع يتراجع عن الحذف الأخير فقط.')
          : ('Restored '+r.data.length+' line(s). '+older.length+' older line(s)'+(lines?(' (line '+lines+')'):'')+' were left deleted on purpose — they were removed earlier ('+oldest+') as a separate decision, and this restore only undoes the most recent delete.'));
      }
      finCloseModal(); FIN.rows=null;finLoad();
    });
  });
};
window.finCloseModal=function(){var m=document.getElementById('finModal');if(m)m.remove();};
window.finDel=function(id){
  if(finRefuseWrite())return;   // 2026-09-03: was canFinEdit(), the wrapper cycle 12 showed can say yes in a share view
  var ar=isArF();
  finConfirm(ar?'\u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629\u061f \u062a\u062e\u062a\u0641\u064a \u0645\u0646 \u0643\u0644 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0648\u062a\u0628\u0642\u0649 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0645\u0646 \u00ab\u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0629 \u0645\u0624\u062e\u0631\u0627\u064b\u00bb.':'Soft-delete this invoice? It disappears from all totals but stays recoverable under "Recently deleted".', function(){
    fc().from('finance_invoices').update({deleted_at:new Date().toISOString()}).eq('id',id).select().then(function(r){
      if(r.error){alert('Could not delete: '+r.error.message);return;}
      if(!r.data||!r.data.length){ finZeroRowMsg('id',id,true,function(m,raced){ alert(m); if(raced){ finCloseModal(); FIN.rows=null; finLoad(); } }); return; }
      finCloseModal(); FIN.rows=null;finLoad();
    });
  });
};
window.finRestore=function(id){
  if(finRefuseWrite())return;   /* 2026-09-03 (watch cycle 15): this one had NO permission check at
     all — cycle 12 guarded the by-invoice-number pair and missed the by-id pair, and the probe
     that claimed to cover "all ten write paths" used a LIVE invoice, where restore sets
     deleted_at from null to null and nothing changes whatever the guard does. Pointed at an
     actually-deleted invoice, a viewer restored it. */
  var ar=isArF();
  fc().from('finance_invoices').update({deleted_at:null}).eq('id',id).select().then(function(r){
    if(r.error){alert('Could not restore: '+r.error.message);return;}
    if(!r.data||!r.data.length){ finZeroRowMsg('id',id,false,function(m,raced){ alert(m); if(raced){ finCloseModal(); FIN.rows=null; finLoad(); } }); return; }
    finCloseModal(); FIN.rows=null;finLoad();
  });
};

var DIMS={__client:'Client (linked)',client_group:'Invoice group (raw)',month:'Month',quarter:'Quarter',service_type:'Service type',record_type:'Record type'};
var DIMS_AR={__client:'العميل (المرتبط)',client_group:'مجموعة الفواتير (كما وردت)',month:'الشهر',quarter:'الربع',service_type:'نوع الخدمة',record_type:'نوع السجل'};
function dimLbl(k){return isArF()?(DIMS_AR[k]||DIMS[k]):DIMS[k];}
function dimVal(r,dim){return dim==='__client'?finCanon(r.client_group).name:dim==='service_type'?svcLabel(r.service_type):(r[dim]||'—');}
var METS={revenue_sar:'Revenue',cost_sar:'Cost',profit_sar:'Profit',amount_received_sar:'Received',amount_remaining_sar:'Outstanding',_count:'Service lines'};
var METS_AR={revenue_sar:'الإيرادات',cost_sar:'التكلفة',profit_sar:'الربح',amount_received_sar:'المحصّل',amount_remaining_sar:'المتبقي',_count:'عدد البنود'};
function metLbl(k){return isArF()?(METS_AR[k]||METS[k]):METS[k];}
var MOI={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
/* Saved views (owner-requested 2026-08-26): the three report shapes people actually reach
   for, one click instead of five. Each just sets FIN.rb to a known-good combination and
   re-renders \u2014 nothing new is stored, so there is no schema change and no per-view
   persistence to keep in sync. "Collections chase" deliberately turns OFF verified-only:
   an unpaid invoice is exactly what collections needs to see, and it would never appear
   in the verified-paid set by definition. */
var RB_PRESETS={
  exec:{en:'Executive monthly',ar:'\u0645\u0644\u062e\u0635 \u0634\u0647\u0631\u064a \u062a\u0646\u0641\u064a\u0630\u064a',
    rb:{g1:'month',g2:'',quarter:'all',verifiedOnly:true,metrics:{revenue_sar:true,cost_sar:true,profit_sar:true}}},
  collect:{en:'Collections chase',ar:'\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062a\u062d\u0635\u064a\u0644',
    rb:{g1:'__client',g2:'',quarter:'all',verifiedOnly:false,metrics:{amount_received_sar:true,amount_remaining_sar:true}}},
  tax:{en:'Tax pack',ar:'\u062d\u0632\u0645\u0629 \u0627\u0644\u0625\u0642\u0631\u0627\u0631 \u0627\u0644\u0636\u0631\u064a\u0628\u064a',
    rb:{g1:'quarter',g2:'service_type',quarter:'all',verifiedOnly:true,metrics:{revenue_sar:true}}}
};
window.finRBPreset=function(key){
  var p=RB_PRESETS[key];if(!p)return;
  FIN.rb={g1:p.rb.g1,g2:p.rb.g2,quarter:p.rb.quarter,verifiedOnly:p.rb.verifiedOnly,metrics:Object.assign({},p.rb.metrics)};
  render();
};
function rbActivePreset(){
  var rb=FIN.rb,ks=Object.keys(RB_PRESETS);
  for(var i=0;i<ks.length;i++){
    var p=RB_PRESETS[ks[i]].rb;
    if(p.g1===rb.g1&&p.g2===rb.g2&&!!p.verifiedOnly===!!rb.verifiedOnly&&JSON.stringify(Object.keys(p.metrics).sort())===JSON.stringify(Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];}).sort()))return ks[i];
  }
  return null;
}
function rReports(){
  var rb=FIN.rb; clearFinCanon();
  /* 2026-09-09 (watch cycle 73): the Report Builder groups BY CLIENT by default, so while the
     exclusion list is outstanding it printed the excluded partner's name beside its money —
     measured, with the blob held back. That is cycle 43's rule exactly, and the answer is the one
     cycle 43 gave the Clients tab. Grouping by month rather than client is not a way out: it only
     moves the money from nobody's row into May's revenue. */
  try{
    if(typeof window.finExclusionsKnown==='function'&&!window.finExclusionsKnown()){
      return finUncheckedRefusal(
        'The exclusion list has not finished loading, so this report cannot be built without risking a standing-excluded partner appearing in it — by name when it is grouped by client, and inside the totals when it is not. It will appear on its own in a moment.',
        'لم تكتمل بعد قراءة قائمة الاستبعاد، لذا لا يمكن بناء هذا التقرير دون المخاطرة بظهور شريك مستبعَد فيه — باسمه عند التجميع حسب العميل، وداخل الإجماليات في غير ذلك. سيظهر تلقائيًا خلال لحظات.');
    }
  }catch(_){}
  var base=(rb.verifiedOnly?verified():live()).filter(function(r){return rb.quarter==='all'||r.quarter===rb.quarter;});
  var active=rbActivePreset();
  var h='<div class="card" style="padding:14px 16px;margin-bottom:12px;font-size:13px">';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><b>'+(isArF()?'\u0639\u0631\u0636 \u062c\u0627\u0647\u0632':'Quick views')+':</b>'+Object.keys(RB_PRESETS).map(function(k){
    var p=RB_PRESETS[k],on=active===k;
    return '<button class="btn sm'+(on?' pri':'')+'" style="'+(on?'':'background:#fff;border:1px solid var(--line,#ddd)')+'" onclick="finRBPreset(\''+k+'\')">'+(isArF()?p.ar:p.en)+'</button>';
  }).join('')+'</div>';
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center"><b>'+(isArF()?'\u062a\u062c\u0645\u064a\u0639 \u062d\u0633\u0628':'Group by')+':</b>';
  h+='<select style="'+SS+'" onchange="finRB(\'g1\',this.value)">'+Object.keys(DIMS).map(function(k){return '<option value="'+k+'" '+(rb.g1===k?'selected':'')+'>'+dimLbl(k)+'</option>';}).join('')+'</select>';
  h+='<span style="color:var(--muted)">'+(isArF()?'\u062b\u0645':'then')+'</span><select style="'+SS+'" onchange="finRB(\'g2\',this.value)"><option value="">\u2014 '+(isArF()?'\u0644\u0627 \u0634\u064a\u0621':'none')+' \u2014</option>'+Object.keys(DIMS).map(function(k){return k===rb.g1?'':'<option value="'+k+'" '+(rb.g2===k?'selected':'')+'>'+dimLbl(k)+'</option>';}).join('')+'</select>';
  h+='<select style="'+SS+'" onchange="finRB(\'quarter\',this.value)">'+opts(uniq(live().map(function(r){return r.quarter;})),rb.quarter,isArF()?'\u0643\u0644 \u0627\u0644\u0641\u062a\u0631\u0627\u062a':'All periods')+'</select>';
  h+='<label style="display:flex;gap:4px;align-items:center;cursor:pointer;font-size:12px"><input type="checkbox" '+(rb.verifiedOnly?'checked':'')+' onchange="finRB(\'verifiedOnly\',this.checked)"> '+(isArF()?'\u0627\u0644\u0645\u062f\u0642\u0642 \u0641\u0642\u0637':'Verified-paid only')+'</label></div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;align-items:center"><b>'+(isArF()?'\u0627\u0644\u0642\u064a\u0645':'Metrics')+':</b>'+Object.keys(METS).map(function(k){
    return '<label style="display:flex;gap:4px;align-items:center;cursor:pointer;font-size:12px"><input type="checkbox" '+(rb.metrics[k]?'checked':'')+' onchange="finRBM(\''+k+'\',this.checked)"> '+metLbl(k)+'</label>';
  }).join('')+'<button class="btn pri sm" style="margin-left:auto" onclick="finCSV()">\u2b07 '+(isArF()?'\u062a\u0635\u062f\u064a\u0631 CSV':'Export CSV')+'</button></div>';
  /* When grouping by the linked client, tell the user how many invoice groups aren't linked
     yet \u2014 those rows still appear, under their own name, so the total stays complete. */
  if(rb.g1==='__client'||rb.g2==='__client'){
    var seen={},unl=0; base.forEach(function(r){var cg=r.client_group||'';if(seen[cg])return;seen[cg]=1;if(!finCanon(r.client_group).linked)unl++;});
    h+='<div style="margin-top:10px;font-size:12px;color:'+(unl?'#8b5b1f':'#0F6E56')+'">'+(unl
      ? (isArF()?('\u26a0 '+unl+' \u0645\u062c\u0645\u0648\u0639\u0629 \u0641\u0648\u0627\u062a\u064a\u0631 \u063a\u064a\u0631 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0639\u0645\u064a\u0644 \u0628\u0639\u062f \u2014 \u062a\u0638\u0647\u0631 \u0628\u0627\u0633\u0645\u0647\u0627. <span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">\u0627\u0631\u0628\u0637\u0647\u0627 \u0627\u0644\u0622\u0646</span>')
              : ('\u26a0 '+unl+' invoice group'+(unl>1?'s':'')+' could not be matched to a client automatically \u2014 shown under their own name. <span style="color:#FF6B00;cursor:pointer;font-weight:700" onclick="try{finLinkMap()}catch(e){}">Review them</span>'))
      : (isArF()?'\u2713 \u0643\u0644 \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0639\u0645\u064a\u0644.':'\u2713 Every invoice group is linked to a client.'))+'</div>';
  }
  /* Scope caption (2026-08-29, borrowed from Direct's own Marketing dashboards, which label
     every metric with exactly which invoice statuses feed it). Computed from the SAME rb
     state and the SAME base set the table below is built from — never a second copy of the
     rule — so what it says can't drift from what the numbers are. It also states plainly
     what this report does NOT do (follow the period bar), which was the silent gap logged in
     BACKLOG 2026-08-27; saying it on screen is not the design fix, but it stops a reader
     assuming a sector- or year-scoped number they never got. */
  var _rbN=base.length;
  var _capScope=rb.verifiedOnly
    ? (isArF()?'\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0636\u0631\u064a\u0628\u064a\u0629 \u0627\u0644\u0645\u062f\u0642\u0642\u0629 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u0642\u0637':'verified, fully-paid tax invoices only')
    : (isArF()?'\u0643\u0644 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u062d\u064a\u0629 \u2014 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0648\u063a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629 \u0645\u0639\u0627\u064b':'all live invoices, paid and unpaid together');
  var _capPeriod=rb.quarter==='all'?(isArF()?'\u0643\u0644 \u0627\u0644\u0641\u062a\u0631\u0627\u062a':'all periods'):rb.quarter;
  var _capTail=isArF()
    ? '\u0639\u0628\u0631 \u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0648\u0627\u0644\u0642\u0637\u0627\u0639\u0627\u062a \u2014 \u0634\u0631\u064a\u0637 \u0627\u0644\u0641\u062a\u0631\u0629 \u0623\u0639\u0644\u0627\u0647 \u0644\u0627 \u064a\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631. \u0627\u0644\u0645\u0644\u063a\u0627\u0629 \u0648\u0634\u062d\u0646 \u0627\u0644\u0645\u062d\u0641\u0638\u0629 \u0648\u0627\u0644\u062c\u0647\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0628\u0639\u062f\u0629 \u0644\u0627 \u062a\u064f\u062d\u0633\u0628 \u0623\u0628\u062f\u0627\u064b.'
    : 'across all years and sectors \u2014 the period bar above does not apply to this report. Void, wallet top-ups and excluded partners are never counted.';
  h+='<div id="rb-caption" data-scope="'+(rb.verifiedOnly?'verified':'all')+'" data-n="'+_rbN+'" style="margin-top:10px;padding:8px 10px;border-radius:8px;background:#F8F7F4;font-size:12px;color:#444;line-height:1.5">'
    +'<b>'+(isArF()?'\u0645\u0627 \u0627\u0644\u0630\u064a \u064a\u064f\u062d\u0633\u0628 \u0647\u0646\u0627':'What this report counts')+':</b> '+_capScope+' \u00b7 '+_capPeriod+', '+_capTail+' <span style="color:var(--muted)">('+_rbN+' '+(isArF()?'\u0641\u0627\u062a\u0648\u0631\u0629':'invoice'+(_rbN===1?'':'s'))+')</span></div>';
  h+='</div>';
  var mets=Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];});
  /* 2026-09-08 (watch cycle 57): this used to read `if(!mets.length)mets=['revenue_sar'];` — untick
     every box in the Metrics row and the table did not go quiet, it showed Revenue. Six checkboxes
     said no figure was chosen while a money column stood next to them, and FIN._lastReport carried
     that column into the CSV, so a file sent to an accountant had a Revenue total nobody ticked.
     Same family as cycles 41–43, 55 and 56: the app answering with more confidence than its own
     state supports — here a default worn as a choice. Say what is missing and let one click fix
     it; the controls above stay on screen, so the report is one tick away, not switched off.
     _lastReport is cleared in the same breath, because an export built from a report that is no
     longer on screen is the same lie one step later. */
  if(!mets.length){
    FIN._lastReport=null;
    return h+'<div id="rb-nometrics" class="card" style="padding:16px;font-size:13px;color:#444;line-height:1.6">'
      +(isArF()
        ?'<b>\u0644\u0645 \u062a\u064f\u062d\u062f\u064e\u0651\u062f \u0623\u064a \u0642\u064a\u0645\u0629.</b> \u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0627 \u064a\u064f\u062c\u0645\u064e\u0639 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u062d\u062a\u0649 \u062a\u062e\u062a\u0627\u0631 \u0642\u064a\u0645\u0629 \u0648\u0627\u062d\u062f\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u0645\u0631\u0628\u0639\u0627\u062a \u00ab\u0627\u0644\u0642\u064a\u0645\u00bb \u0623\u0639\u0644\u0627\u0647. \u0627\u0644\u0635\u0641\u0648\u0641 \u0644\u0645 \u062a\u064f\u0641\u0642\u064e\u062f \u2014 \u0641\u0642\u0637 \u0644\u0645 \u064a\u064f\u0637\u0644\u064e\u0628 \u0645\u0646\u0647\u0627 \u0634\u064a\u0621 \u0628\u0639\u062f.'
        :'<b>No figure is selected.</b> There is nothing to total in this report until you tick at least one of the boxes under <b>Metrics</b> above — Revenue, Cost, Profit, Received, Outstanding or Service lines. The invoices are still here; nothing has been asked of them yet.')
      +'</div>';
  }
  var g={};
  base.forEach(function(r){
    var k1=dimVal(r,rb.g1),k2=rb.g2?dimVal(r,rb.g2):null;
    g[k1]=g[k1]||{__sub:{},__tot:{},__rows:[],__subRows:{}};
    /* Keep the actual invoice rows behind every total. The drill-down (chapter 25, part 3)
       opens THESE rows — not a second copy of this filter written somewhere else — so what
       a row expands to always adds up to the row it expanded from. */
    g[k1].__rows.push(r);
    if(k2){var s=g[k1].__sub[k2]=g[k1].__sub[k2]||{};mets.forEach(function(m){s[m]=(s[m]||0)+(m==='_count'?1:+r[m]);});
      (g[k1].__subRows[k2]=g[k1].__subRows[k2]||[]).push(r);}
    mets.forEach(function(m){g[k1].__tot[m]=(g[k1].__tot[m]||0)+(m==='_count'?1:+r[m]);});
  });
  var keys=Object.keys(g);
  if(rb.g1==='month')keys.sort(function(a,b){return (MOI[a]||99)-(MOI[b]||99);});
  else if(rb.g1==='quarter')keys.sort();
  else keys.sort(function(a,b){return (g[b].__tot[mets[0]]||0)-(g[a].__tot[mets[0]]||0);});
  var grand={};
  keys.forEach(function(k){mets.forEach(function(m){grand[m]=(grand[m]||0)+(g[k].__tot[m]||0);});});
  FIN._lastReport={g1:rb.g1,g2:rb.g2,mets:mets,keys:keys,g:g,grand:grand};
  var h2='<div class="card" style="padding:0;overflow:auto;max-height:60vh"><table style="width:100%;font-size:12.5px;border-collapse:collapse;min-width:600px"><thead><tr style="position:sticky;top:0;background:#F8F7F4;z-index:2;text-align:left;color:var(--muted)"><th style="padding:8px">'+dimLbl(rb.g1)+(rb.g2?' \u203a '+dimLbl(rb.g2):'')+'</th>'+mets.map(function(m){return '<th style="padding:8px;text-align:right">'+metLbl(m)+'</th>';}).join('')+'</tr></thead><tbody>';
  keys.forEach(function(k){
    h2+='<tr data-rbk="'+escF(k)+'" style="border-top:1px solid var(--line,#eee);background:'+(rb.g2?'#FBFAF7':'#fff')+'"><td style="padding:7px 8px;font-weight:700">'+escF(k)+'</td>'+mets.map(function(m){return '<td style="padding:7px 8px;text-align:right;font-weight:700">'+(m==='_count'?g[k].__tot[m]:money0(g[k].__tot[m]))+'</td>';}).join('')+'</tr>';
    if(rb.g2){
      var subs=Object.keys(g[k].__sub);
      if(rb.g2==='month')subs.sort(function(a,b){return (MOI[a]||99)-(MOI[b]||99);});else subs.sort();
      subs.forEach(function(s){
        h2+='<tr data-rbk="'+escF(k)+'" data-rbs="'+escF(s)+'" style="border-top:1px solid #f4f2ec"><td style="padding:5px 8px 5px 26px;color:var(--muted)">'+escF(s)+'</td>'+mets.map(function(m){return '<td style="padding:5px 8px;text-align:right">'+(m==='_count'?(g[k].__sub[s][m]||0):money0(g[k].__sub[s][m]||0))+'</td>';}).join('')+'</tr>';
      });
    }
  });
  h2+='<tr style="border-top:2px solid #1C1E2B;background:#F3F1EA"><td style="padding:9px 8px;font-weight:800">'+(isArF()?'\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a':'TOTAL')+'</td>'+mets.map(function(m){return '<td style="padding:9px 8px;text-align:right;font-weight:800">'+(m==='_count'?grand[m]:money0(grand[m]))+'</td>';}).join('')+'</tr></tbody></table></div>';
  /* 2026-09-02 (round 36): the same rule round 35 applied to the per-client table. This report
     sums profit_sar across whatever it groups by, and a row whose invoices all carry cost 0
     reports its whole revenue as profit. Marking every row would be noise here (the report also
     groups by month and quarter, where a marker says nothing useful), and the TOTAL must keep
     reconciling against the ledger for the report-builder probe — so the honest move is one
     line under the table, shown only when a profit or cost metric is actually on. */
  /* 2026-09-08 (watch cycle 60): the same defect cycle 59 found one level down, on the surface a
     manager actually reads. Every group row prints money0(__tot[m]) and the TOTAL prints
     money0(grand[m]), where grand sums the RAW values and rounds once — so three clients billing
     100.40 each print as three rows of 100 under a TOTAL of 301, and reading down the column does
     not reach the figure at the bottom of it. Sub-rows against their own group row have the same
     shape, on the very view the owner asked for by name ("<client> January total").
     probe-report-builder-attacks proves this table's arithmetic to the hallala at four groupings
     and never compared two PRINTED figures to each other, which is exactly how this stood in
     plain sight. House pattern from cycles 49/50/59: keep the rounded headline, say the exact
     figure when the rounding shows. Only when it actually shows — on whole-riyal data, which is
     most of this file, nothing appears. */
  var _r0=function(n){return Math.round(Number(n)||0);};
  var _offs=[];
  mets.forEach(function(m){
    if(m==='_count')return;
    var rowsSum=keys.reduce(function(a,k){return a+_r0(g[k].__tot[m]);},0);
    if(rowsSum!==_r0(grand[m])){_offs.push({m:m,shown:rowsSum,head:_r0(grand[m]),exact:Number(grand[m])||0,within:''});return;}
    if(!rb.g2)return;
    for(var i=0;i<keys.length;i++){
      var k=keys[i],subs=Object.keys(g[k].__sub);
      var ss=subs.reduce(function(a,x){return a+_r0(g[k].__sub[x][m]);},0);
      if(ss!==_r0(g[k].__tot[m])){_offs.push({m:m,shown:ss,head:_r0(g[k].__tot[m]),exact:Number(g[k].__tot[m])||0,within:k});break;}
    }
  });
  if(_offs.length){
    h2+='<div id="rb-rounding" style="font-size:11.5px;color:#444;padding:8px 10px;background:#F8F7F4;line-height:1.5">'+(isArF()
      ?('\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0647\u0646\u0627 \u0645\u064f\u0642\u0631\u064e\u0651\u0628\u0629 \u0625\u0644\u0649 \u0623\u0642\u0631\u0628 \u0631\u064a\u0627\u0644\u060c \u0648\u0643\u0644 \u0625\u062c\u0645\u0627\u0644\u064a \u064a\u064f\u0642\u0631\u064e\u0651\u0628 \u0639\u0644\u0649 \u062d\u062f\u0629\u060c \u0644\u0630\u0627 \u0642\u062f \u0644\u0627 \u064a\u0637\u0627\u0628\u0642 \u062c\u0645\u0639 \u0627\u0644\u0639\u0645\u0648\u062f \u0627\u0644\u0631\u0642\u0645 \u0623\u0633\u0641\u0644\u0647. '
         +_offs.map(function(o){return metLbl(o.m)+(o.within?(' \u062f\u0627\u062e\u0644 '+escF(o.within)):'')+': \u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0635\u0641\u0648\u0641 '+money0(o.shown)+'\u060c \u0648\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a '+money0(o.head)+'\u060c \u0648\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062f\u0642\u064a\u0642 '+o.exact.toFixed(2)+' \u0631\u064a\u0627\u0644';}).join('\u061b ')+'.')
      :('The figures here are rounded to the nearest riyal and each total is rounded separately, so adding a column up may not land on the figure below it. '
         +_offs.map(function(o){return metLbl(o.m)+(o.within?(' within '+escF(o.within)):'')+': the rows read '+money0(o.shown)+', the total reads '+money0(o.head)+', and the exact figure is '+o.exact.toFixed(2)+' SAR';}).join('; ')+'. The exported CSV carries the exact figures.'))+'</div>';
  }
  if(mets.indexOf('profit_sar')>=0||mets.indexOf('cost_sar')>=0){
    var _rbNo=base.filter(function(r){return (+r.cost_sar||0)===0;}).length;
    if(_rbNo>0) h2+='<div style="font-size:11.5px;color:#B54708;font-weight:600;padding:8px 10px">⚠ '+(isArF()
      ?(_rbNo+' من '+base.length+' بند في هذا التقرير بلا تكلفة مسجّلة — أرقام الربح هنا حدّ أقصى وليست نهائية.')
      :(_rbNo+' of '+base.length+' rows in this report carry no recorded cost — the profit figures here are an upper bound, not final.'))+'</div>';
  }
  return h+h2;
}
window.finRB=function(k,v){FIN.rb[k]=v;if(k==='g1'&&FIN.rb.g2===v)FIN.rb.g2='';render();};
window.finRBM=function(k,v){FIN.rb.metrics[k]=v;render();};
window.finCSV=function(){
  /* 2026-09-06 (watch cycle 30): the READ-OUT paths had no check of their own. Cycle 12 found
     and closed exactly this shape on all ten Finance WRITE paths — "a stale tab, a role changed
     while it was open, or a share view leaves the function one call away" — and the exports were
     never looked at. They build a file out of state the page filled in while it was still allowed
     to render, so a tab that was an admin's a moment ago hands over every invoice, every
     transaction and the whole report to a session the page itself now refuses in words. Same rule
     as the screen: canFinView() is what rFinance checks before it will render at all. This is not
     claimed as a boundary against someone reading the rows out of devtools — the rows are already
     in the tab — only that pressing something must not produce Finance's file for a person
     Finance is refused to. */
  if(typeof finMayExport==='function'&&!finMayExport()){alert(isArF()?'التصدير غير متاح لهذه الصلاحية.':'Export is not available for this access level.');return;}
  /* 2026-09-08 (watch cycle 57): this was `if(!R)return;` — a button that did nothing, in silence.
     It was nearly unreachable only because of the Revenue fallback removed above; now that no
     figure means no report, it is one click away, and a dead button is how a person concludes the
     export is broken. */
  var R=FIN._lastReport;
  if(!R){alert(isArF()?'\u0644\u0627 \u064a\u0648\u062c\u062f \u062a\u0642\u0631\u064a\u0631 \u0644\u062a\u0635\u062f\u064a\u0631\u0647 \u0628\u0639\u062f \u2014 \u0627\u062e\u062a\u0631 \u0642\u064a\u0645\u0629 \u0648\u0627\u062d\u062f\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u00ab\u0627\u0644\u0642\u064a\u0645\u00bb \u0623\u0639\u0644\u0627\u0647.':'There is no report to export yet — tick at least one figure under Metrics above.');return;}
  /* 2026-09-02 (attack round 9): the file used the English DIMS/METS words and "TOTAL" even in
     Arabic while the table on screen was Arabic \u2014 same labels as the screen now (dimLbl/metLbl). */
  /* 2026-09-08 (watch cycle 60): these were raw JS numbers, so a column of fractions exported as
     301.20000000000005 — binary floating point, written into the file an accountant works from.
     Money goes out at two decimals, counts as integers. This is a formatting change only: the
     value is unchanged to the hallala, and the screen keeps its own rounding. */
  var csvNum=function(m,v){v=Number(v)||0;return m==='_count'?String(Math.round(v)):v.toFixed(2);};
  var out=[[dimLbl(R.g1)+(R.g2?' / '+dimLbl(R.g2):'')].concat(R.mets.map(function(m){return metLbl(m);}))];
  R.keys.forEach(function(k){
    out.push([k].concat(R.mets.map(function(m){return csvNum(m,R.g[k].__tot[m]);})));
    if(R.g2)Object.keys(R.g[k].__sub).forEach(function(s){out.push(['  '+k+' \u203a '+s].concat(R.mets.map(function(m){return csvNum(m,R.g[k].__sub[s][m]);})));});
  });
  out.push([isArF()?'\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a':'TOTAL'].concat(R.mets.map(function(m){return csvNum(m,R.grand[m]);})));
  var csv='\ufeff'+out.map(function(r){return r.map(function(c){c=csvGuard(c);return (c.indexOf(',')>=0||c.indexOf('"')>=0||c.charCodeAt(0)===39)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Direct-Finance-Report-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};

function rImport(){
  var _fl=function(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;};
  if(!finCanWrite())return '<div class="card" style="padding:30px;text-align:center;color:var(--muted)">'+_fl('Import is restricted to admins and managers.','الاستيراد متاح للمدراء والمسؤولين فقط.')+'</div>';
  var h='<div class="card" style="padding:18px;max-width:860px">';
  h+='<h3 style="margin:0 0 8px">'+_fl('Import invoices (CSV)','استيراد الفواتير (CSV)')+'</h3>';
  // 2026-08-25: dropped the raw 14-column header dump and the "optional columns" filler
  // (density/copy pass, owner-directed) — v65's own signatures auto-detect the real column
  // set on drop, so a hand-typed CSV spec here was stale prose explaining our own plumbing,
  // not something a user needs to read. Kept, shortened: the one load-bearing safety promise.
  h+='<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">'+_fl('Nothing is written until you confirm the preview.','لا يُكتب شيء قبل تأكيدك للمعاينة.')+'</div>';
  h+='<div id="finDrop" style="border:2px dashed #C9CDD6;border-radius:12px;padding:22px;text-align:center;color:var(--muted);font-size:13px;margin-bottom:12px;cursor:pointer" onclick="document.getElementById(\'finFile\').click()">⬇ '+_fl('Drop a CSV file here, or click to choose','أفلت ملف CSV هنا أو انقر للاختيار')+'</div>';
  h+='<input type="file" id="finFile" accept=".csv" style="font-size:13px"> <button class="btn pri sm" onclick="finParse()">'+_fl('Check file','فحص الملف')+'</button>';
  h+='<div id="finImpOut" style="margin-top:14px"></div></div>';
  setTimeout(function(){
    var dz=document.getElementById('finDrop');if(!dz||dz.__wired)return;dz.__wired=1;
    dz.addEventListener('dragover',function(e){e.preventDefault();dz.style.borderColor='#F47A1F';dz.style.background='#FFF3EC';});
    dz.addEventListener('dragleave',function(){dz.style.borderColor='#C9CDD6';dz.style.background='';});
    dz.addEventListener('drop',function(e){
      e.preventDefault();dz.style.borderColor='#C9CDD6';dz.style.background='';
      var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(!f)return;
      var inp=document.getElementById('finFile');
      try{var dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;}catch(_e){}
      if(inp.files&&inp.files.length)finParse();
    });
  },0);
  return h;
}
function csvParse(text){
  text=text.replace(/^\ufeff/,'');
  var rows=[],row=[],cur='',inQ=false;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; } else cur+=ch; }
    else if(ch==='"')inQ=true;
    else if(ch===','){row.push(cur);cur='';}
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n')i++; row.push(cur);cur=''; if(row.length>1||row[0]!=='')rows.push(row); row=[]; }
    else cur+=ch;
  }
  if(cur!==''||row.length){row.push(cur);if(row.length>1||row[0]!=='')rows.push(row);}
  return rows;
}
var QM={Q1:[1,3],Q2:[4,6],Q3:[7,9],Q4:[10,12]};
window.finParse=function(){
  var f=document.getElementById('finFile').files[0];
  if(!f){var _ar=(typeof LANG!=='undefined'&&LANG==='ar');var _m=_ar?'اختر ملف CSV أولاً.':'Choose a CSV file first.';if(typeof toast==='function')toast(_m);else alert(_m);return;}
  var rd=new FileReader();
  rd.onload=function(){
    var rows=csvParse(String(rd.result));
    var BASE='client_group,month,quarter,invoice_no,zatca_dpin,customer_raw_name,invoice_date,products,total_incl_vat_sar,wallet_portion_sar,revenue_sar,cost_sar,profit_sar,integrity_status,notes';
    var hdr=rows[0]||[],hj=hdr.join(',').trim();
    var hasExtra=(hj===BASE+',origin,proposal_ref');
    // 2026-08-24: this is the LEGACY single-format checker (js/65-universal-importer.js's
    // v65WireImportPanel() rebinds "Check file" away from this the instant the Import tab is
    // wired — which is now immediate, but this label stays as a second, explicit signal in
    // case it's ever seen again, so a rejection here is never mistaken for "your file is
    // wrong" the way the owner did on 2026-08-24 (docs/DECISIONS.md M12).
    if(hj!==BASE&&!hasExtra){document.getElementById('finImpOut').innerHTML='<div style="color:#D92D20;font-size:13px"><b>Legacy single-format checker</b> — expects the original Invoice Export columns exactly, nothing else (not expense lines, transaction status, or tax invoices). If you dropped one of those newer file types, this is very likely the wrong checker, not a wrong file — reload this tab, or wait a second and press Check file again. Header does not match the expected format. Found:<br><code style="font-size:11px;word-break:break-all">'+escF(hdr.join(','))+'</code></div>';return;}
    var HDR=(hasExtra?BASE+',origin,proposal_ref':BASE).split(',');
    var existing={};(FIN.rows||[]).forEach(function(r){existing[r.invoice_no]=1;});
    var seen={},ok=[],dups=[],flagged=[];
    rows.slice(1).forEach(function(c,idx){
      if(c.length<9)return;
      var o={};HDR.forEach(function(k,i){o[k]=(c[i]||'').trim();});
      if(!o.invoice_no)return;
      var line=idx+2, probs=[];
      if(existing[o.invoice_no]||seen[o.invoice_no]){dups.push({line:line,no:o.invoice_no});return;}
      seen[o.invoice_no]=1;
      var numF=function(s){s=String(s==null?'':s).replace(/[,\s\u00a0]/g,'');var n=parseFloat(s);return isFinite(n)?n:0;};var tot=numF(o.total_incl_vat_sar),wal=numF(o.wallet_portion_sar),rev=numF(o.revenue_sar),cost=numF(o.cost_sar),prof=numF(o.profit_sar);
      if(Math.abs((tot-wal)-rev)>0.01)probs.push('revenue != total-wallet ('+money(tot-wal)+' expected)');
      if(Math.abs((rev-cost)-prof)>0.01)probs.push('profit != revenue-cost ('+money(rev-cost)+' expected)');
      o.quarter=String(o.quarter||'').trim().toUpperCase();var d=new Date(o.invoice_date+'T00:00:00'),qr=QM[o.quarter];
      if(isNaN(d.getTime()))probs.push('bad date');
      else if(qr&&((d.getMonth()+1)<qr[0]||(d.getMonth()+1)>qr[1]))probs.push('date outside stated quarter');
      var st=o.integrity_status||'verified_paid';
      if(tot<0||/credit/i.test(o.products))st='credit_note';
      var org=String(o.origin||'').trim().toLowerCase();
      // Product-type rule: scans only the products field, never free-text notes — an
      // unrelated row that happens to mention "verification" in its notes must not be
      // caught (Spec 4 item 1, 2026-08-21).
      if(/techtic|verification|توثيق/i.test(String(o.products||'')))probs.push('verification services are accounted for elsewhere — not imported into this ledger');
      // Client-identity rule: a SEPARATE check, by client ID via the exclusion list
      // (js/62) — this is the actual fix for the reported bug. Excluding a company (e.g.
      // Takamol) must never rest on which product a given row happens to be for; the old
      // product-only regex let Takamol's non-verification invoices straight through.
      var xhit16=(typeof window.finExclusionCheck==='function')?window.finExclusionCheck(o.client_group):null;
      if(xhit16)probs.push('excluded client (#'+xhit16.clientId+(xhit16.reason?(': '+xhit16.reason):'')+') — not imported into this ledger');
      /* Same rule as the Direct Payments importer (js/41): wallet top-ups are never Finance
         revenue and must never enter this ledger under any label. The Excel importer already
         detects and skips them before they reach a row; this legacy CSV path had no equal
         guard — a row whose products/notes mentioned "wallet" or "top-up" would have been
         classified service_type='Wallet top-up' by svcType() below and imported as real
         revenue. Found 2026-08-20 while closing the same gap in the Individual-bookings form. */
      if(/wallet|top-up|topup|محفظة/i.test(String(o.products||'')+' '+String(o.notes||'')))probs.push('wallet top-ups are never Finance revenue — not imported into this ledger (see Payment proofs for the document trail)');
      if(org&&org!=='booking'&&org!=='project')probs.push('origin must be booking or project');
      if(org==='project'&&!String(o.proposal_ref||'').trim())probs.push('project rows need a proposal_ref');
      if(probs.length){flagged.push({line:line,no:o.invoice_no,probs:probs});return;}
      ok.push({invoice_no:o.invoice_no,zatca_dpin:o.zatca_dpin||null,client_group:o.client_group,customer_raw_name:o.customer_raw_name||null,invoice_date:o.invoice_date,month:o.month,quarter:o.quarter,products:o.products||null,service_type:svcType(o.products),record_type:'b2b',total_incl_vat_sar:tot,wallet_portion_sar:wal,revenue_sar:rev,cost_sar:cost,profit_sar:prof,amount_received_sar:st==='verified_paid'?tot:0,amount_remaining_sar:0,integrity_status:st,notes:o.notes||null,origin:org||'booking',proposal_ref:String(o.proposal_ref||'').trim()||null,source_batch:'import '+new Date().toISOString().slice(0,10)});
    });
    var trev=0,tcost=0,tprof=0;ok.forEach(function(r){trev+=r.revenue_sar;tcost+=r.cost_sar;tprof+=r.profit_sar;});
    var unkRef=ok.filter(function(r){return r.proposal_ref&&!((typeof DB!=='undefined'&&DB.offers)||[]).some(function(o){return o.ref===r.proposal_ref;});}).length;
    FIN._pending=ok;
    var h='<div style="font-size:13px;line-height:1.8"><b>Preview \u2014 nothing written yet:</b><br>\u2705 Ready to import: <b>'+ok.length+'</b> rows \u00b7 revenue '+money(trev)+' \u00b7 cost '+money(tcost)+' \u00b7 profit '+money(tprof)+'<br>';
    if(dups.length)h+='\u23ed Skipped duplicates (already in the ledger): <b>'+dups.length+'</b> \u2014 '+dups.slice(0,8).map(function(d){return d.no;}).join(', ')+(dups.length>8?'\u2026':'')+'<br>';
    if(flagged.length)h+='\u26a0 Flagged for review (NOT imported): <b>'+flagged.length+'</b><br>'+flagged.slice(0,10).map(function(fl){return '<span style="font-size:11.5px;color:#8b5b1f">line '+fl.line+' \u00b7 '+escF(fl.no)+' \u2014 '+escF(fl.probs.join('; '))+'</span>';}).join('<br>')+(flagged.length>10?'<br>\u2026':'')+'<br>';
    if(unkRef)h+='<span style="font-size:12px;color:#8b5b1f">\u26a0 '+unkRef+' project row(s) name a proposal that is not in the app yet \u2014 the link will say "no proposal" until it exists.</span><br>';
    h+=(ok.length?'<button class="btn pri sm" style="margin-top:8px" onclick="finCommit()">Confirm import of '+ok.length+' rows</button>':'')+'</div>';
    document.getElementById('finImpOut').innerHTML=h;
  };
  rd.readAsText(f,'utf-8');
};
function svcType(p){
  p=String(p||'');
  if(p.indexOf('+')>=0)return 'Mixed';
  var lc=p.toLowerCase();
  var m=[
    [['direct flights','flight','airfare','air ticket','ticket','طيران','تذكر'],'Flights'],
    [['direct hotels','hotel','accommodation','room','فندق','إقام'],'Hotels'],
    [['direct visa','visa','تأشير'],'Visas'],
    [['direct course','course','training','study','دورة','تدريب'],'Courses'],
    /* No 'Wallet top-up' branch here on purpose — the caller now rejects wallet-mentioning
       rows before svcType() ever runs, and this function must never be able to hand back
       that label to any future caller that forgets to add the same guard. */
    [['support service','دعم'],'Support Services'],
    [['transport','transfer','car','bus','نقل'],'Transport'],
    [['insurance','تأمين'],'Insurance'],
    [['package','umrah','hajj','trip','tour','برنامج','عمرة','رحل'],'Packages']
  ];
  for(var i=0;i<m.length;i++)for(var j=0;j<m[i][0].length;j++)if(lc.indexOf(m[i][0][j])>=0)return m[i][1];
  return 'Other';
}
window.finCommit=function(){
  var P=FIN._pending||[];if(!P.length)return;
  FIN._pending=null; // double-click cannot import twice
  document.getElementById('finImpOut').innerHTML='<div style="font-size:13px">Importing '+P.length+' rows\u2026</div>';
  var c=fc(),i=0,errs=[];
  function next(){
    if(i>=P.length){
      document.getElementById('finImpOut').innerHTML='<div style="font-size:13px;color:#0F6E56"><b>Done.</b> Imported '+(P.length-errs.length*50<0?0:P.length)+' rows'+(errs.length?' with errors: <span style="color:#D92D20">'+escF(errs.slice(0,5).join('; '))+'</span>':'')+'.</div>';
      FIN.rows=null;FIN._pending=null;finLoad();
      return;
    }
    var batch=P.slice(i,i+50);i+=50;
    c.from('finance_invoices').insert(batch).select('id').then(function(r){
      if(r.error)errs.push(r.error.message);
      else if(!r.data||r.data.length!==batch.length)errs.push('database confirmed '+((r.data&&r.data.length)||0)+' of '+batch.length+' rows in a batch (refused silently — permissions?)');
      next();
    });
  }
  next();
};

window.renderFinance=function(v){
  if(!canFinView()){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Finance is not available in shared view-only links.</div>';return;}
  if(!FIN.rows){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--muted)">Loading the finance ledger\u2026</div>';finLoad();return;}
  if(FIN.loadErr){v.innerHTML='<div class="card" style="padding:40px;text-align:center;color:#D92D20">Could not load: '+escF(FIN.loadErr)+'<br><span style="font-size:12px;color:var(--muted)">Make sure you are signed in.</span></div>';return;}
  /* 2026-09-02 (attack round 8): the export rows were only filled by finPeriodBar(), which the
     Overview and Clients tabs render but the Ledger tab does not. Arrive at Finance for the first
     time this session straight on the Ledger (a client card's "Open in Finance ledger ↗", a
     report drill-down) and Export ▾ answered "No rows to export — open the Ledger tab first"
     while the person was looking at the Ledger tab. Fill them on every finance render. */
  try{ FIN._csvRows=live().filter(finInPeriod); }catch(_){}
  /* 2026-09-02 (round 39): this chain used to end in `:rOverview()`, so ANY tab this file does
     not itself know silently rendered the Performance page. The extra tabs — Expenses, Payment
     proofs, Individual bookings — are added by later layers that WRAP this function: the inner
     call runs first (drawing the Overview), then the wrapper checks FIN.tab and rebuilds #view
     if the tab is theirs. Each wrapper ends in `catch(e){console.warn(...)}`.
     So if one of those layers throws while rendering, its Overview fallback simply stays on
     screen: the person clicks "Individual bookings" and gets Performance, with no error, no
     empty state, and nothing to suggest the click did anything at all. That is precisely the
     shape of failure this project's history warns about — "looks exactly like a mysterious
     failure". A tab this file does not own now gets an honest placeholder instead, which the
     working layers overwrite in the same tick and nobody ever sees; if it survives, it is
     because the section really did fail, and it says so. */
  var OWN_TABS=['overview','clients','ledger','reports','import'];
  /* This file cannot name a tab another layer owns — those layers inject their own buttons into
     the bar after finTabs() has run — so the placeholder stays deliberately neutral rather than
     guessing a label from the key. */
  function finPlaceholder(){
    return '<div class="card" id="fin-tab-pending" style="padding:34px;text-align:center;color:var(--muted)">'
      +'<div style="font-size:15px;font-weight:700;color:var(--ink,#1C1E2B);margin-bottom:6px">'+(isArF()?'جارٍ فتح القسم':'Opening this section')+'</div>'
      +'<div style="font-size:13px">'+(isArF()
        ? 'إذا بقيت هذه الرسالة على الشاشة، فإن القسم لم يُحمَّل — أعد تحميل الصفحة.'
        : 'If this message stays on screen, the section did not load — refresh the page.')
      +'</div></div>';
  }
  var body=FIN.tab==='ledger'?rLedger():FIN.tab==='clients'?rFinClients():FIN.tab==='reports'?rReports():FIN.tab==='import'?rImport()
          :(OWN_TABS.indexOf(FIN.tab)<0?finPlaceholder():rOverview());
  v.innerHTML=finTabs()+body;
};

try{
  var _rF=window.render;
  window.render=function(){
    var o=_rF.apply(this,arguments);
    try{ if(current==='finance'){var v=document.getElementById('view');if(v)renderFinance(v);} }catch(e){console.warn('v42 finance render',e);}
    return o;
  };
}catch(e){console.warn('v42 hook',e);}

try{ if(!window.__isShareView&&/^\/finance\/?$/.test(location.pathname)){ setTimeout(function(){try{current='finance';render();}catch(_){}},600);} }catch(_){}

console.info('%c[v42 finance ledger] loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v42 layer failed',e);}})();
