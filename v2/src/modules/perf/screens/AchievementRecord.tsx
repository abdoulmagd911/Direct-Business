'use client';
import { ExternalLink, MoreHorizontal, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate, formatMoney, formatNumber } from '@/core/i18n/format';
import { FromNoteChip } from '@/modules/my-day/screens/NoteBits';
import { PeoplePicker } from '@/modules/my-day/screens/PeoplePicker';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import type { FromNote, PartnerRef } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import { avatarOf, describeWith, nameOf } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { DatePicker } from '@/ui/DatePicker';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import { Comments, RecordHeaderCounts, type RecordComments } from '@/ui/record/Comments';
import { FilesSection, type RecordFile } from '@/ui/record/FilesSection';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import type { AchievementDetail, Category } from '../types';
import { displayLine } from '../types';
import { Marks } from './AchievementList';
import { readDealValue, riyadhToday } from './LogAchievement';
import { useCommandWords } from './words';

const TABS = ['overview', 'discussion', 'history', 'evidence'] as const;
/** The first day an achievement may be dated (achievement.before_2025). */
const FIRST_DAY = '2025-01-01';

/** The day before the first of the month a `YYYY-MM-DD` day is in: the latest day an achievement moves to. */
export function dayBeforeMonthOf(day: string): string {
  const [y, m] = day.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}
export type AchievementTab = (typeof TABS)[number];
/** The old tab addresses still land on the right tab: ?tab=activity is the History; ?tab=related is the Overview, where Related lives now. */
const TAB_ALIASES: Record<string, string> = { activity: 'history', related: 'overview', comments: 'discussion' };

export type AchievementRecordData = {
  a: AchievementDetail;
  tab: string;
  /** The Discussion filter the record opened with ('files' from the header's files count). */
  filter?: string;
  org: OrgAnswer | null;
  partnerName: string | null;
  /** The organisation as the Edit dialog's picker holds it; null when there is none (or it could not be read). */
  partner?: PartnerRef | null;
  history: HistoryRow[] | null;
  /** The Discussion's comments; null when they could not be read. */
  comments: RecordComments | null;
  /** The achievement's files (null when they could not be read); the header's evidence count and the Discussion stream read them. */
  files: RecordFile[] | null;
  categories: Category[];
  systems: { key: string; name: string }[];
  /** Full on KPIs for this record: give it an owner, change anyone's (with a reason). Move to an earlier month is for
   * whoever may edit it — its own people with Own, or Full (FIX-03 F088). */
  full: boolean;
  meId: string;
  /** The note it was turned from (V379), for a reader who may see that note. */
  fromNote: FromNote | null;
  failed: string[];
};

/**
 * An achievement's record page (V95 template, GC-4): its own line as the name, category and owner under it, its marks;
 * up to four key figures — deal value ("not revenue", V505), count, date, evidence; tabs Overview · Discussion ·
 * History · Evidence (the type tab: the uploaded files on top, URL references below, V99). Related lives in Overview
 * as a section (Phase 4, the one layout). Edit, Move to an earlier month and Participants for whoever may edit it — its
 * own people with Own, or Full (FIX-03 F088; a manager says why when it is not theirs) — Give owner for Full, Remove
 * with a reason — each with Undo.
 */
