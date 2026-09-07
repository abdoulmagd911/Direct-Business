/* Independent double-check: every password typed exactly as it was handed over, straight at
   the live system. No browser, no app code — just "does this log in, and as whom". */
import { TEAM } from './emp-rig.mjs';
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const ORDER=['business','aboelmagd','hassan','admin','othman','raad','kareem','assem','mohammed','ahmed','abdulaziz'];
let bad=0;
for (const k of ORDER) {
  const t=TEAM[k];
  const r=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:t.email,password:t.pw})}).then(r=>r.json());
  if(!r.access_token){ console.log(`FAIL  ${t.email} — ${r.error_description||r.msg||JSON.stringify(r).slice(0,60)}`); bad++; continue; }
  const H={apikey:ANON,Authorization:'Bearer '+r.access_token};
  const me=await fetch(`${URL}/rest/v1/app_users?select=role,active,must_change_password,full_name&id=eq.${r.user.id}`,{headers:H}).then(x=>x.json());
  const m=me[0]||{};
  const okRole = m.role===t.role, okActive = m.active===true, okPerm = m.must_change_password===false;
  if(!(okRole&&okActive&&okPerm)) bad++;
  console.log(`${okRole&&okActive&&okPerm?'OK   ':'FAIL '} ${t.email.padEnd(36)} role=${m.role} active=${m.active} asked_to_change=${m.must_change_password}`);
}
console.log(bad? `\n${bad} PROBLEM(S)` : '\nAll 11 sign in, correct level, active, and NOT asked to change their password.');
/* 2026-09-07 (watch cycle 36): this file counted its failures, printed them, and then exited 0,
   so a regression it could see was reported to any runner as a pass. Cycle 35 fixed the seven of
   these that the battery runs; this is one of the rest. The count decides the exit code now. */
const __fails = bad;
if (__fails) { console.log(`\nFAILED — ${__fails} check(s) did not pass.`); process.exit(1); }
process.exit(0);
