'use client';
import { CappedNote } from './CappedNote';
import * as RP from '@radix-ui/react-popover';
import type { RowSelectionState, SortingState, VisibilityState } from '@tanstack/react-table';
import {
  Archive,
  CalendarClock,
  Columns3,
  Hourglass,
  Loader2,
  Moon,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import type { Me } from '@/core/auth/me';
import { command, type CommandWords } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { avatarOf, nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { BulkBar } from '@/ui/BulkBar';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FilterChip, StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { DataTable, type ColumnDef } from '@/ui/DataTable';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { LinkPending } from '@/ui/LinkPending';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneFilter } from '@/ui/PhoneFilter';
import { PartnerLogo } from '@/ui/PartnerLogo';
import { PersonChip } from '@/ui/PersonChip';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { PageFrame } from '@/ui/shell/AppShell';
import { navStartedTo } from '@/ui/shell/nav-pending';
import { cn } from '@/ui/cn';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { NewPartnerDialog } from './NewPartnerDialog';
import { PartnerHover } from './PartnerHover';
import { ReadFailed } from './ReadFailed';
import { ACTIONS_WIDTH, columnPlan } from '../list/columns';
import {
  ARCHIVED_PICK,
  addressOf,
  emptyFilters as empty,
  statusPicks,
  withSearch,
  withStatusPicks,
  type ListFilters,
} from '../list/filters';
import { clearStale, listIsStale, markPartnersChanged, sawList } from '../list/freshness';
import { KpiCards, PhoneChips } from '../list/KpiCards';
import type { KpiCounts } from '../list/kpi';
import { useElementWidth } from '../list/useElementWidth';
import type { ReadFailure } from '../read-failure';
import { compareFlags, compareOwner } from '../sort';
import {
  SIDE_PAGE,
  SIDE_ROUTE,
  STATUSES,
  clientPriorities,
  nameOf,
  statusTone,
  tradeName,
  type ListEntry,
  type PartnerRow,
  type PartnersAnswer,
  type Side,
} from '../types';

export { addressOf, type ListFilters };

/**
 * A lean list page (V98, V149, TECH-SPEC §3.4): saved views across the top (All and the side's types are the fixed
 * ones), the chips Type · Owner · Status, More filters for the rest, the table (two-line cards on a phone), a bulk bar
 * that assigns owner and priority to the selection as one request, and New. Every figure on it comes from
 * api.partners; the list is re-read through the address after every command.
 * Landing 31 (V21): the four cards Active · Prospects · Stale · Quiet sit over the list and filter it through the
 * address (three chips stand in for them on a phone); the table drops columns to fit its place instead of scrolling
 * sideways, and under a table's width the list is rows in one card.
 */
export function PartnersList({
  me,
  side,
  title,
  filters,
  answer,
  failed,
  failure = null,
  partial = false,
  stamp = '',
  counts,
  org,
  types,
  sideTypes,
  tiers,
  priorities,
  tabs,
  startCreating = false,
}: {
  me: Me;
  side: Side;
  title: string;
  filters: ListFilters;
  answer: PartnersAnswer | null;
  failed: boolean;
  /** Why the list read failed (a refusal, a read stopped for time, no answer), when the page knows. */
  failure?: ReadFailure | null;
  /** A read beside the list (the people, the types, the tiers, the priorities) did not answer: the list still draws. */
  partial?: boolean;
  /** The stamp of this list read (list/freshness.ts): a list restored from before a change reads again. */
  stamp?: string;
  /** The cards' figures (null = not known), counted by the page from the same read as the list. */
  counts: KpiCounts;
  org: OrgAnswer;
  types: ListEntry[];
  /** Every side's types, for the hover card's chips (the list's own `types` are this side's). */
  sideTypes: ListEntry[];
  tiers: ListEntry[];
  priorities: ListEntry[];
  /** Partners · Suppliers, one page with two tabs (V217); absent when the reader has only one side. */
  tabs?: ReactNode;
  /** Opened from Create (`?new=1`): the New dialog is open on arrival, for a reader with Full. */
  startCreating?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const phone = useMediaQuery('(max-width: 639px)');
  const base = SIDE_ROUTE[side];
  const page = SIDE_PAGE[side];
  const full = me.levels[page] === 'full';
  const canAssign = me.capabilities.includes(`${page}.assign`);
  // FIX-01 (F100/F138, P1b): a member who owns records on this side bulk-assigns their own — the door checks each
  // row is theirs; without either capability there is no selection at all.
  const canAssignOwn = me.capabilities.includes(`${page}.assign_own`);
  const canBulk = canAssign || canAssignOwn;
  const people = Object.fromEntries(org.people.map((p) => [p.id, p]));
  const [selected, setSelected] = useState<RowSelectionState>({});
  // FIX-01: the table's sort and which columns show live in this list's state, so the team can change them; the
  // sort is not in the address (a gap: refresh drops it — see the landing report).
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  // Landing 31: the table draws the columns its own place has room for (the drawer beside it may be open or folded);
  // a column there is no room for is hidden whatever the chooser says, and under a table's width the rows are cards.
  const [rowsRef, rowsWidth] = useElementWidth<HTMLDivElement>();
  const plan = columnPlan(rowsWidth, canBulk);
  const asCards = phone || plan.cards;
  const visibility: VisibilityState = { ...columnVisibility };
  for (const id of plan.hidden) visibility[id] = false;
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState(startCreating && full);
  const [assigning, setAssigning] = useState(false);
  // Create on a phone goes to ?new=1 while this list is already on screen: that address opens the dialog too
  const wantsNew = useSearchParams().get('new') === '1';
  const [sawNew, setSawNew] = useState(wantsNew);
  if (wantsNew !== sawNew) {
    setSawNew(wantsNew);
    if (wantsNew && full) setCreating(true);
  }
  const [q, setQ] = useState(filters.q);
  // the box shows the search the address holds: "Clear all" (and any navigation) changes the address, so the box
  // follows it — a box that kept its mount-time text after a clear showed a search that was no longer running (F102).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    setQ(filters.q);
  }
  // Landing 34: every move of this list is a transition, so the screen says it is loading from the press to the
  // arrival of the new rows. Before, the search (and every chip) called router.push with nothing on screen for the
  // seconds the read took — "typed, pressed Enter, the table still showed everything" — and a row's press the same.
  const [pending, startMove] = useTransition();
  // `navStartedTo` is the shell's own word for a move made in code: its bar across the top shows at once as well.
  // (It answers false for the address we are already on: nothing would arrive, so nothing is asked.)
  const move = (to: string) => {
    if (!navStartedTo(to)) return;
    startMove(() => router.push(to));
  };
  const go = (f: ListFilters) => move(addressOf(base, f));
  const set = (patch: Partial<ListFilters>) => go({ ...filters, ...patch, view: '' });
  const open = (id: string) => move(`${base}/${id}`);
  const reread = () => startMove(() => router.refresh());
  // A list restored from before a change (Back from the record just added) is the read from before it: read again.
  useEffect(() => {
    if (!stamp) return;
    sawList(stamp);
    if (!listIsStale(stamp)) return;
    clearStale();
    startMove(() => router.refresh());
  }, [stamp, router]);

  const fixedViews = [
    { key: 'all', label: t('common.all') },
    ...types.map((x) => ({ key: `type:${x.key}`, label: nameOf(x, locale) })),
  ];
  const currentView =
    filters.view ||
    (filters.types.length === 1 && !filters.owners.length && !filters.statuses.length && !filters.q
      ? `type:${filters.types[0]}`
      : !filters.types.length && !filters.owners.length && !filters.statuses.length && !filters.q
        ? 'all'
        : '');
  const openView = (v: { key: string; query?: Record<string, unknown> }) => {
    if (v.key === 'all') return go({ ...empty(), view: '' });
    if (v.key.startsWith('type:')) return go({ ...empty(), types: [v.key.slice(5)] });
    const f = (v.query ?? {}) as Partial<ListFilters>;
    go({ ...empty(), ...f, view: v.key });
  };

  const rows = answer?.rows ?? [];
  const ids = Object.keys(selected).filter((k) => selected[k]);
  const words = (done: string): CommandWords => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  });

  const columns = useMemo<ColumnDef<PartnerRow, unknown>[]>(() => {
    const ownerName = (r: PartnerRow) => {
      const p = r.owner_id ? people[r.owner_id] : undefined;
      return p ? personName(p, locale) : '';
    };
    return [
      {
        accessorKey: 'trade_name_en',
        header: t('partners.columns.name'),
        cell: ({ row }) => (
          // Landing 34: the name wraps inside its place and is read whole — never cut with "…"
          <span
            className="flex min-w-0 items-center gap-3 whitespace-normal py-1.5"
            style={{ maxWidth: plan.nameMax }}
            data-partner-name
          >
            <PartnerLogo name={row.original.trade_name_en} size="sm" className="size-8" />
            <span className="flex min-w-0 flex-col">
              <PartnerHover id={row.original.id} types={sideTypes}>
                <Link
                  href={`${base}/${row.original.id}`}
                  className="min-w-0 break-words font-medium leading-5 text-link hover:underline"
                  data-entity="partner"
                  data-partner-link={row.original.id}
                >
                  <bdi className="min-w-0 break-words">{tradeName(row.original, locale)}</bdi>
                  <LinkPending />
                </Link>
              </PartnerHover>
              <span className="flex min-w-0 items-center gap-1.5 text-xs leading-[18px] text-muted">
                <bdi className="font-data">{row.original.number}</bdi>
                {row.original.key_partner ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate" data-key-partner>
                      {t('partners.keyPartner')}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('partners.columns.type'),
        cell: ({ row }) => {
          const name = nameOf(
            types.find((x) => x.key === row.original.type),
            locale,
          );
          return name ? (
            <span className="block max-w-28 truncate" title={name}>
              {name}
            </span>
          ) : (
            <span className="text-muted">—</span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('partners.columns.status'),
        cell: ({ row }) =>
          row.original.status ? (
            <StatusChip tone={statusTone(row.original.status)}>
              {t(`partners.status.${row.original.status}`)}
            </StatusChip>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        accessorKey: 'owner_id',
        header: t('partners.columns.owner'),
        // FIX-01: the owner sorts by name, not by id — two owners with the same name fall back to added-at, then id.
        sortingFn: (a, b) => compareOwner(a.original, b.original, ownerName),
        cell: ({ row }) => {
          const p = row.original.owner_id ? people[row.original.owner_id] : undefined;
          return p ? (
            <PersonChip
              person={avatarOf(p, locale)}
              href={`/people/${p.id}`}
              // Landing 34: an owner's name wraps inside its column and is read whole — never cut with "…"
              className="max-w-44 whitespace-normal [&_.name]:min-w-0 [&_.name]:break-words [&_.name]:leading-5"
            />
          ) : (
            <span className="text-muted">—</span>
          );
        },
      },
      {
        accessorKey: 'last_activity_on',
        header: t('partners.columns.lastActivity'),
        meta: { numeric: true },
        cell: ({ row }) =>
          row.original.last_activity_on ? (
            <span className="font-data text-sm">
              {formatDate(row.original.last_activity_on, locale, { dateStyle: 'medium' })}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        id: 'flags',
        header: t('partners.columns.flags'),
        // FIX-01: the flags sort by their joined words; two rows with the same flags fall back to added-at, then id.
        accessorFn: (row) => row.flags.join(' '),
        sortingFn: (a, b) => compareFlags(a.original, b.original),
        cell: ({ row }) => (
          <span className="flex flex-col gap-0.5">
            <FlagWords flags={row.original.flags} archived={row.original.archived} />
          </span>
        ),
      },
      {
        // Landing 34: every row carries its Actions button, always drawn (never on hover only, never for some rows)
        id: 'actions',
        size: ACTIONS_WIDTH,
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <span className="-mx-2 flex justify-end">
            <RowActions row={row.original} mayArchive={full} onOpen={open} words={words} />
          </span>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `open` and `words` are this render's own closures
  }, [t, locale, types, sideTypes, people, base, plan.nameMax, full]);

  const activeFilters =
    [filters.q].filter(Boolean).length +
    filters.types.length +
    filters.owners.length +
    filters.statuses.length +
    filters.tiers.length +
    filters.priorities.length +
    (filters.key_partner ? 1 : 0) +
    (filters.stale ? 1 : 0) +
    (filters.quiet ? 1 : 0) +
    (filters.archived ? 1 : 0);

  // a list with nothing in it and no filter on: the side has no organisation yet (the cards would be four zeros)
  const trulyEmpty = !!answer && answer.total === 0 && activeFilters === 0;
  const showCards = !!answer && !failed && !trulyEmpty;

  const chipLabel = (keys: string[], label: (k: string) => string) =>
    keys.length ? keys.map(label).join(', ') : undefined;
  // one array for as long as the address is the same: the picker seeds its draft when this changes
  const statusPicked = useMemo(() => statusPicks(filters), [filters]);
  const statusLabel = (k: string) =>
    k === ARCHIVED_PICK ? t('partners.archived') : k === 'none' ? t('partners.status.none') : t(`partners.status.${k}`);

  return (
    <PageFrame>
      <PageHeader
        title={title}
        meta={
          answer ? (
            <span className="font-data" data-partners-total>
              {t('partners.count', { count: answer.total })}
            </span>
          ) : null
        }
        actions={
          full ? (
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => setCreating(true)}
              data-partner-new
              className="max-sm:hidden"
            >
              {side === 'client' ? t('partners.newClient') : t('partners.newSupplier')}
            </Button>
          ) : null
        }
      />
      {tabs}
      {showCards ? (
        <>
          <KpiCards base={base} side={side} filters={filters} counts={counts} />
          <PhoneChips base={base} filters={filters} counts={counts} />
        </>
      ) : null}
      <SavedViewsBar
        page={page}
        // on a phone the three chips above are the fixed views (the 13 Nov board); the type is under Filter
        fixed={phone ? [] : fixedViews}
        current={currentView}
        query={{ ...filters, view: undefined } as unknown as Record<string, unknown>}
        onOpen={openView}
        canShare={full}
      />
      <div className="flex flex-wrap items-center gap-2" data-partners-chips>
        <PhoneFilter label={t('common.filter')} count={activeFilters}>
          <form
            className="flex items-center"
            onSubmit={(e) => {
              e.preventDefault();
              go(withSearch(filters, q));
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('partners.search')}
              aria-label={t('common.search')}
              className="h-[var(--control-h-sm)] w-[220px]"
              type="search"
              enterKeyHint="search"
              data-partners-search
            />
          </form>
          <ChipPicker
            idPrefix="type"
            field={t('partners.columns.type')}
            value={chipLabel(
              filters.types,
              (k) =>
                nameOf(
                  types.find((x) => x.key === k),
                  locale,
                ) || k,
            )}
            count={filters.types.length ? answer?.total : undefined}
            options={types.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            picked={filters.types}
            onChange={(v) => set({ types: v })}
            words={t}
          />
          <ChipPicker
            idPrefix="owner"
            field={t('partners.columns.owner')}
            value={chipLabel(filters.owners, (k) => (people[k] ? personName(people[k]!, locale) : k))}
            count={filters.owners.length ? answer?.total : undefined}
            options={org.people.map((p) => ({ value: p.id, label: personName(p, locale) }))}
            picked={filters.owners}
            onChange={(v) => set({ owners: v })}
            words={t}
          />
          <ChipPicker
            idPrefix="status"
            field={t('partners.columns.status')}
            // Landing 34: Archived is one of the chip's choices (it writes the address's archived view), so an archived
            // organisation can be found — and restored from its row — without knowing its address
            value={chipLabel(statusPicked, statusLabel)}
            count={statusPicked.length ? answer?.total : undefined}
            options={[...STATUSES, 'none', ARCHIVED_PICK].map((s) => ({ value: s, label: statusLabel(s) }))}
            picked={statusPicked}
            onChange={(v) => go({ ...withStatusPicks(filters, v), view: '' })}
            words={t}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<SlidersHorizontal />}
            onClick={() => setMore(true)}
            data-partners-more
          >
            {t('partners.moreFilters')}
            {filters.tiers.length +
              filters.priorities.length +
              (filters.key_partner ? 1 : 0) +
              (filters.stale ? 1 : 0) +
              (filters.quiet ? 1 : 0) +
              (filters.archived ? 1 : 0) >
            0 ? (
              <span className="font-data text-xs text-muted">
                {filters.tiers.length +
                  filters.priorities.length +
                  (filters.key_partner ? 1 : 0) +
                  (filters.stale ? 1 : 0) +
                  (filters.quiet ? 1 : 0) +
                  (filters.archived ? 1 : 0)}
              </span>
            ) : null}
          </Button>
          {filters.q ||
          filters.types.length ||
          filters.owners.length ||
          filters.statuses.length ||
          filters.tiers.length ||
          filters.priorities.length ||
          filters.key_partner ||
          filters.stale ||
          filters.quiet ||
          filters.archived ? (
            <Button size="sm" variant="link" onClick={() => go(empty())} data-partners-clear>
              {t('common.clearAll')}
            </Button>
          ) : null}
        </PhoneFilter>
        {asCards ? null : (
          <ColumnsMenu
            // only the columns this width has room for can be chosen: one it has no room for stays hidden
            columns={[
              { id: 'type', label: t('partners.columns.type') },
              { id: 'status', label: t('partners.columns.status') },
              { id: 'owner_id', label: t('partners.columns.owner') },
              { id: 'last_activity_on', label: t('partners.columns.lastActivity') },
              { id: 'flags', label: t('partners.columns.flags') },
            ].filter((c) => !(plan.hidden as string[]).includes(c.id))}
            visibility={columnVisibility}
            onChange={setColumnVisibility}
          />
        )}
        {pending ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-muted" data-partners-pending>
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('common.loading')}
          </span>
        ) : null}
      </div>
      {partial ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-raised px-4 py-2.5 text-sm shadow-1"
          data-partners-partial
        >
          <span>{t('partners.read.partial')}</span>
          <Button size="sm" variant="link" loading={pending} onClick={reread} data-partners-partial-retry>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : null}

      {filters.archived ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-raised px-4 py-2.5 text-sm shadow-1"
          data-archived-banner
        >
          <span>{t('partners.archivedView')}</span>
          <Button size="sm" variant="link" onClick={() => set({ archived: false })} data-archived-clear>
            {t('partners.showActive')}
          </Button>
        </div>
      ) : null}
      {answer ? <CappedNote shown={rows.length} total={answer.total} /> : null}
      <div
        ref={rowsRef}
        className={cn('flex min-w-0 flex-col transition-opacity', pending && 'opacity-60')}
        aria-busy={pending || undefined}
        data-partners-rows
      >
        {failed && failure?.kind === 'refused' ? (
          // a refusal is an answer, not a failed read: it is said as no access, with no Try again
          <DataState kind="no-access" what={title} message={t('state.noAccess', { what: title })} />
        ) : failed ? (
          <ReadFailed message={t('partners.list.failed')} failure={failure} />
        ) : answer && rows.length === 0 ? (
          <DataState
            kind="empty"
            message={trulyEmpty ? t(`partners.list.noneYet.${side}`) : t('partners.none')}
            action={
              trulyEmpty ? (
                full ? (
                  <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)} data-partner-new-empty>
                    {side === 'client' ? t('partners.newClient') : t('partners.newSupplier')}
                  </Button>
                ) : null
              ) : (
                <Button variant="secondary" onClick={() => go(empty())} data-partners-clear-empty>
                  {t('common.clearAll')}
                </Button>
              )
            }
          />
        ) : asCards ? (
          <ul className="overflow-hidden rounded-lg border border-border bg-raised shadow-1" data-partners-cards>
            {rows.map((r) => {
              const type = nameOf(
                types.find((x) => x.key === r.type),
                locale,
              );
              return (
                <li
                  key={r.id}
                  className="relative flex items-center gap-3 border-b border-border px-3.5 py-1.5 last:border-b-0"
                  data-partner-card={r.id}
                >
                  <PartnerLogo name={r.trade_name_en} size="sm" className="size-8" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    {/* Landing 34: the name wraps and is read whole (it was cut with "…"); the tap is the whole row */}
                    <Link
                      href={`${base}/${r.id}`}
                      className="inline-flex min-h-11 min-w-0 items-start pb-2.5 pt-2.5 font-medium leading-5 text-link after:absolute after:inset-0 after:content-['']"
                      data-entity="partner"
                      data-partner-link={r.id}
                    >
                      <bdi className="min-w-0 break-words">{tradeName(r, locale)}</bdi>
                      <LinkPending />
                    </Link>
                    <div className="-mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pb-1 text-sm text-muted">
                      <FlagWords flags={r.flags} archived={r.archived} />
                      {r.flags.length || r.archived ? <span aria-hidden="true">·</span> : null}
                      {type ? (
                        <>
                          <span>{type}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      ) : null}
                      <span className="font-data">
                        {r.last_activity_on ? formatDate(r.last_activity_on, locale, { dateStyle: 'medium' }) : '—'}
                      </span>
                    </div>
                  </div>
                  {/* the 13 Nov board: a pill only for what needs a second look — an active partner carries none */}
                  {r.status && r.status !== 'active' ? (
                    <StatusChip tone={statusTone(r.status)} className="shrink-0">
                      {t(`partners.status.${r.status}`)}
                    </StatusChip>
                  ) : null}
                  {/* over the row's own tap (the link's ::after), so the button is pressed, not the row */}
                  <span className="relative z-[1] -me-2 shrink-0">
                    <RowActions row={r} mayArchive={full} onOpen={open} words={words} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            selectable={canBulk}
            rowSelection={selected}
            onRowSelectionChange={setSelected}
            // FIX-01 (P1b): with only the own-task capability, only the rows this person owns may be picked.
            canSelectRow={canAssign ? undefined : (r) => r.owner_id === me.person.id}
            sorting={sorting}
            onSortingChange={setSorting}
            columnVisibility={visibility}
            onRowClick={(r) => open(r.id)}
            labels={{ selectRow: t('table.selectRow'), selectAll: t('table.selectAll') }}
            emptyState={<DataState kind={answer ? 'empty' : 'loading'} message={t('partners.none')} />}
          />
        )}
      </div>

      {canBulk ? (
        <BulkBar
          ids={ids}
          onClear={() => setSelected({})}
          actions={[
            {
              key: 'assign',
              label: t('partners.bulk.assign'),
              variant: 'primary',
              open: (selectedIds) => {
                setAssignIds(selectedIds);
                setAssigning(true);
              },
            },
          ]}
        />
      ) : null}
      <AssignDialog
        open={assigning}
        onOpenChange={setAssigning}
        ids={assignIds}
        side={side}
        org={org}
        priorities={priorities}
        words={words}
        onDone={() => setSelected({})}
      />
      <MoreFiltersDialog
        open={more}
        onOpenChange={setMore}
        filters={filters}
        tiers={tiers}
        priorities={priorities}
        // Quiet is offered where the list read tells of it (View on Finance), or where the address already carries it
        quiet={counts.quiet !== null || filters.quiet}
        onApply={(f) => {
          setMore(false);
          go({ ...f, view: '' });
        }}
      />
      <NewPartnerDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          // Create's address (?new=1) is spent once the dialog closes, so a reload does not open it again
          if (!open && startCreating) window.history.replaceState(null, '', window.location.pathname);
        }}
        side={side}
        me={me}
        org={org}
        types={types}
        tiers={tiers}
        onCreated={(id) => {
          // the list on screen was read before the add: going back to it reads it again (list/freshness.ts)
          markPartnersChanged();
          open(id);
        }}
      />
    </PageFrame>
  );
}

/**
 * A row's Actions (Landing 34): one button on every row, always drawn — Open for everyone; Archive, or Unarchive on
 * an archived row, for someone with Full on the page (the database's own gate: partner.writable). Archive and
 * Unarchive are one request with its Undo, and the list reads again after it.
 */
function RowActions({
  row,
  mayArchive,
  onOpen,
  words,
}: {
  row: PartnerRow;
  mayArchive: boolean;
  onOpen: (id: string) => void;
  words: (done: string) => CommandWords;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const name = tradeName(row, locale);
  const flip = (fn: 'partner_archive' | 'partner_unarchive', done: string) => {
    markPartnersChanged();
    return command(words(done), () => rpc(fn, { p_id: row.id }) as Promise<{ request_id?: string | null } | null>);
  };
  return (
    // the row is itself a press target: a press on its Actions is the button's alone
    <span onClick={(e) => e.stopPropagation()}>
      <Menu>
        <MenuTrigger asChild>
          <IconButton
            label={`${t('common.actions')} · ${name}`}
            icon={<MoreHorizontal />}
            size="sm"
            data-partner-actions={row.id}
          />
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => onOpen(row.id)} data-partner-row-open>
            {t('partners.rowOpen')}
          </MenuItem>
          {mayArchive ? (
            row.archived ? (
              <MenuItem
                onSelect={() => void flip('partner_unarchive', t('partners.unarchivedDone', { name }))}
                data-partner-row-unarchive
              >
                {t('partners.unarchivePartner')}
              </MenuItem>
            ) : (
              <MenuItem
                onSelect={() => void flip('partner_archive', t('partners.archivedDone', { name }))}
                data-partner-row-archive
              >
                {t('partners.archivePartner')}
              </MenuItem>
            )
          ) : null}
        </MenuContent>
      </Menu>
    </span>
  );
}

/**
 * A row's flags as coloured words with a small icon each (V21: Stale amber, Quiet with its card's moon, the rest in
 * their own tone) — words, not pills, so a row carries one pill at most (its status). Colour never says it alone: the
 * word is always there.
 */
function FlagWords({ flags, archived }: { flags: string[]; archived: boolean }) {
  const t = useTranslations();
  const word = 'inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium leading-[18px]';
  return (
    <>
      {flags.map((f) => (
        <span key={f} className={cn(word, f === 'stale' ? 'text-warning' : 'text-info')} data-flag={f}>
          {f === 'stale' ? (
            <Hourglass className="size-4 shrink-0" aria-hidden="true" />
          ) : f === 'quiet' ? (
            <Moon className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          )}
          {t(`partners.flags.${f}`)}
        </span>
      ))}
      {archived ? (
        <span className={cn(word, 'text-muted')} data-flag="archived">
          <Archive className="size-4 shrink-0" aria-hidden="true" />
          {t('partners.archived')}
        </span>
      ) : null}
    </>
  );
}

/** FIX-01: the columns chooser — every column but the name can be hidden; the choice is this list's state. */
function ColumnsMenu({
  columns,
  visibility,
  onChange,
}: {
  columns: { id: string; label: string }[];
  visibility: VisibilityState;
  onChange: (v: VisibilityState) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <RP.Root open={open} onOpenChange={setOpen}>
      {/* an anchor, not a trigger: a trigger would put aria-expanded on the span (axe: aria-allowed-attr) */}
      <RP.Anchor asChild>
        <span>
          <Button size="sm" variant="ghost" icon={<Columns3 />} onClick={() => setOpen(true)} data-partners-columns>
            {t('partners.columns.title')}
          </Button>
        </span>
      </RP.Anchor>
      <RP.Portal>
        <RP.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[320px] w-[260px] overflow-y-auto rounded-lg border border-border bg-raised p-2 shadow-2"
          data-columns-menu
        >
          <ul className="flex flex-col">
            {columns.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
                <Checkbox
                  id={`col-${c.id}`}
                  label={c.label}
                  checked={visibility[c.id] !== false}
                  onCheckedChange={(v) => onChange({ ...visibility, [c.id]: v })}
                />
                <label htmlFor={`col-${c.id}`}>{c.label}</label>
              </li>
            ))}
          </ul>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}

/** A filter chip whose click opens a picker of several values (M102: dashed while empty, solid with its value and ✕).
 * FIX-45: the picker holds a draft and applies it once, when it closes — a checkbox toggle used to navigate on every
 * click, so ticking three filters cost three full page renders. The ✕ on the chip itself still applies at once
 * (one action, one navigation). */
function ChipPicker({
  idPrefix,
  field,
  value,
  count,
  options,
  picked,
  onChange,
  words,
}: {
  idPrefix: string;
  field: string;
  value: string | undefined;
  count?: number;
  options: { value: string; label: string }[];
  picked: string[];
  onChange: (v: string[]) => void;
  words: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(picked);
  const [openedFor, setOpenedFor] = useState<string[] | null>(null);
  // the draft is seeded from the applied values each time the picker opens (the render-phase sync the codebase
  // uses for mount-once state, e.g. NotePage) — while it is open the draft is the picker's own, not the page's
  if (open && openedFor !== picked) {
    setOpenedFor(picked);
    setDraft(picked);
  }
  const changeOpen = (o: boolean) => {
    setOpen(o);
    if (!o && openedFor !== null) {
      setOpenedFor(null);
      if (draft.join(',') !== picked.join(',')) onChange(draft);
    }
  };
  return (
    <RP.Root open={open} onOpenChange={changeOpen}>
      {/* an anchor, not a trigger: a trigger would put aria-expanded on the span (axe: aria-allowed-attr) */}
      <RP.Anchor asChild>
        <span data-chip={field}>
          <FilterChip
            field={field}
            value={value}
            count={count}
            onClick={() => setOpen(true)}
            onRemove={value ? () => onChange([]) : undefined}
            addLabel={words('chips.add', { field })}
            removeLabel={words('chips.remove', { field, value: value ?? '' })}
          />
        </span>
      </RP.Anchor>
      <RP.Portal>
        <RP.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[320px] w-[260px] overflow-y-auto rounded-lg border border-border bg-raised p-2 shadow-2"
          data-chip-picker
        >
          <ul className="flex flex-col">
            {options.map((o) => (
              <li key={o.value} className="rounded-md px-2 py-1.5 hover:bg-surface" data-chip-option={o.value}>
                <span className="flex items-center gap-2">
                  <Checkbox
                    id={`${idPrefix}-${o.value}`}
                    label={o.label}
                    checked={draft.includes(o.value)}
                    onCheckedChange={(v) => setDraft(v ? [...draft, o.value] : draft.filter((x) => x !== o.value))}
                  />
                  <label htmlFor={`${idPrefix}-${o.value}`} className="text-sm">
                    {o.label}
                  </label>
                </span>
              </li>
            ))}
          </ul>
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}

function MoreFiltersDialog({
  open,
  onOpenChange,
  filters,
  tiers,
  priorities,
  quiet,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ListFilters;
  tiers: ListEntry[];
  priorities: ListEntry[];
  quiet: boolean;
  onApply: (f: ListFilters) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [draft, setDraft] = useState(filters);
  const [openedFor, setOpenedFor] = useState<ListFilters | null>(null);
  if (open && openedFor !== filters) {
    setOpenedFor(filters);
    setDraft(filters);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partners.moreFilters')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onApply(draft)} data-filters-apply>
            {t('common.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-more-filters>
        <Field label={t('partners.tier')}>
          {(p) => (
            <Select
              {...p}
              value={draft.tiers[0] ?? 'all'}
              onValueChange={(v) => setDraft({ ...draft, tiers: v === 'all' ? [] : [v] })}
              placeholder={t('common.all')}
              options={[
                { value: 'all', label: t('common.all') },
                ...tiers.map((x) => ({ value: x.id, label: nameOf(x, locale) })),
              ]}
            />
          )}
        </Field>
        <Field label={t('partners.priority')}>
          {(p) => (
            <Select
              {...p}
              value={draft.priorities[0] ?? 'all'}
              onValueChange={(v) => setDraft({ ...draft, priorities: v === 'all' ? [] : [v] })}
              placeholder={t('common.all')}
              options={[
                { value: 'all', label: t('common.all') },
                ...clientPriorities(priorities).map((x) => ({ value: x.id, label: nameOf(x, locale) })),
              ]}
            />
          )}
        </Field>
        <span className="flex items-center gap-2">
          <Switch
            id="more-key-partner"
            checked={draft.key_partner}
            onCheckedChange={(v) => setDraft({ ...draft, key_partner: v })}
            label={t('partners.keyPartnerOnly')}
          />
          <label htmlFor="more-key-partner" className="text-sm">
            {t('partners.keyPartnerOnly')}
          </label>
        </span>
        <span className="flex items-center gap-2">
          <Switch
            id="more-stale"
            checked={draft.stale}
            onCheckedChange={(v) => setDraft({ ...draft, stale: v })}
            label={t('partners.staleOnly')}
          />
          <label htmlFor="more-stale" className="text-sm">
            {t('partners.staleOnly')}
          </label>
        </span>
        {quiet ? (
          <span className="flex items-center gap-2">
            <Switch
              id="more-quiet"
              checked={draft.quiet}
              onCheckedChange={(v) => setDraft({ ...draft, quiet: v })}
              label={t('partners.quietOnly')}
            />
            <label htmlFor="more-quiet" className="text-sm">
              {t('partners.quietOnly')}
            </label>
          </span>
        ) : null}
        <span className="flex items-center gap-2">
          <Switch
            id="more-archived"
            checked={draft.archived}
            onCheckedChange={(v) => setDraft({ ...draft, archived: v })}
            label={t('partners.showArchived')}
          />
          <label htmlFor="more-archived" className="text-sm">
            {t('partners.showArchived')}
          </label>
        </span>
      </div>
    </Dialog>
  );
}

/** Assign owner and priority to the selection: one request, one Undo (V91's load beside each person joins in P5-1). */
function AssignDialog({
  open,
  onOpenChange,
  ids,
  side,
  org,
  priorities,
  words,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  side: Side;
  org: OrgAnswer;
  priorities: ListEntry[];
  words: (done: string) => CommandWords;
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.bulk.assigned', { count: ids.length })),
      () =>
        rpc('partner_bulk_assign', {
          p_ids: ids,
          p_side: side,
          p_owner: owner || (null as unknown as string),
          p_priority: priority || (null as unknown as string),
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          onOpenChange(false);
          onDone();
          router.refresh();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partners.bulk.title', { count: ids.length })}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!owner && !priority}
            loading={busy}
            onClick={() => void save()}
            data-assign-save
          >
            {t('partners.bulk.assign')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('partners.columns.owner')}>
          {(p) => (
            <Select
              {...p}
              value={owner}
              onValueChange={setOwner}
              placeholder={t('partners.bulk.keepOwner')}
              // F101: the same user list as the per-record picker — everyone, the admin account included.
              options={[...org.people]
                .map((x) => ({ value: x.id, label: personName(x, locale) }))
                .sort((a, b) => a.label.localeCompare(b.label))}
            />
          )}
        </Field>
        <Field label={t('partners.priority')}>
          {(p) => (
            <Select
              {...p}
              value={priority}
              onValueChange={setPriority}
              placeholder={t('partners.bulk.keepPriority')}
              options={clientPriorities(priorities).map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
