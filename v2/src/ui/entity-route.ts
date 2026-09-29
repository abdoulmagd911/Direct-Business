/**
 * Where a record of a registry entity opens (a notification, a search hit, a Recently deleted row). Only pages that
 * exist are named: an entity without a page yet stays plain text until its screen lands (the partner record page in
 * P3-9, tasks in P5-2 …).
 */
export function entityRoute(entity: string | null | undefined, id: string | null | undefined): string | null {
  if (!entity || !id) return null;
  switch (entity) {
    case 'person':
    case 'person_email':
    case 'person_auth':
    case 'person_level':
    case 'person_capability':
    case 'person_team':
    case 'person_department':
      return entity === 'person' ? `/people/${id}` : null;
    case 'team':
      return '/settings/org?tab=teams';
    case 'department':
      return '/settings/org?tab=teams';
    case 'role':
    case 'role_level':
    case 'role_capability':
      return entity === 'role' ? '/settings/org?tab=roles' : '/settings/org?tab=access';
    case 'setting':
    case 'setting_def':
      return '/activity?tab=settings';
    case 'profile':
      return '/profile';
    default:
      return null;
  }
}
