/* js/122-payments-lists.js — the Direct Payments client list and promo codes exports, read in the browser (second
   builder, 28 Sep 2026; D26).

   Two small Payments exports, read through js/121's reader (one peek per file, Excel in its background worker) and written
   through two database functions (scripts/sql/clients-promo-import.sql), by a person, on Finance → Import:
     · Corporate clients export (ID, Legal Name, …, Contact Email, Credit Term Days, …) → public.payments_clients, the
       mirror of Payments' client register (fn_payments_clients_import). Its job in the money: the CONTACT EMAIL gives an
       invoice row its Payments client ID (the invoice export has none), which is what the client-ID merges and exclusions
       on Finance → Rules match (D16). An email counts only when exactly one client carries it and it is not a Direct
       staff address; only an EMPTY client ID is filled, never a hand-entered row (D21). The preview says how many
       invoices get a client ID, and how many of those your client-ID rules then leave out.
     · Promo codes export (Code, Client Name, Promocode Type, Type, Discount, Product, Status, Valid From/To, Total Sales,
       Total Discount) → public.promo_codes (fn_promo_codes_import). Client Name is kept as a SUGGESTION: a person links a
       code to a company on the company card (D10); nothing here links it.
   The owner's rules (Drive 04 §5): any file, any order, any time; a newer file (its Payments export time) wins, an older
   one only fills blanks, a blank never wipes; the same file twice changes nothing. Guards: scripts/qa/
   probe-payments-lists.mjs (the browser, with sabotage) and phase3 CP-01…07 (the database). */
