import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { canSee } from '@/ui/person';
import { serverRpc } from '@/core/db/server-rpc';
import type { Device } from '@/modules/org/screens/MyProfile';
import { readOrFail as maybe } from '@/modules/org/read-or-fail';
import { PersonRecord, type PersonRecordData } from '@/modules/org/screens/PersonRecord';
import type { OrgAnswer, PeopleAnswer, PersonAccess } from '@/modules/org/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.settings.org');

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }, me] = await Promise.all([params, searchParams, requireMe()]);
  const org = (await serverRpc('org', {} as never)) as unknown as OrgAnswer;
  const person = org.people.find((p) => p.id === id);
  if (!person) notFound();
  const admin = me.person.role?.is_admin === true;
  // the people list and another person's sign-ins are read with Org settings at View: not asked of anyone else, so a
  // member opening a colleague's page makes no request the database must refuse (QA-577, the 403s in the console)
  const orgView = canSee(me, 'settings.org');
  const failed: string[] = [];
  const [people, access, history, devices, ownDevices, signIns] = await Promise.all([
    orgView ? maybe<PeopleAnswer>('people', failed, () => serverRpc('people', {} as never)) : Promise.resolve(null),
    admin
      ? maybe<PersonAccess>('access', failed, () => serverRpc('access_of_person', { p_person: id } as never))
      : Promise.resolve(null),
    maybe<RecordChange[]>('history', failed, () =>
      serverRpc('record_history', { p_entity: 'person', p_id: id } as never),
    ),
    admin
      ? maybe<Device[]>('devices', failed, () => serverRpc('person_devices', { p_person: id }))
      : Promise.resolve(null),
    !admin && me.person.id === id
      ? maybe<Device[]>('ownDevices', failed, () => serverRpc('my_devices', {} as never))
      : Promise.resolve(null),
    orgView || me.person.id === id
      ? maybe<PersonRecordData['signIns']>('signIns', failed, () => serverRpc('sign_in_log', { p_person: id } as never))
      : Promise.resolve(null),
  ]);
  // Riyadh's day on the server: a leaving day "has come" by the company's calendar, never the browser's clock
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const data: PersonRecordData = {
    me,
    tab: typeof tab === 'string' ? tab : 'overview',
    org,
    person,
    row: people?.find((p) => p.id === id) ?? null,
    access,
    history: history ? historyRows(history, 'person', id) : null,
    devices,
    ownDevices,
    signIns,
    failed,
    today,
    // who cannot take work over (core.person_available): switched off, or their leaving day has come — the hand-over
    // picker leaves them out rather than offer a name the database refuses
    unavailable: (people ?? [])
      .filter((p) => !p.active || !p.can_sign_in || (p.left_on !== null && p.left_on <= today))
      .map((p) => p.id),
  };
  return (
    <Page bare>
      <PersonRecord data={data} />
    </Page>
  );
}
