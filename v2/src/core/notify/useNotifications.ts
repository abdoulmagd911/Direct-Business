'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  tab === 'all' ||
  (tab === 'mentions'
    ? kind === 'mentioned' || kind === 'note_mention'
    : kind === 'assigned' || kind === 'helper_added');

/** One api.notifications answer: the rows and the counts from the same read (D36(c)). */
type NotificationsAnswer = {
  rows: Notification[];
  unread: number;
  unread_mentions: number;
  unread_assigned: number;
};

/**
 * The bell's data: the unread counts (drawn in the top bar and on the tabs) and the list of the open tab, cut from
 * ONE read (D36(c), F238/F237) — the badge, the All count and the tab counts all come from the same response as the
 * rows, so they can never disagree, not even above the 100-row cap and not when a notification lands between two
 * reads (the owner saw 14 and 15 with Mentions saying Nothing new). The read re-runs after every command (the
 * global refetch), when the window comes back, when the panel opens or its tab changes — and live, through Realtime
 * on the person's own notifications when the deployment has it (NEXT_PUBLIC_REALTIME=1; the local stacks run
 * without the Realtime service). Never a timer (A's lint refuses polling).
 */
export function useNotifications(tab: NotificationTab) {
  const me = useMe();
  const [unread, setUnread] = useState<number | null>(null);
  const [tabCounts, setTabCounts] = useState<{ mentions: number; assigned: number } | null>(null);
  const [all, setAll] = useState<Notification[] | null>(null);
  const [failed, setFailed] = useState(false);
  // The reloads are sequenced (the finance epoch guard, use-reads.ts): a reload that started later wins, and an
  // answer asked for before a newer reload (or a write) is never kept — two overlapping reloads used to let the
  // older one land last and show the counts as they stood before the write (F001).
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    try {
      // a pure read, so it is tried once more when it fails on its way (R1, as the server read is retried).
      const res = (await rpc(
        'notifications',
        { p_tab: 'all', p_limit: 100 },
        { retry: true },
      )) as unknown as NotificationsAnswer;
      if (generation.current !== mine) return;
      setAll(res.rows ?? []);
      setUnread(res.unread ?? 0);
      setTabCounts({ mentions: res.unread_mentions ?? 0, assigned: res.unread_assigned ?? 0 });
      setFailed(false);
    } catch {
      if (generation.current !== mine) return;
      setFailed(true);
    }
  }, []);

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
  /** Unread per tab, from the same read as the list; null until the list has been read. */
  const tabUnread = (k: NotificationTab) => {
    if (unread === null || tabCounts === null) return null;
    return k === 'all' ? unread : tabCounts[k];
  };

  return { unread, items, tabUnread, failed, reload, markRead, snooze };
}
