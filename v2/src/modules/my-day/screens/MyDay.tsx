'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { nameOf as personName, type OrgPerson } from '@/modules/org/types';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { BLOCK_ROWS } from '../logic';
import { SCOPES, type MyDayAnswer, type PendingReminder, type Scope } from '../types';
import { CaptureRow } from './CaptureRow';
import { NoteRow } from './NoteBits';
import { SinceBlock } from './SinceBlock';
import { WrapUpDialog } from './WrapUpDialog';

export type MyDayData = {
  title: string;
  scope: Scope;
  answer: MyDayAnswer;
  /** Every note read (`?more=1`) rather than the first block. */
  all: boolean;
  people: OrgPerson[];
};

const tabHref = (s: Scope) => (s === 'me' ? '/my-day' : `/my-day?tab=${s}`);

/**
 * My day (V433): Capture, then Convert. Tabs Me · My team · Workspace; on Me the capture row, my notes and the reminders
 * waiting; on the other two what my team or everyone shares. Every block draws at most 7 rows and a "more" link. P5-7
 * adds the task, money and KPI blocks here as their data lands.
 */
export function MyDay({ data }: { data: MyDayData }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const { scope, answer, all } = data;
  const [wrapping, setWrapping] = useState(false);
  const [removing, setRemoving] = useState<PendingReminder | null>(null);
  const people = new Map(data.people.map((p) => [p.id, p]));
  const authorOf = (id: string) => {
    const p = people.get(id);
    return p ? personName(p, locale) : undefined;
  };
  const rows = all ? answer.notes : answer.notes.slice(0, BLOCK_ROWS);
  const more = !all && (answer.more || answer.notes.length > BLOCK_ROWS);

  return (
    <>
      <PageHeader
        title={data.title}
        actions={
          scope === 'me' ? (
            <Button onClick={() => setWrapping(true)} data-wrap-open>
              {t('pages.myDay.wrap.label')}
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
      {scope === 'me' ? <SinceBlock /> : null}
      <section className="rounded-lg border border-border bg-raised px-4 py-2" data-block={scope}>
        <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
          <h2 className="text-base font-semibold">{t(`pages.myDay.blocks.${scope}`)}</h2>
          {all ? (
            <Link href={tabHref(scope)} className="text-sm text-link hover:underline" data-block-fewer>
              {t('pages.myDay.fewer')}
            </Link>
          ) : null}
        </div>
        {rows.length ? (
          <ul className="divide-y divide-border" data-block-rows>
            {rows.map((n) => (
              <NoteRow key={n.id} note={n} author={scope === 'me' ? undefined : authorOf(n.author_id)} />
            ))}
          </ul>
        ) : (
          <DataState kind="empty" message={t(`pages.myDay.empty.${scope}`)} />
        )}
        {more ? (
          <div className="border-t border-border py-2.5">
            <Link
              href={`${tabHref(scope)}${scope === 'me' ? '?' : '&'}more=1`}
              className="text-sm text-link hover:underline"
              data-block-more
            >
              {t('pages.myDay.more')}
            </Link>
          </div>
        ) : null}
      </section>
      {scope === 'me' && answer.reminders.length ? (
        <section className="rounded-lg border border-border bg-raised px-4 py-2" data-reminders>
          <h2 className="border-b border-border py-2.5 text-base font-semibold">{t('pages.myDay.blocks.reminders')}</h2>
          <ul className="divide-y divide-border">
            {answer.reminders.slice(0, BLOCK_ROWS).map((r) => (
              <li key={r.id} className="flex min-h-14 items-center gap-3 py-3" data-reminder={r.id}>
                <span className="min-w-0 flex-1 truncate">{r.text}</span>
                <span className="shrink-0 font-data text-xs whitespace-nowrap text-muted">
                  {formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(r)} data-reminder-remove>
                  {t('common.remove')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {scope === 'me' ? <WrapUpDialog day={answer.day} open={wrapping} onOpenChange={setWrapping} /> : null}
      <Confirm
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('pages.myDay.reminder.removeTitle', { name: removing?.text ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          const r = removing;
          setRemoving(null);
          if (r)
            await command(
              words(t('pages.myDay.reminder.removed')),
              () => rpc('reminders_remove', { p_ids: [r.id] }) as Promise<{ request_id?: string | null }>,
            );
        }}
      />
    </>
  );
}
