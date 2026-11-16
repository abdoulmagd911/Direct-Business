'use client';
import { DayCrash } from '@/modules/my-day/screens/DayStates';
import { PageFrame } from '@/ui/shell/AppShell';

/**
 * My day when it could not be drawn (Next's error boundary for this page, inside the app's shell): the banner with the
 * day, "Your day could not load." and Try again. Never the raw error.
 */
export default function MyDayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageFrame>
      <DayCrash reset={reset} />
    </PageFrame>
  );
}
