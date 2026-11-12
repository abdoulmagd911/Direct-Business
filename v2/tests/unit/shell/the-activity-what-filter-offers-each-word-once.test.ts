/**
 * The /activity What filter (F-B1-07, Landing 15 Group C): one option per displayed word — "Achievement" was
 * offered three times, "Comment" twice and "Targets" three times — and one option keeps every record type its
 * word stands for, so the read still shows each one's rows. Older pages merge by request, never twice (F-B4-04).
 * Every value is made up.
 */
import { describe, expect, it, vi } from 'vitest';
import { mergeActivityRows, whatFilterOptions } from '../../../src/modules/settings/screens/ActivityScreen';
import type { HistoryRow } from '../../../src/ui/record/history';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/activity',
}));

const row = (request_id: string, at: string): HistoryRow => ({
  request_id,
  at,
  actor_id: null,
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes: [],
});

describe('the What filter offers each word once', () => {
  it('dedups by displayed label and keeps every key behind the word', () => {
    const options = whatFilterOptions([
      { key: 'achievement', label: 'Achievement' },
      { key: 'achievement_ref', label: 'Achievement' },
      { key: 'achievement_participant', label: 'Achievement' },
      { key: 'comment', label: 'Comment' },
      { key: 'task_comment', label: 'Comment' },
      { key: 'plan', label: 'Targets' },
      { key: 'target', label: 'Targets' },
      { key: 'achievement_category', label: 'Targets' },
      { key: 'task', label: 'Task' },
    ]);
    expect(options.map((o) => o.label)).toEqual(['Achievement', 'Comment', 'Targets', 'Task']);
    expect(options.find((o) => o.label === 'Achievement')?.value).toBe(
      'achievement,achievement_ref,achievement_participant',
    );
    expect(options.find((o) => o.label === 'Comment')?.value).toBe('comment,task_comment');
    expect(options.find((o) => o.label === 'Targets')?.value).toBe('plan,target,achievement_category');
    expect(options.find((o) => o.label === 'Task')?.value).toBe('task');
  });
  it('keeps a repeated key out and sorts by label', () => {
    expect(
      whatFilterOptions([
        { key: 'task', label: 'Task' },
        { key: 'task', label: 'Task' },
        { key: 'note', label: 'Note' },
      ]),
    ).toEqual([
      { value: 'note', label: 'Note' },
      { value: 'task', label: 'Task' },
    ]);
  });
});

describe('older pages merge by request', () => {
  it('appends the older page and drops a request already read', () => {
    const first = [row('r1', '2026-11-08T09:00:00Z'), row('r2', '2026-11-08T08:00:00Z')];
    const page = [row('r2', '2026-11-08T08:00:00Z'), row('r3', '2026-11-07T09:00:00Z')];
    expect(mergeActivityRows(first, page).map((r) => r.request_id)).toEqual(['r1', 'r2', 'r3']);
    expect(mergeActivityRows(first, [])).toEqual(first);
  });
});
