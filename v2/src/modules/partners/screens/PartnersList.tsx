'use client';
import { CappedNote } from './CappedNote';
import * as RP from '@radix-ui/react-popover';
import type { RowSelectionState } from '@tanstack/react-table';
import { Plus, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
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
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PartnerLogo } from '@/ui/PartnerLogo';
import { PersonChip } from '@/ui/PersonChip';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { PageFrame } from '@/ui/shell/AppShell';
import { useMediaQuery } from '@/ui/useMediaQuery';
import { NewPartnerDialog } from './NewPartnerDialog';
import { PartnerHover } from './PartnerHover';
import {
  SIDE_PAGE,
  SIDE_ROUTE,
  STATUSES,
  nameOf,
  statusTone,
  tradeName,
  type ListEntry,
  type PartnerRow,
  type PartnersAnswer,
  type Side,
} from '../types';

export type ListFilters = {
  q: string;
  types: string[];
  owners: string[];
  statuses: string[];
  tiers: string[];
  priorities: string[];
  key_partner: boolean;
  stale: boolean;
  archived: boolean;
  view: string;
};

/** The address of a set of filters: what a saved view keeps, what the chips write. */
export function addressOf(base: string, f: ListFilters): string {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.types.length) q.set('type', f.types.join(','));
  if (f.owners.length) q.set('owner', f.owners.join(','));
  if (f.statuses.length) q.set('status', f.statuses.join(','));
  if (f.tiers.length) q.set('tier', f.tiers.join(','));
  if (f.priorities.length) q.set('priority', f.priorities.join(','));
  if (f.key_partner) q.set('key', '1');
  if (f.stale) q.set('stale', '1');
  if (f.archived) q.set('archived', '1');
  if (f.view) q.set('view', f.view);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * A lean list page (V98, V149, TECH-SPEC §3.4): saved views across the top (All and the side's types are the fixed
 * ones), the chips Type · Owner · Status, More filters for the rest, the table (two-line cards on a phone), a bulk bar
 * that assigns owner and priority to the selection as one request, and New. Every figure on it comes from
 * api.partners; the list is re-read through the address after every command.
 */
