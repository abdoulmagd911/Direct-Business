import 'server-only';
import { cache } from 'react';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';

/**
 * Which account the signed-in person is (V444, V445): 'team_member', or the owner's 'admin_account', or the
 * 'test_account'. `api.me()` does not carry it yet (NEED builder A), so it is read from `api.org()`, which serves the
 * mark for everyone (#115); a read that fails reads as a team member — nothing is hidden from a person by accident.
 */
export const accountOf = cache(async (personId: string): Promise<string> => {
  try {
    const org = (await serverRpc('org', {} as never)) as unknown as OrgAnswer;
    return org.people.find((p) => p.id === personId)?.account ?? 'team_member';
  } catch {
    return 'team_member';
  }
});
