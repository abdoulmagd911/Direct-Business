/* js/96-a-supplier-we-are-leaving-keeps-its-name.js — fire #182, 2026-09-20.

   Direct is phasing out three suppliers. Until today the app expressed that by DELETING their
   names: core-10 wrapped render() and, on every single render, walked every <select> in the whole
   document and removed any option whose text matched one of the three.

   Driven against the live database, that showed up as:
     · the "Provider / GDS" box opened with 24 suppliers including Dnata, and ONE render() later
       held 23 — the supplier disappeared out of an open form with nothing said;
     · a plain box holding four options kept one;
     · and a record already recorded against that supplier read back as an EMPTY provider, because
       a <select> handed a value with no matching option reports nothing. A Save would have written
       the blank over the real supplier. That is the exact hazard check-structure already guards
       for new dropdowns; this one was doing it to every dropdown at once.

   Meanwhile the Providers page still lists all three as ordinary suppliers, and the verdict card
   above it says plainly that they are being phased out. Three surfaces, three answers.

   What this layer does instead — mark, don't delete:
     · the option keeps its name and gains "— being phased out" (Arabic: «— قيد الإيقاف التدريجي»);
     · it is `disabled`, so nobody picks it for new work. NOT `hidden` — the OS dropdown shows
       hidden options anyway, which is why check-structure forbids that;
     · if it is the value the record ALREADY holds, it stays enabled and selected, so editing an
       old booking does not quietly blank its supplier;
     · the list on the Providers page says the same thing the verdict card above it says.

   The names come from core-10's own verdict table via window.DT_PROVIDERS_PHASING_OUT — one
   source, so the two cannot drift. If that export is missing this layer does nothing at all.   */
(function () {
  try {
    var MARK = 'data-v96';
    function phasing() {
      try {
        var l = window.DT_PROVIDERS_PHASING_OUT;
        return (l && l.length) ? l.map(function (s) { return String(s).trim().toLowerCase(); }) : [];
      } catch (_) { return []; }
    }
    function ar() { try { return (typeof LANG !== 'undefined' && LANG === 'ar'); } catch (_) { return false; } }
    function suffix() { return ar() ? ' — قيد الإيقاف التدريجي' : ' — being phased out'; }

    function markOptions() {
      var dep = phasing(); if (!dep.length) return;
      var sels = document.querySelectorAll('select'); if (!sels.length) return;
      [].forEach.call(sels, function (sel) {
        var held = String(sel.getAttribute('data-held') || sel.value || '').trim().toLowerCase();
        [].forEach.call(sel.options, function (o) {
          var base = String(o.getAttribute(MARK + '-name') || o.textContent || '').trim();
          if (dep.indexOf(base.toLowerCase()) < 0) return;
          if (!o.getAttribute(MARK + '-name')) o.setAttribute(MARK + '-name', base);
          /* an <option> with no value attribute takes its value FROM its text, so changing the
             label would change what a Save writes. Pin the value to the name first. */
          if (!o.hasAttribute('value')) o.setAttribute('value', base);
          /* the record already sits on this supplier — leave it pickable so a save round-trips */
          var isHeld = (base.toLowerCase() === held) || o.defaultSelected;
          o.disabled = !isHeld;
          o.setAttribute(MARK, isHeld ? 'held' : 'phasing');
          var want = base + suffix();
          if (o.textContent !== want) o.textContent = want;
        });
      });
    }

    /* the Providers list should say what the verdict card above it says */
    function markRows() {
      var dep = phasing(); if (!dep.length) return;
      var cur = null; try { cur = (typeof current !== 'undefined') ? current : null; } catch (_) {}
      if (cur !== 'vendors') return;
      var v = document.getElementById('view'); if (!v) return;
      [].forEach.call(v.querySelectorAll('tbody tr'), function (tr) {
        if (tr.getAttribute(MARK + '-row')) return;
        /* the name is not a whole cell — the cell holds the name element and the type element
           stacked ("DnataGDS/agency" when read as text). Find the leaf that IS the name. */
        var leaves = tr.querySelectorAll('td *');
        for (var i = 0; i < leaves.length; i++) {
          if (leaves[i].children.length) continue;
          var name = String(leaves[i].textContent || '').trim();
          if (dep.indexOf(name.toLowerCase()) < 0) continue;
          var tag = document.createElement('span');
          tag.setAttribute(MARK + '-tag', '1');
          tag.style.cssText = 'display:inline-block;margin-inline-start:6px;background:#FDECEC;color:#A3242C;' +
            'border:1px solid #F2C4C4;border-radius:10px;padding:1px 7px;font-size:10.5px;font-weight:700;white-space:nowrap';
          tag.textContent = ar() ? 'قيد الإيقاف التدريجي' : 'phasing out';
          leaves[i].appendChild(tag);
          tr.setAttribute(MARK + '-row', '1');
          break;
        }
      });
    }

    function pass() { try { markOptions(); } catch (_) {} try { markRows(); } catch (_) {} }

    var _r = window.render;
    if (typeof _r === 'function') {
      window.render = function () {
        var out = _r.apply(this, arguments);
        try { setTimeout(pass, 0); setTimeout(pass, 260); } catch (_) {}
        return out;
      };
    }
    /* forms open without a render of their own, so catch them as they appear */
    var _om = window.openModal;
    if (typeof _om === 'function') {
      window.openModal = function () {
        var out = _om.apply(this, arguments);
        try { setTimeout(pass, 0); setTimeout(pass, 220); } catch (_) {}
        return out;
      };
    }
    try { setTimeout(pass, 1200); } catch (_) {}
    try { window.v96MarkPhasingOut = pass; } catch (_) {}
  } catch (e) { try { console.warn('v96', e); } catch (_) {} }
})();
