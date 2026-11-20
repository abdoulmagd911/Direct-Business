'use client';
import { cn } from '@/ui/cn';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import type { PartnerRef } from '@/modules/my-day/types';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import {
  blankMerge,
  MERGE_KINDS,
  mergeDraftOk,
  mergeFields,
  mergeTargetName,
  refusalWords,
  ruleHook,
  typedRuleValue,
  type MergeDraft,
  type MergeKind,
  type MergeRule,
} from '../finance-lists';
import {
  bodyClass,
  CatchesNow,
  Cell,
  headClass,
  rowClass,
  RuleValue,
  tableClass,
  thClass,
  headRowClass,
} from './FinanceListParts';

type Written = { request_id?: string | null } | null;
type Draft = MergeDraft<PartnerRef>;

/**
 * The fields of "Add to the merge list": the kind (a client ID or a discount code), the value, the organisation it
 * is counted under (searched by name or number — the same picker as everywhere) and the reason. Every one opens
 * empty: nothing is chosen, typed, suggested or defaulted for the person.
 */
export function MergeAddFields({
  draft,
  onChange,
  error,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  /** A refusal of the save, in words (a rule that is already on the list). */
  error?: string | null;
}) {
  const t = useTranslations();
  const required = t('common.required');
  return (
    <div className="flex flex-col gap-4">
      <Field label={t('settings.financeLists.kind')} required={required}>
        {(p) => (
          <div data-merge-kind={draft.kind}>
            <Select
              {...p}
              aria-label={t('settings.financeLists.kind')}
              value={draft.kind}
              placeholder={t('settings.financeLists.choose')}
              options={MERGE_KINDS.map((k) => ({ value: k, label: t(`settings.financeLists.kinds.${k}`) }))}
              onValueChange={(v) => onChange({ ...draft, kind: v as MergeKind, value: typedRuleValue(v, draft.value) })}
            />
          </div>
        )}
      </Field>
      <Field label={t('settings.financeLists.value')} required={required}>
        {(p) => (
          <Input
            {...p}
            type="text"
            autoComplete="off"
            inputMode={draft.kind === 'client_id' ? 'numeric' : undefined}
            dir="ltr"
            value={draft.value}
            onChange={(e) => onChange({ ...draft, value: typedRuleValue(draft.kind, e.target.value) })}
            data-merge-value
          />
        )}
      </Field>
      <Field label={t('settings.merges.countedUnder')} required={required}>
        {(p) => (
          <div data-merge-partner={draft.partner?.id ?? ''}>
            <PartnerPicker id={p.id} value={draft.partner} onChange={(partner) => onChange({ ...draft, partner })} />
          </div>
        )}
      </Field>
      <Field label={t('settings.financeLists.reason')} required={required}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={draft.reason}
            onChange={(e) => onChange({ ...draft, reason: e.target.value })}
            data-merge-reason
          />
        )}
      </Field>
      {error ? (
        <p role="alert" className="text-sm leading-[18px] text-danger" data-merge-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The merge list in Settings → Finance (Landing 32; admins only — the page draws it for nobody else and the database
 * refuses them anyway): a client ID or a discount code counted under an organisation, with what each rule merges
 * now, Add and Remove (each with its reason). `rules` is the server's read; null is a read that failed, said with
 * Try again.
 */
export function MergeListCard({ rules }: { rules: MergeRule[] | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [reading, startReading] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankMerge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MergeRule | null>(null);
  const words = {
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  };
  const kindWord = (k: string) =>
    t.has(`settings.financeLists.kinds.${k}`) ? t(`settings.financeLists.kinds.${k}`) : k;
  const openAdd = () => {
    // the dialog opens blank every time: what was typed and cancelled does not come back
    setDraft(blankMerge());
    setError(null);
    setAdding(true);
  };
  const add = async () => {
    if (!mergeDraftOk(draft)) return;
    setBusy(true);
    setError(null);
    const fields = mergeFields(draft);
    let written: Written;
    try {
      written = (await rpc('finance_merge_rule_save', {
        p_id: null as unknown as string,
        p_fields: fields,
        p_reason: fields.reason,
      })) as Written;
    } catch (e) {
      // refused (it is already on the list, the person is not an admin): said in the dialog, which stays as typed
      setError(refusalWords(e, words));
      setBusy(false);
      return;
    }
    await run(
      { ...words, done: t('settings.merges.saved') },
      async () => written,
      () => {
        setAdding(false);
        router.refresh();
      },
    );
    setBusy(false);
  };
  const remove = async (reason: string) => {
    if (!removing) return;
    // a refusal is thrown to the dialog, which says it in words and stays open
    const written = (await rpc('finance_merge_rule_remove', { p_id: removing.id, p_reason: reason })) as Written;
    await run(
      { ...words, done: t('settings.merges.removed') },
      async () => written,
      () => {
        setRemoving(null);
        router.refresh();
      },
    );
  };

  const list = rules ?? [];
  const addButton = (
    <Button size="sm" className="max-sm:min-h-11" icon={<Plus />} onClick={openAdd} data-merge-add>
      {t('common.add')}
    </Button>
  );
  return (
    <section className="flex flex-col rounded-lg border border-border bg-raised shadow-1" data-merge-list>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-strong">{t('settings.merges.title')}</h2>
        {rules !== null && list.length > 0 ? addButton : null}
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1 text-sm text-muted" data-merge-about>
          <p>{t('settings.merges.about')}</p>
          <p>{t('settings.merges.aboutCode')}</p>
        </div>
        {reading ? (
          <DataState kind="loading" message={t('state.loading', { what: t('settings.merges.title') })} />
        ) : rules === null ? (
          <DataState
            kind="failed"
            message={t('state.failed', { what: t('settings.merges.title') })}
            onRetry={() => startReading(() => router.refresh())}
            retryLabel={t('common.tryAgain')}
          />
        ) : list.length === 0 ? (
          <DataState kind="empty" compact message={t('settings.merges.empty')} action={addButton} />
        ) : (
          <div role="table" className={tableClass}>
            <div role="rowgroup" className={headClass}>
              <div role="row" className={headRowClass}>
                <div role="columnheader" className={thClass}>
                  {t('settings.financeLists.kind')}
                </div>
                <div role="columnheader" className={thClass}>
                  {t('settings.financeLists.value')}
                </div>
                <div role="columnheader" className={thClass}>
                  {t('settings.merges.countedUnder')}
                </div>
                <div role="columnheader" className={thClass}>
                  {t('settings.financeLists.reason')}
                </div>
                <div role="columnheader" className={thClass}>
                  {t('settings.merges.merges')}
                </div>
                <div role="columnheader" className={cn(thClass, 'pe-0')}>
                  <span className="sr-only">{t('common.actions')}</span>
                </div>
              </div>
            </div>
            <div role="rowgroup" className={bodyClass}>
              {list.map((r) => (
                <div role="row" key={r.id} className={rowClass} data-merge-rule={ruleHook(r)}>
                  <Cell label={t('settings.financeLists.kind')} className="sm:whitespace-nowrap">
                    {kindWord(r.kind)}
                  </Cell>
                  <Cell label={t('settings.financeLists.value')} className="font-medium text-strong">
                    <RuleValue kind={r.kind} value={r.value} />
                  </Cell>
                  <Cell label={t('settings.merges.countedUnder')} data-merge-target={r.partner_id}>
                    <span className="flex flex-col">
                      <span className="[overflow-wrap:anywhere]">{mergeTargetName(r, locale)}</span>
                      {r.partner_number ? (
                        <bdi dir="ltr" className="self-start font-data text-xs whitespace-nowrap text-muted">
                          {r.partner_number}
                        </bdi>
                      ) : null}
                    </span>
                  </Cell>
                  <Cell label={t('settings.financeLists.reason')}>
                    <span dir="auto" className="[overflow-wrap:anywhere]">
                      {r.reason}
                    </span>
                  </Cell>
                  <Cell label={t('settings.merges.merges')} data-merge-catches="">
                    <CatchesNow rows={r.rows} amount={r.amount_sar} />
                  </Cell>
                  <Cell className="pe-0 sm:text-end">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="max-sm:min-h-11"
                      aria-label={t('settings.merges.removeNamed', { value: r.value })}
                      onClick={() => setRemoving(r)}
                      data-merge-remove
                    >
                      {t('common.remove')}
                    </Button>
                  </Cell>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={adding}
        onOpenChange={(o) => !o && setAdding(false)}
        title={t('settings.merges.addTitle')}
        dirty={draft.value !== '' || draft.reason !== '' || draft.partner !== null}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!mergeDraftOk(draft)}
              loading={busy}
              onClick={() => void add()}
              data-merge-save
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <MergeAddFields draft={draft} onChange={setDraft} error={error} />
      </Dialog>
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? t('settings.merges.removeTitle', { value: removing.value }) : ''}
        onSave={remove}
        destructive
        words={{
          reason: t('common.reason'),
          save: t('common.remove'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
    </section>
  );
}
