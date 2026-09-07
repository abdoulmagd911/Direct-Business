/* 75 — the sync badge tells the truth (2026-09-07, round 64).

   The badge in the top bar read "Live · 44s" with a green dot. It was invented:
   core-09 built it as `'Live · '+Math.floor(Math.random()*50+10)+'s'`, a fresh random number on
   every render, connected to nothing. Found by opening the app with the network cut — the app
   itself behaves well offline (the session holds, all 60 companies render from the device), and
   the only thing on screen that speaks about the connection was cheerfully saying "Live · 58s"
   while nothing had reached the server at all.

   That matters more here than a cosmetic slip. Round 63 changed the app to keep working through a
   dead spot instead of reloading, and told the person to watch for the badge; a badge that always
   says Live makes that instruction worthless, and someone in a hotel with no signal would close
   the tab believing their work was safely away.

   So this layer replaces the badge's text with what actually happened, from three real sources:
     · js/02's status pill, chained through window.__pillHook — "Saved…" means a real round trip
       just completed, "Save issue…" means the last attempt failed;
     · localStorage `db_cloud_ts`, which js/02 writes after every confirmed save, so the age
       survives a reload;
     · navigator.onLine, which settles the case where nothing has been attempted yet.

   Nothing else changes: same element, same place, same shape. Only the words, the dot colour, and
   the fact that they are now true.

   Wording is deliberately plain (owner rule 1 — no jargon): "Synced 2m ago", "Not synced —
   saved on this device", "No connection", "Not synced yet". */
(function () {
  try {
    var AR = function () { try { return typeof LANG !== 'undefined' && LANG === 'ar'; } catch (_) { return false; } };
    var S = { lastOk: null, failing: false };

    /* seed from the last confirmed save of any previous session */
    try { var ts = localStorage.getItem('db_cloud_ts'); if (ts) { var t = Date.parse(ts); if (!isNaN(t)) S.lastOk = t; } } catch (_) { }

    /* Chain, never replace: js/49 installs its own hook here and owns the refusal path.
       Order matters and is load-order, so it holds by construction — js/49 runs first, sees no
       hook, installs its own; this file then wraps it. Reversed, js/49's `if(window.__pillHook)
       return;` would make it skip installing altogether and a refused save would stop being
       announced. Any future layer that wants this hook must chain it the same way, and must not
       be numbered below 49. */
    try {
      var prev = window.__pillHook;
      window.__pillHook = function (text, colour) {
        try {
          var s = String(text || '');
          if (/^Saved/i.test(s)) { S.lastOk = Date.now(); S.failing = false; }
          else if (/^Save (issue|error)/i.test(s)) { S.failing = true; }
        } catch (_) { }
        if (prev) return prev.apply(this, arguments);
      };
    } catch (_) { }

    function ago(ms) {
      var s = Math.round(ms / 1000);
      if (s < 60) return AR() ? ('قبل ' + s + ' ث') : (s + 's ago');
      var m = Math.round(s / 60);
      if (m < 60) return AR() ? ('قبل ' + m + ' د') : (m + 'm ago');
      var h = Math.round(m / 60);
      if (h < 24) return AR() ? ('قبل ' + h + ' س') : (h + 'h ago');
      return AR() ? ('قبل ' + Math.round(h / 24) + ' ي') : (Math.round(h / 24) + 'd ago');
    }

    function state() {
      var offline = false;
      try { offline = navigator.onLine === false; } catch (_) { }
      if (S.failing) return { dot: '#D92D20', text: AR() ? 'غير محفوظ على الخادم — محفوظ على هذا الجهاز' : 'Not synced — saved on this device' };
      if (offline) return { dot: '#B54708', text: AR() ? 'لا يوجد اتصال' : 'No connection' };
      if (S.lastOk) return { dot: '#22C55E', text: (AR() ? 'محفوظ ' : 'Synced ') + ago(Date.now() - S.lastOk) };
      return { dot: '#9AA1B6', text: AR() ? 'لم يُحفظ على الخادم بعد' : 'Not synced yet' };
    }

    function paint() {
      try {
        var p = document.getElementById('v26_3SyncPill'); if (!p) return;
        var st = state();
        /* keep the element's own markup shape — a dot span plus text — so the existing CSS
           (.v26_3-sync-pill .dot) still applies and nothing about the layout moves */
        p.innerHTML = '<span class="dot" style="background:' + st.dot + '"></span>' + st.text;
        p.setAttribute('title', st.text);
      } catch (_) { }
    }
    window.__syncBadgeState = function () { var st = state(); return { text: st.text, dot: st.dot, failing: S.failing, lastOk: S.lastOk }; };

    /* the badge is re-injected by core-09 on every render, so repaint after render as well as
       on a timer (the age has to keep counting up while nobody touches anything) */
    try {
      if (typeof window.render === 'function' && !window.render.__sync75) {
        var _r = window.render;
        var w = function () { var out = _r.apply(this, arguments); try { paint(); setTimeout(paint, 60); } catch (_) { } return out; };
        w.__sync75 = 1; window.render = w;
      }
    } catch (_) { }
    setInterval(paint, 5000);
    try { window.addEventListener('online', paint); window.addEventListener('offline', paint); } catch (_) { }
    setTimeout(paint, 400);
  } catch (e) { if (window.console) console.warn('[75] honest sync badge', e); }
})();
