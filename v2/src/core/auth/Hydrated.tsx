'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** Marks the document once React has hydrated — tests wait for it before interacting. */
export function Hydrated() {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return hydrated ? <span data-hydrated hidden /> : null;
}
