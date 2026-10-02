'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import {
  SIDES,
  nameOf,
  type Contact,
  type Contract,
  type ListEntry,
  type Reference,
  type Side,
  type SideFull,
} from '../../types';
import { today, useWords } from './words';

const IDENTIFIER_KINDS = ['vat', 'cr', 'email', 'phone', 'payments_client_id', 'discount_code', 'name'] as const;

/** Add an identifier (§3.4, V133: with its reason; client IDs and codes need the Client side on; codes carry dates). */
export function IdentifierDialog({
  open,
  onOpenChange,
  partnerId,
  clientOn,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  clientOn: boolean;
  onDone: () => void;
}) {
  const t = useTranslations();
  const words = useWords();
  const [f, setF] = useState({ kind: 'vat', subkind: '', value: '', from: '', to: '', note: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const kinds = IDENTIFIER_KINDS.filter((k) => clientOn || (k !== 'payments_client_id' && k !== 'discount_code'));
  const ok = !!f.value.trim() && !!f.reason.trim() && (f.kind !== 'name' || true);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.identifier.added')),
      () =>
        rpc('identifier_add', {
          p_partner: partnerId,
          p_kind: f.kind,
          p_value: f.value.trim(),
          p_reason: f.reason.trim(),
          p_subkind: f.kind === 'name' ? 'alias' : f.subkind || undefined,
          p_valid_from: f.kind === 'discount_code' && f.from ? f.from : undefined,
          p_valid_to: f.kind === 'discount_code' && f.to ? f.to : undefined,
          p_note: f.note.trim() || undefined,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          onOpenChange(false);
          setF({ kind: 'vat', subkind: '', value: '', from: '', to: '', note: '', reason: '' });
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partners.identifier.add')}
      size="sm"
      closeLabel={t('common.close')}
      dirty={!!f.value}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-identifier-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-identifier-form>
        <Field label={t('partners.identifier.kind')}>
          {(p) => (
            <Select
              {...p}
              value={f.kind}
              onValueChange={(v) => setF({ ...f, kind: v, subkind: '' })}
              options={kinds.map((k) => ({ value: k, label: t(`partners.identifier.kinds.${k}`) }))}
            />
          )}
        </Field>
        {f.kind === 'payments_client_id' ? (
          <Field label={t('partners.identifier.subkind')}>
            {(p) => (
              <Select
                {...p}
                value={f.subkind}
                onValueChange={(v) => setF({ ...f, subkind: v })}
                placeholder={t('common.none')}
                options={['prepaid', 'postpaid', 'tender'].map((k) => ({
                  value: k,
                  label: t(`partners.identifier.subkinds.${k}`),
                }))}
              />
            )}
          </Field>
        ) : null}
        <Field label={t('partners.identifier.value')}>
          {(p) => (
            <Input
              {...p}
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
              className="font-data"
              autoFocus
            />
          )}
        </Field>
        {f.kind === 'discount_code' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('partners.identifier.validFrom')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={f.from}
                  onChange={(e) => setF({ ...f, from: e.target.value })}
                  className="font-data"
                />
              )}
            </Field>
            <Field label={t('partners.identifier.validTo')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={f.to}
                  onChange={(e) => setF({ ...f, to: e.target.value })}
                  className="font-data"
                />
              )}
            </Field>
          </div>
        ) : null}
        <Field label={t('common.reason')}>
          {(p) => (
            <Textarea {...p} rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/** A contact with its role and the sides it belongs to (V148, V401); an edit sends only what changed. */
export function ContactDialog({
  open,
  onOpenChange,
  partnerId,
  current,
  roles,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  current: Contact | null;
  roles: ListEntry[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const read = (c: Contact | null) => ({
    name_en: c?.name_en ?? '',
    name_ar: c?.name_ar ?? '',
    job_title: c?.job_title ?? '',
    role_id: c?.role_id ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    notes: c?.notes ?? '',
    is_primary: c?.is_primary ?? false,
    sides: (c?.sides ?? [...SIDES]) as Side[],
  });
  const [f, setF] = useState(read(current));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = current ? `${current.id}:${current.version}` : 'new';
  if (open && openedFor !== key) {
    setOpenedFor(key);
    setF(read(current));
  }
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const typed: Record<string, unknown> = {
      name_en: f.name_en.trim(),
      name_ar: f.name_ar.trim() || null,
      job_title: f.job_title.trim() || null,
      role_id: f.role_id || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      notes: f.notes.trim() || null,
      is_primary: f.is_primary,
      sides: f.sides,
    };
    const values: Record<string, unknown> = {};
    if (!current) Object.assign(values, typed);
    else {
      const was = read(current);
      const norm = (k: string, v: unknown) =>
        k === 'sides'
          ? JSON.stringify([...(v as string[])].sort())
          : JSON.stringify(typeof v === 'string' ? v.trim() || null : v);
      for (const [k, v] of Object.entries(typed))
        if (norm(k, v) !== norm(k, (was as Record<string, unknown>)[k])) values[k] = v;
      if (!Object.keys(values).length) {
        onOpenChange(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(
        current ? t('partners.contact.updated', { name: f.name_en }) : t('partners.contact.added', { name: f.name_en }),
      ),
      () =>
        rpc('contact_save', {
          p_partner: partnerId,
          p_id: (current?.id ?? null) as unknown as string,
          p_values: values as never,
          p_version: current?.version,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          onOpenChange(false);
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={current ? t('partners.contact.edit', { name: current.name_en }) : t('partners.contact.add')}
      closeLabel={t('common.close')}
      dirty={!!f.name_en}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!f.name_en.trim() || !f.sides.length}
            loading={busy}
            onClick={() => void save()}
            data-contact-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-contact-form>
        <Field label={t('partners.contact.nameEn')}>
          {(p) => (
            <Input {...p} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} autoFocus />
          )}
        </Field>
        <Field label={t('partners.contact.nameAr')}>
          {(p) => (
            <Input
              {...p}
              dir="rtl"
              lang="ar"
              value={f.name_ar}
              onChange={(e) => setF({ ...f, name_ar: e.target.value })}
            />
          )}
        </Field>
        <Field label={t('partners.contact.role')}>
          {(p) => (
            <Select
              {...p}
              value={f.role_id}
              onValueChange={(v) => setF({ ...f, role_id: v })}
              placeholder={t('common.none')}
              options={roles.map((r) => ({ value: r.id, label: nameOf(r, locale) }))}
            />
          )}
        </Field>
        <Field label={t('partners.contact.jobTitle')}>
          {(p) => <Input {...p} value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} />}
        </Field>
        <Field label={t('partners.contact.email')}>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('partners.contact.phone')}>
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('partners.fields.notes')} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">{t('partners.contact.sides')}</span>
          {SIDES.map((s) => (
            <Checkbox
              key={s}
              label={t(`partners.side.${s}`)}
              checked={f.sides.includes(s)}
              onCheckedChange={(v) => setF({ ...f, sides: v ? [...f.sides, s] : f.sides.filter((x) => x !== s) })}
            />
          ))}
        </div>
        <Switch
          checked={f.is_primary}
          onCheckedChange={(v) => setF({ ...f, is_primary: v })}
          label={t('partners.contact.primary')}
        />
      </div>
    </Dialog>
  );
}

/** A reference to one of Direct's systems (V154): shared or on one side; a value that looks like a secret is refused. */
export function ReferenceDialog({
  open,
  onOpenChange,
  partnerId,
  current,
  systems,
  sidesOn,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  current: Reference | null;
  systems: ListEntry[];
  sidesOn: Side[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const read = (r: Reference | null) => ({
    side: r?.side ?? '',
    system: r?.system ?? '',
    value: r?.value ?? '',
    url: r?.url ?? '',
  });
  const [f, setF] = useState(read(current));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = current ? `${current.id}:${current.version}` : 'new';
  if (open && openedFor !== key) {
    setOpenedFor(key);
    setF(read(current));
  }
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const values: Record<string, unknown> = {};
    if (!current) {
      values.system = f.system;
      values.value = f.value.trim();
      if (f.url.trim()) values.url = f.url.trim();
      if (f.side) values.side = f.side;
    } else {
      if (f.system !== current.system) values.system = f.system;
      if (f.value.trim() !== current.value) values.value = f.value.trim();
      if ((f.url.trim() || null) !== (current.url ?? null)) values.url = f.url.trim() || null;
      if (!Object.keys(values).length) {
        onOpenChange(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(t('partners.reference.saved')),
      () =>
        rpc('reference_save', {
          p_partner: partnerId,
          p_id: (current?.id ?? null) as unknown as string,
          p_values: values as never,
          p_version: current?.version,
        }) as Promise<{
          request_id?: string | null;
        } | null>,
      {
        after: () => {
          onOpenChange(false);
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={current ? t('partners.reference.edit') : t('partners.reference.add')}
      size="sm"
      closeLabel={t('common.close')}
      dirty={!!f.value}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!f.system || !f.value.trim()}
            loading={busy}
            onClick={() => void save()}
            data-reference-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-reference-form>
        <Field label={t('partners.reference.system')}>
          {(p) => (
            <Select
              {...p}
              value={f.system}
              onValueChange={(v) => setF({ ...f, system: v })}
              options={systems.map((s) => ({ value: s.key, label: nameOf(s, locale) }))}
            />
          )}
        </Field>
        <Field label={t('partners.reference.value')}>
          {(p) => (
            <Input
              {...p}
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
              className="font-data"
              autoFocus
            />
          )}
        </Field>
        <Field label={`${t('partners.reference.url')} (${t('common.optional')})`}>
          {(p) => (
            <Input
              {...p}
              type="url"
              value={f.url}
              onChange={(e) => setF({ ...f, url: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        {!current ? (
          <Field label={t('partners.reference.side')}>
            {(p) => (
              <Select
                {...p}
                value={f.side}
                onValueChange={(v) => setF({ ...f, side: v })}
                placeholder={t('partners.reference.shared')}
                options={sidesOn.map((s) => ({ value: s, label: t(`partners.side.${s}`) }))}
              />
            )}
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

/** A contract or agreement on one side (V56, V153): title, dates, reminders; the side is fixed once set. */
export function ContractDialog({
  open,
  onOpenChange,
  partnerId,
  current,
  sidesOn,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  current: Contract | null;
  sidesOn: SideFull[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const words = useWords();
  const read = (c: Contract | null) => ({
    side: c?.side ?? sidesOn[0]?.side ?? '',
    kind: c?.kind ?? 'contract',
    title: c?.title ?? '',
    start_on: c?.start_on ?? today(),
    end_on: c?.end_on ?? '',
    reminders_on: c?.reminders_on ?? true,
    notes: c?.notes ?? '',
  });
  const [f, setF] = useState(read(current));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = current ? `${current.id}:${current.version}` : 'new';
  if (open && openedFor !== key) {
    setOpenedFor(key);
    setF(read(current));
  }
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const typed: Record<string, unknown> = {
      kind: f.kind,
      title: f.title.trim(),
      start_on: f.start_on,
      end_on: f.end_on || null,
      reminders_on: f.reminders_on,
      notes: f.notes.trim() || null,
    };
    const values: Record<string, unknown> = {};
    if (!current) Object.assign(values, typed, { side: f.side });
    else {
      const was = read(current);
      for (const [k, v] of Object.entries(typed)) {
        const before = (was as Record<string, unknown>)[k];
        if (JSON.stringify(v) !== JSON.stringify(typeof before === 'string' ? before.trim() || null : before))
          values[k] = v;
      }
      if (!Object.keys(values).length) {
        onOpenChange(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(
        current ? t('partners.contract.updated', { title: f.title }) : t('partners.contract.added', { title: f.title }),
      ),
      () =>
        rpc('contract_save', {
          p_partner: partnerId,
          p_id: (current?.id ?? null) as unknown as string,
          p_values: values as never,
          p_version: current?.version,
        }) as Promise<{
          request_id?: string | null;
        } | null>,
      {
        after: () => {
          onOpenChange(false);
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={current ? t('partners.contract.edit', { title: current.title }) : t('partners.contract.add')}
      closeLabel={t('common.close')}
      dirty={!!f.title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!f.title.trim() || !f.start_on || !f.side || (!!f.end_on && f.end_on < f.start_on)}
            loading={busy}
            onClick={() => void save()}
            data-contract-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-contract-form>
        <Field label={t('partners.contract.title')} className="sm:col-span-2">
          {(p) => <Input {...p} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />}
        </Field>
        <Field label={t('partners.contract.side')}>
          {(p) => (
            <Select
              {...p}
              value={f.side}
              onValueChange={(v) => setF({ ...f, side: v as Side })}
              disabled={!!current}
              options={sidesOn.map((s) => ({ value: s.side, label: t(`partners.side.${s.side}`) }))}
            />
          )}
        </Field>
        <Field label={t('partners.contract.kind')}>
          {(p) => (
            <Select
              {...p}
              value={f.kind}
              onValueChange={(v) => setF({ ...f, kind: v as 'contract' | 'agreement' })}
              options={(['contract', 'agreement'] as const).map((k) => ({
                value: k,
                label: t(`partners.contract.kinds.${k}`),
              }))}
            />
          )}
        </Field>
        <Field label={t('partners.contract.startOn')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.start_on}
              onChange={(e) => setF({ ...f, start_on: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={`${t('partners.contract.endOn')} (${t('common.optional')})`}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.end_on}
              min={f.start_on}
              onChange={(e) => setF({ ...f, end_on: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('partners.fields.notes')} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}
        </Field>
        <Switch
          checked={f.reminders_on}
          onCheckedChange={(v) => setF({ ...f, reminders_on: v })}
          label={t('partners.contract.reminders')}
        />
      </div>
    </Dialog>
  );
}
