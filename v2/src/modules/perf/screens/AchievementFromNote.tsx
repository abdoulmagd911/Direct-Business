'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { noteText, noteTitle } from '@/modules/my-day/logic';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import type { MyNote } from '@/modules/my-day/types';
import type { PartnerRef } from '@/modules/my-day/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import type { Category } from '../types';
import { riyadhToday } from './LogAchievement';
import { useCommandWords } from './words';

type System = { key: string; name_en: string; name_ar: string };

/**
 * Turn a note into an achievement (V379, QA-517): the category first, then what was achieved (the note's title or its
 * words), the day (the meeting's, else the note's), the organisation (a meeting note's), the side of an MoU, the deal
 * value where the category carries one, and the reference a category requires. One request through
 * api.note_turn_into, so the achievement's own rules hold; the toast offers Undo, and the note shows what it became.
 */
export function AchievementFromNoteDialog({
  note,
  open,
  onOpenChange,
}: {
  note: MyNote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations('common');
  const locale = useLocale() as 'en' | 'ar';
  const words = useCommandWords();
  const fresh = () => ({
    code: '',
    title: noteTitle(note) || noteText(note).slice(0, 300),
    on: note.meeting_on ?? note.happened_on,
    partner: note.meeting_partner as PartnerRef | null,
    side: '' as 'client' | 'supplier_partner' | '',
    value: '',
    ref: '',
  });
  const [f, setF] = useState(fresh);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [systems, setSystems] = useState<System[]>([]);
  const [busy, setBusy] = useState(false);
  const year = Number((f.on || riyadhToday()).slice(0, 4));

  // the categories are the plan's of the day's year (§5a); read when the dialog opens and when the year changes
  useEffect(() => {
    if (!open) return;
    let live = true;
    (rpc('achievement_categories', { p_year: year }) as unknown as Promise<Category[]>)
      .then((rows) => live && setCategories(rows))
      .catch(() => live && setCategories([]));
    return () => {
      live = false;
    };
  }, [open, year]);
  useEffect(() => {
    if (!open || systems.length) return;
    (rpc('list', { p_list: 'ref_system' }) as unknown as Promise<System[]>).then(setSystems).catch(() => {});
  }, [open, systems.length]);

  const live = (categories ?? []).filter((c) => c.active);
  const cat = live.find((c) => c.code === f.code);
  const needsRef = cat?.required_ref_system ?? null;
  const needsSide = !!cat?.sets_prospect && !!f.partner;
  const ok = !!cat && !!f.title.trim() && (!needsRef || !!f.ref.trim()) && (!needsSide || !!f.side);
  const name = (c: Category) => (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en);

  const save = async () => {
    if (!cat) return;
    setBusy(true);
    const system = needsRef ?? systems[0]?.key;
    await command(
      words(t('logged')),
      () =>
        rpc('note_turn_into', {
          p_note: note.id,
          p_kind: 'achievement',
          p_values: {
            category: cat.code,
            title: f.title.trim(),
            happened_on: f.on || null,
            partner_id: f.partner?.id ?? null,
            ...(cat.has_deal_value && f.value.trim() ? { deal_value: Number(f.value.replace(/,/g, '')) } : {}),
            ...(needsSide && f.side ? { side: f.side } : {}),
            ...(f.ref.trim() && system ? { refs: [{ system, value: f.ref.trim(), url: null }] } : {}),
          },
        }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          onOpenChange(false);
          setF(fresh());
        },
      },
    );
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fromNote.title')}
      description={noteTitle(note) || undefined}
      closeLabel={tc('close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button
            variant="primary"
            disabled={!ok || busy}
            loading={busy}
            onClick={() => void save()}
            data-achievement-from-note-save
          >
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-achievement-from-note>
        {categories && !live.length ? (
          <p className="text-sm text-muted sm:col-span-2" data-no-categories>
            {t('fromNote.noCategories', { year })}
          </p>
        ) : (
          <Field label={t('fields.category')} className="sm:col-span-2">
            {(p) => (
              <Select
                id={p.id}
                aria-label={t('fields.category')}
                value={f.code || undefined}
                placeholder={t('actions.choose')}
                options={live.map((c) => ({ value: c.code, label: name(c) }))}
                onValueChange={(code) => setF({ ...f, code })}
              />
            )}
          </Field>
        )}
        <Field label={t('fields.title')} className="sm:col-span-2">
          {(p) => (
            <Input {...p} value={f.title} maxLength={300} onChange={(e) => setF({ ...f, title: e.target.value })} />
          )}
        </Field>
        <Field label={t('fields.date')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.on}
              max={riyadhToday()}
              onChange={(e) => setF({ ...f, on: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('fields.organisation')}>
          {(p) => <PartnerPicker id={p.id} value={f.partner} onChange={(partner) => setF({ ...f, partner })} />}
        </Field>
        {needsSide ? (
          <Field label={t('fields.side')}>
            {(p) => (
              <Select
                id={p.id}
                aria-label={t('fields.side')}
                value={f.side || undefined}
                placeholder={t('actions.choose')}
                options={(['client', 'supplier_partner'] as const).map((k) => ({ value: k, label: t(`sides.${k}`) }))}
                onValueChange={(v) => setF({ ...f, side: v as 'client' | 'supplier_partner' })}
              />
            )}
          </Field>
        ) : null}
        {cat?.has_deal_value ? (
          <Field label={`${t('fields.value')} · ${t('notRevenue')}`}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                mono
                value={f.value}
                onChange={(e) => setF({ ...f, value: e.target.value })}
              />
            )}
          </Field>
        ) : null}
        {needsRef ? (
          <Field
            label={`${t('fields.reference')} · ${systems.find((s) => s.key === needsRef)?.[locale === 'ar' ? 'name_ar' : 'name_en'] ?? needsRef}`}
          >
            {(p) => (
              <Input {...p} value={f.ref} maxLength={200} onChange={(e) => setF({ ...f, ref: e.target.value })} />
            )}
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
