'use client';
import { ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate, formatMoney, formatNumber } from '@/core/i18n/format';
import { FromNoteChip } from '@/modules/my-day/screens/NoteBits';
import type { FromNote } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import { avatarOf, describeWith, nameOf } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import type { AchievementDetail, Category } from '../types';
import { Marks } from './AchievementList';
import { riyadhToday } from './LogAchievement';
import { useCommandWords } from './words';

const TABS = ['overview', 'activity', 'related', 'evidence'] as const;
export type AchievementTab = (typeof TABS)[number];

export type AchievementRecordData = {
  a: AchievementDetail;
  tab: string;
  org: OrgAnswer | null;
  partnerName: string | null;
  history: HistoryRow[] | null;
  categories: Category[];
  systems: { key: string; name: string }[];
  /** Full on KPIs for this record: move it, give it an owner, change anyone's (with a reason). */
  full: boolean;
  meId: string;
  /** The note it was turned from (V379), for a reader who may see that note. */
  fromNote: FromNote | null;
  failed: string[];
};

/**
 * An achievement's record page (V95 template, GC-4): its own line as the name, category and owner under it, its marks;
 * up to four key figures — deal value ("not revenue", V505), count, date, evidence; tabs Overview · Activity · Related
 * · Evidence (the type tab: references with their links, V99). Edit for its own people (a manager says why when it is
 * not theirs), Move to an earlier period and Give owner for Full, Remove with a reason — each with Undo.
 */
export function AchievementRecord({ data }: { data: AchievementRecordData }) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useCommandWords();
  const refresh = () => router.refresh();
  const { a, org, full, meId } = data;
  const tab = (TABS as readonly string[]).includes(data.tab) ? (data.tab as AchievementTab) : 'overview';
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
  };
  const [f, setF] = useState(stored);
  const [reason, setReason] = useState('');
  const openEdit = () => {
    setF(stored);
    setReason('');
    setEditing(true);
  };
  const changes = () => {
    const out: Record<string, unknown> = {};
    if (f.title.trim() !== stored.title) out.title = f.title.trim();
    if (f.category !== stored.category) out.category = f.category;
    if (f.happened_on !== stored.happened_on) out.happened_on = f.happened_on || null;
    if (f.deal_value.trim() !== stored.deal_value)
      out.deal_value = f.deal_value.trim() ? Number(f.deal_value.replace(/,/g, '')) : null;
    if (f.notes.trim() !== stored.notes) out.notes = f.notes.trim() || null;
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
          p_version: a.version,
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

  const [moveTo, setMoveTo] = useState('');
  const [newOwner, setNewOwner] = useState('');

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
    { key: 'count', label: t('figures.count'), value: formatNumber(a.count, locale) },
    { key: 'date', label: t('figures.date'), value: a.happened_on ? formatDate(a.happened_on, locale) : null },
    { key: 'refs', label: t('figures.refs'), value: formatNumber(a.refs.length, locale) },
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
          { label: tc('nav.kpis'), href: '/kpis' },
          { label: t('title'), href: '/kpis/achievements' },
        ]}
        back={{ href: '/kpis/achievements', label: t('back') }}
        title={locale === 'ar' ? a.line_ar : a.line_en}
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
                  {full && a.happened_on ? (
                    <MenuItem onSelect={() => setMoving(true)}>{t('actions.move')}</MenuItem>
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
        tabs={TABS.map((k) => ({ key: k, label: t(`tabs.${k}`), count: k === 'evidence' ? a.refs.length : undefined }))}
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
            <p className="text-text">{a.title}</p>
            {a.notes ? <p className="whitespace-pre-wrap text-muted">{a.notes}</p> : null}
            <p
              className="text-sm text-muted"
              lang={locale === 'ar' ? 'en' : 'ar'}
              dir={locale === 'ar' ? 'ltr' : 'rtl'}
            >
              {locale === 'ar' ? a.line_en : a.line_ar}
            </p>
          </section>
        ) : null}
        {tab === 'activity' ? (
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
              what={tc('record.activity')}
              message={tc('state.failed', { what: tc('record.activity') })}
              onRetry={refresh}
              retryLabel={tc('common.tryAgain')}
            />
          )
        ) : null}
        {tab === 'related' ? (
          <section className="flex flex-col gap-2" data-tab="related">
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
            <RailField label={t('fields.participants')} empty={!a.participants.length}>
              {a.participants.map((id) => nameFor(id)).join(' · ')}
            </RailField>
            {source ? <RailField label={t('fields.source')}>{source}</RailField> : null}
          </section>
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
              disabled={busy || !f.title.trim() || (reasonNeeded && !reason.trim())}
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
                  .map((c) => ({ value: c.code, label: locale === 'ar' ? c.name_ar : c.name_en }))}
                onValueChange={(v) => setF({ ...f, category: v })}
              />
            )}
          </Field>
          <Field label={t('fields.title')}>
            {(p) => <Input {...p} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}
          </Field>
          <Field label={t('fields.date')}>
            {(p) => (
              <Input
                {...p}
                type="date"
                max={riyadhToday()}
                value={f.happened_on}
                onChange={(e) => setF({ ...f, happened_on: e.target.value })}
              />
            )}
          </Field>
          {data.categories.find((c) => c.code === f.category)?.has_deal_value ? (
            <Field label={`${t('fields.value')} · ${t('notRevenue')}`}>
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
            <Field label={t('dialogs.reason')}>
              {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          ) : null}
        </div>
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
        saveDisabled={!moveTo}
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
          {(p) => <Input {...p} type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />}
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
              value={newOwner || undefined}
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

/** The type tab (V99): the references with their links; Add reference and Remove for its editors. */
function Evidence({ data }: { data: AchievementRecordData }) {
  const t = useTranslations('pages.achievements');
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
      {a.refs.length === 0 && a.no_evidence ? <DataState kind="empty" message={t('evidenceNone')} /> : null}
      {a.refs.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" data-refs>
          {a.refs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-sm text-muted">{r.system_en}</span>
              {r.url ? (
                <a
                  href={r.url}
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
