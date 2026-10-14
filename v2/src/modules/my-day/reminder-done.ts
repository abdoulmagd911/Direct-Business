import { rpc } from '@/core/db/rpc';

/**
 * Done on a reminder, from anywhere (a Today row, the alert, the bell): the reminder ends, and its alert in the bell is
 * read, so both places clear together (Stage 2 test 5). One function, so every screen does the same.
 *
 * Two requests until builder A gives one door (`reminder_done`): the first, the removal, is the one Undo takes back.
 * The alert is read first, so a refusal of the removal leaves the reminder as it was; a failed read is not fatal.
 */
export async function markReminderDone(r: {
  id: string;
  notification_id?: string | null;
}): Promise<{ request_id?: string | null }> {
  if (r.notification_id) await rpc('notifications_mark_read', { p_ids: [r.notification_id] }).catch(() => 0);
  return (await rpc('reminders_remove', { p_ids: [r.id] })) as { request_id?: string | null };
}
