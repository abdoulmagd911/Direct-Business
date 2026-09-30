import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { settingsGroups } from '../groups';

/**
 * Settings (V97, admins only): the groups down the start side (a list of links, not tabs — the group's own page may
 * carry the one tab row), the group's content beside them; on a phone the groups wrap across the top, every one in
 * sight — a sideways scroll hid the last ones with no cue (QA-183d).
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
      className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap"
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
              'inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2 text-base hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus md:min-h-0',
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
