/**
 * Landing 44 — under a What choice, an entry shows only its changes of the chosen kind. The log lists a whole
 * request when any one of its changes is of that kind; the seed import of 20 Nov (1,384 changes over 28 record
 * types, 8 of them comments) came in under "Comment" and was drawn whole, named after its first change,
 * "Organisation added" — the Activity filter looked as if it had not narrowed. Every value is made up.
 * Sabotage: tests/sabotage/landing-44.mjs.
 */
import { describe, expect, it, vi } from 'vitest';
import { onlyWhat } from '../../../src/modules/settings/screens/ActivityScreen';
import type { HistoryRow } from '../../../src/ui/record/history';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/activity',
}));

const change = (entity: string, action = 'insert') => ({ entity, id: `${entity}-1`, action, fields: [] });
const row = (request_id: string, changes: HistoryRow['changes']): HistoryRow => ({
  request_id,
  at: '2026-11-20T06:50:00+03:00',
  actor_id: null,
  kind: 'system',
  label_key: 'audit.unattended_write',
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes,
});

const seed = row('seed', [
  change('partner'),
  change('contact'),
  change('comment'),
  change('task'),
  change('task_comment'),
]);
const said = row('said', [change('comment')]);

describe('under a What choice, an entry shows only its changes of that kind', () => {
  it('a request that wrote many kinds at once shows its comment changes only', () => {
    const [kept] = onlyWhat([seed], 'task_comment,comment');
    expect(kept?.changes.map((c) => c.entity)).toEqual(['comment', 'task_comment']);
  });
  it('its first change is a comment, so it is named as one — never "Organisation added"', () => {
    expect(onlyWhat([seed], 'task_comment,comment')[0]?.changes[0]?.entity).toBe('comment');
  });
  it('a comment-only entry is left as it is', () => {
    expect(onlyWhat([said], 'comment')).toEqual([said]);
  });
  it('an entry left with none of the chosen kind is not drawn', () => {
    expect(onlyWhat([row('other', [change('partner')]), said], 'comment').map((r) => r.request_id)).toEqual(['said']);
  });
  it('without a choice every entry and every change stays', () => {
    expect(onlyWhat([seed, said], '')).toEqual([seed, said]);
  });
  it('the choice is read as the picker writes it: keys joined with "," and spaces ignored', () => {
    expect(onlyWhat([seed], ' task_comment , comment ')[0]?.changes).toHaveLength(2);
  });
  it('the entries themselves are not changed', () => {
    onlyWhat([seed], 'comment');
    expect(seed.changes).toHaveLength(5);
  });
});
