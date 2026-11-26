// "Own clients only" on Finance (Landing 56, the owner's approval of 26 Nov 2026; the per-member design of 22 Nov):
// a person at Own on Finance reads all of it, and adds and changes entries only for the clients whose Client side
// they own — or every client, with the extra "Edit someone else's work". Full changes every entry.
// The database decides (finance.may_write_partner, OWN-02); this is the same rule for the screen.

/** What api.finance_my_clients answers: every client, or the ones whose entries the person may change. */
export type MyClients = { all: boolean; partners: readonly string[] };

/** Nothing is theirs: what the screen assumes until the database has answered, and when its answer is not one. */
export const NO_CLIENTS: MyClients = { all: false, partners: [] };

/** The database's answer, read once; anything that is not such an answer is "none". */
export function myClientsOf(answer: unknown): MyClients {
  if (!answer || typeof answer !== 'object') return NO_CLIENTS;
  const a = answer as { all?: unknown; partners?: unknown };
  return {
    all: a.all === true,
    partners: Array.isArray(a.partners) ? a.partners.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** Typing an invoice: Own or Full on Finance. At Own the database keeps it only when the client is their own. */
export function mayTypeInvoice(level: string | undefined | null): boolean {
  return level === 'full' || level === 'own';
}

/** Changing an entry recorded under this organisation: every client is open to them, or this one is theirs. An
 *  entry under no organisation is nobody's own. */
export function mayChangeEntryOf(mine: MyClients, partnerId: string | null | undefined): boolean {
  if (mine.all) return true;
  return !!partnerId && mine.partners.includes(partnerId);
}
