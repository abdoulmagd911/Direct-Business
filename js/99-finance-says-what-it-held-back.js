/* js/99-finance-says-what-it-held-back.js — fire #190, 2026-09-21.

   The Finance header reads "46 invoices · data through 2026-08-20". Driven against the live
   database, the page had **91 rows in memory and was dropping 45 of them** from every figure on the
   page — revenue, cost, profit, the client tables, the report builder — and said nothing at all.
   The words "excluded", "held back" and "deleted" appeared nowhere on it.

   Of the 45: **10 carry a recorded reason** (the Takamol / Techtic verification revenue, which
   CLAUDE.md says is accounted for in another system and must never appear here — correctly held
   back), and **35 carry no reason at all**, soft-deleted during the August data work.

   This is M39 applied to the page where it matters most: *when a computed figure excludes rows, the
   count it used goes in the label and the count it dropped is explained once underneath.* The tile
   beside Leads learned it in #181; Finance never had.

   Deliberately NOT built here: any way to restore one. These are money records and bringing one
   back is the owner's decision, not a session's — the honest thing is to say they exist and let him
   ask. The sentence says they are still in the database, so a nought is never read as a loss.

   Costs no extra query: the rows are already in memory (the loader fetches every row and filters
   afterwards), so this only reports what the page already knows and was not saying.            */
(function () {
  try {
    var ID = 'v99-heldback';
    function ar() { try { return (typeof LANG !== 'undefined' && LANG === 'ar'); } catch (_) { return false; } }
    function onFinance() { try { return (typeof current !== 'undefined') && current === 'finance'; } catch (_) { return false; } }

    function counts() {
      try {
        var rows = (window.FIN && FIN.rows) ? FIN.rows : null;
        if (!rows || !rows.length) return null;              /* not loaded — say nothing */
        var held = rows.filter(function (r) { return !!r.deleted_at; });
        if (!held.length) return null;                        /* nothing held back — no apology */
        var withReason = held.filter(function (r) {
          return !!(r.exclusion_reason && String(r.exclusion_reason).trim());
        }).length;
        return { total: held.length, withReason: withReason, without: held.length - withReason };
      } catch (_) { return null; }
    }

    function sentence(c) {
      if (ar()) {
        return c.total + ' سجل مالي محجوب عن هذه الصفحة ولا يدخل في أي رقم فيها — '
          + c.withReason + ' منها بسبب مُسجَّل و' + c.without + ' بلا سبب مُسجَّل. '
          + 'ما زالت موجودة في قاعدة البيانات؛ لم يُحذف شيء نهائيًا.';
      }
      /* 2026-09-24 (Build lane sweep): this sentence said "the figures above" while pass() puts it
         at the TOP of the page, above every figure it describes. "on this page" is true wherever it sits. */
      return c.total + ' finance records are held back from this page and are in none of the figures '
        + 'on this page — ' + c.withReason + ' with a reason recorded and ' + c.without + ' with none. '
        + 'They are still in the database; nothing has been erased.';
    }

    function pass() {
      var v = document.getElementById('view'); if (!v) return;
      var had = document.getElementById(ID);
      var c = onFinance() ? counts() : null;
      if (!c) { if (had) { try { had.remove(); } catch (_) {} } return; }
      if (had && had.getAttribute('data-n') === String(c.total) && had.getAttribute('data-ar') === (ar() ? '1' : '0')) return;
      if (had) { try { had.remove(); } catch (_) {} }
      var d = document.createElement('div');
      d.id = ID;
      d.setAttribute('data-n', String(c.total));
      d.setAttribute('data-ar', ar() ? '1' : '0');
      d.setAttribute('data-with-reason', String(c.withReason));
      d.setAttribute('data-without-reason', String(c.without));
      d.style.cssText = 'margin:0 0 12px;padding:8px 12px;border-radius:9px;background:#F6F7F9;' +
        'border:1px solid #E6E8EC;color:#5b6178;font-size:12px;line-height:1.6';
      d.textContent = sentence(c);
      v.insertBefore(d, v.firstChild);
    }

    var _r = window.render;
    if (typeof _r === 'function') {
      window.render = function () {
        var out = _r.apply(this, arguments);
        try { setTimeout(pass, 0); setTimeout(pass, 400); } catch (_) {}
        return out;
      };
    }
    /* the ledger loads on its own timer and the tabs redraw without a full render — one bounded
       recurring check catches the load, then the render wrapper carries it (the js/98 lesson: a
       timer that never stops has no place in an app people leave open all day) */
    try {
      var tries = 0;
      var iv = setInterval(function () {
        try { pass(); } catch (_) {}
        var loaded = false;
        try { loaded = !!(window.FIN && FIN.rows && FIN.rows.length); } catch (_) {}
        if (loaded || ++tries > 120) { try { clearInterval(iv); } catch (_) {} }
      }, 1500);
    } catch (_) {}
    try { window.v99HeldBackPass = pass; } catch (_) {}
  } catch (e) { try { console.warn('v99', e); } catch (_) {} }
})();
