/* js/100-a-tap-beside-the-tick-box-counts.js — fire #191, 2026-09-21.

   Driven at phone width (390 px, touch) against the live database, over every page this session
   touched. The pages themselves hold up: nothing scrolls sideways, the wide tables scroll inside
   their own boxes as designed, and there are no JS errors in either language.

   What does not hold up is the row-selection column on Leads and Suppliers.

     · the tick box itself is **13 × 13 px** — the browser default, never styled. The pager in
       js/04 raised its own controls to a 26 px floor precisely because "these are the controls the
       team hits most on a long list from a phone"; this is half of that.
     · the cell around it is a comfortable **52 × 59 px** and carries
       `onclick="event.stopPropagation()"` — put there so a stray tap does not open the record,
       which is the right instinct. But stopping the row handler is ALL it does.

   So there is a 52 × 59 target that looks tappable, swallows the tap, and does nothing. Miss the
   13 px square and nothing happens at all: no tick, no navigation, no feedback. You cannot tell a
   miss from a slow app, so you tap again.

   The fix is the smallest one that exists: make the cell that is already absorbing the tap perform
   the obvious action. Nothing moves, nothing is restyled, no CSS is added — the effective target
   simply becomes the 52 × 59 px that was already there, which clears the project's own 26 px floor
   four times over.

   Delegated on the document rather than written into the two markup sites (js/core/core-10 for
   Leads, js/core/core-05 for Suppliers), so a third checkbox column gets it for nothing, and the
   row markup stays as it is.

   Careful about the obvious double-fire: a tap ON the box must not be toggled twice. The handler
   returns immediately when the tap landed on the input (or a label already wired to it).      */
(function () {
  try {
    function boxIn(cell) {
      try {
        var b = cell.querySelector('input[type="checkbox"]');
        return (b && !b.disabled) ? b : null;
      } catch (_) { return null; }
    }

    document.addEventListener('click', function (ev) {
      try {
        var t = ev.target;
        if (!t || !t.closest) return;
        /* the tap landed on the control itself, or a label that already drives it — leave it alone */
        if (t.tagName === 'INPUT' || t.tagName === 'LABEL' || t.closest('label')) return;
        var cell = t.closest('td, th');
        if (!cell) return;
        var box = boxIn(cell);
        if (!box) return;
        /* only a cell whose ENTIRE job is the tick box: anything else in it means the tap may have
           been meant for that instead, and guessing would be worse than doing nothing */
        if (cell.querySelectorAll('input,select,textarea,button,a[href]').length !== 1) return;
        if ((cell.textContent || '').trim().length) return;
        box.click();          /* toggles AND runs the box's own onclick — one path, not two */
        ev.preventDefault();
      } catch (_) {}
    }, true);
  } catch (e) { try { console.warn('v100', e); } catch (_) {} }
})();
