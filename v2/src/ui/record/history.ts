// The shapes of the change log a screen draws (api.record_history, api.activity — V128), usable on the server and in
// the browser alike.

/** One request in a record's history (api.record_history) or in the whole change log (api.activity). */
export type HistoryRow = {
  request_id: string;
  at: string;
  actor_id: string | null;
  kind: string;
  label_key: string | null;
  label_args: Record<string, unknown> | null;
  reason: string | null;
  undone: boolean;
  undo_of: string | null;
  /** The record's changes in this request (record_history: one; activity: several). */
  changes: { entity?: string; id?: string; action: string; fields: string[]; before?: unknown; after?: unknown }[];
};

/** One change as api.record_history lists it (flat, one per field group); the timeline groups them by request. */
export type RecordChange = {
  change_id: number;
  request_id: string;
  at: string;
  actor_id: string | null;
  kind: string;
  label_key: string | null;
  label_args: Record<string, unknown> | null;
  reason: string | null;
  action: string;
  fields: string[];
  before: unknown;
  after: unknown;
  undone: boolean;
  undo_of: string | null;
};

/** api.record_history's flat changes → one HistoryRow per request (newest first), the shape api.activity already has. */
export function historyRows(
  raw: RecordChange[] | HistoryRow[] | null | undefined,
  entity: string,
  id: string,
): HistoryRow[] {
  if (!raw) return [];
  if (raw.length && 'changes' in raw[0]!) return raw as HistoryRow[];
  const out = new Map<string, HistoryRow>();
  for (const c of raw as RecordChange[]) {
    const row =
      out.get(c.request_id) ??
      out
        .set(c.request_id, {
          request_id: c.request_id,
          at: c.at,
          actor_id: c.actor_id,
          kind: c.kind,
          label_key: c.label_key,
          label_args: c.label_args,
          reason: c.reason,
          undone: c.undone,
          undo_of: c.undo_of,
          changes: [],
        })
        .get(c.request_id)!;
    row.changes.push({ entity, id, action: c.action, fields: c.fields ?? [], before: c.before, after: c.after });
  }
  return [...out.values()];
}

/** The personal preference fields a person flips often: runs of them are one line in the log (W38). */
export const PREFERENCE_FIELDS = ['theme', 'density'];

const isPreferenceChange = (r: HistoryRow) =>
  r.kind === 'ui' &&
  !r.undone &&
  !r.undo_of &&
  r.changes.length > 0 &&
  r.changes.every(
    (c) => c.action === 'update' && c.fields.length > 0 && c.fields.every((f) => PREFERENCE_FIELDS.includes(f)),
  );

/**
 * Consecutive changes of one person's own Theme or Density (newest first) become one row (W38): each field once, from
 * what it was before the first of them to what it is after the last, with how many there were. The row's request is the
 * newest one, so its Undo takes back the latest change, as any row's Undo takes back its own request.
 */
export function groupPreferenceRuns(rows: HistoryRow[]): (HistoryRow & { grouped?: number })[] {
  const out: (HistoryRow & { grouped?: number })[] = [];
  let i = 0;
  while (i < rows.length) {
    const first = rows[i]!;
    if (!isPreferenceChange(first)) {
      out.push(first);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rows.length && isPreferenceChange(rows[j]!) && rows[j]!.actor_id === first.actor_id) j++;
    const run = rows.slice(i, j);
    if (run.length === 1) {
      out.push(first);
    } else {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const r of [...run].reverse())
        for (const c of r.changes) {
          const b = c.before && typeof c.before === 'object' ? (c.before as Record<string, unknown>) : {};
          const a = c.after && typeof c.after === 'object' ? (c.after as Record<string, unknown>) : {};
          for (const f of c.fields) {
            if (!(f in before) && f in b) before[f] = b[f];
            if (f in a) after[f] = a[f];
          }
        }
      const fields = PREFERENCE_FIELDS.filter((f) => f in before || f in after);
      const lead = first.changes[0]!;
      out.push({
        ...first,
        grouped: run.length,
        changes: [{ entity: lead.entity, id: lead.id, action: 'update', fields, before, after }],
      });
    }
    i = j;
  }
  return out;
}
