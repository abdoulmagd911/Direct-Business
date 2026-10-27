'use client';
import {
  Bell,
  CheckSquare,
  Lock,
  StickyNote,
  Users,
  Globe,
  CalendarClock,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import { cn } from '@/ui/cn';
import { cardCount, linkRoute, noteRoute, noteTitle } from '../logic';
import { tradeName } from '@/modules/partners/types';
import type { FromNote, MyNote, NoteKind, NoteLink, Visibility } from '../types';

export const KIND_ICON: Record<NoteKind, LucideIcon> = {
  sticky: StickyNote,
  meeting: CalendarClock,
  checklist: CheckSquare,
};
/** The icon of what a note was captured as (V641). */
export const CAPTURE_ICON: Record<NonNullable<MyNote['capture_kind']>, LucideIcon> = {
  note: StickyNote,
  idea: Lightbulb,
  checklist: CheckSquare,
  reminder: Bell,
  meeting: CalendarClock,
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
export function LinkChip({ link }: { link: NoteLink }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const name = (locale === 'ar' && link.partner_name_ar) || link.partner_name_en || '';
  const type =
    link.entity === 'achievement'
      ? t('pages.myDay.turn.kinds.achievement')
      : (locale === 'ar' && link.type_ar) || link.type_en || t('pages.myDay.turn.kinds.activity');
  const label =
    link.entity === 'action_item' && link.number
      ? t('pages.myDay.note.linkActionItem', { number: link.number, text: link.text ?? '' })
      : link.entity === 'task' && link.number
        ? t('pages.myDay.note.linkTask', { number: link.number, title: link.title ?? '' })
        : link.entity === 'reminder' && link.remind_at
          ? t('pages.myDay.note.linkReminder', {
              when: formatDate(link.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
            })
          : name
            ? t('pages.myDay.note.linkActivity', { type, name })
            : type;
  const route = linkRoute(link);
  // a long title never widens the note page on a phone (K, 26 Oct): the chip is at most its row, its words cut short
  const cls = cn(chipClass, 'max-w-full border-accent/40 text-text');
  const words = <span className="min-w-0 truncate">{label}</span>;
  return route ? (
    <Link
      href={route}
      className={cn(cls, 'hover:bg-accent-soft')}
      title={label}
      data-turned-into={link.entity}
      data-link-id={link.id}
    >
      {words}
    </Link>
  ) : (
    <span className={cls} title={label} data-turned-into={link.entity} data-link-id={link.id}>
      {words}
    </span>
  );
}

/** The "from note" chip on a record made from a note; it opens the note (spec §3.3a — hidden when the reader may not see it). */
export function FromNoteChip({ note }: { note: Pick<FromNote, 'id' | 'title'> }) {
  const t = useTranslations();
  return (
    <Link
      href={noteRoute(note.id)}
      className={cn(chipClass, 'border-accent/40 text-text hover:bg-accent-soft')}
      data-from-note={note.id}
    >
      <StickyNote aria-hidden="true" />
      {t('pages.myDay.note.fromNote')}
      {note.title ? <span className="max-w-48 truncate font-normal text-muted">· {note.title}</span> : null}
    </Link>
  );
}

/** One note in a block: its kind, line, count, organisation and chips; the whole row opens the note. */
export function NoteRow({ note, author }: { note: MyNote; author?: string }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const captured = note.capture_kind ?? (note.kind === 'sticky' ? 'note' : note.kind);
  const Icon = CAPTURE_ICON[captured];
  const title = noteTitle(note) || t('pages.myDay.note.untitled');
  const count = note.kind === 'checklist' ? cardCount(note) : null;
  const org = note.meeting_partner;
  return (
    <li
      className="flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
      data-my-note={note.id}
      data-note-kind={note.kind}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link
            href={noteRoute(note.id)}
            className="min-w-11 truncate font-medium hover:underline sm:min-w-0"
            data-note-open
          >
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
          <span className={chipClass} data-note-captured-as={captured}>
            {t(`pages.myDay.quick.kinds.${captured}`)}
          </span>
          <VisibilityChip visibility={note.visibility} />
          {org ? <span className={chipClass}>{tradeName(org, locale)}</span> : null}
          {note.kind === 'meeting' ? (
            <span className={chipClass} data-meeting-state>
              {note.finished_at
                ? t('pages.myDay.note.logged', { date: formatDate(note.finished_at, locale, { dateStyle: 'medium' }) })
                : t('pages.myDay.note.draft')}
            </span>
          ) : null}
          {note.links.length ? <span className="text-xs text-muted">{t('pages.myDay.note.turnedInto')}</span> : null}
          {note.links.map((l) => (
            <LinkChip key={`${l.entity}-${l.id}`} link={l} />
          ))}
        </span>
      </div>
      <span className="shrink-0 font-data text-xs whitespace-nowrap text-muted">
        {formatDate(note.happened_on, locale, { day: 'numeric', month: 'short' })}
      </span>
    </li>
  );
}
