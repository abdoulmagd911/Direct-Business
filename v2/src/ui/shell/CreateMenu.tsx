'use client';
import { Building2, CheckSquare, Handshake, Plus, Receipt, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Me } from '@/core/auth/me';
import { useMe } from '@/core/auth/me-context';
import { modules } from '@/core/registry';
import { noTeamToWorkIn } from '@/modules/tasks/rules';
import type { Level } from '@/core/registry/define-module';
import { Button, buttonVariants } from '../Button';
import { cn } from '../cn';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';

/**
 * The Create items (V217, cut 3): an item shows only once its page is built (registry `built`) and the person may
 * create there — a task or an achievement at Own or Full (V605: an employee logs their own, V68), the rest at Full. Never a raw address, never a greyed item (W4/W28).
 */
export const CREATE_ACTIONS: {
  key: string;
  page: string;
  route: string;
  icon: LucideIcon;
  at: Level[];
  /** Leaves the item out for someone the level alone would let in (the item is never greyed, W4/W28). */
  except?: (me: Me) => boolean;
}[] = [
  {
    key: 'task',
    page: 'tasks',
    route: '/tasks/new',
    icon: CheckSquare,
    at: ['own', 'full'],
    // Someone in no team without `tasks.assign` may not add a task (QA-521); Add task says so, the + never offers it (QA-245)
    except: (me) => noTeamToWorkIn(me.person.team_id, me.capabilities.includes('tasks.assign')),
  },
  { key: 'client', page: 'clients', route: '/clients?new=1', icon: Building2, at: ['full'] },
  { key: 'supplier', page: 'suppliers_partners', route: '/suppliers?new=1', icon: Handshake, at: ['full'] },
  { key: 'invoice', page: 'finance', route: '/finance/new', icon: Receipt, at: ['full'] },
  { key: 'achievement', page: 'kpis', route: '/kpis/achievements/new', icon: Trophy, at: ['own', 'full'] },
];

/** The pages whose screens are built (registry `built`): Create offers them; My day's Turn into opens them (V433). */
export const BUILT: ReadonlySet<string> = new Set(
  modules.flatMap((m) => (m.pages ?? []).filter((p) => p.built).map((p) => p.key)),
);

/** The Create items this person gets, in order. */
export function createActionsFor(me: Me) {
  return CREATE_ACTIONS.filter(
    (a) => BUILT.has(a.page) && a.at.includes(me.levels[a.page] ?? 'none') && !a.except?.(me),
  );
}

const floatingClass =
  'fixed bottom-[76px] end-4 z-30 inline-grid size-14 place-items-center rounded-pill bg-primary text-on-primary shadow-2 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 sm:hidden [&_svg]:size-6';

/**
 * The top bar's Create button, or on a phone the floating + above the bottom bar (V85). With one item left the button
 * opens it directly, no menu; with none, neither shows (V217). The + hides on a page that says no access.
 */
export function CreateMenu({ floating = false }: { floating?: boolean }) {
  const t = useTranslations();
  const me = useMe();
  const actions = createActionsFor(me);
  if (!actions.length) return null;
  const a = actions.length === 1 ? actions[0] : undefined;
  if (a) {
    const label = t(`createNew.${a.key}`);
    return floating ? (
      <Link href={a.route} aria-label={label} data-create-floating data-create-direct={a.key} className={floatingClass}>
        <Plus aria-hidden="true" />
      </Link>
    ) : (
      <Link
        href={a.route}
        data-create
        data-create-direct={a.key}
        className={cn(buttonVariants({ variant: 'primary' }), 'hidden sm:inline-flex')}
      >
        <Plus aria-hidden="true" />
        {label}
      </Link>
    );
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        {floating ? (
          <button type="button" aria-label={t('top.create')} data-create-floating className={floatingClass}>
            <Plus aria-hidden="true" />
          </button>
        ) : (
          <Button variant="primary" icon={<Plus />} data-create className="hidden sm:inline-flex">
            {t('top.create')}
          </Button>
        )}
      </MenuTrigger>
      <MenuContent>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <MenuItem key={a.key} asChild>
              <Link href={a.route} data-create-item={a.key}>
                <Icon />
                {t(`create.${a.key}`)}
              </Link>
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
