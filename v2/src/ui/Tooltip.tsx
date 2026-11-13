'use client';
import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RT.Provider delayDuration={300}>{children}</RT.Provider>;
}

export function Tooltip({
  content,
  children,
  side = 'bottom',
  disabled = false,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** No tooltip while true, but the child stays the same element: a control that only sometimes needs its tooltip
   *  (a rail item, named by its own words once the drawer opens) is never swapped for a new one under the pointer. */
  disabled?: boolean;
}) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      {disabled ? null : (
        <RT.Portal>
          <RT.Content
            side={side}
            sideOffset={6}
            className="z-50 rounded-md bg-text px-2.5 py-1.5 text-sm text-raised shadow-2"
          >
            {content}
          </RT.Content>
        </RT.Portal>
      )}
    </RT.Root>
  );
}
