'use client';
import { useSyncExternalStore } from 'react';

/** One field two people changed: what the other person wrote and what I typed (FLOW-08). */
export type ConflictRow = { key: string; label: string; mine: string; theirs: string };

export type ConflictAsk = {
  /** The other person's name and when they changed it (from the database's answer). */
  by: string;
  at: string;
  rows: ConflictRow[];
};

/** Per field: keep what they wrote, or write mine over it. */
export type ConflictChoice = Record<string, 'theirs' | 'mine'>;

type Pending = { ask: ConflictAsk; resolve: (choice: ConflictChoice | null) => void };

let pending: Pending | null = null;
const subs = new Set<() => void>();
const emit = () => {
  for (const s of subs) s();
};

/**
 * Asks the person, through the ConflictDialog the shell renders, which value each conflicting field keeps. Resolves
 * with their choice, or null when they cancel. One question at a time: a second ask while one is open cancels the first.
 */
export function askConflict(ask: ConflictAsk): Promise<ConflictChoice | null> {
  pending?.resolve(null);
  return new Promise((resolve) => {
    pending = { ask, resolve };
    emit();
  });
}

export function answerConflict(choice: ConflictChoice | null) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(choice);
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
const snapshot = () => pending?.ask ?? null;
const none = () => null;

/** The open question, for the dialog. */
export function useConflictAsk(): ConflictAsk | null {
  return useSyncExternalStore(subscribe, snapshot, none);
}
