/* wait-ready.mjs (2026-09-08, watch cycle 67) — wait on a fact instead of a timeout.
   Support file, not a probe: it asserts nothing and is listed in scripts/qa/reports.txt's sibling
   accounting as support, the same as mock-supabase.mjs.

   WHY: three probes have failed because a table they depend on had not been served in time, and
   probe-alias-dedupe-attacks twice with the same words — "DB.settings never arrived from
   app_settings". A probe that guesses a number of milliseconds cannot tell the difference between
   "the app never asked" and "the answer was late", so it reports the wrong thing or, worse,
   concludes from an empty object.

   THE SEPARATION THIS FILE EXISTS TO KEEP:
     · waitServed()  — a fact about the WIRE. The mock answered a request for this table.
     · waitInApp()   — a fact about the PAGE. The app has the data and put it where it belongs.
   They are two different questions and this file never lets one stand in for the other. A probe
   that needs the exclusion list must ask BOTH: served, then in the app. Passing because the wire
   carried it, while the page still holds an empty object, is precisely the failure the exclusion
   probes exist to prevent.

   Neither function ever resolves "true" on timeout. They return a result object whose `ok` is
   false and whose `why` says which of the two things did not happen, so a probe can fail with the
   real reason instead of a guess. */

/** A fact about the wire: has the mock answered a request for this table? */
export async function waitServed(base, table, opts = {}) {
  const want = opts.min || 1, kind = opts.kind || 'reads', timeoutMs = opts.timeoutMs || 30000;
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(base.replace(/\/$/, '') + '/__mock/served');
      last = await r.json();
      const e = last && last[table];
      if (e && (e[kind] || 0) >= want) return { ok: true, served: e, waitedMs: Date.now() - started };
    } catch (_) { /* the server may not be up yet; keep waiting until the timeout says otherwise */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const e = (last && last[table]) || null;
  return {
    ok: false, served: e, waitedMs: Date.now() - started,
    why: e
      ? `${table} was served ${e[kind] || 0} ${kind} in ${timeoutMs}ms, fewer than the ${want} needed`
      : `${table} was never requested at all in ${timeoutMs}ms — the app did not ask for it, so this is not a slow answer`,
  };
}

/** A fact about the page: the app has the data and has put it where the feature reads it from. */
export async function waitInApp(page, fn, opts = {}) {
  const timeoutMs = opts.timeoutMs || 30000;
  try {
    await page.waitForFunction(fn, { timeout: timeoutMs, polling: 100 });
    return { ok: true };
  } catch (_) {
    return { ok: false, why: opts.what ? `${opts.what} never appeared in the page within ${timeoutMs}ms` : `the page condition was never true within ${timeoutMs}ms` };
  }
}

/** Both, in the order that makes a timeout legible: wire first, then page. */
export async function waitReady(base, page, table, fn, opts = {}) {
  const wire = await waitServed(base, table, opts);
  if (!wire.ok) return { ok: false, stage: 'wire', why: wire.why };
  const app = await waitInApp(page, fn, opts);
  if (!app.ok) return { ok: false, stage: 'app', why: `${table} was served, but ${app.why} — the answer arrived and the app did not use it` };
  return { ok: true, waitedMs: wire.waitedMs };
}