(function(){try{
  if(typeof window.v121Register!=='function'||!window.v121||!window.v121.readAll){ if(window.console) console.warn('[v122] needs js/121'); return; }
  var V=window.v121, hk=V.hk;
  var fl=function(en,ar){ return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en; };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var I=function(n){ return Number(n||0).toLocaleString('en-US'); };
  var client=function(){ try{ return window.fc?fc():null; }catch(_){ return null; } };
  var canWrite=function(){ try{ if(window.__isShareView) return false;
    if(typeof window.mayEditPage==='function') return window.mayEditPage('finance')===true;
    return typeof window.finCanWrite==='function'&&!!window.finCanWrite(); }catch(_){ return false; } };

  /* ---------------- the two kinds, by their own headers (normalized as js/121 does) ---------------- */
  var PC={ client_id:['id','clientid','corporateclientid'], legal_name:['legalname'], legal_name_ar:['legalnamearabic','legalnamear','arabiclegalname'],
    trading_name:['tradingname'], payment_mode:['paymentmode'], payment_config:['clientpaymentconfiguration','paymentconfiguration'],
    billing_cycle:['billingcycle'], vat_number:['vatnumber','vatno'], id_type:['idtype'], id_number:['idnumber'],
    registration_numbers:['registrationnumbers','registrationnumber'], contact_email:['contactemail'], contact_name:['contactname'],
    contact_phone:['contactphone'], customer_type:['customertype'], credit_limit_sar:['creditlimit','creditlimitsar'],
    credit_term_days:['credittermdays','creditterm'], tender_no:['tenderno','tendernumber'], tender_amount_sar:['tenderamount','tenderamountsar'],
    expected_cogs_sar:['expectedcogs','expectedcogssar'], expected_gp_sar:['expectedgp','expectedgpsar'] };
  var PR={ code:['code','promocode'], client_name:['clientname'], promo_type:['promocodetype','promotype'], discount_type:['type','discounttype'],
    discount:['discount','discountvalue'], product:['product','products'], status:['status'], valid_from:['validfrom'], valid_to:['validto'],
    total_sales_sar:['totalsales','totalsalessar'], total_discount_sar:['totaldiscount','totaldiscountsar'] };
  var MONEY={credit_limit_sar:1,tender_amount_sar:1,expected_cogs_sar:1,expected_gp_sar:1,total_sales_sar:1,total_discount_sar:1,discount:1};
  var KINDS={ pc:{ map:PC, key:'client_id', en:'Client list (Corporate Clients export)', ar:'قائمة العملاء (تصدير عملاء الشركات)' },
              pr:{ map:PR, key:'code', en:'Promo codes export', ar:'تصدير أكواد الخصم' } };
  function colsOf(h, map){ var o={}; for(var f in map){ o[f]=-1; for(var i=0;i<map[f].length;i++){ var j=h.indexOf(map[f][i]); if(j>=0){ o[f]=j; break; } } } return o; }
  function kindOf(h){ var INV=['invoice#','invoice#ref#','invoicereference#','invoiceno'];
    if(INV.some(function(x){ return h.indexOf(x)>=0; })) return null;   // an invoice-level export is never one of these lists
    var c=colsOf(h,PC); if(c.client_id>=0&&c.legal_name>=0&&c.contact_email>=0) return 'pc';
    c=colsOf(h,PR); if(c.code>=0&&c.total_sales_sar>=0&&c.total_discount_sar>=0) return 'pr';
    return null; }

  /* ---------------- values ---------------- */
  function text(v){ if(v==null) return null; if(typeof v==='number') return isFinite(v)?String(v):null;
    var s=String(v).trim(); return s===''?null:s; }
  function idText(v){ if(typeof v==='number') return isFinite(v)?String(Math.round(v)):null; var s=V.ref(v); return s===''?null:s; }
  function isStaff(e){ return /@([a-z0-9-]+\.)*directksa\./i.test(String(e||'')); }
  function norm(s){ return String(s==null?'':s).toLowerCase().replace(/\s+/g,''); }
  function promoKind(type, disc){ var t=String(type||'').toLowerCase();
    if(/percent|%|نسب|مئوي/.test(t)) return 'percent'; if(/fixed|amount|flat|value|مبلغ|ثابت|قيمة/.test(t)) return 'fixed';
    if(!t&&/%\s*$/.test(String(disc||''))) return 'percent'; return null; }
  function promoState(s){ var t=String(s||'').trim().toLowerCase().replace(/\s+/g,' '); if(!t) return {};
    if(/^(active|enabled|valid|نشط|فعال|مفعل)$/.test(t)) return {active:true, expired:false};
    if(/^(expired|منتهي|منتهية)$/.test(t)) return {active:false, expired:true};
    if(/^(inactive|disabled|deactivated|paused|stopped|غير نشط|غير فعال|معطل|موقوف)$/.test(t)) return {active:false};
    return {unknown:true}; }

  function rowOf(S, r, n){
    var o={}, c=S.col, map=KINDS[S.kind].map;
    for(var f in map){ var v=c[f]>=0?r[c[f]]:null;
      if(f==='client_id') o[f]=idText(v);
      else if(f==='valid_from'||f==='valid_to'){ var w=V.when(v); if(w===undefined){ bad(S,n,f.replace('_',' ')+' '+fl('unreadable — left blank','غير مقروء — تُرك فارغًا')); o[f]=null; } else o[f]=w?w.slice(0,10):null; }
      else if(MONEY[f]){ var m=V.money(typeof v==='string'?v.replace(/%\s*$/,''):v); if(m!==m){ bad(S,n,f.replace(/_/g,' ')+' "'+String(v).slice(0,20)+'" '+fl('unreadable — left blank','غير مقروء — تُرك فارغًا')); o[f]=null; } else o[f]=m; }
      else if(f==='credit_term_days'){ var d=V.money(v); o[f]=(d==null||d!==d)?null:Math.round(d); }
      else if(f==='vat_number'||f==='id_number'||f==='contact_phone'||f==='registration_numbers') o[f]=typeof v==='number'?idText(v):text(v);
      else if(f==='contact_email'){ var e=text(v); o[f]=e?e.toLowerCase():null; }
      else o[f]=text(v); }
    if(S.kind==='pr'){ o.kind=promoKind(o.discount_type, c.discount>=0?r[c.discount]:null); var st=promoState(o.status);
      if(st.unknown&&o.status) S.unknownStatus[o.status]=1; if('active' in st) o.active=st.active; if('expired' in st) o.expired=st.expired; }
    return o; }
  function bad(S, n, why){ S.nBad++; if(S.bad.length<5) S.bad.push(fl('row ','الصف ')+I(n)+': '+why); }
  function take(S, rows){ rows.forEach(function(r){
    if(!S.header){ S.header=r; S.col=colsOf((r||[]).map(hk),KINDS[S.kind].map); return; }
    S.n++; if(!r||!r.some(function(x){ return x!==''&&x!=null; })) { S.n--; return; }
    var o=rowOf(S,r,S.n+1), k=o[KINDS[S.kind].key]; if(!k){ S.blank++; return; }
    var kk=S.kind==='pr'?k.toLowerCase():k; if(S.rows[kk]) S.dup++; S.rows[kk]=o; }); }

  /* ---------------- what the database holds now ---------------- */
  function pageAll(q, cb){ var all=[], from=0, P=1000; (function page(){ q().range(from,from+P-1).then(function(r){
    if(r.error){ cb(r.error); return; } all=all.concat(r.data||[]); if((r.data||[]).length===P){ from+=P; page(); } else cb(null,all); }); })(); }
  var PCF=Object.keys(PC).filter(function(f){ return f!=='client_id'; });
  var PRF=['promo_type','discount_type','discount','product','status','client_name','valid_from','valid_to','total_sales_sar','total_discount_sar','kind','value_pct','active','expired'];
  var PRCOL={promo_type:'payments_promo_type',discount_type:'payments_discount_type',discount:'payments_discount',product:'payments_product',status:'payments_status',client_name:'payments_client_name'};
  function same(a,b){ if(a==null||b==null) return a==null&&b==null; if(typeof a==='number'||typeof b==='number') return Math.abs(Number(a)-Number(b))<1e-9; return String(a)===String(b); }
  function pick(o,n,newer){ return n==null?o:(newer?n:(o==null?n:o)); }

  function simulatePc(S, stored, inv, rules){
    var by={}; stored.forEach(function(t){ by[t.client_id]=t; });
    var s={nw:0, ch:0, sm:0}, after={}; stored.forEach(function(t){ after[t.client_id]=t; });
    Object.keys(S.rows).forEach(function(k){ var x=S.rows[k], t=by[k];
      if(!t){ s.nw++; after[k]=x; return; }
      var newer=!t.seen_at||Date.parse(S.asOf)>=Date.parse(t.seen_at), m={client_id:k}, diff=Date.parse(S.asOf)>Date.parse(t.seen_at||0);
      PCF.forEach(function(f){ m[f]=pick(t[f],x[f],newer); if(!same(m[f],t[f])) diff=true; });
      if(diff) s.ch++; else s.sm++; after[k]=m; });
    var em={}; Object.keys(after).forEach(function(k){ var e=after[k].contact_email; if(!e) return; e=String(e).trim().toLowerCase(); (em[e]=em[e]||[]).push(k); });
    s.shared=Object.keys(em).filter(function(e){ return em[e].length>1; }).length;
    s.staff=Object.keys(after).filter(function(k){ return isStaff(after[k].contact_email); }).length;
    var ruled={}; (rules||[]).forEach(function(r){ if(r.kind==='client_id'&&r.active&&!r.removed_at) ruled[norm(r.value)]=r; });
    s.link=0; s.linkSar=0; s.out=0; s.outSar=0; s.byClient={};
    inv.forEach(function(i){ if(i.payments_client_id||(i.source||'import')!=='import'||!i.customer_email) return;
      var e=String(i.customer_email).trim().toLowerCase(); if(isStaff(e)) return; var l=em[e]; if(!l||l.length!==1) return;
      var c=l[0], rev=+i.revenue_sar||0; s.link++; s.linkSar+=rev; var b=s.byClient[c]=s.byClient[c]||{n:0,sar:0,name:after[c].legal_name||after[c].trading_name||'',out:false}; b.n++; b.sar+=rev;
      if(ruled[norm(c)]){ s.out++; s.outSar+=rev; b.out=true; } });
    return s; }
  function simulatePr(S, stored){
    var by={}; stored.forEach(function(t){ var k=String(t.code||'').trim().toLowerCase(); (by[k]=by[k]||[]).push(t); });
    var s={nw:0, ch:0, sm:0, noType:0, noTypeList:[], suggest:0};
    Object.keys(S.rows).forEach(function(k){ var x=S.rows[k], ts=by[k];
      if(x.client_name) s.suggest++;
      if(!ts){ if(!x.kind){ s.noType++; if(s.noTypeList.length<5) s.noTypeList.push(x.code); } else s.nw++; return; }
      var any=false; ts.forEach(function(t){ var newer=!t.payments_seen_at||Date.parse(S.asOf)>=Date.parse(t.payments_seen_at), diff=Date.parse(S.asOf)>Date.parse(t.payments_seen_at||0);
        PRF.forEach(function(f){ var col=PRCOL[f]||f, nv=f==='value_pct'?(x.kind?x.discount:null):x[f]; if(!same(pick(t[col],nv,newer),t[col])) diff=true; });
        if(diff) any=true; });
      if(any) s.ch++; else s.sm++; });
    return s; }

  /* ---------------- state ---------------- */
  var STATE=null, GEN=0;
  function start(items){
    var gen=++GEN; STATE={gen:gen, phase:'reading', files:items.map(function(it){ return {name:it.file.name, kind:it.kind, asOf:V.asOf(it.file), header:null, col:null, rows:{},
      n:0, blank:0, dup:0, nBad:0, bad:[], unknownStatus:{}}; }), msg:null}; paint();
    var i=0; (function next(){ if(gen!==GEN) return; if(i>=items.length){ preview(gen); return; }
      var S=STATE.files[i], it=items[i]; i++;
      V.readAll(it,function(rows){ if(gen!==GEN) return; take(S,rows); },function(){ next(); },function(e){ S.err=String((e&&e.message)||e); next(); }); })();
  }
  function preview(gen){
    var S=STATE, c=client(); if(!c){ S.phase='error'; S.msg=fl('Not connected — try again.','غير متصل — حاول مجددًا.'); paint(); return; }
    var need=0, fail=null, D={};
    function done(){ if(--need>0) return; if(gen!==GEN) return;
      if(fail){ S.phase='error'; S.msg=fl('Could not read what Finance holds: ','تعذّرت قراءة ما في المالية: ')+String(fail.message||fail); paint(); return; }
      S.files.forEach(function(F){ if(F.err||!F.header) return; F.sim=F.kind==='pc'?simulatePc(F,D.pc||[],D.inv||[],D.rules||[]):simulatePr(F,D.pr||[]); });
      S.phase='preview'; paint(); }
    var kinds={}; S.files.forEach(function(F){ if(!F.err&&F.header) kinds[F.kind]=1; });
    if(kinds.pc){ need+=3;
      pageAll(function(){ return c.from('payments_clients').select('client_id,'+PCF.join(',')+',seen_at').order('client_id',{ascending:true}); },function(e,r){ if(e) fail=e; D.pc=r; done(); });
      pageAll(function(){ return c.from('finance_invoices').select('id,invoice_no,customer_email,payments_client_id,source,revenue_sar').is('deleted_at',null).order('id',{ascending:true}); },function(e,r){ if(e) fail=e; D.inv=r; done(); });
      c.from('money_exclusion_rules').select('kind,value,active,removed_at').then(function(r){ D.rules=r.error?[]:(r.data||[]); done(); }); }
    if(kinds.pr){ need++;
      pageAll(function(){ return c.from('promo_codes').select('id,code,kind,value_pct,valid_from,valid_to,total_sales_sar,total_discount_sar,active,expired,payments_promo_type,payments_discount_type,payments_discount,payments_product,payments_status,payments_client_name,payments_seen_at').order('code',{ascending:true}); },function(e,r){ if(e) fail=e; D.pr=r; done(); }); }
    if(!need){ S.phase='preview'; paint(); }
  }
  function nothingNew(F){ var s=F.sim; return !s||!(s.nw||s.ch||(F.kind==='pc'&&s.link)); }

  window.v122Import=function(){
    var S=STATE; if(!S||S.phase!=='preview') return;
    if(!canWrite()){ S.msg=fl('View only — importing needs Full control of Finance.','عرض فقط — الاستيراد يحتاج صلاحية كاملة على المالية.'); paint(); return; }
    var c=client(); if(!c){ S.msg=fl('Not connected — try again.','غير متصل — حاول مجددًا.'); paint(); return; }
    var jobs=[]; S.files.forEach(function(F){ if(F.err||!F.header||nothingNew(F)) return; var rows=Object.keys(F.rows).map(function(k){ return F.rows[k]; });
      for(var i=0;i<rows.length;i+=1000) jobs.push({F:F, rows:rows.slice(i,i+1000)}); });
    if(!jobs.length){ S.msg=fl('Nothing new to write — these files are already in.','لا جديد لكتابته — هذه الملفات مستوردة من قبل.'); paint(); return; }
    S.phase='writing'; S.res={}; paint();
    var gen=S.gen, k=0;
    (function next(){ if(gen!==GEN) return; if(k>=jobs.length){ S.phase='done'; paint(); try{ if(window.FIN){ FIN.rows=null; if(typeof finLoad==='function') finLoad(); } }catch(_){} return; }
      var j=jobs[k++], fn=j.F.kind==='pc'?'fn_payments_clients_import':'fn_promo_codes_import';
      c.rpc(fn,{p_rows:j.rows,p_seen_at:j.F.asOf,p_batch:'payments-'+j.F.kind+'-'+j.F.asOf.slice(0,19)}).then(function(r){ if(gen!==GEN) return;
        if(r.error){ S.phase='error'; S.msg=fl('Stopped: ','توقف: ')+String(r.error.message||r.error)+' — '+fl('what was written stays; dropping the same files again finishes the rest.','ما كُتب يبقى؛ إفلات الملفات نفسها مرة أخرى يُكمل الباقي.'); paint(); return; }
        var d=r.data||{}; Object.keys(d).forEach(function(x){ S.res[x]=(S.res[x]||0)+(+d[x]||0); }); next(); }); })();
  };
  window.v122Clear=function(){ GEN++; STATE=null; paint(); };

  /* ---------------- the block ---------------- */
  function fileBlock(F){
    var K=KINDS[F.kind], h='<div class="v122-file" data-v122-kind="'+F.kind+'" style="border-top:1px solid var(--line,#E4E7EC);padding:10px 0">';
    h+='<b>'+esc(F.name)+'</b> — '+fl(K.en,K.ar)+' <span style="color:var(--muted)">('+fl('exported ','صُدّر ')+esc(F.asOf.slice(0,16).replace('T',' '))+')</span><br>';
    if(F.err) return h+'<span style="color:#D92D20">'+fl('Could not be read: ','تعذّرت القراءة: ')+esc(F.err)+'</span></div>';
    var n=Object.keys(F.rows).length, s=F.sim;
    h+='<span data-v122-rows="'+n+'">'+I(n)+' '+(F.kind==='pc'?fl('clients read','عميلًا مقروءًا'):fl('codes read','كودًا مقروءًا'))+'</span>';
    if(s&&F.kind==='pc'){
      h+='<ul style="margin:6px 0 0;padding-inline-start:18px">';
      h+='<li data-v122-clients="'+[s.nw,s.ch,s.sm].join(',')+'">'+fl('Clients: ','العملاء: ')+'<b>'+I(s.nw)+'</b> '+fl('new','جديد')+', <b>'+I(s.ch)+'</b> '+fl('changed','متغيّر')+', '+I(s.sm)+' '+fl('unchanged','بلا تغيير')+'</li>';
      h+='<li data-v122-link="'+[s.link,Math.round(s.linkSar)].join(',')+'">'+fl('Invoices that get their Payments client ID from the customer email: ','فواتير تأخذ رقم عميلها في المدفوعات من بريد العميل: ')+'<b>'+I(s.link)+'</b> (SAR '+I(Math.round(s.linkSar))+')'+
        ' — '+fl('only where it is empty; a hand-entered row is never touched.','حيث كان فارغًا فقط؛ الصف المُدخل يدويًا لا يُمس.')+'</li>';
      h+='<li data-v122-out="'+[s.out,Math.round(s.outSar)].join(',')+'">'+(s.out?'<b style="color:#B54708">'+I(s.out)+' '+fl('of them','منها')+' (SAR '+I(Math.round(s.outSar))+')</b> '+fl('are then left out by your client-ID rules on Finance → Rules (test clients, Takamol …).','ستُستبعد عندها بقواعد رقم العميل في المالية ← القواعد (عملاء تجريبيون، تكامل …).')
        :fl('None of them falls under a client-ID rule on Finance → Rules.','لا يقع أي منها تحت قاعدة رقم عميل في المالية ← القواعد.'))+'</li>';
      if(s.shared||s.staff) h+='<li data-v122-skipped="'+[s.shared,s.staff].join(',')+'">'+fl('Never used to link: ','لا يُستعمل للربط: ')+(s.shared?I(s.shared)+' '+fl('email(s) that several clients share','بريد يتشاركه أكثر من عميل')+(s.staff?' · ':''):'')+(s.staff?I(s.staff)+' '+fl('Direct staff address(es)','عنوان موظف في دايركت'):'')+' — '+fl('a person links those invoices.','يربط شخصٌ تلك الفواتير.')+'</li>';
      h+='<li style="color:var(--muted)">'+fl('Linking a Payments client to a company in the app stays on the company card (a person decides).','ربط عميل المدفوعات بشركة في التطبيق يبقى في بطاقة الشركة (يقرّره شخص).')+'</li></ul>';
      var cl=Object.keys(s.byClient).sort(function(a,b){ return s.byClient[b].sar-s.byClient[a].sar; }).slice(0,20);
      if(cl.length) h+='<table class="tbl" style="margin-top:6px;font-size:12px"><thead><tr><th>'+fl('Client ID','رقم العميل')+'</th><th>'+fl('Name in Payments','الاسم في المدفوعات')+'</th><th>'+fl('Invoices','الفواتير')+'</th><th>SAR</th><th></th></tr></thead><tbody>'+
        cl.map(function(k){ var b=s.byClient[k]; return '<tr data-v122-client="'+esc(k)+'"><td>'+esc(k)+'</td><td>'+esc(b.name)+'</td><td>'+I(b.n)+'</td><td>'+I(Math.round(b.sar))+'</td><td>'+(b.out?'<span style="color:#B54708">'+fl('left out by a rule','مستبعد بقاعدة')+'</span>':'')+'</td></tr>'; }).join('')+'</tbody></table>';
    } else if(s){
      h+='<ul style="margin:6px 0 0;padding-inline-start:18px">';
      h+='<li data-v122-codes="'+[s.nw,s.ch,s.sm,s.noType].join(',')+'">'+fl('Codes: ','الأكواد: ')+'<b>'+I(s.nw)+'</b> '+fl('new','جديد')+', <b>'+I(s.ch)+'</b> '+fl('changed','متغيّر')+', '+I(s.sm)+' '+fl('unchanged','بلا تغيير')+
        (s.noType?', <b style="color:#B54708">'+I(s.noType)+' '+fl('new code(s) left out — their Type is not percentage or fixed','كود جديد تُرك — نوعه ليس نسبة ولا مبلغًا ثابتًا')+'</b> ('+esc(s.noTypeList.join(', '))+')':'')+'</li>';
      h+='<li>'+fl('Payments owns each code\'s dates, totals, type, discount and status: a newer file wins, a blank never wipes.','المدفوعات تملك تواريخ كل كود وإجمالياته ونوعه وخصمه وحالته: الملف الأحدث يغلب، والخانة الفارغة لا تمسح.')+'</li>';
      if(s.suggest) h+='<li data-v122-suggest="'+s.suggest+'">'+I(s.suggest)+' '+fl('codes carry a Client Name from Payments — kept as a suggestion; a person links each code to its company on the company card.','كودًا يحمل اسم عميل من المدفوعات — يُحفظ اقتراحًا؛ ويربط شخصٌ كل كود بشركته في بطاقة الشركة.')+'</li>';
      var us=Object.keys(F.unknownStatus); if(us.length) h+='<li style="color:#B54708">'+fl('Status not recognised (the code keeps its active flag): ','حالة غير معروفة (يبقى الكود على حالته): ')+esc(us.slice(0,5).join(', '))+'</li>';
      h+='</ul>';
    }
    if(F.nBad) h+='<div style="color:#B54708;font-size:12px;margin-top:4px" data-v122-bad="'+F.nBad+'">'+I(F.nBad)+' '+fl('cells could not be read and were left blank: ','خانة تعذّرت قراءتها فتُركت فارغة: ')+esc(F.bad.join(' · '))+'</div>';
    if(F.blank) h+='<div style="color:var(--muted);font-size:12px">'+I(F.blank)+' '+fl('rows with no key skipped','صفًا بلا مفتاح تُرك')+'</div>';
    if(F.dup) h+='<div style="color:var(--muted);font-size:12px">'+I(F.dup)+' '+fl('repeated rows — the last one is kept','صفًا مكررًا — يُحفظ الأخير')+'</div>';
    return h+'</div>';
  }
  function html(){
    var S=STATE; if(!S) return '';
    var h='<div class="card" data-v122-phase="'+S.phase+'" style="padding:12px 14px;margin-bottom:12px;border-inline-start:4px solid #175CD3">';
    h+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>'+fl('Payments lists — clients and promo codes','قوائم المدفوعات — العملاء وأكواد الخصم')+'</b>'+
       (S.phase==='writing'||S.phase==='reading'?'':'<button class="btn sm" onclick="v122Clear()">'+fl('Close','إغلاق')+'</button>')+'</div>';
    if(S.phase==='reading') h+='<div style="font-size:13px">'+fl('Reading…','جارٍ القراءة…')+'</div>';
    S.files.forEach(function(F){ h+=fileBlock(F); });
    if(S.phase==='preview'){
      var any=S.files.some(function(F){ return !F.err&&F.header&&!nothingNew(F); });
      if(!any) h+='<div style="font-size:13px;color:#0F6E56;margin-top:6px" data-v122-nothing="1"><b>'+fl('Nothing new','لا جديد')+'</b> — '+fl('these files are already in.','هذه الملفات مستوردة من قبل.')+'</div>';
      else if(!canWrite()) h+='<div style="font-size:13px;color:#B54708;margin-top:6px">'+fl('View only — importing needs Full control of Finance.','عرض فقط — الاستيراد يحتاج صلاحية كاملة على المالية.')+'</div>';
      else h+='<button class="btn pri sm" style="margin-top:8px" data-v122-go="1" onclick="v122Import()">'+fl('Import the lists','استيراد القوائم')+'</button>';
    }
    if(S.phase==='writing') h+='<div style="font-size:13px;margin-top:6px">'+fl('Writing…','جارٍ الكتابة…')+'</div>';
    if(S.phase==='done'){ var r=S.res||{};
      h+='<div style="font-size:13px;color:#0F6E56;margin-top:6px" data-v122-done="'+[r.clients_new||0,r.clients_changed||0,r.invoices_linked||0,r.codes_new||0,r.codes_changed||0].join(',')+'"><b>'+fl('Done.','تم.')+'</b> '+
        (('clients_in_file' in r)?I(r.clients_new||0)+' '+fl('new clients','عميل جديد')+', '+I(r.clients_changed||0)+' '+fl('changed','متغيّر')+', '+I(r.invoices_linked||0)+' '+fl('invoices got their client ID','فاتورة أخذت رقم عميلها')+'. ':'')+
        (('codes_in_file' in r)?I(r.codes_new||0)+' '+fl('new codes','كود جديد')+', '+I(r.codes_changed||0)+' '+fl('changed','متغيّر')+'. ':'')+fl('Every change is in the change log.','كل تغيير مسجّل في سجل التغييرات.')+'</div>'; }
    if(S.phase==='error') h+='<div style="font-size:13px;color:#D92D20;margin-top:6px" data-v122-error="1">'+esc(S.msg||'')+'</div>';
    else if(S.msg) h+='<div style="font-size:13px;margin-top:6px">'+esc(S.msg)+'</div>';
    return h+'</div>';
  }
  function paint(){ var out=document.getElementById('finImpOut'); if(!out) return;
    var box=document.getElementById('v122Out');
    if(!box){ box=document.createElement('div'); box.id='v122Out'; out.parentNode.insertBefore(box,out); }
    var h=html(); if(box.__v122!==h){ box.__v122=h; box.innerHTML=h; } }   // an unchanged block is left alone, so a click on it is never lost to a repaint
  function wire(){ try{ if(typeof current!=='undefined'&&current==='finance'&&window.FIN&&FIN.tab==='import') paint(); }catch(_){} }
  var _r=window.render; window.render=function(){ var o=_r.apply(this,arguments); wire(); return o; };
  if(typeof window.finGo==='function'){ var _g=window.finGo; window.finGo=function(){ var o=_g.apply(this,arguments); wire(); return o; }; }

  window.v121Register({ match:function(h){ return !!kindOf(h); },
    start:function(items){ start(items.map(function(it){ return {file:it.file, kind:kindOf((it.header||[]).map(hk)), ctx:it.ctx}; })
                                  .filter(function(it){ return it.kind; })); } });

  window.v122={ kindOf:kindOf, promoKind:promoKind, promoState:promoState, state:function(){ return STATE; } };
  console.info('%c[v122] Payments lists — the client list and the promo codes','color:#175CD3;font-weight:700');
}catch(e){ if(window.console) console.warn('[v122] init',e); }})();
