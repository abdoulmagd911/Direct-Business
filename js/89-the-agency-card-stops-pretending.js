/* ===== js/89 — the Agency profile card stops offering to edit something it cannot change
   (fire #168, 2026-09-21) =====

   The company's identity is stored TWICE. Measured live the same day
   (scripts/qa/diag-agency-profile-card.mjs):

     · `company_identity` — the registry, 29 rows. Since 2026-08-24 the AGENCY block is hydrated
       from it (js/66), and since #160-#162 every document reads it. This is the source.
     · `app_state.data.agency` — an older block of 25 fields, still full of values. **Seven of the
       thirteen comparable fields disagree with the registry**, including the VAT registration
       number and a bank IBAN.

   Sitting on `/dashboard` is a card, "🇸🇦 Agency profile — KSA settings", with six input boxes for
   the trade name, the VAT number, the IBAN, the bank and the IATA Wakeel number, under the sentence
   *"Used on every invoice header, ZATCA QR seed, and BSP payout reconciliation."*

   Driven live, here is what it actually does:
     · it SHOWS the registry values — correct, because js/66 hydrates AGENCY before it renders;
     · each box WRITES to `DB.agency`, the older block, which nothing reads any more;
     · and js/66 re-hydrates AGENCY from the registry on the next page load, so the typed value is
       thrown away.
   Its sentence stopped being true on 2026-08-24. So somebody correcting the company's VAT number
   here would believe they had corrected it everywhere, and would have changed nothing — the exact
   shape of defect this project keeps paying for: a control that promises and does nothing.

   This layer does not delete the card. It makes it tell the truth:
     · the boxes become plain read-only values — nothing to type into, nothing thrown away;
     · the sentence says where these come from and where they are changed;
     · a button opens Company assets & registry, shown only to somebody who may open it, because a
       button that bounces is its own small lie (the lesson of #165's jump chips);
     · and the fields the registry has NO key for are named rather than shown blank, so the gap is
       visible instead of looking like an empty box somebody forgot to fill.

   Nothing is removed: `renderDash` still builds its card, `DB.agency` is untouched, and deleting
   this file puts the editable boxes straight back.

   Bilingual, renders once per render (the .v89- guard), following the v33-v36 / js/86 pattern. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc89(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }
  function reg(k){ try{ return (typeof window.dgIdentityValue==='function')?(window.dgIdentityValue(k,'en')||''):''; }catch(_){ return ''; } }
  function mayDocs(){ try{ return (typeof window.mayOpenPage==='function')?window.mayOpenPage('documents'):false; }catch(_){ return false; } }

  /* what the card offered, and where each one really lives now */
  var FIELDS=[
    {en:'Trade name',            ar:'الاسم التجاري',        key:'brand_name'},
    {en:'Legal name',            ar:'الاسم النظامي',        key:'legal_name'},
    {en:'VAT registration no.',  ar:'رقم التسجيل الضريبي',  key:'vat_number'},
    {en:'Commercial Registration',ar:'السجل التجاري',       key:'cr_number'},
    {en:'Bank account (IBAN)',   ar:'الحساب البنكي (آيبان)',key:'iban_alinma'},
    {en:'IATA accreditation',    ar:'اعتماد الإياتا',       key:'iata'}
  ];
  /* named on purpose rather than drawn blank — the registry has no key for these yet, and an empty
     box reads as "nobody filled it in" when the truth is "this app has nowhere to keep it" */
  var MISSING=[
    {en:'IATA Wakeel / agent number', ar:'رقم الوكيل (إياتا)'},
    {en:'Zakat / Tax ID',             ar:'الرقم الضريبي/الزكوي'},
    {en:'Bank name',                  ar:'اسم البنك'}
  ];

  function enhance(){try{
    if(window.__isShareView) return;                       /* M29: a link holder is not shown this */
    var view=document.getElementById('view'); if(!view) return;
    if(view.querySelector('.v89-identity')) return;         /* once per render */
    var cards=[].slice.call(view.querySelectorAll('.card'));
    var card=null;
    for(var i=0;i<cards.length;i++){
      var h=cards[i].querySelector('h3');
      if(h&&/Agency profile/i.test(h.textContent||'')){ card=cards[i]; break; }
    }
    if(!card) return;
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');

    /* 2026-09-23 (fire #232) — the heading was the one string in this card that this layer left
       alone, and on the Arabic page it was the only English left on it: everything underneath is
       written here in both languages, and the title above it still read "🇸🇦 Agency profile — KSA
       settings (ZATCA · IATA Wakeel · Saudi IBAN)".
       Why here and not in js/21's dictionary: every other word in this card is written by this
       file, and this phrase appears nowhere else in the app — the shared dictionary is for words
       used in several places (M38), and splitting one card's wording across two owners is how the
       halves drift apart. The Arabic follows the words already agreed elsewhere: ZATCA is «هيئة
       الزكاة والضريبة» as in js/21, IATA is «إياتا» and IBAN «آيبان» as in the rows below.
       The ENGLISH is never touched, so whatever renderDash calls this card is what English readers
       keep seeing; and the English is kept on the element, because the lookup above finds this card
       by its English heading and must still work on the next render. */
    (function(){
      try{
        var hd=card.querySelector('h3'); if(!hd||!ar) return;
        if(hd.getAttribute('data-v89-ar')==='1') return;
        if(!hd.getAttribute('data-v89-en')) hd.setAttribute('data-v89-en',hd.textContent||'');
        hd.textContent='🇸🇦 ملف الوكالة — الإعدادات السعودية (هيئة الزكاة والضريبة · وكيل إياتا · آيبان سعودي)';
        hd.setAttribute('data-v89-ar','1');
      }catch(_){}
    })();

    /* the old body goes away, the card and its heading stay */
    var sub=card.querySelector('.ch-sub'); if(sub)sub.remove();
    var tbl=card.querySelector('.tbl-wrap'); if(tbl)tbl.remove();
    [].slice.call(card.querySelectorAll('div')).forEach(function(d){
      if(/ZATCA QR TLV|Phase-2 simplified/i.test(d.textContent||''))d.remove();
    });

    var box=document.createElement('div');
    box.className='v89-identity';
    box.setAttribute('dir', ar?'rtl':'ltr');
    box.style.cssText='text-align:'+(ar?'right':'left');

    var rows=FIELDS.map(function(f){
      var v=reg(f.key);
      return '<div class="fact"><span class="k">'+esc89(fl(f.en,f.ar))+'</span>'+
        '<span class="v">'+(v?esc89(v):'<span style="color:var(--muted)">'+fl('not in the registry','غير مُسجَّل')+'</span>')+'</span></div>';
    }).join('');

    var missing='<div style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.7">'+
      fl('Not kept anywhere the documents can read yet: ','لا تُحفظ بعد في مكان تقرأ منه المستندات: ')+
      MISSING.map(function(m){ return esc89(fl(m.en,m.ar)); }).join(' · ')+'.</div>';

    var note='<div style="font-size:12.5px;color:var(--muted);line-height:1.7;margin-bottom:10px">'+
      fl('These are the company\'s registered details, and every document reads them from <b>Company assets &amp; registry</b>. They are shown here, not edited here — a change made on this screen would not reach a single document.',
         'هذه بيانات الشركة المسجّلة، وكل مستند يقرأها من <b>أصول الشركة والسجل</b>. تُعرض هنا ولا تُعدَّل هنا — أي تعديل في هذه الشاشة لن يصل إلى أي مستند.')+
      '</div>';

    var btn=mayDocs()?('<div style="margin-top:12px"><button class="btn sm v89-open">'+
      fl('Open Company assets &amp; registry ↗','فتح أصول الشركة والسجل ↗')+'</button></div>'):'';

    box.innerHTML=note+rows+missing+btn;
    card.appendChild(box);

    var b=box.querySelector('.v89-open');
    if(b)b.addEventListener('click',function(){
      try{ current='documents'; if(typeof render==='function')render();
        setTimeout(function(){ try{ if(typeof window.dgGo==='function')window.dgGo('assets'); }catch(_){} },260);
      }catch(_){}
    });
  }catch(e){ if(window.console)console.warn('[v89]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(enhance,80); return out; };
  }
  setTimeout(enhance,900);
  try{ window.__v89Probe=function(){ try{ var v=document.getElementById('view');
    return { replaced: !!(v&&v.querySelector('.v89-identity')),
      inputs: v?[].slice.call(v.querySelectorAll('.card input')).filter(function(i){
        var c=i.closest('.card'); var h=c?c.querySelector('h3'):null;
        return h&&/Agency profile/i.test(h.textContent||''); }).length:-1 }; }catch(_){ return null; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v89] init',e); }})();
