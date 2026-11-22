/**
 * Landing 33 (B3, B4, B5) — the rules of the task features that are not paint, and the board's card as it is drawn.
 *  B3  a hand-over needs a person and a reason; the reason is required and 120 characters at most; the words for an
 *      empty reason are the owner's, exactly; the door's refusals read in the Tasks catalog's words, in both languages;
 *      the task's deputy ticks its steps.
 *  B4  a row or a card with steps says how many are done ("3 of 4 steps"); a task with none says nothing.
 *  B5  a card dropped on a column makes the move the status pill would: nothing where it already is; Blocked is the
 *      Block move; a blocked card on In progress resumes; a column of no live status takes nothing. A card whose
 *      status the reader may move has a grip (44 px, no browser scrolling on it) and is marked as draggable; a card
 *      the reader may not move has neither. Each card keeps ONE pill.
 * Every value is made up. Sabotages: tests/sabotage/landing-33.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import {
  HAND_OVER_REASON_MAX,
  canTick,
  handOverReason,
  handOverValues,
  refusalKey,
} from '../../../src/modules/tasks/rules';
import { TaskBoard } from '../../../src/modules/tasks/screens/TaskBoard';
import { StepsMark } from '../../../src/modules/tasks/screens/TaskBits';
import { dropMove, statusGroups } from '../../../src/modules/tasks/screens/look';
import { ME, OTHER, STATUSES, row } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: '00000000-0000-4000-8000-000000000001' }, capabilities: [], levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('B3 · a hand-over', () => {
  it('needs a person, never myself, and a reason', () => {
    expect(handOverValues({ reason: 'Made-up reason' }, ME)).toEqual({ error: 'to_required' });
    expect(handOverValues({ to: ME, reason: 'Made-up reason' }, ME)).toEqual({ error: 'to_yourself' });
    expect(handOverValues({ to: OTHER, reason: '' }, ME)).toEqual({ error: 'reason_required' });
    expect(handOverValues({ to: OTHER, reason: ' \n ' }, ME)).toEqual({ error: 'reason_required' });
  });
  it('takes a reason of 120 characters and refuses 121', () => {
    expect(HAND_OVER_REASON_MAX).toBe(120);
    expect(handOverValues({ to: OTHER, reason: 'x'.repeat(121) }, ME)).toEqual({ error: 'reason_too_long' });
    expect(handOverValues({ to: OTHER, reason: ` ${'x'.repeat(120)} ` }, ME)).toEqual({
      values: { p_to: OTHER, p_note: 'x'.repeat(120) },
    });
    expect(handOverReason('')).toEqual({ error: 'reason_required' });
    expect(handOverReason('x'.repeat(121))).toEqual({ error: 'reason_too_long' });
    expect(handOverReason(' Made-up reason ')).toEqual({ reason: 'Made-up reason' });
  });
  it('says the owner’s words for an empty reason, exactly, and has them in Arabic', () => {
    expect(en.pages.tasks.delegate.reason_required).toBe('Give a reason. Every hand-over needs one.');
    expect(en.pages.tasks.errors.task.hand_over_reason_required).toBe('Give a reason. Every hand-over needs one.');
    expect(ar.pages.tasks.delegate.reason_required).toBe('اذكر السبب. كل تسليم يحتاج إلى سبب.');
    expect(en.pages.tasks.delegate.open).toBe('Hand over');
  });
  it('reads the door’s refusals in the Tasks catalog’s words, in both languages', () => {
    for (const k of [
      'hand_over_not_yours',
      'hand_over_reason_required',
      'hand_over_reason_too_long',
      'owner_cannot_see_partner',
      'deputy_is_responsible',
      'deputy_cannot_see',
      'deputy_unchanged',
    ] as const) {
      expect(refusalKey(`errors.task.${k}`)).toBe(`pages.tasks.errors.task.${k}`);
      expect(en.pages.tasks.errors.task[k], `en ${k}`).toBeTruthy();
      expect(ar.pages.tasks.errors.task[k], `ar ${k}`).toBeTruthy();
    }
  });
  it('lets the task’s deputy tick its steps, and not a stranger', () => {
    const item = { owner_id: 'someone', helpers: [] };
    expect(canTick(item, { can_edit: false, deputy_id: ME }, ME)).toBe(true);
    expect(canTick(item, { can_edit: false, deputy_id: OTHER }, ME)).toBe(false);
    expect(canTick(item, { can_edit: false, deputy_id: null }, ME)).toBe(false);
  });
  it('says Partner, not Client, where a task needs one', () => {
    expect(en.pages.tasks.errors.task.client_work_needs_partner).toBe('Partner work needs a partner or a project');
    // every WORD on the task screens (the values; a key's name is never on screen)
    const words = (x: unknown): string[] =>
      typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(words) : [];
    for (const w of words(en.pages.tasks)) expect(w).not.toMatch(/\bclients?\b/i);
    for (const w of words(ar.pages.tasks)) expect(w).not.toMatch(/عميل|عملاء/);
  });
});

describe('B4 · the steps done', () => {
  it('say "3 of 4 steps" on a task with four steps and one still open', () => {
    const html = draw(<StepsMark row={{ open_action_items: 1, action_items_total: 4 }} locale="en" />);
    expect(html).toContain('data-task-steps="3/4"');
    expect(html).toContain('3 of 4 steps');
    expect(html).toContain('width:75%');
  });
  it('say nothing on a task with none', () => {
    expect(draw(<StepsMark row={{ open_action_items: 0, action_items_total: 0 }} locale="en" />)).toBe('');
    expect(draw(<StepsMark row={{ open_action_items: 0 }} locale="en" />)).toBe('');
  });
  it('read in Arabic', () => {
    expect(draw(<StepsMark row={{ open_action_items: 0, action_items_total: 3 }} locale="ar" />, 'ar')).toContain(
      '3 من 3 خطوات',
    );
  });
});

describe('B5 · a card dropped on a column', () => {
  const cols = statusGroups([row()], STATUSES);
  const col = (key: string) => cols.find((c) => c.key === key)!;
  it('makes no move where it already is', () => {
    expect(dropMove(row(), col('not_started'))).toBeNull();
    const blocked = row({ status: 'in_progress', meaning: 'in_progress', blocked_reason: 'Made-up wait' });
    expect(dropMove(blocked, col('blocked'))).toBeNull();
  });
  it('moves to the column’s status', () => {
    expect(dropMove(row(), col('in_progress'))).toEqual({ kind: 'status', status: STATUSES[1] });
    expect(dropMove(row(), col('done'))).toEqual({ kind: 'status', status: STATUSES[2] });
  });
  it('dropped on Blocked is the Block move, which asks its reason', () => {
    expect(dropMove(row(), col('blocked'))).toEqual({ kind: 'block' });
    expect(dropMove(row({ status: 'in_progress', meaning: 'in_progress' }), col('blocked'))).toEqual({ kind: 'block' });
  });
  it('a blocked card dropped on In progress resumes', () => {
    const blocked = row({ status: 'in_progress', meaning: 'in_progress', blocked_reason: 'Made-up wait' });
    expect(dropMove(blocked, col('in_progress'))).toEqual({ kind: 'status', status: STATUSES[1] });
  });
  it('a column that names no live status takes nothing', () => {
    expect(dropMove(row(), { key: 'gone', kind: 'status', status: null })).toBeNull();
    expect(dropMove(row(), { key: 'done', kind: 'status', status: { ...STATUSES[2]!, active: false } })).toBeNull();
  });
});

describe('B5 · the board’s card', () => {
  const lookups = {
    statuses: STATUSES,
    priorities: [],
    org: { departments: [], teams: [], roles: [], people: [] },
    partners: [],
    projects: [],
    failed: [],
  } as never;
  const mine = row({ id: 'm1', number: 'TSK-2026-0201', title: 'Made-up mine', can_edit: true, can_act: true });
  const deputys = row({
    id: 'm2',
    number: 'TSK-2026-0202',
    title: 'Made-up as deputy',
    can_edit: false,
    can_act: true,
  });
  const theirs = row({ id: 'm3', number: 'TSK-2026-0203', title: 'Made-up theirs', can_edit: false, can_act: false });
  const steps = row({
    id: 'm4',
    number: 'TSK-2026-0204',
    title: 'Made-up with steps',
    can_edit: true,
    can_act: true,
    open_action_items: 1,
    action_items_total: 4,
  });
  const html = draw(<TaskBoard rows={[mine, deputys, theirs, steps]} lookups={lookups} today="2026-11-22" />);
  const card = (number: string) => {
    const from = html.indexOf(`data-board-card="${number}"`);
    const next = html.indexOf('data-board-card="', from + 10);
    return html.slice(html.lastIndexOf('<li', from), next === -1 ? undefined : html.lastIndexOf('<li', next));
  };
  it('drags for whoever may move its status — the editor and the deputy', () => {
    expect(card('TSK-2026-0201')).toContain('data-draggable');
    expect(card('TSK-2026-0202')).toContain('data-draggable');
    expect(card('TSK-2026-0201')).toContain('data-board-grip');
  });
  it('does not drag for a reader who may not move it', () => {
    expect(card('TSK-2026-0203')).not.toContain('data-draggable');
    expect(card('TSK-2026-0203')).not.toContain('data-board-grip');
  });
  it('has a grip a finger can hold: 44 px, and no browser scrolling on it', () => {
    const grip = card('TSK-2026-0201').match(/<span[^>]*data-board-grip[^>]*>/)![0];
    expect(grip).toContain('size-11');
    expect(grip).toContain('touch-none');
    expect(grip).toContain('Drag “Made-up mine” to another column');
  });
  it('keeps ONE pill, and the pill is not a drag', () => {
    for (const n of ['TSK-2026-0201', 'TSK-2026-0203']) expect(card(n).match(/data-task-pill=/g)).toHaveLength(1);
    expect(card('TSK-2026-0201')).toMatch(/data-task-pill="not_started" data-no-drag/);
  });
  it('says the steps done on a card that has steps, and nothing on one that has none', () => {
    expect(card('TSK-2026-0204')).toContain('data-task-steps="3/4"');
    expect(card('TSK-2026-0201')).not.toContain('data-task-steps');
  });
  it('counts each column', () => {
    expect(html).toMatch(/data-board-column="not_started"[^>]*data-count="4"/);
    expect(html).toMatch(/data-board-column="in_progress"[^>]*data-count="0"/);
  });
});
