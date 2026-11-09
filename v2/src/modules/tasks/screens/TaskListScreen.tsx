'use client';
import { CalendarDays, Columns3, List, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { formatDate } from '@/core/i18n/format';
import { nameOf } from '@/modules/org/types';
import { BulkBar } from '@/ui/BulkBar';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FilterChip, StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Input } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneFilter } from '@/ui/PhoneFilter';
import { Select } from '@/ui/Select';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import {
  DUE_CHIPS,
  LAYOUTS,
  SCOPES,
  STATUS_CHIPS,
  STATUS_TONE,
  TASK_SORTS,
  dueState,
  filtersHref,
  keepRow,
  phoneScopes,
  riyadhDay,
  queryFilters,
  sortRows,
  statusView,
  type Layout,
  type TaskFilters,
  type TaskSortKey,
} from '../rules';
import type { TaskList, TaskRow, TeamLoad } from '../types';
import type { TaskLookups } from '../load';
import { PastWorkPanel } from './PastWorkPanel';
import { QuickAdd } from './QuickAdd';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { TaskBoard } from './TaskBoard';
import { TaskBulkAssign } from './TaskBulkAssign';
import { TaskCalendar } from './TaskCalendar';
import { TeamLoadPanel } from './TeamLoadPanel';
import { DoneTick } from './StatusControl';
import { useNames } from './words';

export type TaskListData = {
  filters: TaskFilters;
  list: TaskList | null;
  lookups: TaskLookups;
  /** The team's load on the Team view (V91): absent when not shown, null when the read failed. */
  load?: TeamLoad[] | null;
  /** Quick add opens on arrival (the + menu's Task, /tasks/new). */
  adding: boolean;
};

/**
 * The Tasks list (§3.7; V517's stage 1): My work · Owned · Helping · Team, then chips for status, due, client and
 * project. One row per task: the tick (Done in one tap), its title, number, owner, client or project and due day, and
 * its status. 390 px first: a row wraps, the page never scrolls sideways (V509).
 */
