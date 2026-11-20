'use client';
import { LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMe } from '@/core/auth/me-context';
import { THEMES, type Theme } from '@/core/prefs';
import { useLanguageChoice } from '@/core/prefs/use-language-choice';
import { useThemeChoice } from '@/core/prefs/use-theme-choice';
import { useArabicEnabled } from '@/core/settings/app-flags';
import { Avatar } from '../Avatar';
import { personOf } from '../person';
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
import { ThemeSwatch } from '../ThemePicker';

/**
 * The profile chip (avatar and name) opens My profile, the theme and Sign out (V217, cut 5; Landing 31). It is the
 * one way to My profile: the drawer and More do not repeat it (daily use 10). The theme lives with the person, under
 * their avatar — never in the top bar: five rows with swatches, the current one ticked; one click, no page change.
 * Density, language and the development direction live in My profile's Look; Recently deleted is reached from
 * Activity and Ctrl K.
 */
// Sign-out is a POST to /auth/sign-out (P3-2), sent by the hidden form the menu renders beside its trigger.
const SIGN_OUT_FORM = 'sign-out-form';
export const signOut = () => (document.getElementById(SIGN_OUT_FORM) as HTMLFormElement | null)?.requestSubmit();

export function ProfileMenu() {
  const t = useTranslations();
  const me = useMe();
  const person = personOf(me);
  const { theme, choose } = useThemeChoice();
  // Landing 34 (item 11): while Arabic is on (Settings → App), each person picks their language here
  const arabic = useArabicEnabled();
  const language = useLanguageChoice();
  return (
    <Menu>
      <form id={SIGN_OUT_FORM} method="post" action="/auth/sign-out" hidden />
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('top.profile')}
          data-profile-chip
          className="flex h-11 items-center gap-2.5 rounded-pill pe-3 ps-1 text-base font-medium text-current hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Avatar person={person} size="sm" ring="nav" />
          <span className="hidden sm:inline">{person.displayName}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="min-w-56">
        <MenuItem asChild>
          <Link href="/profile">
            <UserRound />
            {t('profileMenu.myProfile')}
          </Link>
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('themePicker.title')}</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={(v) => void choose(v as Theme)} data-theme-menu>
          {THEMES.map((k) => (
            // the menu stays open on a pick, so the change is seen at once and another can be tried
            <MenuRadioItem key={k} value={k} onSelect={(e) => e.preventDefault()} data-theme-item={k}>
              <ThemeSwatch theme={k} />
              {t(`theme.${k}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        {arabic ? (
          <>
            <MenuSeparator />
            <MenuLabel>{t('profileMenu.language')}</MenuLabel>
            <MenuRadioGroup
              value={language.locale}
              onValueChange={(v) => void language.choose(v as 'en' | 'ar')}
              data-language-menu
            >
              <MenuRadioItem value="en" data-language-item="en">
                {t('locale.en')}
              </MenuRadioItem>
              <MenuRadioItem value="ar" data-language-item="ar">
                {t('locale.ar')}
              </MenuRadioItem>
            </MenuRadioGroup>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={signOut} data-sign-out>
          {t('profileMenu.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
