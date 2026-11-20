import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { CREDIT_LIMIT_KEY, mayChangeCreditLimit, type CreditLimitAnswer } from '@/modules/settings/credit-limit';
import { showsFinanceLists, type ExclusionRule, type MergeRule } from '@/modules/settings/finance-lists';
import { listsOf, settingsGroups } from '@/modules/settings/groups';
import { settingsAnswerOf } from '@/modules/settings/schema';
import type { ListEntry } from '@/modules/settings/screens/ListEditor';
import { OrgAccess, type OrgAnswer, type PeopleAnswer, type MatrixAnswer } from '@/modules/org/screens/OrgAccess';
import { CreditLimitCard } from '@/modules/settings/screens/CreditLimitCard';
import { ExclusionListCard } from '@/modules/settings/screens/ExclusionListCard';
import { MergeListCard } from '@/modules/settings/screens/MergeListCard';
import { SettingsGroup } from '@/modules/settings/screens/SettingsGroup';
import { SettingsMenuList } from '@/modules/settings/screens/SettingsMenuList';
import { TargetsScreen } from '@/modules/perf/screens/TargetsScreen';
import type { PlanRow } from '@/modules/perf/types';
import { LIST_VALUES, type ChoiceNames } from '@/modules/settings/words';
import { SettingsShell } from '@/modules/settings/screens/SettingsShell';
import { buttonVariants } from '@/ui/button-variants';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { isAdmin } from '@/ui/shell/nav';
import { Page } from '@/ui/shell/Page';

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const def = settingsGroups().find((g) => g.slug === group);
  return def ? { title: (await getTranslations())(def.label) } : {};
}

// api.finance_credit_limit is newer than the generated database types (Landing 31): read by name until they are
// regenerated.
const readCreditLimit = () =>
  (serverRpc as unknown as (fn: string, args: Record<string, never>) => Promise<unknown>)(
    'finance_credit_limit',
    {},
  ) as Promise<CreditLimitAnswer>;

/** A read that failed is said, never drawn as a figure (M27): null, and the screen names what failed with Try again. */
const orNull = <T,>(read: Promise<T>): Promise<T | null> => read.catch(() => null);

/**
 * A Settings group (V97: admins only — anyone else is refused by address, in words). The group's settings and lists
 * come from the database (api.settings, api.list); People & access carries its own tab row.
 * The one thing in Settings that is everyone's to read is the credit limit, in Finance (Landing 31, the owner's
 * decision of 16 Nov 2026): a manager, a head of department and an admin change it; a team member and a viewer see the
 * read-only view — so Finance opens for them with that card and nothing else of Settings.
 */
