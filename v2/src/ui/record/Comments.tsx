'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { recordFileDownloadUrl } from '@/core/files/download-url';
import { formatDate } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { useCommandWords } from './words';
import {
  CommentBody,
  CommentLinks,
  PickedChips,
  SuggestionList,
  mentionQuery,
  suggestKey,
  useSuggestions,
  type CommentLink,
  type CommentMention,
  type PickedLink,
  type PickedPerson,
  type Suggestion,
} from './CommentExtras';
import { formatFileSize, type RecordFile } from './FilesSection';
import { FileLinkButton } from './FileLinkButton';

export const COMMENT_MAX = 4000;

/** One comment on a record, as api.comments serves it: the spec's fields, and the names the screen shows without a lookup. */
export type RecordComment = {
  id: string;
  author_id: string;
  author_name: string;
  author_name_ar: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  edited: boolean;
  version: number;
  asked_to: string | null;
  asked_to_name: string | null;
  asked_to_name_ar: string | null;
  question_open: boolean;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  answered_by_name: string | null;
  answered_by_name_ar: string | null;
  mine: boolean;
  can_edit: boolean;
  can_remove: boolean;
  /** Landing 33: THE decision of the record (one at most), who marked it and when. */
  is_decision?: boolean;
  decided_at?: string | null;
  decided_by?: string | null;
  decided_by_name?: string | null;
  decided_by_name_ar?: string | null;
  /** Landing 33: the records this comment is about, as the reader may see them. */
  links?: CommentLink[];
  /** Landing 33: the people this comment mentions. */
  mentions?: CommentMention[];
};

/** api.comments(entity, id): a record's comments, oldest first (newest last), and whether the reader may write one. */
export type RecordComments = {
  read_at: string;
  can_write: boolean;
  /** Landing 33: whether the reader may mark (or unmark) the decision. */
  can_decide?: boolean;
  comments: RecordComment[];
};

type Filter = 'all' | 'files' | 'questions';

/**
 * A record's Discussion (Phase 2, the generic form of the task comments, V657): plain text with line breaks, oldest
 * first — a discussion reads in order — each with its author and its time (24-hour), and an "edited" flag. A "Jump to
 * latest" link and a count of what arrived since the record was first read. A box at the bottom for whoever may write;
 * everyone else who sees the record reads only. The author edits and deletes their own; an admin deletes (never
 * edits). Every write has its toast with Undo (D7). A question is a comment asked of one person: only their explicit
 * reply closes it, and a casual comment of theirs does not. File entries join the stream (Phase 4): each file the
 * record holds shows as one entry with a download link, in time order among the comments; the Files filter shows
 * them alone.
 *
 * Landing 33 (B1, B2): one comment may be marked THE DECISION — it is pinned above the stream, so the answer is never
 * buried; marking another moves the mark. A comment may link to the records it is about (a partner, a project, an
 * invoice, a discount code), each a chip that opens the record. Typing "@" offers people and records: a person picked
 * is mentioned and told (on a task they also become a helper — `mentionNote` says so under the box); a record picked
 * is linked.
 */
