'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { useWords } from '@/modules/partners/screens/record/words';
import type { OrgDepartment } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Select } from '@/ui/Select';

/** api.plans(): one plan of a department for a calendar year, with its categories counted. */
export type PlanRow = { id: string; department_id: string; year: number; name: string; categories: number };

/** The earliest year a plan may be opened for, and the latest is next year (perf.plan_open). */
const FIRST_YEAR = 2025;

/**
 * Settings → Targets: the plans that are open, newest year first, and the one door to open another — a department and a
 * year it has no plan for. A new plan starts from the department's nearest plan (the database copies its categories).
 * Admins only, like all of Settings; the database refuses anyone else.
 */
export function TargetsScreen({
  plans,
  departments,
  year,
}: {
  plans: PlanRow[];
  departments: OrgDepartment[];
  /** Riyadh's year today. */
  year: number;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const router = useRouter();
  const name = (d: { name_en: string; name_ar: string | null }) =>
    locale === 'ar' && d.name_ar ? d.name_ar : d.name_en;
  const live = departments.filter((d) => d.active);
  const byId = new Map(departments.map((d) => [d.id, d]));
  const [open, setOpen] = useState(false);
  const [dept, setDept] = useState('');
  const [chosenYear, setChosenYear] = useState('');
  const [busy, setBusy] = useState(false);

  // under a plan's name: what the name does not already say (a plan is named "Department Year" unless it was renamed),
  // then its categories; each part keeps its own direction, so a Latin name never scrambles an Arabic line
  const detail = (p: PlanRow): string[] => {
    const d = byId.get(p.department_id);
    const dn = d ? name(d) : '—';
    const out: string[] = [];
    if (!title(p).includes(dn)) out.push(dn);
    if (!title(p).includes(String(p.year))) out.push(String(p.year));
    out.push(t('settings.targets.categories', { count: p.categories }));
    return out;
  };
  // a plan is named "Department Year" in English when it is opened; until someone renames it, it reads in the page's language
  const title = (p: PlanRow): string => {
    const d = byId.get(p.department_id);
    return d && p.name === `${d.name_en} ${p.year}` ? `${name(d)} ${p.year}` : p.name;
  };
  const freeYears = (department: string) => {
    const held = new Set(plans.filter((p) => p.department_id === department).map((p) => p.year));
    const out: number[] = [];
    for (let y = year + 1; y >= FIRST_YEAR; y--) if (!held.has(y)) out.push(y);
    return out;
  };
  const start = () => {
    const first = live.find((d) => freeYears(d.id).length) ?? live[0];
    setDept(first?.id ?? '');
    setChosenYear(first ? String(freeYears(first.id).includes(year) ? year : (freeYears(first.id)[0] ?? year)) : '');
    setOpen(true);
  };
  const years = dept ? freeYears(dept) : [];
  const save = async () => {
    setBusy(true);
    await command(
      words(t('pages.achievements.plan.opened', { year: chosenYear })),
      () =>
        rpc('plan_open', { p_department: dept, p_year: Number(chosenYear) }) as Promise<{
          id: string;
          request_id?: string | null;
        }>,
      {
        after: () => {
          setOpen(false);
          router.refresh();
        },
      },
    );
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-4" data-targets>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {live.length ? null : (
          <p className="text-sm text-muted" data-plan-open-why>
            {t('settings.targets.noDepartment')}
          </p>
        )}
        <Button variant="primary" onClick={start} disabled={!live.length} data-plan-open>
          {t('settings.targets.openPlan')}
        </Button>
      </div>
      {plans.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised" data-plans>
          {plans.map((p) => (
            <li key={p.id} className="flex flex-col gap-0.5 px-4 py-3 [overflow-wrap:anywhere]" data-plan-row={p.id}>
              <span className="font-medium">{title(p)}</span>
              <span className="text-sm text-muted">
                {detail(p).map((part, i, all) => (
                  <Fragment key={i}>
                    <bdi>{part}</bdi>
                    {i < all.length - 1 ? ' · ' : null}
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <DataState kind="empty" message={t('settings.targets.none')} />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('settings.targets.openPlan')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!dept || !chosenYear}
              loading={busy}
              onClick={() => void save()}
              data-plan-save
            >
              {t('settings.targets.open')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4" data-plan-form>
          <Field label={t('settings.people.department')}>
            {(p) => (
              <Select
                {...p}
                value={dept}
                onValueChange={(v) => {
                  setDept(v);
                  const free = freeYears(v);
                  setChosenYear(String(free.includes(year) ? year : (free[0] ?? '')));
                }}
                options={live.map((d) => ({ value: d.id, label: name(d) }))}
              />
            )}
          </Field>
          <Field label={t('settings.targets.year')}>
            {(p) => (
              <Select
                {...p}
                value={chosenYear}
                onValueChange={setChosenYear}
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
              />
            )}
          </Field>
          {dept && !years.length ? (
            <p className="text-sm text-muted" data-plan-no-year>
              {t('settings.targets.everyYear')}
            </p>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}