export function PartnersList({
  me,
  side,
  title,
  filters,
  answer,
  failed,
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
  org: OrgAnswer;
  types: ListEntry[];
  /** Every side's types, for the hover card's chips (the list's own `types` are this side's). */
  sideTypes: ListEntry[];
  tiers: ListEntry[];
  priorities: ListEntry[];
  /** Clients · Suppliers, one page with two tabs (V217); absent when the reader has only one side. */
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
  const people = Object.fromEntries(org.people.map((p) => [p.id, p]));
  const [selected, setSelected] = useState<RowSelectionState>({});
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState(startCreating && full);
  const [assigning, setAssigning] = useState(false);
  const [q, setQ] = useState(filters.q);
  const go = (f: ListFilters) => router.push(addressOf(base, f));
  const set = (patch: Partial<ListFilters>) => go({ ...filters, ...patch, view: '' });

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

  const columns = useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      {
        accessorKey: 'trade_name_en',
        header: t('partners.columns.name'),
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2.5">
            <PartnerLogo name={row.original.trade_name_en} size="sm" />
            <PartnerHover id={row.original.id} types={sideTypes}>
              <Link
                href={`${base}/${row.original.id}`}
                className="truncate font-medium text-link hover:underline"
                data-entity="partner"
                data-partner-link={row.original.id}
              >
                {tradeName(row.original, locale)}
              </Link>
            </PartnerHover>
            {row.original.key_partner ? <StatusChip tone="info">{t('partners.keyPartner')}</StatusChip> : null}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('partners.columns.type'),
        cell: ({ row }) =>
          nameOf(
            types.find((x) => x.key === row.original.type),
            locale,
          ) || '—',
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
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original.owner_id ? people[row.original.owner_id] : undefined;
          return p ? (
            <PersonChip person={avatarOf(p, locale)} href={`/people/${p.id}`} />
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
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.flags.map((f) => (
              <StatusChip key={f} tone={f === 'stale' ? 'warning' : 'info'}>
                {t(`partners.flags.${f}`)}
              </StatusChip>
            ))}
            {row.original.archived ? <StatusChip tone="neutral">{t('partners.archived')}</StatusChip> : null}
          </span>
        ),
      },
    ],
    [t, locale, types, sideTypes, people, base],
  );

  const chipLabel = (keys: string[], label: (k: string) => string) =>
    keys.length ? keys.map(label).join(', ') : undefined;

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
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)} data-partner-new>
              {side === 'client' ? t('partners.newClient') : t('partners.newSupplier')}
            </Button>
          ) : null
        }
      />
      {tabs}
      <SavedViewsBar
        page={page}
        fixed={fixedViews}
        current={currentView}
        query={{ ...filters, view: undefined } as unknown as Record<string, unknown>}
        onOpen={openView}
        canShare={full}
      />
      <div className="flex flex-wrap items-center gap-2" data-partners-chips>
        <form
          className="flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q });
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('partners.search')}
            aria-label={t('common.search')}
            className="h-[var(--control-h-sm)] w-[220px]"
            data-partners-search
          />
        </form>
        <ChipPicker
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
          field={t('partners.columns.owner')}
          value={chipLabel(filters.owners, (k) => (people[k] ? personName(people[k]!, locale) : k))}
          count={filters.owners.length ? answer?.total : undefined}
          options={org.people.map((p) => ({ value: p.id, label: personName(p, locale) }))}
          picked={filters.owners}
          onChange={(v) => set({ owners: v })}
          words={t}
        />
        <ChipPicker
          field={t('partners.columns.status')}
          value={chipLabel(filters.statuses, (k) =>
            k === 'none' ? t('partners.status.none') : t(`partners.status.${k}`),
          )}
          count={filters.statuses.length ? answer?.total : undefined}
          options={[...STATUSES, 'none'].map((s) => ({
            value: s,
            label: s === 'none' ? t('partners.status.none') : t(`partners.status.${s}`),
          }))}
          picked={filters.statuses}
          onChange={(v) => set({ statuses: v })}
          words={t}
        />
        <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => setMore(true)} data-partners-more>
          {t('partners.moreFilters')}
          {filters.tiers.length +
            filters.priorities.length +
            (filters.key_partner ? 1 : 0) +
            (filters.stale ? 1 : 0) +
            (filters.archived ? 1 : 0) >
          0 ? (
            <span className="font-data text-xs text-muted">
              {filters.tiers.length +
                filters.priorities.length +
                (filters.key_partner ? 1 : 0) +
                (filters.stale ? 1 : 0) +
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
        filters.archived ? (
          <Button size="sm" variant="link" onClick={() => go(empty())} data-partners-clear>
            {t('common.clearAll')}
          </Button>
        ) : null}
      </div>

      {answer ? <CappedNote shown={rows.length} total={answer.total} /> : null}
      {failed ? (
        <DataState kind="failed" what={title} onRetry={() => router.refresh()} retryLabel={t('common.tryAgain')} />
      ) : answer && rows.length === 0 ? (
        <DataState kind="empty" message={t('partners.none')} />
      ) : phone ? (
        <ul className="flex flex-col gap-2" data-partners-cards>
          {rows.map((r) => {
            const owner = r.owner_id ? people[r.owner_id] : undefined;
            return (
              <li key={r.id} className="rounded-lg border border-border bg-raised p-3" data-partner-card={r.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PartnerLogo name={r.trade_name_en} size="sm" />
                    <Link
                      href={`${base}/${r.id}`}
                      className="inline-flex min-h-11 min-w-0 items-center truncate font-medium text-link"
                      data-entity="partner"
                      data-partner-link={r.id}
                    >
                      {tradeName(r, locale)}
                    </Link>
                  </span>
                  <span className="font-data text-xs text-muted">
                    {r.last_activity_on ? formatDate(r.last_activity_on, locale, { dateStyle: 'medium' }) : '—'}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>
                    {nameOf(
                      types.find((x) => x.key === r.type),
                      locale,
                    ) || '—'}
                  </span>
                  <span>·</span>
                  <span>{owner ? personName(owner, locale) : '—'}</span>
                  {r.status ? (
                    <StatusChip tone={statusTone(r.status)}>{t(`partners.status.${r.status}`)}</StatusChip>
                  ) : null}
                  {r.flags.map((f) => (
                    <StatusChip key={f} tone={f === 'stale' ? 'warning' : 'info'}>
                      {t(`partners.flags.${f}`)}
                    </StatusChip>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          selectable={canAssign}
          rowSelection={selected}
          onRowSelectionChange={setSelected}
          onRowClick={(r) => router.push(`${base}/${r.id}`)}
          labels={{ selectRow: t('table.selectRow'), selectAll: t('table.selectAll') }}
          emptyState={<DataState kind={answer ? 'empty' : 'loading'} message={t('partners.none')} />}
        />
      )}

      {canAssign ? (
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
        onCreated={(id) => router.push(`${base}/${id}`)}
      />
    </PageFrame>
  );
}

function empty(): ListFilters {
  return {
    q: '',
    types: [],
    owners: [],
    statuses: [],
    tiers: [],
    priorities: [],
    key_partner: false,
    stale: false,
    archived: false,
    view: '',
  };
}

/** A filter chip whose click opens a picker of several values (M102: dashed while empty, solid with its value and ✕). */
function ChipPicker({
  field,
  value,
  count,
  options,
  picked,
  onChange,
  words,
}: {
  field: string;
  value: string | undefined;
  count?: number;
  options: { value: string; label: string }[];
  picked: string[];
  onChange: (v: string[]) => void;
  words: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <RP.Root open={open} onOpenChange={setOpen}>
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
              <li key={o.value} className="rounded-md px-2 py-1.5 hover:bg-surface">
                <Checkbox
                  label={o.label}
                  checked={picked.includes(o.value)}
                  onCheckedChange={(v) => onChange(v ? [...picked, o.value] : picked.filter((x) => x !== o.value))}
                />
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
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ListFilters;
  tiers: ListEntry[];
  priorities: ListEntry[];
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
              value={draft.tiers[0] ?? ''}
              onValueChange={(v) => setDraft({ ...draft, tiers: v ? [v] : [] })}
              placeholder={t('common.all')}
              options={tiers.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Field label={t('partners.priority')}>
          {(p) => (
            <Select
              {...p}
              value={draft.priorities[0] ?? ''}
              onValueChange={(v) => setDraft({ ...draft, priorities: v ? [v] : [] })}
              placeholder={t('common.all')}
              options={priorities.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Switch
          checked={draft.key_partner}
          onCheckedChange={(v) => setDraft({ ...draft, key_partner: v })}
          label={t('partners.keyPartnerOnly')}
        />
        <Switch
          checked={draft.stale}
          onCheckedChange={(v) => setDraft({ ...draft, stale: v })}
          label={t('partners.staleOnly')}
        />
        <Switch
          checked={draft.archived}
          onCheckedChange={(v) => setDraft({ ...draft, archived: v })}
          label={t('partners.showArchived')}
        />
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
              options={org.people.map((x) => ({ value: x.id, label: personName(x, locale) }))}
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
              options={priorities.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
