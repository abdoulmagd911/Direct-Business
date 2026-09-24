/* v68 — Top banner tidy (owner order 2026-08-13: "Sign out in the middle makes no sense").
   The top bar had grown into a row of loose buttons (Export, Share, Team, Access,
   Sign out) in whatever order layers appended them. Now:
     · Export and Share stay visible — they are daily work.
     · Team, Access and Sign out move into a profile chip at the END of the bar:
       your initial + name + role; click it → a small menu with who you are
       (name + email), Team & Access (admins see them), and Sign out at the bottom.
   The original buttons are hidden, not removed — their click handlers still do the
   work, so nothing about how Team/Access/sign-out behave has changed. Reversible.

   2026-09-24 (fire #251) — the menu takes the keyboard. Driven live: Enter on the chip opened
   the menu (it is a button), but nothing moved the focus into it, Tab left it behind, and the
   Escape key did nothing — the only pop-up in the app that ignored it. The full-screen rule in
   check-structure never sees it because it is a small box, not an overlay, and the Escape probe
   only counts boxes wider than 300 px. Now: opening moves the focus to the first item, ↑/↓ walk
   the items, Escape closes and puts the focus back on the chip, Tab closes and carries on from
   the chip, a click outside still closes it. The chip says it opens a menu (aria-haspopup) and
   whether it is open (aria-expanded), and every listener the menu adds is removed when it closes
   — the old close-on-outside-click listener was left behind whenever the chip itself closed it. */
