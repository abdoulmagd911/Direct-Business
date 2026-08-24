/* ===== Price Offer tab — the Proposal Studio, migrated onto the generator engine =====
   (Phase 1, STEP 2, 2026-08-24)

   Replaces brand/proposal.html's two defects by design:
   - NO per-browser storage anywhere in this file. Drafts and issued offers live in the
     `generated_documents` table (family 'OFR', payload JSONB, status draft/sent/accepted).
   - NO client-side numbering. A number is assigned ONLY at issue time by the atomic
     server function public.next_document_number('OFR') — drafts carry no number.

   Rules honoured (docs/DECISIONS.md):
   - P5/F1: the preview is styled ONLY with var(--…) resolved from /brand/tokens.css
     (injected by js/66) under data-identity="classic". No copied brand hexes here.
   - M1: VAT 15% appears on this CLIENT-FACING document — legitimate and expected.
   - B2: every write chains .select() and checks the returned row count.
   - M8: totals are always computed, never typed.
   - D4: no real client data in this file — clients are PICKED from the app's own
     records (DB.businesses), identity values come live from company_identity.

   Registers itself through the js/66 seam: window.dgRegisterTab('offer', renderFn). */
(function(){try{

  var VAT=0.15;
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function canWrite(){ try{ return ['admin','manager','bd','team_member'].indexOf(window.__userRole)>=0; }catch(_){ return false; } }
  function toast(msg){ try{ if(window.__toast){__toast(msg);return;} }catch(_){}
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--ink,#333);color:#fff;padding:10px 16px;border-radius:10px;z-index:9999;font-size:14px';
    t.textContent=msg; document.body.appendChild(t); setTimeout(function(){try{t.remove();}catch(_){}} ,2600);
  }
  function fmt(n){ if(!isFinite(n))return '—'; return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function addDays(iso,days){ var d=new Date(iso+'T00:00:00'); if(isNaN(d))return '';
    d.setDate(d.getDate()+Number(days||0));
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  /* ---------- amount in words (ported verbatim from brand/proposal.html) ----------
     Direct's real financial offers state every figure in numbers AND in words. */
  function wordsEN(n){
    var ones=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve',
      'thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    var tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    function under1000(x){
      var s='';
      if(x>=100){ s+=ones[Math.floor(x/100)]+' hundred'; x%=100; if(x) s+=' and '; }
      if(x>=20){ s+=tens[Math.floor(x/10)]; if(x%10) s+='-'+ones[x%10]; }
      else if(x>0){ s+=ones[x]; }
      return s;
    }
    n=Math.floor(n);
    if(n===0) return 'zero';
    var parts=[], units=[[1e9,'billion'],[1e6,'million'],[1e3,'thousand']];
    for(var i=0;i<units.length;i++){
      var u=units[i][0];
      if(n>=u){ parts.push(under1000(Math.floor(n/u))+' '+units[i][1]); n%=u; }
    }
    if(n>0) parts.push(under1000(n));
    return parts.join(' ');
  }
  var AR_ONES_M=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];
  var AR_ONES_F=['','واحدة','اثنتان','ثلاث','أربع','خمس','ست','سبع','ثماني','تسع'];
  var AR_TEENS_M=['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  var AR_TEENS_F=['عشر','إحدى عشرة','اثنتا عشرة','ثلاث عشرة','أربع عشرة','خمس عشرة','ست عشرة','سبع عشرة','ثماني عشرة','تسع عشرة'];
  var AR_TENS=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  var AR_HUNS=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
  function arUnder100(x,fem){
    var ones=fem?AR_ONES_F:AR_ONES_M, teens=fem?AR_TEENS_F:AR_TEENS_M;
    if(x===0) return '';
    if(x<10) return ones[x];
    if(x<20) return teens[x-10];
    var t=AR_TENS[Math.floor(x/10)], o=x%10;
    return o? ones[o]+' و'+t : t;
  }
  function arUnder1000(x,fem){
    var p=[];
    if(x>=100){ p.push(AR_HUNS[Math.floor(x/100)]); x%=100; }
    var rest=arUnder100(x,fem); if(rest) p.push(rest);
    return p.join(' و');
  }
  function wordsAR(n,fem){
    n=Math.floor(n);
    if(n===0) return 'صفر';
    var out=[];
    function group(value,one,two,few,many){
      if(value===0) return;
      if(value===1){ out.push(one); return; }
      if(value===2){ out.push(two); return; }
      var last2=value%100;
      if(last2>=3&&last2<=10) out.push(arUnder1000(value,false)+' '+few);
      else if(last2===0)      out.push(arUnder1000(value,false)+' '+one);
      else                    out.push(arUnder1000(value,false)+' '+many);
    }
    var mil=Math.floor(n/1e6); n%=1e6;
    var th=Math.floor(n/1e3);  n%=1e3;
    group(mil,'مليون','مليونان','ملايين','مليوناً');
    group(th,'ألف','ألفان','آلاف','ألفاً');
    if(n>0) out.push(arUnder1000(n,fem));
    var s=out.join(' و');
    return s.replace(/مائتان$/,'مائتا').replace(/ألفان$/,'ألفا').replace(/مليونان$/,'مليونا');
  }
  function arCounted(value,fem){
    var one=fem?'هللة':'ريال', dual=fem?'هللتان':'ريالان', few=fem?'هللات':'ريالات', many=fem?'هللة':'ريالاً';
    if(value===1) return one+' '+(fem?'واحدة':'واحد');
    if(value===2) return dual;
    var last2=value%100, w=wordsAR(value,fem);
    if(last2>=3&&last2<=10) return w+' '+few;
    if(last2===0)           return w.replace(/ألفاً$/,'ألف').replace(/مليوناً$/,'مليون')+' '+one;
    return w+' '+many;
  }
  function amountInWords(total,lang){
    if(total<0){
      var body=amountInWords(-total,lang);
      return lang==='ar'? body.replace(/^فقط /,'سالب ') : 'Minus '+body.charAt(0).toLowerCase()+body.slice(1);
    }
    var riyals=Math.floor(total+1e-9);
    var halalas=Math.round((total-riyals)*100);
    if(halalas===100){ riyals+=1; halalas=0; }
    if(lang==='ar'){
      var parts=[];
      if(riyals>0) parts.push(arCounted(riyals,false));
      if(halalas>0) parts.push(arCounted(halalas,true));
      if(!parts.length) parts.push('صفر ريال');
      return 'فقط '+parts.join(' و')+' لا غير';
    }
    var e='';
    if(riyals>0) e=wordsEN(riyals)+' Saudi riyal'+(riyals===1?'':'s');
    if(halalas>0) e+=(e?' and ':'')+wordsEN(halalas)+' halala'+(halalas===1?'':'s');
    if(!e) e='zero Saudi riyals';
    return e.charAt(0).toUpperCase()+e.slice(1)+' only';
  }
  /* probe hooks — QA proves the algorithm live, sabotage-testably */
  window.__poWordsProbe=function(n){ return { en:amountInWords(n,'en'), ar:amountInWords(n,'ar') }; };

  /* ---------- state ---------- */
  function blankLine(){ return {svc:'',svcAr:'',unit:'',qty:1,orig:'',price:''}; }
  function blankOffer(){
    return { lang:'en', clientId:'', attn:'', titleEn:'', titleAr:'',
      date:todayISO(), valid:14, by:'', notes:'', showOrig:false, vatIncl:false,
      lines:[blankLine()] };
  }
  var S={ cur:blankOffer(), rowId:null, docNumber:null, status:'draft',
          list:null, listLoading:false, identity:null, saving:false };

  /* ---------- data ---------- */
  function loadIdentity(){
    if(S.identity!==null)return;
    var c=client(); if(!c)return;
    S.identity={}; /* mark in-flight */
    c.from('company_identity').select('key,value_en,value_ar').then(function(r){
      var m={};
      (r.data||[]).forEach(function(x){ m[x.key]={en:x.value_en,ar:x.value_ar}; });
      S.identity=m; repaint();
    });
  }
  function idv(key,lang){
    var v=(S.identity||{})[key]||{};
    /* company names are never translated — legal_name keeps whichever form is on file */
    if(lang==='ar') return v.ar||v.en||'';
    return v.en||v.ar||'';
  }
  function loadList(force){
    if(S.listLoading)return; if(S.list&&!force)return;
    var c=client(); if(!c)return;
    S.listLoading=true;
    c.from('generated_documents').select('id,doc_number,title,status,business_id,created_at,payload')
     .eq('family','OFR').order('created_at',{ascending:false}).limit(60)
     .then(function(r){
        S.listLoading=false;
        S.list=r.error?[]:(r.data||[]);
        repaint();
     });
  }
  function bizName(id){
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===id;});
      return b?(isAr()&&b.nameAr?b.nameAr:b.name):''; }catch(_){ return ''; }
  }
  function docClientName(lang){
    /* company names never translated: use the record's own name as stored */
    try{ var b=(DB.businesses||[]).find(function(x){return x.id===S.cur.clientId;});
      if(!b)return '';
      return (lang==='ar'&&b.nameAr)?b.nameAr:(b.name||b.nameAr||''); }catch(_){ return ''; }
  }

  /* ---------- math (subtotal + VAT = total, to the halala) ---------- */
  function calc(){
    var rows=[], sub=0;
    (S.cur.lines||[]).forEach(function(l){
      var qty=Number(l.qty)||0, price=Number(l.price)||0, amt=qty*price;
      if(l.svc||l.svcAr||price){ rows.push({l:l,amt:amt}); sub+=amt; }
    });
    function r2(n){ return Math.round(n*100)/100; }
    var subEx,vat,tot;
    if(S.cur.vatIncl){ tot=r2(sub); subEx=r2(sub/(1+VAT)); vat=r2(tot-subEx); }
    else{ subEx=r2(sub); vat=r2(subEx*VAT); tot=r2(subEx+vat); }
    return {rows:rows,subEx:subEx,vat:vat,tot:tot};
  }
  window.__poCalcProbe=function(){ var c=calc(); return {subEx:c.subEx,vat:c.vat,tot:c.tot}; };

  /* ---------- bilingual document strings ---------- */
  var T={
    en:{cover:'Price Offer',coverSub:'Travel & Tourism Services',prepFor:'Prepared for',
        offerNo:'Offer no.',date:'Date',valid:'Valid until',by:'Prepared by',draft:'DRAFT — no number yet',
        pricing:'Pricing details',num:'#',svc:'Service',unit:'Unit / Qty',
        orig:'Original price',amount:'Amount (SAR)',
        subtotal:'Subtotal (ex-VAT)',vat:'VAT 15%',total:'Total (incl. VAT)',
        termsHead:'Terms & notes',thanks:'Thank You',inWords:'In words:',
        tag:'Global supplier power. Saudi service. One partner.',
        defTerms:'Prices are service fees per person/ticket/document unless stated otherwise, and exclude supplier, airline, hotel, embassy and government charges unless the line says "Total".\nThis offer is valid until the date shown; after that, prices are subject to reconfirmation.\nTax invoices are issued by Direct Payment upon confirmation.'},
    ar:{cover:'عرض سعر',coverSub:'خدمات السفر والسياحة',prepFor:'مقدم إلى',
        offerNo:'رقم العرض',date:'التاريخ',valid:'صالح حتى',by:'إعداد',draft:'مسودة — بلا رقم بعد',
        pricing:'تفاصيل الأسعار',num:'#',svc:'الخدمة',unit:'الوحدة / الكمية',
        orig:'السعر الأصلي',amount:'الإجمالي (ريال)',
        subtotal:'الإجمالي غير شامل الضريبة',vat:'ضريبة القيمة المضافة 15%',total:'الإجمالي شامل الضريبة',
        termsHead:'الشروط والملاحظات',thanks:'شكراً لكم',inWords:'المبلغ كتابةً:',
        tag:'قوة موردين عالمية. خدمة سعودية. شريك واحد.',
        defTerms:'الأسعار قيمة خدمة لكل شخص/تذكرة/مستند ما لم يُذكر خلاف ذلك، ولا تشمل رسوم الموردين وشركات الطيران والفنادق والسفارات والجهات الحكومية ما لم يُذكر "الإجمالي".\nهذا العرض صالح حتى التاريخ الموضح، وبعده تخضع الأسعار لإعادة التأكيد.\nتصدر الفواتير الضريبية من دايركت للمدفوعات عند التأكيد.'}
  };
  /* Direct's standard services — bilingual names + units pre-filled, prices never */
  var STD=[
    ['Domestic flight booking','حجز طيران داخلي','Per ticket'],
    ['International flight booking','حجز طيران دولي','Per ticket'],
    ['Ticket refund / re-issue','استرداد / إعادة إصدار تذكرة','Per ticket'],
    ['Hotel reservation','حجز فندقي','Per night / booking'],
    ['Visa services','خدمات التأشيرات','Per visa'],
    ['Meet & assist / VIP lounge','استقبال ومساعدة / صالة كبار الزوار','Per person'],
    ['Train & other transport tickets','تذاكر القطارات والمواصلات','Per ticket'],
    ['Car rental (with/without driver)','استئجار سيارات (بسائق أو بدون)','Per day'],
    ['Travel insurance','تأمين السفر','Per person'],
    ['International driving permit','رخصة القيادة الدولية','Per permit'],
    ['Meeting rooms & event venues','قاعات الاجتماعات والفعاليات','Per booking'],
    ['Document shipping','الشحن بالبريد','Per shipment']
  ];

  /* ---------- persistence (B2: every write .select()-checked) ---------- */
  function rowFromState(){
    return {
      family:'OFR', doc_type:'price_offer',
      business_id:S.cur.clientId||null,
      title:(S.cur.titleEn||S.cur.titleAr||T[S.cur.lang||'en'].cover),
      payload:S.cur, status:S.status||'draft',
      doc_number:S.docNumber||null,
      updated_at:new Date().toISOString(),
      updated_by:(window.__userEmail||null)
    };
  }
  function refusedMsg(){ toast(fl('Save was refused — nothing changed','رُفض الحفظ — لم يتغير شيء')); }
  window.poSaveDraft=function(then){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.saving)return; S.saving=true; repaintBar();
    var rec=rowFromState();
    var done=function(ok,row){
      S.saving=false;
      if(!ok){ refusedMsg(); repaintBar(); return; }
      if(row&&row.id)S.rowId=row.id;
      loadList(true); repaint();
      toast(fl('Saved to the offers registry','تم الحفظ في سجل العروض'));
      if(typeof then==='function')then();
    };
    if(S.rowId){
      c.from('generated_documents').update(rec).eq('id',S.rowId).select().then(function(r){
        done(!r.error&&r.data&&r.data.length===1, r.data&&r.data[0]);
      });
    }else{
      rec.created_by=(window.__userEmail||null);
      c.from('generated_documents').insert(rec).select().then(function(r){
        done(!r.error&&r.data&&r.data.length===1, r.data&&r.data[0]);
      });
    }
  };
  /* number assigned ONLY here, server-side, at issue time — never for drafts */
  window.poIssue=function(){
    var c=client(); if(!c){ refusedMsg(); return; }
    if(S.docNumber){ toast(fl('Already issued as '+S.docNumber,'صدر مسبقاً برقم '+S.docNumber)); return; }
    var go=function(){
      c.rpc('next_document_number',{p_family:'OFR'}).then(function(r){
        if(r.error||!r.data){ toast(fl('Numbering was refused — the offer stays a draft','رُفض الترقيم — يبقى العرض مسودة')); return; }
        var no=r.data;
        c.from('generated_documents')
         .update({doc_number:no,status:'sent',updated_at:new Date().toISOString(),updated_by:(window.__userEmail||null)})
         .eq('id',S.rowId).select().then(function(u){
            if(u.error||!u.data||u.data.length!==1){ refusedMsg(); return; }
            S.docNumber=no; S.status='sent';
            loadList(true); repaint();
            toast(fl('Issued: '+no,'صدر العرض: '+no));
         });
      });
    };
    if(S.rowId) window.poSaveDraft(go); else window.poSaveDraft(function(){ if(S.rowId)go(); });
  };
  window.poMarkAccepted=function(){
    var c=client(); if(!c||!S.rowId)return;
    c.from('generated_documents').update({status:'accepted',updated_at:new Date().toISOString()})
     .eq('id',S.rowId).select().then(function(r){
        if(r.error||!r.data||r.data.length!==1){ refusedMsg(); return; }
        S.status='accepted'; loadList(true); repaint(); toast(fl('Marked accepted','تم وضع علامة مقبول'));
     });
  };
  window.poOpen=function(id){
    var rec=(S.list||[]).find(function(x){return x.id===id;});
    if(!rec||!rec.payload)return;
    S.cur=Object.assign(blankOffer(),rec.payload);
    if(!S.cur.lines||!S.cur.lines.length)S.cur.lines=[blankLine()];
    S.rowId=rec.id; S.docNumber=rec.doc_number||null; S.status=rec.status||'draft';
    repaint();
  };
  window.poNew=function(){
    S.cur=blankOffer(); S.rowId=null; S.docNumber=null; S.status='draft'; repaint();
  };

  /* ---------- form mutation (repaints only the preview to keep focus) ---------- */
  window.poSet=function(k,v){ S.cur[k]=v; repaintPreview(); };
  window.poSetChk=function(k,v){ S.cur[k]=!!v; repaint(); };
  window.poSetLine=function(i,k,v){ if(S.cur.lines[i]){ S.cur.lines[i][k]=v; repaintPreview(); } };
  window.poLine=function(op,i){
    var L=S.cur.lines;
    if(op==='add')L.push(blankLine());
    else if(op==='rm'){ L.splice(i,1); if(!L.length)L.push(blankLine()); }
    else if(op==='up'&&i>0){ var a=L[i-1];L[i-1]=L[i];L[i]=a; }
    else if(op==='down'&&i<L.length-1){ var b=L[i+1];L[i+1]=L[i];L[i]=b; }
    else if(op==='dup')L.splice(i+1,0,JSON.parse(JSON.stringify(L[i])));
    repaint();
  };
  window.poQuickAdd=function(sel){
    var idx=parseInt(sel.value,10); sel.value='';
    if(isNaN(idx)||!STD[idx])return;
    var L=S.cur.lines, last=L[L.length-1];
    var line={svc:STD[idx][0],svcAr:STD[idx][1],unit:STD[idx][2],qty:1,orig:'',price:''};
    if(last&&!last.svc&&!last.svcAr&&!last.price)L[L.length-1]=line; else L.push(line);
    repaint();
  };
  window.poLang=function(l){ S.cur.lang=l; repaint(); };

  /* ---------- WhatsApp / email text ---------- */
  function offerAsText(){
    var lang=S.cur.lang||'en', t=T[lang], ar=lang==='ar', c=calc();
    var L=[];
    L.push((ar?'دايركت للسفر والسياحة':'Direct Travel & Tourism')+' — '+((ar?S.cur.titleAr:S.cur.titleEn)||t.cover));
    L.push(t.offerNo+' '+(S.docNumber||fl('(draft)','(مسودة)'))+'  ·  '+t.date+' '+(S.cur.date||'—'));
    var cn=docClientName(lang);
    if(cn) L.push(t.prepFor+': '+cn+(S.cur.attn?' ('+S.cur.attn+')':''));
    L.push('');
    c.rows.forEach(function(r,i){
      var l=r.l, svc=ar?(l.svcAr||l.svc):(l.svc||l.svcAr), qty=Number(l.qty)||0;
      L.push((i+1)+'. '+svc+(l.unit?' — '+l.unit:'')+(qty>1?' × '+qty:'')+' — '+fmt(r.amt)+' SAR');
    });
    L.push('');
    L.push(t.subtotal+': '+fmt(c.subEx)+' SAR');
    L.push(t.vat+': '+fmt(c.vat)+' SAR');
    L.push(t.total+': '+fmt(c.tot)+' SAR');
    L.push(t.inWords+' '+amountInWords(c.tot,lang));
    var vu=addDays(S.cur.date,S.cur.valid);
    if(vu) L.push(t.valid+': '+vu);
    L.push('');
    L.push(S.cur.notes||t.defTerms);
    L.push('');
    L.push((idv('website','en')||'www.directksa.com')+' · '+(idv('phone_licence','en')||''));
    return L.join('\n');
  }
  window.poCopy=function(){
    var txt=offerAsText();
    function done(){ toast(fl('Copied — paste into WhatsApp or email','تم النسخ — الصقه في واتساب أو البريد')); }
    function fallback(){ try{ var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }catch(_){ toast(fl('Copy failed','فشل النسخ')); } }
    try{ navigator.clipboard.writeText(txt).then(done,fallback); }catch(_){ fallback(); }
  };
  window.poPrint=function(){ try{ window.print(); }catch(_){} };

  /* ---------- render: css ---------- */
  function css(){ return '<style id="poCss">'+
    '#poWrap{display:grid;grid-template-columns:400px 1fr;gap:18px;align-items:start}'+
    '@media(max-width:1100px){#poWrap{grid-template-columns:1fr}}'+
    '#poWrap .po-form label{display:block;font-weight:700;font-size:12px;margin:10px 0 4px;color:var(--ink)}'+
    '#poWrap .po-form input,#poWrap .po-form select,#poWrap .po-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--hairline,#ddd);border-radius:9px;padding:8px 10px;font-size:13.5px;font-family:inherit;background:var(--surface,#fff);color:var(--ink)}'+
    '#poWrap .po-form textarea{min-height:80px;resize:vertical}'+
    '#poWrap .po-seg{display:flex;border:1px solid var(--hairline,#ddd);border-radius:10px;overflow:hidden;margin-top:4px}'+
    '#poWrap .po-seg button{flex:1;border:0;background:var(--surface,#fff);padding:8px;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted,#777)}'+
    '#poWrap .po-seg button.on{background:var(--accent);color:#fff}'+
    '#poWrap fieldset{border:1px solid var(--hairline,#ddd);border-radius:12px;margin:14px 0 0;padding:10px 12px 12px}'+
    '#poWrap legend{font-weight:800;font-size:12px;padding:0 6px;color:var(--accent);text-transform:uppercase;letter-spacing:.06em}'+
    '#poWrap .po-line{border:1px solid var(--hairline,#ddd);border-radius:10px;padding:9px;margin-bottom:9px;background:var(--wash,#f7f7f7)}'+
    '#poWrap .po-line .rm{float:inline-end;border:0;background:none;color:#D92D20;font-weight:700;cursor:pointer;font-size:12px}'+
    '#poWrap .po-line .mv{float:inline-end;border:0;background:none;color:var(--muted,#777);cursor:pointer;font-size:13px;font-weight:700;padding:0 4px}'+
    '#poWrap .po-add{width:100%;border:1px dashed var(--accent);background:var(--wash-accent,#fff6f0);color:var(--accent);font-weight:800;border-radius:10px;padding:8px;cursor:pointer;font-size:13px}'+
    '#poWrap .po-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
    '#poWrap .po-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}'+
    '#poWrap .po-status{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:800}'+
    '#poWrap .po-status.draft{background:var(--wash,#eee);color:var(--muted,#777)}'+
    '#poWrap .po-status.sent{background:var(--wash-accent,#fff3ec);color:var(--accent)}'+
    '#poWrap .po-status.accepted{background:#EAF6EE;color:#1E7A34}'+
    /* --- A4 preview, Classic identity, tokens only --- */
    '#poPages{display:flex;flex-direction:column;gap:20px;align-items:center;overflow-x:auto}'+
    '#poPages .po-page{width:794px;min-height:1123px;background:var(--surface,#fff);box-shadow:var(--shadow-card,0 6px 18px rgba(0,0,0,.15));position:relative;display:flex;flex-direction:column;flex:none;color:var(--ink)}'+
    '#poPages .po-page.ar{direction:rtl;font-family:var(--font-ar,serif)}'+
    '#poPages .po-page.en{direction:ltr;font-family:var(--font-en,sans-serif)}'+
    '#poPages .po-page.grad{background:var(--direct-gradient);color:#fff}'+
    '#poPages .po-cover{flex:1;display:flex;flex-direction:column;padding:70px 64px}'+
    '#poPages .po-cover img{width:220px;margin-bottom:56px}'+
    '#poPages .po-ct{font-size:44px;font-weight:800;line-height:1.15;margin:0 0 8px}'+
    '#poPages .po-cs{font-size:22px;opacity:.95;margin:0 0 32px}'+
    '#poPages .po-cc{font-size:19px;border-top:1px solid rgba(255,255,255,.4);padding-top:20px;max-width:80%}'+
    '#poPages .po-cc b{display:block;font-size:24px;margin-top:4px}'+
    '#poPages .po-cm{margin-top:auto;display:flex;gap:32px;flex-wrap:wrap;font-size:14px}'+
    '#poPages .po-cm span{opacity:.85;display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.08em}'+
    '#poPages .po-tag{margin-top:24px;font-size:13.5px;opacity:.9;border-top:1px solid rgba(255,255,255,.35);padding-top:14px}'+
    '#poPages .po-content{flex:1;display:flex;flex-direction:column;padding:44px 56px 70px}'+
    '#poPages .po-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}'+
    '#poPages .po-head img{height:34px}'+
    '#poPages .po-head .m{font-size:11.5px;color:var(--muted)}'+
    '#poPages .po-title{text-align:center;margin:0 0 4px;font-size:24px;font-weight:800}'+
    '#poPages .po-title .dia{color:var(--accent);font-size:14px;vertical-align:middle}'+
    '#poPages .po-sub{text-align:center;color:var(--muted);margin:0 0 24px;font-size:14px}'+
    '#poPages table.po-fee{border-collapse:separate;border-spacing:0 6px;width:100%;font-size:13.5px}'+
    '#poPages table.po-fee th{background:var(--accent-strong);color:#fff;font-weight:700;padding:9px 12px;font-size:12.5px}'+
    '#poPages table.po-fee th:first-child{border-start-start-radius:999px;border-end-start-radius:999px}'+
    '#poPages table.po-fee th:last-child{border-start-end-radius:999px;border-end-end-radius:999px}'+
    '#poPages table.po-fee td{background:var(--wash);padding:9px 12px;text-align:center}'+
    '#poPages table.po-fee td.svc{text-align:start;font-weight:600}'+
    '#poPages table.po-fee td.amt{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}'+
    '#poPages .po-totals{margin:14px 0 0;margin-inline-start:auto;width:300px;font-size:13.5px}'+
    '#poPages .po-totals .tr{display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid var(--hairline)}'+
    '#poPages .po-totals .tr.big{background:var(--accent-strong);color:#fff;font-weight:800;border-radius:9px;border:0;margin-top:6px;font-size:15px}'+
    '#poPages .po-words{margin:10px 0 0;text-align:end;font-size:12.5px;font-weight:600}'+
    '#poPages .po-words span{color:var(--muted);font-weight:400}'+
    '#poPages .po-terms{margin-top:24px;background:var(--wash);border-inline-start:4px solid var(--accent);border-radius:10px;padding:13px 16px;font-size:12px;line-height:1.7;color:var(--muted);white-space:pre-line}'+
    '#poPages .po-terms b{display:block;color:var(--ink);font-size:12.5px;margin-bottom:4px}'+
    '#poPages .po-foot{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:14px 56px;font-size:11px;color:var(--muted)}'+
    '#poPages .po-close{flex:1;display:grid;place-items:center;text-align:center;padding:60px}'+
    '#poPages .po-close img{width:230px;margin-bottom:24px}'+
    '#poPages .po-thanks{font-size:44px;font-weight:800;margin:0 0 28px}'+
    '#poPages .po-contact{font-size:15px;line-height:2;opacity:.95}'+
    '#poPages .po-draftmark{position:absolute;top:18px;inset-inline-end:18px;background:rgba(255,255,255,.9);color:var(--muted);font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;border:1px dashed var(--muted)}'+
    /* --- print: the preview pages become the PDF, everything else hides --- */
    '@media print{'+
      'body *{visibility:hidden}'+
      '#poPages,#poPages *{visibility:visible}'+
      '#poPages{position:absolute;left:0;top:0;display:block}'+
      '#poPages .po-page{width:auto;box-shadow:none;margin:0;page-break-after:always}'+
      '#poPages .po-page.grad{min-height:0;height:99.3vh;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      '#poPages .po-page:not(.grad){height:auto;min-height:99.3vh}'+
      '#poPages .po-page:last-child{page-break-after:auto}'+
      '#poPages table.po-fee tr{page-break-inside:avoid}'+
      '#poPages .po-totals,#poPages .po-terms{page-break-inside:avoid}'+
      '#poPages table.po-fee th,#poPages .po-totals .tr.big{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '}'+
    '@page{size:A4;margin:0}'+
    '</style>'; }

  /* ---------- render: preview pages ---------- */
  function pagesHtml(){
    var lang=S.cur.lang||'en', t=T[lang], ar=lang==='ar', c=calc();
    var dirCls=ar?'ar':'en';
    var title=(ar?S.cur.titleAr:S.cur.titleEn)||t.cover;
    var cn=docClientName(lang);
    var vu=addDays(S.cur.date,S.cur.valid);
    var terms=S.cur.notes||t.defTerms;
    var no=S.docNumber||'—';
    var draftMark=S.docNumber?'':'<div class="po-draftmark">'+t.draft+'</div>';
    var site=idv('website','en')||'www.directksa.com';
    var phone=idv('phone_licence','en');
    var mail=idv('email','en');
    var legal=idv('legal_name',lang);
    var crL=idv('cr_number','en'), vatL=idv('vat_number','en');

    var colsN=4+(S.cur.showOrig?1:0);
    var head='<tr><th>'+t.num+'</th><th>'+t.svc+'</th><th>'+t.unit+'</th>'+
      (S.cur.showOrig?'<th>'+t.orig+'</th>':'')+'<th>'+t.amount+'</th></tr>';
    var body=c.rows.map(function(r,i){
      var l=r.l, svc=ar?(l.svcAr||l.svc):(l.svc||l.svcAr);
      return '<tr><td>'+(i+1)+'</td><td class="svc">'+esc(svc)+'</td>'+
        '<td>'+esc(l.unit||'—')+(Number(l.qty)>1?' × '+esc(l.qty):'')+'</td>'+
        (S.cur.showOrig?'<td class="amt">'+(l.orig?fmt(Number(l.orig)):'—')+'</td>':'')+
        '<td class="amt">'+fmt(r.amt)+'</td></tr>';
    }).join('')||'<tr><td colspan="'+colsN+'" style="color:var(--muted)">…</td></tr>';

    var cover=
    '<div class="po-page grad '+dirCls+'">'+draftMark+'<div class="po-cover">'+
      '<img src="/brand/direct_logo_white.png" alt="Direct">'+
      '<h1 class="po-ct">'+esc(title)+'</h1>'+
      '<p class="po-cs">'+t.coverSub+'</p>'+
      '<div class="po-cc">'+t.prepFor+'<b>'+esc(cn||'—')+'</b>'+(S.cur.attn?esc(S.cur.attn):'')+'</div>'+
      '<div class="po-cm">'+
        '<div><span>'+t.offerNo+'</span><b>'+esc(no)+'</b></div>'+
        '<div><span>'+t.date+'</span><b>'+esc(S.cur.date||'')+'</b></div>'+
        '<div><span>'+t.valid+'</span><b>'+esc(vu)+'</b></div>'+
        (S.cur.by?'<div><span>'+t.by+'</span><b>'+esc(S.cur.by)+'</b></div>':'')+
      '</div>'+
      '<div class="po-tag">'+t.tag+'</div>'+
    '</div></div>';

    var content=
    '<div class="po-page '+dirCls+'"><div class="po-content">'+
      '<div class="po-head"><img src="/brand/direct_logo_color.png" alt="Direct">'+
        '<div class="m">'+t.offerNo+' '+esc(no)+'<br>'+esc(S.cur.date||'')+'</div></div>'+
      '<h2 class="po-title"><span class="dia">◆</span> '+esc(cn||title)+' <span class="dia">◆</span></h2>'+
      '<p class="po-sub">'+t.pricing+'</p>'+
      '<table class="po-fee"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>'+
      '<div class="po-totals">'+
        '<div class="tr"><span>'+t.subtotal+'</span><b>'+fmt(c.subEx)+'</b></div>'+
        '<div class="tr"><span>'+t.vat+'</span><b>'+fmt(c.vat)+'</b></div>'+
        '<div class="tr big"><span>'+t.total+'</span><span>'+fmt(c.tot)+'</span></div>'+
      '</div>'+
      '<div class="po-words"><span>'+t.inWords+'</span> '+esc(amountInWords(c.tot,lang))+'</div>'+
      '<div class="po-terms"><b>'+t.termsHead+'</b>'+esc(terms)+'</div>'+
      '<div class="po-foot"><span>'+esc(site)+(crL?' · CR '+esc(crL):'')+(vatL?' · VAT '+esc(vatL):'')+'</span>'+
        '<span>'+esc(legal||'Direct — دايركت للسفر والسياحة')+'</span></div>'+
    '</div></div>';

    var closing=
    '<div class="po-page grad '+dirCls+'"><div class="po-close"><div>'+
      '<img src="/brand/direct_logo_white.png" alt="Direct">'+
      '<p class="po-thanks">'+t.thanks+'</p>'+
      '<p class="po-contact">'+esc([phone,mail,site].filter(Boolean).join(' · '))+'</p>'+
    '</div></div></div>';

    return cover+content+closing;
  }

  /* ---------- render: form ---------- */
  function lineHtml(l,i){
    return '<div class="po-line">'+
      '<button type="button" class="rm" onclick="poLine(\'rm\','+i+')">✕</button>'+
      '<button type="button" class="mv" onclick="poLine(\'dup\','+i+')" title="⧉">⧉</button>'+
      '<button type="button" class="mv" onclick="poLine(\'down\','+i+')">↓</button>'+
      '<button type="button" class="mv" onclick="poLine(\'up\','+i+')">↑</button>'+
      '<label>'+fl('Service (EN)','الخدمة بالإنجليزية')+'</label><input value="'+esc(l.svc)+'" oninput="poSetLine('+i+',\'svc\',this.value)">'+
      '<label>'+fl('Service (AR)','الخدمة بالعربية')+'</label><input dir="rtl" value="'+esc(l.svcAr)+'" oninput="poSetLine('+i+',\'svcAr\',this.value)">'+
      '<div class="po-row3">'+
      '<div><label>'+fl('Unit','الوحدة')+'</label><input value="'+esc(l.unit)+'" oninput="poSetLine('+i+',\'unit\',this.value)"></div>'+
      '<div><label>'+fl('Qty','الكمية')+'</label><input type="number" min="0" step="1" value="'+esc(l.qty)+'" oninput="poSetLine('+i+',\'qty\',this.value)"></div>'+
      '<div><label>'+fl('Price (SAR)','السعر (ريال)')+'</label><input type="number" min="0" step="0.01" value="'+esc(l.price)+'" oninput="poSetLine('+i+',\'price\',this.value)"></div>'+
      '</div>'+
      (S.cur.showOrig?'<div><label>'+fl('Original price (before discount)','السعر قبل الخصم')+'</label><input type="number" min="0" step="0.01" value="'+esc(l.orig)+'" oninput="poSetLine('+i+',\'orig\',this.value)"></div>':'')+
      '</div>';
  }
  function clientOptions(){
    var bs; try{ bs=(DB.businesses||[]).slice(); }catch(_){ bs=[]; }
    var clients=bs.filter(function(b){return b.isClient;});
    var leads=bs.filter(function(b){return !b.isClient;});
    function opts(list){ return list.map(function(b){
      var nm=isAr()&&b.nameAr?b.nameAr:(b.name||b.nameAr||'');
      return '<option value="'+esc(b.id)+'" '+(S.cur.clientId===b.id?'selected':'')+'>'+esc(nm)+'</option>';
    }).join(''); }
    return '<option value="">'+fl('— pick from the app\'s records —','— اختر من سجلات التطبيق —')+'</option>'+
      (clients.length?'<optgroup label="'+fl('Clients','العملاء')+'">'+opts(clients)+'</optgroup>':'')+
      (leads.length?'<optgroup label="'+fl('Leads','العملاء المحتملون')+'">'+opts(leads)+'</optgroup>':'');
  }
  function savedOptions(){
    var list=S.list||[];
    return '<option value="">'+
      (list.length?fl('— open a saved offer ('+list.length+') —','— افتح عرضاً محفوظاً ('+list.length+') —')
                  :fl('— no saved offers yet —','— لا توجد عروض محفوظة بعد —'))+'</option>'+
      list.map(function(o){
        var label=(o.doc_number||fl('draft','مسودة'))+' · '+(bizName(o.business_id)||o.title||'')+' · '+String(o.created_at||'').slice(0,10);
        return '<option value="'+esc(o.id)+'" '+(S.rowId===o.id?'selected':'')+'>'+esc(label)+'</option>';
      }).join('');
  }
  function formHtml(){
    var st=S.status||'draft';
    var stLabel=st==='draft'?fl('Draft','مسودة'):st==='sent'?fl('Issued / sent','صادر / مُرسل'):fl('Accepted','مقبول');
    return '<div class="card po-form">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<b>'+fl('Price Offer','عرض السعر')+'</b>'+
        '<span><span class="po-status '+esc(st)+'">'+stLabel+(S.docNumber?' · '+esc(S.docNumber):'')+'</span></span>'+
      '</div>'+
      '<label>'+fl('Saved offers (shared registry)','العروض المحفوظة (سجل مشترك)')+'</label>'+
      '<select onchange="if(this.value)poOpen(this.value)">'+savedOptions()+'</select>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" onclick="poNew()">＋ '+fl('New','جديد')+'</button>'+
      '</div>'+
      '<label>'+fl('Document language','لغة المستند')+'</label>'+
      '<div class="po-seg">'+
        '<button type="button" class="'+((S.cur.lang||'en')==='en'?'on':'')+'" onclick="poLang(\'en\')">English</button>'+
        '<button type="button" class="'+(S.cur.lang==='ar'?'on':'')+'" onclick="poLang(\'ar\')">العربية</button>'+
      '</div>'+
      '<fieldset><legend>'+fl('Client','العميل')+'</legend>'+
        '<label>'+fl('Company (picked from records — never retyped)','الشركة (من السجلات — لا تُكتب يدوياً)')+'</label>'+
        '<select onchange="poSet(\'clientId\',this.value)">'+clientOptions()+'</select>'+
        '<label>'+fl('Attention (person)','عناية')+'</label>'+
        '<input value="'+esc(S.cur.attn)+'" oninput="poSet(\'attn\',this.value)">'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Offer','العرض')+'</legend>'+
        '<label>'+fl('Title (EN)','العنوان بالإنجليزية')+'</label>'+
        '<input value="'+esc(S.cur.titleEn)+'" placeholder="Price Offer" oninput="poSet(\'titleEn\',this.value)">'+
        '<label>'+fl('Title (AR)','العنوان بالعربية')+'</label>'+
        '<input dir="rtl" value="'+esc(S.cur.titleAr)+'" placeholder="عرض سعر" oninput="poSet(\'titleAr\',this.value)">'+
        '<div class="po-row2">'+
          '<div><label>'+fl('Date','التاريخ')+'</label><input type="date" value="'+esc(S.cur.date)+'" oninput="poSet(\'date\',this.value)"></div>'+
          '<div><label>'+fl('Valid (days)','الصلاحية (أيام)')+'</label><input type="number" min="1" value="'+esc(S.cur.valid)+'" oninput="poSet(\'valid\',this.value)"></div>'+
        '</div>'+
        '<label>'+fl('Prepared by','إعداد')+'</label>'+
        '<input value="'+esc(S.cur.by)+'" placeholder="Business Development – Direct" oninput="poSet(\'by\',this.value)">'+
        '<div style="margin-top:8px;font-size:12px;color:var(--muted,#777)">'+
          fl('The offer number is assigned by the server when you issue — drafts have no number, and two people can never mint the same one.',
             'يُخصَّص رقم العرض من الخادم عند الإصدار — المسودات بلا رقم، ولا يمكن تكرار الرقم أبداً.')+'</div>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Services & prices','الخدمات والأسعار')+'</legend>'+
        '<label>'+fl('Quick add a standard service','إضافة خدمة قياسية')+'</label>'+
        '<select onchange="poQuickAdd(this)"><option value="">'+fl('— pick a Direct service, price it yourself —','— اختر خدمة وسعّرها بنفسك —')+'</option>'+
          STD.map(function(x,i){ return '<option value="'+i+'">'+esc(x[0]+' · '+x[1])+'</option>'; }).join('')+'</select>'+
        '<div style="margin-top:8px">'+(S.cur.lines||[]).map(lineHtml).join('')+'</div>'+
        '<button type="button" class="po-add" onclick="poLine(\'add\')">+ '+fl('Add blank service','إضافة خدمة فارغة')+'</button>'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" style="width:auto" '+(S.cur.showOrig?'checked':'')+' onchange="poSetChk(\'showOrig\',this.checked)"> '+fl('Show "original price" column (discount offer)','عمود السعر قبل الخصم')+'</label>'+
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" style="width:auto" '+(S.cur.vatIncl?'checked':'')+' onchange="poSetChk(\'vatIncl\',this.checked)"> '+fl('Entered prices already include VAT','الأسعار شاملة الضريبة')+'</label>'+
      '</fieldset>'+
      '<fieldset><legend>'+fl('Terms & notes','الشروط والملاحظات')+'</legend>'+
        '<textarea oninput="poSet(\'notes\',this.value)" placeholder="'+esc(fl('Leave empty for the standard terms','اتركه فارغاً للشروط القياسية'))+'">'+esc(S.cur.notes)+'</textarea>'+
      '</fieldset>'+
      '<div id="poBar" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+barHtml()+'</div>'+
      '<div style="margin-top:10px;font-size:11.5px;color:var(--muted,#777);line-height:1.5">'+
        fl('Totals and VAT (15%) are always computed — never type totals by hand. Real tax invoices are issued from Direct Payment.',
           'الإجماليات والضريبة (15%) تُحسب دائماً — لا تكتب الإجمالي يدوياً. الفواتير الضريبية تصدر من دايركت للمدفوعات.')+'</div>'+
    '</div>';
  }
  function barHtml(){
    var w=canWrite();
    return (w?'<button class="btn sm pri" '+(S.saving?'disabled':'')+' onclick="poSaveDraft()">'+(S.saving?fl('Saving…','جارٍ الحفظ…'):fl('💾 Save draft','💾 حفظ المسودة'))+'</button>':'')+
      (w&&!S.docNumber?'<button class="btn sm ghost" onclick="poIssue()">'+fl('Issue — assign number','إصدار — تخصيص رقم')+'</button>':'')+
      (w&&S.docNumber&&S.status!=='accepted'?'<button class="btn sm ghost" onclick="poMarkAccepted()">'+fl('Mark accepted','وضع علامة مقبول')+'</button>':'')+
      '<button class="btn sm ghost" onclick="poPrint()">'+fl('Print / PDF','طباعة / PDF')+'</button>'+
      '<button class="btn sm ghost" onclick="poCopy()">⧉ '+fl('Copy for WhatsApp / Email','نسخ لواتساب / البريد')+'</button>';
  }

  /* ---------- render: tab body + targeted repaints ---------- */
  function tabHtml(){
    loadIdentity(); loadList();
    return css()+
      '<div id="poWrap">'+
        '<div>'+formHtml()+'</div>'+
        '<div id="poPreviewCol" data-identity="classic"><div id="poPages">'+pagesHtml()+'</div></div>'+
      '</div>';
  }
  function repaint(){ try{ if(typeof current!=='undefined'&&current==='documents')render(); }catch(_){} }
  function repaintPreview(){
    var el=document.getElementById('poPages');
    if(el)el.innerHTML=pagesHtml(); else repaint();
  }
  function repaintBar(){
    var el=document.getElementById('poBar');
    if(el)el.innerHTML=barHtml();
  }

  /* ---------- register through the js/66 seam ---------- */
  if(typeof window.dgRegisterTab==='function'){
    window.dgRegisterTab('offer', tabHtml);
  }else{
    console.warn('[po] dgRegisterTab missing — js/66 not loaded first?');
  }

  console.info('[po] price offer tab loaded (generated_documents / OFR)');
}catch(e){ if(window.console)console.warn('[po] init',e); }})();