export function TaskListScreen({ data }: { data: TaskListData }) {
  const t = useTranslations();
  const router = useRouter();
  const me = useMe();
  const { filters: f, list, lookups } = data;
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const [adding, setAdding] = useState(data.adding);
  // opened from /tasks/new: once saved, the address becomes the new task's own, so Back and refresh never reopen the
  // empty form (the supervisor's sweep of 15 Oct). Read when the form closes, so a later Add task stays on the list.
  const closedOnAddress = useRef(false);
  const [q, setQ] = useState(f.q ?? '');
  // the box shows the search the address holds: a navigation that changes the search (Clear all, a saved view) must
  // move the box too — a box that kept its mount-time text showed a search that was no longer running (F102).
  const [seenQ, setSeenQ] = useState(f.q ?? '');
  if ((f.q ?? '') !== seenQ) {
    setSeenQ(f.q ?? '');
    setQ(f.q ?? '');
  }
  const today = riyadhDay(new Date());
  // FIX-01: the priority filter is judged on the rows, the sort re-orders them — the server's order stands when no
  // sort is chosen.
  const rows = sortRows(
    (list?.rows ?? []).filter((r) => keepRow(r, f, me.person.id, today)),
    f.sort,
    lookups.priorities,
  );
  const layout = f.layout ?? 'list';
  // FIX-01 (F100/F138, P1b): row selection and the bulk bar stay with whoever may give work to others
  // (`tasks.assign`) — a member's own-task bulk-assign is the partners lists', not this list's.
  const canBulk = me.capabilities.includes('tasks.assign');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const toggleRow = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const go = (change: Partial<TaskFilters>) => router.push(filtersHref(f, change));
  const retry = () => router.refresh();
  // the open saved view (Phase 5): All, or a built-in — Starred, Need help — or one anyone saved; the choice lives
  // in the address with the filters, so Back and refresh keep it
  const [view, setView] = useState(f.escalated ? 'escalated' : f.starred ? 'starred' : 'all');
  // the open view follows the address, as the search box does above: a saved view opened by address must show as
  // open, not keep the view the list mounted with.
  const [seenView, setSeenView] = useState(f.escalated ? 'escalated' : f.starred ? 'starred' : 'all');
  const currentView = f.escalated ? 'escalated' : f.starred ? 'starred' : 'all';
  if (currentView !== seenView) {
    setSeenView(currentView);
    setView(currentView);
  }
  const openView = (v: { key: string; query?: Record<string, unknown> }) => {
    setView(v.key);
    if (v.key === 'all') return go({ starred: undefined, escalated: undefined });
    if (v.key === 'starred') return go({ starred: true, escalated: undefined });
    if (v.key === 'escalated') return go({ escalated: true, starred: undefined });
    // FIX-12 (D42): Mine — the tasks I own or am helping on, across all scope tabs.
    if (v.key === 'mine') return go({ scope: 'my_work', starred: undefined, escalated: undefined });
    // a saved view: its whole query applies on this list (FIX-12, D36(j))
    go(queryFilters(v.query));
  };

  const chipMenu = (field: string, options: { key: string; label: string; href: string }[]) => (
    <Menu>
      <MenuTrigger
        className="inline-flex h-[var(--control-h-sm)] items-center gap-1.5 whitespace-nowrap rounded-pill border border-dashed border-border-strong px-3.5 text-sm text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={t('chips.add', { field })}
      >
        <span aria-hidden="true">+</span> {field}
      </MenuTrigger>
      <MenuContent align="start" className="max-h-80 overflow-y-auto">
        {options.map((o) => (
          <MenuItem key={o.key} asChild>
            <Link href={o.href}>{o.label}</Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
  const applied = (field: string, value: string, drop: Partial<TaskFilters>) => (
    <FilterChip
      field={field}
      value={value}
      onRemove={() => go(drop)}
      removeLabel={t('chips.remove', { field, value })}
    />
  );
  const statusLabel = (k: string) => t(`pages.tasks.chips.status.${k}`);
  const dueLabel = (k: string) => t(`pages.tasks.chips.due.${k}`);
  const fStatus = t('pages.tasks.fields.status');
  const fDue = t('pages.tasks.fields.due');
  const fClient = t('pages.tasks.fields.client');
  const fProject = t('pages.tasks.fields.project');
  const fOwner = t('pages.tasks.fields.owner');
  const fPriority = t('pages.tasks.fields.priority');

  return (
    <div className="flex min-w-0 flex-col gap-5" data-tasks-list>
      <PageHeader
        title={t('nav.tasks')}
        actions={
          atLeastOwn(me.levels.tasks) ? (
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => setAdding(true)}
              data-add-task
              className="max-sm:hidden"
            >
              {t('pages.tasks.add.open')}
            </Button>
          ) : null
        }
      />
      <Tabs
        label={t('pages.tasks.views.label')}
        value={f.scope}
        moreLabel={t('nav.more')}
        tabs={SCOPES.map((s) => ({
          value: s,
          label: t(`pages.tasks.views.${s}`),
          href: filtersHref(f, { scope: s }),
          more: !phoneScopes(me.capabilities).includes(s),
        }))}
      />
      <SavedViewsBar
        page="tasks"
        fixed={[{ key: 'all', label: t('pages.tasks.views.all') }]}
        current={view}
        query={{ ...f } as unknown as Record<string, unknown>}
        onOpen={openView}
        canShare={me.levels.tasks === 'full'}
        // FIX-12 (F046): the labelled default opens first on a fresh load, as Finance and My day already do.
        onDefault={openView}
        saveHint={t('views.saveHint')}
      />
      <div className="flex flex-wrap items-center gap-2" data-task-chips>
        <PhoneFilter label={t('common.filter')} count={filterCount(f)}>
          <form
            role="search"
            className="relative w-full sm:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: q.trim() || undefined });
            }}
          >
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('common.search')}
              placeholder={t('common.search')}
              className="ps-9"
            />
          </form>
          {f.status
            ? applied(fStatus, statusLabel(f.status), { status: undefined })
            : chipMenu(
                fStatus,
                STATUS_CHIPS.map((k) => ({ key: k, label: statusLabel(k), href: filtersHref(f, { status: k }) })),
              )}
          {f.due
            ? applied(fDue, dueLabel(f.due), { due: undefined })
            : chipMenu(
                fDue,
                DUE_CHIPS.map((k) => ({ key: k, label: dueLabel(k), href: filtersHref(f, { due: k }) })),
              )}
          {f.partner
            ? applied(fClient, names.partner(f.partner), { partner: undefined })
            : lookups.partners.length
              ? chipMenu(
                  fClient,
                  lookups.partners.map((p) => ({
                    key: p.id,
                    label: names.partner(p.id),
                    href: filtersHref(f, { partner: p.id }),
                  })),
                )
              : null}
          {f.project
            ? applied(fProject, names.project(f.project), { project: undefined })
            : lookups.projects.length
              ? chipMenu(
                  fProject,
                  lookups.projects.map((p) => ({
                    key: p.id,
                    label: `${p.number} · ${names.project(p.id)}`,
                    href: filtersHref(f, { project: p.id }),
                  })),
                )
              : null}
          {f.owner
            ? applied(fOwner, names.person(f.owner), { owner: undefined })
            : lookups.org?.people.length
              ? chipMenu(
                  fOwner,
                  [...(lookups.org?.people ?? [])]
                    .map((p) => ({ id: p.id, label: nameOf(p, names.locale) }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((p) => ({ key: p.id, label: p.label, href: filtersHref(f, { owner: p.id }) })),
                )
              : null}
          {f.priority
            ? applied(fPriority, priorityLabel(lookups.priorities, f.priority, names.locale), { priority: undefined })
            : lookups.priorities.length
              ? chipMenu(
                  fPriority,
                  lookups.priorities
                    .filter((p) => p.active)
                    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                    .map((p) => ({
                      key: p.key,
                      label: names.locale === 'ar' && p.name_ar ? p.name_ar : p.name_en,
                      href: filtersHref(f, { priority: p.key }),
                    })),
                )
              : null}
        </PhoneFilter>
        {f.scope === 'past' ? null : (
          <>
            <Select
              value={f.sort ?? ''}
              placeholder={t('pages.tasks.sort.label')}
              aria-label={t('pages.tasks.sort.label')}
              onValueChange={(v) => go({ sort: (v as TaskSortKey) || undefined })}
              options={TASK_SORTS.map((k) => ({ value: k, label: t(`pages.tasks.sort.${k}`) }))}
              className="w-44"
            />
            <LayoutSwitch filters={f} />
          </>
        )}
      </div>

      {data.load !== undefined ? <TeamLoadPanel load={data.load} /> : null}
      {f.scope === 'past' && atLeastOwn(me.levels.tasks) ? (
        <PastWorkPanel statuses={lookups.statuses} partners={lookups.partners} org={lookups.org} />
      ) : null}
      {lookups.failed.length ? (
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('pages.tasks.lookups') })}
          onRetry={retry}
          retryLabel={t('common.tryAgain')}
        />
      ) : null}
      {!list ? (
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('nav.tasks') })}
          onRetry={retry}
          retryLabel={t('common.tryAgain')}
        />
      ) : rows.length === 0 && layout === 'list' ? (
        <DataState
          kind="empty"
          message={t(
            f.escalated
              ? 'pages.tasks.empty.escalated'
              : f.starred
                ? 'pages.tasks.empty.starred'
                : isFiltered(f)
                  ? 'pages.tasks.emptyFiltered'
                  : `pages.tasks.empty.${f.scope}`,
          )}
        />
      ) : (
        // Board and Calendar keep their own shape when there are no tasks,
        // instead of the list's "No tasks yet" — that was why both layouts
        // showed no board and no calendar for an empty My work.
        <>
          {layout === 'board' ? (
            <TaskBoard rows={rows} lookups={lookups} today={today} />
          ) : layout === 'calendar' ? (
            <TaskCalendar rows={rows} lookups={lookups} today={today} filters={f} />
          ) : (
            <>
              {canBulk && rows.length ? (
                <div className="flex items-center gap-2 px-1 text-sm text-muted" data-task-select-all>
                  <Checkbox
                    checked={selected.length === 0 ? false : selected.length === rows.length ? true : 'indeterminate'}
                    onCheckedChange={(on) => setSelected(on ? rows.map((r) => r.id) : [])}
                    label={t('table.selectAll')}
                    id="task-select-all"
                  />
                  <label htmlFor="task-select-all">{t('table.selectAll')}</label>
                </div>
              ) : null}
              <ul
                className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised"
                data-task-rows
              >
                {rows.map((r) => (
                  <TaskLine
                    key={r.id}
                    row={r}
                    lookups={lookups}
                    today={today}
                    selectable={canBulk}
                    selected={selected.includes(r.id)}
                    onSelect={(on) => toggleRow(r.id, on)}
                  />
                ))}
              </ul>
            </>
          )}
          {list.more ? (
            <p className="text-sm text-muted">
              {t('pages.tasks.more', { shown: list.rows.length, total: list.total })}
            </p>
          ) : null}
        </>
      )}
      {canBulk ? (
        <BulkBar
          ids={selected}
          actions={[
            {
              key: 'assign',
              label: t('pages.tasks.bulkAssign.open'),
              open: () => setBulkOpen(true),
            },
          ]}
          onClear={() => setSelected([])}
        />
      ) : null}
      <TaskBulkAssign
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        ids={selected}
        org={lookups.org}
        priorities={lookups.priorities}
        onDone={() => setSelected([])}
      />
      <QuickAdd
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          // Create's address (/tasks/new, or ?new=1) is spent once the form closes or saves, so a reload does not open
          // it again; /tasks/new draws this list with the form open itself, with no redirect (V286)
          if (!open) {
            const url = new URL(window.location.href);
            const byAddress = url.searchParams.has('new') || url.pathname === '/tasks/new';
            closedOnAddress.current = byAddress;
            if (byAddress) {
              url.searchParams.delete('new');
              if (url.pathname === '/tasks/new') url.pathname = '/tasks';
              // null, as on Partners: Next copies its own state in and takes the new address as the router's, so the next
              // refresh of the list does not write ?new=1 back (an entry passed its own state is not re-read)
              window.history.replaceState(null, '', `${url.pathname}${url.search}`);
            }
          }
        }}
        org={lookups.org}
        partners={lookups.partners}
        projects={lookups.projects}
        priorities={lookups.priorities}
        initial={{ partnerId: f.partner, projectId: f.project }}
        onAdded={(r) => {
          if (closedOnAddress.current) router.replace(`/tasks/${r.number}`);
        }}
      />
    </div>
  );
}

