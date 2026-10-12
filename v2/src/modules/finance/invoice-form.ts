// The New invoice form's own rules (P4-4, GC-5, V610, V611, V617, V622): what a typed invoice sends, what it is told
// before it is sent, and the live totals beside it. The database decides what counts once the rows are saved — the
// totals here are only what the person is about to enter, worked out the way V611 says.

export type InvoiceKind = 'transaction' | 'standalone' | 'billing' | 'wallet_topup';
/** Credit note is not offered (V423, out of v1). */
export const KINDS: InvoiceKind[] = ['transaction', 'standalone', 'billing', 'wallet_topup'];

export type LineDraft = { key: string; product: string; service: string; name: string; qty: string; price: string };
export type ExpenseDraft = {
  key: string;
  type: string;
  amount: string;
  status: string;
  merchant: string;
  reference: string;
};
export type InvoiceDraft = {
  kind: InvoiceKind;
  ref: string;
  status: string;
  created: string;
  paid: string;
  total: string;
  clientId: string;
  customerName: string;
  customerEmail: string;
  lines: LineDraft[];
  expenses: ExpenseDraft[];
};

/** One entry of a Finance list (`api.list`): the word Payments uses, its meaning, and the names on screen. */
export type ListEntry = {
  id?: string;
  key: string;
  name_en: string;
  name_ar?: string | null;
  word?: string | null;
  maps_to?: string | null;
  service_id?: string | null;
  no_supplier_cost?: boolean | null;
  /** A channel that credits a person (Commercial): an individual's unit then names who is credited (V613). */
  credits_owner?: boolean | null;
};
export type Lists = {
  status: ListEntry[];
  expenseStatus: ListEntry[];
  product: ListEntry[];
  service: ListEntry[];
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A typed amount: blank is nothing, anything that is not a plain number is invalid (null). */
export function amountOf(s: string): number | null | 'invalid' {
  const t = s.trim().replace(/,/g, '');
  if (t === '') return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return 'invalid';
  return Number(t);
}

export function lineTotal(l: Pick<LineDraft, 'qty' | 'price'>): number | null {
  const q = amountOf(l.qty);
  const p = amountOf(l.price);
  if (typeof q !== 'number' || typeof p !== 'number') return null;
  return round2(q * p);
}

export function linesTotal(lines: LineDraft[]): number {
  return round2(lines.reduce((sum, l) => sum + (lineTotal(l) ?? 0), 0));
}

let seq = 0;
export const newKey = () => `k${(seq += 1)}`;
export const blankLine = (): LineDraft => ({ key: newKey(), product: '', service: '', name: '', qty: '1', price: '' });
export const blankExpense = (): ExpenseDraft => ({
  key: newKey(),
  type: '',
  amount: '',
  status: '',
  merchant: '',
  reference: '',
});
export const blankInvoice = (today: string): InvoiceDraft => ({
  kind: 'transaction',
  ref: '',
  status: '',
  created: today,
  paid: '',
  total: '',
  clientId: '',
  customerName: '',
  customerEmail: '',
  lines: [],
  expenses: [],
});

const byKey = (list: ListEntry[], key: string) => list.find((e) => e.key === key);

/** A wallet top-up and a monthly invoice carry no revenue of their own (V616, V617). */
export const hasRevenue = (kind: InvoiceKind) => kind === 'transaction' || kind === 'standalone';

export type Problem = { field: string; key: string };

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** What is missing or wrong, in the order the form is read; each key is a `finance.new.problem.*` line. */
export function problemsOf(d: InvoiceDraft, lists: Lists): Problem[] {
  const out: Problem[] = [];
  if (d.ref.trim() === '') out.push({ field: 'ref', key: 'required' });
  else if (d.ref.trim().length > 60) out.push({ field: 'ref', key: 'too_long' });
  if (d.status === '') out.push({ field: 'status', key: 'required' });
  if (!isDay(d.created)) out.push({ field: 'created', key: 'required' });
  if (d.paid !== '' && !isDay(d.paid)) out.push({ field: 'paid', key: 'invalid' });
  if (hasRevenue(d.kind) || d.kind === 'billing') {
    if (amountOf(d.total) === 'invalid') out.push({ field: 'total', key: 'invalid' });
  }
  d.lines.forEach((l, i) => {
    if (l.name.trim() === '') out.push({ field: `line.${i}.name`, key: 'required' });
    if (lineTotal(l) === null) out.push({ field: `line.${i}.price`, key: 'invalid' });
  });
  d.expenses.forEach((e, i) => {
    if (e.type.trim() === '') out.push({ field: `expense.${i}.type`, key: 'required' });
    if (e.status === '') out.push({ field: `expense.${i}.status`, key: 'required' });
    const a = amountOf(e.amount);
    const approved = ['approved', 'issued'].includes(byKey(lists.expenseStatus, e.status)?.maps_to ?? '');
    if (a === 'invalid' || (approved && a === null))
      out.push({ field: `expense.${i}.amount`, key: a === null ? 'required' : 'invalid' });
  });
  return out;
}

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));

/** The invoice's own fields, only those typed; the status goes by Payments' word, the channel is set after the save. */
export function invoiceFields(d: InvoiceDraft, lists: Lists): Record<string, unknown> {
  const total = amountOf(d.total);
  return clean({
    ref: d.ref.trim(),
    kind: d.kind,
    status: byKey(lists.status, d.status)?.word ?? byKey(lists.status, d.status)?.name_en ?? d.status,
    created_on: d.created,
    paid_on: d.paid,
    total_sar:
      hasRevenue(d.kind) || d.kind === 'billing' ? (typeof total === 'number' ? total : linesTotal(d.lines) || '') : '',
    client_id: d.clientId.trim(),
    customer_name: d.customerName.trim(),
    customer_email: d.customerEmail.trim(),
  });
}

export function lineFields(l: LineDraft, invoiceId: string, lists: Lists): Record<string, unknown> {
  const product = byKey(lists.product, l.product);
  return clean({
    invoice_id: invoiceId,
    name: l.name.trim(),
    qty: amountOf(l.qty),
    unit_price: amountOf(l.price),
    total_sar: lineTotal(l),
    product: product ? (product.word ?? product.name_en) : '',
    // a service picked by hand wins; otherwise the database fills it from the product (V483)
    service: l.service,
  });
}

export function expenseFields(e: ExpenseDraft, invoiceId: string, lists: Lists): Record<string, unknown> {
  const status = byKey(lists.expenseStatus, e.status);
  const a = amountOf(e.amount);
  return clean({
    invoice_id: invoiceId,
    expense_type: e.type.trim(),
    status: status ? (status.word ?? status.name_en) : e.status,
    amount_sar: typeof a === 'number' ? a : '',
    merchant: e.merchant.trim(),
    id_reference: e.reference.trim(),
  });
}

/** The service a product points to (V483), by its key; '' when the product names none. */
export function serviceOfProduct(productKey: string, lists: Lists): string {
  const p = byKey(lists.product, productKey);
  if (!p?.service_id) return '';
  return lists.service.find((s) => s.id === p.service_id)?.key ?? '';
}
