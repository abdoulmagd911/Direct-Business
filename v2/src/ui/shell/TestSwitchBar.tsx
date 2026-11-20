'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { useMaybeMe } from '@/core/auth/me-context';
import type { Me } from '@/core/auth/me';
import { rpc } from '@/core/db/rpc';
import { switchTargets } from '@/core/test-switch/offer';
import { useTestSwitch } from '@/core/test-switch/use-test-switch';
import { Button } from '../Button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';

/** "TEST user: [name] (you are [owner name])" in the language of the screen. The test user's name is always the English
 * name: a test account is named in English, and its stored Arabic name is a translation of that proper name, never
 * used (F212/U2). The owner's name is a real person's name, so it follows the screen's language. */
export function testSwitchNames(me: Me, locale: 'en' | 'ar') {
  const by = me.test_switch;
  const ar = locale === 'ar';
  return {
    name: me.person.full_name_en,
    owner: by ? (ar && by.by_name_ar) || by.by_name_en : '',
  };
}

/** The bar itself, drawn from words and one press: kept apart so a test can look at it without the session. */
export function TestSwitchBarView({
  line,
  back,
  onBack,
  busy,
  others,
}: {
  line: string;
  back: string;
  onBack: () => void;
  busy?: boolean;
  /** The way straight to another TEST user (Landing 34, item 29), drawn before Back to my account. */
  others?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-warning-soft px-4 py-2 text-sm font-medium text-warning"
      data-test-switch-bar
    >
      <span className="min-w-0 [overflow-wrap:break-word]" data-test-switch-line>
        {line}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {others}
        <Button onClick={onBack} disabled={busy} data-test-switch-back>
          {back}
        </Button>
      </span>
    </div>
  );
}

type TestPerson = { id: string; is_test?: boolean; full_name_en: string };

/** The menu's rows, from what the read gave: kept apart so a test can look at them without the session. */
export function SwitchOverRows({
  state,
  words,
  onPick,
  onRetry,
}: {
  /** null while the list is read, 'failed' when it could not be, else the TEST users one can go to. */
  state: readonly TestPerson[] | 'failed' | null;
  words: { loading: string; failed: string; none: string };
  onPick: (id: string) => void;
  onRetry: () => void;
}) {
  if (state === null) return <MenuItem disabled>{words.loading}</MenuItem>;
  if (state === 'failed')
    return (
      // the menu stays open on Try again: the answer shows in it
      <MenuItem
        onSelect={(e) => {
          e.preventDefault();
          onRetry();
        }}
        data-test-switch-retry
      >
        {words.failed}
      </MenuItem>
    );
  if (!state.length) return <MenuItem disabled>{words.none}</MenuItem>;
  return (
    <>
      {state.map((p) => (
        // a test account is named in English (see testSwitchNames)
        <MenuItem key={p.id} onSelect={() => onPick(p.id)} data-test-switch-to={p.id}>
          {p.full_name_en}
        </MenuItem>
      ))}
    </>
  );
}

/**
 * "Switch test user" on the bar (Landing 34, item 29): the TEST users by name, read when the menu opens (api.org —
 * the structure everyone may read, which marks who is TEST); a press goes straight to that one. It is on the bar, so
 * it is there for whoever the device is signed in as — a test Member cannot open the People page at all.
 */
function SwitchOverMenu({ me, busy, onPick }: { me: Me; busy: boolean; onPick: (id: string) => void }) {
  const t = useTranslations();
  const [state, setState] = useState<readonly TestPerson[] | 'failed' | null>(null);
  const load = () => {
    setState(null);
    rpc('org', {} as never, { retry: true }).then(
      (a) => setState(switchTargets(me, (a as unknown as { people?: TestPerson[] } | null)?.people ?? [])),
      () => setState('failed'),
    );
  };
  return (
    <Menu
      onOpenChange={(open) => {
        if (open && !Array.isArray(state)) load();
      }}
    >
      <MenuTrigger asChild>
        <Button disabled={busy} data-test-switch-menu>
          {t('testSwitch.over')}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" data-test-switch-list>
        <SwitchOverRows
          state={state}
          words={{ loading: t('common.loading'), failed: t('testSwitch.listFailed'), none: t('testSwitch.none') }}
          onPick={onPick}
          onRetry={load}
        />
      </MenuContent>
    </Menu>
  );
}

/**
 * The bar at the top of every page while this device is switched to a TEST user (V656): api.me() says so in
 * `test_switch`. Back to my account calls api.test_switch_end and starts the app over as the owner.
 */
export function TestSwitchBar() {
  const me = useMaybeMe();
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const sw = useTestSwitch();
  if (!me?.test_switch) return null;
  return (
    <TestSwitchBarView
      line={t('testSwitch.bar', testSwitchNames(me, locale))}
      back={t('testSwitch.back')}
      onBack={() => void sw.end()}
      busy={sw.busy}
      others={<SwitchOverMenu me={me} busy={sw.busy} onPick={(id) => void sw.over(id)} />}
    />
  );
}
