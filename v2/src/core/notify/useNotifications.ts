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
  /** The record by name, only for a reader who may see it (QA-553); else null and the bell says the kind's word. */
  title?: string | null;
  title_ar?: string | null;
  /** What a change notice's request changed on the record: field names only; empty for any other notice. */
  fields?: string[];
};

/** Which kinds each tab shows (api.notifications' own rule, notify.list): All is every kind, so it is the badge. */
export const tabHas = (tab: NotificationTab, kind: string) =>
  tab === 'all' || (tab === 'mentions' ? kind === 'mentioned' : kind === 'assigned' || kind === 'helper_added');

/**
 * The bell's data: the unread count (drawn in the top bar) and the list of the open tab, cut from ONE read of everything so the tabs' own counts and the badge come from the same rows
 * (the owner saw 14 and 15 with Mentions saying Nothing new). Both re-read after every
 * command (the global refetch), when the window comes back, when the panel opens or its tab changes — and live,
 * through Realtime on the person's own notifications when the deployment has it (NEXT_PUBLIC_REALTIME=1; the local
 * stacks run without the Realtime service). Never a timer (A's lint refuses polling).
 */
export function useNotifications(open: boolean, tab: NotificationTab) {
  const me = useMe();
  const [unread, setUnread] = useState<number | null>(null);
  const [all, setAll] = useState<Notification[] | null>(null);
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
      setAll(((await rpc('notifications', { p_tab: 'all', p_limit: 100 })) as unknown as Notification[]) ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  const reload = useCallback(async () => {
    await Promise.all([loadUnread(), open ? loadList() : Promise.resolve()]);
  }, [loadUnread, loadList, open]);

  useEffect(() => {
    // The first read runs after the paint (the compiler's rule: no state set inside the effect itself).
    queueMicrotask(() => void reload());
    return onRefetch(() => void reload());
  }, [reload]);

  // Back on the window: a count read before the person left may be stale on this screen while another one moved on.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', back);
    };
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

  const items = all === null ? null : all.filter((n) => tabHas(tab, n.kind));
  /** Unread per tab, from the same rows as the list; null until the list has been read. */
  const tabUnread = (k: NotificationTab) =>
    all === null ? null : all.filter((n) => !n.read_at && tabHas(k, n.kind)).length;

  return { unread, items, tabUnread, failed, reload, markRead, snooze };
}
