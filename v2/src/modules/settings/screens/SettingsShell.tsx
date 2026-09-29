import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { settingsGroups } from '../groups';

/**
 * Settings (V97, admins only): the groups down the start side (a list of links, not tabs — the group's own page may
 * carry the one tab row), the group's content beside them; on a phone the groups scroll across the top.
 */
export async function SettingsShell({
  current,
  title,
  actions,
  children,
}: {
  current: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations();
  const groups = settingsGroups();
  const nav = (
    <nav
      aria-label={t('settings.title')}
      className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] md:flex-col md:overflow-visible md:pb-0"
      data-settings-groups
    >
      {groups.map((g) => {
        const active = g.slug === current;
        return (
          <Link
            key={g.slug}
            href={`/settings/${g.slug}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-2 text-base hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus',
              active ? 'bg-surface font-semibold text-text' : 'text-muted',
            )}
          >
            {t(g.label)}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <Page>
      <PageHeader crumbs={[{ label: t('settings.title'), href: '/settings' }]} title={title} actions={actions} />
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        {nav}
        <div className="flex min-w-0 flex-col gap-6 [&>*]:max-w-[880px]">{children}</div>
      </div>
    </Page>
  );
}
