'use client';
import type { Database } from './database.types';
import { browserDb } from './client';
import { unwrap } from './errors';

type Fns = Database['api']['Functions'];
export type ApiFunction = keyof Fns & string;
export type ApiArgs<F extends ApiFunction> = Fns[F]['Args'];
export type ApiReturns<F extends ApiFunction> = Fns[F]['Returns'];

/**
 * One api.* call from the browser, as the signed-in person (the Data API checks the session; the database checks the
 * access — V125). The typed error is thrown (core/db/errors.ts); the screen turns its key into words (words.ts).
 */
export async function rpc<F extends ApiFunction>(fn: F, args: ApiArgs<F>): Promise<ApiReturns<F>> {
  const result = await browserDb().rpc(fn, args as never);
  return unwrap(result as { data: ApiReturns<F> | null; error: { code?: string; message?: string } | null });
}
