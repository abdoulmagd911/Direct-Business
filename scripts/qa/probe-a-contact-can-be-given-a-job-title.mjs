/* probe-a-contact-can-be-given-a-job-title.mjs — guards the 2026-09-20 (fire #120) change in
   js/core/core-02-leads.js and js/72-people-bridge.js.

   The `contacts` table has a `role` column. Eleven of the 45 live contacts carry one, and the lead
   card has always printed it beside the name — "Delegations office · Protocol", read off the real
   database. The edit form's contact rows offered name, email and phone only.

   So the app displayed a field nobody could write. A role that was wrong could not be corrected,
   and the other 34 people could never be given one — on a screen whose whole purpose is knowing who
   to call. The column is updatable by an authenticated user, so the gap was in the form, not in the
   permissions.

   The form now has a Role box per contact, in both languages, and js/72 sends role to the contacts
   table along with the other three for a contact that came from there. Two deliberate choices, both
   worth keeping: the grid is widened by an inline style rather than by editing index.html's
   stylesheet, because touching index.html is a connection step and this did not need to be one; and
   the placeholder is written bilingually in place rather than left to js/21's after-render
   dictionary, which cannot then fall out of step with it.

   Sabotage-tested 2026-09-20 against a COPY of the app (APP_DIR — the repository is untouched):
     · the Role input removed from drawContacts: 6 checks FAIL — the field is unwritable again,
       and nothing about it reaches either the record or the database.
     · role dropped from js/72's update: 1 check FAILS — a table contact's new title never reaches
       the database.
   Run: node scripts/qa/probe-a-contact-can-be-given-a-job-title.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9093; const BASE = 'http://localhost:' + PORT;
/* the person who came from the contacts TABLE is seeded IN the table, not invented in the page:
   js/72 only writes back a row it has actually seen there, so a made-up _tid is never sent and a
   check built on one passes or fails for the wrong reason. (It failed for exactly that reason on
   the first run of this probe.) */
const TABLE_CONTACT = { id: 'qa-contact-1', business_id: 'b0', name: 'Qaanoon Table Person', role: '',
  email: 'table@qa-example.test', phone: '+966 50 333 4444', verification_source: 'manual',
  needs_manual_confirmation: false, confirmation_reason: null, confirmed_by: null, confirmed_at: null };
const srv = start(PORT, { contacts: [TABLE_CONTACT] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const STORED_ROLE = 'Protocol';
const TYPED_ROLE = 'Finance manager';
const NEW_ROLE = 'Head of travel';

async function run(lang) {
  const sent = [];
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1150 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      sent.push({ method: m, path: u.pathname.replace('/rest/v1/', ''), body: String(rq.postData() || '') });
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[{"id":"qa-contact-1"}]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0 && typeof drawContacts === 'function', { timeout: 120000 });
  await p.waitForTimeout(4500);

  /* one company with two people on its card: one kept in the company record, one that came from
     the contacts TABLE (the shape js/72 creates, carrying its row id) */
  /* the app's own id for a business is NOT the database row id — __ROWID maps between them — so
     the target is found by WHICH company the bridge attached the seeded table row to, rather than
     by guessing 'b0'. A first draft guessed, matched nothing, and read an untouched company. */
  await p.waitForFunction(() => (DB.businesses || []).some((x) => (x.contacts || [])
    .some((c) => c._fromTable && c._tid === 'qa-contact-1')), null, { timeout: 60000 });
  const id = await p.evaluate((role) => {
    const b0 = (DB.businesses || []).find((x) => (x.contacts || [])
      .some((c) => c._fromTable && c._tid === 'qa-contact-1'));
    b0.name = 'Qaanoon Titles Co';
    /* the person kept in the company record, in front of the one from the table */
    b0.contacts.unshift({ name: 'Qaanoon Embedded Person', role: role,
      email: 'embedded@qa-example.test', phone: '+966 50 111 2222' });
    current = 'leads'; openLead = b0.id; render();
    return b0.id;
  }, STORED_ROLE);
  await p.waitForTimeout(2500);

  const card = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view .contact-row'))
    .map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()));

  /* the form: what each contact row offers, and what happens when a title is typed */
  const form = await p.evaluate(({ leadId, typed, fresh }) => {
    editBusiness(leadId);
    const rows = () => [].slice.call(document.querySelectorAll('#contacts .contact'));
    const shape = rows().map((r) => [].slice.call(r.querySelectorAll('input'))
      .map((i) => ({ placeholder: i.placeholder || '', value: i.value })));
    /* type a title on the table-sourced person, exactly as a person would */
    const second = rows()[1];
    const roleBox = second ? second.querySelectorAll('input')[1] : null;
    if (roleBox) { roleBox.value = typed; roleBox.dispatchEvent(new Event('input', { bubbles: true })); }
    /* and add a brand-new person, with a title */
    if (typeof addContactRow === 'function') addContactRow();
    const last = rows()[rows().length - 1];
    if (last) {
      const ins = [].slice.call(last.querySelectorAll('input'));
      const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      if (ins[0]) set(ins[0], 'Qaanoon Brand New Person');
      if (ins[1]) set(ins[1], fresh);
      if (ins[2]) set(ins[2], 'new@qa-example.test');
    }
    const newRowInputs = last ? [].slice.call(last.querySelectorAll('input')).length : 0;
    const btns = [].slice.call(document.querySelectorAll('#modal button, .modal button'));
    const save = btns.find((x) => /^\s*(Save|حفظ)/.test(x.textContent || ''));
    if (save) save.click();
    const lead = (DB.businesses || []).find((x) => x.id === leadId) || {};
    return { shape, newRowInputs, clicked: !!save,
      stored: (lead.contacts || []).map((c) => ({ name: c.name, role: c.role || null })) };
  }, { leadId: id, typed: TYPED_ROLE, fresh: NEW_ROLE });
  await p.waitForTimeout(2200);

  await ctx.close();
  return { card, form, sent };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const patch = (r) => r.sent.filter((x) => /^contacts/.test(x.path) && x.method === 'PATCH');
