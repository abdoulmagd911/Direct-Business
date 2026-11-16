'use client';
import { Check, CircleCheck, Hourglass, Moon, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { KpiTile } from '@/ui/KpiTile';
import type { Side } from '../types';
import { addressOf, type ListFilters } from './filters';
import { KPIS, cardDimensionOn, kpiOf, pressKpi, type Kpi, type KpiCounts, type PressableKpi } from './kpi';

const ICONS: Record<Kpi, ReactNode> = {
  active: <CircleCheck />,
  prospects: <UserRoundPlus />,
  stale: <Hourglass />,
  quiet: <Moon />,
};

/**
 * The four cards over the list (V21, Landing 31): Active · Prospects · Stale · Quiet. A card is a link to the same
 * list with its filter on, so the choice lives in the address — Back undoes it and the address can be passed on. The
 * card that is on says so (`aria-current`, a tick, the selection border); pressing it again goes back to the list
 * without it. The search and the other filters ride along, and the page stays where it was scrolled. A figure that
 * is not known is "—", never 0. Quiet is a Finance fact: for a reader the list read tells nothing of it (below View
 * on Finance) its figure is not known, and the card is then a plain card, not a link — unless it is on, so that an
 * address that carries `quiet=1` can still be cleared from it.
 * Not drawn on a phone (the 13 Nov board): `PhoneChips` stands in for it there.
 */
export function KpiCards({
  base,
  side,
  filters,
  counts,
}: {
  base: string;
  side: Side;
  filters: ListFilters;
  counts: KpiCounts;
}) {
  const t = useTranslations('partners.kpi');
  const on = kpiOf(filters);
  return (
    <ul className="grid grid-cols-2 gap-4 max-sm:hidden lg:grid-cols-4" aria-label={t('label')} data-partner-kpis>
      {KPIS.map((k) => {
        const note = k === 'active' ? t(`note.active.${side}`) : t(`note.${k}`);
        const pressed = on === k;
        const count = counts[k];
        if (k === 'quiet' && count === null && !pressed)
          return (
            <li key={k} className="flex min-w-0" data-kpi={k} data-kpi-unknown>
              <KpiTile className="flex-1" icon={ICONS[k]} label={t(k)} value={null} footnote={note} />
            </li>
          );
        return (
          <li key={k} className="flex min-w-0">
            <Link
              href={addressOf(base, pressKpi(filters, k))}
              scroll={false}
              aria-current={pressed ? 'true' : undefined}
              title={pressed ? t('clear') : undefined}
              data-kpi={k}
              data-kpi-on={pressed || undefined}
              className="press-card flex min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <KpiTile
                className={cn(
                  'flex-1',
                  pressed && 'border-y-sel border-e-sel bg-[color-mix(in_srgb,var(--sel)_7%,var(--raised))]',
                )}
                icon={ICONS[k]}
                label={
                  <span className="inline-flex max-w-full items-center gap-1.5">
                    <span className="truncate">{t(k)}</span>
                    {pressed ? <Check className="size-4 shrink-0" aria-hidden="true" data-kpi-tick /> : null}
                  </span>
                }
                value={count === null ? null : String(count)}
                footnote={note}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The phone's three chips (the 13 Nov board): All · Prospects · Needs attention, each with its count. They are the
 * same filters as the cards — Needs attention is the Stale filter (the list read cannot ask for "stale or quiet" in
 * one go, so Quiet stays a card of the wider screens and a switch in More filters) — and the same links, so the
 * address carries the choice. 44 px tall; the one that is on is the selection colour and says so.
 */
export function PhoneChips({ base, filters, counts }: { base: string; filters: ListFilters; counts: KpiCounts }) {
  const t = useTranslations('partners.kpi');
  const on = kpiOf(filters);
  const none = !cardDimensionOn(filters);
  const chips: { key: string; kpi: PressableKpi | null; label: string; count: number | null; pressed: boolean }[] = [
    { key: 'all', kpi: null, label: t('all'), count: counts.all, pressed: none },
    {
      key: 'prospects',
      kpi: 'prospects',
      label: t('prospectsChip'),
      count: counts.prospects,
      pressed: on === 'prospects',
    },
    { key: 'attention', kpi: 'stale', label: t('attention'), count: counts.stale, pressed: on === 'stale' },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-2 sm:hidden" aria-label={t('label')} data-partner-kpi-chips>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={addressOf(base, pressKpi(filters, c.kpi))}
          scroll={false}
          aria-current={c.pressed ? 'true' : undefined}
          data-kpi-chip={c.key}
          className={cn(
            'inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-sm font-medium leading-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            c.pressed ? 'border-sel bg-sel text-on-sel' : 'border-border-strong bg-raised text-text active:bg-pressed',
          )}
        >
          {c.label}
          {c.count !== null ? <span className="font-data text-xs">{c.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
