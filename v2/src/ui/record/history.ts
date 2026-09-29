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
