'use client';
import { LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMe } from '@/core/auth/MeProvider';
import { DENSITIES, DIRS, LOCALES, THEMES } from '@/core/prefs';
import { usePrefs } from '@/core/prefs/usePrefs';
import { Avatar } from '../Avatar';
import { cn } from '../cn';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../Menu';

/**
 * The profile chip (avatar, nickname, badge) opens: My profile, the theme switch (four), density,
 * language (Arabic shown only once enabled — V2xx), a direction override in development, sign out.
 */
export function ProfileMenu({ arabicEnabled = false, onSignOut }: { arabicEnabled?: boolean; onSignOut?: () => void }) {
  const t = useTranslations();
  const me = useMe();
  const { prefs, set } = usePrefs();
  const dev = process.env.NODE_ENV !== 'production';
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('top.profile')}
          data-profile-chip
          className="flex h-11 items-center gap-2.5 rounded-pill pe-3 ps-1 text-base font-medium text-current hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Avatar person={me.person} size="sm" ring="nav" />
          <span className="hidden sm:inline">{me.person.displayName}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-64">
        <MenuItem asChild>
          <Link href="/settings/profile">
            <UserRound />
            {t('profileMenu.myProfile')}
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('profileMenu.theme')}</MenuLabel>
        <MenuRadioGroup value={prefs.theme} onValueChange={(v) => set('theme', v as typeof prefs.theme)}>
          {THEMES.map((th) => (
            <MenuRadioItem key={th} value={th} data-theme-option={th}>
              <span className={cn('size-3.5 rounded-full border border-border', themeSwatch[th])} aria-hidden="true" />
              {t(`theme.${th}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>{t('profileMenu.density')}</MenuLabel>
        <MenuRadioGroup value={prefs.density} onValueChange={(v) => set('density', v as typeof prefs.density)}>
          {DENSITIES.map((d) => (
            <MenuRadioItem key={d} value={d} data-density-option={d}>
              {t(`density.${d}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        {arabicEnabled ? (
          <>
            <MenuSeparator />
            <MenuLabel>{t('profileMenu.language')}</MenuLabel>
            <MenuRadioGroup
              value={prefs.locale}
              onValueChange={(v) => {
                set('locale', v as typeof prefs.locale);
                window.location.reload();
              }}
            >
              {LOCALES.map((l) => (
                <MenuRadioItem key={l} value={l} lang={l}>
                  {t(`locale.${l}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </>
        ) : null}
        {dev ? (
          <>
            <MenuSeparator />
            <MenuLabel>{t('profileMenu.direction')}</MenuLabel>
            <MenuRadioGroup value={prefs.dir} onValueChange={(v) => set('dir', v as typeof prefs.dir)}>
              {DIRS.map((d) => (
                <MenuRadioItem key={d} value={d} data-dir-option={d}>
                  {t(`dir.${d}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={onSignOut} data-sign-out>
          {t('profileMenu.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/* Swatches are the themes' own nav colours, read from the tokens at runtime — no hex here. */
const themeSwatch: Record<string, string> = {
  light: 'bg-[color-mix(in_srgb,var(--raised)_100%,transparent)]',
  dark: 'bg-[color-mix(in_srgb,var(--text)_100%,transparent)]',
  colorful: 'bg-info',
  direct: 'bg-accent',
};
