/* The "Save pages" button writes straight to app_users from the browser. If the database
   refuses that write it comes back with no error and zero rows — and the button still says
   "Saved ✓". Check what a manager and an employee actually achieve with it. */
import { TEAM } from './emp-rig.mjs';
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const tok=(e,p)=>fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}).then(r=>r.json()).then(r=>r.access_token);
const adm=await tok(TEAM.business.email,TEAM.business.pw);
const rows=await fetch(URL+'/rest/v1/app_users?select=id,email,allowed_pages',{headers:{apikey:ANON,Authorization:'Bearer '+adm}}).then(r=>r.json());
const target=rows.find(u=>u.email===TEAM.assem.email);
for (const who of ['othman','assem']) {
  const t=await tok(TEAM[who].email,TEAM[who].pw);
  const r=await fetch(`${URL}/rest/v1/app_users?id=eq.${target.id}`,{method:'PATCH',
    headers:{apikey:ANON,Authorization:'Bearer '+t,'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({allowed_pages:['today','leads','clients','finance','settings']})}).then(async x=>({s:x.status,n:(await x.json().catch(()=>[])).length||0}));
  console.log(`${TEAM[who].role.padEnd(12)} clicking "Save pages": http ${r.s}, rows actually changed = ${r.n}  →  ${r.n? 'really saved' : 'NOTHING SAVED (button would still say Saved ✓)'}`);
}
await fetch(`${URL}/rest/v1/app_users?id=eq.${target.id}`,{method:'PATCH',headers:{apikey:ANON,Authorization:'Bearer '+adm,'Content-Type':'application/json'},body:JSON.stringify({allowed_pages:target.allowed_pages})});
console.log('put back to', JSON.stringify(target.allowed_pages));
process.exit(0);
