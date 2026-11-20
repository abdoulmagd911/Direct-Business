'use client';
import { useTranslations } from 'next-intl';
import { LOCALES } from '@/core/prefs';
import { useLanguageChoice } from '@/core/prefs/use-language-choice';
import { Button } from '@/ui/Button';

/**
 * The person's own language, on the Arabic card in Settings → App (Landing 34): the admin who has just turned Arabic
 * on sees the choice it opens right here, without looking for it — the same choice the profile menu and My profile
 * offer everyone. Picking one saves it to the profile and draws the app in that language. Only drawn while Arabic is
 * on; while it is off everyone reads English and there is nothing to choose.
 */
export function LanguageChoice() {
  const t = useTranslations();
  const { locale, busy, choose } = useLanguageChoice();
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3"
      role="group"
      aria-label={t('settings.language.yours')}
      data-language-choice
    >
      <span className="text-sm font-medium text-strong">{t('settings.language.yours')}</span>
      <span className="flex flex-wrap gap-2">
        {LOCALES.map((l) => (
          <Button
            key={l}
            size="sm"
            variant={l === locale ? 'primary' : 'secondary'}
            aria-pressed={l === locale}
            disabled={busy}
            onClick={() => void choose(l)}
            data-language-option={l}
          >
            {t(`locale.${l}`)}
          </Button>
        ))}
      </span>
    </div>
  );
}