export default async function SettingsGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ group }, { tab }, me] = await Promise.all([params, searchParams, requireMe()]);
  // Riyadh's date on the server: the day a setting change applies from is never the browser's clock (PRF-139)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const def = settingsGroups().find((g) => g.slug === group);
  if (!def) notFound();
  const t = await getTranslations();
  const retry = (
    <Link href={`/settings/${group}`} className={cn(buttonVariants({ size: 'sm' }), 'ms-auto')} data-retry>
      <RefreshCw aria-hidden="true" />
      {t('common.tryAgain')}
    </Link>
  );
  const creditLimit = (credit: CreditLimitAnswer | null) =>
    credit ? (
      <CreditLimitCard
        amount={credit.amount}
        canEdit={credit.can_edit && mayChangeCreditLimit(me)}
        undo={isAdmin(me)}
      />
    ) : (
      <DataState
        kind="failed"
        what={t('settings.credit.title')}
        message={t('state.failed', { what: t('settings.credit.title') })}
        action={retry}
      />
    );
  // Finance for someone who is not an admin: the credit limit, and nothing else of Settings — the menu lists only what opens
  if (!isAdmin(me) && group === 'finance')
    return (
      <SettingsShell current={group} title={t(def.label)} only={['finance']}>
        {creditLimit(await orNull(readCreditLimit()))}
      </SettingsShell>
    );
  if (!isAdmin(me))
    return (
      <Page>
        <PageHeader title={t(def.label)} />
        <DataState
          kind="no-access"
          what={t('settings.title')}
          message={t('settings.noAccessAsk')}
          goHome={t('errors.notFound.goMyDay')}
        />
        {/* what Settings does hold for everyone: the credit limit, in Finance */}
        <div className="max-w-[560px]" data-settings-open-to-all>
          <SettingsMenuList
            groups={settingsGroups().filter((g) => g.slug === 'finance')}
            holds={{ finance: t('settings.credit.title') }}
          />
        </div>
      </Page>
    );
  // W47: every read of the page goes out together, one round after me — the settings, the organisation, each list,
  // and on Organization & access the people and the access matrix — not in three rounds one after the other.
  const listDefs = listsOf(def.page);
  const isOrg = group === 'org';
  const isFinance = group === 'finance';
  // the exclusion list and the merge list (Landing 32): an admin's, on Finance — read for nobody else
  const hasLists = showsFinanceLists(me, group);
  // Landing 34 (item 12 — "This page could not be drawn" right after a save that had gone through): every read here
  // answers or is null. The settings, the organisation, the lists and the access matrix were awaited bare, so ONE of
  // them failing on the refresh that follows a save threw the whole page to the crash screen. Now a read that failed
  // is said in the group's own place, with Try again, and the Settings menu stays.
  const [settings, org, listsRead, people, matrix, credit, exclusions, merges] = await Promise.all([
    orNull(serverRpc('settings', { p_group: def.page }) as Promise<unknown>),
    orNull(serverRpc('org', {} as never) as Promise<unknown>),
    Promise.all(
      listDefs.map(async (l) => ({
        ...l,
        rows: (await orNull(
          serverRpc('list', { p_list: l.key, p_include_retired: true }) as Promise<unknown>,
        )) as unknown as ListEntry[] | null,
      })),
    ),
    isOrg ? orNull(serverRpc('people', {} as never) as Promise<unknown>) : null,
    isOrg ? orNull(serverRpc('access_matrix', {} as never) as Promise<unknown>) : null,
    isFinance ? orNull(readCreditLimit()) : null,
    hasLists ? orNull(serverRpc('finance_exclusion_rules', {} as never) as Promise<unknown>) : null,
    hasLists ? orNull(serverRpc('finance_merge_rules', {} as never) as Promise<unknown>) : null,
  ]);
  const failedGroup = (
    <SettingsShell current={group} title={t(def.label)}>
      <DataState kind="failed" what={t(def.label)} message={t('state.failed', { what: t(def.label) })} action={retry} />
    </SettingsShell>
  );
  const answer = settingsAnswerOf(settings);
  const departments = (org as OrgAnswer | null)?.departments;
  if (!answer || !Array.isArray(departments) || listsRead.some((l) => !Array.isArray(l.rows))) return failedGroup;
  if (isOrg && matrix === null) return failedGroup;
  const lists = listsRead as { key: string; label: string; rows: ListEntry[] }[];
  if (isOrg && people === null)
    return (
      <SettingsShell current={group} title={t(def.label)}>
        <DataState
          kind="failed"
          what={t('settings.tabs.people')}
          message={t('settings.people.failed')}
          action={retry}
        />
      </SettingsShell>
    );
  if (isOrg) {
    return (
      <SettingsShell current={group} title={t(def.label)}>
        <OrgAccess
          me={me}
          tab={typeof tab === 'string' ? tab : 'people'}
          org={org as OrgAnswer}
          people={people as PeopleAnswer}
          matrix={matrix as MatrixAnswer}
          settings={answer.settings}
          canEdit={answer.can_edit}
          today={today}
        />
      </SettingsShell>
    );
  }
  // Targets: the plans that are open, and the door to open another (the group has no settings or lists of its own yet)
  if (group === 'performance' && !answer.settings.length && !lists.length) {
    const plans = (await orNull(serverRpc('plans', {} as never) as Promise<unknown>)) as PlanRow[] | null;
    if (!Array.isArray(plans)) return failedGroup;
    return (
      <SettingsShell current={group} title={t(def.label)}>
        <TargetsScreen plans={plans} departments={departments} year={Number(today.slice(0, 4))} />
      </SettingsShell>
    );
  }
  // Values that are the keys of a list's entries are shown by the entries' names (V4, V501): read here, one round more
  // only where this group has such a setting.
  const names: ChoiceNames = {};
  for (const [path, list] of Object.entries(LIST_VALUES)) {
    if (!answer.settings.some((x) => path.startsWith(`${x.key}.`))) continue;
    const have = lists.find((l) => l.key === list)?.rows;
    const entries =
      have ??
      ((await orNull(serverRpc('list', { p_list: list, p_include_retired: true }) as Promise<unknown>)) as
        ListEntry[] | null);
    if (!Array.isArray(entries)) return failedGroup;
    names[path] = entries.filter((e) => e.active);
  }
  return (
    <SettingsShell current={group} title={t(def.label)}>
      {isFinance ? creditLimit(credit) : null}
      {/* a read that failed arrives as null: the card says so with Try again, never as an empty list */}
      {hasLists ? <ExclusionListCard rules={exclusions as ExclusionRule[] | null} /> : null}
      {hasLists ? <MergeListCard rules={merges as MergeRule[] | null} /> : null}
      <SettingsGroup
        names={names}
        // the credit limit is drawn by its own card, above — not a second time as a plain setting
        settings={answer.settings.filter((x) => x.key !== CREDIT_LIMIT_KEY)}
        canEdit={answer.can_edit}
        departments={departments}
        lists={lists}
        today={today}
      />
    </SettingsShell>
  );
}
