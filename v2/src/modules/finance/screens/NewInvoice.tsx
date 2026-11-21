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
import { DatePicker } from '@/ui/DatePicker';
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
import { financeWrote } from '../use-reads';

const NONE = '__none';
/** A line's field takes the whole row on a phone, so the line's total and its remove button share the last one. */
const LINE_FIELD = 'col-span-2 @min-[520px]:col-span-1';
const fmt = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'ar' ? 'en-US' : locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/**
 * New invoice (P4-4, GC-5), in the V21 look (not drawn on the boards; built from the kit): white cards, the kit's
 * fields, pill buttons, and the three actions beside the title — or, where the page is narrow (a phone), in a bar
 * that stays at the foot of the screen while the form scrolls. The rows of lines and expenses lay themselves out by
 * their card's width, so nothing runs off the card with the drawer open.
 * An invoice, its lines and its expenses typed in one place, a side panel that works out
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
      // the first field that needs something gets the focus once it is drawn as such (before, nothing was marked yet
      // when this ran, so the focus stayed on Save — far from a missing line or expense further down)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[data-new-invoice] [aria-invalid="true"]')?.focus(),
      );
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
            financeWrote();
            refetchAll();
          } catch (e) {
            const { key, detail } = errorKey(e, (k) => t.has(k));
            toast.failed(t(key, { detail }));
          }
        },
      },
    });
    financeWrote();
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
    <div className="@container min-w-0">
      <form
        className="flex min-w-0 flex-col gap-6 @min-[640px]:grid @min-[640px]:grid-cols-[minmax(0,1fr)_auto] @min-[640px]:items-end"
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
        />
        <div
          className={cn(
            'grid min-w-0 gap-6 @min-[640px]:col-span-2',
            saved && '@min-[1000px]:grid-cols-[minmax(0,1fr)_320px]',
          )}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="radiogroup"
                  aria-label={t('finance.new.kind')}
                  className="flex flex-wrap gap-1 rounded-[26px] bg-surface p-1"
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
                        'min-h-9 rounded-pill px-4 text-base font-medium leading-5 transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus max-sm:min-h-11',
                        d.kind === k
                          ? 'bg-raised font-semibold text-strong shadow-tab'
                          : 'text-muted hover:text-strong',
                      )}
                    >
                      {t(`finance.kind.${k}`)}
                    </button>
                  ))}
                </div>
                <StatusChip tone="neutral">{t('finance.source.typed')}</StatusChip>
              </div>
              {/* two to a row: a date box needs the room for its day, its calendar and Clear — four to a row cut the
                year off the day ("13 Nov 202") */}
              <div className="grid gap-4 @min-[520px]:grid-cols-2">
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
                      // the form refuses more than 60 (invoice-form.ts): the box no longer takes 20 it will refuse
                      maxLength={60}
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
                  {(p) => (
                    <DatePicker
                      id={p.id}
                      describedBy={p['aria-describedby']}
                      invalid={p['aria-invalid']}
                      value={d.created || undefined}
                      onChange={(v) => set('created', v ?? '')}
                    />
                  )}
                </Field>
                <Field label={t('finance.number.paid')} error={problem('paid')}>
                  {(p) => (
                    <DatePicker
                      id={p.id}
                      describedBy={p['aria-describedby']}
                      invalid={p['aria-invalid']}
                      value={d.paid || undefined}
                      onChange={(v) => set('paid', v ?? '')}
                    />
                  )}
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
              <div className="grid gap-4 @min-[640px]:grid-cols-3">
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
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-lg border border-border p-3 @min-[520px]:grid-cols-2 @min-[900px]:grid-cols-[1.2fr_1fr_1.6fr_5rem_7rem_7rem_2.75rem] @min-[900px]:border-0 @min-[900px]:p-0"
                    >
                      <Field label={t('finance.new.product')} className={LINE_FIELD}>
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
                      <Field label={t('finance.new.service')} className={LINE_FIELD}>
                        {(p) => (
                          <Select
                            id={p.id}
                            value={l.service || NONE}
                            onValueChange={(v) => setLine(l.key, { service: v === NONE ? '' : v })}
                            options={[{ value: NONE, label: '—' }, ...opts(lists.service)]}
                          />
                        )}
                      </Field>
                      <Field label={t('finance.new.item')} error={problem(`line.${i}.name`)} className={LINE_FIELD}>
                        {(p) => (
                          <Input {...p} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} />
                        )}
                      </Field>
                      <Field label={t('finance.new.qty')} className={LINE_FIELD}>
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
                      <Field label={t('finance.new.price')} error={problem(`line.${i}.price`)} className={LINE_FIELD}>
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
                      {/* the line's total: named where there is no column over it, and on a phone on one row with the
                        remove button — not a bare dash on a row of its own */}
                      <div className="flex min-h-[var(--control-h)] items-end justify-between gap-2 pb-2 @min-[900px]:justify-end">
                        <span className="text-sm text-muted @min-[900px]:hidden">{t('finance.number.total')}</span>
                        <span className="text-end font-data tabular text-base" data-line-total>
                          {lineTotal(l) === null ? '—' : fmt(lineTotal(l) ?? 0, locale)}
                        </span>
                      </div>
                      <IconButton
                        label={t('finance.new.removeLine')}
                        icon={<X aria-hidden="true" />}
                        onClick={() => setD((x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))}
                        className="justify-self-end"
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
                    className="grid gap-3 rounded-lg border border-border p-3 @min-[520px]:grid-cols-2 @min-[900px]:grid-cols-[1.2fr_7rem_1fr_1.2fr_1fr_2.75rem] @min-[900px]:items-end @min-[900px]:border-0 @min-[900px]:p-0"
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
        {/* the three actions, once: beside the title where there is room; where the page is narrow (a phone) a bar
          that stays at the foot of the screen while the form scrolls, so Save is always in reach */}
        <div
          className="flex flex-wrap items-center justify-end gap-2 @min-[640px]:col-start-2 @min-[640px]:row-start-1 @max-[639px]:sticky @max-[639px]:bottom-3 @max-[639px]:z-20 @max-[639px]:rounded-xl @max-[639px]:border @max-[639px]:border-border @max-[639px]:bg-raised @max-[639px]:p-3 @max-[639px]:shadow-2"
          data-new-invoice-actions
        >
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
      </form>
    </div>
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
    <section className="@container flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-raised p-4 shadow-1 sm:p-5">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold leading-6 text-strong">
            {title}
            {count ? <span className="ms-2 font-data text-sm font-normal text-muted">{count}</span> : null}
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
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-4 shadow-1 @min-[1000px]:sticky @min-[1000px]:top-4 @min-[1000px]:self-start sm:p-5"
      aria-label={t('finance.new.lastSaved')}
      data-last-saved
    >
      <h2 className="font-display text-lg font-semibold leading-6 text-strong">
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
              <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface p-3">
                {(
                  [
                    ['revenue', u.revenue],
                    ['cost', u.cost],
                    ['profit', u.profit],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 flex-col gap-1" data-total={k}>
                    <dt className="text-xs text-muted">{t(`finance.tile.${k}`)}</dt>
                    <dd
                      className={cn(
                        'font-data text-base font-semibold tabular [overflow-wrap:anywhere]',
                        // Revenue is the one green figure, as on the Finance page
                        k === 'revenue' ? 'text-success' : 'text-strong',
                      )}
                    >
                      {fmt(u.counted ? v : 0, locale)}
                    </dd>
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
