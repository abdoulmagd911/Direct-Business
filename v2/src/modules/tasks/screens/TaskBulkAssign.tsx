'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command, type Written } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { assignablePeople } from '@/modules/org/pickers';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import type { ListEntry } from '@/modules/partners/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Select } from '@/ui/Select';
import { useCommandWords } from './words';

/**
 * FIX-01: give the selected tasks to one owner, set their priority, or both — one request per leg, each with its
 * own Undo. Whoever may give work to others (`tasks.assign`) sees it; the doors refuse anyone else. The owner list
 * is the per-record picker's (the assignable people, F101's shape for tasks); the priority list is the settings
 * list, never hard-coded.
 */
export function TaskBulkAssign({
  open,
  onOpenChange,
  ids,
  org,
  priorities,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  org: OrgAnswer | null;
  priorities: ListEntry[];
  onDone: () => void;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.tasks.bulkAssign.title', { count: ids.length })}
      description={t('pages.tasks.bulkAssign.what')}
      closeLabel={t('common.close')}
      size="sm"
    >
      {open ? (
        <TaskBulkAssignForm
          ids={ids}
          org={org}
          priorities={priorities}
          onClose={() => onOpenChange(false)}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

function TaskBulkAssignForm({
  ids,
  org,
  priorities,
  onClose,
  onDone,
}: {
  ids: string[];
  org: OrgAnswer | null;
  priorities: ListEntry[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const locale = useLocale() as 'en' | 'ar';
  const [owner, setOwner] = useState<string | undefined>();
  const [priority, setPriority] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const people = assignablePeople(org?.people ?? [])
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const priorityOptions = priorities
    .filter((p) => p.active)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((p) => ({ value: p.key, label: locale === 'ar' && p.name_ar ? p.name_ar : p.name_en }));

  // One leg at a time, each its own request with its own Undo (owner 13 Nov): a refused leg stops there and the dialog
  // stays open with only what is still to do — the priority never goes ahead on a refused owner, and the dialog never
  // closes on a half-done choice. A leg that went through is cleared, so trying again never repeats it.
  const save = async () => {
    if (!owner && !priority) return;
    setBusy(true);
    if (owner) {
      const name = people.find((p) => p.value === owner)?.label ?? '';
      const r = await command(
        words(t('pages.tasks.bulkAssign.ownerDone', { count: ids.length, name })),
        () => rpc('tasks_assign', { p_ids: ids, p_owner: owner }) as Promise<Written>,
      );
      if (!r) return setBusy(false);
      setOwner(undefined);
    }
    if (priority) {
      const label = priorityOptions.find((p) => p.value === priority)?.label ?? priority;
      // database.types.ts does not know api.tasks_priority_set yet (FIX-01, F051): the typegen is owed; until it
      // lands the name and its args go through as never, as the server calls elsewhere do.
      const r = await command(
        words(t('pages.tasks.bulkAssign.priorityDone', { count: ids.length, priority: label })),
        () => rpc('tasks_priority_set' as never, { p_ids: ids, p_priority: priority } as never) as Promise<Written>,
      );
      if (!r) return setBusy(false);
      setPriority(undefined);
    }
    setBusy(false);
    onDone();
    onClose();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      data-task-bulk-assign
    >
      <Field label={t('pages.tasks.fields.owner')}>
        {(p) => (
          <Select
            id={p.id}
            value={owner ?? ''}
            placeholder={t('pages.tasks.bulkAssign.unchanged')}
            onValueChange={(v) => setOwner(v || undefined)}
            options={people}
          />
        )}
      </Field>
      <Field label={t('pages.tasks.fields.priority')}>
        {(p) => (
          <Select
            id={p.id}
            value={priority ?? ''}
            placeholder={t('pages.tasks.bulkAssign.unchanged')}
            onValueChange={(v) => setPriority(v || undefined)}
            options={priorityOptions}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy} disabled={!owner && !priority}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
