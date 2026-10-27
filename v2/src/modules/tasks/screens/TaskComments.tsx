'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
}: {
  task: Pick<TaskDetail, 'id' | 'number'>;
  data: Comments;
  personName: (id: string | null) => string;
  locale: 'en' | 'ar';
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<TaskComment | null>(null);
  const when = (iso: string) => formatDate(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
  const check = (v: string) => {
    if (!v.trim()) return t('pages.tasks.comments.bodyRequired');
    if (v.trim().length > COMMENT_MAX) return t('pages.tasks.comments.tooLong', { max: COMMENT_MAX });
    return undefined;
  };

  const add = async () => {
    const problem = check(text);
    if (problem) return setError(problem);
    setBusy('add');
    await command(
      words(t('pages.tasks.comments.added')),
      () =>
        rpc('task_comment_add', { p_task: task.id, p_body: text.trim() }) as Promise<{ request_id?: string | null }>,
      { after: () => setText('') },
    );
    setBusy(null);
  };
  const save = async (c: TaskComment) => {
    const problem = check(draft);
    if (problem) return setError(problem);
    setBusy(c.id);
    await command(
      words(t('pages.tasks.comments.saved')),
      () =>
        rpc('task_comment_edit', { p_id: c.id, p_body: draft.trim(), p_version: c.version }) as Promise<{
          request_id?: string | null;
        }>,
      { after: () => setEditing(null) },
    );
    setBusy(null);
  };
  const remove = async (c: TaskComment) => {
    setBusy(c.id);
    await command(
      words(t('pages.tasks.comments.removed')),
      () => rpc('task_comment_remove', { p_id: c.id }) as Promise<{ request_id?: string | null }>,
      { after: () => setRemoving(null) },
    );
    setBusy(null);
  };

  return (
    <section className="flex flex-col gap-4" data-comments aria-label={t('pages.tasks.tabs.comments')}>
      {data.comments.length === 0 ? (
        <DataState kind="empty" message={t('pages.tasks.comments.empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {data.comments.map((c) => (
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
