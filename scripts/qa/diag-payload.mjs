/* The write that fires on load: capture its exact payload. Which top-level sections does it
   carry? If it carries only 'audit', it is the sign-in log entry and can touch nothing else.
   If it carries more, the worry is justified. */
import { openApp, signIn, ready, TEAM } from './emp-rig.mjs';
const {browser,page}=await openApp(9987);
const posts=[];
page.on('request',r=>{
  if(/save_state/.test(r.url()) && r.method()==='POST'){
    let body=null; try{ body=JSON.parse(r.postData()||'null'); }catch(_){}
    const fn=r.url().split('/').pop();
    const keys=body&&body.patch?Object.keys(body.patch):(body&&body.payload?Object.keys(body.payload):[]);
    const size=(r.postData()||'').length;
    posts.push({fn,keys,bytes:size});
  }
});
await signIn(page,TEAM.mohammed.email,TEAM.mohammed.pw); await ready(page);
await page.waitForTimeout(14000);
console.log(JSON.stringify(posts,null,1));
await browser.close(); process.exit(0);
