/* notice-tap.mjs (2026-09-10) — read what the app told the person, now that alert() is a card.

   js/63 replaces window.alert app-wide with its in-page notice card and announces every notice
   as a 'v63-notice' document event. A probe that used to read the browser's dialog event
   (`p.on('dialog', d => d.message())`) sees nothing any more — the message is in the page. This
   helper hands every notice text to the probe the way the dialog event did, so the probe keeps
   its own array and its own assertions:

     import { tapNotices } from './notice-tap.mjs';
     const dialogs = [];
     p.on('dialog', async (d) => { dialogs.push({ type: d.type(), msg: d.message() }); await d.accept(); });
     await tapNotices(p, (m) => dialogs.push({ type: 'notice', msg: m }));   // BEFORE p.goto

   Native dialogs still arrive through p.on('dialog') — a probe that must prove no native box
   fired keeps listening there; this tap only adds the in-page notices. */
export async function tapNotices(p, onText) {
  await p.exposeFunction('__qaNoticeTap', (t) => { try { onText(String(t)); } catch (_) { } });
  await p.addInitScript(() => {
    document.addEventListener('v63-notice', (e) => { try { window.__qaNoticeTap(e.detail && e.detail.text); } catch (_) { } });
  });
}
