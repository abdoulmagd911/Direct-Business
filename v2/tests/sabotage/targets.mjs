// Settings → Targets: the plans that are open are listed, and a year a department already has a plan for is not offered again.
const E2E = 'e2e:tests/e2e/settings-targets-and-go-live.spec.ts';
const UNIT = 'unit:tests/unit/settings/targets-plans-read-in-the-pages-language.test.tsx';
const UNIT_DETAIL = 'unit:tests/unit/settings/plan-detail-targets-and-categories.test.tsx';
export const sabotages = [
  {
    name: 'targets-offers-a-year-that-has-a-plan',
    breaks: [E2E],
    expect: 'a year with a plan is not offered',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: 'y >= FIRST_YEAR; y--) if (!held.has(y)) out.push(y);',
        replace: 'y >= FIRST_YEAR; y--) out.push(y);',
      },
    ],
  },
  {
    name: 'targets-lists-no-plan',
    breaks: [E2E],
    expect: 'data-plan-row',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: '{plans.length ? (',
        replace: '{plans.length < 0 ? (',
      },
    ],
  },
  {
    name: 'targets-greyed-open-gives-no-reason',
    breaks: [E2E],
    expect: 'a greyed Open says why',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: '{dept && !years.length ? (',
        replace: '{false && dept && !years.length ? (',
      },
    ],
  },
  {
    name: 'targets-plan-name-stays-english',
    breaks: [UNIT],
    expect: 'reads an unrenamed plan in the page language',
    edits: [
      {
        // Landing 8 (#1578 triage): planTitle moved out of TargetsScreen.tsx into the server-safe
        // src/modules/perf/types.ts by Landing 7 (settings-targets:52) — the plant follows it.
        file: 'src/modules/perf/types.ts',
        find: 'return d && p.name === `${d.name_en} ${p.year}` ?',
        replace: 'return false && d && p.name === `${d.name_en} ${p.year}` ?',
      },
    ],
  },
  {
    name: 'targets-no-department-gives-no-reason',
    breaks: [UNIT],
    expect: 'says why Open is grey when there is no department',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: "{live.length ? t('settings.targets.everyDepartmentEveryYear') : t('settings.targets.noDepartment')}",
        replace: "{t('settings.targets.everyDepartmentEveryYear')}",
      },
    ],
  },
  {
    name: 'targets-open-stays-clickable-when-every-year-is-taken',
    breaks: [UNIT],
    expect: 'greys Open a plan and says why',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: 'disabled={!anyFree}',
        replace: 'disabled={!live.length}',
      },
    ],
  },
  {
    name: 'targets-starts-on-a-taken-year',
    breaks: [UNIT],
    expect: 'starts with no year, never a taken one',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: "year: free.length ? String(free.includes(year) ? year : free[0]) : '' };",
        replace: 'year: String(free.includes(year) ? year : (free[0] ?? year)) };',
      },
    ],
  },
  {
    name: 'targets-refusal-has-no-words-in-arabic',
    breaks: [UNIT],
    expect: 'words both refusals of plan_open in English and in Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '"year_taken": "لهذه الإدارة خطة لهذه السنة بالفعل",',
        replace: '',
      },
    ],
  },
  {
    name: 'targets-plan-row-does-not-open',
    breaks: [E2E],
    expect: 'toHaveURL',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: "<Link href={entityRoute('plan', p.id) ?? '/settings/performance'} className=\"flex flex-col gap-0.5\">",
        replace: '<Link href="/settings/performance" className="flex flex-col gap-0.5">',
      },
    ],
  },
  {
    name: 'targets-target-save-never-lands',
    breaks: [E2E],
    expect: 'Target saved',
    edits: [
      {
        file: 'src/modules/perf/screens/PlanDetailScreen.tsx',
        find: "rpc('target_save', {",
        replace: "rpc('targets', {",
      },
    ],
  },
  {
    name: 'targets-category-save-never-lands',
    breaks: [E2E],
    expect: 'Category saved',
    edits: [
      {
        file: 'src/modules/perf/screens/PlanDetailScreen.tsx',
        find: "rpc('achievement_category_save', {\n          p_id: (editingCategory === null ? null : editingCategory.id) as unknown as string,",
        replace:
          "rpc('achievement_categories', {\n          p_id: (editingCategory === null ? null : editingCategory.id) as unknown as string,",
      },
    ],
  },
  {
    name: 'targets-month-picker-offers-one-month',
    breaks: [UNIT_DETAIL],
    expect: 'twelve months',
    edits: [
      {
        file: 'src/modules/perf/screens/PlanDetailScreen.tsx',
        find: 'Array.from({ length: 12 }, (_, i) => {',
        replace: 'Array.from({ length: 1 }, (_, i) => {',
      },
    ],
  },
];
