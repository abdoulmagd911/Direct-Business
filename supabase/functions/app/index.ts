// 2026-09-20 (fire #136) — this function used to serve site/app.html out of Storage: a working,
// signed-in-capable copy of the app, 1,042,705 bytes, reachable by anyone with no login.
//
// CLAUDE.md has called that Storage path dead since 2026-08-08 ("the website is served from the
// repo, not from Storage"), but the door was still open, and the copy behind it was old enough to
// be dangerous rather than merely stale. Measured before this was changed: it carries NONE of the
// current layers — no v44a (the single shared Supabase client, the fix for five clients fighting
// over token refresh and silently signing people out), no v45, no finance money gate, no promo
// codes — and, decisively, it calls save_state and never save_state_patch. save_state writes the
// WHOLE shared workspace blob. So any colleague who still had that address bookmarked could sign
// in, touch anything, and overwrite everything every other person had changed since — the exact
// bug v45 exists to prevent, from a page nobody thought was still running.
//
// It now redirects to the real app, which asks for the team login. Kept redirecting rather than
// deleted so an old bookmark still lands somewhere useful — the same thing ksa-events-hub already
// does for the retired events page, for the same reason.
Deno.serve((_req: Request) => {
  return new Response(null, {
    status: 302,
    headers: { Location: "https://www.directksab2b.com/" },
  });
});
