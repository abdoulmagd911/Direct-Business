// @ts-check
// The fixture seed's guard (the oversight, 29 Sep 15:55 item 4): it writes a made-up world, so it runs against the
// local Supabase stack only — never a cloud project, and never a database that holds an address it did not make up.

/** The hosts a local stack answers on. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Why the seed refuses these addresses (the app's API and the database), or null when every one is on this machine.
 * @param {Record<string, string | undefined>} urls
 * @returns {string | null}
 */
export function notLocal(urls) {
  for (const [name, value] of Object.entries(urls)) {
    if (!value) return `${name} is not set — start the local stack (supabase start) first`;
    let host;
    try {
      host = new URL(value).hostname;
    } catch {
      return `${name} is not an address`;
    }
    if (!LOCAL_HOSTS.has(host))
      return `${name} points at ${host}, not this machine: the fixture seed runs locally only`;
  }
  return null;
}

/** Every address the seed writes ends in the made-up domain (rule 7). */
export const FIXTURE_DOMAIN = 'example.test';

/**
 * Why the seed refuses a database, from the e-mail addresses already allowed in it, or null.
 * @param {string[]} emails
 * @returns {string | null}
 */
export function notMadeUp(emails) {
  const real = emails.filter((e) => !e.toLowerCase().endsWith(`@${FIXTURE_DOMAIN}`));
  return real.length
    ? `this database already allows ${real.length} address(es) outside @${FIXTURE_DOMAIN}: it is not a made-up one`
    : null;
}
