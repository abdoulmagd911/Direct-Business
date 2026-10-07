import 'server-only';
import type { Me } from '@/core/auth/me';
import { atLeast } from '@/core/access/levels';
import { serverRpc } from '@/core/db/server-rpc';
import { readOrFail as maybe } from '@/modules/org/read-or-fail';
import type { OrgAnswer } from '@/modules/org/types';
import type { NamePick, TaskStatus } from './types';

/** What every Tasks screen names things with: the statuses, the people, the clients and the projects one may see. */
export type TaskLookups = {
  statuses: TaskStatus[];
  org: OrgAnswer | null;
  partners: NamePick[];
  projects: NamePick[];
  /** The reads that failed for a reason other than access, said in words with Try again (never drawn as empty). */
  failed: string[];
};

type PartnerRow = { id: string; number: string; trade_name_en: string; trade_name_ar: string | null };
type ProjectRow = { id: string; number: string; name: string };

/**
 * The names a task points at. Clients come from the Clients list and projects from the Projects list — each read only
 * with a level there, so a member without Projects (the pilot hides it, V517) is simply offered none.
 */
export async function loadLookups(me: Me, failed: string[] = []): Promise<TaskLookups> {
  const sees = (page: string) => atLeast(me.levels[page] ?? 'none', 'view');
  const [statuses, org, partners, projects] = await Promise.all([
    maybe<TaskStatus[]>('statuses', failed, () => serverRpc('list', { p_list: 'task_status' })),
    maybe<OrgAnswer>('org', failed, () => serverRpc('org', {} as never)),
    sees('clients')
      ? maybe<{ rows: PartnerRow[] }>('partners', failed, () =>
          serverRpc('partners', { p_filters: { side: 'client' }, p_limit: 500 }),
        )
      : Promise.resolve(null),
    sees('projects')
      ? maybe<{ rows: ProjectRow[] }>('projects', failed, () =>
          serverRpc('projects', { p_filter: { categories: ['planned', 'active', 'on_hold'] }, p_limit: 200 }),
        )
      : Promise.resolve(null),
  ]);
  return {
    statuses: statuses ?? [],
    org,
    partners: (partners?.rows ?? []).map((p) => ({
      id: p.id,
      number: p.number,
      name_en: p.trade_name_en,
      name_ar: p.trade_name_ar,
    })),
    projects: (projects?.rows ?? []).map((p) => ({ id: p.id, number: p.number, name_en: p.name, name_ar: null })),
    failed,
  };
}
