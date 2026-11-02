// Sabotage for the revert of 442101f6 (the Architect's order of 2 Nov; builder A): the app-wide loading frame comes
// back, so every signed-in answer starts as 200 before its page knows whether its record exists.
const E2E = 'e2e:tests/e2e/a-record-that-does-not-exist-answers-404.spec.ts';

export const sabotages = [
  {
    name: 'an-app-wide-loading-frame',
    breaks: [E2E],
    expect: 'answers 404',
    writes: [
      {
        file: 'src/app/(app)/loading.tsx',
        content: `import { DataState } from '@/ui/DataState';
import { PageFrame } from '@/ui/shell/AppShell';

export default function Loading() {
  return (
    <PageFrame>
      <DataState kind="loading" />
    </PageFrame>
  );
}
`,
      },
    ],
  },
];
