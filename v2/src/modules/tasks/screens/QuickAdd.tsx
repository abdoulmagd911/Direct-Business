'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import type { OrgAnswer } from '@/modules/org/types';
import { nameOf } from '@/modules/org/types';
import { quickAddValues, TITLE_MAX, type QuickAddInput } from '../rules';
import type { NamePick } from '../types';
import { useCommandWords } from './words';

const NONE = '__none';

/**
 * Quick add (§3.7, V464): a title, then optionally the owner, a due day and a client or a project — nothing else. The
 * owner is offered only to someone who may give work to others (`tasks.assign`); left at "Default", the database
 * names it (the project's owner, else the client's account manager, else me).
 */
export function QuickAdd({
  open,
  onOpenChange,
  org,
  partners,
  projects,
  initial,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: OrgAnswer | null;
  partners: NamePick[];
  projects: NamePick[];
  initial?: Partial<QuickAddInput>;
  onAdded?: (r: { id: string; number: string }) => void;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.tasks.add.title')}
      closeLabel={t('common.close')}
      size="sm"
    >
      {open ? (
        <QuickAddForm
          org={org}
          partners={partners}
          projects={projects}
          initial={initial}
          onClose={() => onOpenChange(false)}
          onAdded={onAdded}
        />
      ) : null}
    </Dialog>
  );
}

function QuickAddForm({
  org,
  partners,
  projects,
  initial,
  onClose,
  onAdded,
}: {
  org: OrgAnswer | null;
  partners: NamePick[];
  projects: NamePick[];
  initial?: Partial<QuickAddInput>;
  onClose: () => void;
  onAdded?: (r: { id: string; number: string }) => void;
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const [f, setF] = useState<QuickAddInput>({ title: '', ...initial });
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const canAssign = me.capabilities.includes('tasks.assign');
  const locale = useLocale() as 'en' | 'ar';
  const pick = (x: NamePick) => (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en);
  const people = (org?.people ?? [])
    .filter((p) => !p.account || p.account === 'team_member')
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const save = async () => {
    const r = quickAddValues(f, me.person.id);
    if ('error' in r) {
      setError(t(`pages.tasks.add.${r.error}`, { max: TITLE_MAX }));
      return;
    }
    setBusy(true);
    await command(
      words(t('pages.tasks.add.added', { title: r.values.title as string })),
      () =>
        rpc('task_create', { p_values: r.values as never }) as Promise<{
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
        <Field label={t('pages.tasks.fields.owner')}>
          {(p) => (
            <Select
              id={p.id}
              value={f.ownerId ?? NONE}
              onValueChange={(v) => setF({ ...f, ownerId: v === NONE ? undefined : v })}
              options={[{ value: NONE, label: t('pages.tasks.add.defaultOwner') }, ...people]}
            />
          )}
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
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy}>
          {t('pages.tasks.add.save')}
        </Button>
      </div>
    </form>
  );
}
