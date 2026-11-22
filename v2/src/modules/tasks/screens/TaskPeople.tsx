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
 * The Responsible in Details of a task that has NONE yet, for someone who gives work (`tasks.assign`): one picker;
 * the choice is written through Assign (the person is told), logged, and its toast carries Undo (V287, D7).
 * Landing 33 (O-3): a task that has a Responsible changes hands only through Hand over, by that person, with a reason.
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
  // The door sets the whole list, so the change is made on the list as it is now, not as this tab read it: a helper
  // another tab or person added since is kept (QA 2's lost-update finding on #279).
  const set = async (change: (current: string[]) => string[], done: string) => {
    if (busy) return;
    setBusy(true);
    await command(words(done), async () => {
      const now = (await rpc('task', { p_id: task.id })) as { helpers?: string[] } | null;
      return (await rpc('task_helpers_set', {
        p_id: task.id,
        p_people: change(now?.helpers ?? task.helpers),
      })) as Written;
    });
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2" data-helpers>
      {task.helpers.length ? (
        <ul className="flex flex-col gap-1">
          {task.helpers.map((h) => (
            <li key={h} className="flex items-center justify-between gap-2" data-helper={h}>
              <span className="min-w-0 break-words">
                {name(h)}
                {h === task.deputy_id ? (
                  <span className="ms-2 text-sm text-muted" data-helper-deputy>
                    {t('pages.tasks.people.deputyMark')}
                  </span>
                ) : null}
              </span>
              {h === task.deputy_id ? null : (
                <IconButton
                  size="sm"
                  label={t('pages.tasks.people.helperRemove', { name: name(h) })}
                  icon={<X />}
                  disabled={busy}
                  onClick={() =>
                    void set(
                      (c) => c.filter((x) => x !== h),
                      t('pages.tasks.people.helperRemoved', { number: task.number, name: name(h) }),
                    )
                  }
                  data-helper-remove={h}
                />
              )}
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
                (c) => (c.includes(v) ? c : [...c, v]),
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

/**
 * The Deputy in Details (Landing 33, B3), for whoever may edit the task: one picker. The deputy is a helper — the
 * task is under their Helping — who may also act on it (move its status, mark it done, tick its steps); they never
 * hand it over, and the Responsible still owns the outcome. "No deputy" clears it. Logged, with Undo.
 */
export function DeputyField({
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
  const NONE = 'none';
  const options = [
    { value: NONE, label: t('pages.tasks.people.deputyNone') },
    ...pickable(people, [task.deputy_id ?? null])
      .filter((p) => p.id !== task.owner_id)
      .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const choose = async (v: string) => {
    const next = v === NONE ? null : v;
    if (next === (task.deputy_id ?? null) || busy) return;
    const who = options.find((o) => o.value === v)?.label ?? '';
    setBusy(true);
    await command(
      words(
        next
          ? t('pages.tasks.people.deputySaved', { number: task.number, name: who })
          : t('pages.tasks.people.deputyCleared', { number: task.number }),
      ),
      // database.types.ts takes null for no deputy
      () => rpc('task_deputy_set', { p_id: task.id, p_person: next as string }) as Promise<Written>,
    );
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-1" data-deputy-picker>
      <Select
        value={task.deputy_id ?? NONE}
        aria-label={t('pages.tasks.people.deputyChange')}
        disabled={busy}
        onValueChange={(v) => void choose(v)}
        options={options}
      />
      <p className="text-sm text-muted">{t('pages.tasks.people.deputyWhat')}</p>
    </div>
  );
}
