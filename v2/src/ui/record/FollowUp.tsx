'use client';
import { AlarmClockPlus } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { onRefetch } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { openQuickCapture, type CaptureAbout } from '@/modules/my-day/quick-capture';
import { Button } from '../Button';
import { StatusChip } from '../Chip';

/** One of the reader's own open follow-ups on a record, as `api.my_follow_ups` serves it. */
type MyFollowUp = { id: string; note_id: string; remind_at: string; text: string; told: boolean };

/**
 * Follow up on a record (V632 Stage 2, V282; the oversight's walk of 14 Oct, finding 2): a visible action among the
 * record's others. It opens the one Capture sheet on this record (#242); the record shows through `about`, never in the
 * note's title (QA-560).
 */
export function FollowUpButton({ about }: { about: CaptureAbout }) {
  const t = useTranslations();
  return (
    <Button icon={<AlarmClockPlus />} onClick={() => openQuickCapture({ about })} data-follow-up>
      {t('record.followUp')}
    </Button>
  );
}

/**
 * The reader's own open follow-ups on this record, one chip each with its time (finding 4): private to them (V454) —
 * nobody else's, admins included. A chip opens its note. A failed read says so and offers Try again; it never reads as
 * "no follow-up".
 */
export function FollowUpChips({ entity, id }: { entity: CaptureAbout['entity']; id: string }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [rows, setRows] = useState<MyFollowUp[] | null>(null);
  const [failed, setFailed] = useState(false);
  // a new read on mount, on Try again, and whenever a command lands — a Follow up saved from this page, or Done /
  // Snooze anywhere — so the chips follow without a reload
  const [attempt, setAttempt] = useState(0);
  useEffect(() => onRefetch(() => setAttempt((a) => a + 1)), []);
  useEffect(() => {
    let alive = true;
    rpc('my_follow_ups', { p_entity: entity, p_id: id }).then(
      (r) => {
        if (!alive) return;
        setRows(r as MyFollowUp[]);
        setFailed(false);
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [entity, id, attempt]);

  if (failed)
    return (
      <button type="button" onClick={() => setAttempt((a) => a + 1)} data-follow-ups-failed>
        <StatusChip tone="warning">{t('record.followUpsFailed')}</StatusChip>
      </button>
    );
  return (
    <>
      {(rows ?? []).map((r) => (
        <Link key={r.id} href={`/my-day/notes/${r.note_id}`} data-follow-up-chip={r.id}>
          <StatusChip tone={r.told ? 'warning' : 'info'}>
            {t('record.followUpOn', {
              when: formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
            })}
          </StatusChip>
        </Link>
      ))}
    </>
  );
}
