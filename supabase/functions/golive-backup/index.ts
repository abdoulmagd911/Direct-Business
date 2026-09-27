// golive-backup (2026-09-27) — the full backup taken before a data reset (DECISIONS D9; the owner's order of 26 Sep:
// "full backup first, kept outside the DB"). Every public table is written as JSON to the PRIVATE storage bucket
// `golive-backups/<stamp>/<table>.<part>.json` — storage, not a database table, so a reset of the tables cannot touch
// it — then each piece is READ BACK from storage and proved restorable by golive_backup_check
// (scripts/sql/golive-backup.sql): every row goes back through the table's own row type and equals the live rows.
//
// The database's own JSON text is stored BYTE FOR BYTE: nothing here parses it. (The first run parsed it in
// JavaScript and wrote it back, and 8 tables failed the check — 123.4500 came back as 123.45, and a whole number past
// 2^53 would have lost digits.) Big tables come in pieces: one 9 MB piece ran past the statement timeout.
//
// Who may call it: a signed-in ADMIN only (checked with the caller's own token through app_role()); anyone else is
// refused before any table is read. Modes (POST JSON): "tables" → the list and a fresh stamp; "plan" {t} → rows and
// size; "piece" {stamp,t,part,off,lim} → that piece stored, read back and checked; "manifest" {stamp,manifest} → the
// run's manifest stored beside the files; "links" {stamp} → signed download links (10 min) for a second copy.
// The loop lives in the caller: scripts/ops/golive-backup.mjs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "golive-backups";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const STAMP = /^\d{8}T\d{6}Z$/;
/* an rpc answered as TEXT — never parsed, so the numbers are exactly the database's */
const rpcText = async (fn: string, bodyText: string) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", body: bodyText,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" } });
  const text = await r.text();
  return { ok: r.ok, text };
};

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "sign in first" }, 401);
    const asCaller = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
    const { data: role, error: re } = await asCaller.rpc("app_role");
    if (re || role !== "admin") return json({ error: "admins only" }, 403);

    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const stamp = String(body.stamp || "");

    if (body.mode === "tables") {
      const { data: tables, error } = await svc.rpc("golive_backup_tables");
      if (error) return json({ error: error.message }, 500);
      return json({ stamp: new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), tables });
    }
    if (body.mode === "plan") {
      const { data, error } = await svc.rpc("golive_backup_plan", { t: String(body.t || "") });
      return error ? json({ error: error.message }, 500) : json(data);
    }
    if (!STAMP.test(stamp)) return json({ error: "stamp?" }, 400);

    if (body.mode === "links") {
      const { data: files, error } = await svc.storage.from(BUCKET).list(stamp, { limit: 1000 });
      if (error) return json({ error: error.message }, 500);
      const out: Record<string, string> = {};
      for (const f of files || []) {
        const { data } = await svc.storage.from(BUCKET).createSignedUrl(`${stamp}/${f.name}`, 600);
        if (data) out[f.name] = data.signedUrl;
      }
      return json({ stamp, links: out });
    }
    if (body.mode === "manifest") {
      const { error } = await svc.storage.from(BUCKET).upload(`${stamp}/_manifest.json`,
        new Blob([JSON.stringify(body.manifest ?? null, null, 1)], { type: "application/json" }), { upsert: false });
      return json({ ok: !error, error: error?.message });
    }
    if (body.mode !== "piece") return json({ error: "mode must be tables, plan, piece, manifest or links" }, 400);

    const t = String(body.t || ""), part = Number(body.part), off = Number(body.off), lim = Number(body.lim);
    if (!/^[a-z0-9_]+$/.test(t) || !(part >= 0) || !(off >= 0) || !(lim > 0)) return json({ error: "t, part, off, lim?" }, 400);
    const name = `${stamp}/${t}.${String(part).padStart(3, "0")}.json`;
    const dump = await rpcText("golive_backup_dump", JSON.stringify({ t, off, lim }));
    if (!dump.ok) return json({ table: t, part, error: "dump: " + dump.text.slice(0, 200) });
    const { error: ue } = await svc.storage.from(BUCKET).upload(name, new Blob([dump.text], { type: "application/json" }), { upsert: false });
    if (ue) return json({ table: t, part, error: "upload: " + ue.message });
    // read it BACK from storage — the check is on what was stored, not on what was meant to be stored
    const { data: blob, error: ge } = await svc.storage.from(BUCKET).download(name);
    if (ge || !blob) return json({ table: t, part, error: "read back: " + (ge?.message || "empty") });
    const stored = await blob.text();
    const chk = await rpcText("golive_backup_check", `{"t":${JSON.stringify(t)},"off":${off},"lim":${lim},"data":${stored}}`);
    if (!chk.ok) return json({ table: t, part, error: "check: " + chk.text.slice(0, 200) });
    return json({ ...JSON.parse(chk.text), part, bytes: stored.length, identical_bytes: stored === dump.text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
