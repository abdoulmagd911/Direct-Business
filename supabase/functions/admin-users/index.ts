import { createClient } from 'jsr:@supabase/supabase-js@2';

// The live function as deployed (version 5, read 2026-09-27), with ONE change for C-lite: the password minimum is 10
// everywhere (MIN_PW), equal to Supabase's own Auth minimum and to js/02's MIN_PW (DECISIONS: one shared minimum). This
// function used to accept 8, so a password typed here could be one Supabase then refused — the person was told "saved"
// and could not sign in with it (the owner's sign-in loop). The invented temporary password is 10+ characters too (it
// could be 9: "Abha1234!").
const MIN_PW = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Pages each role may open. Admin = everything (null).
const PAGES_MANAGER = ['today','leads','clients','finance','offers','events','airlines','settings','activity','archive'];
const PAGES_EMPLOYEE = ['today','leads','clients','finance'];

// Reset-link redirects are only allowed back to a known Direct Business origin — accepting
// whatever origin the caller sends would be an open redirect in the password-reset flow.
const ALLOWED_ORIGINS = [
  'https://www.directksab2b.com',
  'https://direct-business.vercel.app',
];
const VERCEL_PREVIEW_RE = /^https:\/\/direct-business-[a-z0-9-]+-abdoulmagd911s-projects\.vercel\.app$/;
function safeRedirectOrigin(candidate: string): string {
  if (ALLOWED_ORIGINS.includes(candidate) || VERCEL_PREVIEW_RE.test(candidate)) return candidate;
  return ALLOWED_ORIGINS[0];
}

