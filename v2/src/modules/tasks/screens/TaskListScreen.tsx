'use client';
import { CalendarDays, Columns3, List, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { FilterChip, StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Input } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { cn } from '@/ui/cn';
import {
  DUE_CHIPS,
  LAYOUTS,
  SCOPES,
  STATUS_CHIPS,
  STATUS_TONE,
  dueState,
  filtersHref,
  keepRow,
  riyadhDay,
  statusView,
  type Layout,
  type TaskFilters,
} from '../rules';
import type { TaskList, TaskRow, TeamLoad } from '../types';
import type { TaskLookups } from '../load';
import { PastWorkPanel } from './PastWorkPanel';
import { QuickAdd } from './QuickAdd';
import { TaskBoard } from './TaskBoard';
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
  const [q, setQ] = useState(f.q ?? '');
  const today = riyadhDay(new Date());
  const rows = (list?.rows ?? []).filter((r) => keepRow(r, f, me.person.id, today));
  const layout = f.layout ?? 'list';
  const go = (change: Partial<TaskFilters>) => router.push(filtersHref(f, change));
  const retry = () => router.refresh();

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

  return (
    <div className="flex min-w-0 flex-col gap-5" data-tasks-list>
      <PageHeader
        title={t('nav.tasks')}
        actions={
          atLeastOwn(me.levels.tasks) ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)} data-add-task>
              {t('pages.tasks.add.open')}
            </Button>
          ) : null
        }
      />
      <Tabs
        label={t('pages.tasks.views.label')}
        value={f.scope}
        tabs={SCOPES.map((s) => ({ value: s, label: t(`pages.tasks.views.${s}`), href: filtersHref(f, { scope: s }) }))}
      />
      <div className="flex flex-wrap items-center gap-2" data-task-chips>
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
        <LayoutSwitch filters={f} />
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
      ) : rows.length === 0 ? (
        <DataState
          kind="empty"
          message={t(isFiltered(f) ? 'pages.tasks.emptyFiltered' : `pages.tasks.empty.${f.scope}`)}
        />
      ) : (
        <>
          {layout === 'board' ? (
            <TaskBoard rows={rows} lookups={lookups} today={today} />
          ) : layout === 'calendar' ? (
            <TaskCalendar rows={rows} lookups={lookups} today={today} filters={f} />
          ) : (
            <ul
              className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised"
              data-task-rows
            >
              {rows.map((r) => (
                <TaskLine key={r.id} row={r} lookups={lookups} today={today} />
              ))}
            </ul>
          )}
          {list.more ? (
            <p className="text-sm text-muted">
              {t('pages.tasks.more', { shown: list.rows.length, total: list.total })}
            </p>
          ) : null}
        </>
      )}
      <QuickAdd
        open={adding}
        onOpenChange={setAdding}
        org={lookups.org}
        partners={lookups.partners}
        projects={lookups.projects}
        initial={{ partnerId: f.partner, projectId: f.project }}
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
              'inline-flex h-[var(--control-h-sm)] items-center gap-1.5 px-3 text-sm first:rounded-s-md last:rounded-e-md focus-visible:outline-2 focus-visible:outline-focus',
              on ? 'bg-accent-soft font-medium text-text' : 'text-muted hover:bg-surface',
            )}
            data-layout={l}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(`pages.tasks.layout.${l}`)}
          </Link>
        );
      })}
    </nav>
  );
}

const atLeastOwn = (l: string | undefined) => l === 'own' || l === 'full';
const isFiltered = (f: TaskFilters) => !!(f.status || f.due || f.partner || f.project || f.q);

function TaskLine({ row, lookups, today }: { row: TaskRow; lookups: TaskLookups; today: string }) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const view = statusView(row);
  const due = dueState(row, today);
  const where = row.project_id ? names.project(row.project_id) : row.partner_id ? names.partner(row.partner_id) : '';
  return (
    <li className="flex items-start gap-3 px-4 py-3" data-task-row={row.number} data-due={due}>
      {row.can_edit ? (
        <DoneTick task={row} statuses={lookups.statuses} title={row.title} />
      ) : (
        <span aria-hidden="true" className="mt-0.5 inline-block size-6 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/tasks/${row.number}`}
          className={cn(
            'break-words text-base font-medium text-text hover:underline focus-visible:outline-2 focus-visible:outline-focus',
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
