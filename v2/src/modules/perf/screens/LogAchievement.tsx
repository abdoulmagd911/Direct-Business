'use client';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { TIME_ZONE } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Dialog } from '@/ui/Dialog';
import { formatDate } from '@/core/i18n/format';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import { PeoplePicker } from '@/modules/my-day/screens/PeoplePicker';
import type { PartnerRef } from '@/modules/my-day/types';
import type { Category, RepeatMatch } from '../types';
import { useCommandWords } from './words';

/**
 * The deal value as typed: digits, one decimal point and commas, nothing else (the Architect's ruling of 16 Oct).
 * Arabic-Indic digits and their separators read as the digits they are. Returns the number, or null when the text is
 * not one — the form then says "Enter a number" and does not save.
 */
export function readDealValue(text: string): number | null {
  const plain = text
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\u066b/g, '.')
    .replace(/\u066c/g, ',');
  if (!/^[\d,]*\.?\d*$/.test(plain) || !/\d/.test(plain)) return null;
  return Number(plain.replace(/,/g, ''));
}

/** Today in Riyadh as `YYYY-MM-DD` (D20): the date an achievement takes unless its evidence says another. */
export function riyadhToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

/**
 * Log achievement (GC-4, §3.8): the category first, then what was achieved and the date on its evidence (empty: a
 * draft that never counts until dated — V68), the organisation, the deal value where the category carries one (V505,
 * "not revenue"), and a Direct reference as evidence (V99) — required where the category needs it (V375). A manager
 * with Full logs it for someone else (V467). One request; the toast offers Undo; the record page opens.
 */
