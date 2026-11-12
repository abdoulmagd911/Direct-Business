'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate, formatMoney, formatNumber } from '@/core/i18n/format';
import { bannedIn } from '@/core/words/banned';
import { useWords } from '@/modules/partners/screens/record/words';
import type { OrgDepartment } from '@/modules/org/types';
import type { ListEntry } from '@/modules/settings/screens/ListEditor';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ScrollCue } from '@/ui/ScrollCue';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useMediaQuery } from '@/ui/useMediaQuery';
import type { Category, PlanRow, TargetRow } from '../types';

/** api.achievement_category_usage(): what a category is used by — achievements, and the sub-categories under it. */
type CategoryUsage = { total: number; uses: { table: string; column: string; count: number }[] };

const monthKey = (year: number, m: number) => `${year}-${String(m).padStart(2, '0')}-01`;
const monthLabel = (month: string, locale: 'en' | 'ar') =>
  formatDate(`${month}T12:00:00+03:00`, locale, { month: 'long', day: undefined, year: 'numeric' });

/** The twelve months of a plan's year, as a Select's options: the value is the first of the month, the label the month
 * and year in the page's language. A month is picked, never typed, so no date format can be entered wrong. */
export function monthOptionsOf(year: number, locale: 'en' | 'ar'): { value: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = monthKey(year, i + 1);
    return { value: key, label: monthLabel(key, locale) };
  });
}

type CategoryDraft = {
  code: string;
  name_en: string;
  name_ar: string;
  parent: string;
  sort: string;
  lineEn: string;
  lineAr: string;
  dealValue: boolean;
  setsProspect: boolean;
  refSystem: string;
};

const blankDraft: CategoryDraft = {
  code: '',
  name_en: '',
  name_ar: '',
  parent: '',
  sort: '',
  lineEn: '{title}',
  lineAr: '{title}',
  dealValue: false,
  setsProspect: false,
  refSystem: '',
};

/**
 * One plan's targets screen (FIX-23): the plan's targets — the month, the count and deal-value total expected, and
 * what the month has achieved so far — and the plan's achievement categories, the list editor the targets screen was
 * missing. A category is not a generic list entry (it is per plan, its code is fixed, it carries a line template and a
 * reference system), so it has its own editor here, with the same words and the same shape as the generic list editor.
 */
