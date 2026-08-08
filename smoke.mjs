import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
const srv=http.createServer((q,r)=>{
  let f=q.url.split('?')[0]; if(f==='/'||f==='/ops'||f==='/finance') f='/index.html';
  try{ r.writeHead(200,{'Content-Type':'text/html'}); r.end(fs.readFileSync('.'+f)); }
  catch(e){ r.writeHead(404); r.end('nf'); }
}).listen(8099);
const b=await chromium.launch();
const p=await b.newPage();
const errs=[],logs=[];
p.on('console',m=>{ if(m.type()==='error')errs.push(m.text()); if(/v44|GoTrue|Multiple/i.test(m.text()))logs.push(m.type()+': '+m.text()); });
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.goto('http://localhost:8099/ops',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(4000);
console.log('--- page errors ---'); console.log(errs.length?errs.slice(0,10).join('\n'):'(none)');
console.log('--- v44 / auth logs ---'); console.log(logs.length?logs.join('\n'):'(none)');
console.log('--- singleton applied? ---', await p.evaluate(()=>!!(window.supabase&&window.supabase.__directSingleton)));
console.log('--- clients are same object? ---', await p.evaluate(()=>{
  if(!window.supabase) return 'no lib';
  const a=window.supabase.createClient('https://x.supabase.co','k');
  const c=window.supabase.createClient('https://x.supabase.co','k');
  return a===c;
}));
console.log('--- login card visible? ---', await p.evaluate(()=>!!document.getElementById('cl_busy')));
console.log('--- watchdog + nav injector running? ---', await p.evaluate(()=>typeof window.render==='function'));
await b.close(); srv.close();
