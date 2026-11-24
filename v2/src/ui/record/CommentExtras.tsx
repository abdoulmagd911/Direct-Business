'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { rpc } from '@/core/db/rpc';
import { EntityLink, type EntityKind } from '@/ui/EntityLink';
import { cn } from '@/ui/cn';

/** A record a comment is about (Landing 33, B1). `hidden` is all a reader gets of a record they may not see. */
export type CommentLink =
  | { kind: LinkKind; id: string; number: string | null; label: string | null; label_ar: string | null; hidden?: false }
  | { kind: LinkKind; hidden: true };
export type LinkKind = 'partner' | 'project' | 'invoice' | 'code';
/** A person a comment mentions (Landing 33, B2). */
export type CommentMention = { id: string; name: string | null; name_ar: string | null };

/** What the composer holds before the comment is sent. */
export type PickedLink = { kind: LinkKind; id: string; label: string };
export type PickedPerson = { id: string; name: string };

/** Where a linked record opens. A project opens its tasks; an invoice opens Finance (it has no page of its own). */
export function commentLinkHref(l: { kind: LinkKind; id: string }): string {
  if (l.kind === 'partner') return `/partners/${l.id}`;
  if (l.kind === 'project') return `/tasks?project=${l.id}`;
  if (l.kind === 'code') return `/codes?code=${l.id}`;
  return '/finance';
}

const ENTITY: Record<LinkKind, EntityKind> = {
  partner: 'partner',
  project: 'project',
  invoice: 'invoice',
  code: 'report',
};