export function AchievementRecord({ data }: { data: AchievementRecordData }) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const refresh = () => router.refresh();
  const { a, org, full, meId } = data;
  const tab = (TABS as readonly string[]).includes(TAB_ALIASES[data.tab] ?? data.tab)
    ? ((TAB_ALIASES[data.tab] ?? data.tab) as AchievementTab)
    : 'overview';
  const discussionFilter =
    data.filter === 'files' || data.filter === 'questions' ? (data.filter as 'files' | 'questions') : undefined;
  // The Discussion tab's own count while it is open, so the tab's number follows an add or a delete at once.
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const person = (id: string | null) => (id && org ? org.people.find((p) => p.id === id) : undefined);
  const nameFor = (id: string | null) => {
    const p = person(id);
    return p ? nameOf(p, locale) : id ? '—' : t('marks.unknown');
  };
  const own = a.owner_id === meId || a.created_by === meId || a.participants.includes(meId);
  const reasonNeeded = !own;
  const category = locale === 'ar' ? a.category_ar : a.category_en;

  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit: the form starts from the record as it is when Edit opens; only what changed is sent, with that version.
  const stored = {
    title: a.title,
    category: a.category,
    happened_on: a.happened_on ?? '',
    deal_value: a.deal_value === null ? '' : String(a.deal_value),
    notes: a.notes ?? '',
    // the organisation can be set or corrected here (it could only be chosen when the achievement was logged, so a
    // forgotten one read "Contract signed with —" for good); an MoU with one names the side it was signed with
    partner: data.partner ?? null,
    side: (a.mou_side ?? '') as 'client' | 'supplier_partner' | '',
  };
  // What the form opened with, and the version it was read at: what changed is worked out against this, never
  // against the record as it reads now — a refresh landing while the dialog is open (the page re-reads after the last
  // save) made the form's older values look like changes, and saving wrote them back over that save.
  const snapshot = () => ({ ...stored, version: a.version });
  const [base, setBase] = useState(snapshot);
  const [f, setF] = useState(stored);
  const [reason, setReason] = useState('');
  const openEdit = () => {
    const s = snapshot();
    setBase(s);
    setF(s);
    setReason('');
    setEditing(true);
  };
  // the category chosen in the form: a value is offered and sent only when it carries a deal value — the database
  // refuses a value on any other category (achievement.no_deal_value), so a move to such a category clears it
  const editCat = data.categories.find((c) => c.code === f.category);
  // a dated achievement keeps a date (achievement.date_required): clearing it is said in place, never sent
  const dateCleared = base.happened_on !== '' && f.happened_on === '';
  // V521: an MoU with an organisation names the side it was signed with
  const editNeedsSide = !!editCat?.sets_prospect && !!f.partner;
  // an organisation that could not be read is left as it is — never read as none, which a save would clear
  const partnerKnown = !a.partner_id || !!data.partner;
  const editWithValue = !!editCat?.has_deal_value;
  const changes = () => {
    const out: Record<string, unknown> = {};
    if (f.title.trim() !== base.title) out.title = f.title.trim();
    if (f.category !== base.category) out.category = f.category;
    if (f.happened_on !== base.happened_on) out.happened_on = f.happened_on || null;
    if (partnerKnown && (f.partner?.id ?? null) !== (base.partner?.id ?? null)) out.partner_id = f.partner?.id ?? null;
    if (editNeedsSide && f.side !== base.side) out.side = f.side || null;
    if (!editWithValue) {
      if (base.deal_value !== '' && f.category !== base.category) out.deal_value = null;
    } else if (f.deal_value.trim() !== base.deal_value)
      // Read through readDealValue, not Number(): Arabic digits pass the check above but Number() reads
      // them as NaN, which becomes null and clears the value.
      out.deal_value = f.deal_value.trim() ? readDealValue(f.deal_value) : null;
    if (f.notes.trim() !== base.notes) out.notes = f.notes.trim() || null;
    return out;
  };
  const saveEdit = async () => {
    const values = changes();
    if (!Object.keys(values).length) return setEditing(false);
    setBusy(true);
    await command(
      words(t('saved')),
      () =>
        rpc('achievement_update', {
          p_id: a.id,
          p_values: values as never,
          // the version the form was read at: a field changed since by someone else is a conflict, not overwritten
          p_version: base.version,
          ...(reason.trim() ? { p_reason: reason.trim() } : {}),
        }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          setEditing(false);
          refresh();
        },
      },
    );
    setBusy(false);
  };

  // Participants (FIX-06 F077 set them on the log only): the department's colleagues, never the owner, who is already
  // on the record; one request through api.achievement_participants_set, with Undo
  const [editingPeople, setEditingPeople] = useState(false);
  const [chosen, setChosen] = useState<string[]>(a.participants);
  const colleagues = (org?.people ?? [])
    .filter((p) => p.department_id === a.department_id && p.id !== a.owner_id)
    .map((p) => ({ id: p.id, name: nameOf(p, locale) }));
  const openParticipants = () => {
    setChosen(a.participants.filter((id) => id !== a.owner_id));
    setEditingPeople(true);
  };
  const peopleChanged = chosen.length !== a.participants.length || chosen.some((id) => !a.participants.includes(id));
  const saveParticipants = async () => {
    setBusy(true);
    await command(
      words(t('participantsSaved')),
      () =>
        rpc('achievement_participants_set', { p_id: a.id, p_people: chosen }) as Promise<{
          request_id?: string | null;
        }>,
      {
        after: () => {
          setEditingPeople(false);
          refresh();
        },
      },
    );
    setBusy(false);
  };
  const [moveTo, setMoveTo] = useState('');
  const [newOwner, setNewOwner] = useState('');
  // Move goes to an earlier month only (achievement.move_earlier_only) and never before 2025 (achievement.before_2025):
  // the box offers exactly those days — the last one is the day before the month the achievement is in
  const moveMax = a.happened_on ? dayBeforeMonthOf(a.happened_on) : undefined;
  const moveOk = /^\d{4}-\d{2}-\d{2}$/.test(moveTo) && moveTo >= FIRST_DAY && !!moveMax && moveTo <= moveMax;
  const openMove = () => {
    setMoveTo('');
    setMoving(true);
  };

  const figures: KeyFigure[] = [
    ...(a.has_deal_value
      ? [
          {
            key: 'value',
            label: t('figures.value'),
            value: a.deal_value === null ? null : formatMoney(a.deal_value, locale),
            note: t('notRevenue'),
          },
        ]
      : []),
    // FIX-06: a value logged on a category without a deal value shows as a plain number (D29), never money.
    ...(!a.has_deal_value && a.deal_value !== null
      ? [
          {
            key: 'value',
            label: t('figures.valuePlain'),
            value: formatNumber(a.deal_value, locale),
            note: t('notRevenue'),
          },
        ]
      : []),
    { key: 'count', label: t('figures.count'), value: formatNumber(a.count, locale) },
    { key: 'date', label: t('figures.date'), value: a.happened_on ? formatDate(a.happened_on, locale) : null },
  ];

  const source =
    a.source_kind && a.source_period
      ? t('source', { kind: t(`reports.${a.source_kind}`), period: a.source_period })
      : null;

  const people = org ? Object.fromEntries(org.people.map((p) => [p.id, avatarOf(p, locale)])) : {};
  const reasonWords = {
    reason: t('dialogs.reason'),
    save: t('actions.save'),
    cancel: t('actions.cancel'),
    reasonRequired: t('dialogs.reasonRequired'),
  };

  return (
    <>
      <RecordPage
        crumbs={[
          { label: t('title'), href: '/kpis/achievements' },
          {
            label: (
              <>
                {a.number} · <bdi>{a.title}</bdi>
              </>
            ),
          },
        ]}
        // a phone has the back arrow and the title, no trail; the title takes three lines, then a "more" tap
        crumbsClass="max-lg:hidden"
        titleMore={{ more: t('titleMore'), less: t('titleLess') }}
        back={{ href: '/kpis/achievements', label: t('backTo') }}
        title={displayLine(locale === 'ar' ? a.line_ar : a.line_en)}
        subtitle={[
          a.number,
          a.happened_on ? formatDate(a.happened_on, locale) : t('noDate'),
          data.partnerName,
          category,
          nameFor(a.owner_id),
        ]
          .filter(Boolean)
          .join(' · ')}
        chips={
          <>
            <Marks row={a} />
            {data.fromNote ? <FromNoteChip note={data.fromNote} /> : null}
            <RecordHeaderCounts
              comments={commentCount ?? data.comments?.comments.length ?? null}
              // the header counts the same evidence the Evidence tab counts — files plus references — so the
              // two numbers agree (F-B2-03); a failed files read leaves the count out, never zero.
              evidence={{
                count: data.files === null ? null : data.files.length + a.refs.length,
                href: `/kpis/achievements/${a.id}?tab=evidence`,
              }}
              href={(f) => `/kpis/achievements/${a.id}?tab=discussion${f === 'files' ? '&filter=files' : ''}`}
            />
          </>
        }
        figures={figures}
        actions={
          a.can_edit ? (
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={openEdit} data-edit-achievement>
                {t('actions.edit')}
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label={tc('common.more')} icon={<MoreHorizontal />} />
                </MenuTrigger>
                <MenuContent>
                  {a.can_edit && a.happened_on && moveMax && moveMax >= FIRST_DAY ? (
                    <MenuItem onSelect={openMove} data-achievement-move>
                      {t('actions.move')}
                    </MenuItem>
                  ) : null}
                  {full && a.needs_owner ? (
                    <MenuItem onSelect={() => setAssigning(true)}>{t('actions.assign')}</MenuItem>
                  ) : null}
                  <MenuItem icon={<Trash2 />} onSelect={() => setRemoving(true)}>
                    {t('actions.remove')}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ) : null
        }
        tabs={TABS.map((k) => ({
          key: k,
          // FIX-36 F086/F085 (F-B2-03): the Evidence tab counts ALL evidence — files and references — the
          // same set the header counts, so the two numbers agree; when the files read failed (null) the tab
          // falls back to the references alone and the header leaves its count out.
          label:
            k === 'evidence'
              ? `${t('tabs.evidence')} (${formatNumber((data.files?.length ?? 0) + a.refs.length, locale)})`
              : t(`tabs.${k}`),
          count: k === 'discussion' ? (commentCount ?? data.comments?.comments.length ?? undefined) : undefined,
        }))}
        tab={tab}
        tabHref={(k) => `/kpis/achievements/${a.id}?tab=${k}`}
        words={{ tabs: tc('record.tabs'), notMeasured: tc('common.notMeasured') }}
        rail={
          <RailSection title={tc('record.details')}>
            <RailField label={t('fields.number')}>
              <span className="font-data">{a.number}</span>
            </RailField>
            <RailField label={t('fields.category')}>{category}</RailField>
            {a.repeat_of ? (
              <RailField label={t('fields.repeatOf')}>
                <Link href={`/kpis/achievements/${a.repeat_of}`} className="font-data text-link hover:underline">
                  {a.repeat_of_number}
                </Link>
              </RailField>
            ) : null}
            {/* FIX-35: the task this achievement was logged from (source_task_id, stored by the form) — the number
                only when the reader may see the task; without it there is no link to draw. */}
            {a.source_task_number ? (
              <RailField label={t('fields.task')}>
                <Link
                  href={`/tasks/${a.source_task_number}`}
                  className="font-data text-link hover:underline"
                  data-achievement-task
                >
                  {a.source_task_number}
                </Link>
              </RailField>
            ) : null}
            {a.mou_side ? <RailField label={t('fields.side')}>{t(`sides.${a.mou_side}`)}</RailField> : null}
            <RailField label={t('fields.owner')}>{nameFor(a.owner_id)}</RailField>
            <RailField label={t('fields.organisation')} empty={!data.partnerName}>
              {a.partner_id && data.partnerName ? (
                <Link
                  href={`/partners/${a.partner_id}`}
                  className="text-link hover:underline"
                  data-achievement-organisation
                >
                  {data.partnerName}
                </Link>
              ) : null}
            </RailField>
            <RailField label={t('fields.date')}>
              {a.happened_on ? formatDate(a.happened_on, locale) : t('noDate')}
            </RailField>
            <RailField label={t('fields.logged')}>{formatDate(a.logged_at, locale)}</RailField>
            {source ? <RailField label={t('fields.source')}>{source}</RailField> : null}
            {a.moved_from ? (
              <>
                <RailField label={t('fields.movedFrom')}>{formatDate(a.moved_from, locale)}</RailField>
                <RailField label={t('fields.moveReason')}>{a.move_reason}</RailField>
              </>
            ) : null}
          </RailSection>
        }
      >
        {tab === 'overview' ? (
          <section className="flex flex-col gap-3" data-tab="overview">
            <p className="text-text">
              <bdi>{a.title}</bdi>
            </p>
            {a.notes ? <p className="whitespace-pre-wrap text-muted">{a.notes}</p> : null}
            <p
              className="text-sm text-muted"
              lang={locale === 'ar' ? 'en' : 'ar'}
              dir={locale === 'ar' ? 'ltr' : 'rtl'}
            >
              {displayLine(locale === 'ar' ? a.line_en : a.line_ar)}
            </p>
            {/* Related lives here now (Phase 4, the one layout): its own tab is gone. */}
            <div className="flex flex-col gap-2" data-tab="related">
              <h2 className="text-lg font-semibold">{t('tabs.related')}</h2>
              <RailField label={t('fields.organisation')} empty={!data.partnerName}>
                {a.partner_id && data.partnerName ? (
                  <Link
                    href={`/partners/${a.partner_id}`}
                    className="text-link hover:underline"
                    data-achievement-organisation
                  >
                    {data.partnerName}
                  </Link>
                ) : null}
              </RailField>
              {/* FIX-35: the source task, beside the organisation it was logged from. */}
              {a.source_task_number ? (
                <RailField label={t('fields.task')}>
                  <Link
                    href={`/tasks/${a.source_task_number}`}
                    className="font-data text-link hover:underline"
                    data-achievement-task
                  >
                    {a.source_task_number}
                  </Link>
                </RailField>
              ) : null}
              {/* FIX-36 F092: the Participants term only shows when someone took part — never an empty term; whoever
                  may edit the achievement changes them here (they could only be set when it was logged), and with
                  none yet sees the one button that adds them. */}
              {a.participants.length || a.can_edit ? (
                <RailField
                  label={t('fields.participants')}
                  empty={!a.participants.length}
                  add={
                    <Button size="sm" variant="ghost" onClick={openParticipants} data-add-participants>
                      {t('actions.addParticipants')}
                    </Button>
                  }
                >
                  <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{a.participants.map((id) => nameFor(id)).join(' · ')}</span>
                    {a.can_edit ? (
                      <Button size="xs" variant="ghost" onClick={openParticipants} data-edit-participants>
                        {t('actions.editParticipants')}
                      </Button>
                    ) : null}
                  </span>
                </RailField>
              ) : null}
              {source ? <RailField label={t('fields.source')}>{source}</RailField> : null}
            </div>
          </section>
        ) : null}
        {tab === 'discussion' ? (
          data.comments ? (
            <Comments
              entity="achievement"
              id={a.id}
              data={data.comments}
              locale={locale}
              personName={nameFor(meId)}
              people={(org?.people ?? []).map((p) => ({ id: p.id, name: nameOf(p, locale) }))}
              label={t('tabs.discussion')}
              onCount={setCommentCount}
              files={data.files}
              onFilesRetry={refresh}
              initialFilter={discussionFilter}
            />
          ) : (
            <DataState
              kind="failed"
              what={t('tabs.discussion')}
              message={tc('state.failed', { what: t('tabs.discussion') })}
              onRetry={refresh}
              retryLabel={tc('common.tryAgain')}
            />
          )
        ) : null}
        {tab === 'history' ? (
          data.history ? (
            <ActivityTimeline
              rows={data.history}
              people={people}
              onChanged={refresh}
              describe={org ? describeWith(org, locale) : undefined}
            />
          ) : (
            <DataState
              kind="failed"
              what={t('tabs.history')}
              message={tc('state.failed', { what: t('tabs.history') })}
              onRetry={refresh}
              retryLabel={tc('common.tryAgain')}
            />
          )
        ) : null}
        {tab === 'evidence' ? <Evidence data={data} /> : null}
      </RecordPage>

      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title={t('dialogs.edit')}
        dirty={Object.keys(changes()).length > 0}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={
                busy ||
                !f.title.trim() ||
                dateCleared ||
                (editNeedsSide && !f.side) ||
                (reasonNeeded && !reason.trim()) ||
                (editWithValue && f.deal_value.trim() !== '' && readDealValue(f.deal_value) === null)
              }
              onClick={() => void saveEdit()}
            >
              {t('actions.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('fields.category')}>
            {(p) => (
              <Select
                id={p.id}
                aria-label={t('fields.category')}
                value={f.category}
                options={data.categories
                  .filter((c) => c.active || c.code === a.category)
                  // a sub-category reads under its parent, as on Log achievement
                  .map((c) => ({
                    value: c.code,
                    label: (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en),
                  }))}
                onValueChange={(v) => setF({ ...f, category: v })}
              />
            )}
          </Field>
          <Field label={t('fields.title')} required={tc('common.required')}>
            {(p) => (
              <Input {...p} value={f.title} maxLength={300} onChange={(e) => setF({ ...f, title: e.target.value })} />
            )}
          </Field>
          <Field
            label={t('fields.date')}
            required={base.happened_on ? tc('common.required') : undefined}
            error={dateCleared ? t('errors.achievement.date_required') : undefined}
          >
            {(p) => (
              <DatePicker
                id={p.id}
                describedBy={p['aria-describedby']}
                invalid={p['aria-invalid']}
                min={FIRST_DAY}
                max={riyadhToday()}
                value={f.happened_on || undefined}
                onChange={(v) => setF({ ...f, happened_on: v ?? '' })}
              />
            )}
          </Field>
          {partnerKnown ? (
            <Field label={t('fields.organisation')}>
              {(p) => <PartnerPicker id={p.id} value={f.partner} onChange={(partner) => setF({ ...f, partner })} />}
            </Field>
          ) : null}
          {editNeedsSide ? (
            <Field label={t('fields.side')} required={tc('common.required')}>
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
          {/* FIX-06: the value is a plain number labelled with the category's own name as the unit; offered only for
              a category that carries a deal value (the database refuses one on any other). */}
          {editCat && editWithValue ? (
            <Field
              label={`${t('fields.valueLabel')} (${locale === 'ar' ? editCat.name_ar : editCat.name_en}) · ${t(
                'notRevenue',
              )}`}
              error={f.deal_value.trim() && readDealValue(f.deal_value) === null ? t('valueNotNumber') : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  mono
                  inputMode="decimal"
                  value={f.deal_value}
                  onChange={(e) => setF({ ...f, deal_value: e.target.value })}
                />
              )}
            </Field>
          ) : null}
          <Field label={t('fields.notes')}>
            {(p) => <Textarea {...p} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}
          </Field>
          {reasonNeeded ? (
            <Field label={t('dialogs.reason')} required={tc('common.required')}>
              {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={editingPeople}
        onOpenChange={setEditingPeople}
        title={t('dialogs.participants')}
        dirty={peopleChanged}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingPeople(false)}>
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={busy || !peopleChanged}
              onClick={() => void saveParticipants()}
              data-participants-save
            >
              {t('actions.save')}
            </Button>
          </>
        }
      >
        <Field label={t('fields.participants')}>
          {(p) => (
            <div className="flex flex-col gap-2" data-record-participants>
              {chosen.length ? (
                <ul className="flex flex-col gap-1">
                  {chosen.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2" data-record-participant={id}>
                      <span className="min-w-0 break-words">{nameFor(id)}</span>
                      <IconButton
                        size="sm"
                        label={t('actions.removeParticipant', { name: nameFor(id) })}
                        icon={<X />}
                        onClick={() => setChosen(chosen.filter((x) => x !== id))}
                        data-participant-remove={id}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <PeoplePicker
                id={p.id}
                variant="mention"
                options={colleagues.filter((x) => !chosen.includes(x.id))}
                onPick={(v) => setChosen([...chosen, v])}
              />
            </div>
          )}
        </Field>
      </Dialog>

      <ReasonDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('dialogs.remove')}
        destructive
        words={reasonWords}
        onSave={async (why) => {
          await command(
            words(t('removed')),
            () =>
              rpc('achievements_remove', { p_ids: [a.id], p_reason: why }) as Promise<{ request_id?: string | null }>,
            { after: () => router.push('/kpis/achievements') },
          );
        }}
      />

      <ReasonDialog
        open={moving}
        onOpenChange={setMoving}
        title={t('dialogs.move')}
        words={reasonWords}
        saveDisabled={!moveOk}
        onSave={async (why) => {
          await command(
            words(t('moved')),
            () =>
              rpc('achievement_move', { p_id: a.id, p_to: moveTo, p_reason: why, p_version: a.version }) as Promise<{
                request_id?: string | null;
              }>,
            {
              after: () => {
                setMoving(false);
                refresh();
              },
            },
          );
        }}
      >
        <Field label={t('fields.date')}>
          {(p) => (
            <DatePicker
              id={p.id}
              describedBy={p['aria-describedby']}
              invalid={p['aria-invalid']}
              value={moveTo || undefined}
              min={FIRST_DAY}
              max={moveMax}
              chips="none"
              onChange={(v) => setMoveTo(v ?? '')}
            />
          )}
        </Field>
      </ReasonDialog>

      <Dialog
        open={assigning}
        onOpenChange={setAssigning}
        title={t('dialogs.assign')}
        footer={
          <Button
            variant="primary"
            disabled={!newOwner}
            onClick={() =>
              void command(
                words(t('assigned')),
                () =>
                  rpc('achievements_assign', { p_ids: [a.id], p_owner: newOwner }) as Promise<{
                    request_id?: string | null;
                  }>,
                {
                  after: () => {
                    setAssigning(false);
                    refresh();
                  },
                },
              )
            }
          >
            {t('actions.save')}
          </Button>
        }
      >
        <Field label={t('fields.owner')}>
          {(p) => (
            <Select
              id={p.id}
              aria-label={t('fields.owner')}
              value={newOwner}
              placeholder={t('actions.choose')}
              options={(org?.people ?? []).map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
              onValueChange={setNewOwner}
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}

/**
 * A reference's link, only when it is a web address (http or https): anything else (a `javascript:` link) is never
 * drawn as a link a tap could follow. The database holds only web addresses (achievement_ref_url_check); this keeps
 * the page safe whatever reaches it.
 */
export function webLink(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

/** The type tab (V99): the uploaded files on top, the references with their links below; Add reference and Remove for its editors. */
function Evidence({ data }: { data: AchievementRecordData }) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const { a } = data;
  const [system, setSystem] = useState(data.systems[0]?.key ?? '');
  const [value, setValue] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    await command(
      words(t('refAdded')),
      () =>
        rpc('achievement_ref_add', {
          p_id: a.id,
          p_system: system,
          p_value: value.trim(),
          ...(url.trim() ? { p_url: url.trim() } : {}),
        }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          setValue('');
          setUrl('');
          router.refresh();
        },
      },
    );
    setBusy(false);
  };
  return (
    <section className="flex flex-col gap-4" data-tab="evidence">
      <FilesSection
        entity="achievement"
        recordId={a.id}
        kinds={[{ kind: 'evidence', purpose: 'evidence', label: tc('record.files.kinds.evidence') }]}
        files={data.files}
        mayWrite={a.can_edit}
        onDone={() => router.refresh()}
        title={tc('record.files.title')}
      />
      {a.refs.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" data-refs>
          {a.refs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-sm text-muted">{locale === 'ar' ? r.system_ar : r.system_en}</span>
              {webLink(r.url) ? (
                <a
                  href={webLink(r.url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-data text-link"
                >
                  {r.value}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="font-data">{r.value}</span>
              )}
              {a.can_edit ? (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() =>
                    void command(
                      words(t('refRemoved')),
                      () =>
                        rpc('achievement_refs_remove', { p_ids: [r.id] }) as Promise<{ request_id?: string | null }>,
                      { after: () => router.refresh() },
                    )
                  }
                >
                  {t('actions.remove')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {a.can_edit ? (
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() && !busy) void add();
          }}
        >
          <Field label={t('fields.system')}>
            {(p) => (
              <Select
                id={p.id}
                aria-label={t('fields.system')}
                value={system}
                options={data.systems.map((s) => ({ value: s.key, label: s.name }))}
                onValueChange={setSystem}
              />
            )}
          </Field>
          <Field label={t('fields.reference')}>
            {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} />}
          </Field>
          <Field label={t('fields.link')}>
            {(p) => <Input {...p} type="url" value={url} onChange={(e) => setUrl(e.target.value)} />}
          </Field>
          <Button type="submit" loading={busy} disabled={!value.trim() || busy}>
            {t('actions.addRef')}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
