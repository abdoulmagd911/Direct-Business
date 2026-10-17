import type { Notification } from '@/core/notify/useNotifications';

/** Columns that say how a row is kept, not what a person changed: never named in the bell. */
const BOOKKEEPING = new Set([
  'id',
  'entity',
  'entity_table',
  'happened_on',
  'kind',
  'body',
  'version',
  'created_at',
  'updated_at',
  'deleted_at',
  'deleted_by',
  'created_by',
  'raw',
]);

type Say = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };

/** A field's word; one the catalogue lacks is its name read plainly ("owner_id" is "Owner"). */
const fieldWord = (f: string, t: Say) => {
  if (t.has(`activity.fields.${f}`)) return t(`activity.fields.${f}`);
  const plain = f.replace(/_id$/, '').replace(/_/g, ' ');
  return plain.charAt(0).toUpperCase() + plain.slice(1);
};

/**
 * One bell line, in words (QA-577): "<who> changed <what> on <record>", naming what a person changed (a field's word, else
 * its name read plainly) and never a bookkeeping column. With none named, a change reads "<who> edited <the record's name>", or "edited a note".
 */
export function bellLine(n: Notification, t: Say, locale: 'en' | 'ar'): string {
  const actor = (locale === 'ar' ? n.actor_name_ar : n.actor_name_en) ?? n.actor_name_en ?? '';
  const kindWord = n.entity && t.has(`entity.${n.entity}`) ? t(`entity.${n.entity}`) : (n.entity ?? '');
  const title = (locale === 'ar' ? n.title_ar : n.title) ?? n.title ?? null;
  const named = (n.fields ?? []).filter((f) => !BOOKKEEPING.has(f)).map((f) => fieldWord(f, t));
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
