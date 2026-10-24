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
import { Select } from '@/ui/Select';
import { nameOf, tradeName, type ListEntry } from '../types';
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
  // V645: with an organisation, or with someone inside Direct (a team or a system from the Settings list)
  const [mode, setMode] = useState<'org' | 'inside'>('org');
  const [inside, setInside] = useState('');
  const [insideList, setInsideList] = useState<ListEntry[] | null>(null);

  useEffect(() => {
    const show = () => {
      setWho(null);
      setMode('org');
      setInside('');
      setForming(false);
      setAsking(true);
    };
    window.addEventListener(LOG_ACTIVITY_EVENT, show);
    return () => window.removeEventListener(LOG_ACTIVITY_EVENT, show);
  }, []);

  const ready = mode === 'org' ? !!who : !!inside;

  // the Settings list of teams and systems inside Direct, read the first time that answer is chosen
  const chooseMode = (m: 'org' | 'inside') => {
    setMode(m);
    if (m === 'inside' && !insideList)
      void rpc('list', { p_list: 'internal_counterpart' })
        .then((rows) => setInsideList(rows as unknown as ListEntry[]))
        .catch(() => setInsideList([]));
  };

  // the form's two lists, read once the first time it is asked for
  const next = async () => {
    if (mode === 'org' ? !who : !inside) return;
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
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {ready ? null : (
              <p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-activity-who-why>
                {mode === 'org' ? t('partners.activity.needWho') : t('partners.activity.needInside')}
              </p>
            )}
            <Button onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!ready} onClick={() => void next()} data-activity-who-next>
              {t('partners.activity.whoNext')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4" data-activity-who>
          <Field label={t('partners.activity.whoKind')}>
            {(p) => (
              <Select
                {...p}
                value={mode}
                onValueChange={(v) => chooseMode(v as 'org' | 'inside')}
                options={[
                  { value: 'org', label: t('partners.activity.whoOrg') },
                  { value: 'inside', label: t('partners.activity.whoInside') },
                ]}
              />
            )}
          </Field>
          {mode === 'org' ? (
            <Field label={t('partners.activity.whoOrg')}>
              {(p) => <PartnerPicker id={p.id} value={who} onChange={setWho} />}
            </Field>
          ) : (
            <Field label={t('partners.activity.insideField')}>
              {(p) => (
                <Select
                  {...p}
                  value={inside}
                  onValueChange={setInside}
                  placeholder={t('partners.activity.insideNone')}
                  options={(insideList ?? []).map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
                  data-activity-inside
                />
              )}
            </Field>
          )}
        </div>
      </Dialog>
      {lists && (mode === 'org' ? who : inside) ? (
        <LogActivityDialog
          open={forming}
          onOpenChange={setForming}
          partnerId={mode === 'org' ? (who?.id ?? null) : null}
          internalKey={mode === 'inside' ? inside : undefined}
          types={lists.types}
          outcomes={lists.outcomes}
          onDone={() => refetchAll()}
          partnerName={
            mode === 'org' && who
              ? tradeName(who, locale)
              : nameOf(
                  (insideList ?? []).find((x) => x.key === inside),
                  locale,
                )
          }
          onChangeWho={() => {
            setForming(false);
            setAsking(true);
          }}
        />
      ) : null}
    </>
  );
}
