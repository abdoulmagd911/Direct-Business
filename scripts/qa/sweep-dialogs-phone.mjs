/* sweep-dialogs-phone.mjs (2026-09-07, round 62) — every dialog in the app, on a phone.

   The responsive work in this repo measures PAGES. probe-responsive-finance says so in its own
   header, and probe-phone, probe-search-phone and probe-reports-phone-ar are all page walks. Round
   61 showed what that blind spot costs on the language side: a dialog does not exist until someone
   presses a button, so a walk that presses none cannot see one, and three dialogs in daily use had
   never been looked at in Arabic by anything.

   The same hole exists at phone width, and it is worse there than a page is. A page that overflows
   is ugly; a dialog whose Save button has been pushed off the bottom of a 390px screen cannot be
   completed at all — the agent standing at an airport counter simply cannot save the request. So
   this presses the buttons at 390x844 and, for each dialog that opens, measures the three ways a
   dialog fails on a phone:

     1. it pushes the PAGE sideways — a horizontal scrollbar on the document while a modal is open;
     2. it is WIDER than the screen, or something inside it is, with no scroller to reach the rest;
     3. its SAVE BUTTON cannot be reached — not merely off-screen (the modal is a scroller, so
        off-screen is fine and expected), but still unreachable after the modal is scrolled to the
        bottom, or covered by something else at its own centre point.

   Check 3 is the one that matters and the one an eyeball misses: .modal is max-height:92vh with
   overflow:auto and a position:sticky footer, so the failure is never "the button is missing" —
   it is "the sticky footer stopped sticking", which looks fine in a screenshot taken at the top.
   It is measured by hit-testing the button's own centre AFTER scrolling the modal down, so a
   dialog that merely needs scrolling passes and one that is genuinely unreachable does not.

   Under test:
     1. No dialog makes the document scroll horizontally at 390px.
     2. No dialog, or element inside one, is wider than the screen without a scroller.
     3. Every dialog's Save button is reachable — visible and hit-testable at its own centre.
     4. A control that this sweep can fail: it must have OPENED dialogs. Zero dialogs is a broken
        walk, not a clean app, and it is reported as a failure rather than as a pass.

   Run:  node scripts/qa/sweep-dialogs-phone.mjs        (port 9019)
   Sabotage — attempted, and it did not work, which is the finding. Setting .modal's overflow to
   `hidden` AND .mf's position to `static` — both mechanisms that keep Save reachable — left the
   sweep fully green. Three things defend this property, not two: the modal scrolls, the footer
   sticks, and the browser scrolls a focused control into view even inside a clipped box. No single
   CSS regression reddens check 3, and one earlier version of it could not have failed at all
   (it set .scrollTop itself, which works on an overflow:hidden box that no finger can scroll).
   So the check now proves itself on every run instead: it lays a strip over the bottom of the
   screen and requires the reachability test to report it. Sabotage that: delete the self-test's
   cover element and the run must go red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9019;
const BASE = 'http://localhost:' + PORT;
const VW = 390, VH = 844;                    // iPhone 14/15 CSS pixels — the narrow end of real use
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);

/* Everything below runs in the page. It is deliberately generous about what counts as fine:
   a scrollable ancestor makes a wide child correct, not broken (wide tables are supposed to
   scroll inside their own box), and a Save button below the fold is correct as long as the
   modal can be scrolled to it. */
