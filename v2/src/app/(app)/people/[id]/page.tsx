import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { Device } from '@/modules/org/screens/MyProfile';
import { PersonRecord, type PersonRecordData } from '@/modules/org/screens/PersonRecord';
import type { OrgAnswer, PeopleAnswer, PersonAccess } from '@/modules/org/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';

/** What a viewer may read comes; what the database refuses (a member reading the people list) is left out, not faked. */
async function maybe<T>(read: () => Promise<unknown>): Promise<T | null> {
  try {
    return (await read()) as T;
  } catch {
    return null;
  }
}

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
  const [people, access, history, devices, signIns] = await Promise.all([
    maybe<PeopleAnswer>(() => serverRpc('people', {} as never)),
    admin ? maybe<PersonAccess>(() => serverRpc('access_of_person', { p_person: id } as never)) : Promise.resolve(null),
    maybe<RecordChange[]>(() => serverRpc('record_history', { p_entity: 'person', p_id: id } as never)),
    admin ? maybe<Device[]>(() => serverRpc('person_devices', { p_person: id })) : Promise.resolve(null),
    maybe<PersonRecordData['signIns']>(() => serverRpc('sign_in_log', { p_person: id } as never)),
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
    signIns,
  };
  return (
    <Page bare>
      <PersonRecord data={data} />
    </Page>
  );
}
