'use client';
import {
  Building2,
  CheckSquare,
  ClipboardList,
  Handshake,
  Plus,
  Receipt,
  StickyNote,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Me } from '@/core/auth/me';
import { useMe } from '@/core/auth/me-context';
import { modules } from '@/core/registry';
import { openQuickCapture } from '@/modules/my-day/quick-capture';
import { openLogActivity } from '@/modules/partners/log-activity-entry';
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
  /** Opens the Quick capture sheet where the person stands instead of going to a page (productivity stage 1). */
  sheet?: boolean;
  /** Opens a dialog in the shell where the person stands instead of going to a page (Log activity, V646). */
  dialog?: () => void;
  /** More than one page can let a person in: any of them at the level is enough (Log activity: clients or suppliers). */
  pages?: string[];
  /** Leaves the item out for someone the level alone would let in (the item is never greyed, W4/W28). */
  except?: (me: Me) => boolean;
}[] = [
  { key: 'capture', page: 'my_day', route: '', icon: StickyNote, at: ['view', 'own', 'full'], sheet: true },
  {
    key: 'task',
    page: 'tasks',
    route: '/tasks/new',
    icon: CheckSquare,
    at: ['own', 'full'],
    // Someone in no team without `tasks.assign` may not add a task (QA-521); Add task says so, the + never offers it (QA-245)
    except: (me) => noTeamToWorkIn(me.person.team_id, me.capabilities.includes('tasks.assign')),
  },
  // V646: between Task and the achievement, to anyone who may log activities (Own or Full on a client or supplier page)
  {
    key: 'activity',
    page: 'clients',
    pages: ['clients', 'suppliers_partners'],
    route: '',
    icon: ClipboardList,
    at: ['own', 'full'],
    dialog: openLogActivity,
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
    (a) => (a.pages ?? [a.page]).some((p) => BUILT.has(p) && a.at.includes(me.levels[p] ?? 'none')) && !a.except?.(me),
  );
}

/** The bottom bar's last slot on a phone (the architect's ruling of 15 Oct, option C): shaped like the bar's other slots. */
const barClass =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-nav-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

/** The slot's face: the + in the primary colour, so it reads as the add control, and the word under it. */
function BarFace({ label }: { label: string }) {
  return (
    <>
      <span className="inline-grid h-7 w-12 place-items-center rounded-pill bg-primary text-on-primary">
        <Plus className="size-5" aria-hidden="true" />
      </span>
      <span className="max-w-full truncate px-0.5" data-create-bar-label>
        {label}
      </span>
    </>
  );
}

/**
 * The top bar's Create button, or on a phone the last slot of the bottom bar (V85; the architect's ruling of 15 Oct:
 * nothing floats, so nothing can sit under it). With one item left it opens that item directly, no menu; with none,
 * neither shows (V217).
 */
export function CreateMenu({ bar = false }: { bar?: boolean }) {
  const t = useTranslations();
  const me = useMe();
  const actions = createActionsFor(me);
  if (!actions.length) return null;
  const a = actions.length === 1 ? actions[0] : undefined;
  if (a?.sheet) {
    return bar ? (
      <button
        type="button"
        onClick={() => openQuickCapture()}
        data-create-bar
        data-create-direct={a.key}
        className={barClass}
      >
        <BarFace label={t('top.create')} />
      </button>
    ) : (
      <Button
        variant="primary"
        icon={<Plus />}
        onClick={() => openQuickCapture()}
        data-create
        data-create-direct={a.key}
        className="hidden sm:inline-flex"
      >
        {t(`createNew.${a.key}`)}
      </Button>
    );
  }
  if (a) {
    const label = t(`createNew.${a.key}`);
    return bar ? (
      <Link href={a.route} data-create-bar data-create-direct={a.key} className={barClass}>
        <BarFace label={t('top.create')} />
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
        {bar ? (
          <button type="button" data-create-bar className={barClass}>
            <BarFace label={t('top.create')} />
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
              {a.sheet || a.dialog ? (
                <button
                  type="button"
                  onClick={() => (a.dialog ? a.dialog() : openQuickCapture())}
                  data-create-item={a.key}
                >
                  <Icon />
                  {t(`create.${a.key}`)}
                </button>
              ) : (
                <Link href={a.route} data-create-item={a.key}>
                  <Icon />
                  {t(`create.${a.key}`)}
                </Link>
              )}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
