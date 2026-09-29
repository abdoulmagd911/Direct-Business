import { notFound } from 'next/navigation';

/**
 * One optional read on a record page (the old app's lesson: a failed read is never drawn as empty or as no access).
 * What the database refuses (`PermissionDenied` — a member reading the people list) is left out, as `null`; a record
 * that is gone (`NotFound`) ends the page as not found; any other failure (the network, the server) is left out too
 * but NAMED in `failed`, so the screen says which read failed and offers Try again.
 */
export async function readOrFail<T>(name: string, failed: string[], read: () => Promise<unknown>): Promise<T | null> {
  try {
    return (await read()) as T;
  } catch (e) {
    const kind = (e as { kind?: string }).kind;
    if (kind === 'NotFound') notFound();
    if (kind !== 'PermissionDenied') failed.push(name);
    return null;
  }
}
