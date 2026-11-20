'use client';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import type { ReadFailure } from '../read-failure';

/**
 * A read of the list or of a record that did not answer (Landing 34). It says what failed and why — a read the
 * database stopped for time, or a server that did not answer — with the failure's own reference, and a Try again that
 * is seen to work: the button spins for as long as the read is on its way (before, `router.refresh()` ran with nothing
 * on screen for the seconds it took, and a second failure drew the very same box, so the button looked dead), and a
 * try that failed again says so with its count.
 */
export function ReadFailed({ message, failure }: { message?: string; failure?: ReadFailure | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tries, setTries] = useState(0);
  const again = () => {
    setTries((n) => n + 1);
    start(() => router.refresh());
  };
  return (
    <DataState
      kind="failed"
      message={failure && message ? `${message} ${t(`partners.read.${failure.kind}`)}` : message}
      action={
        <>
          {tries > 0 && !pending ? (
            <span className="text-sm text-muted" data-read-tried={tries}>
              {t('partners.read.again', { count: tries })}
            </span>
          ) : null}
          {failure ? (
            <bdi className="font-data text-xs text-muted" data-failure-ref>
              {failure.ref}
            </bdi>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw />}
            loading={pending}
            onClick={again}
            className="ms-auto"
            data-read-retry
          >
            {t('common.tryAgain')}
          </Button>
        </>
      }
    />
  );
}
