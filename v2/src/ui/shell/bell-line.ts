import type { Notification } from '@/core/notify/useNotifications';

type Say = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };

/**
 * One bell line, in words (QA-577): "<who> changed <what> on <record>" naming only fields the app has a word for — a
 * column name is never shown. With none named, a change reads "<who> edited <the record's name>", or "edited a note".
 */
export function bellLine(n: Notification, t: Say, locale: 'en' | 'ar'): string {
  const actor = (locale === 'ar' ? n.actor_name_ar : n.actor_name_en) ?? n.actor_name_en ?? '';
  const kindWord = n.entity && t.has(`entity.${n.entity}`) ? t(`entity.${n.entity}`) : (n.entity ?? '');
  const title = (locale === 'ar' ? n.title_ar : n.title) ?? n.title ?? null;
  const named = (n.fields ?? []).filter((f) => t.has(`activity.fields.${f}`)).map((f) => t(`activity.fields.${f}`));
  const changed = n.kind === 'changed_by_other' || n.kind === 'followed_change';
  if (changed && !named.length) {
    return title
      ? t('notifications.editedRecord', { actor, record: title })
      : t('notifications.editedKind', { actor, kind: kindWord.toLocaleLowerCase(locale) });
  }
  const what = named.length ? named.join(', ') : t('notifications.someDetails');
  const record = title ?? kindWord;
  const key = `notifications.kinds.${n.kind}`;
  return t.has(key) ? t(key, { actor, what, record }) : t('notifications.kinds.other', { actor, record });
}
