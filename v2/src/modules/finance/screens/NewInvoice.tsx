'use client';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
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
  checksOf,
  expenseFields,
  hasRevenue,
  invoiceFields,
  KINDS,
  lineFields,
  lineTotal,
  problemsOf,
  serviceOfProduct,
  totalsOf,
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
export function NewInvoice({
  today,
  lists,
  people,
}: {
  today: string;
  lists: Lists | null;
  people: { id: string; label: string }[];
}) {
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
  return <NewInvoiceForm today={today} lists={lists} people={people} />;
}

function NewInvoiceForm({
  today,
  lists,
  people,
}: {
  today: string;
  lists: Lists;
  people: { id: string; label: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [d, setD] = useState<InvoiceDraft>(() => blankInvoice(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const totals = useMemo(() => totalsOf(d, lists), [d, lists]);
  const checks = useMemo(() => checksOf(d, lists), [d, lists]);
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
      if (d.channel && hasRevenue(d.kind))
        await rpc('finance_channel_set', {
          p_invoice: id,
          p_channel: d.channel,
          ...(d.creditTo ? { p_person: d.creditTo } : {}),
        });
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
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              {hasRevenue(d.kind) ? (
                <Field label={t('finance.number.channel')}>
                  {(p) => (
                    <Select
                      id={p.id}
                      value={d.channel || NONE}
                      onValueChange={(v) => {
                        set('channel', v === NONE ? '' : v);
                        set('creditTo', '');
                      }}
                      options={[{ value: NONE, label: t('finance.channel.none') }, ...opts(lists.channel)]}
                    />
                  )}
                </Field>
              ) : null}
              {hasRevenue(d.kind) && lists.channel.find((c) => c.key === d.channel)?.credits_owner ? (
                <Field label={t('finance.new.creditTo')}>
                  {(p) => (
                    <Select
                      id={p.id}
                      value={d.creditTo || NONE}
                      onValueChange={(v) => set('creditTo', v === NONE ? '' : v)}
                      options={[{ value: NONE, label: '—' }, ...people.map((x) => ({ value: x.id, label: x.label }))]}
                    />
                  )}
                </Field>
              ) : null}
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

        <aside
          className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start"
          aria-label={t('finance.new.totals')}
          data-new-totals
        >
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{t('finance.new.totals')}</h2>
            <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3">
              {(
                [
                  ['revenue', totals.revenue],
                  ['cost', totals.cost],
                  ['profit', totals.profit],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex min-w-0 flex-col gap-1" data-total={k}>
                  <dt className="text-xs text-muted">{t(`finance.tile.${k}`)}</dt>
                  <dd className="font-data tabular text-base font-semibold">{fmt(v, locale)}</dd>
                </div>
              ))}
            </dl>
            {totals.counts ? (
              <div className="flex flex-wrap items-center gap-2 text-sm" data-new-state>
                <StatusChip tone={totals.provisional ? 'warning' : 'success'}>
                  {totals.provisional ? t('finance.state.provisional') : t('finance.state.final')}
                </StatusChip>
                {totals.provisional ? (
                  <span className="text-muted" data-new-provisional>
                    {t('finance.provisional')} <span className="font-data tabular">{fmt(totals.profit, locale)}</span>
                  </span>
                ) : null}
              </div>
            ) : (
              <StatusChip tone="neutral" className="self-start" data-new-state>
                {t('finance.state.pending')}
              </StatusChip>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">
              {t('finance.new.checks')}
              {checks.length ? (
                <span className="ms-2 font-normal text-muted">{checks.filter((c) => !c.ok).length}</span>
              ) : null}
            </h2>
            <ul className="flex flex-col gap-1 text-sm" data-new-checks>
              {checks.map((c) => (
                <li key={c.key} data-check={c.key} data-ok={c.ok} className={c.ok ? 'text-text' : 'text-warning'}>
                  {t(`finance.new.check.${c.key}${c.ok ? '_ok' : ''}`, {
                    amount: fmt(Math.abs(c.amount ?? 0), locale),
                    count: c.count ?? 0,
                  })}
                </li>
              ))}
            </ul>
          </section>
        </aside>
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
