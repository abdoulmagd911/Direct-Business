import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { LinkPending } from '@/ui/LinkPending';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { settingsGroups } from '../groups';
import { settingsIcon } from '../menu';

/**
 * Settings (V97, admins only — but for the credit limit, which everyone reads): the groups and the group's content.
 * The look (V21): from 1,280 px the groups are a 220 px column down the start side — each a 48 px row with its icon in
 * a peach circle, the open one a white card with a soft shadow; under 1,280 px they are a wrapped row of pills above
 * the page (40 px; 44 px on a phone), every one in sight — a sideways scroll hid the last ones with no cue (QA-183d).
 * A list of links, not tabs: the group's own page may carry the one tab row. The content beside them: cards and lists
 * at a reading width, a table (data-wide) at the whole width of the content, so no word of it breaks.
 */
export async function SettingsShell({
  current,
  title,
  actions,
  only,
  children,
}: {
  current: string;
  title: ReactNode;
  actions?: ReactNode;
  /** The groups this person can open, when not all of them (someone who is not an admin: Finance, for the credit
   *  limit). A group that would only refuse is not listed. */
  only?: readonly string[];
  children: ReactNode;
}) {
  const t = await getTranslations();
  const groups = settingsGroups().filter((g) => !only || only.includes(g.slug));
  const nav = (
    <nav
      aria-label={t('settings.title')}
      className="flex flex-wrap gap-2 xl:w-[220px] xl:shrink-0 xl:flex-col xl:flex-nowrap xl:gap-0.5"
      data-settings-groups
    >
      {groups.map((g) => {
        const active = g.slug === current;
        const Icon = settingsIcon(g.slug);
        return (
          <Link
            key={g.slug}
            href={`/settings/${g.slug}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-pill bg-raised px-4 text-base font-medium ring-inset hover:text-strong focus-visible:outline-2 focus-visible:outline-focus sm:min-h-10',
              'xl:h-12 xl:rounded-md xl:bg-transparent xl:px-3 xl:ring-0 xl:hover:bg-surface',
              active
                ? 'font-semibold text-strong ring-2 ring-sel xl:bg-raised xl:shadow-1 xl:hover:bg-raised'
                : 'text-muted ring-1 ring-border',
            )}
            data-settings-group={g.slug}
          >
            <span
              aria-hidden="true"
              className="hidden size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink xl:inline-grid"
              data-settings-icon
            >
              <Icon className="size-5" />
            </span>
            {t(g.label)}
            <LinkPending />
          </Link>
        );
      })}
    </nav>
  );
  return (
    <Page>
      <PageHeader crumbs={[{ label: t('settings.title'), href: '/settings' }]} title={title} actions={actions} />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        {nav}
        <div className="flex min-w-0 flex-1 flex-col gap-6 [&>*]:max-w-[880px] [&>[data-wide]]:max-w-none">
          {children}
        </div>
      </div>
    </Page>
  );
}
