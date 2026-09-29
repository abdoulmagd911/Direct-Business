'use client';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { entityRoute } from '@/ui/entity-route';
import type { AvatarPerson } from '@/ui/Avatar';

/** One row of api.recently_deleted (V401): a removed record the viewer may see, inside the restore window. */
export type DeletedRow = {
  entity: string;
  id: string;
  label: string | null;
  deleted_at: string;
  deleted_by: string | null;
  reason: string | null;
};

/**
 * Recently deleted (V401, V141): what the viewer may see, inside audit.recently_deleted_days; Restore brings a record
 * back as one logged request (api.restore), with Undo. Everyone reaches it from the profile menu (QA-71) — a member
 * restores their own saved view or note there; Activity shows the same list to those who may see Activity.
 */
export function RecentlyDeleted({ rows, people }: { rows: DeletedRow[]; people: Record<string, AvatarPerson> }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const whatOf = (d: DeletedRow) => {
    const kind = t.has(`entity.${d.entity}`) ? t(`entity.${d.entity}`) : d.entity;
    return d.label ? `${kind} · ${d.label}` : kind;
  };
  const restore = (d: DeletedRow) =>
    command(
      {
        done: t('activity.deleted.restored', { what: whatOf(d) }),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k) => t.has(k),
        failed: (k, detail) => t(k, { detail }),
      },
      () => rpc('restore', { p_entity: d.entity, p_id: d.id }) as Promise<{ request_id?: string | null } | null>,
      { after: () => router.refresh() },
    );
  return (
    <section className="rounded-lg border border-border bg-raised" data-activity-deleted>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((d) => {
            const href = entityRoute(d.entity, d.id);
            return (
              <li
                key={`${d.entity}:${d.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                data-deleted-row={d.id}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {whatOf(d)}
                      </Link>
                    ) : (
                      whatOf(d)
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {[
                      d.deleted_by && people[d.deleted_by] ? people[d.deleted_by]!.displayName : null,
                      formatDate(new Date(d.deleted_at), locale, { dateStyle: 'medium', timeStyle: 'short' }),
                      d.reason,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Button size="xs" onClick={() => void restore(d)} data-deleted-restore>
                  {t('activity.deleted.restore')}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState kind="empty" message={t('activity.deleted.none')} />
      )}
    </section>
  );
}
