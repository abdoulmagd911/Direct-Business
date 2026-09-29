'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Me } from '@/core/auth/me';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { SIDE_PAGE, STATUSES, nameOf, type ListEntry, type Side, type SideFull, type Status } from '../../types';
import { today, useWords } from './words';

/** Switch a side on (V149: type and owner required) or change its type, tier or start. */
export function SideDialog({
  open,
  onOpenChange,
  partnerId,
  side,
  current,
  me,
  org,
  types,
  tiers,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  side: Side;
  /** The side as it stands when editing; null when switching it on. */
  current: SideFull | null;
  me: Me;
  org: OrgAnswer;
  types: ListEntry[];
  tiers: ListEntry[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const canAssign = me.capabilities.includes(`${SIDE_PAGE[side]}.assign`);
  const [f, setF] = useState({
    type: current?.type ?? '',
    tier: tiers.find((x) => x.id === current?.tier_id)?.key ?? '',
    owner: current?.owner_id ?? me.person.id,
    since: current?.since ?? today(),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const values: Record<string, unknown> = {};
    if (!current) {
      values.type = f.type;
      if (f.tier) values.tier = f.tier;
      if (f.owner && f.owner !== me.person.id) values.owner_id = f.owner;
      if (f.since) values.since = f.since;
    } else {
      if (f.type !== current.type) values.type = f.type;
      const tierKey = tiers.find((x) => x.id === current.tier_id)?.key ?? '';
      if (f.tier !== tierKey) values.tier = f.tier || null;
      if (f.since !== (current.since ?? '')) values.since = f.since || null;
      if (!Object.keys(values).length) {
        onOpenChange(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(
        current
          ? t('partners.sideDialog.changed', { side: t(`partners.side.${side}`) })
          : t('partners.sideDialog.on', { side: t(`partners.side.${side}`) }),
      ),
      () =>
        rpc('partner_side_set', { p_id: partnerId, p_side: side, p_values: values as never }) as Promise<{
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
      title={
        current
          ? t('partners.sideDialog.editTitle', { side: t(`partners.side.${side}`) })
          : t('partners.sideDialog.onTitle', { side: t(`partners.side.${side}`) })
      }
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!f.type} loading={busy} onClick={() => void save()} data-side-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-side-form={side}>
        <Field label={t('partners.columns.type')}>
          {(p) => (
            <Select
              {...p}
              value={f.type}
              onValueChange={(v) => setF({ ...f, type: v })}
              options={types.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Field label={t('partners.tier')}>
          {(p) => (
            <Select
              {...p}
              value={f.tier}
              onValueChange={(v) => setF({ ...f, tier: v })}
              placeholder={t('common.none')}
              options={tiers.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        {!current && canAssign ? (
          <Field label={side === 'client' ? t('partners.accountManager') : t('partners.relationshipOwner')}>
            {(p) => (
              <Select
                {...p}
                value={f.owner}
                onValueChange={(v) => setF({ ...f, owner: v })}
                options={org.people.map((x) => ({ value: x.id, label: personName(x, locale) }))}
              />
            )}
          </Field>
        ) : null}
        <Field label={t('partners.sideDialog.since')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.since}
              onChange={(e) => setF({ ...f, since: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/** Switch a side off from a day (V146: everything is kept; the last side stays on). */
export function SideOffDialog({
  open,
  onOpenChange,
  partnerId,
  side,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  side: Side;
  onDone: () => void;
}) {
  const t = useTranslations();
  const words = useWords();
  const [until, setUntil] = useState(today());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.sideDialog.off', { side: t(`partners.side.${side}`) })),
      () =>
        rpc('partner_side_off', {
          p_id: partnerId,
          p_side: side,
          p_until: until,
          p_reason: reason.trim() || undefined,
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
      title={t('partners.sideDialog.offTitle', { side: t(`partners.side.${side}`) })}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" disabled={!until} loading={busy} onClick={() => void save()} data-side-off-save>
            {t('partners.sideDialog.switchOff')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('partners.sideDialog.until')}>
          {(p) => (
            <Input {...p} type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="font-data" />
          )}
        </Field>
        <Field label={`${t('common.reason')} (${t('common.optional')})`}>
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** Set a side's status (V62 as V146 keeps it): with its day, and a reason for At risk and Lost. */
export function StatusDialog({
  open,
  onOpenChange,
  partnerId,
  side,
  current,
  reasons,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  side: Side;
  current: Status | null;
  reasons: ListEntry[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [f, setF] = useState({ status: '' as Status | '', on: today(), reason: '', note: '' });
  const [busy, setBusy] = useState(false);
  const needsReason = f.status === 'at_risk' || f.status === 'lost';
  const own = reasons.filter((r) => r.side === side && (!r.status || r.status === f.status));
  const ok = !!f.status && !!f.on && (!needsReason || !!f.reason);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.statusDialog.set', { status: t(`partners.status.${f.status}`) })),
      () =>
        rpc('partner_status_set', {
          p_id: partnerId,
          p_side: side,
          p_status: f.status,
          p_effective_on: f.on,
          p_reason_id: f.reason || undefined,
          p_note: f.note.trim() || undefined,
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
      title={t('partners.statusDialog.title', { side: t(`partners.side.${side}`) })}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-status-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-status-form>
        <Field label={t('partners.columns.status')}>
          {(p) => (
            <Select
              {...p}
              value={f.status}
              onValueChange={(v) => setF({ ...f, status: v as Status, reason: '' })}
              options={STATUSES.filter((s) => s !== current).map((s) => ({
                value: s,
                label: t(`partners.status.${s}`),
              }))}
            />
          )}
        </Field>
        <Field label={t('partners.statusDialog.effectiveOn')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.on}
              onChange={(e) => setF({ ...f, on: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        {needsReason ? (
          <Field label={t('common.reason')} error={!f.reason ? t('partners.statusDialog.reasonRequired') : undefined}>
            {(p) => (
              <Select
                {...p}
                value={f.reason}
                onValueChange={(v) => setF({ ...f, reason: v })}
                options={own.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
              />
            )}
          </Field>
        ) : null}
        <Field label={`${t('partners.statusDialog.note')} (${t('common.optional')})`}>
          {(p) => <Textarea {...p} rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** Set a side's owner from a day (V146: the account manager on the Client side, the relationship owner on the other). */
export function OwnerDialog({
  open,
  onOpenChange,
  partnerId,
  side,
  current,
  org,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  side: Side;
  current: string | null;
  org: OrgAnswer;
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [f, setF] = useState({ person: '', from: today(), reason: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const who = org.people.find((p) => p.id === f.person);
    await command(
      words(t('partners.ownerDialog.set', { name: who ? personName(who, locale) : '' })),
      () =>
        rpc('partner_owner_set', {
          p_id: partnerId,
          p_side: side,
          p_person: f.person,
          p_from: f.from,
          p_reason: f.reason.trim() || undefined,
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
      title={side === 'client' ? t('partners.ownerDialog.titleClient') : t('partners.ownerDialog.titleSupplier')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!f.person || f.person === current || !f.from}
            loading={busy}
            onClick={() => void save()}
            data-owner-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-owner-form>
        <Field label={side === 'client' ? t('partners.accountManager') : t('partners.relationshipOwner')}>
          {(p) => (
            <Select
              {...p}
              value={f.person}
              onValueChange={(v) => setF({ ...f, person: v })}
              options={org.people.map((x) => ({ value: x.id, label: personName(x, locale) }))}
            />
          )}
        </Field>
        <Field label={t('partners.ownerDialog.from')}>
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
        <Field label={`${t('common.reason')} (${t('common.optional')})`}>
          {(p) => (
            <Textarea {...p} rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
