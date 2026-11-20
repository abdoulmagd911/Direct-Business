'use client';
import { useTranslations } from 'next-intl';
import type { RuleCheck, RuleCount } from '@/modules/imports';
import { StatusChip } from '@/ui/Chip';

/** What the code text of this import matched; 'unchecked' when the check itself did not answer. */
export type ImportCodeState = 'found' | 'not_found' | 'ambiguous' | 'unchecked';

/** The database's answer to api.import_code_check, as a state the preview can say. */
export function importCodeStateOf(answer: unknown): ImportCodeState {
  const s = answer && typeof answer === 'object' ? (answer as { state?: unknown }).state : null;
  return s === 'found' || s === 'not_found' || s === 'ambiguous' ? s : 'unchecked';
}

/**
 * What stands above the import preview (Landing 32, A2 + A3), never silent: the code text's state — found, not
 * found, or held because more than one code carries it — and what the exclusion list does to this import: every row
 * stored but not counted (naming the rule: its kind, its value, its reason), or the single rows the list names. A
 * check that did not answer says so in words; the preview never passes for "nothing is excluded" by staying quiet.
 */
export function ImportRuleNotes({
  check,
  checkFailed,
  count,
  codeState,
}: {
  check: RuleCheck | null;
  checkFailed: boolean;
  count: RuleCount;
  /** Null when this import carries no code text. */
  codeState: ImportCodeState | null;
}) {
  const t = useTranslations();
  const kind = (k: string | null) => (k && t.has(`import.ruleKind.${k}`) ? t(`import.ruleKind.${k}`) : (k ?? '—'));
  return (
    <>
      {codeState ? (
        <p className="flex flex-wrap items-center gap-2 text-base" data-import-code-state={codeState}>
          {codeState === 'found' ? (
            <StatusChip tone="success">{t('import.codeFound')}</StatusChip>
          ) : codeState === 'unchecked' ? (
            <span role="alert" className="text-danger">
              {t('import.codeCheckFailed')}
            </span>
          ) : (
            <StatusChip tone="warning" className="h-auto min-h-6 whitespace-normal py-0.5">
              <span role="alert">{t(codeState === 'not_found' ? 'import.codeNotFound' : 'import.codeHeld')}</span>
            </StatusChip>
          )}
        </p>
      ) : null}
      {checkFailed ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-base text-danger" data-import-rule-failed>
          {t('import.ruleCheckFailed')}
        </p>
      ) : null}
      {check?.excluded ? (
        <p
          role="alert"
          className="rounded-lg bg-warning-soft px-3 py-2.5 text-base text-warning [overflow-wrap:anywhere]"
          data-import-rule-excluded="all"
        >
          {t('import.ruleExcluded', {
            kind: kind(check.kind),
            value: check.value ?? '—',
            reason: check.reason ?? t('import.ruleNoReason'),
          })}
        </p>
      ) : count.rowNos.length > 0 ? (
        <p
          role="alert"
          className="rounded-lg bg-warning-soft px-3 py-2.5 text-base text-warning"
          data-import-rule-excluded="rows"
        >
          {t('import.ruleNumbers', { count: count.rowNos.length })}
        </p>
      ) : null}
    </>
  );
}
