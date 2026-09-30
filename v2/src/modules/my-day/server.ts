import 'server-only';
import { DbError, unwrap, type PostgrestLikeError } from '@/core/db/errors';
import { serverDb } from '@/core/db/server';
import type { MyDayAnswer, MyNote, Scope } from './types';

type Untyped = { rpc: (fn: string, args: object) => Promise<{ data: unknown; error: PostgrestLikeError | null }> };

/** PostgREST's answer when a function does not exist (yet): the page waits for P3-13 instead of failing. */
const missing = (e: unknown) => e instanceof DbError && e.kind === 'Unavailable' && !!e.detail?.includes('PGRST202');

async function read<T>(fn: string, args: object): Promise<T> {
  const db = (await serverDb()) as unknown as Untyped;
  return unwrap((await db.rpc(fn, args)) as { data: T | null; error: PostgrestLikeError | null });
}

/** My day's page (api.my_day); null while builder A's door is not there, so the page says "Being built." as before. */
export async function myDay(scope: Scope, limit: number): Promise<MyDayAnswer | null> {
  try {
    return await read<MyDayAnswer>('my_day', { p_scope: scope, p_limit: limit });
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}

/** One note the reader may see; null when it is gone or not theirs to read (a private note is its author's alone). */
export async function myNote(id: string): Promise<MyNote | null> {
  try {
    return await read<MyNote>('my_note', { p_id: id });
  } catch {
    return null;
  }
}
