import { getLocale, getTranslations } from 'next-intl/server';
import { serverRpc } from '@/core/db/server-rpc';
import { NotePage } from '@/modules/my-day/screens/NotePage';
import { activityOutcomes, activityTypes, myNote } from '@/modules/my-day/server';
import { nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/**
 * One note (V433). A note the reader may not see reads as not there — a private note is its author's alone, admins
 * included (V454) — never as "no access", which would say that it exists.
 */
export default async function NoteRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, locale] = await Promise.all([params, getTranslations(), getLocale()]);
  const note = await myNote(id);
  if (!note)
    return (
      <Page page="my_day" title={t('nav.my_day')}>
        <PageHeader crumbs={[{ label: t('nav.my_day'), href: '/my-day' }]} title={t('pages.myDay.note.untitled')} />
        <DataState kind="empty" message={t('pages.myDay.note.notFound')} />
      </Page>
    );
  const [types, outcomes, org] = await Promise.all([
    activityTypes(),
    activityOutcomes(),
    note.mine ? null : (serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>),
  ]);
  const author = org?.people.find((p) => p.id === note.author_id);
  return (
    <Page page="my_day" title={t('nav.my_day')}>
      <NotePage
        key={note.id}
        note={note}
        author={author ? personName(author, locale === 'ar' ? 'ar' : 'en') : undefined}
        types={types}
        outcomes={outcomes}
      />
    </Page>
  );
}
