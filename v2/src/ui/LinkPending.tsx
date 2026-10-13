'use client';
import { Loader2 } from 'lucide-react';
import { useLinkStatus } from 'next/link';

/** Inside a `Link`: a spinner from the click until the next page has arrived (W47 — a slow tab never looks broken). */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="ms-2 size-3.5 animate-spin" aria-hidden="true" data-link-pending /> : null;
}
