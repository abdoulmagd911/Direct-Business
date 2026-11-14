'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { Me } from '@/core/auth/me';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { bannedIn } from '@/core/words/banned';
import type { PartnerRef } from '@/modules/my-day/types';
import { nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { nameOf, type ListEntry, type Side } from '../types';

/**
 * New partner / New supplier (V149: api.partner_create with one side — type required, tier, owner; the owner
 * is the caller unless named). The organisation opens once created; the other side is switched on from its record.
 */
export function NewPartnerDialog({
  open,
  onOpenChange,
  side,
  me,
  org,
  types,
  tiers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  side: Side;
  me: Me;
  org: OrgAnswer;
  types: ListEntry[];
  tiers: ListEntry[];
  onCreated: (id: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const canAssign = me.capabilities.includes(`${side === 'client' ? 'clients' : 'suppliers_partners'}.assign`);
  const [f, setF] = useState({
    trade_name_en: '',
    trade_name_ar: '',
    type: '',
    tier: '',
    owner: me.person.id,
    key: false,
  });
  const [busy, setBusy] = useState(false);
  /** L23: a name that already exists warns before Save — the roles live on the one record, so the reader is sent
   * to it instead of making a second one. Save stays on: two companies can share a name. As in PartnerPicker,
   * the matches are the search's answer for the typed term, never a guess. */
  const [found, setFound] = useState<{ term: string; hits: PartnerRef[] }>({ term: '', hits: [] });
  const term = f.trade_name_en.trim().length >= 2 ? f.trade_name_en.trim() : f.trade_name_ar.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    rpc('search', { p_q: term, p_limit: 8 })
      .then((a) => {
        if (!live) return;
        const norm = (s: string) => s.trim().toLowerCase();
        const n = norm(term);
        setFound({
          term,
          hits: ((a as { partners?: PartnerRef[] } | null)?.partners ?? []).filter(
            (p) => norm(p.trade_name_en) === n || (p.trade_name_ar != null && norm(p.trade_name_ar) === n),
          ),
        });
      })
      .catch(() => live && setFound({ term, hits: [] }));
    return () => {
      live = false;
    };
  }, [term]);
  const dupes = term.length >= 2 && found.term === term ? found.hits : [];
  const banned = bannedIn(f.trade_name_en) ?? bannedIn(f.trade_name_ar);
  const ok = !banned && f.trade_name_en.trim().length > 0 && !!f.type;
  const save = async () => {
    setBusy(true);
    await command(
      {
        done: t('partners.created', { name: f.trade_name_en.trim() }),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k) => t.has(k),
        failed: (k, d) => t(k, { detail: d }),
      },
      () =>
        rpc('partner_create', {
          p_partner: {
            trade_name_en: f.trade_name_en.trim(),
            trade_name_ar: f.trade_name_ar.trim() || null,
            key_partner: f.key,
            sides: [
              {
                side,
                type: f.type,
                ...(f.tier ? { tier: f.tier } : {}),
                ...(f.owner && f.owner !== me.person.id ? { owner_id: f.owner } : {}),
              },
            ],
          } as never,
        }) as Promise<{ id?: string; request_id?: string | null } | null>,
      {
        after: (r) => {
          onOpenChange(false);
          if (r?.id) onCreated(r.id);
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={side === 'client' ? t('partners.newClient') : t('partners.newSupplier')}
      closeLabel={t('common.close')}
      dirty={f.trade_name_en !== ''}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-partner-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-partner-form>
        <Field
          label={t('partners.fields.tradeNameEn')}
          required={t('common.required')}
          className="sm:col-span-2"
          error={banned ? t('settings.list.banned', { word: banned }) : undefined}
        >
          {(p) => (
            <Input
              {...p}
              value={f.trade_name_en}
              onChange={(e) => setF({ ...f, trade_name_en: e.target.value })}
              autoFocus
            />
          )}
        </Field>
        <Field label={t('partners.fields.tradeNameAr')} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              dir="rtl"
              lang="ar"
              value={f.trade_name_ar}
              onChange={(e) => setF({ ...f, trade_name_ar: e.target.value })}
            />
          )}
        </Field>
        {dupes.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-warning bg-warning-soft p-3 text-sm sm:col-span-2"
            data-new-partner-duplicate
          >
            <p className="font-medium">{t('partners.duplicateName')}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {dupes.map((d) => (
                <Link key={d.id} href={`/partners/${d.id}`} className="font-medium underline">
                  {locale === 'ar' && d.trade_name_ar ? d.trade_name_ar : d.trade_name_en} ({d.number})
                </Link>
              ))}
            </p>
            <p className="mt-1 text-muted">{t('partners.duplicateNameOpen', { side: t(`partners.sides.${side}`) })}</p>
          </div>
        )}
        <Field label={t('partners.columns.type')} required={t('common.required')}>
          {(p) => (
            <Select
              {...p}
              value={f.type}
              placeholder={t('partners.chooseType')}
              onValueChange={(v) => setF({ ...f, type: v })}
              options={types.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        {tiers.length ? (
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
        ) : null}
        {canAssign ? (
          <Field
            label={side === 'client' ? t('partners.accountManager') : t('partners.relationshipOwner')}
            className="sm:col-span-2"
          >
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
        <div className="flex min-h-11 items-center justify-between gap-3" data-key-partner>
          <span className="text-sm font-medium" id="new-partner-key">
            {t('partners.keyPartner')}
          </span>
          <Switch checked={f.key} onCheckedChange={(v) => setF({ ...f, key: v })} label={t('partners.keyPartner')} />
        </div>
      </div>
    </Dialog>
  );
}
