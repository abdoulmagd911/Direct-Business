'use client';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { assignablePeople } from '@/modules/org/pickers';
import { nameOf, type OrgPerson } from '@/modules/org/types';
import { IconButton } from '@/ui/IconButton';
import { Select } from '@/ui/Select';
import type { TaskDetail } from '../types';
import { useCommandWords } from './words';

type Written = { request_id?: string | null };

/** People who may be picked: the assignable ones, and anyone already on the task so their name always reads. */
function pickable(people: readonly OrgPerson[], keep: readonly (string | null)[]): OrgPerson[] {
  const ok = new Set(assignablePeople(people).map((p) => p.id));
  return people.filter((p) => ok.has(p.id) || keep.includes(p.id));
}

/**
 * The Owner in Details, for someone who gives work (`tasks.assign`): one picker; the choice is written through Assign
 * (the owner is told), logged, and its toast carries Undo (V287, D7).
 */
export function OwnerPicker({
  task,
  people,
  locale,
}: {
  task: TaskDetail;
  people: readonly OrgPerson[];
  locale: 'en' | 'ar';
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const [busy, setBusy] = useState(false);
  const options = pickable(people, [task.owner_id])
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const choose = async (owner: string) => {
    if (owner === task.owner_id || busy) return;
    const who = options.find((o) => o.value === owner)?.label ?? '';
    setBusy(true);
    await command(
      words(t('pages.tasks.people.ownerSaved', { number: task.number, name: who })),
      () => rpc('tasks_assign', { p_ids: [task.id], p_owner: owner }) as Promise<Written>,
    );
    setBusy(false);
  };
  return (
    <div data-owner-picker>
      <Select
        value={task.owner_id ?? ''}
        placeholder={t('pages.tasks.unknownOwner')}
        aria-label={t('pages.tasks.people.changeOwner')}
        disabled={busy}
        onValueChange={(v) => void choose(v)}
        options={options}
      />
    </div>
  );
}

/**
 * The Helpers in Details, for whoever may edit the task: each helper with a remove button and one picker to add
 * another. Every change sets the whole list through `task_helpers_set` (the new helper is told), is logged, and its
 * toast carries Undo (V287, D7).
 */
export function HelpersField({
  task,
  people,
  locale,
}: {
  task: TaskDetail;
  people: readonly OrgPerson[];
  locale: 'en' | 'ar';
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const [busy, setBusy] = useState(false);
  const name = (id: string) => {
    const p = people.find((x) => x.id === id);
    return p ? nameOf(p, locale) : '—';
  };
  const options = pickable(people, [])
    .filter((p) => p.id !== task.owner_id && !task.helpers.includes(p.id))
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const set = async (next: string[], done: string) => {
    if (busy) return;
    setBusy(true);
    await command(words(done), () => rpc('task_helpers_set', { p_id: task.id, p_people: next }) as Promise<Written>);
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2" data-helpers>
      {task.helpers.length ? (
        <ul className="flex flex-col gap-1">
          {task.helpers.map((h) => (
            <li key={h} className="flex items-center justify-between gap-2" data-helper={h}>
              <span className="min-w-0 break-words">{name(h)}</span>
              <IconButton
                size="sm"
                label={t('pages.tasks.people.helperRemove', { name: name(h) })}
                icon={<X />}
                disabled={busy}
                onClick={() =>
                  void set(
                    task.helpers.filter((x) => x !== h),
                    t('pages.tasks.people.helperRemoved', { number: task.number, name: name(h) }),
                  )
                }
                data-helper-remove={h}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {options.length ? (
        <div data-helper-add>
          <Select
            value=""
            placeholder={t('pages.tasks.people.helperAdd')}
            aria-label={t('pages.tasks.people.helperAdd')}
            disabled={busy}
            onValueChange={(v) =>
              void set(
                [...task.helpers, v],
                t('pages.tasks.people.helperAdded', {
                  number: task.number,
                  name: options.find((o) => o.value === v)?.label ?? '',
                }),
              )
            }
            options={options}
          />
        </div>
      ) : null}
    </div>
  );
}
