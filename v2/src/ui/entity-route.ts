/**
 * Where a record of a registry entity opens (a notification, a search hit, a Recently deleted row). Only pages that
 * exist are named: an entity without a page yet stays plain text until its screen lands.
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
      return '/settings/org?tab=access';
    case 'setting':
    case 'setting_def':
      return '/activity?tab=settings';
    case 'profile':
      return '/profile';
    case 'partner':
    case 'partner_side':
    case 'side_status':
    case 'side_owner':
    case 'identifier':
    case 'contact':
    case 'reference':
    case 'contract':
    case 'credit_limit':
      // One organisation, two doors: /partners/[id] opens the list's record page the reader may see (V98, V147).
      return entity === 'partner' ? `/partners/${id}` : null;
    case 'task':
      // The record page takes the id or the TSK-number (V271).
      return `/tasks/${id}`;
    case 'achievement':
      return `/kpis/achievements/${id}`;
    default:
      return null;
  }
}
