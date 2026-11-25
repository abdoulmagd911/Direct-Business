'use client';
import { useTranslations } from 'next-intl';
import { DoorFrame } from './DoorFrame';
import { PasswordDoor } from './PasswordDoor';

/**
 * /set-password for a visitor who is not signed in (Landing 51, FIX-19) — where the sign-in page's "Set your
 * password" link leads. The first of two steps: the work email and the temporary password an admin generated
 * (Settings → People), through the sign-in door's own form and server check. A person whose password must change
 * then lands on "Choose a new password" (SetPassword); anyone else is simply signed in. No e-mail is sent.
 */
export function SetPasswordStart({ next }: { next: string | null }) {
  const t = useTranslations();
  return (
    <DoorFrame footer={t('sign_in.footer', { year: new Date().getFullYear() })} data-set-password-start>
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="font-display text-2xl font-semibold leading-8 sm:text-[28px] sm:leading-9">
          {t('sign_in.password.startTitle')}
        </h1>
        <p className="door-muted text-[15px] leading-[22px]">{t('sign_in.password.startLine')}</p>
      </div>
      <PasswordDoor next={next} refusal={null} temporary />
    </DoorFrame>
  );
}
