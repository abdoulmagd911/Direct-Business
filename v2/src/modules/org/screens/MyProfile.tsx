'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { run } from '@/core/commands/run';
import type { Me } from '@/core/auth/me';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { DENSITIES, PREF_DEFS, THEMES, readPrefs, setPref } from '@/core/prefs';
import { NOTIFICATION_KINDS } from '@/modules/settings/module';
import { Avatar, type AvatarColor } from '@/ui/Avatar';
import { BADGE_ICONS, ZODIAC } from '@/ui/badges';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { personOf } from '@/ui/person';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { PageFrame } from '@/ui/shell/AppShell';
import { navFor } from '@/ui/shell/nav';

export type Device = {
  id: string;
  device_label: string | null;
  signed_in_at: string;
  last_seen_at: string;
  this_device: boolean;
};

type Profile = NonNullable<Me['profile']>;
type Changes = Partial<
  Pick<
    Profile,
    | 'display_name_en'
    | 'display_name_ar'
    | 'avatar_color'
    | 'badge_kind'
    | 'badge_value'
    | 'theme'
    | 'density'
    | 'locale'
    | 'start_page'
    | 'drawer_pinned'
  > & { full_name_en: string; full_name_ar: string | null; nickname_en: string | null; nickname_ar: string | null }
> & { notify?: Record<string, { in_app: boolean }> };

