/* ===== Team & Access → the team list (2026-09-25, before release 2) =====

   The oversight's ask: a Team & Access section for the team list — who is on it, which department,
   who heads each department, who is active — for an admin or a manager only, recorded in history,
   and enforced by the DATABASE (scripts/sql/team-list-editing.sql). This layer keeps no rule of its
   own: it draws for admins and managers because only they can change anything, and every refusal
   it shows is the database's own sentence. A write that the database silently filtered (no row came
   back) is reported as "not saved", never as saved.

   Why the team list matters: the Tasks page offers "New" only to someone on it, a task's owner is a
   person on it, and the Commercial head heads all six departments under Commercial. One human is ONE
   entry — a second login of the same person stays a login, not a second team member.            */
(function(){try{
  function isAr(){ try{ return (typeof LANG!=='undefined'&&LANG==='ar'); }catch(_){ return false; } }
  function fl(en,ar){ return isAr()?ar:en; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function client(){ try{ if(window.fc){ var c=fc(); if(c) return c; } }catch(_){} return null; }
  function role(){ try{ return window.__userRole||null; }catch(_){ return null; } }
  function canManage(){ var r=role(); return r==='admin'||r==='manager'; }

  /* the database's refusals, in the reader's language (scripts/sql/team-list-editing.sql + members_guard) */
  var AR=[
    [/^This person heads (.+) — choose a new head first, then make them inactive/,function(m){ return 'هذا الشخص يرأس '+m[1]+' — اختر رئيسًا جديدًا أولًا، ثم اجعله غير نشط'; }],
    [/^A department head must be an active person on the team list/,function(){ return 'يجب أن يكون رئيس القسم شخصًا نشطًا في قائمة الفريق'; }],
    [/^Only an active login can be added to the team list/,function(){ return 'لا يمكن إضافة إلا حساب دخول نشط إلى قائمة الفريق'; }],
    [/^A team-list entry stays with its login/,function(){ return 'يبقى إدخال قائمة الفريق مرتبطًا بحساب الدخول نفسه؛ أضف الحساب الآخر كإدخال مستقل'; }],
    [/^Only an admin can rename, move or switch off a department/,function(){ return 'المسؤول وحده يستطيع إعادة تسمية القسم أو نقله أو إيقافه؛ ويستطيع المدير تعيين رئيسه'; }],
    [/^Reassign this person's open tasks before deactivating them/,function(){ return 'أعد إسناد المهام المفتوحة لهذا الشخص قبل جعله غير نشط'; }],
    [/^Reassign this person's open projects before deactivating them/,function(){ return 'أعد إسناد المشاريع المفتوحة لهذا الشخص قبل جعله غير نشط'; }],
    [/row-level security|permission denied/i,function(){ return 'قاعدة البيانات رفضت التغيير: هذا القسم للمسؤول والمدير فقط'; }]
  ];
  function said(msg){
    var m=String(msg||'');
    if(/row-level security|permission denied/i.test(m)&&!isAr()) m='The database refused the change: the team list is for an admin or a manager only.';
    if(!isAr()) return m;
    for(var i=0;i<AR.length;i++){ var x=m.match(AR[i][0]); if(x) return AR[i][1](x); }
    return m;
  }

  var S={ members:null, deps:null, people:null, msg:null, err:false, busy:false };
  function load(){
    var c=client(); if(!c||S.busy) return; S.busy=true;
    Promise.all([
      c.from('team_members').select('id,user_id,department_id,active,left_on'),
      c.from('departments').select('id,code,name_en,name_ar,head_member_id,active,sort,parent_id').order('sort'),
      c.from('team_directory').select('id,email,full_name,name_ar,active')
    ]).then(function(r){
      S.busy=false;
      if(r[0].error||r[1].error||r[2].error){ S.members=[]; S.deps=[]; S.people=[]; S.msg=fl('Could not read the team list: ','تعذّرت قراءة قائمة الفريق: ')+((r[0].error||r[1].error||r[2].error).message||''); S.err=true; }
      else { S.members=r[0].data||[]; S.deps=r[1].data||[]; S.people=r[2].data||[]; }
      paint();
    }).catch(function(e){ S.busy=false; S.members=[]; S.deps=[]; S.people=[]; S.msg=String(e&&e.message||e); S.err=true; paint(); });
  }
  function person(uid){ return (S.people||[]).filter(function(p){ return p.id===uid; })[0]||{}; }
  function pname(uid){ var p=person(uid); var n=isAr()?(p.name_ar||p.full_name):(p.full_name||p.name_ar); return n||p.email||'—'; }
  function dname(d){ return d?(isAr()?(d.name_ar||d.name_en):d.name_en):'—'; }
  function memberName(mid){ var m=(S.members||[]).filter(function(x){ return x.id===mid; })[0]; return m?pname(m.user_id):'—'; }

  /* one write, one answer: the database's refusal in words, or "not saved" when no row came back */
  function write(q,okText){
    S.msg=null; S.err=false;
    q.select().then(function(r){
      if(r.error){ S.msg=said(r.error.message); S.err=true; }
      else if(!r.data||!r.data.length){ S.msg=fl('Not saved — the database did not accept the change.','لم يُحفظ — لم تقبل قاعدة البيانات التغيير.'); S.err=true; }
      else { S.msg=okText; S.err=false; }
      S.members=null; load();
    }).catch(function(e){ S.msg=said(e&&e.message||e); S.err=true; paint(); });
  }
  window.v110SetDept=function(mid,dep){ var c=client(); if(!c) return; write(c.from('team_members').update({department_id:dep}).eq('id',mid),fl('Department changed. Recorded in Activity & Audit.','تم تغيير القسم. سُجّل في السجل.')); };
  window.v110SetActive=function(mid,on){ var c=client(); if(!c) return; write(c.from('team_members').update({active:!!on}).eq('id',mid),on?fl('Made active. Recorded in Activity & Audit.','أصبح نشطًا. سُجّل في السجل.'):fl('Made inactive — they stay in the history. Recorded in Activity & Audit.','أصبح غير نشط — ويبقى في السجل. سُجّل في السجل.')); };
  window.v110SetHead=function(did,mid){ var c=client(); if(!c) return; write(c.from('departments').update({head_member_id:mid||null}).eq('id',did),fl('Head set. Recorded in Activity & Audit.','تم تعيين الرئيس. سُجّل في السجل.')); };
  window.v110Add=function(){
    var c=client(); if(!c) return;
    var u=(document.getElementById('v110AddWho')||{}).value, d=(document.getElementById('v110AddDep')||{}).value;
    if(!u||!d){ S.msg=fl('Choose a login and a department first.','اختر حساب دخول وقسمًا أولًا.'); S.err=true; paint(); return; }
    write(c.from('team_members').insert({user_id:u,department_id:d,active:true}),fl('Added to the team list. Recorded in Activity & Audit.','أُضيف إلى قائمة الفريق. سُجّل في السجل.'));
  };

  function depOptions(sel){
    return (S.deps||[]).filter(function(d){ return d.active||d.id===sel; }).map(function(d){ return '<option value="'+esc(d.id)+'"'+(d.id===sel?' selected':'')+'>'+esc(dname(d))+'</option>'; }).join('');
  }
  function html(){
    if(S.members==null) return '<div class="card" style="padding:18px;color:var(--muted)">'+fl('Loading the team list…','جارٍ تحميل قائمة الفريق…')+'</div>';
    var heads={}; (S.deps||[]).forEach(function(d){ if(d.head_member_id)(heads[d.head_member_id]=heads[d.head_member_id]||[]).push(dname(d)); });
    var list=(S.members||[]).slice().sort(function(a,b){ return (b.active-a.active)||pname(a.user_id).localeCompare(pname(b.user_id)); });
    var h='<h3 class="finh" style="margin:0 0 3px">'+fl('Team list','قائمة الفريق')+'</h3>'+
      '<div class="ch-sub" style="margin-bottom:10px">'+fl(
        'Who is on the team (one entry per person, even with two logins), their department, who heads each department, and who is active. Only an admin or a manager can change it — the database refuses anyone else — and every change is recorded in Activity & Audit. Someone who leaves is made inactive, never removed, so their history stays.',
        'من في الفريق (إدخال واحد لكل شخص، حتى لو كان له حسابا دخول)، وقسمه، ومن يرأس كل قسم، ومن هو نشط. لا يغيّرها إلا المسؤول أو المدير — وقاعدة البيانات ترفض غيرهما — وكل تغيير يُسجَّل في السجل. من يغادر يصبح غير نشط ولا يُحذف، فيبقى تاريخه.')+'</div>';
    if(S.msg) h+='<div data-v110-msg="'+(S.err?'err':'ok')+'" style="margin:0 0 10px;padding:9px 12px;border-radius:.6rem;font-size:13px;background:'+(S.err?'#FDECEC':'#EAF6EE')+';color:'+(S.err?'#9B1C1C':'#1E6B3A')+'">'+esc(S.msg)+'</div>';
    h+='<div class="card" style="padding:0;overflow-x:auto"><table class="tbl" data-v110-list="1" style="width:100%;border-collapse:collapse;font-size:13px">'+
      '<thead><tr><th style="text-align:start;padding:9px 12px">'+fl('Person','الشخص')+'</th><th style="text-align:start;padding:9px 12px">'+fl('Department','القسم')+'</th><th style="text-align:start;padding:9px 12px">'+fl('Status','الحالة')+'</th></tr></thead><tbody>';
    list.forEach(function(m){
      var p=person(m.user_id);
      h+='<tr data-v110-member="'+esc(m.id)+'" style="border-top:1px solid var(--line,#EDE2DA)'+(m.active?'':';opacity:.65')+'">'+
        '<td style="padding:8px 12px"><div style="font-weight:600">'+esc(pname(m.user_id))+'</div><div style="font-size:11.5px;color:var(--muted)">'+esc(p.email||'')+'</div>'+
          (heads[m.id]?'<div style="font-size:11.5px;margin-top:2px"><span class="tag">'+fl('Heads ','يرأس ')+esc(heads[m.id].join(', '))+'</span></div>':'')+'</td>'+
        '<td style="padding:8px 12px"><select class="inp" style="min-width:150px" onchange="v110SetDept(\''+esc(m.id)+'\',this.value)">'+depOptions(m.department_id)+'</select></td>'+
        '<td style="padding:8px 12px">'+(m.active?
          '<span class="tag" style="background:#EAF6EE;color:#1E6B3A">'+fl('Active','نشط')+'</span> <button class="btn sm" onclick="v110SetActive(\''+esc(m.id)+'\',false)">'+fl('Make inactive','اجعله غير نشط')+'</button>':
          '<span class="tag">'+fl('Inactive','غير نشط')+(m.left_on?' · '+esc(m.left_on):'')+'</span> <button class="btn sm" onclick="v110SetActive(\''+esc(m.id)+'\',true)">'+fl('Make active','اجعله نشطًا')+'</button>')+'</td></tr>';
    });
    if(!list.length) h+='<tr><td colspan="3" style="padding:14px;color:var(--muted)">'+fl('Nobody is on the team list yet.','لا أحد في قائمة الفريق بعد.')+'</td></tr>';
    h+='</tbody></table></div>';

    /* who heads what — a head must be an active person on the list (the database checks it too) */
    var active=list.filter(function(m){ return m.active; });
    h+='<h4 style="margin:16px 0 6px;font-size:14px">'+fl('Department heads','رؤساء الأقسام')+'</h4><div class="card" style="padding:10px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px" data-v110-heads="1">';
    (S.deps||[]).filter(function(d){ return d.active; }).forEach(function(d){
      var parent=(S.deps||[]).filter(function(x){ return x.id===d.parent_id; })[0];
      h+='<label style="font-size:12.5px"><div style="font-weight:600;margin-bottom:3px">'+esc(dname(d))+(parent?' <span style="font-weight:400;color:var(--muted)">· '+fl('under ','تحت ')+esc(dname(parent))+'</span>':'')+'</div>'+
        '<select class="inp" data-v110-head="'+esc(d.code)+'" onchange="v110SetHead(\''+esc(d.id)+'\',this.value)"><option value="">'+fl('— nobody —','— لا أحد —')+'</option>'+
        active.map(function(m){ return '<option value="'+esc(m.id)+'"'+(m.id===d.head_member_id?' selected':'')+'>'+esc(pname(m.user_id))+'</option>'; }).join('')+
        (d.head_member_id&&!active.some(function(m){ return m.id===d.head_member_id; })?'<option selected value="'+esc(d.head_member_id)+'">'+esc(memberName(d.head_member_id))+'</option>':'')+
        '</select></label>';
    });
    h+='</div>';

    /* add someone — only active logins that are not on the list yet */
    var onList={}; (S.members||[]).forEach(function(m){ onList[m.user_id]=1; });
    var free=(S.people||[]).filter(function(p){ return p.active&&!onList[p.id]; }).sort(function(a,b){ return String(a.full_name||a.email).localeCompare(String(b.full_name||b.email)); });
    h+='<h4 style="margin:16px 0 6px;font-size:14px">'+fl('Add someone to the team list','إضافة شخص إلى قائمة الفريق')+'</h4>';
    if(!free.length) h+='<div style="font-size:12.5px;color:var(--muted)" data-v110-add-none="1">'+fl('Every active login is already on the list — a new person needs a login first (Team & Access → invite).','كل حسابات الدخول النشطة موجودة في القائمة — يحتاج الشخص الجديد إلى حساب دخول أولًا.')+'</div>';
    else h+='<div class="card" style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select class="inp" id="v110AddWho" style="min-width:220px"><option value="">'+fl('Choose a login…','اختر حساب دخول…')+'</option>'+
      free.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc((isAr()?(p.name_ar||p.full_name):(p.full_name||p.name_ar))||p.email)+' · '+esc(p.email||'')+'</option>'; }).join('')+
      '</select><select class="inp" id="v110AddDep" style="min-width:150px">'+depOptions((S.deps||[]).filter(function(d){ return d.code==='commercial'; }).map(function(d){ return d.id; })[0])+'</select>'+
      '<button class="btn pri sm" onclick="v110Add()">'+fl('Add','إضافة')+'</button>'+
      '<div style="flex-basis:100%;font-size:11.5px;color:var(--muted)">'+fl('One person, one entry: if this login is a second login of someone already on the list, do not add it.','شخص واحد، إدخال واحد: إن كان هذا الحساب حسابًا ثانيًا لشخص موجود في القائمة فلا تضفه.')+'</div></div>';
    return h;
  }

  function paint(){
    try{
      if(typeof current==='undefined'||current!=='settings') return;
      var view=document.getElementById('view'); if(!view) return;
      var host=document.getElementById('v110Host');
      if(!canManage()){ if(host) host.remove(); return; }
      if(!host){
        host=document.createElement('div'); host.id='v110Host'; host.style.cssText='margin-top:16px';
        var ax=document.getElementById('axHost'); if(ax&&ax.parentNode===view) view.insertBefore(host,ax); else view.appendChild(host);
      }
      if(S.members==null) load();
      host.innerHTML=html();
    }catch(e){ console.warn('[team-list] paint',e); }
  }
  window.__v110Paint=paint;   /* for the probe: draw now, whatever page the role is allowed to be on */
  window.v110Refresh=function(){ S.members=null; S.msg=null; load(); };

  try{
    var iv=setInterval(function(){
      if(typeof render!=='function') return;
      clearInterval(iv);
      var _r=render;
      render=function(){ var o=_r.apply(this,arguments); try{ setTimeout(paint,70); }catch(_){} return o; };
    },200);
  }catch(_){}
  console.info('%c[team-list] Team & Access → team list loaded','color:#175CD3;font-weight:700');
}catch(e){ if(window.console) console.warn('[team-list] init',e); }})();
