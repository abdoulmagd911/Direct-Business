/* probe-dialog-arabic-attacks.mjs (2026-09-07, round 61) — the Arabic dialogs, and the trade
   that made them possible.

   sweep-language-deep found three dialogs in daily use sitting in English on a fully Arabic
   screen. Two were plain dictionary gaps. The third — the Ops new-request form — could not be
   fixed by a dictionary at all: its Stage and Priority <option>s carried no value attribute, and
   an <option> with no value is stored BY ITS TEXT, so translating the label would have written
   "محجوز" into requests.stage where the whole app expects "Booked". js/21 has refused to touch
   value-less options since round 28 for exactly that reason, and it was right to.

   So round 61 gave those options explicit values and then translated them. That trade is only
   safe while both halves hold, and each half is invisible from the other side:
     · the LABEL must read Arabic — otherwise the dialog is still English and nothing was gained;
     · the STORED value must stay English — otherwise the fix silently corrupts the kanban, the
       stage filter, the SLA counters and every report that groups by stage.
   A probe that only reads the screen would pass a version that stores Arabic. A probe that only
   reads the database would pass a version that never translated anything. This one does both, on
   the same click, and it saves the record rather than trusting the select's value property.

   Under test:
     1. Arabic: the new-request dialog's Stage and Priority options READ Arabic.
     2. Arabic: choosing one of those Arabic-labelled options and saving stores the ENGLISH word —
        the corruption the value attributes exist to prevent, driven end to end.
     3. Arabic: the quick-edit dialog's own labels (Assigned to · the quick-note field · and, on a
        client, the two account fields) read Arabic.
     4. English control: the same dialogs read English, so a pass above is about the language
        switch and not about a dictionary that fires regardless.

   Run:  node scripts/qa/probe-dialog-arabic-attacks.mjs        (port 9018)
   Sabotage — MEASURED, not predicted, and the measurement corrected the prediction:
     · drop the Arabic entries from js/21's round-61 dialog block → checks 1 and 3 red, as
       expected (the four words that were already in the dictionary stay Arabic, which is right);
     · remove value="..." from core-03's Stage/Priority options → check 1 red, check 2 GREEN.
       I expected check 2 to redden here and it does not, and the reason matters: js/21 refuses
       to translate a value-less option, so removing the values does not corrupt anything — it
       just silently stops the translation. The guard is doing its job. Two halves, one symptom.
     · remove the values AND js/21's `if(!op.hasAttribute('value'))continue;` guard → check 2
       red, storing {"stage":"محجوز","priority":"مرتفع"} into the record, plus the values-match
       check red. That is the corruption this whole arrangement exists to prevent, and it is the
       proof that check 2 is capable of failing rather than being decorative.
   Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9018;
const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const srv = start(PORT);
const AR = /[؀-ۿ]/;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  p.on('dialog', (d) => d.accept().catch(() => { }));
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
  await p.waitForTimeout(4500);

  const setLang = async (want) => {
    await p.evaluate((w) => { try { if (typeof toggleLang === 'function' && LANG !== w) toggleLang(); } catch (_) { } }, want);
    await p.waitForTimeout(1200);
    return p.evaluate(() => LANG);
  };
  /* Read a select as a person sees it AND as the app stores it, from the same DOM node. */
  const readSelect = (id) => p.evaluate((id) => {
    const s = document.getElementById(id); if (!s) return null;
    return { labels: [...s.options].map((o) => o.textContent.trim()), values: [...s.options].map((o) => o.value) };
  }, id);
  const openNewRequest = async () => {
    await p.evaluate(() => { try { closeModal(); } catch (_) { } try { editRequest(); } catch (e) { window.__reqErr = String(e); } });
    await p.waitForTimeout(800);
  };

  /* ---------- Arabic ---------- */
  if (await setLang('ar') !== 'ar') { fail('could not put the app into Arabic — every check below would be about English'); srv.close(); await b.close(); process.exit(1); }
  await openNewRequest();
  const arStage = await readSelect('r_stage');
  const arPrio = await readSelect('r_priority');
  if (!arStage || !arPrio) { fail('the new-request dialog did not open (no #r_stage / #r_priority) — nothing below was measured'); }
  else {
    const enLeft = arStage.labels.filter((t) => !AR.test(t)).concat(arPrio.labels.filter((t) => !AR.test(t)));
    if (!enLeft.length) ok(`new-request Stage + Priority read Arabic (${arStage.labels.join(' · ')} | ${arPrio.labels.join(' · ')})`);
    else fail(`new-request dialog still shows English options in Arabic: ${enLeft.join(' · ')} — someone opening a request on an Arabic screen picks their stage out of English words`);
  }

  /* Check 2 — the half a screen-reading probe cannot see. Pick the Arabic-labelled "Booked"
     option BY ITS ARABIC LABEL (the way a person does), save the record, then read what the app
     actually stored. */
  let stored = null;
  if (arStage && arPrio) {
    const picked = await p.evaluate(() => {
      const s = document.getElementById('r_stage'), q = document.getElementById('r_priority');
      const byIdx = (sel, i) => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); return { label: sel.options[i].textContent.trim(), value: sel.options[i].value }; };
      const c = document.getElementById('r_client'); if (c) c.value = 'AR dialog probe';
      const d = document.getElementById('r_detail'); if (d) d.value = 'round 61';
      return { stage: byIdx(s, 3), prio: byIdx(q, 1) };   // STAGES[3]='Booked', priorities[1]='High'
    });
    await p.click('#mSave').catch(() => { });
    await p.waitForTimeout(1200);
    stored = await p.evaluate(() => {
      const r = (DB.requests || []).filter((x) => x.client === 'AR dialog probe').slice(-1)[0];
      return r ? { stage: r.stage, priority: r.priority } : null;
    });
    if (!stored) fail('the request was not saved at all, so what it would have stored could not be read — check 2 measured nothing');
    else if (stored.stage === 'Booked' && stored.priority === 'High') ok(`picked "${picked.stage.label}" / "${picked.prio.label}" on the Arabic screen and the app stored "${stored.stage}" / "${stored.priority}" — the label is translated, the data is not`);
    else fail(`picking "${picked.stage.label}" / "${picked.prio.label}" stored ${JSON.stringify(stored)} instead of Booked / High. The Arabic label has been written into the record: the kanban column, the stage filter, the SLA counters and every report that groups by stage will stop seeing this request. This is exactly what the value attributes on those options exist to prevent.`);
  }

  /* Check 3 — quick edit, on a client (the client-only fields are the ones with the newest gaps) */
  const qeAr = await p.evaluate(() => {
    try { closeModal(); } catch (_) { }
    const c = (DB.businesses || []).filter((b) => b.isClient)[0] || (DB.businesses || [])[0];
    if (!c) return null;
    try { (window.leadQuickEdit || window.clQuickEdit || window.qeOpen)(c.id); } catch (e) { return { err: String(e) }; }
    return { id: c.id, isClient: !!c.isClient };
  });
  await p.waitForTimeout(900);
  const qeLabels = await p.evaluate(() => [...document.querySelectorAll('#modal label')].map((l) => l.textContent.trim()).filter(Boolean));
  if (!qeLabels.length) fail(`the quick-edit dialog did not open (${JSON.stringify(qeAr)}) — its labels went unread`);
  else {
    const en = qeLabels.filter((t) => !AR.test(t) && /[A-Za-z]{3}/.test(t));
    if (!en.length) ok(`quick edit shows ${qeLabels.length} labels and every one reads Arabic`);
    else fail(`quick edit is still English in Arabic: ${en.join(' · ')}`);
  }

  /* ---------- English control ---------- */
  if (await setLang('en') !== 'en') fail('could not put the app back into English — the control below is missing');
  else {
    await openNewRequest();
    const enStage = await readSelect('r_stage');
    if (!enStage) fail('control: the new-request dialog did not open in English');
    else if (enStage.labels.every((t) => !AR.test(t))) ok(`control: in English the same dialog reads English (${enStage.labels.join(' · ')}) — so the Arabic result above is the language switch working, not a dictionary that fires either way`);
    else fail(`control: the English dialog is showing Arabic (${enStage.labels.filter((t) => AR.test(t)).join(' · ')}) — the translation is not being undone on the way back`);
    /* and the values are the same in both languages, which is the point of the whole trade */
    if (enStage && arStage && JSON.stringify(enStage.values) === JSON.stringify(arStage.values)) ok('the stored values are identical in both languages');
    else fail(`the option values differ between languages: EN ${JSON.stringify(enStage && enStage.values)} vs AR ${JSON.stringify(arStage && arStage.values)}`);
  }

  await b.close();
  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  srv.close(); process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
