'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { AvatarPerson } from '@/ui/Avatar';
import { Avatar } from '@/ui/Avatar';
import { AvatarStack } from '@/ui/AvatarStack';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FilterChip, StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { DataTable, type ColumnDef } from '@/ui/DataTable';
import { DetailPanel } from '@/ui/DetailPanel';
import { Dialog } from '@/ui/Dialog';
import { EntityLink } from '@/ui/EntityLink';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { KpiTile } from '@/ui/KpiTile';
import { Money } from '@/ui/Money';
import { PageHeader } from '@/ui/PageHeader';
import { PersonChip } from '@/ui/PersonChip';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { toast } from '@/ui/Toast';
import { PageFrame } from '@/ui/shell/AppShell';
import { formatMoney } from '@/core/i18n/format';

/* Made-up people and rows only (rule 7). */
const people: AvatarPerson[] = [
  {
    displayName: 'Test',
    fullName: 'Test Person',
    avatarColor: 'c3',
    badge: { kind: 'icon', value: 'compass' },
  },
  {
    displayName: 'Sample',
    fullName: 'Sample Helper',
    avatarColor: 'c4',
    badge: { kind: 'zodiac', value: 'leo' },
  },
  {
    displayName: 'Demo',
    fullName: 'Demo Colleague',
    avatarColor: 'c5',
    badge: { kind: 'none', value: null },
  },
  {
    displayName: 'Fourth',
    fullName: 'Fourth Person',
    avatarColor: 'c2',
    badge: { kind: 'none', value: null },
  },
  { displayName: 'Fifth', fullName: 'Fifth Person', avatarColor: 'c6', badge: { kind: 'none', value: null } },
];

type Row = {
  id: string;
  partner: string;
  number: string;
  status: 'done' | 'inProgress' | 'waiting' | 'overdue' | 'draft';
  amount: number;
  owner: AvatarPerson;
};
const STATUS: Record<Row['status'], { tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  done: { tone: 'success', label: 'Done' },
  inProgress: { tone: 'info', label: 'In progress' },
  waiting: { tone: 'warning', label: 'Waiting on client' },
  overdue: { tone: 'danger', label: 'Overdue' },
  draft: { tone: 'neutral', label: 'Draft' },
};

