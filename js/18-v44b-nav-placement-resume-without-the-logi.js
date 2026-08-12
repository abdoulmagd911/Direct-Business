/* ===== v44b: nav placement, resume-without-the-login-form, sign-in watchdog ===== */
(function(){try{

  /* --- 1. Finance nav entry -------------------------------------------------
     The v42 ledger renders when current==='finance' but nothing ever set that
     except typing /finance in the address bar. Placed next to Invoices, which is
     where it belongs; re-injected after every render so the nav layers cannot
     drop it.                                                                   */
  var IC_FIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  function isArNow(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function finLabel(){ return isArNow()?'المالية':'Finance'; }

  function placeFinanceBtn(nav,b){
    /* Finance belongs in the main group with Reports, not in the read-only
       Bookings/Invoices/Tickets section. Preference order: just before Settings,
       else straight after Reports, else after Invoices, else at the end. */
    var btns=nav.querySelectorAll('button'), settings=null, reports=null, invoices=null;
    for(var i=0;i<btns.length;i++){
      if(btns[i].id==='v44FinBtn') continue;
      var t=(btns[i].textContent||'').trim().toLowerCase();
      if(!settings && (t.indexOf('setting')>=0 || t.indexOf('الإعدادات')>=0)) settings=btns[i];
      if(!reports  && (t.indexOf('report')>=0  || t.indexOf('تقارير')>=0))    reports=btns[i];
      if(!invoices && (t.indexOf('invoice')>=0 || t.indexOf('فواتير')>=0))    invoices=btns[i];
    }
    if(settings && settings.parentNode){ settings.parentNode.insertBefore(b, settings); return; }
    if(reports  && reports.parentNode){  reports.parentNode.insertBefore(b, reports.nextSibling); return; }
    if(invoices && invoices.parentNode){ invoices.parentNode.insertBefore(b, invoices.nextSibling); return; }
    nav.appendChild(b);
  }

  function injectFinanceNav(){
    var nav=document.getElementById('nav'); if(!nav) return;
    var isOn=false; try{ isOn=(current==='finance'); }catch(_){}
    var existing=document.getElementById('v44FinBtn');
    if(existing){
      existing.className=isOn?'active':'';
      var lbl=existing.querySelector('span'); if(lbl&&lbl.textContent!==finLabel()) lbl.textContent=finLabel();
      return;
    }
    if(!nav.querySelector('button')) return;
    var b=document.createElement('button');
    b.id='v44FinBtn';
    b.innerHTML=IC_FIN+'<span>'+finLabel()+'</span>';
    b.className=isOn?'active':'';
    b.onclick=function(){
      try{ current='finance'; }catch(_){}
      try{ render(); }catch(_){}
      try{ window.scrollTo(0,0); }catch(_){}
      try{ closeSide(); }catch(_){}
    };
    placeFinanceBtn(nav,b);
  }

  /* --- 2. Reloading a page should not look like being signed out -------------
     start() shows the sign-in card, then loads every lead plus the workspace before
     hiding it. With a valid session already stored that reads as "logged out again"
     for several seconds on every refresh. When a session exists we swap the form for
     a short resuming message, and put the form back if it turns out sign-in is
     really needed.                                                              */
  function haveStoredSession(){
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(/^sb-.*-auth-token$/.test(k)){
          var v=localStorage.getItem(k);
          if(v && v.length>20 && v.indexOf('access_token')>=0) return true;
        }
      }
    }catch(_){}
    return false;
  }

  function cardBits(){
    var em=document.getElementById('cl_email'), pw=document.getElementById('cl_pw');
    var fg=document.getElementById('cl_forgot'), go=document.getElementById('cl_go');
    if(!em||!pw||!go) return null;
    var els=[em,pw,go];
    if(em.previousElementSibling) els.push(em.previousElementSibling);
    if(pw.previousElementSibling) els.push(pw.previousElementSibling);
    if(fg&&fg.parentElement) els.push(fg.parentElement);
    var card=go.parentElement;
    if(card){
      var kids=card.children;
      for(var i=0;i<kids.length;i++){
        var t=(kids[i].textContent||'');
        if(t.indexOf('Sign in to your team workspace')>=0 || t.indexOf('Accounts are created by your admin')>=0) els.push(kids[i]);
      }
    }
    return {els:els, go:go, card:card};
  }

  var resuming=false;
  function setResuming(on){
    var c=cardBits(); if(!c) return false;
    for(var i=0;i<c.els.length;i++){ if(c.els[i]) c.els[i].style.display = on ? 'none' : ''; }
    var m=document.getElementById('v44Resume');
    if(on){
      if(!m){
        m=document.createElement('div');
        m.id='v44Resume';
        m.style.cssText='text-align:center;font-size:13px;color:#55596A;margin:22px 0 10px;line-height:1.7';
        c.card.insertBefore(m,c.go);
      }
      m.innerHTML=isArNow()
        ? 'أهلاً بعودتك — جارٍ تحميل مساحة العمل…'
        : 'Welcome back — loading your workspace…';
      m.style.display='';
    } else if(m){ m.style.display='none'; }
    resuming=on;
    return true;
  }

  if(haveStoredSession()){
    var rt=0;
    var ri=setInterval(function(){ rt++; if(setResuming(true)||rt>60) clearInterval(ri); },100);
  }

  /* put the form back if sign-in is genuinely required */
  setInterval(function(){
    if(!resuming) return;
    var e=document.getElementById('cl_err');
    if(e && e.style.display!=='none' && (e.textContent||'').trim()) setResuming(false);
  },500);

  try{
    var _r=window.render;
    if(typeof _r==='function'){
      window.render=function(){ var o=_r.apply(this,arguments); try{injectFinanceNav();}catch(e){console.warn('v44 nav',e);} return o; };
    }
  }catch(e){console.warn('v44 render hook',e);}
  var tries=0;
  var nt=setInterval(function(){ tries++; try{injectFinanceNav();}catch(_){} if(tries>60) clearInterval(nt); },250);

  /* --- 3. The sign-in card could hang on "Working..." forever ---------------- */
  var busySince=null;
  setInterval(function(){
    var x=document.getElementById('cl_busy');
    var showing=!!(x&&x.style.display!=='none'&&document.body.contains(x));
    if(!showing){ busySince=null; return; }
    if(busySince===null){ busySince=Date.now(); return; }
    if(Date.now()-busySince<30000) return;
    busySince=null;
    x.style.display='none';
    setResuming(false);
    var e=document.getElementById('cl_err');
    if(e){
      e.style.display='block';
      e.innerHTML='This is taking longer than usual - the connection may have dropped. <a href="#" id="v44Retry" style="text-decoration:underline">Reload and try again</a>.';
      var r=document.getElementById('v44Retry');
      if(r) r.onclick=function(ev){ ev.preventDefault(); location.reload(); };
    }
  },2000);

  console.info('%c[v44] nav + resume + watchdog loaded','color:#FF6B00;font-weight:700');
}catch(e){console.warn('v44 layer failed',e);}})();
