'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { refetchAll } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import type { PartnerRef } from '@/modules/my-day/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { LOG_ACTIVITY_EVENT } from '../log-activity-entry';
import { tradeName, type ListEntry } from '../types';
import { LogActivityDialog } from './record/LogActivityDialog';

/**
 * Log activity from the + (V646, V645): "Who was it with?" comes first — a client, lead or supplier, chosen by name or
 * number — then the form a record page already has (V150). The organisation is required, as it is there. The "someone
 * inside Direct" answer follows with Builder A's migration (V645); nothing is drawn for it here.
 */
export function LogActivityEntry() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState<PartnerRef | null>(null);
  const [lists, setLists] = useState<{ types: ListEntry[]; outcomes: ListEntry[] } | null>(null);
  const [forming, setForming] = useState(false);

  useEffect(() => {
    const show = () => {
      setWho(null);
      setForming(false);
      setAsking(true);
    };
    window.addEventListener(LOG_ACTIVITY_EVENT, show);
    return () => window.removeEventListener(LOG_ACTIVITY_EVENT, show);
  }, []);

  // the form's two lists, read once the first time it is asked for
  const next = async () => {
    if (!who) return;
    if (!lists) {
      try {
        const [types, outcomes] = await Promise.all([
          rpc('list', { p_list: 'activity_type' }),
          rpc('list', { p_list: 'activity_outcome' }),
        ]);
        setLists({ types: types as unknown as ListEntry[], outcomes: outcomes as unknown as ListEntry[] });
      } catch {
        return;
      }
    }
    setAsking(false);
    setForming(true);
  };

  return (
    <>
      <Dialog
        open={asking}
        onOpenChange={setAsking}
        title={t('partners.activity.who')}
        closeLabel={t('common.close')}
        size="sm"
        footer={
          <>
            <Button onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!who} onClick={() => void next()} data-activity-who-next>
              {t('partners.activity.whoNext')}
            </Button>
          </>
        }
      >
        <div data-activity-who>
          <Field label={t('partners.activity.whoOrg')}>
            {(p) => <PartnerPicker id={p.id} value={who} onChange={setWho} />}
          </Field>
        </div>
      </Dialog>
      {who && lists ? (
        <LogActivityDialog
          open={forming}
          onOpenChange={setForming}
          partnerId={who.id}
          types={lists.types}
          outcomes={lists.outcomes}
          onDone={() => refetchAll()}
          partnerName={tradeName(who, locale)}
          onChangeWho={() => {
            setForming(false);
            setAsking(true);
          }}
        />
      ) : null}
    </>
  );
}
