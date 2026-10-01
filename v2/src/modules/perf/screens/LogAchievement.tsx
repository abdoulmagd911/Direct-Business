'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { TIME_ZONE } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import type { Category } from '../types';
import { useCommandWords } from './words';

const NONE = '__none';

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
  partners,
  people,
  systems,
  meId,
  full,
}: {
  categories: Category[];
  year: number;
  partners: { id: string; name: string }[];
  people: { id: string; name: string }[];
  systems: { key: string; name: string }[];
  meId: string;
  full: boolean;
}) {
  const t = useTranslations('pages.achievements');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const [categories, setCategories] = useState(first);
  const [loadedYear, setLoadedYear] = useState(year);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(riyadhToday());
  const [partner, setPartner] = useState(NONE);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState(meId);
  const [system, setSystem] = useState(systems[0]?.key ?? '');
  const [ref, setRef] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const cat = categories.find((c) => c.code === code);
  const needsRef = cat?.required_ref_system ?? null;

  // The categories are the plan's of the date's year (§5a): another year reads that year's.
  const onDay = async (next: string) => {
    setDay(next);
    const y = Number((next || riyadhToday()).slice(0, 4));
    if (!y || y === loadedYear) return;
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

  const save = async () => {
    setBusy(true);
    const refs = ref.trim() ? [{ system: needsRef ?? system, value: ref.trim(), url: link.trim() || null }] : [];
    await command(
      words(t('logged')),
      () =>
        rpc('achievement_log', {
          p_values: {
            category: code,
            title: title.trim(),
            happened_on: day || null,
            partner_id: partner === NONE ? null : partner,
            ...(cat?.has_deal_value && value.trim() ? { deal_value: Number(value.replace(/,/g, '')) } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
            ...(owner !== meId ? { owner_id: owner } : {}),
          },
          p_refs: refs,
        }) as Promise<{ id: string; request_id?: string | null }>,
      { after: (r) => router.push(`/kpis/achievements/${r!.id}`) },
    );
    setBusy(false);
  };

  const name = (c: Category) => (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en);
  const ready = !!code && !!title.trim() && (!needsRef || !!ref.trim());
  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      data-log-form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) void save();
      }}
    >
      <PageHeader crumbs={[{ label: t('title'), href: '/kpis/achievements' }]} title={t('log')} />
      <Field label={t('fields.category')}>
        {(p) => (
          <Select
            id={p.id}
            aria-label={t('fields.category')}
            value={code || undefined}
            placeholder={t('actions.choose')}
            options={categories.filter((c) => c.active).map((c) => ({ value: c.code, label: name(c) }))}
            onValueChange={setCode}
          />
        )}
      </Field>
      <Field label={t('fields.title')}>
        {(p) => <Input {...p} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('fields.date')}>
        {(p) => (
          <Input {...p} type="date" value={day} max={riyadhToday()} onChange={(e) => void onDay(e.target.value)} />
        )}
      </Field>
      <Field label={t('fields.organisation')}>
        {(p) => (
          <Select
            id={p.id}
            aria-label={t('fields.organisation')}
            value={partner}
            options={[
              { value: NONE, label: t('fields.none') },
              ...partners.map((x) => ({ value: x.id, label: x.name })),
            ]}
            onValueChange={setPartner}
          />
        )}
      </Field>
      {cat?.has_deal_value ? (
        <Field label={`${t('fields.value')} · ${t('notRevenue')}`}>
          {(p) => <Input {...p} inputMode="decimal" mono value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
      ) : null}
      <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2">
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
        <Field label={t('fields.reference')}>
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
    </form>
  );
}
