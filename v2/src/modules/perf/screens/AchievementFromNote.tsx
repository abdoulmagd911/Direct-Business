'use client';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { noteText, noteTitle } from '@/modules/my-day/logic';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import { PeoplePicker } from '@/modules/my-day/screens/PeoplePicker';
import type { MyNote } from '@/modules/my-day/types';
import type { PartnerRef } from '@/modules/my-day/types';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import type { Category } from '../types';
import { readDealValue, riyadhToday } from './LogAchievement';
import { withRefusal } from '@/core/commands/refusal';
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
  people,
}: {
  note: MyNote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** The colleagues the turn can name as participants (FIX-06) — the note's mentions carry over on their own. */
  people?: { id: string; name: string }[];
}) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations('common');
  const tt = useTranslations('pages.myDay.turn');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const fresh = () => ({
    code: '',
    title: noteTitle(note) || noteText(note).slice(0, 300),
    on: note.meeting_on ?? note.happened_on,
    partner: note.meeting_partner as PartnerRef | null,
    side: '' as 'client' | 'supplier_partner' | '',
    value: '',
    ref: '',
    participants: [] as string[],
  });
  const [f, setF] = useState(fresh);
  // the form is prefilled from the note as it stands when the dialog opens, not as it stood when the page mounted:
  // the dialog stays mounted while the note is edited, so a mount-time prefill showed the old title (F059).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setF(fresh());
  }
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [systems, setSystems] = useState<System[]>([]);
  const [busy, setBusy] = useState(false);
  /** FIX-06: the achievement just saved — the post-save dialog offers it (same) or another turn (new). */
  const [saved, setSaved] = useState<{ id: string; number: string } | null>(null);
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
  // FIX-06: the value is a plain number — the unit is the category's own name, in the field's label; never
  // Revenue/Cost/Profit, and the "not revenue" note stands. The box shows for a category that carries a deal value
  // only: the database refuses a value on any other (achievement.no_deal_value).
  const withValue = !!cat?.has_deal_value;
  const valueBad = withValue && !!f.value.trim() && readDealValue(f.value) === null;
  const ok = !!cat && !!f.title.trim() && (!needsRef || !!f.ref.trim()) && (!needsSide || !!f.side) && !valueBad;
  const name = (c: Category) => (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en);
  const valueLabel = cat
    ? `${t('fields.valueLabel')} (${locale === 'ar' ? cat.name_ar : cat.name_en}) · ${t('notRevenue')}`
    : t('fields.valueLabel');

  const save = async () => {
    if (!cat) return;
    setBusy(true);
    const system = needsRef ?? systems[0]?.key;
    // the command runs `after` once on the save and again when Undo is pressed on its toast
    // (src/core/commands/command.ts, done()): the second run is the Undo — the achievement is gone, so the
    // "Achievement logged" dialog must not open (again) for it.
    let savedOnce = false;
    await command(
      withRefusal(words(t('logged')), tt('refused.achievement')),
      () =>
        rpc('note_turn_into', {
          p_note: note.id,
          p_kind: 'achievement',
          p_values: {
            category: cat.code,
            title: f.title.trim(),
            happened_on: f.on || null,
            partner_id: f.partner?.id ?? null,
            ...(withValue && f.value.trim() ? { deal_value: readDealValue(f.value)! } : {}),
            ...(needsSide && f.side ? { side: f.side } : {}),
            ...(f.ref.trim() && system ? { refs: [{ system, value: f.ref.trim(), url: null }] } : {}),
            ...(f.participants.length ? { participants: f.participants } : {}),
          },
        }) as Promise<{ id?: string; number?: string; request_id?: string | null }>,
      // FIX-06: after save the dialog asks — view the record just saved (same), or turn another note (new) —
      // instead of closing straight away. The note keeps showing what it became either way.
      {
        after: (r) => {
          if (savedOnce) return setSaved((s) => (s?.id === r?.id ? null : s));
          savedOnce = true;
          setF(fresh());
          if (r?.id) setSaved({ id: r.id, number: r.number ?? '' });
          else onOpenChange(false);
        },
      },
    );
    setBusy(false);
  };

  return (
    <>
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
            <Field label={t('fields.category')} className="sm:col-span-2" required={tc('required')}>
              {(p) => (
                <Select
                  id={p.id}
                  aria-label={t('fields.category')}
                  value={f.code}
                  placeholder={t('actions.choose')}
                  options={live.map((c) => ({ value: c.code, label: name(c) }))}
                  onValueChange={(code) => setF({ ...f, code })}
                />
              )}
            </Field>
          )}
          <Field label={t('fields.title')} className="sm:col-span-2" required={tc('required')}>
            {(p) => (
              <Input {...p} value={f.title} maxLength={300} onChange={(e) => setF({ ...f, title: e.target.value })} />
            )}
          </Field>
          <Field label={t('fields.date')} className="sm:col-span-2">
            {(p) => (
              <DatePicker
                id={p.id}
                describedBy={p['aria-describedby']}
                invalid={p['aria-invalid']}
                value={f.on || undefined}
                min="2025-01-01"
                max={riyadhToday()}
                onChange={(v) => setF({ ...f, on: v ?? '' })}
                className="font-data"
              />
            )}
          </Field>
          <Field label={t('fields.organisation')} className="sm:col-span-2">
            {(p) => <PartnerPicker id={p.id} value={f.partner} onChange={(partner) => setF({ ...f, partner })} />}
          </Field>
          {needsSide ? (
            <Field label={t('fields.side')} required={tc('required')}>
              {(p) => (
                <Select
                  id={p.id}
                  aria-label={t('fields.side')}
                  value={f.side}
                  placeholder={t('actions.choose')}
                  options={(['client', 'supplier_partner'] as const).map((k) => ({ value: k, label: t(`sides.${k}`) }))}
                  onValueChange={(v) => setF({ ...f, side: v as 'client' | 'supplier_partner' })}
                />
              )}
            </Field>
          ) : null}
          {withValue ? (
            <Field label={valueLabel} error={valueBad ? t('valueNotNumber') : undefined}>
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
              required={tc('required')}
            >
              {(p) => (
                <Input {...p} value={f.ref} maxLength={200} onChange={(e) => setF({ ...f, ref: e.target.value })} />
              )}
            </Field>
          ) : null}
          {/* FIX-06: who else took part, beside the note's mentions — the mentions carry over on their own. */}
          {(people ?? []).length ? (
            <Field label={t('fields.participants')} className="sm:col-span-2">
              {(p) => (
                <div className="flex flex-col gap-2" data-from-note-participants>
                  {f.participants.length ? (
                    <ul className="flex flex-col gap-1">
                      {f.participants.map((id) => {
                        const person = (people ?? []).find((x) => x.id === id);
                        return (
                          <li
                            key={id}
                            className="flex items-center justify-between gap-2"
                            data-from-note-participant={id}
                          >
                            <span className="min-w-0 break-words">{person?.name ?? '—'}</span>
                            <IconButton
                              size="sm"
                              label={t('actions.removeParticipant', { name: person?.name ?? '' })}
                              icon={<X />}
                              onClick={() => setF({ ...f, participants: f.participants.filter((x) => x !== id) })}
                              data-participant-remove={id}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <PeoplePicker
                    id={p.id}
                    variant="mention"
                    options={(people ?? []).filter((x) => !f.participants.includes(x.id))}
                    onPick={(v) => setF({ ...f, participants: [...f.participants, v] })}
                  />
                </div>
              )}
            </Field>
          ) : null}
        </div>
      </Dialog>
      {/* FIX-06: after save — view the record just saved (same), or turn another note (new). */}
      <Dialog
        open={saved !== null}
        onOpenChange={(o) => !o && setSaved(null)}
        title={t('savedDialog.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaved(null)} data-saved-new>
              {t('savedDialog.new')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!saved) return;
                onOpenChange(false);
                setSaved(null);
                router.push(`/kpis/achievements/${saved.id}`);
              }}
              data-saved-same
            >
              {t('savedDialog.same')}
            </Button>
          </>
        }
      >
        {saved ? (
          <p className="text-text" data-post-save>
            {saved.number ? t('savedDialog.body', { number: saved.number }) : t('savedDialog.bodyNoNumber')}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