export function LogAchievement({
  categories: first,
  year,
  people,
  systems,
  meId,
  full,
  department,
  canOpenPlan,
  initialTitle = '',
  sourceTaskId = '',
}: {
  categories: Category[];
  year: number;
  people: { id: string; name: string }[];
  systems: { key: string; name: string }[];
  meId: string;
  full: boolean;
  /** The person's department, named in the empty state. */
  department: { id: string; name: string };
  /** An admin (Full on Settings → Targets) may open the year's plan from here (V380). */
  canOpenPlan: boolean;
  /** Words to start the title with (a task marked Done offers its own). */
  initialTitle?: string;
  /** The task this achievement came from (the strip or the Done row passes ?task=): stored as source_task_id. */
  sourceTaskId?: string;
}) {
  const t = useTranslations('pages.achievements');
  // "Required" beside each box Save waits for, so a greyed Save has a reason on screen
  const required = useTranslations('common')('required');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const [categories, setCategories] = useState(first);
  const [loadedYear, setLoadedYear] = useState(year);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState(initialTitle);
  const [day, setDay] = useState(riyadhToday());
  const [partner, setPartner] = useState<PartnerRef | null>(null);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState(meId);
  const [participants, setParticipants] = useState<string[]>([]);
  /** FIX-06: the achievement just saved — the post-save dialog offers it (same) or another log (new). */
  const [saved, setSaved] = useState<{ id: string; number: string } | null>(null);
  const [system, setSystem] = useState(systems[0]?.key ?? '');
  const [ref, setRef] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState<'client' | 'supplier_partner' | ''>('');
  const [repeats, setRepeats] = useState<RepeatMatch[]>([]);
  const cat = categories.find((c) => c.code === code);
  const needsRef = cat?.required_ref_system ?? null;
  // V521: an MoU with an organisation names the side it was signed with.
  const needsSide = !!cat?.sets_prospect && !!partner;
  // The value box shows for a category that carries a deal value only (Settings → Targets, "Carries a deal value"):
  // the database refuses a value on any other category (achievement.no_deal_value), so offering the box on Awards
  // let a person type a value that could never save.
  const withValue = !!cat?.has_deal_value;

  // The categories are the plan's of the date's year (§5a): another year reads that year's.
  const loadYear = async (y: number) => {
    try {
      const rows = (await rpc('achievement_categories', { p_year: y })) as unknown as Category[];
      setCategories(rows);
      setLoadedYear(y);
      if (!rows.some((c) => c.code === code)) setCode('');
    } catch {
      setCategories([]);
      setLoadedYear(y);
    }
  };
  const onDay = async (next: string) => {
    setDay(next);
    const y = Number((next || riyadhToday()).slice(0, 4));
    if (!y || y === loadedYear) return;
    await loadYear(y);
  };

  // V380: a year with no plan has no categories — never an empty list: one sentence, and an admin opens the plan here.
  const openPlan = async () => {
    setBusy(true);
    await command(
      words(t('plan.opened', { year: loadedYear })),
      () =>
        rpc('plan_open', { p_department: department.id, p_year: loadedYear }) as Promise<{
          id: string;
          request_id?: string | null;
        }>,
      { after: () => loadYear(loadedYear) },
    );
    setBusy(false);
  };
  const live = categories.filter((c) => c.active);

  // V531: before saving, an earlier achievement of the same organisation and category with a similar title is offered
  // as a one-tap choice — never blocking: no answer from the check saves as usual.
  const check = async () => {
    if (!partner) return save(null);
    setBusy(true);
    let found: RepeatMatch[] = [];
    try {
      found = (await rpc('achievement_repeats', {
        p_partner: partner.id,
        p_category: code,
        p_title: title.trim(),
        ...(day ? { p_on: day } : {}),
      })) as unknown as RepeatMatch[];
    } catch {
      found = [];
    }
    setBusy(false);
    if (found.length) setRepeats(found);
    else await save(null);
  };

  const save = async (repeatOf: string | null) => {
    setRepeats([]);
    setBusy(true);
    const refs = ref.trim() ? [{ system: needsRef ?? system, value: ref.trim(), url: link.trim() || null }] : [];
    // the command runs `after` once on the save and again when Undo is pressed on its toast
    // (src/core/commands/command.ts, done()): the second run is the Undo — the achievement is gone, so the
    // "Achievement logged" dialog must not open (again) for it.
    let savedOnce = false;
    await command(
      words(t('logged')),
      () =>
        rpc('achievement_log', {
          p_values: {
            category: code,
            title: title.trim(),
            happened_on: day || null,
            partner_id: partner?.id ?? null,
            // FIX-06: the value is a plain number — the unit is the category's own name, in the field's label;
            // never Revenue/Cost/Profit, and the "not revenue" note stands. Sent only for a category that carries
            // a deal value: the database refuses one on any other (achievement.no_deal_value).
            ...(withValue && value.trim() ? { deal_value: readDealValue(value)! } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            ...(owner !== meId ? { owner_id: owner } : {}),
            ...(needsSide && side ? { side } : {}),
            ...(repeatOf ? { repeat_of: repeatOf } : {}),
            ...(sourceTaskId ? { source_task_id: sourceTaskId } : {}),
          },
          p_refs: refs,
          ...(participants.length ? { p_participants: participants } : {}),
        }) as Promise<{ id: string; number?: string; request_id?: string | null }>,
      // FIX-06: after save the form asks — view the record just saved (same), or log another (new) — instead
      // of navigating straight to the record. The pre-save repeat dialog is untouched.
      {
        after: (r) => {
          if (savedOnce) return setSaved((s) => (s?.id === r?.id ? null : s));
          savedOnce = true;
          setSaved({ id: r!.id, number: r!.number ?? '' });
        },
      },
    );
    setBusy(false);
  };

  /** "Log another": a fresh form for a new achievement — the category and the day stay, the rest clears. */
  const again = () => {
    setSaved(null);
    setTitle('');
    setPartner(null);
    setValue('');
    setNotes('');
    setOwner(meId);
    setParticipants([]);
    setRef('');
    setLink('');
    setSide('');
  };

  const name = (c: Category) => (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en);
  const valueBad = withValue && !!value.trim() && readDealValue(value) === null;
  // FIX-06: the value's unit is the category's own name — no per-category unit field exists in the Category
  // type, so the name is the unit (recorded in the build note).
  const valueLabel = cat
    ? `${t('fields.valueLabel')} (${locale === 'ar' ? cat.name_ar : cat.name_en}) · ${t('notRevenue')}`
    : t('fields.valueLabel');
  const ready = !!code && !!title.trim() && (!needsRef || !!ref.trim()) && (!needsSide || !!side) && !valueBad;
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      data-log-form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) void check();
      }}
    >
      <PageHeader crumbs={[{ label: t('title'), href: '/kpis/achievements' }]} title={t('log')} />
      {live.length ? (
        <Field label={t('fields.category')} required={required}>
          {(p) => (
            <Select
              id={p.id}
              aria-label={t('fields.category')}
              value={code || undefined}
              placeholder={t('actions.choose')}
              options={live.map((c) => ({ value: c.code, label: name(c) }))}
              onValueChange={setCode}
            />
          )}
        </Field>
      ) : (
        <div
          className="flex flex-col items-start gap-2 rounded-lg border border-border bg-raised p-4"
          data-no-categories
        >
          {/* QA-516: no department, no plan to open — say what to fix instead. */}
          {!department.id ? (
            <p className="text-text">{t('plan.noDepartment')}</p>
          ) : (
            <p className="text-text">{t('plan.none', { department: department.name, year: loadedYear })}</p>
          )}
          {!department.id ? null : canOpenPlan ? (
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => void openPlan()}>
              {t('plan.open', { year: loadedYear })}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t('plan.askAdmin')}</p>
          )}
        </div>
      )}
      <Field label={t('fields.title')} required={required}>
        {(p) => <Input {...p} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('fields.date')}>
        {(p) => (
          <DatePicker
            id={p.id}
            describedBy={p['aria-describedby']}
            invalid={p['aria-invalid']}
            value={day || undefined}
            max={riyadhToday()}
            onChange={(v) => void onDay(v ?? '')}
          />
        )}
      </Field>
      <Field label={t('fields.organisation')}>
        {(p) => <PartnerPicker id={p.id} value={partner} onChange={setPartner} />}
      </Field>
      {needsSide ? (
        <Field label={t('fields.side')} required={required}>
          {(p) => (
            <Select
              id={p.id}
              aria-label={t('fields.side')}
              value={side || undefined}
              placeholder={t('actions.choose')}
              options={(['client', 'supplier_partner'] as const).map((k) => ({ value: k, label: t(`sides.${k}`) }))}
              onValueChange={(v) => setSide(v as 'client' | 'supplier_partner')}
            />
          )}
        </Field>
      ) : null}
      {withValue ? (
        <Field label={valueLabel} error={valueBad ? t('valueNotNumber') : undefined}>
          {(p) => <Input {...p} inputMode="decimal" mono value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
      ) : null}
      {/* the reference row: on a PC its first column is wide enough for "Where the reference came from" on one line
          (at 8rem the label broke over two lines and pushed its box below the Reference box); on a phone the two
          stack */}
      <div className="grid grid-cols-1 gap-x-2 gap-y-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-end">
        <Field label={t('fields.system')}>
          {(p) => (
            <Select
              id={p.id}
              aria-label={t('fields.system')}
              value={needsRef ?? system}
              disabled={!!needsRef}
              options={systems.map((s) => ({ value: s.key, label: s.name }))}
              onValueChange={setSystem}
            />
          )}
        </Field>
        <Field label={t('fields.reference')} required={needsRef ? required : undefined}>
          {(p) => <Input {...p} value={ref} maxLength={200} onChange={(e) => setRef(e.target.value)} />}
        </Field>
      </div>
      {ref.trim() ? (
        <Field label={t('fields.link')}>
          {(p) => <Input {...p} type="url" value={link} onChange={(e) => setLink(e.target.value)} />}
        </Field>
      ) : null}
      {full ? (
        <Field label={t('fields.owner')}>
          {(p) => (
            <Select
              id={p.id}
              aria-label={t('fields.owner')}
              value={owner}
              options={people.map((x) => ({ value: x.id, label: x.name }))}
              onValueChange={setOwner}
            />
          )}
        </Field>
      ) : null}
      {/* FIX-06 F077: who else took part — the owner is already on the record, so they are not offered again. */}
      <Field label={t('fields.participants')}>
        {(p) => (
          <div className="flex flex-col gap-2" data-log-participants>
            {participants.length ? (
              <ul className="flex flex-col gap-1">
                {participants.map((id) => {
                  const person = people.find((x) => x.id === id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-2" data-log-participant={id}>
                      <span className="min-w-0 break-words">{person?.name ?? '—'}</span>
                      <IconButton
                        size="sm"
                        label={t('actions.removeParticipant', { name: person?.name ?? '' })}
                        icon={<X />}
                        onClick={() => setParticipants(participants.filter((x) => x !== id))}
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
              options={people.filter((x) => x.id !== owner && !participants.includes(x.id))}
              onPick={(v) => setParticipants([...participants, v])}
            />
          </div>
        )}
      </Field>
      <Field label={t('fields.notes')}>
        {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={!ready || busy}>
          {t('actions.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/kpis/achievements')}>
          {t('actions.cancel')}
        </Button>
      </div>
      <Dialog
        open={repeats.length > 0}
        onOpenChange={(o) => !o && setRepeats([])}
        title={t('repeat.title')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => router.push(`/kpis/achievements/${repeats[0]!.id}`)}
              data-repeat-same
            >
              {t('repeat.same')}
            </Button>
            <Button variant="primary" onClick={() => void save(repeats[0]!.id)} data-repeat-new>
              {t('repeat.new')}
            </Button>
          </>
        }
      >
        {repeats[0] ? (
          <p className="text-text">
            {t('repeat.body', { number: repeats[0].number, date: formatDate(repeats[0].happened_on, locale) })}
            <span className="mt-1 block text-muted">{repeats[0].title}</span>
          </p>
        ) : null}
      </Dialog>
      {/* FIX-06 F079: after save — view the record just saved (same), or log another (new). */}
      <Dialog
        open={saved !== null}
        onOpenChange={(o) => !o && setSaved(null)}
        title={t('savedDialog.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => again()} data-saved-new>
              {t('savedDialog.new')}
            </Button>
            <Button
              variant="primary"
              onClick={() => saved && router.push(`/kpis/achievements/${saved.id}`)}
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
    </form>
  );
}
