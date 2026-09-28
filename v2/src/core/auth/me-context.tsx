'use client';

// The signed-in person, as the (app) gate got it from api.me() before the first paint (A5). Screens read it with
// useMe(); it is never fetched again in the browser for the same page load.
import { createContext, use, type ReactNode } from 'react';
import type { Me } from './me';

const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext value={me}>{children}</MeContext>;
}

export function useMe(): Me {
  const me = use(MeContext);
  if (!me) throw new Error('useMe() is only available inside the (app) gate');
  return me;
}