const LAYOUT_ICON: Record<Layout, typeof List> = { list: List, board: Columns3, calendar: CalendarDays };

/** List / Board / Calendar: one view of the same rows (§8 Tasks), a link each so the choice lives in the address. */
function LayoutSwitch({ filters }: { filters: TaskFilters }) {
  const t = useTranslations();
  const current = filters.layout ?? 'list';
  return (
    <nav
      aria-label={t('pages.tasks.layout.label')}
      className="ms-auto flex rounded-md border border-border"
      data-layouts
    >
      {LAYOUTS.map((l) => {
        const Icon = LAYOUT_ICON[l];
        const on = l === current;
        return (
          <Link
            key={l}
            href={filtersHref(filters, { layout: l })}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex h-[var(--control-h-sm)] items-center gap-1.5 px-3 text-sm first:rounded-s-md last:rounded-e-md focus-visible:outline-2 focus-visible:outline-focus max-sm:min-w-11 max-sm:justify-center',
              on ? 'bg-accent-soft font-medium text-text' : 'text-muted hover:bg-surface',
            )}
            data-layout={l}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">{t(`pages.tasks.layout.${l}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const atLeastOwn = (l: string | undefined) => l === 'own' || l === 'full';
const isFiltered = (f: TaskFilters) => !!(f.status || f.due || f.partner || f.project || f.q || f.owner || f.priority);
/** How many filters are on, for the phone's one Filter button. */
const filterCount = (f: TaskFilters) =>
  [f.status, f.due, f.partner, f.project, f.q, f.owner, f.priority].filter(Boolean).length;

/** A priority key in the language on screen, or the key itself when the list no longer names it. */
function priorityLabel(
  priorities: { key: string; name_en: string; name_ar: string | null }[],
  key: string,
  locale: 'en' | 'ar',
): string {
  const p = priorities.find((x) => x.key === key);
  return p ? (locale === 'ar' && p.name_ar ? p.name_ar : p.name_en) : key;
}

function TaskLine({
  row,
  lookups,
  today,
  selectable,
  selected,
  onSelect,
}: {
  row: TaskRow;
  lookups: TaskLookups;
  today: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (on: boolean) => void;
}) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const view = statusView(row);
  const due = dueState(row, today);
  const where = row.project_id ? names.project(row.project_id) : row.partner_id ? names.partner(row.partner_id) : '';
  return (
    <li
      className="relative flex items-start gap-3 px-4 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
      data-task-row={row.number}
      data-due={due}
    >
      {selectable ? (
        <Checkbox
          checked={selected ?? false}
          onCheckedChange={(on) => onSelect?.(on)}
          label={t('table.selectRow', { name: row.title })}
          className="mt-1 shrink-0"
        />
      ) : null}
      {row.can_edit ? (
        <DoneTick task={row} statuses={lookups.statuses} title={row.title} />
      ) : (
        <span aria-hidden="true" className="mt-0.5 inline-block size-6 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/tasks/${row.number}`}
          className={cn(
            "break-words text-base font-medium text-text after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-focus",
            row.meaning === 'done' && 'text-muted line-through',
          )}
        >
          {row.title}
        </Link>
        {/* one run of text, so a wrapped line never ends on a separator */}
        <p className="break-words text-sm text-muted">
          <span className="font-data">{row.number}</span>
          {` · ${[names.person(row.owner_id), where].filter(Boolean).join(' · ')}`}
        </p>
        {row.due_on ? (
          <p
            className={cn(
              'text-sm text-muted',
              due === 'overdue' && 'font-medium text-danger',
              due === 'today' && 'text-text',
            )}
          >
            {due === 'today'
              ? t('pages.tasks.dueToday')
              : t('pages.tasks.dueOn', { date: formatDate(row.due_on, names.locale) })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusChip tone={STATUS_TONE[view]}>
          {view === 'blocked' ? t('pages.tasks.blocked') : names.status(row)}
        </StatusChip>
        {due === 'overdue' ? <StatusChip tone="danger">{t('status.overdue')}</StatusChip> : null}
      </div>
    </li>
  );
}
