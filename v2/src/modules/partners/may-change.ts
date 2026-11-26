// Who may change an organisation (Landing 55, the owner's approved design of 22 Nov 2026: a team member changes
// their own organisations, never a colleague's). The database decides (partner.may_change, partner.side_writable,
// OWN-01); this is the same rule for the screen, so a button is offered only where its save is allowed.
import { SIDE_PAGE, type Side } from './types';

type WithAccess = {
  person: { id: string; role: { key: string; is_admin: boolean } | null };
  levels: Record<string, string | undefined>;
  capabilities: readonly string[];
};
type SideSeen = { side: Side; owner_id: string | null };

const levelOn = (me: WithAccess, side: Side) => me.levels[SIDE_PAGE[side]] ?? 'none';

/** The extra "Edit someone else's work" (Landing 40): an admin by role, or a person set to Allowed — never a Viewer. */
export function editsOthersWork(me: WithAccess): boolean {
  const role = me.person.role;
  if (!role) return false;
  if (role.is_admin === true) return true;
  return role.key !== 'viewer' && me.capabilities.includes('records.edit_others');
}

/** One side that is on: Full on its page, or Own and its owner — or Own with the extra. */
export function mayWriteSide(me: WithAccess, side: SideSeen | null): boolean {
  if (!side) return false;
  const level = levelOn(me, side.side);
  if (level === 'full') return true;
  return level === 'own' && (side.owner_id === me.person.id || editsOthersWork(me));
}

/** The organisation itself — its names, details, contacts, client IDs, archive and removal: a side that is on which
 *  the person may write. With no side on, Full on either page. */
export function mayChangeOrganisation(me: WithAccess, sidesOn: readonly SideSeen[]): boolean {
  if (sidesOn.length === 0) return levelOn(me, 'client') === 'full' || levelOn(me, 'supplier_partner') === 'full';
  return sidesOn.some((s) => mayWriteSide(me, s));
}

/** A side's type, tier and start, and switching it on or off: who may write it when it is on; when it is not yet on,
 *  who may change the organisation and holds that side's page at Own or above. */
export function mayChangeSide(me: WithAccess, side: Side, sidesOn: readonly SideSeen[]): boolean {
  const on = sidesOn.find((s) => s.side === side);
  if (on) return mayWriteSide(me, on);
  const level = levelOn(me, side);
  return (level === 'full' || level === 'own') && mayChangeOrganisation(me, sidesOn);
}

/** Adding an organisation on a side: Own or above — the one who adds it is its owner. */
export function mayAddOrganisation(me: WithAccess, side: Side): boolean {
  const level = levelOn(me, side);
  return level === 'full' || level === 'own';
}

/** A person's own entry on an organisation — a note, a logged activity: Own or above on a side that is on. It
 *  changes nothing of the organisation's, so it does not ask whose the organisation is. */
export function mayLogOn(me: WithAccess, sidesOn: readonly SideSeen[]): boolean {
  return sidesOn.some((s) => {
    const level = levelOn(me, s.side);
    return level === 'full' || level === 'own';
  });
}
