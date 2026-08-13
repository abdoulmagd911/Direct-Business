/* v66 — AUTOMATIC finance ↔ client linking (owner order 2026-08-13: "nothing manual").
   Whenever the finance ledger is loaded, every invoice group that is not linked to a
   client yet is matched against the businesses list by normalised name (Arabic + English,
   company words stripped). Exact matches are linked automatically and saved to
   finance_client_links with confirmed_by='auto-match'. Groups whose rows are all B2C
   individuals are auto-marked "Individuals / not a client". No employee ever has to open
   a mapping screen — the old manual button is hidden (the modal still exists as a
   fallback for true edge cases, reachable from the unlinked warning).
   Safety: only exact normalised name matches are linked — near-misses stay unlinked and
   visible, per the no-cross-company-merging rule. Additive layer, reversible. */
(function(){try{
  var attempted={};   // group → true, so we never hammer the API for the same group twice a session
  var busy=false;

  function norm(s){
    s=String(s==null?'':s).toLowerCase();
    // unify Arabic letter variants, strip diacritics/tatweel
    s=s.replace(/[أإآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ً-ْـ]/g,'');
    // drop punctuation
    s=s.replace(/[&.,'’`"()\/\\\-_+·|]/g,' ');
    // drop generic company words (EN + AR)
    var stop=['company','co','ltd','llc','inc','corp','corporation','group','holding','est','establishment','trading','for','the','and','of',
              'شركه','شركة','مؤسسه','مؤسسة','مجموعه','مجموعة','قابضه','قابضة','التجاريه','التجارية','المحدوده','المحدودة','وشركاه','وأولاده','واولاده'];
    var toks=s.split(/\s+/).filter(function(t){return t&&stop.indexOf(t)<0;});
    return toks.join(' ').trim();
  }

  function bizIndex(){
    var ix={};
    (((typeof DB!=='undefined')&&DB.businesses)||[]).forEach(function(b){
      [b.name,b.nameAr].forEach(function(n){
        var k=norm(n); if(k&&k.length>=4&&!ix[k])ix[k]=b;
      });
    });
    return ix;
  }

  function canEdit(){ try{ return window.canFinEdit?canFinEdit():false; }catch(_){ return false; } }
  function client(){ try{ return window.fc?fc():null; }catch(_){ return null; } }

  function pass(){
    if(busy||!canEdit())return;
    var FIN=window.FIN; if(!FIN||!FIN.rows)return;
    if(!((typeof DB!=='undefined')&&DB.businesses&&DB.businesses.length))return;
    var linkBy=FIN.linkByGroup||{};
    // collect candidate groups: not linked, not already attempted
    var groups={};
    (FIN.rows||[]).forEach(function(r){
      if(r.deleted_at)return; var g=r.client_group; if(!g)return;
      var l=linkBy[g];
      if(l&&(l.business_id||l.is_client===false))return;   // already linked
      if(attempted[g])return;
      (groups[g]=groups[g]||{b2b:0,b2c:0});
      if(r.record_type==='b2c')groups[g].b2c++; else groups[g].b2b++;
    });
    var names=Object.keys(groups); if(!names.length)return;
    var ix=bizIndex(), todo=[];
    names.forEach(function(g){
      attempted[g]=true;
      var info=groups[g];
      if(info.b2c>0&&info.b2b===0){ todo.push({g:g,indiv:true}); return; }   // pure individuals
      var b=ix[norm(g)];
      if(b)todo.push({g:g,biz:b});
      // no match → stays unlinked and visible; a human decides (edge case only)
    });
    if(!todo.length)return;
    var c=client(); if(!c)return;
    busy=true;
    var i=0,linked=0;
    (function next(){
      if(i>=todo.length){
        busy=false;
        if(linked){
          try{ if(window.clearFinCanon)clearFinCanon(); }catch(_){}
          try{ if(typeof toast==='function')toast((typeof LANG!=='undefined'&&LANG==='ar')?('تم ربط '+linked+' مجموعة فواتير بعملائها تلقائيًا'):(linked+' invoice group'+(linked>1?'s':'')+' linked to clients automatically')); }catch(_){}
          try{ if(typeof current!=='undefined'&&current==='finance'&&typeof render==='function')render(); }catch(_){}
        }
        return;
      }
      var t=todo[i++]; var now=new Date().toISOString();
      var payload={client_group:t.g,updated_at:now,confirmed_by:'auto-match',confirmed_at:now};
      if(t.indiv){ payload.business_id=null; payload.is_client=false; }
      else { payload.business_id=(window.__bizUuid?__bizUuid(t.biz.id):t.biz.id); payload.is_client=true; }
      c.from('finance_client_links').upsert(payload,{onConflict:'client_group'}).then(function(r){
        if(!r||!r.error){
          linked++;
          FIN.linkByGroup=FIN.linkByGroup||{}; FIN.linkByGroup[t.g]=payload;
          FIN.links=(FIN.links||[]).filter(function(l){return l.client_group!==t.g;}).concat([payload]);
          if(payload.business_id){ FIN.groupsByBiz=FIN.groupsByBiz||{}; (FIN.groupsByBiz[payload.business_id]=FIN.groupsByBiz[payload.business_id]||[]).push(t.g); }
        }
        next();
      });
    })();
  }

  // hide the old manual button — linking is automatic now (modal stays as a fallback)
  function hideManualBtn(){ try{ var b=document.getElementById('v53btn'); if(b)b.style.display='none'; }catch(_){} }

  try{
    var _r=window.render;
    window.render=function(){
      var out=_r.apply(this,arguments);
      try{ [250,900,1700].forEach(function(d){setTimeout(hideManualBtn,d);}); setTimeout(pass,400); }catch(_){}
      return out;
    };
  }catch(_){}
  // also run shortly after load and on a slow heartbeat (catches imports finishing off-screen)
  [1200,4000].forEach(function(d){setTimeout(function(){hideManualBtn();pass();},d);});
  setInterval(function(){hideManualBtn();pass();},15000);

  console.info('%c[v66] automatic finance↔client linking loaded','color:#0F6E56;font-weight:700');
}catch(e){if(window.console)console.warn('[v66] init',e);}})();
