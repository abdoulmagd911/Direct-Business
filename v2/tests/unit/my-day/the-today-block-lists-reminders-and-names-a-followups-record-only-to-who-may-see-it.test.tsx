/**
 * The Today block, drawn without a browser (productivity Stage 2): a reminder due today or overdue is a row with a tick;
 * a follow-up says "Follow up: <record>" only when the database named the record for this reader and just "Follow up"
 * when it did not (V454); a failed reminders read draws its own failed line while the tasks still draw; nothing at all
 * draws "Nothing due today". Names are made up. Sabotage: tests/sabotage/stage2-capture-today.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { TodayBlock } from '../../../src/modules/my-day/screens/TodayBlock';
import type { DueReminder } from '../../../src/modules/my-day/reminder-alert';
import type { AboutRecord } from '../../../src/modules/my-day/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const DAY = '2026-10-14';
const draw = (props: Partial<Parameters<typeof TodayBlock>[0]>, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      <TodayBlock tasks={[]} day={DAY} statuses={[]} due={{ due: [], next_at: null }} {...props} />
    </NextIntlClientProvider>,
  );
const dueFollowUp = (
  about: AboutRecord | null,
): { due: (DueReminder & { about: AboutRecord | null })[]; next_at: null } => ({
  next_at: null,
  due: [
    {
      id: 'f1',
      note_id: 'n1',
      text: 'Ask about the renewal',
      remind_at: '2026-10-14T08:00:00+03:00',
      notification_id: 'a1',
      about,
    },
  ],
});

describe('the Today block with reminders', () => {
  it('lists a reminder due now and one overdue, each with a tick that says what it ends', () => {
    const html = draw({
      due: {
        next_at: null,
        due: [
          {
            id: 'r1',
            note_id: 'n-r1',
            text: 'Call Sahab Tech',
            remind_at: '2026-10-14T08:00:00+03:00',
            notification_id: 'n1',
          },
          {
            id: 'r2',
            note_id: 'n-r2',
            text: 'Send the Dune Foods file',
            remind_at: '2026-10-13T09:00:00+03:00',
            notification_id: 'a2',
          },
        ],
      },
    });
    expect(html).toContain('data-today-reminder="r1"');
    expect(html).toContain('data-today-reminder="r2"');
    expect(html.match(/data-reminder-done/g)).toHaveLength(2);
    expect(html).toContain('Mark “Call Sahab Tech” done');
    expect(html).toContain('data-today-group="overdue"');
    expect(html).not.toContain('Nothing due today');
  });
  it('lists a reminder the job has not sent yet if it falls today, and leaves out one for a later day', () => {
    const html = draw({
      pending: [
        { id: 'p1', note_id: null, text: 'Later today', remind_at: '2026-10-14T15:00:00+03:00' },
        { id: 'p2', note_id: null, text: 'Next week', remind_at: '2026-10-18T09:00:00+03:00' },
      ],
    });
    expect(html).toContain('data-today-reminder="p1"');
    expect(html).not.toContain('data-today-reminder="p2"');
  });
  it('says "Nothing due today" when there is nothing, and draws Arabic without a missing key', () => {
    expect(draw({})).toContain('Nothing due today');
    const html = draw(
      { pending: [{ id: 'p1', note_id: null, text: 'تذكير', remind_at: '2026-10-14T15:00:00+03:00' }] },
      'ar',
    );
    expect(html).toContain('data-today-reminder="p1"');
    expect(html).not.toMatch(/pages\.myDay\.today/);
  });
  it('draws its own failed line when the reminders could not be read, and still draws the tasks', () => {
    const html = draw({
      due: null,
      tasks: [
        {
          id: 't1',
          number: 'T-1',
          title: 'A task',
          due_on: DAY,
          partner_id: null,
          partner_name: null,
          group: 'today',
          role: 'owner',
        },
      ],
    });
    expect(html).toContain('data-state="failed"');
    expect(html).toContain('Reminders could not be read just now.');
    expect(html).toContain('data-today-task="T-1"');
  });
});

describe('a follow-up names its record only to a reader who may see it (V454)', () => {
  it('tags the record when the database named it, and keeps the words the person wrote as the title', () => {
    const html = draw({ due: dueFollowUp({ entity: 'partner', id: 'c1', label: 'Waha Foods' }) });
    expect(html).toContain('Follow up: Waha Foods');
    expect(html).toContain('Ask about the renewal');
  });
  it('says only "Reminder" when the record is not this reader\'s to see', () => {
    const html = draw({ due: dueFollowUp(null) });
    expect(html).toContain('Ask about the renewal');
    expect(html).not.toContain('Follow up:');
    expect(html).not.toContain('Waha Foods');
  });
  it("never takes the record's name as the title when a follow-up has no words (QA-560)", () => {
    const f = dueFollowUp({ entity: 'partner', id: 'c1', label: 'Waha Foods' });
    f.due[0]!.text = '';
    const html = draw({ due: f });
    expect(html.replace('Follow up: Waha Foods', '')).not.toContain('Waha Foods');
  });
});

describe('"Today" is drawn once in a row (QA-564)', () => {
  const now = {
    next_at: null,
    due: [
      {
        id: 'a',
        note_id: 'n-a',
        text: 'Call Sahab Tech',
        remind_at: '2026-10-14T08:00:00+03:00',
        notification_id: 'x1',
      },
    ],
  };
  const late = {
    id: 'b',
    note_id: 'n-b',
    text: 'Send the Dune Foods file',
    remind_at: '2026-10-13T09:00:00+03:00',
    notification_id: 'x2',
  };
  const headings = (html: string) =>
    (html.match(/<h[23][^>]*>.*?<\/h[23]>/g) ?? []).map((h) => h.replace(/<[^>]+>/g, ''));
  it('titles the card Today and its groups never just Today: Overdue, Due today, Next 7 days', () => {
    expect(headings(draw({ due: now }))).toEqual(['Today', 'Due today']);
    expect(headings(draw({ due: { ...now, due: [...now.due, late] } }))).toEqual(['Today', 'Overdue1', 'Due today']);
  });
  it('says Today once with an overdue task and a task due today and one next: the card title only', () => {
    const task = (id: string, due_on: string) =>
      ({ id, number: `T-${id}`, title: `Made-up task ${id}`, due_on, status_id: 's', helping: false }) as never;
    const html = draw({
      tasks: [task('a', '2026-10-12'), task('b', '2026-10-14'), task('c', '2026-10-16')],
    });
    expect(headings(html)).toEqual(['Today', 'Overdue1', 'Due today', 'Next 7 days']);
    expect(headings(html).filter((h) => h === 'Today')).toHaveLength(1);
  });
  it('says the same in Arabic: the groups read متأخرة · مستحق اليوم · الأيام السبعة القادمة', () => {
    const task = (id: string, due_on: string) =>
      ({ id, number: `T-${id}`, title: `Made-up task ${id}`, due_on, status_id: 's', helping: false }) as never;
    const html = draw({ tasks: [task('a', '2026-10-12'), task('b', '2026-10-14'), task('c', '2026-10-16')] }, 'ar');
    expect(headings(html)).toEqual(['اليوم', 'متأخرة1', 'مستحق اليوم', 'الأيام السبعة القادمة']);
  });
});
