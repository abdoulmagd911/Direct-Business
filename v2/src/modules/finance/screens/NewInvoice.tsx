'use client';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { refetchAll } from '@/core/commands/refetch';
import { undoRequest } from '@/core/commands/undo';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { StatusChip } from '@/ui/Chip';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { cn } from '@/ui/cn';
import {
  blankExpense,
  blankInvoice,
  blankLine,
  expenseFields,
  hasRevenue,
  invoiceFields,
  KINDS,
  lineFields,
  lineTotal,
  problemsOf,
  serviceOfProduct,
  type ExpenseDraft,
  type InvoiceDraft,
  type LineDraft,
  type ListEntry,
  type Lists,
} from '../invoice-form';

const NONE = '__none';
const fmt = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'ar' ? 'en-US' : locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/**
 * New invoice (P4-4, GC-5): an invoice, its lines and its expenses typed in one place, a side panel that works out
 * Revenue, Cost and Profit as they will count (with the Provisional part beside Profit), and Save or Save + new.
 * Each row is its own logged request (V622); the Undo in the toast takes them all back, last first. The database
 * checks every value again — this form only says what is missing before it asks.
 */
export function NewInvoice({ today, lists }: { today: string; lists: Lists | null }) {
  const t0 = useTranslations();
  const router0 = useRouter();
  if (!lists)
    return (
      <>
        <PageHeader title={t0('finance.new.title')} />
        <DataState
          kind="failed"
          message={t0('state.failed', { what: t0('finance.new.lists') })}
          onRetry={() => router0.refresh()}
          retryLabel={t0('common.tryAgain')}
        />
      </>
    );
  return <NewInvoiceForm today={today} lists={lists} />;
}

