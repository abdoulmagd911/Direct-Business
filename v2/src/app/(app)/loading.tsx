import { DataState } from '@/ui/DataState';
import { PageFrame } from '@/ui/shell/AppShell';

// Instant fallback on every in-app navigation, so a click never leaves the
// old page frozen behind the nav progress bar while the server page loads.
export default function Loading() {
  return (
    <PageFrame>
      <DataState kind="loading" />
    </PageFrame>
  );
}
