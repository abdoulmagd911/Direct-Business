'use client';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { cn } from '@/ui/cn';
import { canTick } from '../rules';
import type { TaskDetail } from '../types';
import { StarMark, StarToggle } from './StarToggle';
import { useCommandWords } from './words';

const ITEM_MAX = 500;

/**
 * The task's checklist (V438: no subtasks — action items are the checklist). Each line its owner and due day; the
 * task's editors, the line's owner and its helpers tick it (V190); a tick is done today (V400), with Undo.
 */
export function Checklist({
  task,
  personName,
  locale,
}: {
  task: TaskDetail;
  personName: (id: string | null) => string;
  locale: 'en' | 'ar';
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; text: string } | null>(null);
  const items = task.action_items;
  const open = items.filter((i) => !i.done_on).length;

  const tick = async (id: string, done: boolean, label: string) => {
    setBusy(id);
    await command(
      words(t(done ? 'pages.tasks.items.ticked' : 'pages.tasks.items.unticked', { item: label })),
      () => rpc('action_item_done', { p_id: id, p_done: done }) as Promise<{ request_id?: string | null }>,
    );
    setBusy(null);
  };
  // Delete one line (Phase 0.2): the same Confirm + Undo as the task Remove control, through the existing
  // api.action_items_remove — the server only lets the task's editors do it, so the control shows for them
  // alone. No reason is asked: the reason is optional, and the dialog offers none.
  const remove = async (item: { id: string; text: string }) => {
    setBusy(item.id);
    await command(
      words(t('pages.tasks.items.removed', { item: item.text })),
      () => rpc('action_items_remove', { p_ids: [item.id] }) as Promise<{ request_id?: string | null }>,
      { undoDirect: true },
    );
    setBusy(null);
  };
  const add = async () => {
    const line = text.trim();
    if (!line) return setError(t('pages.tasks.items.textRequired'));
    if (line.length > ITEM_MAX) return setError(t('pages.tasks.items.textTooLong', { max: ITEM_MAX }));
    setBusy('add');
    await command(
      words(t('pages.tasks.items.added', { item: line })),
      () =>
        rpc('action_item_add', {
          p_task: task.id,
          p_values: (due ? { text: line, due_on: due } : { text: line }) as never,
        }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          setText('');
          setDue('');
        },
      },
    );
    setBusy(null);
  };

  return (
    <section className="flex flex-col gap-4" data-checklist aria-label={t('pages.tasks.tabs.items')}>
      <p className="text-sm text-muted" data-open-items={open}>
        {t('pages.tasks.items.count', { open, total: items.length })}
      </p>
      {items.length === 0 ? (
        <DataState kind="empty" message={t('pages.tasks.items.empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {items.map((i) => {
            const may = canTick(i, task, me.person.id);
            return (
              <li key={i.id} className="flex items-start gap-3 px-4 py-3" data-item={i.text}>
                <Checkbox
                  id={`item-${i.id}`}
                  checked={!!i.done_on}
                  onCheckedChange={(v) => void tick(i.id, v, i.text)}
                  disabled={!may || busy === i.id}
                  label={i.text}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`item-${i.id}`}
                  className={cn('min-w-0 flex-1 break-words text-base', i.done_on && 'text-muted line-through')}
                >
                  {i.text}
                </label>
                <span className="shrink-0 text-end text-sm text-muted">
                  {personName(i.owner_id)}
                  {i.due_on ? (
                    <span className={cn('block', i.overdue && 'font-medium text-danger')}>
                      {formatDate(i.due_on, locale)}
                    </span>
                  ) : null}
                </span>
                {may ? (
                  <StarToggle
                    id={i.id}
                    door="action_item_star"
                    starred={!!i.starred}
                    title={i.text}
                    number={task.number}
                    className="-me-2.5 -mt-2 -mb-2.5"
                  />
                ) : (
                  <StarMark starred={!!i.starred} />
                )}
                {task.can_edit ? (
                  <IconButton
                    label={`${t('common.remove')} ${i.text}`}
                    icon={<Trash2 />}
                    size="sm"
                    onClick={() => setRemoving(i)}
                    disabled={busy === i.id}
                    data-item-remove={i.text}
                    className="-me-2.5 -mt-2 -mb-2.5"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {task.can_edit ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          data-add-item
        >
          <Field label={t('pages.tasks.items.new')} error={error} className="flex-1">
            {(p) => (
              <Input
                {...p}
                value={text}
                name="item"
                onChange={(e) => {
                  setError(undefined);
                  setText(e.target.value);
                }}
              />
            )}
          </Field>
          <Field label={t('pages.tasks.fields.due')} className="sm:w-44">
            {(p) => <Input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} name="item-due" />}
          </Field>
          <Button type="submit" loading={busy === 'add'}>
            {t('common.add')}
          </Button>
        </form>
      ) : null}
      <Confirm
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title={t('confirm.title', { item: removing?.text ?? '' })}
        body={t('confirm.body', { item: removing?.text ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('confirm.confirm')}
        busy={!!removing && busy === removing.id}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </section>
  );
}
