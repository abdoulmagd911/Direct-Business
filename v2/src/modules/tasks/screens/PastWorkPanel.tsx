'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { refetchAll } from '@/core/commands/refetch';
import { undoRequest } from '@/core/commands/undo';
import { rpc } from '@/core/db/rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { nameOf } from '@/modules/org/types';
import { Field } from '@/ui/Field';
import { PastWorkGrid, type PastWorkLabels } from '@/ui/grid/PastWorkGrid';
import type { BackfillRequest, OwnerUnknown, Problem } from '@/ui/grid/rows';
import { SOURCE_REPORTS } from '@/ui/grid/source';
import { Select } from '@/ui/Select';
import {
  defaultPastStatus,
  matchOrganisations,
  pastWorkRefusalKey,
  readHeldKeys,
  readPeopleMatch,
  statusChoices,
} from '../pastWork';
import { noTeamToWorkIn, quickAddOwners } from '../rules';
import type { NamePick, TaskStatus } from '../types';

const PROBLEMS: Problem[] = [
  'title_missing',
  'date_missing',
  'date_unreadable',
  'date_ambiguous',
  'date_in_future',
  'date_before_start',
  'kind_missing',
  'kind_unknown',
  'value_unreadable',
  'value_not_allowed',
  'organisation_unknown',
  'organisation_ambiguous',
  'organisation_checking',
  'person_checking',
  'owner_needed',
  'repeated',
  'already_saved',
  'saved_checking',
];
const UNKNOWN: OwnerUnknown[] = ['missing', 'none', 'many'];

/**
 * Past work on Tasks (V276; builder C's grid, P5-2c, tasks mode): paste rows from the report they come from, see every
 * row ready or refused, save the ready ones as one request with one Undo (api.backfill_tasks, V196). The person column
 * — backfilling for others — is offered only with `tasks.assign`; without it every row is the person's own. Someone in
 * no team (the admin account, V444) has no default owner to fall back on (V464): every row needs a named owner, and one
 * Owner picker covers the rows that name none (V605).
 */
export function PastWorkPanel({
  statuses,
  partners,
  org,
}: {
  statuses: TaskStatus[];
  partners: NamePick[];
  org: OrgAnswer | null;
}) {
  const t = useTranslations('pages.tasks.past');
  const tc = useTranslations();
  const lang = useLocale() === 'ar' ? 'ar' : 'en';
  const me = useMe();
  const forOthers = me.capabilities.includes('tasks.assign');
  const owners = quickAddOwners(me.person.team_id, org?.people ?? []);
  const ownerNeeded = !owners.offerDefault;
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null);
  const ownerOptions = owners.people
    .map((p) => ({ value: p.id, label: nameOf(p, lang) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const failedSaying = useCallback(
    (e: unknown) => {
      const key = pastWorkRefusalKey(e);
      return key ? tc(key) : null;
    },
    [tc],
  );

  const labels: PastWorkLabels = useMemo(
    () => ({
      source: t('source'),
      sourceKinds: Object.fromEntries(
        SOURCE_REPORTS.map((k) => [k, t(`sourceKinds.${k}`)]),
      ) as PastWorkLabels['sourceKinds'],
      period: t('period'),
      quarter: (n, year) => t('quarter', { n, year }),
      pickSource: t('pickSource'),
      fromReport: t('fromReport'),
      pasteHere: t('pasteHere'),
      hasHeader: t('hasHeader'),
      fields: {
        title: t('fields.title'),
        happened_on: t('fields.happened_on'),
        kind: t('fields.kind'),
        organisation: t('fields.organisation'),
        notes: t('fields.notes'),
        person: t('fields.person'),
      },
      noColumn: t('noColumn'),
      column: (letter, header) => (header ? t('columnNamed', { letter, header }) : t('column', { letter })),
      dateOrder: t('dateOrder'),
      dayFirst: t('dayFirst'),
      monthFirst: t('monthFirst'),
      line: t('line'),
      ready: t('ready'),
      updatesSaved: t('updatesSaved'),
      problems: Object.fromEntries(PROBLEMS.map((p) => [p, t(`problems.${p}`)])) as PastWorkLabels['problems'],
      ownerUnknown: Object.fromEntries(UNKNOWN.map((u) => [u, t(`ownerUnknown.${u}`)])) as Record<OwnerUnknown, string>,
      summary: (ready, refused) => t('summary', { ready, refused }),
      save: (rows) => t('save', { rows }),
      saved: (rows) => t('saved', { rows }),
      undo: tc('common.undo'),
      failed: t('failed'),
    }),
    [t, tc],
  );

  const resolveOrganisations = useCallback(async (names: string[]) => matchOrganisations(names, partners), [partners]);
  const resolvePeople = useCallback(
    async (names: string[]) => readPeopleMatch(await rpc('people_match', { p_names: names })),
    [],
  );
  const savedKeys = useCallback(
    async (keys: string[]) => readHeldKeys(await rpc('backfill_keys_held', { p_keys: keys })),
    [],
  );
  const save = useCallback(async (request: BackfillRequest) => {
    const r = (await rpc('backfill_tasks', { p_request: request as never })) as { request_id?: string | null } | null;
    refetchAll();
    return { requestId: r?.request_id ?? null };
  }, []);
  const undo = useCallback(async (requestId: string) => {
    await undoRequest(requestId);
    refetchAll();
  }, []);

  if (noTeamToWorkIn(me.person.team_id, forOthers))
    return (
      <section className="flex min-w-0 flex-col gap-3" data-past-work-panel data-no-team aria-label={t('title')}>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-base text-muted">{tc('pages.tasks.noTeam')}</p>
      </section>
    );

  return (
    <section className="flex min-w-0 flex-col gap-3" data-past-work-panel aria-label={t('title')}>
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      {ownerNeeded && forOthers ? (
        <div className="flex flex-col gap-2" data-past-owner>
          <p className="text-base text-muted">{t('ownerLine')}</p>
          <Field label={t('ownerFor')} className="max-w-sm">
            {(p) => (
              <Select
                id={p.id}
                value={owner?.id ?? ''}
                placeholder={tc('pages.tasks.add.owner_required')}
                onValueChange={(id) => setOwner({ id, name: ownerOptions.find((o) => o.value === id)?.label ?? '' })}
                options={ownerOptions}
              />
            )}
          </Field>
        </div>
      ) : null}
      <PastWorkGrid
        mode="tasks"
        choices={statusChoices(statuses)}
        defaultKind={defaultPastStatus(statuses)}
        lang={lang}
        labels={labels}
        resolveOrganisations={resolveOrganisations}
        resolvePeople={forOthers ? resolvePeople : undefined}
        savedKeys={savedKeys}
        save={save}
        undo={undo}
        ownerNeeded={ownerNeeded}
        fallbackOwner={owner}
        failedSaying={failedSaying}
      />
    </section>
  );
}
