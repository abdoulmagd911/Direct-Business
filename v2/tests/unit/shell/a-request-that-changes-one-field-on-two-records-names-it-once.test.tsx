/**
 * QA-190: one request that changes the same field on two records (a person with two emails: "Password set at" on each)
 * lists that field once in Activity, with each distinct before → after — never twice. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "history-lists-a-field-twice".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ActivityTimeline, type HistoryRow } from '../../../src/ui/record/ActivityTimeline';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const row = (changes: HistoryRow['changes']): HistoryRow => ({
  request_id: 'r1',
  at: '2026-10-01T08:00:00Z',
  actor_id: null,
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes,
});

const html = (rows: HistoryRow[]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ActivityTimeline rows={rows} people={{}} onChanged={() => {}} />
    </NextIntlClientProvider>,
  );

describe('Activity names a field once per request', () => {
  it('two records changing the same field give one chip', () => {
    const out = html([
      row([
        {
          entity: 'person_auth',
          id: 'a',
          action: 'update',
          fields: ['must_change_password'],
          before: { must_change_password: false },
          after: { must_change_password: true },
        },
        {
          entity: 'person_auth',
          id: 'b',
          action: 'update',
          fields: ['must_change_password'],
          before: { must_change_password: false },
          after: { must_change_password: true },
        },
      ]),
    ]);
    expect(out.match(/data-history-field="must_change_password"/g), 'one chip for the field').toHaveLength(1);
  });
  it('different fields keep their own chips, and different values on one field say each', () => {
    const out = html([
      row([
        {
          entity: 'person',
          id: 'a',
          action: 'update',
          fields: ['job_title_en', 'nickname_en'],
          before: { job_title_en: 'A', nickname_en: null },
          after: { job_title_en: 'B', nickname_en: 'Nick' },
        },
        {
          entity: 'person',
          id: 'b',
          action: 'update',
          fields: ['job_title_en'],
          before: { job_title_en: 'C' },
          after: { job_title_en: 'D' },
        },
      ]),
    ]);
    expect(out.match(/data-history-field="job_title_en"/g)).toHaveLength(1);
    expect(out.match(/data-history-field="nickname_en"/g)).toHaveLength(1);
    expect(out).toContain('A → B');
    expect(out).toContain('C → D');
  });
});
