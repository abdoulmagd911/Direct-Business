'use client';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Me } from '@/core/auth/me';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { modules } from '@/core/registry';
import type { SettingDefRow } from '@/modules/settings/schema';
import { SettingCard } from '@/modules/settings/screens/SettingCard';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { StatusChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import {
  LEVELS,
  avatarOf,
  nameOf,
  type Level,
  type MatrixAnswer,
  type OrgAnswer,
  type OrgRole,
  type OrgTeam,
  type PeopleAnswer,
} from '../types';

export type { MatrixAnswer, OrgAnswer, PeopleAnswer } from '../types';

const TABS = ['people', 'teams', 'roles', 'access', 'settings'] as const;

/** The page labels of the registry, for the access matrix. */
function pageLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of modules) for (const p of m.pages ?? []) out[p.key] = p.label;
  return out;
}
function capLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of modules) for (const c of m.capabilities ?? []) out[c.key] = c.label;
  return out;
}

/**
 * Organization & access (V97, V125, V132; admins only): one tab row — People · Teams · Roles · Access · Settings.
 * People are added here and opened on their record page; teams are retired with a move-to, never deleted (D11);
 * roles are renamed; the access matrix sets each role's starting level per page and its capabilities, every change
 * with its reason and one Undo.
 */
export function OrgAccess({
  me,
  tab,
  org,
  people,
  matrix,
  settings,
  canEdit,
  today,
}: {
  me: Me;
  tab: string;
  org: OrgAnswer;
  people: PeopleAnswer;
  matrix: MatrixAnswer;
  settings: SettingDefRow[];
  canEdit: boolean;
  /** Riyadh's date on the server, for the day a setting change applies from (PRF-139). */
  today: string;
}) {
  const t = useTranslations();
  const current = (TABS as readonly string[]).includes(tab) ? tab : 'people';
  return (
    <>
      <Tabs
        label={t('nav.settings.org')}
        value={current}
        tabs={TABS.map((k) => ({
          value: k,
          label: t(`settings.tabs.${k}`),
          href: `/settings/org?tab=${k}`,
          count:
            k === 'people'
              ? people.filter((p) => p.active).length
              : k === 'teams'
                ? org.teams.filter((x) => x.active).length
                : k === 'roles'
                  ? org.roles.length
                  : undefined,
        }))}
      />
      {current === 'people' ? <PeopleTab me={me} org={org} people={people} /> : null}
      {current === 'teams' ? <TeamsTab org={org} /> : null}
      {current === 'roles' ? <RolesTab org={org} people={people} /> : null}
      {current === 'access' ? <AccessTab matrix={matrix} /> : null}
      {current === 'settings'
        ? settings.map((def) => (
            <SettingCard key={def.key} def={def} departments={org.departments} canEdit={canEdit} today={today} />
          ))
        : null}
    </>
  );
}

function useWords(done: string) {
  const t = useTranslations();
  return {
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  };
}

