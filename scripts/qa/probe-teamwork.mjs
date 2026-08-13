/* Two things the owner cares about most: handing a lead to a colleague, and two people
   working at the same moment without stepping on each other.
   Run: NODE_USE_ENV_PROXY=1 node probe-teamwork.mjs                                       */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';

const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };
const HANDOVER = 'Lammah Tech';          // Raad's lead, handed to Assem and back

/* ---------- 1. hand a lead over ---------- */
const raad = await openApp(9500);
await signIn(raad.page, TEAM.raad.email, TEAM.raad.pw); await ready(raad.page);
await go(raad.page, 'leads', 1500);

const before = await raad.page.evaluate(n => {
  const b = (DB.businesses || []).find(x => x.name === n);
  return b ? { id: b.id, owner: b.assignedTo } : null;
}, HANDOVER);
STEP(`Raad owns "${HANDOVER}" to begin with`, !!before && /Raad/.test(before.owner || ''), JSON.stringify(before));

const handed = await raad.page.evaluate(async ([n, to]) => {
  const b = (DB.businesses || []).find(x => x.name === n); if (!b) return null;
  b.assignedTo = to;                       // exactly what the owner dropdown does
  if (typeof save === 'function') save();
  await new Promise(r => setTimeout(r, 4000));
  return b.assignedTo;
}, [HANDOVER, TEAM.assem.name]);
STEP('Raad hands the lead to Assem', handed === TEAM.assem.name, String(handed));

await raad.page.reload({ waitUntil: 'domcontentloaded' }); await raad.page.waitForTimeout(9000); await ready(raad.page);
await go(raad.page, 'leads', 1500);
const goneFromRaad = await raad.page.evaluate(n => {
  const b = (DB.businesses || []).find(x => x.name === n);
  leadFilter.mine = true; leadFilter.stage = 'all'; leadFilter.q = '';
  const mineNames = (typeof leadTableList === 'function' ? leadTableList() : []).map(x => x.name);
  leadFilter.mine = false;
  return { ownerNow: b && b.assignedTo, stillInMyMine: mineNames.includes(n) };
}, HANDOVER);
STEP('after a reload the hand-over stuck, and it left Raad\'s "Mine"', goneFromRaad.ownerNow === TEAM.assem.name && !goneFromRaad.stillInMyMine, JSON.stringify(goneFromRaad));

const assem = await openApp(9501);
await signIn(assem.page, TEAM.assem.email, TEAM.assem.pw); await ready(assem.page);
await go(assem.page, 'leads', 1500);
const arrived = await assem.page.evaluate(n => {
  leadFilter.mine = true; leadFilter.stage = 'all'; leadFilter.q = '';
  const names = (typeof leadTableList === 'function' ? leadTableList() : []).map(x => x.name);
  leadFilter.mine = false;
  return names.includes(n);
}, HANDOVER);
STEP('it now appears in Assem\'s "Mine" when he signs in', arrived);

/* ---------- 2. two people working at the same time ---------- */
const A = 'Rimal Najd Contracting';   // Raad's
const B = 'Itqan Facilities Management'; // Assem's
const stampR = 'Raad note ' + '2026-08-13a';
const stampA = 'Assem note ' + '2026-08-13a';

const both = await Promise.all([
  raad.page.evaluate(async ([n, s]) => {
    const b = (DB.businesses || []).find(x => x.name === n); if (!b) return 'missing';
    b.nextActionNote = s; if (typeof save === 'function') save();
    await new Promise(r => setTimeout(r, 4500)); return b.nextActionNote;
  }, [A, stampR]),
  assem.page.evaluate(async ([n, s]) => {
    const b = (DB.businesses || []).find(x => x.name === n); if (!b) return 'missing';
    b.nextActionNote = s; if (typeof save === 'function') save();
    await new Promise(r => setTimeout(r, 4500)); return b.nextActionNote;
  }, [B, stampA]),
]);
STEP('both people saved at the same moment without an error', both[0] === stampR && both[1] === stampA, JSON.stringify(both));

await Promise.all([
  raad.page.reload({ waitUntil: 'domcontentloaded' }).then(() => raad.page.waitForTimeout(9000)),
  assem.page.reload({ waitUntil: 'domcontentloaded' }).then(() => assem.page.waitForTimeout(9000)),
]);
await ready(raad.page); await ready(assem.page);
const kept = await raad.page.evaluate(([a, b]) => {
  const f = n => { const x = (DB.businesses || []).find(y => y.name === n); return x ? (x.nextActionNote || '') : null; };
  return { a: f(a), b: f(b), total: (DB.businesses || []).length };
}, [A, B]);
STEP('neither person\'s work was wiped by the other', kept.a === stampR && kept.b === stampA, JSON.stringify(kept));
STEP('the company list is still whole (30)', kept.total === 30, String(kept.total));

/* ---------- put the hand-over back ---------- */
const restored = await assem.page.evaluate(async ([n, to]) => {
  const b = (DB.businesses || []).find(x => x.name === n); if (!b) return null;
  b.assignedTo = to; if (typeof save === 'function') save();
  await new Promise(r => setTimeout(r, 4000)); return b.assignedTo;
}, [HANDOVER, TEAM.raad.name]);
STEP('the lead is handed back to Raad (world restored)', restored === TEAM.raad.name, String(restored));

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
await raad.browser.close(); await assem.browser.close();
process.exit(0);
