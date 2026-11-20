'use client';
import { cn } from '@/ui/cn';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import {
  blankExclusion,
  EXCLUSION_KINDS,
  exclusionDraftOk,
  exclusionFields,
  refusalWords,
  ruleHook,
  splitExclusionRules,
  typedRuleValue,
  type ExclusionDraft,
  type ExclusionKind,
  type ExclusionRule,
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

/**
 * The fields of "Add to the exclusion list": the kind (one of four), the value and the reason. Every one opens empty
 * — nothing is chosen, typed, suggested or defaulted for the person — and a client ID keeps digits only.
 */
export function ExclusionAddFields({
  draft,
  onChange,
  error,
}: {
  draft: ExclusionDraft;
  onChange: (d: ExclusionDraft) => void;
  /** A refusal of the save, in words (a rule that is already on the list). */
  error?: string | null;
}) {
  const t = useTranslations();
  const required = t('common.required');
  return (
    <div className="flex flex-col gap-4">
      <Field label={t('settings.financeLists.kind')} required={required}>
        {(p) => (
          <div data-exclusion-kind={draft.kind}>
            <Select
              {...p}
              aria-label={t('settings.financeLists.kind')}
              value={draft.kind}
              placeholder={t('settings.financeLists.choose')}
              options={EXCLUSION_KINDS.map((k) => ({ value: k, label: t(`settings.financeLists.kinds.${k}`) }))}
              onValueChange={(v) =>
                onChange({ ...draft, kind: v as ExclusionKind, value: typedRuleValue(v, draft.value) })
              }
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
            dir={draft.kind === 'name' || draft.kind === '' ? 'auto' : 'ltr'}
            value={draft.value}
            onChange={(e) => onChange({ ...draft, value: typedRuleValue(draft.kind, e.target.value) })}
            data-exclusion-value
          />
        )}
      </Field>
      <Field label={t('settings.financeLists.reason')} required={required}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={draft.reason}
            onChange={(e) => onChange({ ...draft, reason: e.target.value })}
            data-exclusion-reason
          />
        )}
      </Field>
      {error ? (
        <p role="alert" className="text-sm leading-[18px] text-danger" data-exclusion-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The exclusion list in Settings → Finance (Landing 32; admins only — the page draws it for nobody else and the
 * database refuses them anyway). The list rules with what each catches now, Add (kind, value, reason) and Remove
 * (with its reason); under them, read-only, the rules made by Exclude on single Ledger rows — those are undone
 * there, with Include. `rules` is the server's read; null is a read that failed, said with Try again.
 */
export function ExclusionListCard({ rules }: { rules: ExclusionRule[] | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [reading, startReading] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ExclusionDraft>(blankExclusion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ExclusionRule | null>(null);
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
    setDraft(blankExclusion());
    setError(null);
    setAdding(true);
  };
  const add = async () => {
    if (!exclusionDraftOk(draft)) return;
    setBusy(true);
    setError(null);
    const fields = exclusionFields(draft);
    let written: Written;
    try {
      written = (await rpc('finance_exclusion_rule_save', {
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
      { ...words, done: t('settings.exclusions.saved') },
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
    const written = (await rpc('finance_exclusion_rule_remove', { p_id: removing.id, p_reason: reason })) as Written;
    await run(
      { ...words, done: t('settings.exclusions.removed') },
      async () => written,
      () => {
        setRemoving(null);
        router.refresh();
      },
    );
  };

  const { list, rowLevel } = splitExclusionRules(rules ?? []);
  const addButton = (
    <Button size="sm" className="max-sm:min-h-11" icon={<Plus />} onClick={openAdd} data-exclusion-add>
      {t('common.add')}
    </Button>
  );
  return (
    <section className="flex flex-col rounded-lg border border-border bg-raised shadow-1" data-exclusion-list>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-strong">{t('settings.exclusions.title')}</h2>
        {rules !== null && list.length > 0 ? addButton : null}
      </div>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-muted" data-exclusion-about>
          {t('settings.exclusions.about')}
        </p>
        {reading ? (
          <DataState kind="loading" message={t('state.loading', { what: t('settings.exclusions.title') })} />
        ) : rules === null ? (
          <DataState
            kind="failed"
            message={t('state.failed', { what: t('settings.exclusions.title') })}
            onRetry={() => startReading(() => router.refresh())}
            retryLabel={t('common.tryAgain')}
          />
        ) : list.length === 0 ? (
          <DataState kind="empty" compact message={t('settings.exclusions.empty')} action={addButton} />
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
                  {t('settings.financeLists.reason')}
                </div>
                <div role="columnheader" className={thClass}>
                  {t('settings.exclusions.catches')}
                </div>
                <div role="columnheader" className={cn(thClass, 'pe-0')}>
                  <span className="sr-only">{t('common.actions')}</span>
                </div>
              </div>
            </div>
            <div role="rowgroup" className={bodyClass}>
              {list.map((r) => (
                <div role="row" key={r.id} className={rowClass} data-exclusion-rule={ruleHook(r)}>
                  <Cell label={t('settings.financeLists.kind')} className="sm:whitespace-nowrap">
                    {kindWord(r.kind)}
                  </Cell>
                  <Cell label={t('settings.financeLists.value')} className="font-medium text-strong">
                    <RuleValue kind={r.kind} value={r.value} />
                  </Cell>
                  <Cell label={t('settings.financeLists.reason')}>
                    <span dir="auto" className="[overflow-wrap:anywhere]">
                      {r.reason}
                    </span>
                  </Cell>
                  <Cell label={t('settings.exclusions.catches')} data-exclusion-catches="">
                    <CatchesNow rows={r.rows} amount={r.amount_sar} />
                  </Cell>
                  <Cell className="pe-0 sm:text-end">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="max-sm:min-h-11"
                      aria-label={t('settings.exclusions.removeNamed', { value: r.value })}
                      onClick={() => setRemoving(r)}
                      data-exclusion-remove
                    >
                      {t('common.remove')}
                    </Button>
                  </Cell>
                </div>
              ))}
            </div>
          </div>
        )}
        {!reading && rowLevel.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4" data-exclusion-row-rules>
            <h3 className="text-base font-semibold text-strong">{t('settings.exclusions.rowsTitle')}</h3>
            <p className="text-sm text-muted">{t('settings.exclusions.rowsAbout')}</p>
            <div role="table" className={tableClass}>
              <div role="rowgroup" className={headClass}>
                <div role="row" className={headRowClass}>
                  <div role="columnheader" className={thClass}>
                    {t('settings.exclusions.number')}
                  </div>
                  <div role="columnheader" className={thClass}>
                    {t('settings.financeLists.reason')}
                  </div>
                </div>
              </div>
              <div role="rowgroup" className={bodyClass}>
                {rowLevel.map((r) => (
                  <div role="row" key={r.id} className={rowClass} data-exclusion-row-rule={r.value}>
                    <Cell
                      label={t('settings.exclusions.number')}
                      className="font-medium text-strong sm:whitespace-nowrap"
                    >
                      <RuleValue kind="invoice" value={r.value} />
                    </Cell>
                    <Cell label={t('settings.financeLists.reason')} className="sm:w-full">
                      <span dir="auto" className="[overflow-wrap:anywhere]">
                        {r.reason}
                      </span>
                    </Cell>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={adding}
        onOpenChange={(o) => !o && setAdding(false)}
        title={t('settings.exclusions.addTitle')}
        dirty={draft.value !== '' || draft.reason !== ''}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!exclusionDraftOk(draft)}
              loading={busy}
              onClick={() => void add()}
              data-exclusion-save
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <ExclusionAddFields draft={draft} onChange={setDraft} error={error} />
      </Dialog>
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? t('settings.exclusions.removeTitle', { value: removing.value }) : ''}
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
