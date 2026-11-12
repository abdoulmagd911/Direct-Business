/**
 * FIX-18, F-B4-03: on /activity a "Contract added" row title opens the partner the contract belongs to — contracts
 * have no page of their own; the partner's Overview rail lists them. The change's after is the new contract row,
 * partner_id always present. An "Invoice added" row stays plain text: no invoice page exists (D-2, finance
 * finalisation) — never a link to nowhere, never /finance. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ActivityTimeline, type HistoryRow } from '../../../src/ui/record/ActivityTimeline';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const row = (changes: HistoryRow['changes']): HistoryRow => ({
  request_id: 'r1',
  at: '2026-11-07T08:00:00Z',
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

describe('a contract row opens its partner', () => {
  it('a "Contract added" row links to the partner in its after', () => {
    const out = html([
      row([
        {
          entity: 'contract',
          id: 'c1',
          action: 'insert',
          fields: ['partner_id', 'title', 'start_on'],
          before: null,
          after: { partner_id: 'p1', side: 'client', kind: 'contract', title: 'Agreement', start_on: '2026-11-07' },
        },
      ]),
    ]);
    expect(out).toContain('Contract added');
    expect(out).toContain('href="/partners/p1"');
  });
  it('an "Invoice added" row stays plain text, with no link anywhere', () => {
    const out = html([
      row([
        {
          entity: 'invoice',
          id: 'i1',
          action: 'insert',
          fields: ['number', 'total'],
          before: null,
          after: { number: 'INV-1', total: 100 },
        },
      ]),
    ]);
    expect(out).toContain('Invoice added');
    expect(out).not.toContain('<a ');
    expect(out).not.toContain('/finance');
  });
  it('a contract row whose change carries no owner stays plain text', () => {
    const out = html([
      row([
        {
          entity: 'contract',
          id: 'c1',
          action: 'update',
          fields: ['title'],
          before: { title: 'Old' },
          after: { title: 'New' },
        },
      ]),
    ]);
    expect(out).toContain('Contract changed');
    expect(out).not.toContain('<a ');
  });
});
