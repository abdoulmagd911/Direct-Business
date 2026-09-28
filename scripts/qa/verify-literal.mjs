/* Checks that each staff password held in the environment signs in to the live system.

   NO PASSWORDS LIVE IN THIS FILE (2026-09-28). This repository is public; until today this file held
   the working passwords of eleven real accounts, retyped from chat. They are read from the
   environment now, under the same names as scripts/qa/emp-rig.mjs — DB_PW_BUSINESS, DB_PW_OTHMAN
   and so on. The owner holds the list. An account whose variable is not set is skipped and named;
   a run with none set fails, because it tested nothing. */
const ACCOUNTS = [
  ['business',  'business@directksa.com'],
  ['aboelmagd', 'aboelmagd@directksa.com'],
  ['hassan',    'a.hassan@directksa.net'],
  ['admin',     'test@directksa.com'],
  ['othman',    'osharafi@direct-visa.net'],
  ['raad',      'raad.elkhair@directksa.com'],
  ['kareem',    'kareem.medhat@directksa.com'],
  ['assem',     'assem.alsweed@directksa.com'],
  ['mohammed',  'mohammed.altuwaijri@directksa.com'],
  ['ahmed',     'ahmed.aboelmagd@directksa.net'],
  ['abdulaziz', 'abdulaziz.alreshody@directksa.com'],
];
const PRINTED = [];
for (const [key, email] of ACCOUNTS) {
  const pw = process.env['DB_PW_' + key.toUpperCase()] || '';
  if (pw) PRINTED.push([email, pw]);
  else console.log(`skip ${email.padEnd(36)} (DB_PW_${key.toUpperCase()} not set)`);
}
if (!PRINTED.length) { console.log('\nFAILED — no DB_PW_… variable is set, so nothing was tested.'); process.exit(1); }
const URL='https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON='sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
let bad=0;
for (const [email,pw] of PRINTED) {
  const r=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})}).then(r=>r.json());
  const ok=!!r.access_token;
  if(!ok) bad++;
  console.log(`${ok?'OK  ':'FAIL'} ${email.padEnd(36)} (${pw.length} characters)`);
}
console.log(bad? `\n${bad} of the printed passwords DO NOT WORK` : '\nEvery password exactly as written in chat logs in. Nothing lost in the typing.');
/* 2026-09-07 (watch cycle 36): this file counted its failures, printed them, and then exited 0,
   so a regression it could see was reported to any runner as a pass. Cycle 35 fixed the seven of
   these that the battery runs; this is one of the rest. The count decides the exit code now. */
const __fails = bad;
if (__fails) { console.log(`\nFAILED — ${__fails} check(s) did not pass.`); process.exit(1); }
process.exit(0);
