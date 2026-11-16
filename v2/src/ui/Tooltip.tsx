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
            className="motion-menu z-50 max-w-[calc(100vw-32px)] origin-[var(--radix-tooltip-content-transform-origin)] rounded-sm bg-inverse px-2.5 py-1.5 text-sm font-medium text-on-inverse shadow-2"
          >
            {content}
          </RT.Content>
        </RT.Portal>
      )}
    </RT.Root>
  );
}
