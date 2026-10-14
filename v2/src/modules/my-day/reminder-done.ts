import { rpc } from '@/core/db/rpc';

/**
 * Done on a reminder in the Today block. One whose alert has gone out is put away the way the alert's Done does it: its
 * alert in the bell is read (it stops being due, in both places). One the job has not told yet has no alert, so it is
 * removed, which Undo takes back.
 */
export async function markReminderDone(r: {
  id: string;
  notification_id: string | null;
}): Promise<{ request_id?: string | null }> {
  if (r.notification_id) {
    await rpc('notifications_mark_read', { p_ids: [r.notification_id] });
    return {};
  }
  return (await rpc('reminders_remove', { p_ids: [r.id] })) as { request_id?: string | null };
}
