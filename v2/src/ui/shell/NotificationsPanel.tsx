'use client';
import * as RD from '@radix-ui/react-dialog';
import { Check, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { errorKey } from '@/core/db/words';
import { formatDate } from '@/core/i18n/format';
import { NOTIFICATION_TABS, type Notification, type NotificationTab } from '@/core/notify/useNotifications';
import { snoozeForAWeek, snoozeUntilTomorrow, tomorrowDayName, weekOutDay } from '@/modules/my-day/when';
import { Button } from '../Button';
import { cn } from '../cn';
import { DataState } from '../DataState';
import { Dialog } from '../Dialog';
import { entityRoute } from '../entity-route';
import { Field } from '../Field';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';
import { dueState, groupOf, recordName, riyadhDay } from './bell-words';
import { Tabs } from '../Tabs';
import { toast } from '../Toast';

const DAY_MS = 86_400_000;
const plusDays = (now: Date, n: number) => riyadhDay(new Date(now.getTime() + n * DAY_MS));

/**
 * The notification centre (§3.3, V61, artboard 8): a sheet at the inline end, 480 px (full screen on a phone), tabs
 * All · Mentions · Assigned to me, the items by Today / Yesterday / Earlier with an unread dot, each a link to its
 * record where the record has a page; Mark all read; Snooze until tomorrow 08:00, a week, or a date. Escape closes it
 * and focus returns to the bell (Radix).
 */
export function NotificationsPanel({
  open,
  onOpenChange,
  tab,
  onTabChange,
  items,
  tabUnread,
  failed,
  reload,
  markRead,
  snooze,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tab: NotificationTab;
  onTabChange: (t: NotificationTab) => void;
  items: Notification[] | null;
  /** Unread per tab, from the rows the list shows (null until read): each tab says its own number. */
  tabUnread: (k: NotificationTab) => number | null;
  failed: boolean;
  reload: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  snooze: (ids: string[], until: Date) => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [picking, setPicking] = useState<string | null>(null);
  const [day, setDay] = useState('');
  const fail = (e: unknown) => {
    const { key, detail } = errorKey(e, (k) => t.has(k));
    toast.failed(t(key, { detail }));
  };
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      fail(e);
    }
  };
  // One plain pattern: "<who> changed <what> on <record>". The record is its name for a reader who may see it (the
  // server sends none otherwise, QA-553), else the kind's word; what changed is the fields' words, never their values.
  const fieldWord = (f: string) => {
    if (t.has(`activity.fields.${f}`)) return t(`activity.fields.${f}`);
    const plain = f.replace(/_id$/, '').replace(/_/g, ' ');
    return plain.charAt(0).toUpperCase() + plain.slice(1);
  };
  const wordsOf = (n: Notification, now: Date) => {
    const actor = (locale === 'ar' ? n.actor_name_ar : n.actor_name_en) ?? n.actor_name_en ?? '';
    const kindWord = n.entity && t.has(`entity.${n.entity}`) ? t(`entity.${n.entity}`) : (n.entity ?? '');
    // the record's name: the server's, else the one the notice's label carries (a note's line, a task's title), else the kind's word
    const record = recordName(n, locale, kindWord);
    const what = n.fields?.length ? n.fields.map(fieldWord).join(', ') : t('notifications.someDetails');
    // a notice whose label has words of its own: a note shared by name (it rides the note-mention kind and its
    // setting), and the due alert's second notice once the day has passed (D, 26 Oct)
    const byLabel: Record<string, string> = {
      'notify.note_shared': 'notifications.kinds.note_shared',
      'alert.overdue': 'notifications.kinds.alert_overdue',
    };
    // a due-date notice says where its day stands now: overdue, due today, or coming due
    const due = dueState(n, now);
    const key =
      (n.label_key && byLabel[n.label_key]) ||
      (due && due !== 'coming' ? `notifications.kinds.due_${due}` : `notifications.kinds.${n.kind}`);
    return t.has(key) ? t(key, { actor, what, record }) : t('notifications.kinds.other', { actor, record });
  };
  const detailOf = (n: Notification) =>
    n.label_key && t.has(`activity.labels.${n.label_key}`)
      ? t(`activity.labels.${n.label_key}`, (n.label_args ?? {}) as Record<string, string | number>)
      : null;
  const openItem = async (n: Notification, href: string) => {
    if (!n.read_at) await act(() => markRead([n.id]));
    onOpenChange(false);
    router.push(href);
  };
  // the server's clock, as the gate read it for this page load: the day groups and the snooze days come from it
  const now = new Date(useMe().session.last_seen_at);
  const tomorrowName = tomorrowDayName(now, locale);
  const groups = (['today', 'yesterday', 'earlier'] as const)
    .map((g) => ({
      key: g,
      rows: (items ?? []).filter((n) => groupOf(n.created_at, now) === g),
    }))
    .map((g) => ({ ...g, unread: g.rows.filter((n) => !n.read_at).length }));
  const unreadShown = (items ?? []).filter((n) => !n.read_at).map((n) => n.id);
  const unreadHere = unreadShown.length > 0;

  return (
    <>
      <RD.Root open={open} onOpenChange={onOpenChange}>
        <RD.Portal>
          <RD.Overlay className="fixed inset-0 z-40 bg-scrim" />
          <RD.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => {
              // Focus goes back to the bell that opened the panel (M93), whatever had it inside.
              e.preventDefault();
              document.querySelector<HTMLElement>('[data-bell]')?.focus();
            }}
            className="fixed inset-y-0 end-0 z-50 flex w-[480px] max-w-full flex-col border-s border-border bg-raised text-text shadow-2 focus:outline-none"
            data-notifications-panel
          >
            <header className="border-b border-border px-5 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <RD.Title className="min-w-0 flex-1 truncate text-xl">{t('notifications.title')}</RD.Title>
                <Button
                  size="sm"
                  disabled={!unreadHere}
                  onClick={() => void act(() => markRead(unreadShown))}
                  data-notifications-mark-all
                >
                  {t('notifications.markAllRead')}
                </Button>
                <RD.Close asChild>
                  <IconButton label={t('common.close')} icon={<X />} size="sm" data-panel-close />
                </RD.Close>
              </div>
              {/* the tabs have the whole width of their own row: beside the two buttons a phone left them 164 px (QA-565) */}
              <Tabs
                fill
                className="mt-2"
                label={t('notifications.title')}
                value={tab}
                onValueChange={(v) => onTabChange(v as NotificationTab)}
                tabs={NOTIFICATION_TABS.map((k) => ({
                  value: k,
                  label: t(`notifications.tabs.${k}`),
                  count: tabUnread(k) || undefined,
                }))}
              />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {failed ? (
                <DataState kind="failed" what={t('notifications.title')} onRetry={() => void reload()} />
              ) : items === null ? (
                <DataState kind="loading" what={t('notifications.title')} />
              ) : items.length === 0 ? (
                <DataState kind="empty" what={t('notifications.title')} message={t('notifications.none')} />
              ) : (
                groups
                  .filter((g) => g.rows.length)
                  .map((g) => (
                    <section key={g.key} className="mb-2" data-notifications-group={g.key}>
                      <h3
                        className="flex items-baseline gap-2 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[.07em] text-muted"
                        data-notifications-group-head
                      >
                        <span>{t(`notifications.groups.${g.key}`)}</span>
                        {g.unread ? (
                          <span className="font-normal normal-case tracking-normal" data-notifications-group-unread>
                            {t('notifications.groupUnread', { count: g.unread })}
                          </span>
                        ) : null}
                      </h3>
                      <ul className="flex flex-col">
                        {g.rows.map((n) => {
                          const href = entityRoute(n.entity, n.entity_id);
                          const line = wordsOf(n, now);
                          const detail = detailOf(n);
                          return (
                            <li
                              key={n.id}
                              className={cn(
                                'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm',
                                !n.read_at && 'bg-accent-soft/40',
                              )}
                              data-notification={n.id}
                              data-unread={n.read_at ? undefined : ''}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'mt-1.5 size-2 shrink-0 rounded-pill',
                                  n.read_at ? 'bg-transparent' : 'bg-primary',
                                )}
                              />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                {href ? (
                                  <Link
                                    href={href}
                                    className="font-medium hover:underline"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      void openItem(n, href);
                                    }}
                                    data-notification-link
                                  >
                                    {line}
                                  </Link>
                                ) : (
                                  <span className="font-medium">{line}</span>
                                )}
                                <span className="text-xs text-muted">
                                  {[
                                    detail,
                                    formatDate(new Date(n.created_at), locale, {
                                      dateStyle: g.key === 'earlier' ? 'medium' : undefined,
                                      timeStyle: 'short',
                                    }),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </span>
                              {n.read_at ? null : (
                                <IconButton
                                  label={t('notifications.markRead')}
                                  icon={<Check />}
                                  size="sm"
                                  onClick={() => void act(() => markRead([n.id]))}
                                  data-notification-mark-read
                                />
                              )}
                              <Menu>
                                <MenuTrigger asChild>
                                  <IconButton
                                    label={t('notifications.snooze')}
                                    icon={<Clock />}
                                    size="sm"
                                    data-notification-snooze
                                  />
                                </MenuTrigger>
                                <MenuContent>
                                  <MenuItem onSelect={() => void act(() => snooze([n.id], snoozeUntilTomorrow(now)))}>
                                    {tomorrowName
                                      ? t('notifications.snoozeDay', { day: tomorrowName })
                                      : t('notifications.snoozeTomorrow')}
                                  </MenuItem>
                                  <MenuItem onSelect={() => void act(() => snooze([n.id], snoozeForAWeek(now)))}>
                                    {t('notifications.snoozeWeek', {
                                      when: formatDate(weekOutDay(riyadhDay(now)), locale, {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        year: undefined,
                                      }),
                                    })}
                                  </MenuItem>
                                  <MenuItem
                                    onSelect={() => {
                                      setDay('');
                                      setPicking(n.id);
                                    }}
                                  >
                                    {t('notifications.snoozeDate')}
                                  </MenuItem>
                                </MenuContent>
                              </Menu>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
              )}
            </div>
          </RD.Content>
        </RD.Portal>
      </RD.Root>
      <Dialog
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        title={t('notifications.snoozeUntil')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button onClick={() => setPicking(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!day}
              onClick={() => {
                const id = picking!;
                setPicking(null);
                void act(() => snooze([id], new Date(`${day}T08:00:00+03:00`)));
              }}
              data-notification-snooze-save
            >
              {t('notifications.snooze')}
            </Button>
          </>
        }
      >
        <Field label={t('notifications.snoozeUntil')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={day}
              min={plusDays(now, 1)}
              max={plusDays(now, 30)}
              onChange={(e) => setDay(e.target.value)}
              autoFocus
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
