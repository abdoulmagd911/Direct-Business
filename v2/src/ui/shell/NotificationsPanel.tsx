'use client';
import * as RD from '@radix-ui/react-dialog';
import { Clock, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { errorKey } from '@/core/db/words';
import { formatDate } from '@/core/i18n/format';
import { NOTIFICATION_TABS, type Notification, type NotificationTab } from '@/core/notify/useNotifications';
import { Button } from '../Button';
import { cn } from '../cn';
import { DataState } from '../DataState';
import { Dialog } from '../Dialog';
import { entityRoute } from '../entity-route';
import { Field } from '../Field';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';
import { Tabs } from '../Tabs';
import { toast } from '../Toast';

type Group = 'today' | 'yesterday' | 'earlier';

const DAY_MS = 86_400_000;
const riyadhDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
/** Today, yesterday and tomorrow are Riyadh days counted from the SERVER's clock (V40, QA-74): the browser's clock and zone decide nothing. */
const groupOf = (at: string, now: Date): Group => {
  const day = riyadhDay(new Date(at));
  const today = riyadhDay(now);
  const yesterday = riyadhDay(new Date(now.getTime() - DAY_MS));
  return day === today ? 'today' : day === yesterday ? 'yesterday' : 'earlier';
};
/** Tomorrow 08:00 Riyadh, as an instant. */
const tomorrowMorning = (now: Date) => new Date(new Date(`${riyadhDay(now)}T08:00:00+03:00`).getTime() + DAY_MS);
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
  const wordsOf = (n: Notification) => {
    const actor = (locale === 'ar' ? n.actor_name_ar : n.actor_name_en) ?? n.actor_name_en ?? '';
    const what = n.entity && t.has(`entity.${n.entity}`) ? t(`entity.${n.entity}`) : (n.entity ?? '');
    const key = `notifications.kinds.${n.kind}`;
    return t.has(key) ? t(key, { actor, what }) : t('notifications.kinds.other', { actor, what });
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
  const groups = (['today', 'yesterday', 'earlier'] as const).map((g) => ({
    key: g,
    rows: (items ?? []).filter((n) => groupOf(n.created_at, now) === g),
  }));
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
            <header className="flex items-start gap-3 border-b border-border px-5 pb-3 pt-4">
              <div className="min-w-0 flex-1">
                <RD.Title className="truncate text-xl">{t('notifications.title')}</RD.Title>
                <Tabs
                  className="mt-2"
                  label={t('notifications.title')}
                  value={tab}
                  onValueChange={(v) => onTabChange(v as NotificationTab)}
                  tabs={NOTIFICATION_TABS.map((k) => ({ value: k, label: t(`notifications.tabs.${k}`) }))}
                />
              </div>
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
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {failed ? (
                <DataState kind="failed" what={t('notifications.title')} onRetry={() => void reload()} />
              ) : items === null ? (
                <DataState kind="loading" what={t('notifications.title')} />
              ) : items.length === 0 ? (
                <DataState kind="empty" what={t('notifications.title')} />
              ) : (
                groups
                  .filter((g) => g.rows.length)
                  .map((g) => (
                    <section key={g.key} className="mb-2" data-notifications-group={g.key}>
                      <h3 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[.07em] text-muted">
                        {t(`notifications.groups.${g.key}`)}
                      </h3>
                      <ul className="flex flex-col">
                        {g.rows.map((n) => {
                          const href = entityRoute(n.entity, n.entity_id);
                          const line = wordsOf(n);
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
                              {!n.read_at ? <span className="sr-only">{t('notifications.unread')}</span> : null}
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
                                  <MenuItem onSelect={() => void act(() => snooze([n.id], tomorrowMorning(now)))}>
                                    {t('notifications.snoozeTomorrow')}
                                  </MenuItem>
                                  <MenuItem
                                    onSelect={() => {
                                      const d = tomorrowMorning(now);
                                      d.setDate(d.getDate() + 6);
                                      void act(() => snooze([n.id], d));
                                    }}
                                  >
                                    {t('notifications.snoozeWeek')}
                                  </MenuItem>
                                  <MenuItem
                                    onSelect={() => {
                                      setDay('');
                                      setPicking(n.id);
                                    }}
                                  >
                                    {t('notifications.snoozeDate')}
                                  </MenuItem>
                                  {!n.read_at ? (
                                    <MenuItem onSelect={() => void act(() => markRead([n.id]))} data-notification-read>
                                      {t('notifications.markRead')}
                                    </MenuItem>
                                  ) : null}
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