function NewInvoiceForm({ today, lists }: { today: string; lists: Lists }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [d, setD] = useState<InvoiceDraft>(() => blankInvoice(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // the invoice just saved, whose figures the panel then reads from the database (never worked out here)
  const [saved, setSaved] = useState<{ ref: string; created: string } | null>(null);
  const name = (e: ListEntry) => (locale === 'ar' && e.name_ar ? e.name_ar : e.name_en);
  const opts = (list: ListEntry[]) => list.map((e) => ({ value: e.key, label: name(e) }));
  const set = <K extends keyof InvoiceDraft>(k: K, v: InvoiceDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([field]) => field !== k)));
  };
  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const setExpense = (key: string, patch: Partial<ExpenseDraft>) =>
    setD((x) => ({ ...x, expenses: x.expenses.map((e) => (e.key === key ? { ...e, ...patch } : e)) }));
  const problem = (field: string) => (errors[field] ? t(`finance.new.problem.${errors[field]}`) : undefined);

  const save = async (again: boolean) => {
    if (busy) return;
    const found = problemsOf(d, lists);
    if (found.length) {
      setErrors(Object.fromEntries(found.map((p) => [p.field, p.key])));
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(true);
    const made: string[] = [];
    try {
      // the same number twice is refused in the field, before anything is written
      const hits = (await rpc('finance_search', { p_text: d.ref.trim(), p_limit: 10 })) as { ref: string }[] | null;
      if ((hits ?? []).some((h) => h.ref.trim().toLowerCase() === d.ref.trim().toLowerCase())) {
        setErrors({ ref: 'used' });
        setBusy(false);
        return;
      }
      const add = async (table: string, fields: Record<string, unknown>) => {
        const r = (await rpc('finance_row_add', { p_table: table, p_fields: fields as never })) as {
          id?: string;
          request_id?: string;
        } | null;
        if (r?.request_id) made.push(r.request_id);
        return r?.id ?? '';
      };
      const id = await add('invoice', invoiceFields(d, lists));
      for (const l of d.lines) await add('invoice_line', lineFields(l, id, lists));
      for (const e of d.expenses) await add('expense_line', expenseFields(e, id, lists));
    } catch (e) {
      // all or nothing: what was already written is taken back, then the refusal is said in words
      for (const rid of [...made].reverse()) await undoRequest(rid).catch(() => null);
      const { key, detail } = errorKey(e, (k) => t.has(k));
      toast.failed(t(key, { detail }));
      setBusy(false);
      return;
    }
    toast.done(t('finance.new.saved', { ref: d.ref.trim() }), {
      undo: {
        label: t('common.undo'),
        onUndo: async () => {
          try {
            for (const rid of [...made].reverse()) await undoRequest(rid);
            toast.done(t('activity.undone'));
            // the panel must not keep printing the figures of an invoice that is no longer there (QA-551)
            setSaved((now) => (now?.ref === d.ref.trim() ? null : now));
            refetchAll();
          } catch (e) {
            const { key, detail } = errorKey(e, (k) => t.has(k));
            toast.failed(t(key, { detail }));
          }
        },
      },
    });
    refetchAll();
    setBusy(false);
    if (again) {
      setSaved({ ref: d.ref.trim(), created: d.created });
      setD(blankInvoice(today));
      setErrors({});
      document.querySelector<HTMLElement>('[data-new-ref]')?.focus();
    } else router.push('/finance');
  };

  const showMoney = hasRevenue(d.kind) || d.kind === 'billing';
  return (
    <form
      className="flex min-w-0 flex-col gap-6"
      data-new-invoice
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save(false);
        }
      }}
    >
      <PageHeader
        crumbs={[{ label: t('nav.finance'), href: '/finance' }, { label: t('finance.new.title') }]}
        title={t('finance.new.title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => router.push('/finance')}>
              {t('common.cancel')}
            </Button>
            <Button variant="secondary" type="button" disabled={busy} onClick={() => void save(true)} data-save-new>
              {t('finance.new.saveNew')}
            </Button>
            <Button variant="primary" type="submit" disabled={busy} data-save>
              {t('common.save')}
            </Button>
          </div>
        }
      />
      <div className={cn('grid min-w-0 gap-6', saved && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="radiogroup"
                aria-label={t('finance.new.kind')}
                className="flex flex-wrap gap-1 rounded-lg border border-border p-1"
              >
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={d.kind === k}
                    data-kind={k}
                    onClick={() => set('kind', k)}
                    className={cn(
                      'min-h-11 rounded-md px-3 text-sm font-medium',
                      d.kind === k ? 'bg-text text-raised' : 'text-muted hover:text-text',
                    )}
                  >
                    {t(`finance.kind.${k}`)}
                  </button>
                ))}
              </div>
              <StatusChip tone="neutral">{t('finance.source.typed')}</StatusChip>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label={t('finance.number.transaction')}
                error={problem('ref') ?? undefined}
                required={t('common.required')}
              >
                {(p) => (
                  <Input
                    {...p}
                    mono
                    data-new-ref
                    autoFocus
                    value={d.ref}
                    maxLength={80}
                    onChange={(e) => set('ref', e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('finance.number.status')} error={problem('status')} required={t('common.required')}>
                {(p) => (
                  <Select
                    id={p.id}
                    aria-invalid={p['aria-invalid']}
                    value={d.status || undefined}
                    onValueChange={(v) => set('status', v)}
                    options={opts(lists.status)}
                  />
                )}
              </Field>
              <Field label={t('finance.number.created')} error={problem('created')} required={t('common.required')}>
                {(p) => <Input {...p} type="date" value={d.created} onChange={(e) => set('created', e.target.value)} />}
              </Field>
              <Field label={t('finance.number.paid')} error={problem('paid')}>
                {(p) => <Input {...p} type="date" value={d.paid} onChange={(e) => set('paid', e.target.value)} />}
              </Field>
              {showMoney ? (
                <Field label={t('finance.number.total')} error={problem('total')}>
                  {(p) => (
                    <Input
                      {...p}
                      mono
                      inputMode="decimal"
                      value={d.total}
                      onChange={(e) => set('total', e.target.value)}
                    />
                  )}
                </Field>
              ) : null}
            </div>
          </Card>

          <Card title={t('finance.new.customer')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('finance.new.clientId')}>
                {(p) => <Input {...p} mono value={d.clientId} onChange={(e) => set('clientId', e.target.value)} />}
              </Field>
              <Field label={t('finance.new.name')}>
                {(p) => <Input {...p} value={d.customerName} onChange={(e) => set('customerName', e.target.value)} />}
              </Field>
              <Field label={t('finance.new.email')}>
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    value={d.customerEmail}
                    onChange={(e) => set('customerEmail', e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>

          {d.kind !== 'wallet_topup' ? (
            <Card
              title={t('finance.new.lines')}
              count={d.lines.length}
              action={
                <Button
                  variant="ghost"
                  type="button"
                  data-add-line
                  onClick={() => setD((x) => ({ ...x, lines: [...x.lines, blankLine()] }))}
                >
                  <Plus aria-hidden="true" />
                  {t('finance.new.addLine')}
                </Button>
              }
            >
              <div className="flex flex-col gap-3">
                {d.lines.map((l, i) => (
                  <div
                    key={l.key}
                    data-line-row
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.6fr_5rem_7rem_7rem_2.75rem] lg:items-end lg:border-0 lg:p-0"
                  >
                    <Field label={t('finance.new.product')}>
                      {(p) => (
                        <Select
                          id={p.id}
                          value={l.product || NONE}
                          onValueChange={(v) => {
                            const product = v === NONE ? '' : v;
                            setLine(l.key, { product, service: serviceOfProduct(product, lists) });
                          }}
                          options={[{ value: NONE, label: '—' }, ...opts(lists.product)]}
                        />
                      )}
                    </Field>
                    <Field label={t('finance.new.service')}>
                      {(p) => (
                        <Select
                          id={p.id}
                          value={l.service || NONE}
                          onValueChange={(v) => setLine(l.key, { service: v === NONE ? '' : v })}
                          options={[{ value: NONE, label: '—' }, ...opts(lists.service)]}
                        />
                      )}
                    </Field>
                    <Field label={t('finance.new.item')} error={problem(`line.${i}.name`)}>
                      {(p) => (
                        <Input {...p} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} />
                      )}
                    </Field>
                    <Field label={t('finance.new.qty')}>
                      {(p) => (
                        <Input
                          {...p}
                          mono
                          inputMode="decimal"
                          value={l.qty}
                          onChange={(e) => setLine(l.key, { qty: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={t('finance.new.price')} error={problem(`line.${i}.price`)}>
                      {(p) => (
                        <Input
                          {...p}
                          mono
                          inputMode="decimal"
                          value={l.price}
                          onChange={(e) => setLine(l.key, { price: e.target.value })}
                        />
                      )}
                    </Field>
                    <div
                      className="flex min-h-[var(--control-h)] flex-col justify-end pb-2 text-end font-data tabular text-base"
                      data-line-total
                    >
                      {lineTotal(l) === null ? '—' : fmt(lineTotal(l) ?? 0, locale)}
                    </div>
                    <IconButton
                      label={t('finance.new.removeLine')}
                      icon={<X aria-hidden="true" />}
                      onClick={() => setD((x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card
            title={t('finance.new.expenses')}
            count={d.expenses.length}
            action={
              <Button
                variant="ghost"
                type="button"
                data-add-expense
                onClick={() => setD((x) => ({ ...x, expenses: [...x.expenses, blankExpense()] }))}
              >
                <Plus aria-hidden="true" />
                {t('finance.new.addExpense')}
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              {d.expenses.map((e, i) => (
                <div
                  key={e.key}
                  data-expense-row
                  className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_7rem_1fr_1.2fr_1fr_2.75rem] lg:items-end lg:border-0 lg:p-0"
                >
                  <Field label={t('finance.new.type')} error={problem(`expense.${i}.type`)}>
                    {(p) => (
                      <Input {...p} value={e.type} onChange={(x) => setExpense(e.key, { type: x.target.value })} />
                    )}
                  </Field>
                  <Field label={t('finance.new.amount')} error={problem(`expense.${i}.amount`)}>
                    {(p) => (
                      <Input
                        {...p}
                        mono
                        inputMode="decimal"
                        value={e.amount}
                        onChange={(x) => setExpense(e.key, { amount: x.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('finance.number.status')} error={problem(`expense.${i}.status`)}>
                    {(p) => (
                      <Select
                        id={p.id}
                        aria-invalid={p['aria-invalid']}
                        value={e.status || undefined}
                        onValueChange={(v) => setExpense(e.key, { status: v })}
                        options={opts(lists.expenseStatus)}
                      />
                    )}
                  </Field>
                  <Field label={t('finance.new.merchant')}>
                    {(p) => (
                      <Input
                        {...p}
                        value={e.merchant}
                        onChange={(x) => setExpense(e.key, { merchant: x.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('finance.new.reference')}>
                    {(p) => (
                      <Input
                        {...p}
                        mono
                        value={e.reference}
                        onChange={(x) => setExpense(e.key, { reference: x.target.value })}
                      />
                    )}
                  </Field>
                  <IconButton
                    label={t('finance.new.removeExpense')}
                    icon={<X aria-hidden="true" />}
                    onClick={() => setD((x) => ({ ...x, expenses: x.expenses.filter((y) => y.key !== e.key) }))}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {saved ? <LastSaved key={`${saved.ref}|${saved.created}`} saved={saved} /> : null}
      </div>
    </form>
  );
}

function Card({
  title,
  count,
  action,
  children,
}: {
  title?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-raised p-4">
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {title}
            {count ? <span className="ms-2 text-sm font-normal text-muted">{count}</span> : null}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type Unit = {
  unit_kind: string;
  ref: string;
  counted: boolean;
  excluded_reason: string | null;
  revenue: number;
  cost: number;
  profit: number;
  cost_is: string;
};
type Read = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; units: Unit[] };

/**
 * Last saved: the figures of the invoice just saved, as the database counts them (V610, V611, V617) — its own money
 * row, read back, never worked out here: a paid unit counts, a cost is its approved expenses, a product with no
 * supplier cost is Final at 0, an excluded one is not counted at all. Provisional sits beside Profit.
 */
function LastSaved({ saved }: { saved: { ref: string; created: string } }) {
  const t = useTranslations();
  const locale = useLocale();
  const [read, setRead] = useState<Read>({ status: 'loading' });
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    let live = true;
    rpc('finance_period_units', { p_from: saved.created, p_to: saved.created })
      .then((rows) => {
        if (live)
          setRead({ status: 'ready', units: ((rows as Unit[] | null) ?? []).filter((u) => u.ref === saved.ref) });
      })
      .catch(() => {
        if (live) setRead({ status: 'failed' });
      });
    return () => {
      live = false;
    };
  }, [saved, turn]);
  return (
    <aside
      className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start"
      aria-label={t('finance.new.lastSaved')}
      data-last-saved
    >
      <h2 className="text-sm font-semibold">
        {t('finance.new.lastSaved')} <span className="font-data tabular font-normal text-muted">{saved.ref}</span>
      </h2>
      {read.status === 'loading' ? (
        <DataState kind="loading" message={t('state.loading', { what: saved.ref })} />
      ) : null}
      {read.status === 'failed' ? (
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('finance.new.lastSaved') })}
          onRetry={() => {
            setRead({ status: 'loading' });
            setTurn((n) => n + 1);
          }}
          retryLabel={t('common.tryAgain')}
        />
      ) : null}
      {read.status === 'ready' && read.units.length === 0 ? (
        <span className="self-start" data-last-none>
          <StatusChip tone="neutral">{t('finance.new.noFigures')}</StatusChip>
        </span>
      ) : null}
      {read.status === 'ready'
        ? read.units.map((u, i) => (
            <div key={`${u.unit_kind}-${i}`} className="flex flex-col gap-2" data-last-unit data-counted={u.counted}>
              <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3">
                {(
                  [
                    ['revenue', u.revenue],
                    ['cost', u.cost],
                    ['profit', u.profit],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 flex-col gap-1" data-total={k}>
                    <dt className="text-xs text-muted">{t(`finance.tile.${k}`)}</dt>
                    <dd className="font-data tabular text-base font-semibold">{fmt(u.counted ? v : 0, locale)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-center gap-2 text-sm" data-last-state>
                <StatusChip tone={!u.counted ? 'neutral' : u.cost_is === 'provisional' ? 'warning' : 'success'}>
                  {!u.counted
                    ? t('finance.state.notCounted')
                    : u.cost_is === 'provisional'
                      ? t('finance.state.provisional')
                      : t('finance.state.final')}
                </StatusChip>
                {u.counted && u.cost_is === 'provisional' ? (
                  <span className="text-muted" data-last-provisional>
                    {t('finance.provisional')} <span className="font-data tabular">{fmt(u.profit, locale)}</span>
                  </span>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </aside>
  );
}
