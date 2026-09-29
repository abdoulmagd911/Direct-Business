'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Me } from '@/core/auth/me';
import { command, run, type ConflictField } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { modules } from '@/core/registry';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { FollowButton } from '@/ui/FollowButton';
import { Input } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PersonChip } from '@/ui/PersonChip';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import {
  LEVELS,
  avatarOf,
  nameOf,
  type Level,
  type OrgAnswer,
  type OrgPerson,
  type PersonAccess,
  type PersonRow,
} from '../types';
import type { Device } from './MyProfile';

export type PersonRecordData = {
  me: Me;
  tab: string;
  org: OrgAnswer;
  person: OrgPerson;
  /** The admin's fuller row (api.people), when the viewer may see it. */
  row: PersonRow | null;
  access: PersonAccess | null;
  history: HistoryRow[] | null;
  devices: Device[] | null;
  signIns: { id: string; at: string; email: string; result: string; user_agent: string | null }[] | null;
  /** The reads that failed for a reason other than access (`people`, `access`, `history`, `devices`, `signIns`). */
  failed: string[];
};

const TABS = ['overview', 'activity', 'related', 'appraisal'] as const;

/**
 * A person's record page (V95 template; V96: the appraisal tab is for the person, their manager and admins; V97: only
 * admins change people and access). Header: avatar, name, job title · team, chips for role and sign-in; key figures;
 * the main actions. Tabs Overview · Activity · Related · Appraisal. The rail holds every property, empty ones behind
 * "+ Add"; access overrides live there too, each change with its reason.
 */
