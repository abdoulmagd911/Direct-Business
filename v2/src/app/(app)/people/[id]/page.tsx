import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
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
  const failed: string[] = [];
  const [people, access, history, devices, ownDevices, signIns] = await Promise.all([
    maybe<PeopleAnswer>('people', failed, () => serverRpc('people', {} as never)),
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
    maybe<PersonRecordData['signIns']>('signIns', failed, () => serverRpc('sign_in_log', { p_person: id } as never)),
  ]);
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
  };
  return (
    <Page bare>
      <PersonRecord data={data} />
    </Page>
  );
}