function tempPassword(): string {
  const words = ['Riyadh','Jeddah','Dammam','Makkah','Madinah','Tabuk','Abha','Hail'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(10000 + Math.random() * 90000);   // five digits: the shortest is "Abha" + 5 + 1 = 10
  const s = '!@#$%&*'[Math.floor(Math.random() * 7)];
  return `${w}${n}${s}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'Not signed in' }, 401);

    const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asUser.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(URL_, SERVICE);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // --- SELF-SERVICE (any signed-in person, affects only their own row) -----------------
    // Clearing your own "must change password" flag after you picked a new one.
    if (action === 'clear_must_change') {
      const { error } = await admin.from('app_users').update({ must_change_password: false }).eq('id', caller.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // --- WHO IS ASKING ------------------------------------------------------------------
    const { data: me } = await admin.from('app_users').select('role, active, full_name').eq('id', caller.id).maybeSingle();
    if (!me || me.active !== true) return json({ error: 'Your access is not active.' }, 403);
    const isAdmin = me.role === 'admin';
    const isManager = me.role === 'manager';
    // Managers run the team day to day; employees never manage people.
    if (!isAdmin && !isManager) return json({ error: 'Only an admin or a manager can manage team access.' }, 403);

    // A manager may never create, become, or touch an admin.
    const roleAllowedForCaller = (role: string) => isAdmin || (role !== 'admin');
    const targetIsAdmin = async (id: string) => {
      const { data } = await admin.from('app_users').select('role').eq('id', id).maybeSingle();
      return data?.role === 'admin';
    };
    const pagesFor = (role: string) =>
      role === 'admin' ? null : role === 'manager' ? PAGES_MANAGER : PAGES_EMPLOYEE;

    if (action === 'list') {
      const { data, error } = await admin
        .from('app_users')
        .select('id, email, full_name, name_ar, nickname, role, active, must_change_password, allowed_pages, created_at')
        .order('created_at', { ascending: true });
      if (error) return json({ error: error.message }, 400);
      // tell the screen what this caller is allowed to hand out
      return json({ users: data, caller_role: me.role, can_grant: isAdmin ? ['admin','manager','team_member'] : ['manager','team_member'] });
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const fullName = String(body.full_name || '').trim();
      const role = String(body.role || 'team_member');
      if (!email || !email.includes('@')) return json({ error: 'Enter a valid email address.' }, 400);
      if (!roleAllowedForCaller(role)) return json({ error: 'A manager cannot create an admin account.' }, 403);

      // The password may be TYPED by whoever is adding the person. Abdulrahman hands
      // passwords over himself, so there is no reason to make the new joiner change one on
      // arrival. Leave the box blank and the old behaviour returns: the app invents a
      // password and asks them to pick their own the first time they sign in.
      const chosen = String(body.password || '').trim();
      if (chosen && chosen.length < MIN_PW) return json({ error: `A password needs at least ${MIN_PW} characters.` }, 400);
      const pw = chosen || tempPassword();

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (cErr) {
        const msg = /already/i.test(cErr.message)
          ? 'That email already has an account. Use "Reset password" on the existing person instead.'
          : cErr.message;
        return json({ error: msg }, 400);
      }

      await admin.from('app_users').upsert({
        id: created.user!.id,
        email,
        full_name: fullName,
        role,
        active: true,
        must_change_password: !chosen,
        allowed_pages: pagesFor(role),
      }, { onConflict: 'id' });

      await admin.from('access_allowlist').upsert({ email, role, note: 'Created by ' + me.role }, { onConflict: 'email' });

      return json({ ok: true, email, temp_password: pw, permanent: !!chosen });
    }

    if (action === 'reset_password') {
      const id = String(body.id || '');
      if (!id) return json({ error: 'Missing user.' }, 400);
      if (!isAdmin && await targetIsAdmin(id)) return json({ error: 'A manager cannot reset an admin’s password.' }, 403);
      const chosenR = String(body.password || '').trim();
      if (chosenR && chosenR.length < MIN_PW) return json({ error: `A password needs at least ${MIN_PW} characters.` }, 400);
      const pw = chosenR || tempPassword();
      const { error: uErr } = await admin.auth.admin.updateUserById(id, { password: pw });
      if (uErr) return json({ error: uErr.message }, 400);
      await admin.from('app_users').update({ must_change_password: !chosenR }).eq('id', id);
      return json({ ok: true, temp_password: pw, permanent: !!chosenR });
    }

    // 2026-08-22 — password recovery hardening. Resetting someone's password is effectively
    // becoming them, so this is admin-only, full stop (not just blocked on admin targets the
    // way reset_password's manager check is). It never sets or returns a password: it sends
    // the person Supabase's own recovery-link email at their own address, and only they can
    // choose the new password (js/02's onAuthStateChange PASSWORD_RECOVERY handler is what
    // catches the link when they click it). Every trigger is logged to record_history as an
    // 'access' action — who sent it, and for whom — the same log the rest of the app reads
    // on the Activity & Audit page.
    if (action === 'send_reset_link') {
      if (!isAdmin) return json({ error: 'Only an admin can send a reset link.' }, 403);
      const id = String(body.id || '');
      if (!id) return json({ error: 'Missing user.' }, 400);
      const { data: target } = await admin.from('app_users').select('email').eq('id', id).maybeSingle();
      if (!target?.email) return json({ error: 'Person not found.' }, 404);

      const redirectTo = safeRedirectOrigin(String(body.origin || ''));
      const { error: rErr } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo });
      if (rErr) return json({ error: rErr.message }, 400);

      await admin.from('record_history').insert({
        at: new Date().toISOString(),
        actor: caller.id,
        actor_name: me.full_name || caller.email || '',
        table_name: 'access',
        record_id: id,
        action: 'reset_link_sent',
        after_row: { target_email: target.email },
      });

      return json({ ok: true });
    }

    if (action === 'set_role') {
      const id = String(body.id || '');
      const role = String(body.role || '');
      if (!id || !role) return json({ error: 'Missing user or role.' }, 400);
      if (id === caller.id && role !== me.role) return json({ error: 'You cannot change your own role.' }, 400);
      if (!roleAllowedForCaller(role)) return json({ error: 'A manager cannot give admin access.' }, 403);
      if (!isAdmin && await targetIsAdmin(id)) return json({ error: 'A manager cannot change an admin account.' }, 403);
      const { error } = await admin.from('app_users').update({ role, allowed_pages: pagesFor(role) }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'set_active') {
      const id = String(body.id || '');
      const active = body.active === true;
      if (!id) return json({ error: 'Missing user.' }, 400);
      if (id === caller.id && !active) return json({ error: 'You cannot switch off your own access.' }, 400);
      if (!isAdmin && await targetIsAdmin(id)) return json({ error: 'A manager cannot switch an admin account off.' }, 403);
      const { error } = await admin.from('app_users').update({ active }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'set_pages') {
      const id = String(body.id || '');
      const pages = Array.isArray(body.pages) ? body.pages : null;
      if (!id) return json({ error: 'Missing user.' }, 400);
      if (!isAdmin && await targetIsAdmin(id)) return json({ error: 'A manager cannot change an admin account.' }, 403);
      const { error } = await admin.from('app_users').update({ allowed_pages: pages }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
