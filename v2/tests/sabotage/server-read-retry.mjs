// Sabotages for W43's one more try (a server read that failed on its way is tried again, a refusal never is) and W47's
// one round of reads per tab.
const target = 'unit:tests/unit/db/a-server-read-that-failed-on-its-way-is-tried-once-more.test.ts';

export const sabotages = [
  {
    name: 'a-failed-read-is-never-tried-again',
    breaks: [target],
    expect: '> a gateway that gave up, then an answer: the page gets the answer',
    edits: [
      {
        file: 'src/core/db/retry.ts',
        find: '  if (!isTransient(first)) return first;',
        replace: '  if (first) return first;',
      },
    ],
  },
  {
    name: 'a-refusal-is-tried-again',
    breaks: [target],
    expect: '> a refusal or an error the database gave is an answer, never retried',
    edits: [
      {
        file: 'src/core/db/retry.ts',
        find: "  if (code !== '' && !TRANSIENT_CODES.has(code) && !code.startsWith('08')) return false;\n",
        replace: '',
      },
    ],
  },
];

// W47: a tab asks for all its data in one round after me; each sabotage puts one read back in front of the others.
const rounds = 'unit:tests/unit/pages/a-tab-asks-for-all-its-data-in-one-round.test.ts';
sabotages.push(
  {
    name: 'activity-reads-the-organisation-first',
    breaks: [rounds],
    expect: '> Activity: the organisation and the tab read together, on every tab',
    edits: [
      {
        file: 'src/app/(app)/activity/page.tsx',
        find: "  const [org, read] = await Promise.all([serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>, tabRead()]);",
        replace:
          "  const org = (await serverRpc('org', {} as never)) as unknown as OrgAnswer;\n  const read = await tabRead();",
      },
    ],
  },
  {
    name: 'settings-reads-the-settings-first',
    breaks: [rounds],
    expect: '> Settings: the settings, the organisation and every list together',
    edits: [
      {
        file: 'src/app/(app)/settings/[group]/page.tsx',
        find: "    serverRpc('settings', { p_group: def.page }) as Promise<unknown>,",
        replace: "    (await serverRpc('settings', { p_group: def.page })) as unknown,",
      },
    ],
  },
);
