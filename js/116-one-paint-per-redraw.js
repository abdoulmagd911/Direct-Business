/* ===== 116 · One paint per redraw (speed, finding B of the oversight's list, 2026-09-27) =====

   Measured live on Today as the QA account: the page JUMPED 24-33 times while it loaded (a layout-shift score of about
   1.0; under 0.1 counts as good), and oversight measured 42 jumps. The cause, read from the browser's own shift records
   and a log of what was added when: every redraw (render()) writes the page, and then the layers that add their pieces —
   the note under Today's figures (js/84), the quick-create bar, the Today hub, "Your day", the section heads, the menu
   buttons — do it a moment LATER, from short timers (0-150 ms) they set as the redraw ran. The browser paints in between:
   first the bare page, then the page with each piece pushed in above the rest. Every redraw painted two or three times,
   and Today redraws several times while its data arrives.

   The fix, here and nowhere else: from the moment a redraw starts until the browser's next chance to paint (the end of
   the task that called render(), before any drawing), the short timers set (SHORT ms or less) are remembered; then they
   run at once, in the order and with the spacing they asked for (one set for 60 ms runs before one set for 150 ms; one
   that sets another runs that one in its turn). So a redraw is painted ONCE, finished. Nothing is hidden, nothing skipped:
     · only timers set while a redraw is in that window, and only short ones — anything longer (a retry in 3 s) stays a
       real timer, untouched;
     · a timer cancelled before its turn (clearTimeout) does not run;
     · each one also stays a real timer until it runs, so if anything went wrong here it would still run on its own;
     · a timer that keeps setting itself again is run here only up to SHORT ms of simulated time — a polling loop cannot
       spin here — and the real timers carry on as before;
     · an error inside one reaches the page exactly as before (thrown on its own), and the rest still run.
   Why "until the end of the task" and not "until render() returns": render() is wrapped by some forty layers, and the
   ones that attach AFTER this file (js/84 attaches 200 ms after load, others later) sit outside this wrapper and set their
   timers after it has returned — but in the same task. Where this wrapper sits in the stack therefore does not matter. */
(function(){try{
  if(window.__v116) return; window.__v116=true;
  var SHORT=250, MAX_RUNS=400;
  var realST=window.setTimeout, realCT=window.clearTimeout;
  var later=(typeof queueMicrotask==='function')?queueMicrotask:function(f){ Promise.resolve().then(f); };
  var queue=null, vnow=0, seq=0;
  window.setTimeout=function(fn,ms){
    if(queue&&typeof fn==='function'){
      var d=+ms||0;
      if(d<=SHORT){
        var args=Array.prototype.slice.call(arguments,2);
        var e={fn:fn,args:args,at:vnow+d,seq:seq++,done:false};
        e.id=realST(function(){ if(!e.done){ e.done=true; fn.apply(window,e.args); } },d);
        queue.push(e);
        return e.id;
      }
    }
    return realST.apply(window,arguments);
  };
  window.clearTimeout=function(id){
    if(queue) for(var i=0;i<queue.length;i++){ if(queue[i].id===id) queue[i].done=true; }
    return realCT(id);
  };
  function flush(){
    var runs=0;
    for(;;){
      var next=null;
      for(var i=0;i<queue.length;i++){ var e=queue[i]; if(!e.done&&e.at<=SHORT&&(!next||e.at<next.at||(e.at===next.at&&e.seq<next.seq))) next=e; }
      if(!next||++runs>MAX_RUNS) break;
      next.done=true; realCT(next.id); vnow=next.at;
      try{ next.fn.apply(window,next.args); }catch(err){ realST(function(){ throw err; },0); }
    }
  }
  function begin(){
    if(queue) return;                 // already collecting for this task
    queue=[]; vnow=0; seq=0;
    later(function(){ try{ flush(); }catch(_){} queue=null; vnow=0; });
  }
  function wrap(){
    var inner=window.render;
    if(typeof inner!=='function'||inner.__v116) return;
    var w=function(){ begin(); return inner.apply(this,arguments); };
    w.__v116=true;
    window.render=w;
  }
  wrap();
  /* until render() exists (it always does by this file's slot; kept for safety) */
  if(typeof window.render!=='function'){ var n=0, iv=setInterval(function(){ n++; wrap(); if(window.render&&window.render.__v116||n>60) clearInterval(iv); },250); }
  window.__v116Wrap=wrap;
}catch(e){ if(window.console) console.warn('[v116] one paint per redraw',e); }})();