/** A comment's linked records, as chips: each opens its record in one tap. */
export function CommentLinks({ links, locale }: { links: CommentLink[] | undefined; locale: 'en' | 'ar' }) {
  const t = useTranslations();
  if (!links?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-comment-links>
      {links.map((l, i) =>
        l.hidden ? (
          <li
            key={`h${i}`}
            className="inline-flex min-h-[30px] items-center text-sm text-muted"
            data-comment-link-hidden
          >
            {t('record.comments.linkHidden')}
          </li>
        ) : (
          <li key={`${l.kind}-${l.id}`} className="max-sm:[&>a]:min-h-11" data-comment-link={l.kind}>
            <EntityLink kind={ENTITY[l.kind]} variant="chip" href={commentLinkHref(l)}>
              <span className="text-muted">{t(`record.comments.linkKind.${l.kind}`)}</span>
              <bdi className="max-w-[16rem] truncate">{(locale === 'ar' ? l.label_ar : null) ?? l.label ?? ''}</bdi>
            </EntityLink>
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * A comment's words, with each "@Name" of a mentioned person as a link to that person. Names are matched longest
 * first, in both languages, so "@Sara Ali" is not cut at "@Sara".
 */
export function CommentBody({ body, mentions }: { body: string; mentions: CommentMention[] | undefined }) {
  const parts = useMemo(() => splitMentions(body, mentions ?? []), [body, mentions]);
  return (
    <p className="whitespace-pre-wrap break-words text-base" dir="auto" data-comment-body>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <Link key={i} href={`/people/${p.id}`} className="font-medium text-link hover:underline" data-mention={p.id}>
            {p.text}
          </Link>
        ),
      )}
    </p>
  );
}

export function splitMentions(body: string, mentions: CommentMention[]): (string | { id: string; text: string })[] {
  const names = mentions
    .flatMap((m) => [m.name, m.name_ar].filter((n): n is string => !!n).map((n) => ({ id: m.id, text: `@${n}` })))
    .sort((a, b) => b.text.length - a.text.length);
  if (!names.length) return [body];
  const out: (string | { id: string; text: string })[] = [];
  let rest = body;
  while (rest.length) {
    let at = -1;
    let hit: { id: string; text: string } | null = null;
    for (const n of names) {
      const i = rest.indexOf(n.text);
      if (i !== -1 && (at === -1 || i < at)) {
        at = i;
        hit = n;
      }
    }
    if (!hit) {
      out.push(rest);
      break;
    }
    if (at > 0) out.push(rest.slice(0, at));
    out.push(hit);
    rest = rest.slice(at + hit.text.length);
  }
  return out;
}

/**
 * The "@query" being typed at the caret, or null: an @ at the start or after a space, then up to 40 characters with no
 * line break. Landing 47: an "@Name" already picked (`picked`) is a finished mention, not a query — the words typed
 * after it are the comment, and they open no list.
 */
export function mentionQuery(
  text: string,
  caret: number,
  picked: readonly string[] = [],
): { from: number; term: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const term = before.slice(at + 1);
  if (term.length > 40 || /[\n@]/.test(term)) return null;
  if (picked.some((name) => !!name && term.startsWith(name))) return null;
  return { from: at, term };
}

/** How many people a bare "@" lists at most (the list scrolls). */
export const ROSTER_MAX = 50;

/**
 * Landing 47: the people a bare "@" offers at once, before two letters have been typed — the record's own people
 * (whoever may be asked on it), never the reader, by name. With one letter typed, those with a name part that starts
 * with it. Two letters and more go to the app's one search, as before. A term that holds a space is not a name being
 * started ("see you @ 5"), so it offers nobody.
 */
export function rosterMatches(
  roster: readonly { id: string; name: string }[] | undefined,
  term: string | null,
  meId: string,
): Suggestion[] {
  if (term === null || term.length >= 2 || /\s/.test(term) || !roster?.length) return [];
  const fold = term.toLocaleLowerCase();
  return roster
    .filter((p) => p.id !== meId && !!p.name.trim())
    .filter(
      (p) =>
        !fold ||
        p.name
          .toLocaleLowerCase()
          .split(/\s+/)
          .some((w) => w.startsWith(fold)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, ROSTER_MAX)
    .map((p) => ({ type: 'person' as const, id: p.id, label: p.name, alt: null }));
}

export type Suggestion =
  | { type: 'person'; id: string; label: string; alt: string | null }
  | { type: 'link'; kind: LinkKind; id: string; label: string; note: string | null };

type SearchAnswer = {
  people?: { id: string; full_name_en: string; full_name_ar: string | null }[];
  partners?: { id: string; number: string; trade_name_en: string; trade_name_ar: string | null }[];
  codes?: { id: string; code: string }[];
  invoices?: { invoice_id: string; ref: string; customer_name: string | null }[];
};

/**
 * What to offer for a typed term: people first (a mention), then the records the reader may see — partners, the
 * record's projects, discount codes and invoices (a link). People and records come from the app's one search, which
 * matches English and Arabic names alike; projects are matched here, from the list the record hands in.
 */
export function useSuggestions(
  term: string | null,
  opts: {
    locale: 'en' | 'ar';
    meId: string;
    projects?: { id: string; name: string; number?: string | null }[];
    people: boolean;
    /** The record's own people: what a bare "@" lists before the search has two letters to go on (Landing 47). */
    roster?: { id: string; name: string }[];
  },
): { items: Suggestion[]; busy: boolean } {
  const [found, setFound] = useState<{ term: string; items: Suggestion[] }>({ term: '', items: [] });
  const { locale, meId, projects, people, roster } = opts;
  const q = term?.trim() ?? '';
  const early = useMemo(() => (people ? rosterMatches(roster, term, meId) : []), [people, roster, term, meId]);
  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      rpc('search', { p_q: q, p_limit: 8 })
        .then((a) => {
          if (!live) return;
          const r = (a ?? {}) as SearchAnswer;
          const fold = q.toLocaleLowerCase();
          const items: Suggestion[] = [
            ...(people ? (r.people ?? []) : [])
              .filter((p) => p.id !== meId)
              .map((p) => ({
                type: 'person' as const,
                id: p.id,
                label: locale === 'ar' && p.full_name_ar ? p.full_name_ar : p.full_name_en,
                alt: locale === 'ar' ? p.full_name_en : p.full_name_ar,
              })),
            ...(r.partners ?? []).map((p) => ({
              type: 'link' as const,
              kind: 'partner' as const,
              id: p.id,
              label: locale === 'ar' && p.trade_name_ar ? p.trade_name_ar : p.trade_name_en,
              note: p.number,
            })),
            ...(projects ?? [])
              .filter((p) => `${p.name} ${p.number ?? ''}`.toLocaleLowerCase().includes(fold))
              .slice(0, 6)
              .map((p) => ({
                type: 'link' as const,
                kind: 'project' as const,
                id: p.id,
                label: p.name,
                note: p.number ?? null,
              })),
            ...(r.codes ?? []).map((c) => ({
              type: 'link' as const,
              kind: 'code' as const,
              id: c.id,
              label: c.code,
              note: null,
            })),
            ...(r.invoices ?? []).map((v) => ({
              type: 'link' as const,
              kind: 'invoice' as const,
              id: v.invoice_id,
              label: v.ref,
              note: v.customer_name,
            })),
          ];
          setFound({ term: q, items });
        })
        .catch(() => live && setFound({ term: q, items: [] }));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, locale, meId, projects, people]);
  if (q.length < 2) return { items: early, busy: false };
  return found.term === q ? { items: found.items, busy: false } : { items: [], busy: true };
}

/**
 * The list under the comment box: what "@…" (or the Link a record search) found. Arrow keys move, Enter picks,
 * Escape closes — the textarea keeps the focus, so typing carries on. Each row is 44 px tall on a phone.
 */
export function SuggestionList({
  items,
  busy,
  active,
  onPick,
  onHover,
  id,
}: {
  items: Suggestion[];
  busy: boolean;
  active: number;
  onPick: (s: Suggestion) => void;
  onHover: (i: number) => void;
  id: string;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  if (busy) {
    return (
      <p
        className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-muted"
        role="status"
        data-suggest-busy
      >
        {t('common.loading')}
      </p>
    );
  }
  if (!items.length) {
    return (
      <p className="rounded-md border border-border bg-raised px-3 py-2 text-sm text-muted" data-suggest-none>
        {t('record.comments.suggestNone')}
      </p>
    );
  }
  return (
    <ul
      ref={ref}
      id={id}
      role="listbox"
      aria-label={t('record.comments.suggestLabel')}
      className="max-h-64 overflow-y-auto rounded-md border border-border bg-raised py-1 shadow-2"
      data-suggest
    >
      {items.map((s, i) => (
        <li
          key={`${s.type}-${s.type === 'link' ? s.kind : ''}-${s.id}`}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          className={cn(
            'flex min-h-9 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm max-sm:min-h-11',
            i === active && 'bg-surface',
          )}
          // mousedown, not click: the textarea must not lose its focus (and its caret) to the list
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s);
          }}
          onMouseEnter={() => onHover(i)}
          data-suggest-item={s.type === 'person' ? 'person' : s.kind}
        >
          <span className="shrink-0 rounded-pill bg-surface px-2 text-xs text-muted">
            {t(s.type === 'person' ? 'record.comments.suggestPerson' : `record.comments.linkKind.${s.kind}`)}
          </span>
          <bdi className="min-w-0 truncate font-medium">{s.label}</bdi>
          {(s.type === 'person' ? s.alt : s.note) ? (
            <bdi className="min-w-0 truncate text-muted">{s.type === 'person' ? s.alt : s.note}</bdi>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The keys the list answers while it is open; returns true when the key was taken. */
export function suggestKey(
  e: KeyboardEvent,
  s: {
    open: boolean;
    count: number;
    active: number;
    setActive: (n: number) => void;
    pick: () => void;
    close: () => void;
  },
): boolean {
  if (!s.open) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!s.count) return false;
    e.preventDefault();
    s.setActive((s.active + (e.key === 'ArrowDown' ? 1 : s.count - 1)) % s.count);
    return true;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && s.count && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    s.pick();
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    s.close();
    return true;
  }
  return false;
}

/** The people and records a comment being written will carry, as chips with a remove button each. */
export function PickedChips({
  people,
  links,
  onRemovePerson,
  onRemoveLink,
}: {
  people: PickedPerson[];
  links: PickedLink[];
  onRemovePerson: (id: string) => void;
  onRemoveLink: (l: PickedLink) => void;
}) {
  const t = useTranslations();
  if (!people.length && !links.length) return null;
  const chip = (key: string, label: ReactNode, name: string, remove: () => void, data: Record<string, string>) => (
    <li
      key={key}
      className="inline-flex min-h-[30px] items-center gap-1 rounded-pill border border-border-strong bg-raised ps-3 text-sm"
      {...data}
    >
      {label}
      <button
        type="button"
        className="inline-flex size-[30px] items-center justify-center rounded-pill text-muted hover:bg-surface hover:text-text max-sm:size-11"
        aria-label={t('record.comments.removePicked', { name })}
        onClick={remove}
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-2" data-picked>
      {people.map((p) =>
        chip(
          `p-${p.id}`,
          <>
            <span className="text-muted">{t('record.comments.suggestPerson')}</span>
            <bdi className="max-w-[14rem] truncate font-medium">{p.name}</bdi>
          </>,
          p.name,
          () => onRemovePerson(p.id),
          { 'data-picked-person': p.id },
        ),
      )}
      {links.map((l) =>
        chip(
          `l-${l.kind}-${l.id}`,
          <>
            <span className="text-muted">{t(`record.comments.linkKind.${l.kind}`)}</span>
            <bdi className="max-w-[14rem] truncate font-medium">{l.label}</bdi>
          </>,
          l.label,
          () => onRemoveLink(l),
          { 'data-picked-link': l.kind },
        ),
      )}
    </ul>
  );
}