function makeRows(n: number): Row[] {
  const statuses = Object.keys(STATUS) as Row['status'][];
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i + 1}`,
    partner: `Test Co ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`,
    number: `INV-T-${String(i + 1).padStart(4, '0')}`,
    status: statuses[i % statuses.length]!,
    amount: ((i * 7919) % 250000) + 500,
    owner: people[i % people.length]!,
  }));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={title} data-kit-section={title}>
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  );
}

export function KitGallery() {
  const rows = useMemo(() => makeRows(2500), []);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tab, setTab] = useState('overview');
  const [filters, setFilters] = useState<{ field: string; value: string; count: number }[]>([
    { field: 'Status', value: 'Open', count: 14 },
  ]);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [sel, setSel] = useState('b');
  const [removed, setRemoved] = useState(false);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: 'partner',
        header: 'Partner',
        cell: ({ row }) => (
          <EntityLink kind="partner" href={`/partners/${row.original.id}`}>
            {row.original.partner}
          </EntityLink>
        ),
      },
      {
        accessorKey: 'number',
        header: 'Invoice',
        cell: ({ row }) => (
          <EntityLink
            kind="invoice"
            variant="chip"
            href={`/finance/invoices/${row.original.id}`}
            id={row.original.number}
          >
            Invoice
          </EntityLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusChip tone={STATUS[row.original.status].tone}>{STATUS[row.original.status].label}</StatusChip>
        ),
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        enableSorting: false,
        cell: ({ row }) => <PersonChip person={row.original.owner} href="/settings/profile" />,
      },
      {
        accessorKey: 'amount',
        header: 'Revenue',
        meta: { numeric: true },
        cell: ({ row }) => <Money value={formatMoney(row.original.amount)} />,
      },
    ],
    [],
  );

  return (
    <>
      <PageFrame>
        <PageHeader
          crumbs={[{ label: 'Kit', href: '/kit' }, { label: 'Gallery' }]}
          title="Component kit"
          meta={<span className="font-data">2,500 rows · 4 themes · 2 densities</span>}
          actions={
            <>
              <Button variant="ghost">Export</Button>
              <Button variant="secondary">Filter</Button>
              <Button variant="primary" icon={<Plus />}>
                New task
              </Button>
            </>
          }
        />

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<Trash2 />}>
              Remove
            </Button>
            <Button variant="link">Link button</Button>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <Button variant="secondary" size="sm">
              Small
            </Button>
            <Button variant="secondary" size="xs">
              Extra small
            </Button>
            <IconButton label="Add" icon={<Plus />} />
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Partner name">{(p) => <Input {...p} defaultValue="Test Co A" />}</Field>
            <Field label="Client ID">{(p) => <Input {...p} mono defaultValue="DK-P-0001" />}</Field>
            <Field label="Amount" error="Enter a whole number of riyals">
              {(p) => <Input {...p} mono defaultValue="12,5x0" />}
            </Field>
            <Field label="Category">
              {(p) => (
                <Select
                  {...p}
                  value={sel}
                  onValueChange={setSel}
                  options={[
                    { value: 'a', label: 'Client' },
                    { value: 'b', label: 'Supplier' },
                    { value: 'c', label: 'Strategic partner' },
                  ]}
                />
              )}
            </Field>
            <Field label="Notes">{(p) => <Textarea {...p} defaultValue="Made-up note text." />}</Field>
            <div className="flex flex-col gap-3 pt-6">
              <label className="flex items-center gap-2.5">
                <Checkbox checked={checked} onCheckedChange={setChecked} label="Follow this record" />
                Follow this record
              </label>
              <label className="flex items-center gap-2.5">
                <Switch checked={on} onCheckedChange={setOn} label="Email notifications" />
                Email notifications
              </label>
            </div>
          </div>
        </Section>

        <Section title="Chips">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="success">Done</StatusChip>
            <StatusChip tone="info">In progress</StatusChip>
            <StatusChip tone="warning">Waiting on client</StatusChip>
            <StatusChip tone="danger">Overdue</StatusChip>
            <StatusChip tone="neutral">Draft</StatusChip>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-filters>
            {filters.map((f) => (
              <FilterChip
                key={f.field}
                field={f.field}
                value={f.value}
                count={f.count}
                removeLabel={`Remove filter ${f.field}: ${f.value}`}
                onRemove={() => setFilters((fs) => fs.filter((x) => x.field !== f.field))}
              />
            ))}
            <FilterChip
              field="Owner"
              addLabel="Add filter: Owner"
              onClick={() => setFilters((fs) => [...fs, { field: 'Owner', value: 'Me', count: 6 }])}
            />
            <FilterChip
              field="Due"
              addLabel="Add filter: Due"
              onClick={() => setFilters((fs) => [...fs, { field: 'Due', value: 'This week', count: 3 }])}
            />
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs
            label="Record sections"
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'finance', label: 'Finance', count: 12 },
              { value: 'tasks', label: 'Tasks', count: 3 },
              { value: 'achievements', label: 'Achievements', count: 0 },
              { value: 'files', label: 'Files', count: 8 },
            ]}
          />
        </Section>

        <Section title="Entity links">
          <p className="max-w-[720px] text-base">
            <EntityLink kind="partner" href="/partners/t1">
              Test Co A
            </EntityLink>{' '}
            owes <Money value={formatMoney(86250)} /> on{' '}
            <EntityLink kind="invoice" href="/finance/invoices/t1">
              INV-T-0204
            </EntityLink>
            , chased by{' '}
            <EntityLink kind="person" href="/settings/profile">
              Test Person
            </EntityLink>{' '}
            in{' '}
            <EntityLink kind="task" href="/tasks/t1">
              T-2026-0001
            </EntityLink>
            .
          </p>
          <div>
            <EntityLink kind="task" variant="title" href="/tasks/t1">
              Renew corporate agreement for 2027
            </EntityLink>
          </div>
          <div className="flex flex-wrap gap-2">
            <EntityLink kind="partner" variant="chip" href="/partners/t1" id="DK-P-0001">
              Test Co A
            </EntityLink>
            <EntityLink kind="invoice" variant="chip" href="/finance/invoices/t1" id="INV-T-0204">
              Invoice
            </EntityLink>
            <EntityLink kind="project" variant="chip" href="/projects/t1" id="PRJ-T-001">
              Sample project
            </EntityLink>
            <EntityLink kind="kpi" variant="chip" href="/kpis/2026/K1" id="K1">
              New clients
            </EntityLink>
            <EntityLink kind="achievement" variant="chip" href="/kpis/achievements/t1" id="ACH-T-01">
              New deal
            </EntityLink>
            <EntityLink kind="report" variant="chip" href="/reports/monthly/2026-09" id="RPT-2026-09">
              September
            </EntityLink>
            <EntityLink kind="file" variant="chip" href="/r/file/t1">
              Agreement.pdf
            </EntityLink>
          </div>
        </Section>

        <Section title="People">
          <div className="flex flex-wrap items-center gap-6">
            {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((s) => (
              <Avatar key={s} person={people[0]!} size={s} />
            ))}
            <Avatar person={people[1]!} size="lg" />
            <Avatar person={people[2]!} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <PersonChip person={people[0]!} href="/settings/profile" />
            <PersonChip person={people[1]!} href="/settings/profile" size="md" />
            <AvatarStack owner={people[0]!} helpers={people.slice(1)} hrefOf={() => '/settings/profile'} />
            <AvatarStack owner={people[1]!} helpers={[people[2]!]} hrefOf={() => '/settings/profile'} size="xs" />
          </div>
        </Section>

        <Section title="KPI tiles">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Q3 revenue"
              value="4.82M"
              unit="SAR"
              chip={{ tone: 'success', text: '+12%' }}
              delta={{ text: '0.52M', tone: 'up' }}
              footnote="vs Q2"
              href="/finance"
            />
            <KpiTile
              label="Target attainment"
              value="80.3"
              unit="%"
              target={80.3}
              footnote="of SAR 6.0M · 34 days left"
            />
            <KpiTile label="Overdue tasks" value="3" delta={{ text: '2', tone: 'down' }} footnote="since Monday" />
            <KpiTile label="Cost" value={null} footnote="not measured" />
          </div>
        </Section>

        <Section title="Data states">
          <div className="grid max-w-[880px] grid-cols-1 gap-3 md:grid-cols-2">
            <DataState kind="loading" message="Loading" />
            <DataState
              kind="failed"
              message="Invoices could not be loaded"
              retryLabel="Try again"
              onRetry={() => toast.done('Tried again')}
            />
            <DataState
              kind="empty"
              message="Nothing here yet"
              action={
                <Button variant="secondary" size="sm">
                  Add the first partner
                </Button>
              }
            />
            <DataState kind="no-access" message="You do not have access to Appraisal" />
            <div>
              <DataState kind="not-measured" message="not measured" />
            </div>
          </div>
        </Section>

        <Section title="Dialogs and toasts">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDialog(true)} data-open-dialog>
              Open dialog
            </Button>
            <Button variant="danger" onClick={() => setConfirm(true)} data-open-confirm>
              Remove INV-T-0204
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.done('Task created', {
                  description: 'Assigned to you.',
                  undo: {
                    label: 'Undo',
                    onUndo: () => {
                      toast.done('Undone');
                    },
                  },
                })
              }
              data-toast-done
            >
              Toast with Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.failed('Save refused', 'Needs the Full level on Finance')}
              data-toast-failed
            >
              Failed toast
            </Button>
            {removed ? <StatusChip tone="neutral">Removed</StatusChip> : null}
          </div>
        </Section>

        <Section title="Table">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            selectable
            selectedId={selected?.id ?? null}
            onRowClick={(r) => setSelected(r)}
            labels={{ selectRow: 'Select row', selectAll: 'Select all' }}
            maxHeight="440px"
          />
        </Section>
      </PageFrame>

      <DetailPanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.partner ?? ''}
        closeLabel="Close panel"
      >
        {selected ? (
          <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 text-base [&_dd]:m-0 [&_dd]:border-b [&_dd]:border-border [&_dd]:py-2.5 [&_dt]:border-b [&_dt]:border-border [&_dt]:py-2.5 [&_dt]:text-muted">
            <dt>Invoice</dt>
            <dd>
              <EntityLink kind="invoice" variant="chip" href="/finance/invoices/t1" id={selected.number}>
                Invoice
              </EntityLink>
            </dd>
            <dt>Status</dt>
            <dd>
              <StatusChip tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</StatusChip>
            </dd>
            <dt>Revenue</dt>
            <dd>
              <Money value={formatMoney(selected.amount)} />
            </dd>
            <dt>Owner</dt>
            <dd>
              <PersonChip person={selected.owner} href="/settings/profile" />
            </dd>
          </dl>
        ) : null}
      </DetailPanel>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Add helper"
        footer={<HelperFormFooter onCancel={() => setDialog(false)} />}
      >
        <HelperForm onDone={() => setDialog(false)} />
      </Dialog>

      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove INV-T-0204?"
        body="INV-T-0204 will be removed. You can undo this from the toast."
        cancelLabel="Cancel"
        confirmLabel="Remove"
        onConfirm={() => {
          setRemoved(true);
          toast.done('INV-T-0204 removed', { undo: { label: 'Undo', onUndo: () => setRemoved(false) } });
        }}
      />
    </>
  );
}

/* Each dialog owns its form: this form instance exists only while the dialog is open. */
function HelperForm({ onDone }: { onDone: () => void }) {
  const form = useForm<{ colleague: string; role: string }>({ defaultValues: { colleague: '', role: '' } });
  return (
    <form
      id="helper-form"
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(() => {
        toast.done('Helper added');
        onDone();
      })}
    >
      <Field label="Colleague" error={form.formState.errors.colleague?.message}>
        {(p) => <Input {...p} {...form.register('colleague', { required: 'Choose a colleague' })} autoFocus />}
      </Field>
      <Field label="Role on task">{(p) => <Input {...p} {...form.register('role')} />}</Field>
    </form>
  );
}

function HelperFormFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form="helper-form">
        Add helper
      </Button>
    </>
  );
}
