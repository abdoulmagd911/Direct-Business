/* Every way a manager might try to give himself or someone else admin — straight at the
   server, no screen involved. Each of these must come back refused. */
import { TEAM } from './emp-rig.mjs';
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const tok=(e,p)=>fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})}).then(r=>r.json()).then(r=>r.access_token);
const call=(t,b)=>fetch(URL+'/functions/v1/admin-users',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(b)}).then(async r=>({s:r.status,b:await r.json().catch(()=>({}))}));
const LOG=[]; const S=(n,ok,d='')=>{LOG.push(ok?'P':'F');console.log(`${ok?'PASS':'FAIL'} · ${n}${d?' — '+d:''}`);};

const mgr=await tok(TEAM.othman.email,TEAM.othman.pw);
const emp=await tok(TEAM.assem.email,TEAM.assem.pw);
const list=(await call(mgr,{action:'list'})).b;
const anAdmin=(list.users||[]).find(u=>u.role==='admin');
const anEmp=(list.users||[]).find(u=>u.role==='team_member');
const me=(list.users||[]).find(u=>u.email===TEAM.othman.email);

S('manager is offered Manager and Employee only', JSON.stringify(list.can_grant)==='["manager","team_member"]', JSON.stringify(list.can_grant));
for (const [what, body] of [
  ['promote an employee to admin',        {action:'set_role', id:anEmp.id, role:'admin'}],
  ['promote HIMSELF to admin',            {action:'set_role', id:me.id,    role:'admin'}],
  ['demote an admin to employee',         {action:'set_role', id:anAdmin.id, role:'team_member'}],
  ['switch an admin off',                 {action:'set_active', id:anAdmin.id, active:false}],
  ['reset an admin password',             {action:'reset_password', id:anAdmin.id}],
  ['create a new admin',                  {action:'create', email:'mgr.should.fail@directksa.com', full_name:'No', role:'admin'}],
  ['change an admin’s pages',        {action:'set_pages', id:anAdmin.id, pages:['today']}],
]) {
  const r=await call(mgr,body);
  /* refused is refused — promoting yourself is caught by an earlier rule and comes back 400
     ("you cannot change your own role") rather than 403. Both mean it did not happen. */
  S(`manager CANNOT ${what}`, r.s===403 || r.s===400, `${r.s} ${String(r.b.error||'').slice(0,52)}`);
}
for (const [what, body] of [
  ['open the team list',   {action:'list'}],
  ['create anybody',       {action:'create', email:'emp.should.fail@directksa.com', full_name:'No', role:'team_member'}],
  ['change anyone’s level', {action:'set_role', id:anEmp.id, role:'manager'}],
  ['switch anyone off',    {action:'set_active', id:anEmp.id, active:false}],
]) {
  const r=await call(emp,body);
  S(`employee CANNOT ${what}`, r.s===403, `${r.s} ${String(r.b.error||'').slice(0,52)}`);
}
/* and the things a manager MUST still be able to do */
const ok1=await call(mgr,{action:'set_role', id:anEmp.id, role:'manager'});
const ok2=await call(mgr,{action:'set_role', id:anEmp.id, role:'team_member'});
S('manager CAN move someone between Employee and Manager', ok1.s===200&&ok2.s===200, `${ok1.s}/${ok2.s}`);
/* The sideways route: instead of granting a role, hand an employee the PAGES of a bigger one.
   The screen decides what to show from the person's LEVEL, not from this list, and the
   database decides what they may write from their level too — so this must change nothing. */
{
  const before = (await call(mgr,{action:'list'})).b.users.find(u=>u.id===anEmp.id);
  const r = await call(mgr,{action:'set_pages', id:anEmp.id, pages:['today','leads','clients','finance','settings','reports','ops','activity']});
  const t2 = await tok(TEAM.assem.email, TEAM.assem.pw);
  const sett = await fetch(URL+'/rest/v1/app_settings?id=eq.main',{method:'PATCH',
    headers:{apikey:ANON,Authorization:'Bearer '+t2,'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({data:{escalation:'probe'}})}).then(async x=>({s:x.status,n:(await x.json().catch(()=>[])).length||0}));
  S('handing an employee extra pages does NOT let him write settings', sett.n===0, `${r.s} on set_pages, then ${sett.s} with ${sett.n} rows changed`);
  await call(mgr,{action:'set_pages', id:anEmp.id, pages:(before&&before.allowed_pages)||['today','leads','clients','finance']});
}

console.log(`\nFAILS: ${LOG.filter(x=>x==='F').length} / ${LOG.length}`);
process.exit(0);