(function(){try{
  function fl(en,ar){return (typeof LANG!=='undefined'&&LANG==='ar')?ar:en;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  var ROLE_EN={admin:'Admin',manager:'Manager',bd:'Business Development',operations:'Operations',team_member:'Team member',viewer:'Read only'};
  var ROLE_AR={admin:'مدير النظام',manager:'مدير',bd:'تطوير الأعمال',operations:'العمليات',team_member:'عضو الفريق',viewer:'قراءة فقط'};

  var hidden={};   // label → original button element (hidden but alive)
  function grabButtons(){
    var tools=document.querySelector('.tools'); if(!tools)return;
    [].slice.call(tools.querySelectorAll('button')).forEach(function(b){
      var t=(b.textContent||'').trim();
      if(/^Sign out$|^تسجيل الخروج$/.test(t)){hidden.signout=b;b.style.display='none';}
      else if(/^Team$|^الفريق$/.test(t)){hidden.team=b;b.style.display='none';}
      else if(/^Access$|^الصلاحيات$/.test(t)){hidden.access=b;b.style.display='none';}
    });
  }

  function myRole(){ try{
    var em=(window.__userEmail||'').toLowerCase();
    var u=(window.__TEAMU||[]).find(function(x){return String(x.email||'').toLowerCase()===em;});
    return (u&&u.role)||window.__userRole||null;
  }catch(_){return null;} }

  function ensureChip(){
    var tools=document.querySelector('.tools'); if(!tools)return;
    grabButtons();
    var nm=(window.__userName||(typeof meName==='function'&&meName())||'').trim();
    if(!nm)return;
    var arNm=(typeof ownerLabel==='function')?ownerLabel(nm):nm;
    /* fire #252: the chip shows the nickname whole when there is one (js/54's shortName), else the
       first word — it used to show the first word of the legal name for everyone, so a person the
       team calls "Abu Nasser" was "Assem" here and the nickname never matched (M94) */
    var shown=(typeof window.shortName==='function')?(window.shortName(nm)||nm):fl(nm.split(' ')[0],arNm.split(' ')[0]||arNm);
    var chip=document.getElementById('v68me');
    if(!chip){
      chip=document.createElement('button'); chip.id='v68me'; chip.type='button';
      chip.style.cssText='display:flex;align-items:center;gap:8px;border:1px solid var(--line,#E6E8EC);background:#fff;border-radius:999px;padding:4px 12px 4px 4px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;margin-inline-start:auto';
      chip.setAttribute('aria-haspopup','menu'); chip.setAttribute('aria-expanded','false');
      chip.onclick=function(e){e.stopPropagation();toggleMenu();};
      tools.appendChild(chip);
    }
    var role=myRole(); var roleLbl=role?((fl('x','y')==='y'?ROLE_AR:ROLE_EN)[role]||role):'';
    chip.innerHTML='<span style="width:26px;height:26px;border-radius:50%;background:#F06820;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">'+esc((shown.trim()[0]||arNm.trim()[0]||nm[0]||'?').toUpperCase())+'</span>'+
      '<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shown)+'</span>'+
      (roleLbl?'<span style="font-weight:500;color:var(--muted,#6B7480);font-size:11px">· '+esc(roleLbl)+'</span>':'')+
      '<span style="color:var(--muted,#6B7480);font-size:10px">▾</span>';
    if(chip!==tools.lastElementChild)tools.appendChild(chip);   // always at the end of the bar
  }

  /* one way out, whatever opened it: the box goes, its listeners go with it, the chip says "closed" */
  function closeMenu(){
    var m=document.getElementById('v68menu'); if(!m)return;
    try{ if(m.__key)document.removeEventListener('keydown',m.__key,true); }catch(_){}
    try{ if(m.__out)document.removeEventListener('click',m.__out); }catch(_){}
    m.remove();
    var chip=document.getElementById('v68me'); if(chip)chip.setAttribute('aria-expanded','false');
  }

  function toggleMenu(){
    if(document.getElementById('v68menu')){closeMenu();return;}
    var chip=document.getElementById('v68me'); if(!chip)return;
    var nm=(window.__userName||'').trim();
    var arNm=(typeof ownerLabel==='function')?ownerLabel(nm):nm;
    var m=document.createElement('div'); m.id='v68menu'; m.setAttribute('role','menu');
    var r=chip.getBoundingClientRect();
    var isAr=(typeof LANG!=='undefined'&&LANG==='ar');
    m.style.cssText='position:fixed;top:'+(r.bottom+6)+'px;'+(isAr?('left:'+r.left+'px'):('right:'+(window.innerWidth-r.right)+'px'))+';z-index:2147481000;background:#fff;border:1px solid var(--line,#E6E8EC);border-radius:12px;box-shadow:0 18px 50px -18px rgba(20,22,43,.35);min-width:230px;padding:6px;font-size:13px';
    function item(label,fn,danger){
      var b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem');
      b.style.cssText='display:block;width:100%;text-align:start;background:none;border:0;border-radius:8px;padding:9px 11px;font:inherit;cursor:pointer;'+(danger?'color:#D92D20;font-weight:700':'');
      b.onmouseenter=function(){b.style.background='#F6F7F9';}; b.onmouseleave=function(){b.style.background='none';};
      b.onfocus=function(){b.style.background='#F6F7F9';}; b.onblur=function(){b.style.background='none';};
      b.textContent=label; b.onclick=function(){closeMenu();fn&&fn();}; m.appendChild(b); return b;
    }
    var head=document.createElement('div');
    head.style.cssText='padding:9px 11px 7px;border-bottom:1px solid var(--line,#E6E8EC);margin-bottom:4px';
    head.innerHTML='<div style="font-weight:800">'+esc(fl(nm,arNm))+'</div>'+(window.__userEmail?'<div style="font-size:11px;color:var(--muted,#6B7480)">'+esc(window.__userEmail)+'</div>':'');
    m.appendChild(head);
    if(hidden.team)item(fl('Team — people & roles','الفريق — الأعضاء والأدوار'),function(){hidden.team.click();});
    if(hidden.access)item(fl('Page access','صلاحيات الصفحات'),function(){hidden.access.click();});
    if(hidden.signout)item(fl('Sign out','تسجيل الخروج'),function(){hidden.signout.click();},true);
    document.body.appendChild(m);
    chip.setAttribute('aria-expanded','true');
    /* the keyboard: focus lands on the first item; ↑/↓ walk; Escape closes and returns to the chip;
       Tab closes and carries on from the chip (capture phase, so js/35's #modal handler never sees
       an Escape that was meant for this box) */
    var items=[].slice.call(m.querySelectorAll('button'));
    try{ if(items[0])items[0].focus(); }catch(_){}
    m.__key=function(e){
      if(!document.getElementById('v68menu'))return;
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeMenu(); try{chip.focus();}catch(_){} return; }
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        if(!items.length)return;
        var i=items.indexOf(document.activeElement);
        var n=e.key==='ArrowDown'?(i+1)%items.length:(i<=0?items.length-1:i-1);
        e.preventDefault(); try{items[n].focus();}catch(_){} return;
      }
      if(e.key==='Tab'){ closeMenu(); try{chip.focus();}catch(_){} }   // the browser then tabs on from the chip
    };
    document.addEventListener('keydown',m.__key,true);
    m.__out=function(e){ if(!m.contains(e.target)&&e.target!==chip&&!chip.contains(e.target))closeMenu(); };
    setTimeout(function(){ if(document.getElementById('v68menu')===m)document.addEventListener('click',m.__out); },0);
  }

  // learn my email once (for the menu header + role lookup)
  function learnEmail(){ try{
    if(window.__userEmail)return;
    var c=window.fc?fc():null; if(!c)return;
    c.auth.getSession().then(function(s){var u=s&&s.data&&s.data.session&&s.data.session.user;if(u&&u.email)window.__userEmail=u.email;});
  }catch(_){} }

  try{
    var _r=window.render;
    window.render=function(){var o=_r.apply(this,arguments);try{[150,700,1500].forEach(function(d){setTimeout(ensureChip,d);});}catch(_){}return o;};
  }catch(_){}
  [1000,3000,7000].forEach(function(d){setTimeout(function(){learnEmail();ensureChip();},d);});
  setInterval(function(){learnEmail();ensureChip();},10000);

  console.info('%c[v68] top-bar tidy (profile chip: Team · Access · Sign out) loaded','color:#B54708;font-weight:700');
}catch(e){if(window.console)console.warn('[v68] init',e);}})();