const COLOURS: AvatarColor[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

/**
 * My profile (V9, V97; artboard 7): everyone's own page, from the profile chip. Profile (initials in a colour, names,
 * badge), Appearance (theme, density, language once Arabic is on, start page, drawer), Notifications (in-app kinds —
 * V45) and Devices (V74: each signed-in device with its own sign-out). Every change saves at once through
 * api.profile_update with Undo; theme, density, language and the drawer also take effect on this screen at once
 * (the cookies are the profile's cache — V201).
 */

function stateOf(me: Me) {
  return {
    person: me.person,
    profile: me.profile,
    personVersion: (me.person as { version?: number }).version ?? null,
  };
}

export function MyProfile({
  me,
  devices,
  arabicEnabled = false,
}: {
  me: Me;
  devices: Device[];
  arabicEnabled?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  /**
   * The screen shows the stored profile: its state is rebuilt from `me` every time the server answers again (a refresh,
   * an Undo — `run` refreshes after both), so an undone value never lingers on screen; and the theme, density and
   * language cookies are that profile's cache (core/prefs), so they follow it too — an undone theme reverts at once.
   */
  const [state, setState] = useState(() => stateOf(me));
  const [seenMe, setSeenMe] = useState(me);
  if (me !== seenMe) {
    setSeenMe(me);
    setState(stateOf(me));
  }
  useEffect(() => {
    const before = readPrefs();
    setPref('theme', me.profile?.theme ?? PREF_DEFS.theme.default);
    setPref('density', me.profile?.density ?? PREF_DEFS.density.default);
    setPref('locale', me.profile?.locale ?? PREF_DEFS.locale.default);
    if (me.profile?.drawer_pinned !== null && me.profile?.drawer_pinned !== undefined)
      setPref('drawer', me.profile.drawer_pinned ? 'pinned' : 'collapsed');
    // the words on screen come from the server in the cookie's language: a reverted language needs one more answer
    if (readPrefs().locale !== before.locale) router.refresh();
  }, [me, router]);
  const [deviceRows, setDeviceRows] = useState(devices);
  const person = personOf({ ...me, person: state.person, profile: state.profile });
  const words = {
    done: t('profile.saved'),
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  };

  const save = async (changes: Changes) => {
    await run(
      words,
      async () => {
        const r = (await rpc('profile_update', {
          p_changes: changes as never,
          p_version: state.profile?.version ?? undefined,
          p_person_version: state.personVersion ?? undefined,
        })) as { version?: number; person_version?: number; request_id?: string } | null;
        setState((s) => {
          const { full_name_en, full_name_ar, nickname_en, nickname_ar, notify, ...profileChanges } = changes;
          const nextPerson = {
            ...s.person,
            ...(full_name_en !== undefined ? { full_name_en } : {}),
            ...(full_name_ar !== undefined ? { full_name_ar } : {}),
            ...(nickname_en !== undefined ? { nickname_en } : {}),
            ...(nickname_ar !== undefined ? { nickname_ar } : {}),
          };
          const base: Profile = s.profile ?? {
            display_name_en: null,
            display_name_ar: null,
            avatar_file_id: null,
            avatar_color: null,
            badge_kind: 'none',
            badge_value: null,
            theme: null,
            density: null,
            locale: null,
            start_page: null,
            drawer_pinned: null,
            notify: null,
            version: 0,
          };
          const nextProfile: Profile = {
            ...base,
            ...profileChanges,
            ...(notify ? { notify: { ...((base.notify as object | null) ?? {}), ...notify } } : {}),
            version: r?.version ?? base.version,
          };
          return { person: nextPerson, profile: nextProfile, personVersion: r?.person_version ?? s.personVersion };
        });
        if (changes.theme) setPref('theme', changes.theme);
        if (changes.density) setPref('density', changes.density);
        if (changes.locale) setPref('locale', changes.locale);
        if (changes.drawer_pinned !== undefined) setPref('drawer', changes.drawer_pinned ? 'pinned' : 'collapsed');
        return r;
      },
      () => router.refresh(),
    );
  };

  const signOutDevice = async (d: Device) => {
    await run(
      { ...words, done: t('profile.devices.signedOut') },
      async () => {
        await rpc('device_sign_out', { p_device: d.id });
        return null;
      },
      () => {
        if (d.this_device) router.push('/sign-in');
        else setDeviceRows((rows) => rows.filter((x) => x.id !== d.id));
      },
    );
  };
  const signOutOthers = async () => {
    const others = deviceRows.filter((d) => !d.this_device).length;
    await run(
      { ...words, done: t('profile.devices.othersSignedOut', { count: others }) },
      async () => {
        await rpc('device_sign_out_others', {} as never);
        return null;
      },
      () => setDeviceRows((rows) => rows.filter((d) => d.this_device)),
    );
  };

  const notify = (state.profile?.notify as Record<string, { in_app?: boolean }> | null) ?? {};
  const startPages = navFor(me).map((e) => ({ value: e.page, label: t(e.label) }));
  const theme = state.profile?.theme ?? 'direct';
  const density = state.profile?.density ?? 'comfortable';
  const badgeKind = state.profile?.badge_kind ?? 'none';

  return (
    <PageFrame className="[&>*]:!max-w-[720px]">
      <PageHeader title={t('profile.title')} />

      <Section title={t('profile.sections.profile')}>
        <div className="flex items-center gap-5">
          <Avatar person={person} size="2xl" />
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted">{t('profile.colour')}</span>
            <div className="flex gap-2" role="radiogroup" aria-label={t('profile.colour')}>
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={person.avatarColor === c}
                  aria-label={t(`profile.colours.${c}`)}
                  onClick={() => void save({ avatar_color: c })}
                  className={cn(
                    'size-8 rounded-pill focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
                    person.avatarColor === c && 'ring-2 ring-text ring-offset-2 ring-offset-raised',
                  )}
                  style={{ background: `var(--${c})` }}
                  data-colour={c}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('profile.fullNameEn')}
            value={state.person.full_name_en}
            onSave={(v) => save({ full_name_en: v })}
            required
          />
          <TextField
            label={t('profile.nicknameEn')}
            value={state.person.nickname_en ?? ''}
            onSave={(v) => save({ nickname_en: v || null })}
          />
          <TextField
            label={t('profile.displayNameEn')}
            value={state.profile?.display_name_en ?? ''}
            onSave={(v) => save({ display_name_en: v || null })}
          />
          {arabicEnabled ? (
            <>
              <TextField
                label={t('profile.fullNameAr')}
                value={state.person.full_name_ar ?? ''}
                onSave={(v) => save({ full_name_ar: v || null })}
                dir="rtl"
              />
              <TextField
                label={t('profile.nicknameAr')}
                value={state.person.nickname_ar ?? ''}
                onSave={(v) => save({ nickname_ar: v || null })}
                dir="rtl"
              />
              <TextField
                label={t('profile.displayNameAr')}
                value={state.profile?.display_name_ar ?? ''}
                onSave={(v) => save({ display_name_ar: v || null })}
                dir="rtl"
              />
            </>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('profile.badge')}>
            {(p) => (
              <Select
                {...p}
                value={badgeKind}
                onValueChange={(v) =>
                  void save({
                    badge_kind: v as Profile['badge_kind'],
                    badge_value:
                      v === 'none' ? null : v === 'icon' ? Object.keys(BADGE_ICONS)[0]! : Object.keys(ZODIAC)[0]!,
                  })
                }
                options={(['none', 'icon', 'zodiac'] as const).map((k) => ({
                  value: k,
                  label: t(`profile.badgeKind.${k}`),
                }))}
              />
            )}
          </Field>
          {badgeKind !== 'none' ? (
            <Field label={t('profile.badgeValue')}>
              {(p) => (
                <Select
                  {...p}
                  value={state.profile?.badge_value ?? ''}
                  onValueChange={(v) => void save({ badge_value: v })}
                  options={Object.keys(badgeKind === 'icon' ? BADGE_ICONS : ZODIAC).map((k) => ({
                    value: k,
                    label: badgeKind === 'zodiac' ? `${ZODIAC[k]} ${k}` : k,
                  }))}
                />
              )}
            </Field>
          ) : null}
        </div>
      </Section>

      <Section title={t('profile.sections.appearance')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('profile.theme')}>
            {(p) => (
              <Select
                {...p}
                value={theme}
                onValueChange={(v) => void save({ theme: v as Profile['theme'] })}
                options={THEMES.map((th) => ({ value: th, label: t(`theme.${th}`) }))}
              />
            )}
          </Field>
          <Field label={t('profile.density')}>
            {(p) => (
              <Select
                {...p}
                value={density}
                onValueChange={(v) => void save({ density: v as Profile['density'] })}
                options={DENSITIES.map((d) => ({ value: d, label: t(`density.${d}`) }))}
              />
            )}
          </Field>
          {arabicEnabled ? (
            <Field label={t('profile.language')}>
              {(p) => (
                <Select
                  {...p}
                  value={state.profile?.locale ?? locale}
                  onValueChange={(v) => void save({ locale: v as Profile['locale'] })}
                  options={[
                    { value: 'en', label: t('locale.en') },
                    { value: 'ar', label: t('locale.ar') },
                  ]}
                />
              )}
            </Field>
          ) : null}
          <Field label={t('profile.startPage')}>
            {(p) => (
              <Select
                {...p}
                value={state.profile?.start_page ?? 'my_day'}
                onValueChange={(v) => void save({ start_page: v })}
                options={startPages}
              />
            )}
          </Field>
          <Field label={t('profile.drawer')}>
            {(p) => (
              <Select
                {...p}
                value={state.profile?.drawer_pinned === false ? 'collapsed' : 'pinned'}
                onValueChange={(v) => void save({ drawer_pinned: v === 'pinned' })}
                options={[
                  { value: 'pinned', label: t('profile.drawerPinned') },
                  { value: 'collapsed', label: t('profile.drawerCollapsed') },
                ]}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title={t('profile.sections.notifications')}>
        <ul className="divide-y divide-border">
          {NOTIFICATION_KINDS.map((kind) => (
            <li key={kind} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-base">{t(`profile.notify.${kind}`)}</span>
              <Switch
                checked={notify[kind]?.in_app !== false}
                onCheckedChange={(v) => void save({ notify: { [kind]: { in_app: v } } })}
                label={t(`profile.notify.${kind}`)}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={t('profile.sections.devices')}
        actions={
          deviceRows.some((d) => !d.this_device) ? (
            <Button size="sm" onClick={() => void signOutOthers()} data-sign-out-others>
              {t('profile.devices.signOutOthers')}
            </Button>
          ) : null
        }
      >
        <table className="w-full text-sm">
          <thead className="text-start text-xs text-muted">
            <tr>
              <th className="py-2 text-start font-medium">{t('profile.devices.label')}</th>
              <th className="py-2 text-start font-medium">{t('profile.devices.signedIn')}</th>
              <th className="py-2 text-start font-medium">{t('profile.devices.lastSeen')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deviceRows.map((d) => (
              <tr key={d.id} data-device data-this-device={d.this_device || undefined}>
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    {d.device_label ?? t('profile.devices.unknown')}
                    {d.this_device ? <StatusChip tone="info">{t('profile.devices.thisDevice')}</StatusChip> : null}
                  </span>
                </td>
                <td className="py-2.5 font-data text-muted">
                  {formatDate(new Date(d.signed_in_at), locale, { dateStyle: 'medium' })}
                </td>
                <td className="py-2.5 font-data text-muted">
                  {formatDate(new Date(d.last_seen_at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="py-2.5 text-end">
                  <Button size="xs" variant="ghost" onClick={() => void signOutDevice(d)} data-device-sign-out>
                    {t('profile.devices.signOut')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </PageFrame>
  );
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-raised p-5 sm:p-6" data-profile-section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A text field that saves on blur or Enter when its value changed (the profile saves at once — spec §6). */
function TextField({
  label,
  value,
  onSave,
  required = false,
  dir,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void | Promise<void>;
  required?: boolean;
  dir?: 'rtl' | 'ltr';
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const v = draft.trim();
    if (v === value) return;
    if (required && !v) {
      setDraft(value);
      return;
    }
    void onSave(v);
  };
  return (
    <Field label={label} error={required && !draft.trim() ? t('common.required') : undefined}>
      {(p) => (
        <Input
          {...p}
          dir={dir}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </Field>
  );
}
