import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { MyProfile, type Device } from '@/modules/org/screens/MyProfile';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

// My profile (V97): everyone's own, from the profile chip. The gate has answered; the devices come with the page.
export const generateMetadata = pageTitle('nav.settings.profile');

export default async function ProfilePage() {
  const me = await requireMe();
  const devices = (await serverRpc('my_devices', {} as never)) as unknown as Device[];
  return (
    <Page bare>
      <MyProfile me={me} devices={devices} />
    </Page>
  );
}
