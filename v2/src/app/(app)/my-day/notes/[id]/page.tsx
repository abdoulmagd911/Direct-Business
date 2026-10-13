import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { NotePage } from '@/modules/my-day/screens/NotePage';
import { activityOutcomes, activityTypes, myNote } from '@/modules/my-day/server';
import { nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { loadLookups } from '@/modules/tasks/load';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.my_day');

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
  const me = await requireMe();
  // a task is made by someone with Tasks at Own or Full (V401); only they need the names the form offers
  const tasks = me.levels.tasks ?? 'none';
  const canTask = note.mine && (tasks === 'own' || tasks === 'full');
  const [types, outcomes, org, lookups] = await Promise.all([
    activityTypes(),
    activityOutcomes(),
    note.mine ? null : (serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>),
    canTask ? loadLookups(me) : null,
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
        taskLookups={lookups ? { org: lookups.org, partners: lookups.partners, projects: lookups.projects } : undefined}
      />
    </Page>
  );
}
