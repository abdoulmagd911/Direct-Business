import { chromium } from '@playwright/test';
const [,, theme='direct', density='comfortable', width='1500', path='/kit', dir='auto', name] = process.argv;
const b = await chromium.launch({ args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: +width, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addCookies([
  { name: 'v2.theme', value: theme, url: 'http://127.0.0.1:9400' },
  { name: 'v2.density', value: density, url: 'http://127.0.0.1:9400' },
  { name: 'v2.dir', value: dir, url: 'http://127.0.0.1:9400' },
]);
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://127.0.0.1:9400' + path, { waitUntil: 'load' });
await p.waitForTimeout(400);
const out = `${process.env.OUT}/${name ?? `${path.replace(/\W/g,'')||'root'}-${theme}-${density}-${width}${dir!=='auto'?'-'+dir:''}`}.png`;
await p.screenshot({ path: out, fullPage: width !== '400' });
console.log(out, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'clean');
await b.close();
