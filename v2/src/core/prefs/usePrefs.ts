'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { readPrefs, setPref, type Prefs } from './index';

let cache: Prefs | null = null;
let cacheKey = '';
function snapshot(): Prefs {
  const key = typeof document === 'undefined' ? '' : document.cookie;
  if (!cache || key !== cacheKey) {
    cache = readPrefs();
    cacheKey = key;
  }
  return cache;
}
function subscribe(cb: () => void) {
  window.addEventListener('v2:prefs', cb);
  return () => window.removeEventListener('v2:prefs', cb);
}

/** Read the person's UI preferences; `set` changes one and re-renders every subscriber. */
export function usePrefs(initial?: Prefs) {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => initial ?? snapshot());
  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => setPref(key, value), []);
  return { prefs, set };
}
