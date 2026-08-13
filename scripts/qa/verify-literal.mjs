/* The passwords EXACTLY as they were written out in chat, retyped here by hand and tested
   one by one. If a character was dropped or an escape mangled, this fails. */
const PRINTED = [
  ['business@directksa.com',            'Direct#Riyadh-2026$Adm1'],
  ['aboelmagd@directksa.com',           'Direct#Jeddah-2026$Adm2'],
  ['a.hassan@directksa.net',            'Direct#Makkah-2026$Adm3'],
  ['test@directksa.com',                'Dq7nTest-2026-Riyadh'],
  ['osharafi@direct-visa.net',          'Direct#Madinah-2026$Mgr7'],
  ['raad.elkhair@directksa.com',        'Direct#Tabuk-2026$Emp11'],
  ['kareem.medhat@directksa.com',       'Direct#Abha-2026$Emp22'],
  ['assem.alsweed@directksa.com',       'Direct#Hail-2026$Emp33'],
  ['mohammed.altuwaijri@directksa.com', 'Direct#Najran-2026$Emp44'],
  ['ahmed.aboelmagd@directksa.net',     'Direct#Yanbu-2026$Emp55'],
  ['abdulaziz.alreshody@directksa.com', 'Direct#Khobar-2026$Emp66'],
];
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
process.exit(0);