export function Comments({
  entity,
  id,
  data,
  locale,
  personName,
  people,
  label,
  onCount,
  files,
  onFilesRetry,
  initialFilter,
  projects,
  mentionNote,
}: {
  entity: string;
  id: string;
  data: RecordComments;
  locale: 'en' | 'ar';
  /** The current person's display name, for the optimistic local row. */
  personName: string;
  /** The people who may be asked, named in the language on screen; absent where a record has none to offer. */
  people?: { id: string; name: string }[];
  /** The section's label (the tab's name where there is one). */
  label?: string;
  /** How many comments the screen shows now, so the tab's number follows an add or a delete at once. */
  onCount?: (n: number | null) => void;
  /** The record's files, merged into the stream as entries; null when the files read failed; absent where the
   *  record has no files read (the stream then shows comments only, as before). */
  files?: RecordFile[] | null;
  /** Try the files read again, after it failed. */
  onFilesRetry?: () => void;
  /** The filter the stream opens on — the record header's counts link here with it. */
  initialFilter?: Filter;
  /** Projects that "@" may link (the app's search has none); absent where a record offers none. */
  projects?: { id: string; name: string; number?: string | null }[];
  /** A line under the box saying what a mention does on this record (a task: the person becomes a helper). */
  mentionNote?: string;
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const suggestId = useId();
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState('');
  // What the comment being written will carry: the people it mentions and the records it links.
  const [pickedPeople, setPickedPeople] = useState<PickedPerson[]>([]);
  const [pickedLinks, setPickedLinks] = useState<PickedLink[]>([]);
  // The "@…" being typed (from the caret), or the Link a record search; null when neither is open.
  const [at, setAt] = useState<{ from: number; term: string } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [deciding, setDeciding] = useState<string | null>(null);
  // A mark shown ahead of the re-read: the id marked, or '' when the mark was taken off.
  const [markedNow, setMarkedNow] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<RecordComment | null>(null);
  // What this person just did shows at once, before the server's re-read arrives (it takes a moment): a comment added,
  // one removed, new words, an answer. The re-read replaces all of it, and Undo takes it back.
  const [added, setAdded] = useState<RecordComment[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [newWords, setNewWords] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Record<string, { answer: string; answered_by: string; answered_at: string }>>(
    {},
  );
  const [mode, setMode] = useState<'comment' | 'ask'>('comment');
  const [askedTo, setAskedTo] = useState<string | undefined>();
  const [askError, setAskError] = useState<string | undefined>();
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [answerError, setAnswerError] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>(initialFilter ?? 'all');
  // The header's counts link lands here with a filter; a later tap on a count switches it again — the same
  // render-time adjustment the list below uses for a newer read, so no effect is needed.
  const [linkedFilter, setLinkedFilter] = useState(initialFilter);
  if (initialFilter !== linkedFilter) {
    setLinkedFilter(initialFilter);
    setFilter(initialFilter ?? 'all');
  }
  // The newest read of the list wins, whichever way it came: the page's own re-read (it can be late, and then older than
  // the read made right after a write) or the read this screen makes itself after each write and Undo. A late, older
  // read never puts the list back; what shows ahead of a read (below) is dropped when a newer read arrives.
  const [mine, setMine] = useState<RecordComments | null>(null);
  const newer = (a: RecordComments, b: RecordComments) => (a.read_at > b.read_at ? a : b);
  const list = mine ? newer(mine, data) : data;
  const [seen, setSeen] = useState(list);
  if (seen !== list) {
    setSeen(list);
    setAdded([]);
    setGone([]);
    setNewWords({});
    setClosed({});
    setMarkedNow(null);
  }
  // The read_at of the first read of this record: a comment written after it is new here. State, not a ref: it is
  // read during render, and it never moves after the first read.
  const [firstReadAt] = useState(list.read_at);
  const lastRef = useRef<HTMLLIElement | null>(null);
  const readAgain = async () => {
    try {
      setMine((await rpc('comments', { p_entity: entity, p_id: id })) as unknown as RecordComments);
    } catch {
      // the page's own re-read follows anyway
    }
  };
  const shown = useMemo(
    () =>
      [...list.comments, ...added.filter((a) => !list.comments.some((c) => c.id === a.id))]
        .filter((c) => !gone.includes(c.id))
        .map((c) => {
          const w = newWords[c.id];
          const a = closed[c.id];
          const d = markedNow === null ? undefined : markedNow === c.id;
          if (w === undefined && a === undefined && (d === undefined || d === !!c.is_decision)) return c;
          return {
            ...c,
            ...(d !== undefined && d !== !!c.is_decision
              ? {
                  is_decision: d,
                  decided_by: d ? me.person.id : null,
                  decided_by_name: d ? personName : null,
                  decided_by_name_ar: d ? personName : null,
                  decided_at: d ? new Date().toISOString() : null,
                }
              : null),
            ...(w !== undefined ? { body: w, edited_at: c.edited_at ?? 'now', edited: true } : null),
            ...(a !== undefined
              ? {
                  question_open: false,
                  answer: a.answer,
                  answered_at: a.answered_at,
                  answered_by: a.answered_by,
                  answered_by_name: personName,
                  answered_by_name_ar: personName,
                }
              : null),
          };
        }),
    [list, added, gone, newWords, closed, personName, markedNow, me.person.id],
  );
  // One stream, in time order: the comments and the record's file-addition entries together. A file entry names
  // its uploader, as the files list does (FIX-46), with a download link.
  type StreamEntry =
    { at: string; kind: 'comment'; comment: RecordComment } | { at: string; kind: 'file'; file: RecordFile };
  const entries = useMemo<StreamEntry[]>(
    () =>
      [
        ...shown.map((c) => ({ at: c.created_at, kind: 'comment' as const, comment: c })),
        ...(files ?? []).map((f) => ({ at: f.added_at, kind: 'file' as const, file: f })),
      ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)),
    [shown, files],
  );
  const visible = useMemo(() => {
    if (filter === 'questions') return entries.filter((e) => e.kind === 'comment' && e.comment.asked_to !== null);
    if (filter === 'files') return entries.filter((e) => e.kind === 'file');
    return entries;
  }, [entries, filter]);
  const counts = {
    all: entries.length,
    files: files?.length ?? 0,
    questions: shown.filter((c) => c.asked_to !== null).length,
  };
  const newCount = shown.filter((c) => c.created_at > firstReadAt).length;
  const decision = shown.find((c) => c.is_decision) ?? null;
  const decidedName = (c: RecordComment) =>
    (locale === 'ar' ? (c.decided_by_name_ar ?? c.decided_by_name) : c.decided_by_name) ?? '';
  const suggest = useSuggestions(linking !== null ? linking : (at?.term ?? null), {
    locale,
    meId: me.person.id,
    projects,
    people: linking === null,
    roster: people,
  });
  // Landing 47: a bare "@" opens the list too, with the record's people in it — it no longer waits for two letters
  const suggestOpen =
    linking !== null ? linking.trim().length >= 2 : !!at && (at.term.trim().length >= 2 || suggest.items.length > 0);
  const activeItem = suggest.items[Math.min(active, Math.max(0, suggest.items.length - 1))];
  const pick = (s: Suggestion | undefined) => {
    if (!s) return;
    const insert = s.type === 'person' ? `@${s.label} ` : `${s.label} `;
    if (s.type === 'person') {
      setPickedPeople((l) => (l.some((x) => x.id === s.id) ? l : [...l, { id: s.id, name: s.label }]));
    } else {
      setPickedLinks((l) =>
        l.some((x) => x.id === s.id && x.kind === s.kind) ? l : [...l, { kind: s.kind, id: s.id, label: s.label }],
      );
    }
    if (linking !== null) {
      setLinking(null);
    } else if (at) {
      const caret = boxRef.current?.selectionStart ?? text.length;
      const next = text.slice(0, at.from) + insert + text.slice(caret);
      const place = at.from + insert.length;
      setText(next);
      setAt(null);
      // the caret lands after what was inserted, once the new words are in the box
      requestAnimationFrame(() => {
        boxRef.current?.focus();
        boxRef.current?.setSelectionRange(place, place);
      });
    }
    setActive(0);
  };
  const decide = async (c: RecordComment, on: boolean) => {
    setDeciding(c.id);
    await command(
      words(t(on ? 'record.comments.decisionMarked' : 'record.comments.decisionUnmarked')),
      () => rpc('comment_decide', { p_id: c.id, p_on: on }) as Promise<{ request_id?: string | null }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setMarkedNow(on ? c.id : '');
        },
        afterUndo: () => {
          void readAgain();
          setMarkedNow(null);
        },
      },
    );
    setDeciding(null);
  };
  useEffect(() => {
    onCount?.(shown.length);
    return () => onCount?.(null);
  }, [shown.length, onCount]);
  const when = (iso: string) => formatDate(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
  const authorName = (c: RecordComment) => (locale === 'ar' ? (c.author_name_ar ?? c.author_name) : c.author_name);
  const askedName = (c: RecordComment) =>
    (locale === 'ar' ? (c.asked_to_name_ar ?? c.asked_to_name) : c.asked_to_name) ?? '';
  const answeredName = (c: RecordComment) =>
    (locale === 'ar' ? (c.answered_by_name_ar ?? c.answered_by_name) : c.answered_by_name) ?? '';
  const check = (v: string, required: string) => {
    if (!v.trim()) return required;
    if (v.trim().length > COMMENT_MAX) return t('record.comments.tooLong', { max: COMMENT_MAX });
    return undefined;
  };
  // Who may be asked: everyone offered, except me (the server refuses asking oneself too).
  const askable = useMemo(
    () =>
      (people ?? [])
        .filter((p) => p.id !== me.person.id)
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [people, me.person.id],
  );

  // Each write shows its effect at once (`after`) and takes it back when its Undo goes through (`afterUndo`); both
  // read the list again. The Undo touches only what the write changed — an editor opened since stays open.
  const add = async () => {
    const problem = check(text, t('record.comments.bodyRequired'));
    if (problem) return setError(problem);
    if (mode === 'ask' && !askedTo) return setAskError(t('record.comments.askedToRequired'));
    setBusy('add');
    const body = text.trim();
    const asked = mode === 'ask' ? (askedTo ?? null) : null;
    const askedLabel = askable.find((p) => p.value === asked)?.label ?? '';
    // a person whose "@Name" was deleted from the words again is not mentioned
    const sentPeople = pickedPeople.filter((p) => body.includes(`@${p.name}`));
    const sentLinks = pickedLinks;
    await command(
      words(mode === 'ask' ? t('record.comments.askAdded') : t('record.comments.added')),
      () =>
        rpc('comment_add', {
          p_entity: entity,
          p_id: id,
          p_body: body,
          p_asked_to: asked ?? undefined,
          ...(sentLinks.length ? { p_links: sentLinks.map((l) => ({ kind: l.kind, id: l.id })) } : {}),
          ...(sentPeople.length ? { p_mentions: sentPeople.map((p) => p.id) } : {}),
        }) as Promise<{
          id?: string;
          request_id?: string | null;
        }>,
      {
        undoDirect: true,
        after: (r) => {
          void readAgain();
          setText('');
          setAskedTo(undefined);
          setPickedPeople([]);
          setPickedLinks([]);
          setAt(null);
          setLinking(null);
          setAdded((a) => [
            ...a,
            {
              id: r?.id ?? '',
              body,
              author_id: me.person.id,
              author_name: personName,
              author_name_ar: personName,
              created_at: new Date().toISOString(),
              edited_at: null,
              edited: false,
              version: 1,
              mine: true,
              can_edit: true,
              can_remove: true,
              asked_to: asked,
              asked_to_name: askedLabel || null,
              asked_to_name_ar: askedLabel || null,
              question_open: asked !== null,
              answer: null,
              answered_at: null,
              answered_by: null,
              answered_by_name: null,
              answered_by_name_ar: null,
              is_decision: false,
              links: sentLinks.map((l) => ({ kind: l.kind, id: l.id, number: null, label: l.label, label_ar: null })),
              mentions: sentPeople.map((p) => ({ id: p.id, name: p.name, name_ar: p.name })),
            },
          ]);
        },
        afterUndo: (r) => {
          void readAgain();
          setAdded((a) => a.filter((x) => x.id !== (r?.id ?? '')));
        },
      },
    );
    setBusy(null);
  };
  const save = async (c: RecordComment) => {
    const problem = check(draft, t('record.comments.bodyRequired'));
    if (problem) return setError(problem);
    setBusy(c.id);
    const body = draft.trim();
    await command(
      words(t('record.comments.saved')),
      () =>
        rpc('comment_edit', { p_id: c.id, p_body: body, p_version: c.version }) as Promise<{
          request_id?: string | null;
        }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setEditing(null);
          setNewWords((w) => ({ ...w, [c.id]: body }));
        },
        afterUndo: () => {
          void readAgain();
          setNewWords((w) => {
            const rest = { ...w };
            delete rest[c.id];
            return rest;
          });
        },
      },
    );
    setBusy(null);
  };
  const remove = async (c: RecordComment) => {
    setBusy(c.id);
    await command(
      // A question is deleted as a question, not as a comment (F094).
      words(t(c.asked_to ? 'record.comments.removedQuestion' : 'record.comments.removed')),
      () => rpc('comment_remove', { p_id: c.id }) as Promise<{ request_id?: string | null }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setRemoving(null);
          setGone((g) => [...g, c.id]);
        },
        afterUndo: () => {
          void readAgain();
          setGone((g) => g.filter((x) => x !== c.id));
        },
      },
    );
    setBusy(null);
  };
  const answer = async (c: RecordComment) => {
    const problem = check(answerDraft, t('record.comments.answerRequired'));
    if (problem) return setAnswerError(problem);
    setBusy(c.id);
    const reply = answerDraft.trim();
    const at = new Date().toISOString();
    await command(
      words(t('record.comments.answered')),
      () => rpc('comment_answer', { p_id: c.id, p_answer: reply }) as Promise<{ request_id?: string | null }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setAnswering(null);
          setClosed((m) => ({ ...m, [c.id]: { answer: reply, answered_by: me.person.id, answered_at: at } }));
        },
        afterUndo: () => {
          void readAgain();
          setClosed((m) => {
            const rest = { ...m };
            delete rest[c.id];
            return rest;
          });
        },
      },
    );
    setBusy(null);
  };

  const filterLabels: Record<Filter, string> = {
    all: t('record.comments.filterAll'),
    files: t('record.comments.filterFiles'),
    questions: t('record.comments.filterQuestions'),
  };

  return (
    <section className="flex flex-col gap-4" data-comments aria-label={label ?? t('record.comments.comment')}>
      {newCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            className="font-medium text-link hover:underline"
            onClick={() => lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            data-comments-jump-latest
          >
            {t('record.comments.jumpToLatest')}
          </button>
          <span className="text-muted">{t('record.comments.newComments', { count: newCount })}</span>
        </div>
      ) : null}
      {decision ? (
        <aside
          className="flex flex-col gap-2 rounded-lg border border-border-strong border-s-4 border-s-accent bg-raised px-4 py-3 shadow-1"
          aria-label={t('record.comments.decision')}
          data-decision={decision.id}
        >
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
            <StatusChip tone="success">{t('record.comments.decision')}</StatusChip>
            <span className="font-semibold text-text" data-decision-author>
              {authorName(decision)}
            </span>
            <span>{when(decision.created_at)}</span>
          </p>
          <CommentBody body={decision.body} mentions={decision.mentions} />
          <CommentLinks links={decision.links} locale={locale} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {decidedName(decision) ? (
              <span data-decision-by>
                {t('record.comments.decisionBy', { name: decidedName(decision) })}
                {decision.decided_at ? ` · ${when(decision.decided_at)}` : null}
              </span>
            ) : null}
            {list.can_decide ? (
              <Button
                size="sm"
                loading={deciding === decision.id}
                onClick={() => void decide(decision, false)}
                data-decision-unmark
              >
                {t('record.comments.decisionUnmark')}
              </Button>
            ) : null}
          </p>
        </aside>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('common.filter')}>
        {(Object.keys(filterLabels) as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'secondary'}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {filterLabels[f]} ({counts[f]})
          </Button>
        ))}
      </div>
      {visible.length === 0 ? (
        filter === 'files' && files === null ? (
          <DataState
            kind="failed"
            what={t('record.files.title')}
            onRetry={onFilesRetry}
            retryLabel={t('common.tryAgain')}
          />
        ) : (
          <DataState kind="empty" message={t('record.comments.empty')} />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised shadow-1">
          {visible.map((e, i) => {
            if (e.kind === 'file') {
              const f = e.file;
              // The entry's name is the stored uploaded filename (FIX-38), never the generated display name.
              const name = f.original_name;
              return (
                <li
                  key={`file-${f.id}`}
                  ref={i === visible.length - 1 ? lastRef : undefined}
                  className="flex flex-col gap-2 px-4 py-3"
                  data-comment-file={f.id}
                >
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                    <span className="font-semibold text-text" data-comment-file-name>
                      {name}
                    </span>
                    <span>
                      {locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en} · {formatFileSize(f.size_bytes, t, locale)}{' '}
                      · {f.added_by_name ? `${t('record.files.uploader')} ${f.added_by_name} · ` : ''}
                      {formatDate(f.added_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </p>
                  {f.status === 'stored' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={recordFileDownloadUrl(f.id, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ size: 'sm' })}
                        data-file-download
                      >
                        {t('record.files.download')}
                      </a>
                      <FileLinkButton fileId={f.id} size="sm" />
                    </div>
                  ) : null}
                </li>
              );
            }
            const c = e.comment;
            return (
              <li
                key={c.id}
                ref={i === visible.length - 1 ? lastRef : undefined}
                className="flex flex-col gap-2 px-4 py-3"
                data-comment={c.id}
              >
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                  <span className="font-semibold text-text" data-comment-author>
                    {authorName(c)}
                  </span>
                  <span data-comment-time>{when(c.created_at)}</span>
                  {c.edited ? <span data-comment-edited>{t('record.comments.edited')}</span> : null}
                  {c.is_decision ? (
                    <span data-comment-is-decision>
                      <StatusChip tone="success">{t('record.comments.decision')}</StatusChip>
                    </span>
                  ) : null}
                </p>
                {c.asked_to ? (
                  <p className="text-sm font-medium" data-comment-question>
                    {t('record.comments.question', { name: askedName(c) })}
                  </p>
                ) : null}
                {editing === c.id ? (
                  <div className="flex flex-col gap-2">
                    <Field label={t('record.comments.edit')} error={error}>
                      {(p) => (
                        <Textarea
                          {...p}
                          value={draft}
                          rows={4}
                          name="comment-edit"
                          onChange={(e) => {
                            setError(undefined);
                            setDraft(e.target.value);
                          }}
                        />
                      )}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" loading={busy === c.id} onClick={() => void save(c)} data-comment-save>
                        {t('common.save')}
                      </Button>
                      <Button
                        onClick={() => {
                          setEditing(null);
                          setError(undefined);
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CommentBody body={c.body} mentions={c.mentions} />
                    <CommentLinks links={c.links} locale={locale} />
                  </>
                )}
                {!c.question_open && c.answer ? (
                  <div className="flex flex-col gap-1 rounded-md bg-surface px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-base" dir="auto" data-comment-answer>
                      {c.answer}
                    </p>
                    <p className="text-sm text-muted" data-comment-answered-by>
                      {t('record.comments.answeredBy', { name: answeredName(c) })}
                      {c.answered_at ? ` · ${when(c.answered_at)}` : null}
                    </p>
                  </div>
                ) : null}
                {answering === c.id ? (
                  <div className="flex flex-col gap-2">
                    <Field label={t('record.comments.reply')} error={answerError}>
                      {(p) => (
                        <Textarea
                          {...p}
                          value={answerDraft}
                          rows={3}
                          name="comment-answer"
                          placeholder={t('record.comments.answerPlaceholder')}
                          onChange={(e) => {
                            setAnswerError(undefined);
                            setAnswerDraft(e.target.value);
                          }}
                        />
                      )}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        loading={busy === c.id}
                        onClick={() => void answer(c)}
                        data-comment-answer-save
                      >
                        {t('record.comments.answer')}
                      </Button>
                      <Button
                        onClick={() => {
                          setAnswering(null);
                          setAnswerError(undefined);
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {editing !== c.id &&
                (c.can_edit ||
                  c.can_remove ||
                  (list.can_decide && !c.is_decision) ||
                  (c.question_open && c.asked_to === me.person.id)) ? (
                  <div className="flex flex-wrap gap-2">
                    {list.can_decide && !c.is_decision ? (
                      <Button
                        size="sm"
                        loading={deciding === c.id}
                        onClick={() => void decide(c, true)}
                        data-comment-decide
                      >
                        {t(decision ? 'record.comments.decisionMove' : 'record.comments.decisionMark')}
                      </Button>
                    ) : null}
                    {c.can_edit ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setError(undefined);
                          setDraft(c.body);
                          setEditing(c.id);
                        }}
                        data-comment-edit
                      >
                        {t('record.comments.editAction')}
                      </Button>
                    ) : null}
                    {c.can_remove ? (
                      <Button size="sm" onClick={() => setRemoving(c)} data-comment-remove>
                        {t('record.comments.delete')}
                      </Button>
                    ) : null}
                    {c.question_open && c.asked_to === me.person.id && answering !== c.id ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAnswerError(undefined);
                          setAnswerDraft('');
                          setAnswering(c.id);
                        }}
                        data-comment-reply
                      >
                        {t('record.comments.reply')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {list.can_write ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          data-add-comment
        >
          {askable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === 'comment' ? 'primary' : 'secondary'}
                onClick={() => setMode('comment')}
                aria-pressed={mode === 'comment'}
              >
                {t('record.comments.comment')}
              </Button>
              <Button
                type="button"
                variant={mode === 'ask' ? 'primary' : 'secondary'}
                onClick={() => setMode('ask')}
                aria-pressed={mode === 'ask'}
              >
                {t('record.comments.ask')}
              </Button>
            </div>
          ) : null}
          {mode === 'ask' ? (
            <Field label={t('record.comments.ask')} error={askError}>
              {(p) => (
                <Select
                  id={p.id}
                  value={askedTo ?? ''}
                  placeholder={t('record.comments.askedToRequired')}
                  onValueChange={(v) => {
                    setAskError(undefined);
                    setAskedTo(v);
                  }}
                  options={askable}
                />
              )}
            </Field>
          ) : null}
          <Field label={t('record.comments.write')} error={editing ? undefined : error}>
            {(p) => (
              <Textarea
                {...p}
                ref={boxRef}
                value={text}
                rows={3}
                name="comment"
                aria-controls={suggestOpen && linking === null ? suggestId : undefined}
                aria-activedescendant={
                  suggestOpen && linking === null && suggest.items.length ? `${suggestId}-${active}` : undefined
                }
                onChange={(e) => {
                  setError(undefined);
                  setText(e.target.value);
                  setAt(
                    mentionQuery(
                      e.target.value,
                      e.target.selectionStart ?? e.target.value.length,
                      pickedPeople.map((x) => x.name),
                    ),
                  );
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (
                    linking === null &&
                    suggestKey(e, {
                      open: suggestOpen,
                      count: suggest.items.length,
                      active,
                      setActive,
                      pick: () => pick(activeItem),
                      close: () => setAt(null),
                    })
                  ) {
                    return;
                  }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void add();
                  }
                }}
              />
            )}
          </Field>
          {suggestOpen && linking === null ? (
            <SuggestionList
              id={suggestId}
              items={suggest.items}
              busy={suggest.busy}
              active={active}
              onPick={pick}
              onHover={setActive}
            />
          ) : null}
          <p className="text-sm text-muted" data-mention-hint>
            {t('record.comments.mentionHint')}
            {mentionNote ? ` ${mentionNote}` : null}
          </p>
          {linking !== null ? (
            <div className="flex flex-col gap-2" data-link-search>
              <Field label={t('record.comments.linkSearch')}>
                {(p) => (
                  <Input
                    {...p}
                    autoFocus
                    value={linking}
                    name="comment-link"
                    onChange={(e) => {
                      setLinking(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !suggest.items.length) e.preventDefault();
                      suggestKey(e, {
                        open: true,
                        count: suggest.items.length,
                        active,
                        setActive,
                        pick: () => pick(activeItem),
                        close: () => setLinking(null),
                      });
                    }}
                  />
                )}
              </Field>
              {suggestOpen ? (
                <SuggestionList
                  id={suggestId}
                  items={suggest.items}
                  busy={suggest.busy}
                  active={active}
                  onPick={pick}
                  onHover={setActive}
                />
              ) : null}
            </div>
          ) : null}
          <PickedChips
            people={pickedPeople.filter((x) => text.includes(`@${x.name}`))}
            links={pickedLinks}
            onRemovePerson={(pid) => {
              const gonePerson = pickedPeople.find((x) => x.id === pid);
              setPickedPeople((l) => l.filter((x) => x.id !== pid));
              if (gonePerson) setText((v) => v.split(`@${gonePerson.name}`).join(gonePerson.name));
            }}
            onRemoveLink={(l) => setPickedLinks((all) => all.filter((x) => !(x.id === l.id && x.kind === l.kind)))}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy === 'add'} data-comment-add>
              {mode === 'ask' ? t('record.comments.ask') : t('record.comments.add')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAt(null);
                setActive(0);
                setLinking((v) => (v === null ? '' : null));
              }}
              aria-expanded={linking !== null}
              data-comment-link-open
            >
              {t('record.comments.linkRecord')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted" data-comments-read-only>
          {t('record.comments.readOnly')}
        </p>
      )}
      <Confirm
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title={
          removing?.asked_to
            ? t('record.comments.removeQuestionTitle')
            : t('record.comments.removeTitle', { name: removing ? authorName(removing) : '' })
        }
        body={removing ? <span className="line-clamp-3 break-words">{removing.body}</span> : undefined}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('record.comments.delete')}
        busy={!!removing && busy === removing.id}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </section>
  );
}

/**
 * A record's open questions, as chips beside the follow-ups: one per question, "Asked {name}", opening the record's
 * Discussion. Fed from the page's read of the record's comments, so the chips follow a re-read of the page.
 */
export function OpenAskChips({
  items,
  personName,
  href,
}: {
  /** The record's open questions (asked_to set, question_open). */
  items: RecordComment[];
  /** Names in the language on screen. */
  personName: (id: string | null) => string;
  /** Where a chip lands (the record, on its Discussion tab). */
  href: string;
}) {
  const t = useTranslations();
  return (
    <>
      {items.map((c) => (
        <Link key={c.id} href={href} data-open-ask={c.id}>
          <StatusChip tone="warning">
            {t('record.comments.askChip', { name: c.asked_to ? personName(c.asked_to) : '' })}
          </StatusChip>
        </Link>
      ))}
    </>
  );
}

/**
 * A record header's "N comments · N files" (Phase 4, the one layout): each count is a link into the Discussion tab —
 * comments land on the whole stream, files land on the Files filter. A count whose read failed is left out, never
 * shown as zero; when both reads failed there is nothing to show. An achievement's header counts its evidence
 * instead (files plus references, landing on the Evidence tab), so it agrees with the Evidence tab (F-B2-03).
 */
export function RecordHeaderCounts({
  comments,
  files,
  evidence,
  href,
}: {
  /** How many comments the record holds now, or null when the read failed. */
  comments: number | null;
  /** How many files the record holds now, or null when the read failed. Not read when `evidence` is given. */
  files?: number | null;
  /** Evidence (files + references) with where it lands — an achievement's header counts this, not `files`. */
  evidence?: { count: number | null; href: string } | null;
  /** Where a count lands, by filter. */
  href: (filter: 'all' | 'files') => string;
}) {
  const t = useTranslations();
  const second = evidence ? evidence.count : (files ?? null);
  if (comments === null && second === null) return null;
  return (
    // Landing 34 (item 15): the two counts are words in a line, with a real " · " between them — as flex children
    // (before) the dot had no space on either side in the text a screen reader, a copy or a test reads
    // ("0 comments·0 files"); only a 4 px gap drew one.
    <p className="text-sm" data-record-counts>
      {comments !== null ? (
        <Link
          href={href('all')}
          className="inline-flex items-center font-medium text-link hover:underline max-sm:min-h-11"
        >
          {t('record.commentsCount', { count: comments })}
        </Link>
      ) : null}
      {comments !== null && second !== null ? (
        <span aria-hidden="true" className="text-muted">
          {' · '}
        </span>
      ) : null}
      {evidence ? (
        evidence.count !== null ? (
          <Link
            href={evidence.href}
            className="inline-flex items-center font-medium text-link hover:underline max-sm:min-h-11"
          >
            {t('record.files.evidenceCount', { count: evidence.count })}
          </Link>
        ) : null
      ) : files !== null && files !== undefined ? (
        <Link
          href={href('files')}
          className="inline-flex items-center font-medium text-link hover:underline max-sm:min-h-11"
        >
          {t('record.filesCount', { count: files })}
        </Link>
      ) : null}
    </p>
  );
}
