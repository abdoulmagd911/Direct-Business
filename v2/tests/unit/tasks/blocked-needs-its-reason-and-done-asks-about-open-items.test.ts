import { describe, expect, it } from 'vitest';
import { planMove, statusMoves, statusView, type Move } from '@/modules/tasks/rules';
import { STATUSES, row } from './fixtures';

const to = (key: string): Move => ({ kind: 'status', status: STATUSES.find((s) => s.key === key)! });
const keys = (moves: Move[]) => moves.map((m) => (m.kind === 'block' ? 'blocked' : m.status.key));

describe('status: the four locked meanings, Blocked with its reason, Done asks about open items (V401, V191)', () => {
  it('Blocked is In progress with a reason', () => {
    expect(statusView(row({ meaning: 'in_progress', blocked_reason: 'Waiting for the visa' }))).toBe('blocked');
    expect(statusView(row({ meaning: 'in_progress' }))).toBe('in_progress');
  });

  it('a task offers every status but its own, and Blocked after In progress', () => {
    expect(keys(statusMoves(row(), STATUSES))).toEqual(['in_progress', 'blocked', 'done', 'cancelled']);
    expect(keys(statusMoves(row({ status: 'in_progress', meaning: 'in_progress' }), STATUSES))).toEqual([
      'not_started',
      'blocked',
      'done',
      'cancelled',
    ]);
  });

  it('a blocked task resumes by choosing In progress, and is not offered Blocked again', () => {
    const blocked = row({ status: 'in_progress', meaning: 'in_progress', blocked_reason: 'Waiting' });
    expect(keys(statusMoves(blocked, STATUSES))).toEqual(['not_started', 'in_progress', 'done', 'cancelled']);
  });

  it('a retired status is not offered', () => {
    const retired = STATUSES.map((s) => (s.key === 'cancelled' ? { ...s, active: false } : s));
    expect(keys(statusMoves(row(), retired))).not.toContain('cancelled');
  });

  it('Blocked asks for its reason, and sends it with In progress', () => {
    expect(planMove(row(), { kind: 'block' }, STATUSES)).toEqual({ ask: 'reason' });
    expect(planMove(row(), { kind: 'block' }, STATUSES, { reason: '   ' })).toEqual({ ask: 'reason' });
    expect(planMove(row(), { kind: 'block' }, STATUSES, { reason: ' Waiting for the visa ' })).toEqual({
      go: { p_status: 'in_progress', p_reason: 'Waiting for the visa' },
    });
    expect(planMove(row(), { kind: 'block' }, STATUSES, { reason: 'x'.repeat(501) })).toEqual({
      refuse: 'reason_too_long',
    });
  });

  it('Done with open action items asks first, then closes them in the same request', () => {
    const t = row({ open_action_items: 2 });
    expect(planMove(t, to('done'), STATUSES)).toEqual({ ask: 'close_items', count: 2 });
    expect(planMove(t, to('done'), STATUSES, { closeItems: true })).toEqual({
      go: { p_status: 'done', p_close_items: true },
    });
    expect(planMove(row(), to('done'), STATUSES)).toEqual({ go: { p_status: 'done' } });
    expect(planMove(t, to('cancelled'), STATUSES)).toEqual({ go: { p_status: 'cancelled' } });
  });
});
