'use client';
import { browserDb } from '@/core/db/client';
import { unwrap, type PostgrestLikeError } from '@/core/db/errors';

type Untyped = { rpc: (fn: string, args: object) => Promise<{ data: unknown; error: PostgrestLikeError | null }> };

/**
 * One call to a My day door from the browser. The doors are builder A's P3-13 (types.ts names them); they join the
 * generated types when it lands, and this goes back to `rpc`. The typed error is thrown as for every other door.
 */
export async function door<T = { request_id?: string | null } | null>(fn: string, args: object): Promise<T> {
  const db = browserDb() as unknown as Untyped;
  return unwrap((await db.rpc(fn, args)) as { data: T | null; error: PostgrestLikeError | null });
}
