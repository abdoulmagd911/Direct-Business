'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import type { OrgAnswer } from '@/modules/org/types';
import { nameOf } from '@/modules/org/types';
import {
  noTeamToWorkIn,
  quickAddOwners,
  quickAddRefusalKey,
  quickAddValues,
  TITLE_MAX,
  type QuickAddInput,
} from '../rules';
import type { NamePick } from '../types';
import { useCommandWords } from './words';

const NONE = '__none';

/** A My day note being turned into a task (V433, V605 (3)): the same form, sent through api.note_turn_into. */
export type FromNote = { id: string; hasItems: boolean };

/**
 * Quick add (§3.7, V464): a title, then optionally the owner, a due day and a client or a project — nothing else. The
 * owner is offered only to someone who may give work to others (`tasks.assign`); left at "Default", the database
 * names it (the project's owner, else the client's account manager, else me). Someone in no team gets no Default and
 * must pick an owner (V277).
 */
export function QuickAdd({
  open,
  onOpenChange,
  org,
  partners,
  projects,
  initial,
  fromNote,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: OrgAnswer | null;
  partners: NamePick[];
  projects: NamePick[];
  initial?: Partial<QuickAddInput>;
  fromNote?: FromNote;
  onAdded?: (r: { id: string; number: string }) => void;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={fromNote ? t('pages.myDay.turn.taskTitle') : t('pages.tasks.add.title')}
      closeLabel={t('common.close')}
      size="sm"
    >
      {open ? (
        <QuickAddForm
          org={org}
          partners={partners}
          projects={projects}
          initial={initial}
          fromNote={fromNote}
          onClose={() => onOpenChange(false)}
          onAdded={onAdded}
        />
      ) : null}
    </Dialog>
  );
}

export function QuickAddForm({
  org,
  partners,
  projects,
  initial,
  fromNote,
  onClose,
  onAdded,
}: {
  org: OrgAnswer | null;
  partners: NamePick[];
  projects: NamePick[];
  initial?: Partial<QuickAddInput>;
  fromNote?: FromNote;
  onClose: () => void;
  onAdded?: (r: { id: string; number: string }) => void;
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const [f, setF] = useState<QuickAddInput>({ title: '', ...initial });
  const [error, setError] = useState<string | undefined>();
  const [ownerError, setOwnerError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [withItems, setWithItems] = useState(false);
  const canAssign = me.capabilities.includes('tasks.assign');
  const locale = useLocale() as 'en' | 'ar';
  const pick = (x: NamePick) => (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en);
  const owners = quickAddOwners(me.person.team_id, org?.people ?? []);
  const ownerRequired = canAssign && !owners.offerDefault;
  const people = owners.people
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const quickWords = (done: string) => ({
    ...words(done),
    has: (k: string) => t.has(quickAddRefusalKey(k)),
    failed: (k: string, d: string) => t(quickAddRefusalKey(k), { detail: d }),
  });

  const save = async () => {
    const r = quickAddValues(f, me.person.id, { ownerRequired });
    if ('error' in r) {
      const said = t(`pages.tasks.add.${r.error}`, { max: TITLE_MAX });
      if (r.error === 'owner_required') setOwnerError(said);
      else setError(said);
      return;
    }
    setBusy(true);
    await command(
      quickWords(t('pages.tasks.add.added', { title: r.values.title as string })),
      () =>
        (fromNote
          ? rpc('note_turn_into', {
              p_note: fromNote.id,
              p_kind: 'task',
              p_values: { ...r.values, ...(withItems ? { action_items: true } : {}) } as never,
            })
          : rpc('task_create', { p_values: r.values as never })) as Promise<{
          id: string;
          number: string;
          request_id: string;
        }>,
      {
        after: (res) => {
          onClose();
          if (res) onAdded?.({ id: res.id, number: res.number });
        },
      },
    );
    setBusy(false);
  };

  if (noTeamToWorkIn(me.person.team_id, canAssign))
    return (
      <div className="flex flex-col gap-4" data-quick-add data-no-team>
        <p className="text-base text-muted">{t('pages.tasks.noTeam')}</p>
        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      data-quick-add
    >
      <Field label={t('pages.tasks.fields.title')} error={error}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            maxLength={TITLE_MAX + 50}
            value={f.title}
            onChange={(e) => {
              setError(undefined);
              setF({ ...f, title: e.target.value });
            }}
            name="title"
          />
        )}
      </Field>
      {canAssign ? (
        <Field label={t('pages.tasks.fields.owner')} error={ownerError}>
          {(p) =>
            owners.offerDefault ? (
              <Select
                id={p.id}
                value={f.ownerId ?? NONE}
                onValueChange={(v) => setF({ ...f, ownerId: v === NONE ? undefined : v })}
                options={[{ value: NONE, label: t('pages.tasks.add.defaultOwner') }, ...people]}
              />
            ) : (
              <Select
                id={p.id}
                value={f.ownerId ?? ''}
                placeholder={t('pages.tasks.add.owner_required')}
                onValueChange={(v) => {
                  setOwnerError(undefined);
                  setF({ ...f, ownerId: v });
                }}
                options={people}
              />
            )
          }
        </Field>
      ) : null}
      <Field label={t('pages.tasks.fields.due')}>
        {(p) => (
          <Input
            {...p}
            type="date"
            value={f.due ?? ''}
            onChange={(e) => setF({ ...f, due: e.target.value || undefined })}
            name="due"
          />
        )}
      </Field>
      {partners.length ? (
        <Field label={t('pages.tasks.fields.client')}>
          {(p) => (
            <Select
              id={p.id}
              value={f.partnerId ?? NONE}
              onValueChange={(v) => setF({ ...f, partnerId: v === NONE ? undefined : v, projectId: undefined })}
              options={[
                { value: NONE, label: t('pages.tasks.add.internal') },
                ...partners.map((x) => ({ value: x.id, label: pick(x) })),
              ]}
            />
          )}
        </Field>
      ) : null}
      {projects.length ? (
        <Field label={t('pages.tasks.fields.project')}>
          {(p) => (
            <Select
              id={p.id}
              value={f.projectId ?? NONE}
              onValueChange={(v) => setF({ ...f, projectId: v === NONE ? undefined : v, partnerId: undefined })}
              options={[
                { value: NONE, label: t('common.none') },
                ...projects.map((x) => ({ value: x.id, label: `${x.number} · ${pick(x)}` })),
              ]}
            />
          )}
        </Field>
      ) : null}
      {fromNote?.hasItems ? (
        <label className="flex items-center gap-2 text-base" data-with-items>
          <Checkbox checked={withItems} onCheckedChange={setWithItems} label={t('pages.myDay.turn.withItems')} />
          {t('pages.myDay.turn.withItems')}
        </label>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy} data-quick-add-save>
          {t('pages.tasks.add.save')}
        </Button>
      </div>
    </form>
  );
}
