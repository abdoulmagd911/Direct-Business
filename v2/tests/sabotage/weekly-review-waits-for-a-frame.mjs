// L (26 Oct): the weekly review stayed on its loading screen in a browser that draws no frame. The sabotage gives the
// route its own loading screen again; the test must go red.
const E2E = 'e2e:tests/e2e/the-weekly-review-loads-in-a-browser-that-is-not-painting.spec.ts';
export const sabotages = [
  {
    name: 'weekly-review-waits-for-a-frame',
    breaks: [E2E],
    expect: 'toBeVisible',
    writes: [
      {
        file: 'src/app/(app)/my-day/week/loading.tsx',
        content:
          "import { getTranslations } from 'next-intl/server';\nimport { DataState } from '@/ui/DataState';\n\n/** While the week is read: the loading state, said to a screen reader too. */\nexport default async function Loading() {\n  const t = await getTranslations();\n  return (\n    <div className=\"p-4\">\n      <DataState kind=\"loading\" message={t('state.loading', { what: t('pages.weeklyReview.title') })} />\n    </div>\n  );\n}\n",
      },
    ],
  },
];
