import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { listsOf, settingsGroups } from '@/modules/settings/groups';
import { isPhoneBrowser } from '@/modules/settings/menu';
import { SettingsMenuList } from '@/modules/settings/screens/SettingsMenuList';
import type { PeopleAnswer } from '@/modules/org/types';
import { PageHeader } from '@/ui/PageHeader';
import { isAdmin } from '@/ui/shell/nav';
import { Page } from '@/ui/shell/Page';

export async function generateMetadata() {
  return { title: (await getTranslations())('settings.title') };
}

/**
 * Settings. On a phone it is one list of the groups, each with what it holds (the 13 Nov board): the people who work
 * here, the lists a group keeps, the credit limit in Finance. Everywhere else — and for anyone who is not an admin,
 * who is told so there — it opens People & access, with the groups beside or above the page.
 */
export default async function SettingsIndex() {
  const [me, h] = await Promise.all([requireMe(), headers()]);
  if (!isAdmin(me) || !isPhoneBrowser(h.get('user-agent'))) redirect('/settings/org');
  const t = await getTranslations();
  const groups = settingsGroups();
  // the people who work here: team members who have not left — never the admin, test or TEST accounts. A read that
  // fails leaves the row without its count; the list itself still opens.
  const people = await (serverRpc('people', {} as never) as Promise<unknown>).then(
    (rows) =>
      (rows as PeopleAnswer).filter(
        (p) => p.active && !p.is_test && p.account !== 'admin_account' && p.account !== 'test_account',
      ).length,
    () => null,
  );
  const holds: Record<string, ReactNode> = {};
  for (const g of groups) {
    const lists = listsOf(g.page).length;
    if (g.slug === 'org') {
      if (people !== null) holds[g.slug] = <span className="font-data">{people}</span>;
    } else if (g.slug === 'finance') holds[g.slug] = t('settings.credit.title');
    else if (lists > 0) holds[g.slug] = <span className="font-data">{lists}</span>;
  }
  return (
    <Page>
      <PageHeader title={t('settings.title')} />
      <div className="max-w-[560px]">
        <SettingsMenuList groups={groups} holds={holds} />
      </div>
    </Page>
  );
}
