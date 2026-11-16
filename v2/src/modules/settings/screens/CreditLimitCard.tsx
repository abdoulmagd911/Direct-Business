'use client';
import { ArrowRight, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatMoney } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { parseCreditLimit } from '../credit-limit';

// api.finance_credit_limit_set is newer than the generated database types (Landing 31): called by name until they are
// regenerated.
const call = rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>;

/** The figure as the boards write it: the currency small and grey before the amount, left to right in both languages. */
function Figure({ amount, locale }: { amount: number; locale: 'en' | 'ar' }) {
  return (
    <bdi dir="ltr" className="font-data tabular">
      <span className="font-ui text-xs font-medium text-muted">SAR</span> {formatMoney(amount, locale)}
    </bdi>
  );
}

/**
 * The credit limit in Settings → Finance (Landing 31; boards fin2-credit-* and fin2-credit-view-*). Two views of the one
 * figure: the edit form for a manager, a head of department and an admin — a whole positive amount, then a
 * confirmation that carries the reason, like every setting — and the read-only view for everyone else. `canEdit` is
 * the server's answer and the role rule together (the page works it out); the database refuses anyone else anyway.
 */
export function CreditLimitCard({
  amount,
  canEdit,
  undo,
}: {
  /** Whole riyals, in force today. */
  amount: number;
  canEdit: boolean;
  /** Whether the saved toast offers Undo: a setting change is undone by an admin (V97). */
  undo: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const stored = formatMoney(amount, locale);
  const [text, setText] = useState(stored);
  const [seen, setSeen] = useState(amount);
  const [asking, setAsking] = useState(false);
  // the figure changed under the form (a save, someone else's change): the box follows it
  if (amount !== seen) {
    setSeen(amount);
    setText(stored);
  }
  const typed = parseCreditLimit(text);
  const dirty = text.trim() !== stored;
  const invalid = dirty && typed === null;
  const ok = typed !== null && typed !== amount;

  const save = async (reason: string) => {
    if (typed === null) return;
    await run(
      {
        done: t('settings.credit.saved'),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k: string) => t.has(k),
        failed: (k: string, d: string) => t(k, { detail: d }),
      },
      async () => {
        const written = (await call('finance_credit_limit_set', { p_amount: typed, p_reason: reason })) as {
          request_id?: string | null;
        } | null;
        return undo ? written : { request_id: null };
      },
      () => {
        setAsking(false);
        router.refresh();
      },
    );
  };

  return (
    <section
      className="flex flex-col rounded-lg border border-border bg-raised shadow-1"
      data-credit-limit={canEdit ? 'edit' : 'view'}
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-strong">{t('settings.credit.title')}</h2>
      </div>
      <div className="p-5">
        {canEdit ? (
          <form
            className="flex max-w-[520px] flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (ok) setAsking(true);
            }}
            noValidate
          >
            <Field label={t('settings.credit.title')} error={invalid ? t('settings.credit.invalid') : undefined}>
              {(p) => (
                <Input
                  {...p}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={() => {
                    // a valid amount is written back the way the app writes money: 1250000 → 1,250,000
                    const n = parseCreditLimit(text);
                    if (n !== null) setText(formatMoney(n, locale));
                  }}
                  className="font-data tabular"
                  data-credit-limit-input
                />
              )}
            </Field>
            <p className="text-sm text-muted">{t('settings.credit.help')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="max-sm:min-h-11"
                disabled={!dirty}
                onClick={() => setText(stored)}
                data-credit-limit-cancel
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" className="max-sm:min-h-11" disabled={!ok} data-credit-limit-save>
                {t('common.save')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex max-w-[520px] flex-col gap-2">
            <span className="text-sm font-medium leading-[18px] text-strong">{t('settings.credit.title')}</span>
            <div className="font-display text-[22px] font-semibold leading-[30px] text-strong" data-credit-limit-value>
              <Figure amount={amount} locale={locale} />
            </div>
            <p className="flex items-start gap-2 text-sm text-muted" data-credit-limit-locked>
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('settings.credit.readOnly')}
            </p>
          </div>
        )}
      </div>
      {canEdit ? (
        <ReasonDialog
          open={asking}
          onOpenChange={setAsking}
          title={t('settings.credit.confirmTitle')}
          body={
            typed !== null ? (
              <span className="inline-flex flex-wrap items-baseline gap-x-2" data-credit-limit-change>
                <Figure amount={amount} locale={locale} />
                <ArrowRight className="size-4 self-center rtl:-scale-x-100" aria-hidden="true" />
                <span className="sr-only">{t('settings.setting.preview.to')}</span>
                <span className="font-semibold text-strong">
                  <Figure amount={typed} locale={locale} />
                </span>
              </span>
            ) : undefined
          }
          onSave={save}
          words={{
            reason: t('common.reason'),
            save: t('common.save'),
            cancel: t('common.cancel'),
            reasonRequired: t('settings.form.reasonRequired'),
          }}
        />
      ) : null}
    </section>
  );
}
