'use client';
import { useState, type ReactNode } from 'react';
import { useNotifications, type NotificationTab } from '@/core/notify/useNotifications';
import { ConflictDialog } from '../ConflictDialog';
import { Toaster } from '../Toast';
import { TooltipProvider } from '../Tooltip';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';
import { Drawer } from './Drawer';
import { NotificationsPanel } from './NotificationsPanel';
import { RefetchBridge } from './RefetchBridge';
import { TopBar } from './TopBar';

/**
 * Drawer + top bar + the page; on a phone the drawer gives way to the bottom bar (oversight, 29 Sep). The bell, its
 * panel, the conflict dialog and the global refetch live here once, for every screen (P3-7).
 * Rendered only after `me` is known (the server layout gates it).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState(false);
  const [bell, setBell] = useState(false);
  const [tab, setTab] = useState<NotificationTab>('all');
  const notifications = useNotifications(bell, tab);
  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-bg text-text" data-app-shell>
        <Drawer />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onOpenSearch={() => setSearch(true)}
            onOpenBell={() => setBell((o) => !o)}
            bellOpen={bell}
            unread={notifications.unread ?? 0}
          />
          <main id="main" className="flex min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
          <BottomBar />
        </div>
      </div>
      <CommandPalette open={search} onOpenChange={setSearch} />
      <NotificationsPanel
        open={bell}
        onOpenChange={setBell}
        tab={tab}
        onTabChange={setTab}
        items={notifications.items}
        failed={notifications.failed}
        reload={notifications.reload}
        markRead={notifications.markRead}
        snooze={notifications.snooze}
      />
      <ConflictDialog />
      <RefetchBridge />
      <Toaster />
    </TooltipProvider>
  );
}

/**
 * The scrolling page area beside an optional detail panel (a sibling of this). Margins 16 / 24 / 32 / 40 px at
 * phone / tablet / desktop / wide and lists up to 1,600 px wide (V85); on a phone the bottom bar's height is kept clear.
 * Screens use `Page` (shell/Page.tsx), which draws this only after the gate has answered.
 */
export function PageFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  // The page scrolls, so its blocks never shrink: a block that scrolls sideways (a tab strip, a wide table) would
  // otherwise be squeezed to nothing on a long page — the Activity tabs vanished and swallowed the first click (W11).
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-[var(--section-gap)] overflow-y-auto px-4 pb-24 pt-6 sm:px-6 sm:pb-10 lg:px-8 lg:pt-7 2xl:px-10 [&>*]:w-full [&>*]:max-w-[1600px] [&>*]:shrink-0 ${className}`}
      data-page
    >
      {children}
    </div>
  );
}
