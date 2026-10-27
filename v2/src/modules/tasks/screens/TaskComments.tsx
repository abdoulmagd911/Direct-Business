'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Textarea } from '@/ui/Input';
import type { TaskComment, TaskComments as Comments, TaskDetail } from '../types';
import { useCommandWords } from './words';

export const COMMENT_MAX = 4000;

/**
 * A task's comments (V657): plain text with line breaks, newest last, each with its author and its time (24-hour). A
 * box at the bottom for whoever may write — the task's editors and helpers; everyone else who sees the task reads only.
 * The author edits and deletes their own; an admin deletes (never edits). Every write has its toast with Undo (D7).
 */
export function TaskComments({
  task,
  data,
  personName,
  locale,
  onCount,
}: {
  task: Pick<TaskDetail, 'id' | 'number'>;
  data: Comments;
  personName: (id: string | null) => string;
  locale: 'en' | 'ar';
  /** How many comments the screen shows now, so the tab's number follows an add or a delete at once. */
  onCount?: (n: number | null) => void;
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<TaskComment | null>(null);
  // What this person just did shows at once, before the server's re-read arrives (it takes a moment): a comment added,
  // one removed, new words. The re-read replaces all of it, and Undo takes it back.
  const [added, setAdded] = useState<TaskComment[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [newWords, setNewWords] = useState<Record<string, string>>({});
  // the server's re-read arrived: it is the truth now, so what showed ahead of it is dropped
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setAdded([]);
    setGone([]);
    setNewWords({});
  }
  const shown = useMemo(
    () =>
      [...data.comments, ...added.filter((a) => !data.comments.some((c) => c.id === a.id))]
        .filter((c) => !gone.includes(c.id))
        .map((c) =>
          newWords[c.id] === undefined ? c : { ...c, body: newWords[c.id] as string, edited_at: c.edited_at ?? 'now' },
        ),
    [data, added, gone, newWords],
  );
  useEffect(() => {
    onCount?.(shown.length);
    return () => onCount?.(null);
  }, [shown.length, onCount]);
  const when = (iso: string) => formatDate(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
  const check = (v: string) => {
    if (!v.trim()) return t('pages.tasks.comments.bodyRequired');
    if (v.trim().length > COMMENT_MAX) return t('pages.tasks.comments.tooLong', { max: COMMENT_MAX });
    return undefined;
  };

  // `after` runs twice for a write that is undone: once for the write, once for its Undo.
  const add = async () => {
    const problem = check(text);
    if (problem) return setError(problem);
    setBusy('add');
    const body = text.trim();
    let first = true;
    await command(
      words(t('pages.tasks.comments.added')),
      () =>
        rpc('task_comment_add', { p_task: task.id, p_body: body }) as Promise<{
          id?: string;
          request_id?: string | null;
        }>,
      {
        after: (r) => {
          const id = r?.id ?? '';
          if (first) {
            first = false;
            setText('');
            setAdded((a) => [
              ...a,
              {
                id,
                body,
                author_id: me.person.id,
                created_at: new Date().toISOString(),
                edited_at: null,
                version: 1,
                mine: true,
                can_edit: true,
                can_remove: true,
              },
            ]);
          } else setAdded((a) => a.filter((x) => x.id !== id));
        },
      },
    );
    setBusy(null);
  };
  const save = async (c: TaskComment) => {
    const problem = check(draft);
    if (problem) return setError(problem);
    setBusy(c.id);
    const body = draft.trim();
    let first = true;
    await command(
      words(t('pages.tasks.comments.saved')),
      () =>
        rpc('task_comment_edit', { p_id: c.id, p_body: body, p_version: c.version }) as Promise<{
          request_id?: string | null;
        }>,
      {
        after: () => {
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
  const remove = async (c: TaskComment) => {
    setBusy(c.id);
    let first = true;
    await command(
      words(t('pages.tasks.comments.removed')),
      () => rpc('task_comment_remove', { p_id: c.id }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
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

  return (
    <section className="flex flex-col gap-4" data-comments aria-label={t('pages.tasks.tabs.comments')}>
      {shown.length === 0 ? (
        <DataState kind="empty" message={t('pages.tasks.comments.empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-3" data-comment={c.id}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                <span className="font-semibold text-text" data-comment-author>
                  {personName(c.author_id)}
                </span>
                <span data-comment-time>{when(c.created_at)}</span>
                {c.edited_at ? <span data-comment-edited>{t('pages.tasks.comments.edited')}</span> : null}
              </p>
              {editing === c.id ? (
                <div className="flex flex-col gap-2">
                  <Field label={t('pages.tasks.comments.edit')} error={error}>
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
                <p className="whitespace-pre-wrap break-words text-base" data-comment-body>
                  {c.body}
                </p>
              )}
              {editing !== c.id && (c.can_edit || c.can_remove) ? (
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
                      {t('pages.tasks.comments.editAction')}
                    </Button>
                  ) : null}
                  {c.can_remove ? (
                    <Button size="sm" onClick={() => setRemoving(c)} data-comment-remove>
                      {t('pages.tasks.comments.delete')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {data.can_write ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          data-add-comment
        >
          <Field label={t('pages.tasks.comments.write')} error={editing ? undefined : error}>
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
              {t('pages.tasks.comments.add')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted" data-comments-read-only>
          {t('pages.tasks.comments.readOnly')}
        </p>
      )}
      <Confirm
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title={t('pages.tasks.comments.removeTitle', { name: removing ? personName(removing.author_id) : '' })}
        body={removing ? <span className="line-clamp-3 break-words">{removing.body}</span> : undefined}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('pages.tasks.comments.delete')}
        busy={!!removing && busy === removing.id}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </section>
  );
}