export function PlanDetailScreen({
  plan,
  departments,
  categories,
  targets,
  refSystems,
}: {
  plan: PlanRow;
  departments: OrgDepartment[];
  categories: Category[];
  targets: TargetRow[];
  refSystems: ListEntry[];
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useWords();
  const phone = useMediaQuery('(max-width: 639px)');
  const [busy, setBusy] = useState(false);

  const name = (x: { name_en: string; name_ar: string | null }) =>
    locale === 'ar' ? (x.name_ar ?? x.name_en) : x.name_en;
  const catName = (c: Category) => name(c);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const dept = departments.find((d) => d.id === plan.department_id);
  const monthOptions = useMemo(() => monthOptionsOf(plan.year, locale), [plan.year, locale]);

  // -- targets ------------------------------------------------------------------
  const [targetOpen, setTargetOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetRow | null>(null);
  const [targetCat, setTargetCat] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const chosenTargetCategory = categories.find((c) => c.id === targetCat);
  const targetOk =
    targetCat !== '' &&
    targetMonth !== '' &&
    /^\d+$/.test(targetCount) &&
    (!chosenTargetCategory?.has_deal_value || targetValue === '' || /^\d+(\.\d{1,2})?$/.test(targetValue));
  const startTargetAdd = () => {
    setEditingTarget(null);
    setTargetCat('');
    setTargetMonth('');
    setTargetCount('');
    setTargetValue('');
    setTargetOpen(true);
  };
  const startTargetEdit = (row: TargetRow) => {
    setEditingTarget(row);
    setTargetCat(row.category_id);
    setTargetMonth(row.month);
    setTargetCount(String(row.target_count));
    setTargetValue(row.target_value === null ? '' : String(row.target_value));
    setTargetOpen(true);
  };
  const saveTarget = async () => {
    if (!targetOk) return;
    setBusy(true);
    const values: Record<string, unknown> = {};
    if (editingTarget === null) {
      values.category = targetCat;
      values.month = targetMonth;
      values.target_count = Number(targetCount);
      values.target_value = chosenTargetCategory?.has_deal_value && targetValue !== '' ? targetValue : null;
    } else {
      if (targetCat !== editingTarget.category_id) values.category = targetCat;
      if (targetMonth !== editingTarget.month) values.month = targetMonth;
      if (Number(targetCount) !== editingTarget.target_count) values.target_count = Number(targetCount);
      if (chosenTargetCategory?.has_deal_value) {
        const v = targetValue === '' ? null : Number(targetValue);
        if (v !== editingTarget.target_value) values.target_value = targetValue === '' ? null : targetValue;
      } else if (editingTarget.target_value !== null) {
        // the new category holds no deal values: a target value it cannot compare to is cleared, not left behind
        values.target_value = null;
      }
      if (!Object.keys(values).length) {
        setTargetOpen(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(t('settings.targets.targetSaved')),
      () =>
        rpc('target_save', {
          p_id: (editingTarget === null ? null : editingTarget.id) as unknown as string,
          p_plan: plan.id,
          p_values: values as never,
          p_version: editingTarget === null ? undefined : editingTarget.version,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setTargetOpen(false);
          setEditingTarget(null);
          router.refresh();
        },
      },
    );
    setBusy(false);
  };
  // F-B5-12 (D-5 ruled: delete allowed): the target being deleted, if any — its expected count goes with it and
  // the achievements already logged stay, so the dialog says so and asks for the reason (the RPC requires one).
  const [deletingTarget, setDeletingTarget] = useState<TargetRow | null>(null);
  const reasonWords = {
    reason: t('common.reason'),
    save: t('common.save'),
    cancel: t('common.cancel'),
    reasonRequired: t('settings.form.reasonRequired'),
  };
  const deleteTarget = async (why: string) => {
    if (!deletingTarget) return;
    const row = deletingTarget;
    await command(
      words(t('targets.targetDeleted')),
      () => rpc('target_delete', { p_id: row.id, p_reason: why }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setDeletingTarget(null);
          router.refresh();
        },
      },
    );
  };
  // the target's category may have been retired since the target was set: it stays offered on edit, so the target
  // still reads and can be moved to a live category instead of vanishing from the form
  const targetCategoryOptions = useMemo(() => {
    const live = categories.filter((c) => c.active);
    const opts = live.map((c) => ({ value: c.id, label: catName(c) }));
    if (editingTarget && !live.some((c) => c.id === editingTarget.category_id)) {
      const current = byId.get(editingTarget.category_id);
      if (current) opts.push({ value: current.id, label: catName(current) });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, editingTarget]);

  // -- categories ---------------------------------------------------------------
  const [showArchived, setShowArchived] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number> | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(blankDraft);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [replaceWith, setReplaceWith] = useState('');
  const [reason, setReason] = useState('');

  const active = categories.filter((c) => c.active);
  const archived = categories.filter((c) => !c.active);
  const shown = categories.filter((c) => showArchived || c.active);
  const topLevel = categories.filter((c) => c.parent_id === null && c.active);
  const nextSort = (categories.reduce((m, c) => Math.max(m, c.sort), 0) ?? 0) + 10;
  const usageOf = (c: Category) => {
    const n = usageCounts?.[c.id];
    return n === undefined || n < 0 ? '—' : String(n);
  };
  const loadUsage = async () => {
    setUsageCounts({});
    const next: Record<string, number> = {};
    for (const c of categories) {
      try {
        const u = (await rpc('achievement_category_usage', { p_id: c.id }, { retry: true })) as {
          total?: number;
        } | null;
        next[c.id] = u?.total ?? -1;
      } catch {
        next[c.id] = -1;
      }
    }
    setUsageCounts(next);
  };

  const startCategoryAdd = () => {
    setEditingCategory(null);
    setDraft({ ...blankDraft, sort: String(nextSort) });
    setCategoryOpen(true);
  };
  const startCategoryEdit = (c: Category) => {
    setEditingCategory(c);
    setDraft({
      code: c.code,
      name_en: c.name_en,
      name_ar: c.name_ar,
      parent: c.parent_code ?? '',
      sort: String(c.sort),
      lineEn: c.line_template_en,
      lineAr: c.line_template_ar,
      dealValue: c.has_deal_value,
      setsProspect: c.sets_prospect,
      refSystem: c.required_ref_system ?? '',
    });
    setCategoryOpen(true);
  };
  const codeOk = editingCategory !== null || /^[A-Z][A-Z0-9_-]*$/.test(draft.code);
  const categoryOk =
    codeOk &&
    draft.name_en.trim() !== '' &&
    draft.name_ar.trim() !== '' &&
    draft.lineEn.trim() !== '' &&
    draft.lineAr.trim() !== '' &&
    !bannedIn(draft.name_en) &&
    !bannedIn(draft.name_ar);
  const saveCategory = async () => {
    if (!categoryOk) return;
    setBusy(true);
    const values: Record<string, unknown> = {};
    if (editingCategory === null) {
      values.code = draft.code;
      values.name_en = draft.name_en.trim();
      values.name_ar = draft.name_ar.trim();
      values.parent = draft.parent === '' ? null : draft.parent;
      values.sort = draft.sort === '' ? 0 : Number(draft.sort);
      values.line_template_en = draft.lineEn.trim();
      values.line_template_ar = draft.lineAr.trim();
      values.has_deal_value = draft.dealValue;
      values.sets_prospect = draft.setsProspect;
      values.required_ref_system = draft.refSystem === '' ? null : draft.refSystem;
    } else {
      const c = editingCategory;
      if (draft.name_en.trim() !== c.name_en) values.name_en = draft.name_en.trim();
      if (draft.name_ar.trim() !== c.name_ar) values.name_ar = draft.name_ar.trim();
      if (draft.parent !== (c.parent_code ?? '')) values.parent = draft.parent === '' ? null : draft.parent;
      if (draft.sort !== '' && Number(draft.sort) !== c.sort) values.sort = Number(draft.sort);
      if (draft.lineEn.trim() !== c.line_template_en) values.line_template_en = draft.lineEn.trim();
      if (draft.lineAr.trim() !== c.line_template_ar) values.line_template_ar = draft.lineAr.trim();
      if (draft.dealValue !== c.has_deal_value) values.has_deal_value = draft.dealValue;
      if (draft.setsProspect !== c.sets_prospect) values.sets_prospect = draft.setsProspect;
      if (draft.refSystem !== (c.required_ref_system ?? ''))
        values.required_ref_system = draft.refSystem === '' ? null : draft.refSystem;
      if (!Object.keys(values).length) {
        setCategoryOpen(false);
        setBusy(false);
        return;
      }
    }
    await command(
      words(t('settings.targets.categorySaved')),
      () =>
        rpc('achievement_category_save', {
          p_id: (editingCategory === null ? null : editingCategory.id) as unknown as string,
          p_plan: plan.id,
          p_values: values as never,
          p_version: editingCategory === null ? undefined : editingCategory.version,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setCategoryOpen(false);
          setEditingCategory(null);
          router.refresh();
        },
      },
    );
    setBusy(false);
  };

  const startArchive = async (c: Category) => {
    setArchiving(c);
    setUsage(null);
    setReplaceWith('');
    setReason('');
    try {
      const u = (await rpc('achievement_category_usage', { p_id: c.id }, { retry: true })) as CategoryUsage | null;
      setUsage(u ?? { total: 0, uses: [] });
    } catch {
      setUsage(null);
    }
  };
  const childrenCount =
    usage?.uses.find((u) => u.table === 'perf.achievement_category' && u.column === 'parent_id')?.count ?? 0;
  const archive = async () => {
    if (!archiving) return;
    setBusy(true);
    const target = archiving;
    const replaced = (usage?.total ?? 0) > 0;
    await command(
      words(t('settings.list.archivedDone', { name: catName(target) })),
      () =>
        (replaced
          ? rpc('achievement_category_retire', {
              p_id: target.id,
              p_replacement: replaceWith,
              p_reason: reason.trim(),
            })
          : rpc('achievement_category_save', {
              p_id: target.id,
              p_plan: plan.id,
              p_values: { active: false } as never,
              p_version: target.version,
            })) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setArchiving(null);
          setUsageCounts(null);
          router.refresh();
        },
      },
    );
    setBusy(false);
  };
  const restoreCategory = async (c: Category) => {
    await command(
      words(t('settings.list.restored', { name: catName(c) })),
      () =>
        rpc('achievement_category_save', {
          p_id: c.id,
          p_plan: plan.id,
          p_values: { active: true } as never,
          p_version: c.version,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setUsageCounts(null);
          router.refresh();
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6" data-plan-detail={plan.id}>
      <div className="flex flex-col gap-1">
        <Link href="/settings/performance" className="w-fit text-sm text-link hover:underline">
          {t('settings.targets.backToPlans')}
        </Link>
        <p className="text-sm text-muted">
          {[
            dept ? name(dept) : '—',
            String(plan.year),
            // F-B5-12: the count is the active categories only — before, it counted every category including
            // archived ones, so it read "Categories: 8" while the list showed 7.
            t('settings.targets.categories', { count: active.length }),
          ].join(' · ')}
        </p>
      </div>

      <section aria-labelledby="targets-heading" className="flex flex-col gap-3" data-plan-targets>
        <div className="flex items-center justify-between gap-3">
          <h2 id="targets-heading" className="font-display text-lg font-semibold">
            {t('settings.targets.targetsTitle')}
          </h2>
          <Button size="sm" onClick={startTargetAdd} data-target-add>
            {t('settings.targets.addTarget')}
          </Button>
        </div>
        {targets.length === 0 ? (
          <DataState kind="empty" message={t('settings.targets.targetsNone')} />
        ) : phone ? (
          <ul className="flex flex-col gap-2">
            {targets.map((row) => {
              const cat = byId.get(row.category_id);
              return (
                <li key={row.id} className="rounded-md border border-border bg-raised p-3" data-target-row={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {monthLabel(row.month, locale)} · {cat ? catName(cat) : row.category_code}
                      </span>
                      <span className="text-sm text-muted">
                        {t('pages.achievements.fields.count')}: {formatNumber(row.target_count, locale)} ·{' '}
                        {t('settings.targets.achievedCount', { count: row.achieved_count })}
                      </span>
                      {cat?.has_deal_value ? (
                        <span className="text-sm text-muted">
                          {t('settings.targets.targetValue')}:{' '}
                          {row.target_value === null ? '—' : formatMoney(row.target_value, locale, 2)} ·{' '}
                          {t('settings.targets.targetAchievedValue')}: {formatMoney(row.achieved_value, locale, 2)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => startTargetEdit(row)}
                        aria-label={t('settings.list.edit', {
                          name: `${monthLabel(row.month, locale)} · ${cat ? catName(cat) : row.category_code}`,
                        })}
                        data-target-edit={row.id}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDeletingTarget(row)}
                        data-target-delete={row.id}
                      >
                        {t('targets.deleteTarget')}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ScrollCue className="-mx-5 px-5">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-start">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.targetMonth')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.targetCategory')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('pages.achievements.fields.count')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.achieved')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.targetValue')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.targetAchievedValue')}
                  </th>
                  <th className="border-b border-border px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {targets.map((row) => {
                  const cat = byId.get(row.category_id);
                  return (
                    <tr
                      key={row.id}
                      className="align-top [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-border"
                      data-target-row={row.id}
                    >
                      <td className="px-3 py-2.5 align-top">{monthLabel(row.month, locale)}</td>
                      <td className="px-3 py-2.5 align-top">{cat ? catName(cat) : row.category_code}</td>
                      <td className="px-3 py-2.5 align-top font-data">{formatNumber(row.target_count, locale)}</td>
                      <td className="px-3 py-2.5 align-top font-data">{formatNumber(row.achieved_count, locale)}</td>
                      <td className="px-3 py-2.5 align-top font-data">
                        {row.target_value === null ? '—' : formatMoney(row.target_value, locale, 2)}
                      </td>
                      <td className="px-3 py-2.5 align-top font-data">
                        {cat?.has_deal_value ? formatMoney(row.achieved_value, locale, 2) : '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top text-end">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => startTargetEdit(row)}
                          aria-label={t('settings.list.edit', {
                            name: `${monthLabel(row.month, locale)} · ${cat ? catName(cat) : row.category_code}`,
                          })}
                          data-target-edit={row.id}
                        >
                          {t('common.edit')}
                        </Button>{' '}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeletingTarget(row)}
                          data-target-delete={row.id}
                        >
                          {t('targets.deleteTarget')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollCue>
        )}
      </section>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-3" data-plan-categories>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="categories-heading" className="font-display text-lg font-semibold">
            {t('settings.targets.categoriesTitle')}
          </h2>
          <div className="flex items-center gap-2">
            {archived.length > 0 ? (
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                label={t('settings.list.showArchived')}
              />
            ) : null}
            <Button size="sm" variant="ghost" onClick={loadUsage} data-category-show-usage>
              {t('settings.list.showUsage')}
            </Button>
            <Button size="sm" onClick={startCategoryAdd} data-category-add>
              {t('settings.list.add')}
            </Button>
          </div>
        </div>
        {categories.length === 0 ? (
          <DataState kind="empty" message={t('settings.targets.categoriesNone')} />
        ) : phone ? (
          <ul className="flex flex-col gap-2">
            {shown.map((c) => (
              <li key={c.id} className="rounded-md border border-border bg-raised p-3" data-category-entry={c.code}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{catName(c)}</span>
                    <span className="font-data text-sm text-muted">{c.code}</span>
                    <span className="text-sm text-muted">
                      {c.parent_code ?? t('settings.targets.categoryTopLevel')} · {t('settings.list.sort')}: {c.sort}
                      {usageCounts ? ` · ${t('settings.list.usage')}: ${usageOf(c)}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => startCategoryEdit(c)}
                      aria-label={t('settings.list.edit', { name: catName(c) })}
                      data-category-edit={c.code}
                    >
                      {t('common.edit')}
                    </Button>
                    {c.active ? (
                      <Button size="xs" variant="ghost" onClick={() => startArchive(c)} data-category-archive={c.code}>
                        {t('settings.list.archive')}
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => restoreCategory(c)}
                        data-category-restore={c.code}
                      >
                        {t('settings.list.restore')}
                      </Button>
                    )}
                  </div>
                </div>
                {!c.active ? <StatusChip tone="neutral">{t('settings.list.archived')}</StatusChip> : null}
              </li>
            ))}
          </ul>
        ) : (
          <ScrollCue className="-mx-5 px-5">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-start">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-border px-3 py-2 text-start font-medium">{t('settings.list.key')}</th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.list.nameEn')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.list.nameAr')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">
                    {t('settings.targets.categoryParent')}
                  </th>
                  <th className="border-b border-border px-3 py-2 text-start font-medium">{t('settings.list.sort')}</th>
                  {usageCounts ? (
                    <th className="border-b border-border px-3 py-2 text-start font-medium">
                      {t('settings.list.usage')}
                    </th>
                  ) : null}
                  <th className="border-b border-border px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    className="align-top [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-border"
                    data-category-entry={c.code}
                  >
                    <td className="px-3 py-2.5 align-top font-data">{c.code}</td>
                    <td className="px-3 py-2.5 align-top">
                      {c.name_en}
                      {!c.active ? (
                        <>
                          {' '}
                          <StatusChip tone="neutral">{t('settings.list.archived')}</StatusChip>
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 align-top">{c.name_ar}</td>
                    <td className="px-3 py-2.5 align-top">{c.parent_code ?? t('settings.targets.categoryTopLevel')}</td>
                    <td className="px-3 py-2.5 align-top font-data">{c.sort}</td>
                    {usageCounts ? <td className="px-3 py-2.5 align-top font-data">{usageOf(c)}</td> : null}
                    <td className="px-3 py-2.5 align-top text-end">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => startCategoryEdit(c)}
                        aria-label={t('settings.list.edit', { name: catName(c) })}
                        data-category-edit={c.code}
                      >
                        {t('common.edit')}
                      </Button>{' '}
                      {c.active ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => startArchive(c)}
                          data-category-archive={c.code}
                        >
                          {t('settings.list.archive')}
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => restoreCategory(c)}
                          data-category-restore={c.code}
                        >
                          {t('settings.list.restore')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollCue>
        )}
      </section>

      <Dialog
        open={targetOpen}
        onOpenChange={setTargetOpen}
        title={editingTarget === null ? t('settings.targets.addTarget') : t('settings.targets.editTarget')}
        dirty={targetCat !== '' || targetCount !== ''}
        closeLabel={t('common.cancel')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTargetOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveTarget} disabled={!targetOk || busy} loading={busy} data-target-save>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4" data-target-form>
          <Field label={t('settings.targets.targetCategory')}>
            {(p) => (
              <Select
                {...p}
                value={targetCat}
                onValueChange={setTargetCat}
                options={targetCategoryOptions}
                placeholder={t('settings.targets.targetCategory')}
              />
            )}
          </Field>
          <Field label={t('settings.targets.targetMonth')}>
            {(p) => (
              <Select
                {...p}
                value={targetMonth}
                onValueChange={setTargetMonth}
                options={monthOptions}
                placeholder={t('settings.targets.targetMonth')}
              />
            )}
          </Field>
          <Field label={t('pages.achievements.fields.count')}>
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
              />
            )}
          </Field>
          {chosenTargetCategory?.has_deal_value ? (
            <Field label={t('settings.targets.targetValue')}>
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title={
          editingCategory === null
            ? t('settings.list.new')
            : t('settings.list.edit', { name: catName(editingCategory) })
        }
        dirty={draft.name_en !== '' || draft.name_ar !== ''}
        closeLabel={t('common.cancel')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCategoryOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveCategory} disabled={!categoryOk || busy} loading={busy} data-category-save>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4" data-category-form>
          <Field
            label={t('settings.targets.categoryCode')}
            error={
              editingCategory === null && draft.code !== '' && !codeOk
                ? t('settings.targets.categoryCodeHint')
                : undefined
            }
          >
            {(p) => (
              <Input
                {...p}
                value={draft.code}
                disabled={editingCategory !== null}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              />
            )}
          </Field>
          <Field
            label={t('settings.list.nameEn')}
            error={bannedIn(draft.name_en) ? t('settings.list.banned', { word: bannedIn(draft.name_en)! }) : undefined}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.name_en}
                onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))}
              />
            )}
          </Field>
          <Field
            label={t('settings.list.nameAr')}
            error={
              bannedIn(draft.name_ar)
                ? t('settings.list.banned', { word: bannedIn(draft.name_ar)! })
                : draft.name_en.trim() !== '' && draft.name_ar.trim() === ''
                  ? t('settings.list.arabicRequired')
                  : undefined
            }
          >
            {(p) => (
              <Input
                {...p}
                value={draft.name_ar}
                onChange={(e) => setDraft((d) => ({ ...d, name_ar: e.target.value }))}
              />
            )}
          </Field>
          <Field label={t('settings.targets.categoryParent')}>
            {(p) => (
              <Select
                {...p}
                value={draft.parent}
                onValueChange={(v) => setDraft((d) => ({ ...d, parent: v }))}
                options={[
                  { value: '', label: t('settings.targets.categoryTopLevel') },
                  ...topLevel
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => ({ value: c.code, label: catName(c) })),
                ]}
              />
            )}
          </Field>
          <Field label={t('settings.list.sort')}>
            {(p) => (
              <Input
                {...p}
                type="number"
                step={1}
                value={draft.sort}
                onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
              />
            )}
          </Field>
          <Field
            label={t('settings.targets.categoryLineEn')}
            error={draft.lineEn.trim() === '' ? t('settings.targets.templateRequired') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.lineEn}
                onChange={(e) => setDraft((d) => ({ ...d, lineEn: e.target.value }))}
              />
            )}
          </Field>
          <Field
            label={t('settings.targets.categoryLineAr')}
            error={draft.lineAr.trim() === '' ? t('settings.targets.templateRequired') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                value={draft.lineAr}
                onChange={(e) => setDraft((d) => ({ ...d, lineAr: e.target.value }))}
              />
            )}
          </Field>
          <Switch
            checked={draft.dealValue}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, dealValue: v }))}
            label={t('settings.targets.categoryDealValue')}
          />
          <Switch
            checked={draft.setsProspect}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, setsProspect: v }))}
            label={t('settings.targets.categorySetsProspect')}
          />
          <Field label={t('settings.targets.categoryRefSystem')}>
            {(p) => (
              <Select
                {...p}
                value={draft.refSystem}
                onValueChange={(v) => setDraft((d) => ({ ...d, refSystem: v }))}
                options={[
                  { value: '', label: t('settings.targets.categoryRefSystemNone') },
                  ...refSystems.map((r) => ({ value: r.key, label: name(r) })),
                ]}
              />
            )}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={archiving !== null}
        onOpenChange={(v) => {
          if (!v) setArchiving(null);
        }}
        title={archiving ? t('settings.list.retireTitle', { name: catName(archiving) }) : ''}
        closeLabel={t('common.cancel')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={archive}
              disabled={
                busy ||
                usage === null ||
                childrenCount > 0 ||
                ((usage?.total ?? 0) > 0 && (replaceWith === '' || reason.trim() === ''))
              }
              loading={busy}
              data-category-archive-confirm
            >
              {t('settings.list.archive')}
            </Button>
          </>
        }
      >
        {archiving ? (
          <div className="flex flex-col gap-4">
            {usage === null ? (
              <p className="text-sm text-muted">{t('common.loading')}</p>
            ) : childrenCount > 0 ? (
              <p className="text-sm" data-category-usage>
                {t('settings.targets.childrenBlock')}
              </p>
            ) : usage.total > 0 ? (
              <>
                <p className="text-sm" data-category-usage>
                  {t('settings.list.retireBodyUsed', { name: catName(archiving), count: usage.total })}
                </p>
                <Field label={t('settings.list.replaceWith')}>
                  {(p) => (
                    <Select
                      {...p}
                      value={replaceWith}
                      onValueChange={setReplaceWith}
                      options={active
                        .filter((c) => c.id !== archiving.id)
                        .map((c) => ({ value: c.id, label: catName(c) }))}
                    />
                  )}
                </Field>
                <Field label={t('common.reason')}>
                  {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
                </Field>
              </>
            ) : (
              <p className="text-sm">{t('settings.list.retireBody', { name: catName(archiving) })}</p>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* F-B5-12: delete a target — soft-delete with a reason (the RPC requires one) and one audit row; the
          target's expected count goes with it, the achievements already logged stay (D-5). */}
      <ReasonDialog
        open={deletingTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeletingTarget(null);
        }}
        title={deletingTarget ? t('targets.deleteTarget') : ''}
        body={
          deletingTarget
            ? t('targets.deleteConfirm', {
                month: monthLabel(deletingTarget.month, locale),
                category: byId.get(deletingTarget.category_id)
                  ? catName(byId.get(deletingTarget.category_id)!)
                  : deletingTarget.category_code,
              })
            : undefined
        }
        destructive
        words={reasonWords}
        onSave={deleteTarget}
      />
    </div>
  );
}
