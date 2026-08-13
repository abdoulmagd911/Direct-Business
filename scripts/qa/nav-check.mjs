import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
let port = 9860;
for (const k of ['assem','othman','business']) {
  const { browser, page, errs } = await openApp(port++);
  await signIn(page, TEAM[k].email, TEAM[k].pw); await ready(page);
  for (const p of ['today','leads','clients','finance']) await go(page, p, 800);
  const nav = await page.evaluate(() => [...document.querySelectorAll('#nav button[data-view]')]
    .filter(b => b.style.display !== 'none').map(b => b.getAttribute('data-view')));
  console.log(TEAM[k].role.padEnd(12), JSON.stringify(nav), errs.length ? 'ERRS:'+errs[0] : '');
  await browser.close();
}
process.exit(0);
