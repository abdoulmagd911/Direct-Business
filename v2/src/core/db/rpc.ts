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

/**
 * A call to an api.* function the generated types do not know yet — one the spec names but a later step ships
 * (`api.list_usage`, `api.list_retire`, `api.setting_preview` — V97). The caller treats NotFound/Unavailable as "not
 * there yet" and shows what it knows; the types catch up when the function lands and the call moves to `rpc`.
 */
export async function rpcLoose<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const result = await (
    browserDb() as unknown as {
      rpc: (f: string, a: unknown) => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>;
    }
  ).rpc(fn, args);
  return unwrap(result);
}
