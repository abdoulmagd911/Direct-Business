'use client';
import { DbError } from '@/core/db/errors';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';
import { askConflict, type ConflictChoice } from './conflict-store';
import { refetchAll } from './refetch';

export type CommandWords = {
  /** The done line, e.g. "Saved" or "Ahmed switched off". */
  done: string;
  undo: string;
  /** The done line of the Undo itself, e.g. "Undone". */
  undone: string;
  /** Turns a refusal into words (next-intl's `t`, with `t.has`). */
  failed: (key: string, detail: string) => string;
  has: (key: string) => boolean;
};

export type Written = { request_id?: string | null } | null | undefined;

/** One field a form writes: what I typed, what I read when the form opened, and how a value reads on screen. */
export type ConflictField = {
  key: string;
  label: string;
  mine: unknown;
  read: unknown;
  /** The value in words (a name for an id, a date); `String(value)` when absent. */
  show?: (value: unknown) => string;
};

/**
 * How a command resolves a version conflict (FLOW-08): the fields it writes, a read of the record as it stands now
 * (its values and version), and the same write again with the chosen values and that version.
 */
export type ConflictPlan = {
  fields: ConflictField[];
  theirs: () => Promise<{ version: number; values: Record<string, unknown> }>;
  retry: (values: Record<string, unknown>, version: number) => Promise<Written>;
};

export type CommandOptions<T extends Written> = {
  /** Runs on success (a close, a local state change); the global refetch has already been asked for. */
  after?: (result: T) => void | Promise<void>;
  conflict?: ConflictPlan;
  /** The other person's name, for the conflict dialog; api.hover_person when absent. */
  nameOf?: (personId: string) => string | undefined;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const shown = (f: ConflictField, v: unknown) =>
  f.show ? f.show(v) : v === null || v === undefined || v === '' ? '—' : String(v);

async function whoIs(id: string | undefined, nameOf?: (id: string) => string | undefined): Promise<string> {
  if (!id) return '';
  const known = nameOf?.(id);
  if (known) return known;
  try {
    const p = (await rpc('hover_person', { p_id: id })) as { display_name_en?: string; full_name_en?: string } | null;
    return p?.display_name_en ?? p?.full_name_en ?? '';
  } catch {
    return '';
  }
}

/**
 * One person action (TECH-SPEC §2.4, §3.3, V128): run the write; on success a toast with Undo (`api.undo(request)` —
 * the whole request, all or nothing) and the global refetch; a refusal in words. A version conflict (the database's
 * `common.conflict`, raised only when the same field changed — different fields merge on their own, FLOW-08) opens the
 * conflict dialog: the person sees who changed it and when, and chooses per field; the command runs again with their
 * choice and the current version.
 */
export async function command<T extends Written>(
  words: CommandWords,
  write: () => Promise<T>,
  opts: CommandOptions<T> = {},
): Promise<T | undefined> {
  try {
    const result = await write();
    await done(words, result, opts.after);
    return result;
  } catch (e) {
    if (e instanceof DbError && e.kind === 'Conflict' && opts.conflict) {
      const again = await resolveConflict(e, opts.conflict, opts.nameOf);
      if (again === 'cancelled') return undefined;
      try {
        const result = (await again()) as T;
        await done(words, result, opts.after);
        return result;
      } catch (e2) {
        refuse(words, e2);
        return undefined;
      }
    }
    refuse(words, e);
    return undefined;
  }
}

/** The earlier name of `command()`; screens built before P3-7 call it this way. */
export function run<T extends Written>(
  words: CommandWords,
  write: () => Promise<T>,
  after?: (result: T) => void | Promise<void>,
): Promise<T | undefined> {
  return command(words, write, { after });
}

async function done<T extends Written>(words: CommandWords, result: T, after?: (r: T) => void | Promise<void>) {
  const requestId = (result as { request_id?: string | null } | null)?.request_id ?? null;
  toast.done(words.done, {
    undo: requestId
      ? {
          label: words.undo,
          onUndo: async () => {
            try {
              await rpc('undo', { p_request: requestId });
              toast.done(words.undone);
              refetchAll();
              await after?.(result);
            } catch (e) {
              refuse(words, e);
            }
          },
        }
      : undefined,
  });
  refetchAll();
  await after?.(result);
}

function refuse(words: CommandWords, e: unknown) {
  const { key, detail } = errorKey(e, words.has);
  toast.failed(words.failed(key, detail));
}

async function resolveConflict(
  e: DbError,
  plan: ConflictPlan,
  nameOf?: (id: string) => string | undefined,
): Promise<'cancelled' | (() => Promise<Written>)> {
  let hit: { field?: string; by?: string; at?: string; version?: number } = {};
  try {
    hit = JSON.parse(e.detail ?? '{}');
  } catch {
    hit = {};
  }
  const [theirs, by] = await Promise.all([plan.theirs(), whoIs(hit.by, nameOf)]);
  // A field is in conflict when the other person's value differs from what I read; my other fields carry over.
  const rows = plan.fields
    .filter((f) => !same(theirs.values[f.key], f.read) && !same(theirs.values[f.key], f.mine))
    .map((f) => ({ key: f.key, label: f.label, mine: shown(f, f.mine), theirs: shown(f, theirs.values[f.key]) }));
  let choice: ConflictChoice | null = {};
  if (rows.length) {
    choice = await askConflict({ by, at: hit.at ?? '', rows });
    if (!choice) return 'cancelled';
  }
  const values: Record<string, unknown> = {};
  for (const f of plan.fields) values[f.key] = choice[f.key] === 'theirs' ? theirs.values[f.key] : f.mine;
  return () => plan.retry(values, theirs.version);
}
