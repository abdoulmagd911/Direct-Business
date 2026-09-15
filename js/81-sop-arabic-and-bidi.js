/* js/81 — SOP library on the Arabic page: English procedure text reads left-to-right, and the two
   comparison-box headers speak Arabic (2026-09-15, fire #51, driven live and seen by eye).
   1. The SOP texts (purpose, the GDS command line, the two comparison boxes) are written in
      English — reference content, not chrome. On the Arabic page they sat inside an RTL container,
      so every sentence's full stop jumped to the LEFT end of the line and arrows/brackets flipped:
      "…before acting." rendered as ".Open and read any booking before acting". `unicode-bidi:
      plaintext` lets each paragraph follow its own first strong character: Arabic paragraphs stay
      RTL, English ones read LTR, with no change to the surrounding layout.
   2. The two box headers are built by core-08's English rewrite chain ("Saudi market standard" →
      "Saudi common practice baseline", "Direct Business edge" → "Our standard") and js/21's Arabic
      dictionary knows neither combined string, so both stayed English on the Arabic page — the
      only English chrome left on that page. Also the "Purpose." lead-in of every SOP.
   Scoped to the SOP entries (.sop). Rollback = delete this file and its script line. */
(function(){try{
  var st=document.createElement('style'); st.id='v81sopCss';
  st.textContent='html[dir="rtl"] .sop .body p,html[dir="rtl"] .sop pre,html[dir="rtl"] .sop .box p{unicode-bidi:plaintext;text-align:start}';
  (document.head||document.documentElement).appendChild(st);
  var isAr=function(){ try{ return typeof LANG!=='undefined'&&LANG==='ar'; }catch(_){ return false; } };
  var MAP=[[/^(saudi\s+)?(common practice( baseline)?|market standard)$/i,'الممارسة الشائعة في السوق السعودي'],[/^(our standard|direct business edge)$/i,'معيارنا']];
  function words(){
    try{
      if(!isAr()) return;
      document.querySelectorAll('#view .sop .box .h').forEach(function(h){
        var t=(h.textContent||'').replace(/\s+/g,' ').trim(); if(!t||/[؀-ۿ]/.test(t)) return;
        for(var i=0;i<MAP.length;i++){ if(MAP[i][0].test(t)){ var ic=h.querySelector('svg,span'); h.textContent=''; if(ic) h.appendChild(ic); h.appendChild(document.createTextNode((ic?' ':'')+MAP[i][1])); break; } }
      });
      /* the lead-in becomes Arabic, which would make the whole paragraph RTL again (its first strong
         character) and push the English sentence's full stop back to the left — so the sentence
         after the label is isolated in its own dir="auto" span and keeps reading left-to-right */
      document.querySelectorAll('#view .sop .body p > b').forEach(function(b){
        if((b.textContent||'').trim()!=='Purpose.') return;
        b.textContent='الغرض.';
        var p=b.parentNode; if(!p||p.querySelector('span[data-v81-rest]')) return;
        var span=document.createElement('span'); span.setAttribute('dir','auto'); span.setAttribute('data-v81-rest','1');
        var n=b.nextSibling; while(n){ var nx=n.nextSibling; span.appendChild(n); n=nx; }
        p.appendChild(document.createTextNode(' ')); p.appendChild(span);
      });
    }catch(_){}
  }
  if(typeof window.render==='function'&&!window.render.__v81){
    var _r=window.render;
    var w=function(){ var o=_r.apply(this,arguments); try{ words(); setTimeout(words,120); }catch(_){} return o; };
    w.__v81=1; window.render=w;
  }
  if(typeof window.setSopslaTab==='function'&&!window.setSopslaTab.__v81){
    var _t=window.setSopslaTab; var wt=function(){ var o=_t.apply(this,arguments); try{ words(); setTimeout(words,120); }catch(_){} return o; }; wt.__v81=1; window.setSopslaTab=wt;
  }
}catch(e){ console.warn('[js/81 sop-arabic-and-bidi]',e); }})();
