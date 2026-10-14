import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate } from '@/core/i18n/format';
import { WeeklyReview } from '@/modules/weekly-review/screens/WeeklyReview';
import { weeklyReview } from '@/modules/weekly-review/server';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('pages.weeklyReview.title');

/** The Thursday weekly review (V632 Stage 3): my own week, under My day and at its level (V454: mine alone). */
export default async function WeeklyReviewRoute() {
  const [t, locale, answer] = await Promise.all([getTranslations(), getLocale(), weeklyReview()]);
  const lang = locale === 'ar' ? 'ar' : 'en';
  const range = answer
    ? t('pages.weeklyReview.range', {
        from: formatDate(answer.week.from, lang, { day: 'numeric', month: 'short' }),
        to: formatDate(answer.week.to, lang, { day: 'numeric', month: 'short' }),
      })
    : undefined;
  return (
    <Page page="my_day" title={t('nav.my_day')}>
      <PageHeader
        crumbs={[{ label: t('nav.my_day'), href: '/my-day' }]}
        title={t('pages.weeklyReview.title')}
        meta={range}
      />
      <WeeklyReview answer={answer} />
    </Page>
  );
}
