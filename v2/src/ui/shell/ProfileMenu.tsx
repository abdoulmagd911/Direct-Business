'use client';
import { LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMe } from '@/core/auth/me-context';
import { Avatar } from '../Avatar';
import { personOf } from '../person';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../Menu';

/**
 * The profile chip (avatar and name) opens two things only: My profile and Sign out (V217, cut 5). Density, language
 * and the development direction live in My profile's Preferences; Recently deleted is reached from Activity and Ctrl K.
 */
// Sign-out is a POST to /auth/sign-out (P3-2), sent by the hidden form the menu renders beside its trigger.
const SIGN_OUT_FORM = 'sign-out-form';
export const signOut = () => (document.getElementById(SIGN_OUT_FORM) as HTMLFormElement | null)?.requestSubmit();

export function ProfileMenu() {
  const t = useTranslations();
  const me = useMe();
  const person = personOf(me);
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
        <MenuItem icon={<LogOut />} onSelect={signOut} data-sign-out>
          {t('profileMenu.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
