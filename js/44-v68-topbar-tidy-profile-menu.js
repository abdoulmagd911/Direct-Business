/* v68 — Top banner tidy (owner order 2026-08-13: "Sign out in the middle makes no sense").
   The top bar had grown into a row of loose buttons (Export, Share, Team, Access,
   Sign out) in whatever order layers appended them. Now:
     · Export and Share stay visible — they are daily work.
     · Team, Access and Sign out move into a profile chip at the END of the bar:
       your initial + name + role; click it → a small menu with who you are
       (name + email), Team & Access (admins see them), and Sign out at the bottom.
   The original buttons are hidden, not removed — their click handlers still do the
   work, so nothing about how Team/Access/sign-out behave has changed. Reversible. */
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
    var shown=fl(nm.split(' ')[0],arNm.split(' ')[0]||arNm);
    var chip=document.getElementById('v68me');
    if(!chip){
      chip=document.createElement('button'); chip.id='v68me'; chip.type='button';
      chip.style.cssText='display:flex;align-items:center;gap:8px;border:1px solid var(--line,#E6E8EC);background:#fff;border-radius:999px;padding:4px 12px 4px 4px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;margin-inline-start:auto';
      chip.onclick=function(e){e.stopPropagation();toggleMenu();};
      tools.appendChild(chip);
    }
    var role=myRole(); var roleLbl=role?((fl('x','y')==='y'?ROLE_AR:ROLE_EN)[role]||role):'';
    chip.innerHTML='<span style="width:26px;height:26px;border-radius:50%;background:#F06820;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">'+esc((arNm.trim()[0]||nm[0]||'?').toUpperCase())+'</span>'+
      '<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(shown)+'</span>'+
      (roleLbl?'<span style="font-weight:500;color:var(--muted,#6B7480);font-size:11px">· '+esc(roleLbl)+'</span>':'')+
      '<span style="color:var(--muted,#6B7480);font-size:10px">▾</span>';
    if(chip!==tools.lastElementChild)tools.appendChild(chip);   // always at the end of the bar
  }

  function toggleMenu(){
    var m=document.getElementById('v68menu');
    if(m){m.remove();return;}
    var chip=document.getElementById('v68me'); if(!chip)return;
    var nm=(window.__userName||'').trim();
    var arNm=(typeof ownerLabel==='function')?ownerLabel(nm):nm;
    m=document.createElement('div'); m.id='v68menu';
    var r=chip.getBoundingClientRect();
    var isAr=(typeof LANG!=='undefined'&&LANG==='ar');
    m.style.cssText='position:fixed;top:'+(r.bottom+6)+'px;'+(isAr?('left:'+r.left+'px'):('right:'+(window.innerWidth-r.right)+'px'))+';z-index:2147481000;background:#fff;border:1px solid var(--line,#E6E8EC);border-radius:12px;box-shadow:0 18px 50px -18px rgba(20,22,43,.35);min-width:230px;padding:6px;font-size:13px';
    function item(label,fn,danger){
      var b=document.createElement('button'); b.type='button';
      b.style.cssText='display:block;width:100%;text-align:start;background:none;border:0;border-radius:8px;padding:9px 11px;font:inherit;cursor:pointer;'+(danger?'color:#D92D20;font-weight:700':'');
      b.onmouseenter=function(){b.style.background='#F6F7F9';}; b.onmouseleave=function(){b.style.background='none';};
      b.textContent=label; b.onclick=function(){m.remove();fn&&fn();}; m.appendChild(b); return b;
    }
    var head=document.createElement('div');
    head.style.cssText='padding:9px 11px 7px;border-bottom:1px solid var(--line,#E6E8EC);margin-bottom:4px';
    head.innerHTML='<div style="font-weight:800">'+esc(fl(nm,arNm))+'</div>'+(window.__userEmail?'<div style="font-size:11px;color:var(--muted,#6B7480)">'+esc(window.__userEmail)+'</div>':'');
    m.appendChild(head);
    if(hidden.team)item(fl('Team — people & roles','الفريق — الأعضاء والأدوار'),function(){hidden.team.click();});
    if(hidden.access)item(fl('Page access','صلاحيات الصفحات'),function(){hidden.access.click();});
    if(hidden.signout)item(fl('Sign out','تسجيل الخروج'),function(){hidden.signout.click();},true);
    document.body.appendChild(m);
    setTimeout(function(){document.addEventListener('click',function close(e){if(!m.contains(e.target)){m.remove();document.removeEventListener('click',close);}});},0);
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
