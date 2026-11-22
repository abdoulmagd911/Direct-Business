'use client';
import { CalendarDays, ChevronDown, Columns3, List, ListChecks, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
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
import { workCount } from '../my-work-count';
import {
  DUE_CHIPS,
  LAYOUTS,
  SCOPES,
  SEARCH_DEBOUNCE_MS,
  STATUS_CHIPS,
  STATUS_TONE,
  TASK_SORTS,
  dueState,
  filtersHref,
  keepRow,
  phoneScopes,
  riyadhDay,
  defaultViewOpens,
  searchBoxOnAddress,
  searchHref,
  searchTerm,
  sortRows,
  viewFilters,
  type Layout,
  type TaskFilters,
  type TaskSortKey,
} from '../rules';
import type { TaskList, TaskRow, TeamLoad } from '../types';
import type { TaskLookups } from '../load';
import { PastWorkPanel } from './PastWorkPanel';
import { QuickAdd } from './QuickAdd';
import { navStartedTo } from '@/ui/shell/nav-pending';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { TaskBoard } from './TaskBoard';
import { TaskBulkAssign } from './TaskBulkAssign';
import { TaskCalendar } from './TaskCalendar';
import { TeamLoadPanel } from './TeamLoadPanel';
import { DoneTick, statusName } from './StatusControl';
import { CountBadge, DueMark, ResponsibleMark, StepsMark, WhereMark } from './TaskBits';
import { pillOf, statusGroups } from './look';
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
 * The Tasks list (§3.7; V517's stage 1; the look is the 15 Nov boards'): pill tabs My work · Owned · Helping · Team ·
 * Past work, the count line, then the search and the filter pills (status, due, partner, project, owner, priority) and
 * the List / Board / Calendar switch — every choice in the address, so switching the view keeps the tab, the filters
 * and the place. The list is one white card, grouped by status with a count per group (the board's columns, from the
 * same `statusGroups`). One row per task: the tick (Done), its title, the partner or project, the due day, the
 * Responsible person and ONE status pill (`pillOf`); overdue is the date in the danger colour, never a pill. The card
 * is its own container: under 56 rem of room a row stacks (the phone drawing), so nothing scrolls sideways (V509).
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
  // Landing 35: the box asks as it is typed in, so an answer to its OWN question never rewrites it (an older answer
  // arriving while the person typed on ate the last letters and threw the caret) — `searchBoxOnAddress`.
  const [asked, setAsked] = useState<string[]>([]);
  if ((f.q ?? '') !== seenQ) {
    const on = searchBoxOnAddress(f.q, asked);
    setSeenQ(f.q ?? '');
    setAsked(on.asked);
    if (on.follow) setQ(f.q ?? '');
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
  // The count line and the open tab's number (15 Nov: "Tab numbers count open tasks") are ONE count of the rows on
  // screen — `workCount`, the same function My day's banner reads. The tab carries its number only while the rows are
  // the whole tab: no chip, no search, no saved view, and not past the first page of 200; Past work has none.
  const counts = workCount(rows, today, me.person.id);
  const wholeTab = !!list && !list.more && !isFiltered(f) && !f.starred && !f.escalated;
  const groups = statusGroups(rows, lookups.statuses);
  const groupTitle = (g: (typeof groups)[number]) =>
    g.kind === 'blocked'
      ? t('pages.tasks.blocked')
      : g.status
        ? statusName(g.status, names.locale)
        : g.rows[0]
          ? names.status(g.rows[0])
          : g.key;
  // FIX-01 (F100/F138, P1b): row selection and the bulk bar stay with whoever may give work to others
  // (`tasks.assign`) — a member's own-task bulk-assign is the partners lists', not this list's.
  const canBulk = me.capabilities.includes('tasks.assign');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  // The selection is of the rows on screen (owner 13 Nov): another view, chip, search, sort or layout starts it again,
  // and a row that left the list (done, given away, changed by someone else) leaves it — Bulk assign never acts on a
  // task no longer shown, and Select all reads only what is shown.
  const listKey = filtersHref(f);
  const [seenListKey, setSeenListKey] = useState(listKey);
  if (listKey !== seenListKey) {
    setSeenListKey(listKey);
    setSelected([]);
  }
  const onScreen = new Set(rows.map((r) => r.id));
  const shown = selected.filter((id) => onScreen.has(id));
  const toggleRow = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...s.filter((x) => x !== id), id] : s.filter((x) => x !== id)));
  // a chip, the search or a sort is a move to another address: the shell's Loading shows at once (Landing 34)
  const go = (change: Partial<TaskFilters>) => {
    const href = filtersHref(f, change);
    if (navStartedTo(href)) router.push(href);
  };
  const retry = () => router.refresh();
  // Landing 35 — the search filters as you type. The cause of "only after Enter": the box only kept its own text, and
  // nothing but the form's submit ever moved the address. Now a pause of SEARCH_DEBOUNCE_MS after the last key asks
  // for the box's words (an emptied box drops the search); Enter asks at once. The address is REPLACED, not pushed, so
  // Back leaves the list instead of walking back through every letter; the screen stays mounted, so the box keeps its
  // focus and its caret. The router gives up an older question when a newer one is asked, and the rows and the address
  // arrive together, so an older answer cannot be drawn over a newer one.
  const term = searchTerm(q) ?? '';
  const wanted = searchHref(f, q);
  // asked already and the answer is on its way: the same question is not asked twice
  const inFlight = wanted !== null && asked[asked.length - 1] === term;
  const search = (href: string) => {
    setAsked((a) => [...a, term]);
    if (navStartedTo(href)) router.replace(href, { scroll: false });
  };
  const searchLater = useEffectEvent(search);
  useEffect(() => {
    if (!wanted || inFlight) return;
    const timer = setTimeout(() => searchLater(wanted), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [wanted, inFlight]);
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
    // a saved view: its whole query applies on this list (FIX-12, D36(j)); the layout on screen stays unless the view
    // names its own (Landing 35)
    go(viewFilters(f, v.query));
  };

  const chipMenu = (field: string, options: { key: string; label: string; href: string }[]) => (
    <Menu>
      <MenuTrigger
        className="inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-pill border border-border-strong bg-raised px-3.5 text-sm font-medium leading-[18px] text-text transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:h-11"
        aria-label={t('chips.add', { field })}
      >
        {field}
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
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
  const fOwner = t('pages.tasks.fields.responsible');
  const fPriority = t('pages.tasks.fields.priority');

  return (
    <div className="flex min-w-0 flex-col gap-5" data-tasks-list data-layout-open={layout}>
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
          count: s === f.scope && s !== 'past' && wholeTab ? counts.open : undefined,
        }))}
      />
      {list && !list.more ? (
        <p className="break-words text-sm leading-5 text-muted" data-task-count-line data-open={counts.open}>
          <b className="font-semibold text-strong">{t(`pages.tasks.views.${f.scope}`)}</b>
          {` · ${[
            t('pages.tasks.look.open', { count: counts.open }),
            t('pages.tasks.look.dueToday', { count: counts.dueToday }),
            t('pages.tasks.look.overdue', { count: counts.overdue }),
            t('pages.tasks.look.done', { count: counts.done }),
          ].join(' · ')}`}
        </p>
      ) : null}
      <SavedViewsBar
        page="tasks"
        fixed={[{ key: 'all', label: t('pages.tasks.views.all') }]}
        current={view}
        query={{ ...f } as unknown as Record<string, unknown>}
        onOpen={openView}
        canShare={me.levels.tasks === 'full'}
        // FIX-12 (F046): the labelled default opens first on a fresh load, as Finance and My day already do — but only
        // on the bare list: an address with a choice of its own (?layout=board, a tab, a search) is kept (Landing 35).
        onDefault={(v) => {
          if (defaultViewOpens(f)) openView(v);
        }}
        saveHint={t('views.saveHint')}
      />
      <div className="flex flex-wrap items-center gap-2" data-task-chips>
        <PhoneFilter label={t('common.filter')} count={filterCount(f)}>
          <form
            role="search"
            className="relative w-full sm:w-[280px]"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter asks at once — also when the same words were asked and no answer came (a lost request)
              if (wanted) search(wanted);
            }}
            data-task-search
          >
            <Search
              className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('pages.tasks.look.search')}
              placeholder={t('pages.tasks.look.search')}
              className="ps-10"
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
      ) : rows.length === 0 && layout !== 'calendar' ? (
        // the list and the board share the empty state (15 Nov: one line and Add task); the calendar keeps its month
        <DataState
          kind="empty"
          icon={<ListChecks />}
          message={t(
            f.escalated
              ? 'pages.tasks.empty.escalated'
              : f.starred
                ? 'pages.tasks.empty.starred'
                : isFiltered(f)
                  ? 'pages.tasks.emptyFiltered'
                  : `pages.tasks.empty.${f.scope}`,
          )}
          action={
            atLeastOwn(me.levels.tasks) && f.scope !== 'past' && !isFiltered(f) && !f.starred && !f.escalated ? (
              <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)} data-empty-add-task>
                {t('pages.tasks.add.open')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {layout === 'board' ? (
            <TaskBoard rows={rows} lookups={lookups} today={today} />
          ) : layout === 'calendar' ? (
            <TaskCalendar rows={rows} lookups={lookups} today={today} filters={f} />
          ) : (
            // the card is its own container (@container): a row lays its columns out only where the CARD has the room
            <div className="@container flex min-w-0 flex-col gap-3 [&>ul]:overflow-hidden [&>ul]:shadow-1">
              {canBulk && rows.length ? (
                <div className="flex items-center gap-2 px-1 text-sm text-muted" data-task-select-all>
                  <Checkbox
                    checked={shown.length === 0 ? false : shown.length === rows.length ? true : 'indeterminate'}
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
                <li
                  aria-hidden="true"
                  className="hidden items-center gap-3 px-4 text-xs font-semibold leading-4 text-muted @4xl:flex"
                  data-task-columns
                >
                  {canBulk ? <span className="size-5 shrink-0" /> : null}
                  <span className="size-6 shrink-0" />
                  <div className={cn(ROW_GRID, 'h-[var(--row-h-head)]')}>
                    <span>{t('pages.tasks.look.colTask')}</span>
                    <span>{t('pages.tasks.look.colWhere')}</span>
                    <span>{fDue}</span>
                    <span>{t('pages.tasks.look.colResponsible')}</span>
                    <span className="text-end">{fStatus}</span>
                  </div>
                </li>
                {groups
                  .filter((g) => g.rows.length)
                  .flatMap((g) => [
                    <li
                      key={`group:${g.kind}:${g.key}`}
                      className="flex min-h-10 items-center gap-2 bg-surface px-4 py-2"
                      data-task-group={g.key}
                      data-count={g.rows.length}
                    >
                      <h2 className="min-w-0 break-words text-sm font-semibold leading-[18px] text-strong">
                        {groupTitle(g)}
                      </h2>
                      <CountBadge count={g.rows.length} />
                    </li>,
                    ...g.rows.map((r) => (
                      <TaskLine
                        key={r.id}
                        row={r}
                        lookups={lookups}
                        today={today}
                        selectable={canBulk}
                        selected={shown.includes(r.id)}
                        onSelect={(on) => toggleRow(r.id, on)}
                      />
                    )),
                  ])}
              </ul>
            </div>
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
          ids={shown}
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
        ids={shown}
        org={lookups.org}
        priorities={lookups.priorities}
        onDone={() => setSelected([])}
      />
      <QuickAdd
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) spendNewTaskAddress(closedOnAddress);
        }}
        org={lookups.org}
        partners={lookups.partners}
        projects={lookups.projects}
        priorities={lookups.priorities}
        initial={{ partnerId: f.partner, projectId: f.project }}
        onAdded={(r) => {
          if (closedOnAddress.current && navStartedTo(`/tasks/${r.number}`)) router.replace(`/tasks/${r.number}`);
        }}
      />
    </div>
  );
}

/**
 * Create's address (/tasks/new, or ?new=1) is spent once the form closes or saves, so a reload does not open it again;
 * /tasks/new draws the list with the form open itself, with no redirect (V286). `closedOnAddress` remembers whether the
 * form that just closed was the address's own: only then does a save move on to the new task's page. One function for
 * the two forms that can be open — the list's own Add task, and the one /tasks/new opens before the list has been read
 * (NewTaskEntry, Landing 34).
 */
export function spendNewTaskAddress(closedOnAddress: { current: boolean }) {
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

const LAYOUT_ICON: Record<Layout, typeof List> = { list: List, board: Columns3, calendar: CalendarDays };

/**
 * List / Board / Calendar: one view of the same rows (§8 Tasks), a link each, so the choice lives in the address with
 * the tab and every filter — switching keeps them all, and the page stays where it was scrolled (`scroll={false}`).
 * The 15 Nov boards draw List and Board; Calendar stays, as the app has it. A pill switch: the open one is the white
 * pill; on a phone each is a 44 px icon that still carries its name.
 */
function LayoutSwitch({ filters }: { filters: TaskFilters }) {
  const t = useTranslations();
  const current = filters.layout ?? 'list';
  return (
    <nav
      aria-label={t('pages.tasks.layout.label')}
      className="ms-auto flex gap-1 rounded-pill bg-surface p-1"
      data-layouts
    >
      {LAYOUTS.map((l) => {
        const Icon = LAYOUT_ICON[l];
        const on = l === current;
        return (
          <Link
            key={l}
            href={filtersHref(filters, { layout: l })}
            scroll={false}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-focus max-sm:h-11 max-sm:min-w-11 max-sm:justify-center',
              on ? 'bg-raised font-semibold text-strong shadow-tab' : 'text-muted hover:text-strong',
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

/**
 * A list row's columns where the card has the room (56 rem): Task · Partner or project · Due · Responsible · Status —
 * the header and every row share this one template, so they line up. Narrower, the same cells stack: the title with
 * the pill at its end, then the partner and the due day on one line, then the Responsible person.
 */
const ROW_GRID =
  'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 @4xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_8.5rem_minmax(0,1.3fr)_9.5rem] @4xl:items-center @4xl:gap-x-4';

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
  const view = pillOf(row);
  const due = dueState(row, today);
  const priority = row.priority ? ((names.locale === 'ar' ? row.priority_ar : row.priority_en) ?? row.priority) : null;
  return (
    <li
      className="relative flex items-start gap-3 px-4 min-h-[var(--list-row-min)] py-[var(--list-row-py)] @4xl:items-center"
      data-task-row={row.number}
      data-due={due}
    >
      {selectable ? (
        // above the title link's whole-row layer (its ::after), as the done tick is: under it, a tap on the box
        // opened the task instead of selecting it, so no row could be selected for Bulk assign (owner 13 Nov)
        <Checkbox
          checked={selected ?? false}
          onCheckedChange={(on) => onSelect?.(on)}
          label={t('table.selectRow', { name: row.title })}
          className="z-10 mt-1 shrink-0 @4xl:mt-0"
        />
      ) : null}
      {(row.can_act ?? row.can_edit) ? (
        <DoneTick task={row} statuses={lookups.statuses} title={row.title} />
      ) : (
        <span aria-hidden="true" className="mt-0.5 inline-block size-6 shrink-0" />
      )}
      <div className={ROW_GRID}>
        <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-0.5 @4xl:col-start-auto @4xl:row-start-auto">
          <Link
            href={`/tasks/${row.number}`}
            title={row.number}
            className={cn(
              "break-words text-base font-medium text-strong after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-focus",
              row.meaning === 'done' && 'text-muted line-through',
            )}
          >
            {row.title}
          </Link>
          {/* FIX-05 (F-B1-06): the priority stays on the row — as words under the title, never a second pill */}
          {priority ? (
            <p className="break-words text-xs leading-4 text-muted" data-task-priority={row.priority}>
              {t('pages.tasks.look.priority', { priority })}
            </p>
          ) : null}
          {/* Landing 33 (B4): the steps done, as words under the title — progress without opening the task */}
          <StepsMark row={row} locale={names.locale} />
        </div>
        {/* one line on a phone (the partner, then the due day); two columns where the card is wide */}
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 @4xl:contents" data-task-line>
          <span className="flex min-w-0 max-w-full">
            <WhereMark row={row} names={names} label={t('pages.tasks.look.colWhere')} />
          </span>
          <span className="flex min-w-0">
            <DueMark row={row} today={today} locale={names.locale} />
          </span>
        </div>
        <span className="col-span-2 flex min-w-0 @4xl:col-span-1">
          <ResponsibleMark row={row} lookups={lookups} names={names} label={t('pages.tasks.look.colResponsible')} />
        </span>
        {/* the ONE pill (`pillOf`): Blocked, else the task's status. Overdue is the date above, never a pill. */}
        <span
          className="col-start-2 row-start-1 flex min-w-0 justify-end @4xl:col-start-auto @4xl:row-start-auto"
          data-task-pill={view}
        >
          <StatusChip tone={STATUS_TONE[view]} className="max-w-full">
            <span className="truncate">{view === 'blocked' ? t('pages.tasks.blocked') : names.status(row)}</span>
          </StatusChip>
        </span>
      </div>
    </li>
  );
}
