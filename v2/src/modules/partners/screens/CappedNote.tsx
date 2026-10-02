import { useTranslations } from 'next-intl';

/** The list reads a fixed number of rows: past it, the header's total is the truth and this line says so (QA-506). */
export function CappedNote({ shown, total }: { shown: number; total: number }) {
  const t = useTranslations();
  if (total <= shown) return null;
  return (
    <p className="text-sm text-muted" data-partners-capped>
      {t('partners.capped', { shown, total })}
    </p>
  );
}
