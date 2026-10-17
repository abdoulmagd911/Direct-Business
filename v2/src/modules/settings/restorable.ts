import { serverRpc } from '@/core/db/server-rpc';
import type { DeletedRow } from './screens/RecentlyDeleted';

/** QA-576: marks each removed record with whether this person may bring it back, so the screen draws Restore only there. */
export async function withRestorable(rows: DeletedRow[]): Promise<DeletedRow[]> {
  if (!rows.length) return rows;
  try {
    const keys = new Set(
      (await serverRpc('restorable', {
        p_items: rows.map((r) => ({ entity: r.entity, id: r.id })),
      } as never)) as unknown as string[],
    );
    return rows.map((r) => ({ ...r, can_restore: keys.has(`${r.entity}:${r.id}`) }));
  } catch {
    // the list still shows; pressing Restore says plainly if it is not allowed
    return rows;
  }
}
