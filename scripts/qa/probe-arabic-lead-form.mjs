/* probe-arabic-lead-form.mjs — guards the 2026-09-18 (fire #86) change in js/21.
   Found by opening the real lead-edit form against the live database with the language set to Arabic:
   the form was HALF translated — 11 of its 24 labels and every one of its 8 placeholders stayed
   English, so somebody working in Arabic read a form in two languages. Three structural reasons, all
   now covered:
     · the communication-channel chips are <label><input type=checkbox>Email</label>, and js/21's label
       pass deliberately skips a label that wraps an input (the rule that stops free text being
       flattened). They are a fixed enum whose stored value is the value attribute, so their wording is
       translated on its own narrow pass, found by class, and WhatsApp keeps its own name;
     · placeholders are attributes, and only #gsearch's was ever patched;
     · the contact rows are rebuilt AFTER the dialog's pass — openModal calls drawContacts(), core-02
       calls it again with the company's people, and addContactRow() and the ✕ call it on every add and
       remove. Measured live: calling the translator by hand right afterwards DID produce the Arabic,
       which is how this was identified as timing, not matching. js/21 now wraps the redraw.
   What must NOT change: the activity-type options (Call / Meeting / Note …) carry no value attribute,
   so their text IS what gets stored — js/21's universal rule. This probe asserts they stay English.
   Sabotage-tested: with the js/21 edit stashed, 7 checks go FAIL, exit 1 — the half-translated form
   exactly as it was found.
   Run: node scripts/qa/probe-arabic-lead-form.mjs                                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9065; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1050 } });
await ctx.addInitScript(() => { try { localStorage.setItem('dbLang', 'ar'); } catch (_) { } });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
/* nothing may be written: this probe only reads a form */
const writes = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    writes.push(m + ' ' + u.pathname); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
/* the form is opened by editBusiness (core-02); editLead in js/78 is a thin alias for it. There is
   no openLeadForm — an earlier version of this probe called that, got `undefined`, and reported an
   empty form as a translation failure. Wait for the real one. */
await p.waitForFunction(() => typeof render === 'function' && typeof window.editBusiness === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
await p.waitForTimeout(3500);
const arabicOn = await p.evaluate(() => typeof LANG !== 'undefined' && LANG === 'ar');

const read = () => p.evaluate(() => {
  const isEn = (t) => /[A-Za-z]/.test(t) && !/[؀-ۿ]/.test(t);
  const m = document.getElementById('modal'); if (!m) return null;
  const labels = Array.from(m.querySelectorAll('label')).map((x) => (x.textContent || '').trim()).filter(Boolean);
  const host = document.getElementById('contacts');
  const rowPh = host ? [...new Set(Array.from(host.querySelectorAll('input')).map((i) => i.getAttribute('placeholder') || ''))] : [];
  const phs = Array.from(m.querySelectorAll('input[placeholder],textarea[placeholder]')).map((x) => x.getAttribute('placeholder'));
  const chips = Array.from(m.querySelectorAll('label > input.f_ch')).map((x) => ({ value: x.getAttribute('value'), text: (x.parentNode.textContent || '').trim() }));
  return { labels: labels.length, labelsEnglish: labels.filter(isEn), rows: host ? host.querySelectorAll('.contact').length : 0,
    rowPh, phs, phsEnglish: phs.filter(isEn), chips }; });

const target = await p.evaluate(() => { const b = (DB.businesses || []).find((x) => (x.contacts || []).length) || (DB.businesses || [])[0]; return b && b.id; });
await p.evaluate((id) => { try { current = 'leads'; openLead = id; render(); } catch (_) { } }, target); await p.waitForTimeout(1500);
await p.evaluate((id) => { editBusiness(id); }, target);
await p.waitForSelector('#contacts .contact', { timeout: 30000 });
await p.waitForTimeout(1200);
const onOpen = await read();
/* the case the redraw wrap exists for: add a row, then delete one */
await p.evaluate(() => { try { addContactRow(); } catch (_) { } }); await p.waitForTimeout(900);
const afterAdd = await read();
await p.evaluate(() => { try { const x = document.querySelector('#contacts .contact .x'); if (x) x.click(); } catch (_) { } }); await p.waitForTimeout(900);
const afterDel = await read();
/* the option rule: activity types are stored by their text and must stay English */
await p.evaluate(() => { try { closeModal(); } catch (_) { } }); await p.waitForTimeout(600);
await p.evaluate((id) => { logActivity(id); }, target); await p.waitForTimeout(2200);
const act = await p.evaluate(() => { const m = document.getElementById('modal'); if (!m) return null;
  const sel = m.querySelector('select'); if (!sel) return null;
  return { opts: Array.from(sel.options).map((o) => ({ text: (o.textContent || '').trim(), hasValue: o.hasAttribute('value') })),
    notePh: (m.querySelector('textarea') || {}).placeholder || '' }; });
await b.close(); srv.close?.();

const AR = /[؀-ۿ]/;
const rowsArabic = (s) => !!s && s.rowPh.length >= 3 && s.rowPh.every((t) => AR.test(t));
const storedOpts = (act && act.opts.filter((o) => !o.hasValue)) || [];
const checks = [
  ['the drive really happened — the Arabic lead form opened with its contact rows', arabicOn && !!onOpen && onOpen.rows >= 1 && onOpen.labels >= 15],
  ['every label in the Arabic form reads Arabic, apart from the brand name WhatsApp', !!onOpen && onOpen.labelsEnglish.every((t) => /^WhatsApp$/.test(t))],
  ['no placeholder in the Arabic form is left in English', !!onOpen && onOpen.phsEnglish.length === 0],
  ['the contact rows are labelled in Arabic when the form opens', rowsArabic(onOpen)],
  ['they are still Arabic after somebody ADDS a row (the row list is rebuilt each time)', rowsArabic(afterAdd) && afterAdd.rows === onOpen.rows + 1],
  ['they are still Arabic after somebody DELETES a row', rowsArabic(afterDel)],
  ['the channel chips read Arabic while their stored values stay English', !!onOpen && onOpen.chips.length >= 3 && onOpen.chips.every((c) => /^[\x00-\x7F]+$/.test(c.value || '')) && onOpen.chips.some((c) => AR.test(c.text))],
  ['the activity types, whose TEXT is what gets stored, are left in English', storedOpts.length > 0 && storedOpts.every((o) => !AR.test(o.text))],
  ['the activity note placeholder is translated', !!act && AR.test(act.notePh || '')],
  /* js/42 links finance groups to clients on its own at boot — that is the app working, not this
     probe. What must not happen is a contact or a company row being written by opening a form. */
  ['opening and editing the form wrote no contact or company row', writes.filter((w) => /\/(contacts|businesses)/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ arabicOn, onOpen, afterAdd: afterAdd && { rows: afterAdd.rows, rowPh: afterAdd.rowPh }, afterDel: afterDel && { rows: afterDel.rows, rowPh: afterDel.rowPh }, act, writes }, null, 1)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
