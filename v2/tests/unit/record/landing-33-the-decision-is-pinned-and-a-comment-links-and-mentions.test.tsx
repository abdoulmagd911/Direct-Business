/**
 * Landing 33 (B1, B2) — the comment thread, as it is drawn and as its small rules answer.
 *  - ONE comment is THE DECISION: it is pinned above the thread (before the filters and the list), it says who marked
 *    it, and it wears the mark in the thread too. Whoever may decide is offered "Mark as the decision" on the others
 *    and "Remove the decision mark" on the pinned one; a reader who may not is offered neither.
 *  - A comment's linked records are chips that open the record: a partner its page, a project its tasks, a code its
 *    view; a record the reader may not see says only that a record is linked — no name, no address.
 *  - A mention is a link to the person, matched longest name first and in Arabic as in English.
 *  - "@" opens the picker only at the start or after a space, for one line of at most 40 characters.
 * Every value is made up. Sabotages: tests/sabotage/landing-33.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { commentLinkHref, mentionQuery, splitMentions } from '../../../src/ui/record/CommentExtras';
import type { RecordComment, RecordComments } from '../../../src/ui/record/Comments';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'me' }, capabilities: [], levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => ({})) }));

const { Comments } = await import('../../../src/ui/record/Comments');

const comment = (over: Partial<RecordComment>): RecordComment => ({
  id: 'c',
  author_id: 'p1',
  author_name: 'Made-up Lama',
  author_name_ar: 'لمى',
  body: 'Made-up words',
  created_at: '2026-11-20T08:00:00Z',
  edited_at: null,
  edited: false,
  version: 1,
  asked_to: null,
  asked_to_name: null,
  asked_to_name_ar: null,
  question_open: false,
  answer: null,
  answered_at: null,
  answered_by: null,
  answered_by_name: null,
  answered_by_name_ar: null,
  mine: false,
  can_edit: false,
  can_remove: false,
  is_decision: false,
  links: [],
  mentions: [],
  ...over,
});

const thread = (can: boolean): RecordComments => ({
  read_at: '2026-11-22T08:00:00Z',
  can_write: can,
  can_decide: can,
  comments: [
    comment({ id: 'c1', body: 'Made-up option A' }),
    comment({
      id: 'c2',
      body: 'Made-up option B with @Made-up Nawaf Ali',
      created_at: '2026-11-21T08:00:00Z',
      is_decision: true,
      decided_by: 'p2',
      decided_by_name: 'Made-up Nawaf',
      decided_by_name_ar: 'نواف',
      decided_at: '2026-11-21T09:00:00Z',
      mentions: [
        { id: 'p3', name: 'Made-up Nawaf', name_ar: 'نواف' },
        { id: 'p4', name: 'Made-up Nawaf Ali', name_ar: 'نواف علي' },
      ],
      links: [
        { kind: 'partner', id: 'org-1', number: 'DK-P-0001', label: 'Made Up Traders', label_ar: 'تجار' },
        { kind: 'project', id: 'prj-1', number: 'PRJ-1', label: 'Made-up project', label_ar: null },
        { kind: 'code', id: 'code-1', number: 'MADEUP10', label: 'MADEUP10', label_ar: null },
        { kind: 'invoice', hidden: true },
      ],
    }),
    comment({ id: 'c3', body: 'Made-up later word', created_at: '2026-11-22T07:00:00Z' }),
  ],
});

const draw = (data: RecordComments, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      <Comments entity="task" id="t1" data={data} locale={locale} personName="Me" mentionNote="Made-up helper note." />
    </NextIntlClientProvider>,
  );

describe('the decision', () => {
  it('is pinned above the filters and the thread, once, with who marked it', () => {
    const html = draw(thread(true));
    expect(html.match(/data-decision="/g)).toHaveLength(1);
    const pin = html.indexOf('data-decision="c2"');
    expect(pin).toBeGreaterThan(-1);
    expect(pin, 'the pin stands before the filters').toBeLessThan(html.indexOf('aria-pressed'));
    expect(pin, 'and before the first comment of the thread').toBeLessThan(html.indexOf('data-comment="c1"'));
    const pinned = html.slice(pin, html.indexOf('</aside>'));
    expect(pinned).toContain('Made-up option B');
    expect(pinned).toContain('Marked as the decision by Made-up Nawaf');
  });
  it('wears its mark in the thread too, and no other comment does', () => {
    const html = draw(thread(true));
    expect(html.match(/data-comment-is-decision/g)).toHaveLength(1);
    const c2 = html.slice(html.indexOf('data-comment="c2"'), html.indexOf('data-comment="c3"'));
    expect(c2).toContain('data-comment-is-decision');
  });
  it('offers the mark on the other comments and the unmark on the pinned one, to whoever may decide', () => {
    const html = draw(thread(true));
    expect(html.match(/data-comment-decide/g), 'the two comments that are not the decision').toHaveLength(2);
    expect(html.match(/data-decision-unmark/g)).toHaveLength(1);
    expect(html).toContain('Make this the decision');
  });
  it('offers neither to a reader who may not decide, who still sees the decision', () => {
    const html = draw(thread(false));
    expect(html).toContain('data-decision="c2"');
    expect(html).not.toContain('data-comment-decide');
    expect(html).not.toContain('data-decision-unmark');
  });
  it('a thread with no decision pins nothing and says "Mark as the decision"', () => {
    const data = thread(true);
    data.comments = data.comments.map((c) => ({ ...c, is_decision: false }));
    const html = draw(data);
    expect(html).not.toContain('data-decision="');
    expect(html).toContain('Mark as the decision');
  });
  it('reads in Arabic', () => {
    const html = draw(thread(true), 'ar');
    expect(html).toContain('القرار');
    expect(html).toContain('حدّده قرارًا: نواف');
  });
});

describe('a comment’s linked records', () => {
  it('open the record: a partner its page, a project its tasks, a code its view', () => {
    const html = draw(thread(true));
    expect(html).toContain('href="/partners/org-1"');
    expect(html).toContain('href="/tasks?project=prj-1"');
    expect(html).toContain('href="/codes?code=code-1"');
    expect(commentLinkHref({ kind: 'invoice', id: 'inv-1' })).toBe('/finance');
  });
  it('a record the reader may not see says only that a record is linked', () => {
    const html = draw(thread(true));
    expect(html).toContain('A linked record you cannot open');
    const hidden = html.slice(html.indexOf('data-comment-link-hidden'));
    expect(hidden.slice(0, hidden.indexOf('</li>'))).not.toContain('href');
  });
  it('are named in Arabic when the record has an Arabic name', () => {
    expect(draw(thread(true), 'ar')).toContain('تجار');
  });
});

describe('a mention', () => {
  it('is a link to the person, the longest name first', () => {
    const html = draw(thread(true));
    expect(html).toContain('href="/people/p4"');
    expect(html, '"@Made-up Nawaf Ali" is not cut at "@Made-up Nawaf"').not.toContain('href="/people/p3"');
  });
  it('is found in Arabic as in English', () => {
    const parts = splitMentions('انظر @نواف علي رجاءً', [{ id: 'p4', name: 'Made-up Nawaf Ali', name_ar: 'نواف علي' }]);
    expect(parts).toEqual(['انظر ', { id: 'p4', text: '@نواف علي' }, ' رجاءً']);
  });
  it('the words are left whole when nobody is mentioned', () => {
    expect(splitMentions('mail me @ noon', [])).toEqual(['mail me @ noon']);
  });
  it('the box says what a mention does on this record', () => {
    expect(draw(thread(true))).toContain('Made-up helper note.');
    expect(draw(thread(false)), 'a reader who may not write has no box').not.toContain('data-mention-hint');
  });
});

describe('typing @', () => {
  it('opens the picker at the start or after a space', () => {
    expect(mentionQuery('@la', 3)).toEqual({ from: 0, term: 'la' });
    expect(mentionQuery('see @lama h', 11)).toEqual({ from: 4, term: 'lama h' });
    expect(mentionQuery('انظر @نو', 8)).toEqual({ from: 5, term: 'نو' });
  });
  it('and not inside a word, across a line, or past 40 characters', () => {
    expect(mentionQuery('mail@la', 7)).toBeNull();
    expect(mentionQuery('@la\nnext', 8)).toBeNull();
    expect(mentionQuery(`@${'x'.repeat(41)}`, 42)).toBeNull();
    expect(mentionQuery('no at sign', 5)).toBeNull();
  });
  it('reads what is before the caret only', () => {
    expect(mentionQuery('@lama and more', 3)).toEqual({ from: 0, term: 'la' });
  });
});