console.log('  EN card:', JSON.stringify(en.card));
console.log('  EN first contact row:', JSON.stringify(en.form.shape[0]));
console.log('  AR first contact row:', JSON.stringify(ar.form.shape[0]));
console.log('  EN stored after Save:', JSON.stringify(en.form.stored));
console.log('  EN contacts-table updates sent:', JSON.stringify(patch(en).map((x) => x.body).slice(0, 3)));

const AR_ROLE_LABEL = 'الصفة';
const checks = [
  ['the card prints a contact\'s job title beside the name, in both languages',
    en.card.some((t) => t.indexOf(STORED_ROLE) >= 0) && ar.card.some((t) => t.indexOf(STORED_ROLE) >= 0),
    JSON.stringify({ en: en.card.slice(0, 2), ar: ar.card.slice(0, 2) })],
  ['every contact row in the form has four boxes, not three',
    en.form.shape.length >= 2 && en.form.shape.every((r) => r.length === 4),
    JSON.stringify(en.form.shape.map((r) => r.length))],
  ['the title box carries what is stored, rather than starting empty',
    en.form.shape[0][1].value === STORED_ROLE && ar.form.shape[0][1].value === STORED_ROLE,
    JSON.stringify({ en: en.form.shape[0][1], ar: ar.form.shape[0][1] })],
  ['its label reads in the page\'s own language',
    en.form.shape[0][1].placeholder === 'Role' && ar.form.shape[0][1].placeholder === AR_ROLE_LABEL,
    JSON.stringify({ en: en.form.shape[0][1].placeholder, ar: ar.form.shape[0][1].placeholder })],
  ['a title typed on a person who had none is kept on the record',
    en.form.stored.some((c) => c.name === 'Qaanoon Table Person' && c.role === TYPED_ROLE)
    && ar.form.stored.some((c) => c.role === TYPED_ROLE), JSON.stringify(en.form.stored)],
  ['a person added from scratch gets the same box, and their title is kept too',
    en.form.newRowInputs === 4
    && en.form.stored.some((c) => c.name === 'Qaanoon Brand New Person' && c.role === NEW_ROLE),
    JSON.stringify({ inputs: en.form.newRowInputs, stored: en.form.stored })],
  /* the half that reaches the database: a contact that came from the contacts table has its title
     written back there, not only into the company record */
  ['a title given to someone from the contacts table is sent to that table',
    patch(en).some((x) => /"role"\s*:\s*"Finance manager"/.test(x.body))
    && patch(ar).some((x) => /"role"\s*:\s*"Finance manager"/.test(x.body)),
    JSON.stringify(patch(en).map((x) => x.body).slice(0, 2))],
  ['…and the person whose details did not change is not written at all',
    patch(en).every((x) => !/Qaanoon Embedded Person/.test(x.body)),
    JSON.stringify(patch(en).length + ' update(s)')],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
