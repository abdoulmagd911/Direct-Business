'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command, type ConflictField } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { bannedIn } from '@/core/words/banned';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { nameOf, type ListEntry, type PartnerCard } from '../../types';
import { useWords } from './words';

const FIELDS = [
  'trade_name_en',
  'trade_name_ar',
  'official_name_en',
  'official_name_ar',
  'website',
  'city',
  'country',
  'address',
  'notes',
  'client_since',
  'priority_id',
  'key_partner',
] as const;
type Key = (typeof FIELDS)[number];

/**
 * Edit the shared part of an organisation (V98: names, place, notes, key partner, priority — the sides have their own
 * doors). Only the fields that changed are written (api.partner_update checks the version per field); a conflict opens
 * the dialog of P3-7 (FLOW-08). A name change moves its identifiers in the same request (V77).
 */
export function EditPartnerDialog({
  open,
  onOpenChange,
  card,
  priorities,
  nameOfPerson,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  card: PartnerCard;
  priorities: ListEntry[];
  nameOfPerson: (id: string) => string | undefined;
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const read = (c: PartnerCard): Record<Key, string | boolean> => ({
    trade_name_en: c.trade_name_en,
    trade_name_ar: c.trade_name_ar ?? '',
    official_name_en: c.official_name_en ?? '',
    official_name_ar: c.official_name_ar ?? '',
    website: c.website ?? '',
    city: c.city ?? '',
    country: c.country ?? '',
    address: c.address ?? '',
    notes: c.notes ?? '',
    client_since: c.client_since ?? '',
    priority_id: c.priority_id ?? '',
    key_partner: c.key_partner,
  });
  const [f, setF] = useState(read(card));
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && openedFor !== `${card.id}:${card.version}`) {
    setOpenedFor(`${card.id}:${card.version}`);
    setF(read(card));
  }
  const [busy, setBusy] = useState(false);
  const banned = bannedIn(String(f.trade_name_en)) ?? bannedIn(String(f.trade_name_ar));
  const labels: Record<Key, string> = {
    trade_name_en: t('partners.fields.tradeNameEn'),
    trade_name_ar: t('partners.fields.tradeNameAr'),
    official_name_en: t('partners.fields.officialNameEn'),
    official_name_ar: t('partners.fields.officialNameAr'),
    website: t('partners.fields.website'),
    city: t('partners.fields.city'),
    country: t('partners.fields.country'),
    address: t('partners.fields.address'),
    notes: t('partners.fields.notes'),
    client_since: t('partners.fields.clientSince'),
    priority_id: t('partners.priority'),
    key_partner: t('partners.keyPartner'),
  };
  const asValue = (k: Key, v: string | boolean) =>
    k === 'key_partner' ? v === true : typeof v === 'string' ? v.trim() || null : v;
  const save = async () => {
    setBusy(true);
    const was = read(card);
    const changes: Record<string, unknown> = {};
    for (const k of FIELDS) if (asValue(k, f[k]) !== asValue(k, was[k])) changes[k] = asValue(k, f[k]);
    if (!Object.keys(changes).length) {
      onOpenChange(false);
      setBusy(false);
      return;
    }
    const show = (k: Key) => (v: unknown) =>
      k === 'key_partner'
        ? v
          ? t('common.yes')
          : t('common.no')
        : k === 'priority_id'
          ? nameOf(
              priorities.find((x) => x.id === v),
              locale,
            ) || '—'
          : v === null || v === undefined || v === ''
            ? '—'
            : String(v);
    const fields: ConflictField[] = (Object.keys(changes) as Key[]).map((k) => ({
      key: k,
      label: labels[k],
      mine: changes[k],
      read: asValue(k, was[k]),
      show: show(k),
    }));
    const write = (values: Record<string, unknown>, version: number) =>
      rpc('partner_update', { p_id: card.id, p_changes: values as never, p_version: version }) as Promise<{
        request_id?: string | null;
      } | null>;
    await command(words(t('partners.updated', { name: card.trade_name_en })), () => write(changes, card.version), {
      after: () => {
        onOpenChange(false);
        onDone();
      },
      nameOf: nameOfPerson,
      conflict: {
        fields,
        theirs: async () => {
          const now = (await rpc('partner', { p_id: card.id })) as unknown as PartnerCard;
          const values: Record<string, unknown> = {};
          const r = read(now);
          for (const k of FIELDS) values[k] = asValue(k, r[k]);
          return { version: now.version, values };
        },
        retry: write,
      },
    });
    setBusy(false);
  };
  const text = (k: Key, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Field key={k} label={labels[k]} className={k === 'address' || k === 'notes' ? 'sm:col-span-2' : undefined}>
      {(p) =>
        k === 'notes' || k === 'address' ? (
          <Textarea {...p} rows={2} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ) : (
          <Input {...p} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
        )
      }
    </Field>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partners.edit', { name: card.trade_name_en })}
      size="lg"
      closeLabel={t('common.close')}
      dirty
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!!banned || !String(f.trade_name_en).trim()}
            loading={busy}
            onClick={() => void save()}
            data-partner-edit-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-partner-edit-form>
        <Field label={labels.trade_name_en} error={banned ? t('settings.list.banned', { word: banned }) : undefined}>
          {(p) => (
            <Input
              {...p}
              value={String(f.trade_name_en)}
              onChange={(e) => setF({ ...f, trade_name_en: e.target.value })}
              autoFocus
            />
          )}
        </Field>
        {text('trade_name_ar', { dir: 'rtl', lang: 'ar' })}
        {text('official_name_en')}
        {text('official_name_ar', { dir: 'rtl', lang: 'ar' })}
        {text('website', { type: 'url' })}
        {text('client_since', { type: 'date', className: 'font-data' })}
        {text('city')}
        {text('country')}
        {text('address')}
        {text('notes')}
        <Field label={labels.priority_id}>
          {(p) => (
            <Select
              {...p}
              value={String(f.priority_id)}
              onValueChange={(v) => setF({ ...f, priority_id: v })}
              placeholder={t('common.none')}
              options={priorities.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Switch
          checked={f.key_partner === true}
          onCheckedChange={(v) => setF({ ...f, key_partner: v })}
          label={labels.key_partner}
        />
      </div>
    </Dialog>
  );
}