function useNames(org: OrgAnswer) {
  const locale = useLocale() as 'en' | 'ar';
  return useMemo(() => {
    const person = new Map(org.people.map((p) => [p.id, p]));
    const team = new Map(org.teams.map((x) => [x.id, x]));
    const dept = new Map(org.departments.map((x) => [x.id, x]));
    const pick = (x: { name_en: string; name_ar: string | null } | undefined) =>
      x ? (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : '';
    return {
      person: (id: string | null) => (id && person.get(id) ? nameOf(person.get(id)!, locale) : ''),
      avatar: (id: string) => (person.get(id) ? avatarOf(person.get(id)!, locale) : null),
      team: (id: string | null) => pick(id ? team.get(id) : undefined),
      dept: (id: string | null) => pick(id ? dept.get(id) : undefined),
      pick,
      role: (id: string | null | undefined) => pick(id ? org.roles.find((r) => r.id === id) : undefined),
      locale,
    };
  }, [org, locale]);
}

// ---- People --------------------------------------------------------------------------------------------------------

function PeopleTab({ me, org, people }: { me: Me; org: OrgAnswer; people: PeopleAnswer }) {
  const t = useTranslations();
  const names = useNames(org);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const rows = people
    .filter(
      (p) =>
        !q ||
        `${p.full_name_en} ${p.nickname_en ?? ''} ${p.emails.map((e) => e.email).join(' ')}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => a.full_name_en.localeCompare(b.full_name_en));
  void me;
  return (
    <section className="flex flex-col gap-4" data-people>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute start-3 size-4 text-muted" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('common.search')}
            className="ps-9 sm:w-72"
          />
        </label>
        <Button variant="primary" onClick={() => setAdding(true)} data-person-add>
          {t('settings.people.add')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-raised">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.name')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.role')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.team')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.emails')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.lastSignIn')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.people.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const avatar = names.avatar(p.id);
              return (
                <tr key={p.id} className="hover:bg-surface" data-person-row={p.id}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/people/${p.id}`}
                      className="flex items-center gap-2.5 hover:underline"
                      data-entity="person"
                    >
                      {avatar ? <Avatar person={avatar} size="sm" /> : null}
                      <span className="flex flex-col leading-tight">
                        <span className="font-medium">{p.full_name_en}</span>
                        {p.job_title_en ? <span className="text-xs text-muted">{p.job_title_en}</span> : null}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{names.role(p.role?.id)}</td>
                  <td className="px-4 py-2.5">{names.team(p.team_id) || names.dept(p.department_id)}</td>
                  <td className="px-4 py-2.5 font-data text-xs">{p.emails.map((e) => e.email).join(', ')}</td>
                  <td className="px-4 py-2.5 font-data text-xs text-muted">
                    {p.last_sign_in_at
                      ? formatDate(new Date(p.last_sign_in_at), names.locale, { dateStyle: 'medium' })
                      : t('settings.people.never')}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.left_on ? (
                      <StatusChip tone="neutral">{t('settings.people.left')}</StatusChip>
                    ) : p.can_sign_in ? (
                      <StatusChip tone="success">{t('settings.people.signInOn')}</StatusChip>
                    ) : (
                      <StatusChip tone="warning">{t('settings.people.signInOff')}</StatusChip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AddPersonDialog open={adding} onOpenChange={setAdding} org={org} onDone={(id) => router.push(`/people/${id}`)} />
    </section>
  );
}

function AddPersonDialog({
  open,
  onOpenChange,
  org,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: OrgAnswer;
  onDone: (id: string) => void;
}) {
  const t = useTranslations();
  const names = useNames(org);
  const words = useWords('');
  const [f, setF] = useState({
    full_name_en: '',
    job_title_en: '',
    department_id: org.departments[0]?.id ?? '',
    team_id: '',
    manager_id: '',
    role_id: org.roles.find((r) => r.key === 'member')?.id ?? '',
    email: '',
    can_sign_in: true,
  });
  const [busy, setBusy] = useState(false);
  const teams = org.teams.filter((x) => x.active && x.department_id === f.department_id);
  const ok =
    f.full_name_en.trim().length > 0 && !!f.department_id && (!f.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email));
  const save = async () => {
    setBusy(true);
    const created = await run(
      { ...words, done: t('settings.people.added', { name: f.full_name_en.trim() }) },
      async () => {
        const r = (await rpc('person_create', {
          p_person: {
            full_name_en: f.full_name_en.trim(),
            job_title_en: f.job_title_en.trim() || null,
            department_id: f.department_id,
            team_id: f.team_id || null,
            manager_id: f.manager_id || null,
            role_id: f.role_id || null,
            can_sign_in: f.can_sign_in,
          } as never,
        })) as { id: string; request_id?: string | null };
        if (f.email.trim()) {
          const res = await fetch('/auth/admin/emails', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ person_id: r.id, email: f.email.trim().toLowerCase(), primary: true }),
          });
          const body = (await res.json()) as { ok: boolean; error?: { key: string } };
          if (!body.ok) throw new Error(body.error?.key ?? 'common.unavailable');
        }
        return r;
      },
    );
    setBusy(false);
    if (created) {
      onOpenChange(false);
      onDone(created.id);
    }
  };
  const field = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.people.add')}
      dirty={f.full_name_en !== '' || f.email !== ''}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-person-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profile.fullNameEn')} className="sm:col-span-2">
          {(p) => (
            <Input {...p} value={f.full_name_en} onChange={(e) => field('full_name_en')(e.target.value)} autoFocus />
          )}
        </Field>
        <Field label={t('settings.people.jobTitleEn')} className="sm:col-span-2">
          {(p) => <Input {...p} value={f.job_title_en} onChange={(e) => field('job_title_en')(e.target.value)} />}
        </Field>
        <Field label={t('settings.people.department')}>
          {(p) => (
            <Select
              {...p}
              value={f.department_id}
              onValueChange={(v) => setF((s) => ({ ...s, department_id: v, team_id: '' }))}
              options={org.departments.filter((d) => d.active).map((d) => ({ value: d.id, label: names.pick(d) }))}
            />
          )}
        </Field>
        <Field label={t('settings.people.team')}>
          {(p) => (
            <Select
              {...p}
              value={f.team_id}
              onValueChange={field('team_id')}
              placeholder={t('settings.people.noTeam')}
              options={teams.map((x) => ({ value: x.id, label: names.pick(x) }))}
            />
          )}
        </Field>
        <Field label={t('settings.people.manager')}>
          {(p) => (
            <Select
              {...p}
              value={f.manager_id}
              onValueChange={field('manager_id')}
              placeholder={t('settings.people.noManager')}
              options={org.people.map((x) => ({ value: x.id, label: nameOf(x, names.locale) }))}
            />
          )}
        </Field>
        <Field label={t('settings.people.role')}>
          {(p) => (
            <Select
              {...p}
              value={f.role_id}
              onValueChange={field('role_id')}
              options={org.roles.map((r) => ({ value: r.id, label: names.pick(r) }))}
            />
          )}
        </Field>
        <Field label={t('settings.people.email')} className="sm:col-span-2">
          {(p) => (
            <Input
              {...p}
              type="email"
              value={f.email}
              onChange={(e) => field('email')(e.target.value)}
              className="font-data"
            />
          )}
        </Field>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <Switch
            checked={f.can_sign_in}
            onCheckedChange={(v) => setF((s) => ({ ...s, can_sign_in: v }))}
            label={t('settings.people.allowSignIn')}
          />
          {t('settings.people.allowSignIn')}
        </label>
      </div>
    </Dialog>
  );
}

