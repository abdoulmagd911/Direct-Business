'use client';
import { CheckSquare, Lock, StickyNote, Users, Globe, CalendarClock, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import { cn } from '@/ui/cn';
import { checklistCount, linkRoute, noteRoute, noteTitle } from '../logic';
import { nameOf, tradeName, type ListEntry } from '@/modules/partners/types';
import type { FromNote, MyNote, NoteKind, PartnerRef, TurnedInto, Visibility } from '../types';

/** The names a note's chips say: its organisations and the activity types (one read each on the page). */
export type Names = { partners: Record<string, PartnerRef>; types: ListEntry[] };

export const KIND_ICON: Record<NoteKind, LucideIcon> = {
  sticky: StickyNote,
  meeting: CalendarClock,
  checklist: CheckSquare,
};
const VISIBILITY_ICON: Record<Visibility, LucideIcon> = { private: Lock, team: Users, workspace: Globe };

const chipClass =
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-pill border border-border px-2 text-xs font-medium text-muted [&_svg]:size-3';

/** Who sees a note: "Only me" for a private one (V454 — no admin override exists), "My team", "Everyone". */
export function VisibilityChip({ visibility }: { visibility: Visibility }) {
  const t = useTranslations();
  const Icon = VISIBILITY_ICON[visibility];
  return (
    <span className={chipClass} data-visibility={visibility}>
      <Icon aria-hidden="true" />
      {t(`pages.myDay.visibility.${visibility}`)}
    </span>
  );
}

/** A "turned into" chip: the record a note became, and a link to it where it has a page (V433 — both ways). */
export function LinkChip({ link, names }: { link: TurnedInto; names: Names }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const partner = link.partner_id ? names.partners[link.partner_id] : undefined;
  const type = nameOf(
    names.types.find((x) => x.key === link.type),
    locale,
  );
  const label =
    link.entity === 'reminder' && link.remind_at
      ? t('pages.myDay.note.linkReminder', {
          when: formatDate(link.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
        })
      : partner
        ? t('pages.myDay.note.linkActivity', {
            type: type || t('pages.myDay.turn.kinds.activity'),
            name: tradeName(partner, locale),
          })
        : type || t('pages.myDay.turn.kinds.activity');
  const route = linkRoute(link);
  const cls = cn(chipClass, 'border-accent/40 text-text');
  return route ? (
    <Link
      href={route}
      className={cn(cls, 'hover:bg-accent-soft')}
      data-turned-into={link.entity}
      data-link-id={link.id}
    >
      {label}
    </Link>
  ) : (
    <span className={cls} data-turned-into={link.entity} data-link-id={link.id}>
      {label}
    </span>
  );
}

/** The "from note" chip on a record made from a note; it opens the note (spec §3.3a — hidden when the reader may not see it). */
export function FromNoteChip({ note }: { note: Pick<FromNote, 'note_id' | 'title'> }) {
  const t = useTranslations();
  return (
    <Link
      href={noteRoute(note.note_id)}
      className={cn(chipClass, 'border-accent/40 text-text hover:bg-accent-soft')}
      data-from-note={note.note_id}
    >
      <StickyNote aria-hidden="true" />
      {t('pages.myDay.note.fromNote')}
      {note.title ? <span className="max-w-48 truncate font-normal text-muted">· {note.title}</span> : null}
    </Link>
  );
}

/** One note in a block: its kind, line, count, organisation and chips; the whole row opens the note. */
export function NoteRow({ note, author, names }: { note: MyNote; author?: string; names: Names }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const Icon = KIND_ICON[note.kind];
  const title = noteTitle(note) || t('pages.myDay.note.untitled');
  const count = note.kind === 'checklist' ? checklistCount(note) : null;
  const org = note.meeting_partner_id ? names.partners[note.meeting_partner_id] : undefined;
  return (
    <li className="flex min-h-14 items-start gap-3 py-3" data-my-note={note.id} data-note-kind={note.kind}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link href={noteRoute(note.id)} className="min-w-0 truncate font-medium hover:underline" data-note-open>
            {title}
          </Link>
          {count && count.total ? (
            <span className="font-data text-xs text-muted" data-note-count>
              {count.done}/{count.total}
            </span>
          ) : null}
          {author ? <span className="text-xs text-muted">{t('pages.myDay.note.by', { name: author })}</span> : null}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <VisibilityChip visibility={note.visibility} />
          {org ? <span className={chipClass}>{tradeName(org, locale)}</span> : null}
          {note.kind === 'meeting' ? (
            <span className={chipClass} data-meeting-state>
              {note.finished_at
                ? t('pages.myDay.note.logged', { date: formatDate(note.finished_at, locale, { dateStyle: 'medium' }) })
                : t('pages.myDay.note.draft')}
            </span>
          ) : null}
          {note.turned_into.length ? (
            <span className="text-xs text-muted">{t('pages.myDay.note.turnedInto')}</span>
          ) : null}
          {note.turned_into.map((l) => (
            <LinkChip key={`${l.entity}-${l.id}`} link={l} names={names} />
          ))}
        </span>
      </div>
      <span className="shrink-0 font-data text-xs whitespace-nowrap text-muted">
        {formatDate(note.happened_on, locale, { day: 'numeric', month: 'short' })}
      </span>
    </li>
  );
}
