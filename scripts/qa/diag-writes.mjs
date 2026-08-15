/* Does a plain page load, with zero edits, WRITE to the shared state? Count every request. */
import { openApp, signIn, ready, go, TEAM } from './emp-rig.mjs';
const {browser,page}=await openApp(9986);
const writes=[], userReads=[];
page.on('request',r=>{
  const u=r.url(), m=r.method();
  if(/save_state/.test(u) && m==='POST') writes.push('BOOT '+u.split('/').pop());
  if(/app_users/.test(u) && m==='GET') userReads.push(decodeURIComponent(u.split('select=')[1]||'').split('&')[0]);
});
await signIn(page,TEAM.raad.email,TEAM.raad.pw); await ready(page);
await page.waitForTimeout(12000);      // sit still: no clicks, no edits
const boot=writes.length;
console.log('save_state writes during load+12s idle:', boot, writes.slice(0,5));
console.log('app_users reads during load:', userReads.length);
userReads.forEach(u=>console.log('  ·', u));
/* now navigate around without editing */
writes.length=0;
for (const p of ['leads','clients','finance','today']) await go(page,p,2000);
await page.waitForTimeout(8000);
console.log('save_state writes while just browsing 4 pages:', writes.length, writes.slice(0,5));
await browser.close(); process.exit(0);
