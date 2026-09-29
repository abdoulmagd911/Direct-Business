'use client';
import { useCallback, useEffect, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { onRefetch } from '@/core/commands/refetch';
import { browserDb } from '@/core/db/client';
import { rpc } from '@/core/db/rpc';

export const NOTIFICATION_TABS = ['all', 'mentions', 'assigned'] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

/** One row of api.notifications (§3.3, V129). */
export type Notification = {
  id: string;
  kind: string;
  entity: string | null;
  entity_id: string | null;
  request_id: string | null;
  actor_id: string | null;
  actor_name_en: string | null;
  actor_name_ar: string | null;
  label_key: string | null;
  label_args: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
};

/**
 * The bell's data: the unread count (drawn in the top bar) and the list of the open tab. Both re-read after every
 * command (the global refetch), when the window comes back, when the panel opens or its tab changes — and live,
 * through Realtime on the person's own notifications when the deployment has it (NEXT_PUBLIC_REALTIME=1; the local
 * stacks run without the Realtime service). Never a timer (A's lint refuses polling).
 */
export function useNotifications(open: boolean, tab: NotificationTab) {
  const me = useMe();
  const [unread, setUnread] = useState<number | null>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [failed, setFailed] = useState(false);

  const loadUnread = useCallback(async () => {
    try {
      setUnread((await rpc('notifications_unread', {})) ?? 0);
    } catch {
      setUnread(null);
    }
  }, []);
  const loadList = useCallback(async () => {
    try {
      setItems(((await rpc('notifications', { p_tab: tab, p_limit: 100 })) as unknown as Notification[]) ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [tab]);
  const reload = useCallback(async () => {
    await Promise.all([loadUnread(), open ? loadList() : Promise.resolve()]);
  }, [loadUnread, loadList, open]);

  useEffect(() => {
    // The first read runs after the paint (the compiler's rule: no state set inside the effect itself).
    queueMicrotask(() => void reload());
    return onRefetch(() => void reload());
  }, [reload]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REALTIME !== '1') return;
    const channel = browserDb()
      .channel(`notify:${me.person.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'notify', table: 'notification', filter: `person_id=eq.${me.person.id}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
    };
  }, [me.person.id, reload]);

  const markRead = useCallback(
    async (ids?: string[]) => {
      await rpc('notifications_mark_read', ids ? { p_ids: ids } : {});
      await reload();
    },
    [reload],
  );
  const snooze = useCallback(
    async (ids: string[], until: Date) => {
      await rpc('notifications_snooze', { p_ids: ids, p_until: until.toISOString() });
      await reload();
    },
    [reload],
  );

  return { unread, items, failed, reload, markRead, snooze };
}
