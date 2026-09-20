/* ===== js/87 — a document must not go out with the company's identity missing (fire #160, 2026-09-21)

   All five client-document tabs — price offer, service fees, company profile, contract, tender —
   print a footer carrying the company's legal name, its unified number and its tourism-licence
   number, and every one of them reads those from the `company_identity` registry. Each treated a
   FAILED read of that registry as an empty one (`S.identity = r.error ? [] : …`), and then filled
   the gap from literals written into the code — literals that had drifted: **each was one digit
   short of what the registry holds**. So a quotation, a contract or a tender built while that one
   request was failing went out with a unified number and a licence number that are not the
   company's. A missing identifier is a gap somebody notices. A wrong one is sent.

   The literals are gone (js/67-71: no value, no line — which also keeps the company's own
   registered numbers in the database rather than in a public repo, rule 7). This file is the other
   half, under M27: when the registry did not load, the person building the document is told, on
   screen, before they send it.

   It is one line at the top of the Documents page, and it is `.noprint` — it belongs to the person
   working, not to the paper. It appears only while the last read actually failed; when the registry
   loads, no notice. Nothing here writes, and nothing blocks the editor: a draft is still worth
   working on, and the honest thing is to say what would be missing from it.

   Removing this file removes the line and nothing else. */
(function(){try{
  function fl(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; }
  function esc87(s){ try{ return (typeof esc==='function')?esc(s):String(s==null?'':s); }catch(_){ return String(s==null?'':s); } }

  function show(){try{
    if(typeof current==='undefined'||current!=='documents') return;
    var view=document.getElementById('view'); if(!view) return;
    var err=null; try{ err=window.__identityLoadError||null; }catch(_){ }
    var had=view.querySelector('.v87-identity');
    if(!err){ if(had&&had.parentNode)had.parentNode.removeChild(had); return; }
    if(had) return;                                   /* once per render */
    var ar=(typeof LANG!=='undefined'&&LANG==='ar');
    var d=document.createElement('div');
    d.className='v87-identity noprint';
    d.setAttribute('dir', ar?'rtl':'ltr');
    d.style.cssText='background:#FDECEB;border:1px solid #F0453A;border-radius:10px;padding:10px 13px;margin:0 0 12px;'+
      'font-size:12.5px;color:#B42318;line-height:1.6;text-align:'+(ar?'right':'left');
    d.innerHTML='<b>'+fl('The company details did not load: ','تعذّر تحميل بيانات الشركة: ')+esc87(err)+'</b><br>'+
      fl('Anything printed from this page right now would be missing the unified number and the tourism-licence number — the registry is the only place they come from, and nothing is filled in from memory. Reload the page before you send a document from here.',
         'أي مستند يُطبع من هذه الصفحة الآن سيكون بلا الرقم الموحد ورقم الترخيص — السجل هو مصدرهما الوحيد، ولا يُملأ أي منهما من الذاكرة. أعد تحميل الصفحة قبل إرسال أي مستند من هنا.');
    view.insertBefore(d, view.firstChild);
  }catch(e){ if(window.console)console.warn('[v87]',e); }}

  if(typeof render==='function'){
    var _r=render;
    window.render=function(){ var out=_r.apply(this,arguments); setTimeout(show,80); return out; };
  }
  setTimeout(show,1200);
  try{ window.__v87Probe=function(){ try{ return !!document.querySelector('.v87-identity'); }catch(_){ return false; } }; }catch(_){}
}catch(e){ if(window.console)console.warn('[v87] init',e); }})();
