import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * My day's banner (V21, the 15 Nov board): the one gradient of the look (`banner-fill`, mirrored in Arabic), the day as
 * the heading, and under it what the number counts in words — "My work · 15 tasks" — the same count as the Tasks
 * screen's My work tab (`my-work.ts`). No number is drawn when the count could not be read. The buttons sit at the end
 * edge on a wide screen and drop under the words, never onto them, when the row is too narrow for both (640 px).
 */
export function DayBanner({
  heading,
  myWork,
  loading = false,
  children,
}: {
  /** The day, already written (`dayHeading`). */
  heading: string;
  /** The My work count; null or absent when it was not read. */
  myWork?: number | null;
  /** The count is still being read: two soft bars in its place. */
  loading?: boolean;
  /** The banner's buttons. */
  children?: ReactNode;
}) {
  const t = useTranslations('pages.myDay.banner');
  return (
    <header
      // check-allow: ui-no-hints — the kit's own banner tokens: this is the day's header (a date and a count), not a hint
      className="banner-fill flex flex-wrap items-end gap-4 rounded-xl p-5 text-banner-text shadow-1 sm:p-6 xl:px-8 xl:py-7"
      data-day-banner
    >
      <div className="flex min-w-0 flex-1 basis-[22.5rem] flex-col gap-1.5">
        <h1
          // check-allow: ui-no-hints — the kit's own banner tokens: this is the day's header (a date and a count), not a hint
          className="min-w-0 break-words text-[32px] font-semibold leading-10 tracking-tight text-banner-text sm:text-[36px] sm:leading-[44px] xl:text-4xl xl:leading-[54px]"
          data-day-heading
        >
          {heading}
        </h1>
        {loading ? (
          <span className="flex flex-col gap-2 py-1" aria-hidden="true">
            <span className="shimmer h-3.5 w-56 max-w-full rounded-pill bg-pressed" />
          </span>
        ) : typeof myWork === 'number' ? (
          <p
            // check-allow: ui-no-hints — the kit's own banner tokens: this is the day's header (a date and a count), not a hint
            className="text-[15px] font-semibold leading-[22px] text-banner-text"
            data-banner-count={myWork}
          >
            {t('myWork', { count: myWork })}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2" data-banner-actions>
          {children}
        </div>
      ) : null}
    </header>
  );
}
