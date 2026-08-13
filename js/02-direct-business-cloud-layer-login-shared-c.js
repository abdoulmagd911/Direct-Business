/* ===== Direct Business cloud layer: login + shared cloud data (additive, safe) ===== */
(function(){
  var SUPA_URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
  var SUPA_KEY='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
  var APPKEY='directBusinessData_v29';
  var sb=null, me=null, myRole=null;

  function el(tag,css,html){var e=document.createElement(tag);if(css)e.style.cssText=css;if(html!=null)e.innerHTML=html;return e;}

  // ---- full-screen login overlay (covers the app until signed in) ----
  var ov=el('div','position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1C1E2B,#2A2D3E 60%,#3C4050);font-family:Cairo,Inter,system-ui,Arial,sans-serif');
  var card=el('div','width:380px;max-width:92vw;background:#FBF8F4;border-radius:20px;box-shadow:0 30px 80px -20px rgba(0,0,0,.6);padding:30px 28px;');
  var loginHTML=
    '<div style="text-align:center;margin-bottom:6px"><img id="cl_logo" alt="Direct" style="display:none;max-width:180px;max-height:58px;margin:0 auto 12px"><div style="font-size:22px;font-weight:800;color:#1C1E2B;letter-spacing:-.02em">'+(typeof brandName==='function'?brandName():'Direct Business')+'</div>'+
    '<div style="font-size:12px;color:#7C8194;direction:rtl">دايركت أعمال</div></div>'+
    '<div style="font-size:10.5px;font-weight:800;color:#FF6B00;text-align:center;letter-spacing:.03em;margin-top:9px;text-transform:uppercase">Global supplier power · Saudi service · One partner</div>'+
    '<div style="font-size:11px;color:#9AA1B6;text-align:center;direction:rtl;margin-top:3px">قوة موردين عالمية · خدمة سعودية · شريك واحد</div>'+
    '<div style="font-size:12.5px;color:#7C8194;text-align:center;margin:12px 0 18px">Sign in to your team workspace</div>'+
    '<div id="cl_err" style="display:none;background:#F0453A14;color:#D92D20;font-size:12.5px;padding:9px 12px;border-radius:10px;margin-bottom:12px"></div>'+
    '<label style="font-size:12px;font-weight:700;color:#55596A">Email</label>'+
    '<input id="cl_email" aria-label="Email address" type="email" autocomplete="username" inputmode="email" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:16px">'+
    '<label style="font-size:12px;font-weight:700;color:#55596A">Password</label>'+
    '<input id="cl_pw" aria-label="Password" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin:5px 0 6px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:16px">'+
    '<div style="text-align:right;margin:0 0 12px"><span id="cl_forgot" style="color:#FF6B00;font-size:12px;font-weight:700;cursor:pointer">Forgot password?</span></div>'+
    '<button id="cl_go" style="width:100%;padding:12px;border:0;border-radius:12px;background:linear-gradient(135deg,#FF6B00,#FF9A4D);color:#fff;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px -7px rgba(255,107,0,.5)">Sign in</button>'+
    '<div style="text-align:center;margin-top:14px;font-size:12px;color:#9AA1B6;line-height:1.6">Accounts are created by your admin.<br>Need access? Ask Abdulrahman.</div>'+
    '<div id="cl_busy" style="display:none;text-align:center;margin-top:12px;font-size:12px;color:#7C8194">Working...</div>';
  // Boot splash: shown while we quietly check for an existing session, so a signed-in
  // person who reloads never sees the login form flash before the app appears.
  var splashHTML='<div style="text-align:center;padding:18px 6px 8px">'+
    '<img id="cl_logo" alt="Direct" style="display:none;max-width:180px;max-height:58px;margin:0 auto 14px">'+
    '<div style="font-size:22px;font-weight:800;color:#1C1E2B;letter-spacing:-.02em">'+(typeof brandName==='function'?brandName():'Direct Business')+'</div>'+
    '<div style="font-size:12px;color:#7C8194;direction:rtl;margin-top:2px">دايركت أعمال</div>'+
    '<div style="width:26px;height:26px;border:3px solid #EADFCE;border-top-color:#FF6B00;border-radius:50%;margin:24px auto 12px;animation:clspin .8s linear infinite"></div>'+
    '<div style="font-size:12.5px;color:#7C8194">Loading your workspace…</div></div>';
  try{if(!document.getElementById('cl_boot_css')){var _bs=document.createElement('style');_bs.id='cl_boot_css';_bs.textContent='@keyframes clspin{to{transform:rotate(360deg)}}';(document.head||document.documentElement).appendChild(_bs);}}catch(_){}
  card.innerHTML=splashHTML;
  ov.appendChild(card);
  function showOverlay(){ if(!document.body.contains(ov)) document.body.appendChild(ov); }
  function hideOverlay(){ if(document.body.contains(ov)) ov.remove(); }
  function err(m){var e=document.getElementById('cl_err');if(e){e.style.display='block';e.textContent=m;}}
  function busy(b){var x=document.getElementById('cl_busy');if(x)x.style.display=b?'block':'none';var g=document.getElementById('cl_go');if(g)g.disabled=b;}
  var mode='in', formShown=false;
  // Swap the splash for the real login form — only when we actually need a sign-in.
  function showLoginForm(){ if(formShown)return; card.innerHTML=loginHTML; formShown=true; try{setLogo(0);}catch(_){}; try{wireForm();}catch(_){} }
  // attach overlay as early as possible (as a neutral splash, not the login form)
  if(document.body) showOverlay(); else document.addEventListener('DOMContentLoaded',showOverlay);

  // ---- tiny sync status pill ----
  var pill=el('div','position:fixed;right:14px;bottom:14px;z-index:2147482000;background:#1C1E2B;color:#fff;font:12px Cairo,Inter,system-ui,Arial;padding:7px 12px;border-radius:999px;box-shadow:0 8px 20px -6px rgba(0,0,0,.4);display:none;align-items:center;gap:7px');
  var pillTimer;
  /* exposed so the permission guard (v70) can turn a whispered "Save issue" into a clear
     message and reload the real data — the screen must never show an unsaved change */
  function setPill(t,c){ try{ if(window.__pillHook) window.__pillHook(t,c); }catch(_){}
    return _setPill(t,c); }
  function _setPill(t,c){pill.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:'+(c||'#16B364')+';display:inline-block"></span>'+t;pill.style.display='inline-flex';clearTimeout(pillTimer);if((c||'#16B364')!=='#D92D20')pillTimer=setTimeout(function(){pill.style.display='none';},2500);}

  function setLogo(n){try{var lg=document.querySelector('img.logo, .brand img, .side img');var ci=document.getElementById('cl_logo');if(ci&&lg&&lg.src){ci.src=lg.src;ci.style.display='block';return;}}catch(_){}if((n||0)<20)setTimeout(function(){setLogo((n||0)+1);},250);}

  /* ===== v32 row-based lead storage: each lead saves individually to the businesses table ===== */
  var FUNNELS=[], FBYID={}, FBYKEY={}, SNAP={}, ROWID={};
  /* app record id (legacy_id||uuid) → real businesses.id (uuid). Exposed so the finance link
     (keyed by the uuid) can be resolved from a client card whose id is the legacy id. */
  try{ window.__ROWID=ROWID; window.__bizUuid=function(appId){ try{ return (window.__ROWID&&window.__ROWID[appId])||appId; }catch(_){ return appId; } }; }catch(_){}
  /* Every display stage must map back to a database stage. A missing key here silently
     saves the lead as 'new' - that is how On hold used to be lost on save. */
  var S2C={'Prospect':'new','New':'new','Contacted':'contacted','Qualified':'in_discussion','Negotiation':'in_discussion','Proposal':'proposal','Won':'won','Lost':'lost','On hold':'on_hold'};
  var C2S={'new':'Prospect','contacted':'Contacted','in_discussion':'Qualified','proposal':'Proposal','won':'Won','lost':'Lost','on_hold':'Prospect'};
  function stageToApp(canon, prev){ if(prev && S2C[prev]===canon) return prev; return C2S[canon]||'Prospect'; }
  function rowToApp(r){
    var base=(r.raw&&typeof r.raw==='object')?r.raw:{};
    var o={}; for(var k in base){o[k]=base[k];}
    o.id=r.legacy_id||r.id; ROWID[o.id]=r.id;
    if(r.name!=null&&r.name!=='')o.name=r.name;
    if(r.name_ar!=null)o.nameAr=r.name_ar;
    if(r.source!=null)o.source=r.source;
    if(r.status!=null&&r.status!=='')o.status=r.status;
    if(r.category!=null)o.category=r.category;
    if(r.website!=null)o.website=r.website;
    if(r.notes!=null&&r.notes!=='')o.notes=r.notes;
    o.isClient=(r.is_client===true)||base.isClient===true;
    o.stage=stageToApp(r.stage, base.stage);
    var f=FBYID[r.funnel_id]; o.funnelKey=f?f.key:null; o.funnelName=f?f.name_en:null; o.funnelNameAr=f?f.name_ar:null;
    o.funnelDetails=r.funnel_details||{};
    o.nextActionDate=r.next_action_date||o.nextAction||null;
    o.nextActionNote=r.next_action_note||null;
    if(r.lost_reason&&!o.lostReason)o.lostReason=r.lost_reason;
    // Map the record's own dates onto the app object (the strip + score read these).
    if(r.created_at&&!o.createdAt)o.createdAt=r.created_at;
    if(r.converted_date&&!o.convertedDate)o.convertedDate=r.converted_date;
    // Last touch: if the raw blob never stored lastContact, take the newest logged activity.
    if(!o.lastContact&&o.activities&&o.activities.length){
      var _mx=0;o.activities.forEach(function(a){var d=(typeof a.date==='number')?a.date:Date.parse(a.date)||0;if(d>_mx)_mx=d;});
      if(_mx)o.lastContact=_mx;
    }
    // Direct client ID — the link key to Direct Payments. Real column wins over any raw copy.
    if(r.direct_client_id!=null&&r.direct_client_id!=='')o.directClientId=String(r.direct_client_id);
    return o;
  }
  function appToRow(o){
    var row={
      legacy_id:String(o.id),
      name:o.name||'', name_ar:o.nameAr||null, source:o.source||null,
      status:o.status||null, category:o.category||null, website:o.website||null,
      notes:o.notes||null, is_client:o.isClient===true,
      stage:S2C[o.stage]||'new',
      funnel_details:o.funnelDetails||{},
      next_action_date:o.nextActionDate||null,
      next_action_note:o.nextActionNote||null,
      lost_reason:(o.lostReason&&String(o.lostReason).trim())||null,
      direct_client_id:(o.directClientId!=null&&String(o.directClientId).trim()!=='')?String(o.directClientId).trim():null,
      raw:o
    };
    // Persist the client handover fields to real columns too (not just raw), so a lead
    // converted in-app writes the same shape my SQL seed does and external reads can use them.
    if(o.legalName!=null&&o.legalName!=='')row.legal_name=o.legalName;
    var _crv=o.crVat||o.vatNumber||o.crNumber; if(_crv)row.cr_vat=String(_crv);
    if(o.customerType||o.entityType)row.entity_type=o.customerType||o.entityType;
    if(o.paymentTerms!=null&&o.paymentTerms!=='')row.payment_terms=o.paymentTerms;
    if(o.creditLimit!=null&&o.creditLimit!=='')row.credit_limit=Number(o.creditLimit)||0;
    if(o.contractScope!=null&&o.contractScope!=='')row.contract_scope=o.contractScope;
    if(o.isClient===true&&o.convertedDate){try{row.converted_date=new Date(o.convertedDate).toISOString().slice(0,10);}catch(_){}}
    if(o.funnelKey&&FBYKEY[o.funnelKey])row.funnel_id=FBYKEY[o.funnelKey].id;
    if(ROWID[o.id])row.id=ROWID[o.id];
    return row;
  }
  function loadRows(cb){
    sb.from('funnels').select('*').then(function(fr){
      FUNNELS=(fr.data||[]); FBYID={}; FBYKEY={}; try{window.__funnelDefs=FUNNELS;}catch(_){}
      FUNNELS.forEach(function(f){FBYID[f.id]=f;FBYKEY[f.key]=f;});
      window.__FUNNELS=FUNNELS;
      var all=[];
      function page(from){
        sb.from('businesses').select('*').is('archived_at',null).order('created_at',{ascending:true}).range(from,from+999).then(function(r){
          if(r.error){cb(r.error,null);return;}
          all=all.concat(r.data||[]);
          if((r.data||[]).length===1000)page(from+1000); else cb(null,all);
        });
      }
      page(0);
    });
  }

  function start(){
    if(!window.supabase){ setTimeout(start,150); return; }
    sb=window.supabase.createClient(SUPA_URL,SUPA_KEY);
    setLogo(0);
    var settled=false;
    sb.auth.getSession().then(function(r){ settled=true; handleSession(r.data.session); })
      .catch(function(){ settled=true; showLoginForm(); });
    // Safety net: if the session check stalls (bad network), fall back to the login form
    // after a few seconds so nobody is ever stuck staring at the splash.
    setTimeout(function(){ if(!settled && !formShown){ showLoginForm(); } }, 6000);
    sb.auth.onAuthStateChange(function(_e,s){
      if(s&&s.user){me=s.user;}
      if(_e==='PASSWORD_RECOVERY'){ showRecovery(); }
    });
  }

  function showRecovery(){
    showOverlay();
    card.innerHTML='<div style="text-align:center;margin-bottom:6px"><div style="font-size:20px;font-weight:800;color:#1C1E2B">Set a new password</div>'+
      '<div style="font-size:12.5px;color:#7C8194;margin:8px 0 16px">Choose a new password for your account.</div></div>'+
      '<div id="cl_err" style="display:none;background:#F0453A14;color:#D92D20;font-size:12.5px;padding:9px 12px;border-radius:10px;margin-bottom:12px"></div>'+
      '<label style="font-size:12px;font-weight:700;color:#55596A">New password</label>'+
      '<input id="rp_pw1" type="password" autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:14px">'+
      '<label style="font-size:12px;font-weight:700;color:#55596A">Repeat new password</label>'+
      '<input id="rp_pw2" type="password" autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:5px 0 16px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:14px">'+
      '<button id="rp_go" style="width:100%;padding:12px;border:0;border-radius:12px;background:linear-gradient(135deg,#FF6B00,#FF9A4D);color:#fff;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Save new password</button>';
    document.getElementById('rp_go').onclick=function(){
      var p1=document.getElementById('rp_pw1').value,p2=document.getElementById('rp_pw2').value;
      if(!p1||p1.length<8){ err('Password must be at least 8 characters.'); return; }
      if(p1!==p2){ err('The two passwords do not match.'); return; }
      sb.auth.updateUser({password:p1}).then(function(r){
        if(r.error){ err(r.error.message); return; }
        var e2=document.getElementById('cl_err');
        if(e2){ e2.style.display='block'; e2.style.background='#16B36414'; e2.style.color='#0B7A43'; e2.textContent='Password updated — loading your workspace...'; }
        setTimeout(function(){ location.href=location.pathname; },1200);
      });
    };
  }

  function showPending(){
    showOverlay();
    card.innerHTML='<div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#1C1E2B;margin-bottom:8px">Access not active yet</div>'+
      '<div style="font-size:13px;color:#55596A;line-height:1.7;margin-bottom:18px">This account is switched off.<br>Ask <b>Abdulrahman</b> to switch your access on in <b>Team</b>, then sign in again.</div>'+
      '<button id="pd_out" style="width:100%;padding:12px;border:1px solid #E3DCCF;border-radius:12px;background:#fff;color:#1C1E2B;font:inherit;font-size:14px;font-weight:700;cursor:pointer">Sign out</button></div>';
    document.getElementById('pd_out').onclick=function(){ sb.auth.signOut().then(function(){ location.reload(); }); };
  }

  function wireForm(){
    document.getElementById('cl_go').onclick=submit;
    document.getElementById('cl_pw').addEventListener('keydown',function(e){if(e.key==='Enter')submit();});
    var fg=document.getElementById('cl_forgot');
    if(fg)fg.onclick=function(){
      var e2=document.getElementById('cl_err');
      var email=(document.getElementById('cl_email').value||'').trim();
      function askAdmin(extra){
        if(!e2)return;
        e2.style.display='block'; e2.style.background='#F7900914'; e2.style.color='#B54708';
        e2.innerHTML=(extra?extra+'<br>':'')+'Ask <b>Abdulrahman</b> to reset your password.<br>He opens <b>Team</b> in the app, clicks <b>Reset password</b> next to your name, and sends you a new temporary one.';
      }
      if(!email){ askAdmin('Type your email above first if you want a reset link.'); return; }
      busy(true);
      sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin}).then(function(r){
        busy(false);
        if(r.error){ askAdmin(''); return; }
        if(e2){ e2.style.display='block'; e2.style.background='#16B36414'; e2.style.color='#0B7A43';
          e2.innerHTML='If email is switched on, a reset link is on its way to <b>'+email.replace(/</g,'&lt;')+'</b>.<br>Nothing after a few minutes? Ask Abdulrahman to reset it for you in <b>Team</b>.'; }
      }).catch(function(){ busy(false); askAdmin(''); });
    };
  }

  function submit(){
    var email=(document.getElementById('cl_email').value||'').trim();
    var pw=document.getElementById('cl_pw').value||'';
    if(!email||!pw){ err('Enter your email and password.'); return; }
    busy(true);
    sb.auth.signInWithPassword({email:email,password:pw}).then(function(r){
      busy(false);
      if(r.error){
        if(/invalid login credentials/i.test(r.error.message||'')){
          err('Wrong email or password. If you forgot it, click "Forgot password?" above — your admin can issue a new one.');
        } else { err(r.error.message); }
        return;
      }
      handleSession(r.data.session);
    }).catch(function(e){ busy(false); err(String(e&&e.message||e)); });
  }

  function handleSession(session){
    if(!session){ showLoginForm(); showOverlay(); return; }
    me=session.user;
    // v32: leads load row-by-row from the businesses table (single source of truth).
    // The app_state blob only carries the rest (settings, airlines, requests, ...).
    busy(true);
    loadRows(function(rowErr,rows){
      if(rowErr){ busy(false); err('Could not load leads: '+rowErr.message); return; }
      sb.from('app_state').select('data,updated_at').eq('id',1).maybeSingle().then(function(r){
        if(r.error){ busy(false); err('Could not load workspace: '+r.error.message); return; }
        var blob=(r.data&&r.data.data)||{};
        try{
          Object.keys(blob).forEach(function(k){ if(k!=='businesses'){ try{ DB[k]=blob[k]; }catch(_){}} });
          DB.businesses=rows.map(rowToApp);
          SNAP={}; DB.businesses.forEach(function(b){ try{ SNAP[b.id]=JSON.stringify(appToRow(b)); }catch(_){}});
          try{ Object.keys(localStorage).forEach(function(k){ if(/^directBusinessData_v\d+$/.test(k)){ localStorage.removeItem(k); } }); }catch(e){}
          try{ localStorage.setItem('db_cloud_ts', String((r.data&&r.data.updated_at)||'')); }catch(e){}
          if(typeof render==='function') render();
        }catch(e){ console.warn('v32 load merge issue',e); }
        /* The app is NOT revealed here any more. It is revealed by fetchRole() once we know
           who this is and what they may do — otherwise a viewer briefly sees full-power
           buttons, and someone who must change their password can start working first. */
        busy(false); afterReady();
      });
    });
  }

  function afterReady(){
    setPill('Cloud synced','#16B364');
    addSignOut();
    hookSave();
    fetchRole();
  }

  function roleTier(role){return role==='admin'?'admin':role==='manager'?'manager':role==='viewer'?'viewer':'team';}
  function applyRolePerms(tier){try{
    document.body.setAttribute('data-rtier',tier);
    window.__userTier=tier;
    if(!document.getElementById('cl_role_css')){var st=document.createElement('style');st.id='cl_role_css';st.textContent='body[data-rtier="viewer"] .btn.pri,body[data-rtier="viewer"] .btn.danger{pointer-events:none!important;opacity:.4!important}';document.head.appendChild(st);}
    var hideNav=function(){try{document.querySelectorAll('.nav a,.nav button,.side a,.side button').forEach(function(n){var t=(n.textContent||'').trim().toLowerCase();if(t.indexOf('settings')>=0){n.style.display=(tier==='admin')?'':'none';}});}catch(_){}};
    if(window.render&&!window.render.__roleHide){var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);hideNav();return o;};window.render.__roleHide=true;}
    hideNav();
  }catch(_){}}
  var roleSettled=false;
  function fetchRole(){
    /* Never leave anyone staring at the splash because of a network hiccup. */
    setTimeout(function(){ if(!roleSettled) hideOverlay(); }, 9000);
    sb.from('app_users').select('role,full_name,active,must_change_password').eq('id',me.id).maybeSingle().then(function(r){
      var d=r.data;
      if(r.error){ hideOverlay(); setTimeout(fetchRole,5000); return; }   // transient — try again, don't lock anyone out
      if(!d||!d.role||d.active===false){ showPending(); return; }
      if(d.must_change_password===true){ showFirstLogin(); return; }
      roleSettled=true;
      myRole=d.role; var tier=roleTier(myRole);
      var nm=(d.full_name||'').trim()||(me.email||'').split('@')[0];
      /* Who I am is per-session, NOT shared. It used to be saved into the one shared settings
         row, so the last person to sign in overwrote everybody else's name — which is why the
         "Mine" filters kept showing the wrong person's work. Keep it in memory only. */
      try{DB.settings=DB.settings||{};DB.settings.currentUser=nm;window.__userRole=myRole;window.__userEmail=(me&&me.email)||'';}catch(_){}
      applyRolePerms(tier);
      setPill(nm.replace(/[<>&]/g,'')+' &middot; '+(tier==='viewer'?'read-only':(myRole||'viewer')),'#16B364');
      if(tier==='admin') addTeamButton();
      hideOverlay();   // now — and only now — the app is shown, with this person's permissions already applied
    }).catch(function(){ hideOverlay(); });
  }

  function showFirstLogin(){
    showOverlay();
    card.innerHTML='<div style="text-align:center;margin-bottom:6px"><div style="font-size:20px;font-weight:800;color:#1C1E2B">Choose your own password</div>'+
      '<div style="font-size:12.5px;color:#7C8194;margin:8px 0 16px;line-height:1.6">You signed in with a temporary password.<br>Pick your own now — you will use it from next time.</div></div>'+
      '<div id="cl_err" style="display:none;background:#F0453A14;color:#D92D20;font-size:12.5px;padding:9px 12px;border-radius:10px;margin-bottom:12px"></div>'+
      '<label style="font-size:12px;font-weight:700;color:#55596A">New password</label>'+
      '<input id="fl_pw1" type="password" autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:14px">'+
      '<label style="font-size:12px;font-weight:700;color:#55596A">Repeat new password</label>'+
      '<input id="fl_pw2" type="password" autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:5px 0 16px;padding:11px 12px;border:1px solid #E3DCCF;border-radius:11px;font:inherit;font-size:14px">'+
      '<button id="fl_go" style="width:100%;padding:12px;border:0;border-radius:12px;background:linear-gradient(135deg,#FF6B00,#FF9A4D);color:#fff;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer">Save and continue</button>';
    document.getElementById('fl_go').onclick=function(){
      var p1=document.getElementById('fl_pw1').value,p2=document.getElementById('fl_pw2').value;
      if(!p1||p1.length<8){ err('Use at least 8 characters.'); return; }
      if(p1!==p2){ err('The two passwords do not match.'); return; }
      sb.auth.updateUser({password:p1}).then(function(r){
        if(r.error){ err(r.error.message); return; }
        callAdmin({action:'clear_must_change'}).then(function(){ location.reload(); });
      });
    };
  }

  function callAdmin(payload){
    return sb.auth.getSession().then(function(s){
      var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:'';
      return fetch(SUPA_URL+'/functions/v1/admin-users',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':SUPA_KEY},
        body:JSON.stringify(payload)
      }).then(function(res){ return res.json(); });
    });
  }
  window.__callAdmin=callAdmin;

  // v32: push only the leads that actually changed (row upserts), plus the small non-lead blob
  var t=null, pendingSave=false;
  function pushCloud(){
    try{
      pendingSave=false;
      setPill('Saving...','#F79009');
      var biz=Array.isArray(DB.businesses)?DB.businesses:[];
      var ups=[];
      biz.forEach(function(b){ if(!b||b.id==null)return; try{ var row=appToRow(b); if(SNAP[b.id]!==JSON.stringify(row)) ups.push(row); }catch(_){}});
      // Leads removed in the app: archive their row (recoverable), never hard-delete
      var present={}; biz.forEach(function(b){ if(b&&b.id!=null)present[b.id]=1; });
      var gone=Object.keys(SNAP).filter(function(k){ return !present[k] && ROWID[k]; });
      if(gone.length){
        var goneIds=gone.map(function(k){return ROWID[k];});
        sb.from('businesses').update({archived_at:new Date().toISOString(),archived_by:(me&&me.email)||'app'}).in('id',goneIds).then(function(r){
          if(!r.error) gone.forEach(function(k){ delete SNAP[k]; delete ROWID[k]; });
        });
      }
      var rest={}; Object.keys(DB).forEach(function(k){ if(k!=='businesses')rest[k]=DB[k]; });
      var finish=function(errMsg){
        sb.rpc('save_state',{payload:rest}).then(function(r2){
          if(errMsg||(r2&&r2.error)){ pendingSave=true; setPill('Save issue: '+(errMsg||r2.error.message),'#D92D20'); }
          else setPill(ups.length?('Saved · '+ups.length+' lead'+(ups.length===1?'':'s')+' updated'):'Saved to cloud','#16B364');
          sb.from('app_state').select('updated_at').eq('id',1).maybeSingle().then(function(u){ try{ if(u&&u.data&&u.data.updated_at) localStorage.setItem('db_cloud_ts', String(u.data.updated_at)); }catch(e){} });
        });
      };
      if(!ups.length){ finish(null); return; }
      var updRows=ups.filter(function(r){return !!r.id;});
      var insRows=ups.filter(function(r){return !r.id;});
      var queue=[]; var j;
      for(j=0;j<updRows.length;j+=50)queue.push({rows:updRows.slice(j,j+50),ins:false});
      for(j=0;j<insRows.length;j+=50)queue.push({rows:insRows.slice(j,j+50),ins:true});
      var qi=0, errAll=null;
      function next(){
        if(qi>=queue.length){
          if(!errAll){ ups.forEach(function(row){ try{ SNAP[row.legacy_id]=JSON.stringify(row); }catch(_){}}); }
          finish(errAll); return;
        }
        var job=queue[qi++];
        var req=job.ins? sb.from('businesses').insert(job.rows).select('id,legacy_id')
                       : sb.from('businesses').upsert(job.rows,{onConflict:'id'}).select('id,legacy_id');
        req.then(function(r){
          if(r.error){ errAll=r.error.message; }
          else (r.data||[]).forEach(function(x){ if(x.legacy_id) ROWID[x.legacy_id]=x.id; });
          next();
        });
      }
      next();
    }catch(e){ setPill('Save error','#D92D20'); }
  }
  function hookSave(){
    if(typeof window.save==='function'){
      var orig=window.save;
      window.save=function(){ var x=orig.apply(this,arguments); if(t)clearTimeout(t); pendingSave=true; t=setTimeout(function(){pushCloud();}, 900); return x; };
    }
    // Flush any pending change immediately if the tab is closed/hidden, so nothing is lost
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden' && pendingSave){ if(t)clearTimeout(t); pushCloud(); }
    });
    window.addEventListener('beforeunload',function(e){
      if(pendingSave){ if(t)clearTimeout(t); pushCloud();
        e.preventDefault(); e.returnValue='Your last change is still saving — give it a second.'; return e.returnValue; }
    });
  }

  var ROLE_LABEL={admin:'Admin (full control)',manager:'Manager',bd:'Business development',operations:'Operations',team_member:'Team member',viewer:'Read only'};
  function addTeamButton(n){
    try{
      var tools=document.querySelector('.tools');
      if(!tools){ if((n||0)<20) setTimeout(function(){addTeamButton((n||0)+1);},250); return; }
      if(!document.getElementById('cl_team')){
        var b=el('button',null,'Team'); b.id='cl_team'; b.className='btn sm ghost'; b.style.cssText='font-weight:700';
        b.onclick=openTeam; tools.appendChild(b);
        if(window.render&&!window.render.__teamWrap){var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);try{var t=document.querySelector('.tools');if(t&&!document.getElementById('cl_team'))t.appendChild(b);}catch(_){}return o;};window.render.__teamWrap=true;}
      }
    }catch(_){}
  }

  function openTeam(){
    var old=document.getElementById('teamModal'); if(old)old.remove();
    var ov=el('div','position:fixed;inset:0;z-index:2147481500;background:rgba(20,22,35,.55);display:flex;align-items:flex-start;justify-content:center;padding:36px 20px;overflow:auto');
    ov.id='teamModal';
    var box=el('div','background:#fff;border-radius:16px;max-width:760px;width:100%;padding:24px 26px;font-family:inherit');
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
      '<div style="font-size:18px;font-weight:800">Team access</div>'+
      '<button id="tm_close" style="border:1px solid #E3DCCF;background:#fff;border-radius:9px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Close</button></div>'+
      '<div style="font-size:12.5px;color:#7C8194;margin-bottom:16px">Create accounts for your team. They sign in with the temporary password you give them, then choose their own.</div>'+
      '<div id="tm_new" style="background:#FBF8F4;border-radius:12px;padding:14px 16px;margin-bottom:18px">'+
        '<div style="font-size:13px;font-weight:800;margin-bottom:10px">Add a teammate</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          '<input id="tm_name" placeholder="Full name" style="flex:1;min-width:150px;padding:10px 12px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px">'+
          '<input id="tm_email" placeholder="name@directksa.com" style="flex:1.4;min-width:190px;padding:10px 12px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px">'+
          '<select id="tm_role" style="padding:10px 12px;border:1px solid #E3DCCF;border-radius:10px;font:inherit;font-size:13px">'+
            Object.keys(ROLE_LABEL).map(function(k){return '<option value="'+k+'"'+(k==='team_member'?' selected':'')+'>'+ROLE_LABEL[k]+'</option>';}).join('')+
          '</select>'+
          '<button id="tm_add" style="border:0;background:#FF6B00;color:#fff;border-radius:10px;padding:10px 20px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">Create</button>'+
        '</div>'+
        '<div id="tm_result" style="display:none;margin-top:12px"></div>'+
      '</div>'+
      '<div id="tm_list" style="font-size:13px;color:#7C8194">Loading team…</div>'+
      '<div style="margin-top:22px;border-top:1px solid #EEE8DE;padding-top:16px">'+
        '<div style="font-size:13px;font-weight:800;margin-bottom:6px">Email sending <span style="font-weight:600;color:#7C8194">(optional)</span></div>'+
        '<div style="font-size:12.5px;color:#55596A;line-height:1.7;margin-bottom:10px">The app does not need email — you hand out passwords yourself. Switch it on only if you want people to reset their own passwords.<br>Paste these into Supabase → Project Settings → Authentication → SMTP Settings:</div>'+
        '<div style="background:#FBF8F4;border:1px dashed #C9C2B4;border-radius:10px;padding:12px 14px;font-family:monospace;font-size:12.5px;line-height:1.9">'+
          'Host: smtp-relay.brevo.com<br>Port: 587<br>Username: your Brevo login email<br>Password: your Brevo <b>SMTP key</b> (Brevo → SMTP &amp; API → SMTP)<br>Sender email: no-reply@directksa.com</div>'+
        '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
          '<a href="https://supabase.com/dashboard/project/vkxoeeoauexyfpzqufqd/settings/auth" target="_blank" style="border:1px solid #E3DCCF;background:#fff;border-radius:9px;padding:7px 14px;font-size:12.5px;font-weight:700;color:#1C1E2B;text-decoration:none">Open Supabase SMTP settings</a>'+
          '<button id="tm_mailtest" style="border:1px solid #E3DCCF;background:#fff;border-radius:9px;padding:7px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Test email now</button>'+
          '<span id="tm_mailres" style="font-size:12.5px;color:#7C8194"></span>'+
        '</div></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    document.getElementById('tm_close').onclick=function(){ov.remove();};
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
    document.getElementById('tm_add').onclick=addMember;
    var mt=document.getElementById('tm_mailtest');
    if(mt)mt.onclick=function(){
      var res=document.getElementById('tm_mailres');
      mt.disabled=true; res.textContent='Sending…'; res.style.color='#7C8194';
      sb.auth.resetPasswordForEmail((me&&me.email)||'',{redirectTo:location.origin}).then(function(r){
        mt.disabled=false;
        if(r.error){ res.style.color='#D92D20'; res.textContent='Not working yet: '+r.error.message; }
        else { res.style.color='#0B7A43'; res.textContent='Sent to '+((me&&me.email)||'you')+' — check your inbox in a minute.'; }
      });
    };
    loadTeam();
  }

  function showTemp(email,pw,label){
    var r=document.getElementById('tm_result'); if(!r)return;
    r.style.display='block';
    r.innerHTML='<div style="background:#16B36414;border:1px solid #16B36455;border-radius:10px;padding:12px 14px">'+
      '<div style="font-size:12.5px;font-weight:800;color:#0B7A43;margin-bottom:6px">'+label+'</div>'+
      '<div style="font-size:12.5px;color:#1C1E2B;margin-bottom:8px">Send these two lines to <b>'+String(email).replace(/</g,'&lt;')+'</b> on WhatsApp:</div>'+
      '<div id="tm_copytext" style="background:#fff;border:1px dashed #C9C2B4;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12.5px;line-height:1.7;user-select:all">'+
        'Link: '+location.origin+'<br>Email: '+String(email).replace(/</g,'&lt;')+'<br>Temporary password: <b>'+pw+'</b></div>'+
      '<button id="tm_copy" style="margin-top:10px;border:1px solid #E3DCCF;background:#fff;border-radius:9px;padding:7px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Copy message</button>'+
      '<div style="font-size:11.5px;color:#7C8194;margin-top:8px">Shown once. They will be asked to choose their own password when they sign in.</div></div>';
    document.getElementById('tm_copy').onclick=function(){
      var txt='Direct Business\nLink: '+location.origin+'\nEmail: '+email+'\nTemporary password: '+pw;
      try{navigator.clipboard.writeText(txt);document.getElementById('tm_copy').textContent='Copied ✓';}catch(_){}
    };
  }

  function addMember(){
    var name=(document.getElementById('tm_name').value||'').trim();
    var email=(document.getElementById('tm_email').value||'').trim();
    var role=document.getElementById('tm_role').value;
    var btn=document.getElementById('tm_add');
    if(!email){ alert('Enter their email address.'); return; }
    btn.disabled=true; btn.textContent='Creating…';
    callAdmin({action:'create',email:email,full_name:name,role:role}).then(function(r){
      btn.disabled=false; btn.textContent='Create';
      if(r.error){ alert(r.error); return; }
      document.getElementById('tm_name').value=''; document.getElementById('tm_email').value='';
      showTemp(r.email,r.temp_password,'Account created');
      loadTeam();
    }).catch(function(e){ btn.disabled=false; btn.textContent='Create'; alert(String(e)); });
  }

  function loadTeam(){
    callAdmin({action:'list'}).then(function(r){
      var box=document.getElementById('tm_list'); if(!box)return;
      if(r.error){ box.textContent=r.error; return; }
      var rows=(r.users||[]).map(function(u){
        var nm=(u.full_name||'').trim()||u.email.split('@')[0];
        return '<tr style="border-top:1px solid #EEE8DE">'+
          '<td style="padding:9px 6px"><b>'+nm.replace(/</g,'&lt;')+'</b><div style="font-size:11.5px;color:#7C8194">'+u.email.replace(/</g,'&lt;')+'</div></td>'+
          '<td style="padding:9px 6px">'+(ROLE_LABEL[u.role]||u.role)+'</td>'+
          '<td style="padding:9px 6px">'+(u.active?'<span style="color:#0B7A43;font-weight:700">Active</span>':'<span style="color:#B54708;font-weight:700">Off</span>')+
            (u.must_change_password?'<div style="font-size:11px;color:#7C8194">temp password</div>':'')+'</td>'+
          '<td style="padding:9px 6px;text-align:right;white-space:nowrap">'+
            '<button data-rst="'+u.id+'" style="border:1px solid #E3DCCF;background:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">Reset password</button> '+
            '<button data-tog="'+u.id+'" data-act="'+(u.active?'0':'1')+'" style="border:1px solid #E3DCCF;background:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">'+(u.active?'Switch off':'Switch on')+'</button>'+
          '</td></tr>';
      }).join('');
      box.innerHTML='<div style="font-size:13px;font-weight:800;color:#1C1E2B;margin-bottom:8px">People with access</div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#1C1E2B"><tbody>'+rows+'</tbody></table>';
      box.querySelectorAll('[data-rst]').forEach(function(b){
        b.onclick=function(){
          if(!confirm('Give this person a new temporary password?'))return;
          b.disabled=true;b.textContent='…';
          callAdmin({action:'reset_password',id:b.getAttribute('data-rst')}).then(function(r2){
            b.disabled=false;b.textContent='Reset password';
            if(r2.error){alert(r2.error);return;}
            var row=b.closest('tr'); var em=row?row.querySelector('div').textContent:'';
            showTemp(em,r2.temp_password,'New temporary password'); loadTeam();
          });
        };
      });
      box.querySelectorAll('[data-tog]').forEach(function(b){
        b.onclick=function(){
          b.disabled=true;
          callAdmin({action:'set_active',id:b.getAttribute('data-tog'),active:b.getAttribute('data-act')==='1'}).then(function(r2){
            b.disabled=false; if(r2.error){alert(r2.error);return;} loadTeam();
          });
        };
      });
    });
  }

  function addSignOut(n){
    try{
      var tools=document.querySelector('.tools');
      if(!tools){ if((n||0)<20) setTimeout(function(){addSignOut((n||0)+1);},250); return; }
      var b=document.getElementById('cl_signout');
      if(!b){ b=el('button',null,'Sign out'); b.id='cl_signout'; b.className='btn sm ghost'; b.style.cssText='font-weight:700'; b.onclick=function(){ sessionStorage.removeItem('db_synced'); sb.auth.signOut().then(function(){ location.reload(); }); }; tools.appendChild(b); }
      if(window.render&&!window.render.__soWrap){var _r=window.render;window.render=function(){var o=_r.apply(this,arguments);try{var t=document.querySelector('.tools');if(t&&!document.getElementById('cl_signout'))t.appendChild(b);}catch(_){}return o;};window.render.__soWrap=true;}
      if(!document.body.contains(pill)) document.body.appendChild(pill);
    }catch(_){}
  }

  start();
})();