export function PersonRecord({ data }: { data: PersonRecordData }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const { me, org, person, row, access, history, devices, signIns, failed } = data;
  const tab = (TABS as readonly string[]).includes(data.tab) ? data.tab : 'overview';
  const admin = me.person.role?.is_admin === true;
  const self = me.person.id === person.id;
  const people = Object.fromEntries(org.people.map((p) => [p.id, avatarOf(p, locale)]));
  const byId = (id: string | null) => (id ? org.people.find((p) => p.id === id) : undefined);
  const team = org.teams.find((x) => x.id === person.team_id);
  const dept = org.departments.find((x) => x.id === person.department_id);
  const manager = byId(person.manager_id);
  const pick = (x: { name_en: string; name_ar: string | null } | undefined) =>
    x ? (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : '';
  const roleName = pick(org.roles.find((r) => r.id === row?.role?.id));
  const reports = org.people.filter((p) => p.manager_id === person.id);
  const teammates = org.people.filter((p) => p.team_id && p.team_id === person.team_id && p.id !== person.id);
  const words = (done: string) => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  });
  const refresh = () => router.refresh();
  /** A read that failed (not a refusal) is said in words with Try again — never drawn as empty or as no access. */
  const failedRead = (name: string, what: string) =>
    failed.includes(name) ? (
      <DataState kind="failed" what={what} onRetry={refresh} retryLabel={t('common.tryAgain')} />
    ) : null;

  const [editing, setEditing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [temporary, setTemporary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [levelChange, setLevelChange] = useState<{ page: string; level: Level } | null>(null);
  const [roleChange, setRoleChange] = useState<string | null>(null);
  /**
   * The edit form shows the stored values and sends only what changed (the old app's lesson): it is filled from the
   * record every time Edit opens — so a refresh, an Undo or a change by someone else is what the form starts from,
   * never a copy taken at mount — and the version it was filled from is the one the write is checked against.
   */
  const stored = {
    full_name_en: person.full_name_en,
    job_title_en: person.job_title_en ?? '',
    department_id: person.department_id,
    team_id: person.team_id ?? '',
    manager_id: person.manager_id ?? '',
    joined_on: row?.joined_on ?? '',
    left_on: row?.left_on ?? '',
  };
  const [f, setF] = useState(stored);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const openEdit = () => {
    setF(stored);
    setFormVersion(row?.version ?? null);
    setEditing(true);
  };
  const [busy, setBusy] = useState(false);

  const changedFields = () => {
    const out: Record<string, string | null> = {};
    const norm = (k: keyof typeof stored) => (k === 'full_name_en' || k === 'job_title_en' ? f[k].trim() : f[k]);
    for (const k of Object.keys(stored) as (keyof typeof stored)[]) {
      const next = norm(k);
      if (next === stored[k]) continue;
      out[k] = k === 'full_name_en' || k === 'department_id' ? next : next || null;
    }
    return out;
  };

  const saveEdit = async () => {
    if (!row) return;
    const changes = changedFields();
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const write = (values: Record<string, unknown>, version: number) =>
      rpc('person_update', {
        p_id: person.id,
        p_changes: values as never,
        p_version: version,
      } as never) as Promise<{ request_id?: string | null } | null>;
    // FLOW-08: the fields this form writes, what it read when Edit opened, and how each reads in words — for the
    // conflict dialog (QA-69: the form starts from the record as it was when Edit opened, and that version is checked).
    const nameOfPerson = (id: unknown) => (typeof id === 'string' ? (byId(id)?.full_name_en ?? '—') : '—');
    const every: ConflictField[] = [
      { key: 'full_name_en', label: t('profile.fullNameEn'), mine: changes.full_name_en, read: row.full_name_en },
      {
        key: 'job_title_en',
        label: t('settings.people.jobTitleEn'),
        mine: changes.job_title_en,
        read: row.job_title_en,
      },
      {
        key: 'department_id',
        label: t('settings.people.department'),
        mine: changes.department_id,
        read: row.department_id,
        show: (v) => pick(org.departments.find((x) => x.id === v)) || '—',
      },
      {
        key: 'team_id',
        label: t('settings.people.team'),
        mine: changes.team_id,
        read: row.team_id,
        show: (v) => pick(org.teams.find((x) => x.id === v)) || t('settings.people.noTeam'),
      },
      {
        key: 'manager_id',
        label: t('settings.people.manager'),
        mine: changes.manager_id,
        read: row.manager_id,
        show: (v) => (v ? nameOfPerson(v) : t('settings.people.noManager')),
      },
      { key: 'joined_on', label: t('settings.people.joinedOn'), mine: changes.joined_on, read: row.joined_on },
      { key: 'left_on', label: t('settings.people.leftOn'), mine: changes.left_on, read: row.left_on },
    ];
    const fields = every.filter((x) => x.key in changes);
    await command(
      words(t('settings.people.updated', { name: f.full_name_en.trim() })),
      () => write(changes, formVersion ?? row.version),
      {
        after: () => {
          setEditing(false);
          refresh();
        },
        nameOf: (id) => {
          const p = byId(id);
          return p ? nameOf(p, locale) : undefined;
        },
        conflict: {
          fields,
          theirs: async () => {
            const rows = (await rpc('people', {} as never)) as unknown as PersonRow[];
            const now = rows.find((p) => p.id === person.id);
            if (!now) throw new Error('common.not_found');
            return { version: now.version, values: now as unknown as Record<string, unknown> };
          },
          retry: write,
        },
      },
    );
    setBusy(false);
  };
  const doSwitch = async (reason: string) => {
    const on = !(row?.can_sign_in ?? true);
    await run(
      words(
        t('settings.people.switched', {
          name: person.full_name_en,
          state: on ? t('settings.people.signInOn') : t('settings.people.signInOff'),
        }),
      ),
      async () => {
        const r = (await rpc('person_switch', { p_id: person.id, p_on: on, p_reason: reason } as never)) as {
          request_id?: string | null;
        } | null;
        await fetch('/auth/admin/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ person_id: person.id }),
        });
        return r;
      },
      () => {
        setSwitching(false);
        refresh();
      },
    );
  };
  // Generate temporary password (V441): admins only, with a reason; random, shown once here with Copy, never typed,
  // never mailed. The person chooses their own at their next sign-in.
  const generatePassword = async (reason: string) => {
    await run(words(t('settings.people.password.generated')), async () => {
      const res = await fetch('/auth/admin/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ person_id: person.id, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { key: string }; temporary_password?: string };
      if (!body.ok) throw new Error(body.error?.key ?? 'common.unavailable');
      setGenerating(false);
      setCopied(false);
      if (body.temporary_password) setTemporary(body.temporary_password);
      return null;
    });
  };
  const copyTemporary = async () => {
    if (!temporary) return;
    await navigator.clipboard.writeText(temporary);
    setCopied(true);
  };
  const signOutEverywhere = async (reason: string) => {
    await run(
      words(t('settings.people.signedOutEverywhere', { name: person.full_name_en })),
      async () => {
        const res = await fetch('/auth/admin/sign-out', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ person_id: person.id, reason }),
        });
        const body = (await res.json()) as { ok: boolean; error?: { key: string }; request_id?: string };
        if (!body.ok) throw new Error(body.error?.key ?? 'common.unavailable');
        return null;
      },
      () => {
        setSigningOut(false);
        refresh();
      },
    );
  };
  const addEmail = async () => {
    setBusy(true);
    await run(
      words(t('settings.people.emailAdded', { email: email.trim() })),
      async () => {
        const res = await fetch('/auth/admin/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            person_id: person.id,
            email: email.trim().toLowerCase(),
            primary: !(row?.emails.length ?? 0),
          }),
        });
        const body = (await res.json()) as { ok: boolean; error?: { key: string } };
        if (!body.ok) throw new Error(body.error?.key ?? 'common.unavailable');
        return null;
      },
      () => {
        setAddingEmail(false);
        setEmail('');
        refresh();
      },
    );
    setBusy(false);
  };
  const setLevel = async (reason: string) => {
    if (!levelChange) return;
    await run(
      words(t('settings.access.changed')),
      () =>
        rpc('access_set_person_level', {
          p_person: person.id,
          p_page: levelChange.page,
          p_level: levelChange.level,
          p_reason: reason,
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setLevelChange(null);
        refresh();
      },
    );
  };
  const setRole = async (reason: string) => {
    if (!roleChange) return;
    await run(
      words(t('settings.access.changed')),
      () =>
        rpc('access_set_person_role', {
          p_person: person.id,
          p_role: roleChange,
          p_reason: reason,
        } as never) as Promise<{ request_id?: string | null } | null>,
      () => {
        setRoleChange(null);
        refresh();
      },
    );
  };

  const figures: KeyFigure[] = [
    { key: 'emails', label: t('settings.people.emails'), value: row ? String(row.emails.length) : null },
    { key: 'devices', label: t('settings.people.devices'), value: devices ? String(devices.length) : null },
    {
      key: 'last',
      label: t('settings.people.lastSignIn'),
      value: row
        ? row.last_sign_in_at
          ? formatDate(new Date(row.last_sign_in_at), locale, { dateStyle: 'medium' })
          : t('settings.people.never')
        : null,
    },
    {
      key: 'joined',
      label: t('settings.people.joinedOn'),
      value: row?.joined_on ? formatDate(new Date(row.joined_on), locale, { dateStyle: 'medium' }) : row ? '—' : null,
    },
    { key: 'reports', label: t('settings.people.reports'), value: String(reports.length) },
  ];
  const pageLabel = (key: string) => {
    for (const m of modules) for (const p of m.pages ?? []) if (p.key === key) return t.has(p.label) ? t(p.label) : key;
    return key;
  };
  const pagesForLevels = access
    ? Object.keys(access.levels)
        .filter((k) => k !== 'settings.profile')
        .sort()
    : [];

  const rail = (
    <>
      <RailSection title={t('record.details')}>
        <RailField label={t('settings.people.role')}>
          {admin && !self && access ? (
            <Select
              value={person && row?.role?.id ? row.role.id : ''}
              onValueChange={(v) => setRoleChange(v)}
              options={org.roles.map((r) => ({ value: r.id, label: pick(r) }))}
              className="h-8 text-sm"
            />
          ) : (
            roleName || '—'
          )}
        </RailField>
        <RailField label={t('settings.people.department')}>{pick(dept)}</RailField>
        <RailField
          label={t('settings.people.team')}
          empty={!team}
          add={
            admin ? (
              <Button size="xs" variant="ghost" onClick={openEdit}>
                {t('common.addNew')}
              </Button>
            ) : (
              <span>—</span>
            )
          }
        >
          {pick(team)}
        </RailField>
        <RailField
          label={t('settings.people.manager')}
          empty={!manager}
          add={
            admin ? (
              <Button size="xs" variant="ghost" onClick={openEdit}>
                {t('common.addNew')}
              </Button>
            ) : (
              <span>—</span>
            )
          }
        >
          {manager ? <PersonChip person={avatarOf(manager, locale)} href={`/people/${manager.id}`} size="xs" /> : null}
        </RailField>
        {row ? (
          <>
            <RailField
              label={t('settings.people.joinedOn')}
              empty={!row.joined_on}
              add={
                admin ? (
                  <Button size="xs" variant="ghost" onClick={openEdit}>
                    {t('common.addNew')}
                  </Button>
                ) : (
                  <span>—</span>
                )
              }
            >
              {row.joined_on ? formatDate(new Date(row.joined_on), locale, { dateStyle: 'medium' }) : null}
            </RailField>
            {row.left_on ? (
              <RailField label={t('settings.people.leftOn')}>
                {formatDate(new Date(row.left_on), locale, { dateStyle: 'medium' })}
              </RailField>
            ) : null}
            <RailField
              label={t('settings.people.emails')}
              empty={!row.emails.length}
              add={
                admin ? (
                  <Button size="xs" variant="ghost" onClick={() => setAddingEmail(true)} data-email-add>
                    {t('settings.people.addEmail')}
                  </Button>
                ) : (
                  <span>—</span>
                )
              }
            >
              <ul className="flex flex-col gap-1 font-data text-xs">
                {row.emails.map((e) => (
                  <li key={e.email} className="flex items-center gap-2">
                    {e.email}
                    {e.is_primary ? <StatusChip tone="neutral">{t('settings.people.primary')}</StatusChip> : null}
                  </li>
                ))}
              </ul>
            </RailField>
          </>
        ) : null}
      </RailSection>
      {access ? (
        <RailSection title={t('settings.people.access')}>
          {pagesForLevels.map((page) => {
            const override = access.level_overrides.find((o) => o.page === page);
            return (
              <RailField key={page} label={pageLabel(page)}>
                <span className="flex items-center gap-2">
                  {admin && !self ? (
                    <Select
                      value={access.levels[page] ?? 'none'}
                      onValueChange={(v) => setLevelChange({ page, level: v as Level })}
                      options={LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
                      className="h-8 min-w-24 text-sm"
                    />
                  ) : (
                    <span>{t(`levels.${access.levels[page] ?? 'none'}`)}</span>
                  )}
                  {override ? <StatusChip tone="info">{t('settings.access.override')}</StatusChip> : null}
                </span>
              </RailField>
            );
          })}
        </RailSection>
      ) : null}
    </>
  );

  const follow = !self ? <FollowButton entity="person" id={person.id} /> : null;
  const actions =
    admin && !self ? (
      <>
        <Button variant="primary" onClick={openEdit} data-person-edit>
          {t('common.edit')}
        </Button>
        {follow}
        <Button onClick={() => setSwitching(true)} data-person-switch>
          {row?.can_sign_in ? t('settings.people.switchOff') : t('settings.people.switchOn')}
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button aria-label={t('common.more')} data-person-more>
              ⋯
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setGenerating(true)} data-password-generate>
              {t('settings.people.password.generate')}
            </MenuItem>
            <MenuItem onSelect={() => setSigningOut(true)}>{t('settings.people.signOutEverywhere')}</MenuItem>
          </MenuContent>
        </Menu>
      </>
    ) : self ? (
      <Button variant="primary" onClick={() => router.push('/profile')}>
        {t('profile.title')}
      </Button>
    ) : (
      follow
    );

  return (
    <RecordPage
      crumbs={[{ label: t('settings.tabs.people'), href: '/settings/org?tab=people' }]}
      back={{ href: '/settings/org?tab=people', label: t('record.back') }}
      avatar={<Avatar person={avatarOf(person, locale)} size="xl" />}
      title={person.full_name_en}
      subtitle={[person.job_title_en, pick(team) || pick(dept)].filter(Boolean).join(' · ')}
      chips={
        <>
          {roleName ? <StatusChip tone="neutral">{roleName}</StatusChip> : null}
          {row ? (
            row.left_on ? (
              <StatusChip tone="neutral">{t('settings.people.left')}</StatusChip>
            ) : row.can_sign_in ? (
              <StatusChip tone="success">{t('settings.people.signInOn')}</StatusChip>
            ) : (
              <StatusChip tone="warning">{t('settings.people.signInOff')}</StatusChip>
            )
          ) : null}
        </>
      }
      figures={figures}
      actions={actions}
      tabs={TABS.map((k) => ({
        key: k,
        label: k === 'appraisal' ? t('nav.appraisal') : t(`record.${k}`),
        count: k === 'activity' && history ? history.length : undefined,
      }))}
      tab={tab}
      tabHref={(k) => `/people/${person.id}?tab=${k}`}
      rail={rail}
      words={{ tabs: t('record.tabs'), notMeasured: t('common.notMeasured') }}
    >
      {tab === 'overview' ? (
        <>
          {failedRead('people', t('settings.tabs.people'))}
          {failedRead('access', t('settings.people.access'))}
          {devices ? (
            <Card title={t('settings.people.devices')}>
              {devices.length ? (
                <ul className="divide-y divide-border text-sm">
                  {devices.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                      <span>{d.device_label ?? t('profile.devices.unknown')}</span>
                      <span className="font-data text-xs text-muted">
                        {formatDate(new Date(d.last_seen_at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <DataState kind="empty" message={t('state.empty')} />
              )}
            </Card>
          ) : null}
          {signIns ? (
            <Card title={t('settings.people.signInLog')}>
              {!signIns.length ? <DataState kind="empty" message={t('state.empty')} /> : null}
              <ul className="divide-y divide-border text-sm">
                {signIns.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      <StatusChip tone={s.result === 'ok' || s.result === 'code_sent' ? 'success' : 'warning'}>
                        {t.has(`activity.signIn.results.${s.result}`)
                          ? t(`activity.signIn.results.${s.result}`)
                          : s.result}
                      </StatusChip>
                      <span className="font-data text-xs">{s.email}</span>
                    </span>
                    <span className="font-data text-xs text-muted">
                      {formatDate(new Date(s.at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {failedRead('devices', t('settings.people.devices'))}
          {failedRead('signIns', t('settings.people.signInLog'))}
          {!devices && !signIns && !failed.length ? <DataState kind="empty" message={t('state.empty')} /> : null}
        </>
      ) : null}
      {tab === 'activity' ? (
        history ? (
          <ActivityTimeline rows={history} people={people} onChanged={refresh} />
        ) : (
          (failedRead('history', t('record.activity')) ?? <DataState kind="no-access" what={t('record.activity')} />)
        )
      ) : null}
      {tab === 'related' ? (
        <>
          <Card title={t('settings.people.reports')}>
            {reports.length ? (
              <ul className="flex flex-wrap gap-2">
                {reports.map((p) => (
                  <li key={p.id}>
                    <PersonChip person={avatarOf(p, locale)} href={`/people/${p.id}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <DataState kind="empty" message={t('state.empty')} />
            )}
          </Card>
          <Card title={pick(team) || t('settings.people.team')}>
            {teammates.length ? (
              <ul className="flex flex-wrap gap-2">
                {teammates.map((p) => (
                  <li key={p.id}>
                    <PersonChip person={avatarOf(p, locale)} href={`/people/${p.id}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <DataState kind="empty" message={t('state.empty')} />
            )}
          </Card>
        </>
      ) : null}
      {tab === 'appraisal' ? <DataState kind="empty" message={t('state.empty')} /> : null}

      {row ? (
        <Dialog
          open={editing}
          onOpenChange={setEditing}
          title={
            t('settings.people.updated', { name: '' }).trim()
              ? `${t('common.edit')} · ${person.full_name_en}`
              : person.full_name_en
          }
          dirty
          footer={
            <>
              <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                disabled={!f.full_name_en.trim()}
                loading={busy}
                onClick={() => void saveEdit()}
                data-person-save
              >
                {t('common.save')}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('profile.fullNameEn')} className="sm:col-span-2">
              {(p) => (
                <Input {...p} value={f.full_name_en} onChange={(e) => setF({ ...f, full_name_en: e.target.value })} />
              )}
            </Field>
            <Field label={t('settings.people.jobTitleEn')} className="sm:col-span-2">
              {(p) => (
                <Input {...p} value={f.job_title_en} onChange={(e) => setF({ ...f, job_title_en: e.target.value })} />
              )}
            </Field>
            <Field label={t('settings.people.department')}>
              {(p) => (
                <Select
                  {...p}
                  value={f.department_id}
                  onValueChange={(v) => setF({ ...f, department_id: v, team_id: '' })}
                  options={org.departments.filter((d) => d.active).map((d) => ({ value: d.id, label: pick(d) }))}
                />
              )}
            </Field>
            <Field label={t('settings.people.team')}>
              {(p) => (
                <Select
                  {...p}
                  value={f.team_id}
                  onValueChange={(v) => setF({ ...f, team_id: v })}
                  placeholder={t('settings.people.noTeam')}
                  options={org.teams
                    .filter((x) => x.active && x.department_id === f.department_id)
                    .map((x) => ({ value: x.id, label: pick(x) }))}
                />
              )}
            </Field>
            <Field label={t('settings.people.manager')} className="sm:col-span-2">
              {(p) => (
                <Select
                  {...p}
                  value={f.manager_id}
                  onValueChange={(v) => setF({ ...f, manager_id: v })}
                  placeholder={t('settings.people.noManager')}
                  options={org.people
                    .filter((x) => x.id !== person.id)
                    .map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
                />
              )}
            </Field>
            <Field label={t('settings.people.joinedOn')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={f.joined_on}
                  onChange={(e) => setF({ ...f, joined_on: e.target.value })}
                  className="font-data"
                />
              )}
            </Field>
            <Field label={t('settings.people.leftOn')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={f.left_on}
                  onChange={(e) => setF({ ...f, left_on: e.target.value })}
                  className="font-data"
                />
              )}
            </Field>
          </div>
        </Dialog>
      ) : null}
      <ReasonDialog
        open={switching}
        onOpenChange={setSwitching}
        title={
          row?.can_sign_in
            ? t('settings.people.switchOffTitle', { name: person.full_name_en })
            : `${t('settings.people.switchOn')} · ${person.full_name_en}`
        }
        body={row?.can_sign_in ? t('settings.people.switchOffBody', { name: person.full_name_en }) : undefined}
        onSave={doSwitch}
        destructive={row?.can_sign_in ?? false}
        words={{
          reason: t('common.reason'),
          save: row?.can_sign_in ? t('settings.people.switchOff') : t('settings.people.switchOn'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      <ReasonDialog
        open={generating}
        onOpenChange={setGenerating}
        title={`${t('settings.people.password.generate')} · ${person.full_name_en}`}
        body={t('settings.people.password.body')}
        onSave={generatePassword}
        words={{
          reason: t('common.reason'),
          save: t('settings.people.password.generate'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      <Dialog
        open={temporary !== null}
        onOpenChange={(o) => !o && setTemporary(null)}
        title={t('settings.people.password.temporaryTitle', { name: person.full_name_en })}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button onClick={() => void copyTemporary()} data-password-copy>
              {copied ? t('settings.people.password.copied') : t('settings.people.password.copy')}
            </Button>
            <Button variant="primary" onClick={() => setTemporary(null)}>
              {t('common.close')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('settings.people.password.temporaryBody')}</p>
          <p
            className="select-all rounded-md border border-border bg-surface px-3 py-2 font-data text-lg"
            data-temporary-password
          >
            {temporary}
          </p>
        </div>
      </Dialog>
      <ReasonDialog
        open={signingOut}
        onOpenChange={setSigningOut}
        title={`${t('settings.people.signOutEverywhere')} · ${person.full_name_en}`}
        onSave={signOutEverywhere}
        words={{
          reason: t('common.reason'),
          save: t('settings.people.signOutEverywhere'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      <ReasonDialog
        open={levelChange !== null}
        onOpenChange={(o) => !o && setLevelChange(null)}
        title={
          levelChange
            ? t('settings.access.personLevel', { name: person.full_name_en, page: pageLabel(levelChange.page) })
            : ''
        }
        body={
          levelChange
            ? `${t(`levels.${access?.levels[levelChange.page] ?? 'none'}`)} → ${t(`levels.${levelChange.level}`)}`
            : undefined
        }
        onSave={setLevel}
        words={{
          reason: t('common.reason'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      <ReasonDialog
        open={roleChange !== null}
        onOpenChange={(o) => !o && setRoleChange(null)}
        title={`${t('settings.people.setRole')} · ${person.full_name_en}`}
        body={roleChange ? `${roleName || '—'} → ${pick(org.roles.find((r) => r.id === roleChange))}` : undefined}
        onSave={setRole}
        words={{
          reason: t('common.reason'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      <Dialog
        open={addingEmail}
        onOpenChange={setAddingEmail}
        title={`${t('settings.people.addEmail')} · ${person.full_name_en}`}
        dirty={email !== ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => setAddingEmail(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              loading={busy}
              onClick={() => void addEmail()}
              data-email-save
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('settings.people.email')}>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-data"
              autoFocus
            />
          )}
        </Field>
      </Dialog>
    </RecordPage>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Unused-import guard for Switch (kept for the edit dialog's sign-in switch in a later step).
void Switch;
