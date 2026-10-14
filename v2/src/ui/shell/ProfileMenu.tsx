'use client';
import { ExternalLink, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { rpc } from '@/core/db/rpc';
import { Avatar } from '../Avatar';
import { personOf } from '../person';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../Menu';

/**
 * The profile chip (avatar and name) opens My profile and Sign out (V217, cut 5) — and, only once an admin has added any,
 * the named links to the SOP and SLA documents in Drive under Documents (V435). Density, language and the development
 * direction live in My profile's Preferences; Recently deleted is reached from Activity and Ctrl K.
 */
type DocLink = { id: string; name_en: string; name_ar: string | null; link: string };

/** The live Documents links, read once when the menu first opens (api.list reads any list for a signed-in person). */
function useDocLinks(open: boolean): DocLink[] {
  const [links, setLinks] = useState<DocLink[] | null>(null);
  useEffect(() => {
    if (!open || links !== null) return;
    let live = true;
    rpc('list', { p_list: 'doc_link' })
      .then(
        (rows) => live && setLinks(((rows as unknown as DocLink[]) ?? []).filter((r) => /^https:\/\//.test(r.link))),
      )
      .catch(() => live && setLinks([]));
    return () => {
      live = false;
    };
  }, [open, links]);
  return links ?? [];
}
// Sign-out is a POST to /auth/sign-out (P3-2), sent by the hidden form the menu renders beside its trigger.
const SIGN_OUT_FORM = 'sign-out-form';
export const signOut = () => (document.getElementById(SIGN_OUT_FORM) as HTMLFormElement | null)?.requestSubmit();

export function ProfileMenu() {
  const t = useTranslations();
  const me = useMe();
  const locale = useLocale();
  const person = personOf(me);
  const [open, setOpen] = useState(false);
  const docs = useDocLinks(open);
  return (
    <Menu open={open} onOpenChange={setOpen}>
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
        {docs.length ? (
          <>
            <MenuSeparator />
            <MenuLabel>{t('profileMenu.documents')}</MenuLabel>
            {docs.map((d) => (
              <MenuItem asChild key={d.id}>
                <a href={d.link} target="_blank" rel="noopener noreferrer" data-doc-link>
                  <ExternalLink />
                  {locale === 'ar' && d.name_ar ? d.name_ar : d.name_en}
                </a>
              </MenuItem>
            ))}
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
