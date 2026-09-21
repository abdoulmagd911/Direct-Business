/* js/98-the-generator-says-when-you-may-only-look.js — fire #184, 2026-09-20.

   "Generator" is one of the fifteen pages in the owner's Team & Access matrix, and each person
   can be set to Viewer or Editor on it. Driven live with the matrix saying **Viewer**, all five
   editors offered "Save draft" AND "Issue …":

       Financial proposal      Save draft · Issue offer            18 editable fields
       Service fees            Save draft · Issue proposal         17
       Technical + financial   Save both drafts · Issue technical · Issue financial   54
       Company profile         Save draft · Issue profile           3
       Contract                Save draft · Issue contract         28

   and nothing on screen said otherwise. "Issue" is not a draft: it takes a document number from
   the server and puts a document out under Direct's name. The database does not enforce this page
   — only Finance, Settings and Activity are enforced there, which the access-matrix layer says in
   its own header — so the screen IS the enforcement, and it was not enforcing.

   js/66 through js/71 now ask `mayEditPage('documents')` as well as the role, so the buttons are
   gone. This layer supplies the other half: a button that vanishes with no explanation is its own
   small mystery, so the page says, once, why.

   Deliberately narrow: it speaks only on the Generator, only when the matrix has actually loaded
   and actually says Viewer. While the matrix is still in flight `mayEditPage` answers true, and
   this says nothing — an apology shown during a slow load would be wrong more often than right.

   Measured the same day and worth writing down: NOBODY is set to Viewer on any page today. Every
   entry in the live matrix is Editor, so nothing was wrong on anyone's screen — the setting was
   simply waiting to mislead the first time it was used. Nine other pages still ignore it; that is
   recorded for the owner in docs/BACKLOG.md rather than fixed blind from here.                 */
(function () {
  try {
    var ID = 'v98-viewonly';
    function ar() { try { return (typeof LANG !== 'undefined' && LANG === 'ar'); } catch (_) { return false; } }
    function onGenerator() { try { return (typeof current !== 'undefined') && current === 'documents'; } catch (_) { return false; } }
    function viewOnly() {
      try {
        if (typeof window.mayEditPage !== 'function') return false;   /* nothing to honour yet */
        if (window.__pageAccessLoaded !== true) return false;         /* still in flight — say nothing */
        return window.mayEditPage('documents') === false;
      } catch (_) { return false; }
    }

    function pass() {
      var v = document.getElementById('view'); if (!v) return;
      var had = document.getElementById(ID);
      if (!onGenerator() || !viewOnly()) { if (had) { try { had.remove(); } catch (_) {} } return; }
      if (had && had.parentNode === v && v.firstChild === had) return;
      if (had) { try { had.remove(); } catch (_) {} }
      var d = document.createElement('div');
      d.id = ID;
      d.style.cssText = 'margin:0 0 12px;padding:10px 13px;border-radius:10px;background:#FFF8EC;' +
        'border:1px solid #F3DCB4;color:#7a5a17;font-size:13px;line-height:1.65';
      d.textContent = ar()
        ? 'لديك صلاحية الاطّلاع على المولّد فقط. يمكنك فتح أي مستند وطباعته ونسخه، لكن الحفظ والإصدار غير متاحين لك — اطلب من المدير تغيير ذلك في «الفريق والصلاحيات».'
        : 'You have view-only access to the Generator. You can open any document, print it and copy it — saving and issuing are not yours to do. Ask an admin to change it in Team & Access.';
      v.insertBefore(d, v.firstChild);
    }

    var _r = window.render;
    if (typeof _r === 'function') {
      window.render = function () {
        var out = _r.apply(this, arguments);
        try { setTimeout(pass, 0); setTimeout(pass, 300); } catch (_) {}
        return out;
      };
    }
    /* The matrix lands on its own timer, after the page has already drawn, so one recurring check
       is needed to catch that moment. It is BOUNDED: once the matrix has answered the render
       wrapper above covers everything after, and a timer that runs for the life of the page on an
       internal tool people leave open all day is the shape of fire #173. Stops on the answer, and
       gives up after two minutes either way. */
    try {
      var tries = 0;
      var iv = setInterval(function () {
        try { pass(); } catch (_) {}
        var settled = false;
        try { settled = (window.__pageAccessLoaded === true); } catch (_) {}
        if (settled || ++tries > 80) { try { clearInterval(iv); } catch (_) {} }
      }, 1500);
    } catch (_) {}
    try { window.v98ViewOnlyPass = pass; } catch (_) {}
  } catch (e) { try { console.warn('v98', e); } catch (_) {} }
})();
