import type { ReactNode } from 'react';
import '@/ui/door.css';

/** The pages outside the shell (sign in, choose a new password) share the door's stylesheet (V213). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
