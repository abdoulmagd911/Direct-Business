'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { formatDate } from '@/core/i18n/format';
import { nameOf as personName, type OrgPerson } from '@/modules/org/types';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { door } from '../doors';
import { blockOf, openCaptures } from '../logic';
import { SCOPES, type MyDayAnswer, type Scope } from '../types';
import { CaptureRow } from './CaptureRow';
import { NoteRow } from './NoteBits';
import { WrapUpDialog } from './WrapUpDialog';

export type MyDayData = {
  title: string;
  scope: Scope;
  answer: MyDayAnswer;
  more: boolean;
  people: OrgPerson[];
};

const tabHref = (s: Scope) => (s === 'me' ? '/my-day' : `/my-day?tab=${s}`);

/**
 * My day (V433): Capture, then Convert. Tabs Me · My team · Workspace; on Me the capture row, Since your last visit and
 * my notes; on the other two what my team or everyone shares. Every block draws at most 7 rows and a "more" link.
 * P5-7 adds the task, money and KPI blocks here as their data lands.
 */
export function MyDay({ data }: { data: MyDayData }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const { scope, answer, more } = data;
  const [wrapping, setWrapping] = useState(false);
  const block = more ? { rows: answer.notes, more: false } : blockOf(answer.notes, answer.notes_total);
  const people = new Map(data.people.map((p) => [p.id, p]));
  const authorOf = (id: string) => {
    const p = people.get(id);
    return p ? personName(p, locale) : undefined;
  };
  const since = answer.since.filter((s) => s.count > 0 && t.has(`pages.myDay.since.kinds.${s.kind}`));
  const open = scope === 'me' ? openCaptures(answer.notes, answer.day) : [];

  return (
    <>
      <PageHeader
        title={data.title}
        actions={
          scope === 'me' ? (
            <Button onClick={() => setWrapping(true)} data-wrap-open>
              {t('pages.myDay.wrap.label')}
              {open.length ? <span className="font-data text-xs text-muted">{open.length}</span> : null}
            </Button>
          ) : null
        }
      />
      <Tabs
        label={t('pages.myDay.tabsLabel')}
        value={scope}
        tabs={SCOPES.map((s) => ({ value: s, label: t(`pages.myDay.tabs.${s}`), href: tabHref(s) }))}
      />
      {scope === 'me' ? <CaptureRow /> : null}
      {scope === 'me' && since.length ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4" data-since>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{t('pages.myDay.blocks.since')}</h2>
            {answer.last_visit_at ? (
              <span className="text-sm text-muted">
                {t('pages.myDay.since.at', {
                  when: formatDate(answer.last_visit_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </span>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-2">
            {since.map((s) => (
              <li
                key={s.kind}
                className="inline-flex min-h-9 items-center rounded-pill border border-border px-3 text-sm"
                data-since-kind={s.kind}
              >
                {t(`pages.myDay.since.kinds.${s.kind}`, { count: s.count })}
              </li>
            ))}
          </ul>
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void command(words(t('pages.myDay.since.seen')), () => door('my_day_seen', {}))}
              data-since-seen
            >
              {t('pages.myDay.since.markSeen')}
            </Button>
          </div>
        </section>
      ) : null}
      <section className="rounded-lg border border-border bg-raised px-4 py-2" data-block={scope}>
        <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
          <h2 className="text-base font-semibold">
            {t(`pages.myDay.blocks.${scope}`)}
            <span className="ms-2 font-data text-xs font-normal text-muted">{answer.notes_total}</span>
          </h2>
          {more ? (
            <Link href={tabHref(scope)} className="text-sm text-link hover:underline" data-block-fewer>
              {t('pages.myDay.fewer')}
            </Link>
          ) : null}
        </div>
        {block.rows.length ? (
          <ul className="divide-y divide-border" data-block-rows>
            {block.rows.map((n) => (
              <NoteRow key={n.id} note={n} author={scope === 'me' ? undefined : authorOf(n.author_id)} />
            ))}
          </ul>
        ) : (
          <DataState kind="empty" message={t(`pages.myDay.empty.${scope}`)} />
        )}
        {block.more ? (
          <div className="border-t border-border py-2.5">
            <Link
              href={`${tabHref(scope)}${scope === 'me' ? '?' : '&'}more=1`}
              className="text-sm text-link hover:underline"
              data-block-more
            >
              {t('pages.myDay.more', { count: answer.notes_total })}
            </Link>
          </div>
        ) : null}
      </section>
      {scope === 'me' ? (
        <WrapUpDialog notes={answer.notes} day={answer.day} open={wrapping} onOpenChange={setWrapping} />
      ) : null}
    </>
  );
}
