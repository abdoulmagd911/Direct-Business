'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants } from './Button';

/** The body of a Not found page inside the shell: the address that has nothing, and the way back to My day. */
export function NotFoundBody({ address }: { address: string }) {
  const t = useTranslations();
  return (
    <div data-state="not-found" className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5">
      <p className="text-base text-text">
        {t.rich('errors.notFound.body', {
          address: () => <span className="font-data">{address}</span>,
        })}
      </p>
      <div>
        <Link href="/my-day" className={buttonVariants({ variant: 'secondary', size: 'md' })} data-not-found-home>
          {t('errors.notFound.goMyDay')}
        </Link>
      </div>
    </div>
  );
}
