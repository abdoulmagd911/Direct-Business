// Who imports files on Finance (Landing 40, per-member settings): a specific extra, not every member's. The capability
// finance.import — an admin and a head of department by role, or a person whose record says "Allowed"; never a Viewer.
// The database decides (work.import_require, XTR-01); this is the same rule for the screen.

type WithAccess = { person: { role: { key: string; is_admin: boolean } | null }; capabilities: readonly string[] };

/** Whether the import section is offered to this person. */
export function mayImportFinance(me: WithAccess): boolean {
  const role = me.person.role;
  if (!role) return false;
  if (role.is_admin === true) return true;
  return role.key !== 'viewer' && me.capabilities.includes('finance.import');
}
