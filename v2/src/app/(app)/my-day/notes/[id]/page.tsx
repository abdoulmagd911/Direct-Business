import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { NotePage } from '@/modules/my-day/screens/NotePage';
import { activityOutcomes, activityTypes, myNote } from '@/modules/my-day/server';
import { nameOf as personName, avatarOf, type OrgAnswer } from '@/modules/org/types';
import { loadLookups } from '@/modules/tasks/load';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { historyRows, type RecordChange } from '@/ui/record/history';
import type { RecordComments } from '@/ui/record/Comments';
import type { RecordFile } from '@/ui/record/FilesSection';
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
  const [types, outcomes, org, lookups, comments, files, historyRaw] = await Promise.all([
    activityTypes(),
    activityOutcomes(),
    // everyone's names: the author's for a reader, the colleagues a note may be shared with for its author (G)
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    canTask ? loadLookups(me) : null,
    // The Discussion's comments, the note's files and its change log: each read is caught on its own, so a failed
    // read says so on its section instead of breaking the page.
    serverRpc('comments', { p_entity: 'my_note', p_id: id }).catch(() => null),
    serverRpc('files', { p_entity: 'my_note', p_id: id }).catch(() => null),
    serverRpc('record_history', { p_entity: 'my_note', p_id: id }).catch(() => null),
  ]);
  const author = org?.people.find((p) => p.id === note.author_id);
  const mePerson = org?.people.find((p) => p.id === me.person.id);
  return (
    <Page page="my_day" title={t('nav.my_day')}>
      <NotePage
        key={note.id}
        note={note}
        author={author ? personName(author, locale === 'ar' ? 'ar' : 'en') : undefined}
        types={types}
        outcomes={outcomes}
        taskLookups={lookups ? { org: lookups.org, partners: lookups.partners, projects: lookups.projects } : undefined}
        comments={(comments as RecordComments | null) ?? null}
        files={(files as RecordFile[] | null) ?? null}
        history={historyRaw ? historyRows(historyRaw as RecordChange[], 'my_note', id) : null}
        people={Object.fromEntries((org?.people ?? []).map((p) => [p.id, avatarOf(p, locale === 'ar' ? 'ar' : 'en')]))}
        meName={mePerson ? personName(mePerson, locale === 'ar' ? 'ar' : 'en') : ''}
        colleagues={(org?.people ?? [])
          .filter((p) => p.id !== me.person.id)
          .map((p) => ({
            id: p.id,
            name: personName(p, locale === 'ar' ? 'ar' : 'en'),
            team_id: p.team_id,
            // api.org carries no roles by design, so "admin" here means the owner Admin account, the one
            // reader the team rule always lets through. Other admin-role staff on other teams are not offered
            // on a team note (they can still be mentioned on a workspace note); the database stays the guard.
            is_admin: p.account === 'admin_account',
          }))
          .sort((a, b) => a.name.localeCompare(b.name))}
      />
    </Page>
  );
}