const MEASURE = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const modal = document.getElementById('modal');
  const out = { pageOverflow: Math.max(0, document.documentElement.scrollWidth - vw), wide: [], save: null, title: '', contentH: 0, boxH: 0 };
  if (!modal) return out;
  out.title = ((modal.querySelector('.mh h3') || {}).textContent || '').trim().slice(0, 50);
  const mr = modal.getBoundingClientRect();
  out.contentH = modal.scrollHeight; out.boxH = Math.round(mr.height);
  if (mr.width > vw + 2) out.wide.push(`the dialog itself (${Math.round(mr.width)}px on a ${vw}px screen)`);
  const scrollableAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) return true;
    }
    return false;
  };
  modal.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (r.right <= mr.right + 2) return;
    if (scrollableAncestor(el)) return;                       // it scrolls inside its own box: fine
    const tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    if (out.wide.length < 6) out.wide.push(`${tag} reaches ${Math.round(r.right - mr.right)}px past the dialog's edge`);
  });
  /* The reachability test. Scroll to the bottom first — the footer is sticky, so a correct dialog
     needs no scrolling at all, and a merely-tall one is fixed by this scroll.

     BUT ONLY WHERE A FINGER COULD SCROLL. Setting .scrollTop on a box succeeds even when its
     computed overflow is `hidden`: the browser clips the paint and still moves the content for
     script. The first version of this check did exactly that, and the consequence was that it
     could not fail — with .modal's overflow sabotaged to hidden AND its footer's sticky removed,
     both mechanisms that make Save reachable gone, the check still passed, because the probe was
     scrolling the dialog in a way no user can. So the scroll is only performed on an ancestor
     whose COMPUTED overflow actually offers it. */
  const btn = document.getElementById('mSave');
  if (btn) {
    const userScrollable = (el) => { const s = getComputedStyle(el); return /(auto|scroll|overlay)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2; };
    for (let e = btn.parentElement; e; e = e.parentElement) {
      if (userScrollable(e)) { e.scrollTop = e.scrollHeight; break; }
      if (e === modal) break;
    }
    /* No scrollIntoView() fallback here on purpose: it scrolls EVERY ancestor, overflow:hidden
       ones included, which is precisely the move that made this check unable to fail. */
    const r = btn.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const onScreen = r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh + 1 && r.left >= 0 && r.right <= vw + 1;
    const hit = document.elementFromPoint(cx, cy);
    const reachable = onScreen && !!hit && (hit === btn || btn.contains(hit) || hit.contains(btn));
    /* Name the whole chain, not just the topmost node: on the first run the one-word answer
       ("div") was not enough to tell an ancestor of the button from something covering it, and
       an unreadable finding is one nobody can act on. */
    const path = []; for (let e = hit; e && path.length < 6; e = e.parentElement) path.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : ''));
    out.save = { reachable, onScreen, vw, vh, rect: { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }, hit: path.join(' < ') || null };
  }
  return out;
};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.dismiss().catch(() => { }));
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  /* Deliberately Arabic, and kept there. The first runs ended up in Arabic by ACCIDENT — a
     Settings card flipped the app half way through the walk — so half the dialogs were measured
     LTR and half RTL and the report said neither. Arabic is the harder case and the one Direct's
     staff actually use, and RTL moves the Save button to the other side of the footer, so it is
     chosen on purpose here and restored whenever a control flips it. */
  const forceAr = async () => { await p.evaluate(() => { try { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); } catch (_) { } }); await p.waitForTimeout(900); };
  await forceAr();

  const PAGES = [
    { name: 'Today', spec: { page: 'today' } },
    { name: 'Leads list', spec: { page: 'leads' } },
    { name: 'Lead detail', spec: { page: 'leads', lead: 'L_alyusr' } },
    { name: 'Client detail', spec: { page: 'leads', lead: 'L_bright' } },
    { name: 'Clients list', spec: { page: 'clients' } },
    { name: 'Finance', spec: { page: 'finance' } },
    { name: 'Ops', spec: { page: 'ops' } },
    { name: 'Documents', spec: { page: 'documents' } },
    { name: 'Settings', spec: { page: 'settings' } },
  ];
  const goPage = async (spec) => {
    await p.evaluate((s) => {
      try { if (typeof closeModal === 'function') closeModal(); } catch (_) { }
      try { document.querySelectorAll('#ov,#modal,.modal-back').forEach((m) => m.classList.remove('show', 'open')); } catch (_) { }
      try { openLead = s.lead || null; current = s.page; render(); } catch (_) { }
    }, spec);
    await p.waitForTimeout(1100);
  };
  /* THE FIRST RUN'S FALSE FINDING, KEPT SO IT CANNOT RECUR. It reported that the Save button of
     23 dialogs could not be reached, naming div.pitem as the thing covering it — and .pitem is
     the COMMAND PALETTE (z-index 80, above the modal's 60). One of the buttons this walk presses
     opens the palette, and closing the modal did not close that; every dialog opened afterwards
     was measured underneath a full-screen overlay the sweep had opened itself. The button really
     was unreachable, in a state no user is ever in.
     So: every overlay is closed between buttons, not just the modal, and the measurement refuses
     to run at all while something other than the dialog is on top — an unmeasured dialog is
     reported as unmeasured, never as clean. */
  const closeAny = async () => {
    await p.evaluate(() => {
      try { if (typeof closeModal === 'function') closeModal(); } catch (_) { }
      try { document.querySelectorAll('#ov,#modal,.v19-palette,.modal-back').forEach((m) => m.classList.remove('show', 'open')); } catch (_) { }
      /* js/31's Team & Access panel is built fresh and REMOVED to close (z-index 2147481600),
         so there is no class to strip — it has to be removed the way its own close button does. */
      try { const v = document.getElementById('v48ov'); if (v) v.remove(); } catch (_) { }
      /* 2026-09-09: the questions that used to be window.confirm now stand in the page (js/57's
         #pfConfirmBox, answered No here so nothing is applied), js/62's results in js/63's notice
         card, and the Share button opens js/77's panel — all three are removed to close. */
      try { const n = document.getElementById('pfConfirmNo'); if (n) n.click(); } catch (_) { }
      try { ['pfConfirmBox', 'v63Notice', 'shareBox'].forEach((id) => { const x = document.getElementById(id); if (x) x.remove(); }); } catch (_) { }
    });
    await p.waitForTimeout(200);
  };
  /* The general form of the same guard, so the NEXT overlay someone adds shows up as
     "not measured" instead of as four confident false findings: ask what is actually on top of
     the dialog's own middle. Anything that is not inside #ov is covering it. */
  const overlayOnTop = () => p.evaluate(() => {
    const m = document.getElementById('modal'); if (!m) return null;
    const r = m.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + Math.min(r.height / 2, window.innerHeight / 2)));
    if (!hit) return null;
    const ov = document.getElementById('ov');
    if (ov && ov.contains(hit)) return null;
    return hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).trim().split(/\s+/)[0] : '');
  }).catch(() => null);

  const pageOverflow = [], tooWide = [], unreachable = [], skipped = [], heights = [];
  let flipped = 0;
  const seen = new Set();
  let opened = 0, tried = 0;

  for (const pg of PAGES) {
    await goPage(pg.spec);
    const n = await p.$$eval('#view button', (els) => els.filter((e) => e.offsetParent !== null).length).catch(() => 0);
    for (let i = 0; i < Math.min(n, 40); i++) {
      /* Skip the language card: this sweep measures geometry, and a walk that silently flips the
         app to Arabic half way through is measuring two different layouts and reporting one. */
      const isToggle = await p.evaluate((i) => {
        const el = [...document.querySelectorAll('#view button')].filter((e) => e.offsetParent !== null)[i];
        if (!el) return false;
        const oc = (el.getAttribute('onclick') || '') + ' ' + (el.className || '');
        return /toggleLang|setLang|applyLang|switchLang/i.test(oc);
      }, i).catch(() => false);
      if (isToggle) continue;
      const label = await p.evaluate((i) => {
        const els = [...document.querySelectorAll('#view button')].filter((e) => e.offsetParent !== null);
        if (!els[i]) return null;
        const t = els[i].textContent.trim().slice(0, 34) || '(unlabelled)';
        try { els[i].click(); } catch (_) { }
        return t;
      }, i).catch(() => null);
      if (label === null) continue;
      tried++;
      await p.waitForTimeout(550);
      const isOpen = await p.evaluate(() => !!document.querySelector('#ov.show')).catch(() => false);
      if (isOpen) {
        const covering = await overlayOnTop();
        if (covering) { skipped.push(`"${label}" on ${pg.name} — an overlay (${covering}) was on top, so the dialog underneath was not measured`); await closeAny(); continue; }
        opened++;
        const m = await p.evaluate(MEASURE);
        /* One row per distinct DIALOG, not per button: the same quick-edit opens from a dozen
           rows, and thirteen identical lines is how a real finding gets skimmed past. */
        const key = (m.title || label) + '|' + pg.name;
        if (!seen.has(key)) {
          seen.add(key);
          const where = `"${m.title || label}" (opened from ${pg.name})`;
          if (m.pageOverflow > 2) pageOverflow.push(`${where} pushes the page ${m.pageOverflow}px sideways`);
          if (m.wide.length) tooWide.push(`${where}: ${m.wide.join('; ')}`);
          heights.push({ title: m.title || label, content: m.contentH, box: m.boxH });
          if (m.save && !m.save.reachable) unreachable.push(`${where}: Save is at ${JSON.stringify(m.save.rect)} on a ${m.save.vw}x${m.save.vh} screen after scrolling the dialog to the bottom (onScreen=${m.save.onScreen})${m.save.hit ? `, and the point at its centre lands on ${m.save.hit}` : ''}`);
        }
      }
      /* Close EVERYTHING after every button, not only after one that opened a dialog. On the
         previous run a button that opened js/31's Team & Access panel left it standing (it opens
         no #ov, so the close step was skipped), and the next two dialogs were measured underneath
         it — reported as unmeasured rather than as findings, thanks to the guard above, but two
         dialogs went unread all the same. */
      await closeAny();
      if (!(await p.evaluate(() => { try { return LANG === 'ar'; } catch (_) { return true; } }).catch(() => true))) { flipped++; await forceAr(); await goPage(pg.spec); }
      const still = await p.evaluate(() => { try { return typeof current !== 'undefined' ? current : null; } catch (_) { return null; } });
      if (still !== pg.spec.page) {
        const alive = await p.evaluate(() => typeof render === 'function').catch(() => false);
        if (!alive) { await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000); }
        await goPage(pg.spec);
      }
    }
  }
  const lang = await p.evaluate(() => { try { return LANG; } catch (_) { return '?'; } }).catch(() => '?');
  /* THE CHECK THAT MAKES CHECK 3 MEAN ANYTHING. Measured, not assumed: with .modal's
     `overflow:auto` sabotaged to `overflow:hidden` — the exact regression check 3 describes —
     the whole walk above stayed GREEN, because not one of the app's 41 dialogs is currently tall
     enough on a 390x844 screen to be clipped. A check that cannot fail is not evidence, and
     nothing in its output said so. So the contract is also asserted directly: open a dialog that
     IS taller than the screen and require its Save button to be reachable. That does not depend
     on any fixture staying short or growing tall, and it reddens under the sabotage. */
  await p.evaluate(() => {
    try { closeModal(); } catch (_) { }
    openModal('tall dialog probe', '<div style="height:3000px">a dialog taller than any phone</div>', function () { return false; });
  });
  await p.waitForTimeout(600);
  const tall = await p.evaluate(MEASURE);
  /* AND A SELF-TEST OF THE DETECTOR ITSELF, because I could not break this property from the CSS.
     Measured, and it is the round's most useful finding: Save-on-a-phone is defended by THREE
     independent mechanisms — .modal scrolls (overflow:auto), .mf is position:sticky, and the
     browser scrolls a focused control into view even inside a clipped box. Removing the first two
     together still leaves the dialog completable, so no single CSS regression makes check 3 red
     and a sabotage that "should" have worked did not. That is good news about the app and bad
     news about the evidence: a check nobody has ever seen fail is a check nobody should trust.
     So the detector is exercised on every run by putting something over the button — the exact
     shape of the real thing this sweep already caught twice, a panel left standing above a
     dialog — and it must report it. */
  const detector = await p.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__probeCover';
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:220px;z-index:2147483000;background:rgba(255,0,0,.2)';
    document.body.appendChild(d);
    return true;
  });
  await p.waitForTimeout(200);
  const covered = await p.evaluate(MEASURE);
  await p.evaluate(() => { const d = document.getElementById('__probeCover'); if (d) d.remove(); });
  await ctx.close(); await b.close();

  console.log(`\n${VW}x${VH} (${lang}): pressed ${tried} buttons, opened ${opened} dialogs, ${seen.size} of them distinct${skipped.length ? `, and left ${skipped.length} unmeasured` : ''}${flipped ? `, putting the app back into Arabic ${flipped} time(s) after a control flipped it` : ''}`);
  skipped.forEach((s) => console.log('  · not measured: ' + s));
  if (opened >= 5) ok(`${opened} dialogs opened (${seen.size} distinct) — a clean result below is about the dialogs, not about a walk that pressed nothing`);
  else fail(`only ${opened} dialogs opened across ${tried} buttons — the walk is broken and a clean phone result from it would be a false green`);

  if (!pageOverflow.length) ok('no dialog makes the page scroll sideways on a phone');
  else pageOverflow.forEach((m) => fail(m));

  if (!tooWide.length) ok('no dialog, and nothing inside one, is wider than the screen without a scroller');
  else tooWide.forEach((m) => fail(m));

  if (!unreachable.length) ok('every dialog\'s Save button is reachable on a phone — visible, inside the screen, and hit-testable at its own centre after the dialog is scrolled down');
  else unreachable.forEach((m) => fail(`SAVE CANNOT BE REACHED — ${m}. On this screen the dialog cannot be completed at all.`));

  const tallest = heights.slice().sort((a, b) => b.content - a.content)[0];
  if (tallest && tallest.content > VH) ok(`the tallest dialog the walk found needs ${tallest.content}px on an ${VH}px screen ("${tallest.title}"), so check 3 above was answering a real question`);
  else console.log(`  · note: the tallest dialog the walk found needs only ${tallest ? tallest.content : 0}px on an ${VH}px screen, so nothing above was tall enough to be clipped and check 3 proved nothing on its own. The forced check below is the one that bites.`);
  if (detector && covered && covered.save && !covered.save.reachable) ok('self-test: with something laid over the bottom of the screen the reachability check DOES report the Save button as unreachable — so a green from it above is evidence rather than a check that cannot fail');
  else fail(`self-test: the reachability check did NOT notice a strip covering the bottom 220px of the screen (${JSON.stringify(covered && covered.save)}). Every "Save is reachable" line above is worthless until this is fixed.`);
  if (tall && tall.save && tall.save.reachable) ok(`forced: a dialog 3000px tall still has a reachable Save button (${tall.boxH}px box, ${tall.contentH}px of content) — the dialog scrolls and its footer stays put`);
  else fail(`forced: a dialog 3000px tall has an UNREACHABLE Save button — ${JSON.stringify(tall && tall.save)}. Any dialog that grows past one screen becomes impossible to complete on a phone.`);

  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
