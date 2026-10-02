import type { OrgPerson } from './types';

/**
 * The people a person picker offers as owner, assignee or helper (V465): team members only. api.org already leaves
 * out switched-off people; the owner's admin account and the test account are never team members (V444, V445), so
 * they are never offered either. The server still refuses anyone unavailable, whatever a screen offered.
 */
export function assignablePeople<P extends Pick<OrgPerson, 'account'>>(people: readonly P[]): P[] {
  return people.filter((p) => !p.account || p.account === 'team_member');
}
