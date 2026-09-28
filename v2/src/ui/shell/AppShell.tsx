'use client';
import { useState, type ReactNode } from 'react';
import { Toaster } from '../Toast';
import { TooltipProvider } from '../Tooltip';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';
import { Drawer } from './Drawer';
import { TopBar } from './TopBar';

/**
 * Drawer + top bar + the page; on a phone the drawer gives way to the bottom bar (oversight, 29 Sep).
 * Rendered only after `me` is known (the server layout gates it).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState(false);
  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-bg text-text" data-app-shell>
        <Drawer />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenSearch={() => setSearch(true)} />
          <main id="main" className="flex min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
          <BottomBar />
        </div>
      </div>
      <CommandPalette open={search} onOpenChange={setSearch} />
      <Toaster />
    </TooltipProvider>
  );
}

/** The scrolling page area beside an optional detail panel (which sits as a sibling of this). */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-[var(--section-gap)] overflow-y-auto px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pt-7 ${className}`}
      data-page
    >
      {children}
    </div>
  );
}
