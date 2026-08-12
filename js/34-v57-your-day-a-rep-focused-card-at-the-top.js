/* v57 — "Your day": a rep-focused card at the top of Today that tells the signed-in user
      exactly what to act on — their follow-ups due, leads going cold, proposals expiring,
      and client reviews due. Built on ownership (owner === meName()). Self-contained. */
(function(){try{
  function ar(){return (typeof LANG!=='undefined'&&LANG==='ar');}
  function today(){return new Date().toISOString().slice(0,10);}
  function meN(){return (window.meName?meName():'');}
  function ownLead(b){return (b.assignedTo||b.owner||'');}
  function ownCli(b){return (b.accountManager||b.assignedTo||b.owner||'');}
  function lastTouch(b){var la=(b.activities||[]).slice().sort(function(x,y){return (y.date||0)-(x.date||0);})[0];return b.lastContact||(la&&la.date)||0;}
  function closedLead(b){var s=(typeof leadStage==='function')?leadStage(b):(b.stage||'');return s==='Won'||s==='Lost';}

  function buildYourDay(){
    var me=meN(); if(!me) return null;
    var B=(typeof DB!=='undefined'&&DB.businesses)?DB.businesses:[];
    var O=(typeof DB!=='undefined'&&DB.offers)?DB.offers:[];
    var td=today(), nowMs=Date.now();
    var mineLeads=B.filter(function(b){return !b.isClient && ownLead(b)===me;});
    var mineClients=B.filter(function(b){return b.isClient && ownCli(b)===me;});
    var mineOffers=O.filter(function(o){return (o.owner||'')===me;});

    // 1) Follow-ups due (a next-action date on/at-or-before today), active leads
    var due=mineLeads.filter(function(b){return !closedLead(b) && b.nextActionDate && String(b.nextActionDate).slice(0,10)<=td;})
      .sort(function(a,b){return String(a.nextActionDate).localeCompare(String(b.nextActionDate));});
    var dueIds={}; due.forEach(function(b){dueIds[b.id]=1;});
    // 2) Going cold: active leads not touched in 14+ days (or never), not already in "due"
    var cold=mineLeads.filter(function(b){ if(closedLead(b)||dueIds[b.id])return false; var lt=lastTouch(b); var days=lt?Math.floor((nowMs-lt)/864e5):999; return days>=14; })
      .sort(function(a,b){return lastTouch(a)-lastTouch(b);});
    // 3) Proposals expiring within 7 days (and not long-expired), not closed
    var exp=mineOffers.filter(function(o){ if(!o.validUntil)return false; if(/Accepted|Won|Lost|Rejected/i.test(o.status||''))return false; var d=Math.ceil((new Date(o.validUntil).getTime()-nowMs)/864e5); return d<=7 && d>=-14; })
      .sort(function(a,b){return new Date(a.validUntil)-new Date(b.validUntil);});
    // 4) Client reviews due
    var rev=mineClients.filter(function(b){return b.nextReview && String(b.nextReview).slice(0,10)<=td;})
      .sort(function(a,b){return String(a.nextReview).localeCompare(String(b.nextReview));});

    var n=due.length+cold.length+exp.length+rev.length;
    var esc=(typeof window.esc==='function')?window.esc:function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
    function openL(id){return "openLead='"+id+"';current='leads';leadDetailView='detail';render()";}
    function openO(id){return "openOffer='"+id+"';current='offers';render()";}
    function row(cls,ic,ti,meta,vv,click){return '<div class="v19-today-card '+cls+'" onclick="'+click+'"><div class="ic" style="background:rgba(255,255,255,.65)">'+ic+'</div><div class="body"><div class="ti">'+esc(ti)+'</div><div class="meta">'+esc(meta)+'</div></div>'+(vv?'<div class="v">'+esc(vv)+'</div>':'')+'</div>';}

    var who=esc(me);
    var head='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0;font-size:15px;font-weight:800;color:var(--ink)">☀️ '+(ar()?('يومك — '+who):('Your day — '+who))+'</h3>'+
      (n?'<span class="tag" style="background:#FF6B0014;color:#FF6B00;font-weight:800">'+n+'</span>':'<span class="tag" style="background:#E7F8EF;color:#0F6E56;font-weight:700">'+(ar()?'أنجزت كل شيء 🎉':'All caught up 🎉')+'</span>')+'</div>';

    var body='';
    if(due.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:6px 0 6px">'+(ar()?'متابعات مستحقة':'Follow-ups due')+'</h3>';
      due.slice(0,8).forEach(function(b){ var od=String(b.nextActionDate).slice(0,10)<td; body+=row(od?'red':'amber','📞',(window.nmMain?nmMain(b):b.name),(b.nextAction||(ar()?'متابعة':'Follow up'))+' · '+b.nextActionDate,(od?(ar()?'متأخرة':'Overdue'):(ar()?'اليوم':'Due')),openL(b.id)); }); }
    if(cold.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'تبرد — تحتاج تواصل':'Going cold')+'</h3>';
      cold.slice(0,6).forEach(function(b){ var lt=lastTouch(b); var days=lt?Math.floor((nowMs-lt)/864e5):null; body+=row('amber','❄️',(window.nmMain?nmMain(b):b.name),(typeof leadStage==='function'?leadStage(b):(b.stage||''))+' · '+(days===null?(ar()?'لا تواصل بعد':'never contacted'):(days+(ar()?' يوم':'d')+' '+(ar()?'بلا تواصل':'no contact'))),'',openL(b.id)); }); }
    if(exp.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'عروض تنتهي قريبًا':'Proposals expiring')+'</h3>';
      exp.slice(0,6).forEach(function(o){ var info=(typeof offerExpiry==='function'?offerExpiry(o):null); body+=row('amber','⏳',(o.ref||'—')+' · '+(o.subject||''),(o.client||'')+' · '+(o.value||o.total||'')+' '+(o.currency||'SAR'),(info?info.label:''),openO(o.id)); }); }
    if(rev.length){ body+='<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:12px 0 6px">'+(ar()?'مراجعات عملاء مستحقة':'Client reviews due')+'</h3>';
      rev.slice(0,6).forEach(function(b){ body+=row('blue','🗓️',(window.nmMain?nmMain(b):b.name),(ar()?'مراجعة الحساب':'Account review')+' · '+b.nextReview,'',openL(b.id)); }); }
    if(!n){ body+='<div class="v19-today-card empty">'+(ar()?'لا مهام متأخرة أو مستحقة اليوم لك.':'Nothing overdue or due today for you.')+'</div>'; }

    var wrap=document.createElement('div');
    wrap.className='card v57-yourday'; wrap.style.cssText='padding:16px 18px;margin-bottom:16px;border-inline-start:3px solid #FF6B00';
    wrap.innerHTML=head+body;
    return wrap;
  }

  function inject(){ try{
    if(typeof current==='undefined'||current!=='today') return;
    var v=document.getElementById('view'); if(!v) return;
    if(v.querySelector('.v57-yourday')) return;
    var card=buildYourDay(); if(!card) return;
    var _sh=v.querySelector('.v26_3-chips')||v.querySelector('.v26_3-section-head');if(_sh)v.insertBefore(card,_sh.nextSibling);else v.insertBefore(card, v.firstChild);
  }catch(_){} }

  if(window.render && !window.render.__v57){ var _r=window.render; window.render=function(){ var o=_r.apply(this,arguments); setTimeout(inject,60); return o; }; window.render.__v57=true; }
  setTimeout(inject,400);
  console.info('%c[v57] Your day (Today) loaded','color:#FF6B00;font-weight:700');
}catch(e){if(window.console)console.warn('[v57] init',e);}})();
