'use client';
import { ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { TIME_ZONE, formatDate } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { DatePicker } from '@/ui/DatePicker';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { Select } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { cn } from '@/ui/cn';
import { useCommandWords } from '@/modules/tasks/screens/words';
import type { Category } from '@/modules/perf/types';
import { itemRoute, moreThanShown, partnerName, weekIsEmpty } from '../logic';
import {
  SECTIONS,
  type ReviewItem,
  type ReviewList,
  type ReviewNote,
  type Section,
  type UnloggedAnswer,
  type WeeklyReviewAnswer,
} from '../types';

/** Today in Riyadh as `YYYY-MM-DD` (D20): the latest day an achievement may take. */
function riyadhToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}

/** A Done row that can take the nudge actions: a task with no achievement logged from it. */
type NudgeTask = {
  id: string;
  number: string | null;
  title: string;
  /** The Riyadh day the task was closed. */
  day: string;
  partner_id: string | null;
  partner_name_en: string | null;
  partner_name_ar: string | null;
};

/**
 * The Thursday weekly review (V632 Stage 3): one screen, my own week — Done, Slipped (with how often each was carried),
 * Next week, and a short list of my notes this week. Phone first: one column, whole rows to tap, no second action.
 * A failed read says so with Try again; a week with nothing in it says that once.
 * Phase 6: the Done rows carry the nudge — a done task with no achievement logged from it offers Log achievement,
 * "Not an achievement" and "Later" on the row itself (one list, one row per task: this week's done rows on top, then
 * older unlogged closed tasks below). Routine tasks are hidden from the nudge by default, with a toggle on the list.
 */