// ---- Teams and departments -----------------------------------------------------------------------------------------

function TeamsTab({ org }: { org: OrgAnswer }) {
  const t = useTranslations();
  const names = useNames(org);
  const router = useRouter();
  const words = useWords(t('settings.teams.saved'));
  const [editing, setEditing] = useState<OrgTeam | 'new' | null>(null);
  const [retiring, setRetiring] = useState<OrgTeam | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [dept, setDept] = useState<OrgAnswer['departments'][number] | 'new' | null>(null);
  const members = (teamId: string) => org.people.filter((p) => p.team_id === teamId).length;
  const [f, setF] = useState({ code: '', name_en: '', name_ar: '', department_id: '', lead_person_id: '' });
  const [d, setD] = useState({ code: '', name_en: '', name_ar: '', head_person_id: '' });
  const [busy, setBusy] = useState(false);
  const openTeam = (x: OrgTeam | 'new') => {
    setF(
      x === 'new'
        ? { code: '', name_en: '', name_ar: '', department_id: org.departments[0]?.id ?? '', lead_person_id: '' }
        : {
            code: x.code,
            name_en: x.name_en,
            name_ar: x.name_ar ?? '',
            department_id: x.department_id,
            lead_person_id: x.lead_person_id ?? '',
          },
    );
    setEditing(x);
  };
  const saveTeam = async () => {
    if (!editing) return;
    setBusy(true);
    await run(
      words,
      () =>
        rpc('team_save', {
          p_id: (editing === 'new' ? null : editing.id) as unknown as string,
          p_department: f.department_id,
          p_code: f.code.trim(),
          p_name_en: f.name_en.trim(),
          p_name_ar: f.name_ar.trim(),
          p_lead: f.lead_person_id || undefined,
          p_version: editing === 'new' ? undefined : editing.version,
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setEditing(null);
        router.refresh();
      },
    );
    setBusy(false);
  };
  const openDept = (x: OrgAnswer['departments'][number] | 'new') => {
    setD(
      x === 'new'
        ? { code: '', name_en: '', name_ar: '', head_person_id: '' }
        : { code: x.code, name_en: x.name_en, name_ar: x.name_ar ?? '', head_person_id: x.head_person_id ?? '' },
    );
    setDept(x);
  };
  const saveDept = async () => {
    if (!dept) return;
    setBusy(true);
    await run(
      { ...words, done: t('settings.departments.saved') },
      () =>
        rpc('department_save', {
          p_id: (dept === 'new' ? null : dept.id) as unknown as string,
          p_code: d.code.trim(),
          p_name_en: d.name_en.trim(),
          p_name_ar: d.name_ar.trim(),
          p_head: d.head_person_id || undefined,
          p_version: dept === 'new' ? undefined : dept.version,
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setDept(null);
        router.refresh();
      },
    );
    setBusy(false);
  };
  const retire = async (reason: string) => {
    if (!retiring) return;
    const target = retiring;
    await run(
      { ...words, done: t('settings.teams.retired', { name: names.pick(target) }) },
      () =>
        rpc('team_retire', {
          p_id: target.id,
          p_move_to: (moveTo || null) as unknown as string,
          p_reason: reason,
        } as never) as Promise<{ request_id?: string | null } | null>,
      () => {
        setRetiring(null);
        router.refresh();
      },
    );
  };
  const teamForm = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('settings.teams.name')}>
        {(p) => <Input {...p} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} autoFocus />}
      </Field>
      <Field
        label={t('settings.teams.nameAr')}
        error={f.name_en && !f.name_ar.trim() ? t('settings.list.arabicRequired') : undefined}
      >
        {(p) => (
          <Input
            {...p}
            dir="rtl"
            lang="ar"
            value={f.name_ar}
            onChange={(e) => setF({ ...f, name_ar: e.target.value })}
          />
        )}
      </Field>
      <Field label={t('settings.teams.code')}>
        {(p) => (
          <Input {...p} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-data" />
        )}
      </Field>
      <Field label={t('settings.teams.department')}>
        {(p) => (
          <Select
            {...p}
            value={f.department_id}
            onValueChange={(v) => setF({ ...f, department_id: v })}
            options={org.departments.filter((x) => x.active).map((x) => ({ value: x.id, label: names.pick(x) }))}
          />
        )}
      </Field>
      <Field label={t('settings.teams.lead')} className="sm:col-span-2">
        {(p) => (
          <Select
            {...p}
            value={f.lead_person_id}
            onValueChange={(v) => setF({ ...f, lead_person_id: v })}
            placeholder={t('settings.teams.noLead')}
            options={org.people.map((x) => ({ value: x.id, label: nameOf(x, names.locale) }))}
          />
        )}
      </Field>
    </div>
  );
  return (
    <div className="flex flex-col gap-8" data-teams>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{t('settings.tabs.teams')}</h3>
          <Button size="sm" variant="primary" onClick={() => openTeam('new')} data-team-add>
            {t('settings.teams.add')}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-raised">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.name')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.code')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.department')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.lead')}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t('settings.teams.members')}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...org.teams]
                .sort((a, b) => Number(!a.active) - Number(!b.active) || a.name_en.localeCompare(b.name_en))
                .map((x) => (
                  <tr key={x.id} data-team-row={x.code}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium">
                        {names.pick(x)}
                        {!x.active ? <StatusChip tone="neutral">{t('settings.teams.retiredChip')}</StatusChip> : null}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-data text-muted">{x.code}</td>
                    <td className="px-4 py-2.5">{names.dept(x.department_id)}</td>
                    <td className="px-4 py-2.5">{names.person(x.lead_person_id) || t('settings.teams.noLead')}</td>
                    <td className="px-4 py-2.5 text-end font-data">{members(x.id)}</td>
                    <td className="px-4 py-2.5 text-end">
                      {x.active ? (
                        <span className="inline-flex gap-1">
                          <Button size="xs" variant="ghost" onClick={() => openTeam(x)}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setMoveTo('');
                              setRetiring(x);
                            }}
                            data-team-retire
                          >
                            {t('settings.teams.retire')}
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{t('settings.people.department')}</h3>
          <Button size="sm" onClick={() => openDept('new')}>
            {t('settings.departments.add')}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-raised">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.name')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.teams.code')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('settings.departments.head')}</th>
                <th className="px-4 py-2.5 text-end font-medium">
                  {t('settings.people.people', { count: 0 }).replace(/^0\s*/, '')}
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.departments.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-2.5 font-medium">{names.pick(x)}</td>
                  <td className="px-4 py-2.5 font-data text-muted">{x.code}</td>
                  <td className="px-4 py-2.5">{names.person(x.head_person_id) || t('settings.departments.noHead')}</td>
                  <td className="px-4 py-2.5 text-end font-data">
                    {org.people.filter((p) => p.department_id === x.id).length}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <Button size="xs" variant="ghost" onClick={() => openDept(x)}>
                      {t('common.edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing === 'new' || editing === null
            ? t('settings.teams.add')
            : t('settings.teams.edit', { name: names.pick(editing) })
        }
        dirty={f.name_en !== ''}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!f.name_en.trim() || !f.name_ar.trim() || !f.code.trim() || !f.department_id}
              loading={busy}
              onClick={() => void saveTeam()}
              data-team-save
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {teamForm}
      </Dialog>
      <Dialog
        open={dept !== null}
        onOpenChange={(o) => !o && setDept(null)}
        title={
          dept === 'new' || dept === null
            ? t('settings.departments.add')
            : t('settings.departments.edit', { name: names.pick(dept) })
        }
        dirty={d.name_en !== ''}
        footer={
          <>
            <Button onClick={() => setDept(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!d.name_en.trim() || !d.name_ar.trim() || !d.code.trim()}
              loading={busy}
              onClick={() => void saveDept()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.teams.name')}>
            {(p) => (
              <Input {...p} value={d.name_en} onChange={(e) => setD({ ...d, name_en: e.target.value })} autoFocus />
            )}
          </Field>
          <Field
            label={t('settings.teams.nameAr')}
            error={d.name_en && !d.name_ar.trim() ? t('settings.list.arabicRequired') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                dir="rtl"
                lang="ar"
                value={d.name_ar}
                onChange={(e) => setD({ ...d, name_ar: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('settings.teams.code')}>
            {(p) => (
              <Input
                {...p}
                value={d.code}
                onChange={(e) => setD({ ...d, code: e.target.value })}
                className="font-data"
              />
            )}
          </Field>
          <Field label={t('settings.departments.head')}>
            {(p) => (
              <Select
                {...p}
                value={d.head_person_id}
                onValueChange={(v) => setD({ ...d, head_person_id: v })}
                placeholder={t('settings.departments.noHead')}
                options={org.people.map((x) => ({ value: x.id, label: nameOf(x, names.locale) }))}
              />
            )}
          </Field>
        </div>
      </Dialog>
      <ReasonDialog
        open={retiring !== null}
        onOpenChange={(o) => !o && setRetiring(null)}
        title={retiring ? t('settings.teams.retireTitle', { name: names.pick(retiring) }) : ''}
        body={
          retiring
            ? t('settings.teams.retireBody', { count: members(retiring.id), name: names.pick(retiring) })
            : undefined
        }
        onSave={retire}
        destructive
        words={{
          reason: t('common.reason'),
          save: t('settings.teams.retire'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      >
        {retiring ? (
          <Field label={t('settings.teams.moveTo')}>
            {(p) => (
              <Select
                {...p}
                value={moveTo}
                onValueChange={setMoveTo}
                placeholder={t('settings.teams.noTeam')}
                options={org.teams
                  .filter((x) => x.active && x.id !== retiring.id && x.department_id === retiring.department_id)
                  .map((x) => ({ value: x.id, label: names.pick(x) }))}
              />
            )}
          </Field>
        ) : null}
      </ReasonDialog>
    </div>
  );
}

// ---- Roles ---------------------------------------------------------------------------------------------------------

function RolesTab({ org, people }: { org: OrgAnswer; people: PeopleAnswer }) {
  const t = useTranslations();
  const names = useNames(org);
  const router = useRouter();
  const words = useWords(t('settings.roles.saved'));
  const [editing, setEditing] = useState<OrgRole | 'new' | null>(null);
  const [f, setF] = useState({ key: '', name_en: '', name_ar: '', sort: '' });
  const [busy, setBusy] = useState(false);
  const open = (r: OrgRole | 'new') => {
    setF(
      r === 'new'
        ? { key: '', name_en: '', name_ar: '', sort: String((org.roles.at(-1)?.sort ?? 50) + 10) }
        : { key: r.key, name_en: r.name_en, name_ar: r.name_ar ?? '', sort: String(r.sort) },
    );
    setEditing(r);
  };
  const save = async () => {
    if (!editing) return;
    setBusy(true);
    await run(
      words,
      () =>
        rpc('role_save', {
          p_id: (editing === 'new' ? null : editing.id) as unknown as string,
          p_key: f.key.trim(),
          p_name_en: f.name_en.trim(),
          p_name_ar: f.name_ar.trim() || undefined,
          p_sort: f.sort === '' ? undefined : Number(f.sort),
          p_version: editing === 'new' ? undefined : editing.version,
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setEditing(null);
        router.refresh();
      },
    );
    setBusy(false);
  };
  return (
    <section className="flex flex-col gap-3" data-roles>
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => open('new')}>
          {t('common.add')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-raised">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.roles.name')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.roles.nameAr')}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t('settings.roles.key')}</th>
              <th className="px-4 py-2.5 text-end font-medium">{t('settings.roles.people')}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...org.roles]
              .sort((a, b) => a.sort - b.sort)
              .map((r) => (
                <tr key={r.id} data-role-row={r.key}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium">
                      {r.name_en}
                      {r.is_admin ? <StatusChip tone="info">{t('settings.roles.admin')}</StatusChip> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" dir="rtl">
                    {r.name_ar}
                  </td>
                  <td className="px-4 py-2.5 font-data text-muted">{r.key}</td>
                  <td className="px-4 py-2.5 text-end font-data">
                    {people.filter((p) => p.role?.id === r.id && p.active).length}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => open(r)}
                      aria-label={t('settings.roles.edit', { name: names.pick(r) })}
                    >
                      {t('common.edit')}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing === 'new' || editing === null
            ? t('common.add')
            : t('settings.roles.edit', { name: names.pick(editing) })
        }
        dirty={f.name_en !== ''}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!f.name_en.trim() || !f.name_ar.trim() || !f.key.trim()}
              loading={busy}
              onClick={() => void save()}
              data-role-save
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.roles.name')}>
            {(p) => (
              <Input {...p} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} autoFocus />
            )}
          </Field>
          <Field
            label={t('settings.roles.nameAr')}
            error={f.name_en && !f.name_ar.trim() ? t('settings.list.arabicRequired') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                dir="rtl"
                lang="ar"
                value={f.name_ar}
                onChange={(e) => setF({ ...f, name_ar: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('settings.roles.key')}>
            {(p) => (
              <Input
                {...p}
                value={f.key}
                disabled={editing !== 'new'}
                onChange={(e) => setF({ ...f, key: e.target.value })}
                className="font-data"
              />
            )}
          </Field>
          <Field label={t('settings.list.sort')}>
            {(p) => (
              <Input
                {...p}
                type="number"
                value={f.sort}
                onChange={(e) => setF({ ...f, sort: e.target.value })}
                className="font-data"
              />
            )}
          </Field>
        </div>
      </Dialog>
    </section>
  );
}

// ---- Access matrix -------------------------------------------------------------------------------------------------

function AccessTab({ matrix }: { matrix: MatrixAnswer }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useWords(t('settings.access.changed'));
  const labels = useMemo(() => pageLabels(), []);
  const caps = useMemo(() => capLabels(), []);
  const roles = [...matrix.roles].sort((a, b) => a.sort - b.sort);
  const pages = [...matrix.pages]
    .filter((p) => p.nav_group === 'main' || p.nav_group === 'settings' || p.key === 'settings.profile')
    .sort((a, b) =>
      a.nav_group === b.nav_group ? (a.nav_order ?? 0) - (b.nav_order ?? 0) : a.nav_group === 'main' ? -1 : 1,
    );
  const levelOf = (roleId: string, page: string) =>
    matrix.role_levels.find((x) => x.role_id === roleId && x.page === page)?.level ?? 'none';
  const capOf = (roleId: string, cap: string) =>
    matrix.role_capabilities.find((x) => x.role_id === roleId && x.capability === cap)?.granted ?? false;
  const [pending, setPending] = useState<
    | { kind: 'level'; role: OrgRole; page: string; level: Level }
    | { kind: 'cap'; role: OrgRole; cap: string; granted: boolean }
    | null
  >(null);
  const roleName = (r: OrgRole) => (locale === 'ar' && r.name_ar ? r.name_ar : r.name_en);
  const apply = async (reason: string) => {
    if (!pending) return;
    const p = pending;
    await run(
      words,
      () =>
        (p.kind === 'level'
          ? rpc('access_set_role_level', { p_role: p.role.id, p_page: p.page, p_level: p.level, p_reason: reason })
          : rpc('access_set_role_capability', {
              p_role: p.role.id,
              p_capability: p.cap,
              p_granted: p.granted,
              p_reason: reason,
            })) as Promise<{
          request_id?: string | null;
        } | null>,
      () => {
        setPending(null);
        router.refresh();
      },
    );
  };
  const pageWord = (key: string) => (labels[key] && t.has(labels[key]!) ? t(labels[key]!) : key);
  const capWord = (key: string) => (caps[key] && t.has(caps[key]!) ? t(caps[key]!) : key);
  return (
    <section className="overflow-x-auto rounded-lg border border-border bg-raised" data-access-matrix>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">{t('settings.access.page')}</th>
            {roles.map((r) => (
              <th key={r.id} className="px-3 py-2.5 text-start font-medium">
                {roleName(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pages.map((p) => (
            <RowGroup key={p.key}>
              <tr data-access-page={p.key}>
                <th scope="row" className="px-4 py-2 text-start font-medium">
                  {pageWord(p.key)}
                </th>
                {roles.map((r) => {
                  const top = p.levels[p.levels.length - 1] ?? 'full';
                  const value = r.is_admin ? top : levelOf(r.id, p.key);
                  return (
                    <td key={r.id} className="px-3 py-1.5" data-access-role={r.key}>
                      <Select
                        value={value}
                        disabled={r.is_admin}
                        onValueChange={(v) => setPending({ kind: 'level', role: r, page: p.key, level: v as Level })}
                        options={LEVELS.filter((l) => p.levels.includes(l)).map((l) => ({
                          value: l,
                          label: t(`levels.${l}`),
                        }))}
                        className="h-8 min-w-24 text-sm"
                      />
                    </td>
                  );
                })}
              </tr>
              {matrix.capabilities
                .filter((c) => c.page === p.key)
                .map((c) => (
                  <tr key={c.key} className="bg-surface/60" data-access-capability={c.key}>
                    <th scope="row" className="px-4 py-1.5 ps-8 text-start text-xs font-normal text-muted">
                      {capWord(c.key)}
                    </th>
                    {roles.map((r) => (
                      <td key={r.id} className="px-3 py-1.5">
                        <Checkbox
                          checked={r.is_admin ? true : capOf(r.id, c.key)}
                          disabled={r.is_admin}
                          onCheckedChange={(v) => setPending({ kind: 'cap', role: r, cap: c.key, granted: v })}
                          label={`${roleName(r)} · ${c.key}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
            </RowGroup>
          ))}
        </tbody>
      </table>
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          pending
            ? t('settings.access.changeTitle', {
                what:
                  pending.kind === 'level'
                    ? `${pageWord(pending.page)} · ${t(`levels.${pending.level}`)}`
                    : `${capWord(pending.cap)} · ${pending.granted ? t('common.yes') : t('common.no')}`,
                who: roleName(pending.role),
              })
            : ''
        }
        body={t('settings.access.reasonBody')}
        onSave={apply}
        words={{
          reason: t('common.reason'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
    </section>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
