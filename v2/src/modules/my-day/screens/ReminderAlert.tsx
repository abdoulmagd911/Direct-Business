'use client';
import { Check, ChevronDown, Clock } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/command';
import { onRefetch, refetchAll } from '@/core/commands/refetch';
import { browserDb } from '@/core/db/client';
import { errorKey } from '@/core/db/words';
import { rpc } from '@/core/db/rpc';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { toast } from '@/ui/Toast';
import { noteRoute } from '../logic';
import {
  alertDelay,
  LONGEST_WAIT_MS,
  snoozeChoices,
  snoozeInstant,
  unannounced,
  type DueAnswer,
  type DueReminder,
} from '../reminder-alert';
import { tomorrowDayName, type When } from '../when';
import { whenLine } from './WhenPicker';

/**
 * The reminder alert (productivity stage 2): at a reminder's time, on any page while the app is open, a card under the
 * top bar with the reminder's words (a tap opens the item), Done and Snooze (Later today · Tomorrow · Next week, the
 * same answers as the When chips). It is the bell's item and the same one: Done marks it read, Snooze moves the
 * reminder and puts the old alert away, so either place clears both. One timer, set from the next reminder's time (no
 * polling); live through Realtime where the deployment has it. It sits at the top, so it never covers the floating +,
 * and it never takes focus. A browser notification is shown too when the person has allowed them and the tab is in the
 * background — once per reminder, only while the app is open in a tab (no server push).
 */
export function ReminderAlert() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const me = useMe();
  const words = useWords();
  const [due, setDue] = useState<DueReminder[]>([]);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const answer = (await rpc('reminders_due', {})) as unknown as DueAnswer;
      setDue(answer?.due ?? []);
      setNextAt(answer?.next_at ?? null);
    } catch {
      // the bell and Today say a failed read in their own words; the alert just stays as it was
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    return onRefetch(() => void load());
  }, [load]);

  // One timer, at the next reminder's time (or a short wait for the job that tells it). Set again after every read.
  useEffect(() => {
    const wait = alertDelay(nextAt, new Date());
    if (wait === null) return;
    const timer = setTimeout(() => void load(), Math.min(wait, LONGEST_WAIT_MS));
    return () => clearTimeout(timer);
  }, [nextAt, load]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REALTIME !== '1') return;
    const channel = browserDb()
      .channel(`reminder-alert:${me.person.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'notify', table: 'notification', filter: `person_id=eq.${me.person.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
    };
  }, [me.person.id, load]);

  // The browser notification: once per reminder id, only when allowed and the tab is not the one being looked at.
  useEffect(() => {
    const fresh = unannounced(due, seen.current);
    for (const r of fresh) seen.current.add(r.id);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    for (const r of fresh) {
      try {
        const n = new Notification(t('pages.myDay.alert.title'), { body: r.text, tag: r.id, lang: locale });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // a browser that refuses (some phones only allow it through a service worker): the alert in the page stays
      }
    }
  }, [due, locale, t]);

  const first = due[0];
  if (!first) return null;

  const fail = (e: unknown) => {
    const { key, detail } = errorKey(e, (k) => t.has(k));
    toast.failed(t(key, { detail }));
  };
  const done = async () => {
    setBusy(true);
    try {
      await rpc('notifications_mark_read', { p_ids: [first.notification_id] });
      refetchAll();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };
  const snooze = async (when: When) => {
    setBusy(true);
    await command(
      words(t('pages.myDay.alert.snoozed', { when: whenLine(when, locale) })),
      () => rpc('reminder_move', { p_id: first.id, p_at: snoozeInstant(when) }) as Promise<{ request_id?: string }>,
    );
    setBusy(false);
  };
  const choices = snoozeChoices(new Date());

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(var(--topbar-h)+8px)] z-40 rounded-lg border border-border bg-raised p-4 text-text shadow-2 sm:inset-x-auto sm:end-6 sm:w-[380px]"
      data-reminder-alert
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-pill bg-accent-soft text-muted" aria-hidden="true">
          <Clock className="size-4" />
        </span>
        <span className="text-base font-semibold">{t('pages.myDay.alert.title')}</span>
        {due.length > 1 ? (
          <span className="text-sm text-muted" data-alert-more>
            +{due.length - 1}
          </span>
        ) : null}
        <span className="ms-auto text-sm text-muted">{t('pages.myDay.alert.now')}</span>
      </div>
      <Link
        href={noteRoute(first.note_id)}
        className="mt-3 block min-h-11 break-words text-base leading-snug hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        data-alert-text
      >
        {first.text}
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Check />} onClick={() => void done()} disabled={busy} data-alert-done>
          {t('pages.myDay.alert.done')}
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button disabled={busy} data-alert-snooze>
              {t('pages.myDay.alert.snooze')}
              <ChevronDown />
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            {choices.map(({ key, when }) => (
              <MenuItem key={key} className="h-11" onSelect={() => void snooze(when)} data-alert-snooze-to={key}>
                {(key === 'tomorrow' ? tomorrowDayName(new Date(), locale) : null) ??
                  t(`pages.myDay.quick.whenChips.${key}`)}{' '}
                · {whenLine(when, locale)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