export function WeeklyReview({
  answer,
  unlogged,
  categories,
}: {
  answer: WeeklyReviewAnswer | null;
  unlogged: UnloggedAnswer | null;
  categories: Category[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [unloggedState, setUnloggedState] = useState(unlogged);
  const [showRoutine, setShowRoutine] = useState(false);
  if (!answer)
    return (
      <DataState
        kind="failed"
        what={t('pages.weeklyReview.title')}
        message={t('state.failed', { what: t('pages.weeklyReview.title') })}
        onRetry={() => router.refresh()}
        retryLabel={t('common.tryAgain')}
      />
    );
  const unloggedTotal = unloggedState?.total ?? 0;
  if (weekIsEmpty(answer) && unloggedTotal === 0)
    return <DataState kind="empty" message={t('pages.weeklyReview.emptyWeek')} />;
  const toggleRoutine = async () => {
    const next = !showRoutine;
    try {
      setUnloggedState((await rpc('weekly_unlogged', { p_show_routine: next })) as unknown as UnloggedAnswer);
      setShowRoutine(next);
    } catch {
      toast.failed(t('state.failed', { what: t('pages.weeklyReview.title') }));
    }
  };
  return (
    <div className="flex flex-col gap-4" data-weekly-review>
      <DoneSection
        list={answer.done}
        unlogged={unloggedState}
        categories={categories}
        showRoutine={showRoutine}
        onToggleRoutine={() => void toggleRoutine()}
      />
      {SECTIONS.filter((s) => s !== 'done').map((s) => (
        <ItemSection key={s} section={s} list={answer[s]} />
      ))}
      <NotesSection list={answer.notes} />
    </div>
  );
}

function SectionFrame({
  name,
  title,
  total,
  children,
}: {
  name: string;
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-raised px-4 py-2" data-review-section={name}>
      <h2 className="flex items-baseline gap-2 border-b border-border py-2.5 text-base font-semibold">
        <span>{title}</span>
        <span className="font-data text-sm text-muted" data-review-count>
          {total}
        </span>
      </h2>
      {children}
    </section>
  );
}

function More({ count }: { count: number }) {
  const t = useTranslations();
  return count > 0 ? (
    <p className="py-2 text-sm text-muted" data-review-more>
      {t('pages.weeklyReview.more', { count })}
    </p>
  ) : null;
}

/**
 * The Done section with the nudge (Phase 6): this week's done rows on top, then older unlogged closed tasks below —
 * one list, one row per task. A done task with no achievement logged from it carries the Log / "Not an achievement" /
 * "Later" actions on its row; the rest draw as before. The section says what the nudge hides (routine tasks, by
 * default) with a toggle to show them.
 */
function DoneSection({
  list,
  unlogged,
  categories,
  showRoutine,
  onToggleRoutine,
}: {
  list: ReviewList<ReviewItem>;
  unlogged: UnloggedAnswer | null;
  categories: Category[];
  showRoutine: boolean;
  onToggleRoutine: () => void;
}) {
  const t = useTranslations();
  const unloggedIds = new Set((unlogged?.rows ?? []).map((r) => r.task_id));
  const doneIds = new Set(list.rows.map((r) => r.id));
  const older = (unlogged?.rows ?? []).filter((r) => !doneIds.has(r.task_id));
  const rows: { key: string; item: ReviewItem; nudge: NudgeTask | null }[] = list.rows.map((r) => ({
    key: `${r.kind}:${r.id}`,
    item: r,
    nudge:
      r.kind === 'task' && unloggedIds.has(r.id)
        ? {
            id: r.id,
            number: r.number,
            title: r.title,
            day: r.day,
            partner_id: (unlogged?.rows ?? []).find((u) => u.task_id === r.id)?.partner_id ?? null,
            partner_name_en: r.partner_name_en,
            partner_name_ar: r.partner_name_ar,
          }
        : null,
  }));
  for (const u of older)
    rows.push({
      key: `task:${u.task_id}`,
      item: {
        kind: 'task',
        id: u.task_id,
        number: u.task_number,
        title: u.title,
        day: u.day,
        partner_name_en: u.partner_name_en,
        partner_name_ar: u.partner_name_ar,
        times: 0,
      },
      nudge: {
        id: u.task_id,
        number: u.task_number,
        title: u.title,
        day: u.day,
        partner_id: u.partner_id,
        partner_name_en: u.partner_name_en,
        partner_name_ar: u.partner_name_ar,
      },
    });
  const total = list.total + older.length;
  return (
    <SectionFrame name="done" title={t('pages.weeklyReview.done.title')} total={total}>
      {(unlogged?.total ?? 0) > 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm" data-nudge-note>
          <span className="font-medium">{t('pages.weeklyReview.nudge.title')}</span>
          <span className="text-muted">{t('pages.weeklyReview.nudge.count', { count: unlogged?.total ?? 0 })}</span>
          <span className="text-muted">{t('pages.weeklyReview.nudge.routineHidden')}</span>
          <button
            type="button"
            onClick={onToggleRoutine}
            className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            data-nudge-toggle-routine
          >
            {showRoutine ? t('pages.weeklyReview.nudge.hideRoutine') : t('pages.weeklyReview.nudge.showRoutine')}
          </button>
        </div>
      ) : unlogged !== null && list.total > 0 ? (
        <p className="py-2 text-sm text-muted" data-nudge-empty>
          {t('pages.weeklyReview.nudge.empty')}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="py-3 text-base text-muted" data-review-empty>
          {t('pages.weeklyReview.done.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) =>
            r.nudge ? (
              <NudgeItemRow key={r.key} item={r.item} task={r.nudge} categories={categories} />
            ) : (
              <ItemRow key={r.key} item={r.item} section="done" />
            ),
          )}
        </ul>
      )}
      <More count={Math.max(0, total - rows.length)} />
    </SectionFrame>
  );
}

function ItemSection({ section, list }: { section: Section; list: ReviewList<ReviewItem> }) {
  const t = useTranslations();
  return (
    <SectionFrame name={section} title={t(`pages.weeklyReview.${section}.title`)} total={list.total}>
      {list.rows.length === 0 ? (
        <p className="py-3 text-base text-muted" data-review-empty>
          {t(`pages.weeklyReview.${section}.empty`)}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {list.rows.map((r) => (
            <ItemRow key={`${r.kind}:${r.id}`} item={r} section={section} />
          ))}
        </ul>
      )}
      <More count={moreThanShown(list)} />
    </SectionFrame>
  );
}

function ItemRow({ item, section }: { item: ReviewItem; section: Section }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const partner = partnerName(item, locale);
  return (
    <li data-review-item={item.kind} data-review-id={item.id}>
      <Link
        href={itemRoute(item)}
        className="flex min-h-14 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words">{item.title || t('pages.myDay.note.untitled')}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.kind === 'note' ? <StatusChip tone="neutral">{t('pages.weeklyReview.note')}</StatusChip> : null}
            {partner ? <StatusChip tone="neutral">{partner}</StatusChip> : null}
            {item.times > 0 ? (
              <StatusChip tone={section === 'slipped' && item.times > 1 ? 'warning' : 'neutral'}>
                <span data-review-times={item.times}>{t('pages.weeklyReview.carried', { count: item.times })}</span>
              </StatusChip>
            ) : null}
            <span className="font-data text-xs whitespace-nowrap text-muted">
              {formatDate(item.day, locale, { dateStyle: 'medium' })}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * A Done row with the nudge actions (Phase 6): Log achievement, "Not an achievement", "Later". On a phone the row
 * holds one Log button plus ⋯; on wider screens all three sit in a row. Log opens the inline quick form inside the
 * row (or the full form when there is no category to log inline); the row drops from the list on the automatic
 * re-read after any of the three actions.
 */
function NudgeItemRow({ item, task, categories }: { item: ReviewItem; task: NudgeTask; categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const partner = partnerName(item, locale);
  const words = useCommandWords();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const quick = categories.filter((c) => c.active && !c.required_ref_system && !c.sets_prospect);
  const logUrl = `/kpis/achievements/new?title=${encodeURIComponent(task.title.slice(0, 300))}&task=${task.id}`;
  const dismiss = async () => {
    setBusy(true);
    await command(
      words(t('pages.tasks.achievementStrip.dismissedDone')),
      () =>
        rpc('task_nudge_dismiss', { p_id: task.id, p_dismissed: true }) as Promise<{
          request_id?: string | null;
        }>,
    );
    setBusy(false);
  };
  const later = async () => {
    setBusy(true);
    await command(
      words(t('pages.weeklyReview.nudge.laterDone')),
      () => rpc('task_nudge_later', { p_id: task.id }) as Promise<{ request_id?: string | null }>,
    );
    setBusy(false);
  };
  return (
    <li data-review-item="task" data-review-id={item.id} data-nudge-row>
      <Link
        href={itemRoute(item)}
        className="flex min-h-14 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words">{item.title || t('pages.myDay.note.untitled')}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {partner ? <StatusChip tone="neutral">{partner}</StatusChip> : null}
            <span className="font-data text-xs whitespace-nowrap text-muted">
              {formatDate(item.day, locale, { dateStyle: 'medium' })}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
      </Link>
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {quick.length > 0 ? (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => setFormOpen((o) => !o)} data-nudge-log>
            {t('pages.weeklyReview.nudge.log')}
          </Button>
        ) : (
          <Link href={logUrl} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))} data-nudge-log>
            {t('pages.weeklyReview.nudge.log')}
          </Link>
        )}
        <span className="hidden gap-2 sm:flex">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void dismiss()} data-nudge-not>
            {t('pages.weeklyReview.nudge.notAchievement')}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void later()} data-nudge-later>
            {t('pages.weeklyReview.nudge.later')}
          </Button>
        </span>
        <span className="sm:hidden">
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="secondary" disabled={busy} aria-label={t('common.more')} data-nudge-menu>
                ⋯
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => void dismiss()} data-nudge-not>
                {t('pages.weeklyReview.nudge.notAchievement')}
              </MenuItem>
              <MenuItem onSelect={() => void later()} data-nudge-later>
                {t('pages.weeklyReview.nudge.later')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </span>
      </div>
      {formOpen && quick.length > 0 ? (
        <QuickLogForm task={task} categories={quick} onClose={() => setFormOpen(false)} />
      ) : null}
    </li>
  );
}

