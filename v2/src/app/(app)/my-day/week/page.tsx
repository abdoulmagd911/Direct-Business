import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate } from '@/core/i18n/format';
import { WeeklyReview } from '@/modules/weekly-review/screens/WeeklyReview';
import { achievementCategories, weeklyReview, weeklyUnlogged } from '@/modules/weekly-review/server';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('pages.weeklyReview.title');

/**
 * The Thursday weekly review (V632 Stage 3): my own week, under My day and at its level (V454: mine alone). `?routine=1`
 * shows the routine tasks in the nudge too, so every re-read after a nudge action keeps that choice.
 */
export default async function WeeklyReviewRoute({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string | string[] }>;
}) {
  const routine = (await searchParams).routine === '1';
  const [t, locale, answer, unlogged, categories] = await Promise.all([
    getTranslations(),
    getLocale(),
    weeklyReview(),
    weeklyUnlogged(routine),
    achievementCategories(
      Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric' }).format(new Date())),
    ),
  ]);
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
      <WeeklyReview answer={answer} unlogged={unlogged} categories={categories} showRoutine={routine} />
    </Page>
  );
}
