import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LinkPending } from '@/ui/LinkPending';
import type { SettingsGroupDef } from '../groups';
import { settingsIcon } from '../menu';

/**
 * The Settings groups as one list (the 13 Nov phone board): a white card, a row per group — its icon in a peach
 * circle, its name, what it holds (a count, or a word) and a chevron that points the way the language reads. Every
 * row is a 56 px tap area.
 */
export async function SettingsMenuList({
  groups,
  holds = {},
  label,
}: {
  groups: SettingsGroupDef[];
  /** What a group holds, by slug: a count or a word, shown before the chevron. */
  holds?: Record<string, ReactNode>;
  label?: string;
}) {
  const t = await getTranslations();
  return (
    <nav
      aria-label={label ?? t('settings.title')}
      className="overflow-hidden rounded-lg border border-border bg-raised shadow-1"
      data-settings-menu
    >
      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const Icon = settingsIcon(g.slug);
          return (
            <li key={g.slug}>
              <Link
                href={`/settings/${g.slug}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 text-base font-medium text-strong hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                data-settings-menu-row={g.slug}
              >
                <span
                  aria-hidden="true"
                  className="inline-grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink"
                  data-settings-icon
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{t(g.label)}</span>
                {holds[g.slug] !== undefined ? (
                  <span className="shrink-0 text-sm font-normal text-muted" data-settings-menu-holds>
                    {holds[g.slug]}
                  </span>
                ) : null}
                <LinkPending />
                <ChevronRight className="size-4 shrink-0 text-muted rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