/**
 * The inline quick form (Phase 6): the title from the task, a one-line result, an optional number; the category,
 * the owner (me) and the month default from the task (its closed day). It writes the full required set with those
 * defaults, then the row drops from the list on the automatic re-read. "More details" opens the full form.
 */
function QuickLogForm({ task, categories, onClose }: { task: NudgeTask; categories: Category[]; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useCommandWords();
  const [title, setTitle] = useState(task.title);
  const [result, setResult] = useState('');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState(categories[0]?.code ?? '');
  const [day, setDay] = useState(task.day);
  const [busy, setBusy] = useState(false);
  const [numberBad, setNumberBad] = useState(false);
  const cat = categories.find((c) => c.code === code);
  const count = number.trim() === '' ? null : /^\d+$/.test(number.trim()) ? Number(number.trim()) : null;
  const numberInvalid = number.trim() !== '' && count === null;
  const ready = !!code && !!title.trim() && !numberInvalid && !!day;
  const save = async () => {
    if (!ready || busy) return;
    if (count !== null && (count < 1 || count > 100000)) {
      setNumberBad(true);
      return;
    }
    setBusy(true);
    await command(
      words(t('pages.achievements.logged')),
      () =>
        rpc('achievement_log', {
          p_values: {
            category: code,
            title: title.trim(),
            happened_on: day,
            ...(task.partner_id ? { partner_id: task.partner_id } : {}),
            ...(count !== null ? { count } : {}),
            ...(result.trim() ? { notes: result.trim() } : {}),
            source_task_id: task.id,
          },
          p_refs: [],
        }) as Promise<{ id: string; request_id?: string | null }>,
    );
    setBusy(false);
    onClose();
  };
  const name = (c: Category) => (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en);
  const logUrl = `/kpis/achievements/new?title=${encodeURIComponent(task.title.slice(0, 300))}&task=${task.id}`;
  return (
    <form
      className="flex flex-col gap-3 border-t border-border py-3"
      data-nudge-form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label={t('pages.achievements.fields.category')}>
        {(p) => (
          <Select
            id={p.id}
            aria-label={t('pages.achievements.fields.category')}
            value={code || undefined}
            placeholder={t('pages.achievements.actions.choose')}
            options={categories.map((c) => ({ value: c.code, label: name(c) }))}
            onValueChange={setCode}
          />
        )}
      </Field>
      <Field label={t('pages.achievements.fields.title')}>
        {(p) => <Input {...p} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('pages.weeklyReview.nudge.result')}>
        {(p) => <Input {...p} value={result} onChange={(e) => setResult(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label={t('pages.weeklyReview.nudge.number')}
          error={numberBad || numberInvalid ? t('pages.achievements.valueNotNumber') : undefined}
        >
          {(p) => <Input {...p} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />}
        </Field>
        <Field label={t('pages.achievements.fields.date')}>
          {(p) => (
            <DatePicker
              id={p.id}
              describedBy={p['aria-describedby']}
              invalid={p['aria-invalid']}
              value={day || undefined}
              max={riyadhToday()}
              onChange={(v) => setDay(v ?? '')}
            />
          )}
        </Field>
      </div>
      {cat?.has_deal_value ? <p className="text-sm text-muted">{t('pages.achievements.notRevenue')}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={!ready || busy} data-nudge-save>
          {t('pages.achievements.actions.save')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Link href={logUrl} className="text-sm font-medium text-primary hover:underline">
          {t('pages.weeklyReview.nudge.moreDetails')}
        </Link>
      </div>
    </form>
  );
}

function NotesSection({ list }: { list: ReviewList<ReviewNote> }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return (
    <SectionFrame name="notes" title={t('pages.weeklyReview.notes.title')} total={list.total}>
      {list.rows.length === 0 ? (
        <p className="py-3 text-base text-muted" data-review-empty>
          {t('pages.weeklyReview.notes.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {list.rows.map((n) => (
            <li key={n.id} data-review-note={n.id}>
              <Link
                href={`/my-day/notes/${n.id}`}
                className="flex min-h-12 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
              >
                {n.visibility === 'private' ? (
                  <Lock className="size-4 shrink-0 text-muted" aria-label={t('pages.weeklyReview.private')} />
                ) : null}
                <span className={`min-w-0 flex-1 break-words ${n.done ? 'text-muted line-through' : ''}`}>
                  {n.title || t('pages.myDay.note.untitled')}
                </span>
                {n.idea ? <StatusChip tone="neutral">{t('pages.weeklyReview.idea')}</StatusChip> : null}
                <span className="font-data text-xs whitespace-nowrap text-muted">
                  {formatDate(n.day, locale, { weekday: 'short' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <More count={moreThanShown(list)} />
    </SectionFrame>
  );
}
