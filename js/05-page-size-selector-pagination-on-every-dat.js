/* Page-size selector + pagination on every data table (10/20/50/100/All, default 20, remembered per browser) */
(function(){try{
  var KEY='db_pageSize';
  function getSize(){try{return localStorage.getItem(KEY)||'20';}catch(_){return '20';}}
  function setSize(v){try{localStorage.setItem(KEY,v);}catch(_){}}
  function dataRows(tb){return Array.prototype.filter.call(tb.rows,function(r){return r.cells&&r.cells.length>1;});}
  function paginate(tb,size,page){
    var rows=dataRows(tb);var total=rows.length;
    if(size==='All'){rows.forEach(function(r){r.style.display='';});return {pages:1,page:1,total:total,n:total};}
    var n=parseInt(size,10)||20;var pages=Math.max(1,Math.ceil(total/n));page=Math.min(Math.max(1,page),pages);
    rows.forEach(function(r,i){r.style.display=(i>=(page-1)*n&&i<page*n)?'':'none';});
    return {pages:pages,page:page,total:total,n:n};
  }
  function decorate(tbl){
    try{
    if(tbl.__pg)return;
    if(tbl.closest&&tbl.closest('.v32-svc'))return; // the income-by-service rollup manages its own row visibility (family expand/collapse)
    var tb=tbl.tBodies&&tbl.tBodies[0]; if(!tb)return;
    if(dataRows(tb).length<=10)return;            // small tables don't need a pager
    tbl.__pg=true; tbl.__page=1;
    var bar=document.createElement('div'); bar.className='pg-bar';
    bar.style.cssText='display:flex;align-items:center;gap:10px;justify-content:flex-end;margin:10px 2px 4px;font-size:12.5px;color:var(--muted,#7C8194);flex-wrap:wrap';
    var lbl=document.createElement('span');
    var sel=document.createElement('select'); sel.className='pg-size';
    sel.style.cssText='background:rgba(255,255,255,.04);color:inherit;border:1px solid rgba(255,255,255,.16);border-radius:7px;padding:3px 7px;font-size:12px';
    ['10','20','50','100','All'].forEach(function(o){var op=document.createElement('option');op.value=o;op.textContent=(o==='All'?'Show all':o+' / page');if(o===getSize())op.selected=true;sel.appendChild(op);});
    var prev=document.createElement('button'); prev.type='button'; prev.textContent='‹ Prev'; prev.className='pg-prev';
    var next=document.createElement('button'); next.type='button'; next.textContent='Next ›'; next.className='pg-next';
    [prev,next].forEach(function(bn){bn.style.cssText='padding:3px 11px;font-size:12px;border-radius:7px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:inherit;cursor:pointer';});
    bar.appendChild(lbl);bar.appendChild(sel);bar.appendChild(prev);bar.appendChild(next);
    var anchor=tbl.closest('.tbl-wrap')||tbl; if(anchor.parentNode)anchor.parentNode.insertBefore(bar,anchor.nextSibling);
    function refresh(){var sz=getSize();var st=paginate(tb,sz,tbl.__page||1);tbl.__page=st.page;
      var from=st.total===0?0:((st.page-1)*st.n+1);var to=(sz==='All')?st.total:Math.min(st.page*st.n,st.total);
      lbl.textContent='Showing '+from+'–'+to+' of '+st.total;
      prev.disabled=(st.page<=1);next.disabled=(st.page>=st.pages);prev.style.opacity=prev.disabled?'.4':'1';next.style.opacity=next.disabled?'.4':'1';
    }
    sel.addEventListener('change',function(){setSize(sel.value);
      document.querySelectorAll('select.pg-size').forEach(function(s){s.value=sel.value;});
      document.querySelectorAll('table').forEach(function(t){if(t.__pg){t.__page=1;if(t.__refresh)t.__refresh();}});
    });
    prev.addEventListener('click',function(){tbl.__page=Math.max(1,(tbl.__page||1)-1);refresh();});
    next.addEventListener('click',function(){tbl.__page=(tbl.__page||1)+1;refresh();});
    tbl.__refresh=refresh; refresh();
    }catch(_){}
  }
  function scan(){try{document.querySelectorAll('table').forEach(decorate);}catch(_){}}
  var iv=setInterval(function(){if(typeof render==='function'){clearInterval(iv);try{var _r=render;render=function(){var o=_r.apply(this,arguments);try{scan();}catch(_){}setTimeout(scan,30);return o;};}catch(_){}scan();}},200);
  setTimeout(scan,1500);setTimeout(scan,3000);
}catch(e){console.warn('pager',e);}})();
