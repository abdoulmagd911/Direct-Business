'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { useCommandWords } from './words';
import { downloadRecordFile, formatFileSize, type RecordFile } from './FilesSection';

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
};

/** api.comments(entity, id): a record's comments, oldest first (newest last), and whether the reader may write one. */
export type RecordComments = { read_at: string; can_write: boolean; comments: RecordComment[] };

type Filter = 'all' | 'files' | 'questions';

/**
 * A record's Discussion (Phase 2, the generic form of the task comments, V657): plain text with line breaks, oldest
 * first — a discussion reads in order — each with its author and its time (24-hour), and an "edited" flag. A "Jump to
 * latest" link and a count of what arrived since the record was first read. A box at the bottom for whoever may write;
 * everyone else who sees the record reads only. The author edits and deletes their own; an admin deletes (never
 * edits). Every write has its toast with Undo (D7). A question is a comment asked of one person: only their explicit
 * reply closes it, and a casual comment of theirs does not. File entries join the stream (Phase 4): each file the
 * record holds shows as one entry with a download link, in time order among the comments; the Files filter shows
 * them alone. No @mentions, no attachments (V657 scope stands).
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
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const [text, setText] = useState('');
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
  const [fileError, setFileError] = useState(false);
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
          if (w === undefined && a === undefined) return c;
          return {
            ...c,
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
    [list, added, gone, newWords, closed, personName],
  );
  // One stream, in time order: the comments and the record's file-addition entries together. A file entry carries
  // no author line — the files read names no uploader — only its kind, size and added date, with a download link.
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

  // `after` runs twice for a write that is undone: once for the write, once for its Undo.
  const add = async () => {
    const problem = check(text, t('record.comments.bodyRequired'));
    if (problem) return setError(problem);
    if (mode === 'ask' && !askedTo) return setAskError(t('record.comments.askedToRequired'));
    setBusy('add');
    const body = text.trim();
    const asked = mode === 'ask' ? (askedTo ?? null) : null;
    const askedLabel = askable.find((p) => p.value === asked)?.label ?? '';
    let first = true;
    await command(
      words(mode === 'ask' ? t('record.comments.askAdded') : t('record.comments.added')),
      () =>
        rpc('comment_add', { p_entity: entity, p_id: id, p_body: body, p_asked_to: asked ?? undefined }) as Promise<{
          id?: string;
          request_id?: string | null;
        }>,
      {
        undoDirect: true,
        after: (r) => {
          void readAgain();
          const cid = r?.id ?? '';
          if (first) {
            first = false;
            setText('');
            setAskedTo(undefined);
            setAdded((a) => [
              ...a,
              {
                id: cid,
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
              },
            ]);
          } else setAdded((a) => a.filter((x) => x.id !== cid));
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
    let first = true;
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
          if (first) {
            first = false;
            setNewWords((w) => ({ ...w, [c.id]: body }));
          } else
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
    let first = true;
    await command(
      words(t('record.comments.removed')),
      () => rpc('comment_remove', { p_id: c.id }) as Promise<{ request_id?: string | null }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setRemoving(null);
          if (first) {
            first = false;
            setGone((g) => [...g, c.id]);
          } else setGone((g) => g.filter((x) => x !== c.id));
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
    let first = true;
    await command(
      words(t('record.comments.answered')),
      () => rpc('comment_answer', { p_id: c.id, p_answer: reply }) as Promise<{ request_id?: string | null }>,
      {
        undoDirect: true,
        after: () => {
          void readAgain();
          setAnswering(null);
          if (first) {
            first = false;
            setClosed((m) => ({ ...m, [c.id]: { answer: reply, answered_by: me.person.id, answered_at: at } }));
          } else
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
      {fileError ? (
        <p role="alert" className="text-sm text-danger">
          {t('record.files.downloadFailed')}
        </p>
      ) : null}
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
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {visible.map((e, i) => {
            if (e.kind === 'file') {
              const f = e.file;
              const name = locale === 'ar' && f.display_name_ar ? f.display_name_ar : f.display_name_en;
              return (
                <li
                  key={`file-${f.id}`}
                  ref={i === visible.length - 1 ? lastRef : undefined}
                  className="flex flex-col gap-2 px-4 py-3"
                  data-comment-file={f.id}
                >
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                    <span className="font-semibold text-text" data-comment-file-name>
                      {name ?? f.original_name}
                    </span>
                    <span>
                      {locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en} · {formatFileSize(f.size_bytes)} ·{' '}
                      {t('record.files.addedOn', {
                        date: formatDate(f.added_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
                      })}
                    </span>
                  </p>
                  {f.status === 'stored' ? (
                    <div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setFileError(false);
                          void downloadRecordFile(f.id, locale).catch(() => setFileError(true));
                        }}
                        data-file-download
                      >
                        {t('record.files.download')}
                      </Button>
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
                  <p className="whitespace-pre-wrap break-words text-base" dir="auto" data-comment-body>
                    {c.body}
                  </p>
                )}
                {!c.question_open && c.answer ? (
                  <div className="flex flex-col gap-1 rounded-md bg-surface px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-base" dir="auto" data-comment-answer>
                      {c.answer}
                    </p>
                    <p className="text-sm text-muted" data-comment-answered-by>
                      {t('record.comments.answeredBy', { name: answeredName(c) })}
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
                (c.can_edit || c.can_remove || (c.question_open && c.asked_to === me.person.id)) ? (
                  <div className="flex flex-wrap gap-2">
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
                value={text}
                rows={3}
                name="comment"
                onChange={(e) => {
                  setError(undefined);
                  setText(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void add();
                  }
                }}
              />
            )}
          </Field>
          <div>
            <Button type="submit" variant="primary" loading={busy === 'add'} data-comment-add>
              {mode === 'ask' ? t('record.comments.ask') : t('record.comments.add')}
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
        title={t('record.comments.removeTitle', { name: removing ? authorName(removing) : '' })}
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
 * shown as zero; when both reads failed there is nothing to show.
 */
export function RecordHeaderCounts({
  comments,
  files,
  href,
}: {
  /** How many comments the record holds now, or null when the read failed. */
  comments: number | null;
  /** How many files the record holds now, or null when the read failed. */
  files: number | null;
  /** Where a count lands, by filter. */
  href: (filter: 'all' | 'files') => string;
}) {
  const t = useTranslations();
  if (comments === null && files === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm" data-record-counts>
      {comments !== null ? (
        <Link href={href('all')} className="font-medium text-link hover:underline">
          {t('record.commentsCount', { count: comments })}
        </Link>
      ) : null}
      {comments !== null && files !== null ? (
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
      ) : null}
      {files !== null ? (
        <Link href={href('files')} className="font-medium text-link hover:underline">
          {t('record.filesCount', { count: files })}
        </Link>
      ) : null}
    </p>
  );
}
